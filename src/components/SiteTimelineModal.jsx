import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAckStore }  from '../store/useAckStore'
import { useFactStore } from '../store/useFactStore'
import { getSupabaseClient } from '../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return null
  // Parse as local noon to avoid UTC midnight shifting to previous day in UTC-5
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00')
  if (isNaN(d)) return null
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function isPast(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) <= new Date()
}
function fmtCOP(v) {
  if (!v && v !== 0) return '—'
  return '$ ' + Number(v).toLocaleString('es-CO')
}
function fmtGap(val) {
  if (!val) return null
  // Remove numeric prefix (e.g. "9999.", "3000.", "70.") and replace underscores
  return String(val).replace(/^\d+\.\s*/, '').replace(/_/g, ' ').trim()
}

// ── SVG icons ─────────────────────────────────────────────────────
const ICONS = {
  tower: (c = '#fff') => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="3" x2="12" y2="21"/>
      <line x1="8" y1="8" x2="16" y2="8"/>
      <line x1="6" y1="13" x2="18" y2="13"/>
      <line x1="8" y1="8" x2="12" y2="21"/>
      <line x1="16" y1="8" x2="12" y2="21"/>
    </svg>
  ),
  hardware: (c = '#fff') => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <rect x="5" y="5" width="14" height="14" rx="2"/>
      <line x1="9" y1="9" x2="9" y2="15"/><line x1="12" y1="7" x2="12" y2="17"/><line x1="15" y1="9" x2="15" y2="15"/>
      <line x1="5" y1="9" x2="2" y2="9"/><line x1="5" y1="15" x2="2" y2="15"/>
      <line x1="19" y1="9" x2="22" y2="9"/><line x1="19" y1="15" x2="22" y2="15"/>
    </svg>
  ),
  signal: (c = '#fff') => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1" fill={c}/>
    </svg>
  ),
  doc: (c = '#fff') => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="9 13 11 15 15 11"/>
    </svg>
  ),
  person: (c = '#fff') => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  truck: (c = '#fff') => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  bolt: (c = '#fff') => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  check: (c = '#fff') => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  invoice: (c = 'currentColor') => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  ),
  lock: (c = 'currentColor') => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  warn: (c = 'currentColor') => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
}

// ── GAP done values ────────────────────────────────────────────────
const GAP_DONE_HWC = '9999.Finalizado_SS_E2E'
const GAP_DONE_SO  = '9999.Aprobado'
const GAP_DONE_LI  = '9999.Finalizada'
const GAP_DONE_OA  = ['9999. Producción', '70. Producción', '9999.Producción']

// ── Milestone definitions ──────────────────────────────────────────
function buildMilestones(rollout, forecast, sabana) {
  const mosDate  = rollout?.mosSS  || sabana?.mos
  const intgDate = rollout?.intgSS || null
  const acepDate = rollout?.acepSS || null

  const mosDone    = !!(mosDate  && isPast(mosDate))
  const intgDone   = !!(intgDate && isPast(intgDate))
  const hwcDone    = sabana?.gap_hw_cierre === GAP_DONE_HWC
  const docDone    = !!(sabana?.gap_doc && String(sabana.gap_doc).startsWith('9999'))
  const soDone     = sabana?.gap_site_owner === GAP_DONE_SO
  const logInvDone = sabana?.gap_log_inv === GAP_DONE_LI
  const onAirDone  = GAP_DONE_OA.some(v => sabana?.gap_on_air === v)
  const closeDone  = !!(acepDate && isPast(acepDate))

  return [
    { id: 'mos',    label: 'MOS',             iconKey: 'tower',    isDone: mosDone,    date: mosDate,  lastDate: rollout?.mosLastDate  || null, fcDate: null,                          blocking: false, gapRaw: null,                      ndpdLabel: rollout ? (rollout.mosLastCol  || 'Sin iniciar') : null },
    { id: 'hwc',    label: 'HW Cierre',       iconKey: 'hardware', isDone: hwcDone,    date: null,     lastDate: null,                          fcDate: forecast?.fc_avance_hw_cierre, blocking: false, gapRaw: sabana?.gap_hw_cierre,     ndpdLabel: null },
    { id: 'intg',   label: 'Integración',     iconKey: 'signal',   isDone: intgDone,   date: intgDate, lastDate: rollout?.intgLastDate || null, fcDate: null,                          blocking: false, gapRaw: null,                      ndpdLabel: rollout ? (rollout.intgLastCol || 'Sin iniciar') : null },
    { id: 'doc',    label: 'Documentación',   iconKey: 'doc',      isDone: docDone,    date: null,     lastDate: null,                          fcDate: forecast?.fc_avance_doc,        blocking: false, gapRaw: sabana?.gap_doc,           ndpdLabel: null },
    { id: 'so',     label: 'Entrega SO',      iconKey: 'person',   isDone: soDone,     date: null,     lastDate: null,                          fcDate: forecast?.fc_avance_site_owner, blocking: false, gapRaw: sabana?.gap_site_owner,    ndpdLabel: null },
    { id: 'loginv', label: 'Log. Inversa',    iconKey: 'truck',    isDone: logInvDone, date: null,     lastDate: null,                          fcDate: null,                          blocking: false, gapRaw: sabana?.gap_log_inv,       ndpdLabel: null },
    { id: 'onair',  label: 'On Air',          iconKey: 'bolt',     isDone: onAirDone,  date: null,     lastDate: null,                          fcDate: forecast?.fc_avance_on_air,    blocking: true,  gapRaw: sabana?.gap_on_air,        ndpdLabel: null },
    { id: 'close',  label: 'Aceptación Final', iconKey: 'check',    isDone: closeDone,  date: acepDate, lastDate: rollout?.acepLastDate || null, fcDate: forecast?.fc_cierre_on_air,    blocking: false, gapRaw: null,                      ndpdLabel: rollout ? (rollout.acepLastCol || 'Sin iniciar') : null },
  ]
}

