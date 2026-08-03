import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useGoogleLogin } from '@react-oauth/google'
import { Mail, Lock, User, Eye, EyeOff, Briefcase, ArrowRight, CheckCircle2 } from 'lucide-react'

const illustration = '/illustration.png';

const getOAuthRedirectUri = (envVal, path) => {
  if (envVal && typeof envVal === 'string' && !envVal.includes('localhost')) {
    return envVal;
  }
  return `${window.location.origin}${path}`;
};

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '860awpba0h82no';
const LINKEDIN_REDIRECT_URI = getOAuthRedirectUri(import.meta.env.VITE_LINKEDIN_REDIRECT_URI, '/linkedin-callback');

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23liO6t7Tun6tzlpYq';
const GITHUB_REDIRECT_URI = getOAuthRedirectUri(import.meta.env.VITE_GITHUB_REDIRECT_URI, '/github-callback');

export default function Signup() {
  const { signup, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { role: 'candidate' }
  })

  const selectedRole = watch("role")

  // OAuth Redirect Handlers
  const handleLinkedInLogin = () => {
    const linkedinUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      LINKEDIN_REDIRECT_URI
    )}&state=${selectedRole}&scope=openid%20profile%20email`;
    window.location.href = linkedinUrl;
  };

  const handleGithubLogin = () => {
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      GITHUB_REDIRECT_URI
    )}&state=${selectedRole}&scope=user:email`;
    window.location.href = githubUrl;
  };

  // MANUAL SIGNUP SUBMIT
  // ── CHANGED: signup() now returns { success, message, email } instead of tokens.
  // The account stays inactive until the OTP is verified, so we navigate to
  // /verify-email and pass the email along via router state (FEATURE 1).
  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const payload = {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        role: data.role,
        phone: "",
        linkedin_url: "",
        github_username: ""
      }

      const res = await signup(payload)
      if (res) {
        toast.success(res.message || 'Verification code sent to your email 📩')
        navigate('/verify-email', { state: { email: data.email, mode: 'signup' } })
      }
    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail?.[0]?.msg ||
                       err.response?.data?.detail ||
                       "Signup failed"
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // GOOGLE AUTH HANDLER — updated to use useGoogleLogin hook
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true)
      try {
        await googleLogin(codeResponse.access_token, selectedRole)
        toast.success('Welcome to CareerShala! 🚀')
        navigate('/dashboard')
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Google signup failed')
      } finally {
        setLoading(false)
      }
    },
    onError: () => toast.error('Google Sign-In failed')
  });

  return (
    // FIX 1: Fluid layout on mobile, absolute single-page constraints on desktop templates
    <div className="min-h-screen lg:h-screen w-full max-w-full bg-white font-sans lg:grid lg:grid-cols-[1.25fr_1fr] lg:overflow-hidden">

      {/* LEFT — BRAND PANEL */}
      <div className="relative hidden h-full flex-col justify-start overflow-hidden bg-gradient-to-b from-[#E8F5FA] via-[#D6EFF8] to-[#BCE2F1] px-16 pt-14 lg:flex">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#2E9BDA]/15 blur-3xl" />

        {/* BACKGROUND ILLUSTRATION */}
        <div className="absolute bottom-0 left-0 right-0 z-0 top-20 w-full h-[100%] pointer-events-none overflow-hidden flex items-end">
          <img
            src={illustration}
            alt="Career illustration background"
            className="w-full h-full object-cover object-bottom origin-bottom opacity-70 animate-[float_6s_ease-in-out_infinite]"
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 flex-shrink-0">
          <img
            src="/logo_t.png"
            alt="CareerShala Logo"
            className="w-10 h-10 object-contain shrink-0"
          />
          <span className="font-display text-[22px] font-bold text-[#111827]">
            Career<span className="text-[#2E9BDA]">Shala</span>
          </span>
        </div>

        {/* Headline + Value Props */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 mt-12 max-w-md flex-shrink-0"
        >
          <h1 className="font-display text-[44px] font-bold leading-[1.15] tracking-tight text-[#111827]">
            Scale your <br />
            <span className="text-[#2E9BDA]">career</span> to <br />
            new heights.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#4B5563] font-medium">
            The only AI platform designed to bridge the gap between talent and opportunity.
          </p>

          <ul className="mt-6 space-y-3.5">
            {[
              'AI-powered personalized resume insights',
              'Real conversations with verified recruiters',
              'Smart matchmaking customized to your skills',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[14px] font-semibold text-[#1F2937] drop-shadow-sm">
                <CheckCircle2 className="h-[18px] w-[18px] flex-shrink-0 text-[#2E9BDA] bg-white rounded-full shadow-sm" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* RIGHT — AUTH FORM */}
      {/* FIX 2: Switched items-center to items-start on mobile viewports so content stays top-anchored and scrolls elegantly */}
      <div className="flex h-full items-start lg:items-center justify-center bg-white px-6 py-10 sm:px-12 lg:justify-start lg:pl-16 xl:pl-24 overflow-y-auto">
        <div className="w-full max-w-[400px]">

          {/* Mobile-only logo */}
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <img
              src="/logo_t.png"
              alt="CareerShala Logo"
              className="w-9 h-9 object-contain shrink-0"
            />
            <span className="font-display text-[19px] font-bold text-[#111827]">
              Career<span className="text-[#2E9BDA]">Shala</span>
            </span>
          </div>

          <h1 className="font-display text-[32px] font-bold tracking-tight text-[#111827]">Join the future.</h1>
          <p className="mt-1 text-[14px] font-medium text-[#2E9BDA]">
            Get AI-powered resume insights & job matches in seconds.
          </p>

          {/* ROLE SELECTOR */}
          <div className="relative mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {['candidate', 'recruiter'].map((role) => {
              const Icon = role === 'candidate' ? User : Briefcase
              const active = selectedRole === role
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setValue("role", role)}
                  className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
                    active ? 'text-[#1d6fa5]' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="role-pill-signup"
                      className="absolute inset-0 rounded-lg bg-white shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10 capitalize">{role}</span>
                </button>
              )
            })}
          </div>
          <input type="hidden" {...register("role")} />

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">

            {/* FULL NAME */}
            <div>
              <label htmlFor="full_name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  id="full_name"
                  type="text"
                  placeholder="John Doe"
                  disabled={loading}
                  {...register('full_name', {
                    required: 'Name is required',
                    minLength: { value: 2, message: 'Name must be at least 2 characters' }
                  })}
                  className={`h-[46px] w-full rounded-xl border bg-white pl-12 pr-4 text-[14px] shadow-sm outline-none transition-all placeholder:text-slate-400 ${
                    errors.full_name
                      ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-200/80 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10'
                  }`}
                />
              </div>
              {errors.full_name && <p className="mt-1 ml-1 text-[12px] text-red-500">{errors.full_name.message}</p>}
            </div>

            {/* EMAIL */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  disabled={loading}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address"
                    }
                  })}
                  className={`h-[46px] w-full rounded-xl border bg-white pl-12 pr-4 text-[14px] shadow-sm outline-none transition-all placeholder:text-slate-400 ${
                    errors.email
                      ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-200/80 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10'
                  }`}
                />
              </div>
              {errors.email && <p className="mt-1 ml-1 text-[12px] text-red-500">{errors.email.message}</p>}
            </div>

            {/* PASSWORD */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={loading}
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 chars' } })}
                  className={`h-[46px] w-full rounded-xl border bg-white pl-12 pr-12 text-[14px] shadow-sm outline-none transition-all placeholder:text-slate-400 ${
                    errors.password
                      ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-200/80 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => !loading && setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#2E9BDA]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 ml-1 text-[12px] text-red-500">{errors.password.message}</p>}
            </div>

            {/* CONFIRM PASSWORD */}
            <div>
              <label htmlFor="confirm_password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  id="confirm_password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={loading}
                  {...register('confirm_password', {
                    required: 'Please confirm your password',
                    validate: (value) => value === watch('password') || 'Passwords do not match'
                  })}
                  className={`h-[46px] w-full rounded-xl border bg-white pl-12 pr-4 text-[14px] shadow-sm outline-none transition-all placeholder:text-slate-400 ${
                    errors.confirm_password
                      ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-200/80 focus:border-[#2E9BDA] focus:ring-4 focus:ring-[#2E9BDA]/10'
                  }`}
                />
              </div>
              {errors.confirm_password && <p className="mt-1 ml-1 text-[12px] text-red-500">{errors.confirm_password.message}</p>}
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="group mt-1 flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-[14px] font-bold text-white shadow-lg shadow-[#2E9BDA]/20 transition-all hover:shadow-[#2E9BDA]/35 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Creating Account…
                </>
              ) : (
                <>
                  <span>Sign Up</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* SEPARATOR */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[12px] font-medium text-slate-400">or continue with</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* SOCIAL LOGINS GRID */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={loading}
              title="Continue with Google"
              className="flex h-[46px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:shadow-md disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleLinkedInLogin}
              disabled={loading}
              title="Continue with LinkedIn"
              className="flex h-[46px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0A66C2] shadow-sm transition-all hover:border-slate-300 hover:shadow-md disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleGithubLogin}
              disabled={loading}
              title="Continue with GitHub"
              className="flex h-[46px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:shadow-md disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </button>
          </div>

          <p className="mt-6 text-center text-[14px] text-slate-500">
            Already a member?{' '}
            <Link to="/login" className="font-semibold text-[#2E9BDA] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Outfit', sans-serif; }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}