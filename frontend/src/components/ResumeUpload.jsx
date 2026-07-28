import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { uploadResume } from '../services/api'

export default function ResumeUpload({ onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')

  const onDrop = useCallback(async (accepted, rejected) => {
    if (rejected.length) { 
      toast.error('Only PDF or DOCX files under 10MB are allowed')
      return 
    }
    const file = accepted[0]
    if (!file) return

    setUploading(true)
    setProgress(0)
    setPhase('Uploading file...')
    
    try {
      await uploadResume(file, pct => {
        setProgress(pct)
        if (pct === 100) setPhase('AI parsing your resume...')
      })
      setPhase('Complete!')
      await new Promise(r => setTimeout(r, 600))
      toast.success('Resume uploaded & parsing started!')
      onSuccess?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      setPhase('')
    }
  }, [onSuccess])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop, 
    multiple: false, 
    disabled: uploading,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024,
  })

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 font-body">
      <div
        {...getRootProps()}
        className={`
          relative rounded-2xl border-2 border-dashed p-8 md:p-12 text-center cursor-pointer
          transition-all duration-300 overflow-hidden shadow-2xs
          ${isDragReject ? 'border-rose-400 bg-rose-50/40' : isDragActive ? 'border-indigo-500 bg-indigo-50/50 shadow-md ring-4 ring-indigo-500/10' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-400 hover:bg-white hover:shadow-xs'}
          ${uploading ? 'pointer-events-none border-indigo-200 bg-white shadow-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        {/* Dynamic Background Gradients */}
        <AnimatePresence>
          {isDragActive && !isDragReject && (
            <motion.div
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-transparent to-violet-50/30 pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className="relative z-10">
          {uploading ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="space-y-6 flex flex-col items-center justify-center"
            >
              {/* Circular Radial Tracker Container */}
              <div className="w-24 h-24 relative flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#F1F5F9" strokeWidth="5"/>
                  <circle 
                    cx="40" 
                    cy="40" 
                    r="34" 
                    fill="none" 
                    stroke="url(#indigoGradient)" 
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (progress / 100) * 213.6}
                    style={{ transition: 'stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                  <defs>
                    <linearGradient id="indigoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono font-bold text-slate-800 text-lg leading-none">{progress}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-slate-800 text-sm tracking-tight">{phase}</p>
                <p className="text-xs font-mono text-slate-400 animate-pulse">Processing asset pipeline...</p>
              </div>

              <div className="w-40 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </motion.div>
          ) : (
            <div className="space-y-5">
              {/* Upload Vector Graphic Card Wrapper */}
              <motion.div
                animate={isDragActive ? { y: -6, scale: 1.05 } : { y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center text-xl transition-colors duration-200
                  ${isDragActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white text-slate-600 border border-slate-200/80 shadow-xs'}`}
              >
                {isDragReject ? (
                  <span className="text-rose-500 text-lg">✕</span>
                ) : isDragActive ? (
                  <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                )}
              </motion.div>

              <div className="space-y-1">
                <h3 className="font-semibold text-slate-800 text-base">
                  {isDragReject ? 'Invalid file architecture' : isDragActive ? 'Drop your asset here' : 'Upload your resume'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                  {isDragReject ? 'Please supply standard layout documents' : 'Drag & drop your file directly here, or click your local system directory to browse.'}
                </p>
              </div>

              {/* Badges details layout */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 font-mono text-[10px] font-medium tracking-wide shadow-2xs">PDF</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 font-mono text-[10px] font-medium tracking-wide shadow-2xs">DOCX</span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono text-[10px] font-medium tracking-wide shadow-2xs">MAX 10MB</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formatting Tips Row Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {[
          { icon: '📄', text: 'Text-based structural PDFs yield optimal analysis output.', ok: true },
          { icon: '📝', text: 'Standard clean Word format (.docx) is natively parsed.', ok: true },
          { icon: '📷', text: 'Scanned image files require longer execution structures.', ok: false },
        ].map((item, index) => (
          <div key={index} className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
            <span className="text-sm shrink-0 leading-none mt-0.5">{item.icon}</span>
            <p className="text-[11px] text-slate-500 leading-normal font-medium">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}