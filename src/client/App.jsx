import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';

import CompanyLayout from './layouts/CompanyLayout.jsx';
import CompanyDashboardPage from './pages/company/DashboardPage.jsx';
import CompanyJobsPage from './pages/company/JobsListPage.jsx';
import CompanyJobNewPage from './pages/company/JobNewPage.jsx';
import CompanyJobDetailPage from './pages/company/JobDetailPage.jsx';
import CompanyJobApplicationsPage from './pages/company/JobApplicationsPage.jsx';
import CompanyCandidateDetailPage from './pages/company/CandidateDetailPage.jsx';
import CompanyJobInterviewsPage from './pages/company/JobInterviewsPage.jsx';
import CompanyInterviewDetailPage from './pages/company/InterviewDetailPage.jsx';

import CandidateLayout from './layouts/CandidateLayout.jsx';
import CandidateDashboardPage from './pages/candidate/DashboardPage.jsx';
import CandidateJobsPage from './pages/candidate/JobsListPage.jsx';
import CandidateJobDetailPage from './pages/candidate/JobDetailPage.jsx';
import CandidateApplicationsPage from './pages/candidate/ApplicationsPage.jsx';
import CandidateApplicationDetailPage from './pages/candidate/ApplicationDetailPage.jsx';
import CandidateProfilePage from './pages/candidate/ProfilePage.jsx';
import CandidateInterviewRoomPage from './pages/candidate/InterviewRoomPage.jsx';

// Build plan P1 — Platform Admin + invite links
import SetPasswordPage from './pages/auth/SetPasswordPage.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminCompaniesPage from './pages/admin/CompaniesPage.jsx';
import AdminCompanyNewPage from './pages/admin/CompanyNewPage.jsx';
import AdminCompanyDetailPage from './pages/admin/CompanyDetailPage.jsx';
import AdminUsersPage from './pages/admin/UsersPage.jsx';
// Build plan P2 — recruiters
import CompanyRecruitersPage from './pages/company/RecruitersPage.jsx';
// Build plan P3 — clients
import CompanyClientsPage from './pages/company/ClientsPage.jsx';
import CompanyClientDetailPage from './pages/company/ClientDetailPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/set-password" element={<SetPasswordPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="companies" replace />} />
        <Route path="companies" element={<AdminCompaniesPage />} />
        <Route path="companies/new" element={<AdminCompanyNewPage />} />
        <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
        <Route path="users" element={<AdminUsersPage />} />
      </Route>

      {/* <Route
        path="/company"
        element={
          <ProtectedRoute role="COMPANY">
            <CompanyLayout />
          </ProtectedRoute>
        }
      > */}
      {/* Build plan P2: owners and recruiters share the company area. */}
      <Route
        path="/company"
        element={
          <ProtectedRoute roles={['COMPANY', 'RECRUITER']}>
            <CompanyLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<CompanyDashboardPage />} />
        <Route path="jobs" element={<CompanyJobsPage />} />
        <Route path="jobs/new" element={<CompanyJobNewPage />} />
        <Route path="jobs/:id" element={<CompanyJobDetailPage />} />
        <Route path="jobs/:id/applications" element={<CompanyJobApplicationsPage />} />
        <Route path="jobs/:id/interviews" element={<CompanyJobInterviewsPage />} />
        <Route path="jobs/:id/interviews/:interviewId" element={<CompanyInterviewDetailPage />} />
        <Route path="jobs/:id/candidates/:candidateId" element={<CompanyCandidateDetailPage />} />
        <Route path="recruiters" element={<CompanyRecruitersPage />} />
        <Route path="clients" element={<CompanyClientsPage />} />
        <Route path="clients/:id" element={<CompanyClientDetailPage />} />
      </Route>

      <Route
        path="/candidate"
        element={
          <ProtectedRoute role="CANDIDATE">
            <CandidateLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<CandidateDashboardPage />} />
        <Route path="jobs" element={<CandidateJobsPage />} />
        <Route path="jobs/:id" element={<CandidateJobDetailPage />} />
        <Route path="applications" element={<CandidateApplicationsPage />} />
        <Route path="applications/:id" element={<CandidateApplicationDetailPage />} />
        <Route path="profile" element={<CandidateProfilePage />} />
        <Route path="interviews/:interviewId/room" element={<CandidateInterviewRoomPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
