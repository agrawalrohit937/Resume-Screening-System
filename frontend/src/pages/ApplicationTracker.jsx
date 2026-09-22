import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin,
  Layers,
  Award,
  Eye,
  ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getMyApplications } from '../services/api'
import CompanyLogo from '../components/common/CompanyLogo'
import EEOSurveyModal from '../components/common/EEOSurveyModal'

// Stage badge styling definitions (Strictly Light Mode)
const STAGE_CONFIG = {
  'Applied': {
    label: 'Applied',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
    icon: Clock,
    description: 'Application successfully received by hiring team.',
  },
  'Under Review': {
    label: 'Under Review',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    icon: AlertCircle,
    description: 'Recruiter is reviewing your verified skills and resume.',
  },
  'Shortlisted': {
    label: 'Shortlisted',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
    description: 'Passed initial screening; selected for next evaluation.',
  },
  'Interview': {
    label: 'Interview',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    dotClass: 'bg-purple-500',
    icon: Sparkles,
    description: 'Interview rounds scheduled with the engineering team.',
  },
  'Rejected': {
    label: 'Not Selected',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
    icon: XCircle,
    description: 'Position filled or candidate profile not aligned at this time.',
  },
}

export default function ApplicationTracker() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [selectedApp, setSelectedApp] = useState(null)
  const [selectedEeoApp, setSelectedEeoApp] = useState(null)

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const res = await getMyApplications()
      setApplications(res.data?.applications || [])
    } catch (err) {
      console.error('Failed to load candidate applications:', err)
      toast.error('Unable to fetch your application history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  // Stats calculation
  const stats = useMemo(() => {
    const total = applications.length
    const underReview = applications.filter(a => a.stage === 'Under Review').length
    const shortlisted = applications.filter(a => a.stage === 'Shortlisted').length
    const interview = applications.filter(a => a.stage === 'Interview').length
    return { total, underReview, shortlisted, interview }
  }, [applications])

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const jobTitle = app.job?.title || ''
      const company = app.job?.company_name || ''
      const matchesSearch =
        jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      if (stageFilter === 'all') return true
      if (stageFilter === 'active') {
        return ['Applied', 'Under Review', 'Shortlisted', 'Interview'].includes(app.stage)
      }
      return app.stage === stageFilter
    })
  }, [applications, searchQuery, stageFilter])

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 antialiased pb-20">
      
      {/* ── 1. Top Header (Strictly Light Mode) ──────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  <Briefcase size={12} className="text-indigo-600" />
                  Candidate Dashboard
                </span>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  Real-Time Pipeline
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-poppins tracking-tight">
                Application Tracker
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Monitor your interview stages, review feedback, and track ATS scores for roles you've applied for.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchApplications}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                title="Refresh application status"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>

              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition cursor-pointer"
              >
                Explore More Jobs
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* ── 2. Pipeline Summary Bento Cards ─────────────────────────────── */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Applied
              </span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 font-poppins mt-1">
                {stats.total}
              </p>
            </div>

            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/70">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Under Review
              </span>
              <p className="text-2xl sm:text-3xl font-black text-amber-700 font-poppins mt-1">
                {stats.underReview}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/70">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Shortlisted
              </span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-700 font-poppins mt-1">
                {stats.shortlisted}
              </p>
            </div>

            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200/70">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">
                Interviews
              </span>
              <p className="text-2xl sm:text-3xl font-black text-purple-700 font-poppins mt-1">
                {stats.interview}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Controls & Filter Tabs ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-7">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Stage Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active Pipeline' },
              { id: 'Applied', label: 'Applied' },
              { id: 'Under Review', label: 'Under Review' },
              { id: 'Shortlisted', label: 'Shortlisted' },
              { id: 'Interview', label: 'Interview' },
              { id: 'Rejected', label: 'Archived' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStageFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  stageFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by role or company..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* ── 4. Main Applications Table / List ──────────────────────────────── */}
        <div className="mt-5">
          {loading ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4 shadow-sm animate-pulse">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex items-center justify-between py-3 border-b border-slate-100">
                  <div className="h-5 bg-slate-200 rounded w-1/3" />
                  <div className="h-6 bg-slate-100 rounded-full w-24" />
                </div>
              ))}
            </div>
          ) : filteredApplications.length > 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredApplications.map((app) => {
                  const stageInfo = STAGE_CONFIG[app.stage] || STAGE_CONFIG['Applied']
                  const StageIcon = stageInfo.icon
                  const formattedDate = app.created_at
                    ? new Date(app.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recently'

                  return (
                    <motion.div
                      key={app.id}
                      whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.7)' }}
                      className="p-5 sm:p-6 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Left: Role, Company, Location */}
                      <div className="flex items-start gap-4">
                        <CompanyLogo
                          companyName={app.job?.company_name || 'Company'}
                          logoUrl={app.job?.company_logo || app.job?.logo_url}
                          size="md"
                          showVerified={true}
                        />

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-slate-900 font-poppins">
                              {app.job?.title || 'Applied Position'}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-1 flex-wrap">
                            <span className="font-bold text-slate-700">{app.job?.company_name}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <MapPin size={12} className="text-slate-400" />
                              {app.job?.location || 'Remote'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar size={12} />
                              Applied {formattedDate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Match Score, Stage Badge, Actions */}
                      <div className="flex items-center gap-4 self-start sm:self-center shrink-0">
                        {/* Match Score Indicator */}
                        {typeof app.match_score === 'number' && (
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              ATS Match
                            </span>
                            <span className={`text-sm font-black font-poppins ${
                              app.match_score >= 75
                                ? 'text-emerald-600'
                                : app.match_score >= 50
                                ? 'text-amber-600'
                                : 'text-slate-600'
                            }`}>
                              {Math.round(app.match_score)}%
                            </span>
                          </div>
                        )}

                        {/* Stage Badge */}
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${stageInfo.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${stageInfo.dotClass}`} />
                            <StageIcon size={12} />
                            {stageInfo.label}
                          </span>
                          <button
                            onClick={() => setSelectedEeoApp(app)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-md transition cursor-pointer"
                            title="Voluntary Equal Employment Opportunity Self-Identification"
                          >
                            <ShieldCheck size={10} className="text-indigo-600" />
                            <span>EEO Survey</span>
                          </button>
                        </div>

                        {/* View Job Link */}
                        <Link
                          to={`/jobs`}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
                          title="View in Job Feed"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm max-w-md mx-auto my-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
                <Briefcase size={28} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 font-poppins mb-1">
                No applications yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                You haven't submitted any applications. Browse active roles in our AI marketplace and apply with your verified resume.
              </p>
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                Browse Open Jobs
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Voluntary EEO Self-Identification Modal */}
      <EEOSurveyModal
        isOpen={Boolean(selectedEeoApp)}
        onClose={() => setSelectedEeoApp(null)}
        jobId={selectedEeoApp?.job_id}
        applicationId={selectedEeoApp?.id}
        jobTitle={selectedEeoApp?.job?.title}
        companyName={selectedEeoApp?.job?.company_name}
      />
    </div>
  )
}
