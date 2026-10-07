import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';

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
import CandidateApplicationsPage from './pages/candidate/ApplicationsPage.jsx';
import CandidateApplicationDetailPage from './pages/candidate/ApplicationDetailPage.jsx';
import CandidateProfilePage from './pages/candidate/ProfilePage.jsx';
import CandidateInterviewRoomPage from './pages/candidate/InterviewRoomPage.jsx';

// Build plan P1 — Platform Admin + invite links
import SetPasswordPage from './pages/auth/SetPasswordPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
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
// Build plan P4 — careers portal + CV pool. The public careers entry pages
// (CareersPage/CareersJobPage/CareersSubmitCvPage) are retired in P9 and now
// redirect to /recq; only the status-link page stays routed.
import CareersTrackPage from './pages/careers/CareersTrackPage.jsx';
import CompanyCvPoolPage from './pages/company/CvPoolPage.jsx';
// Build plan P5
import InterviewLinkPage from './pages/careers/InterviewLinkPage.jsx';
// Build plan P7
import SubmissionViewPage from './pages/careers/SubmissionViewPage.jsx';
// Build plan P8
import ClientPortalLayout from './layouts/ClientPortalLayout.jsx';
import ClientCandidatesPage from './pages/client/ClientCandidatesPage.jsx';
import ClientCandidateDetailPage from './pages/client/ClientCandidateDetailPage.jsx';
// "Start here" demo page
import StartHerePage from './pages/StartHerePage.jsx';
// Build plan P9 — /recq agency-link candidate flow (replaces the public
// careers entry; old /careers/* links redirect here).
import RecqAgencyPage from './pages/recq/RecqAgencyPage.jsx';
import RecqJobPage from './pages/recq/RecqJobPage.jsx';

// Redirects an old /careers/:slug (and sub-paths) to the new /recq/:slug.
function CareersToRecq() {
  const { slug } = useParams();
  return <Navigate to={`/recq/${slug}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      {/* "Start here" demo page — every role, demo login and public link */}
      {/* <Route path="/start" element={<StartHerePage />} /> */}
      <Route path="/live-demo" element={<StartHerePage />} />
      <Route path="/start" element={<Navigate to="/live-demo" replace />} />
      {/* No sign-up: agencies are added by the Portal Admin, candidates use /recq links. */}
      <Route path="/auth/register" element={<Navigate to="/auth/login" replace />} />
      <Route path="/auth/set-password" element={<SetPasswordPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

      {/* Build plan P9 — /recq agency-link candidate flow (public, no login) */}
      <Route path="/recq/:slug" element={<RecqAgencyPage />} />
      <Route path="/recq/:slug/:jobSlug" element={<RecqJobPage />} />

      {/* Build plan P4 — public careers portal. Retired in P9: the entry pages
          redirect to /recq. The status link (/careers/track) stays alive so
          existing candidate emails keep working. */}
      <Route path="/careers/track" element={<CareersTrackPage />} />
      <Route path="/careers/:slug" element={<CareersToRecq />} />
      <Route path="/careers/:slug/jobs/:jobId" element={<CareersToRecq />} />
      <Route path="/careers/:slug/submit-cv" element={<CareersToRecq />} />
      {/* Build plan P5 — instant interview link (no login; the link is the key) */}
      <Route path="/interview/:token" element={<InterviewLinkPage />} />
      {/* Build plan P7 — read-only candidate package for client HR */}
      <Route path="/submission/:token" element={<SubmissionViewPage />} />

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
        <Route path="cv-pool" element={<CompanyCvPoolPage />} />
      </Route>

      {/* Build plan P8 — client HR portal */}
      <Route
        path="/client"
        element={
          <ProtectedRoute role="CLIENT_HR">
            <ClientPortalLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="candidates" replace />} />
        <Route path="candidates" element={<ClientCandidatesPage />} />
        <Route path="candidates/:id" element={<ClientCandidateDetailPage />} />
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
        <Route path="jobs" element={<Navigate to="/candidate/applications" replace />} />
        <Route path="jobs/:id" element={<Navigate to="/candidate/applications" replace />} />
        <Route path="applications" element={<CandidateApplicationsPage />} />
        <Route path="applications/:id" element={<CandidateApplicationDetailPage />} />
        <Route path="profile" element={<CandidateProfilePage />} />
        <Route path="interviews/:interviewId/room" element={<CandidateInterviewRoomPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
