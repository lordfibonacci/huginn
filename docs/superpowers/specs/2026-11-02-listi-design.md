# Huginn: listi við hliðina á kortinu (hönnunarskjal)

Dagsetning: 2026-11-02
Staða: samþykkt af Heimi í samtali 2. nóv eftir hugmyndavinnu með Claude (Fable). Plan: `docs/superpowers/plans/2026-11-02-listi.md`.
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (gagnalíkan, kort, spjald), `2026-11-01-olesid-og-synir-design.md` (ólesið, sýnir) og `2026-11-01-simi-og-spjaldtolva-design.md` (síma- og spjaldtölvulag). Engin ný tafla, engin migration, engin breyting á CLI.

## 1. Tilgangur

Kortið er gott til að sjá samhengi: hvaða verk hanga á hvaða módúl, hvað pulsar, hvað er í bið. Það er verra til að finna eitt tiltekið verk þegar 32 spjöld liggja um borðið, mörg með svipuðum titlum, og sum undir öðrum eða utan skjásins. Heimir lýsti því 2. nóv: "erfitt að finna allt uppi stundum á kortinu svona."

Listinn er leiðarvísir við hliðina á kortinu, ekki önnur sýn. Hann sýnir sömu verk og kortið, í sömu flokkun (pakki, módúll), með sömu línuupplýsingum og spjaldið ber, og smellur á línu rennir kortinu að spjaldinu og opnar hliðarspjaldið. Kortið er áfram aðalatriðið, listinn er leiðin að réttu spjaldi.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Finna verk á þremur sekúndum: opna listann, renna augum eftir módúlum eða slá leitarorð í stikuna, smella.
- Listinn og kortið segja alltaf það sama: sama sýn, sömu pillur, sama leit, sömu síur, sömu tölur.
- Ekkert nýtt þarf að læra: flokkunin er sú sama og á kortinu og línan sýnir það sem spjaldið sýnir.
- Virkar á síma og spjaldtölvu með sama hnappi.

**Ekki-markmið**

- Að skipta kortinu út fyrir lista. Listinn er alltaf við hliðina á því eða yfir því, aldrei í staðinn fyrir það.
- Að sýna lokuð verk (done, dropped). Þau sjást ekki á kortinu og ekki í listanum. Módúlspjaldið sýnir þau áfram.
- Að breyta neinu úr listanum: engin staða, engin handtök, ekkert drag. Allar breytingar fara gegnum spjaldið eins og áður.
- Að gera listann sjálfgefinn á síma. Kortið opnast fyrst eins og núna (Heimir, 2. nóv).
- Ný tafla, dálkur, migration eða CLI skipun.

**And-markmið**

- Listi sem sýnir aðrar tölur eða önnur verk en kortið og pillurnar. Þá treystir enginn hvorugu.
- Annar leitarreitur í listanum. Leitin í stikunni er leitin.
- Að listinn hægi á kortinu: hann má ekki snerta viewport, springs eða Wires rammana.

## 3. Skorður

- Allt nýtt býr í `src/vinnubord/`, hrein rökfræði í `lib/` með vitest skrá við hliðina, engin React eða Supabase þar.
- Allir litir, stærðir og hreyfingar sem tókens á `:root` í `vinnubord.css` undir nýjum kafla "List drawer", reglurnar lesa aðeins tókens. Snertitækin fá sínar yfirskriftir í `(pointer: coarse)` blokkinni eins og hin yfirborðin.
- Nýir UI strengir undir `vinnubord.list.*` í `en.json`, `npm run translate` fyrir `is.json`. Stöðutextar eru áfram harðkóðaðir íslenskir úr `status.ts` (úrskurður R5).
- Ekkert nýtt safn. Táknið er inline SVG eins og hin táknin í stikunni.
- Stærðartókens korta (`--hg-pack-*`, `--hg-module-*`, `--hg-card-*`) breytast ekki, svo `cli/lib/parity.test.mjs` er ósnert.

## 4. Hegðun

### 4.1 Hnappurinn

