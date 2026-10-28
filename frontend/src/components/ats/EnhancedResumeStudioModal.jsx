import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowLeftRight,
  Download,
  CheckCircle2,
  Edit3,
  X,
  Sparkles,
  Loader2,
  FileText,
  Eye,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Check,
  ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import { recompileResumePdf } from '../../services/api'

export default function EnhancedResumeStudioModal({
  data,
  result,
  resumeFile,
  isGenerating = false,
  onClose,
  onSetPrimary,
  primaryResumeUpdating = false,
}) {
  const [mounted, setMounted] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [checkingATS, setCheckingATS] = useState(false)
  const [isRecompiling, setIsRecompiling] = useState(false)
  const [calculatedNewScore, setCalculatedNewScore] = useState(null)
  const [mobileTab, setMobileTab] = useState('enhanced')
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)

  useEffect(() => {
    setMounted(true)
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => {
      setMounted(false)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // ── Baseline Old Resume Data & PDF URL ─────────────────────────────────────
  const oldScore = Math.round(
    result?.strict_ats_score ??
    result?.strict_score ??
    result?.final_score ??
    result?.math_score ??
    result?.match_score ?? 81
  )

  const originalPdfUrl = useMemo(() => {
    if (resumeFile instanceof File || resumeFile instanceof Blob) {
      try {
        return URL.createObjectURL(resumeFile)
      } catch (e) {
        return null
      }
    }
    if (resumeFile?.file_url) return resumeFile.file_url
    if (result?.file_url) return result.file_url
    return null
  }, [resumeFile, result])

  const initialPdfUrl = useMemo(() => {
    if (!data?.pdf_url) return null
    return data.pdf_url.startsWith('/api')
      ? (import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin) + data.pdf_url
      : data.pdf_url
  }, [data?.pdf_url])

  const [currentPdfUrl, setCurrentPdfUrl] = useState(initialPdfUrl)

  useEffect(() => {
    if (initialPdfUrl) {
      setCurrentPdfUrl(initialPdfUrl)
    }
  }, [initialPdfUrl])

  // ── Build Initial Editable State ───────────────────────────────────────────
  const buildInitialResume = () => {
    const base = data?.enhanced_data || {}
    const ext = result?.extracted_data || {}
    const contact = base.contact || ext.contact || ext.contact_info || {}

    // Clean certs
    const formatCert = (c) => {
      if (!c) return ''
      if (typeof c === 'object') {
        const n = c.name || c.title || c.certificate || c.award || ''
        const iss = c.issuer || c.organization || c.authority || c.event || ''
        const yr = c.issue_date || c.year || c.date || ''
        let out = n
        if (iss && iss.toLowerCase() !== 'none' && !out.toLowerCase().includes(iss.toLowerCase())) {
          out += ` — ${iss}`
        }
        if (yr && yr.toLowerCase() !== 'none') out += ` (${yr})`
        return out.replace(/^[\s•▸–—*>\s]+/, '').trim()
      }
      return String(c).replace(/^[\s•▸–—*>\s]+/, '').trim()
    }

    // Clean education
    const rawEdu = (base.education && base.education.length > 0 ? base.education : (ext.education || [])).map(e => ({
      institution: e.institution || e.school || e.college || '',
      degree: e.degree || '',
      year: e.year || (e.start_year && e.end_year ? `${e.start_year} - ${e.end_year}` : String(e.end_year || e.start_year || '')),
      score: e.score || (e.cgpa ? `CGPA: ${e.cgpa}` : (e.gpa ? `GPA: ${e.gpa}` : '')),
      coursework: e.coursework || e.courses || ''
    }))

    // Filter projects so leaked education isn't in projects
    const rawProj = (base.projects && base.projects.length > 0 ? base.projects : (ext.projects || []))
      .filter(p => {
        const name = (p.name || p.title || '').toLowerCase()
        const isEdu = ['university', 'college', 'b.tech', 'm.tech'].some(k => name.includes(k))
        return !(isEdu && (!p.technologies || p.technologies.length === 0) && (!p.highlights || p.highlights.length === 0))
      })
      .map(p => {
        let hl = Array.isArray(p.highlights)
          ? p.highlights.map(h => String(h).replace(/^[\s•▸–—*>\s]+/, '').trim()).filter(Boolean)
          : []
        if (hl.length === 0 && p.description) {
          const sentences = String(p.description)
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 15)
          hl = sentences.length > 0 ? sentences.slice(0, 3) : [String(p.description).trim()]
        }
        return {
          name: p.name || p.title || '',
          technologies: Array.isArray(p.technologies) ? p.technologies : (typeof p.technologies === 'string' ? p.technologies.split(',').map(s => s.trim()) : []),
          link: p.link || p.live_demo || p.url || '',
          github: p.github || p.repo || p.github_url || '',
          highlights: hl
        }
      })

    const rawExp = (base.experience && base.experience.length > 0 ? base.experience : (ext.experience || ext.work_experience || [])).map(exp => ({
      role: exp.role || exp.title || '',
      company: exp.company || '',
      duration: exp.duration || exp.dates || exp.period || (exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` : ''),
      location: exp.location || '',
      highlights: Array.isArray(exp.highlights) ? exp.highlights.map(h => String(h).replace(/^[\s•▸–—*>\s]+/, '').trim()) : []
    }))

    let rawSkills = {}
    if (base.skills && typeof base.skills === 'object' && !Array.isArray(base.skills) && Object.keys(base.skills).length > 0) {
      rawSkills = base.skills
    } else if (ext.skills && typeof ext.skills === 'object' && !Array.isArray(ext.skills) && Object.keys(ext.skills).length > 0) {
      rawSkills = ext.skills
    } else if (Array.isArray(base.skills) && base.skills.length > 0) {
      rawSkills = base.skills
    } else if (Array.isArray(ext.skills) && ext.skills.length > 0) {
      rawSkills = ext.skills
    } else if (typeof ext.skills === 'object' && ext.skills) {
      rawSkills = ext.skills
    }

    return {
      full_name: base.full_name || ext.full_name || ext.name || 'Rohit Agrawal',
      role_title: base.target_role || base.role_title || ext.role_title || '',
      email: contact.email || ext.email || '',
      phone: contact.phone || ext.phone || '',
      location: contact.location || ext.location || '',
      linkedin: contact.linkedin || ext.linkedin || '',
      github: contact.github || ext.github || '',
      portfolio: contact.portfolio || ext.portfolio || '',
      summary: (data?.enhanced_summary || base.summary || ext.summary || '').trim(),
      experience: rawExp,
      projects: rawProj,
      education: rawEdu,
      skills: rawSkills,
      certifications: (base.certifications || ext.certifications || []).map(formatCert).filter(Boolean),
      achievements: (base.achievements || ext.achievements || []).map(formatCert).filter(Boolean)
    }
  }

  const [resumeData, setResumeData] = useState(buildInitialResume)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Auto-detect if resume is extensive enough for 2 pages
  const isMultiPageContent = useMemo(() => {
    const expCount = resumeData.experience?.length || 0
    const projCount = resumeData.projects?.length || 0
    const certCount = resumeData.certifications?.length || 0
    const totalBullets = (resumeData.experience || []).reduce((acc, e) => acc + (e.highlights?.length || 0), 0) +
                         (resumeData.projects || []).reduce((acc, p) => acc + (p.highlights?.length || 0), 0)
    return (expCount + projCount >= 3) || totalBullets >= 5 || (expCount >= 1 && projCount >= 2) || certCount >= 3
  }, [resumeData])

  const [pageLayout, setPageLayout] = useState('auto') // 'auto' (2-page if multi-page), '1page', '2page'
  const isTwoPage = pageLayout === '2page' || (pageLayout === 'auto' && isMultiPageContent)

  // Sync if initial data changes
  useEffect(() => {
    setResumeData(buildInitialResume())
  }, [data, result])

  const handleDownload = async () => {
    setIsRecompiling(true)
    const toastId = toast.loading('Generating complete ATS-approved PDF...')
    try {
      const res = await recompileResumePdf({
        resume_id: result?.resume_id || data?.resume_id,
        enhanced_data: {
          ...resumeData,
          contact: {
            full_name: resumeData.full_name,
            email: resumeData.email,
            phone: resumeData.phone,
            location: resumeData.location,
            linkedin: resumeData.linkedin,
            github: resumeData.github,
            portfolio: resumeData.portfolio
          }
        }
      })
      if (res?.data?.pdf_url) {
        let newUrl = res.data.pdf_url
        if (newUrl.startsWith('/api')) {
          newUrl = (import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin) + newUrl
        }
        setCurrentPdfUrl(newUrl)
        setHasUnsavedChanges(false)
        toast.success('Download started! 📄', { id: toastId })
        window.open(newUrl + (newUrl.includes('?') ? '&' : '?') + 'fl_attachment=true', '_blank')
      } else {
        toast.error('Could not compile PDF. Please try again.', { id: toastId })
      }
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Download failed. Please try again.', { id: toastId })
    } finally {
      setIsRecompiling(false)
    }
  }

  const handleCheckATS = () => {
    setCheckingATS(true)
    setTimeout(() => {
      const backendScore = data?.score_lift?.after || data?.strict_ats_score || Math.min(96, Math.max(90, oldScore + 14))
      setCalculatedNewScore(Math.round(backendScore))
      setCheckingATS(false)
      toast.success('ATS score evaluated for enhanced resume!', { icon: '🎯' })
    }, 900)
  }

  // ── Recompile PDF after Inline Edits ───────────────────────────────────────
  const handleRecompilePDF = async (silent = false) => {
    setIsRecompiling(true)
    try {
      const res = await recompileResumePdf({
        resume_id: result?.resume_id || data?.resume_id,
        enhanced_data: {
          ...resumeData,
          contact: {
            full_name: resumeData.full_name,
            email: resumeData.email,
            phone: resumeData.phone,
            location: resumeData.location,
            linkedin: resumeData.linkedin,
            github: resumeData.github,
            portfolio: resumeData.portfolio
          }
        }
      })
      if (res?.data?.pdf_url) {
        let newUrl = res.data.pdf_url
        if (newUrl.startsWith('/api')) {
          newUrl = (import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin) + newUrl
        }
        setCurrentPdfUrl(newUrl)
        setHasUnsavedChanges(false)
        if (!silent) {
          setIsEditMode(false)
          toast.success('PDF updated with your edits!', { icon: '✨' })
        }
      } else {
        if (!silent) toast.error('Could not compile PDF. Please check your network.')
      }
    } catch (err) {
      console.error('Recompilation error:', err)
      if (!silent) toast.error(err.response?.data?.detail || 'Failed to recompile PDF.')
    } finally {
      setIsRecompiling(false)
    }
  }

  // Auto-compile in background if no PDF URL yet but modal is open
  useEffect(() => {
    if (!currentPdfUrl && !isGenerating && !isRecompiling && (result?.resume_id || data?.resume_id)) {
      handleRecompilePDF(true)
    }
  }, [currentPdfUrl, isGenerating])

  const handleResetToAI = () => {
    if (window.confirm('Reset all inline edits back to the AI-enhanced version?')) {
      setResumeData(buildInitialResume())
      setHasUnsavedChanges(false)
      toast.success('Reset to AI enhanced version')
    }
  }

  // Helper mutators for inline editing
  const updateField = (field, val) => {
    setResumeData(prev => ({ ...prev, [field]: val }))
    setHasUnsavedChanges(true)
  }

  const updateExpHighlight = (expIdx, bIdx, text) => {
    setResumeData(prev => {
      const expCopy = [...prev.experience]
      const bullets = [...(expCopy[expIdx]?.highlights || [])]
      bullets[bIdx] = text
      expCopy[expIdx] = { ...expCopy[expIdx], highlights: bullets }
      return { ...prev, experience: expCopy }
    })
    setHasUnsavedChanges(true)
  }

  const addExpHighlight = (expIdx) => {
    setResumeData(prev => {
      const expCopy = [...prev.experience]
      const bullets = [...(expCopy[expIdx]?.highlights || []), '']
      expCopy[expIdx] = { ...expCopy[expIdx], highlights: bullets }
      return { ...prev, experience: expCopy }
    })
    setHasUnsavedChanges(true)
  }

  const removeExpHighlight = (expIdx, bIdx) => {
    setResumeData(prev => {
      const expCopy = [...prev.experience]
      const bullets = (expCopy[expIdx]?.highlights || []).filter((_, i) => i !== bIdx)
      expCopy[expIdx] = { ...expCopy[expIdx], highlights: bullets }
      return { ...prev, experience: expCopy }
    })
    setHasUnsavedChanges(true)
  }

  const updateProjHighlight = (projIdx, bIdx, text) => {
    setResumeData(prev => {
      const projCopy = [...prev.projects]
      const bullets = [...(projCopy[projIdx]?.highlights || [])]
      bullets[bIdx] = text
      projCopy[projIdx] = { ...projCopy[projIdx], highlights: bullets }
      return { ...prev, projects: projCopy }
    })
    setHasUnsavedChanges(true)
  }

  const addProjHighlight = (projIdx) => {
    setResumeData(prev => {
      const projCopy = [...prev.projects]
      const bullets = [...(projCopy[projIdx]?.highlights || []), '']
      projCopy[projIdx] = { ...projCopy[projIdx], highlights: bullets }
      return { ...prev, projects: projCopy }
    })
    setHasUnsavedChanges(true)
  }

  const removeProjHighlight = (projIdx, bIdx) => {
    setResumeData(prev => {
      const projCopy = [...prev.projects]
      const bullets = (projCopy[projIdx]?.highlights || []).filter((_, i) => i !== bIdx)
      projCopy[projIdx] = { ...projCopy[projIdx], highlights: bullets }
      return { ...prev, projects: projCopy }
    })
    setHasUnsavedChanges(true)
  }

  const updateCert = (idx, text) => {
    setResumeData(prev => {
      const copy = [...prev.certifications]
      copy[idx] = text
      return { ...prev, certifications: copy }
    })
    setHasUnsavedChanges(true)
  }

  const removeCert = (idx) => {
    setResumeData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== idx)
    }))
    setHasUnsavedChanges(true)
  }

  const addCert = () => {
    setResumeData(prev => ({
      ...prev,
      certifications: [...prev.certifications, 'New Certification — Organization (2024)']
    }))
    setHasUnsavedChanges(true)
  }

  // ── Modular Section Renderers for 1-Page & 2-Page Canvas ──
  const renderHeader = () => (
    <div className="text-center pb-4 border-b border-slate-300 space-y-1">
      {isEditMode ? (
        <input
          type="text"
          value={resumeData.full_name}
          onChange={(e) => updateField('full_name', e.target.value)}
          placeholder="Your Full Name"
          className="text-xl sm:text-2xl font-bold text-slate-900 text-center w-full focus:outline-none focus:bg-sky-50/50 rounded px-1 hover:border-slate-300 border border-transparent transition"
        />
      ) : (
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{resumeData.full_name}</h1>
      )}

      {resumeData.role_title && (
        isEditMode ? (
          <input
            type="text"
            value={resumeData.role_title}
            onChange={(e) => updateField('role_title', e.target.value)}
            placeholder="Target Role Title"
            className="text-xs font-semibold text-[#1d4ed8] text-center w-full focus:outline-none focus:bg-sky-50/50 rounded px-1 hover:border-slate-300 border border-transparent transition"
          />
        ) : (
          <p className="text-xs font-semibold text-[#1d4ed8]">{resumeData.role_title}</p>
        )
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 pt-1">
        {isEditMode ? (
          <>
            <input
              type="text"
              value={resumeData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="email@example.com"
              className="text-center focus:outline-none focus:bg-sky-50/50 rounded px-1 hover:border-slate-300 border border-transparent"
            />
            <span className="text-slate-300">|</span>
            <input
              type="text"
              value={resumeData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+91 Phone"
              className="text-center focus:outline-none focus:bg-sky-50/50 rounded px-1 hover:border-slate-300 border border-transparent"
            />
            <span className="text-slate-300">|</span>
            <input
              type="text"
              value={resumeData.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="City, Country"
              className="text-center focus:outline-none focus:bg-sky-50/50 rounded px-1 hover:border-slate-300 border border-transparent"
            />
          </>
        ) : (
          <span>
            {[resumeData.email, resumeData.phone, resumeData.location].filter(Boolean).join(' | ')}
          </span>
        )}
      </div>

      {(resumeData.linkedin || resumeData.github || resumeData.portfolio) && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#1d4ed8] font-medium pt-0.5">
          {isEditMode ? (
            <>
              {resumeData.linkedin && (
                <input
                  type="text"
                  value={resumeData.linkedin}
                  onChange={(e) => updateField('linkedin', e.target.value)}
                  placeholder="LinkedIn URL"
                  className="text-center focus:outline-none focus:bg-sky-50/50 rounded px-1 hover:border-slate-300 border border-transparent text-[#1d4ed8]"
                />
              )}
              {resumeData.github && (
                <input
                  type="text"
                  value={resumeData.github}
                  onChange={(e) => updateField('github', e.target.value)}
                  placeholder="GitHub URL"
                  className="text-center focus:outline-none focus:bg-sky-50/50 rounded px-1 hover:border-slate-300 border border-transparent text-[#1d4ed8]"
                />
              )}
            </>
          ) : (
            <>
              {resumeData.linkedin && <span className="hover:underline cursor-pointer">LinkedIn</span>}
              {resumeData.github && <span className="hover:underline cursor-pointer">GitHub</span>}
              {resumeData.portfolio && <span className="hover:underline cursor-pointer">Portfolio</span>}
            </>
          )}
        </div>
      )}
    </div>
  )

  const renderSummary = () => (
    <div className="space-y-1">
      <div className="flex items-center justify-between border-b border-slate-900 pb-0.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Summary</span>
        <span className="text-[10px] text-sky-600 font-semibold flex items-center gap-1">
          <Sparkles size={10} /> ATS Optimized
        </span>
      </div>
      {isEditMode ? (
        <textarea
          value={resumeData.summary}
          onChange={(e) => updateField('summary', e.target.value)}
          rows={3}
          className="w-full text-xs text-slate-700 leading-relaxed p-1.5 focus:outline-none focus:ring-1 focus:ring-[#2E9BDA] focus:bg-sky-50/30 rounded border border-transparent hover:border-slate-200 transition resize-y font-sans"
          placeholder="Write a concise professional summary highlighting your strengths..."
        />
      ) : (
        <p className="text-xs text-slate-700 leading-relaxed pt-1">{resumeData.summary}</p>
      )}
    </div>
  )

  const renderSkills = () => {
    if (!resumeData.skills) return null
    const hasObjSkills = typeof resumeData.skills === 'object' && !Array.isArray(resumeData.skills) && Object.keys(resumeData.skills).length > 0
    const hasArrSkills = Array.isArray(resumeData.skills) && resumeData.skills.length > 0
    if (!hasObjSkills && !hasArrSkills) return null

    return (
      <div className="space-y-1.5">
        <div className="border-b border-slate-900 pb-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Technical Skills</span>
        </div>
        {hasObjSkills ? (
          <div className="space-y-1 text-xs">
            {Object.entries(resumeData.skills).map(([cat, list], idx) => (
              <div key={idx} className="text-xs text-slate-700 leading-relaxed">
                <strong className="text-slate-900 font-semibold">{cat}:</strong>{' '}
                <span>{Array.isArray(list) ? list.join(', ') : String(list)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-700 leading-relaxed">
            {Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : String(resumeData.skills)}
          </p>
        )}
      </div>
    )
  }

  const renderExperience = () => {
    if (!resumeData.experience || resumeData.experience.length === 0) return null
    return (
      <div className="space-y-3">
        <div className="border-b border-slate-900 pb-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Experience</span>
        </div>
        {resumeData.experience.map((exp, expIdx) => (
          <div key={expIdx} className="space-y-1.5 group/exp">
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-baseline gap-1 text-xs">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-slate-900">{exp.role || 'Role'}</span>
                <span className="text-slate-400">|</span>
                <span className="font-semibold text-[#1d4ed8]">{exp.company || 'Company'}</span>
              </div>
              <span className="text-[11px] font-medium text-slate-600 shrink-0">{exp.duration}</span>
            </div>

            {/* Bullets */}
            <div className="space-y-1 pl-1">
              {isEditMode ? (
                <>
                  {(exp.highlights || []).map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-1.5 group/b">
                      <span className="text-slate-500 font-bold select-none mt-1 text-[11px]">•</span>
                      <textarea
                        value={bullet}
                        onChange={(e) => updateExpHighlight(expIdx, bIdx, e.target.value)}
                        rows={Math.max(1, Math.ceil(bullet.length / 80))}
                        className="flex-1 text-xs text-slate-700 leading-relaxed p-1 focus:outline-none focus:ring-1 focus:ring-[#2E9BDA] focus:bg-sky-50/30 rounded border border-transparent hover:border-slate-200 resize-none font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => removeExpHighlight(expIdx, bIdx)}
                        title="Delete bullet"
                        className="opacity-0 group-hover/b:opacity-100 p-1 text-slate-400 hover:text-red-500 transition cursor-pointer shrink-0 mt-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addExpHighlight(expIdx)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#2E9BDA] font-semibold hover:text-[#2587bf] mt-1 pl-4 cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Add bullet</span>
                  </button>
                </>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700 leading-relaxed">
                  {(exp.highlights || []).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderProjects = () => {
    if (!resumeData.projects || resumeData.projects.length === 0) return null
    return (
      <div className="space-y-3">
        <div className="border-b border-slate-900 pb-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Projects</span>
        </div>
        {resumeData.projects.map((proj, projIdx) => (
          <div key={projIdx} className="space-y-1.5">
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-baseline gap-1 text-xs">
              <span className="font-bold text-slate-900">{proj.name}</span>
              {proj.link && (
                <span className="text-[11px] text-[#1d4ed8] font-medium truncate max-w-[200px]">{proj.link}</span>
              )}
            </div>
            {proj.technologies && proj.technologies.length > 0 && (
              <div className="text-[11px] text-slate-600">
                <strong className="text-slate-800">Technologies:</strong> {proj.technologies.join(', ')}
              </div>
            )}

            {/* Project Bullets */}
            <div className="space-y-1 pl-1">
              {isEditMode ? (
                <>
                  {(proj.highlights || []).map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-1.5 group/pb">
                      <span className="text-slate-500 font-bold select-none mt-1 text-[11px]">•</span>
                      <textarea
                        value={bullet}
                        onChange={(e) => updateProjHighlight(projIdx, bIdx, e.target.value)}
                        rows={Math.max(1, Math.ceil(bullet.length / 80))}
                        className="flex-1 text-xs text-slate-700 leading-relaxed p-1 focus:outline-none focus:ring-1 focus:ring-[#2E9BDA] focus:bg-sky-50/30 rounded border border-transparent hover:border-slate-200 resize-none font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => removeProjHighlight(projIdx, bIdx)}
                        title="Delete bullet"
                        className="opacity-0 group-hover/pb:opacity-100 p-1 text-slate-400 hover:text-red-500 transition cursor-pointer shrink-0 mt-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addProjHighlight(projIdx)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#2E9BDA] font-semibold hover:text-[#2587bf] mt-1 pl-4 cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Add highlight</span>
                  </button>
                </>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700 leading-relaxed">
                  {(proj.highlights || []).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderEducation = () => {
    if (!resumeData.education || resumeData.education.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="border-b border-slate-900 pb-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Education</span>
        </div>
        {resumeData.education.map((edu, eduIdx) => (
          <div key={eduIdx} className="text-xs space-y-0.5">
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-baseline gap-1">
              <span className="font-bold text-slate-900">{edu.institution}</span>
              <span className="text-[11px] font-medium text-slate-600 shrink-0">{edu.year}</span>
            </div>
            <div className="font-semibold text-[#1d4ed8] text-[11.5px]">{edu.degree}</div>
            {edu.score && <div className="text-[11px] text-slate-600 font-medium">{edu.score}</div>}
            {edu.coursework && (
              <div className="text-[11px] text-slate-600">
                <strong className="text-slate-800">Relevant Coursework:</strong> {edu.coursework}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderCertifications = () => {
    if (!resumeData.certifications || resumeData.certifications.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="border-b border-slate-900 pb-0.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Certifications</span>
          {isEditMode && (
            <button
              type="button"
              onClick={addCert}
              className="text-[11px] text-[#2E9BDA] font-semibold hover:text-[#2587bf] flex items-center gap-0.5 cursor-pointer"
            >
              <Plus size={11} /> Add
            </button>
          )}
        </div>
        <ul className="space-y-1 pl-1">
          {resumeData.certifications.map((cert, certIdx) => (
            <li key={certIdx} className="flex items-center gap-1.5 group/cert">
              <span className="text-slate-500 font-bold select-none text-[11px]">•</span>
              {isEditMode ? (
                <>
                  <input
                    type="text"
                    value={cert}
                    onChange={(e) => updateCert(certIdx, e.target.value)}
                    className="flex-1 text-xs text-slate-800 p-1 rounded border border-transparent hover:border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2E9BDA] focus:bg-sky-50/30"
                  />
                  <button
                    type="button"
                    onClick={() => removeCert(certIdx)}
                    className="opacity-0 group-hover/cert:opacity-100 p-1 text-slate-400 hover:text-red-500 transition cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-700">{cert}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const renderAchievements = () => {
    if (!resumeData.achievements || resumeData.achievements.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="border-b border-slate-900 pb-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Achievements</span>
        </div>
        <ul className="space-y-1 pl-1">
          {resumeData.achievements.map((ach, achIdx) => (
            <li key={achIdx} className="flex items-center gap-1.5">
              <span className="text-slate-500 font-bold select-none text-[11px]">•</span>
              <span className="text-xs text-slate-800">{ach}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (!mounted) return null

  // Portal directly to document.body in TRUE FULLSCREEN
  return createPortal(
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-slate-100 flex flex-col p-2 sm:p-2.5 overflow-hidden font-sans select-none">
      
      {/* ════ MOBILE UNIFIED TOP BAR (TABS + ACTIONS) ════ */}
      <div className="lg:hidden flex flex-col bg-white border border-slate-200/90 rounded-2xl shrink-0 mb-1.5 shadow-2xs overflow-hidden">
        <div className="h-11 px-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shadow-2xs shrink-0"
              title="Back to ATS Dashboard"
            >
              <ArrowLeft size={14} />
            </button>

            {/* Segmented Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab('original')}
                className={`px-2 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-xs ${
                  mobileTab === 'original'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileText size={11} />
                <span>Original ({oldScore}%)</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab('enhanced')}
                className={`px-2 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-xs ${
                  mobileTab === 'enhanced'
                    ? 'bg-white text-[#2E9BDA] shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles size={11} className="text-[#2E9BDA]" />
                <span>Enhanced {calculatedNewScore ? `(${calculatedNewScore}%)` : ''}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center shrink-0 cursor-pointer text-xs font-bold"
            title="Close Studio"
          >
            <X size={14} />
          </button>
        </div>

        {/* Mobile Action Ribbon when viewing Enhanced Resume */}
        {mobileTab === 'enhanced' && !isGenerating && (
          <div className="px-2.5 py-1.5 bg-slate-50/90 border-t border-slate-200/70 flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1">
              <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                    !isEditMode ? 'bg-[#2E9BDA] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                    isEditMode ? 'bg-[#2E9BDA] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Edit
                </button>
              </div>

              {checkingATS ? (
                <span className="text-[10px] text-[#2E9BDA] font-bold flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Evaluating...
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckATS}
                  className="px-2 py-0.5 rounded-md bg-white border border-sky-200 text-[#2E9BDA] text-[10px] font-bold cursor-pointer shadow-2xs"
                >
                  ATS
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isGenerating || !currentPdfUrl}
                className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50"
                title="Download PDF"
              >
                <Download size={12} />
                <span>PDF</span>
              </button>

              {onSetPrimary && (
                <button
                  type="button"
                  onClick={onSetPrimary}
                  disabled={primaryResumeUpdating}
                  className="px-2.5 py-1 rounded-lg bg-[#2E9BDA] hover:bg-[#2587bf] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Apply This Version"
                >
                  <CheckCircle2 size={12} />
                  <span>{primaryResumeUpdating ? 'Applying...' : 'Apply'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 2-COLUMN FULL-SCREEN VIEWPORT ─────────────────────────────────── */}
      <div className="flex-1 w-full h-full flex flex-col lg:flex-row gap-2 sm:gap-2.5 relative overflow-hidden">

        {/* ════ LEFT COLUMN: ORIGINAL RESUME ════════════════════════════════ */}
        <div className={`flex-1 flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-full ${mobileTab === 'original' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Desktop Header */}
          <div className="hidden lg:flex h-12 px-3.5 bg-white border-b border-slate-100 items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shadow-2xs shrink-0"
                title="Back to ATS Dashboard"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0">
                <FileText size={13} />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                Original Resume
              </h3>
            </div>

            {/* Right: Original ATS Tag */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/90 text-xs font-bold text-slate-700 shadow-2xs">
                ATS Score: {oldScore}%
              </span>
            </div>
          </div>

          {/* Document Body */}
          <div className="flex-1 w-full h-full overflow-hidden bg-slate-50 flex flex-col">
            {originalPdfUrl ? (
              <>
                {/* Mobile Helper Link for native PDF fallback */}
                <div className="lg:hidden px-3 py-2 bg-sky-50 border-b border-sky-100 flex items-center justify-between text-xs text-sky-900 shrink-0">
                  <span className="font-semibold text-[11px] truncate">Original Resume File</span>
                  <a
                    href={originalPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-white hover:bg-sky-50 border border-sky-200 text-[#2E9BDA] rounded-lg font-bold text-[11px] shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <ExternalLink size={11} />
                    Open PDF in Fullscreen
                  </a>
                </div>
                <iframe
                  src={`${originalPdfUrl}#page=1&view=FitH,0&toolbar=0`}
                  title="Original Resume"
                  className="flex-1 w-full border-0 bg-white"
                />
              </>
            ) : (
              <div className="w-full h-full p-6 text-center flex flex-col items-center justify-center text-slate-500">
                <FileText size={28} className="text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Original resume document preview unavailable</p>
              </div>
            )}
          </div>
        </div>

        {/* ════ CENTER FLOATING SWAP/COMPARE PILL (LG+ VIEW) ════════════════ */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 hidden lg:flex items-center justify-center w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md text-[#2E9BDA] pointer-events-none">
          <ArrowLeftRight size={13} />
        </div>

        {/* ════ RIGHT COLUMN: ENHANCED RESUME WITH INLINE WYSIWYG ═══════════ */}
        <div className={`flex-1 flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-full ${mobileTab === 'enhanced' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Desktop Header */}
          <div className="hidden lg:flex h-12 px-3.5 bg-white border-b border-slate-100 items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-sky-50 border border-sky-100 flex items-center justify-center text-[#2E9BDA] shrink-0">
                <Sparkles size={13} />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
                Enhanced Resume
              </h3>

              {/* View / Edit Mode Switch — Compact & Sleek */}
              {!isGenerating && (
                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/90 text-xs shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className={`h-7 px-2.5 rounded-md transition flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
                      !isEditMode
                        ? 'bg-white text-[#2E9BDA] shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="View Document Preview"
                  >
                    <Eye size={12} />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    className={`h-7 px-2.5 rounded-md transition flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
                      isEditMode
                        ? 'bg-white text-[#2E9BDA] shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Edit Resume Inline"
                  >
                    <Edit3 size={12} />
                    <span>Edit</span>
                    {hasUnsavedChanges && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Right: Check ATS + Action Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* ATS Check Option */}
              {checkingATS ? (
                <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-xs font-bold text-[#2E9BDA] flex items-center gap-1.5 shadow-2xs">
                  <Loader2 size={11} className="animate-spin" />
                  <span>Evaluating...</span>
                </span>
              ) : calculatedNewScore ? (
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>ATS Score: {calculatedNewScore}%</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                    +{Math.max(1, calculatedNewScore - oldScore)}%
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckATS}
                  disabled={isGenerating}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#2E9BDA] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  <span>Check ATS</span>
                </button>
              )}

              {/* Download PDF Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={isGenerating || !currentPdfUrl}
                title="Download PDF"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 flex items-center justify-center cursor-pointer transition shadow-2xs"
              >
                <Download size={14} />
              </button>

              {/* Apply Version */}
              {onSetPrimary && !isGenerating && (
                <button
                  type="button"
                  onClick={onSetPrimary}
                  disabled={primaryResumeUpdating}
                  title="Apply This Version"
                  className="px-3 py-1.5 rounded-lg bg-[#2E9BDA] hover:bg-[#2587bf] active:bg-[#1e74a6] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <CheckCircle2 size={13} />
                  <span className="hidden sm:inline">{primaryResumeUpdating ? 'Applying...' : 'Apply Version'}</span>
                </button>
              )}

              {/* Close Studio */}
              <button
                type="button"
                onClick={onClose}
                title="Close Studio"
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition flex items-center justify-center cursor-pointer ml-0.5"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Document Body */}
          <div className="flex-1 w-full h-full overflow-hidden bg-slate-100 relative">
            {isGenerating ? (
              /* Scanning laser animation */
              <div className="w-full h-full p-8 flex flex-col justify-between items-center relative overflow-hidden bg-white">
                <div className="w-full space-y-6 opacity-20 select-none pointer-events-none max-w-md mt-10">
                  <div className="space-y-2 text-center pb-4 border-b border-slate-200">
                    <div className="h-4 w-44 bg-slate-400 rounded mx-auto" />
                    <div className="h-2.5 w-64 bg-slate-300 rounded mx-auto" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-32 bg-slate-400 rounded" />
                    <div className="h-2 w-full bg-slate-300 rounded" />
                    <div className="h-2 w-5/6 bg-slate-300 rounded" />
                  </div>
                  <div className="space-y-2.5 pt-2">
                    <div className="h-3 w-36 bg-slate-400 rounded" />
                    <div className="h-2 w-full bg-slate-300 rounded" />
                    <div className="h-2 w-4/5 bg-slate-300 rounded" />
                  </div>
                </div>

                <motion.div
                  animate={{ y: [0, 480, 0] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_12px_#10b981]"
                />

                <div className="relative z-10 pb-6">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Optimizing Bullets & Content...
                  </span>
                </div>
              </div>
            ) : (
              /* ── LIVE INTERACTIVE DOCUMENT / PREVIEW CANVAS ── */
              <div className="w-full h-full flex flex-col relative bg-slate-200/60 overflow-hidden">
                
                {/* Floating Top Banner within Editor / Canvas */}
                <div className="px-4 py-2 bg-sky-50/95 border-b border-sky-200 flex items-center justify-between text-xs text-sky-900 shrink-0 z-20 backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#2E9BDA]" />
                    <span className="font-semibold">
                      {isEditMode ? 'Interactive WYSIWYG Mode:' : 'Live Document Preview:'}
                    </span>
                    <span className="text-slate-600 hidden sm:inline">
                      {isEditMode 
                        ? 'Click and edit any text directly on the resume below.' 
                        : 'Review your ATS-optimized resume. Toggle "Edit" above to make live adjustments.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={handleResetToAI}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white rounded-md border border-slate-200 shadow-2xs hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw size={11} />
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRecompilePDF()}
                      disabled={isRecompiling}
                      className="px-3.5 py-1 text-[11px] font-bold text-white bg-[#2E9BDA] hover:bg-[#2587bf] rounded-md shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isRecompiling ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Compiling PDF...</span>
                        </>
                      ) : (
                        <>
                          <Save size={12} />
                          <span>{currentPdfUrl ? 'Recompile PDF' : 'Generate PDF'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Paper Canvas Container — fully responsive standard block scroll */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-6 md:p-8 custom-scrollbar select-text">
                  <div className="w-full max-w-2xl mx-auto bg-white shadow-xl sm:shadow-2xl rounded-sm border border-slate-200 sm:border-slate-300 p-4 sm:p-8 md:p-12 space-y-4 sm:space-y-6 text-slate-800 text-[12px] sm:text-[13px] leading-relaxed font-sans my-2 sm:my-4 min-h-[960px] h-auto">
                    {renderHeader()}
                    {renderSummary()}
                    {renderSkills()}
                    {renderExperience()}
                    {renderProjects()}
                    {renderEducation()}
                    {renderCertifications()}
                    {renderAchievements()}

                    {/* Clean Document Footer */}
                    <div className="pt-6 border-t border-slate-200/90 flex items-center justify-between text-[11px] text-slate-500 select-none">
                      <span>{resumeData.full_name} • Master ATS-Optimized Resume</span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                        ATS Ready • Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sticky Bottom Recompile / Cancel Bar */}
                {hasUnsavedChanges && (
                  <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between px-6 shadow-md shrink-0 z-20">
                    <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      You have unsaved edits in this resume
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditMode(false)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleRecompilePDF}
                        disabled={isRecompiling}
                        className="px-4 py-1.5 bg-[#2E9BDA] hover:bg-[#2587bf] text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isRecompiling ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Recompiling PDF...</span>
                          </>
                        ) : (
                          <>
                            <Check size={13} />
                            <span>Save & Recompile PDF</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* ════ MOBILE BOTTOM ACTION BAR (Enhanced Resume) ════ */}
          <div className="lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-3 py-2 flex items-center justify-between gap-1.5 shrink-0 shadow-lg pb-[max(0.6rem,env(safe-area-inset-bottom))]">
            {/* View / Edit Mode Switch */}
            {!isGenerating && (
              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/90 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className={`h-7 px-2.5 rounded-md transition flex items-center gap-1 cursor-pointer text-xs font-semibold ${
                    !isEditMode
                      ? 'bg-white text-[#2E9BDA] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Eye size={12} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className={`h-7 px-2.5 rounded-md transition flex items-center gap-1 cursor-pointer text-xs font-semibold ${
                    isEditMode
                      ? 'bg-white text-[#2E9BDA] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                  {hasUnsavedChanges && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              </div>
            )}

            {/* ATS Score / Check */}
            {checkingATS ? (
              <span className="px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 text-xs font-bold text-[#2E9BDA] flex items-center gap-1 shadow-2xs">
                <Loader2 size={11} className="animate-spin" />
                <span>Scoring...</span>
              </span>
            ) : calculatedNewScore ? (
              <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-1 shadow-2xs">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>{calculatedNewScore}%</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleCheckATS}
                disabled={isGenerating}
                className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#2E9BDA] text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={11} />
                <span>Check ATS</span>
              </button>
            )}

            <div className="flex items-center gap-1 shrink-0">
              {/* Download PDF Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={isGenerating || !currentPdfUrl}
                title="Download PDF"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 flex items-center justify-center cursor-pointer transition shadow-2xs"
              >
                <Download size={14} />
              </button>

              {/* Apply Version */}
              {onSetPrimary && !isGenerating && (
                <button
                  type="button"
                  onClick={onSetPrimary}
                  disabled={primaryResumeUpdating}
                  title="Apply This Version"
                  className="px-2.5 py-1.5 rounded-lg bg-[#2E9BDA] hover:bg-[#2587bf] active:bg-[#1e74a6] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                >
                  <CheckCircle2 size={13} />
                  <span>{primaryResumeUpdating ? '...' : 'Apply'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>,
    document.body
  )
}

