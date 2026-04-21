# Icelandic Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Icelandic as the default UI language for Huginn (landing + app), with English as fallback. Translations generated once via Gemini 3 Pro through OpenRouter, shipped as static JSON loaded by react-i18next at runtime.

**Architecture:** `react-i18next` + `i18next` + language detector. Two locale JSON files (`en.json`, `is.json`) imported directly — bundled by Vite, cached by the PWA service worker. A Node script (`scripts/translate-is.mjs`) calls OpenRouter to generate `is.json` from `en.json`; idempotent via per-key source hashing. Language resolution: user profile → localStorage → `navigator.language` → Icelandic default. Language switcher in `AccountMenu`; preference persisted to a new `huginn_profiles.locale` column.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind v4, Supabase, i18next, react-i18next, i18next-browser-languagedetector, OpenRouter (Gemini 3 Pro), dotenv, node:crypto.

**Spec:** `docs/superpowers/specs/2026-04-21-icelandic-localization-design.md`

**Note on testing:** Huginn has no automated test suite (see `CLAUDE.md`). Verification in this plan uses the dev server (`npm run dev`) and manual UI checks. Do not introduce Jest/Vitest for this feature — stay consistent with the codebase.

**Commit convention:** `feat:`, `fix:`, `refactor:`, `docs:`. Every commit ends with:
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Phase 1 — Infrastructure

### Task 1: Install i18n dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto)

- [ ] **Step 1: Install runtime deps**

Run:
```bash
npm install i18next@^23 react-i18next@^15 i18next-browser-languagedetector@^8
```

Expected: installs succeed, `package.json` `dependencies` gains three new lines, no peer-dep warnings from React 19 (these versions support it).

- [ ] **Step 2: Install dev deps for the translate script**

Run:
```bash
npm install --save-dev dotenv@^16
```

Expected: `dotenv` added to `devDependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat: add i18next, react-i18next, dotenv for localization

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Scaffold i18n module and empty locale files

**Files:**
- Create: `src/shared/i18n/index.ts`
- Create: `src/shared/i18n/locales/en.json`
- Create: `src/shared/i18n/locales/is.json`

- [ ] **Step 1: Create `src/shared/i18n/locales/en.json`**

```json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "close": "Close",
    "loading": "Loading…"
  }
}
```

- [ ] **Step 2: Create `src/shared/i18n/locales/is.json`**

```json
{
  "common": {
    "cancel": "Hætta við",
    "save": "Vista",
    "delete": "Eyða",
    "edit": "Breyta",
    "close": "Loka",
    "loading": "Hleð…"
  }
}
```

These six seeded keys let us verify the pipeline end-to-end before writing the translation script. Gemini fills in the rest.

- [ ] **Step 3: Create `src/shared/i18n/index.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import is from './locales/is.json'

export const SUPPORTED_LANGUAGES = ['is', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<Language, string> = {
  is: 'Íslenska',
  en: 'English',
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      is: { translation: is },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'huginn.lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    load: 'languageOnly',
  })

// Override detector: if no explicit choice, prefer Icelandic over English
// unless the browser explicitly says English.
const stored = localStorage.getItem('huginn.lang')
if (!stored) {
  const nav = (navigator.language || '').toLowerCase()
  const preferred: Language = nav.startsWith('en') ? 'en' : 'is'
  i18n.changeLanguage(preferred)
}

// Keep <html lang> in sync
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

export default i18n
```

- [ ] **Step 4: Import i18n in `src/main.tsx`**

Modify `src/main.tsx` to:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shared/i18n'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Verify build**

Run:
```bash
npm run build
```

Expected: builds cleanly with no TS errors. If TS complains about JSON imports, add `"resolveJsonModule": true` to `tsconfig.app.json` `compilerOptions` (it should already be default in Vite projects — verify by reading the file first; do NOT flip other options).

- [ ] **Step 6: Verify runtime**

Run:
```bash
npm run dev
```

Open `http://localhost:5173`. Open devtools → Application → Local Storage. Manually set `huginn.lang` to `is`, reload. `<html lang="is">` should appear in the DOM inspector. Set to `en`, reload. `<html lang="en">`.

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/shared/i18n
git commit -m "$(cat <<'EOF'
feat: wire up i18next with is/en locales, icelandic default

Adds react-i18next with language-only detection (localStorage →
navigator). Icelandic is the default when the browser locale is
not English. Updates <html lang> on language change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add `locale` column to `huginn_profiles`

**Files:**
- No repo files; Supabase migration applied via MCP.

- [ ] **Step 1: Apply migration via the Supabase MCP tool**

Use `mcp__claude_ai_Supabase__apply_migration` with:

- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `add_locale_to_huginn_profiles`
- `query`:
  ```sql
  alter table public.huginn_profiles
    add column if not exists locale text;
  ```

Expected: migration applies without error. We intentionally do NOT set a default — `null` means "unset, fall through to client detection". The app treats `null` as Icelandic for new users; existing users keep whatever the client detector picks.

- [ ] **Step 2: Verify column exists**

Use `mcp__claude_ai_Supabase__execute_sql`:
```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'huginn_profiles'
  and column_name = 'locale';
```

Expected: one row returned, `data_type = text`, `is_nullable = YES`, `column_default = NULL`.

- [ ] **Step 3: Update TypeScript `Profile` type**

Modify `src/shared/lib/types.ts` — change the `Profile` interface (currently at `src/shared/lib/types.ts:145-151`):

Replace:
```ts
export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  updated_at: string
}
```

With:
```ts
export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  locale: string | null
  updated_at: string
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
npm run build
```

Expected: succeeds. No downstream type errors (the field is nullable).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/types.ts
git commit -m "$(cat <<'EOF'
feat: add locale column to huginn_profiles

