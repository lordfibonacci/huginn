# Sími og spjaldtölva Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The same whiteboard works like a native app on phones and tablets: smooth pinch and pan, a readable opening view, filters on one button, a full height sheet, and no visual change on mouse desktops.

**Architecture:** The view moves out of React state into a ref that writes the world transform directly, with React synced only at gesture end. Touch devices (`pointer: coarse`) drop backdrop blur, canvas shadow blur and ambient sparks through tokens and one flag in Wires. The top bar below 1024 px moves its three filter menus into one button and a bottom sheet that reuses the existing menu components inline. The item sheet becomes a fixed height panel moved by transform, draggable from handle, head and body.

**Tech Stack:** React 19, TypeScript, pointer and touch events, canvas 2D, CSS custom properties, vitest, Playwright (new devDependency, scripts only).

**Spec:** `docs/superpowers/specs/2026-11-01-simi-og-spjaldtolva-design.md`. Read it first; the plan argues from it and does not repeat its reasoning.

## Global Constraints

- No em dashes or hyphen dashes as punctuation anywhere: code comments, UI copy, docs, commit messages. Commas, periods or colons.
- Icelandic UI. New strings go in `src/shared/i18n/locales/en.json` under `vinnubord.*`, then `npm run translate`, then check the `is.json` diff and hand fix the Icelandic (CLAUDE.md, Internationalization).
- Every new CSS value is a `--hg-*` token on `:root` in `src/vinnubord/vinnubord.css`; rules read tokens only. Breakpoints stay literal (767px, 1023px, 1099px, 1279px).
- Touch savings live under `@media (pointer: coarse)`. A mouse desktop at 1440 x 900 must look and behave as before, except that zoom buttons, fit and the pack title now glide over `--hg-dur-view` (220 ms).
- The useViewport and useCardDrag contract (file headers) stays; the touch on buttons rule is added to it.
- `cli/lib/parity.test.mjs` must stay green: do not change `--hg-pack-*`, `--hg-module-*` or `--hg-card-*` size tokens.
- Commit per task, prefixes `feat(vinnubord):`, `fix(vinnubord):`, `test(vinnubord):`, `chore:`, `docs(vinnubord):`, with the `Co-Authored-By:` trailer for the model that wrote it.
- Verification gates: `npm run build` and `npm run test` green at the end of every task. Tasks name their own browser checks; nothing else needs checking by the implementer.
- Implementer budget: at about 60 tool calls or 150k context, commit what is green, report DONE_WITH_CONCERNS with what is left. Read code in large ranges with Read, not sed slices.
- Model routing (CLAUDE.md global): Sonnet for tasks whose code is in the plan (1, 2a, 2b, 7, 8, 9, 12), Opus for the rest. Reviewers never below Sonnet. Final whole branch review on Fable, fix rounds reviewed too.

## Review Focus

Inputs the spec implies that no task's tests exercise; each line's test is added to the owning task.

1. A second finger landing while a fling is running: the fling must stop and the pinch must start cleanly (Task 4, step 6 checks it in the perf script's pinch after a pan).
2. A touch that starts on a module, moves 6 px and lifts: the module must open (Task 3, step 7 asserts `touchSlop('button')` is 10 and the module opens in the phone shots).
3. The sheet body scrolled down, finger drags down: the body scrolls, the sheet does not move (Task 11, step 6).
4. A view switch or realtime refetch during a pinch: cards must not jump because React re-rendered the world transform (Task 3, step 3: Board never writes `transform` in a style prop).
5. Rotating a phone with the sheet open: the sheet stays at its stop and its height follows `100dvh` (Task 11, step 6).

---

### Task 1: Screenshot and timing script, baseline

**Files:**
- Create: `scripts/hg-shots.mjs`
- Modify: `package.json` (script `shots:hg`, devDependency `playwright`)
- Modify: `CLAUDE.md` (Commands block, one line)
- Create: `docs/progress/09-simi-og-spjaldtolva.md` (baseline numbers only for now)

**Interfaces:**
- Produces: `npm run shots:hg <phone|tablet|tabletLand|perf|all>` with `SITE` env (default `https://huginn.pro`). Output under `.playwright-mcp/shots/` (gitignored through `.playwright-mcp/`).

- [ ] **Step 1: Install Playwright**

Run: `npm i -D playwright@^1.64.1 && npx playwright install chromium-headless-shell`
Expected: `playwright` in devDependencies; the install prints the browser path or "already installed".

- [ ] **Step 2: Write `scripts/hg-shots.mjs`**

This is the full file. It signs in with the smoke credentials, injects the session, and never prints the password.

```js
// Screenshots and gesture timing of the board on an emulated phone and
// tablet. Signs in as the smoke user with the repo .env (the password never
// leaves this process), injects the session into headless Chromium and
// writes to .playwright-mcp/shots/. Usage: node scripts/hg-shots.mjs
// [phone|tablet|tabletLand|perf|all], SITE=http://localhost:4173 for a
// local preview. See the spec 2026-11-01-simi-og-spjaldtolva-design.md 4.9.
import { readFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { chromium, devices } from 'playwright'

const env = dotenv.parse(readFileSync(new URL('../.env', import.meta.url), 'utf8'))
const url = env.VITE_SUPABASE_URL
const ref = new URL(url).hostname.split('.')[0]
const sb = createClient(url, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const auth = await sb.auth.signInWithPassword({ email: env.HG_SMOKE_EMAIL, password: env.HG_SMOKE_PASSWORD })
if (auth.error) {
  console.error('sign in failed:', auth.error.message)
  process.exit(1)
}
const session = JSON.stringify(auth.data.session)
const key = `sb-${ref}-auth-token`

const SITE = process.env.SITE ?? 'https://huginn.pro'
const OUT = '.playwright-mcp/shots'
const which = process.argv[2] ?? 'all'
const THROTTLE = Number(process.env.THROTTLE ?? 4)
const VIEWS = {
  phone: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
  tablet: { ...devices['iPad (gen 7)'], viewport: { width: 810, height: 1080 } },
  tabletLand: { ...devices['iPad (gen 7) landscape'], viewport: { width: 1080, height: 810 } },
}

// Runs before the app: the session, Icelandic, and a frame recorder that
// notes the gap between animation frames and the work done inside them.
const init = ([k, s]) => {
  if (!localStorage.getItem(k)) localStorage.setItem(k, s)
  localStorage.setItem('huginn.lang', 'is')
  window.__gaps = []
  window.__work = []
  const raf = window.requestAnimationFrame.bind(window)
  let frameWork = 0
  let frameId = -1
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      const t0 = performance.now()
      try {
        cb(t)
      } finally {
        if (frameId !== t) {
          if (frameId !== -1) window.__work.push(frameWork)
          frameWork = 0
          frameId = t
        }
        frameWork += performance.now() - t0
      }
    })
  let last = performance.now()
  const tick = (t) => {
    window.__gaps.push(t - last)
    last = t
    raf(tick)
  }
  raf(tick)
}

const stats = (list) => {
  const sorted = [...list].sort((a, b) => a - b)
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0
  const mean = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0
  return `n=${sorted.length} mean=${mean.toFixed(1)} p50=${p(0.5).toFixed(0)} p90=${p(0.9).toFixed(0)} max=${p(1).toFixed(0)} >33ms=${sorted.filter((f) => f > 33).length}`
}

async function touchSeq(cdp, points, steps, ms) {
  const at = (t) => points.map((p) => ({ x: p.from.x + (p.to.x - p.from.x) * t, y: p.from.y + (p.to.y - p.from.y) * t }))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i / steps) })
    await new Promise((r) => setTimeout(r, ms / steps))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function tap(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await new Promise((r) => setTimeout(r, 80))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function open(browser, dev) {
  const ctx = await browser.newContext({ ...dev, colorScheme: 'dark' })
  await ctx.addInitScript(init, [key, session])
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`)
  })
  await page.goto(`${SITE}/p/metta`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.hg-card', { timeout: 20000 })
  await page.waitForTimeout(2500)
  const cdp = await ctx.newCDPSession(page)
  return { ctx, page, cdp, errors }
}

