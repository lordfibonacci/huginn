# Huginn vinnuborð, plan 4 af 4: skyndigreining (edge function + Claude API + samhengisbúnt)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Þegar nýtt verk kemur inn (frá Árna á vefnum eða úr tólinu) skrifar Claude API fyrstu greiningu á það innan mínútu án þess að Heimir opni lotu: summary, body, tillögð tögg og módull, staða færð í Bíður með waiting_on Heimir.

**Architecture:** Database webhook (pg_net trigger á `hg_items` insert með status `new`, og á `hg_files` insert þegar verkið er enn `new`, með 20 s seinkun svo margar skrár safnist saman) kallar edge function `hg-analyse` með item id. Fallið sækir verkið, textaskrár þess (undir 2 MB hver, html og md og txt), samhengisbúnt verkefnisins og módulalistann, kallar Anthropic Messages API með tool-use skema fyrir strúktúrað svar, skrifar niðurstöðuna og atburð. Ef verkið er ekki lengur `new` þegar fallið keyrir (Claude Code var á undan) hættir það. Samhengisbúntið skrifar Claude Code í lotulok með `huginn bundle push`.

**Tech Stack:** Supabase Edge Functions (Deno), pg_net, Anthropic Messages API (model id úr `claude-api` skillinu, nýjasta Opus, `ANTHROPIC_API_KEY` sem edge secret), supabase-js í Deno með service role innan fallsins (skrifar sem service-þátttakandinn: `actor` = `hg_service_user(project_id)`).

