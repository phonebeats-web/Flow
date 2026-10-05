(window.FLOU_FILES = window.FLOU_FILES || {})['theme.js'] = '35';   /* verze souboru — kontrola, že jsou na webu všechny soubory stejné verze */
/* Noční režim — nastaví se hned při načtení stránky (před vykreslením),
   aby neproblikl světlý vzhled. Bez ruční volby se řídí nastavením zařízení. */
(function(){
  var t = null;
  try{ t = localStorage.getItem('flou_theme'); }catch(e){}
  if(t !== 'dark' && t !== 'light'){
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content', t === 'dark' ? '#0F1524' : '#E9502E');
})();
