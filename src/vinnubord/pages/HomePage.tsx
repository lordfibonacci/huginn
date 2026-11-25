import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewer } from '../hooks/useViewer'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { Shell } from '../components/Shell'
import { readLastProject, startSlug } from '../lib/lastProject'
import { NoAccessPage } from './NoAccessPage'

// "/" sends a participant to the project this browser opened last (the first
// by name when there is none), a signed in non participant
// to NoAccessPage, and everyone else to /login. A failed membership load
// shows a retry, never NoAccessPage.
export function HomePage() {
  const { t } = useTranslation()
  const { user, projects, loading, error, reload } = useViewer()

  if (loading) {
    return (
      <Shell>
        <Loader />
      </Shell>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (error) {
    return (
      <Shell>
        <LoadError centered message={t('vinnubord.viewerError')} onRetry={reload} />
      </Shell>
    )
  }
  const slug = startSlug(projects, readLastProject())
  if (slug) return <Navigate to={`/p/${slug}`} replace />
  return (
    <Shell>
      <NoAccessPage />
    </Shell>
  )
}
