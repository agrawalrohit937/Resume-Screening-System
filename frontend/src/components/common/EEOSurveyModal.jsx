import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, CheckCircle2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { submitEEOSelfId } from '../../services/api'
import CustomDropdown from './CustomDropdown'

const GENDER_OPTIONS = [
  { value: 'Decline to State', label: 'Decline to state (Prefer not to answer)' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Non-Binary', label: 'Non-Binary / Gender Diverse' },
]

const RACE_OPTIONS = [
  { value: 'Decline to State', label: 'Decline to state (Prefer not to answer)' },
  { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
  { value: 'White (Not Hispanic or Latino)', label: 'White (Not Hispanic or Latino)' },
  { value: 'Black or African American', label: 'Black or African American' },
  { value: 'Asian', label: 'Asian' },
  { value: 'American Indian or Alaska Native', label: 'American Indian or Alaska Native' },
  { value: 'Native Hawaiian or Other Pacific Islander', label: 'Native Hawaiian or Other Pacific Islander' },
  { value: 'Two or More Races', label: 'Two or More Races' },
]

const VETERAN_OPTIONS = [
  { value: 'I decline to state my veteran status', label: 'Decline to state' },
  { value: 'I am not a protected veteran', label: 'I am not a protected veteran' },
  { value: 'I identify as one or more of the classifications of protected veteran', label: 'Protected veteran' },
]

const DISABILITY_OPTIONS = [
  { value: 'I do not wish to answer', label: 'Decline to answer' },
  { value: "No, I don't have a disability, or a history/record of having a disability", label: "No, I don't have a disability" },
  { value: "Yes, I have a disability, or have a history/record of having a disability", label: 'Yes, I have a disability' },
]

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
      toast.success('Preferences saved confidentially!', {
        icon: '🛡️',
        duration: 3000,
      })
      onClose()
    } catch (err) {
      console.error('Failed to submit EEO response:', err)
      toast.error('Unable to save preferences, but your application is confirmed.')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-900/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-visible font-sans my-4"
        >
          {/* Header (Clean, Compact, White) */}
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Optional Survey</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Voluntary Self-Identification
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Responses are 100% confidential and never affect hiring decisions.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Compact Form */}
          <form onSubmit={(e) => handleSubmit(e, false)} className="p-5 space-y-3.5">
            {/* 1. Gender */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                1. Gender
              </label>
              <CustomDropdown
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(val) => setGender(val)}
                className="w-full"
                buttonClassName="w-full justify-between py-2 px-3 text-xs bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl font-medium"
                menuClassName="w-full max-h-56 overflow-y-auto"
              />
            </div>

            {/* 2. Race / Ethnicity */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                2. Race & Ethnicity
              </label>
              <CustomDropdown
                options={RACE_OPTIONS}
                value={raceEthnicity}
                onChange={(val) => setRaceEthnicity(val)}
                className="w-full"
                buttonClassName="w-full justify-between py-2 px-3 text-xs bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl font-medium"
                menuClassName="w-full max-h-56 overflow-y-auto"
              />
            </div>

            {/* 3. Veteran Status */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                3. Veteran Status
              </label>
              <CustomDropdown
                options={VETERAN_OPTIONS}
                value={veteranStatus}
                onChange={(val) => setVeteranStatus(val)}
                className="w-full"
                buttonClassName="w-full justify-between py-2 px-3 text-xs bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl font-medium"
                menuClassName="w-full max-h-56 overflow-y-auto"
              />
            </div>

            {/* 4. Disability Status */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                4. Disability Status
              </label>
              <CustomDropdown
                options={DISABILITY_OPTIONS}
                value={disabilityStatus}
                onChange={(val) => setDisabilityStatus(val)}
                className="w-full"
                buttonClassName="w-full justify-between py-2 px-3 text-xs bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl font-medium"
                menuClassName="w-full max-h-56 overflow-y-auto"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Skip / Decline All
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {submitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
