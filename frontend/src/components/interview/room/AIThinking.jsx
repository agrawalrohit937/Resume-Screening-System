import { motion } from 'framer-motion'

const STEPS = [
  { title: 'Analyzing Response', hint: 'Structure · Clarity · Completeness' },
  { title: 'Checking Communication', hint: 'Tone · Conciseness · Impact' },
  { title: 'Evaluating Confidence', hint: 'Evidence · Examples · Reasoning' },
  { title: 'Comparing Ideal Answer', hint: 'Relevance · Missing points · Fit' },
]

export default function AIThinking({ stepIndex = 0, overallLabel = 'AI Thinking...' }) {
  return (
    <div style={{ width: '100%', minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '22px 16px' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: 86,
          height: 86,
          borderRadius: 28,
          background: 'rgba(2, 6, 23, 0.55)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          boxShadow: '0 18px 70px rgba(37, 99, 235, 0.15), 0 0 60px rgba(56, 189, 248, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(12px)',
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.35, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: -25,
            borderRadius: 999,
            background: 'conic-gradient(from 180deg, rgba(37,99,235,0.0), rgba(37,99,235,0.55), rgba(56,189,248,0.55), rgba(139,92,246,0.45), rgba(37,99,235,0.0))',
            filter: 'blur(2px)',
          }}
        />
        <motion.div
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
          style={{
            width: 54,
            height: 54,
            borderRadius: 20,
            background: 'rgba(37, 99, 235, 0.18)',
            border: '1px solid rgba(56,189,248,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            color: 'rgba(255,255,255,0.92)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          🤖
        </motion.div>
      </motion.div>

      <p style={{ margin: '14px 0 4px', fontFamily: "'Poppins',sans-serif", fontWeight: 900, fontSize: 18, color: '#E2E8F0' }}>
        {overallLabel}
      </p>

      <div style={{ width: 'min(560px, 92vw)', marginTop: 12, display: 'grid', gap: 10 }}>
        {STEPS.map((s, idx) => {
          const active = idx === stepIndex
          const done = idx < stepIndex
          return (
            <motion.div
              key={s.title}
              initial={false}
              animate={{ opacity: active || done ? 1 : 0.6 }}
              transition={{ duration: 0.25 }}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: 16,
                background: 'rgba(2, 6, 23, 0.45)',
                border: `1px solid ${active ? 'rgba(56,189,248,0.45)' : 'rgba(148,163,184,0.18)'}`,
                boxShadow: active ? '0 0 0 3px rgba(56,189,248,0.12)' : 'none',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  marginTop: 2,
                  background: done ? 'rgba(34,197,94,0.18)' : active ? 'rgba(56,189,248,0.18)' : 'rgba(148,163,184,0.12)',
                  border: `1px solid ${done ? 'rgba(34,197,94,0.45)' : active ? 'rgba(56,189,248,0.45)' : 'rgba(148,163,184,0.2)'}`,
                  color: done ? '#22C55E' : active ? '#38BDF8' : '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                }}
              >
                {done ? '✓' : idx + 1}
              </div>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, fontSize: 12, color: active ? '#38BDF8' : '#E2E8F0' }}>
                  {s.title}
                </div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#94A3B8', marginTop: 2, lineHeight: 1.3 }}>
                  {s.hint}
                </div>
              </div>
              {active && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  style={{
                    marginLeft: 'auto',
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: '2px solid rgba(56,189,248,0.35)',
                    borderTopColor: 'rgba(56,189,248,0.95)',
                    filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.22))',
                  }}
                />
              )}
            </motion.div>
          )
        })}
      </div>

      <div style={{ width: 'min(560px, 92vw)', height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.18)', marginTop: 16, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.22)' }}>
        <motion.div
          animate={{ width: `${(stepIndex / (STEPS.length - 1 || 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, rgba(37,99,235,0.95), rgba(56,189,248,0.95), rgba(139,92,246,0.9))' }}
        />
      </div>
    </div>
  )
}

