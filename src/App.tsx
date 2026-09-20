import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/app-layout'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { RegisterPage } from '@/pages/register-page'
import { useAuthStore } from '@/stores/auth-store'

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthStore((state) => state.session)

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route
            path="/masterfile/suffixes"
            element={
              <PlaceholderPage
                title="Suffix"
                description="Manage suffix options used in personal information records."
              />
            }
          />
          <Route
            path="/masterfile/civil-status"
            element={
              <PlaceholderPage
                title="Civil Status"
                description="Manage civil status options used in personal information records."
              />
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
