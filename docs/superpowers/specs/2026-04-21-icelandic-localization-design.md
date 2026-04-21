# Icelandic Localization — Design

**Date:** 2026-04-21
**Status:** Approved for implementation planning
**Author:** Heimir + Claude

## Summary

Add Icelandic as the default UI language for Huginn (landing page + authenticated app), with English as a secondary language and fallback. Translations are generated once via Google Gemini 3 Pro through the OpenRouter API, shipped as static JSON in the repo, and loaded at runtime via `react-i18next`. User-generated content (card titles, comments, board names) is not translated.

## Goals

- Every static UI string on the landing page and inside the app is available in Icelandic and English.
- New users land on Icelandic by default; switching to English is one click and persists across devices.
- Translations are reproducible: running the translation script again produces the same output for unchanged keys and only translates new/changed keys.
- Non-Icelandic speakers (English-locale browsers) get English automatically without needing to switch.

## Non-goals (v1)

- Translating user-generated content (card titles, comments, attachments, board names, labels).
- Languages beyond Icelandic and English. The file layout supports adding more later, but none are in scope now.
- Per-card or per-project language tags.
- RTL support (not needed for `is` or `en`).
- Server-side rendering of translations (Huginn is a pure SPA/PWA).

## Approach

**Extract-and-translate at build time, bundle JSON at runtime.**

1. Extract every user-facing string from the codebase into `en.json`, the source of truth.
2. Run a one-shot translation script (`scripts/translate-is.mjs`) that calls OpenRouter's Gemini 3 Pro endpoint with the English source and writes `is.json`.
3. Both JSON files are imported by `react-i18next` at app boot. Translations are tree-shaken into the main bundle, no network calls at runtime, works offline (PWA).

Rejected alternative: **runtime translation via LLM** — too slow, flaky offline, high per-user cost, no QA gate.

## Architecture

### Libraries

- `i18next` — core i18n engine.
- `react-i18next` — React hooks (`useTranslation`) and `<Trans>` component.
- `i18next-browser-languagedetector` — reads `navigator.language` and localStorage.

No backend plugin. JSON is imported directly so Vite bundles it and the PWA service worker caches it.

### File layout

```
src/shared/i18n/
├── index.ts              # i18next init + exports `i18n`
└── locales/
    ├── en.json           # source of truth, hand-maintained
    └── is.json           # Gemini output, human-reviewable before commit

scripts/
├── extract-strings.md    # (doc) manual extraction checklist per feature
└── translate-is.mjs      # Node script: en.json → Gemini → is.json
```

No typed-keys codegen in v1 — if key drift becomes a problem later we can add `i18next-typescript` or similar.

### Key naming

Flat JSON with dot-paths, namespaced by feature:

```
landing.hero.title
landing.hero.subtitle
auth.login.submit
auth.signup.inviteCodeLabel
toolbar.switchProject
projects.empty.cta
board.list.addCard
card.checklist.add
card.members.addMember
settings.account.signOut
toasts.cardMoved
errors.network.generic
```

One `useTranslation()` call per component; keys referenced as `t('landing.hero.title')`.

## Runtime behavior

### Language resolution order

On every boot, resolve active language in this order:

1. **`huginn_profiles.locale`** — if authenticated and the column has a value.
2. **`localStorage.huginn.lang`** — for unauthenticated users or before profile loads.
3. **`navigator.language`** — if starts with `en`, use English; otherwise Icelandic.
4. **Fallback:** Icelandic (`is`).

### Language switcher

- Lives in `AccountMenu` (toolbar avatar dropdown) and `AccountSettingsDrawer`.
- Two options: **Íslenska** / **English** (each shown in their own language, not translated).
- On change:
  1. `i18n.changeLanguage(lang)`
  2. `localStorage.setItem('huginn.lang', lang)`
  3. If authenticated, `update huginn_profiles set locale = lang where id = auth.uid()`
  4. `document.documentElement.lang = lang`

### `<html lang>` attribute

Updated on every language change for SEO and screen-reader correctness.

## Translation pipeline

### Extraction

Done **semi-manually, one feature at a time**, rather than AST-walked. Each PR in the implementation plan covers one slice (landing, auth, toolbar, projects list, board/lists, card popup, settings, toasts/errors). Process per slice:

1. Read the component.
2. Replace each hardcoded user-facing string with `t('feature.scope.key')`.
3. Add the English source to `en.json` under the corresponding path.
4. If the string uses dynamic data, use i18next interpolation: `t('card.checklist.completedCount', { done, total })` with source `"{{done}} of {{total}} done"`.

After all slices are done, run a grep sweep to catch stragglers:
- `>[A-Z][a-z]` inside JSX (visible text)
- Attribute strings: `placeholder=`, `aria-label=`, `title=`, `alt=`
- `toast.` / `alert(` / `throw new Error(` calls with user-visible messages

### Translation script

**File:** `scripts/translate-is.mjs` (Node, ES modules).

