import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

import AppLayout from './components/AppLayout'
import Loader from './components/Loader'

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

const Login              = lazy(() => import('./pages/Login'))
const Signup             = lazy(() => import('./pages/Signup'))
const CareerPilotLanding = lazy(() => import('./pages/CareerPilotLanding'))
const LinkedinCallback    = lazy(() => import('./pages/LinkedinCallback'))
const GitHubCallback     = lazy(() => import('./pages/GithubCallback'))
const GmailCallback      = lazy(() => import('./pages/GmailCallback'))
const Dashboard          = lazy(() => import('./pages/Dashboard'))
const Results            = lazy(() => import('./pages/Results'))
const Interview          = lazy(() => import('./pages/Interview'))
const GitHub             = lazy(() => import('./pages/GitHub'))
const LiveInterview    = lazy(() => import('./pages/LiveInterview'))
const CareerQuest       = lazy(() => import('./pages/CareerQuest'))
const RecruiterDashboard = lazy(() => import('./pages/RecruiterDashboard'))
const Premium            = lazy(() => import('./pages/Premium'))
const Billing            = lazy(() => import('./pages/Billing'))
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'))
const VerifyEmail        = lazy(() => import('./pages/VerifyEmail'))
const ForgotPassword     = lazy(() => import('./pages/ForgotPassword'))
const Profile            = lazy(() => import('./pages/Profile'))
const ApplyAssistant      = lazy(() => import('./pages/ApplyAssistant'))
const SupportTickets      = lazy(() => import('./pages/SupportTickets'))
const TicketDetail        = lazy(() => import('./pages/TicketDetail'))

// ── Route guards ────────────────────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <Loader />

  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  return user ? <Navigate to="/dashboard" replace /> : children
}

function BootLoaderGate({ children }) {
  const { loading } = useAuth()

  if (loading) return <Loader />
  return children
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <ThemeInit />
      <BootLoaderGate>
        <BrowserRouter>
          <Toaster
            position="top-right"
            gutter={10}
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '14px',
                fontFamily: "'Inter', sans-serif",
                fontSize: '13px',
                fontWeight: '500',
                boxShadow: '0 8px 32px rgba(15,15,20,0.10)',
                padding: '12px 16px',
              },
              success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#F43F5E', secondary: '#fff' } },
            }}
          />

          <Suspense fallback={<Loader />}>
            <Routes>
              {/* ── Public Certificate Verification — MUST be first, no auth needed ── */}
              <Route path="/verify/:certificateId" element={<VerifyCertificate />} />

              {/* ── Auth (public) ── */}
              <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/linkedin-callback" element={<LinkedinCallback />} />
              <Route path="/github-callback" element={<GitHubCallback />} />
              <Route path="/gmail-callback" element={<GmailCallback />} />

              {/* ── Dev-only: Loader test route ── */}
              <Route path="/test-loader" element={<Loader />} />

              {/* ── Public Landing ── */}
              <Route path="/" element={<CareerPilotLanding />} />

              {/* ── Protected (inside AppLayout shell - PATHLESS ROUTE) ── */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                {/* Core */}
                <Route path="dashboard"            element={<Dashboard />} />
                <Route path="profile"              element={<Profile />} />

                <Route path="results"              element={<Results />} />
                <Route path="billing"              element={<Billing />} />
                <Route path="support"              element={<SupportTickets />} />
                <Route path="support/:id"          element={<TicketDetail />} />
                <Route path="apply-assistant"      element={<ApplyAssistant />} />
                <Route path="github"               element={<GitHub />} />
                
                {/* Interview */}
                <Route path="interview"            element={<Interview />} />
                <Route path="live-interview"       element={<LiveInterview />} />

                {/* Gamification */}
                <Route path="gamification"         element={<CareerQuest />} />
                
                {/* Premium */}
                <Route path="premium"              element={<Premium />} />
                
                {/* Recruiter Dashboard */}
                <Route path="recruiter"            element={<RecruiterDashboard />}/>
                
                {/* Catch-all — redirects unknown authenticated paths to dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </BootLoaderGate>
    </AuthProvider>
  )
}