function getMsStatus(ms, idx, milestones) {
  if (ms.isDone) return 'done'
  const prevDone = idx === 0 || milestones[idx - 1].isDone
  if (!prevDone) return 'pending'
  if (ms.blocking) return 'blocked'
  return 'active'
}

// ── Status colors ──────────────────────────────────────────────────
const C = {
  done:    { bg: '#16a34a', shadow: 'rgba(22,163,74,.35)',   text: '#16a34a', badge: '#dcfce7', badgeText: '#166534' },
  active:  { bg: '#d97706', shadow: 'rgba(217,119,6,.4)',    text: '#d97706', badge: '#fef9c3', badgeText: '#a16207' },
  blocked: { bg: '#dc2626', shadow: 'rgba(220,38,38,.4)',    text: '#dc2626', badge: '#fee2e2', badgeText: '#991b1b' },
  pending: { bg: '#e2e8f0', shadow: 'rgba(148,163,184,.2)', text: '#9ca3af', badge: '#f1f5f9', badgeText: '#94a3b8' },
}

// ── Invoice card ───────────────────────────────────────────────────
function InvCard({ inv, pending, blocked, remaining, poValor = 0 }) {
  if (pending) {
    return (
      <div style={{
        flex: 1, minWidth: 140, borderRadius: 10, padding: '10px 12px',
        border: `1.5px solid ${blocked ? '#fca5a5' : '#e2e8f0'}`,
        background: blocked ? '#fff1f2' : '#f8fafc',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 2 }}>Por facturar</div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 16, fontWeight: 800, color: blocked ? '#dc2626' : '#374151', lineHeight: 1, marginBottom: 4,
        }}>{fmtCOP(remaining)}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af' }}>Sin fecha</div>
        <span style={{
          display: 'inline-block', marginTop: 5,
          fontSize: 8, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
          padding: '2px 6px', borderRadius: 10,
          background: blocked ? '#fee2e2' : '#f1f5f9',
          color: blocked ? '#dc2626' : '#64748b',
        }}>{blocked ? '⛔ Retenida' : '⏳ Pendiente'}</span>
        {blocked && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, marginTop: 7,
            fontSize: 9, fontWeight: 600, color: '#b91c1c',
            background: '#fff1f2', borderRadius: 6, padding: '4px 7px',
          }}>
            {ICONS.warn('#b91c1c')}
            On Air pendiente Nokia
          </div>
        )}
      </div>
    )
  }
  // monto = pct% del valor PO (fact_invoices no tiene campo monto directo)
  const monto = ((inv.pct || 0) * poValor / 100)
  return (
    <div style={{
      flex: 1, minWidth: 140, borderRadius: 10, padding: '10px 12px',
      border: '1.5px solid #bfdbfe', background: '#eff6ff',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 2 }}>
        {inv.numero_factura || inv.evento || '—'}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 16, fontWeight: 800, color: '#1d4ed8', lineHeight: 1, marginBottom: 4,
      }}>{fmtCOP(monto)}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af' }}>
        {fmt(inv.fecha_factura) || '—'}
      </div>
      <span style={{
        display: 'inline-block', marginTop: 5,
        fontSize: 8, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
        padding: '2px 6px', borderRadius: 10,
        background: '#dbeafe', color: '#1d4ed8',
      }}>✓ Emitida</span>
    </div>
  )
}

