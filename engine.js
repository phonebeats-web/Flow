(window.FLOU_FILES = window.FLOU_FILES || {})['engine.js'] = '35';   /* verze souboru — kontrola, že jsou na webu všechny soubory stejné verze */
/* ============================================================
   GAME ENGINE — čistá herní logika.
   Žádná závislost na DOM, na Firebase, ani na síti.
   Musí jít spustit i úplně offline (viz engine.test.js).
   Pravidla: hod 2× kostkou, červená/modrá/žlutá otázka, karty šance.
   ============================================================ */

/* Nejvyšší počet hráčů ve hře (jedno zařízení i online). */
const MAX_PLAYERS = 8;

function uid(n=6){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='';for(let i=0;i<n;i++)s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

/* Očištění jména: pryč s neviditelnými a řídicími znaky (např. obrácení směru
   textu U+202E, kterým by šlo podvrhnout, jak jméno vypadá), sloučí mezery,
   ořízne na 24 znaků. */
function cleanName(s){
  return String(s||'')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g,'')
    .replace(/\s+/g,' ').trim().slice(0,24);
}
/* Kód místnosti: jen znaky, které nejdou splést (bez I, O, 0, 1). */
const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5,6}$/;

function shuffle(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

/* Balíčky drží POUZE indexy karet, ne jejich texty.
   Texty má každý hráč lokálně v data.js, takže se nemusí
   přenášet po síti — přenáší se jen pořadí. */
function indexList(n){
  const a=[]; for(let i=0;i<n;i++) a.push(i);
  return shuffle(a);
}
function freshDecks(){
  return {
    red: indexList(QUESTIONS.red.length),
    blue: indexList(QUESTIONS.blue.length),
    yellow: indexList(QUESTIONS.yellow.length),
    chance: indexList(CHANCE_CARDS.length)
  };
}

/* Vytáhne kartu a vrátí její ČÍSLO (index). Text si každé zařízení
   dosadí samo ve zvoleném jazyce (viz i18n.js) — po síti jde jen číslo. */
function drawIndex(room, colorKey){
  const len = colorKey==='chance' ? CHANCE_CARDS.length : QUESTIONS[colorKey].length;
  let deck = room.decks[colorKey];
  if(!deck || deck.length===0){
    deck = indexList(len);
  }
  const idx = deck[deck.length-1];
  room.decks[colorKey] = deck.slice(0, deck.length-1);
  return idx;
}

function newPlayer(id, name){
  return {id, name, halves:{red:0,blue:0,yellow:0}, full:{red:0,blue:0,yellow:0}, skipNext:false};
}

function checkWin(p){
  return p.full.red>=2 && p.full.blue>=2 && p.full.yellow>=2;
}

function addHalf(player, color){
  player.halves[color]++;
  if(player.halves[color]>=2){
    player.halves[color]-=2;
    player.full[color]++;
  }
}

/* Hráč na tahu zodpověděl otázku -> získává celou kartu dané barvy. */
function addFull(player, color){
  player.full[color]++;
}

/* Hráč na tahu neodpověděl -> přichází o kartu dané barvy.
   Nejdřív celá, pak půlka. Pokud nic nemá, nestane se nic. */
function loseColor(player, color){
  if(player.full[color]>0){ player.full[color]--; return true; }
  if(player.halves[color]>0){ player.halves[color]--; return true; }
  return false;
}

function activePlayer(room){ return room.players[room.turnIndex]; }

function rightNeighbor(room){
  const n = room.players.length;
  const idx = ((room.turnIndex - room.direction) % n + n) % n;
  return room.players[idx];
}

function advanceTurn(room){
  // Uklidit vše, co patří jen k právě dohranému tahu.
  room.phase = 'idle';
  room.currentCard = null;
  room.pendingColor = null;
  room.round = null;
  room.blueTurn = null;
  room.votes = {};
  room.awardColors = {};
  room.tips = {};              // tipy předem u modré (online)
  room.blueAuthor = null;      // modrá: kdo píše odpovědi
  room.blueBeneficiary = null; // modrá: kdo dostane modrou kartu
  room.composeProgress = null; // průběh psaní odpovědí u modré (online)

  // Karta šance „Jedeš ještě jednou" — stejný hráč hraje znovu.
  if(room.extraTurn){
    room.extraTurn = false;
    return;
  }

  const n = room.players.length;
  let next = ((room.turnIndex + room.direction) % n + n) % n;
  // handle skip-next
  let guard=0;
  while(room.players[next].skipNext && guard<n){
    room.players[next].skipNext=false;
    next = ((next + room.direction) % n + n) % n;
    guard++;
  }
  room.turnIndex = next;
}

/* Vyhodnocení hodu dvěma hody kostky.
   Rozdílné barvy -> otázka PRVNÍ barvy.
   Stejné barvy   -> nejdřív karta šance, pak (pokud to jde) otázka té barvy. */
function evaluateRoll(first, second){
  return { color:first, isDouble: first===second };
}

/* Pořadí hráčů od hráče na tahu ve směru hry (hráč na tahu je první).
   Používá se pro „kolečko" odpovědí (žlutá, červená pro všechny)
   i pro hádání modré na jednom zařízení. */
function turnOrder(room){
  const n = room.players.length;
  const order = [];
  for(let k=0;k<n;k++){
    const idx = ((room.turnIndex + k*room.direction) % n + n) % n;
    order.push(room.players[idx].id);
  }
  return order;
}

/* Pořadí hráčů ve směru hry, začíná zadaným hráčem. */
function orderFrom(room, startId){
  const n = room.players.length;
  const start = Math.max(0, room.players.findIndex(p=>p.id===startId));
  const order = [];
  for(let k=0;k<n;k++){
    const idx = ((start + k*room.direction) % n + n) % n;
    order.push(room.players[idx].id);
  }
  return order;
}

/* Modrá karta — role: autor píše odpovědi (normálně hráč na tahu, u karty šance
   „odpovídá hráč po pravici" soused), příjemce dostane modrou kartu (hráč na tahu). */
function blueAuthor(room){
  return (room.blueAuthor && room.players.find(p=>p.id===room.blueAuthor)) || activePlayer(room);
}
function blueBeneficiary(room){
  return (room.blueBeneficiary && room.players.find(p=>p.id===room.blueBeneficiary)) || activePlayer(room);
}

/* Kolečko odpovědí: všichni odpovídají postupně, začíná hráč na tahu. */
function startRound(room, color){
  const order = turnOrder(room);
  room.round = { color, order, current: order[0], answered: {} };
  room.phase = 'answer-round';
}

/* Další hráč v kolečku (po posledním se vrací k tomu, kdo kartu vytáhl). */
function roundNextId(room){
  const r = room.round;
  const i = r.order.indexOf(r.current);
  return r.order[(i+1) % r.order.length];
}

/* Hráč má na začátku tahu od některé barvy aspoň 3 celé karty
   -> smí vyměnit 2 z nich za 1 kartu jiné barvy. */
function exchangeColors(player){
  return ['red','yellow','blue'].filter(c=>player.full[c]>=3);
}

/* JSON se seřazenými klíči a bez prázdných hodnot — slouží k porovnání
   stavů (krok zpět, úspora zápisů a překreslování). */
function stableStr(v){
  if(v===null || v===undefined) return 'null';
  if(Array.isArray(v)) return '['+v.map(stableStr).join(',')+']';
  if(typeof v==='object'){
    const keys = Object.keys(v).filter(k=>v[k]!==null && v[k]!==undefined).sort();
    if(!keys.length) return 'null';
    return '{'+keys.map(k=>JSON.stringify(k)+':'+stableStr(v[k])).join(',')+'}';
  }
  return JSON.stringify(v);
}

/* Ukončení hry. Hráč na tahu se přepne na vítěze, aby vítěz mohl
   v online režimu dohrát závěrečnou otázku (zapisuje jen hráč na tahu). */
function finishGame(room, winner){
  room.phase = 'finished';
  room.winnerId = winner.id;
  room.extraTurn = false;
  const idx = room.players.findIndex(p=>p.id===winner.id);
  if(idx>=0) room.turnIndex = idx;
}

/* Zkontroluje výhru (nejdřív preferovaný hráč, pak ostatní).
   Vrací true, pokud hra skončila. */
function resolveWin(room, preferred){
  const winner = (preferred && checkWin(preferred)) ? preferred : room.players.find(p=>checkWin(p));
  if(winner){ finishGame(room, winner); return true; }
  return false;
}

