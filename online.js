(window.FLOU_FILES = window.FLOU_FILES || {})['online.js'] = '41';   /* verze souboru — kontrola, že jsou na webu všechny soubory stejné verze */
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
  room.lastRoll = Array.isArray(raw.lastRoll) ? raw.lastRoll : null;
  room.pendingColor = raw.pendingColor || null;   // otázka čekající po kartě šance
  room.extraTurn = !!raw.extraTurn;                // „Jedeš ještě jednou"
  room.round = raw.round && raw.round.order ? {
    color: raw.round.color,
    order: raw.round.order,
    current: raw.round.current || null,
    answered: raw.round.answered || {}
  } : null;
  room.finalDone = !!raw.finalDone;         // vítěz už položil závěrečnou otázku
  room.votes = raw.votes || {};             // playerId -> index zvolené možnosti
  room.tips = raw.tips || {};               // playerId -> tip předem (modrá)
  room.blueAuthor = raw.blueAuthor || null;
  room.blueBeneficiary = raw.blueBeneficiary || null;
  room.composeProgress = raw.composeProgress || null; // {filled, step} — průběh psaní
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
    lastRoll: room.lastRoll || null,
    pendingColor: room.pendingColor || null,
    extraTurn: !!room.extraTurn,
    round: room.round || null,
    currentCard: room.currentCard,
    decks: room.decks,
    winnerId: room.winnerId,
    votes: room.votes || {},
    awardColors: room.awardColors || {},
    tips: room.tips || {},
    composeProgress: room.composeProgress || null,
    blueAuthor: room.blueAuthor || null,
    blueBeneficiary: room.blueBeneficiary || null,
    finalDone: !!room.finalDone,
    createdAt: room.createdAt || Date.now()
  };
}

