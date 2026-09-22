import { useEffect, useState, memo, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  ScanSearch,
  Video,
  MessagesSquare,
  BarChart3,
  Trophy,
  UserSearch,
  LogOut,
  ChevronLeft,
  Check,
  X,
  Shield,
  UserCircle,
  Ticket,
  Briefcase,
  Users,
  ChevronDown,
  Crown as LucideCrown,
  Settings,
  Building2,
  LayoutGrid,
  CreditCard,
  HelpCircle,
  FolderKanban,
  User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AvatarRing from './AvatarRing'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'

function SidebarAvatar({ user, isPremium, isPro }) {
  const [imgError, setImgError] = useState(false)
  const avatarUrl = resolveAvatarUrl(user)

  useEffect(() => { setImgError(false) }, [avatarUrl])

  const initials = getInitials(user?.full_name)

  const ringStyle = isPremium
    ? 'ring-[#F3C24B]/60 border-[#F3C24B]'
    : isPro
    ? 'ring-slate-300 border-slate-300'
    : 'ring-white border-slate-200'

  const glowStyle = isPremium
    ? 'bg-[#F3C24B]'
    : isPro
    ? 'bg-slate-400'
    : 'bg-[#2E9BDA]'

  return (
    <div className="relative shrink-0 group cursor-pointer">
      <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300 ${glowStyle}`} />
      
      <div className={`relative w-11 h-11 rounded-full overflow-hidden shadow-sm border bg-white ring-2 ${ringStyle}`}>
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={user?.full_name || 'User'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-white font-black text-sm ${
            isPremium
              ? 'bg-gradient-to-br from-[#F3C24B] to-[#B9812A]'
              : isPro
              ? 'bg-gradient-to-br from-slate-500 to-slate-700'
              : 'bg-gradient-to-br from-[#38AEEA] to-[#1d6fa5]'
          }`}>
            {initials}
          </div>
        )}
      </div>
    </div>
  )
}

const ICON_PROPS = { size: 18, strokeWidth: 1.8 }
const Icons = {
  dashboard: <LayoutDashboard {...ICON_PROPS} />,
  ats: <ScanSearch {...ICON_PROPS} />,
  liveInterview: <Video {...ICON_PROPS} />,
  interview: <MessagesSquare {...ICON_PROPS} />,
  gamification: <Trophy {...ICON_PROPS} />,
  recruiter: <UserSearch {...ICON_PROPS} />,
  admin: <Shield {...ICON_PROPS} />,
  settings: <Settings {...ICON_PROPS} />,
  briefcase: <Briefcase {...ICON_PROPS} />,
  building: <Building2 {...ICON_PROPS} />,
  feed: <LayoutGrid {...ICON_PROPS} />,
  profile: <UserCircle {...ICON_PROPS} />,
  billing: <CreditCard {...ICON_PROPS} />,
  support: <HelpCircle {...ICON_PROPS} />,
  pipeline: <FolderKanban {...ICON_PROPS} />,
  check: <Check className="w-3 h-3" strokeWidth={3} />,
  logout: <LogOut className="w-4 h-4" strokeWidth={2.2} />,
}

const Crown = ({ size = 22, variant = 'gold', className = '' }) => {
  const isSilver = variant === 'silver'
  return (
    <LucideCrown
      size={size}
      strokeWidth={2.2}
      className={`${
        isSilver
          ? 'text-slate-300 fill-slate-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
          : 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(243,194,75,0.7)]'
      } ${className}`}
    />
  )
}

const CANDIDATE_NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Icons.dashboard },
    ],
  },
  {
    title: 'Job Search',
    items: [
      { to: '/jobs', label: 'Explore Jobs', badge: 'NEW', icon: Icons.recruiter },
      { to: '/applications', label: 'My Applications', icon: Icons.ats },
      { to: '/apply-assistant', label: 'AI Apply Assistant', icon: Icons.ats },
    ],
  },
  {
    title: 'Resume & Career',
    items: [
      { to: '/results', label: 'ATS Matcher', icon: Icons.ats },
      { to: '/portfolio-builder', label: 'Portfolio Generator', icon: Icons.ats },
    ],
  },
  {
    title: 'Interview Prep',
    items: [
      { to: '/live-interview', label: 'Live Interview', badge: 'NEW', icon: Icons.liveInterview },
      { to: '/interview', label: 'Quick Practice', icon: Icons.interview },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { to: '/gamification', label: 'Badges & Points', badgeIcon: '🏆', icon: Icons.gamification },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/profile', label: 'Profile', icon: Icons.profile },
      { to: '/settings', label: 'Settings', icon: Icons.settings },
      { to: '/billing', label: 'Billing', icon: Icons.billing },
      { to: '/support', label: 'Support', icon: Icons.support },
    ],
  },
]

