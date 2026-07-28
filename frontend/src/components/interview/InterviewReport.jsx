/**
 * InterviewReport — redesigned for clarity over decoration.
 *
 * Same field names as before (no invented backend fields):
 *  session.overall_score, session.avg_confidence, session.avg_clarity,
 *  session.job_title, session.strength_areas, session.weakness_areas,
 *  session.cheating_score, session.warning_count,
 *  summary.hiring_recommendation, summary.executive_summary,
 *  summary.skill_radar.{technical_knowledge,communication,problem_solving,
 *  confidence,interview_readiness}, summary.top_strengths,
 *  summary.critical_gaps, summary.next_steps,
 *  cheatingData.score, cheatingData.warning_count,
 *  answers[].{category,question_text,answer,reattempted,answer_source,
 *  evaluation.{overall_score,grade,relevance_score,clarity_score,
 *  confidence_score,technical_score,feedback,ideal_answer_summary,
 *  improvement_tips,keywords_found,keywords_missing}}
 *
 * Anything missing just falls back gracefully — see TODO comments.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, ThumbsUp, HelpCircle, XCircle, ClipboardList, ShieldCheck,
  TrendingUp, TrendingDown, Rocket, RotateCcw, BarChart3, Mic,
} from 'lucide-react'
import { SkillBreakdownBars, QuestionScoreStrip } from '../Charts'

const scoreColor = (v) => (v >= 80 ? '#10B981' : v >= 60 ? '#2E9BDA' : v >= 40 ? '#F59E0B' : '#F43F5E')
const scoreBg = (v) => (v >= 80 ? 'bg-emerald-50 border-emerald-200' : v >= 60 ? 'bg-[#2E9BDA]/[0.06] border-[#2E9BDA]/20' : v >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200')
const verdict = (v) => (v >= 80 ? 'Strong performance' : v >= 60 ? 'Solid performance' : v >= 40 ? 'Needs work' : 'Significant gaps to close')

// ── Hiring recommendation chip ─────────────────────────────────────────────
function HiringBadge({ rec }) {
  const CFG = {
    'Strong Yes': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', Icon: CheckCircle2 },
    Yes: { bg: 'bg-[#2E9BDA]/[0.08]', border: 'border-[#2E9BDA]/25', text: 'text-[#1d6fa5]', Icon: ThumbsUp },
    Maybe: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', Icon: HelpCircle },
    No: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', Icon: XCircle },
  }
  const cfg = CFG[rec] || { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', Icon: ClipboardList }
  const { Icon } = cfg
  return (
    <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
      <Icon className={`h-4 w-4 ${cfg.text}`} />
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.text} opacity-70`}>Hiring Recommendation</p>
        <p className={`text-[15px] font-extrabold ${cfg.text}`}>{rec}</p>
      </div>
    </div>
  )
}

// ── Big overall score — the hero number, unmissable ────────────────────────
function HeroScore({ score, size = 128 }) {
  const c = scoreColor(score)
  const r = size / 2 - 9
  const circ = 2 * Math.PI * r
  const off = circ - (score / 100) * circ
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={9} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black tabular-nums leading-none text-white" style={{ fontSize: size * 0.28 }}>{Math.round(score)}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 mt-1">Overall</span>
      </div>
    </div>
  )
}

// ── Small secondary score chip (Confidence / Clarity) ──────────────────────
function MiniScore({ label, score }) {
  const c = scoreColor(score)
  return (
    <div className="flex flex-col items-center gap-1.5 bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3 min-w-[84px]">
      <span className="text-[20px] font-extrabold tabular-nums leading-none" style={{ color: c }}>{Math.round(score)}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</span>
    </div>
  )
}

// ── Q&A card ────────────────────────────────────────────────────────────────
function AnswerCard({ item, index }) {
  const score = Math.round(item.evaluation?.overall_score || 0)
  const c = scoreColor(score)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`rounded-3xl border overflow-hidden ${scoreBg(score)}`}>
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-extrabold shrink-0" style={{ background: c }}>
            {String(index + 1).padStart(2, '0')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider font-mono" style={{ color: c }}>{item.category /* TODO: fallback if backend omits category */ || 'General'}</span>
              {item.reattempted && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono font-bold">Reattempted</span>}
              {item.answer_source === 'voice' && (
                <span className="text-[10px] bg-[#2E9BDA]/10 text-[#1d6fa5] px-2 py-0.5 rounded-full font-mono font-bold inline-flex items-center gap-1">
                  <Mic className="h-2.5 w-2.5" /> Voice
                </span>
              )}
            </div>
            <p className="text-[14px] font-bold text-blue-950 leading-relaxed">{item.question_text}</p>
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: c }}>{score}</p>
          <p className="text-[10px] text-blue-900/35 font-semibold">/ 100</p>
          <p className="text-[11px] font-extrabold mt-0.5" style={{ color: c }}>{item.evaluation?.grade || '—'}</p>
        </div>
      </div>

      <div className="px-5 py-4 bg-white border-t border-blue-50/80">
        <p className="text-[11px] font-extrabold text-blue-900/40 uppercase tracking-wider mb-1.5">Your Answer</p>
        <p className="text-[13px] text-blue-900/70 leading-relaxed bg-slate-50 px-3.5 py-2.5 rounded-xl border border-blue-50 font-medium">{item.answer || '—'}</p>

        <div className="grid grid-cols-4 gap-2.5 mt-4">
          {[
            ['Relevance', item.evaluation?.relevance_score],
            ['Clarity', item.evaluation?.clarity_score],
            ['Confidence', item.evaluation?.confidence_score],
            ['Technical', item.evaluation?.technical_score],
          ].map(([label, val]) => {
            const v = Math.round(val || 0)
            const cc = scoreColor(v)
            return (
              <div key={label} className="text-center p-2.5 rounded-xl bg-slate-50 border border-blue-50">
                <p className="text-[17px] font-extrabold tabular-nums" style={{ color: cc }}>{v}</p>
                <p className="text-[9px] text-blue-900/40 font-bold uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            )
          })}
        </div>

        {item.evaluation?.feedback && (
          <div className="mt-4 p-3.5 rounded-2xl bg-[#2E9BDA]/[0.06] border border-[#2E9BDA]/15">
            <p className="text-[11px] font-extrabold text-[#1d6fa5] mb-1">🤖 AI Feedback</p>
            <p className="text-[13px] text-blue-950/75 leading-relaxed font-medium">{item.evaluation.feedback}</p>
          </div>
        )}

        {item.evaluation?.ideal_answer_summary && (
          <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
            <p className="text-[11px] font-extrabold text-emerald-700 mb-1">💡 Model Answer</p>
            <p className="text-[13px] text-emerald-900/75 leading-relaxed font-medium">{item.evaluation.ideal_answer_summary}</p>
          </div>
        )}

        {item.evaluation?.improvement_tips?.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-extrabold text-blue-900/40 uppercase tracking-wider mb-2">Improvement Tips</p>
            <div className="space-y-1.5">
              {item.evaluation.improvement_tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px] text-blue-900/65 font-medium">
                  <span className="text-[#2E9BDA] shrink-0 mt-0.5">→</span>{tip}
                </div>
              ))}
            </div>
          </div>
        )}

        {(item.evaluation?.keywords_found?.length > 0 || item.evaluation?.keywords_missing?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.evaluation.keywords_found?.slice(0, 6).map((k) => (
              <span key={k} className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">✓ {k}</span>
            ))}
            {item.evaluation.keywords_missing?.slice(0, 6).map((k) => (
              <span key={k} className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-rose-50 text-rose-700 border border-rose-200">✕ {k}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Report ─────────────────────────────────────────────────────────────
export default function InterviewReport({ reportData, cheatingData, answers, onRestart }) {
  if (!reportData) return null
  const { session, summary } = reportData
  const overall = session?.overall_score || 0
  const cheatPct = Math.round((cheatingData?.score || session?.cheating_score || 0) * 100)
  const warnings = cheatingData?.warning_count || session?.warning_count || 0
  const cheatColor = cheatPct > 50 ? '#F43F5E' : cheatPct > 20 ? '#F59E0B' : '#10B981'

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-14">
      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden p-7 sm:p-8"
        style={{ background: 'linear-gradient(135deg,#071B38 0%,#0A2347 20%,#1246A0 65%,#1565C0 100%)' }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.7) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-[240px]">
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-[0.12em] mb-2">Interview Complete</p>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-white leading-tight mb-1">{session?.job_title || 'Interview'} Report</h1>
            <p className="text-[14px] font-semibold mb-4" style={{ color: scoreColor(overall) }}>{verdict(overall)}</p>
            {summary?.hiring_recommendation && <HiringBadge rec={summary.hiring_recommendation} />}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <HeroScore score={overall} />
            <div className="flex gap-3 flex-wrap">
              <MiniScore label="Confidence" score={session?.avg_confidence || 0} />
              <MiniScore label="Clarity" score={session?.avg_clarity || 0} />
              <div className="flex flex-col items-center gap-1.5 bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3 min-w-[84px]">
                <span className="text-[20px] font-extrabold tabular-nums leading-none inline-flex items-center gap-1" style={{ color: cheatColor }}>
                  <ShieldCheck className="h-4 w-4" /> {cheatPct}%
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">Integrity{warnings > 0 ? ` · ${warnings}⚠` : ''}</span>
              </div>
            </div>
          </div>
        </div>

        {summary?.executive_summary && (
          <div className="relative mt-5 p-4 rounded-2xl bg-white/[0.08] border border-white/10">
            <p className="text-[13.5px] text-white/85 leading-relaxed font-medium">"{summary.executive_summary}"</p>
          </div>
        )}
      </motion.div>

      {/* ── Skill breakdown + question timeline (replaces the old radar/bar charts) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {summary?.skill_radar && (
          <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-[15px] font-extrabold text-blue-950">Skill Breakdown</h3>
            <p className="text-[12px] text-blue-900/40 font-medium mb-5">Where you're strongest, and where to focus next</p>
            <SkillBreakdownBars skillRadar={summary.skill_radar} />
          </div>
        )}

        {answers?.length > 0 && (
          <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-[15px] font-extrabold text-blue-950 inline-flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#1d6fa5]" /> Score per Question
            </h3>
            <p className="text-[12px] text-blue-900/40 font-medium mb-5">How each answer scored, in order</p>
            <QuestionScoreStrip answers={answers} />
          </div>
        )}
      </div>

      {/* ── Strengths / Gaps / Next Steps ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Top Strengths', items: summary?.top_strengths || session?.strength_areas || [], color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200', Icon: TrendingUp },
          { title: 'Critical Gaps', items: summary?.critical_gaps || session?.weakness_areas || [], color: '#BE123C', bg: 'bg-rose-50', border: 'border-rose-200', Icon: TrendingDown },
          { title: 'Next Steps', items: summary?.next_steps || [], color: '#1d6fa5', bg: 'bg-[#2E9BDA]/[0.06]', border: 'border-[#2E9BDA]/20', Icon: Rocket },
        ].map(({ title, items, color, bg, border, Icon }) => (
          <div key={title} className={`rounded-3xl p-5 border ${bg} ${border}`}>
            <p className="text-[13px] font-extrabold mb-3 inline-flex items-center gap-1.5" style={{ color }}>
              <Icon className="h-4 w-4" /> {title}
            </p>
            <div className="space-y-2">
              {items.slice(0, 4).map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px] font-medium" style={{ color }}>
                  <span className="shrink-0 mt-0.5 opacity-70">→</span>{item}
                </div>
              ))}
              {items.length === 0 && <p className="text-[12px] text-blue-900/30 font-mono">— TODO: not returned by backend for this session</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Q&A Breakdown ── */}
      <div>
        <h2 className="text-[18px] font-extrabold text-blue-950 mb-4">Question-by-Question Breakdown</h2>
        <div className="space-y-4">
          {answers.map((item, i) => <AnswerCard key={i} item={item} index={i} />)}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <button onClick={onRestart} className="py-4 rounded-2xl font-bold text-[13.5px] text-[#1d6fa5] border-2 border-[#2E9BDA]/25 bg-[#2E9BDA]/[0.06] transition-all hover:-translate-y-0.5 inline-flex items-center justify-center gap-2">
          <RotateCcw className="h-4 w-4" /> Start New Interview
        </button>
        <Link
          to="/interview"
          className="py-4 rounded-2xl font-bold text-[13.5px] text-white text-center transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#2E9BDA,#1d6fa5)', boxShadow: '0 8px 20px -8px rgba(46,155,218,0.5)' }}
        >
          <BarChart3 className="h-4 w-4" /> Quick Mock Test
        </Link>
      </div>
    </div>
  )
}