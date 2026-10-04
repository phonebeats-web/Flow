/* ============================================================
   UI — DOM helpery a všechny render* funkce.
   Volá engine.js (herní pravidla) a app.js (state, Store, akce).
   Vzhled, texty a layout jsou beze změny oproti původní verzi.
   ============================================================ */

function el(tag, attrs={}, ...children){
  const e=document.createElement(tag);
  for(const k in attrs){
    if(attrs[k]===null || attrs[k]===undefined) continue;
    if(k==='class') e.className=attrs[k];
    else if(k==='html') e.innerHTML=attrs[k];
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  children.flat().forEach(c=>{
    if(c===null||c===undefined) return;
    if(typeof c==='string'||typeof c==='number') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}
function waveSVG(colorTop, colorBottom, flip){
  return `<svg viewBox="0 0 500 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,40 C120,90 200,10 320,50 C400,78 460,55 500,35 L500,0 L0,0 Z" fill="${colorTop}"/>
    <path d="M0,90 C140,50 240,120 340,90 C420,66 470,100 500,85 L500,150 L0,150 Z" fill="${colorBottom}"/>
  </svg>`;
}
function htmlToNode(html){
  const div=document.createElement('div'); div.innerHTML=html; return div.firstChild;
}

function render(){
  const app = document.getElementById('app');
  // Překreslení po každé změně z databáze by jinak hráči vzalo kurzor
  // z rozepsaného pole (např. při vymýšlení odpovědí na modrou kartu).
  const ae = document.activeElement;
  const focusKey = ae && ae.getAttribute ? ae.getAttribute('data-fk') : null;
  const selStart = focusKey && typeof ae.selectionStart==='number' ? ae.selectionStart : null;
  const selEnd   = focusKey && typeof ae.selectionEnd==='number' ? ae.selectionEnd : null;
  app.innerHTML='';
  renderScreens(app);
  if(focusKey){
    const again = app.querySelector('[data-fk="'+focusKey+'"]');
    if(again){
      again.focus();
      if(selStart!==null && again.setSelectionRange){
        try{ again.setSelectionRange(selStart, selEnd); }catch(e){}
      }
    }
  }
}

function renderScreens(app){
  const isHome = state.screen==='home';
  if(isHome){
    app.appendChild(homeHero());
  } else {
    app.appendChild(el('div',{class:'wave-top'},htmlToNode(waveSVG('#E9502E','#F6C61E'))));
  }
  const screen = el('div',{class:'screen'+(isHome?' screen-sea':'')});
  app.appendChild(screen);
  const renderers = {
    home: renderHome,
    setupLocal: renderSetupLocal,
    setupHost: renderSetupHost,
    joinRoom: renderJoinRoom,
    lobby: renderLobby,
    game: renderGame,
  };
  (renderers[state.screen]||renderHome)(screen);
}

/* ---------- HOME ---------- */

/* Úvodní hlavička: západ slunce nad názvem, moře pod ním.
   Vlny se roztahují přes celou šířku okna (preserveAspectRatio="none"),
   zatímco nápis má vlastní, na šířce nezávislou velikost — takže
   na širokém monitoru se grafika nenafoukne do obřích rozměrů. */
function homeHero(){
  // Všechny tři vlny se celé vejdou do výřezu, takže se nikde
  // neuřezávají a u levého okraje nevzniká zub.
  const sunset = `<svg class="hero-waves" viewBox="0 0 520 92" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L520,0 L520,22 C480,30 430,45 350,32 C230,12 120,52 0,30 Z" fill="var(--red)"/>
    <path d="M0,30 C120,52 230,12 350,32 C430,45 480,30 520,22 L520,44 C480,52 430,67 350,54 C230,34 120,74 0,52 Z" fill="var(--orange)"/>
    <path d="M0,52 C120,74 230,34 350,54 C430,67 480,52 520,44 L520,64 C480,70 430,84 350,74 C230,56 120,88 0,72 Z" fill="var(--yellow)"/>
  </svg>`;

  // Hladina: horní vlna a pod ní plná modrá, která navazuje
  // na pozadí zbytku obrazovky — moře tak pokračuje až dolů.
  const sea = `<svg class="hero-waves" viewBox="0 0 520 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,10 C110,-16 210,34 320,14 C410,-2 470,24 520,10 L520,60 L0,60 Z" fill="var(--blue-light)"/>
    <path d="M0,30 C120,6 220,52 330,32 C415,17 475,40 520,28 L520,60 L0,60 Z" fill="var(--blue)"/>
  </svg>`;

  const miniCard = (color, rot) => `<svg class="hero-card" style="transform:rotate(${rot}deg)" viewBox="0 0 64 46" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="62" height="44" rx="9" fill="${color}"/>
    <path d="M1,16 C20,4 42,22 63,12 L63,1 L1,1 Z" fill="#FFFFFF" opacity=".93"/>
  </svg>`;

  return el('div',{class:'hero'},
    htmlToNode(`<div class="hero-band">${sunset}</div>`),
    htmlToNode(`<div class="hero-middle">
        ${miniCard('var(--red)', -10)}
        <div class="hero-titleblock">
          <div class="hero-title">
            <span style="color:var(--red)">F</span><span style="color:var(--yellow)">L</span><span style="color:var(--blue)">O</span><span style="color:var(--orange)">U</span>
          </div>
          <div class="hero-sub">KARETNÍ DISKUSNÍ HRA</div>
        </div>
        ${miniCard('var(--yellow)', 9)}
      </div>`),
    htmlToNode(`<div class="hero-band hero-band-sea">${sea}</div>`)
  );
}

function renderHome(s){
  s.appendChild(el('div',{class:'stack'},
    button('Hrát na jednom zařízení','btn-primary',()=>{state.screen='setupLocal'; state.setupNames=['','']; render();}),
    button('Vytvořit online místnost','btn-secondary',()=>{state.myName=''; state.screen='setupHost'; render();}),
    button('Připojit se ke kódu','btn-secondary',()=>{state.joinCode=''; state.myName=''; state.screen='joinRoom'; render();}),
  ));

  // Pravidla schovaná pod rozbalovacím odkazem — nezabírají místo,
  // dokud si je někdo nevyžádá.
  const open = !!state.rulesOpen;
  s.appendChild(el('div',{class:'rules'},
    el('button',{class:'rules-toggle'+(open?' open':''), onclick:()=>{
      state.rulesOpen = !state.rulesOpen; render();
    }},
      el('span',{},'Jak se hraje?'),
      el('span',{class:'rules-chevron'},'⌄')
    ),
    open ? el('div',{class:'rules-body'},
      rulesStep('var(--navy-soft)','1','Hoď dvakrát kostkou','Rozhoduje první barva. Padnou-li dvě stejné, táhneš nejdřív kartu šance a pak otázku té barvy.'),
      rulesStep('var(--red)','2','Červená = hluboká otázka','Odpovídá jen ten, kdo kartu vytáhl.'),
      rulesStep('var(--blue)','3','Modrá = hádání','Vymyslíš tři odpovědi, jedna je pravdivá. Kdo uhodne, bere půl karty barvy dle výběru.'),
      rulesStep('var(--yellow)','4','Žlutá = názor','Odpovídají postupně všichni. Kdo neodpoví, ztrácí žlutou kartu.'),
      rulesStep('var(--orange)','5','Vyhrává','Kdo má 2 celé karty od každé barvy. Dvě půlky dají jednu celou.')
    ) : null
  ));
}

function rulesStep(color, num, title, text){
  return el('div',{class:'rules-step'},
    el('div',{class:'rules-num', style:'background:'+color}, num),
    el('div',{},
      el('div',{class:'rules-step-title'}, title),
      el('div',{class:'rules-step-text'}, text)
    )
  );
}

function button(label, cls, onClick, disabled=false){
  return el('button',{class:'btn '+cls, onclick:onClick, disabled: disabled?'disabled':null},label);
}

/* ---------- LOCAL SETUP ---------- */
function renderSetupLocal(s){
  s.appendChild(backRow(()=>{state.screen='home';render();}));
  s.appendChild(el('div',{class:'title-lg'},'Kdo hraje?'));
  s.appendChild(el('div',{class:'subtitle'},'Zadejte jména hráčů, kteří si budou hru podávat.'));
  s.appendChild(el('div',{style:'height:16px'}));
  const list = el('div',{class:'stack'});
  state.setupNames.forEach((name,i)=>{
    const row = el('div',{class:'row'});
    const input = el('input',{class:'card-input', 'data-fk':'setup-'+i, placeholder:'Jméno hráče '+(i+1), value:name,
      oninput:(e)=>{state.setupNames[i]=e.target.value;}});
    row.appendChild(input);
    if(state.setupNames.length>2){
      row.appendChild(el('button',{class:'remove-btn', onclick:()=>{state.setupNames.splice(i,1); render();}},'✕'));
    }
    list.appendChild(row);
  });
  s.appendChild(list);
  s.appendChild(el('div',{style:'height:10px'}));
  s.appendChild(button('+ Přidat hráče','btn-ghost',()=>{state.setupNames.push(''); render();}));
  s.appendChild(el('div',{class:'spacer'}));
  s.appendChild(button('Začít hru','btn-primary',()=>{
    const names = state.setupNames.map(n=>n.trim()).filter(Boolean);
    if(names.length<2){ alert('Zadejte alespoň 2 jména.'); return; }
    startLocalGame(names);
  }));
}

/* ---------- ONLINE HOST SETUP ---------- */
function renderSetupHost(s){
  s.appendChild(backRow(()=>{state.screen='home';render();}));
  s.appendChild(el('div',{class:'title-lg'},'Vytvořit místnost'));
  s.appendChild(el('div',{class:'subtitle'},'Zadejte své jméno, ostatní se pak připojí kódem.'));
  s.appendChild(el('div',{style:'height:16px'}));
  s.appendChild(el('input',{class:'card-input', 'data-fk':'host-name', placeholder:'Vaše jméno', value:state.myName,
    oninput:(e)=>{state.myName=e.target.value;}}));
  s.appendChild(el('div',{class:'spacer'}));
  s.appendChild(button(state.busy ? 'Vytvářím…' : 'Vytvořit','btn-primary', ()=>{
    const name = state.myName.trim();
    if(!name){ alert('Zadejte jméno.'); return; }
    hostCreateRoom(name);
  }, state.busy));
}

/* ---------- JOIN ROOM ---------- */
function renderJoinRoom(s){
  s.appendChild(backRow(()=>{state.screen='home';render();}));
  s.appendChild(el('div',{class:'title-lg'},'Připojit se'));
  s.appendChild(el('div',{class:'subtitle'},'Zadejte kód místnosti a své jméno.'));
  s.appendChild(el('div',{style:'height:16px'}));
  s.appendChild(el('div',{class:'stack'},
    el('input',{class:'card-input', 'data-fk':'join-code', placeholder:'KÓD MÍSTNOSTI', value:state.joinCode, style:'text-transform:uppercase;letter-spacing:3px;text-align:center;font-weight:700;',
      oninput:(e)=>{state.joinCode=e.target.value.toUpperCase();}}),
    el('input',{class:'card-input', 'data-fk':'join-name', placeholder:'Vaše jméno', value:state.myName,
      oninput:(e)=>{state.myName=e.target.value;}}),
  ));
  s.appendChild(el('div',{class:'spacer'}));
  s.appendChild(button(state.busy ? 'Připojuji…' : 'Připojit se','btn-primary', ()=>{
    const code = state.joinCode.trim();
    const name = state.myName.trim();
    if(!code||!name){ alert('Vyplňte kód i jméno.'); return; }
    playerJoinRoom(code, name);
  }, state.busy));
}

/* ---------- SDÍLENÍ KÓDU ---------- */

/* Odkaz, který kamaráda pustí rovnou do místnosti. */
function roomLink(code){
  const base = location.origin + location.pathname;
  return base + '?kod=' + encodeURIComponent(code);
}

async function copyText(text){
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){ /* zkusíme záložní cestu níže */ }
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}

function shareRow(code){
  const row = el('div',{class:'share-row'});

  const codeBtn = el('button',{class:'share-btn', onclick: async ()=>{
    const ok = await copyText(code);
    flashLabel(codeBtn, ok ? 'Zkopírováno ✓' : 'Nelze zkopírovat', 'Zkopírovat kód');
  }},'Zkopírovat kód');
  row.appendChild(codeBtn);

  const linkBtn = el('button',{class:'share-btn', onclick: async ()=>{
    const link = roomLink(code);
    // Na mobilu nabídneme systémové sdílení, jinak zkopírujeme.
    if(navigator.share){
      try{
        await navigator.share({title:'FLOU', text:'Pojď hrát FLOU!', url:link});
        return;
      }catch(e){ /* uživatel zrušil nebo není podporováno -> zkopírujeme */ }
    }
    const ok = await copyText(link);
    flashLabel(linkBtn, ok ? 'Odkaz zkopírován ✓' : 'Nelze zkopírovat', 'Sdílet odkaz');
  }},'Sdílet odkaz');
  row.appendChild(linkBtn);

  return row;
}

/* Krátce změní popisek tlačítka a pak ho vrátí zpět. */
function flashLabel(btn, temp, original){
  btn.textContent = temp;
  btn.classList && btn.classList.add('done');
  setTimeout(()=>{
    btn.textContent = original;
    btn.classList && btn.classList.remove('done');
  }, 1600);
}

/* ---------- LOBBY ---------- */
function renderLobby(s){
  const room = state.room;
  s.appendChild(el('div',{style:'display:flex;justify-content:flex-end;margin-bottom:6px'},
    el('button',{class:'link-btn', onclick:()=>{
      if(confirm('Opravdu chcete opustit místnost?')) leaveOnlineRoom();
    }},'Opustit místnost')
  ));
  s.appendChild(el('div',{class:'title-lg'},'Místnost'));
  s.appendChild(el('div',{class:'code-display'}, room.code));
  s.appendChild(shareRow(room.code));
  s.appendChild(el('div',{style:'height:18px'}));
  s.appendChild(el('div',{class:'title-md'},'Hráči ('+room.players.length+')'));
  s.appendChild(el('div',{style:'height:8px'}));
  const list = el('div',{class:'stack'});
  room.players.forEach(p=>{
    list.appendChild(el('div',{class:'player-chip'},
      el('span',{class:'name'}, p.name),
      p.id===state.myPlayerId ? el('span',{class:'badge you'},'Ty') : (p.id===room.hostId ? el('span',{class:'badge you', style:'background:var(--navy-soft)'},'Host') : null)
    ));
  });
  s.appendChild(list);
  s.appendChild(el('div',{class:'spacer'}));
  if(amHost(room)){
    s.appendChild(button('Spustit hru ('+room.players.length+' hráči)','btn-primary', ()=>{
      hostStartGame();
    }, room.players.length<2));
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-top:8px'},'Sdílej kód ostatním, ať se připojí ze svého telefonu nebo počítače.'));
  } else {
    s.appendChild(el('div',{class:'center-col'},
      el('div',{class:'subtitle waiting-dots'},'Čeká se, až hru spustí host', el('span',{},'.'),el('span',{},'.'),el('span',{},'.'))
    ));
  }
}

/* ---------- BACK ROW ---------- */
function backRow(onClick){
  return el('div',{style:'margin-bottom:8px'}, el('button',{class:'link-btn', onclick:onClick},'← Zpět'));
}

/* ============ GAME SCREEN ============ */
/* Odchod ze hry — nenápadný odkaz úplně dole. */
function exitGameRow(){
  return el('div',{class:'exit-wrap'},
    el('button',{class:'exit-btn', onclick:()=>{ confirmExitGame(); }},'Ukončit hru')
  );
}

/* Potvrzení odchodu z rozehrané hry. */
function confirmExitGame(){
  const online = Store.mode==='online';
  const msg = online
    ? 'Opravdu chcete opustit rozehranou hru? Vrátíte se do hlavní nabídky a z místnosti odejdete.'
    : 'Opravdu chcete ukončit rozehranou hru? Průběh se ztratí a vrátíte se do hlavní nabídky.';
  if(!confirm(msg)) return;
  if(online){ leaveOnlineRoom(); }
  else { resetAppState(); render(); }
}

function renderGame(s){
  const room = state.room;
  if(room.phase==='finished'){ renderFinished(s, room); return; }
  // tlačítko pro odchod se přidá až na konec, pod obsah dané fáze
  renderGameInner(s, room);
  s.appendChild(exitGameRow());
}

function renderGameInner(s, room){

  const ap = activePlayer(room);
  s.appendChild(el('div',{class:'turn-banner'}, 'Na tahu: ', el('b',{},ap.name)));
  s.appendChild(scoreRow(room));
  s.appendChild(el('div',{class:'gap-after-score'}));

  const mine = isMyTurnOrLocal(room);

  // Online: hráč na tahu odešel -> host ho může přeskočit, ať hra nestojí.
  if(Store.mode==='online' && ap && ap.online===false && amHost(room) && ap.id!==state.myPlayerId){
    s.appendChild(el('div',{class:'banner-info'}, el('b',{},ap.name), ' je offline.'));
    s.appendChild(el('div',{style:'height:8px'}));
    s.appendChild(button('Přeskočit tah hráče '+ap.name,'btn-secondary', ()=>{
      if(confirm('Přeskočit tah hráče '+ap.name+'?')) hostSkipTurn();
    }));
    s.appendChild(el('div',{style:'height:18px'}));
  }

  if(room.phase==='idle'){
    const prev = room.lastRoll || [null,null];
    const die1 = el('div',{class:'die'}, el('div',{class:'dot', style:'background:'+dieCss(prev[0])}));
    const die2 = el('div',{class:'die'}, el('div',{class:'dot', style:'background:'+dieCss(prev[1])}));
    const col = el('div',{class:'center-col die-area'}, el('div',{class:'dice-pair'}, die1, die2));
    if(mine){
      const btn = button('Hodit kostkou','btn-primary', ()=>{
        animateRoll([die1, die2], btn);
      });
      col.appendChild(btn);
      col.appendChild(el('div',{class:'subtitle', style:'text-align:center'},'Házíš dvakrát. Rozhoduje první barva, dvě stejné znamenají kartu šance.'));
    } else {
      col.appendChild(el('div',{class:'subtitle'},'Čeká se na hod hráče ', el('b',{},ap.name)));
    }
    s.appendChild(col);
    return;
  }

  // Výsledek hodu vidí všichni, dokud se hraje daný tah.
  if(room.lastRoll && room.phase!=='finished'){
    s.appendChild(rollSummary(room));
  }

  if(room.phase==='yellow-round'){
    renderYellowRound(s, room, mine);
    return;
  }
  if(room.phase==='rolled-question'){
    renderQuestionPhase(s, room, mine);
    return;
  }
  if(room.phase==='guessing'){
    renderGuessingPhase(s, room, mine);
    return;
  }
  if(room.phase==='chance'){
    renderChancePhase(s, room, mine);
    return;
  }
  if(room.phase==='everyone-red'){
    renderEveryoneRed(s, room, mine);
    return;
  }
  if(room.phase==='right-neighbor'){
    renderRightNeighbor(s, room, mine);
    return;
  }
  if(room.phase==='blue-compose'){
    renderBlueCompose(s, room, mine);
    return;
  }
  if(room.phase==='blue-guessing'){
    renderBlueGuessing(s, room, mine);
    return;
  }
  if(room.phase==='blue-reveal'){
    renderBlueReveal(s, room, mine);
    return;
  }
}
/* Animace hodu: hráč hází dvakrát. Nejdřív dosedne první kostka,
   pak druhá — teprve potom se vyhodnotí výsledek a táhne karta. */
function dieCss(c){
  return c==='red' ? 'var(--red)' : c==='blue' ? 'var(--blue)' : c==='yellow' ? 'var(--yellow)' : 'var(--navy-soft)';
}

function animateRoll(dice, btnEl){
  if(state.rolling) return;
  state.rolling = true;

  const results = [pickDieColor(), pickDieColor()];
  const seq = ['red','blue','yellow'];
  const dotOf = d => d.children ? d.children[0] : null;
  const setDot = (d,c)=>{ const dot=dotOf(d); if(dot && dot.style) dot.style.background = dieCss(c); };

  if(btnEl){ btnEl.disabled = true; btnEl.textContent = 'Kostka se točí…'; }

  dice.forEach(d=>{ d.classList && d.classList.remove('landed'); d.classList && d.classList.add('rolling'); });
  let i = 0;
  const spinning = [true, true];
  const spin = setInterval(()=>{
    dice.forEach((d,k)=>{ if(spinning[k]) setDot(d, seq[(i+k) % seq.length]); });
    i++;
  }, 90);

  const land = (k)=>{
    spinning[k] = false;
    const d = dice[k];
    d.classList && d.classList.remove('rolling');
    d.classList && d.classList.add('landed');
    setDot(d, results[k]);
  };

  setTimeout(()=>land(0), 800);
  setTimeout(()=>{
    land(1);
    clearInterval(spin);
    // krátká pauza, ať je výsledek vidět, pak teprve karta
    setTimeout(()=>{
      state.rolling = false;
      rollDice(results[0], results[1]);
    }, 650);
  }, 1300);
}

/* Malý řádek „Hod: ● ●" nad kartou, ať i ostatní vidí, co padlo. */
function rollSummary(room){
  const [a,b] = room.lastRoll;
  const dot = c => el('span',{class:'roll-dot', style:'background:'+dieCss(c), title:labelColor(c)});
  return el('div',{class:'roll-summary'},
    'Hod: ', dot(a), dot(b),
    a===b ? el('span',{class:'roll-note'},' dvě stejné — karta šance') : null
  );
}

function scoreRow(room){
  const row = el('div',{class:'score-row'});
  const activeId = activePlayer(room) ? activePlayer(room).id : null;
  room.players.forEach(p=>{
    const isActive = p.id===activeId;
    row.appendChild(el('div',{class:'score-chip'+(isActive?' active':'')},
      el('div',{class:'pname'}, p.name + (p.id===state.myPlayerId?' (ty)':'')),
      el('div',{class:'score-dots'},
        ...['red','yellow','blue'].map(c=>dotsFor(p,c))
      )
    ));
  });
  return row;
}
/* Skóre jedné barvy: dva sloty (k výhře jsou potřeba 2 celé karty).
   Slot je prázdný, poloviční, nebo plný — stav je vidět na první pohled. */
function dotsFor(p,color){
  const colVar = color==='red'?'var(--red)':color==='yellow'?'var(--yellow)':'var(--blue)';
  const full = p.full[color];
  const half = p.halves[color];
  const wrap = el('span',{class:'score-color'});
  for(let i=0;i<2;i++){
    let cls = 'slot';
    if(i < full) cls += ' filled';
    else if(i === full && half > 0) cls += ' halffull';
    wrap.appendChild(el('span',{class:cls, style:'--c:'+colVar}));
  }
  // přebytek nad dvě celé karty (může vzniknout krádeží či výměnou)
  if(full > 2){
    wrap.appendChild(el('span',{class:'slot-extra', style:'color:'+colVar}, '+'+(full-2)));
  }
  return wrap;
}

function renderQuestionPhase(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  s.appendChild(qcardEl(card.color, card.text));
  s.appendChild(el('div',{style:'height:26px'}));
  if(!mine){
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center'},'Na otázku odpovídá ', el('b',{},ap.name)));
    if(card.color==='red'){
      s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-top:6px'},
        'Pokud vám v odpovědi něco není jasné, můžete se doptat.'));
    }
    return;
  }

  if(card.color==='red'){
    s.appendChild(el('div',{class:'banner-info'},'Na otázku odpovídá ', el('b',{},ap.name),
      '. Ostatní se v případě nejasností mohou doptat.'));
    s.appendChild(el('div',{style:'height:12px'}));
  }

  if(card.color==='blue'){
    // Modrá: aktivní hráč získá celou modrou až po dokončení kola (po hádání).
    s.appendChild(el('div',{class:'banner-info'},'Označ si v hlavě pravdivou odpověď. Ostatní teď hádají nahlas. Až domluvíte, pokračuj.'));
    s.appendChild(el('div',{style:'height:12px'}));
    s.appendChild(button('Odpověděl/a — pokračovat k hádání','btn-blue', ()=>{
      room.phase='guessing';
      state.guessSelections={}; state.guessColors={};
      saveAndRender();
    }));
    s.appendChild(el('div',{style:'height:8px'}));
    s.appendChild(button('Neodpověděl/a — ztrácí kartu','btn-secondary', ()=>{
      loseColor(ap, 'blue');
      advanceTurn(room);
      saveAndRender();
    }));
    return;
  }

  // Červená: vyhodnotí se hned (žlutá má vlastní kolo, viz renderYellowRound).
  s.appendChild(button('Odpověděl/a — získává kartu','btn-primary', ()=>{
    addFull(ap, card.color);
    if(!resolveWin(room, ap)) advanceTurn(room);
    saveAndRender();
  }));
  s.appendChild(el('div',{style:'height:8px'}));
  s.appendChild(button('Neodpověděl/a — ztrácí kartu','btn-secondary', ()=>{
    loseColor(ap, card.color);
    advanceTurn(room);
    saveAndRender();
  }));
}

