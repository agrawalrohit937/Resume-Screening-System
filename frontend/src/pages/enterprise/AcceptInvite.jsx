import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  Building2,
  Shield,
  Lock,
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Check,
  ShieldCheck,
  Briefcase,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { verifyInviteToken, acceptTeamInvite } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Loader from '../../components/Loader'

const ROLE_DISPLAY_MAP = {
  recruiter: { 
    title: 'Talent Recruiter', 
    color: 'text-blue-700 border-blue-200 bg-blue-50/80',
    scope: [
      'Create, manage, and publish job requisitions',
      'Screen candidate applications and evaluate ATS matches',
      'Manage pipeline stages and team candidate outreach'
    ]
  },
  hiring_manager: { 
    title: 'Hiring Manager', 
    color: 'text-purple-700 border-purple-200 bg-purple-50/80',
    scope: [
      'Review qualified applicant pipelines and scorecards',
      'Collaborate on team hiring decisions and candidate notes',
      'Coordinate interview schedules and rubric evaluations'
    ]
  },
  interviewer: { 
    title: 'Technical Interviewer', 
    color: 'text-indigo-700 border-indigo-200 bg-indigo-50/80',
    scope: [
      'Conduct assigned candidate interview sessions',
      'Evaluate live coding, technical skills, and behavioral rubrics',
      'Submit structured interview scores and feedback to hiring team'
    ]
  },
  executive: { 
    title: 'Executive Owner', 
    color: 'text-amber-800 border-amber-200 bg-amber-50/80',
    scope: [
      'Full administrative authority across organization tenant',
      'Manage team permissions, role invitations, and billing',
      'Access executive analytics, pipeline KPIs, and audit trails'
    ]
  },
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { setSession } = useAuth()

  const [verifying, setVerifying] = useState(true)
  const [inviteData, setInviteData] = useState(null)
  const [verificationError, setVerificationError] = useState(null)

  // Form State
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setVerificationError('No invitation token found in the link. Please check the URL.')
      setVerifying(false)
      return
    }

    const checkToken = async () => {
      try {
        setVerifying(true)
        const res = await verifyInviteToken(token)
        setInviteData(res.data)
      } catch (err) {
        console.error('Invite token verification failed:', err)
        const msg =
          err.response?.data?.detail ||
          'This invitation link is invalid or has expired. Please ask your administrator to send a new invite.'
        setVerificationError(msg)
      } finally {
        setVerifying(false)
      }
    }

    checkToken()
  }, [token])

  // Password validation checks
  const hasMinLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;':",./<>?]/.test(password)
  const isPasswordValid = hasMinLength && hasUpper && hasDigit && hasSpecial

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      toast.error('Please enter your full name (first and last name).')
      return
    }

    if (!isPasswordValid) {
      toast.error('Please satisfy all password security requirements.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    try {
      setSubmitting(true)
      const res = await acceptTeamInvite({
        token,
        full_name: fullName.trim(),
        password,
      })

      const data = res.data
      toast.success(`Welcome to the team, ${data.user?.full_name || 'colleague'}!`)

      // Immediately log user in with the returned session data
      if (setSession) {
        setSession(data)
      }

      // Route according to assigned role
      const assignedRole = (data.user?.role || inviteData?.role || '').toLowerCase()
      if (assignedRole === 'interviewer') {
        navigate('/interviewer/dashboard', { replace: true })
      } else if (assignedRole === 'hiring_manager') {
        navigate('/hiring-manager/dashboard', { replace: true })
      } else if (assignedRole === 'recruiter') {
        navigate('/recruiter/dashboard', { replace: true })
      } else if (assignedRole === 'executive' || assignedRole === 'exec') {
        navigate('/exec/dashboard', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      console.error('Failed to accept invitation:', err)
      toast.error(err.response?.data?.detail || 'Failed to complete registration.')
    } finally {
      setSubmitting(false)
    }
  }

  if (verifying) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-8 text-slate-800 z-50">
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/80 text-center space-y-4 max-w-md w-full shadow-lg relative z-10">
          <div className="flex justify-center">
            <Loader />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Validating Invitation...</h2>
          <p className="text-slate-500 text-xs">Verifying organization tenant credentials and security tokens.</p>
        </div>
      </div>
    )
  }

  if (verificationError) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#F8FAFC] flex items-center justify-center px-4 py-12 text-slate-800 z-50">
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/80 text-center space-y-5 max-w-md w-full shadow-lg relative z-10 my-auto">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">Invitation Unavailable</h2>
            <p className="text-slate-500 text-xs leading-relaxed">{verificationError}</p>
          </div>
          <div className="pt-3 flex flex-col gap-2.5">
            <Link
              to="/login"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-blue-500/20 text-center"
            >
              Go to Login
            </Link>
            <Link
              to="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors text-center"
            >
              Back to CareerShala Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const roleInfo = ROLE_DISPLAY_MAP[inviteData?.role] || {
    title: inviteData?.role || 'Team Member',
    color: 'text-indigo-700 border-indigo-200 bg-indigo-50/80',
    scope: [
      'Access your assigned enterprise workspace tools',
      'Collaborate with team members across tenant',
      'Review organization assets and reports'
    ]
  }

  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-y-contain bg-[#F8FAFC] flex flex-col font-sans text-slate-800 antialiased z-50">
      {/* Ambient background glows - fixed in the background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -left-28 -top-28 h-96 w-96 rounded-full bg-[#2E9BDA]/10 blur-3xl" />
        <div className="absolute -right-28 -bottom-28 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-4xl mx-auto my-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Branding Bar */}
        <div className="flex items-center justify-between px-2">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img 
              src="/logo_t.webp" 
              alt="CareerShala Logo" 
              className="w-9 h-9 object-contain shrink-0 group-hover:scale-105 transition-transform" 
            />
            <div>
              <span className="text-xl font-bold text-slate-900 tracking-tight leading-none block">
                Career<span className="text-[#2E9BDA]">Shala</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block mt-0.5">
                Enterprise Workspace
              </span>
            </div>
          </Link>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-indigo-700 border border-slate-200/80 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-mono text-slate-600">Tenant: <strong className="text-indigo-900">{inviteData?.tenant_id || 'Organization'}</strong></span>
          </div>
        </div>

        {/* Unified Two-Column Enterprise Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_1.25fr]">
          
          {/* Left Column: Organization & Role Context */}
          <div className="bg-gradient-to-b from-[#F0F7FD] via-[#F8FAFC] to-[#F1F5F9] border-b md:border-b-0 md:border-r border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-md uppercase tracking-wider mb-2 border border-blue-200/60">
                  <Sparkles className="w-3 h-3" />
                  Official Invitation
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Join Your Team on CareerShala
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                  You have been invited to join <strong className="text-slate-900">{inviteData?.tenant_id}</strong> as a verified enterprise team member.
                </p>
              </div>

              {/* Invitation Meta Card */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Assigned Role</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold border ${roleInfo.color}`}>
                    {roleInfo.title}
                  </span>
                </div>

                {inviteData?.invited_by_name && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-500 font-medium">Invited By</span>
                    <span className="text-slate-800 font-semibold text-right truncate max-w-[180px]">
                      {inviteData.invited_by_name}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Tenant Organization</span>
                  <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {inviteData?.tenant_id}
                  </span>
                </div>
              </div>

              {/* Role Scope & Responsibilities */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Role Capabilities & Access:
                </p>
                <div className="space-y-2">
                  {roleInfo.scope.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Security Note */}
            <div className="pt-4 border-t border-slate-200/70 flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Enterprise-grade security • End-to-end multi-tenant isolation</span>
            </div>
          </div>

          {/* Right Column: Account Activation Form */}
          <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-white">
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Activate Your Account
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Configure your secure credentials to finalize onboarding.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Work Email (Pre-verified) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Work Email
                  </label>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Pre-Verified
                  </span>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    disabled
                    value={inviteData?.email || ''}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/90 border border-slate-200 text-slate-600 text-sm cursor-not-allowed select-none font-medium shadow-2xs"
                  />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10 text-slate-900 text-sm outline-none transition-all font-medium placeholder:text-slate-400 shadow-2xs"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Create Secure Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10 text-slate-900 text-sm outline-none transition-all font-medium placeholder:text-slate-400 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength checklist */}
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50/90 border border-slate-200/70 space-y-1 text-[11px] font-medium">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-blue-600' : 'text-slate-300'}`} /> At least 8 characters
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasUpper ? 'text-blue-600' : 'text-slate-300'}`} /> At least one uppercase letter (A-Z)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasDigit ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasDigit ? 'text-blue-600' : 'text-slate-300'}`} /> At least one number (0-9)
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasSpecial ? 'text-blue-600' : 'text-slate-300'}`} /> At least one symbol (!@#$%^&*...)
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10 text-slate-900 text-sm outline-none transition-all font-medium placeholder:text-slate-400 shadow-2xs"
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 ml-1 text-xs text-red-500 font-medium">Passwords do not match.</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !isPasswordValid || password !== confirmPassword}
                className="w-full mt-2 py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-[#2E9BDA] to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Activating Account...
                  </>
                ) : (
                  <>
                    <span>Complete Setup & Join Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-[#2E9BDA] hover:text-blue-700 font-semibold hover:underline">
                Sign in directly
              </Link>
            </p>
          </div>
        </div>

        {/* Global Footer Copyright / Assurance */}
        <p className="text-center text-xs text-slate-400">
          © {new Date().getFullYear()} CareerShala Enterprise. All rights reserved.
        </p>
      </div>
    </div>
  )
}
