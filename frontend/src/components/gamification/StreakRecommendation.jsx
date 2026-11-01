import { Bot, Flame, Sparkles } from 'lucide-react'

export default function StreakRecommendation({ profile }) {
  const streak = profile?.current_streak || 0
  const nextBadge = streak < 3 ? 'On Fire' : streak < 7 ? 'Week Warrior' : null
  const message = nextBadge
    ? `You're at ${streak}/${
        nextBadge === 'On Fire' ? 3 : 7
      } days toward the "${nextBadge}" badge. One practice session keeps it going.`
    : streak
      ? 'Your practice streak is strong. Keep completing interviews to maintain your momentum.'
      : 'Start a practice streak with one interview today and build your momentum.'

  return (
    <div className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 rounded-2xl border border-indigo-100 bg-white px-3 py-3 sm:px-4 sm:py-3 shadow-sm">
      <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md">
        <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-indigo-600">
          <Sparkles className="w-3 h-3" />
          Practice recommendation
        </p>
        <p className="text-xs sm:text-sm font-bold text-slate-700 leading-snug mt-0.5 line-clamp-2">
          {message}
        </p>
      </div>
      <div className="hidden sm:flex shrink-0 items-center gap-1 rounded-xl bg-orange-50 border border-orange-100 px-2.5 py-2 text-[10px] font-extrabold text-orange-600">
        <Flame className="w-3.5 h-3.5" />
        Keep going
      </div>
    </div>
  )
}
