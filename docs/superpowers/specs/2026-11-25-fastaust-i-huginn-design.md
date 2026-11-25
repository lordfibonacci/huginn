# Huginn: Fasteignasala Austurlands sem verkefni (hönnunarskjal)

Dagsetning: 2026-11-25
Staða: samþykkt af Heimi 2026-11-25. Skrifað af Claude (Fable) úr samtali við hann sama dag.
Stærð: verkefni í tveimur repoum (Huginn og fastaust). Tvö plön, hvort byggt í Opus lotu í sínu repoi, Huginn fyrst.

## 1. Tilgangur

Heimir vill sjá allar eignir Fasteignasölu Austurlands á einu borði og raða þeim eftir því hvar þær eru staddar í söluferlinu. Hann á sölustjórnunarborð (kanban) í fastaust admin og síðuna Staðan, en notar hvorugt: kanban hentar ekki hugsunarhætti hans, og það var ástæðan fyrir því að Huginn var smíðaður. Frjálsa borðið í Huginn, með kössum sem hann dregur spjöld á milli, er það sem hann vill.

Eignirnar eiga sér þegar eina heimild: eignaloggið, ein markdown mappa á eign í `docs/eignir/` í fastaust, sem Austri (aðstoðarhlutverk Claude í fastaust, póstsveipurinn) heldur við. Hausinn í hverri möppu er spegluð í Stöðuna með `scripts/sync-deals.mjs`. Þetta skjal bætir við öðrum spegli af sama haus: spjaldi í Huginn.

Það sem skiptir Heimi mestu: sveipurinn og eignaloggið mega ekki skemmast.

## 2. Markmið, ekki-markmið, and-markmið

**Markmið**

- Nýtt verkefni í Huginn með slug `fastaust`, á `huginn.pro/p/fastaust`. Þátttakendur: Heimir og Claude þjónustunotandinn. Enginn annar.
- Eitt spjald á hverja opna möppu í eignalogginu (eignir og leiðslur). Spjaldið er skrifað af forriti úr hausnum og uppfært í hvert sinn sem `sync-deals` keyrir.
- Sjö kassar á borðinu sem stig í söluferli. Heimir dregur spjöld á milli í höndunum, eða biður Austra að færa spjald í kassa.
- Eftir sveip sér Heimir á borðinu hvaða eignir hreyfðust og hvað gerðist, án þess að opna neitt.
- Það sem Heimir skrifar í spjallið á spjaldi kemst til Austra í byrjun næsta sveips.

**Ekki-markmið**

- Stig í söluferli verður ekki reitur í eignalogginu. Stigið er aðeins staðsetning spjaldsins á borðinu, og enginn les það til baka. Heimir frestaði þessu 2026-11-25.
- Engin breyting á útliti borðsins, spjaldsins eða spjaldskúffunnar. Orð og flipar úr smíðavinnu (plön, "Halda áfram", "Tilbúið til byggingar") standa óbreytt og tóm á fasteignaspjöldum. Leið B í kafla 3 tekur á því seinna.
- Engin migration, hvorki í Huginn né fastaust. Aðeins gögn: ein verkefnisröð, þátttakendur, tögg, kassar.
- Meginmál möppunnar fer ekki í Huginn, aðeins hausinn.
- Engin tenging við Mettu. Verkefnin deila aðeins innskráningu og verkefnavalinu í efstu stiku.
- Staðan og sölustjórnunarborðið í fastaust admin standa óbreytt.

**And-markmið**

- Ekkert í Huginn má skrifa í möppu í eignalogginu eða í gagnagrunn fastaust. Eina leiðin til baka er að Austri les spjallið og skrifar sjálfur í möppuna.
- Bilun í Huginn (niðri, innskráning útrunnin, CLI vantar) má aldrei stöðva `sync-deals`, breyta útgöngukóða þess eða stöðva sveip.
- Spegillinn má aldrei hreyfa spjald sem er þegar á borðinu. Staðsetning er Heimis.
- TRÚNAÐUR texti og kennitölur mega aldrei fara í Huginn.
- Spegillinn má aldrei snerta neitt í verkefninu metta.

## 3. Leiðir

