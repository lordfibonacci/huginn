// How loadBoard reads its lists. PostgREST answers with at most 1000 rows per
// request and cuts the rest without an error (measured on the live project
// 2026-11-25), so every list is read in pages. The CLI copy is
// cli/lib/paging.mjs, kept equal by cli/lib/parity.test.mjs.

export const PAGE_SIZE = 1000
// 100 pages is 100 000 rows of one kind in one project: a runaway, not a board.
export const MAX_PAGES = 100
// PostgREST code for an offset past the last row (HTTP 416).
export const RANGE_PAST_END = 'PGRST103'
export const TOO_MANY_ROWS = `Fleiri en ${PAGE_SIZE * MAX_PAGES} raðir í einni töflu.`

// The fixed order of every list loadBoard pages through. Each ends in the
// table's key, so the order is total: rows written in one insert share
// created_at, and without the key one of them could land on two pages or none.
export const BOARD_ORDER = {
  hg_participants: ['created_at', 'id'],
  hg_packages: ['position', 'created_at', 'id'],
  hg_modules: ['position', 'created_at', 'id'],
  hg_items: ['created_at', 'id'],
  hg_plans: ['position', 'created_at', 'id'],
  hg_files: ['created_at', 'id'],
  hg_questions: ['created_at', 'id'],
  hg_actions: ['created_at', 'id'],
  hg_rulings: ['created_at', 'id'],
  hg_comments: ['created_at', 'id'],
  hg_reads: ['item_id', 'user_id'],
  hg_unread: ['item_id', 'kind'],
  hg_views: ['position', 'created_at', 'id'],
  hg_tags: ['name', 'id'],
  hg_view_positions: ['view_id', 'item_id'],
  hg_view_pack_positions: ['view_id', 'package_id'],
  hg_zones: ['created_at', 'id'],
  hg_view_zone_positions: ['view_id', 'zone_id'],
} as const

export type BoardList = keyof typeof BOARD_ORDER

export type PageError = { message: string; code?: string }
export type Page<T> = { data: T[] | null; error: PageError | null; count?: number | null }
export type AllRows<T> = { data: T[]; error: PageError | null }

// page(from, to) runs one query for the rows from..to (zero based, inclusive)
// in a fixed total order, with the exact count when the server gives one.
// A failed page fails the whole list: a board is never built from part of one.
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<AllRows<T>> {
  const rows: T[] = []
  for (let n = 0; n < MAX_PAGES; n++) {
    const res = await page(rows.length, rows.length + PAGE_SIZE - 1)
    if (res.error) {
      // The list shrank between two pages, so the rows already read are all of it.
      if (n > 0 && res.error.code === RANGE_PAST_END) return { data: rows, error: null }
      return { data: [], error: res.error }
    }
    const got = res.data ?? []
    for (const row of got) rows.push(row)
    if (got.length === 0) return { data: rows, error: null }
    // With a count the list is whole when it holds that many rows. Without one
    // a short page is the end. The next page starts after the rows received,
    // so a server cap below PAGE_SIZE still reads everything.
    const whole = typeof res.count === 'number' ? rows.length >= res.count : got.length < PAGE_SIZE
    if (whole) return { data: rows, error: null }
  }
  return { data: [], error: { message: TOO_MANY_ROWS } }
}

// Adds the fixed order of a list to a query, so two pages of it never overlap.
export function ordered<Q extends { order(column: string): Q }>(query: Q, list: BoardList): Q {
  let q = query
  for (const column of BOARD_ORDER[list]) q = q.order(column)
  return q
}
