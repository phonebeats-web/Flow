# FLOU — zabezpečení

Hra běží celá v prohlížeči (bez vlastního serveru) a online část používá
Firebase Realtime Database s anonymním přihlášením. Zabezpečení proto stojí
na třech vrstvách: **pravidla databáze**, **ochrana v prohlížeči** a
**nastavení ve Firebase / Google konzoli**.

## 1. Co je hotové v kódu

### Pravidla databáze (`firebase-rules.json`)
- Bez přihlášení nelze nic číst ani zapisovat; mimo `/rooms` nelze nic.
- Seznam místností nejde vypsat. Místnost smí číst jen hráči v ní; kdo zná
  kód, zjistí jen fázi místnosti (kvůli hlášce „nenalezena / už začala“).
- Mimo svůj tah smí hráč vlastní karty jen ubírat; jméno nejde po připojení změnit;
  nový hráč se smí zapsat jen do místnosti v čekárně.
- Kód místnosti musí mít platný formát (5–6 znaků bez I, O, 0, 1).
- Založit místnost lze jen jako vlastní (hostId = moje uid) a jen v čekárně.
- **Každá položka má kontrolu tvaru, typu a velikosti** (karta, balíčky,
  kolečko, hody, hlasy, tipy…), nepovolené položky jsou odmítnuty — do databáze
  nejde uložit libovolná ani velká data.
- Nový hráč se může připojit jen v čekárně; do rozehrané hry ne
  (kdo v ní už je, se po obnovení stránky vrátí).
- Hráč smí měnit jen svůj záznam; cizí jen hráč na tahu (předávání karet)
  nebo hostitel. Hlasovat, tipovat a volit barvu půlkarty smí každý jen za sebe.
- Hostitel smí svou místnost smazat; místnosti starší 48 hodin smí smazat kdokoli.
- Časové značky nesmí být v budoucnosti (tolerance 1 den kvůli špatně
  nastaveným hodinám v telefonech).

### Ochrana v prohlížeči a v kódu
- **CSP** (Content-Security-Policy v `index.html`): stránka smí načítat skripty
  a připojovat se jen k povoleným adresám (web, Firebase, písma Google,
  reCAPTCHA pro App Check). Cizí kód se nenačte.
- Hru nelze vložit do cizí stránky (ochrana proti clickjackingu).
- Texty od hráčů (jména, odpovědi, tipy) se nikdy nevkládají jako HTML, jen
  jako text — nelze přes ně vložit škodlivý kód.
- Jména se čistí od neviditelných a řídicích znaků (např. obrácení směru
  textu, kterým by šlo podvrhnout, jak jméno vypadá) a zkracují na 24 znaků.
- Kód místnosti má 6 znaků (přes miliardu kombinací) — nejde ho uhádnout.
- Kód z odkazu (`?kod=…`) se přijme jen v platném formátu.
- Hostitel, který odchází z čekárny nebo z dohrané hry, místnost smaže
  (jména hráčů nezůstávají v databázi).
- Limit 8 hráčů a kontrola stejných jmen při připojení.

## 2. Co je potřeba nastavit v konzoli (udělej jednou)

1. **Pravidla databáze** — Realtime Database → Rules → vložit
   `firebase-rules.json` → Publish.
2. **Povolené domény přihlášení** — Authentication → Settings → Authorized
   domains: nech jen `hraflou.cz` (a případně `localhost` na zkoušení).
   Ostatní smaž.
3. **Omezení API klíče** — Google Cloud Console → APIs & Services →
   Credentials → klíč „Browser key" (ten z `firebase.js`):
   - *Application restrictions* → **Websites** → `https://hraflou.cz/*`
   - *API restrictions* → jen **Identity Toolkit API** a **Token Service API**
     (případně **Firebase App Check API**).
   Klíč v kódu je u Firebase veřejný z principu — chrání ho právě tato omezení
   a pravidla databáze.
4. **App Check (důrazně doporučeno)** — chrání databázi před roboty a skripty
   mimo tvůj web:
   - Firebase konzole → App Check → Apps → zaregistrovat web přes
     **reCAPTCHA v3** (získáš veřejný *site key*).
   - Vlož ho do `firebase.js` do `APP_CHECK_SITE_KEY = '…'` a nahraj.
   - Pár dní sleduj v App Check metrikách, že požadavky chodí ověřené,
     pak zapni **Enforce** pro *Realtime Database* a *Authentication*.
5. **Upozornění na útratu a provoz** — Google Cloud → Billing → Budgets &
   alerts (např. upozornění při 1 Kč), a ve Firebase → Usage and billing
   sleduj využití databáze. Na tarifu Spark (zdarma) se nic nestrhne, jen
   se databáze při vyčerpání limitu zastaví.

## 3. Co zabezpečení neřeší (a proč)

- **Podvádění hráče na tahu.** Kdo je na tahu, může s upraveným prohlížečem
  zapsat i nelegální tah (např. si přidat kartu). Pravidla databáze neznají
  pravidla hry. Plná ochrana by vyžadovala server (Cloud Functions), který by
  házel kostkou a přiděloval karty sám. Pro hru s přáteli to není potřeba.
- **Vyhodnocení odpovědí je sociální** — jestli někdo „odpověděl", rozhodují
  hráči u stolu, ne technika.
- **Automatické mazání starých místností** — pravidla mazání dovolují, ale
  samo od sebe se nic nespustí. Kdyby místností přibývalo hodně, lze přidat
  naplánovanou funkci (Cloud Functions, tarif Blaze), která místnosti starší
  48 hodin smaže.
- **HTTP hlavičky** (HSTS, frame-ancestors) na GitHub Pages nastavit nejdou;
  CSP je proto v `<meta>` a ochrana proti vložení do cizí stránky v kódu.
  Při přechodu na Netlify/Cloudflare Pages je lze doplnit souborem `_headers`.
