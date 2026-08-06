import { motion } from 'framer-motion'
import { Medal, Flame, Trophy, Crown, Sparkles } from 'lucide-react'
import Card from './Card' 

// ─── Professional Premium Rank Styles ────────────────────────────────────────
const TOP_RANKS = {
  1: {
    bg: 'bg-amber-50/60',
    border: 'border-amber-200/70',
    text: 'text-amber-800',
    icon: Crown,
    iconColor: 'text-amber-500',
    avatar: 'bg-amber-500 text-white font-bold border border-amber-400',
    points: 'bg-amber-100/80 text-amber-800 border-amber-200/80'
  },
  2: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-800',
    icon: Medal,
    iconColor: 'text-slate-400',
    avatar: 'bg-slate-600 text-white font-bold border border-slate-500',
    points: 'bg-slate-100 text-slate-700 border-slate-200'
  },
  3: {
    bg: 'bg-blue-50/40',
    border: 'border-blue-200/70',
    text: 'text-[#1d6fa5]',
    icon: Medal,
    iconColor: 'text-[#2E9BDA]',
    avatar: 'bg-[#2E9BDA] text-white font-bold border border-blue-400',
    points: 'bg-blue-50 text-[#1d6fa5] border-blue-200'
  }
}

export default function Leaderboard({ leaderboard = [], currentUserId }) {
  // Only display candidates on the leaderboard (exclude admin & recruiter)
  const candidateLeaderboard = leaderboard.filter(
    (e) => !e.role || e.role.toLowerCase() === 'candidate'
  )
  const myEntry = candidateLeaderboard.find((e) => e.user_id === currentUserId)

  // Dynamic subtitle based on available candidates count
  const getDynamicSubtitle = (count) => {
    if (count >= 30) return 'Top 30 candidates ranked by XP'
    if (count >= 20) return 'Top 20 candidates ranked by XP'
    if (count >= 10) return 'Top 10 candidates ranked by XP'
    if (count >= 5) return 'Top 5 candidates ranked by XP'
    if (count > 0) return `Top ${count} candidates ranked by XP`
    return 'Top candidates ranked by XP'
  }

  // Animation variants for staggered list loading
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -10, scale: 0.98 },
    visible: { 
      opacity: 1, 
      x: 0, 
      scale: 1, 
      transition: { type: 'spring', bounce: 0.3 } 
    }
  }

  return (
    <Card className="p-0 overflow-hidden border border-slate-200/80 shadow-sm rounded-3xl bg-white relative">
      {/* Header */}
      <div className="p-6 sm:p-7 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/70 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="font-extrabold text-[22px] text-slate-900 tracking-tight flex items-center gap-2">
            Leaderboard
          </h3>
          <p className="text-[13px] font-medium text-slate-500 mt-1">{getDynamicSubtitle(candidateLeaderboard.length)}</p>
        </div>

        {myEntry && (
          <div className="text-right relative z-10 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-extrabold text-[#1d6fa5] uppercase tracking-wider">Your Rank</p>
            <p className="font-extrabold text-2xl text-slate-900 leading-none mt-1">#{myEntry.rank}</p>
          </div>
        )}
      </div>


      {/* Empty State */}
      {candidateLeaderboard.length === 0 ? (
        <div className="text-center py-16 px-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ type: "spring" }}
            className="w-16 h-16 mx-auto bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 shadow-sm"
          >
            <Trophy className="w-8 h-8 text-slate-300" />
          </motion.div>
          <p className="text-[15px] font-extrabold text-blue-950">No rankings yet</p>
          <p className="text-[13px] font-medium text-blue-900/50 mt-1">Complete an interview to establish your rank.</p>
        </div>
      ) : (
        /* Leaderboard List */
        <motion.div 
          className="p-3 space-y-1.5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {candidateLeaderboard.map((entry, i) => {
            const actualRank = entry.rank ?? i + 1
            const isTop3 = actualRank <= 3
            const rankStyle = TOP_RANKS[actualRank]
            const isMe = entry.user_id === currentUserId
            
            // Icon to display for rank
            const RankIcon = isTop3 ? rankStyle.icon : undefined

            const displayName = (!entry.full_name || entry.full_name === 'Unknown') ? 'Anonymous Candidate' : entry.full_name

            return (
              <motion.div
                key={entry.user_id || i}
                variants={itemVariants}
                whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400 } }}
                className={`relative flex items-center gap-4 px-4 py-3 rounded-[20px] transition-all duration-200 
                  ${isTop3 ? `${rankStyle.bg} border ${rankStyle.border}` : 'bg-white border border-transparent hover:bg-slate-50 hover:border-slate-100'}
                  ${isMe && !isTop3 ? 'ring-1 ring-[#2E9BDA]/40 shadow-sm bg-blue-50/30' : ''}
                `}
              >
                {/* Glowing ring for current user */}
                {isMe && <div className="absolute inset-0 rounded-[20px] ring-2 ring-[#2E9BDA]/30 animate-pulse opacity-50 pointer-events-none" />}

                {/* Rank Number / Icon */}
                <div className="w-8 flex items-center justify-center shrink-0 relative z-10">
                  {isTop3 ? (
                    <RankIcon className={`w-5.5 h-5.5 ${rankStyle.iconColor}`} />
                  ) : (
                    <span className="text-[14px] font-extrabold text-slate-400">#{actualRank}</span>
                  )}
                </div>

                {/* 3D Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 relative z-10
                  ${isTop3 ? `${rankStyle.avatar} text-white` : 'bg-slate-100 text-slate-600 border border-slate-200 shadow-sm'}
                `}>
                  {displayName.charAt(0).toUpperCase()}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center gap-2">
                    <p className={`text-[13.5px] font-bold truncate ${isTop3 ? rankStyle.text : isMe ? 'text-[#1d6fa5]' : 'text-blue-950'}`}>
                      {displayName}
                    </p>
                    {isMe && (
                      <span className="bg-[#2E9BDA]/10 text-[#1d6fa5] text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#2E9BDA]/20">
                        You
                      </span>
                    )}
                  </div>
                  
                  {/* Badges/Streaks */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-slate-200/60 shadow-sm">
                      <Flame className="w-3 h-3 text-amber-500" /> {entry.current_streak || 0}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-slate-200/60 shadow-sm">
                      <Medal className="w-3 h-3 text-slate-400" /> {entry.badge_count || 0}
                    </span>
                  </div>
                </div>

                {/* XP / Points */}
                <div className={`shrink-0 relative z-10 px-3 py-1.5 rounded-xl font-extrabold text-[13px] border shadow-sm
                  ${isTop3 ? rankStyle.points : 'bg-slate-50 text-blue-950 border-slate-200'}
                  ${isMe && !isTop3 ? 'bg-[#2E9BDA] text-white border-[#1d6fa5]' : ''}
                `}>
                  {(entry.total_points || 0).toLocaleString()} <span className={`text-[9.5px] ${isMe && !isTop3 ? 'text-blue-100' : 'text-slate-400'}`}>XP</span>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </Card>
  )
}