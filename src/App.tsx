import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/app-layout'
import { AmicableSettlementPage } from '@/pages/amicable-settlement-page'
import { BaselineSecurityPage } from '@/pages/baseline-security-page'
import { CertificateToFileActionPage } from '@/pages/certificate-to-file-action-page'
import { ChangePasswordPage } from '@/pages/change-password-page'
import { CivilStatusPage } from '@/pages/civil-status-page'
import { ComplaintTypesPage } from '@/pages/complaint-types-page'
import { ComplainantRecordPage } from '@/pages/complainant-record-page'
import { ComplainantsFormPage } from '@/pages/complainants-form-page'
import { CommunityMembersPage } from '@/pages/community-members-page'
import { HomePage } from '@/pages/home-page'
import { AddLuponMemberPage } from '@/pages/add-lupon-member-page'
import { LuponMembersPage } from '@/pages/lupon-members-page'
import { LoginPage } from '@/pages/login-page'
import { MotionForExecutionPage } from '@/pages/motion-for-execution-page'
import { MyProfilePage } from '@/pages/my-profile-page'
import { AddNoticeOfExecutionPage } from '@/pages/add-notice-of-execution-page'
import { NoticeOfExecutionPage } from '@/pages/notice-of-execution-page'
import { NoticeOfHearingMotionPage } from '@/pages/notice-of-hearing-motion-page'
import { NoticeOfHearingPage } from '@/pages/notice-of-hearing-page'
import { AddRepudiationPage } from '@/pages/add-repudiation-page'
import { RegisterPage } from '@/pages/register-page'
import { PositionsPage } from '@/pages/positions-page'
import { RepudiationPage } from '@/pages/repudiation-page'
import { SummonForRespondentPage } from '@/pages/summon-for-respondent-page'
import { SummonRecordPage } from '@/pages/summon-record-page'
import { SuffixPage } from '@/pages/suffix-page'
import { StaffAccountRecordPage } from '@/pages/staff-account-record-page'
import { AddTechnicalSupportPage } from '@/pages/add-technical-support-page'
import { TechnicalSupportPage } from '@/pages/technical-support-page'
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
          <Route path="/lupon-members" element={<LuponMembersPage />} />
          <Route path="/lupon-members/add" element={<AddLuponMemberPage />} />
          <Route path="/lupon-members/:id/view" element={<StaffAccountRecordPage kind="lupon" mode="view" />} />
          <Route path="/lupon-members/:id/edit" element={<StaffAccountRecordPage kind="lupon" mode="edit" />} />
          <Route path="/technical-support" element={<TechnicalSupportPage />} />
          <Route path="/technical-support/add" element={<AddTechnicalSupportPage />} />
          <Route path="/technical-support/:id/view" element={<StaffAccountRecordPage kind="technical" mode="view" />} />
          <Route path="/technical-support/:id/edit" element={<StaffAccountRecordPage kind="technical" mode="edit" />} />
          <Route path="/community-members" element={<CommunityMembersPage />} />
          <Route path="/community-members/:id/view" element={<StaffAccountRecordPage kind="community" mode="view" />} />
          <Route path="/community-members/:id/edit" element={<StaffAccountRecordPage kind="community" mode="edit" />} />
          <Route path="/complainants-form" element={<ComplainantsFormPage />} />
          <Route path="/complainants-form/add" element={<ComplainantRecordPage mode="add" />} />
          <Route path="/complainants-form/:id/edit" element={<ComplainantRecordPage mode="edit" />} />
          <Route path="/complainants-form/:id/view" element={<ComplainantRecordPage mode="view" />} />
          <Route path="/notice-of-hearing" element={<NoticeOfHearingPage />} />
          <Route path="/summon-for-the-respondent" element={<SummonForRespondentPage />} />
          <Route path="/summon-for-the-respondent/:id/edit" element={<SummonRecordPage mode="edit" />} />
          <Route path="/summon-for-the-respondent/:id/view" element={<SummonRecordPage mode="view" />} />
          <Route path="/amicable-settlement" element={<AmicableSettlementPage />} />
          <Route path="/repudiation" element={<RepudiationPage />} />
          <Route path="/repudiation/add" element={<AddRepudiationPage />} />
          <Route path="/certificate-to-file-action" element={<CertificateToFileActionPage />} />
          <Route path="/motion-for-execution" element={<MotionForExecutionPage />} />
          <Route path="/notice-of-hearing-motion" element={<NoticeOfHearingMotionPage />} />
          <Route path="/notice-of-execution" element={<NoticeOfExecutionPage />} />
          <Route path="/notice-of-execution/add" element={<AddNoticeOfExecutionPage />} />
          <Route path="/user-activity-log" element={<UserActivityLogPage />} />
          <Route path="/baseline-security" element={<BaselineSecurityPage />} />
          <Route path="/my-profile" element={<MyProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/masterfile/suffixes" element={<SuffixPage />} />
          <Route path="/masterfile/civil-status" element={<CivilStatusPage />} />
          <Route path="/masterfile/complaint-types" element={<ComplaintTypesPage />} />
          <Route path="/masterfile/positions" element={<PositionsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
