/* ============================================================
   GAME ENGINE — čistá herní logika.
   Žádná závislost na DOM, na Firebase, ani na síti.
   Musí jít spustit i úplně offline (viz engine.test.js).
   Pravidla: hod 2× kostkou, červená/modrá/žlutá otázka, karty šance.
   ============================================================ */

function uid(n=6){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='';for(let i=0;i<n;i++)s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

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

function drawFrom(room, colorKey){
  const source = colorKey==='chance' ? CHANCE_CARDS : QUESTIONS[colorKey];
  let deck = room.decks[colorKey];
  if(!deck || deck.length===0){
    deck = indexList(source.length);
  }
  const idx = deck[deck.length-1];
  room.decks[colorKey] = deck.slice(0, deck.length-1);
  return source[idx];
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
  room.yellow = null;
  room.votes = {};
  room.awardColors = {};

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

/* Pořadí hráčů pro žlutou otázku: začíná hráč na tahu,
   pak ostatní ve směru hry. */
function yellowOrder(room){
  const n = room.players.length;
  const order = [];
  for(let k=0;k<n;k++){
    const idx = ((room.turnIndex + k*room.direction) % n + n) % n;
    order.push(room.players[idx].id);
  }
  return order;
}

/* Další hráč v pořadí žluté otázky (po posledním se vrací k tomu,
   kdo kartu vytáhl). */
function yellowNextId(room){
  const y = room.yellow;
  const i = y.order.indexOf(y.current);
  return y.order[(i+1) % y.order.length];
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

function chanceEffectKey(text){
  const found = CHANCE_CARDS.find(c=>c.text===text);
  return found ? found.key : null;
}

function labelColor(c){ return c==='red'?'červená':c==='blue'?'modrá':'žlutá'; }
