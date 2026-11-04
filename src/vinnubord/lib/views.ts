// Saved views: a filter plus the viewer-shared card positions of that view.
// The local filter only dims inside a view, the view decides what is drawn.
// A closed card within the linger window has no tone, so a view without tones
// draws it and a view with tones does not.

import { matches, parseFilter, prunePackages, type Filter } from './filters'
import { BUCKET_TONE, TONES, countBucket, isOnBoard } from './status'
import type { Action, Item, Module, View, ViewFilterJson, ViewPackPosition, ViewPosition } from './types'

type Point = { x: number; y: number }

// The filter a view stores. Unknown tones drop, q is empty and unread is off.
export function viewFilterOf(view: View): Filter {
  return parseFilter(JSON.stringify(view.filter))
}

// The part of a filter that a view keeps. Never q or unread.
export function viewFilterJson(f: Filter): ViewFilterJson {
  return { tones: [...f.tones], packages: [...f.packages], tags: [...f.tags] }
}

// What the editor saves. A group with every offered option ticked means all,
// the same as none ticked, so it is saved as an empty list. A group with
// nothing offered keeps what is ticked.
export function normalizeViewFilter(
  json: ViewFilterJson,
  packageKeys: string[],
  tagKeys: string[],
): ViewFilterJson {
  const all = (picked: string[], offered: readonly string[]) =>
    offered.length > 0 && offered.every((k) => picked.includes(k)) ? [] : picked
  return {
    tones: all(json.tones ?? [], TONES),
    packages: all(json.packages ?? [], packageKeys),
    tags: all(json.tags ?? [], tagKeys),
  }
}

// The on board items a view draws at now. Without a view, all of them.
// Packages that no module belongs to any more are ignored, like in the local
// filter.
export function itemsInView(
  items: Item[],
  modules: Module[],
  actions: Action[],
  viewerId: string,
  view: View | null,
  now = Date.now(),
): Item[] {
  const onBoard = items.filter((item) => isOnBoard(item, now))
  if (!view) return onBoard
  const packageOf = new Map(modules.map((m) => [m.id, m.package_id]))
  const known = new Set<string>()
  for (const pkg of packageOf.values()) if (pkg) known.add(pkg)
  const filter = prunePackages(viewFilterOf(view), known)
  return onBoard.filter((item) => {
    const bucket = countBucket(item, actions, viewerId)
    const packageId = item.module_id ? (packageOf.get(item.module_id) ?? null) : null
    return matches(item, { tone: bucket ? BUCKET_TONE[bucket] : null, packageId, unread: false, text: '' }, filter)
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

// Pack column positions of one view by package id, same rule as positionsOf:
// empty for the main board, and a pack without a row rests at its own place.
export function packPositionsOf(rows: ViewPackPosition[], viewId: string | null): Map<string, Point> {
  const map = new Map<string, Point>()
  if (viewId === null) return map
  for (const r of rows) if (r.view_id === viewId) map.set(r.package_id, { x: r.pos_x, y: r.pos_y })
  return map
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
  now = Date.now(),
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const v of views) counts.set(v.id, itemsInView(items, modules, actions, viewerId, v, now).length)
  return counts
}
