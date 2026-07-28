import { motion } from 'framer-motion'
import { Map, Trophy, Users } from 'lucide-react'

const TABS = [
  { label: 'Path', icon: Map },
  { label: 'Achievements', icon: Trophy },
  { label: 'Leaderboard', icon: Users },
]

export default function SectionTabs({ active, onChange }) {
  return (
    <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1" role="tablist" aria-label="Gamification sections">
      {TABS.map((tab, i) => {
        const Icon = tab.icon
        const isActive = active === i
        return (
          <button
            key={tab.label}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(i)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="section-tab-pill"
                className="absolute inset-0 rounded-lg bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 w-4 h-4" />
            <span className="relative z-10">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
