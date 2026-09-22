import React from 'react';
import { Briefcase, MapPin, Building, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function JobMatchCard({ data }) {
  const navigate = useNavigate();
  if (!data) return null;

  const jobs = data.jobs || [data];

  return (
    <div className="my-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-800 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <Briefcase size={13} />
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Jobs</h4>
          <p className="text-xs text-slate-500">Matching your current profile</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {jobs.slice(0, 3).map((job, idx) => (
          <div
            key={idx}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-colors flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{job.title || 'Software Engineer'}</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <span className="flex items-center gap-0.5 truncate">
                  <Building size={11} />
                  {job.company || 'Tech Co'}
                </span>
                {job.location && (
                  <span className="flex items-center gap-0.5 truncate">
                    <MapPin size={11} />
                    {job.location}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
            >
              <span>Apply</span>
              <ExternalLink size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
