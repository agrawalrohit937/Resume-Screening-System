import { motion } from 'framer-motion'
import { Target, Timer, Trophy, ArrowRight } from 'lucide-react'
import Card from './Card'
import Button from './Button'

export default function WeeklyChallenge({ progress = 45, target = 100 }) {
  const pct = Math.min(100, Math.round((progress / target) * 100))
  const isComplete = progress >= target;

  return (
    <Card className="p-0 overflow-hidden border-indigo-100">
      {/* Rich Gamified Header */}
      <div className="relative p-6 sm:p-8 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 overflow-hidden text-white">
        {/* Abstract shapes for premium feel */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
        
        <div className="relative z-10 flex justify-between items-start mb-4">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30 text-[10px] font-black uppercase tracking-widest shadow-sm">
            <Timer className="w-3.5 h-3.5" />
            Ends in 2 days
          </div>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg">
            <Trophy className="w-6 h-6 text-yellow-300 drop-shadow-md" />
          </div>
        </div>

        <div className="relative z-10">
          <h3 className="font-extrabold text-2xl tracking-tight mb-1">Crack the AI Interview</h3>
          <p className="text-indigo-100 text-sm font-medium">Score 75%+ across 5 sessions this week</p>
        </div>
      </div>

      {/* Challenge Body */}
      <div className="p-6 sm:p-8 bg-white relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Target className="w-4 h-4" /> Progress
          </span>
          <span className="text-sm font-extrabold text-indigo-600">{progress} / {target}</span>
        </div>
        
        {/* Premium Progress Bar */}
        <div className="h-3.5 rounded-full bg-slate-100 overflow-hidden shadow-inner mb-6 relative">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`h-full rounded-full relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'}`}
          >
             {!isComplete && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />}
          </motion.div>
        </div>

        {/* Gamified Reward / Action Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Reward</p>
            <p className="text-lg font-black text-amber-500 flex items-center gap-1">
              +1,500 XP
            </p>
          </div>
          
          <Button 
            variant="primary" 
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 border-indigo-600 shadow-indigo-500/30"
          >
            {isComplete ? 'Claim Reward' : 'Start Challenge'} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}