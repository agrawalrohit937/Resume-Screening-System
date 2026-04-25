import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { analyzeGitHub } from '../../services/api'

/* ── Language Colors ─────────────────────────────────── */
const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#F7DF1E', TypeScript: '#2B7489', Go: '#00ADD8',
  Rust: '#DEA584', Java: '#B07219', Ruby: '#701516', 'C++': '#F34B7D', 'C#': '#178600',
  Swift: '#FA7343', Kotlin: '#A97BFF', Shell: '#89E051', CSS: '#563D7C', HTML: '#E34C26',
  PHP: '#4F5D95', C: '#555555', Vue: '#41B883', Dart: '#00B4AB', Scala: '#C22D40',
  R: '#198CE7', MATLAB: '#E16737', SQL: '#C46633'
}

const pct = (v) => Math.round((v || 0) * 100)

/* ── Animated Bar ────────────────────────────────────── */
function AnimatedBar({ value, color, height = 4, delay = 0 }) {
  return (
    <div style={{ width: '100%', height, borderRadius: 100, background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct(value)}%` }}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', borderRadius: 100, background: color }}
      />
    </div>
  )
}

/* ── Score Ring ──────────────────────────────────────── */
function ScoreRing({ score, size = 44, stroke = 3.5 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = pct(score)
  const off = c - (p / 100) * c
  const color = p >= 75 ? '#34D399' : p >= 50 ? '#60A5FA' : '#F87171'

  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: size * 0.28, color }}>
        {p}
      </span>
    </div>
  )
}

/* ── Hirability Badge ────────────────────────────────── */
function HirabilityBadge({ label, active }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 20,
      background: active ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.06)',
      border: `1px solid ${active ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.12)'}`,
    }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(16,185,129,0.9)' : 'rgba(148,163,184,0.35)', fontSize: 8, fontWeight: 700, color: 'white'
      }}>
        {active ? '✓' : '—'}
      </span>
      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, color: active ? '#34D399' : '#94A3B8' }}>
        {label}
      </span>
    </div>
  )
}

/* ── Tooltip Arrow ───────────────────────────────────── */
function TooltipArrow({ top, x }) {
  return (
    <div style={{
      position: 'fixed',
      left: x,
      top: top ? undefined : '100%',
      bottom: top ? '100%' : undefined,
      transform: 'translateX(-50%)',
      width: 16,
      height: 8,
      zIndex: 10001,
      pointerEvents: 'none',
    }}>
      <svg viewBox="0 0 16 8" width={16} height={8} style={{ display: 'block' }}>
        {top ? (
          <path d="M0 0L8 8L16 0H0Z" fill="rgba(15,23,42,0.85)" />
        ) : (
          <path d="M0 8L8 0L16 8H0Z" fill="rgba(15,23,42,0.85)" />
        )}
      </svg>
    </div>
  )
}

/* ── Position Hook ───────────────────────────────────── */
function useTooltipPosition(triggerRef, open) {
  const [pos, setPos] = useState({ x: 0, y: 0, arrowX: 0, showAbove: false })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipWidth = 380
    const tooltipHeight = 480
    const margin = 16
    const arrowOffset = 0

    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    let showAbove = true

    // Horizontal bounds
    if (left < margin) left = margin
    if (left + tooltipWidth > window.innerWidth - margin) left = window.innerWidth - tooltipWidth - margin

    // Vertical: prefer above, flip to below if not enough room
    let top = rect.top - tooltipHeight - margin + arrowOffset
    if (top < margin) {
      top = rect.bottom + margin - arrowOffset
      showAbove = false
    }

    setPos({
      x: left,
      y: top,
      arrowX: rect.left + rect.width / 2,
      showAbove
    })
  }, [open, triggerRef])

  return pos
}

