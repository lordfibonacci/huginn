# Huginn: kassar og tiltekt (hönnunarskjal)

Dagsetning: 2026-11-04
Staða: drög Claude (Fable) úr minnispunktunum í `2026-11-03-naestu-verk-hugmyndavinna.md` (verk 4). Heimir bað um að skjalið yrði skrifað beint úr punktunum ("smíðaðu bara"), svo opnu atriðin þar eru ákveðin hér og merkt í kafla 8.
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (gagnalíkan), plan 2 (borðið, drag og vírar), plan 7 (sýnir, staða per sýn), plan 9 (sími og spjaldtölva), plan 10 (listi), plan 13 (`hg_view_pack_positions`, pakkar dregnir, Ctrl val). Þetta skjal bætir við tveimur töflum (`hg_zones`, `hg_view_zone_positions`), einum spjaldflokki (kassaspjald), einni teiknihegðun á borðinu, samanfelldum pökkum per vafra, röðun valinna korta með afturköllun, og lætur lokuð kort dofna í þrjá daga áður en þau fara af borðinu.

Þetta er fjórða og síðasta verkið úr samtalinu 3. nóv. Það er smíðað í tveimur plönum: plan 15 (kassar, kaflar 4.1 til 4.3) og plan 16 (tiltekt, kaflar 4.4 til 4.6). Plan 15 fer á undan.

## 1. Tilgangur

Borðið er landakort Heimis: hann man hvar kort eru. Það sem vantar er leið til að merkja svæði á kortinu ("þetta er fyrir sýninguna", "þetta eru hugmyndir sem ekki er byrjað á") án þess að færa kortin í módúl eða sýn, og leið til að tína til án þess að borðið raði sér sjálft. Í dag eru fjögur göt:

- Engin leið til að afmarka svæði. Kort sem eiga saman þvert á módúla standa bara nálægt hvert öðru og enginn annar veit af hverju.
- Pakki með mörgum módúlum og kortum tekur alltaf sitt pláss, líka þegar Heimir er ekki að vinna í honum.
- Kort sem hann valdi með Ctrl ramma er hægt að færa saman, en ekki raða. Hann raðar þeim eitt og eitt.
- Verk sem lýkur hverfur af borðinu um leið. Þá sést ekki að eitthvað kláraðist, og kort sem Árni lokaði í morgun er horfið áður en Heimir sá það.

Lagfæringin: kassar á borðinu (nafn, litur, lítill texti, færist með því sem er inni í honum, sýnilegur öllum, með stöðu í hverri sýn), pakki sem má fella saman per vafra, Raða sem virkar aðeins á það sem Heimir valdi sjálfur og má afturkalla, og lokuð kort sem dofna og standa í þrjá daga.

Gildir í öllu (Heimir 3. nóv): engin lituð rönd eða bar vinstra megin á neinu. Engin Raða aðgerð sem færir kort án þess að Heimir hafi valið þau sjálfur.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Kassi: ferhyrningur á borðinu með nafni á brúninni, gegnsærri fyllingu í sínum lit og valfrjálsum texta neðst. Heimir býr hann til með "Kassi" hnappi í toppstikunni og dregur svo rammann á borðinu. Nafn, litur og texti í litlu spjaldi.
- Kassinn er sýnilegur öllum þátttakendum og hefur sína stöðu í hverri sýn, eins og kort og pakkar.
- Að draga nafnið færir kassann með öllum kortum og pakkatitlum sem eru inni í honum. Að draga hornið neðst til hægri stækkar hann. Kort sem er dregið út úr kassa er bara ekki lengur í honum: aðild er rúmfræði, ekki gögn.
- Pakkatitill fær rofa sem fellir pakkann saman: módúlarnir hverfa, ein lína segir hve margir módúlar og kort eru í honum, og kortin hans eru ekki teiknuð. Per vafra.
- Raða valin: kort sem Heimir valdi með Ctrl ramma raðast í grid þar sem þau eru. Ein afturköllun strax á eftir. Allt annað stendur kyrrt.
- Kort sem lokast (lokið eða hætt við) stendur dauft á borðinu í þrjá daga og fer svo.

**Ekki-markmið**

