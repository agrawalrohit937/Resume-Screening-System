import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext' 

export default function LinkedinCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('Finishing LinkedIn sign-in...')
  const { linkedinLoginSuccess } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state') || 'candidate'
    const redirect_uri = `${window.location.origin}/linkedin-callback`

    if (!code) {
      setMessage('LinkedIn sign-in was cancelled or failed.')
      toast.error('LinkedIn sign-in failed')
      navigate('/login', { replace: true })
      return
    }

    // Send authorization code, state, and dynamic redirect_uri to FastAPI backend
    api.post('/auth/linkedin', { code, state, redirect_uri })
      .then((res) => {
        toast.success('Welcome back via LinkedIn! 🚀')

        // Sync tokens and user data into React AuthContext
        linkedinLoginSuccess(res.data)

        setTimeout(() => {
          // Hard redirect to refresh cookies and clear state safely
          window.location.href = '/dashboard'
        }, 200)
      })
      .catch((err) => {
        console.error("LinkedIn OAuth Backend Error:", err.response?.data)
        const errMsg = err.response?.data?.detail || 'LinkedIn authentication failed'
        setMessage(errMsg)
        toast.error(errMsg)
        
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 1500)
      })
  }, [navigate, searchParams, linkedinLoginSuccess])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E8F4F8] px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
        <h2 className="text-xl font-semibold text-slate-800">Completing sign-in</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  )
}