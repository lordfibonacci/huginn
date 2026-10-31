import { Navigate } from 'react-router-dom'
import { useViewer } from '../hooks/useViewer'
import { Loader } from '../components/Loader'
import { Shell } from '../components/Shell'
import { NoAccessPage } from './NoAccessPage'

// "/" sends a participant to their first project, a signed in non participant
// to NoAccessPage, and everyone else to /login.
export function HomePage() {
  const { user, projects, loading } = useViewer()

  if (loading) {
    return (
      <Shell>
        <Loader />
      </Shell>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (projects.length > 0) return <Navigate to={`/p/${projects[0].slug}`} replace />
  return (
    <Shell>
      <NoAccessPage />
    </Shell>
  )
}