const ADMIN_NAV_SECTIONS = [
  {
    title: 'Admin Management',
    items: [
      { to: '/admin', label: 'Admin Dashboard', icon: Icons.admin },
      { to: '/recruiter', label: 'Manage Job Postings', icon: Icons.recruiter },
      { to: '/settings/team', label: 'Team Management', badge: 'Invite', icon: Icons.recruiter },
      { to: '/jobs', label: 'Explore Feed', icon: Icons.dashboard },
    ],
  },
  {
    title: 'Account & Settings',
    items: [
      { to: '/profile', label: 'Profile', icon: Icons.profile },
      { to: '/settings', label: 'Settings', icon: Icons.settings },
      { to: '/support', label: 'Support', icon: Icons.support },
    ],
  },
]

const EXEC_PRIMARY_SECTIONS = [
  {
    title: 'Executive Intelligence',
    items: [
      { to: '/exec/dashboard', label: 'Talent & Headcount', icon: Icons.dashboard },
    ],
  },
  {
    title: 'Organization',
    items: [
      { to: '/settings/team', label: 'Team Management', badge: 'Invite', icon: Icons.recruiter },
      { to: '/recruiter/company', label: 'Company Profile', icon: Icons.building },
    ],
  },
  {
    title: 'Pipeline & Jobs',
    items: [
      { to: '/recruiter/dashboard', label: 'Recruiter Dashboard', icon: Icons.dashboard },
      { to: '/recruiter/jobs', label: 'Jobs & Pipelines', badge: 'Active', icon: Icons.briefcase },
    ],
  },
]

const HIRING_MANAGER_PRIMARY_SECTIONS = [
  {
    title: 'Department Hiring',
    items: [
      { to: '/hiring-manager/dashboard', label: 'Requisitions & Pipeline', icon: Icons.briefcase },
      { to: '/recruiter/jobs', label: 'Department Postings', icon: Icons.recruiter },
    ],
  },
  {
    title: 'Organization',
    items: [
      { to: '/recruiter/company', label: 'Company Profile', icon: Icons.building },
    ],
  },
]

const RECRUITER_PRIMARY_SECTIONS = [
  {
    title: 'Pipeline & Jobs',
    items: [
      { to: '/recruiter/dashboard', label: 'Dashboard', icon: Icons.dashboard },
      { to: '/recruiter/jobs', label: 'Jobs & Pipelines', badge: 'Active', icon: Icons.briefcase },
    ],
  },
  {
    title: 'Organization',
    items: [
      { to: '/recruiter/company', label: 'Company Profile', icon: Icons.building },
      { to: '/profile', label: 'Recruiter Profile', icon: Icons.profile },
    ],
  },
]

const INTERVIEWER_PRIMARY_SECTIONS = [
  {
    title: 'Interviews & Evaluations',
    items: [
      { to: '/interviewer/dashboard', label: 'Assigned Scorecards', icon: Icons.interview },
      { to: '/live-interview', label: 'Live Session Mock', icon: Icons.liveInterview },
    ],
  },
  {
    title: 'Organization',
    items: [
      { to: '/recruiter/company', label: 'Company Profile', icon: Icons.building },
    ],
  },
]

const EMPLOYER_ACCOUNT_SECTION = {
  title: 'Management & Support',
  items: [
    { to: '/profile', label: 'Profile', icon: Icons.profile },
    { to: '/recruiter/settings', label: 'Hiring Settings', icon: Icons.settings },
    { to: '/billing', label: 'Billing & Plan', icon: Icons.billing },
    { to: '/support', label: 'Support Tickets', icon: Icons.support },
  ],
}

const VIEW_MODES = [
  { key: 'admin', label: 'Admin', icon: Shield, color: '#6366F1', defaultPath: '/admin' },
  { key: 'candidate', label: 'Candidate', icon: UserCircle, color: '#2E9BDA', defaultPath: '/dashboard' },
  { key: 'recruiter', label: 'Recruiter', icon: UserSearch, color: '#10B981', defaultPath: '/recruiter/dashboard' },
  { key: 'hiring_manager', label: 'Hiring Mgr', icon: Briefcase, color: '#8B5CF6', defaultPath: '/hiring-manager/dashboard' },
  { key: 'interviewer', label: 'Interviewer', icon: Check, color: '#3B82F6', defaultPath: '/interviewer/dashboard' },
  { key: 'exec', label: 'Exec', icon: LucideCrown, color: '#10B981', defaultPath: '/exec/dashboard' },
]

