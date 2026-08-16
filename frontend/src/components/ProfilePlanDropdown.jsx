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
  ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'
import AvatarRing, { getUserPlan } from './AvatarRing'
import { getMyAnalytics } from '../services/api'

// --- Helper Functions ---
function safeNumber(value, fallback = 0) {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function DropdownAvatar({ user, plan }) {
  const imgUrl = resolveAvatarUrl(user)
  const initials = getInitials(user?.full_name)

  return (
    <div className="relative shrink-0 select-none">
      <AvatarRing user={user} ringSize={52} shape="circle">
        <div className="w-[52px] h-[52px] rounded-full overflow-hidden border-2 border-white shadow-sm bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-base">
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

      {plan === 'premium' && (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-amber-950 flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-amber-400/30"
          title="Premium Member (Gold Crown)"
        >
          <Crown size={12} strokeWidth={2.5} className="fill-amber-950 text-amber-950" />
        </div>
      )}
      {plan === 'pro' && (
        <div 
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 text-slate-800 flex items-center justify-center shadow-lg border-2 border-white ring-1 ring-slate-300/40"
          title="Pro Member (Silver Crown)"
        >
          <Crown size={12} strokeWidth={2.5} className="fill-slate-800 text-slate-800" />
        </div>
      )}
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
  const { user: authUser } = useAuth()
  const user = propUser || authUser

  const plan = getUserPlan(user)
  const email = user?.email || 'No email provided'

  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    getMyAnalytics(undefined, { signal: controller.signal })
      .then((res) => {
        if (mounted && res.data) {
          setAnalytics(res.data)
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
      controller.abort()
    }
  }, [])

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
      accentBar: 'bg-slate-200',
      features: ['Basic ATS Resume Matcher', 'Profile & Resume Storage', 'Standard Support'],
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
        path: '/analytics' 
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

  const handleNavigateAndClose = (path) => {
    onClose?.()
    if (path) navigate(path)
  }

  return (
    <div className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl overflow-hidden flex flex-col font-sans isolate ring-1 ring-slate-200/50 relative z-50">
      {/* Top Subtle Tier Accent Bar */}
      <div className={`h-1.5 w-full shrink-0 ${currentConfig.accentBar}`} />

      {/* 1. Header Section */}
      <div 
        onClick={() => handleNavigateAndClose('/profile')}
        className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative cursor-pointer hover:bg-slate-50/60 transition-colors"
        role="button"
        tabIndex={0}
      >
        <DropdownAvatar user={user} plan={plan} />

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
              {user?.full_name || 'User Account'}
            </h3>
          </div>
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

      {/* 2. Stats Section */}
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
            onClick={() => handleNavigateAndClose('/upload')}
          />
          <StatBox 
            icon={Sparkles} 
            label="ATS Checks" 
            value={totalAtsChecks}
            onClick={() => handleNavigateAndClose('/results')}
          />
        </div>
      </div>

      {/* 3. Plan Benefits */}
      <div className="px-5 py-3.5">
        <h4 className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">
          Plan Features
        </h4>
        <ul className="space-y-2">
          {currentConfig.features.map((feat) => (
            <li key={feat} className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
              <CheckCircle2 
                size={14} 
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

      {/* 4. Action Area */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
        <button
          onClick={() => handleNavigateAndClose(currentConfig.action.path)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${currentConfig.action.style}`}
        >
          <currentConfig.action.icon size={15} />
          <span>{currentConfig.action.label}</span>
          <ChevronRight size={14} className="opacity-70" />
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => handleNavigateAndClose('/billing')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/90 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <CreditCard size={13} className="text-slate-500" /> Billing
          </button>
          <button
            onClick={() => handleNavigateAndClose('/profile')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/90 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Settings size={13} className="text-slate-500" /> Settings
          </button>
        </div>
      </div>

    </div>
  )
}