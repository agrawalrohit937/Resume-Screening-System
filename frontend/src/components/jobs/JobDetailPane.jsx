import React from 'react'
import {
  Briefcase,
  Building2,
  MapPin,
  DollarSign,
  Sparkles,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  Award,
  ShieldCheck,
  Bookmark,
  BookmarkCheck,
  Share2,
} from 'lucide-react'
import CompanyLogo from '../common/CompanyLogo'
import { resolveJobLogo, getCompanyWebsiteUrl } from './jobHelpers'

export default function JobDetailPane({
  job,
  isApplied,
  isApplying,
  isSaved,
  onApply,
  onShare,
  onClose,
  onCalculateMatch,
  onToggleSave,
}) {
  if (!job) return null
  const siteUrl = getCompanyWebsiteUrl(job)
  const logoUrl = resolveJobLogo(job)

  return (
    <div className="w-full lg:w-[45%] h-auto lg:h-[calc(100vh-120px)] lg:sticky lg:top-24 overflow-y-auto bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 custom-scrollbar flex flex-col justify-between">
      <div>
        {/* Mobile Back Button */}
        <div className="lg:hidden mb-3 pb-3 border-b border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition py-1.5 px-3 rounded-xl bg-indigo-50 border border-indigo-100"
          >
            <ChevronRight size={14} className="rotate-180" />
            Back to All Open Roles
          </button>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Job Details</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {siteUrl ? (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Visit ${job.company_name} official website`}
                className="shrink-0 hover:scale-105 transition-transform"
              >
                <CompanyLogo companyName={job.company_name} logoUrl={logoUrl} website={siteUrl} size="md" showVerified />
              </a>
            ) : (
              <div className="shrink-0">
                <CompanyLogo companyName={job.company_name} logoUrl={logoUrl} size="md" showVerified />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight break-words" title={job.title}>
                {job.title}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {siteUrl ? (
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 hover:underline transition truncate inline-flex items-center gap-1"
                  >
                    <span>{job.company_name}</span>
                    <ExternalLink size={11} className="text-slate-400 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs sm:text-sm font-bold text-slate-700 truncate">{job.company_name}</span>
                )}
                {job.is_external ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                    <ExternalLink size={10} />
                    {job.publisher_source || 'External'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                    <ShieldCheck size={10} className="text-emerald-700" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0 justify-end w-full sm:w-auto pt-1 sm:pt-0">
            {isApplied ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold select-none">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                Applied
              </span>
            ) : (
              <button
                type="button"
                disabled={isApplying}
                onClick={onApply}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isApplying ? (
                  'Applying...'
                ) : (
                  <>
                    <span className="truncate max-w-[130px] sm:max-w-none">
                      {job.is_external ? `Apply on ${job.publisher_source || 'Site'}` : 'Apply Now'}
                    </span>
                    <ArrowUpRight size={13} className="shrink-0" />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onShare}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
              title="Share job link"
            >
              <Share2 size={15} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
              title="Close details"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Metadata Chips */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
            <MapPin size={12} className="text-slate-400" />
            <span>{job.location || 'Remote'}</span>
            {job.work_mode && <span className="text-slate-400">({job.work_mode})</span>}
          </span>

          <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
            <Award size={12} className="text-slate-400" />
            <span>{job.min_years === 0 ? 'Fresher (0-1 yr)' : `${job.min_years}+ Yrs Exp`}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
            <DollarSign size={12} className={job.salary_range ? 'text-emerald-600' : 'text-slate-400'} />
            <span className={job.salary_range ? 'text-emerald-700 font-semibold' : ''}>
              {job.salary_range || 'Competitive'}
            </span>
          </span>

          {job.department && (
            <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
              <Building2 size={12} className="text-slate-400" />
              <span>{job.department}</span>
            </span>
          )}
        </div>

        {/* Required Tech Stack */}
        {job.required_skills?.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-600" />
              Required Tech Stack
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {job.required_skills.map((skill, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/80">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Job Description */}
        <div className="mt-5">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Briefcase size={12} className="text-indigo-600" />
            Role Description
          </h4>
          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-2xl border border-slate-100 font-sans">
            {job.jd_text_raw || 'Detailed specifications, requirements, and responsibilities for this role are being updated by the hiring team.'}
          </div>
        </div>

        {/* Company Info Card */}
        {(job.company_about || job.company_website) && (
          <div className="mt-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">About {job.company_name}</span>
              {job.company_website && (
                <a
                  href={job.company_website.startsWith('http') ? job.company_website : `https://${job.company_website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>Visit Site</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
            {job.company_about && <p className="text-xs text-slate-600 leading-relaxed">{job.company_about}</p>}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="pt-4 mt-5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <button
          type="button"
          onClick={onCalculateMatch}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer shadow-2xs"
        >
          <Sparkles size={14} className="text-indigo-600" />
          <span>Check Profile Fit</span>
        </button>

        <button
          type="button"
          onClick={onToggleSave}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            isSaved
              ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
          }`}
        >
          {isSaved ? (
            <>
              <BookmarkCheck size={14} className="text-amber-600" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Bookmark size={14} className="text-slate-500" />
              <span>Save Job</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

