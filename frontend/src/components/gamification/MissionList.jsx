import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crosshair, Zap, BookOpen, Flame, ShieldCheck, Check, Loader, Star, Sparkles, ArrowRight } from 'lucide-react'
import { getDailyMissions } from '../../services/interviewApi'
import Card from './Card'

// Upgraded gamified icons mapped to specific 3D styles
const ICON_STYLES = {
  Target: { icon: Crosshair, bg: 'from-fuchsia-400 to-purple-500', shadow: 'shadow-purple-300/50' },
  TrendingUp: { icon: Zap, bg: 'from-amber-300 to-orange-500', shadow: 'shadow-orange-300/50' },
  BookOpen: { icon: BookOpen, bg: 'from-cyan-400 to-blue-500', shadow: 'shadow-blue-300/50' },
  Flame: { icon: Flame, bg: 'from-orange-400 to-red-500', shadow: 'shadow-red-300/50' },
  ShieldCheck: { icon: ShieldCheck, bg: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-300/50' },
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
  const IconData = ICON_STYLES[mission.icon] || { icon: Star, bg: 'from-blue-400 to-indigo-500', shadow: 'shadow-blue-300/50' }
  const Icon = IconData.icon
  
  const pct = mission.target > 0 ? Math.min(100, Math.round((mission.progress / mission.target) * 100)) : 0
  const complete = mission.completed || mission.progress >= mission.target
  const action = resolveMissionAction(mission)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, type: 'spring', bounce: 0.4 }}
      whileHover={{ scale: 1.015 }}
      onClick={() => navigate(action.url)}
      className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border cursor-pointer group transition-all duration-300 ${
        complete 
          ? 'bg-slate-50/80 border-slate-200' 
          : 'bg-white border-slate-100 shadow-[0_4px_15px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgb(0,0,0,0.06)] hover:border-indigo-200'
      }`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* 3D Orb Icon */}
        <div className="relative shrink-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 relative transition-all duration-300 ${
            complete 
              ? 'bg-slate-200 border-white shadow-inner grayscale' 
              : `bg-gradient-to-br ${IconData.bg} border-white shadow-lg ${IconData.shadow} shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)]`
          }`}>
            {complete ? <Check className="w-6 h-6 text-slate-400 stroke-[3]" /> : <Icon className="w-5 h-5 text-white drop-shadow-md" />}
          </div>
          
          {/* Glow effect for active missions */}
          {!complete && (
            <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${IconData.bg} blur-md opacity-40 -z-10`} />
          )}
        </div>

        {/* Mission Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className={`text-[14px] font-extrabold truncate group-hover:text-indigo-600 transition-colors ${complete ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
              {mission.title}
            </p>
            
            {/* Premium XP Tag */}
            <div className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider border shadow-sm ${
              complete 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                : 'bg-gradient-to-b from-amber-100 to-orange-100 text-orange-600 border-orange-200'
            }`}>
              +{mission.xp} XP
            </div>
          </div>

          {/* Thick Progress Bar */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden shadow-inner relative">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                className={`h-full rounded-full relative ${complete ? 'bg-slate-300' : 'bg-gradient-to-r from-blue-400 to-purple-500'}`}
              >
                {!complete && (
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                )}
              </motion.div>
            </div>
            <span className={`text-[11px] font-bold w-8 text-right ${complete ? 'text-slate-400' : 'text-slate-500'}`}>
              {mission.progress}/{mission.target}
            </span>
          </div>
        </div>
      </div>

      {/* Action CTA Button */}
      <div className="shrink-0 flex items-center justify-end">
        {complete ? (
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-extrabold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Done
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(action.url)
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all duration-200 group-hover:scale-105"
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
    <div className="flex items-center gap-3 mb-4 mt-6 first:mt-0">
      <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 bg-white pr-2 relative z-10">
        {title}
      </h4>
      <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
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
      <Card className="p-6 h-full flex flex-col items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400">Loading Quests...</p>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden">
      {/* Quest Log Header */}
      <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 relative overflow-hidden">
        <Sparkles className="absolute -top-4 -right-4 w-24 h-24 text-slate-100 rotate-12" />
        <div className="relative z-10">
          <h3 className="font-extrabold text-2xl text-slate-800 tracking-tight flex items-center gap-2">
            Quest Log
          </h3>
          <p className="text-sm font-medium text-slate-500 mt-1">Complete objectives to earn massive XP</p>
        </div>
      </div>

      {/* Scrollable Missions Area */}
      <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-2">
        <SectionHeader title="Daily Quests" />
        {missions.daily.length === 0 ? (
          <div className="bg-slate-50 border border-slate-100 border-dashed rounded-2xl p-6 text-center">
             <p className="text-sm font-bold text-slate-500">No daily missions available today.</p>
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