- Nýr táknhnappur `.hg-list-btn` (`hg-icon-btn`) í `.hg-top-b` hópnum í stikunni, fremst, á undan Lifandi punktinum. Þrjár láréttar línur með punkti fyrir framan hverri (listatákn), ekki sama tákn og síuhnappurinn (sem er rennistillar).
- `aria-pressed` og `hg-on` meðan listinn er opinn. Smellur víxlar.
- Sést í báðum lögum stikunnar (breið og tveggja raða undir 1024 px). Undir 1024 px situr hann í efri röðinni hjá leitar- og síuhnappnum.
- Flýtilykill: enginn í fyrstu útgáfu. Escape lokar listanum þegar ekkert spjald, blað eða valmynd er opið (spjaldið á Escape fyrst, eins og núna).

### 4.2 Opið eða lokað man sig

- Lykill í `localStorage`: `hg.list.<projectId>` með json gildinu `{ open: boolean, sort: Sort }`, einn lykill fyrir hvort tveggja. Sama mynstur og `useActiveView` (`hg.view.<projectId>`): lesið við fyrstu teikningu, skrifað þegar valið breytist, þegjandi ef geymslan er lokuð. Hreint fall `parseListPrefs(raw)` í `lib/list.ts` skilar alltaf gildu gildi (ógild eða tóm geymsla þýðir lokað, eftir pakka).
- Tvö ástönd í `useListPrefs`: geymda breiða ástandið (`open` í lyklinum) og minnisástand fyrir mjóa lagið (undir 1024 px), sem byrjar alltaf lokað og er aldrei skrifað í geymsluna. Opnun, lokun og lokun við smell á línu í mjóa laginu snerta aðeins minnisástandið. Röðunin er ein og skrifast úr báðum lögum. Þannig lokar smellur á iPad í portrait ekki listanum sem var opinn í landscape, og snúningur yfir 1024 px sýnir geymda gildið, undir 1024 px byrjar lokað. Prófað í `list.test.ts` sem hreint `listState(prefs, narrow, memory)` fall.

### 4.3 Listinn á desktop (1024 px og breiðara)

- `aside.hg-list` með `role="region"` og `aria-label` "Listi". Liggur `absolute` yfir `.hg-board-wrap` (utan `.hg-board`, svo viewport sér hann ekki, en innan borðsvæðisins, svo stikan í hvaða hæð sem er, ein röð eða tvær með leit, liggur alltaf ofan við hann): `left: var(--hg-safe-left)`, `top: 0`, `bottom: 0`, breidd `--hg-list-w` (320 px). Hálfgegnsær: `--hg-list-bg` (sama grunngildi og `--hg-panel-bg`), `--hg-list-blur` (sama og `--hg-panel-blur`), hárlína hægra megin í `--hg-line`. Z-index `--hg-list-z` (24) undir toastinu (`--hg-toast-z` 25, svo "nýtt verk" toastið sést yfir fullum lista á síma) og undir spjaldinu (`--hg-panel-z` 30), yfir borðstýringunum.
- Kortið heldur stærð og stöðu þegar listinn opnast eða lokast (valkostur A, Heimir 2. nóv): rofinn hreyfir sýnina aldrei. Zoom hnapparnir neðst til hægri hreyfast ekki. Aðgerðir sem reikna sýn (fyrsta opnun, "Sýna allt", pakkatitill, `reveal`) nota hins vegar lausa svæðið úr `freeRect` (4.8), svo fyrsti pakkinn lendir ekki undir listanum þegar hann er munaður opinn við endurhleðslu. `fit` og `fitWidth` í `useViewport` taka nú þegar `Padding`; `Board` fær `listWidth` prop (0 þegar listinn er lokaður eða mjóa lagið) og leggur það við `sides` vinstra megin, sem þýðir að `Padding` fær `left` og `right` í stað `sides`.
- Haus: titill "Listi" með fjölda verka sem sjást í listanum (`vinnubord.list.count`, "32 verk"), röðunarval (`select`, þrjú gildi, sjá 4.5), loka hnappur (44 px snertimark eins og `.hg-sheet-close`).
- Meginmál skrunar sjálft (`overflow-y: auto`, `overscroll-behavior: contain`). Hjól yfir listanum skrunar listann, ekki zoomar kortið: listinn liggur utan `.hg-board`, svo `useViewport` sér hann ekki.
- Opnun og lokun: rennur inn frá vinstri yfir `--hg-dur-view` með `--hg-ease`, núllað undir `prefers-reduced-motion`. Lokaður listi er ekki í DOM.