/* Barevná vlna na horním/dolním okraji karty — tvar vychází
   z tištěných podkladů (plná barva s vlnitou hranou). */
function cardWave(cssColor, position){
  return `<svg class="wave-band ${position}" viewBox="0 0 300 74" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L300,0 L300,44 C255,64 215,30 165,42 C115,54 60,66 0,50 Z" fill="${cssColor}"/>
  </svg>`;
}

function qcardEl(color, text){
  const cssColor = color==='red' ? 'var(--red)'
                 : color==='blue' ? 'var(--blue)'
                 : color==='chance' ? 'var(--orange)'
                 : 'var(--yellow)';
  return el('div',{class:'qcard'},
    htmlToNode(cardWave(cssColor, 'top')),
    htmlToNode(cardWave(cssColor, 'bottom')),
    el('div',{class:'qcard-text'}, text)
  );
}

/* Závěrečná karta vítěze — jediná, která se netáhne z balíčku.
   Nese všechny barvy hry: nahoře západ slunce, dole moře. */
function finalCardEl(title, note){
  const sunset = `<svg class="wave-band top" viewBox="0 0 300 86" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L300,0 L300,30 C250,46 200,18 140,34 C90,47 40,36 0,24 Z" fill="var(--red)"/>
    <path d="M0,24 C40,36 90,47 140,34 C200,18 250,46 300,30 L300,54 C248,70 198,42 138,58 C88,71 40,60 0,48 Z" fill="var(--orange)"/>
    <path d="M0,48 C40,60 88,71 138,58 C198,42 248,70 300,54 L300,80 C246,96 196,66 136,82 C86,95 40,84 0,72 Z" fill="var(--yellow)"/>
  </svg>`;
  const sea = `<svg class="wave-band bottom" viewBox="0 0 300 86" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L300,0 L300,34 C248,52 198,22 138,40 C88,54 40,42 0,30 Z" fill="var(--blue)"/>
    <path d="M0,30 C40,42 88,54 138,40 C198,22 248,52 300,34 L300,86 L0,86 Z" fill="var(--blue-light)"/>
  </svg>`;
  return el('div',{class:'qcard qcard-final'},
    htmlToNode(sunset),
    htmlToNode(sea),
    el('div',{class:'qcard-text'},
      el('div',{}, title),
      note ? el('div',{class:'qcard-note'}, note) : null
    )
  );
}

