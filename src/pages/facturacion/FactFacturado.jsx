import { useState, useMemo, useRef, useEffect } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS, getSmpCat, SMP_CATS } from '../../store/useFactStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'

const CAT_ORDER = ['impl', 'adj', 'cw', 'cr', 'tss', 'other']
const CAT_MAP   = Object.fromEntries([...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }].map(c => [c.key, c]))

function NumFactura({ numero, observaciones }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => observaciones && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ fontWeight: 700, color: '#144E4A', fontFamily: 'monospace', fontSize: 10, cursor: observaciones ? 'help' : 'default' }}>
        {numero}{observaciones ? ' ●' : ''}
      </span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: 0, zIndex: 999,
          background: '#1f2937', color: '#f9fafb', borderRadius: 8,
          padding: '7px 11px', fontSize: 11, whiteSpace: 'pre-wrap',
          maxWidth: 240, boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          lineHeight: 1.5, pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', marginBottom: 3, letterSpacing: '.04em' }}>OBSERVACIONES</div>
          {observaciones}
        </div>
      )}
    </span>
  )
}

function MiniBar({ pct }) {
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 56, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
        <div style={{ height: 4, borderRadius: 2, background: color, width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color, minWidth: 26 }}>{pct}%</span>
    </div>
  )
}

const EV_FILTERS = [
  { key: 'todos',         label: 'Todos los servicios' },
  { key: 'acuerdo',       label: 'Acuerdo' },
  { key: 'servicio|impl', label: 'Servicio · Implementación' },
  { key: 'servicio|adj',  label: 'Servicio · ADJ' },
  { key: 'servicio|cr',   label: 'Servicio · CR' },
  { key: 'servicio|cw',   label: 'Servicio · CW' },
  { key: 'servicio|tss',  label: 'Servicio · TSS' },
]

const DESEMP_STYLE = {
  A:    { bg: '#fef2f2', color: '#b91c1c' },
  AA:   { bg: '#fffbeb', color: '#b45309' },
  AAA:  { bg: '#eff6ff', color: '#1d4ed8' },
  AAAA: { bg: '#f0fdf4', color: '#166534' },
}
function DesempenoBadge({ val }) {
  if (!val) return <span style={{ color: '#d4d4d8', fontSize: 10 }}>—</span>
  const s = DESEMP_STYLE[val] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>
      {val}
    </span>
  )
}

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

function EventoBadge({ color, label, pct, invoicedPct, absorbed }) {
  if (absorbed) {
    return (
      <span style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: .4 }}>
        {label} · <span style={{ textDecoration: 'line-through', opacity: .6 }}>{pct}%</span> → Facturado por Acuerdo
      </span>
    )
  }
  const parcial = invoicedPct != null && invoicedPct < pct
  return (
    <span style={{ background: `${color}18`, border: `1px solid ${color}40`, color, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: .4 }}>
      {label} · {parcial
        ? <>{<span style={{ textDecoration: 'line-through', opacity: .5 }}>{pct}%</span>} → {invoicedPct}%</>
        : `${invoicedPct ?? pct}%`}
    </span>
  )
}

