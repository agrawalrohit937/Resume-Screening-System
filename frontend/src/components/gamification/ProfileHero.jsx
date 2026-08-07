import { motion } from 'framer-motion'
import { Flame, Medal, TrendingUp, Sparkles, Trophy } from 'lucide-react'
import { deriveLeagueName } from './mockConfig'
import Card from './Card'

function StatChip({ icon: Icon, value, label, color }) {
  const colorStyles = {
    amber: 'text-amber-600 bg-amber-50/60 border-amber-200/60',
    blue: 'text-[#1d6fa5] bg-blue-50/60 border-blue-200/60',
    slate: 'text-slate-700 bg-slate-100/70 border-slate-200/70'
  }
  const activeColor = colorStyles[color] || colorStyles.blue

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="flex items-center gap-2 sm:gap-3 bg-white border border-slate-200/70 rounded-xl sm:rounded-2xl px-2.5 py-2.5 sm:px-4 sm:py-3 shadow-sm min-w-0"
    >
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center border shrink-0 ${activeColor}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="leading-tight min-w-0 flex-1">
        <p className="text-sm sm:text-[19px] font-black text-slate-900 truncate">{value}</p>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 truncate">{label}</p>
      </div>
    </motion.div>
  )
}

export default function ProfileHero({ profile, name, badgeCount, leaderboard = [], currentUserId }) {
  const level = profile?.level_info?.level || 1
  const levelName = profile?.level_info?.name || 'Beginner'
  const totalPoints = profile?.total_points || 0
  const progressPct = profile?.level_info?.progress_pct || 0
  const pointsToNext = profile?.level_info?.points_to_next || 0
  const streak = profile?.current_streak || 0
  const avgPct = Math.round((profile?.average_score || 0) * 100)
  const league = deriveLeagueName(profile)

  const myEntry = leaderboard.find((e) => e.user_id === currentUserId || e.user_id === profile?.user_id)
  const userRank = profile?.rank || myEntry?.rank || (totalPoints > 0 ? 1 : '-')

  return (
    <Card className="p-0 overflow-hidden relative border border-slate-200/80 shadow-sm rounded-3xl bg-white">
      {/* Subtle Ambient Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-slate-50/80 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-4 sm:p-7 flex flex-col md:flex-row md:items-center gap-5 sm:gap-8">
        
        {/* User Badge & Profile Overview */}
        <div className="flex items-center gap-4 sm:gap-5 shrink-0 min-w-0">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
            <div className="w-full h-full rounded-2xl bg-[#0f172a] text-white flex items-center justify-center shadow-md border border-slate-700">
              <span className={`font-black ${String(userRank).length > 2 ? 'text-lg sm:text-xl' : 'text-xl sm:text-3xl'} text-white`}>
                #{userRank}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-sm">
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
            </div>
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider mb-1 border border-slate-200 max-w-full truncate">
              <Sparkles className="w-3 h-3 text-[#2E9BDA] shrink-0" />
              Level {level} • {league}
            </div>
            <h1 className="font-extrabold text-xl sm:text-3xl text-slate-900 leading-tight truncate tracking-tight">
              {name ? name : levelName}
            </h1>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 sm:px-2.5 rounded-lg border border-amber-200/70">
                Rank #{userRank}
              </span>
              <span className="text-[11px] sm:text-[12.5px] font-medium text-slate-500">• {levelName} Tier</span>
            </div>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="flex-1 min-w-0 bg-slate-50/80 p-3.5 sm:p-5 rounded-2xl border border-slate-200/60">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <span className="text-xs sm:text-[13.5px] font-extrabold text-slate-900">{totalPoints.toLocaleString()} XP</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-[#1d6fa5] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 uppercase tracking-wide truncate max-w-full">
              {pointsToNext > 0 ? `${pointsToNext.toLocaleString()} XP to next level` : 'MAX LEVEL'}
            </span>
          </div>
          <div className="h-2 sm:h-2.5 rounded-full bg-slate-200/70 overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, progressPct)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full bg-[#2E9BDA]"
            />
          </div>
        </div>
      </div>

      {/* Stat Chips Overview */}
      <div className="relative z-10 px-4 sm:px-7 pb-4 sm:pb-7">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatChip icon={Trophy} value={`#${userRank}`} label="Global Rank" color="amber" />
          <StatChip icon={Flame} value={streak} label="Day Streak" color="amber" />
          <StatChip icon={TrendingUp} value={`${avgPct}%`} label="Avg Score" color="blue" />
          <StatChip icon={Medal} value={badgeCount} label="Badges Won" color="slate" />
        </div>
      </div>
    </Card>
  )
}