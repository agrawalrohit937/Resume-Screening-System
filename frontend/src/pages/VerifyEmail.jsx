import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const RESEND_COOLDOWN = 60

export default function VerifyEmail() {
  const { verifyEmail, verifyLoginOtp, resendOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Two modes share this screen:
  // 1) signup verification: location.state = { email }
  // 2) secure-login challenge: location.state = { email, challengeToken, mode: 'login' }
  const email = location.state?.email
  const challengeToken = location.state?.challengeToken
  const mode = location.state?.mode || 'signup'

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const inputsRef = useRef([])

  useEffect(() => {
    if (!email) {
      navigate('/signup')
    }
  }, [email, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleChange = (idx, value) => {
    if (!/^[0-9]?$/.test(value)) return
    const next = [...otp]
    next[idx] = value
    setOtp(next)
    if (value && idx < 5) inputsRef.current[idx + 1]?.focus()
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').trim().slice(0, 6)
    if (!/^\d+$/.test(pasted)) return
    e.preventDefault()
    const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6)
    setOtp(next)
    inputsRef.current[Math.min(pasted.length, 5)]?.focus()
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      toast.error('Enter the full 6-digit code')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await verifyLoginOtp(challengeToken, code)
        toast.success('Welcome back! 🚀')
      } else {
        await verifyEmail(email, code)
        toast.success('Email verified! 🎉')
      }
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setResending(true)
    try {
      await resendOtp(email, mode === 'login' ? 'login_verification' : 'signup_verification')
      toast.success('A new code has been sent')
      setCooldown(RESEND_COOLDOWN)
      setOtp(['', '', '', '', '', ''])
      inputsRef.current[0]?.focus()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-[#E8F5FA] via-white to-white px-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 border border-slate-100"
      >
        <div className="flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2E9BDA]/10">
            <ShieldCheck className="h-7 w-7 text-[#2E9BDA]" />
          </div>
        </div>

        <h1 className="mt-5 text-center font-display text-[24px] font-bold text-[#111827]">
          {mode === 'login' ? 'Verify it\u2019s you' : 'Verify your email'}
        </h1>
        <p className="mt-1.5 text-center text-[14px] text-slate-500">
          We sent a 6-digit code to <span className="font-semibold text-slate-700">{email}</span>
        </p>

        <form onSubmit={onSubmit} className="mt-7">
          <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputsRef.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={loading}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="h-[54px] w-[44px] rounded-xl border border-slate-200 bg-white text-center text-[20px] font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group mt-7 flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-[14px] font-bold text-white shadow-lg shadow-[#2E9BDA]/20 transition-all hover:shadow-[#2E9BDA]/35 disabled:opacity-60"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <>
                <span>Verify</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-[13px] text-slate-500">
          {cooldown > 0 ? (
            <span>Resend code in {cooldown}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-[#2E9BDA] hover:underline disabled:opacity-60"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-[13px] text-slate-400">
          Wrong email?{' '}
          <Link to="/signup" className="font-semibold text-[#2E9BDA] hover:underline">
            Start over
          </Link>
        </p>
      </motion.div>
    </div>
  )
}