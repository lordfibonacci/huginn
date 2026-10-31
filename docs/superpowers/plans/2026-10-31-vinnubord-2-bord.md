# Huginn vinnuborð, plan 2 af 4: borðið (yfirborð, spjald, síur, snerting, hreyfing, stillingar)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Borðið sjálft á `/p/:slug`: fastir pakkadálkar með módulum, færanleg verk, þræðir með glóð og neistum, spjald með flipum, toppstika með síum, nýtt verk og upphlaðning, snerting að fullu, og stillingasíða verkefnis.

**Architecture:** Borðið er eitt `world` lag með `translate(x,y) scale(z)` og canvas-lag yfir fyrir þræði í skjáhnitum (getBoundingClientRect), eins og mockupið. Viewport-ástand í einum hook, drag/pinch/wheel í öðrum. Kort og módular eru venjuleg DOM-element svo texti, smellir og aðgengi haldist. Spjaldið er fast lag hægra megin á breiðum skjá og botnblað undir 768 px. Útlit í tokens í `src/vinnubord/vinnubord.css` (einn staður, Heimir breytir).

**Tech Stack:** React 19, Tailwind v4 + hrá CSS fyrir tokens og hreyfingu, Canvas 2D, Pointer Events (snerting og mús í sama kóða), marked + DOMPurify fyrir markdown.

