/* ============================================================
   I18N — texty hry v češtině a angličtině.
   Jazyk patří ZAŘÍZENÍ (uloží se v prohlížeči), ne hře:
   - na jednom zařízení jde přepnout kdykoli vlajkou nahoře,
   - online si každý hráč volí jazyk sám pro sebe.
   Karty se po síti posílají jen jako čísla, takže každý vidí
   otázky ve svém jazyce. (Odpovědi napsané hráči u modré karty
   zůstávají tak, jak je hráč napsal.)
   ============================================================ */

const I18N = {
cs: {
  doc_title:'FLOU — karetní diskusní hra',
  tagline:'KARETNÍ DISKUSNÍ HRA',
  lang_label:'Jazyk',
  lang_hint:'Jazyk si každý volí vlajkou nahoře na svém zařízení — karty uvidí ve svém jazyce.',
  you:'ty',

  c_red:'červená', c_blue:'modrá', c_yellow:'žlutá',
  cA_red:'červenou', cA_blue:'modrou', cA_yellow:'žlutou',
  cP_red:'červené', cP_blue:'modré', cP_yellow:'žluté',

  bar_back:'Zpět', bar_leave:'Opustit', bar_exit_game:'Ukončit hru', bar_exit:'Ukončit',
  bar_undo:'Krok zpět', bar_undo_short:'Zpět',
  sound_mute:'Vypnout zvuky', sound_unmute:'Zapnout zvuky',
  confirm_leave_room:'Opravdu chcete opustit místnost?',
  confirm_exit_online:'Opravdu chcete opustit rozehranou hru? Vrátíte se do hlavní nabídky a z místnosti odejdete.',
  confirm_exit_local:'Opravdu chcete ukončit rozehranou hru? Průběh se ztratí a vrátíte se do hlavní nabídky.',
  scroll_more:'Další možnosti níže', scroll_more_aria:'Posunout níž na další možnosti',

  home_local:'Hrát na jednom zařízení', home_create:'Vytvořit online místnost',
  home_join:'Připojit se ke kódu', home_solo:'Hrát sám — otázky k zamyšlení',
  rules_toggle:'Jak se hraje?',
  r1_t:'Hoď dvakrát kostkou', r1_x:'Rozhoduje první barva. Padnou-li dvě stejné, táhneš nejdřív kartu šance a pak otázku té barvy.',
  r2_t:'Červená = hluboká otázka', r2_x:'Odpovídá jen ten, kdo kartu vytáhl. Ostatní se mohou doptat.',
  r3_t:'Modrá = hádání', r3_x:'Napíšeš tři odpovědi, jedna je pravdivá. Kdo ji uhodne, bere půl karty barvy dle výběru.',
  r4_t:'Žlutá = názor', r4_x:'Odpovídají postupně všichni. Kdo neodpoví, ztrácí žlutou kartu.',
  r5_t:'Oranžová = šance', r5_x:'Karty, které umí pěkně zamíchat hrou.',
  r6_t:'Vyhrává', r6_x:'Kdo má 2 celé karty od každé barvy. Dvě půlky dají jednu celou. Kdo má na začátku tahu 3 karty jedné barvy, může 2 z nich směnit za 1 jinou.',

  setup_title:'Kdo hraje?', setup_sub:'Zadejte jména hráčů, kteří si budou hru podávat.',
  setup_ph:'Jméno hráče {0}', setup_remove:'Odebrat hráče', setup_add:'+ Přidat hráče', setup_start:'Začít hru',
  setup_min2:'Zadejte alespoň 2 jména. Pro hru o samotě zvolte na úvodní obrazovce „Hrát sám".',
  host_title:'Vytvořit místnost', host_sub:'Zadejte své jméno, ostatní se pak připojí kódem.',
  your_name:'Vaše jméno', host_btn:'Vytvořit', host_busy:'Vytvářím…', err_name:'Zadejte jméno.',
  join_title:'Připojit se', join_sub:'Zadejte kód místnosti a své jméno.', join_code_ph:'KÓD MÍSTNOSTI',
  join_btn:'Připojit se', join_busy:'Připojuji…', err_code_name:'Vyplňte kód i jméno.',
  copy_code:'Zkopírovat kód', copied:'Zkopírováno ✓', copy_fail:'Nelze zkopírovat',
  share_link:'Sdílet odkaz', link_copied:'Odkaz zkopírován ✓', share_text:'Pojď hrát FLOU!',
  lobby_title:'Místnost', lobby_players:'Hráči ({0})', badge_you:'Ty', badge_host:'Host',
  lobby_start:'Spustit hru ({0})', lobby_share_hint:'Sdílej kód ostatním, ať se připojí ze svého telefonu nebo počítače.',
  lobby_wait:'Čeká se, až hru spustí host',
  err_offline:'Online režim vyžaduje připojení k internetu.',
  err_create:'Nepodařilo se vytvořit místnost. Zkontroluj připojení k internetu.',
  err_notfound:'Místnost s tímto kódem nebyla nalezena.',
  err_join:'Připojení se nezdařilo. Zkontroluj kód a připojení k internetu.',
  err_min2:'Jsou potřeba alespoň 2 hráči.',
  room_ended:'Místnost byla ukončena.',

  turn_of:'Na tahu: {0}', turn_label:'Na tahu', is_offline:'{0} je offline.',
  skip_turn_btn:'Přeskočit tah hráče {0}', skip_turn_confirm:'Přeskočit tah hráče {0}?',
  roll_btn:'Hodit kostkou', rolling:'Kostka se točí…',
  roll_hint:'Házíš dvakrát. Rozhoduje první barva, dvě stejné znamenají kartu šance.',
  roll_wait:'Čeká se na hod hráče {0}', roll_label:'Hod:', roll_double:'dvě stejné — karta šance',
  leave_q:'Někdo odchází ze hry?', leave_title:'Kdo odchází?',
  leave_sub:'Hra pokračuje bez něj, jeho karty odcházejí s ním.',
  leave_confirm:'{0} opouští hru. Pokračovat?', leave_cancel:'Nikdo, zpět',
  ex_title:'Směna karet', ex_sub:'Máš 3 karty jedné barvy — 2 můžeš vyměnit za 1 jinou.', ex_open:'Směnit',
  ex_give:'Kterou barvu dáš (2 karty)?', ex_want:'Kterou barvu chceš (1 kartu)?',
  ex_do:'Směnit 2 {0} za 1 {1}', ex_cancel:'Nechci směnit',

  answers:'Na otázku odpovídá {0}',
  red_ask_others:'Pokud vám v odpovědi něco není jasné, můžete se doptat.',
  red_banner:'Na otázku odpovídá {0}. Ostatní se v případě nejasností mohou doptat.',
  answered:'Odpověděl/a', answered_gets:'Odpověděl/a — získává kartu', not_answered_loses:'Neodpověděl/a — ztrácí kartu',
  everyone_red_note:'Karta šance: na tuhle červenou otázku odpovídají všichni postupně.',
  st_answered:'odpověděl/a ✓', st_not_answered:'neodpověděl/a', st_now:'je na řadě', st_waiting:'čeká',
  drew_card:'(vytáhl/a kartu)',
  round_done:'Všichni se vystřídali. {0} získává {1} kartu.', round_take:'Vzít kartu a pokračovat',
  round_taking:'{0} bere kartu',
  decide_for:'{0} je offline — rozhodni za něj/ni.',
  answering:'Odpovídá {0}.', answering_first:'Odpovídá {0} (jako první).', answering_wait:'Odpovídá {0}',
  not_answered_loses_col:'Neodpověděl/a — ztrácí {0} kartu', not_answered_has_none:'Neodpověděl/a ({0} kartu nemá)',
  drawer_skip_note:'Když neodpoví ten, kdo kartu vytáhl, kolečko končí.',
  rn_note:'Když {0} odpoví, {2} kartu získává {1}. Když neodpoví, {0} ztrácí {2} kartu (má-li ji).',
  rn_answered:'Odpověděl/a — kartu získává {0}', rn_not_answered:'Neodpověděl/a — {0} ztrácí kartu',

  then_question:'Potom následuje {0} otázka.', chance_resolving:'Kartu šance řeší {0}',
  continue:'Pokračovat', continue_to_q:'Pokračovat na otázku',
  ch_lose_all:'Přijmout — přijít o všechny karty',
  ch_save_hint:'Hoď o záchranu — pokud padne červená, karty si necháváš.', ch_save_btn:'Hodit o záchranu',
  ch_save_fail:'Padla {0} — přicházíš o karty.', ch_save_ok:'Padla červená — karty jsou v bezpečí!',
  ch_again:'Jedu ještě jednou', ch_again_q:'Odpovím a jedu ještě jednou',
  ch_pick_color:'Vyber si barvu otázky, kterou chceš táhnout:',
  ch_reverse:'Změnit směr hry', ch_skip:'Rozumím, teď nehraju',
  ch_everyone_red:'Vytáhnout červenou otázku pro všechny',
  steal_none:'Nikdo zatím nemá žádnou kartu — efekt se přeskakuje.',
  steal_pick:'Vyber hráče a barvu karty, kterou mu ukradneš:', steal_btn:'Ukrást',
  trade_none:'Zatím nemáš žádnou celou kartu, kterou bys mohl/a vyměnit.',
  trade_give:'Výměna je dobrovolná. Kterou svou kartu dáš?', trade_want:'A kterou barvu za ni chceš?',
  trade_btn:'Vyměnit', trade_do:'Vyměnit {0} za {1}',
  trade_skip:'Neměnit — pokračovat', trade_skip_q:'Neměnit — pokračovat na otázku',

  blue_composing:'{0} vymýšlí odpovědi',
  progress_start:'{0} se pouští do psaní odpovědí', progress_writing:'{0} píše odpovědi ({1} ze 3)',
  progress_marking:'{0} vybírá pravdivou odpověď',
  tip_title:'Tipni si předem', tip_q:'Jakou pravdivou odpověď asi {0} napíše?', tip_ph:'Tvůj tip…',
  tip_save:'Uložit tip', tip_saved:'Tvůj tip: {0}', tip_change:'Změnit tip',
  tip_note:'Jen pro zábavu — tipy se ukážou při vyhodnocení.', tip_label:'tip předem:', tip_hit:'trefa ✓',
  tip_reminder:'Tvůj tip předem: {0}',
  blue_intro_head:'Modrá karta = hádání.',
  blue_intro_local:'Zařízení drží {0}, ostatní se zatím nedívají.',
  blue_intro:'Napiš tři odpovědi na otázku — jednu pravdivou a dvě vymyšlené. V dalším kroku označíš, která je pravdivá, a ostatní ji pak budou hádat.',
  blue_ph:'Odpověď {0}', blue_next:'Dále — označit pravdivou', blue_fill_all:'Vyplň všechny tři odpovědi.',
  blue_mark:'Která z tvých odpovědí je {0}? Zbylé dvě jsou vymyšlené.', blue_true_word:'pravdivá',
  blue_submit_local:'Potvrdit a předat k hádání', blue_submit_online:'Odeslat ostatním k hádání',
  blue_edit:'Zpět k úpravě odpovědí',
  votes_count:'Ostatní hádají. Hlasovalo {0}.',
  st_voted:'hlasoval/a ✓', st_offline:'offline', st_waiting_dots:'čeká se…',
  which_was_true:'Která odpověď byla pravdivá?', evaluate:'Vyhodnotit',
  your_pick:'Tvoje volba: {0}', waiting_others:'Čeká se na ostatní',
  guess_q:'Která odpověď je podle tebe pravdivá?', guess_q_named:'{0}, která odpověď je podle tebe pravdivá?',
  handoff_to:'Předej zařízení hráči {0}', handoff_progress:'Hádá {0}. z {1}. Ostatní se nedívají.',
  handoff_iam:'Jsem {0} — ukázat možnosti',
  all_guessed:'Všichni hádali', handoff_back:'Předej zařízení zpět hráči {0}, který vyhodnotí.',
  handoff_iam_eval:'Jsem {0} — vyhodnotit',
  true_answer:'Pravdivá odpověď', guessed_label:'tipoval/a:', no_vote:'nehlasoval/a',
  st_correct:'uhodl/a ✓', st_wrong:'neuhodl/a',
  award_pick_named:'{0} si vybírá barvu půlkarty:', award_change:'Barvu půlkarty můžeš ještě změnit:',
  award_pick_me:'Uhodl/a jsi! Vyber barvu své půlkarty:', waiting_for:'Čeká se na {0}',
  award_pending:'Barvu si ještě vybírá: {0}', nobody_guessed:'Nikdo neuhodl — půlkarty se nerozdávají.',
  blue_continue:'Pokračovat — {0} bere modrou kartu',

  final_right:'{0} získává právo na otázku', final_card:'Zeptej se ostatních na cokoliv.',
  final_note:'Odpovídají všichni. Poslední otázka hry je ta, kterou si vymyslíš sám.',
  final_thinking:'{0} vymýšlí otázku', final_done:'Máme odpovězeno', final_skip:'Nechci ostatním otázku položit',
  winner:'{0} vyhrává!', winner_sub:'Sesbíral/a 2 celé karty od každé barvy.', new_game:'Nová hra',

  solo_kind_red:'Hluboká otázka', solo_kind_blue:'Otázka o tobě', solo_kind_yellow:'Názorová otázka',
  solo_btn_red:'Hluboké', solo_btn_blue:'O mně', solo_btn_yellow:'Názorové',
  solo_count:'{0}. otázka', solo_hint:'Odpověz si v klidu nahlas nebo si odpověď zapiš.',
  solo_prev:'‹ Předchozí', solo_next:'Další ›', solo_new:'Další otázka ›', solo_pick:'Nebo si vyber, na co máš chuť:',
  solo_filter_title:'Jaké otázky chceš?',
  solo_filter_all:'Padají otázky všech barev. Klepnutím na barvu budou padat jen otázky té barvy.',
  solo_filter_some:'Padají jen otázky zaškrtnutých barev. Když vše odškrtneš, budou zase padat všechny.',
},

en: {
  doc_title:'FLOU — the conversation card game',
  tagline:'CONVERSATION CARD GAME',
  lang_label:'Language',
  lang_hint:'Everyone picks their language with the flag at the top of their own device — cards appear in that language.',
  you:'you',

  c_red:'red', c_blue:'blue', c_yellow:'yellow',
  cA_red:'red', cA_blue:'blue', cA_yellow:'yellow',
  cP_red:'red', cP_blue:'blue', cP_yellow:'yellow',

  bar_back:'Back', bar_leave:'Leave', bar_exit_game:'Exit game', bar_exit:'Exit',
  bar_undo:'Undo', bar_undo_short:'Undo',
  sound_mute:'Mute sounds', sound_unmute:'Turn sounds on',
  confirm_leave_room:'Do you really want to leave the room?',
  confirm_exit_online:'Do you really want to leave this game? You will return to the main menu and leave the room.',
  confirm_exit_local:'Do you really want to end this game? Your progress will be lost and you will return to the main menu.',
  scroll_more:'More options below', scroll_more_aria:'Scroll down to more options',

  home_local:'Play on one device', home_create:'Create an online room',
  home_join:'Join with a code', home_solo:'Play solo — food for thought',
  rules_toggle:'How to play',
  r1_t:'Roll the die twice', r1_x:'The first colour decides. If both rolls are the same colour, you first draw a chance card and then a question of that colour.',
  r2_t:'Red = deep questions', r2_x:'Only the player who drew the card answers. The others may ask follow-up questions.',
  r3_t:'Blue = guessing', r3_x:'You write three answers, one of them true. Whoever guesses it gets half a card in a colour of their choice.',
  r4_t:'Yellow = opinions', r4_x:'Everyone answers in turn. Anyone who doesn\'t answer loses a yellow card.',
  r5_t:'Orange = chance', r5_x:'Cards that can really shake up the game.',
  r6_t:'How to win', r6_x:'Collect 2 whole cards of each colour. Two halves make one whole card. If you have 3 cards of one colour at the start of your turn, you can swap 2 of them for 1 of another colour.',

  setup_title:'Who\'s playing?', setup_sub:'Enter the names of the players who will pass the device around.',
  setup_ph:'Player {0}', setup_remove:'Remove player', setup_add:'+ Add player', setup_start:'Start game',
  setup_min2:'Enter at least 2 names. To play alone, choose "Play solo" on the home screen.',
  host_title:'Create a room', host_sub:'Enter your name — the others will join with a code.',
  your_name:'Your name', host_btn:'Create', host_busy:'Creating…', err_name:'Please enter your name.',
  join_title:'Join a room', join_sub:'Enter the room code and your name.', join_code_ph:'ROOM CODE',
  join_btn:'Join', join_busy:'Joining…', err_code_name:'Please enter both the code and your name.',
  copy_code:'Copy code', copied:'Copied ✓', copy_fail:'Couldn\'t copy',
  share_link:'Share link', link_copied:'Link copied ✓', share_text:'Come and play FLOU!',
  lobby_title:'Room', lobby_players:'Players ({0})', badge_you:'You', badge_host:'Host',
  lobby_start:'Start game ({0})', lobby_share_hint:'Share the code so the others can join from their phone or computer.',
  lobby_wait:'Waiting for the host to start the game',
  err_offline:'Online mode requires an internet connection.',
  err_create:'Couldn\'t create the room. Please check your internet connection.',
  err_notfound:'No room was found with this code.',
  err_join:'Couldn\'t join. Please check the code and your internet connection.',
  err_min2:'At least 2 players are needed.',
  room_ended:'The room has been closed.',

  turn_of:'Turn: {0}', turn_label:'Now playing', is_offline:'{0} is offline.',
  skip_turn_btn:'Skip {0}\'s turn', skip_turn_confirm:'Skip {0}\'s turn?',
  roll_btn:'Roll the die', rolling:'Rolling…',
  roll_hint:'You roll twice. The first colour decides; two of the same colour mean a chance card.',
  roll_wait:'Waiting for {0} to roll', roll_label:'Roll:', roll_double:'a double — chance card',
  leave_q:'Is someone leaving the game?', leave_title:'Who is leaving?',
  leave_sub:'The game continues without them; their cards leave with them.',
  leave_confirm:'{0} is leaving the game. Continue?', leave_cancel:'Nobody — go back',
  ex_title:'Card swap', ex_sub:'You have 3 cards of one colour — you can swap 2 of them for 1 of another colour.', ex_open:'Swap',
  ex_give:'Which colour will you give (2 cards)?', ex_want:'Which colour do you want (1 card)?',
  ex_do:'Swap 2 {0} for 1 {1}', ex_cancel:'No swap',

  answers:'{0} answers the question',
  red_ask_others:'If anything in the answer is unclear, you can ask follow-up questions.',
  red_banner:'{0} answers the question. If anything is unclear, the others may ask follow-up questions.',
  answered:'Answered', answered_gets:'Answered — gets a card', not_answered_loses:'Didn\'t answer — loses a card',
  everyone_red_note:'Chance card: everyone answers this red question in turn.',
  st_answered:'answered ✓', st_not_answered:'didn\'t answer', st_now:'their turn', st_waiting:'waiting',
  drew_card:'(drew the card)',
  round_done:'Everyone has had their turn. {0} gets a {1} card.', round_take:'Take the card and continue',
  round_taking:'{0} is taking the card',
  decide_for:'{0} is offline — decide for them.',
  answering:'{0} is answering.', answering_first:'{0} is answering (first).', answering_wait:'{0} is answering',
  not_answered_loses_col:'Didn\'t answer — loses a {0} card', not_answered_has_none:'Didn\'t answer (has no {0} card)',
  drawer_skip_note:'If the player who drew the card doesn\'t answer, the round ends.',
  rn_note:'If {0} answers, {1} gets a {2} card. If they don\'t, {0} loses a {2} card (if they have one).',
  rn_answered:'Answered — {0} gets the card', rn_not_answered:'Didn\'t answer — {0} loses a card',

  then_question:'Then comes a {0} question.', chance_resolving:'{0} is resolving the chance card',
  continue:'Continue', continue_to_q:'Continue to the question',
  ch_lose_all:'Accept — lose all cards',
  ch_save_hint:'Roll to save yourself — if red comes up, you keep your cards.', ch_save_btn:'Roll to save',
  ch_save_fail:'Rolled {0} — you lose your cards.', ch_save_ok:'Red came up — your cards are safe!',
  ch_again:'I\'ll go again', ch_again_q:'I\'ll answer and go again',
  ch_pick_color:'Choose the colour of the question you want to draw:',
  ch_reverse:'Reverse direction', ch_skip:'OK, I\'ll sit this one out',
  ch_everyone_red:'Draw a red question for everyone',
  steal_none:'Nobody has any cards yet — this effect is skipped.',
  steal_pick:'Choose a player and the colour of the card you\'ll steal:', steal_btn:'Steal',
  trade_none:'You don\'t have any whole card to swap yet.',
  trade_give:'Swapping is optional. Which of your cards will you give?', trade_want:'And which colour do you want for it?',
  trade_btn:'Swap', trade_do:'Swap {0} for {1}',
  trade_skip:'No swap — continue', trade_skip_q:'No swap — continue to the question',

  blue_composing:'{0} is writing answers',
  progress_start:'{0} is getting started on the answers', progress_writing:'{0} is writing answers ({1} of 3)',
  progress_marking:'{0} is choosing the true answer',
  tip_title:'Guess in advance', tip_q:'What do you think {0}\'s true answer will be?', tip_ph:'Your guess…',
  tip_save:'Save guess', tip_saved:'Your guess: {0}', tip_change:'Change guess',
  tip_note:'Just for fun — the guesses are shown at the reveal.', tip_label:'guessed in advance:', tip_hit:'spot on ✓',
  tip_reminder:'Your advance guess: {0}',
  blue_intro_head:'Blue card = guessing.',
  blue_intro_local:'{0} is holding the device — no peeking, everyone else.',
  blue_intro:'Write three answers to the question — one true and two made up. In the next step you\'ll mark which one is true, and then the others will try to guess it.',
  blue_ph:'Answer {0}', blue_next:'Next — mark the true one', blue_fill_all:'Please fill in all three answers.',
  blue_mark:'Which of your answers is {0}? The other two are made up.', blue_true_word:'true',
  blue_submit_local:'Confirm and pass on for guessing', blue_submit_online:'Send to the others to guess',
  blue_edit:'Back to editing answers',
  votes_count:'The others are guessing. Votes in: {0}.',
  st_voted:'voted ✓', st_offline:'offline', st_waiting_dots:'waiting…',
  which_was_true:'Which answer was true?', evaluate:'Reveal',
  your_pick:'Your pick: {0}', waiting_others:'Waiting for the others',
  guess_q:'Which answer do you think is true?', guess_q_named:'{0}, which answer do you think is true?',
  handoff_to:'Pass the device to {0}', handoff_progress:'Guesser {0} of {1}. Everyone else, no peeking.',
  handoff_iam:'I\'m {0} — show the answers',
  all_guessed:'Everyone has guessed', handoff_back:'Pass the device back to {0} to reveal the answer.',
  handoff_iam_eval:'I\'m {0} — reveal',
  true_answer:'The true answer', guessed_label:'guessed:', no_vote:'didn\'t vote',
  st_correct:'guessed right ✓', st_wrong:'guessed wrong',
  award_pick_named:'{0} picks the colour of their half card:', award_change:'You can still change the colour of your half card:',
  award_pick_me:'You guessed it! Pick the colour of your half card:', waiting_for:'Waiting for {0}',
  award_pending:'Still picking a colour: {0}', nobody_guessed:'Nobody guessed it — no half cards this time.',
  blue_continue:'Continue — {0} takes the blue card',

  final_right:'{0} earns the right to ask a question', final_card:'Ask the others anything you like.',
  final_note:'Everyone answers. The last question of the game is one you make up yourself.',
  final_thinking:'{0} is thinking of a question', final_done:'We\'ve answered', final_skip:'I don\'t want to ask a question',
  winner:'{0} wins!', winner_sub:'Collected 2 whole cards of each colour.', new_game:'New game',

  solo_kind_red:'Deep question', solo_kind_blue:'Question about you', solo_kind_yellow:'Opinion question',
  solo_btn_red:'Deep', solo_btn_blue:'About me', solo_btn_yellow:'Opinion',
  solo_count:'Question {0}', solo_hint:'Take your time — answer out loud or write your answer down.',
  solo_prev:'‹ Previous', solo_next:'Next ›', solo_new:'Next question ›', solo_pick:'Or pick what you\'re in the mood for:',
  solo_filter_title:'Which questions would you like?',
  solo_filter_all:'You\'re getting questions of all colours. Tap a colour to get only questions of that colour.',
  solo_filter_some:'You\'re only getting questions of the ticked colours. Untick them all to get every colour again.',
}
};

