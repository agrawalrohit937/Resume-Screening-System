import { useState, useRef, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { 
  Camera, Pencil, X, Mail, Loader2, Upload, MapPin, 
  Link as LinkIcon, Github, Linkedin, FileText, CheckCircle 
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AvatarRing, { getUserPlan } from '../components/AvatarRing'
import { uploadResume } from '../services/api' 

// --- Utility Functions ---
function resolveAvatarUrl(user) {
  if (!user) return null
  const pics = [user.profile_picture, user.display_picture, user.google_picture]
  const found = pics.find(pic => pic && String(pic).startsWith('http'))
  if (found) return found
  if (user.profile_picture) return `/uploads/profile/${user.profile_picture}`
  return null
}

function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0].toUpperCase()
}

// --- Components ---
const Crown = ({ size = 28, gradId }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF3C8" />
        <stop offset="45%" stopColor="#F3C24B" />
        <stop offset="100%" stopColor="#B9812A" />
      </linearGradient>
    </defs>
    <path d="M4.2 17.2h15.6v2a1 1 0 01-1 1H5.2a1 1 0 01-1-1v-2z" fill={`url(#${gradId})`} />
    <path d="M3.1 16.4 1.9 8.7a.62.62 0 01.98-.58l3.66 2.86 4.4-5.5a1.14 1.14 0 011.78 0l4.4 5.5 3.66-2.86a.62.62 0 01.98.58l-1.2 7.7a1 1 0 01-1 .84H4.1a1 1 0 01-1-.84z" fill={`url(#${gradId})`} />
    <circle cx="6.6" cy="10.4" r="1" fill="#FFFAE6" />
    <circle cx="12" cy="6.7" r="1.25" fill="#FFFAE6" />
    <circle cx="17.4" cy="10.4" r="1" fill="#FFFAE6" />
    <rect x="10.7" y="17.55" width="2.6" height="2.6" rx="0.4" fill="#8A5A14" transform="rotate(45 12 18.85)" />
  </svg>
)

