import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { SpeedInsights } from "@vercel/speed-insights/react"

// [SEC-003] No hardcoded fallback — must be set via VITE_GOOGLE_CLIENT_ID env var.
// In development: add VITE_GOOGLE_CLIENT_ID=<your-id> to frontend/.env
// In production:  set VITE_GOOGLE_CLIENT_ID in your Vercel / CI environment variables.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

if (!googleClientId) {
  console.warn(
    '[CareerShala] VITE_GOOGLE_CLIENT_ID is not set in environment. ' +
    'Google OAuth login will be disabled until it is configured.'
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
      <SpeedInsights />
    </GoogleOAuthProvider>
  ) : (
    <>
      <App />
      <SpeedInsights />
    </>
  )
)

// Register Progressive Web App (PWA) Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch(() => {});
  });
}