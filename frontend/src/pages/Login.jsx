import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'


export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('candidate');

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back! 🚀');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-white flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* LEFT SECTION (Same as before) */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#F0F4F8] flex-col justify-center p-12">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-5xl font-black text-slate-900 mb-6">
            Welcome back <br />
            <span className="text-blue-600">CareerAI</span>
          </h1>
          <p className="text-slate-500">AI-powered career insights await you 🚀</p>
        </motion.div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px]">
          
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Sign In</h2>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" /> Resume Intelligence Activated
            </p>
          </div>

          {/* 1. ROLE SELECTOR (Moved Up for better logic) */}
          <div className="mb-6">
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">I am a:</p>
            <div className="flex bg-slate-100 rounded-xl p-1">
              {['candidate', 'recruiter'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    selectedRole === role ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setSelectedRole(role)}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                placeholder="Email"
                className={`w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.email ? 'border-red-500' : 'border-slate-200'}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</p>}
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                {...register('password', { required: 'Password is required' })}
                type="password"
                placeholder="Password"
                className={`w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.password ? 'border-red-500' : 'border-slate-200'}`}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1 ml-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-200"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="relative my-8 text-center">
            <hr className="border-slate-100" />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-slate-400 text-xs font-bold uppercase">Or continue with</span>
          </div>

          {/* GOOGLE LOGIN */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  await googleLogin(credentialResponse.credential, selectedRole)
                  toast.success('Welcome! 🚀')
                  navigate('/dashboard')
                } catch (err) {
                  toast.error(err.response?.data?.detail || 'Google login failed')
                }
              }}
              onError={() => toast.error('Google Sign-In failed')}
              useOneTap
              theme="outline"
              shape="pill"
            />
          </div>

          {/* SIGNUP LINK */}
          <div className="mt-8 text-center text-sm text-slate-500">
            New user?{' '}
            <Link to="/signup" className="text-blue-600 font-bold hover:underline">
              Create account
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