function renderGuessingPhase(s, room, mine){
  const others = room.players.filter(p=>p.id!==activePlayer(room).id);
  s.appendChild(el('div',{class:'title-md', style:'text-align:center;margin-bottom:14px'},'Kdo uhodl správně?'));
  if(!mine){
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center'}, activePlayer(room).name, ' vyhodnocuje hádání…'));
    return;
  }
  const list = el('div',{class:'stack'});
  others.forEach(p=>{
    const isOn = !!state.guessSelections[p.id];
    const row = el('div',{class:'guess-row'},
      el('span',{},p.name),
      el('div',{class:'toggle'+(isOn?' on':''), onclick:()=>{
        state.guessSelections[p.id]=!isOn;
        if(!state.guessSelections[p.id]) delete state.guessColors[p.id];
        render();
      }})
    );
    list.appendChild(row);
    if(isOn){
      const picker = el('div',{class:'color-pick'});
      ['red','yellow','blue'].forEach(c=>{
        picker.appendChild(el('button',{
          class:'color-dot-btn c-'+c+(state.guessColors[p.id]===c?' selected':''),
          onclick:()=>{ state.guessColors[p.id]=c; render(); }
        }));
      });
      list.appendChild(picker);
    }
  });
  s.appendChild(list);
  s.appendChild(el('div',{class:'spacer'}));
  const allChosen = others.every(p=> !state.guessSelections[p.id] || state.guessColors[p.id]);
  s.appendChild(button('Potvrdit a pokračovat','btn-primary', ()=>{
    const ap = activePlayer(room);
    // Hádající, kteří uhodli, získávají půl kartu zvolené barvy.
    others.forEach(p=>{
      if(state.guessSelections[p.id] && state.guessColors[p.id]){
        addHalf(p, state.guessColors[p.id]);
      }
    });
    // Aktivní hráč odpověděl na modrou -> po dokončení kola získává celou modrou.
    addFull(ap, 'blue');

    // Vyhodnocení výhry: nejdřív hráč na tahu, pak ostatní.
    if(!resolveWin(room, ap)) advanceTurn(room);
    state.guessSelections={}; state.guessColors={};
    saveAndRender();
  }, !allChosen));
}

