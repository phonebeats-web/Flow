(window.FLOU_FILES = window.FLOU_FILES || {})['app.js'] = '41';   /* verze souboru — kontrola, že jsou na webu všechny soubory stejné verze */
/* ============================================================
   APP — stav aplikace, historie (krok zpět), local mode,
   hra pro jednoho a herní akce.
   Online zápisy jdou přes Online.pushState() (online.js),
   který dál volá FlowNet (firebase.js). Tento soubor
   nevolá Firebase API přímo.
   ============================================================ */

/* ============ STORAGE ============ */
const Store = {
  mode: 'local', // 'local' | 'online'
  roomCode: null
};

/* ============ APP STATE ============ */
function freshBlueCompose(){ return {a:'', b:'', c:'', correct:null, step:1}; }

function initialState(){
  return {
    screen: 'home',
    myPlayerId: null,
    myName: '',
    setupNames: [],
    joinCode: '',
    room: null,
    busy: false,
    chanceUI: {},        // pomocný stav u karet šance
    exchangeUI: null,    // rozpracovaná směna karet na začátku tahu
    leaveOpen: false,    // rozbalený výběr hráče, který odchází (jedno zařízení)
    rulesOpen: false,    // rozbalená pravidla na úvodní obrazovce
    blueCompose: freshBlueCompose(), // rozepsané možnosti u modré karty
    secretCorrect: null, // online: správná odpověď — drží se lokálně do vyhodnocení
    handoff: null,       // jedno zařízení: kdo potvrdil, že drží zařízení
    hintSeen: {},        // nápověda: kolikrát už padla každá barva (red/blue/yellow/chance)
    hintTuckShown: {},   // nápověda: animace „schování na kartu" už proběhla
    cardFlipped: false,  // karta je otočená na stranu s nápovědou
    introDone: {},       // u kterých barev už hráč viděl pravidla (karta rubem nahoru)
    unflipNext: false,   // po „Rozumím" se karta plynule otočí na otázku
    solo: null,          // hra pro jednoho
  };
}
let state = initialState();
function resetAppState(){
  Store.mode = 'local';
  Store.roomCode = null;
  History.reset();
  state = initialState();
}
/* Vyčistí rozpracované volby v UI (po kroku zpět apod.). */
function clearTransientUI(){
  state.chanceUI = {};
  state.exchangeUI = null;
  state.leaveOpen = false;
  state.handoff = null;
  state.blueCompose = freshBlueCompose();
}

/* ============ HISTORIE — KROK ZPĚT ============ */
/* Ukládá potvrzené stavy hry. Krok zpět vrátí předchozí stav.
   Na jednom zařízení se ukládá po každé akci, online po každé změně
   přijaté z databáze (takže jde vrátit i akci jiného hráče). */
function historyKey(room){
  // Do porovnání nepatří, kdo je zrovna online.
  // Tipy a průběh psaní nejsou herní tahy — krok zpět je nevrací.
  return stableStr(Object.assign({}, room, {
    tips: null, composeProgress: null,
    players: room.players.map(p=>({id:p.id, name:p.name, halves:p.halves, full:p.full, skipNext:!!p.skipNext}))
  }));
}
const History = {
  stack: [],          // [{key, json}]
  max: 30,
  reset(){ this.stack = []; },
  record(room){
    if(!room) return;
    const key = historyKey(room);
    const last = this.stack[this.stack.length-1];
    if(last && last.key===key) return;
    this.stack.push({key, json: JSON.stringify(room)});
    if(this.stack.length > this.max) this.stack.shift();
  },
  canUndo(){ return this.stack.length >= 2; }
};

function canUndo(room){
  if(!room || state.rolling || !History.canUndo()) return false;
  if(Store.mode==='local') return true;
  return amHost(room) || isMyTurnOrLocal(room);
}