const ROUTE_PREFETCH = {
  '/dashboard': () => import('../pages/Dashboard'),
  '/jobs': () => import('../pages/JobFeed'),
  '/recruiter': () => import('../pages/recruiter/RecruiterDashboard'),
  '/recruiter/dashboard': () => import('../pages/recruiter/RecruiterDashboard'),
  '/recruiter/jobs': () => import('../pages/recruiter/ManageJobs'),
  '/recruiter/company': () => import('../pages/recruiter/ManageCompany'),
  '/recruiter/settings': () => import('../pages/recruiter/RecruiterSettings'),
  '/applications': () => import('../pages/ApplicationTracker'),
  '/profile': () => import('../pages/Profile'),
  '/settings': () => import('../pages/Settings'),
  '/portfolio-builder': () => import('../pages/PortfolioBuilder'),
  '/results': () => import('../pages/Results'),
  '/interview': () => import('../pages/Interview'),
  '/live-interview': () => import('../pages/LiveInterview'),
  '/gamification': () => import('../pages/CareerQuest'),
  '/billing': () => import('../pages/Billing'),
  '/premium': () => import('../pages/Premium'),
  '/apply-assistant': () => import('../pages/ApplyAssistant'),
  '/support': () => import('../pages/SupportTickets'),
  '/admin': () => import('../pages/AdminDashboard'),
}

const prefetchRoute = (path) => {
  if (ROUTE_PREFETCH[path]) {
    ROUTE_PREFETCH[path]().catch(() => {})
  }
}

