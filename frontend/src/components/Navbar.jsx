import { useState, useRef, useEffect, memo, lazy, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  Search,
  Sparkles,
  HelpCircle,
  ChevronDown,
  FileText,
  Video,
  Zap,
  LayoutDashboard,
  Trophy,
  Settings,
  Flame,
  Crown,
  User,
  Globe,
  X,
  Briefcase,
  ArrowLeft
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getGamificationProfile } from '../services/interviewApi'
import AvatarRing from './AvatarRing'
import NotificationBell from './NotificationBell'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'

const ProfilePlanDropdown = lazy(() => import('./ProfilePlanDropdown'))

const SEARCH_ROUTES = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, keywords: ['home', 'analytics'] },
  { name: 'Portfolio Builder & Showcase', path: '/portfolio', icon: Globe, keywords: ['portfolio', 'website', 'developer site', 'showcase', 'projects'] },
  { name: 'Quick Practice (MCQ)', path: '/interview', icon: Zap, keywords: ['practice', 'mcq', 'quiz', 'quick practice'] },
  { name: 'Career Quest', path: '/gamification', icon: Trophy, keywords: ['quest', 'rewards', 'badges'] },
  { name: 'AI Resume Enhancer', path: '/results', icon: Zap, keywords: ['enhance', 'improve'] },
  { name: 'Billing & Premium', path: '/billing', icon: Crown, keywords: ['billing', 'upgrade', 'pro'] },
  { name: 'My Profile & Resume', path: '/profile', icon: User, keywords: ['profile', 'resume', 'bio'] },
  { name: 'Account Settings & Password', path: '/settings', icon: Settings, keywords: ['settings', 'password', 'change password', 'security'] },
]

const RECRUITER_SEARCH_ROUTES = [
  { name: 'Recruiting Overview', path: '/recruiter/dashboard', icon: LayoutDashboard, keywords: ['overview', 'dashboard', 'analytics', 'funnel', 'kpis'] },
  { name: 'Jobs & Applicants Pipeline', path: '/recruiter/jobs', icon: Briefcase, keywords: ['jobs', 'postings', 'applicants', 'pipeline', 'kanban'] },
  { name: 'Marketplace Job Feed', path: '/jobs', icon: Briefcase, keywords: ['market', 'feed', 'jobs', 'browse'] },
  { name: 'Employer Branding Profile', path: '/recruiter/company', icon: Globe, keywords: ['company', 'brand', 'culture', 'logo', 'benefits'] },
  { name: 'Recruiter Settings & Alerts', path: '/recruiter/settings', icon: Settings, keywords: ['settings', 'password', 'alerts', 'notifications'] },
  { name: 'Recruiter Profile', path: '/profile', icon: User, keywords: ['profile', 'user', 'account'] },
  { name: 'Support & Help Desk', path: '/support', icon: Settings, keywords: ['support', 'help', 'tickets'] },
]

function UserAvatar({ user, size = 'sm' }) {
  const [imgError, setImgError] = useState(false)
  const avatarUrl = resolveAvatarUrl(user)
  const initials = getInitials(user?.full_name)
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'

  useEffect(() => {
    setImgError(false)
  }, [avatarUrl])

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={user?.full_name || 'avatar'}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover border-2 border-white shadow-sm`}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-extrabold bg-gradient-to-br from-indigo-500 to-blue-600 border-2 border-white shadow-sm`}>
      {initials}
    </div>
  )
}

