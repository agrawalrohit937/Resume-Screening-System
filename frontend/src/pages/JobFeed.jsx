import React, { useState, useEffect, useMemo } from 'react'
import {
  Briefcase,
  Search,
  Sparkles,
  X,
  RotateCcw,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getJobs, getJobDetail, applyToJob, matchJobATS, getMyApplications } from '../services/api'
import CustomDropdown from '../components/common/CustomDropdown'
import EEOSurveyModal from '../components/common/EEOSurveyModal'
import JobCard from '../components/jobs/JobCard'
import JobDetailPane from '../components/jobs/JobDetailPane'
import JobMatchModal from '../components/jobs/JobMatchModal'
import {
  normalizeJob,
  resolveJobLogo,
  getCompanyWebsiteUrl,
  shareJobListing,
} from '../components/jobs/jobHelpers'

export { JobCard, resolveJobLogo, getCompanyWebsiteUrl }

const WORK_MODE_OPTIONS = [
  { value: 'all', label: 'All Modes' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Onsite', label: 'Onsite' },
]

const EXP_LEVELS = [
  { id: 'all', label: 'All Experience', maxYears: null },
  { id: 'fresher', label: 'Fresher (0-1 yr)', maxYears: 1.0 },
  { id: 'mid', label: 'Associate (1-3 yrs)', maxYears: 3.0 },
  { id: 'senior', label: 'Senior (3+ yrs)', maxYears: 10.0 },
]

export default function JobFeed() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.role === 'recruiter') {
      navigate('/recruiter/jobs', { replace: true })
    }
  }, [user?.role, navigate])

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMode, setSelectedMode] = useState('all')
  const [selectedExp, setSelectedExp] = useState('all')

  const [activeJobDetail, setActiveJobDetail] = useState(null)
  const [matchTargetJob, setMatchTargetJob] = useState(null)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)

  const [appliedJobs, setAppliedJobs] = useState(() => new Set())
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [eeoTargetJob, setEeoTargetJob] = useState(null)
  const [isEeoModalOpen, setIsEeoModalOpen] = useState(false)

  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('saved_jobs_cache')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  const buildFilterParams = (extra = {}) => {
    const maxYearsVal = EXP_LEVELS.find((e) => e.id === selectedExp)?.maxYears
    const modeVal = selectedMode && selectedMode !== 'all' ? selectedMode : undefined
    return {
      search: searchQuery.trim() || undefined,
      work_mode: modeVal,
      min_years: maxYearsVal ?? undefined,
      ...extra,
    }
  }

  const syncServerApplied = (fetchedJobs) => {
    const ids = fetchedJobs.filter((j) => j.has_applied).map((j) => j.id)
    if (ids.length > 0) {
      setAppliedJobs((prev) => new Set([...prev, ...ids]))
    }
  }

  const handleToggleSaveJob = (jobId) => {
    if (!jobId) return
    setSavedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
        toast.success('Job removed from saved bookmarks')
      } else {
        next.add(jobId)
        toast.success('Job saved to your bookmarks!')
      }
      try {
        localStorage.setItem('saved_jobs_cache', JSON.stringify([...next]))
      } catch {
        // Optional bookmark cache
      }
      return next
    })
  }

  // Deep-link support (?jobId=...)
  useEffect(() => {
    const jobIdParam = new URLSearchParams(window.location.search).get('jobId')
    if (!jobIdParam) return

    const match = jobs.find((j) => String(j.id) === String(jobIdParam))
    if (match) {
      setActiveJobDetail(match)
      return
    }

    getJobDetail(jobIdParam)
      .then((res) => {
        const jobData = res.data?.job || res.data
        if (jobData) setActiveJobDetail(normalizeJob(jobData))
      })
      .catch(() => {})
  }, [jobs])

  // Load candidate's applied job IDs
  useEffect(() => {
    if (!user) {
      setAppliedJobs(new Set())
      return
    }
    getMyApplications()
      .then((res) => {
        const ids = (res.data?.applications || []).map((a) => a.job_id).filter(Boolean)
        const appSet = new Set(ids)
        setAppliedJobs(appSet)
        setJobs((prev) => prev.map((j) => (appSet.has(j.id) ? { ...j, has_applied: true } : j)))
      })
      .catch(() => {})
  }, [user?.id])

  // Fetch job listings on filter changes (debounced 250ms)
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading((prev) => prev || jobs.length === 0)
      try {
        const res = await getJobs(buildFilterParams())
        const fetchedJobs = (res?.data?.jobs || []).map(normalizeJob)
        setJobs(fetchedJobs)
        setTotal(res?.data?.total ?? fetchedJobs.length)
        syncServerApplied(fetchedJobs)
      } catch {
        toast.error('Unable to fetch jobs. Please try refreshing.')
        setJobs([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedMode, selectedExp])

  const handleLoadMore = async () => {
    if (loadingMore || jobs.length >= total) return
    setLoadingMore(true)
    try {
      const res = await getJobs(buildFilterParams({ skip: jobs.length, limit: 30 }))
      const fetchedJobs = (res?.data?.jobs || []).map(normalizeJob)
      setJobs((prev) => {
        const existingIds = new Set(prev.map((j) => j.id))
        return [...prev, ...fetchedJobs.filter((j) => !existingIds.has(j.id))]
      })
      syncServerApplied(fetchedJobs)
    } catch {
      toast.error('Unable to load more jobs.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedMode('all')
    setSelectedExp('all')
  }

  const activeFiltersCount = useMemo(() => {
    return [Boolean(searchQuery), selectedMode !== 'all', selectedExp !== 'all'].filter(Boolean).length
  }, [searchQuery, selectedMode, selectedExp])

  const handleCalculateMatch = async (job) => {
    if (!job) return
    setMatchLoading(true)
    setMatchTargetJob(job)
    setIsMatchModalOpen(true)
    setMatchResult(null)
    try {
      const res = await matchJobATS(job.id)
      setMatchResult(res.data)
      toast.success(`Matched against ${job.company_name} 🎯`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Please upload a parsed resume first to calculate match %.')
      setIsMatchModalOpen(false)
      setMatchTargetJob(null)
    } finally {
      setMatchLoading(false)
    }
  }

  const markJobApplied = (jobId) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, has_applied: true } : j)))
    setActiveJobDetail((prev) => (prev?.id === jobId ? { ...prev, has_applied: true } : prev))
    setAppliedJobs((prev) => new Set([...prev, jobId]))
  }

  const handleApply = async (job) => {
    if (!job?.id) return
    const safeJob = normalizeJob(job)

    if (safeJob.is_external) {
      if (safeJob.external_apply_url) {
        window.open(safeJob.external_apply_url, '_blank', 'noopener,noreferrer')
      } else {
        toast.error('This external listing does not have an application link.')
      }
      return
    }

    if (job.has_applied || appliedJobs.has(job.id)) {
      toast.error('You have already applied to this job.')
      return
    }

    setApplyingJobId(job.id)
    try {
      await applyToJob(job.id)
      markJobApplied(job.id)
      toast.success(`Applied to ${job.title} at ${job.company_name}! 🎉`)
      setEeoTargetJob(job)
      setIsEeoModalOpen(true)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit application.'
      if (typeof msg === 'string' && msg.toLowerCase().includes('already applied')) {
        markJobApplied(job.id)
        toast.error(msg)
      } else if (
        typeof msg === 'string' &&
        (msg.toLowerCase().includes('upload a parsed resume') || msg.toLowerCase().includes('resume before applying'))
      ) {
        toast.error('Please upload your resume in Profile to apply for this job! Redirecting...')
        setTimeout(() => navigate('/profile'), 1200)
      } else {
        toast.error(msg)
      }
    } finally {
      setApplyingJobId(null)
    }
  }

  const targetMatchJob = matchTargetJob || activeJobDetail

  return (
    <div className="w-full space-y-3 sm:space-y-6 font-sans text-slate-800 antialiased pb-20">
      {/* Top Header & Filter Toolbar */}
      <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-3 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Explore Jobs
            </h1>
            <p className="hidden sm:block text-xs sm:text-sm text-slate-500 mt-0.5">
              Browse verified tech roles matched directly with your skills, projects, and ATS score.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold bg-slate-100 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {total || jobs.length} {jobs.length === 1 ? 'Role' : 'Roles'}
            </span>
          </div>
        </div>

        {/* Single Responsive Filter Bar */}
        <div className="mt-3 sm:mt-4 bg-slate-50 p-2 rounded-2xl border border-slate-200/90 flex flex-col md:flex-row md:items-center gap-2 shadow-2xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search role, company, skill, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200/80 focus:border-indigo-500 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <CustomDropdown
              options={WORK_MODE_OPTIONS}
              value={selectedMode}
              onChange={setSelectedMode}
              className="flex-1 md:w-36 md:flex-none"
              buttonClassName="py-2.5 px-3 text-xs font-semibold rounded-xl"
              menuClassName="min-w-[150px]"
            />

            <CustomDropdown
              options={EXP_LEVELS.map((e) => ({ value: e.id, label: e.label }))}
              value={selectedExp}
              onChange={setSelectedExp}
              className="flex-1 md:w-44 md:flex-none"
              buttonClassName="py-2.5 px-3 text-xs font-semibold rounded-xl"
              menuClassName="min-w-[180px]"
            />

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 transition cursor-pointer shrink-0"
                title="Clear all filters"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Clear ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-xs font-bold text-slate-600">
            Showing <strong className="text-slate-900">{jobs.length}</strong>{' '}
            {total > 0 && total !== jobs.length ? (
              <>
                of <strong className="text-slate-900">{total}</strong>
              </>
            ) : null}{' '}
            {jobs.length === 1 ? 'position' : 'positions'}
          </span>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles size={13} className="text-indigo-600" />
            <span>
              Click <strong>Check Profile Fit</strong> to evaluate role compatibility
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-4 lg:gap-6 relative w-full min-w-0">
          <div className={activeJobDetail ? 'hidden lg:flex lg:w-[55%] flex-col gap-4 min-w-0' : 'w-full flex-col gap-4 min-w-0 flex'}>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-white rounded-3xl border border-slate-200 p-6 animate-pulse space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 w-1/3">
                        <div className="w-12 h-12 bg-slate-200 rounded-2xl shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-5 bg-slate-200 rounded w-3/4" />
                          <div className="h-3.5 bg-slate-100 rounded w-1/2" />
                        </div>
                      </div>
                      <div className="h-8 bg-slate-100 rounded-full w-36" />
                    </div>
                    <div className="h-12 bg-slate-50 rounded-2xl w-full" />
                  </div>
                ))}
              </div>
            ) : jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSelected={activeJobDetail?.id === job.id}
                    isApplied={Boolean(job.has_applied || appliedJobs.has(job.id))}
                    isApplying={applyingJobId === job.id}
                    onCalculateMatch={() => handleCalculateMatch(job)}
                    onApply={() => handleApply(job)}
                    onViewDetail={() => setActiveJobDetail(job)}
                    onShare={() => shareJobListing(job)}
                  />
                ))}

                {jobs.length < total && (
                  <div className="pt-2 pb-6 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs font-semibold rounded-xl shadow-2xs hover:shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-indigo-600" />
                          <span>Loading more roles...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            Load More Positions ({jobs.length} of {total})
                          </span>
                          <ChevronDown size={14} className="text-slate-400" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm max-w-lg mx-auto my-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-2xs">
                  <Briefcase size={28} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-1">No matching opportunities found</h3>
                <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">
                  We couldn't find roles matching your current search parameters. Try clearing filters or searching for alternative tech keywords.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          <JobDetailPane
            job={activeJobDetail}
            isApplied={Boolean(activeJobDetail?.has_applied || appliedJobs.has(activeJobDetail?.id))}
            isApplying={applyingJobId === activeJobDetail?.id}
            isSaved={savedJobs.has(activeJobDetail?.id)}
            onApply={() => handleApply(activeJobDetail)}
            onShare={() => shareJobListing(activeJobDetail)}
            onClose={() => setActiveJobDetail(null)}
            onCalculateMatch={() => handleCalculateMatch(activeJobDetail)}
            onToggleSave={() => handleToggleSaveJob(activeJobDetail?.id)}
          />
        </div>
      </div>

      <JobMatchModal
        isOpen={isMatchModalOpen}
        job={targetMatchJob}
        loading={matchLoading}
        result={matchResult}
        isApplied={Boolean(targetMatchJob?.has_applied || appliedJobs.has(targetMatchJob?.id))}
        isApplying={applyingJobId === targetMatchJob?.id}
        onClose={() => {
          setIsMatchModalOpen(false)
          setMatchTargetJob(null)
        }}
        onApply={() => {
          setIsMatchModalOpen(false)
          setMatchTargetJob(null)
          handleApply(targetMatchJob)
        }}
      />

      <EEOSurveyModal
        isOpen={isEeoModalOpen}
        onClose={() => {
          setIsEeoModalOpen(false)
          setEeoTargetJob(null)
        }}
        jobId={eeoTargetJob?.id}
        jobTitle={eeoTargetJob?.title}
        companyName={eeoTargetJob?.company_name}
      />
    </div>
  )
}
