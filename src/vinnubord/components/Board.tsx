import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewport } from '../hooks/useViewport'
import { useCardDrag } from '../hooks/useCardDrag'
import { updateItemPosition } from '../lib/api'
import { isActive, matches, type Filter } from '../lib/filters'
import type { Rect } from '../lib/geometry'
import { packLayout } from '../lib/layout'
import { isUnread } from '../lib/reads'
import { settled, stepSpring, type Spring } from '../lib/spring'
import { BUCKET_TONE, countBucket, isOnBoard, itemStatusLabel, itemTone, wireMode } from '../lib/status'
import type { BoardData, Item, Plan } from '../lib/types'
import { ItemCard } from './ItemCard'
import { PackColumn } from './PackColumn'
import { Wires, type WireItem, type WiresHandle } from './Wires'

// The whiteboard: pack columns, item cards and wires inside one pan and zoom
// world. Card positions live in a spring per card that Board steps every frame
// (through Wires' animation loop) and writes straight to the card's style, so
// a drag never re-renders React. Data decides where a card rests, except while
// it is dragged here or its own drop is still on the way to the database.

type Props = {
  data: BoardData
  viewerId: string
  filter: Filter
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenModule: (moduleId: string) => void
}

// A dropped position waiting for the database. base is the data position the
// drag started from: data still showing base is stale and ignored, data at pos
// means the save landed, anything else means someone else moved the card.
type Pending = { x: number; y: number; baseX: number; baseY: number }
type CardSpring = Spring & { pending: Pending | null }

const SAVE_DEBOUNCE_MS = 300
const ENTRY_START_MS = 150
const ENTRY_STEP_MS = 45
const ENTRY_BURST = 8
const DROP_BURST = 4
const NO_DESELECT = '[data-card], [data-module], [data-panel]'

