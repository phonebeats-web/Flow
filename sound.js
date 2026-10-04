/* ============================================================
   ZVUKY — vytvářené přímo v prohlížeči (Web Audio API).
   Žádné zvukové soubory: nic se nestahuje, hra zůstává rychlá.
     Sound.click()      krátké ťuknutí při stisku tlačítka
     Sound.diceRoll(s)  tichý podkres hodu — kostky párkrát odskočí po stole
     Sound.diceLand()   jemné ťuknutí dopadu kostky
     Sound.collect()    karta přilétá k hráči
     Sound.flip()       otočení karty
     Sound.fanfare()    vítězná fanfára
   Zapnutí/vypnutí se pamatuje v prohlížeči (Sound.setEnabled).
   Prohlížeče dovolí zvuk až po prvním dotyku/kliknutí — proto se
   zvukový systém „odemyká" při první interakci.
   Zvuk je záměrně měkký: vše jde přes teplý filtr (bez ostrých výšek),
   s jemným dozvukem místnosti a pomalejším náběhem tónů.
   ============================================================ */
const Sound = (function(){
  const KEY = 'flou_sound';
  let enabled = true;
  try{ enabled = localStorage.getItem(KEY) !== 'off'; }catch(e){}
  let ctx = null, master = null, noiseBuf = null;

  /* Krátký „dozvuk místnosti" — vygenerovaná odezva (bez souboru).
     Díky němu zvuky nepůsobí suše a tvrdě. */
  function roomImpulse(){
    const len = Math.floor(ctx.sampleRate * 0.9);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for(let ch=0; ch<2; ch++){
      const d = ir.getChannelData(ch);
      for(let i=0;i<len;i++){
        const x = i/len;
        d[i] = (Math.random()*2-1) * Math.pow(1-x, 3.2) * (i < 60 ? i/60 : 1);
      }
    }
    return ir;
  }

  function ensure(){
    if(!enabled) return null;
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        // teplý filtr: ořízne ostré výšky
        const warm = ctx.createBiquadFilter();
        warm.type = 'lowpass'; warm.frequency.value = 3000; warm.Q.value = 0.5;
        // jemné zklidnění nejvyšších pásem
        const shelf = ctx.createBiquadFilter();
        shelf.type = 'highshelf'; shelf.frequency.value = 2200; shelf.gain.value = -6;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.2;
        master.connect(warm); warm.connect(shelf); shelf.connect(comp); comp.connect(ctx.destination);
        // dozvuk (malá místnost), jen lehce přimíchaný
        try{
          const rev = ctx.createConvolver(); rev.buffer = roomImpulse();
          const wet = ctx.createGain(); wet.gain.value = 0.16;
          shelf.connect(rev); rev.connect(wet); wet.connect(comp);
        }catch(e){}
      }catch(e){ ctx = null; return null; }
    }
    if(ctx.state === 'suspended'){ try{ const pr = ctx.resume(); if(pr && pr.catch) pr.catch(()=>{}); }catch(e){} }
    return ctx;
  }

  function noise(){
    if(noiseBuf) return noiseBuf;
    const len = Math.floor(ctx.sampleRate * 1);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    // „růžovější" šum (méně syčivý než bílý)
    let b0=0, b1=0, b2=0;
    for(let i=0;i<len;i++){
      const w = Math.random()*2-1;
      b0 = 0.99765*b0 + w*0.0990460; b1 = 0.96300*b1 + w*0.2965164; b2 = 0.57000*b2 + w*1.0526913;
      d[i] = (b0 + b1 + b2 + w*0.1848) * 0.22;
    }
    return noiseBuf;
  }

  /* měkký tón: plynulý náběh a doznění (žádné lusknutí) */
  function tone(freq, at, dur, {type='sine', vol=0.2, attack=0.012, glideTo=null, dest=null}={}){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at+dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at+attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at+dur);
    o.connect(g); g.connect(dest || master);
    o.start(at); o.stop(at+dur+0.03);
  }

  /* zvon/marimba: základní tón + tichý alikvót, pomalé doznění */
  function bell(freq, at, dur, vol, dest){
    tone(freq, at, dur, {type:'sine', vol, attack:0.015, dest});
    tone(freq*2.0, at, dur*0.45, {type:'sine', vol:vol*0.16, attack:0.015, dest});
    tone(freq*3.01, at, dur*0.22, {type:'sine', vol:vol*0.03, attack:0.015, dest});
  }

  /* šum přes filtr (šustění, kutálení) — vždy s měkkým náběhem */
  function burst(at, dur, {freq=1200, q=0.8, vol=0.2, sweepTo=null, type='bandpass', attack=0.012, dest=null}={}){
    const src = ctx.createBufferSource();
    src.buffer = noise();
    src.playbackRate.value = 0.85 + Math.random()*0.3;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, at);
    if(sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at+dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at+Math.min(attack, dur*0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, at+dur);
    src.connect(f); f.connect(g); g.connect(dest || master);
    src.start(at, Math.random()*0.5); src.stop(at+dur+0.03);
  }

  /* kostky: ještě o kus tlumenější cesta */
  function diceBus(){
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.55;
    lp.connect(g); g.connect(master);
    return lp;
  }
  /* měkké „tuk" kostky o stůl (jako dřevo přes ubrus) */
  function softKnock(at, f, vol, decay, dest){
    burst(at, 0.03, {freq:f*1.3, q:1.6, vol:0.20*vol, attack:0.004, dest});
    tone(f, at, decay, {type:'sine', vol:0.30*vol, attack:0.005, glideTo:f*0.95, dest});
    tone(f*2.3, at, decay*0.5, {type:'sine', vol:0.05*vol, attack:0.005, dest});
  }

  function play(fn){
    const c = ensure();
    if(!c) return;
    try{ fn(c.currentTime + 0.01); }catch(e){ /* zvuk nesmí nikdy shodit hru */ }
  }

  return {
    isEnabled(){ return enabled; },
    setEnabled(v){
      enabled = !!v;
      try{ localStorage.setItem(KEY, enabled ? 'on' : 'off'); }catch(e){}
      if(!enabled && ctx && ctx.state==='running'){ try{ const pr = ctx.suspend(); if(pr && pr.catch) pr.catch(()=>{}); }catch(e){} }
      if(enabled) ensure();
    },
    unlock(){ if(enabled) ensure(); },

    /* klik: tiché dřevěné „tok", žádné pípnutí */
    click(){
      play(t=>{
        tone(720, t, 0.07, {type:'sine', vol:0.105, attack:0.006, glideTo:560});
        tone(1440, t, 0.03, {type:'sine', vol:0.015, attack:0.006});
      });
    },

    /* hod: tichý podkres — kostky párkrát měkce odskočí, pod tím kutálení */
    diceRoll(seconds=1.1){
      play(t=>{
        const bus = diceBus();
        burst(t, seconds, {freq:500, q:0.5, vol:0.05, type:'lowpass', attack:0.15, dest:bus});
        for(let die=0; die<2; die++){
          let x = 0.05 + die*0.06 + Math.random()*0.04;
          let gap = 0.19 + Math.random()*0.05;
          let vol = 0.62;
          const pitch = die ? 1.1 : 0.92;
          for(let n=0; n<7 && x < seconds-0.1; n++){
            softKnock(t+x, (320 + Math.random()*100)*pitch, vol, 0.08, bus);
            x += gap;
            gap = Math.max(0.06, gap*0.74 + (Math.random()-0.5)*0.02);
            vol *= 0.72;
          }
        }
      });
    },

    /* dopad kostky: jemné, zřetelné ťuknutí */
    diceLand(){
      play(t=>{
        const bus = diceBus();
        softKnock(t, 300, 1.9, 0.1, bus);
        softKnock(t+0.05, 380, 0.5, 0.06, bus);
      });
    },

    /* otočení karty: měkké „fff" papíru a tiché dosednutí */
    flip(){
      play(t=>{
        burst(t, 0.2, {freq:500, q:0.7, vol:0.16, sweepTo:1800, attack:0.05});
        tone(260, t+0.17, 0.12, {type:'sine', vol:0.10, attack:0.01, glideTo:200});
      });
    },

    /* karta přilétá k hráči: vánek a měkký zvoneček při dosednutí (~0,6 s) */
    collect(delay=0){
      play(t=>{
        t += delay;
        burst(t, 0.5, {freq:400, q:0.7, vol:0.07, sweepTo:1400, attack:0.18});
        const land = t + 0.58;
        tone(440, land, 0.12, {type:'sine', vol:0.11, attack:0.01, glideTo:360});
        bell(659.25, land+0.02, 0.55, 0.065);
        bell(987.77, land+0.09, 0.5, 0.035);
      });
    },

    /* vítězná fanfára: měkká zvonkohra C–E–G–C a teplý závěrečný akord */
    fanfare(){
      play(t=>{
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f,i)=> bell(f, t+i*0.15, 0.7, 0.13));
        const end = t + notes.length*0.15 + 0.05;
        // akord: měkké sinusové tóny s mírným rozladěním (hřejivý chorus)
        [261.63, 329.63, 392.0, 523.25].forEach((f,i)=>{
          tone(f, end, 1.8, {type:'sine', vol:0.075, attack:0.06});
          tone(f*1.004, end, 1.8, {type:'sine', vol:0.04, attack:0.08});
          if(i===3) tone(f*2, end, 1.4, {type:'sine', vol:0.03, attack:0.1});
        });
        // jemný třpyt (nízko, potichu)
        [1568, 2093, 1760, 2349].forEach((f,i)=> bell(f, end + 0.12 + i*0.1, 0.4, 0.018));
      });
    }
  };
})();

/* Odemknutí zvuku při první interakci (požadavek prohlížečů, hlavně iOS). */
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>Sound.unlock(), {passive:true, capture:true});
});
