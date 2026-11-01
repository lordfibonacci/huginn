// Saved views: a filter plus the viewer-shared card positions of that view.
// The local filter only dims inside a view, the view decides what is drawn.

import { matches, parseFilter, prunePackages, type Filter } from './filters'
import { BUCKET_TONE, countBucket, isOnBoard } from './status'
import type { Action, Item, Module, View, ViewFilterJson, ViewPosition } from './types'

type Point = { x: number; y: number }

// The filter a view stores. Unknown tones drop, q is empty and unread is off.
export function viewFilterOf(view: View): Filter {
  return parseFilter(JSON.stringify(view.filter))
}

// The part of a filter that a view keeps. Never q or unread.
export function viewFilterJson(f: Filter): ViewFilterJson {
  return { tones: [...f.tones], packages: [...f.packages], tags: [...f.tags] }
}

// The on board items a view draws. Without a view, all of them. Packages that
// no module belongs to any more are ignored, like in the local filter.
export function itemsInView(
  items: Item[],
  modules: Module[],
  actions: Action[],
  viewerId: string,
  view: View | null,
): Item[] {
  const onBoard = items.filter(isOnBoard)
  if (!view) return onBoard
  const packageOf = new Map(modules.map((m) => [m.id, m.package_id]))
  const known = new Set<string>()
  for (const pkg of packageOf.values()) if (pkg) known.add(pkg)
  const filter = prunePackages(viewFilterOf(view), known)
  return onBoard.filter((item) => {
    const bucket = countBucket(item, actions, viewerId)
    if (!bucket) return false
    const packageId = item.module_id ? (packageOf.get(item.module_id) ?? null) : null
    return matches(item, { tone: BUCKET_TONE[bucket], packageId, unread: false }, filter)
  })
}

// The positions of one view by item id. Empty for no view.
export function positionsOf(rows: ViewPosition[], viewId: string | null): Map<string, Point> {
  const map = new Map<string, Point>()
  if (viewId === null) return map
  for (const r of rows) if (r.view_id === viewId) map.set(r.item_id, { x: r.pos_x, y: r.pos_y })
  return map
}

// Where an item sits: its place in the view, else its own place on the board.
export function positionOf(item: Item, positions: Map<string, Point>): Point {
  return positions.get(item.id) ?? { x: item.pos_x, y: item.pos_y }
}

// localStorage key of one project's active view.
export function activeViewKey(projectId: string): string {
  return `hg.view.${projectId}`
}

// The stored view, or null for none or one that has been deleted.
export function resolveActiveView(storedId: string | null, views: View[]): View | null {
  if (!storedId) return null
  return views.find((v) => v.id === storedId) ?? null
}

// Items per view, for the menu.
export function viewCounts(
  views: View[],
  items: Item[],
  modules: Module[],
  actions: Action[],
  viewerId: string,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const v of views) counts.set(v.id, itemsInView(items, modules, actions, viewerId, v).length)
  return counts
}
