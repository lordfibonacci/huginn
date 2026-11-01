# 04 Vinnuborð: skyndigreining (plan 4)

Dagsetning: 2026-11-01
Grein: `vinnubord-4` (HEAD `2ae5f43` þegar skráin var skrifuð, ekki sameinuð, ekki ýtt). metta2_new hliðin: grein `huginn-bundle` (`f705f82f`), ekki sameinuð.
Plan: `docs/superpowers/plans/2026-10-31-vinnubord-4-skyndigreining.md`
Spekk: `docs/superpowers/specs/2026-10-31-huginn-vinnubord-design.md` (kafli 7.3)

Staða: kóðinn er búinn, yfirfarinn og edge function er í loftinu. **Lifandi prófin (handpróf) hafa ekki verið keyrð**, því Heimir hefur ekki sett secrets. Þar til bæði Vault gildin eru til gera triggerarnir ekkert.

## Hvað var gert

### Flæðið frá enda til enda

1. Triggerar úr `0007_hg_analyse` senda pg_net POST `{ item_id }` á edge function `hg-analyse` þegar verk er stofnað með stöðuna `new` og þegar skrá lendir á verki sem er enn `new`. Slóðin og bearer leyndarmálið koma úr Vault (`hg_analyse_url`, `hg_analyse_secret`).
2. Functionin sannreynir bearer, svarar 202 strax og vinnur í bakgrunni með `EdgeRuntime.waitUntil`. Fyrst bíður hún 20 s (debounce), svo spec og skrár sem koma rétt á eftir verkinu lenda í einni greiningu.
3. Hún skráir sig inn sem Claude þjónustunotandinn (anon lykill og lykilorð, enginn service role lykill), svo RLS og stimpiltriggerarnir gilda.
4. Hún les verkið. Sleppt (aðeins console.log) ef það finnst ekki, er ekki lengur `new`, eða var stofnað af þjónustunotandanum sjálfum (R28: verk Claude Code úr CLI eru þegar greind).
5. Lás: `hg_claim_analysis` tekur lás í 2 mínútur með einni atómískri uppfærslu (aðeins ef staðan er `new` og lásinn laus). Falsk niðurstaða þýðir að önnur keyrsla á verkið og þessi hættir.
6. Skrár: aðeins html, md og txt undir 2 MB eru lesnar, hver klippt við 400 KB, og heildartexti er takmarkaður við 1 MB (`MAX_TOTAL_TEXT_BYTES`). Skrá umfram þakið fer inn sem nafn og stærð með athugasemd um þakið. Skrá er aðeins sótt ef Storage slóðin er nákvæmlega `<verkefni>/<verk>/<nafn>` með leyfðum stöfum (A til Z, a til z, 0 til 9, punktur, undirstrik, bandstrik) og verkefnið og verkið eru þau sem greiningin snýst um.
7. Samhengi: `context_bundle` verkefnisins, módúlar (id, slug, nafn, stöðulína) og þátttakendur.
8. Kall á Claude API: `claude-opus-5-5` gegnum `npm:@anthropic-ai/sdk`, strangt tól (`strict: true`) með `tool_choice: auto`, `effort: medium`, `max_tokens` 16000, timeout 90 s, engar endurtilraunir.
9. Samruni (`mergeIntoItem`): texti höfundar helst orðrétt undir `## Upprunalegur texti`, módúll og merki höfundar ráða, merki líkansins bætast aftan við. `óflokkað` bætist aðeins við ef verkið hafði engan módúl og líkanið fann engan.
10. Skrifað með tvöfaldri hlið: uppfærslan krefst `status = 'new'` og óbreytts `updated_at` frá því verkið var lesið. Ef engin lína breytist les functionin verkið aftur einu sinni og sameinar aftur ef það er enn `new`. Misheppnist það líka, eða sé verkið farið úr `new`, er sleppt: engar spurningar og enginn atburður.
11. Eftir vel heppnað skrif: staðan fer í `waiting` hjá Heimi (`waiting_on` = H), `analysed_at` er sett, lásinn hreinsaður, spurningar skrifaðar (`asked_to` eftir skammstöfun) og atburðurinn `analysis.done` skráður með `hg_log_analysis` (model, skráarnöfn, `unmatchedModule`, `input_tokens`, `output_tokens`).
12. Bilun: `analysis.failed` með `error` og `stage` (`before_write`, `questions` eða `event`), lásinn losaður, staðan óbreytt. Saga verksins sýnir báða atburðina og bilunin birtir ástæðuna.

