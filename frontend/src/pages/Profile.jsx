import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  Camera, Pencil, X, Mail, Loader2, Upload, MapPin,
  Link as LinkIcon, Github, Linkedin, FileText, CheckCircle,
  ExternalLink, Globe, Sparkles, Phone, GraduationCap,
  Building2, Calendar, ShieldCheck, Check, Copy, ArrowUpRight,
  Download, Trash2, Award
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AvatarRing, { getUserPlan } from '../components/AvatarRing'
import { uploadResume } from '../services/api'
import { resolveAvatarUrl, getInitials } from '../utils/avatarUtils'

// --- Components ---
const Crown = ({ size = 28, gradId, variant = 'gold' }) => {
  const isSilver = variant === 'silver'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isSilver ? "#F8FAFC" : "#FFF3C8"} />
          <stop offset="45%" stopColor={isSilver ? "#CBD5E1" : "#F3C24B"} />
          <stop offset="100%" stopColor={isSilver ? "#64748B" : "#B9812A"} />
        </linearGradient>
      </defs>
      <path d="M4.2 17.2h15.6v2a1 1 0 01-1 1H5.2a1 1 0 01-1-1v-2z" fill={`url(#${gradId})`} />
      <path d="M3.1 16.4 1.9 8.7a.62.62 0 01.98-.58l3.66 2.86 4.4-5.5a1.14 1.14 0 011.78 0l4.4 5.5 3.66-2.86a.62.62 0 01.98.58l-1.2 7.7a1 1 0 01-1 .84H4.1a1 1 0 01-1-.84z" fill={`url(#${gradId})`} />
      <circle cx="6.6" cy="10.4" r="1" fill={isSilver ? "#F8FAFC" : "#FFFAE6"} />
      <circle cx="12" cy="6.7" r="1.25" fill={isSilver ? "#F8FAFC" : "#FFFAE6"} />
      <circle cx="17.4" cy="10.4" r="1" fill={isSilver ? "#F8FAFC" : "#FFFAE6"} />
      <rect x="10.7" y="17.55" width="2.6" height="2.6" rx="0.4" fill={isSilver ? "#334155" : "#8A5A14"} transform="rotate(45 12 18.85)" />
    </svg>
  )
}

function PlanBadge({ user }) {
  const plan = getUserPlan(user)
  if (plan === 'free') return null

  const isPremium = plan === 'premium'

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border text-[11px] sm:text-xs font-bold tracking-wide shadow-xs ${isPremium
        ? 'bg-amber-100/90 text-amber-900 border-amber-300'
        : 'bg-slate-100 text-slate-700 border-slate-300'
      }`}>
      <span className="text-xs sm:text-sm">{isPremium ? '👑' : '🥈'}</span>
      {isPremium ? 'Premium' : 'Pro'}
    </div>
  )
}

function InfoItem({ label, value, icon: Icon }) {
  const strVal = typeof value === 'string' ? value.trim() : (value !== null && value !== undefined ? String(value).trim() : '')
  const labelStr = typeof label === 'string' ? label.toLowerCase() : ''

  const isUrl = Boolean(
    strVal && (
      strVal.startsWith('http://') || 
      strVal.startsWith('https://') || 
      strVal.startsWith('/portfolio') || 
      labelStr.includes('portfolio') || 
      labelStr.includes('linkedin') || 
      labelStr.includes('github')
    )
  )

  const href = strVal ? (
    strVal.startsWith('http://') || strVal.startsWith('https://') 
      ? strVal 
      : strVal.startsWith('/portfolio') 
        ? strVal 
        : `https://${strVal}`
  ) : ''

  return (
    <div className="flex flex-col gap-1 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-indigo-200/80 transition-colors">
      <dt className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon size={14} className="text-indigo-500 shrink-0" />}
          <span className="truncate">{label}</span>
        </span>
        {isUrl && strVal && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors"
            title="Open link"
          >
            Visit <ExternalLink size={10} />
          </a>
        )}
      </dt>
      <dd className="text-xs sm:text-sm font-semibold text-slate-800 break-words leading-snug">
        {strVal ? (
          isUrl ? (
            <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate block max-w-full">
              {strVal}
            </a>
          ) : (
            strVal
          )
        ) : (
          <span className="text-slate-400 italic font-normal text-xs">Not provided</span>
        )}
      </dd>
    </div>
  )
}