/* ---------- jazyk zařízení ---------- */
const LANG_KEY = 'flou_lang';
function detectLang(){
  try{
    const saved = localStorage.getItem(LANG_KEY);
    if(saved==='cs' || saved==='en') return saved;
  }catch(e){}
  const n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'cs').toLowerCase();
  return (n.startsWith('cs') || n.startsWith('sk')) ? 'cs' : 'en';
}
let LANG = detectLang();
function applyLangToDocument(){
  document.documentElement.lang = LANG;
  document.title = I18N[LANG].doc_title;
}
function setLang(l){
  if(!I18N[l]) return;
  LANG = l;
  try{ localStorage.setItem(LANG_KEY, l); }catch(e){}
  applyLangToDocument();
}
applyLangToDocument();

/* t('klic', a, b) -> text s dosazenými {0}, {1} */
function t(key, ...args){
  let s = I18N[LANG][key];
  if(s===undefined) s = I18N.cs[key];
  if(s===undefined) return key;
  return s.replace(/\{(\d)\}/g, (m,i)=> args[i]!==undefined ? String(args[i]) : '');
}
/* tn('klic', uzel, ...) -> pole textů a DOM uzlů (např. tučné jméno),
   aby slovosled mohl být v každém jazyce jiný. */
function tn(key, ...args){
  let s = I18N[LANG][key];
  if(s===undefined) s = I18N.cs[key];
  if(s===undefined) return [key];
  const out = [];
  let last = 0;
  const used = new Set();
  s.replace(/\{(\d)\}/g, (m,i,off)=>{
    if(off>last) out.push(s.slice(last, off));
    // Tentýž DOM uzel nemůže být na stránce dvakrát — při opakování se zkopíruje.
    let a = args[i];
    if(a && typeof a==='object' && a.nodeType){
      if(used.has(i)) a = a.cloneNode(true);
      used.add(i);
    }
    out.push(a);
    last = off + m.length;
    return m;
  });
  if(last < s.length) out.push(s.slice(last));
  return out;
}

