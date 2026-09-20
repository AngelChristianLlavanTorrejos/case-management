import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/app-layout'
import { BaselineSecurityPage } from '@/pages/baseline-security-page'
import { ChangePasswordPage } from '@/pages/change-password-page'
import { CivilStatusPage } from '@/pages/civil-status-page'
import { CommunityMembersPage } from '@/pages/community-members-page'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { MyProfilePage } from '@/pages/my-profile-page'
import { RegisterPage } from '@/pages/register-page'
import { SuffixPage } from '@/pages/suffix-page'
import { UserActivityLogPage } from '@/pages/user-activity-log-page'
import { useAuthStore } from '@/stores/auth-store'

function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthStore((state) => state.session)

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

  return (
    <BrowserRouter basename={basename || undefined}>
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
          <Route path="/community-members" element={<CommunityMembersPage />} />
          <Route path="/user-activity-log" element={<UserActivityLogPage />} />
          <Route path="/baseline-security" element={<BaselineSecurityPage />} />
          <Route path="/my-profile" element={<MyProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/masterfile/suffixes" element={<SuffixPage />} />
          <Route path="/masterfile/civil-status" element={<CivilStatusPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