- **A. Spegill úr eignalogginu, borðið ósnert.** Valin af Heimi. Forrit í fastaust skrifar hausinn á spjald með `huginn` skipanalínutólinu. Huginn fær litla viðbót í tólið (kassar) og eina litla breytingu á upphafssíðunni. Galli: spjaldið talar að hluta smíðamál.
- **B. A, og Huginn lærir hvað fasteign er.** Verkefnið fær tegund, spjaldið eigin línu (bær, verð, næsti frestur) og smíðafliparnir hverfa. Frestað: snertir spjaldið og skúffuna sem Metta notar, og Heimir vill fyrst sjá hvað pirrar hann í A.
- **C. Huginn les gagnagrunn fastaust beint.** Hafnað: tveir gagnagrunnar og tvær innskráningar, og staðsetning, ólesið og spjall virka aðeins á gögn sem Huginn á sjálfur.

## 4. Það sem er til í dag

**Fastaust**

- `docs/eignir/*.md`: 49 möppur (35 `kind: eign`, 14 `kind: leidsla`, 8 með `lokid: true`). Mappan er gitignored og heimildin um stöðu eignar.
- `scripts/deals/dossier.mjs`: `parseDossier(text, { slug, inClosedFolder })` skilar `{ slug, status, confidential, body }`. `status` ber `title`, `kind`, `is_closed`, `property_id`, `town`, `price_mkr`, `commission_pct`, `ball_holder` (`mer`, `julius`, `seljandi`, `kaupandi`, `annad`), `last_contact`, `stada_line`, `next_steps` (strengir), `deadlines` (`{ date, label, holder? }`, holder `mer` eða `julius`), `parties` (`{ name, role?, phone?, email?, note? }`), `offers`, `links` (slug annarra mappa), `timeline` (`{ date, text }`, elst fyrst).
- `scripts/sync-deals.mjs`: les allar möppur, hafnar öllu ef ein stenst ekki, skrifar `deal_status`, `deal_confidential`, `deal_dossiers` og `deal_dossiers_staff`. Hafnar haus sem ber TRÚNAÐUR merkið (`MARKER` í `scripts/deals/stripTrunadur.mjs`).
- `.claude/skills/email-sweep/SKILL.md`: föst skrefaröð sveipsins. Skref 1 les `deal_comments` (athugasemdir Heimis í Stöðunni) og færir þær í möppuna. Skref 4 skrifar möppur og keyrir `sync-deals`.

**Huginn**

- Verkefni eru almenn: `hg_projects`, `hg_participants`, og allt annað ber `project_id`. Efsta stikan er með verkefnaval. Verkefni er stofnað með MCP, ekki í vefnum.
- Kassar (`hg_zones`): nafn, litur (einn af fimm tónum), athugasemd, staðsetning og stærð. Spjald tilheyrir kassa aðeins af því að miðja þess er innan hans.
- `huginn` tólið (`cli/`) skrifar sem Claude þjónustunotandinn. `item create` tekur `--title`, `--body-file`, `--tags`, `--status`, `--waiting-on`. `item set` tekur að auki `--summary` og `--source-ref` en ekki `--title`. Tólið veit ekkert um kassa. `createItem` í `cli/lib/ops.mjs` tekur þegar `sourceRef` og `pos`.
- `hg_items.source_ref` er frjáls textareitur. Vefurinn sýnir hann sem línuna "Heimild" með afritunarhnappi á stöðuflipanum (`StatusTab.tsx`) og setur hann í "Halda áfram" textann (`lib/continuation.ts`). Ekkert annað les hann.
- Stöðumerki á spjaldi: `waiting` með `waiting_on` = áhorfandinn les "Bíður þín" (kórallitur, telst í "hjá þér" pillu), `parked` les "Í bið" (steinlitur).
- `hg-analyse` sleppir verkum sem þjónustunotandinn stofnar, svo spegluð spjöld fá enga skyndigreiningu.
- `/` sendir þátttakanda á fyrsta verkefni hans í stafrófsröð nafns (`listMyMemberships` í `src/vinnubord/lib/api.ts`).

## 5. Verkefnið í Huginn (gögn, engin kóði)

Sett upp einu sinni með Supabase MCP á `czdjxtsjgughimlazdmu`, aðeins `hg_` töflur.

