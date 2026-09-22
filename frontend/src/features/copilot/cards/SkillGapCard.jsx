import React from 'react';
import { Layers, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SkillGapCard({ data }) {
  const navigate = useNavigate();
  if (!data) return null;

  const candidateSkills = data.candidate_skills || [];
  const requiredSkills = data.required_skills || [];
  const gapSkills = data.missing_skills || requiredSkills.filter(r => !candidateSkills.includes(r));

  return (
    <div className="my-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-800 text-xs">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
          <Layers size={13} />
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skill Gap Matrix</h4>
          <p className="text-xs font-bold text-slate-800">{data.target_role || 'Target Role Analysis'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-2.5">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 mb-1">
            <CheckCircle size={11} /> Acquired ({candidateSkills.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {candidateSkills.slice(0, 5).map((s, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                {s}
              </span>
            ))}
            {candidateSkills.length > 5 && (
              <span className="text-[10px] text-slate-400">+{candidateSkills.length - 5}</span>
            )}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1 mb-1">
            <XCircle size={11} /> Missing Gaps ({gapSkills.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {gapSkills.slice(0, 5).map((s, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-medium border border-rose-200">
                {s}
              </span>
            ))}
            {gapSkills.length > 5 && (
              <span className="text-[10px] text-slate-400">+{gapSkills.length - 5}</span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/upload')}
        className="w-full py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all border border-slate-200 cursor-pointer"
      >
        <span>Update Resume Skills</span>
      </button>
    </div>
  );
}
