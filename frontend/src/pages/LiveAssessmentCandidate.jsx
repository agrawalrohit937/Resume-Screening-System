import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  LogOut,
  Volume2,
  VolumeX,
  AlertTriangle,
  Mic,
  ShieldCheck,
  Repeat,
  Building2,
  Briefcase,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  Lock,
  Loader2,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

import { useSpeechToText, useTextToSpeech } from '../hooks/useSpeech'
import { useAdvancedDetection } from '../hooks/useAdvancedDetection'
import { useFullscreenImmersive } from '../hooks/useFullscreenImmersive'
import DetectionPanel from '../components/detection/DetectionPanel'
import ImmersiveShell from '../components/interview/onboarding/ImmersiveShell'
import CheatingWarningModal from '../components/detection/CheatingWarningModal'
import SystemCheckStep from '../components/interview/onboarding/SystemCheckStep'
import EmployerAssessmentComplete from '../components/interview/EmployerAssessmentComplete'

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const MAX_WARNINGS = 3

const DIFF_CONFIG = {
  easy: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Warm-up / Easy', time: 120 },
  medium: { color: 'text-[#1d6fa5]', bg: 'bg-[#2E9BDA]/10', border: 'border-[#2E9BDA]/25', label: 'Standard / Medium', time: 180 },
  hard: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Challenge / Hard', time: 240 },
}

const CANDIDATE_PHASE = {
  LOADING: 'loading',
  WELCOME: 'welcome',
  SYSTEM_CHECK: 'system_check',
  ACTIVE: 'active',
  SUBMITTING_QUESTION: 'submitting_question',
  ABORTED: 'aborted',
  COMPLETED: 'completed',
  ERROR: 'error',
}

