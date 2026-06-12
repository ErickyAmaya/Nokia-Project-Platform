import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildFcData, PROC_CFG, thStyle, thCenterStyle } from './helpers'

export default function NokiaFcTable({ rows, procesoKey, forecasts, ticketKey, label, color = '#7030A0', forPrint = false }) {
  const navigate = useNavigate()
  const { gapEntries, weeks } = useMemo(
    () => buildFcData(rows, procesoKey, forecasts, PROC_CFG[procesoKey].fa, ticketKey),
    [rows, procesoKey, forecasts, ticketKey]
  )

  if (!weeks.length) return (
    <div style={{ padding: forPrint ? '4px 8px' : 16, textAlign: 'center', color: '#4b5563', fontSize: forPrint ? 8 : 11, fontFamily: 'Arial, sans-serif' }}>
      Sin fechas FC registradas.
    </div>
  )

  const FS    = forPrint ? 8 : 10
  const totBg = { background: '#003366', color: '#fff', border: '1px solid #003366', fontWeight: 800 }

  function goToTablas(siteName) {
    if (!forPrint) navigate(`/rollout/ack/tablas?sitio=${encodeURIComponent(siteName)}`)
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          {weeks.map(w => <th key={w} style={thCenterStyle(color, forPrint, { width: 'auto' })}>{w}</th>)}
          <th style={thCenterStyle(color, forPrint, { width: 44 })}>TICKETS</th>
          <th style={{ ...thCenterStyle('#003366', forPrint, { width: 'auto' }), background: '#003366', border: '1px solid #003366' }}>
            No de Actividades
          </th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.map(([gap, g]) => {
          const gapTotal   = [...g.weeks.values()].reduce((s, v) => s + v, 0)
          const gapTickets = [...g.sites.values()].reduce((s, v) => s + v.ticketCount, 0)
          return [
            <tr key={gap}>
              <td style={{ padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: '#C00000' }}>{gap}</td>
              {weeks.map(w => <td key={w} style={{ padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center', background: '#DCE6F1', border: '1px solid #c0c0c0', fontWeight: 700 }}>{g.weeks.get(w) || ''}</td>)}
              <td style={{ padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center', background: '#DCE6F1', border: '1px solid #c0c0c0', fontWeight: 700, color: gapTickets ? '#1a3a5c' : '#ccc' }}>{gapTickets || '—'}</td>
              <td style={{ ...totBg, padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center' }}>{gapTotal}</td>
            </tr>,
            ...[...g.sites.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([site, s]) => {
              const siteTotal = [...s.weeks.values()].reduce((a, sw) => a + sw.count, 0)
              if (!siteTotal) return null
              return (
                <tr key={`${gap}|${site}`}>
                  <td style={{ padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                    {forPrint ? site : (
                      <span onClick={() => goToTablas(site)}
                        style={{ cursor: 'pointer', color: '#1a3a5c', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                        title="Ver todos los SMPs en Tablas">
                        {site}
                      </span>
                    )}
                  </td>
                  {weeks.map(w => {
                    const sw    = s.weeks.get(w)
                    const count = sw?.count || 0
                    const title = sw ? [...sw.exactDates].sort().join(' · ') : ''
                    return (
                      <td key={w}
                        title={title || undefined}
                        style={{
                          padding: forPrint ? '2px 5px' : '3px 7px',
                          textAlign: 'center',
                          background: '#fff',
                          border: '1px solid #e8e8e8',
                          fontSize: forPrint ? 7.5 : 9,
                          cursor: (!forPrint && title) ? 'zoom-in' : 'default',
                        }}
                      >
                        {count || ''}
                      </td>
                    )
                  })}
                  <td style={{ padding: forPrint ? '2px 5px' : '3px 7px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9, color: s.ticketCount ? '#1a3a5c' : '#ccc', fontWeight: s.ticketCount ? 700 : 400 }}>
                    {s.ticketCount || '—'}
                  </td>
                  <td style={{ padding: forPrint ? '2px 5px' : '3px 7px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>{siteTotal}</td>
                </tr>
              )
            }),
          ]
        })}
        <tr>
          <td style={{ ...totBg, padding: forPrint ? '4px 7px' : '5px 10px' }}>Total general</td>
          {weeks.map(w => {
            const col = gapEntries.reduce((s, [, g]) => s + (g.weeks.get(w) || 0), 0)
            return <td key={w} style={{ ...totBg, padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center' }}>{col || ''}</td>
          })}
          <td style={{ ...totBg, padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center' }}>
            {gapEntries.reduce((s, [, g]) => s + [...g.sites.values()].reduce((a, v) => a + v.ticketCount, 0), 0) || '—'}
          </td>
          <td style={{ ...totBg, padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center' }}>
            {gapEntries.reduce((s, [, g]) => s + [...g.weeks.values()].reduce((a, b) => a + b, 0), 0)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
