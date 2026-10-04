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
   ============================================================ */
const Sound = (function(){
  const KEY = 'flou_sound';
  let enabled = true;
  try{ enabled = localStorage.getItem(KEY) !== 'off'; }catch(e){}
  let ctx = null, master = null, noiseBuf = null;

  function ensure(){
    if(!enabled) return null;
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      try{
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.55;
        // jemný limiter, ať se zvuky při souběhu nepřebuzí
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        master.connect(comp); comp.connect(ctx.destination);
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
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    return noiseBuf;
  }

  /* tón s obálkou (rychlý náběh, exponenciální doznění) */
  function tone(freq, at, dur, {type='sine', vol=0.2, attack=0.005, glideTo=null, dest=null}={}){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at+dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at+attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at+dur);
    o.connect(g); g.connect(dest || master);
    o.start(at); o.stop(at+dur+0.02);
  }

  /* šum přes filtr (chrastění, šustění) */
  function burst(at, dur, {freq=2000, q=1, vol=0.2, sweepTo=null, type='bandpass', dest=null}={}){
    const src = ctx.createBufferSource();
    src.buffer = noise();
    src.playbackRate.value = 0.8 + Math.random()*0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, at);
    if(sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at+dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at+0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at+dur);
    src.connect(f); f.connect(g); g.connect(dest || master);
    src.start(at, Math.random()*0.5); src.stop(at+dur+0.02);
  }

  /* Tlumená cesta pro kostky: filtr ubere ostré výšky (zní to jako kostka
     na stole, ne jako klapka) a celé je to potichu — jen podkres. */
  function diceBus(){
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.55;
    lp.connect(g); g.connect(master);
    return lp;
  }
  /* Měkké „tuk" kostky o stůl: krátký náraz + dva rychle doznívající tóny. */
  function softKnock(at, f, vol, decay, dest){
    burst(at, 0.022, {freq:f*1.5, q:2.2, vol:0.22*vol, dest});
    tone(f, at, decay, {type:'sine', vol:0.30*vol, attack:0.003, glideTo:f*0.96, dest});
    tone(f*2.4, at, decay*0.55, {type:'sine', vol:0.08*vol, attack:0.003, dest});
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

    click(){
      play(t=>{
        tone(1650, t, 0.045, {type:'sine', vol:0.18, attack:0.002, glideTo:1150});
        burst(t, 0.02, {freq:4200, q:2, vol:0.07});
      });
    },

    /* Kostka: tichý podkres. Každá kostka párkrát odskočí (odskoky slábnou
       a zrychlují), pod tím slabé šustění kutálení. */
    diceRoll(seconds=1.1){
      play(t=>{
        const bus = diceBus();
        // šustění kutálení po stole
        burst(t, seconds, {freq:700, q:0.6, vol:0.035, type:'lowpass', dest:bus});
        for(let die=0; die<2; die++){
          let x = 0.05 + die*0.06 + Math.random()*0.04;
          let gap = 0.19 + Math.random()*0.05;
          let vol = 0.62;
          const pitch = die ? 1.1 : 0.92;
          for(let n=0; n<7 && x < seconds-0.1; n++){
            softKnock(t+x, (360 + Math.random()*120)*pitch, vol, 0.07, bus);
            x += gap;
            gap = Math.max(0.06, gap*0.74 + (Math.random()-0.5)*0.02);
            vol *= 0.72;
          }
        }
      });
    },

    /* Dopad: jemné, ale zřetelné ťuknutí a krátké dosednutí */
    diceLand(){
      play(t=>{
        const bus = diceBus();
        softKnock(t, 330, 1.9, 0.09, bus);
        softKnock(t+0.05, 420, 0.5, 0.05, bus);
      });
    },

    flip(){
      play(t=>{
        // šustnutí kartou (filtr přeběhne zdola nahoru) + lehké plesknutí
        burst(t, 0.16, {freq:700, q:0.9, vol:0.34, sweepTo:3800});
        burst(t+0.15, 0.05, {freq:1800, q:1.5, vol:0.24});
        tone(320, t+0.15, 0.06, {type:'sine', vol:0.12, glideTo:220});
      });
    },

    /* Karta přilétá k hráči: krátký vzdušný švih a měkké dosednutí.
       Dosednutí je načasované na konec animace (cca 0,6 s). */
    collect(delay=0){
      play(t=>{
        t += delay;
        burst(t, 0.42, {freq:500, q:1.1, vol:0.10, sweepTo:2600});
        burst(t+0.2, 0.3, {freq:2600, q:1.4, vol:0.06, sweepTo:900});
        const land = t + 0.58;
        tone(540, land, 0.10, {type:'sine', vol:0.16, attack:0.003, glideTo:400});
        burst(land, 0.04, {freq:1600, q:1.2, vol:0.12});
        tone(1320, land+0.03, 0.16, {type:'sine', vol:0.045});
        tone(1760, land+0.08, 0.18, {type:'sine', vol:0.03});
      });
    },

    fanfare(){
      play(t=>{
        // vzestupné arpeggio C–E–G–C a závěrečný akord se třpytem
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f,i)=>{
          tone(f, t+i*0.13, 0.22, {type:'triangle', vol:0.13, attack:0.01});
          tone(f*2, t+i*0.13, 0.12, {type:'sine', vol:0.04});
        });
        const end = t + notes.length*0.13 + 0.04;
        [523.25, 659.25, 783.99, 1046.5].forEach(f=>{
          tone(f, end, 1.25, {type:'triangle', vol:0.085, attack:0.02});
          tone(f*1.003, end, 1.25, {type:'sine', vol:0.05, attack:0.02});
        });
        tone(261.63, end, 1.3, {type:'sine', vol:0.10, attack:0.02});
        for(let i=0;i<6;i++){
          tone(2093 + i*260, end + 0.08 + i*0.07, 0.18, {type:'sine', vol:0.035});
        }
      });
    }
  };
})();

/* Odemknutí zvuku při první interakci (požadavek prohlížečů, hlavně iOS). */
['pointerdown','touchstart','keydown'].forEach(ev=>{
  window.addEventListener(ev, ()=>Sound.unlock(), {passive:true, capture:true});
});