- Kassi sem sía eða sýn ("sýna bara það sem er í kassanum"). Kassi er merking á borðinu, ekki gögn á verki. Ef það vantar seinna fær það sitt eigið skjal.
- Kassi í CLI, í speglinum (`item.md`, `STATUS.md`) eða í `pull`. Kassar eru borðið eitt.
- Kassar í Ctrl rammavali, kassar sem færa aðra kassa, kassi inni í kassa sem hegðar sér öðruvísi.
- Stærð kassa per sýn. Staðan er per sýn, stærðin er sameiginleg.
- Samanfelldur pakki sem er sameiginlegur milli þátttakenda eða milli vafra.
- Raða sem nær yfir pakka, módúla eða kassa, eða yfir allt borðið. Aðeins valin kort.
- Lokuð kort í sýnum sem sía á tón: þau eru stone og fylgja þeirri reglu, ekkert nýtt.
- Atburðir eða ólesið fyrir kassa. Kassi stimplar ekkert og merkir ekkert ólesið, eins og sýn.

**And-markmið**

- Hnappur sem raðar öllu borðinu eða hluta þess sem Heimir valdi ekki sjálfur. Heimir hugsar myndrænt og man hvar kort eru.
- Lituð rönd eða bar á kassa, pakkalínu, röðunarstiku eða lokuðu korti. Kassinn er fylling og brún í sínum lit, nafnið litað, ekkert annað.
- Kassi sem færir kort án þess að Heimir dragi hann. Aðeins drag á nafninu hreyfir nokkuð.
- Teiknihamur sem festist: Esc, annar smellur á hnappinn, of lítill rammi og lokið teikning slökkva allir á honum.
- Kort sem hverfur úr listanum eða telst ekki í pillunum af því að pakkinn þess er felldur saman. Samanfelling er sjónræn á borðinu eingöngu.
- Lokað kort sem lýsist (bjarmi, "nýtt" lína) eða telst sem opið neins staðar: í pillum, í módúltölu, í `pull`, í `STATUS.md`.

## 3. Skorður

- Supabase verkefnið er deilt, aðeins `hg_` hlutir. Migration beitt með MCP `apply_migration`, aldrei `db push`. Ekkert DROP og ekkert DELETE í migration. Töflurnar fylgja `hg_views` og `hg_view_pack_positions` að öllu leyti: RLS fyrir þátttakendur, `created_by` stimplað með `hg_views_stamp`, samsettir lyklar á verkefni eins og 0011b, realtime.
- Realtime DELETE berst ekki öðrum borðum (sjá Key Patterns í CLAUDE.md): kassi sem er eytt hverfur hjá öðrum við næstu breytingu eða endurhleðslu. Borðið sem eyðir endurhleður sig sjálft.
- Hrein rök í `src/vinnubord/lib/` með vitest. Kassar, samanfelling, röðun og lokað regla eru hrein rök með prófum.
- CLI afritar `isOpen`, `isOnBoard` og `CLOSED_LINGER_DAYS` í `cli/lib/status.mjs` með parity prófi. Kassar koma ekki við CLI.
- Reglur í `vinnubord.css` lesa aðeins tokens. Ný tokens fara í nýjan kafla `/* ---------- Kassar ---------- */` á eftir `Item cards` og nýjar línur í `Pack columns` og `Item cards` fyrir samanfellingu, röðunarstiku og lokuð kort. Snertiyfirskriftir (`pointer: coarse`) fá sínar útgáfur af blur og skuggum þar sem við á.
- Snerting: allt sem kortin og pakkatitlarnir kunna (350 ms langpress lyftir, pinch hættir við, tap) gildir óbreytt um kassann og hornið, því þau eru grip í `useCardDrag`. Ctrl val og röðunarstika eru mús eingöngu, eins og í dag.
- Engin þankastrik. Íslenskt viðmót. Nýir i18n lyklar undir `vinnubord.*`, Icelandic copy orðrétt í planinu. Miðpunktur (`·`) er leyfður í talningarlínum.

## 4. Hegðun

### 4.1 Kassar: gögn

Migration `0017_hg_zones`:

- `hg_zones`: `id`, `created_at`, `project_id`, `title text not null` (check `btrim(title) <> ''`, mest 60 stafir), `color text not null default 'lilac'` (tónn, sömu fimm og módúlar; hex er ekki leyft á kassa), `note text` (mest 200 stafir, `normalizeNote` í vefnum, tómt er `null`), `pos_x int`, `pos_y int`, `w int`, `h int` (check `w >= 160 and h >= 120`), `created_by uuid`. Einkvæmt `(id, project_id)` fyrir samsetta lykla. RLS, stimpill og realtime eins og `hg_views`.
- `hg_view_zone_positions`: `project_id`, `view_id`, `zone_id`, `pos_x`, `pos_y`, lykill `(view_id, zone_id)`, samsettir lyklar á sýn og kassa í sama verkefni, `on delete cascade` frá sýn og kassa. RLS og realtime eins og `hg_view_pack_positions`.
- Engir atburðir, engin `updated_at`. Kassi hreyfir aldrei `hg_items`.

