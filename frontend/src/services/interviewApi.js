/**
 * Interview API Service — AI interview, feedback, cheating, gamification
 * Extends existing api.js without modifying it
 */
import api from './api'

// ── Session Completion ──────────────────────────────────────
export const completeInterviewSession = (payload) =>
  api.post('/interview/ai/complete', payload)


// ── Gamification ────────────────────────────────────────────
let _gamiProfileInFlight = null
export const getGamificationProfile = (config) => {
  if (_gamiProfileInFlight) return _gamiProfileInFlight
  _gamiProfileInFlight = api.get('/interview/ai/gamification/profile', config)
    .finally(() => {
      setTimeout(() => { _gamiProfileInFlight = null }, 2000)
    })
  return _gamiProfileInFlight
}

export const claimDailyVisitReward = () =>
  api.post('/interview/ai/gamification/daily-visit')



let _leaderboardInFlight = null
export const getLeaderboard = (limit = 50) => {
  if (_leaderboardInFlight) return _leaderboardInFlight
  _leaderboardInFlight = api.get(`/interview/ai/gamification/leaderboard?limit=${limit}`)
    .finally(() => {
      setTimeout(() => { _leaderboardInFlight = null }, 3000)
    })
  return _leaderboardInFlight
}

export const getBadgeCatalog = () =>
  api.get('/interview/ai/badges/catalog')

// ── Resume Fetch ─────────────────────────────────────────────
export const getResumes = () =>
  api.get('/resume')
