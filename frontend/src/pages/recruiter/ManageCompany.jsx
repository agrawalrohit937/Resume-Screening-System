import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  Globe,
  Link2,
  MapPin,
  Users,
  Sparkles,
  ExternalLink,
  Save,
  CheckCircle2,
  UploadCloud,
  Linkedin,
  Github,
  Heart,
  Share2,
  FileText,
  Edit2,
  Pencil,
  Plus,
  Trash2,
  Eye,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Image as ImageIcon,
  Loader2,
  Lock,
  ShieldAlert,
  Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { saveCompanyProfile, getJobsByCompany, getCompanyProfile, updateCompanyProfile } from '../../services/api'
import { resolveCompanyLogo } from '../../utils/avatarUtils'
import CustomDropdown from '../../components/common/CustomDropdown'
import CompanyLogo from '../../components/common/CompanyLogo'

export default function ManageCompany() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // RBAC: Check if user is Executive or Platform Admin
  const isExecOrAdmin = user?.roles?.some(r =>
    ['executive', 'exec', 'admin', 'platform_admin'].includes(String(r).toLowerCase())
  ) || ['executive', 'exec', 'admin', 'platform_admin'].includes(String(user?.role).toLowerCase())

  const [isReadOnly, setIsReadOnly] = useState(!isExecOrAdmin)

  // Form State
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('recruiter_company_profile')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) {}
    }
    return {
      company_name: user?.company_name || 'CareerPilot Technologies',
      tagline: 'Empowering careers with AI',
      logo_url: '',
      website: 'https://www.careerpilot.com',
      location: 'Bengaluru, India',
      industry: 'Technology',
      team_size: '51-200 employees',
      about:
        'At CareerPilot, we are building the next generation AI-powered career platform to connect talent with opportunities. Our mission is to empower individuals and organizations to achieve their full potential through technology, transparency, and trust.',
      linkedin: 'https://www.linkedin.com/company/careerpilot',
      github: 'https://github.com/careerpilot',
      perks: [],
    }
  })

  const [saving, setSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [newPerk, setNewPerk] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Load existing profile from backend via tenant-scoped /company endpoint with fallback
  useEffect(() => {
    let isMounted = true

    getCompanyProfile()
      .then((res) => {
        if (!isMounted) return
        if (res.data?.company_profile) {
          const cp = res.data.company_profile
          setFormData((prev) => ({
            ...prev,
            company_name: cp.company_name ?? prev.company_name ?? '',
            tagline: cp.tagline ?? prev.tagline ?? '',
            logo_url: cp.logo_url ?? prev.logo_url ?? '',
            website: cp.website ?? prev.website ?? '',
            location: cp.location ?? prev.location ?? '',
            industry: cp.industry ?? prev.industry ?? '',
            team_size: cp.team_size ?? prev.team_size ?? '',
            about: cp.about ?? prev.about ?? '',
            linkedin: cp.linkedin ?? prev.linkedin ?? '',
            github: cp.github ?? prev.github ?? '',
            perks: cp.perks?.length ? cp.perks : (prev.perks || []),
          }))
        }
        if (typeof res.data?.is_read_only === 'boolean') {
          setIsReadOnly(res.data.is_read_only)
        }
      })
      .catch(() => {
        // Fallback to legacy company lookup
        const company = formData.company_name || user?.company_name
        if (!company || !isMounted) return

        getJobsByCompany(company)
          .then((res) => {
            if (!isMounted) return
            if (res.data?.company_profile) {
              const cp = res.data.company_profile
              setFormData((prev) => ({
                ...prev,
                company_name: cp.company_name ?? prev.company_name ?? '',
                tagline: cp.tagline ?? prev.tagline ?? '',
                logo_url: cp.logo_url ?? prev.logo_url ?? '',
                website: cp.website ?? prev.website ?? '',
                location: cp.location ?? prev.location ?? '',
                industry: cp.industry ?? prev.industry ?? '',
                team_size: cp.team_size ?? prev.team_size ?? '',
                about: cp.about ?? prev.about ?? '',
                linkedin: cp.linkedin ?? prev.linkedin ?? '',
                github: cp.github ?? prev.github ?? '',
                perks: cp.perks?.length ? cp.perks : (prev.perks || []),
              }))
            }
          })
          .catch(() => {})
      })

    return () => { isMounted = false }
  }, [user?.company_name, user?.tenant_id])

  // Helper to safely persist to localStorage without failing on large base64 quota errors
  const safeSaveLocal = (data) => {
    try {
      localStorage.setItem('recruiter_company_profile', JSON.stringify(data))
    } catch (e) {
      try {
        const stripped = { ...data, logo_url: '' }
        localStorage.setItem('recruiter_company_profile', JSON.stringify(stripped))
      } catch {}
    }
  }

  // Redirect to Primary Website URL filled in the form
  const handleOpenPublicWebsite = () => {
    let url = formData.website?.trim()
    if (!url) {
      toast.error('Please enter a Primary Website URL first.')
      return
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Handle Save with RBAC protection
  const handleSave = async (e, isDraft = false) => {
    if (e) e.preventDefault()

    if (isReadOnly) {
      toast.error('Company profile is read-only for invited team members.')
      return
    }

    if (!formData.company_name?.trim()) {
      toast.error('Company name is required.')
      return
    }

    setSaving(true)
    try {
      await updateCompanyProfile(formData)
      safeSaveLocal(formData)
      toast.success(isDraft ? 'Company profile saved as draft! 📋' : 'Company profile published successfully! 🚀')
    } catch (err) {
      // Fallback to saveCompanyProfile
      try {
        await saveCompanyProfile(formData)
        safeSaveLocal(formData)
        toast.success(isDraft ? 'Company profile saved as draft! 📋' : 'Company profile published successfully! 🚀')
      } catch (fallbackErr) {
        const msg = err.response?.data?.detail || fallbackErr.response?.data?.detail || 'Failed to save company profile.'
        toast.error(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  // Handle File Input with immediate auto-upload & database save
  const processFile = (file) => {
    if (isReadOnly) {
      toast.error('Logo upload is restricted to Organization Executive / Admin.')
      return
    }

    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG, WebP).')
      return
    }

    if (file.size > 2.5 * 1024 * 1024) {
      toast.error('Image must be under 2MB.')
      return
    }

    setIsUploadingLogo(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const logoResult = reader.result
      const updated = {
        ...formData,
        logo_url: logoResult,
      }
      setFormData(updated)
      safeSaveLocal(updated)

      try {
        await updateCompanyProfile(updated)
        toast.success('Company logo updated successfully!')
      } catch (err) {
        try {
          await saveCompanyProfile(updated)
          toast.success('Company logo updated successfully!')
        } catch (fallbackErr) {
          toast.success('Company logo updated locally!')
        }
      } finally {
        setIsUploadingLogo(false)
      }
    }
    reader.onerror = () => {
      setIsUploadingLogo(false)
      toast.error('Failed to read image file.')
    }
    reader.readAsDataURL(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (isReadOnly) return
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  // Add Perk
  const handleAddPerk = (e) => {
    if (e) e.preventDefault()
    if (isReadOnly) return
    if (!newPerk.trim()) return
    if (formData.perks?.includes(newPerk.trim())) {
      toast.error('Perk already added.')
      return
    }
    setFormData((prev) => ({
      ...prev,
      perks: [...(prev.perks || []), newPerk.trim()],
    }))
    setNewPerk('')
  }

  // Remove Perk
  const handleRemovePerk = (index) => {
    if (isReadOnly) return
    setFormData((prev) => ({
      ...prev,
      perks: prev.perks.filter((_, i) => i !== index),
    }))
  }

  const resolvedLogo = resolveCompanyLogo(formData.logo_url)

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-32 font-sans text-slate-800 antialiased">

      {/* ── 1. Page Header (Seamless Image Fade UI) ─────────────────────────────────────────────── */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-[#eef3fb] border border-slate-200/60 shadow-sm min-h-[240px] flex items-center mb-6">

        {/* Background Image */}
        <div
          className="absolute top-0 right-0 w-[60%] h-full bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')"
          }}
        />

        {/* Color fade gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#eef3fb] from-[45%] via-[#eef3fb]/80 via-[60%] to-[#eef3fb]/0 z-0 pointer-events-none" />

        {/* Main Content Container */}
        <div className="relative z-10 w-full p-6 sm:p-8 md:p-10 h-full flex flex-col md:flex-row justify-between items-start gap-6">

          {/* Left Side: Text Content */}
          <div className="max-w-xl space-y-4 pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/70 text-indigo-700 text-[11px] font-bold tracking-wider uppercase border border-indigo-200/50">
              <Building2 size={13} />
              Employer Branding Suite
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Company Profile &amp; <span className="text-indigo-600">Branding</span>
            </h1>

            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Showcase your company's culture, mission, and key information to attract the right talent across CareerPilot.
            </p>
          </div>
        </div>
      </div>

      {/* ── 1.5. Read-Only RBAC Notice Banner (For Invited Staff) ───────────────── */}
      {isReadOnly && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/95 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <Lock size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-amber-900">Read-Only Organization Profile</h4>
              <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-[10px] font-bold uppercase tracking-wider">
                RBAC Enforced
              </span>
            </div>
            <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
              Company branding, logo, and organization settings are managed centrally by your organization's Executive or Administrator. As an invited team member, you have full visibility across these details.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Main Form Container ───────────────────────────────────────────── */}
      <form onSubmit={(e) => handleSave(e, false)} className="space-y-6">

        {/* ── 2. Card 1: Company Identity & Logo ───────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Building2 size={18} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 font-poppins">
                  Company Identity
                </h2>
                <p className="text-[11.5px] text-slate-400">
                  Set your company logo, official name, and public tagline.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px] font-bold">
                <CheckCircle2 size={13} className="text-emerald-600" />
                Verified Profile
              </span>

              <button
                type="button"
                onClick={handleOpenPublicWebsite}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 text-xs font-semibold border border-slate-200 transition cursor-pointer"
                title="Visit primary company website"
              >
                <span>View Public Page</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {/* Flex Layout: Left Logo Preview + Right Input Fields */}
          <div className="flex flex-col sm:flex-row items-start gap-6 pt-1">

            {/* Left: Logo Preview & Upload */}
            <div className="flex flex-col items-center gap-3 shrink-0 mx-auto sm:mx-0">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-amber-300 to-amber-500 rounded-full blur-[1px] opacity-90 translate-x-1.5 translate-y-1.5 pointer-events-none"></div>

                <div className="relative z-10 w-full h-full rounded-full bg-indigo-600 border-[3px] border-white shadow-sm overflow-hidden flex items-center justify-center">
                  {resolvedLogo ? (
                    <img
                      src={resolvedLogo}
                      alt={formData.company_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <CompanyLogo
                      companyName={formData.company_name}
                      logoUrl={formData.logo_url}
                      size="2xl"
                      className="w-full h-full rounded-full object-cover"
                    />
                  )}

                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-30 transition-all">
                      <Loader2 size={24} className="text-white animate-spin" />
                    </div>
                  )}
                </div>

                {!isReadOnly ? (
                  <label className="absolute -bottom-1 -right-1 z-20 w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 shadow-md cursor-pointer hover:text-indigo-600 hover:bg-slate-50 transition-colors">
                    <Pencil size={14} />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div
                    className="absolute -bottom-1 -right-1 z-20 w-8 h-8 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 shadow-xs"
                    title="Logo is managed by Organization Executive"
                  >
                    <Lock size={13} />
                  </div>
                )}
              </div>

              {!isReadOnly ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
                >
                  Change Logo
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 cursor-not-allowed bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"
                  title="Only Organization Executive can modify company logo"
                >
                  <Lock size={11} /> Change Logo
                </button>
              )}
            </div>

            {/* Right: Inputs */}
            <div className="flex-1 w-full space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">Company Name *</label>
                    {isReadOnly && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Read-Only</span>
                    )}
                  </div>
                  <div className="relative">
                    <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      disabled={isReadOnly}
                      readOnly={isReadOnly}
                      placeholder="e.g. CareerPilot Technologies"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className={`w-full pl-10 pr-3.5 py-2.5 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 transition ${
                        isReadOnly ? 'bg-slate-100/90 cursor-not-allowed text-slate-600 border-slate-300 select-none' : 'bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Primary Website</label>
                  <div className="relative">
                    <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder="e.g. https://www.careerpilot.com"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className={`w-full pl-10 pr-3.5 py-2.5 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 transition ${
                        isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-600' : 'bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company Tagline</label>
                <div className="relative">
                  <Sparkles size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    disabled={isReadOnly}
                    placeholder="e.g. Empowering careers with AI"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className={`w-full pl-10 pr-3.5 py-2.5 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 transition ${
                      isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-600' : 'bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Card 2: Overview & Key Statistics ─────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 font-poppins">
                Overview &amp; Key Details
              </h2>
              <p className="text-[11.5px] text-slate-400">
                Provide core statistics to give candidates clear context about your team.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Headquarters</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  disabled={isReadOnly}
                  placeholder="e.g. Bengaluru, India"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className={`w-full pl-10 pr-3.5 py-2.5 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 transition ${
                    isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-600' : 'bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Industry</label>
              <CustomDropdown
                disabled={isReadOnly}
                options={[
                  'Technology & Software',
                  'Finance & Fintech',
                  'Healthcare & Biotech',
                  'E-commerce & Retail',
                  'Education & Edtech',
                  'Media & Entertainment',
                  'Artificial Intelligence',
                  'Consulting & Services',
                  'Other'
                ]}
                value={formData.industry}
                onChange={(val) => !isReadOnly && setFormData({ ...formData, industry: val })}
                placeholder="Select Industry"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Team Size</label>
              <CustomDropdown
                disabled={isReadOnly}
                options={[
                  '1-10 employees',
                  '11-50 employees',
                  '51-200 employees',
                  '201-500 employees',
                  '501-1000 employees',
                  '1000+ employees'
                ]}
                value={formData.team_size}
                onChange={(val) => !isReadOnly && setFormData({ ...formData, team_size: val })}
                placeholder="Select Team Size"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">About the Company</label>
            <textarea
              rows={4}
              disabled={isReadOnly}
              placeholder="Describe your company's mission, values, and work culture..."
              value={formData.about}
              onChange={(e) => setFormData({ ...formData, about: e.target.value })}
              className={`w-full p-3.5 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 transition resize-none leading-relaxed ${
                isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-600' : 'bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
              }`}
            />
          </div>
        </div>

        {/* ── 4. Card 3: Culture, Benefits & Perks ──────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Heart size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 font-poppins">
                Culture, Benefits &amp; Perks
              </h2>
              <p className="text-[11.5px] text-slate-400">
                Highlight what makes working at your company special.
              </p>
            </div>
          </div>

          {/* Active Perks Badges */}
          {formData.perks?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {formData.perks.map((perk, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200"
                >
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  {perk}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemovePerk(idx)}
                      className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer ml-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Add Perk Input + Button (Hidden if Read-Only) */}
          {!isReadOnly && (
            <div className="flex items-center gap-3 pt-1">
              <input
                type="text"
                placeholder="e.g. Remote Work Stipend, Health Insurance, Unlimited PTO..."
                value={newPerk}
                onChange={(e) => setNewPerk(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddPerk()
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <button
                type="button"
                onClick={handleAddPerk}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus size={14} />
                Add Perk
              </button>
            </div>
          )}

          {/* Quick Suggestions (Hidden if Read-Only) */}
          {!isReadOnly && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Suggested Benefits &amp; Perks (Click to Add):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Flexible Working Hours',
                  'Comprehensive Health Insurance',
                  'Annual Learning Budget',
                  'Remote-First Culture',
                  '401(k) / Equity Matching',
                  'Home Office Setup Budget',
                  'Unlimited Paid Time Off (PTO)',
                  'Wellness & Gym Membership'
                ]
                  .filter((p) => !(formData.perks || []).includes(p))
                  .map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          perks: [...(prev.perks || []), suggestion],
                        }))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition cursor-pointer"
                    >
                      <Plus size={12} />
                      {suggestion}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 5. Card 4: Social Presence ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
              <Share2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 font-poppins">
                Social Presence
              </h2>
              <p className="text-[11.5px] text-slate-400">
                Add your social channels to build trust and visibility.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">LinkedIn URL</label>
              <div className="relative">
                <Linkedin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="url"
                  disabled={isReadOnly}
                  placeholder="https://www.linkedin.com/company/careerpilot"
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  className={`w-full pl-10 pr-3.5 py-2.5 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 transition ${
                    isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-600' : 'bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GitHub Organization</label>
              <div className="relative">
                <Github size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="url"
                  disabled={isReadOnly}
                  placeholder="https://github.com/careerpilot"
                  value={formData.github}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  className={`w-full pl-10 pr-3.5 py-2.5 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 transition ${
                    isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-600' : 'bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. Bottom Action Bar (Floating Sticky Footer Dock) ──────────── */}
        <div className="sticky bottom-6 z-40 mx-auto bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-2xl px-6 py-4 mt-8 flex items-center justify-between gap-4 transition-all">
          {isReadOnly ? (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Lock size={14} className="text-amber-600" />
                <span>Organization branding is read-only for invited team roles.</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
                <Lock size={13} className="text-slate-400" />
                <span>Editing Disabled</span>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={(e) => handleSave(e, true)}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{saving ? 'Saving...' : 'Save & Publish Profile'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

      </form>
    </div>
  )
}
