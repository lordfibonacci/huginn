import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewer } from '../hooks/useViewer'
import { useBoardData } from '../hooks/useBoardData'
import { emptyFilter } from '../lib/filters'
import { Board } from '../components/Board'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { NoAccessPage } from './NoAccessPage'

// The whiteboard of one project, full height. The top bar (Task 5) and the
// side panel (Task 4) are not here yet: selection is kept but shows nothing.
export function BoardPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { user, projects, loading: viewerLoading, error: viewerError, reload: reloadViewer } = useViewer()
  const project = projects.find((p) => p.slug === slug) ?? null
  const { data, loading: boardLoading, error, reload } = useBoardData(project?.id ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filter = useMemo(() => emptyFilter(), [])

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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Board
        key={project.id}
        data={data}
        viewerId={user.id}
        filter={filter}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpenModule={noop}
      />
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

// Module panel arrives in Task 4.
function noop() {}