- `hg_projects`: slug `fastaust`, nafn `Fasteignasala Austurlands`, `repo_path` `d:\Claude Code\fastaust`, `context_bundle` tómt.
- `hg_participants`: Heimir (short `H`) og Claude þjónustunotandinn (`6ea33ea7-0072-4e4b-a625-156ebf487399`, short `C`, `is_service = true`). Sömu gildi og í metta.
- Engir pakkar og engir módúlar. Spjöldin eru módúllaus.
- `hg_tags`, upphafslisti: `eign`, `leiðsla`, `hjá seljanda`, `hjá kaupanda`, `hjá júlíusi`, `hjá öðrum`, og einn fyrir hvern bæ sem stendur í `town` í opnum möppum (lágstafir, til dæmis `reyðarfjörður`).
- `hg_zones`, sjö kassar í einni röð frá vinstri til hægri: `Óraðað`, `Leiðsla`, `Í undirbúningi`, `Í sölu`, `Tilboð`, `Kaupsamningur`, `Afsal`. `Óraðað` er steinlitur, hinir fá tón eftir vali byggjanda. Stærð hvers kassa rúmar að minnsta kosti 12 spjöld í tveimur dálkum. Heimir má endurnefna, færa, lita og eyða öllum nema að `Óraðað` þarf að heita það áfram (kafli 8.7).

Eftir uppsetningu opnar byggjandinn `huginn.pro/p/fastaust` og staðfestir að borð án pakka opnist, passi kassana í upphafssýn og að "Nýtt verk" blaðið virki án módúla. Kóðinn bendir til þess (`rows.length > 0` vörnin í `Board.tsx`, `modules.length === 0` í `NewItemSheet.tsx`), en það hefur ekki verið keyrt. Ef eitthvað brotnar er það galli sem fer í Huginn planið.

## 6. Viðbætur í huginn tólið (Huginn repo, `cli/`)

Allt í `cli/`, með prófum við hlið hreinu fallanna og uppfærðu `cli/README.md`.

1. **Kassar í borðgögnum.** `loadBoard` í `cli/lib/client.mjs` sækir `hg_zones` (í `created_at` röð eins og vefurinn), og `pull --json` skilar þeim sem `zones`.
2. **`item create` fær `--summary`, `--source-ref` og `--zone <nafn>`.** `--zone` setur nýja spjaldið á lausan stað inni í kassanum með því nafni (regla 4). Án `--zone` gildir núverandi staðsetningarregla óbreytt.
3. **`item set` fær `--title` og `--zone <nafn>`.** `--zone` færir spjaldið á lausan stað í kassanum. Þetta er leiðin sem Austri notar þegar Heimir biður hann að færa eign. Skrifar aðeins `pos_x` og `pos_y` á `hg_items` (aðalborðið, aldrei staðsetningu í sýn), svo engin stimpill hreyfist og ekkert verður ólesið.
4. **Lausi staðurinn (hreint fall, prófað).** Kassinn er fundinn eftir nafni, óháð há- og lágstöfum. Ekkert nafn passar, eða fleiri en einn kassi ber það: villa á íslensku, ekkert skrifað. Staðir eru prófaðir í röðum frá efra vinstra horni kassans, fyrir neðan nafnið, með sama bili og `placeNewCard` notar. Staður er laus ef spjald af áætlaðri stærð (`estimateCardHeight`) skarast ekki við annað spjald á borðinu. Ef enginn staður er laus innan kassans fer spjaldið í nýja röð neðst og hæð kassans (`hg_zones.h`) er aukin svo spjaldið sé allt innan hans. Breidd breytist aldrei.

5. **Kassar eru hindrun í gömlu staðsetningarreglunni.** `placeItem` án `--zone` telur í dag aðeins pakka og spjöld sem hindranir. Kassar bætast við, svo spjald án kassa lendi aldrei inni í kassa af tilviljun. Í metta breytir þetta aðeins því að nýtt módúllaust spjald forðast kassa.

`--zone` les og skrifar aðeins aðalborðið: staðsetningu kassans á `hg_zones` og spjaldsins á `hg_items`. Vistaðar sýnir (`hg_view_positions`, `hg_view_zone_positions`) eru hvorki lesnar né skrifaðar. Fastaust verkefnið er rekið á aðalborðinu. Ef Heimir býr til sýn þar og raðar í henni sér hann ekki færslur Austra í þeirri sýn, og það er þekktur galli (kafli 13).

Óþekktur rofi er áfram villa. `parity.test.mjs` þarf engar nýjar reglur nema byggjandinn afriti eitthvað úr vefnum.

## 7. Upphafssíðan man síðasta verkefni (Huginn vefur)

