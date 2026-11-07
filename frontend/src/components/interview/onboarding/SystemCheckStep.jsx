import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Mic, Volume2, MonitorCheck, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, RefreshCw, ShieldCheck, User, Smartphone, Monitor,
} from 'lucide-react'
import FlowStepper from './FlowStepper'
import { useTextToSpeech } from '../../../hooks/useSpeech'

const STEPS = ['camera', 'microphone', 'speaker', 'ready']

// ── Real microphone level test — Web Audio AnalyserNode, not a fake timer ──
function useMicLevelTest() {
  const [state, setState] = useState('idle') // idle | requesting | testing | ok | silent | error
  const [level, setLevel] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const ctxRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const peakRef = useRef(0)
  const timeoutRef = useRef(null)
  const lastUpdateRef = useRef(0)

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop() } catch (_) { }
      })
      streamRef.current = null
    }
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      try { ctxRef.current.close().catch(() => { }) } catch (_) { }
      ctxRef.current = null
    }
    setLevel(0)
  }, [])

  const start = useCallback(async () => {
    stop()
    setErrorMsg('')
    setLevel(0)
    peakRef.current = 0
    lastUpdateRef.current = 0
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      setState('testing')

      const tick = () => {
        if (!analyser || !ctxRef.current) return
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const pct = Math.min(100, Math.round((avg / 90) * 100))
        if (pct > peakRef.current) peakRef.current = pct

        // Throttle React state updates to every 100ms (10fps instead of 60fps) to eliminate UI lag
        const now = Date.now()
        if (now - lastUpdateRef.current >= 100) {
          lastUpdateRef.current = now
          setLevel(pct)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      // Give candidate ~4.5s to speak, judge peak, and immediately release hardware
      timeoutRef.current = setTimeout(() => {
        const peak = peakRef.current
        stop()
        setState(peak > 6 ? 'ok' : 'silent')
      }, 4500)
    } catch (e) {
      stop()
      setState('error')
      setErrorMsg(e?.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Could not access microphone.')
    }
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return { state, level, errorMsg, start, stop }
}

export default function SystemCheckStep({
  videoRef,
  canvasRef,
  cameraReady,
  cameraError,
  startCamera,
  detectionStatus,
  fsGate,
  onPrepareAi,
  onBack,
  onComplete,
}) {
  const [step, setStep] = useState('camera')
  const [enteringFs, setEnteringFs] = useState(false)
  const [isWaitingForModels, setIsWaitingForModels] = useState(false)
  const startedRef = useRef(false)

  // Detect mobile: narrow screen OR touch-only (coarse pointer) device
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    const narrowScreen = window.innerWidth < 768
    const touchOnly = window.matchMedia('(pointer: coarse)').matches
    return narrowScreen || touchOnly
  }, [])

  const mic = useMicLevelTest()
  const tts = useTextToSpeech({ rate: 0.95 })
  const [speakerConfirmed, setSpeakerConfirmed] = useState(null) // null | true | false
  const [canSkipAi, setCanSkipAi] = useState(false)

  // Automatically release audio hardware when changing steps
  useEffect(() => {
    if (step !== 'microphone') {
      mic.stop()
    }
    if (step !== 'speaker') {
      tts.stop()
    }
  }, [step, mic, tts])

  // Trigger early background model pre-loading
  useEffect(() => {
    onPrepareAi?.()
  }, [onPrepareAi])

  const allAiReady = Boolean(detectionStatus?.allModelsReady || (detectionStatus?.mpReady && detectionStatus?.tfReady))

  // Camera stream verification — fast, lightweight, 0 AI overhead during onboarding
  const faceOk = Boolean(cameraReady && !cameraError)
  const faceLabel = cameraReady ? 'Camera Feed Active' : cameraError ? 'Camera Error' : 'Connecting Camera...'

  useEffect(() => {
    // Failsafe timer: allow skip if network takes time
    const timer = setTimeout(() => setCanSkipAi(true), 8000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    startCamera?.()
  }, [startCamera])

  const stepIndex = STEPS.indexOf(step)

  const checklist = {
    camera: cameraReady && !cameraError,
    microphone: mic.state === 'ok',
    speaker: speakerConfirmed === true,
  }

  const playSpeakerTest = () => {
    mic.stop()
    tts.stop()
    setSpeakerConfirmed(null)
    if (tts.supported) {
      tts.speak("Hi, this is your AI interviewer. If you can hear this clearly, select 'I heard it' below.")
    } else {
      // Fallback tone for browsers without speech synthesis support
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 440
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1)
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 1.2)
        osc.onended = () => ctx.close()
      } catch { }
    }
  }

  const handleStartClicked = useCallback(() => {
    if (!allAiReady && !canSkipAi) {
      setIsWaitingForModels(true)
      return
    }
    setEnteringFs(true)
    onComplete?.()
  }, [allAiReady, canSkipAi, onComplete])

  useEffect(() => {
    if (isWaitingForModels && allAiReady) {
      setIsWaitingForModels(false)
      setEnteringFs(true)
      onComplete?.()
    }
  }, [isWaitingForModels, allAiReady, onComplete])

  return (
    <div className="w-full relative overflow-hidden text-slate-900 antialiased flex flex-col py-2">
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full bg-[#2E9BDA]/10 blur-3xl" />

      <div className="relative w-full h-full flex flex-col flex-1">

        {/* ⚠️ Mobile warning — shown first, before any other content */}
        {isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-extrabold text-amber-900 leading-tight mb-1">
                  📵 Mobile not supported for Live Interview
                </p>
                <p className="text-[12.5px] text-amber-800/80 font-medium leading-relaxed">
                  Live interviews require a large screen, fullscreen mode, and a front-facing camera — features that work best on a laptop or desktop.
                  Please switch devices to take this interview.
                </p>
                <div className="mt-3 inline-flex items-center gap-2 bg-amber-100 border border-amber-200 rounded-full px-3 py-1.5">
                  <Monitor className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wide">
                    Use a Desktop or Laptop to continue
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-between mb-8 gap-4">
          <FlowStepper current={3} />
          <button
            type="button"
            onClick={onBack}
            className="hidden sm:inline-flex text-[12px] font-bold text-blue-500 hover:text-[#1d6fa5] transition-colors shrink-0"
          >
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left: Live Camera Feed Preview */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between px-1 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Camera Feed</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${faceOk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    <User className="h-3.5 w-3.5" /> {faceLabel}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-[4/3] relative shadow-inner">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover [transform:scaleX(-1)]" />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full [transform:scaleX(-1)]" />
                  {!cameraReady && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                      <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
                    </div>
                  )}
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-4 text-center">
                      <p className="text-rose-300 text-xs font-semibold">{cameraError}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" /> Proctoring Stream Secured
                </span>
                <span className="text-[11px] font-bold text-slate-400">720p HD</span>
              </div>
            </div>
          </div>

          {/* Right: Active System Verification Panel with Integrated Top Stepper */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm flex-1 flex flex-col justify-between min-h-[460px]">
              {/* Integrated Horizontal Step Selector Bar */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/70 mb-6">
                {[
                  { key: 'camera', label: '1. Camera', icon: Camera, done: checklist.camera },
                  { key: 'microphone', label: '2. Microphone', icon: Mic, done: checklist.microphone },
                  { key: 'speaker', label: '3. Speaker', icon: Volume2, done: checklist.speaker },
                ].map((item) => {
                  const isCurrent = step === item.key
                  const isDone = item.done
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (item.key === 'camera' || checklist.camera) {
                          if (item.key !== 'microphone') mic.stop()
                          if (item.key !== 'speaker') tts.stop()
                          setStep(item.key)
                        }
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${isCurrent
                          ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/90'
                          : isDone
                            ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/60 border border-emerald-100'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <item.icon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {/* ── Camera ── */}
                  {step === 'camera' && (
                    <motion.div key="camera" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="space-y-5">
                      <StepHeader icon={Camera} title="Camera Check" desc="We use your webcam to confirm you're present throughout the session." />
                      <StatusRow label="Camera stream" ok={cameraReady && !cameraError} pending={!cameraReady && !cameraError} errorText={cameraError} />
                      <StatusRow label="Face framing" ok={cameraReady && !cameraError} pending={!cameraReady && !cameraError} note={cameraReady ? 'Position your face clearly in the frame.' : ''} />
                      <StepActions
                        onBack={onBack}
                        backLabel="← Back to guidelines"
                        primaryLabel="Continue to microphone"
                        primaryDisabled={!cameraReady || !!cameraError}
                        onPrimary={() => setStep('microphone')}
                        retry={cameraError ? { label: 'Retry camera', onClick: startCamera } : null}
                      />
                    </motion.div>
                  )}

                  {/* ── Microphone ── */}
                  {step === 'microphone' && (
                    <motion.div key="mic" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="space-y-5">
                      <StepHeader icon={Mic} title="Microphone Check" desc="Say a few words out loud — we'll measure your input level in real time." />

                      <div className="rounded-2xl border border-blue-200 bg-slate-50/60 p-5 space-y-4">
                        <div className="flex items-end justify-center gap-1.5 h-16">
                          {Array.from({ length: 14 }).map((_, i) => {
                            const threshold = (i + 1) * (100 / 14)
                            const active = mic.state === 'testing' && mic.level >= threshold
                            return (
                              <motion.span
                                key={i}
                                animate={{ height: active ? `${20 + i * 2.5}%` : '10%', opacity: active ? 1 : 0.25 }}
                                transition={{ duration: 0.12 }}
                                className="w-2 rounded-full bg-gradient-to-t from-[#2E9BDA] to-[#5FC3F0]"
                                style={{ height: '10%' }}
                              />
                            )
                          })}
                        </div>
                        <p className="text-center text-[12.5px] font-semibold text-blue-900/60">
                          {mic.state === 'idle' && 'Click below, then speak normally for a few seconds.'}
                          {mic.state === 'requesting' && 'Requesting microphone access…'}
                          {mic.state === 'testing' && 'Listening — say something like "testing, one two three"…'}
                          {mic.state === 'ok' && 'Great — we picked up your voice clearly.'}
                          {mic.state === 'silent' && "We didn't detect any sound. Check your mic isn't muted."}
                          {mic.state === 'error' && mic.errorMsg}
                        </p>
                        {(mic.state === 'idle' || mic.state === 'silent' || mic.state === 'error') && (
                          <div className="flex justify-center">
                            <button type="button" onClick={mic.start} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-blue-950 text-white text-[13px] font-bold hover:bg-blue-900 transition-all">
                              {mic.state === 'idle' ? 'Start microphone test' : <><RefreshCw className="h-3.5 w-3.5" /> Try again</>}
                            </button>
                          </div>
                        )}
                      </div>

                      <StepActions
                        onBack={() => {
                          mic.stop()
                          setStep('camera')
                        }}
                        backLabel="← Back"
                        primaryLabel="Continue to speaker check"
                        primaryDisabled={mic.state !== 'ok'}
                        onPrimary={() => {
                          mic.stop()
                          setStep('speaker')
                        }}
                        skip={mic.state !== 'ok' ? {
                          label: "Having trouble? Skip this check",
                          onClick: () => {
                            mic.stop()
                            setStep('speaker')
                          }
                        } : null}
                      />
                    </motion.div>
                  )}

                  {/* ── Speaker ── */}
                  {step === 'speaker' && (
                    <motion.div key="speaker" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="space-y-5">
                      <StepHeader icon={Volume2} title="Speaker Check" desc="Play a short test clip to confirm you can hear the AI interviewer." />

                      <div className="rounded-2xl border border-blue-200 bg-slate-50/60 p-6 flex flex-col items-center gap-4 text-center">
                        <motion.div
                          animate={tts.speaking ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                          transition={{ duration: 0.9, repeat: tts.speaking ? Infinity : 0 }}
                          className={`h-14 w-14 rounded-2xl flex items-center justify-center ${tts.speaking ? 'bg-[#2E9BDA] text-white shadow-lg shadow-[#2E9BDA]/30' : 'bg-[#2E9BDA]/10 text-[#1d6fa5]'}`}
                        >
                          <Volume2 className="h-6 w-6" />
                        </motion.div>
                        <p className="text-[13px] font-semibold text-blue-900/60 max-w-sm">
                          {tts.speaking ? 'Playing test audio…' : 'Click play, then confirm whether you heard it.'}
                        </p>
                        <button type="button" onClick={playSpeakerTest} disabled={tts.speaking} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-blue-950 text-white text-[13px] font-bold hover:bg-blue-900 disabled:opacity-40 transition-all">
                          {tts.speaking ? 'Playing…' : 'Play test sound'}
                        </button>

                        {!tts.speaking && (
                          <div className="flex items-center gap-3 pt-1">
                            <button type="button" onClick={() => setSpeakerConfirmed(true)} className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[12.5px] font-bold border transition-all ${speakerConfirmed === true ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>
                              <CheckCircle2 className="h-4 w-4" /> I heard it
                            </button>
                            <button type="button" onClick={() => setSpeakerConfirmed(false)} className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[12.5px] font-bold border transition-all ${speakerConfirmed === false ? 'bg-rose-600 border-rose-600 text-white' : 'border-rose-300 text-rose-700 hover:bg-rose-50'}`}>
                              I didn't hear anything
                            </button>
                          </div>
                        )}
                        {speakerConfirmed === false && (
                          <p className="text-[11.5px] text-rose-600 font-medium max-w-sm">
                            Check your system volume and output device, then play the test sound again.
                          </p>
                        )}
                      </div>

                      <StepActions
                        onBack={() => {
                          tts.stop()
                          setStep('microphone')
                        }}
                        backLabel="← Back"
                        primaryLabel="Continue"
                        primaryDisabled={speakerConfirmed !== true}
                        onPrimary={() => {
                          tts.stop()
                          setStep('ready')
                        }}
                        skip={speakerConfirmed !== true ? {
                          label: 'Skip this check',
                          onClick: () => {
                            tts.stop()
                            setStep('ready')
                          }
                        } : null}
                      />
                    </motion.div>
                  )}

                  {/* ── Ready ── */}
                  {step === 'ready' && (
                    <motion.div key="ready" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-6 text-center">
                      <div className={`h-14 w-14 mx-auto rounded-2xl flex items-center justify-center border transition-all ${
                        allAiReady ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-[#1d6fa5] border-blue-100'
                      }`}>
                        {allAiReady ? <CheckCircle2 className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin text-[#2E9BDA]" />}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-[20px] font-extrabold text-blue-950">
                          {allAiReady ? "You're all set" : "Activating AI Proctoring Engines"}
                        </h3>
                        <p className="text-[13.5px] text-blue-900/55 font-medium max-w-md mx-auto leading-relaxed">
                          {allAiReady
                            ? "Camera, microphone, and AI proctoring engines are verified and 100% active. Clicking below will enter full-screen mode and start your interview."
                            : "Please wait a moment while facial tracking and object detection engines initialize in your browser. Entering full-screen is held until all engines are active."}
                        </p>
                      </div>

                      {/* Engine activation status checklist */}
                      <div className="max-w-md mx-auto w-full bg-slate-50 border border-blue-100 rounded-2xl p-4 text-[12px] space-y-2 text-left font-semibold text-blue-950">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Camera &amp; Microphone
                          </span>
                          <span className="text-emerald-700 font-bold text-[10.5px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            VERIFIED
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {detectionStatus?.mpReady ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Loader2 className="w-4 h-4 text-[#2E9BDA] animate-spin" />
                            )}
                            Face Landmark &amp; Gaze Tracking (MediaPipe)
                          </span>
                          <span className={`font-bold text-[10.5px] px-2 py-0.5 rounded-full border ${
                            detectionStatus?.mpReady
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-[#1d6fa5] bg-blue-50 border-blue-200 animate-pulse'
                          }`}>
                            {detectionStatus?.mpReady ? 'READY' : 'INITIALIZING...'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {detectionStatus?.tfReady ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Loader2 className="w-4 h-4 text-[#2E9BDA] animate-spin" />
                            )}
                            Prohibited Object Detection (COCO-SSD)
                          </span>
                          <span className={`font-bold text-[10.5px] px-2 py-0.5 rounded-full border ${
                            detectionStatus?.tfReady
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-[#1d6fa5] bg-blue-50 border-blue-200 animate-pulse'
                          }`}>
                            {detectionStatus?.tfReady ? 'READY' : 'INITIALIZING...'}
                          </span>
                        </div>
                      </div>

                      <motion.button
                        type="button"
                        whileHover={allAiReady && !enteringFs && !isMobile ? { scale: 1.02 } : {}}
                        whileTap={allAiReady && !enteringFs && !isMobile ? { scale: 0.98 } : {}}
                        onClick={handleStartClicked}
                        disabled={enteringFs || isMobile || (!allAiReady && !canSkipAi)}
                        title={isMobile ? 'Switch to a desktop or laptop to start the interview' : undefined}
                        className={`inline-flex items-center gap-2 h-[52px] px-8 rounded-2xl text-[14px] font-bold shadow-lg transition-all ${
                          isMobile
                            ? 'bg-amber-200 text-amber-800 border-2 border-amber-300 cursor-not-allowed shadow-none'
                            : !allAiReady && !canSkipAi
                            ? 'bg-blue-100 text-blue-400 border border-blue-200 cursor-not-allowed shadow-none'
                            : enteringFs || isWaitingForModels
                            ? 'bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white opacity-90 shadow-[#2E9BDA]/25'
                            : 'bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white shadow-[#2E9BDA]/25 cursor-pointer'
                        }`}
                      >
                        {isMobile ? (
                          <><Smartphone className="h-4 w-4" /> Not available on mobile</>
                        ) : enteringFs || isWaitingForModels ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> {allAiReady ? 'Entering Full-Screen...' : 'Activating Models… Launching Shortly'}</>
                        ) : !allAiReady && !canSkipAi ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Activating AI Engines… Please wait</>
                        ) : (
                          <><MonitorCheck className="h-4 w-4" /> Enter Full-Screen &amp; Start Interview</>
                        )}
                      </motion.button>

                      {canSkipAi && !allAiReady && (
                        <div>
                          <button
                            type="button"
                            onClick={() => { setEnteringFs(true); onComplete?.(); }}
                            className="text-[11.5px] font-semibold text-blue-400 hover:text-blue-600 underline underline-offset-2"
                          >
                            Network taking time? Proceed with core proctoring →
                          </button>
                        </div>
                      )}

                      {isMobile && (
                        <p className="text-[11.5px] text-amber-700 font-semibold">
                          Please open this page on a laptop or desktop to start the interview.
                        </p>
                      )}
                      <button type="button" onClick={() => setStep('speaker')} className="block mx-auto text-[12px] font-bold text-blue-400 hover:text-[#1d6fa5] transition-colors">
                        ← Re-check speaker
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  )
}

// ── Small shared pieces ──────────────────────────────────────────────────
function StepHeader({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-4">
      <div className="h-11 w-11 shrink-0 rounded-2xl bg-[#2E9BDA]/10 text-[#1d6fa5] flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-[18px] font-extrabold text-blue-950">{title}</h3>
        <p className="text-[13px] text-blue-900/55 font-medium mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

function StatusRow({ label, ok, pending, errorText, note }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${ok ? 'border-emerald-200 bg-emerald-50/60' : errorText ? 'border-rose-200 bg-rose-50/60' : 'border-blue-200 bg-slate-50/60'}`}>
      <div>
        <p className="text-[13px] font-bold text-blue-950">{label}</p>
        {errorText && <p className="text-[11.5px] text-rose-600 font-semibold mt-0.5">{errorText}</p>}
        {note && <p className="text-[11.5px] text-amber-600 font-semibold mt-0.5">{note}</p>}
      </div>
      {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : pending ? <Loader2 className="h-5 w-5 text-blue-400 animate-spin" /> : <AlertCircle className="h-5 w-5 text-rose-500" />}
    </div>
  )
}

function StepActions({ onBack, backLabel, primaryLabel, primaryDisabled, onPrimary, retry, skip }) {
  return (
    <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <button type="button" onClick={onBack} className="text-[12.5px] font-bold text-blue-500 hover:text-[#1d6fa5] transition-colors">
        {backLabel}
      </button>
      <div className="flex items-center gap-3">
        {retry && (
          <button type="button" onClick={retry.onClick} className="text-[12.5px] font-bold text-blue-500 hover:text-[#1d6fa5] transition-colors">
            {retry.label}
          </button>
        )}
        {skip && (
          <button type="button" onClick={skip.onClick} className="text-[11.5px] font-semibold text-blue-400 hover:text-blue-600 transition-colors underline underline-offset-2">
            {skip.label}
          </button>
        )}
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white text-[13px] font-bold shadow-md shadow-[#2E9BDA]/20 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          {primaryLabel} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}