function colorName(c){ return t('c_'+c); }   // 1. pád: červená / red
function colorAcc(c){ return t('cA_'+c); }   // 4. pád j. č.: červenou
function colorPl(c){ return t('cP_'+c); }    // mn. č.: červené
function playersWord(n){
  if(LANG==='en') return n+' '+(n===1 ? 'player' : 'players');
  return n+' '+(n===1 ? 'hráč' : (n>=2 && n<=4) ? 'hráči' : 'hráčů');
}

/* ---------- texty karet ---------- */
/* Texty karet šance podle druhu karty. Jsou tady (ne jen v data.js),
   aby se vždy ukázal aktuální text — i kdyby na webu zůstal starší data.js. */
const CHANCE_CS = {
  lose_all: "Přicházíš o všechny karty.",
  lose_all_unless_red: "Přicházíš o všechny karty, pokud ti nepadne červená.",
  go_again: "Jedeš ještě jednou.",
  change_color: "Můžeš změnit barvu karty své otázky.",
  right_answers: "Na otázku odpovídá hráč po tvé pravici, pokud neodpoví, ztrácí danou barvu karty.",
  reverse: "Změna směru hry proti směru hodinových ručiček.",
  skip_next: "Teď nehraješ.",
  steal: "Můžeš někomu ukradnout jednu libovolnou kartu.",
  trade_one_for_one: "Jednu svou kartu můžeš vyměnit za kartu jiné barvy, pokud chceš.",
  trade_two_for_one: "Jednu svou kartu můžeš vyměnit za kartu jiné barvy, pokud chceš.",
  everyone_red: "Všichni odpovídají na červenou otázku."
};
function questionText(color, idx){
  const src = (LANG==='en' && typeof QUESTIONS_EN!=='undefined') ? QUESTIONS_EN : QUESTIONS;
  return (src[color] && src[color][idx]) || QUESTIONS[color][idx] || '';
}
function chanceText(idx){
  const c = CHANCE_CARDS[idx];
  if(!c) return '';
  if(LANG==='en' && typeof CHANCE_EN!=='undefined' && CHANCE_EN[c.key]) return CHANCE_EN[c.key];
  return CHANCE_CS[c.key] || c.text;
}
function cardText(card){
  if(!card) return '';
  if(card.idx===undefined || card.idx===null) return card.text || '';   // starší uložené hry
  return card.type==='chance' ? chanceText(card.idx) : questionText(card.color, card.idx);
}