const Sidebar = memo(function Sidebar({ collapsed, onToggle, mobile = false, onNavigate }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isCompact = !mobile && collapsed

  const [isFullscreenMode, setIsFullscreenMode] = useState(() => {
    if (typeof document === 'undefined') return false
    return !!document.fullscreenElement || document.body?.classList?.contains('immersive-fullscreen')
  })

  useEffect(() => {
    const syncFullscreenState = () => {
      const isImmersive = !!document.fullscreenElement || document.body?.classList?.contains('immersive-fullscreen')
      setIsFullscreenMode(isImmersive)
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)

    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  const isImmersive = isFullscreenMode

  // ⚠️ These hooks MUST be declared before any early return — React requires
  // hooks to always be called in the same order on every render.
  const prevPathRef = useRef(location.pathname)
  useEffect(() => {
    if (mobile && prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname
      onNavigate?.()
    }
  }, [location.pathname, mobile, onNavigate])

  const handleItemClick = (path) => {
    setViewModeOpen(false)
    onNavigate?.()
    if (path && path !== location.pathname) {
      navigate(path)
    }
  }

  const [adminViewMode, setAdminViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'admin'
    return localStorage.getItem('admin_view_mode') || 'admin'
  })
  const [viewModeOpen, setViewModeOpen] = useState(false)
  const viewModeRef = useRef(null)

  useEffect(() => {
    setViewModeOpen(false)
  }, [location.pathname, location.key])

  // Close dropdown on outside click/touch anywhere on the screen (capture phase)
  useEffect(() => {
    if (!viewModeOpen) return
    const handleOutsideClick = (e) => {
      if (viewModeRef.current && !viewModeRef.current.contains(e.target)) {
        setViewModeOpen(false)
      }
    }
    window.addEventListener('click', handleOutsideClick, true)
    window.addEventListener('touchstart', handleOutsideClick, true)
    return () => {
      window.removeEventListener('click', handleOutsideClick, true)
      window.removeEventListener('touchstart', handleOutsideClick, true)
    }
  }, [viewModeOpen])

  const switchViewMode = (mode) => {
    setViewModeOpen(false)
    setAdminViewMode(mode)
    localStorage.setItem('admin_view_mode', mode)
    onNavigate?.()
    const vm = VIEW_MODES.find(v => v.key === mode)
    if (vm && vm.defaultPath && location.pathname !== vm.defaultPath) {
      navigate(vm.defaultPath)
    }
  }

  const userRolesArray = Array.isArray(user?.roles) 
    ? user.roles.map((r) => String(r).toLowerCase().trim()) 
    : []
  const userRoles = [
    ...userRolesArray,
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  // Strict check: candidate toggle is ONLY permitted if 'candidate' is present in DB user.roles
  const hasCandidateRole = userRolesArray.includes('candidate') || (!user?.roles && String(user?.role).toLowerCase().trim() === 'candidate')
  const isPlatformAdmin = userRoles.includes('platform_admin') || userRoles.includes('admin') || user?.role === 'admin'
  const isExecutive = userRoles.includes('executive') || userRoles.includes('exec')
  const isHiringManager = userRoles.includes('hiring_manager')
  const isRecruiterRole = userRoles.includes('recruiter')
  const isInterviewerRole = userRoles.includes('interviewer')
  const isAdmin = user?.role === 'admin' || isPlatformAdmin
  const hasEmployerRole = isExecutive || isRecruiterRole || isHiringManager || isInterviewerRole || isAdmin
  const isEmployerUser = hasEmployerRole
  const isRecruiter = isEmployerUser

  // Only multi-hat users (having BOTH an employer role AND candidate role) can switch views
  const canSwitchContext = hasEmployerRole && hasCandidateRole && !isAdmin

  // Strict View Context: 'employer' vs 'candidate'
  // If user has any employer role, default their view to 'employer'
  const [viewContext, setViewContext] = useState(() => {
    if (typeof window === 'undefined') return 'candidate'
    const saved = localStorage.getItem('careerpilot_view_context')
    if (saved === 'employer' || saved === 'candidate') {
      if (saved === 'employer' && !hasEmployerRole) return 'candidate'
      if (saved === 'candidate' && !hasCandidateRole && hasEmployerRole) return 'employer'
      return saved
    }
    return hasEmployerRole ? 'employer' : 'candidate'
  })

  // Keep viewContext valid if user roles change
  useEffect(() => {
    if (!hasEmployerRole && viewContext === 'employer') {
      setViewContext('candidate')
      localStorage.setItem('careerpilot_view_context', 'candidate')
    } else if (!hasCandidateRole && hasEmployerRole && viewContext === 'candidate') {
      setViewContext('employer')
      localStorage.setItem('careerpilot_view_context', 'employer')
    }
  }, [hasEmployerRole, hasCandidateRole, viewContext])

  const handleSwitchContext = (newContext) => {
    if (newContext === viewContext) return
    if (newContext === 'candidate' && !hasCandidateRole) return
    if (newContext === 'employer' && !hasEmployerRole) return
    setViewContext(newContext)
    localStorage.setItem('careerpilot_view_context', newContext)
    onNavigate?.()

    if (newContext === 'candidate') {
      const employerPrefixes = ['/recruiter', '/exec', '/hiring-manager', '/interviewer', '/settings/team', '/team', '/admin']
      if (employerPrefixes.some(p => location.pathname.startsWith(p))) {
        navigate('/dashboard')
      }
    } else {
      if (isExecutive) navigate('/exec/dashboard')
      else if (isRecruiterRole) navigate('/recruiter/dashboard')
      else if (isHiringManager) navigate('/hiring-manager/dashboard')
      else if (isAdmin) navigate('/admin')
      else if (isInterviewerRole) navigate('/interviewer/dashboard')
      else navigate('/recruiter/dashboard')
    }
  }

  const getActiveDashboardRoute = () => {
    if (viewContext === 'candidate') return '/dashboard'
    if (isExecutive) return '/exec/dashboard'
    if (isRecruiterRole) return '/recruiter/dashboard'
    if (isHiringManager) return '/hiring-manager/dashboard'
    if (isAdmin) return '/admin'
    if (isInterviewerRole) return '/interviewer/dashboard'
    return '/recruiter/dashboard'
  }

  // Compute nav content — strictly isolated by viewContext
  const getNavSections = () => {
    if (!user) return CANDIDATE_NAV_SECTIONS

    // Candidate view: strictly candidate routes only
    if (viewContext === 'candidate' || !hasEmployerRole) {
      return CANDIDATE_NAV_SECTIONS
    }

    const canAccessBillingAndSettings = isExecutive || (isAdmin && (adminViewMode === 'admin' || adminViewMode === 'exec'))

    const accountSection = {
      title: 'Management & Support',
      items: [
        { to: '/profile', label: 'Profile', icon: Icons.profile },
        ...(canAccessBillingAndSettings
          ? [
              { to: '/recruiter/settings', label: 'Hiring Settings', icon: Icons.settings },
              { to: '/billing', label: 'Billing & Plan', icon: Icons.billing },
            ]
          : []),
        { to: '/support', label: 'Support Tickets', icon: Icons.support },
      ],
    }

    // Employer view for Admin:
    if (isAdmin) {
      if (adminViewMode === 'candidate') return CANDIDATE_NAV_SECTIONS
      if (adminViewMode === 'recruiter') return [...RECRUITER_PRIMARY_SECTIONS, accountSection]
      if (adminViewMode === 'hiring_manager') return [...HIRING_MANAGER_PRIMARY_SECTIONS, accountSection]
      if (adminViewMode === 'interviewer') return [...INTERVIEWER_PRIMARY_SECTIONS, accountSection]
      if (adminViewMode === 'exec') return [...EXEC_PRIMARY_SECTIONS, accountSection]
      return ADMIN_NAV_SECTIONS
    }

    // Employer view: strictly employer routes only, deduplicated, single unified Management & Support section
    const combinedSections = []
    const seenPaths = new Set()

    const addSection = (section) => {
      const filteredItems = section.items.filter((item) => {
        if (seenPaths.has(item.to)) return false
        seenPaths.add(item.to)
        return true
      })
      if (filteredItems.length > 0) {
        combinedSections.push({
          ...section,
          items: filteredItems,
        })
      }
    }

    if (isExecutive) {
      EXEC_PRIMARY_SECTIONS.forEach(addSection)
    } else if (isHiringManager) {
      HIRING_MANAGER_PRIMARY_SECTIONS.forEach(addSection)
    } else if (isRecruiterRole) {
      RECRUITER_PRIMARY_SECTIONS.forEach(addSection)
    } else if (isInterviewerRole) {
      INTERVIEWER_PRIMARY_SECTIONS.forEach(addSection)
    }

    // Single unified Management & Support section at the end (no duplicate ACCOUNT headers)
    addSection(accountSection)

    return combinedSections.length > 0 ? combinedSections : CANDIDATE_NAV_SECTIONS
  }

  const visibleSections = getNavSections()
  const currentViewMode = VIEW_MODES.find(v => v.key === adminViewMode) || VIEW_MODES[0]
  const rawPlan = user?.plan || user?.subscription_tier || user?.subscription?.tier || user?.subscription?.plan || user?.tier || ''
  const userPlan = String(rawPlan).toLowerCase()
  const isPremium = userPlan.includes('premium')
  const isPro = userPlan.includes('pro')
  const hasCrown = isPremium || isPro

  if (isImmersive) return null


  return (
    <motion.aside
      initial={mobile ? { x: -24, opacity: 0 } : false}
      animate={mobile ? { x: 0, opacity: 1 } : { width: collapsed ? 72 : 264 }}
      exit={mobile ? { x: -24, opacity: 0 } : undefined}
      transition={mobile ? { type: 'tween', duration: 0.22, ease: [0.16, 1, 0.3, 1] } : { type: 'spring', stiffness: 350, damping: 32 }}
      className={`h-full bg-white border-r border-slate-100 flex flex-col overflow-hidden select-none shrink-0 ${mobile ? 'relative z-50 w-[250px] max-w-[65vw] sm:max-w-[250px] shadow-2xl rounded-r-3xl' : 'relative z-40 shadow-sm'}`}
      role={mobile ? 'dialog' : undefined}
      aria-modal={mobile ? 'true' : undefined}
    >
      <div className={`flex items-center py-4 min-h-[64px] shrink-0 border-b border-slate-100 px-4 sm:px-5 ${isCompact ? 'justify-center' : 'justify-between w-full'}`}>
        <div
          onClick={() => handleItemClick(getActiveDashboardRoute())}
          className="flex items-center gap-2.5 cursor-pointer group"
          role="button"
          tabIndex={0}
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
          
          <AnimatePresence>
            {!isCompact && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p className="font-bold text-slate-900 text-base sm:text-lg tracking-tight leading-none">
                  Career<span className="text-[#2E9BDA]">Shala</span>
                </p>
                <p className="text-[10px] font-semibold text-slate-400 tracking-wide mt-1 leading-none">
                  AI Career Copilot
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {mobile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onNavigate?.()
            }}
            onTouchEnd={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onNavigate?.()
            }}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition active:scale-95 shrink-0 touch-manipulation cursor-pointer"
            aria-label="Close menu drawer"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* ── Admin View Mode Switcher (Always upper side for Admin) ─────── */}
      {isAdmin && (
        <div className={`shrink-0 border-b border-slate-100 relative z-30 ${isCompact ? 'px-2 py-2.5' : 'px-3 py-2.5'}`}>
          {isCompact ? (
            /* Compact: cycle through modes on click */
            <button
              onClick={() => {
                const modes = VIEW_MODES.map(v => v.key)
                const nextIdx = (modes.indexOf(adminViewMode) + 1) % modes.length
                switchViewMode(modes[nextIdx])
              }}
              title={`View: ${currentViewMode.label} (click to switch)`}
              className="w-full flex items-center justify-center"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                style={{ backgroundColor: currentViewMode.color + '15' }}
              >
                <currentViewMode.icon className="w-4 h-4" style={{ color: currentViewMode.color }} />
              </div>
            </button>
          ) : (
            /* Expanded: dropdown selector */
            <div className="relative z-50" ref={viewModeRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setViewModeOpen(p => !p)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all hover:shadow-sm active:scale-[0.98] cursor-pointer touch-manipulation"
                style={{
                  backgroundColor: currentViewMode.color + '08',
                  borderColor: currentViewMode.color + '25',
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: currentViewMode.color + '18' }}
                >
                  <currentViewMode.icon className="w-3.5 h-3.5" style={{ color: currentViewMode.color }} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">View Mode</p>
                  <p className="text-[12px] font-bold truncate mt-0.5 leading-none" style={{ color: currentViewMode.color }}>
                    {currentViewMode.label}
                  </p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${viewModeOpen ? 'rotate-180' : ''}`} />
              </button>

              {viewModeOpen && (
                <>
                  {/* Invisible backdrop inside sidebar container */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewModeOpen(false)
                    }}
                  />
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-1">
                      {VIEW_MODES.map(v => {
                        const active = adminViewMode === v.key
                        return (
                          <button
                            key={v.key}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewModeOpen(false)
                              switchViewMode(v.key)
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer touch-manipulation ${
                              active
                                ? 'font-bold'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                            style={active ? { backgroundColor: v.color + '12', color: v.color } : {}}
                          >
                            <v.icon className="w-4 h-4" style={{ color: v.color }} />
                            <span className="flex-1 text-left">{v.label}</span>
                            {active && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color }} />}
                          </button>
                        )
                      })}
                    </div>
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                      <p className="text-[9.5px] text-slate-400 font-medium leading-snug">
                        Switch view to test different user experiences
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Context Switcher (Candidate vs. Employer) strictly for Multi-Hat Users ─────── */}
      {canSwitchContext && (
        <div className={`shrink-0 border-b border-slate-100 bg-slate-50/60 ${isCompact ? 'p-2' : 'px-3 py-2.5'}`}>
          {isCompact ? (
            <button
              type="button"
              onClick={() => handleSwitchContext(viewContext === 'employer' ? 'candidate' : 'employer')}
              title={viewContext === 'employer' ? 'Current: Employer View (Click to switch to Candidate)' : 'Current: Candidate View (Click to switch to Employer)'}
              className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center transition-all hover:scale-105 shadow-2xs border ${
                viewContext === 'employer'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-blue-500/20'
                  : 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20'
              }`}
            >
              {viewContext === 'employer' ? <Briefcase className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </button>
          ) : (
            <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 shadow-inner border border-slate-200">
              <button
                type="button"
                onClick={() => handleSwitchContext('employer')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  viewContext === 'employer'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                <span className="truncate">Employer</span>
              </button>

              {hasCandidateRole && (
                <button
                  type="button"
                  onClick={() => handleSwitchContext('candidate')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    viewContext === 'candidate'
                      ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <User className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span className="truncate">Candidate</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto overscroll-contain touch-pan-y py-4 px-3 space-y-6 scrollbar-none">
        {visibleSections.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            <AnimatePresence>
              {!isCompact && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-2.5"
                >
                  <span className="h-[3px] w-[3px] rounded-full bg-slate-300" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">
                    {section.title}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-[3px]">
              {section.items.map((item) => {
                const isActive = location.pathname === item.to || (item.to === '/dashboard' && location.pathname === '/')
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      setViewModeOpen(false)
                      onNavigate?.()
                    }}
                    onMouseEnter={() => prefetchRoute(item.to)}
                    onTouchStart={() => prefetchRoute(item.to)}
                    title={isCompact ? item.label : undefined}
                    className={`relative flex items-center justify-between px-3.5 h-11 rounded-xl text-[13px] font-semibold transition-all duration-200 group
                      ${isCompact ? 'justify-center px-0' : ''}
                      ${isActive ? 'text-[#1d6fa5]' : 'text-slate-500 hover:text-slate-900'}
                    `}
                  >
                    {isActive && (
                      <>
                        <div
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-all duration-200"
                          style={{ background: 'linear-gradient(180deg, #38AEEA, #6366F1)' }}
                        />
                        <div
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#2E9BDA]/12 via-[#2E9BDA]/5 to-transparent ring-1 ring-[#2E9BDA]/15 transition-all duration-200"
                        />
                      </>
                    )}
                    {!isActive && (
                      <div className="absolute inset-0 rounded-xl bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    )}

                    <div className="relative z-10 flex items-center gap-3 min-w-0">
                      <span
                        className={`shrink-0 transition-all duration-200 group-hover:translate-x-0.5 ${isActive ? 'text-[#2E9BDA]' : 'text-slate-400 group-hover:text-slate-600'}`}
                      >
                        {item.icon}
                      </span>
                      {!isCompact && (
                        <span className="truncate transition-colors duration-150">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!isCompact && (
                      <div className="relative z-10 flex items-center gap-1 shrink-0">
                        {item.badge && (
                          <span className="bg-[#2E9BDA] text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide shadow-sm shadow-[#2E9BDA]/30">
                            {item.badge}
                          </span>
                        )}
                        {item.badgeIcon && (
                          <span className="text-xs">{item.badgeIcon}</span>
                        )}
                      </div>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}

        {viewContext === 'candidate' && !isAdmin && (
        <div className="pt-2 px-0.5">
          {isCompact ? (
            <div className="flex justify-center">
              {isPremium ? (
                <button
                  title="Premium Active (Manage)"
                  aria-label="Manage Premium subscription"
                  onClick={() => handleItemClick('/billing')}
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-105"
                  style={{
                    background: 'linear-gradient(150deg, #241A10, #100C08)',
                    boxShadow: '0 6px 16px -4px rgba(0,0,0,0.35)',
                  }}
                >
                  <Crown size={16} gradId="goldCollapsedActive" />
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                </button>
              ) : (
                <button
                  title="Upgrade to Pro"
                  aria-label="Upgrade to Pro"
                  onClick={() => handleItemClick('/premium')}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-105"
                  style={{
                    background: 'linear-gradient(150deg, #241A10, #100C08)',
                    boxShadow: '0 6px 16px -4px rgba(0,0,0,0.35)',
                  }}
                >
                  <Crown size={16} gradId="goldCollapsed" />
                </button>
              )}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {isPremium ? (
                <div
                  className="relative overflow-hidden rounded-2xl p-4 ring-1 ring-[#F3C24B]/30"
                  style={{ background: 'linear-gradient(165deg, #211810 0%, #161009 70%, #0E0A06 100%)' }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-80" />
                  <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-[#F3C24B]/25"
                        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(243,194,75,0.22), rgba(243,194,75,0.05))' }}
                      >
                        <Crown size={22} gradId="goldCardIconActive" />
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Active</span>
                      </div>
                    </div>

                    <h4 className="font-bold text-white text-[13.5px] tracking-tight mb-1">
                      CareerShala <span style={{ color: '#F3C24B' }}>Premium</span>
                    </h4>
                    <p className="text-[11px] font-medium text-white/45 leading-relaxed mb-4">
                      You have unlimited access to all AI tools and advanced analytics.
                    </p>

                    <button
                      onClick={() => handleItemClick('/billing')}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11.5px] font-bold text-white/90 transition-all hover:bg-white/10 hover:text-white border border-white/10"
                    >
                      Manage Subscription
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="relative overflow-hidden rounded-2xl p-4 ring-1 ring-black/5"
                  style={{ background: 'linear-gradient(165deg, #211810 0%, #161009 70%, #0E0A06 100%)' }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ background: 'linear-gradient(90deg, transparent, #F3C24B, transparent)' }} />
                  <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[#F3C24B]/20 blur-3xl pointer-events-none" />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-[#F3C24B]/25"
                        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(243,194,75,0.22), rgba(243,194,75,0.05))' }}
                      >
                        <Crown size={22} gradId="goldCardIcon" />
                      </div>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                        style={{ color: '#F3C24B', background: 'rgba(243,194,75,0.12)' }}
                      >
                        Premium
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-[13.5px] tracking-tight mb-1">
                      Go <span style={{ color: '#F3C24B' }}>Premium</span>
                    </h4>
                    <p className="text-[11px] font-medium text-white/45 leading-relaxed mb-3">
                      Real-time AI insights and unlimited usage, on every tool.
                    </p>

                    <ul className="space-y-2.5 mb-4">
                      {['Unlimited ATS scans', 'Advanced interview analytics'].map((feat) => (
                        <li key={feat} className="flex items-center gap-2 text-[10.5px] text-white/70 font-medium">
                          <span
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full shrink-0"
                            style={{ color: '#1A1306', background: '#F3C24B' }}
                          >
                            {Icons.check}
                          </span>
                          {feat}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleItemClick('/premium')}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11.5px] font-bold transition-transform hover:scale-[1.02]"
                      style={{
                        color: '#241A0A',
                        background: 'linear-gradient(135deg, #FFE9B0, #F3C24B 55%, #C99A3B)',
                        boxShadow: '0 8px 18px -6px rgba(243,194,75,0.45)',
                      }}
                    >
                      Upgrade Now
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
        )}
      </nav>

      <div className="border-t border-slate-100 p-3 shrink-0 space-y-2">
        <div 
          onClick={() => {
            if (viewContext === 'employer') {
              if (isExecutive) handleItemClick('/exec/dashboard')
              else if (isRecruiterRole) handleItemClick('/recruiter/dashboard')
              else if (isHiringManager) handleItemClick('/hiring-manager/dashboard')
              else if (isAdmin) handleItemClick('/admin')
              else handleItemClick('/recruiter/dashboard')
            } else {
              handleItemClick('/profile')
            }
          }}
          className={`relative flex items-center gap-2.5 p-1.5 rounded-2xl transition-colors cursor-pointer ${
          isCompact ? 'justify-center' : ''
        } ${isPremium ? 'bg-gradient-to-r from-[#F3C24B]/10 to-transparent hover:from-[#F3C24B]/20' : isPro ? 'bg-slate-100/60 hover:bg-slate-100' : 'hover:bg-slate-50'}`}>
          
          <div className="relative">
            <AvatarRing user={user} ringSize={44} shape="squircle">
              <SidebarAvatar user={user} isPremium={isPremium} isPro={isPro} />
            </AvatarRing>
            
            {hasCrown && (
              <div className="absolute -top-2.5 -right-2 z-20 rotate-[15deg] drop-shadow-md">
                <Crown size={16} gradId="profileCrown" variant={isPremium ? 'gold' : 'silver'} />
              </div>
            )}
          </div>

          <AnimatePresence>
            {!isCompact && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className={`text-[13px] font-bold truncate leading-tight ${isPremium ? 'text-slate-900' : 'text-slate-800'}`}>
                    {user?.full_name || 'User'}
                  </p>
                  {hasCrown && (
                    <div className="shrink-0">
                      <Crown size={14} gradId="profileInlineCrown" variant={isPremium ? 'gold' : 'silver'} />
                    </div>
                  )}
                </div>
                
                {viewContext === 'employer' ? (
                  isAdmin ? (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-extrabold text-slate-800 bg-slate-200/90 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-slate-300 shadow-2xs">
                      ADMINISTRATOR
                    </span>
                  ) : isExecutive ? (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-extrabold text-blue-800 bg-blue-100/90 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-blue-200 shadow-2xs">
                      EXECUTIVE
                    </span>
                  ) : isHiringManager ? (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-extrabold text-purple-800 bg-purple-100/90 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-purple-200 shadow-2xs">
                      HIRING MANAGER
                    </span>
                  ) : isRecruiterRole ? (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-extrabold text-blue-800 bg-blue-100/90 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-blue-200 shadow-2xs">
                      RECRUITER
                    </span>
                  ) : isInterviewerRole ? (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-extrabold text-indigo-800 bg-indigo-100/90 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-indigo-200 shadow-2xs">
                      INTERVIEWER
                    </span>
                  ) : (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-extrabold text-blue-800 bg-blue-100/90 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-blue-200 shadow-2xs">
                      {userRolesArray.find(r => r !== 'candidate')?.replace(/_/g, ' ').toUpperCase() || 'EMPLOYER'}
                    </span>
                  )
                ) : (
                  isPremium ? (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-bold text-[#8A5A14] bg-gradient-to-r from-[#F3C24B]/30 to-[#F3C24B]/10 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-[#F3C24B]/30 shadow-sm">
                      PREMIUM
                    </span>
                  ) : isPro ? (
                    <span className="inline-flex items-center mt-0.5 text-[9px] font-bold text-slate-700 bg-slate-200/80 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-slate-300 shadow-sm">
                      PRO MEMBER
                    </span>
                  ) : (
                    <span className="inline-block mt-0.5 text-[9.5px] font-semibold text-[#1d6fa5] bg-[#2E9BDA]/10 px-1.5 py-[1px] rounded-md uppercase leading-none">
                      CANDIDATE
                    </span>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
          title="Logout"
          aria-label="Log out of account"
          className={`flex items-center gap-2 w-full rounded-xl py-2.5 text-[12px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] transition-all ring-1 ring-rose-100
            ${isCompact ? 'justify-center px-0' : 'justify-center px-3'}`}
        >
          {Icons.logout}
          {!isCompact && <span>Logout</span>}
        </button>
      </div>
      {!mobile && (
        <button onClick={onToggle}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className="absolute -right-3 top-[18px] w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-[#2E9BDA] hover:border-blue-200 transition-all z-10 cursor-pointer">
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-180'}`} strokeWidth={2.5} />
        </button>
      )}
    </motion.aside>
  )
})

export default Sidebar