/* ── Main Component ──────────────────────────────────── */
export default function GithubHoverCard({ username }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const triggerRef = useRef(null)
  const pos = useTooltipPosition(triggerRef, open)

  const load = useCallback(async () => {
    if (data || loading || !username) return
    setLoading(true)
    try {
      const { data: res } = await analyzeGitHub({ username })
      setData(res.data || res)
    } catch {
      setData({ err: true })
    } finally { setLoading(false) }
  }, [data, loading, username])

  const handleEnter = () => {
    clearTimeout(timer.current)
    setOpen(true)
    load()
  }

  const handleLeave = () => {
    timer.current = setTimeout(() => setOpen(false), 250)
  }

  if (!username) {
    return (
      <span style={{
        padding: '5px 11px', borderRadius: 10, border: '1.5px solid #E2E8F0',
        background: '#F8FAFC', fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, color: '#CBD5E1'
      }}>
        🐙 GitHub
      </span>
    )
  }

  const d = data
  const profile = d?.profile || {}
  const langs = Object.entries(d?.languages || {})
  const totalLang = langs.reduce((s, [, c]) => s + c, 0)
  const techStack = d?.tech_stack || []
  const topRepos = d?.top_repositories || []
  const hirability = d?.hirability_signals || {}
  const insights = d?.insights || []

  const tooltipContent = (
    <AnimatePresence>
      {open && (
        <>
          <TooltipArrow top={!pos.showAbove} x={pos.arrowX} />
          <motion.div
            initial={{ opacity: 0, y: pos.showAbove ? -12 : 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: pos.showAbove ? -12 : 12, scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={() => setOpen(false)}
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              width: 380,
              maxHeight: 520,
              zIndex: 10000,
              borderRadius: 20,
              overflow: 'hidden',
              background: 'rgba(15,23,42,0.88)',
              backdropFilter: 'blur(24px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 64px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Loading */}
            {loading && !d ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{
                  width: 28, height: 28, margin: '0 auto 10px', borderRadius: '50%',
                  border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#818CF8',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8' }}>Loading profile…</p>
              </div>
            ) : d?.err ? (
              <div style={{ padding: '28px', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#F87171' }}>⚠ Profile unavailable</p>
              </div>
            ) : d ? (
              <div style={{ maxHeight: 520, overflowY: 'auto' }} className="gh-scroll">

                {/* ── Header ── */}
                <div style={{
                  padding: '20px 22px 16px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.1))',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: 14
                }}>
                  {profile.avatar_url ? (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={profile.avatar_url}
                        alt=""
                        style={{
                          width: 54, height: 54, borderRadius: 16,
                          border: '2px solid rgba(255,255,255,0.15)',
                          boxShadow: '0 0 0 4px rgba(99,102,241,0.25), 0 8px 20px rgba(0,0,0,0.3)'
                        }}
                      />
                      <div style={{
                        position: 'absolute', bottom: -2, right: -2, width: 16, height: 16,
                        borderRadius: '50%', background: '#10B981',
                        border: '2.5px solid rgba(15,23,42,0.9)',
                        boxShadow: '0 0 0 2px rgba(16,185,129,0.4)'
                      }} />
                    </div>
                  ) : (
                    <div style={{
                      width: 54, height: 54, borderRadius: 16,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                    }}>🐙</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 16, color: '#F8FAFC',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3
                    }}>
                      {profile.name || username}
                    </p>
                    <a
                      href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#818CF8',
                        textDecoration: 'none', display: 'inline-block', marginTop: 2
                      }}
                    >
                      @{username} ↗
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#94A3B8' }}>
                        ⭐ {d?.total_stars || topRepos.reduce((s, r) => s + (r.stars || 0), 0)}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#94A3B8' }}>
                        📦 {profile.public_repos || 0} repos
                      </span>
                      {d?.contribution_score !== undefined && (
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#34D399', fontWeight: 700 }}>
                          🏆 Score: {pct(d.contribution_score)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ScoreRing score={d?.contribution_score || 0} size={56} />
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* ── Languages ── */}
                  {langs.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <p style={{
                          fontFamily: "'Inter',sans-serif", fontSize: 9, fontWeight: 700, color: '#94A3B8',
                          textTransform: 'uppercase', letterSpacing: '0.08em'
                        }}>Languages</p>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#64748B' }}>
                          {langs.length} total
                        </span>
                      </div>
                      <div style={{ display: 'flex', height: 5, borderRadius: 100, overflow: 'hidden', marginBottom: 8 }}>
                        {langs.slice(0, 5).map(([lang, count]) => {
                          const w = totalLang > 0 ? (count / totalLang) * 100 : 0
                          return (
                            <motion.div
                              key={lang}
                              initial={{ width: 0 }}
                              animate={{ width: `${w}%` }}
                              transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
                              style={{ background: LANG_COLORS[lang] || '#818CF8', height: '100%' }}
                              title={`${lang}: ${count}`}
                            />
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {langs.slice(0, 5).map(([lang, count]) => (
                          <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: LANG_COLORS[lang] || '#818CF8' }} />
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#CBD5E1' }}>{lang}</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#64748B' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Tech Stack ── */}
                  {techStack.length > 0 && (
                    <div>
                      <p style={{
                        fontFamily: "'Inter',sans-serif", fontSize: 9, fontWeight: 700, color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6
                      }}>Tech Stack</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {techStack.slice(0, 8).map((tech) => (
                          <span key={tech} style={{
                            padding: '3px 9px', borderRadius: 20,
                            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                            fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#A5B4FC', fontWeight: 600
                          }}>
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Hirability ── */}
                  {Object.keys(hirability).length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <p style={{
                          fontFamily: "'Inter',sans-serif", fontSize: 9, fontWeight: 700, color: '#94A3B8',
                          textTransform: 'uppercase', letterSpacing: '0.08em'
                        }}>Hirability</p>
                        {hirability.open_source_score !== undefined && (
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#34D399', fontWeight: 700 }}>
                            {pct(hirability.open_source_score)}% OSS
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                        <HirabilityBadge label="READMEs" active={hirability.has_readme} />
                        <HirabilityBadge label="Recent" active={hirability.active_recently} />
                        <HirabilityBadge label="Polyglot" active={hirability.multiple_languages} />
                        <HirabilityBadge label="Popular" active={hirability.popular_projects} />
                        <HirabilityBadge label="Collab" active={hirability.collaboration_indicator} />
                      </div>
                      {hirability.open_source_score !== undefined && (
                        <AnimatedBar value={hirability.open_source_score} color="#34D399" height={4} delay={0.2} />
                      )}
                    </div>
                  )}

                  {/* ── Top Repos ── */}
                  {topRepos.length > 0 && (
                    <div>
                      <p style={{
                        fontFamily: "'Inter',sans-serif", fontSize: 9, fontWeight: 700, color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7
                      }}>Top Repositories</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {topRepos.slice(0, 3).map((repo, i) => (
                          <motion.a
                            key={repo.name}
                            href={repo.url} target="_blank" rel="noopener noreferrer"
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 3,
                              padding: '8px 12px', borderRadius: 12,
                              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                              textDecoration: 'none', transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.18)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{
                                fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, color: '#E2E8F0',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 230
                              }}>
                                {repo.name}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#FBBF24', flexShrink: 0 }}>
                                ★ {repo.stars}
                              </span>
                            </div>
                            {repo.description && (
                              <span style={{
                                fontFamily: "'Inter',sans-serif", fontSize: 9, color: '#94A3B8',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                              }}>
                                {repo.description}
                              </span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                              {repo.language && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#94A3B8' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: LANG_COLORS[repo.language] || '#818CF8' }} />
                                  {repo.language}
                                </span>
                              )}
                              {repo.forks > 0 && (
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#64748B' }}>🍴 {repo.forks}</span>
                              )}
                              {repo.topics?.slice(0, 2).map(t => (
                                <span key={t} style={{
                                  padding: '1px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.05)',
                                  fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: '#64748B'
                                }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </motion.a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Insights ── */}
                  {insights.length > 0 && (
                    <div style={{
                      padding: '12px 14px', borderRadius: 14,
                      background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(99,102,241,0.06))',
                      border: '1px solid rgba(14,165,233,0.12)'
                    }}>
                      <p style={{
                        fontFamily: "'Inter',sans-serif", fontSize: 9, fontWeight: 700, color: '#38BDF8',
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6
                      }}>AI Insights</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {insights.slice(0, 3).map((insight, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ color: '#0EA5E9', fontSize: 10, marginTop: 2, flexShrink: 0 }}>→</span>
                            <span style={{
                              fontFamily: "'Inter',sans-serif", fontSize: 10, color: '#BAE6FD', lineHeight: 1.5
                            }}>
                              {insight}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 11px', borderRadius: 10, border: '1.5px solid #E2E8F0',
          background: '#F8FAFC', fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, color: '#475569',
          cursor: 'pointer', transition: 'all 0.15s'
        }}
        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#818CF8'; e.currentTarget.style.color = '#4F46E5' }}
        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569' }}
      >
        🐙 @{username}
      </span>
      {createPortal(tooltipContent, document.body)}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .gh-scroll::-webkit-scrollbar { width: 3px; }
        .gh-scroll::-webkit-scrollbar-track { background: transparent; }
        .gh-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 4px; }
      `}</style>
    </>
  )
}