### 4.4 Listinn á síma og spjaldtölvu (undir 1024 px)

- Sami hnappur. Listinn tekur allt borðið undir stikunni: `left: 0`, `right: 0`, bakgrunnur ógegnsær (`--hg-board`), engin blur. Sama haus, sama meginmál, sömu línur, snertimörk 44 px á línum (`min-height: var(--hg-touch)`).
- Opnun: rennur inn frá vinstri eins og á desktop. Lokun með loka hnappnum, Escape, eða smelli á línu.
- Síublaðið og nýtt verk blaðið liggja yfir listanum eins og yfir kortinu (þau eru `fixed` með hærra z-index). Listinn lokar sér ekki þegar þau opnast.
- Við smell á línu lokast listinn fyrst, svo rennur kortið að spjaldinu og botnblaðið (sími) eða spjaldið (spjaldtölva) opnast. Lokun og glide í sömu lotu, engin bið.

### 4.5 Flokkun og röðun

Röðunarvalið er þrennt, gildin heita `pack`, `status` og `updated`:

- **Eftir pakka** (sjálfgefið). Pakkar í `packLayout` röðinni (`position`), módúlar í sinni `position` röð innan pakkans, verk innan módúls eftir fötu í röð pillanna (`COUNT_ORDER` í `TopBar.tsx`: new, mine, others, build, parked) og svo titli (`localeCompare` með `is`). Hver pakki er fyrirsögn (`.hg-list-pack`, lítil upphafsstafafyrirsögn í `--hg-ink-3`), hver módúll undirfyrirsögn (`.hg-list-module`, nafn, litastrik í lit módúlsins (`moduleAccent` eða tónn) og fjöldi línanna undir henni hægra megin). Talan í fyrirsögninni telur línurnar undir henni, svo með virka síu er hún lægri en talan á módúlspjaldinu á kortinu, sem telur öll opin verk sýnarinnar (`PackColumn.tsx`). Það er ætlað: fyrirsögnin segir hvað er í listanum, spjaldið hvað er í módúlnum. Módúll án sýnilegra verka er sleppt. Verk með módúl sem ekki finnst eða án módúls fara undir fyrirsögnina "Án módúls" (`vinnubord.list.noModule`) neðst í listanum, eftir öllum pökkum. Pakki án sýnilegra verka er sleppt.
- **Eftir stöðu.** Fyrirsagnir eru föturnar í röð pillanna: Nýtt, Bíður þín, Bíða annarra, Í byggingu, Í bið, lesnar úr sömu lyklum og pillurnar (`vinnubord.board.counts.*`, án tölu). Verk innan fötu eftir `updated_at` nýjast fyrst. Engin módúlfyrirsögn; línan sýnir módúlnafnið í metalínunni í staðinn.
- **Síðast breytt.** Ein fyrirsögnarlaus runa eftir `updated_at` nýjast fyrst. Módúlnafn í metalínunni.

Hreint fall `listRows(items, modules, packages, actions, viewerId, sort)` í `lib/list.ts` skilar flötum lista af `{ kind: 'pack' | 'module' | 'bucket' | 'item', ... }` röðum sem komponentinn teiknar beint. Tested: tóm gögn, verk án módúls, módúll án verka sleppt, fötu- og titlaröð, `updated_at` röð með jöfnum stimplum (fallið endar á id eins og `boardOrder`).

### 4.6 Hvað sést

- Inntakið er `visibleItems` úr `BoardPage` (verkin sem virka sýnin dregur) sem síðan eru síuð með sömu reglu og kortið dimmar: fatan, `BUCKET_TONE`, pakki módúlsins, ólesið og leitarorð gegnum `matches`. Verk sem kortið dimmar er ekki í listanum (listinn þrengir, kortið dimmar). Fjöldinn í hausnum er fjöldi lína.
- Til að listinn og kortið lesi eina niðurstöðu flyst útreikningurinn sem `Board.tsx` gerir á hvert spjald (tónn, fata, `visible`, `fresh`, `label`, `mover`) í hreint fall `cardModels(...)` í `lib/cards.ts` (nýtt) sem bæði Board og listinn kalla með sömu inntökum. `Board` hegðar sér eins og áður; þetta er refactor með prófi sem staðfestir sömu niðurstöðu og reglurnar í dag (eitt dæmi per regla).
- Tómur listi (sía felur allt, eða engin opin verk): ein lína "Ekkert verk sést" (`vinnubord.list.empty`) og, ef sía eða leit er virk, hnappur "Hreinsa" sem kallar `filter.clear` eins og í stikunni.

