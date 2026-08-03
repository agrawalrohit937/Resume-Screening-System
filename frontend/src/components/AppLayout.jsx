import { useEffect, useState } from 'react'
import { useLocation, Navigate, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import RouteErrorBoundary from './RouteErrorBoundary'
import AICopilotWidget from './AICopilotWidget'

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', sub: 'Career intelligence overview' },
  '/upload': { title: 'Resume Library', sub: 'Upload and manage your resumes' },
  '/results': { title: 'ATS Matcher', sub: 'Hybrid BERT + TF-IDF scoring' },
  '/analytics': { title: 'Analytics', sub: 'Performance trends & insights' },
  '/interview': { title: 'Quick Practice', sub: 'Fast mock interview sessions' },
  '/live-interview': { title: 'Live AI Interview', sub: 'Full session with camera & AI feedback' },
  '/interview-analytics': { title: 'Interview Analytics', sub: 'Performance breakdown & weak areas' },
  '/github': { title: 'GitHub Analysis', sub: 'Profile & contribution insights' },

  '/fake-detect': { title: 'Authenticity Check', sub: '7-factor experience verification' },
  '/gamification': { title: 'Rewards Hub', sub: 'Points, badges & leaderboard' },
  '/recruiter': { title: 'Shortlist Candidates', sub: 'JD → Top matching resumes' },
}

function MobileHeader({ onMenuToggle }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const meta = PAGE_TITLES[pathname] || { title: 'CareerShala', sub: '' }

  return (
    <header className="sticky top-0 z-40 md:hidden border-b border-slate-200 bg-white/90 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-95 transition"
          aria-label="Open menu"
        >
          <span className="text-lg leading-none">☰</span>
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-slate-900">{meta.title}</p>
          {meta.sub && <p className="truncate text-[11px] font-medium text-slate-500">{meta.sub}</p>}
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white text-xs font-bold">
          {user?.full_name?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return undefined
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isMobileMenuOpen])

  // Redirect recruiter to shortlist page if not already there
  if (user?.role === 'recruiter' && location.pathname !== '/recruiter') {
    return <Navigate to="/recruiter" replace />
  }

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      {user?.role !== 'recruiter' && (
        <div className="hidden md:block">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)} />
        </div>
      )}

      <AnimatePresence>
        {isMobileMenuOpen && user?.role !== 'recruiter' && (
          <motion.div
            key="mobile-drawer-overlay"
            className="fixed inset-0 z-[100] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="Close menu backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              onTouchEnd={(e) => {
                e.preventDefault()
                setIsMobileMenuOpen(false)
              }}
              className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm cursor-pointer transition-opacity"
            />

            <Sidebar
              mobile
              collapsed={false}
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`flex min-w-0 flex-1 flex-col w-full transition-[margin] duration-200 ease-out ${user?.role === 'recruiter' ? 'md:ml-0' : (collapsed ? 'md:ml-[72px]' : 'md:ml-[264px]')}`}
      >
        <MobileHeader onMenuToggle={() => setIsMobileMenuOpen(true)} />
        <div className="hidden md:block">
          <Navbar
            sidebarCollapsed={collapsed}
            onMenuToggle={() => setCollapsed(p => !p)}
          />
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6">
          <div key={location.pathname} className="mx-auto w-full max-w-7xl min-w-0 animate-fade-in">
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </main>
      </div>
      <AICopilotWidget />
    </div>
  )
}