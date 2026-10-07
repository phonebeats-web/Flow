(window.FLOU_FILES = window.FLOU_FILES || {})['firebase.js'] = '43';   /* verze souboru — kontrola, že jsou na webu všechny soubory stejné verze */
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

/* App Check (ochrana proti robotům a skriptům mimo tvůj web).
   Zapnutí: ve Firebase konzoli → App Check → zaregistrovat web s reCAPTCHA v3,
   sem vložit veřejný „site key" a po ověření v konzoli zapnout vynucení
   (Enforce) pro Realtime Database a Authentication. Prázdné = vypnuto. */
const APP_CHECK_SITE_KEY = '';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDsJvMbHNrhO4j0pZCghFAF-A3bfxsbmdE",
  authDomain: "flowgame-fb137.firebaseapp.com",
  databaseURL: "https://flowgame-fb137-default-rtdb.firebaseio.com",
  projectId: "flowgame-fb137",
  storageBucket: "flowgame-fb137.firebasestorage.app",
  messagingSenderId: "193254763635",
  appId: "1:193254763635:web:818091265b5fca7ec38e06"
};

/* Porovnání jmen (bez velikosti písmen, mezer a diakritiky). Herní logiku
   sem nedáváme — funkci dodá UI vrstva, pokud existuje. */
const isNameTaken = (a,b)=> typeof duplicateAnswerIdx==='function' && duplicateAnswerIdx([a,b]).size>0;

/* Kód místnosti se do cesty v databázi dostane jen v platném tvaru
   (jinak by upravený odkaz mohl mířit jinam, např. „AB/players"). */
