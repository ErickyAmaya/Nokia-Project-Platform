export const btnEdit    = { background: '#e8f4fd', color: '#1a56db', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 12, lineHeight: 1 }
export const btnConfirm = { background: '#e8f4fd', color: '#1a56db', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 13, fontWeight: 700, lineHeight: 1 }
export const btnDel     = { background: '#fff0f0', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 12, lineHeight: 1 }

export function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

export function estadoBadge(estado) {
  if (estado === 'final') {
    return <span className="badge" style={{ background: '#1a7a1a', color: '#fff', fontSize: 9, padding: '2px 10px' }}>FINAL</span>
  }
  return <span className="badge" style={{ background: '#d68910', color: '#fff', fontSize: 9, padding: '2px 10px' }}>PRE</span>
}