Vefurinn: `Zone` og `ViewZonePosition` í `types.ts`, `BoardData.zones` og `BoardData.viewZonePositions`, `loadBoard` hleður báðar, `useBoardData` hlustar á báðar töflurnar. `api.ts`: `createZone`, `updateZone` (title, color, note), `updateZoneRect` (pos_x, pos_y, w, h, hvert um sig valfrjálst), `upsertViewZonePosition`, `deleteZone`. `lib/zones.ts` (hreint): `zonePositionsOf(rows, viewId)` eins og `packPositionsOf`, `zoneRect(zone, positions)` (staðan í sýninni, annars eigin, stærðin alltaf eigin), `zoneMembers(rect, cards, packTitles)` (kort og pakkatitlar sem miðpunktur boxins liggur innan rammans), `normalizeZoneTitle` (trim, hvítbil í eitt bil, tómt er villa `Kassinn þarf nafn.`, lengra en 60 er villa `Nafnið má mest vera 60 stafir.`), `ZONE_MIN = { w: 160, h: 120 }`, `clampZoneSize`.

### 4.2 Kassar: útlit og teikning

**Útlit** (valkostur A, Heimir 3. nóv): `.hg-zone` er `position: absolute` í `.hg-world`, undir pökkum og kortum (`--hg-zone-z: 1`, pakkar eru 3, kort 3), `border-radius: var(--hg-radius-zone)` (18 px), fylling `color-mix(in oklab, var(--hg-c) 11%, transparent)` og brún `1px solid color-mix(in oklab, var(--hg-c) 40%, transparent)`. Nafnið er `button.hg-zone-title` á brúninni efst til vinstri (inndregið `--hg-zone-title-inset` 14 px, miðjað á brúnina með neikvæðu `top`), bakgrunnur `--hg-board` svo brúnin brotnar undir því, litur `--hg-c`, feitletrað, `--hg-zone-title-size` 13 px, minnst `--hg-touch` hátt á snertitækjum (á mús 28 px, `--hg-zone-title-h`). Textinn neðst (`.hg-zone-note`) er `--hg-ink-2`, `--hg-zone-note-size` 12 px, inndreginn eins og nafnið, mest 70% af breidd, ein til tvær línur með ellipsis. Hornið (`i.hg-zone-resize`, `data-grip="zone-resize"`) er neðst til hægri: snertiflötur `--hg-touch` á kant, sýnilegt merki tvö lítil strik á ská (`--hg-zone-grip-size` 14 px) í `--hg-c` við 55%, bendill `nwse-resize`. Kassi sem er dreginn (`.hg-zone-lift`) fær brún við 70% og fyllingu við 16%; stærðarbreyting fær það sama. Engin skuggi, engin blur: kassinn er flatur. Tónklassinn `.hg-tone-*` setur `--hg-c` eins og á kortum. Kassi dofnar aldrei undir síu.

**Teikning.** `TopBar` fær hnapp "Kassi" (`.hg-icon-btn.hg-zone-btn`, `aria-label` "Nýr kassi", `aria-pressed` meðan teiknihamur er á) vinstra megin við listahnappinn. Smellur kveikir teiknihaminn (`drawingZone` í `BoardPage`, sent í `Board`): borðið fær `.hg-board-draw` (bendill `crosshair`), og næsta aðalbending á borðinu (mús, penni eða einn fingur) dregur ramma, hvar sem hún byrjar: líka ofan á korti, pakkatitli, kassatitli eða horni, því kassinn má ná yfir þau. Aðeins bending sem byrjar í reit (`input, textarea, select`) er látin í friði. `useZoneDraw` er bundið á borðið með `onPointerDownCapture` eins og `useMarquee` og stöðvar bendinguna þar, svo hvorki `useCardDrag`, `useMarquee` né `useViewport` sjá hana: í teiknihamnum er hvorki pan með mús, kortdrag né Ctrl rammi, hjólið og aðdráttarhnapparnir virka. Ramminn er `.hg-zone-draft` (skjáhnit inni í borðinu, skrifað beint, lilac kassaútlit án nafns). Annar fingur (pinch, `gestureRef.current.touchCount > 1` eða `pointercancel`) hættir við teikninguna og slekkur haminn, fingurnir panna og pinsa þá eins og venjulega. Sleppt með báðar hliðar minnst `ZONE_MIN` í heimseiningum: kassi settur inn (`createZone` með `title: 'Kassi'`, `color: 'lilac'`, `note: null`, rammi í heimseiningum, rúnnaður), kassaspjaldið opnast með nafnið í fókus og valið, teiknihamur slokknar. Sleppt minna: ekkert, teiknihamur slokknar. Esc eða annar smellur á hnappinn slekkur. Teiknihamur er ekki geymdur og lifir aldrei nema eina bendingu. Flýtilyklar og spjöld virka áfram meðan hann er á.

