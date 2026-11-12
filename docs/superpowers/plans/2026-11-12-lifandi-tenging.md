# Lifandi tenging (the board channel heals itself) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A board that lost its realtime channel reconnects by itself and fetches what it missed, so the list and the cards are never stale until a browser refresh.

**Architecture:** `useBoardData` stops treating the channel as something built once. A `connect` function refreshes the session, subscribes a new channel and drops the old one; a heal timer runs it whenever the channel is not live, and a wake (tab visible, window focus, network back, a press while not live) runs it at once and reloads a board that may be stale. Every decision (how long to wait, what a wake does, what the server's ready notice looks like) is a pure function in `lib/realtime.ts` with tests; the hook only wires them.

**Tech Stack:** React 19, `@supabase/supabase-js` 2.103.0 (realtime-js 2.103.0 on the Phoenix client), vitest.

**Spec:** none. This is a bug fix; the diagnosis below is the spec.

**Profile:** full, not small. `useBoardData` is a shared hook used by two routes (`/p/:slug` and `/p/:slug/stillingar`), which the Small task profile excludes. Every task gets its own review, then the Fable whole branch review.

## Diagnosis (measured 2026-11-12)

Heimir's report: the board sits on old data (list sorted by last changed showed 14:20 while an item was updated 15:54), the dot in the top bar says "Tengist", and only a browser refresh brings the new state.

What was measured against the live project `czdjxtsjgughimlazdmu`, signed in as the Claude service user:

1. The server side is sound. All 17 `hg_` tables are in the `supabase_realtime` publication with a `project_id` column, and the realtime logs hold no errors.
2. The normal path works. A write reaches a channel subscribed exactly like the hook (17 bindings, `project_id` filter) in about 0.5 s.
3. A dropped socket heals without help. Closing the socket gives `CHANNEL_ERROR`, the client rejoins in 1.4 s, `SUBSCRIBED` follows and events flow again. The hook already reloads there (`channelStep`).
4. A channel the server closes never comes back. Sending the channel the same `phx_close` the server sends: status `CLOSED`, channel state `closed`, zero channels left on the socket, the socket itself still connected, no events, and nothing changed in the next 20 s. This is the state behind a "Tengist" dot that stays.
5. The heal in this plan works on that state. Refreshing the session, handing realtime the token, subscribing a new channel and removing the old one gave `SUBSCRIBED` in 0.1 s and events flowed again. The `CLOSED` status that `removeChannel` sends to the old channel arrives after the swap and must be ignored.
6. After `SUBSCRIBED` the server needs about 0.3 s more before it reports `Subscribed to PostgreSQL` on the `system` event. A change in that window is not sent.

What the code shows:

- `useBoardData` builds its channel once per project and has no path back from `CLOSED`: no rebuild, and no reload on `visibilitychange`, `focus` or `online` anywhere in `src`.
- supabase-js calls `realtime.setAuth(token)` with an explicit token on `SIGNED_IN` and `TOKEN_REFRESHED`, which puts realtime in manual token mode (measured: `_isManualToken()` is true right after sign in). In that mode the heartbeat does not refresh the token; only a `TOKEN_REFRESHED` event does. auth-js stops its refresh ticker while the tab is hidden, and the access token lives 3600 s. A tab left hidden therefore holds a channel whose token runs out.

A probe that lets a token expire on a live channel was still running when this plan was written. Its result is recorded under "Expiry probe" at the end and changes no task: the fix is the same whatever closes the channel.

## Global Constraints

- No em dashes or hyphen dashes as punctuation anywhere: code comments, copy, docs. Commas, periods or colons.
- Touch only the files a task names. No migration, no CSS, no change to `src/shared/lib/supabase.ts`.
- Pure logic lives in `src/vinnubord/lib/` with a vitest file beside it; test files import from `vitest` explicitly.
- The hook reads the pure functions; it does not repeat their numbers.
- Commit prefix and scope: `fix(vinnubord): ...`, `test(vinnubord): ...`, `docs(vinnubord): ...`, with the Co-Authored-By trailer of the model that wrote the commit.
- `npm run lint` is broken in this repo. The gates are `npm run test` and `npm run build`.
- Credentials come from `.env` (`HG_SMOKE_EMAIL`, `HG_SMOKE_PASSWORD`) and are never printed or committed.

## Size table

| Task | Files | Size |
|---|---|---|
| 1. Pure rules: `healDelay`, `wakePlan`, `isPostgresReady` | `src/vinnubord/lib/realtime.ts`, `src/vinnubord/lib/realtime.test.ts` | S |
| 2. The hook heals and wakes, and the dot's hint says so | `src/vinnubord/hooks/useBoardData.ts`, `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json` | M |
| 3. CLAUDE.md | `CLAUDE.md` | S |

No task is L.

## Review Focus

1. **Two channels alive at once.** A heal timer that fires while a wake is connecting, or two wakes in one frame (`visibilitychange` and `focus` arrive together), must end with exactly one channel on the socket. Pinned by the browser check in Task 2 Step 6 (`getChannels().length` is 1 after every heal).
2. **A replaced channel flips the dot.** `removeChannel(old)` sends `CLOSED` to the old channel after the new one is current. That status must not set `live` false or arm a heal. Pinned by Task 2 Step 6 (the dot stays lit after the heal) and by the reviewer reading the `channel !== next` guard.
3. **Reload storms.** A press on a live board must do nothing, and focus changes on a live board must reload at most once per 30 s. Pinned by the `wakePlan` tests in Task 1.
4. **Unmount during an in flight connect.** React StrictMode mounts, unmounts and mounts again; a `connect` that resumes after cleanup must create no channel. Pinned by Task 2 Step 6 in `npm run dev`, which runs StrictMode: the channel count is 1 on a fresh load.
5. **The settings page.** `ProjectSettingsPage` uses the same hook. A wake reload there must not show the loader (it reads `loading`, which a reload never sets) or drop a draft (drafts are `useState` in the editors with no effect that resets them). Reviewer reads both; no new test.

---

### Task 1: Pure rules for healing and waking

**Files:**
- Modify: `src/vinnubord/lib/realtime.ts`
- Test: `src/vinnubord/lib/realtime.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all exported from `src/vinnubord/lib/realtime.ts`:
  - `HEAL_DELAYS_MS: readonly number[]` = `[4000, 10000, 30000]`
  - `healDelay(attempt: number): number`
  - `WAKE_RETRY_MS` = `3000`, `WAKE_STALE_MS` = `30000`
  - `wakePlan(live: boolean, sinceLoadMs: number, sinceConnectMs: number, show: boolean): { reconnect: boolean; reload: boolean }`
  - `isPostgresReady(payload: unknown): boolean`
  - `channelStep` stays exactly as it is.

**Verification set:** `npx vitest run src/vinnubord/lib/realtime.test.ts`. Nothing else needs checking by the implementer.

- [ ] **Step 1: Write the failing tests**

Replace the import line of `src/vinnubord/lib/realtime.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { HEAL_DELAYS_MS, WAKE_RETRY_MS, WAKE_STALE_MS, channelStep, healDelay, isPostgresReady, wakePlan } from './realtime'
```

Append after the existing `describe('channelStep', ...)` block:

```ts
describe('healDelay', () => {
  it('waits 4, 10, then 30 seconds', () => {
    expect(HEAL_DELAYS_MS).toEqual([4000, 10000, 30000])
    expect(healDelay(0)).toBe(4000)
    expect(healDelay(1)).toBe(10000)
    expect(healDelay(2)).toBe(30000)
  })
  it('repeats the last wait for every later attempt', () => {
    expect(healDelay(3)).toBe(30000)
    expect(healDelay(50)).toBe(30000)
  })
  it('a negative attempt is the first', () => {
    expect(healDelay(-1)).toBe(4000)
  })
})

describe('wakePlan', () => {
  const long = 10 * 60 * 1000
  it('a live board that just loaded does nothing, shown or pressed', () => {
    expect(wakePlan(true, 1000, long, true)).toEqual({ reconnect: false, reload: false })
    expect(wakePlan(true, 1000, long, false)).toEqual({ reconnect: false, reload: false })
  })
  it('a press on a live board never reloads, however old the load', () => {
    expect(wakePlan(true, long, long, false)).toEqual({ reconnect: false, reload: false })
  })
  it('showing a live board reloads once the load is 30 seconds old', () => {
    expect(wakePlan(true, WAKE_STALE_MS - 1, long, true)).toEqual({ reconnect: false, reload: false })
    expect(wakePlan(true, WAKE_STALE_MS, long, true)).toEqual({ reconnect: false, reload: true })
  })
  it('a board that is not live reconnects and reloads, shown or pressed', () => {
    expect(wakePlan(false, long, long, true)).toEqual({ reconnect: true, reload: true })
    expect(wakePlan(false, long, long, false)).toEqual({ reconnect: true, reload: true })
  })
  it('a connect younger than 3 seconds is left to finish', () => {
    expect(wakePlan(false, long, WAKE_RETRY_MS - 1, false)).toEqual({ reconnect: false, reload: true })
    expect(wakePlan(false, long, WAKE_RETRY_MS, false)).toEqual({ reconnect: true, reload: true })
  })
  it('a board that is not live reloads at most every 3 seconds', () => {
    expect(wakePlan(false, WAKE_RETRY_MS - 1, long, false)).toEqual({ reconnect: true, reload: false })
    expect(wakePlan(false, WAKE_RETRY_MS, long, false)).toEqual({ reconnect: true, reload: true })
  })
})

describe('isPostgresReady', () => {
  it('knows the notice the server sends when postgres changes are streaming', () => {
    expect(
      isPostgresReady({ message: 'Subscribed to PostgreSQL', status: 'ok', extension: 'postgres_changes', channel: 'hg_x' }),
    ).toBe(true)
  })
  it('an error notice or another extension is not it', () => {
    expect(isPostgresReady({ status: 'error', extension: 'postgres_changes' })).toBe(false)
    expect(isPostgresReady({ status: 'ok', extension: 'system' })).toBe(false)
  })
  it('anything that is not an object is not it', () => {
    expect(isPostgresReady(null)).toBe(false)
    expect(isPostgresReady(undefined)).toBe(false)
    expect(isPostgresReady('ok')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run src/vinnubord/lib/realtime.test.ts`
Expected: FAIL, the new names are not exported from `./realtime`.

- [ ] **Step 3: Add the rules**

Append to `src/vinnubord/lib/realtime.ts`, below `channelStep`:

```ts
// The wait before a channel that is not live is rebuilt, by attempt. The first
// leaves room for the client's own rejoin after a dropped socket (measured
// 1.4 s); the last repeats. A channel the server closed never rejoins on its own.
export const HEAL_DELAYS_MS: readonly number[] = [4000, 10000, 30000]

export function healDelay(attempt: number): number {
  return HEAL_DELAYS_MS[Math.min(Math.max(attempt, 0), HEAL_DELAYS_MS.length - 1)]
}

// A wake on a board that is not live acts at most this often.
export const WAKE_RETRY_MS = 3000
// A live board that is shown again reloads when its last load is this old.
export const WAKE_STALE_MS = 30000

// What a wake does. show: the tab became visible, the window got focus or the
// network came back. A press (show false) only acts on a board that is not
// live. The times are since the last load began and since the last connect began.
export function wakePlan(
  live: boolean,
  sinceLoadMs: number,
  sinceConnectMs: number,
  show: boolean,
): { reconnect: boolean; reload: boolean } {
  return {
    reconnect: !live && sinceConnectMs >= WAKE_RETRY_MS,
    reload: (!live && sinceLoadMs >= WAKE_RETRY_MS) || (show && sinceLoadMs >= WAKE_STALE_MS),
  }
}

// The server's notice on the system event that postgres changes are streaming.
// It comes a moment after SUBSCRIBED (measured 0.3 s) and a change in between is not sent.
export function isPostgresReady(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as { status?: unknown; extension?: unknown }
  return p.status === 'ok' && p.extension === 'postgres_changes'
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run src/vinnubord/lib/realtime.test.ts`
Expected: PASS, 16 tests (4 old, 12 new).

- [ ] **Step 5: Commit**

```bash
git add src/vinnubord/lib/realtime.ts src/vinnubord/lib/realtime.test.ts
git commit -m "feat(vinnubord): pure rules for healing and waking the board channel"
```

---

### Task 2: The hook heals and wakes

**Files:**
- Modify: `src/vinnubord/hooks/useBoardData.ts` (the whole file is replaced)
- Modify: `src/shared/i18n/locales/en.json` (one value)
- Modify: `src/shared/i18n/locales/is.json` (one value)

**Interfaces:**
- Consumes from Task 1: `channelStep`, `healDelay`, `isPostgresReady`, `wakePlan` from `../lib/realtime`.
- Produces: `useBoardData(projectId)` returns the same `{ data, loading, error, reload, live }` as before. No caller changes.

**Verification set:** `npm run test`, `npm run build`, and the browser check in Step 6 on the one route `/p/metta` in `npm run dev` at the default desktop viewport, signed in as the `.env` smoke user. Nothing else needs checking by the implementer: not the settings page, not phone or tablet viewports, not `npm run shots:hg`.

- [ ] **Step 1: Replace the hook**

Replace the whole of `src/vinnubord/hooks/useBoardData.ts` with:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'
import { loadBoard } from '../lib/api'
import { channelStep, healDelay, isPostgresReady, wakePlan } from '../lib/realtime'
import type { BoardData } from '../lib/types'

// Tables in the supabase_realtime publication. hg_projects and hg_participants
// are not published, so they are not subscribed to.
const REALTIME_TABLES = [
  'hg_items',
  'hg_plans',
  'hg_files',
  'hg_questions',
  'hg_actions',
  'hg_rulings',
  'hg_comments',
  'hg_events',
  'hg_reads',
  'hg_modules',
  'hg_packages',
  'hg_views',
  'hg_tags',
  'hg_view_positions',
  'hg_view_pack_positions',
  'hg_zones',
  'hg_view_zone_positions',
] as const

const RELOAD_DEBOUNCE_MS = 150

export function useBoardData(projectId: string | null | undefined) {
  const [data, setData] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Whether the realtime channel is subscribed (ruling R17), for the "Lifandi" dot.
  const [live, setLive] = useState(false)
  // Only the newest request may write state, so a slow older response
  // cannot overwrite a newer board.
  const requestRef = useRef(0)
  // When the last load began, for the wake rule.
  const loadAtRef = useRef(0)

  const reload = useCallback(async () => {
    if (!projectId) return
    const request = ++requestRef.current
    loadAtRef.current = Date.now()
    try {
      const board = await loadBoard(projectId)
      if (request !== requestRef.current) return
      setData(board)
      setError(null)
    } catch (e) {
      if (request !== requestRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setData(null)
    setError(null)
    setLive(false)
    if (!projectId) {
      requestRef.current++
      setLoading(false)
      return
    }
    setLoading(true)
    void reload()

    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void reload()
      }, RELOAD_DEBOUNCE_MS)
    }

    // The one current channel. A channel the server closes (CLOSED) never
    // rejoins on its own, so it is replaced, never revived.
    let channel: RealtimeChannel | null = null
    let isLive = false
    let lost = false
    // After a gap: one more reload when the server says the stream is on.
    let recheck = false
    let connectAt = 0
    // Only the newest connect may build a channel.
    let generation = 0
    let healTimer: ReturnType<typeof setTimeout> | null = null
    let healAttempt = 0

    // Runs connect again unless the channel goes live first.
    const armHeal = () => {
      if (healTimer) clearTimeout(healTimer)
      healTimer = setTimeout(() => {
        healTimer = null
        void connect()
      }, healDelay(healAttempt++))
    }

    const connect = async () => {
      const mine = ++generation
      connectAt = Date.now()
      armHeal()
      try {
        // A hidden tab stops refreshing the session, and realtime only gets a
        // new token when a refresh happens: refresh first, then hand it over.
        const { data: auth } = await supabase.auth.getSession()
        if (auth.session) await supabase.realtime.setAuth(auth.session.access_token)
      } catch {
        // The join fails without a valid token and the heal timer tries again.
      }
      if (!active || mine !== generation) return

      const old = channel
      const next = supabase.channel(`hg_${projectId}_${crypto.randomUUID()}`)
      for (const table of REALTIME_TABLES) {
        next.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `project_id=eq.${projectId}` },
          scheduleReload,
        )
      }
      next.on('system', {}, (payload: unknown) => {
        if (channel !== next || !recheck || !isPostgresReady(payload)) return
        recheck = false
        scheduleReload()
      })
      channel = next
      if (old) {
        // Changes between the two channels are fetched when the new one subscribes.
        lost = true
        void supabase.removeChannel(old)
      }
      next.subscribe((status) => {
        // A replaced channel still reports CLOSED when it is removed.
        if (!active || channel !== next) return
        const step = channelStep(lost, status)
        lost = step.lost
        if (step.live !== null) {
          isLive = step.live
          setLive(step.live)
        }
        if (step.live === true) {
          healAttempt = 0
          if (healTimer) {
            clearTimeout(healTimer)
            healTimer = null
          }
        }
        if (step.live === false && !healTimer) armHeal()
        // Back after a gap: fetch what changed while the channel was down, and
        // once more when the stream is on (the system notice above).
        if (step.reload) {
          recheck = true
          scheduleReload()
        }
      })
    }

    // The tab is shown again, the window gets focus, the network returns, or
    // a press lands while the board is not live.
    const wake = (show: boolean) => {
      if (!active || document.visibilityState === 'hidden') return
      const now = Date.now()
      const plan = wakePlan(isLive, now - loadAtRef.current, now - connectAt, show)
      if (plan.reconnect) {
        healAttempt = 0
        void connect()
      }
      if (plan.reload) scheduleReload()
    }
    const onShow = () => wake(true)
    const onPress = () => wake(false)
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    window.addEventListener('online', onShow)
    // Capture phase: the board stops some presses before they bubble.
    window.addEventListener('pointerdown', onPress, true)

    void connect()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
      if (healTimer) clearTimeout(healTimer)
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
      window.removeEventListener('online', onShow)
      window.removeEventListener('pointerdown', onPress, true)
      requestRef.current++
      if (channel) void supabase.removeChannel(channel)
    }
  }, [projectId, reload])

  return { data, loading, error, reload, live }
}
```

- [ ] **Step 2: Change the hint under the dot**

In `src/shared/i18n/locales/en.json`, replace the line

```json
      "connectingHint": "Not connected yet, changes from others show up after a reload",
```

with

```json
      "connectingHint": "Not connected, trying again. Click the board to try at once.",
```

Run `npm run translate`, then open `src/shared/i18n/locales/is.json` and make the `connectingHint` line read exactly:

```json
      "connectingHint": "Ekki tengt, reyni aftur. Smelltu á borðið til að reyna strax.",
```

Check `git diff src/shared/i18n/locales/is.json`: `connectingHint` is the only changed line. If any other key changed, restore that line from git. If `npm run translate` fails (no key or no network), write the Icelandic line by hand and say so in the report.

- [ ] **Step 3: Run the tests**

Run: `npm run test`
Expected: PASS, 653 tests (641 before this plan, 12 from Task 1).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0, no TypeScript error.

- [ ] **Step 5: Start the dev server and sign in**

Run `npm run dev` in the background and note the port it prints (5173 or 5174). With the Playwright MCP browser: open `http://localhost:<port>/login`, sign in with `HG_SMOKE_EMAIL` and `HG_SMOKE_PASSWORD` from `.env`, and wait for `/p/metta` to show the board. Open no item panel (that would write a read mark as the service user). Wait until the dot reads "Lifandi" (`.hg-live` without `hg-live-off`).

- [ ] **Step 6: Close the channel the way the server does and watch it heal**

Each check is one `browser_evaluate` on the same page, with no navigation or reload between them. Never click the board with the mouse tools: a click on a card opens its panel and writes a read mark as the service user. The press is a synthetic `pointerdown` on `window`, which is what the hook listens to. `loads()` counts the board reloads the page has made.

Check A, one channel on a fresh load (it also widens the resource timing buffer the later checks read):

```js
async () => {
  performance.setResourceTimingBufferSize(5000)
  const { supabase } = await import('/src/shared/lib/supabase.ts')
  return supabase.realtime.getChannels().length
}
```

Expected: `1`. If it is `0`, the import made a second client: stop and report BLOCKED with that fact.

Check B, the heal timer closes the gap with nobody touching the page:

```js
async () => {
  const { supabase } = await import('/src/shared/lib/supabase.ts')
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const loads = () => performance.getEntriesByType('resource').filter((e) => e.name.includes('/rest/v1/hg_items')).length
  const read = () => ({ off: !!document.querySelector('.hg-live.hg-live-off'), channels: supabase.realtime.getChannels().length })
  const before = loads()
  supabase.realtime.getChannels()[0].channelAdapter.getChannel().trigger('phx_close')
  await wait(300)
  const closed = read()
  await wait(2700)
  const at3s = read()
  await wait(4000)
  return { closed, at3s, healed: read(), reloaded: loads() > before }
}
```

Expected: `closed` and `at3s` are `{ off: true, channels: 0 }` (the heal waits 4 s), `healed` is `{ off: false, channels: 1 }`, `reloaded` is `true`.

Check C, a press heals at once. Run it at least 4 seconds after Check B returned:

```js
async () => {
  const { supabase } = await import('/src/shared/lib/supabase.ts')
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const loads = () => performance.getEntriesByType('resource').filter((e) => e.name.includes('/rest/v1/hg_items')).length
  const read = () => ({ off: !!document.querySelector('.hg-live.hg-live-off'), channels: supabase.realtime.getChannels().length })
  const before = loads()
  supabase.realtime.getChannels()[0].channelAdapter.getChannel().trigger('phx_close')
  await wait(300)
  const closed = read()
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await wait(2200)
  return { closed, healed: read(), reloaded: loads() > before }
}
```

Expected: `closed` is `{ off: true, channels: 0 }`, `healed` is `{ off: false, channels: 1 }` 2.5 seconds after the close, which is before the 4 second heal timer, and `reloaded` is `true`.

Check D, a press on a live board does nothing:

```js
async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const loads = () => performance.getEntriesByType('resource').filter((e) => e.name.includes('/rest/v1/hg_items')).length
  const before = loads()
  for (let i = 0; i < 3; i++) window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  await wait(2000)
  return { extraLoads: loads() - before, off: !!document.querySelector('.hg-live.hg-live-off') }
}
```

Expected: `{ extraLoads: 0, off: false }`. Someone else writing to the board in those two seconds also reloads it: if `extraLoads` is not 0, run Check D once more, and report both results if it is still not 0.

Record the four results in the report. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/hooks/useBoardData.ts src/shared/i18n/locales/en.json src/shared/i18n/locales/is.json
git commit -m "fix(vinnubord): the board channel heals itself and reloads on wake"
```

---

### Task 3: CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none.

**Verification set:** read the diff. Nothing else needs checking by the implementer.

- [ ] **Step 1: Add the key pattern**

In `CLAUDE.md`, under `## Key Patterns`, insert this bullet directly after the bullet that begins `- **Realtime board data.**`:

```markdown
- **The board channel heals itself.** A channel the server closes never rejoins on its own (measured: state `closed`, zero channels on the socket, no events, while the socket stays connected), so `useBoardData` replaces it instead of waiting. Whenever the channel is not live a heal timer (`healDelay` in `lib/realtime.ts`: 4, 10, then 30 s) runs `connect`, which refreshes the session, hands realtime the token (supabase-js keeps realtime in manual token mode and a hidden tab stops refreshing), subscribes a new channel and removes the old one; a status from a replaced channel is ignored. A wake (`wakePlan`: the tab becomes visible, the window gets focus, the network returns, or a press anywhere while not live) reconnects at once when not live and reloads a live board whose last load is older than `WAKE_STALE_MS` (30 s); a press on a live board does nothing. After a gap the board reloads on `SUBSCRIBED` and once more when the server reports the postgres stream is on (`isPostgresReady`), because a change between the two is not sent. To test it, close the channel the way the server does, in `npm run dev`: `(await import('/src/shared/lib/supabase.ts')).supabase.realtime.getChannels()[0].channelAdapter.getChannel().trigger('phx_close')`. The plan and the measurements are in `docs/superpowers/plans/2026-11-12-lifandi-tenging.md`.
```

- [ ] **Step 2: Update the test count**

In `CLAUDE.md`, under `## Current state`, the first line reads `Plans 1 to 16 are built (641 vitest tests, ...`. Replace `641` in that line with the number `npm run test` printed in Task 2 Step 3 (expected 653). Change nothing else in that line.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(vinnubord): the board channel heals itself"
```

---

## What Heimir checks after the deploy

1. Open huginn.pro, leave the tab hidden for more than an hour (another tab in front, or another desktop), and let Claude update an item in that time. Come back: the dot reads "Lifandi" and the list sorted by "Síðast breytt" has the item on top, with no refresh.
2. Put the PC to sleep with the board open, wake it: the board is current within a few seconds.
3. If the dot ever reads "Tengist" for more than half a minute while the network is up, that is a bug: say when it happened.

## Expiry probe

Pending when the plan was written (started 2026-11-12, a listener whose token is never refreshed, a second client writing a harmless position every 30 s after expiry). The result is added here.
