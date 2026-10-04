# FLOU — online verze (V6)

Karetní diskusní hra FLOU jako webová aplikace. Funguje lokálně na jednom
zařízení i online mezi více zařízeními přes kód místnosti.

## Struktura projektu

```
index.html            spojuje vše dohromady
style.css             vzhled
data.js               karty česky: 101 červených, 101 modrých, 101 žlutých, 23 šancí
data_en.js            tytéž karty anglicky (stejné pořadí)
i18n.js               texty rozhraní CZ/EN, volba jazyka, texty karet
sound.js              zvuky (kostka, karta, klik, fanfára) — vytvářené v prohlížeči, bez souborů
engine.js             ČISTÁ herní logika — bez DOM, bez Firebase, běží i offline
firebase.js           JEDINÉ místo, které zná Firebase API
online.js             online režim: místnosti, realtime sync, reconnect
ui.js                 vykreslování obrazovek
app.js                stav aplikace, local mode, herní akce
firebase-rules.json   bezpečnostní pravidla databáze (po každé změně nahrát do konzole!)
```

## Ovládání a zobrazení

- Horní lišta jako v iOS: vlevo šipka zpět (ve hře = krok zpět), uprostřed
  kdo je na tahu, vpravo jazyk (vlajky) a křížek pro ukončení hry.
- Skóre všech hráčů je v mřížce, která se zalamuje — na mobilu se nemusí
  posouvat do strany. Plný slot = celá karta, poloviční slot = půlkarta;
  půlkarta je vidět i nad dvěma celými kartami (např. 2 celé + ½).

- Obrazovka se přizpůsobí displeji: když se obsah nevejde, hra ho automaticky
  zhustí (menší karta, mezery, kostky, tlačítka — úrovně `fit-1` a `fit-2`).
  Šipka „Další možnosti níže" se ukáže jen tam, kde ani to nestačí.

## Zvuky

- Házení kostkou (chrastění + dopad každé kostky), otočení karty (nová karta na stole,
  odhalení pravdivé odpovědi u modré, další otázka v sólo hře), ťuknutí při stisku
  tlačítek a vítězná fanfára na konci hry.
- Vytvářejí se přímo v prohlížeči (Web Audio API) — žádné zvukové soubory ke stažení.
- Tlačítko s reproduktorem (na úvodu vlevo nahoře, ve hře v liště) zvuky vypne/zapne;
  volba se pamatuje pro dané zařízení. Online slyší otočení karty i fanfáru všichni.
- Prohlížeče pustí zvuk až po prvním dotyku na stránku; na iPhonu může zvuk ztlumit
  i přepínač tichého režimu.

## Jazyky (čeština / angličtina)

- Jazyk patří **zařízení**, ne hře — přepíná se vlajkou nahoře kdykoli,
  i uprostřed tahu (hodí se, když se u jednoho zařízení střídají Češi a angličtináři).
- Online si každý hráč volí jazyk na svém zařízení. Karty se po síti posílají
  jen jako **čísla**, takže každý vidí otázky ve svém jazyce.
- Odpovědi, které hráči sami napíšou u modré karty, zůstávají tak, jak byly napsány.
- Při první návštěvě se jazyk odhadne podle prohlížeče (čeština/slovenština → CZ,
  jinak EN), pak se pamatuje.
- Texty karet šance jsou v `i18n.js` (CHANCE_CS) a `data_en.js` (CHANCE_EN) podle
  druhu karty — pro změnu textu karty šance uprav tam.
- Nový text přidáš do obou částí slovníku v `i18n.js`; nové otázky na stejné místo
  v `data.js` i `data_en.js`.

## Režimy

- **Jedno zařízení** — hráči si zařízení podávají. Na začátku tahu může kdokoli
  hru opustit (jen při 3 a více hráčích).
- **Online** — každý na svém zařízení, připojení kódem nebo odkazem.
- **Hrát sám** — jen otázky k zamyšlení: bez kostky, karet šance, bodů a hádání.
  Dole lze zaškrtnout barvy — pak padají jen otázky těchto barev; když je vše
  odškrtnuté, padají všechny. Lze se vracet k předchozím otázkám.

## Pravidla hry (jak je hra implementuje)

- Hráč hází **dvakrát** kostkou se třemi barvami (červená, modrá, žlutá).
  Rozdílné barvy → otázka **první** barvy. Dvě stejné → nejdřív **karta šance**,
  pak (pokud to karta dovolí) otázka té barvy.
- **Směna na začátku tahu:** kdo má od jedné barvy aspoň 3 celé karty, může
  2 z nich vyměnit za 1 kartu jiné barvy. Jinak se možnost nezobrazuje.
- **Červená** (hluboké otázky): odpovídá jen ten, kdo kartu vytáhl. Ostatní se
  mohou doptat. Odpoví → celá červená karta, neodpoví → ztrácí červenou.
- **Modrá** (hádání): hráč napíše 3 odpovědi a v dalším kroku označí pravdivou.
  Na jednom zařízení pak zařízení koluje — každý hádá zvlášť (předchozí volby
  nevidí) — a vrací se k autorovi, který vyhodnotí. Online hádají všichni najednou.
  Kdo uhodne, bere půl karty barvy dle výběru, autor bere celou modrou.
  Online, zatímco autor píše, vidí ostatní živý průběh („píše odpovědi 2 ze 3",
  „vybírá pravdivou") a mohou si předem tipnout, jakou pravdivou odpověď napíše.
  Tip je jen pro zábavu (bez bodů) — při vyhodnocení se ukáže a trefa se označí.
- **Žlutá** (názorové otázky) a karta šance **„Všichni odpovídají na červenou"**
  (jediný případ, kdy na červenou odpovídají všichni): kolečko — odpovídají postupně všichni, začíná ten, kdo kartu vytáhl. Kdo
  neodpoví, ztrácí kartu té barvy (má-li ji). Když kolečko dojde zpět k tomu,
  kdo kartu vytáhl, bere celou kartu té barvy. Když neodpoví hned na začátku
  on sám, ztrácí kartu a kolečko končí.
- **Oranžová** (šance) po dvojitém hodu:
  „Jedeš ještě jednou" → odpovíš na otázku a hraješ znovu;
  „Změň barvu" → vybereš barvu otázky;
  „Odpovídá hráč po pravici" → odpovídá na otázku padlé barvy; když odpoví,
  kartu získává hráč, který kartu šance vytáhl; když ne, soused kartu ztrácí;
  „Teď nehraješ" → tah končí bez otázky;
  „Všichni odpovídají na červenou" → kolečko místo otázky z hodu;
  „Jednu svou kartu můžeš vyměnit za kartu jiné barvy, pokud chceš" →
  dobrovolná výměna 1 karty za 1 jiné barvy;
  ostatní (ztráta karet, krádež, změna směru) → pak následuje otázka.
- Vyhrává, kdo má **2 celé karty od každé barvy** (2 půlky = 1 celá).
- **Krok zpět** (horní lišta) vrátí hru o krok — opakovaně, až 30 kroků.
  Online ho vidí host a hráč na tahu.

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