// A card fully on screen below the top bar, or null.
const cardOnScreen = (page) =>
  page.evaluate(() => {
    const top = document.querySelector('.hg-top')?.getBoundingClientRect().bottom ?? 0
    for (const el of document.querySelectorAll('.hg-card')) {
      const r = el.getBoundingClientRect()
      if (r.left > 10 && r.right < innerWidth - 10 && r.top > top + 10 && r.bottom < innerHeight - 160) {
        return { x: r.left + r.width / 2, y: r.top + 24 }
      }
    }
    return null
  })

async function shots(browser, name, dev) {
  const { ctx, page, cdp, errors } = await open(browser, dev)
  const shot = (n) => page.screenshot({ path: `${OUT}/${name}-${n}.png` })
  await shot('1-load')
  const info = await page.evaluate(() => {
    const z = getComputedStyle(document.querySelector('.hg-world')).getPropertyValue('--hg-z')
    const counts = document.querySelector('.hg-counts')?.getBoundingClientRect()
    return { zoom: Number(z).toFixed(3), cards: document.querySelectorAll('.hg-card').length, countsWidth: counts ? Math.round(counts.width) : null }
  })
  console.log(name, JSON.stringify(info))
  for (let i = 0; i < 12; i++) await page.locator('.hg-zoom button').first().click()
  await page.waitForTimeout(800)
  await shot('2-zoomed-out')
  await page.locator('.hg-zoom button').nth(2).click()
  await page.waitForTimeout(800)
  await shot('3-fit')
  const filterBtn = page.locator('.hg-filter-btn')
  if (await filterBtn.isVisible()) {
    await filterBtn.click()
    await page.waitForTimeout(500)
    await shot('4-filters')
    await page.keyboard.press('Escape')
  } else {
    await page.locator('.hg-top-g .hg-ddb').first().click()
    await page.waitForTimeout(400)
    await shot('4-menu')
    await page.keyboard.press('Escape')
  }
  await page.waitForTimeout(300)
  // Back to the opening view, then open a card that is on screen.
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.hg-card')
  await page.waitForTimeout(2000)
  const box = await cardOnScreen(page)
  if (box) {
    await tap(cdp, box.x, box.y)
    await page.waitForTimeout(1000)
    await shot('5-panel')
    const handle = await page.locator('.hg-sheet-handle').boundingBox()
    if (handle) {
      const hx = handle.x + handle.width / 2
      await touchSeq(cdp, [{ from: { x: hx, y: handle.y + 10 }, to: { x: hx, y: handle.y + 380 } }], 20, 300)
      await page.waitForTimeout(900)
      await shot('5b-panel-half')
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
  } else console.log(name, 'no card on screen to tap')
  const sbtn = page.locator('.hg-search-btn')
  if (await sbtn.isVisible()) {
    await sbtn.click()
    await page.waitForTimeout(400)
    await shot('6-search')
    await page.keyboard.press('Escape')
  }
  await page.locator('.hg-new').click()
  await page.waitForTimeout(600)
  await shot('7-new')
  await page.keyboard.press('Escape')
  if (errors.length) console.log(name, 'console:', errors.slice(0, 10))
  await ctx.close()
}

async function perf(browser) {
  const { ctx, page, cdp } = await open(browser, VIEWS.phone)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const measure = async (label, fn) => {
    await page.evaluate(() => {
      window.__gaps.length = 0
      window.__work.length = 0
    })
    await fn()
    const { gaps, work } = await page.evaluate(() => ({ gaps: window.__gaps.slice(), work: window.__work.slice() }))
    console.log(`${label.padEnd(16)} gap  ${stats(gaps)}`)
    console.log(`${''.padEnd(16)} work ${stats(work)}`)
  }
  for (let i = 0; i < 12; i++) await page.locator('.hg-zoom button').first().click()
  await page.waitForTimeout(600)
  await measure('pinch-out@min', () =>
    touchSeq(cdp, [{ from: { x: 170, y: 500 }, to: { x: 60, y: 500 } }, { from: { x: 220, y: 500 }, to: { x: 330, y: 500 } }], 60, 1000),
  )
  await page.waitForTimeout(400)
  await measure('pan', () => touchSeq(cdp, [{ from: { x: 300, y: 600 }, to: { x: 80, y: 300 } }], 60, 1000))
  await page.waitForTimeout(400)
  await measure('pinch-in', () =>
    touchSeq(cdp, [{ from: { x: 60, y: 500 }, to: { x: 170, y: 500 } }, { from: { x: 330, y: 500 }, to: { x: 220, y: 500 } }], 60, 1000),
  )
  await page.waitForTimeout(1200)
  await measure('idle', () => page.waitForTimeout(1000))
  await ctx.close()
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, dev] of Object.entries(VIEWS)) {
    if (which === 'all' || which === name) await shots(browser, name, dev)
  }
  if (which === 'all' || which === 'perf') await perf(browser)
} finally {
  await browser.close()
}
```

- [ ] **Step 3: Add the npm script and the CLAUDE.md line**

`package.json` scripts: `"shots:hg": "node scripts/hg-shots.mjs"`.
`CLAUDE.md` Commands block, after `smoke:hg`: `npm run shots:hg [phone|tablet|tabletLand|perf|all]  # phone and tablet screenshots and pinch timing in .playwright-mcp/shots/, signs in from .env; SITE=http://localhost:4173 for a local preview; needs npx playwright install chromium-headless-shell once`.

- [ ] **Step 4: Run the baseline against the production build of main**

Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg all`
Expected: three `*-1-load.png` and the rest under `.playwright-mcp/shots/`, a `phone {...}` line with `"zoom":"0.079"` or so, and eight `gap`/`work` lines for perf. Stop the preview afterwards.

- [ ] **Step 5: Record the baseline**

Create `docs/progress/09-simi-og-spjaldtolva.md` with the header style of `docs/progress/08-handtok-breytt.md` (Dagsetning, Grein, Plan, Spekk, Staða: "í byggingu") and a section `## Grunnlína` holding the perf output verbatim and the zoom and `countsWidth` of the three load lines.

- [ ] **Step 6: Commit**

```bash
git add scripts/hg-shots.mjs package.json package-lock.json CLAUDE.md docs/progress/09-simi-og-spjaldtolva.md
git commit -m "chore: hg-shots script, phone and tablet screenshots and pinch timing"
```

---

### Task 2a: Pure gesture rules and the fling

**Files:**
- Modify: `src/vinnubord/lib/gesture.ts`, `src/vinnubord/lib/gesture.test.ts`
- Create: `src/vinnubord/lib/fling.ts`, `src/vinnubord/lib/fling.test.ts`

**Interfaces:**
- Produces in `gesture.ts`: `type TouchKind = 'field' | 'noPan' | 'button' | 'card' | 'board'`; `touchTracks(kind: TouchKind): boolean`; `touchSlop(kind: TouchKind): number`; `panStep(s: { slop: number; dragging: boolean; dist: number }): 'wait' | 'start' | 'blocked'` (replaces `fromCard`); `DOUBLE_TAP_MS = 300`, `DOUBLE_TAP_SLOP = 24`, `type Tap = { t: number; x: number; y: number }`, `isDoubleTap(prev: Tap | null, next: Tap): boolean`.
- Produces in `fling.ts`: `FLING_WINDOW_MS = 80`, `FLING_START = 0.2`, `FLING_STOP = 0.02`, `FLING_DECAY = 0.95`, `type Sample = { t: number; x: number; y: number }`, `type Velocity = { vx: number; vy: number }`, `releaseVelocity(samples: Sample[], releasedAt: number): Velocity`, `flingStep(v: Velocity, dt: number): { dx: number; dy: number; vx: number; vy: number }`, `flingDone(v: Velocity): boolean`, `flingStarts(v: Velocity): boolean`.

