import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Search,
  Filter,
  Sparkles,
  PlusCircle,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronRight,
  Send,
  Zap,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Award,
  AlertTriangle,
  Globe,
  Laptop,
  ChevronDown,
  ShieldCheck,
  Users,
  Info,
  Bookmark,
  BookmarkCheck,
  Share2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getJobs, getJobDetail, createJob, applyToJob, matchJobATS, getMyApplications } from '../services/api'
import CompanyLogo from '../components/common/CompanyLogo'
import CustomDropdown from '../components/common/CustomDropdown'
import EEOSurveyModal from '../components/common/EEOSurveyModal'

/**
 * Robust helper to resolve company logo across API field variations
 */
export const resolveJobLogo = (job) => {
  if (!job) return null
  return (
    job.company_logo ||
    job.logo_url ||
    job.company_profile?.logo_url ||
    job.company?.logo_url ||
    job.company_profile?.logo ||
    null
  )
}

const normalizeJob = (job) => {
  const source = job || {}
  const rawId = source.id || source._id || `job_${Math.random().toString(36).substr(2, 9)}`
  return {
    ...source,
    id: typeof rawId === 'object' && rawId.$oid ? rawId.$oid : String(rawId),
    title: source.title || source.job_title || 'Untitled role',
    company_name: source.company_name || source.employer_name || 'Unknown company',
    location: source.location || source.job_city || 'Remote',
    work_mode: source.work_mode || 'Remote',
    company_logo: resolveJobLogo(source),
    salary_range: source.salary_range || null,
    external_apply_url: source.external_apply_url || source.job_apply_link || null,
    is_external: source.is_external === true || ['true', 'True', 1].includes(source.is_external),
    publisher_source: source.publisher_source || (source.external_apply_url?.includes('linkedin.com') ? 'LinkedIn' : source.external_apply_url?.includes('naukri.com') ? 'Naukri' : 'Direct'),
    required_skills: Array.isArray(source.required_skills) ? source.required_skills : [],
    applicant_count: Number(source.applicant_count || 0),
    min_years: Number(source.min_years || 0),
    status: source.status || 'open',
  }
}

/**
 * Normalizes company primary website into an absolute URL,
 * using backend fields, recruiter local store, or domain mapping as fallback.
 */
export const getCompanyWebsiteUrl = (jobOrCompany) => {
  if (!jobOrCompany) return null
  const site =
    jobOrCompany.company_website ||
    jobOrCompany.website ||
    jobOrCompany.company_profile?.website ||
    jobOrCompany.company?.website ||
    null

  if (site && typeof site === 'string' && site.trim()) {
    const trimmed = site.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed
    }
    return `https://${trimmed}`
  }

  const name = (jobOrCompany.company_name || jobOrCompany.name || '').trim()
  if (name) {
    try {
      const saved = localStorage.getItem('recruiter_company_profile')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.company_name?.toLowerCase() === name.toLowerCase() && parsed.website) {
          const w = parsed.website.trim()
          return w.startsWith('http') ? w : `https://${w}`
        }
      }
    } catch { }

    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const techDomains = {
      stripe: 'https://stripe.com',
      linear: 'https://linear.app',
      vercel: 'https://vercel.com',
      supabase: 'https://supabase.com',
      google: 'https://google.com',
      microsoft: 'https://microsoft.com',
      meta: 'https://about.meta.com',
      netflix: 'https://jobs.netflix.com',
      amazon: 'https://amazon.jobs',
      apple: 'https://apple.com',
      airbnb: 'https://airbnb.com',
      uber: 'https://uber.com',
    }
    if (techDomains[clean]) {
      return techDomains[clean]
    }
    return `https://www.google.com/search?q=${encodeURIComponent(name)}+official+website`
  }

  return null
}

