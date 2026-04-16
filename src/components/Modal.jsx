import { useEffect } from 'react'

/**
 * Base modal component.
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   title       string
 *   maxWidth    number  (default 700)
 *   headerStyle object  (override header styles — e.g. nokia teal bg)
 *   children    body content
 *   footer      footer content (buttons row)
 */
export default function Modal({ open, onClose, title, maxWidth = 700, headerStyle, children, footer }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else      document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.65)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 'var(--rad)',
          width: '92%',
          maxWidth,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'var(--shl)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: '#0a0a0a',
          color: '#fff',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '3px solid #1a9c1a',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          borderRadius: 'var(--rad) var(--rad) 0 0',
          ...headerStyle,
        }}>
          <h3 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 16, fontWeight: 700, letterSpacing: 1, margin: 0,
          }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#fff',
              fontSize: 20, cursor: 'pointer', opacity: .7, lineHeight: 1, padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--g2)',
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            position: 'sticky', bottom: 0, background: '#fff',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
