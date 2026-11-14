import { memo } from 'react'
import { motion } from 'framer-motion'
import Card from './Card'

const StatBox = memo(function StatBox({ label, value, pct, icon: Icon, colorTheme, delay }) {
  // Executive minimal palette — unified sapphire & slate styling
  const themes = {
    blue: { bg: 'bg-blue-50/80', text: 'text-blue-600', fill: 'bg-blue-600', border: 'border-blue-100' },
    purple: { bg: 'bg-slate-50', text: 'text-slate-700', fill: 'bg-blue-600', border: 'border-slate-200/80' },
    emerald: { bg: 'bg-emerald-50/80', text: 'text-emerald-600', fill: 'bg-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-slate-50', text: 'text-slate-700', fill: 'bg-blue-600', border: 'border-slate-200/80' }
  }
  const theme = themes[colorTheme] || themes.blue

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, type: "spring" }}>
      <Card hover className="p-3.5 sm:p-5 h-full flex flex-col justify-between group border border-slate-200/80 shadow-xs hover:shadow-sm bg-white">
        <div className="flex items-start justify-between mb-2 sm:mb-4">
          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${theme.bg} ${theme.text} border ${theme.border} transition-transform group-hover:scale-105`}>
            <Icon size={18} className="sm:w-5 sm:h-5" strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">{value}</p>
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1 mb-2.5 truncate">{label}</p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: delay + 0.15 }}
               className={`h-full rounded-full ${theme.fill}`} 
             />
          </div>
        </div>
      </Card>
    </motion.div>
  )
})

export default StatBox
