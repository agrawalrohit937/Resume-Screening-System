import { useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Mic, Eye, Clock4, ShieldAlert, RotateCcw, MonitorCheck, Sparkles, ArrowRight, ShieldCheck, Volume2, BookOpen, ChevronRight } from 'lucide-react'
import FlowStepper from '../components/interview/onboarding/FlowStepper'

const RULES = [
  { icon: MonitorCheck, title: 'Full-screen required', desc: 'Leaving full-screen will be recorded as a distraction warning.' },
  { icon: Camera, title: 'Stay on camera', desc: 'Keep your face in frame. The system confirms visibility continuously.' },
  { icon: Mic, title: 'Speak or type', desc: 'Answer out loud or by typing. Switch methods at any time.' },
  { icon: Eye, title: 'Maintain focus', desc: 'Avoid looking away, using phones, or having others in frame.' },
  { icon: Clock4, title: 'Questions are timed', desc: 'A timer counts down. Questions auto-submit when time is up.' },
  { icon: RotateCcw, title: 'One retry option', desc: 'Made a mistake? You can restart your answer once per question.' },
  { icon: ShieldAlert, title: 'Three warnings ends the session', desc: 'Repeated flags for tab switching or missing camera will end practice early.', isCritical: true },
]

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] } }),
}

export default function GuidelinesStep({ onBack, onContinue }) {
  const [agreed, setAgreed] = useState(false)

  return (
    // Added negative margins (-m-4 md:-m-6 lg:-m-8) to pull the background over the parent layout's padding
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-[calc(100vh-80px)] bg-[#FAFBFC] relative overflow-hidden text-blue-950 antialiased flex flex-col justify-center">
      
      {/* Ambient backdrop glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[440px] w-[440px] rounded-full bg-[#2E9BDA]/10 blur-3xl" />

      <div className="relative mx-auto max-w-[1150px] w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <FlowStepper current={2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* ── LEFT PANEL (Unified Card) ── */}
          <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp} className="lg:col-span-5 h-full">
            <div className="bg-white border border-blue-100 rounded-[28px] p-7 shadow-sm flex flex-col h-full justify-between">
              
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#1d6fa5] mb-5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Step 2 of 3
                </div>
                <h1 className="text-[30px] font-extrabold tracking-tight leading-[1.1] text-blue-950 mb-2">
                  A few ground rules.
                </h1>
                <p className="text-[13.5px] leading-relaxed text-blue-900/60 font-medium mb-4">
                  Quick read — these keep the practice session realistic and your feedback trustworthy.
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-900/55 bg-slate-50 border border-blue-100 rounded-full px-2.5 py-1">
                    <BookOpen className="h-3 w-3" /> 7 rules
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-900/55 bg-slate-50 border border-blue-100 rounded-full px-2.5 py-1">
                    <Clock4 className="h-3 w-3" /> ~1 min read
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <span className="text-[10px] font-extrabold text-blue-900/40 uppercase tracking-widest mb-4 block">Up next: System Check</span>
                <div className="space-y-0 relative">
                  {[
                    { icon: Camera, label: 'Camera', desc: 'Live face framing check' },
                    { icon: Mic, label: 'Microphone', desc: 'Real-time voice level test' },
                    { icon: Volume2, label: 'Speaker', desc: 'Confirm audio output' },
                  ].map((item, i, arr) => (
                    <div key={item.label} className="flex gap-3.5 relative pb-4 last:pb-0">
                      {i !== arr.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-[2px] bg-blue-50" />}
                      <div className="h-7 w-7 shrink-0 rounded-lg bg-blue-50 text-[#1d6fa5] flex items-center justify-center relative z-10">
                        <item.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[12.5px] font-bold text-blue-950 leading-none">{item.label}</p>
                        <p className="text-[11px] text-blue-900/50 font-medium mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 bg-[#F0F7FF] border border-[#2E9BDA]/20 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-[#2E9BDA] shrink-0 mt-0.5" />
                <p className="text-[11.5px] font-medium leading-relaxed text-[#1d6fa5]/80">
                  Each check runs live on your own camera and mic — nothing surprises you once the interview starts.
                </p>
              </div>

            </div>
          </motion.div>

          {/* ── RIGHT PANEL (2-Column Rules Grid) ── */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {RULES.slice(0, 6).map((rule, i) => {
                const Icon = rule.icon
                return (
                  <motion.div
                    key={rule.title}
                    initial="hidden" animate="show" custom={i + 1} variants={fadeUp}
                    className="flex flex-col gap-2 p-3.5 rounded-2xl border border-blue-100 bg-white hover:border-blue-200 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-blue-50 text-[#1d6fa5] flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-[12.5px] font-bold text-blue-950 leading-tight">{rule.title}</p>
                    </div>
                    <p className="text-[11px] leading-relaxed text-blue-900/55 font-medium pl-10.5">{rule.desc}</p>
                  </motion.div>
                )
              })}
            </div>

            <motion.div
              initial="hidden" animate="show" custom={7} variants={fadeUp}
              className="flex items-center gap-3.5 p-4 rounded-2xl border border-rose-200 bg-rose-50/50 mb-4 shadow-sm"
            >
              <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-rose-100 text-rose-600">
                <ShieldAlert className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-rose-900">{RULES[6].title}</p>
                <p className="text-[11.5px] leading-relaxed mt-0.5 text-rose-700/80 font-medium">{RULES[6].desc}</p>
              </div>
            </motion.div>

            <motion.label
              initial="hidden" animate="show" custom={8} variants={fadeUp}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl p-4 transition-all border shadow-sm ${
                agreed ? 'border-[#2E9BDA] bg-[#2E9BDA]/[0.06]' : 'border-blue-100 bg-white hover:border-blue-300'
              }`}
            >
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 cursor-pointer rounded border-blue-300 text-[#2E9BDA] accent-[#2E9BDA]" />
              <span className="text-[12.5px] font-bold text-blue-950 select-none">
                I understand these rules and I'm ready to verify my setup.
              </span>
            </motion.label>

            <motion.div
              initial="hidden" animate="show" custom={9} variants={fadeUp}
              className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-auto"
            >
              <button type="button" onClick={onBack} className="text-[12.5px] font-bold text-blue-400 hover:text-[#1d6fa5] transition-colors py-2">
                ← Back to setup
              </button>
              <motion.button
                type="button"
                whileHover={{ scale: agreed ? 1.02 : 1 }}
                whileTap={{ scale: agreed ? 0.98 : 1 }}
                disabled={!agreed}
                onClick={onContinue}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] px-8 text-[13.5px] font-bold text-white shadow-md shadow-[#2E9BDA]/20 transition-all disabled:opacity-40 disabled:shadow-none"
              >
                Go to system check <ArrowRight className="h-4 w-4" />
              </motion.button>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}