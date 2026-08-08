import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useLocation, Navigate, Outlet } from 'react-router-dom'
import { Menu, Crown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import RouteErrorBoundary from './RouteErrorBoundary'
import ProfilePlanDropdown from './ProfilePlanDropdown'
import AvatarRing from './AvatarRing'

const AICopilotWidget = lazy(() => import('./AICopilotWidget'))

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', sub: 'Career intelligence overview' },
  '/upload': { title: 'Resume Library', sub: 'Upload and manage your resumes' },
  '/results': { title: 'ATS Matcher', sub: 'AI Semantic & Keyword scoring' },
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
  const location = useLocation()
  const { pathname } = location
  const { user } = useAuth()
  const meta = PAGE_TITLES[pathname] || { title: 'Overview', sub: '' }
  const userAvatar = user?.profile_picture || user?.display_picture || user?.google_picture
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
      <header className="sticky top-0 z-40 md:hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 min-h-[58px]">
          {/* Left: Hamburger Menu */}
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

          {/* Center: Brand Identity */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-center px-1">
            <img src="/logo_t.png" alt="CareerShala" className="w-7 h-7 object-contain shrink-0" />
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-extrabold text-slate-900 leading-tight">
                Career<span className="text-[#2E9BDA]">Shala</span>
              </p>
              <p className="truncate text-[10.5px] font-semibold text-slate-500 leading-none mt-0.5">
                {meta.title}
              </p>
            </div>
          </div>

          {/* Right: User Avatar */}
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen(p => !p)}
              className="flex items-center justify-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/20 active:scale-95 transition-transform touch-manipulation cursor-pointer"
              aria-label="Open profile menu"
            >
              <div className="relative">
                <AvatarRing user={user} ringSize={40} shape="circle">
                  {userAvatar ? (
                    <img src={userAvatar} alt={user?.full_name || 'User'} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#2E9BDA]/20 shadow-sm" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 text-white text-xs font-bold shadow-sm ring-2 ring-slate-100">
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
        <>
          <div
            onClick={() => setIsProfileOpen(false)}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs"
          />
          <div
            ref={dropdownRef}
            className="fixed top-[64px] right-3 left-3 sm:left-auto sm:w-[340px] max-w-[350px] ml-auto z-[110] shadow-2xl rounded-3xl overflow-hidden"
          >
            <ProfilePlanDropdown
              user={user}
              onClose={() => setIsProfileOpen(false)}
            />
          </div>
        </>
      )}
    </>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
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

      {isMobileMenuOpen && !isFullscreenActive && user?.role !== 'recruiter' && (
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
            <Navbar sidebarCollapsed={collapsed} onMenuToggle={() => setCollapsed(p => !p)} />
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
      {!isFullscreenActive && (
        <Suspense fallback={null}>
          <AICopilotWidget />
        </Suspense>
      )}
    </div>
  )
}