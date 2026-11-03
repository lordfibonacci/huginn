# Huginn: spjöld og spjall (hönnunarskjal)

Dagsetning: 2026-11-03
Staða: samþykkt af Heimi í samtali 3. nóv eftir hugmyndavinnu með Claude (Fable), með mockupum í vafra (`.superpowers/brainstorm/877553-1793721116/content/`: `card-options.html` B, `card-glow.html` daufur, `chat-tab-v4.html`, `reader.html` B, `zones.html` A).
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (gagnalíkan), plan 6 (`docs/superpowers/plans/2026-11-01-olesid.md`, ólesið úr `hg_events`). Þetta skjal breytir framsetningu, engin ný tafla og engin migration.

Þetta er fyrsta af fjórum verkum úr samtalinu 3. nóv. Hin þrjú (skjöl: lýsing, sækja og lesari; leit og tögg; kassar og tiltekt) fá sín eigin skjöl.

## 1. Tilgangur

Heimir hugsar myndrænt og man hvar kort eru. Borðið virkar fyrir hann af því að það er landakort, en spjöldin sjálf eru öll eins: sama stærð, sama grá fletir, tögg sem segja lítið ("pakki Árna", "fyrir sýningu", "sýning" og "syning" hlið við hlið), "C October 31" sem skiptir sjaldan máli, og stöðulitir sem hvergi eru útskýrðir. Þegar hann rennir yfir borðið sér hann ekki hvað þarf athygli.

Spjallið er til (athugasemdir neðst á spjaldinu, `hg_comments`, ólesið gegnum `hg_events`) en það lítur út eins og dagbók ("Heimir skrifaði athugasemd") inni í Saga flipanum, svo hvorki hann né Árni nota það sem samtal, og Claude í byggingarlotu sér það alls ekki, því `item.md` speglar ekki athugasemdir.

Lagfæringin: spjaldið sýnir minna og það sem skiptir máli, kort með eitthvað nýtt fær daufan gullbjarma og eina línu sem segir hvað, spjallið verður eigin flipi með kúlum í þremur litum, og `item.md` fær Spjall kaflann svo lotan lesi það.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Rólegt spjald segir aðeins stöðu, titil og módúl. Spjald með eitthvað nýtt sker sig úr með bjarma, ekki með fleiri orðum.
- Ein lína neðst á spjaldi segir hvað er nýtt. Ný skilaboð sýna hver sagði hvað.
- Spjall flipi sem lítur út og hagar sér eins og spjallforrit: þín skilaboð hægra megin, hinna vinstra megin, Claude í sínum lit, "nýtt" lína þar sem ólesið byrjar.
- Litaskýring á einum stað svo litirnir fimm séu ekki ráðgáta.
- Claude les spjallið í `item.md` og svarar í því með `huginn comment add`.

**Ekki-markmið**

- Spjall sem er ekki bundið við kort (eitt fyrir verkefnið). Spjallið er þráður kortsins, Heimir staðfesti það 3. nóv.
- Að breyta Saga flipanum. Hann sýnir áfram allt, líka skilaboðin, í einni tímalínu.
- Að breyta tögum, leit eða síum. Tögg hverfa af spjaldinu en standa áfram í haus spjaldsins (panel) og í síunni þar til leitarverkið tekur við.
- Push tilkynningar, hljóð, "séð" merki, breyta eða eyða skilaboðum.
- Nýjar töflur, dálkar eða triggerar. `hg_unread` telur `comment.added` nú þegar.

**And-markmið**

- Lituð rönd eða bar vinstra megin á spjaldi, kúlu eða línu, hvergi. Heimir kallar það "gervigreindarröndina" og vill aldrei sjá hana (3. nóv). Athygli er bjarmi, höfundur er litur kúlunnar.
- Bjarmi sem er svo sterkur að borð með tuttugu ólesin kort verður gult. Daufi bjarminn var valinn fram yfir sterkan.
- Spjald sem verður lengra en í dag. Það á að styttast.

## 3. Skorður

