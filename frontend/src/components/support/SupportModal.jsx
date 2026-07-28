/**
 * SupportModal — Full-screen desktop modal + mobile bottom sheet
 * Orchestrates the flow: Category Selection → Ticket Form → Success Screen
 */
import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LifeBuoy, MessageCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import SupportCategoryCards from './SupportCategoryCards'
import TicketForm from './TicketForm'
import SuccessScreen from './SuccessScreen'
import PremiumSupportCard from './PremiumSupportCard'
import HelpCenterLinks from './HelpCenterLinks'

export default function SupportModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Flow state: 'categories' | 'form' | 'success'
  const [step, setStep] = useState('categories')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState(null)
  const [ticketResult, setTicketResult] = useState(null)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('categories')
      setSelectedCategory(null)
      setSelectedSubcategory(null)
      setTicketResult(null)
    }
  }, [isOpen])

  const handleCategorySelect = useCallback((categoryId) => {
    setSelectedCategory(categoryId)
    setStep('form')
  }, [])

  const handleFormSuccess = useCallback((result) => {
    setTicketResult(result)
    setStep('success')
  }, [])

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
    setStep('categories')
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="support-modal-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm"
          />

          {/* Desktop Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="support-modal-desktop"
              variants={desktopVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="hidden sm:flex w-full max-w-lg max-h-[85vh] flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <LifeBuoy size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Support Center</h2>
                    <p className="text-[10px] font-medium text-slate-500">We're here to help</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
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
            className="fixed sm:hidden bottom-0 left-0 right-0 z-50 flex flex-col max-h-[92vh] bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-hidden pointer-events-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <LifeBuoy size={16} strokeWidth={2} />
                </div>
                <p className="text-sm font-black text-slate-900">Support Center</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
              <AnimatePresence mode="wait">
                {step === 'categories' && (
                  <motion.div
                    key="mobile-categories"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
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
        </>
      )}
    </AnimatePresence>
  )
}