Með tveimur verkefnum myndi `/` senda Heimi á "Fasteignasala Austurlands" af því að það er á undan "Metta" í stafrófinu. Breyting: `BoardPage` skrifar slug verkefnisins í `localStorage` (`hg.lastProject`) þegar borð opnast, og `HomePage` sendir á það verkefni ef áhorfandinn er enn þátttakandi í því, annars á það fyrsta eins og í dag. Reglan er hreint fall með prófi. Árni er aðeins í metta og finnur engan mun.

## 8. Spegillinn (fastaust repo)

Nýtt forrit `scripts/sync-huginn.mjs` og hreint hjálparsafn `scripts/deals/huginn.mjs` með prófi við hliðina (`scripts/**/*.test.mjs` keyrir þegar í `npm test`). Forritið les möppurnar með `parseDossier`, sækir borðið einu sinni með `pull --json` og skrifar aðeins muninn. Það geymir ekkert ástand sjálft: Huginn og möppurnar eru eina ástandið, svo keyrsla sem dó í miðju klárast í næstu.

Tólið er kallað sem `node <slóð> <skipun> --project fastaust --json`, ein skipun í einu, aldrei samhliða. Slóðin kemur úr `HUGINN_CLI` í `.env`, sjálfgefið `D:/Claude Code/Huginn/huginn/cli/huginn.mjs`. Innskráningin er `~/.huginn/` sem er þegar til. `--project fastaust` er alltaf gefið berum orðum, svo forritið getur ekki skrifað í metta.

### 8.1 Hvaða möppur

- Opin mappa (ekki `is_closed`): á spjald. Til þess: stofna. Til: bera saman og uppfæra.
- Lokuð mappa með spjald sem er opið: loka spjaldinu (8.6). Lokuð mappa án spjalds: ekkert.
- Mappa sem `parseDossier` hafnar, eða haus sem passar við TRÚNAÐUR merkið: sleppt, ein lína í úttaki. (`sync-deals` hefur þá þegar hafnað keyrslunni, svo þetta er aðeins vörn fyrir beina keyrslu.)

### 8.2 Auðkenni

`source_ref` spjaldsins er slóð möppunnar, `docs/eignir/<slug>.md`. Hún sést sem "Heimild" á stöðuflipanum, svo hún á að vera læsileg. Spjald er fundið á henni einni, aldrei á titli. Tvö spjöld með sama `source_ref`: hvorugt snert, ein lína í úttaki. Spjöld með annað eða ekkert `source_ref` (sem Heimir stofnar sjálfur) snertir forritið aldrei. Hér á eftir er "speglað spjald" spjald með `source_ref` á þessu sniði.

### 8.2b Hver á hvað á spegluðu spjaldi

- **Forritið á:** titil, `summary`, meginmál, stöðu og `waiting_on`, taggahópana þrjá (tegund, bær, bolti) og opin handtök sem byrja á `Frestur `. Ef Heimir breytir einhverju af þessu í vefnum skrifar næsta keyrsla hausinn yfir það. Leiðin til að breyta þessu er að segja Austra það, sem breytir möppunni.
- **Heimir á:** staðsetningu, spjallið, eigin tögg, eigin handtök, spurningar og skjöl. Forritið snertir ekkert af því.
- **Lokun er undantekningin** (8.6): spjald sem Heimir lokar sjálfur helst lokað þar til eitthvað gerist á eigninni.

Læsing: forritið tekur lásskrá (`docs/eignir/.sync-huginn.lock`, með tíma, talin úrelt eftir 10 mínútur) svo tvær lotur í sömu möppu stofni ekki tvö spjöld fyrir sömu eign. Lásinn upptekinn: forritið hættir með einni línu og útgöngukóða 0.

### 8.3 Reitir spjaldsins

Allur texti fer í gegnum kennitölusíuna (8.8) áður en hann er borinn saman eða sendur.

| Reitur í Huginn | Úr hausnum |
|---|---|
| titill | `title`, og ` · <verð>` aftast þegar `price_mkr` er til, með kommu sem tugabrotsmerki (`Lagarás 2, 700 Egilsstaðir · 41,9`) |
| `summary` | `stada_line` í heild |
| meginmál | markdown, kaflar í þessari röð, tómum kafla sleppt: `## Næstu skref` (listi), `## Aðilar` (nafn, hlutverk, sími, netfang, athugasemd), `## Tilboð` (dagsetning, frá, tegund, upphæð, staða, skilmálar), `## Tímalína` (10 nýjustu færslur, nýjasta efst), `## Tengdar eignir` (titlar tengdra mappa) |
| tögg | `eign` eða `leiðsla` eftir `kind`, bærinn úr `town` í lágstöfum, og boltataggið (8.4) |
| staða | 8.4 |

