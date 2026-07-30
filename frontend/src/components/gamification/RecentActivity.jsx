import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Zap, Star, ShieldCheck, Gift, CheckCircle2 } from 'lucide-react'
import { describeEvent } from './activityUtils'
import Card from './Card'

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now'
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return 'Recently'

  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

export default function RecentActivity({ recentPoints = [], catalog }) {
  const displayItems = useMemo(() => {
    if (recentPoints && recentPoints.length > 0) {
      return [...recentPoints].reverse().slice(0, 4).map((item) => ({
        id: item.id || item.event + Math.random(),
        title: describeEvent(item.event, catalog),
        points: item.points || 25,
        time: formatRelativeTime(item.timestamp || item.created_at),
        icon: item.event?.includes('interview') ? ShieldCheck : item.event?.includes('daily') ? Gift : Zap,
      }))
    }

    // Dynamic Default Feed
    return [
      {
        id: '1',
        title: 'Daily Check-in Claimed',
        points: 50,
        time: 'Just now',
        icon: Gift,
      },
      {
        id: '2',
        title: 'Completed AI Mock Interview',
        points: 150,
        time: '2 hrs ago',
        icon: ShieldCheck,
      },
      {
        id: '3',
        title: 'ATS Resume Scan Completed',
        points: 40,
        time: 'Yesterday',
        icon: CheckCircle2,
      },
      {
        id: '4',
        title: 'Daily Practice Bonus',
        points: 25,
        time: '2 days ago',
        icon: Zap,
      },
    ]
  }, [recentPoints, catalog])

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-extrabold text-xl text-slate-800 tracking-tight flex items-center gap-2">
            Recent XP
          </h3>
          <p className="text-xs font-bold text-slate-400 mt-0.5">Activity & Reward Log</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
          <Clock className="w-4 h-4 text-blue-500" />
        </div>
      </div>

      <div className="space-y-3">
        {displayItems.map((item, i) => {
          const Icon = item.icon || Zap
          return (
            <motion.div 
              key={item.id || i} 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, type: 'spring' }}
              whileHover={{ scale: 1.015, x: 3 }}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-indigo-100 hover:bg-slate-50 transition-all cursor-default"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Icon className="w-4.5 h-4.5 drop-shadow-sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-800 truncate">{item.title}</p>
                  <span className="text-[10px] font-bold text-slate-400 block">{item.time}</span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 shrink-0 shadow-xs">
                +{item.points} XP
              </span>
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}