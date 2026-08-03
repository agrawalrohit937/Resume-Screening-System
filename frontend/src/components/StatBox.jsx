import { memo } from 'react'
import { motion } from 'framer-motion'
import Card from './Card'

const StatBox = memo(function StatBox({ label, value, pct, icon: Icon, colorTheme, delay }) {
  const themes = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', fill: 'bg-blue-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', fill: 'bg-purple-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', fill: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', fill: 'bg-amber-500' }
  }
  const theme = themes[colorTheme] || themes.blue

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, type: "spring" }}>
      <Card hover className="p-5 h-full flex flex-col justify-between group">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme.bg} ${theme.text} transition-transform group-hover:scale-110`}>
            <Icon size={22} strokeWidth={2.5} />
          </div>
        </div>
        <div>
          <p className="text-3xl font-black text-slate-900 font-display tracking-tight">{value}</p>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mt-1 mb-3">{label}</p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: delay + 0.2 }}
               className={`h-full rounded-full ${theme.fill}`} 
             />
          </div>
        </div>
      </Card>
    </motion.div>
  )
})

export default StatBox
