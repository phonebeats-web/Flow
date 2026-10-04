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
    rulesOpen: false,    // rozbalená pravidla na úvodní obrazovce
    blueCompose: {a:'', b:'', c:'', correct:0}, // rozepsané možnosti u modré karty
    secretCorrect: null, // správná odpověď — drží se lokálně do vyhodnocení
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
    lastRolledColor:null, lastRoll:null, currentCard:null, decks:freshDecks(), winnerId:null, finalDone:false,
    pendingColor:null, extraTurn:false, yellow:null, votes:{}, awardColors:{}
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
  try{ await Online.leaveRoom(); }catch(e){ console.error(e); }
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
/* Vylosuje barvu. Odděleno od rollDice, aby UI mohlo
   nejdřív přehrát animaci hodu a teprve pak výsledek použít. */
function pickDieColor(){
  return ['red','blue','yellow'][Math.floor(Math.random()*3)];
}

/* Hráč hází vždy DVAKRÁT.
   Rozdílné barvy -> otázka první barvy.
   Stejné barvy   -> nejdřív karta šance, potom (pokud to jde) otázka té barvy. */
async function rollDice(first, second){
  const room = state.room;
  first = first || pickDieColor();
  second = second || pickDieColor();
  const res = evaluateRoll(first, second);
  room.lastRoll = [first, second];
  room.lastRolledColor = res.color;
  if(res.isDouble){
    const chance = drawFrom(room,'chance');
    room.currentCard = {type:'chance', text:chance.text, key:chance.key};
    room.pendingColor = res.color;   // otázka, která přijde po kartě šance
    room.phase='chance';
  } else {
    room.pendingColor = null;
    startQuestion(room, res.color);
  }
  await saveAndRender();
}

/* Vytáhne otázku dané barvy a nastaví odpovídající fázi.
   (Neukládá — volající pak zavolá saveAndRender.) */
function startQuestion(room, color){
  const q = drawFrom(room,color);
  room.currentCard = {type:'question', color, text:q};
  room.pendingColor = null;
  if(color==='blue' && Store.mode==='online'){
    // Online + modrá: hráč na tahu nejdřív vymyslí 3 možnosti (kvízový režim).
    room.votes = {};
    room.awardColors = {};
    state.blueCompose = {a:'', b:'', c:'', correct:0};
    room.phase='blue-compose';
  } else if(color==='yellow'){
    // Žlutá: odpovídají postupně všichni, začíná hráč na tahu.
    const order = yellowOrder(room);
    room.yellow = { order, current: order[0], answered: {} };
    room.phase='yellow-round';
  } else {
    room.phase='rolled-question';
  }
}

/* Po vyřešení karty šance: pokud čeká otázka z dvojitého hodu,
   pokračuje se na ni, jinak tah končí. */
function continueAfterChance(room){
  if(room.phase==='finished') return;
  if(room.pendingColor){
    startQuestion(room, room.pendingColor);
  } else {
    advanceTurn(room);
  }
}

/* ---------- ŽLUTÁ OTÁZKA ---------- */
/* Hráč (playerId) potvrdil, zda odpověděl. Kdo neodpoví, ztrácí žlutou
   kartu (nejdřív celou, pak půlku; když nemá nic, nic se neděje). */
async function yellowAnswer(playerId, answered){
  const room = state.room;
  const y = room.yellow;
  if(!y || y.current!==playerId) return;
  const p = room.players.find(x=>x.id===playerId);
  const ap = activePlayer(room);

  // Hráč, který kartu vytáhl, odpovídá první. Když neodpoví,
  // ztrácí žlutou a kolo končí.
  if(playerId===ap.id && Object.keys(y.answered||{}).length===0){
    if(!answered){
      loseColor(ap,'yellow');
      advanceTurn(room);
      await saveAndRender();
      return;
    }
    y.answered = Object.assign({}, y.answered, {[playerId]:true});
    y.current = yellowNextId(room);
    await saveAndRender();
    return;
  }

  if(!answered && p) loseColor(p,'yellow');
  y.answered = Object.assign({}, y.answered, {[playerId]: !!answered});
  y.current = yellowNextId(room);

  if(Store.mode==='online' && playerId!==ap.id){
    // Odpovídající hráč není na tahu -> zapíše jen svou odpověď,
    // posun v kole a vlastní karty (víc mu pravidla databáze nedovolí).
    render();
    try{ await Online.pushYellowAnswer(room, p); }
    catch(e){ console.error('yellow push failed', e); }
    return;
  }
  await saveAndRender();
}

/* Kolo došlo zpět k hráči, který kartu vytáhl -> získává žlutou kartu. */
async function yellowFinish(){
  const room = state.room;
  const ap = activePlayer(room);
  addFull(ap,'yellow');
  if(!resolveWin(room, ap)) advanceTurn(room);
  await saveAndRender();
}

/* ---------- HOST: PŘESKOČENÍ HRÁČE, KTERÝ ODEŠEL ---------- */
async function hostSkipTurn(){
  const room = state.room;
  room.extraTurn = false;
  advanceTurn(room);
  await saveAndRender();
}

/* ---------- MODRÁ: SPRÁVNÁ ODPOVĚĎ ---------- */
/* Správná odpověď se do databáze posílá až při vyhodnocení.
   Do té doby je jen v zařízení hráče na tahu — uložená i v localStorage,
   aby se neztratila, když si stránku obnoví. */
const SECRET_KEY = 'flou_secret_correct';
function rememberSecret(code, idx){
  state.secretCorrect = idx;
  try{ localStorage.setItem(SECRET_KEY, JSON.stringify({code, idx})); }catch(e){}
}
function recallSecret(code){
  if(state.secretCorrect!==null && state.secretCorrect!==undefined) return state.secretCorrect;
  try{
    const v = JSON.parse(localStorage.getItem(SECRET_KEY)||'null');
    if(v && v.code===code) return v.idx;
  }catch(e){}
  return null;
}
function forgetSecret(){
  state.secretCorrect = null;
  try{ localStorage.removeItem(SECRET_KEY); }catch(e){}
}

/* ============ BOOTSTRAP ============ */

/* Kód místnosti z odkazu (…?kod=ABCDE) — kamarád tak skočí
   rovnou na připojení s předvyplněným kódem. */
function codeFromUrl(){
  try{
    const m = location.search.match(/[?&]kod=([^&]+)/i);
    return m ? decodeURIComponent(m[1]).toUpperCase().trim() : null;
  }catch(e){ return null; }
}

(async function boot(){
  const invited = codeFromUrl();
  if(invited){
    state.joinCode = invited;
    state.screen = 'joinRoom';
  }
  render();

  if(typeof FlowNet === 'undefined' || !FlowNet.available()) return;

  // Přihlášení a navázání spojení spustíme HNED po načtení stránky,
  // ne až po kliknutí. Než uživatel napíše své jméno, je hotové —
  // takže vytvoření i připojení do místnosti je pak výrazně rychlejší.
  FlowNet.ready().catch(e=>console.error('auth warmup failed', e));

  // Pozvánka má přednost před návratem do staré místnosti.
  if(invited) return;

  // pokus o návrat do rozehrané online místnosti po refreshi
  try{
    const reconnected = await Online.tryReconnect();
    if(reconnected) return; // listener nastaví obrazovku
  }catch(e){ console.error('reconnect error', e); }
})();