async function undoStep(){
  if(!History.canUndo()) return;
  History.stack.pop();
  const prev = JSON.parse(History.stack[History.stack.length-1].json);
  // Kdo je online, se nevrací — to je skutečnost, ne herní stav.
  if(state.room){
    prev.players.forEach(p=>{
      const now = state.room.players.find(x=>x.id===p.id);
      if(now){ p.online = now.online; }
    });
  }
  clearTransientUI();
  state.room = prev;
  state.suppressFly = true;   // krok zpět není zisk karty — bez animace
  render();
  if(Store.mode==='online'){
    try{ await Online.pushState(prev); }
    catch(e){ console.error('undo push failed', e); }
  }
}

/* ============ LOCAL MODE ============ */
function startLocalGame(names){
  names = names.map(cleanName).filter(Boolean).slice(0, MAX_PLAYERS);
  const players = names.map(n=>newPlayer(uid(4), n));
  Store.mode='local';
  Store.roomCode=null;
  History.reset();
  const room = {
    code:null, phase:'idle', players, turnIndex:0, direction:1,
    lastRolledColor:null, lastRoll:null, currentCard:null, decks:freshDecks(), winnerId:null, finalDone:false,
    pendingColor:null, extraTurn:false, round:null, blueTurn:null, votes:{}, awardColors:{},
    tips:{}, composeProgress:null
  };
  state.room = room;
  state.myPlayerId = null; // jedno zařízení: žádné pevné „já", zařízení si hráči podávají
  state.screen='game';
  History.record(room);
  render();
}

/* Hráč odchází z rozehrané hry na jednom zařízení (jen při 3+ hráčích). */
async function removeLocalPlayer(id){
  const room = state.room;
  const n = room.players.length;
  if(n<=2) return;
  const idx = room.players.findIndex(p=>p.id===id);
  if(idx<0) return;
  const wasActive = idx===room.turnIndex;
  room.players.splice(idx,1);
  const m = n-1;
  if(idx < room.turnIndex) room.turnIndex--;
  else if(wasActive){
    // Na tahu je další hráč ve směru hry.
    room.turnIndex = room.direction===1 ? idx % m : ((idx-1) % m + m) % m;
    room.extraTurn = false;
  }
  room.turnIndex = Math.max(0, Math.min(room.turnIndex, m-1));
  state.leaveOpen = false;
  await saveAndRender();
}

/* ============ HRA PRO JEDNOHO ============ */
/* Bez kostky, bez karet šance, bez bodování — jen otázky k zamyšlení. */
function startSolo(){
  resetAppState();
  state.solo = {
    decks: { red: indexList(QUESTIONS.red.length), blue: indexList(QUESTIONS.blue.length), yellow: indexList(QUESTIONS.yellow.length) },
    history: [],
    pos: -1,
    filter: []   // zvolené barvy; prázdné = všechny barvy
  };
  state.screen = 'solo';
  soloDraw(null);
}
function soloDraw(color){
  const so = state.solo;
  const pool = color ? [color] : (so.filter && so.filter.length ? so.filter : ['red','blue','yellow']);
  const c = pool[Math.floor(Math.random()*pool.length)];
  const idx = drawIndex(so, c);   // drawIndex potřebuje jen objekt s .decks
  // Kdo se vrátil o pár karet zpět a táhne novou, pokračuje od konce.
  so.history.push({color:c, idx});
  if(so.history.length > 100) so.history.shift();
  so.pos = so.history.length-1;
  render();
  window.scrollTo(0,0);
}
/* Zaškrtnutí / odškrtnutí barvy. Pokud aktuální otázka do výběru
   nepatří, rovnou se táhne nová z vybraných barev. */
function soloToggle(color){
  const so = state.solo;
  const f = so.filter || (so.filter = []);
  const i = f.indexOf(color);
  if(i>=0) f.splice(i,1); else f.push(color);
  const cur = so.history[so.pos];
  if(f.length && !f.includes(cur.color)) soloDraw(null);
  else render();
}
function soloStep(delta){
  const so = state.solo;
  so.pos = Math.max(0, Math.min(so.history.length-1, so.pos+delta));
  render();
}

