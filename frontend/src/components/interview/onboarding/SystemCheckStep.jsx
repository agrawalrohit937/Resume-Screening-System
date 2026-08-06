import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Mic, Volume2, MonitorCheck, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, RefreshCw, ShieldCheck, User,
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

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    clearTimeout(timeoutRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => { })
    streamRef.current = null
    ctxRef.current = null
  }, [])

  const start = useCallback(async () => {
    stop()
    setErrorMsg('')
    setLevel(0)
    peakRef.current = 0
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.6
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      setState('testing')

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const pct = Math.min(100, Math.round((avg / 90) * 100))
        setLevel(pct)
        if (pct > peakRef.current) peakRef.current = pct
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      // Give the person ~4.5s to make some noise, then judge from the peak.
      timeoutRef.current = setTimeout(() => {
        cancelAnimationFrame(rafRef.current)
        setState(peakRef.current > 6 ? 'ok' : 'silent')
      }, 4500)
    } catch (e) {
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
  onBack,
  onComplete,
}) {
  const [step, setStep] = useState('camera')
  const [enteringFs, setEnteringFs] = useState(false)
  const startedRef = useRef(false)

  const mic = useMicLevelTest()
  const tts = useTextToSpeech({ rate: 0.95 })
  const [speakerConfirmed, setSpeakerConfirmed] = useState(null) // null | true | false

  const faceCount = detectionStatus?.faceCount ?? 0
  const faceLabel = faceCount === 0 ? 'No face detected yet' : faceCount === 1 ? 'Face detected' : 'Multiple faces detected'
  const faceOk = faceCount === 1

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

  const handleEnterAndStart = async () => {
    setEnteringFs(true)
    await fsGate?.enterImmersive?.()
    setEnteringFs(false)
    onComplete?.()
  }

  return (
    <div className="min-h-screen w-full bg-[#FAFBFC] relative overflow-hidden text-blue-950 antialiased">
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full bg-[#2E9BDA]/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left: persistent live preview + checklist */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-8">
            <div className="bg-white border border-blue-200/70 rounded-3xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between px-1.5 pb-3">
                <span className="text-[11px] font-bold text-blue-900/50 uppercase tracking-wider">Live Preview</span>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${faceOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <User className="h-3.5 w-3.5" /> {faceLabel}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-blue-100 bg-blue-950 aspect-[4/3] relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover [transform:scaleX(-1)]" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full [transform:scaleX(-1)]" />
                {!cameraReady && !cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-950/70 backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-950/85 p-4 text-center">
                    <p className="text-rose-300 text-[12px] font-semibold">{cameraError}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-950 to-[#0B1220] text-white rounded-2xl p-5 space-y-2.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-white/10">
                <ShieldCheck className="h-4 w-4 text-[#5FC3F0]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Setup Checklist</span>
              </div>
              {[
                ['camera', 'Camera', Camera],
                ['microphone', 'Microphone', Mic],
                ['speaker', 'Speaker', Volume2],
              ].map(([key, label, Icon]) => (
                <div key={key} className={`flex items-center justify-between rounded-xl px-3 py-2 border text-[12px] font-mono font-semibold transition-colors ${checklist[key] ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : step === key ? 'bg-white/10 border-white/20 text-white' : 'bg-white/[0.03] border-white/10 text-blue-300'
                  }`}>
                  <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span>
                  {checklist[key] ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[10px] uppercase tracking-wider opacity-60">{step === key ? 'Checking' : 'Pending'}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Right: active step panel */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-blue-200/70 rounded-3xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-h-[420px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {/* ── Camera ── */}
                {step === 'camera' && (
                  <motion.div key="camera" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="space-y-5">
                    <StepHeader icon={Camera} title="Camera Check" desc="We use your webcam to confirm you're present throughout the session." />
                    <StatusRow label="Camera stream" ok={cameraReady && !cameraError} pending={!cameraReady && !cameraError} errorText={cameraError} />
                    <StatusRow label="Face framing" ok={faceOk} pending={cameraReady && !faceOk} note={!faceOk && cameraReady ? 'Center your face in the frame with good lighting.' : ''} />
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
                      onBack={() => setStep('camera')}
                      backLabel="← Back"
                      primaryLabel="Continue to speaker check"
                      primaryDisabled={mic.state !== 'ok'}
                      onPrimary={() => setStep('speaker')}
                      skip={mic.state !== 'ok' ? { label: "Having trouble? Skip this check", onClick: () => setStep('speaker') } : null}
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
                      onBack={() => setStep('microphone')}
                      backLabel="← Back"
                      primaryLabel="Continue"
                      primaryDisabled={speakerConfirmed !== true}
                      onPrimary={() => setStep('ready')}
                      skip={speakerConfirmed !== true ? { label: 'Skip this check', onClick: () => setStep('ready') } : null}
                    />
                  </motion.div>
                )}

                {/* ── Ready ── */}
                {step === 'ready' && (
                  <motion.div key="ready" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-6 text-center">
                    <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-[20px] font-extrabold text-blue-950">You're all set</h3>
                      <p className="text-[13.5px] text-blue-900/55 font-medium max-w-md mx-auto leading-relaxed">
                        Camera, microphone, and speakers are verified. The interview runs in full-screen — clicking below will switch you into the interview room and start monitoring.
                      </p>
                    </div>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleEnterAndStart}
                      disabled={enteringFs}
                      className="inline-flex items-center gap-2 h-[52px] px-8 rounded-2xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white text-[14px] font-bold shadow-lg shadow-[#2E9BDA]/25 disabled:opacity-60 transition-all"
                    >
                      {enteringFs ? <><Loader2 className="h-4 w-4 animate-spin" /> Entering full-screen…</> : <><MonitorCheck className="h-4 w-4" /> Enter Full-Screen & Start</>}
                    </motion.button>
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