- Sama Supabase verkefni, aðeins `hg_` hlutir, engin migration í þessu verki.
- CLI afritar stærðir spjaldsins (`estimateCardHeight` í `cli/lib/write.mjs`, `base` úr `--hg-card-*` tókens). Spjaldið breytist (tögg burt, módúllína inn, dagsetning skilyrt), svo matið breytist með og `parity.test.mjs` gætir þess að tókens stemmi (sjá 4.1).
- Skillið `/huginn` býr í `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md`, ekki í Huginn repoinu. Planið snertir bæði repo og segir hvar hvert verk er.
- Nýir UI strengir undir `vinnubord.*` í `en.json`, `npm run translate` fyrir `is.json`, diffið á `is.json` yfirfarið. Stöðutextar áfram harðkóðaðir íslenskir (R5).
- Allt sem ákveður hvað spjaldið og spjallið sýna er hreint fall í `src/vinnubord/lib/` með vitest prófi. Hvorki `ItemCard` né nýi flipinn reikna neitt sjálf.
- Engin ný söfn. Engin rönd.

## 4. Hegðun

### 4.1 Spjaldið (`ItemCard`)

Röð að ofan, allt annað fer:

1. **Staða**: punktur í tón og stöðutexti, óbreytt (`.hg-card-st`).
2. **Titill**, óbreytt.
3. **Módúll**: nafn módúlsins sem texti, `.hg-card-module`, `--hg-ink-3`, `--hg-card-by-size`, ein lína klippt með ellipsis (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`), svo CLI matið (ein lína) og vefurinn stemma. Ekkert ef verkið hefur engan módúl. Enginn litur, engin rönd.
4. **Hver hreyfði og hvenær** (`.hg-card-by`, hringur með stuttu nafni og `formatStamp`): aðeins þegar `updated_at` er innan síðustu 7 daga (`CARD_STAMP_DAYS` í `lib/cards.ts`, hreint fall `showStamp(updatedAt, now)`). Eldra spjald sleppir línunni. Prófað með föstum `now`.
5. **Flögur** (`.hg-card-chips`): "N skjöl" og "N hjá þér" (eða "N opin handtök" þegar engin eru á þeim sem horfir), eins og í dag. **Tögg eru ekki á spjaldinu.** `item.tags` er ekki lesið í `ItemCard`.
6. **Plan línur** og "Plan N af M", óbreytt.
7. **Nýtt línan** (4.3), aðeins þegar eitthvað er ólesið.

`.hg-card-ring` (punkturinn í horninu í tón spjaldsins) hverfur úr `ItemCard` og úr CSS, og tókensin `--hg-ring-size`, `--hg-ring-offset`, `--hg-ring-border` og `--hg-ring-glow` fara með (listinn les `--hg-list-dot-ring`, ekki þau). Listinn (`ListDrawer`) breytist ekki.

CLI: `estimateCardHeight(item, board, now)` fær `now` (sjálfgefið `Date.now()`), sleppir tögum úr flögunum, bætir módúllínu við þegar `item.module_id` er sett (ein lína, `cardBySize * LH_NORMAL + cardModuleGap`) og telur `by` línuna (`cardStGap + avSize`, eins og í dag) aðeins þegar `updated_at` er innan 7 daga. `base` í `write.mjs` fær `cardBySize` (`--hg-card-by-size`) og `cardModuleGap` (`--hg-card-module-gap`), `parity.test.mjs` ber þau saman við CSS eins og hin, og `CARD_STAMP_DAYS` er afritaður í `write.mjs` og borinn saman við `lib/cards.ts`. Ekkert nýtt leturstærðartókens: módúllínan notar `--hg-card-by-size`.

### 4.2 Bjarminn

- Spjald með `fresh !== null` (sama skilyrði og hringurinn hafði) fær klasann `.hg-card-new`. Ekkert annað breytist í skilyrðinu: eigin breytingar telja aldrei, lesmerki frá server klukku, `hg_mark_all_read` tekur hann af öllum.
- Útlit: brún í `var(--hg-card-new-border)`, skuggi `0 0 0 1px var(--hg-card-new-ring), 0 0 var(--hg-card-new-size) var(--hg-card-new-spread) var(--hg-card-new-color)` á undan venjulega spjaldskugganum. Gildi í tókens (kafli 5). Þetta er "daufur bjarmi" úr `card-glow.html`. Tókensin heita `--hg-card-new-*` því `--hg-card-glow` er þegar til (blur punktsins í `.hg-card-dot`) og stendur óbreytt.
- Bjarminn er alltaf gull, óháð tón spjaldsins. Hann er merki um "horfðu hér", ekki staða.
- Lyft spjald (`.hg-card-lift`) og hover: bjarminn stendur undir lyftiskugganum, lyftiskugginn vinnur. Dimmað spjald (`.hg-card-dim`): bjarminn dofnar með spjaldinu, engin sérregla.
- `pointer: coarse`: sama bjarmi (blur er á skugga, ekki backdrop, og kostar ekkert við pan).
- `prefers-reduced-motion`: engin hreyfing er á bjarmanum, ekkert að núlla.

### 4.3 Nýtt línan

Kemur í stað "Síðan síðast:" með flögum. Ein lína, `.hg-card-fresh`, gull texti, hárlína ofan við eins og í dag, klippt í eina línu með ellipsis (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`).

