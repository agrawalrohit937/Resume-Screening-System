import { motion } from 'framer-motion'
import { Flame, Medal, TrendingUp, Sparkles } from 'lucide-react'
import { deriveLeagueName } from './mockConfig'
import Card from './Card'

function StatChip({ icon: Icon, value, label, color }) {
  const colorStyles = {
    orange: 'text-orange-600 bg-orange-100 border-orange-200',
    blue: 'text-blue-600 bg-blue-100 border-blue-200',
    purple: 'text-purple-600 bg-purple-100 border-purple-200'
  }
  const activeColor = colorStyles[color] || colorStyles.blue

  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.02 }}
      className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white rounded-2xl px-4 py-3 shadow-[0_4px_15px_rgba(0,0,0,0.03)]"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${activeColor}`}>
        <Icon className="w-5 h-5 drop-shadow-sm" />
      </div>
      <div className="leading-tight">
        <p className="text-lg font-black text-slate-800">{value}</p>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
    </motion.div>
  )
}

export default function ProfileHero({ profile, name, badgeCount }) {
  const level = profile?.level_info?.level || 1
  const levelName = profile?.level_info?.name || 'Beginner'
  const totalPoints = profile?.total_points || 0
  const progressPct = profile?.level_info?.progress_pct || 0
  const pointsToNext = profile?.level_info?.points_to_next || 0
  const streak = profile?.current_streak || 0
  const avgPct = Math.round((profile?.average_score || 0) * 100)
  const league = deriveLeagueName(profile)

  return (
    <Card className="p-0 overflow-hidden relative">
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 opacity-80" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      <Sparkles className="absolute top-6 right-10 w-20 h-20 text-indigo-200/50 rotate-12" />

      <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-8">
        
        {/* User Badge & Info */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="relative w-20 h-20 shrink-0">
            <motion.div 
              initial={{ scale: 0.8, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}
              className="w-full h-full rounded-[2rem] bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-[0_10px_25px_rgba(79,70,229,0.4)] shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)] border-4 border-white"
            >
              <span className="font-display font-black text-3xl text-white drop-shadow-md">{level}</span>
            </motion.div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 border-2 border-white flex items-center justify-center shadow-lg">
              <Medal className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5 border border-indigo-200">
              <Sparkles className="w-3 h-3" />
              Level {level} · {league}
            </div>
            <h1 className="font-extrabold text-3xl text-slate-800 leading-tight truncate tracking-tight">
              {name ? name : levelName}
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1">{levelName} Rank</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 min-w-[200px] bg-white/50 backdrop-blur-sm p-4 rounded-3xl border border-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-extrabold text-slate-700">{totalPoints.toLocaleString()} XP</span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
              {pointsToNext > 0 ? `${pointsToNext.toLocaleString()} XP to next` : 'MAX LEVEL'}
            </span>
          </div>
          <div className="h-3.5 rounded-full bg-slate-200/50 overflow-hidden shadow-inner relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, progressPct)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 relative"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Glassmorphism Stat Chips */}
      <div className="relative z-10 px-6 sm:px-8 pb-6 sm:pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatChip icon={Flame} value={streak} label="Day Streak" color="orange" />
          <StatChip icon={TrendingUp} value={`${avgPct}%`} label="Avg Score" color="blue" />
          <StatChip icon={Medal} value={badgeCount} label="Badges Won" color="purple" />
        </div>
      </div>
    </Card>
  )
}