import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, X, HelpCircle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { submitEEOSelfId } from '../../services/api'

export default function EEOSurveyModal({ isOpen, onClose, jobId, applicationId, jobTitle, companyName }) {
  const [gender, setGender] = useState('Decline to State')
  const [raceEthnicity, setRaceEthnicity] = useState('Decline to State')
  const [veteranStatus, setVeteranStatus] = useState('I decline to state my veteran status')
  const [disabilityStatus, setDisabilityStatus] = useState('I do not wish to answer')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e, isDeclineAll = false) => {
    if (e) e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        gender: isDeclineAll ? 'Decline to State' : gender,
        race_ethnicity: isDeclineAll ? 'Decline to State' : raceEthnicity,
        veteran_status: isDeclineAll ? 'I decline to state my veteran status' : veteranStatus,
        disability_status: isDeclineAll ? 'I do not wish to answer' : disabilityStatus,
        job_id: jobId || null,
        application_id: applicationId || null,
      }
      await submitEEOSelfId(payload)
      toast.success('Demographic disclosure recorded confidentially. Thank you!', {
        icon: '🛡️',
        duration: 4000,
      })
      onClose()
    } catch (err) {
      console.error('Failed to submit EEO response:', err)
      // Even if API fails, do not block candidate experience
      toast.error('Unable to save voluntary disclosure, but your application is confirmed.')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans my-8"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 tracking-wide uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                Statutory Compliance
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <Lock className="w-3 h-3" />
                Isolated EEO Vault
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Voluntary Self-Identification (EEO)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              {companyName ? `${companyName} invites you to complete this voluntary disclosure` : 'Equal Employment Opportunity demographic data collection'}
              {jobTitle && <span className="font-semibold text-white"> for {jobTitle}</span>}.
            </p>
          </div>

          {/* Statutory Confidentiality Notice */}
          <div className="p-4 sm:px-7 bg-indigo-50/70 border-b border-indigo-100 flex items-start gap-3 text-xs text-indigo-950 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Strictly Voluntary & Mathematically Isolated:</span> Submission of this information is optional. Refusal to provide it will not subject you to any adverse treatment. All responses are stored in an encrypted compliance vault and are <span className="underline decoration-indigo-300 font-semibold">never shown to interviewers or used in hiring evaluations</span>.
            </div>
          </div>

          {/* Survey Form */}
          <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 sm:p-7 space-y-5 max-h-[62vh] overflow-y-auto custom-scrollbar">
            
            {/* 1. Gender */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Gender Self-Identification
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              >
                <option value="Decline to State">Decline to State (Prefer not to answer)</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-Binary">Non-Binary / Gender Diverse</option>
              </select>
            </div>

            {/* 2. Race / Ethnicity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Race & Ethnicity (EEOC Standard)
              </label>
              <select
                value={raceEthnicity}
                onChange={(e) => setRaceEthnicity(e.target.value)}
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              >
                <option value="Decline to State">Decline to State (Prefer not to answer)</option>
                <option value="Hispanic or Latino">Hispanic or Latino</option>
                <option value="White (Not Hispanic or Latino)">White (Not Hispanic or Latino)</option>
                <option value="Black or African American">Black or African American</option>
                <option value="Asian">Asian</option>
                <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
                <option value="Two or More Races">Two or More Races</option>
              </select>
              <p className="text-[11px] text-slate-500 italic">
                Defined under Federal EEO-1 reporting guidelines.
              </p>
            </div>

            {/* 3. Veteran Status */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                3. Protected Veteran Status (VEVRAA)
              </label>
              <select
                value={veteranStatus}
                onChange={(e) => setVeteranStatus(e.target.value)}
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              >
                <option value="I decline to state my veteran status">I decline to state my veteran status</option>
                <option value="I am not a protected veteran">I am not a protected veteran</option>
                <option value="I identify as one or more of the classifications of protected veteran">
                  I identify as one or more classifications of protected veteran
                </option>
              </select>
            </div>

            {/* 4. Disability Status */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                4. Disability Self-Identification (Section 503)
              </label>
              <select
                value={disabilityStatus}
                onChange={(e) => setDisabilityStatus(e.target.value)}
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              >
                <option value="I do not wish to answer">I do not wish to answer (Decline to state)</option>
                <option value="No, I don't have a disability, or a history/record of having a disability">
                  No, I don't have a disability, or a history of having a disability
                </option>
                <option value="Yes, I have a disability, or have a history/record of having a disability">
                  Yes, I have a disability, or have a history of having a disability
                </option>
              </select>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Decline All & Skip
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Recording...' : 'Submit Confidential Disclosure'}
                </button>
              </div>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
