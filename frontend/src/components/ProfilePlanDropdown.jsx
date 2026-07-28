import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard,
  LineChart,
  Settings,
  Sparkles,
  ShieldCheck,
  Trophy,
  User,
  LayoutGrid,
  Search,
  Crown,
  Shield,
  CheckCircle2,
  Zap
} from 'lucide-react'

// --- Utility Functions ---
function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampDaysLeft(daysLeft) {
  const n = safeNumber(daysLeft, 0)
  return n < 0 ? 0 : n > 9999 ? 9999 : n
}

function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = String(fullName).trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0].toUpperCase()
}

function resolveAvatarUrl(user) {
  if (!user) return null
  const pics = [user.profile_picture, user.display_picture, user.google_picture]
  return pics.find(pic => String(pic).startsWith('http')) || null
}

// --- Components ---
function Avatar({ user, size = 48, plan }) {
  const imgUrl = resolveAvatarUrl(user)
  const initials = getInitials(user?.full_name)
  
  // High-contrast solid fallbacks
  const fallbackBg = plan === 'pro' ? 'bg-indigo-600' : plan === 'premium' ? 'bg-amber-500' : 'bg-slate-800'

  return (
    <div 
      className={`relative flex items-center justify-center rounded-full text-white font-bold tracking-wide shrink-0 ${fallbackBg}`}
      style={{ width: size, height: size }}
    >
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={user?.full_name || 'Avatar'}
          className="rounded-full object-cover w-full h-full border border-black/10"
        />
      ) : (
        <span className="text-sm">{initials}</span>
      )}
    </div>
  )
}

function StatBox({ icon: Icon, label, value, trend }) {
  return (
    <div className="flex flex-col p-3 rounded-xl border border-slate-200 bg-slate-50/50">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <Icon size={14} strokeWidth={2.5} />
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-lg font-black text-slate-900 leading-none">{value}</span>
        {trend && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">{trend}</span>}
      </div>
    </div>
  )
}

export default function ProfilePlanDropdown({ user, onClose }) {
  const navigate = useNavigate()
  const plan = (user?.plan || 'free').toLowerCase()
  const email = user?.email || 'No email provided'

  // Data Fallbacks
  const membership = user?.membership || {}
  const daysLeft = clampDaysLeft(membership?.days_left ?? user?.plan_days_left)
  
  const ats = user?.ats || {}
  const careerScore = safeNumber(ats?.career_score ?? user?.career_score, 0)
  const atsScore = safeNumber(ats?.ats_score ?? user?.ats_score, 0)
  const resumeCount = safeNumber(user?.resume_count ?? user?.resumes?.count, 0)
  const aiUsage = safeNumber(user?.ai_usage ?? user?.ai_used, 0)

  // Plan Configurations
  const planConfigs = {
    free: {
      badge: 'Free Plan',
      badgeStyle: 'bg-slate-100 text-slate-600 border-slate-200',
      features: ['ATS matcher (basic)', 'Profile & settings', 'Standard support'],
      action: { label: 'Upgrade to Pro', icon: Zap, style: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md border-transparent', path: '/premium' }
    },
    pro: {
      badge: 'Pro',
      badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      features: ['Premium ATS insights', 'Advanced interview analytics', 'Faster scoring'],
      action: { label: 'View Analytics', icon: LineChart, style: 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50', path: '/analytics' }
    },
    premium: {
      badge: 'Premium',
      badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
      features: ['Unlimited AI usage', 'Premium ATS reports', 'AI interview insights'],
      action: { label: 'Premium Dashboard', icon: Sparkles, style: 'bg-amber-400 text-amber-950 hover:bg-amber-500 border-transparent', path: '/premium' }
    }
  }

  const currentConfig = planConfigs[plan] || planConfigs.free

  return (
    <div className="w-[340px] max-w-[95vw] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col font-sans">
      
      {/* 1. Header Section */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-4 relative overflow-hidden">
        {/* Subtle background accent for premium tiers */}
        {plan === 'pro' && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />}
        {plan === 'premium' && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500" />}

        {/* Avatar with dynamic ring */}
        <div className={`relative rounded-full p-1 ${plan === 'premium' ? 'bg-gradient-to-br from-amber-300 to-orange-500' : plan === 'pro' ? 'bg-indigo-500' : 'bg-transparent'}`}>
          <Avatar user={user} size={48} plan={plan} />
          {plan === 'premium' && (
             <div className="absolute -top-1 -right-1 bg-slate-900 text-amber-400 rounded-full p-1 border-2 border-white">
               <Crown size={12} strokeWidth={3} />
             </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-black text-slate-900 truncate">{user?.full_name || 'User Account'}</h3>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${currentConfig.badgeStyle}`}>
              {currentConfig.badge}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate font-medium">{email}</p>
        </div>
      </div>

      {/* 2. Stats Section (Only for Pro/Premium or active users) */}
      <div className="p-5 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <StatBox icon={Shield} label="ATS Score" value={`${atsScore || 92}%`} trend="Top 10%" />
          <StatBox icon={User} label="Career Fit" value={`${careerScore || 88}/100`} />
          
          {(plan === 'pro' || plan === 'premium') && (
            <>
              <StatBox icon={LayoutGrid} label="Resumes" value={resumeCount || 12} />
              <StatBox icon={Sparkles} label="AI Usage" value={`${Math.floor((aiUsage || 3200)/60)}h`} />
            </>
          )}
        </div>
      </div>

      {/* 3. Features List */}
      <div className="px-5 py-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Plan Benefits</h4>
        <ul className="space-y-2.5">
          {currentConfig.features.map((feat) => (
            <li key={feat} className="flex items-center gap-2.5 text-sm text-slate-700 font-medium">
              <CheckCircle2 size={16} className={plan === 'free' ? 'text-slate-400' : plan === 'premium' ? 'text-amber-500' : 'text-indigo-500'} />
              {feat}
            </li>
          ))}
        </ul>
      </div>

      {/* 4. Action Area */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
        <button
          onClick={() => {
            navigate(currentConfig.action.path)
            onClose?.()
          }}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border ${currentConfig.action.style}`}
        >
          <currentConfig.action.icon size={16} />
          {currentConfig.action.label}
        </button>

        <div className="flex gap-2">
          {(plan === 'pro' || plan === 'premium') && (
            <button
              onClick={() => { navigate('/billing'); onClose?.() }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <CreditCard size={14} /> Billing
            </button>
          )}
          <button
            onClick={() => { navigate('/profile'); onClose?.() }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Settings size={14} /> Profile
          </button>
        </div>
      </div>

    </div>
  )
}