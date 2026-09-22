import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Users,
  PlusCircle,
  Plus,
  CheckCircle2,
  XCircle,
  X,
  Search,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowUpRight,
  Filter,
  Eye,
  Check,
  MoreVertical,
  Pencil,
  AlertCircle,
  Lock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyPostedJobs, createJob, updateJob, toggleJobStatus } from '../../services/api'
import CustomDropdown from '../../components/common/CustomDropdown'

export default function ManageJobs() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // State
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'open' | 'closed'
  const [togglingId, setTogglingId] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [openMenuJobId, setOpenMenuJobId] = useState(null)

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    jd_text_raw: '',
    min_years: 0,
    location: 'Remote',
    work_mode: 'Remote',
    salary_range: '',
    department: '',
  })
  const [editSkillsList, setEditSkillsList] = useState([])
  const [editSkillInput, setEditSkillInput] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.job-action-menu')) {
        setOpenMenuJobId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Post modal state
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [postingLoading, setPostingLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    company_name: '',
    jd_text_raw: '',
    required_skills: '',
    min_years: 0,
    location: 'Remote',
    work_mode: 'Remote',
    salary_range: '$90,000 - $130,000',
    department: 'Engineering',
  })

  // Smart skills input state
  const [skillsList, setSkillsList] = useState(['React', 'Node.js', 'PostgreSQL'])
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
    const title = formData.title?.trim() || 'Software Engineer'
    const dept = formData.department?.trim() || 'Engineering'
    const mode = formData.work_mode || 'Remote'
    const exp = formData.min_years ? `${formData.min_years}+ years` : '1+ years'
    const skills = skillsList.length ? skillsList.join(', ') : 'modern tech stacks, scalable architecture, automated testing'

    const generated = `About the Role:
We are seeking an exceptional ${title} to join our high-impact ${dept} team. In this role, you will design, develop, and scale mission-critical systems and craft delightful user experiences.

Key Responsibilities:
• Architect, build, and maintain robust, scalable applications and services.
• Collaborate closely with cross-functional teams to translate business requirements into technical solutions.
• Drive code quality, performance optimizations, and engineering best practices across the development lifecycle.
• Champion continuous integration, testing, and modern deployment standards.

Requirements & Qualifications:
• ${exp} of relevant industry experience in software engineering.
• Hands-on proficiency with: ${skills}.
• Experience operating effectively in a ${mode.toLowerCase()} work environment.
• Strong problem-solving aptitude, communication skills, and a collaborative mindset.`

    setFormData(prev => ({ ...prev, jd_text_raw: generated }))
    toast.success('AI-crafted Job Description generated! ✨')
  }

  // Fetch recruiter's jobs
  const fetchJobs = async () => {
    setLoading(true)
    try {
      const res = await getMyPostedJobs()
      setJobs(res.data?.jobs || [])
    } catch (err) {
      console.error('Failed to load recruiter jobs:', err)
      const msg = err.response?.data?.detail || 'Failed to fetch job postings.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  // Toggle Job Status (Open <-> Closed)
  const handleToggleStatus = async (job) => {
    const newStatus = job.status === 'open' ? 'closed' : 'open'
    setTogglingId(job.id)
    try {
      await toggleJobStatus(job.id, newStatus)
      setJobs(prev =>
        prev.map(j => (j.id === job.id ? { ...j, status: newStatus } : j))
      )
      toast.success(
        `Job "${job.title}" marked as ${newStatus.toUpperCase()}!`,
        { icon: newStatus === 'open' ? '🟢' : '⚪' }
      )
    } catch (err) {
      console.error('Status toggle error:', err)
      toast.error('Failed to update job status.')
    } finally {
      setTogglingId(null)
    }
  }

  // Resolve company name from session or local preferences
  const resolveCompany = () => {
    if (user?.company_name?.trim()) return user.company_name.trim()
    try {
      const c = JSON.parse(localStorage.getItem('recruiter_company_profile') || '{}')
      if (c.company_name?.trim()) return c.company_name.trim()
    } catch {}
    try {
      const p = JSON.parse(localStorage.getItem('recruiter_preferences') || '{}')
      if (p.company?.trim()) return p.company.trim()
    } catch {}
    return 'CareerPilot Technologies'
  }

  // Create New Job (Draft vs Publish)
  const handleCreateJob = async (e, isDraft = false) => {
    if (e) e.preventDefault()
    if (!formData.title?.trim()) {
      toast.error('Please enter a Job Title.')
      return
    }
    if (!formData.jd_text_raw?.trim()) {
      toast.error('Please enter or generate a Job Description.')
      return
    }

    setPostingLoading(true)
    try {
      const companyName = resolveCompany()
      const payload = {
        ...formData,
        title: formData.title.trim(),
        company_name: companyName,
        jd_text_raw: formData.jd_text_raw.trim(),
        min_years: parseFloat(formData.min_years) || 0,
        required_skills: skillsList,
        status: isDraft ? 'draft' : 'open',
      }

      await createJob(payload)
      toast.success(isDraft ? 'Job saved as draft! 📋' : 'Job published successfully! 🚀')
      setIsPostModalOpen(false)
      setSkillsList(['React', 'Node.js', 'PostgreSQL'])
      setSkillInput('')
      setFormData({
        title: '',
        company_name: '',
        jd_text_raw: '',
        required_skills: '',
        min_years: 0,
        location: 'Remote',
        work_mode: 'Remote',
        salary_range: '$90,000 - $130,000',
        department: 'Engineering',
      })
      fetchJobs()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to post new job.'
      toast.error(msg)
    } finally {
      setPostingLoading(false)
    }
  }

  // Open Edit Modal with prefilled data
  const handleOpenEditModal = (job) => {
    setEditingJob(job)
    setEditFormData({
      title: job.title || '',
      jd_text_raw: job.jd_text_raw || '',
      min_years: job.min_years != null ? job.min_years : 0,
      location: job.location || 'Remote',
      work_mode: job.work_mode || 'Remote',
      salary_range: job.salary_range || '',
      department: job.department || '',
    })
    setEditSkillsList(job.required_skills || [])
    setEditSkillInput('')
    setIsEditModalOpen(true)
  }

  const handleEditAddSkill = (val) => {
    const trimmed = (val !== undefined ? val : editSkillInput).trim().replace(/,/g, '')
    if (trimmed && !editSkillsList.includes(trimmed)) {
      setEditSkillsList(prev => [...prev, trimmed])
    }
    setEditSkillInput('')
  }

  const handleEditRemoveSkill = (skillToRemove) => {
    setEditSkillsList(prev => prev.filter(s => s !== skillToRemove))
  }

  const handleEditSkillKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleEditAddSkill()
    } else if (e.key === 'Backspace' && !editSkillInput && editSkillsList.length > 0) {
      handleEditRemoveSkill(editSkillsList[editSkillsList.length - 1])
    }
  }

  // Save Job Edits
  const handleSaveJobEdit = async (e) => {
    if (e) e.preventDefault()
    if (!editingJob) return
    if (!editFormData.title?.trim()) {
      toast.error('Please enter a Job Title.')
      return
    }

    const hasApplicants = (editingJob.applicant_count || 0) > 0
    setEditLoading(true)
    try {
      const payload = {
        title: editFormData.title.trim(),
        location: editFormData.location.trim(),
        work_mode: editFormData.work_mode,
        salary_range: editFormData.salary_range.trim() || null,
        department: editFormData.department.trim() || null,
      }

      // Only send core requirements if no applicants yet
      if (!hasApplicants) {
        payload.jd_text_raw = editFormData.jd_text_raw.trim()
        payload.min_years = parseFloat(editFormData.min_years) || 0
        payload.required_skills = editSkillsList
      }

      await updateJob(editingJob.id, payload)
      toast.success('Job details updated successfully! ✨')
      setIsEditModalOpen(false)
      setEditingJob(null)
      fetchJobs()
    } catch (err) {
      console.error('Job update error:', err)
      const msg = err.response?.data?.detail || 'Failed to update job posting.'
      toast.error(msg)
    } finally {
      setEditLoading(false)
    }
  }

  // Metrics computation
  const metrics = useMemo(() => {
    const total = jobs.length
    const openCount = jobs.filter(j => j.status === 'open').length
    const closedCount = jobs.filter(j => j.status === 'closed').length
    const totalApplicants = jobs.reduce((acc, curr) => acc + (curr.applicant_count || 0), 0)
    return { total, openCount, closedCount, totalApplicants }
  }, [jobs])

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch =
        !searchQuery.trim() ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.required_skills && job.required_skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())))

      const matchesStatus =
        statusFilter === 'all' || job.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [jobs, searchQuery, statusFilter])

  // Location formatter avoiding duplicate "Remote Remote"
  const formatJobLocation = (job) => {
    const loc = (job.location || '').trim()
    const mode = (job.work_mode || '').trim()
    if (!loc && !mode) return 'Remote'
    if (!loc) return mode
    if (!mode) return loc
    if (loc.toLowerCase() === mode.toLowerCase()) return mode
    if (loc.toLowerCase().startsWith(mode.toLowerCase())) return loc
    if (loc.toLowerCase().endsWith(mode.toLowerCase())) return loc
    return `${mode} • ${loc}`
  }

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 antialiased pb-20">
      
      {/* ── 1. Top Header & Metrics Banner ─────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 border border-slate-200/60 rounded-full px-3 py-1 text-xs font-medium">
                  <Briefcase size={13} className="text-slate-400" />
                  Recruiter Control Center
                </span>
                <span className="bg-slate-100 text-slate-500 border border-slate-200/60 rounded-full px-3 py-1 text-xs font-medium">
                  {user?.full_name || 'Recruiter'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-poppins tracking-tight">
                Manage Job Postings
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Oversee active openings, monitor incoming candidate submissions, and publish new positions indexed into the AI semantic matcher.
              </p>
            </div>

            {/* Quick Actions - Primary CTA only */}
            <div>
              <button
                type="button"
                onClick={() => setIsPostModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                <span>Post New Job</span>
              </button>
            </div>
          </div>

          {/* Metric Stats Cards */}
          <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Postings</span>
                <Layers size={16} className="text-slate-400" />
              </div>
              <p className="text-2xl font-black text-slate-900 font-poppins mt-2">
                {metrics.total}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Active Roles</span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-900 font-poppins mt-2">
                {metrics.openCount}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Total Applicants</span>
                <Users size={16} className="text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-indigo-900 font-poppins mt-2">
                {metrics.totalApplicants}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Closed Roles</span>
                <XCircle size={16} className="text-slate-400" />
              </div>
              <p className="text-2xl font-black text-slate-900 font-poppins mt-2">
                {metrics.closedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Filters & Controls ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Unified Search & Filter Control Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex flex-col sm:flex-row items-center justify-between shadow-sm mb-4 gap-2">
          {/* Search Box - Seamless Borderless */}
          <div className="relative w-full sm:w-80 flex items-center">
            <Search className="absolute left-3.5 text-slate-400 pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Search postings by title or skill..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-transparent border-none focus:ring-0 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Tabs & Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end pr-1">
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
              {[
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Active' },
                { id: 'closed', label: 'Closed' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchJobs}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="Refresh Postings"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* ── 3. Postings Table / List View ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl animate-pulse">
                  <div className="space-y-2 w-1/3">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                  <div className="h-6 bg-slate-200 rounded-full w-20" />
                  <div className="h-6 bg-slate-200 rounded w-16" />
                  <div className="h-8 bg-slate-200 rounded-xl w-24" />
                </div>
              ))}
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="overflow-visible">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Job Details</th>
                    <th className="py-3.5 px-4">Location / Mode</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Applicants</th>
                    <th className="py-3.5 px-4">Date Posted</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {filteredJobs.map((job) => {
                    const isOpen = job.status === 'open'
                    const dateStr = job.created_at
                      ? new Date(job.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Recent'

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/70 transition">
                        
                        {/* Title & Company */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span
                              onClick={() => setSelectedJob(job)}
                              className="text-base font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                              title="Click to view details"
                            >
                              {job.title}
                            </span>
                            {job.min_years === 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                Fresher
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">{job.company_name}</span>
                            {job.department && (
                              <>
                                <span>•</span>
                                <span>{job.department}</span>
                              </>
                            )}
                            {job.salary_range && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">{job.salary_range}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Location / Mode */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="text-slate-400 shrink-0" size={14} />
                            <span className="text-sm font-medium text-slate-600">{formatJobLocation(job)}</span>
                          </div>
                        </td>

                        {/* Status (Pill & quick toggle) */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isOpen
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isOpen ? 'Open' : 'Closed'}
                          </span>
                        </td>

                        {/* Total Applicants */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => navigate(`/recruiter/jobs/${job.id}/applicants`)}
                            className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                            title="Open Applicants Kanban Pipeline"
                          >
                            <Users size={13} className="text-blue-600" />
                            <span>{job.applicant_count || 0}</span>
                          </button>
                        </td>

                        {/* Date Posted */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                          {dateStr}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 job-action-menu relative">
                            <button
                              type="button"
                              onClick={() => navigate(`/recruiter/jobs/${job.id}/applicants`)}
                              className="bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                              title="Open Applicants Kanban Pipeline"
                            >
                              <Users size={14} className="text-slate-400" />
                              <span>Pipeline</span>
                            </button>

                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuJobId(openMenuJobId === job.id ? null : job.id)
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="More options"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {openMenuJobId === job.id && (
                                <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 text-left animate-in fade-in zoom-in-95 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenEditModal(job)
                                      setOpenMenuJobId(null)
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Pencil size={14} className="text-slate-400" />
                                    <span>Edit Role</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedJob(job)
                                      setOpenMenuJobId(null)
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Eye size={14} className="text-slate-400" />
                                    <span>View Details</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={togglingId === job.id}
                                    onClick={() => {
                                      handleToggleStatus(job)
                                      setOpenMenuJobId(null)
                                    }}
                                    className={`w-full px-3.5 py-2 text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                                      isOpen
                                        ? 'text-rose-600 hover:bg-rose-50'
                                        : 'text-emerald-600 hover:bg-emerald-50'
                                    } disabled:opacity-50`}
                                  >
                                    {isOpen ? (
                                      <>
                                        <XCircle size={14} className="text-rose-500" />
                                        <span>Close Role</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 size={14} className="text-emerald-500" />
                                        <span>Reopen Role</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Empty State */
            <div className="p-12 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
                <Briefcase size={28} />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 font-poppins mb-1">
                {searchQuery || statusFilter !== 'all' ? 'No matching postings found' : 'No job postings yet'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try clearing your search query or switching to view all postings.'
                  : 'Start recruiting top candidate talent by creating your first verified job opening.'}
              </p>
              <button
                type="button"
                onClick={() => setIsPostModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                <Plus size={16} />
                Post Your First Job
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. View Details Modal (Rendered via React Portal) ─────────────── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedJob && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 relative max-h-[85vh] flex flex-col"
              >
                <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {selectedJob.work_mode}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">•</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {selectedJob.min_years === 0 ? 'Fresher Friendly' : `${selectedJob.min_years}+ Years Exp`}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 font-poppins">
                      {selectedJob.title}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {selectedJob.company_name} • {selectedJob.location}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="overflow-y-auto py-5 space-y-5 flex-1 pr-1 custom-scrollbar">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Applicants</span>
                      <span className="text-sm font-black text-indigo-600 mt-0.5 block">{selectedJob.applicant_count || 0}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Status</span>
                      <span className="text-sm font-black text-slate-800 mt-0.5 block capitalize">{selectedJob.status}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Compensation</span>
                      <span className="text-xs font-bold text-slate-800 mt-1 block">{selectedJob.salary_range || 'Competitive'}</span>
                    </div>
                  </div>

                  {/* Skills */}
                  {selectedJob.required_skills?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 tracking-wider">Required Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedJob.required_skills.map((s, idx) => (
                          <span key={idx} className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw JD */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 tracking-wider">Job Description</h4>
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {selectedJob.jd_text_raw}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedJob.id
                      setSelectedJob(null)
                      navigate(`/recruiter/jobs/${id}/applicants`)
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Users size={14} />
                    <span>Open Pipeline ({selectedJob.applicant_count || 0})</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── 5. Post Job Modal (Rendered via React Portal with Massive z-[9999]) ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isPostModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setIsPostModalOpen(false)}
              />

              {/* Modal Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden z-10"
              >
                <form onSubmit={(e) => handleCreateJob(e, false)} className="flex flex-col h-full max-h-[90vh] overflow-hidden">
                  
                  {/* Header (Fixed at top of modal) */}
                  <div className="p-5 border-b border-slate-100 shrink-0 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 font-poppins">
                        Post a New Job
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Publish a new open role or save it as a draft to attract top-tier talent.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPostModalOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Scrollable Form Body */}
                  <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    
                    {/* 1. Job Title (Full width row) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Job Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Junior / Senior Backend Engineer"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    {/* 2. 3-Column Grid: Work Mode, Min Exp, Department */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Work Mode</label>
                        <CustomDropdown
                          value={formData.work_mode}
                          onChange={val => setFormData({ ...formData, work_mode: val })}
                          options={[
                            { value: 'Remote', label: 'Remote' },
                            { value: 'Hybrid', label: 'Hybrid' },
                            { value: 'Onsite', label: 'Onsite' }
                          ]}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Min Exp (Years)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="15"
                          value={formData.min_years}
                          onChange={e => setFormData({ ...formData, min_years: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Department</label>
                        <input
                          type="text"
                          placeholder="e.g. Engineering"
                          value={formData.department}
                          onChange={e => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* 3. 2-Column Grid: Location & Salary Range */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Location</label>
                        <input
                          type="text"
                          placeholder="e.g. San Francisco, CA or Remote"
                          value={formData.location}
                          onChange={e => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Salary Range</label>
                        <input
                          type="text"
                          placeholder="e.g. $90,000 - $130,000"
                          value={formData.salary_range}
                          onChange={e => setFormData({ ...formData, salary_range: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* 4. Smart Skills Input (Tag/Pill UI) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Required Skills
                      </label>
                      <div className="w-full min-h-[42px] p-1.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-1.5 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all cursor-text">
                        {skillsList.map((skill, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-xs font-medium"
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-600">Job Description *</label>
                        <button
                          type="button"
                          onClick={handleGenerateJDWithAI}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Sparkles size={13} className="text-indigo-600" />
                          Generate with AI
                        </button>
                      </div>
                      <textarea
                        required
                        rows={4}
                        placeholder="Describe role responsibilities, core technical qualifications, and team mission..."
                        value={formData.jd_text_raw}
                        onChange={e => setFormData({ ...formData, jd_text_raw: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans leading-relaxed custom-scrollbar"
                      />
                    </div>

                  </div>

                  {/* Footer (Fixed at bottom of modal) */}
                  <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50 rounded-b-2xl flex justify-between items-center gap-3">
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
        </AnimatePresence>,
        document.body
      )}

      {/* ── 6. Edit Job Modal ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isEditModalOpen && editingJob && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => !editLoading && setIsEditModalOpen(false)}
              />

              {/* Modal Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden z-10"
              >
                <form onSubmit={handleSaveJobEdit} className="flex flex-col h-full max-h-[90vh] overflow-hidden">
                  {/* Header */}
                  <div className="p-5 border-b border-slate-100 shrink-0 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-slate-900 font-poppins">
                          Edit Job Posting
                        </h3>
                        {(editingJob.applicant_count || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Lock size={12} />
                            Scoring Locked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(editingJob.applicant_count || 0) > 0
                          ? `This role has ${editingJob.applicant_count} applicant(s). Core scoring requirements are locked to prevent score desync.`
                          : 'Update job details, requirements, and metadata for this role.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={editLoading}
                      onClick={() => setIsEditModalOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Scrollable Form Body */}
                  <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {/* Locked Banner if applicants > 0 */}
                    {(editingJob.applicant_count || 0) > 0 && (
                      <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-amber-950">Active Applicants Detected ({editingJob.applicant_count})</p>
                          <p className="text-amber-800 mt-0.5">
                            To preserve ATS scoring integrity, <strong>Required Skills</strong>, <strong>Minimum Experience</strong>, and <strong>Job Description</strong> cannot be edited. Non-scoring fields like Salary, Department, Location, and Work Mode can be edited freely.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 1. Job Title */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Job Title *</label>
                      <input
                        type="text"
                        required
                        value={editFormData.title}
                        onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    {/* 2. 3-Column Grid: Work Mode, Min Exp, Department */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Work Mode</label>
                        <CustomDropdown
                          value={editFormData.work_mode}
                          onChange={val => setEditFormData({ ...editFormData, work_mode: val })}
                          options={[
                            { value: 'Remote', label: 'Remote' },
                            { value: 'Hybrid', label: 'Hybrid' },
                            { value: 'Onsite', label: 'Onsite' }
                          ]}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-600">Min Exp (Years)</label>
                          {(editingJob.applicant_count || 0) > 0 && (
                            <span className="text-[10px] text-amber-700 flex items-center gap-0.5 font-medium">
                              <Lock size={10} /> Locked
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="15"
                          disabled={(editingJob.applicant_count || 0) > 0}
                          value={editFormData.min_years}
                          onChange={e => setEditFormData({ ...editFormData, min_years: e.target.value })}
                          className={`w-full px-4 py-2 rounded-xl text-sm transition-all ${
                            (editingJob.applicant_count || 0) > 0
                              ? 'bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Department</label>
                        <input
                          type="text"
                          placeholder="e.g. Engineering"
                          value={editFormData.department}
                          onChange={e => setEditFormData({ ...editFormData, department: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* 3. Location & Salary Range */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Location</label>
                        <input
                          type="text"
                          placeholder="e.g. San Francisco, CA or Remote"
                          value={editFormData.location}
                          onChange={e => setEditFormData({ ...editFormData, location: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Salary Range</label>
                        <input
                          type="text"
                          placeholder="e.g. $90,000 - $130,000"
                          value={editFormData.salary_range}
                          onChange={e => setEditFormData({ ...editFormData, salary_range: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* 4. Required Skills */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-600">Required Skills</label>
                        {(editingJob.applicant_count || 0) > 0 && (
                          <span className="text-[10px] text-amber-700 flex items-center gap-0.5 font-medium">
                            <Lock size={10} /> Locked ({editingJob.applicant_count} applicants)
                          </span>
                        )}
                      </div>
                      <div className={`w-full min-h-[42px] p-1.5 border rounded-xl flex flex-wrap items-center gap-1.5 transition-all ${
                        (editingJob.applicant_count || 0) > 0
                          ? 'bg-slate-100/80 border-slate-200 cursor-not-allowed'
                          : 'bg-slate-50 border-slate-200 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 cursor-text'
                      }`}>
                        {editSkillsList.map((skill, index) => (
                          <span
                            key={index}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                              (editingJob.applicant_count || 0) > 0
                                ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}
                          >
                            <span>{skill}</span>
                            {(editingJob.applicant_count || 0) === 0 && (
                              <button
                                type="button"
                                onClick={() => handleEditRemoveSkill(skill)}
                                className="text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded p-0.5 transition cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </span>
                        ))}
                        {(editingJob.applicant_count || 0) === 0 && (
                          <input
                            type="text"
                            value={editSkillInput}
                            onChange={e => setEditSkillInput(e.target.value)}
                            onKeyDown={handleEditSkillKeyDown}
                            onBlur={() => handleEditAddSkill()}
                            placeholder={editSkillsList.length === 0 ? "Type a skill and press Enter or comma..." : "Add skill..."}
                            className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm text-slate-900 placeholder:text-slate-400 py-1 px-1.5 focus:ring-0"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {(editingJob.applicant_count || 0) > 0
                          ? 'Skills are locked to maintain ATS match score fairness for existing applicants.'
                          : 'Press Enter or comma to add a skill tag.'}
                      </p>
                    </div>

                    {/* 5. Job Description */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-600">Job Description *</label>
                        {(editingJob.applicant_count || 0) > 0 && (
                          <span className="text-[10px] text-amber-700 flex items-center gap-0.5 font-medium">
                            <Lock size={10} /> Locked ({editingJob.applicant_count} applicants)
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={6}
                        required
                        disabled={(editingJob.applicant_count || 0) > 0}
                        value={editFormData.jd_text_raw}
                        onChange={e => setEditFormData({ ...editFormData, jd_text_raw: e.target.value })}
                        className={`w-full px-4 py-2.5 rounded-xl text-sm transition-all ${
                          (editingJob.applicant_count || 0) > 0
                            ? 'bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed resize-none'
                            : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                      />
                      {(editingJob.applicant_count || 0) > 0 && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          Role description locked. Close this role and post a new one if core requirements change.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      disabled={editLoading}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-white transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={editLoading}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {editLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