/* ---------- CHANCE ---------- */
/* Karta šance se táhne po dvojitém hodu. Po jejím vyřešení následuje
   otázka barvy, která padla (room.pendingColor) — pokud to karta dovolí. */
function renderChancePhase(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  s.appendChild(qcardEl('chance', card.text));
  s.appendChild(el('div',{style:'height:18px'}));
  if(room.pendingColor){
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-bottom:14px'},
      'Potom následuje ', el('b',{}, labelColor(room.pendingColor)), ' otázka.'));
  }
  if(!mine){
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center'},'Kartu šance řeší ', el('b',{},ap.name)));
    return;
  }
  const key = card.key;
  const next = ()=>{ continueAfterChance(room); state.chanceUI={}; saveAndRender(); };
  const nextLabel = room.pendingColor ? 'Pokračovat na otázku' : 'Pokračovat';

  if(key==='lose_all'){
    s.appendChild(button('Přijmout — přijít o všechny karty','btn-red', ()=>{
      ap.full={red:0,blue:0,yellow:0}; ap.halves={red:0,blue:0,yellow:0};
      next();
    }));
  }
  else if(key==='lose_all_unless_red'){
    s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Hoď o záchranu — pokud padne červená, karty si necháváš.'));
    s.appendChild(button('Hodit o záchranu','btn-primary', ()=>{
      const c=pickDieColor();
      if(c!=='red'){ ap.full={red:0,blue:0,yellow:0}; ap.halves={red:0,blue:0,yellow:0}; alert('Padlo: '+labelColor(c)+' — přicházíš o karty.'); }
      else alert('Padla červená — karty jsou v bezpečí!');
      next();
    }));
  }
  else if(key==='go_again'){
    // Nejdřív se odpoví na otázku, pak hraje stejný hráč ještě jednou.
    s.appendChild(button(room.pendingColor ? 'Odpovím a jedu ještě jednou' : 'Jedu ještě jednou','btn-primary', ()=>{
      room.extraTurn = true;
      next();
    }));
  }
  else if(key==='change_color'){
    s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Vyber si barvu otázky, kterou chceš táhnout:'));
    s.appendChild(el('div',{class:'color-pick'},
      ...['red','yellow','blue'].map(c=>el('button',{class:'color-dot-btn c-'+c, title:labelColor(c), onclick:()=>{
        startQuestion(room, c);
        state.chanceUI={};
        saveAndRender();
      }}))
    ));
  }
  else if(key==='right_answers'){
    s.appendChild(button('Pokračovat','btn-primary', ()=>{
      const nb = rightNeighbor(room);
      const c = room.pendingColor || pickDieColor();
      const q = drawFrom(room, c);
      room.currentCard = {type:'question', color:c, text:q, forId:nb.id};
      room.pendingColor = null;
      room.phase='right-neighbor';
      saveAndRender();
    }));
  }
  else if(key==='reverse'){
    s.appendChild(button('Změnit směr hry','btn-primary', ()=>{
      room.direction*=-1;
      next();
    }));
  }
  else if(key==='skip_next'){
    // „Teď nehraješ." — tah končí hned, otázka se nehraje.
    s.appendChild(button('Rozumím, teď nehraju','btn-primary', ()=>{
      room.pendingColor = null;
      advanceTurn(room); saveAndRender();
    }));
  }
  else if(key==='steal'){
    renderStealUI(s, room, ap, nextLabel);
  }
  else if(key==='trade_two_for_one'){
    renderTradeUI(s, room, ap, nextLabel);
  }
  else if(key==='everyone_red'){
    // Červená pro všechny nahrazuje otázku z hodu.
    s.appendChild(button('Vytáhnout červenou otázku pro všechny','btn-red', ()=>{
      const q = drawFrom(room,'red');
      room.currentCard = {type:'question', color:'red', text:q, everyone:true};
      room.pendingColor = null;
      room.phase='everyone-red';
      saveAndRender();
    }));
  }
  else {
    s.appendChild(button(nextLabel,'btn-primary', next));
  }
}

