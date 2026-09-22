import React from 'react';
import { Award, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AtsScoreCard({ data }) {
  const navigate = useNavigate();
  if (!data) return null;

  const score = Math.round(data.overall_score || data.score || 0);
  const matched = data.matched_keywords || data.matched_skills || [];
  const missing = data.missing_keywords || data.missing_skills || [];

  const scoreColor =
    score >= 80 ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
    score >= 60 ? 'text-amber-700 border-amber-200 bg-amber-50' :
    'text-rose-700 border-rose-200 bg-rose-50';

  const badgeBg =
    score >= 80 ? 'bg-emerald-500' :
    score >= 60 ? 'bg-amber-500' :
    'bg-rose-500';

  return (
    <div className="my-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-800 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Award size={13} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ATS Match Analysis</h4>
            <p className="text-xs font-bold text-slate-800">{data.job_title || 'Target Job Match'}</p>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded-full border text-xs font-bold flex items-center gap-1 ${scoreColor}`}>
          <span>{score}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ease-out rounded-full ${badgeBg}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      {/* Breakdown */}
      <div className="space-y-1.5 text-[11px]">
        {matched.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 mb-1">
              <CheckCircle2 size={11} /> Matched Strengths ({matched.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {matched.slice(0, 5).map((kw, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                  {kw}
                </span>
              ))}
              {matched.length > 5 && (
                <span className="px-1 py-0.5 text-slate-400 text-[10px]">+{matched.length - 5}</span>
              )}
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div className="mt-1.5">
            <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 mb-1">
              <AlertTriangle size={11} /> Missing Keywords ({missing.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {missing.slice(0, 5).map((kw, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                  {kw}
                </span>
              ))}
              {missing.length > 5 && (
                <span className="px-1 py-0.5 text-slate-400 text-[10px]">+{missing.length - 5}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action CTA */}
      <button
        onClick={() => navigate('/results')}
        className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
      >
        <span>View Full ATS Breakdown</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
