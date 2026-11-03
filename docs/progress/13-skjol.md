# 13 Vinnuborð: skjöl (plan 13)

Dagsetning: 2026-11-03
Grein: `vinnubord-13` (commits 5bead98 til eaac87c ofan á main 565a794, auk þessa skjals, lesaraskotsins og CLAUDE.md)
Plan: `docs/superpowers/plans/2026-11-03-skjol.md`
Spekk: `docs/superpowers/specs/2026-11-03-skjol-design.md`

Staða: smíði lokið, bíður lokayfirferðar allrar greinarinnar (Fable) og prófunar Heimis. Ein migration (0015) er komin á gagnagrunninn og hg-analyse útgáfa 11 er í loftinu. Eitt commit í metta2_new (6dd545c7 `docs(huginn): file notes`, `/huginn` skillið) er **ekki ýtt**: það fer með næsta ýti þeirrar geymslu.

## Hvað var gert

**Task 1, lýsingarreitur og regla** (5bead98). Migration `0015_hg_file_note` (`alter table hg_files add column note text;`, ein setning, beitt með MCP). `normalizeNote` og `NOTE_MAX` (200) í `lib/upload.ts` og `cli/lib/write.mjs`, `FileRow.note` í `types.ts`, parity próf. Tómt eða hvítbil eitt verður `null`, hvítbil er þjappað í eitt bil.

**Task 2, `huginn file add --note` og `file set`** (bfece93, lagfæring cd22e43). `file add` tekur `--note`, `huginn file set <fileid> --note ".."` lagar lýsingu á skrá sem er til. Skipti á sömu repo slóð án `--note` heldur gömlu lýsingunni. Tóm `--note` er hafnað. Lýsingarbreyting skrifar engan atburð og engan stimpil. `npm run smoke:hg` atriði 12 (`ok 12/12`) nær yfir bæta við, skipta, óbreytt og `file set`.

**Task 3, lýsing og Sækja á skjalaflipanum** (c31ea95). Lýsingarlína (`.hg-file-note`) undir nafni skráar og Sækja hnappur (`.hg-file-dl`, 44 px) á hverri skrá. Sækja fer um blob leiðina: undirritaðar slóðir Supabase tvíkóða íslensk skráarnöfn (`filename*=UTF-8''H%25C3%25B6...`), svo nafnið brenglast. Blobbinn er afturkallaður 60 sekúndum eftir smell, því Safari getur misst niðurhal sem er afturkallað strax og vistunargluggi getur haldið niðurhalinu.

**Task 4, fyrirsagnir og efnisyfirlit** (be06689). `renderMarkdown` með `headingIds` gefur h1 til h3 á efsta stigi auðkennin `hg-h-N` í röð, `outline` skilar sömu röð. Án valkostsins engin `id`. `marked` er áfram aðeins í lata bútnum.

**Task 5, lesarahjálpir** (091573c). `lib/reader.ts`: `readerKind`, `showToc` (tvær fyrirsagnir eða fleiri), `activeHeading` (tómur listi gefur 0) og `ReaderMode`. `fileKindLabel` (`lib/upload.ts`) og `normalizeForCopy` (`lib/clipboard.ts`) nýtast lesaranum.

**Task 6, lesarinn** (82fe841, lagfæring 6f435e2). `FileReader.tsx` (lat): stika með Til baka, nafni, Lesa og Md rofa (aðeins md), Sækja og Afrita allt. Efnisyfirlit við hlið textans á breiðu borði, fellilisti (`Efni: {fyrirsögn}`) undir stikunni á síma. Virk lína er feitletruð, engin rönd. `FileReader` er lykluð á `storage_path`, svo skipti á skránni hlaða nýjum texta. Bilað Sækja skilur textann eftir og sýnir villulínu undir stikunni. Fókushringur á rofa og efnisyfirliti.

**Task 7, breiða spjaldið** (e175b1f). `readerFileId` býr í `BoardPage` og stýrir breiðu spjaldi (`.hg-panel-wide`, 920 px, `--hg-panel-w-reader`), frjálsa svæðinu, listanum (hverfur meðan lesari er opinn, `hg.list.<projectId>` breytist ekki), Esc og tilkynningu (`.hg-toast-panel-wide`). Á síma er blaðið áfram fullt og `.hg-reader-bar` dregur það eins og haus.

