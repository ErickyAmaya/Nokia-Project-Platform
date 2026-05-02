import { useState, useMemo } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS, getSmpCat, SMP_CATS } from '../../store/useFactStore'
import { showToast } from '../../components/Toast'

const EV_FILTERS = [
  { key: 'todos',         label: 'Todos los eventos' },
  { key: 'acuerdo',       label: 'Acuerdo' },
  { key: 'servicio|impl', label: 'Servicio · Implementación' },
  { key: 'servicio|adj',  label: 'Servicio · ADJ' },
  { key: 'servicio|cr',   label: 'Servicio · CR' },
  { key: 'servicio|cw',   label: 'Servicio · CW' },
  { key: 'servicio|tss',  label: 'Servicio · TSS' },
]

function applyEvFilter(eventos, row, filtroEv) {
  if (filtroEv === 'todos') return eventos
  const cat = getSmpCat(row.smp_name).key
  if (filtroEv === 'acuerdo')         return eventos.filter(e => e.key === 'acuerdo')
  if (filtroEv === 'servicio|impl')   return eventos.filter(e => e.key === 'servicio'              && cat === 'impl')
  if (filtroEv === 'servicio|adj')    return eventos.filter(e => e.key === 'servicio'              && cat === 'adj')
  if (filtroEv === 'servicio|cr')     return eventos.filter(e => e.key === 'servicio'              && cat === 'cr')
  if (filtroEv === 'servicio|cw')     return eventos.filter(e => (e.key === 'cw_1' || e.key === 'cw_2')   && cat === 'cw')
  if (filtroEv === 'servicio|tss')    return eventos.filter(e => (e.key === 'tss_1' || e.key === 'tss_2') && cat === 'tss')
  return eventos
}

function EventoBadge({ color, label, pct }) {
  return (
    <span style={{ background: `${color}18`, border: `1px solid ${color}40`, color, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: .4 }}>
      {label} · {pct}%
    </span>
  )
}

export default function FactFacturado() {
  const ppa             = useFactStore(s => s.ppa)
  const invoices        = useFactStore(s => s.invoices)
  const pos             = useFactStore(s => s.pos)
  const eliminarFactura = useFactStore(s => s.eliminarFactura)

  const [search,   setSearch]   = useState('')
  const [filtroEv, setFiltroEv] = useState('todos')

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const rows = useMemo(() => {
    const result = []
    for (const row of ppa) {
      const eventos = getEventosRow(row, invMap).filter(e => e.status === 'facturado')
      if (!eventos.length) continue
      const filtered = applyEvFilter(eventos, row, filtroEv)
      if (!filtered.length) continue
      if (search && !`${row.customer_site_name} ${row.spo_number} ${row.smp_id} ${row.ms_name}`.toLowerCase().includes(search.toLowerCase())) continue
      result.push({ row, eventos: filtered })
    }
    return result
  }, [ppa, invMap, filtroEv, search])

  const totalFacturado = useMemo(() => {
    let total = 0
    for (const { row, eventos } of rows) {
      const poData = pos.find(p => p.spo_number === row.spo_number)
      if (!poData?.valor) continue
      for (const ev of eventos) total += poData.valor * ev.pct / 100
    }
    return total
  }, [rows, pos])

  const fmtCOP = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  async function handleEliminar(inv) {
    if (!window.confirm('¿Eliminar este registro de factura?')) return
    try { await eliminarFactura(inv.id); showToast('Registro eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  if (!ppa.length) return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>Sin datos. Carga el PPA Nokia desde el Dashboard.</div>

  return (
    <>
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Facturado
            {totalFacturado > 0 && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>{fmtCOP(totalFacturado)}</span>}
          </h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{rows.length} SPO{rows.length !== 1 ? 's' : ''} con facturas registradas</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fc" placeholder="Buscar sitio, SPO, factura…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 220 }} />
          <select className="fc" value={filtroEv} onChange={e => setFiltroEv(e.target.value)} style={{ fontSize: 11 }}>
            {EV_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#617561', fontSize: 13 }}>Sin facturas registradas con los filtros actuales.</div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8faf8', borderBottom: '2px solid #e8eae8' }}>
                {['Sitio', 'SMP ID', 'SPO', 'MS Name', 'Evento', 'N° Factura', 'Fecha', 'Valor', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, eventos }) =>
                eventos.map((ev, i) => {
                  const poData = pos.find(p => p.spo_number === row.spo_number)
                  const valor  = poData?.valor ? poData.valor * ev.pct / 100 : null
                  return (
                    <tr key={`${row.spo_number}|${ev.key}`} style={{ borderTop: '1px solid #f0f0f0' }}>
                      {i === 0 && (
                        <>
                          <td style={{ padding: '7px 10px', fontWeight: 600 }} rowSpan={eventos.length}>{row.customer_site_name || row.site_reference_id}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.smp_id}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10 }} rowSpan={eventos.length}>{row.spo_number}</td>
                          <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.ms_name}</td>
                        </>
                      )}
                      <td style={{ padding: '7px 10px' }}><EventoBadge color={ev.color} label={ev.label} pct={ev.pct} /></td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#144E4A', fontFamily: 'monospace', fontSize: 10 }}>{ev.invoice.numero_factura}</td>
                      <td style={{ padding: '7px 10px', color: '#555' }}>{ev.invoice.fecha_factura || '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#555', fontSize: 10 }}>{valor ? fmtCOP(valor) : <span style={{ color: '#d4d4d8' }}>—</span>}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <button onClick={() => handleEliminar(ev.invoice)} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Quitar</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