**Spec:** `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (kaflar 5 skref 2, 7.3, 9b).

## Global Constraints

- Sömu og plön 1 til 3. Edge function deploy með MCP `deploy_edge_function` eða CLI úr Huginn-repoinu; secrets með `create_edge_function_secret`. Ath. minnisregluna úr metta2 um að MCP-deploy geti skemmt bundlaðar skrár, þetta fall er ein skrá án bundlingar.
- Vídeó, zip og myndir eru aldrei send til Claude, bara nafn og stærð í listanum.
- Fallið má aldrei breyta verki sem er ekki `new`. Það má aldrei eyða neinu.
- Hámark 1 kall á verk á 2 mínútum (lás í `hg_items.data`? nei: dálkur `analysed_at` og `analyse_lock_until` bætt við í migration 0004).
- Prompt og skema á íslensku, svör á íslensku, engin þankastrik (segja það í prompti og hreinsa í kóða: `replace(/[–—]/g, ',')`).

## Review Focus

1. Fallið keyrir á verki sem Claude Code er þegar búið að greina (status ekki `new`): hættir án skrifa. Próf í verki 2.
2. Anthropic kall bregst (401, 529, timeout 60 s): verkið helst `new`, atburður `analysis.failed` með villutexta, lásinn losnar. Próf í verki 2 með vitlausum lykli.
3. Verk með html-skrá 1.9 MB og md 30 KB: html fer með, en klippt á 400 KB með "[klippt]" merkingu, md óklippt. Próf í verki 1 (hrein föll).
4. Módultillaga sem passar engum slug: module_id helst null, taggið "óflokkað" bætt við, atburður segir frá. Próf í verki 1.
5. Tvær skrár hlaðast inn með 5 s bili: eitt kall, ekki tvö (20 s debounce í webhook + lásinn). Próf í verki 2 (handpróf með tímamælingu).

---

### Task 1: Hrein föll greiningar (prófuð með vitest í Node)

**Files:**
- Create: `supabase/functions/hg-analyse/lib.ts` (hrein, engin Deno-sértæk innflutningur), `supabase/functions/hg-analyse/lib.test.ts` (vitest, include `supabase/functions/**/*.test.ts`), `supabase/functions/hg-analyse/prompt.md` (kerfisprompt á íslensku)

**Interfaces (Produces):**
- `selectTextFiles(files: Array<{ name; size; mime }>, maxPerFile = 2_000_000): { send: FileRow[]; listOnly: FileRow[] }`
- `clipText(text: string, maxBytes = 400_000): string` (bætir "\n\n[klippt, skráin er lengri]" ef klippt)
- `buildUserMessage(input: { item: { title; body }; files: Array<{ name; text?: string; size }>; bundle: string | null; modules: Array<{ slug; name; status_line }>; participants: Array<{ short; name }> }): string`
- `analysisTool`: JSON-skema fyrir tool-use með reitum `summary` (1 til 3 setningar, "hvar erum við"), `body` (markdown með fyrirsögnum "Hvað þetta er", "Hvaða módul og af hverju", "Stærð og áhætta", "Hvað þarf að spyrja um", "Byggjanlegt núna, samhliða eða seinna"), `module_slug` (strengur eða null), `tags` (fylki, 2 til 6), `questions` (fylki af { to: 'Á' | 'H', body })
- `applyAnalysis(result, modules): { summary; body; module_id: string | null; tags: string[]; questions; unmatchedModule: boolean }` (varpar slug á id, bætir "óflokkað" ef ekkert passar, hreinsar þankastrik)

- [ ] **Step 1:** Prófin fjögur úr Review Focus 3 og 4 + `buildUserMessage` inniheldur módulalistann og bundle-ið.
- [ ] **Step 2:** FAIL, skrifa `lib.ts` og `prompt.md`, PASS.
- [ ] **Step 3:** Commit `feat(analyse): pure analysis helpers and prompt`.

### Task 2: Edge function, lás, webhook

**Files:**
- Create: `supabase/functions/hg-analyse/index.ts`, `supabase/migrations/0004_hg_analyse_webhook.sql`

Migration 0004: `alter table hg_items add column analysed_at timestamptz, add column analyse_lock_until timestamptz;` Trigger-fall `hg_enqueue_analyse()` (after insert á hg_items þegar status = 'new'; after insert á hg_files þegar item.status = 'new') sem kallar `net.http_post(url := current_setting('app.hg_analyse_url'), headers := jsonb með `Authorization: Bearer ` + current_setting('app.hg_analyse_secret'), body := jsonb_build_object('item_id', ...), timeout_milliseconds := 5000)`. Seinkun: fallið sjálft bíður 20 s (`await new Promise(r => setTimeout(r, 20000))`) áður en það les, og lásinn kemur í veg fyrir tvíkeyrslu. Stillingarnar `app.hg_analyse_url` og `app.hg_analyse_secret` settar með `alter database postgres set app.hg_analyse_url = '...'` (Heimir keyrir, gildi í framvinduskjali, ekki í repo).

`index.ts` flæði: staðfesta Bearer secret → sofa 20 s → lesa item; ef status ≠ 'new' eða `analyse_lock_until > now()` → 200 "skipped" → setja lás 2 mín → sækja skrár (signed download með service role), bundle, modules, participants → Anthropic kall með tool-use, `max_tokens 4000`, timeout 60 s → `applyAnalysis` → update item (summary, body, module_id, tags, status 'waiting', waiting_on = Heimir user id úr participants með short 'H', analysed_at) + insert hg_questions fyrir hverja spurningu (asked_by = service user, asked_to eftir short) + hg_events `analysis.done` (data: { model, input_files, unmatchedModule }) → við villu: hg_events `analysis.failed` með villutexta, lás núllaður, status óbreytt.

- [ ] **Step 1:** Migration með `apply_migration`. Secrets: `ANTHROPIC_API_KEY`, `HG_ANALYSE_SECRET` með `create_edge_function_secret`. Deploy fallsins.
- [ ] **Step 2:** Handpróf A: stofna verk í vefnum með md-spekk. Innan 90 s: summary og body komin, tögg, módull, staða "Bíður þín" hjá Heimi, spurningar á flipanum, atburður `analysis.done`. Handpróf B: stofna verk, strax `huginn item set --status waiting` úr tólinu; fallið skrifar `skipped`. Handpróf C: setja vitlausan API-lykil tímabundið, stofna verk: `analysis.failed` atburður, status `new`, lykill lagaður. Handpróf D: verk með tveimur skrám 5 s á milli: einn `analysis.done`.
- [ ] **Step 3:** Commit `feat(analyse): edge function, lock, webhook`.

### Task 3: Samhengisbúnt úr metta2

**Files (metta2_new):**
- Create: `scripts/huginn-bundle.mjs` (safnar: `CLAUDE.md` kaflar "Tech Stack", "Modules" eða samsvarandi, "Current Build State > Complete" (fyrirsagnir og fyrsta lína hvers bullets), `src/lib/modules.ts` slug + tier listi, `docs/huginn/STATUS.md`, og síðustu 5 skrár í `docs/progress/` (fyrirsögn + fyrstu 10 línur). Þak 60 KB, klippt með merki.)
- Modify: `.claude/skills/huginn/SKILL.md` (lotulok: `node scripts/huginn-bundle.mjs > /tmp/bundle.md && huginn bundle push --file /tmp/bundle.md`, eða á Windows í `%TEMP%`)
- Modify: `package.json` (`"huginn:bundle"`)

- [ ] **Step 1:** Scriptið, keyra, úttak undir 60 KB og inniheldur "Efnaskrá".
- [ ] **Step 2:** `huginn bundle push`, staðfesta `context_bundle_at` í vefnum (stillingasíða sýnir "síðast uppfært").
- [ ] **Step 3:** Stofna prófverk um módul sem bara bundle-ið þekkir (t.d. "Askur kælirennur"): greiningin vísar í rétt samhengi. Eyða prófverkinu.
- [ ] **Step 4:** Commit í metta2_new `chore(huginn): context bundle script`, push.

### Task 4: Frágangur plans 4 og heildar

- [ ] **Step 1:** Öll próf græn í Huginn (`npm run test`, `npm run build`, `npm run smoke:hg`).
- [ ] **Step 2:** `docs/progress/04-vinnubord-skyndigreining.md`: flæðið, secrets (nöfn, ekki gildi), kostnaður per greiningu (mælt á þremur prófverkum), það sem bíður: Pro-áskrift fyrir vídeó, Árna Claude Code, útlitsumferðir Heimis, eyðing `huginn_` taflna og `huginn-attachments` bucket (handvirkt hjá Heimi).
- [ ] **Step 3:** Fable whole-branch review á `vinnubord` greininni (öll fjögur plön), fix round, endurtekin yfirferð þar til hrein, svo merge í main og push á Huginn origin. Vercel byggir huginn.pro.
- [ ] **Step 4:** Commit `docs(analyse): plan 4 progress`.
