import { useState, useRef, useEffect, memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu,
  Search,
  Sparkles,
  ChevronDown,
  Zap,
  LayoutDashboard,
  Trophy,
  Settings,
  Crown,
  User,
  Globe,
  X,
  Briefcase,
  ArrowLeft,
  Target,
  Compass
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AvatarRing from './AvatarRing'
import NotificationBell from './NotificationBell'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'
import ProfilePlanDropdown from './ProfilePlanDropdown'

// Fast spotlight search routes
const SEARCH_ROUTES = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, keywords: ['home', 'analytics', 'overview'] },
  { name: 'Mock Interview (AI MCQ)', path: '/interview', icon: Zap, keywords: ['practice', 'mcq', 'quiz', 'mock interview', 'test'] },
  { name: 'Live AI Interview', path: '/live-interview', icon: Zap, keywords: ['camera', 'live', 'video', 'speech'] },
  { name: 'ATS Matcher & Score', path: '/results', icon: Target, keywords: ['enhance', 'improve', 'ats', 'resume score', 'cv'] },
  { name: 'Job Marketplace', path: '/jobs', icon: Briefcase, keywords: ['jobs', 'apply', 'career', 'internship', 'openings'] },
  { name: 'Application Tracker', path: '/applications', icon: Compass, keywords: ['applications', 'status', 'interviews', 'applied'] },
  { name: 'Portfolio Builder', path: '/portfolio-builder', icon: Globe, keywords: ['portfolio', 'website', 'developer site', 'showcase'] },
  { name: 'Career Quest & Rewards', path: '/gamification', icon: Trophy, keywords: ['quest', 'rewards', 'badges', 'xp', 'streak', 'leaderboard'] },
  { name: 'Billing & Subscriptions', path: '/billing', icon: Crown, keywords: ['billing', 'upgrade', 'pro', 'credits', 'plans'] },
  { name: 'My Profile & CV', path: '/profile', icon: User, keywords: ['profile', 'resume', 'bio', 'account'] },
  { name: 'Account Settings', path: '/settings', icon: Settings, keywords: ['settings', 'password', 'security', 'preferences'] },
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
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'

  useEffect(() => {
    setImgError(false)
  }, [avatarUrl])

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={user?.full_name || 'avatar'}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover border-2 border-white shadow-2xs`}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-extrabold bg-gradient-to-br from-indigo-500 to-blue-600 border-2 border-white shadow-2xs`}>
      {initials}
    </div>
  )
}

