# FLOU — online verze (V3)

Karetní diskusní hra FLOU jako webová aplikace. Funguje lokálně na jednom
zařízení i online mezi více zařízeními přes kód místnosti.

## Struktura projektu

```
index.html            spojuje vše dohromady
style.css             vzhled
data.js               karty: 101 červených, 101 modrých, 101 žlutých, 23 šancí
engine.js             ČISTÁ herní logika — bez DOM, bez Firebase, běží i offline
firebase.js           JEDINÉ místo, které zná Firebase API
online.js             online režim: místnosti, realtime sync, reconnect
ui.js                 vykreslování obrazovek
app.js                stav aplikace, local mode, herní akce
firebase-rules.json   bezpečnostní pravidla databáze (po každé změně nahrát do konzole!)
```

## Pravidla hry (jak je hra implementuje)

- Hráč hází **dvakrát** kostkou se třemi barvami (červená, modrá, žlutá).
  Rozdílné barvy → otázka **první** barvy. Dvě stejné → nejdřív **karta šance**,
  pak (pokud to karta dovolí) otázka té barvy.
- **Červená** (hluboké otázky): odpovídá jen ten, kdo kartu vytáhl. Ostatní se
  mohou doptat. Odpoví → celá červená karta, neodpoví → ztrácí červenou.
- **Modrá** (hádání): hráč vymyslí 3 odpovědi (1 pravdivá). Kdo uhodne, bere
  půl karty barvy dle svého výběru. Hráč na tahu bere celou modrou.
- **Žlutá** (názorové otázky): odpovídají postupně všichni, začíná ten, kdo kartu
  vytáhl, pak ostatní ve směru hry. Kdo neodpoví, ztrácí žlutou kartu (má-li ji).
  Když kolo dojde zpět k tomu, kdo kartu vytáhl, bere celou žlutou kartu.
  Když neodpoví hned na začátku ten, kdo kartu vytáhl, ztrácí žlutou a kolo končí.
- **Oranžová** (šance) po dvojitém hodu:
  „Jedeš ještě jednou" → odpovíš na otázku a hraješ znovu;
  „Změň barvu" → vybereš barvu otázky;
  „Odpovídá hráč po pravici" → odpovídá na otázku padlé barvy;
  „Teď nehraješ" → tah končí bez otázky;
  „Všichni odpovídají na červenou" → nahrazuje otázku z hodu;
  ostatní karty (ztráta karet, krádež, výměna, změna směru) → pak následuje otázka.
- Vyhrává, kdo má **2 celé karty od každé barvy** (2 půlky = 1 celá).

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
- Hlasovat u modré a volit barvu půlkarty může každý jen za sebe.
- U žluté otázky smí hráč, který je právě na řadě, zapsat jen svou odpověď
  a posun kola.
- Host smí přeskočit tah hráče, který odešel (aby hra nestála).
- Místnost lze založit jen jako vlastní (hostId = moje uid) a hráč se může
  připojit jen do existující místnosti.
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