function renderStealUI(s, room, ap, nextLabel){
  const others = room.players.filter(p=>p.id!==ap.id);
  const hasAny = (p)=> ['red','yellow','blue'].some(c=> p.full[c]>0 || p.halves[c]>0);
  const stealable = others.filter(hasAny);

  // Nikdo nemá co ukrást — efekt se přeskakuje.
  if(stealable.length===0){
    s.appendChild(el('div',{class:'banner-info'},'Nikdo zatím nemá žádnou kartu — efekt se přeskakuje.'));
    s.appendChild(el('div',{style:'height:12px'}));
    s.appendChild(button(nextLabel,'btn-primary', ()=>{
      state.chanceUI={};
      continueAfterChance(room); saveAndRender();
    }));
    return;
  }

  s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Vyber hráče a barvu karty, kterou mu ukradneš:'));

  let targetSel = state.chanceUI.target;
  if(!targetSel || !stealable.some(p=>p.id===targetSel)) targetSel = stealable[0].id;
  state.chanceUI.target = targetSel;

  const target = room.players.find(p=>p.id===targetSel);
  const availColors = ['red','yellow','blue'].filter(c=> target.full[c]>0 || target.halves[c]>0);

  let colSel = state.chanceUI.color;
  if(!colSel || !availColors.includes(colSel)) colSel = availColors[0];
  state.chanceUI.color = colSel;

  const sel = el('select',{class:'card-input', onchange:(e)=>{
    state.chanceUI.target=e.target.value;
    state.chanceUI.color=null; // barvy se přepočítají podle nového hráče
    render();
  }});
  stealable.forEach(p=> sel.appendChild(el('option',{value:p.id, selected: p.id===targetSel?'selected':null}, p.name)));
  s.appendChild(sel);
  s.appendChild(el('div',{style:'height:10px'}));

  // nabízíme jen barvy, které vybraný hráč skutečně má
  s.appendChild(el('div',{class:'color-pick'},
    ...availColors.map(c=>el('button',{class:'color-dot-btn c-'+c+(colSel===c?' selected':''), title:labelColor(c), onclick:()=>{state.chanceUI.color=c; render();}}))
  ));
  s.appendChild(el('div',{style:'height:14px'}));
  s.appendChild(button('Ukrást','btn-primary', ()=>{
    const t = room.players.find(p=>p.id===state.chanceUI.target);
    const c = state.chanceUI.color;
    if(t.full[c]>0){ t.full[c]--; ap.full[c]++; }
    else if(t.halves[c]>0){ t.halves[c]--; addHalf(ap,c); }
    state.chanceUI={};
    if(!resolveWin(room, ap)) continueAfterChance(room);
    saveAndRender();
  }));
}
function renderTradeUI(s, room, ap, nextLabel){
  const eligible = ['red','yellow','blue'].filter(c=>ap.full[c]>=2);
  if(eligible.length===0){
    s.appendChild(el('div',{class:'banner-info'},'Nemáš 2 celé karty stejné barvy — efekt se přeskakuje.'));
    s.appendChild(el('div',{style:'height:12px'}));
    s.appendChild(button(nextLabel,'btn-primary', ()=>{ continueAfterChance(room); saveAndRender(); }));
    return;
  }
  s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Vyber barvu, kterou obětuješ (2 karty):'));
  s.appendChild(el('div',{class:'color-pick'},
    ...eligible.map(c=>el('button',{class:'color-dot-btn c-'+c+(state.chanceUI.give===c?' selected':''), title:labelColor(c), onclick:()=>{
      state.chanceUI.give=c;
      if(state.chanceUI.want===c) state.chanceUI.want=null;
      render();
    }}))
  ));
  if(state.chanceUI.give){
    s.appendChild(el('div',{style:'height:14px'}));
    s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'A barvu, kterou chceš získat:'));
    s.appendChild(el('div',{class:'color-pick'},
      ...['red','yellow','blue'].filter(c=>c!==state.chanceUI.give).map(c=>el('button',{class:'color-dot-btn c-'+c+(state.chanceUI.want===c?' selected':''), title:labelColor(c), onclick:()=>{state.chanceUI.want=c; render();}}))
    ));
  }
  s.appendChild(el('div',{style:'height:14px'}));
  s.appendChild(button('Vyměnit','btn-primary', ()=>{
    ap.full[state.chanceUI.give]-=2;
    ap.full[state.chanceUI.want]++;
    state.chanceUI={};
    if(!resolveWin(room, ap)) continueAfterChance(room);
    saveAndRender();
  }, !(state.chanceUI.give && state.chanceUI.want)));
  s.appendChild(el('div',{style:'height:8px'}));
  s.appendChild(button('Neměnit','btn-secondary', ()=>{
    state.chanceUI={};
    continueAfterChance(room); saveAndRender();
  }));
}

