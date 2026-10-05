(window.FLOU_FILES = window.FLOU_FILES || {})['ui.js'] = '37';   /* verze souboru — kontrola, že jsou na webu všechny soubory stejné verze */
/* ============================================================
   UI — DOM helpery a všechny render* funkce.
   Volá engine.js (herní pravidla), app.js (state, akce)
   a i18n.js (texty v češtině / angličtině: t(), tn()).
   Vzhled: „liquid glass" (viz style.css).
   ============================================================ */

function el(tag, attrs={}, ...children){
  const e=document.createElement(tag);
  for(const k in attrs){
    if(attrs[k]===null || attrs[k]===undefined || attrs[k]===false) continue;
    if(k==='class') e.className=attrs[k];
    else if(k==='html') e.innerHTML=attrs[k];
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  children.flat().forEach(c=>{
    if(c===null||c===undefined||c===false) return;
    if(typeof c==='string'||typeof c==='number') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}
function htmlToNode(html){
  const div=document.createElement('div'); div.innerHTML=html; return div.firstChild;
}
function gap(h){ return el('div',{class:'gap', style:'--h:'+h+'px'}); }
function button(label, cls, onClick, disabled=false){
  return el('button',{class:'btn '+cls, onclick:onClick, disabled: disabled?'disabled':null},label);
}
function b(text){ return el('b',{},text); }
const COLORS = ['red','yellow','blue'];
function colorBtnCls(c){ return c==='red' ? 'btn-red' : c==='blue' ? 'btn-blue' : c==='yellow' ? 'btn-yellow' : 'btn-primary'; }
function colorVar(c){
  return c==='red' ? 'var(--red)' : c==='blue' ? 'var(--blue)' : c==='yellow' ? 'var(--yellow)' : c==='chance' ? 'var(--orange)' : 'var(--navy-soft)';
}
function dots(){ return [el('span',{},'.'),el('span',{},'.'),el('span',{},'.')]; }
function waiting(...parts){
  return el('div',{class:'subtitle waiting-dots center-text'}, ...parts, dots());
}
function playerById(room, id){ return room.players.find(p=>p.id===id); }


/* ---------- DIALOGOVÁ OKNA VE STYLU HRY ----------
   Nahrazují systémové confirm()/alert(), které vypadají v každém systému
   jinak. uiConfirm vrací Promise<boolean>, uiAlert Promise (po „OK").
   Okno je mimo #app, takže ho překreslení hry nezavře. */
let dialogClose = null;
function showDialog({title, message, confirm, cancel, danger=false}){
  return new Promise(resolve=>{
    if(dialogClose) dialogClose(false);
    const prevFocus = document.activeElement;
    let closed = false;
    const done = (v)=>{
      if(closed) return; closed = true;
      dialogClose = null;
      document.removeEventListener('keydown', onKey, true);
      overlay.classList.add('closing');
      setTimeout(()=>overlay.remove(), 170);
      if(prevFocus && prevFocus.focus && document.body.contains(prevFocus)){ try{ prevFocus.focus({preventScroll:true}); }catch(e){} }
      resolve(v);
    };
    const okBtn = button(confirm || t('dlg_ok'), danger ? 'btn-red' : 'btn-primary', ()=>done(true));
    const cancelBtn = cancel ? button(cancel, 'btn-glass', ()=>done(false)) : null;
    const box = el('div',{class:'dialog glass', role: cancel ? 'alertdialog' : 'dialog', 'aria-modal':'true',
        'aria-labelledby': title ? 'dlg-title' : null, 'aria-describedby': message ? 'dlg-msg' : null},
      title ? el('div',{class:'dialog-title', id:'dlg-title'}, title) : null,
      message ? el('div',{class:'dialog-msg', id:'dlg-msg'}, message) : null,
      el('div',{class:'dialog-actions'}, okBtn, cancelBtn)
    );
    const overlay = el('div',{class:'dialog-overlay', onclick:(e)=>{ if(e.target===overlay) done(cancel ? false : true); }}, box);
    // Esc = zrušit, Tab zůstává uvnitř okna
    const onKey = (e)=>{
      if(e.key==='Escape'){ e.preventDefault(); done(cancel ? false : true); }
      else if(e.key==='Tab'){
        const f = [...box.querySelectorAll('button')];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    dialogClose = done;
    document.body.appendChild(overlay);
    // u nevratné akce má fokus bezpečná volba (Zrušit)
    setTimeout(()=>{ try{ ((danger && cancelBtn) || okBtn).focus({preventScroll:true}); }catch(e){} }, 30);
  });
}
function uiConfirm(opts){ return showDialog(opts); }
function uiAlert(message, title){ return showDialog({title, message, confirm: t('dlg_ok')}); }

/* ---------- RENDER ---------- */
/* Klíč „kroku" hry: když se změní, jde o novou obrazovku nebo nový krok
   (jiná fáze, jiný hráč na řadě, předání zařízení, další krok u modré…). */
function viewKey(){
  const r = state.room;
  const parts = [state.screen];
  if(r){
    parts.push(r.phase, r.turnIndex, r.finalDone ? 'F' : '',
      r.currentCard ? (r.currentCard.type+r.currentCard.idx) : '',
      r.round ? r.round.current : '', r.blueTurn ? r.blueTurn.current : '');
  }
  parts.push(state.handoff||'', state.blueCompose ? state.blueCompose.step : '', state.solo ? state.solo.pos : '');
  return parts.join('|');
}
function scrollToTop(){
  if(window.scrollY === 0 && document.documentElement.scrollTop === 0) return;
  try{ window.scrollTo({top:0, left:0, behavior:'instant'}); }
  catch(e){ window.scrollTo(0,0); }
}

const raf = (typeof requestAnimationFrame==='function') ? requestAnimationFrame : (f=>setTimeout(f,16));
let lastViewKey = null;

function render(){
  const app = document.getElementById('app');
  // Překreslení by jinak hráči vzalo kurzor z rozepsaného pole.
  const ae = document.activeElement;
  const focusKey = ae && ae.getAttribute ? ae.getAttribute('data-fk') : null;
  const selStart = focusKey && typeof ae.selectionStart==='number' ? ae.selectionStart : null;
  const selEnd   = focusKey && typeof ae.selectionEnd==='number' ? ae.selectionEnd : null;

  trackHintCard();
  // Animace vstupu jen při změně obrazovky / fáze, ne při každém překreslení.
  const room = state.room;
  const animate = viewKey() !== lastViewKey;
  lastViewKey = viewKey();

  const frag = document.createDocumentFragment();
  const isHome = state.screen==='home';
  if(isHome){ const hero = homeHero(); if(animate) hero.classList.add('hero-anim'); frag.appendChild(hero); }
  else frag.appendChild(topBar());

  const screen = el('div',{class:'screen'+(isHome?' screen-sea':'')+(animate?' anim':'')});
  frag.appendChild(screen);
  const renderers = {
    home: renderHome,
    setupLocal: renderSetupLocal,
    setupHost: renderSetupHost,
    joinRoom: renderJoinRoom,
    lobby: renderLobby,
    game: renderGame,
    solo: renderSolo,
  };
  (renderers[state.screen]||renderHome)(screen);

  const srcCard = app.querySelector('.qcard');
  flySourceRect = srcCard ? srcCard.getBoundingClientRect() : null;
  app.replaceChildren(frag);
  // Nový krok hry vždy začíná nahoře — jinak by stránka (hlavně na iPhonu,
  // třeba po zavření klávesnice) mohla zůstat odrolovaná uprostřed.
  if(animate) scrollToTop();

  if(focusKey){
    const again = app.querySelector('[data-fk="'+focusKey+'"]');
    if(again){
      again.focus();
      if(selStart!==null && again.setSelectionRange){
        try{ again.setSelectionRange(selStart, selEnd); }catch(e){}
      }
    }
  }
  fitToScreen();
  scheduleScrollHint();
  playScreenSounds();
  detectCardGains();
}

/* ---------- KARTA PŘILÉTÁ K HRÁČI ----------
   Po každé změně se porovná skóre s předchozím. Kdo získal kartu (celou
   nebo půlku), tomu k jeho kartičce se skóre přiletí malá karta té barvy —
   od karty, která byla na stole (jinak od středu obrazovky).
   Animuje se jen transform/opacity (grafický čip), takže hru nezpomalí. */
let lastScore = null, lastScoreKey = null, flySourceRect = null;
function scoreSnapshot(room){
  const m = {};
  room.players.forEach(p=>{ m[p.id] = {full:Object.assign({},p.full), halves:Object.assign({},p.halves)}; });
  return m;
}
function detectCardGains(){
  const r = state.room;
  if(state.screen!=='game' || !r || !r.players){ lastScore = null; lastScoreKey = null; return; }
  const key = (r.code||'local') + '|' + r.players.map(p=>p.id).join(',');
  const now = scoreSnapshot(r);
  const prev = lastScore;
  const skip = lastScoreKey!==key || !prev || state.suppressFly;
  lastScore = now; lastScoreKey = key; state.suppressFly = false;
  if(skip) return;
  const gains = [];
  r.players.forEach(p=>{
    const a = prev[p.id]; if(!a) return;
    COLORS.forEach(c=>{
      const df = p.full[c] - a.full[c], dh = p.halves[c] - a.halves[c];
      if(df > 0) for(let i=0;i<df;i++) gains.push({pid:p.id, color:c, half:false});
      else if(dh > 0) gains.push({pid:p.id, color:c, half:true});
    });
  });
  const src = flySourceRect;
  gains.slice(0,6).forEach((g,i)=> setTimeout(()=>flyCard(g, src), i*150));
}
function flyCard(g, src){
  const chip = document.querySelector('.score-chip[data-pid="'+g.pid+'"]');
  const target = chip && (chip.querySelector('.score-color[data-color="'+g.color+'"]') || chip);
  Sound.collect();
  if(!target) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pulse = ()=>{
    chip.style.setProperty('--gc', colorVar(g.color));
    chip.classList.remove('got-card'); void chip.offsetWidth; chip.classList.add('got-card');
  };
  const tr = target.getBoundingClientRect();
  const fc = el('div',{class:'fly-card'+(g.half?' half':''), style:'--c:'+colorVar(g.color), 'aria-hidden':'true'}, g.half ? '½' : '');
  if(reduced || typeof fc.animate!=='function' || !tr.width){ pulse(); return; }
  const W = 46, H = 34;
  const sx = src ? src.left + src.width/2 : window.innerWidth/2;
  const sy = src ? src.top + src.height/2 : window.innerHeight*0.45;
  const ex = tr.left + tr.width/2, ey = tr.top + tr.height/2;
  fc.style.left = (sx - W/2)+'px';
  fc.style.top = (sy - H/2)+'px';
  document.body.appendChild(fc);
  const dx = ex - sx, dy = ey - sy;
  const lift = Math.min(90, Math.abs(dy)*0.35 + 30);   // let obloukem
  const anim = fc.animate([
    {transform:'translate(0,0) scale(1.35) rotate(-10deg)', opacity:0},
    {transform:'translate(0,0) scale(1.3) rotate(-6deg)', opacity:1, offset:0.12},
    {transform:'translate('+(dx*0.45)+'px,'+(dy*0.45 - lift)+'px) scale(1) rotate(8deg)', opacity:1, offset:0.55},
    {transform:'translate('+dx+'px,'+dy+'px) scale(.45) rotate(0deg)', opacity:.85}
  ], {duration:620, easing:'cubic-bezier(.4,.1,.3,1)', fill:'forwards'});
  const end = ()=>{ fc.remove(); pulse(); };
  anim.onfinish = end;
  setTimeout(()=>{ if(fc.isConnected) end(); }, 1200);   // pojistka
}

/* ---------- ZVUKY PODLE TOHO, CO SE OBJEVILO ----------
   Nová karta na stole -> zvuk otočení karty; konec hry -> fanfára.
   Online to slyší všichni hráči, protože se to řídí stavem hry. */
let lastCardSoundKey = null, lastFanfareKey = null;
function cardSoundKey(){
  if(state.screen==='solo' && state.solo){
    const c = state.solo.history[state.solo.pos];
    return c ? 'solo|'+state.solo.pos+'|'+c.color+c.idx : null;
  }
  const r = state.room;
  if(state.screen!=='game' || !r || !r.currentCard) return null;
  const c = r.currentCard;
  // u modré se karta „otočí" i při odhalení pravdivé odpovědi
  return [r.turnIndex, c.type, c.color||'', c.idx, r.phase==='blue-reveal' ? 'R' : ''].join('|');
}
function playScreenSounds(){
  const r = state.room;
  const ck = cardSoundKey();
  if(ck && ck!==lastCardSoundKey) Sound.flip();
  lastCardSoundKey = ck;
  const fk = (state.screen==='game' && r && r.phase==='finished') ? 'win|'+r.winnerId : null;
  if(fk && fk!==lastFanfareKey) Sound.fanfare();
  lastFanfareKey = fk;
}

/* Ťuknutí při stisku tlačítek (kromě kostky a zvuku, ty mají vlastní). */
document.addEventListener('click', (e)=>{
  const btn = e.target.closest && e.target.closest('button');
  if(!btn || btn.disabled || btn.classList.contains('bar-sound')) return;
  Sound.click();
}, true);

/* ---------- PŘIZPŮSOBENÍ OBRAZOVCE ----------
   Když se obsah nevejde na displej, postupně se zhušťuje (menší karta,
   mezery, kostky, tlačítka) — fit-1, pak fit-2. Většinou se tak vše vejde
   bez rolování. Když ani to nestačí (např. hodně hráčů a dlouhá otázka),
   zůstane rolování s šipkou „Další možnosti níže". */
const FIT_LEVELS = ['fit-1','fit-2'];
/* Nevejde se? Rozhoduje, kde končí poslední prvek obsahu (ne výška stránky,
   ta se kvůli zaokrouhlení zlomků pixelu může lišit o 1 px). */
function overflowsScreen(){
  const sc = document.querySelector('#app .screen');
  const last = sc && sc.lastElementChild;
  if(!last) return false;
  const pb = parseFloat(getComputedStyle(sc).paddingBottom) || 0;
  // offsetTop nezávisí na právě běžící animaci (posunu) obrazovky
  let y = 0, e = last;
  while(e){ y += e.offsetTop; e = e.offsetParent; }
  return y + last.offsetHeight + pb > window.innerHeight + 2;
}
function fitToScreen(){
  const app = document.getElementById('app');
  if(!app || !window.innerHeight) return;
  app.classList.remove(...FIT_LEVELS);
  for(const lvl of FIT_LEVELS){
    if(!overflowsScreen()) break;
    app.classList.add(lvl);
  }
}
let fitQueued = false;
window.addEventListener('resize', ()=>{
  if(fitQueued) return;
  fitQueued = true;
  raf(()=>{ fitQueued = false; fitToScreen(); scheduleScrollHint(); });
}, {passive:true});

/* ---------- PŘEPÍNAČ JAZYKA (vlajky) ---------- */
/* Jazyk patří zařízení, ne hře: přepnout jde kdykoli, i uprostřed tahu.
   Online si každý hráč volí jazyk na svém zařízení — karty se mu ukážou
   v jeho jazyce, protože se po síti posílá jen číslo karty. */
const FLAG_SVG = {
  cs: '<svg viewBox="0 0 6 4" aria-hidden="true"><rect width="6" height="2" fill="#fff"/><rect y="2" width="6" height="2" fill="#D7141A"/><path d="M0,0 L3,2 L0,4 Z" fill="#11457E"/></svg>',
  en: '<svg viewBox="0 0 60 30" aria-hidden="true"><clipPath id="ukc"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#ukc)" stroke="#C8102E" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>'
};
let langSwitchTimer = null;
function langSwitch(extraCls=''){
  /* Přepínač jako v iOS: obě vlajky v jedné skleněné bublině,
     aktivní jazyk má pod sebou světlou „kapku", která se při přepnutí posune. */
  const sw = el('div',{class:'lang-switch '+(extraCls==='in-pill' ? '' : 'glass ')+extraCls, role:'group', 'aria-label':t('lang_label'), 'data-active':LANG},
    el('span',{class:'lang-thumb','aria-hidden':'true'}),
    ...['cs','en'].map(l=>el('button',{
      class:'lang-btn'+(LANG===l?' active':''),
      'aria-pressed': LANG===l ? 'true' : 'false',
      'aria-label': l==='cs' ? 'Čeština' : 'English',
      title: l==='cs' ? 'Čeština' : 'English',
      html: FLAG_SVG[l],
      onclick:(e)=>{
        if(sw.getAttribute('data-active')===l) return;
        // nejdřív se posune kapka, pak se přepne jazyk (platí poslední klepnutí)
        sw.setAttribute('data-active', l);
        sw.querySelectorAll('.lang-btn').forEach(btn=>btn.classList.toggle('active', btn===e.currentTarget));
        clearTimeout(langSwitchTimer);
        langSwitchTimer = setTimeout(()=>{ if(LANG!==l){ setLang(l); render(); } }, 220);
      }
    }))
  );
  return sw;
}

/* ---------- HORNÍ LIŠTA (jako navigační lišta v iOS) ----------
   Vlevo kulaté skleněné tlačítko se šipkou zpět (ve hře = krok zpět),
   uprostřed titulek (ve hře: kdo je na tahu), vpravo jazyk a ukončení.
   Informace o tahu je přímo v liště, takže ji nic nepřekrývá. */
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5 7.5 12 15 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
/* ---------- VELIKOST PÍSMA (jako „Velikost textu" v iOS) ----------
   Pět stupňů; mění se jen písmo (CSS proměnná --fs), rozložení hry zůstává.
   Volba se pamatuje pro dané zařízení. */
const TEXT_SIZES = [0.9, 1, 1.12, 1.25, 1.4];
const TS_KEY = 'flou_textsize';
let textSizeIdx = (()=>{
  try{ const v = parseInt(localStorage.getItem(TS_KEY), 10); if(v>=0 && v<TEXT_SIZES.length) return v; }catch(e){}
  return 1;
})();
function applyTextSize(){
  document.documentElement.style.setProperty('--fs', String(TEXT_SIZES[textSizeIdx]));
}
applyTextSize();
function setTextSize(i){
  const ni = Math.max(0, Math.min(TEXT_SIZES.length-1, i));
  if(ni===textSizeIdx) return;
  textSizeIdx = ni;
  try{ localStorage.setItem(TS_KEY, String(ni)); }catch(e){}
  applyTextSize();
  fitToScreen();
  scheduleScrollHint();
}


/* ---------- NASTAVENÍ (jedno tlačítko, panel jako v iOS) ----------
   Jazyk, zvuky a velikost písma jsou v jednom skleněném panelu, aby
   lišta zůstala čistá. Panel je mimo #app — překreslení hry ho nezavře. */
const ICON_SETTINGS = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h8.6M17.4 7H20M4 17h2.6M11.4 17H20"/></g><circle cx="15" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
/* ---------- NOČNÍ REŽIM ---------- */
const THEME_KEY = 'flou_theme';
function currentTheme(){ return document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light'; }
function setTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem(THEME_KEY, t); }catch(e){}
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content', t==='dark' ? '#0F1524' : '#E9502E');
}
// bez ruční volby sleduje režim zařízení i za běhu
try{
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if(mq && mq.addEventListener) mq.addEventListener('change', (e)=>{
    let saved = null; try{ saved = localStorage.getItem(THEME_KEY); }catch(_){}
    if(saved!=='dark' && saved!=='light') document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  });
}catch(e){}

let setClose = null, doneBtnRef = null;
const CC_ICONS = {
  soundOn:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9.6h2.6L12 6v12l-4.4-3.6H5a1 1 0 0 1-1-1v-2.8a1 1 0 0 1 1-1z" fill="currentColor"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.8a7.4 7.4 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9.6h2.6L12 6v12l-4.4-3.6H5a1 1 0 0 1-1-1v-2.8a1 1 0 0 1 1-1z" fill="currentColor"/><path d="M16 10l4 4M20 10l-4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  moon:     '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a.6.6 0 0 0-.8-.7A8.6 8.6 0 1 0 20.2 15.4a.6.6 0 0 0-.7-.8z" fill="currentColor"/></svg>',
  globe:    '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z"/></g></svg>',
  // „AA" pro velikost písma — geometricky vycentrované
  textSize: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 19 6.1 10.5 9.6 19M3.9 16h4.4"/><path d="M10.4 19 15.6 5 20.8 19M12.3 14.4h6.6"/></g></svg>'
};
/* Nastavení jako ovládací centrum v iOS: dlaždice v mřížce nad rozostřenou hrou. */
function openSettings(anchor){
  if(setClose){ setClose(); return; }
  const prevFocus = document.activeElement;
  const n = TEXT_SIZES.length;
  const grid = el('div',{class:'cc', role:'dialog', 'aria-modal':'true'});

  // --- svislý posuvník velikosti písma (jako jas / hlasitost) ---
  const fillEl = el('div',{class:'cc-fill'});
  const pctEl = el('div',{class:'cc-pct'});
  const slider = el('div',{class:'cc-tile cc-slider', role:'slider', tabindex:'0',
      'aria-valuemin':'0', 'aria-valuemax':String(n-1)},
    pctEl, fillEl,
    // značky přesně na hranicích stupňů (výplň má výšku (stupeň+1)/n)
    el('div',{class:'cc-ticks','aria-hidden':'true'}, ...TEXT_SIZES.slice(1).map((_,i)=>el('span',{style:'bottom:'+((i+1)/n*100)+'%'}))),
    el('div',{class:'cc-slider-icon', html:CC_ICONS.textSize}));
  const updSize = ()=>{
    const frac = (textSizeIdx+1)/n;
    fillEl.style.height = (frac*100)+'%';
    const pct = Math.round(TEXT_SIZES[textSizeIdx]*100)+' %';
    pctEl.textContent = pct;
    slider.setAttribute('aria-valuenow', String(textSizeIdx));
    slider.setAttribute('aria-valuetext', pct);
    slider.setAttribute('aria-label', t('text_size'));
  };
  const setFromY = (clientY)=>{
    const r = slider.getBoundingClientRect();
    const frac = 1 - (clientY - r.top) / r.height;            // 0 dole … 1 nahoře
    const idx = Math.round(Math.max(0, Math.min(1, frac)) * n - 0.5);
    setTextSize(Math.max(0, Math.min(n-1, idx)));
    updSize();
  };
  let dragging = false;
  // „náhled": při změně písma zmizí rozmazání a ostatní dlaždice se zprůhlední,
  // aby byla vidět hra a jak se v ní mění text
  let peekTimer = null;
  const peek = (on, holdMs)=>{
    clearTimeout(peekTimer);
    overlay.classList.toggle('peek', on);
    if(on && holdMs) peekTimer = setTimeout(()=>overlay.classList.remove('peek'), holdMs);
  };
  slider.addEventListener('pointerdown', (e)=>{ dragging = true; slider.classList.add('active'); peek(true); try{ slider.setPointerCapture(e.pointerId); }catch(_){} setFromY(e.clientY); e.preventDefault(); });
  slider.addEventListener('pointermove', (e)=>{ if(dragging) setFromY(e.clientY); });
  const endDrag = ()=>{ dragging = false; slider.classList.remove('active'); peek(false); };
  slider.addEventListener('pointerup', endDrag);
  slider.addEventListener('pointercancel', endDrag);
  slider.addEventListener('keydown', (e)=>{
    if(e.key==='ArrowUp' || e.key==='ArrowRight'){ setTextSize(textSizeIdx+1); updSize(); peek(true, 450); e.preventDefault(); }
    if(e.key==='ArrowDown' || e.key==='ArrowLeft'){ setTextSize(textSizeIdx-1); updSize(); peek(true, 450); e.preventDefault(); }
  });

  // --- dlaždice zvuků a jazyka (sestaví se znovu po změně) ---
  const soundTile = el('button',{class:'cc-tile cc-wide cc-sound bar-sound'});
  const langTile = el('div',{class:'cc-tile cc-wide cc-lang', role:'group'});
  const darkTile = el('button',{class:'cc-tile cc-wide cc-dark'});
  const fill = ()=>{
    const on = Sound.isEnabled();
    grid.setAttribute('aria-label', t('settings'));
    soundTile.className = 'cc-tile cc-wide cc-sound bar-sound'+(on?' on':'');
    soundTile.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundTile.replaceChildren(
      el('span',{class:'cc-circle', html: on ? CC_ICONS.soundOn : CC_ICONS.soundOff}),
      el('span',{class:'cc-text'},
        el('span',{class:'cc-name'}, t('sound_title')),
        el('span',{class:'cc-state'}, t(on ? 'state_on' : 'state_off')))
    );
    if(typeof doneBtnRef!=='undefined' && doneBtnRef) doneBtnRef.textContent = t('done');
    const dark = currentTheme()==='dark';
    darkTile.className = 'cc-tile cc-wide cc-dark'+(dark?' on':'');
    darkTile.setAttribute('aria-pressed', dark ? 'true' : 'false');
    darkTile.replaceChildren(
      el('span',{class:'cc-circle', html:CC_ICONS.moon}),
      el('span',{class:'cc-text'},
        el('span',{class:'cc-name'}, t('dark_title')),
        el('span',{class:'cc-state'}, t(dark ? 'state_on' : 'state_off')))
    );
    langTile.setAttribute('aria-label', t('lang_label'));
    langTile.replaceChildren(
      el('span',{class:'cc-text'},
        el('span',{class:'cc-name cc-name-icon'}, el('span',{class:'cc-mini-ico', html:CC_ICONS.globe}), t('lang_label')),
        el('span',{class:'cc-state'}, LANG==='cs' ? 'Čeština' : 'English')),
      el('span',{class:'cc-flags'},
        ...['cs','en'].map(l=>el('button',{class:'cc-flag'+(LANG===l?' active':''), 'aria-pressed':LANG===l?'true':'false',
          'aria-label': l==='cs' ? 'Čeština' : 'English', title: l==='cs' ? 'Čeština' : 'English', html: FLAG_SVG[l],
          onclick:()=>{ if(LANG!==l){ setLang(l); render(); fill(); updSize(); } }})))
    );
  };
  darkTile.addEventListener('click', ()=>{ setTheme(currentTheme()==='dark' ? 'light' : 'dark'); fill(); });
  soundTile.addEventListener('click', ()=>{ Sound.setEnabled(!Sound.isEnabled()); if(Sound.isEnabled()) Sound.click(); fill(); });

  const doneBtn = el('button',{class:'cc-done', onclick:()=>close()});
  doneBtnRef = doneBtn;
  grid.append(soundTile, slider, darkTile, langTile);
  const wrap = el('div',{class:'cc-wrap'}, grid, doneBtn);
  const overlay = el('div',{class:'cc-overlay', onclick:(e)=>{ if(e.target===overlay) close(); }}, wrap);

  const onKey = (e)=>{ if(e.key==='Escape'){ e.preventDefault(); close(); } };
  const close = ()=>{
    if(!setClose) return;
    setClose = null;
    document.removeEventListener('keydown', onKey, true);
    overlay.classList.add('closing');
    setTimeout(()=>overlay.remove(), 130);
    if(prevFocus && prevFocus.focus && document.body.contains(prevFocus)){ try{ prevFocus.focus({preventScroll:true}); }catch(e){} }
  };
  const r = anchor.getBoundingClientRect();
  wrap.style.top = Math.round(r.bottom + 12)+'px';
  // zarovnat k pravému okraji hry (na notebooku je hra uprostřed obrazovky)
  const appR = (document.getElementById('app') || document.body).getBoundingClientRect();
  wrap.style.right = Math.max(12, Math.round(window.innerWidth - appR.right + 12))+'px';
  fill(); updSize();
  doneBtn.textContent = t('done');
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey, true);
  setClose = close;
  setTimeout(()=>{ try{ soundTile.focus({preventScroll:true}); }catch(e){} }, 40);
}
function settingsBtn(extraCls=''){
  const b = circleBtn(ICON_SETTINGS, t('settings'), (e)=>openSettings(e.currentTarget), 'settings-btn '+extraCls);
  b.setAttribute('aria-haspopup','dialog');
  return b;
}

function circleBtn(iconSvg, label, onClick, cls=''){
  return el('button',{class:'glass-circle glass '+cls, onclick:onClick, 'aria-label':label, title:label, html:iconSvg});
}
function miniLogo(){
  return htmlToNode(`<div class="bar-logo" aria-hidden="true"><span style="color:var(--red)">F</span><span style="color:var(--yellow)">L</span><span style="color:var(--blue)">O</span><span style="color:var(--orange)">U</span></div>`);
}
function topBar(){
  let left = null, right = [], title = null;
  const sc = state.screen;
  const room = state.room;
  if(sc==='setupLocal' || sc==='setupHost' || sc==='joinRoom'){
    left = circleBtn(ICON_CHEVRON, t('bar_back'), ()=>{ state.screen='home'; render(); });
  } else if(sc==='lobby'){
    left = circleBtn(ICON_CHEVRON, t('bar_leave'), ()=>{
      uiConfirm({title:t('dlg_leave_room_title'), message:t('confirm_leave_room'), confirm:t('bar_leave'), cancel:t('dlg_stay'), danger:true})
        .then(ok=>{ if(ok) leaveOnlineRoom(); });
    });
  } else if(sc==='game'){
    if(canUndo(room)) left = circleBtn(ICON_CHEVRON, t('bar_undo'), ()=>{ undoStep(); }, 'bar-undo');
    right.push(circleBtn(ICON_CLOSE, t('bar_exit_game'), confirmExitGame, 'bar-exit'));
    if(room && room.phase!=='finished'){
      const ap = activePlayer(room);
      title = el('div',{class:'bar-title glass', role:'status'},
        el('span',{class:'bar-title-label'}, t('turn_label')),
        el('span',{class:'bar-title-name'}, ap.name + (ap.id===state.myPlayerId ? ' ('+t('you')+')' : ''))
      );
    }
  } else if(sc==='solo'){
    right.push(circleBtn(ICON_CLOSE, t('bar_exit'), ()=>{ resetAppState(); render(); }, 'bar-exit'));
  }
  return el('div',{class:'topbar'},
    el('div',{class:'bar-side bar-left'}, left),
    el('div',{class:'bar-center'}, title || miniLogo()),
    el('div',{class:'bar-side bar-right'}, settingsBtn(), ...right)
  );
}

/* Potvrzení odchodu z rozehrané hry. */
function confirmExitGame(){
  const online = Store.mode==='online';
  uiConfirm({title:t('dlg_exit_title'), message:t(online ? 'confirm_exit_online' : 'confirm_exit_local'),
    confirm:t('bar_exit_game'), cancel:t('dlg_continue_game'), danger:true}).then(ok=>{
    if(!ok) return;
    if(online){ leaveOnlineRoom(); }
    else { resetAppState(); render(); }
  });
}

/* ---------- NÁPOVĚDA „ROLUJ NÍŽ" ---------- */
/* Když se obsah nevejde na displej, dole se ukáže šipka,
   že níže jsou další možnosti. Klepnutím se stránka posune. */
let hintEl = null, hintLabel = null, hintQueued = false;
function ensureScrollHint(){
  if(hintEl) return;
  hintLabel = el('span',{});
  hintEl = el('button',{class:'scroll-hint glass', onclick:()=>{
    window.scrollBy({top: Math.round(window.innerHeight*0.6), behavior:'smooth'});
  }},
    el('span',{class:'scroll-hint-arrow','aria-hidden':'true'},'↓'),
    hintLabel
  );
  document.body.appendChild(hintEl);
  window.addEventListener('scroll', scheduleScrollHint, {passive:true});
  window.addEventListener('resize', scheduleScrollHint, {passive:true});
}
/* Kolik pixelů skutečného obsahu je schované pod spodním okrajem displeje.
   Prázdné odsazení a mezery se nepočítají — šipka se tak neukáže, když
   pod ní už nic není. */
function hiddenContentBelow(){
  const sc = document.querySelector('#app .screen');
  if(!sc) return 0;
  let el = sc.lastElementChild;
  while(el && (el.classList.contains('gap') || el.classList.contains('spacer') || el.offsetHeight===0)){
    el = el.previousElementSibling;
  }
  if(!el) return 0;
  return el.getBoundingClientRect().bottom - window.innerHeight;
}
function scheduleScrollHint(){
  ensureScrollHint();
  hintLabel.textContent = t('scroll_more');
  hintEl.setAttribute('aria-label', t('scroll_more_aria'));
  if(hintQueued) return;
  hintQueued = true;
  raf(()=>{
    hintQueued = false;
    hintEl.classList.toggle('show', hiddenContentBelow() > 16);
  });
}

/* ---------- HOME ---------- */

/* Úvodní hlavička: západ slunce nad názvem, moře pod ním.
   Vpravo nahoře přepínač jazyka. */
function homeHero(){
  const sunset = `<svg class="hero-waves" viewBox="0 0 520 92" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L520,0 L520,22 C480,30 430,45 350,32 C230,12 120,52 0,30 Z" fill="var(--red)"/>
    <path d="M0,30 C120,52 230,12 350,32 C430,45 480,30 520,22 L520,44 C480,52 430,67 350,54 C230,34 120,74 0,52 Z" fill="var(--orange)"/>
    <path d="M0,52 C120,74 230,34 350,54 C430,67 480,52 520,44 L520,64 C480,70 430,84 350,74 C230,56 120,88 0,72 Z" fill="var(--yellow)"/>
  </svg>`;
  const sea = `<svg class="hero-waves" viewBox="0 0 520 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,10 C110,-16 210,34 320,14 C410,-2 470,24 520,10 L520,60 L0,60 Z" fill="var(--blue-light)"/>
    <path d="M0,30 C120,6 220,52 330,32 C415,17 475,40 520,28 L520,60 L0,60 Z" fill="var(--blue)"/>
  </svg>`;
  const miniCard = (color, rot) => `<svg class="hero-card" style="transform:rotate(${rot}deg)" viewBox="0 0 64 46" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="62" height="44" rx="9" fill="${color}"/>
    <path d="M1,16 C20,4 42,22 63,12 L63,1 L1,1 Z" fill="#FFFFFF" opacity=".93"/>
  </svg>`;
  return el('div',{class:'hero'},
    settingsBtn('settings-hero'),
    htmlToNode(`<div class="hero-band">${sunset}</div>`),
    htmlToNode(`<div class="hero-middle">
        ${miniCard('var(--red)', -10)}
        <div class="hero-titleblock">
          <div class="hero-title">
            <span style="color:var(--red)">F</span><span style="color:var(--yellow)">L</span><span style="color:var(--blue)">O</span><span style="color:var(--orange)">U</span>
          </div>
          <div class="hero-sub">${t('tagline')}</div>
        </div>
        ${miniCard('var(--yellow)', 9)}
      </div>`),
    htmlToNode(`<div class="hero-band hero-band-sea">${sea}</div>`)
  );
}


function renderHome(s){
  s.appendChild(el('div',{class:'stack'},
    button(t('home_local'),'btn-glass btn-home tone-red',()=>{state.screen='setupLocal'; state.setupNames=['','']; render();}),
    button(t('home_create'),'btn-glass btn-home tone-yellow',()=>{state.myName=''; state.screen='setupHost'; render();}),
    button(t('home_join'),'btn-glass btn-home tone-blue',()=>{state.joinCode=''; state.myName=''; state.screen='joinRoom'; render();}),
    button(t('home_solo'),'btn-glass btn-home tone-orange',()=>{ startSolo(); }),
  ));

  const open = !!state.rulesOpen;
  s.appendChild(el('div',{class:'rules'},
    el('button',{class:'rules-toggle'+(open?' open':''), onclick:()=>{
      state.rulesOpen = !state.rulesOpen; render();
    }},
      el('span',{}, t('rules_toggle')),
      el('span',{class:'rules-chevron'},'⌄')
    ),
    open ? el('div',{class:'rules-body glass'},
      rulesStep('var(--navy-soft)','1', t('r1_t'), t('r1_x')),
      rulesStep('var(--red)','2', t('r2_t'), t('r2_x')),
      rulesStep('var(--blue)','3', t('r3_t'), t('r3_x')),
      rulesStep('var(--yellow)','4', t('r4_t'), t('r4_x')),
      rulesStep('var(--orange)','5', t('r5_t'), t('r5_x')),
      rulesStep('var(--navy)','6', t('r6_t'), t('r6_x'))
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

/* ---------- LOCAL SETUP ---------- */
function renderSetupLocal(s){
  s.appendChild(el('div',{class:'title-lg'}, t('setup_title')));
  s.appendChild(el('div',{class:'subtitle'}, t('setup_sub')));
  s.appendChild(gap(16));
  const list = el('div',{class:'stack'});
  const inputs = [];
  // Stejná jména (např. dvakrát Lucka) se zvýrazní a „Začít hru" se zablokuje.
  const refreshDup = ()=>{
    const dup = duplicateAnswerIdx(state.setupNames);
    inputs.forEach((inp,i)=>inp.classList.toggle('dup', dup.has(i)));
    warn.hidden = dup.size===0;
    startBtn.disabled = dup.size>0;
  };
  state.setupNames.forEach((name,i)=>{
    const row = el('div',{class:'row'});
    const inp = el('input',{class:'card-input', 'data-fk':'setup-'+i, placeholder:t('setup_ph', i+1), value:name, maxlength:'24',
      oninput:(e)=>{ state.setupNames[i]=e.target.value; refreshDup(); }});
    inputs.push(inp);
    row.appendChild(inp);
    if(state.setupNames.length>2){
      row.appendChild(el('button',{class:'remove-btn', 'aria-label':t('setup_remove'), onclick:()=>{state.setupNames.splice(i,1); render();}},'✕'));
    }
    list.appendChild(row);
  });
  const warn = el('div',{class:'dup-warn', role:'alert'}, t('setup_dup'));
  s.appendChild(list);
  s.appendChild(warn);
  s.appendChild(gap(10));
  if(state.setupNames.length < MAX_PLAYERS){
    s.appendChild(button(t('setup_add'),'btn-ghost',()=>{ if(state.setupNames.length < MAX_PLAYERS){ state.setupNames.push(''); render(); } }));
  } else {
    s.appendChild(el('div',{class:'subtitle center-text max-note'}, t('setup_max', MAX_PLAYERS)));
  }
  s.appendChild(el('div',{class:'spacer'}));
  const startBtn = button(t('setup_start'),'btn-primary',()=>{
    const names = state.setupNames.map(n=>n.trim()).filter(Boolean);
    if(duplicateAnswerIdx(names).size){ refreshDup(); return; }
    if(names.length<2){ uiAlert(t('setup_min2')); return; }
    try{ startLocalGame(names); }
    catch(e){ console.error(e); showRuntimeError((e && e.message) || String(e)); }
  });
  s.appendChild(startBtn);
  refreshDup();
}

/* ---------- ONLINE HOST SETUP ---------- */
function renderSetupHost(s){
  s.appendChild(el('div',{class:'title-lg'}, t('host_title')));
  s.appendChild(el('div',{class:'subtitle'}, t('host_sub')));
  s.appendChild(gap(16));
  s.appendChild(el('input',{class:'card-input', 'data-fk':'host-name', placeholder:t('your_name'), value:state.myName, maxlength:'24',
    oninput:(e)=>{state.myName=e.target.value;}}));
  s.appendChild(el('div',{class:'subtitle', style:'font-size:calc(13.5px * var(--fs))'}, t('lang_hint')));
  s.appendChild(el('div',{class:'spacer'}));
  s.appendChild(button(state.busy ? t('host_busy') : t('host_btn'),'btn-primary', ()=>{
    const name = state.myName.trim();
    if(!name){ uiAlert(t('err_name')); return; }
    hostCreateRoom(name);
  }, state.busy));
}

/* ---------- JOIN ROOM ---------- */
function renderJoinRoom(s){
  s.appendChild(el('div',{class:'title-lg'}, t('join_title')));
  s.appendChild(el('div',{class:'subtitle'}, t('join_sub')));
  s.appendChild(gap(16));
  s.appendChild(el('div',{class:'stack'},
    el('input',{class:'card-input code-input', 'data-fk':'join-code', placeholder:t('join_code_ph'), value:state.joinCode, maxlength:'8',
      oninput:(e)=>{state.joinCode=e.target.value.toUpperCase();}}),
    el('input',{class:'card-input', 'data-fk':'join-name', placeholder:t('your_name'), value:state.myName, maxlength:'24',
      oninput:(e)=>{state.myName=e.target.value;}}),
  ));
  s.appendChild(el('div',{class:'subtitle', style:'font-size:calc(13.5px * var(--fs))'}, t('lang_hint')));
  s.appendChild(el('div',{class:'spacer'}));
  s.appendChild(button(state.busy ? t('join_busy') : t('join_btn'),'btn-primary', ()=>{
    const code = state.joinCode.trim();
    const name = state.myName.trim();
    if(!code||!name){ uiAlert(t('err_code_name')); return; }
    playerJoinRoom(code, name);
  }, state.busy));
}

/* ---------- SDÍLENÍ KÓDU ---------- */
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
  const codeBtn = el('button',{class:'share-btn glass', onclick: async ()=>{
    const ok = await copyText(code);
    flashLabel(codeBtn, ok ? t('copied') : t('copy_fail'), t('copy_code'));
  }}, t('copy_code'));
  row.appendChild(codeBtn);

  const linkBtn = el('button',{class:'share-btn glass', onclick: async ()=>{
    const link = roomLink(code);
    if(navigator.share){
      try{
        await navigator.share({title:'FLOU', text:t('share_text'), url:link});
        return;
      }catch(e){ /* uživatel zrušil nebo není podporováno -> zkopírujeme */ }
    }
    const ok = await copyText(link);
    flashLabel(linkBtn, ok ? t('link_copied') : t('copy_fail'), t('share_link'));
  }}, t('share_link'));
  row.appendChild(linkBtn);
  return row;
}

function flashLabel(btn, temp, original){
  btn.textContent = temp;
  btn.classList.add('done');
  setTimeout(()=>{
    btn.textContent = original;
    btn.classList.remove('done');
  }, 1600);
}

/* ---------- LOBBY ---------- */
function renderLobby(s){
  const room = state.room;
  const n = room.players.length;
  s.appendChild(el('div',{class:'title-lg'}, t('lobby_title')));
  s.appendChild(gap(8));
  s.appendChild(el('div',{class:'code-display glass'}, room.code));
  s.appendChild(shareRow(room.code));
  s.appendChild(gap(18));
  s.appendChild(el('div',{class:'title-md'}, t('lobby_players', n+' / '+MAX_PLAYERS)));
  s.appendChild(gap(8));
  const list = el('div',{class:'stack stack-tight'});
  room.players.forEach(p=>{
    list.appendChild(el('div',{class:'player-chip glass'},
      el('span',{class:'name'}, p.name),
      p.id===state.myPlayerId ? el('span',{class:'badge you'}, t('badge_you')) : (p.id===room.hostId ? el('span',{class:'badge host'}, t('badge_host')) : null)
    ));
  });
  s.appendChild(list);
  s.appendChild(el('div',{class:'spacer'}));
  if(amHost(room)){
    s.appendChild(button(t('lobby_start', playersWord(n)),'btn-primary', ()=>{
      hostStartGame();
    }, n<2 || n>MAX_PLAYERS));
    if(n>MAX_PLAYERS) s.appendChild(el('div',{class:'dup-warn', role:'alert'}, t('err_too_many', MAX_PLAYERS)));
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin-top:8px'}, t('lobby_share_hint')));
  } else {
    s.appendChild(el('div',{class:'center-col'}, waiting(t('lobby_wait'))));
  }
}

/* ============ GAME SCREEN ============ */
function renderGame(s){
  const room = state.room;
  if(room.phase==='finished'){ renderFinished(s, room); return; }

  const ap = activePlayer(room);
  s.appendChild(scoreRow(room));
  s.appendChild(gap(16));

  const mine = isMyTurnOrLocal(room);

  // Online: hráč na tahu odešel -> host ho může přeskočit, ať hra nestojí.
  if(Store.mode==='online' && ap.online===false && amHost(room) && ap.id!==state.myPlayerId){
    s.appendChild(el('div',{class:'banner-info glass'}, ...tn('is_offline', b(ap.name))));
    s.appendChild(gap(8));
    s.appendChild(button(t('skip_turn_btn', ap.name),'btn-glass', ()=>{
      uiConfirm({title:t('skip_turn_confirm', ap.name), message:t('dlg_skip_msg'), confirm:t('dlg_skip'), cancel:t('dlg_cancel')})
        .then(ok=>{ if(ok) hostSkipTurn(); });
    }));
    s.appendChild(gap(18));
  }

  if(room.phase==='idle'){ renderIdle(s, room, mine); return; }

  // Výsledek hodu vidí všichni, dokud se hraje daný tah.
  if(room.lastRoll) s.appendChild(rollSummary(room));

  const phases = {
    'rolled-question': renderQuestionPhase,
    'answer-round':    renderRound,
    'chance':          renderChancePhase,
    'right-neighbor':  renderRightNeighbor,
    'blue-compose':    renderBlueCompose,
    'blue-guessing':   renderBlueGuessing,
    'blue-reveal':     renderBlueReveal,
  };
  const fn = phases[room.phase];
  if(fn) fn(s, room, mine);
}

/* ---------- ZAČÁTEK TAHU: směna, hod, odchod hráče ---------- */
function renderIdle(s, room, mine){
  const ap = activePlayer(room);

  // Směna 2 karet za 1 jinou — jen když má hráč od jedné barvy aspoň 3 karty.
  if(mine){
    const panel = exchangePanel(room, ap);
    if(panel){ s.appendChild(panel); s.appendChild(gap(18)); }
  }

  const prev = room.lastRoll || [null,null];
  const die1 = el('div',{class:'die'}, el('div',{class:'dot', style:'background:'+colorVar(prev[0])}));
  const die2 = el('div',{class:'die'}, el('div',{class:'dot', style:'background:'+colorVar(prev[1])}));
  const col = el('div',{class:'center-col die-area'}, el('div',{class:'dice-pair'}, die1, die2));
  if(mine){
    const btn = button(t('roll_btn'),'btn-primary', ()=>{ animateRoll([die1, die2], btn); });
    col.appendChild(btn);
    if(noCardsYet()) col.appendChild(el('div',{class:'subtitle center-text'}, t('roll_hint')));
  } else {
    col.appendChild(el('div',{class:'subtitle'}, ...tn('roll_wait', b(ap.name))));
  }
  s.appendChild(col);

  // Jedno zařízení: někdo může hru opustit (jen když zůstanou aspoň 2).
  if(Store.mode==='local' && room.players.length>=3){
    s.appendChild(gap(26));
    if(!state.leaveOpen){
      s.appendChild(el('div',{class:'center-col'},
        el('button',{class:'soft-link', onclick:()=>{ state.leaveOpen=true; render(); }}, t('leave_q'))
      ));
    } else {
      const box = el('div',{class:'panel glass'},
        el('div',{class:'panel-title'}, t('leave_title')),
        el('div',{class:'subtitle', style:'margin-top:0'}, t('leave_sub'))
      );
      const list = el('div',{class:'stack stack-tight', style:'margin-top:12px'});
      room.players.forEach(p=>{
        list.appendChild(button(p.name,'btn-glass btn-sm', ()=>{
          uiConfirm({title:t('leave_confirm', p.name), message:t('leave_sub'), confirm:t('dlg_leave_game'), cancel:t('dlg_back'), danger:true})
            .then(ok=>{ if(ok) removeLocalPlayer(p.id); });
        }));
      });
      box.appendChild(list);
      box.appendChild(gap(8));
      box.appendChild(button(t('leave_cancel'),'btn-ghost', ()=>{ state.leaveOpen=false; render(); }));
      s.appendChild(box);
    }
  }
}

/* Výběr barvy: lesklé kuličky. */
function colorPicker(colors, selected, onPick){
  return el('div',{class:'color-pick'},
    ...colors.map(c=>el('button',{
      class:'color-dot-btn c-'+c+(selected===c?' selected':''),
      'aria-label':colorName(c), title:colorName(c),
      onclick:()=>onPick(c)
    }))
  );
}

function exchangePanel(room, ap){
  const gives = exchangeColors(ap);
  if(!gives.length) return null;
  const ui = state.exchangeUI;
  const box = el('div',{class:'panel glass panel-accent'});
  if(!ui){
    box.appendChild(el('div',{class:'panel-row'},
      el('div',{},
        el('div',{class:'panel-title'}, t('ex_title')),
        el('div',{class:'subtitle', style:'margin-top:2px'}, t('ex_sub'))
      ),
      button(t('ex_open'),'btn-glass btn-sm btn-auto', ()=>{
        state.exchangeUI = {give: gives.length===1 ? gives[0] : null, want:null};
        render();
      })
    ));
    return box;
  }
  box.appendChild(el('div',{class:'panel-title'}, t('ex_title')));
  box.appendChild(el('div',{class:'subtitle', style:'margin-top:2px'}, t('ex_give')));
  box.appendChild(colorPicker(gives, ui.give, c=>{ ui.give=c; if(ui.want===c) ui.want=null; render(); }));
  if(ui.give){
    box.appendChild(el('div',{class:'subtitle', style:'margin-top:12px'}, t('ex_want')));
    box.appendChild(colorPicker(COLORS.filter(c=>c!==ui.give), ui.want, c=>{ ui.want=c; render(); }));
  }
  box.appendChild(gap(14));
  box.appendChild(button(ui.give && ui.want ? t('ex_do', colorPl(ui.give), colorAcc(ui.want)) : t('ex_open'),'btn-primary', ()=>{
    turnExchange(ui.give, ui.want);
  }, !(ui.give && ui.want)));
  box.appendChild(button(t('ex_cancel'),'btn-ghost', ()=>{ state.exchangeUI=null; render(); }));
  return box;
}

/* Animace hodu: hráč hází dvakrát. Nejdřív dosedne první kostka,
   pak druhá — teprve potom se vyhodnotí výsledek a táhne karta. */
function animateRoll(dice, btnEl){
  if(state.rolling) return;
  state.rolling = true;

  const results = [pickDieColor(), pickDieColor()];
  const seq = ['red','blue','yellow'];
  const setDot = (d,c)=>{ const dot=d.firstChild; if(dot) dot.style.background = colorVar(c); };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(btnEl){ btnEl.disabled = true; btnEl.textContent = t('rolling'); }
  Sound.diceRoll(reduced ? 0.3 : 1.1);
  dice.forEach(d=>{ d.classList.remove('landed'); if(!reduced) d.classList.add('rolling'); });
  let i = 0;
  const spinning = [true, true];
  const spin = setInterval(()=>{
    dice.forEach((d,k)=>{ if(spinning[k]) setDot(d, seq[(i+k) % 3]); });
    i++;
  }, 90);

  const land = (k)=>{
    spinning[k] = false;
    dice[k].classList.remove('rolling');
    dice[k].classList.add('landed');
    setDot(dice[k], results[k]);
    Sound.diceLand();
  };
  setTimeout(()=>land(0), reduced ? 150 : 700);
  setTimeout(()=>{
    land(1);
    clearInterval(spin);
    setTimeout(()=>{
      state.rolling = false;
      rollDice(results[0], results[1]);
    }, reduced ? 250 : 550);
  }, reduced ? 300 : 1150);
}

/* Malý řádek „Hod: ● ●" nad kartou, ať i ostatní vidí, co padlo. */
function rollSummary(room){
  const [a,c2] = room.lastRoll;
  const dot = c => el('span',{class:'roll-dot', style:'background:'+colorVar(c), title:colorName(c)});
  return el('div',{class:'roll-summary'},
    t('roll_label')+' ', dot(a), dot(c2),
    a===c2 ? el('span',{class:'roll-note'}, ' '+t('roll_double')) : null
  );
}

/* Skóre všech hráčů v mřížce — zalamuje se, takže se na mobilu
   nemusí posouvat do strany. */
function scoreRow(room){
  const n = room.players.length;
  const row = el('div',{class:'score-grid'+(n>=5?' dense':'')});
  const activeId = activePlayer(room) ? activePlayer(room).id : null;
  room.players.forEach(p=>{
    const isActive = p.id===activeId;
    row.appendChild(el('div',{class:'score-chip glass'+(isActive?' active':'')+(p.online===false && Store.mode==='online'?' offline':''), 'data-pid':p.id},
      el('div',{class:'pname'}, p.name + (p.id===state.myPlayerId ? ' ('+t('you')+')' : '')),
      el('div',{class:'score-dots'}, ...COLORS.map(c=>dotsFor(p,c)))
    ));
  });
  return row;
}
/* Skóre jedné barvy: plné sloty = celé karty, poloplný slot = půlkarta.
   Vždy aspoň 2 sloty (cíl pro výhru); celé karty navíc i půlka nad nimi
   přidají další slot, takže je vidět např. 2 celé + půlka. */
function dotsFor(p,color){
  const colVar = colorVar(color);
  const full = p.full[color];
  const half = p.halves[color] > 0;
  const slots = Math.max(2, full + (half ? 1 : 0));
  const wrap = el('span',{class:'score-color', 'data-color':color, title: colorName(color)+': '+full+(half?' + ½':'')});
  for(let i=0;i<slots;i++){
    let cls = 'slot';
    if(i < full) cls += ' filled';
    else if(i === full && half) cls += ' halffull';
    if(i >= 2) cls += ' over';
    wrap.appendChild(el('span',{class:cls, style:'--c:'+colVar}));
  }
  return wrap;
}

/* ---------- KARTY ---------- */
function cardWave(cssColor, position){
  return `<svg class="wave-band ${position}" viewBox="0 0 300 74" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L300,0 L300,44 C255,64 215,30 165,42 C115,54 60,66 0,50 Z" fill="${cssColor}"/>
  </svg>`;
}
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

function qcardEl(color, text){
  const cssColor = colorVar(color);
  // karta na šířku, u všech barev stejná
  return el('div',{class:'qcard'},
    htmlToNode(cardWave(cssColor, 'top')),
    htmlToNode(cardWave(cssColor, 'bottom')),
    el('div',{class:'qcard-text'}, text)
  );
}
/* ---------- NÁPOVĚDA NA KARTĚ ----------
   Prvních 2× od každé barvy (červená, modrá, žlutá, šance) je nápověda
   vidět pod kartou. Potřetí se ukáže naposledy a animací se „schová"
   na rub karty; pak je vždy k dispozici pod otazníkem — karta se otočí. */
let lastHintCardKey = null;
/* Vysvětlující texty („co má hráč dělat") se ukazují jen u první karty
   dané barvy — pak je nápověda pod otazníkem na kartě. */
function firstTime(kind){ return ((state.hintSeen && state.hintSeen[kind]) || 0) <= 1; }
function noCardsYet(){ const h = state.hintSeen || {}; return !Object.keys(h).some(k=>h[k]>0); }
function hintKind(card, colorOverride){
  return card.type==='chance' ? 'chance' : (colorOverride || card.color);
}
function trackHintCard(){
  const r = state.room;
  if(state.screen!=='game' || !r || !r.currentCard){ lastHintCardKey = null; return; }
  const c = r.currentCard;
  const key = [r.turnIndex, c.type, c.color||'', c.idx].join('|');
  if(key === lastHintCardKey) return;
  lastHintCardKey = key;
  const kind = hintKind(c, r.round && r.phase==='answer-round' ? r.round.color : null);
  state.hintSeen = state.hintSeen || {};
  state.hintSeen[kind] = (state.hintSeen[kind]||0) + 1;
  state.cardFlipped = false;
}
function flipCard(inner, on){
  state.cardFlipped = on;
  inner.classList.toggle('flipped', on);
  const front = inner.querySelector('.qcard'), back = inner.querySelector('.qcard-back');
  if(front) front.setAttribute('aria-hidden', on ? 'true' : 'false');
  if(back) back.setAttribute('aria-hidden', on ? 'false' : 'true');
  const q = inner.querySelector('.hint-q'); if(q) q.setAttribute('aria-expanded', on ? 'true' : 'false');
  Sound.flip();
  setTimeout(()=>{ const f = inner.querySelector(on ? '.hint-x' : '.hint-q'); try{ f && f.focus({preventScroll:true}); }catch(e){} }, 320);
}
/* Karta z herního stavu — text v jazyce tohoto zařízení, s otazníkem a nápovědou. */
function cardEl(card, colorOverride){
  const color = colorOverride || (card.type==='chance' ? 'chance' : card.color);
  const kind = hintKind(card, colorOverride);
  const front = qcardEl(color, cardText(card));
  const seen = (state.hintSeen && state.hintSeen[kind]) || 0;
  // 1. karta dané barvy: nápověda pod kartou; 2. karta: otazník zabliká s bublinou
  const remind = seen === 2 && !(state.hintTuckShown && state.hintTuckShown[kind]);
  if(remind){ state.hintTuckShown = state.hintTuckShown || {}; state.hintTuckShown[kind] = true; }

  const inner = el('div',{class:'card3d-inner'+(state.cardFlipped ? ' flipped' : '')});
  const qBtn = el('button',{class:'hint-q'+(remind ? ' hint-pulse' : ''), 'aria-label':t('hint_btn'), title:t('hint_btn'),
    'aria-expanded': state.cardFlipped ? 'true' : 'false', onclick:(e)=>{ e.stopPropagation(); flipCard(inner, true); }}, '?');
  front.appendChild(qBtn);
  if(remind) front.appendChild(el('span',{class:'hint-bubble','aria-hidden':'true'}, t('hint_label')));
  front.setAttribute('aria-hidden', state.cardFlipped ? 'true' : 'false');
  const back = el('div',{class:'qcard-back', style:'--c:'+colorVar(color), 'aria-hidden': state.cardFlipped ? 'false' : 'true'},
    el('div',{class:'qcard-back-band'}),
    el('button',{class:'hint-x', 'aria-label':t('hint_close'), title:t('hint_close'), onclick:(e)=>{ e.stopPropagation(); flipCard(inner, false); }}, '×'),
    el('div',{class:'qcard-back-body'},
      el('div',{class:'qcard-back-label'}, t('hint_label')),
      el('div',{class:'qcard-back-title'}, t('hint_title_'+kind)),
      el('div',{class:'qcard-back-text'}, t('hint_'+kind))
    )
  );
  inner.append(front, back);
  const frag = document.createDocumentFragment();
  frag.appendChild(el('div',{class:'card3d'}, inner));
  // nápověda pod kartou jen u první karty dané barvy (s poznámkou, kde ji najít příště)
  if(seen <= 1){
    frag.appendChild(el('div',{class:'hint-inline glass', role:'note'},
      el('span',{class:'hint-ico','aria-hidden':'true', style:'--c:'+colorVar(color)}, '?'),
      el('div',{class:'hint-inline-text'},
        el('b',{}, t('hint_title_'+kind)), ' ', t('hint_'+kind),
        el('div',{class:'hint-moved'}, t('hint_moved')))
    ));
  }
  return frag;
}

/* ---------- ČERVENÁ OTÁZKA (odpovídá jen hráč, který ji vytáhl) ---------- */
function renderQuestionPhase(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  s.appendChild(cardEl(card));
  s.appendChild(gap(22));
  if(!mine){
    s.appendChild(el('div',{class:'subtitle center-text'}, ...tn('answers', b(ap.name))));
    if(card.color==='red' && firstTime('red')){
      s.appendChild(el('div',{class:'subtitle center-text', style:'margin-top:6px'}, t('red_ask_others')));
    }
    return;
  }
  if(card.color==='red' && firstTime('red')){
    s.appendChild(el('div',{class:'banner-info glass'}, ...tn('red_banner', b(ap.name))));
    s.appendChild(gap(12));
  }
  s.appendChild(el('div',{class:'stack stack-tight'},
    button(t('answered_gets'), colorBtnCls(card.color), ()=>{
      addFull(ap, card.color);
      if(!resolveWin(room, ap)) advanceTurn(room);
      saveAndRender();
    }),
    button(t('not_answered_loses'),'btn-glass', ()=>{
      loseColor(ap, card.color);
      advanceTurn(room);
      saveAndRender();
    })
  ));
}

/* ---------- KOLEČKO ODPOVĚDÍ ---------- */
/* Žlutá otázka a karta šance „Všichni odpovídají na červenou otázku".
   Začíná hráč, který kartu vytáhl, pak ostatní ve směru hry.
   Kdo neodpoví, ztrácí kartu té barvy (má-li ji). Když kolečko dojde
   zpět k tomu, kdo kartu vytáhl, získává celou kartu té barvy. */
function renderRound(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  const r = room.round;
  s.appendChild(cardEl(card, r ? r.color : null));
  s.appendChild(gap(16));
  if(!r) return;
  const col = r.color;
  const btnCls = col==='red' ? 'btn-red' : col==='blue' ? 'btn-blue' : 'btn-yellow';

  if(card.everyone){
    if(firstTime('chance')) s.appendChild(el('div',{class:'subtitle center-text', style:'margin:0 0 10px'}, t('everyone_red_note')));
  }

  const answered = r.answered || {};
  const started = Object.keys(answered).length>0;
  const current = playerById(room, r.current);
  const backToDrawer = started && r.current===ap.id;

  // Přehled pořadí: kdo už odpověděl, kdo je na řadě.
  // Při 5 a více hráčích ve dvou sloupcích, ať se vše vejde na displej.
  const list = el('div',{class:'stack stack-tight'+(r.order.length>=5?' round-grid':'')});
  r.order.forEach((pid,i)=>{
    const p = playerById(room, pid);
    if(!p) return;
    let status, cls='';
    if(pid in answered){
      status = answered[pid] ? t('st_answered') : t('st_not_answered');
      cls = answered[pid] ? 'ok' : 'no';
    } else if(pid===r.current){
      status = t('st_now'); cls='now';
    } else {
      status = t('st_waiting');
    }
    list.appendChild(el('div',{class:'guess-row glass round-row '+cls, style:'--c:'+colorVar(col)},
      el('span',{}, p.name,
        i===0 ? el('span',{class:'drew-full'}, ' '+t('drew_card')) : null,
        i===0 ? el('span',{class:'drew-mark', title:t('drew_card'), 'aria-label':t('drew_card')}, ' ★') : null,
        pid===state.myPlayerId ? ' — '+t('you') : ''),
      el('span',{class:'round-status'}, status)
    ));
  });
  s.appendChild(list);
  s.appendChild(gap(16));

  if(backToDrawer){
    if(mine){
      s.appendChild(el('div',{class:'banner-info glass'}, ...tn('round_done', b(ap.name), colorAcc(col))));
      s.appendChild(gap(12));
      s.appendChild(button(t('round_take'), btnCls, ()=>{ roundFinish(); }));
    } else {
      s.appendChild(waiting(...tn('round_taking', ap.name)));
    }
    return;
  }

  if(!current) return;
  const isDrawer = current.id===ap.id;
  const canAnswer = Store.mode==='local' || current.id===state.myPlayerId;
  // Hráč na tahu může rozhodnout za někoho, kdo je offline.
  const canDecideFor = Store.mode==='online' && mine && !canAnswer && current.online===false;

  if(canAnswer || canDecideFor){
    s.appendChild(el('div',{class:'banner-info glass'},
      ...(canDecideFor ? tn('decide_for', b(current.name))
                       : tn(isDrawer ? 'answering_first' : 'answering', b(current.name)))
    ));
    s.appendChild(gap(12));
    const has = current.full[col]>0 || current.halves[col]>0;
    s.appendChild(el('div',{class:'stack stack-tight'},
      button(t('answered'), btnCls, ()=>{ roundAnswer(current.id, true); }),
      button(has ? t('not_answered_loses_col', colorAcc(col)) : t('not_answered_has_none', colorAcc(col)),
        'btn-glass', ()=>{ roundAnswer(current.id, false); })
    ));
    if(isDrawer){
      if(firstTime(card.everyone ? 'chance' : col)) s.appendChild(el('div',{class:'subtitle center-text fit-hide', style:'margin-top:8px'}, t('drawer_skip_note')));
    }
  } else {
    s.appendChild(waiting(...tn('answering_wait', b(current.name))));
  }
}

/* ---------- KARTY ŠANCE ---------- */
/* Karta šance se táhne po dvojitém hodu. Po jejím vyřešení následuje
   otázka barvy, která padla (room.pendingColor) — pokud to karta dovolí. */
function renderChancePhase(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  s.appendChild(cardEl(card));
  s.appendChild(gap(16));
  if(room.pendingColor){
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin:0 0 14px'},
      ...tn('then_question', b(colorName(room.pendingColor)))));
  }
  if(!mine){
    s.appendChild(el('div',{class:'subtitle center-text'}, ...tn('chance_resolving', b(ap.name))));
    return;
  }
  const key = card.key;
  const next = ()=>{ state.chanceUI={}; continueAfterChance(room); saveAndRender(); };
  const nextLabel = room.pendingColor ? t('continue_to_q') : t('continue');

  if(key==='lose_all'){
    s.appendChild(button(t('ch_lose_all'),'btn-red', ()=>{
      ap.full={red:0,blue:0,yellow:0}; ap.halves={red:0,blue:0,yellow:0};
      next();
    }));
  }
  else if(key==='lose_all_unless_red'){
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:10px'}, t('ch_save_hint')));
    s.appendChild(button(t('ch_save_btn'),'btn-primary', ()=>{
      const c=pickDieColor();
      const lost = c!=='red';
      if(lost){ ap.full={red:0,blue:0,yellow:0}; ap.halves={red:0,blue:0,yellow:0}; }
      uiAlert(lost ? t('ch_save_fail', colorName(c)) : t('ch_save_ok'), t('ch_save_title')).then(()=>next());
    }));
  }
  else if(key==='go_again'){
    // Nejdřív se odpoví na otázku, pak hraje stejný hráč ještě jednou.
    s.appendChild(button(room.pendingColor ? t('ch_again_q') : t('ch_again'),'btn-primary', ()=>{
      room.extraTurn = true;
      next();
    }));
  }
  else if(key==='change_color'){
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:4px'}, t('ch_pick_color')));
    s.appendChild(colorPicker(COLORS, null, c=>{
      state.chanceUI={};
      startQuestion(room, c);
      saveAndRender();
    }));
  }
  else if(key==='right_answers'){
    s.appendChild(button(t('continue'),'btn-primary', ()=>{
      const nb = rightNeighbor(room);
      const c = room.pendingColor || pickDieColor();
      if(c==='blue'){
        // modrá: soused napíše 3 odpovědi, ostatní hádají, modrou kartu dostane hráč na tahu
        startQuestion(room, 'blue');
        room.blueAuthor = nb.id;
        room.blueBeneficiary = ap.id;
        room.currentCard = Object.assign({}, room.currentCard, {forId:nb.id});
        saveAndRender();
        return;
      }
      room.currentCard = {type:'question', color:c, idx:drawIndex(room, c), forId:nb.id};
      room.pendingColor = null;
      room.phase='right-neighbor';
      saveAndRender();
    }));
  }
  else if(key==='reverse'){
    s.appendChild(button(t('ch_reverse'),'btn-primary', ()=>{
      room.direction*=-1;
      next();
    }));
  }
  else if(key==='skip_next'){
    // „Teď nehraješ." — tah končí hned, otázka se nehraje.
    s.appendChild(button(t('ch_skip'),'btn-primary', ()=>{
      room.pendingColor = null;
      advanceTurn(room); saveAndRender();
    }));
  }
  else if(key==='steal'){
    renderStealUI(s, room, ap, nextLabel);
  }
  else if(key==='trade_one_for_one' || key==='trade_two_for_one'){
    renderTradeUI(s, room, ap, nextLabel);
  }
  else if(key==='everyone_red'){
    // Jediný případ, kdy na červenou odpovídají všichni — v kolečku.
    s.appendChild(button(t('ch_everyone_red'),'btn-red', ()=>{
      room.currentCard = {type:'question', color:'red', idx:drawIndex(room,'red'), everyone:true};
      room.pendingColor = null;
      startRound(room, 'red');
      saveAndRender();
    }));
  }
  else {
    s.appendChild(button(nextLabel,'btn-primary', next));
  }
}

function renderStealUI(s, room, ap, nextLabel){
  const others = room.players.filter(p=>p.id!==ap.id);
  const hasAny = (p)=> COLORS.some(c=> p.full[c]>0 || p.halves[c]>0);
  const stealable = others.filter(hasAny);

  if(stealable.length===0){
    s.appendChild(el('div',{class:'banner-info glass'}, t('steal_none')));
    s.appendChild(gap(12));
    s.appendChild(button(nextLabel,'btn-primary', ()=>{
      state.chanceUI={};
      continueAfterChance(room); saveAndRender();
    }));
    return;
  }

  s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:10px'}, t('steal_pick')));

  let targetSel = state.chanceUI.target;
  if(!targetSel || !stealable.some(p=>p.id===targetSel)) targetSel = stealable[0].id;
  state.chanceUI.target = targetSel;

  const target = playerById(room, targetSel);
  const availColors = COLORS.filter(c=> target.full[c]>0 || target.halves[c]>0);

  let colSel = state.chanceUI.color;
  if(!colSel || !availColors.includes(colSel)) colSel = availColors[0];
  state.chanceUI.color = colSel;

  const sel = el('select',{class:'card-input', onchange:(e)=>{
    state.chanceUI.target=e.target.value;
    state.chanceUI.color=null;
    render();
  }});
  stealable.forEach(p=> sel.appendChild(el('option',{value:p.id, selected: p.id===targetSel?'selected':null}, p.name)));
  s.appendChild(sel);
  s.appendChild(colorPicker(availColors, colSel, c=>{ state.chanceUI.color=c; render(); }));
  s.appendChild(gap(14));
  s.appendChild(button(t('steal_btn'),'btn-primary', ()=>{
    const tp = playerById(room, state.chanceUI.target);
    const c = state.chanceUI.color;
    if(tp.full[c]>0){ tp.full[c]--; ap.full[c]++; }
    else if(tp.halves[c]>0){ tp.halves[c]--; addHalf(ap,c); }
    state.chanceUI={};
    if(!resolveWin(room, ap)) continueAfterChance(room);
    saveAndRender();
  }));
}

/* Karta šance: dobrovolná výměna 1 karty za 1 kartu jiné barvy. */
function renderTradeUI(s, room, ap, nextLabel){
  const eligible = COLORS.filter(c=>ap.full[c]>=1);
  const skip = ()=>{ state.chanceUI={}; continueAfterChance(room); saveAndRender(); };
  if(eligible.length===0){
    s.appendChild(el('div',{class:'banner-info glass'}, t('trade_none')));
    s.appendChild(gap(12));
    s.appendChild(button(nextLabel,'btn-primary', skip));
    return;
  }
  const ui = state.chanceUI;
  s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:4px'}, t('trade_give')));
  s.appendChild(colorPicker(eligible, ui.give, c=>{ ui.give=c; if(ui.want===c) ui.want=null; render(); }));
  if(ui.give){
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin:14px 0 4px'}, t('trade_want')));
    s.appendChild(colorPicker(COLORS.filter(c=>c!==ui.give), ui.want, c=>{ ui.want=c; render(); }));
  }
  s.appendChild(gap(16));
  s.appendChild(el('div',{class:'stack stack-tight'},
    button(ui.give && ui.want ? t('trade_do', colorAcc(ui.give), colorAcc(ui.want)) : t('trade_btn'),'btn-primary', ()=>{
      ap.full[ui.give]--;
      ap.full[ui.want]++;
      state.chanceUI={};
      if(!resolveWin(room, ap)) continueAfterChance(room);
      saveAndRender();
    }, !(ui.give && ui.want)),
    button(room.pendingColor ? t('trade_skip_q') : t('trade_skip'),'btn-glass', skip)
  ));
}

/* Karta šance „Na otázku odpovídá hráč po tvé pravici".
   Odpoví-li soused, kartu té barvy získává hráč, který kartu šance vytáhl.
   Neodpoví-li, soused ztrácí kartu té barvy (má-li ji). */
function renderRightNeighbor(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  const nb = playerById(room, card.forId);
  const nbName = nb ? nb.name : '?';
  s.appendChild(el('div',{class:'subtitle center-text', style:'margin:0 0 10px'}, ...tn('answers', b(nbName))));
  s.appendChild(cardEl(card));
  s.appendChild(gap(16));
  if(firstTime('chance')){
    s.appendChild(el('div',{class:'banner-info glass'}, ...tn('rn_note', b(nbName), b(ap.name), colorAcc(card.color))));
    s.appendChild(gap(14));
  }
  if(!mine) return;
  s.appendChild(el('div',{class:'stack stack-tight'},
    button(t('rn_answered', ap.name), colorBtnCls(card.color), ()=>{
      addFull(ap, card.color);
      if(!resolveWin(room, ap)) advanceTurn(room);
      saveAndRender();
    }),
    button(t('rn_not_answered', nbName),'btn-glass', ()=>{
      if(nb) loseColor(nb, card.color);
      advanceTurn(room); saveAndRender();
    })
  ));
}

/* ---------- MODRÁ KARTA ---------- */
/* Krok 1: hráč na tahu napíše 3 odpovědi (1 pravdivou, 2 vymyšlené).
   Krok 2: označí, která je pravdivá. Pak hádají ostatní. */
function renderBlueCompose(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  const author = blueAuthor(room);
  const viaNeighbor = author.id !== ap.id;   // karta šance „odpovídá hráč po pravici"
  if(viaNeighbor) s.appendChild(el('div',{class:'subtitle center-text', style:'margin:0 0 10px'}, ...tn('answers', b(author.name))));
  s.appendChild(cardEl(card));
  s.appendChild(gap(viaNeighbor ? 14 : 20));
  if(viaNeighbor && firstTime('chance')){
    s.appendChild(el('div',{class:'banner-info glass'}, ...tn('rn_note', b(author.name), b(ap.name), colorAcc('blue'))));
    s.appendChild(gap(14));
  }

  if(!isBlueAuthorHere(room)){
    renderBlueWaiting(s, room, author);
    // hráč na tahu může zaznamenat, že soused odpovědi napsat nechce
    if(viaNeighbor && mine){
      s.appendChild(gap(14));
      s.appendChild(button(t('rn_not_answered', author.name),'btn-glass', ()=>{ blueDecline(); }));
    }
    return;
  }

  const bc = state.blueCompose;
  const keys = ['a','b','c'];
  const local = Store.mode==='local';

  if(bc.step!==2){
    if(firstTime('blue')){
      s.appendChild(el('div',{class:'banner-info glass'},
        b(t('blue_intro_head')+' '),
        local ? tn('blue_intro_local', b(author.name)) : null
      ));
      s.appendChild(gap(14));
    }
    const list = el('div',{class:'stack stack-tight'});
    const inputs = [];
    // Kontrola při psaní: shodné odpovědi se zvýrazní a „Dále" se zablokuje.
    // Nepřekresluje se celá obrazovka, ať se při psaní nic neruší.
    const refreshDup = ()=>{
      const dup = duplicateAnswerIdx(keys.map(k=>bc[k]));
      inputs.forEach((inp,i)=>inp.classList.toggle('dup', dup.has(i)));
      warn.hidden = dup.size===0;
      nextBtn.disabled = dup.size>0;
    };
    keys.forEach((k,i)=>{
      const inp = el('input',{class:'card-input', 'data-fk':'blue-'+k, placeholder:t('blue_ph', i+1), value:bc[k], maxlength:'140',
        oninput:(e)=>{ bc[k]=e.target.value; sendComposeProgress(room, bc); refreshDup(); }});
      inputs.push(inp);
      list.appendChild(el('div',{class:'row'}, el('span',{class:'opt-num'}, String(i+1)), inp));
    });
    const warn = el('div',{class:'dup-warn', role:'alert'}, t('blue_dup'));
    s.appendChild(list);
    s.appendChild(warn);
    s.appendChild(gap(18));
    const nextBtn = button(t('blue_next'),'btn-blue', ()=>{
        if(keys.some(k=>!(bc[k]||'').trim())){ uiAlert(t('blue_fill_all')); return; }
        if(duplicateAnswerIdx(keys.map(k=>bc[k])).size){ refreshDup(); return; }
        bc.step = 2;
        sendComposeProgress(room, bc);
        render();
      });
    refreshDup();
    s.appendChild(el('div',{class:'stack stack-tight'},
      nextBtn,
      // odmítnutí: na jednom zařízení vždy, online jen hráč na tahu (posouvá tah)
      (local || !viaNeighbor) ? button(viaNeighbor ? t('rn_not_answered', author.name) : t('not_answered_loses'),'btn-glass', ()=>{ blueDecline(); }) : null
    ));
    return;
  }

  // Krok 2 — označení pravdivé odpovědi.
  s.appendChild(el('div',{class:'banner-info glass'}, ...tn('blue_mark', b(t('blue_true_word')))));
  s.appendChild(gap(12));
  const list = el('div',{class:'stack stack-tight'});
  keys.forEach((k,i)=>{
    list.appendChild(el('button',{class:'option-btn glass'+(bc.correct===i?' selected':''), onclick:()=>{ bc.correct=i; render(); }},
      el('span',{class:'opt-num'}, bc.correct===i ? '✓' : String(i+1)),
      el('span',{class:'opt-text'}, bc[k].trim())
    ));
  });
  s.appendChild(list);
  s.appendChild(gap(18));
  s.appendChild(el('div',{class:'stack stack-tight'},
    button(local ? t('blue_submit_local') : t('blue_submit_online'),'btn-blue', ()=>{
      blueSubmit(keys.map(k=>bc[k].trim()), bc.correct);
    }, bc.correct===null),
    button(t('blue_edit'),'btn-ghost', ()=>{ bc.step=1; sendComposeProgress(room, bc); render(); })
  ));
}

/* ---------- MODRÁ ONLINE: ČEKÁNÍ NA ODPOVĚDI ----------
   Čekající hráči vidí živý průběh psaní a mezitím si mohou tipnout,
   jakou pravdivou odpověď hráč na tahu napíše. Tip je jen pro zábavu
   a ukáže se při vyhodnocení. */
function sendComposeProgress(room, bc){
  if(Store.mode!=='online') return;
  const filled = ['a','b','c'].filter(k=>(bc[k]||'').trim()).length;
  const prog = {filled, step: bc.step===2 ? 2 : 1};
  const key = prog.filled+'|'+prog.step;
  if(state.lastProgressKey===key) return;
  state.lastProgressKey = key;
  room.composeProgress = prog;
  Online.pushProgress(room.code, prog).catch(e=>console.error('progress push', e));
}

function composeSteps(pr){
  const filled = pr ? (pr.filled||0) : 0;
  const marking = !!(pr && pr.step===2);
  const wrap = el('div',{class:'compose-steps','aria-hidden':'true'});
  for(let i=0;i<3;i++) wrap.appendChild(el('span',{class:'cstep'+((marking || i<filled)?' on':'')}));
  wrap.appendChild(el('span',{class:'cstep cstep-true'+(marking?' on':'')}, '✓'));
  return wrap;
}

function renderBlueWaiting(s, room, ap){
  const pr = room.composeProgress;
  const line = !pr ? tn('progress_start', b(ap.name))
             : pr.step===2 ? tn('progress_marking', b(ap.name))
             : (pr.filled ? tn('progress_writing', b(ap.name), pr.filled) : tn('progress_start', b(ap.name)));
  s.appendChild(el('div',{class:'center-col', style:'gap:10px'}, waiting(...line), composeSteps(pr)));
  s.appendChild(gap(18));

  // nový tah = prázdné políčko na tip
  const tipKey = room.turnIndex+':'+(room.currentCard ? room.currentCard.idx : '');
  if(state.tipFor!==tipKey){ state.tipFor = tipKey; state.tipDraft = ''; state.tipEditing = false; }

  const myTip = (room.tips||{})[state.myPlayerId];
  const box = el('div',{class:'panel glass tip-panel'},
    el('div',{class:'panel-title'}, t('tip_title')),
    el('div',{class:'subtitle', style:'margin-top:2px'}, ...tn('tip_q', b(ap.name)))
  );
  if(myTip && !state.tipEditing){
    box.appendChild(el('div',{class:'tip-saved'}, ...tn('tip_saved', b(myTip))));
    box.appendChild(button(t('tip_change'),'btn-ghost btn-sm', ()=>{ state.tipEditing=true; state.tipDraft=myTip; render(); }));
  } else {
    const save = ()=>{
      const v = (state.tipDraft||'').trim();
      if(!v) return;
      state.tipEditing = false;
      Online.pushTip(room.code, state.myPlayerId, v.slice(0,80)).catch(e=>console.error('tip push', e));
    };
    box.appendChild(el('div',{class:'row', style:'margin-top:12px'},
      el('input',{class:'card-input', 'data-fk':'tip', placeholder:t('tip_ph'), value:state.tipDraft||'', maxlength:'80',
        enterkeyhint:'done',
        oninput:(e)=>{ state.tipDraft=e.target.value; },
        onkeydown:(e)=>{ if(e.key==='Enter'){ e.preventDefault(); save(); } }}),
      button(t('tip_save'),'btn-blue btn-sm btn-auto', save)
    ));
  }
  box.appendChild(el('div',{class:'subtitle', style:'margin-top:8px;font-size:calc(13px * var(--fs))'}, t('tip_note')));
  s.appendChild(box);
}

/* Indexy odpovědí, které jsou stejné jako jiná odpověď. Porovnává se bez
   ohledu na velikost písmen, mezery, diakritiku a interpunkci — „Pes",
   „pes." i „PES" jsou pro hádajícího totéž. Prázdné se nepočítají. */
function duplicateAnswerIdx(values){
  const norm = values.map(v=>normTip(v) || String(v||'').trim().toLowerCase());
  const dup = new Set();
  norm.forEach((a,i)=>{
    if(!a) return;
    norm.forEach((c,j)=>{ if(i!==j && a===c){ dup.add(i); dup.add(j); } });
  });
  return dup;
}

/* Trefil se tip? Porovnání bez diakritiky, velikosti písmen a interpunkce;
   stačí, když jedno obsahuje druhé (např. „mango" × „Mango a ananas"). */
function normTip(x){
  return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
}
function tipMatches(tip, truth){
  const a = normTip(tip), c = normTip(truth);
  if(!a || !c) return false;
  if(a===c) return true;
  return (a.length>=3 && (' '+c+' ').includes(' '+a+' ')) || (c.length>=3 && (' '+a+' ').includes(' '+c+' '));
}

/* Hádání. Jedno zařízení: zařízení koluje, každý hádá zvlášť.
   Online: hádají všichni najednou na svých zařízeních. */
function renderBlueGuessing(s, room, mine){
  const card = room.currentCard;
  const ap = blueAuthor(room);          // vyhodnocuje autor odpovědí
  s.appendChild(cardEl(card));
  s.appendChild(gap(20));
  if(Store.mode==='local'){ renderBlueGuessingLocal(s, room, ap, card); return; }
  mine = isBlueAuthorHere(room);

  const others = room.players.filter(p=>p.id!==ap.id);
  const votes = room.votes || {};
  const hasVoted = p => votes[p.id]!==undefined && votes[p.id]!==null;
  const voted = others.filter(hasVoted);
  const waitingFor = others.filter(p=> !hasVoted(p) && p.online!==false);

  if(mine){
    s.appendChild(el('div',{class:'banner-info glass'}, ...tn('votes_count', b(voted.length+' / '+others.length))));
    s.appendChild(gap(12));
    const list = el('div',{class:'stack stack-tight'});
    others.forEach(p=>{
      list.appendChild(el('div',{class:'guess-row glass'},
        el('span',{}, p.name),
        el('span',{class:'round-status'}, hasVoted(p) ? t('st_voted') : (p.online===false ? t('st_offline') : t('st_waiting_dots')))
      ));
    });
    s.appendChild(list);
    s.appendChild(gap(18));
    const secret = recallSecret(room.code);
    if(secret===null){
      s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:8px'}, t('which_was_true')));
      const pick = el('div',{class:'stack stack-tight'});
      (card.options||[]).forEach((opt,i)=>{
        pick.appendChild(button(opt,'btn-glass', ()=>{ rememberSecret(room.code, i); render(); }));
      });
      s.appendChild(pick);
      return;
    }
    s.appendChild(button(t('evaluate'),'btn-primary', ()=>{
      room.currentCard = Object.assign({}, card, {correct: secret});
      room.phase='blue-reveal';
      forgetSecret();
      saveAndRender();
    }, waitingFor.length > 0 || voted.length===0));
    return;
  }

  const myVote = votes[state.myPlayerId];
  if(myVote !== undefined && myVote !== null){
    s.appendChild(el('div',{class:'center-col'},
      el('div',{class:'banner-info glass'}, ...tn('your_pick', b(card.options[myVote]))),
      waiting(t('waiting_others'))
    ));
    return;
  }
  const myTip = (room.tips||{})[state.myPlayerId];
  if(myTip) s.appendChild(el('div',{class:'subtitle center-text', style:'margin:0 0 4px;font-size:calc(13.5px * var(--fs))'}, ...tn('tip_reminder', b(myTip))));
  s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:12px'}, t('guess_q')));
  s.appendChild(optionButtons(card.options, i=>{ Online.pushVote(room.code, state.myPlayerId, i); }));
}

function optionButtons(options, onPick){
  const list = el('div',{class:'stack stack-tight'});
  (options||[]).forEach((opt,i)=>{
    list.appendChild(el('button',{class:'option-btn glass', onclick:()=>onPick(i)},
      el('span',{class:'opt-num'}, String(i+1)),
      el('span',{class:'opt-text'}, opt)
    ));
  });
  return list;
}

function renderBlueGuessingLocal(s, room, ap, card){
  const bt = room.blueTurn || {order:[], current:null};
  if(bt.current){
    const p = playerById(room, bt.current);
    const done = bt.order.indexOf(bt.current);
    if(state.handoff !== bt.current){
      // Předání zařízení — předchozí volba ani správná odpověď nejsou vidět.
      s.appendChild(el('div',{class:'handoff glass'},
        el('div',{class:'handoff-ico','aria-hidden':'true'},'📱'),
        el('div',{class:'title-md'}, t('handoff_to', p.name)),
        el('div',{class:'subtitle'}, t('handoff_progress', done+1, bt.order.length))
      ));
      s.appendChild(gap(16));
      s.appendChild(button(t('handoff_iam', p.name),'btn-blue', ()=>{ state.handoff = bt.current; render(); }));
      return;
    }
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:12px'}, ...tn('guess_q_named', b(p.name))));
    s.appendChild(optionButtons(card.options, i=>{ blueLocalVote(i); }));
    return;
  }
  // Všichni hádali — zařízení se vrací hráči, který odpovědi napsal.
  s.appendChild(el('div',{class:'handoff glass'},
    el('div',{class:'handoff-ico','aria-hidden':'true'},'📱'),
    el('div',{class:'title-md'}, t('all_guessed')),
    el('div',{class:'subtitle'}, ...tn('handoff_back', b(ap.name)))
  ));
  s.appendChild(gap(16));
  s.appendChild(button(t('handoff_iam_eval', ap.name),'btn-primary', ()=>{
    room.phase='blue-reveal';
    saveAndRender();
  }));
}

/* Odhalení, kdo uhodl, a výběr barvy půlkarty. */
function renderBlueReveal(s, room, mine){
  const card = room.currentCard;
  const ap = activePlayer(room);
  const author = blueAuthor(room);
  const others = room.players.filter(p=>p.id!==author.id);
  const votes = room.votes || {};
  const colors = room.awardColors || {};
  const winners = others.filter(p=> votes[p.id]===card.correct);
  const local = Store.mode==='local';
  const tips = room.tips || {};
  const trueText = (card.options||[])[card.correct] || '';

  s.appendChild(el('div',{class:'title-md center-text', style:'margin-bottom:10px'}, t('true_answer')));
  const answerCard = qcardEl('blue', (card.options||[])[card.correct] || '—');
  s.appendChild(answerCard);
  s.appendChild(gap(16));

  const list = el('div',{class:'stack stack-tight'});
  others.forEach(p=>{
    const ok = votes[p.id]===card.correct;
    const guess = votes[p.id]!==undefined && votes[p.id]!==null ? card.options[votes[p.id]] : null;
    list.appendChild(el('div',{class:'guess-row glass reveal-row'+(ok?' ok':'')},
      el('div',{},
        el('div',{class:'reveal-name'}, p.name),
        el('div',{class:'reveal-guess'}, guess!==null ? t('guessed_label')+' '+guess : t('no_vote')),
        tips[p.id] ? el('div',{class:'reveal-guess reveal-tip'}, t('tip_label')+' '+tips[p.id],
          tipMatches(tips[p.id], trueText) ? el('span',{class:'tip-hit'}, t('tip_hit')) : null) : null
      ),
      el('span',{class:'round-status'}, ok ? t('st_correct') : t('st_wrong'))
    ));
    // Jedno zařízení: kdo uhodl, rovnou si tu vybere barvu půlkarty.
    if(local && ok){
      list.appendChild(el('div',{class:'award-pick'},
        el('div',{class:'subtitle center-text', style:'margin:0'}, t('award_pick_named', p.name)),
        colorPicker(COLORS, colors[p.id], c=>{
          room.awardColors = Object.assign({}, room.awardColors, {[p.id]: c});
          saveAndRender();
        })
      ));
    }
  });
  s.appendChild(list);

  if(!local){
    const iWon = winners.some(p=>p.id===state.myPlayerId);
    if(iWon){
      s.appendChild(gap(14));
      s.appendChild(el('div',{class:'subtitle center-text'}, colors[state.myPlayerId] ? t('award_change') : t('award_pick_me')));
      s.appendChild(colorPicker(COLORS, colors[state.myPlayerId], c=>{
        Online.pushAwardColor(room.code, state.myPlayerId, c);
      }));
    }
    if(!mine){
      s.appendChild(gap(14));
      s.appendChild(waiting(...tn('waiting_for', ap.name)));
      return;
    }
  }

  const pending = winners.filter(p=>!colors[p.id] && (local || p.online!==false));
  s.appendChild(gap(18));
  if(pending.length){
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:8px'},
      t('award_pending', pending.map(p=>p.name).join(', '))));
  }
  if(!winners.length){
    s.appendChild(el('div',{class:'subtitle center-text', style:'margin-bottom:8px'}, t('nobody_guessed')));
  }
  s.appendChild(button(t('blue_continue', blueBeneficiary(room).name),'btn-primary', ()=>{ blueFinish(); }, pending.length>0));
}

/* ---------- KONEC HRY ---------- */
/* Vítěz dostane právo zeptat se ostatních na cokoliv. Výhra je
   jistá — otázka je závěr hry, ne podmínka vítězství. */
function renderFinished(s, room){
  const winner = playerById(room, room.winnerId);
  const mine = (Store.mode==='local') || (winner && winner.id===state.myPlayerId);

  if(!room.finalDone){
    s.appendChild(el('div',{class:'center-col', style:'margin-top:10px'},
      el('div',{class:'win-crown'},'💬'),
      el('div',{class:'title-lg'}, t('final_right', winner.name)),
    ));
    s.appendChild(gap(20));
    s.appendChild(finalCardEl(t('final_card'), t('final_note')));
    if(!mine){
      s.appendChild(gap(20));
      s.appendChild(waiting(...tn('final_thinking', winner.name)));
      return;
    }
    s.appendChild(gap(20));
    s.appendChild(el('div',{class:'stack stack-tight'},
      button(t('final_done'),'btn-primary', ()=>{ room.finalDone = true; saveAndRender(); }),
      button(t('final_skip'),'btn-glass', ()=>{ room.finalDone = true; saveAndRender(); })
    ));
    return;
  }

  s.appendChild(el('div',{class:'center-col', style:'margin-top:14px'},
    el('div',{class:'win-crown'},'🏆'),
    el('div',{class:'title-lg'}, t('winner', winner.name)),
    el('div',{class:'subtitle'}, t('winner_sub'))
  ));
  s.appendChild(gap(24));
  s.appendChild(scoreRow(room));
  s.appendChild(gap(24));
  s.appendChild(button(t('new_game'),'btn-primary', ()=>{
    if(Store.mode==='online'){ leaveOnlineRoom(); return; }
    resetAppState();
    render();
  }));
}

/* ---------- HRA PRO JEDNOHO ---------- */
/* Jen otázky k zamyšlení: žádná kostka, šance, body ani hádání.
   Dole si hráč může zaškrtnout barvy — pak padají jen ty. */
const SOLO_BTN_CLS = {red:'btn-red', blue:'btn-blue', yellow:'btn-yellow'};
function renderSolo(s){
  const so = state.solo;
  const cur = so.history[so.pos];
  s.appendChild(el('div',{class:'solo-head'},
    el('span',{class:'solo-kind glass', style:'--c:'+colorVar(cur.color)}, t('solo_kind_'+cur.color)),
    el('span',{class:'solo-count'}, t('solo_count', so.pos+1))
  ));
  s.appendChild(qcardEl(cur.color, questionText(cur.color, cur.idx)));
  s.appendChild(el('div',{class:'subtitle center-text', style:'margin-top:12px'}, t('solo_hint')));
  s.appendChild(gap(18));

  const atEnd = so.pos >= so.history.length-1;
  s.appendChild(el('div',{class:'row solo-nav'},
    button(t('solo_prev'),'btn-glass', ()=>soloStep(-1), so.pos===0),
    button(atEnd ? t('solo_new') : t('solo_next'),'btn-primary', ()=>{ atEnd ? soloDraw(null) : soloStep(1); })
  ));

  const filter = so.filter || [];
  const box = el('div',{class:'panel glass solo-filter'},
    el('div',{class:'panel-title'}, t('solo_filter_title')),
    el('div',{class:'row solo-chips'},
      ...COLORS.map(c=>{
        const on = filter.includes(c);
        return el('button',{class:'solo-chip'+(on?' on':''), style:'--c:'+colorVar(c),
          'aria-pressed': on?'true':'false', onclick:()=>soloToggle(c)},
          (on ? '✓ ' : '') + t('solo_btn_'+c)
        );
      })
    ),
    el('div',{class:'subtitle', style:'margin-top:8px;font-size:calc(13.5px * var(--fs))'},
      filter.length ? t('solo_filter_some') : t('solo_filter_all'))
  );
  s.appendChild(gap(18));
  s.appendChild(box);
}
