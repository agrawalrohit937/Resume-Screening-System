import React from 'react'

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('[RouteErrorBoundary]', error, errorInfo)
  }

  render() {
    const { hasError, error } = this.state
    const { fallback = null } = this.props

    if (!hasError) return this.props.children

    if (fallback) return fallback

    return (
      <div
        style={{
          borderRadius: 16,
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          padding: 18,
        }}
      >
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#881337', marginBottom: 8 }}>
          Something went wrong
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          {error?.message || 'A rendering error occurred.'}
        </div>
      </div>
    )
  }
}

export default RouteErrorBoundary

