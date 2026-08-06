import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Briefcase, Sliders, Layers, Sparkles, ArrowRight, Zap, Target,
  Crosshair, Rocket, CheckCircle2, Search, Bot, Clock, List, Check, Star
} from 'lucide-react'
import FlowStepper from '../components/interview/onboarding/FlowStepper'

const DIFFICULTIES = [
  { id: 'easy', label: 'Warm-up', sub: 'Great for building confidence.', time: 2, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'medium', label: 'Real Interview', sub: 'Realistic experience for preparation.', time: 3, icon: Crosshair, color: 'text-[#2E9BDA]', bg: 'bg-[#2E9BDA]/10', border: 'border-[#2E9BDA]', recommended: true },
  { id: 'hard', label: 'Challenge', sub: 'High pressure, advanced questions.', time: 4, icon: Rocket, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200' },
]

const INTERVIEW_TYPES = [
  { id: 'mixed', label: 'All-in-One', desc: 'Technical, experience & workplace scenarios.', icon: Layers },
  { id: 'technical', label: 'Technical Core', desc: 'Core skills and hands-on execution.', icon: Briefcase },
  { id: 'behavioral', label: 'Behavioral', desc: 'Past projects, teamwork & leadership.', icon: CheckCircle2 },
  { id: 'situational', label: 'Situational', desc: 'Real-time challenges & critical calls.', icon: Zap },
]

const POPULAR_ROLES = ['Python Backend', 'AI Engineer', 'ML Engineer', 'Data Scientist', 'Frontend', 'Full Stack']

const QUESTION_PRESETS = [
  { id: 'short', label: 'Sprint', count: 3, icon: Zap },
  { id: 'standard', label: 'Standard', count: 8, icon: Target },
  { id: 'complete', label: 'Full Interview', count: 15, icon: Crosshair },
]

const CHECKLIST = [
  'Adaptive to your performance',
  'Real-time AI feedback',
  'Detailed scorecard & insights',
]

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] } }),
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
    // ADDED NEGATIVE MARGINS (-m-4 sm:-m-6 lg:-m-8) AND min-h-[calc(100vh-80px)]
    // This pulls the background out to cover the dashboard padding.
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-[calc(100vh-80px)] bg-[#FAFBFC] relative overflow-hidden text-blue-950 antialiased flex flex-col">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#2E9BDA]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-indigo-400/5 blur-3xl" />

      <div className="relative mx-auto max-w-[1200px] w-full px-4 sm:px-6 lg:px-8 py-4 h-full flex flex-col flex-1">
        
        <div className="flex justify-end mb-3">
          <div className="w-[70%]">
            <FlowStepper current={1} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1 min-h-0">
          
          {/* ── LEFT PANEL ── */}
          <motion.div initial="hidden" animate="show" custom={1} variants={fadeUp} className="lg:col-span-4 flex flex-col h-full">
            <div className="bg-white border border-blue-100 rounded-[28px] p-6 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex flex-col h-full justify-between">
              
              <div className="text-center pb-4 border-b border-blue-50">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#2E9BDA]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#1d6fa5] mb-4">
                  <Sparkles className="h-3.5 w-3.5" /> Step 1 of 3
                </div>
                <h1 className="text-[30px] font-black tracking-tight text-blue-950 leading-tight mb-2">
                  AI Interview <br /><span className="text-[#2E9BDA]">Studio</span>
                </h1>
                <p className="text-[14px] text-blue-900/50 font-medium">Real interviews. Real feedback. Real results.</p>

                <div className="mt-8 relative flex justify-center items-center h-28">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }} 
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} 
                    className="absolute w-24 h-24 bg-gradient-to-tr from-[#2E9BDA]/30 to-blue-300/30 rounded-full blur-xl" 
                  />
                  <motion.div 
                    animate={{ y: [0, -8, 0] }} 
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="relative z-10 w-16 h-16 bg-gradient-to-b from-white to-blue-50 rounded-2xl border-4 border-white shadow-[0_10px_25px_rgba(46,155,218,0.2)] flex items-center justify-center"
                  >
                    <Bot className="h-8 w-8 text-[#1d6fa5]" />
                  </motion.div>
                  <div className="absolute bottom-2 w-28 h-6 border-[2px] border-[#2E9BDA]/15 rounded-[100%] shadow-[0_5px_15px_rgba(46,155,218,0.08)]" />
                  <div className="absolute bottom-3 w-16 h-3 border-[1px] border-[#2E9BDA]/25 rounded-[100%]" />
                </div>
              </div>

              <div className="py-4">
                <h3 className="text-[13px] font-extrabold text-blue-950 mb-3">Your Interview Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-[13.5px] font-semibold text-blue-900/60">
                      <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center"><List className="h-3 w-3 text-[#2E9BDA]" /></div>
                      Questions
                    </div>
                    <span className="font-black text-blue-950 text-[15px]">{form.num_questions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-[13.5px] font-semibold text-blue-900/60">
                      <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center"><Clock className="h-3 w-3 text-[#2E9BDA]" /></div>
                      Estimated Time
                    </div>
                    <span className="font-black text-[#2E9BDA] text-[15px]">~{etaMin} min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-[13.5px] font-semibold text-blue-900/60">
                      <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center"><Target className="h-3 w-3 text-[#2E9BDA]" /></div>
                      Interview Mode
                    </div>
                    <span className="font-bold text-blue-950 text-[14px]">{INTERVIEW_TYPES.find(t => t.id === form.interview_type)?.label}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#F0F7FF] rounded-xl p-3.5 space-y-2 mt-auto">
                {CHECKLIST.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-[12px] font-semibold text-[#1d6fa5]">
                    <div className="bg-white rounded-full p-[1.5px] mt-0.5 shadow-sm">
                      <Check className="h-3 w-3 text-[#2E9BDA]" strokeWidth={3} />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT PANEL ── */}
          <motion.div initial="hidden" animate="show" custom={2} variants={fadeUp} className="lg:col-span-8 flex flex-col gap-4">
            
            {/* 1. ROLE INPUT */}
            <div>
              <label className="flex items-center gap-1.5 text-[#1d6fa5] font-extrabold text-[13px] mb-2">
                <Briefcase className="h-4 w-4" /> What role are you interviewing for?
              </label>
              <div className={`relative flex items-center bg-white border rounded-xl p-1.5 transition-all ${focused ? 'border-[#2E9BDA] shadow-[0_0_0_3px_rgba(46,155,218,0.1)]' : 'border-blue-200/70'}`}>
                <Search className="h-4 w-4 text-blue-900/30 ml-2 mr-1.5" />
                <input
                  type="text"
                  value={form.job_title}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full bg-transparent text-[17px] font-bold text-blue-950 outline-none placeholder:text-blue-900/30 py-2"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[12px] font-semibold text-slate-400 mr-1">Popular:</span>
                {POPULAR_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, job_title: role }))}
                    className={`flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                      form.job_title === role ? 'bg-[#2E9BDA]/10 border-[#2E9BDA] text-[#1d6fa5]' : 'bg-white border-blue-100 text-blue-900/50 hover:border-blue-300'
                    }`}
                  >
                    {role === 'Python Backend' && '🐍'}
                    {role === 'AI Engineer' && '✨'}
                    {role === 'ML Engineer' && '🧠'}
                    {role === 'Data Scientist' && '📊'}
                    {role === 'Frontend' && '⚛️'}
                    {role === 'Full Stack' && '📚'}
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. INTERVIEW FOCUS */}
            <div>
              <label className="flex items-center gap-1.5 text-[#1d6fa5] font-extrabold text-[13px] mb-2">
                <Layers className="h-4 w-4" /> Choose Interview Focus
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {INTERVIEW_TYPES.map((t) => {
                  const active = form.interview_type === t.id
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, interview_type: t.id }))}
                      className={`relative flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all ${
                        active ? 'bg-[#F0F7FF] border-[#2E9BDA] shadow-sm' : 'bg-white border-blue-50 hover:border-blue-200'
                      }`}
                    >
                      {active && (
                        <div className="absolute top-1.5 right-1.5 h-4 w-4 bg-[#2E9BDA] rounded-full flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
                        </div>
                      )}
                      <div className={`p-2.5 rounded-lg mb-2 transition-colors ${active ? 'bg-[#2E9BDA] text-white' : 'bg-blue-50 text-[#1d6fa5]'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-[14px] font-extrabold text-blue-950 mb-1">{t.label}</span>
                      <span className="text-[11px] font-medium text-blue-900/50 leading-tight">{t.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. SET DIFFICULTY */}
            <div>
              <label className="flex items-center gap-1.5 text-[#1d6fa5] font-extrabold text-[13px] mb-2">
                <Sliders className="h-4 w-4" /> Set Difficulty
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {DIFFICULTIES.map((d) => {
                  const active = form.difficulty === d.id
                  const Icon = d.icon
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, difficulty: d.id }))}
                      className={`relative text-left p-3.5 rounded-xl border-2 transition-all ${
                        active ? `${d.bg} ${d.border} shadow-sm` : 'bg-white border-blue-50 hover:border-blue-200'
                      }`}
                    >
                      {active && (
                        <div className="absolute top-2.5 right-2.5">
                          <div className={`h-3.5 w-3.5 rounded-full border-[3px] ${d.border} ${d.bg} flex items-center justify-center`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${d.color.replace('text-', 'bg-')}`} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`h-4.5 w-4.5 ${active ? d.color : 'text-blue-900/30'}`} />
                        <span className={`text-[14px] font-extrabold ${active ? 'text-blue-950' : 'text-blue-900/60'}`}>{d.label}</span>
                      </div>
                      <span className="text-[11px] font-medium text-blue-900/50 leading-tight block mt-1">{d.sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 4. SESSION LENGTH */}
            <div>
              <label className="flex items-center gap-1.5 text-[#1d6fa5] font-extrabold text-[13px] mb-2">
                <Clock className="h-4 w-4" /> Choose Session Length
              </label>
              <div className="flex bg-white border border-blue-50 rounded-xl p-1 shadow-sm">
                {QUESTION_PRESETS.map((p) => {
                  const active = form.num_questions === p.count
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, num_questions: p.count }))}
                      className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-lg transition-all ${
                        active ? 'bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] border border-blue-100' : 'hover:bg-blue-50/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`h-4 w-4 ${active ? 'text-[#1d6fa5]' : 'text-blue-900/30'}`} />
                        <span className={`text-[14px] font-extrabold ${active ? 'text-blue-950' : 'text-blue-900/50'}`}>{p.label}</span>
                      </div>
                      <span className={`text-[11.5px] font-semibold ${active ? 'text-blue-900/60' : 'text-blue-900/40'}`}>
                        {p.count} Qs · ~{Math.round(p.count * (selectedDiff?.time || 3))} min
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 5. CONTINUE BUTTON */}
            <div className="mt-auto pt-1">
              <motion.button
                type="button"
                whileHover={{ scale: isFormValid && !loading ? 1.01 : 1 }}
                whileTap={{ scale: isFormValid && !loading ? 0.99 : 1 }}
                disabled={loading || !isFormValid}
                onClick={() => onContinue(form)}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8ba3c7] to-[#9cb2d4] hover:from-[#2E9BDA] hover:to-[#1d6fa5] px-8 text-[15px] font-bold text-white shadow-md transition-all duration-300 disabled:opacity-40"
              >
                {loading ? 'Preparing setup...' : (
                  <>
                    <Sparkles className="h-4.5 w-4.5" /> Continue to Guidelines <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  )
}