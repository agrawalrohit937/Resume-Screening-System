import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Target, Timer, Bot, ArrowRight, Sparkles, Trophy } from 'lucide-react'
import Card from './Card'
import Button from './Button'

export default function WeeklyChallenge({ progress = 45, target = 100, onStart }) {
  const navigate = useNavigate()
  const pct = Math.min(100, Math.round((progress / target) * 100))
  const isComplete = progress >= target

  const handleStart = () => {
    if (onStart) onStart()
    navigate('/live-interview')
  }

  return (
    <Card className="p-0 overflow-hidden border border-slate-200/80 shadow-sm rounded-3xl bg-white">
      {/* AI Agent Header — Matched to LiveInterview.jsx terminal styling */}
      <div className="relative p-6 sm:p-7 bg-[#0f172a] overflow-hidden text-white">
        {/* Subtle Ambient Glowing Orbs */}
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
        
        <div className="relative z-10 flex justify-between items-start mb-4">
          <div className="inline-flex items-center gap-1.5 bg-slate-800/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/60 text-[10px] font-extrabold uppercase tracking-widest text-slate-300 shadow-sm">
            <Timer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ends in 2 days</span>
          </div>

          {/* AI Agent Orb matching LiveInterview */}
          <div className="relative flex items-center justify-center">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center border border-indigo-400/40 shadow-lg shadow-indigo-900/40">
              <Bot className="w-5.5 h-5.5 text-white" strokeWidth={1.8} />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0f172a]" />
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
              AI Mock Agent
            </span>
          </div>
          <h3 className="font-extrabold text-[20px] sm:text-[22px] tracking-tight text-white leading-tight">
            AI Practice Challenge
          </h3>
          <p className="text-slate-300 text-[12.5px] font-medium mt-1">
            Complete 5 mock sessions scoring 75%+ with AI Intervuer
          </p>
        </div>
      </div>

      <div className="p-6 bg-white relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#2E9BDA]" /> Challenge Progress
          </span>
          <span className="text-[13px] font-black text-slate-800">{progress} / {target} XP</span>
        </div>
        
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden shadow-inner mb-5 relative">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`h-full rounded-full relative ${isComplete ? 'bg-emerald-500' : 'bg-[#2E9BDA]'}`}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/60 rounded-2xl p-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-0.5">Reward</p>
            <p className="text-[14px] font-black text-amber-600 flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              +1,500 XP & Badge
            </p>
          </div>
          
          <Button 
            variant="primary" 
            onClick={handleStart}
            className="w-full sm:w-auto bg-[#0f172a] hover:bg-slate-800 text-white font-extrabold text-[12.5px] px-5 h-10 border-none shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
          >
            {isComplete ? 'Claim Reward' : 'Launch AI Practice'} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}