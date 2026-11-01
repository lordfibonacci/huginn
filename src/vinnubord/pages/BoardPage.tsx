import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewer } from '../hooks/useViewer'
import { useActiveView } from '../hooks/useActiveView'
import { useBoardData } from '../hooks/useBoardData'
import { useFilter } from '../hooks/useFilter'
import { useNewItemToast } from '../hooks/useNewItemToast'
import { packageCounts, tagCounts } from '../lib/filters'
import { summarizeUnread } from '../lib/reads'
import { countsFor, isOnBoard } from '../lib/status'
import type { Item, View } from '../lib/types'
import { itemsInView, viewCounts } from '../lib/views'
import { Board, type BoardHandle } from '../components/Board'
import { ItemPanel } from '../components/ItemPanel'
import { ModulePanel } from '../components/ModulePanel'
import { NewItemSheet } from '../components/NewItemSheet'
import { PanelShell } from '../components/PanelShell'
import { Toast } from '../components/Toast'
import { TopBar } from '../components/TopBar'
import { ViewMenu } from '../components/ViewMenu'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { NoAccessPage } from './NoAccessPage'

// Stable empty list for useActiveView before the board has loaded, so a stored
// view key is never cleared against a placeholder.
const NO_VIEWS: View[] = []

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
  const [newOpen, setNewOpen] = useState(false)
  const filterApi = useFilter(project?.id ?? '')
  const boardRef = useRef<BoardHandle | null>(null)
  const newItemToast = useNewItemToast(data, user?.id ?? '')

  // An item and a module never share the panel: choosing one clears the other,
  // null (empty board, Esc, sheet dragged shut) clears both.
  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setOpenModuleId(null)
  }, [])
  const openModule = useCallback((id: string) => {
    setOpenModuleId(id)
    setSelectedId(null)
  }, [])
  const closePanel = useCallback(() => select(null), [select])

  const loaded = data !== null && project !== null && data.project.id === project.id
  const viewerId = user?.id ?? ''
  const activeView = useActiveView(project?.id ?? '', loaded ? data.views : NO_VIEWS)
  // The items the active view draws. Counters, menus and the board all read
  // these; the panel still finds its item in data.items, hidden or not.
  const visibleItems = useMemo(
    () => (loaded ? itemsInView(data.items, data.modules, data.actions, viewerId, activeView.view) : []),
    [loaded, data, viewerId, activeView.view],
  )
  const counts = useMemo(
    () => (loaded ? countsFor(visibleItems, data.actions, viewerId, new Set(summarizeUnread(data.unread).keys())) : null),
    [loaded, data, visibleItems, viewerId],
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
    () => (loaded ? viewCounts(data.views, data.items, data.modules, data.actions, viewerId) : new Map<string, number>()),
    [loaded, data, viewerId],
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
  const onCreated = useCallback(
    (item: Item) => {
      setNewOpen(false)
      select(item.id)
      // Realtime brings the item too; this makes the panel open without waiting for it.
      void reload()
    },
    [select, reload],
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
  const openModuleRow = openModuleId ? (data.modules.find((m) => m.id === openModuleId) ?? null) : null
  const viewerParticipant = data.participants.find((p) => p.user_id === user.id) ?? null

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
        viewMenu={
          <ViewMenu
            projectId={project.id}
            views={data.views}
            active={activeView.view}
            counts={perView}
            boardCount={data.items.filter(isOnBoard).length}
            packages={allPackages}
            tags={allTags}
            filter={filterApi.filter}
            onChoose={activeView.choose}
            onReload={reload}
          />
        }
        onNewItem={() => setNewOpen(true)}
      />
      <Board
        key={project.id}
        ref={boardRef}
        data={data}
        items={visibleItems}
        view={activeView.view}
        viewerId={user.id}
        filter={filterApi.filter}
        selectedId={selectedId}
        onSelect={select}
        onOpenModule={openModule}
      >
        <Toast
          toast={newItemToast.toast}
          panelOpen={selectedItem !== null || openModuleRow !== null}
          onOpen={select}
          onDone={newItemToast.dismiss}
        />
      </Board>
      <PanelShell
        open={selectedItem !== null || openModuleRow !== null}
        onClose={closePanel}
        label={openModuleRow ? t('vinnubord.panel.moduleLabel') : t('vinnubord.panel.label')}
      >
        {selectedItem ? (
          <ItemPanel key={`item:${selectedItem.id}`} data={data} item={selectedItem} viewerId={user.id} />
        ) : openModuleRow ? (
          <ModulePanel
            key={`module:${openModuleRow.id}`}
            data={data}
            module={openModuleRow}
            viewerId={user.id}
            onSelectItem={select}
          />
        ) : null}
      </PanelShell>
      <NewItemSheet open={newOpen} data={data} tags={allTags} place={place} onClose={closeNew} onCreated={onCreated} />
      {error && (
        <div className="hg-notice" role="status">
          <span>{t('vinnubord.board.refreshError')}</span>
          <button type="button" onClick={() => void reload()}>
            {t('vinnubord.board.retry')}
          </button>
        </div>
      )}
    </div>
  )
}
