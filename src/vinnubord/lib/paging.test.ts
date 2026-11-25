import { describe, it, expect } from 'vitest'
import { BOARD_ORDER, MAX_PAGES, PAGE_SIZE, RANGE_PAST_END, TOO_MANY_ROWS, fetchAll, ordered, type Page } from './paging'

type Row = { id: number }
const rows = (n: number, start = 0): Row[] => Array.from({ length: n }, (_, i) => ({ id: start + i }))
const pastEnd = { message: 'Requested range not satisfiable', code: RANGE_PAST_END }

// A list of `total` rows behind a server that answers with at most `cap` rows
// and, like PostgREST, refuses an offset past the last row.
function table(total: number, { cap = PAGE_SIZE, count = true } = {}) {
  const calls: Array<[number, number]> = []
  const page = async (from: number, to: number): Promise<Page<Row>> => {
    calls.push([from, to])
    if (from > 0 && from >= total) return { data: null, error: pastEnd, count: null }
    const n = Math.max(0, Math.min(to + 1, total, from + cap) - from)
    return { data: rows(n, from), error: null, count: count ? total : null }
  }
  return { page, calls }
}

// A server that answers with the given pages in turn.
function scripted(pages: Page<Row>[]) {
  const calls: Array<[number, number]> = []
  const page = async (from: number, to: number): Promise<Page<Row>> => {
    calls.push([from, to])
    return pages[calls.length - 1]
  }
  return { page, calls }
}

describe('fetchAll', () => {
  it('reads an empty list in one request', async () => {
    const t = table(0)
    expect(await fetchAll(t.page)).toEqual({ data: [], error: null })
    expect(t.calls).toEqual([[0, 999]])
  })

  it('reads a list under the page size in one request', async () => {
    const t = table(282)
    const got = await fetchAll(t.page)
    expect(got.error).toBeNull()
    expect(got.data).toEqual(rows(282))
    expect(t.calls).toEqual([[0, 999]])
  })

  it('never asks past the end of a list of exactly one page', async () => {
    const t = table(1000)
    expect((await fetchAll(t.page)).data).toHaveLength(1000)
    expect(t.calls).toEqual([[0, 999]])
  })

  it('reads the rows past the first page, in order and once each', async () => {
    const t = table(1118)
    const got = await fetchAll(t.page)
    expect(got.data).toEqual(rows(1118))
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('reads three pages', async () => {
    const t = table(2500)
    expect((await fetchAll(t.page)).data).toEqual(rows(2500))
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('reads everything when the server cap is below the page size', async () => {
    const t = table(1118, { cap: 400 })
    expect((await fetchAll(t.page)).data).toEqual(rows(1118))
    expect(t.calls.map((c) => c[0])).toEqual([0, 400, 800])
  })

  it('ends on a short page when the server gives no count', async () => {
    const t = table(1118, { count: false })
    expect((await fetchAll(t.page)).data).toEqual(rows(1118))
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('takes a refused offset after the first page as the end of the list', async () => {
    const t = table(1000, { count: false })
    expect(await fetchAll(t.page)).toEqual({ data: rows(1000), error: null })
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('follows a list that grows between two pages', async () => {
    const s = scripted([
      { data: rows(1000), error: null, count: 1118 },
      { data: rows(120, 1000), error: null, count: 1120 },
    ])
    expect((await fetchAll(s.page)).data).toEqual(rows(1120))
    expect(s.calls).toHaveLength(2)
  })

  it('keeps what it read when the list shrinks between two pages', async () => {
    const s = scripted([
      { data: rows(1000), error: null, count: 1001 },
      { data: null, error: pastEnd, count: null },
    ])
    expect(await fetchAll(s.page)).toEqual({ data: rows(1000), error: null })
    // The same when the server answers with an empty page instead of refusing the offset.
    const empty = scripted([
      { data: rows(1000), error: null, count: 1001 },
      { data: [], error: null, count: 1001 },
    ])
    expect(await fetchAll(empty.page)).toEqual({ data: rows(1000), error: null })
    expect(empty.calls).toHaveLength(2)
  })

  it('fails with the error of the first page, a refused offset included', async () => {
    const boom = { message: 'permission denied', code: '42501' }
    expect(await fetchAll(scripted([{ data: null, error: boom }]).page)).toEqual({ data: [], error: boom })
    expect(await fetchAll(scripted([{ data: null, error: pastEnd }]).page)).toEqual({ data: [], error: pastEnd })
  })

  it('returns no rows when a later page fails', async () => {
    const boom = { message: 'fetch failed' }
    const s = scripted([
      { data: rows(1000), error: null, count: 1118 },
      { data: null, error: boom },
    ])
    expect(await fetchAll(s.page)).toEqual({ data: [], error: boom })
  })

  it('gives up with an error after MAX_PAGES pages', async () => {
    const calls: number[] = []
    const page = async (from: number): Promise<Page<Row>> => {
      calls.push(from)
      return { data: rows(PAGE_SIZE, from), error: null, count: 1e9 }
    }
    expect(await fetchAll(page)).toEqual({ data: [], error: { message: TOO_MANY_ROWS } })
    expect(calls).toHaveLength(MAX_PAGES)
  })
})

describe('BOARD_ORDER', () => {
  // The lists without an id column, and the key each is unique on.
  const COMPOSITE: Record<string, string[]> = {
    hg_reads: ['item_id', 'user_id'],
    hg_unread: ['item_id', 'kind'],
    hg_view_positions: ['view_id', 'item_id'],
    hg_view_pack_positions: ['view_id', 'package_id'],
    hg_view_zone_positions: ['view_id', 'zone_id'],
  }

  it('ends every order in the key of its list, so the order is total', () => {
    for (const [name, order] of Object.entries(BOARD_ORDER)) {
      if (COMPOSITE[name]) expect([...order], name).toEqual(COMPOSITE[name])
      else expect(order[order.length - 1], name).toBe('id')
    }
  })
})

describe('ordered', () => {
  it('adds the columns of the list in their order and returns the query', () => {
    type Q = { order(column: string): Q }
    const seen: string[] = []
    const q: Q = {
      order(column) {
        seen.push(column)
        return q
      },
    }
    expect(ordered(q, 'hg_plans')).toBe(q)
    expect(seen).toEqual(['position', 'created_at', 'id'])
  })
})
