import { Shield, Send, X } from 'lucide-react';

/**
 * SendConfirmationModal
 *
 * Replaces the old OAuth popup model entirely. Now works in two modes:
 *
 * 1. Gmail Connected (isGmailConnected = true):
 *    Shows a simple confirmation dialog. User clicks "Send" → backend handles
 *    the Gmail API call silently using stored tokens. No popup. No re-auth.
 *
 * 2. Gmail Not Connected (isGmailConnected = false):
 *    Shows a "Connect Gmail" prompt. User clicks the connect button → app
 *    redirects to the server-side OAuth consent URL (one-time). After that,
 *    all future sends are automatic.
 */
export default function SendConfirmationModal({
  isOpen,
  hrEmail,
  onConfirm,
  onCancel,
  onConnectGmail,
  isSubmitting,
  isGmailConnected,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isGmailConnected ? 'bg-emerald-50' : 'bg-amber-50'
            }`}>
              {isGmailConnected 
                ? <Send size={18} className="text-emerald-600 ml-0.5" />
                : <Shield size={18} className="text-amber-600" />
              }
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {isGmailConnected ? 'Send via Gmail?' : 'Connect Gmail First'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isGmailConnected ? 'One-click secure delivery' : 'Required for email delivery'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── CONNECTED: Simple confirmation ── */}
        {isGmailConnected ? (
          <>
            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                This will send your tailored email with resume and cover letter attached
                directly from your Gmail account to{' '}
                <span className="font-semibold text-slate-900">{hrEmail}</span>.
              </p>
              <div className="flex items-center gap-2 mt-3 text-xs text-emerald-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Gmail connected — sending is fully automatic
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Application
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* ── NOT CONNECTED: Show connect prompt ── */
          <>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
              <p className="text-sm text-amber-800 leading-relaxed">
                To send applications directly from your Gmail account, you need to authorize
                CareerShala once. This is a <strong>one-time step</strong> — future sends
                will be completely automatic with no popups.
              </p>
              <ul className="mt-3 space-y-1.5">
                {[
                  'Your credentials are stored securely server-side',
                  'We only request permission to send emails',
                  'You can disconnect anytime from settings',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConnectGmail}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Shield size={14} />
                Connect Gmail
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