**Task 8, lýsing í nýju verki** (6048b8f, lagfæring cbb100f). Lýsingarreitur á hverri skrá í nýju verki (`.hg-new-file-note`, hámark 200), lokaður meðan upphleðsla gengur. Lagfæringin þrengir reglurnar svo reiturinn sé strik en ekki rammi.

**Task 9, lýsing í `item.md` og greiningunni** (eaac87c). `fileLine` í `cli/lib/mirror.mjs` skrifar `- plan.md #1a2b3c4d (Hönnunarskjal lesarans, fyrir Heimi), 1234 bæti: í repoinu, docs/plan.md`. hg-analyse fær lýsinguna í skráarlínuna í skilaboðunum, útgáfa 11 er sett í loftið (`verify_jwt` false, tvær skrár, íslenskir stafir sem `\u` í sendingunni) og borin saman við repo: eins. metta2_new commit 6dd545c7: skillið segir að skrár séu sóttar með `#auðkenni` og lýsingu og að nýjar skrár fái `--note`.

**Task 10, skot, skjal, CLAUDE.md** (þetta commit). `scripts/hg-shots.mjs` tekur `11-reader` og `11b-reader-back`. Ef spjaldið sem listinn valdi hefur enga md skrá reynir skriftan næstu raðir listans (upp í 12), og á síma er spjaldið lokað með Esc áður en listinn er opnaður aftur. CLAUDE.md og þetta skjal.

## Ákvarðanir í byggingu

- Nafnaprófið í Task 3 var keyrt sem node skripta (undirrituð slóð með `download` nafni) en ekki í vafra, sama sönnun.
- Hrá px og em gildi úr plan CSS (táknstærð, bil á rofa, bil á efnishaus, rými á síma) urðu tokens í lesarahlutanum, því reglur lesa aðeins tokens.
- UI athuganir í byggingu voru gerðar með Playwright þar sem hægt var, það sem ekki er hægt að sjálfvirkja er í listanum hér fyrir neðan.
- Task 8 notar `--hg-fs-field`, því `--hg-field-font` er ekki til.
- Skipti á skrá skilar `noteUpdated` þegar `--note` er gefin og er ólík, svo texti skipanna geti sagt "lýsing uppfærð".
- Tóm `file set --note` segir `--note vantar.`, sama orðalag og þegar flagg vantar.
- Óbreytt skrá með nýrri lýsingu segir "óbreytt ..., lýsing uppfærð", ekki "ekkert skrifað".
- `file add --note ""` er hafnað, ekki túlkað sem að þurrka lýsingu. Engin leið er að þurrka lýsingu út í þessu verki.
- Smoke atriði 12 fékk tilvik fyrir skipti með nýrri lýsingu. Lengdarmörkin 200 eru prófuð í einingaprófum, ekki á lifandi gagnagrunni.
- Blob slóðin er notuð fyrir allar skrár (spekk 4.2 varaleiðin), ekki aðeins þær með íslensk nöfn.
- Blobbinn er afturkallaður 60 sekúndum eftir smell, því vistunargluggi (Firefox, Safari með "spyrja alltaf") getur haldið niðurhalinu.
- Aðeins h1 til h3 á efsta stigi fá auðkenni (ekki fyrirsagnir inni í tilvitnun eða lista), svo auðkenni í HTML og efnisyfirlit stemmi alltaf.
- Md hamur heldur `68ch` mörkunum, sem eru mjórri í pixlum í mónóletri (498 á móti 581), því `ch` er heiðarleg línulengd.
- Bilað Sækja í lesaranum skiptir ekki textanum út, villan kemur sem lína undir stikunni.
- Fókushringur á Lesa og Md rofa og á efnislínur er sami innri hringur og á listaröðum, líka á virkri línu.
- Breiða spjaldið helst breitt meðan það rennur út við lokun.
- Lýsingarreglur nýs verks eru þrengdar við `.hg-new-file .hg-new-file-note`, með sérreglu fyrir `min-width: 768px` á eftir, svo reiturinn líti út eins og aðrir reitir blaðsins.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 35 skrár, 571 próf græn (560 eftir Task 1 og 2, 566 eftir Task 4, 570 eftir Task 6, 571 eftir Task 9).
- `npm run smoke:hg` skrifaði `ok 12/12` í Task 2 (atriði 12 bættist við). Ekki keyrt aftur í Task 10: planið snertir engan gagnagrunnskóða síðan.
- deno check á `supabase/functions/hg-analyse/index.ts`: hreint í Task 9. Útgáfa 11 í loftinu er sama og HEAD.
- Lýsing var skrifuð á lifandi skrá dbb620e9 í Task 3 (`Minnispunktar úr hönnunarumferð viðhalds, með tækjalista v2.`). Lýsingarbreyting skrifar engan atburð, svo hún kveikti ekkert ólesið.
- Skotin voru tekin á móti `npm run preview` af þessari grein: `SITE=http://localhost:4173 npm run shots:hg phone` og `tabletLand`. Engar villur í console. Skotin eru í `.playwright-mcp/shots/`:
  - `phone-11-reader.png`: fullt blað á síma með lesarastikunni í tveimur röðum (Til baka í skjöl og nafnið, svo Lesa og Md rofi, Sækja og Afrita allt), fellilistinn "Efni: 129: Askur Pizzeria..." undir stikunni og textinn með fyrirsögnum, lista og kóðabútum.
  - `phone-11b-reader-back.png`: eftir Esc er lesarinn farinn og Skjöl flipinn opinn með skránni (MD merki, Sækja táknið hægra megin, repo slóðin neðar).
  - `tabletLand-11-reader.png`: breitt spjald (920 px) yfir borðinu, listinn hulinn, stika með Til baka, nafni, Lesa og Md, Sækja og Afrita allt, efnisyfirlit til vinstri (EFNI, fyrsta lína feitletruð) og textinn með töflu til hægri.
  - `tabletLand-11b-reader-back.png`: eftir Esc er listinn kominn aftur vinstra megin, spjaldið er aftur 460 px með Skjöl flipann opinn og skrána, valda spjaldið lýst á borðinu.