### 4.7 Línan

Ein lína er `button.hg-list-row` (alvöru hnappur, listinn er utan borðsins svo viewport reglan um hnappa gildir ekki). Þrír dálkar: punktur, meginmál, stimpill.

- **Punktur** `.hg-list-dot` í tón verksins (`--hg-c` gegnum `hg-tone-*` eins og spjaldið). Ólesið: gullhringur utan um punktinn (`.hg-list-dot-unread`, sama regla og `.hg-card-ring`: `fresh !== null`).
- **Titill** `.hg-list-title`, allt að tvær línur, svo klippt með ellipsis (`-webkit-line-clamp: 2`).
- **Metalína** `.hg-list-meta`, alltaf með stöðutextann úr `itemStatusLabel` ("Nýtt frá H", "Bíður Árna", "Í byggingu", "Í bið") í `--hg-ink-3`, eins og spjaldið sýnir hann í `.hg-card-st`. Þegar staða er `waiting` og `waiting_on` finnst meðal þátttakenda stendur stutt nafn þess sem beðið er eftir í hring (`.hg-av`, sama útlit og hringurinn á spjaldinu, en hér er það sá sem verkið bíður eftir, ekki sá sem hreyfði það síðast) fyrir framan textann, eins og mockupið sýnir ("Á Bíður Árna"). Svo "N hjá þér" í coral (`.hg-chip-mine`, sama tala og spjaldið, `mineActionsByItem`) þegar viðkomandi á opin handtök; svo módúlnafnið þegar röðunin er ekki eftir pakka. "Síðan síðast" línan af spjaldinu er ekki í línunni, ólesið sést aðeins á hringnum um punktinn, svo línan helst stutt. `cardModels` skilar því `waitingOn: { short, name } | null` til viðbótar við `mover`.
- **Stimpill** `.hg-list-when`: `formatStamp(item.updated_at)` hægra megin, `--hg-ink-3`, ein lína. Sama fall og "síðast hreyft" á spjaldinu, svo tímarnir stemma.
- Valið verk (spjaldið opið á því) fær `.hg-list-row-open`: ljósari bakgrunnur og hárlína í `--hg-c` eins og `.hg-card-open`. Lyklaborð: Tab milli lína, Enter eða bil smellir, fókushringur `--hg-sel-color`.
- Mús: hover yfir línu lýsir spjaldið á kortinu með nýjum klasa `.hg-card-peek`, sem fær sömu reglu og `:hover` reglan á spjaldinu í dag (`vinnubord.css`, `@media (hover: hover)` blokkin: `scale` úr `--hg-card-peek-k` yfir `--hg-z`, klemmt við `--hg-card-peek-min|max`, `--hg-card-lift-shadow`) en án `--hg-card-peek-delay`, og gildir líka meðan `.hg-board-panning` er ekki á. Reglan er skrifuð einu sinni með sameiginlegum selector (`.hg-card:hover, .hg-card.hg-card-peek`) svo útlitið sé eitt. Skrifað beint á spjaldelementið gegnum `BoardHandle.peek(itemId, on)` (sjá 4.8), engin React teikning; `onMouseLeave` listans og lokun hans taka klasann af. Snertitæki fá ekkert hover.

### 4.8 Smellur: renna að spjaldinu og opna