**Spjaldið** (`ZonePanel`, í `PanelShell` eins og `ModulePanel`, `openZoneId` í `BoardPage`, aldrei opið samtímis verk- eða módúlspjaldi): haus "Kassi" og nafnið, svo nafnreitur (`Nafn`), litur (`ColorPicker` úr settings/parts með fimm tónum, merkið `Litur`), texti (`Texti`, textarea, `normalizeNote`, vísbending "Mest 200 stafir, sést neðst í kassanum"), Vista (`useAsyncAction`, virkur þegar eitthvað breyttist og nafnið stenst regluna), Eyða (`window.confirm`: `Eyða kassanum „{{title}}“? Kortin standa kyrr.`, lokar spjaldinu og endurhleður borðið). Tap eða smellur á kassatitilinn opnar spjaldið (`onTap` í `useCardDrag` fyrir `zone`, Enter og bilslá á hnappinum líka). Spjaldið lifir refetch með `key` á kassa-id eins og hin.

### 4.3 Kassar: færsla og stærð

- Nafnið er grip: `data-grip="zone"` á `.hg-zone-title`, `dragTargetOf` skilar `{ kind: 'zone', id }`. Hornið: `data-grip="zone-resize"` skilar `{ kind: 'zoneResize', id }`. `useViewport` meðhöndlar þau sem `CARD` (velurinn `[data-card], [data-grip]` er óbreyttur). Pressureglurnar eru pakkareglurnar: mús dregur eftir 3 px, snerting eftir 350 ms langpress, tap opnar spjaldið (`zone`) eða gerir ekkert (`zoneResize`). Smellurinn á eftir sleppingu er gleyptur eins og á pakkatitli.
- Kassi hefur enga fjöður: `Board` skrifar `left`, `top`, `width`, `height` beint eins og á pakka (`zoneLive`, `zonePending`, sama lestur á pending og á pökkum: önnur sýn, gögnin sýna hana, eða einhver annar færði hana af grunni).
- Við press á nafnið reiknar `Board` meðlimina einu sinni: `zoneMembers` yfir teiknuðu kortin (box við fjöðurmark og mælda stærð) og pakkatitlana (box titilsins, eins og `selectionIn`). Allir færast með sama delta og kassinn (`groupMoves` með kassann sem grip, `SelTarget` fær `kind: 'zone'`). Kort sem pakki þess er felldur saman (plan 16) er ekki teiknað og er því ekki meðlimur sjálft, en felldur pakki tekur falin kort sín með sér hvar sem hann er dreginn (4.4). Aðrir kassar eru aldrei meðlimir. Ctrl valið er hreinsað við press á kassa.
- Slepping: kassinn vistast strax (`updateZoneRect` á aðalborði, `upsertViewZonePosition` í sýn, sýnin fest við sleppingu), meðlimir eftir sínum reglum (`onDrop` korta með debounce og pending, `dropPack`). Hætt við (pinch, missir capture): allt fer til baka.
- Hornið: `getPos` skilar `{ x: w, y: h }`, hver hreyfing setur `w` og `h` (minnst `ZONE_MIN`, `clampZoneSize`), slepping vistar `w` og `h` á `hg_zones` líka inni í sýn (stærð er sameiginleg). Meðlimir hreyfast ekki við stærðarbreytingu.
- Vírar vakna við hverja hreyfingu og sleppingu eins og við pakkafærslu (`PACK_MOVE_WAKE_MS`).
- Sýnir: allir kassar teiknast í öllum sýnum, hver á stöðu sinni í sýninni ef hún er til, annars á eigin stöðu. Kassi dreginn í sýn skrifar `hg_view_zone_positions` og aldrei `hg_zones.pos_*`.
- `fitAll` (Sýna allt, fyrsta hleðsla á breiðu borði) telur kassana með. Pakkatitill (`fitWidth`) og `startAtPack` breytast ekki. `placeNew` lítur framhjá kössum: nýtt kort má lenda í kassa.
- `freeRect`, listinn, leitin, síur, pillur: ósnert.

### 4.4 Fella pakka saman

