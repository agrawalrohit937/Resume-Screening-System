import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Users,
  Building2,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowUpRight,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MapPin,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getMyPostedJobs, getRecruiterStats } from '../../services/api'

export default function RecruiterDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState({
    active_openings: 0,
    total_candidates: 0,
    action_required: 0,
    time_to_screen: null,
    funnel: {
      applied: 0,
      under_review: 0,
      shortlisted: 0,
      interview: 0,
      rejected: 0,
    },
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [jobsRes, statsRes] = await Promise.all([
          getMyPostedJobs().catch((err) => {
            console.error('Failed to load recruiter posted jobs:', err)
            return { data: { jobs: [] } }
          }),
          getRecruiterStats().catch((err) => {
            console.error('Failed to load recruiter stats:', err)
            return { data: null }
          }),
        ])
        console.log("Fetched jobs state:", jobsRes)
        const payload = jobsRes?.data && typeof jobsRes.data === 'object' ? jobsRes.data : jobsRes
        const loadedJobs = Array.isArray(jobsRes)
          ? jobsRes
          : Array.isArray(jobsRes?.data)
          ? jobsRes.data
          : Array.isArray(payload?.jobs)
          ? payload.jobs
          : Array.isArray(payload?.results)
          ? payload.results
          : []
        setJobs(loadedJobs)
        if (statsRes.data) {
          setStats(statsRes.data)
        } else {
          const active = loadedJobs.filter(j => j.status === 'open').length
          const totalApps = loadedJobs.reduce((acc, curr) => acc + (curr.applicant_count || 0), 0)
          setStats(prev => ({
            ...prev,
            active_openings: active,
            total_candidates: totalApps,
            action_required: totalApps,
            funnel: {
              ...prev.funnel,
              applied: totalApps,
            },
          }))
        }
      } catch (err) {
        console.error('Failed to load recruiter stats:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Header Name Helper: Render full first name (e.g. "Rohit") or full name, never a single initial
  const greetingName = (() => {
    const raw = (user?.full_name || user?.name || user?.first_name || user?.username || '').trim()
    if (!raw) return 'Recruiter'
    const parts = raw.split(/\s+/)
    if (parts.length > 1 && parts[0].replace(/[^a-zA-Z]/g, '').length <= 1) {
      return raw
    }
    return parts[0] || raw
  })()

  // Clean location string to avoid redundant "Remote • Global Remote" duplicate badges
  const getCleanLocation = (job) => {
    const loc = (job.location || '').trim()
    const mode = (job.work_mode || '').trim()
    if (!loc && !mode) return 'Remote'
    if (!loc) return mode
    if (!mode) return loc
    if (loc.toLowerCase() === mode.toLowerCase()) return loc
    if (loc.toLowerCase() === 'global remote' && mode.toLowerCase() === 'remote') return 'Remote'
    return loc
  }

  // Format "Posted X days ago" timestamp
  const formatPostedDate = (dateStr) => {
    if (!dateStr) return 'Recently posted'
    try {
      const created = new Date(dateStr)
      if (isNaN(created.getTime())) return 'Recently posted'
      const diffMs = Date.now() - created.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays <= 0) return 'Posted today'
      if (diffDays === 1) return 'Posted 1 day ago'
      return `Posted ${diffDays} days ago`
    } catch {
      return 'Recently posted'
    }
  }

  return (
    <div className="space-y-7 pb-20 font-sans text-slate-800 antialiased">
      
      {/* ── 1. Page Header (Clean, Breathable & ATS-Grade) ────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold tracking-wide uppercase border border-indigo-100 mb-2">
            <Sparkles size={13} className="text-indigo-600" />
            Talent Acquisition Suite
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-poppins">
            Welcome back, {greetingName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Here is what's happening with your candidate pipeline today.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => navigate('/recruiter/jobs')}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer transform active:scale-98"
          >
            <PlusCircle size={15} />
            <span>Post a Job</span>
          </button>
        </div>
      </div>

      {/* ── 2. Key Metrics Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Active Openings */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Openings</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/60 flex items-center justify-center">
              <Briefcase size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 font-poppins mt-3">{stats.active_openings}</p>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[11px] font-semibold text-emerald-600">
            <TrendingUp size={13} />
            <span>{stats.active_openings === 1 ? '1 role live' : `${stats.active_openings} roles live`}</span>
          </div>
        </div>

        {/* Card 2: Total Candidates */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Candidates</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/60 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 font-poppins mt-3">{stats.total_candidates}</p>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            <Users size={13} className="text-indigo-500" />
            <span>{stats.total_candidates === 1 ? '1 total applicant' : `${stats.total_candidates} total applicants`}</span>
          </div>
        </div>

        {/* Card 3: Action Required */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Action Required</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/60 flex items-center justify-center">
              <AlertCircle size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 font-poppins mt-3">
            {stats.action_required}
          </p>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[11px] font-semibold text-amber-700">
            <span className={`w-1.5 h-1.5 rounded-full ${stats.action_required > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span>{stats.action_required > 0 ? `${stats.action_required} awaiting review` : 'All candidates reviewed'}</span>
          </div>
        </div>

        {/* Card 4: Avg. Time to Screen */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time to Screen</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 font-poppins mt-3">
            {stats.time_to_screen != null ? (
              <>
                {stats.time_to_screen} <span className="text-sm font-semibold text-slate-400">days</span>
              </>
            ) : (
              <span className="text-2xl font-bold text-slate-400">—</span>
            )}
          </p>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            {stats.time_to_screen != null ? (
              <>
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Average review turnaround</span>
              </>
            ) : (
              <span>Awaiting candidate reviews</span>
            )}
          </div>
        </div>

      </div>

      {/* ── 3. High-Priority Job Pipelines & Funnel ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Active Positions List (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 font-poppins">Active Job Requisitions</h2>
              <p className="text-xs text-slate-400 mt-0.5">Click into any role to manage candidates and view ATS scoring</p>
            </div>
            <Link
              to="/recruiter/jobs"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              <span>View All Postings</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : jobs.length > 0 ? (
            <div>
              {jobs.slice(0, 6).map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/recruiter/jobs/${job.id}/applicants`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-0 p-4 -mx-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left: Title + Badges + Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                        {job.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        job.status === 'open' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {job.status === 'open' ? 'OPEN' : job.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span>{getCleanLocation(job)}</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span>{job.job_type || 'Full-Time'}</span>
                      </span>
                      {job.department && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Briefcase size={12} className="text-slate-400 shrink-0" />
                            <span>{job.department}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Posted Timestamp + Applicant CTA Button */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 mt-1 sm:mt-0">
                    <span className="text-[11px] font-medium text-slate-400">
                      {formatPostedDate(job.created_at)}
                    </span>
                    <button
                      type="button"
                      className="bg-white border border-slate-200 text-indigo-600 px-3 py-1.5 rounded-lg shadow-sm hover:border-indigo-300 transition-colors text-xs font-bold inline-flex items-center gap-1.5 group-hover:border-indigo-300"
                    >
                      <Users size={12} className="text-indigo-500" />
                      <span>{job.applicant_count || 0} Applicants</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Briefcase size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No active job requisitions</p>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">Post your first opening to start receiving candidates</p>
              <button
                onClick={() => navigate('/recruiter/jobs')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Post a Job Opening
              </button>
            </div>
          )}
        </div>

        {/* Right: Funnel & Brand Card */}
        <div className="space-y-6">
          
          {/* Recruiting Pipeline Funnel (Unified Brand Palette) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-extrabold text-slate-900 font-poppins">Recruiting Pipeline Funnel</h3>
              <span className="text-[11px] font-bold text-slate-400">{stats.total_candidates} total</span>
            </div>
            <p className="text-xs text-slate-400 mb-5">Stage progression across all active requisitions</p>

            {stats.total_candidates === 0 ? (
              <div className="py-8 text-center">
                <Users size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No candidate applications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Applications will dynamically populate this funnel</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-semibold">
                {/* Applied */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-1.5">
                    <span className="text-slate-700 font-medium">Applied</span>
                    <span className="font-bold text-slate-900">
                      {stats.funnel.applied}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        ({Math.round((stats.funnel.applied / (stats.total_candidates || 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((stats.funnel.applied / (stats.total_candidates || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Under Review */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-1.5">
                    <span className="text-slate-700 font-medium">Under Review</span>
                    <span className="font-bold text-slate-900">
                      {stats.funnel.under_review}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        ({Math.round((stats.funnel.under_review / (stats.total_candidates || 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((stats.funnel.under_review / (stats.total_candidates || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Shortlisted */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-1.5">
                    <span className="text-slate-700 font-medium">Shortlisted</span>
                    <span className="font-bold text-slate-900">
                      {stats.funnel.shortlisted}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        ({Math.round((stats.funnel.shortlisted / (stats.total_candidates || 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((stats.funnel.shortlisted / (stats.total_candidates || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Interview Scheduled */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-1.5">
                    <span className="text-slate-700 font-medium">Interview Scheduled</span>
                    <span className="font-bold text-slate-900">
                      {stats.funnel.interview}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        ({Math.round((stats.funnel.interview / (stats.total_candidates || 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-300 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((stats.funnel.interview / (stats.total_candidates || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Employer Brand Profile (Soft brand background CTA) */}
          <div className="bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-indigo-50/40 rounded-2xl sm:rounded-3xl border border-indigo-100 p-6 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center mb-3">
              <Building2 size={18} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 font-poppins mb-1">Employer Brand Profile</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Showcase your company culture, perks, and open positions to attract top-tier talent across CareerPilot.
            </p>
            <button
              onClick={() => navigate('/recruiter/company')}
              className="w-full py-2.5 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 text-xs font-bold rounded-xl border border-indigo-200/80 shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Edit Company Profile</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

        </div>

      </div>

    </div>
  )
}
