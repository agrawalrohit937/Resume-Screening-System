/**
 * SupportModal — Full-screen desktop modal + mobile bottom sheet
 * Orchestrates the flow: Category Selection → Ticket Form → Success Screen
 */
import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LifeBuoy, MessageCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import SupportCategoryCards from './SupportCategoryCards'
import TicketForm from './TicketForm'
import SuccessScreen from './SuccessScreen'
import PremiumSupportCard from './PremiumSupportCard'
import HelpCenterLinks from './HelpCenterLinks'

export default function SupportModal({ isOpen, onClose, onTicketCreated }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Flow state: 'categories' | 'form' | 'success'
  const [step, setStep] = useState('categories')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState(null)
  const [ticketResult, setTicketResult] = useState(null)

  // Reset on open & lock background scroll
  useEffect(() => {
    if (isOpen) {
      setStep('categories')
      setSelectedCategory(null)
      setSelectedSubcategory(null)
      setTicketResult(null)

      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  const handleCategorySelect = useCallback((categoryId) => {
    setSelectedCategory(categoryId)
    setStep('form')
  }, [])

  const handleFormSuccess = useCallback((result) => {
    setTicketResult(result)
    setStep('success')

    // 1. Notify parent via callback
    if (typeof onTicketCreated === 'function') {
      try { onTicketCreated(result?.ticket || result) } catch (_) {}
    }

    // 2. Dispatch global event so all listening tables refresh immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('careershala:ticket-created', { detail: result }))
    }
  }, [onTicketCreated])

  const handleBack = useCallback(() => {
    if (step === 'form') {
      setStep('categories')
      setSelectedCategory(null)
    }
  }, [step])

  const handleViewTickets = useCallback(() => {
    onClose()
    navigate('/support')
  }, [onClose, navigate])

  const handleGetSupport = useCallback(() => {
    setSelectedCategory('other')
    setStep('form')
  }, [])

  // Animation variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  }

  const desktopVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
    exit: { opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } },
  }

  const mobileVariants = {
    hidden: { y: '100%' },
    visible: {
      y: 0,
      transition: { type: 'spring', stiffness: 350, damping: 32 },
    },
    exit: {
      y: '100%',
      transition: { duration: 0.2, ease: 'easeIn' },
    },
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          {/* Backdrop */}
          <motion.div
            key="support-modal-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Desktop Modal */}
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 md:p-8 pointer-events-none">
            <motion.div
              key="support-modal-desktop"
              variants={desktopVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="hidden sm:flex w-full sm:max-w-xl md:max-w-2xl max-h-[85vh] my-auto flex-col bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 sm:px-7 py-4 border-b border-slate-100 shrink-0 bg-slate-50/70">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                    <LifeBuoy size={18} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-900 font-poppins truncate">Support Center</h2>
                    <p className="text-[11px] font-medium text-slate-500 truncate">We're here to help & resolve any issues</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-all cursor-pointer shrink-0 ml-2"
                  aria-label="Close modal"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-5 scrollbar-thin">
                <AnimatePresence mode="wait">
                  {step === 'categories' && (
                    <motion.div
                      key="categories"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      {/* Premium Support Card */}
                      <PremiumSupportCard onGetSupport={handleGetSupport} />
                      {/* Category Cards */}
                      <SupportCategoryCards
                        selectedCategory={selectedCategory}
                        onSelect={handleCategorySelect}
                      />
                      {/* Help Center Links */}
                      <HelpCenterLinks />
                    </motion.div>
                  )}

                  {step === 'form' && (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TicketForm
                        category={selectedCategory}
                        subcategory={selectedSubcategory}
                        onSuccess={handleFormSuccess}
                        onBack={handleBack}
                      />
                    </motion.div>
                  )}

                  {step === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <SuccessScreen
                        ticketData={ticketResult}
                        onClose={onClose}
                        onViewTickets={handleViewTickets}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Mobile Bottom Sheet */}
          <motion.div
            key="support-modal-mobile"
            variants={mobileVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="fixed sm:hidden bottom-0 left-0 right-0 z-[10000] flex flex-col max-h-[90dvh] bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-hidden pointer-events-auto pb-safe"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <LifeBuoy size={16} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Support Center</p>
                  <p className="text-[10px] font-medium text-slate-500">We're here to help</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                aria-label="Close modal"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain no-scrollbar">
              <AnimatePresence mode="wait">
                {step === 'categories' && (
                  <motion.div
                    key="mobile-categories"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <PremiumSupportCard onGetSupport={handleGetSupport} />
                    <SupportCategoryCards
                      selectedCategory={selectedCategory}
                      onSelect={handleCategorySelect}
                    />
                    <HelpCenterLinks />
                  </motion.div>
                )}

                {step === 'form' && (
                  <motion.div
                    key="mobile-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TicketForm
                      category={selectedCategory}
                      subcategory={selectedSubcategory}
                      onSuccess={handleFormSuccess}
                      onBack={handleBack}
                    />
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div
                    key="mobile-success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SuccessScreen
                      ticketData={ticketResult}
                      onClose={onClose}
                      onViewTickets={handleViewTickets}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}

