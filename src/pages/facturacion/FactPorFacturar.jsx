import { useState, useMemo, useRef, useEffect } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS, getSmpCat, SMP_CATS } from '../../store/useFactStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { descargarPlantillaFacturas, parsearExcelFacturas } from '../../lib/factImport'
import { parsearRollout, saveRolloutData, loadRolloutData, clearRolloutData, exportarSolicitudLib } from '../../lib/rolloutImport'

const EMPTY_FORM  = { numero_factura: '', fecha_factura: '', observaciones: '' }

const EV_DATE_COL = {
  acuerdo:  'acuerdo_ss_date',
  tss_1:    'ss_tssr_enviado_ppa_date',
  tss_2:    'ss_tssr_aprob_cliente_ppa_date',
  cw_1:     'execute_cw_ppa_date',
  cw_2:     'doc_final_ok_ppa_date',
  servicio: 'servicio_ejecutado_ppa_date',
}
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
  const absorbido = ev.status === 'absorbido'
  const parcial   = ev.invoiceable_pct > 0 && ev.invoiceable_pct < ev.pct

  if (absorbido) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3f4f6', border: '1px solid #d1d5db', color: '#9ca3af', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: .4, textDecoration: 'line-through' }}>
        {ev.label} · {ev.pct}%
      </span>
    )
  }
  if (parcial) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${ev.color}18`, border: `1px solid ${ev.color}40`, color: ev.color, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: .4 }}>
        {ev.label} · <span style={{ textDecoration: 'line-through', opacity: .5 }}>{ev.pct}%</span> → {ev.invoiceable_pct}%
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${ev.color}18`, border: `1px solid ${ev.color}40`, color: ev.color, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: .4 }}>
      {ev.label} · {ev.pct}%
    </span>
  )
}

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

function MissingBadge({ missing }) {
  return (
    <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {missing}
    </span>
  )
}

function HitoBadge({ ssDate, status }) {
  if (status === 'facturado') return (
    <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      FACTURADO
    </span>
  )
  if (ssDate && status === 'pendiente') return (
    <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {ssDate}
    </span>
  )
  return <span style={{ color: '#d4d4d8', fontSize: 10 }}>—</span>
}

function HitoBar({ label, pct, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 72 }}>
      <div style={{ fontSize: 8, color: '#6b7280', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 3, height: 5 }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, height: 5 }} />
        </div>
        <span style={{ fontSize: 8, color: '#6b7280', minWidth: 24, textAlign: 'right' }}>{pct}%</span>
      </div>
    </div>
  )
}

