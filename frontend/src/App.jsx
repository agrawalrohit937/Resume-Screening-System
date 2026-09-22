import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import React, { Suspense, lazy, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TenantProvider } from './context/TenantContext'

import AppLayout from './components/AppLayout'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import Loader from './components/Loader'
import RoleGuard from './components/RoleGuard'

function applyTheme(theme) {
  const root = document.documentElement
  if (theme) root.dataset.theme = theme
}

function getInitialTheme() {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ThemeInit() {
  useEffect(() => {
    const theme = getInitialTheme()
    applyTheme(theme)
  }, [])
  return null
}

const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const CareerPilotLanding = lazy(() => import('./pages/CareerPilotLanding'))
const Careers = lazy(() => import('./pages/Careers'))
const LinkedinCallback = lazy(() => import('./pages/LinkedinCallback'))
const GitHubCallback = lazy(() => import('./pages/GithubCallback'))
const GmailCallback = lazy(() => import('./pages/GmailCallback'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Results = lazy(() => import('./pages/Results'))
const Interview = lazy(() => import('./pages/Interview'))
const GitHub = lazy(() => import('./pages/GitHub'))
const LiveInterview = lazy(() => import('./pages/LiveInterview'))
const CareerQuest = lazy(() => import('./pages/CareerQuest'))

const RecruiterOverview = lazy(() => import('./pages/recruiter/RecruiterDashboard'))
const ManageCompany = lazy(() => import('./pages/recruiter/ManageCompany'))
const RecruiterSettings = lazy(() => import('./pages/recruiter/RecruiterSettings'))
const Premium = lazy(() => import('./pages/Premium'))
const Billing = lazy(() => import('./pages/Billing'))
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const ApplyAssistant = lazy(() => import('./pages/ApplyAssistant'))
const SupportTickets = lazy(() => import('./pages/SupportTickets'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const PortfolioBuilder = lazy(() => import('./pages/PortfolioBuilder'))
const PublicPortfolio = lazy(() => import('./pages/PublicPortfolio'))
const JobFeed = lazy(() => import('./pages/JobFeed'))
const ApplicationTracker = lazy(() => import('./pages/ApplicationTracker'))
const ManageJobs = lazy(() => import('./pages/recruiter/ManageJobs'))
const JobApplicants = lazy(() => import('./pages/recruiter/JobApplicants'))
const CompanyProfile = lazy(() => import('./pages/CompanyProfile'))

// Enterprise Surface Phase 5 Dashboards
const InterviewerDashboard = lazy(() => import('./pages/enterprise/InterviewerDashboard'))
const HiringManagerDashboard = lazy(() => import('./pages/enterprise/HiringManagerDashboard'))
const ExecDashboard = lazy(() => import('./pages/enterprise/ExecDashboard'))
const TeamManagement = lazy(() => import('./pages/enterprise/TeamManagement'))
const AcceptInvite = lazy(() => import('./pages/enterprise/AcceptInvite'))

// ── Route guards ────────────────────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <Loader />

  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return children

  // Respect the user's active view context when bouncing back from a public page
  const userRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  const savedCtx = localStorage.getItem('careerpilot_view_context')
  const ENTERPRISE = ['admin', 'platform_admin', 'executive', 'exec', 'recruiter', 'hiring_manager', 'interviewer']
  const hasEnterprise = userRoles.some((r) => ENTERPRISE.includes(r))

  const getPath = () => {
    if (savedCtx === 'candidate') return '/dashboard'
    if (hasEnterprise) {
      if (userRoles.includes('admin') || userRoles.includes('platform_admin')) return '/admin'
      if (userRoles.includes('executive') || userRoles.includes('exec')) return '/exec/dashboard'
      if (userRoles.includes('recruiter')) return '/recruiter/dashboard'
      if (userRoles.includes('hiring_manager')) return '/hiring-manager/dashboard'
      if (userRoles.includes('interviewer')) return '/interviewer/dashboard'
    }
    return '/dashboard'
  }

  return <Navigate to={getPath()} replace />
}

function AdminRoute({ children }) {
  const { user, loading, hasRole } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />

  const allowedRoles = ['admin', 'platform_admin']
  const userRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  const isAllowed =
    (typeof hasRole === 'function' && hasRole(allowedRoles)) ||
    userRoles.some((r) => allowedRoles.includes(r))

  if (!isAllowed) {
    const isEmployer = userRoles.some((r) => ['executive', 'exec', 'recruiter', 'hiring_manager'].includes(r))
    return <Navigate to={isEmployer ? '/recruiter/dashboard' : '/dashboard'} replace />
  }
  return children
}

function RecruiterRoute({ children }) {
  const { user, loading, hasRole } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />

  const allowedRoles = ['recruiter', 'admin', 'platform_admin', 'executive', 'exec', 'hiring_manager', 'interviewer']
  const userRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  const isPlatformAdmin = userRoles.some((r) => ['admin', 'platform_admin'].includes(r))
  const hasEnterpriseRole =
    (typeof hasRole === 'function' && hasRole(allowedRoles)) ||
    userRoles.some((r) => allowedRoles.includes(r))
  const hasValidTenant = Boolean(user?.tenant_id && user.tenant_id !== 'default')

  // If user only has candidate role or has no valid tenant, immediately redirect to /dashboard
  if (!hasEnterpriseRole || (!isPlatformAdmin && !hasValidTenant)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function BootLoaderGate({ children }) {
  const { loading } = useAuth()

  if (loading) {
    return <Loader />
  }

  return children
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <ThemeInit />
          <BootLoaderGate>
            <Toaster
            position="top-right"
            containerStyle={{
              top: 84,
              right: 28,
            }}
            gutter={10}
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(255, 255, 255, 0.96)',
                color: '#0F172A',
                border: '1px solid rgba(226, 232, 240, 0.9)',
                borderRadius: '18px',
                fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                fontSize: '13.5px',
                fontWeight: '700',
                letterSpacing: '-0.01em',
                boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
                padding: '12px 18px',
                backdropFilter: 'blur(16px)',
                maxWidth: '420px',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#ECFDF5',
                },
              },
              error: {
                iconTheme: {
                  primary: '#F43F5E',
                  secondary: '#FFF1F2',
                },
              },
              loading: {
                iconTheme: {
                  primary: '#6366F1',
                  secondary: '#EEF2FF',
                },
              },
            }}
          />

          <Suspense fallback={<Loader />}>
            <Routes>
              {/* ── Public Certificate Verification — MUST be first, no auth needed ── */}
              <Route path="/verify/:certificateId" element={<VerifyCertificate />} />

              {/* ── Auth (public) ── */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/linkedin-callback" element={<LinkedinCallback />} />
              <Route path="/github-callback" element={<GitHubCallback />} />
              <Route path="/gmail-callback" element={<GmailCallback />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />


              {/* ── Public Landing, Careers & Portfolios ── */}
              <Route path="/" element={<CareerPilotLanding />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/portfolio/:username" element={<PublicPortfolio />} />
              <Route path="/portfolio/public/:username" element={<PublicPortfolio />} />
              <Route path="/company/:companyName" element={<CompanyProfile />} />

              {/* ── Protected (inside AppLayout shell - PATHLESS ROUTE) ── */}
              <Route element={<ProtectedRoute><RouteErrorBoundary><AppLayout /></RouteErrorBoundary></ProtectedRoute>}>
                {/* Core */}
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="portfolio-builder" element={<PortfolioBuilder />} />

                <Route path="results" element={<Results />} />
                <Route path="billing" element={<Billing />} />
                <Route path="support" element={<SupportTickets />} />
                <Route path="support/:id" element={<TicketDetail />} />
                <Route path="apply-assistant" element={<ApplyAssistant />} />
                <Route path="github" element={<GitHub />} />

                {/* Interview */}
                <Route path="interview" element={<Interview />} />
                <Route path="live-interview" element={<LiveInterview />} />

                {/* Gamification */}
                <Route path="gamification" element={<CareerQuest />} />

                {/* Premium */}
                <Route path="premium" element={<Premium />} />

                {/* Recruiter Dashboard & Job Marketplace */}
                <Route path="recruiter" element={<Navigate to="/recruiter/dashboard" replace />} />
                <Route path="recruiter/dashboard" element={<RecruiterRoute><RecruiterOverview /></RecruiterRoute>} />
                <Route path="recruiter/jobs" element={<RecruiterRoute><ManageJobs /></RecruiterRoute>} />
                <Route path="recruiter/jobs/:jobId/applicants" element={<RecruiterRoute><JobApplicants /></RecruiterRoute>} />
                <Route path="recruiter/company" element={<RecruiterRoute><ManageCompany /></RecruiterRoute>} />
                <Route path="recruiter/settings" element={<RecruiterRoute><RecruiterSettings /></RecruiterRoute>} />
                <Route path="jobs" element={<JobFeed />} />
                <Route path="applications" element={<ApplicationTracker />} />

                {/* Admin Dashboard */}
                <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

                {/* ── Enterprise Phase 5 Portals (RBAC Protected) ── */}
                <Route
                  path="interviewer/dashboard"
                  element={
                    <RoleGuard allowedRoles={['interviewer', 'admin', 'recruiter', 'hiring_manager']} showAccessDeniedCard>
                      <InterviewerDashboard />
                    </RoleGuard>
                  }
                />
                <Route
                  path="hiring-manager/dashboard"
                  element={
                    <RoleGuard allowedRoles={['hiring_manager', 'admin', 'recruiter', 'exec', 'executive']} showAccessDeniedCard>
                      <HiringManagerDashboard />
                    </RoleGuard>
                  }
                />
                <Route
                  path="exec/dashboard"
                  element={
                    <RoleGuard allowedRoles={['exec', 'executive', 'admin', 'platform_admin']} showAccessDeniedCard>
                      <ExecDashboard />
                    </RoleGuard>
                  }
                />
                <Route
                  path="settings/team"
                  element={
                    <RoleGuard allowedRoles={['exec', 'executive', 'admin', 'platform_admin']} showAccessDeniedCard>
                      <TeamManagement />
                    </RoleGuard>
                  }
                />
                <Route
                  path="team"
                  element={
                    <RoleGuard allowedRoles={['exec', 'executive', 'admin', 'platform_admin']} showAccessDeniedCard>
                      <TeamManagement />
                    </RoleGuard>
                  }
                />

                {/* Catch-all — redirects unknown authenticated paths to dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </Suspense>
            </BootLoaderGate>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
  )
}