- Pakkatitillinn (`.hg-pack-title`) fær rofa hægra megin í titilröðinni: `button.hg-pack-fold` (`--hg-touch` á kant, chevron niður þegar pakkinn er opinn, upp þegar hann er felldur, `aria-expanded`, `aria-label` `Fella {{name}} saman` / `Opna {{name}}`). Rofinn er hnappur, ekki grip: mús lyftir ekki, snerting pannar framhjá honum eins og á módúlkorti. Titilröðin verður `div.hg-pack-head` með titilhnappinum og rofanum, línan á eftir titlinum (`::after`) helst á titlinum.
- Felldur pakki (`.hg-pack-folded`): módúlarnir eru ekki renderaðir, rail ekki teiknaður, undir titlinum ein lína `.hg-pack-fold-line` í `--hg-ink-3`, `--hg-pack-fold-size` 13 px: `{{modules}} · {{cards}} · fellt saman` þar sem `modules` er "1 módúll" / "N módúlar" og `cards` er "1 kort" / "N kort". Kortin talin eru kort módúla hans meðal þeirra sem borðið teiknar (sýnin ræður, sían ekki).
- Kortin hans eru ekki teiknuð: `Board` fær `collapsedPacks: ReadonlySet<string>`, tekur þau kort úr `onBoard` (fjaðrir, inngangur) og úr teiknuðu kortunum og vírunum. `cards` (líkanið) breytist ekki: listinn sýnir þau áfram, pillurnar telja þau áfram, leitin finnur þau. Samanfelling er sjónræn.
- Geymsla per vafra: `localStorage` `hg.packs.<projectId>` með `{"collapsed":["<packId>", ...]}`; `lib/packs.ts` (hreint): `packsKey`, `parseCollapsed`, `serializeCollapsed`, `foldLine(moduleCount, cardCount)`; `useCollapsedPacks(projectId)` eins og `useListPrefs` (lesið við skipti á verkefni, skrifað um leið, geymslubann þolað). Pakki sem er horfinn úr gögnunum er hunsaður en ekki þurrkaður.
- Felldur pakki tekur falin kort sín með sér. Þegar felldur pakki er sleppt eftir drag (einn á titlinum, sem meðlimur Ctrl vals eða sem meðlimur kassa) skrifar `Board` stöðu hvers falins korts módúla hans (kort meðal þeirra sem borðið teiknaði ekki vegna samanfellingar, staða úr `positionOf` í sýninni eða eigin) með sama delta beint í gagnagrunninn (`savePosition`, engin fjöður, engin pending, sama vistunarregla: sýn eða aðalborð). Hætt við drag skrifar ekkert. Þegar pakkinn opnast standa kortin þar sem hann fór.
- Listaröð eða módúlspjaldsröð sem velur kort í felldum pakka: `pick` í `BoardPage` opnar pakkann fyrst (skrifar geymsluna) og `reveal` keyrir þegar kortið er komið (bið í ref, keyrð í `useEffect` eftir að `collapsedPacks` breyttist). Nýtt verk í módúl fellds pakka: `placeNew` finnur engan módúl, notar þá dálk pakkans (`[data-pack]`) sem akkeri svo kortið lendir við hlið dálksins, og telur falin kort felldra pakka með sem hindranir (eins og kort sem sýn felur, á gagnastöðu sinni); `onCreated` opnar svo pakkann.
- Ekkert í CLI, speglinum eða gagnagrunninum. Parity: engin.

### 4.5 Raða valin

- Þegar Ctrl valið heldur tvö eða fleiri kort sýnir `Board` stiku `.hg-sel-bar` neðst á miðju borði, ofan við stjórntækjaröðina (`bottom: var(--hg-control-stack)`, `z-index` undir spjaldi eins og toast), með texta `{{count}} kort valin` og hnöppunum `Raða` og `Hætta við` (hreinsar valið). Stikan er mús eingöngu eins og valið.
- Raða: `arrangeGrid(boxes, gap)` í `lib/arrange.ts` (hreint). Kortin raðast eftir núverandi stöðu (fyrst `y`, svo `x`, 40 px vikmörk í `y` teljast sama röð, svo "efst til vinstri" les eins og texti), dálkar `ceil(sqrt(n))`, dálkbreidd breiðasta kortið auk `ARRANGE_GAP` 24, raðhæð hæsta kortið í þeirri röð auk 24, gridið miðjað á miðju umlykjandi kassa valsins, hnit rúnnuð. Skilar `Map<id, Point>` og gömlu stöðurnar. Pakkar í valinu standa kyrrir.
- Hreyfingin fer í gegnum `onDrop` hvers korts: fjöðrin rennur, pending og debounced vistun eftir venjulegu reglunum (sýn eða aðalborð, fest við aðgerðina). Vírar vakna.
- Afturköllun: eftir Raða sýnir stikan `Raðað` og hnappinn `Afturkalla` í `ARRANGE_UNDO_MS` 8000 ms, eða þar til valið breytist eða borðið afmountast. Afturkalla setur hvert kort aftur á skráða stöðu með `onDrop`. Valið helst eftir Raða, Esc hreinsar það og felur stikuna og afturköllunina.
- Snerting: ekkert, valið er ekki til þar.

