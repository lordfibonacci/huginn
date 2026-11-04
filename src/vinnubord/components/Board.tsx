import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useViewport } from '../hooks/useViewport'
import { useCardDrag, type DragTarget } from '../hooks/useCardDrag'
import { useMarquee } from '../hooks/useMarquee'
import { useZoneDraw } from '../hooks/useZoneDraw'
import {
  updateItemPosition,
  updatePackagePosition,
  updateZoneRect,
  upsertViewPackPosition,
  upsertViewPosition,
  upsertViewZonePosition,
} from '../lib/api'
import type { CardModel } from '../lib/cards'
import { arrangeGrid } from '../lib/arrange'
import { carrySpent, carryStep, type Carry } from '../lib/carry'
import { pendingDrop, pendingFailed, pendingStep, type Pending } from '../lib/pending'
import { isActive, type Filter } from '../lib/filters'
import {
  DEFAULT_PADDING,
  freeRect,
  parsePx,
  revealView,
  screenToWorld,
  START_PAD,
  START_ZOOM,
  startAtPack,
  type Padding,
  type Rect,
} from '../lib/geometry'
import { boardOrder, packLayout } from '../lib/layout'
import { placeNewCard } from '../lib/placement'
import { parseDuration } from '../lib/motion'
import { fileCountsByItem } from '../lib/panel'
import {
  EMPTY_SELECTION,
  groupMoves,
  isMember,
  parseSelKey,
  selKey,
  selectInRect,
  selectionSize,
  toggleMember,
  type Boxed,
  type SelTarget,
  type Selection,
} from '../lib/selection'
import { settled, stepSpring, type Spring } from '../lib/spring'
import { isOnBoard, mineActionsByItem } from '../lib/status'
import type { BoardData, Item, Plan, View } from '../lib/types'
import { packPositionsOf, positionOf, positionsOf } from '../lib/views'
import { clampZoneSize, zoneMembers, zonePositionsOf, zoneRect } from '../lib/zones'
import { Aurora } from './Aurora'
import { ItemCard } from './ItemCard'
import { PackColumn } from './PackColumn'
import { SelectionBar } from './SelectionBar'
import { Wires, type WireItem, type WiresHandle } from './Wires'
import { Zone } from './Zone'

// The whiteboard: pack columns, item cards and wires inside one pan and zoom
// world. Card positions live in a spring per card that Board steps every frame
// (through Wires' animation loop) and writes straight to the card's style, so
// a drag never re-renders React. Data decides where a card rests, except while
// it is dragged here or its own drop is still on the way to the database.
// Inside a view a card rests at its place in that view (hg_view_positions),
// else at its own place, and a drop is saved to the view, never to the item.
// A pack column is dragged by its title and moves with its modules (they are
// its children). It follows the same view rule as a card: inside a view it
// rests at its place in that view (hg_view_pack_positions), else at its own,
// and a drop is saved to the view, never to the package. The save goes at
// once, and until the data shows it the column rests at the dropped place.
// A box (zone) is dragged by its name and follows the pack rules: its place
// is per view (hg_view_zone_positions), its size is its own everywhere.
// The pan and zoom view is written to the world layer by useViewport (worldRef);
// nothing here writes its transform or --hg-z, so a re-render in the middle of
// a gesture never moves the world. Anything that needs the live view reads
// vp.viewRef.

type Props = {
  data: BoardData
  // The items the active view draws (itemsInView), all on board items without one.
  items: Item[]
  // One model per drawn item in board order (cardModels), shared with the list.
  cards: CardModel[]
  view: View | null
  viewerId: string
  filter: Filter
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenModule: (moduleId: string) => void
  // A plain click or tap on a box name.
  onOpenZone: (id: string) => void
  // Draw mode: a press and drag on the board draws a new box (useZoneDraw).
  drawing: boolean
  // A drawn rectangle big enough for a box, in world units.
  onDrawn: (rect: Rect) => void
  // The draw ended without a box (too small, a second finger, Esc).
  onDrawCancel: () => void
  // Pack columns folded in this browser (useCollapsedPacks): their cards are
  // not drawn, the list and the pills still show them.
  collapsedPacks: ReadonlySet<string>
  onToggleFold: (packageId: string) => void
  // The wide list drawer is open on the left of the board.
  listOpen: boolean
  // An item or module panel is open on the right (a sheet on a phone).
  panelOpen: boolean
  // The open panel is the wide reader panel (--hg-panel-w-reader).
  panelWide: boolean
  // Drawn over the board inside its area (the new item toast).
  children?: ReactNode
  ref?: Ref<BoardHandle>
}

export type BoardHandle = {
  // A free world position for a new card beside its module, or on the centre
  // of the current view when it has none.
  placeNew: (moduleId: string | null) => { x: number; y: number }
  // Glide so the card sits in the centre of the free area, with the panel counted as open. false when the card is not drawn.
  reveal: (itemId: string) => boolean
  // Light one card like a hover (null clears). Written on the element, no render.
  peek: (itemId: string | null) => void
}

// A dropped position waiting for the database (lib/pending).
type CardSpring = Spring & { pending: Pending | null }
// A debounced position save that has not been sent yet. It keeps the view it
// was dropped in, so a view switch during the debounce cannot redirect it.
type SaveJob = { timer: ReturnType<typeof setTimeout>; x: number; y: number; viewId: string | null }
type Point = { x: number; y: number }
// A dropped pack position waiting for the database, same reading as Pending.
type PackPending = { x: number; y: number; baseX: number; baseY: number; viewId: string | null }
// A dropped box place or size waiting for the database, same reading as
// Pending over all four of x, y, w and h.
type ZonePending = { x: number; y: number; w: number; h: number; baseX: number; baseY: number; baseW: number; baseH: number; viewId: string | null }
// Wires stay awake this long after each pack or group move, so they follow
// the modules and the cards that moved outside the spring loop's notice.
const PACK_MOVE_WAKE_MS = 100
// An arrange of the selected cards can be undone from the selection bar this long.
const ARRANGE_UNDO_MS = 8000