- `BoardHandle` fær `reveal(itemId)`: finnur spjaldelementið (`els` og spring markið `tx`, `ty` eins og `fitAll` gerir), reiknar sýn sem setur miðju spjaldsins í miðju lausa svæðisins og kallar `vp.animateTo` yfir `--hg-dur-view`. Zoom: núverandi zoom ef það er á bilinu `REVEAL_MIN_ZOOM` (0.8) til `MAX_ZOOM`, annars 0.8. Hreint fall `revealView(cardRect, current, viewport, free)` í `lib/geometry.ts` með prófi.
- Lausa svæðið: breidd borðsins að frádregnum listanum vinstra megin (þegar hann er opinn á desktop) og spjaldinu hægra megin (`--hg-panel-w` plús `--hg-panel-inset`, lesið af `getComputedStyle` eins og `viewDurMs` les `--hg-dur-view`) á 768 px og breiðara. Á síma er lausa svæðið borðið ofan við hálfopið botnblað, en blaðið opnast fullt, svo spjaldið er miðjað í efri 45% borðsins (sama hlutfall og `SHEET_HALF` í `lib/sheet`). Hreint, prófað: `freeRect(boardSize, { list, panel, sheet })` skilar `Padding` með `top`, `left`, `right`, `bottom`, og sama padding fer í `fit` og `fitWidth` (4.3).
- `BoardPage` gerir: `select(id)` og `boardRef.current?.reveal(id)` í sömu lotu. Á undir 1024 px lokar hann listanum fyrst (`setListOpen(false)`), sem fjarlægir listann úr DOM; glide og spjald fylgja í sömu lotu.
- Spjald sem sýnin felur er ekki í listanum (4.6), svo `reveal` á alltaf element. Finnist það samt ekki (kapphlaup við realtime) opnar spjaldið án glide.
- `ModulePanel` kallar sama `reveal` þegar verk er valið úr módúlspjaldinu. Það er aukaverkun sem fylgir frítt og lagar sömu týnd-spjald tilfinningu þar.

### 4.9 Lifandi

- Listinn les sömu `data` og kortið, svo realtime breytingar (nýtt verk, staða, handtak hakað, lesmerki) birtast í honum um leið og á kortinu, engin sér áskrift.
- Lína verks sem hverfur úr sýninni (lokað, fært í aðra sýn) hverfur úr listanum við næstu teikningu. Engin hreyfimynd á línum.

## 5. Útlit

Tókens, nýr kafli "List drawer" í `:root`:

```
--hg-list-w: 320px;
--hg-list-z: 24;
--hg-list-bg: var(--hg-panel-bg);
--hg-list-blur: var(--hg-panel-blur);
--hg-list-pad-x: 12px;
--hg-list-head-h: 52px;
--hg-list-row-pad: 8px 10px;
--hg-list-row-gap: 10px;
--hg-list-row-radius: 12px;
--hg-list-row-hover: rgba(255, 255, 255, 0.05);
--hg-list-row-open: rgba(255, 255, 255, 0.08);
--hg-list-dot: 8px;
--hg-list-dot-ring: 2px;
--hg-list-title-size: 13px;
--hg-list-meta-size: 11px;
--hg-list-pack-size: 10.5px;
--hg-list-module-size: 12.5px;
--hg-list-module-bar-w: 3px;
```

`(pointer: coarse)` blokkin setur `--hg-list-blur: none` og `--hg-list-bg: var(--hg-board)` (ógegnsætt). Undir 1024 px setur breiddarreglan `--hg-list-w: 100%` og sama ógegnsæja bakgrunn, óháð bendli, svo spjaldtölva með mús fær líka fullan lista.

Letur: `--hg-font` (Manrope), titill 600, pakkafyrirsögn 700 með `letter-spacing: .08em` og upphafsstöfum, módúlfyrirsögn 700 í `--hg-ink-2`. Mockupið frá 2. nóv (`.superpowers/brainstorm/843418-1793604480/content/listi-layout.html`) sýnir hlutföllin; það er viðmið, ekki pixlanákvæmt.

## 6. Hlutar og skrár

Nýtt:

- `src/vinnubord/lib/list.ts` + `list.test.ts`: `Sort`, `parseListPrefs`, `listState`, `listRows`.
- `src/vinnubord/lib/cards.ts` + `cards.test.ts`: `cardModels` (flutt úr `Board.tsx`, skilar líka `waitingOn`).
- `src/vinnubord/lib/geometry.ts`: `revealView`, `freeRect`, `REVEAL_MIN_ZOOM`, `Padding` með `left` og `right` + próf í `geometry.test.ts`.
- `src/vinnubord/hooks/useListPrefs.ts`: `localStorage` lykillinn, sama mynstur og `useActiveView`.
- `src/vinnubord/components/ListDrawer.tsx`: `aside`, haus, röðun, línur, tómur listi.

