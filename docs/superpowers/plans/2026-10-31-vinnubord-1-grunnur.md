# Huginn vinnuborð, plan 1 af 4: grunnur (skema, gagnalag, rökfræði, skel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nýtt gagnalíkan (`hg_` töflur, RLS, realtime, lokaður bucket), gagnalag í vefnum, prófuð hrein rökfræði (staða, síur, rúmfræði þráða, samhengisprompt) og ný skel með þátttakendahliði, án gamla Trello-yfirborðsins.

**Architecture:** Allt nýtt býr í `src/vinnubord/` (feature-mappa með lib, hooks, components, pages). Gamla kóðanum er eytt í síðasta verki þessa plans, ekki endurnýttur nema það sem er talið upp. Gagnagrunnurinn fær nýtt forskeyti `hg_` og snertir engar `huginn_` töflur. Allar töflur bera `project_id` svo RLS og realtime-síur séu einfaldar. Atburðir (saga) skrifast með triggerum, aldrei úr vefnum.

**Tech Stack:** React 19, Vite 6, TypeScript strict, Tailwind v4 (`@theme`), supabase-js 2, Supabase Postgres + RLS + Realtime + Storage, vitest (bætt við), react-i18next (IS aðal).

**Spec:** `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md`

## Global Constraints

- Repo: `D:\Claude Code\Huginn\huginn`, grein `vinnubord` frá `main`. Sameinað í main eftir hreina Fable-yfirferð.
- Supabase-verkefni `czdjxtsjgughimlazdmu` er DEILT með 12 auth-notendum og tugum taflna annarra smáverkefna (askur_, padel_, dagurinn_, chore_, whatsapp_). Aldrei eyða auth-notendum, aldrei snerta töflur með öðru forskeyti. Aðgangur að Huginn ræðst af `hg_participants`.
- Migrations: skrár í `supabase/migrations/NNNN_*.sql` (mappan er ný), keyrðar með MCP `apply_migration`, aldrei `db push`. DROP og DELETE fara handvirkt hjá Heimi.
- Töfluforskeyti `hg_`. Engin `huginn_` tafla breytt eða eytt í þessu plani.
- Nýr Storage bucket `hg-files` er lokaður (public = false). Gamli `huginn-attachments` er opinber og er ekki notaður.
- Engin þankastrik eða bandstrik í neinum texta, kommentum eða strengjum. Íslenskt viðmót, ekki hástafaborðar, ekki punktar á milli orða.
- i18n: lyklar í `src/shared/i18n/locales/en.json`, íslenska með `npm run translate` (OpenRouter, `OPEN_ROUTER_API` í `.env`). Ef lykillinn vantar í umhverfinu skrifar byggingaraðili íslenskuna beint í `is.json` og merkir það í framvinduskjali.
- `npm run build` (tsc -b + vite) er hliðið. `npm run lint` er bilað, ekki nota.
- Enginn nýr pakki nema vitest og @vitest/coverage-v8 (dev). Engar UI-safnbætur.

## Review Focus

1. Notandi sem er innskráður en ekki þátttakandi í neinu verkefni: sér skýra síðu "Þú ert ekki þátttakandi í neinu verkefni", ekki tóman skjá eða villu. Próf í verki 7.
2. Svar við síðustu ósvöruðu spurningu: `waiting_on` færist sjálfkrafa á service-þátttakandann, en EKKI ef enn er ósvöruð spurning. Próf í verki 2 (SQL) og 5.
3. Tvö verk með sama titli í sama verkefni mega vera til, en slug módula og verkefna eru einkvæm. Próf í verki 1.
4. Skrá stærri en bucket-þakið (50 MB) hafnast með skiljanlegri villu á íslensku, ekki þöglum "null". Próf í verki 6.
5. Viewer-miðaðir litir: sama verk er kóral hjá þeim sem það bíður og lilla hjá hinum. Próf í verki 3.

---

### Task 0: Grein, vitest og möppuskipan

**Files:**
- Create: `vitest.config.ts`, `src/vinnubord/README.md`, `supabase/migrations/.gitkeep`
- Modify: `package.json` (scripts `test`, devDependencies `vitest`), `tsconfig.app.json` (include `"vitest/globals"` í types ef notað, annars ekkert)

