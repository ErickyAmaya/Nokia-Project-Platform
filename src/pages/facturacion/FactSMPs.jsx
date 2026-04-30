import { useState, useMemo } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS } from '../../store/useFactStore'

const STATUS_STYLES = {
  facturar:  { bg: '#fee2e2', color: '#991b1b', label: 'Facturar' },
  facturado: { bg: '#dcfce7', color: '#166534', label: 'Facturado' },
  sin_sgr:   { bg: '#fef3c7', color: '#92400e', label: 'Sin sGR' },
  no_aplica: { bg: '#f4f4f5', color: '#71717a', label: '—' },
}

function StatusChip({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.no_aplica
  return <span style={{ background: s.bg, color: s.color, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>{s.label}</span>
}

export default function FactSMPs() {
  const ppa      = useFactStore(s => s.ppa)
  const invoices = useFactStore(s => s.invoices)

  const [search,   setSearch]   = useState('')
  const [filtro,   setFiltro]   = useState('todos')
  const [sortCol,  setSortCol]  = useState('customer_site_name')
  const [sortDir,  setSortDir]  = useState(1)

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const rows = useMemo(() => {
    return ppa
      .map(row => {
        if (!row.sgr) return { row, overallStatus: 'sin_sgr', eventos: [] }
        const eventos = getEventosRow(row, invMap)
        const hasPF   = eventos.some(e => e.status === 'facturar')
        const hasFC   = eventos.some(e => e.status === 'facturado')
        const overall = hasPF ? 'facturar' : hasFC ? 'facturado' : 'no_aplica'
        return { row, overallStatus: overall, eventos }
      })
      .filter(({ row, overallStatus }) => {
        if (filtro !== 'todos' && overallStatus !== filtro) return false
        if (!search) return true
        return `${row.customer_site_name} ${row.spo_number} ${row.smp_id} ${row.ms_name} ${row.sgr || ''}`.toLowerCase().includes(search.toLowerCase())
      })
      .sort((a, b) => {
        const va = a.row[sortCol] || '', vb = b.row[sortCol] || ''
        return String(va).localeCompare(String(vb)) * sortDir
      })
  }, [ppa, invMap, search, filtro, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => -d)
    else { setSortCol(col); setSortDir(1) }
  }

  const SH = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>
      {label} {sortCol === col ? (sortDir === 1 ? '▲' : '▼') : ''}
    </th>
  )

  if (!ppa.length) return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c', fontSize: 13 }}>Sin datos. Carga el PPA Nokia desde el Dashboard.</div>

  return (
    <>
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Todos los SMPs</h1>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{rows.length} de {ppa.length} SPOs</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fc" placeholder="Buscar sitio, SPO, SMP, sGR…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 240 }} />
          <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: 11 }}>
            <option value="todos">Todos</option>
            <option value="facturar">Por Facturar</option>
            <option value="facturado">Facturado</option>
            <option value="sin_sgr">Sin sGR</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflow: 'auto', maxHeight: '65vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#f8faf8', borderBottom: '2px solid #e8eae8' }}>
              <SH col="customer_site_name" label="Sitio" />
              <SH col="smp_id"             label="SMP ID" />
              <SH col="spo_number"         label="SPO" />
              <SH col="ms_name"            label="MS Name" />
              <th style={{ padding: '8px 10px', fontWeight: 700, color: '#555', fontSize: 10, position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>sGR</th>
              {EVENTOS.map(ev => (
                <th key={ev.key} style={{ padding: '8px 6px', fontWeight: 700, color: ev.color, fontSize: 9, textAlign: 'center', letterSpacing: .3, position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>
                  {ev.label}
                </th>
              ))}
              <th style={{ padding: '8px 10px', fontWeight: 700, color: '#555', fontSize: 10, position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, overallStatus, eventos }) => (
              <tr key={row.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '6px 10px', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.customer_site_name || row.site_reference_id}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{row.smp_id}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 10 }}>{row.spo_number}</td>
                <td style={{ padding: '6px 10px', fontSize: 10, color: '#555' }}>{row.ms_name}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 9, color: row.sgr ? '#144E4A' : '#d4d4d8' }}>{row.sgr || '—'}</td>
                {EVENTOS.map(ev => {
                  const evData = eventos.find(e => e.key === ev.key)
                  if (!evData) return <td key={ev.key} style={{ padding: '6px 6px', textAlign: 'center', color: '#e4e4e7', fontSize: 9 }}>—</td>
                  return <td key={ev.key} style={{ padding: '6px 6px', textAlign: 'center' }}><StatusChip status={evData.status} /></td>
                })}
                <td style={{ padding: '6px 10px' }}><StatusChip status={overallStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
