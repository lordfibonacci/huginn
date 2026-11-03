# 11 Vinnuborð: skjal uppfært (plan 11)

Dagsetning: 2026-11-03
Grein: `vinnubord-11` (commits b65f339 til 5f997bc ofan á main 7b75aa0, auk þessa skjals, speglunarstimpilsins, CLI README og CLAUDE.md; bilið er 7b75aa0 til skjalacommitsins)
Plan: `docs/superpowers/plans/2026-11-03-skjal-uppfaert.md`
Spekk: `docs/superpowers/specs/2026-11-03-skjal-uppfaert-design.md`

Staða: lokið, bíður lokayfirferðar allrar greinarinnar og prófunar Heimis. Migration 0014 er keyrð. Enginn commit er ýttur.

## Hvað var gert

**Task 1, migration 0014** (b65f339). `hg_files` fær `updated_at` og `updated_by`, einkvæman vísi `hg_files_item_repo_path_key` á `(item_id, repo_path)` þar sem slóðin er til, og `hg_files_log_event_trg` keyrir nú eftir insert eða update (`file.updated`). `hg_files_analyse_trg` er áfram aðeins eftir insert. `hg_unread` telur `file.updated` með `file.added` og `distinct coalesce(data->>'file_id', id)`, svo skjal sem er bætt við og síðan uppfært telst einu sinni. Keyrð með MCP 2026-11-03 og staðfest (dálkar, vísir, trigger).

**Task 2, CLI skipti og smoke 11** (8347da4, 5f997bc). `putFile` í `cli/lib/ops.mjs`: leit eftir verki og stöðluðri slóð (`normalizeRepoPath`), bætasamanburður þegar stærðin stenst (villa við niðurhal telst ólíkt), nýr hlutur í Storage, röðin uppfærð með `.eq('storage_path', gamla)` (samtímis skipti sem tapar gefur "Gat ekki uppfært"), gamli hluturinn fjarlægður (misheppnuð fjarlæging varar aðeins við). Gamli hluturinn er sóttur eða fjarlægður aðeins ef `storagePathOk` samþykkir slóðina. `file add` JSON: `{ ok, id, outcome, replaced, unchanged }`. Tóm `--repo-path` er hafnað fyrir innskráningu. Kapphlaup á insert gefur "Skjalið er þegar til, keyrðu skipunina aftur". Smoke atriði 11. Lagfæringarlota eftir yfirferð (5f997bc).

**Task 3, vefur, lib** (d493eae). `lib/files.ts` með `fileStamp` og `sortFiles`, `file.updated` í sögu (`fileUpdated`, "uppfærði {name}") og í ólesnu (`KIND_OF` varpar í `file`).

**Task 4, Skjöl flipinn** (7850125). Ein röð á hverja slóð, raðað eftir stimpli, "Uppfært: {nafn}, {hvenær}" við skjal sem var skipt út, og nýtt-merkið les stimpilinn og `updated_by`. Realtime hlustar þegar á `*` á `hg_files`, engin breyting.

**Task 5, speglun, skjöl** (þetta skjal). `fileLine` í `cli/lib/mirror.mjs` bætir `(uppfært <ISO>)` við línu skjals sem á `updated_at`, óháð tegund; óbreytt skjal er eins og áður. Próf í `mirror.test.mjs`. `cli/README.md` (`file add` línan og Skrár liðurinn) og CLAUDE.md (Plan 11, `hg_files`, 0014, nýr liður í Key Patterns, `files` í lib listanum).

**Hreinsun.** Heimir keyrði tvítekningahreinsunina í SQL editor 2026-11-03. Fyrir: 26 raðir í 15 skjölum. Eftir: 0 tvítekningahópar og 57 raðir með repo slóð.

## Staðfesting

- `npm run build`: grænt.
- `npm run test`: 33 skrár, 521 próf græn (518 fyrir task 5, 1 nýtt speglunarpróf, 2 ný röðunarpróf í lokayfirferðarlagfæringu).
- `npm run smoke:hg`: `ok 11/11` á móti lifandi gagnagrunni. Smoke skildi engar Storage hluti eftir.
- Hand próf úr skelinni (skref 9) var ekki keyrt: ekkert plan 11 verk er á metta borðinu.
- Skoðun í vafra á skjali sem var skipt út (Skjöl og Saga) var ekki gerð: ekkert slíkt skjal var til meðan á smíðinni stóð.

## Það sem Heimir prófar

- Opna verk sem Claude skrifaði skjal á tvisvar með sömu `--repo-path`: ein röð í Skjöl með "Uppfært: Claude", "uppfærði" í Saga.
- Spjaldið segir "+1 skjal", ekki "+N skjöl", eftir nokkur skipti. Eigin atburðir telja aldrei, svo aðeins Heimir eða Árni sjá þetta.
- Tölurnar úr hreinsuninni eins og hann sá þær: 26 raðir í 15 skjölum fyrir, 0 tvítekningahópar og 57 raðir með slóð eftir.
- `huginn sync` og `item.md`: skjal sem var skipt út ber `(uppfært ...)`.

## Opið

- Munaðarlausir Storage hlutir eftir hreinsunina (hlutir raðanna 26 sem var eytt í `hg-files`). Má fjarlægja í Storage í mælaborðinu þegar hentar, ekkert les þá.
- `normalizeRepoPath` heldur upphafs `/` og `./` inni í slóð sem ólíkum lyklum.
- Smoke getur ekki prófað `hg_unread` fyrir annan þátttakanda.
- Eldra `file.added` án `file_id` auk uppfærslu meðan ólesið getur sýnt 2 þar til næsta lesmerking.
