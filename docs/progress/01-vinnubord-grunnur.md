# 01 Vinnuborð: grunnur (plan 1)

Dagsetning: 2026-10-31
Grein: `vinnubord` (ekki pushuð, Heimir pushar)
Plan: `docs/superpowers/plans/2026-10-31-vinnubord-1-grunnur.md`
Spekk: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md`

## Hvað var gert

- **Verk 0:** greinin `vinnubord`, vitest (`npm run test`), mappan `src/vinnubord/`.
- **Verk 1:** `supabase/migrations/0001_hg_schema.sql`, 13 töflur með forskeytinu `hg_`, RLS í gegnum `hg_is_participant`, `hg_service_user`, vísar og realtime. Keyrt á `czdjxtsjgughimlazdmu`.
- **Verk 1, lagfæring:** `supabase/migrations/0002_hg_rls_hardening.sql` (samsettir foreldralyklar, þátttakendur geta ekki gert sig að service, lesmerki bara fyrir sjálfan sig, réttindi á föllum). Keyrt af Heimi í SQL editor 2026-10-31 því MCP tengið hafnar DROP. Komið í git (d3de5f5). Ekki skráð í `supabase_migrations.schema_migrations`.
- **Verk 2:** `supabase/migrations/0003_hg_triggers_storage.sql`, keyrt með MCP `apply_migration` (9907015). Bætir við: `updated_at` á items og plans, atburðaskrá `hg_events` skrifuð af security definer triggerum, að svara síðustu opnu spurningu færir item í `waiting` með `waiting_on` = service notandi, `closed_at` sett þegar staða verður done/dropped og núllað við enduropnun, stimplun geranda úr `auth.uid()` (created_by, asked_by, uploaded_by, user_id, updated_by, answered_by, done_by), og privat bucket `hg-files` (50 MB þak) með reglunum `hg_files_storage_select/insert/delete` í gegnum `hg_can_access_path(name)`. Engin UPDATE regla á storage, svo upphleðsla verður að nota `upsert: false`.
- **Lokayfirferð, lagfæring:** `supabase/migrations/0004_hg_trigger_fixes.sql`, keyrt með MCP `apply_migration`. Svar færir ekki lengur done, dropped eða parked item, breyting á `waiting_on` skráir `item.status` með `waiting_on_from`, stimplar fyrir svör og aðgerðir verða ekki falsaðir og eru líka settir við innsetningu, tilfærsla á borði breytir ekki `updated_at` né `updated_by`, innsetning heldur gefnu `closed_at`, og `authenticated` getur ekki lengur kallað á `hg_service_user`.
- **Verk 5:** `scripts/hg-smoke.mjs`, `npm run smoke:hg` skráir inn sem Claude og skilar `ok 6/6` gegn lifandi gagnagrunni.
- **Verk 3:** `src/vinnubord/lib/` með týpum, stöðurökum (`status.ts`), síum (`filters.ts`) og framhaldsprompti (`continuation.ts`), með prófum.
- **Verk 4:** `lib/api.ts` og `hooks/useBoardData.ts`, borðið hlaðið í heild og realtime síað á `project_id`. Verkefnið metta stofnað (`74e926d8-f53a-42fc-8a83-c93ec405a6ae`) með þátttakendunum Heimi (H) og Árna (Á).
- **Verk 6:** upphleðslureglur (`upload.ts`), 50 MB þak, með prófum.
- **Verk 7:** Shell, leiðir (`/`, `/login`, `/auth/callback`, `/reset-password`, `/p/:slug`, `/p/:slug/stillingar`), þátttakendahlið, innskráning án nýskráningar. Gömlu síðurnar átta fóru.
- **Verk 8:** gamla Trello yfirborðið fjarlægt (`src/features/`, `src/runes/`, ónotaðar skrár í `src/shared/`, `supabase/functions/meta-*` úr repoinu), pakkar `@dnd-kit/*`, `@tiptap/*` og `@codesandbox/sandpack-react` farnir, ónotaðir i18n lyklar farnir úr `en.json` og `is.json`, CLAUDE.md endurskrifað.

Staðfesting: `npm run build` grænt, `npm run test` 36 próf græn.

## Service notandar

- **Claude:** `claude@huginn.pro`, auth id `6ea33ea7-0072-4e4b-a625-156ebf487399`, þátttakandi í metta (short `C`, display_name `Claude`, `is_service = true`). Lykilorðið er í `.env` sem `HG_SMOKE_PASSWORD` (gitignored). CLI í plani 3 notar hann.
- **Sandbox:** `sandbox@huginn.pro`, þátttakandi í engu verkefni, til að prófa aðgangslausa leið. Aðgangur í `.env` sem `HG_SANDBOX_*`. Heimir má eyða honum síðar.

## Staðfesting í vafra

Innskráð(ur) í vafra: Claude lendir á `/p/metta` með fimm núll teljara. Sandbox sér aðgangslausu síðuna, líka á `/p/metta`. Engar villur í console.

## Hvað bíður

### Hjá Heimi

1. **Gamla kerfið í Supabase** helst þar til Heimir eyðir því sjálfur: töflurnar `huginn_*` (`huginn_profiles` er enn notuð), og public bucket `huginn-attachments`. Agent snertir þetta ekki.
2. **Fjarlægja `VITE_INVITE_CODE`** úr Vercel env. Það er ekki notað lengur (engin nýskráning).

### Opið í kóða

- Borðsíðan hefur enn engan útskráningarhnapp. Hann kemur með topplínu í plani 2.
- Lokayfirferð plans 1 (Fable) er lokið og hrein eftir lagfæringu 0004. Smoke prentar `ok 6/6`.
- Svari sem þegar er svarað má breyta af öðrum þátttakanda og `answered_by` helst sá upprunalegi, án atburðar. Ákveða í plani 2: stimpla upp á nýtt eða skrá `question.answer_edited`.
- `answered_at` er alltaf `now()`, líka fyrir service role, svo innflutningur í plani 3 getur ekki haldið upprunalegum svartíma.
- Íslensku textarnir `auth.callback.recoveryVerified` og `auth.reset.done.body` voru handskrifaðir. Næsta `npm run translate` gæti skrifað yfir þá, athuga eftir keyrslu.

## Næst

Plan 2 (borðið): `docs/superpowers/plans/2026-10-31-vinnubord-2-bord.md`, í nýrri Opus lotu í `D:\Claude Code\Huginn\huginn`. Plan 3 (skipanalínutól og `/huginn`) og plan 4 (skyndigreining) koma á eftir.
