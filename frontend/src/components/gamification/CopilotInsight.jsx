import { motion } from 'framer-motion'
import { Bot, ArrowRight, Sparkles } from 'lucide-react'
import { nextBadgeHint } from './activityUtils'
import Card from './Card'

function pickMessage(profile, catalog) {
  const hint = nextBadgeHint(profile, catalog)
  if (hint) return `You're at ${hint.progress} toward the "${hint.badge.name}" badge. One AI practice session gets you there.`

  const toNext = profile?.level_info?.points_to_next || 0
  const streak = profile?.current_streak || 0
  const avg = Math.round((profile?.average_score || 0) * 100)

  if (toNext > 0 && toNext <= 200) return `You're only ${toNext} XP away from your next level.`
  if (avg > 0 && avg < 75) return `One strong mock interview could push your average past 75%.`
  if (streak > 0) return `${streak}-day streak going. Practice with AI today to keep it alive.`
  return `No active streak — run a 5-minute AI mock interview to start.`
}

export default function CopilotInsight({ profile, catalog, onOpenCopilot }) {
  const message = pickMessage(profile, catalog)

  return (
    <Card className="p-4 sm:p-5 flex items-center gap-4 sm:gap-5 border-slate-200/80 bg-white shadow-sm rounded-3xl relative overflow-hidden">
      {/* Subtle AI Ambient Glow */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-50/60 rounded-full blur-2xl pointer-events-none" />

      {/* AI Agent Avatar Orb matching LiveInterview */}
      <div className="relative z-10 shrink-0 flex items-center justify-center">
        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 text-white flex items-center justify-center shadow-md border border-indigo-400/30">
          <Bot className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={1.8} />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
          </span>
        </div>
      </div>

      {/* Insight Text */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 mb-1 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          AI Interview Agent • Recommendation
        </p>
        <p className="text-[12.5px] sm:text-[14px] font-bold text-slate-800 leading-snug break-words">
          {message}
        </p>
      </div>

      {/* Action Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onOpenCopilot}
        className="relative z-10 shrink-0 hidden sm:inline-flex h-10 px-5 items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 text-[12.5px] font-bold text-indigo-700 hover:border-indigo-200 hover:bg-indigo-100/60 shadow-sm transition-all cursor-pointer"
      >
        Ask AI Agent <ArrowRight className="w-3.5 h-3.5" />
      </motion.button>
    </Card>
  )
}