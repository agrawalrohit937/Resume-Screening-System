import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Flame, Lock, Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { STREAK_MILESTONES } from './mockConfig'
import Card from './Card'

const WEEKDAY_HEADER = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function formatDateKey(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StreakCard({ profile }) {
  const streak = profile?.current_streak || 0
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) || null
  const milestonePct = nextMilestone ? Math.round((streak / nextMilestone) * 100) : 100

  // Current view month state
  const [viewDate, setViewDate] = useState(() => new Date())

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayStr = useMemo(() => formatDateKey(today), [today])

  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleResetToToday = () => {
    setViewDate(new Date())
  }

  const formattedMonthName = useMemo(() => {
    return viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [viewDate])

  // Build Monthly Calendar Grid (with proper day-of-week alignment)
  const { paddingCells, monthDays, totalMonthActiveDays } = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // 0 = Mon, 1 = Tue, 2 = Wed, 3 = Thu, 4 = Fri, 5 = Sat, 6 = Sun
    const startWeekday = (firstDay.getDay() + 6) % 7

    // Active dates set from profile or constructed fallback
    const activeDateSet = new Set(
      profile?.active_dates && Array.isArray(profile.active_dates)
        ? profile.active_dates
        : []
    )

    if (!profile?.active_dates || !Array.isArray(profile.active_dates) || profile.active_dates.length === 0) {
      if (streak > 0) {
        // Mark actual consecutive days of current streak ending today or yesterday
        const lastPracticeStr = profile?.last_practice_date ? String(profile.last_practice_date).slice(0, 10) : ''
        const endOffset = (lastPracticeStr && lastPracticeStr !== todayStr) ? 1 : 0
        for (let i = 0; i < streak; i++) {
          const d = new Date(today)
          d.setDate(today.getDate() - (i + endOffset))
          activeDateSet.add(formatDateKey(d))
        }
      }
    }

    const padding = Array.from({ length: startWeekday }, (_, i) => i)
    const days = []
    let activeCount = 0

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum)
      d.setHours(0, 0, 0, 0)
      const dStr = formatDateKey(d)

      const isToday = dStr === todayStr
      const isPast = d < today
      const isFuture = d > today
      const isFilled = activeDateSet.has(dStr)

      if (isFilled && !isFuture) {
        activeCount++
      }

      days.push({
        dayNum,
        date: d,
        dateStr: dStr,
        formatted: formatShortDate(d),
        isToday,
        isPast,
        isFuture,
        isFilled: isFilled && !isFuture,
      })
    }

    return { paddingCells: padding, monthDays: days, totalMonthActiveDays: activeCount }
  }, [viewDate, profile, streak, today, todayStr])

  return (
    <Card className="p-6 sm:p-8 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Stat & Title */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <motion.div 
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-[0_8px_15px_rgba(249,115,22,0.3)] shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)] border-2 border-white shrink-0"
          >
            <Flame className="w-7 h-7 text-white drop-shadow-md" />
          </motion.div>
          <div>
            <p className="font-extrabold text-3xl text-slate-800 leading-none tracking-tight flex items-baseline gap-2">
              {streak} <span className="text-lg font-bold text-slate-500">Day{streak === 1 ? '' : 's'}</span>
            </p>
            <p className="text-xs font-bold text-orange-500 mt-1 uppercase tracking-wider">Current Streak</p>
          </div>
        </div>

        {/* Monthly Active Days Badge */}
        <div className="flex flex-col items-end">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-extrabold shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            <span>{totalMonthActiveDays} Days Active</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-1">In {formattedMonthName.split(' ')[0]}</span>
        </div>
      </div>

      {/* Real Monthly Calendar View */}
      <div className="mb-6 relative z-10 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-100">
        {/* Month Navigation Control Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60">
          <h4 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-2">
            <span>{formattedMonthName}</span>
          </h4>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetToToday}
              title="Jump to Today"
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors mr-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Column Headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
          {WEEKDAY_HEADER.map((d, i) => (
            <span key={i} className="text-[10px] font-black uppercase text-slate-400">
              {d}
            </span>
          ))}
        </div>

        {/* Dynamic Month Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* Empty Start Padding Slots */}
          {paddingCells.map((padIdx) => (
            <div key={`pad-${padIdx}`} className="aspect-square rounded-lg bg-transparent pointer-events-none" />
          ))}

          {/* Month Day Slots */}
          {monthDays.map((day) => {
            let statusTooltip = `${day.formatted}: `
            if (day.isToday) statusTooltip += 'Today (Active Goal)'
            else if (day.isFilled) statusTooltip += 'Practiced 🔥'
            else if (day.isPast) statusTooltip += 'Missed ⬜'
            else statusTooltip += 'Locked 🔒'

            return (
              <div
                key={day.dateStr}
                title={statusTooltip}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-300 relative cursor-pointer group ${
                  day.isToday
                    ? 'ring-2 ring-orange-500 ring-offset-1 scale-105 z-10 shadow-md bg-orange-50'
                    : ''
                } ${
                  day.isFilled
                    ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm border border-orange-300 hover:scale-110'
                    : day.isFuture
                      ? 'bg-slate-100/40 border border-slate-200/30 opacity-40'
                      : 'bg-slate-200/50 border border-slate-200/70 shadow-inner hover:border-slate-300'
                }`}
              >
                <span className={`text-[10px] font-black leading-none ${
                  day.isFilled ? 'text-white' : day.isToday ? 'text-orange-600 font-extrabold' : 'text-slate-500'
                }`}>
                  {day.dayNum}
                </span>

                <div className="mt-0.5">
                  {day.isFilled ? (
                    <Flame className="w-3 h-3 text-white drop-shadow-sm" />
                  ) : day.isFuture ? (
                    <Lock className="w-2.5 h-2.5 text-slate-300" />
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-slate-300 block" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-4 pt-3 border-t border-slate-200/60">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-orange-400 to-red-500" /> Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Missed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-orange-500 bg-orange-50" /> Today
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-slate-300" /> Future
          </span>
        </div>
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