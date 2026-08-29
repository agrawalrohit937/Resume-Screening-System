import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Mail, Lock, KeyRound, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const RESEND_COOLDOWN = 60

export default function ForgotPassword() {
  const { forgotPassword, verifyResetOtp, resetPassword, resendOtp } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1: email, 2: otp, 3: new password, 4: done
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
      toast.success('If an account exists, a code has been sent')
      setStep(2)
      setCooldown(RESEND_COOLDOWN)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await verifyResetOtp(email, otp)
      setResetToken(data.reset_token)
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    try {
      await resendOtp(email, 'password_reset')
      toast.success('A new code has been sent')
      setCooldown(RESEND_COOLDOWN)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not resend code')
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email, resetToken, newPassword)
      setStep(4)
      toast.success('Password updated!')
      setTimeout(() => navigate('/login'), 1800)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reset password')
    } finally {
      setLoading(false)
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
        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                step >= s ? 'w-8 bg-[#2E9BDA]' : 'w-4 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h1 className="font-display text-[24px] font-bold text-[#111827]">Forgot password?</h1>
              <p className="mt-1.5 text-[14px] text-slate-500">Enter your email and we'll send you a code to reset it.</p>

              <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={loading}
                    className="h-[46px] w-full rounded-xl border border-slate-200/80 bg-white pl-12 pr-4 text-[14px] shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-[14px] font-bold text-white shadow-lg shadow-[#2E9BDA]/20 transition-all hover:shadow-[#2E9BDA]/35 disabled:opacity-60"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : (
                    <>Send code <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h1 className="font-display text-[24px] font-bold text-[#111827]">Enter the code</h1>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[14px] text-slate-500 truncate">
                  Sent to <span className="font-semibold text-slate-700">{email}</span>
                </p>
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); }}
                  className="text-xs font-bold text-[#2E9BDA] hover:underline shrink-0 ml-2"
                >
                  Change email
                </button>
              </div>

              <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    disabled={loading}
                    className="h-[46px] w-full rounded-xl border border-slate-200/80 bg-white pl-12 pr-4 text-[16px] tracking-widest shadow-sm outline-none transition-all placeholder:text-slate-400 placeholder:tracking-normal focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="group flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-[14px] font-bold text-white shadow-lg shadow-[#2E9BDA]/20 transition-all hover:shadow-[#2E9BDA]/35 disabled:opacity-60"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : (
                    <>Verify code <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
                <div className="text-center text-[13px] text-slate-500">
                  {cooldown > 0 ? (
                    <span>Resend in {cooldown}s</span>
                  ) : (
                    <button type="button" onClick={handleResend} className="font-semibold text-[#2E9BDA] hover:underline">
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <h1 className="font-display text-[24px] font-bold text-[#111827]">Create new password</h1>
              <p className="mt-1.5 text-[14px] text-slate-500">Make it at least 8 characters with letters & numbers.</p>

              <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    disabled={loading}
                    className="h-[46px] w-full rounded-xl border border-slate-200/80 bg-white pl-12 pr-12 text-[14px] shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#2E9BDA]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={loading}
                    className="h-[46px] w-full rounded-xl border border-slate-200/80 bg-white pl-12 pr-12 text-[14px] shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#2E9BDA]"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-[14px] font-bold text-white shadow-lg shadow-[#2E9BDA]/20 transition-all hover:shadow-[#2E9BDA]/35 disabled:opacity-60"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Update password'}
                </button>
              </form>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="mt-4 font-display text-[22px] font-bold text-[#111827]">Password updated!</h1>
              <p className="mt-1.5 text-[14px] text-slate-500">Redirecting you to login…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {step < 4 && (
          <p className="mt-6 text-center text-[13px] text-slate-400">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-[#2E9BDA] hover:underline">
              Back to login
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  )
}