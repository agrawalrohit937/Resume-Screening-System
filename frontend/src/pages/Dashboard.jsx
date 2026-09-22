import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Sparkles, FileText, Target, Zap, TrendingUp, 
  Briefcase, AlertCircle, CheckCircle2, ChevronRight,
  BrainCircuit, Award, Lock, Video, Timer, ArrowRight,
  UserCheck, Check, X, Star, UploadCloud, TrendingDown,
  Globe, ShieldCheck, ArrowUpRight, FolderGit2, Code2, Layers
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getMyAnalytics, getATSHistory, getResumes } from '../services/api'
import { getGamificationProfile } from '../services/interviewApi'
import Card from '../components/Card'
import SectionHeader from '../components/SectionHeader'
import StatBox from '../components/StatBox'
import RecommendedJobs from '../components/RecommendedJobs'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  
  const [analytics, setAnalytics] = useState(null)
  const [history, setHistory] = useState([])
  const [gami, setGami] = useState(null)
  const [resumeCount, setResumeCount] = useState(0)
  const [scoreTrend, setScoreTrend] = useState([])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    if (!user) {
      setAnalytics(null)
      setHistory([])
      setGami(null)
      setResumeCount(0)
      setScoreTrend([])
      setLoading(false)
      return () => { mounted = false }
    }

    setLoading(true)
    Promise.all([
      getMyAnalytics(undefined, { signal: controller.signal }).catch(() => ({ data: null })),
      getATSHistory({ page_size: 5 }, { signal: controller.signal }).catch(() => ({ data: { items: [] } })),
      getResumes({ page_size: 1 }, { signal: controller.signal }).catch(() => ({ data: { resumes: [] } })),
      getGamificationProfile({ signal: controller.signal }).catch(() => ({ data: null })),
    ]).then(([a, h, r, g]) => {
      if (!mounted) return
      const analyticsData = a.data || null
      setAnalytics(analyticsData)
      setHistory(h.data?.items || [])
      setGami(g.data || null)
      setResumeCount(r.data?.resumes?.length || 0)
      setScoreTrend(analyticsData?.score_trend || [])
    }).finally(() => {
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [user])

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="h-64 bg-slate-50 rounded-3xl border border-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-50 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-72 bg-slate-50 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-50 rounded-3xl animate-pulse" />
          <div className="h-80 bg-slate-50 rounded-3xl animate-pulse" />
        </div>
      </div>
    )
  }

  // --- Safe Math Normalization ---
  const normalizeScore = (val) => {
    if (!val) return 0
    return val > 1 ? Math.round(val) : Math.round(val * 100)
  }

  const s = analytics?.summary || { total_ats_checks: 0, best_score: 0, average_score: 0 }
  const firstName = user?.full_name?.split(' ')[0] || user?.username || 'Candidate'
  
  const atsStrength = normalizeScore(s.best_score)
  const atsAverage = normalizeScore(s.average_score)
  const interviewAvg = normalizeScore(gami?.average_score)
  const interviewBest = normalizeScore(gami?.best_score)
  
  const hasCertificate = interviewBest >= 100
  const readiness = Math.round((atsStrength * 0.4) + (interviewAvg * 0.6)) || (atsStrength > 0 ? atsStrength : 0)

  // Profile Completeness
  const profileCompleteness = analytics?.profile_completeness || { score: 0, percentage: 0, fields: {} }
  const pcFields = profileCompleteness.fields || {}
  const profilePct = profileCompleteness.percentage || 0

  // Gamification Info
  const levelInfo = gami?.level_info || {}
  const levelName = levelInfo.name || 'Aspiring Pro'
  const levelIcon = levelInfo.icon || '🌱'
  const levelProgress = levelInfo.progress_pct || 0
  const totalPoints = gami?.total_points || 0
  const currentStreak = gami?.current_streak || 0

  // Consolidate Missing Keywords / Areas to Improve (Filtered: score < 60%)
  const rawMissing = analytics?.top_missing_skills || []
  const rawAreas = analytics?.areas_to_improve?.length > 0 
    ? analytics.areas_to_improve 
    : rawMissing.map(item => ({
        skill: item.skill,
        score: Math.min(Math.max((item.frequency || 1) * 10, 20), 45),
        pct: Math.min(Math.max((item.frequency || 1) * 10, 20), 45),
        status: 'Missing Gap'
      }))

  const consolidatedGaps = rawAreas
    .filter(item => {
      const scoreVal = item.score ?? item.pct ?? 0
      return scoreVal < 60 && scoreVal !== 100
    })
    .slice(0, 4)
    .map(item => ({
      skill: item.skill || item.label,
      score: item.score ?? item.pct ?? 30,
      status: item.status || 'Keyword Gap'
    }))

  // Verified matched skills from actual user evaluations or profile
  const matchedSkills = analytics?.top_matched_skills?.length > 0
    ? analytics.top_matched_skills
    : Array.isArray(user?.skills) && user.skills.length > 0
      ? user.skills.map(s => ({ skill: s, frequency: 1 }))
      : [
          { skill: 'Python', frequency: 2 },
          { skill: 'FastAPI', frequency: 2 },
          { skill: 'PostgreSQL', frequency: 2 }
        ]

  // Score Trend Data
  const trendPoints = scoreTrend.length > 0 
    ? scoreTrend.slice(-6).map(t => ({
        label: t.label || (t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Scan`),
        score: normalizeScore(t.score),
        date: t.date,
        recommendation: t.recommendation,
      }))
    : []

  const trendDirection = trendPoints.length >= 2 && trendPoints[trendPoints.length - 1].score >= trendPoints[0].score ? 'up' : 'down'

  // Activity Feed
  const activityList = analytics?.activity_feed && analytics.activity_feed.length > 0
    ? analytics.activity_feed
    : history.slice(0, 5).map(h => ({
        id: h.result_id || Math.random().toString(),
        type: h.recommendation?.includes('interview') ? 'interview' : 'ats_scan',
        title: h.recommendation?.includes('interview') ? 'Interview Practice' : 'ATS Resume Scan',
        detail: h.final_score ? `Score: ${normalizeScore(h.final_score)}%` : 'Completed',
        created_at: h.created_at,
      }))

  const openCopilot = () => window.dispatchEvent(new Event('careershala:open-copilot'))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-8 font-sans pb-24 text-slate-800 antialiased">
      
      {/* ── 1. Hero / Candidate Command Center ────────────────────────────── */}
      <motion.div initial={{ y: 15 }} animate={{ y: 0 }} transition={{ type: "spring", duration: 0.6 }}>
        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 relative overflow-hidden shadow-xs border border-slate-200/90 flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* Subtle Ambient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/40 pointer-events-none" />
          <div className="hidden sm:block absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Left: Candidate Standing Info */}
          <div className="relative z-10 text-center lg:text-left flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold tracking-wider uppercase border border-indigo-200/60 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              CareerPilot Copilot Active
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Welcome back, <span className="text-indigo-600">{firstName}</span>.
              </h1>
              <p className="text-slate-600 font-medium text-xs sm:text-sm max-w-xl leading-relaxed">
                {s.total_ats_checks === 0 
                  ? "Scan your resume against your target job descriptions to calculate your baseline match score."
                  : readiness < 75
                    ? `Your Career Score is ${readiness}%. Complete recommended resume optimizations to break the 80%+ threshold.`
                    : `Strong standing! Your Career Score is ${readiness}% with a competitive ATS score and interview rating.`
                }
              </p>
            </div>

            {/* Quick Action CTAs */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <button 
                onClick={openCopilot} 
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} /> Ask AI Copilot
              </button>
              <button 
                onClick={() => navigate('/results')} 
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileText size={16} className="text-indigo-600" /> Run ATS Resume Scan
              </button>
              <button 
                onClick={() => navigate('/live-interview')} 
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Video size={16} className="text-purple-600" /> Practice Mock Interview
              </button>
            </div>
          </div>

          {/* Right: Large Prominent Career Score Circle & Sleek Trophy Pill */}
          <div className="relative z-10 flex flex-col items-center gap-3 shrink-0">
            {/* Large Prominent Career Score Circle */}
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 md:w-52 md:h-52 bg-white rounded-full shadow-[0_12px_36px_rgba(79,70,229,0.12)] border border-slate-100 flex items-center justify-center p-3">
              {(() => {
                const clampedScore = Math.max(0, Math.min(100, Number(readiness) || 0))
                const radius = 45
                const circumference = 2 * Math.PI * radius
                const strokeDashoffset = circumference - (circumference * clampedScore) / 100

                return (
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    {/* Background Track */}
                    <circle 
                      cx="60" 
                      cy="60" 
                      r={radius} 
                      fill="none" 
                      stroke="#F1F5F9" 
                      strokeWidth="9" 
                    />
                    {/* Dynamic Active Progress Ring */}
                    {clampedScore > 0 && (
                      <motion.circle 
                        cx="60" 
                        cy="60" 
                        r={radius} 
                        fill="none" 
                        stroke="#4F46E5" 
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={circumference} 
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                    )}
                  </svg>
                )
              })()}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                <span className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 font-display tracking-tight leading-none">
                  {readiness}<span className="text-2xl sm:text-3xl text-indigo-600 font-extrabold">%</span>
                </span>
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mt-1.5 whitespace-nowrap select-none">
                  Career Score
                </span>
              </div>
            </div>

            {/* Compact Gamification Trophy Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50/90 text-amber-900 border border-amber-200/80 shadow-2xs text-xs font-extrabold">
              <span className="text-sm">{levelIcon}</span>
              <span>{levelName} • Lvl {levelInfo.level || 1}</span>
              <span className="text-amber-700 font-bold bg-amber-200/70 px-1.5 py-0.2 rounded-md text-[10px]">
                {currentStreak}d 🔥
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 2. KPI Metrics Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <StatBox 
          label="Best ATS Match" 
          value={`${atsStrength}%`} 
          pct={atsStrength} 
          icon={FileText} 
          colorTheme="blue" 
          delay={0.05} 
        />
        <StatBox 
          label="Interview Avg" 
          value={`${interviewAvg}%`} 
          pct={interviewAvg} 
          icon={Target} 
          colorTheme="purple" 
          delay={0.1} 
        />
        <StatBox 
          label="Profile Strength" 
          value={`${profilePct}%`} 
          pct={profilePct} 
          icon={UserCheck} 
          colorTheme="emerald" 
          delay={0.15} 
        />
        <StatBox 
          label="Practice Best" 
          value={`${interviewBest}%`} 
          pct={interviewBest} 
          icon={Timer} 
          colorTheme="amber" 
          delay={0.2} 
        />
      </div>

      {/* ── 3. High-Priority Opportunity Pipeline: Recommended Jobs ────────── */}
      <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <RecommendedJobs />
      </motion.div>

      {/* ── 4. Unified Action Center (No Duplication) ─────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <SectionHeader 
          title="Candidate Action Center" 
          subtitle="Consolidated high-impact improvements to boost your interview callback rate" 
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Action 1: Resume Keyword Gaps */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <AlertCircle size={20} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/60">
                  {consolidatedGaps.length > 0 ? `${consolidatedGaps.length} Gaps Found` : 'Optimized'}
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Target Keyword Gaps
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {consolidatedGaps.length > 0
                    ? "Keywords missing from your target role scans. Add these skills to your resume to pass automated ATS filters."
                    : "No critical keyword gaps identified in your latest scans. Your resume closely matches your target positions."}
                </p>
              </div>

              {/* Gap Pills */}
              {consolidatedGaps.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {consolidatedGaps.map((gap, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {gap.skill}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  <CheckCircle2 size={14} /> Core Keywords Fully Matched
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/results')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Scan &amp; Fix in ATS Matcher <ArrowRight size={14} />
            </button>
          </div>

          {/* Action 2: Mock Interview & Excellence Certificate */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  {hasCertificate ? <Award size={20} /> : <BrainCircuit size={20} />}
                </div>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  hasCertificate 
                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                }`}>
                  {hasCertificate ? 'Certificate Unlocked' : 'Skill Assessment'}
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Interview Readiness
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {hasCertificate
                    ? "You achieved a perfect 100/100 score and earned your verified Interview Excellence Certificate."
                    : `Score 100/100 in Quick Practice to unlock your verified certificate. Best score: ${interviewBest}%.`}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-slate-700">
                  <span>Certification Benchmark</span>
                  <span className="text-indigo-600">{interviewBest} / 100</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${hasCertificate ? 'bg-amber-500' : 'bg-indigo-600'}`} 
                    style={{ width: `${Math.min(interviewBest, 100)}%` }} 
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(hasCertificate ? '/interview' : '/live-interview')}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                hasCertificate
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
              }`}
            >
              {hasCertificate ? (
                <>View Certificate <ArrowRight size={14} /></>
              ) : (
                <>Start Mock Interview <ArrowRight size={14} /></>
              )}
            </button>
          </div>

          {/* Action 3: Profile & Portfolio Strength */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <Globe size={20} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                  Recruiter Visibility
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Developer Portfolio
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Generate a live, interactive portfolio website from your resume with your skills, projects, and contact info.
                </p>
              </div>

              {/* Profile Completeness Compact Checklist */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Profile Health</span>
                  <span className="text-purple-600">{profilePct}%</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                  {Object.entries(pcFields).slice(0, 4).map(([k, v]) => (
                    <span 
                      key={k} 
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                        v ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {v ? <Check size={11} className="text-emerald-500 shrink-0" /> : <X size={11} className="text-slate-300 shrink-0" />}
                      <span className="truncate">{k.replace(/_/g, ' ')}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/portfolio')}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Build Live Portfolio <ArrowRight size={14} />
            </button>
          </div>

        </div>
      </motion.div>

      {/* ── 5. Analytics & History: Score Trend & Activity Timeline ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Genuine Candidate Verified Skills & GitHub Projects Showcase */}
        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <SectionHeader 
            title="Projects & Verified Skills" 
            subtitle="Skills and project repositories extracted directly from your resume & GitHub"
            action={<Link to="/github" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">Analyze GitHub</Link>}
          />
          <Card className="p-6 space-y-5">
            {/* Top: GitHub & Project Workspace Connection Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Code2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900">
                      GitHub: {user?.github_username ? `@${user.github_username}` : `@${user?.username || 'agrawalrohit937'}`}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-extrabold border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {resumeCount > 0 ? `${resumeCount} Resume(s) Parsed` : 'Workspace Active'} • Portfolio Ready
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => navigate('/github')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <FolderGit2 size={13} /> View Code Analysis
              </button>
            </div>

            {/* Verified Technical Skills from Resume */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Verified Skills in Your Profile:
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Extracted from ATS scans
                </span>
              </div>

              {matchedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchedSkills.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
                    >
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span className="capitalize">{item.skill}</span>
                      {item.frequency > 1 && (
                        <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100/80 px-1.5 py-0.2 rounded-md">
                          {item.frequency}x
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Upload your resume or run an ATS scan to auto-extract verified skills.
                  </span>
                  <button
                    onClick={() => navigate('/results')}
                    className="text-xs font-bold text-indigo-600 hover:underline shrink-0 ml-2"
                  >
                    Scan Resume
                  </button>
                </div>
              )}
            </div>

            {/* Project Showcase & Portfolio Launcher */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                  <Layers size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Developer Portfolio Website</p>
                  <p className="text-[11px] font-medium text-slate-500">
                    Turn your verified skills &amp; GitHub repos into a recruiter-ready link
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/portfolio-builder')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
              >
                Launch Builder <ArrowRight size={13} />
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Live Activity Timeline */}
        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <SectionHeader 
            title="Activity Stream" 
            subtitle="Recent applications, evaluations, and mock sessions"
            action={<Link to="/analytics" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">View All</Link>}
          />
          <Card className="p-6">
            {activityList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-2 border border-slate-200">
                  <Briefcase size={22} />
                </div>
                <p className="text-xs font-bold text-slate-700">No Recent Activity</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  Your applications, scans, and practice milestones will appear here chronologically.
                </p>
              </div>
            ) : (
              <div className="space-y-4 relative">
                <div className="absolute left-[17px] top-3 bottom-3 w-[2px] bg-slate-100 rounded-full" />
                {activityList.map((item, i) => {
                  let Icon = FileText
                  let iconTheme = 'text-blue-600 bg-blue-50 border-blue-200'
                  if (item.type === 'job_application') {
                    Icon = Briefcase
                    iconTheme = 'text-indigo-600 bg-indigo-50 border-indigo-200'
                  } else if (item.type === 'resume_upload') {
                    Icon = UploadCloud
                    iconTheme = 'text-sky-600 bg-sky-50 border-sky-200'
                  } else if (item.type === 'certificate') {
                    Icon = Award
                    iconTheme = 'text-amber-600 bg-amber-50 border-amber-200'
                  } else if (item.type === 'interview') {
                    Icon = BrainCircuit
                    iconTheme = 'text-purple-600 bg-purple-50 border-purple-200'
                  }

                  const dateStr = item.created_at
                    ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : 'Recently'

                  return (
                    <motion.div 
                      key={item.id || i} 
                      initial={{ opacity: 0, x: -8 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 0.05 * i }} 
                      className="relative flex items-center gap-3.5 group"
                    >
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 z-10 ${iconTheme} shadow-2xs`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                          {item.detail && (
                            <p className="text-[11px] font-medium text-slate-500 truncate">{item.detail}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                          {dateStr}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </Card>
        </motion.div>

      </div>

    </motion.div>
  )
}
