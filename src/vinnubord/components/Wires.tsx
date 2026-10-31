import { useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'
import { bezierControl, bezierPoint, wireEndpoints, type Rect, type View } from '../lib/geometry'
import type { Tone, WireMode } from '../lib/status'

// Glowing wires from each item card to its module, drawn on one canvas that
// covers the board element, in screen space. Every frame reads the card and
// module rects from the DOM, so a wire follows drags, the spring, pan and
// zoom without any extra bookkeeping. Sparks travel along the wires: up to
// three at a time on pulse wires, a rare single one on calm wires, none on
// parked (dashed) wires. burst(id, n) sends a volley along one wire.
// prefers-reduced-motion: wires are drawn, sparks are not.

export type WireItem = { id: string; moduleId: string; tone: Tone; mode: WireMode }
export type WiresHandle = { burst: (id: string, n: number) => void }

type Props = {
  items: WireItem[]
  view: View
  // Items treated as active (selected or being dragged): they spark like pulse wires.
  hotIds: Set<string>
  // Runs at the start of every frame, before the rects are read (card spring).
  onFrame?: () => void
  ref?: Ref<WiresHandle>
}

type Spark = { t: number; v: number; r: number }

const MAX_DPR = 2
const MAX_DT = 32
const FRAME_MS = 16
const ZOOM_SCALE_MIN = 0.5
const ZOOM_SCALE_MAX = 1.4
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

  useImperativeHandle(
    ref,
    () => ({
      burst(id: string, n: number) {
        if (reduced.current) return
        const list = sparks.current.get(id) ?? []
        for (let i = 0; i < n; i++) list.push({ t: 0, v: 0.006 + Math.random() * 0.012, r: 1.2 + Math.random() * 1.8 })
        sparks.current.set(id, list)
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
      if (mq.matches) sparks.current.clear()
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

    let w = 0
    let h = 0
    const size = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)

    const colors = resolveColors(host)
    let raf = 0
    let last = 0

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(MAX_DT, ts - last || FRAME_MS)
      last = ts
      const { items: list, view: v, hotIds: hot, onFrame: step } = live.current
      step?.()

      ctx.clearRect(0, 0, w, h)
      const hostRect = host.getBoundingClientRect()
      const zs = clamp(v.z, ZOOM_SCALE_MIN, ZOOM_SCALE_MAX)
      const motion = !reduced.current
      ctx.lineCap = 'round'

      for (const it of list) {
        const card = host.querySelector(`[data-card="${CSS.escape(it.id)}"]`)
        const mod = host.querySelector(`.hg-mod[data-module="${CSS.escape(it.moduleId)}"]`)
        if (!card || !mod) continue
        const e = wireEndpoints(relRect(card, hostRect), relRect(mod, hostRect))
        const c = bezierControl(e, v.z)
        const rgb = colors.tones[it.tone]
        const parked = it.mode === 'parked'
        const active = it.mode === 'pulse' || hot.has(it.id)

        ctx.beginPath()
        ctx.moveTo(e.x1, e.y1)
        ctx.bezierCurveTo(c[0], c[1], c[2], c[3], e.x2, e.y2)
        // Glow, then the core line on the same path.
        ctx.strokeStyle = rgba(rgb, parked ? 0.1 : 0.26)
        ctx.lineWidth = (parked ? 3 : 6) * zs
        ctx.shadowBlur = parked ? 0 : 18 * zs
        ctx.shadowColor = rgba(rgb, 0.8)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.strokeStyle = rgba(rgb, parked ? 0.3 : 0.8)
        ctx.lineWidth = (parked ? 1 : 1.4) * zs
        if (parked) ctx.setLineDash([4 * zs, 8 * zs])
        ctx.stroke()
        ctx.setLineDash([])

        if (!motion || parked) continue
        let own = sparks.current.get(it.id)
        if (!own) {
          own = []
          sparks.current.set(it.id, own)
        }
        if (own.length < (active ? 3 : 1) && Math.random() < (active ? 0.03 : 0.003)) {
          own.push({ t: 0, v: 0.004 + Math.random() * 0.004, r: 1.6 })
        }
        let keep = 0
        for (const p of own) {
          p.t += (p.v * dt) / FRAME_MS
          if (p.t >= 1) continue
          own[keep++] = p
          const [x, y] = bezierPoint(e, c, p.t)
          ctx.beginPath()
          ctx.arc(x, y, p.r * 2.2 * zs, 0, Math.PI * 2)
          ctx.fillStyle = rgba(rgb, 0.18)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x, y, p.r * zs, 0, Math.PI * 2)
          ctx.fillStyle = colors.spark
          ctx.shadowBlur = 14
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
    }
  }, [])

  return <canvas ref={canvasRef} className="hg-wires" aria-hidden="true" />
}
