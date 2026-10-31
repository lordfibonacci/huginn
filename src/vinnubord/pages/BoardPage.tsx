import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewer } from '../hooks/useViewer'
import { useBoardData } from '../hooks/useBoardData'
import { countsFor, type Counts } from '../lib/status'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { NoAccessPage } from './NoAccessPage'

const COUNT_KEYS: (keyof Counts)[] = ['new', 'mine', 'others', 'build', 'parked']

// Plan 1: project name and counters only. The board itself comes in plan 2.
export function BoardPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { user, projects, loading: viewerLoading, error: viewerError, reload: reloadViewer } = useViewer()
  const project = projects.find((p) => p.slug === slug) ?? null
  const { data, loading: boardLoading, error, reload } = useBoardData(project?.id ?? null)

  const counts = useMemo(() => {
    if (!data || !user) return null
    return countsFor(data.items, data.actions, user.id, data.participants)
  }, [data, user])

  if (viewerLoading) return <Loader />
  if (viewerError) return <LoadError centered message={t('vinnubord.viewerError')} onRetry={reloadViewer} />
  if (!user || !project) return <NoAccessPage />

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-huginn-text-primary">{project.name}</h1>

      {error ? (
        <LoadError message={t('vinnubord.board.loadError')} onRetry={() => void reload()} />
      ) : boardLoading || !counts ? (
        <Loader />
      ) : (
        <ul className="mt-6 flex flex-wrap gap-3">
          {COUNT_KEYS.map((key) => (
            <li key={key} className="min-w-[7rem] rounded-xl border border-huginn-border bg-huginn-card px-4 py-3">
              <div className="text-2xl font-semibold tabular-nums text-huginn-text-primary">{counts[key]}</div>
              <div className="text-xs text-huginn-text-secondary">{t(`vinnubord.board.counts.${key}`)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