function PlanBadge({ user }) {
  const plan = getUserPlan(user)
  if (plan === 'free') return null

  const isPremium = plan === 'premium'
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold tracking-wide shadow-sm ${
      isPremium 
        ? 'bg-amber-100 text-amber-800 border-amber-300' 
        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }`}>
      <span className="text-sm">{isPremium ? '👑' : '✨'}</span>
      {isPremium ? 'Premium' : 'Pro'}
    </div>
  )
}

function InfoItem({ label, value, icon: Icon }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-100/50">
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
        {Icon && <Icon size={14} className="text-indigo-400" />}
        {label}
      </dt>
      <dd className="text-sm font-semibold text-slate-800 truncate">
        {value || <span className="text-slate-400 italic font-medium">Not provided</span>}
      </dd>
    </div>
  )
}

function Input({ label, value, onChange, textarea, placeholder, icon: Icon }) {
  const baseClasses = "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm text-slate-800 placeholder:text-slate-400 font-medium shadow-sm"
  
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-3.5 text-slate-400">
            <Icon size={16} />
          </div>
        )}
        {textarea ? (
          <textarea 
            className={`w-full p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm text-slate-800 placeholder:text-slate-400 font-medium shadow-sm resize-none`} 
            rows={4} 
            value={value} 
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} 
          />
        ) : (
          <input 
            className={`${baseClasses} ${!Icon ? 'pl-4' : ''}`} 
            value={value} 
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
  const { user, updateProfile, uploadProfilePhoto, refreshUser } = useAuth()
  const fileInputRef = useRef(null)

  const isPremium = getUserPlan(user) === 'premium'

  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({})

  // Preview state
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [imgError, setImgError] = useState(false)

  // Resume Upload State
  const [resumeFile, setResumeFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)

  const savedAvatarUrl = resolveAvatarUrl(user)
  useEffect(() => { setImgError(false) }, [savedAvatarUrl])
  const displayedAvatarUrl = previewUrl || (imgError ? null : savedAvatarUrl)

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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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
    <div className="flex h-[80vh] items-center justify-center bg-slate-50/50">
      <Loader2 className="animate-spin text-indigo-500" size={40} />
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

  const handleCancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ── Hero / Header Section ───────────────────────────────────────────── */}
        <div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-sm relative overflow-hidden">
          
          {/* Subtle Background Accent */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-100/40 to-purple-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          {/* Avatar Area */}
          <div className="flex flex-col items-center gap-5 z-10">
            <div className="relative group">
              
              {/* Premium Background Glow */}
              {isPremium && (
                <div className="absolute inset-0 rounded-full bg-[#F3C24B] opacity-0 group-hover:opacity-40 blur-xl transition-opacity duration-500 z-0" />
              )}

              <AvatarRing user={user} ringSize={128} shape="circle">
                <div className={`relative z-10 w-[120px] h-[120px] rounded-full overflow-hidden flex items-center justify-center text-white text-4xl font-black select-none border-4 shadow-xl transition-transform duration-300 group-hover:scale-105 ${
                  isPremium 
                    ? 'border-[#F3C24B] bg-gradient-to-br from-[#F3C24B] to-[#B9812A] shadow-[#F3C24B]/30' 
                    : 'border-white bg-gradient-to-br from-indigo-500 to-purple-600'
                }`}>
                  {displayedAvatarUrl && !imgError ? (
                    <img
                      src={displayedAvatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span className="tracking-tight">{initials}</span>
                  )}
                </div>
              </AvatarRing>

              {/* Tiny Floating Crown for Premium Users */}
              {isPremium && (
                <div className="absolute -top-4 -right-1 z-20 rotate-[15deg] drop-shadow-xl">
                  <Crown size={34} gradId="profilePageCrown" />
                </div>
              )}

              {/* Camera Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="absolute bottom-2 right-2 p-3 bg-white text-indigo-600 rounded-full shadow-lg border border-slate-100 hover:bg-indigo-50 hover:scale-110 disabled:opacity-50 transition-all z-30"
              >
                <Camera size={18} strokeWidth={2.5} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoSelect}
              />
            </div>

            {/* Photo Actions (Visible only when previewing) */}
            <AnimatePresence>
              {previewFile && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="flex flex-col gap-2 w-full"
                >
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleUploadConfirm}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 transition-all"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      Save Photo
                    </button>
                    <button
                      onClick={handleCancelPreview}
                      disabled={loading}
                      className="flex items-center justify-center px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 shadow-sm disabled:opacity-50 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Details */}
          <div className="flex-1 text-center md:text-left flex flex-col justify-center h-full pt-2 z-10">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{user.full_name}</h1>
              <PlanBadge user={user} />
            </div>
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-sm font-semibold text-slate-500">
              <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                <Mail size={16} className="text-indigo-400" /> {user.email}
              </span>
              {user.location && (
                <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <MapPin size={16} className="text-emerald-400" /> {user.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ── Left Column: Resume Upload ───────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-200/60 p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <FileText className="text-indigo-600" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Your Resume</h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">Upload to use AI features</p>
                </div>
              </div>

              <div 
                {...getResumeRootProps()} 
                className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer min-h-[220px] ${
                  resumeDrag ? 'border-indigo-400 bg-indigo-50/50 scale-[1.02]' : 
                  uploadDone ? 'border-emerald-400 bg-emerald-50/30' : 
                  'border-slate-200 bg-slate-50 hover:bg-slate-100/50 hover:border-indigo-300'
                }`}
              >
                <input {...getResumeInputProps()} />
                
                {uploadingResume ? (
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                    <div className="relative w-16 h-16 mb-4">
                      <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="32" cy="32" r="28" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                        <circle cx="32" cy="32" r="28" fill="none" stroke="#4F46E5" strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={176} strokeDashoffset={176 - (uploadProgress / 100) * 176}
                          style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-indigo-600">{uploadProgress}%</span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-700">Uploading & Parsing...</p>
                  </motion.div>
                  ) : uploadDone ? (
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center text-center max-w-full px-2">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3 shrink-0">
                      <CheckCircle className="text-emerald-500" size={24} />
                    </div>
                    {/* Method 1: break-all ya truncate karke overflow roko */}
                    <p 
                      className="text-sm font-bold text-emerald-700 max-w-full truncate px-2"
                      title={resumeFile?.name || 'Resume Ready'}
                    >
                      {resumeFile?.name || 'Resume Ready'}
                    </p>
                    <p className="text-xs font-medium text-emerald-600/70 mt-1">Click or drag to replace</p>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-4">
                      <Upload className="text-slate-400" size={20} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Drag & Drop Resume</p>
                    <p className="text-xs font-medium text-slate-500 mt-2">PDF or DOCX up to 10MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right Column: Data / Form Section ──────────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden shadow-sm flex flex-col">
            
            {/* Section Header */}
            <div className="px-8 py-6 border-b border-slate-100/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Profile Details</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Manage your personal information and links</p>
              </div>
              <button
                onClick={() => {
                  if (editing) setForm({ ...user }) // reset form if cancelling
                  setEditing(!editing)
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                  editing 
                    ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' 
                    : 'bg-indigo-600 border border-transparent text-white hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-200/50'
                }`}
              >
                {editing ? <><X size={16} /> Cancel</> : <><Pencil size={16} /> Edit Profile</>}
              </button>
            </div>

            {/* Section Body */}
            <div className="p-8 flex-1">
              <AnimatePresence mode="wait">
                {!editing ? (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-6"
                  >
                    <InfoItem label="Phone Number" value={user.phone} />
                    <InfoItem label="Graduation Year" value={user.graduation_year} />
                    <InfoItem label="College / University" value={user.college} />
                    <InfoItem label="Degree" value={user.degree} />
                    
                    <div className="md:col-span-2 mt-2 p-6 rounded-2xl bg-indigo-50/30 border border-indigo-100/50">
                      <dt className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">About / Bio</dt>
                      <dd className="text-sm font-medium text-slate-700 leading-relaxed max-w-3xl">
                        {user.bio || <span className="text-slate-400 italic">No bio provided. Write a little about yourself to stand out!</span>}
                      </dd>
                    </div>

                    <div className="md:col-span-2 pt-4 border-t border-slate-100/50">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Social Links</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <InfoItem label="LinkedIn" value={user.linkedin_url} icon={Linkedin} />
                        <InfoItem label="GitHub" value={user.github_url} icon={Github} />
                        <InfoItem label="Portfolio" value={user.portfolio_url} icon={LinkIcon} />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input label="Full Name" value={form.full_name} onChange={(v) => setForm({...form, full_name: v})} />
                      <Input label="Phone Number" value={form.phone} onChange={(v) => setForm({...form, phone: v})} placeholder="+1 (555) 000-0000" />
                      <Input label="College / University" value={form.college} onChange={(v) => setForm({...form, college: v})} />
                      <Input label="Degree" value={form.degree} onChange={(v) => setForm({...form, degree: v})} placeholder="B.S. Computer Science" />
                      <Input label="Graduation Year" value={form.graduation_year} onChange={(v) => setForm({...form, graduation_year: v})} placeholder="2024" />
                      <Input label="Location" value={form.location} onChange={(v) => setForm({...form, location: v})} placeholder="City, State" />
                    </div>

                    <div className="pt-2">
                      <Input label="Bio" value={form.bio} onChange={(v) => setForm({...form, bio: v})} textarea placeholder="Tell us a little bit about yourself..." />
                    </div>

                    <div className="pt-6 border-t border-slate-100/50 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Input label="LinkedIn URL" icon={Linkedin} value={form.linkedin_url} onChange={(v) => setForm({...form, linkedin_url: v})} placeholder="linkedin.com/in/..." />
                      <Input label="GitHub URL" icon={Github} value={form.github_url} onChange={(v) => setForm({...form, github_url: v})} placeholder="github.com/..." />
                      <Input label="Portfolio URL" icon={LinkIcon} value={form.portfolio_url} onChange={(v) => setForm({...form, portfolio_url: v})} placeholder="yourwebsite.com" />
                    </div>

                    <div className="pt-8 flex justify-end gap-3">
                      <button
                        onClick={() => { setForm({...user}); setEditing(false); }}
                        className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200/50"
                      >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}