import { useState, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Settings,
  CreditCard,
  LogOut,
  Target,
  Trophy,
  ArrowLeftRight,
  Flame,
  Award,
  Globe,
  ChevronRight,
  Briefcase,
  Building2,
  Shield,
  Zap
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'
import AvatarRing, { getUserPlan } from './AvatarRing'
import { getMyAnalytics } from '../services/api'
import { getGamificationProfile } from '../services/interviewApi'

function DropdownAvatar({ user }) {
  const imgUrl = resolveAvatarUrl(user)
  const initials = getInitials(user?.full_name)

  return (
    <div className="relative shrink-0 select-none">
      <AvatarRing user={user} ringSize={44} shape="circle">
        <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-200/80 shadow-2xs flex items-center justify-center text-white font-extrabold text-sm bg-gradient-to-br from-indigo-500 to-blue-600">
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
    </div>
  )
}

function ProfilePlanDropdown({ user: propUser, onClose }) {
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

  const savedContext = typeof window !== 'undefined' ? (localStorage.getItem('careershala_view_context') || localStorage.getItem('careerpilot_view_context')) : null
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
  const isPremium = plan === 'premium'
  const isPro = plan === 'pro'

  // 100% Real Stats fetched from analytics / gamification (cached in localStorage for instant 0ms load)
  const [realStats, setRealStats] = useState(() => {
    try {
      const cached = localStorage.getItem('careershala_cached_stats')
      if (cached) return JSON.parse(cached)
    } catch {}
    return {
      score: user?.ats_score ?? 0,
      streak: user?.current_streak ?? 0,
      totalChecks: user?.total_ats_checks ?? 0
    }
  })

  // Background refresh to guarantee fresh live data without blocking UI
  useEffect(() => {
    let isMounted = true
    Promise.all([
      getMyAnalytics().catch(() => ({ data: null })),
      getGamificationProfile().catch(() => ({ data: null }))
    ]).then(([analyticsRes, gamiRes]) => {
      if (!isMounted) return
      const a = analyticsRes?.data?.summary
      const g = gamiRes?.data
      const totalChecks = a?.total_ats_checks ?? 0
      const best = a?.best_score ?? user?.ats_score ?? 0
      const normBest = best > 1 ? Math.round(best) : Math.round(best * 100)
      const streakVal = g?.current_streak ?? user?.current_streak ?? 0

      const stats = {
        score: totalChecks > 0 ? normBest : 0,
        streak: streakVal,
        totalChecks: totalChecks
      }
      setRealStats(stats)
      try {
        localStorage.setItem('careershala_cached_stats', JSON.stringify(stats))
      } catch {}
    })
    return () => { isMounted = false }
  }, [user?.id, user?._id])

  const handleNavigate = (path) => {
    onClose?.()
    if (path) navigate(path)
  }

  const handleSwitchContext = () => {
    const nextContext = isCandidateView ? 'employer' : 'candidate'
    localStorage.setItem('careershala_view_context', nextContext)
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

  const displayScore = realStats.totalChecks > 0 ? `${realStats.score}%` : '0%'
  const displayStreak = `${realStats.streak || 0}d`

  return (
    <div className="w-full max-w-[330px] bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.18)] overflow-hidden flex flex-col font-sans border border-slate-200/90 relative z-50">
      
      {/* 1. CLEAN USER IDENTITY HEADER (Pure white, natural, no colored purple coating) */}
      <div className="p-3.5 pb-2 border-b border-slate-100">
        <div 
          onClick={() => handleNavigate('/profile')}
          className="flex items-center gap-3 p-1.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer select-none"
        >
          <DropdownAvatar user={user} />
          
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-slate-900 truncate leading-tight">
                {user?.full_name || 'Rohit Agrawal'}
              </h3>
              <span className={`text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded border ${
                isPremium
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : isPro
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {effectiveRole === 'admin' ? 'Admin' : effectiveRole === 'recruiter' ? 'Recruiter' : isPremium ? 'VIP' : isPro ? 'PRO' : 'FREE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate font-medium mt-0.5">
              {user?.email || 'learner@careershala.ai'}
            </p>
          </div>
          
          <ChevronRight size={14} className="text-slate-300 shrink-0" />
        </div>

        {/* 2. REAL LIVE STATS BAR */}
        {effectiveRole === 'candidate' && (
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-50 border border-slate-100">
            {/* Real ATS Score */}
            <div 
              onClick={() => handleNavigate('/results')}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-white border border-slate-200/60 shadow-2xs cursor-pointer hover:border-indigo-300 transition-colors"
              title="Real ATS Best Score"
            >
              <div className="flex items-center gap-1 text-slate-400">
                <Target size={10} className="text-indigo-600" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Score</span>
              </div>
              <span className="text-[11px] font-black text-slate-900 mt-0.5">{displayScore}</span>
            </div>

            {/* Real Streak */}
            <div 
              onClick={() => handleNavigate('/gamification')}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-white border border-slate-200/60 shadow-2xs cursor-pointer hover:border-orange-300 transition-colors"
              title="Real Daily Streak"
            >
              <div className="flex items-center gap-1 text-slate-400">
                <Flame size={10} className="text-orange-500 fill-orange-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Streak</span>
              </div>
              <span className="text-[11px] font-black text-slate-900 mt-0.5">{displayStreak}</span>
            </div>

            {/* Real Plan */}
            <div 
              onClick={() => handleNavigate('/billing')}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg bg-white border border-slate-200/60 shadow-2xs cursor-pointer hover:border-indigo-300 transition-colors"
              title="Current Subscription Tier"
            >
              <div className="flex items-center gap-1 text-slate-400">
                <Award size={10} className="text-amber-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Plan</span>
              </div>
              <span className={`text-[11px] font-black mt-0.5 ${isPremium ? 'text-amber-600' : isPro ? 'text-indigo-600' : 'text-slate-700'}`}>
                {isPremium ? 'VIP' : isPro ? 'Pro' : 'Free'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. CONTEXT SWITCHER (if dual hat) */}
      {canSwitchContext && (
        <div className="px-3.5 py-1.5 bg-indigo-50/60 border-b border-indigo-100/60 flex items-center justify-between">
          <span className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
            <ArrowLeftRight size={10} className="text-indigo-500" />
            {isCandidateView ? 'Candidate Active' : 'Employer Active'}
          </span>
          <button
            type="button"
            onClick={handleSwitchContext}
            className="px-2 py-0.5 text-[9px] font-extrabold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded shadow-2xs transition-colors cursor-pointer"
          >
            Switch ↗
          </button>
        </div>
      )}

      {/* 4. MODERN 2X2 ACTION TILES */}
      <div className="px-3.5 py-2">
        <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-0.5">
          Learning & Career Hub
        </p>

        {effectiveRole === 'candidate' && (
          <div className="grid grid-cols-2 gap-2">
            
            {/* Tile 1: ATS Matcher */}
            <button
              type="button"
              onClick={() => handleNavigate('/results')}
              className="p-2.5 rounded-2xl bg-slate-50/90 hover:bg-indigo-50/80 border border-slate-200/70 hover:border-indigo-200 text-left transition-all group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200/70 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                  <Target size={14} strokeWidth={2.4} />
                </div>
                <span className="text-[9.5px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                  {displayScore}
                </span>
              </div>
              <p className="text-xs font-extrabold text-slate-800 group-hover:text-indigo-600 truncate leading-tight">
                ATS Scanner
              </p>
              <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                Resume Match
              </p>
            </button>

            {/* Tile 2: Mock Interview */}
            <button
              type="button"
              onClick={() => handleNavigate('/interview')}
              className="p-2.5 rounded-2xl bg-slate-50/90 hover:bg-blue-50/80 border border-slate-200/70 hover:border-blue-200 text-left transition-all group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200/70 flex items-center justify-center text-blue-600 shadow-2xs group-hover:scale-105 transition-transform">
                  <Zap size={14} strokeWidth={2.4} />
                </div>
                <span className="text-[9.5px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60">
                  AI Practice
                </span>
              </div>
              <p className="text-xs font-extrabold text-slate-800 group-hover:text-blue-600 truncate leading-tight">
                Interview
              </p>
              <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                MCQ & Voice
              </p>
            </button>

            {/* Tile 3: Career Quests */}
            <button
              type="button"
              onClick={() => handleNavigate('/gamification')}
              className="p-2.5 rounded-2xl bg-slate-50/90 hover:bg-amber-50/80 border border-slate-200/70 hover:border-amber-200 text-left transition-all group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200/70 flex items-center justify-center text-amber-500 shadow-2xs group-hover:scale-105 transition-transform">
                  <Trophy size={14} strokeWidth={2.4} />
                </div>
                <span className="text-[9.5px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                  XP Hub
                </span>
              </div>
              <p className="text-xs font-extrabold text-slate-800 group-hover:text-amber-600 truncate leading-tight">
                Quests & XP
              </p>
              <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                Badges & Ranks
              </p>
            </button>

            {/* Tile 4: Subscriptions & Credits */}
            <button
              type="button"
              onClick={() => handleNavigate('/billing')}
              className="p-2.5 rounded-2xl bg-slate-50/90 hover:bg-purple-50/80 border border-slate-200/70 hover:border-purple-200 text-left transition-all group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-7 h-7 rounded-xl bg-white border border-slate-200/70 flex items-center justify-center text-purple-600 shadow-2xs group-hover:scale-105 transition-transform">
                  <CreditCard size={14} strokeWidth={2.4} />
                </div>
                <span className={`text-[9.5px] font-black px-1.5 py-0.2 rounded border ${
                  isPremium ? 'text-amber-700 bg-amber-50 border-amber-200' : isPro ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-slate-600 bg-slate-100 border-slate-200'
                }`}>
                  {isPremium ? 'VIP' : isPro ? 'PRO' : 'Upgrade'}
                </span>
              </div>
              <p className="text-xs font-extrabold text-slate-800 group-hover:text-purple-600 truncate leading-tight">
                Subscription
              </p>
              <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                AI Tokens & Plan
              </p>
            </button>

          </div>
        )}

        {/* Recruiter 2x2 Grid */}
        {effectiveRole === 'recruiter' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleNavigate('/recruiter/jobs')}
              className="p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 text-left transition-all group cursor-pointer"
            >
              <Briefcase size={16} className="text-emerald-600 mb-1" />
              <p className="text-xs font-extrabold text-slate-800">Jobs Pipeline</p>
              <p className="text-[10px] text-slate-400">Post & Manage</p>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('/recruiter/company')}
              className="p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 text-left transition-all group cursor-pointer"
            >
              <Building2 size={16} className="text-emerald-600 mb-1" />
              <p className="text-xs font-extrabold text-slate-800">Company Brand</p>
              <p className="text-[10px] text-slate-400">Culture & Logo</p>
            </button>
          </div>
        )}

        {/* Admin 2x2 Grid */}
        {effectiveRole === 'admin' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleNavigate('/admin')}
              className="p-2.5 rounded-2xl bg-slate-50 hover:bg-purple-50 border border-slate-200/70 text-left transition-all group cursor-pointer"
            >
              <Shield size={16} className="text-purple-600 mb-1" />
              <p className="text-xs font-extrabold text-slate-800">Admin Console</p>
              <p className="text-[10px] text-slate-400">Platform KPIs</p>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('/settings')}
              className="p-2.5 rounded-2xl bg-slate-50 hover:bg-purple-50 border border-slate-200/70 text-left transition-all group cursor-pointer"
            >
              <Settings size={16} className="text-purple-600 mb-1" />
              <p className="text-xs font-extrabold text-slate-800">System Config</p>
              <p className="text-[10px] text-slate-400">Security & Keys</p>
            </button>
          </div>
        )}
      </div>

      {/* 5. HORIZONTAL QUICK UTILITIES BAR */}
      <div className="px-3.5 pt-1 pb-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleNavigate('/profile')}
          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-extrabold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 transition-colors cursor-pointer"
        >
          <User size={13} className="text-slate-500" />
          <span>Profile & CV</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('/settings')}
          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-extrabold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200/60 transition-colors cursor-pointer"
        >
          <Settings size={13} className="text-slate-500" />
          <span>Settings</span>
        </button>
      </div>

      {/* 6. CLEAN FOOTER */}
      <div className="px-3.5 py-2 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleNavigate('/support')}
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Globe size={12} className="text-slate-400" />
          <span>Support Desk</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose?.()
            logout?.()
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer select-none"
        >
          <LogOut size={12} strokeWidth={2.4} />
          <span>Sign Out</span>
        </button>
      </div>

    </div>
  )
}

export default memo(ProfilePlanDropdown)