Skip eru aðeins í console (R15), ekki í sögunni.

### metta2_new hliðin

- `scripts/huginn-bundle.mjs` byggir búntinn og `npm run huginn:bundle -- --out <skrá>` skrifar hann í skrá. SKILL skref 9 í `/huginn` lotulokum keyrir það og ýtir með `huginn bundle push --file`.
- Fyrsta búntið var ýtt lifandi 2026-10-31: 53 200 bæti, `context_bundle_at` færðist.

### Skrár

- `supabase/functions/hg-analyse/index.ts` (Deno inngangur), `lib.ts` (hrein föll og `SYSTEM_PROMPT`, enginn innflutningur, ekkert Deno), `lib.test.ts`.
- Kerfisfyrirmælin eru `SYSTEM_PROMPT` í `lib.ts` (R1), ekki `prompt.md`.
- `src/vinnubord/lib/history.ts` fær merki fyrir `analysis.done` og `analysis.failed`, bilunin með ástæðu.
- `vitest.config.ts` nær nú líka yfir `supabase/functions/**/*.test.ts`.

## Migration 0007_hg_analyse

Beitt gegnum MCP 2026-10-31. Inniheldur:

- Dálkana `analysed_at` og `analyse_lock_until` á `hg_items`.
- `hg_touch_updated_at` endurskilgreint svo lásbreyting ein sér heldur `updated_at` og `updated_by` (eins og drag) og merkir ekkert sem ólesið.
- `hg_claim_analysis(p_item)` (security invoker, skilar boolean). Lásinn er losaður með venjulegri uppfærslu á dálkinum.
- `hg_log_analysis(p_item, p_kind, p_data)` (security definer): aðeins þjónustuþátttakandi verkefnisins, aðeins `analysis.done` og `analysis.failed`. Execute aðeins fyrir `authenticated`.
- `hg_enqueue_analyse()` (security definer) og triggerana `hg_items_analyse_trg` og `hg_files_analyse_trg` (after insert). Les Vault, gerir ekkert ef annað gildið vantar, og villa í pg_net er aðeins viðvörun, hún stöðvar aldrei innsetningu.

## Secrets (aðeins nöfn, aldrei gildi)

Edge secrets (Dashboard, Edge Functions, Secrets):

| Nafn | Hlutverk |
|---|---|
| `HG_ANALYSE_SECRET` | bearer sem triggerarnir senda |
| `HG_SERVICE_EMAIL` | netfang Claude þjónustunotandans |
| `HG_SERVICE_PASSWORD` | lykilorð hans |
| `HG_ANTHROPIC_API_KEY` eða `ANTHROPIC_API_KEY` | API lykill. `HG_ANTHROPIC_API_KEY` vinnur ef hann er ekki tómur. Breyttu aldrei `ANTHROPIC_API_KEY`, hann gæti verið sameiginlegur öðrum functions á verkefninu. |

Vault (SQL editor):

| Nafn | Gildi |
|---|---|
| `hg_analyse_secret` | sami strengur og `HG_ANALYSE_SECRET` |
| `hg_analyse_url` | `https://czdjxtsjgughimlazdmu.supabase.co/functions/v1/hg-analyse` |

