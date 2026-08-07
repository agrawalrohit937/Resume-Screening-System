import { motion } from 'framer-motion'
import { Map, Trophy, Users } from 'lucide-react'

const TABS = [
  { label: 'Path', icon: Map },
  { label: 'Achievements', icon: Trophy },
  { label: 'Leaderboard', icon: Users },
]

export default function SectionTabs({ active, onChange }) {
  return (
    <div className="flex w-full sm:w-auto bg-slate-100/90 p-1.5 rounded-2xl gap-1 border border-slate-200/60 shadow-xs select-none" role="tablist" aria-label="Gamification sections">
      {TABS.map((tab, i) => {
        const Icon = tab.icon
        const isActive = active === i
        return (
          <button
            key={tab.label}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(i)}
            className={`relative flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-2 sm:py-2 rounded-xl text-[11px] sm:text-sm font-bold transition-all touch-manipulation cursor-pointer min-w-0 ${
              isActive ? 'text-blue-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="section-tab-pill"
                className="absolute inset-0 rounded-xl bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="relative z-10 truncate">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