Hreint fall `freshLine(summary, freshComment, t)` í `lib/cards.ts` (strengir koma úr `t`, fallið skilar `{ kind: 'created' } | { kind: 'comment', short, text } | { kind: 'kinds', text }`, `ItemCard` teiknar):

1. `summary.created`: "Nýtt spjald" (óbreytt).
2. Annars, sé ólesið skilaboð á kortinu (`freshComment !== null`): `{short}: {fyrsta lína skilaboðanna}`, til dæmis `Á: Sjáumst kl 10, tek iPadinn með`. Stutta nafnið feitletrað. Önnur ólesin atriði sjást ekki í línunni, spjallið vinnur.
3. Annars: tegundirnar úr `freshChips(summary)` sem einn texti með kommu á milli, sömu strengir og í dag (`vinnubord.card.fresh.kinds.*`), og "+N" úr `more` aftast. Til dæmis `+1 skjal, 1 svar`.

`freshComment` kemur úr `cardModels`: nýjasta athugasemd á kortinu þar sem `user_id !== viewerId` og `created_at` er nýrra en lesmerki þess sem horfir (`readAtOf(reads, item.id, viewerId)`, ekkert lesmerki þýðir allar). `CardModel` fær `freshComment: { short: string; line: string } | null`, `line` er fyrsta lína `body` (`split('\n')[0].trim()`), ellipsis sér um lengdina. `cardModels` fær `comments` og `reads` í `CardContext`. Prófað í `cards.test.ts`: eigin athugasemd telur ekki, eldri en lesmerki telur ekki, nýjasta vinnur, fjöllínu body gefur fyrstu línu.

### 4.4 Litaskýring

Áhorfanda valmyndin (`ViewerMenu` í `TopBar.tsx`) fær blokk "Litir" milli "Merkja allt lesið" og tungumálalínunnar, með `.hg-menu-sep` á báðum hliðum: fimm línur, punktur í tón og texti. Skýringin lýsir lit spjaldsins (`itemTone`), ekki pillunum (`BUCKET_TONE` telur verk með opið handtak á þeim sem horfir undir coral þótt spjaldið sé lilac eða teal; það er talning, ekki litur):

- gold: Nýtt, eða bíður Claude
- coral: Bíður þín
- lilac: Bíður annarra
- teal: Tilbúið eða í smíðum
- stone: Parkerað eða lokið

Röðin er sú sama og `TONES` í `status.ts` nema coral og lilac skipta um sæti svo "Bíður þín" standi á undan "Bíður annarra". Textar í `vinnubord.top.legend.*`. Engin ný valmynd, enginn nýr hnappur. Á síma er valmyndin sú sama.

### 4.5 Spjall flipinn