- [ ] **Step 1:** `git checkout -b vinnubord` frá `main`. `git status --short` tómt.
- [ ] **Step 2:** `npm i -D vitest@^3` og bæta `"test": "vitest run"` í scripts. `vitest.config.ts` með `test: { include: ['src/**/*.test.ts'] }`.
- [ ] **Step 3:** Skrifa `src/vinnubord/lib/smoke.test.ts` með einu prófi `expect(1+1).toBe(2)`. Keyra `npm run test`, væntanlegt: 1 passed. Eyða prófinu.
- [ ] **Step 4:** `src/vinnubord/README.md`: fimm línur um möppuskipan (lib, hooks, components, pages, css) og regluna "allt nýtt hér, ekkert úr features/".
- [ ] **Step 5:** Commit `chore(vinnubord): branch, vitest, folder`.

### Task 1: Migration 0001, skema og RLS

**Files:**
- Create: `supabase/migrations/0001_hg_schema.sql`
- Create: `supabase/migrations/README.md` (hvernig þær eru keyrðar: MCP apply_migration, nafn = skráarnafn án .sql)

**Interfaces (Produces):** töflurnar hér að neðan, fallið `hg_is_participant(p_project uuid) returns boolean` (security definer, stable), fallið `hg_service_user(p_project uuid) returns uuid` (user_id þátttakanda með `is_service = true`, null ef enginn).

