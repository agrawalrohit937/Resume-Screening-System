/**
 * LiveInterviewV2 — AI Live Interview Terminal (v3)
 *
 * Fixes vs previous version:
 *  1. Sidebar white-gap: the interview screen renders as a fixed,
 *     full-viewport layer (inset-0, very high z-index) while active, so it
 *     physically covers the page no matter what the outer Layout reserves
 *     for the sidebar.
 *  2. "Exit Practice" now reliably works: it uses a CUSTOM in-page confirm
 *     modal instead of window.confirm(). Native confirm()/alert() dialogs
 *     silently force the browser out of fullscreen the instant they open —
 *     before the user even answers — which was tripping the "unexpected
 *     exit" → cheating-warning path and could even auto-abort the session.
 *     Confirming now calls session.resetSession() directly, so the user is
 *     always dropped back on the true first screen (role setup).
 *  3. The AI avatar now only starts "speaking" (real speech synthesis)
 *     AFTER the question card's entrance animation finishes — wired via
 *     framer-motion's onAnimationComplete — instead of speaking instantly
 *     while the card is still sliding in.
 *  4. Visual language: violet/indigo = "AI's turn" (avatar speaking),
 *     brand blue = "your turn" (you can answer). Full redesign to match
 *     the rest of the onboarding flow (RoleConfigStep / GuidelinesStep /
 *     SystemCheckStep) instead of being a visually disconnected screen.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, LogOut, Volume2, VolumeX, AlertTriangle,
  Mic, ShieldCheck, Repeat,
} from 'lucide-react'

import { useInterviewSession, SESSION_PHASE } from '../hooks/useInterviewSession'
import { useSpeechToText, useTextToSpeech } from '../hooks/useSpeech'
import { useAdvancedDetection } from '../hooks/useAdvancedDetection'
import { useFullscreenImmersive } from '../hooks/useFullscreenImmersive'
import DetectionPanel from '../components/detection/DetectionPanel'

import InterviewReport from '../components/interview/InterviewReport'
import ImmersiveShell from '../components/interview/onboarding/ImmersiveShell'
import RoleConfigStep from './RoleConfigStep'
import GuidelinesStep from './GuidelinesStep'
import SystemCheckStep from '../components/interview/onboarding/SystemCheckStep'

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const MAX_WARNINGS = 3

const DIFF_CONFIG = {
  easy: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Easy', time: 120 },
  medium: { color: 'text-[#1d6fa5]', bg: 'bg-[#2E9BDA]/10', border: 'border-[#2E9BDA]/25', label: 'Medium', time: 180 },
  hard: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Hard', time: 240 },
}

// ── Animated AI avatar — visual "whose turn is it" indicator ──────────────
function AvatarOrb({ speaking }) {
  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center">
      <motion.div
        animate={speaking ? { scale: [1, 1.18, 1], opacity: [0.45, 0.15, 0.45] } : { scale: 1, opacity: 0.18 }}
        transition={{ duration: 1.6, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}
        className={`absolute h-36 w-36 rounded-full blur-2xl ${speaking ? 'bg-violet-500' : 'bg-slate-500'}`}
      />
      <div
        className={`relative h-24 w-24 rounded-3xl flex items-center justify-center border-2 transition-all duration-500 ${
          speaking
            ? 'bg-gradient-to-br from-violet-500 to-indigo-600 border-violet-300/60 shadow-[0_0_36px_rgba(124,108,240,0.45)]'
            : 'bg-white/10 border-white/15'
        }`}
      >
        <Bot className="h-10 w-10 text-white" strokeWidth={1.75} />
      </div>
      <div className="absolute bottom-6 flex items-end gap-[3px] h-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <motion.span
            key={i}
            animate={speaking ? { height: [`${18 + (i % 4) * 10}%`, '100%', `${25 + (i % 3) * 14}%`] } : { height: '14%' }}
            transition={{ duration: 0.5 + (i % 3) * 0.12, repeat: speaking ? Infinity : 0, repeatType: 'mirror', ease: 'easeInOut' }}
            className={`w-[3px] rounded-full ${speaking ? 'bg-white/85' : 'bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Custom End Practice confirmation — replaces window.confirm() ─────────
function EndPracticeModal({ open, onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000000000] flex items-center justify-center bg-blue-950/50 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-blue-100"
          >
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <LogOut className="h-5 w-5" />
            </div>
            <h3 className="text-[18px] font-extrabold text-blue-950">End this practice session?</h3>
            <p className="text-[13px] text-blue-900/55 font-medium mt-1.5 leading-relaxed">
              You'll leave the interview room and return to the setup screen. Progress on the current question won't be saved.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={onCancel} className="flex-1 h-11 rounded-xl border border-blue-200 text-blue-900/70 font-bold text-[13px] hover:bg-blue-50 transition-all">
                Stay
              </button>
              <button onClick={onConfirm} className="flex-1 h-11 rounded-xl bg-rose-600 text-white font-bold text-[13px] hover:bg-rose-700 transition-all shadow-md shadow-rose-600/20">
                End Practice
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Cheating warning toast (self-contained, no external component needed) ─
function WarningToast({ warning, count, max }) {
  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[3000000001] w-[min(92vw,420px)]"
        >
          <div className="flex items-start gap-3 bg-white rounded-2xl border border-amber-200 shadow-xl shadow-amber-900/10 p-4">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-blue-950">Integrity flag {count}/{max}</p>
              <p className="text-[12px] text-blue-900/55 font-medium mt-0.5 truncate">{warning.details || 'Unusual activity detected'}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Question grid sidebar ──────────────────────────────────────────────────
function QuestionGridMatrixSidebar({ currentQIdx, totalQ, phase, answers = [] }) {
  const count = typeof totalQ === 'number' ? totalQ : 0
  const doneCount = answers.filter((a) => a?.evaluation?.overall_score >= 50).length

  const cellClass = (i) => {
    const isCurrent = phase === SESSION_PHASE.ACTIVE && i === currentQIdx
    const hasAnswer = i < answers.length
    const score = hasAnswer ? answers[i]?.evaluation?.overall_score : null
    const needsReview = hasAnswer && (score === null || score < 50)
    const isCompleted = hasAnswer && score !== null && score >= 50

    if (isCurrent) return 'bg-gradient-to-br from-[#2E9BDA] to-[#1d6fa5] border-transparent text-white shadow-md shadow-[#2E9BDA]/30'
    if (isCompleted) return 'bg-emerald-50 border-emerald-200 text-blue-950'
    if (needsReview) return 'bg-rose-50 border-rose-200 text-blue-950'
    return 'bg-white border-blue-100 text-blue-300'
  }

  return (
    <div className="w-[210px] shrink-0 h-full bg-white border-r border-blue-100 p-4 flex flex-col gap-3.5 overflow-hidden">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10.5px] font-extrabold text-blue-900/45 uppercase tracking-wider">Question Map</span>
          <span className="text-[11px] font-mono font-bold text-[#1d6fa5] tabular-nums">{doneCount}/{count}</span>
        </div>
        <div className="h-[5px] rounded-full bg-blue-50 overflow-hidden">
          <motion.div
            animate={{ width: `${count ? (doneCount / count) * 100 : 0}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-[#2E9BDA] to-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 p-1.5 rounded-2xl border border-blue-50 bg-slate-50/50 overflow-y-auto flex-1 content-start">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} title={`Q${i + 1}`} className={`aspect-square rounded-xl border flex items-center justify-center text-[12px] font-mono font-extrabold transition-all ${cellClass(i)}`}>
            {i + 1}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {[['bg-emerald-400', 'Completed'], ['bg-[#2E9BDA]', 'Current'], ['bg-rose-400', 'Needs review']].map(([c, label]) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${c}`} />
            <span className="text-[11px] font-semibold text-blue-900/45">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Answer input workspace ─────────────────────────────────────────────────
function AnswerInput({ value, onChange, onSubmit, loading, questionTimer, diffCfg, sttHook, isSpeaking }) {
  const timeLimit = diffCfg?.time || 180
  const remaining = Math.max(0, timeLimit - questionTimer)
  const pct = Math.min(100, (questionTimer / timeLimit) * 100)
  const urgent = questionTimer > timeLimit * 0.8
  const timerColor = urgent ? 'text-rose-600' : questionTimer > timeLimit * 0.6 ? 'text-amber-600' : 'text-[#1d6fa5]'
  const barColor = urgent ? 'bg-rose-500' : questionTimer > timeLimit * 0.6 ? 'bg-amber-500' : 'bg-[#2E9BDA]'

  return (
    <div className="bg-white rounded-3xl border border-blue-100 flex flex-col flex-1 min-h-0 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="h-[3px] bg-blue-50 w-full">
        <motion.div animate={{ width: `${Math.max(0, 100 - pct)}%` }} transition={{ duration: 1, ease: 'linear' }} className={`h-full ${barColor}`} />
      </div>

      <div className="px-5 py-3.5 flex items-center justify-between border-b border-blue-50">
        <span className="text-[13px] font-extrabold text-blue-950">Your Response</span>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-blue-100 rounded-full px-3 py-1">
            <span className="text-[11px]">⏱</span>
            <span className={`font-mono text-[13px] font-bold tabular-nums ${timerColor}`}>{fmt(remaining)}</span>
          </div>
          <span className="text-[11.5px] text-blue-900/35 font-semibold">{value.length} chars</span>
        </div>
      </div>

      {sttHook?.listening && sttHook?.transcript && (
        <div className="mx-5 mt-3 px-3.5 py-2.5 rounded-xl bg-[#2E9BDA]/[0.06] border border-[#2E9BDA]/20">
          <p className="text-[12px] text-[#1d6fa5] italic font-medium">🎤 "{sttHook.transcript}"</p>
        </div>
      )}

      <div className="flex-1 p-5 flex">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isSpeaking}
          placeholder={
            isSpeaking
              ? 'The interviewer is asking the question — think through your approach, then type or speak your answer here.'
              : 'Type your answer. Cover the approach, key trade-offs, and how you would validate it.'
          }
          className="w-full h-full outline-none resize-none bg-transparent text-[14px] text-blue-950 placeholder:text-blue-900/25 font-medium leading-relaxed disabled:text-blue-900/30"
        />
      </div>

      <div className="px-5 py-3.5 border-t border-blue-50 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {sttHook?.supported && (
            <button
              type="button"
              disabled={isSpeaking}
              onClick={sttHook.toggleListening}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12px] font-bold border transition-all ${
                sttHook.listening ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-blue-200 bg-white text-blue-900/60 hover:border-blue-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Mic className="h-3.5 w-3.5" /> {sttHook.listening ? 'Recording…' : 'Speak Answer'}
            </button>
          )}
          <button
            type="button"
            onClick={() => { onChange(''); sttHook?.resetTranscript?.() }}
            className="h-9 px-3.5 rounded-xl border border-blue-200 bg-white text-blue-900/50 text-[12px] font-bold hover:border-blue-300 transition-all"
          >
            Clear
          </button>
        </div>

        <motion.button
          whileHover={{ scale: value.trim().length >= 5 && !isSpeaking && !loading ? 1.02 : 1 }}
          whileTap={{ scale: value.trim().length >= 5 && !isSpeaking && !loading ? 0.98 : 1 }}
          onClick={() => onSubmit({ answerText: value, answerSource: sttHook?.listening ? 'voice' : 'text' })}
          disabled={loading || value.trim().length < 5 || isSpeaking}
          className="h-10 px-6 rounded-xl font-bold text-[13px] text-white bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] shadow-md shadow-[#2E9BDA]/25 disabled:opacity-40 disabled:shadow-none transition-all"
        >
          {loading ? 'Scoring…' : 'Submit Answer →'}
        </motion.button>
      </div>
    </div>
  )
}

// ── Rubric feedback panel ──────────────────────────────────────────────────
function FeedbackPanel({ eval: ev, question, questionNum, isLast, onNext, onReattempt, loading }) {
  const score = ev?.overall_score || 0
  const scoreColor = score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-[#1d6fa5]' : 'text-rose-600'

  return (
    <div className="bg-white rounded-3xl border border-blue-100 flex flex-col h-full overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="px-6 py-5 bg-slate-50/60 border-b border-blue-50 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10.5px] font-extrabold text-blue-900/40 uppercase tracking-wider">Result · Question {questionNum}</span>
          <p className="text-[15px] font-bold text-blue-950 mt-1 leading-snug">
            {question?.text?.slice(0, 100)}{question?.text?.length > 100 ? '…' : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[30px] font-black tabular-nums leading-none ${scoreColor}`}>{Math.round(score)}%</p>
          <span className="text-[11px] text-blue-900/40 font-bold">Rubric Match</span>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 gap-3">
          {[['Relevance', ev?.relevance_score], ['Clarity', ev?.clarity_score], ['Confidence', ev?.confidence_score], ['Technical', ev?.technical_score]].map(([label, val]) => (
            <div key={label} className="rounded-xl border border-blue-100 bg-slate-50/60 text-center py-3">
              <p className="text-[17px] font-extrabold text-blue-950 tabular-nums">{Math.round(val || 0)}%</p>
              <p className="text-[11px] text-blue-900/45 font-bold mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {ev?.feedback && (
          <div className="rounded-2xl border border-blue-100 bg-slate-50/60 p-4">
            <p className="text-[11px] font-extrabold text-blue-950 uppercase tracking-wider mb-1.5">Feedback</p>
            <p className="text-[13.5px] text-blue-900/65 leading-relaxed font-medium">{ev.feedback}</p>
          </div>
        )}

        {ev?.ideal_answer_summary && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5">Expected Concepts</p>
            <p className="text-[13.5px] text-emerald-800/80 leading-relaxed font-medium">{ev.ideal_answer_summary}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-blue-50 bg-slate-50/60 flex gap-3">
        <button onClick={onReattempt} className="flex-1 h-11 rounded-xl border border-blue-200 bg-white text-blue-900/60 font-bold text-[13px] hover:border-blue-300 transition-all">
          Reattempt
        </button>
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          onClick={onNext} disabled={loading}
          className="flex-[2] h-11 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-[13px] shadow-md shadow-[#2E9BDA]/25 disabled:opacity-50 transition-all"
        >
          {isLast ? 'View Full Report →' : 'Next Question →'}
        </motion.button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
export default function LiveInterviewV2() {
  const location = useLocation()
  const navState = location.state || {}

  const session = useInterviewSession()
  const [briefStep, setBriefStep] = useState('guidelines')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const avatarVideoRef = useRef(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [currentWarning, setCurrentWarning] = useState(null)
  const warningTimerRef = useRef(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const spokenForQRef = useRef(-1)

  const fsGate = useFullscreenImmersive({
    onUnexpectedExit: () => handleCheatingEvent({ event_type: 'fullscreen_exit', severity: 'high', details: 'Exited full-screen mode' }),
  })

  const stt = useSpeechToText({
    onFinalTranscript: (text) => setAnswerText((prev) => prev + (prev ? ' ' : '') + text),
  })

  // Real speech synthesis for the AI interviewer's questions.
  const tts = useTextToSpeech({ rate: 0.95, pitch: 1 })
  // Control the video playback based on whether TTS is speaking
  useEffect(() => {
    if (avatarVideoRef.current) {
      if (tts.speaking) {
        avatarVideoRef.current.play().catch((e) => console.log("Video play blocked:", e));
      } else {
        avatarVideoRef.current.pause();
        avatarVideoRef.current.currentTime = 0; 
      }
    }
  }, [tts.speaking]);

  const detectionStatus = useAdvancedDetection({
    videoRef, canvasRef, onEvent: handleCheatingEvent,
    active: session.phase === SESSION_PHASE.ACTIVE || session.phase === SESSION_PHASE.BRIEFING,
    faceInterval: 1500, objectInterval: 4000, emotionInterval: 5000,
  })

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          setCameraReady(true)
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth || 640
            canvasRef.current.height = videoRef.current.videoHeight || 480
          }
        }
      }
    } catch (e) {
      setCameraError(e.message.includes('Permission') ? 'Camera permission denied' : 'Camera unavailable')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    if (session.phase !== SESSION_PHASE.SETUP) startCamera()
    return () => { if (session.phase === SESSION_PHASE.SETUP) stopCamera() }
  }, [session.phase])

  useEffect(() => () => stopCamera(), [])

  useEffect(() => {
    if (session.phase === SESSION_PHASE.BRIEFING) {
      setBriefStep('guidelines')
      spokenForQRef.current = -1 // fresh session — allow the first question to be spoken again
    }
  }, [session.phase])

  // Always land back on a clean, non-fullscreen screen whenever the phase
  // becomes REPORT or ABORTED — from finishing normally, an integrity
  // abort, or any other path (defense in depth alongside the End Practice
  // handler below, which resets more directly).
  useEffect(() => {
    if (session.phase === SESSION_PHASE.REPORT || session.phase === SESSION_PHASE.ABORTED) {
      fsGate.exitImmersive()
      stopCamera()
      tts.stop()
    }
  }, [session.phase])

  useEffect(() => {
    if (session.phase !== SESSION_PHASE.ACTIVE) return
    const onHide = () => { if (document.hidden) handleCheatingEvent({ event_type: 'tab_switch', severity: 'high', details: 'Tab switched' }) }
    const onBlur = () => handleCheatingEvent({ event_type: 'window_blur', severity: 'medium', details: 'Window blurred' })
    const onPaste = (e) => {
      const txt = e.clipboardData?.getData('text') || ''
      if (txt.length > 15) handleCheatingEvent({ event_type: 'copy_paste', severity: 'high', details: `${txt.length} chars pasted` })
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('paste', onPaste)
    }
  }, [session.phase])

  function handleCheatingEvent(event) {
    // if (session.phase !== SESSION_PHASE.ACTIVE) return
    session.recordCheatingEvent(event)
    setCurrentWarning(event)
    clearTimeout(warningTimerRef.current)
    warningTimerRef.current = setTimeout(() => setCurrentWarning(null), 6000)
  }

  const handleSubmitAnswer = useCallback(async ({ answerText: text, answerSource }) => {
    tts.stop()
    await session.submitAnswer({ answerText: text, answerSource })
    setAnswerText('')
    stt.resetTranscript?.()
  }, [session, stt])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && session.phase === SESSION_PHASE.ACTIVE) {
        e.preventDefault()
        handleSubmitAnswer({ answerText, answerSource: 'text' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [answerText, session.phase, handleSubmitAnswer])

  // The AI only starts speaking once the question card has visibly finished
  // sliding/animating in — never simultaneously with the transition.
  const handleQuestionRevealed = useCallback(() => {
    if (!voiceEnabled || !tts.supported) return
    if (session.phase !== SESSION_PHASE.ACTIVE || !session.currentQ) return
    if (spokenForQRef.current === session.currentQIdx) return
    spokenForQRef.current = session.currentQIdx
    tts.speak(session.currentQ.text)
  }, [voiceEnabled, session.phase, session.currentQ, session.currentQIdx, tts])

  const repeatQuestion = () => {
    if (session.currentQ) tts.speak(session.currentQ.text)
  }

  // ── End Practice: custom modal → clean, guaranteed return to Setup ──────
  const requestEndPractice = () => setShowEndConfirm(true)
  const confirmEndPractice = () => {
    setShowEndConfirm(false)
    tts.stop()
    stt.stopListening?.()
    stopCamera()
    fsGate.exitImmersive()
    session.resetSession()
  }

  const diffCfg = DIFF_CONFIG[session.config?.difficulty] || DIFF_CONFIG.medium

  if (session.phase === SESSION_PHASE.SETUP) {
    return <RoleConfigStep onContinue={session.createSession} loading={session.loading} navState={navState} />
  }

  if (session.phase === SESSION_PHASE.BRIEFING) {
    if (briefStep === 'guidelines') {
      return <GuidelinesStep onBack={session.resetSession} onContinue={() => setBriefStep('systemcheck')} />
    }
    return (
      <SystemCheckStep
        videoRef={videoRef} canvasRef={canvasRef} cameraReady={cameraReady} cameraError={cameraError}
        startCamera={startCamera} detectionStatus={detectionStatus} fsGate={fsGate}
        onBack={() => setBriefStep('guidelines')} onComplete={() => session.startSession()}
      />
    )
  }

  if (session.phase === SESSION_PHASE.REPORT) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] px-4 py-6">
        <InterviewReport reportData={session.sessionReport} cheatingData={session.cheatingData} answers={session.answers} onRestart={() => session.resetSession()} />
      </div>
    )
  }

  if (session.phase === SESSION_PHASE.ABORTED) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[440px] w-full bg-white rounded-3xl p-8 border border-blue-100 text-center shadow-[0_20px_40px_-20px_rgba(15,23,42,0.15)]">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-[20px] font-extrabold text-blue-950">Session Ended Early</h2>
          <p className="text-[13px] text-blue-900/55 font-medium mt-2 leading-relaxed">
            Too many integrity flags were raised, so this attempt was closed. You can start a fresh session any time.
          </p>
          <button onClick={() => session.resetSession()} className="w-full h-11 rounded-xl bg-blue-950 text-white font-bold text-[13px] mt-6 hover:bg-blue-900 transition-all">
            Back to Setup
          </button>
        </motion.div>
      </div>
    )
  }

  const q = session.currentQ
  const aiSpeaking = tts.speaking

  return (
    <ImmersiveShell active={fsGate.immersive}>
      <div className="fixed inset-0 z-[999999] w-screen h-screen bg-[#F5F7FB] flex flex-col overflow-hidden">
        <EndPracticeModal open={showEndConfirm} onCancel={() => setShowEndConfirm(false)} onConfirm={confirmEndPractice} />
        <WarningToast warning={currentWarning} count={session.cheatingData?.warning_count} max={MAX_WARNINGS} />

        {/* Top bar */}
        <div className="h-16 bg-white border-b border-blue-100 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#2E9BDA] to-[#1d6fa5] text-white font-black text-[15px] flex items-center justify-center shadow-md shadow-[#2E9BDA]/30">
              C
            </div>
            <div>
              <p className="text-[14px] font-extrabold text-blue-950 leading-tight">
                Career<span className="text-[#1d6fa5]">Shala</span> Live Interview
              </p>
              <p className="text-[11.5px] text-blue-900/45 font-semibold">{session.config?.job_title || 'Technical Assessment'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setVoiceEnabled((v) => { if (v) tts.stop(); return !v })}
              title={voiceEnabled ? 'Mute AI voice' : 'Enable AI voice'}
              className={`h-9 w-9 rounded-xl flex items-center justify-center border transition-all ${voiceEnabled ? 'border-blue-200 text-blue-900/60 hover:border-blue-300' : 'border-amber-300 bg-amber-50 text-amber-600'}`}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <div className="flex items-center gap-2 bg-slate-50 border border-blue-100 rounded-full px-3.5 py-1.5">
              <span className={`h-2 w-2 rounded-full ${aiSpeaking ? 'bg-violet-500' : 'bg-emerald-500'}`} />
              <span className="font-mono text-[12.5px] font-bold text-blue-900/70 tabular-nums">{fmt(session.timeElapsed)}</span>
            </div>

            <button
              onClick={requestEndPractice}
              className="h-9 px-4 rounded-xl bg-white border border-rose-200 text-rose-600 text-[12.5px] font-bold hover:bg-rose-50 transition-all inline-flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Exit Practice
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          <QuestionGridMatrixSidebar currentQIdx={session.currentQIdx} totalQ={session.totalQ} phase={session.phase} answers={session.answers} />

          <div className="flex-1 grid gap-5 p-5 overflow-hidden" style={{ gridTemplateColumns: '1fr 350px' }}>
            <div className="flex flex-col gap-4 min-h-0 h-full">
              <AnimatePresence mode="wait">
                {session.phase === SESSION_PHASE.ACTIVE && q && (
                  <motion.div
                    key={`q-${session.currentQIdx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    onAnimationComplete={handleQuestionRevealed}
                    className="flex flex-col gap-4 flex-1 min-h-0"
                  >
                    <div className="bg-white rounded-3xl border border-blue-100 p-6 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${diffCfg.color} ${diffCfg.bg} ${diffCfg.border}`}>
                          {diffCfg.label.toUpperCase()}
                        </span>
                        <span className="text-[11px] font-bold text-blue-900/40">{(q.category || 'TECHNICAL').toUpperCase()}</span>
                        <span className="ml-auto font-mono text-[11px] text-blue-900/30 font-semibold">Q{session.currentQIdx + 1} / {session.totalQ}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <h1 className="text-[18px] font-bold text-blue-950 leading-relaxed flex-1">{q.text}</h1>
                        {tts.supported && (
                          <button onClick={repeatQuestion} title="Replay question" className="shrink-0 h-8 w-8 rounded-lg border border-blue-200 text-blue-900/40 hover:border-[#2E9BDA] hover:text-[#1d6fa5] flex items-center justify-center transition-all">
                            <Repeat className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <AnswerInput
                      value={answerText} onChange={setAnswerText} onSubmit={handleSubmitAnswer}
                      loading={session.phase === SESSION_PHASE.EVALUATING} questionTimer={session.questionTimer}
                      diffCfg={diffCfg} sttHook={stt} isSpeaking={aiSpeaking}
                    />
                  </motion.div>
                )}

                {session.phase === SESSION_PHASE.FEEDBACK && session.currentEval && (
                  <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0">
                    <FeedbackPanel
                      eval={session.currentEval} question={q} questionNum={session.currentQIdx + 1}
                      isLast={session.isLastQ} onNext={session.nextQuestion} onReattempt={session.reattemptQuestion} loading={session.loading}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right rail: AI avatar + proctoring */}
            <div className="flex flex-col gap-4 h-full min-h-0 overflow-y-auto pr-1">
              <div
                className="relative rounded-3xl overflow-hidden shrink-0 aspect-[16/12] border transition-all duration-500"
                style={{
                  background: 'linear-gradient(160deg, #0B1220, #161225)',
                  borderColor: aiSpeaking ? 'rgba(139,92,246,0.4)' : 'rgba(46,155,218,0.25)',
                  boxShadow: aiSpeaking ? '0 0 0 3px rgba(139,92,246,0.18), 0 20px 40px -20px rgba(139,92,246,0.4)' : '0 10px 30px -15px rgba(0,0,0,0.5)',
                }}
              >
                
                {/* LIVE AVATAR VIDEO */}
                <video 
                  ref={avatarVideoRef}
                  autoPlay
                  loop 
                  muted={true}
                  playsInline
                  crossOrigin="anonymous"
                  onError={(e) => console.warn('[LiveInterview] Avatar video load error:', e)}
                  className="absolute inset-0 w-full h-full object-cover z-0"
                >
                  <source src="/interviewer-avatar.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>

                {/* Note: I added z-10 and z-20 to these overlays so the video doesn't hide them */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-white text-[10px] font-extrabold tracking-wide">LIVE</span>
                </div>

                <div className={`absolute top-3 right-3 z-20 rounded-full px-2.5 py-1 text-[10px] font-bold text-white ${aiSpeaking ? 'bg-violet-500' : 'bg-[#2E9BDA]'}`}>
                  {aiSpeaking ? "AI'S TURN" : 'YOUR TURN'}
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-20 bg-black/35 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                  <p className="text-[12px] font-bold text-slate-100">Alex — AI Interviewer</p>
                  <p className="text-[10.5px] text-slate-400">{session.config?.job_title || 'Technical Assessment'}</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-blue-100 p-4 shrink-0">
                <div className="flex items-center justify-between border-b border-blue-50 pb-2.5 mb-3">
                  <span className="text-[11px] font-extrabold text-blue-900/45 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Proctoring
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-600">● ACTIVE</span>
                </div>
                <DetectionPanel detectionStatus={detectionStatus} videoRef={videoRef} canvasRef={canvasRef} warningCount={session.cheatingData.warning_count} maxWarnings={MAX_WARNINGS} cheatingScore={session.cheatingData.score} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ImmersiveShell>
  )
}