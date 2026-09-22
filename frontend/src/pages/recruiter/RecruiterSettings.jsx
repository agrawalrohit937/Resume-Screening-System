import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  User,
  Bell,
  Lock,
  Shield,
  Mail,
  KeyRound,
  Building2,
  Briefcase,
  Phone
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

// Custom Tailwind CSS Toggle Switch (Pill-shaped)
function ToggleSwitch({ checked, onChange, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function RecruiterSettings() {
  const { user, updateProfile, changePassword } = useAuth()

  // Account State (loaded from user and localStorage)
  const [profileData, setProfileData] = useState(() => {
    let extra = {}
    try {
      const saved = localStorage.getItem('recruiter_preferences')
      if (saved) extra = JSON.parse(saved)
    } catch (e) {}

    return {
      full_name: user?.full_name || extra.full_name || 'Recruiter Lead',
      email: user?.email || '',
      phone: user?.phone || extra.phone || '',
      title: extra.title || 'Senior Technical Recruiter',
      company: user?.company_name || extra.company || 'Acme Technologies',
    }
  })

  // Sync if user object loads asynchronously
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        full_name: user.full_name || prev.full_name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
        company: user.company_name || prev.company,
      }))
    }
  }, [user])

  // Notification toggles (persisted in localStorage)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('recruiter_notifications')
      if (saved) return JSON.parse(saved)
    } catch (e) {}

    return {
      instant_applicant_alert: true,
      daily_digest: true,
      interview_reminder: true,
      marketing_updates: false,
    }
  })

  const handleToggleNotification = (key, val) => {
    const updated = { ...notifications, [key]: val }
    setNotifications(updated)
    try {
      localStorage.setItem('recruiter_notifications', JSON.stringify(updated))
    } catch (e) {}
  }

  // Password state
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const [savingAccount, setSavingAccount] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingAccount(true)
    try {
      if (updateProfile) {
        await updateProfile({
          full_name: profileData.full_name?.trim(),
          phone: profileData.phone?.trim(),
        })
      }
      try {
        localStorage.setItem('recruiter_preferences', JSON.stringify({
          full_name: profileData.full_name?.trim(),
          phone: profileData.phone?.trim(),
          title: profileData.title?.trim(),
          company: profileData.company?.trim(),
        }))
      } catch (err) {}
      toast.success('Recruiter preferences updated successfully! ✨')
    } catch (err) {
      try {
        localStorage.setItem('recruiter_preferences', JSON.stringify(profileData))
      } catch (e) {}
      toast.error(err.response?.data?.detail || 'Preferences saved locally!')
    } finally {
      setSavingAccount(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!passwords.current_password || !passwords.new_password) {
      toast.error('Please enter current and new passwords.')
      return
    }
    if (passwords.new_password !== passwords.confirm_password) {
      toast.error('New passwords do not match.')
      return
    }
    if (passwords.new_password.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setSavingPassword(true)
    try {
      if (changePassword) {
        await changePassword(passwords.current_password, passwords.new_password)
        setPasswords({ current_password: '', new_password: '', confirm_password: '' })
        toast.success('Password updated successfully! 🔒')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="w-full space-y-7 pb-24 font-sans text-slate-800 antialiased">
      
      {/* ── 1. Page Header (Directly on Page Background) ─────────────────── */}
      <div className="pt-2 pb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50/50 text-indigo-600 border border-indigo-100 text-xs font-semibold mb-2.5">
          <Settings size={13} className="text-indigo-600" />
          Account & Preferences
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-poppins tracking-tight">
          Recruiter Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Manage your enterprise hiring credentials, applicant notification thresholds, and team security.
        </p>
      </div>

      {/* ── 2. Profile Details Form (Full Width Card) ─────────────────────── */}
      <form 
        onSubmit={handleSaveProfile} 
        className="w-full bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 space-y-6"
      >
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5 pb-4 border-b border-slate-100">
          <User size={18} className="text-indigo-600" />
          Hiring Lead Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={profileData.full_name}
                onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Work Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="email"
                disabled
                value={profileData.email}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={profileData.company}
                onChange={e => setProfileData({ ...profileData, company: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Title</label>
            <div className="relative">
              <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={profileData.title}
                onChange={e => setProfileData({ ...profileData, title: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="tel"
                value={profileData.phone}
                onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingAccount}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {savingAccount ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>

      {/* ── 3 & 4. 2-Column Responsive Grid on Desktop ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 items-stretch">

        {/* Card 2: Notification Preferences */}
        <div className="w-full bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <Bell size={18} className="text-indigo-600" />
              Applicant & Pipeline Alerts
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Instant Email on Application</p>
                  <p className="text-xs text-slate-500 mt-0.5">Receive an email immediately when a candidate submits their resume.</p>
                </div>
                <ToggleSwitch
                  checked={notifications.instant_applicant_alert}
                  onChange={val => handleToggleNotification('instant_applicant_alert', val)}
                />
              </div>

              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Daily Pipeline Summary Digest</p>
                  <p className="text-xs text-slate-500 mt-0.5">A morning recap of new submissions and stage conversions.</p>
                </div>
                <ToggleSwitch
                  checked={notifications.daily_digest}
                  onChange={val => handleToggleNotification('daily_digest', val)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Interview Reminders</p>
                  <p className="text-xs text-slate-500 mt-0.5">Alerts 1 hour before scheduled technical interviews.</p>
                </div>
                <ToggleSwitch
                  checked={notifications.interview_reminder}
                  onChange={val => handleToggleNotification('interview_reminder', val)}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-400">
            Changes to alert preferences are automatically applied in real time.
          </div>
        </div>

        {/* Card 3: Password & Security */}
        <form 
          onSubmit={handleUpdatePassword} 
          className="w-full bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 flex flex-col justify-between space-y-6"
        >
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <Shield size={18} className="text-indigo-600" />
              Security & Password
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwords.current_password}
                    onChange={e => setPasswords({ ...passwords, current_password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={passwords.new_password}
                      onChange={e => setPasswords({ ...passwords, new_password: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={passwords.confirm_password}
                      onChange={e => setPasswords({ ...passwords, confirm_password: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
