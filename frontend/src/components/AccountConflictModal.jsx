import React from 'react';
import { ShieldAlert, ArrowRight, Mail, LogIn, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AccountConflictModal
 * 
 * Reusable bright-themed warning modal triggered when an email registration 
 * collides with an existing account of an opposing role (Candidate vs Recruiter).
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {Function} onClose - Handler to dismiss the modal / reset form
 * @param {Function} onNavigateToLogin - Handler to redirect user to login page
 * @param {Object} conflictDetails - Metadata about the conflict { email, existingRole, attemptedRole }
 */
export default function AccountConflictModal({
  isOpen,
  onClose,
  onNavigateToLogin,
  conflictDetails = {}
}) {
  if (!isOpen) return null;

  const {
    email = 'user@example.com',
    existingRole = 'candidate',
    attemptedRole = 'recruiter',
  } = conflictDetails;

  const formattedExistingRole = existingRole ? existingRole.charAt(0).toUpperCase() + existingRole.slice(1) : 'User';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Card - Bright Modern Aesthetic */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 z-10 text-slate-800 overflow-hidden"
        >
          {/* Subtle Top Decorative Gradient Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>

          {/* Warning Icon Badge */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-sm mb-5">
            <ShieldAlert size={28} strokeWidth={2.2} />
          </div>

          {/* Title */}
          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 text-center tracking-tight mb-2">
            Account Conflict Detected
          </h3>

          {/* Message Body */}
          <div className="space-y-3 text-center mb-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              The email address <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md font-mono text-xs">{email}</span> is already registered as a <span className="font-bold text-indigo-600">{formattedExistingRole}</span> account.
            </p>
            <div className="p-3.5 bg-amber-50/60 border border-amber-200/60 rounded-2xl text-xs text-amber-900 text-left flex items-start gap-2.5">
              <span className="shrink-0 font-bold text-amber-700">Notice:</span>
              <span>
                Dual accounts across <strong>Candidate</strong> and <strong>Recruiter</strong> roles using the same email are restricted to maintain security and role separation.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Primary Action: Log In */}
            <button
              onClick={() => {
                onClose();
                if (onNavigateToLogin) onNavigateToLogin(existingRole);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 cursor-pointer"
            >
              <LogIn size={17} />
              <span>Log In as {formattedExistingRole}</span>
              <ArrowRight size={15} />
            </button>

            {/* Secondary Action: Try Different Email */}
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm tracking-wide transition-colors cursor-pointer"
            >
              <Mail size={17} />
              <span>Use an Alternative Email</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
