# Huginn vinnuborð, plan 3 af 4: Claude Code hliðin (skipanalínutól, skill, spegill, lotulok, fyrsta fylling)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code í metta2 (og seinna hjá Árna) les og skrifar Huginn beint: `huginn` skipanalínutól í Huginn-repoinu, `/huginn` skill í metta2, spegill í `docs/huginn/`, sjálfvirk `STATUS.md`, lotustart-áminning, og fyrsta fylling með 46 opnu verkunum frá 2026-10-31.

**Architecture:** Tólið er eitt Node ESM script (`cli/huginn.mjs`) með undirskipunum, notar supabase-js með eigin innskráningu (netfang og lykilorð í `~/.huginn/credentials.json`, aldrei í repo), RLS ræður. Það skrifar JSON á stdout (`--json`) fyrir Claude og læsilegt markdown annars. Skillið í metta2 er leiðbeiningaskjal sem segir Claude hvenær og hvernig á að kalla tólið, með föstum lotulokalista. Spegillinn er hrein föll (prófuð) sem ákveða hvað fer í repoið og hvað fær bendiskrá.

**Tech Stack:** Node 20+, @supabase/supabase-js (þegar í Huginn-repo), engin önnur dependency (arg-parsing handskrifað), vitest fyrir hrein föll.

