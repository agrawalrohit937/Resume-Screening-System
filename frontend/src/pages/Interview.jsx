import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
    Sparkles,
    Award,
    Loader2,
    Mail,
    Zap,
    Target,
    Layers,
    Brain,
    BookOpen,
    RotateCcw,
    Check,
    CheckCircle2,
    ArrowRight,
    Trophy,
    X,
    Lightbulb,
} from 'lucide-react'
import api from '../services/api'
import { issueCertificate } from '../services/certificateApi'
import CustomDropdown from '../components/common/CustomDropdown'

// ─── Color Helpers ───────────────────────────────────────────────────────────
const DIFF_COLOR = {
    easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-600   bg-amber-50   border-amber-200',
    hard: 'text-rose-600    bg-rose-50    border-rose-200',
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

            {/* Progress Bars */}
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

            {/* E-Certificate Section */}
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

// ─── MCQ Practice Component ───────────────────────────────────────────────────
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
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-5">
                <div className="lg:sticky lg:top-6 space-y-4 sm:space-y-5 rounded-3xl border border-white bg-white/80 p-4 sm:p-6 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5 sm:pb-4">
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
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
                            placeholder="e.g. React Hooks, SQL Joins, Docker…"
                            className="block w-full rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div>
                        <p className="mb-2 text-xs font-medium text-slate-500">Quick-pick a topic</p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {QUICK_TOPICS.map(t => (
                                <button key={t} onClick={() => setTopic(t)}
                                    className={`rounded-lg border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold transition-all ${topic === t ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                        }`}>{t}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Difficulty</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['easy', 'medium', 'hard'].map(d => (
                                <button key={d} onClick={() => setDifficulty(d)}
                                    className={`rounded-xl border py-2.5 text-xs font-semibold capitalize transition-all ${difficulty === d ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        }`}>{d}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Number of Questions</label>
                        <CustomDropdown
                            value={numQ}
                            onChange={val => setNumQ(+val)}
                            options={[
                                { value: 5, label: '5 questions' },
                                { value: 8, label: '8 questions' },
                                { value: 10, label: '10 questions' },
                                { value: 15, label: '15 questions' }
                            ]}
                            className="w-full"
                        />
                    </div>
                    <button onClick={generate} disabled={!topic.trim()}
                        className="group w-full overflow-hidden rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                        <span className="flex items-center justify-center gap-2">
                            Generate Practice Questions
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </button>
                </div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-7 flex min-h-[350px] py-10 lg:h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 text-center px-6">
                <div className="mb-4 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 shadow-inner">
                    <Brain className="h-8 w-8 sm:h-9 sm:w-9" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Test your knowledge instantly</h2>
                <p className="mt-2 sm:mt-3 max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">Pick a topic, set difficulty, and generate AI questions. Submit each answer to see the correct option with a full explanation.</p>
                <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-2">
                    {['Zero Setup', 'Instant Answer Reveal', 'Deep Explanations', 'E-Certificate at 80%+'].map(f => (
                        <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                            <Check className="h-3.5 w-3.5 text-indigo-500" /> {f}
                        </span>
                    ))}
                </div>
            </motion.div>
        </div>
    )

    // ── Loading Screen ─────────────────────────────────────────────
    if (loading) return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[350px] py-12 lg:h-[500px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 text-center px-6">
            <div className="relative mb-6 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-indigo-50">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                <Brain className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-500 animate-pulse" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Building your "{topic}" questions</h3>
            <p className="mt-2 max-w-sm text-xs sm:text-sm text-slate-500">Our AI is crafting personalized {difficulty} questions just for you.</p>
            <AnimatePresence mode="wait">
                <motion.p key={loadingMsg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="mt-4 text-xs font-semibold uppercase tracking-widest text-indigo-500">
                    {loadingMsg}
                </motion.p>
            </AnimatePresence>
        </motion.div>
    )

    // ── Summary Screen ─────────────────────────────────────────────
    if (finished) return (
        <div className="rounded-3xl border border-white bg-white/80 p-4 sm:p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
            <QuizSummary score={score} total={questions.length} topic={topic} difficulty={difficulty} onRetry={reset} />
        </div>
    )

    // ── Active Quiz Cockpit ─────────────────────────────────────────
    return (
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
            <div className="lg:col-span-3">
                <div className="lg:sticky lg:top-6 space-y-4 rounded-2xl border border-white bg-white/80 p-4 sm:p-5 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                    <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Topic</p><p className="text-sm font-bold text-slate-800 capitalize">{topic}</p></div>
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

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Interview() {
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
                                <Sparkles className="h-3.5 w-3.5" /> AI MCQ Coach
                            </span>
                            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">Sharpen Your Edge.</h1>
                            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
                                AI-powered multiple choice practice across any topic, tech stack, or difficulty level — test yourself with instant feedback, explanations &amp; verifiable certifications.
                            </p>
                            <div className="mt-4 sm:mt-5 flex flex-wrap gap-1.5 sm:gap-2">
                                {[
                                    { icon: Zap, label: 'Instant Generation' },
                                    { icon: Target, label: 'Targeted Concepts' },
                                    { icon: CheckCircle2, label: 'Real-time Explanations' },
                                    { icon: Award, label: 'E-Certificate Eligible' },
                                ].map(({ icon: Icon, label }) => (
                                    <span key={label} className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-slate-200 bg-white/70 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-slate-600">
                                        <Icon className="h-3.5 w-3.5 text-indigo-500" /> {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Content: MCQ Practice Cockpit */}
                <MCQPractice />
            </div>
        </div>
    )
}