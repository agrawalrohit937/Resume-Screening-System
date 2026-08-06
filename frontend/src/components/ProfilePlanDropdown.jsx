import { useMemo } from 'react'
import { motion } from 'framer-motion'
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
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'
import AvatarRing, { getUserPlan } from './AvatarRing'

// --- Helper Functions ---
function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function DropdownAvatar({ user, plan }) {
  const imgUrl = resolveAvatarUrl(user)
  const initials = getInitials(user?.full_name)

  return (
    <div className="relative shrink-0 select-none">
      <AvatarRing user={user} ringSize={52} shape="circle">
        <div className="w-[52px] h-[52px] rounded-full overflow-hidden border-2 border-white shadow-md bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-base">
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

function StatBox({ icon: Icon, label, value, trend }) {
  return (
    <div className="flex flex-col p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors">
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

export default function ProfilePlanDropdown({ user, onClose }) {
  const navigate = useNavigate()
  const plan = getUserPlan(user)
  const email = user?.email || 'No email provided'

  // Stats Data
  const ats = user?.ats || {}
  const careerScore = safeNumber(ats?.career_score ?? user?.career_score, 88)
  const atsScore = safeNumber(ats?.ats_score ?? user?.ats_score, 92)
  const resumeCount = safeNumber(user?.resume_count ?? user?.resumes?.count, 12)
  const aiUsage = safeNumber(user?.ai_usage ?? user?.ai_used, 3200)

  // Plan Tier Configurations
  const planConfigs = {
    free: {
      badge: 'Free Member',
      badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200/80',
      accentBar: 'bg-slate-200',
      features: ['Basic ATS Resume Matcher', 'Profile & Resume Storage', 'Standard Support'],
      action: { 
        label: 'Upgrade to Pro', 
        icon: Zap, 
        style: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-md shadow-indigo-500/20 border-transparent', 
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
        style: 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-amber-950 hover:brightness-105 shadow-md shadow-amber-500/20 border-transparent font-black', 
        path: '/premium' 
      }
    }
  }

  const currentConfig = planConfigs[plan] || planConfigs.free

  return (
    <div className="w-[340px] max-w-[95vw] bg-white/95 backdrop-blur-2xl rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.15)] overflow-hidden flex flex-col font-sans">
      
      {/* Top Subtle Tier Accent Bar */}
      <div className={`h-1.5 w-full ${currentConfig.accentBar}`} />

      {/* 1. Header Section */}
      <div className="p-5 pb-4 border-b border-slate-100 flex items-center gap-3.5 relative">
        <DropdownAvatar user={user} plan={plan} />

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
              {user?.full_name || 'User Account'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 truncate font-medium mb-1.5">{email}</p>
          
          <div>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shadow-2xs ${currentConfig.badgeStyle}`}>
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
          <StatBox icon={Shield} label="ATS Score" value={`${atsScore}%`} trend="Top 10%" />
          <StatBox icon={User} label="Career Fit" value={`${careerScore}/100`} />
          
          {(plan === 'pro' || plan === 'premium') && (
            <>
              <StatBox icon={LayoutGrid} label="Resumes" value={resumeCount} />
              <StatBox icon={Sparkles} label="AI Usage" value={`${Math.floor(aiUsage / 60)}h`} />
            </>
          )}
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
                  plan === 'premium' 
                    ? 'text-amber-500 shrink-0' 
                    : plan === 'pro' 
                    ? 'text-slate-600 shrink-0' 
                    : 'text-indigo-500 shrink-0'
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
          onClick={() => {
            navigate(currentConfig.action.path)
            onClose?.()
          }}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 ${currentConfig.action.style}`}
        >
          <currentConfig.action.icon size={15} />
          <span>{currentConfig.action.label}</span>
          <ChevronRight size={14} className="opacity-70" />
        </button>

        <div className="flex gap-2">
          {(plan === 'pro' || plan === 'premium') && (
            <button
              onClick={() => { navigate('/billing'); onClose?.() }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <CreditCard size={13} className="text-slate-500" /> Billing
            </button>
          )}
          <button
            onClick={() => { navigate('/profile'); onClose?.() }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Settings size={13} className="text-slate-500" /> Settings
          </button>
        </div>
      </div>

    </div>
  )
}