Meginmálið er hrein afleiðing haussins: engin dagsetning keyrslu, ekkert sem breytist milli keyrslna án þess að hausinn breytist. Dagsetningar eru skrifaðar `d.m.yyyy`. Óbreyttur haus skrifar ekkert í Huginn.

Bær sem er ekki á taggalistanum: forritið bætir honum við með `tag add` á undan. Önnur tögg sem Heimir setur sjálfur á speglað spjald haldast: forritið skiptir aðeins út þeim þremur taggahópum sem það á (tegund, bær, bolti).

### 8.4 Staða og bolti

| `ball_holder` | Staða spjalds | Boltatagg |
|---|---|---|
| `mer` | `waiting`, `waiting_on` Heimir ("Bíður þín") | ekkert |
| `seljandi` | `parked` ("Í bið") | `hjá seljanda` |
| `kaupandi` | `parked` | `hjá kaupanda` |
| `julius` | `parked` | `hjá júlíusi` |
| `annad` eða ekkert | `parked` | `hjá öðrum` |

"Í bið" á eign sem er í fullri sölu með boltann hjá kaupanda er ekki rétt orð. Það er þekktur galli A (kafli 13) og fyrsta efni í B.

### 8.5 Frestir verða handtök

Hver færsla í `deadlines` er eitt opið handtak með texta `Frestur <d.m.yyyy>: <label>`. Eigandi: Heimir þegar `holder` er `mer` eða vantar. Þegar `holder` er `julius` er eigandinn Claude notandinn og ` (Júlíus)` stendur aftast í textanum, af því að Júlíus er ekki þátttakandi og handtak þarf eiganda. Þannig telur "N hjá þér" á spjaldinu aðeins fresti Heimis.

Forritið á aðeins opin handtök sem byrja á `Frestur ` á spegluðu spjaldi. Samanburður án ástands:

1. Handtak með nákvæmlega sama texta og eiganda og frestur í hausnum: óbreytt.
2. Af því sem eftir stendur: handtak og frestur með sömu dagsetningu parast (í röð hausins) og handtakinu er breytt með `action set`. Síðan parast þau sem eftir standa með sama `label` og annarri dagsetningu á sama hátt.
3. Handtak sem á engan frest eftir: `action done`. Frestur sem á ekkert handtak: `action add`, nema lokað handtak (gert eða fellt niður) með nákvæmlega sama texta sé til á spjaldinu og annar en þjónustunotandinn hafi lokað því. Þá er ekkert stofnað.

Undantekningin í lið 3 er fyrir Heimi: þegar hann hakar sjálfur við frest í vefnum á fresturinn ekki að spretta upp aftur í næstu keyrslu. Hakið fer til Austra um innhólfið (kafli 9), sem lokar frestinum í möppunni. Handtak sem spegillinn lokaði sjálfur (fresturinn fór úr hausnum, eða mappan lokaðist) útilokar ekki: komi fresturinn aftur í hausinn er hann stofnaður á ný. Handtak sem enginn er skráður fyrir að hafa lokað (`done_by` tómt) telst lokað af Heimi. Reglan er `planActions` í `scripts/deals/huginn.mjs` í fastaust (`closedBodies`, `byService`). Leiðrétt 2026-11-25: liðurinn sagði áður að hvert lokað handtak útilokaði.

Handtök sem Heimir bætir sjálfur við spjald (byrja ekki á `Frestur `) snertir forritið aldrei.

### 8.6 Línan í spjallið og lokun

