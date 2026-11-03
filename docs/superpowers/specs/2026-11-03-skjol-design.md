# Huginn: skjöl, lýsing, sækja og lesari (hönnunarskjal)

Dagsetning: 2026-11-03
Staða: drög úr samtali Heimis og Claude (Fable) 3. nóv, byggt á minnispunktunum í `2026-11-03-naestu-verk-hugmyndavinna.md` (verk 2) og mockupinu `reader.html` B í `.superpowers/brainstorm/877553-1793721116/content/` (gitignored, á disk Heimis).
Grunnur: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (gagnalíkan), plan 11 (`docs/superpowers/plans/2026-11-03-skjal-uppfaert.md`, sama repo slóð er sama skjal, migration 0014). Þetta skjal bætir einum dálki við `hg_files` (migration 0015) og breytir Skjöl flipanum, lesaranum, spjaldinu, CLI, speglinum, skillinu og `hg-analyse`.

Þetta er annað af fjórum verkum úr samtalinu 3. nóv. Verk 1 (spjöld og spjall) er plan 12. Leit og tögg, og kassar og tiltekt, fá sín eigin skjöl.

## 1. Tilgangur

Skjöl á verki eru í dag listi af nöfnum. Heimir opnar þau til að lesa upplýsingar, og spjaldið sem þau opnast í er 460 px breitt: mikið skroll upp og niður, töflur brotna, engin leið að sjá hvar í skjalinu maður er. Þegar hann er búinn að lesa gerir hann eitt af þrennu: sækir skjalið, afritar það allt, eða afritar bút. Afritun úr teiknuðu skjali gefur slétttexta, en hann vill markdown, því það er það sem hann límir inn í lotu eða skjal.

Nöfnin segja heldur ekki hvað skjalið er. Claude og Árni bæta við skjölum með `huginn file add` og í upphleðslublaðinu, og Heimir þarf að opna hvert þeirra til að vita hvort það er hönnunarskjal, prófunarbók eða skjáskot.

Lagfæringin: hvert skjal ber eina setningu sem segir hvað það er og fyrir hvern, hver röð og lesarinn fá Sækja, og lesarinn verður breitt spjald með efnisyfirliti, læsilegri línubreidd, rofa milli teiknaðs skjals og hrás markdown, og Afrita allt.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Skjalalistinn segir með einni setningu hvað hvert skjal er. Setningin kemur með skjalinu (CLI `--note`, reitur í upphleðslu) og Claude lagar hana í lotu.
- Sækja á hverri röð og í lesaranum, skjalið fær sitt eigið nafn á disknum, enginn nýr flipi.
- Md og txt skjöl eru lesin í breiðu spjaldi: borðið sést áfram vinstra megin, efnisyfirlit úr fyrirsögnum, 65 til 72 stafir í línu, töflur skrolla til hliðar.
- Rofi Lesa / Md: í Md er skjalið sýnt hrátt svo valinn bútur afritast sem markdown.
- Afrita allt afritar allt skjalið sem markdown.
- Esc lokar lesaranum, annað Esc spjaldinu. Til baka lendir í Skjöl flipanum og spjaldið mjókkar aftur.
- Lýsingin fer í `item.md` svo byggingarlota sjái hvað hvert skjal er án þess að sækja það, og í `hg-analyse` svo skyndigreiningin viti það líka.

**Ekki-markmið**

- Upphleðsla á verk sem er þegar til, af vefnum. Vefurinn hleður aðeins upp í „Nýtt verk" blaðinu, eins og í dag. Skjöl á verk sem er til koma með `huginn file add`.
- Lesari fyrir pdf, html, myndir eða önnur snið. Þau opnast áfram í nýjum flipa gegnum undirritaða slóð.
- Breyta lýsingu á vefnum. Hún er skrifuð einu sinni (CLI eða upphleðsla) og Claude lagar hana með `huginn file set`. Heimir staðfesti 3. nóv.
- Leit í skjalatexta eða lýsingum. Það er verk 3 (leit og tögg).
- Eyða skjali af vefnum. Óbreytt.
- Að breyta `fileCountsByItem`, `sortFiles` eða `fileStamp`. Lýsing breytir hvorki talningu, röð né stimpli.

**And-markmið**

