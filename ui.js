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
  s.appendChild(el('div',{class:'title-xl'},'Flow'));
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
function renderGame(s){
  const room = state.room;
  if(room.phase==='finished'){ renderFinished(s, room); return; }

  const ap = activePlayer(room);
  s.appendChild(el('div',{class:'turn-banner'}, 'Na tahu: ', el('b',{},ap.name)));
  s.appendChild(scoreRow(room));
  s.appendChild(el('div',{style:'height:18px'}));

  const mine = isMyTurnOrLocal(room);

  if(room.phase==='idle'){
    s.appendChild(el('div',{class:'center-col', style:'margin-top:10px'},
      el('div',{class:'die'}, el('div',{class:'dot', style:'background:'+diePreviewColor(room)})),
      mine ? button('Hodit kostkou','btn-primary', ()=>rollDice()) :
             el('div',{class:'subtitle'},'Čeká se na hod hráče ', el('b',{},ap.name))
    ));
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
  if(card.color==='blue'){
    s.appendChild(el('div',{class:'banner-info'},'Označ si v hlavě pravdivou odpověď. Ostatní teď hádají nahlas. Až domluvíte, pokračuj.'));
    s.appendChild(el('div',{style:'height:12px'}));
    s.appendChild(button('Pokračovat k hádání','btn-blue', ()=>{
      room.phase='guessing';
      state.guessSelections={}; state.guessColors={};
      saveAndRender();
    }));
  } else {
    s.appendChild(button('Hotovo, další na tahu','btn-primary', ()=>{
      advanceTurn(room);
      saveAndRender();
    }));
  }
}

function qcardEl(color, text){
  const bg = color==='red'?'red':color==='blue'?'blue':color==='chance'?'orange':'yellow';
  return el('div',{class:'qcard '+bg},
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
    others.forEach(p=>{
      if(state.guessSelections[p.id] && state.guessColors[p.id]){
        addHalf(p, state.guessColors[p.id]);
        if(checkWin(p)){ room.phase='finished'; room.winnerId=p.id; }
      }
    });
    if(room.phase!=='finished') advanceTurn(room);
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
  s.appendChild(el('div',{class:'subtitle',style:'text-align:center;margin-bottom:10px'},'Vyber hráče a barvu karty, kterou mu ukradneš:'));
  const targetSel = state.chanceUI.target || (others[0] && others[0].id);
  state.chanceUI.target = targetSel;
  const colSel = state.chanceUI.color || 'red';
  state.chanceUI.color = colSel;
  const sel = el('select',{class:'card-input', onchange:(e)=>{state.chanceUI.target=e.target.value; render();}});
  others.forEach(p=> sel.appendChild(el('option',{value:p.id, selected: p.id===targetSel?'selected':null}, p.name)));
  s.appendChild(sel);
  s.appendChild(el('div',{style:'height:10px'}));
  s.appendChild(el('div',{class:'color-pick'},
    ...['red','yellow','blue'].map(c=>el('button',{class:'color-dot-btn c-'+c+(colSel===c?' selected':''), onclick:()=>{state.chanceUI.color=c; render();}}))
  ));
  s.appendChild(el('div',{style:'height:14px'}));
  s.appendChild(button('Ukrást','btn-primary', ()=>{
    const target = room.players.find(p=>p.id===state.chanceUI.target);
    const c = state.chanceUI.color;
    if(target.full[c]>0){ target.full[c]--; ap.full[c]++; }
    else if(target.halves[c]>0){ target.halves[c]--; addHalf(ap,c); }
    else { alert(target.name+' nemá žádnou kartu této barvy.'); return; }
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
