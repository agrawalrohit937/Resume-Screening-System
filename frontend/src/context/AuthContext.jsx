import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function clearAllUserStorage() {
  try {
    // 1. Core Auth & Tenant
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("tenant_id")
    localStorage.removeItem("careerpilot_view_context")
    localStorage.removeItem("admin_view_mode")

    // 2. User & Recruiter Preferences / Caches
    localStorage.removeItem("recruiter_preferences")
    localStorage.removeItem("recruiter_notifications")
    localStorage.removeItem("recruiter_company_profile")
    localStorage.removeItem("saved_jobs_cache")
    localStorage.removeItem("last_login_method")
    localStorage.removeItem("careershala:copilot:session_id")
    localStorage.removeItem("careershala:copilot:continuous_messages")

    // 3. User-Keyed & Copilot Storage Sweep
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (
        key && (
          key.startsWith('careershala:copilot') ||
          key.startsWith('careershala:') ||
          key.startsWith('chat_history_') ||
          key.startsWith('user_cache_') ||
          key.startsWith('resume_') ||
          key.startsWith('pending_')
        )
      ) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))

    // 4. Session Storage (Pending Drafts, Application IDs, Wizard states)
    sessionStorage.clear()
  } catch (err) {
    console.warn('[Auth] Error clearing user storage on logout:', err)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 🔐 LOGOUT — Strict Session Isolation: wipes local storage, resets global state, fires background backend notify
  const logout = useCallback(() => {
    // 1. Wipe all local auth & session state synchronously
    clearAllUserStorage()
    delete api.defaults.headers.common["Authorization"]
    delete api.defaults.headers.common["x-tenant-id"]
    setUser(null)

    // 2. Broadcast global logout event so active providers & views immediately reset
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('careershala:logout'))
      window.dispatchEvent(new CustomEvent('careershala:auth-change', { detail: { user: null } }))
    }

    // 3. Notify backend in the background — network errors silently swallowed
    api.post('/auth/logout').catch(() => {})
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
      return data
    } catch (err) {
      return null
    }
  }, [])

  // 🔍 CHECK USER (on load) ✅ FIXED
  useEffect(() => {
    let isMounted = true

    const token = localStorage.getItem("access_token")

    // ✅ If we have a localStorage token, attach it.
    // Otherwise, rely on cookie-based auth (backend sets httponly cookies).
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`
    } else {
      delete api.defaults.headers.common["Authorization"]
    }

    api.get('/auth/me')
      .then(res => {
        if (isMounted) {
          setUser(res.data)
          if (res.data?.tenant_id && res.data.tenant_id !== 'default') {
            localStorage.setItem("tenant_id", res.data.tenant_id)
            api.defaults.headers.common["x-tenant-id"] = res.data.tenant_id
          } else {
            localStorage.removeItem("tenant_id")
            delete api.defaults.headers.common["x-tenant-id"]
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null)
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
          localStorage.removeItem("tenant_id")
          delete api.defaults.headers.common["x-tenant-id"]
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const _persistSession = (data) => {
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    if (data?.user?.tenant_id && data.user.tenant_id !== 'default') {
      localStorage.setItem("tenant_id", data.user.tenant_id)
      api.defaults.headers.common["x-tenant-id"] = data.user.tenant_id
    } else {
      localStorage.removeItem("tenant_id")
      delete api.defaults.headers.common["x-tenant-id"]
    }
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`
    setUser(data.user)
  }

  // 🔐 LOGIN — NOTE: may now return { requires_otp: true, challenge_token } instead of tokens
  // if this is a new/untrusted device (FEATURE 4 — Secure Login). Callers must check
  // `result.requires_otp` and, if true, route to /verify-login-otp with the challenge_token.
  const login = async (email, password, role = 'candidate') => {
    localStorage.removeItem("tenant_id")
    delete api.defaults.headers.common["x-tenant-id"]
    const { data } = await api.post('/auth/login', { email, password, role })

    if (data.requires_otp) {
      return data // { requires_otp: true, challenge_token, message }
    }

    _persistSession(data)
    return data
  }

  const verifyLoginOtp = async (challengeToken, otp) => {
    const { data } = await api.post('/auth/verify-login-otp', {
      challenge_token: challengeToken,
      otp,
    })
    _persistSession(data)
    return data
  }

  // 📝 SIGNUP — NOTE: contract change. Signup no longer returns tokens directly.
  // It now returns { success, message, email } and the account stays inactive
  // until POST /auth/verify-email succeeds (FEATURE 1).
  const signup = async (payload) => {
    localStorage.removeItem("tenant_id")
    delete api.defaults.headers.common["x-tenant-id"]
    const { data } = await api.post('/auth/signup', payload)
    return data // { success, message, email }
  }

  const verifyEmail = async (email, otp) => {
    const { data } = await api.post('/auth/verify-email', { email, otp })
    _persistSession(data)
    return data
  }

  const resendOtp = async (email, purpose = 'signup_verification') => {
    const { data } = await api.post('/auth/resend-otp', { email, purpose })
    return data
  }

  const forgotPassword = async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email })
    return data
  }

  const verifyResetOtp = async (email, otp) => {
    const { data } = await api.post('/auth/verify-reset-otp', { email, otp })
    return data // { success, message, reset_token }
  }

  const resetPassword = async (email, resetToken, newPassword) => {
    const { data } = await api.post('/auth/reset-password', {
      email,
      reset_token: resetToken,
      new_password: newPassword,
    })
    return data
  }

  const changePassword = async (currentPassword, newPassword) => {
    const { data } = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return data
  }

  // 🔵 GOOGLE LOGIN ✅ FIXED
  const googleLogin = useCallback(async (token, role = 'candidate') => {
    try {
      localStorage.removeItem("tenant_id")
      delete api.defaults.headers.common["x-tenant-id"]
      const { data } = await api.post('/auth/google', { token, role });
      _persistSession(data)
      return data;
    } catch (error) {
      console.error("Google Login Error:", error);
      throw error; // Isse UI mein error dikha payenge
    }
  }, []);

  // 🟢 LINKEDIN LOGIN SUCCESS HELPER ✅ NEWLY ADDED
  const linkedinLoginSuccess = useCallback((data) => {
    try {
      _persistSession(data)
    } catch (error) {
      console.error("LinkedIn Context Sync Error:", error)
    }
  }, []);

  // 👤 PROFILE — update fields, upload/remove photo
  const updateProfile = async (payload) => {
    const { data } = await api.put('/auth/me', payload)
    setUser(data)
    return data
  }

  // In AuthContext.jsx, update your uploadProfilePhoto like this:
  const uploadProfilePhoto = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    // Backend now returns the UPDATED user object with the new FTP profile_picture URL
    const { data } = await api.post('/users/profile-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    // Update global user state immediately — display_picture is resolved server-side
    setUser(data)
    return data
  }

  const removeProfilePhoto = async () => {
    const { data } = await api.delete('/users/profile-photo')
    setUser(data)
    return data
  }

  const roles = (Array.isArray(user?.roles) && user.roles.length > 0
    ? user.roles
    : [user?.role || 'candidate']
  ).map((r) => String(r).toLowerCase())

  const role = (user?.role || roles[0] || 'candidate').toLowerCase()
  const tenantId = user?.tenant_id || 'default'

  const isPlatformAdmin = roles.includes('platform_admin') || roles.includes('admin')
  const isExecutive = roles.includes('executive') || roles.includes('exec') || isPlatformAdmin
  const isRecruiter = roles.includes('recruiter') || isExecutive
  const isHiringManager = roles.includes('hiring_manager') || isExecutive
  const isInterviewer = roles.includes('interviewer') || isExecutive
  const isCoordinator = roles.includes('coordinator') || isExecutive
  const isAdmin = isPlatformAdmin
  const isExec = isExecutive
  const isCandidate = roles.includes('candidate')

  const hasRole = useCallback((allowedRoles) => {
    if (!allowedRoles || allowedRoles.length === 0) return true
    const currentRoles = [
      ...(Array.isArray(user?.roles) ? user.roles : []),
      user?.role,
    ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

    if (currentRoles.length === 0) {
      currentRoles.push('candidate')
    }

    // Platform admin & admin possess global access
    if (currentRoles.includes('platform_admin') || currentRoles.includes('admin')) {
      return true
    }

    const allowed = allowedRoles.map((r) => String(r).toLowerCase().trim())

    // Executive inherits all permissions for their tenant
    if (currentRoles.includes('executive') || currentRoles.includes('exec')) {
      const enterpriseRoles = ['executive', 'exec', 'recruiter', 'hiring_manager', 'interviewer']
      if (allowed.some((r) => enterpriseRoles.includes(r))) {
        return true
      }
    }

    // Hiring manager inherits recruiter and interviewer permissions for employer routes
    if (currentRoles.includes('hiring_manager')) {
      const hmAllowedRoles = ['hiring_manager', 'recruiter', 'interviewer']
      if (allowed.some((r) => hmAllowedRoles.includes(r))) {
        return true
      }
    }

    return currentRoles.some((r) => allowed.includes(r))
  }, [user?.roles, user?.role])

  return (
    <AuthContext.Provider value={{
      user, loading,
      role, roles, tenantId,
      isCandidate, isRecruiter, isHiringManager, isCoordinator, isInterviewer,
      isAdmin, isExec, isPlatformAdmin, isExecutive,
      hasRole,
      login, signup, logout, googleLogin, linkedinLoginSuccess,
      verifyLoginOtp, verifyEmail, resendOtp,
      forgotPassword, verifyResetOtp, resetPassword, changePassword,
      updateProfile, uploadProfilePhoto, removeProfilePhoto, refreshUser,
      setSession: _persistSession,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}