import { useMemo } from 'react'
import { buildGapTree, isFinal, thStyle, thCenterStyle } from './helpers'

export default function NokiaTable({ rows, procesoKey, label, color = '#7030A0', forPrint = false }) {
  const gapTree    = useMemo(() => buildGapTree(rows, procesoKey), [rows, procesoKey])
  const gapEntries = [...gapTree.entries()].sort(([a], [b]) => a.localeCompare(b))
  const total      = rows.length
  const FS         = forPrint ? 8 : 10

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          <th style={thCenterStyle(color, forPrint)}>No de Actividades</th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.length === 0
          ? <tr><td colSpan={2} style={{ padding: 12, textAlign: 'center', color: '#4b5563' }}>Sin datos</td></tr>
          : gapEntries.map(([gap, sites]) => {
              const fin      = isFinal(gap)
              const gapTotal = [...sites.values()].reduce((s, v) => s + v, 0)
              return [
                <tr key={gap}>
                  <td style={{ padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: fin ? '#166534' : '#C00000' }}>
                    {gap}
                  </td>
                  <td style={{ padding: forPrint ? '3px 5px' : '4px 8px', textAlign: 'center', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: fin ? '#166534' : '#C00000' }}>
                    {gapTotal}
                  </td>
                </tr>,
                ...[...sites.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([site, cnt]) => (
                  <tr key={`${gap}|${site}`}>
                    <td style={{ padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                      {site}
                    </td>
                    <td style={{ padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                      {cnt}
                    </td>
                  </tr>
                )),
              ]
            })
        }
        <tr>
          <td style={{ padding: forPrint ? '4px 7px' : '5px 10px', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>
            Total general
          </td>
          <td style={{ padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>
            {total}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
