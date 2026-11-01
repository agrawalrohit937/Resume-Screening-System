import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Flame, Lock, Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { STREAK_MILESTONES } from './mockConfig'
import Card from '../Card'

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
  const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone > streak) || null
  const milestonePct = nextMilestone ? Math.round((streak / nextMilestone) * 100) : 100
  const [viewDate, setViewDate] = useState(() => new Date())

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const todayStr = useMemo(() => formatDateKey(today), [today])

  const { paddingCells, monthDays, totalMonthActiveDays } = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startWeekday = (firstDay.getDay() + 6) % 7
    const activeDateSet = new Set(
      Array.isArray(profile?.active_dates)
        ? profile.active_dates.map((date) => String(date).slice(0, 10))
        : []
    )

    if (!activeDateSet.size && streak > 0) {
      const lastPractice = profile?.last_practice_date
        ? String(profile.last_practice_date).slice(0, 10)
        : ''
      const endOffset = lastPractice && lastPractice !== todayStr ? 1 : 0
      for (let index = 0; index < streak; index += 1) {
        const date = new Date(today)
        date.setDate(today.getDate() - (index + endOffset))
        activeDateSet.add(formatDateKey(date))
      }
    }

    const days = []
    let activeCount = 0
    for (let dayNumber = 1; dayNumber <= lastDay.getDate(); dayNumber += 1) {
      const date = new Date(year, month, dayNumber)
      date.setHours(0, 0, 0, 0)
      const dateStr = formatDateKey(date)
      const isToday = dateStr === todayStr
      const isFuture = date > today
      const isFilled = activeDateSet.has(dateStr) && !isFuture
      if (isFilled) activeCount += 1
      days.push({
        dayNumber,
        dateStr,
        formatted: formatShortDate(date),
        isToday,
        isFuture,
        isPast: date < today,
        isFilled,
      })
    }

    return {
      paddingCells: Array.from({ length: startWeekday }, (_, index) => index),
      monthDays: days,
      totalMonthActiveDays: activeCount,
    }
  }, [profile?.active_dates, profile?.last_practice_date, streak, today, todayStr, viewDate])

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <Card className="p-6 sm:p-8 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
        <div className="flex flex-col items-end">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-extrabold shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            <span>{totalMonthActiveDays} Days Active</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-1">In {monthName.split(' ')[0]}</span>
        </div>
      </div>

      <div className="mb-6 relative z-10 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60">
          <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">{monthName}</h4>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setViewDate(new Date())} title="Jump to Today" className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors mr-1">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setViewDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} title="Previous Month" className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setViewDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} title="Next Month" className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
          {WEEKDAY_HEADER.map((day, index) => <span key={`${day}-${index}`} className="text-[10px] font-black uppercase text-slate-400">{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {paddingCells.map((index) => <div key={`padding-${index}`} className="aspect-square rounded-lg" />)}
          {monthDays.map((day) => (
            <div
              key={day.dateStr}
              title={`${day.formatted}: ${day.isToday ? 'Today' : day.isFilled ? 'Practiced' : day.isFuture ? 'Locked' : 'Missed'}`}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-300 relative cursor-pointer group ${
                day.isToday
                  ? 'ring-2 ring-orange-500 ring-offset-1 scale-105 z-10 shadow-md bg-gradient-to-br from-orange-400 to-red-500 text-white'
                  : day.isFilled
                    ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm border border-orange-300 hover:scale-110'
                    : day.isFuture
                      ? 'bg-slate-100/40 border border-slate-200/30 opacity-45'
                      : 'bg-slate-200/50 border border-slate-200/70 shadow-inner hover:border-slate-300'
              }`}
            >
              <span className={`text-[10px] font-black leading-none ${day.isToday || day.isFilled ? 'text-white' : 'text-slate-500'}`}>{day.dayNumber}</span>
              <div className="mt-0.5">
                {day.isToday || day.isFilled ? <Flame className="w-3 h-3 text-white drop-shadow-sm" /> : day.isFuture ? <Lock className="w-2.5 h-2.5 text-slate-300" /> : <span className="w-1 h-1 rounded-full bg-slate-300 block" />}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-4 pt-3 border-t border-slate-200/60">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-red-500" /> Active</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" /> Missed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-orange-500 bg-orange-50" /> Today</span>
          <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5 text-slate-300" /> Future</span>
        </div>
      </div>

      <div className="relative z-10 bg-slate-50 rounded-2xl p-4 border border-slate-100">
        {nextMilestone ? (
          <>
            <div className="flex justify-between text-xs font-extrabold text-slate-500 mb-2">
              <span>Next Milestone</span>
              <span className="text-slate-800">{streak} / {nextMilestone} Days</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden shadow-inner">
              <motion.div initial={{ width: 0 }} whileInView={{ width: `${milestonePct}%` }} viewport={{ once: true }} transition={{ duration: 1 }} className="h-full rounded-full bg-gradient-to-r from-orange-400 via-red-500 to-rose-500" />
            </div>
          </>
        ) : (
          <p className="text-xs font-bold text-orange-500 text-center py-1">All milestones reached!</p>
        )}
      </div>
    </Card>
  )
}
