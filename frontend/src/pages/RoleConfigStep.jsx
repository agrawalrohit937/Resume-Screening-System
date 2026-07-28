import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, Sliders, Layers, Disc, Sparkles, ArrowRight, Zap, Target, Crosshair, Rocket } from 'lucide-react'
import FlowStepper from '../components/interview/onboarding/FlowStepper'

const DIFFICULTIES = [
  { id: 'easy', label: 'Standard', sub: 'Warm-up pace', time: 2, icon: Target },
  { id: 'medium', label: 'Advanced', sub: 'Realistic pace', time: 3, icon: Crosshair },
  { id: 'hard', label: 'Executive', sub: 'High pressure', time: 4, icon: Rocket },
]

const INTERVIEW_TYPES = [
  { id: 'mixed', label: 'All-in-One', desc: 'A balanced mix of technical, experience, and workplace scenario questions.' },
  { id: 'technical', label: 'Technical Core', desc: 'Deep dive into core skills, engineering concepts, and hands-on execution.' },
  { id: 'behavioral', label: 'Behavioral', desc: 'Past projects, teamwork dynamics, communication, and leadership.' },
  { id: 'situational', label: 'Situational', desc: 'How you respond to real-time challenges and critical incidents.' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] } }),
}

export default function RoleConfigStep({ onContinue, loading, navState }) {
  const [form, setForm] = useState({
    job_title: navState?.job_title || '',
    difficulty: 'medium',
    interview_type: 'mixed',
    num_questions: 8,
  })
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (navState?.job_title) setForm((f) => ({ ...f, job_title: navState.job_title }))
  }, [navState])

  const selectedDiff = DIFFICULTIES.find((d) => d.id === form.difficulty)
  const etaMin = Math.round(form.num_questions * (selectedDiff?.time || 3))
  const isFormValid = form.job_title.trim().length > 1

  return (
    <div className="min-h-screen w-full bg-[#FAFBFC] relative overflow-hidden text-blue-950 antialiased selection:bg-blue-500/10">
      {/* Ambient backdrop glow — sets the "this is a live simulator" tone without being loud */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-[#2E9BDA]/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-32 h-[360px] w-[360px] rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp} className="mb-8">
          <FlowStepper current={1} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left: hero + live summary */}
          <motion.div
            initial="hidden" animate="show" custom={1} variants={fadeUp}
            className="lg:col-span-4 space-y-4 lg:sticky lg:top-8"
          >
            <div className="bg-white border border-blue-200/70 rounded-3xl p-6 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#2E9BDA]/10 border border-[#2E9BDA]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1d6fa5]">
                <Zap className="h-3.5 w-3.5" /> Step 1 of 3
              </div>

              <div className="space-y-2.5">
                <h1 className="text-[32px] sm:text-[38px] font-extrabold tracking-[-0.02em] text-blue-950 leading-[1.05]">
                  Build your <span className="bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] bg-clip-text text-transparent">mock interview.</span>
                </h1>
                <p className="text-[14px] leading-relaxed text-blue-900/60 font-medium">
                  Tell us the role and pace you want. The AI interviewer adapts its questions and difficulty in real time to match.
                </p>
              </div>

              <div className="border-t border-blue-100 pt-5 space-y-3">
                {[
                  ['Questions', `${form.num_questions}`],
                  ['Est. duration', `~${etaMin} min`],
                  ['Track', INTERVIEW_TYPES.find((t) => t.id === form.interview_type)?.label],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center text-[13px]">
                    <span className="text-blue-900/50 font-semibold">{label}</span>
                    <span className="font-mono font-bold text-blue-950 tabular-nums">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-950 to-[#0B1220] text-white rounded-2xl p-5 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-[#5FC3F0] shrink-0 mt-0.5" />
              <p className="text-[12px] font-medium leading-relaxed text-blue-100/70">
                Everything below updates live — try a few combinations until the practice mix feels right for you.
              </p>
            </div>
          </motion.div>

          {/* Right: form */}
          <div className="lg:col-span-8 space-y-5">
            <motion.div
              initial="hidden" animate="show" custom={2} variants={fadeUp}
              className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all ${focused ? 'border-[#2E9BDA] ring-2 ring-[#2E9BDA]/15' : 'border-blue-200/70'}`}
            >
              <div className="flex items-center gap-2 text-[#1d6fa5] font-bold text-[11px] tracking-wider uppercase mb-3">
                <Briefcase className="h-4 w-4" />
                <span>What role are you interviewing for?</span>
              </div>
              <input
                type="text"
                value={form.job_title}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                placeholder="e.g. Senior Software Engineer"
                className="w-full bg-transparent text-[20px] sm:text-[22px] font-bold text-blue-950 outline-none placeholder:text-blue-200 placeholder:font-semibold"
              />
              <div className={`mt-3 h-[2px] rounded-full transition-all duration-300 ${focused ? 'bg-[#2E9BDA]' : 'bg-blue-100'}`} />
            </motion.div>

            <motion.div initial="hidden" animate="show" custom={3} variants={fadeUp} className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#1d6fa5] font-bold text-[11px] tracking-wider uppercase pl-1">
                <Layers className="h-4 w-4" />
                <span>Choose your interview type</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {INTERVIEW_TYPES.map((t) => {
                  const active = form.interview_type === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, interview_type: t.id }))}
                      className={`group flex flex-col p-4 text-left rounded-2xl border transition-all duration-200 ${
                        active ? 'border-[#2E9BDA] bg-[#2E9BDA]/[0.06] ring-2 ring-[#2E9BDA]/20 shadow-sm' : 'border-blue-200/70 bg-white hover:border-blue-300 hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between mb-1.5">
                        <span className="text-[14px] font-bold text-blue-950">{t.label}</span>
                        <div className={`h-4.5 w-4.5 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active ? 'border-[#2E9BDA] bg-[#2E9BDA]' : 'border-blue-300 group-hover:border-blue-400'}`}>
                          {active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span className="text-[12.5px] font-medium text-blue-900/55 leading-relaxed">{t.desc}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            <motion.div initial="hidden" animate="show" custom={4} variants={fadeUp} className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#1d6fa5] font-bold text-[11px] tracking-wider uppercase pl-1">
                <Sliders className="h-4 w-4" />
                <span>Select difficulty level</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {DIFFICULTIES.map((d) => {
                  const active = form.difficulty === d.id
                  const Icon = d.icon
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, difficulty: d.id }))}
                      className={`relative overflow-hidden py-3.5 px-3 rounded-2xl text-center border transition-all duration-200 ${
                        active ? 'border-transparent bg-gradient-to-br from-[#2E9BDA] to-[#1d6fa5] text-white shadow-lg shadow-[#2E9BDA]/25 scale-[1.02]' : 'border-blue-200/70 bg-white text-blue-900/70 hover:border-blue-300'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mx-auto mb-1.5 ${active ? 'text-white' : 'text-[#2E9BDA]'}`} />
                      <span className="block text-[13px] font-bold">{d.label}</span>
                      <span className={`block text-[10px] font-medium mt-0.5 ${active ? 'text-blue-50/80' : 'text-blue-900/40'}`}>{d.sub}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            <motion.div initial="hidden" animate="show" custom={5} variants={fadeUp} className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#1d6fa5] font-bold text-[11px] tracking-wider uppercase pl-1">
                <Disc className="h-4 w-4" />
                <span>Number of questions</span>
              </div>
              <div className="bg-white border border-blue-200/70 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5 flex items-center justify-between border border-blue-200 rounded-2xl p-1.5 bg-slate-50/60">
                  <button
                    type="button"
                    disabled={form.num_questions <= 3}
                    onClick={() => setForm((f) => ({ ...f, num_questions: Math.max(3, f.num_questions - 1) }))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-blue-200 bg-white font-bold text-lg text-blue-950 hover:border-[#2E9BDA] hover:text-[#2E9BDA] disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
                  >
                    −
                  </button>
                  <div className="text-center">
                    <span className="block text-2xl font-black text-blue-950 font-mono leading-none tabular-nums">{form.num_questions}</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-blue-400 block mt-1">Questions</span>
                  </div>
                  <button
                    type="button"
                    disabled={form.num_questions >= 15}
                    onClick={() => setForm((f) => ({ ...f, num_questions: Math.min(15, f.num_questions + 1) }))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-blue-200 bg-white font-bold text-lg text-blue-950 hover:border-[#2E9BDA] hover:text-[#2E9BDA] disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95"
                  >
                    +
                  </button>
                </div>

                <div className="md:col-span-7 grid grid-cols-3 gap-2">
                  {[{ label: 'Short', count: 3 }, { label: 'Standard', count: 8 }, { label: 'Complete', count: 15 }].map((tier) => {
                    const isCurrentTier = form.num_questions === tier.count
                    return (
                      <button
                        key={tier.label}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, num_questions: tier.count }))}
                        className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-center transition-all ${
                          isCurrentTier ? 'border-blue-950 bg-blue-950 text-white shadow-sm font-bold' : 'border-blue-200/80 bg-white text-blue-950 hover:border-blue-400'
                        }`}
                      >
                        <span className="text-[12px] font-bold block">{tier.label}</span>
                        <span className={`text-[9px] font-mono mt-0.5 block ${isCurrentTier ? 'text-blue-200' : 'text-blue-500'}`}>{tier.count} items</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial="hidden" animate="show" custom={6} variants={fadeUp}
              className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 uppercase tracking-widest">
                <Sparkles className="h-3.5 w-3.5 text-[#2E9BDA] animate-pulse" /> AI Interview Simulator Ready
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: isFormValid && !loading ? 1.02 : 1 }}
                whileTap={{ scale: isFormValid && !loading ? 0.98 : 1 }}
                disabled={loading || !isFormValid}
                onClick={() => onContinue(form)}
                className="w-full sm:w-auto inline-flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] px-8 text-[14px] font-bold text-white shadow-lg shadow-[#2E9BDA]/25 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:shadow-none"
              >
                {loading ? 'Preparing setup…' : <>Continue to Guidelines <ArrowRight className="h-4 w-4" /></>}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}