- [ ] **Step 1: Write the failing gesture tests**

In `gesture.test.ts`, change the `panStep` describe to pass `slop: PAN_THRESHOLD` or `slop: CARD_PAN_SLOP` instead of `fromCard`, and add:

```ts
describe('touchTracks and touchSlop', () => {
  it('ignores fields and data-no-pan, tracks everything else', () => {
    expect(touchTracks('field')).toBe(false)
    expect(touchTracks('noPan')).toBe(false)
    expect(touchTracks('button')).toBe(true)
    expect(touchTracks('card')).toBe(true)
    expect(touchTracks('board')).toBe(true)
  })
  it('buttons and cards pan past the card slop, the board past the pan threshold', () => {
    expect(touchSlop('button')).toBe(CARD_PAN_SLOP)
    expect(touchSlop('card')).toBe(CARD_PAN_SLOP)
    expect(touchSlop('board')).toBe(PAN_THRESHOLD)
  })
})

describe('isDoubleTap', () => {
  const a = { t: 1000, x: 100, y: 100 }
  it('is false without a previous tap', () => expect(isDoubleTap(null, a)).toBe(false))
  it('is true within 300 ms and 24 px', () => expect(isDoubleTap(a, { t: 1299, x: 120, y: 110 })).toBe(true))
  it('is false after 300 ms', () => expect(isDoubleTap(a, { t: 1301, x: 100, y: 100 })).toBe(false))
  it('is false past 24 px', () => expect(isDoubleTap(a, { t: 1100, x: 125, y: 100 })).toBe(false))
})
```

Distance for `isDoubleTap` is Manhattan, like the rest of the file.

- [ ] **Step 2: Write the failing fling tests**

```ts
import { describe, expect, it } from 'vitest'
import { FLING_DECAY, FLING_START, FLING_STOP, flingDone, flingStarts, flingStep, releaseVelocity } from './fling'

describe('releaseVelocity', () => {
  it('uses the samples inside the 80 ms window before release', () => {
    const v = releaseVelocity([{ t: 0, x: 0, y: 0 }, { t: 50, x: 100, y: 0 }, { t: 100, x: 150, y: 20 }], 100)
    // 100 px over 50 ms from the first sample inside the window (t 50) to the last (t 100): 1 px/ms, y 0.4
    expect(v.vx).toBeCloseTo(1)
    expect(v.vy).toBeCloseTo(0.4)
  })
  it('is zero with fewer than two samples in the window', () => {
    expect(releaseVelocity([{ t: 100, x: 5, y: 5 }], 100)).toEqual({ vx: 0, vy: 0 })
  })
  it('is zero when the finger rested before release', () => {
    expect(releaseVelocity([{ t: 0, x: 0, y: 0 }, { t: 10, x: 100, y: 0 }], 200)).toEqual({ vx: 0, vy: 0 })
  })
})

describe('flingStep and flingDone', () => {
  it('moves by velocity times dt and decays by FLING_DECAY per 16 ms', () => {
    const s = flingStep({ vx: 1, vy: 0 }, 16)
    expect(s.dx).toBeCloseTo(16)
    expect(s.vx).toBeCloseTo(FLING_DECAY)
  })
  it('clamps dt to 32 ms', () => {
    expect(flingStep({ vx: 1, vy: 0 }, 100).dx).toBeCloseTo(32)
  })
  it('starts above FLING_START and ends below FLING_STOP', () => {
    expect(flingStarts({ vx: FLING_START + 0.01, vy: 0 })).toBe(true)
    expect(flingStarts({ vx: 0.1, vy: 0.1 })).toBe(false)
    expect(flingDone({ vx: FLING_STOP / 2, vy: 0 })).toBe(true)
    expect(flingDone({ vx: 0.1, vy: 0 })).toBe(false)
  })
})
```

`releaseVelocity`: samples with `t >= releasedAt - FLING_WINDOW_MS`; the last sample must be within the window too (a release more than 80 ms after the last move gives zero); velocity is last minus first of those over their time gap. `flingStarts` and `flingDone` compare `Math.hypot(vx, vy)`.

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/vinnubord/lib/gesture.test.ts src/vinnubord/lib/fling.test.ts`
Expected: FAIL, missing exports.

- [ ] **Step 4: Implement**

`gesture.ts`: the types and functions from Interfaces; `panStep` reads `s.slop`. `fling.ts`: new file with the header comment style of `spring.ts`.

- [ ] **Step 5: Run the tests and the build**

Run: `npx vitest run src/vinnubord/lib && npm run build`
Expected: the two files pass; the build fails only in `useViewport.ts` on `fromCard` (Task 3 fixes it). If so, change the call in `useViewport.ts` line 311 to `panStep({ slop: p.fromCard ? CARD_PAN_SLOP : PAN_THRESHOLD, dragging: false, dist })` so the build is green now.

- [ ] **Step 6: Commit**

```bash
git add src/vinnubord/lib/gesture.ts src/vinnubord/lib/gesture.test.ts src/vinnubord/lib/fling.ts src/vinnubord/lib/fling.test.ts src/vinnubord/hooks/useViewport.ts
git commit -m "feat(vinnubord): touch kinds, double tap rule and fling maths"
```

---

### Task 2b: Pure geometry, sheet and filter helpers

**Files:**
- Modify: `src/vinnubord/lib/geometry.ts`, `src/vinnubord/lib/geometry.test.ts`
- Modify: `src/vinnubord/lib/sheet.ts`, `src/vinnubord/lib/sheet.test.ts`
- Modify: `src/vinnubord/lib/filters.ts`, `src/vinnubord/lib/filters.test.ts`

**Interfaces:**
- Produces in `geometry.ts`: `fitWidth(rect: Rect, viewport: { w: number; h: number }, padding: { top: number; sides: number; bottom: number }, maxZoom = FIT_MAX_ZOOM): View`; `START_ZOOM = 0.8`, `START_PAD = 16`, `startAtPack(pack: { x: number; y: number }, z = START_ZOOM, pad = START_PAD): View`.
- Produces in `sheet.ts`: `OPEN_STOP: SheetStop = 'full'`.
- Produces in `filters.ts`: `withoutPicks(f: Filter): Filter` (empties `packages` and `tags`, keeps `tones`, `q`, `unread`; returns `f` itself when both are already empty).

- [ ] **Step 1: Write the failing tests**

`geometry.test.ts`:

```ts
describe('fitWidth', () => {
  const vp = { w: 390, h: 800 }
  const pad = { top: 90, sides: 40, bottom: 60 }
  it('zooms the rect to the padded width and puts its top at the top padding', () => {
    const v = fitWidth({ x: 1102, y: 60, w: 440, h: 2000 }, vp, pad)
    expect(v.z).toBeCloseTo(310 / 440)
    expect(v.x + 1102 * v.z).toBeCloseTo(40)
    expect(v.y + 60 * v.z).toBeCloseTo(90)
  })
  it('never zooms past maxZoom and centres a narrow rect', () => {
    const v = fitWidth({ x: 0, y: 0, w: 100, h: 100 }, vp, pad)
    expect(v.z).toBe(FIT_MAX_ZOOM)
    expect(v.x).toBeCloseTo(40 + (310 - 100 * FIT_MAX_ZOOM) / 2)
  })
})

