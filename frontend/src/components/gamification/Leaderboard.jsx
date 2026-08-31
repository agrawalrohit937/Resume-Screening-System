import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Medal, Flame, Trophy, Crown, Sparkles } from 'lucide-react'
import Card from './Card' 
import { useAuth } from '../../context/AuthContext'
import { resolveAvatarUrl, getInitials } from '../../utils/avatarUtils'

// ─── Avatar Component with Real Photo & Initials Fallback ───────────────────
function LeaderboardAvatar({ entry, isTop3, rankStyle, isMe, currentUser }) {
  const [imgError, setImgError] = useState(false)
  const avatarUrl = resolveAvatarUrl(entry) || (isMe ? resolveAvatarUrl(currentUser) : null)
  const initials = getInitials(entry.full_name || 'Candidate')

  useEffect(() => {
    setImgError(false)
  }, [avatarUrl])

  if (avatarUrl && !imgError) {
    return (
      <div className={`w-9 h-9 sm:w-10 sm:h-10 min-w-[36px] sm:min-w-[40px] max-w-[36px] sm:max-w-[40px] min-h-[36px] sm:min-h-[40px] max-h-[36px] sm:max-h-[40px] aspect-square rounded-full overflow-hidden shrink-0 relative z-10 border-2 ${
        isTop3 ? 'border-amber-400 shadow-sm' : 'border-white shadow-sm ring-1 ring-slate-200'
      }`}>
        <img
          src={avatarUrl}
          alt={entry.full_name || 'Candidate'}
          className="w-full h-full object-cover object-center block rounded-full"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div className={`w-9 h-9 sm:w-10 sm:h-10 min-w-[36px] sm:min-w-[40px] max-w-[36px] sm:max-w-[40px] min-h-[36px] sm:min-h-[40px] max-h-[36px] sm:max-h-[40px] aspect-square rounded-full flex items-center justify-center text-xs sm:text-[13px] font-bold shrink-0 relative z-10 ${
      isTop3 ? `${rankStyle.avatar} text-white` : 'bg-slate-100 text-slate-600 border border-slate-200 shadow-sm'
    }`}>
      {initials}
    </div>
  )
}

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
  const { user: currentUser } = useAuth()
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
    <Card className="p-0 overflow-hidden border border-slate-200/80 shadow-sm rounded-2xl sm:rounded-3xl bg-white relative">
      {/* Header */}
      <div className="p-3.5 sm:p-6 md:p-7 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/70 relative overflow-hidden gap-2">
        <div className="relative z-10 min-w-0 flex-1">
          <h3 className="font-extrabold text-lg sm:text-[22px] text-slate-900 tracking-tight flex items-center gap-2">
            Leaderboard
          </h3>
          <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 mt-0.5 truncate">{getDynamicSubtitle(candidateLeaderboard.length)}</p>
        </div>

        {myEntry && (
          <div className="text-right relative z-10 bg-white px-2.5 py-1 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs shrink-0">
            <p className="text-[8px] sm:text-[10px] font-extrabold text-[#1d6fa5] uppercase tracking-wider">Your Rank</p>
            <p className="font-extrabold text-base sm:text-2xl text-slate-900 leading-none mt-0.5">#{myEntry.rank}</p>
          </div>
        )}
      </div>


      {/* Empty State */}
      {candidateLeaderboard.length === 0 ? (
        <div className="text-center py-12 sm:py-16 px-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ type: "spring" }}
            className="w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-slate-50 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 border border-slate-100 shadow-sm"
          >
            <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-slate-300" />
          </motion.div>
          <p className="text-sm sm:text-[15px] font-extrabold text-blue-950">No rankings yet</p>
          <p className="text-xs sm:text-[13px] font-medium text-blue-900/50 mt-1">Complete an interview to establish your rank.</p>
        </div>
      ) : (
        /* Leaderboard List */
        <motion.div 
          className="p-1.5 sm:p-3 space-y-1 sm:space-y-1.5"
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
                whileHover={{ scale: 1.008, transition: { type: 'spring', stiffness: 400 } }}
                className={`relative flex items-center gap-2 sm:gap-3.5 px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-[20px] transition-all duration-200 
                  ${isTop3 ? `${rankStyle.bg} border ${rankStyle.border}` : 'bg-white border border-transparent hover:bg-slate-50 hover:border-slate-100'}
                  ${isMe && !isTop3 ? 'ring-1 ring-[#2E9BDA]/40 shadow-xs bg-blue-50/30' : ''}
                `}
              >
                {/* Glowing ring for current user */}
                {isMe && <div className="absolute inset-0 rounded-xl sm:rounded-[20px] ring-2 ring-[#2E9BDA]/30 animate-pulse opacity-50 pointer-events-none" />}

                {/* Rank Number / Icon */}
                <div className="w-5 sm:w-7 flex items-center justify-center shrink-0 relative z-10 text-center">
                  {isTop3 ? (
                    <RankIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${rankStyle.iconColor}`} />
                  ) : (
                    <span className="text-[11px] sm:text-[13.5px] font-extrabold text-slate-400">#{actualRank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="shrink-0 relative z-10">
                  <LeaderboardAvatar
                    entry={entry}
                    isTop3={isTop3}
                    rankStyle={rankStyle}
                    isMe={isMe}
                    currentUser={currentUser}
                  />
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <p className={`text-xs sm:text-[13.5px] font-bold truncate ${isTop3 ? rankStyle.text : isMe ? 'text-[#1d6fa5]' : 'text-blue-950'}`}>
                      {displayName}
                    </p>
                    {isMe && (
                      <span className="bg-[#2E9BDA]/10 text-[#1d6fa5] text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-full border border-[#2E9BDA]/20 shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  
                  {/* Badges/Streaks */}
                  <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-0.5 text-[9.5px] sm:text-[11px] font-bold text-slate-500 bg-white/70 px-1.5 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                      <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 shrink-0" /> {entry.current_streak || 0}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[9.5px] sm:text-[11px] font-bold text-slate-500 bg-white/70 px-1.5 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                      <Medal className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" /> {entry.badge_count || 0}
                    </span>
                  </div>
                </div>

                {/* XP / Points */}
                <div className={`shrink-0 relative z-10 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl font-extrabold text-[11px] sm:text-[13px] border shadow-2xs whitespace-nowrap tabular-nums
                  ${isTop3 ? rankStyle.points : 'bg-slate-50 text-blue-950 border-slate-200'}
                  ${isMe && !isTop3 ? 'bg-[#2E9BDA] text-white border-[#1d6fa5]' : ''}
                `}>
                  {(entry.total_points || 0).toLocaleString()} <span className={`text-[8.5px] sm:text-[9.5px] ${isMe && !isTop3 ? 'text-blue-100' : 'text-slate-400'}`}>XP</span>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </Card>
  )
}