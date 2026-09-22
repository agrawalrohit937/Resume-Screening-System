import React from 'react';
import { Compass, Calendar, CheckSquare, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LearningRoadmapCard({ data }) {
  const navigate = useNavigate();
  if (!data) return null;

  const targetRole = data.target_role || 'Target Role';
  const duration = data.estimated_duration || '4-8 Weeks';
  const phases = data.phases || data.modules || [];

  return (
    <div className="my-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-800 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Compass size={13} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Career Roadmap</h4>
            <p className="text-xs font-bold text-slate-800">{targetRole}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
          <Calendar size={11} />
          <span>{duration}</span>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="relative pl-3 space-y-2.5 border-l-2 border-slate-200 my-2 ml-1">
        {phases.map((phase, idx) => (
          <div key={idx} className="relative">
            <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-white" />
            <div>
              <p className="text-xs font-bold text-slate-800">
                Phase {idx + 1}: {phase.title || phase.name || `Milestone ${idx + 1}`}
              </p>
              {phase.description && (
                <p className="text-[11px] text-slate-500 mt-0.5">{phase.description}</p>
              )}
              {phase.skills && Array.isArray(phase.skills) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {phase.skills.map((s, si) => (
                    <span key={si} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/careers')}
        className="mt-2.5 w-full py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
      >
        <span>Explore Career Paths</span>
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