- Þegar `stada_line` breytist á spjaldi sem var þegar til skrifar forritið eina línu í spjallið (`comment add`): upphaf nýju `stada_line`, klippt við fyrsta setningarlok eftir að minnsta kosti 60 stafi, mest 240 stafir. `stada_line` byrjar samkvæmt reglum eignaloggsins á því nýjasta, svo línan er fréttin. Spjaldið glóir þá hjá Heimi með þessari línu neðst og birtist undir "nýlega breytt". Nýtt spjald fær enga línu (það ber "Nýtt verk").
- Mappa sem lokast: opnum `Frestur ` handtökum er lokað með `action cancel --reason "Máli lokið"`, ein lína fer í spjallið (sama regla), og spjaldinu er lokað með `item close`. Ef `item close` neitar vegna handtaks eða spurningar sem Heimir á sjálfur á spjaldinu lokar forritið ekki og segir frá því í úttaki. Lokað spjald dofnar og hverfur af borðinu eftir þrjá daga, eins og önnur.
- **Lokað spjald og opin mappa, ein regla án ástands:** ef `summary` lokaða spjaldsins er jafnt `stada_line` möppunnar gerir forritið ekkert við spjaldið. Ef þau eru ólík er spjaldið opnað aftur með stöðunni úr 8.4, uppfært og fær línu í spjallið. Þetta nær yfir bæði tilvikin: spjald sem Heimir lokaði sjálfur til að losna við það af borðinu kemur aftur þegar eitthvað gerist á eigninni, og mappa sem var lokuð og opnast aftur fær spjaldið sitt til baka um leið og staðan er skrifuð. Hver lokaði skiptir ekki máli.
- Tólið sækir lokuð verk aðeins í 90 daga (`cli/lib/client.mjs`). Opin mappa sem á lokað spjald eldra en það fær nýtt spjald í `Óraðað`. Það er sætt: eign sem er enn opin í eignalogginu þremur mánuðum eftir að spjaldinu var lokað á að sjást.

### 8.7 Staðsetning

Nýtt spjald er stofnað með `--zone Óraðað`. Ef sá kassi finnst ekki stofnar forritið spjaldið án `--zone` (núverandi regla tólsins) og segir frá því í úttaki. Forritið sendir aldrei `--zone` á spjald sem er til. Lokun, opnun og allar uppfærslur láta staðsetningu í friði.

### 8.8 Kennitölur og trúnaður

- Hausinn ber stundum kennitölu í `parties[].note`. Sía í hjálparsafninu skiptir hverri kennitölu út fyrir `[kt]` í öllum texta sem fer til Huginn: sex tölustafir, valfrjálst bandstrik eða bil, fjórir tölustafir, þar sem fyrstu sex eru gild dagsetning (`ddmmyy`, dagur 01 til 31 eða 41 til 71 fyrir fyrirtæki, mánuður 01 til 12). Símanúmer (sjö tölustafir) og HomeEd númer (sex eða sjö tölustafir) passa ekki. Prófin bera dæmi um hvort tveggja.
- Haus sem passar við `MARKER` er aldrei sendur (8.1).
- Nöfn, símar og netföng aðila fara yfir. Þau eru það sem Heimir þarf á spjaldinu, og verkefnið er aðeins hans.

### 8.9 Hvenær spegillinn keyrir og hvernig hann bilar

- `sync-deals.mjs` ræsir `sync-huginn.mjs` sem sérstakt Node ferli síðast í hverri keyrslu sem er ekki `--check`, líka þegar `sync-deals` hafði ekkert að skrifa. Þannig nær spegillinn öllum sem skrifa möppur (sveipurinn, `ny-eign`, `hressa-eignir`, handvirk keyrsla) án þess að neinn þurfi að muna hann. `sync-deals` sem hafnar möppu hættir áður en að þessu kemur, eins og í dag.
- Slug sem `sync-deals` fékk sem rök fara áfram, svo takmörkuð keyrsla speglar aðeins þær möppur.
- `--no-huginn` á `sync-deals` sleppir speglinum. `node scripts/sync-huginn.mjs --check` sýnir hvað yrði skrifað án þess að skrifa.
- Útgöngukóði `sync-deals` ræðst aldrei af speglinum. Ef spegillinn bilar prentar `sync-deals` eina línu, `Huginn: spegillinn kláraðist ekki: <ástæða>`, og endar eins og hann hefði endað án hans.
- Hver skipun til tólsins hefur 30 sekúndna tímamörk og öll keyrslan 4 mínútur. Fari hún yfir hættir forritið með línu um hve mörg spjöld eru eftir. Næsta keyrsla tekur þau.
- Ein biluð eign stöðvar ekki hinar: villa á einu spjaldi er skráð og forritið heldur áfram. Úttakið endar á einni samantektarlínu: `Huginn: N stofnuð, N uppfærð, N lokað, N óbreytt, N villur`.
- Spegillinn skrifar aldrei í `docs/eignir/` nema lásskrána, og aldrei í gagnagrunn fastaust.

## 9. Leiðin til baka: spjall Heimis

