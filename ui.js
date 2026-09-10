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
  app.innerHTML='';
  app.appendChild(el('div',{class:'wave-top'},htmlToNode(waveSVG('#E9502E','#F6C61E'))));
  const screen = el('div',{class:'screen'});
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
function renderHome(s){
  s.appendChild(el('div',{class:'title-xl'},'FLOU'));
  s.appendChild(el('div',{class:'subtitle'},'Karetní diskusní hra — otázky, hádání a trocha štěstí.'));
  s.appendChild(el('div',{style:'height:28px'}));
  s.appendChild(el('div',{class:'stack'},
    button('Hrát na jednom zařízení','btn-primary',()=>{state.screen='setupLocal'; state.setupNames=['','']; render();}),
    button('Vytvořit online místnost','btn-secondary',()=>{state.myName=''; state.screen='setupHost'; render();}),
    button('Připojit se ke kódu','btn-secondary',()=>{state.joinCode=''; state.myName=''; state.screen='joinRoom'; render();}),
  ));
  s.appendChild(el('div',{style:'height:20px'}));
  s.appendChild(el('div',{class:'banner-info'},
    el('b',{},'Jak hrát: '),'Padne barva → táhne se otázka té barvy. Modrá karta = ostatní hádají, kdo uhodne, získá půl kartu. Dvě půl karty stejné barvy = 1 celá. Vyhrává, kdo má 2 celé karty od každé barvy.'
  ));
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
    const input = el('input',{class:'card-input', placeholder:'Jméno hráče '+(i+1), value:name,
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
  s.appendChild(el('input',{class:'card-input', placeholder:'Vaše jméno', value:state.myName,
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
    el('input',{class:'card-input', placeholder:'KÓD MÍSTNOSTI', value:state.joinCode, style:'text-transform:uppercase;letter-spacing:3px;text-align:center;font-weight:700;',
      oninput:(e)=>{state.joinCode=e.target.value.toUpperCase();}}),
    el('input',{class:'card-input', placeholder:'Vaše jméno', value:state.myName,
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
function exitGameRow(){
  return el('div',{style:'display:flex;justify-content:flex-end;margin-bottom:6px'},
    el('button',{class:'link-btn', onclick:()=>{ confirmExitGame(); }},'Ukončit hru')
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

  const ap = activePlayer(room);
  s.appendChild(exitGameRow());
  s.appendChild(el('div',{class:'turn-banner'}, 'Na tahu: ', el('b',{},ap.name)));
  s.appendChild(scoreRow(room));
  s.appendChild(el('div',{style:'height:18px'}));

  const mine = isMyTurnOrLocal(room);

  if(room.phase==='idle'){
    const die = el('div',{class:'die'}, el('div',{class:'dot', style:'background:'+diePreviewColor(room)}));
    const col = el('div',{class:'center-col', style:'margin-top:10px'}, die);
    if(mine){
      const btn = button('Hodit kostkou','btn-primary', ()=>{
        animateRoll(die, btn);
      });
      col.appendChild(btn);
    } else {
      col.appendChild(el('div',{class:'subtitle'},'Čeká se na hod hráče ', el('b',{},ap.name)));
    }
    s.appendChild(col);
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
/* Animace hodu: kostka se roztočí a bliká barvami,
   pak dosedne na vylosovanou barvu a teprve potom se táhne karta. */
function animateRoll(dieEl, btnEl){
  if(state.rolling) return;
  state.rolling = true;

  const result = pickDieColor();
  const cssOf = c => c==='red' ? 'var(--red)' : c==='blue' ? 'var(--blue)' : 'var(--yellow)';
  const dot = dieEl.children ? dieEl.children[0] : null;
  const setDot = (c)=>{ if(dot && dot.style) dot.style.background = cssOf(c); };

  dieEl.classList && dieEl.classList.add('rolling');
  if(btnEl){ btnEl.disabled = true; btnEl.textContent = 'Kostka se točí…'; }

  const seq = ['red','blue','yellow'];
  let i = 0;
  const spin = setInterval(()=>{ setDot(seq[i++ % seq.length]); }, 90);

  setTimeout(()=>{
    clearInterval(spin);
    dieEl.classList && dieEl.classList.remove('rolling');
    dieEl.classList && dieEl.classList.add('landed');
    setDot(result);
    // krátká pauza, ať je výsledek vidět, pak teprve karta
    setTimeout(()=>{
      state.rolling = false;
      rollDice(result);
    }, 420);
  }, 900);
}

function diePreviewColor(room){
  const c = room.lastRolledColor;
  if(c==='red') return 'var(--red)';
  if(c==='blue') return 'var(--blue)';
  if(c==='yellow') return 'var(--yellow)';
  return 'var(--navy-soft)';
}
function scoreRow(room){
  const row = el('div',{class:'score-row'});
  room.players.forEach(p=>{
    row.appendChild(el('div',{class:'score-chip'},
      el('div',{class:'pname'}, p.name + (p.id===state.myPlayerId?' (ty)':'')),
      el('div',{class:'score-dots'},
        ...['red','yellow','blue'].map(c=>dotsFor(p,c))
      )
    ));
  });
  return row;
}
function dotsFor(p,color){
  const wrap = el('span',{style:'display:flex;gap:2px;margin-right:6px'});
  const colVar = color==='red'?'var(--red)':color==='yellow'?'var(--yellow)':'var(--blue)';
  for(let i=0;i<p.full[color];i++) wrap.appendChild(el('span',{class:'mini-dot full', style:'background:'+colVar}));
  for(let i=0;i<p.halves[color];i++) wrap.appendChild(el('span',{class:'mini-dot half', style:'background:'+colVar}));
  if(p.full[color]===0 && p.halves[color]===0) wrap.appendChild(el('span',{class:'mini-dot', style:'background:#E4DCC9'}));
  return wrap;
}

function renderQuestionPhase(s, room, mine){
  const card = room.currentCard;
  s.appendChild(qcardEl(card.color, card.text));
  s.appendChild(el('div',{style:'height:18px'}));
  if(!mine){
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center'},'Otázku řeší ', el('b',{},activePlayer(room).name)));
    return;
  }
  const ap = activePlayer(room);

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

  // Červená / žlutá: vyhodnotí se hned.
  s.appendChild(button('Odpověděl/a — získává kartu','btn-primary', ()=>{
    addFull(ap, card.color);
    if(checkWin(ap)){ room.phase='finished'; room.winnerId=ap.id; }
    else advanceTurn(room);
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
    let winner = checkWin(ap) ? ap : others.find(p=>checkWin(p));
    if(winner){ room.phase='finished'; room.winnerId=winner.id; }
    else advanceTurn(room);
    saveAndRender();
  }, !allChosen));
}

/* ---------- CHANCE ---------- */
function renderChancePhase(s, room, mine){
  const card = room.currentCard;
  s.appendChild(qcardEl('chance', card.text));
  s.appendChild(el('div',{style:'height:18px'}));
  if(!mine){
    s.appendChild(el('div',{class:'subtitle', style:'text-align:center'},'Kartu šance řeší ', el('b',{},activePlayer(room).name)));
    return;
  }
  const ap = activePlayer(room);
  const key = card.key;

  if(key==='lose_all'){
    s.appendChild(button('Přijmout — přijít o všechny karty','btn-red', ()=>{
      ap.full={red:0,blue:0,yellow:0}; ap.halves={red:0,blue:0,yellow:0};
      advanceTurn(room); saveAndRender();
    }));
  }
  else if(key==='lose_all_unless_red'){
    s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Hoď o záchranu — pokud padne červená, karty si necháváš.'));
    s.appendChild(button('Hodit o záchranu','btn-primary', ()=>{
      const c=['red','blue','yellow'][Math.floor(Math.random()*3)];
      if(c!=='red'){ ap.full={red:0,blue:0,yellow:0}; ap.halves={red:0,blue:0,yellow:0}; alert('Padlo: '+labelColor(c)+' — přicházíš o karty.'); }
      else alert('Padla červená — karty jsou v bezpečí!');
      advanceTurn(room); saveAndRender();
    }));
  }
  else if(key==='go_again'){
    s.appendChild(button('Jedu ještě jednou','btn-primary', ()=>{
      room.phase='idle'; room.currentCard=null;
      saveAndRender();
    }));
  }
  else if(key==='change_color'){
    s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Vyber si barvu otázky, kterou chceš táhnout:'));
    s.appendChild(el('div',{class:'color-pick'},
      ...['red','yellow','blue'].map(c=>el('button',{class:'color-dot-btn c-'+c, onclick:()=>{
        const q = drawFrom(room,c);
        room.currentCard = {type:'question', color:c, text:q};
        room.phase='rolled-question';
        saveAndRender();
      }}))
    ));
  }
  else if(key==='right_answers'){
    s.appendChild(button('Pokračovat','btn-primary', ()=>{
      const nb = rightNeighbor(room);
      const c = ['red','blue','yellow'][Math.floor(Math.random()*3)];
      const q = drawFrom(room, c);
      room.currentCard = {type:'question', color:c, text:q, forId:nb.id};
      room.phase='right-neighbor';
      saveAndRender();
    }));
  }
  else if(key==='reverse'){
    s.appendChild(button('Změnit směr hry','btn-primary', ()=>{
      room.direction*=-1;
      advanceTurn(room); saveAndRender();
    }));
  }
  else if(key==='skip_next'){
    s.appendChild(button('Budu příště pauzírovat','btn-primary', ()=>{
      ap.skipNext=true;
      advanceTurn(room); saveAndRender();
    }));
  }
  else if(key==='steal'){
    renderStealUI(s, room, ap);
  }
  else if(key==='trade_two_for_one'){
    renderTradeUI(s, room, ap);
  }
  else if(key==='everyone_red'){
    s.appendChild(button('Vytáhnout červenou otázku pro všechny','btn-red', ()=>{
      const q = drawFrom(room,'red');
      room.currentCard = {type:'question', color:'red', text:q, everyone:true};
      room.phase='everyone-red';
      saveAndRender();
    }));
  }
  else {
    s.appendChild(button('Pokračovat','btn-primary', ()=>{ advanceTurn(room); saveAndRender(); }));
  }
}

function renderStealUI(s, room, ap){
  const others = room.players.filter(p=>p.id!==ap.id);
  const hasAny = (p)=> ['red','yellow','blue'].some(c=> p.full[c]>0 || p.halves[c]>0);
  const stealable = others.filter(hasAny);

  // Nikdo nemá co ukrást — efekt se přeskakuje, hra pokračuje dalším hráčem.
  if(stealable.length===0){
    s.appendChild(el('div',{class:'banner-info'},'Nikdo zatím nemá žádnou kartu — efekt se přeskakuje.'));
    s.appendChild(el('div',{style:'height:12px'}));
    s.appendChild(button('Pokračovat','btn-primary', ()=>{
      state.chanceUI={};
      advanceTurn(room); saveAndRender();
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
    ...availColors.map(c=>el('button',{class:'color-dot-btn c-'+c+(colSel===c?' selected':''), onclick:()=>{state.chanceUI.color=c; render();}}))
  ));
  s.appendChild(el('div',{style:'height:14px'}));
  s.appendChild(button('Ukrást','btn-primary', ()=>{
    const t = room.players.find(p=>p.id===state.chanceUI.target);
    const c = state.chanceUI.color;
    if(t.full[c]>0){ t.full[c]--; ap.full[c]++; }
    else if(t.halves[c]>0){ t.halves[c]--; addHalf(ap,c); }
    if(checkWin(ap)){ room.phase='finished'; room.winnerId=ap.id; }
    else advanceTurn(room);
    state.chanceUI={};
    saveAndRender();
  }));
}
function renderTradeUI(s, room, ap){
  const eligible = ['red','yellow','blue'].filter(c=>ap.full[c]>=2);
  if(eligible.length===0){
    s.appendChild(el('div',{class:'banner-info'},'Nemáš 2 celé karty stejné barvy — efekt se přeskakuje.'));
    s.appendChild(el('div',{style:'height:12px'}));
    s.appendChild(button('Pokračovat','btn-primary', ()=>{ advanceTurn(room); saveAndRender(); }));
    return;
  }
  s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Vyber barvu, kterou obětuješ (2 karty):'));
  s.appendChild(el('div',{class:'color-pick'},
    ...eligible.map(c=>el('button',{class:'color-dot-btn c-'+c+(state.chanceUI.give===c?' selected':''), onclick:()=>{state.chanceUI.give=c; render();}}))
  ));
  if(state.chanceUI.give){
    s.appendChild(el('div',{style:'height:14px'}));
    s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'A barvu, kterou chceš získat:'));
    s.appendChild(el('div',{class:'color-pick'},
      ...['red','yellow','blue'].map(c=>el('button',{class:'color-dot-btn c-'+c+(state.chanceUI.want===c?' selected':''), onclick:()=>{state.chanceUI.want=c; render();}}))
    ));
  }
  s.appendChild(el('div',{style:'height:14px'}));
  s.appendChild(button('Vyměnit','btn-primary', ()=>{
    ap.full[state.chanceUI.give]-=2;
    ap.full[state.chanceUI.want]++;
    if(checkWin(ap)){ room.phase='finished'; room.winnerId=ap.id; }
    else advanceTurn(room);
    state.chanceUI={};
    saveAndRender();
  }, !(state.chanceUI.give && state.chanceUI.want)));
}

function renderEveryoneRed(s, room, mine){
  s.appendChild(qcardEl('red', room.currentCard.text));
  s.appendChild(el('div',{style:'height:18px'}));
  s.appendChild(el('div',{class:'banner-info'},'Tuhle otázku zodpoví všichni hráči postupně.'));
  if(!mine) return;
  s.appendChild(el('div',{style:'height:12px'}));
  s.appendChild(button('Hotovo, další na tahu','btn-primary', ()=>{ advanceTurn(room); saveAndRender(); }));
}

function renderRightNeighbor(s, room, mine){
  const nb = room.players.find(p=>p.id===room.currentCard.forId);
  s.appendChild(el('div',{class:'subtitle', style:'text-align:center;margin-bottom:10px'},'Odpovídá: ', el('b',{},nb.name)));
  s.appendChild(qcardEl(room.currentCard.color, room.currentCard.text));
  s.appendChild(el('div',{style:'height:18px'}));
  if(!mine) return;
  s.appendChild(el('div',{class:'row'},
    button('Odpověděl/a','btn-primary', ()=>{ advanceTurn(room); saveAndRender(); }),
  ));
  s.appendChild(el('div',{style:'height:8px'}));
  s.appendChild(button('Neodpověděl/a — ztrácí kartu','btn-secondary', ()=>{
    const c = room.currentCard.color;
    if(nb.full[c]>0) nb.full[c]--;
    else if(nb.halves[c]>0) nb.halves[c]--;
    advanceTurn(room); saveAndRender();
  }));
}

/* ---------- MODRÁ KARTA: KVÍZOVÝ REŽIM (jen online) ---------- */

/* Krok 1 — hráč na tahu vymyslí 3 možnosti a označí tu pravdivou. */
function renderBlueCompose(s, room, mine){
  const card = room.currentCard;
  s.appendChild(qcardEl('blue', card.text));
  s.appendChild(el('div',{style:'height:18px'}));

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
    row.appendChild(el('input',{class:'card-input', placeholder:'Možnost '+(i+1), value:bc[k],
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
    state.secretCorrect = bc.correct;
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
  const voted = others.filter(p=> votes[p.id]!==undefined && votes[p.id]!==null);

  s.appendChild(qcardEl('blue', card.text));
  s.appendChild(el('div',{style:'height:18px'}));

  if(mine){
    s.appendChild(el('div',{class:'banner-info'},'Ostatní hádají. Hlasovalo ', el('b',{}, voted.length+' z '+others.length), '.'));
    s.appendChild(el('div',{style:'height:12px'}));
    const list = el('div',{class:'stack'});
    others.forEach(p=>{
      list.appendChild(el('div',{class:'guess-row'},
        el('span',{}, p.name),
        el('span',{class:'subtitle', style:'margin:0'}, voted.includes(p) ? 'hlasoval/a' : 'čeká se…')
      ));
    });
    s.appendChild(list);
    s.appendChild(el('div',{class:'spacer'}));
    s.appendChild(button('Vyhodnotit','btn-primary', ()=>{
      // teprve teď odhalíme správnou odpověď všem
      room.currentCard = Object.assign({}, card, {correct: state.secretCorrect});
      room.phase='blue-reveal';
      saveAndRender();
    }, voted.length < others.length));
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

  const pending = winners.filter(p=>!colors[p.id]);
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

    let winner = checkWin(ap) ? ap : room.players.find(p=>checkWin(p));
    if(winner){ room.phase='finished'; room.winnerId=winner.id; }
    else advanceTurn(room);
    room.votes = {};
    room.awardColors = {};
    saveAndRender();
  }, pending.length>0));
}

/* ---------- FINISHED ---------- */
function renderFinished(s, room){
  const winner = room.players.find(p=>p.id===room.winnerId);
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