Nullable text column; null means "fall through to client detection".
Synced to Profile type so language switcher can persist preference.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Sync language preference with profile

**Files:**
- Modify: `src/shared/hooks/useProfile.ts`
- Create: `src/shared/hooks/useLanguagePreference.ts`

- [ ] **Step 1: Extend `updateProfile` to accept locale**

Modify `src/shared/hooks/useProfile.ts`. Change the `updateProfile` signature:

Replace:
```ts
async function updateProfile(updates: { display_name?: string; avatar_url?: string }) {
```

With:
```ts
async function updateProfile(updates: { display_name?: string; avatar_url?: string; locale?: string }) {
```

(The rest of the function body stays the same — it already spreads `updates` into the update query.)

- [ ] **Step 2: Create `src/shared/hooks/useLanguagePreference.ts`**

```ts
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from './useProfile'
import type { Language } from '../i18n'
import { SUPPORTED_LANGUAGES } from '../i18n'

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

/**
 * Pulls language from the signed-in user's profile on mount,
 * and exposes a setter that persists to profile + localStorage + i18n.
 */
export function useLanguagePreference() {
  const { i18n } = useTranslation()
  const { profile, updateProfile } = useProfile()

  useEffect(() => {
    if (!profile?.locale) return
    if (!isLanguage(profile.locale)) return
    if (profile.locale === i18n.language) return
    i18n.changeLanguage(profile.locale)
  }, [profile?.locale, i18n])

  async function setLanguage(lang: Language) {
    await i18n.changeLanguage(lang)
    localStorage.setItem('huginn.lang', lang)
    if (profile) {
      await updateProfile({ locale: lang })
    }
  }

  return {
    language: (i18n.language as Language) ?? 'is',
    setLanguage,
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/shared/hooks/useProfile.ts src/shared/hooks/useLanguagePreference.ts
git commit -m "$(cat <<'EOF'
feat: useLanguagePreference hook syncs locale with profile

Pulls locale from profile on mount, exposes setter that writes to
i18n + localStorage + profile in one call.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Language switcher in `AccountMenu`

**Files:**
- Modify: `src/shared/components/AccountMenu.tsx`

- [ ] **Step 1: Add language toggle to the menu**

Modify `src/shared/components/AccountMenu.tsx`. Add imports near the existing imports:

```tsx
import { useLanguagePreference } from '../hooks/useLanguagePreference'
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../i18n'
```

Inside the component, add after the existing `useProfile()` line:

```tsx
const { language, setLanguage } = useLanguagePreference()
```

Then, inside the popover's inner `<div className="p-1">` block, AFTER the `<Link to="/settings">` block and BEFORE the `<button onClick={handleSignOut}>` block, add a language sub-section. Replace the entire `<div className="p-1">…</div>` block (lines 84-107) with:

```tsx
<div className="p-1">
  <Link
    to="/settings"
    onClick={() => setOpen(false)}
    className="flex items-center gap-2.5 w-full text-left text-sm text-huginn-text-primary hover:bg-huginn-hover rounded-md px-2.5 py-2 transition-colors"
    role="menuitem"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-secondary">
      <path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 0 1 .804.98v1.362a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.294 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.294A1 1 0 0 1 1 11.36V9.998a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.38 3.708l1.25.834a6.957 6.957 0 0 1 1.416-.587l.294-1.473ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
    </svg>
    {t('account.menu.settings')}
  </Link>

  <div className="my-1 h-px bg-huginn-border/60" />

  <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-huginn-text-muted">
    {t('account.menu.language')}
  </div>
  {SUPPORTED_LANGUAGES.map((lang) => (
    <button
      key={lang}
      onClick={() => setLanguage(lang)}
      className={`flex items-center justify-between w-full text-left text-sm rounded-md px-2.5 py-1.5 transition-colors ${
        language === lang
          ? 'bg-huginn-accent-soft text-white'
          : 'text-huginn-text-primary hover:bg-huginn-hover'
      }`}
      role="menuitemradio"
      aria-checked={language === lang}
    >
      {LANGUAGE_LABELS[lang]}
      {language === lang && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-accent">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  ))}

  <div className="my-1 h-px bg-huginn-border/60" />

  <button
    onClick={handleSignOut}
    className="flex items-center gap-2.5 w-full text-left text-sm text-huginn-text-primary hover:bg-huginn-hover rounded-md px-2.5 py-2 transition-colors"
    role="menuitem"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-huginn-text-secondary">
      <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.22-.53l-2.75-2.75a.75.75 0 0 0-1.06 1.06l1.47 1.47H8.75a.75.75 0 0 0 0 1.5h7.69l-1.47 1.47a.75.75 0 1 0 1.06 1.06l2.75-2.75A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
    </svg>
    {t('account.menu.signOut')}
  </button>
</div>
```

Also add at the top of the function body (above the `useEffect`):
```tsx
const { t } = useTranslation()
```

And add this import:
```tsx
import { useTranslation } from 'react-i18next'
```

- [ ] **Step 2: Add the new keys to `en.json`**

Modify `src/shared/i18n/locales/en.json` by adding an `account` block at the top level:

```json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "close": "Close",
    "loading": "Loading…"
  },
  "account": {
    "menu": {
      "settings": "Account settings",
      "language": "Language",
      "signOut": "Sign out"
    }
  }
}
```

- [ ] **Step 3: Add matching keys to `is.json`**

Modify `src/shared/i18n/locales/is.json`:

```json
{
  "common": {
    "cancel": "Hætta við",
    "save": "Vista",
    "delete": "Eyða",
    "edit": "Breyta",
    "close": "Loka",
    "loading": "Hleð…"
  },
  "account": {
    "menu": {
      "settings": "Stillingar reiknings",
      "language": "Tungumál",
      "signOut": "Skrá út"
    }
  }
}
```

- [ ] **Step 4: Verify in browser**

Run:
```bash
npm run dev
```

Sign in, click avatar, verify you see:
- "Account settings" / "Stillingar reiknings" (depending on current lang)
- "Language" / "Tungumál" header
- Two buttons: Íslenska, English — with a checkmark on the active one
- "Sign out" / "Skrá út"

Click Íslenska — UI should immediately show Icelandic strings; reload — still Icelandic (persisted to profile).

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/AccountMenu.tsx src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat: language switcher in AccountMenu

Two options (Íslenska / English), active one highlighted. Persists
to localStorage + profile. Converts AccountMenu strings to i18n keys.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Translation script

### Task 6: Build `scripts/translate-is.mjs`

**Files:**
- Create: `scripts/translate-is.mjs`
- Modify: `package.json` (new `translate` script)
- Modify: `.gitignore` (add cache file)

- [ ] **Step 1: Add the translate script to `package.json`**

Modify `package.json`. Add `"translate": "node scripts/translate-is.mjs"` inside the `"scripts"` object:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "brand": "node scripts/build-brand-assets.mjs",
  "translate": "node scripts/translate-is.mjs"
}
```

- [ ] **Step 2: Append cache file to `.gitignore`**

Modify `.gitignore` — add at the bottom:
```
# i18n translator cache (hash-indexed)
src/shared/i18n/locales/.is.cache.json
```

- [ ] **Step 3: Create `scripts/translate-is.mjs`**

```js
#!/usr/bin/env node
// Translate en.json → is.json via OpenRouter + Gemini 3 Pro.
// Idempotent: only re-translates keys whose English source hash changed.
//
// Usage:
//   node scripts/translate-is.mjs              # translate missing/changed
//   node scripts/translate-is.mjs --force      # retranslate everything
//   node scripts/translate-is.mjs --dry-run    # show what would be sent

import 'dotenv/config'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EN_PATH = resolve(ROOT, 'src/shared/i18n/locales/en.json')
const IS_PATH = resolve(ROOT, 'src/shared/i18n/locales/is.json')
const CACHE_PATH = resolve(ROOT, 'src/shared/i18n/locales/.is.cache.json')

const MODEL = 'google/gemini-2.5-pro' // TODO: switch to gemini-3-pro-preview once available on OpenRouter
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const BATCH_SIZE = 40
const API_KEY = process.env.OPEN_ROUTER_API

if (!API_KEY) {
  console.error('✖ OPEN_ROUTER_API is not set in .env')
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')
const DRY_RUN = args.has('--dry-run')

const SYSTEM_PROMPT = `You translate SaaS UI strings from English to Icelandic for an app called Huginn.

Rules:
- Input is a JSON object: key → English source string.
- Output MUST be valid JSON with identical keys mapped to Icelandic translations.
- Preserve {{variable}} interpolations exactly — do not rename, do not translate inside {{...}}.
- Preserve any HTML-like tags (<strong>, <br/>, etc.) exactly.
- The brand name "Huginn" stays "Huginn".
- Use tone: casual-professional, concise, modern SaaS.
- Icelandic UI text: prefer short forms that fit buttons and labels. Inbox → "Pósthólf". Project → "Verkefni". Board → "Tafla". List → "Listi". Card → "Spjald". Settings → "Stillingar". Members → "Meðlimir". Labels → "Merkimiðar".
- Return ONLY the JSON object, no prose, no markdown fences.`

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

function unflatten(flat) {
  const out = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    let cur = out
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
      cur = cur[parts[i]]
    }
    cur[parts[parts.length - 1]] = value
  }
  return out
}

function sortKeysDeep(obj) {
  if (Array.isArray(obj) || obj === null || typeof obj !== 'object') return obj
  const sorted = {}
  for (const key of Object.keys(obj).sort()) sorted[key] = sortKeysDeep(obj[key])
  return sorted
}

function hash(s) {
  return createHash('sha1').update(s).digest('hex').slice(0, 10)
}

async function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback
  const raw = await readFile(path, 'utf8')
  return raw.trim() ? JSON.parse(raw) : fallback
}

async function translateBatch(batch) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      'HTTP-Referer': 'https://huginn.pro',
      'X-Title': 'Huginn localization',
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(batch, null, 2) },
      ],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${body}`)
  }
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error(`No content in response: ${JSON.stringify(json)}`)
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (err) {
    throw new Error(`Model did not return JSON: ${content.slice(0, 500)}`)
  }
  return parsed
}

