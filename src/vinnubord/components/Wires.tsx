import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'
import { bezierControl, bezierPoint, bezierTail, wireEndpoints, type Rect, type View } from '../lib/geometry'
import { canvasIdle, drawUpProgress } from '../lib/motion'
import type { Tone, WireMode } from '../lib/status'

// Glowing wires from each item card to its module, drawn on one canvas that
// covers the board element, in screen space. A frame reads the card and
// module rects from the DOM, so a wire follows drags, the spring, pan and
// zoom without any extra bookkeeping. Sparks travel along the wires: up to
// three at a time on pulse wires, a rare single one on calm wires, none on
// parked (dashed) wires. burst(id, n) sends a volley along one wire.
//
// The loop runs every animation frame but only draws when something could
// have changed (lib/motion canvasIdle): the wires, the view or the hot set
// changed, a watched card or module changed size, a spring moved, a spark is
// alive, the entry draw up runs, or the board asked to stay awake (cards
// popping in). Otherwise the last frame stays on the canvas.
//
// drawUp() grows every wire out of its module to its card over the first
// WIRE.drawUp.ms, once; Board calls it for the first load.
// prefers-reduced-motion: wires are drawn, sparks and the draw up are not,
// and the canvas only redraws on change.

export type WireItem = { id: string; moduleId: string; tone: Tone; mode: WireMode }
export type WiresHandle = {
  burst: (id: string, n: number) => void
  drawUp: () => void
  // Keep drawing for ms, while something the loop cannot see moves rects.
  wake: (ms: number) => void
}

type Props = {
  items: WireItem[]
  view: View
  // Items treated as active (selected or being dragged): they spark like pulse wires.
  hotIds: Set<string>
  // Runs at the start of every frame, before the rects are read (card
  // spring). Returns whether anything moved.
  onFrame?: () => boolean
  ref?: Ref<WiresHandle>
}

type Spark = { t: number; v: number; r: number }
type Ends = { moduleId: string; card: Element; mod: Element }

const MAX_DPR = 2
const MAX_DT = 32
const FRAME_MS = 16

