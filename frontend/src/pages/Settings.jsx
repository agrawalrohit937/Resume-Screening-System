import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Shield,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UserCheck,
  CreditCard,
  ChevronRight,
  Sparkles,
  Info,
  User,
  ExternalLink,
  Check,
  Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import AvatarRing from '../components/AvatarRing'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'

export default function Settings() {
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()

  // Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  // Determine auth nature
  const isSocialAuth = user?.provider && user?.provider !== 'email' && !user?.has_password
  const avatarUrl = resolveAvatarUrl(user)
  const initials = getInitials(user?.full_name || 'User')

  // Password requirements calculation
  const strengthChecks = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      hasNumber: /\d/.test(newPassword),
      hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
      matches: Boolean(newPassword && confirmPassword && newPassword === confirmPassword),
    }
  }, [newPassword, confirmPassword])

  const strengthScore = useMemo(() => {
    let score = 0
    if (strengthChecks.length) score += 33
    if (strengthChecks.hasNumber) score += 33
    if (strengthChecks.hasSpecial) score += 34
    return score
  }, [strengthChecks])

  const handleChangePassword = async (e) => {
    e.preventDefault()

    if (!currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (!strengthChecks.length) {
      toast.error('New password must be at least 8 characters long')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password')
      return
    }

    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success('Password updated successfully! 🎉')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update password'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Top Hero / Header Section ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-[2rem] border border-slate-200/70 p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden"
        >
          {/* Subtle Glow Accent */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-100/40 via-blue-50/20 to-purple-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex items-center gap-5 z-10">
            <AvatarRing user={user} ringSize={72} shape="circle">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden border-2 border-white shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </AvatarRing>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider mb-1.5">
                <Shield size={12} /> Account & Security
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {user?.full_name || 'Account Settings'}
              </h1>
              <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5">
                {user?.email} · <span className="capitalize font-bold text-indigo-600">{user?.plan ? `${user.plan} plan` : 'Free plan'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10 w-full md:w-auto">
            <button
              onClick={() => navigate('/profile')}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 shadow-sm transition-colors cursor-pointer"
            >
              <User size={14} className="text-slate-500" />
              Edit Profile
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200/50 transition-all cursor-pointer"
            >
              <CreditCard size={14} />
              Billing & Plans
            </button>
          </div>
        </motion.div>

        {/* ── Main Two-Column Layout ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ── Left Column: Password & Security (Spans 8 of 12) ─────────── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Change Password Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="bg-white rounded-[2rem] border border-slate-200/70 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 md:px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      Ensure your account uses a strong, unique password
                    </p>
                  </div>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 size={13} /> Active Credentials
                </span>
              </div>

              {/* Body */}
              <div className="p-6 md:p-8">
                {isSocialAuth ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-sm">
                      <UserCheck size={24} />
                    </div>
                    <div className="space-y-2 text-left">
                      <h3 className="text-sm font-bold text-slate-900">Single Sign-On Authentication Active</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Your account is securely authenticated through{' '}
                        <span className="font-bold capitalize text-slate-800">{user?.provider}</span>. You do not need to manage a standalone password because your identity is verified directly by your provider.
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => logout?.().then(() => navigate('/forgot-password'))}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          Switch to email & password via password reset <ExternalLink size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-6">
                    {/* Current Password Field */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type={showCurrent ? 'text' : 'password'}
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter your current password"
                          disabled={loading}
                          className="w-full pl-11 pr-11 py-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                        >
                          {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password & Confirm Password Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* New Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type={showNew ? 'text' : 'password'}
                            required
                            minLength={8}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            disabled={loading}
                            className="w-full pl-11 pr-11 py-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                          >
                            {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-type new password"
                            disabled={loading}
                            className="w-full pl-11 pr-11 py-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                          >
                            {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Password Strength Checklist */}
                    {newPassword.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Password Strength
                          </span>
                          <span
                            className={`text-xs font-black ${
                              strengthScore < 50
                                ? 'text-rose-600'
                                : strengthScore < 100
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {strengthScore < 50 ? 'Weak' : strengthScore < 100 ? 'Good' : 'Strong'}
                          </span>
                        </div>

                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              strengthScore < 50
                                ? 'bg-rose-500'
                                : strengthScore < 100
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${strengthScore}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                          <div className={`flex items-center gap-2 ${strengthChecks.length ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            <CheckCircle2 size={14} /> At least 8 characters
                          </div>
                          <div className={`flex items-center gap-2 ${strengthChecks.hasNumber ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            <CheckCircle2 size={14} /> Includes a number
                          </div>
                          <div className={`flex items-center gap-2 ${strengthChecks.hasSpecial ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            <CheckCircle2 size={14} /> Includes special symbol
                          </div>
                          <div className={`flex items-center gap-2 ${strengthChecks.matches ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            <CheckCircle2 size={14} /> Passwords match
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Submit Action */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Info size={14} className="text-slate-400" /> You will remain logged in on this browser session.
                      </p>
                      <button
                        type="submit"
                        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {loading ? 'Updating Password...' : 'Save New Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>

            {/* Security Best Practices Card */}
            <div className="bg-white rounded-[2rem] border border-slate-200/70 p-6 md:p-8 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600" /> Security Recommendations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Unique Password</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Avoid reusing passwords across different applications or services to protect your career data.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Session Protection</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Always sign out when accessing CareerShala from public or shared computers.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* ── Right Column: Account Status & Quick Links (Spans 4 of 12) ── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Account Security Overview Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="bg-white rounded-[2rem] border border-slate-200/70 p-6 md:p-7 shadow-sm space-y-5"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Security Health</h3>
                  <p className="text-xs text-slate-500 font-medium">Account status overview</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-600">Email Status</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={13} /> Verified
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-600">Login Method</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {user?.provider || 'Email & Password'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-600">Current Plan</span>
                  <span className="font-bold text-indigo-600 uppercase tracking-wide">
                    {user?.plan || 'Free Tier'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Quick Navigation Cards */}
            <div className="bg-white rounded-[2rem] border border-slate-200/70 p-6 md:p-7 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Navigation</h3>

              <div
                onClick={() => navigate('/billing')}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 hover:bg-indigo-50/60 border border-slate-200/70 hover:border-indigo-200 transition-all cursor-pointer group"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <CreditCard size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">Billing & Invoices</h4>
                    <p className="text-[11px] text-slate-500">Manage your subscription</p>
                  </div>
                </div>
                <ChevronRight size={15} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div
                onClick={() => navigate('/profile')}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 hover:bg-indigo-50/60 border border-slate-200/70 hover:border-indigo-200 transition-all cursor-pointer group"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <User size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">Career Profile</h4>
                    <p className="text-[11px] text-slate-500">Resume & personal details</p>
                  </div>
                </div>
                <ChevronRight size={15} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div
                onClick={() => navigate('/results')}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 hover:bg-indigo-50/60 border border-slate-200/70 hover:border-indigo-200 transition-all cursor-pointer group"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Zap size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">ATS Scanner</h4>
                    <p className="text-[11px] text-slate-500">Check resume compatibility</p>
                  </div>
                </div>
                <ChevronRight size={15} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
