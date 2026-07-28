import { motion } from 'framer-motion'
import ScoreGauge from './ScoreGauge'

export default function FeedbackCard({ feedback, question, questionNumber, onNext, isLast }) {
  if (!feedback) return null

  const score = feedback.score || 0
  const criteriaScores = feedback.criteria_scores || {}
  const c = score >= 8 ? '#10B981' : score >= 6 ? '#2E9BDA' : score >= 4 ? '#F59E0B' : '#F43F5E'
  const border = score >= 8 ? 'border-emerald-200' : score >= 6 ? 'border-[#2E9BDA]/25' : score >= 4 ? 'border-amber-200' : 'border-rose-200'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-3xl border ${border} bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
    >
      <div className="px-6 pt-6 pb-4 border-b border-blue-50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-blue-900/60 font-mono">Q{questionNumber}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold" style={{ background: `${c}18`, color: c }}>
                {feedback.grade || 'N/A'}
              </span>
              {feedback.speed_bonus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">⚡ Speed Bonus +{feedback.bonus_points}pts</span>
              )}
            </div>
            <p className="text-[13.5px] text-blue-900/60 font-medium line-clamp-2 leading-relaxed">{question}</p>
          </div>
          <ScoreGauge score={score} maxScore={10} size={100} label="Score" showGrade={false} />
        </div>
      </div>

      <div className="px-6 py-4 border-b border-blue-50 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-blue-900/35 uppercase tracking-wide font-semibold">Confidence</span>
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: feedback.confidence_level === 'high' ? '#ECFDF5' : feedback.confidence_level === 'medium' ? '#EFF6FF' : '#FFF1F2',
              color: feedback.confidence_level === 'high' ? '#059669' : feedback.confidence_level === 'medium' ? '#1d6fa5' : '#E11D48',
            }}
          >
            {feedback.confidence_level || 'medium'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-blue-900/35 uppercase tracking-wide font-semibold">Points Earned</span>
          <span className="text-[13px] font-extrabold text-[#1d6fa5] font-mono">+{feedback.points_earned || 0}</span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {Object.keys(criteriaScores).length > 0 && (
          <div>
            <p className="text-[11px] font-extrabold text-blue-900/40 uppercase tracking-wider mb-3">Detailed Scores</p>
            <div className="grid grid-cols-2 gap-3.5">
              {Object.entries(criteriaScores).map(([key, val]) => {
                const pct = Math.round((val / 10) * 100)
                const cc = pct >= 70 ? '#10B981' : pct >= 50 ? '#2E9BDA' : '#F59E0B'
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between text-[12.5px]">
                      <span className="font-semibold text-blue-900/65 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-extrabold tabular-nums" style={{ color: cc }}>{val}/10</span>
                    </div>
                    <div className="h-1.5 bg-blue-50 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full" style={{ background: cc }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {feedback.strengths?.length > 0 && (
          <div>
            <p className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider mb-2">✓ Strengths</p>
            <div className="space-y-1.5">
              {feedback.strengths.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-start gap-2 text-[13px] font-medium text-blue-900/70">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-emerald-600 text-[9px]">✓</span>
                  </div>
                  {s}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {feedback.weaknesses?.length > 0 && (
          <div>
            <p className="text-[11px] font-extrabold text-rose-500 uppercase tracking-wider mb-2">Areas to Improve</p>
            <div className="space-y-1.5">
              {feedback.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] font-medium text-blue-900/70">
                  <div className="w-4 h-4 rounded-full bg-rose-50 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-rose-400 text-[9px]">→</span>
                  </div>
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {feedback.improved_answer && (
          <div>
            <p className="text-[11px] font-extrabold text-[#1d6fa5] uppercase tracking-wider mb-2">💡 Model Answer</p>
            <div className="p-4 rounded-2xl bg-[#2E9BDA]/[0.06] border border-[#2E9BDA]/20">
              <p className="text-[13.5px] text-blue-950/80 leading-relaxed font-medium">{feedback.improved_answer}</p>
            </div>
          </div>
        )}

        {feedback.detailed_feedback && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
            <span className="text-xl shrink-0">🧑‍💼</span>
            <p className="text-[13.5px] text-amber-900/85 leading-relaxed font-medium">{feedback.detailed_feedback}</p>
          </div>
        )}

        {feedback.key_missing_concepts?.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] font-mono text-blue-900/35 font-semibold">Missing:</span>
            {feedback.key_missing_concepts.map((c2, i) => (
              <span key={i} className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-mono">{c2}</span>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={onNext}
          className="w-full py-3 rounded-2xl font-bold text-[13.5px] transition-all duration-200 text-white hover:-translate-y-0.5 active:translate-y-0"
          style={{ background: isLast ? 'linear-gradient(135deg, #10B981, #059669)' : `linear-gradient(135deg, ${c}, ${c}CC)`, boxShadow: `0 6px 16px -6px ${c}66` }}
        >
          {isLast ? '🏆 View Final Results' : 'Next Question →'}
        </button>
      </div>
    </motion.div>
  )
}