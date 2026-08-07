import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getGamificationProfile, getLeaderboard, getBadgeCatalog, getLevelCatalog, markDailyActivity } from '../services/interviewApi'
import { useAuth } from '../context/AuthContext'

import '../components/gamification/scrollbar.css'
import { BADGE_CATALOG_FALLBACK, FALLBACK_LEVEL_THRESHOLDS } from '../components/gamification/mockConfig'
import ProfileHero from '../components/gamification/ProfileHero'
import CopilotInsight from '../components/gamification/CopilotInsight'
import SectionTabs from '../components/gamification/SectionTabs'
import CareerPathMap from '../components/gamification/CareerPathMap'
import MissionList from '../components/gamification/MissionList'
import WeeklyChallenge from '../components/gamification/WeeklyChallenge'
import StreakCard from '../components/gamification/StreakCard'
import DailyRewards from '../components/gamification/DailyRewards'
import AchievementVault from '../components/gamification/AchievementVault'
import Leaderboard from '../components/gamification/Leaderboard'

function openCopilot() {
  window.dispatchEvent(new Event('careershala:open-copilot'))
}

export default function CareerQuest() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0) // 0 Path · 1 Achievements · 2 Leaderboard

  const [profile, setProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [catalog, setCatalog] = useState(BADGE_CATALOG_FALLBACK)
  const [levels, setLevels] = useState(FALLBACK_LEVEL_THRESHOLDS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mark daily activity (awards +25 XP if first visit today)
    markDailyActivity().catch(() => {})

    Promise.all([
      getGamificationProfile().catch(() => ({ data: null })),
      getLeaderboard(30).catch(() => ({ data: { leaderboard: [] } })),
      getBadgeCatalog().catch(() => ({ data: { badges: [] } })),
      getLevelCatalog().catch(() => ({ data: { levels: [] } })),
    ])
      .then(([p, l, b, lv]) => {
        setProfile(p.data)
        setLeaderboard(l.data?.leaderboard || [])

        const remoteBadges = b.data?.badges || []
        if (remoteBadges.length && remoteBadges.every((x) => x.id && x.tier)) setCatalog(remoteBadges)

        const remoteLevels = lv.data?.levels || []
        if (remoteLevels.length && remoteLevels.every((x) => x.name && typeof x.threshold === 'number')) setLevels(remoteLevels)
      })
      .finally(() => setLoading(false))
  }, [])

  const earnedBadges = profile?.badges || []
  const currentUserId = user?.id || user?._id

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto p-4 md:p-6 lg:p-8 space-y-6 w-full">
        {/* Premium Skeleton Loader matched to the new aesthetic */}
        <div className="h-48 rounded-[32px] bg-blue-50/60 animate-pulse border border-blue-100/50" />
        <div className="flex gap-5">
          <div className="h-16 flex-1 rounded-2xl bg-blue-50/60 animate-pulse border border-blue-100/50" />
          <div className="h-16 w-72 rounded-2xl bg-blue-50/60 animate-pulse hidden sm:block border border-blue-100/50" />
        </div>
        <div className="h-56 rounded-3xl bg-blue-50/60 animate-pulse border border-blue-100/50" />
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 h-[500px] rounded-3xl bg-blue-50/60 animate-pulse border border-blue-100/50" />
          <div className="h-[500px] rounded-3xl bg-blue-50/60 animate-pulse border border-blue-100/50" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 pb-16 w-full overflow-hidden">
      <ProfileHero
        profile={profile}
        name={user?.full_name || user?.name || user?.username}
        badgeCount={earnedBadges.length}
        leaderboard={leaderboard}
        currentUserId={currentUserId}
      />

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-stretch sm:items-center">
        <div className="flex-1 min-w-0">
          <CopilotInsight profile={profile} catalog={catalog} onOpenCopilot={openCopilot} />
        </div>
        <div className="w-full sm:w-auto shrink-0">
          <SectionTabs active={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 0 && (
          <motion.div 
            key="path" 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={{ duration: 0.3, ease: "easeOut" }} 
            className="space-y-6"
          >
            <CareerPathMap profile={profile} levels={levels} />

            {/* THE LAYOUT FIX: Tightened the gap from gap-8 to gap-6 for a cohesive dashboard feel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Left Column: Quest Log + Daily Rewards */}
              <div className="lg:col-span-2 space-y-6">
                <MissionList profile={profile} />
                <DailyRewards profile={profile} />
              </div>

              {/* Right Column: Challenge, Streak */}
              <div className="space-y-6">
                <WeeklyChallenge profile={profile} onStart={() => {}} />
                <StreakCard profile={profile} />
              </div>

            </div>
          </motion.div>
        )}

        {activeTab === 1 && (
          <motion.div 
            key="achievements" 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <AchievementVault catalog={catalog} earnedBadges={earnedBadges} />
          </motion.div>
        )}

        {activeTab === 2 && (
          <motion.div 
            key="leaderboard" 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Leaderboard leaderboard={leaderboard} currentUserId={currentUserId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}