// ── Custom End Assessment confirmation modal ─────────────────────────────────
function EndAssessmentModal({ open, onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000000000] flex items-center justify-center bg-blue-950/50 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-blue-100"
          >
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <LogOut className="h-5 w-5" />
            </div>
            <h3 className="text-[18px] font-extrabold text-blue-950">End this interview session?</h3>
            <p className="text-[13px] text-blue-900/55 font-medium mt-1.5 leading-relaxed">
              Leaving now will conclude your assessment and submit your responses captured so far to the hiring team. Are you sure you want to exit?
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 h-11 rounded-xl border border-blue-200 text-blue-900/70 font-bold text-[13px] hover:bg-blue-50 transition-all cursor-pointer"
              >
                Stay &amp; Continue
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 h-11 rounded-xl bg-rose-600 text-white font-bold text-[13px] hover:bg-rose-700 transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                End Assessment
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function LiveAssessmentCandidate() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [phase, setPhase] = useState(CANDIDATE_PHASE.LOADING)
  const [sessionData, setSessionData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [answers, setAnswers] = useState([])
  const [answerText, setAnswerText] = useState('')
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [questionTimer, setQuestionTimer] = useState(0)
  const [questionStartAt, setQuestionStartAt] = useState(null)

  const [cheatingData, setCheatingData] = useState({ score: 0, warning_count: 0, events: [] })
  const [currentWarning, setCurrentWarning] = useState(null)
  const warningTimerRef = useRef(null)

  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const spokenForQRef = useRef(-1)
  const avatarVideoRef = useRef(null)

  // Camera & Detection Refs
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  const timerRef = useRef(null)
  const qTimerRef = useRef(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Fetch session context on mount
  useEffect(() => {
    if (!token) {
      setErrorMessage('Missing assessment magic token')
      setPhase(CANDIDATE_PHASE.ERROR)
      return
    }

    const fetchSession = async () => {
      try {
        const res = await api.get(`/live-interview/magic/${token}`)
        const session = res.data?.session
        if (!session) {
          throw new Error('Session not found')
        }

        if (session.is_expired) {
          setErrorMessage('This interview assessment invitation has expired. Please contact the hiring team.')
          setPhase(CANDIDATE_PHASE.ERROR)
          return
        }

        if (session.status === 'completed') {
          setSessionData(session)
          setPhase(CANDIDATE_PHASE.COMPLETED)
          return
        }

        if (session.status === 'aborted') {
          setErrorMessage('This assessment was previously terminated due to integrity policy violations.')
          setPhase(CANDIDATE_PHASE.ERROR)
          return
        }

        setSessionData(session)
        setPhase(CANDIDATE_PHASE.WELCOME)
      } catch (err) {
        console.error('Failed to load magic session:', err)
        const msg = err.response?.data?.detail || 'Assessment session link is invalid or expired.'
        setErrorMessage(msg)
        setPhase(CANDIDATE_PHASE.ERROR)
      }
    }

    fetchSession()
  }, [token])

  // Speech tools
  const tts = useTextToSpeech({ rate: 0.95, pitch: 1 })
  const stt = useSpeechToText({
    onFinalTranscript: (text) => setAnswerText((prev) => prev + (prev ? ' ' : '') + text),
  })

  // Cheating event handler
  const handleCheatingEvent = useCallback(async (event) => {
    if (phase !== CANDIDATE_PHASE.ACTIVE) return

    setCheatingData((prev) => {
      const newEvents = [...prev.events, event]
      const highCount = newEvents.filter(
        (e) => e.severity === 'high' || e.severity === 'critical' || e.event_type === 'looking_down'
      ).length
      const medCount = newEvents.filter(
        (e) => e.severity === 'medium' && e.event_type !== 'looking_down'
      ).length
      const calculatedWarnings = highCount + Math.floor(medCount / 3)

      if (calculatedWarnings >= MAX_WARNINGS) {
        setPhase(CANDIDATE_PHASE.ABORTED)
      }

      return {
        ...prev,
        warning_count: calculatedWarnings,
        events: newEvents,
      }
    })

    setCurrentWarning(event)
    clearTimeout(warningTimerRef.current)
    warningTimerRef.current = setTimeout(() => setCurrentWarning(null), 6000)

    try {
      await api.post(`/live-interview/magic/${token}/cheat`, {
        event_type: event.event_type,
        severity: event.severity || 'medium',
        details: event.details || '',
      })
    } catch (e) {
      console.warn('Cheat event sync error:', e)
    }
  }, [phase, token])

  const fsGate = useFullscreenImmersive({
    onUnexpectedExit: () => {
      if (showEndConfirm) return
      handleCheatingEvent({
        event_type: 'fullscreen_exit',
        severity: 'high',
        details: 'Exited full-screen mode',
      })
    },
  })

  const confirmEndAssessment = async () => {
    setShowEndConfirm(false)
    stt.stopListening?.()
    tts.stop()
    try {
      await fsGate.exitImmersive()
    } catch (_) {}
    try {
      const timeTaken = questionStartAt ? Math.round((Date.now() - questionStartAt) / 1000) : questionTimer
      await api.post(`/live-interview/magic/${token}/complete`, {
        total_time_secs: timeElapsed + timeTaken,
      })
    } catch (_) {}
    setPhase(CANDIDATE_PHASE.COMPLETED)
  }

  // Avatar video sync with TTS
  useEffect(() => {
    if (avatarVideoRef.current) {
      if (tts.speaking) {
        avatarVideoRef.current.play().catch(() => {})
      } else {
        avatarVideoRef.current.pause()
        avatarVideoRef.current.currentTime = 0
      }
    }
  }, [tts.speaking])

  // Proctoring ML hook — pre-warmed during system check so AI models are 100% active before test starts
  const [loadModels, setLoadModels] = useState(false)
  const [isLaunchingRoom, setIsLaunchingRoom] = useState(false)

  const detectionStatus = useAdvancedDetection({
    videoRef,
    canvasRef,
    onEvent: handleCheatingEvent,
    active: Boolean(phase === CANDIDATE_PHASE.SYSTEM_CHECK || phase === CANDIDATE_PHASE.ACTIVE || loadModels || isLaunchingRoom),
    isLive: phase === CANDIDATE_PHASE.ACTIVE,
    faceInterval: 650,
    objectInterval: 8000,
  })

  const handleStartFromSystemCheck = useCallback(async () => {
    const isReady = Boolean(detectionStatus?.allModelsReady || (detectionStatus?.mpReady && detectionStatus?.tfReady))
    if (!isReady) {
      setIsLaunchingRoom(true)
      return
    }

    try {
      await fsGate.enterImmersive()
    } catch (_) {}
    try {
      await handleStartSession()
    } catch (_) {}
  }, [fsGate, detectionStatus])

  useEffect(() => {
    if (!isLaunchingRoom) return
    let cancelled = false
    const checkAndLaunch = async () => {
      const isReady = Boolean(detectionStatus?.allModelsReady || (detectionStatus?.mpReady && detectionStatus?.tfReady))
      if (isReady && !cancelled) {
        setIsLaunchingRoom(false)
        try {
          await fsGate.enterImmersive()
        } catch (_) {}
        try {
          await handleStartSession()
        } catch (_) {}
      }
    }
    checkAndLaunch()

    // Fallback: after 20s if secondary network CDN was slow but primary face model is ready
    const timer = setTimeout(async () => {
      if (!cancelled && isLaunchingRoom && detectionStatus?.mpReady) {
        setIsLaunchingRoom(false)
        try {
          await fsGate.enterImmersive()
        } catch (_) {}
        try {
          await handleStartSession()
        } catch (_) {}
      }
    }, 20000)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isLaunchingRoom, detectionStatus?.mpReady, detectionStatus?.tfReady, detectionStatus?.allModelsReady, fsGate])

  // Camera setup
  const startCamera = useCallback(async () => {
    if (streamRef.current && streamRef.current.active) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch(() => {})
      }
      setCameraReady(true)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {})
          setCameraReady(true)
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth || 640
            canvasRef.current.height = videoRef.current.videoHeight || 480
          }
        }
      }
    } catch (e) {
      setCameraError(e.message?.includes('Permission') ? 'Camera permission denied' : 'Camera unavailable')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    const activePhases = [
      CANDIDATE_PHASE.SYSTEM_CHECK,
      CANDIDATE_PHASE.ACTIVE,
      CANDIDATE_PHASE.SUBMITTING_QUESTION,
    ]
    if (activePhases.includes(phase)) {
      startCamera()
    } else if (phase === CANDIDATE_PHASE.COMPLETED || phase === CANDIDATE_PHASE.ABORTED) {
      stopCamera()
    }
    return () => {
      if (phase === CANDIDATE_PHASE.COMPLETED || phase === CANDIDATE_PHASE.ABORTED) {
        stopCamera()
      }
    }
  }, [phase, startCamera, stopCamera])

  // Active Phase Timer
  useEffect(() => {
    if (phase === CANDIDATE_PHASE.ACTIVE) {
      timerRef.current = setInterval(() => setTimeElapsed((t) => t + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [phase])

  // Per-Question Timer
  useEffect(() => {
    if (phase === CANDIDATE_PHASE.ACTIVE) {
      setQuestionTimer(0)
      setQuestionStartAt(Date.now())

      const limit = sessionData?.questions?.[currentQIdx]?.time_limit || 120
      qTimerRef.current = setInterval(() => {
        setQuestionTimer((t) => {
          const next = t + 1
          if (next >= limit) {
            clearInterval(qTimerRef.current)
            toast('Time limit reached. Submitting current answer...', { icon: '⏱' })
            handleAutoSubmit()
            return t
          }
          return next
        })
      }, 1000)
    } else {
      clearInterval(qTimerRef.current)
    }
    return () => clearInterval(qTimerRef.current)
  }, [phase, currentQIdx, sessionData])

  // Integrity listeners in ACTIVE phase
  useEffect(() => {
    if (phase !== CANDIDATE_PHASE.ACTIVE) return

    const onHide = () => {
      if (document.hidden) {
        handleCheatingEvent({ event_type: 'tab_switch', severity: 'critical', details: 'Tab switched during active assessment' })
        setPhase(CANDIDATE_PHASE.ABORTED)
      }
    }
    const onBlur = () => {
      handleCheatingEvent({ event_type: 'window_blur', severity: 'critical', details: 'Window focus lost / switched to another application' })
    }
    const onPaste = (e) => {
      const txt = e.clipboardData?.getData('text') || ''
      if (txt.length > 15) {
        handleCheatingEvent({ event_type: 'copy_paste', severity: 'high', details: `${txt.length} chars pasted` })
      }
    }
    const onDevTools = (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key))) {
        e.preventDefault()
        handleCheatingEvent({ event_type: 'devtools_opened', severity: 'high', details: 'Developer tools shortcut pressed' })
      }
    }

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    document.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onDevTools)

    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onDevTools)
    }
  }, [phase, handleCheatingEvent])

  const questions = sessionData?.questions || []
  const currentQ = questions[currentQIdx]
  const totalQ = questions.length
  const isLastQ = currentQIdx >= totalQ - 1

  // Start Session (Candidate launches from system check)
  const handleStartSession = async () => {
    try {
      await api.post(`/live-interview/magic/${token}/start`)
      spokenForQRef.current = -1
      setPhase(CANDIDATE_PHASE.ACTIVE)
    } catch (err) {
      toast.error('Failed to start interview session.')
    }
  }

  // Answer Submit Logic (Blind progression)
  const handleSubmitAnswer = async ({ answerText: text, answerSource = 'text' }) => {
    if (!currentQ || !token) return

    tts.stop()
    stt.stopListening?.()
    setPhase(CANDIDATE_PHASE.SUBMITTING_QUESTION)

    const timeTaken = questionStartAt ? Math.round((Date.now() - questionStartAt) / 1000) : questionTimer

    const payload = {
      question_id: currentQ.id,
      question_text: currentQ.text,
      category: currentQ.category || 'technical',
      answer: text || 'No response provided.',
      answer_source: answerSource,
      time_taken_secs: timeTaken,
      reattempted: false,
    }

    try {
      await api.post(`/live-interview/magic/${token}/answer`, payload)
      setAnswers((prev) => [...prev, { question_id: currentQ.id, answer: text }])
      setAnswerText('')
      stt.resetTranscript?.()

      if (isLastQ) {
        // Finalize blind submission
        await api.post(`/live-interview/magic/${token}/complete`, { total_time_secs: timeElapsed + timeTaken })
        await fsGate.exitImmersive()
        stopCamera()
        setPhase(CANDIDATE_PHASE.COMPLETED)
      } else {
        setCurrentQIdx((i) => i + 1)
        setPhase(CANDIDATE_PHASE.ACTIVE)
      }
    } catch (err) {
      console.error('Answer submission failed:', err)
      toast.error('Failed to submit answer. Continuing...')
      if (isLastQ) {
        setPhase(CANDIDATE_PHASE.COMPLETED)
      } else {
        setCurrentQIdx((i) => i + 1)
        setPhase(CANDIDATE_PHASE.ACTIVE)
      }
    }
  }

  const handleAutoSubmit = () => {
    handleSubmitAnswer({ answerText: answerText || 'Time expired.', answerSource: 'text' })
  }

  // Question speech hook
  const handleQuestionRevealed = useCallback(() => {
    if (!voiceEnabled || !tts.supported) return
    if (phase !== CANDIDATE_PHASE.ACTIVE || !currentQ) return
    if (spokenForQRef.current === currentQIdx) return
    spokenForQRef.current = currentQIdx
    tts.speak(currentQ.text)
  }, [voiceEnabled, phase, currentQ, currentQIdx, tts])

  const repeatQuestion = () => {
    if (currentQ) tts.speak(currentQ.text)
  }

  const diffCfg = DIFF_CONFIG[sessionData?.difficulty] || DIFF_CONFIG.medium

  // ── 1. Loading Phase ───────────────────────────────────────────────────────
  if (phase === CANDIDATE_PHASE.LOADING) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 animate-pulse">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900">
          Loading AI Assessment Environment...
        </h2>
        <p className="text-xs text-slate-500 mt-1">Verifying secure token & company parameters</p>
      </div>
    )
  }

  // ── 2. Error / Expired Phase ──────────────────────────────────────────────
  if (phase === CANDIDATE_PHASE.ERROR) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-xl"
        >
          <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Assessment Link Unavailable
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            {errorMessage || 'This invitation link is invalid or has expired.'}
          </p>
          <div className="mt-6 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 text-left">
            <span className="font-bold text-slate-700 block mb-0.5">Need assistance?</span>
            Please contact the recruiting team that issued your invitation for a refreshed access link.
          </div>
        </motion.div>
      </div>
    )
  }

  // ── 3. Completed Blind Phase ──────────────────────────────────────────────
  if (phase === CANDIDATE_PHASE.COMPLETED) {
    return <EmployerAssessmentComplete sessionData={sessionData} />
  }

  // ── 4. Aborted Integrity Phase ───────────────────────────────────────────
  if (phase === CANDIDATE_PHASE.ABORTED) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl border border-rose-200 p-8 text-center shadow-2xl"
        >
          <div className="h-14 w-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Assessment Terminated
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            Repeated security integrity flags or application switches were recorded. To ensure fair evaluation standards, this assessment has ended.
          </p>
          <p className="text-xs text-slate-400 mt-4">
            A report of recorded activity has been securely logged for the employer's review.
          </p>
        </motion.div>
      </div>
    )
  }

  // ── 5. Branded Welcome Landing (Bypass Setup) ─────────────────────────────
  if (phase === CANDIDATE_PHASE.WELCOME) {
    const company = sessionData?.company_name || 'Hiring Organization'
    const role = sessionData?.job_title || 'Position'
    const count = sessionData?.total_questions || 6

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] via-[#EFF6FF] to-[#F1F5F9] flex items-center justify-center p-4 sm:p-6 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 shadow-[0_25px_70px_-15px_rgba(15,23,42,0.1)] p-8 sm:p-10 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-blue-600" />

          {/* Invitation Banner */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                Official Interview Invitation
              </span>
              <p className="text-xs text-slate-400 mt-0.5">Enterprise AI Screening Portal</p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
            You have been invited by <span className="text-blue-600">{company}</span> for the{' '}
            <span className="text-slate-900">{role}</span> interview.
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
            The hiring team has configured a targeted AI assessment tailored to the role's responsibilities and technical stack.
          </p>

          {/* Key Parameters Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Questions</span>
              <span className="text-lg font-black text-slate-900 mt-0.5 block">{count} Questions</span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Format</span>
              <span className="text-xs font-bold text-blue-700 mt-1 block capitalize">{sessionData?.interview_type || 'Mixed'}</span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Est. Duration</span>
              <span className="text-lg font-black text-emerald-700 mt-0.5 block">~15–20 min</span>
            </div>
          </div>

          {/* Security & Proctoring Checklist */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 mb-8 space-y-2 text-left">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-950 uppercase tracking-wider">
              <ShieldCheck size={16} className="text-blue-600 shrink-0" />
              <span>Assessment & Proctoring Guidelines:</span>
            </div>
            <ul className="text-xs text-blue-900/75 space-y-1.5 pl-5 list-disc font-medium leading-relaxed">
              <li>Camera & microphone check required before entering terminal.</li>
              <li>Continuous AI proctoring tracks window focus and visual integrity.</li>
              <li>Responses are submitted blindly and securely evaluated for the hiring team.</li>
            </ul>
          </div>

          {/* Action CTA */}
          <button
            type="button"
            onClick={() => setPhase(CANDIDATE_PHASE.SYSTEM_CHECK)}
            className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
          >
            <span>Proceed to System & Camera Check</span>
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
    )
  }

  // ── 6. System Check Phase ─────────────────────────────────────────────────
  if (isLaunchingRoom) {
    return (
      <ImmersiveShell active={fsGate.immersive}>
        <div className="fixed inset-0 z-[999999] w-screen h-screen bg-[#F5F7FB] flex flex-col items-center justify-center p-6 text-center select-none">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-[460px] w-full bg-white rounded-3xl p-8 shadow-2xl border border-blue-100 flex flex-col items-center space-y-6"
          >
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#2E9BDA] to-[#1d6fa5] flex items-center justify-center text-white shadow-lg shadow-[#2E9BDA]/25">
              <Bot className="w-8 h-8" />
              <div className="absolute inset-0 rounded-2xl border-2 border-[#2E9BDA] animate-ping opacity-30" />
            </div>

            <div className="space-y-2">
              <h3 className="text-[20px] font-black text-blue-950">
                Initializing AI Proctoring Engine
              </h3>
              <p className="text-[13px] text-blue-900/55 font-medium leading-relaxed">
                Loading facial tracking &amp; gaze detection models in the background. Entering assessment room...
              </p>
            </div>

            <div className="w-full space-y-2.5 text-left bg-slate-50 border border-blue-100/80 rounded-2xl p-4 text-[12.5px] font-semibold text-blue-950">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Camera &amp; Microphone
                </span>
                <span className="text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">VERIFIED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {(detectionStatus?.allModelsReady || (detectionStatus?.mpReady && detectionStatus?.tfReady)) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-[#2E9BDA] animate-spin" />
                  )}
                  AI FaceMesh &amp; Proctoring Engines
                </span>
                <span className={`font-bold text-[11px] px-2 py-0.5 rounded-full border ${
                  (detectionStatus?.allModelsReady || (detectionStatus?.mpReady && detectionStatus?.tfReady))
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-[#1d6fa5] bg-blue-50 border-blue-200 animate-pulse'
                }`}>
                  {(detectionStatus?.allModelsReady || (detectionStatus?.mpReady && detectionStatus?.tfReady)) ? 'READY' : 'ACTIVATING...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#2E9BDA] animate-spin" />
                  AI Assessment Session
                </span>
                <span className="text-[#1d6fa5] font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">
                  PREPARING
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </ImmersiveShell>
    )
  }

  if (phase === CANDIDATE_PHASE.SYSTEM_CHECK) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] via-[#EFF6FF] to-[#F1F5F9] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center font-sans">
        <div className="max-w-6xl w-full mx-auto">
          <SystemCheckStep
            videoRef={videoRef}
            canvasRef={canvasRef}
            cameraReady={cameraReady}
            cameraError={cameraError}
            startCamera={startCamera}
            detectionStatus={detectionStatus}
            fsGate={fsGate}
            onPrepareAi={() => setLoadModels(true)}
            onBack={() => setPhase(CANDIDATE_PHASE.WELCOME)}
            onComplete={handleStartFromSystemCheck}
          />
        </div>
      </div>
    )
  }

  // ── 7. Active Live Terminal Phase ─────────────────────────────────────────
  const q = currentQ
  const aiSpeaking = tts.speaking
  const timeLimit = q?.time_limit || 120
  const remaining = Math.max(0, timeLimit - questionTimer)
  const pct = Math.min(100, (questionTimer / timeLimit) * 100)
  const urgent = questionTimer > timeLimit * 0.8
  const timerColor = urgent ? 'text-rose-600' : questionTimer > timeLimit * 0.6 ? 'text-amber-600' : 'text-[#1d6fa5]'

  return (
    <ImmersiveShell active={fsGate.immersive}>
      <div className="fixed inset-0 z-[999999] w-screen h-screen bg-[#F5F7FB] flex flex-col overflow-hidden font-sans">
        
        {/* Warnings Modal */}
        <CheatingWarningModal
          event={currentWarning}
          warningCount={cheatingData.warning_count}
          maxWarnings={MAX_WARNINGS}
          onDismiss={() => setCurrentWarning(null)}
        />

        <EndAssessmentModal
          open={showEndConfirm}
          onCancel={() => setShowEndConfirm(false)}
          onConfirm={confirmEndAssessment}
        />

        {/* Top Header */}
        <div className="h-16 bg-white border-b border-blue-100 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
              {sessionData?.company_name?.[0] || 'C'}
            </div>
            <div>
              <p className="text-sm font-extrabold text-blue-950 leading-tight">
                {sessionData?.company_name || 'CareerShala'} Assessment
              </p>
              <p className="text-[11.5px] text-blue-900/45 font-semibold">
                {sessionData?.job_title || 'Position'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setVoiceEnabled((v) => {
                  if (v) tts.stop()
                  return !v
                })
              }
              title={voiceEnabled ? 'Mute AI voice' : 'Enable AI voice'}
              className={`h-9 w-9 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                voiceEnabled
                  ? 'border-blue-200 text-blue-900/60 hover:border-blue-300'
                  : 'border-amber-300 bg-amber-50 text-amber-600'
              }`}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <div className="flex items-center gap-2 bg-slate-50 border border-blue-100 rounded-full px-3.5 py-1.5">
              <span className={`h-2 w-2 rounded-full ${aiSpeaking ? 'bg-blue-500' : 'bg-emerald-500'}`} />
              <span className="font-mono text-xs font-bold text-blue-900/70 tabular-nums">
                {fmt(timeElapsed)}
              </span>
            </div>

            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              Live Proctoring Active
            </span>

            {/* End Assessment Button */}
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-700 text-xs font-bold hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer shadow-xs ml-1"
            >
              <LogOut className="h-3.5 w-3.5" /> End Assessment
            </button>
          </div>
        </div>

        {/* Body Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Question Progress Sidebar */}
          <div className="w-[200px] shrink-0 h-full bg-white border-r border-blue-100 p-4 flex flex-col gap-3 overflow-hidden">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-extrabold text-blue-900/45 uppercase tracking-wider">
                  Progress
                </span>
                <span className="text-xs font-mono font-bold text-blue-600 tabular-nums">
                  {currentQIdx + 1}/{totalQ}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-blue-50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${((currentQIdx + 1) / totalQ) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 p-1.5 rounded-2xl border border-blue-50 bg-slate-50/50 overflow-y-auto flex-1 content-start">
              {Array.from({ length: totalQ }).map((_, i) => {
                const isCurrent = i === currentQIdx
                const isDone = i < currentQIdx
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl border flex items-center justify-center text-xs font-mono font-extrabold transition-all ${
                      isCurrent
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : isDone
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-blue-100 text-slate-300'
                    }`}
                  >
                    {i + 1}
                  </div>
                )
              })}
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-snug">
              🔒 <strong>Blind Assessment:</strong> Answers are submitted directly to the employer.
            </div>
          </div>

          {/* Main Question & Answer Area */}
          <div className="flex-1 grid gap-5 p-5 overflow-hidden" style={{ gridTemplateColumns: '1fr 350px' }}>
            
            {/* Left/Center: Question Card with Avatar Video & Voice Stage */}
            <div className="flex flex-col gap-4 min-h-0 h-full">
              {q && (
                <motion.div
                  key={`q-${currentQIdx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  onAnimationComplete={handleQuestionRevealed}
                  className="flex flex-col gap-4 flex-1 min-h-0"
                >
                  {/* Top Question Card with AI Interviewer Avatar Video */}
                  <div className="bg-white rounded-3xl border border-blue-100 p-5 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                      {/* Alex — AI Interviewer Avatar Video */}
                      <div
                        className="relative rounded-2xl overflow-hidden shrink-0 w-full sm:w-[220px] aspect-[4/3] border transition-all duration-500 bg-slate-950 shadow-sm"
                        style={{
                          borderColor: aiSpeaking ? 'rgba(139,92,246,0.5)' : 'rgba(46,155,218,0.3)',
                          boxShadow: aiSpeaking ? '0 0 0 3px rgba(139,92,246,0.18), 0 12px 24px -10px rgba(139,92,246,0.45)' : 'none',
                        }}
                      >
                        <video
                          ref={avatarVideoRef}
                          autoPlay
                          loop
                          muted={true}
                          playsInline
                          crossOrigin="anonymous"
                          onError={(e) => console.warn('[LiveAssessmentCandidate] Avatar video load error:', e)}
                          className="absolute inset-0 w-full h-full object-cover z-0"
                        >
                          <source src="/interviewer-avatar.mp4" type="video/mp4" />
                        </video>

                        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          <span className="text-white text-[9px] font-extrabold tracking-wide">LIVE AI</span>
                        </div>

                        <div className={`absolute top-2 right-2 z-20 rounded-full px-2 py-0.5 text-[9.5px] font-bold text-white shadow-sm ${aiSpeaking ? 'bg-violet-600' : 'bg-[#2E9BDA]'}`}>
                          {aiSpeaking ? "AI'S TURN" : 'YOUR TURN'}
                        </div>

                        <div className="absolute bottom-2 left-2 right-2 z-20 bg-black/45 backdrop-blur-sm rounded-xl px-2.5 py-1.5 border border-white/10 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-white leading-tight truncate">Alex</p>
                            <p className="text-[9.5px] text-slate-300 font-medium">AI Technical Interviewer</p>
                          </div>
                          {aiSpeaking && (
                            <div className="flex items-center gap-0.5">
                              <span className="w-1 h-3 rounded-full bg-violet-400 animate-pulse" />
                              <span className="w-1 h-4 rounded-full bg-violet-300 animate-pulse delay-75" />
                              <span className="w-1 h-2 rounded-full bg-violet-400 animate-pulse delay-150" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Question Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 self-stretch">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${diffCfg.color} ${diffCfg.bg} ${diffCfg.border}`}>
                              {diffCfg.label.toUpperCase()}
                            </span>
                            <span className="text-[10.5px] font-bold text-blue-900/40">{(q.category || 'TECHNICAL').toUpperCase()}</span>
                            <span className="ml-auto font-mono text-[11px] text-blue-900/40 font-bold">Q{currentQIdx + 1} / {totalQ}</span>
                          </div>
                          <h1 className="text-[16.5px] sm:text-[17.5px] font-bold text-blue-950 leading-relaxed">{q.text}</h1>
                        </div>

                        <div className="flex items-center gap-3 pt-2.5 mt-2 border-t border-blue-50/80">
                          {tts.supported && (
                            <button
                              onClick={repeatQuestion}
                              title="Replay question"
                              className="h-8 px-3 rounded-xl border border-blue-200 text-[#1d6fa5] hover:bg-blue-50/70 font-semibold text-[11.5px] flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Repeat className="h-3.5 w-3.5" /> Replay Question Audio
                            </button>
                          )}
                          {aiSpeaking && (
                            <span className="text-[11px] font-semibold text-violet-600 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-ping" />
                              Speaking question...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Spoken Assessment Workspace — 100% Dedicated to Spoken Voice Evaluation */}
                  <div className="bg-white rounded-3xl border border-blue-100 flex flex-col flex-1 min-h-0 overflow-hidden shadow-sm">
                    {/* Urgency Progress Line */}
                    <div className="h-[3px] bg-blue-50 w-full">
                      <motion.div
                        animate={{ width: `${Math.max(0, 100 - pct)}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                        className={`h-full ${urgent ? 'bg-rose-500' : 'bg-blue-600'}`}
                      />
                    </div>

                    {/* Stage Header */}
                    <div className="px-5 py-3 flex items-center justify-between border-b border-blue-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-blue-950 uppercase tracking-wider">
                          Spoken Assessment
                        </span>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                          Voice Mode Active
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-blue-100 rounded-full px-3 py-1">
                          <Clock size={12} className="text-slate-400" />
                          <span className={`font-mono text-xs font-bold tabular-nums ${timerColor}`}>
                            {fmt(remaining)}
                          </span>
                        </div>
                        <span className="text-[11px] text-blue-900/35 font-semibold">
                          {(answerText.trim() ? answerText.trim().split(/\s+/).length : 0)} words • {answerText.length} chars
                        </span>
                      </div>
                    </div>

                    {/* Center Glowing Mic Button & Concentric Waves Stage */}
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-5 relative overflow-hidden">
                      <div className="w-full max-w-lg flex flex-col items-center justify-center my-auto">
                        
                        {/* Center Mic Button with Ripple Waves */}
                        <div className="relative flex items-center justify-center h-36 w-36 mb-2">
                          <AnimatePresence>
                            {stt?.listening && (
                              <>
                                <motion.div
                                  key="wave-1"
                                  initial={{ scale: 0.9, opacity: 0.7 }}
                                  animate={{ scale: [1, 1.45, 1.7], opacity: [0.6, 0.25, 0] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                                  className="absolute inset-0 rounded-full bg-rose-500/20 blur-sm pointer-events-none"
                                />
                                <motion.div
                                  key="wave-2"
                                  initial={{ scale: 0.9, opacity: 0.7 }}
                                  animate={{ scale: [1, 1.3, 1.5], opacity: [0.5, 0.2, 0] }}
                                  transition={{ duration: 2, repeat: Infinity, delay: 0.6, ease: 'easeOut' }}
                                  className="absolute inset-0 rounded-full bg-rose-500/15 blur-xs pointer-events-none"
                                />
                              </>
                            )}
                          </AnimatePresence>

                          {/* Ambient Circular Halo */}
                          <div
                            className={`absolute w-28 h-28 rounded-full blur-xl transition-all duration-500 ${
                              stt?.listening ? 'bg-rose-400/25' : 'bg-slate-200/50'
                            }`}
                          />

                          {/* Interactive Center Mic Button */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: aiSpeaking ? 1 : 1.05 }}
                            whileTap={{ scale: aiSpeaking ? 1 : 0.95 }}
                            disabled={aiSpeaking || phase === CANDIDATE_PHASE.SUBMITTING_QUESTION}
                            onClick={stt?.toggleListening}
                            className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
                              stt?.listening
                                ? 'bg-rose-600 text-white shadow-rose-500/30 ring-4 ring-rose-200 animate-pulse'
                                : 'bg-white border-2 border-slate-200 text-blue-600 shadow-xs hover:border-blue-400 hover:shadow-md'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <Mic className={`h-8 w-8 transition-transform duration-300 ${stt?.listening ? 'scale-110' : ''}`} />
                          </motion.button>
                        </div>

                        {/* Dynamic Sound Waveform Bars when recording */}
                        {stt?.listening ? (
                          <div className="flex items-center gap-1.5 h-6 mb-3">
                            {[12, 22, 16, 28, 14, 26, 18, 24, 15].map((h, i) => (
                              <motion.span
                                key={i}
                                animate={{
                                  height: [`${h * 0.4}px`, `${h}px`, `${h * 0.3}px`],
                                }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 0.6 + (i % 3) * 0.15,
                                  ease: 'easeInOut',
                                }}
                                className="w-[3px] rounded-full bg-rose-500"
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] font-bold text-blue-950 mb-3 tracking-tight">
                            {aiSpeaking ? 'Alex is speaking...' : 'Click microphone to speak your answer'}
                          </p>
                        )}

                        {/* Live Streaming Spoken Preview Card — Instant 0ms Word Streaming */}
                        <div className="w-full rounded-2xl bg-slate-50/90 border border-blue-100/70 p-4 max-h-[120px] overflow-y-auto text-center shadow-inner">
                          {answerText.trim() || (stt?.listening && stt?.transcript) ? (
                            <p className="text-[13px] text-blue-950 font-medium leading-relaxed italic">
                              "{answerText ? <span>{answerText} </span> : null}
                              {stt?.transcript ? (
                                <span className="text-violet-600 font-semibold underline decoration-violet-300">
                                  {stt.transcript}
                                </span>
                              ) : null}"
                            </p>
                          ) : stt?.listening ? (
                            <p className="text-[12px] text-violet-600 font-semibold animate-pulse">
                              Listening... speak your response clearly
                            </p>
                          ) : (
                            <p className="text-[12px] text-blue-900/40 font-medium">
                              Tap the microphone button above to start answering verbally. Words stream in real time.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="px-5 py-3.5 border-t border-blue-50 bg-slate-50/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {stt?.supported && (
                          <button
                            type="button"
                            disabled={aiSpeaking || phase === CANDIDATE_PHASE.SUBMITTING_QUESTION}
                            onClick={stt.toggleListening}
                            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              stt?.listening
                                ? 'border-rose-300 bg-rose-50 text-rose-600'
                                : 'border-blue-200 bg-white text-blue-900/60 hover:border-blue-300 hover:bg-blue-50/50'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <Repeat className="h-3.5 w-3.5" />
                            <span>{stt?.listening ? 'Stop Recording' : 'Speak Again'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAnswerText('')
                            stt?.resetTranscript?.()
                          }}
                          disabled={!answerText.trim() && !stt?.transcript}
                          className="h-9 px-3.5 rounded-xl border border-blue-200 bg-white text-blue-900/50 text-xs font-bold hover:border-blue-300 hover:text-rose-600 disabled:opacity-40 transition-all cursor-pointer"
                        >
                          Clear Answer
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleSubmitAnswer({
                            answerText: answerText.trim() || stt?.transcript || '',
                            answerSource: 'voice',
                          })
                        }
                        disabled={
                          (answerText.trim().length < 5 && !(stt?.transcript && stt.transcript.length >= 5)) ||
                          aiSpeaking ||
                          phase === CANDIDATE_PHASE.SUBMITTING_QUESTION
                        }
                        className="h-10 px-6 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-xs disabled:opacity-40 transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        {phase === CANDIDATE_PHASE.SUBMITTING_QUESTION ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...</>
                        ) : isLastQ ? (
                          <>Submit &amp; Finish Assessment <ArrowRight className="h-3.5 w-3.5" /></>
                        ) : (
                          <>Submit &amp; Next Question <ArrowRight className="h-3.5 w-3.5" /></>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right rail: Candidate Proctoring Station ONLY (Camera at the very top, zero scroll lag) */}
            <div className="flex flex-col gap-3 h-full min-h-0 overflow-hidden">
              <div className="bg-white rounded-3xl border border-blue-100 p-3.5 flex flex-col gap-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-full overflow-hidden">
                <div className="flex items-center justify-between border-b border-blue-50 pb-2.5 shrink-0">
                  <span className="text-[11px] font-extrabold text-blue-900/50 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#2E9BDA]" /> Candidate Camera &amp; Proctoring
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <DetectionPanel
                    detectionStatus={detectionStatus}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    warningCount={cheatingData.warning_count}
                    maxWarnings={MAX_WARNINGS}
                    cheatingScore={cheatingData.score}
                    hideIntegrity={true}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </ImmersiveShell>
  )
}