`ItemPanel` fær flipann `chat`, röðin verður `status, chat, files, questions, history`. Flipatexti "Spjall" (`vinnubord.panel.tabs.chat`). Gulpunktur á flipanum (`.hg-pn-tab-dot`, 7 px, `--hg-gold`, bjarmi) þegar eitthvert skilaboð á kortinu er `fresh` (sama `fresh(created_at, user_id)` og hinir fliparnir nota) og flipinn hefur ekki verið opnaður síðan spjaldið opnaðist (local state í `ItemPanel`, `chatSeen`). Punkturinn fer þegar flipinn er valinn og kemur ekki aftur fyrr en spjaldið er opnað á ný, nema nýtt skilaboð berist meðan annar flipi er opinn (þá `chatSeen = false` aftur; realtime kemur með það).

Nýr `ChatTab` í `components/panel/ChatTab.tsx`, teiknar línurnar úr hreinu falli `chatRows(comments, participants, viewerId, fresh)` í `lib/chat.ts`:

- Skilaboð kortsins (`comment.item_id === item.id`) í tímaröð, elsta efst.
- Dagskil (`{ type: 'day', label }`) á undan fyrsta skilaboði hvers dags: "í dag", "í gær", annars dagsetning úr `formatStamp` reglunum (sama fall og annars staðar, bara dagshlutinn). Hreint, prófað.
- "nýtt" skil (`{ type: 'new' }`) á undan fyrsta skilaboði sem er `fresh`. Ein í mesta lagi. Stendur meðan spjaldið er opið (sama og `.hg-fresh` í hinum flipunum, `readAtOnOpen` reglan).
- Hvert skilaboð `{ type: 'message', id, who: 'me' | 'them' | 'claude', short, name, body, at, fresh }`. `who`: `user_id === viewerId` gefur `me`, þátttakandi með `is_service` gefur `claude`, annars `them`. Óþekktur höfundur (ekki þátttakandi lengur) er `them` með short `?`.

Útlit (úr `chat-tab-v4.html`):

- Kúla `.hg-msg` með `.hg-msg-me`, `.hg-msg-them`, `.hg-msg-claude`. `me` liggur hægra megin (`align-self: flex-end`), hinar vinstra megin. Mesta breidd 82% af spjaldinu. Radíus `--hg-msg-radius` (16 px), hornið sem snýr að brúninni 6 px. Litir: `--hg-msg-them-bg` (`#1d2838`), `--hg-msg-me-bg` (`#2f5f94`), `--hg-msg-claude-bg` (`#4a3566`) með léttum skugga `--hg-msg-claude-glow`. Engin rönd.
- Undir kúlunni ein lína `.hg-msg-who`: `{name}, {tími}` í `--hg-ink-3`, hjá `me` stendur "Þú" (`vinnubord.chat.you`). Hægri jöfnuð hjá `me`.
- Meginmál er venjulegur texti með `white-space: pre-wrap` og `overflow-wrap: anywhere`. Enginn Markdown. Slóðir sem byrja á `http` verða tenglar (`rel="noopener"`, opnast í nýjum flipa), ekkert annað er túlkað.
- Dagskil `.hg-chat-day`: miðjuð smá lína í `--hg-ink-3`. "nýtt" skil `.hg-chat-new`: gull texti með hárlínu til beggja hliða (eins og mockupið).
- Tómt spjall: ein lína "Engin skilaboð enn" (`vinnubord.chat.empty`) miðjuð.
- Spjallið á engan eigin skrunara: það skrunar sameiginlega `.hg-pn-body` eins og hinir fliparnir. `choose('chat')` setur `scrollTop` neðst í stað 0 (eða að "nýtt" skilunum ef þau eru til, þannig að þau sjást efst í glugganum), mælt eftir að flipinn er orðinn sýnilegur. Nýtt skilaboð sem berst meðan flipinn er opinn og listinn er skrunaður neðst skrunar neðst áfram; sé hann skrunaður upp stendur hann kyrr. Á síma gildir áfram reglan í `PanelShell` að snerting í meginmálinu tekur blaðið aðeins niður frá skruntoppi, svo opið spjall skrunað neðst dregst niður um handfangið, hausinn eða loka hnappinn, eins og hver annar langur flipi sem er skrunaður niður. Engin breyting á `PanelShell`.
- Skilaboð frá Claude sem er sent úr lotu (`huginn comment add`) lítur eins út og önnur. Engin merking "sjálfvirkt".

