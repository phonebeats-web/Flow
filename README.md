# FLOU — online verze (V7)

Karetní diskusní hra FLOU jako webová aplikace. Funguje lokálně na jednom
zařízení i online mezi více zařízeními přes kód místnosti.

## Struktura projektu

```
index.html            spojuje vše dohromady
style.css             vzhled
data.js               karty česky: 101 červených, 101 modrých, 101 žlutých, 23 šancí
data_en.js            tytéž karty anglicky (stejné pořadí)
i18n.js               texty rozhraní CZ/EN, volba jazyka, texty karet
theme.js              noční režim — nastaví se před vykreslením (bez probliknutí)
sound.js              zvuky (kostka, karta, klik, fanfára) — vytvářené v prohlížeči, bez souborů
engine.js             ČISTÁ herní logika — bez DOM, bez Firebase, běží i offline
firebase.js           JEDINÉ místo, které zná Firebase API
online.js             online režim: místnosti, realtime sync, reconnect
ui.js                 vykreslování obrazovek
app.js                stav aplikace, local mode, herní akce
firebase-rules.json   bezpečnostní pravidla databáze (po každé změně nahrát do konzole!)
```

## Zabezpečení

**Pravidla databáze (`firebase-rules.json`):**
- Místnost smí číst jen hráči v ní; kdo zná kód, zjistí jen fázi místnosti.
- Založit místnost jde jen s platným kódem; zakladatel je hostitel a jediný hráč.
- Nový hráč se smí zapsat jen do místnosti v čekárně; mimo svůj tah smí hráč
  svoje karty jen ubírat (prohra v kolečku), jméno nejde po připojení změnit.
- Hlasovat / tipovat / volit barvu půlkarty jde jen ve správné fázi; barvu
  si volí jen ten, kdo uhodl. V kolečku smí hráč zapsat jen svou odpověď.
- Karta, balíčky, hod, kolečko a průběh psaní mají pevnou strukturu a rozsahy.
- Záznam hráče smí smazat jen hráč sám; místnost smí smazat jen hostitel
  (hra ji maže, když hostitel opouští čekárnu nebo dohranou hru).

**Ve hře:** text od hráčů (jména, odpovědi, tipy) se vkládá jen jako čistý text
(žádné HTML), kód místnosti se před použitím ověřuje, Content Security Policy
povoluje skripty jen z webu hry a Firebase.

**Doporučená nastavení v konzolích (jednorázově):**
1. Firebase → Realtime Database → Rules: vložit `firebase-rules.json` → Publish.
2. Firebase → Authentication → Settings → Authorized domains: ponechat jen
   `hraflou.cz` (a případně `localhost` pro vývoj).
