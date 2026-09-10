/* ============================================================
   ONLINE MODE — most mezi herním stavem a Firebase vrstvou.
   Nezná Firebase API přímo, volá pouze FlowNet (js/firebase.js).

   Klíčové rozlišení (viz bod 8 zadání):
     USER ACTION  -> mutace room + zápis do Firebase
     REMOTE UPDATE-> pouze aktualizace lokálního state + render (BEZ zápisu)
   ============================================================ */

const RECONNECT_KEY_CODE = 'flow_room_code';
const RECONNECT_KEY_NAME = 'flow_player_name';

/* Firebase neumí ukládat prázdná pole/undefined — normalizace při čtení. */
function normalizeRoom(raw){
  if(!raw) return null;
  const room = Object.assign({}, raw);
  room.players = raw.players ? Object.keys(raw.players).map(uid=>{
    const p = raw.players[uid];
    return {
      id: uid,
      name: p.name,
      halves: p.halves || {red:0,blue:0,yellow:0},
      full: p.full || {red:0,blue:0,yellow:0},
      skipNext: !!p.skipNext,
      joinedAt: p.joinedAt || 0,
      online: p.online !== false
    };
  }).sort((a,b)=> (a.joinedAt||0) - (b.joinedAt||0)) : [];
  room.decks = {
    red: (raw.decks && raw.decks.red) || [],
    blue: (raw.decks && raw.decks.blue) || [],
    yellow: (raw.decks && raw.decks.yellow) || [],
    chance: (raw.decks && raw.decks.chance) || []
  };
  room.direction = raw.direction || 1;
  room.turnIndex = raw.turnIndex || 0;
  room.currentCard = raw.currentCard || null;
  room.winnerId = raw.winnerId || null;
  room.lastRolledColor = raw.lastRolledColor || null;
  room.votes = raw.votes || {};             // playerId -> index zvolené možnosti
  room.awardColors = raw.awardColors || {}; // playerId -> barva půlkarty
  return room;
}

/* Převede lokální room objekt zpět do tvaru pro Firebase (players jako mapa). */
function roomToFirebase(room){
  const playersMap = {};
  room.players.forEach(p=>{
    playersMap[p.id] = {
      name: p.name,
      halves: p.halves,
      full: p.full,
      skipNext: !!p.skipNext,
      joinedAt: p.joinedAt || 0,
      online: true
    };
  });
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: playersMap,
    turnIndex: room.turnIndex,
    turnPlayerId: room.players[room.turnIndex] ? room.players[room.turnIndex].id : null,
    direction: room.direction,
    lastRolledColor: room.lastRolledColor,
    currentCard: room.currentCard,
    decks: room.decks,
    winnerId: room.winnerId,
    votes: room.votes || {},
    awardColors: room.awardColors || {},
    createdAt: room.createdAt || Date.now()
  };
}

