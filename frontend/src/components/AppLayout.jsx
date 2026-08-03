import { useEffect, useState, useRef } from 'react'
import { useLocation, Navigate, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import RouteErrorBoundary from './RouteErrorBoundary'
import AICopilotWidget from './AICopilotWidget'
import ProfilePlanDropdown from './ProfilePlanDropdown'
import AvatarRing from './AvatarRing'

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
  const meta = PAGE_TITLES[pathname] || { title: 'Overview', sub: '' }
  const userAvatar = user?.profile_picture || user?.display_picture || user?.google_picture
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-40 md:hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 min-h-[58px]">
        {/* Left: 48x48px Touch-Optimized Hamburger Menu Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
          className="inline-flex min-h-[48px] min-w-[48px] h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-sm active:scale-95 transition-all shrink-0 touch-manipulation cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5 text-slate-800" strokeWidth={2.2} />
        </button>

        {/* Center: Brand Identity (Logo + CareerShala) & Active Page Subtitle */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-center px-1">
          <img
            src="/logo_t.png"
            alt="CareerShala"
            className="w-7 h-7 object-contain shrink-0"
          />
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-extrabold text-slate-900 leading-tight">
              Career<span className="text-[#2E9BDA]">Shala</span>
            </p>
            <p className="truncate text-[10.5px] font-semibold text-slate-400 leading-none mt-0.5">
              {meta.title}
            </p>
          </div>
        </div>

        {/* Right: User Avatar Dropdown Button */}
        <div className="relative shrink-0" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen(p => !p)}
            className="flex items-center justify-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/20 active:scale-95 transition-transform touch-manipulation cursor-pointer"
            aria-label="Open profile menu"
          >
            <AvatarRing user={user} ringSize={40} shape="circle">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={user?.full_name || 'User'}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-[#2E9BDA]/20 shadow-sm"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 text-white text-xs font-bold shadow-sm ring-2 ring-slate-100">
                  {user?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </AvatarRing>
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <ProfilePlanDropdown
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
              />
            )}
          </AnimatePresence>
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

  const [isFullscreenActive, setIsFullscreenActive] = useState(() => {
    if (typeof document === 'undefined') return false
    return Boolean(document.fullscreenElement || document.body?.classList?.contains('immersive-fullscreen'))
  })

  useEffect(() => {
    const syncFs = () => {
      const active = Boolean(document.fullscreenElement || document.body?.classList?.contains('immersive-fullscreen'))
      setIsFullscreenActive(active)
    }

    syncFs()
    document.addEventListener('fullscreenchange', syncFs)

    const observer = new MutationObserver(syncFs)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    return () => {
      document.removeEventListener('fullscreenchange', syncFs)
      observer.disconnect()
    }
  }, [])

  // Redirect recruiter to shortlist page if not already there
  if (user?.role === 'recruiter' && location.pathname !== '/recruiter') {
    return <Navigate to="/recruiter" replace />
  }

  return (
    <div className={`flex min-h-screen w-full max-w-full overflow-x-hidden ${isFullscreenActive ? 'bg-[#F5F7FB] p-0' : 'bg-slate-50'}`}>
      {!isFullscreenActive && user?.role !== 'recruiter' && (
        <div className="hidden md:block">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)} />
        </div>
      )}

      <AnimatePresence>
        {isMobileMenuOpen && !isFullscreenActive && user?.role !== 'recruiter' && (
          <div className="fixed inset-0 z-[100] md:hidden flex">
            {/* Dark Backdrop Overlay — Tapping anywhere outside the drawer closes it */}
            <motion.div
              key="mobile-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="button"
              tabIndex={0}
              aria-label="Close menu backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              onTouchEnd={(e) => {
                e.preventDefault()
                setIsMobileMenuOpen(false)
              }}
              className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm cursor-pointer"
            />

            {/* Mobile Sidebar Drawer Container */}
            <div className="relative z-10 h-full">
              <Sidebar
                mobile
                collapsed={false}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      <div
        className={`flex min-w-0 flex-1 flex-col w-full transition-[margin] duration-200 ease-out ${
          isFullscreenActive || user?.role === 'recruiter'
            ? 'md:ml-0'
            : (collapsed ? 'md:ml-[72px]' : 'lg:ml-[264px] md:ml-[72px]')
        }`}
      >
        {!isFullscreenActive && <MobileHeader onMenuToggle={() => setIsMobileMenuOpen(true)} />}
        {!isFullscreenActive && (
          <div className="hidden md:block">
            <Navbar
              sidebarCollapsed={collapsed}
              onMenuToggle={() => setCollapsed(p => !p)}
            />
          </div>
        )}
        <main className={`flex-1 min-w-0 ${isFullscreenActive ? 'p-0 overflow-hidden' : 'overflow-y-auto p-4 md:p-6'}`}>
          <div key={location.pathname} className={`mx-auto w-full min-w-0 ${isFullscreenActive ? 'max-w-none' : 'max-w-7xl animate-fade-in'}`}>
            <RouteErrorBoundary>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </main>
      </div>
      {!isFullscreenActive && <AICopilotWidget />}
    </div>
  )
}