// Preset filter definitions
const WORK_MODES = [
  { id: 'all', label: 'All Modes' },
  { id: 'Remote', label: 'Remote', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Hybrid', label: 'Hybrid', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'Onsite', label: 'Onsite', color: 'bg-amber-50 text-amber-700 border-amber-200' },
]

const EXP_LEVELS = [
  { id: 'all', label: 'All Experience', maxYears: null },
  { id: 'fresher', label: 'Fresher / Entry (0-1 yr)', maxYears: 1.0 },
  { id: 'mid', label: 'Associate (1-3 yrs)', maxYears: 3.0 },
  { id: 'senior', label: 'Senior (3-5+ yrs)', maxYears: 10.0 },
]

const POPULAR_SKILLS = [
  'React', 'Python', 'TypeScript', 'Next.js', 'FastAPI', 'Node.js',
  'TailwindCSS', 'PostgreSQL', 'Docker', 'Machine Learning', 'Go'
]

function dedupeCaseInsensitive(items) {
  const seen = new Set()
  const out = []
  for (const raw of items || []) {
    const item = (raw || '').trim()
    const key = item.toLowerCase()
    if (item && !seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

export default function JobFeed() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Recruiters should manage jobs under /recruiter/jobs, not browse candidate marketplace
  useEffect(() => {
    if (user?.role === 'recruiter') {
      navigate('/recruiter/jobs', { replace: true })
    }
  }, [user?.role, navigate])

  const isRecruiterOrAdmin = user?.role === 'admin'

  // Data state
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMode, setSelectedMode] = useState('all')
  const [selectedExp, setSelectedExp] = useState('all')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [locationQuery, setLocationQuery] = useState('')

  // Modals & Drawers
  const [activeJobDetail, setActiveJobDetail] = useState(null)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const getAppliedCacheKey = (userId) => `applied_jobs_${userId || 'guest'}`

  const [appliedJobs, setAppliedJobs] = useState(() => new Set())
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [eeoTargetJob, setEeoTargetJob] = useState(null)
  const [isEeoModalOpen, setIsEeoModalOpen] = useState(false)

  // Saved Jobs bookmarks state
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('saved_jobs_cache')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

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
      } catch { }
      return next
    })
  }

  const handleShareJob = async (job) => {
    if (!job) return
    const jobId = job.id || job._id
    const shareUrl = `${window.location.origin}/jobs?jobId=${jobId}`
    const jobTitle = job.title || 'Career Opportunity'
    const companyName = job.company_name || 'CareerShala'

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${jobTitle} at ${companyName} | CareerShala`,
          text: `Check out this opportunity for ${jobTitle} at ${companyName}!`,
          url: shareUrl,
        })
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => toast.success('Job link copied to clipboard! 📋'))
        .catch(() => toast.success('Job link: ' + shareUrl))
    } else {
      toast.success('Job link: ' + shareUrl)
    }
  }

  // Auto-select job from URL query parameter (?jobId=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const jobIdParam = params.get('jobId')
    if (!jobIdParam) return

    // 1. Locate in current jobs list
    if (jobs && jobs.length > 0) {
      const match = jobs.find((j) => String(j.id) === String(jobIdParam) || String(j._id) === String(jobIdParam))
      if (match) {
        setActiveJobDetail(match)
        return
      }
    }

    // 2. Fallback: Fetch single job document from backend
    getJobDetail(jobIdParam)
      .then((res) => {
        const jobData = res.data?.job || res.data
        if (jobData) {
          const normalized = normalizeJob(jobData)
          setActiveJobDetail(normalized)
        }
      })
      .catch((err) => {
        console.warn('Could not retrieve deep-linked job:', err)
      })
  }, [jobs])

  // Fetch candidate's applied jobs from database on load so "Applied" state persists across page refresh
  useEffect(() => {
    if (!user) {
      setAppliedJobs(new Set())
      return
    }

    getMyApplications()
      .then((res) => {
        const ids = (res.data?.applications || [])
          .map((app) => app.job_id)
          .filter(Boolean)
        const appSet = new Set(ids)
        setAppliedJobs(appSet)
        setJobs((prevJobs) =>
          prevJobs.map((j) => (appSet.has(j.id) ? { ...j, has_applied: true } : j))
        )
      })
      .catch((err) => {
        console.error('Failed to load user applications:', err)
      })
  }, [user?.id])

  // Post Job form state
  const [postFormData, setPostFormData] = useState({
    title: '',
    company_name: '',
    jd_text_raw: '',
    required_skills: '',
    min_years: 0,
    location: 'Remote',
    work_mode: 'Remote',
    salary_range: '$100,000 - $140,000',
    department: 'Engineering',
    company_logo: '',
    company_website: '',
    company_about: '',
    company_industry: 'Software & Technology',
  })
  const [postingLoading, setPostingLoading] = useState(false)

  // Smart skills input state
  const [skillsList, setSkillsList] = useState(['React', 'TypeScript', 'TailwindCSS'])
  const [skillInput, setSkillInput] = useState('')

  const handleAddSkill = (val) => {
    const trimmed = (val !== undefined ? val : skillInput).trim().replace(/,/g, '')
    if (trimmed && !skillsList.includes(trimmed)) {
      setSkillsList(prev => [...prev, trimmed])
    }
    setSkillInput('')
  }

  const handleRemoveSkill = (skillToRemove) => {
    setSkillsList(prev => prev.filter(s => s !== skillToRemove))
  }

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddSkill()
    } else if (e.key === 'Backspace' && !skillInput && skillsList.length > 0) {
      handleRemoveSkill(skillsList[skillsList.length - 1])
    }
  }

  // AI JD Generation Handler
  const handleGenerateJDWithAI = () => {
    const title = postFormData.title?.trim() || 'Software Engineer'
    const dept = postFormData.department?.trim() || 'Engineering'
    const mode = postFormData.work_mode || 'Remote'
    const exp = postFormData.min_years ? `${postFormData.min_years}+ years` : '1+ years'
    const skills = skillsList.length ? skillsList.join(', ') : 'modern technology stacks, clean architecture, automated testing'

    const generated = `About the Role:
We are looking for a talented and driven ${title} to join our ${dept} team. You will play a crucial role in building high-performance systems, collaborating with world-class engineers, and delivering impactful products to our users.

Key Responsibilities:
• Design, implement, and maintain scalable, robust application features.
• Work in a fast-paced ${mode.toLowerCase()} team environment with agile workflows.
• Write clean, well-tested, and maintainable code adhering to engineering best practices.
• Collaborate with design, product, and QA stakeholders across the software development lifecycle.

What We Are Looking For:
• ${exp} of professional software engineering experience.
• Strong hands-on proficiency with: ${skills}.
• Passion for building intuitive user experiences and resilient backend architectures.
• Excellent communication, documentation, and problem-solving abilities.`

    setPostFormData(prev => ({ ...prev, jd_text_raw: generated }))
    toast.success('AI-crafted Job Description generated! ✨')
  }

  // Helper to extract jobs array from diverse response shapes
  const extractJobsArray = (response) => {
    console.log("Full response.data payload:", response?.data)
    if (!response) return []

    // 1. Direct array at response or response.data
    if (Array.isArray(response)) return response
    if (Array.isArray(response?.data)) return response.data

    // 2. Nested keys in response.data
    if (Array.isArray(response?.data?.jobs)) return response.data.jobs
    if (Array.isArray(response?.data?.results)) return response.data.results
    if (Array.isArray(response?.data?.data)) return response.data.data
    if (Array.isArray(response?.data?.items)) return response.data.items

    // 3. Fallback to unwrapped root-level keys
    if (Array.isArray(response?.jobs)) return response.jobs
    if (Array.isArray(response?.results)) return response.results
    if (Array.isArray(response?.items)) return response.items

    return []
  }

  // Fetch jobs with optional override parameters
  const fetchJobListings = async (overrideParams = null) => {
    setLoading(true)
    try {
      let params = {}
      if (overrideParams !== null) {
        params = overrideParams
      } else {
        const maxYearsVal = EXP_LEVELS.find(e => e.id === selectedExp)?.maxYears
        const modeVal = selectedMode && selectedMode.toLowerCase() !== 'all' ? selectedMode : undefined
        params = {
          search: searchQuery.trim() || undefined,
          work_mode: modeVal,
          location: locationQuery.trim() || undefined,
          min_years: maxYearsVal !== null && maxYearsVal !== undefined ? maxYearsVal : undefined,
          skill: selectedSkill || undefined,
        }
      }

      console.log("[JobFeed] Fetching jobs with params:", params)
      const response = await getJobs(params)
      console.log("Raw API Response:", response)

      const rawList = extractJobsArray(response)
      console.log("Extracted raw array (before normalize):", rawList)

      const fetchedJobs = rawList.map(normalizeJob)
      console.log("Final normalized jobs (after normalize):", fetchedJobs)

      const totalCount = response?.data?.total ?? response?.total ?? fetchedJobs.length

      setJobs(fetchedJobs)
      setTotal(totalCount)

      const serverAppliedIds = fetchedJobs.filter((j) => Boolean(j.has_applied)).map((j) => j.id)
      if (serverAppliedIds.length > 0) {
        setAppliedJobs((prev) => {
          const next = new Set(prev)
          serverAppliedIds.forEach((id) => next.add(id))
          return next
        })
      }
    } catch (err) {
      console.error('Failed to load job listings:', err)
      toast.error('Unable to fetch jobs. Please try refreshing.')
      setJobs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Reload when non-debounced filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if all filters are in default state; if so, pass empty object {}
      const isDefault =
        !searchQuery.trim() &&
        (selectedMode === 'all' || !selectedMode) &&
        (selectedExp === 'all' || !selectedExp) &&
        !selectedSkill &&
        !locationQuery.trim()

      if (isDefault) {
        fetchJobListings({})
      } else {
        fetchJobListings()
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedMode, selectedExp, selectedSkill, locationQuery])

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedMode('all')
    setSelectedExp('all')
    setSelectedSkill('')
    setLocationQuery('')
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (searchQuery) count++
    if (selectedMode !== 'all') count++
    if (selectedExp !== 'all') count++
    if (selectedSkill) count++
    if (locationQuery) count++
    return count
  }, [searchQuery, selectedMode, selectedExp, selectedSkill, locationQuery])

  // Calculate Match %
  const handleCalculateMatch = async (job) => {
    setMatchLoading(true)
    setActiveJobDetail(job)
    setIsMatchModalOpen(true)
    setMatchResult(null)

    try {
      const res = await matchJobATS(job.id)
      setMatchResult(res.data)
      toast.success(`Matched against ${job.company_name} 🎯`)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Please upload a parsed resume first to calculate match %.'
      toast.error(msg)
      setIsMatchModalOpen(false)
    } finally {
      setMatchLoading(false)
    }
  }

  // Quick Apply with immediate caching & state lock
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
      setJobs((prevJobs) =>
        prevJobs.map((j) => (j.id === job.id ? { ...j, has_applied: true } : j))
      )
      setActiveJobDetail((prev) => (prev?.id === job.id ? { ...prev, has_applied: true } : prev))
      setAppliedJobs((prev) => new Set([...prev, job.id]))
      toast.success(`Applied to ${job.title} at ${job.company_name}! 🎉`)
      setEeoTargetJob(job)
      setIsEeoModalOpen(true)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit application.'
      // If backend says already applied, immediately register into state
      if (typeof msg === 'string' && msg.toLowerCase().includes('already applied')) {
        setJobs((prevJobs) =>
          prevJobs.map((j) => (j.id === job.id ? { ...j, has_applied: true } : j))
        )
        setActiveJobDetail((prev) => (prev?.id === job.id ? { ...prev, has_applied: true } : prev))
        setAppliedJobs((prev) => new Set([...prev, job.id]))
      }
      toast.error(msg)
    } finally {
      setApplyingJobId(null)
    }
  }

  // Resolve company name from session or local preferences
  const resolveCompany = () => {
    if (user?.company_name?.trim()) return user.company_name.trim()
    try {
      const c = JSON.parse(localStorage.getItem('recruiter_company_profile') || '{}')
      if (c.company_name?.trim()) return c.company_name.trim()
    } catch { }
    try {
      const p = JSON.parse(localStorage.getItem('recruiter_preferences') || '{}')
      if (p.company?.trim()) return p.company.trim()
    } catch { }
    return 'CareerPilot Technologies'
  }

  // Submit New Job Posting (Draft vs Publish)
  const handleCreateJob = async (e, isDraft = false) => {
    if (e) e.preventDefault()
    if (!postFormData.title?.trim()) {
      toast.error('Please enter a Job Title.')
      return
    }
    if (!postFormData.jd_text_raw?.trim()) {
      toast.error('Please enter or generate a Job Description.')
      return
    }
    setPostingLoading(true)
    try {
      const companyName = resolveCompany()
      const payload = {
        ...postFormData,
        title: postFormData.title.trim(),
        company_name: companyName,
        jd_text_raw: postFormData.jd_text_raw.trim(),
        min_years: parseFloat(postFormData.min_years) || 0,
        required_skills: skillsList,
        status: isDraft ? 'draft' : 'open',
      }

      await createJob(payload)
      toast.success(isDraft ? 'Job saved as draft! 📋' : 'Job published successfully! 🚀')
      setIsPostModalOpen(false)
      setSkillsList(['React', 'TypeScript', 'TailwindCSS'])
      setSkillInput('')
      setPostFormData({
        title: '',
        company_name: '',
        jd_text_raw: '',
        required_skills: '',
        min_years: 0,
        location: 'Remote',
        work_mode: 'Remote',
        salary_range: '$100,000 - $140,000',
        department: 'Engineering',
      })
      fetchJobListings()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to post job. Recruiter/admin access may be required.'
      toast.error(msg)
    } finally {
      setPostingLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 antialiased pb-20">

      {/* ── 1. Top Header & Clean Filter Toolbar ────────────────── */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-poppins tracking-tight">
                Explore Jobs
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Browse verified tech roles matched directly with your skills, projects, and ATS score.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {total || jobs.length} {jobs.length === 1 ? 'Open Role' : 'Open Roles'}
              </span>
              {isRecruiterOrAdmin && (
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <PlusCircle size={15} />
                  Post Job
                </button>
              )}
            </div>
          </div>

          {/* ── Single Unified Search & Filter Bar ── */}
          <div className="mt-5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center gap-2 shadow-2xs">

            {/* Keyword Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by role title, skill, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200/80 focus:border-indigo-500 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Location Search */}
            <div className="relative md:w-52">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Location (e.g. Remote)..."
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200/80 focus:border-indigo-500 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition shadow-2xs"
              />
              {locationQuery && (
                <button
                  type="button"
                  onClick={() => setLocationQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Clear location"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Work Mode Dropdown */}
            <CustomDropdown
              options={[
                { value: 'all', label: 'All Modes' },
                { value: 'Remote', label: 'Remote' },
                { value: 'Hybrid', label: 'Hybrid' },
                { value: 'Onsite', label: 'Onsite' },
              ]}
              value={selectedMode}
              onChange={setSelectedMode}
              className="w-full md:w-36"
              buttonClassName="py-2.5 px-3 text-xs font-semibold rounded-xl"
              menuClassName="min-w-[150px]"
            />

            {/* Experience Dropdown */}
            <CustomDropdown
              options={[
                { value: 'all', label: 'All Experience' },
                { value: 'fresher', label: 'Fresher (0-1 yr)' },
                { value: 'mid', label: 'Associate (1-3 yrs)' },
                { value: 'senior', label: 'Senior (3+ yrs)' },
              ]}
              value={selectedExp}
              onChange={setSelectedExp}
              className="w-full md:w-44"
              buttonClassName="py-2.5 px-3 text-xs font-semibold rounded-xl"
              menuClassName="min-w-[180px]"
            />

            {/* Reset Filters (Only appears if any filter is set) */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 transition cursor-pointer shrink-0"
                title="Clear all filters"
              >
                <RotateCcw size={13} />
                Clear ({activeFiltersCount})
              </button>
            )}
          </div>

          {/* ── Popular Skills: Ultra-clean horizontal pill row ── */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Popular:</span>
            {POPULAR_SKILLS.map((skill) => {
              const active = selectedSkill.toLowerCase() === skill.toLowerCase()
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => setSelectedSkill(active ? '' : skill)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100/80 hover:bg-slate-200 text-slate-600 border border-transparent'
                    }`}
                >
                  {skill}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 2. Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Subtle sub-header bar */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-xs font-bold text-slate-600">
            Showing <strong className="text-slate-900">{jobs.length}</strong> {jobs.length === 1 ? 'position' : 'positions'}
          </span>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles size={13} className="text-indigo-600" />
            <span>Click <strong>Calculate Match %</strong> to evaluate ATS compatibility</span>
          </div>
        </div>

        {/* Dynamic Split-Pane Layout */}
        <div className="flex items-start gap-6 relative w-full">

          {/* Left Column (Scrollable Job List) */}
          <div className={activeJobDetail ? "hidden lg:flex lg:w-[55%] flex-col gap-4" : "w-full flex flex-col gap-4"}>

            {/* Loading Skeleton */}
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
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-2">
                        <div className="h-6 bg-slate-100 rounded-lg w-16" />
                        <div className="h-6 bg-slate-100 rounded-lg w-20" />
                        <div className="h-6 bg-slate-100 rounded-lg w-16" />
                      </div>
                      <div className="h-8 bg-slate-200 rounded-xl w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : jobs.length > 0 ? (
              /* Job Listings Cards */
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSelected={activeJobDetail?.id === job.id}
                    isApplied={Boolean(job.has_applied)}
                    isApplying={applyingJobId === job.id}
                    onCalculateMatch={() => handleCalculateMatch(job)}
                    onApply={() => handleApply(job)}
                    onViewDetail={() => setActiveJobDetail(job)}
                    onShare={() => handleShareJob(job)}
                  />
                ))}
              </div>
            ) : (
              /* Fallback Card & Empty State */
              <div className="space-y-4">
                {/* Fallback diagnostic card verifying component mounting */}
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-3xl p-5 shadow-2xs mb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black text-xs shrink-0">
                        FEED
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-amber-900">JobFeed Component Mounted & Active</h4>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Query returned 0 records. Check browser console for <code>Raw API Response</code> payload.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchJobListings({})}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                    >
                      <RotateCcw size={13} />
                      Force Fetch (Empty Params)
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm max-w-lg mx-auto my-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-2xs">
                    <Briefcase size={28} />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 font-poppins mb-1">
                    No matching opportunities found
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">
                    We couldn't find roles matching your current search parameters. Try clearing filters or searching for alternative tech keywords.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                    {isRecruiterOrAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsPostModalOpen(true)}
                        className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
                      >
                        Post First Position
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (Sticky Detail Pane) */}
          {activeJobDetail && (
            <div className="w-full lg:w-[45%] sticky top-24 h-[calc(100vh-120px)] overflow-y-auto bg-white border border-slate-200 rounded-3xl shadow-lg p-6 custom-scrollbar flex flex-col justify-between">
              <div>
                {/* 1. Top Section: Logo, Title, Company Name + Apply Now & Share / Close */}
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {(() => {
                      const siteUrl = getCompanyWebsiteUrl(activeJobDetail)
                      return (
                        <>
                          {siteUrl ? (
                            <a
                              href={siteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Visit ${activeJobDetail.company_name} official website`}
                              className="shrink-0 hover:scale-105 transition-transform"
                            >
                              <CompanyLogo
                                companyName={activeJobDetail.company_name}
                                logoUrl={resolveJobLogo(activeJobDetail)}
                                website={siteUrl}
                                size="lg"
                                showVerified={true}
                              />
                            </a>
                          ) : (
                            <div className="shrink-0">
                              <CompanyLogo
                                companyName={activeJobDetail.company_name}
                                logoUrl={resolveJobLogo(activeJobDetail)}
                                size="lg"
                                showVerified={true}
                              />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 font-poppins tracking-tight truncate" title={activeJobDetail.title}>
                              {activeJobDetail.title}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                              {siteUrl ? (
                                <a
                                  href={siteUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 hover:underline transition truncate inline-flex items-center gap-1"
                                  title={`Visit ${activeJobDetail.company_name} official website`}
                                >
                                  <span>{activeJobDetail.company_name}</span>
                                  <ExternalLink size={11} className="text-slate-400 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                                  {activeJobDetail.company_name}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                                <ShieldCheck size={10} className="text-emerald-700" />
                                Verified
                              </span>
                              {activeJobDetail.is_external && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                  <ExternalLink size={10} />
                                  External Listing
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Top Right: Apply Now (indigo) + Share icon + Close X */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {Boolean(activeJobDetail.has_applied || appliedJobs.has(activeJobDetail.id)) ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold select-none">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        Applied
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={applyingJobId === activeJobDetail.id}
                        onClick={() => handleApply(activeJobDetail)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        {applyingJobId === activeJobDetail.id ? (
                          'Applying...'
                        ) : (
                          <>
                            {activeJobDetail.is_external 
                              ? `Apply on ${activeJobDetail.publisher_source || 'Corporate Site'}` 
                              : 'Apply Now'}
                            <ArrowUpRight size={13} />
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleShareJob(activeJobDetail)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
                      title="Share job link"
                    >
                      <Share2 size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveJobDetail(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
                      title="Close details"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* 2. Metadata row: small chips for Location, Experience, and Salary */}
                <div className="flex items-center gap-2 flex-wrap mt-4">
                  <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
                    <MapPin size={12} className="text-slate-400" />
                    <span>{activeJobDetail.location || 'Remote'}</span>
                    {activeJobDetail.work_mode && (
                      <span className="text-slate-400">({activeJobDetail.work_mode})</span>
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
                    <Award size={12} className="text-slate-400" />
                    <span>{activeJobDetail.min_years === 0 ? 'Fresher (0-1 yr)' : `${activeJobDetail.min_years}+ Yrs Exp`}</span>
                  </span>

                  {activeJobDetail.salary_range ? (
                    <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
                      <DollarSign size={12} className="text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">{activeJobDetail.salary_range}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
                      <DollarSign size={12} className="text-slate-400" />
                      <span>Competitive</span>
                    </span>
                  )}

                  {activeJobDetail.department && (
                    <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
                      <Building2 size={12} className="text-slate-400" />
                      <span>{activeJobDetail.department}</span>
                    </span>
                  )}
                </div>

                {/* 3. Tech Stack / Required Skills */}
                {activeJobDetail.required_skills?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-indigo-600" />
                      Required Tech Stack
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {activeJobDetail.required_skills.map((skill, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/80">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Body: Job Description */}
                <div className="mt-5">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Briefcase size={12} className="text-indigo-600" />
                    Role Description
                  </h4>
                  <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-2xl border border-slate-100 font-sans">
                    {activeJobDetail.jd_text_raw}
                  </div>
                </div>

                {/* 5. Company Info Card */}
                {(activeJobDetail.company_about || activeJobDetail.company_website) && (
                  <div className="mt-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 font-poppins">About {activeJobDetail.company_name}</span>
                      {activeJobDetail.company_website && (
                        <a
                          href={activeJobDetail.company_website.startsWith('http') ? activeJobDetail.company_website : `https://${activeJobDetail.company_website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Visit Site</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    {activeJobDetail.company_about && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {activeJobDetail.company_about}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Action Section: Check ATS Match and Save Job side-by-side */}
              <div className="pt-5 mt-5 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleCalculateMatch(activeJobDetail)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <Sparkles size={14} className="text-indigo-600" />
                  <span>Check ATS Match</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSaveJob(activeJobDetail.id)}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${savedJobs.has(activeJobDetail.id)
                      ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                    }`}
                >
                  {savedJobs.has(activeJobDetail.id) ? (
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
          )}

        </div>
      </div>

      {/* ── 3. Match % Calculation Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {isMatchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                    <Sparkles size={12} /> ATS Engine Evaluation
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 font-poppins">
                    {activeJobDetail?.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeJobDetail?.company_name} • {activeJobDetail?.location}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMatchModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              {matchLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl border-4 border-indigo-600 border-t-transparent animate-spin mb-4" />
                  <p className="text-sm font-bold text-slate-800 font-poppins">
                    Evaluating Match Percentage...
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Comparing technical skills (70%), internship/experience (15%), and education (15%).
                  </p>
                </div>
              ) : matchResult ? (() => {
                const dedupeCaseInsensitive = (arr) => {
                  const seen = new Set()
                  return (arr || []).filter((item) => {
                    const lower = item.toLowerCase().trim()
                    if (seen.has(lower)) return false
                    seen.add(lower)
                    return true
                  })
                }
                const matchedSkills = dedupeCaseInsensitive(matchResult.matched_skills || [])
                const matchedLower = new Set(matchedSkills.map((s) => s.toLowerCase().trim()))
                const missingSkills = dedupeCaseInsensitive(matchResult.missing_skills || []).filter(
                  (s) => !matchedLower.has(s.toLowerCase().trim())
                )
                const totalSkillsCount = matchedSkills.length + missingSkills.length

                return (
                  <div className="space-y-5">
                    {/* Score Pill Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Estimated Match
                        </p>
                        <h4 className="text-3xl font-black text-slate-900 font-poppins mt-0.5">
                          {Math.round(matchResult.final_score)}%
                        </h4>
                        <p className="text-xs font-bold text-indigo-700 mt-0.5">
                          {matchResult.recommendation}
                        </p>
                      </div>

                      <div className="text-right text-xs space-y-1">
                        <p className="text-slate-600 font-medium">
                          Skills Match: <strong className="text-slate-900">{matchedSkills.length}</strong> / {totalSkillsCount}
                        </p>
                        <p className="text-slate-600 font-medium">
                          Weight: <strong className="text-indigo-600 font-bold">Skills 70% • Exp 15% • Edu 15%</strong>
                        </p>
                      </div>
                    </div>

                    {/* Knockout Warning Banner */}
                    {(matchResult.is_knockout || (matchResult.knockout_reasons && matchResult.knockout_reasons.length > 0)) && (
                      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 text-amber-900 shadow-2xs">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-1">
                          <div className="font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>Requirement Warning</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200/80 text-amber-900 font-bold">Deficit Detected</span>
                          </div>
                          {matchResult.knockout_reasons && matchResult.knockout_reasons.length > 0 ? (
                            matchResult.knockout_reasons.map((reason, idx) => (
                              <p key={idx} className="font-semibold text-amber-800">
                                • {reason}
                              </p>
                            ))
                          ) : (
                            <p className="font-semibold text-amber-800">
                              • Role requirements (experience or education) not fully met.
                            </p>
                          )}
                          <p className="text-[11px] text-amber-700/90 font-medium pt-0.5">
                            Warning: You may still apply, but recruiters will see this deficit during candidate screening.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Matched Skills */}
                    {matchedSkills.length > 0 && (
                      <div>
                        <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Matching Competencies ({matchedSkills.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {matchedSkills.map((s, idx) => (
                            <span key={idx} className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ✓ {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Skills */}
                    {missingSkills.length > 0 && (
                      <div>
                        <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Potential Gaps to Highlight ({missingSkills.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {missingSkills.slice(0, 6).map((s, idx) => (
                            <span key={idx} className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              + {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsMatchModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(activeJobDetail?.has_applied || appliedJobs.has(activeJobDetail?.id)) || applyingJobId === activeJobDetail?.id}
                        onClick={() => {
                          setIsMatchModalOpen(false)
                          handleApply(activeJobDetail)
                        }}
                        className={`px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition ${Boolean(activeJobDetail?.has_applied || appliedJobs.has(activeJobDetail?.id))
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed opacity-90'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                          }`}
                      >
                        {Boolean(activeJobDetail?.has_applied || appliedJobs.has(activeJobDetail?.id)) ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            Already Applied
                          </span>
                        ) : (
                          'Apply Now with Resume'
                        )}
                      </button>
                    </div>
                  </div>
                )
              })() : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ── 5. Post Job Modal (Refactored Premium SaaS ATS Aesthetic) ───────── */}
      <AnimatePresence>
        {isPostModalOpen && isRecruiterOrAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-poppins">
                    Post a New Job
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Publish a new open role or save it as a draft to attract top-tier talent.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => handleCreateJob(e, false)} className="mt-6 space-y-5">

                {/* 1. Job Title (Full width row) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior AI / Frontend Engineer"
                    value={postFormData.title}
                    onChange={e => setPostFormData({ ...postFormData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* 2. 3-Column Grid: Work Mode, Min Exp, Department */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Work Mode</label>
                    <CustomDropdown
                      value={postFormData.work_mode}
                      onChange={val => setPostFormData({ ...postFormData, work_mode: val })}
                      options={[
                        { value: 'Remote', label: 'Remote' },
                        { value: 'Hybrid', label: 'Hybrid' },
                        { value: 'Onsite', label: 'Onsite' }
                      ]}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Min Exp (Years)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={postFormData.min_years}
                      onChange={e => setPostFormData({ ...postFormData, min_years: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering"
                      value={postFormData.department}
                      onChange={e => setPostFormData({ ...postFormData, department: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* 3. 2-Column Grid: Location & Salary Range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. San Francisco, CA or Remote"
                      value={postFormData.location}
                      onChange={e => setPostFormData({ ...postFormData, location: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Salary Range</label>
                    <input
                      type="text"
                      placeholder="e.g. $120,000 - $160,000"
                      value={postFormData.salary_range}
                      onChange={e => setPostFormData({ ...postFormData, salary_range: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* 4. Smart Skills Input (Tag/Pill UI) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Required Skills
                  </label>
                  <div className="w-full min-h-[46px] p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-1.5 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all cursor-text">
                    {skillsList.map((skill, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-xs font-medium"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded p-0.5 transition cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={skillInput}
                      onChange={e => setSkillInput(e.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      onBlur={() => handleAddSkill()}
                      placeholder={skillsList.length === 0 ? "Type a skill and press Enter or comma..." : "Add skill..."}
                      className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm text-slate-900 placeholder:text-slate-400 py-1 px-1.5 focus:ring-0"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Press Enter or comma to add a skill tag.</p>
                </div>

                {/* 5. Job Description with AI Generation button */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-slate-700">Job Description *</label>
                    <button
                      type="button"
                      onClick={handleGenerateJDWithAI}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Sparkles size={14} className="text-indigo-600" />
                      Generate with AI
                    </button>
                  </div>
                  <textarea
                    required
                    rows={6}
                    placeholder="Describe role responsibilities, team impact, and required qualifications..."
                    value={postFormData.jd_text_raw}
                    onChange={e => setPostFormData({ ...postFormData, jd_text_raw: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans leading-relaxed custom-scrollbar"
                  />
                </div>

                {/* 6. Action Footer (Draft vs Publish) */}
                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsPostModalOpen(false)}
                    className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={postingLoading}
                      onClick={(e) => handleCreateJob(e, true)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      Save as Draft
                    </button>

                    <button
                      type="submit"
                      disabled={postingLoading}
                      onClick={(e) => handleCreateJob(e, false)}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {postingLoading ? 'Publishing...' : 'Publish Job'}
                    </button>
                  </div>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voluntary EEO Self-Identification Modal (Statutory EEOC Compliance) */}
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

// ── Job Card Component (Startup/Linear Style — Strictly Light Mode) ───────────
export function JobCard({
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
  const isFresher = safeJob.min_years === 0 || safeJob.min_years <= 1
  const logoUrl = resolveJobLogo(safeJob)
  const companySite = getCompanyWebsiteUrl(safeJob)
  const hasApplied = Boolean(job?.has_applied ?? isApplied)
  const jobTitle = safeJob.title
  const companyName = safeJob.company_name

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onViewDetail}
      className={`group bg-white rounded-3xl border p-5 sm:p-6 transition-all duration-200 shadow-2xs hover:shadow-md relative overflow-hidden cursor-pointer ${isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md bg-indigo-50/10'
          : 'border-slate-200/90 hover:border-indigo-200'
        }`}
    >
      {/* Top row: Company, Title, Meta and Match Button */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

        {/* Left: Company Logo & Title Info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {companySite ? (
            <a
              href={companySite}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 transition-transform duration-200 hover:scale-105"
              title={`Visit ${companyName} official website`}
            >
              <CompanyLogo
                companyName={companyName}
                logoUrl={logoUrl}
                website={companySite}
                size="md"
                showVerified={true}
              />
            </a>
          ) : (
            <div
              className="shrink-0"
              title={companyName}
            >
              <CompanyLogo
                companyName={companyName}
                logoUrl={logoUrl}
                size="md"
                showVerified={true}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Title & Fresher Friendly Badge tight group */}
            <div className="flex items-center gap-2 min-w-0">
              <h3
                onClick={(e) => {
                  e.stopPropagation()
                  onViewDetail()
                }}
                className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition cursor-pointer font-poppins truncate min-w-0 flex-1"
                title={jobTitle}
              >
                {jobTitle}
              </h3>
              {isFresher && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 inline-flex items-center gap-1 shrink-0">
                  <Sparkles size={10} className="text-emerald-600" />
                  Fresher Friendly
                </span>
              )}
              {safeJob.is_external && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 shrink-0 ${
                  safeJob.publisher_source === 'LinkedIn'
                    ? 'bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/30'
                    : safeJob.publisher_source === 'Naukri'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  <ExternalLink size={10} />
                  {safeJob.publisher_source ? `${safeJob.publisher_source} Verified` : 'External Listing'}
                </span>
              )}
            </div>

            {/* Company & Department */}
            <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5 truncate">
              <Building2 size={13} className="text-slate-400 shrink-0" />
              {companySite ? (
                <a
                  href={companySite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 hover:text-indigo-600 hover:underline transition font-bold truncate inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                  title={`Visit ${companyName} official website`}
                >
                  <span>{companyName}</span>
                  <ExternalLink size={11} className="text-slate-400 shrink-0" />
                </a>
              ) : (
                <span className="text-slate-700 font-bold truncate">
                  {companyName}
                </span>
              )}
              {job.department && (
                <>
                  <span className="text-slate-300 shrink-0">•</span>
                  <span className="text-slate-500 font-medium truncate">{job.department}</span>
                </>
              )}
            </p>

            {/* Clean Metadata Row (De-duplicated) */}
            <div className="mt-2.5 flex items-center gap-2.5 flex-wrap text-xs font-medium text-slate-500">
              {/* Experience */}
              <span className="inline-flex items-center gap-1 text-slate-600 shrink-0">
                <Award size={12} className="text-slate-400" />
                <span>{job.min_years === 0 ? '0-1 Yr (Fresher)' : `${job.min_years}+ Years`}</span>
              </span>

              <span className="text-slate-300">•</span>

              {/* Work Mode / Location (De-duplicated) */}
              <span className="inline-flex items-center gap-1 text-slate-600 shrink-0">
                {job.work_mode === 'Remote' ? (
                  <Globe size={12} className="text-emerald-600" />
                ) : job.work_mode === 'Hybrid' ? (
                  <Laptop size={12} className="text-blue-600" />
                ) : (
                  <MapPin size={12} className="text-slate-400" />
                )}
                <span>
                  {job.work_mode === 'Remote'
                    ? 'Remote'
                    : safeJob.location && safeJob.location.toLowerCase() !== 'remote'
                      ? `${safeJob.location}${safeJob.work_mode ? ` (${safeJob.work_mode})` : ''}`
                      : safeJob.work_mode || safeJob.location || 'Remote'}
                </span>
              </span>

              {/* Salary Range */}
              {safeJob.salary_range && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 shrink-0">
                    <DollarSign size={11} className="text-emerald-600" />
                    <span>{safeJob.salary_range}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Calculate Match % Placeholder Badge */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCalculateMatch()
          }}
          className="self-start inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200/90 shadow-2xs transition-all hover:scale-102 cursor-pointer shrink-0"
          title="Click to evaluate your resume against this job using the unified ATS scoring engine"
        >
          <Sparkles size={13} className="text-indigo-600" />
          <span>Calculate Match %</span>
        </button>
      </div>

      {/* Snippet / Description (Clamped) */}
      <p className="mt-3.5 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
        {job.jd_text_raw}
      </p>

      {/* Skills Badges & Card Footer */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Skills list */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(job.required_skills || []).slice(0, 6).map((s, idx) => (
            <span key={idx} className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200/70 hover:bg-slate-100 transition">
              {s}
            </span>
          ))}
          {(job.required_skills || []).length > 6 && (
            <span className="text-[10px] font-bold text-slate-400">
              +{(job.required_skills || []).length - 6} more
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation()
              if (onShare) {
                onShare()
              } else {
                const jobId = job.id || job._id
                const shareUrl = `${window.location.origin}/jobs?jobId=${jobId}`
                const jobTitle = job.title || 'Career Opportunity'
                const companyName = job.company_name || 'CareerShala'

                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: `${jobTitle} at ${companyName} | CareerShala`,
                      text: `Check out this opportunity for ${jobTitle} at ${companyName}!`,
                      url: shareUrl,
                    })
                    return
                  } catch (err) {
                    if (err.name === 'AbortError') return
                  }
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(shareUrl)
                    .then(() => toast.success('Job link copied to clipboard! 📋'))
                    .catch(() => toast.success('Job link: ' + shareUrl))
                } else {
                  toast.success('Job link: ' + shareUrl)
                }
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Share job link"
          >
            <Share2 size={15} />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onViewDetail()
            }}
            className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition cursor-pointer px-2 py-1.5"
          >
            View Details
          </button>

          {hasApplied ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold cursor-not-allowed select-none">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-indigo-600 text-white transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isApplying ? (
                'Applying...'
              ) : (
                <>
                  Apply
                  <ArrowUpRight size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
