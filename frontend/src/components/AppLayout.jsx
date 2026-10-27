import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useLocation, Navigate, Outlet, Link } from 'react-router-dom'
import { Menu, Crown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import MobileBottomNav from './MobileBottomNav'
import RouteErrorBoundary from './RouteErrorBoundary'
import AvatarRing from './AvatarRing'
import { resolveAvatarUrl } from '../utils/avatarUtils'

import ProfilePlanDropdown from './ProfilePlanDropdown'
import { CopilotProvider } from '../features/copilot'
const CopilotSurface = lazy(() => import('../features/copilot/CopilotSurface'))

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', sub: 'Career intelligence overview' },
  '/upload': { title: 'Resume Library', sub: 'Upload and manage your resumes' },
  '/results': { title: 'ATS Matcher', sub: 'AI Semantic & Keyword scoring' },
  '/analytics': { title: 'Analytics', sub: 'Performance trends & insights' },
  '/interview': { title: 'Mock Interview', sub: 'AI mock interview practice & instant feedback' },
  '/live-interview': { title: 'Live AI Interview', sub: 'Full session with camera & AI feedback' },
  '/github': { title: 'GitHub Analysis', sub: 'Profile & contribution insights' },
  '/gamification': { title: 'Rewards Hub', sub: 'Points, badges & leaderboard' },
  '/recruiter': { title: 'Recruiting Overview', sub: 'Executive talent pipeline & metrics' },
  '/recruiter/dashboard': { title: 'Recruiting Overview', sub: 'Executive talent pipeline & metrics' },
  '/recruiter/jobs': { title: 'Jobs & Applicants', sub: 'Active requisitions & applicant pipeline' },
  '/recruiter/company': { title: 'Employer Branding', sub: 'Company identity, culture & public presentation' },
  '/recruiter/settings': { title: 'Recruiter Settings', sub: 'Hiring lead preferences, alerts & security' },
  '/jobs': { title: 'Job Marketplace', sub: 'Explore opportunities with AI vector matching' },
  '/applications': { title: 'Application Tracker', sub: 'Track your hiring stages and match feedback' },
  '/profile': { title: 'Profile & Assets', sub: 'Personal identity, portfolio & resume' },
  '/settings': { title: 'Account Settings', sub: 'Security, privacy & talent pool preferences' },
}

