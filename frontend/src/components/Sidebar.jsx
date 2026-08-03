import { useEffect, useState, memo } from 'react'
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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AvatarRing from './AvatarRing'

// Generate 1-2 letter initials from a full name: "Ansh Gupta" → "AG"
function getInitials(fullName) {
  if (!fullName) return 'U'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0].toUpperCase()
}

// Resolve the best avatar URL (custom FTP upload > google_picture > null)
function resolveAvatarUrl(user) {
  if (!user) return null
  if (user.profile_picture && user.profile_picture.startsWith('http')) return user.profile_picture
  if (user.display_picture && user.display_picture.startsWith('http')) return user.display_picture
  if (user.google_picture && user.google_picture.startsWith('http')) return user.google_picture
  return null
}

function SidebarAvatar({ user, isPremium }) {
  const [imgError, setImgError] = useState(false)
  const avatarUrl = resolveAvatarUrl(user)

  useEffect(() => { setImgError(false) }, [avatarUrl])

  const initials = getInitials(user?.full_name)

  return (
    <div className="relative shrink-0 group cursor-pointer">
      <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300 ${isPremium ? 'bg-[#F3C24B]' : 'bg-[#2E9BDA]'}`} />
      
      <div className={`relative w-11 h-11 rounded-full overflow-hidden shadow-sm border bg-white ring-2 ${
        isPremium ? 'ring-[#F3C24B]/60 border-[#F3C24B]' : 'ring-white border-slate-200'
      }`}>
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={user?.full_name || 'User'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-white font-black text-sm ${
            isPremium ? 'bg-gradient-to-br from-[#F3C24B] to-[#B9812A]' : 'bg-gradient-to-br from-[#38AEEA] to-[#1d6fa5]'
          }`}>
            {initials}
          </div>
        )}
      </div>

      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[2.5px] border-white shadow-sm flex items-center justify-center z-10">
         <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
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
  check: <Check className="w-3 h-3" strokeWidth={3} />,
  logout: <LogOut className="w-4 h-4" strokeWidth={2.2} />,
}