function EditFacturaModal({ inv, onClose, onSave }) {
  const [form, setForm] = useState({
    numero_factura: inv.numero_factura || '',
    fecha_factura:  inv.fecha_factura  || '',
    observaciones:  inv.observaciones  || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.numero_factura.trim()) { showToast('Ingresa el número de factura', 'err'); return }
    setSaving(true)
    try {
      await onSave({
        spo_number:     inv.spo_number,
        evento:         inv.evento,
        pct:            inv.pct,
        numero_factura: form.numero_factura.trim(),
        fecha_factura:  form.fecha_factura || null,
        observaciones:  form.observaciones || null,
      })
      showToast('Factura actualizada')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Editar Factura</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 18 }}>SPO {inv.spo_number} · {inv.evento}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fg"><label className="fl">Número de Factura *</label><input className="fc" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Fecha de Factura</label><input type="date" className="fc" value={form.fecha_factura} onChange={e => setForm(f => ({ ...f, fecha_factura: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Observaciones</label><input className="fc" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{saving ? 'Guardando…' : '✓ Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function FactFacturado() {
  const ppa              = useFactStore(s => s.ppa)
  const invoices         = useFactStore(s => s.invoices)
  const pos              = useFactStore(s => s.pos)
  const loading          = useFactStore(s => s.loading)
  const eliminarFactura = useFactStore(s => s.eliminarFactura)
  const registrarFactura = useFactStore(s => s.registrarFactura)

  const isViewer = useAuthStore(s => s.user?.role === 'viewer')

  const [search,        setSearch]        = useState('')
  const [filtroEv,      setFiltroEv]      = useState('todos')
  const [editInv,       setEditInv]       = useState(null)
  const [fechaDesde,    setFechaDesde]    = useState('')
  const [fechaHasta,    setFechaHasta]    = useState('')
  const [expandedSites,  setExpandedSites]  = useState(new Set())
  const [hideCompletos,  setHideCompletos]  = useState(false)

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const rows = useMemo(() => {
    const result = []
    for (const row of ppa) {
      const eventos = getEventosRow(row, invMap).filter(e => e.status === 'facturado')
      if (!eventos.length) continue
      let filtered = applyEvFilter(eventos, row, filtroEv)
      if (!filtered.length) continue
      if (fechaDesde) filtered = filtered.filter(e => (e.invoice?.fecha_factura || '') >= fechaDesde)
      if (fechaHasta) filtered = filtered.filter(e => (e.invoice?.fecha_factura || '') <= fechaHasta)
      if (!filtered.length) continue
      const numFacturas = eventos.map(e => e.invoice?.numero_factura || '').join(' ')
      if (search && !`${row.customer_site_name} ${row.spo_number} ${row.smp_id} ${row.ms_name} ${numFacturas}`.toLowerCase().includes(search.toLowerCase())) continue
      result.push({ row, eventos: filtered })
    }
    result.sort((a, b) => {
      const aDate = a.eventos.reduce((max, e) => { const d = e.invoice?.fecha_factura || ''; return d > max ? d : max }, '')
      const bDate = b.eventos.reduce((max, e) => { const d = e.invoice?.fecha_factura || ''; return d > max ? d : max }, '')
      if (!aDate && !bDate) return 0
      if (!aDate) return 1
      if (!bDate) return -1
      return bDate.localeCompare(aDate)
    })
    return result
  }, [ppa, invMap, filtroEv, search, fechaDesde, fechaHasta])

  const totalFacturado = useMemo(() => {
    let total = 0
    for (const { row, eventos } of rows) {
      const poData = pos.find(p => p.spo_number === row.spo_number)
      if (!poData?.valor) continue
      for (const ev of eventos) {
        if (ev.invoice?.absorbed) continue
        total += poData.valor * ev.invoiceable_pct / 100
      }
    }
    return total
  }, [rows, pos])

  // Total SPOs per site across all PPA (for progress %)
  const ppaTotalBySite = useMemo(() => {
    const map = {}
    for (const row of ppa) {
      const key = row.customer_site_name || row.site_reference_id || '(Sin sitio)'
      map[key] = (map[key] || 0) + 1
    }
    return map
  }, [ppa])

  const rowsBySite = useMemo(() => {
    const siteMap = new Map()
    for (const item of rows) {
      const key = item.row.customer_site_name || item.row.site_reference_id || '(Sin sitio)'
      if (!siteMap.has(key)) siteMap.set(key, { siteName: key, items: [], siteTotal: 0, maxDate: '' })
      const site = siteMap.get(key)
      site.items.push(item)
      const poData = pos.find(p => p.spo_number === item.row.spo_number)
      for (const ev of item.eventos) {
        if (poData?.valor && !ev.invoice?.absorbed) site.siteTotal += poData.valor * ev.invoiceable_pct / 100
        const d = ev.invoice?.fecha_factura || ''
        if (d > site.maxDate) site.maxDate = d
      }
    }
    return [...siteMap.values()].map(site => {
      const total = ppaTotalBySite[site.siteName] || site.items.length
      const pctFacturado = Math.round((site.items.length / total) * 100)
      // Group items by category
      const byCat = {}
      for (const item of site.items) {
        const cat = getSmpCat(item.row.smp_name)
        const k   = CAT_ORDER.includes(cat.key) ? cat.key : 'other'
        if (!byCat[k]) byCat[k] = []
        byCat[k].push(item)
      }
      const catGroups = CAT_ORDER.filter(k => byCat[k]).map(k => ({ cat: CAT_MAP[k], items: byCat[k] }))
      return { ...site, pctFacturado, catGroups }
    })
  }, [rows, pos, ppaTotalBySite])

  function toggleSite(name) {
    setExpandedSites(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const fmtCOP = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  async function handleEliminar(inv) {
    if (!window.confirm('¿Eliminar este registro de factura?')) return
    try { await eliminarFactura(inv.id); showToast('Registro eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  const PAGE_SIZE = 100
  const sentinelRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [rows])

  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisibleCount(n => Math.min(n + PAGE_SIZE, rows.length))
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [rows.length])

  const visibleRows   = rows.slice(0, visibleCount)
  const visibleSites  = hideCompletos ? rowsBySite.filter(s => s.pctFacturado < 100) : rowsBySite

  if (loading)     return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>Cargando datos…</div>
  if (!ppa.length) return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>Sin datos. Carga el PPA Nokia desde el Dashboard.</div>

  return (
    <>
      {editInv && <EditFacturaModal inv={editInv} onClose={() => setEditInv(null)} onSave={registrarFactura} />}
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Facturado
            {totalFacturado > 0 && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '3px 11px' }}>{fmtCOP(totalFacturado)}</span>}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#4b5563' }}>{rows.length} SPO{rows.length !== 1 ? 's' : ''} con facturas registradas</span>
            <button
              onClick={() => setHideCompletos(h => !h)}
              style={{
                fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 6, padding: '3px 9px',
                background: hideCompletos ? '#fef3c7' : '#dcfce7',
                color:      hideCompletos ? '#92400e' : '#166534',
                border:     `1px solid ${hideCompletos ? '#fcd34d' : '#86efac'}`,
              }}
            >
              {hideCompletos ? '◡ Mostrar 100% Facturados' : '👁 Ocultar 100% Facturados'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="fc" placeholder="Buscar sitio, SPO, factura…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 200 }} />
          <select className="fc" value={filtroEv} onChange={e => setFiltroEv(e.target.value)} style={{ fontSize: 11 }}>
            {EV_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <div style={{ width: 1, height: 24, background: '#e0e4e0', flexShrink: 0 }} />
          <input type="date" className="fc" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde" style={{ fontSize: 11, width: 130 }} />
          <span style={{ fontSize: 10, color: '#9ca89c' }}>–</span>
          <input type="date" className="fc" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta" style={{ fontSize: 11, width: 130 }} />
          {(fechaDesde || fechaHasta) && (
            <button onClick={() => { setFechaDesde(''); setFechaHasta('') }} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>✕</button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#617561', fontSize: 13 }}>Sin facturas registradas con los filtros actuales.</div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 860 }}>
            <thead>
              <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                {['Sitio / SMP ID', 'MS/SMP Name', 'Desempeño', 'SPO', 'Evento', 'N° Factura', 'Fecha', 'Valor', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#92400e', fontSize: 11, letterSpacing: .5, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#fffbeb', borderBottom: '1px solid #fcd34d', zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleSites.map(({ siteName, items, siteTotal, maxDate, pctFacturado, catGroups }) => {
                const isExpanded = expandedSites.has(siteName)
                return (
                  <>
                    <tr
                      key={`site-${siteName}`}
                      onClick={() => toggleSite(siteName)}
                      style={{ cursor: 'pointer', background: '#f8faf8', borderTop: '2px solid #e0e4e0' }}
                    >
                      <td colSpan={9} style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: '#617561', fontWeight: 700 }}>{isExpanded ? '▼' : '▶'}</span>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{siteName}</span>
                          <span style={{ fontSize: 9, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>
                            {items.length} SPO{items.length !== 1 ? 's' : ''}
                          </span>
                          <MiniBar pct={pctFacturado} />
                          {siteTotal > 0 && (
                            <span style={{ fontSize: 10, color: '#166534', fontWeight: 700 }}>{fmtCOP(siteTotal)}</span>
                          )}
                          {maxDate && (
                            <span style={{ fontSize: 9, color: '#9ca3af' }}>última: {maxDate}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && catGroups.map(({ cat, items: catItems }, gi) => (
                      <>
                        <tr key={`cat-${siteName}-${cat.key}`}>
                          <td colSpan={9} style={{ padding: '4px 10px 3px 24px', background: `${cat.color}08`, borderTop: gi === 0 ? '1px solid #e8eae8' : '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', color: cat.color }}>{cat.label}</span>
                            </div>
                          </td>
                        </tr>
                        {catItems.map(({ row, eventos }) =>
                          eventos.map((ev, i) => {
                            const poData = pos.find(p => p.spo_number === row.spo_number)
                            const valor  = poData?.valor ? poData.valor * ev.invoiceable_pct / 100 : null
                            return (
                              <tr key={`${row.spo_number}|${ev.key}`} style={{ borderTop: '1px solid #f0f0f0', background: '#fff' }}>
                                {i === 0 && (
                                  <>
                                    <td style={{ padding: '7px 10px 7px 28px', fontFamily: 'monospace', fontSize: 10, color: '#555', borderLeft: `3px solid ${cat.color}` }} rowSpan={eventos.length}>{row.smp_id}</td>
                                    <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.smp_name === 'Process_Implementation' ? row.ms_name : row.smp_name}</td>
                                    <td style={{ padding: '7px 10px' }} rowSpan={eventos.length}><DesempenoBadge val={row.desempeno} /></td>
                                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10 }} rowSpan={eventos.length}>{row.spo_number}</td>
                                  </>
                                )}
                                <td style={{ padding: '7px 10px' }}><EventoBadge color={ev.color} label={ev.label} pct={ev.pct} invoicedPct={ev.invoiceable_pct} absorbed={ev.invoice?.absorbed} /></td>
                                <td style={{ padding: '7px 10px' }}><NumFactura numero={ev.invoice.numero_factura} observaciones={ev.invoice.observaciones} /></td>
                                <td style={{ padding: '7px 10px', color: '#555' }}>{ev.invoice.fecha_factura || '—'}</td>
                                <td style={{ padding: '7px 10px', color: '#555', fontSize: 10 }}>{valor ? fmtCOP(valor) : <span style={{ color: '#d4d4d8' }}>—</span>}</td>
                                <td style={{ padding: '7px 10px', display: 'flex', gap: 6 }}>
                                  {!isViewer && !ev.invoice?.absorbed && <button onClick={() => setEditInv(ev.invoice)} style={{ fontSize: 10, color: '#144E4A', background: 'none', border: '1px solid #a7c4c2', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Editar</button>}
                                  {!isViewer && <button onClick={() => handleEliminar(ev.invoice)} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Quitar</button>}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </>
                    ))}
                  </>
                )
              })}
              <tr><td ref={sentinelRef} colSpan={9} style={{ padding: 0, height: 1 }} /></tr>
            </tbody>
          </table>
          {visibleCount < rows.length && (
            <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 10, color: '#9ca89c' }}>
              Mostrando {visibleCount} de {rows.length} — desplázate para cargar más
            </div>
          )}
        </div>
      )}
    </>
  )
}