async function main() {
  const en = await loadJson(EN_PATH, {})
  const existingIs = await loadJson(IS_PATH, {})
  const cache = await loadJson(CACHE_PATH, {}) // { key: { hash, value } }

  const enFlat = flatten(en)
  const isFlat = flatten(existingIs)

  const pending = {}
  let reused = 0

  for (const [key, enValue] of Object.entries(enFlat)) {
    const currentHash = hash(String(enValue))
    const cached = cache[key]
    const hasTranslation = key in isFlat

    if (!FORCE && hasTranslation && cached && cached.hash === currentHash) {
      reused++
      continue
    }
    pending[key] = enValue
  }

  console.log(`→ ${Object.keys(enFlat).length} total keys`)
  console.log(`→ ${reused} reused from cache`)
  console.log(`→ ${Object.keys(pending).length} to translate`)

  if (DRY_RUN) {
    console.log('(dry run) First 10 pending:', Object.fromEntries(Object.entries(pending).slice(0, 10)))
    return
  }

  if (Object.keys(pending).length === 0) {
    console.log('✓ Nothing to translate. is.json already up to date.')
    return
  }

  const keys = Object.keys(pending)
  const translated = { ...isFlat }
  const nextCache = { ...cache }

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const chunk = keys.slice(i, i + BATCH_SIZE)
    const input = Object.fromEntries(chunk.map((k) => [k, pending[k]]))
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(keys.length / BATCH_SIZE)} (${chunk.length} keys)…`)

    const output = await translateBatch(input)

    for (const k of chunk) {
      if (!(k in output)) {
        console.warn(`  ! missing key from model response: ${k} — keeping English as fallback`)
        translated[k] = pending[k]
        continue
      }
      translated[k] = String(output[k])
      nextCache[k] = { hash: hash(String(pending[k])), value: String(output[k]) }
    }
  }

  // Drop cache entries that no longer exist in en.json
  for (const k of Object.keys(nextCache)) {
    if (!(k in enFlat)) delete nextCache[k]
  }
  // Drop translations that no longer exist in en.json
  for (const k of Object.keys(translated)) {
    if (!(k in enFlat)) delete translated[k]
  }

  const finalIs = sortKeysDeep(unflatten(translated))
  const finalCache = sortKeysDeep(nextCache)

  await mkdir(dirname(IS_PATH), { recursive: true })
  await writeFile(IS_PATH, JSON.stringify(finalIs, null, 2) + '\n', 'utf8')
  await writeFile(CACHE_PATH, JSON.stringify(finalCache, null, 2) + '\n', 'utf8')

  console.log(`✓ wrote ${IS_PATH}`)
  console.log(`✓ wrote ${CACHE_PATH}`)
}

main().catch((err) => {
  console.error('✖ translation failed:', err.message)
  process.exit(1)
})
```

