import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight, Briefcase } from 'lucide-react'

export default function RecommendedJobs() {
  const navigate = useNavigate()

  return (
    <div 
      onClick={() => navigate('/jobs')}
      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-indigo-200 p-4 sm:p-6 shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer group"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Explore Jobs
              </span>
              <span className="text-xs text-slate-400 font-bold">•</span>
              <span className="text-xs text-slate-500 font-medium">Marketplace Openings</span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Find Jobs Matched to Your Profile
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl leading-relaxed">
              Explore open roles across top employers, view salary benchmarks, and discover opportunities aligned with your skills.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate('/jobs')
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all shrink-0 cursor-pointer whitespace-nowrap"
        >
          <Sparkles size={14} />
          <span>Find My Matches</span>
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  )
}
