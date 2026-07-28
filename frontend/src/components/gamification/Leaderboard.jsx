import { motion } from 'framer-motion'
import { Medal, Flame, Trophy, Crown, Sparkles } from 'lucide-react'
import Card from './Card' // Assuming this is your custom Card wrapper

// ─── Premium Rank Styles ────────────────────────────────────────────────────
const TOP_RANKS = {
  1: {
    bg: 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100',
    border: 'border-yellow-200 shadow-yellow-200/50',
    text: 'text-yellow-800',
    icon: Crown,
    iconColor: 'text-yellow-500 drop-shadow-sm',
    avatar: 'bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] border-2 border-yellow-100',
    points: 'bg-yellow-100 text-yellow-700 border-yellow-200'
  },
  2: {
    bg: 'bg-gradient-to-r from-slate-50 to-slate-100',
    border: 'border-slate-200 shadow-slate-200/50',
    text: 'text-slate-700',
    icon: Medal,
    iconColor: 'text-slate-400 drop-shadow-sm',
    avatar: 'bg-gradient-to-br from-slate-300 to-slate-400 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] border-2 border-slate-100',
    points: 'bg-slate-200 text-slate-700 border-slate-300'
  },
  3: {
    bg: 'bg-gradient-to-r from-orange-50 to-orange-100',
    border: 'border-orange-200 shadow-orange-200/50',
    text: 'text-orange-800',
    icon: Medal,
    iconColor: 'text-orange-500 drop-shadow-sm',
    avatar: 'bg-gradient-to-br from-orange-300 to-red-400 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)] border-2 border-orange-100',
    points: 'bg-orange-100 text-orange-700 border-orange-200'
  }
}

export default function Leaderboard({ leaderboard = [], currentUserId }) {
  const myEntry = leaderboard.find((e) => e.user_id === currentUserId)

  // Animation variants for staggered list loading
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      x: 0, 
      scale: 1, 
      transition: { type: 'spring', bounce: 0.4 } 
    }
  }

  return (
    <Card className="p-0 overflow-hidden border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl bg-white relative">
      {/* Premium Header */}
      <div className="p-6 sm:p-7 border-b border-slate-100 flex items-center justify-between bg-gradient-to-b from-slate-50/50 to-white relative overflow-hidden">
        {/* Subtle background decoration */}
        <Sparkles className="absolute top-2 right-1/4 w-16 h-16 text-slate-100/50 rotate-12" />
        
        <div className="relative z-10">
          <h3 className="font-extrabold text-2xl text-slate-800 tracking-tight flex items-center gap-2">
            Leaderboard
          </h3>
          <p className="text-sm font-medium text-slate-500 mt-1">Top candidates ranked by XP</p>
        </div>

        {myEntry && (
          <div className="text-right relative z-10 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Your Rank</p>
            <p className="font-extrabold text-2xl text-blue-600 leading-none mt-0.5">#{myEntry.rank}</p>
          </div>
        )}
      </div>

      {/* Empty State */}
      {leaderboard.length === 0 ? (
        <div className="text-center py-16 px-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ type: "spring" }}
            className="w-20 h-20 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-slate-100 shadow-inner"
          >
            <Trophy className="w-10 h-10 text-slate-300" />
          </motion.div>
          <p className="text-base font-extrabold text-slate-700">No rankings yet</p>
          <p className="text-sm font-medium text-slate-500 mt-1">Complete an interview to establish your rank.</p>
        </div>
      ) : (
        /* Leaderboard List */
        <motion.div 
          className="p-3 space-y-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {leaderboard.map((entry, i) => {
            const actualRank = entry.rank ?? i + 1
            const isTop3 = actualRank <= 3
            const rankStyle = TOP_RANKS[actualRank]
            const isMe = entry.user_id === currentUserId
            
            // Icon to display for rank
            const RankIcon = isTop3 ? rankStyle.icon : undefined

            return (
              <motion.div
                key={entry.user_id || i}
                variants={itemVariants}
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 300 } }}
                className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 
                  ${isTop3 ? `${rankStyle.bg} border ${rankStyle.border} shadow-sm` : 'bg-white border border-transparent hover:bg-slate-50 hover:border-slate-100'}
                  ${isMe && !isTop3 ? 'ring-2 ring-blue-400 shadow-md bg-blue-50/40' : ''}
                `}
              >
                {/* Glowing ring for current user */}
                {isMe && <div className="absolute inset-0 rounded-2xl ring-2 ring-blue-400 animate-pulse opacity-50" />}

                {/* Rank Number / Icon */}
                <div className="w-8 flex items-center justify-center shrink-0 relative z-10">
                  {isTop3 ? (
                    <RankIcon className={`w-6 h-6 ${rankStyle.iconColor}`} />
                  ) : (
                    <span className="text-base font-extrabold text-slate-400">#{actualRank}</span>
                  )}
                </div>

                {/* 3D Avatar */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 relative z-10
                  ${isTop3 ? `${rankStyle.avatar} text-white` : 'bg-slate-100 text-slate-600 border-2 border-white shadow-sm'}
                `}>
                  {entry.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-extrabold truncate ${isTop3 ? rankStyle.text : isMe ? 'text-blue-700' : 'text-slate-800'}`}>
                      {entry.full_name || 'Anonymous User'}
                    </p>
                    {isMe && (
                      <span className="bg-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  
                  {/* Badges/Streaks */}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white/50 px-2 py-0.5 rounded-md border border-white/40">
                      <Flame className="w-3.5 h-3.5 text-orange-500" /> {entry.current_streak || 0}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white/50 px-2 py-0.5 rounded-md border border-white/40">
                      <Medal className="w-3.5 h-3.5 text-purple-500" /> {entry.badge_count || 0}
                    </span>
                  </div>
                </div>

                {/* XP / Points */}
                <div className={`shrink-0 relative z-10 px-3 py-1.5 rounded-xl font-extrabold text-sm border shadow-sm
                  ${isTop3 ? rankStyle.points : 'bg-slate-50 text-slate-700 border-slate-200'}
                  ${isMe && !isTop3 ? 'bg-blue-500 text-white border-blue-600' : ''}
                `}>
                  {(entry.total_points || 0).toLocaleString()} <span className="text-[10px] opacity-70">XP</span>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </Card>
  )
}