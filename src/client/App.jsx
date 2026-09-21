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

import CandidateLayout from './layouts/CandidateLayout.jsx';
import CandidateDashboardPage from './pages/candidate/DashboardPage.jsx';
import CandidateJobsPage from './pages/candidate/JobsListPage.jsx';
import CandidateJobDetailPage from './pages/candidate/JobDetailPage.jsx';
import CandidateApplicationsPage from './pages/candidate/ApplicationsPage.jsx';
import CandidateApplicationDetailPage from './pages/candidate/ApplicationDetailPage.jsx';
import CandidateProfilePage from './pages/candidate/ProfilePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />

      <Route
        path="/company"
        element={
          <ProtectedRoute role="COMPANY">
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
        <Route path="jobs/:id/candidates/:candidateId" element={<CompanyCandidateDetailPage />} />
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
      </Route>

      {/*
        Phase 3 will add an "/interview/:id" route here for the AI voice
        interview flow. Not implemented in Phase 1.
      */}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
