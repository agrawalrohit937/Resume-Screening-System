/**
 * Results.jsx — CareerPilot / CareerShala AI ATS Matcher & Readiness Portal
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

import api, { uploadResume, getResumes, getResumeById, matchATS, generatePDF, setPrimaryResume } from '../services/api'
import { PRESET_ROLES, extractJobDescriptionText, formatApiError } from '../components/ats/ATSHelpers'
import {
  InvalidDocumentError,
  ScanningDiagnosticsModal,
  EnhancementWizard,
  SetAsPrimaryPopup
} from '../components/ats/ATSModals'
import UnifiedATSReadinessCard from '../components/ats/UnifiedATSReadinessCard'

export default function Results() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()

  const [resumeFile, setResumeFile] = useState(null)
  const [resumeId, setResumeId] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)

  const [jdMode, setJdMode] = useState('paste')
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [requiredSkills, setRequiredSkills] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [enhancing, setEnhancing] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [invalidDocument, setInvalidDocument] = useState(false)
  const [invalidDocData, setInvalidDocData] = useState(null)
  const [showPrimaryPopup, setShowPrimaryPopup] = useState(false)
  const [primaryResumeData, setPrimaryResumeData] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState(null)

  const resultRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    const resetState = () => {
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
    }

    if (!user) {
      resetState()
      return () => { isMounted = false }
    }

    const fetchExistingResume = async () => {
      try {
        const { data: list } = await getResumes({ page: 1, page_size: 5 })
        const resumes = list?.resumes || []
        const parsed = resumes.find(r => r.status === 'parsed')
        if (parsed && isMounted) {
          setResumeId(parsed.id || parsed._id)
          setResumeFile({ name: parsed.file_name || parsed.title || 'Profile Resume.pdf' })
          setUploadDone(true)
        } else if (isMounted) {
          setResumeId('')
          setResumeFile(null)
          setUploadDone(false)
        }
      } catch (err) {}
    }

    fetchExistingResume()

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
    setUploadProgress(0)

    try {
      const uploadRes = await uploadResume(file, pct => setUploadProgress(pct))
      const targetResumeId = uploadRes?.data?.resume_id || uploadRes?.data?.id
      if (targetResumeId) {
        setResumeId(targetResumeId)
      }

      let parsed = null
      for (let i = 0; i < 35; i++) {
        await new Promise(r => setTimeout(r, 2000))
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
        const extracted = await extractJobDescriptionText(file)
        setJdText(extracted)
        toast.success(`Extracted text from ${file.name}`)
      } catch (err) {
        toast.error(err.message || 'Could not extract text from the file')
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
      if (confidence <= 0.35 || noSkillSignal) {
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
    setResult(null)
    setAnalyzing(false)
    setInvalidDocument(false)
    setInvalidDocData(null)
    setShowWizard(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEnhance = async (userVerified = null) => {
    if (!resumeId) { toast.error('Resume required'); return }
    const hasVerifiedData = !!(userVerified && (userVerified.links || userVerified.verified_skills?.length > 0 || userVerified.impact_metrics?.length > 0))
    setEnhancing(true)
    toast.loading("Crafting your enhanced ATS resume & PDF... ✨")

    try {
      const { data } = await api.post('/enhance/enhance-and-download', {
        resume_id: resumeId,
        job_description: jdText,
        required_skills: requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        strict_missing_keywords: result?.strict_missing_keywords || [],
        ...(hasVerifiedData ? { user_verified: userVerified } : {}),
        save_enhanced: true
      })

      if (data.status === "SUCCESS" && data.pdf_url) {
        const pdfUrl = data.pdf_url.startsWith('/api')
          ? (import.meta.env.VITE_API_URL?.replace('/api/v1', '') || window.location.origin) + data.pdf_url
          : data.pdf_url
        window.open(pdfUrl + "?fl_attachment=true", "_blank")
        toast.dismiss()
        toast.success('Resume Enhanced & PDF Ready! 🚀')
        setPrimaryResumeData({ resume_url: data.pdf_url, resume_name: resumeFile?.name || 'Enhanced Resume.pdf' })
        setShowPrimaryPopup(true)
      } else {
        toast.dismiss()
        toast.error(data.message || 'Enhancement failed')
      }
    } catch (err) {
      toast.dismiss()
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
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 font-sans text-slate-900 antialiased relative">
      <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gradient-to-b from-[#2E9BDA]/10 to-transparent blur-3xl rounded-full -z-10 pointer-events-none" />
      <div className="absolute -top-32 left-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-100/10 to-transparent blur-3xl rounded-full -z-10 pointer-events-none" />

      <div className="w-full relative z-10 space-y-6">
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
              <div className="text-center max-w-3xl mx-auto mb-12 mt-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-bold mb-5 shadow-sm">
                  <Target size={14} className="text-[#2E9BDA]" />
                  Enterprise ATS Readiness Engine
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
                  Optimize Your Resume for <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#2E9BDA] to-indigo-600">Corporate Screening</span>
                </h1>
                <p className="text-slate-500 text-base sm:text-lg font-medium max-w-2xl mx-auto">
                  Evaluate your profile against target roles using semantic AI and strict enterprise boolean filters.
                </p>

                {/* Quick Presets */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {PRESET_ROLES.map((role, idx) => {
                    const isSelected = selectedPreset === role.title
                    return (
                      <motion.button
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        key={idx}
                        onClick={() => applyPresetRole(role)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                          isSelected 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        <span className="text-base">{role.icon}</span> {role.title}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Dual Workstation Cards (Balanced Heights) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch min-h-[480px]">
                
                {/* 1. Resume Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-200/80 shadow-xl shadow-slate-200/40 flex flex-col h-full relative overflow-hidden group hover:border-slate-300 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-bl-full -z-10" />
                  
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-700 flex items-center justify-center shrink-0">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">1. Candidate Resume</h3>
                      <p className="text-sm text-slate-500 font-medium">Upload PDF or DOCX (Max 10MB)</p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    {uploadDone ? (
                      <div className="flex-1 w-full bg-gradient-to-b from-emerald-50/50 to-white border-2 border-emerald-100 border-dashed rounded-[1.5rem] p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
                          <CheckCircle2 size={40} />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 truncate w-full max-w-xs">{resumeFile?.name || 'Resume Ready'}</h4>
                        <p className="text-sm text-emerald-600 font-bold mt-1">Successfully Parsed & Ready</p>
                        <button 
                          onClick={() => { setUploadDone(false); setResumeFile(null); setResumeId(''); }} 
                          className="mt-6 px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer"
                        >
                          Upload Different File
                        </button>
                      </div>
                    ) : (
                      <div {...getResumeRootProps()} className={`flex-1 w-full border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all ${resumeDrag ? 'border-[#2E9BDA] bg-[#2E9BDA]/5' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'}`}>
                        <input {...getResumeInputProps()} />
                        {uploading ? (
                          <div className="w-full max-w-[240px]">
                            <div className="flex items-center justify-center mb-3">
                              <Loader2 size={24} className="animate-spin text-[#2E9BDA] mr-3" />
                              <span className="text-sm font-bold text-slate-700">Uploading Document...</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-[#2E9BDA] h-full transition-all duration-300" style={{ width: `${uploadProgress || 50}%` }} />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                              <Upload size={28} className="text-[#2E9BDA]" />
                            </div>
                            <p className="text-base font-bold text-slate-800">Drag & drop your resume here</p>
                            <p className="text-sm text-slate-500 font-medium mt-1">or click to browse from your computer</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Job Description Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-200/80 shadow-xl shadow-slate-200/40 flex flex-col h-full relative overflow-hidden group hover:border-slate-300 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#2E9BDA]/5 rounded-bl-full -z-10" />

                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-700 flex items-center justify-center shrink-0">
                        <Layers size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">2. Target Role</h3>
                        <p className="text-sm text-slate-500 font-medium">Define the JD requirements</p>
                      </div>
                    </div>
                    <div className="flex bg-slate-100/80 p-1.5 rounded-xl text-xs font-bold border border-slate-200/80">
                      <button onClick={() => setJdMode('paste')} className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${jdMode === 'paste' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Paste Text</button>
                      <button onClick={() => setJdMode('upload')} className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${jdMode === 'upload' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Upload File</button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <Briefcase size={16} className="text-slate-400" />
                        </div>
                        <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Target Role (e.g. Backend Dev)" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/50 focus:border-[#2E9BDA] focus:bg-white transition-all shadow-sm" />
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <Code2 size={16} className="text-slate-400" />
                        </div>
                        <input value={requiredSkills} onChange={e => setRequiredSkills(e.target.value)} placeholder="Mandatory Skills (comma-separated)" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/50 focus:border-[#2E9BDA] focus:bg-white transition-all shadow-sm" />
                      </div>
                    </div>

                    {jdMode === 'upload' ? (
                      <div {...getJDRootProps()} className={`flex-1 w-full border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all ${jdDrag ? 'border-[#2E9BDA] bg-[#2E9BDA]/5' : jdFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'}`}>
                        <input {...getJDInputProps()} />
                        {jdFile ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 size={32} className="text-emerald-500 mb-3" />
                            <p className="text-base font-bold text-emerald-900 truncate max-w-xs">{jdFile.name}</p>
                            <p className="text-sm text-emerald-600 font-medium mt-1">{(jdFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                              <FileText size={28} className="text-slate-400" />
                            </div>
                            <p className="text-base font-bold text-slate-800">Drop JD file here</p>
                            <p className="text-sm text-slate-500 font-medium mt-1">PDF, DOCX, or TXT</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="relative flex-1 flex flex-col">
                        <textarea 
                          value={jdText} 
                          onChange={e => setJdText(e.target.value)} 
                          placeholder="Paste the full job description here..." 
                          className="flex-1 w-full min-h-[160px] p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/50 focus:border-[#2E9BDA] focus:bg-white resize-none transition-all shadow-sm" 
                        />
                        <div className="absolute bottom-4 right-4">
                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm border ${jdText.length >= 50 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                            {jdText.length >= 50 ? 'Ready to analyze' : 'Min 50 chars'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Master Scan CTA Button */}
              <div className="flex justify-center mt-10">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAnalyze}
                  disabled={analyzing || !uploadDone || !isJdReady}
                  className="group w-full max-w-xl py-4 rounded-[1.25rem] font-black text-base text-white bg-gradient-to-r from-[#2E9BDA] via-[#248bc7] to-indigo-600 shadow-xl shadow-[#2E9BDA]/25 flex items-center justify-center gap-3 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-[#2E9BDA]/40"
                >
                  {analyzing ? (
                    <><Loader2 size={20} className="animate-spin" /> Evaluating Profile...</>
                  ) : (
                    <>
                      <Zap size={20} className="text-white" />
                      <span>Run Dual-Engine ATS Analysis</span>
                      <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4 mt-2">
                <button
                  type="button"
                  onClick={handleNewScan}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-bold text-sm bg-white hover:bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer active:scale-98"
                >
                  <ArrowLeft size={16} /> Start New Scan
                </button>
              </div>

              <UnifiedATSReadinessCard
                result={result}
                onEnhance={() => setShowWizard(true)}
                onDownloadPDF={handleDownloadPDF}
                onReset={handleNewScan}
                enhancing={enhancing}
                generatingPDF={generatingPDF}
              />
            </motion.div>
          )}

        </AnimatePresence>

        {/* ── OVERLAYS (Modals) ── */}
        <AnimatePresence>
          {analyzing && <ScanningDiagnosticsModal jobTitle={jobTitle} />}
          {invalidDocument && !analyzing && (
            <div ref={resultRef}>
              <InvalidDocumentError confidence={invalidDocData?.parsing_confidence} warnings={invalidDocData?.parsing_warnings || []} onReset={handleNewScan} />
            </div>
          )}
          {showWizard && result && (
            <EnhancementWizard result={result} onClose={() => setShowWizard(false)} onSubmit={(data) => { setShowWizard(false); handleEnhance(data); }} onSkip={() => { setShowWizard(false); handleEnhance(null); }} />
          )}
          {showPrimaryPopup && primaryResumeData && (
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