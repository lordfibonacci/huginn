import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useViewer } from '../hooks/useViewer'
import { Loader } from '../components/Loader'
import { LoadError } from '../components/LoadError'
import { Shell } from '../components/Shell'
import { NoAccessPage } from './NoAccessPage'

// "/" sends a participant to their first project, a signed in non participant
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
  if (projects.length > 0) return <Navigate to={`/p/${projects[0].slug}`} replace />
  return (
    <Shell>
      <NoAccessPage />
    </Shell>
  )
}
