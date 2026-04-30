import { useState, useMemo } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS } from '../../store/useFactStore'
import { showToast } from '../../components/Toast'

const EMPTY_FORM = { numero_factura: '', fecha_factura: '', observaciones: '' }

function EventoBadge({ ev }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${ev.color}18`, border: `1px solid ${ev.color}40`,
      color: ev.color, borderRadius: 6, fontSize: 9, fontWeight: 700,
      padding: '2px 7px', letterSpacing: .4,
    }}>
      {ev.label} · {ev.pct}%
    </span>
  )
}

function FacturarModal({ row, ev, pos, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const poData = pos.find(p => p.spo_number === row.spo_number)

  async function handleSave() {
    if (!form.numero_factura.trim()) { showToast('Ingresa el número de factura', 'err'); return }
    setSaving(true)
    try {
      await onSave({ spo_number: row.spo_number, evento: ev.key, pct: ev.pct,
                     numero_factura: form.numero_factura.trim(),
                     fecha_factura: form.fecha_factura || null,
                     observaciones: form.observaciones || null })
      showToast('Factura registrada')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Registrar Factura
        </div>
        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 18 }}>
          {row.customer_site_name} · SPO {row.spo_number}
        </div>
        <div style={{ background: '#f8faf8', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>Evento</span>
            <EventoBadge ev={ev} />
          </div>
          {poData?.valor && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ color: '#555' }}>Valor estimado</span>
              <span style={{ fontWeight: 700 }}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(poData.valor * ev.pct / 100)}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fg">
            <label className="fl">Número de Factura *</label>
            <input className="fc" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FE-001-2025" />
          </div>
          <div className="fg">
            <label className="fl">Fecha de Factura</label>
            <input type="date" className="fc" value={form.fecha_factura} onChange={e => setForm(f => ({ ...f, fecha_factura: e.target.value }))} />
          </div>
          <div className="fg">
            <label className="fl">Observaciones</label>
            <input className="fc" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {saving ? 'Guardando…' : '✓ Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FactPorFacturar() {
  const ppa              = useFactStore(s => s.ppa)
  const invoices         = useFactStore(s => s.invoices)
  const pos              = useFactStore(s => s.pos)
  const registrarFactura = useFactStore(s => s.registrarFactura)

  const [search,  setSearch]  = useState('')
  const [filtroEv, setFiltroEv] = useState('todos')
  const [modal, setModal] = useState(null) // { row, ev }

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const rows = useMemo(() => {
    const result = []
    for (const row of ppa) {
      if (!row.sgr) continue
      const eventos = getEventosRow(row, invMap).filter(e => e.status === 'facturar')
      if (!eventos.length) continue
      const filtered = filtroEv === 'todos' ? eventos : eventos.filter(e => e.key === filtroEv)
      if (!filtered.length) continue
      if (search && !`${row.customer_site_name} ${row.spo_number} ${row.smp_id} ${row.ms_name}`.toLowerCase().includes(search.toLowerCase())) continue
      result.push({ row, eventos: filtered })
    }
    return result
  }, [ppa, invMap, filtroEv, search])

  if (!ppa.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c', fontSize: 13 }}>
      Sin datos. Carga el PPA Nokia desde el Dashboard.
    </div>
  )

  return (
    <>
      {modal && (
        <FacturarModal
          row={modal.row} ev={modal.ev} pos={pos}
          onClose={() => setModal(null)}
          onSave={registrarFactura}
        />
      )}

      {/* Controles */}
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Por Facturar</h1>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{rows.length} SPO{rows.length !== 1 ? 's' : ''} con eventos pendientes</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fc" placeholder="Buscar sitio, SPO, SMP…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 220 }} />
          <select className="fc" value={filtroEv} onChange={e => setFiltroEv(e.target.value)} style={{ fontSize: 11 }}>
            <option value="todos">Todos los eventos</option>
            {EVENTOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#22c55e', fontSize: 14, fontWeight: 600 }}>
          ✓ Todo facturado — no hay pendientes con los filtros actuales
        </div>
      ) : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8faf8', borderBottom: '2px solid #e8eae8' }}>
                {['Sitio', 'SMP ID', 'SPO', 'MS Name', 'Evento', 'sGR', 'Valor PO', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, eventos }) =>
                eventos.map((ev, i) => {
                  const poData = pos.find(p => p.spo_number === row.spo_number)
                  return (
                    <tr key={`${row.spo_number}|${ev.key}`} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {i === 0 ? (
                        <>
                          <td style={{ padding: '7px 10px', fontWeight: 600 }} rowSpan={eventos.length}>{row.customer_site_name || row.site_reference_id}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.smp_id}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10 }} rowSpan={eventos.length}>{row.spo_number}</td>
                          <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.ms_name}</td>
                        </>
                      ) : null}
                      <td style={{ padding: '7px 10px' }}><EventoBadge ev={ev} /></td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#144E4A', fontWeight: 600 }}>{row.sgr}</td>
                      <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }}>
                        {poData?.valor
                          ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(poData.valor * ev.pct / 100)
                          : <span style={{ color: '#d4d4d8' }}>Sin PO</span>
                        }
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <button
                          onClick={() => setModal({ row, ev })}
                          style={{
                            background: '#144E4A', color: '#fff', border: 'none', borderRadius: 6,
                            padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Facturar
                        </button>
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