/* ============ ONLINE ENTRY POINTS ============ */
async function hostCreateRoom(name){
  name = cleanName(name);
  if(!name){ uiAlert(t('err_name')); return; }
  if(!FlowNet.available()){
    uiAlert(t('err_offline'));
    return;
  }
  state.busy = true; render();
  try{
    await Online.createRoom(name);
    // obrazovku i state nastaví realtime listener (Online.startSync)
  }catch(e){
    console.error(e);
    uiAlert(t('err_create'));
    state.screen='home';
  }finally{
    state.busy = false; render();
  }
}

async function playerJoinRoom(code, name){
  name = cleanName(name);
  code = String(code||'').toUpperCase().replace(/\s+/g,'');
  if(!name){ uiAlert(t('err_name')); return; }
  if(!ROOM_CODE_RE.test(code)){ uiAlert(t('err_notfound')); return; }
  if(!FlowNet.available()){
    uiAlert(t('err_offline'));
    return;
  }
  state.busy = true; render();
  try{
    const res = await Online.joinRoom(code, name);
    if(!res.ok){
      uiAlert(t(res.reason==='name-taken' ? 'err_name_taken' : res.reason==='room-full' ? 'err_room_full' : res.reason==='started' ? 'err_started' : 'err_notfound', MAX_PLAYERS));
      state.screen='joinRoom';
    }
  }catch(e){
    console.error(e);
    uiAlert(t('err_join'));
    state.screen='joinRoom';
  }finally{
    state.busy = false; render();
  }
}