const Crown = ({ size = 22, gradId }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF3C8" />
        <stop offset="45%" stopColor="#F3C24B" />
        <stop offset="100%" stopColor="#B9812A" />
      </linearGradient>
    </defs>
    <path d="M4.2 17.2h15.6v2a1 1 0 01-1 1H5.2a1 1 0 01-1-1v-2z" fill={`url(#${gradId})`} />
    <path
      d="M3.1 16.4 1.9 8.7a.62.62 0 01.98-.58l3.66 2.86 4.4-5.5a1.14 1.14 0 011.78 0l4.4 5.5 3.66-2.86a.62.62 0 01.98.58l-1.2 7.7a1 1 0 01-1 .84H4.1a1 1 0 01-1-.84z"
      fill={`url(#${gradId})`}
    />
    <circle cx="6.6" cy="10.4" r="1" fill="#FFFAE6" />
    <circle cx="12" cy="6.7" r="1.25" fill="#FFFAE6" />
    <circle cx="17.4" cy="10.4" r="1" fill="#FFFAE6" />
    <rect x="10.7" y="17.55" width="2.6" height="2.6" rx="0.4" fill="#8A5A14" transform="rotate(45 12 18.85)" />
  </svg>
)

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Icons.dashboard },
      { to: '/profile', label: 'Profile', icon: Icons.dashboard },
      { to: '/apply-assistant', label: 'AI Apply Assistant', icon: Icons.ats },
    ],
  },
  {
    title: 'Resume Tools',
    items: [
      { to: '/results', label: 'ATS Matcher', icon: Icons.ats },
    ],
  },
  {
    title: 'AI Interview',
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
      { to: '/billing', label: 'Billing', icon: Icons.dashboard },
      { to: '/premium', label: 'Premium', icon: Icons.dashboard },
      { to: '/support', label: 'Support', icon: Icons.dashboard },
    ],
  },
]

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

  if (isImmersive) return null

  const getNavSections = () => {
    if (!user) return NAV_SECTIONS
    if (user.role === 'recruiter') {
      return [
        {
          title: 'Recruiter',
          items: [
            { to: '/recruiter', label: 'Shortlist Candidates', icon: Icons.recruiter },
          ],
        },
      ]
    }
    return NAV_SECTIONS.filter(section => section.title.toUpperCase() !== 'RECRUITER')
  }

  const visibleSections = getNavSections()
  const isPremium = user?.plan === 'premium'

  const handleNavigate = () => {
    onNavigate?.()
  }

  return (
    <motion.aside
      initial={mobile ? { x: -24, opacity: 0 } : false}
      animate={mobile ? { x: 0, opacity: 1 } : { width: collapsed ? 72 : 264 }}
      exit={mobile ? { x: -24, opacity: 0 } : undefined}
      transition={mobile ? { type: 'tween', duration: 0.22, ease: [0.16, 1, 0.3, 1] } : { type: 'spring', stiffness: 350, damping: 32 }}
      className={`fixed left-0 top-0 h-full bg-white border-r border-slate-100 flex flex-col overflow-hidden select-none ${mobile ? 'z-50 w-[280px] max-w-[75vw] sm:max-w-[280px] shadow-2xl rounded-r-3xl' : 'z-40 shadow-sm'}`}
      role={mobile ? 'dialog' : undefined}
      aria-modal={mobile ? 'true' : undefined}
    >
      <div className={`flex items-center py-4 min-h-[64px] shrink-0 border-b border-slate-100 px-4 sm:px-5 ${isCompact ? 'justify-center' : 'justify-between w-full'}`}>
        <div className="flex items-center gap-2.5">
          <img 
            src="/logo_t.png"
            alt="CareerShala" 
            className="w-9 h-9 object-contain shrink-0" 
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
            onClick={onNavigate}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition active:scale-95 shrink-0"
            aria-label="Close menu drawer"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-none">
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
                    onClick={handleNavigate}
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

        <div className="pt-2 px-0.5">
          {isCompact ? (
            <div className="flex justify-center">
              {isPremium ? (
                <button
                  title="Premium Active (Manage)"
                  onClick={() => navigate('/billing')}
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
                  onClick={() => navigate('/premium')}
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
                      onClick={() => navigate('/billing')}
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
                      onClick={() => navigate('/premium')}
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
      </nav>

      <div className="border-t border-slate-100 p-3 shrink-0 space-y-2">
        <div className={`relative flex items-center gap-2.5 p-1.5 rounded-2xl transition-colors ${
          isCompact ? 'justify-center' : ''
        } ${isPremium ? 'bg-gradient-to-r from-[#F3C24B]/10 to-transparent hover:from-[#F3C24B]/20' : 'hover:bg-slate-50'}`}>
          
          <div className="relative">
            <AvatarRing user={user} ringSize={44} shape="squircle">
              <SidebarAvatar user={user} isPremium={isPremium} />
            </AvatarRing>
            
            {isPremium && (
              <div className="absolute -top-2.5 -right-2 z-20 rotate-[15deg] drop-shadow-md">
                <Crown size={16} gradId="profileCrown" />
              </div>
            )}
          </div>

          <AnimatePresence>
            {!isCompact && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className={`text-[13px] font-bold truncate leading-tight ${isPremium ? 'text-slate-900' : 'text-slate-800'}`}>
                  {user?.full_name || 'User'}
                </p>
                
                {isPremium ? (
                  <span className="inline-flex items-center mt-0.5 text-[9px] font-bold text-[#8A5A14] bg-gradient-to-r from-[#F3C24B]/30 to-[#F3C24B]/10 px-2 py-[2px] rounded-md uppercase tracking-[0.06em] leading-none border border-[#F3C24B]/30 shadow-sm">
                    Premium
                  </span>
                ) : (
                  <span className="inline-block mt-0.5 text-[9.5px] font-semibold text-[#1d6fa5] bg-[#2E9BDA]/10 px-1.5 py-[1px] rounded-md capitalize leading-none">
                    {user?.role || 'Candidate'}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => {
            logout()
            handleNavigate()
          }}
          title="Logout"
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
          className="absolute -right-3 top-[18px] w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-[#2E9BDA] hover:border-blue-200 transition-all z-10">
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-180'}`} strokeWidth={2.5} />
        </button>
      )}
    </motion.aside>
  )
})

export default Sidebar