- Lituð rönd eða bar vinstra megin á skjalaröð, í efnisyfirlitinu eða í lesaranum. Virk fyrirsögn í efnisyfirlitinu er feitletruð og í `--hg-ink`, ekkert annað.
- Lesari sem hylur allt borðið á tölvu. Valkostur A (gluggi yfir borðinu) var hafnað 3. nóv, Heimir vill sjá borðið vinstra megin.
- Lýsing sem verður að annarri samantekt. Ein setning, hámarkslengd í kóða.
- Að note breyting telji sem „uppfært skjal". Stimpillinn og `file.updated` atburðurinn fylgja nýjum storage hlut eins og í 0014, aldrei lýsingunni.

## 3. Skorður

- Migration 0015 bætir aðeins einum dálki við. Engir nýir triggerar, engin breyting á `hg_stamp_author`, `hg_log_event` eða `hg_unread`: þau skoða `storage_path`, ekki `note`, svo lýsing sem er skrifuð eða löguð hreyfir hvorki `updated_at` né skrifar atburð. Það er viljandi (and-markmið).
- Allt í `src/vinnubord/`, `cli/`, `supabase/migrations/`, `supabase/functions/hg-analyse/`, `scripts/hg-smoke.mjs`, `scripts/hg-shots.mjs`, `cli/README.md` og skillið `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md`. Engin ný UI söfn, táknmyndir eru inline SVG.
- Hrein rökfræði í `lib/` með vitest, CLI afritar það sem það þarf í `.mjs` og `parity.test.mjs` passar að það stemmi.
- Tókens á `:root` í `vinnubord.css`, reglur lesa aðeins tókens. Snertiútgáfan í `pointer: coarse` blokkinni.
- Engin breyting á `PanelShell` snertireglunum (gripið, hausinn, body yfirtaka) nema að stika lesarans telst haus: `.hg-reader-bar` bætist í valið `.hg-sheet-handle, .hg-pn-head` í `onPointerDown` og í `onStart` undantekningalistann, ekkert annað. Lesarinn á síma notar sama skrunara og flipinn, svo yfirtakan virkar óbreytt.
- `marked` og DOMPurify eru áfram aðeins í lata bútnum: `FileReader` er `lazy` eins og `MarkdownView`, svo `outline` (sem þarf `marked.lexer`) hleðst fyrst þegar lesari opnast. Ekkert í `ItemPanel` eða `BoardPage` flytur `lib/markdown.ts` inn beint.
- Engin em strik.

## 4. Hegðun

### 4.1 Lýsing á skjali

`hg_files.note text` (migration `0015_hg_file_note`, aðeins `alter table hg_files add column note text`). Null þýðir engin lýsing.