async function hostStartGame(){
  const room = state.room;
  if(room.players.length<2){ uiAlert(t('err_min2')); return; }
  // pojistka: kdyby se při souběžném připojení dostal dovnitř devátý hráč
  if(room.players.length>MAX_PLAYERS){ uiAlert(t('err_too_many', MAX_PLAYERS)); return; }
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
    History.record(state.room);
    render();
  } else {
    // USER ACTION -> zápis; renderujeme hned pro okamžitou odezvu.
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
  state.exchangeUI = null;
  state.leaveOpen = false;
  if(res.isDouble){
    const ci = drawIndex(room,'chance');
    room.currentCard = {type:'chance', idx:ci, key:CHANCE_CARDS[ci].key};
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
  room.currentCard = {type:'question', color, idx: drawIndex(room,color)};
  room.pendingColor = null;
  if(color==='blue'){
    // Modrá: hráč na tahu napíše 3 odpovědi a označí pravdivou.
    room.votes = {};
    room.awardColors = {};
    room.blueTurn = null;
    room.tips = {};
    room.composeProgress = null;
    room.blueAuthor = activePlayer(room).id;       // normálně píše hráč na tahu…
    room.blueBeneficiary = activePlayer(room).id;  // …a modrou kartu dostane on
    state.lastProgressKey = null;
    state.blueCompose = freshBlueCompose();
    room.phase='blue-compose';
  } else if(color==='yellow'){
    // Žlutá: odpovídají postupně všichni, začíná hráč na tahu.
    startRound(room, 'yellow');
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

/* ---------- SMĚNA NA ZAČÁTKU TAHU ---------- */
/* Hráč s aspoň 3 celými kartami jedné barvy smí 2 z nich vyměnit
   za 1 kartu jiné barvy. */
async function turnExchange(give, want){
  const room = state.room;
  const ap = activePlayer(room);
  if(!exchangeColors(ap).includes(give) || give===want) return;
  ap.full[give] -= 2;
  ap.full[want] += 1;
  state.exchangeUI = null;
  resolveWin(room, ap);
  await saveAndRender();
}

/* ---------- KOLEČKO ODPOVĚDÍ (žlutá, červená pro všechny) ---------- */
/* Hráč (playerId) potvrdil, zda odpověděl. Kdo neodpoví, ztrácí kartu
   barvy kolečka (nejdřív celou, pak půlku; když nemá nic, nic se neděje). */
async function roundAnswer(playerId, answered){
  const room = state.room;
  const r = room.round;
  if(!r || r.current!==playerId) return;
  const p = room.players.find(x=>x.id===playerId);
  const ap = activePlayer(room);
  const first = playerId===ap.id && Object.keys(r.answered||{}).length===0;

  // Hráč, který kartu vytáhl, odpovídá první. Když neodpoví,
  // ztrácí kartu a kolečko končí.
  if(first && !answered){
    loseColor(ap, r.color);
    advanceTurn(room);
    await saveAndRender();
    return;
  }

  if(!answered && p) loseColor(p, r.color);
  r.answered = Object.assign({}, r.answered, {[playerId]: !!answered});
  r.current = roundNextId(room);

  if(Store.mode==='online' && playerId!==ap.id){
    // Odpovídající hráč není na tahu -> zapíše jen svou odpověď,
    // posun v kolečku a vlastní karty (víc mu pravidla databáze nedovolí).
    render();
    try{ await Online.pushRoundAnswer(room, p); }
    catch(e){ console.error('round push failed', e); }
    return;
  }
  await saveAndRender();
}

/* Kolečko došlo zpět k hráči, který kartu vytáhl -> získává kartu. */
async function roundFinish(){
  const room = state.room;
  const ap = activePlayer(room);
  addFull(ap, room.round.color);
  if(!resolveWin(room, ap)) advanceTurn(room);
  await saveAndRender();
}

/* ---------- MODRÁ KARTA ---------- */
/* Hráč na tahu odeslal 3 možnosti a označil pravdivou. */
async function blueSubmit(options, correct){
  const room = state.room;
  if(typeof duplicateAnswerIdx==='function' && duplicateAnswerIdx(options).size) return;
  room.votes = {};
  room.awardColors = {};
  if(Store.mode==='local'){
    // Jedno zařízení: správná odpověď je v herním stavu (nikde se nezobrazí
    // až do vyhodnocení), hádají postupně ostatní ve směru hry.
    room.currentCard = Object.assign({}, room.currentCard, {options, correct});
    // hádají všichni kromě autora, ve směru hry od autora
    const order = orderFrom(room, blueAuthor(room).id).slice(1);
    room.blueTurn = { order, current: order[0] || null };
  } else {
    // Online: správná odpověď zůstává jen v zařízení hráče na tahu.
    rememberSecret(room.code, correct);
    room.currentCard = Object.assign({}, room.currentCard, {options, correct:null});
    room.composeProgress = null;   // tipy (room.tips) zůstávají až do vyhodnocení
  }
  state.blueCompose = freshBlueCompose();
  state.handoff = null;
  room.phase = 'blue-guessing';
  await saveAndRender();
}

/* Jedno zařízení: hádající hráč vybral možnost -> zařízení jde dalšímu. */
async function blueLocalVote(optionIndex){
  const room = state.room;
  const bt = room.blueTurn;
  if(!bt || !bt.current) return;
  room.votes = Object.assign({}, room.votes, {[bt.current]: optionIndex});
  const i = bt.order.indexOf(bt.current);
  bt.current = bt.order[i+1] || null;
  state.handoff = null;
  await saveAndRender();
}

/* Vyhodnocení modré: půlkarty pro ty, kdo uhodli, celá modrá pro hráče na tahu. */
async function blueFinish(){
  const room = state.room;
  const author = blueAuthor(room);
  const winnerOfCard = blueBeneficiary(room);
  const card = room.currentCard;
  const colors = room.awardColors || {};
  room.players.forEach(p=>{
    if(p.id!==author.id && room.votes[p.id]===card.correct && colors[p.id]) addHalf(p, colors[p.id]);
  });
  addFull(winnerOfCard, 'blue');
  if(!resolveWin(room, winnerOfCard)) advanceTurn(room);
  await saveAndRender();
}

/* Autor modré odpovědi nenapíše -> ztrácí modrou kartu (má-li ji), tah končí. */
async function blueDecline(){
  const room = state.room;
  loseColor(blueAuthor(room), 'blue');
  state.blueCompose = freshBlueCompose();
  advanceTurn(room);
  await saveAndRender();
}

/* Je toto zařízení autorem modré? (na jednom zařízení vždy ano) */
function isBlueAuthorHere(room){
  return Store.mode==='local' || blueAuthor(room).id===state.myPlayerId;
}

/* ---------- HOST: PŘESKOČENÍ HRÁČE, KTERÝ ODEŠEL ---------- */
async function hostSkipTurn(){
  const room = state.room;
  room.extraTurn = false;
  advanceTurn(room);
  await saveAndRender();
}

/* ---------- MODRÁ ONLINE: SPRÁVNÁ ODPOVĚĎ ---------- */
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
    if(!m) return null;
    const c = decodeURIComponent(m[1]).toUpperCase().replace(/\s+/g,'');
    return ROOM_CODE_RE.test(c) ? c : null;   // jen platný formát kódu
  }catch(e){ return null; }
}

/* Ochrana proti vložení hry do cizí stránky (clickjacking). */
(function frameGuard(){
  try{
    if(window.top !== window.self){ window.top.location.replace(window.location.href); }
  }catch(e){
    // cizí stránka nás nepustí ven -> hru nezobrazíme
    document.documentElement.style.display = 'none';
  }
})();

/* ============ KONTROLA VERZÍ A ZACHYTÁVÁNÍ CHYB ============ */
/* Když na webu zůstane některý starší soubor, hra by tiše selhala.
   Proto: 1) každý soubor nese číslo verze — při nesouladu se ukáže hláška,
   2) neočekávaná chyba se zobrazí v okně (snímek pomůže s opravou). */
const FLOU_EXPECTED_FILES = ['theme.js','data.js','data_en.js','i18n.js','sound.js','engine.js','firebase.js','online.js','ui.js','app.js'];
function checkFileVersions(){
  const v = window.FLOU_FILES || {};
  const mine = v['app.js'];
  const bad = FLOU_EXPECTED_FILES.filter(f=> v[f] !== mine);
  if(bad.length){
    const msg = (typeof t==='function' ? t('err_versions', bad.join(', ')) : 'Zastaralé soubory: '+bad.join(', '));
    if(typeof uiAlert==='function') uiAlert(msg, typeof t==='function' ? t('err_versions_title') : 'Nesoulad verzí');
    else alert(msg);
    return false;
  }
  return true;
}
let lastErrorShown = 0;
function showRuntimeError(detail){
  const now = Date.now();
  if(now - lastErrorShown < 5000) return;      // ne víc oken najednou
  lastErrorShown = now;
  try{
    const box = (typeof t==='function') ? t('err_runtime') : 'Něco se pokazilo.';
    const title = (typeof t==='function') ? t('err_runtime_title') : 'Chyba';
    if(typeof uiAlert==='function') uiAlert(box+'\n\n'+detail, title);
  }catch(e){}
}
window.addEventListener('error', (e)=>{
  const src = String(e.filename||'');
  // Okno jen pro chyby z kódu hry. Chyby z cizích skriptů (Firebase od Googlu,
  // rozšíření prohlížeče) prohlížeč zamlží na „Script error." bez souboru —
  // ty se nezobrazují (zapíší se jen do konzole).
  if(!src || /^script error\.?$/i.test(String(e.message||'').trim())) return;
  if(!/\/(app|ui|engine|online|firebase|i18n|sound|data|data_en|theme)\.js/.test(src)) return;
  const file = src.split('/').pop().split('?')[0];
  showRuntimeError((e.message||'Error') + (file ? ' ('+file+':'+e.lineno+')' : ''));
});

(async function boot(){
  checkFileVersions();
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