## Það sem Heimir athugar

- Lýsing sést undir nafni skráar eftir `huginn file add --note`, og `huginn file set` lagar hana án þess að röðin merkist uppfærð eða kortið fái bjarma hjá Árna.
- Sækja af röð og úr lesara vistar skjal með réttu nafni á tölvu, líka skrá með íslenskum stöfum. Á iPhone (PWA) og iPad: sama próf, og að Safari opni ekki blobbinn í nýjum flipa í stað þess að vista. Firefox á tölvu: vistar einu sinni með réttu nafni.
- Lesarinn breikkar og borðið sést vinstra megin við hann. Listinn hverfur meðan lesari er opinn og kemur aftur með Til baka.
- Efnisyfirlit: smellur skrollar á fyrirsögnina, virka línan fylgir skrollinu. Md rofinn sýnir hráan texta og bútur sem er valinn afritast sem markdown. Afrita allt.
- Esc tvisvar: fyrst lokar lesaranum, svo spjaldinu. Til baka lendir í Skjöl flipanum. Tafla í skjali skrollar til hliðar.
- Skrollstaða á Skjöl flipanum lifir að opna og loka lesaranum, á alvöru tæki.
- Sími: fullt blað, efnisyfirlit sem fellilisti, drag niður af lesarastikunni dregur blaðið (ekki prófað á alvöru síma).
- Alvöru txt skrá á opnu verki (metta á enga í dag, aðeins `profun.txt` á föllnu verki).
- Rauntími: þegar Claude keyrir `file add` á sömu repo slóð meðan lesari er opinn hleður lesarinn nýja textanum.
- Ný verkstilkynning meðan lesari er opinn á 1440 px: hún situr vinstra megin við breiða spjaldið (`huginn item create` úr öðru skeljarglugga, eða þegar Árni bætir við).
- Breikkun spjaldsins (220 ms) og útrennsli breiðs spjalds líta rétt út.
- Eftir næsta verk frá Árna með skrá: `analysis.done` kemur í söguna og samantektin tekur mið af lýsingunni (hg-analyse logg), og `huginn sync` skrifar `#auðkenni (lýsing)` í skráarlínur `item.md`.
- Nýtt verk með skrá og lýsingu: lýsingin sést á skjalaflipanum, engin lína undir skrá án lýsingar, reiturinn er læstur meðan upphleðsla gengur.

