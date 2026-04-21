#!/usr/bin/env node
// Translate en.json → is.json via OpenRouter + Gemini 3.1 Pro.
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

const MODEL = 'google/gemini-3.1-pro-preview'
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

function stripJsonFence(s) {
  const trimmed = s.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  return trimmed
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
  if (!content) throw new Error(`No content in response: ${JSON.stringify(json).slice(0, 500)}`)
  let parsed
  try {
    parsed = JSON.parse(stripJsonFence(content))
  } catch {
    throw new Error(`Model did not return JSON: ${content.slice(0, 500)}`)
  }
  return parsed
}

async function main() {
  const en = await loadJson(EN_PATH, {})
  const existingIs = await loadJson(IS_PATH, {})
  const cache = await loadJson(CACHE_PATH, {})

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

  for (const k of Object.keys(nextCache)) {
    if (!(k in enFlat)) delete nextCache[k]
  }
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