**Spec:** `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (kaflar 5b, 5c, 6). Mockup til viðmiðunar á hegðun, ekki kóða: `.superpowers/brainstorm/770768-1793436912/content/whiteboard-v7.html`.

## Global Constraints

- Sömu og plan 1 (grein `vinnubord`, `hg_` töflur, engin þankastrik, íslenska, build er hliðið).
- Enginn dregur til að breyta stöðu. Dráttur breytir bara `pos_x`/`pos_y`. Staða breytist bara í spjaldinu með skýrri aðgerð eða úr skipanalínutólinu.
- Allir snertifletir að minnsta kosti 44 px. Pinch-zoom, tveggja fingra pan, langt hald (350 ms) til að draga kort á snertiskjá.
- `prefers-reduced-motion: reduce` slekkur á innkomu, neistum, norðurljósum og fjöðrun.
- Engin ný UI-söfn. Engar myndir nema SVG inline.
- Afritunartakki (`CopyButton`) á hverju prompti, SQL-blokk, slóð og næsta skrefi; notar `navigator.clipboard.writeText` með fallback (textarea + execCommand) fyrir eldri Safari.

## Review Focus

1. Pinch á iPad: zoom í kringum miðju fingranna, ekki hornið, og kort hreyfast ekki á meðan. Próf í verki 2 (rúmfræðipróf) + handpróf á iPad.
2. Smellur á kort á meðan dregið er má ekki opna spjaldið; 3 px þröskuldur. Próf í verki 3.
3. Verk án módula (module_id null) teiknar engan þráð og er samt á borðinu og í síum. Próf í verki 3 og 5.
4. Spjaldið opið og annar notandi breytir verkinu: spjaldið uppfærist án þess að lokast og án þess að textareitur með hálfskrifaðri athugasemd tæmist. Próf í verki 4 (handpróf með tveimur vöfrum).
5. Lokun með smelli á autt borð má ekki fara af stað þegar smellt er inni í spjaldið eða í toppstikuna. Próf í verki 4.

---

### Task 1: Tokens, viewport-hook og rúmfræði

**Files:**
- Create: `src/vinnubord/vinnubord.css` (tokens: `--hg-board`, `--hg-ink`, `--hg-ink-2`, `--hg-ink-3`, `--hg-line`, `--hg-surface`, `--hg-surface-2`, `--hg-gold`, `--hg-lilac`, `--hg-coral`, `--hg-teal`, `--hg-stone`, `--hg-radius-card`, `--hg-radius-panel`, `--hg-ease`, `--hg-spring`; gildin úr mockup v7), flutt inn í `main.tsx`
- Create: `src/vinnubord/hooks/useViewport.ts`, `src/vinnubord/lib/geometry.ts`, `src/vinnubord/lib/geometry.test.ts`

**Interfaces (Produces):**
- `geometry.ts`: `type View = { x: number; y: number; z: number }`, `zoomAt(view, factor, cx, cy, min = 0.2, max = 2.5): View`, `fitAll(rects: Rect[], viewport: { w; h }, padding: { top; sides; bottom }): View`, `screenToWorld(view, sx, sy): [number, number]`, `wireEndpoints(a: Rect, b: Rect): { x1; y1; x2; y2; dir: 1 | -1 }` (sama regla og mockup: frá þeirri hlið kortsins sem er nær módulnum), `bezierControl(e, z): [c1x, c1y, c2x, c2y]`, `bezierPoint(e, c, t): [x, y]`, `pinchView(view, prev: { cx; cy; d }, next: { cx; cy; d }): View` (zoom um miðju fingranna og pan með miðjunni).
- `useViewport(ref: RefObject<HTMLElement>): { view: View; setView; zoomIn(); zoomOut(); fit(rects); bind: { onPointerDown; onPointerMove; onPointerUp; onPointerCancel; onWheel } }`. Innri reglur: einn pointer á autt borð = pan; tveir pointerar = pinch (`pinchView`); hjól = `zoomAt` um bendilinn. Skilar líka `isPanning`. Dráttur á kort er EKKI hér, hann er í `useCardDrag` (verk 3), sem fær forgang í `onPointerDown` með `e.target.closest('[data-card]')`.

- [ ] **Step 1:** `geometry.test.ts`: `zoomAt` heldur punktinum undir bendlinum föstum (world-hnit sama fyrir og eftir); `zoomAt` klemmir á 0.2 og 2.5; `fitAll` kemur öllum rétthyrningum inn í viewport með padding; `wireEndpoints` velur hægri hlið þegar kortið er vinstra megin við módulinn og vinstri hlið annars; `pinchView` með óbreyttri fjarlægð og hreyfðri miðju er hreint pan; með tvöfaldri fjarlægð er z tvöfalt og miðjan föst.
- [ ] **Step 2:** FAIL, skrifa `geometry.ts`, PASS.
- [ ] **Step 3:** Skrifa `vinnubord.css` og `useViewport.ts`. Build grænt.
- [ ] **Step 4:** Commit `feat(vinnubord): tokens, viewport, geometry`.

### Task 2: Pakkadálkar og módulkort

**Files:**
- Create: `src/vinnubord/components/PackColumn.tsx`, `src/vinnubord/components/ModuleCard.tsx`, `src/vinnubord/lib/layout.ts`, `src/vinnubord/lib/layout.test.ts`

**Interfaces (Produces):**
- `layout.ts`: `packLayout(packages: Package[], modules: Module[]): Array<{ pkg: Package; modules: Module[] }>` (raðað eftir position, módular innan pakka eftir position), `moduleOpenCount(moduleId, items): number` (bara `isOnBoard`), `moduleTone(moduleId, items, viewerId, participants): Tone` (tónn fyrsta verks sem ekki er parked, annars stone).
- `PackColumn({ pkg, modules, items, viewerId, participants, onOpenModule })`: absolute í world á `pkg.pos_x/pos_y`, breidd 300, fyrirsögn, teinn, módular í röð. `data-pack` attribute svo viewport hunsi dráttartilraunir á það (pakkar eru ekki færanlegir í v1).
- `ModuleCard({ module, openCount, tone, hot, ghost, onClick })`: nafn, status_line, "N opið" eða "ekkert opið", litrönd vinstra megin úr tone, `hot` kveikir ramma (notað þegar þráður inn í hann er virkur), `data-module={id}` fyrir þráðaútreikning.

- [ ] **Step 1:** `layout.test.ts`: röðun, `moduleOpenCount` telur ekki done, `moduleTone` sleppir parked.
- [ ] **Step 2:** FAIL, skrifa, PASS. Build grænt.
- [ ] **Step 3:** Commit `feat(vinnubord): pack columns and module cards`.

### Task 3: Verkakort, dráttur með fjöðrun, þræðir með neistum

**Files:**
- Create: `src/vinnubord/components/ItemCard.tsx`, `src/vinnubord/hooks/useCardDrag.ts`, `src/vinnubord/components/Wires.tsx`, `src/vinnubord/lib/spring.ts`, `src/vinnubord/lib/spring.test.ts`, `src/vinnubord/components/Board.tsx`

**Interfaces (Produces):**
- `spring.ts`: `stepSpring(s: { x; y; tx; ty; vx; vy }, k = 0.12, d = 0.72): same` (ein rammaskref, hrein), `settled(s, eps = 0.1): boolean`.
- `useCardDrag({ view, onMove(id, x, y), onDrop(id, x, y), onTap(id) })`: pointer-reglur: mús: niður á `[data-card]` byrjar drátt strax, hreyfing undir 3 px og upp = tap; snerting: langt hald 350 ms byrjar drátt (haptic ef `navigator.vibrate`), annars tap eða pan fer til viewport. `onDrop` kallar `updateItemPosition` (debounce 300 ms í Board). Kort í drætti fær `lift` klasa.
- `ItemCard({ item, tone, label, plans, actionsOpen, unread, parked, pulse, onTap })`: stöðupunktur + label, titill, hver hreyfði síðast (short + updated_at í "í dag 10:15" / "30. október" sniði úr dateUtils), tögg, skjalamerki (fjöldi), framvindustikur úr plans (done = 1, building = 0.5, todo = 0) og "Plan N af M" texti, hringur á horni ef `unread`, `data-card={id}`, `data-module={module_id}`.
- `Wires({ items, view, hotIds })`: fast canvas yfir borðið, DPR-skalað, `requestAnimationFrame` lykkja: les rects korta og módula úr DOM (`querySelector('[data-card="..."]')`), teiknar bezier með glóð (shadowBlur) og kjarnalínu, brotalína fyrir parked, neistar: þrír í einu á `pulse` verkum, einn sjaldan á rólegum, enginn á parked; neistahrina (`burst(id, n)`) við innkomu og þegar kort er sleppt. Línuþykkt skalast með `clamp(view.z, 0.5, 1.4)`. Verk með `module_id` null fær engan þráð.
- `Board({ data, viewerId, filter, selectedId, onSelect(id | null), onOpenModule(id) })`: setur saman world, PackColumn fyrir hvern pakka, ItemCard fyrir hvert `isOnBoard` verk sem `matches(filter)`, dofnar (opacity .1, pointer-events none) þau sem passa ekki, Wires, zoom-takkar (inn, út, sýna allt), smellur á autt borð → `onSelect(null)`. Innkoma: kort fá `in` klasa með 45 ms bili í röð, einu sinni per hleðslu.

- [ ] **Step 1:** `spring.test.ts`: eftir 60 skref frá (0,0) að (100,0) er x innan 0.5 frá 100 og `settled` satt; eitt skref hreyfir í átt að markinu.
- [ ] **Step 2:** FAIL, skrifa `spring.ts`, PASS.
- [ ] **Step 3:** Skrifa ItemCard, useCardDrag, Wires, Board. Tengja í BoardPage (plan 1 stubb) með `useBoardData`. Build grænt.
- [ ] **Step 4:** Handpróf í Chromium með 3 handstofnuðum verkum (SQL): dráttur vistast (endurhleðsla heldur stöðu), tap opnar (kallar onSelect), þráður fylgir drætti, verk án módula er á borðinu án þráðar, zoom með hjóli heldur punkti undir bendli. Handpróf í Playwright `--browser webkit` með snertihermi: langt hald dregur, stutt tap velur, tveir fingur zooma.
- [ ] **Step 5:** Commit `feat(vinnubord): item cards, drag with spring, wires with sparks`.

### Task 4: Spjaldið (verk og módull), botnblað, afritun

**Files:**
- Create: `src/vinnubord/components/PanelShell.tsx`, `src/vinnubord/components/ItemPanel.tsx`, `src/vinnubord/components/ModulePanel.tsx`, `src/vinnubord/components/CopyButton.tsx`, `src/vinnubord/components/Markdown.tsx`, `src/vinnubord/components/panel/{StatusTab,FilesTab,QuestionsTab,HistoryTab,ActionList,PlanList,RulingList,CommentBox}.tsx`, `src/vinnubord/lib/clipboard.ts`, `src/vinnubord/lib/clipboard.test.ts`

**Interfaces (Produces):**
- `clipboard.ts`: `copyText(text): Promise<boolean>` (clipboard API, fallback textarea), hrein `normalizeForCopy(text): string` (CRLF → LF, trailing whitespace burt, engin önnur breyting).
- `PanelShell({ open, onClose, children })`: ≥768 px: fast lag hægra megin, 460 px, rennur inn; <768 px: botnblað með dragræmu, þrjú stopp (lokað, hálft, fullt), dregið með pointer events. Esc lokar. Smellir inni í spjaldinu stöðva ekki uppstreymi í borðið en Board hunsar `onSelect(null)` þegar `e.target.closest('[data-panel]')`.
- `ItemPanel({ data, item, viewerId, onClose })`, flipar: **Staða** (summary efst sem "Hvar erum við", tónn + label, módull, body sem markdown, `PlanList` með stöðu hvers plans og `RulingList` í `<details>` undir hverju plani með "snúa við" hak sem setur `reversed`, `ActionList` með hökum og `payload` í `<pre>` með CopyButton, "Næsta skref" með `next_step` og `next_prompt` í `<pre>` með CopyButton, "Halda áfram" takki sem afritar `buildContinuationPrompt(...)` og sýnir "Afritað" í 1.5 s), **Skjöl** (`FilesTab`: listi með `fileKindLabel`, hver setti inn, repo_path með CopyButton, smellur opnar signed url, md/txt í `Markdown`-lesara í spjaldinu), **Spurningar** (`QuestionsTab`: ósvaraðar efst með svarreit, svaraðar með svari), **Saga** (`HistoryTab`: events + comments saman í tímaröð með avatar short). Neðst `CommentBox`. Við opnun: `markRead(item.id)`.
- `ModulePanel({ data, module, onClose })`: nafn, status_line, opin verk (listi, smellur velur verk), lokin og hætt við verk síðustu 90 daga undir eigin fyrirsögnum, athugasemdir módulsins með CommentBox.
- `Markdown({ source })`: marked + DOMPurify, klasi `.hg-markdown` í vinnubord.css.

- [ ] **Step 1:** `clipboard.test.ts`: `normalizeForCopy` fjarlægir CR og trailing spaces, heldur innri línubilum.
- [ ] **Step 2:** FAIL, skrifa, PASS.
- [ ] **Step 3:** Skrifa spjaldið og flipana. Tengja í BoardPage: `selectedId` → ItemPanel, `openModuleId` → ModulePanel. Build grænt.
- [ ] **Step 4:** Handpróf tveir vafrar (Heimir og Árni): Árni svarar spurningu, spjald Heimis uppfærist án þess að lokast, hálfskrifuð athugasemd helst (CommentBox heldur eigin state, ekki afleitt af data). "Halda áfram" afritar prompt sem byrjar á "Verk:". Botnblað í 390 px breidd: dregst upp og niður, lokast með drætti niður.
- [ ] **Step 5:** Commit `feat(vinnubord): item and module panel, bottom sheet, copy`.

### Task 5: Toppstika, síur, leit, nýtt verk

**Files:**
- Create: `src/vinnubord/components/TopBar.tsx`, `src/vinnubord/components/FilterMenu.tsx`, `src/vinnubord/components/NewItemSheet.tsx`, `src/vinnubord/hooks/useFilter.ts`
- Modify: `src/vinnubord/pages/BoardPage.tsx`

**Interfaces (Produces):**
- `useFilter(): { filter: Filter; toggleTone; togglePackage; toggleTag; setQuery; clear; active: boolean }`, geymt í `sessionStorage` undir `hg.filter.<projectId>`.
- `TopBar({ project, projects, counts, filter, tags, packages, viewer, onNewItem })`: merki + nafn, verkefnaval (fellivalmynd ef fleiri en eitt), teljarapillur úr `countsFor` sem eru stöðusían (tone: new=gold, mine=coral, others=lilac, build=teal, parked=stone), leit (170 px, undir 768 px bara stækkunarglerstakki sem opnar reit), `FilterMenu` fyrir Pakki og Tögg með fjöldatölu í takkanum, "Hreinsa" bara þegar `active`, "Lifandi" punktur, avatarar þátttakenda, "+ Nýtt verk". Undir 768 px: tvær raðir, teljarar í láréttu skrolli.
- `NewItemSheet({ open, onClose, onCreated })`: titill (skylda), texti (markdown), módull (valfrjálst), tögg, skrár (margar, drag and drop og takki), framvinda per skrá, villur úr `validateUpload` á íslensku. Stofnar verk með `createItem`, hleður svo skrám með `uploadFile`. Staða nýs verks er `new`, `created_by` = viewer.

- [ ] **Step 1:** Skrifa, tengja, build grænt.
- [ ] **Step 2:** Handpróf: sía "bíður þín" dofnar rétt verk; leit "efna" skilar Efnaskrá; pakkasía með tveimur pökkum; síur haldast eftir endurhleðslu; nýtt verk með md-skrá og 60 MB skrá: sú stóra hafnast með skilaboðum, verkið samt stofnað með hinni.
- [ ] **Step 3:** Commit `feat(vinnubord): top bar, filters, search, new item`.

### Task 6: Hreyfing og útlitspússun

**Files:**
- Modify: `src/vinnubord/vinnubord.css`, `src/vinnubord/components/{Board,ItemCard,Wires,PanelShell}.tsx`
- Create: `src/vinnubord/components/Aurora.tsx`, `src/vinnubord/components/Toast.tsx`

- [ ] **Step 1:** Aurora: þrír blur-blettir með 38 til 52 s drift, `mix-blend-mode: screen`, opacity .55, slökkt undir `prefers-reduced-motion`.
- [ ] **Step 2:** Innkoma: kort `pop` 0.7 s með spring-bezier, þræðir dragast upp (dash offset) fyrstu 1.1 s, einu sinni.
- [ ] **Step 3:** Toast neðst þegar nýtt verk kemur inn í realtime frá öðrum (`hg_events` kind `item.created` með actor ≠ viewer): "{short} sendi nýtt verk: {titill}", 4 s, smellur opnar verkið. Neistahrina á þráð nýja verksins.
- [ ] **Step 4:** Reduced motion: öll `animation` og `transition` af, canvas teiknar þræði án neista.
- [ ] **Step 5:** Handpróf á 1600x950, iPad 1024x768 landscape og 390x844 sími. Skjáskot í `docs/progress/02-vinnubord-bord.md`.
- [ ] **Step 6:** Commit `feat(vinnubord): motion, aurora, toast`.

### Task 7: Stillingasíða verkefnis

**Files:**
- Create: `src/vinnubord/pages/ProjectSettingsPage.tsx`, `src/vinnubord/components/settings/{PackagesEditor,ModulesEditor,ParticipantsEditor,ProjectFields}.tsx`
- Modify: `src/vinnubord/lib/api.ts` (bæta við `upsertPackage`, `upsertModule`, `deleteModule` (bara ef engin verk), `addParticipantByEmail(projectId, email, short, displayName)` sem kallar RPC `hg_add_participant(p_project, p_email, p_short, p_name)` security definer sem flettir upp í auth.users; `updateProject(patch)`)
- Create: `supabase/migrations/0003_hg_add_participant.sql` (RPC, bara þátttakandi má kalla)

- [ ] **Step 1:** Migration með `apply_migration`. SQL-próf: kall með netfangi sem er ekki til gefur villu "Notandi fannst ekki", kall frá notanda sem er ekki þátttakandi gefur villu.
- [ ] **Step 2:** Síðan: reitir verkefnis (nafn, repo_path, context_bundle sem textarea með "síðast uppfært"), pakkar (nafn, röð, pos_x, pos_y), módular (nafn, slug, pakki, status_line, litur úr fimm tónum, ghost, röð), þátttakendur (listi, bæta við með netfangi, short, nafn, fjarlægja nema sjálfan sig og service).
- [ ] **Step 3:** Handpróf: stofna pakkana fimm og módulana úr spec (Grunnur: Yfirlit, Gátlistar, Kiosk, Hitamælingar, Atvik, Verkferlar, Efnaskrá, Stefnur og þjálfun; Stóreldhús: Viðhald, Áhættumat, Innri úttekt, Öryggisfundir, Merkimiðar, Ábendingar (ghost); Rekstur: Birgðir og pantanir (ghost), Uppskriftir og rýrnun (ghost); Þvert á allt: Spjaldtölvur og símar, Innskráning og öryggi, Hönnunarkerfi, Gagnagrunnur og afköst, Innleiðing, Tölvupóstur, Prófanir og smokes; Sala og samstarf: RV samstarf, Stóreldhúsið 5. og 6. nóv, Landing metta.is, Tilboð og verðskrá, Eigendabakendi) með staðsetningum úr mockup v7 (vinstri hryggur x 1450, Grunnur y 60, Stóreldhús y 880; hægri hryggur x 2900, Þvert y 60, Sala y 800, Rekstur y 1370).
- [ ] **Step 4:** Commit `feat(vinnubord): project settings`.

### Task 8: Frágangur plans 2

- [ ] **Step 1:** `npm run build`, `npm run test`, `npm run smoke:hg` græn.
- [ ] **Step 2:** `docs/progress/02-vinnubord-bord.md`: hvað var smíðað, skjáskot, handpróf sem voru keyrð og niðurstöður, það sem bíður (iPad-próf Árna á alvöru tæki).
- [ ] **Step 3:** Uppfæra `CLAUDE.md` Huginn: leiðir, möppur, tokens-skráin.
- [ ] **Step 4:** Commit `docs(vinnubord): plan 2 progress`.