// Normaliza una cadena: minúsculas, sin tildes, sin espacios extra
// eslint-disable-next-line no-misleading-character-class
function normStr(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() }

// ── Milestone key → possible ack_glosario area names ─────────────
const MS_TO_AREAS = {
  hwc:    ['HW_Cierre'],
  onair:  ['ONAIR'],
  doc:    ['DOC'],
  loginv: ['LI', 'LOG_INV'],
  so:     ['SO_DEC', 'SO'],
}

// ── Main component ─────────────────────────────────────────────────
export default function SiteTimelineModal({ smpId, onClose }) {
  const navigate = useNavigate()
  const [rolloutItem, setRolloutItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hoveredMs, setHoveredMs] = useState(null)
  const [ackGlosario, setAckGlosario] = useState([])

  const forecasts  = useAckStore(s => s.forecasts)
  const sabana     = useAckStore(s => s.sabana)
  const pos        = useFactStore(s => s.pos)
  const invoices   = useFactStore(s => s.invoices)
  const ppa        = useFactStore(s => s.ppa)

  // Load rollout data and ack_glosario for this SMP
  useEffect(() => {
    if (!smpId) return
    setLoading(true)
    const db = getSupabaseClient()
    if (!db) { setLoading(false); return }
    Promise.all([
      db.from('rollout_uploads').select('items').order('uploaded_at', { ascending: false }).limit(1).single(),
      db.from('ack_glosario').select('id,gap,area,secuencia').order('area').order('secuencia'),
    ]).then(([rolloutRes, glosarioRes]) => {
      const items = rolloutRes.data?.items || []
      const item  = items.find(i => (i.smpId || '').toUpperCase() === smpId.toUpperCase())
      setRolloutItem(item || null)
      setAckGlosario(glosarioRes.data || [])
    }).catch(() => { setRolloutItem(null); setAckGlosario([]) })
      .finally(() => setLoading(false))
  }, [smpId])

  // Derived data
  // La fila maestra es donde smp === main_smp (la actividad raíz del pack)
  const sabanaRow    = useMemo(() =>
    sabana.find(r => r.main_smp === smpId && r.smp === r.main_smp) || sabana.find(r => r.main_smp === smpId)
  , [sabana, smpId])
  const forecast     = useMemo(() => forecasts[smpId] || {}, [forecasts, smpId])


  // PPA es la fuente de verdad para identidad del sitio.
  // Los PDFs (fact_pos) no son confiables para site_name/site_id/smp_id —
  // Nokia usa campos distintos en el PDF que pueden tener datos de otro sitio.
  const sitePpa = useMemo(() => {
    const normSiteName = normStr(sabanaRow?.site_name)
    if (!normSiteName) return []
    return ppa.filter(p => normStr(p.customer_site_name) === normSiteName)
  }, [ppa, sabanaRow])

  // Incluir un PO de fact_pos solo si el PPA lo confirma como de este sitio.
  // Esto garantiza que solo aportamos valor monetario desde PDFs, sin contaminar
  // la identidad del sitio con datos incorrectos del campo Delivery Address.
  const sitePos = useMemo(() => {
    const sitePpaSpos = new Set(sitePpa.map(p => p.spo_number))
    return pos.filter(p => sitePpaSpos.has(p.spo_number))
  }, [pos, sitePpa])

  // Unión: pos enriched con ms_name del PPA + entradas sintéticas para SPOs sin PDF
  const allSitePos = useMemo(() => {
    const ppaIdx = new Map(ppa.map(p => [p.spo_number, p]))
    const enriched = sitePos.map(p => {
      const ppaRow = ppaIdx.get(p.spo_number)
      return ppaRow ? { ...p, ms_name: ppaRow.ms_name, smp_name: ppaRow.smp_name } : p
    })
    const existingSpos = new Set(sitePos.map(p => p.spo_number))
    const synthetic = sitePpa
      .filter(p => p.spo_number && !existingSpos.has(p.spo_number))
      .map(p => ({
        spo_number: p.spo_number, smp_id: p.smp_id,
        site_name: p.customer_site_name, site_id: p.site_reference_id,
        pci_description: null, smp_name: p.smp_name, ms_name: p.ms_name,
        valor: null, _fromPpa: true,
      }))

    // Solo los 3 hitos de facturación NDPD: SS MOS ok, SS Integración ok, SS Aceptación final ok.
    // Excluye TSS, CW, CR, ADJ y cualquier otro tipo de servicio.
    const isNdpdImpl = po => {
      const ms = (po.ms_name || '').toLowerCase()
      // ms_name es el campo más confiable (viene del PPA Nokia)
      if (ms) return ms.includes('mos') || ms.includes('integ') || ms.includes('acept') || ms.includes('final') || ms.includes('acceptance')
      // Fallback: pci_description del PDF
      const pci = (po.pci_description || '').toLowerCase()
      if (pci) return pci.includes('mos') || pci.includes('integ') || pci.includes('acept') || pci.includes('final')
      // Último recurso: smp_name con patrón de implementación Nokia
      return /Process_Implementation|IMP_ADJ/i.test(po.smp_name || '')
    }

    return [...enriched, ...synthetic].filter(isNdpdImpl)
  }, [sitePos, sitePpa, ppa])

  const siteInvoices = useMemo(() => {
    const spoSet = new Set(allSitePos.map(p => p.spo_number))
    return invoices.filter(inv => spoSet.has(inv.spo_number))
  }, [invoices, allSitePos])

  const milestones = useMemo(() => buildMilestones(rolloutItem, forecast, sabanaRow), [rolloutItem, forecast, sabanaRow])
  const statuses   = useMemo(() => milestones.map((ms, i) => getMsStatus(ms, i, milestones)), [milestones])

  // Progress % for each milestone (bar inside circle label area)
  // NDPD milestones: use rolloutItem pct fields; ACK milestones: use ack_glosario secuencia
  const msProgress = useMemo(() => {
    const glosarioByArea = {}
    ackGlosario.forEach(row => {
      if (!glosarioByArea[row.area]) glosarioByArea[row.area] = []
      glosarioByArea[row.area].push(row)
    })

    return milestones.map((ms, idx) => {
      const st = statuses[idx]
      if (st === 'done') return 100

      // NDPD milestones
      if (ms.id === 'mos')   return rolloutItem?.mosPct  ?? null
      if (ms.id === 'intg')  return rolloutItem?.intgPct ?? null
      if (ms.id === 'close') return rolloutItem?.acepPct ?? null

      // ACK milestones — calculate from ack_glosario regardless of pending/active/blocked
      const possibleAreas = MS_TO_AREAS[ms.id]
      if (!possibleAreas) return null
      const rows = possibleAreas
        .flatMap(a => glosarioByArea[a] || [])
        .filter(r => r.secuencia !== null)
      if (!rows.length) return null
      const maxSeq = Math.max(...rows.map(r => r.secuencia))
      const minSeq = Math.min(...rows.map(r => r.secuencia))
      const current = rows.find(r => r.gap === ms.gapRaw)
      if (!current) return null
      if (maxSeq === minSeq) return 0
      return Math.round(((current.secuencia - minSeq) / (maxSeq - minSeq)) * 100)
    })
  }, [milestones, statuses, rolloutItem, ackGlosario])

  const onAirBlocked = statuses[6] === 'blocked'
  const siteName     = sabanaRow?.site_name || allSitePos[0]?.site_name || smpId
  const siteCode     = allSitePos[0]?.site_id || '—'
  const region       = sabanaRow?.region || '—'
  const doneCount    = statuses.filter(s => s === 'done').length
  const implPct      = Math.round((doneCount / milestones.length) * 100)

  // Facturación calcs — agrupado por SPO, pct * po.valor
  const totalPo     = allSitePos.reduce((acc, p) => acc + (p.valor || 0), 0)
  const totalBilled = allSitePos.reduce((acc, po) => {
    const poInvs = siteInvoices.filter(inv => inv.spo_number === po.spo_number)
    return acc + poInvs.reduce((s, inv) => s + ((inv.pct || 0) * (po.valor || 0) / 100), 0)
  }, 0)
  // Si hay SPOs sin valor (sin PDF), el denominador monetario excluye su peso → muestra 100% incorrecto.
  // En ese caso usar peso igualitario por SPO (cada SPO = 1/N), más honesto que el cálculo monetario parcial.
  const hasSyntheticPos = allSitePos.some(p => p._fromPpa && !p.valor)
  const factPct = (() => {
    if (allSitePos.length === 0) return 0
    if (!hasSyntheticPos && totalPo > 0) return Math.round((totalBilled / totalPo) * 100)
    // Peso igualitario: fracción facturada de cada SPO promediada
    const fracs = allSitePos.map(po => {
      if (!po.valor) return 0
      const billed = siteInvoices
        .filter(inv => inv.spo_number === po.spo_number)
        .reduce((s, inv) => s + ((inv.pct || 0) * po.valor / 100), 0)
      return po.valor > 0 ? billed / po.valor : 0
    })
    return Math.round((fracs.reduce((a, f) => a + f, 0) / allSitePos.length) * 100)
  })()
  const remaining   = totalPo - totalBilled

  if (!smpId) return null

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        zIndex: 600, backdropFilter: 'blur(2px)',
      }}/>

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: '5vh 3vw', zIndex: 601,
        background: '#f0f2f0', borderRadius: 20, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.35)',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: '#0f172a', padding: '16px 24px',
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
            border: '1.5px solid rgba(74,222,128,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {ICONS.tower('#4ade80')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 21, fontWeight: 600, color: '#f1f5f9', letterSpacing: .3,
            }}>
              {loading ? 'Cargando…' : siteName}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              {[
                { label: smpId, bg: '#1e3a5f', color: '#93c5fd' },
                siteCode !== '—' ? { label: `Código: ${siteCode}`, bg: '#2d1f4e', color: '#c4b5fd' } : null,
                region !== '—'   ? { label: region, bg: '#0d3320', color: '#4ade80' } : null,
                onAirBlocked     ? { label: '⚠ On Air Pendiente', bg: '#450a0a', color: '#f87171' } : null,
                !onAirBlocked && doneCount === milestones.length ? { label: '✓ Cerrado', bg: '#052e16', color: '#4ade80' } : null,
              ].filter(Boolean).map((chip, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                  background: chip.bg, color: chip.color, letterSpacing: .3,
                }}>{chip.label}</span>
              ))}
            </div>
          </div>
          {/* NDPD progress */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 30, fontWeight: 600, lineHeight: 1,
              color: implPct >= 100 ? '#4ade80' : '#f1f5f9',
            }}>{implPct}%</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontWeight: 700, letterSpacing: .9, textTransform: 'uppercase' }}>
              NDPD / ACK
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.6)',
            fontSize: 20, cursor: 'pointer', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 10,
          }}>×</button>
        </div>

        {/* ── Alert banners ── */}
        {onAirBlocked && (
          <div style={{ padding: '10px 24px 0', flexShrink: 0 }}>
            <div style={{
              background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: 12,
              padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}>{ICONS.warn('#dc2626')}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', lineHeight: 1.3 }}>
                  On Air pendiente — bloquea liberación y cierre del sitio
                </div>
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, lineHeight: 1.4 }}>
                  Nokia no ha confirmado la señal. Las facturas de Integración y Cierre quedan retenidas hasta resolución.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '22px 24px 28px' }}>
          <div style={{ minWidth: 880 }}>

            {/* ── RIEL 1: Implementación NDPD ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {ICONS.tower('#1a7a4a')}
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: '#1a7a4a' }}>
                Implementación — NDPD / ACK
              </span>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#bbf7d0,transparent)' }}/>
              <span style={{ fontSize: 10, fontWeight: 700, color: doneCount === milestones.length ? '#16a34a' : '#6b7280' }}>
                {doneCount === milestones.length ? '✓ ' : ''}{doneCount} / {milestones.length} hitos completados
              </span>
            </div>

            {/* Rail — solo círculos + track, sin texto */}
            <div style={{ position: 'relative', height: 60, display: 'flex', alignItems: 'center' }}>
              {/* Track */}
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, background: '#e2e8f0', transform: 'translateY(-50%)', borderRadius: 3 }}/>
              {/* Done fill */}
              <div style={{
                position: 'absolute', top: '50%', left: 0,
                height: 5, width: `${(doneCount / milestones.length) * 100}%`,
                background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                transform: 'translateY(-50%)', borderRadius: 3, transition: 'width .6s',
              }}/>
              {/* Blocked stripe */}
              {onAirBlocked && (
                <div style={{
                  position: 'absolute', top: '50%',
                  left: `${(5 / milestones.length) * 100}%`,
                  width: `${(1 / milestones.length) * 100}%`,
                  height: 5,
                  background: 'repeating-linear-gradient(90deg,#dc2626 0,#dc2626 5px,#fecaca 5px,#fecaca 9px)',
                  transform: 'translateY(-50%)', opacity: .7,
                }}/>
              )}

              {/* Circles grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', width: '100%', position: 'relative', zIndex: 2 }}>
                {milestones.map((ms, idx) => {
                  const st   = statuses[idx]
                  const col  = C[st]
                  const anim = st === 'active' ? 'pulse-warn 2.2s ease-in-out infinite' : st === 'blocked' ? 'pulse-red 1.8s ease-in-out infinite' : 'none'
                  return (
                    <div key={ms.id} style={{ display: 'flex', justifyContent: 'center' }}>
                      <div
                        style={{
                          width: 50, height: 50, borderRadius: '50%',
                          background: col.bg,
                          border: '3px solid #f0f2f0',
                          boxShadow: `0 0 0 3px ${col.bg}, 0 6px 16px ${col.shadow}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          animation: anim, transition: 'transform .18s', cursor: 'default',
                        }}
                        onMouseEnter={() => setHoveredMs(ms.id)}
                        onMouseLeave={() => setHoveredMs(null)}
                      >
                        {ICONS[ms.iconKey](st === 'pending' ? '#94a3b8' : '#fff')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Labels grid — separado del riel para dar espacio */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', marginTop: 14, marginBottom: 8 }}>
              {milestones.map((ms, idx) => {
                const st          = statuses[idx]
                const col         = C[st]
                const pct         = msProgress[idx]
                const displayDate = ms.date
                  ? fmt(ms.date)
                  : ms.lastDate && !ms.isDone
                    ? fmt(ms.lastDate)
                    : ms.fcDate
                      ? `FC: ${fmt(ms.fcDate)}`
                      : '—'
                const isHovered   = hoveredMs === ms.id
                return (
                  <div
                    key={ms.id}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', padding: '0 4px' }}
                    onMouseEnter={() => setHoveredMs(ms.id)}
                    onMouseLeave={() => setHoveredMs(null)}
                  >
                    {/* Tooltip — ACK (gapRaw) o NDPD (ndpdLabel) */}
                    {(ms.gapRaw || ms.ndpdLabel) && isHovered && (
                      <div style={{
                        position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap',
                      }}>
                        <div style={{
                          background: '#1e293b', borderRadius: 8,
                          padding: '6px 10px',
                          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                          border: '1px solid rgba(255,255,255,.1)',
                        }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                            {ms.ndpdLabel ? 'NDPD Nokia' : 'ACK Nokia'}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>
                            {ms.ndpdLabel || ms.gapRaw}
                          </div>
                        </div>
                        <div style={{
                          width: 0, height: 0, margin: '0 auto',
                          borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                          borderTop: '6px solid #1e293b',
                        }}/>
                      </div>
                    )}

                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 10.5, fontWeight: 800, letterSpacing: .7,
                      textTransform: 'uppercase', color: col.text, lineHeight: 1.2, textAlign: 'center',
                    }}>{ms.label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b7280', marginTop: 3, textAlign: 'center' }}>{displayDate}</div>
                    {st === 'done' ? (
                      <span style={{
                        display: 'inline-block', marginTop: 5,
                        fontSize: 8, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: 20,
                        background: col.badge, color: col.badgeText,
                      }}>✓ OK</span>
                    ) : (
                      <div style={{ width: '100%', marginTop: 5, padding: '0 2px' }}>
                        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${Math.min(pct ?? 0, 100)}%`,
                            background: st === 'blocked'
                              ? 'linear-gradient(90deg,#dc2626,#f87171)'
                              : (pct ?? 0) > 0
                              ? 'linear-gradient(90deg,#d97706,#fbbf24)'
                              : '#cbd5e1',
                            transition: 'width .5s',
                          }}/>
                        </div>
                        {(pct ?? 0) > 0 && (
                          <div style={{ fontSize: 7.5, fontWeight: 700, color: col.text, textAlign: 'center', marginTop: 2 }}>{pct}%</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Conector ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 16px' }}>
              <div style={{ flex: 1, height: 0, borderTop: '1.5px dashed #cbd5e1' }}/>
              <span style={{
                fontSize: 8.5, fontWeight: 800, color: '#94a3b8',
                letterSpacing: 1.2, textTransform: 'uppercase',
                background: '#f0f2f0', padding: '0 8px',
              }}>Facturación asociada</span>
              <div style={{ flex: 1, height: 0, borderTop: '1.5px dashed #cbd5e1' }}/>
            </div>

            {/* ── RIEL 2: Facturación ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {ICONS.invoice('#2563eb')}
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: '#2563eb' }}>
                Facturación
              </span>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#bfdbfe,transparent)' }}/>
            </div>

            {allSitePos.length > 0 ? (() => {
              // MOS=0, HW Cierre=1, Integración=2, Doc=3, Entrega SO=4, Log.Inversa=5, On Air=6, Cerrado=7
              const SLOT_LABEL = { 0: 'MOS', 2: 'Integración', 7: 'Aceptación Final' }
              const STD_SLOTS  = [0, 2, 7]

              // Color según % facturado
              function factColor(pct)    { return pct >= 100 ? '#16a34a' : pct > 0 ? '#f59e0b' : '#dc2626' }
              function factGradient(pct) { return pct >= 100 ? 'linear-gradient(90deg,#16a34a,#4ade80)' : pct > 0 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : '#dc2626' }
              function factBg(pct)       { return pct >= 100 ? '#f0fdf4' : pct > 0 ? '#fffbeb' : '#fff1f2' }
              function factBorder(pct)   { return pct >= 100 ? '#16a34a' : pct > 0 ? '#f59e0b' : '#dc2626' }

              // Detectar columna del hito.
              // Prioridad: ms_name (Nokia label explícito) > pci_description (PDF) > SPO order (fallback)
              // NO se usa smp_name: todas las SPOs de un sitio suelen tener "impl" en ese campo.
              function spoMsIdx(po) {
                const msn = (po.ms_name || '').toLowerCase()
                const pci = (po.pci_description || '').toLowerCase()
                // ms_name: campo más confiable — contiene el hito Nokia ("SS MOS ok", "SS Integracion ok", etc.)
                if (msn.includes('mos'))                                              return 0
                if (msn.includes('integ'))                                            return 2
                if (msn.includes('acept') || msn.includes('final') || msn.includes('acceptance') || msn.includes('cierre')) return 7
                // pci_description: extraído del PDF
                if (pci.includes('mos'))                                              return 0
                if (pci.includes('integ'))                                            return 2
                if (pci.includes('acept') || pci.includes('final'))                  return 7
                return null  // → fallback por orden de spo_number (Nokia emite cronológicamente)
              }
              const colMap = {}
              const keywordMapped = new Set()
              allSitePos.forEach(po => {
                const idx = spoMsIdx(po)
                if (idx !== null && !colMap[idx]) { colMap[idx] = po; keywordMapped.add(po.spo_number) }
              })

              // Las no detectadas se ordenan por spo_number asc y se asignan a slots libres [0, 2, 6]
              const undetected = allSitePos
                .filter(po => !keywordMapped.has(po.spo_number))
                .sort((a, b) => String(a.spo_number).localeCompare(String(b.spo_number)))
              const freeStd = STD_SLOTS.filter(i => !colMap[i])
              undetected.forEach((po, i) => {
                if (freeStd[i] !== undefined) colMap[freeStd[i]] = po
              })

              return (
                <div>
                  {/* Cards alineadas al grid de 7 hitos */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0, marginBottom: 10 }}>
                    {milestones.map((ms, idx) => {
                      const po = colMap[idx]
                      if (!po) return <div key={ms.id} />
                      const poInvs   = siteInvoices.filter(inv => inv.spo_number === po.spo_number)
                      const poBilled = poInvs.reduce((s, inv) => s + ((inv.pct || 0) * (po.valor || 0) / 100), 0)
                      const poPct    = po.valor > 0 ? Math.round((poBilled / po.valor) * 100) : 0
                      const poRemain = (po.valor || 0) - poBilled
                      const slotLabel = SLOT_LABEL[idx] || ms.label
                      return (
                        <div key={ms.id} style={{ padding: '0 4px' }}>
                          <div style={{
                            borderRadius: 12, border: `2px solid ${factBorder(poPct)}`,
                            background: factBg(poPct), padding: '10px 12px',
                            boxShadow: `0 2px 8px rgba(0,0,0,.08)`,
                          }}>
                            {/* Etiqueta del hito + checkmark */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{
                                fontSize: 8, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase',
                                padding: '1px 6px', borderRadius: 8,
                                background: factBorder(poPct), color: '#fff',
                              }}>{slotLabel}</span>
                              {poPct >= 100 && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                            </div>
                            {/* SPO number */}
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 8, fontWeight: 700, color: '#6b7280', letterSpacing: .5, textTransform: 'uppercase' }}>SPO</div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', lineHeight: 1.2 }}>{po.spo_number}</div>
                            </div>
                            {/* barra y % eliminados — las SPOs se facturan al 100%, el color/borde ya lo indica */}
                            {/* Facturas */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {poInvs.map((inv, i) => {
                                const monto = ((inv.pct || 0) * (po.valor || 0) / 100)
                                return (
                                  <div key={i} style={{
                                    background: 'rgba(255,255,255,.7)', borderRadius: 8,
                                    padding: '6px 8px', border: '1px solid rgba(37,99,235,.15)',
                                  }}>
                                    <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 1 }}>
                                      {inv.numero_factura || inv.evento || `#${inv.id}`}
                                    </div>
                                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: '#1d4ed8', lineHeight: 1 }}>
                                      {fmtCOP(monto)}
                                    </div>
                                    <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 2 }}>{fmt(inv.fecha_factura) || '—'}</div>
                                    <span style={{
                                      fontSize: 7, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
                                      padding: '1px 5px', borderRadius: 8, marginTop: 3, display: 'inline-block',
                                      background: '#dbeafe', color: '#1d4ed8',
                                    }}>✓ Emitida</span>
                                  </div>
                                )
                              })}
                              {poRemain > 0 && (
                                <div style={{
                                  background: 'rgba(255,255,255,.6)', borderRadius: 8,
                                  padding: '6px 8px', border: '1px solid rgba(220,38,38,.2)',
                                }}>
                                  <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 1 }}>Por facturar</div>
                                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>
                                    {fmtCOP(poRemain)}
                                  </div>
                                  <span style={{
                                    fontSize: 7, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
                                    padding: '1px 5px', borderRadius: 8, marginTop: 3, display: 'inline-block',
                                    background: '#fee2e2', color: '#dc2626',
                                  }}>Pendiente</span>
                                </div>
                              )}
                              {poInvs.length === 0 && poRemain <= 0 && (
                                <div style={{
                                  background: 'rgba(255,255,255,.6)', borderRadius: 8,
                                  padding: '6px 8px', border: '1px solid rgba(220,38,38,.2)',
                                }}>
                                  <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 4 }}>
                                    {po._fromPpa ? 'Sin PDF cargado' : 'Sin facturas'}
                                  </div>
                                  <span style={{
                                    fontSize: 7, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
                                    padding: '1px 5px', borderRadius: 8, display: 'inline-block',
                                    background: '#fee2e2', color: '#dc2626',
                                  }}>{po._fromPpa ? '⏳ Pendiente' : 'Sin registro'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Barra total al fondo */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: '#f8fafc', borderRadius: 10, padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .8, flexShrink: 0 }}>
                      Total facturado
                    </span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: '#111827', flexShrink: 0 }}>
                      {fmtCOP(totalBilled)}
                    </span>
                    <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 6, transition: 'width .6s',
                        width: `${Math.min(factPct, 100)}%`,
                        background: factGradient(factPct),
                      }}/>
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800, color: factColor(factPct), flexShrink: 0 }}>
                      {factPct}%
                    </span>
                    <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>de {fmtCOP(totalPo)}</span>
                  </div>
                </div>
              )
            })() : (
              <div style={{
                background: '#fff', borderRadius: 14, padding: '20px',
                border: '1.5px solid #e5e7eb', textAlign: 'center',
                color: '#9ca3af', fontSize: 13,
              }}>
                Sin SPO / PO asignada a este sitio
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid #e5e7eb',
          background: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            Implementación: <strong style={{ color: '#111827' }}>{doneCount}/{milestones.length}</strong> hitos
            {allSitePos.length > 0 && (
              <> · Facturación: <strong style={{ color: factPct >= 100 ? '#16a34a' : '#2563eb' }}>{factPct}%</strong>
              {remaining > 0 && <> · Pendiente: <strong style={{ color: onAirBlocked ? '#dc2626' : '#374151' }}>{fmtCOP(remaining)}</strong></>}
              </>
            )}
          </span>
          <div style={{ flex: 1 }}/>
          {onAirBlocked && (
            <button style={{
              background: 'none', border: '1.5px solid #fca5a5', color: '#dc2626',
              borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'Barlow', sans-serif",
            }}>
              {ICONS.warn('#dc2626')} Escalar bloqueo On Air
            </button>
          )}
          {sabanaRow && (
            <button
              onClick={() => { onClose(); navigate(`/rollout/ack/sitios?smp=${encodeURIComponent(smpId)}`) }}
              style={{
                background: '#1a7a4a', color: '#fff', border: 'none',
                borderRadius: 8, padding: '7px 16px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: "'Barlow', sans-serif",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Ir al ACK de este sitio
            </button>
          )}
        </div>

      </div>

      <style>{`
        @keyframes pulse-warn {
          0%,100% { box-shadow: 0 0 0 3px #d97706, 0 6px 18px rgba(217,119,6,.35); }
          50%      { box-shadow: 0 0 0 8px rgba(217,119,6,.18), 0 6px 24px rgba(217,119,6,.5); }
        }
        @keyframes pulse-red {
          0%,100% { box-shadow: 0 0 0 3px #dc2626, 0 6px 18px rgba(220,38,38,.35); }
          50%      { box-shadow: 0 0 0 8px rgba(220,38,38,.2), 0 6px 24px rgba(220,38,38,.5); }
        }
      `}</style>
    </>
  )
}
