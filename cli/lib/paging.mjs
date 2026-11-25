// Copy of src/vinnubord/lib/paging.ts, checked by parity.test.mjs: how loadBoard
// reads its lists. PostgREST answers with at most 1000 rows per request and
// cuts the rest without an error, so every list is read in pages.

export const PAGE_SIZE = 1000
export const MAX_PAGES = 100
export const RANGE_PAST_END = 'PGRST103'
export const TOO_MANY_ROWS = `Fleiri en ${PAGE_SIZE * MAX_PAGES} raðir í einni töflu.`

// The lists the CLI loads (the web loads five more). Each order equals the
// web's and ends in the table's key, so the order is total.
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
  hg_tags: ['name', 'id'],
  hg_zones: ['created_at', 'id'],
}

// page(from, to) runs one query for the rows from..to (zero based, inclusive)
// in a fixed total order, with the exact count when the server gives one.
// A failed page fails the whole list: a board is never built from part of one.
export async function fetchAll(page) {
  const rows = []
  for (let n = 0; n < MAX_PAGES; n++) {
    const res = await page(rows.length, rows.length + PAGE_SIZE - 1)
    if (res.error) {
      // The list shrank between two pages: nothing is left at this offset, so
      // the read ends. A row deleted from an earlier page hides one row this load.
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
export function ordered(query, list) {
  let q = query
  for (const column of BOARD_ORDER[list]) q = q.order(column)
  return q
}
