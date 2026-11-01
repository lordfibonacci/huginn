import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useViewport } from '../hooks/useViewport'
import { useCardDrag } from '../hooks/useCardDrag'
import { updateItemPosition, upsertViewPosition } from '../lib/api'
import { isActive, matches, type Filter } from '../lib/filters'
import { screenToWorld, type Rect } from '../lib/geometry'
import { boardOrder, packLayout } from '../lib/layout'
import { placeNewCard } from '../lib/placement'
import { parseDuration } from '../lib/motion'
import { fileCountsByItem } from '../lib/panel'
import { summarizeUnread } from '../lib/reads'
import { settled, stepSpring, type Spring } from '../lib/spring'
import { BUCKET_TONE, countBucket, isOnBoard, itemStatusLabel, itemTone, mineActionsByItem, wireMode } from '../lib/status'
import type { BoardData, Item, Plan, View } from '../lib/types'
import { positionOf, positionsOf } from '../lib/views'
import { Aurora } from './Aurora'
import { ItemCard } from './ItemCard'
import { PackColumn } from './PackColumn'
import { Wires, type WireItem, type WiresHandle } from './Wires'

// The whiteboard: pack columns, item cards and wires inside one pan and zoom
// world. Card positions live in a spring per card that Board steps every frame
// (through Wires' animation loop) and writes straight to the card's style, so
// a drag never re-renders React. Data decides where a card rests, except while
// it is dragged here or its own drop is still on the way to the database.
// Inside a view a card rests at its place in that view (hg_view_positions),
// else at its own place, and a drop is saved to the view, never to the item.

type Props = {
  data: BoardData
  // The items the active view draws (itemsInView), all on board items without one.
  items: Item[]
  view: View | null
  viewerId: string
  filter: Filter
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenModule: (moduleId: string) => void
  // Drawn over the board inside its area (the new item toast).
  children?: ReactNode
  ref?: Ref<BoardHandle>
}

// placeNew: a free world position for a new card beside its module, or on
// the centre of the current view when it has none.
export type BoardHandle = { placeNew: (moduleId: string | null) => { x: number; y: number } }

// A dropped position waiting for the database. base is the data position the
// drag started from: data still showing base is stale and ignored, data at pos
// means the save landed, anything else means someone else moved the card.
// viewId is the view it was dropped in (null for the main board): switching
// views drops the pending, the card then rests where the new view has it.
type Pending = { x: number; y: number; baseX: number; baseY: number; viewId: string | null }
type CardSpring = Spring & { pending: Pending | null }
// A debounced position save that has not been sent yet. It keeps the view it
// was dropped in, so a view switch during the debounce cannot redirect it.
type SaveJob = { timer: ReturnType<typeof setTimeout>; x: number; y: number; viewId: string | null }
type Point = { x: number; y: number }

const SAVE_DEBOUNCE_MS = 300
const ENTRY_START_MS = 150
const ENTRY_STEP_MS = 45
const ENTRY_BURST = 8
const DROP_BURST = 4
const NO_DESELECT = '[data-card], [data-module], [data-panel]'
// The phone layout breakpoint (top bar in two rows, bottom sheet). Crossing it
// changes the board size a lot, so the board fits again.
const PHONE_QUERY = '(max-width: 767px)'
// Size assumed for a card that is not drawn yet (its width is --hg-card-w).
const NEW_CARD_SIZE = { w: 250, h: 120 }

