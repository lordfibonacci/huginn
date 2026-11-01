# 05 Vinnuborð: staða úr gögnum (plan 5)

Dagsetning: 2026-11-01
Grein: `main` (commits 72f241b til 4e1bb53 í Huginn, ekki ýtt þegar þessi texti var skrifaður). metta2_new hliðin: `e04894f5` til `273a77eb`, ýtt.
Plan: `docs/superpowers/plans/2026-11-01-stada-ur-gognum.md`
Spekk: `docs/superpowers/specs/2026-11-01-stada-ur-gognum-design.md`

Staða: kóðinn er búinn og yfirfarinn task fyrir task. Staðan á verki kemur nú úr gögnum: plan sem fer í byggingu eða er lokið færir verkið, spjaldið sýnir "N hjá þér", Stöðuflipinn sýnir handtök fyrst og `/huginn` skillið skrifar á þremur föstum stundum.

## Hvað var gert

**Task 1, migration 0008.** `0008_hg_plan_moves_item` var beitt gegnum MCP 2026-11-01. Plan sem fer í `building` færir verkið í `building` og plan sem lýkur færir það eftir reglunum í spekkinu (opið handtak fer til eiganda, annars `ready` eða `done`). Verk sem bíður hjá öðrum er látið í friði á meðan annað plan er í byggingu. `npm run smoke:hg` skilaði `ok 7/7`. Atriði 7 var styrkt í tveimur lagfæringarhringjum: skref d athugar að biðandi verk sé látið í friði, skref i athugar að plan uppfærsla án breytingar skrifar engan atburð og heldur `updated_at`, og skref e sannar nú handtaksgreinina. Commits 9045bc7, 9ad94ef, 83445d3.

**Task 2, hrein föll.** `mineActionsByItem` og `fileCountsByItem` í `src/vinnubord/lib/`, og merkið "Bíður ákvörðunar" fyrir verk sem bíður hjá engum. `waitsFor` og `mineActionsByItem` deila einni skilgreiningu, `isOpenMine`. Commit 7038aaa.

**Task 3, spjaldið.** Kubbur "N hjá þér" í coral á spjaldinu, og skráafjöldinn telur plön með slóð. Vafraskoðun var gerð sem Claude þjónustunotandinn eingöngu. Commit c141e16.

**Task 4, Stöðuflipinn.** Handtök fyrst, afgreidd handtök brotin saman undir "Afgreitt (n)". Engin vafraskoðun (innskráning úr vafra var stoppuð af heimildakerfinu). Commit d4772af.

**Task 5, Skjalaflipinn.** Plön með slóð birtast í listanum (merki "Plan", nafn, slóð, afrita). Engin vafraskoðun. Commit 4e1bb53.

**Task 6, `/huginn` skillið í metta2_new.** Prompt snið, "Texti sem úreldist ekki", "Að haka við" og ný röð í Lotulokum. Tveir úrskurðir stjórnanda: lýsingarskilyrðið er eigin setning, og Lotulok 5 segir hver á næsta leik þegar ekkert plan færðist. Commits 15aeb81f og 273a77eb í metta2_new, ýtt.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 27 skrár, 428 próf græn.
- `npm run smoke:hg`: `ok 7/7` (keyrt í task 1, lifandi gagnagrunnur).
- Yfirferð eftir hvern task; task 1 þurfti tvo lagfæringarhringi, task 6 einn. Lokayfirferð allrar greinarinnar á Fable er eftir og gerist áður en ýtt er.

## Hvað bíður

### Hjá Heimi

1. **Lifandi keyrsla.** Ein byggingarlota með nýja prompt sniðinu á næsta plani í metta2_new. Staðfestu að verkið fór í `building` í upphafi og beið eftir honum, eða lokaðist, í lokin án þess að hann segði lotulok.
2. **Sjónskoðun á huginn.pro** í símabreidd og á skjáborði, innskráður sem Heimir:
   - Spjald þar sem hann á opin handtök sýnir "N hjá þér" í coral.
   - Stöðuflipinn: röðin rétt og brotna línan "Afgreitt (n)" opnast við snertingu.
   - Skjalaflipi Sýningarskráningar: Plan línan fyrst, afrita virkar og talan á flipanum passar við spjaldið.

### Síðar

- Kapphlaup: tvö plön sem klárast samtímis í sitthvorri færslu geta bæði tekið reglu 2 og skilið verkið eftir í `building`. Lausn: `select for update` á `hg_items`.
- Plan nafnið í Skjalaflipanum er ekki feitletrað eins og skráarnöfn.
- Kubburinn "N hjá þér" felur önnur opin handtök þegar áhorfandinn á sum (eins og spekkinn segir).
- Prompt sniðið raðar handtökum á undan skjölum en Lotulok raða skjölum fyrst.
