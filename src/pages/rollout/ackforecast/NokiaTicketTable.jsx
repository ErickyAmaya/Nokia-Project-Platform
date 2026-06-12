import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildTicketTree, isFinal, resolveOwner, thStyle, thCenterStyle } from './helpers'

export default function NokiaTicketTable({ rows, procesoKey, ticketKey, label, color = '#7030A0', empresaNombre = '', forPrint = false }) {
  const navigate   = useNavigate()
  const gapTree    = useMemo(() => buildTicketTree(rows, procesoKey, ticketKey), [rows, procesoKey, ticketKey])
  const gapEntries = [...gapTree.entries()].sort(([a], [b]) => a.localeCompare(b))
  const total      = gapEntries.reduce((s, [, sites]) =>
    s + [...sites.values()].reduce((a, e) => a + e.count, 0), 0)
  const FS = forPrint ? 8 : 10

  if (!total) return (
    <div style={{ padding: forPrint ? '4px 8px' : 16, textAlign: 'center', color: '#4b5563', fontSize: forPrint ? 8 : 11, fontFamily: 'Arial, sans-serif' }}>
      Sin tickets registrados para este proceso.
    </div>
  )

  const cellGap = { padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0' }
  const cellSub = { background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }
  const cellTot = { fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }

  function goToTablas(siteName) {
    if (!forPrint) navigate(`/rollout/ack/tablas?sitio=${encodeURIComponent(siteName)}`)
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          <th style={thCenterStyle(color, forPrint)}>Owner</th>
          <th style={{ ...thCenterStyle(color, forPrint), width: forPrint ? 90 : 130 }}>No. Ticket</th>
          <th style={thCenterStyle(color, forPrint)}>No de Actividades</th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.map(([gap, sites]) => {
          const fin      = isFinal(gap)
          const gapTotal = [...sites.values()].reduce((s, e) => s + e.count, 0)
          const txtColor = fin ? '#166534' : '#C00000'
          return [
            <tr key={gap}>
              <td style={{ ...cellGap, color: txtColor }}>{gap}</td>
              <td style={{ ...cellGap, color: txtColor, textAlign: 'center' }}>—</td>
              <td style={{ ...cellGap, color: txtColor, textAlign: 'center' }}>—</td>
              <td style={{ ...cellGap, color: txtColor, textAlign: 'center' }}>{gapTotal}</td>
            </tr>,
            ...[...sites.entries()]
              .sort(([a], [b]) => String(a).localeCompare(String(b)))
              .map(([site, { owner, count, ids }]) => {
                const ticketNums = [...ids].sort().join(', ') || '—'
                const ownerLabel = resolveOwner(owner, empresaNombre)
                return (
                  <tr key={`${gap}|${site}`}>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px' }}>
                      {forPrint ? site : (
                        <span
                          onClick={() => goToTablas(site)}
                          style={{ cursor: 'pointer', color: '#1a3a5c', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                          title="Ver en Tablas"
                        >
                          {site}
                        </span>
                      )}
                    </td>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center', color: '#555' }}>
                      {ownerLabel}
                    </td>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center', color: '#1a3a5c', fontWeight: 600 }}>
                      {ticketNums}
                    </td>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center' }}>
                      {count}
                    </td>
                  </tr>
                )
              }),
          ]
        })}
        <tr>
          <td style={{ ...cellTot, padding: forPrint ? '4px 7px' : '5px 10px' }}>Total general</td>
          <td style={{ ...cellTot, padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center' }}>—</td>
          <td style={{ ...cellTot, padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center' }}>—</td>
          <td style={{ ...cellTot, padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center' }}>{total}</td>
        </tr>
      </tbody>
    </table>
  )
}