Töflur (allar með `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, og `project_id uuid not null references hg_projects(id) on delete cascade` nema hg_projects sjálf):

- `hg_projects(slug text unique not null, name text not null, repo_path text, context_bundle text, context_bundle_at timestamptz)`
- `hg_participants(user_id uuid not null references auth.users(id), display_name text not null, short text not null, is_service boolean not null default false, unique(project_id, user_id))`
- `hg_packages(name text not null, position int not null default 0, pos_x int not null default 0, pos_y int not null default 0)`
- `hg_modules(package_id uuid references hg_packages(id) on delete set null, slug text not null, name text not null, status_line text, color text not null default 'stone', is_ghost boolean not null default false, position int not null default 0, unique(project_id, slug))`
- `hg_items(module_id uuid references hg_modules(id) on delete set null, title text not null, summary text, body text, status text not null default 'new' check (status in ('new','waiting','ready','building','parked','done','dropped')), waiting_on uuid references auth.users(id), tags text[] not null default '{}', pos_x int not null default 0, pos_y int not null default 0, source_ref text, next_step text, next_prompt text, created_by uuid not null, updated_by uuid, updated_at timestamptz not null default now(), closed_at timestamptz)`
- `hg_plans(item_id uuid not null references hg_items(id) on delete cascade, name text not null, path text, status text not null default 'todo' check (status in ('todo','building','done')), position int not null default 0, updated_at timestamptz not null default now())`
- `hg_files(item_id uuid not null references hg_items(id) on delete cascade, name text not null, storage_path text not null, size bigint not null, mime text, repo_path text, uploaded_by uuid not null)`
- `hg_questions(item_id uuid not null references hg_items(id) on delete cascade, body text not null, asked_by uuid not null, asked_to uuid, answer text, answered_by uuid, answered_at timestamptz)`
- `hg_actions(item_id uuid not null references hg_items(id) on delete cascade, body text not null, owner uuid not null, payload text, done_at timestamptz, done_by uuid)`
- `hg_rulings(plan_id uuid not null references hg_plans(id) on delete cascade, code text not null, body text not null, cost text, reversed boolean not null default false)`
- `hg_comments(item_id uuid references hg_items(id) on delete cascade, module_id uuid references hg_modules(id) on delete cascade, body text not null, user_id uuid not null, check (item_id is not null or module_id is not null))`
- `hg_events(item_id uuid references hg_items(id) on delete cascade, module_id uuid, actor uuid, kind text not null, data jsonb not null default '{}')`
- `hg_reads(item_id uuid not null references hg_items(id) on delete cascade, user_id uuid not null, read_at timestamptz not null default now(), primary key (item_id, user_id))` (án eigin id)

RLS: `enable row level security` á öllum. Ein stefna per tafla per aðgerð (select, insert, update, delete) með `using (hg_is_participant(project_id))` og `with check (hg_is_participant(project_id))`. Vísar: `(project_id)` á öllum, `(item_id)` á börnum, `(project_id, status)` á hg_items.

Realtime: `alter publication supabase_realtime add table hg_items, hg_plans, hg_files, hg_questions, hg_actions, hg_rulings, hg_comments, hg_events, hg_reads, hg_modules, hg_packages;`

- [ ] **Step 1:** Skrifa migration-skrána eins og að ofan.
- [ ] **Step 2:** Keyra með MCP `apply_migration` (name `0001_hg_schema`). Væntanlegt: engin villa.
- [ ] **Step 3:** Sannprófa með `execute_sql`: `select count(*) from information_schema.tables where table_name like 'hg_%'` = 13. `select hg_is_participant(gen_random_uuid())` = false. Prófa einkvæmni: insert í hg_projects með sama slug tvisvar gefur villu 23505 (í transaction sem er rúllað til baka).
- [ ] **Step 4:** Commit `feat(db): hg schema, rls, realtime`.

### Task 2: Migration 0002, triggerar (atburðir, updated_at, svar færir boltann), bucket

**Files:**
- Create: `supabase/migrations/0002_hg_triggers_storage.sql`

**Interfaces (Produces):** hg_events raðir með `kind` úr þessu mengi: `item.created`, `item.status` (data: {from, to, waiting_on}), `item.updated` (data: {fields: [...]}), `file.added` (data: {name}), `question.asked`, `question.answered`, `action.added`, `action.done`, `plan.added`, `plan.status`, `ruling.added`, `comment.added`. Actor = `auth.uid()`; ef null (service role) þá `created_by`/`user_id` dálkur raðarinnar.

- [ ] **Step 1:** Trigger-fall `hg_touch_updated_at()` á hg_items og hg_plans (before update).
- [ ] **Step 2:** Trigger-fall `hg_log_event()` (after insert/update) á töflunum að ofan, skrifar hg_events eftir töflunni og breytingunni (status-breyting á items og plans, answer sett á questions, done_at sett á actions). Engin önnur update skrifa atburð nema `item.updated` þegar `title`, `summary`, `body`, `module_id`, `tags`, `next_step` eða `next_prompt` breytast.
- [ ] **Step 3:** Trigger-fall `hg_question_answered()` (after update of answer on hg_questions): ef `new.answer is not null and old.answer is null` og `not exists (select 1 from hg_questions where item_id = new.item_id and answer is null)` þá `update hg_items set status = 'waiting', waiting_on = hg_service_user(project_id) where id = new.item_id`.
- [ ] **Step 4:** Bucket: `insert into storage.buckets (id, name, public, file_size_limit) values ('hg-files','hg-files', false, 52428800)`. Stefnur á storage.objects fyrir bucket `hg-files`: select/insert/delete þegar `hg_is_participant((split_part(name, '/', 1))::uuid)`.
- [ ] **Step 5:** Keyra með `apply_migration` (name `0002_hg_triggers_storage`).
- [ ] **Step 6:** SQL-próf í einni transaction (rollback í lokin): stofna project, tvær spurningar á item, svara annarri: `waiting_on` óbreytt. Svara hinni: `waiting_on` = service user (null ef enginn service-þátttakandi, en status = waiting). Telja hg_events = 2 `question.answered` + 1 `item.status`.
- [ ] **Step 7:** Commit `feat(db): hg triggers, events, private bucket`.

### Task 3: Hrein rökfræði með prófum

**Files:**
- Create: `src/vinnubord/lib/types.ts`, `src/vinnubord/lib/status.ts`, `src/vinnubord/lib/status.test.ts`, `src/vinnubord/lib/filters.ts`, `src/vinnubord/lib/filters.test.ts`, `src/vinnubord/lib/continuation.ts`, `src/vinnubord/lib/continuation.test.ts`

**Interfaces (Produces):**
- `types.ts`: TS týpur fyrir hverja hg_ töflu (`Project, Participant, Package, Module, Item, Plan, FileRow, Question, Action, Ruling, Comment, Event, Read`), `ItemStatus` union, og `BoardData = { project, participants, packages, modules, items, plans, files, questions, actions, rulings, comments, events, reads }`.
- `status.ts`:
  - `type Tone = 'gold' | 'coral' | 'lilac' | 'teal' | 'stone'`
  - `itemTone(item: Item, viewerId: string, participants: Participant[]): Tone` (new → gold; waiting og waiting_on === viewerId → coral; waiting og waiting_on er service → gold; waiting annars → lilac; ready/building → teal; parked → stone; done/dropped → stone)
  - `itemStatusLabel(item, viewerId, participants): string` (íslenskur texti: "Nýtt frá {short}", "Bíður þín", "Bíður {name}", "Svarað, bíður Claude", "Tilbúið til byggingar", "Í byggingu", "Í bið", "Lokið", "Hætt við")
  - `isOnBoard(item): boolean` (ekki done, ekki dropped)
  - `waitsFor(item, actions: Action[], viewerId): boolean` (waiting_on === viewerId eða ósvarað handtak með owner === viewerId)
  - `countsFor(items, actions, viewerId, participants): { new: number; mine: number; others: number; build: number; parked: number }`
- `filters.ts`: `type Filter = { tones: Set<Tone>; packages: Set<string>; tags: Set<string>; q: string }`, `emptyFilter(): Filter`, `isActive(f): boolean`, `matches(item, ctx: { tone: Tone; packageId: string | null }, f): boolean` (leit í title, summary, body, tags, lágstafað).
- `continuation.ts`: `buildContinuationPrompt(input: { project: Project; item: Item; module: Module | null; plans: Plan[]; actions: Action[]; rulings: Ruling[]; questions: Question[]; files: FileRow[] }): string`. Íslenskur texti með föstum fyrirsögnum í þessari röð: "Verk", "Hvar erum við", "Plön" (nafn, staða, slóð), "Opin handtök" (eigandi, texti), "Ósvaraðar spurningar", "Úrskurðir sem skipta máli" (ekki reversed), "Skjöl" (repo_path ef til, annars nafn), "Keyra" (repo_path, "claude --model opus" ef næsta plan er todo/building, annars "claude" án módels), og `next_prompt` orðrétt síðast.

- [ ] **Step 1:** Skrifa `status.test.ts`: `itemTone` fimm tilfelli úr Review Focus 5 (sama verk, tveir viewers), `itemStatusLabel` fyrir "Svarað, bíður Claude" (waiting_on = service), `countsFor` telur ósvarað handtak með owner = viewer inn í `mine`.
- [ ] **Step 2:** Keyra `npm run test`, væntanlegt: FAIL, module not found.
- [ ] **Step 3:** Skrifa `types.ts` og `status.ts`.
- [ ] **Step 4:** Keyra, væntanlegt: PASS.
- [ ] **Step 5:** Skrifa `filters.test.ts`: tómt filter passar allt; tone-sía; pakkasía með packageId null passar ekki þegar pakkasía er virk; leit "efnaskr" finnur "Efnaskrá A og B" (lágstafað, án sérstafameðhöndlunar).
- [ ] **Step 6:** Keyra FAIL, skrifa `filters.ts`, keyra PASS.
- [ ] **Step 7:** Skrifa `continuation.test.ts`: úttakið inniheldur fyrirsagnirnar í réttri röð, inniheldur "claude --model opus" þegar plan er todo, sleppir reversed úrskurði, endar á `next_prompt`.
- [ ] **Step 8:** Keyra FAIL, skrifa `continuation.ts`, keyra PASS.
- [ ] **Step 9:** Commit `feat(vinnubord): types, status, filters, continuation prompt`.

### Task 4: Gagnalag og realtime

**Files:**
- Create: `src/vinnubord/lib/api.ts`, `src/vinnubord/hooks/useBoardData.ts`, `src/vinnubord/hooks/useViewer.ts`

**Interfaces (Produces):**
- `api.ts` (allt async, kastar á villu með íslenskum skilaboðum):
  - `loadBoard(projectId: string): Promise<BoardData>` (12 select í `Promise.all`, verk með status done/dropped síðustu 90 daga sótt líka fyrir módulsöguna)
  - `loadProjectBySlug(slug: string): Promise<Project | null>`
  - `listMyProjects(): Promise<Project[]>` (gegnum hg_participants)
  - `updateItemPosition(id: string, x: number, y: number): Promise<void>`
  - `createItem(input: { projectId; title; body?; moduleId?: string | null; tags?: string[] }): Promise<Item>`
  - `updateItem(id, patch: Partial<Pick<Item,'title'|'summary'|'body'|'module_id'|'tags'|'status'|'waiting_on'|'next_step'|'next_prompt'>>): Promise<void>`
  - `addComment(input: { projectId; itemId?: string; moduleId?: string; body }): Promise<void>`
  - `answerQuestion(id, answer): Promise<void>`
  - `markActionDone(id, done: boolean): Promise<void>`
  - `markRead(itemId): Promise<void>` (upsert hg_reads)
  - `uploadFile(input: { projectId; itemId; file: File }): Promise<FileRow>` (slóð `${projectId}/${itemId}/${crypto.randomUUID()}_${name}`; ef `file.size > 52428800` kasta `Error('Skráin er stærri en 50 MB. Stærri skrár bíða Pro-áskriftar.')` áður en reynt er)
  - `fileUrl(storagePath): Promise<string>` (signed url, 1 klst)
- `useBoardData(projectId): { data: BoardData | null; loading; error; reload }`. Realtime: ein rás `hg_${projectId}`, `postgres_changes` á hverja hg_ töflu með `filter: project_id=eq.${projectId}`, debounced `reload()` 150 ms. Afskráir við unmount.
- `useViewer(): { user; participant: Participant | null; projects: Project[]; loading }`.

- [ ] **Step 1:** Skrifa `api.ts` og hooks.
- [ ] **Step 2:** `npm run build` grænt.
- [ ] **Step 3:** Handpróf með MCP: stofna hg_projects röð "Metta" (slug `metta`) og hg_participants röð fyrir Heimi (user_id úr auth.users, email arnfinnsson@gmail.com, short `H`, display_name `Heimir`), Árna (arnimar@markadsdeildin.is, `Á`) og service-þátttakanda eftir að Heimir hefur stofnað auth-notanda fyrir Claude í dashboard (netfang ákveður Heimir, skráð í framvinduskjali). Þetta er fyrsta fylling grunnsins, ekki verkanna.
- [ ] **Step 4:** Commit `feat(vinnubord): api layer and realtime board data`.

### Task 5: Spurningar, handtök, athugasemdir, lestrarmerki (hegðunarpróf gegn grunninum)

**Files:**
- Create: `scripts/hg-smoke.mjs` (Node, notar `.env` VITE_SUPABASE_URL/ANON_KEY og `HG_SMOKE_EMAIL`/`HG_SMOKE_PASSWORD` fyrir Heimi)

Script keyrir gegn alvöru grunninum í verkefninu `metta` og rúllar sjálft til baka (eyðir því sem það stofnaði, DELETE á eigin röðum er leyft í RLS):
1. stofnar item, tvær spurningar, svarar annarri, les `waiting_on` (á að vera óbreytt), svarar hinni, les aftur (á að vera service user), telur events.
2. stofnar handtak með owner Heimir, `markActionDone`, les `done_at`.
3. `markRead` tvisvar, engin villa (upsert).
4. eyðir item (cascade).

- [ ] **Step 1:** Skrifa scriptið, `node scripts/hg-smoke.mjs`. Væntanlegt: `ok 4/4`.
- [ ] **Step 2:** Bæta `"smoke:hg": "node scripts/hg-smoke.mjs"` í package.json.
- [ ] **Step 3:** Commit `test(vinnubord): db behaviour smoke`.

### Task 6: Nýtt verk og skráaupphlaðning (UI-laust lag + eitt próf)

**Files:**
- Create: `src/vinnubord/lib/upload.ts`, `src/vinnubord/lib/upload.test.ts`

**Interfaces (Produces):** `validateUpload(file: { name: string; size: number }): { ok: true } | { ok: false; reason: string }` (þak 52428800, tóm skrá hafnað, nafn lengra en 180 stafir hafnað), `isTextLike(name): boolean` (md, txt, html, json, sql, csv, yaml, ts, tsx, js, css), `fileKindLabel(name): 'MD' | 'HTML' | 'ZIP' | 'MP4' | 'PDF' | 'MYND' | 'TXT' | 'SKRÁ'`.

- [ ] **Step 1:** Próf: 60 MB hafnað með ástæðu sem inniheldur "50 MB"; 0 bæti hafnað; `fileKindLabel('x.MOV')` = 'MP4' (öll vídeó), `'skjal.md'` = 'MD'.
- [ ] **Step 2:** FAIL, skrifa, PASS. `uploadFile` í api.ts kallar `validateUpload` fyrst.
- [ ] **Step 3:** Commit `feat(vinnubord): upload validation`.

### Task 7: Skel, leiðir og þátttakendahlið

**Files:**
- Modify: `src/app/routes.tsx` (ný leiðatafla), `src/pages/LoginPage.tsx` (fjarlægja nýskráningu og boðskóða, bara innskráning + gleymt lykilorð)
- Create: `src/vinnubord/pages/HomePage.tsx`, `src/vinnubord/pages/BoardPage.tsx` (í þessu plani: fyrirsögn með nafni verkefnis og teljurum úr `countsFor`, engin tafla enn), `src/vinnubord/pages/NoAccessPage.tsx`, `src/vinnubord/components/Shell.tsx`
- Delete: `src/pages/LandingPage.tsx`, `src/pages/MetaCallbackPage.tsx`, `src/pages/InboxPage.tsx`, `src/pages/TodayPage.tsx`, `src/pages/CalendarPage.tsx`, `src/pages/ProjectsPage.tsx`, `src/pages/ProjectDetailPage.tsx`, `src/pages/SettingsPage.tsx`

Leiðir: `/` → ef innskráður og á verkefni: `/p/<fyrsta slug>`; ef innskráður án verkefnis: `NoAccessPage`; annars `/login`. `/login`, `/auth/callback`, `/reset-password` óbreytt. `/p/:slug` → `BoardPage` innan `Shell`. `/p/:slug/stillingar` → stubb sem segir "kemur í plani 2".

`Shell`: `h-[100dvh]` dökkt, engin BottomNav, engin CommandPalette, engin GlobalTopBar (toppstikan kemur í plani 2 inni í BoardPage).

- [ ] **Step 1:** Skrifa leiðir, síður og Shell. Fjarlægja ónotaðar innflutningar.
- [ ] **Step 2:** `npm run build` grænt (tsc hreinsar dauðar innflutningar með noUnusedLocals).
- [ ] **Step 3:** Handpróf í vafra (`npm run dev`): innskráning sem Heimir lendir á `/p/metta` og sér nafn og teljara (allir 0). Innskráning sem notandi sem er ekki þátttakandi (t.d. `1@1.is` ef lykilorð er þekkt, annars nýr prófnotandi stofnaður í dashboard og eytt eftir á) lendir á NoAccessPage.
- [ ] **Step 4:** Commit `feat(vinnubord): shell, routes, participant gate, login without signup`.

### Task 8: Fjarlægja gamla yfirborðið og uppfæra skjöl

**Files:**
- Delete: `src/features/` (öll mappan), `src/runes/` (öll), `src/shared/components/{BottomNav,CommandPalette,GlobalTopBar,ToolBar,MentionsBell,AccountSettingsDrawer,AccountSettings,AccountMenu,HexInput}.tsx`, `src/shared/hooks/{useCommandPalette,useTaskCounts,useProfileSearch,useAvatarUpload}.ts`, `src/shared/lib/{boardBackgrounds,contrast}.ts`, `supabase/functions/meta-oauth-complete`, `supabase/functions/meta-publish`
- Keep: `src/shared/{hooks/useAuth,hooks/useProfile,hooks/useIsMobile,hooks/useLanguagePreference,components/Avatar,components/Logo,components/ErrorBoundary,components/LanguageToggle,components/ModalShell,lib/supabase,lib/dateUtils,i18n}`, `src/pages/{LoginPage,AuthCallbackPage,ResetPasswordPage}`
- Modify: `package.json` (fjarlægja @dnd-kit/*, @tiptap/*, @codesandbox/sandpack-react, marked, dompurify EF ekkert notar þau lengur; `marked` og `dompurify` HALDA sér, þau koma í markdown-lesara í plani 2), `.env.example` (fjarlægja META_* og INVITE_CODE), `CLAUDE.md` (endurskrifa: hvað Huginn er núna, möppuskipan, töflur, skipanir, reglan um deilt Supabase), `vite.config.ts` (PWA description: "Vinnuborð Mettu")
- Modify: `src/shared/lib/types.ts` (tæma niður í Profile og það sem useProfile þarf; nýju týpurnar eru í vinnubord/lib/types.ts)

- [ ] **Step 1:** Eyða og laga uns `npm run build` er grænt. `src/shared/i18n/locales/en.json`: fjarlægja lykla sem engin skrá vísar í (`grep -rho "t('[a-zA-Z0-9_.]*'" src | sort -u` á móti lyklum).
- [ ] **Step 2:** `npm run test` grænt, `node scripts/hg-smoke.mjs` ok.
- [ ] **Step 3:** Skrifa `docs/progress/01-vinnubord-grunnur.md` (mappan ný): hvað var gert, hvað bíður (töflur `huginn_` enn til, bucket `huginn-attachments` enn til, Heimir eyðir seinna), service-notandi netfang, smokes sem bíða.
- [ ] **Step 4:** Commit `chore(vinnubord): remove trello surface, docs`.