// Every wire and spark look in one place. The canvas cannot read CSS custom
// properties cheaply each frame, so only the colors come from tokens (read
// once); widths, blurs, alphas and spark rates live here. Sizes are in screen
// px at zoom 1 and scale with clamp(view.z, zoomMin, zoomMax).
const WIRE = {
  zoomMin: 0.5,
  zoomMax: 1.4,
  glow: { width: 6, blur: 18, alpha: 0.26, shadowAlpha: 0.8 },
  core: { width: 1.4, alpha: 0.8 },
  parkedGlow: { width: 3, alpha: 0.1 },
  parkedCore: { width: 1, alpha: 0.3, dash: 4, gap: 8 },
  spark: {
    maxActive: 3,
    maxCalm: 1,
    chanceActive: 0.03,
    chanceCalm: 0.003,
    speedMin: 0.004,
    speedRange: 0.004,
    radius: 1.6,
    haloScale: 2.2,
    haloAlpha: 0.18,
    blur: 14,
  },
  burst: { speedMin: 0.006, speedRange: 0.012, radiusMin: 1.2, radiusRange: 1.8 },
  drawUp: { ms: 1100 },
} as const
const TONES: Tone[] = ['gold', 'lilac', 'coral', 'teal', 'stone']

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function rgba(rgb: string, a: number): string {
  const m = rgb.match(/[\d.]+/g)
  if (!m || m.length < 3) return `rgba(255, 255, 255, ${a})`
  return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})`
}

// Resolve the tone and spark tokens to rgb() once, through a probe element.
function resolveColors(host: Element): { tones: Record<Tone, string>; spark: string } {
  const probe = document.createElement('i')
  probe.style.display = 'none'
  host.appendChild(probe)
  const read = (token: string) => {
    probe.style.color = `var(${token})`
    return getComputedStyle(probe).color
  }
  const tones = {} as Record<Tone, string>
  for (const tone of TONES) tones[tone] = read(`--hg-${tone}`)
  const spark = read('--hg-spark')
  probe.remove()
  return { tones, spark }
}

function relRect(el: Element, host: DOMRect): Rect {
  const r = el.getBoundingClientRect()
  return { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height }
}

export function Wires({ items, view, hotIds, onFrame, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sparks = useRef(new Map<string, Spark[]>())
  const live = useRef({ items, view, hotIds, onFrame })
  useLayoutEffect(() => {
    live.current = { items, view, hotIds, onFrame }
  })
  const reduced = useRef(false)
  // Draw up: requested by drawUp(), started on the next frame.
  const drawUpWanted = useRef(false)
  const awakeUntil = useRef(0)

  useImperativeHandle(
    ref,
    () => ({
      burst(id: string, n: number) {
        if (reduced.current) return
        // Only wires that are drawn and move sparks: a spark on a parked,
        // hidden or unwired card would never travel and never let the canvas rest.
        const it = live.current.items.find((i) => i.id === id)
        if (!it || it.mode === 'parked') return
        const list = sparks.current.get(id) ?? []
        const b = WIRE.burst
        for (let i = 0; i < n; i++) {
          list.push({ t: 0, v: b.speedMin + Math.random() * b.speedRange, r: b.radiusMin + Math.random() * b.radiusRange })
        }
        sparks.current.set(id, list)
      },
      drawUp() {
        if (!reduced.current) drawUpWanted.current = true
      },
      wake(ms: number) {
        awakeUntil.current = Math.max(awakeUntil.current, performance.now() + ms)
      },
    }),
    [],
  )

  // Forget sparks of wires that are gone.
  useEffect(() => {
    const ids = new Set(items.map((i) => i.id))
    for (const id of sparks.current.keys()) if (!ids.has(id)) sparks.current.delete(id)
  }, [items])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reduced.current = mq.matches
      if (mq.matches) {
        sparks.current.clear()
        drawUpWanted.current = false
      }
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !host || !ctx) return

    // Set when something the frame cannot compare by identity changed: the
    // canvas size, or the size of a card or module a wire is attached to.
    let dirty = true
    let w = 0
    let h = 0
    const size = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dirty = true
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)

    // Card and module elements per wire, looked up once instead of two
    // querySelector calls per wire per frame. Cleared when the wire list
    // changes, refilled lazily, and every cached element is watched for size.
    const ends = new Map<string, Ends>()
    const sizeWatch = new ResizeObserver(() => {
      dirty = true
    })
    let endsFor: WireItem[] | null = null
    const lookup = (it: WireItem): Ends | null => {
      const hit = ends.get(it.id)
      if (hit && hit.moduleId === it.moduleId && hit.card.isConnected && hit.mod.isConnected) return hit
      const card = host.querySelector(`[data-card="${CSS.escape(it.id)}"]`)
      const mod = host.querySelector(`.hg-mod[data-module="${CSS.escape(it.moduleId)}"]`)
      if (!card || !mod) {
        ends.delete(it.id)
        return null
      }
      const fresh = { moduleId: it.moduleId, card, mod }
      ends.set(it.id, fresh)
      sizeWatch.observe(card)
      sizeWatch.observe(mod)
      return fresh
    }

    const colors = resolveColors(host)
    let raf = 0
    let last = 0
    let drawUpStart: number | null = null
    let drawn: { items: WireItem[]; view: View; hotIds: Set<string> } | null = null

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(MAX_DT, ts - last || FRAME_MS)
      last = ts
      const { items: list, view: v, hotIds: hot, onFrame: step } = live.current
      const moved = step?.() ?? false
      const motion = !reduced.current

      if (list !== endsFor) {
        ends.clear()
        sizeWatch.disconnect()
        endsFor = list
      }

      // New sparks first, so a spark born this frame is drawn this frame.
      let alive = 0
      if (motion) {
        const sp = WIRE.spark
        for (const it of list) {
          if (it.mode === 'parked') {
            sparks.current.delete(it.id)
            continue
          }
          let own = sparks.current.get(it.id)
          if (!own) {
            own = []
            sparks.current.set(it.id, own)
          }
          const active = it.mode === 'pulse' || hot.has(it.id)
          if (own.length < (active ? sp.maxActive : sp.maxCalm) && Math.random() < (active ? sp.chanceActive : sp.chanceCalm)) {
            own.push({ t: 0, v: sp.speedMin + Math.random() * sp.speedRange, r: sp.radius })
          }
          alive += own.length
        }
      }

      if (drawUpWanted.current) {
        drawUpWanted.current = false
        drawUpStart = motion ? ts : null
      }
      const changed = dirty || drawn === null || drawn.items !== list || drawn.view !== v || drawn.hotIds !== hot
      const idle = canvasIdle({
        changed,
        moving: moved,
        sparks: alive,
        drawingUp: drawUpStart !== null,
        awake: ts < awakeUntil.current,
      })
      if (idle) return
      dirty = false
      drawn = { items: list, view: v, hotIds: hot }

      // Share of every wire drawn, grown from the module end.
      let reach = 1
      if (drawUpStart !== null) {
        reach = drawUpProgress(ts - drawUpStart, WIRE.drawUp.ms)
        if (reach >= 1) drawUpStart = null
      }
      const from = 1 - reach

      ctx.clearRect(0, 0, w, h)
      const hostRect = host.getBoundingClientRect()
      const zs = clamp(v.z, WIRE.zoomMin, WIRE.zoomMax)
      ctx.lineCap = 'round'

      for (const it of list) {
        const el = lookup(it)
        const own = sparks.current.get(it.id)
        if (!el) {
          // No wire to travel on: drop its sparks so the canvas can rest.
          if (own) own.length = 0
          continue
        }
        const e = wireEndpoints(relRect(el.card, hostRect), relRect(el.mod, hostRect))
        const c = bezierControl(e, v.z)
        const part = from > 0 ? bezierTail(e, c, from) : { e, c }
        const rgb = colors.tones[it.tone]
        const parked = it.mode === 'parked'

        ctx.beginPath()
        ctx.moveTo(part.e.x1, part.e.y1)
        ctx.bezierCurveTo(part.c[0], part.c[1], part.c[2], part.c[3], part.e.x2, part.e.y2)
        // Glow, then the core line on the same path.
        const glow = parked ? WIRE.parkedGlow : WIRE.glow
        const core = parked ? WIRE.parkedCore : WIRE.core
        ctx.strokeStyle = rgba(rgb, glow.alpha)
        ctx.lineWidth = glow.width * zs
        ctx.shadowBlur = parked ? 0 : WIRE.glow.blur * zs
        ctx.shadowColor = rgba(rgb, WIRE.glow.shadowAlpha)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.strokeStyle = rgba(rgb, core.alpha)
        ctx.lineWidth = core.width * zs
        if (parked) ctx.setLineDash([WIRE.parkedCore.dash * zs, WIRE.parkedCore.gap * zs])
        ctx.stroke()
        ctx.setLineDash([])

        if (!motion || parked || !own) continue
        const sp = WIRE.spark
        let keep = 0
        for (const p of own) {
          p.t += (p.v * dt) / FRAME_MS
          if (p.t >= 1) continue
          own[keep++] = p
          // While the wire is still growing, a spark ahead of its tip waits unseen.
          if (p.t < from) continue
          const [x, y] = bezierPoint(e, c, p.t)
          ctx.beginPath()
          ctx.arc(x, y, p.r * sp.haloScale * zs, 0, Math.PI * 2)
          ctx.fillStyle = rgba(rgb, sp.haloAlpha)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x, y, p.r * zs, 0, Math.PI * 2)
          ctx.fillStyle = colors.spark
          ctx.shadowBlur = sp.blur
          ctx.shadowColor = rgb
          ctx.fill()
          ctx.shadowBlur = 0
        }
        own.length = keep
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      sizeWatch.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="hg-wires" aria-hidden="true" />
}