## Opið

- metta2_new commit 6dd545c7 er ekki ýtt: það fer með næsta ýti þeirrar geymslu.
- Aðdráttarhnapparnir (Sýna allt) eru undir hliðarspjaldinu á borði, og með 920 px spjaldi eru þeir faldir á öllum breiddum meðan lesari er opinn. Útreikningurinn er réttur, en hönnunarspurning hvort hnapparnir eigi að færast vinstra megin við opið spjald.
- Við 768 til um 951 px er tilkynning falin undir spjaldinu með lesara opinn (spekk 4.3 sættir sig við mjóa ræmu). Við 1024 px er hún 56 px breið.
- Lyklaborðsfókus fellur á síðuna þegar lesarinn opnast og þegar Til baka lokar honum, svo Tab byrjar efst. Laga síðar: fókus á Til baka við opnun og á skráarröðina við til baka.
- `file add --json` skilar `noteUpdated: false` á nýrri skrá sem fékk lýsingu (reiturinn þýðir að til lýsing breyttist).
- Smávægilegt sem var frestað í yfirferð (allt í `.superpowers/sdd/2026-11-03-skjol/progress.md`):
  - `note.length` telur UTF-16 einingar, svo emoji telst sem 2 (sama og `maxLength` í reitnum).
  - Engin lengdarmörk á `note` í gagnagrunni, aðeins í vef og CLI (ein setning í migration, að ásettu ráði).
  - `file add --json` skilar aukareitnum `noteUpdated` (viðbót).
  - Óbreytt skrá með nýrri lýsingu hefur enga `storage_path` vörn (skaðlaust, lýsingin tilheyrir röðinni).
  - Haus athugasemd í `FilesTab` var breytt án þess að endurbrjóta línur.
  - `downloadFile` afturkallar ekki object slóðina ef `a.click()` kastar villu.
  - `outline` brýtur ekki inn í tákn, svo `***x***` sýnir `**x**` og inline html sést sem texti í efnisyfirliti (spekk 4.3 segir engin `*` eða bakstrik).
  - Fyrirsögn með línuskilum (setext) og `&amp;` í frumtexta sjást bókstaflega í efnisyfirliti.
  - Html `id="hg-h-N"` í skjali gæti rekist á raunverulega fyrirsögn (leitin er bundin við lesaralíkamann).
  - Endingin `.markdown` fær engan lesara (`fileKindLabel` gefur SKRÁ).
  - Afrita allt sýnir enga endurgjöf þegar afritun mistekst.
  - Virk efnislína getur verið úrelt eftir Lesa, Md, Lesa þar til næsta skroll gerist.
  - `Suspense` fallback í `ItemPanel` er án bils.
  - Staða skrolls í `.hg-pn-body` yfir hidden hring er óstaðfest á alvöru tæki.
  - Fókushringur á efnislínum á dýpt 0 liggur upp að textanum (ekkert lárétt bil á hnöppunum).
  - Breiddarhreyfingin spjaldsins hreyfist líka þegar gluggi er stækkaður.
  - `readerFileId` helst eftir að röðin er farin þar til valið breytist (engin áhrif).
  - Lýsingarreitur sést á skrá sem var hafnað þegar hún var valin, og lýsingin kemst aldrei í geymslu.
  - Löng placeholder lýsingarreits er líklega klippt við 390 px (`aria-label` ber textann).
  - SYSTEM_PROMPT segir ekki að textinn á eftir tvípunkti á skráarlínu sé lýsing höfundar.
  - Lýsing er sett óhreinsuð í greiningarskilaboðin (nýja línu úr beinu SQL gæti falsað kafla): þjappa hvítbili.
  - `note` dreifingin er endurtekin fimm sinnum í `files.push` í `index.ts`.
  - SKILL.md línur 16 og 43 segja enn að skráarauðkenni komi aðeins úr `pull --json`.
  - Ekkert próf fyrir lýsingu á `overBudget` línu eða með línuskilum og svigum í mirror.