function MobileHeader({ onMenuToggle }) {
  const location = useLocation()
  const { pathname } = location
  const { user } = useAuth()
  const meta = PAGE_TITLES[pathname] || (pathname.includes('/applicants') ? { title: 'Applicant Pipeline', sub: 'Kanban board & candidate review' } : { title: 'Overview', sub: '' })
  const userAvatar = resolveAvatarUrl(user, 100)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const dropdownRef = useRef(null)

  const isPremium = user?.plan === 'premium' || user?.subscription_tier === 'premium'
  const isPro = user?.plan === 'pro' || user?.subscription_tier === 'pro'

  useEffect(() => {
    setIsProfileOpen(false)
  }, [location.pathname, location.key])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <header className="shrink-0 sticky top-0 z-40 md:hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4.5 py-3 min-h-[66px]">
          {/* Left: Brand Identity (Clean, native app feel) */}
          <Link
            to={user?.role === 'recruiter' ? '/recruiter/dashboard' : '/dashboard'}
            className="flex items-center gap-3 min-w-0 select-none group touch-manipulation focus:outline-none"
            aria-label="Go to dashboard"
          >
            <img
              src="/logo_t.webp"
              alt="CareerShala"
              width={36}
              height={36}
              decoding="async"
              loading="eager"
              className="w-9 h-9 object-contain shrink-0 group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 text-left">
              <p className="truncate text-[17px] font-extrabold text-slate-900 tracking-tight leading-tight">
                Career<span className="text-[#2E9BDA]">Shala</span>
              </p>
              <p className="truncate text-[11.5px] font-semibold text-slate-500 leading-none mt-0.5">
                {meta.title}
              </p>
            </div>
          </Link>

          {/* Right: User Avatar */}
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(p => !p)}
              className="flex items-center justify-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/20 active:scale-95 transition-transform touch-manipulation cursor-pointer"
              aria-label="Open profile menu"
            >
              <div className="relative">
                <AvatarRing user={user} ringSize={44} shape="circle">
                  {userAvatar ? (
                    <img src={userAvatar} alt={user?.full_name || 'User'} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover ring-2 ring-[#2E9BDA]/20 shadow-sm" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 text-white text-xs font-bold shadow-sm ring-2 ring-slate-100">
                      {user?.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </AvatarRing>
                {isPremium && (
                  <div className="absolute -top-2 -right-1 z-20 rotate-[15deg] drop-shadow-md">
                    <Crown size={15} className="text-amber-500 fill-amber-400" />
                  </div>
                )}
                {isPro && (
                  <div className="absolute -top-2 -right-1 z-20 rotate-[15deg] drop-shadow-md">
                    <Crown size={15} className="text-slate-400 fill-slate-300" />
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      {isProfileOpen && (
        <div className="md:hidden">
          <div
            onClick={() => setIsProfileOpen(false)}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs"
          />
          <div
            ref={dropdownRef}
            className="fixed top-[72px] right-3 left-3 sm:left-auto sm:w-[340px] max-w-[350px] ml-auto z-[110] shadow-2xl rounded-3xl overflow-hidden"
          >
            <ProfilePlanDropdown
              user={user}
              onClose={() => setIsProfileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname, location.key])

  useEffect(() => {
    const roles = [
      ...(Array.isArray(user?.roles) ? user.roles : []),
      user?.role,
    ].map((role) => String(role || '').toLowerCase())
    const isRecruiter = roles.some((role) => ['recruiter', 'admin', 'platform_admin', 'executive', 'exec', 'hiring_manager'].includes(role))
    if (!isRecruiter) return

    import('../pages/recruiter/RecruiterDashboard').catch(() => {})
  }, [user])

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
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

  return (
    <CopilotProvider>
      <div className={`flex h-screen w-full overflow-hidden ${isFullscreenActive ? 'bg-[#F5F7FB] p-0' : 'bg-slate-50'}`}>
        {!isFullscreenActive && (
          <div className="hidden md:block h-full shrink-0">
            <Sidebar collapsed={false} />
          </div>
        )}

        {isMobileMenuOpen && !isFullscreenActive && (
          <div
            className="fixed inset-0 z-[100] md:hidden flex"
            style={{ pointerEvents: 'auto' }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="Close menu backdrop"
              onClick={(e) => {
                e.stopPropagation()
                closeMobileMenu()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeMobileMenu()
              }}
              className="absolute inset-0 h-full w-full bg-black/60 sm:backdrop-blur-xs cursor-pointer"
            />

            <div
              className="relative z-10 h-full overflow-hidden"
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar
                mobile
                collapsed={false}
                onNavigate={closeMobileMenu}
              />
            </div>
          </div>
        )}

        {/* Right Side (Navbar + Page Content) */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {!isFullscreenActive && <MobileHeader onMenuToggle={() => setIsMobileMenuOpen(true)} />}
          {!isFullscreenActive && (
            <div className="hidden md:block shrink-0">
              <Navbar />
            </div>
          )}
          <main className={`flex-1 min-w-0 overflow-x-hidden ${isFullscreenActive
              ? 'p-0 overflow-hidden'
              : (location.pathname === '/results' || location.pathname === '/live-interview' || location.pathname === '/github')
                ? 'overflow-y-auto overscroll-y-contain custom-scrollbar px-3 sm:px-4 lg:px-6 py-3 pb-20 md:pb-6'
                : 'overflow-y-auto overscroll-y-contain custom-scrollbar px-3 sm:px-5 md:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6'
            }`}>
            <div key={location.pathname} className={`mx-auto w-full min-w-0 ${
              isFullscreenActive || location.pathname === '/live-interview' || location.pathname === '/github'
                ? 'max-w-none'
                : location.pathname === '/results'
                  ? 'max-w-[1600px]'
                  : 'max-w-7xl'
            } animate-fade-in`}>
              <RouteErrorBoundary>
                <Outlet />
              </RouteErrorBoundary>
            </div>
          </main>
          {!isFullscreenActive && <MobileBottomNav onMenuToggle={() => setIsMobileMenuOpen(true)} />}
        </div>
        {!isFullscreenActive && (
          <Suspense fallback={null}>
            <CopilotSurface />
          </Suspense>
        )}
      </div>
    </CopilotProvider>
  )
}