### 4.6 Lokuð kort dofna og fara

- `CLOSED_LINGER_DAYS = 3`. `isOpen(item)`: staða ekki `done` og ekki `dropped`. `isOnBoard(item, now = Date.now())`: `isOpen`, eða `closed_at` innan þriggja daga frá `now`. `closed_at` er sett af gagnagrunninum (0003), svo kort sem lokaðist í CLI, á vef eða með kveikjara fær sömu meðferð.
- Vefurinn: `countBucket` skilar `null` fyrir lokað (telst í engri pillu, nema `unread` sem telur aldrei lokað því `hg_unread` skilar aðeins opnum). Lokað kort passar aldrei við tónsíu: `matches` fær `ctx.tone: Tone | null`, og tónsía (pillur, sýn með tónum) fellir kort með `null`. Svo stemma pillutala og sía áfram ("Í bið" lýsir 3 kort þegar hún segir 3), sýn án tóns sýnir lokuð kort, sýn með tónum felur þau. Pakka-, tagga-, leitar- og ólesið sían virka á lokað kort eins og önnur. `tagCounts` og `packageCounts` telja opin verk (`isOpen`). `cardModels`: `bucket: null`, tónn `stone` (óbreytt `itemTone`), `mode: 'parked'` (`wireMode`: lokað er `parked`, strikaður vír án neista), nýtt svið `closed: boolean`. `moduleOpenCount`, `moduleTone`, `moduleItems` (panel.ts) nota `isOpen`. `boardCount` í sýnavalmyndinni og `placeNew` nota `isOnBoard`. `BoardPage` sendir `now` (sama `Date.now()` og `cardModels` fær) í `itemsInView`.
- Kortið: `.hg-card-closed` (opacity `--hg-card-closed-opacity` 0.45, punktur án bjarma, heil brún), staðan "Lokið" eða "Hætt við" (`itemStatusLabel`, óbreytt), stimpill, skrár og handtök eins og á öðrum kortum. Smellur opnar spjaldið. Enginn bjarmi, engin "nýtt" lína (hg_unread skilar ekki lokuðum). Kortið telst með í fit, í Ctrl vali og í kassa.
- Listinn: kort með `bucket: null` raðast síðast í módúl og í stöðuröð undir eigin hópi `Lokið` (`ListRow` hópur `id: 'closed'`), í "Síðast breytt" eftir dagsetningu eins og hin.
- Þegar þrír dagar líða fer kortið við næstu endurteiknun (gagnabreyting eða endurhleðsla), ekki á sekúndunni. Nóg.
- CLI: `status.mjs` fær `isOpen`, `isOnBoard(item, now)` og `CLOSED_LINGER_DAYS`; `format.mjs` (pull, brief, STATUS.md) og `mirror.mjs` nota `isOpen` þar sem þau meina opin verk, svo `pull --brief`, `STATUS.md` og spegillinn breytast ekki; `write.mjs placeItem` notar `isOnBoard(i, now)` svo nýtt kort lendir ekki ofan á lokuðu korti sem stendur enn. `parity.test.mjs` prófar `isOpen`, `isOnBoard` með `closed_at` 2 og 4 daga gamalt, og að `CLOSED_LINGER_DAYS` sé jafnt.
- Gagnagrunnur: engin breyting. Borðið hleður lokuð verk síðustu 90 daga nú þegar.

## 5. Útlit

Tokens í nýjum kafla `Kassar` í `vinnubord.css`: `--hg-zone-z: 1`, `--hg-zone-lift-z: 2`, `--hg-radius-zone: 18px`, `--hg-zone-fill: 11%`, `--hg-zone-fill-lift: 16%`, `--hg-zone-border: 40%`, `--hg-zone-border-lift: 70%`, `--hg-zone-title-size: 13px`, `--hg-zone-title-pad: 0 10px`, `--hg-zone-title-inset: 14px`, `--hg-zone-title-h: 28px` (`--hg-touch` í `pointer: coarse` blokkinni), `--hg-zone-note-size: 12px`, `--hg-zone-note-inset: 8px`, `--hg-zone-note-max-w: 70%`, `--hg-zone-grip-size: 14px`, `--hg-zone-grip-alpha: 55%`, `--hg-zone-draft-color: var(--hg-lilac)`. Pakkar: `--hg-pack-fold-size: 13px`, `--hg-pack-fold-gap: 6px`. Kort: `--hg-card-closed-opacity: 0.45`. Röðunarstika: `--hg-sel-bar-z: 25` (sama og toast), `--hg-sel-bar-gap: 10px`, `--hg-sel-bar-pad: 0 8px 0 16px`, `--hg-sel-bar-size: 13.5px`. Allt annað les tokens sem eru til: `--hg-control-bg`, `--hg-control-hover`, `--hg-radius-control`, `--hg-menu-shadow`, `--hg-blur-control`, `--hg-touch`.

