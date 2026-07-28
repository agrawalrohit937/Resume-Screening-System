import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { STREAK_MILESTONES } from './mockConfig'
import Card from './Card'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function StreakCard({ profile }) {
  const streak = profile?.current_streak || 0
  const filled = Math.min(streak, 7)
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) || null
  const milestonePct = nextMilestone ? Math.round((streak / nextMilestone) * 100) : 100

  return (
    <Card className="p-6 sm:p-8 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-4 mb-6 relative z-10">
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-[0_8px_15px_rgba(249,115,22,0.3)] shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)] border-2 border-white"
        >
          <Flame className="w-7 h-7 text-white drop-shadow-md" />
        </motion.div>
        <div>
          <p className="font-extrabold text-3xl text-slate-800 leading-none tracking-tight">
            {streak} <span className="text-lg text-slate-500">Day{streak === 1 ? '' : 's'}</span>
          </p>
          <p className="text-xs font-bold text-orange-500 mt-1 uppercase tracking-wider">Current Streak</p>
        </div>
      </div>

      {/* 3D Day Blocks */}
      <div className="flex gap-2 mb-6 relative z-10">
        {DAY_LABELS.map((d, i) => {
          const isFilled = i < filled;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isFilled 
                    ? 'bg-gradient-to-b from-orange-400 to-red-500 shadow-[inset_0_-3px_4px_rgba(0,0,0,0.2)] shadow-md border border-orange-300' 
                    : 'bg-slate-50 border-2 border-slate-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]'
                }`}
              >
                {isFilled && <Flame className="w-4 h-4 text-white drop-shadow-sm" />}
              </div>
              <span className={`text-[10px] font-black uppercase ${isFilled ? 'text-orange-500' : 'text-slate-400'}`}>{d}</span>
            </div>
          )
        })}
      </div>

      {/* Milestone Progress */}
      <div className="relative z-10 bg-slate-50 rounded-2xl p-4 border border-slate-100">
        {nextMilestone ? (
          <>
            <div className="flex justify-between text-xs font-extrabold text-slate-500 mb-2">
              <span>Next Milestone</span>
              <span className="text-slate-800">{streak} / {nextMilestone} Days</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${milestonePct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-orange-400 via-red-500 to-rose-500 relative"
              >
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              </motion.div>
            </div>
          </>
        ) : (
          <p className="text-xs font-bold text-orange-500 text-center py-2">🔥 All milestones reached! Legendary! 🔥</p>
        )}
      </div>
    </Card>
  )
}