function renderEveryoneRed(s, room, mine){
  s.appendChild(qcardEl('red', room.currentCard.text));
  s.appendChild(el('div',{style:'height:26px'}));
  s.appendChild(el('div',{class:'banner-info'},'Tuhle otázku zodpoví všichni hráči postupně.'));
  if(!mine) return;
  s.appendChild(el('div',{style:'height:12px'}));
  s.appendChild(button('Hotovo, další na tahu','btn-primary', ()=>{ advanceTurn(room); saveAndRender(); }));
}

function renderRightNeighbor(s, room, mine){
  const nb = room.players.find(p=>p.id===room.currentCard.forId);
  const nbName = nb ? nb.name : '?';
  s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-bottom:10px'},'Na otázku odpovídá ', el('b',{},nbName)));
  s.appendChild(qcardEl(room.currentCard.color, room.currentCard.text));
  s.appendChild(el('div',{style:'height:26px'}));
  if(!mine) return;
  s.appendChild(button('Odpověděl/a','btn-primary', ()=>{ advanceTurn(room); saveAndRender(); }));
  s.appendChild(el('div',{style:'height:8px'}));
  s.appendChild(button('Neodpověděl/a — ztrácí kartu','btn-secondary', ()=>{
    if(nb) loseColor(nb, room.currentCard.color);
    advanceTurn(room); saveAndRender();
  }));
}

/* ---------- ŽLUTÁ KARTA: ODPOVÍDAJÍ VŠICHNI PO ŘADĚ ---------- */
/* Začíná hráč, který kartu vytáhl, pak ostatní ve směru hry.
   Kdo neodpoví, ztrácí žlutou kartu (má-li ji). Když kolo dojde zpět
   k tomu, kdo kartu vytáhl, získává celou žlutou kartu. */