Klassar: `.hg-zone`, `.hg-zone-lift`, `.hg-zone-title`, `.hg-zone-note`, `.hg-zone-resize`, `.hg-zone-draft` (með `hg-on` meðan dregið er), `.hg-board-draw` (bendill), `.hg-zone-btn` (toppstikan), `.hg-pack-head`, `.hg-pack-fold`, `.hg-pack-folded`, `.hg-pack-fold-line`, `.hg-sel-bar`, `.hg-sel-bar-text`, `.hg-card-closed`.

Kassaspjaldið notar `.hg-pn`, `.hg-pn-head`, `.hg-pn-st`, `.hg-pn-title`, `.hg-pn-body`, `.hg-pn-sec`, `.hg-set-field`, `.hg-set-colors`, `.hg-swatch`, `.hg-set-actions`, `.hg-btn`, `.hg-btn-primary`, `.hg-btn-ghost`, `.hg-btn-danger`: engir nýir klasar.

## 6. Prófanir

Hrein rök með vitest:

- `lib/zones.ts`: `zoneRect` (sýn, aðalborð, stærð alltaf eigin), `zoneMembers` (miðpunktur inni, á brún, utan, pakkatitill, tóm), `normalizeZoneTitle` (trim, hvítbil, tómt, 61 stafir), `clampZoneSize`, `zonePositionsOf`.
- `lib/selection.ts`: `groupMoves` með `zone` grip, `selKey` og `parseSelKey` með `zone`.
- `lib/packs.ts`: `parseCollapsed` (null, rusl, ekki fylki, strengir eingöngu), `serializeCollapsed`, `foldLine` (eintala og fleirtala).
- `lib/arrange.ts`: `arrangeGrid` (1, 2, 4, 5 kort; röð eftir y svo x með vikmörkum; dálkbreidd og raðhæð; miðja gridsins jöfn miðju umlykjandi kassa; rúnnað; gömlu stöðurnar skilað).
- `lib/status.ts`: `isOpen`, `isOnBoard` með `closed_at` innan og utan þriggja daga, án `closed_at` á lokuðu (telst farið), `countBucket` null fyrir lokað, `wireMode` parked fyrir lokað.
- `lib/views.ts`: `itemsInView` með sýn án tóns sýnir lokað, sýn með stone eða gold felur það.
- `lib/filters.ts`: `matches` með `tone: null` fellur á tónsíu, passar án hennar; `tagCounts` og `packageCounts` telja ekki lokað.
- `lib/cards.ts`: `closed` svið, `visible` false með tónsíu stone, true með pakkasíu og leit.
- `lib/list.ts`: lokað síðast í módúl, hópurinn `Lokið` í stöðuröð.
- `cli/lib/parity.test.mjs`: `isOpen`, `isOnBoard(item, now)`, `CLOSED_LINGER_DAYS`.
- `scripts/hg-smoke.mjs` atriði 14: kassi settur inn með `created_by` stimpluðum, staða í smoke sýninni (atriði 9) sem hreyfir ekki `hg_zones.pos_*`, `w` undir 160 hafnað, eyðing sýnar fellir stöðuna, eyðing kassans fellir hana líka, `hg_items.updated_at` ósnert allan tímann. Kassinn eytt í `finally`.

Handvirkt (Heimir): teikna kassa með mús og á iPad, nefna og lita hann, draga nafnið með þremur kortum og einum pakka inni, draga eitt kort út, stækka með horninu, sama kassi á annarri stöðu í sýn, eyða; fella pakka saman og opna, velja kort úr listanum sem er í felldum pakka; Ctrl rammi um fimm kort, Raða, Afturkalla; loka verki og sjá kortið dofna.

## 7. Plön

- Plan 15, kassar: 4.1 til 4.3, útlitið úr 5, smoke 14.
- Plan 16, tiltekt: 4.4 til 4.6. Plan 16 fer á eftir 15 því bæði breyta `Board.tsx`, `BoardPage.tsx` og `PackColumn.tsx`.

## 8. Ákvarðanir Claude í skjalinu (Heimir sá þær ekki, má snúa)