function FacturarModal({ row, ev, pos, invoices, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const poData = pos.find(p => p.spo_number === row.spo_number)

  const conflicto = useMemo(() => {
    const num = form.numero_factura.trim()
    if (!num) return null
    const matches = invoices.filter(inv => inv.numero_factura === num)
    const otraPO  = matches.find(inv => inv.spo_number !== row.spo_number)
    const mismaPO = matches.find(inv => inv.spo_number === row.spo_number)
    if (otraPO)  return { tipo: 'otra_po',  spo: otraPO.spo_number }
    if (mismaPO) return { tipo: 'misma_po', evento: mismaPO.evento }
    return null
  }, [form.numero_factura, invoices, row.spo_number])

  async function handleSave() {
    if (!form.numero_factura.trim()) { showToast('Ingresa el número de factura', 'err'); return }
    if (conflicto?.tipo === 'otra_po') return
    setSaving(true)
    try {
      await onSave({ spo_number: row.spo_number, evento: ev.key, pct: ev.invoiceable_pct ?? ev.pct, numero_factura: form.numero_factura.trim(), fecha_factura: form.fecha_factura || null, observaciones: form.observaciones || null })
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
              <span style={{ fontWeight: 700 }}>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(poData.valor * (ev.invoiceable_pct ?? ev.pct) / 100)}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fg">
            <label className="fl">Número de Factura *</label>
            <input className="fc" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FE-001-2025" />
            {conflicto?.tipo === 'misma_po' && (
              <div style={{ marginTop: 5, fontSize: 10, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '5px 9px' }}>
                ⚠ Este número ya se usó en esta PO (evento {conflicto.evento}). Puede continuar si corresponde a un doble porcentaje liberado.
              </div>
            )}
            {conflicto?.tipo === 'otra_po' && (
              <div style={{ marginTop: 5, fontSize: 10, color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 9px' }}>
                ✕ Este número ya existe en la PO {conflicto.spo}. No es posible usar la misma factura en dos POs distintas.
              </div>
            )}
          </div>
          <div className="fg"><label className="fl">Fecha de Factura</label><input type="date" className="fc" value={form.fecha_factura} onChange={e => setForm(f => ({ ...f, fecha_factura: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Observaciones</label><input className="fc" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || conflicto?.tipo === 'otra_po'} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: conflicto?.tipo === 'otra_po' ? '#d1d5db' : '#144E4A', color: '#fff', cursor: conflicto?.tipo === 'otra_po' ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
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
  const loading          = useFactStore(s => s.loading)
  const registrarFactura = useFactStore(s => s.registrarFactura)
  const importarFacturas = useFactStore(s => s.importarFacturas)

  const isViewer = useAuthStore(s => s.user?.role === 'viewer')

  const [search,    setSearch]    = useState('')
  const [filtroEv,  setFiltroEv]  = useState('todos')
  const [modal,     setModal]     = useState(null)
  const [importing,  setImporting]  = useState(false)
  const importRef = useRef(null)

  const _savedRollout               = useMemo(() => loadRolloutData(), [])
  const [rolloutItems, setRolloutItems] = useState(() => _savedRollout?.items || null)
  const [rolloutTs,    setRolloutTs]    = useState(() => _savedRollout?.ts    || null)
  const [expandedSites, setExpandedSites] = useState(new Set())
  const rolloutRef = useRef(null)

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const rolloutMap = useMemo(() => {
    if (!rolloutItems) return new Map()
    return new Map(rolloutItems.map(r => [r.smpId.toUpperCase(), r]))
  }, [rolloutItems])

  async function handleRolloutUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const items = await parsearRollout(file)
      saveRolloutData(items)
      setRolloutItems(items)
      setRolloutTs(Date.now())
      showToast(`Rollout cargado: ${items.length} SMPs`)
    } catch (err) {
      showToast('Error al leer Rollout: ' + err.message, 'err')
    } finally { e.target.value = '' }
  }

  function handleClearRollout() {
    clearRolloutData()
    setRolloutItems(null)
    setRolloutTs(null)
    setExpandedSites(new Set())
  }

  async function handleExportSolicitud() {
    if (!pendienteLibBySmp.length) return
    try { await exportarSolicitudLib(pendienteLibBySmp) }
    catch (err) { showToast('Error al exportar: ' + err.message, 'err') }
  }

  function toggleSite(siteName) {
    setExpandedSites(prev => {
      const next = new Set(prev)
      if (next.has(siteName)) next.delete(siteName)
      else next.add(siteName)
      return next
    })
  }

  async function handleCerrarAbsorbido(row, ev) {
    if (!window.confirm(`¿Cerrar "${ev.label}" del SPO ${row.spo_number} como Facturado por Acuerdo?\nNo se registrará número de factura propio.`)) return
    try {
      await registrarFactura({ spo_number: row.spo_number, evento: ev.key, pct: ev.pct, numero_factura: null, absorbed: true })
      showToast('Registrado como Facturado por Acuerdo')
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

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

  // Lista principal: tienen GR + % → pueden facturarse ahora (incluye absorbidos para registro visual)
  const rows = useMemo(() => {
    const result = []
    for (const row of ppa) {
      if (!row.sgr) continue
      const cat     = getSmpCat(row.smp_name)
      const allEvs  = getEventosRow(row, invMap)
      const eventos = allEvs.filter(e => e.status === 'facturar' || e.status === 'absorbido')
      if (!eventos.length) continue
      const filtered = applyEvFilter(eventos, row, filtroEv)
      if (!filtered.length) continue
      if (search && !`${row.customer_site_name} ${row.spo_number} ${row.smp_id} ${row.ms_name} ${row.smp_name}`.toLowerCase().includes(search.toLowerCase())) continue
      result.push({ row, eventos: filtered, cat })
    }
    result.sort((a, b) => {
      const getMin = ({ row, eventos }) => eventos.reduce((min, ev) => {
        const d = row[EV_DATE_COL[ev.key]] || ''
        return (!min || (d && d < min)) ? d : min
      }, '')
      const aDate = getMin(a), bDate = getMin(b)
      if (!aDate && !bDate) return 0
      if (!aDate) return 1
      if (!bDate) return -1
      return aDate.localeCompare(bDate)
    })
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

  // Split libRows per hito using ms_name: each PO goes to pendienteLib only if ITS specific hito is SS-certified
  const { pendienteLib, noCompletados } = useMemo(() => {
    const pendienteLib  = []
    const noCompletados = []
    for (const item of libRows) {
      const r = rolloutMap.get((item.row.smp_id || '').toUpperCase())
      if (!r) { noCompletados.push({ ...item, rollout: null }); continue }
      const ms = item.row.ms_name
      const hitoSS = ms === 'SS MOS ok'             ? r.mosSS
                   : ms === 'SS Integracion ok'      ? r.intgSS
                   : ms === 'SS Aceptacion final ok' ? r.acepSS
                   : null
      if (hitoSS) {
        pendienteLib.push({ ...item, rollout: r })
      } else {
        noCompletados.push({ ...item, rollout: r })
      }
    }
    return { pendienteLib, noCompletados }
  }, [libRows, rolloutMap])

  // Build one row per SMP with hito status for display and export
  const pendienteLibBySmp = useMemo(() => {
    const rowsSpoSet = new Set(rows.map(r => r.row.spo_number))
    const libSpoSet  = new Set(libRows.map(r => r.row.spo_number))

    function hitoStatus(smpId, msName) {
      const r = ppa.find(p => p.smp_id === smpId && p.ms_name === msName)
      if (!r) return null
      if (libSpoSet.has(r.spo_number))  return 'pendiente'
      if (rowsSpoSet.has(r.spo_number)) return 'por_facturar'
      if (r.sgr) {
        const evs = getEventosRow(r, invMap)
        if (evs.length > 0 && evs.every(e => e.status === 'facturado')) return 'facturado'
      }
      return null
    }

    // Take first libRow per smp_id for display data
    const seen = new Map()
    for (const item of pendienteLib) {
      if (!seen.has(item.row.smp_id)) seen.set(item.row.smp_id, item)
    }

    const result = []
    for (const [smpId, item] of seen) {
      const { rollout } = item
      const hitoMOS  = { ssDate: rollout.mosSS,  status: hitoStatus(smpId, 'SS MOS ok') }
      const hitoIntg = { ssDate: rollout.intgSS, status: hitoStatus(smpId, 'SS Integracion ok') }
      const hitoAcep = { ssDate: rollout.acepSS, status: hitoStatus(smpId, 'SS Aceptacion final ok') }

      const hasReleasable = (hitoMOS.ssDate  && hitoMOS.status  === 'pendiente')
                         || (hitoIntg.ssDate && hitoIntg.status === 'pendiente')
                         || (hitoAcep.ssDate && hitoAcep.status === 'pendiente')
      if (!hasReleasable) continue

      result.push({ ...item, hitoMOS, hitoIntg, hitoAcep })
    }
    return result
  }, [pendienteLib, rows, libRows, ppa, invMap])

  // Group noCompletados by site, dedup SMPs within each site, sort by total progress % DESC
  const noCompletadosBySite = useMemo(() => {
    const siteMap = new Map()
    for (const item of noCompletados) {
      const key = item.row.customer_site_name || item.row.site_reference_id || item.row.smp_id
      if (!siteMap.has(key)) siteMap.set(key, [])
      siteMap.get(key).push(item)
    }
    const sites = [...siteMap.entries()].map(([siteName, items]) => {
      const smps = [...new Map(items.map(i => [i.row.smp_id, i])).values()]
      const withData = smps.filter(s => s.rollout)
      const totalPct = withData.length
        ? Math.round(withData.reduce((sum, s) => {
            const { mosPct, intgPct, acepPct } = s.rollout
            return sum + (mosPct * 12 + intgPct * 19 + acepPct * 11) / 42
          }, 0) / withData.length)
        : 0
      return { siteName, smps, totalPct }
    })
    sites.sort((a, b) => b.totalPct - a.totalPct)
    return sites
  }, [noCompletados])

  const PAGE_SIZE = 50
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

  const visibleRows = rows.slice(0, visibleCount)

  const totalPorFacturar = useMemo(() => {
    let total = 0
    for (const { row, eventos } of allPendingRows) {
      const poData = pos.find(p => p.spo_number === row.spo_number)
      if (!poData?.valor) continue
      for (const ev of eventos) total += poData.valor * (ev.invoiceable_pct ?? ev.pct) / 100
    }
    return total
  }, [allPendingRows, pos])

  const fmtCOP = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

  if (loading)     return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>Cargando datos…</div>
  if (!ppa.length) return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>Sin datos. Carga el PPA Nokia desde el Dashboard.</div>

  return (
    <>
      {modal && <FacturarModal row={modal.row} ev={modal.ev} pos={pos} invoices={invoices} onClose={() => setModal(null)} onSave={registrarFactura} />}

      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Por Facturar
            {rows.length > 0    && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '3px 11px' }}>{rows.length}</span>}
            {libRows.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '3px 11px' }}>{libRows.length} lib.</span>}
            {totalPorFacturar > 0 && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '3px 11px' }}>{fmtCOP(totalPorFacturar)}</span>}
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
          {!isViewer && <>
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              style={{ fontSize: 11, color: '#fff', background: '#144E4A', border: 'none', borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .4 }}
            >
              {importing ? '⏳ Importando…' : '↑ Importar facturas'}
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportar} />
          </>}
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
                <TH>Sitio</TH><TH>SMP ID</TH><TH>MS/SMP Name</TH><TH>Desempeño</TH><TH>SPO</TH><TH>Categoría</TH><TH>Evento</TH><TH>Valor PO</TH><TH></TH>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ row, eventos, cat }) =>
                eventos.map((ev, i) => {
                  const poData     = pos.find(p => p.spo_number === row.spo_number)
                  const absorbido  = ev.status === 'absorbido'
                  const invPct     = ev.invoiceable_pct ?? ev.pct
                  return (
                    <tr key={`${row.spo_number}|${ev.key}`} style={{ borderTop: '1px solid #f0f0f0', background: absorbido ? '#fafafa' : undefined, opacity: absorbido ? .75 : 1 }}>
                      {i === 0 && (
                        <>
                          <td style={{ padding: '7px 10px', fontWeight: 600 }} rowSpan={eventos.length}>{row.customer_site_name || row.site_reference_id}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.smp_id}</td>
                          <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }} rowSpan={eventos.length}>{row.smp_name === 'Process_Implementation' ? row.ms_name : row.smp_name}</td>
                          <td style={{ padding: '7px 10px' }} rowSpan={eventos.length}><DesempenoBadge val={row.desempeno} /></td>
                          <td style={{ padding: '7px 10px' }} rowSpan={eventos.length}><SpoCell spo={row.spo_number} pos={pos} /></td>
                          <td style={{ padding: '7px 10px' }} rowSpan={eventos.length}>
                            <span style={{ background: `${cat.color}15`, color: cat.color, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>{cat.label}</span>
                          </td>
                        </>
                      )}
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <EventoBadge ev={ev} />
                          {absorbido && (
                            <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', whiteSpace: 'nowrap' }}>
                              Facturado por Acuerdo
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: 10, color: absorbido ? '#9ca3af' : '#555' }}>
                        {poData?.valor
                          ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(poData.valor * invPct / 100)
                          : <span style={{ color: '#d4d4d8' }}>Sin PO</span>}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        {!isViewer && !absorbido && (
                          <button onClick={() => setModal({ row, ev })} style={{ background: '#144E4A', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Facturar</button>
                        )}
                        {!isViewer && absorbido && (
                          <button onClick={() => handleCerrarAbsorbido(row, ev)} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Cerrar sin factura</button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
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

      {/* ── Rollout + Pendiente Liberación + No Completados ─────── */}
      {libRows.length > 0 && (
        <>
          {/* ── Widget de carga Rollout Details ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => rolloutRef.current?.click()}
              style={{ fontSize: 11, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {rolloutItems ? '↺ Actualizar Rollout' : '↑ Cargar Rollout Details'}
            </button>
            <input ref={rolloutRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleRolloutUpload} />
            {rolloutItems ? (
              <>
                <span style={{ fontSize: 10, color: '#6b7280' }}>
                  {rolloutItems.length} SMPs · {new Date(rolloutTs).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={handleClearRollout}
                  style={{ fontSize: 10, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}
                >
                  ✕ Limpiar
                </button>
              </>
            ) : (
              <span style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
                Carga el Rollout Details para separar SMPs certificados por Nokia
              </span>
            )}
          </div>

          {/* ── Pendiente Liberación (certificados Nokia, no liberados en PPA) ── */}
          {pendienteLibBySmp.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#166534' }}>
                  Pendiente Liberación
                </div>
                <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                  {pendienteLibBySmp.length}
                </span>
                <div style={{ fontSize: 11, color: '#4b5563' }}>— SMPs con SS Nokia certificada, pendientes de liberación en PPA</div>
                <button
                  onClick={handleExportSolicitud}
                  style={{ fontSize: 11, color: '#166534', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 'auto' }}
                >
                  ↓ Solicitar Liberación
                </button>
              </div>
              <div className="card" style={{ overflow: 'auto', maxHeight: '40vh', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 780 }}>
                  <thead>
                    <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #86efac' }}>
                      <TH>Sitio</TH><TH>SMP ID</TH><TH>Desempeño</TH><TH>SPO</TH><TH>Categoría</TH>
                      <TH>SS MOS ok</TH><TH>SS Integración ok</TH><TH>SS Aceptación Final ok</TH><TH>Falta</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {pendienteLibBySmp.map(({ row, cat, missing, hitoMOS, hitoIntg, hitoAcep }) => (
                      <tr key={row.smp_id} style={{ borderTop: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{row.customer_site_name || row.site_reference_id}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{row.smp_id}</td>
                        <td style={{ padding: '7px 10px' }}><DesempenoBadge val={row.desempeno} /></td>
                        <td style={{ padding: '7px 10px' }}><SpoCell spo={row.spo_number} pos={pos} /></td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ background: `${cat.color}15`, color: cat.color, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>{cat.label}</span>
                        </td>
                        <td style={{ padding: '7px 10px' }}><HitoBadge ssDate={hitoMOS.ssDate}  status={hitoMOS.status}  /></td>
                        <td style={{ padding: '7px 10px' }}><HitoBadge ssDate={hitoIntg.ssDate} status={hitoIntg.status} /></td>
                        <td style={{ padding: '7px 10px' }}><HitoBadge ssDate={hitoAcep.ssDate} status={hitoAcep.status} /></td>
                        <td style={{ padding: '7px 10px' }}><MissingBadge missing={missing} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── No Completados (sin SS Nokia, agrupados por sitio) ── */}
          {noCompletadosBySite.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#92400e' }}>
                  No Completados
                </div>
                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                  {noCompletados.length}
                </span>
                <div style={{ fontSize: 11, color: '#4b5563' }}>— SPOs bloqueados por falta de GR y/o %{rolloutItems ? '' : ' · carga Rollout para ver progreso'}</div>
              </div>
              <div className="card" style={{ overflow: 'auto', maxHeight: '55vh' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 780 }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fcd34d' }}>
                      <TH>Sitio / SMP ID</TH><TH>MS/SMP Name</TH><TH>Desempeño</TH><TH>SPO</TH><TH>Falta</TH><TH>Progreso Rollout</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {noCompletadosBySite.map(({ siteName, smps, totalPct }) => {
                      const isExpanded = expandedSites.has(siteName)
                      return (
                        <>
                          <tr
                            key={`site-${siteName}`}
                            onClick={() => toggleSite(siteName)}
                            style={{ cursor: 'pointer', background: '#fffbeb', borderTop: '2px solid #fde68a' }}
                          >
                            <td colSpan={6} style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, color: '#92400e', fontWeight: 700 }}>{isExpanded ? '▼' : '▶'}</span>
                                <span style={{ fontWeight: 700, fontSize: 12 }}>{siteName}</span>
                                <span style={{ fontSize: 9, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>
                                  {smps.length} SMP{smps.length !== 1 ? 's' : ''}
                                </span>
                                {rolloutItems && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 80, background: '#e5e7eb', borderRadius: 3, height: 5 }}>
                                      <div style={{ width: `${Math.min(totalPct, 100)}%`, background: '#f59e0b', borderRadius: 3, height: 5 }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#92400e', fontWeight: 700 }}>{totalPct}%</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && smps.map(({ row, missing, rollout }) => (
                            <tr key={`smp-${row.spo_number}`} style={{ borderTop: '1px solid #fef9ee', background: '#fefdf9' }}>
                              <td style={{ padding: '6px 10px 6px 26px', fontFamily: 'monospace', fontSize: 9, color: '#555' }}>{row.smp_id}</td>
                              <td style={{ padding: '6px 10px', fontSize: 10, color: '#555' }}>
                                {row.smp_name === 'Process_Implementation' ? row.ms_name : row.smp_name}
                              </td>
                              <td style={{ padding: '6px 10px' }}><DesempenoBadge val={row.desempeno} /></td>
                              <td style={{ padding: '6px 10px' }}><SpoCell spo={row.spo_number} pos={pos} /></td>
                              <td style={{ padding: '6px 10px' }}><MissingBadge missing={missing} /></td>
                              <td style={{ padding: '6px 10px' }}>
                                {rollout ? (
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <HitoBar label="MOS" pct={rollout.mosPct} color="#144E4A" />
                                    {rollout.mosSS && <HitoBar label="Integración" pct={rollout.intgPct} color="#0369a1" />}
                                    {rollout.intgSS && <HitoBar label="Acept. Final" pct={rollout.acepPct} color="#7c3aed" />}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic' }}>Sin datos Rollout</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