function renderYellowRound(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  const y = room.yellow;
  s.appendChild(qcardEl('yellow', card.text));
  s.appendChild(el('div',{style:'height:20px'}));
  if(!y){ return; }

  const answered = y.answered || {};
  const started = Object.keys(answered).length>0;
  const current = room.players.find(p=>p.id===y.current);
  const backToDrawer = started && y.current===ap.id;

  // Přehled pořadí: kdo už odpověděl, kdo je na řadě.
  const list = el('div',{class:'stack yellow-list'});
  y.order.forEach((pid,i)=>{
    const p = room.players.find(x=>x.id===pid);
    if(!p) return;
    let status, cls='';
    if(pid in answered){
      status = answered[pid] ? 'odpověděl/a ✓' : 'neodpověděl/a';
      cls = answered[pid] ? 'ok' : 'no';
    } else if(pid===y.current){
      status = 'je na řadě'; cls='now';
    } else {
      status = 'čeká';
    }
    list.appendChild(el('div',{class:'guess-row yellow-row '+cls},
      el('span',{}, p.name + (i===0 ? ' (vytáhl/a kartu)' : '') + (pid===state.myPlayerId?' — ty':'')),
      el('span',{class:'yellow-status'}, status)
    ));
  });
  s.appendChild(list);
  s.appendChild(el('div',{style:'height:16px'}));

  // Kolo se vrátilo k tomu, kdo kartu vytáhl -> bere žlutou kartu.
  if(backToDrawer){
    if(mine){
      s.appendChild(el('div',{class:'banner-info'},'Všichni se vystřídali. ', el('b',{},ap.name), ' získává žlutou kartu.'));
      s.appendChild(el('div',{style:'height:12px'}));
      s.appendChild(button('Vzít žlutou kartu a pokračovat','btn-yellow', ()=>{ yellowFinish(); }));
    } else {
      s.appendChild(el('div',{class:'subtitle waiting-dots', style:'text-align:center'},
        ap.name, ' bere žlutou kartu', el('span',{},'.'),el('span',{},'.'),el('span',{},'.')));
    }
    return;
  }

  if(!current) return;
  const isDrawer = current.id===ap.id;
  const canAnswer = Store.mode==='local' || current.id===state.myPlayerId;
  // Hráč na tahu může rozhodnout za někoho, kdo je offline.
  const canDecideFor = Store.mode==='online' && mine && !canAnswer && current.online===false;

  if(canAnswer || canDecideFor){
    s.appendChild(el('div',{class:'banner-info'},
      canDecideFor ? [el('b',{},current.name), ' je offline — rozhodni za něj/ni.']
                   : ['Odpovídá ', el('b',{},current.name), isDrawer ? ' (jako první).' : '.']
    ));
    s.appendChild(el('div',{style:'height:12px'}));
    s.appendChild(button('Odpověděl/a','btn-yellow', ()=>{ yellowAnswer(current.id, true); }));
    s.appendChild(el('div',{style:'height:8px'}));
    const hasYellow = current.full.yellow>0 || current.halves.yellow>0;
    s.appendChild(button(
      hasYellow ? 'Neodpověděl/a — ztrácí žlutou kartu' : 'Neodpověděl/a (žlutou kartu nemá)',
      'btn-secondary', ()=>{ yellowAnswer(current.id, false); }));
    if(isDrawer){
      s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-top:8px'},
        'Když neodpoví ten, kdo kartu vytáhl, kolo končí.'));
    }
  } else {
    s.appendChild(el('div',{class:'subtitle waiting-dots', style:'text-align:center'},
      'Odpovídá ', el('b',{},current.name), el('span',{},'.'),el('span',{},'.'),el('span',{},'.')));
  }
}

/* ---------- MODRÁ KARTA: KVÍZOVÝ REŽIM (jen online) ---------- */

/* Krok 1 — hráč na tahu vymyslí 3 možnosti a označí tu pravdivou. */
function renderBlueCompose(s, room, mine){
  const card = room.currentCard;
  s.appendChild(qcardEl('blue', card.text));
  s.appendChild(el('div',{style:'height:26px'}));

  if(!mine){
    s.appendChild(el('div',{class:'center-col'},
      el('div',{class:'subtitle waiting-dots'}, activePlayer(room).name, ' vymýšlí odpovědi',
        el('span',{},'.'),el('span',{},'.'),el('span',{},'.'))
    ));
    return;
  }

  if(!state.blueCompose) state.blueCompose = {a:'', b:'', c:'', correct:0};
  const bc = state.blueCompose;

  s.appendChild(el('div',{class:'banner-info'},'Napiš tři možné odpovědi a označ tu pravdivou. Ostatní pak budou hádat, která to je.'));
  s.appendChild(el('div',{style:'height:14px'}));

  const keys = ['a','b','c'];
  const list = el('div',{class:'stack'});
  keys.forEach((k,i)=>{
    const row = el('div',{class:'row'});
    row.appendChild(el('button',{
      class:'color-dot-btn'+(bc.correct===i?' selected':''),
      style:'background:'+(bc.correct===i?'var(--blue-dark)':'#E4DCC9')+';flex-shrink:0;width:36px;height:36px',
      title:'Označit jako pravdivou',
      onclick:()=>{ bc.correct=i; render(); }
    }));
    row.appendChild(el('input',{class:'card-input', 'data-fk':'blue-'+k, placeholder:'Možnost '+(i+1), value:bc[k],
      oninput:(e)=>{ bc[k]=e.target.value; }}));
    list.appendChild(row);
  });
  s.appendChild(list);
  s.appendChild(el('div',{class:'subtitle', style:'margin-top:8px'},'Modrým kolečkem označ pravdivou odpověď.'));

  s.appendChild(el('div',{class:'spacer'}));
  s.appendChild(button('Odeslat možnosti','btn-blue', ()=>{
    const opts = keys.map(k=> (bc[k]||'').trim());
    if(opts.some(o=>!o)){ alert('Vyplň všechny tři možnosti.'); return; }
    // Správná odpověď se zatím NEODESÍLÁ — zůstává jen v zařízení hráče na tahu,
    // aby si ji ostatní nemohli přečíst z databáze. Odešle se až při vyhodnocení.
    rememberSecret(room.code, bc.correct);
    room.currentCard = Object.assign({}, card, {options:opts, correct:null});
    room.votes = {};
    room.awardColors = {};
    room.phase = 'blue-guessing';
    state.blueCompose = {a:'', b:'', c:'', correct:0};
    saveAndRender();
  }));
  s.appendChild(el('div',{style:'height:8px'}));
  s.appendChild(button('Neodpověděl/a — ztrácí kartu','btn-secondary', ()=>{
    loseColor(activePlayer(room), 'blue');
    state.blueCompose = {a:'', b:'', c:'', correct:0};
    advanceTurn(room);
    saveAndRender();
  }));
}