Sendingarkassinn (`CommentBox`) stendur áfram neðst á spjaldinu undir öllum flipum, eins og í dag, með tveimur breytingum:

- Placeholder "Skrifa skilaboð" (`vinnubord.panel.comment.placeholder` uppfært).
- Enter sendir, Shift+Enter gefur nýja línu, á tækjum með `pointer: fine`. Á `pointer: coarse` gefur Enter nýja línu og Senda hnappurinn sendir (lyklaborð síma hafa ekki Shift+Enter sem fólk notar). Ctrl+Enter sendir áfram alls staðar. Hint textinn (`vinnubord.panel.comment.hint`) segir regluna sem gildir.
- Að senda velur Spjall flipann og skrunar neðst, úr hvaða flipa sem er.

`CommentBox` er einn og sameiginlegur með `ModulePanel`, svo kassinn á módúlspjaldinu fær sama placeholder og sömu Enter reglu. Ekkert annað á `ModulePanel` breytist (athugasemdir á módúlum eru áfram listi, enginn Spjall flipi þar í þessu verki).

### 4.6 Saga flipinn

Óbreyttur að öðru leyti en að línan "skrifaði athugasemd" verður "skrifaði í spjallið" (`vinnubord.history.commentAdded`). Skilaboðin standa þar áfram sem færslur, svo tímalínan er heil.

### 4.7 `item.md` og skillið

`renderItemMd` í `cli/lib/mirror.mjs` fær kaflann `## Spjall` á eftir `## Spurningar` og á undan `## Skrár`, aðeins þegar kortið á skilaboð:

```
## Spjall

- 2026-10-31 11:20 Árni: Ég er kominn með fyrsta brief, set það inn á morgun. Viltu hafa Lostæti listann með?
- 2026-10-31 11:42 Heimir: Já, taktu hann með.
- 2026-10-31 16:05 Claude: Setti briefið sem skjal á kortið.
```

Tímaröð, `iso` stimpill eins og annars staðar í skránni, nafn úr `person(user_id, participants)`, fjöllínu body með inndregnum framhaldslínum (`multiLine`). `sync` þarf `comments` í gögnunum sínum (`format.mjs` tekur þau nú þegar með í `pull`, `sync` les sömu hleðslu). Prófað í `mirror.test.mjs`.

`/huginn` skillið (metta2_new) fær tvær setningar:

- Við lotubyrjun og þegar verk er opnað: lestu `## Spjall` í `item.md`. Spurning til Claude í spjallinu er beiðni eins og spurning í Spurningar, nema hún er svöruð með `huginn comment add <item> --body "..."`, ekki með `question answer`.
- Lotulok: eitt skilaboð í spjallið með `comment add` þegar lotan kláraði eitthvað sem Heimir eða Árni spurðu um í spjallinu. Engin skylda annars, handtökin og samantektin segja stöðuna.

### 4.8 Ólesið annars staðar

- Pillan "N ólesin", ólesið sían, listinn og `hg_mark_all_read`: óbreytt. Bjarminn er bara ný mynd sama ástands.
- Skilaboð frá Claude (service user) í spjallinu telst ólesið hjá Heimi og Árna eins og í dag (`hg_unread`: actor er ekki sá sem horfir).

## 5. Útlit

Tókens, breytingar í `:root` í `vinnubord.css`:

Í "Item cards":

```
--hg-card-module-gap: 4px;
--hg-card-new-size: 28px;
--hg-card-new-spread: 2px;
--hg-card-new-border: color-mix(in oklab, var(--hg-gold) 45%, var(--hg-line));
--hg-card-new-ring: color-mix(in oklab, var(--hg-gold) 25%, transparent);
--hg-card-new-color: color-mix(in oklab, var(--hg-gold) 22%, transparent);
```

`--hg-card-glow` (blur punktsins) stendur óbreytt. `--hg-ring-size`, `--hg-ring-offset`, `--hg-ring-border`, `--hg-ring-glow` fara.

Nýr kafli "Chat" á eftir "Status tab, files, questions and history":

