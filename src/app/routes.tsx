import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { Layout } from '../shared/components/Layout'
import { LandingPage } from '../pages/LandingPage'
import { LoginPage } from '../pages/LoginPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { SettingsPage } from '../pages/SettingsPage'
import { InboxPage } from '../pages/InboxPage'
import { TodayPage } from '../pages/TodayPage'
import { CalendarPage } from '../pages/CalendarPage'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-huginn-surface flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (user) {
    // Mobile: inbox is the capture-first landing (the daily hub is one tap
    // away on the bottom nav). Desktop: projects-as-tile-grid is the natural
    // starting view.
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    return <Navigate to={isMobile ? '/inbox' : '/projects'} replace />
  }
  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          }
        />
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
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="today" element={<TodayPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