function safeCode(code){
  const c = String(code||'').toUpperCase().trim();
  if(!/^[A-HJ-NP-Z2-9]{5,6}$/.test(c)) throw new Error('Neplatný kód místnosti');
  return c;
}

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
      if(APP_CHECK_SITE_KEY) await activateAppCheck();
      db   = firebase.database();
      auth = firebase.auth();
      const cred = await auth.signInAnonymously();
      myUid = cred.user.uid;
      return myUid;
    })();
    return readyPromise;
  }

  function uidOrNull(){ return myUid; }

  /* Načte App Check až když je klíč nastavený (jinak se nic navíc nestahuje). */
  function activateAppCheck(){
    return new Promise((resolve)=>{
      const go = ()=>{
        try{ firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(APP_CHECK_SITE_KEY), true); }
        catch(e){ console.error('App Check', e); }
        resolve();
      };
      if(firebase.appCheck) return go();
      const sc = document.createElement('script');
      sc.crossOrigin = 'anonymous';
      sc.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js';
      sc.onload = go; sc.onerror = ()=>resolve();
      document.head.appendChild(sc);
    });
  }

  async function roomExists(code){
    await ready();
    try{ const snap = await db.ref('rooms/'+safeCode(code)+'/phase').once('value'); return snap.exists(); }catch(e){ return false; }
  }

  async function getRoom(code){
    await ready();
    try{
      const snap = await db.ref('rooms/'+safeCode(code)).once('value');
      return snap.exists() ? snap.val() : null;
    }catch(e){
      return null;   // nejsem členem (nebo místnost neexistuje) -> pravidla čtení odmítnou
    }
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
      let res;
      try{
        res = await db.ref('rooms/'+safeCode(candidate)).transaction(current=>{
          if(current === null) return room;   // volné -> zabereme
          return undefined;                    // obsazené -> zrušíme a zkusíme jiný kód
        });
      }catch(e){
        // obsazený kód cizí místnosti nejde číst -> pravidla odmítnou; zkusíme jiný
        continue;
      }
      if(res && res.committed) return candidate;
    }
    throw new Error('Nepodařilo se vygenerovat volný kód místnosti');
  }

  /* Přidá hráče pod jeho vlastní uid (jen do své vlastní větve). */
  async function joinRoom(code, player){
    await ready();
    await db.ref('rooms/'+safeCode(code)+'/players/'+myUid).set(player);
  }

  /* Připojení do místnosti.
     Cizí místnost nejde číst (jen její fázi), proto: 1) zjistit fázi,
     2) zapsat se, 3) teprve jako člen přečíst hráče a zkontrolovat jméno
     a počet — při konfliktu se zase odepsat. */
  async function joinRoomFast(code, player){
    await ready();
    code = safeCode(code);
    const roomRef = db.ref('rooms/'+code);
    const phaseSnap = await roomRef.child('phase').once('value');
    if(!phaseSnap.exists()) return { ok:false, uid:myUid };
    const meRef = roomRef.child('players/'+myUid);
    // vlastní záznam smí hráč číst vždy -> transakce pozná návrat do hry
    let res;
    try{
      res = await meRef.transaction(current=>{
        if(current) return current;   // už tam jsem (návrat) -> neměnit
        return player;
      });
    }catch(e){
      // zápis odmítnut pravidly: hra už běží (nový hráč se přidat nemůže)
      return { ok:false, uid:myUid, reason: phaseSnap.val()!=='lobby' ? 'started' : undefined };
    }
    if(!res.committed) return { ok:false, uid:myUid };
    const returning = res.snapshot && res.snapshot.val() && res.snapshot.val().joinedAt !== player.joinedAt;
    if(!returning){
      // teď jsem člen -> smím číst hráče; kontrola počtu a jména
      const all = (await roomRef.child('players').once('value')).val() || {};
      const list = Object.keys(all).map(id=>({id, name:all[id].name, joinedAt:all[id].joinedAt||0}))
        .sort((a,b)=> a.joinedAt-b.joinedAt || (a.id<b.id?-1:1));
      const myIdx = list.findIndex(p=>p.id===myUid);
      const max = (typeof MAX_PLAYERS==='number' ? MAX_PLAYERS : 8);
      let reason = null;
      if(myIdx >= max) reason = 'room-full';
      else if(isNameTaken && list.slice(0, myIdx).some(p=>isNameTaken(p.name, player.name))) reason = 'name-taken';
      if(reason){
        await meRef.remove().catch(()=>{});
        return { ok:false, uid:myUid, reason };
      }
    }
    return { ok:true, uid:myUid, phase: phaseSnap.val() };
  }


  /* Cílený zápis konkrétních cest, ne přepis celého roomu.
     changes = { 'phase':'idle', 'turnIndex':2, 'players/abc/full/red':1 } */
  async function updateRoom(code, changes){
    await ready();
    const prefixed = {};
    for(const path in changes){
      prefixed['rooms/'+safeCode(code)+'/'+path] = changes[path];
    }
    await db.ref().update(prefixed);
  }

  /* REALTIME listener — nahrazuje dřívější setInterval polling.
     cb(room) se zavolá při každé změně místnosti. */
  function listenToRoom(code, cb){
    stopListening();
    activeRef = db.ref('rooms/'+safeCode(code));
    activeHandler = activeRef.on('value', (snap)=>{
      cb(snap.exists() ? snap.val() : null);
    }, (err)=>{
      console.error('listenToRoom error', err);
      // přístup odepřen = už nejsem v místnosti (nebo byla smazána)
      if(err && /permission/i.test(err.code || err.message || '')) cb(null);
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
    await db.ref('rooms/'+safeCode(code)+'/players/'+myUid+'/online').set(true);
    db.ref('rooms/'+safeCode(code)+'/players/'+myUid+'/online').onDisconnect().set(false);
  }

  /* Hostitel smaže svou místnost (čekárna nebo dohraná hra). */
  async function deleteRoom(code){
    await ready();
    await db.ref('rooms/'+safeCode(code)).remove();
  }

  /* Hráč odchází z místnosti tlačítkem (ne zavřením karty). */
  async function markOffline(code){
    await ready();
    const ref = db.ref('rooms/'+safeCode(code)+'/players/'+myUid+'/online');
    await ref.onDisconnect().cancel();
    await ref.set(false);
  }

  return {
    ready, uidOrNull, available, markOffline, deleteRoom,
    createRoom, roomExists, getRoom, joinRoom, joinRoomFast,
    updateRoom, listenToRoom, stopListening, setupDisconnect
  };
})();
