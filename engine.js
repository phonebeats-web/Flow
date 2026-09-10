/* ============================================================
   GAME ENGINE — čistá herní logika.
   Žádná závislost na DOM, na Firebase, ani na síti.
   Musí jít spustit i úplně offline (viz engine.test.js).
   Chování je 1:1 převzaté z původní verze — beze změny pravidel.
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

function freshDecks(){
  return {
    red: shuffle(QUESTIONS.red),
    blue: shuffle(QUESTIONS.blue),
    yellow: shuffle(QUESTIONS.yellow),
    chance: shuffle(CHANCE_CARDS)
  };
}

function drawFrom(room, colorKey){
  let deck = room.decks[colorKey];
  if(deck.length===0){
    const source = colorKey==='chance' ? CHANCE_CARDS : QUESTIONS[colorKey];
    deck = shuffle(source);
  }
  const card = deck[deck.length-1];
  deck = deck.slice(0, deck.length-1);
  room.decks[colorKey] = deck;
  return card;
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
  room.phase = 'idle';
  room.currentCard = null;
}

function chanceEffectKey(text){
  const found = CHANCE_CARDS.find(c=>c.text===text);
  return found ? found.key : null;
}

function labelColor(c){ return c==='red'?'červená':c==='blue'?'modrá':'žlutá'; }