`node scripts/sync-huginn.mjs --inbox --since <ISO>` prentar hver skilaboð í spjalli spegluðu spjaldanna sem þjónustunotandinn skrifaði ekki og eru nýrri en tíminn: slug, tími, texti. Það les `pull --json` (allt borðið) og síar sjálft á `created_at` skilaboðanna, því skilaboð hreyfa ekki stimpil verksins. Það skrifar ekkert.

Austri fer með þau eins og `deal_comments`: í meginmál möppunnar sem `Heimir skrifaði í Huginn <d.m.yyyy>: <texti>`, og þau teljast samskipti. Ef svar á við svarar Austri í spjallinu með `huginn comment add`.

Sama skipun prentar líka hvert `Frestur ` handtak á spegluðu spjaldi sem annar en þjónustunotandinn lokaði eftir tímann (gert eða fellt niður, með ástæðu ef hún er til): slug, tími, texti handtaksins. Austri fer með það eins og `Lokið:` færslu frá Júlíusi í dag: fresturinn flyst úr hausnum niður í meginmálið sem lokinn.

Skilaboð á spjaldi sem Heimir stofnaði sjálfur (ekki speglað) koma líka fram, merkt titli spjaldsins í stað slug, svo ekkert sem hann skrifar í verkefninu týnist.

## 10. Hvað breytist í sveipnum

Aðeins tvennt í `.claude/skills/email-sweep/SKILL.md`, bæði viðbætur:

- **Skref 1 fær lið 4:** keyra `node scripts/sync-huginn.mjs --inbox --since <marker>` og fara með úttakið eins og lýst er í kafla 9. Ef skipunin bilar: ein lína í skýrslunni, sveipurinn heldur áfram.
- **Skref 6 (skýrslan) fær eina línu:** samantektarlína spegilsins úr úttaki `sync-deals`, eða að hann hafi ekki klárast.

Skref 4 breytist ekki í orðalagi: `sync-deals` keyrir spegilinn sjálfur. Markerinn í skrefi 7 er óbreyttur og ber ekkert um Huginn.

Ný regla í skill-inu, ein málsgrein: þegar Heimir biður Austra að færa eign í kassa er það `huginn item set <id> --zone "<kassi>" --project fastaust`, og ekkert er skrifað í möppuna um það.

Fastaust `CLAUDE.md` fær stutta málsgrein undir "Email sweeps" um spegilinn og and-markmiðin í kafla 2.

## 11. Fyrsta fylling

Einu sinni, í byggingarlotunni í fastaust, eftir að verkefnið og kassarnir eru til:

1. Lotan les opnu möppurnar og leggur fyrir Heimi töflu: eign, tillaga að kassa, ein lína um ástæðu úr `stada_line`. Heimir leiðréttir.
2. Spegillinn keyrir og stofnar öll spjöldin í `Óraðað`.
3. Lotan færir hvert spjald í sinn kassa eftir samþykktu töflunni með `item set --zone`.
4. Heimir opnar borðið, merkir allt lesið og raðar að vild.

Taflan er einnota. Eftir þetta fer hver ný eign í `Óraðað` og bíður Heimis.

## 12. Aðgangur og persónugögn

- Gagnagrunnur Huginn er deildur með öðrum smáverkefnum Heimis, en RLS á `hg_` töflum fer eftir þátttöku í verkefninu. Árni er ekki þátttakandi í fastaust og sér ekkert þar.
- Claude þjónustunotandinn er sá sami og í metta. Lota í metta2_new gæti tæknilega lesið fastaust með `--project fastaust`. Engin regla þar vísar á það og `.huginn-project` þar segir `slug=metta`. Heimir tekur þessu.
- Það sem bætist við í Huginn af persónugögnum: nöfn, símar og netföng aðila, tilboðsupphæðir og atburðalínur úr hausnum. Kennitölur og TRÚNAÐUR fara ekki.
- Ef Júlíus eða annar fær aðgang að verkefninu seinna þarf að endurskoða hvað fer yfir (leiðslur og tilboð eru í dag aðeins fyrir Heimi). Það er ný ákvörðun, ekki hluti af þessu.

## 13. Þekktir gallar sem fylgja A

