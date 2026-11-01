import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getGamificationProfile, getLeaderboard, getBadgeCatalog } from '../services/interviewApi'
import { useAuth } from '../context/AuthContext'

import '../components/gamification/scrollbar.css'
import { BADGE_CATALOG_FALLBACK, LEVELS } from '../components/gamification/mockConfig'
import ProfileHero from '../components/gamification/ProfileHero'
import SectionTabs from '../components/gamification/SectionTabs'
import CareerPathMap from '../components/gamification/CareerPathMap'
import StreakRecommendation from '../components/gamification/StreakRecommendation'
import PracticeOverview from '../components/gamification/PracticeOverview'
import StreakCard from '../components/gamification/StreakCard'
import AchievementVault from '../components/gamification/AchievementVault'
import Leaderboard from '../components/gamification/Leaderboard'

export default function CareerQuest() {
  const { user } = useAuth()
  const cacheKey = `careershala_gamification_cache:${user?.id || user?._id || user?.email || 'anonymous'}`
  const [activeTab, setActiveTab] = useState(0) // 0 Path · 1 Achievements · 2 Leaderboard

  const [profile, setProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [catalog, setCatalog] = useState(BADGE_CATALOG_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        setProfile(data.profile || null)
        setLeaderboard(data.leaderboard || [])
        if (data.catalog?.length) setCatalog(data.catalog)
        setLoading(false)
      }
    } catch {
      sessionStorage.removeItem(cacheKey)
    }

    const loadGamification = async () => {
      const [p, b, l] = await Promise.all([
        getGamificationProfile().catch(() => ({ data: null })),
        getBadgeCatalog().catch(() => ({ data: { badges: [] } })),
        getLeaderboard(30).catch(() => ({ data: { leaderboard: [] } })),
      ])

      setProfile(p.data)
      setLeaderboard(l.data?.leaderboard || [])

      const remoteBadges = b.data?.badges || []
      if (remoteBadges.length && remoteBadges.every((x) => x.id && x.tier)) setCatalog(remoteBadges)

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          profile: p.data || null,
          leaderboard: l.data?.leaderboard || [],
          catalog: remoteBadges.length ? remoteBadges : BADGE_CATALOG_FALLBACK,
        }))
      } catch {
        // Session storage is an optional performance cache.
      }
    }

    loadGamification().finally(() => setLoading(false))
  }, [cacheKey])

  const earnedBadges = profile?.badges || []
  const currentUserId = user?.id || user?._id

  const handleRewardClaimed = async () => {
    try {
      const [updatedProfile, updatedLeaderboard] = await Promise.all([
        getGamificationProfile(),
        getLeaderboard(30),
      ])
      const nextProfile = updatedProfile.data || null
      const nextLeaderboard = updatedLeaderboard.data?.leaderboard || []
      setProfile(nextProfile)
      setLeaderboard(nextLeaderboard)
      sessionStorage.setItem(cacheKey, JSON.stringify({
        profile: nextProfile,
        leaderboard: nextLeaderboard,
        catalog,
      }))
    } catch (error) {
      console.error('Failed to refresh gamification data after daily reward claim', error)
    }
  }

  if (loading) {
    return (
      <div className="w-full space-y-6">
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
    <div className="w-full min-w-0 overflow-x-hidden space-y-3.5 sm:space-y-6 pb-20 sm:pb-16">
      <ProfileHero
        profile={profile}
        name={user?.full_name || user?.name || user?.username}
        badgeCount={earnedBadges.length}
        leaderboard={leaderboard}
        currentUserId={currentUserId}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <StreakRecommendation profile={profile} />
        <SectionTabs active={activeTab} onChange={setActiveTab} />
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
            <CareerPathMap profile={profile} levels={LEVELS} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 min-w-0">
                <PracticeOverview profile={profile} catalog={catalog} onRewardClaimed={handleRewardClaimed} />
              </div>
              <div className="min-w-0 space-y-3">
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