function Input({ label, value, onChange, textarea, placeholder, icon: Icon }) {
  // Use text-base on mobile to avoid iOS Safari auto-zoom on focus, and sm:text-sm on larger screens
  const baseClasses = "w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-base sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium shadow-xs"

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-3 sm:top-3.5 text-slate-400 pointer-events-none">
            <Icon size={16} />
          </div>
        )}
        {textarea ? (
          <textarea
            className="w-full p-3 sm:p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-base sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium shadow-xs resize-none"
            rows={3}
            value={value || ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            className={`${baseClasses} ${!Icon ? 'pl-3.5' : ''}`}
            value={value || ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}

// --- Main Component ---
export default function Profile() {
  const { user, updateProfile, uploadProfilePhoto, removeProfilePhoto, refreshUser } = useAuth()
  const fileInputRef = useRef(null)

  const userPlan = getUserPlan(user)
  const isPremium = userPlan === 'premium'
  const isPro = userPlan === 'pro'
  const hasCrown = isPremium || isPro

  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({})

  // Avatar error state
  const [imgError, setImgError] = useState(false)

  // Resume Upload State
  const [resumeFile, setResumeFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)

  const savedAvatarUrl = resolveAvatarUrl(user)
  useEffect(() => { setImgError(false) }, [savedAvatarUrl])
  const displayedAvatarUrl = imgError ? null : savedAvatarUrl

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        college: user.college || '',
        degree: user.degree || '',
        graduation_year: user.graduation_year || '',
        location: user.location || '',
        bio: user.bio || '',
        linkedin_url: user.linkedin_url || '',
        github_url: user.github_url || '',
        portfolio_url: user.portfolio_url || '',
      })
    }
  }, [user])

  // ── Load primary resume from profile on mount ────────────────────────
  useEffect(() => {
    if (user?.profile_resume_url) {
      setResumeFile({ name: user.profile_resume_name || 'My_Resume.pdf' })
      setUploadDone(true)
    }
  }, [user?.profile_resume_url, user?.profile_resume_name])

  // --- Profile Completion Calculation ---
  const profileStats = useMemo(() => {
    if (!user) return { percent: 0, items: [] }
    const checks = [
      { key: 'name', label: 'Full Name', done: Boolean(user.full_name?.trim()) },
      { key: 'email', label: 'Email Verified', done: Boolean(user.email) },
      { key: 'contact', label: 'Phone & Location', done: Boolean(user.phone?.trim() || user.location?.trim()) },
      { key: 'education', label: 'Education Details', done: Boolean(user.college?.trim() || user.degree?.trim()) },
      { key: 'bio', label: 'Career Bio', done: Boolean(user.bio?.trim()) },
      { key: 'resume', label: 'ATS Resume', done: Boolean(user.profile_resume_url || resumeFile) },
      { key: 'social', label: 'Portfolio or Links', done: Boolean(user.portfolio_url || user.linkedin_url || user.github_url) },
    ]
    const completed = checks.filter(c => c.done).length
    const percent = Math.round((completed / checks.length) * 100)
    return { percent, items: checks }
  }, [user, resumeFile])

  // --- Resume Drag & Drop Logic ---
  const onResumeDrop = useCallback(async (accepted) => {
    const file = accepted[0]
    if (!file) return

    setResumeFile(file)
    setUploadingResume(true)
    setUploadProgress(0)
    setUploadDone(false)

    try {
      await uploadResume(file, pct => setUploadProgress(pct))
      setUploadDone(true)
      await refreshUser()  // Sync user state so profile_resume_url/name are updated
      toast.success('Resume uploaded & parsed successfully! 🚀')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Resume upload failed')
      setResumeFile(null)
    } finally {
      setUploadingResume(false)
    }
  }, [refreshUser])

  const { getRootProps: getResumeRootProps, getInputProps: getResumeInputProps, isDragActive: resumeDrag } = useDropzone({
    onDrop: onResumeDrop, multiple: false, disabled: uploadingResume,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxSize: 10 * 1024 * 1024,
  })

  if (!user) return (
    <div className="flex h-[75vh] items-center justify-center bg-slate-50/50">
      <Loader2 className="animate-spin text-indigo-500" size={36} />
    </div>
  )

  const initials = getInitials(user.full_name)

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG, PNG, or WEBP allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setLoading(true)
    try {
      await uploadProfilePhoto(file)
      await refreshUser()
      setImgError(false)
      toast.success('Profile photo updated ✨')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!displayedAvatarUrl) return
    setLoading(true)
    try {
      if (typeof removeProfilePhoto === 'function') {
        await removeProfilePhoto()
      } else {
        await updateProfile({ profile_picture: null, avatar_url: null })
      }
      await refreshUser()
      setImgError(false)
      toast.success('Profile photo removed')
    } catch (err) {
      toast.error('Failed to remove photo')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const payload = { ...form, graduation_year: form.graduation_year ? Number(form.graduation_year) : null }
      await toast.promise(updateProfile(payload), {
        loading: 'Saving your profile...',
        success: 'Profile beautifully updated! 🎉',
        error: 'Save failed',
      })
      await refreshUser()
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  const copyLivePortfolioLink = () => {
    if (!user.portfolio_slug) return
    const url = `${window.location.origin}/portfolio/${user.portfolio_slug}`
    navigator.clipboard?.writeText(url)
    toast.success('Portfolio URL copied to clipboard! 📋')
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6 md:space-y-8 font-sans max-w-7xl mx-auto pb-6 sm:pb-8">

      {/* ── 1. Hero / Identity Card (Mobile First) ─────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-6 md:p-8 shadow-xs relative overflow-hidden"
      >
        {/* Subtle Ambient Background Glow */}
        <div className="absolute top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 bg-gradient-to-br from-indigo-100/50 via-purple-50/30 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-6 md:gap-8">
          
          {/* Avatar Container */}
          <div className="flex flex-col items-center gap-2.5 shrink-0">
            <div className="relative group select-none">
              {/* Premium Glow */}
              {isPremium && (
                <div className="absolute inset-0 rounded-full bg-[#F3C24B] opacity-25 group-hover:opacity-40 blur-lg transition-opacity duration-300 z-0" />
              )}

              <AvatarRing user={user} ringSize={112} shape="circle">
                <div className={`relative z-10 w-[104px] h-[104px] sm:w-[116px] sm:h-[116px] rounded-full overflow-hidden flex items-center justify-center text-white text-3xl sm:text-4xl font-black select-none border-4 shadow-md transition-transform duration-300 ${isPremium
                    ? 'border-[#F3C24B] bg-gradient-to-br from-[#F3C24B] to-[#B9812A] shadow-[#F3C24B]/30'
                    : 'border-white bg-gradient-to-br from-indigo-500 to-purple-600'
                  }`}>
                  {displayedAvatarUrl && !imgError ? (
                    <img
                      src={displayedAvatarUrl}
                      alt={user.full_name || 'Profile'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span className="tracking-tight">{initials}</span>
                  )}
                </div>
              </AvatarRing>

              {/* Floating Crown */}
              {hasCrown && (
                <div className="absolute -top-3.5 -right-1 z-20 rotate-[15deg] drop-shadow-md">
                  <Crown size={30} gradId="profilePageCrown" variant={isPremium ? 'gold' : 'silver'} />
                </div>
              )}

              {/* Camera Upload Action Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Change profile photo"
                className="absolute bottom-1 right-1 p-2 sm:p-2.5 bg-white text-indigo-600 rounded-full shadow-md border border-slate-200/90 hover:bg-indigo-50 active:scale-95 disabled:opacity-50 transition-all z-30 touch-manipulation cursor-pointer"
                aria-label="Upload profile photo"
              >
                <Camera size={15} strokeWidth={2.3} />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoSelect}
              />
            </div>

            {/* Quick Remove Photo Option (if user has custom photo) */}
            {displayedAvatarUrl && !imgError && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={loading}
                className="text-[10.5px] font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
                title="Remove custom photo and use initials"
              >
                <Trash2 size={11} /> Remove photo
              </button>
            )}
          </div>

          {/* User Details & Identity */}
          <div className="flex-1 min-w-0 text-center md:text-left flex flex-col justify-center">
            
            {/* Name & Plan Badge Header */}
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2 sm:mb-2.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight break-words">
                {user.full_name || 'Your Profile'}
              </h1>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <PlanBadge user={user} />
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold capitalize">
                  <ShieldCheck size={12} className="text-indigo-500" />
                  {user.role || 'Candidate'}
                </span>
              </div>
            </div>

            {/* Contact Pills */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs sm:text-sm font-semibold text-slate-600 mb-3 sm:mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl max-w-full">
                <Mail size={14} className="text-indigo-500 shrink-0" />
                <span className="truncate max-w-[220px] sm:max-w-none">{user.email}</span>
              </span>
              {user.location && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <MapPin size={14} className="text-emerald-500 shrink-0" />
                  <span className="truncate">{user.location}</span>
                </span>
              )}
              {user.phone && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <Phone size={14} className="text-indigo-500 shrink-0" />
                  <span>{user.phone}</span>
                </span>
              )}
            </div>

            {/* Action Bar on Mobile: Immediate Edit button access without scrolling down */}
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (editing) setForm({ ...user })
                  setEditing(!editing)
                }}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                  editing
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {editing ? (
                  <><X size={15} /> Cancel Editing</>
                ) : (
                  <><Pencil size={15} /> Edit Profile Info</>
                )}
              </button>

              {user.portfolio_slug && (
                <a
                  href={`/portfolio/${user.portfolio_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors"
                >
                  <Globe size={14} /> View Portfolio <ArrowUpRight size={13} />
                </a>
              )}
            </div>

          </div>
        </div>

        {/* ── Profile Strength Micro-Bar (Mobile & Desktop) ─────────────────── */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Award size={14} className="text-amber-500" /> Profile Strength
            </span>
            <span className="text-xs font-extrabold text-indigo-600 font-display">
              {profileStats.percent}% Complete
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2.5">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(10, profileStats.percent)}%` }}
            />
          </div>

          {/* Checklist chips that scroll horizontally on small mobile screens without breaking */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-semibold text-slate-500 custom-scrollbar">
            {profileStats.items.map((item) => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border whitespace-nowrap shrink-0 transition-colors ${
                  item.done
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    : 'bg-slate-50 text-slate-400 border-slate-200/60'
                }`}
              >
                {item.done ? <Check size={11} strokeWidth={2.8} /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── 2. Grid Layout: Left (Resume) & Right (Profile Data) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">

        {/* ── Left Column: Resume Upload Card ──────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/60 shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Active Resume</h2>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">Used for ATS scan & matches</p>
                </div>
              </div>

              {uploadDone && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-bold">
                  <CheckCircle size={11} /> Ready
                </span>
              )}
            </div>

            {/* Dropzone Container */}
            <div
              {...getResumeRootProps()}
              className={`flex flex-col items-center justify-center p-5 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-dashed transition-all cursor-pointer min-h-[160px] sm:min-h-[190px] select-none touch-manipulation ${
                resumeDrag
                  ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
                  : uploadDone
                    ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-400'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/60 hover:border-indigo-300'
              }`}
            >
              <input {...getResumeInputProps()} />

              {uploadingResume ? (
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center py-2">
                  <div className="relative w-14 h-14 mb-3">
                    <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                      <circle
                        cx="28" cy="28" r="24" fill="none" stroke="#4F46E5" strokeWidth="5"
                        strokeLinecap={uploadProgress > 0 ? "round" : "butt"}
                        strokeDasharray={150} strokeDashoffset={150 - (uploadProgress / 100) * 150}
                        style={{ transition: 'stroke-dashoffset 0.3s ease', opacity: uploadProgress > 0 ? 1 : 0 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-600">{uploadProgress}%</span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-700">Uploading & Parsing...</p>
                  <p className="text-[10px] text-slate-400 mt-1">Extracting skills & experience</p>
                </motion.div>
              ) : uploadDone ? (
                <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center text-center max-w-full px-2 py-1">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2.5 shrink-0 shadow-xs">
                    <CheckCircle size={22} />
                  </div>
                  
                  <p
                    className="text-xs sm:text-sm font-bold text-emerald-800 max-w-full truncate px-2"
                    title={resumeFile?.name || 'Resume Ready'}
                  >
                    {resumeFile?.name || 'Resume Ready'}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-600/80 mt-0.5">
                    Tap or drag file to replace
                  </p>

                  {/* Actions when uploaded: View link & Replace */}
                  <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    {user?.profile_resume_url && (
                      <a
                        href={user.profile_resume_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold shadow-2xs transition-colors"
                      >
                        <ExternalLink size={12} /> View File
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const input = document.querySelector('input[type="file"]')
                        if (input) input.click()
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Upload size={12} /> Replace
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center text-center py-2">
                  <div className="w-10 h-10 bg-white shadow-xs border border-slate-200 rounded-full flex items-center justify-center mb-2.5 text-slate-500">
                    <Upload size={18} />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">Tap to upload resume</p>
                  <p className="text-[11px] font-medium text-slate-400 mt-1">PDF or DOCX up to 10MB</p>
                </div>
              )}
            </div>

            {/* Quick helper tip */}
            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
              <Sparkles size={14} className="text-indigo-500 shrink-0 mt-0.5" />
              <span>Your uploaded resume is automatically synchronized with your ATS Matcher and AI Copilot.</span>
            </div>
          </div>
        </div>

        {/* ── Right Column: Data / Form Section ────────────────────────────── */}
        <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs flex flex-col">

          {/* Section Header */}
          <div className="px-4 py-3.5 sm:px-6 sm:py-4.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white/70 backdrop-blur-xs">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Profile Details</h2>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 mt-0.5">Personal background & professional links</p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                if (editing) setForm({ ...user })
                setEditing(!editing)
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                editing
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {editing ? <><X size={14} /> Cancel</> : <><Pencil size={14} /> Edit</>}
            </button>
          </div>

          {/* Section Body */}
          <div className="p-4 sm:p-6 md:p-8 flex-1">
            <AnimatePresence mode="wait">
              {!editing ? (
                <motion.div
                  key="view"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4 sm:space-y-6"
                >
                  {/* Primary Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                    <InfoItem label="Phone Number" value={user.phone} icon={Phone} />
                    <InfoItem label="Graduation Year" value={user.graduation_year} icon={Calendar} />
                    <InfoItem label="College / University" value={user.college} icon={Building2} />
                    <InfoItem label="Degree / Major" value={user.degree} icon={GraduationCap} />
                  </div>

                  {/* Bio / About Box */}
                  <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-indigo-50/40 border border-indigo-100/70">
                    <dt className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-600" /> Professional Summary / Bio
                    </dt>
                    <dd className="text-xs sm:text-sm font-medium text-slate-700 leading-relaxed break-words">
                      {user.bio ? (
                        user.bio
                      ) : (
                        <span className="text-slate-400 italic">No bio added yet. Add a brief summary about your expertise and goals to stand out to hiring teams.</span>
                      )}
                    </dd>
                  </div>

                  {/* Live Portfolio Callout Banner */}
                  {user.portfolio_slug && (
                    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-0.5">
                          <Sparkles size={14} className="text-amber-600 shrink-0" />
                          <span>Your Public Career Portfolio is Live!</span>
                        </div>
                        <p className="text-[11px] text-amber-800/80 truncate max-w-full">
                          /portfolio/{user.portfolio_slug}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={copyLivePortfolioLink}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100/60 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Copy size={12} /> Copy Link
                        </button>
                        
                        {!user.portfolio_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              const autoUrl = `${window.location.origin}/portfolio/${user.portfolio_slug}`
                              try {
                                await updateProfile({ portfolio_url: autoUrl })
                                if (refreshUser) await refreshUser()
                                toast.success('🎉 Live portfolio saved to profile!')
                              } catch (e) {
                                toast.error('Failed to update portfolio link.')
                              }
                            }}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Check size={12} /> Save to Profile
                          </button>
                        )}

                        <a
                          href={`/portfolio/${user.portfolio_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-100/60 transition-colors"
                          title="Open portfolio"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Social / Professional Links */}
                  <div className="pt-2 sm:pt-4 border-t border-slate-100">
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Social & Portfolio Links
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                      <InfoItem label="LinkedIn" value={user.linkedin_url} icon={Linkedin} />
                      <InfoItem label="GitHub" value={user.github_url} icon={Github} />
                      <InfoItem label="Portfolio" value={user.portfolio_url} icon={LinkIcon} />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4 sm:space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Input
                      label="Full Name"
                      value={form.full_name}
                      onChange={(v) => setForm({ ...form, full_name: v })}
                      placeholder="Jane Doe"
                    />
                    <Input
                      label="Phone Number"
                      value={form.phone}
                      onChange={(v) => setForm({ ...form, phone: v })}
                      placeholder="+1 (555) 000-0000"
                      icon={Phone}
                    />
                    <Input
                      label="College / University"
                      value={form.college}
                      onChange={(v) => setForm({ ...form, college: v })}
                      placeholder="Stanford University"
                      icon={Building2}
                    />
                    <Input
                      label="Degree / Major"
                      value={form.degree}
                      onChange={(v) => setForm({ ...form, degree: v })}
                      placeholder="B.S. Computer Science"
                      icon={GraduationCap}
                    />
                    <Input
                      label="Graduation Year"
                      value={form.graduation_year}
                      onChange={(v) => setForm({ ...form, graduation_year: v })}
                      placeholder="2025"
                      icon={Calendar}
                    />
                    <Input
                      label="Location"
                      value={form.location}
                      onChange={(v) => setForm({ ...form, location: v })}
                      placeholder="San Francisco, CA"
                      icon={MapPin}
                    />
                  </div>

                  <div>
                    <Input
                      label="Professional Bio"
                      value={form.bio}
                      onChange={(v) => setForm({ ...form, bio: v })}
                      textarea
                      placeholder="Write a concise overview of your background, technical interests, and projects..."
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-400">
                      External Links & Profiles
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label="LinkedIn URL"
                        icon={Linkedin}
                        value={form.linkedin_url}
                        onChange={(v) => setForm({ ...form, linkedin_url: v })}
                        placeholder="linkedin.com/in/username"
                      />
                      <Input
                        label="GitHub URL"
                        icon={Github}
                        value={form.github_url}
                        onChange={(v) => setForm({ ...form, github_url: v })}
                        placeholder="github.com/username"
                      />
                      <div className="space-y-1">
                        <Input
                          label="Portfolio URL"
                          icon={LinkIcon}
                          value={form.portfolio_url}
                          onChange={(v) => setForm({ ...form, portfolio_url: v })}
                          placeholder="yourportfolio.dev"
                        />
                        {user.portfolio_slug && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, portfolio_url: `${window.location.origin}/portfolio/${user.portfolio_slug}` })}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Sparkles size={11} /> Use site portfolio: /portfolio/{user.portfolio_slug}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form Action Buttons: Full width and stacked on mobile, row on desktop */}
                  <div className="pt-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...user })
                        setEditing(false)
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-center cursor-pointer min-h-[44px] flex items-center justify-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={loading}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200/50 flex items-center justify-center gap-2 cursor-pointer min-h-[44px] active:scale-98"
                    >
                      {loading && <Loader2 size={16} className="animate-spin" />}
                      {loading ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>

    </div>
  )
}