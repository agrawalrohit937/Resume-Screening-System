import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import illustration from '../assets/illustration.png'
export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { role: 'candidate' } })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await signup(data)
      toast.success('Account created! Welcome 🎉')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Signup failed')
    } finally { setLoading(false) }
  }

  const steps = [
    { n: '01', t: 'Upload Resume', d: 'PDF or DOCX parsed by AI in seconds' },
    { n: '02', t: 'Match Jobs', d: 'Hybrid BERT + TF-IDF scoring engine' },
    { n: '03', t: 'Get Hired', d: 'Optimized resume beats ATS filters' },
  ]
return (
  <div className="h-screen bg-[#E8F4F8] relative overflow-hidden">

    {/* 🔹 LEFT TEXT */}
    <div className="absolute top-[35px] left-[110px] w-[420px] z-10">

      {/* LOGO */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-[40px] h-[40px] bg-[#2E9BDA] rounded-full flex items-center justify-center text-white font-bold">
          C
        </div>
        <span className="text-[30px] font-semibold text-[#111827]">
          CareerAI
        </span>
      </div>

      {/* HEADING */}
      <h1 className="text-[50px] leading-[56px] font-bold text-[#111827]">
        Scale your <br />
        <span className="text-[#0b9ce5ff]">career</span> to <br />
        new heights.
      </h1>

      {/* SUBTEXT */}
      <p className="text-[18px] text-[#6B7280] mt-5">
        The only AI platform designed to bridge the <br />
        gap between talent and opportunity.
      </p>
    </div>

    {/* 🔹 IMAGE */}
    <div className="relative w-full h-full rounded-[90px] overflow-hidden">

      <div className="absolute bottom-[20px] left-[120px] z-0">
        <img
          src={illustration}
          alt="illustration"
          className="w-[550px] max-w-none object-contain"
        />
      </div>

      {/* LEFT GRADIENT */}
      <div className="absolute left-0 bottom-0 h-full w-[30%] 
      bg-gradient-to-r from-[#E8F4F8] via-[#E8F4F8]/80 to-transparent"></div>

    </div>

    {/* 🔹 RIGHT CARD */}
    <div className="absolute top-[30px] right-[130px] bottom-[20px] w-[650px] z-20">

      <div className="w-full h-full bg-white rounded-[28px] border border-[#D1D5DB] shadow-[0_30px_80px_rgba(0,0,0,0.08)] flex items-center">

        {/* INNER CONTENT */}
        <div className="w-full px-[48px]">

          <h2 className="text-[30px] font-semibold text-[#111827]">
            Join the future.
          </h2>

          <p className="text-[#6B7280] mt-1 mb-6 text-[14px] italic">
            “Luck is what happens when preparation meets AI.”
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* ROLE */}
            <div className="relative">
              <select
                {...register("role")}
                className="w-full h-[48px] border border-[#D1D5DB] rounded-[8px] px-4 text-[#374151] bg-white"
              >
                <option value="candidate">I am a Candidate</option>
                <option value="recruiter">I am a Recruiter</option>
              </select>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400">👤</span>
              <input
                {...register("name")}
                placeholder="Full Name"
                className="w-full h-[48px] pl-12 border border-[#D1D5DB] rounded-[8px] px-4"
              />
            </div>

            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400">✉️</span>
              <input
                {...register("email")}
                type="email"
                placeholder="Email Address"
                className="w-full h-[48px] pl-12 border border-[#D1D5DB] rounded-[8px] px-4"
              />
            </div>

            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400">🔒</span>
              <input
                {...register("password")}
                type="password"
                placeholder="Password"
                className="w-full h-[48px] pl-12 border border-[#D1D5DB] rounded-[8px] px-4"
              />
            </div>
                <div className="relative">
            <span className="absolute left-4 top-3 text-slate-400">🔐</span>
            <input
              type="password"
              placeholder="Confirm Password"
              className="w-full pl-12 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </div>

                <button className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 rounded-xl font-semibold hover:scale-[1.01] transition">
            Sign Up
          </button>

          </form>

          {/* 🔹 SOCIAL LOGIN */}
          <div className="text-center text-sm text-[#6B7280] mt-6">
            or continue with
          </div>

          <div className="flex gap-3 mt-4">

            {/* GOOGLE */}
            <a
              href="https://accounts.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-[48px] border border-[#D1D5DB] rounded-[8px] flex items-center justify-center gap-2 hover:bg-gray-50"
            >
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
                className="w-5 h-5"
              />
              <span>Google</span>
            </a>

            {/* LINKEDIN */}
            <a
              href="https://www.linkedin.com/login"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-[48px] border border-[#D1D5DB] rounded-[8px] flex items-center justify-center gap-2 hover:bg-gray-50"
            >
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg"
                alt="LinkedIn"
                className="w-5 h-5"
              />
              <span>LinkedIn</span>
            </a>

          </div>

          <p className="text-center text-sm mt-5 text-[#6B7280]">
            Already a member?
            <Link to="/login" className="text-[#2E9BDA] ml-1">
              Sign In
            </Link>
          </p>

        </div>
      </div>
    </div>

  </div>
);}