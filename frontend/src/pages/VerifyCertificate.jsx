import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ShieldCheck,
    ShieldX,
    Loader2,
    Award,
    Calendar,
    Hash,
    Target,
    GraduationCap,
    Download,
    Sparkles,
} from 'lucide-react'
import { verifyCertificate } from '../services/certificateApi'

function Row({ icon: Icon, label, value }) {
    if (!value) return null
    return (
        <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                <Icon className="h-4 w-4" />
            </span>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-sm font-semibold text-slate-800">{value}</p>
            </div>
        </div>
    )
}

export default function VerifyCertificate() {
    const { certificateId } = useParams()
    const [state, setState] = useState('loading') // loading | valid | invalid | error
    const [data, setData] = useState(null)

    useEffect(() => {
        let cancelled = false
        setState('loading')
        verifyCertificate(certificateId)
            .then(res => {
                if (cancelled) return
                setData(res)
                setState(res.valid ? 'valid' : 'invalid')
            })
            .catch(() => { if (!cancelled) setState('error') })
        return () => { cancelled = true }
    }, [certificateId])

    return (
        <div className="min-h-screen bg-slate-50 [background-image:radial-gradient(circle_at_1px_1px,theme(colors.slate.200)_1px,transparent_0)] [background-size:24px_24px] px-6 py-12 font-sans text-slate-900">
            <div className="mx-auto max-w-lg">

                <div className="mb-8 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm">
                        <Sparkles className="h-3.5 w-3.5" /> CareerShala Certificate Verification
                    </span>
                </div>

                {state === 'loading' && (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-white bg-white/80 p-12 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                        <p className="mt-4 text-sm text-slate-500">Checking certificate…</p>
                    </div>
                )}

                {state === 'error' && (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
                        <p className="text-sm font-semibold text-amber-700">
                            Couldn't reach the verification service. Please try again in a moment.
                        </p>
                    </div>
                )}

                {state === 'invalid' && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl shadow-rose-100/40">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                            <ShieldX className="h-7 w-7" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">Invalid Certificate</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            {data?.reason === 'revoked'
                                ? 'This certificate has been revoked and is no longer valid.'
                                : "We couldn't find a certificate matching this ID. Double-check the link or QR code."}
                        </p>
                        <p className="mt-4 font-mono text-xs text-slate-400">{certificateId}</p>
                    </motion.div>
                )}

                {state === 'valid' && data && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="overflow-hidden rounded-3xl border border-white bg-white shadow-xl shadow-slate-200/50">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-center text-white">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                                <ShieldCheck className="h-7 w-7" />
                            </div>
                            <h1 className="text-xl font-bold">Certificate Verified</h1>
                            <p className="mt-1 text-sm text-indigo-100">Issued by CareerShala</p>
                        </div>

                        <div className="p-8">
                            <div className="mb-6 text-center">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Awarded to</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">{data.recipient_name}</p>
                            </div>

                            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-5">
                                <Row icon={Award} label="Certificate" value={data.title} />
                                <Row icon={Target} label="Score" value={data.score != null ? `${data.score}%` : null} />
                                <Row icon={GraduationCap} label="Grade" value={data.grade} />
                                <Row icon={Calendar} label="Issued on"
                                    value={data.issued_at ? new Date(data.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
                                <Row icon={Hash} label="Certificate ID" value={data.cert_id} />
                            </div>

                            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                {data.public_url && (
                                    <a href={data.public_url} target="_blank" rel="noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 active:scale-[0.99]">
                                        <Download className="h-4 w-4" /> Download
                                    </a>
                                )}
                                <a href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(`CareerShala ${data.title || 'Excellence'} Certificate`)}&organizationName=${encodeURIComponent('CareerShala')}&issueYear=${data.issued_at ? new Date(data.issued_at).getFullYear() : new Date().getFullYear()}&issueMonth=${data.issued_at ? new Date(data.issued_at).getMonth() + 1 : new Date().getMonth() + 1}&certId=${encodeURIComponent(data.cert_id || certificateId)}&certUrl=${encodeURIComponent(data.public_url || window.location.href)}`}
                                    target="_blank" rel="noreferrer"
                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#0A66C2] py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-[#084e96] active:scale-[0.99]">
                                    Add to LinkedIn
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}

                <p className="mt-8 text-center text-xs text-slate-400">
                    <Link to="/" className="hover:text-indigo-500">www.careershala.tech</Link>
                </p>
            </div>
        </div>
    )
}
