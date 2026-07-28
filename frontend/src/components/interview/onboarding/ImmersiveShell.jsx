import { useEffect } from 'react'

/**
 * Minimal wrapper that makes the interview UI “immersive”.
 *
 * When `active` is true, we:
 *  - add a body class to allow Sidebar/Topbar CSS to hide itself
 *  - render children inside the normal React tree
 */
export default function ImmersiveShell({ active, children }) {
  useEffect(() => {
    const cls = 'immersive-fullscreen'

    const apply = () => {
      if (active) document.body.classList.add(cls)
      else document.body.classList.remove(cls)
    }

    apply()

    // Also sync on fullscreenchange, because the fullscreen state can change
    // without React re-rendering immediately.
    const onFsChange = () => apply()
    document.addEventListener('fullscreenchange', onFsChange)

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.body.classList.remove(cls)
    }
  }, [active])


  if (!active) return <>{children}</>

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {children}
    </div>
  )
}


