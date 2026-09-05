/* ============================================================
   APP — stav aplikace, ukládání stavu, local mode, herní akce.
   Online zápisy jdou přes Online.pushState() (js/online.js),
   který dál volá FlowNet (js/firebase.js). Tento soubor
   nevolá Firebase API přímo.
   ============================================================ */

/* ============ STORAGE ============ */
const Store = {
  mode: 'local', // 'local' | 'online'
  roomCode: null,
  async setRoom(room){
    if(this.mode==='local'){ window._localRoom = room; return; }
    await Online.pushState(room);
  }
};

/* ============ APP STATE ============ */
function initialState(){
  return {
    screen: 'home',
    mode: null, // 'local' | 'online'
    myPlayerId: null,
    myName: '',
    setupNames: [],
    joinCode: '',
    room: null,
    busy: false,
    guessSelections: {}, // playerId -> true/false during guess resolution
    guessColors: {},     // playerId -> chosen color
    chanceUI: {},        // scratch state for chance resolution
  };
}
let state = initialState();
function resetAppState(){
  Store.mode = 'local';
  Store.roomCode = null;
  state = initialState();
}

/* ============ LOCAL MODE ============ */
function startLocalGame(names){
  const players = names.map(n=>newPlayer(uid(4), n));
  Store.mode='local';
  Store.roomCode=null;
  const room = {
    code:null, phase:'idle', players, turnIndex:0, direction:1,
    lastRolledColor:null, currentCard:null, decks:freshDecks(), winnerId:null
  };
  Store.setRoom(room);
  state.room = room;
  state.myPlayerId = null; // local mode: no fixed "me", everyone shares the device
  state.screen='game';
  render();
}

/* ============ ONLINE ENTRY POINTS ============ */
async function hostCreateRoom(name){
  if(!FlowNet.available()){
    alert('Online režim vyžaduje připojení k internetu.');
    return;
  }
  state.busy = true; render();
  try{
    await Online.createRoom(name);
    // obrazovku i state nastaví realtime listener (Online.startSync)
  }catch(e){
    console.error(e);
    alert('Nepodařilo se vytvořit místnost. Zkontroluj připojení k internetu.');
    state.screen='home';
  }finally{
    state.busy = false; render();
  }
}

async function playerJoinRoom(code, name){
  if(!FlowNet.available()){
    alert('Online režim vyžaduje připojení k internetu.');
    return;
  }
  state.busy = true; render();
  try{
    const res = await Online.joinRoom(code, name);
    if(!res.ok){
      alert('Místnost s tímto kódem nenalezena.');
      state.screen='joinRoom';
    }
  }catch(e){
    console.error(e);
    alert('Připojení se nezdařilo. Zkontroluj kód a připojení k internetu.');
    state.screen='joinRoom';
  }finally{
    state.busy = false; render();
  }
}

async function hostStartGame(){
  const room = state.room;
  if(room.players.length<2){ alert('Potřeba alespoň 2 hráči.'); return; }
  room.phase='idle';
  await Online.pushState(room);
}

async function leaveOnlineRoom(){
  await Online.leaveRoom();
  resetAppState();
  render();
}

/* ============ SHARED HELPERS ============ */
function isMyTurnOrLocal(room){
  if(Store.mode==='local') return true;
  const ap = activePlayer(room);
  return ap && ap.id===state.myPlayerId;
}
function amHost(room){
  if(Store.mode==='local') return true;
  return room.hostId === state.myPlayerId;
}
async function saveAndRender(){
  if(Store.mode==='local'){
    await Store.setRoom(state.room);
    render();
  } else {
    // USER ACTION -> zápis; render zajistí i realtime listener,
    // ale renderujeme hned pro okamžitou odezvu.
    render();
    try{ await Online.pushState(state.room); }
    catch(e){ console.error('push failed', e); }
  }
}

/* ============ HERNÍ AKCE ============ */
async function rollDice(){
  const room = state.room;
  const color = ['red','blue','yellow'][Math.floor(Math.random()*3)];
  const isDouble = room.lastRolledColor===color;
  room.lastRolledColor = color;
  if(isDouble){
    const chance = drawFrom(room,'chance');
    room.currentCard = {type:'chance', text:chance.text, key:chance.key};
    room.phase='chance';
  } else {
    const q = drawFrom(room,color);
    room.currentCard = {type:'question', color, text:q};
    room.phase='rolled-question';
  }
  await saveAndRender();
}

/* ============ BOOTSTRAP ============ */
(async function boot(){
  render();
  // pokus o návrat do rozehrané online místnosti po refreshi
  if(typeof FlowNet !== 'undefined' && FlowNet.available()){
    try{
      const reconnected = await Online.tryReconnect();
      if(reconnected) return; // listener nastaví obrazovku
    }catch(e){ console.error('reconnect error', e); }
  }
})();
