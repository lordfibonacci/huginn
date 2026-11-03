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

// A card on screen, panning the board with one finger until one shows: up
// first, then left. Each pan waits for the fling to settle before looking.
async function findCard(page, cdp) {
  const pans = [
    [0, -300],
    [0, -300],
    [-250, 0],
    [0, -300],
    [-250, 0],
    [0, -300],
  ]
  let box = await cardOnScreen(page)
  for (const [dx, dy] of pans) {
    if (box) break
    const from = { x: dx ? 320 : 195, y: dy ? 650 : 500 }
    await touchSeq(cdp, [{ from, to: { x: from.x + dx, y: from.y + dy } }], 20, 400)
    await page.waitForTimeout(1500)
    box = await cardOnScreen(page)
  }
  return box
}

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
  const box = await findCard(page, cdp)
  if (box) {
    await tap(cdp, box.x, box.y)
    await page.waitForTimeout(1000)
    await shot('5-panel')
    const handleEl = page.locator('.hg-sheet-handle')
    const handle = (await handleEl.count()) ? await handleEl.boundingBox() : null
    if (handle) {
      const hx = handle.x + handle.width / 2
      await touchSeq(cdp, [{ from: { x: hx, y: handle.y + 10 }, to: { x: hx, y: handle.y + 300 } }], 20, 300)
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
  await page.keyboard.press('Escape') // the first one leaves the focused field
  await page.waitForTimeout(300)
  await page.locator('.hg-list-btn').click()
  await page.waitForTimeout(500)
  await shot('8-list')
  await page.locator('.hg-list-row').first().click()
  await page.waitForTimeout(1000)
  await shot('9-list-pick')
  await page.locator('.hg-pn-tab', { hasText: 'Spjall' }).click()
  await page.waitForTimeout(600)
  await shot('10-chat')
  // The reader needs a card with a Markdown file: try the picked card first, then the next list rows.
  let mdRow = null
  for (let i = 0; i < 12 && !mdRow; i++) {
    if (i > 0) {
      if (!(await page.locator('.hg-list').isVisible())) {
        await page.keyboard.press('Escape') // a phone sheet covers the list button
        await page.waitForTimeout(500)
        await page.locator('.hg-list-btn').click()
        await page.waitForTimeout(500)
      }
      const rows = page.locator('.hg-list-row')
      if (i >= (await rows.count())) break
      await rows.nth(i).click()
      await page.waitForTimeout(800)
    }
    await page.locator('.hg-pn-tab', { hasText: 'Skjöl' }).click()
    await page.waitForTimeout(400)
    const row = page.locator('.hg-file:has(.hg-pill:text-is("MD")) .hg-file-open').first()
    if (await row.count()) mdRow = row
  }
  if (mdRow) {
    await mdRow.click()
    await page.waitForSelector('.hg-reader .hg-markdown, .hg-reader .hg-reader-text', { timeout: 8000 })
    await page.waitForTimeout(600)
    await shot('11-reader')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    await shot('11b-reader-back')
  } else console.log(name, 'no md file on the first list rows, reader shots skipped')
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
