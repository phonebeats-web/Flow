# Flow — online verze (V2)

Karetní diskusní hra Flow jako webová aplikace. Funguje lokálně na jednom
zařízení i online mezi více zařízeními přes kód místnosti.

## Struktura projektu

```
index.html            spojuje vše dohromady
css/style.css         vzhled (beze změny oproti V1)
js/data.js            karty: 101 červených, 101 modrých, 101 žlutých, 23 šancí
js/engine.js          ČISTÁ herní logika — bez DOM, bez Firebase, běží i offline
js/firebase.js        JEDINÉ místo, které zná Firebase API
js/online.js          online režim: místnosti, realtime sync, reconnect
js/ui.js              vykreslování obrazovek
js/app.js             stav aplikace, local mode, herní akce
firebase-rules.json   bezpečnostní pravidla databáze
```

Pravidlo architektury: `engine.js` nesmí nikdy volat Firebase ani DOM.
Firebase API se smí objevit pouze v `js/firebase.js`.

## Nasazení na hosting

Nahraj obsah celé složky na libovolný statický hosting:

- **GitHub Pages** — nahraj do repozitáře, Settings → Pages → zapni
- **Netlify** — přetáhni složku do netlify.com/drop
- **Vercel**, **Cloudflare Pages** — obdobně

Žádný build, žádné npm, žádný vlastní server. Firebase SDK se načítá z CDN.

### Nutná nastavení ve Firebase konzoli (projekt `flowgame-fb137`)

1. **Authentication → Sign-in method → Anonymous → Enable**
   Hráči se přihlašují neviditelně na pozadí, žádný login formulář nevidí.
2. **Realtime Database → Rules** → vlož obsah `firebase-rules.json` → Publish
3. **Authentication → Settings → Authorized domains** → přidej doménu,
   kde bude hra běžet (např. `tvujucet.github.io`), jinak anonymní
   přihlášení z té domény selže.

## Co pravidla chrání a co ne

**Chrání:**
- Bez přihlášení (byť anonymního) nelze číst ani zapisovat nic.
- Do sdíleného stavu hry (fáze, tah, karty, balíčky, vítěz) může zapisovat
  jen hráč, který je právě na tahu.
- Hráč může měnit svůj vlastní záznam; cizí záznamy jen tehdy, když je na tahu
  (nutné pro udělování půlkaret a efekty karet šance).
- Struktura dat je omezená — nelze do místnosti ukládat libovolná data,
  počty karet mají povolený rozsah, fáze musí být z povoleného seznamu.
- Nelze zapisovat mimo `/rooms`.

**Nechrání (a proč):**
- Kdo je na tahu, může technicky zapsat i tah, který by podle pravidel hry
  nebyl legální (např. udělit si víc karet). Realtime Database pravidla neumí
  ověřit celý herní tah — musela by k tomu znát pravidla hry.
- Vyhodnocení „kdo uhodl správně" je ve Flow **sociální, ne technické** — hráči
  se dohadují nahlas a aktivní hráč rozhoduje. Žádný server tohle ověřit nemůže,
  protože sám neví, co bylo řečeno u stolu.
- Kdokoli, kdo zná kód místnosti, se do ní může připojit.

**Kdy by byl potřeba backend (Cloud Functions):** pokud by hra měla být odolná
proti hráči, který si upraví kód ve svém prohlížeči — tedy házení kostkou,
míchání balíčku a přidělování karet by musel provádět server. Pro hraní
s kamarády to považuji za zbytečné; pro veřejnou soutěžní verzi by to bylo nutné.
