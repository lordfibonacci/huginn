import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewer } from '../hooks/useViewer'
import { useBoardData } from '../hooks/useBoardData'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { ModulesEditor } from '../components/settings/ModulesEditor'
import { PackagesEditor } from '../components/settings/PackagesEditor'
import { ParticipantsEditor } from '../components/settings/ParticipantsEditor'
import { ProjectFields } from '../components/settings/ProjectFields'
import { NoAccessPage } from './NoAccessPage'

// /p/:slug/stillingar: the project fields, packages, modules and participants
// of one project, with a way back to its board. Packages and modules arrive
// by realtime too, participants and the project row only by reload.
export function ProjectSettingsPage() {
  const { t } = useTranslation()
  const { slug } = useParams<{ slug: string }>()
  const { user, projects, loading: viewerLoading, error: viewerError, reload: reloadViewer } = useViewer()
  const project = projects.find((p) => p.slug === slug) ?? null
  const { data, loading, error, reload } = useBoardData(project?.id ?? null)

  const refresh = useCallback(() => void reload(), [reload])
  // A renamed project also shows in the project switcher, which reads the viewer's list.
  const projectSaved = useCallback(() => {
    void reload()
    reloadViewer()
  }, [reload, reloadViewer])

  // A viewer reload after a rename keeps the page, only the first load shows the loader.
  if (viewerLoading && !project) return <Loader />
  if (viewerError) return <LoadError centered message={t('vinnubord.viewerError')} onRetry={reloadViewer} />
  if (!user || !project) return <NoAccessPage />

  const loaded = data !== null && data.project.id === project.id
  if (error && !loaded) return <LoadError centered message={t('vinnubord.settings.loadError')} onRetry={refresh} />
  if (loading || !loaded) return <Loader />

  return (
    <div className="hg-set">
      <header className="hg-set-top">
        <Link className="hg-set-back" to={`/p/${project.slug}`} aria-label={t('vinnubord.settings.back')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          <span>{t('vinnubord.settings.back')}</span>
        </Link>
        <h1 className="hg-set-title">
          {t('vinnubord.settings.title')}
          <span>{data.project.name}</span>
        </h1>
      </header>
      <main className="hg-set-main">
        <ProjectFields project={data.project} onSaved={projectSaved} />
        <PackagesEditor projectId={project.id} packages={data.packages} onChange={refresh} />
        <ModulesEditor projectId={project.id} packages={data.packages} modules={data.modules} onChange={refresh} />
        <ParticipantsEditor
          projectId={project.id}
          participants={data.participants}
          viewerId={user.id}
          onChange={refresh}
        />
      </main>
    </div>
  )
}
