import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { oneLine } from './format.mjs'
import { MIRROR_MAX_BYTES, POINTER_SUFFIX, pointerJson, sha256 } from './mirror.mjs'

// File side of huginn sync: what is on disk now, and writing the plan from
// planMirror. Downloads come in as a function so tests run without Supabase.

// The full path of rel inside out. Throws if it would land outside.
export function resolveInside(out, rel) {
  const root = resolve(out)
  const full = resolve(root, rel)
  const back = relative(root, full)
  if (!back || back.split(/[\\/]/)[0] === '..' || isAbsolute(back)) {
    throw new Error(`Slóðin ${rel} lendir utan ${root}.`)
  }
  return full
}

// Names of the folders directly under out, sorted. None when out is missing.
export function listFolders(out) {
  try {
    return readdirSync(out, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    return []
  }
}

function readPointerPath(full) {
  try {
    const pointer = JSON.parse(readFileSync(full, 'utf8'))
    return typeof pointer?.storage_path === 'string' ? pointer.storage_path : undefined
  } catch {
    // Not a pointer we wrote, so it is rewritten.
    return undefined
  }
}

function fileStat(full) {
  try {
    const stat = statSync(full)
    return stat.isFile() ? stat : null
  } catch {
    return null
  }
}

// What planMirror needs to know about the targets that exist as files:
// size always, sha256 for rendered markdown, storage_path for pointers. For a
// copy also a pointer next to it, left when the bytes were too big.
export function readExisting(out, targets) {
  const existing = new Map()
  for (const t of targets) {
    const full = resolveInside(out, t.path)
    const stat = fileStat(full)
    if (stat) {
      const info = { size: stat.size }
      if (t.kind === 'md') info.sha256 = sha256(readFileSync(full))
      if (t.kind === 'pointer') info.pointerStoragePath = readPointerPath(full)
      existing.set(t.path, info)
    }
    if (t.kind === 'copy') {
      const alt = `${t.path}${POINTER_SUFFIX}`
      const altFull = resolveInside(out, alt)
      const altStat = fileStat(altFull)
      if (altStat) existing.set(alt, { size: altStat.size, pointerStoragePath: readPointerPath(altFull) })
    }
  }
  return existing
}

// Write to a temp file next to the target, then rename over it, so a sync
// that stops halfway never leaves a half written file.
function writeAtomic(full, data) {
  mkdirSync(dirname(full), { recursive: true })
  const tmp = join(dirname(full), `.${basename(full)}.${process.pid}.huginn-tmp`)
  try {
    writeFileSync(tmp, data)
    renameSync(tmp, full)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw new Error(`Gat ekki skrifað ${full}: ${error.message}`)
  }
}

function message(error) {
  return oneLine(error instanceof Error ? error.message : String(error))
}

// Runs the plan. download(storagePath) returns a Buffer. With dryRun nothing
// is downloaded or written. One entry that fails (a download, a write, a
// storage_path outside the item) goes into failed with its path and the run
// goes on, so later files and STATUS.md are still written. Bytes of 10 MB or
// more for a row whose size said less get a pointer instead, with a warning.
// Returns the paths in plan order.
export async function executeMirror(out, plan, { download, dryRun = false }) {
  const result = { written: [], skipped: [], pointers: [], failed: [], warnings: [] }
  for (const entry of plan) {
    if (entry.action === 'skip') {
      result.skipped.push(entry.path)
      continue
    }
    if (entry.action === 'fail') {
      result.failed.push({ path: entry.path, reason: entry.reason })
      continue
    }
    try {
      const full = resolveInside(out, entry.path)
      if (dryRun) {
        ;(entry.action === 'pointer' ? result.pointers : result.written).push(entry.path)
        continue
      }
      if (entry.content !== undefined) {
        writeAtomic(full, entry.content)
        result.written.push(entry.path)
        continue
      }
      const bytes = await download(entry.source.storage_path)
      if (entry.action === 'pointer') {
        writeAtomic(full, pointerJson(entry.source, sha256(bytes)))
        result.pointers.push(entry.path)
      } else if (bytes.length >= MIRROR_MAX_BYTES) {
        const alt = `${entry.path}${POINTER_SUFFIX}`
        writeAtomic(resolveInside(out, alt), pointerJson({ ...entry.source, size: bytes.length }, sha256(bytes)))
        result.pointers.push(alt)
        result.warnings.push(
          `${entry.path}: skráin er ${bytes.length} bæti í Storage en ${Number(entry.source.size) || 0} bæti samkvæmt gagnagrunni, bendiskrá skrifuð í staðinn.`,
        )
      } else {
        writeAtomic(full, bytes)
        result.written.push(entry.path)
      }
    } catch (error) {
      result.failed.push({ path: entry.path, reason: message(error) })
    }
  }
  return result
}

// Text, JSON and exit code for huginn sync. Exit code 1 when anything failed.
export function syncReport(dir, result, dryRun) {
  const lines = [dryRun ? `Spegill í ${dir}, prufukeyrsla, ekkert skrifað.` : `Spegill í ${dir}.`]
  const list = (heading, rows) => {
    lines.push(`${heading}: ${rows.length}`, ...rows.map((r) => `  ${r}`))
  }
  list(dryRun ? 'Yrði skrifað' : 'Skrifað', result.written)
  list('Óbreytt', result.skipped)
  list(dryRun ? 'Bendiskrár sem yrðu skrifaðar' : 'Bendiskrár', result.pointers)
  if (result.warnings.length) list('Viðvaranir', result.warnings)
  if (result.failed.length) list('Mistókst', result.failed.map((f) => `${f.path}: ${f.reason}`))
  const ok = result.failed.length === 0
  return {
    text: lines.join('\n'),
    json: { ok, out: dir, dry_run: dryRun, ...result },
    exitCode: ok ? 0 : 1,
  }
}
