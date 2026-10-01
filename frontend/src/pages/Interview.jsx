import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
    Sparkles,
    Award,
    Loader2,
    Mail,
    Zap,
    Brain,
    BookOpen,
    RotateCcw,
    Check,
    CheckCircle2,
    ArrowRight,
    Trophy,
    X,
    Lightbulb,
    Search,
    SlidersHorizontal,
    Code2,
    Database,
    Cloud,
    Cpu
} from 'lucide-react'
import api from '../services/api'
import { issueCertificate } from '../services/certificateApi'

// ─── Color Helpers ───────────────────────────────────────────────────────────
const DIFF_COLOR = {
    easy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-700 bg-amber-50 border-amber-200',
    hard: 'text-rose-700 bg-rose-50 border-rose-200',
}

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

// ─── MCQ — Single Question Card with answer reveal ────────────────────────────
function MCQCard({ question, questionIndex, totalQuestions, onNext, isLast }) {
    const [selected, setSelected] = useState(null)
    const [submitted, setSubmitted] = useState(false)
    const isCorrect = submitted && selected === question.correctAnswer

    const optionCls = (opt) => {
        if (!submitted)
            return selected === opt
                ? 'border-[#2E9BDA] bg-[#2E9BDA]/10 text-slate-900 font-semibold shadow-sm ring-2 ring-[#2E9BDA]/20'
                : 'border-slate-200/90 bg-white text-slate-700 hover:border-[#2E9BDA]/50 hover:bg-slate-50/80'
        if (opt === question.correctAnswer) return 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold shadow-sm'
        if (opt === selected) return 'border-rose-400 bg-rose-50 text-rose-800 opacity-90'
        return 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-50'
    }

    const optionIcon = (opt) => {
        if (!submitted) return selected === opt
            ? <span className="w-5 h-5 rounded-full bg-[#2E9BDA] flex items-center justify-center flex-shrink-0"><span className="w-2 h-2 rounded-full bg-white" /></span>
            : <span className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
        if (opt === question.correctAnswer)
            return <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
        if (opt === selected)
            return <span className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0 text-white"><X className="h-3 w-3" strokeWidth={3} /></span>
        return <span className="w-5 h-5 rounded-full border-2 border-slate-200 flex-shrink-0 opacity-40" />
    }

    return (
        <motion.div key={questionIndex} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="space-y-4 sm:space-y-5">

            {/* Progress Bar & Counter */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500 uppercase tracking-wider">Question {questionIndex + 1} of {totalQuestions}</span>
                    <span className="text-[#2E9BDA] font-bold">{Math.round(((questionIndex + 1) / totalQuestions) * 100)}% Complete</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-[#2E9BDA] to-indigo-600"
                        initial={{ width: `${(questionIndex / totalQuestions) * 100}%` }}
                        animate={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }} />
                </div>
            </div>

            {/* Question Text Card */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-50/90 via-indigo-50/60 to-white p-5 sm:p-6 text-slate-900 border border-blue-100 shadow-sm">
                <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">{question.question}</p>
            </div>

            {/* Options */}
            <div className="space-y-2.5 sm:space-y-3">
                {question.options.map((opt, i) => (
                    <button key={i} disabled={submitted} onClick={() => setSelected(opt)}
                        className={`w-full flex items-center gap-3.5 rounded-xl border p-3.5 sm:p-4 text-left text-sm transition-all duration-150 cursor-pointer disabled:cursor-default ${optionCls(opt)}`}>
                        {optionIcon(opt)}
                        <span className="flex-1 text-sm leading-snug">{opt}</span>
                    </button>
                ))}
            </div>

            {/* Answer Reveal / Explanation Box */}
            <AnimatePresence>
                {submitted && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`rounded-2xl border p-4 sm:p-5 ${isCorrect ? 'border-emerald-200 bg-emerald-50/80' : 'border-rose-200 bg-rose-50/80'}`}>
                        <div className="flex items-center gap-2 mb-2.5">
                            {isCorrect ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <Lightbulb className="h-5 w-5 text-rose-600 shrink-0" />}
                            <span className={`text-sm font-bold ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                                {isCorrect ? 'Correct! Excellent work.' : 'Incorrect — here is the correct answer:'}
                            </span>
                        </div>
                        {!isCorrect && (
                            <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 shadow-xs">
                                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                                <p className="text-xs sm:text-sm font-bold text-emerald-800">{question.correctAnswer}</p>
                            </div>
                        )}
                        <div className="rounded-xl bg-white/90 border border-slate-200/80 p-3.5 text-slate-700">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Explanation</p>
                            <p className="text-xs sm:text-sm leading-relaxed">{question.explanation}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons */}
            {!submitted ? (
                <button onClick={() => { if (!selected) { toast.error('Please select an option first'); return } setSubmitted(true) }}
                    disabled={!selected}
                    className="w-full rounded-xl bg-[#2E9BDA] hover:bg-[#2585bd] py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed">
                    Submit Answer
                </button>
            ) : (
                <button onClick={() => onNext(isCorrect)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-3.5 text-sm font-bold text-white shadow-md transition-all active:scale-[0.99]">
                    {isLast ? 'View Final Results' : 'Next Question'} <ArrowRight className="h-4 w-4" />
                </button>
            )}
        </motion.div>
    )
}

// ─── MCQ — Score Summary ──────────────────────────────────────────────────────
export function QuizSummary({ score, total, topic, difficulty, onRetry }) {
    const pct = Math.round((score / total) * 100)
    
    // Grading logic
    const grade = pct >= 90 ? { label: 'Outstanding!', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', Icon: Trophy }
        : pct >= 80 ? { label: 'Great Job!', color: 'text-[#2E9BDA]', bg: 'bg-blue-50', border: 'border-blue-200', Icon: Award }
        : pct >= 50 ? { label: 'Good Effort!', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', Icon: BookOpen }
        : { label: 'Keep Practicing!', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', Icon: Zap }

    // Certificate state
    const isEligible = pct >= 80
    const [certStatus, setCertStatus] = useState('idle')

    const handleClaimCertificate = async () => {
        setCertStatus('loading')
        try {
            await issueCertificate({
                assessmentName: topic,
                score: pct,
                difficulty,
            })
            setCertStatus('success')
            toast.success('Certificate dispatched to your registered email!')
        } catch (error) {
            setCertStatus('error')
            toast.error(error.response?.data?.detail || 'Issuance failed. Please try again.')
        }
    }

    return (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-4 space-y-6 w-full max-w-xl mx-auto">

            {/* Score Ring */}
            <div className="relative">
                <div className="w-36 h-36 rounded-full flex items-center justify-center shadow-sm"
                    style={{ background: `conic-gradient(#2E9BDA 0% ${pct}%, #f1f5f9 ${pct}% 100%)` }}>
                    <div className="w-28 h-28 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                        <span className="text-3xl font-black text-slate-900">{pct}%</span>
                        <span className="text-xs font-bold text-slate-400">{score}/{total} correct</span>
                    </div>
                </div>
                <div className={`absolute -top-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ${grade.color}`}>
                    <grade.Icon className="h-5 w-5" />
                </div>
            </div>

            {/* Title & Stats */}
            <div className="text-center">
                <h2 className={`text-2xl font-black ${grade.color}`}>{grade.label}</h2>
                <p className="mt-1 text-slate-600 text-sm">
                    Scored <strong>{score} out of {total}</strong> on <span className="font-semibold text-slate-900">{topic}</span> ({difficulty})
                </p>
            </div>

            {/* Progress Bars */}
            <div className="w-full space-y-3 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                {[['Correct Answers', score, 'bg-emerald-500', 'text-emerald-700', pct], ['Incorrect / Skipped', total - score, 'bg-rose-400', 'text-rose-700', 100 - pct]].map(([label, val, bar, txt, w]) => (
                    <div key={label} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-600 w-32 shrink-0">{label}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-200/80 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${bar}`} />
                        </div>
                        <span className={`text-xs font-bold w-6 text-right ${txt}`}>{val}</span>
                    </div>
                ))}
            </div>

            {/* E-Certificate Section */}
            <AnimatePresence>
                {isEligible && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }}
                        className="w-full overflow-hidden"
                    >
                        <div className={`p-5 rounded-2xl border ${grade.border} ${grade.bg} text-center`}>
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Award className={`h-5 w-5 ${grade.color}`} />
                                <h3 className={`font-bold text-base ${grade.color}`}>Official Achievement Certificate</h3>
                            </div>
                            
                            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                                You scored 80%+! Claim your verified digital certificate delivered directly to your email inbox.
                            </p>
                            
                            {certStatus === 'success' ? (
                                <div className="flex items-center justify-center gap-2 p-3 bg-white rounded-xl border border-emerald-100 text-emerald-700 text-xs font-bold">
                                    <CheckCircle2 className="h-4 w-4" /> Certificate Emailed Successfully!
                                </div>
                            ) : (
                                <button 
                                    onClick={handleClaimCertificate} 
                                    disabled={certStatus === 'loading'}
                                    className="w-full flex items-center justify-center gap-2 bg-[#2E9BDA] hover:bg-[#2585bd] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50 text-sm cursor-pointer"
                                >
                                    {certStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                    {certStatus === 'loading' ? 'Generating...' : 'Claim My Certificate'}
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full pt-2">
                <button onClick={onRetry} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                    <RotateCcw className="h-4 w-4" /> Try Again
                </button>
                <button onClick={onRetry} className="flex-1 py-3 rounded-xl bg-slate-900 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-all cursor-pointer">
                    New Topic
                </button>
            </div>
        </motion.div>
    )
}

// ─── Quick Topic Categories ───────────────────────────────────────────────────
const TOPIC_PRESETS = [
    { label: 'React', category: 'Frontend' },
    { label: 'JavaScript', category: 'Frontend' },
    { label: 'TypeScript', category: 'Frontend' },
    { label: 'Python', category: 'Backend' },
    { label: 'Node.js', category: 'Backend' },
    { label: 'SQL & DBMS', category: 'Database' },
    { label: 'System Design', category: 'Architecture' },
    { label: 'Docker & K8s', category: 'DevOps' },
    { label: 'AWS Cloud', category: 'DevOps' },
    { label: 'Data Structures', category: 'Core' },
    { label: 'RESTful APIs', category: 'Backend' },
    { label: 'Machine Learning', category: 'AI/ML' },
]

export default function Interview() {
    const [topic, setTopic] = useState('')
    const [difficulty, setDifficulty] = useState('medium')
    const [numQ, setNumQ] = useState(5)
    const [loading, setLoading] = useState(false)
    const [questions, setQuestions] = useState(null)
    const [currentIdx, setCurrentIdx] = useState(0)
    const [score, setScore] = useState(0)
    const [finished, setFinished] = useState(false)

    const loadingMsg = useLoadingMessages(loading, [
        `Analyzing ${topic || 'topic'} core concepts…`,
        `Synthesizing ${difficulty} practice questions…`,
        'Formulating comprehensive explanations…',
        'Finalizing test session…',
    ])

    const generate = async () => {
        if (!topic.trim()) { toast.error('Please enter or select a topic'); return }
        setLoading(true); setQuestions(null); setCurrentIdx(0); setScore(0); setFinished(false)
        try {
            const { data } = await api.post('/interview/quick-practice', { topic: topic.trim(), difficulty, num_questions: numQ })
            if (!data?.questions?.length) throw new Error('No questions returned')
            setQuestions(data.questions)
            toast.success(`${data.questions.length} Questions Ready!`)
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to generate questions. Please try again.') }
        finally { setLoading(false) }
    }

    const handleNext = (wasCorrect) => {
        const ns = wasCorrect ? score + 1 : score
        if (currentIdx >= questions.length - 1) { setScore(ns); setFinished(true) }
        else { setScore(ns); setCurrentIdx(i => i + 1) }
    }

    const reset = () => { setQuestions(null); setCurrentIdx(0); setScore(0); setFinished(false) }

    // ── Setup Screen ──────────────────────────────────────────────
    if (!questions && !loading) {
        return (
            <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
                {/* Premium Balanced Light Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white p-4 sm:p-6 shadow-sm border border-blue-100/80"
                >
                    <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#2E9BDA]/10 blur-2xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />

                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3.5">
                            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2E9BDA] to-indigo-600 text-white shadow-md shadow-blue-500/25 shrink-0">
                                <Brain className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2E9BDA]/10 text-[#2E9BDA] border border-[#2E9BDA]/20 text-[10.5px] font-bold tracking-wide uppercase">
                                    <Sparkles className="w-3 h-3 text-[#2E9BDA]" /> AI Mock Interview Studio
                                </div>
                                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 mt-1">
                                    Adaptive Skill Assessment
                                </h1>
                                <p className="text-xs sm:text-sm text-slate-600 max-w-lg mt-0.5">
                                    Generate targeted questions for any tech stack or role with real-time AI feedback.
                                </p>
                            </div>
                        </div>

                        {/* Quick Perks Chips */}
                        <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200/90 px-2.5 py-1 rounded-xl shadow-2xs">
                                <Zap className="w-3.5 h-3.5 text-amber-500" /> Instant Results
                            </div>
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200/90 px-2.5 py-1 rounded-xl shadow-2xs">
                                <Award className="w-3.5 h-3.5 text-emerald-600" /> E-Certificate (80%+)
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Main Setup Card */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-7 shadow-sm">
                    <div className="space-y-5">
                        {/* Topic Input */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                Select or Enter Topic
                            </label>
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && generate()}
                                    placeholder="e.g. React Hooks, SQL Joins, System Design, Python…"
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/30 focus:border-[#2E9BDA] focus:bg-white transition-all"
                                />
                                {topic && (
                                    <button
                                        type="button"
                                        onClick={() => setTopic('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Quick Topic Chips */}
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Popular Topics</p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {TOPIC_PRESETS.map((item) => {
                                    const isSelected = topic.toLowerCase() === item.label.toLowerCase()
                                    return (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => setTopic(item.label)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-[#2E9BDA] text-white shadow-sm'
                                                    : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Controls Grid (Difficulty & Questions) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            {/* Difficulty Selector */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                                    Difficulty Level
                                </label>
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                                    {['easy', 'medium', 'hard'].map((d) => {
                                        const isSelected = difficulty === d
                                        return (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDifficulty(d)}
                                                className={`py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-white text-slate-900 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Question Count Pills */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                                    Number of Questions
                                </label>
                                <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                                    {[5, 8, 10, 15].map((count) => {
                                        const isSelected = numQ === count
                                        return (
                                            <button
                                                key={count}
                                                type="button"
                                                onClick={() => setNumQ(count)}
                                                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-white text-slate-900 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                {count} Qs
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={generate}
                            disabled={!topic.trim()}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[#2E9BDA] hover:bg-[#2585bd] text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
                        >
                            <span>Start Practice Session</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Loading Screen ─────────────────────────────────────────────
    if (loading) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-8 text-center max-w-xl mx-auto shadow-sm">
                <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#2E9BDA]/10">
                    <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-[#2E9BDA] animate-spin" />
                    <Brain className="h-8 w-8 text-[#2E9BDA] animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Preparing "{topic}" Questions</h3>
                <p className="mt-1 text-xs text-slate-500">Generating customized {difficulty} level multiple-choice questions...</p>
                <AnimatePresence mode="wait">
                    <motion.p key={loadingMsg} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="mt-4 text-xs font-semibold text-[#2E9BDA]">
                        {loadingMsg}
                    </motion.p>
                </AnimatePresence>
            </motion.div>
        )
    }

    // ── Summary Screen ─────────────────────────────────────────────
    if (finished) {
        return (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-sm max-w-2xl mx-auto">
                <QuizSummary score={score} total={questions.length} topic={topic} difficulty={difficulty} onRetry={reset} />
            </div>
        )
    }

    // ── Active Quiz Cockpit ─────────────────────────────────────────
    return (
        <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-7 shadow-sm">
                {/* Header status bar */}
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 capitalize">{topic}</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold capitalize ${DIFF_COLOR[difficulty]}`}>
                            {difficulty}
                        </span>
                    </div>
                    <button
                        onClick={reset}
                        className="text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" /> Exit
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    <MCQCard
                        key={currentIdx}
                        question={questions[currentIdx]}
                        questionIndex={currentIdx}
                        totalQuestions={questions.length}
                        onNext={handleNext}
                        isLast={currentIdx >= questions.length - 1}
                    />
                </AnimatePresence>
            </div>
        </div>
    )
}