describe('startAtPack', () => {
  it('puts the pack corner at the padding in zoom 0.8', () => {
    const v = startAtPack({ x: 1102, y: 60 })
    expect(v.z).toBe(0.8)
    expect(v.x + 1102 * v.z).toBeCloseTo(16)
    expect(v.y + 60 * v.z).toBeCloseTo(16)
  })
})
```

`sheet.test.ts`: `it('opens full', () => expect(OPEN_STOP).toBe('full'))`.

`filters.test.ts`, inside `describe('toggleFilter and withQuery', ...)` or a new describe:

```ts
it('withoutPicks drops packages and tags and keeps the rest', () => {
  const f = { tones: new Set<Tone>(['gold']), packages: new Set(['p']), tags: new Set(['t']), q: 'x', unread: true }
  const r = withoutPicks(f)
  expect([...r.packages]).toEqual([])
  expect([...r.tags]).toEqual([])
  expect([...r.tones]).toEqual(['gold'])
  expect(r.q).toBe('x')
  expect(r.unread).toBe(true)
  const e = emptyFilter()
  expect(withoutPicks(e)).toBe(e)
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/vinnubord/lib/geometry.test.ts src/vinnubord/lib/sheet.test.ts src/vinnubord/lib/filters.test.ts`
Expected: FAIL, missing exports.

- [ ] **Step 3: Implement the four functions and the constant**

`fitWidth`: `W = max(1, viewport.w - 2 * padding.sides)`, `z = min(maxZoom, W / rect.w)`, `x = padding.sides + (W - rect.w * z) / 2 - rect.x * z`, `y = padding.top - rect.y * z`.

- [ ] **Step 4: Run the tests and the build**

Run: `npx vitest run src/vinnubord/lib && npm run build`
Expected: PASS, build green.

- [ ] **Step 5: Commit**

```bash
git add src/vinnubord/lib/geometry.ts src/vinnubord/lib/geometry.test.ts src/vinnubord/lib/sheet.ts src/vinnubord/lib/sheet.test.ts src/vinnubord/lib/filters.ts src/vinnubord/lib/filters.test.ts
git commit -m "feat(vinnubord): fitWidth, startAtPack, OPEN_STOP and withoutPicks"
```

---

### Task 3: The view lives in a ref

**Files:**
- Modify: `src/vinnubord/hooks/useViewport.ts` (whole file)
- Modify: `src/vinnubord/hooks/useCardDrag.ts` (`view` option becomes `viewRef`)
- Modify: `src/vinnubord/components/Board.tsx` (world ref, zoom label ref, drag and placeNew read the ref, fit animated)
- Modify: `src/vinnubord/components/Wires.tsx` (`viewRef` prop, numeric compare)
- Modify: `src/vinnubord/vinnubord.css` (token `--hg-dur-view: 0.22s` in the Motion block, zeroed under reduced motion)

**Interfaces:**
- Produces `Viewport` (replaces the current type):

```ts
export type Gesture = { touchCount: number; pinching: boolean; pinches: number; dragPointer: number | null; active: boolean }
export type Padding = { top: number; sides: number; bottom: number }
export type Viewport = {
  view: View                                   // React state, synced at gesture end
  viewRef: RefObject<View>                     // live value, read in frames
  worldRef: RefObject<HTMLDivElement | null>   // Board puts it on .hg-world
  zoomLabelRef: RefObject<HTMLElement | null>  // Board puts it on .hg-zoom-val
  setView: (v: View) => void                   // apply at once and sync
  animateTo: (target: View, ms?: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fit: (rects: Rect[], padding?: Padding, animate?: boolean) => void      // animate defaults true
  fitWidth: (rect: Rect, padding?: Padding) => void                        // animated
  isPanning: boolean
  isPinching: boolean
  gestureRef: RefObject<Gesture>
  bind: ViewportBind
}
```

- Consumes: `panStep({ slop, ... })`, `touchTracks`, `touchSlop` (Task 2a); `fitWidth` from geometry (Task 2b); `parseDuration` from `lib/motion.ts`.
- `useCardDrag` option `view: View` becomes `viewRef: RefObject<View>`; `Wires` prop `view: View` becomes `viewRef: RefObject<View>`.

- [ ] **Step 1: Rewrite `useViewport` around `apply` and `sync`**

Internals the implementer writes, in this shape:

- `viewRef`, `worldRef`, `zoomLabelRef`, `const [view, setViewState] = useState<View>(start)`.
- `apply(v: View)`: sets `viewRef.current = v`; if `worldRef.current`, writes `style.transform = translate(v.x px, v.y px) scale(v.z)` and `style.setProperty('--hg-z', String(v.z))`; if `zoomLabelRef.current`, writes `textContent = Math.round(v.z * 100) + '%'`.
- `sync()`: `setViewState(viewRef.current)`.
- `setView(v)`: `apply(v); sync()`.
- A `useLayoutEffect` with no deps that calls `apply(viewRef.current)` when `worldRef.current` changed since last time (same pattern as the native listener effect), so a world that mounts after the loader gets its transform.
- `animateTo(target, ms = viewDurMs())`: cancels a running animation; `ms <= 0` means `setView(target)`; else a rAF loop from `viewRef.current` with `p = 1 - (1 - t) ** 3` interpolating x, y, z, `apply` each frame, `setView(target)` at the end. `viewDurMs()` reads `--hg-dur-view` with `parseDuration(getComputedStyle(document.documentElement).getPropertyValue('--hg-dur-view'))`, like `popMs` in Board.
- `zoomIn`/`zoomOut`: `animateTo(zoomAt(viewRef.current, BUTTON_STEP or 1 / BUTTON_STEP, w / 2, h / 2))`.
- `fit(rects, padding, animate = true)`: computes `fitAll(...)`; `animate ? animateTo(v) : setView(v)`.
- `fitWidth(rect, padding)`: `animateTo(fitWidth(rect, size(), padding))`.
- Pointer handlers: every `setView((v) => ...)` becomes `apply(f(viewRef.current))`. Pan and pinch set `gestureRef.current.active = true` when they first move the view; `endPointer` with the map empty sets it false and calls `sync()`. The native wheel handler applies and resets a 120 ms timer that calls `sync()`.
- `onPointerDown`: cancels a running animation (the view stays where it is). Touch kinds: `kind = target.closest('input, textarea, select') ? 'field' : target.closest('[data-no-pan]') ? 'noPan' : target.closest(CARD) ? 'card' : target.closest('button, a, label') ? 'button' : 'board'`. Touch: `if (!touchTracks(kind)) return`. Mouse and pen: keep today's rule (`NO_PAN` ignored, card ignored). `Tracked` gains `kind: TouchKind`; `pan.current` keeps `slop: touchSlop(kind)` instead of `fromCard` (mouse uses `PAN_THRESHOLD`); the drag pointer check (`p.fromCard && dragPointer === id`) becomes `kind === 'card' && ...`.
- Update the header comment: Rules get "Touch on a button, link or label inside the board (module cards, pack titles) pans past CARD_PAN_SLOP and pinches like a card; only fields and [data-no-pan] are ignored." and a paragraph "The view lives in viewRef and is written to the world element directly; React state follows at gesture end."

- [ ] **Step 2: `useCardDrag` reads `viewRef`**

Option `viewRef: RefObject<View>`; `const z = o.current.viewRef.current.z`. Header comment: one line.

- [ ] **Step 3: Board uses the refs**

- `<div ref={vp.worldRef} className="hg-world" {...drag.bind}>` with no `style` prop. Nothing in Board writes `transform` or `--hg-z` any more.
- `<span ref={vp.zoomLabelRef} className="hg-zoom-val" ...>{Math.round(view.z * 100)}%</span>` stays rendered from state too.
- `useCardDrag({ viewRef: vp.viewRef, ... })`, `<Wires viewRef={vp.viewRef} ... />`, `placeNew` reads `vp.viewRef.current` instead of `view`, and `useImperativeHandle` deps drop `view`.
- The first fit (`fitted` effect) calls `fitAll()` which now passes `animate = false` for the first fit: give `fitAll` a parameter `animate: boolean` and have the button call `fitAll(true)`, the first load `fitAll(false)`.

- [ ] **Step 4: Wires compares numbers**

Prop `viewRef`; `live.current.viewRef`; in the frame `const v = viewRef.current`; `changed` uses `drawn.view.x !== v.x || drawn.view.y !== v.y || drawn.view.z !== v.z`; `drawn.view = { ...v }` (a copy, since the ref object is mutated by apply). `bezierControl(e, v.z)` and `zs` unchanged.

- [ ] **Step 5: The token**

Motion block of `vinnubord.css`: `--hg-dur-view: 0.22s;` with the comment "zoom buttons, fit, pack title and double tap glide"; reduced motion block: `--hg-dur-view: 0s;`.

- [ ] **Step 6: Build, tests, desktop check**

Run: `npm run build && npm run test`
Expected: green (457 plus Task 2 tests).
Browser (Playwright MCP, 1440 x 900, `npm run dev`, signed in as Heimir or the service user): wheel zoom around the cursor; drag a card and drop it (it springs and saves); pan on empty board; click the fit button and see the glide; `+` and `-` glide and the percentage follows during the glide; open a card by click. Nothing else.

- [ ] **Step 7: Phone shot check**

Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg phone`
Expected: `phone-5-panel.png` shows the sheet open (a tap on a card still opens it), no console errors. For Review Focus 2 (a module tap that wobbles 6 px still opens the module) add, temporarily and not committed, to the phone run after the card tap: find a `.hg-mod` on screen the same way as `cardOnScreen`, then `touchSeq(cdp, [{ from: { x, y }, to: { x: x + 4, y: y + 4 } }], 3, 80)`; expected: the module panel opens (`.hg-panel-open` present with the module name in `.hg-pn-title`).

- [ ] **Step 8: Commit**

```bash
git add src/vinnubord/hooks/useViewport.ts src/vinnubord/hooks/useCardDrag.ts src/vinnubord/components/Board.tsx src/vinnubord/components/Wires.tsx src/vinnubord/vinnubord.css
git commit -m "feat(vinnubord): the view lives in a ref, React syncs at gesture end"
```

---

### Task 4: Fling and double tap

**Files:**
- Modify: `src/vinnubord/hooks/useViewport.ts`

**Interfaces:**
- Consumes: `releaseVelocity`, `flingStarts`, `flingStep`, `flingDone` (Task 2a); `isDoubleTap`, `Tap`, `DOUBLE_TAP_FACTOR` (add `export const DOUBLE_TAP_FACTOR = 2` to `gesture.ts`).

- [ ] **Step 1: Samples during a touch pan**

`pan.current` gains `samples: Sample[]` (touch only); `onPointerMove` pushes `{ t: e.timeStamp, x: pt.x, y: pt.y }` and drops samples older than `FLING_WINDOW_MS` before the newest. Pinch pointers keep no samples.

- [ ] **Step 2: Start the fling on release**

In `endPointer`, when the map becomes empty and the ending pointer was a touch pan that moved: `const v = releaseVelocity(samples, e.timeStamp)`; if `flingStarts(v)`, start `runFling(v)`: a rAF loop computing `dt` from frame timestamps, `const s = flingStep(v, dt)`, `apply({ ...viewRef.current, x: x + s.dx, y: y + s.dy })`, `v = { vx: s.vx, vy: s.vy }`, until `flingDone(v)`; then `gestureRef.current.active = false`, `setIsPanning(false)`, `sync()`. While it runs `active` and `isPanning` stay true and `sync()` is not called at pointer up. `onPointerDown` cancels the fling (same cancel as the animation) and remembers `stoppedMotion = true` for that gesture.

- [ ] **Step 3: Double tap**

`lastTap = useRef<Tap | null>(null)`. In `endPointer`, when the map becomes empty, the pointer was touch, `gestureMoved.current` is false, no pinch happened in this gesture, the tracked kind is `'board'` and the gesture did not stop a fling or animation: `const tap = { t: e.timeStamp, x: pt.x, y: pt.y }`; if `isDoubleTap(lastTap.current, tap)` then `lastTap.current = null` and `animateTo(zoomAt(viewRef.current, DOUBLE_TAP_FACTOR, tap.x, tap.y))`, else `lastTap.current = tap`. Any other release clears `lastTap`.

- [ ] **Step 4: Header comment**

Add to Rules: "Touch pan release above FLING_START px/ms flings the view (lib/fling), a new pointer stops it. Two taps on the empty board within DOUBLE_TAP_MS and DOUBLE_TAP_SLOP zoom in by DOUBLE_TAP_FACTOR around the point; taps on cards, modules and pack titles never count. Mouse gets neither."

- [ ] **Step 5: Build and tests**

Run: `npm run build && npm run test`
Expected: green.

- [ ] **Step 6: Phone perf check**

Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg perf`
Expected: four blocks print; `pinch-in` runs right after `pan` (the pan's fling is cut by the pinch's first touch) and prints without an error. Record the numbers in `docs/progress/09-simi-og-spjaldtolva.md` under `## Eftir task 4`.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/hooks/useViewport.ts src/vinnubord/lib/gesture.ts docs/progress/09-simi-og-spjaldtolva.md
git commit -m "feat(vinnubord): fling after a touch pan, double tap zooms in"
```

---

### Task 5: Opening view and pack title

**Files:**
- Modify: `src/vinnubord/components/Board.tsx`
- Modify: `src/vinnubord/components/PackColumn.tsx`
- Modify: `src/vinnubord/vinnubord.css` (`.hg-pack-title` as a button)
- Modify: `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json`

**Interfaces:**
- Consumes: `startAtPack`, `vp.fitWidth`, `vp.fit(rects, padding, false)` (Tasks 2b, 3); `packLayout` rows (first row is the first pack).
- Produces: `PackColumn` prop `onFitPack: (packageId: string) => void`.

- [ ] **Step 1: Opening view rule in Board**

Constant `START_PACK_MAX_W = 1024`. In the first fit effect: `const coarse = window.matchMedia('(pointer: coarse)').matches`; if `el.clientWidth < START_PACK_MAX_W || coarse`, and `rows.length > 0`, `vp.setView(startAtPack({ x: rows[0].pkg.pos_x, y: rows[0].pkg.pos_y }))`; else `fitAll(false)`. Remove the `PHONE_QUERY` constant and its refit effect.

- [ ] **Step 2: Pack title fits its column**

Board: `const onFitPack = useCallback((id: string) => { const p = boardRef.current?.querySelector<HTMLElement>(`[data-pack="${CSS.escape(id)}"]`); if (p) vp.fitWidth({ x: p.offsetLeft, y: p.offsetTop, w: p.offsetWidth, h: p.offsetHeight }) }, [vp.fitWidth])` passed to every `PackColumn`.
PackColumn: `<button type="button" className="hg-pack-title" aria-label={t('vinnubord.board.fitPack', { name: pkg.name })} onClick={() => onFitPack(pkg.id)}>{pkg.name}</button>` (import `useTranslation`).

- [ ] **Step 3: CSS**

`.hg-pack-title` keeps every current declaration and adds: `width: calc(100% - var(--hg-pack-title-indent)); min-height: var(--hg-touch); padding: 0; border: none; background: none; font: inherit; font-size: var(--hg-pack-title-size); font-weight: 800; text-align: left; cursor: pointer;` and `.hg-pack-title:focus-visible { outline: 2px solid var(--hg-line); outline-offset: 4px; }`. Keep the `::after` line.

- [ ] **Step 4: i18n**

`en.json` `vinnubord.board.fitPack: "Show {{name}}"`. Run `npm run translate`, check the diff, make sure `is.json` has `"fitPack": "Sýna {{name}}"` (hand fix if the model wrote otherwise), inserted in alphabetical order inside `board`.

- [ ] **Step 5: Build, tests, checks**

Run: `npm run build && npm run test`
Browser 1440 x 900: the opening view is still the overview; clicking a pack title glides to that column fitted in width with its top under the top bar; dragging the board from a pack title does not pan (mouse rule, expected).
Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg phone tablet tabletLand`
Expected: all three `*-1-load.png` show the first pack ("Grunnur") readable at the top left and the `zoom` line prints `0.800`.

- [ ] **Step 6: Commit**

```bash
git add src/vinnubord/components/Board.tsx src/vinnubord/components/PackColumn.tsx src/vinnubord/vinnubord.css src/shared/i18n/locales/en.json src/shared/i18n/locales/is.json
git commit -m "feat(vinnubord): readable opening view on narrow and touch boards, pack title fits its column"
```

---

### Task 6: Wires on touch devices

**Files:**
- Modify: `src/vinnubord/components/Wires.tsx`

**Interfaces:**
- Consumes: `gestureRef.current.active` (Task 3). Add prop `gestureRef: RefObject<Gesture>` to Wires, passed by Board.

- [ ] **Step 1: The coarse flag**

In the main effect: `let coarse = matchMedia('(pointer: coarse)').matches` plus a `change` listener that updates it and sets `dirty = true`. `WIRE` gains `coarse: { dpr: 1.5 }`; `size()` uses `coarse ? WIRE.coarse.dpr : MAX_DPR` as the cap.

- [ ] **Step 2: The four rules**

- `shadowBlur` is set only when `!coarse` (wires and sparks); when coarse it stays 0 and `shadowColor` is not set.
- Ambient spark births (the `Math.random() < chance` branch) run only when `!coarse || active` (active = pulse or hot). Bursts unchanged.
- When `coarse && gestureRef.current.active`, skip the glow stroke (draw only the core line and sparks). Because `changed` is true on every view change, the first frame after the gesture ends redraws with the glow.
- Nothing else changes for mouse.

- [ ] **Step 3: Build, tests, perf**

Run: `npm run build && npm run test`
Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg perf`
Expected: `idle work` mean under 1 ms; record the block under `## Eftir task 6` in `docs/progress/09-simi-og-spjaldtolva.md`.
Browser 1440 x 900 (mouse): sparks still drift on wires, the selected card's wire sparks more. 

- [ ] **Step 4: Commit**

```bash
git add src/vinnubord/components/Wires.tsx src/vinnubord/components/Board.tsx docs/progress/09-simi-og-spjaldtolva.md
git commit -m "feat(vinnubord): cheaper wires on touch devices"
```

---

### Task 7: Touch tokens

**Files:**
- Modify: `src/vinnubord/vinnubord.css`

- [ ] **Step 1: Add the block from spec 4.6 verbatim**, directly after the `prefers-reduced-motion` token block (line 430), including its comment.

- [ ] **Step 2: Build and check**

Run: `npm run build`
Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg phone perf`
Expected: `phone-3-fit.png` shows cards and modules opaque with the wires not visible through them; perf recorded under `## Eftir task 7`. Browser 1440 x 900 with a mouse: unchanged (blur visible on cards over the aurora).

- [ ] **Step 3: Commit**

```bash
git add src/vinnubord/vinnubord.css
git commit -m "style(vinnubord): no backdrop blur and lighter shadows on touch devices"
```

---

### Task 8: Meta, PWA and safe areas

**Files:**
- Modify: `index.html`, `vite.config.ts`, `src/index.css`, `src/vinnubord/vinnubord.css`

- [ ] **Step 1: index.html**

`<html lang="is">`; viewport meta `content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"`; `theme-color` `#0f141c`; add `<meta name="apple-mobile-web-app-capable" content="yes" />` and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`.

- [ ] **Step 2: vite.config.ts manifest**: `background_color: '#0f141c'`, `theme_color: '#0f141c'`.

- [ ] **Step 3: index.css**: `html, body { overscroll-behavior: none; }` under the scrollbar rules.

- [ ] **Step 4: Safe area tokens and uses in vinnubord.css**

Base block: `--hg-safe-top: env(safe-area-inset-top, 0px); --hg-safe-bottom: env(safe-area-inset-bottom, 0px); --hg-safe-left: env(safe-area-inset-left, 0px); --hg-safe-right: env(safe-area-inset-right, 0px);`.
Uses:
- `.hg-top`: `height: calc(var(--hg-top-h) + var(--hg-safe-top)); padding: var(--hg-safe-top) calc(var(--hg-top-pad-x) + var(--hg-safe-right)) 0 calc(var(--hg-top-pad-x) + var(--hg-safe-left));` and `--hg-panel-top: calc(var(--hg-top-h) + var(--hg-safe-top) + 12px)`.
- The narrow bar (the `@media (max-width: 767px)` block, moved to 1023px in Task 10): `padding: calc(var(--hg-top-pad-top-phone) + var(--hg-safe-top)) calc(var(--hg-top-pad-x-phone) + var(--hg-safe-right)) var(--hg-top-pad-bottom-phone) calc(var(--hg-top-pad-x-phone) + var(--hg-safe-left));`.
- `--hg-control-stack`: add `+ var(--hg-safe-bottom)`.
- `.hg-zoom`, `.hg-notice`: `bottom: calc(var(--hg-control-inset) + var(--hg-safe-bottom))`; `.hg-zoom` also `right: calc(var(--hg-control-inset) + var(--hg-safe-right))`.
- `.hg-panel-sheet`: `padding-bottom: var(--hg-safe-bottom); padding-left: var(--hg-safe-left); padding-right: var(--hg-safe-right);`; `.hg-new-sheet` on phones the same `padding-bottom`.

- [ ] **Step 5: Build and check**

Run: `npm run build && npm run test`
Browser 1440 x 900: nothing moved (every `env()` is 0). Phone shots: `npm run shots:hg phone` prints no console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html vite.config.ts src/index.css src/vinnubord/vinnubord.css
git commit -m "feat(vinnubord): viewport-fit cover, safe areas, board theme color, no overscroll"
```

---

### Task 9: useMediaQuery and inline menus

**Files:**
- Create: `src/shared/hooks/useMediaQuery.ts`
- Modify: `src/shared/hooks/useIsMobile.ts`
- Modify: `src/vinnubord/components/FilterMenu.tsx`, `src/vinnubord/components/ViewMenu.tsx`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean` (matchMedia, `change` listener, `false` without `window`); `useIsMobile()` returns `useMediaQuery('(max-width: 767px)')`.
- Produces: `FilterMenu` and `ViewMenu` prop `inline?: boolean`. Inline renders only the content: `FilterMenu` a `<div role="group" aria-label={label} className="hg-view-chips">` with the chips (or the empty text); `ViewMenu` a `<div role="group" aria-label={t('vinnubord.views.menu')} className="hg-view-chips">` with the list block (Aðalborð, views, separator, new, edit, delete, error, hint) or the editor. Inline `ViewMenu` does not call `useDismiss` (pass `open = false` to it) and `close()` only resets mode and error.

- [ ] **Step 1: The hook**

```ts
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])
  return matches
}
```

`useIsMobile` keeps its export and comment and returns `useMediaQuery('(max-width: 767px)')`.

- [ ] **Step 2: Inline prop in both menus**

Extract the menu body of each component into a local `function Content(...)` or a `const content = (...)` and render either `<div ref={root} className="hg-dd">button + {open && <div className="hg-menu">content</div>}</div>` or, when `inline`, the group div with the content. No logic moves.

- [ ] **Step 3: Build, tests, desktop check**

Run: `npm run build && npm run test`
Browser 1440 x 900: Pakki, Tögg and Sýn menus open and close as before, Esc closes a menu without closing the side panel, creating and deleting a view works.

- [ ] **Step 4: Commit**

```bash
git add src/shared/hooks/useMediaQuery.ts src/shared/hooks/useIsMobile.ts src/vinnubord/components/FilterMenu.tsx src/vinnubord/components/ViewMenu.tsx
git commit -m "refactor(vinnubord): useMediaQuery, filter and view menus render inline"
```

---

### Task 10: Top bar below 1024 px and the filter sheet

**Files:**
- Create: `src/vinnubord/components/FilterSheet.tsx`
- Modify: `src/vinnubord/components/TopBar.tsx`, `src/vinnubord/pages/BoardPage.tsx`
- Modify: `src/vinnubord/hooks/useFilter.ts` (`clearPicks`)
- Modify: `src/vinnubord/vinnubord.css`
- Modify: `src/shared/i18n/locales/en.json`, `src/shared/i18n/locales/is.json`

One feature; the CSS and the strings are its own parts, so it stays one task.

**Interfaces:**
- Consumes: `useMediaQuery`, inline `FilterMenu` and `ViewMenu` (Task 9), `withoutPicks` (Task 2b).
- Produces: `useFilter` returns `clearPicks: () => void` (`update(withoutPicks)`); `FilterApi` type follows.
- Produces: `FilterSheet` props `{ open: boolean; onClose: () => void; picks: number; filter: FilterApi; tags: FilterOption[]; packages: FilterOption[]; viewMenu: ReactNode; onClearView: () => void }`.
- `TopBar` gets props `filterSheetOpen: boolean`, `onOpenFilters: () => void`, `picks: number` (computed in BoardPage: `filter.packages.size + filter.tags.size + (activeView.view ? 1 : 0)`).

- [ ] **Step 1: `clearPicks` in useFilter**

`const clearPicks = useCallback(() => update(withoutPicks), [update])`, returned.

- [ ] **Step 2: FilterSheet**

Markup, in the style of `NewItemSheet` (backdrop div with `onClick={onClose}`, Esc listener like its lines 70 to 76, `role="dialog" aria-modal="true" aria-labelledby`):

```tsx
<div className="hg-sheet-wrap" data-panel="">
  <div className="hg-sheet-backdrop" onClick={onClose} />
  <div className="hg-modal-sheet hg-filter-sheet" role="dialog" aria-modal="true" aria-labelledby={headingId}>
    <div className="hg-new-head hg-filter-head">
      <h2 id={headingId}>{t('vinnubord.filters.heading')}</h2>
      {picks > 0 && <button type="button" className="hg-btn hg-btn-ghost" onClick={clearAll}>{t('vinnubord.top.clear')}</button>}
    </div>
    <div className="hg-new-body">
      <p className="hg-view-group">{t('vinnubord.views.menu')}</p>
      {viewMenu}
      <p className="hg-view-group">{t('vinnubord.top.package')}</p>
      <FilterMenu inline label=... options={packages} selected={f.packages} onToggle={filter.togglePackage} empty=... />
      <p className="hg-view-group">{t('vinnubord.top.tags')}</p>
      <FilterMenu inline ... />
    </div>
    <div className="hg-new-foot">
      <button type="button" className="hg-btn hg-btn-primary" onClick={onClose}>{t('common.close')}</button>
    </div>
  </div>
