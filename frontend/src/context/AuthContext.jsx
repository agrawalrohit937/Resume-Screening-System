import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 🔐 LOGOUT
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      console.error("Logout error:", err)
    } finally {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token") // ✅ remove token
      delete api.defaults.headers.common["Authorization"] // ✅ remove header
      setUser(null)
    }
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
        if (isMounted) setUser(res.data)
      })
      .catch(() => {
        if (isMounted) {
          setUser(null)
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
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
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`
    setUser(data.user)
  }

  // 🔐 LOGIN — NOTE: may now return { requires_otp: true, challenge_token } instead of tokens
  // if this is a new/untrusted device (FEATURE 4 — Secure Login). Callers must check
  // `result.requires_otp` and, if true, route to /verify-login-otp with the challenge_token.
  const login = async (email, password, role = 'candidate') => {
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

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, signup, logout, googleLogin, linkedinLoginSuccess,
      verifyLoginOtp, verifyEmail, resendOtp,
      forgotPassword, verifyResetOtp, resetPassword, changePassword,
      updateProfile, uploadProfilePhoto, removeProfilePhoto, refreshUser,
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