**Spec:** `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (kaflar 5, 5b, 5c, 7.2, 7.4, 7.5, 9b, 10).

## Global Constraints

- Sömu og plan 1 og 2. Tólið býr í Huginn-repoinu undir `cli/`, uppsett í metta2 með `npm link` eða beinni slóð í skillinu (slóðin `D:\Claude Code\Huginn\huginn\cli\huginn.mjs` skráð í skillinu, má breyta).
- Innskráning: `~/.huginn/credentials.json` = `{ "url", "anonKey", "email", "password" }`. Í Claude Code hjá Heimi er þetta service-notandinn Claude. Hjá Árna hans eigið. Tólið skrifar `actor_via: 'claude-code'` í `hg_events.data` þegar það skrifar, svo tímalína sýni "(Claude Code)".
- Spegill: textaskrár og skrár undir 10 MB fara í `docs/huginn/<slug>/`; stærri fá `<nafn>.pointer.json` (name, size, mime, storage_path, sha256). Aldrei mp4, mov, zip yfir 10 MB í git.
- Vöruefni (kennsluklippur, sýningarskjár-HTML) er EKKI speglað af tólinu; Claude Code sækir það með `huginn file get` og setur á réttan stað sjálft.
- metta2-hliðin (skill, hook, CLAUDE.md lína) er í `metta2_new`, pushað á main eftir reglum þess repos.
- Engin þankastrik í neinu úttaki tólsins.

## Review Focus

1. Tólið keyrt utan verkefnis-repos (engin `.huginn-project` skrá og ekkert `--project`): skýr villa "Ekkert verkefni fundið, keyrðu í repoi með .huginn-project eða gefðu --project", ekki stacktrace. Próf í verki 1.
2. `pull` með verki sem hefur skrá sem er þegar til í `docs/huginn/<slug>/` með sama sha256: ekki skrifað aftur, ekki "breytt" í git. Próf í verki 3.
3. `item set --status done` á verki með ósvöruðu handtaki eða ósvaraðri spurningu: neitar nema `--force`. Próf í verki 2.
4. `STATUS.md` er deterministic: sama gögn, sama úttak byte fyrir byte, svo git diff sýni bara raunbreytingar. Próf í verki 3.
5. Lykilorð birtist aldrei í úttaki, villum eða `--json`. Próf í verki 1 (grep á úttaki).

---

### Task 1: Tólið, innskráning, verkefnaval, `pull`

**Files:**
- Create: `cli/huginn.mjs` (inngangur, arg-parsing, skipanatafla), `cli/lib/client.mjs`, `cli/lib/config.mjs`, `cli/lib/format.mjs`, `cli/lib/config.test.mjs` (vitest, include `cli/**/*.test.mjs` bætt í vitest.config.ts)
- Create: `cli/README.md` (uppsetning, credentials, skipanir)
- Modify: `package.json` (`"bin": { "huginn": "cli/huginn.mjs" }`)

**Interfaces (Produces):**
- `config.mjs`: `loadCredentials(): { url; anonKey; email; password }` (les `~/.huginn/credentials.json`, villa á íslensku ef vantar), `resolveProject(cwd, argv): { slug: string } ` (röð: `--project`, svo `.huginn-project` skrá í cwd eða foreldrum með `slug=`, annars villa), `redact(obj)` (fjarlægir `password`).
- `client.mjs`: `getClient(): Promise<SupabaseClient>` (signInWithPassword, cache session í `~/.huginn/session.json`), `getProject(client, slug): Promise<Project>`, `getMe(client, projectId): Promise<Participant>`.
- `format.mjs`: `itemLine(item, participants): string` ("[tone] titill, staða, hver, hvenær"), `statusMarkdown(data: BoardData, participants): string` (fyrirsagnir: "Bíður Claude", "Bíður Heimis", "Bíður Árna", "Tilbúið til byggingar", "Í byggingu", "Í bið", hvert verk ein lína með handtökum og ósvöruðum spurningum sem undirlínur, raðað eftir updated_at desc innan hóps, ISO-dagsetningar, engin tímabil eins og "í dag" svo úttakið sé deterministic).
- Skipanir í þessu verki: `huginn login` (prófar credentials), `huginn pull [--json] [--since ISO]` (sækir BoardData og prentar statusMarkdown eða JSON), `huginn whoami`.

- [ ] **Step 1:** `config.test.mjs`: `resolveProject` finnur `.huginn-project` í foreldramöppu (tmp dir); án hennar og án `--project` kastar villu með textanum "Ekkert verkefni fundið"; `redact` fjarlægir password. `format.test.mjs`: `statusMarkdown` gefur sama streng tvisvar fyrir sömu gögn og flokkar rétt eftir waiting_on.
- [ ] **Step 2:** FAIL, skrifa, PASS.
- [ ] **Step 3:** Skrifa `huginn.mjs`, `client.mjs`. Handpróf: `node cli/huginn.mjs login` með credentials Claude-notandans (Heimir býr til skrána), `node cli/huginn.mjs pull --project metta` prentar tómt borð rétt. `node cli/huginn.mjs pull --project metta --json | grep -c password` = 0.
- [ ] **Step 4:** Commit `feat(cli): huginn tool, login, pull`.

### Task 2: Skrifskipanir

**Files:**
- Create: `cli/lib/write.mjs`, `cli/lib/write.test.mjs`
- Modify: `cli/huginn.mjs`

**Interfaces (Produces):** allar skipanir taka `--project` eða `.huginn-project`, skila `{ ok, id }` í `--json`.
- `huginn item create --title T [--body-file f.md] [--module slug] [--tags a,b] [--file path ...] [--status new|waiting|ready|building|parked] [--waiting-on short]`
- `huginn item set <id> [--status ..] [--waiting-on short|none] [--summary "..."] [--body-file f.md] [--module slug|none] [--tags a,b] [--next-step "..."] [--next-prompt-file f.txt] [--source-ref "..."] [--force]`
- `huginn item close <id> [--dropped] [--force]`
- `huginn question ask <item> --to short --body "..."` / `huginn question answer <qid> --body "..."`
- `huginn action add <item> --owner short --body "..." [--payload-file f.sql]` / `huginn action done <aid>`
- `huginn plan add <item> --name "Plan A" [--path docs/...] [--status todo]` / `huginn plan set <pid> --status building|done`
- `huginn ruling add <plan> --code R1 --body "..." [--cost "..."]`
- `huginn file add <item> <path> [--repo-path docs/...]` (hleður í `hg-files`, validateUpload-reglur sömu og vefurinn, 50 MB þak)
- `huginn file get <fileid> --out <path>` (signed url, sækir)
- `huginn comment add <item> --body "..."`
- `huginn bundle push --file bundle.md` (setur `context_bundle` + `context_bundle_at` á verkefnið)
- `write.mjs`: hrein föll `guardClose(item, questions, actions, force): { ok: true } | { ok: false; reason }` (Review Focus 3), `resolveShort(participants, short): userId | null`, `parseTags(s): string[]`.

- [ ] **Step 1:** `write.test.mjs`: `guardClose` neitar með ósvaraðri spurningu og leyfir með `force`; `resolveShort('Á')` finnur Árna, `resolveShort('none')` gefur null; `parseTags('a, b,,c')` = ['a','b','c'].
- [ ] **Step 2:** FAIL, skrifa, PASS.
- [ ] **Step 3:** Skipanirnar. Handpróf gegn `metta`: stofna verk með md-skrá, spyrja, svara, handtak, plan, ruling, loka með `--force`, allt sést í vefnum í rauntíma. Eyða prófverkinu með SQL á eftir.
- [ ] **Step 4:** Commit `feat(cli): write commands`.

### Task 3: Spegill og STATUS.md

**Files:**
- Create: `cli/lib/mirror.mjs`, `cli/lib/mirror.test.mjs`
- Modify: `cli/huginn.mjs` (`huginn sync [--out docs/huginn] [--dry-run]`)

**Interfaces (Produces):**
- `mirror.mjs`: `itemSlug(item): string` (lágstafir, íslenskir stafir varpaðir: á→a, ð→d, é→e, í→i, ó→o, ú→u, ý→y, þ→th, æ→ae, ö→o, annað → `-`, hámark 60 stafir, `-<fyrstu 6 stafir id>` í lokin svo það sé einkvæmt), `planMirror(data, existing: Map<string, sha256>): Array<{ path; action: 'write' | 'skip' | 'pointer'; source: FileRow | 'item.md' | 'questions.md' | 'rulings.md' }>` (undir 10 MB og textalíkt → write ef sha breytt, annars skip; stærra → pointer), `renderItemMd(item, plans, actions, questions, rulings, participants): string` (deterministic, ISO-dags).
- `huginn sync`: fyrir hvert `isOnBoard` verk + lokuð síðustu 30 daga: `docs/huginn/<slug>/item.md`, skrár úr Storage eða pointer, og `docs/huginn/STATUS.md` = `statusMarkdown`. Skrifar bara það sem breyttist. Prentar lista: written, skipped, pointers.

- [ ] **Step 1:** `mirror.test.mjs`: `itemSlug('Efnaskrá A og B: endurhönnun')` byrjar á `efnaskra-a-og-b-endurhonnun-`; `planMirror` skilar `skip` fyrir skrá með sömu sha og `pointer` fyrir 12 MB mp4; `renderItemMd` sama úttak tvisvar.
- [ ] **Step 2:** FAIL, skrifa, PASS.
- [ ] **Step 3:** `sync` skipunin. Handpróf í metta2_new: `node .../huginn.mjs sync` skrifar `docs/huginn/`, annað kall skrifar ekkert (git status óbreytt).
- [ ] **Step 4:** Commit `feat(cli): mirror to repo and STATUS.md`.

### Task 4: Skill, lotustart og lotulok í metta2_new

**Files (í `D:\Claude Code\metta2\metta2_new`):**
- Create: `.claude/skills/huginn/SKILL.md`, `.huginn-project` (innihald `slug=metta`), `docs/huginn/.gitkeep`
- Modify: `.claude/settings.json` (SessionStart hook sem keyrir `node "D:/Claude Code/Huginn/huginn/cli/huginn.mjs" pull --brief` og prentar eina línu "Huginn: N bíða Claude, M bíða Heimis, K bíða Árna"; hookið má ekki fella lotuna ef tólið vantar, `|| true`), `CLAUDE.md` (Pending-kaflinn skipt út fyrir: "Opin verk búa í Huginn (huginn.pro, verkefni metta). `docs/huginn/STATUS.md` er sjálfvirkt afrit. Keyrðu `/huginn` í upphafi lotu. Complete-kaflinn og Deferred smoke tests haldast hér."), end-of-session rituals (bæta við skrefi: "keyra `/huginn` lotulok")
- Modify: `cli/huginn.mjs` (`pull --brief`)

SKILL.md innihald (íslenska, stutt):
1. Hvað Huginn er og hvar tólið er.
2. Lotustart: `pull`, lesa STATUS, opna verk sem bíða Claude.
3. Þegar nýtt verk er sótt: `file get` fyrir hvert skjal í vinnumöppu, lesa, skrifa greiningu í `item set --body-file --summary --module --tags`, spurningar með `question ask --to Á`, staða `waiting --waiting-on Á` eða `--waiting-on H`.
4. Þegar plan er skrifað: `plan add` með slóð, `item set --status ready --next-step --next-prompt-file`.
5. Lotulok (skyldulisti, sjá spec 5b): plan status, `file add` fyrir framvinduskjal, prófunarbók og breytingaskjöl með `--repo-path`, `action add` fyrir allt sem Heimir eða Árni þarf að gera (SQL í `--payload-file`), `ruling add` fyrir hvern úrskurð, `item set --summary "Hvar erum við" --next-step --next-prompt-file --waiting-on`, `sync`, `bundle push` (sjá plan 4), git add `docs/huginn`.
6. Reglur: aldrei loka verki með ósvöruðu, aldrei skrifa prompt sem vísar í möppu utan repos án þess að segja það, engin þankastrik.

- [ ] **Step 1:** `pull --brief` í tólinu, próf á `format.briefLine(counts)` (deterministic).
- [ ] **Step 2:** Skrifa SKILL.md, `.huginn-project`, hook, CLAUDE.md breytingar. Prófa hook: ný lota í metta2 prentar línuna; fjarlægja tólið tímabundið (endurnefna möppu), lotan byrjar samt.
- [ ] **Step 3:** Commit í metta2_new: `chore(huginn): skill, session hook, CLAUDE.md pending moves to Huginn`. Push eftir reglum metta2_new.
- [ ] **Step 4:** Commit í Huginn: `feat(cli): pull --brief`.

### Task 5: Fyrsta fylling

**Files (Huginn-repo):**
- Create: `cli/seed/metta-2026-10-31.json` (46 verkin úr mockup v7 `N` og `TAGS`, með `source_ref`, `body`, `tags`, `module slug`, `status`, `waiting_on short`, `pos_x`, `pos_y`), `cli/seed/seed.mjs` (les JSON, stofnar með sömu föllum og `item create`, hleypur ekki tvisvar: sleppir titli sem er til í verkefninu)
- Modify: `package.json` (`"seed:metta": "node cli/seed/seed.mjs --project metta --file cli/seed/metta-2026-10-31.json"`)

Vörpun stöðu úr mockup: `new` → status new; `you` → waiting, waiting_on H; `arni` → waiting, waiting_on Á; `build` → ready (eða building ef `plans` með gildi yfir 0); `wait` → parked. Plön úr mockupinu (`plans` fylki) verða hg_plans raðir (Efnaskrá: Plan A done (A kláraðist 2026-10-31), B1 todo, B2 todo; iPad: kjarni, Viðhald, sími, öll todo; Viðhald: eitt plan todo; RV kennsla: eitt done).

- [ ] **Step 1:** Skrifa JSON (afrita úr mockup, laga: Efnaskrá A er lokið, Plan A done; RV kennsla úti; handtök úr skjali 141 Handover sem `actions` á Efnaskrá-verkinu með SQL úr kaflanum sem payload).
- [ ] **Step 2:** `seed.mjs`, keyra `npm run seed:metta`. Væntanlegt: 46 created. Keyra aftur: 0 created, 46 skipped.
- [ ] **Step 3:** Opna huginn.pro/p/metta: 46 verk, teljarar stemma við mockup (12/12/6/20 eða leiðrétt eftir Efnaskrá A).
- [ ] **Step 4:** Í metta2_new: `huginn sync`, `docs/huginn/` verður til með 46 möppum og STATUS.md. Flytja `metta2/from_arni/*` inn í viðeigandi `docs/huginn/<slug>/` möppur (handvirkt af byggingaraðila eftir töflu í framvinduskjali) og bæta þeim við sem `file add --repo-path`. Commit í metta2_new: `docs(huginn): first fill mirror`.
- [ ] **Step 5:** Commit í Huginn: `feat(cli): seed metta 2026-10-31`.

### Task 6: Frágangur plans 3

- [ ] **Step 1:** `npm run test` (vef + cli) grænt, `npm run build` grænt.
- [ ] **Step 2:** `docs/progress/03-vinnubord-cli.md`: skipanir, credentials-uppsetning hjá Árna (skref fyrir skref, fyrir seinna), það sem bíður (Árna Claude Code, minnisskrár Claude halda stöðulínum þar til Heimir ákveður annað).
- [ ] **Step 3:** Commit `docs(cli): plan 3 progress`.
