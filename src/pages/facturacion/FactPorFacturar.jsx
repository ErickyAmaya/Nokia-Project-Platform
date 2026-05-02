import { useState, useMemo, useRef } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS, getSmpCat, SMP_CATS } from '../../store/useFactStore'
import { showToast } from '../../components/Toast'
import { descargarPlantillaFacturas, parsearExcelFacturas } from '../../lib/factImport'

const EMPTY_FORM  = { numero_factura: '', fecha_factura: '', observaciones: '' }
const SMP_FILTERS = [{ key: 'todos', label: 'Todas las categorías' }, ...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }]
const EV_FILTERS = [
  { key: 'todos',         label: 'Todos los servicios' },
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

const TH = ({ children }) => (
  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>
    {children}
  </th>
)

function SpoCell({ spo, pos }) {
  const pdf = pos.find(p => p.spo_number === spo)?.pdf_url
  if (pdf) return (
    <a href={pdf} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontSize: 10, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }} title="Ver PDF de PO">
      {spo} ↗
    </a>
  )
  return <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{spo}</span>
}

function EventoBadge({ ev }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${ev.color}18`, border: `1px solid ${ev.color}40`, color: ev.color, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: .4 }}>
      {ev.label} · {ev.pct}%
    </span>
  )
}

function MissingBadge({ missing }) {
  return (
    <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {missing}
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
      await onSave({ spo_number: row.spo_number, evento: ev.key, pct: ev.pct, numero_factura: form.numero_factura.trim(), fecha_factura: form.fecha_factura || null, observaciones: form.observaciones || null })
      showToast('Factura registrada')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Registrar Factura</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 18 }}>{row.customer_site_name} · SPO {row.spo_number}</div>
        <div style={{ background: '#f8faf8', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>Evento</span><EventoBadge ev={ev} />
          </div>
          {poData?.valor && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ color: '#555' }}>Valor estimado</span>
              <span style={{ fontWeight: 700 }}>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(poData.valor * ev.pct / 100)}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fg"><label className="fl">Número de Factura *</label><input className="fc" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FE-001-2025" /></div>
          <div className="fg"><label className="fl">Fecha de Factura</label><input type="date" className="fc" value={form.fecha_factura} onChange={e => setForm(f => ({ ...f, fecha_factura: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Observaciones</label><input className="fc" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{saving ? 'Guardando…' : '✓ Registrar'}</button>
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
  const importarFacturas = useFactStore(s => s.importarFacturas)

  const [search,    setSearch]    = useState('')
  const [filtroEv,  setFiltroEv]  = useState('todos')
  const [modal,     setModal]     = useState(null)
  const [importing,  setImporting]  = useState(false)
  const importRef = useRef(null)

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  // Todos los pendientes sin filtros — para la plantilla
  const allPendingRows = useMemo(() => {
    const result = []
    for (const row of ppa) {
      if (!row.sgr) continue
      const eventos = getEventosRow(row, invMap).filter(e => e.status === 'facturar')
      if (!eventos.length) continue
      result.push({ row, eventos })
    }
    return result
  }, [ppa, invMap])

  async function handleDescargarPlantilla() {
    if (!allPendingRows.length) { showToast('No hay facturas pendientes', 'err'); return }
    try { await descargarPlantillaFacturas(allPendingRows) }
    catch (e) { showToast('Error al generar plantilla: ' + e.message, 'err') }
  }

  async function handleImportar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const { items, errors } = await parsearExcelFacturas(file)
      if (errors.length) errors.forEach(err => showToast(err, 'err'))
      if (!items.length) { showToast('No se encontraron facturas para importar', 'err'); return }
      const n = await importarFacturas(items)
      showToast(`${n} factura${n !== 1 ? 's' : ''} importada${n !== 1 ? 's' : ''} correctamente`)
    } catch (e) {
      showToast('Error al importar: ' + e.message, 'err')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  // Lista principal: tienen GR + % → pueden facturarse ahora
  const rows = useMemo(() => {
    const result = []
    for (const row of ppa) {
      if (!row.sgr) continue
      const cat    = getSmpCat(row.smp_name)
      const eventos = getEventosRow(row, invMap).filter(e => e.status === 'facturar')
      if (!eventos.length) continue
      const filtered = applyEvFilter(eventos, row, filtroEv)
      if (!filtered.length) continue
      if (search && !`${row.customer_site_name} ${row.spo_number} ${row.smp_id} ${row.ms_name} ${row.smp_name}`.toLowerCase().includes(search.toLowerCase())) continue
      result.push({ row, eventos: filtered, cat })
    }
    return result
  }, [ppa, invMap, filtroEv, search])

  // Lista secundaria: bloqueados por falta de GR y/o %
  const libRows = useMemo(() => {
    const result = []
    for (const row of ppa) {
      const evs   = getEventosRow(row, invMap)
      const hasPF = evs.some(e => e.status === 'facturar')
      const hasFC = evs.some(e => e.status === 'facturado')
      if (hasPF) continue  // ya está en la lista principal

      const hasGR     = !!row.sgr
      const hasAnyPct = EVENTOS.some(ev => (row[ev.pctCol] || 0) > 0)
      if (hasGR && hasAnyPct && hasFC) continue  // totalmente facturado
      if (hasGR && hasAnyPct) continue            // debería estar en rows

      const cat = getSmpCat(row.smp_name)
      if (search && !`${row.customer_site_name} ${row.spo_number} ${row.smp_id} ${row.ms_name}`.toLowerCase().includes(search.toLowerCase())) continue

      const missing = !hasGR && !hasAnyPct ? 'Sin GR · Sin %'
                    : !hasGR               ? 'Sin GR'
                    :                        'Sin %'
      result.push({ row, cat, missing })
    }
    return result
  }, [ppa, invMap, search])

  if (!ppa.length) return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>Sin datos. Carga el PPA Nokia desde el Dashboard.</div>

  return (
    <>
      {modal && <FacturarModal row={modal.row} ev={modal.ev} pos={pos} onClose={() => setModal(null)} onSave={registrarFactura} />}

      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Por Facturar
            {rows.length > 0    && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>{rows.length}</span>}
            {libRows.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>{libRows.length} lib.</span>}
          </h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{rows.length} SPO{rows.length !== 1 ? 's' : ''} facturables · {libRows.length} pendientes de liberación</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="fc" placeholder="Buscar sitio, SPO, SMP…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 200 }} />
          <select className="fc" value={filtroEv} onChange={e => setFiltroEv(e.target.value)} style={{ fontSize: 11 }}>
            {EV_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <div style={{ width: 1, height: 24, background: '#e0e4e0', flexShrink: 0 }} />
          <button
            onClick={handleDescargarPlantilla}
            disabled={!allPendingRows.length}
            style={{ fontSize: 11, color: '#144E4A', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            ↓ Plantilla
          </button>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            style={{ fontSize: 11, color: '#fff', background: '#144E4A', border: 'none', borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .4 }}
          >
            {importing ? '⏳ Importando…' : '↑ Importar facturas'}
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportar} />
        </div>
      </div>

      {/* ── Lista principal: Pendiente por facturar ───────────────── */}
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: '#22c55e', fontSize: 14, fontWeight: 600 }}>
          ✓ No hay SPOs facturables pendientes con los filtros actuales
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '55vh', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 760 }}>
            <thead>
              <tr style={{ background: '#f8faf8', borderBottom: '2px solid #e8eae8' }}>
                <TH>Sitio</TH><TH>SMP ID</TH><TH>SPO</TH><TH>Categoría</TH><TH>Evento</TH><TH>sGR</TH><TH>Valor PO</TH><TH></TH>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, eventos, cat }) =>
                eventos.map((ev, i) => {
                  const poData = pos.find(p => p.spo_number === row.spo_number)
                  return (
                    <tr key={`${row.spo_number}|${ev.key}`} style={{ borderTop: '1px solid #f0f0f0' }}>
                      {i === 0 && (
                        <>
                          <td style={{ padding: '7px 10px', fontWeight: 600 }} rowSpan={eventos.length}>{row.customer_site_name || row.site_reference_id}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.smp_id}</td>
                          <td style={{ padding: '7px 10px' }} rowSpan={eventos.length}><SpoCell spo={row.spo_number} pos={pos} /></td>
                          <td style={{ padding: '7px 10px' }} rowSpan={eventos.length}>
                            <span style={{ background: `${cat.color}15`, color: cat.color, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>{cat.label}</span>
                          </td>
                        </>
                      )}
                      <td style={{ padding: '7px 10px' }}><EventoBadge ev={ev} /></td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#144E4A', fontWeight: 600 }}>{row.sgr}</td>
                      <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }}>
                        {poData?.valor
                          ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(poData.valor * ev.pct / 100)
                          : <span style={{ color: '#d4d4d8' }}>Sin PO</span>}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <button onClick={() => setModal({ row, ev })} style={{ background: '#144E4A', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Facturar</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Lista secundaria: Pendiente Liberación ────────────────── */}
      {libRows.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#92400e' }}>Pendiente Liberación</div>
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>{libRows.length}</span>
            <div style={{ fontSize: 11, color: '#4b5563' }}>— SPOs bloqueados por falta de GR y/o %</div>
          </div>
          <div className="card" style={{ overflow: 'auto', maxHeight: '45vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 680 }}>
              <thead>
                <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fcd34d' }}>
                  <TH>Sitio</TH><TH>SMP ID</TH><TH>SPO</TH><TH>Categoría</TH><TH>Falta</TH><TH>Valor PO</TH>
                </tr>
              </thead>
              <tbody>
                {libRows.map(({ row, cat, missing }) => {
                  const poData = pos.find(p => p.spo_number === row.spo_number)
                  return (
                    <tr key={row.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{row.customer_site_name || row.site_reference_id}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{row.smp_id}</td>
                      <td style={{ padding: '7px 10px' }}><SpoCell spo={row.spo_number} pos={pos} /></td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ background: `${cat.color}15`, color: cat.color, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>{cat.label}</span>
                      </td>
                      <td style={{ padding: '7px 10px' }}><MissingBadge missing={missing} /></td>
                      <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }}>
                        {poData?.valor
                          ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(poData.valor)
                          : <span style={{ color: '#d4d4d8' }}>Sin PO</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