const SAVE_DEBOUNCE_MS = 300
const ENTRY_START_MS = 150
const ENTRY_STEP_MS = 45
const ENTRY_BURST = 8
const DROP_BURST = 4
const NO_DESELECT = '[data-card], [data-module], [data-panel], [data-zone] .hg-zone-title, [data-zone] .hg-zone-resize'
// A board narrower than this, or any coarse pointer, opens on the first pack
// at START_ZOOM instead of fitting the whole board (spec 4.4).
const START_PACK_MAX_W = 1024
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
  cards,
  view: activeView,
  viewerId,
  filter,
  selectedId,
  onSelect,
  onOpenModule,
  onOpenZone,
  drawing,
  onDrawn,
  onDrawCancel,
  collapsedPacks,
  onToggleFold,
  listOpen,
  panelOpen,
  panelWide,
  children,
  ref,
}: Props) {
  const { t } = useTranslation()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const wiresRef = useRef<WiresHandle | null>(null)
  const vp = useViewport(boardRef)
  const { fit, view, viewRef } = vp

  // ---------- derived board ----------
  // From items, not cards: cards change on every filter keystroke, and a new
  // onBoard would rerun the springs, the entry delays and the bursts. Same
  // order as the cards (BoardPage builds them from boardOrder of these items).
  // Folded packs hide their cards from the board, not from the list or the pills.
  const packOfModule = useMemo(() => new Map(data.modules.map((m) => [m.id, m.package_id])), [data.modules])
  const hiddenIds = useMemo(
    () =>
      new Set(
        items.filter((i) => i.module_id && collapsedPacks.has(packOfModule.get(i.module_id) ?? '')).map((i) => i.id),
      ),
    [items, collapsedPacks, packOfModule],
  )
  const onBoard = useMemo(() => boardOrder(items.filter((i) => !hiddenIds.has(i.id))), [items, hiddenIds])
  // The cards drawn on the board: every model but the hidden ones.
  const drawn = useMemo(() => cards.filter((c) => !hiddenIds.has(c.item.id)), [cards, hiddenIds])
  const viewId = activeView?.id ?? null
  const positions = useMemo(() => positionsOf(data.viewPositions, viewId), [data.viewPositions, viewId])
  const packPositions = useMemo(() => packPositionsOf(data.viewPackPositions, viewId), [data.viewPackPositions, viewId])
  const zonePositions = useMemo(() => zonePositionsOf(data.viewZonePositions, viewId), [data.viewZonePositions, viewId])
  const rows = useMemo(() => packLayout(data.packages, data.modules), [data.packages, data.modules])
  // The items of each column's modules, for the fold line.
  const cardCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const { pkg, modules } of rows) {
      map.set(pkg.id, items.filter((i) => i.module_id && modules.some((m) => m.id === i.module_id)).length)
    }
    return map
  }, [rows, items])
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

  const wireItems = useMemo<WireItem[]>(
    () =>
      drawn
        .filter((c) => c.visible && c.item.module_id !== null)
        .map((c) => ({ id: c.item.id, moduleId: c.item.module_id as string, tone: c.tone, mode: c.mode })),
    [drawn],
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
  // Cards being dragged right now: data never retargets their springs.
  const draggingRef = useRef<ReadonlySet<string>>(new Set())
  // Hidden cards of folded packs whose place is on its way to the database
  // (lib/carry): a folded pack drop, or a card's own drop still pending when
  // its pack folded. Spent like a pending once the data shows it.
  const carried = useRef(new Map<string, Carry>())
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
        // A carried card drawn again (its pack opened) before the data shows
        // the carry starts there, with the carry as its pending.
        const c = carried.current.get(item.id)
        carried.current.delete(item.id)
        s =
          c && !carrySpent(c, { x: px, y: py }, viewId)
            ? { x: c.x, y: c.y, tx: c.x, ty: c.y, vx: 0, vy: 0, pending: { x: c.x, y: c.y, baseX: c.baseX, baseY: c.baseY, viewId, via: [] } }
            : { x: px, y: py, tx: px, ty: py, vx: 0, vy: 0, pending: null }
        springs.current.set(item.id, s)
      } else if (!draggingRef.current.has(item.id)) {
        if (s.pending) s.pending = pendingStep(s.pending, { x: px, y: py }, viewId)
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
    // A card that leaves with a drop still pending in this view (its pack
    // folded) keeps that drop as a carry, so a folded drag starts from it.
    for (const [id, s] of springs.current) {
      if (seen.has(id)) continue
      const p = s.pending
      if (p && p.viewId === viewId) carried.current.set(id, { x: p.x, y: p.y, baseX: p.baseX, baseY: p.baseY, viewId })
      springs.current.delete(id)
      delays.current.set(id, 0)
    }
    const byId = new Map(items.map((i) => [i.id, i]))
    for (const [id, c] of carried.current) {
      const item = byId.get(id)
      if (!item || carrySpent(c, positionOf(item, positions), viewId)) carried.current.delete(id)
    }
  }, [onBoard, items, positions, viewId])

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
        const next = p ? pendingFailed(p, { x, y }, inView) : null
        if (s && p) s.pending = next
        if (s && p && !next) {
          const pos = posById.current.get(id)
          if (pos && !draggingRef.current.has(id)) {
            s.tx = pos.x
            s.ty = pos.y
          }
        }
        const c = carried.current.get(id)
        if (c && c.x === x && c.y === y && c.viewId === inView) carried.current.delete(id)
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
      // A save still in its debounce is cancelled below, so the replaced drop
      // joins via only when its save already went out.
      s.pending = pendingDrop(s.pending, rx, ry, pos, viewId, !saveJobs.current.has(id))
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

  // ---------- pack drag ----------
  // Pack columns have no spring: a move writes the column's left and top
  // straight away, and a re-render in the middle reads the same place from
  // packPending (or the live drag position in packLive).
  const packEls = useRef(new Map<string, HTMLElement>())
  const packPending = useRef(new Map<string, PackPending>())
  const packLive = useRef(new Map<string, Point>())
  const [, setPackTick] = useState(0)
  const packPos = useCallback(
    (id: string, fallback: Point): Point => packLive.current.get(id) ?? packPending.current.get(id) ?? fallback,
    [],
  )
  const setPackEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) packEls.current.set(id, el)
    else packEls.current.delete(id)
  }, [])
  const placePack = useCallback((id: string, p: Point) => {
    const el = packEls.current.get(id)
    if (!el) return
    el.style.left = `${p.x}px`
    el.style.top = `${p.y}px`
  }, [])
  // Where the data has a pack: its place in the active view, else its own.
  const packDataPos = useCallback(
    (id: string): Point | null => {
      const pkg = data.packages.find((p) => p.id === id)
      if (!pkg) return null
      return packPositions.get(id) ?? { x: pkg.pos_x, y: pkg.pos_y }
    },
    [data.packages, packPositions],
  )
  // Data arrived or the view switched: a pending dropped in another view,
  // one the data shows, or one someone else moved off its base, is spent.
  // Same reading as the card springs above.
  useLayoutEffect(() => {
    let changed = false
    for (const pkg of data.packages) {
      const p = packPending.current.get(pkg.id)
      if (!p) continue
      const d = packDataPos(pkg.id) as Point
      if (p.viewId !== viewId || (d.x === p.x && d.y === p.y) || !(d.x === p.baseX && d.y === p.baseY)) {
        packPending.current.delete(pkg.id)
        changed = true
      }
    }
    if (changed) setPackTick((t) => t + 1)
  }, [data.packages, packDataPos, viewId])
  const savePackPosition = useCallback(
    (id: string, x: number, y: number, inView: string | null) => {
      const save = inView ? upsertViewPackPosition(projectId, inView, id, x, y) : updatePackagePosition(id, x, y)
      save.catch((err: unknown) => {
        console.error(err)
        const p = packPending.current.get(id)
        if (p && p.x === x && p.y === y && p.viewId === inView) {
          packPending.current.delete(id)
          const pos = packDataPos(id)
          if (pos && !packLive.current.has(id)) placePack(id, pos)
          setPackTick((t) => t + 1)
        }
        setMoveFailed(true)
      })
    },
    [projectId, packDataPos, placePack],
  )
  const movePack = useCallback(
    (id: string, x: number, y: number) => {
      packLive.current.set(id, { x, y })
      placePack(id, { x, y })
    },
    [placePack],
  )
  // Mirrors of the fold state for dropPack, which runs inside a drag.
  const collapsedRef = useRef(collapsedPacks)
  const hiddenRef = useRef(hiddenIds)
  useLayoutEffect(() => {
    collapsedRef.current = collapsedPacks
    hiddenRef.current = hiddenIds
  }, [collapsedPacks, hiddenIds])
  const dropPack = useCallback(
    (id: string, x: number, y: number) => {
      const base = packDataPos(id)
      packLive.current.delete(id)
      if (!base) return
      const rx = Math.round(x)
      const ry = Math.round(y)
      const old = packPending.current.get(id)
      packPending.current.set(id, { x: rx, y: ry, baseX: old?.baseX ?? base.x, baseY: old?.baseY ?? base.y, viewId })
      placePack(id, { x: rx, y: ry })
      // A folded pack takes its hidden cards along (spec 4.4): they have no
      // element and no spring, so the drop writes them straight to the
      // database by the pack's delta. The delta goes on each card's live
      // carry when it has one (a quick second drop, a hand drop still on its
      // way), else on the data. A hand drop still waiting out its debounce is
      // in that carry already, so the carry write replaces it.
      if (collapsedRef.current.has(id)) {
        const from = old ?? base
        const dx = rx - from.x
        const dy = ry - from.y
        if (dx !== 0 || dy !== 0) {
          const hidden = hiddenRef.current
          const jobs = saveJobs.current
          for (const item of items) {
            if (!hidden.has(item.id) || !item.module_id || packOfModule.get(item.module_id) !== id) continue
            const c = carryStep(positionOf(item, positions), carried.current.get(item.id), viewId, dx, dy)
            carried.current.set(item.id, c)
            const job = jobs.get(item.id)
            if (job && job.viewId === viewId) {
              clearTimeout(job.timer)
              jobs.delete(item.id)
            }
            savePosition(item.id, c.x, c.y, viewId)
          }
        }
      }
      savePackPosition(id, rx, ry, viewId)
    },
    [packDataPos, placePack, savePackPosition, viewId, items, packOfModule, positions, savePosition],
  )
  const cancelPack = useCallback(
    (id: string, x: number, y: number) => {
      packLive.current.delete(id)
      placePack(id, { x, y })
    },
    [placePack],
  )

  // ---------- zone drag ----------
  // Boxes have no spring either: a move writes left, top, width and height
  // straight away, and a re-render reads the same rect from zoneLive (the
  // live drag) or zonePending (a drop on its way to the database).
  const zoneEls = useRef(new Map<string, HTMLElement>())
  const zonePending = useRef(new Map<string, ZonePending>())
  const zoneLive = useRef(new Map<string, Rect>())
  const [, setZoneTick] = useState(0)
  const setZoneEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) zoneEls.current.set(id, el)
    else zoneEls.current.delete(id)
  }, [])
  const placeZone = useCallback((id: string, r: Rect) => {
    const el = zoneEls.current.get(id)
    if (!el) return
    el.style.left = `${r.x}px`
    el.style.top = `${r.y}px`
    el.style.width = `${r.w}px`
    el.style.height = `${r.h}px`
  }, [])
  // Where the data has a box: its place in the active view, else its own, and its size.
  const zoneDataRect = useCallback(
    (id: string): Rect | null => {
      const zone = data.zones.find((z) => z.id === id)
      return zone ? zoneRect(zone, zonePositions) : null
    },
    [data.zones, zonePositions],
  )
  const zoneRectNow = useCallback((id: string, fallback: Rect): Rect => {
    const live = zoneLive.current.get(id)
    if (live) return live
    const p = zonePending.current.get(id)
    return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : fallback
  }, [])
  // Same reading as the pack pendings above, over x, y, w and h.
  useLayoutEffect(() => {
    let changed = false
    for (const zone of data.zones) {
      const p = zonePending.current.get(zone.id)
      if (!p) continue
      const d = zoneRect(zone, zonePositions)
      const atPending = d.x === p.x && d.y === p.y && d.w === p.w && d.h === p.h
      const atBase = d.x === p.baseX && d.y === p.baseY && d.w === p.baseW && d.h === p.baseH
      if (p.viewId !== viewId || atPending || !atBase) {
        zonePending.current.delete(zone.id)
        changed = true
      }
    }
    if (changed) setZoneTick((t) => t + 1)
  }, [data.zones, zonePositions, viewId])
  // A failed save rolls the pending back only when it is still the rect that
  // save sent, x, y, w and h alike, so a failed move never undoes a newer
  // resize and a failed resize never undoes a newer move.
  const zoneSaveFailed = useCallback(
    (id: string, sent: Rect, inView: string | null) => {
      const p = zonePending.current.get(id)
      if (p && p.x === sent.x && p.y === sent.y && p.w === sent.w && p.h === sent.h && p.viewId === inView) {
        zonePending.current.delete(id)
        const r = zoneDataRect(id)
        if (r && !zoneLive.current.has(id)) placeZone(id, r)
        setZoneTick((t) => t + 1)
      }
      setMoveFailed(true)
    },
    [zoneDataRect, placeZone],
  )
  const saveZoneMove = useCallback(
    (id: string, sent: Rect, inView: string | null) => {
      const save = inView
        ? upsertViewZonePosition(projectId, inView, id, sent.x, sent.y)
        : updateZoneRect(id, { x: sent.x, y: sent.y })
      save.catch((err: unknown) => {
        console.error(err)
        zoneSaveFailed(id, sent, inView)
      })
    },
    [projectId, zoneSaveFailed],
  )
  const moveZone = useCallback(
    (id: string, x: number, y: number) => {
      const base = zoneDataRect(id)
      if (!base) return
      const now = zoneRectNow(id, base)
      const r = { x, y, w: now.w, h: now.h }
      zoneLive.current.set(id, r)
      placeZone(id, r)
    },
    [zoneDataRect, zoneRectNow, placeZone],
  )
  const dropZone = useCallback(
    (id: string, x: number, y: number) => {
      const base = zoneDataRect(id)
      if (!base) {
        zoneLive.current.delete(id)
        return
      }
      const now = zoneRectNow(id, base)
      zoneLive.current.delete(id)
      const rx = Math.round(x)
      const ry = Math.round(y)
      const old = zonePending.current.get(id)
      zonePending.current.set(id, {
        x: rx,
        y: ry,
        w: now.w,
        h: now.h,
        baseX: old?.baseX ?? base.x,
        baseY: old?.baseY ?? base.y,
        baseW: old?.baseW ?? base.w,
        baseH: old?.baseH ?? base.h,
        viewId,
      })
      const sent = { x: rx, y: ry, w: now.w, h: now.h }
      placeZone(id, sent)
      saveZoneMove(id, sent, viewId)
    },
    [zoneDataRect, zoneRectNow, placeZone, saveZoneMove, viewId],
  )
  const cancelZone = useCallback(
    (id: string, x: number, y: number) => {
      const base = zoneDataRect(id)
      const now = base ? zoneRectNow(id, base) : null
      zoneLive.current.delete(id)
      if (now) placeZone(id, { x, y, w: now.w, h: now.h })
    },
    [zoneDataRect, zoneRectNow, placeZone],
  )
  // The corner drag. For a corner press the drag's x and y are the width and
  // height: getTargetPos returned the size as a point and useCardDrag adds
  // the pointer delta (world units) to it, so the corner follows the pointer.
  const resizeZone = useCallback(
    (id: string, w: number, h: number) => {
      const base = zoneDataRect(id)
      if (!base) return
      const now = zoneRectNow(id, base)
      const size = clampZoneSize({ w, h })
      const r = { x: now.x, y: now.y, w: size.w, h: size.h }
      zoneLive.current.set(id, r)
      placeZone(id, r)
    },
    [zoneDataRect, zoneRectNow, placeZone],
  )
  // The size is the box's own everywhere, so it always goes to hg_zones,
  // also inside a view; the pending keeps the place the box has now.
  const dropZoneSize = useCallback(
    (id: string, w: number, h: number) => {
      const base = zoneDataRect(id)
      if (!base) {
        zoneLive.current.delete(id)
        return
      }
      const now = zoneRectNow(id, base)
      zoneLive.current.delete(id)
      const size = clampZoneSize({ w, h })
      const old = zonePending.current.get(id)
      zonePending.current.set(id, {
        x: now.x,
        y: now.y,
        w: size.w,
        h: size.h,
        baseX: old?.baseX ?? base.x,
        baseY: old?.baseY ?? base.y,
        baseW: old?.baseW ?? base.w,
        baseH: old?.baseH ?? base.h,
        viewId,
      })
      const sent = { x: now.x, y: now.y, w: size.w, h: size.h }
      placeZone(id, sent)
      updateZoneRect(id, { w: size.w, h: size.h }).catch((err: unknown) => {
        console.error(err)
        zoneSaveFailed(id, sent, viewId)
      })
    },
    [zoneDataRect, zoneRectNow, placeZone, zoneSaveFailed, viewId],
  )
  const cancelZoneSize = useCallback(
    (id: string) => {
      zoneLive.current.delete(id)
      const base = zoneDataRect(id)
      if (base) placeZone(id, zoneRectNow(id, base))
    },
    [zoneDataRect, zoneRectNow, placeZone],
  )

  // ---------- selection ----------
  // Ctrl (Cmd) marquee or Ctrl click picks cards and packs; a drag on any
  // member moves them all by the same delta (lib/selection). Mouse only.
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION)
  const selectionRef = useRef(selection)
  useLayoutEffect(() => {
    selectionRef.current = selection
  }, [selection])
  // Start positions of every member at the press that drags the group,
  // keyed by selKey, null while a single target drags.
  const groupStart = useRef<Map<string, Point> | null>(null)

  const clearSelection = useCallback(() => {
    if (selectionSize(selectionRef.current) > 0) setSelection(EMPTY_SELECTION)
  }, [])
  // Every drawn card at its spring target with its measured size (world units).
  const cardBoxes = useCallback((): Boxed[] => {
    const out: Boxed[] = []
    for (const [id, el] of els.current) {
      const s = springs.current.get(id)
      if (s) out.push({ id, rect: { x: s.tx, y: s.ty, w: el.offsetWidth, h: el.offsetHeight } })
    }
    return out
  }, [])
  // Every pack title box (world units).
  const titleBoxes = useCallback((): Boxed[] => {
    const out: Boxed[] = []
    for (const [id, el] of packEls.current) {
      const title = el.querySelector<HTMLElement>('.hg-pack-title')
      if (!title) continue
      out.push({
        id,
        rect: { x: el.offsetLeft + title.offsetLeft, y: el.offsetTop + title.offsetTop, w: title.offsetWidth, h: title.offsetHeight },
      })
    }
    return out
  }, [])
  // What a marquee rectangle (world units) selects right now: the drawn
  // cards at their spring targets and the pack titles.
  const selectionIn = useCallback(
    (rect: Rect, additive: boolean): Selection =>
      selectInRect(rect, cardBoxes(), titleBoxes(), additive ? selectionRef.current : EMPTY_SELECTION),
    [cardBoxes, titleBoxes],
  )
  // The cards and pack titles a box press took along, decided at the press,
  // emptied on drop and cancel.
  const zoneMembersRef = useRef<{ cards: string[]; packs: string[] }>({ cards: [], packs: [] })
  const onMarqueeSelect = useCallback((rect: Rect, additive: boolean) => setSelection(selectionIn(rect, additive)), [selectionIn])
  // While the box is drawn the cards and titles it would take light up
  // through a class written straight on their elements, no render. null
  // clears it (the release, before the real selection lands in state).
  const previewed = useRef<Selection>(EMPTY_SELECTION)
  const onMarqueePreview = useCallback(
    (rect: Rect | null, additive: boolean) => {
      const next = rect ? selectionIn(rect, additive) : EMPTY_SELECTION
      const prev = previewed.current
      for (const id of prev.cards) if (!next.cards.has(id)) els.current.get(id)?.classList.remove('hg-card-pre')
      for (const id of next.cards) if (!prev.cards.has(id)) els.current.get(id)?.classList.add('hg-card-pre')
      for (const id of prev.packs) if (!next.packs.has(id)) packEls.current.get(id)?.classList.remove('hg-pack-pre')
      for (const id of next.packs) if (!prev.packs.has(id)) packEls.current.get(id)?.classList.add('hg-pack-pre')
      previewed.current = next
    },
    [selectionIn],
  )
  const onMarqueeToggle = useCallback((t: SelTarget) => setSelection((s) => toggleMember(s, t)), [])
  const marquee = useMarquee({
    boardRef,
    viewRef,
    onSelect: onMarqueeSelect,
    onPreview: onMarqueePreview,
    onToggle: onMarqueeToggle,
    onClear: clearSelection,
  })
  const draw = useZoneDraw({ boardRef, viewRef, gestureRef: vp.gestureRef, active: drawing, onDrawn, onCancel: onDrawCancel })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection])

  // ---------- arrange ----------
  // Two or more selected cards can be laid out in a grid (lib/arrange) from
  // the selection bar. Each card drops through onDrop, so the usual save rule
  // holds (view or main board, debounced). undo keeps the places before the
  // last arrange for ARRANGE_UNDO_MS, or until the selection changes.
  const [undo, setUndo] = useState<Map<string, Point> | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopUndoTimer = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = null
  }, [])
  const arrange = useCallback(() => {
    const boxes = cardBoxes().filter((b) => selection.cards.has(b.id))
    if (boxes.length < 2) return
    const { next, prev } = arrangeGrid(boxes)
    for (const [id, p] of next) onDrop(id, p.x, p.y)
    wiresRef.current?.wake(PACK_MOVE_WAKE_MS)
    setUndo(prev)
    stopUndoTimer()
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null
      setUndo(null)
    }, ARRANGE_UNDO_MS)
  }, [cardBoxes, selection, onDrop, stopUndoTimer])
  const undoArrange = useCallback(() => {
    if (undo) for (const [id, p] of undo) onDrop(id, p.x, p.y)
    wiresRef.current?.wake(PACK_MOVE_WAKE_MS)
    setUndo(null)
    stopUndoTimer()
  }, [undo, onDrop, stopUndoTimer])
  // Every marquee, toggle, Esc or clear makes a new selection object, and
  // that ends the undo. arrange itself leaves the selection as it is. A view
  // switch ends it too: its places belong to the view it was made in.
  useEffect(() => {
    setUndo(null)
    stopUndoTimer()
  }, [selection, viewId, stopUndoTimer])
  useEffect(() => stopUndoTimer, [stopUndoTimer])

  const getTargetPos = useCallback(
    (t: DragTarget) => {
      if (t.kind === 'zoneResize') {
        const r = zoneDataRect(t.id)
        if (!r) return null
        groupStart.current = null
        clearSelection()
        // The size as a point, see resizeZone.
        const now = zoneRectNow(t.id, r)
        return { x: now.w, y: now.h }
      }
      if (t.kind === 'zone') {
        const r = zoneDataRect(t.id)
        if (!r) return null
        // A box press never drags the Ctrl selection: it drags the box and
        // the cards and pack titles whose centre lies in it right now.
        clearSelection()
        const rect = zoneRectNow(t.id, r)
        const members = zoneMembers(rect, cardBoxes(), titleBoxes())
        zoneMembersRef.current = members
        const start = new Map<string, Point>()
        start.set(selKey({ kind: 'zone', id: t.id }), { x: rect.x, y: rect.y })
        for (const id of members.cards) {
          const p = getPos(id)
          if (p) start.set(selKey({ kind: 'card', id }), p)
        }
        for (const id of members.packs) {
          const p = packDataPos(id)
          if (p) start.set(selKey({ kind: 'pack', id }), packPos(id, p))
        }
        groupStart.current = start
        return { x: rect.x, y: rect.y }
      }
      const own = t.kind === 'card' ? getPos(t.id) : (() => {
        const pos = packDataPos(t.id)
        return pos ? packPos(t.id, pos) : null
      })()
      if (!own) return null
      const sel = selectionRef.current
      if (!isMember(sel, t)) {
        // A press outside the selection drags alone and drops the selection.
        groupStart.current = null
        clearSelection()
        return own
      }
      const start = new Map<string, Point>()
      for (const id of sel.cards) {
        const p = getPos(id)
        if (p) start.set(selKey({ kind: 'card', id }), p)
      }
      for (const id of sel.packs) {
        const p = packDataPos(id)
        if (p) start.set(selKey({ kind: 'pack', id }), packPos(id, p))
      }
      groupStart.current = start
      return own
    },
    [getPos, packDataPos, packPos, clearSelection, zoneDataRect, zoneRectNow, cardBoxes, titleBoxes],
  )
  const onTargetMove = useCallback(
    (t: DragTarget, x: number, y: number) => {
      if (t.kind === 'zoneResize') {
        resizeZone(t.id, x, y)
        return
      }
      const group = groupStart.current
      if (group) {
        for (const [key, p] of groupMoves(group, t, x, y)) {
          const m = parseSelKey(key)
          if (m.kind === 'card') onMove(m.id, p.x, p.y)
          else if (m.kind === 'zone') moveZone(m.id, p.x, p.y)
          else movePack(m.id, p.x, p.y)
        }
      } else if (t.kind === 'card') onMove(t.id, x, y)
      else if (t.kind === 'zone') moveZone(t.id, x, y)
      else movePack(t.id, x, y)
      if (group || t.kind !== 'card') wiresRef.current?.wake(PACK_MOVE_WAKE_MS)
    },
    [onMove, movePack, moveZone, resizeZone],
  )
  const onTargetDrop = useCallback(
    (t: DragTarget, x: number, y: number) => {
      if (t.kind === 'zoneResize') {
        groupStart.current = null
        dropZoneSize(t.id, x, y)
        return
      }
      const group = groupStart.current
      groupStart.current = null
      if (group) {
        for (const [key, p] of groupMoves(group, t, x, y)) {
          const m = parseSelKey(key)
          if (m.kind === 'card') onDrop(m.id, p.x, p.y)
          else if (m.kind === 'zone') dropZone(m.id, p.x, p.y)
          else dropPack(m.id, p.x, p.y)
        }
      } else if (t.kind === 'card') onDrop(t.id, x, y)
      else if (t.kind === 'zone') dropZone(t.id, x, y)
      else dropPack(t.id, x, y)
      zoneMembersRef.current = { cards: [], packs: [] }
      if (group || t.kind !== 'card') wiresRef.current?.wake(PACK_MOVE_WAKE_MS)
    },
    [onDrop, dropPack, dropZone, dropZoneSize],
  )
  const onTargetCancel = useCallback(
    (t: DragTarget, x: number, y: number) => {
      if (t.kind === 'zoneResize') {
        groupStart.current = null
        cancelZoneSize(t.id)
        return
      }
      const group = groupStart.current
      groupStart.current = null
      if (group) {
        for (const [key, p] of group) {
          const m = parseSelKey(key)
          if (m.kind === 'card') onCancel(m.id, p.x, p.y)
          else if (m.kind === 'zone') cancelZone(m.id, p.x, p.y)
          else cancelPack(m.id, p.x, p.y)
        }
      } else if (t.kind === 'card') onCancel(t.id, x, y)
      else if (t.kind === 'zone') cancelZone(t.id, x, y)
      else cancelPack(t.id, x, y)
      zoneMembersRef.current = { cards: [], packs: [] }
      if (group || t.kind !== 'card') wiresRef.current?.wake(PACK_MOVE_WAKE_MS)
    },
    [onCancel, cancelPack, cancelZone, cancelZoneSize],
  )
  // A pack title tap reaches the button's own onClick (fit), and a box name
  // tap its own onClick (open the box), nothing to do here for either.
  const onTargetTap = useCallback(
    (t: DragTarget) => {
      if (t.kind === 'card') onTap(t.id)
    },
    [onTap],
  )

  const drag = useCardDrag({
    viewRef,
    gestureRef: vp.gestureRef,
    getPos: getTargetPos,
    onMove: onTargetMove,
    onDrop: onTargetDrop,
    onCancel: onTargetCancel,
    onTap: onTargetTap,
  })
  // Everything lifted: the dragged target, the whole selection when it is a
  // member, or the cards and packs a dragged box took along.
  const lifted = useMemo<Selection>(() => {
    const d = drag.dragging
    if (d?.kind === 'zone') {
      const m = zoneMembersRef.current
      return { cards: new Set(m.cards), packs: new Set(m.packs) }
    }
    if (!d || d.kind === 'zoneResize') return EMPTY_SELECTION
    if (isMember(selection, d)) return selection
    return d.kind === 'card' ? { cards: new Set([d.id]), packs: new Set() } : { cards: new Set(), packs: new Set([d.id]) }
  }, [drag.dragging, selection])
  const liftedZone = drag.dragging && (drag.dragging.kind === 'zone' || drag.dragging.kind === 'zoneResize') ? drag.dragging.id : null
  useLayoutEffect(() => {
    draggingRef.current = lifted.cards
  }, [lifted])

  const hotIds = useMemo(() => {
    const set = new Set<string>(lifted.cards)
    if (selectedId) set.add(selectedId)
    return set
  }, [selectedId, lifted])

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
  // Padding of the free area: the list drawer on the left, the side panel on
  // the right (from 768 px, the reader width while a reader is open), the half
  // sheet at the bottom (below). The CSS
  // tokens are read, so a restyle moves the free area with the surfaces.
  const padding = useCallback(
    (panel: boolean): Padding => {
      const el = boardRef.current
      const size = { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 }
      const root = getComputedStyle(document.documentElement)
      const phone = window.matchMedia('(max-width: 767px)').matches
      const list = listOpen ? parsePx(root.getPropertyValue('--hg-list-w')) : 0
      const panelW = panel && !phone ? parsePx(root.getPropertyValue(panelWide ? '--hg-panel-w-reader' : '--hg-panel-w')) + parsePx(root.getPropertyValue('--hg-panel-inset')) : 0
      return freeRect(size, { list, panel: panelW, sheet: panel && phone }, DEFAULT_PADDING)
    },
    [listOpen, panelWide],
  )

  // animate: glide over --hg-dur-view (the fit button), or jump (first load).
  const fitAll = useCallback((animate: boolean) => {
    const rects: Rect[] = []
    for (const [id, el] of els.current) {
      const s = springs.current.get(id)
      if (s) rects.push({ x: s.tx, y: s.ty, w: el.offsetWidth, h: el.offsetHeight })
    }
    boardRef.current?.querySelectorAll<HTMLElement>('[data-pack]').forEach((p) => {
      rects.push({ x: p.offsetLeft, y: p.offsetTop, w: p.offsetWidth, h: p.offsetHeight })
    })
    boardRef.current?.querySelectorAll<HTMLElement>('[data-zone]').forEach((z) => {
      rects.push({ x: z.offsetLeft, y: z.offsetTop, w: z.offsetWidth, h: z.offsetHeight })
    })
    fit(rects, padding(panelOpen), animate)
  }, [fit, padding, panelOpen])

  // Open once per load, as soon as the board has a size. Narrow and touch
  // boards start readable on the first pack, the rest fit the whole board.
  // Both leave out the free area's covers: a remembered open list on a wide
  // touch board (an iPad in landscape) pushes the first pack right of it.
  // Rotating or resizing later keeps the view where it is.
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (fitted.current) return
    const el = boardRef.current
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if ((el.clientWidth < START_PACK_MAX_W || coarse) && rows.length > 0) {
      const cover = padding(panelOpen).left - DEFAULT_PADDING.left
      vp.setView(startAtPack({ x: rows[0].pkg.pos_x, y: rows[0].pkg.pos_y }, START_ZOOM, START_PAD, cover))
    } else {
      fitAll(false)
    }
    fitted.current = true
  })

  // A pack title glides to its column, fitted in width with its top under the top bar.
  const { fitWidth } = vp
  const onFitPack = useCallback(
    (id: string) => {
      const p = boardRef.current?.querySelector<HTMLElement>(`[data-pack="${CSS.escape(id)}"]`)
      if (p) fitWidth({ x: p.offsetLeft, y: p.offsetTop, w: p.offsetWidth, h: p.offsetHeight }, padding(panelOpen))
    },
    [fitWidth, padding, panelOpen],
  )

  // ---------- handle: new card placement, reveal and peek ----------
  // The card a list row lights right now (hg-card-peek on its element).
  const peeked = useRef<string | null>(null)
  const { animateTo } = vp
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
        // Cards with no element still have a place, so a new card does not
        // land on one of them either. A card the view hides counts at its own
        // place on the main board, where a new card made in a view is placed;
        // a card of a folded pack counts where this board has it (its carry,
        // else its place in the active view). isOnBoard reads its own clock
        // here, one call per new card: a second of drift from the board's
        // clock is harmless.
        for (const item of data.items) {
          if (!isOnBoard(item) || els.current.has(item.id)) continue
          const p = hiddenIds.has(item.id)
            ? (carried.current.get(item.id) ?? positionOf(item, positions))
            : { x: item.pos_x, y: item.pos_y }
          obstacles.push({ x: p.x, y: p.y, w: NEW_CARD_SIZE.w, h: NEW_CARD_SIZE.h })
        }
        host?.querySelectorAll<HTMLElement>('[data-pack]').forEach((p) => {
          obstacles.push({ x: p.offsetLeft, y: p.offsetTop, w: p.offsetWidth, h: p.offsetHeight })
        })
        const hostRect = host?.getBoundingClientRect()
        const ox = hostRect?.left ?? 0
        const oy = hostRect?.top ?? 0
        const v = viewRef.current
        const [cx, cy] = screenToWorld(v, (hostRect?.width ?? 0) / 2, (hostRect?.height ?? 0) / 2)
        let anchor: Rect | null = null
        const mod = moduleId ? host?.querySelector(`.hg-mod[data-module="${CSS.escape(moduleId)}"]`) : null
        if (mod) {
          const r = mod.getBoundingClientRect()
          const [x, y] = screenToWorld(v, r.left - ox, r.top - oy)
          anchor = { x, y, w: r.width / v.z, h: r.height / v.z }
        } else if (moduleId) {
          // A module of a folded pack has no element: the new card goes
          // beside its column instead.
          const pack = packOfModule.get(moduleId)
          const col = pack ? host?.querySelector<HTMLElement>(`[data-pack="${CSS.escape(pack)}"]`) : null
          if (col) anchor = { x: col.offsetLeft, y: col.offsetTop, w: col.offsetWidth, h: col.offsetHeight }
        }
        // Cards and pack columns are obstacles. The spots beside a module lie
        // outside its own column, so the column never pushes its card away.
        return placeNewCard({ anchor, center: { x: cx, y: cy }, size: { ...NEW_CARD_SIZE, w }, obstacles })
      },
      reveal: (itemId) => {
        const el = els.current.get(itemId)
        const s = springs.current.get(itemId)
        const host = boardRef.current
        if (!el || !s || !host) return false
        const size = { w: host.clientWidth, h: host.clientHeight }
        animateTo(revealView({ x: s.tx, y: s.ty, w: el.offsetWidth, h: el.offsetHeight }, viewRef.current, size, padding(true)))
        return true
      },
      peek: (itemId) => {
        const prev = peeked.current
        if (prev && prev !== itemId) els.current.get(prev)?.classList.remove('hg-card-peek')
        peeked.current = itemId
        if (itemId) els.current.get(itemId)?.classList.add('hg-card-peek')
      },
    }),
    [viewRef, data.items, positions, hiddenIds, packOfModule, animateTo, padding],
  )

  const onBoardClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as Element).closest(NO_DESELECT)) return
      onSelect(null)
      clearSelection()
    },
    [onSelect, clearSelection],
  )

  return (
    <div className="hg-board-wrap">
      <Aurora />
      <div
        ref={boardRef}
        className={`hg-board${vp.isPanning ? ' hg-board-panning' : ''}${drawing ? ' hg-board-draw' : ''}`}
        {...vp.bind}
        onPointerDownCapture={(e) => {
          if (!draw.onPointerDownCapture(e)) marquee.bind.onPointerDownCapture(e)
        }}
        onClick={onBoardClick}
      >
        <Wires ref={wiresRef} items={wireItems} viewRef={viewRef} gestureRef={vp.gestureRef} hotIds={hotIds} onFrame={stepFrame} />
        <div ref={vp.worldRef} className="hg-world" {...drag.bind}>
          {data.zones.map((z) => (
            <Zone key={z.id} zone={z} rect={zoneRectNow(z.id, zoneRect(z, zonePositions))} lifted={liftedZone === z.id} setEl={setZoneEl} onOpen={onOpenZone} />
          ))}
          {rows.map(({ pkg, modules }) => (
            <PackColumn
              key={pkg.id}
              pkg={pkg}
              pos={packPos(pkg.id, packPositions.get(pkg.id) ?? { x: pkg.pos_x, y: pkg.pos_y })}
              lifted={lifted.packs.has(pkg.id)}
              chosen={selection.packs.has(pkg.id)}
              setEl={setPackEl}
              modules={modules}
              items={items}
              viewerId={viewerId}
              participants={data.participants}
              hotModuleIds={hotModuleIds}
              dimModuleIds={dimModuleIds}
              onOpenModule={onOpenModule}
              onFitPack={onFitPack}
              folded={collapsedPacks.has(pkg.id)}
              cardCount={cardCounts.get(pkg.id) ?? 0}
              onToggleFold={onToggleFold}
            />
          ))}
          {drawn.map((c) => (
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
              freshComment={c.freshComment}
              moduleName={c.moduleName}
              showStamp={c.showStamp}
              parked={c.item.status === 'parked'}
              closed={c.closed}
              pulse={c.mode === 'pulse'}
              selected={c.item.id === selectedId}
              lifted={lifted.cards.has(c.item.id)}
              chosen={selection.cards.has(c.item.id)}
              dim={!c.visible}
              enterDelay={enterDelays.get(c.item.id) ?? 0}
              setEl={setEl}
              onTap={onTap}
            />
          ))}
        </div>
        <div ref={marquee.boxRef} className="hg-marquee" aria-hidden="true" />
        <div ref={draw.boxRef} className="hg-zone-draft" aria-hidden="true" />
      </div>
      <div className="hg-zoom">
        <button type="button" onClick={vp.zoomOut} aria-label={t('vinnubord.board.zoomOut')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
        {/* One string child, one text node: useViewport's apply() writes its
            nodeValue, so React and apply() keep updating the same node. */}
        <span ref={vp.zoomLabelRef} className="hg-zoom-val" aria-label={t('vinnubord.board.zoomLevel')}>
          {`${Math.round(view.z * 100)}%`}
        </span>
        <button type="button" onClick={vp.zoomIn} aria-label={t('vinnubord.board.zoomIn')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10M8 3v10" />
          </svg>
        </button>
        <button type="button" onClick={() => fitAll(true)} aria-label={t('vinnubord.board.fit')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
          </svg>
        </button>
      </div>
      {(selection.cards.size >= 2 || undo !== null) && (
        <SelectionBar count={selection.cards.size} undoable={undo !== null} onArrange={arrange} onUndo={undoArrange} onCancel={clearSelection} />
      )}
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
