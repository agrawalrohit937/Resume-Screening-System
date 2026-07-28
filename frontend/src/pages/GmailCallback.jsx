import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import applyAssistantApi from '../services/applyAssistantApi';

/**
 * GmailCallback
 *
 * Handles the OAuth redirect from Google after the user consents.
 * Google sends the user back to this page with ?code=...&state=...
 *
 * This page:
 *  1. Reads the `code` and `state` from the URL query parameters.
 *  2. POSTs them to the backend /auth/gmail/callback endpoint.
 *  3. The backend exchanges the code for access + refresh tokens and saves them.
 *  4. Redirects the user back to /apply-assistant with a success indicator.
 *
 * The authorization code can only be exchanged once — if this page is visited
 * directly without a code, it redirects to /apply-assistant.
 */
export default function GmailCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const hasExchanged = useRef(false); // Prevent double-execution in React StrictMode

  useEffect(() => {
    if (hasExchanged.current) return;
    hasExchanged.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    // Google returned an error (e.g. user denied access)
    if (error) {
      setStatus('error');
      setErrorMessage(
        error === 'access_denied'
          ? 'You declined Gmail access. You can reconnect from the Apply Assistant page.'
          : `Google returned an error: ${error}`
      );
      setTimeout(() => navigate('/apply-assistant'), 4000);
      return;
    }

    // No code — user navigated here directly
    if (!code) {
      navigate('/apply-assistant', { replace: true });
      return;
    }

    // Exchange the code for tokens via backend
    applyAssistantApi
      .exchangeGmailCode(code, state)
      .then(() => {
        setStatus('success');
        // Redirect back to Apply Assistant with success flag
        setTimeout(() => navigate('/apply-assistant?gmail=connected'), 2000);
      })
      .catch((err) => {
        const detail =
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to complete Gmail authorization. Please try again.';
        setStatus('error');
        setErrorMessage(detail);
        setTimeout(() => navigate('/apply-assistant'), 5000);
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full p-8 text-center">
        
        {/* Icon */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
          status === 'success' ? 'bg-emerald-50' 
          : status === 'error' ? 'bg-red-50' 
          : 'bg-indigo-50'
        }`}>
          {status === 'loading' && (
            <Loader2 size={30} className="text-indigo-600 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle size={30} className="text-emerald-600" />
          )}
          {status === 'error' && (
            <XCircle size={30} className="text-red-500" />
          )}
        </div>

        {/* Status text */}
        {status === 'loading' && (
          <>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Connecting Gmail...
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Securely exchanging your authorization with Google. This takes just a moment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Gmail Connected! 🎉
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Your Gmail account is now linked. Future applications will be sent
              automatically — no more popups, ever.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-4 py-2 w-fit mx-auto">
              <Mail size={13} />
              Redirecting you back...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Authorization Failed
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-3">
              {errorMessage}
            </p>
            <p className="text-xs text-slate-400">
              Redirecting you back to the Apply Assistant...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
