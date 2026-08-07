import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
    Sparkles,
    Award,
    Loader2,
    Mail,
    Mic,
    Zap,
    FileText,
    Target,
    Layers,
    Clock,
    Brain,
    BookOpen,
    ChevronDown,
    RotateCcw,
    CornerUpLeft,
    Check,
    CheckCircle2,
    ArrowLeft,
    ArrowRight,
    Code2,
    Users,
    Compass,
    Eye,
    Lightbulb,
    ListChecks,
    SlidersHorizontal,
    Focus,
    Rows3,
    Trophy,
    X,
} from 'lucide-react'
import { getResumes, generateInterview } from '../services/api'
import api from '../services/api'
import { issueCertificate } from '../services/certificateApi'

// ─── Shared Helpers ───────────────────────────────────────────────────────────
const TYPE_META = {
    technical: { label: 'Technical', icon: Code2, chip: 'bg-blue-50 text-blue-700', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    behavioral: { label: 'Behavioral', icon: Users, chip: 'bg-teal-50 text-teal-700', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
    situational: { label: 'Situational', icon: Compass, chip: 'bg-orange-50 text-orange-700', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
}
const DIFF_COLOR = {
    easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-600   bg-amber-50   border-amber-200',
    hard: 'text-rose-600    bg-rose-50    border-rose-200',
}
const DIFF_DOT = { easy: 'bg-emerald-500', medium: 'bg-amber-500', hard: 'bg-rose-500' }
const DIFF_LEVEL = { easy: 1, medium: 2, hard: 3 }

// ─── Cycling "AI is working" loading copy ────────────────────────────────────
function useLoadingMessages(active, messages) {
    const [i, setI] = useState(0)
    useEffect(() => {
        if (!active) { setI(0); return }
        const id = setInterval(() => setI(v => (v + 1) % messages.length), 1700)
        return () => clearInterval(id)
    }, [active, messages.length])
    return messages[i]
}

// ─── Difficulty Meter ─────────────────────────────────────────────────────────
function DifficultyMeter({ level }) {
    const idx = DIFF_LEVEL[level] || 1
    return (
        <span className="inline-flex items-center gap-0.5">
            {[1, 2, 3].map(n => (
                <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= idx ? (DIFF_DOT[level] || 'bg-slate-400') : 'bg-current opacity-20'}`} />
            ))}
        </span>
    )
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon, children }) {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            whileHover={{ scale: active ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex flex-1 sm:flex-none items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-bold transition-all duration-200 select-none outline-none min-w-0 ${active
                ? 'text-white bg-indigo-600 shadow-md shadow-indigo-200/70'
                : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent'
                }`}
        >
            <span className={`inline-flex h-5 w-5 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${active ? 'bg-white/20' : 'bg-slate-200/60 sm:bg-slate-100'}`}>
                {icon}
            </span>
            <span className="truncate">{children}</span>
            {active && (
                <span className="pointer-events-none absolute -bottom-1 left-2 right-2 sm:left-5 sm:right-5 h-0.5 rounded-full bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300" />
            )}
        </motion.button>
    )
}

// ─── Question Progress Rail ───────────────────────────────────────────────────
function QuestionRail({ total, activeIndex, onJump, minutesLeft }) {
    const pct = Math.round(((activeIndex + 1) / total) * 100)
    return (
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Your progress</span>
                <span className="flex items-center gap-3">
                    {typeof minutesLeft === 'number' && (
                        <span className="hidden items-center gap-1 text-xs font-medium text-slate-400 sm:inline-flex">
                            <Clock className="h-3 w-3" /> ~{minutesLeft} min left
                        </span>
                    )}
                    <span className="text-xs font-mono font-semibold text-indigo-600">{pct}%</span>
                </span>
            </div>
            <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {Array.from({ length: total }).map((_, i) => {
                    const state = i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'upcoming'
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onJump(i)}
                            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${state === 'done'
                                ? 'bg-indigo-600 text-white'
                                : state === 'current'
                                    ? 'scale-110 bg-white text-indigo-700 shadow-md ring-2 ring-indigo-500'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                        >
                            {state === 'done' ? <Check className="h-4 w-4" /> : i + 1}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Question Card — used in both Focus (single) and List (accordion) modes ──
function QuestionCard({ q, index, expanded, onToggle, mode = 'list' }) {
    const meta = TYPE_META[q.type] || TYPE_META.technical
    const TypeIcon = meta.icon
    const diff = DIFF_COLOR[q.difficulty] || 'text-gray-600 bg-gray-50 border-gray-200'
    const isFocus = mode === 'focus'
    const showBody = isFocus || expanded
    const hasDetails = q.what_to_look_for || q.sample_answer_framework || q.follow_up_questions?.length > 0

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: isFocus ? 0 : index * 0.03, type: 'spring', stiffness: 260, damping: 24 }}
            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${isFocus
                ? 'border-indigo-200 bg-white shadow-xl shadow-indigo-100/60'
                : expanded
                    ? 'border-indigo-300 bg-white shadow-xl shadow-indigo-100/50'
                    : 'border-slate-100 bg-white/70 hover:border-indigo-200 hover:bg-white hover:shadow-md'
                }`}
        >
            <button
                type="button"
                onClick={isFocus ? undefined : onToggle}
                className={`flex w-full items-start gap-4 p-5 text-left outline-none sm:p-6 ${isFocus ? 'cursor-default' : ''}`}
            >
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${meta.chip}`}>
                    {String(q.question_number || index + 1).padStart(2, '0')}
                </div>
                <div className="flex-1">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${meta.badge}`}>
                            <TypeIcon className="h-3 w-3" /> {meta.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">{q.category}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${diff}`}>
                            <DifficultyMeter level={q.difficulty} /> {q.difficulty}
                        </span>
                    </div>
                    <p className={`leading-relaxed transition-colors ${isFocus ? 'text-lg font-semibold text-slate-900 sm:text-xl' : expanded ? 'text-base font-medium text-slate-900' : 'text-base text-slate-700'}`}>
                        {q.question}
                    </p>
                </div>
                {!isFocus && (
                    <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="mt-2 shrink-0 text-slate-400">
                        <ChevronDown className="h-5 w-5" />
                    </motion.div>
                )}
            </button>
            <AnimatePresence initial={false}>
                {showBody && hasDetails && (
                    <motion.div
                        initial={isFocus ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    >
                        <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6">
                            {q.what_to_look_for && (
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                                    <h4 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                                        <Eye className="h-3.5 w-3.5" /> What to Look For
                                    </h4>
                                    <p className="text-sm leading-relaxed text-slate-700">{q.what_to_look_for}</p>
                                </div>
                            )}
                            {q.sample_answer_framework && (
                                <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
                                    <h4 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-600">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Answer Framework
                                    </h4>
                                    <p className="text-sm leading-relaxed text-slate-700">{q.sample_answer_framework}</p>
                                </div>
                            )}
                            {q.follow_up_questions?.length > 0 && (
                                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Follow-up Questions</h4>
                                    <ul className="space-y-2">
                                        {q.follow_up_questions.map((fq, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                                <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                                {fq}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ─── MCQ — Single Question Card with answer reveal ────────────────────────────
function MCQCard({ question, questionIndex, totalQuestions, onNext, isLast }) {
    const [selected, setSelected] = useState(null)
    const [submitted, setSubmitted] = useState(false)
    const isCorrect = submitted && selected === question.correctAnswer

    const optionCls = (opt) => {
        if (!submitted)
            return selected === opt
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-md shadow-indigo-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
        if (opt === question.correctAnswer) return 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-md'
        if (opt === selected) return 'border-rose-400 bg-rose-50 text-rose-700 opacity-80'
        return 'border-slate-200 bg-slate-50 text-slate-400 opacity-50'
    }

    const optionIcon = (opt) => {
        if (!submitted) return selected === opt
            ? <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0"><span className="w-2 h-2 rounded-full bg-white" /></span>
            : <span className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
        if (opt === question.correctAnswer)
            return <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white"><Check className="h-3 w-3" /></span>
        if (opt === selected)
            return <span className="w-5 h-5 rounded-full bg-rose-400 flex items-center justify-center flex-shrink-0 text-white"><X className="h-3 w-3" /></span>
        return <span className="w-5 h-5 rounded-full border-2 border-slate-200 flex-shrink-0 opacity-40" />
    }

    return (
        <motion.div key={questionIndex} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="space-y-5">

            {/* Progress */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Question {questionIndex + 1} of {totalQuestions}</span>
                <span className="text-xs font-mono text-slate-400">{Math.round((questionIndex / totalQuestions) * 100)}% done</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    initial={{ width: `${(questionIndex / totalQuestions) * 100}%` }}
                    animate={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }} />
            </div>

            {/* Question */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-indigo-200/50">
                <p className="text-lg font-semibold leading-relaxed">{question.question}</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
                {question.options.map((opt, i) => (
                    <button key={i} disabled={submitted} onClick={() => setSelected(opt)}
                        className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left text-sm font-medium transition-all duration-200 cursor-pointer disabled:cursor-default ${optionCls(opt)}`}>
                        {optionIcon(opt)}
                        <span className="flex-1">{opt}</span>
                    </button>
                ))}
            </div>

            {/* Reveal panel */}
            <AnimatePresence>
                {submitted && (
                    <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                        className={`rounded-2xl border-2 p-5 ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                        <div className="flex items-center gap-2 mb-3">
                            {isCorrect ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Lightbulb className="h-5 w-5 text-rose-600" />}
                            <span className={`text-sm font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {isCorrect ? 'Correct! Well done!' : 'Incorrect — the correct answer is:'}
                            </span>
                        </div>
                        {!isCorrect && (
                            <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5">
                                <Check className="h-4 w-4 text-emerald-600" />
                                <p className="text-sm font-semibold text-emerald-700">{question.correctAnswer}</p>
                            </div>
                        )}
                        <div className="rounded-xl bg-white/70 border border-slate-200 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Explanation</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{question.explanation}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Submit / Next */}
            {!submitted ? (
                <button onClick={() => { if (!selected) { toast.error('Select an answer first'); return } setSubmitted(true) }}
                    disabled={!selected}
                    className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                    Submit Answer
                </button>
            ) : (
                <button onClick={() => onNext(isCorrect)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:opacity-90 active:scale-[0.98]">
                    {isLast ? 'See Results' : 'Next Question'} <ArrowRight className="h-4 w-4" />
                </button>
            )}
        </motion.div>
    )
}

// ─── MCQ — Score Summary ──────────────────────────────────────────────────────
export function QuizSummary({ score, total, topic, difficulty, onRetry }) {
    const pct = Math.round((score / total) * 100)
    
    // Grading logic
    const grade = pct >= 90 ? { label: 'Excellent!', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', Icon: Trophy }
        : pct >= 80 ? { label: 'Great Job!', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', Icon: Award }
        : pct >= 50 ? { label: 'Getting There!', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', Icon: BookOpen }
        : { label: 'Keep Practicing!', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', Icon: Zap }

    // Certificate state
    const isEligible = pct >= 80
    const [certStatus, setCertStatus] = useState('idle') // idle, loading, success, error

    const handleClaimCertificate = async () => {
        setCertStatus('loading')
        try {
            // The backend automatically extracts the user's name and email from their auth token session
            await issueCertificate({
                assessmentName: topic,
                score: pct,
                difficulty,
            })
            setCertStatus('success')
            toast.success('Your certificate has been securely emailed!')
        } catch (error) {
            setCertStatus('error')
            toast.error(error.response?.data?.detail || 'Issuance failed. Please check network connection logs.')
        }
    }

    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-col items-center py-8 space-y-8 w-full max-w-2xl mx-auto">
            
            {/* Confetti for high scores (optional) */}
            {isEligible && (
                <div aria-hidden="true" className="h-6 w-40 opacity-0">
                    {/* Confetti disabled: react-confetti not installed */}
                </div>
            )}

            {/* Score Ring */}
            <div className="relative">
                <div className="w-40 h-40 rounded-full flex items-center justify-center shadow-sm"
                    style={{ background: `conic-gradient(#6366f1 0% ${pct}%, #f1f5f9 ${pct}% 100%)` }}>
                    <div className="w-32 h-32 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                        <span className="text-4xl font-black text-slate-900">{pct}%</span>
                        <span className="text-sm font-semibold text-slate-500">{score}/{total}</span>
                    </div>
                </div>
                <div className={`absolute -top-2 -right-2 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md ${grade.color}`}>
                    <grade.Icon className="h-6 w-6" />
                </div>
            </div>

            {/* Title & Stats */}
            <div className="text-center">
                <h2 className={`text-3xl font-bold ${grade.color}`}>{grade.label}</h2>
                <p className="mt-2 text-slate-600 text-base">You scored <strong>{score} out of {total}</strong> on <strong>{topic}</strong> ({difficulty})</p>
            </div>

            {/* Enhanced Progress Bars */}
            <div className="w-full max-w-sm space-y-4 text-left bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                {[['Correct', score, 'bg-emerald-500', 'text-emerald-700', pct], ['Wrong', total - score, 'bg-rose-400', 'text-rose-700', 100 - pct]].map(([label, val, bar, txt, w]) => (
                    <div key={label} className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-600 w-16 shrink-0">{label}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.8, delay: 0.3 }} className={`h-full rounded-full ${bar}`} />
                        </div>
                        <span className={`text-sm font-bold w-6 text-right ${txt}`}>{val}</span>
                    </div>
                ))}
            </div>

            {/* E-Certificate Section (Conditional) */}
            <AnimatePresence>
                {isEligible && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0, y: 20 }} 
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        className="w-full max-w-sm overflow-hidden"
                    >
                        <div className={`p-6 rounded-2xl border ${grade.border} ${grade.bg} text-center`}>
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <Award className={`h-6 w-6 ${grade.color}`} />
                                <h3 className={`font-bold text-lg ${grade.color}`}>You Earned an Award!</h3>
                            </div>
                            
                            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                                Your performance qualifies for an official verification certificate. We'll deploy it to a secure public URL and email it directly to your registered profile inbox.
                            </p>
                            
                            {certStatus === 'success' ? (
                                <div className="flex flex-col items-center text-center p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                                    <p className="text-sm font-semibold text-slate-800">Sent Successfully!</p>
                                    <p className="text-xs text-slate-500 mt-1">Check your inbox for a digital verification download copy.</p>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleClaimCertificate} 
                                    disabled={certStatus === 'loading'}
                                    className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-800 shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
                                >
                                    {certStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                    {certStatus === 'loading' ? 'Claiming Award...' : 'Claim My E-Certificate'}
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
                <button onClick={onRetry} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                    <RotateCcw className="h-4 w-4" /> Try Again
                </button>
                <button onClick={onRetry} className="px-6 py-3 rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all">
                    New Topic
                </button>
            </div>
        </motion.div>
    )
}

// ─── MCQ Practice Tab ─────────────────────────────────────────────────────────
const QUICK_TOPICS = ['Python', 'JavaScript', 'React', 'System Design', 'SQL', 'Machine Learning', 'Docker', 'AWS', 'Data Structures', 'REST APIs', 'Git', 'TypeScript']

function MCQPractice() {
    const [topic, setTopic] = useState('')
    const [difficulty, setDifficulty] = useState('medium')
    const [numQ, setNumQ] = useState(5)
    const [loading, setLoading] = useState(false)
    const [questions, setQuestions] = useState(null)
    const [currentIdx, setCurrentIdx] = useState(0)
    const [score, setScore] = useState(0)
    const [finished, setFinished] = useState(false)

    const loadingMsg = useLoadingMessages(loading, [
        `Reading up on ${topic || 'the topic'}…`,
        `Tuning questions to ${difficulty} difficulty…`,
        'Writing clear explanations…',
        'Almost ready…',
    ])

    const generate = async () => {
        if (!topic.trim()) { toast.error('Please select or enter a topic'); return }
        setLoading(true); setQuestions(null); setCurrentIdx(0); setScore(0); setFinished(false)
        try {
            const { data } = await api.post('/interview/quick-practice', { topic: topic.trim(), difficulty, num_questions: numQ })
            if (!data?.questions?.length) throw new Error('No questions returned')
            setQuestions(data.questions)
            toast.success(`${data.questions.length} MCQs ready!`)
        } catch (err) { toast.error(err.response?.data?.detail || 'Generation failed — try again') }
        finally { setLoading(false) }
    }

    const handleNext = (wasCorrect) => {
        const ns = wasCorrect ? score + 1 : score
        if (currentIdx >= questions.length - 1) { setScore(ns); setFinished(true) }
        else { setScore(ns); setCurrentIdx(i => i + 1) }
    }

    const reset = () => { setQuestions(null); setCurrentIdx(0); setScore(0); setFinished(false) }

    // ── Setup Screen ──────────────────────────────────────────────
    if (!questions && !loading) return (
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-4">
                <div className="lg:sticky lg:top-6 space-y-4 sm:space-y-5 rounded-3xl border border-white bg-white/80 p-4 sm:p-6 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5 sm:pb-4">
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 shrink-0">
                            <Layers className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">Build Your Practice Session</h3>
                            <p className="text-xs text-slate-400">Pick a topic, we'll handle the rest</p>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Topic</label>
                        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
                            placeholder="e.g. React Hooks, SQL Joins…"
                            className="block w-full rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10" />
                    </div>
                    <div>
                        <p className="mb-2 text-xs font-medium text-slate-500">Quick-pick a topic</p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {QUICK_TOPICS.map(t => (
                                <button key={t} onClick={() => setTopic(t)}
                                    className={`rounded-lg border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold transition-all ${topic === t ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-600'
                                        }`}>{t}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Difficulty</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['easy', 'medium', 'hard'].map(d => (
                                <button key={d} onClick={() => setDifficulty(d)}
                                    className={`rounded-xl border py-2.5 text-xs font-semibold capitalize transition-all ${difficulty === d ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm' : 'border-gray-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        }`}>{d}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Number of Questions</label>
                        <select value={numQ} onChange={e => setNumQ(+e.target.value)}
                            className="block w-full rounded-xl border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10">
                            {[5, 8, 10, 15].map(n => <option key={n} value={n}>{n} questions</option>)}
                        </select>
                    </div>
                    <button onClick={generate} disabled={!topic.trim()}
                        className="group w-full overflow-hidden rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                        <span className="flex items-center justify-center gap-2">
                            Generate Practice Questions
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </button>
                </div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-8 flex min-h-[300px] py-10 lg:h-[600px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 text-center px-4 sm:px-6">
                <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 shadow-inner">
                    <Brain className="h-8 w-8 sm:h-9 sm:w-9" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Test your knowledge instantly</h2>
                <p className="mt-2 sm:mt-3 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">Pick a topic, set difficulty, and generate AI questions. Submit each answer to see the correct option with a full explanation.</p>
            </motion.div>
        </div>
    )

    // ── Loading ───────────────────────────────────────────────────
    if (loading) return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[350px] py-12 lg:h-[500px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 text-center px-6">
            <div className="relative mb-6 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-violet-50">
                <div className="absolute inset-0 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" />
                <Brain className="h-7 w-7 sm:h-8 sm:w-8 text-violet-500 animate-pulse" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Building your "{topic}" questions</h3>
            <p className="mt-2 max-w-sm text-xs sm:text-sm text-slate-500">Our AI is crafting personalized {difficulty} questions just for you.</p>
            <AnimatePresence mode="wait">
                <motion.p key={loadingMsg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="mt-4 text-xs font-semibold uppercase tracking-widest text-violet-500">
                    {loadingMsg}
                </motion.p>
            </AnimatePresence>
        </motion.div>
    )

    // ── Summary ───────────────────────────────────────────────────
    if (finished) return (
        <div className="rounded-3xl border border-white bg-white/80 p-4 sm:p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
            <QuizSummary score={score} total={questions.length} topic={topic} difficulty={difficulty} onRetry={reset} />
        </div>
    )

    // ── Active Quiz ───────────────────────────────────────────────
    return (
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
            <div className="lg:col-span-3">
                <div className="lg:sticky lg:top-6 space-y-4 rounded-2xl border border-white bg-white/80 p-4 sm:p-5 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                    <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Topic</p><p className="text-sm font-bold text-slate-800">{topic}</p></div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Difficulty</p>
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${DIFF_COLOR[difficulty]}`}>{difficulty}</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Progress</p>
                        <div className="space-y-1.5">
                            {questions.map((_, i) => (
                                <div key={i} className={`h-2 rounded-full transition-all ${i < currentIdx ? 'bg-indigo-400' : i === currentIdx ? 'bg-indigo-600 animate-pulse' : 'bg-slate-200'}`} />
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Score</p>
                        <p className="text-lg font-black text-slate-800">{score}<span className="text-slate-400 font-normal text-sm">/{currentIdx}</span></p>
                    </div>
                    <button onClick={reset} className="inline-flex w-full items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors pt-1">
                        <X className="h-3.5 w-3.5" /> Exit Quiz
                    </button>
                </div>
            </div>
            <div className="lg:col-span-9">
                <div className="rounded-3xl border border-white bg-white/80 p-4 sm:p-7 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                    <AnimatePresence mode="wait">
                        <MCQCard key={currentIdx} question={questions[currentIdx]} questionIndex={currentIdx}
                            totalQuestions={questions.length} onNext={handleNext} isLast={currentIdx >= questions.length - 1} />
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

// ─── Full Mock Interview Tab ──────────────────────────────────────────────────
// ─── Full Mock Interview Tab ──────────────────────────────────────────────────
function FullMockInterview({ resumes }) {
    const [interview, setInterview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(null)
    const [viewMode, setViewMode] = useState('focus')
    const [activeIndex, setActiveIndex] = useState(0)
    const [autoData, setAutoData] = useState(null)
    const [fetchingAuto, setFetchingAuto] = useState(false)
    
    // NEW STATE: Tracks if the user has dismissed the intro card to see the questions
    const [hasStarted, setHasStarted] = useState(false)

    const { register, handleSubmit, setValue } = useForm({
        defaultValues: { difficulty: 'medium', interview_type: 'mixed', num_questions: 10 },
    })

    const loadingMsg = useLoadingMessages(loading, [
        'Analyzing your resume…',
        'Matching skills to the role…',
        'Building tailored questions…',
        'Almost ready…',
    ])

    useEffect(() => {
        setFetchingAuto(true)
            ; (async () => {
                try {
                    const { data: rl } = await api.get('/resume/', { params: { page_size: 1, status: 'parsed' } })
                    const lr = rl.resumes?.[0]
                    const { data: hist } = await api.get('/ats/history', { params: { page_size: 1 } })
                    const li = hist.items?.[0]
                    let fr = null
                    if (li?.result_id) { const { data: f } = await api.get('/ats/result/' + li.result_id); fr = f }
                    if (lr || fr) setAutoData({ resume_id: lr?.id || '', job_title: fr?.job_title || '', job_description: fr?.job_description || '' })
                } catch { /* silent */ } finally { setFetchingAuto(false) }
            })()
    }, [])

    useEffect(() => {
        if (autoData?.resume_id) setValue('resume_id', autoData.resume_id)
        if (autoData?.job_title) setValue('job_title', autoData.job_title)
        if (autoData?.job_description) setValue('job_description', autoData.job_description)
    }, [autoData, setValue])

    const onSubmit = async (data) => {
        if (!data.resume_id) { toast.error('Select a resume first'); return }
        // Reset hasStarted when generating a new interview
        setLoading(true); setInterview(null); setExpanded(null); setActiveIndex(0); setViewMode('focus'); setHasStarted(false)
        try {
            const { data: res } = await generateInterview({ ...data, num_questions: parseInt(data.num_questions) })
            setInterview(res)
            toast.success('Interview generated!')
        } catch (err) { toast.error(err.response?.data?.detail || 'Generation failed') }
        finally { setLoading(false) }
    }

    return (
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
            {/* Config Panel */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-4">
                <form onSubmit={handleSubmit(onSubmit)} className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto space-y-5 sm:space-y-6 rounded-3xl border border-white bg-white/80 p-4 sm:p-6 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5 sm:pb-4">
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
                            <SlidersHorizontal className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">Build Your Interview</h3>
                            <p className="text-xs text-slate-400">Takes about 30 seconds</p>
                        </div>
                    </div>

                    {fetchingAuto ? (
                        <div className="flex animate-pulse items-center gap-4 rounded-2xl bg-slate-50 p-4">
                            <div className="h-6 w-6 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                            <p className="text-sm text-slate-500">Syncing profile data…</p>
                        </div>
                    ) : autoData ? (
                        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-4 sm:p-5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Auto-Filled</span>
                            <div className="mt-3 space-y-3">
                                <div className="flex items-start gap-2.5">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                                    <div><p className="text-xs font-medium text-slate-500">Resume</p><p className="truncate text-sm font-semibold text-slate-800">{resumes.find(r => r.id === autoData.resume_id)?.original_filename || 'Selected resume'}</p></div>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                                    <div><p className="text-xs font-medium text-slate-500">Target Role</p><p className="text-sm font-semibold text-slate-800">{autoData.job_title || '—'}</p></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">Resume</label>
                                <select {...register('resume_id', { required: true })} className="block w-full rounded-xl border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10">
                                    <option value="">— Select Resume —</option>
                                    {resumes.map(r => <option key={r.id} value={r.id}>{r.original_filename}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">Target Role</label>
                                <input {...register('job_title')} placeholder="e.g. Senior Frontend Engineer" className="block w-full rounded-xl border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Interview Type</label>
                        <select {...register('interview_type')} className="block w-full rounded-xl border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10">
                            <option value="mixed">Mixed (Tech + Behavioral)</option>
                            <option value="technical">Technical Deep-Dive</option>
                            <option value="behavioral">Behavioral (STAR Method)</option>
                            <option value="situational">Situational Scenarios</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Difficulty</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['easy', 'medium', 'hard'].map(d => (
                                <label key={d} className="cursor-pointer">
                                    <input {...register('difficulty')} type="radio" value={d} className="peer sr-only" />
                                    <div className="rounded-xl border border-gray-200 bg-slate-50 py-2.5 text-center text-xs font-semibold capitalize text-slate-500 transition-all hover:bg-slate-100 peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-checked:shadow-sm">{d}</div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Interview Length</label>
                        <select {...register('num_questions')} className="block w-full rounded-xl border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10">
                            {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} questions · ~{n * 4} min</option>)}
                        </select>
                    </div>

                    <button type="submit" disabled={loading || resumes.length === 0}
                        className="group w-full overflow-hidden rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70">
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="h-5 w-5 animate-spin text-white/70" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating…
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                Generate Personalized Interview
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </span>
                        )}
                    </button>
                </form>
            </motion.div>

            {/* Results */}
            <motion.div layout className="lg:col-span-8">
                {loading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[350px] py-12 lg:h-[600px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 text-center px-4 sm:px-6">
                        <div className="relative mb-6 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-indigo-50">
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                            <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-500 animate-pulse" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-800">Preparing your interview</h3>
                        <p className="mt-2 max-w-sm text-xs sm:text-sm text-slate-500">Our AI is analyzing your resume and preparing a personalized interview experience.</p>
                        <AnimatePresence mode="wait">
                            <motion.p key={loadingMsg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                className="mt-4 text-xs font-semibold uppercase tracking-widest text-indigo-500">
                                {loadingMsg}
                            </motion.p>
                        </AnimatePresence>
                    </motion.div>
                ) : interview ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        
                        {!hasStarted ? (
                            // Intro Screen (Visible immediately after generation)
                            <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-xl shadow-slate-200/40">
                                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 sm:p-8 text-white">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Interview ready
                                    </span>
                                    <h2 className="mt-3 text-xl sm:text-2xl font-bold">{interview.job_title || 'Custom Interview'}</h2>
                                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-indigo-100 opacity-90">
                                        <span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> {interview.questions.length} Questions</span>
                                        <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Approx {interview.estimated_duration_minutes} minutes</span>
                                    </p>
                                </div>
                                {interview.preparation_tips?.length > 0 && (
                                    <div className="bg-white p-5 sm:p-8">
                                        <h3 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400">
                                            <Lightbulb className="h-4 w-4" /> Before You Begin
                                        </h3>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {interview.preparation_tips.map((tip, i) => (
                                                <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs sm:text-sm text-slate-700">
                                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                                                        <Check className="h-3 w-3" />
                                                    </span>{tip}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Start Interview Button */}
                                <div className="bg-slate-50 p-4 sm:p-6 flex justify-end border-t border-slate-100">
                                    <button 
                                        onClick={() => setHasStarted(true)} 
                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98]"
                                    >
                                        Start Interview <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Interview Questions View (Appears after clicking 'Start Interview')
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400">Your Questions</h3>
                                    <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                                        <button type="button" onClick={() => setViewMode('focus')}
                                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'focus' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                                            <Focus className="h-3.5 w-3.5" /> Focus
                                        </button>
                                        <button type="button" onClick={() => setViewMode('list')}
                                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                                            <Rows3 className="h-3.5 w-3.5" /> All Questions
                                        </button>
                                    </div>
                                </div>

                                {viewMode === 'focus' ? (
                                    <div className="space-y-5">
                                        <QuestionRail total={interview.questions.length} activeIndex={activeIndex} onJump={setActiveIndex} />
                                        <AnimatePresence mode="wait">
                                            <QuestionCard key={activeIndex} q={interview.questions[activeIndex]} index={activeIndex} expanded mode="focus" onToggle={() => { }} />
                                        </AnimatePresence>
                                        <div className="flex items-center justify-between gap-3">
                                            <button type="button" onClick={() => setActiveIndex(i => Math.max(0, i - 1))} disabled={activeIndex === 0}
                                                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                                                <ArrowLeft className="h-4 w-4" /> Previous
                                            </button>
                                            <span className="text-[11px] sm:text-xs font-medium text-slate-400">Q {activeIndex + 1} of {interview.questions.length}</span>
                                            {activeIndex === interview.questions.length - 1 ? (
                                                <button type="button" onClick={() => setViewMode('list')}
                                                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-indigo-600 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700">
                                                    Review All <Rows3 className="h-4 w-4" />
                                                </button>
                                            ) : (
                                                <button type="button" onClick={() => setActiveIndex(i => Math.min(interview.questions.length - 1, i + 1))}
                                                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-indigo-600 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700">
                                                    Next <ArrowRight className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {interview.questions.map((q, i) => (
                                            <QuestionCard key={i} q={q} index={i} expanded={expanded === i} onToggle={() => setExpanded(expanded === i ? null : i)} mode="list" />
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[300px] py-10 lg:h-[600px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 text-center px-4 sm:px-6">
                        <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 shadow-inner">
                            <Mic className="h-8 w-8 sm:h-9 sm:w-9" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Step into the interview room</h2>
                        <p className="mt-2 sm:mt-3 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">Set your resume, target role, and difficulty on the left — we'll build a personalized mock interview around them.</p>
                        <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2">
                            {['Built from your resume', 'Real interview structure', 'Ready in seconds'].map(f => (
                                <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium text-slate-500">
                                    <Check className="h-3 w-3 text-indigo-500" /> {f}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Interview() {
    const [activeTab, setActiveTab] = useState('mcq')
    const [resumes, setResumes] = useState([])


    useEffect(() => {
        getResumes({ page_size: 20 })
            .then(r => setResumes((r.data.resumes || []).filter(r => r.status === 'parsed')))
            .catch(() => { })
    }, [])

    return (
        <div className="min-h-screen bg-slate-50 [background-image:radial-gradient(circle_at_1px_1px,theme(colors.slate.200)_1px,transparent_0)] [background-size:24px_24px] p-3.5 sm:p-6 md:p-8 font-sans text-slate-900">
            <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
                {/* Hero Header */}
                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl border border-indigo-100/70 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 sm:p-8 lg:p-10 shadow-sm">
                    <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-200/30 blur-3xl" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm">
                                <Sparkles className="h-3.5 w-3.5" /> AI Interview Coach
                            </span>
                            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">Walk in ready.</h1>
                            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
                                AI-crafted mock interviews built from your resume and target role — practice the questions you'll actually face.
                            </p>
                            <div className="mt-4 sm:mt-5 flex flex-wrap gap-1.5 sm:gap-2">
                                {[
                                    { icon: Sparkles, label: 'AI-Powered' },
                                    { icon: FileText, label: 'Resume-Matched' },
                                    { icon: Target, label: 'Personalized' },
                                    { icon: Zap, label: 'Instant Generation' },
                                ].map(({ icon: Icon, label }) => (
                                    <span key={label} className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-slate-200 bg-white/70 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-slate-600">
                                        <Icon className="h-3.5 w-3.5 text-indigo-500" /> {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 w-full sm:flex sm:w-auto gap-1 sm:gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 sm:p-1.5 shadow-sm sm:bg-white self-stretch lg:self-end">
                            <TabBtn
                                active={activeTab === 'mcq'}
                                onClick={() => setActiveTab('mcq')}
                                icon={<Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                            >
                                <span className="sm:hidden">Quick MCQ</span>
                                <span className="hidden sm:inline">Quick MCQ Practice</span>
                            </TabBtn>
                            <TabBtn
                                active={activeTab === 'mock'}
                                onClick={() => setActiveTab('mock')}
                                icon={<Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                            >
                                <span className="sm:hidden">Full Mock</span>
                                <span className="hidden sm:inline">Full Mock Interview</span>
                            </TabBtn>
                        </div>
                    </div>
                </motion.div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'mcq' ? (
                        <motion.div key="mcq" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                            <MCQPractice />
                        </motion.div>
                    ) : (
                        <motion.div key="mock" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                            <FullMockInterview resumes={resumes} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}