**Staðan 2026-11-01: ekkert af þessu er sett.** MCP tengillinn neitaði að skrifa secrets, svo þetta er hjá Heimi. Triggerarnir gera ekkert fyrr en báðar Vault færslurnar eru til. Functionin er deployed (`verify_jwt` slökkt, hún sannreynir bearer sjálf): GET gefur 405 og POST án secret gefur 500 `HG_ANALYSE_SECRET is not set`.

### Skref hjá Heimi

1. Búðu til langan slembistreng. Hann er bæði `HG_ANALYSE_SECRET` og Vault gildið.
2. Supabase Dashboard, Edge Functions, Secrets: bættu við `HG_ANALYSE_SECRET`, `HG_SERVICE_EMAIL`, `HG_SERVICE_PASSWORD` og API lykli (`HG_ANTHROPIC_API_KEY` er öruggasta nafnið).
3. SQL editor, sama strenginn í fyrri línunni og í `HG_ANALYSE_SECRET`:

```sql
select vault.create_secret('<sami strengur og HG_ANALYSE_SECRET>', 'hg_analyse_secret');
select vault.create_secret('https://czdjxtsjgughimlazdmu.supabase.co/functions/v1/hg-analyse', 'hg_analyse_url');
```

4. Segðu Claude að handprófin megi hefjast.

## Handpróf (öll óunnin)

Skilyrði: secrets og Vault eins og að ofan. Prófverk heita "Prófun: " og eru sett í `dropped` á eftir, engu er eytt. Fylgstu með Edge Function logs á `hg-analyse`.

- **A, vefverk með md spec:** stofna verk í vefnum með md skrá. Innan 90 s: samantekt, lýsing, merki, módúll, staðan Bíður hjá Heimi, spurningar og atburðurinn `analysis.done` í sögunni. Staðfesta líka línu í `net._http_response` með status 202.
- **B, staða breytt strax:** stofna verk og strax `huginn item set <id> --status waiting`. Functionin sleppir (logs sýna skipped), engin greining og engar spurningar.
- **C, vitlaus API lykill:** setja `HG_ANTHROPIC_API_KEY` á ógilt gildi og stofna verk. Búist við `analysis.failed` með ástæðu í sögunni og stöðunni áfram `new`. Setja svo `HG_ANTHROPIC_API_KEY` á tómt gildi, þá er `ANTHROPIC_API_KEY` notaður aftur. Ekki snerta `ANTHROPIC_API_KEY`.
- **D, tvær skrár með 5 s millibili:** ein `analysis.done`, ekki tvær.
- **E, tvö verk með 60 s millibili:** bæði greind. Skoða logs eftir `beforeunload` línunni (sýnir hvort worker var drepinn með keyrslu í gangi).
- **F, breyta lýsingu 30 s eftir stofnun verks:** breytingin lifir undir `Upprunalegur texti` (hliðin á `updated_at` virkar).
- **Verk 3 skref 3, búntið:** verk um módúl sem aðeins búntið þekkir, t.d. "Askur kælirennur". Greiningin á að nota búntið. Setja verkið í `dropped` á eftir.

### Kostnaður per greiningu

Mæla á þremur prófverkum úr `input_tokens` og `output_tokens` í `data` á `analysis.done`. Verð `claude-opus-5-5`: 4 USD á milljón inntakstákn, 20 USD á milljón úttakstákn.

| Prófverk | input_tokens | output_tokens | USD |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| Meðaltal | | | |

## Úrskurðir sem skipta máli

Allir R1 til R30 eru í `.superpowers/sdd/2026-10-31-vinnubord-4-skyndigreining/progress.md` (gitignored). Helstu:

