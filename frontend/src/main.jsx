import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { SpeedInsights } from "@vercel/speed-insights/react"

// [SEC-003] No hardcoded fallback — must be set via VITE_GOOGLE_CLIENT_ID env var.
// In development: add VITE_GOOGLE_CLIENT_ID=<your-id> to frontend/.env
// In production:  set VITE_GOOGLE_CLIENT_ID in your Vercel / CI environment variables.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (!googleClientId) {
  throw new Error(
    '[CareerShala] VITE_GOOGLE_CLIENT_ID is not set. ' +
    'Add it to frontend/.env (dev) or your deployment environment (prod). ' +
    'Get it from: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.'
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={googleClientId}>
    <App />
    {/* 👇 2. Ye component add karna hai */}
    <SpeedInsights />
  </GoogleOAuthProvider>
)