const Online = {

  /* ---------- VYTVOŘENÍ MÍSTNOSTI ---------- */
  async createRoom(hostName){
    const myUid = await FlowNet.ready();
    const code = await FlowNet.createRoom(
      ()=>uid(5),
      (code, hostUid)=>{
        const host = newPlayer(hostUid, hostName);
        host.joinedAt = Date.now();
        const room = {
          code, hostId: hostUid, phase:'lobby',
          players:[host], turnIndex:0, direction:1,
          lastRolledColor:null, currentCard:null,
          decks: freshDecks(), winnerId:null, createdAt: Date.now()
        };
        return roomToFirebase(room);
      }
    );
    state.myPlayerId = myUid;
    Online.rememberSession(code, hostName);
    Online.startSync(code);
    FlowNet.setupDisconnect(code).catch(e=>console.error('disconnect setup', e));
    return code;
  },

  /* ---------- PŘIPOJENÍ DO MÍSTNOSTI ---------- */
  async joinRoom(code, name){
    const myUid = await FlowNet.ready();
    const p = newPlayer(myUid, name);
    p.joinedAt = Date.now();
    // Ověření místnosti i zápis hráče v jednom kroku.
    const res = await FlowNet.joinRoomFast(code, {
      name: p.name, halves: p.halves, full: p.full,
      skipNext: false, joinedAt: p.joinedAt, online: true
    });
    if(!res.ok) return { ok:false, reason:'not-found' };
    const raw = { phase: res.phase };
    state.myPlayerId = myUid;
    Online.rememberSession(code, name);
    // Poslouchat začneme hned; nastavení "offline při zavření karty"
    // běží na pozadí a nezdržuje vstup do místnosti.
    Online.startSync(code);
    FlowNet.setupDisconnect(code).catch(e=>console.error('disconnect setup', e));
    return { ok:true, phase: raw.phase };
  },

  /* ---------- REALTIME SYNC (nahrazuje polling) ---------- */
  startSync(code){
    Store.mode = 'online';
    Store.roomCode = code;
    FlowNet.listenToRoom(code, (raw)=>{
      // REMOTE UPDATE — pouze lokální state + render, žádný zápis zpět.
      if(!raw){
        // místnost zmizela (host ji ukončil)
        FlowNet.stopListening();
        Online.forgetSession();
        alert('Místnost byla ukončena.');
        resetAppState();
        render();
        return;
      }
      const room = normalizeRoom(raw);
      state.room = room;
      if(room.phase === 'lobby'){
        if(state.screen !== 'lobby'){ state.screen = 'lobby'; }
      } else if(state.screen === 'lobby' || state.screen === 'joinRoom' || state.screen === 'setupHost'){
        state.screen = 'game';
      }
      render();
    });
  },

  stopSync(){
    FlowNet.stopListening();
  },

  /* ---------- ZÁPIS HERNÍ AKCE ---------- */
  /* Volá se po tom, co engine zmutoval lokální room objekt.
     Zapisuje cíleně jen to, co se mohlo změnit. */
  async pushState(room){
    const changes = {
      'phase': room.phase,
      'turnIndex': room.turnIndex,
      'turnPlayerId': room.players[room.turnIndex] ? room.players[room.turnIndex].id : null,
      'direction': room.direction,
      'lastRolledColor': room.lastRolledColor,
      'currentCard': room.currentCard,
      'decks': room.decks,
      'winnerId': room.winnerId,
      'votes': room.votes || {},
      'awardColors': room.awardColors || {}
    };
    room.players.forEach(p=>{
      changes['players/'+p.id+'/halves'] = p.halves;
      changes['players/'+p.id+'/full'] = p.full;
      changes['players/'+p.id+'/skipNext'] = !!p.skipNext;
    });
    await FlowNet.updateRoom(room.code, changes);
  },

  /* Zápis jednoho hlasu — jen vlastní větev, ne celý stav. */
  async pushVote(code, playerId, optionIndex){
    await FlowNet.updateRoom(code, { ['votes/'+playerId]: optionIndex });
  },

  /* Zápis zvolené barvy půlkarty jedním hráčem. */
  async pushAwardColor(code, playerId, color){
    await FlowNet.updateRoom(code, { ['awardColors/'+playerId]: color });
  },

  /* ---------- RECONNECT ---------- */
  rememberSession(code, name){
    try{
      localStorage.setItem(RECONNECT_KEY_CODE, code);
      localStorage.setItem(RECONNECT_KEY_NAME, name);
    }catch(e){}
  },
  forgetSession(){
    try{
      localStorage.removeItem(RECONNECT_KEY_CODE);
      localStorage.removeItem(RECONNECT_KEY_NAME);
    }catch(e){}
  },
  savedSession(){
    try{
      const code = localStorage.getItem(RECONNECT_KEY_CODE);
      const name = localStorage.getItem(RECONNECT_KEY_NAME);
      return code ? {code, name} : null;
    }catch(e){ return null; }
  },

  /* Pokus o návrat do místnosti po refreshi stránky. */
  async tryReconnect(){
    const saved = Online.savedSession();
    if(!saved) return false;
    if(!FlowNet.available()) return false;
    try{
      const myUid = await FlowNet.ready();
      const raw = await FlowNet.getRoom(saved.code);
      if(!raw || !raw.players || !raw.players[myUid]){
        Online.forgetSession();
        return false;
      }
      state.myPlayerId = myUid;
      await FlowNet.setupDisconnect(saved.code);
      Online.startSync(saved.code);
      return true;
    }catch(e){
      console.error('reconnect failed', e);
      return false;
    }
  },

  /* Host opustí/ukončí místnost. */
  async leaveRoom(){
    Online.stopSync();
    Online.forgetSession();
  }
};