/* Krok 2 — ostatní hlasují, hráč na tahu čeká. */
function renderBlueGuessing(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  const others = room.players.filter(p=>p.id!==ap.id);
  const votes = room.votes || {};
  const hasVoted = p => votes[p.id]!==undefined && votes[p.id]!==null;
  const voted = others.filter(hasVoted);
  // Na hráče, kteří odešli (offline), se nečeká.
  const waitingFor = others.filter(p=> !hasVoted(p) && p.online!==false);

  s.appendChild(qcardEl('blue', card.text));
  s.appendChild(el('div',{style:'height:26px'}));

  if(mine){
    s.appendChild(el('div',{class:'banner-info'},'Ostatní hádají. Hlasovalo ', el('b',{}, voted.length+' z '+others.length), '.'));
    s.appendChild(el('div',{style:'height:12px'}));
    const list = el('div',{class:'stack'});
    others.forEach(p=>{
      list.appendChild(el('div',{class:'guess-row'},
        el('span',{}, p.name),
        el('span',{class:'subtitle', style:'margin:0'}, hasVoted(p) ? 'hlasoval/a' : (p.online===false ? 'offline' : 'čeká se…'))
      ));
    });
    s.appendChild(list);
    s.appendChild(el('div',{class:'spacer'}));
    const secret = recallSecret(room.code);
    if(secret===null){
      // Správná odpověď se ztratila (jiné zařízení / smazaná data prohlížeče).
      s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-bottom:8px'},'Která odpověď byla pravdivá?'));
      const pick = el('div',{class:'stack'});
      (card.options||[]).forEach((opt,i)=>{
        pick.appendChild(button(opt,'btn-secondary', ()=>{ rememberSecret(room.code, i); render(); }));
      });
      s.appendChild(pick);
      return;
    }
    s.appendChild(button('Vyhodnotit','btn-primary', ()=>{
      // teprve teď odhalíme správnou odpověď všem
      room.currentCard = Object.assign({}, card, {correct: secret});
      room.phase='blue-reveal';
      forgetSecret();
      saveAndRender();
    }, waitingFor.length > 0 || voted.length===0));
    return;
  }

  // hráč, který hádá
  const myVote = votes[state.myPlayerId];
  if(myVote !== undefined && myVote !== null){
    s.appendChild(el('div',{class:'center-col'},
      el('div',{class:'banner-info'},'Tvoje odpověď: ', el('b',{}, card.options[myVote])),
      el('div',{class:'subtitle waiting-dots'},'Čeká se na ostatní',
        el('span',{},'.'),el('span',{},'.'),el('span',{},'.'))
    ));
    return;
  }

  s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-bottom:12px'},'Která odpověď je podle tebe pravdivá?'));
  const list = el('div',{class:'stack'});
  (card.options||[]).forEach((opt,i)=>{
    list.appendChild(button(opt,'btn-secondary', ()=>{
      Online.pushVote(room.code, state.myPlayerId, i);
    }));
  });
  s.appendChild(list);
}

/* Krok 3 — odhalení, kdo uhodl, a výběr barvy půlkarty. */
function renderBlueReveal(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  const others = room.players.filter(p=>p.id!==ap.id);
  const votes = room.votes || {};
  const colors = room.awardColors || {};
  const winners = others.filter(p=> votes[p.id]===card.correct);

  s.appendChild(el('div',{class:'title-md', style:'text-align:center;margin-bottom:10px'},'Pravdivá odpověď'));
  s.appendChild(qcardEl('blue', card.options[card.correct]));
  s.appendChild(el('div',{style:'height:16px'}));

  const list = el('div',{class:'stack'});
  others.forEach(p=>{
    const ok = votes[p.id]===card.correct;
    list.appendChild(el('div',{class:'guess-row'},
      el('span',{}, p.name),
      el('span',{style:'font-weight:700;color:'+(ok?'var(--blue-dark)':'var(--navy-soft)')}, ok ? 'uhodl/a ✓' : 'neuhodl/a')
    ));
  });
  s.appendChild(list);

  // Ten, kdo uhodl, si volí barvu půlkarty na svém zařízení.
  const iWon = winners.some(p=>p.id===state.myPlayerId);
  if(iWon && !colors[state.myPlayerId]){
    s.appendChild(el('div',{style:'height:14px'}));
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center'},'Uhodl/a jsi! Vyber barvu své půlkarty:'));
    s.appendChild(el('div',{class:'color-pick'},
      ...['red','yellow','blue'].map(cc=>el('button',{class:'color-dot-btn c-'+cc, onclick:()=>{
        Online.pushAwardColor(room.code, state.myPlayerId, cc);
      }}))
    ));
  } else if(iWon){
    s.appendChild(el('div',{style:'height:14px'}));
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center'},'Zvolená barva půlkarty je uložena.'));
  }

  if(!mine){
    s.appendChild(el('div',{style:'height:14px'}));
    s.appendChild(el('div',{class:'subtitle waiting-dots', style:'text-align:center'},'Čeká se na ', ap.name,
      el('span',{},'.'),el('span',{},'.'),el('span',{},'.')));
    return;
  }

  // Na výběr barvy čekáme jen u hráčů, kteří jsou online.
  const pending = winners.filter(p=>!colors[p.id] && p.online!==false);
  s.appendChild(el('div',{class:'spacer'}));
  if(pending.length){
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-bottom:8px'},
      'Barvu si ještě vybírá: '+pending.map(p=>p.name).join(', ')));
  }
  s.appendChild(button('Pokračovat','btn-primary', ()=>{
    // Půlkarty pro ty, kdo uhodli.
    winners.forEach(p=>{
      const cc = colors[p.id];
      if(cc) addHalf(p, cc);
    });
    // Hráč na tahu odpověděl -> získává celou modrou.
    addFull(ap, 'blue');

    if(!resolveWin(room, ap)) advanceTurn(room);
    room.votes = {};
    room.awardColors = {};
    saveAndRender();
  }, pending.length>0));
}

/* ---------- FINISHED ---------- */
/* Po dosažení výhry hra nekončí pohárem, ale poslední otázkou:
   vítěz dostane právo zeptat se ostatních na cokoliv. Výhra je
   jistá — otázka je závěr hry, ne podmínka vítězství. */
function renderFinished(s, room){
  const winner = room.players.find(p=>p.id===room.winnerId);
  const mine = (Store.mode==='local') || (winner && winner.id===state.myPlayerId);

  // 1. fáze — právo na otázku
  if(!room.finalDone){
    s.appendChild(el('div',{class:'center-col', style:'margin-top:26px'},
      el('div',{class:'win-crown'},'💬'),
      el('div',{class:'title-lg'}, winner.name, ' získává právo na otázku'),
    ));
    s.appendChild(el('div',{style:'height:20px'}));
    s.appendChild(finalCardEl(
      'Zeptej se ostatních na cokoliv.',
      'Odpovídají všichni. Poslední otázka hry je ta, kterou si vymyslíš sám.'
    ));

    if(!mine){
      s.appendChild(el('div',{style:'height:20px'}));
      s.appendChild(el('div',{class:'subtitle waiting-dots', style:'text-align:center'},
        winner.name, ' vymýšlí otázku', el('span',{},'.'),el('span',{},'.'),el('span',{},'.')));
      return;
    }

    s.appendChild(el('div',{class:'spacer'}));
    s.appendChild(button('Máme odpovězeno','btn-primary', ()=>{
      room.finalDone = true;
      saveAndRender();
    }));
    s.appendChild(el('div',{class:'exit-wrap'},
      el('button',{class:'exit-btn', onclick:()=>{
        room.finalDone = true; saveAndRender();
      }},'Přeskočit')
    ));
    return;
  }

  // 2. fáze — pohár a konec
  s.appendChild(el('div',{class:'center-col', style:'margin-top:30px'},
    el('div',{class:'win-crown'},'🏆'),
    el('div',{class:'title-lg'}, winner.name, ' vyhrává!'),
    el('div',{class:'subtitle'},'Sesbíral/a 2 celé karty od každé barvy.')
  ));
  s.appendChild(el('div',{style:'height:24px'}));
  s.appendChild(scoreRow(room));
  s.appendChild(el('div',{class:'spacer'}));
  s.appendChild(button('Nová hra','btn-primary', ()=>{
    if(Store.mode==='online'){ leaveOnlineRoom(); return; }
    resetAppState();
    render();
  }));
}