- **Hornið neðst til hægri stækkar, ekki hver brún.** Minnispunktarnir sögðu "að draga brúnina stækkar hann". Eitt horn breytir breidd og hæð í einu og er eitt grip í `useCardDrag` í stað fjögurra brúna og fjögurra horna; það nær sama tilgangi.
- **Aðild er miðpunktur.** Kort er í kassa þegar miðpunktur þess liggur innan rammans við press. Skörun hefði dregið kort sem snertir kassann með horninu.
- **Kassi færir aldrei annan kassa.** Kassi inni í kassa er leyfður en stendur kyrr þegar sá ytri er dreginn. Hreyfing kassa í kassa í kassa væri regla sem enginn bað um.
- **Allir kassar í öllum sýnum.** Sýn síar kort, ekki merkingar á borðinu. Tómur kassi í sýn er hægt að draga til hliðar í þeirri sýn.
- **Stærð er sameiginleg, staðan per sýn.** Eins og pakkar: breidd pakka er sameiginleg, staðan per sýn.
- **Kassi er settur inn áður en spjaldið opnast**, með nafninu "Kassi". Þá er hann til, dreganlegur og sýnilegur öðrum strax; óæskilegur kassi er eytt í spjaldinu. Hinn kosturinn, spjald sem bíður með rammann í minni, skilur teiknihaminn eftir hálfnaðan ef Heimir smellir annað.
- **Teiknihamur tekur bendinguna í capture**, eins og Ctrl ramminn, svo hvorki pan né kortdrag ruglast í honum. Esc, hnappurinn, of lítill rammi og lokið teikning slökkva allir.
- **Fimm tónar á kassa, ekki hex.** Módúlar bera metta liti af því að þeir eru módúlar metta. Kassi er merking Heimis og tónarnir fimm nægja; litavalið er til nú þegar.
- **Samanfelling felur kort af borðinu en ekki úr listanum eða pillunum.** Listinn er til að finna, pillurnar telja stöðuna. Felldur pakki er ekki sía.
- **Samanfelling í eigin geymslulykli** (`hg.packs.<projectId>`), ekki inni í `hg.list.<projectId>`. Sitt hvor hluturinn, sitt hvor lykillinn.
- **Listaval opnar felldan pakka.** Hinn kosturinn, að `reveal` bregðist þegjandi, væri gat.
- **Raða er stika sem birtist við val**, ekki flýtilykill eða valmyndaratriði. Hún sést aðeins þegar hún getur gert eitthvað og hverfur með valinu.
- **Gridið er `ceil(sqrt(n))` dálkar** miðjað á valið. Engin stilling. Fimm kort verða 3 og 2, níu verða 3 og 3.
- **Afturköllun í 8 sekúndur**, í stikunni sjálfri, ekki sem toast. Ein afturköllun, aðeins síðustu röðunar.
- **Þrír dagar** fyrir lokuð kort. Nógu langt til að sjá það sem lokaðist um helgi, nógu stutt til að borðið sé ekki kirkjugarður. Talan er í `CLOSED_LINGER_DAYS` á báðum hliðum (parity).
- **Lokað kort passar við enga tónsíu.** Pillutala og sía stemma í dag (CLAUDE.md, "Counter pills filter by count bucket") og lokað kort í engri pillu má ekki lýsast undir einni. Sýn án tóns sýnir þau, sýn með tónum ekki. Engin ný pilla.
- **Teiknihamur tekur hverja bendingu**, líka ofan á korti. Kassi á að geta náð yfir kort sem eru þegar á borðinu, og einn hamur með einni reglu er auðveldari að skilja en hamur sem hleypir sumum pressum í gegn.
- **Felldur pakki tekur falin kort sín með sér.** Annars sæti kort langt frá pakkanum sínum þegar hann opnast, með teygðan vír. Skrifað beint við sleppingu, því falin kort hafa enga fjöður.
- **Nýtt kort í módúl fellds pakka lendir við dálkinn**, ekki á miðju sýnar, og pakkinn opnast á eftir. Staðan er vistuð, svo hún á að vera nálægt módúlnum.
- **Listinn fær hópinn Lokið** í stöðuröð í stað þess að fela kortin, því listinn og borðið sýna sömu kort (plan 10).
- **Engir atburðir fyrir kassa.** Sýn hefur enga og kassi er sama tegund af hlut: skipulag, ekki verk.

## 9. Eftir hjá byggjanda

- Nákvæm SQL í 0017 (planið ber hana orðrétt).
- Hvernig `Board` geymir meðlimi kassadrags: planið velur (`groupStart` með kassann sem grip).
- Teikning hornmerkisins (SVG eða CSS): planið gefur CSS.
