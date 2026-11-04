import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import { useViewer } from '../hooks/useViewer'
import { useActiveView } from '../hooks/useActiveView'
import { useBoardData } from '../hooks/useBoardData'
import { useFilter } from '../hooks/useFilter'
import { useNewItemToast } from '../hooks/useNewItemToast'
import { useListPrefs } from '../hooks/useListPrefs'
import { useCollapsedPacks } from '../hooks/useCollapsedPacks'
import { createZone } from '../lib/api'
import { cardModels } from '../lib/cards'
import { packageCounts, tagCounts } from '../lib/filters'
import type { Rect } from '../lib/geometry'
import { boardOrder } from '../lib/layout'
import { listRows } from '../lib/list'
import { summarizeUnread } from '../lib/reads'
import { searchIndex } from '../lib/search'
import { countsFor, isOnBoard, mineActionsByItem } from '../lib/status'
import type { Item, View } from '../lib/types'
import { itemsInView, viewCounts } from '../lib/views'
import { DEFAULT_ZONE_COLOR, DEFAULT_ZONE_TITLE } from '../lib/zones'
import { Board, type BoardHandle } from '../components/Board'
import { FilterSheet } from '../components/FilterSheet'
import { ListDrawer } from '../components/ListDrawer'
import { ItemPanel } from '../components/ItemPanel'
import { ModulePanel } from '../components/ModulePanel'
import { NewItemSheet } from '../components/NewItemSheet'
import { PanelShell } from '../components/PanelShell'
import { ZonePanel } from '../components/ZonePanel'
import { Toast } from '../components/Toast'
import { TopBar } from '../components/TopBar'
import { ViewMenu } from '../components/ViewMenu'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { NoAccessPage } from './NoAccessPage'

// Stable empty list for useActiveView before the board has loaded, so a stored
// view key is never cleared against a placeholder.
const NO_VIEWS: View[] = []

// When focus is inside the list drawer, move it to the top bar list button
// before the drawer closes.
function focusListButton() {
  const active = document.activeElement
  if (!(active instanceof Element) || !active.closest('.hg-list')) return
  document.querySelector<HTMLElement>('.hg-list-btn')?.focus()
}

