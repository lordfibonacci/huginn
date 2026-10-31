import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { ErrorBoundary } from '../shared/components/ErrorBoundary'
import { LoginPage } from '../pages/LoginPage'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { Shell } from '../vinnubord/components/Shell'
import { Loader } from '../vinnubord/components/Loader'
import { HomePage } from '../vinnubord/pages/HomePage'
import { BoardPage } from '../vinnubord/pages/BoardPage'
import { SettingsStubPage } from '../vinnubord/pages/SettingsStubPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Shell>
        <Loader />
      </Shell>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Shell>
        <Loader />
      </Shell>
    )
  }
  // HomePage decides between the first project and NoAccessPage.
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }
          >
            <Route path="p/:slug" element={<BoardPage />} />
            <Route path="p/:slug/stillingar" element={<SettingsStubPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