**Input:** `src/shared/i18n/locales/en.json`.
**Output:** `src/shared/i18n/locales/is.json`.

**Steps:**

1. Load `.env` via `dotenv`. Read `OPEN_ROUTER_API`.
2. Load `en.json` and existing `is.json` (if present).
3. Flatten both. For each English key:
   - Compute hash of the English value.
   - If `is.json` already has a translation AND the cached hash matches the current English hash, reuse the existing translation. Skip.
   - Otherwise, mark for re-translation.
4. Chunk pending keys into batches of ~50.
5. For each batch, POST to `https://openrouter.ai/api/v1/chat/completions`:
   - Model: `google/gemini-3-pro-preview` (verify exact ID via OpenRouter's `/api/v1/models` before first run).
   - System prompt:
     > "You translate SaaS UI strings from English to Icelandic. Input is JSON mapping keys to English source strings. Output valid JSON with the same keys mapped to natural Icelandic translations. Preserve `{{variable}}` interpolations exactly. The brand name 'Huginn' stays in English. Keep translations concise to fit UI; match the casual-professional tone of the source. Return only JSON, no prose."
   - `response_format: { type: "json_object" }` to force clean JSON.
6. Merge batch outputs. Store each translation alongside its source-hash as `{ "landing.hero.title": { "value": "…", "hash": "abc…" } }` in an internal cache file (`is.json.cache`), then flatten to the pure-value `is.json` for runtime.
7. Log any batch failures; do NOT overwrite existing `is.json` on failure.
8. On success, write `is.json` pretty-printed (2-space indent, keys sorted) for clean git diffs.

**Usage:** `node scripts/translate-is.mjs` (add to `package.json` as `npm run translate`).

## Data model

### Supabase migration

```sql
alter table huginn_profiles
  add column locale text default 'is';
```

- Nullable (treated as "unset" → fall through to next resolution step).
- No CHECK constraint yet. Valid values: `is`, `en`. Adding more languages later is an app-level change, not a schema change.
- Existing RLS on `huginn_profiles` already restricts row access to the owning user — no new policy needed.

## Locale-aware formatting

`src/shared/lib/dateUtils.ts` becomes locale-aware:

- `formatDate(date)` → `Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })`.
  - English: `Apr 21, 2026`
  - Icelandic: `21. apr. 2026`
- `formatRelative(date)` → `Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })` → `"2 klst. síðan"` in Icelandic, `"2 hours ago"` in English.
- First day of week: Monday for both locales (Icelandic convention; CalendarView already supports this).

## Brand handling

- **"Huginn"** — never translated.
- **"Inbox"** — translates to **"Pósthólf"** (or a tighter alternative if Gemini proposes one — reviewer picks).
- **"Project" (the Trello-style board)** — translates to **"Verkefni"**.
- **"Board"** — not used in UI copy anymore (renamed to "project"), but any stragglers → **"Tafla"**.
- Any other brand/product terminology that should stay English is marked in `en.json` with a `// keep-english` inline comment that the translator prompt picks up (implementation detail: we strip comments before sending but note the key in a "do not translate" list).

## Testing approach

No automated i18n tests in v1 (consistent with the rest of the codebase — no tests yet). Manual QA checklist per feature slice:

- Switch language in `AccountMenu`, reload, confirm persistence.
- Check every screen in Icelandic and English.
- Confirm date formatting matches locale.
- Confirm `{{variable}}` interpolations render correctly in both languages.
- Confirm untranslated strings fall back to English (not key names).

## Rollout

1. Implementation PRs land behind the existing branch (no feature flag — the library and keys ship progressively; each slice that converts to `t('…')` is immediately bilingual).
2. First user-visible milestone: landing page + auth flow in both languages.
3. Full app bilingual before announcing.
4. No downtime or data migration risk — schema change is additive-nullable.

## Risks and mitigations

- **Gemini produces awkward or wrong translations.** Mitigation: `is.json` is human-reviewable before commit. Marketing copy (landing page) gets a specific review pass. Script preserves existing translations unless source changed.
- **Key drift — typo in `t('key')` silently renders the key.** Mitigation: react-i18next's `missingKeyHandler` logs to console in dev; post-implementation grep sweep for string literals inside `t(...)` that don't exist in `en.json`.
- **Adding new English strings after translation is done.** Mitigation: the script is idempotent — re-running only translates new keys.
- **OpenRouter model availability / naming drift.** Mitigation: script verifies the model ID via `/api/v1/models` before the first batch; prints a clear error if `google/gemini-3-pro-preview` isn't available and lets the operator pick from a list.
- **Icelandic text is often longer than English.** Mitigation: test in the UI during the slice PR; adjust layout (flex wrap, truncation) as needed.

## Out of scope (future work)

- Additional languages.
- Per-user date-format overrides (e.g. American `MM/DD`).
- Localized email templates (Supabase auth emails).
- Translating inbound voice transcripts.
