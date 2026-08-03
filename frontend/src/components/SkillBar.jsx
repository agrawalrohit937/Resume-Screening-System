import { memo } from 'react'
import { motion } from 'framer-motion'

const SkillBar = memo(function SkillBar({ label, pct, color }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className="text-xs font-bold text-slate-400">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} transition={{ duration: 1 }} viewport={{ once: true }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  )
})

export default SkillBar
