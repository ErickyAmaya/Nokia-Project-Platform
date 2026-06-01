export function EmptyState({ icon = '📭', title = 'Sin datos', subtitle = '', style = {} }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', ...style }}>
      <div style={{ fontSize: 26, marginBottom: 10, opacity: .55 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: subtitle ? 5 : 0 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>{subtitle}</div>}
    </div>
  )
}

export function EmptyRow({ colSpan = 99, icon, title, subtitle }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, borderTop: 'none' }}>
        <EmptyState icon={icon} title={title} subtitle={subtitle} style={{ padding: '32px 24px' }} />
      </td>
    </tr>
  )
}
