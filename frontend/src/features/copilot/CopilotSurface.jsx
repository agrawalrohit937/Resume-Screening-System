import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCopilot } from './CopilotProvider';
import CopilotMessages from './CopilotMessages';
import CopilotInput from './CopilotInput';
import { Bot, Sparkles, X, RotateCcw } from 'lucide-react';

export default function CopilotSurface() {
  const { isOpen, setIsOpen, startNewSession, createNewChat } = useCopilot();
  const handleNewChat = startNewSession || createNewChat;

  const popoverRef = useRef(null);
  const fabRef = useRef(null);

  // Click-outside and Escape key listeners to close widget
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        fabRef.current &&
        !fabRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  return (
    <>
      {/* ── 1. Floating Action Button (FAB) ── */}
      <button
        ref={fabRef}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-[72px] right-3.5 md:bottom-6 md:right-6 w-12 h-12 md:w-14 md:h-14 bg-slate-800/95 backdrop-blur-md rounded-full shadow-lg shadow-slate-900/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 z-50 cursor-pointer border border-slate-700/50"
        aria-label={isOpen ? "Close AI Copilot" : "Open AI Copilot"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="close-icon"
              initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <X className="w-5 h-5 md:w-6 md:h-6 text-white" strokeWidth={2.5} />
            </motion.div>
          ) : (
            <motion.div
              key="bot-icon"
              initial={{ rotate: 90, opacity: 0, scale: 0.8 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="relative flex items-center justify-center"
            >
              <img
                src="/copilot-bot.svg"
                alt="Copilot"
                className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-md"
              />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-emerald-400 border-2 border-slate-800 rounded-full pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* ── 2. Floating Card Widget (Cashfree / Intercom Style) ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[100] w-full h-[100dvh] rounded-none sm:top-auto sm:bottom-24 sm:left-auto sm:right-6 sm:w-[380px] sm:h-[650px] sm:max-h-[calc(100vh-120px)] sm:rounded-2xl bg-white shadow-2xl border-0 sm:border sm:border-slate-200/90 overflow-hidden flex flex-col h-full font-sans"
          >
            {/* Ultra-Clean Header */}
            <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Sparkles size={15} />
                </div>
                <h3 className="text-sm font-bold text-slate-800 truncate">Career Copilot</h3>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-1">
                {/* New Chat / Refresh Button */}
                <button
                  onClick={handleNewChat}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="New Chat"
                  aria-label="New Chat"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Close ('X') Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close"
                  aria-label="Close Copilot"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <CopilotMessages />

            {/* Input Area */}
            <CopilotInput />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
