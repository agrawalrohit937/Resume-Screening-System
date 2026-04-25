import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { getMyAnalytics, getATSHistory, getResumes } from '../services/api'
import ScoreRing from '../components/ScoreRing'
import { AnimatedNumber, AnimatedBar } from '../components/AnimatedNumber'
import { ScoreTrendChart } from '../components/Charts'

// ── Blue palette tokens (inline) ────
const BLUE = {
  50:  '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE',
  300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6',
  600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A',
}

// ── Score color helper ─────────────────────────────────────────────────────────
function scoreStyle(score) {
  if (score >= 0.8) return { color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', badge: '#DCFCE7' }
  if (score >= 0.6) return { color: BLUE[700], bg: BLUE[50], border: BLUE[200], badge: BLUE[100] }
  if (score >= 0.4) return { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', badge: '#FEF9C3' }
  return { color: '#BE123C', bg: '#FFF1F2', border: '#FECDD3', badge: '#FFE4E6' }
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, suffix = '', icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'white', borderRadius: 16, border: `1px solid ${BLUE[100]}`,
        padding: '20px 22px', boxShadow: `0 1px 4px rgba(37,99,235,0.06)`,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: BLUE[50],
        border: `1px solid ${BLUE[200]}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 18, marginBottom: 4,
      }}>
        {icon}
      </div>
      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600,
        color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 28,
        color: '#0F172A', margin: 0, lineHeight: 1 }}>
        {typeof value === 'number'
          ? <><AnimatedNumber value={value} suffix={suffix}/></>
          : value}
      </p>
      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8', margin: 0 }}>
        {label === 'ATS Analyses' ? 'Total Analyses'
          : label === 'Best Score' ? 'Your Best Score'
          : label === 'Strong Matches' ? 'Great Matches'
          : 'Total Resumes'}
      </p>
    </motion.div>
  )
}

function RecommendCard({ title, desc, cta, to, color, bg, border, icon, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'white', borderRadius: 18, border: `1px solid ${BLUE[100]}`,
        padding: '22px 22px', display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: `0 2px 8px rgba(37,99,235,0.06)`, flex: 1,
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', right: -20, top: -20, width: 100, height: 100,
        borderRadius: '50%', background: bg, opacity: 0.6, pointerEvents: 'none',
      }}/>
      <div style={{ fontSize: 36, lineHeight: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15,
          color: '#0F172A', margin: '0 0 6px' }}>{title}</p>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B',
          margin: 0, lineHeight: 1.6 }}>{desc}</p>
      </div>
      <Link to={to} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 18px', borderRadius: 10, background: color, color: 'white',
        fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600,
        textDecoration: 'none', border: 'none', cursor: 'pointer',
        boxShadow: `0 2px 8px ${color}44`, alignSelf: 'flex-start',
      }}>
        {cta}
      </Link>
    </motion.div>
  )
}

function ActivityItem({ icon, title, desc, time, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px', borderRadius: 14,
        border: `1px solid ${BLUE[100]}`, background: 'white',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = BLUE[50]}
      onMouseLeave={e => e.currentTarget.style.background = 'white'}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: BLUE[50],
        border: `1px solid ${BLUE[200]}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13,
          color: '#1E293B', margin: '0 0 2px', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: '#94A3B8', margin: 0 }}>{desc}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#94A3B8' }}>{time}</span>
        <svg style={{ width: 14, height: 14, color: '#CBD5E1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </motion.div>
  )
}

function JourneyStep({ num, title, desc, active, done }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: done ? BLUE[600] : active ? BLUE[50] : '#F8FAFC',
        border: `2px solid ${done ? BLUE[600] : active ? BLUE[400] : '#E2E8F0'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: active ? `0 0 0 4px ${BLUE[100]}` : 'none',
        transition: 'all 0.3s',
      }}>
        {done
          ? <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          : <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13,
              color: active ? BLUE[600] : '#94A3B8' }}>{num}</span>
        }
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 12,
          color: active || done ? '#0F172A' : '#94A3B8', margin: '0 0 2px' }}>{num}. {title}</p>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: '#94A3B8', margin: 0 }}>{desc}</p>
      </div>
    </div>
  )
}

function ResourceCard({ tag, tagColor, tagBg, time, title, desc, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        flex: 1, background: 'white', borderRadius: 16, border: `1px solid ${BLUE[100]}`,
        padding: '18px 18px', cursor: 'pointer', transition: 'box-shadow 0.2s',
      }}
      whileHover={{ boxShadow: `0 4px 16px rgba(37,99,235,0.10)`, y: -2 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          padding: '3px 9px', borderRadius: 6, background: tagBg,
          fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 9,
          color: tagColor, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>{tag}</span>
        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: '#94A3B8' }}>{time} read</span>
      </div>
      <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 14,
        color: '#0F172A', margin: '0 0 8px', lineHeight: 1.35 }}>{title}</p>
      <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#64748B',
        margin: 0, lineHeight: 1.6 }}>{desc}</p>
    </motion.div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [history, setHistory]     = useState([])
  const [resumes, setResumes]     = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    // We now fetch actual data. If an API fails, it defaults to an empty state instead of Mock data.
    Promise.all([
      getMyAnalytics().catch(() => ({ data: null })),
      getATSHistory({ page_size: 5 }).catch(() => ({ data: { items: [] } })),
      getResumes({ page_size: 5 }).catch(() => ({ data: { resumes: [] } })),
    ]).then(([a, h, r]) => {
      setAnalytics(a.data || null)
      setHistory(h.data?.items || [])
      setResumes(r.data?.resumes || [])
    }).finally(() => setLoading(false))
  }, [])

  // Safely extract actual data or default to 0/empty if the user hasn't generated any real data yet.
  const s = analytics?.summary || { total_ats_checks: 0, average_score: 0, best_score: 0, strong_matches: 0 }
  const trend = analytics?.score_trend || []
  const missing = analytics?.top_missing_skills || []
  const tips = analytics?.improvement_tips || []
  
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || 'there'

  // Journey step logically inferred from user's ACTUAL data progress
  const journeyStep = resumes.length > 0 ? (history.length > 0 ? 3 : 2) : 1

  // Loading skeleton
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ height: 200, borderRadius: 20, background: BLUE[50], animation: 'pulse 2s infinite' }}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[...Array(4)].map((_,i) => (
          <div key={i} style={{ height: 110, borderRadius: 16, background: BLUE[50], animation: 'pulse 2s infinite' }}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>
      {/* ── Hero Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg, ${BLUE[800]} 0%, ${BLUE[700]} 50%, ${BLUE[600]} 100%)`,
          boxShadow: `0 8px 32px rgba(30,64,175,0.35)`,
        }}
      >
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.08,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '28px 28px', pointerEvents: 'none',
        }}/>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: -40, left: 60, width: 180, height: 180,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399',
                boxShadow: '0 0 6px rgba(52,211,153,0.7)', animation: 'blink 2s infinite' }}/>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700,
                color: BLUE[200], textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Career Intelligence Active
              </span>
            </div>
            <h2 style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 32,
              color: 'white', margin: '0 0 10px', lineHeight: 1.2 }}>
              {greeting}, {firstName} 👋
            </h2>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, color: BLUE[200],
              margin: '0 0 24px', lineHeight: 1.65, maxWidth: 440 }}>
              Your career score is {s.total_ats_checks > 0 ? <strong style={{ color: 'white' }}>trending upward</strong> : "awaiting its first check"}.
              You&apos;ve run {s.total_ats_checks} ATS analyses with a {Math.round(s.average_score * 100)}% average score.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/upload" style={{
                padding: '10px 22px', borderRadius: 12,
                background: 'rgba(255,255,255,0.15)', color: 'white',
                fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: 13,
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)',
                backdropFilter: 'blur(8px)', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}>
                <span>+</span> Upload Resume
              </Link>
              <Link to="/results" style={{
                padding: '10px 22px', borderRadius: 12,
                background: 'rgba(255,255,255,0.08)', color: BLUE[200],
                fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: 13,
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                Run ATS Check <span>→</span>
              </Link>
            </div>
          </div>
          <div style={{ flexShrink: 0, position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: -16, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
            }}/>
            <ScoreRing score={s.average_score} size={140} label="Avg Score"/>
          </div>
        </div>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </motion.div>

      {/* ── 4 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <StatCard label="ATS Analyses"  value={s.total_ats_checks}                     icon="📊" delay={0.08}/>
        <StatCard label="Best Score"    value={`${Math.round(s.best_score * 100)}%`}   icon="⭐" delay={0.12}/>
        <StatCard label="Strong Matches"value={s.strong_matches}                        icon="✅" delay={0.16}/>
        <StatCard label="Resumes"       value={user?.total_resumes || resumes.length || 0} icon="📄" delay={0.20}/>
      </div>

      {/* ── Score Trend + Skill Gaps ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Score trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ background: 'white', borderRadius: 20, border: `1px solid ${BLUE[100]}`,
            padding: '24px', boxShadow: `0 1px 4px rgba(37,99,235,0.06)` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 16, color: '#0F172A', margin: '0 0 3px' }}>
                Score Trend
              </p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8', margin: 0 }}>
                ATS performance over time
              </p>
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: 20, background: BLUE[50],
              border: `1px solid ${BLUE[200]}`, fontFamily: "'Inter',sans-serif",
              fontSize: 11, fontWeight: 600, color: BLUE[700],
            }}>Last 90 days</span>
          </div>
          {trend.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '60px 0' }}>
               <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
               <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>No data yet</p>
               <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
                 Run your first ATS check to see your score trend
               </p>
             </div>
          ) : (
            <ScoreTrendChart data={trend}/>
          )}
        </motion.div>
        
        {/* Top skill gaps */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}
          style={{ background: 'white', borderRadius: 20, border: `1px solid ${BLUE[100]}`,
            padding: '24px', boxShadow: `0 1px 4px rgba(37,99,235,0.06)` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 16, color: '#0F172A', margin: '0 0 3px' }}>
                Top Skill Gaps
              </p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8', margin: 0 }}>
                Missing from job descriptions
              </p>
            </div>
            <Link to="/results" style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600,
              color: BLUE[600], textDecoration: 'none' }}>Analyze →</Link>
          </div>
          {missing.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>No analysis yet</p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
                Run a skill analysis to see your gaps
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {missing.slice(0, 5).map((sk, i) => {
                const pct = Math.round((sk.frequency / missing[0].frequency) * 100)
                const barColors = [BLUE[600], BLUE[500], '#8B5CF6', '#F59E0B', '#0EA5E9']
                return (
                  <div key={sk.skill}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600,
                        color: '#374151', textTransform: 'capitalize' }}>{sk.skill}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#94A3B8' }}>
                        {sk.frequency}× missing
                      </span>
                    </div>
                    <AnimatedBar value={pct} color={barColors[i]} delay={i * 100} height={7}/>
                  </div>
                )
              })}
            </div>
          )}
          <Link to="/results" style={{
            display: 'block', textAlign: 'center', marginTop: 18,
            padding: '9px 0', borderRadius: 12, background: BLUE[50],
            border: `1px solid ${BLUE[200]}`, fontFamily: "'Poppins',sans-serif",
            fontSize: 13, fontWeight: 600, color: BLUE[700], textDecoration: 'none',
          }}>
            Run Skill Analysis →
          </Link>
        </motion.div>
      </div>

      {/* ── Recommended for You ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 18, color: '#0F172A', margin: '0 0 4px' }}>
            Recommended for You
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#94A3B8', margin: 0 }}>
            AI-powered suggestions to accelerate your career
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <RecommendCard
            title="Improve Your Resume"
            desc="Get AI-powered suggestions to improve your ATS score"
            cta="Optimize Now"
            to="/enhance"
            color={BLUE[600]}
            bg={BLUE[100]}
            border={BLUE[200]}
            icon="📄"
            delay={0.38}
          />
          <RecommendCard
            title="Practice Interview"
            desc="Practice with AI interviewer and get real-time feedback"
            cta="Start Practice"
            to="/live-interview-v2"
            color={BLUE[600]}
            bg={BLUE[100]}
            border={BLUE[200]}
            icon="🎤"
            delay={0.42}
          />
          <RecommendCard
            title="Skill Analysis"
            desc="Discover skill gaps and get improvement recommendations"
            cta="Analyze Skills"
            to="/results"
            color={BLUE[600]}
            bg={BLUE[100]}
            border={BLUE[200]}
            icon="🎯"
            delay={0.46}
          />
        </div>
      </motion.div>

      {/* ── Recent Activity + AI Career Insight ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 16, color: '#0F172A', margin: '0 0 2px' }}>
                Recent Activity
              </p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8', margin: 0 }}>
                Your latest career actions
              </p>
            </div>
          </div>
          {history.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 20, border: `1px solid ${BLUE[100]}`,
              padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
              <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15, color: '#1E293B', margin: '0 0 4px' }}>
                No checks yet
              </p>
              <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#94A3B8', margin: '0 0 16px' }}>
                Run your first ATS analysis
              </p>
              <Link to="/results" style={{
                padding: '9px 22px', borderRadius: 12, background: BLUE[600],
                color: 'white', fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600,
                textDecoration: 'none', display: 'inline-block',
              }}>Start Matching →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.slice(0, 5).map((h, i) => (
                <ActivityItem 
                   key={h.result_id}
                   icon="🎯" 
                   title={`ATS Check: ${h.recommendation?.replace(/_/g, ' ')}`}
                   desc={`${h.matched_keywords_count || 0} keywords matched`}
                   time={h.created_at?.slice(0, 10)} 
                   delay={0.42 + i * 0.05}
                />
              ))}
              <Link to="/analytics" style={{
                display: 'block', textAlign: 'center', padding: '10px',
                fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600,
                color: BLUE[600], textDecoration: 'none', marginTop: 4,
              }}>View All Activity →</Link>
            </div>
          )}
        </motion.div>
        
        {/* AI Career Insight */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 16, color: '#0F172A', margin: '0 0 2px' }}>
              AI Career Insight
            </p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8', margin: 0 }}>
              Personalized insight for you
            </p>
          </div>
          <div style={{
            background: `linear-gradient(145deg, ${BLUE[50]} 0%, white 100%)`,
            borderRadius: 20, border: `1px solid ${BLUE[200]}`,
            padding: '28px 28px', height: 'calc(100% - 40px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16,
            boxShadow: `0 4px 16px rgba(37,99,235,0.08)`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
              background: `linear-gradient(to top, ${BLUE[100]}44, transparent)`,
              pointerEvents: 'none',
            }}/>
            <div style={{
              width: 52, height: 52, borderRadius: 16, background: BLUE[50],
              border: `2px solid ${BLUE[200]}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 26,
            }}>💡</div>
            <div>
              <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15,
                color: '#0F172A', margin: '0 0 10px', lineHeight: 1.4 }}>
                Complete your profile and upload your resume to get personalized AI insights and recommendations.
              </p>
            </div>
            
            {history.length > 0 && history.slice(0, 3).map((h, i) => {
              const sc   = h.final_score || 0
              const pct  = Math.round(sc * 100)
              const st   = scoreStyle(sc)
              return (
                <div key={h.result_id} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 12, background: 'white',
                  border: `1px solid ${st.border}`, textAlign: 'left',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, background: st.bg,
                    border: `1px solid ${st.border}`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 14, color: st.color }}>
                      {pct}%
                    </span>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12,
                      color: st.color, margin: '0 0 2px', textTransform: 'capitalize' }}>
                      {h.recommendation?.replace(/_/g, ' ')}
                    </p>
                    <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#94A3B8', margin: 0 }}>
                      {h.matched_keywords_count || 0} keywords · {h.created_at?.slice(0, 10)}
                    </p>
                  </div>
                </div>
              )
            })}
            <Link to="/results" style={{
              width: '100%', textAlign: 'center', padding: '11px 0', borderRadius: 12,
              background: BLUE[600], color: 'white', fontFamily: "'Poppins',sans-serif",
              fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'block',
              boxShadow: `0 4px 14px rgba(37,99,235,0.3)`, position: 'relative', zIndex: 1,
            }}>
              Get Started
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ── Your Career Journey ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.50 }}
        style={{ background: 'white', borderRadius: 20, border: `1px solid ${BLUE[100]}`,
          padding: '28px 32px', boxShadow: `0 1px 4px rgba(37,99,235,0.06)` }}>
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 18, color: '#0F172A', margin: '0 0 4px' }}>
            Your Career Journey
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#94A3B8', margin: 0 }}>
            Track your progress and unlock achievements
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 24, left: '10%', right: '10%', height: 2,
            background: `linear-gradient(90deg, ${BLUE[600]} ${(journeyStep - 1) * 25}%, ${BLUE[100]} ${(journeyStep - 1) * 25}%)`,
            zIndex: 0,
          }}/>
          {[
            { num: '1', title: 'Get Started', desc: 'Create your profile' },
            { num: '2', title: 'Upload Resume', desc: 'Add your resume' },
            { num: '3', title: 'ATS Analysis', desc: 'Run your first test' },
            { num: '4', title: 'Practice', desc: 'Improve your skills' },
            { num: '5', title: 'Achieve', desc: 'Unlock opportunities' },
          ].map((step, i) => (
            <JourneyStep key={i} {...step}
              done={i < journeyStep - 1}
              active={i === journeyStep - 1}/>
          ))}
        </div>
      </motion.div>

      {/* ── Career Resources ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 18, color: '#0F172A', margin: '0 0 4px' }}>
            Career Resources
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#94A3B8', margin: 0 }}>
            Curated content to help you grow
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <ResourceCard
            tag="Resume Tips" tagColor="#1E40AF" tagBg="#DBEAFE"
            time="6 min" delay={0.57}
            title="How to Optimize Your Resume for ATS"
            desc="Learn the best practices to make your resume ATS-friendly"
          />
          <ResourceCard
            tag="Interview" tagColor="#065F46" tagBg="#D1FAE5"
            time="8 min" delay={0.60}
            title="Top 10 Interview Questions & Answers"
            desc="Prepare for common interview questions with expert answers"
          />
          <ResourceCard
            tag="Career Growth" tagColor="#92400E" tagBg="#FEF3C7"
            time="6 min" delay={0.63}
            title="Skills in Demand for 2024"
            desc="Discover the most in-demand skills in today's job market"
          />
          <ResourceCard
            tag="Job Search" tagColor="#7C3AED" tagBg="#EDE9FE"
            time="4 min" delay={0.66}
            title="How to Stand Out in Job Applications"
            desc="Tips to make your application stand out from the crowd"
          />
        </div>
      </motion.div>

      {/* ── CTA Banner ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.70 }}
        style={{
          borderRadius: 20, background: `linear-gradient(135deg, ${BLUE[900]} 0%, ${BLUE[700]} 100%)`,
          padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16, boxShadow: `0 8px 32px rgba(30,58,138,0.30)`, position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', right: -40, top: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
        }}/>
        <div>
          <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 20, color: 'white', margin: '0 0 6px' }}>
            Ready to take your career to new heights?
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: BLUE[300], margin: 0 }}>
            Join thousands of professionals who are already growing with AI.
          </p>
        </div>
        <Link to="/gamification" style={{
          padding: '13px 28px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 9,
          background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
          color: 'white', fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 14,
          textDecoration: 'none', boxShadow: '0 4px 16px rgba(251,191,36,0.45)',
          flexShrink: 0,
        }}>
          ⭐ Upgrade to Premium
        </Link>
      </motion.div>

      {/* ── AI Tips (if available) ── */}
      {tips.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}
          style={{ background: 'white', borderRadius: 20, border: `1px solid ${BLUE[100]}`,
            padding: '24px', boxShadow: `0 1px 4px rgba(37,99,235,0.06)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFFBEB',
              border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>💡</div>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15, color: '#0F172A', margin: 0 }}>
              AI Career Tips
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '14px',
                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: '#FDE68A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>
                  <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 10, color: '#92400E' }}>
                    {i + 1}
                  </span>
                </div>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#374151',
                  margin: 0, lineHeight: 1.65 }}>{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}