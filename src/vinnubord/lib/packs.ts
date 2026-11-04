// Collapsed pack columns of one project in this browser, stored in
// localStorage under hg.packs.<projectId> as {"collapsed":[packId, ...]}.
// Anything that does not parse to a string array reads as nothing collapsed.

export function packsKey(projectId: string): string {
  return `hg.packs.${projectId}`
}

export function parseCollapsed(raw: string | null): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return new Set()
    const list = (parsed as { collapsed?: unknown }).collapsed
    if (!Array.isArray(list)) return new Set()
    return new Set(list.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export function serializeCollapsed(ids: ReadonlySet<string>): string {
  return JSON.stringify({ collapsed: [...ids] })
}

// The line a folded pack shows in place of its modules.
export function foldLine(moduleCount: number, cardCount: number): string {
  const modules = moduleCount === 1 ? '1 módúll' : `${moduleCount} módúlar`
  return `${modules} · ${cardCount} kort · fellt saman`
}
