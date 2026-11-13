import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getGamificationProfile, getLeaderboard, getBadgeCatalog } from '../services/interviewApi'
import { useAuth } from '../context/AuthContext'

import '../components/gamification/scrollbar.css'
import { BADGE_CATALOG_FALLBACK, LEVELS } from '../components/gamification/gamificationConfig'
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
  const cacheKey = `careershala_gamification_v2:${user?.id || user?._id || user?.email || 'anonymous'}`
  const [activeTab, setActiveTab] = useState(0) // 0 Path · 1 Achievements · 2 Leaderboard

  const [profile, setProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [catalog, setCatalog] = useState(BADGE_CATALOG_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // 1. Instant Cache Hydration (0ms load via Stale-While-Revalidate)
    try {
      const cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        if (data && data.profile) {
          setProfile(data.profile)
          if (data.leaderboard?.length) setLeaderboard(data.leaderboard)
          if (data.catalog?.length) setCatalog(data.catalog)
          setLoading(false)
        }
      }
    } catch {
      localStorage.removeItem(cacheKey)
    }

    // 2. Fast User Profile Fetch (Decoupled, non-blocking)
    getGamificationProfile()
      .then((p) => {
        if (!isMounted) return
        if (p?.data) {
          setProfile(p.data)
          setLoading(false)
          try {
            const existing = JSON.parse(localStorage.getItem(cacheKey) || '{}')
            localStorage.setItem(cacheKey, JSON.stringify({
              ...existing,
              profile: p.data,
              catalog: existing.catalog || BADGE_CATALOG_FALLBACK,
            }))
          } catch (_) {}
        }
      })
      .catch((err) => {
        console.warn('Gamification profile fetch failed:', err)
        if (isMounted) setLoading(false)
      })

    // 3. Non-blocking Background Leaderboard Sync
    const syncLeaderboard = () => {
      getLeaderboard(30)
        .then((l) => {
          if (!isMounted) return
          const board = l.data?.leaderboard || []
          if (board.length) {
            setLeaderboard(board)
            try {
              const existing = JSON.parse(localStorage.getItem(cacheKey) || '{}')
              localStorage.setItem(cacheKey, JSON.stringify({
                ...existing,
                leaderboard: board,
              }))
            } catch (_) {}
          }
        })
        .catch((err) => console.warn('Leaderboard background sync failed:', err))
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(syncLeaderboard, { timeout: 1500 })
    } else {
      setTimeout(syncLeaderboard, 100)
    }

    return () => {
      isMounted = false
    }
  }, [cacheKey])

  // Instant fetch for leaderboard if user clicks Tab 2 and it hasn't loaded yet
  useEffect(() => {
    if (activeTab === 2 && (!leaderboard || leaderboard.length === 0)) {
      getLeaderboard(30)
        .then((l) => {
          const board = l.data?.leaderboard || []
          if (board.length) setLeaderboard(board)
        })
        .catch(() => {})
    }
  }, [activeTab, leaderboard])

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
      localStorage.setItem(cacheKey, JSON.stringify({
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