// --- Main Navbar Component ---
const Navbar = memo(function Navbar({ onMenuToggle }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [streak, setStreak] = useState(0)
  
  const menuRef = useRef(null)
  const searchContainerRef = useRef(null)
  const searchInputRef = useRef(null)
  const mobileSearchInputRef = useRef(null)

  const userId = user?.id || user?._id || null
  useEffect(() => {
    if (!userId) {
      setStreak(0)
      return
    }
    let isMounted = true
    getGamificationProfile()
      .then(res => {
        if (isMounted && res?.data?.current_streak !== undefined) {
          setStreak(res.data.current_streak)
        }
      })
      .catch(() => {})
    return () => { isMounted = false }
  }, [userId])

  const isRecruiter = user?.role === 'recruiter'
  const activeSearchRoutes = isRecruiter ? RECRUITER_SEARCH_ROUTES : SEARCH_ROUTES

  // Dynamically get current page name for the breadcrumb
  const currentRouteName = (() => {
    if (location.pathname.startsWith('/support/')) return 'Support Ticket Details'
    if (location.pathname === '/support') return 'Support Tickets'
    if (location.pathname.startsWith('/recruiter/jobs/')) return 'Jobs & Applicants Pipeline'
    if (location.pathname.startsWith('/jobs/')) return 'Marketplace Jobs'
    const found = activeSearchRoutes.find(r => r.path === location.pathname)
    if (found) return found.name
    const prefix = activeSearchRoutes.find(r => r.path !== '/' && location.pathname.startsWith(r.path))
    if (prefix) return prefix.name
    return isRecruiter ? 'Recruiting Overview' : 'Dashboard'
  })()

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSelectedIndex(-1)
      return
    }
    const timer = setTimeout(() => {
      const query = searchQuery.toLowerCase()
      const results = activeSearchRoutes.filter(route => 
        route.name.toLowerCase().includes(query) || 
        route.keywords.some(kw => kw.includes(query))
      )
      setSearchResults(results)
      setSelectedIndex(results.length > 0 ? 0 : -1)
    }, 150)
    return () => clearTimeout(timer)
  }, [searchQuery, activeSearchRoutes])

  const handleNavigate = (path) => {
    setIsSearchFocused(false)
    setIsMobileSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setSelectedIndex(-1)
    if (searchInputRef.current) {
      searchInputRef.current.value = ''
      searchInputRef.current.blur()
    }
    if (mobileSearchInputRef.current) {
      mobileSearchInputRef.current.value = ''
      mobileSearchInputRef.current.blur()
    }
    navigate(path)
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev + 1) % searchResults.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (searchResults.length > 0) {
        const target = selectedIndex >= 0 && selectedIndex < searchResults.length 
          ? searchResults[selectedIndex] 
          : searchResults[0]
        handleNavigate(target.path)
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsSearchFocused(false)
      setIsMobileSearchOpen(false)
      setSearchQuery('')
      setSearchResults([])
      setSelectedIndex(-1)
      searchInputRef.current?.blur()
      mobileSearchInputRef.current?.blur()
    }
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false)
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false)
        setSearchQuery('')
        setSearchResults([])
        setSelectedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setIsOpen(false)
    setIsSearchFocused(false)
    setIsMobileSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setSelectedIndex(-1)
  }, [location.pathname, location.key, location.search])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (window.innerWidth < 640) {
          setIsMobileSearchOpen(true)
          setTimeout(() => mobileSearchInputRef.current?.focus(), 50)
        } else {
          searchInputRef.current?.focus()
          setIsSearchFocused(true)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openCopilot = () => window.dispatchEvent(new Event('careershala:open-copilot'))

  const renderSearchResults = (isMobile = false) => {
    if (!searchQuery.trim()) return null;
    return (
      <div
        style={
          isMobile
            ? undefined
            : { width: 'min(560px, calc(100vw - 32px))', minWidth: 'min(460px, calc(100vw - 32px))' }
        }
        className={`bg-white rounded-2xl shadow-[0_25px_60px_rgba(15,23,42,0.22)] border border-slate-200 overflow-hidden z-50 ${
          isMobile
            ? 'w-full mt-2 max-h-[60vh] overflow-y-auto'
            : 'absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2'
        }`}
      >
        {searchResults.length > 0 ? (
          <div className="p-2.5 bg-white">
            <div className="flex items-center justify-between px-3 pt-2 pb-1.5 bg-white border-b border-slate-100 mb-1">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 shrink-0">Jump To</p>
              <span className="text-[10px] font-semibold text-slate-400 shrink-0">↑↓ to navigate • ↵ to select</span>
            </div>
            {searchResults.map((result, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={result.path + idx}
                  type="button"
                  onClick={() => handleNavigate(result.path)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100' 
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors border ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-slate-100 text-slate-600 border-slate-200/60'
                    }`}>
                      <result.icon size={16} strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold truncate">
                      {result.name}
                    </span>
                  </div>
                  <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md border shrink-0 ${
                    isSelected ? 'opacity-100 bg-white text-indigo-700 border-indigo-200 shadow-2xs' : 'opacity-0 text-slate-400 border-transparent'
                  }`}>
                    Select ↵
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-6 sm:p-8 text-center bg-white">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
              <Search className="w-5 h-5 text-slate-400" strokeWidth={3} />
            </div>
            <p className="text-sm font-extrabold text-slate-900">No results found</p>
            <p className="text-xs text-slate-500 mt-1">Try searching for "Portfolio", "ATS", or "Interview"</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="h-[72px] shrink-0 sticky top-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between px-3 sm:px-5 lg:px-6 shadow-xs relative">
      
      {/* Mobile Full Overlay Search Bar */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="sm:hidden absolute inset-0 bg-white z-50 px-3 flex flex-col justify-center border-b border-slate-200 shadow-md"
          >
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
              </button>
              
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2.5} />
                <input
                  ref={mobileSearchInputRef}
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search ATS, interviews..."
                  aria-label="Search mobile"
                  className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs font-semibold text-slate-900 placeholder-slate-400"
                />
                {Boolean(searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Dropdown Positioned Below Header */}
            {Boolean(searchQuery.trim()) && (
              <div className="absolute top-[72px] left-2 right-2 z-50">
                {renderSearchResults(true)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Left: Menu Button & Breadcrumb */}
      <div className="flex items-center shrink-0 gap-2 sm:gap-3">
        <motion.button 
          whileHover={{ scale: 1.05, backgroundColor: 'rgb(226 232 240)' }}
          whileTap={{ scale: 0.95 }}
          onClick={onMenuToggle} 
          aria-label="Toggle navigation menu"
          className="p-2 sm:p-2.5 rounded-2xl bg-white text-slate-600 border border-slate-200 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
        >
          <Menu size={19} strokeWidth={2.5} />
        </motion.button>
        
        {/* Breadcrumb only on ultra-wide desktop monitors (1536px+) so all laptops get full spacious search */}
        <div className="hidden 2xl:flex items-center gap-2 text-sm font-bold text-slate-500 select-none">
          <span className="hover:text-slate-700 transition-colors cursor-pointer" onClick={() => navigate('/')}>Home</span>
          <span>/</span>
          {location.pathname.startsWith('/support/') ? (
            <>
              <span className="hover:text-slate-700 transition-colors cursor-pointer" onClick={() => navigate('/support')}>Support</span>
              <span>/</span>
              <span className="text-slate-800 tracking-tight">Ticket Details</span>
            </>
          ) : (
            <span className="text-slate-800 tracking-tight">{currentRouteName}</span>
          )}
        </div>
      </div>

      {/* 2. Center: Responsive Search Bar (Takes maximum spacious width on all laptops) */}
      <div className="hidden sm:flex flex-1 max-w-2xl mx-3 sm:mx-4 lg:mx-8 relative z-50" ref={searchContainerRef}>
        <div className="relative group w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10 pointer-events-none" strokeWidth={2.5} />
          
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search ATS, Mock Interviews, settings..."
            aria-label="Search ATS, Mock Interviews, or settings"
            className="w-full h-10 sm:h-11 pl-10 pr-14 sm:pr-16 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 focus:border-indigo-400 focus:ring-[3px] focus:ring-indigo-500/10 outline-none text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] group-focus-within:shadow-[0_8px_30px_rgba(99,102,241,0.08)] truncate"
          />
          
          {Boolean(searchQuery) ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
                setSelectedIndex(-1)
                setIsSearchFocused(false)
                if (searchInputRef.current) {
                  searchInputRef.current.value = ''
                  searchInputRef.current.focus()
                }
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer z-20"
              aria-label="Clear search query"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="hidden md:flex items-center absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none select-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs">
                ⌘K
              </kbd>
            </div>
          )}
        </div>

        {/* Search Results Dropdown (Spacious & Responsive) */}
        {Boolean(isSearchFocused && searchQuery.trim()) && renderSearchResults(false)}
      </div>

      {/* 3. Right: Actions & Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        
        {/* Mobile Search Icon Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsMobileSearchOpen(true)
            setTimeout(() => mobileSearchInputRef.current?.focus(), 50)
          }}
          aria-label="Open search"
          className="sm:hidden p-2 rounded-2xl bg-white text-slate-600 border border-slate-200 shadow-sm cursor-pointer"
        >
          <Search size={18} strokeWidth={2.5} />
        </motion.button>

        {/* Gamification Streak Pill (Visible on 2xl only) */}
        {!isRecruiter && user?.role !== 'admin' && (
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 shadow-sm cursor-default" title="Current Daily Practice Streak">
            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center shrink-0">
              <Flame size={12} strokeWidth={3} />
            </div>
            <span className="text-xs font-black text-slate-700">{streak} Day{streak === 1 ? '' : 's'}</span>
          </div>
        )}

        {/* AI Copilot */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCopilot}
          aria-label="Open AI Copilot"
          className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white border border-indigo-500 shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_16px_rgba(79,70,229,0.4)] transition-all cursor-pointer touch-manipulation"
          title="Open AI Copilot"
        >
          <Sparkles size={16} strokeWidth={2.4} className="text-indigo-100 shrink-0 animate-pulse" />
          <span className="hidden 2xl:inline text-xs font-black uppercase tracking-widest">Copilot</span>
        </motion.button>

        {/* Notifications */}
        <NotificationBell />

        {/* Help (Visible on 2xl screens only) */}
        <motion.button 
          whileHover={{ scale: 1.05, backgroundColor: 'white' }}
          whileTap={{ scale: 0.95 }}
          aria-label="Help and documentation"
          className="hidden 2xl:flex p-2.5 rounded-2xl text-slate-600 border border-transparent hover:border-slate-200 hover:shadow-sm transition-all"
        >
          <HelpCircle size={20} strokeWidth={2.5} />
        </motion.button>

        <div className="w-px h-7 bg-slate-200/80 hidden sm:block mx-0.5" />

        {/* User Dropdown */}
        <div className="relative" ref={menuRef}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="User account menu"
            className="flex items-center gap-1.5 sm:gap-2 pl-1.5 pr-2 sm:pr-2.5 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <div className="relative">
              <AvatarRing user={user} ringSize={32} shape="circle">
                <UserAvatar user={user} size="sm" />
              </AvatarRing>
              {(user?.plan === 'premium' || user?.subscription_tier === 'premium') && (
                <div className="sm:hidden absolute -top-2 -right-1 z-20 rotate-[15deg] drop-shadow-md">
                  <Crown size={14} className="text-amber-500 fill-amber-400" />
                </div>
              )}
              {(user?.plan === 'pro' || user?.subscription_tier === 'pro') && (
                <div className="sm:hidden absolute -top-2 -right-1 z-20 rotate-[15deg] drop-shadow-md">
                  <Crown size={14} className="text-slate-400 fill-slate-300" />
                </div>
              )}
            </div>
            <span className="hidden 2xl:flex items-center gap-1 text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight max-w-[85px] sm:max-w-[120px] truncate">
              {user?.full_name?.split(' ')[0] || 'User'}
              {(user?.plan === 'premium' || user?.subscription_tier === 'premium') && (
                <Crown size={13} className="text-amber-500 fill-amber-400 drop-shadow-sm ml-0.5 shrink-0" />
              )}
              {(user?.plan === 'pro' || user?.subscription_tier === 'pro') && (
                <Crown size={13} className="text-slate-400 fill-slate-300 drop-shadow-sm ml-0.5 shrink-0" />
              )}
            </span>
            <ChevronDown size={14} strokeWidth={3} className="text-slate-400 hidden 2xl:block ml-0.5 shrink-0" />
          </motion.button>

          {isOpen && (
            <>
              {/* Backdrop — closes dropdown on outside click */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              {/* Dropdown Card */}
              <div className="absolute right-0 mt-3 rounded-3xl shadow-[0_10px_40px_rgba(30,58,138,0.12)] border border-slate-200/80 bg-white/95 backdrop-blur-xl overflow-hidden z-50 w-[calc(100vw-24px)] sm:w-[340px] max-w-[340px]">
                <Suspense fallback={<div className="p-4 text-center text-xs text-slate-500 font-medium">Loading...</div>}>
                  <ProfilePlanDropdown user={user} onClose={() => setIsOpen(false)} />
                </Suspense>
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  )
})

export default Navbar