import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  MapPin,
  DollarSign,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  Home,
  User,
  Leaf,
  Share2,
  ArrowRight,
} from 'lucide-react'
import CompanyLogo from '../common/CompanyLogo'
import {
  normalizeJob,
  resolveJobLogo,
  getCompanyWebsiteUrl,
  shareJobListing,
} from './jobHelpers'

export default function JobCard({
  job,
  isSelected = false,
  isApplied,
  isApplying,
  onCalculateMatch,
  onApply,
  onViewDetail,
  onShare,
}) {
  const safeJob = normalizeJob(job)
  const isFresher = safeJob.min_years === 0
  const logoUrl = resolveJobLogo(safeJob)
  const companySite = getCompanyWebsiteUrl(safeJob)
  const hasApplied = Boolean(job?.has_applied ?? isApplied)

  const displaySkills = useMemo(() => {
    if (Array.isArray(job?.required_skills) && job.required_skills.length > 0) {
      return job.required_skills
    }
    if (safeJob.department) return [safeJob.department, 'Full-time']
    return ['Full-time', 'Verified']
  }, [job?.required_skills, safeJob.department])

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onViewDetail}
      className={`group bg-white rounded-2xl border p-4 sm:p-4.5 transition-all duration-200 shadow-2xs hover:shadow-md relative cursor-pointer ${
        isSelected
          ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md bg-sky-50/5'
          : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Top: Logo + Company + Title + Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-blue-50/80 border border-slate-100 flex items-center justify-center shrink-0 p-1 shadow-2xs mt-0.5">
            <CompanyLogo
              companyName={safeJob.company_name}
              logoUrl={logoUrl}
              website={companySite}
              size="sm"
              showVerified={false}
            />
          </div>

          <div className="min-w-0 flex-1 pr-1">
            <h3
              onClick={(e) => {
                e.stopPropagation()
                onViewDetail()
              }}
              className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-sky-600 transition tracking-tight line-clamp-1 leading-snug cursor-pointer"
              title={safeJob.company_name}
            >
              {safeJob.company_name}
            </h3>
            <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5" title={safeJob.title}>
              {safeJob.title}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isFresher ? (
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10.5px] sm:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 inline-flex items-center gap-1 shadow-2xs">
              <Leaf size={11} className="text-emerald-600 fill-emerald-600/20 shrink-0" />
              <span className="hidden xs:inline sm:inline">Fresher Friendly</span>
              <span className="xs:hidden sm:hidden">Fresher</span>
            </span>
          ) : safeJob.is_external ? (
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10.5px] sm:text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80 inline-flex items-center gap-1 shadow-2xs">
              <ExternalLink size={11} />
              <span>{safeJob.publisher_source || 'External'}</span>
            </span>
          ) : (
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10.5px] sm:text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200/80 inline-flex items-center gap-1 shadow-2xs">
              <Sparkles size={11} className="text-sky-600" />
              <span>Direct</span>
            </span>
          )}
        </div>
      </div>

      {/* Metadata Chips */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700">
          <User size={11} className="text-slate-400 shrink-0" />
          <span>{safeJob.min_years === 0 ? 'Fresher (0–1 Yr)' : `${safeJob.min_years}+ Yrs Exp`}</span>
        </span>

        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700">
          <MapPin size={11} className="text-slate-400 shrink-0" />
          <span className="truncate max-w-[130px] sm:max-w-xs">{safeJob.location || 'Remote'}</span>
        </span>

        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700">
          <Home size={11} className="text-slate-400 shrink-0" />
          <span>{job.work_mode || (safeJob.location?.toLowerCase().includes('remote') ? 'Remote' : 'On-site')}</span>
        </span>

        {safeJob.salary_range && (
          <span className="inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700">
            <DollarSign size={11} className="text-emerald-600 shrink-0" />
            <span>{safeJob.salary_range}</span>
          </span>
        )}
      </div>

      {/* Snippet Preview */}
      {job.jd_text_raw && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">{job.jd_text_raw}</p>
      )}

      {/* Skills */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        {displaySkills.slice(0, 4).map((s, idx) => (
          <span
            key={idx}
            className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200/50 hover:bg-slate-100 transition"
          >
            {s}
          </span>
        ))}
        {displaySkills.length > 4 && (
          <span className="text-[11px] font-medium text-slate-400 pl-0.5">+{displaySkills.length - 4} more</span>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCalculateMatch()
          }}
          className="inline-flex items-center gap-1 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold bg-sky-50 hover:bg-sky-100/80 text-sky-600 border border-sky-200/70 transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Check Profile Compatibility Fit"
        >
          <TrendingUp size={13} className="text-sky-600 shrink-0" />
          <span>Profile Fit</span>
        </button>

        <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (onShare) onShare()
              else shareJobListing(job)
            }}
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-2xs shrink-0 active:scale-95"
            title="Share job link"
          >
            <Share2 size={13} />
          </button>

          {hasApplied ? (
            <span className="inline-flex items-center gap-1 px-4 py-1.5 sm:px-5 sm:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold select-none shadow-2xs">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              Applied
            </span>
          ) : (
            <button
              type="button"
              disabled={isApplying}
              onClick={(e) => {
                e.stopPropagation()
                onApply()
              }}
              className="inline-flex items-center gap-1.5 px-4.5 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50 shrink-0 active:scale-95"
            >
              {isApplying ? (
                'Applying...'
              ) : (
                <>
                  <span>Apply</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

