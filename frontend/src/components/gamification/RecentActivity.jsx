import { motion } from 'framer-motion'
import { Clock, Zap, Star } from 'lucide-react'
import { describeEvent } from './activityUtils'
import Card from './Card'

export default function RecentActivity({ recentPoints = [], catalog }) {
  const items = [...recentPoints].reverse().slice(0, 4)

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-extrabold text-xl text-slate-800 tracking-tight flex items-center gap-2">
          Recent XP
        </h3>
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
          <Clock className="w-4 h-4 text-blue-500" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Star className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">No activity yet</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Start practicing to earn XP!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, type: 'spring' }}
              whileHover={{ scale: 1.02, x: 4 }}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-default"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] shadow-sm">
                  <Zap className="w-5 h-5 drop-shadow-sm" />
                </div>
                <p className="text-sm font-bold text-slate-700 truncate">{describeEvent(item.event, catalog)}</p>
              </div>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shrink-0 shadow-sm">
                +{item.points} XP
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  )
}