Reglan um innihald, eins á öllum stöðum: ein setning, hvað skjalið er og fyrir hvern („Hönnunarskjal lesarans, fyrir Heimi og byggjanda", „Skjáskot af Instagram prófílnum fyrir Árna"). Hreinsun fyrir skrif (`normalizeNote` í `src/vinnubord/lib/upload.ts` og `cli/lib/write.mjs`, parity): `trim`, allir hvítbilsrunur (þar með talin línubil) verða eitt bil, tóm niðurstaða verður `null`, lengri en `NOTE_MAX` (200 stafir) er hafnað með íslenskri skýringu („Lýsing má mest vera 200 stafir."). Ekkert markdown, ekkert sem er túlkað.

Hvar hún kemur inn:

- `huginn file add <item> <path> [--repo-path ..] [--note "..."]`. Við nýja röð fer note í insertið. Við uppfærslu á sömu repo slóð (0014) skrifast note aðeins ef `--note` er gefið, annars stendur gamla lýsingin; `unchanged` niðurstaða (sömu bæti) skrifar samt note ef `--note` er gefið og það er annað en það sem stendur (þá er niðurstaðan áfram `unchanged` fyrir skjalið, textinn segir „lýsing uppfærð" að auki). `--json` fær `note` í svarið ekki, `id` og `outcome` duga.
- `huginn file set <fileid> --note "..."` (ný skipun). Skrifar note á röðina, ekkert annað. Tóm eða hvítbils lýsing er hafnað („Vantar --note."). Texti: „Lýsing skjals #id uppfærð." `--json`: `{ ok: true, id }`.
- Upphleðslublaðið („Nýtt verk"): hver valin skrá fær textareit undir nafnalínunni (`.hg-new-file-note`), placeholder „Lýsing, ein setning: hvað þetta er og fyrir hvern", `maxLength` NOTE_MAX, valfrjáls. `uploadFile` í `lib/api.ts` tekur `note?: string` og skrifar `normalizeNote` niðurstöðuna. Reiturinn læsist með blaðinu (`locked`).

Hvar hún sést:

- Skjöl flipinn: ein lína undir nafninu (`.hg-file-note`, `--hg-ink-3`, `--hg-pn-h-size`, `overflow-wrap: anywhere`, engin stytting), yfir „by" línunni. Engin lína þegar note er null.
- `item.md` skráalistinn: nafnið, stutta auðkennið og lýsingin í sviga, `- plan.md #1a2b3c4d (Hönnunarskjal lesarans, fyrir Heimi), 1234 bæti: í repoinu, docs/plan.md`. Án note: `- plan.md #1a2b3c4d, 1234 bæti: ...`. Auðkennið er nýtt á öllum línum (fyrstu 8 stafir, eins og `pull`), svo lota geti kallað `huginn file set` á skjal sem hún sér í `item.md` án þess að fara í `pull --json`.
- `item create --file` er óbreytt (engin `--note`, einn rofi fyrir margar skrár passar ekki við eina setningu á skjal). Skillið segir lotum að setja skjöl á nýtt verk með `file add --note` á eftir `item create`, ekki með `--file`.
- `hg-analyse`: `readFiles` velur líka `note`, `MessageFile` fær `note?: string`, og hver skráarlína í `# Skrár` endar á `: ${note}` þegar hún er til. Nýtt dæmi í `lib.test.ts`. Fallið er sett upp aftur (version 11) með MCP eins og í plani 4, deno check fyrst.
- Hvergi á spjaldinu (kortinu), hvergi í `pull --brief`. `pull --json` ber `note` sjálfkrafa (`select('*')`).

Lýsingin er ekki í lesaranum (Heimir 3. nóv, mockupið): hún stendur í listanum.

### 4.2 Sækja

Á hverri skjalaröð í Skjöl flipanum stendur Sækja hnappur hægra megin í nafnalínunni (`.hg-file-dl`, táknmynd ör niður í bakka, `--hg-touch` hár og breiður, `aria-label` „Sækja {{name}}"). Ekki á planröðum, þær eru slóð í repoinu án storage hlutar. Í lesaranum er Sækja með texta í stikunni efst.

Útfærsla: `fileUrl(storagePath, downloadAs?: string)` í `lib/api.ts` kallar `createSignedUrl(path, SIGNED_URL_SECONDS, { download: downloadAs })` þegar `downloadAs` er gefið. Storage svarar þá með `Content-Disposition: attachment; filename=...`, svo vafrinn vistar skjalið undir sínu nafni án þess að fara af síðunni. `downloadFile(file)` (nýtt í `lib/api.ts` eða í FilesTab, byggjandi velur) sækir slóðina og smellir á falinn `a` með `href` og `download={file.name}`; enginn `window.open`, svo engin popup vörn. Nafnið verður að koma rétt út með íslenskum stöfum („Hönnunarskjal.md"): byggjandi prófar það fyrst með undirrituðu slóðinni, og ef Storage skilar nafninu brengluðu er leiðin í staðinn `download` blob úr `supabase.storage` (sama kall og `fileText` notar), `URL.createObjectURL`, falinn `a` með `download` nafninu og `revokeObjectURL` á eftir. Hvor leiðin sem er valin gildir fyrir alla, ekki eftir nafni. Villa fer í sömu `hg-pn-error` línu og opnun. Tvísmellur sækir einu sinni (sama `opening` sett og opnun notar). Á síma (iOS Safari) sýnir vafrinn sitt eigið niðurhalsblað, það er í lagi; Heimir prófar í uppsetta PWA.

`huginn file get` er óbreytt.

### 4.3 Lesarinn (valkostur B)

Opnast þegar smellt er á nafn md eða txt skjals í Skjöl flipanum (önnur snið fara áfram í nýjan flipa). Lesarinn er ekki lengur inni í flipanum: hann leysir allt innihald spjaldsins af hólmi á meðan hann er opinn, og spjaldið breikkar.

**Ástand.** `readerFileId: string | null` býr í `BoardPage`, ekki í `FilesTab`. Ástæðan: breiddin á spjaldinu, fría svæðið á borðinu, listinn, staða toastsins og Esc reglan þurfa öll að vita af lesaranum, og þau búa í `BoardPage`. Það er auðkenni, ekki röð: `BoardPage` flettir röðinni upp í `data.files` á hverri teikningu (`readerFile`), svo uppfært skjal (0014, nýr `storage_path`) og Sækja lesa alltaf lifandi röðina; hverfi röðin úr gögnunum lokast lesarinn (sama regla og valið verk sem hverfur). `readerFileId` er aðeins virkt þegar röðin er á valda verkinu. Ein `useEffect` á `selectedId` núllar það, svo `select`, `closePanel`, `openModule`, verk sem hverfur og hver önnur leið sem breytir valinu núlla lesarann án þess að hver þeirra muni eftir því. `ItemPanel` fær `readerFile: FileRow | null` og `onReader(fileId: string | null)`. Opnun setur `tab` í `files` í `ItemPanel` (svo Til baka lendi þar) og kallar `onReader(file.id)`.

**Teikning.** `ItemPanel` teiknar `.hg-pn` tréð sitt áfram (haus, flipar, body, sendingarkassi) en með `hidden` meðan lesarinn er opinn, svo drög, skrun og opin flipi lifa. Lesarinn er systkini: `FileReader` í `components/panel/FileReader.tsx`, keyed á `file.storage_path`, svo skjal sem Claude uppfærir (0014) meðan það er opið hleðst aftur. Hann sækir textann sjálfur með `fileText` við mount og sýnir „Hleð skrá" (`vinnubord.panel.files.loading`) og villu eins og í dag.

**Stikan efst** (`.hg-reader-bar`, ein röð á tölvu, tvær á síma): Til baka (`hg-btn hg-btn-ghost`, vinstra megin), nafn skjalsins (`.hg-reader-name`, ellipsis í einni línu með `title`), svo hægra megin: rofinn Lesa / Md (`.hg-reader-mode`, tveir hnappar með `aria-pressed`), Sækja (4.2), Afrita allt (texti, `useCopy` úr `CopyButton.tsx`, textinn verður „Afritað" í `COPIED_MS` eins og aðrir afrita hnappar, afritar `normalizeForCopy(source)`). Enginn Afrita slóð hnappur: repo slóðin heldur sínum afrita hnappi í listanum.

**Efnið** (`.hg-reader-main`, tveir dálkar): efnisyfirlit vinstra megin (`.hg-reader-toc`, `nav` með `aria-label` „Efni", breidd `--hg-reader-toc-w`, eigið skrun, sticky efst) og meginmálið (`.hg-reader-body`, skrunar, innihaldið með `max-width: var(--hg-reader-measure)` sem er `68ch`, ekki miðjað, byrjar vinstra megin við tocið). Í Lesa ham er `Markdown` teiknarinn eins og í dag (`.hg-markdown`, töflur skrolla þegar til hliðar með `display: block; overflow-x: auto`). Í Md ham er sami texti í `pre.hg-reader-text` (sem er til) með sömu `max-width`. Rofinn stendur í `ItemPanel` ástandi (`readerMode: 'read' | 'md'`, byrjar í `read`), svo hann lifir milli skjala meðan spjaldið er opið og núllast með spjaldinu. Txt skjöl sýna rofann ekki, þau eru alltaf hrá.

**Efnisyfirlitið.** `renderMarkdown(source, { headingIds?: boolean })` í `lib/markdown.ts`: með `headingIds` fær hver fyrirsögn (`h1` til `h3`) `id="hg-h-N"` með N teljara í röð frá 1 (enginn slug, engir árekstrar, engin íslensk stafabreyting) gegnum eigin `heading` renderer; án valkostsins er úttakið óbreytt frá í dag. Aðeins lesarinn biður um auðkenni: stöðuflipinn teiknar meginmál verksins með sama teiknara og stendur mountaður undir lesaranum, svo auðkenni þar yrðu tvítök í DOM. `Markdown` og `MarkdownView` fá `headingIds` prop sem fer beint áfram. Nýtt fall `outline(source): { id, level, text }[]` keyrir `marked.lexer` og tekur sömu fyrirsagnir í sömu röð með sömu auðkennum, `text` sléttur (inline tokens sameinuð í texta, engin `*` eða `` ` ``). DOMPurify heldur `id`. Uppfletting fyrirsagnar er alltaf innan `.hg-reader-body` (`querySelector` á skrunaranum, aldrei `document.getElementById`). Prófað í `markdown.test.ts`: auðkennin í HTML og í `outline` stemma, röð, dýpt, inline merki strípuð, `h4` og dýpra sleppt, og án `headingIds` engin `id`. Tocið er listi af hnöppum, inndregnir eftir dýpt (`--hg-reader-toc-indent` á hvert stig), smellur skrunar `.hg-reader-body` að fyrirsögninni (`scrollIntoView({ block: 'start', behavior })`, `behavior` `smooth` nema `prefers-reduced-motion: reduce`). Virk fyrirsögn: `activeHeading(tops: number[], scrollTop: number, slack: number): number` í `lib/reader.ts` (hrein, prófuð) skilar vísitölu síðustu fyrirsagnar með `top <= scrollTop + slack`, annars 0; FileReader mælir `offsetTop` fyrirsagnanna eftir teikningu og á resize, og uppfærir virku línuna í `scroll` með rAF þröskuldi. Virka línan fær `.hg-on` (feitletruð, `--hg-ink`). Með færri en 2 fyrirsögnum er toc dálkurinn ekki teiknaður og meginmálið tekur breiddina. Í Md ham er tocið áfram sýnt en smellur gerir ekkert nema skrunað sé að sömu línu: byggjandi sleppir því, tocið er aðeins í Lesa ham (ákvörðun 7).

**Breidd spjaldsins.** `PanelShell` fær `wide: boolean` og setur `.hg-panel-wide` á `aside`. `.hg-panel-side.hg-panel-wide { width: min(var(--hg-panel-w-reader), calc(100vw - 2 * var(--hg-panel-inset))) }`, `--hg-panel-w-reader: 920px`, og `width` fer í `transition` listann með `--hg-dur-view`. Borðsræman vinstra megin er `100vw - 936px`: 88 px við 1024, 504 px við 1440; frá 768 til 952 px er engin ræma (spjaldið tekur breiddina að innfellingunum), það er í lagi á spjaldtölvu. `Toast` fær `panelWide` og `.hg-toast-panel-wide` reiknar `right` með `--hg-panel-w-reader` í stað `--hg-panel-w`. `Board` fær `panelWide` og `padding()` les `--hg-panel-w-reader` í stað `--hg-panel-w` þegar það er satt, svo „Sýna allt", pakkatitill og listaval reikna fría svæðið rétt. Borðið hreyfist ekki sjálft þegar spjaldið breikkar (sama regla og þegar spjaldið opnast, ákvörðun 7).

**Listinn.** Breitt spjald og opinn listi (320 px) komast ekki fyrir saman undir 1256 px, og `freeRect` fengi neikvæða breidd. Reglan: meðan lesari er opinn er listinn lokaður í teikningunni, `listOpen` sem `BoardPage` gefur `Board`, `ListDrawer` og `TopBar` verður `listPrefs.open && !narrow && readerFile !== null ? false : ...` (byggjandi skrifar það sem eina `const listShown`), án þess að skrifa í `hg.list.<projectId>`. Til baka eða Esc skilar listanum eins og hann var. Listahnappurinn í toppstikunni meðan lesari er opinn lokar lesaranum fyrst (sama og Til baka) og opnar svo listann í sama smelli, svo hnappurinn virkar alltaf. Á öllum breiddum, ekki aðeins þar sem þrengslin eru, svo hegðunin sé ein.

**Esc.** `PanelShell` fær valfrjálst `onEscape`; Esc kallar `onEscape ?? onClose` (sama undantekning fyrir textareiti og í dag). `BoardPage` gefur `readerFile ? () => setReaderFile(null) : closePanel`. Lokunarhnappurinn á símablaðinu og drag niður í `closed` kalla áfram `onClose`, sem núllar lesarann með spjaldinu.

**Til baka** kallar `onReader(null)`: spjaldið mjókkar, `.hg-pn` tréð birtist aftur á Skjöl flipanum þar sem það var.

### 4.4 Sími og spjaldtölva

Undir 768 px (blaðið): lesarinn fyllir blaðið undir gripinu. Stikan er tvær raðir (Til baka og nafnið, svo rofinn, Sækja, Afrita allt). Tocið er `details.hg-reader-toc-dd` undir stikunni með `summary` sem sýnir „Efni: {virk fyrirsögn}"; smellur á línu skrunar og lokar `details`. Meginmálið skrunar í `.hg-reader-body`, sem ber líka `hg-pn-body`, svo body yfirtaka `PanelShell` (snerting sem byrjar efst og fer niður dregur blaðið) virkar óbreytt. `wide` hefur engin áhrif á blaðið (reglan er aðeins á `.hg-panel-side`). Esc á lyklaborði síma er sjaldgæft en reglan er sú sama.

768 til 1023 px (spjaldtölva, hliðarspjald): sama og tölva, spjaldið breikkar í `min(920px, 100vw - 32px)`, borðsræman vinstra megin getur orðið mjó. Tocið er sýnt sem dálkur frá 768 px.

Snertitókens: `.hg-reader-toc` og stikan nota sömu yfirborð og spjaldið, engin ný blur. `pointer: coarse` blokkin þarf ekkert nýtt nema byggjandi bæti við tókeni með blur eða skugga.

### 4.5 CLI, skill og `item.md`

- `cli/lib/commands.mjs`: `file add` fær `note: 'value'` í `spec`, `file set` er ný undirskipun (`usage: 'file set <fileid> --note "..."'`, `args: 1`, `spec: { note: 'value' }`). Óþekktir rofar hafna eins og áður.
- `cli/lib/ops.mjs`: `uploadFile` og `putFile` taka `note` (`undefined` þýðir ekki gefið, `null` kemur ekki fyrir utan frá því `normalizeNote` skilar `null` fyrir tómt og CLI hafnar tómu). Nýtt `setFileNote(client, fileId, note)`. Uppfærsluleiðin í `putFile` bætir `note` í `update` hlutinn þegar gefið; `unchanged` leiðin gerir sér `update({ note }).eq('id', row.id)` þegar gefið og ólíkt.
- `cli/lib/write.mjs`: `NOTE_MAX` og `normalizeNote`, parity við `src/vinnubord/lib/upload.ts`.
- `cli/lib/mirror.mjs` `fileLine`: nafnið og lýsingin í sviga (4.1). `mirror.test.mjs` fær tilvik með og án note.
- `cli/README.md`: línurnar fyrir `file add` (með `--note`) og `file set`.
- Skillið `D:/Claude Code/metta2/metta2_new/.claude/skills/huginn/SKILL.md`: hvert `file add` ber `--note`, ein setning, hvað skjalið er og fyrir hvern; lýsing sem er röng eða úrelt er löguð með `huginn file set <fileid> --note`; og liður 1 í lotulokum er endurskrifaður eftir 0014 (sama `--repo-path` uppfærir skjalið í stað þess að bæta við afriti, óbreytt skjal skrifar ekkert, svo skráin má alltaf fara í `file add` aftur). Það er commit í metta2_new, ekki hér.

### 4.6 Smoke og skot

- `scripts/hg-smoke.mjs` scenario 12 „file note": `putFile` með note skrifar hana; `putFile` á sömu slóð án note heldur henni; með annarri note skrifar hana og `updated_at` breytist aðeins vegna nýja hlutarins; `unchanged` með nýrri note skrifar note og ekkert annað (`updated_at` óbreytt, enginn nýr atburður); `setFileNote` skrifar og skrifar engan atburð; `normalizeNote` hafnar yfir 200. `ok 12/12`.
- `scripts/hg-shots.mjs`: `11-reader` á síma og á spjaldtölvu í landslagi: opnar Skjöl flipann, smellir á fyrstu röð með `MD` pillu, bíður eftir teikningu, skot, Esc, skot `11b-reader-back` sem sýnir Skjöl flipann aftur. Sleppt með skilaboði ef engin md röð er á kortinu.

## 5. Útlit

Ný tókens á `:root` undir kaflanum „Side panel and bottom sheet" og nýr kafli „Reader":

```
--hg-panel-w-reader: 920px;
--hg-reader-toc-w: 180px;
--hg-reader-toc-indent: 12px;
--hg-reader-measure: 68ch;
--hg-reader-bar-gap: 10px;
--hg-reader-bar-pad: 12px 16px;
--hg-reader-toc-pad: 16px 12px;
--hg-reader-toc-size: 12.5px;
--hg-reader-toc-line: 1.9;
--hg-reader-body-pad: 18px 24px 24px;
--hg-file-note-gap: 2px;
```

Nýjar klasar: `.hg-panel-wide` (á `aside`), `.hg-reader` (grid: stika, efni), `.hg-reader-bar`, `.hg-reader-mode` (rofinn, `aria-pressed` hnappur fær `--hg-ink` og `--hg-chip-bg`), `.hg-reader-main`, `.hg-reader-toc` (með `.hg-on` á virkri línu), `.hg-reader-toc-dd` (síminn), `.hg-reader-body` (ber líka `hg-pn-body` á síma), `.hg-file-note`, `.hg-file-dl`, `.hg-new-file-note`, `.hg-toast-panel-wide`. `.hg-reader-name` og `.hg-reader-text` eru til og halda sér; `--hg-reader-name-margin` fellur niður ef nafnið fer í stikuna (byggjandi fjarlægir tókenið þá).

Engin ný litatókens: toc línurnar eru `--hg-ink-3`, virk `--hg-ink`, stikan skilin frá efninu með 1 px `--hg-line` eins og flipalínan. Engin rönd.

i18n (`en.json`, `npm run translate`, `is.json` yfirfarið): `vinnubord.panel.files.download` „Download {{name}}", `vinnubord.panel.files.note` (placeholder í upphleðslu, undir `newItem` frekar: `vinnubord.newItem.note` „Description, one sentence: what it is and for whom"), `vinnubord.panel.reader.download` „Download", `vinnubord.panel.reader.copyAll` „Copy all", `vinnubord.panel.reader.read` „Read", `vinnubord.panel.reader.md` „Md", `vinnubord.panel.reader.contents` „Contents", `vinnubord.panel.reader.contentsAt` „Contents: {{heading}}". `vinnubord.panel.files.back` er til. Villan fyrir langa lýsingu er íslensk í kóða eins og aðrar `validateUpload` ástæður.

## 6. Prófanir

- `upload.test.ts`: `normalizeNote` (trim, hvítbil í eitt bil, línubil, tómt verður null, 200 í lagi, 201 hafnað).
- `markdown.test.ts`: með `headingIds` fá fyrirsagnir `hg-h-N` í röð og `outline` stemmir við HTML, inline merki strípuð, `h4` sleppt; án valkostsins engin `id`; sanitizer prófin óbreytt.
- `mirror.test.mjs`: skráarlína með stutta auðkenninu, með og án note.
- `npm run build` sýnir `marked` áfram aðeins í lata bútnum (byggjandi skoðar bútalistann).
- `reader.test.ts`: `activeHeading` (fyrir fyrstu, á milli, eftir síðustu, slack, tómur listi).
- `parity.test.mjs`: `NOTE_MAX` og `normalizeNote` eins í `src` og `cli`.
- `write.test.mjs`: `normalizeNote` í CLI, flaggaskema `file add` og `file set`.
- `supabase/functions/hg-analyse/lib.test.ts`: skráarlína með note.
- `npm run build`, `npm run test`, deno check, `npm run smoke:hg` `ok 12/12`, `npm run shots:hg phone` og `tabletLand` með `11-reader`.
- Handpróf Heimis (skráð í `docs/progress/13-skjol.md`): lýsing sést undir nafni eftir `file add --note`, `file set` lagar hana án þess að röðin merkist uppfærð eða kortið fái bjarma hjá Árna, Sækja af röð og úr lesara vistar skjal með réttu nafni á tölvu og í PWA á símanum, lesarinn breikkar og borðið sést vinstra megin, toc smellur og virk lína, Md rofinn og bútur afritaður sem markdown, Afrita allt, Esc tvisvar, Til baka lendir í Skjöl, tafla skrollar til hliðar, síminn: fullt blað, toc fellilisti, drag niður af efstu stöðu dregur blaðið.

## 7. Ákvarðanir Claude í skjalinu (Heimir sá þær ekki, má snúa)

- Afrita slóð hnappurinn úr minnispunktunum er felldur út úr lesaranum: Heimir afritar texta, ekki slóðir, og repo slóðin hefur sinn hnapp í listanum.
- Afrita allt afritar hrátt markdown líka úr Lesa ham, ekki slétttextann.
- `NOTE_MAX` 200 stafir, hvítbil þjappað, ekkert markdown.
- `file set` tekur aðeins `--note` og hafnar tómri lýsingu; engin leið að þurrka lýsingu út í þessu verki.
- Note breyting skrifar engan atburð og engan stimpil, svo hún sést aldrei sem ólesið.
- `readerFile` býr í `BoardPage`, lesarinn er systkini `.hg-pn` trésins sem fær `hidden`, svo drög lifa.
- Spjaldið er 920 px breitt í lesaranum (tókenið ræður), borðið hreyfist ekki þegar það breikkar.
- Fyrirsagnir fá `hg-h-N` eftir röð, ekki slug. Tocið sýnir `h1` til `h3` og er aðeins í Lesa ham; með færri en 2 fyrirsögnum er það ekki teiknað.
- Rofinn man ham milli skjala meðan spjaldið er opið, ekki milli opnana.
- Txt skjöl eru alltaf hrá, án rofa.
- Sækja fer um `createSignedUrl` með `download` nafni, ekkert blob, enginn nýr flipi.
- Lesarinn er keyed á `storage_path`, svo uppfært skjal hleðst aftur.
- Skillið í metta2_new fær líka lagfæringu á lotulokalið 1, sem lýsir enn hegðuninni fyrir 0014.
- `hg-analyse` fær lýsinguna í skráarlínuna og er sett upp aftur.

Eftir byggjandarýni (Opus, 3. nóv), líka mínar ákvarðanir:

- Listinn er lokaður í teikningunni meðan lesari er opinn og kemur aftur þegar hann lokast; listahnappurinn lokar lesaranum og opnar listann í einum smelli. Valið fram yfir að þrengja lesarann eða láta spjaldið hylja listann.
- Sækja má falla á blob leið ef Storage brenglar íslensk nöfn; ein leið fyrir alla.
- `item.md` skráalínan ber stutta auðkennið, svo `file set` sé hægt úr lotu án `pull --json`.
- `item create --file` fær ekki `--note`; skillið beinir lotum á `file add --note`.
- Stika lesarans er dragsvæði á síma eins og hausinn, með því að bæta klasanum í valið í `PanelShell`.
- Fyrirsagnir fá auðkenni aðeins í lesaranum (`headingIds`), uppfletting innan `.hg-reader-body`.
- `readerFileId` í stað raðar, röðin flett upp lifandi; ein `useEffect` á `selectedId` núllar lesarann.
- `FileReader` er latur bútur svo `marked` haldist utan borðbúntsins.

## 8. Eftir hjá byggjanda

- Hvort `createSignedUrl` í uppsettri `@supabase/supabase-js` (^2.103) tekur `{ download: string }` beint (það hefur verið í storage-js síðan 2.0); annars `?download=<nafn>` á slóðina.
- Hvernig `marked` v18 renderer er gefinn teljari fyrir `id` án þess að snerta hnattræna stillingu (`new Marked()` tilvik eða `marked.use` með eigin `Marked`), og hvernig inline tokens eru sameinuð í sléttan texta í `outline`.
- Hvort `.hg-reader-body` á tölvu þarf `hg-pn-body` klasann líka eða aðeins á síma (hann ber padding og `color` sem lesarinn getur yfirskrifað).
- Hvort `downloadFile` á heima í `lib/api.ts` eða í `FilesTab`, og hvar falinn `a` er búinn til.
- Nákvæm rAF þröskuldun á `scroll` fyrir virku línuna og hvenær `offsetTop` er mælt eftir að lazy `MarkdownView` bútinn kemur.
- Skotin í `hg-shots.mjs`: hvernig fyrsta `MD` röðin er fundin og hvað er gert þegar engin er.