</div>
```

`clearAll = () => { filter.clearPicks(); onClearView() }`. Renders `null` when `!open`.

- [ ] **Step 3: TopBar and BoardPage**

TopBar: `const narrow = useMediaQuery('(max-width: 1023px)')`. In `.hg-top-b`, after the search button: `{narrow && <button type="button" className={`hg-icon-btn hg-filter-btn${picks > 0 ? ' hg-on' : ''}`} aria-label={t('vinnubord.top.filters')} aria-expanded={filterSheetOpen} onClick={onOpenFilters}>sliders svg{picks > 0 && <em>{picks}</em>}</button>}`. `.hg-top-g` renders only when `!narrow`. The sliders SVG, 16 x 16, stroke like the search icon: `<path d="M2 4h12M2 8h12M2 12h12" /><circle cx="5" cy="4" r="1.6" /><circle cx="11" cy="8" r="1.6" /><circle cx="7" cy="12" r="1.6" />` with `fill: var(--hg-board)` on the circles through CSS `.hg-filter-btn circle { fill: var(--hg-board); }`.

BoardPage: state `filtersOpen`; `picks` computed as above; `<FilterSheet open={filtersOpen} onClose=... picks={picks} filter={filterApi} tags={tags} packages={packages} viewMenu={<ViewMenu inline ...same props as the top bar's... />} onClearView={() => activeView.choose(null)} />`; TopBar gets the three new props. The ViewMenu element is built once in a `const viewMenuProps` and rendered twice (inline and in the bar) to avoid drift.

- [ ] **Step 4: CSS**

- Move the top bar phone block from `@media (max-width: 767px)` (lines 1190 to 1219) to `@media (max-width: 1023px)`; `grid-template-areas: "a b" "f f" "s s"`; drop the `.hg-top-g`, `.hg-top-g .hg-dd` and `.hg-top-g .hg-menu` rules in it (the group is not rendered below 1024 px) and the `--hg-menu-offset-phone` token with them; `.hg-filter-btn` gets `display: grid` here and `display: none` at the base, next to `.hg-search-btn`.
- `.hg-filter-btn { position: relative; }` and `.hg-filter-btn em { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: var(--hg-ddb-badge-pad); border-radius: var(--hg-radius-badge); background: var(--hg-ink); color: var(--hg-board); font-size: var(--hg-ddb-badge-size); font-style: normal; font-weight: 800; display: grid; place-items: center; }`.
- `.hg-modal-sheet`: copy every declaration of `.hg-new-sheet` into a shared rule `.hg-new-sheet, .hg-modal-sheet { ... }` (and the phone variant), so `.hg-filter-sheet` needs only `.hg-filter-head { display: flex; align-items: center; justify-content: space-between; gap: var(--hg-pill-gap); }`.
- The `.hg-sheet-wrap` phone rule (`place-items: end stretch`) stays at 767px: on a tablet the filter sheet is a centred dialog like the new item sheet.

- [ ] **Step 5: i18n**

`en.json`: `vinnubord.top.filters: "Filters"`, new group `vinnubord.filters: { "heading": "Filters" }`. `npm run translate`; `is.json` must read `"filters": "Síur"` and `"heading": "Síur"`, alphabetical.

- [ ] **Step 6: Build, tests, checks**

Run: `npm run build && npm run test`
Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg phone tablet tabletLand`
Expected: `phone-1-load.png` and `tablet-1-load.png`: row 2 is the pills across the full width (`countsWidth` close to the viewport width minus 24), row 1 has the sliders button; `*-4-filters.png` shows the sheet with Sýn, Pakki, Tögg; `tabletLand-1-load.png` is the one row bar. Browser 1440 x 900: unchanged bar.
Browser at 390 px (MCP, resize): open the filter sheet, pick a package, the badge shows 1 and the board dims the others; "Hreinsa" clears it and the badge goes; Esc and backdrop close the sheet; the pills still filter.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/components/FilterSheet.tsx src/vinnubord/components/TopBar.tsx src/vinnubord/pages/BoardPage.tsx src/vinnubord/hooks/useFilter.ts src/vinnubord/vinnubord.css src/shared/i18n/locales/en.json src/shared/i18n/locales/is.json
git commit -m "feat(vinnubord): filters on one button and a sheet below 1024 px, pills in full width"
```

---

### Task 11: The sheet opens full and moves by transform

**Files:**
- Modify: `src/vinnubord/components/PanelShell.tsx`
- Modify: `src/vinnubord/vinnubord.css` (`.hg-panel-sheet` rules)

**Interfaces:**
- Consumes: `OPEN_STOP`, `sheetFraction`, `snapSheet`, `FLICK_SPEED` (lib/sheet), `useIsMobile` (Task 9).

- [ ] **Step 1: CSS**

Replace the `.hg-panel-sheet` rules:

```css
/* The sheet is anchored to the bottom at full height and pushed down by
   --hg-sheet-offset px: 0 at full, 45% of its height at half, its whole
   height when closed. Only transform animates, so the content never
   relayouts while it moves. */
.hg-panel-sheet {
  left: 0; right: 0; bottom: 0; border-bottom: none;
  border-radius: var(--hg-radius-sheet) var(--hg-radius-sheet) 0 0;
  height: calc(100dvh - var(--hg-sheet-top));
  transform: translateY(calc(var(--hg-sheet-offset, 100vh) * 1px));
  padding-bottom: var(--hg-safe-bottom); padding-left: var(--hg-safe-left); padding-right: var(--hg-safe-right);
  transition: transform var(--hg-dur-panel) var(--hg-ease);
}
.hg-panel-sheet:not(.hg-panel-open) {
  padding-bottom: 0; border-width: 0; box-shadow: none; visibility: hidden;
  transition: transform var(--hg-dur-panel) var(--hg-ease), visibility 0s linear var(--hg-dur-panel);
}
.hg-panel-sheet.hg-panel-dragging { transition: none; }
.hg-panel-sheet .hg-pn-head { touch-action: none; cursor: grab; }
.hg-panel-dragging .hg-pn-head { cursor: grabbing; }
```

(Task 8 may already have put the safe area paddings there; keep one copy.)

- [ ] **Step 2: PanelShell state and offset**

- `useState<SheetStop>(OPEN_STOP)`; `useEffect(() => { if (open) setStop(OPEN_STOP) }, [open])`.
- `offsetPx(stop)`: `sheetFraction(stop) * sheetMax()`; closed uses `sheetMax()` too. Style on the aside when narrow: `{ '--hg-sheet-offset': open ? offsetPx(stop) : sheetMax() }`. Recompute on `resize` (a `useState` tick bumped by a window resize listener) so rotation keeps the stop.
- A drag writes `ref.current.style.transform = translateY(${offset}px)` directly and clears it on release (the stop's transform takes over through the transition).

- [ ] **Step 3: Head drag**

The pointer handlers now live on the aside (`onPointerDown` etc.) and act when `e.target.closest('.hg-sheet-handle, .hg-pn-head')` matches and `narrow && open`; `setPointerCapture` only after the move passes `TAP_SLOP_PX`. The tap rule (toggle full/half) applies only to the handle.

- [ ] **Step 4: Body touch takeover**

Effect when `narrow && open`: on the aside, `touchstart` (passive), `touchmove` (`{ passive: false }`), `touchend`, `touchcancel`. State in a ref: `{ y0, x0, atTop, mode: 'undecided' | 'sheet' | 'scroll', last: { y, t }, v }`. `touchstart`: ignore when `target.closest('.hg-sheet-handle, .hg-pn-head, input, textarea, select')`; `body = target.closest('.hg-pn-body')`; if none, ignore; record `atTop = body.scrollTop <= 0`. `touchmove`: if undecided and the move passes 6 px: `mode = atTop && dy > 0 && Math.abs(dy) > Math.abs(dx) ? 'sheet' : 'scroll'`; when `'sheet'`, `setDragging(true)` and from now on `e.preventDefault()` and write the transform with `offset = clamp(dy - 6, 0, max)`, track velocity like the handle; `touchend` in sheet mode: `snapSheet(offset, max, v)`, `'closed'` calls `onClose`, else `setStop`.

- [ ] **Step 5: Build, tests**

Run: `npm run build && npm run test`
Expected: green.

- [ ] **Step 6: Checks**

Run: `npm run build && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg phone`
Expected: `phone-5-panel.png` shows the sheet at full height with 48 px of board above it; `phone-5b-panel-half.png` shows it at half after the handle drag.
Browser at 390 x 844 (MCP, mouse): the handle drag still works with the mouse; a click on the board strip above the sheet closes it. Then two extra checks, added temporarily and not committed to the phone run of the shots script (CDP touch): (a) scroll the `.hg-pn-body` down 200 px with `page.mouse.wheel`, then a CDP touch drag down inside the body: the body scrolls back up and the sheet does not move (Review Focus 3); (b) with the sheet at full, `page.setViewportSize({ width: 844, height: 390 })`: the sheet stays open at full with `--hg-sheet-offset` 0 (Review Focus 5). Record both results in `docs/progress/09-simi-og-spjaldtolva.md` under `## Eftir task 11`.
Browser 1440 x 900: the side panel is unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/vinnubord/components/PanelShell.tsx src/vinnubord/vinnubord.css docs/progress/09-simi-og-spjaldtolva.md
git commit -m "feat(vinnubord): the sheet opens full, moves by transform, drags from head and body"
```

---

### Task 12: Final measurement, handover, CLAUDE.md

**Files:**
- Modify: `docs/progress/09-simi-og-spjaldtolva.md`, `CLAUDE.md`

- [ ] **Step 1: Full run**

Run: `npm run build && npm run test && (npm run preview &) && sleep 3 && SITE=http://localhost:4173 npm run shots:hg all`
Expected: tests green; perf against the spec 4.9 targets: `pinch-out@min gap` mean under 20 and p90 under 33, `pan gap` mean under 20, `idle work` mean under 1. If a target is missed, write the numbers and the suspected cause in the handover, do not loosen rules.

- [ ] **Step 2: Handover**

Fill `docs/progress/09-simi-og-spjaldtolva.md` in the style of `08-handtok-breytt.md`: Hvað var gert per task with commits, Staðfesting (build, tests, the baseline block and the final perf block side by side, which screenshots were looked at), Hvað bíður (Hjá Heimi: check on the real phone and iPad the list in spec section 5; Smálegt).

- [ ] **Step 3: CLAUDE.md**

- Current state: add a "Plan 9 (sími og spjaldtölva)" paragraph in the style of the others.
- Tech Stack: `playwright` devDependency, scripts only.
- Key Patterns: replace the "Gesture contract" paragraph's first sentence with the ref based view ("`useViewport` keeps the live view in `viewRef` and writes the world transform and `--hg-z` directly; React state follows at gesture end; `Wires`, `useCardDrag` and `placeNew` read the ref"), add the touch on buttons rule, fling and double tap, and the start view rule. Add a "Touch devices" paragraph: the `pointer: coarse` token block, Wires coarse rules, the filter sheet below 1024 px, the sheet transform and its three drag surfaces.
- Design System: the token block names (`--hg-dur-view`, `--hg-safe-*`, the coarse block), `.hg-filter-btn`, `.hg-modal-sheet`, `.hg-filter-sheet`, `.hg-pack-title` is a button.
- Commands: already done in Task 1; make sure the `preview` note says shots run against it.

- [ ] **Step 4: Commit**

```bash
git add docs/progress/09-simi-og-spjaldtolva.md CLAUDE.md
git commit -m "docs(vinnubord): plan 9 handover, touch rules and shots script"
```

Then the whole branch review on Fable (global rules), fix rounds reviewed, and push when clean.

---

## Size table

| Task | Files | Size |
|---|---|---|
| 1 script and baseline | scripts/hg-shots.mjs, package.json, CLAUDE.md, docs/progress/09 | M |
| 2a gesture and fling | gesture.ts, gesture.test.ts, fling.ts, fling.test.ts | S |
| 2b geometry, sheet, filters | 3 libs + 3 tests | S |
| 3 view in a ref | useViewport, useCardDrag, Board, Wires, css | M |
| 4 fling and double tap | useViewport, gesture.ts | S |
| 5 opening view, pack title | Board, PackColumn, css, en.json, is.json | M |
| 6 wires coarse | Wires, Board | S |
| 7 touch tokens | css | S |
| 8 meta and safe areas | index.html, vite.config.ts, index.css, css | S |
| 9 useMediaQuery, inline menus | 4 files | S |
| 10 top bar and filter sheet | FilterSheet, TopBar, BoardPage, useFilter, css, en, is | M (one feature, strings and css are its parts) |
| 11 sheet | PanelShell, css | M |
| 12 handover | docs, CLAUDE.md | S |

Order: 1, 2a, 2b, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12. Tasks 6, 7, 8 are independent of each other and of 9 to 11; 9 before 10; 11 depends only on 9 (useIsMobile) and 8 (safe tokens).
