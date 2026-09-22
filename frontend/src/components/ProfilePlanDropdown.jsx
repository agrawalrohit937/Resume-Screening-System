import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard,
  LineChart,
  Settings,
  Sparkles,
  Shield,
  User,
  LayoutGrid,
  Crown,
  CheckCircle2,
  Zap,
  ChevronRight,
  Briefcase,
  Users,
  Building2,
  PlusCircle,
  ShieldCheck,
  Clock,
  Timer,
  FileCheck,
  Award,
  LogOut,
  ArrowLeftRight,
  BarChart3,
  HelpCircle,
  FileText
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'
import AvatarRing, { getUserPlan } from './AvatarRing'
import {
  getMyAnalytics,
  getMyPostedJobs,
  getRecruiterStats,
  getAssignedInterviews,
  getRequisitions,
  getPipelineCandidates,
  getExecAnalytics
} from '../services/api'

// --- Helper Functions ---
function safeNumber(value, fallback = 0) {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function DropdownAvatar({ user, plan, effectiveRole }) {
  const imgUrl = resolveAvatarUrl(user)
  const initials = getInitials(user?.full_name)

  let badgeColor = 'bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700'
  if (effectiveRole === 'admin') badgeColor = 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600'
  else if (effectiveRole === 'exec') badgeColor = 'bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-700'
  else if (effectiveRole === 'hiring_manager') badgeColor = 'bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700'
  else if (effectiveRole === 'interviewer') badgeColor = 'bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-600'
  else if (effectiveRole === 'recruiter') badgeColor = 'bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-700'

  return (
    <div className="relative shrink-0 select-none">
      <AvatarRing user={user} ringSize={52} shape="circle">
        <div className={`w-[52px] h-[52px] rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center text-white font-extrabold text-base ${badgeColor}`}>
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={user?.full_name || 'User'}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      </AvatarRing>

      {effectiveRole === 'admin' ? (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-purple-400/40"
          title="Platform Administrator"
        >
          <Shield size={12} strokeWidth={2.5} />
        </div>
      ) : effectiveRole === 'exec' ? (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-emerald-400/40"
          title="Executive Leadership"
        >
          <Crown size={12} strokeWidth={2.5} className="fill-white text-white" />
        </div>
      ) : effectiveRole === 'hiring_manager' ? (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-purple-400/40"
          title="Hiring Manager"
        >
          <Briefcase size={12} strokeWidth={2.5} />
        </div>
      ) : effectiveRole === 'interviewer' ? (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-blue-400/40"
          title="Calibrated Interviewer"
        >
          <FileCheck size={12} strokeWidth={2.5} />
        </div>
      ) : effectiveRole === 'recruiter' ? (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-emerald-400/40"
          title="Verified Enterprise Recruiter"
        >
          <ShieldCheck size={13} strokeWidth={2.5} />
        </div>
      ) : plan === 'premium' ? (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-amber-950 flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-amber-400/30"
          title="Premium Member (Gold Crown)"
        >
          <Crown size={12} strokeWidth={2.5} className="fill-amber-950 text-amber-950" />
        </div>
      ) : plan === 'pro' ? (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 text-slate-800 flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-slate-300/40"
          title="Pro Member (Silver Crown)"
        >
          <Crown size={12} strokeWidth={2.5} className="fill-slate-800 text-slate-800" />
        </div>
      ) : null}
    </div>
  )
}

function StatBox({ icon: Icon, label, value, trend, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex flex-col p-3 rounded-2xl border border-slate-100 bg-slate-50/70 transition-colors ${onClick ? 'hover:bg-indigo-50/50 hover:border-indigo-100 cursor-pointer' : 'hover:bg-slate-50'}`}
    >
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <div className="p-1 rounded-lg bg-white border border-slate-200/60 shadow-xs">
          <Icon size={12} className="text-slate-600" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="flex items-end justify-between mt-0.5">
        <span className="text-base font-black text-slate-900 leading-none tracking-tight">{value}</span>
        {trend && (
          <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md border border-emerald-200/50">
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ProfilePlanDropdown({ user: propUser, onClose }) {
  const navigate = useNavigate()
  const { user: authUser, logout } = useAuth()
  const user = propUser || authUser

  // Role detection
  const userRolesArray = Array.isArray(user?.roles) 
    ? user.roles.map((r) => String(r).toLowerCase().trim()) 
    : []
  const userRoles = [
    ...userRolesArray,
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  const isAdmin = userRoles.includes('admin') || userRoles.includes('platform_admin')
  const isExecutive = userRoles.includes('exec') || userRoles.includes('executive')
  const isHiringManager = userRoles.includes('hiring_manager')
  const isInterviewer = userRoles.includes('interviewer')
  const isRecruiter = userRoles.includes('recruiter')
  const hasCandidateRole = userRoles.includes('candidate') || (!user?.roles && String(user?.role).toLowerCase().trim() === 'candidate')
  const hasEmployerRole = isAdmin || isExecutive || isHiringManager || isInterviewer || isRecruiter

  const savedContext = typeof window !== 'undefined' ? localStorage.getItem('careerpilot_view_context') : null
  const isCandidateView = savedContext === 'candidate' && hasCandidateRole

  let effectiveRole = 'candidate'
  if (!isCandidateView) {
    if (isAdmin) effectiveRole = 'admin'
    else if (isExecutive) effectiveRole = 'exec'
    else if (isHiringManager) effectiveRole = 'hiring_manager'
    else if (isInterviewer) effectiveRole = 'interviewer'
    else if (isRecruiter) effectiveRole = 'recruiter'
    else effectiveRole = 'candidate'
  }

  const canSwitchContext = hasEmployerRole && hasCandidateRole && !isAdmin
  const plan = getUserPlan(user)
  const email = user?.email || 'No email provided'
  const companyName = user?.company_name || 'Enterprise Team'

  // Data states
  const [analytics, setAnalytics] = useState(null)
  const [recruiterJobs, setRecruiterJobs] = useState([])
  const [recruiterStats, setRecruiterStats] = useState(null)
  const [interviewerData, setInterviewerData] = useState([])
  const [hiringManagerData, setHiringManagerData] = useState({ requisitions: [], candidates: [] })
  const [execData, setExecData] = useState(null)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    if (effectiveRole === 'recruiter') {
      Promise.all([
        getMyPostedJobs().catch(() => ({ data: { jobs: [] } })),
        getRecruiterStats().catch(() => ({ data: null })),
      ]).then(([jobsRes, statsRes]) => {
        if (!mounted) return
        if (jobsRes.data?.jobs) setRecruiterJobs(jobsRes.data.jobs)
        if (statsRes.data) setRecruiterStats(statsRes.data)
      })
    } else if (effectiveRole === 'interviewer') {
      getAssignedInterviews()
        .then((res) => {
          if (!mounted) return
          if (Array.isArray(res.data)) setInterviewerData(res.data)
        })
        .catch(() => {})
    } else if (effectiveRole === 'hiring_manager') {
      Promise.all([
        getRequisitions().catch(() => ({ data: [] })),
        getPipelineCandidates().catch(() => ({ data: [] }))
      ]).then(([reqRes, candRes]) => {
        if (!mounted) return
        setHiringManagerData({
          requisitions: Array.isArray(reqRes.data) ? reqRes.data : [],
          candidates: Array.isArray(candRes.data) ? candRes.data : []
        })
      })
    } else if (effectiveRole === 'exec') {
      getExecAnalytics()
        .then((res) => {
          if (!mounted) return
          if (res.data) setExecData(res.data)
        })
        .catch(() => {})
    } else if (effectiveRole === 'candidate') {
      getMyAnalytics(undefined, { signal: controller.signal })
        .then((res) => {
          if (mounted && res.data) {
            setAnalytics(res.data)
          }
        })
        .catch(() => {})
    }

    return () => {
      mounted = false
      controller.abort()
    }
  }, [effectiveRole])

  const handleNavigateAndClose = (path) => {
    onClose?.()
    if (path) navigate(path)
  }

  const handleSwitchContext = () => {
    const nextContext = isCandidateView ? 'employer' : 'candidate'
    localStorage.setItem('careerpilot_view_context', nextContext)
    onClose?.()
    if (nextContext === 'candidate') {
      navigate('/dashboard')
    } else {
      if (isExecutive) navigate('/exec/dashboard')
      else if (isHiringManager) navigate('/hiring-manager/dashboard')
      else if (isInterviewer) navigate('/interviewer/dashboard')
      else if (isAdmin) navigate('/admin')
      else navigate('/recruiter/dashboard')
    }
  }

  // Common Bottom Logout / Help Footer
  const DropdownFooter = () => (
    <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <button
        type="button"
        onClick={() => handleNavigateAndClose('/support')}
        className="hover:text-slate-900 transition-colors font-medium flex items-center gap-1 cursor-pointer"
      >
        <HelpCircle size={13} /> Support & FAQ
      </button>
      <button
        type="button"
        onClick={() => {
          onClose?.()
          logout?.()
        }}
        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors font-semibold flex items-center gap-1 cursor-pointer"
      >
        <LogOut size={13} /> Sign Out
      </button>
    </div>
  )

  // Common Context Switcher Bar (if multi-hat user)
  const ContextSwitcherBar = () => {
    if (!canSwitchContext) return null
    return (
      <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
          <ArrowLeftRight size={11} className="text-slate-400" />
          {isCandidateView ? 'Candidate Portal Active' : 'Employer Portal Active'}
        </span>
        <button
          type="button"
          onClick={handleSwitchContext}
          className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-slate-200 rounded-md shadow-2xs transition cursor-pointer"
        >
          Switch to {isCandidateView ? 'Employer' : 'Candidate'}
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ADMIN LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (effectiveRole === 'admin') {
    return (
      <div className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl overflow-hidden flex flex-col font-sans isolate ring-1 ring-slate-200/50 relative z-50">
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />
        <ContextSwitcherBar />

        {/* Header */}
        <div 
          onClick={() => handleNavigateAndClose('/admin')}
          className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative cursor-pointer hover:bg-slate-50/60 transition-colors"
          role="button"
          tabIndex={0}
        >
          <DropdownAvatar user={user} plan={plan} effectiveRole="admin" />
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
              {user?.full_name || 'Administrator'}
            </h3>
            <p className="text-xs text-slate-500 w-full truncate font-medium mb-1.5">{email}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Shield size={10} className="text-indigo-600 shrink-0" />
                <span>Superadmin</span>
              </span>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                Security & RBAC
              </span>
            </div>
          </div>
        </div>

        {/* Admin Live Metrics */}
        <div className="p-4 pb-2 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-2">
            <StatBox 
              icon={Shield} 
              label="Access Level" 
              value="Full Root" 
              trend="Active"
              onClick={() => handleNavigateAndClose('/admin')}
            />
            <StatBox 
              icon={Users} 
              label="Team Access" 
              value="RBAC" 
              trend="Multi-Role"
              onClick={() => handleNavigateAndClose('/settings/team')}
            />
            <StatBox 
              icon={Clock} 
              label="Audit Logs" 
              value="Monitored" 
              trend="Secure"
              onClick={() => handleNavigateAndClose('/admin')}
            />
            <StatBox 
              icon={Building2} 
              label="Tenant ID" 
              value={user?.tenant_id ? user.tenant_id.slice(0, 7) : 'Default'} 
              trend="Isolated"
              onClick={() => handleNavigateAndClose('/admin')}
            />
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="px-5 py-3">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Admin Privileges</span>
            <span className="text-indigo-600 font-bold text-[10.5px]">Master Control</span>
          </h4>
          <ul className="space-y-1.5">
            {[
              'Enterprise Multi-Tenant Isolation',
              'System Audit Logs & Traceability',
              'Skill Ontology & ATS Calibrator',
              'Team Invitation & Role Assign'
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <CheckCircle2 size={13} className="text-indigo-500 shrink-0" />
                <span className="truncate">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/admin')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
          >
            <Shield size={14} />
            <span>Open Admin Dashboard</span>
            <ChevronRight size={14} className="opacity-70 ml-auto" />
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/settings/team')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Users size={12} className="text-slate-400 shrink-0" /> Team
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/recruiter/jobs')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Briefcase size={12} className="text-slate-400 shrink-0" /> Jobs
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/settings')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Settings size={12} className="text-slate-400 shrink-0" /> Settings
            </button>
          </div>
        </div>

        <DropdownFooter />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXECUTIVE / LEADERSHIP LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (effectiveRole === 'exec') {
    const talentIndex = execData?.talent_index ?? '94%'
    const totalHires = execData?.total_hires ?? '12'
    const openReqs = execData?.open_requisitions ?? '4'

    return (
      <div className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl overflow-hidden flex flex-col font-sans isolate ring-1 ring-slate-200/50 relative z-50">
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />
        <ContextSwitcherBar />

        {/* Header */}
        <div 
          onClick={() => handleNavigateAndClose('/exec/dashboard')}
          className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative cursor-pointer hover:bg-slate-50/60 transition-colors"
          role="button"
          tabIndex={0}
        >
          <DropdownAvatar user={user} plan={plan} effectiveRole="exec" />
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
              {user?.full_name || 'Executive Member'}
            </h3>
            <p className="text-xs text-slate-500 w-full truncate font-medium mb-1.5">{email}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <Crown size={10} className="text-emerald-600 shrink-0" />
                <span>Executive Suite</span>
              </span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                Talent Intelligence
              </span>
            </div>
          </div>
        </div>

        {/* Executive Live Metrics */}
        <div className="p-4 pb-2 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-2">
            <StatBox 
              icon={BarChart3} 
              label="Talent Index" 
              value={talentIndex} 
              trend="Top Tier"
              onClick={() => handleNavigateAndClose('/exec/dashboard')}
            />
            <StatBox 
              icon={Briefcase} 
              label="Headcount Reqs" 
              value={openReqs} 
              trend="Allocated"
              onClick={() => handleNavigateAndClose('/exec/dashboard')}
            />
            <StatBox 
              icon={Users} 
              label="Quarter Hires" 
              value={totalHires} 
              trend="On Track"
              onClick={() => handleNavigateAndClose('/exec/dashboard')}
            />
            <StatBox 
              icon={Timer} 
              label="Avg Time-to-Fill" 
              value="18d" 
              trend="Industry Lead"
              onClick={() => handleNavigateAndClose('/exec/dashboard')}
            />
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="px-5 py-3">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Executive Insights</span>
            <span className="text-emerald-600 font-bold text-[10.5px]">Live Feed</span>
          </h4>
          <ul className="space-y-1.5">
            {[
              'Enterprise Headcount & Budget Allocation',
              'Quality of Hire & Pass-Through Velocity',
              'Cross-Department Diversity & Pipeline Health'
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span className="truncate">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/exec/dashboard')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
          >
            <Crown size={14} />
            <span>Executive Intelligence Hub</span>
            <ChevronRight size={14} className="opacity-70 ml-auto" />
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/settings/team')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Users size={12} className="text-slate-400 shrink-0" /> Team
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/recruiter/company')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Building2 size={12} className="text-slate-400 shrink-0" /> Brand
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/settings')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Settings size={12} className="text-slate-400 shrink-0" /> Settings
            </button>
          </div>
        </div>

        <DropdownFooter />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. HIRING MANAGER LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (effectiveRole === 'hiring_manager') {
    const totalReqs = hiringManagerData.requisitions.length
    const openHeadcount = hiringManagerData.requisitions.reduce((acc, r) => {
      const head = Number(r.headcount) || 0
      const filled = Number(r.filled_count) || 0
      return acc + Math.max(0, head - filled)
    }, 0)
    const pipelineCount = hiringManagerData.candidates.length

    return (
      <div className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl overflow-hidden flex flex-col font-sans isolate ring-1 ring-slate-200/50 relative z-50">
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-600" />
        <ContextSwitcherBar />

        {/* Header */}
        <div 
          onClick={() => handleNavigateAndClose('/hiring-manager/dashboard')}
          className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative cursor-pointer hover:bg-slate-50/60 transition-colors"
          role="button"
          tabIndex={0}
        >
          <DropdownAvatar user={user} plan={plan} effectiveRole="hiring_manager" />
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
              {user?.full_name || 'Hiring Manager'}
            </h3>
            <p className="text-xs text-slate-500 w-full truncate font-medium mb-1.5">{email}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                <Briefcase size={10} className="text-purple-600 shrink-0" />
                <span>Hiring Manager</span>
              </span>
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200/60">
                Headcount & Pipeline
              </span>
            </div>
          </div>
        </div>

        {/* Hiring Manager Live Metrics */}
        <div className="p-4 pb-2 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-2">
            <StatBox 
              icon={Briefcase} 
              label="Open Headcount" 
              value={openHeadcount > 0 ? `${openHeadcount} Roles` : (totalReqs > 0 ? `${totalReqs} Reqs` : '0 Roles')} 
              trend={openHeadcount > 0 ? 'Approved' : 'Allocating'}
              onClick={() => handleNavigateAndClose('/hiring-manager/dashboard')}
            />
            <StatBox 
              icon={Users} 
              label="Candidates" 
              value={pipelineCount} 
              trend={pipelineCount > 0 ? 'In Review' : '0 Active'}
              onClick={() => handleNavigateAndClose('/hiring-manager/dashboard')}
            />
            <StatBox 
              icon={FileCheck} 
              label="Sequential Chain" 
              value="3-Step" 
              trend="Finance Signoff"
              onClick={() => handleNavigateAndClose('/hiring-manager/dashboard')}
            />
            <StatBox 
              icon={Award} 
              label="Calibrations" 
              value="Consensus" 
              trend="Review Scorecards"
              onClick={() => handleNavigateAndClose('/hiring-manager/dashboard')}
            />
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="px-5 py-3">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Department Scope</span>
            <span className="text-purple-600 font-bold text-[10.5px]">Authorized</span>
          </h4>
          <ul className="space-y-1.5">
            {[
              'Requisition Budget Sign-offs',
              'Active Candidate Calibration Reviews',
              'Interviewer Scorecard Consensus',
              'Extend Formal Offers / Hires'
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <CheckCircle2 size={13} className="text-purple-500 shrink-0" />
                <span className="truncate">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/hiring-manager/dashboard')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all cursor-pointer"
          >
            <Briefcase size={14} />
            <span>Requisitions & Talent Pipeline</span>
            <ChevronRight size={14} className="opacity-70 ml-auto" />
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/recruiter/jobs')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-purple-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Briefcase size={12} className="text-slate-400 shrink-0" /> Postings
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/recruiter/company')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-purple-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Building2 size={12} className="text-slate-400 shrink-0" /> Brand
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/profile')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-purple-600 transition-colors cursor-pointer shadow-2xs"
            >
              <User size={12} className="text-slate-400 shrink-0" /> Profile
            </button>
          </div>
        </div>

        <DropdownFooter />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. INTERVIEWER LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (effectiveRole === 'interviewer') {
    const totalAssigned = interviewerData.length
    const submittedCount = interviewerData.filter(i => i.is_submitted || i.scorecard).length
    const pendingCount = Math.max(0, totalAssigned - submittedCount)

    return (
      <div className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl overflow-hidden flex flex-col font-sans isolate ring-1 ring-slate-200/50 relative z-50">
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600" />
        <ContextSwitcherBar />

        {/* Header */}
        <div 
          onClick={() => handleNavigateAndClose('/interviewer/dashboard')}
          className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative cursor-pointer hover:bg-slate-50/60 transition-colors"
          role="button"
          tabIndex={0}
        >
          <DropdownAvatar user={user} plan={plan} effectiveRole="interviewer" />
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
              {user?.full_name || 'Panel Interviewer'}
            </h3>
            <p className="text-xs text-slate-500 w-full truncate font-medium mb-1.5">{email}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                <FileCheck size={10} className="text-blue-600 shrink-0" />
                <span>Interviewer Panel</span>
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                Rubrics & Scorecards
              </span>
            </div>
          </div>
        </div>

        {/* Interviewer Live Metrics */}
        <div className="p-4 pb-2 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-2">
            <StatBox 
              icon={Clock} 
              label="Pending Evals" 
              value={pendingCount} 
              trend={pendingCount > 0 ? 'Awaiting' : 'All Clear'}
              onClick={() => handleNavigateAndClose('/interviewer/dashboard')}
            />
            <StatBox 
              icon={CheckCircle2} 
              label="Submitted" 
              value={submittedCount} 
              trend="Saved in DB"
              onClick={() => handleNavigateAndClose('/interviewer/dashboard')}
            />
            <StatBox 
              icon={Award} 
              label="Rubric Scale" 
              value="1 – 5" 
              trend="Standardized"
              onClick={() => handleNavigateAndClose('/interviewer/dashboard')}
            />
            <StatBox 
              icon={Sparkles} 
              label="Mock Practice" 
              value="Ready" 
              trend="Live Session"
              onClick={() => handleNavigateAndClose('/live-interview')}
            />
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="px-5 py-3">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Interviewer Toolkit</span>
            <span className="text-blue-600 font-bold text-[10.5px]">Calibrated</span>
          </h4>
          <ul className="space-y-1.5">
            {[
              'Competency-Based Rubrics & Anchors',
              'Qualitative Notes & Candidate Quotes',
              'Consensus & Divergence Protection',
              'Simulated Mock Video Practice'
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <CheckCircle2 size={13} className="text-blue-500 shrink-0" />
                <span className="truncate">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/interviewer/dashboard')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
          >
            <FileCheck size={14} />
            <span>Open Assigned Scorecards</span>
            <ChevronRight size={14} className="opacity-70 ml-auto" />
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/live-interview')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Sparkles size={12} className="text-slate-400 shrink-0" /> Mock
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/profile')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer shadow-2xs"
            >
              <User size={12} className="text-slate-400 shrink-0" /> Profile
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/settings')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Settings size={12} className="text-slate-400 shrink-0" /> Settings
            </button>
          </div>
        </div>

        <DropdownFooter />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. RECRUITER LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (effectiveRole === 'recruiter') {
    const activeJobsCount = recruiterStats?.active_openings ?? recruiterJobs.filter(j => j.status === 'open').length
    const totalApplicantsCount = recruiterStats?.total_candidates ?? recruiterJobs.reduce((acc, curr) => acc + (curr.applicant_count || 0), 0)
    const pendingReviewsCount = recruiterStats?.action_required ?? (totalApplicantsCount > 0 ? totalApplicantsCount : 0)
    const timeToScreen = recruiterStats?.time_to_screen

    return (
      <div className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl overflow-hidden flex flex-col font-sans isolate ring-1 ring-slate-200/50 relative z-50">
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />
        <ContextSwitcherBar />

        {/* Header */}
        <div 
          onClick={() => handleNavigateAndClose('/recruiter/dashboard')}
          className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative cursor-pointer hover:bg-slate-50/60 transition-colors"
          role="button"
          tabIndex={0}
        >
          <DropdownAvatar user={user} plan={plan} effectiveRole="recruiter" />
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
              {user?.full_name || 'Recruiter Account'}
            </h3>
            <p className="text-xs text-slate-500 w-full truncate font-medium mb-1.5">{email}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <Building2 size={10} className="text-emerald-600 shrink-0" />
                <span className="truncate max-w-[130px]">{companyName}</span>
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                Hiring Suite
              </span>
            </div>
          </div>
        </div>

        {/* Recruiter Live Metrics */}
        <div className="p-4 pb-2 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-2">
            <StatBox 
              icon={Briefcase} 
              label="Active Jobs" 
              value={activeJobsCount} 
              trend={activeJobsCount > 0 ? `${activeJobsCount} Live` : '0 Live'}
              onClick={() => handleNavigateAndClose('/recruiter/jobs')}
            />
            <StatBox 
              icon={Users} 
              label="Applicants" 
              value={totalApplicantsCount}
              trend={totalApplicantsCount > 0 ? `${totalApplicantsCount} Total` : '0 Total'}
              onClick={() => handleNavigateAndClose('/recruiter/jobs')}
            />
            <StatBox 
              icon={Clock} 
              label="Pending Reviews" 
              value={pendingReviewsCount}
              trend={pendingReviewsCount > 0 ? 'Action Needed' : 'Caught Up'}
              onClick={() => handleNavigateAndClose('/recruiter/jobs')}
            />
            <StatBox 
              icon={Timer} 
              label="Time to Screen" 
              value={timeToScreen != null ? `${timeToScreen}d` : '1.8d'}
              trend={timeToScreen != null ? 'Avg' : 'Real-Time'}
              onClick={() => handleNavigateAndClose('/recruiter/dashboard')}
            />
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="px-5 py-3">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Enterprise Recruiter</span>
            <span className="text-emerald-600 font-bold text-[10.5px]">Enabled</span>
          </h4>
          <ul className="space-y-1.5">
            {[
              'Smart Candidate Matching & Ranking',
              'Visual Multi-Stage Pipeline Board',
              'Automated Hybrid Resume Scoring',
              'Consented Talent Pool Search'
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span className="truncate">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/recruiter/jobs')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle size={14} />
            <span>Manage & Post Jobs</span>
            <ChevronRight size={14} className="opacity-70 ml-auto" />
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/recruiter/company')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Building2 size={12} className="text-slate-400 shrink-0" /> Brand
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/recruiter/settings')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Settings size={12} className="text-slate-400 shrink-0" /> Settings
            </button>
            <button
              type="button"
              onClick={() => handleNavigateAndClose('/billing')}
              className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
            >
              <CreditCard size={12} className="text-slate-400 shrink-0" /> Billing
            </button>
          </div>
        </div>

        <DropdownFooter />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CANDIDATE LAYOUT (DEFAULT)
  // ═══════════════════════════════════════════════════════════════════════════
  const resumeCount = safeNumber(user?.total_resumes, analytics?.summary?.total_resumes ?? 0)
  const totalAtsChecks = safeNumber(user?.total_ats_checks, analytics?.summary?.total_ats_checks ?? 0)
  const rawAtsScore = analytics?.summary?.best_score ?? analytics?.summary?.average_score ?? user?.ats?.best_score ?? user?.ats_score ?? 0
  const atsScore = totalAtsChecks > 0 ? (rawAtsScore > 1 ? Math.round(rawAtsScore) : Math.round(rawAtsScore * 100)) : 0
  const careerScore = safeNumber(user?.profile_completion_percent ?? analytics?.profile_completeness?.percentage, 0)
  const trend = totalAtsChecks > 0 && atsScore >= 80 ? 'Top 10%' : totalAtsChecks > 0 && atsScore >= 60 ? 'Good' : null

  const planConfigs = {
    free: {
      badge: 'Free Member',
      badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200/80',
      accentBar: 'bg-slate-300',
      features: ['Basic ATS Resume Matcher', 'Profile & Resume Storage', 'Standard Career Feed'],
      action: { 
        label: 'Upgrade to Pro', 
        icon: Zap, 
        style: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-md border-transparent', 
        path: '/premium' 
      }
    },
    pro: {
      badge: 'Pro Tier',
      badgeStyle: 'bg-slate-100 text-slate-800 border-slate-300 font-bold',
      accentBar: 'bg-gradient-to-r from-slate-400 via-indigo-500 to-blue-500',
      features: ['Advanced ATS Insights & Scoring', 'Detailed Interview Analytics', 'Priority Processing'],
      action: { 
        label: 'View Analytics', 
        icon: LineChart, 
        style: 'bg-slate-900 text-white hover:bg-slate-800 shadow-md border-transparent', 
        path: '/results' 
      }
    },
    premium: {
      badge: 'Premium Tier',
      badgeStyle: 'bg-amber-100 text-amber-900 border-amber-300/80 font-extrabold',
      accentBar: 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500',
      features: ['Unlimited AI Copilot Usage', 'Comprehensive ATS Reports', 'Full AI Interview Suite'],
      action: { 
        label: 'Premium Hub', 
        icon: Sparkles, 
        style: 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-amber-950 shadow-md border-transparent font-black', 
        path: '/premium' 
      }
    }
  }

  const currentConfig = planConfigs[plan] || planConfigs.free

  return (
    <div className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl overflow-hidden flex flex-col font-sans isolate ring-1 ring-slate-200/50 relative z-50">
      <div className={`h-1.5 w-full shrink-0 ${currentConfig.accentBar}`} />
      <ContextSwitcherBar />

      {/* Header */}
      <div 
        onClick={() => handleNavigateAndClose('/profile')}
        className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative cursor-pointer hover:bg-slate-50/60 transition-colors"
        role="button"
        tabIndex={0}
      >
        <DropdownAvatar user={user} plan={plan} effectiveRole="candidate" />
        <div className="flex flex-col min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
            {user?.full_name || 'Candidate Account'}
          </h3>
          <p className="text-xs text-slate-500 truncate font-medium mb-1.5">{email}</p>
          <div>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${currentConfig.badgeStyle}`}>
              {plan === 'premium' && <span>👑</span>}
              {plan === 'pro' && <span>🥈</span>}
              {currentConfig.badge}
            </span>
          </div>
        </div>
      </div>

      {/* Candidate Live Metrics */}
      <div className="p-4 pb-2 bg-slate-50/40">
        <div className="grid grid-cols-2 gap-2">
          <StatBox 
            icon={Shield} 
            label="ATS Score" 
            value={totalAtsChecks > 0 ? `${atsScore}%` : '0%'} 
            trend={trend}
            onClick={() => handleNavigateAndClose('/results')}
          />
          <StatBox 
            icon={User} 
            label="Profile Fit" 
            value={`${careerScore}%`}
            onClick={() => handleNavigateAndClose('/profile')}
          />
          <StatBox 
            icon={LayoutGrid} 
            label="Resumes" 
            value={resumeCount}
            onClick={() => handleNavigateAndClose('/results')}
          />
          <StatBox 
            icon={Sparkles} 
            label="ATS Checks" 
            value={totalAtsChecks}
            onClick={() => handleNavigateAndClose('/results')}
          />
        </div>
      </div>

      {/* Plan Benefits */}
      <div className="px-5 py-3">
        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
          Candidate Features
        </h4>
        <ul className="space-y-1.5">
          {currentConfig.features.map((feat) => (
            <li key={feat} className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <CheckCircle2 
                size={13} 
                className={
                  plan === 'premium' ? 'text-amber-500 shrink-0' : 
                  plan === 'pro' ? 'text-slate-600 shrink-0' : 'text-indigo-500 shrink-0'
                } 
              />
              <span className="truncate">{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => handleNavigateAndClose(currentConfig.action.path)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${currentConfig.action.style}`}
        >
          <currentConfig.action.icon size={14} />
          <span>{currentConfig.action.label}</span>
          <ChevronRight size={14} className="opacity-70 ml-auto" />
        </button>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/billing')}
            className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <CreditCard size={12} className="text-slate-500 shrink-0" /> Billing
          </button>
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/profile')}
            className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <User size={12} className="text-slate-500 shrink-0" /> Profile
          </button>
          <button
            type="button"
            onClick={() => handleNavigateAndClose('/settings')}
            className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <Settings size={12} className="text-slate-400 shrink-0" /> Settings
          </button>
        </div>
      </div>

      <DropdownFooter />
    </div>
  )
}