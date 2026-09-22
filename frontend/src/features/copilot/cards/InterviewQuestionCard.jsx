import React, { useState } from 'react';
import { HelpCircle, Mic, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function InterviewQuestionCard({ data }) {
  const navigate = useNavigate();
  const [showStarGuide, setShowStarGuide] = useState(false);
  if (!data) return null;

  const questions = data.questions || [];
  const primaryQ = questions[0] || {
    question: data.question || "Tell me about a challenging distributed systems incident you resolved.",
    difficulty: data.difficulty || "Intermediate",
    rubric: data.rubric || "Focus on root cause analysis, MTTR reduction, and post-mortem actions.",
  };

  const diffColor =
    primaryQ.difficulty?.toLowerCase() === 'hard' ? 'text-rose-700 bg-rose-50 border-rose-200' :
    primaryQ.difficulty?.toLowerCase() === 'easy' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="my-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-800 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <HelpCircle size={13} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Interview Question</h4>
            <p className="text-xs text-slate-500">{data.role || 'Role Specific'}</p>
          </div>
        </div>
        {primaryQ.difficulty && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${diffColor}`}>
            {primaryQ.difficulty}
          </span>
        )}
      </div>

      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 my-2">
        <p className="text-xs font-semibold text-slate-800 leading-relaxed">
          "{primaryQ.question}"
        </p>
      </div>

      {primaryQ.rubric && (
        <div className="mt-1.5">
          <button
            onClick={() => setShowStarGuide(!showStarGuide)}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Sparkles size={11} />
            <span>{showStarGuide ? 'Hide STAR Answering Rubric' : 'View STAR Answering Rubric'}</span>
            {showStarGuide ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showStarGuide && (
            <div className="mt-1.5 p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-[11px] text-slate-700 space-y-1">
              <p><strong className="text-indigo-800">Target Rubric:</strong> {primaryQ.rubric}</p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => navigate('/interview')}
        className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
      >
        <Mic size={12} />
        <span>Practice in Voice Interview Room</span>
      </button>
    </div>
  );
}
