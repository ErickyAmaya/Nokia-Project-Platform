import { useState, useMemo, useRef, useEffect } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS, getSmpCat, SMP_CATS } from '../../store/useFactStore'
import { useAckStore }  from '../../store/useAckStore'
import { useAuthStore } from '../../store/authStore'
import { supabase }     from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { descargarPlantillaFacturas, parsearExcelFacturas } from '../../lib/factImport'
import { parsearRollout, saveRolloutData, loadRolloutData, exportarSolicitudLib, saveRolloutToSupabase, loadRolloutFromSupabase } from '../../lib/rolloutImport'

const EMPTY_FORM  = { numero_factura: '', fecha_factura: '', observaciones: '' }
const SIBLING_KEY = { cw_1: 'cw_2', cw_2: 'cw_1', tss_1: 'tss_2', tss_2: 'tss_1' }

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

const TH = ({ children, style }) => (
  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#92400e', fontSize: 11, letterSpacing: .5, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#fffbeb', borderBottom: '1px solid #fcd34d', zIndex: 1, ...style }}>
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

function MissingBadge({ missing, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => onClick && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? '#fee2e2' : '#fffbeb',
        color:        hovered ? '#991b1b' : '#92400e',
        border:       hovered ? '1px solid #fca5a5' : '1px solid #fcd34d',
        borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px',
        whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
        transition: 'all .15s',
      }}
    >
      {hovered ? 'Registrar Factura' : missing}
    </span>
  )
}

