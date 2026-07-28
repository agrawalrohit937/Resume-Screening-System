import { useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Mic, Eye, Clock4, ShieldAlert, RotateCcw, MonitorCheck, Sparkles, ArrowRight, ShieldCheck, Volume2, BookOpen, ChevronRight } from 'lucide-react'
import FlowStepper from '../components/interview/onboarding/FlowStepper'

const RULES = [
  { icon: MonitorCheck, title: 'Full-screen mode required', desc: 'The interview runs entirely in full-screen. Switching tabs or leaving full-screen will be recorded as a distraction warning.' },
  { icon: Camera, title: 'Stay clearly on camera', desc: 'Keep your face inside the frame. The system continuously confirms visibility throughout the session.' },
  { icon: Mic, title: 'Answer out loud or by typing', desc: 'Speak into your microphone or type your answers. You can switch methods at any time.' },
  { icon: Eye, title: 'Keep your focus on the screen', desc: 'Avoid looking away for long periods, using a second device, or having another person in frame.' },
  { icon: Clock4, title: 'Questions are individually timed', desc: 'A visible timer counts down based on your chosen mode. Questions auto-submit when the clock hits zero.' },
  { icon: RotateCcw, title: 'One retry option per question', desc: 'Made a mistake? You can instantly restart and re-record your answer once per question.' },
  { icon: ShieldAlert, title: 'Three warnings ends the session', desc: 'Repeated flags for switching tabs, missing camera, or other violations end the practice session early.', isCritical: true },
]

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] } }),
}

export default function GuidelinesStep({ onBack, onContinue }) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div className="min-h-screen w-full bg-[#FAFBFC] relative overflow-hidden text-blue-950 antialiased selection:bg-blue-500/10">
      <div className="pointer-events-none absolute -top-32 -left-32 h-[440px] w-[440px] rounded-full bg-[#2E9BDA]/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <FlowStepper current={2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left column: header + "what's next" timeline + tip — filled deliberately, no dead space */}
          <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp} className="lg:col-span-4 lg:sticky lg:top-8 space-y-4">
            <div className="bg-white border border-blue-200/70 rounded-3xl p-6 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#2E9BDA]/10 border border-[#2E9BDA]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1d6fa5]">
                <ShieldCheck className="h-3.5 w-3.5" /> Step 2 of 3
              </div>
              <div className="space-y-2">
                <h1 className="text-[30px] sm:text-[34px] font-extrabold tracking-[-0.02em] leading-[1.05] text-blue-950">
                  A few ground rules.
                </h1>
                <p className="text-[14px] leading-relaxed text-blue-900/60 font-medium">
                  Quick read — these keep the practice session realistic and your feedback trustworthy.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-900/55 bg-slate-50 border border-blue-100 rounded-full px-2.5 py-1">
                  <BookOpen className="h-3 w-3" /> 7 rules
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-900/55 bg-slate-50 border border-blue-100 rounded-full px-2.5 py-1">
                  <Clock4 className="h-3 w-3" /> ~1 min read
                </span>
              </div>
            </div>

            {/* What's next — real information, not decoration: sets expectations for the next screen */}
            <div className="bg-white border border-blue-200/70 rounded-3xl p-6 sm:p-7">
              <span className="text-[11px] font-extrabold text-blue-900/40 uppercase tracking-wider">Up next: system check</span>
              <div className="mt-4">
                {[
                  { icon: Camera, label: 'Camera', desc: 'Live preview & face framing check' },
                  { icon: Mic, label: 'Microphone', desc: 'Real-time voice level test' },
                  { icon: Volume2, label: 'Speaker', desc: 'Play a clip and confirm you hear it' },
                ].map((item, i, arr) => (
                  <div key={item.label} className="flex gap-3.5 relative pb-6 last:pb-0">
                    {i !== arr.length - 1 && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-blue-100" />}
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-[#2E9BDA]/10 text-[#1d6fa5] flex items-center justify-center relative z-10">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-blue-950">{item.label}</p>
                      <p className="text-[12px] text-blue-900/50 font-medium leading-snug">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#1d6fa5] pt-1">
                Then you're straight into the room <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-950 to-[#0B1220] text-white rounded-2xl p-5 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-[#5FC3F0] shrink-0 mt-0.5" />
              <p className="text-[12px] font-medium leading-relaxed text-blue-100/70">
                Each check runs live on your own camera and mic — not a static checkbox — so nothing surprises you once the interview starts.
              </p>
            </div>
          </motion.div>

          {/* Right: rules list */}
          <div className="lg:col-span-8 space-y-3">
            {RULES.map((rule, i) => {
              const Icon = rule.icon
              return (
                <motion.div
                  key={rule.title}
                  initial="hidden" animate="show" custom={i + 1} variants={fadeUp}
                  className={`flex items-start gap-4 p-4 sm:p-5 rounded-2xl border transition-colors ${
                    rule.isCritical ? 'border-rose-200 bg-rose-50/50' : 'border-blue-200/70 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${rule.isCritical ? 'bg-rose-100 text-rose-600' : 'bg-[#2E9BDA]/10 text-[#1d6fa5]'}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <p className={`text-[14px] font-bold ${rule.isCritical ? 'text-rose-900' : 'text-blue-950'}`}>{rule.title}</p>
                    <p className={`text-[13px] leading-relaxed mt-0.5 ${rule.isCritical ? 'text-rose-700/80' : 'text-blue-900/55'} font-medium`}>{rule.desc}</p>
                  </div>
                </motion.div>
              )
            })}

            <motion.label
              initial="hidden" animate="show" custom={RULES.length + 1} variants={fadeUp}
              className={`flex cursor-pointer items-start gap-3.5 rounded-2xl p-4 transition-all border mt-2 ${
                agreed ? 'border-[#2E9BDA] bg-[#2E9BDA]/[0.06] ring-2 ring-[#2E9BDA]/15' : 'border-blue-200 bg-white hover:border-blue-400'
              }`}
            >
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer rounded border-blue-300 text-[#2E9BDA] accent-[#2E9BDA]" />
              <span className="text-[13px] font-semibold text-blue-950 select-none">
                I understand these rules and I'm ready to verify my camera, microphone, and speakers.
              </span>
            </motion.label>

            <motion.div
              initial="hidden" animate="show" custom={RULES.length + 2} variants={fadeUp}
              className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <button type="button" onClick={onBack} className="text-[13px] font-bold text-blue-500 hover:text-[#1d6fa5] transition-colors py-2 text-center">
                ← Back to setup
              </button>
              <motion.button
                type="button"
                whileHover={{ scale: agreed ? 1.02 : 1 }}
                whileTap={{ scale: agreed ? 0.98 : 1 }}
                disabled={!agreed}
                onClick={onContinue}
                className="w-full sm:w-auto inline-flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] px-8 text-[14px] font-bold text-white shadow-lg shadow-[#2E9BDA]/25 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:shadow-none"
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