import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crosshair, Zap, BookOpen, Flame, ShieldCheck, Check, Loader, Star, Sparkles, ArrowRight } from 'lucide-react'
import { getDailyMissions } from '../../services/interviewApi'
import Card from './Card'

// Gamified icons mapped to clean executive slate & brand blue palette
const ICON_STYLES = {
  Target: { icon: Crosshair, bg: 'bg-[#2E9BDA]', shadow: 'shadow-sm' },
  TrendingUp: { icon: Zap, bg: 'bg-amber-500', shadow: 'shadow-sm' },
  BookOpen: { icon: BookOpen, bg: 'bg-blue-600', shadow: 'shadow-sm' },
  Flame: { icon: Flame, bg: 'bg-amber-600', shadow: 'shadow-sm' },
  ShieldCheck: { icon: ShieldCheck, bg: 'bg-indigo-600', shadow: 'shadow-sm' },
}

function resolveMissionAction(mission) {
  if (mission.actionUrl) {
    return { url: mission.actionUrl, label: mission.actionLabel || 'Start Now' }
  }

  const titleLower = (mission.title || '').toLowerCase()
  const idLower = (mission.id || '').toLowerCase()

  if (titleLower.includes('mock') || titleLower.includes('live') || titleLower.includes('session') || idLower.includes('flawless')) {
    return { url: '/live-interview', label: 'Start Mock' }
  }
  if (titleLower.includes('ats') || titleLower.includes('resume') || titleLower.includes('score')) {
    return { url: '/apply-assistant', label: 'Check Resume' }
  }
  if (titleLower.includes('streak') || titleLower.includes('question') || titleLower.includes('practice') || idLower.includes('streak')) {
    return { url: '/interview', label: 'Practice Now' }
  }
  return { url: '/interview', label: 'Start Quest' }
}

function MissionRow({ mission, index }) {
  const navigate = useNavigate()
  const IconData = ICON_STYLES[mission.icon] || { icon: Star, bg: 'bg-[#2E9BDA]', shadow: 'shadow-sm' }
  const Icon = IconData.icon
  
  const pct = mission.target > 0 ? Math.min(100, Math.round((mission.progress / mission.target) * 100)) : 0
  const complete = mission.completed || mission.progress >= mission.target
  const action = resolveMissionAction(mission)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -1 }}
      onClick={() => navigate(action.url)}
      className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
        complete 
          ? 'bg-slate-50/60 border-slate-200/60 shadow-none opacity-80' 
          : 'bg-white border-slate-200/80 shadow-sm hover:border-[#2E9BDA]/40'
      }`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Clean Icon Badge */}
        <div className="relative shrink-0">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white border transition-all ${
            complete 
              ? 'bg-slate-100 text-slate-400 border-slate-200' 
              : `${IconData.bg} border-white/20 shadow-sm`
          }`}>
            {complete ? <Check className="w-5 h-5 text-slate-400 stroke-[2.5]" /> : <Icon className="w-5 h-5 text-white" />}
          </div>
        </div>

        {/* Mission Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <p className={`text-[13.5px] font-bold truncate transition-colors ${complete ? 'text-slate-400' : 'text-slate-900'}`}>
              {mission.title}
            </p>
            
            {/* XP Tag */}
            <div className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10.5px] font-extrabold uppercase tracking-wider border ${
              complete 
                ? 'bg-slate-100 text-slate-400 border-slate-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200/80'
            }`}>
              +{mission.xp} XP
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${complete ? 'bg-slate-300' : 'bg-[#2E9BDA]'}`}
              />
            </div>
            <span className={`text-[10.5px] font-bold w-8 text-right ${complete ? 'text-slate-400' : 'text-slate-500'}`}>
              {mission.progress}/{mission.target}
            </span>
          </div>
        </div>
      </div>

      {/* Action CTA Button */}
      <div className="shrink-0 flex items-center justify-end">
        {complete ? (
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm">
            <Check className="w-3.5 h-3.5" /> Done
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(action.url)
            }}
            className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-[#2E9BDA] hover:border-[#2E9BDA] hover:text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm transition-all duration-200"
          >
            {action.label} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-3 mb-3.5 mt-5 first:mt-0">
      <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-[#1d6fa5] bg-white pr-2 relative z-10">
        {title}
      </h4>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  )
}

export default function MissionList({ profile }) {
  const [missions, setMissions] = useState({ daily: [], weekly: [], special: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMissions()
  }, [])

  async function loadMissions() {
    setLoading(true)
    try {
      const res = await getDailyMissions()
      const dailyMissions = res.data?.missions || []
      
      setMissions({
        daily: dailyMissions,
        weekly: [
          { id: 'streak-guardian', title: 'Keep your streak alive for 7 days', icon: 'Flame', target: 7, xp: 150, progress: profile?.current_streak || 0, completed: (profile?.current_streak || 0) >= 7 },
        ],
        special: [
          { id: 'flawless-run', title: 'Log 3 clean interview sessions', icon: 'ShieldCheck', target: 3, xp: 200, progress: profile?.clean_sessions || 0, completed: (profile?.clean_sessions || 0) >= 3 },
        ],
      })
    } catch (err) {
      console.error('Failed to load missions:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6 h-full flex flex-col items-center justify-center min-h-[400px] border border-slate-200/80 shadow-sm bg-white rounded-3xl">
        <Loader className="w-7 h-7 text-[#2E9BDA] animate-spin mb-3" />
        <p className="text-[13px] font-bold text-slate-400">Loading Quests...</p>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden border border-slate-200/80 shadow-sm rounded-3xl bg-white">
      {/* Quest Log Header */}
      <div className="p-6 sm:p-7 bg-slate-50/70 border-b border-slate-200/60 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="font-extrabold text-[22px] text-slate-900 tracking-tight flex items-center gap-2">
            Quest Log
          </h3>
          <p className="text-[13px] font-medium text-slate-500 mt-1">Complete objectives to earn XP</p>
        </div>
      </div>

      {/* Scrollable Missions Area */}
      <div className="p-6 sm:p-7 flex-1 overflow-y-auto space-y-2">
        <SectionHeader title="Daily Quests" />
        {missions.daily.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200/60 border-dashed rounded-2xl p-6 text-center shadow-sm">
             <p className="text-[13px] font-medium text-slate-400">No daily missions available today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {missions.daily.map((m, i) => <MissionRow key={m.id} mission={m} index={i} />)}
          </div>
        )}

        <SectionHeader title="Weekly Challenge" />
        <div className="space-y-3">
          {missions.weekly.map((m, i) => <MissionRow key={m.id} mission={m} index={i} />)}
        </div>

        <SectionHeader title="Special Operations" />
        <div className="space-y-3">
          {missions.special.map((m, i) => <MissionRow key={m.id} mission={m} index={i} />)}
        </div>
      </div>
    </Card>
  )
}