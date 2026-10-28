/**
 * Results.jsx — CareerShala AI ATS Matcher & Readiness Portal
 * UX Update: Premium Step-by-Step View. Balanced cards, larger inputs, 
 * modern glassmorphism UI, and improved CTA design.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  Loader2,
  FileText,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Layers,
  CheckCircle2,
  Upload,
  Target,
  Zap,
  Briefcase,
  Code2
} from 'lucide-react'

import api, { uploadResume, getResumes, getResumeById, matchATS, extractJDText, generatePDF, setPrimaryResume, getLatestATSResult } from '../services/api'
import { PRESET_ROLES, extractJobDescriptionText, formatApiError } from '../components/ats/ATSHelpers'
import {
  InvalidDocumentError,
  ScanningDiagnosticsModal,
  ResumeSuperchargeScanningModal,
  EnhancementWizard,
  SetAsPrimaryPopup
} from '../components/ats/ATSModals'
import UnifiedATSReadinessCard from '../components/ats/UnifiedATSReadinessCard'
import EnhancedResumeStudioModal from '../components/ats/EnhancedResumeStudioModal'

const SESSION_KEY = 'careershala_ats_session'

const getSavedSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export default function Results() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()

  const saved = getSavedSession()

  const [resumeFile, setResumeFile] = useState(() => saved?.resumeFile || null)
  const [resumeId, setResumeId] = useState(() => saved?.resumeId || '')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(() => !!saved?.uploadDone || !!saved?.resumeId)
  const [uploadStage, setUploadStage] = useState('Uploading Document...')

  const [jdMode, setJdMode] = useState('paste')
  const [jdText, setJdText] = useState(() => saved?.jdText || '')
  const [jdFile, setJdFile] = useState(null)
  const [jobTitle, setJobTitle] = useState(() => saved?.jobTitle || '')
  const [requiredSkills, setRequiredSkills] = useState(() => saved?.requiredSkills || '')

  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(() => saved?.result || null)
  const [enhancing, setEnhancing] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showSuperchargeScanner, setShowSuperchargeScanner] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [invalidDocument, setInvalidDocument] = useState(false)
  const [invalidDocData, setInvalidDocData] = useState(null)
  const [showPrimaryPopup, setShowPrimaryPopup] = useState(false)
  const [primaryResumeData, setPrimaryResumeData] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [showEnhancedStudio, setShowEnhancedStudio] = useState(() => !!saved?.showEnhancedStudio)
  const [enhancedStudioData, setEnhancedStudioData] = useState(() => saved?.enhancedStudioData || null)
  const [primaryUpdating, setPrimaryUpdating] = useState(false)

  const resultRef = useRef(null)

  // Sync active scan state to sessionStorage so page refresh NEVER loses progress
  useEffect(() => {
    try {
      if (result || jdText || showEnhancedStudio || enhancedStudioData || resumeId) {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            resumeId,
            resumeFile: resumeFile ? { name: resumeFile.name, file_url: resumeFile.file_url } : null,
            uploadDone,
            jdText,
            jobTitle,
            requiredSkills,
            result,
            showEnhancedStudio,
            enhancedStudioData,
          })
        )
      }
    } catch (e) {
      console.warn('Failed to sync to sessionStorage', e)
    }
  }, [resumeId, resumeFile, uploadDone, jdText, jobTitle, requiredSkills, result, showEnhancedStudio, enhancedStudioData])

  useEffect(() => {
    let isMounted = true

    const resetState = () => {
      try {
        sessionStorage.removeItem(SESSION_KEY)
      } catch (e) {}
      setResumeId('')
      setResumeFile(null)
      setUploadDone(false)
      setUploadProgress(0)
      setResult(null)
      setAnalyzing(false)
      setPrimaryResumeData(null)
      setShowPrimaryPopup(false)
      setInvalidDocument(false)
      setInvalidDocData(null)
      setShowEnhancedStudio(false)
      setEnhancedStudioData(null)
    }

    if (!user) {
      resetState()
      return () => { isMounted = false }
    }

    const initData = async () => {
      // 1. If result was already restored from sessionStorage, keep it intact
      const cached = getSavedSession()
      if (cached?.result) {
        return
      }

      // 2. Auto-restore user's most recent ATS scan & JD from database on first load/refresh
      try {
        const { data: latestScan } = await getLatestATSResult()
        if (latestScan?.has_result && isMounted) {
          setResult(latestScan.result)
          if (latestScan.job_description) setJdText(latestScan.job_description)
          if (latestScan.job_title) setJobTitle(latestScan.job_title)
          if (latestScan.required_skills?.length > 0) setRequiredSkills(latestScan.required_skills.join(', '))
          if (latestScan.resume) {
            setResumeId(latestScan.resume.id)
            setResumeFile({ name: latestScan.resume.file_name, file_url: latestScan.resume.file_url })
            setUploadDone(true)
          }
          return
        }
      } catch (err) {
        // Fallback to basic resume fetch if no previous ATS scan found
      }

      // 3. Fallback: fetch parsed resume if user hasn't scanned yet
      try {
        const { data: list } = await getResumes({ page: 1, page_size: 5 })
        const resumes = list?.resumes || []
        const parsed = resumes.find(r => r.status === 'parsed')
        if (parsed && isMounted) {
          setResumeId(parsed.id || parsed._id)
          setResumeFile({ name: parsed.file_name || parsed.title || 'Profile Resume.pdf', file_url: parsed.file_url })
          setUploadDone(true)
        } else if (isMounted) {
          setResumeId('')
          setResumeFile(null)
          setUploadDone(false)
        }
      } catch (err) { }
    }

    initData()

    const handleLogout = () => {
      if (isMounted) resetState()
    }
    window.addEventListener('careershala:logout', handleLogout)

    return () => {
      isMounted = false
      window.removeEventListener('careershala:logout', handleLogout)
    }
  }, [user])

  const applyPresetRole = (role) => {
    setSelectedPreset(role.title)
    setJobTitle(role.title)
    setRequiredSkills(role.skills)
    setJdText(role.description)
    setJdMode('paste')
    setJdFile(null)
    toast.success(`Loaded "${role.title}" role preset!`, { icon: role.icon })
  }

  const onResumeDrop = useCallback(async (accepted) => {
    const file = accepted[0]
    if (!file) return

    setResumeFile(file)
    setUploading(true)
    setUploadProgress(15)
    setUploadStage('Uploading document...')

    try {
      const uploadRes = await uploadResume(file, pct => {
        const adjusted = Math.min(Math.round(pct * 0.6), 60)
        setUploadProgress(adjusted)
        if (adjusted >= 40) setUploadStage('Parsing layout & section hierarchy...')
      })
      const targetResumeId = uploadRes?.data?.resume_id || uploadRes?.data?.id
      if (targetResumeId) {
        setResumeId(targetResumeId)
      }

      setUploadStage('Extracting technical competencies & skills...')
      setUploadProgress(75)

      let parsed = null
      // Adaptive fast polling: checks at 350ms, 700ms, 1200ms...
      for (let i = 0; i < 30; i++) {
        const pollDelay = i < 6 ? 350 : i < 12 ? 700 : 1200
        await new Promise(r => setTimeout(r, pollDelay))
        try {
          if (targetResumeId) {
            const { data: item } = await getResumeById(targetResumeId)
            if (item && item.status === 'parsed') {
              parsed = item
              break
            }
            if (item && item.status === 'failed') {
              const reason = item.error_message || item.parse_error || 'Resume parsing failed on the server.'
              toast.error(`Parsing Failed: ${reason}`)
              setResumeFile(null)
              return
            }
          } else {
            const { data: list } = await getResumes({ page: 1, page_size: 5 })
            const latest = list?.resumes?.[0]
            if (latest && latest.status === 'parsed') {
              parsed = latest
              break
            }
            if (latest && latest.status === 'failed') {
              const reason = latest.error_message || latest.parse_error || 'Resume parsing failed on the server.'
              toast.error(`Parsing Failed: ${reason}`)
              setResumeFile(null)
              return
            }
          }
        } catch (fetchErr) {
          // keep polling
        }
      }

      if (parsed) {
        setUploadProgress(100)
        setUploadStage('Ready!')
        setResumeId(parsed.id || parsed._id)
        setUploadDone(true)
        toast.success('Resume parsed & ready for ATS evaluation!')
      } else {
        toast('Resume is processing in the background. You can evaluate once ready.', { icon: '⏳' })
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps: getResumeRootProps, getInputProps: getResumeInputProps, isDragActive: resumeDrag } = useDropzone({
    onDrop: onResumeDrop,
    multiple: false,
    disabled: uploading,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024,
  })

  const { getRootProps: getJDRootProps, getInputProps: getJDInputProps, isDragActive: jdDrag } = useDropzone({
    onDrop: async (accepted) => {
      const file = accepted[0]
      if (!file) return
      setJdFile(file)
      setJdText('')

      try {
        toast.loading(`Extracting text from ${file.name}...`, { id: 'jd-extract' })
        const extracted = await extractJobDescriptionText(file, extractJDText)
        setJdText(extracted)
        toast.success(`Extracted clean text from ${file.name}`, { id: 'jd-extract' })
      } catch (err) {
        toast.error(err.response?.data?.detail || err.message || 'Could not extract text from the file', { id: 'jd-extract' })
      }
    },
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  })

  const handleAnalyze = async () => {
    if (!resumeId) {
      toast.error('Please upload or select a resume first')
      return
    }
    const jd = jdText.trim()
    if (jd.length < 50 && !jdFile) {
      toast.error('Please provide a complete job description (at least 50 characters)')
      return
    }

    setAnalyzing(true)
    setResult(null)
    setInvalidDocument(false)
    setInvalidDocData(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    try {
      let payload
      if (jdFile) {
        payload = new FormData()
        payload.append('resume_id', resumeId)
        payload.append('job_title', jobTitle || 'Target Role')
        payload.append('job_description', jd || `File: ${jdFile.name}`)
        payload.append('jd_file', jdFile)
        payload.append('save_result', 'true')
        requiredSkills.split(',').forEach(s => {
          if (s.trim()) payload.append('required_skills', s.trim())
        })
      } else {
        payload = {
          resume_id: resumeId,
          job_title: jobTitle || 'Target Role',
          job_description: jd,
          required_skills: requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
          save_result: true,
        }
      }

      let res
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          res = await matchATS(payload)
          break
        } catch (apiErr) {
          if (apiErr.response?.status === 409 && attempt < 3) {
            toast('Resume is still vectorizing. Retrying in a moment...', { icon: '⏳' })
            await new Promise(r => setTimeout(r, 2500))
            continue
          }
          throw apiErr
        }
      }
      const data = res.data

      const confidence = data.parsing_confidence ?? 1
      const noSkillSignal = (data.matched_skills?.length || 0) === 0 && (data.missing_skills?.length || 0) === 0
      const isCompletelyUnreadable = noSkillSignal && confidence <= 0.35
      if (isCompletelyUnreadable) {
        setInvalidDocData(data)
        setInvalidDocument(true)
        setAnalyzing(false)
        return
      }

      setResult(data)
      if (data.is_knockout) toast.error('Hard knockout criteria detected.')
      else toast.success('ATS Readiness calculated!')

      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const msg = formatApiError(err) || 'Analysis failed'
      toast.error(msg)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleNewScan = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch (e) {}
    setResult(null)
    setAnalyzing(false)
    setInvalidDocument(false)
    setInvalidDocData(null)
    setShowWizard(false)
    setShowSuperchargeScanner(false)
    setShowEnhancedStudio(false)
    setEnhancedStudioData(null)
    setSelectedPreset(null)
    setRequiredSkills('')
    setJobTitle('')
    setJdText('')
    setJdFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEnhance = async (userVerified = null) => {
    if (!resumeId) { toast.error('Resume required'); return }
    const hasVerifiedData = !!(userVerified && (userVerified.links || userVerified.verified_skills?.length > 0 || userVerified.impact_metrics?.length > 0))
    setEnhancing(true)

    // Pre-populate candidate's original bullets so Studio opens immediately without blank lag
    const currentScoreVal = result?.strict_ats_score ?? result?.strict_score ?? result?.match_score ?? 76
    const initialBullets = (result?.extracted_data?.experience || []).flatMap(exp =>
      (exp.highlights || exp.bullets || []).map(b => ({
        section: exp.company || exp.title || 'Work Experience',
        original: b,
        enhanced: ''
      }))
    ).slice(0, 5)

    const fallbackBullets = [
      { section: 'Engineering Experience', original: 'Developed web application features and handled database queries.', enhanced: '' },
      { section: 'System Architecture', original: 'Collaborated with team members on code reviews, bug fixes, and performance.', enhanced: '' },
      { section: 'Projects', original: 'Built application components according to project requirements.', enhanced: '' }
    ]

    setEnhancedStudioData({
      bullet_diffs: initialBullets.length > 0 ? initialBullets : fallbackBullets,
      original_summary: result?.extracted_data?.summary || 'Experienced professional with background in software development and delivery.',
      score_lift: {
        before: currentScoreVal,
        after: Math.min(96, Math.max(88, currentScoreVal + 18)),
        jump: `+${Math.min(96, Math.max(88, currentScoreVal + 18)) - currentScoreVal}%`
      }
    })
    setShowEnhancedStudio(true)

    try {
      const { data } = await api.post('/enhance/enhance-and-download', {
        resume_id: resumeId,
        job_description: jdText,
        required_skills: requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        strict_missing_keywords: result?.strict_missing_keywords || [],
        current_score: currentScoreVal,
        ...(hasVerifiedData ? { user_verified: userVerified } : {}),
        save_enhanced: true
      })

      if (data.status === "SUCCESS") {
        setEnhancedStudioData(data)
        toast.success('Resume Enhanced! 🚀', { icon: '✨' })
        if (data.pdf_url) {
          setPrimaryResumeData({ resume_url: data.pdf_url, resume_name: resumeFile?.name || 'Enhanced Resume.pdf' })
        }
      } else {
        toast.error(data.message || 'Enhancement failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Enhancement failed')
    } finally {
      setEnhancing(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPDF(true)
      const rid = result?.resume_id || resumeId
      if (!rid) return toast.error('No resume found')
      const { data } = await generatePDF({ resume_id: rid, template: "modern" })
      window.open(data.pdf_url + "?fl_attachment=true", "_blank")
      toast.success("PDF opened successfully")
    } catch (err) {
      toast.error(formatApiError(err) || "PDF generation failed")
    } finally {
      setGeneratingPDF(false)
    }
  }

  const isJdReady = jdText.trim().length >= 50 || !!jdFile

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24 sm:pb-20 font-sans text-slate-900 antialiased relative px-3 sm:px-6 lg:px-8">
      <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gradient-to-b from-[#2E9BDA]/10 to-transparent blur-3xl rounded-full -z-10 pointer-events-none" />
      <div className="absolute -top-32 left-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-100/10 to-transparent blur-3xl rounded-full -z-10 pointer-events-none" />

      <div className="w-full relative z-10 space-y-4 sm:space-y-6">
        <AnimatePresence mode="wait">

          {/* ── VIEW 1: SCANNER INPUTS ── */}
          {!result && !invalidDocument && (
            <motion.div
              key="inputs-view"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
            >
              {/* Hero Section */}
              <div className="text-center max-w-3xl mx-auto mb-5 sm:mb-8 mt-1 sm:mt-3 px-1">
                <h1 className="text-xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-1.5 sm:mb-3 leading-tight">
                  Optimize Your Resume for <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] to-indigo-600">Corporate Screening</span>
                </h1>
                <p className="text-slate-500 text-xs sm:text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed line-clamp-2 sm:line-clamp-none">
                  Evaluate your profile against target roles using semantic AI and strict enterprise boolean filters.
                </p>
              </div>

              {/* Dual Workstation Cards (Balanced Heights) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch min-h-0 lg:min-h-[480px]">

                {/* 1. Resume Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-[2rem] p-4 sm:p-7 md:p-8 border border-slate-200/80 shadow-lg shadow-slate-200/40 flex flex-col h-full relative overflow-hidden group hover:border-slate-300 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-bl-full -z-10" />

                  <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xs text-slate-700 flex items-center justify-center shrink-0">
                      <FileText size={18} className="sm:w-5 sm:h-5 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight">1. Candidate Resume</h3>
                      <p className="text-[11px] sm:text-sm text-slate-500 font-medium">Upload PDF or DOCX (Max 10MB)</p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    {uploadDone ? (
                      <div className="flex-1 w-full bg-gradient-to-b from-emerald-50/50 to-white border-2 border-emerald-100 border-dashed rounded-xl sm:rounded-[1.5rem] p-4 sm:p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5 sm:mb-4 shadow-2xs">
                          <CheckCircle2 size={24} className="sm:w-9 sm:h-9" />
                        </div>
                        <h4 className="text-sm sm:text-lg font-bold text-slate-900 truncate w-full max-w-xs">{resumeFile?.name || 'Resume Ready'}</h4>
                        <p className="text-xs sm:text-sm text-emerald-600 font-bold mt-0.5 sm:mt-1">Successfully Parsed & Ready</p>
                        <button
                          onClick={() => { setUploadDone(false); setResumeFile(null); setResumeId(''); }}
                          className="mt-3.5 sm:mt-6 px-4 py-2 sm:px-6 sm:py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer"
                        >
                          Upload Different File
                        </button>
                      </div>
                    ) : (
                      <div 
                        {...getResumeRootProps()} 
                        className={`flex-1 w-full border-2 border-dashed rounded-xl sm:rounded-[1.5rem] flex flex-col items-center justify-center p-5 sm:p-8 text-center cursor-pointer transition-all relative overflow-hidden ${
                          uploading
                            ? 'border-emerald-400 bg-emerald-50/20 shadow-inner'
                            : resumeDrag 
                              ? 'border-[#2E9BDA] bg-[#2E9BDA]/5' 
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input {...getResumeInputProps()} />
                        {uploading ? (
                          <>
                            {/* Moving Green Laser Scan Line across the entire parent box */}
                            <motion.div
                              animate={{ top: ['2%', '96%', '2%'] }}
                              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_18px_#10b981] pointer-events-none z-10"
                            >
                              <div className="w-full h-8 bg-gradient-to-b from-emerald-500/15 to-transparent pointer-events-none" />
                            </motion.div>

                            {/* Clean, Simple, Attractive Center Content without any inner box */}
                            <div className="relative z-20 flex flex-col items-center">
                              <FileText size={38} className="text-emerald-600 mb-2.5 animate-pulse drop-shadow-[0_2px_8px_rgba(16,185,129,0.25)]" />

                              <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1 truncate max-w-xs px-2">
                                {resumeFile?.name || 'Parsing Resume...'}
                              </h4>

                              <div className="flex items-center gap-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                <span className="text-xs sm:text-sm font-semibold text-emerald-700">
                                  {uploadStage || 'Extracting Text & Skills...'}
                                </span>
                                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200">
                                  {uploadProgress}%
                                </span>
                              </div>

                              {/* Minimal Clean Green Progress Bar */}
                              <div className="w-52 sm:w-72 bg-slate-200/80 h-2 rounded-full overflow-hidden p-0.5 shadow-inner">
                                <motion.div
                                  className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                                  style={{ width: `${uploadProgress}%` }}
                                  transition={{ duration: 0.2 }}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white shadow-2xs border border-slate-100 flex items-center justify-center mb-2.5 sm:mb-4">
                              <Upload size={20} className="sm:w-6 sm:h-6 text-[#2E9BDA]" />
                            </div>
                            <p className="text-xs sm:text-base font-bold text-slate-800">
                              <span className="sm:hidden">Tap to upload your resume</span>
                              <span className="hidden sm:inline">Drag & drop your resume here</span>
                            </p>
                            <p className="text-[11px] sm:text-sm text-slate-500 font-medium mt-0.5 sm:mt-1">or click to browse from your device</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Job Description Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-[2rem] p-4 sm:p-7 md:p-8 border border-slate-200/80 shadow-lg shadow-slate-200/40 flex flex-col h-full relative overflow-hidden group hover:border-slate-300 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#2E9BDA]/5 rounded-bl-full -z-10" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xs text-slate-700 flex items-center justify-center shrink-0">
                        <Layers size={18} className="sm:w-5 sm:h-5 text-slate-700" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight">2. Job Description</h3>
                        <p className="text-[11px] sm:text-sm text-slate-500 font-medium">Paste JD or upload requirements</p>
                      </div>
                    </div>
                    <div className="flex self-stretch sm:self-auto bg-slate-100/80 p-0.5 sm:p-1 rounded-xl text-[11px] sm:text-xs font-bold border border-slate-200/80 shrink-0">
                      <button onClick={() => setJdMode('paste')} className={`flex-1 sm:flex-initial text-center px-3 sm:px-4 py-1.5 sm:py-1.5 rounded-lg transition-all cursor-pointer ${jdMode === 'paste' ? 'bg-white shadow-2xs text-slate-900 font-extrabold' : 'text-slate-500 hover:text-slate-700'}`}>Paste Text</button>
                      <button onClick={() => setJdMode('upload')} className={`flex-1 sm:flex-initial text-center px-3 sm:px-4 py-1.5 sm:py-1.5 rounded-lg transition-all cursor-pointer ${jdMode === 'upload' ? 'bg-white shadow-2xs text-slate-900 font-extrabold' : 'text-slate-500 hover:text-slate-700'}`}>Upload File</button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 sm:gap-4">
                    {jdMode === 'upload' ? (
                      <div {...getJDRootProps()} className={`flex-1 w-full border-2 border-dashed rounded-xl sm:rounded-[1.5rem] flex flex-col items-center justify-center p-5 sm:p-8 text-center cursor-pointer transition-all min-h-[160px] sm:min-h-[220px] ${jdDrag ? 'border-[#2E9BDA] bg-[#2E9BDA]/5' : jdFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'}`}>
                        <input {...getJDInputProps()} />
                        {jdFile ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 size={26} className="text-emerald-500 mb-2 sm:mb-3" />
                            <p className="text-sm sm:text-base font-bold text-emerald-900 truncate max-w-xs">{jdFile.name}</p>
                            <p className="text-xs sm:text-sm text-emerald-600 font-medium mt-0.5 sm:mt-1">{(jdFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white shadow-2xs border border-slate-100 flex items-center justify-center mb-2.5 sm:mb-4">
                              <FileText size={22} className="sm:w-7 sm:h-7 text-slate-400" />
                            </div>
                            <p className="text-xs sm:text-base font-bold text-slate-800">Drop JD file here</p>
                            <p className="text-[11px] sm:text-sm text-slate-500 font-medium mt-0.5 sm:mt-1">PDF, DOCX, or TXT</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="relative flex-1 flex flex-col">
                        {/* Compact Sample JD Pills (Takes only 28px height, easy 1-tap on mobile) */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 pt-0.5 -mt-1">
                          {PRESET_ROLES.map((role, idx) => {
                            const isSelected = selectedPreset === role.title;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => applyPresetRole(role)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                <span>{role.icon}</span> {role.title.replace(' Engineer', '').replace(' Dev', '')}
                              </button>
                            );
                          })}
                        </div>

                        <textarea
                          value={jdText}
                          onChange={e => setJdText(e.target.value)}
                          placeholder="Paste the full job description here (requirements, responsibilities, or role details)..."
                          className="flex-1 w-full min-h-[160px] sm:min-h-[220px] p-3 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-[1.5rem] text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/50 focus:border-[#2E9BDA] focus:bg-white resize-none transition-all shadow-2xs"
                        />
                        <div className="absolute bottom-2.5 right-2.5 sm:bottom-4 sm:right-4">
                          <span className={`text-[9px] sm:text-[10px] font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-2xs border ${jdText.length >= 50 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                            {jdText.length >= 50 ? 'Ready to analyze' : 'Min 50 chars'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Master Scan CTA Button */}
              <div className="flex justify-center mt-5 sm:mt-10 mb-4 sm:mb-0">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAnalyze}
                  disabled={analyzing || !uploadDone || !isJdReady}
                  className="group w-full max-w-xl py-3.5 sm:py-4 px-4 rounded-xl sm:rounded-[1.25rem] font-black text-xs sm:text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 shadow-lg shadow-[#2E9BDA]/25 flex items-center justify-center gap-2 sm:gap-3 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-[#2E9BDA]/35 active:scale-98"
                >
                  {analyzing ? (
                    <><Loader2 size={18} className="animate-spin shrink-0" /> Evaluating Profile...</>
                  ) : (
                    <>
                      <Zap size={18} className="text-white shrink-0" />
                      <span className="truncate">Run Dual-Engine ATS Analysis</span>
                      <ArrowRight size={18} className="shrink-0 group-hover:translate-x-1.5 transition-transform" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── VIEW 2: RESULTS DASHBOARD ── */}
          {result && !analyzing && !invalidDocument && (
            <motion.div
              key="results-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15, transition: { duration: 0.15 } }}
              className="space-y-4 sm:space-y-5"
            >
              <UnifiedATSReadinessCard
                result={result}
                onEnhance={() => setShowSuperchargeScanner(true)}
                onReset={handleNewScan}
                enhancing={enhancing}
              />
            </motion.div>
          )}

        </AnimatePresence>

        {/* ── OVERLAYS (Modals) ── */}
        <AnimatePresence>
          {analyzing && <ScanningDiagnosticsModal jobTitle={jobTitle} />}
          {showSuperchargeScanner && (
            <ResumeSuperchargeScanningModal
              onComplete={() => {
                setShowSuperchargeScanner(false)
                setShowWizard(true)
              }}
              onClose={() => setShowSuperchargeScanner(false)}
            />
          )}
          {invalidDocument && !analyzing && (
            <div ref={resultRef}>
              <InvalidDocumentError confidence={invalidDocData?.parsing_confidence} warnings={invalidDocData?.parsing_warnings || []} onReset={handleNewScan} />
            </div>
          )}
          {showWizard && result && (
            <EnhancementWizard result={result} onClose={() => setShowWizard(false)} onSubmit={(data) => { setShowWizard(false); handleEnhance(data); }} onSkip={() => { setShowWizard(false); handleEnhance(null); }} />
          )}
          {showEnhancedStudio && enhancedStudioData && (
            <EnhancedResumeStudioModal
              data={enhancedStudioData}
              result={result}
              resumeFile={resumeFile}
              isGenerating={enhancing}
              onClose={() => setShowEnhancedStudio(false)}
              primaryResumeUpdating={primaryUpdating}
              onSetPrimary={async () => {
                if (!primaryResumeData) return
                setPrimaryUpdating(true)
                try {
                  await setPrimaryResume({ resume_url: primaryResumeData.resume_url, resume_name: primaryResumeData.resume_name || 'Enhanced Resume.pdf' })
                  await refreshUser()
                  toast.success('Saved as Primary Profile Resume! ⭐')
                } catch (err) {
                  toast.error('Failed to update primary resume')
                } finally {
                  setPrimaryUpdating(false)
                }
              }}
            />
          )}
          {showPrimaryPopup && primaryResumeData && !showEnhancedStudio && (
            <SetAsPrimaryPopup
              resumeName={primaryResumeData.resume_name}
              onNotNow={() => setShowPrimaryPopup(false)}
              onYesUpdate={async () => {
                if (!primaryResumeData) return
                try {
                  await setPrimaryResume({ resume_url: primaryResumeData.resume_url, resume_name: primaryResumeData.resume_name || 'Enhanced Resume.pdf' })
                  await refreshUser()
                  toast.success('Primary resume updated successfully')
                  setShowPrimaryPopup(false)
                  setPrimaryResumeData(null)
                } catch (err) {
                  toast.error('Failed to update primary resume')
                }
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}