```
--hg-msg-radius: 16px;
--hg-msg-tail-radius: 6px;
--hg-msg-max-w: 82%;
--hg-msg-pad: 10px 13px;
--hg-msg-size: 14px;
--hg-msg-gap: 10px;
--hg-msg-who-size: 11px;
--hg-msg-them-bg: #1d2838;
--hg-msg-me-bg: #2f5f94;
--hg-msg-claude-bg: #4a3566;
--hg-msg-claude-glow: 0 0 22px -4px rgba(216, 164, 255, 0.35);
--hg-chat-day-size: 11px;
--hg-chat-day-gap: 6px 0 2px;
--hg-pn-tab-dot: 7px;
```

`pointer: coarse` blokkin: `--hg-msg-claude-glow: none`. Reglurnar undir tókens blokkinni lesa aðeins tókens, eins og áður.

Klasar: `.hg-card-module`, `.hg-card-new`, `.hg-pn-tab-dot`, `.hg-chat`, `.hg-chat-day`, `.hg-chat-new`, `.hg-chat-empty`, `.hg-msg`, `.hg-msg-me`, `.hg-msg-them`, `.hg-msg-claude`, `.hg-msg-body`, `.hg-msg-who`, `.hg-legend`, `.hg-legend-dot`.

## 6. Prófanir

- `cards.test.ts`: `showStamp` (6 dagar já, 8 dagar nei, núll nei), `freshComment` reglurnar (4.3), `freshLine` þrjú tilfelli og "+N".
- `chat.test.ts`: `chatRows` dagskil (sama dagur einu sinni, í dag, í gær, dagsetning), "nýtt" skil á réttum stað og aldrei tvisvar, `who` fyrir viewer, service og annan, óþekktan höfund.
- `parity.test.mjs`: `CARD_STAMP_DAYS` og módúllínan stemma milli `src` og `cli`.
- `mirror.test.mjs`: Spjall kaflinn, röð, fjöllínu body, sleppt þegar engin skilaboð.
- `npm run build` grænt, `npm run test` grænt, `npm run shots:hg phone` tekur spjaldið á síma með opnu spjalli (ný mynd `phone-10-chat`).
- Handpróf Heimis (skráð í `docs/progress/12-spjold-og-spjall.md`): spjald með og án bjarma hlið við hlið, nýtt skilaboð frá Árna sést á spjaldi Heimis með stutta nafninu og fyrstu línunni, flipinn með punkti, "nýtt" skilin, Enter sendir á tölvu og gefur nýja línu á síma, `huginn sync` skrifar Spjall kaflann.

## 7. Ákvarðanir Claude í skjalinu (Heimir sá þær ekki, má snúa)

- Dagsetningarlínan á spjaldi sést í 7 daga. Heimir sagði "ef hreyft í vikunni".
- "N opin handtök" flagan stendur áfram þegar sá sem horfir á engin sjálfur. Hann nefndi hana ekki.
- Skilaboðalínan á spjaldinu vinnur yfir aðrar tegundir þegar hvort tveggja er ólesið.
- Enter sendir aðeins á `pointer: fine`.
- Spjallið túlkar engan Markdown, aðeins slóðir.
- Sendingarkassinn stendur undir öllum flipum, eins og í dag, og sending opnar Spjall.
- Litaskýringin er í áhorfanda valmyndinni, ekki nýr hnappur, og lýsir lit spjaldsins, ekki pillunum.
- `## Spjall` í `item.md` er listi, ekki tafla.
- Kassinn á módúlspjaldinu fær sama placeholder og Enter reglu, því `CommentBox` er einn.
- Spjallið á engan eigin skrunara og `PanelShell` breytist ekki.
- Saga línan verður "skrifaði í spjallið".

## 8. Eftir hjá byggjanda

- Nákvæm `formatStamp` dagsskil og hvort `dateUtils` á þegar "í gær".
- Útfærsla á skruni þegar `hidden` flipi verður sýnilegur (mæla eftir að hann er sýndur).
- Playwright skotið `phone-10-chat` í `scripts/hg-shots.mjs`.