function place(el: HTMLElement, s: Spring) {
  el.style.left = `${s.x}px`
  el.style.top = `${s.y}px`
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// The card entry pop length from its token, 0 under reduced motion.
function popMs(): number {
  return parseDuration(getComputedStyle(document.documentElement).getPropertyValue('--hg-dur-pop'))
}

export function Board({
  data,
  items,
  view: activeView,
  viewerId,
  filter,
  selectedId,
  onSelect,
  onOpenModule,
  children,
  ref,
}: Props) {
  const { t } = useTranslation()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const wiresRef = useRef<WiresHandle | null>(null)
  const vp = useViewport(boardRef)
  const { fit, view } = vp

  // ---------- derived board ----------
  const onBoard = useMemo(() => boardOrder(items), [items])
  const viewId = activeView?.id ?? null
  const positions = useMemo(() => positionsOf(data.viewPositions, viewId), [data.viewPositions, viewId])
  const rows = useMemo(() => packLayout(data.packages, data.modules), [data.packages, data.modules])
  const packageOfModule = useMemo(() => new Map(data.modules.map((m) => [m.id, m.package_id])), [data.modules])
  const plansByItem = useMemo(() => {
    const map = new Map<string, Plan[]>()
    for (const p of data.plans) map.set(p.item_id, [...(map.get(p.item_id) ?? []), p])
    return map
  }, [data.plans])
  const filesByItem = useMemo(() => fileCountsByItem(data.files, data.plans), [data.files, data.plans])
  const openActionsByItem = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of data.actions) if (a.done_at === null) map.set(a.item_id, (map.get(a.item_id) ?? 0) + 1)
    return map
  }, [data.actions])
  const mineByItem = useMemo(() => mineActionsByItem(data.actions, viewerId), [data.actions, viewerId])

  const filterOn = isActive(filter)
  const unreadByItem = useMemo(() => summarizeUnread(data.unread), [data.unread])
  const cards = useMemo(
    () => {
      return onBoard.map((item) => {
        const tone = itemTone(item, viewerId, data.participants)
        const bucket = countBucket(item, data.actions, viewerId)
        const packageId = item.module_id ? (packageOfModule.get(item.module_id) ?? null) : null
        const fresh = unreadByItem.get(item.id) ?? null
        const visible =
          !filterOn || (bucket !== null && matches(item, { tone: BUCKET_TONE[bucket], packageId, unread: fresh !== null }, filter))
        const moverId = item.updated_by ?? item.created_by
        const mover = data.participants.find((p) => p.user_id === moverId)
        return {
          item,
          tone,
          label: itemStatusLabel(item, viewerId, data.participants),
          mode: wireMode(item, tone),
          visible,
          fresh,
          mover: mover ? { short: mover.short, name: mover.display_name } : null,
        }
      })
    },
    [onBoard, viewerId, data.participants, data.actions, unreadByItem, packageOfModule, filterOn, filter],
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
  // Where data has each drawn card: its place in the active view, else its own.
  const posById = useRef(new Map<string, Point>())
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
  // A view switch retargets every card that stays drawn, so it slides to its
  // place in the new view.
  useLayoutEffect(() => {
    const seen = new Set<string>()
    posById.current = new Map(onBoard.map((i) => [i.id, positionOf(i, positions)]))
    for (const item of onBoard) {
      seen.add(item.id)
      const { x: px, y: py } = posById.current.get(item.id) as Point
      let s = springs.current.get(item.id)
      if (!s) {
        s = { x: px, y: py, tx: px, ty: py, vx: 0, vy: 0, pending: null }
        springs.current.set(item.id, s)
      } else if (draggingRef.current !== item.id) {
        const p = s.pending
        if (p && p.viewId !== viewId) s.pending = null
        else if (p && px === p.x && py === p.y) s.pending = null
        else if (p && !(px === p.baseX && py === p.baseY)) s.pending = null
        if (!s.pending) {
          s.tx = px
          s.ty = py
        }
      }
      const el = els.current.get(item.id)
      if (el) place(el, s)
    }
    // A card that leaves the board forgets its entry delay too, so when a view
    // switch brings it back it pops in at once instead of waiting its load turn.
    for (const id of springs.current.keys()) {
      if (seen.has(id)) continue
      springs.current.delete(id)
      delays.current.set(id, 0)
    }
  }, [onBoard, positions, viewId])

  // One frame of every moving spring, called by Wires before it reads rects.
  // Returns whether any card moved, so Wires can rest when none did.
  const stepFrame = useCallback(() => {
    let moved = false
    for (const [id, s] of springs.current) {
      if (s.x === s.tx && s.y === s.ty && s.vx === 0 && s.vy === 0) continue
      moved = true
      if (reduced.current) {
        Object.assign(s, { x: s.tx, y: s.ty, vx: 0, vy: 0 })
      } else {
        Object.assign(s, stepSpring(s))
        if (settled(s)) Object.assign(s, { x: s.tx, y: s.ty, vx: 0, vy: 0 })
      }
      const el = els.current.get(id)
      if (el) place(el, s)
    }
    return moved
  }, [])

  // ---------- drag ----------
  const saveJobs = useRef(new Map<string, SaveJob>())
  const [moveFailed, setMoveFailed] = useState(false)

  // Sends one position, to the view it was dropped in or to the item itself on
  // the main board. A failed save springs the card back to where the data has
  // it and says so, unless a newer drop of the same card took its place.
  const projectId = data.project.id
  const savePosition = useCallback(
    (id: string, x: number, y: number, inView: string | null) => {
      const save = inView ? upsertViewPosition(projectId, inView, id, x, y) : updateItemPosition(id, x, y)
      save.catch((err: unknown) => {
        console.error(err)
        const s = springs.current.get(id)
        const p = s?.pending
        if (s && p && p.x === x && p.y === y && p.viewId === inView) {
          s.pending = null
          const pos = posById.current.get(id)
          if (pos && draggingRef.current !== id) {
            s.tx = pos.x
            s.ty = pos.y
          }
        }
        setMoveFailed(true)
      })
    },
    [projectId],
  )

  // Saves still waiting out the debounce go now when the page is hidden or
  // closed (pagehide) and when the board unmounts, so a quick drop is not lost.
  const flushSaves = useCallback(() => {
    const jobs = saveJobs.current
    for (const [id, job] of jobs) {
      clearTimeout(job.timer)
      savePosition(id, job.x, job.y, job.viewId)
    }
    jobs.clear()
  }, [savePosition])

  useEffect(() => {
    window.addEventListener('pagehide', flushSaves)
    return () => {
      window.removeEventListener('pagehide', flushSaves)
      flushSaves()
    }
  }, [flushSaves])

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

  const onDrop = useCallback(
    (id: string, x: number, y: number) => {
      const s = springs.current.get(id)
      const pos = posById.current.get(id)
      if (!s || !pos) return
      const rx = Math.round(x)
      const ry = Math.round(y)
      s.tx = rx
      s.ty = ry
      s.pending = {
        x: rx,
        y: ry,
        baseX: s.pending?.baseX ?? pos.x,
        baseY: s.pending?.baseY ?? pos.y,
        viewId,
      }
      wiresRef.current?.burst(id, DROP_BURST)
      const jobs = saveJobs.current
      const old = jobs.get(id)
      if (old) clearTimeout(old.timer)
      const timer = setTimeout(() => {
        jobs.delete(id)
        savePosition(id, rx, ry, viewId)
      }, SAVE_DEBOUNCE_MS)
      jobs.set(id, { timer, x: rx, y: ry, viewId })
    },
    [savePosition, viewId],
  )

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

  // Every card that arrives sends a spark burst along its wire when it pops
  // in: the whole first load one after another, and later each new item, also
  // the one a new item toast announces. The first load also draws the wires
  // up, once. Wires stays awake while cards pop, their rects change then.
  const burstDone = useRef(new Set<string>())
  const drewUp = useRef(false)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let lastDelay = -1
    for (const item of onBoard) {
      if (burstDone.current.has(item.id)) continue
      burstDone.current.add(item.id)
      const delay = enterDelays.get(item.id) ?? 0
      lastDelay = Math.max(lastDelay, delay)
      timers.push(setTimeout(() => wiresRef.current?.burst(item.id, ENTRY_BURST), delay))
    }
    if (lastDelay >= 0) wiresRef.current?.wake(lastDelay + popMs())
    return () => timers.forEach(clearTimeout)
  }, [onBoard, enterDelays])
  // Before paint, so the first frame Wires draws is already the draw up.
  useLayoutEffect(() => {
    if (drewUp.current || onBoard.length === 0) return
    drewUp.current = true
    wiresRef.current?.drawUp()
  }, [onBoard])

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

  // Fit again when the window crosses the phone breakpoint: the top bar
  // changes height and the board is a different shape.
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    let raf = 0
    const refit = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fitAll)
    }
    mq.addEventListener('change', refit)
    return () => {
      mq.removeEventListener('change', refit)
      cancelAnimationFrame(raf)
    }
  }, [fitAll])

  // ---------- new card placement ----------
  useImperativeHandle(
    ref,
    () => ({
      placeNew: (moduleId) => {
        const host = boardRef.current
        const obstacles: Rect[] = []
        let w = NEW_CARD_SIZE.w
        for (const [id, el] of els.current) {
          const s = springs.current.get(id)
          if (s) obstacles.push({ x: s.tx, y: s.ty, w: el.offsetWidth, h: el.offsetHeight })
          w = el.offsetWidth || w
        }
        // Cards the view hides keep their own place on the main board, so a
        // new card does not land on one of them either.
        if (activeView) {
          for (const item of data.items) {
            if (!isOnBoard(item) || els.current.has(item.id)) continue
            obstacles.push({ x: item.pos_x, y: item.pos_y, w: NEW_CARD_SIZE.w, h: NEW_CARD_SIZE.h })
          }
        }
        host?.querySelectorAll<HTMLElement>('[data-pack]').forEach((p) => {
          obstacles.push({ x: p.offsetLeft, y: p.offsetTop, w: p.offsetWidth, h: p.offsetHeight })
        })
        const hostRect = host?.getBoundingClientRect()
        const ox = hostRect?.left ?? 0
        const oy = hostRect?.top ?? 0
        const [cx, cy] = screenToWorld(view, (hostRect?.width ?? 0) / 2, (hostRect?.height ?? 0) / 2)
        let anchor: Rect | null = null
        const mod = moduleId ? host?.querySelector(`.hg-mod[data-module="${CSS.escape(moduleId)}"]`) : null
        if (mod) {
          const r = mod.getBoundingClientRect()
          const [x, y] = screenToWorld(view, r.left - ox, r.top - oy)
          anchor = { x, y, w: r.width / view.z, h: r.height / view.z }
        }
        // Cards and pack columns are obstacles. The spots beside a module lie
        // outside its own column, so the column never pushes its card away.
        return placeNewCard({ anchor, center: { x: cx, y: cy }, size: { ...NEW_CARD_SIZE, w }, obstacles })
      },
    }),
    [view, activeView, data.items],
  )

  const onBoardClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as Element).closest(NO_DESELECT)) return
      onSelect(null)
    },
    [onSelect],
  )

  return (
    <div className="hg-board-wrap">
      <Aurora />
      <div
        ref={boardRef}
        className={`hg-board${vp.isPanning ? ' hg-board-panning' : ''}`}
        {...vp.bind}
        onClick={onBoardClick}
      >
        <Wires ref={wiresRef} items={wireItems} view={view} hotIds={hotIds} onFrame={stepFrame} />
        <div
          className="hg-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, '--hg-z': view.z } as CSSProperties}
          {...drag.bind}
        >
          {rows.map(({ pkg, modules }) => (
            <PackColumn
              key={pkg.id}
              pkg={pkg}
              modules={modules}
              items={items}
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
              actionsMine={mineByItem.get(c.item.id) ?? 0}
              fileCount={filesByItem.get(c.item.id) ?? 0}
              mover={c.mover}
              fresh={c.fresh}
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
      {moveFailed && (
        <div className="hg-notice" role="status">
          <span>{t('vinnubord.board.moveError')}</span>
          <button type="button" onClick={() => setMoveFailed(false)}>
            {t('common.close')}
          </button>
        </div>
      )}
      {children}
    </div>
  )
}

const NO_PLANS: Plan[] = []
