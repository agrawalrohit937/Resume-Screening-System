import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { GoogleLogin } from '@react-oauth/google'
import { Mail, Lock, User, Briefcase, Sparkles } from 'lucide-react'

export default function Signup() {
  const { signup, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { role: 'candidate' }
  })

  // Watch selected role to send it with Google Login
  const selectedRole = watch("role")

  // ✅ MANUAL SIGNUP SUBMIT
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
        toast.success('Your journey begins! 🚀')
        navigate('/dashboard')
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

  // ✅ GOOGLE AUTH SUCCESS HANDLER
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true)
    try {
      // Login.jsx ki tarah yahan bhi .credential (ID Token) bhej rahe hain
      await googleLogin(credentialResponse.credential, selectedRole)
      toast.success('Welcome to CareerAI! 🚀')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Google signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-full bg-white flex flex-col lg:flex-row overflow-hidden font-sans">
      
      {/* LEFT SECTION */}
      <div className="relative hidden lg:flex lg:w-[45%] bg-[#F0F4F8] flex-col justify-center p-12">
        <div className="relative z-20">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">
              Q
            </div>
            <span className="text-xl font-black text-slate-800">CareerAI</span>
          </div>

          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-5xl font-black text-slate-900 mb-6">
              Scale your <br />
              <span className="text-blue-600">career</span>
            </h1>
            <p className="text-slate-500">Join thousands of professionals using AI to grow.</p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-[400px] py-10"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Join Now</h2>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" /> Start your AI-powered journey
            </p>
          </div>

          {/* GOOGLE LOGIN BUTTON */}
          <div className="mb-8 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google Sign-In failed')}
              useOneTap
              theme="outline"
              width="100%"
              shape="pill"
            />
          </div>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or continue with email</span></div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                {...register('full_name', { required: 'Name is required' })}
                placeholder="Full Name"
                className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                placeholder="Email Address"
                className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 chars' } })}
                type="password"
                placeholder="Password"
                className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                {...register('role')}
                className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
              >
                <option value="candidate">Candidate</option>
                <option value="recruiter">Recruiter</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
