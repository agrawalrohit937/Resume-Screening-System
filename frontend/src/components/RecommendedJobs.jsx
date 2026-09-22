import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Building2,
  MapPin,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Zap,
  Send,
  Upload,
  RefreshCw,
  Award
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getRecommendedJobs, applyToJob } from '../services/api'
import CompanyLogo from './common/CompanyLogo'
import { getCompanyWebsiteUrl } from '../pages/JobFeed'

export default function RecommendedJobs() {
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasResume, setHasResume] = useState(true)
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [appliedJobs, setAppliedJobs] = useState(new Set())

  // ── Lazy-load gate: BGE model is NOT called on mount ────────────────────
  // The heavy AI matching runs ONLY when the user explicitly clicks "Find My Matches".
  const [fetched, setFetched] = useState(false)

  const fetchRecommendations = async () => {
    setLoading(true)
    setFetched(true)
    try {
      const res = await getRecommendedJobs({ limit: 4 })
      const data = res.data || {}
      setRecommendations(data.recommended_jobs || [])
      setHasResume(data.has_resume !== false)

      // Collect any already applied jobs
      const alreadyApplied = (data.recommended_jobs || [])
        .filter(j => j.is_applied)
        .map(j => j.id)
      if (alreadyApplied.length > 0) {
        setAppliedJobs(new Set(alreadyApplied))
      }
    } catch (err) {
      console.error('Failed to load recommended jobs:', err)
      // Soft fail without blocking the dashboard
    } finally {
      setLoading(false)
    }
  }

  // ── No auto-fetch on mount — BGE model must NOT run during initial page load ──
  // useEffect(() => { fetchRecommendations() }, [])  ← intentionally removed


  // 1-Click Apply handler
  const handleApply = async (job) => {
    setApplyingJobId(job.id)
    try {
      await applyToJob(job.id)
      setAppliedJobs(prev => new Set([...prev, job.id]))
      toast.success(`Applied to ${job.title} at ${job.company_name}! 🎉`)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit application.'
      toast.error(msg)
    } finally {
      setApplyingJobId(null)
    }
  }

  // ── Pre-fetch CTA: BGE never runs until the user clicks this ────────────
  if (!fetched) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  AI Job Matcher
                </span>
                <span className="text-xs text-slate-400 font-bold">•</span>
                <span className="text-xs text-slate-500 font-medium">BGE-768 Vector Engine</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-poppins">
                Find Jobs Matched to Your Profile
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl leading-relaxed">
                Run bidirectional vector matching against open roles. Click below to start — results are computed on-demand, not on page load.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchRecommendations}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Sparkles size={14} />
            Find My Matches
          </button>
        </div>
      </div>
    )
  }

  // Fallback: Candidate has not uploaded/parsed a resume yet
  if (!loading && !hasResume) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  AI Job Matcher
                </span>
                <span className="text-xs text-slate-400 font-bold">•</span>
                <span className="text-xs text-slate-500 font-medium">Resume Required</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-poppins">
                Unlock "Jobs For You" AI Recommendations
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl leading-relaxed">
                Upload and parse your resume to activate 768-dim bidirectional vector matching against high-growth tech positions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/results')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition shrink-0 cursor-pointer"
          >
            <Upload size={14} />
            Parse Resume Now
          </button>
        </div>
      </div>
    )
  }

  // Fallback: No jobs returned after fetch
  if (!loading && recommendations.length === 0 && fetched) {
    return null
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm">
      
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles size={11} className="text-indigo-600" />
              Bidirectional AI Match
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              768-dim Vector Evaluated
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-poppins">
            Jobs For You
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Top open roles aligned with your verified competencies and experience.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchRecommendations}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition"
            title="Refresh recommendations"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
          >
            View All Marketplace Roles
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── Cards Grid (Strictly Light Mode) ─────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 animate-pulse space-y-3">
              <div className="h-5 bg-slate-200 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-6 bg-slate-100 rounded-full w-20" />
              <div className="h-8 bg-slate-200 rounded-xl w-full mt-4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendations.map(job => {
            const isApplied = appliedJobs.has(job.id) || job.is_applied
            const isApplying = applyingJobId === job.id

            // Color code match score pill
            const score = job.match_score || 0
            const scoreClass = score >= 80 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : score >= 65
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'

            return (
              <motion.div
                key={job.id}
                whileHover={{ y: -3 }}
                className="group bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-5 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-md"
              >
                <div>
                  {/* Top Row: Company Logo, Work Mode & Match Score */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <CompanyLogo
                        companyName={job.company_name}
                        logoUrl={job.company_logo}
                        website={job.company_website}
                        size="sm"
                      />
                      <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-md bg-slate-100">
                        {job.work_mode}
                      </span>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border shadow-2xs ${scoreClass}`}>
                      <Sparkles size={11} />
                      {Math.round(score)}% Match
                    </span>
                  </div>

                  {/* Title & Company */}
                  <h3 
                    onClick={() => navigate('/jobs')}
                    className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition cursor-pointer font-poppins line-clamp-1"
                    title={job.title}
                  >
                    {job.title}
                  </h3>

                  <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                    <Building2 size={12} className="text-slate-400 shrink-0" />
                    {(() => {
                      const site = getCompanyWebsiteUrl(job)
                      return site ? (
                        <a
                          href={site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-indigo-600 hover:underline transition inline-flex items-center gap-1"
                          title={`Visit ${job.company_name} official website`}
                        >
                          <span>{job.company_name}</span>
                          <ExternalLink size={10} className="text-slate-400 shrink-0" />
                        </a>
                      ) : (
                        <span className="truncate text-slate-600">
                          {job.company_name}
                        </span>
                      )
                    })()}
                  </p>

                  <p className="text-[11px] font-medium text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin size={11} className="text-slate-300 shrink-0" />
                    <span>{job.location}</span>
                    {job.salary_range && (
                      <>
                        <span>•</span>
                        <span className="text-slate-600 font-semibold">{job.salary_range}</span>
                      </>
                    )}
                  </p>

                  {/* Skills preview */}
                  <div className="mt-3 flex items-center gap-1 flex-wrap">
                    {(job.matched_skills && job.matched_skills.length > 0
                      ? job.matched_skills
                      : job.required_skills || []
                    ).slice(0, 3).map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200/70"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isApplied || isApplying}
                    onClick={() => handleApply(job)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs ${
                      isApplied
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : 'bg-slate-900 hover:bg-indigo-600 text-white hover:shadow'
                    }`}
                  >
                    {isApplied ? (
                      <>
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        Applied
                      </>
                    ) : isApplying ? (
                      'Applying...'
                    ) : (
                      <>
                        <Zap size={13} />
                        1-Click Apply
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