const Navbar = memo(function Navbar({ onMenuToggle, sidebarCollapsed }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const menuRef = useRef(null)
  const searchContainerRef = useRef(null)
  const searchInputRef = useRef(null)
  const mobileSearchInputRef = useRef(null)

  const isRecruiter = user?.role === 'recruiter'
  const activeSearchRoutes = isRecruiter ? RECRUITER_SEARCH_ROUTES : SEARCH_ROUTES

  // Clean route display name
  const pageTitle = (() => {
    const p = location.pathname
    if (p === '/dashboard') return 'Dashboard'
    if (p === '/interview') return 'Mock Interview'
    if (p === '/live-interview') return 'Live AI Interview'
    if (p === '/results') return 'ATS Matcher'
    if (p === '/jobs') return 'Explore Jobs'
    if (p === '/applications') return 'My Applications'
    if (p === '/apply-assistant') return 'AI Apply Assistant'
    if (p === '/gamification') return 'Rewards & Quests'
    if (p.startsWith('/portfolio')) return 'Portfolio Generator'
    if (p === '/billing') return 'Billing & Plans'
    if (p === '/profile') return 'My Profile'
    if (p === '/settings') return 'Settings'
    if (p.startsWith('/support')) return 'Support Desk'
    if (p.startsWith('/recruiter/jobs')) return 'Jobs Pipeline'
    if (p === '/recruiter/dashboard') return 'Recruiter Overview'
    const found = activeSearchRoutes.find(r => r.path === p)
    return found ? found.name : 'Overview'
  })()

  // Search logic
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
    }, 120)
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
  }, [location.pathname, location.key])

  // Global Cmd+K / Ctrl+K listener
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
    if (!searchQuery.trim()) return null
    return (
      <div
        style={
          isMobile
            ? undefined
            : { width: 'min(440px, calc(100vw - 32px))' }
        }
        className={`bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.15)] border border-slate-200 overflow-hidden z-50 ${
          isMobile
            ? 'w-full mt-2 max-h-[60vh] overflow-y-auto'
            : 'absolute top-[calc(100%+8px)] left-0'
        }`}
      >
        {searchResults.length > 0 ? (
          <div className="p-2 bg-white">
            <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-slate-100 mb-1">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Quick Navigation</p>
              <span className="text-[10px] font-semibold text-slate-400">↑↓ to navigate • ↵ to select</span>
            </div>
            {searchResults.map((result, idx) => {
              const isSelected = selectedIndex === idx
              return (
                <button
                  key={result.path + idx}
                  type="button"
                  onClick={() => handleNavigate(result.path)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100' 
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 border-slate-200/60'
                    }`}>
                      <result.icon size={15} strokeWidth={2.5} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold truncate">
                      {result.name}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                    isSelected ? 'bg-white text-indigo-700 border-indigo-200' : 'opacity-0'
                  }`}>
                    Jump ↵
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="p-6 text-center bg-white">
            <Search className="w-6 h-6 text-slate-400 mx-auto mb-2" strokeWidth={2.5} />
            <p className="text-xs font-bold text-slate-800">No matching sections found</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Try searching "Interview", "ATS", or "Jobs"</p>
          </div>
        )}
      </div>
    )
  }

  const isPremiumUser = user?.plan === 'premium' || user?.subscription_tier === 'premium'

  return (
    <header className="h-[64px] shrink-0 sticky top-0 z-40 w-full bg-white/95 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between px-3 sm:px-5 lg:px-6 shadow-2xs relative">
      
      {/* Mobile Search Overlay */}
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
                  placeholder="Search ATS, Mock Interviews, jobs..."
                  className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white outline-none text-xs font-semibold text-slate-900 placeholder-slate-400"
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

            {Boolean(searchQuery.trim()) && (
              <div className="absolute top-[64px] left-2 right-2 z-50">
                {renderSearchResults(true)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. LEFT: Toggle Button + Clean Page Title */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 shadow-2xs transition-all cursor-pointer"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={18} strokeWidth={2.2} />
        </button>

        {/* Clean, lightweight breadcrumb (no heavy boxes) */}
        <div className="hidden sm:flex items-center gap-2 text-sm select-none">
          <span className="text-slate-400 font-medium">Workspace</span>
          <span className="text-slate-300">/</span>
          <span className="font-extrabold text-slate-900 tracking-tight">{pageTitle}</span>
        </div>
      </div>

      {/* 2. CENTER: Clean, Balanced Spotlight Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-6 relative z-30" ref={searchContainerRef}>
        <div className="relative group w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 pointer-events-none transition-colors" strokeWidth={2.5} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search ATS, Mock Interview, jobs..."
            aria-label="Quick search"
            className="w-full h-10 pl-10 pr-12 rounded-xl bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 outline-none text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 transition-all shadow-2xs"
          />
          {Boolean(searchQuery) ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
                setIsSearchFocused(false)
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none select-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-extrabold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">⌘K</kbd>
            </div>
          )}
        </div>
        {Boolean(isSearchFocused && searchQuery.trim()) && renderSearchResults(false)}
      </div>

      {/* 3. RIGHT: Clean, Minimalist Suite (Copilot, Notifications, Profile) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        
        {/* Mobile Search Trigger Icon */}
        <button
          type="button"
          onClick={() => {
            setIsMobileSearchOpen(true)
            setTimeout(() => mobileSearchInputRef.current?.focus(), 50)
          }}
          aria-label="Open search"
          className="md:hidden p-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 shadow-2xs cursor-pointer"
        >
          <Search size={16} strokeWidth={2.5} />
        </button>

        {/* AI Copilot Button (Sleek Gradient Pill) */}
        <button
          type="button"
          onClick={openCopilot}
          aria-label="Open AI Copilot"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-xs hover:shadow transition-all cursor-pointer"
          title="Open AI Career Copilot"
        >
          <Sparkles size={14} className="text-indigo-200 animate-pulse" />
          <span className="hidden sm:inline">Copilot</span>
        </button>

        {/* Notifications */}
        <NotificationBell />

        {/* Subtle Divider */}
        <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1" />

        {/* User Profile Chip */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="User account menu"
            className="flex items-center gap-2 p-1 sm:pr-2.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200/80 transition-all cursor-pointer select-none"
          >
            <AvatarRing user={user} ringSize={32} shape="circle">
              <UserAvatar user={user} size="sm" />
            </AvatarRing>
            
            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span className="text-xs font-extrabold text-slate-900 truncate max-w-[100px] flex items-center gap-1">
                {user?.full_name?.split(' ')[0] || 'User'}
                {isPremiumUser && <Crown size={11} className="text-amber-500 fill-amber-400 shrink-0" />}
              </span>
              <span className="text-[10.5px] font-semibold text-slate-400 truncate max-w-[100px] capitalize">
                {user?.role === 'recruiter' ? 'Recruiter' : isPremiumUser ? 'Pro Member' : 'Candidate'}
              </span>
            </div>

            <ChevronDown size={13} className={`text-slate-400 hidden sm:block transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Account Dropdown */}
          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute right-0 mt-2 rounded-2xl shadow-[0_15px_40px_rgba(30,58,138,0.15)] border border-slate-200 bg-white overflow-hidden z-50 w-[calc(100vw-24px)] sm:w-[320px] max-w-[320px] animate-in fade-in zoom-in-95 duration-100">
                <ProfilePlanDropdown user={user} onClose={() => setIsOpen(false)} />
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  )
})

export default Navbar