const Online = {

  /* ---------- VYTVOŘENÍ MÍSTNOSTI ---------- */
  async createRoom(hostName){
    const myUid = await FlowNet.ready();
    const code = await FlowNet.createRoom(
      ()=>uid(6),   // 6 znaků = přes miliardu kombinací, kód nejde uhádnout
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
    if(!res.ok) return { ok:false, reason: res.reason || 'not-found' };
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
    Online.lastSynced = null;
    History.reset();
    Store.roomCode = code;
    FlowNet.listenToRoom(code, (raw)=>{
      // REMOTE UPDATE — pouze lokální state + render, žádný zápis zpět.
      if(!raw){
        // místnost zmizela (host ji ukončil)
        FlowNet.stopListening();
        Online.forgetSession();
        uiAlert(t('room_ended'));
        resetAppState();
        render();
        return;
      }
      Online.lastSynced = raw;
      // Herní stav dostane vlastní kopii — jinak by úpravy během tahu
      // měnily i „poslední známý stav" a změny by se neodeslaly.
      const room = normalizeRoom(JSON.parse(JSON.stringify(raw)));
      const prevScreen = state.screen;
      if(room.phase === 'lobby'){
        state.screen = 'lobby';
      } else if(state.screen !== 'game'){
        // Hra běží (i po návratu po obnovení stránky) -> herní obrazovka.
        state.screen = 'game';
      }
      if(room.phase !== 'lobby') History.record(room);
      // Vlastní zápis se vrací jako stejný stav, jaký už je vykreslený —
      // pak není potřeba překreslovat (méně práce, žádné poblikávání).
      const same = state.room && prevScreen===state.screen && stableStr(room)===stableStr(state.room);
      // Stejný stav: ponecháme stávající objekt — tlačítka na obrazovce s ním pracují.
      // (Kdyby se vyměnil bez překreslení, kliknutí by měnilo starou kopii a nic by se neodeslalo.)
      if(!same){ state.room = room; render(); }
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
      'lastRoll': room.lastRoll || null,
      'pendingColor': room.pendingColor || null,
      'extraTurn': !!room.extraTurn,
      'round': room.round || null,
      'currentCard': room.currentCard,
      'decks/red': room.decks.red,
      'decks/blue': room.decks.blue,
      'decks/yellow': room.decks.yellow,
      'decks/chance': room.decks.chance,
      'winnerId': room.winnerId,
      'votes': room.votes || {},
      'awardColors': room.awardColors || {},
      'tips': room.tips || {},
      'composeProgress': room.composeProgress || null,
      'blueAuthor': room.blueAuthor || null,
      'blueBeneficiary': room.blueBeneficiary || null,
      'finalDone': !!room.finalDone
    };
    room.players.forEach(p=>{
      changes['players/'+p.id+'/halves'] = p.halves;
      changes['players/'+p.id+'/full'] = p.full;
      changes['players/'+p.id+'/skipNext'] = !!p.skipNext;
    });
    // Posíláme jen to, co se oproti poslednímu stavu z databáze změnilo
    // (např. balíčky karet se mění jen při tažení) — menší a rychlejší zápis.
    const base = Online.lastSynced;
    if(base){
      for(const path in changes){
        const v = changes[path];
        const now = path.split('/').reduce((o,k)=> (o && typeof o==='object') ? o[k] : undefined, base);
        const same = (path.endsWith('skipNext') || path==='extraTurn' || path==='finalDone')
          ? (!!now === !!v)
          : stableStr(now) === stableStr(v);
        if(same) delete changes[path];
      }
    }
    if(!Object.keys(changes).length) return;
    // Zapsané hodnoty si hned promítneme do posledního známého stavu,
    // aby rychle za sebou jdoucí akce porovnávaly se správnými daty.
    if(base){
      for(const path in changes){
        const keys = path.split('/');
        let o = base;
        for(let i=0;i<keys.length-1;i++){
          if(!o[keys[i]] || typeof o[keys[i]]!=='object') o[keys[i]] = {};
          o = o[keys[i]];
        }
        o[keys[keys.length-1]] = changes[path];
      }
    }
    await FlowNet.updateRoom(room.code, changes);
  },

  /* Kolečko odpovědí: odpověď hráče, který NENÍ na tahu.
     Zapisuje jen svou odpověď, posun kolečka a své vlastní karty. */
  async pushRoundAnswer(room, player){
    const changes = {
      'round/current': room.round.current,
      ['round/answered/'+player.id]: !!room.round.answered[player.id],
      ['players/'+player.id+'/halves']: player.halves,
      ['players/'+player.id+'/full']: player.full
    };
    await FlowNet.updateRoom(room.code, changes);
  },

  /* Tip předem u modré karty — jen vlastní větev. */
  async pushTip(code, playerId, text){
    await FlowNet.updateRoom(code, { ['tips/'+playerId]: text || null });
  },

  /* Průběh psaní odpovědí (kolik je vyplněno, ve kterém je kroku).
     Posílá se jen při změně, ne při každém písmenku. */
  async pushProgress(code, progress){
    await FlowNet.updateRoom(code, { 'composeProgress': progress });
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
      Online.startSync(saved.code);
      FlowNet.setupDisconnect(saved.code).catch(e=>console.error('disconnect setup', e));
      return true;
    }catch(e){
      console.error('reconnect failed', e);
      return false;
    }
  },

  /* Hráč opustí místnost. */
  async leaveRoom(){
    const code = Store.roomCode;
    const room = state.room;
    Online.stopSync();
    Online.forgetSession();
    if(!code) return;
    // Hostitel, který odchází z čekárny nebo z dohrané hry, místnost smaže —
    // jména hráčů tak nezůstávají v databázi.
    if(room && room.hostId===state.myPlayerId && (room.phase==='lobby' || room.phase==='finished')){
      await FlowNet.deleteRoom(code).catch(()=>{});
      return;
    }
    // Ostatní uvidí, že hráč odešel (host ho pak může přeskočit).
    await FlowNet.markOffline(code).catch(()=>{});
  }
};