- **R1:** kerfisfyrirmælin eru `SYSTEM_PROMPT` í `lib.ts`, ekki `prompt.md`, svo functionin er tvær skrár án skráarlesturs.
- **R4:** URL og bearer úr Vault, ekki `alter database set`. Triggerinn gerir ekkert án þeirra.
- **R5:** 202 strax, vinnan í `EdgeRuntime.waitUntil`, `verify_jwt` slökkt.
- **R6:** innskráning sem Claude þjónustunotandi, enginn service role lykill.
- **R10:** `HG_ANTHROPIC_API_KEY` vinnur, `ANTHROPIC_API_KEY` er aldrei breyttur.
- **R11:** timeout 90 s, ekki 60. 20 s bið plús 90 s plús skrif er innan 150 s.
- **R17:** `claude-opus-5-5` hafnar fastri `tool_choice`, svo `auto` með ströngu tóli. Svar án tólkalls er `analysis.failed`.
- **R18:** SDK með `maxRetries: 0`, `effort: medium`, `max_tokens` 16000 því hugsunartákn telja með.
- **R19:** engin sjálfvirk varaleið við synjun. Hún verður `analysis.failed` og verkið bíður Claude Code.
- **R24:** texti höfundar er aldrei yfirskrifaður, hann færist undir `## Upprunalegur texti`.
- **R25:** módúll og merki höfundar ráða.
- **R26 og R27:** skrá er aðeins sótt ef slóðin er nákvæmlega `<verkefni>/<verk>/<nafn>` í verkefni verksins, annars aðeins á listanum (öryggisyfirferð, confused deputy).
- **R28:** verk stofnuð af þjónustunotandanum eru ekki greind. Verk Árna úr hans eigin CLI eru það.
- **R29:** seinar skrár og pg_cron sweeper eru v1 mörk (sjá næsta kafla).

## Þekkt mörk í v1

- **Seinar skrár:** skrá sem lendir eftir að keyrslan hefur tekið lásinn, eða meira en 20 s eftir verkið, er aldrei greind.
- **Worker drepinn:** 150 s veggklukka á frjálsa planinu getur drepið keyrslu sem heldur lásnum. Verkið er þá áfram `new`, enginn atburður kemur á borðið, aðeins `beforeunload` lína í console.
- **Tvöfalt misheppnað skrif:** ef bæði skrifin í hliðinni missa (önnur breyting á millisekúndum) er verkið áfram `new` án atburðar og lásinn bíður þar til hann rennur út.
- **Hlutabilun eftir hliðina:** verkið er `waiting` en `analysis.failed` fylgir með `stage` `questions` eða `event`.
- **Ein lykilorðsinnskráning á hverja POST:** margar skrár í einu eða verk í massa geta rekist á takmörk á innskráningum.
- **`npm run smoke:hg`** sendir eina pg_net POST í hverri keyrslu (greiningin sleppir henni).
- **`beforeunload` slóðin** getur misst auðkenni verks þegar síðari sleppt keyrsla á sama worker eyðir því úr menginu (parkerað, aðeins greining).
- **Eftirfylgni:** pg_cron sweeper sem sendir aftur verk sem eru enn `new` með `analysed_at` tómt eftir 3 mínútur.

## Hvað bíður

1. **Handprófin** hér að ofan, eftir að Heimir setur secrets.
2. **Pro áskrift** fyrir vídeó.
3. **Claude Code hjá Árna** (uppsetning í `03-vinnubord-cli.md`).
4. **Útlitsumferðir Heimis.**
5. **Eyðing `huginn_` taflna og `huginn-attachments` bucket** (handvirkt hjá Heimi, nema `huginn_profiles` sem verður að vera).
6. **Sameining `vinnubord-4` í main og push** eftir að handprófin standast. Grein `huginn-bundle` í metta2_new sameinast með.

## Staðfesting

- `npm run test`: 423 próf græn. `npm run build`: grænt.
- `npx -y deno@2 check --no-lock --node-modules-dir=none supabase/functions/hg-analyse/index.ts`: grænt.
- Yfirferðir: Task 2a (tveir lagfæringarhringir), heildaryfirferð á Fable ("Ready after fixes"), lagfæringaralda F1 til F7 og endurskoðun hennar kom hrein.
- Lifandi: functionin svarar GET 405 og POST án secret 500. Engin handpróf ennþá.