- "Í bið" á eign þar sem boltinn er hjá öðrum, og smíðaorð í skúffunni. Efni í B.
- Frestir eru texti. Borðið veit ekki hvaða frestur er liðinn og raðar ekki eftir dagsetningu.
- Boltataggið sést ekki á spjaldinu sjálfu (spjöld sýna ekki tögg), aðeins í skúffunni og í taggasíunni.
- Verk sem Heimir stofnar sjálfur í fastaust verkefninu fær skyndigreiningu `hg-analyse`, sem er skrifuð fyrir hugbúnaðarverk. Hún kostar um 0,15 USD og skrifar smíðakafla á spjaldið. Lagað með B eða sér, ekki hér.
- Orðalagsbreyting á fresti sem breytir bæði dagsetningu og texta í einu birtist sem einn lokinn frestur og annar nýr.
- Vistaðar sýnir í fastaust verkefninu: `--zone` vinnur aðeins á aðalborðinu, svo færslur Austra og ný spjöld sjást ekki rétt í sýn sem Heimir hefur raðað sjálfur.
- Það sem Heimir breytir í vefnum á reitum sem forritið á (staða, titill, texti) lifir aðeins til næstu keyrslu.
- Stigið á borðinu og raunveruleg staða geta rekið í sundur, því enginn færir spjald sjálfkrafa. Það er valið.

## 14. Það sem byggjandinn ræður

- Nákvæm stærð, staðsetning og tónar kassanna sex (aðrir en `Óraðað`).
- Snið meginmálsins innan kaflanna í 8.3 (listi eða tafla), svo lengi sem það er hrein afleiðing haussins.
- Skipting kóða milli `sync-huginn.mjs` og `scripts/deals/huginn.mjs`, og nöfn falla.
- Nöfn lykla og falla í Huginn fyrir kafla 6 og 7.

## 15. Stærð og röð

| Hluti | Repo | Skrár (um það bil) | Stærð |
|---|---|---|---|
| Tólið: kassar í `loadBoard` og `pull --json` | Huginn | `cli/lib/client.mjs`, próf | S |
| Tólið: `--zone`, `--summary`, `--source-ref`, `--title` og lausi staðurinn | Huginn | `cli/lib/commands.mjs`, `ops.mjs`, `write.mjs`, próf, `cli/README.md` | M |
| Upphafssíðan man síðasta verkefni | Huginn | `HomePage.tsx`, `BoardPage.tsx`, eitt hreint fall með prófi | S |
| Verkefnið, þátttakendur, tögg og kassar (gögn) og borð án pakka staðfest í vafra | Huginn | engar | S |
| Hjálparsafnið: reitir, staða, tögg, frestasamanburður, kennitölusía, spjalllína | fastaust | `scripts/deals/huginn.mjs`, próf | M |
| Forritið: lestur, munur, skrif, lás, tímamörk, `--check`, `--inbox` | fastaust | `scripts/sync-huginn.mjs` | M |
| `sync-deals` ræsir spegilinn, `--no-huginn` | fastaust | `scripts/sync-deals.mjs` | S |
| Sveipurinn og `CLAUDE.md` | fastaust | `email-sweep/SKILL.md`, `CLAUDE.md` | S |
| Fyrsta fylling með töflu Heimis | fastaust | engar | S |

Röð: Huginn planið fyrst (tólið, upphafssíðan, gögnin), síðan fastaust planið. Hönnunarskjalið býr í Huginn repoinu. Fastaust planið fer í `docs/superpowers/plans/` í fastaust, sem er gitignored þar og aðeins á diski.

## 16. Hvernig við vitum að þetta virkar

- `npm run test` og `npm run build` græn í Huginn, `npm test` grænt í fastaust.
- `node scripts/sync-deals.mjs --check` í fastaust gefur sama úttak fyrir og eftir breytinguna.
- Með rangri `HUGINN_CLI` slóð: `sync-deals` skrifar sínar töflur, prentar línuna um spegilinn og endar með sama útgöngukóða og áður.
- Tvær keyrslur í röð án breytinga: seinni segir öll spjöld óbreytt og ekkert verður ólesið hjá Heimi.
- Breytt `stada_line` í einni möppu: eitt spjald glóir með nýju línunni, hin ekki.
- Kennitala í `parties[].note` kemur fram sem `[kt]` í skúffunni.
- Spjald sem Heimir færði stendur kyrrt eftir næstu keyrslu.
- `huginn pull --project metta --json` sýnir engin ný verk eftir fyrstu fyllingu.

Heimir athugar sjálfur: `huginn.pro` opnar það verkefni sem hann var síðast í, verkefnavalið skiptir á milli, drag milli kassa, og að skilaboð sem hann skrifar í spjall á eign birtist í næstu sveipskýrslu.