function place(el: HTMLElement, s: Spring) {
  el.style.left = `${s.x}px`
  el.style.top = `${s.y}px`
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Board({ data, viewerId, filter, selectedId, onSelect, onOpenModule }: Props) {
  const { t } = useTranslation()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const wiresRef = useRef<WiresHandle | null>(null)
  const vp = useViewport(boardRef)
  const { fit, view } = vp

  // ---------- derived board ----------
  const onBoard = useMemo(() => data.items.filter(isOnBoard), [data.items])
  const rows = useMemo(() => packLayout(data.packages, data.modules), [data.packages, data.modules])
  const packageOfModule = useMemo(() => new Map(data.modules.map((m) => [m.id, m.package_id])), [data.modules])
  const plansByItem = useMemo(() => {
    const map = new Map<string, Plan[]>()
    for (const p of data.plans) map.set(p.item_id, [...(map.get(p.item_id) ?? []), p])
    return map
  }, [data.plans])
  const filesByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of data.files) map.set(f.item_id, (map.get(f.item_id) ?? 0) + 1)
    return map
  }, [data.files])
  const openActionsByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of data.actions) if (a.done_at === null) map.set(a.item_id, (map.get(a.item_id) ?? 0) + 1)
    return map
  }, [data.actions])

  const filterOn = isActive(filter)
  const cards = useMemo(
    () =>
      onBoard.map((item) => {
        const tone = itemTone(item, viewerId, data.participants)
        const bucket = countBucket(item, data.actions, viewerId)
        const packageId = item.module_id ? (packageOfModule.get(item.module_id) ?? null) : null
        const visible =
          !filterOn || (bucket !== null && matches(item, { tone: BUCKET_TONE[bucket], packageId }, filter))
        const moverId = item.updated_by ?? item.created_by
        const mover = data.participants.find((p) => p.user_id === moverId)
        return {
          item,
          tone,
          label: itemStatusLabel(item, viewerId, data.participants),
          mode: wireMode(item, tone),
          visible,
          unread: isUnread(item, data.reads, viewerId),
          mover: mover ? { short: mover.short, name: mover.display_name } : null,
        }
      }),
    [onBoard, viewerId, data.participants, data.actions, data.reads, packageOfModule, filterOn, filter],
  )

  const wireItems = useMemo<WireItem[]>(
    () =>
      cards
        .filter((c) => c.visible && c.item.module_id !== null)
        .map((c) => ({ id: c.item.id, moduleId: c.item.module_id as string, tone: c.tone, mode: c.mode })),
    [cards],
  )

  const dimModuleIds = useMemo(() => {
    if (!filterOn) return undefined
    const live = new Set(cards.filter((c) => c.visible && c.item.module_id).map((c) => c.item.module_id as string))
    return new Set(data.modules.filter((m) => !live.has(m.id)).map((m) => m.id))
  }, [filterOn, cards, data.modules])

  // ---------- springs ----------
  const springs = useRef(new Map<string, CardSpring>())
  const els = useRef(new Map<string, HTMLElement>())
  const itemsById = useRef(new Map<string, Item>())
  const draggingRef = useRef<string | null>(null)
  const reduced = useRef(prefersReducedMotion())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reduced.current = mq.matches
    }
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const setEl = useCallback((id: string, el: HTMLElement | null) => {
    if (!el) {
      els.current.delete(id)
      return
    }
    els.current.set(id, el)
    const s = springs.current.get(id)
    if (s) place(el, s)
  }, [])

  // Data to springs. Runs before paint, after the cards' refs are attached.
  useLayoutEffect(() => {
    const seen = new Set<string>()
    itemsById.current = new Map(onBoard.map((i) => [i.id, i]))
    for (const item of onBoard) {
      seen.add(item.id)
      const px = item.pos_x
      const py = item.pos_y
      let s = springs.current.get(item.id)
      if (!s) {
        s = { x: px, y: py, tx: px, ty: py, vx: 0, vy: 0, pending: null }
        springs.current.set(item.id, s)
      } else if (draggingRef.current !== item.id) {
        const p = s.pending
        if (p && px === p.x && py === p.y) s.pending = null
        else if (p && !(px === p.baseX && py === p.baseY)) s.pending = null
        if (!s.pending) {
          s.tx = px
          s.ty = py
        }
      }
      const el = els.current.get(item.id)
      if (el) place(el, s)
    }
    for (const id of springs.current.keys()) if (!seen.has(id)) springs.current.delete(id)
  }, [onBoard])

  // One frame of every moving spring, called by Wires before it reads rects.
  const stepFrame = useCallback(() => {
    for (const [id, s] of springs.current) {
      if (s.x === s.tx && s.y === s.ty && s.vx === 0 && s.vy === 0) continue
      if (reduced.current) {
        Object.assign(s, { x: s.tx, y: s.ty, vx: 0, vy: 0 })
      } else {
        Object.assign(s, stepSpring(s))
        if (settled(s)) Object.assign(s, { x: s.tx, y: s.ty, vx: 0, vy: 0 })
      }
      const el = els.current.get(id)
      if (el) place(el, s)
    }
  }, [])

  // ---------- drag ----------
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const getPos = useCallback((id: string) => {
    const s = springs.current.get(id)
    return s ? { x: s.tx, y: s.ty } : null
  }, [])

  const onMove = useCallback((id: string, x: number, y: number) => {
    const s = springs.current.get(id)
    if (!s) return
    s.tx = x
    s.ty = y
  }, [])

  const onDrop = useCallback((id: string, x: number, y: number) => {
    const s = springs.current.get(id)
    const item = itemsById.current.get(id)
    if (!s || !item) return
    const rx = Math.round(x)
    const ry = Math.round(y)
    s.tx = rx
    s.ty = ry
    s.pending = {
      x: rx,
      y: ry,
      baseX: s.pending?.baseX ?? item.pos_x,
      baseY: s.pending?.baseY ?? item.pos_y,
    }
    wiresRef.current?.burst(id, DROP_BURST)
    const timers = saveTimers.current
    const old = timers.get(id)
    if (old) clearTimeout(old)
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        // A failed save leaves the card where it was dropped.
        updateItemPosition(id, rx, ry).catch((err: unknown) => console.error(err))
      }, SAVE_DEBOUNCE_MS),
    )
  }, [])

  const onCancel = useCallback((id: string, x: number, y: number) => {
    const s = springs.current.get(id)
    if (!s) return
    s.tx = x
    s.ty = y
  }, [])

  const onTap = useCallback((id: string) => onSelect(id), [onSelect])

  const drag = useCardDrag({ view, gestureRef: vp.gestureRef, getPos, onMove, onDrop, onCancel, onTap })
  const draggingId = drag.draggingId
  useLayoutEffect(() => {
    draggingRef.current = draggingId
  }, [draggingId])

  const hotIds = useMemo(() => {
    const set = new Set<string>()
    if (selectedId) set.add(selectedId)
    if (draggingId) set.add(draggingId)
    return set
  }, [selectedId, draggingId])

  const hotModuleIds = useMemo(() => {
    const set = new Set<string>()
    for (const id of hotIds) {
      const m = onBoard.find((i) => i.id === id)?.module_id
      if (m) set.add(m)
    }
    return set
  }, [hotIds, onBoard])

  // ---------- entry, once per load ----------
  const delays = useRef(new Map<string, number>())
  const firstLoad = useRef(true)
  const enterDelays = useMemo(() => {
    // Cards of the first load pop in one after another, later arrivals at
    // once. The map only grows, so a repeated call gives the same delays.
    let i = 0
    for (const item of onBoard) {
      if (delays.current.has(item.id)) continue
      const delay = firstLoad.current && !reduced.current ? ENTRY_START_MS + i++ * ENTRY_STEP_MS : 0
      delays.current.set(item.id, delay)
    }
    if (onBoard.length > 0) firstLoad.current = false
    return delays.current
  }, [onBoard])

  const burstDone = useRef(new Set<string>())
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const item of onBoard) {
      if (burstDone.current.has(item.id)) continue
      burstDone.current.add(item.id)
      const delay = enterDelays.get(item.id) ?? 0
      timers.push(setTimeout(() => wiresRef.current?.burst(item.id, ENTRY_BURST), delay))
    }
    return () => timers.forEach(clearTimeout)
  }, [onBoard, enterDelays])

  // ---------- fit ----------
  const fitAll = useCallback(() => {
    const rects: Rect[] = []
    for (const [id, el] of els.current) {
      const s = springs.current.get(id)
      if (s) rects.push({ x: s.tx, y: s.ty, w: el.offsetWidth, h: el.offsetHeight })
    }
    boardRef.current?.querySelectorAll<HTMLElement>('[data-pack]').forEach((p) => {
      rects.push({ x: p.offsetLeft, y: p.offsetTop, w: p.offsetWidth, h: p.offsetHeight })
    })
    fit(rects)
  }, [fit])

  // Fit once per load, as soon as the board has a size.
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (fitted.current) return
    const el = boardRef.current
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
    fitAll()
    fitted.current = true
  })

  const onBoardClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as Element).closest(NO_DESELECT)) return
      onSelect(null)
    },
    [onSelect],
  )

  return (
    <div className="hg-board-wrap">
      <div
        ref={boardRef}
        className={`hg-board${vp.isPanning ? ' hg-board-panning' : ''}`}
        {...vp.bind}
        onClick={onBoardClick}
      >
        <Wires ref={wiresRef} items={wireItems} view={view} hotIds={hotIds} onFrame={stepFrame} />
        <div
          className="hg-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
          {...drag.bind}
        >
          {rows.map(({ pkg, modules }) => (
            <PackColumn
              key={pkg.id}
              pkg={pkg}
              modules={modules}
              items={data.items}
              viewerId={viewerId}
              participants={data.participants}
              hotModuleIds={hotModuleIds}
              dimModuleIds={dimModuleIds}
              onOpenModule={onOpenModule}
            />
          ))}
          {cards.map((c) => (
            <ItemCard
              key={c.item.id}
              item={c.item}
              tone={c.tone}
              label={c.label}
              plans={plansByItem.get(c.item.id) ?? NO_PLANS}
              actionsOpen={openActionsByItem.get(c.item.id) ?? 0}
              fileCount={filesByItem.get(c.item.id) ?? 0}
              mover={c.mover}
              unread={c.unread}
              parked={c.item.status === 'parked'}
              pulse={c.mode === 'pulse'}
              selected={c.item.id === selectedId}
              lifted={c.item.id === draggingId}
              dim={!c.visible}
              enterDelay={enterDelays.get(c.item.id) ?? 0}
              setEl={setEl}
              onTap={onTap}
            />
          ))}
        </div>
      </div>
      <div className="hg-zoom">
        <button type="button" onClick={vp.zoomOut} aria-label={t('vinnubord.board.zoomOut')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
        <span className="hg-zoom-val" aria-label={t('vinnubord.board.zoomLevel')}>
          {Math.round(view.z * 100)}%
        </span>
        <button type="button" onClick={vp.zoomIn} aria-label={t('vinnubord.board.zoomIn')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10M8 3v10" />
          </svg>
        </button>
        <button type="button" onClick={fitAll} aria-label={t('vinnubord.board.fit')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const NO_PLANS: Plan[] = []
