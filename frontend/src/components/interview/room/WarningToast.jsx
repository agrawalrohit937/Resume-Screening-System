import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const SEVERITY = {
  low: {
    bg: 'rgba(251, 191, 36, 0.10)',
    border: 'rgba(251, 191, 36, 0.35)',
    color: '#92400E',
    glow: 'rgba(251, 191, 36, 0.35)',
    icon: '⚠️',
  },
  medium: {
    bg: 'rgba(251, 146, 60, 0.10)',
    border: 'rgba(251, 146, 60, 0.35)',
    color: '#9A3412',
    glow: 'rgba(251, 146, 60, 0.35)',
    icon: '⚠️',
  },
  high: {
    bg: 'rgba(244, 63, 94, 0.10)',
    border: 'rgba(244, 63, 94, 0.35)',
    color: '#881337',
    glow: 'rgba(244, 63, 94, 0.35)',
    icon: '🚨',
  },
  critical: {
    bg: 'rgba(244, 63, 94, 0.15)',
    border: 'rgba(244, 63, 94, 0.45)',
    color: '#7F1D1D',
    glow: 'rgba(239, 68, 68, 0.45)',
    icon: '🛑',
  },
}

export default function WarningToast({ event, warningCount = 0, maxWarnings = 3, onDismiss, durationMs = 6500 }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!event) {
      setVisible(false)
      return
    }
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, durationMs)
    return () => clearTimeout(t)
  }, [event, durationMs, onDismiss])

  const severityKey = event?.severity || 'medium'
  const cfg = SEVERITY[severityKey] || SEVERITY.medium

  return (
    <AnimatePresence>
      {event && visible && (
        <motion.div
          key={event?.timestamp || event?.event_type}
          initial={{ opacity: 0, y: -18, scale: 0.98, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -18, scale: 0.98, filter: 'blur(6px)' }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            width: 'min(560px, 92vw)',
            borderRadius: 18,
            padding: '12px 14px',
            background: 'rgba(2, 6, 23, 0.55)',
            border: `1px solid ${cfg.border}`,
            boxShadow: `0 18px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03), 0 0 40px ${cfg.glow}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                color: cfg.color,
                boxShadow: `0 0 0 4px rgba(255,255,255,0.03)`,
              }}
            >
              {cfg.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: cfg.color, fontWeight: 800 }}>
                  Integrity Alert {warningCount}/{maxWarnings}
                </p>
                <button
                  onClick={() => {
                    setVisible(false)
                    onDismiss?.()
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: cfg.color,
                    opacity: 0.7,
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: 0,
                    lineHeight: 1,
                  }}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontFamily: "'Inter',sans-serif",
                  fontSize: 13,
                  color: cfg.color,
                  lineHeight: 1.35,
                  opacity: 0.95,
                }}
              >
                {event?.details || 'Integrity violation detected.'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

