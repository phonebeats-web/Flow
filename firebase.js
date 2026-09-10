/* ============================================================
   FIREBASE LAYER — JEDINÉ místo v aplikaci, které ví o Firebase.
   Nikde jinde (engine.js, ui.js) se Firebase API nesmí volat.

   Zveřejňuje jednoduché API:
     FlowNet.ready()                       -> Promise<uid>  (anonymní přihlášení)
     FlowNet.createRoom(roomData)          -> Promise<code>
     FlowNet.roomExists(code)              -> Promise<bool>
     FlowNet.getRoom(code)                 -> Promise<room|null>
     FlowNet.joinRoom(code, player)        -> Promise<void>
     FlowNet.updateRoom(code, changes)     -> Promise<void>   (multi-path update)
     FlowNet.listenToRoom(code, cb)        -> unsubscribe fn  (realtime, ne polling)
     FlowNet.stopListening()               -> void

   Poznámka: Firebase SDK se načítá v index.html jako <script> z CDN
   (compat build), takže tu není potřeba žádný bundler ani import.
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDsJvMbHNrhO4j0pZCghFAF-A3bfxsbmdE",
  authDomain: "flowgame-fb137.firebaseapp.com",
  databaseURL: "https://flowgame-fb137-default-rtdb.firebaseio.com",
  projectId: "flowgame-fb137",
  storageBucket: "flowgame-fb137.firebasestorage.app",
  messagingSenderId: "193254763635",
  appId: "1:193254763635:web:818091265b5fca7ec38e06"
};

const FlowNet = (function(){
  let app = null;
  let db = null;
  let auth = null;
  let myUid = null;
  let readyPromise = null;
  let activeRef = null;      // aktuálně poslouchaný ref
  let activeHandler = null;  // jeho callback

  function available(){
    return typeof firebase !== 'undefined' && !!firebase.initializeApp;
  }

  /* Inicializace + anonymní přihlášení.
     Hráč nikdy nevidí žádný login formulář — děje se to na pozadí.
     Vrací uid, které slouží jako stabilní playerId. */
  function ready(){
    if(readyPromise) return readyPromise;
    readyPromise = (async ()=>{
      if(!available()) throw new Error('Firebase SDK není načteno');
      app  = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
      db   = firebase.database();
      auth = firebase.auth();
      const cred = await auth.signInAnonymously();
      myUid = cred.user.uid;
      return myUid;
    })();
    return readyPromise;
  }

  function uidOrNull(){ return myUid; }

  async function roomExists(code){
    await ready();
    const snap = await db.ref('rooms/'+code).once('value');
    return snap.exists();
  }

  async function getRoom(code){
    await ready();
    const snap = await db.ref('rooms/'+code).once('value');
    return snap.exists() ? snap.val() : null;
  }

  /* Založí místnost pod kódem, který ještě neexistuje.
     makeCode() dodá volající (engine uid()), aby tato vrstva
     neobsahovala herní logiku. */
  /* Založí místnost. Kolizi kódu řeší transakcí — jedno síťové kolo
     místo dvou (kontrola + zápis), takže je vytvoření znatelně rychlejší. */
  async function createRoom(makeCode, buildRoom){
    await ready();
    for(let attempt=0; attempt<8; attempt++){
      const candidate = makeCode();
      const room = buildRoom(candidate, myUid);
      const res = await db.ref('rooms/'+candidate).transaction(current=>{
        if(current === null) return room;   // volné -> zabereme
        return undefined;                    // obsazené -> zrušíme a zkusíme jiný kód
      });
      if(res.committed) return candidate;
    }
    throw new Error('Nepodařilo se vygenerovat volný kód místnosti');
  }

  /* Přidá hráče pod jeho vlastní uid (jen do své vlastní větve). */
  async function joinRoom(code, player){
    await ready();
    await db.ref('rooms/'+code+'/players/'+myUid).set(player);
  }

  /* Ověří existenci místnosti a zapíše hráče v JEDNOM síťovém kole.
     Transakce nad větví players/: pokud místnost neexistuje, zápis se zruší. */
  async function joinRoomFast(code, player){
    await ready();
    const roomRef = db.ref('rooms/'+code);
    const res = await roomRef.child('players/'+myUid).transaction(current=>{
      if(current) return current;   // už tam jsem (reconnect) -> neměnit
      return player;
    });
    if(!res.committed) return { ok:false, uid:myUid };
    // Ověření, že místnost opravdu existuje (ne jen osiřelá větev players).
    const snap = await roomRef.child('phase').once('value');
    if(!snap.exists()){
      // Neexistující kód: smažeme celou osiřelou větev, ať v databázi
      // nezůstávají prázdné místnosti po překlepech v kódu.
      await roomRef.remove().catch(()=>{});
      return { ok:false, uid:myUid };
    }
    return { ok:true, uid:myUid, phase: snap.val() };
  }

  /* Cílený zápis konkrétních cest, ne přepis celého roomu.
     changes = { 'phase':'idle', 'turnIndex':2, 'players/abc/full/red':1 } */
  async function updateRoom(code, changes){
    await ready();
    const prefixed = {};
    for(const path in changes){
      prefixed['rooms/'+code+'/'+path] = changes[path];
    }
    await db.ref().update(prefixed);
  }

  /* REALTIME listener — nahrazuje dřívější setInterval polling.
     cb(room) se zavolá při každé změně místnosti. */
  function listenToRoom(code, cb){
    stopListening();
    activeRef = db.ref('rooms/'+code);
    activeHandler = activeRef.on('value', (snap)=>{
      cb(snap.exists() ? snap.val() : null);
    }, (err)=>{
      console.error('listenToRoom error', err);
    });
    return stopListening;
  }

  function stopListening(){
    if(activeRef && activeHandler){
      activeRef.off('value', activeHandler);
    }
    activeRef = null;
    activeHandler = null;
  }

  /* Uklidí hráče při zavření karty (best-effort). */
  async function setupDisconnect(code){
    await ready();
    // záměrně NEodstraňujeme hráče při disconnectu — reconnect (KROK 10)
    // vyžaduje, aby hráč po refreshi zůstal v místnosti.
    await db.ref('rooms/'+code+'/players/'+myUid+'/online').set(true);
    db.ref('rooms/'+code+'/players/'+myUid+'/online').onDisconnect().set(false);
  }

  return {
    ready, uidOrNull, available,
    createRoom, roomExists, getRoom, joinRoom, joinRoomFast,
    updateRoom, listenToRoom, stopListening, setupDisconnect
  };
})();
