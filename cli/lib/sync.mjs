import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { pointerJson, sha256 } from './mirror.mjs'

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

// What planMirror needs to know about the targets that exist as files:
// size always, sha256 for rendered markdown, storage_path for pointers.
export function readExisting(out, targets) {
  const existing = new Map()
  for (const t of targets) {
    const full = resolveInside(out, t.path)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (!stat.isFile()) continue
    const info = { size: stat.size }
    if (t.kind === 'md') info.sha256 = sha256(readFileSync(full))
    if (t.kind === 'pointer') {
      try {
        const pointer = JSON.parse(readFileSync(full, 'utf8'))
        if (typeof pointer?.storage_path === 'string') info.pointerStoragePath = pointer.storage_path
      } catch {
        // Not a pointer we wrote, so it is rewritten.
      }
    }
    existing.set(t.path, info)
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

// Runs the plan. download(storagePath) returns a Buffer. With dryRun nothing
// is downloaded or written. Returns the paths in plan order.
export async function executeMirror(out, plan, { download, dryRun = false }) {
  const result = { written: [], skipped: [], pointers: [] }
  for (const entry of plan) {
    const full = resolveInside(out, entry.path)
    if (entry.action === 'skip') {
      result.skipped.push(entry.path)
      continue
    }
    if (entry.action === 'pointer') {
      if (!dryRun) {
        const bytes = await download(entry.source.storage_path)
        writeAtomic(full, pointerJson(entry.source, sha256(bytes)))
      }
      result.pointers.push(entry.path)
      continue
    }
    if (!dryRun) {
      const data = entry.content !== undefined ? entry.content : await download(entry.source.storage_path)
      writeAtomic(full, data)
    }
    result.written.push(entry.path)
  }
  return result
}