function HitoBadge({ ssDate, status }) {
  if (status === 'facturado') return (
    <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
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

function HitoBar({ label, pct, color, status, onClick }) {
  const [hovered, setHovered] = useState(false)
  if (status === 'done') return (
    <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      ✓ {label}
    </span>
  )
  if (status === 'ready') return (
    <span
      onClick={onClick}
      onMouseEnter={() => onClick && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#fee2e2' : '#fffbeb',
        color:      hovered ? '#991b1b' : '#92400e',
        border:     hovered ? '1px solid #fca5a5' : '1px solid #fcd34d',
        borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px',
        whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default',
        transition: 'all .15s',
      }}
    >
      {hovered ? 'Registrar Factura' : `● ${label}`}
    </span>
  )
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

function FacturarModal({ row, ev, siblingEv, pos, invoices, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const poData = pos.find(p => p.spo_number === row.spo_number)

  const conflicto = useMemo(() => {
    const num = form.numero_factura.trim()
    if (!num) return null
    const matches = invoices.filter(inv => inv.numero_factura === num)
    const otraPO  = matches.find(inv => inv.spo_number !== row.spo_number)
    if (otraPO)  return { tipo: 'otra_po',  spo: otraPO.spo_number }
    return null
  }, [form.numero_factura, invoices, row.spo_number])

  async function handleSave() {
    if (!form.numero_factura.trim()) { showToast('Ingresa el número de factura', 'err'); return }
    if (conflicto?.tipo === 'otra_po') return
    setSaving(true)
    try {
      const payload = { numero_factura: form.numero_factura.trim(), fecha_factura: form.fecha_factura || null, observaciones: form.observaciones || null }
      await onSave({ spo_number: row.spo_number, evento: ev.key, pct: ev.invoiceable_pct ?? ev.pct, ...payload })
      if (siblingEv) {
        await onSave({ spo_number: row.spo_number, evento: siblingEv.key, pct: siblingEv.invoiceable_pct ?? siblingEv.pct, ...payload })
      }
      showToast(siblingEv ? 'Factura registrada en ambos porcentajes' : 'Factura registrada')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Registrar Factura</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 18 }}>{row.customer_site_name} · SPO {row.spo_number}</div>
        <div style={{ background: '#f8faf8', borderRadius: 8, padding: '10px 14px', marginBottom: siblingEv ? 8 : 16, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>Evento</span><EventoBadge ev={ev} />
          </div>
          {siblingEv && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: '#555' }}>También se registrará</span><EventoBadge ev={siblingEv} />
            </div>
          )}
          {poData?.valor && (() => {
            const fmt = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(v)
            const totalPct = (ev.invoiceable_pct ?? ev.pct) + (siblingEv ? (siblingEv.invoiceable_pct ?? siblingEv.pct) : 0)
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: '#555' }}>Valor a facturar</span>
                  <span style={{ color: '#6b7280' }}>{fmt(poData.valor)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
                  <span style={{ color: '#555' }}>{`Valor a Facturar (${totalPct}%)`}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(poData.valor * totalPct / 100)}</span>
                </div>
              </>
            )
          })()}
        </div>
        {siblingEv && (
          <div style={{ fontSize: 10, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px', marginBottom: 16 }}>
            Ambos porcentajes están disponibles — se registrarán con la misma factura.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fg">
            <label className="fl">Número de Factura *</label>
            <input className="fc" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FE-001-2025" />
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

function AcuerdoEspecialModal({ row, onClose, onSave }) {
  const [form, setForm] = useState({ numero_factura: '', fecha_factura: '', observaciones: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.numero_factura.trim()) { showToast('Ingresa el número de factura', 'err'); return }
    setSaving(true)
    try {
      await onSave({
        spo_number:     row.spo_number,
        evento:         'servicio',
        pct:            100,
        numero_factura: form.numero_factura.trim(),
        fecha_factura:  form.fecha_factura || null,
        observaciones:  form.observaciones || null,
        absorbed:       true,
      })
      showToast('Acuerdo especial registrado')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Acuerdo Especial</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 6 }}>{row.customer_site_name} · SPO {row.spo_number}</div>
        <div style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', borderRadius: 6, padding: '6px 10px', marginBottom: 16 }}>
          {row.ms_name} · Facturado por acuerdo especial sin registro en PPA
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
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, opacity: saving ? .6 : 1 }}>
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
  const _rawPos          = useFactStore(s => s.pos)
  const pos              = useMemo(() => _rawPos.filter(p => !p.cancelled), [_rawPos])
  const cancelledSpos    = useMemo(() => new Set(_rawPos.filter(p => p.cancelled).map(p => p.spo_number)), [_rawPos])
  const loading          = useFactStore(s => s.loading)
  const registrarFactura = useFactStore(s => s.registrarFactura)
  const importarFacturas = useFactStore(s => s.importarFacturas)

  const sabana = useAckStore(s => s.sabana)

  const user       = useAuthStore(s => s.user)
  const isViewer   = user?.role === 'viewer'
  const canUploadRollout = ['admin', 'coordinador', 'facturacion'].includes(user?.role)

  // Glosario ACK — estados bloqueantes (cache en localStorage)
  const [ackGlosario, setAckGlosario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ack_glosario_v1') || 'null') } catch { return null }
  })
  useEffect(() => {
    supabase.from('ack_glosario').select('gap, area, se_puede_liberar')
      .eq('se_puede_liberar', false)
      .then(({ data }) => {
        if (data) {
          setAckGlosario(data)
          try { localStorage.setItem('ack_glosario_v1', JSON.stringify(data)) } catch {}
        }
      })
  }, [])

  const [search,    setSearch]    = useState('')
  const [filtroEv,  setFiltroEv]  = useState('todos')
  const [acuerdoModal, setAcuerdoModal] = useState(null)  // row para AcuerdoEspecialModal
  const [modal,     setModal]     = useState(null)
  const [importing,  setImporting]  = useState(false)
  const importRef = useRef(null)

  const _savedRollout               = useMemo(() => loadRolloutData(), [])
  const [rolloutItems, setRolloutItems] = useState(() => _savedRollout?.items || null)
  const [rolloutTs,    setRolloutTs]    = useState(() => _savedRollout?.ts    || null)
  const [rolloutLoading, setRolloutLoading] = useState(false)
  const rolloutRef = useRef(null)

  // Cargar Rollout desde Supabase al montar (fuente de verdad compartida)
  useEffect(() => {
    setRolloutLoading(true)
    loadRolloutFromSupabase()
      .then(data => {
        if (!data) return
        if (!rolloutTs || data.ts > rolloutTs) {
          setRolloutItems(data.items)
          setRolloutTs(data.ts)
          saveRolloutData(data.items)
        }
      })
      .catch(() => { showToast('No se pudo cargar el Rollout desde Supabase', 'err') })
      .finally(() => setRolloutLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const rolloutMap = useMemo(() => {
    if (!rolloutItems) return new Map()
    return new Map(rolloutItems.map(r => [r.smpId.toUpperCase(), r]))
  }, [rolloutItems])

  async function handleRolloutUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setRolloutLoading(true)
    try {
      const items = await parsearRollout(file)
      await saveRolloutToSupabase(items, user?.email)
      saveRolloutData(items)
      setRolloutItems(items)
      setRolloutTs(Date.now())
      showToast(`Rollout cargado: ${items.length} SMPs`)
    } catch (err) {
      showToast('Error al cargar Rollout: ' + err.message, 'err')
    } finally { e.target.value = ''; setRolloutLoading(false) }
  }

  async function handleExportSolicitud() {
    if (!pendienteLibBySmp.length) return
    try { await exportarSolicitudLib(pendienteLibBySmp) }
    catch (err) { showToast('Error al exportar: ' + err.message, 'err') }
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
      if (cancelledSpos.has(row.spo_number)) continue
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
      if (cancelledSpos.has(row.spo_number)) continue
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
      if (cancelledSpos.has(row.spo_number)) continue
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

  // Mapa ACK: smp_id → { gap_hw_cierre, gap_on_air }
  const ackMap = useMemo(() => new Map(sabana.map(r => [r.smp_id, r])), [sabana])

  // Sets de estados bloqueantes por área (desde glosario)
  const hwCierreBlocking = useMemo(() => new Set(
    (ackGlosario || []).filter(r => r.area === 'HW_Cierre').map(r => r.gap)
  ), [ackGlosario])
  const onAirBlocking = useMemo(() => new Set(
    (ackGlosario || []).filter(r => r.area === 'ONAIR').map(r => r.gap)
  ), [ackGlosario])

  // Split libRows per hito: pendienteLib / bloqueadoAck / noCompletados (solo impl)
  const { pendienteLib, bloqueadoAck, noCompletados } = useMemo(() => {
    const pendienteLib  = []
    const bloqueadoAck  = []
    const noCompletados = []
  const IMPL_MS = new Set(['SS MOS ok', 'SS Integracion ok', 'SS Aceptacion final ok', 'SS Instalacion ok'])

    for (const item of libRows) {
      if (item.cat.key !== 'impl') continue
      if (!IMPL_MS.has(item.row.ms_name)) continue  // solo hitos de implementación Nokia
      if (invMap[`${item.row.spo_number}|servicio`]) continue  // ya tiene factura registrada
      const r = rolloutMap.get((item.row.smp_id || '').toUpperCase())
      if (!r) { noCompletados.push({ ...item, rollout: null }); continue }
      const ms = item.row.ms_name
      const hitoSS = ms === 'SS MOS ok'             ? r.mosSS
                   : ms === 'SS Integracion ok'      ? r.intgSS
                   : ms === 'SS Aceptacion final ok' ? r.acepSS
                   : null
      if (!hitoSS) { noCompletados.push({ ...item, rollout: r }); continue }

      // Para Integración: verificar si ACK bloquea
      if (ms === 'SS Integracion ok' && ackGlosario) {
        const ack = ackMap.get(item.row.smp_id)
        const hwBlocked  = ack?.gap_hw_cierre && hwCierreBlocking.has(ack.gap_hw_cierre)
        const onBlocked  = ack?.gap_on_air    && onAirBlocking.has(ack.gap_on_air)
        if (hwBlocked || onBlocked) {
          bloqueadoAck.push({ ...item, rollout: r, ackEstado: {
            hw_cierre: ack?.gap_hw_cierre || null,
            on_air:    ack?.gap_on_air    || null,
            hwBlocked, onBlocked,
          }})
          continue
        }
      }
      pendienteLib.push({ ...item, rollout: r })
    }
    return { pendienteLib, bloqueadoAck, noCompletados }
  }, [libRows, rolloutMap, ackGlosario, ackMap, hwCierreBlocking, onAirBlocking])

  const rowsSpoSet  = useMemo(() => new Set(rows.map(r => r.row.spo_number)), [rows])
  const libSpoSet   = useMemo(() => new Set(libRows.map(r => r.row.spo_number)), [libRows])
  const ppaByHito   = useMemo(() => new Map(ppa.map(r => [`${r.smp_id}|${r.ms_name}`, r])), [ppa])

  // Returns 'done' (facturado o en Pendiente Liberación), 'ready' (facturable ahora), or null (en progreso)
  function getHitoBarStatus(smpId, msName, pct) {
    if (pct < 100) return null
    const r = ppaByHito.get(`${smpId}|${msName}`)
    if (!r) return 'ready'
    if (rowsSpoSet.has(r.spo_number)) return 'ready'  // tiene GR + % → facturable ahora
    if (libSpoSet.has(r.spo_number))  return 'done'   // en Pendiente Liberación → no mostrar badge aquí
    if (r.sgr) {
      const evs = getEventosRow(r, invMap)
      if (evs.length > 0 && evs.every(e => e.status === 'facturado')) return 'done'
    }
    return 'ready'
  }

  // Build one row per SMP with hito status for display and export
  const pendienteLibBySmp = useMemo(() => {
    function hitoStatus(smpId, msName) {
      const r = ppaByHito.get(`${smpId}|${msName}`)
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
  }, [pendienteLib, rowsSpoSet, libSpoSet, ppaByHito, invMap])

  // Flat sorted list of noCompletados — dedup by smp_id, sort by rollout progress % DESC
  const noCompletadosFlat = useMemo(() => {
    const deduped = [...new Map(noCompletados.map(i => [i.row.smp_id, i])).values()]
    return deduped.sort((a, b) => {
      const pct = s => s.rollout
        ? (s.rollout.mosPct * 12 + s.rollout.intgPct * 19 + s.rollout.acepPct * 11) / 42
        : 0
      return pct(b) - pct(a)
    })
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
  if (!ppa.length) return <EmptyState icon="📄" title="Sin datos de facturación" subtitle="Carga el PPA Nokia desde el Dashboard para comenzar." />

  return (
    <>
      {modal && <FacturarModal row={modal.row} ev={modal.ev} siblingEv={modal.siblingEv} pos={pos} invoices={invoices} onClose={() => setModal(null)} onSave={registrarFactura} />}
      {acuerdoModal && <AcuerdoEspecialModal row={acuerdoModal} onClose={() => setAcuerdoModal(null)} onSave={registrarFactura} />}

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 126px - env(safe-area-inset-top))' }}>
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            Por Facturar
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}>
          {canUploadRollout && (
            <>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => rolloutRef.current?.click()}
                  disabled={rolloutLoading}
                  style={{ fontSize: 11, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '6px 13px', cursor: rolloutLoading ? 'default' : 'pointer', fontWeight: 600, whiteSpace: 'nowrap', opacity: rolloutLoading ? .6 : 1 }}
                >
                  {rolloutLoading ? '⏳ Cargando…' : rolloutItems ? '↺ Actualizar Rollout' : '↑ Cargar Rollout Details'}
                </button>
                {rolloutItems && (
                  <span style={{ position: 'absolute', top: '100%', left: 0, fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {rolloutItems.length} SMPs · {new Date(rolloutTs).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <input ref={rolloutRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleRolloutUpload} />
              <div style={{ width: 1, height: 24, background: '#e0e4e0', flexShrink: 0 }} />
            </>
          )}
          <input className="fc" placeholder="Buscar sitio, SPO, SMP…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 'auto', minWidth: 180 }} />
          <select className="fc" value={filtroEv} onChange={e => setFiltroEv(e.target.value)} style={{ fontSize: 11, width: 'auto' }}>
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

      <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* ── Lista principal: Pendiente por facturar ───────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#166534' }}>Facturar</div>
        {rows.length > 0 && <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>{rows.length}</span>}
        {totalPorFacturar > 0 && <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>{fmtCOP(totalPorFacturar)}</span>}
        <span style={{ fontSize: 11, color: '#4b5563' }}>— {rows.length} SPO{rows.length !== 1 ? 's' : ''} facturables</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: '#22c55e', fontSize: 14, fontWeight: 600 }}>
          ✓ No hay SPOs facturables pendientes
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '55vh', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 760 }}>
            <thead>
              <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                <TH>Sitio</TH><TH>SMP ID</TH><TH>MS/SMP Name</TH><TH>Desempeño</TH><TH>SPO</TH><TH>Categoría</TH><TH>Evento</TH><TH>Valor a facturar</TH><TH></TH>
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
                            <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', whiteSpace: 'nowrap' }}>
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
                          <button onClick={() => {
                            const siblingKey = SIBLING_KEY[ev.key]
                            const siblingEv  = siblingKey
                              ? getEventosRow(row, invMap).find(e => e.key === siblingKey && e.status === 'facturar')
                              : null
                            setModal({ row, ev, siblingEv: siblingEv || null })
                          }} style={{ background: '#144E4A', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Facturar</button>
                        )}
                        {!isViewer && absorbido && (
                          <button onClick={() => handleCerrarAbsorbido(row, ev)} style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Cerrar sin factura</button>
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

          {/* ── Pendiente Liberación (certificados Nokia, no liberados en PPA) ── */}
          {pendienteLibBySmp.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#166534' }}>
                  Pendiente Liberación (PPA)
                </div>
                <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                  {pendienteLibBySmp.length}
                </span>
                {(() => {
                  const total = pendienteLibBySmp.reduce((s, { row, hitoMOS, hitoIntg, hitoAcep }) => {
                    const smpId = row.smp_id
                    let rowTotal = 0
                    for (const [msName, hito] of [
                      ['SS MOS ok', hitoMOS],
                      ['SS Integracion ok', hitoIntg],
                      ['SS Aceptacion final ok', hitoAcep],
                    ]) {
                      if (!hito.ssDate || hito.status !== 'pendiente') continue
                      const ppaRow = ppaByHito.get(`${smpId}|${msName}`)
                      if (!ppaRow) continue
                      const hitoPoData = pos.find(p => p.spo_number === ppaRow.spo_number)
                      if (!hitoPoData?.valor) continue
                      const evs = getEventosRow(ppaRow, invMap)
                      let pctRow = evs.reduce((a, e) => a + (e.invoiceable_pct ?? e.pct ?? 0), 0)
                      if (pctRow === 0) {
                        const invoicedPct = EVENTOS.reduce((a, e) => a + (invMap[`${ppaRow.spo_number}|${e.key}`]?.pct || 0), 0)
                        pctRow = Math.max(0, 100 - invoicedPct - (ppaRow.acuerdo_liberacion || 0))
                      }
                      rowTotal += hitoPoData.valor * pctRow / 100
                    }
                    return s + rowTotal
                  }, 0)
                  if (!total) return null
                  return (
                    <span style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total)}
                    </span>
                  )
                })()}
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
                    <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                      <TH>Sitio</TH><TH>SMP ID</TH><TH>Desempeño</TH><TH>SPO</TH><TH>Categoría</TH>
                      <TH>SS MOS ok</TH><TH>SS Integración ok</TH><TH>SS Aceptación Final ok</TH><TH>Falta</TH><TH>Valor Estimado</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {pendienteLibBySmp.map(({ row, cat, missing, hitoMOS, hitoIntg, hitoAcep }) => {
                      const poData = pos.find(p => p.spo_number === row.spo_number)
                      const smpId = row.smp_id
                      // Acumular valor real por hito usando la PO específica de cada uno.
                      // Solo contar hitos con ssDate (misma condición que hasReleasable).
                      let valorEst = null
                      for (const [msName, hito] of [
                        ['SS MOS ok', hitoMOS],
                        ['SS Integracion ok', hitoIntg],
                        ['SS Aceptacion final ok', hitoAcep],
                      ]) {
                        if (!hito.ssDate || hito.status !== 'pendiente') continue
                        const ppaRow = ppaByHito.get(`${smpId}|${msName}`)
                        if (!ppaRow) continue
                        const hitoPoData = pos.find(p => p.spo_number === ppaRow.spo_number)
                        if (!hitoPoData?.valor) continue
                        const evs = getEventosRow(ppaRow, invMap)
                        let pctRow = evs.reduce((s, e) => s + (e.invoiceable_pct ?? e.pct ?? 0), 0)
                        if (pctRow === 0) {
                          const invoicedPct = EVENTOS.reduce((s, e) => s + (invMap[`${ppaRow.spo_number}|${e.key}`]?.pct || 0), 0)
                          pctRow = Math.max(0, 100 - invoicedPct - (ppaRow.acuerdo_liberacion || 0))
                        }
                        valorEst = (valorEst ?? 0) + hitoPoData.valor * pctRow / 100
                      }
                      const fmtCOP = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData?.moneda || 'COP', maximumFractionDigits: 0 }).format(v)
                      return (
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
                        <td style={{ padding: '7px 10px' }}>
                          <MissingBadge missing={missing} onClick={!isViewer ? () => setAcuerdoModal(row) : undefined} />
                        </td>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#166534', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {valorEst != null ? fmtCOP(valorEst) : <span style={{ color: '#9ca3af', fontSize: 10 }}>Sin PO</span>}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Bloqueados en ACK ── */}
          {bloqueadoAck.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#991b1b' }}>
                  Bloqueados en ACK
                </div>
                <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                  {bloqueadoAck.length}
                </span>
                <div style={{ fontSize: 11, color: '#4b5563' }}>— NDPD al 100% en Integración pero bloqueados por estado ACK</div>
              </div>
              <div className="card" style={{ overflow: 'auto', maxHeight: '40vh', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 780 }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                      <TH>Sitio</TH><TH>SMP ID</TH><TH>Desempeño</TH><TH>SPO</TH><TH>Falta</TH>
                      <TH>Estado HW_Cierre</TH><TH>Estado OnAir</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {bloqueadoAck.map(({ row, cat, missing, ackEstado }) => (
                      <tr key={`${row.spo_number}|${row.ms_name}`} style={{ borderTop: '1px solid #fef2f2' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{row.customer_site_name || row.site_reference_id}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{row.smp_id}</td>
                        <td style={{ padding: '7px 10px' }}><DesempenoBadge val={row.desempeno} /></td>
                        <td style={{ padding: '7px 10px' }}><SpoCell spo={row.spo_number} pos={pos} /></td>
                        <td style={{ padding: '7px 10px' }}><MissingBadge missing={missing} /></td>
                        <td style={{ padding: '7px 10px' }}>
                          {ackEstado.hwBlocked
                            ? <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px', whiteSpace: 'nowrap' }}>{ackEstado.hw_cierre}</span>
                            : <span style={{ color: '#d4d4d8', fontSize: 10 }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          {ackEstado.onBlocked
                            ? <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px', whiteSpace: 'nowrap' }}>{ackEstado.on_air}</span>
                            : <span style={{ color: '#d4d4d8', fontSize: 10 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── No Completados (sin SS Nokia) — vista plana ── */}
          {noCompletadosFlat.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#92400e' }}>
                  Pendiente Completar (NDPD)
                </div>
                <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                  {noCompletadosFlat.length}
                </span>
                {(() => {
                  const total = noCompletadosFlat.reduce((s, { row }) => {
                    const poDataNc = pos.find(p => p.spo_number === row.spo_number)
                    if (!poDataNc?.valor) return s
                    const evsNc = getEventosRow(row, invMap)
                    let pctNc = evsNc.reduce((a, e) => a + (e.invoiceable_pct ?? e.pct ?? 0), 0)
                    if (pctNc === 0) {
                      const invoicedPct = EVENTOS.reduce((a, e) => a + (invMap[`${row.spo_number}|${e.key}`]?.pct || 0), 0)
                      pctNc = Math.max(0, 100 - invoicedPct - (row.acuerdo_liberacion || 0))
                    }
                    return s + poDataNc.valor * pctNc / 100
                  }, 0)
                  if (!total) return null
                  return (
                    <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total)}
                    </span>
                  )
                })()}
                <div style={{ fontSize: 11, color: '#4b5563' }}>— SPOs bloqueados por falta de GR y/o %{rolloutItems ? '' : ' · carga Rollout para ver progreso'}</div>
              </div>
              <div className="card" style={{ overflow: 'auto', maxHeight: '55vh' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fcd34d' }}>
                      <TH>Sitio</TH><TH>SMP ID</TH><TH>MS/SMP Name</TH><TH>Desempeño</TH><TH>SPO</TH><TH>Falta</TH><TH>Progreso Rollout</TH><TH style={{ textAlign: 'center' }}>Valor Estimado</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {noCompletadosFlat.map(({ row, missing, rollout }) => {
                      const onHitoClick = !isViewer ? ms => {
                        const r = ppaByHito.get(`${row.smp_id}|${ms}`) || row
                        setAcuerdoModal(r)
                      } : null
                      const poDataNc = pos.find(p => p.spo_number === row.spo_number)
                      const evsNc = getEventosRow(row, invMap)
                      let pctNc = evsNc.reduce((s, e) => s + (e.invoiceable_pct ?? e.pct ?? 0), 0)
                      if (pctNc === 0) {
                        const invoicedPct = EVENTOS.reduce((s, e) => s + (invMap[`${row.spo_number}|${e.key}`]?.pct || 0), 0)
                        pctNc = Math.max(0, 100 - invoicedPct - (row.acuerdo_liberacion || 0))
                      }
                      const valorEstNc = poDataNc?.valor ? poDataNc.valor * pctNc / 100 : null
                      const fmtNc = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: poDataNc?.moneda || 'COP', maximumFractionDigits: 0 }).format(v)
                      return (
                        <tr key={row.smp_id} style={{ borderTop: '1px solid #fef9ee', background: '#fefdf9' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{row.customer_site_name || row.site_reference_id}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 9, color: '#555' }}>{row.smp_id}</td>
                          <td style={{ padding: '6px 10px', fontSize: 10, color: '#555' }}>
                            {row.smp_name === 'Process_Implementation' ? row.ms_name : row.smp_name}
                          </td>
                          <td style={{ padding: '6px 10px' }}><DesempenoBadge val={row.desempeno} /></td>
                          <td style={{ padding: '6px 10px' }}><SpoCell spo={row.spo_number} pos={pos} /></td>
                          <td style={{ padding: '6px 10px' }}><MissingBadge missing={missing} onClick={!isViewer ? () => setAcuerdoModal(row) : undefined} /></td>
                          <td style={{ padding: '6px 10px' }}>
                            {rollout ? (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <HitoBar label="MOS" pct={rollout.mosPct} color="#144E4A" status={getHitoBarStatus(row.smp_id, 'SS MOS ok', rollout.mosPct)} onClick={onHitoClick ? () => onHitoClick('SS MOS ok') : undefined} />
                                {rollout.mosSS && <HitoBar label="Integración" pct={rollout.intgPct} color="#0369a1" status={getHitoBarStatus(row.smp_id, 'SS Integracion ok', rollout.intgPct)} onClick={onHitoClick ? () => onHitoClick('SS Integracion ok') : undefined} />}
                                {rollout.intgSS && <HitoBar label="Acept. Final" pct={rollout.acepPct} color="#7c3aed" status={getHitoBarStatus(row.smp_id, 'SS Aceptacion final ok', rollout.acepPct)} onClick={onHitoClick ? () => onHitoClick('SS Aceptacion final ok') : undefined} />}
                              </div>
                            ) : (
                              <span style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic' }}>Sin datos Rollout</span>
                            )}
                          </td>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            {valorEstNc != null ? fmtNc(valorEstNc) : <span style={{ color: '#9ca3af', fontSize: 10 }}>Sin PO</span>}
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
      )}
      </div>
      </div>
    </>
  )
}
