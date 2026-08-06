import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Sparkles, FileText, Target, Zap, TrendingUp, 
  Briefcase, AlertCircle, CheckCircle2, ChevronRight,
  BrainCircuit, Award, Lock, Video, Timer, ArrowRight, Server, Code,
  UserCheck, BookOpen, BarChart3, Check, X, Trophy, TrendingDown,
  Activity, Layers, Star
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getMyAnalytics, getATSHistory, getResumes } from '../services/api'
import { getGamificationProfile } from '../services/interviewApi'
import Card from '../components/Card'
import SectionHeader from '../components/SectionHeader'
import StatBox from '../components/StatBox'
import SkillBar from '../components/SkillBar'

// --- Main Dashboard Component ---

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
  }, [])


  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <div className="h-64 bg-slate-50 rounded-4xl border border-slate-100 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-slate-50 rounded-3xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-50 rounded-4xl animate-pulse" />
          <div className="h-96 bg-slate-50 rounded-4xl animate-pulse" />
        </div>
      </div>
    )
  }

  // --- SAFE MATH NORMALIZATION ---
  const normalizeScore = (val) => {
    if (!val) return 0;
    return val > 1 ? Math.round(val) : Math.round(val * 100);
  }

  const s = analytics?.summary || { total_ats_checks: 0, best_score: 0, average_score: 0 }
  const firstName = user?.full_name?.split(' ')[0] || 'Rohit'
  
  const atsStrength = normalizeScore(s.best_score);
  const atsAverage = normalizeScore(s.average_score);
  const interviewAvg = normalizeScore(gami?.average_score);
  const interviewBest = normalizeScore(gami?.best_score);
  
  const hasCertificate = interviewBest >= 100
  const readiness = Math.round((atsStrength * 0.4) + (interviewAvg * 0.6)) || 0

  // Profile completeness from analytics API
  const profileCompleteness = analytics?.profile_completeness || { score: 0, percentage: 0, fields: {} }
  const pcFields = profileCompleteness.fields || {}

  // Gamification Level Info
  const levelInfo = gami?.level_info || {}
  const levelName = levelInfo.name || 'Beginner'
  const levelIcon = levelInfo.icon || '🌱'
  const levelProgress = levelInfo.progress_pct || 0
  const totalPoints = gami?.total_points || 0
  const totalBadges = gami?.badges?.length || 0

  // Dynamic Missing Skills
  const rawMissing = analytics?.top_missing_skills || [];
  const displayMissing = rawMissing.length > 0 ? rawMissing : [
    { skill: 'Advanced React Patterns', frequency: 0 },
    { skill: 'FastAPI Microservices', frequency: 0 },
    { skill: 'System Design', frequency: 0 }
  ];

  // Build dynamic skill bars from top_missing_skills (inverse: missing = low proficiency)
  const dynamicSkills = displayMissing.slice(0, 3).map((item, i) => {
    const name = item.skill
    const basePct = Math.max(40 - (i * 12), 15)
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500']
    return { label: name, pct: basePct, color: colors[i] }
  })

  // Score Trend: last 3 scores for mini preview
  const recentScores = scoreTrend.slice(-3).map(t => normalizeScore(t.score))
  const trendDirection = recentScores.length >= 2 && recentScores[recentScores.length - 1] >= recentScores[0] ? 'up' : 'down'

  const headline = s.total_ats_checks === 0 
    ? "You haven't run an ATS check yet. Scan your resume to generate your baseline readiness score."
    : !hasCertificate
      ? `You are ${readiness}% ready. Score 100/100 in Quick Practice to earn your Excellence Certificate.`
      : `You are ${readiness}% ready and fully certified! Maintain your edge with a Live Mock Interview.`

  const openCopilot = () => window.dispatchEvent(new Event('careershala:open-copilot'))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 font-sans pb-24">
      
      {/* ── 1. Vibrant Bright Hero ──────────────────────────────────────── */}
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ type: "spring" }}>
        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden shadow-[0_8px_30px_rgba(59,130,246,0.08)] border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-10">
          
          <div className="absolute inset-0 bg-[linear-gradient(to_right_bottom,rgba(59,130,246,0.03),rgba(37,99,235,0.01))]" />
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl animate-pulse-soft pointer-events-none" />
          <Sparkles className="absolute top-8 right-1/4 w-12 h-12 text-blue-200/50 rotate-12 pointer-events-none" />
          
          <div className="relative z-10 text-center md:text-left flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100 mb-5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping-slow" /> Copilot Active
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 font-display tracking-tight mb-4 leading-tight">
              Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">{firstName}</span>.
            </h1>
            <p className="text-slate-500 font-medium max-w-xl text-base leading-relaxed">
              {headline}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-4">
              <button onClick={openCopilot} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-extrabold shadow-[0_8px_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-all flex items-center gap-2">
                <Sparkles size={18} /> Ask AI Copilot
              </button>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center shrink-0">
            <div className="relative w-40 h-40 md:w-48 md:h-48 bg-white rounded-full shadow-xl border border-slate-50 flex items-center justify-center">
              <svg className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] animate-[spin_10s_linear_infinite] opacity-20" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="#3B82F6" strokeWidth="2" strokeDasharray="6 6" />
              </svg>
              <svg className="w-full h-full -rotate-90 p-4">
                <circle cx="50%" cy="50%" r="42%" fill="none" stroke="#EFF6FF" strokeWidth="8%" />
                <motion.circle 
                  cx="50%" cy="50%" r="42%" fill="none" stroke="#2563EB" strokeWidth="8%"
                  strokeLinecap={readiness > 0 ? "round" : "butt"}
                  strokeDasharray="264" strokeDashoffset={264 - (264 * Math.max(0, Math.min(100, readiness))) / 100}
                  style={{ opacity: readiness > 0 ? 1 : 0 }}
                  transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl md:text-5xl font-black text-slate-900 font-display">{readiness}<span className="text-2xl text-blue-500">%</span></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 2. KPI Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <StatBox label="Top ATS Score" value={`${atsStrength}%`} pct={atsStrength} icon={FileText} colorTheme="blue" delay={0.1} />
        <StatBox label="Interview Avg" value={`${interviewAvg}%`} pct={interviewAvg} icon={Target} colorTheme="purple" delay={0.2} />
        <StatBox label="Practice Best" value={`${interviewBest}%`} pct={interviewBest} icon={Timer} colorTheme="emerald" delay={0.3} />
        <StatBox label="Day Streak" value={`${gami?.current_streak || 0}🔥`} pct={Math.min((gami?.current_streak || 0) * 10, 100)} icon={Zap} colorTheme="amber" delay={0.4} />
      </div>

      {/* ── 3. Main Dashboard Content ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Profile Completeness Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <SectionHeader title="Profile Strength" subtitle="Complete your profile for better matching" />
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <UserCheck size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 font-display">{profileCompleteness.percentage}%</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Profile Complete</p>
                  </div>
                </div>
                <div className="h-3 w-32 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }} animate={{ width: `${profileCompleteness.percentage}%` }} 
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(pcFields).map(([key, val]) => (
                  <div key={key} className={`flex items-center gap-1.5 text-[11px] font-bold py-1 px-2 rounded-lg ${val ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                    {val ? <Check size={12} className="text-emerald-500" /> : <X size={12} className="text-slate-300" />}
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Certificates Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <SectionHeader title="Achievements & Certificates" subtitle="Prove your skills to top employers" />
            <Card className={`p-1 border-2 overflow-hidden ${hasCertificate ? 'border-amber-300 shadow-[0_8px_30px_rgba(245,158,11,0.15)]' : 'border-slate-100'}`}>
              <div className={`p-6 md:p-8 rounded-[1.3rem] relative ${hasCertificate ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100' : 'bg-slate-50/50'}`}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left relative z-10">
                  <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shrink-0 shadow-lg ${hasCertificate ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/30' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                    {hasCertificate ? <Award size={48} strokeWidth={2} /> : <Lock size={40} strokeWidth={2} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row items-center sm:justify-start gap-3 mb-2">
                      <h3 className={`text-xl font-black font-display tracking-tight ${hasCertificate ? 'text-amber-900' : 'text-slate-900'}`}>
                        Interview Excellence Certificate
                      </h3>
                      {hasCertificate && <span className="px-3 py-1 rounded-full text-[10px] font-black bg-white text-amber-600 uppercase tracking-widest shadow-sm">Unlocked</span>}
                    </div>
                    
                    {hasCertificate ? (
                      <>
                        <p className="text-sm font-medium text-amber-900/70 mb-5 leading-relaxed">
                          Outstanding! You scored a perfect 100/100. Your verified certificate is ready to be added to your professional profile.
                        </p>
                        <button className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md hover:-translate-y-0.5 transition-all">
                          View & Download Certificate
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-500 mb-5 leading-relaxed">
                          Score a perfect 100/100 in the Quick Practice module to unlock this verified certificate. Currently, your best score is <strong className="text-slate-800">{interviewBest}%</strong>.
                        </p>
                        <button onClick={() => navigate('/live-interview')} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
                          <Timer size={18} /> Start Quick Practice
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Priority Actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <SectionHeader title="Priority Actions" subtitle="AI-curated tasks to increase your hireability" />
            <div className="space-y-4">
              <Card hover className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 cursor-pointer group" onClick={() => navigate('/live-interview')}>
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 border border-indigo-100 shadow-inner">
                  <Video size={28} strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Schedule a Live Mock Interview</h3>
                  </div>
                  <p className="text-sm font-medium text-slate-500">Test your skills under pressure with a conversational AI.</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white text-slate-400 transition-colors shrink-0 mt-2 sm:mt-0">
                   <ArrowRight size={18} strokeWidth={2.5} />
                </div>
              </Card>

              {/* Dynamic Missing Skill Actions */}
              {displayMissing.slice(0, 2).map((item, i) => (
                <Card key={i} hover className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 cursor-pointer group" onClick={() => navigate('/results')}>

                  <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 border border-rose-100 shadow-inner">
                    <AlertCircle size={28} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-black text-slate-900 tracking-tight">Missing Skill: {item.skill}</h3>
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      This skill is frequently required in target roles. Update your resume to bypass filters.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white text-slate-400 transition-colors shrink-0 mt-2 sm:mt-0">
                     <ArrowRight size={18} strokeWidth={2.5} />
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          {/* Gamification Level Card */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <SectionHeader title="Your Level" />
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg">
                  {levelIcon}
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 font-display">{levelName}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Level {levelInfo.level || 1}</p>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                <motion.div 
                  initial={{ width: 0 }} animate={{ width: `${levelProgress}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500">{totalPoints} XP total</span>
                <span className="text-[11px] font-bold text-slate-500">{levelInfo.points_to_next || 0} XP to next</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
                <Star size={14} className="text-amber-500" /> {totalBadges} Badges earned
              </div>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <SectionHeader title="Activity" action={<Link to="/analytics" className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">View All</Link>} />
            <Card className="p-6">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-3 border-2 border-slate-100 shadow-inner">
                    <Briefcase className="text-slate-300" size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-900">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-6 relative">
                  <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-slate-100 rounded-full" />
                  {history.slice(0, 5).map((h, i) => {
                    const isInterview = h.recommendation?.includes('interview') || h.type?.includes('Interview')
                    const Icon = isInterview ? BrainCircuit : FileText
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + (i * 0.1) }} className="relative flex gap-5 group">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10 bg-white ${isInterview ? 'text-purple-600 border-purple-200' : 'text-blue-600 border-blue-200'}`}>
                          <Icon size={18} />
                        </div>
                        <div className="pt-1">
                          <p className="text-sm font-black text-slate-900">{isInterview ? 'Interview Session' : 'ATS Scan'}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            {h.created_at ? new Date(h.created_at).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Score Trend Preview */}
          {recentScores.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <SectionHeader title="Score Trend" />
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trendDirection === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {trendDirection === 'up' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Last {recentScores.length} checks</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {trendDirection === 'up' ? 'Improving ↑' : 'Needs attention ↓'}
                    </p>
                  </div>
                </div>
                <div className="flex items-end gap-2 h-16">
                  {recentScores.map((score, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div 
                        initial={{ height: 0 }} animate={{ height: `${score}%` }}
                        transition={{ duration: 0.8, delay: i * 0.15 }}
                        className={`w-full rounded-t-lg ${trendDirection === 'up' ? 'bg-blue-500' : 'bg-rose-400'}`}
                        style={{ maxHeight: '100%' }}
                      />
                      <span className="text-[9px] font-bold text-slate-400">{score}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Dynamic Skill Bars */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <SectionHeader title="Areas to Improve" subtitle="Based on ATS analysis" />
            <Card className="p-6">
              <div className="space-y-5">
                {dynamicSkills.map((skill, i) => (
                  <SkillBar key={i} label={skill.label} pct={skill.pct} color={skill.color} />
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

      </div>
    </motion.div>
  )
}
