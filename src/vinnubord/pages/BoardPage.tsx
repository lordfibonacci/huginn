import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewer } from '../hooks/useViewer'
import { useBoardData } from '../hooks/useBoardData'
import { emptyFilter } from '../lib/filters'
import { Board } from '../components/Board'
import { ItemPanel } from '../components/ItemPanel'
import { ModulePanel } from '../components/ModulePanel'
import { PanelShell } from '../components/PanelShell'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { NoAccessPage } from './NoAccessPage'

// The whiteboard of one project, full height, with the side panel (bottom
// sheet on narrow screens) for the selected item or the opened module. The
// top bar arrives in Task 5.
export function BoardPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { user, projects, loading: viewerLoading, error: viewerError, reload: reloadViewer } = useViewer()
  const project = projects.find((p) => p.slug === slug) ?? null
  const { data, loading: boardLoading, error, reload } = useBoardData(project?.id ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openModuleId, setOpenModuleId] = useState<string | null>(null)
  const filter = useMemo(() => emptyFilter(), [])

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

  if (viewerLoading) return <Loader />
  if (viewerError) return <LoadError centered message={t('vinnubord.viewerError')} onRetry={reloadViewer} />
  if (!user || !project) return <NoAccessPage />

  const loaded = data !== null && data.project.id === project.id
  // The full error screen only when there is no board to show. A failed
  // refresh keeps the loaded board and shows a small notice instead.
  if (error && !loaded) {
    return (
      <div className="flex h-full flex-col p-4 sm:p-6">
        <LoadError message={t('vinnubord.board.loadError')} onRetry={() => void reload()} />
      </div>
    )
  }
  if (boardLoading || !loaded) return <Loader />

  const selectedItem = selectedId ? (data.items.find((i) => i.id === selectedId) ?? null) : null
  const openModuleRow = openModuleId ? (data.modules.find((m) => m.id === openModuleId) ?? null) : null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Board
        key={project.id}
        data={data}
        viewerId={user.id}
        filter={filter}
        selectedId={selectedId}
        onSelect={select}
        onOpenModule={openModule}
      />
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