Breytt:

- `BoardPage.tsx`: `useListPrefs`, `ListDrawer` sett inn í `.hg-board-wrap` við hlið `Board`, `listWidth` í `Board`, `reveal` við val úr lista og módúlspjaldi, Escape röð.
- `Board.tsx`: `cardModels` í stað innbyggða útreikningsins, `listWidth` prop í padding allra fit aðgerða, `reveal` og `peek(itemId, on)` á `BoardHandle`.
- `useViewport.ts`: `Padding` fær `left` og `right` í stað `sides` (og `fitAll`, `fitWidth` í `geometry.ts` með).
- `TopBar.tsx`: listahnappurinn, props `listOpen`, `onToggleList`.
- `ModulePanel.tsx`: `onSelectItem` kallar `reveal` gegnum `BoardPage` (engin breyting á spjaldinu sjálfu, `BoardPage` vefur fallið).
- `vinnubord.css`: tókens og reglur, coarse yfirskriftir, breiddarregla undir 1024 px.
- `en.json` og `is.json`: `vinnubord.list.*` og `vinnubord.top.list`.
- `CLAUDE.md`: Design System (nýju klasarnir og tókens), Key Patterns (listinn les sama `cardModels` og kortið, `reveal`), Folder structure.
- `docs/progress/10-listi.md`: handover.

## 7. Prófun

- vitest: `list.test.ts`, `cards.test.ts` (sama niðurstaða og reglurnar í `Board.tsx` í dag), `geometry.test.ts` (`revealView` heldur zoom á bilinu, miðjar í lausa svæðið, `freeRect` með og án lista, spjalds og blaðs).
- `npm run build` grænt.
- Handpróf byggingarlotunnar: desktop 1440 px (opna lista, smella línu, sjá glide og spjald, hover lýsir spjald, röðun skiptir, Escape lokar, endurhlaða man opið), spjaldtölva 1024 og 768 px (listinn fullur, smellur lokar og rennir), sími 390 px (sama og botnblað). `npm run shots:hg phone` með listann opinn er viðbót við skotaskriftuna, ein ný mynd `phone-list.png`.
- Heimir prófar á iPhone og iPad: hnappurinn finnst, listinn skrunar, smellur rennir að réttu spjaldi.

## 8. Opið fyrir byggjanda

- Nákvæm stærð og staða listatáknsins í stikunni, innan `hg-icon-btn` rammans.
- Hvort `cardModels` tekur `filter` inn eða skilar `visible` sem sér fall; hvort tveggja er í lagi svo lengi sem Board og listi kalla eitt fall.
- Hvernig `.hg-card-peek` er skrifað á spjaldið (klasi eða `data-` eigind), svo lengi sem það er ekki React state.

## 9. Mín köll (Claude), Heimir getur hnekkt

- Breidd 320 px, föst, ekki dregin til.
- Escape lokar listanum aðeins þegar ekkert spjald, blað eða valmynd er opið.
- Hover á línu lýsir spjaldið á kortinu.
- Röðunarvalið man sig í sama lykli og opið/lokað.
- Verk án módúls fara neðst undir "Án módúls".
- `reveal` heldur núverandi zoom á bilinu 0.8 til 2.5, annars 0.8.
- Módúlspjaldið fær sama `reveal`.
- Línan sýnir stöðutextann alltaf, með hring þess sem beðið er eftir fyrir framan þegar verk bíður einhvers; "Síðan síðast" er ekki í línunni, aðeins hringurinn um punktinn.
- Rofinn hreyfir sýnina aldrei, en fit aðgerðir (fyrsta opnun, Sýna allt, pakkatitill, reveal) reikna með opnum lista, svo endurhleðsla með munaðan lista setur fyrsta pakkann ekki undir hann.
- Opið eða lokað í mjóa laginu (undir 1024 px) er minnisástand sem byrjar lokað og skrifast aldrei í geymsluna; aðeins breiða lagið man sig.
- Talan í módúlfyrirsögn listans telur línurnar undir henni (síaðar), módúlspjaldið á kortinu telur áfram öll opin verk sýnarinnar.