3. Google Cloud Console → APIs & Services → Credentials → API key („Browser key"):
   Application restrictions → Websites → `https://hraflou.cz/*`;
   API restrictions → jen Identity Toolkit API, Token Service API
   a Firebase Realtime Database API.
4. (Volitelné) Firebase → App Check → zaregistrovat web s reCAPTCHA v3, „site key"
   vložit do `APP_CHECK_SITE_KEY` ve `firebase.js`, po ověření zapnout Enforce.
5. Firebase → Usage and billing: nastavit upozornění na rozpočet.

**Co pravidla neumí:** ověřit celý herní tah (např. že hráč na tahu nepřidá
kartu navíc) — to by vyžadovalo server (Cloud Functions). Pro hru s přáteli
to není potřeba.

## Ovládání a zobrazení

- Karty jsou na šířku (poměr ležící hrací karty 88 : 63), u všech barev a na všech
  obrazovkách stejně velké; na nižších displejích celkově menší. Při vytažení se otočí.
- Průvodce: pod kartou (u hodu pod kostkami) je vždy skleněný panel „Postup" —
  v záhlaví „Na řadě: jméno" (vidět i sbalený), pod ním jedna věta, co se děje.
  Pravidla barev jsou jen na rubu karty pod otazníkem. Karta se otáčí 2D animací
  („jako papír na stole"), plynulou i na starších telefonech.
- Karty šance „přijít o všechny karty" jsou v balíčku jednou, ostatní dvakrát (padají méně).
- Noční režim: dlaždice v ovládacím centru; bez volby se řídí nastavením zařízení.
- Horní lišta jako v iOS: vlevo šipka zpět (ve hře = krok zpět), uprostřed
  kdo je na tahu, vpravo tlačítko Nastavení a křížek. Nastavení se otevře jako
  ovládací centrum v iOS: dlaždice Zvuky, Jazyk a svislý posuvník velikosti písma.
- Skóre všech hráčů je v mřížce, která se zalamuje — na mobilu se nemusí
  posouvat do strany. Plný slot = celá karta, poloviční slot = půlkarta;
  půlkarta je vidět i nad dvěma celými kartami (např. 2 celé + ½).

- Obrazovka se přizpůsobí displeji: když se obsah nevejde, hra ho automaticky
  zhustí (menší karta, mezery, kostky, tlačítka — úrovně `fit-1` a `fit-2`).
  Šipka „Další možnosti níže" se ukáže jen tam, kde ani to nestačí.

## Zvuky

- Házení kostkou (tichý podkres — kostky párkrát odskočí po stole, pak jemné ťuknutí dopadu), otočení karty (nová karta na stole,
  odhalení pravdivé odpovědi u modré, další otázka v sólo hře), ťuknutí při stisku
  tlačítek, přiletění karty k hráči a vítězná fanfára na konci hry.
- Vytvářejí se přímo v prohlížeči (Web Audio API) — žádné zvukové soubory ke stažení.
  Jsou měkké (teplý filtr bez ostrých výšek), ale okamžité: bez dozvuku a kompresoru,
  zvukový výstup se drží vzhůru (telefony ho jinak po tichu uspí a první zvuk se zpozdí).
- Přepínač Zvuky v panelu Nastavení (tlačítko s posuvníky vpravo nahoře) zvuky vypne/zapne;
  volba se pamatuje pro dané zařízení. Online slyší otočení karty i fanfáru všichni.
- Prohlížeče pustí zvuk až po prvním dotyku na stránku; na iPhonu může zvuk ztlumit
  i přepínač tichého režimu.

- Když hráč získá kartu (celou i půlku), přiletí k jeho skóre malá karta té barvy
  a jeho kartička se krátce rozzáří (animace jen transform/opacity — nezpomaluje).
- Všechna potvrzovací a informační okna jsou vlastní, ve stylu hry (žádná
  systémová okna prohlížeče); zavírají se i klávesou Esc nebo klepnutím vedle.

- Velikost písma (v panelu Nastavení) — jako „Velikost textu" v iOS:
  posuvník s 5 stupni (90 %, 100 %, 112 %, 125 %, 140 %), změna se projeví hned.
  Mění se jen písmo (CSS proměnná `--fs`), rozložení hry zůstává; volba se pamatuje
  pro dané zařízení. Vstupní pole nikdy nejsou pod 16 px (iPhone by jinak přibližoval).

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

## Jména a počet hráčů

- Hrát může 2–8 hráčů (na jednom zařízení i online); devátý se nepřipojí.
  (Pravidla Realtime Database neumí počítat hráče, proto to hlídá hra; kdyby se
  při souběžném připojení dostal dovnitř devátý, hostitel hru nespustí.)

- Jména se nesmí opakovat (porovnává se bez ohledu na velikost písmen, mezery a
  diakritiku): na jednom zařízení se shodná jména zvýrazní a „Začít hru" se zablokuje,
  online se nelze připojit se jménem, které už v místnosti někdo má.

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
  Odpovědi se nesmí opakovat (porovnává se bez ohledu na velikost písmen, mezery,
  diakritiku a interpunkci) — shodné se zvýrazní a hra nepustí dál.
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
  u modré otázky proběhne celé kolo modré: soused napíše 3 odpovědi, hádají ostatní
  (i hráč na tahu), půlkarty za uhodnutí, modrou kartu dostane hráč na tahu;
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

## Zabezpečení

Podrobný popis a kontrolní seznam nastavení ve Firebase / Google konzoli je v
**`SECURITY.md`** (pravidla databáze, CSP, App Check, omezení API klíče).