// The whiteboard of one project: the top bar with counters and filters, the
// board with all the remaining height, the side panel (bottom sheet on narrow
// screens) for the selected item or the opened module, and the new item sheet.
export function BoardPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { user, projects, loading: viewerLoading, error: viewerError, reload: reloadViewer } = useViewer()
  const project = projects.find((p) => p.slug === slug) ?? null
  const { data, loading: boardLoading, error, reload, live } = useBoardData(project?.id ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openModuleId, setOpenModuleId] = useState<string | null>(null)
  const [openZoneId, setOpenZoneId] = useState<string | null>(null)
  // The file open in the reader, by id: the row is looked up live in
  // data.files on every render, so a replaced or removed file follows.
  const [readerFileId, setReaderFileId] = useState<string | null>(null)
  const [searchRequest, setSearchRequest] = useState(0)
  // Any change of the selected item ends the reader: select, closePanel, openModule,
  // a deleted item, a list pick. One effect instead of a call in each.
  useEffect(() => {
    setReaderFileId(null)
  }, [selectedId])
  const closeReader = useCallback(() => setReaderFileId(null), [])
  const [newOpen, setNewOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // The filter sheet belongs to the two row bar: past 1024 px (a tablet
  // turned to landscape) its button is gone, so the sheet closes too.
  const narrow = useMediaQuery('(max-width: 1023px)')
  useEffect(() => {
    if (!narrow) setFiltersOpen(false)
  }, [narrow])
  const filterApi = useFilter(project?.id ?? '')
  const boardRef = useRef<BoardHandle | null>(null)
  const newItemToast = useNewItemToast(data, user?.id ?? '')

  // The box just drawn: its panel focuses the name field with the text selected.
  // Any other panel choice ends it, so reopening that box later does not focus.
  const [justCreatedZone, setJustCreatedZone] = useState<string | null>(null)
  // An item, a module and a box never share the panel: choosing one clears the
  // others, null (empty board, Esc, sheet dragged shut) clears all three.
  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setOpenModuleId(null)
    setOpenZoneId(null)
    setJustCreatedZone(null)
  }, [])
  const openModule = useCallback((id: string) => {
    setOpenModuleId(id)
    setSelectedId(null)
    setOpenZoneId(null)
    setJustCreatedZone(null)
  }, [])
  // onDrawn sets justCreatedZone right after this, in the same batch.
  const openZone = useCallback((id: string) => {
    setOpenZoneId(id)
    setSelectedId(null)
    setOpenModuleId(null)
    setJustCreatedZone(null)
  }, [])
  // Draw mode (the Kassi button): the next press and drag on the board draws
  // a box. Any end of the draw ends the mode, a new box opens in its panel.
  const [drawing, setDrawing] = useState(false)
  const toggleDraw = useCallback(() => setDrawing((d) => !d), [])
  const onDrawCancel = useCallback(() => setDrawing(false), [])
  const [zoneError, setZoneError] = useState<string | null>(null)
  useEffect(() => {
    if (!drawing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawing])
  const onDrawn = useCallback(
    (rect: Rect) => {
      setDrawing(false)
      if (!project) return
      createZone({ projectId: project.id, title: DEFAULT_ZONE_TITLE, color: DEFAULT_ZONE_COLOR, note: null, ...rect })
        .then((zone) => {
          openZone(zone.id)
          setJustCreatedZone(zone.id)
          void reload()
        })
        .catch((err: unknown) => {
          console.error(err)
          setZoneError(t('vinnubord.zone.createError'))
        })
    },
    [project, openZone, reload, t],
  )
  const closePanel = useCallback(() => {
    select(null)
    setJustCreatedZone(null)
  }, [select])
  const listPrefs = useListPrefs(project?.id ?? '', narrow)
  // Pack columns folded in this browser.
  const folds = useCollapsedPacks(project?.id ?? '')

  const loaded = data !== null && project !== null && data.project.id === project.id
  const viewerId = user?.id ?? ''
  const activeView = useActiveView(project?.id ?? '', loaded ? data.views : NO_VIEWS)
  // One clock per board load: it moves with every reload and realtime change,
  // never between renders of the same data, so the lingering closed cards and
  // every count agree.
  const now = useMemo(() => Date.now(), [data])
  // The items the active view draws. Counters, menus and the board all read
  // these; the panel still finds its item in data.items, hidden or not.
  const visibleItems = useMemo(
    () => (loaded ? itemsInView(data.items, data.modules, data.actions, viewerId, activeView.view, now) : []),
    [loaded, data, viewerId, activeView.view, now],
  )
  const unread = loaded ? data.unread : null
  const unreadByItem = useMemo(() => summarizeUnread(unread ?? []), [unread])
  const search = useMemo(() => (loaded ? searchIndex(data) : new Map<string, string>()), [loaded, data])
  const counts = useMemo(
    () => (loaded ? countsFor(visibleItems, data.actions, viewerId, new Set(unreadByItem.keys())) : null),
    [loaded, data, visibleItems, viewerId, unreadByItem],
  )
  // One model per drawn card, computed once so the board and the list agree.
  const cards = useMemo(
    () =>
      loaded
        ? cardModels(boardOrder(visibleItems), {
            viewerId,
            participants: data.participants,
            actions: data.actions,
            modules: data.modules,
            unread: unreadByItem,
            filter: filterApi.filter,
            comments: data.comments,
            reads: data.reads,
            now,
            search,
          })
        : [],
    [loaded, data, visibleItems, viewerId, unreadByItem, filterApi.filter, search, now],
  )
  const mineByItem = useMemo(
    () => (loaded ? mineActionsByItem(data.actions, viewerId) : new Map<string, number>()),
    [loaded, data, viewerId],
  )
  const list = useMemo(
    () => (loaded ? listRows(cards, data.packages, data.modules, listPrefs.sort) : { rows: [], count: 0 }),
    [loaded, cards, data, listPrefs.sort],
  )
  const tags = useMemo(
    () => (loaded ? tagCounts(visibleItems, filterApi.filter.tags) : []),
    [loaded, visibleItems, filterApi.filter.tags],
  )
  const packages = useMemo(
    () => (loaded ? packageCounts(data.packages, data.modules, visibleItems) : []),
    [loaded, data, visibleItems],
  )
  // The view menu and editor read the whole board, so a view can take in a
  // package or tag the active view hides.
  const allPackages = useMemo(
    () => (loaded ? packageCounts(data.packages, data.modules, data.items) : []),
    [loaded, data],
  )
  const allTags = useMemo(() => (loaded ? tagCounts(data.items, new Set()) : []), [loaded, data])
  const perView = useMemo(
    () => (loaded ? viewCounts(data.views, data.items, data.modules, data.actions, viewerId, now) : new Map<string, number>()),
    [loaded, data, viewerId, now],
  )

  // A package deleted while it is in the filter would keep the board dim with
  // nothing in the Pakki menu to switch off, so unknown ids are dropped.
  const { keepPackages } = filterApi
  const packageList = loaded ? data.packages : null
  useEffect(() => {
    if (packageList) keepPackages(new Set(packageList.map((p) => p.id)))
  }, [packageList, keepPackages])

  const place = useCallback((moduleId: string | null) => boardRef.current?.placeNew(moduleId) ?? null, [])
  const closeNew = useCallback(() => setNewOpen(false), [])
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const { choose: chooseView } = activeView
  const clearView = useCallback(() => chooseView(null), [chooseView])
  const peek = useCallback((id: string | null) => boardRef.current?.peek(id), [])
  // Closing the list also puts out a card a hovered row lit.
  const { setOpen: setListOpen, toggle: toggleListPrefs } = listPrefs
  const hideList = useCallback(() => {
    setListOpen(false)
    boardRef.current?.peek(null)
  }, [setListOpen])
  // The close button and Escape: focus inside the drawer goes back to the top
  // bar list button, so it does not fall to the page when the drawer unmounts.
  const closeList = useCallback(() => {
    focusListButton()
    hideList()
  }, [hideList])
  // The pack of an item through its module, null when unknown.
  const itemsData = loaded ? data.items : null
  const modulesData = loaded ? data.modules : null
  const packOfItem = useCallback(
    (id: string) => {
      const item = itemsData?.find((i) => i.id === id)
      const m = item?.module_id ? modulesData?.find((x) => x.id === item.module_id) : null
      return m?.package_id ?? null
    },
    [itemsData, modulesData],
  )
  // A card of a folded pack has no element to glide to: pick opens its pack
  // and leaves the id here, and the effect below reveals it after the commit
  // that drew the card, so its element and spring exist.
  const pendingReveal = useRef<string | null>(null)
  const { collapsed: foldedPacks, expand: expandPack } = folds
  useEffect(() => {
    const id = pendingReveal.current
    if (id) {
      pendingReveal.current = null
      boardRef.current?.reveal(id)
    }
  }, [foldedPacks])
  // A row or a module panel item: open the panel and glide the board to the card.
  // On a narrow board the list covers the board, so it closes first; focus
  // then belongs with the opening panel and is left alone.
  const pick = useCallback(
    (id: string) => {
      const pack = packOfItem(id)
      if (pack && foldedPacks.has(pack)) {
        expandPack(pack)
        pendingReveal.current = id
      }
      if (narrow) hideList()
      select(id)
      if (pendingReveal.current !== id) boardRef.current?.reveal(id)
    },
    [narrow, hideList, select, packOfItem, foldedPacks, expandPack],
  )
  const toggleList = useCallback(() => {
    if (listPrefs.open) {
      focusListButton()
      boardRef.current?.peek(null)
    }
    toggleListPrefs()
  }, [listPrefs.open, toggleListPrefs])
  // An item or module deleted while its panel is open drops its id, so
  // panelOpen never stays true for a panel that is gone. An item is dropped
  // only once the data has shown it: a new item is selected before the
  // reload brings it (onCreated), and that id must wait for it.
  const itemList = loaded ? data.items : null
  const moduleList = loaded ? data.modules : null
  const zoneList = loaded ? data.zones : null
  const seenSelected = useRef<string | null>(null)
  useEffect(() => {
    if (!itemList || !selectedId) return
    if (itemList.some((i) => i.id === selectedId)) seenSelected.current = selectedId
    else if (seenSelected.current === selectedId) setSelectedId(null)
  }, [itemList, selectedId])
  useEffect(() => {
    if (moduleList && openModuleId && !moduleList.some((m) => m.id === openModuleId)) setOpenModuleId(null)
  }, [moduleList, openModuleId])
  // A box is opened by onDrawn before the reload brings it, so like an item its
  // id is dropped only once the data has shown it.
  const seenZone = useRef<string | null>(null)
  useEffect(() => {
    if (!zoneList || !openZoneId) return
    if (zoneList.some((z) => z.id === openZoneId)) seenZone.current = openZoneId
    else if (seenZone.current === openZoneId) setOpenZoneId(null)
  }, [zoneList, openZoneId])
  // From the ids, not selectedItem: this and the Escape effect sit above the early returns.
  const panelOpen = selectedId !== null || openModuleId !== null || openZoneId !== null
  // Esc closes the list only when nothing above it takes Esc first: a field,
  // the side panel, the new item sheet, the filter sheet or an open dropdown.
  const listIsOpen = listPrefs.open
  useEffect(() => {
    if (!listIsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return
      if (panelOpen || newOpen || filtersOpen || document.querySelector('.hg-menu') !== null) return
      closeList()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listIsOpen, panelOpen, newOpen, filtersOpen, closeList])
  // From the id, not readerOpen, which is defined below the early returns.
  const readerIsOpen = readerFileId !== null
  // Ctrl+F or Cmd+F goes to the board search unless a field has focus or the
  // reader is open, where the browser's own find is the right one (spec 4.1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return
      if (readerIsOpen) return
      const active = document.activeElement
      if (active instanceof HTMLElement && (active.closest('input, textarea, select') || active.isContentEditable)) return
      e.preventDefault()
      setSearchRequest((n) => n + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readerIsOpen])
  const onCreated = useCallback(
    (item: Item) => {
      setNewOpen(false)
      // A new item in a module of a folded pack opens the pack, so its card shows.
      const pack = item.module_id ? modulesData?.find((m) => m.id === item.module_id)?.package_id : null
      if (pack) expandPack(pack)
      select(item.id)
      // Realtime brings the item too; this makes the panel open without waiting for it.
      void reload()
    },
    [select, reload, modulesData, expandPack],
  )

  if (viewerLoading) return <Loader />
  if (viewerError) return <LoadError centered message={t('vinnubord.viewerError')} onRetry={reloadViewer} />
  if (!user || !project) return <NoAccessPage />

  // The full error screen only when there is no board to show. A failed
  // refresh keeps the loaded board and shows a small notice instead.
  if (error && !loaded) {
    return (
      <div className="flex h-full flex-col p-4 sm:p-6">
        <LoadError message={t('vinnubord.board.loadError')} onRetry={() => void reload()} />
      </div>
    )
  }
  if (boardLoading || !loaded || !counts) return <Loader />

  const selectedItem = selectedId ? (data.items.find((i) => i.id === selectedId) ?? null) : null
  // Only a file of the selected item opens the reader; a row that leaves the
  // data closes it.
  const readerFile =
    selectedItem && readerFileId
      ? (data.files.find((f) => f.id === readerFileId && f.item_id === selectedItem.id) ?? null)
      : null
  const readerOpen = readerFile !== null
  // The wide reader panel and the list do not fit side by side, so the list is
  // hidden while a reader is open, without touching the stored list pref.
  const listShown = listPrefs.open && !readerOpen
  // With a reader open the list button closes the reader and shows the list
  // (again if it was open, else opens it): one click either way.
  const toggleListWithReader = () => {
    if (readerOpen) {
      closeReader()
      if (!listPrefs.open) toggleList()
      return
    }
    toggleList()
  }
  const openModuleRow = openModuleId ? (data.modules.find((m) => m.id === openModuleId) ?? null) : null
  const openZoneRow = openZoneId ? (data.zones.find((z) => z.id === openZoneId) ?? null) : null
  const viewerParticipant = data.participants.find((p) => p.user_id === user.id) ?? null
  // The number on the filter button: chosen packages and tags, plus one for an
  // active view. Tones, unread and search show on the pills and in the field.
  const picks = filterApi.filter.packages.size + filterApi.filter.tags.size + (activeView.view ? 1 : 0)
  // One set of view menu props for both places it shows (the top bar and the
  // filter sheet), so the two never drift apart.
  const viewMenuProps = {
    projectId: project.id,
    views: data.views,
    active: activeView.view,
    counts: perView,
    boardCount: data.items.filter((i) => isOnBoard(i, now)).length,
    packages: allPackages,
    tags: allTags,
    filter: filterApi.filter,
    onChoose: activeView.choose,
    onReload: reload,
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <TopBar
        project={project}
        projects={projects}
        counts={counts}
        filter={filterApi}
        tags={tags}
        packages={packages}
        participants={data.participants}
        viewer={{ userId: user.id, participant: viewerParticipant, email: user.email ?? null }}
        live={live}
        viewMenu={<ViewMenu {...viewMenuProps} />}
        filterSheetOpen={filtersOpen}
        onOpenFilters={() => setFiltersOpen(true)}
        picks={picks}
        onNewItem={() => setNewOpen(true)}
        listOpen={listShown}
        onToggleList={toggleListWithReader}
        drawing={drawing}
        onToggleDraw={toggleDraw}
        searchRequest={searchRequest}
      />
      <Board
        key={project.id}
        ref={boardRef}
        data={data}
        items={visibleItems}
        cards={cards}
        view={activeView.view}
        viewerId={user.id}
        filter={filterApi.filter}
        selectedId={selectedId}
        onSelect={select}
        onOpenModule={openModule}
        onOpenZone={openZone}
        drawing={drawing}
        onDrawn={onDrawn}
        onDrawCancel={onDrawCancel}
        collapsedPacks={folds.collapsed}
        onToggleFold={folds.toggle}
        listOpen={listShown && !narrow}
        panelOpen={panelOpen}
        panelWide={readerOpen}
      >
        {listShown && (
          <ListDrawer
            rows={list.rows}
            count={list.count}
            sort={listPrefs.sort}
            selectedId={selectedId}
            mineByItem={mineByItem}
            filterActive={filterApi.active}
            onSort={listPrefs.setSort}
            onPick={pick}
            onPeek={peek}
            onClear={filterApi.clear}
            onClose={closeList}
          />
        )}
        <Toast
          toast={newItemToast.toast}
          panelOpen={panelOpen}
          panelWide={readerOpen}
          onOpen={select}
          onDone={newItemToast.dismiss}
        />
      </Board>
      <PanelShell
        open={selectedItem !== null || openModuleRow !== null || openZoneRow !== null}
        onClose={closePanel}
        wide={readerOpen}
        onEscape={readerOpen ? closeReader : closePanel}
        label={
          openZoneRow
            ? t('vinnubord.zone.panelLabel')
            : openModuleRow
              ? t('vinnubord.panel.moduleLabel')
              : t('vinnubord.panel.label')
        }
      >
        {selectedItem ? (
          <ItemPanel
            key={`item:${selectedItem.id}`}
            data={data}
            item={selectedItem}
            viewerId={user.id}
            readerFile={readerFile}
            onReader={setReaderFileId}
          />
        ) : openModuleRow ? (
          <ModulePanel
            key={`module:${openModuleRow.id}`}
            data={data}
            module={openModuleRow}
            viewerId={user.id}
            onSelectItem={pick}
          />
        ) : openZoneRow ? (
          <ZonePanel
            key={`zone:${openZoneRow.id}`}
            zone={openZoneRow}
            focusTitle={justCreatedZone === openZoneRow.id}
            onDeleted={closePanel}
            onReload={reload}
          />
        ) : null}
      </PanelShell>
      <FilterSheet
        open={filtersOpen}
        onClose={closeFilters}
        picks={picks}
        filter={filterApi}
        tags={tags}
        packages={packages}
        viewMenu={<ViewMenu inline {...viewMenuProps} />}
        onClearView={clearView}
      />
      <NewItemSheet open={newOpen} data={data} tags={data.tags} place={place} onClose={closeNew} onCreated={onCreated} />
      {error && (
        <div className="hg-notice" role="status">
          <span>{t('vinnubord.board.refreshError')}</span>
          <button type="button" onClick={() => void reload()}>
            {t('vinnubord.board.retry')}
          </button>
        </div>
      )}
      {zoneError && (
        <div className="hg-notice" role="status">
          <span>{zoneError}</span>
          <button type="button" onClick={() => setZoneError(null)}>
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  )
}
