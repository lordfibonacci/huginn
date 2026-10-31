# 01 Vinnuborð: grunnur (plan 1)

Dagsetning: 2026-10-31
Grein: `vinnubord` (ekki pushuð, Heimir pushar)
Plan: `docs/superpowers/plans/2026-10-31-vinnubord-1-grunnur.md`
Spekk: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md`

## Hvað var gert

- **Verk 0:** greinin `vinnubord`, vitest (`npm run test`), mappan `src/vinnubord/`.
- **Verk 1:** `supabase/migrations/0001_hg_schema.sql`, 13 töflur með forskeytinu `hg_`, RLS í gegnum `hg_is_participant`, `hg_service_user`, vísar og realtime. Keyrt á `czdjxtsjgughimlazdmu`.
- **Verk 1, lagfæring:** `supabase/migrations/0002_hg_rls_hardening.sql` skrifað (samsettir foreldralyklar, þátttakendur geta ekki gert sig að service, lesmerki bara fyrir sjálfan sig, réttindi á föllum). EKKI keyrt, sjá að neðan.
- **Verk 3:** `src/vinnubord/lib/` með týpum, stöðurökum (`status.ts`), síum (`filters.ts`) og framhaldsprompti (`continuation.ts`), með prófum.
- **Verk 4:** `lib/api.ts` og `hooks/useBoardData.ts`, borðið hlaðið í heild og realtime síað á `project_id`. Verkefnið metta stofnað (`74e926d8-f53a-42fc-8a83-c93ec405a6ae`) með þátttakendunum Heimi (H) og Árna (Á).
- **Verk 6:** upphleðslureglur (`upload.ts`), 50 MB þak, með prófum.
- **Verk 7:** Shell, leiðir (`/`, `/login`, `/auth/callback`, `/reset-password`, `/p/:slug`, `/p/:slug/stillingar`), þátttakendahlið, innskráning án nýskráningar. Gömlu síðurnar átta fóru.
- **Verk 8:** gamla Trello yfirborðið fjarlægt (`src/features/`, `src/runes/`, ónotaðar skrár í `src/shared/`, `supabase/functions/meta-*` úr repoinu), pakkar `@dnd-kit/*`, `@tiptap/*` og `@codesandbox/sandpack-react` farnir, ónotaðir i18n lyklar farnir úr `en.json` og `is.json`, CLAUDE.md endurskrifað.

Staðfesting: `npm run build` grænt, `npm run test` 36 próf græn.

## Hvað bíður

### Hjá Heimi

1. **Keyra 0002.** `supabase/migrations/0002_hg_rls_hardening.sql` er ekki keyrt. Heimir keyrir það í SQL editor í verkefni `czdjxtsjgughimlazdmu`. Skráin er ekki komin í git, hún fer inn þegar hún hefur verið keyrð. Án hennar getur þátttakandi bætt við þátttakendum með `is_service = true` og skrifað lesmerki fyrir aðra.
2. **Stofna service notanda fyrir Claude** í Supabase Auth dashboard. Netfang ákveður Heimir og það er skráð hér þegar það liggur fyrir: _ekki ákveðið_. Svo fær hann línu í `hg_participants` í metta með `is_service = true`.
3. **Fjarlægja `VITE_INVITE_CODE`** úr Vercel env. Það er ekki notað lengur (engin nýskráning).
4. **Gamla kerfið í Supabase** helst þar til Heimir eyðir því sjálfur: töflurnar `huginn_*` (nema `huginn_profiles`, sem `useProfile` les enn), bucket `huginn-attachments`, og edge functions `meta-oauth-complete` og `meta-publish` sem gætu enn verið deployaðar. Agent snertir þetta ekki.

### Verk sem eru ekki búin

- **Verk 2:** triggerar, atburðaskrá (`hg_events`), stimplun geranda, `closed_at` trigger og privat bucket `hg-files`. Fer í `0003_hg_triggers_storage.sql`. Bíður eftir að 0002 sé keyrt. Þangað til hverfa lokin verk ekki sjálfkrafa af borðinu (R15) og engir atburðir skrifast.
- **Verk 5:** `scripts/hg-smoke.mjs` (`ok 4/4`). Ekki skrifað. Þarf verk 2 og lykilorð Heimis í `HG_SMOKE_EMAIL` og `HG_SMOKE_PASSWORD`.

### Smokes sem bíða

- `node scripts/hg-smoke.mjs`: bíður verks 5.
- Í vafra, innskráður: Heimir opnar `/` og lendir á `/p/metta`, teljararnir birtast, `/p/metta/stillingar` sýnir biðsíðu, notandi sem er ekki þátttakandi fær `NoAccessPage`, endurstilling lykilorðs fer á `/` í lokin. Bíður þess að Heimir prófi með sínu lykilorði.
- SQL próf verks 2 (spurningu svarað færir `waiting_on` á service notandann): bíður verks 2 og service notandans.

## Næst

Plan 2 (borðið): `docs/superpowers/plans/2026-10-31-vinnubord-2-bord.md`, í nýrri Opus lotu í `D:\Claude Code\Huginn\huginn`. Plan 3 (skipanalínutól og `/huginn`) og plan 4 (skyndigreining) koma á eftir.
