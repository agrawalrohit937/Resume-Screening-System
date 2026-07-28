import { useMemo } from 'react'

/**
 * Shared layout for onboarding wizard steps.
 * Minimal implementation to satisfy existing pages.
 */
export default function OnboardingLayout({
  stepIndex = 0,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}) {
  const progressLabel = useMemo(() => {
    // simple 0..2 indicators (works for existing steps)
    return `Step ${stepIndex + 1}`
  }, [stepIndex])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#F8FAFC',
      }}
    >
      <div
        style={{
          width: 'min(980px, 92vw)',
          background: 'white',
          borderRadius: 24,
          border: '1px solid #E2E8F0',
          boxShadow: '0 18px 60px rgba(2,6,23,0.06)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 24px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {eyebrow || progressLabel}
          </div>
          {title && (
            <h1 style={{ margin: '6px 0 0', fontFamily: "'Poppins',sans-serif", fontWeight: 900, fontSize: 22, color: '#0F172A' }}>
              {title}
            </h1>
          )}
          {subtitle && (
            <p style={{ margin: '6px 0 0', fontFamily: "'Inter',sans-serif", fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
              {subtitle}
            </p>
          )}
        </div>

        <div style={{ padding: 24 }}>{children}</div>

        {footer && (
          <div style={{ padding: '18px 24px', borderTop: '1px solid #F1F5F9', background: '#FFFFFF' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