**Note:** we hard-code `google/gemini-2.5-pro` with a `TODO` comment to switch to `gemini-3-pro-preview`. In Step 4 we verify which IDs are actually live on OpenRouter and pick the best available.

- [ ] **Step 4: Verify OpenRouter model availability**

Run:
```bash
curl -s https://openrouter.ai/api/v1/models | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const m=JSON.parse(d).data.filter(x=>x.id.includes('gemini')&&(x.id.includes('pro')||x.id.includes('3')));console.log(m.map(x=>x.id).join('\n'))})"
```

Expected: a list of Gemini Pro model IDs. Look for (in order of preference):
1. `google/gemini-3-pro-preview`
2. `google/gemini-3-pro`
3. `google/gemini-2.5-pro`
4. `google/gemini-pro-1.5`

Update the `MODEL` constant in `scripts/translate-is.mjs` to the highest-ranked ID that appears. Remove the `TODO` comment once set.

- [ ] **Step 5: Dry-run the script**

Run:
```bash
npm run translate -- --dry-run
```

Expected output: something like
```
→ 9 total keys
→ 0 reused from cache
→ 9 to translate
(dry run) First 10 pending: { ... }
```

(9 keys = the 6 `common` + 3 `account.menu` we seeded, minus whatever is.json already has — so should be 0 actually. If `is.json` has all 9, you'll see `0 to translate`. Run with `--force` to force a full retranslate.)

- [ ] **Step 6: Run the script for real**

Run:
```bash
npm run translate -- --force
```

Expected: one batch executes, `is.json` is overwritten with model-translated values. `cat src/shared/i18n/locales/is.json` should show Icelandic strings that roughly match what we hand-seeded (maybe word-level differences — that's fine). Cache file `.is.cache.json` is created.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore scripts/translate-is.mjs src/shared/i18n/locales/is.json
git commit -m "$(cat <<'EOF'
feat: translate-is script generates is.json via OpenRouter

Flattens en.json, hashes per key, only re-translates changed/new
keys against google/gemini-<model> via OpenRouter. Idempotent, with
a local cache file (gitignored) to track source hashes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Extract strings, slice by slice

**Repeating process for every Phase 3 task:**

1. Open the target file(s). For each user-facing string (JSX text, `placeholder=`, `aria-label=`, `title=`, `alt=`, toast messages, error strings, button labels, empty-state copy):
   a. Add a namespaced key to `src/shared/i18n/locales/en.json`.
   b. Replace the string with `{t('feature.scope.key')}` (JSX) or `t('feature.scope.key')` (props/JS).
   c. For strings with dynamic data, use i18next interpolation: `t('key.with.name', { count: 3 })` with source `"{{count}} items"`.
2. Add `import { useTranslation } from 'react-i18next'` and `const { t } = useTranslation()` inside the component.
3. Run `npm run translate` to generate Icelandic for the new keys.
4. Run `npm run dev`, switch languages via `AccountMenu`, verify the slice renders correctly in both.
5. Commit the whole slice (component changes + both locale files).

**Don't** over-engineer keys. A string used once lives under `feature.scope.purpose`. Plurals use i18next's suffix convention: `card.counts_one`, `card.counts_other`. The translate script handles both because it flattens the whole object.

---

### Task 7: Landing page

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/shared/i18n/locales/en.json`
- Generated: `src/shared/i18n/locales/is.json`

- [ ] **Step 1: Extract all landing strings under `landing.*`**

Read the full file first:
```bash
# (use the Read tool, not cat)
```

Group keys by section: `landing.nav.*`, `landing.hero.*`, `landing.features.*`, `landing.demo.*`, `landing.cta.*`, `landing.footer.*`.

Replace each hardcoded string with `{t('landing.nav.signIn')}` etc. Add `import { useTranslation }` and `const { t } = useTranslation()` at the top.

For any string containing a `<strong>` or line break, use the `<Trans>` component:
```tsx
import { Trans } from 'react-i18next'
// ...
<Trans i18nKey="landing.hero.subtitle" components={{ strong: <strong /> }} />
```
And in `en.json`:
```json
"subtitle": "Capture with <strong>voice or text</strong>, triage into projects."
```

- [ ] **Step 2: Populate `en.json` under `landing.*`**

Add the extracted keys into `src/shared/i18n/locales/en.json`. Sort keys alphabetically within each nested object (the translator script sorts on output anyway).

- [ ] **Step 3: Run the translator**

```bash
npm run translate
```

Expected: "N to translate" where N equals the number of new landing keys. On success, `is.json` is updated.

- [ ] **Step 4: Review Icelandic output**

Open `src/shared/i18n/locales/is.json` and skim the new `landing.*` block. Marketing copy is the most sensitive — hand-edit any awkward phrases. For tagline/CTA polish, Heimir should do this pass himself.

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:5173` in Icelandic (clear localStorage first) — read through the whole landing page. Switch to English, read again. Verify no hardcoded strings remain (grep: `Grep` tool on `src/pages/LandingPage.tsx` for any plain-text children in JSX).

- [ ] **Step 6: Commit**

```bash
git add src/pages/LandingPage.tsx src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate landing page

All nav, hero, feature, demo, CTA, and footer copy moved to
landing.* keys. Icelandic generated via npm run translate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Auth pages — Login, Signup, Forgot, Reset, Callback

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/AuthCallbackPage.tsx`
- Modify: `src/pages/ResetPasswordPage.tsx`
- Modify: `src/shared/i18n/locales/en.json`
- Generated: `src/shared/i18n/locales/is.json`

- [ ] **Step 1: Extract all auth strings under `auth.*`**

Structure keys:
- `auth.login.*` — email/password fields, submit, forgot link, sign-up link
- `auth.signup.*` — fields + invite code + email-sent confirmation
- `auth.forgot.*` — reset request, success message
- `auth.reset.*` — new-password form
- `auth.callback.*` — "Confirming…", "Link expired", etc.
- `auth.errors.*` — specific Supabase error mappings (invalid credentials, email taken, invite code mismatch)

Replace strings, add `useTranslation` hook.

For dynamic error messages surfaced from Supabase: map known codes to keys, fall back to `t('auth.errors.generic')` for unknowns. Don't pass the raw Supabase error through `t(...)` — keep that as untranslated console output.

- [ ] **Step 2: Populate `en.json` under `auth.*`**

- [ ] **Step 3: Run translator**

```bash
npm run translate
```

- [ ] **Step 4: Review is.json — specifically the `auth.errors.*` block**

Error copy needs to be short, clear, and not accusatory in Icelandic. Hand-edit if needed.

- [ ] **Step 5: Verify in browser**

Open `/login` in both languages. Exercise:
- Sign-in with wrong password → error in current language
- Forgot password → success confirmation in current language
- Sign-up with wrong invite code → error

- [ ] **Step 6: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/AuthCallbackPage.tsx src/pages/ResetPasswordPage.tsx src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate auth flow (login/signup/forgot/reset/callback)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: ToolBar + BottomNav

**Files:**
- Modify: `src/shared/components/ToolBar.tsx`
- Modify: `src/shared/components/BottomNav.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Extract under `toolbar.*` and `bottomNav.*`**

Keys include: "Switch project", "Inbox", "Projects", "You", "Capture", tooltips, aria-labels.

- [ ] **Step 2: Run translator**

```bash
npm run translate
```

- [ ] **Step 3: Verify in browser (desktop + mobile viewport)**

Resize browser to mobile width to see `BottomNav`. Toggle languages — all labels + aria attributes update.

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/ToolBar.tsx src/shared/components/BottomNav.tsx src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate toolbar + bottom nav

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Projects list page + ProjectCard + PendingInvitesPanel

**Files:**
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/features/projects/components/ProjectCard.tsx`
- Modify: `src/features/projects/components/PendingInvitesPanel.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Extract under `projects.*`**

Keys: page title, "New project" button, empty state, "You've been invited to join {{projectName}}" (interpolation), accept/decline labels, project status chips.

- [ ] **Step 2: Run translator**

- [ ] **Step 3: Verify — including empty state (no projects) and pending invite state**

Test pending invite by having another account invite you (or manually insert a pending row via Supabase SQL).

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectsPage.tsx src/features/projects/components/ProjectCard.tsx src/features/projects/components/PendingInvitesPanel.tsx src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate projects list + pending invites

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Board view — BoardView, ListColumn, TaskCard

**Files:**
- Modify: `src/pages/ProjectDetailPage.tsx`
- Modify: `src/features/projects/components/BoardView.tsx`
- Modify: `src/features/projects/components/ListColumn.tsx`
- Modify: `src/features/projects/components/TaskCard.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Extract under `board.*` and `card.*`**

Keys: "Add a list", "Add another list", "Add a card", "Add another card", list-menu items (Copy / Archive), card-menu items, "Enter list title…", pluralized task counts.

For pluralized counts use i18next plural suffix:
- `"card.counts_one": "{{count}} task"`
- `"card.counts_other": "{{count}} tasks"`

Call: `t('card.counts', { count })`.

Icelandic requires `count_one` / `count_other` too — CLDR conventions differ from English on the `11`/`21` rules, but i18next handles it.

- [ ] **Step 2: Run translator**

The system prompt in `translate-is.mjs` already mentions preserving `{{count}}`. If Gemini returns `_other` missing, hand-add it.

- [ ] **Step 3: Verify — create a list, add cards, archive a list, verify all flows are localized**

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectDetailPage.tsx src/features/projects/components/BoardView.tsx src/features/projects/components/ListColumn.tsx src/features/projects/components/TaskCard.tsx src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate board view (lists + cards)

Pluralized task counts via i18next plural rules.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: CardPopup and its sub-components

**Files:**
- Modify: `src/features/projects/components/CardPopup.tsx`
- Modify: `src/features/projects/components/ChecklistSection.tsx`
- Modify: `src/features/projects/components/CommentSection.tsx`
- Modify: `src/features/projects/components/LabelPicker.tsx`
- Modify: `src/features/projects/components/LabelBadges.tsx`
- Modify: `src/features/projects/components/MemberPicker.tsx`
- Modify: `src/features/projects/components/MemberAvatars.tsx`
- Modify: `src/features/projects/components/DatePicker.tsx`
- Modify: `src/features/projects/components/MoveCardDialog.tsx`
- Modify: `src/features/projects/components/CardThreeDotMenu.tsx`
- Modify: `src/features/projects/components/RichTextEditor.tsx`
- Modify: `src/features/projects/components/BoardMembersDrawer.tsx`
- Modify: `src/features/projects/components/BoardMembersStack.tsx`
- Modify: `src/features/projects/components/CalendarView.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Extract under `card.*`, `checklist.*`, `comments.*`, `labels.*`, `members.*`, `dates.*`, `move.*`**

This is the biggest slice. Work through it component by component. Keys like:
- `card.description.placeholder`: "Add a more detailed description…"
- `checklist.newItemPlaceholder`: "Add an item…"
- `comments.placeholder`: "Write a comment…"
- `labels.picker.createNew`: "Create new label"
- `members.picker.invite`: "Invite by email"
- `dates.picker.noDueDate`: "No due date"
- `move.dialog.destinationList`: "Destination list"

For the activity feed action strings, use interpolation:
- `activity.attached`: "{{user}} attached {{name}}"
- `activity.moved`: "{{user}} moved this from {{from}} to {{to}}"

- [ ] **Step 2: Run translator**

Expect ~60-100 new keys. Watch for timeouts — the script batches by 40, so it'll issue 2-3 requests.

- [ ] **Step 3: Verify — open a card, use every feature**

Checklist, comments, labels, members, dates, attachments, move, cover, archive. Switch languages. Everything localized.

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/components src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate card popup and all sub-components

Checklist, comments, labels, members, dates, move dialog, activity
feed. Activity strings use {{user}}/{{name}} interpolation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Inbox page + InboxPanel + voice

**Files:**
- Modify: `src/pages/InboxPage.tsx`
- Modify: `src/features/inbox/components/InboxPanel.tsx`
- Modify: `src/features/inbox/components/VoiceButton.tsx`
- Modify: any remaining inbox components that render user-facing strings (ThoughtDetailDrawer, ClassifyDrawer, ThoughtCard — if still in use)
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Extract under `inbox.*`**

Keys: "Inbox" title, "Capture a thought…", voice tooltips ("Hold to record"), mic permission denied messages, "Move to project", empty-state "Your mind is clear".

- [ ] **Step 2: Run translator**

- [ ] **Step 3: Verify voice flow**

Hold the mic, speak, release — transcript placeholder and feedback text should both be Icelandic when in IS mode. Note: `useVoiceRecorder` passes `navigator.language` to the Web Speech API — verify that `is-IS` gives Icelandic transcription (it does; Chrome supports it).

- [ ] **Step 4: Commit**

```bash
git add src/pages/InboxPage.tsx src/features/inbox/components src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate inbox + voice capture

Speech recognition language derived from i18n.language so Icelandic
users dictate in Icelandic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Make voice recognition respect i18n language**

Modify `src/features/inbox/hooks/useVoiceRecorder.ts`. Find the line that sets `recognition.lang = navigator.language` (or similar). Replace it with:

```ts
import { useTranslation } from 'react-i18next'
// ...
const { i18n } = useTranslation()
// ...
recognition.lang = i18n.language === 'is' ? 'is-IS' : 'en-US'
```

(If the hook doesn't currently use `useTranslation`, add it and pass through `i18n.language`.)

Verify, then amend this change into the previous commit (or make a follow-up commit — either is fine, just don't leave it uncommitted).

---

### Task 14: Settings — ProjectSettingsDrawer, AccountSettings, AccountSettingsDrawer, SettingsPage

**Files:**
- Modify: `src/features/projects/components/ProjectSettingsDrawer.tsx`
- Modify: `src/features/projects/components/ProjectColorPicker.tsx`
- Modify: `src/features/projects/components/BoardBackgroundPicker.tsx`
- Modify: `src/shared/components/AccountSettings.tsx`
- Modify: `src/shared/components/AccountSettingsDrawer.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/shared/i18n/locales/en.json`

- [ ] **Step 1: Extract under `settings.*`**

Keys: section headings, color-preset labels, background-preset names (Default / Ocean / Sunset / ...), avatar upload copy, "Delete project" + confirmation copy, "Sign out everywhere".

Preset names: keep them as identifiers internally (don't translate the `id`), but translate the display label. E.g. `settings.background.presets.ocean` → "Ocean" / "Haf".

- [ ] **Step 2: Run translator**

- [ ] **Step 3: Verify in both drawers**

Open project settings, account settings (both the drawer and the `/settings` page). Every label localized, save/delete buttons localized.

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/components/ProjectSettingsDrawer.tsx src/features/projects/components/ProjectColorPicker.tsx src/features/projects/components/BoardBackgroundPicker.tsx src/shared/components/AccountSettings.tsx src/shared/components/AccountSettingsDrawer.tsx src/pages/SettingsPage.tsx src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): translate settings surfaces (project + account)

Board-background preset labels localized; preset IDs unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Locale-aware date formatting

**Files:**
- Modify: `src/shared/lib/dateUtils.ts`
- Modify: any call sites passing their own format strings (grep for `.toLocaleString` and `dateUtils`)

- [ ] **Step 1: Rewrite `dateUtils.ts` to use `Intl` with the current i18n language**

Replace the entire contents of `src/shared/lib/dateUtils.ts`:

```ts
import i18n from '../i18n'

function activeLocale(): string {
  const lang = i18n.language || 'is'
  return lang === 'is' ? 'is-IS' : 'en-US'
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'auto' })

  if (seconds < 60) {
    return i18n.t('dates.justNow')
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  return rtf.format(-days, 'day')
}

export function formatDueDate(dateString: string): { text: string; urgent: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateString + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { text: i18n.t('dates.overdue', { count: Math.abs(diffDays) }), urgent: true }
  }
  if (diffDays === 0) return { text: i18n.t('dates.dueToday'), urgent: true }
  if (diffDays === 1) return { text: i18n.t('dates.dueTomorrow'), urgent: false }
  if (diffDays <= 7) return { text: i18n.t('dates.dueInDays', { count: diffDays }), urgent: false }

  const formatter = new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'short' })
  return { text: i18n.t('dates.dueOn', { date: formatter.format(due) }), urgent: false }
}
```

- [ ] **Step 2: Add the new keys to `en.json` under `dates.*`**

```json
"dates": {
  "justNow": "just now",
  "overdue_one": "{{count}}d overdue",
  "overdue_other": "{{count}}d overdue",
  "dueToday": "due today",
  "dueTomorrow": "due tomorrow",
  "dueInDays_one": "due in {{count}}d",
  "dueInDays_other": "due in {{count}}d",
  "dueOn": "due {{date}}"
}
```

- [ ] **Step 3: Run translator**

Expected Icelandic equivalents (Gemini will produce; verify):
- `dates.justNow`: "rétt núna"
- `dates.overdue_one`: "{{count}}d eftir á áætlun"
- `dates.dueToday`: "á gjalddaga í dag"
- etc.

- [ ] **Step 4: Force re-render on language change**

Dates formatted outside React components (rare, but e.g. if any memoized values capture `timeAgo` output) may not update on language change. Audit call sites:

```bash
# use Grep tool with pattern "timeAgo|formatDueDate"
```

Any caller that caches the output (e.g. with `useMemo` with only `dateString` in deps) should include `i18n.language` in its dep array OR call the formatter inline during render (preferred — dates are cheap to format).

- [ ] **Step 5: Verify**

```bash
npm run dev
```

Check a card with a due date in English, switch to Icelandic, observe the date flips. Comments showing "5m ago" → "fyrir 5 mín." (Intl.RelativeTimeFormat output).

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/dateUtils.ts src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
feat(i18n): locale-aware date formatting

timeAgo and formatDueDate now use Intl.RelativeTimeFormat and
Intl.DateTimeFormat with the active i18n locale. Adds dates.*
keys with pluralization for overdue/due-in-N-days.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Toasts, errors, confirmations — final sweep

**Files:**
- Varies — run grep sweep to find remaining hardcoded strings.

- [ ] **Step 1: Grep sweep for stragglers**

Using the `Grep` tool, run these patterns (do all four):

1. `>[A-Z][a-zA-Z ]+<` with `glob: "**/*.tsx"` — catches JSX text starting with a capital letter.
2. `placeholder="[A-Z]` with `glob: "**/*.tsx"` — placeholder strings.
3. `aria-label="[A-Z]` with `glob: "**/*.tsx"` — aria labels.
4. `title="[A-Z]` with `glob: "**/*.tsx"` — title tooltips.

For every hit, check if it's already wrapped in `t(...)`. If not, add it to the appropriate namespace in `en.json` and replace.

Also grep for `alert(` / `confirm(` / `throw new Error(` in `src/**/*.{ts,tsx}` — replace user-facing messages with `t(...)`. `throw new Error` used for programmer errors (never shown to users) can stay English.

- [ ] **Step 2: Run translator**

```bash
npm run translate
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Walk every screen in Icelandic, watching for any English text that shouldn't be there. Walk every screen in English, same check.

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/locales <any remaining .tsx files>
git commit -m "$(cat <<'EOF'
feat(i18n): final sweep — toasts, errors, stray strings

Grep sweep of JSX text + placeholder/aria-label/title attrs caught
remaining hardcoded strings across the app.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Polish and deploy

### Task 17: Icelandic marketing polish on the landing page

**Files:**
- Modify: `src/shared/i18n/locales/is.json` (hand edits)

- [ ] **Step 1: Read the `landing.*` block of `is.json` out loud**

Every hero headline, feature bullet, and CTA. Machine translation is competent but not a native copywriter. Tighten where needed.

Specifically check:
- Hero headline — is it punchy?
- CTA buttons — "Prófaðu frítt" / "Byrja" / etc. — match the English intent but feel natural.
- Any English idiom that doesn't translate literally — rewrite the idea.

- [ ] **Step 2: Update `.is.cache.json` if you changed values**

After hand-editing `is.json`, update the cache file to record the new value (so the next `npm run translate` doesn't overwrite your edits). For each key you edited:

```json
"landing.hero.title": {
  "hash": "<existing hash — keep it>",
  "value": "<your new Icelandic value>"
}
```

The script compares English source hashes, so as long as the English source doesn't change, your hand edits stick.

- [ ] **Step 3: Verify**

```bash
npm run translate   # should report "Nothing to translate"
npm run dev
```

Read the landing page in Icelandic. Satisfied? Good.

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/locales/is.json src/shared/i18n/locales/.is.cache.json
# NB: the cache file is gitignored; force-add it for this commit only if you want reviewers to see the matching hashes. Usually NOT committed.
# Actually — keep cache gitignored. Only commit is.json.
git add src/shared/i18n/locales/is.json
git commit -m "$(cat <<'EOF'
style(i18n): polish icelandic landing copy

Hand edits on hero, features, and CTAs for tone and fit. English
source hashes unchanged, so future npm run translate preserves.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: PWA manifest localization

**Files:**
- Modify: `vite.config.ts` (PWA plugin manifest)

- [ ] **Step 1: Read current PWA config**

Use the `Read` tool on `vite.config.ts`. Find the `VitePWA({...})` manifest block.

- [ ] **Step 2: Translate the visible strings**

The manifest has `name`, `short_name`, `description`. Because the manifest is static JSON fetched by the OS, we can't change it at runtime per user. Decision: use **Icelandic** in the manifest (app primarily targets Icelandic users) but keep `name: "Huginn"` untranslated.

Update so:
- `name`: `"Huginn"`
- `short_name`: `"Huginn"`
- `description`: Icelandic one-liner (e.g. `"Persónulegt annað heila — hugsanir, listar og teymisverkefni."`)

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Then `npm run preview`, open in a Chrome tab, `chrome://apps` → install as PWA → verify the install dialog shows the Icelandic description.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "$(cat <<'EOF'
feat(i18n): icelandic PWA manifest description

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Missing-key audit

**Files:**
- None modified; pure verification.

- [ ] **Step 1: Enable missing-key logging**

Modify `src/shared/i18n/index.ts`. In the `.init({...})` config, add:

```ts
saveMissing: import.meta.env.DEV,
missingKeyHandler: (lngs, ns, key) => {
  if (import.meta.env.DEV) {
    console.warn(`[i18n] missing key: ${key} (in ${lngs.join(',')})`)
  }
},
```

- [ ] **Step 2: Walk the app with devtools open**

```bash
npm run dev
```

Open devtools console. In Icelandic mode, navigate every screen: landing, login, signup, forgot password, reset, projects list, pending invites, board view, list actions, card popup (every tab), settings (project + account), inbox, voice capture.

Watch for `[i18n] missing key:` warnings. For each:
1. Find the call site (usually in the file you most recently viewed).
2. Add the key to `en.json`.
3. Run `npm run translate`.
4. Reload.

Repeat until a full walkthrough produces zero warnings.

- [ ] **Step 3: Repeat in English**

Same walkthrough in English. Zero missing-key warnings.

- [ ] **Step 4: Remove the dev-only logging (optional)**

The `missingKeyHandler` is harmless in prod because `import.meta.env.DEV` is false. Leave it in — it'll help catch drift next time someone adds a feature.

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/index.ts src/shared/i18n/locales
git commit -m "$(cat <<'EOF'
chore(i18n): add dev missing-key warning + fix stragglers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Ship

**Files:**
- No repo changes; Vercel deploy.

- [ ] **Step 1: Final build**

```bash
npm run build
```

Expected: clean build, no TS errors, bundle size not dramatically larger (i18next + locale JSON adds ~30-50 KB gzipped — acceptable).

- [ ] **Step 2: Preview**

```bash
npm run preview
```

One last full QA pass in both languages on the production build.

- [ ] **Step 3: Push**

```bash
git push origin main
```

Vercel picks it up automatically.

- [ ] **Step 4: Verify prod**

Visit `https://huginn.pro`. Clear site data (devtools → Application → Clear storage), reload. Should default to Icelandic (unless your `navigator.language` starts with `en`). Switch to English via `AccountMenu`, reload — still English.

- [ ] **Step 5: Update CLAUDE.md with the new architecture notes**

Modify `CLAUDE.md`. Add a new section after the "Design System" section:

```markdown
## Internationalization

Two UI languages: **Icelandic (default)** and **English**. Managed by `react-i18next`.

- Source of truth: `src/shared/i18n/locales/en.json` (hand-maintained).
- `src/shared/i18n/locales/is.json` is generated by `npm run translate` — calls OpenRouter Gemini with en.json, hash-diffed so only changed/new keys get re-translated. Hand edits to `is.json` stick (cache in `.is.cache.json`, gitignored) as long as the English source hasn't changed.
- Language resolution order: `huginn_profiles.locale` → `localStorage.huginn.lang` → `navigator.language` (English browsers → English, everyone else → Icelandic).
- Switcher in `AccountMenu`; preference synced to the new `huginn_profiles.locale` column.
- Dates format via `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` with active locale; i18next plural suffixes handle Icelandic-specific plural rules.
- `OPEN_ROUTER_API` env var required for `npm run translate` (not needed for dev/build).
```

Commit:
```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document i18n architecture in CLAUDE.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Self-review checklist (run this before executing the plan)

- ✅ Every section of the spec maps to a task.
- ✅ No placeholders (`TBD`, `TODO` in step bodies, vague "handle errors").
- ✅ Types match across tasks: `Profile.locale`, `Language`, `SUPPORTED_LANGUAGES`, `LANGUAGE_LABELS` used consistently in Tasks 2, 3, 4, 5.
- ✅ Phase order makes sense: infra → script → slices → polish → deploy. Translator script (Task 6) exists BEFORE first content slice (Task 7) so the generator is ready when needed.
- ✅ Every "verify" step specifies what success looks like.
- ✅ No automated tests (consistent with CLAUDE.md saying "No tests yet").
- ✅ `OPEN_ROUTER_API` env var sourced from `.env` (already present per the user's message).
- ✅ Missing key from response ≠ crash (script falls back to English).
- ✅ Hand edits survive re-translation (hash-based cache + spec note).
