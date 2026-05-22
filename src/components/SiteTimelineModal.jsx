import React, { useEffect, useState, useMemo } from 'react'
import { useAckStore }  from '../store/useAckStore'
import { useFactStore } from '../store/useFactStore'
import { getSupabaseClient } from '../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
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
const GAP_DONE_OA  = ['9999. Producción', '70. Producción', '9999.Producción']

// ── Milestone definitions ──────────────────────────────────────────
function buildMilestones(rollout, forecast, sabana) {
  const mosDate  = rollout?.mosSS  || sabana?.mos
  const intgDate = rollout?.intgSS || sabana?.integracion
  const soDate   = rollout?.acepSS || null

  const mosDone   = !!(mosDate  && isPast(mosDate))
  const intgDone  = !!(intgDate && isPast(intgDate))
  const hwcDone   = sabana?.gap_hw_cierre === GAP_DONE_HWC
  const docDone   = !!(sabana?.gap_doc && String(sabana.gap_doc).startsWith('9999'))
  const soDone    = (sabana?.gap_site_owner === GAP_DONE_SO) || !!(soDate && isPast(soDate))
  const onAirDone = GAP_DONE_OA.some(v => sabana?.gap_on_air === v)
  const closeDone = mosDone && hwcDone && intgDone && docDone && soDone && onAirDone

  return [
    { id: 'mos',   label: 'MOS',           iconKey: 'tower',    isDone: mosDone,   date: mosDate,  fcDate: null,                          blocking: false, gapRaw: null },
    { id: 'hwc',   label: 'HW Cierre',     iconKey: 'hardware', isDone: hwcDone,   date: null,     fcDate: forecast?.fc_avance_hw_cierre, blocking: false, gapRaw: sabana?.gap_hw_cierre },
    { id: 'intg',  label: 'Integración',   iconKey: 'signal',   isDone: intgDone,  date: intgDate, fcDate: null,                          blocking: false, gapRaw: null },
    { id: 'doc',   label: 'Documentación', iconKey: 'doc',      isDone: docDone,   date: null,     fcDate: forecast?.fc_avance_doc,        blocking: false, gapRaw: sabana?.gap_doc },
    { id: 'so',    label: 'Entrega SO',    iconKey: 'person',   isDone: soDone,    date: soDate,   fcDate: forecast?.fc_avance_site_owner, blocking: false, gapRaw: sabana?.gap_site_owner },
    { id: 'onair', label: 'On Air',        iconKey: 'bolt',     isDone: onAirDone, date: null,     fcDate: forecast?.fc_avance_on_air,     blocking: true,  gapRaw: sabana?.gap_on_air },
    { id: 'close', label: 'Cerrado',       iconKey: 'check',    isDone: closeDone, date: null,     fcDate: forecast?.fc_cierre_on_air,     blocking: false, gapRaw: null },
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

// ── Main component ─────────────────────────────────────────────────
export default function SiteTimelineModal({ smpId, onClose }) {
  const [rolloutItem, setRolloutItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hoveredMs, setHoveredMs] = useState(null)

  const forecasts  = useAckStore(s => s.forecasts)
  const sabana     = useAckStore(s => s.sabana)
  const pos        = useFactStore(s => s.pos)
  const invoices   = useFactStore(s => s.invoices)

  // Load rollout data for this SMP
  useEffect(() => {
    if (!smpId) return
    setLoading(true)
    const db = getSupabaseClient()
    if (!db) { setLoading(false); return }
    db.from('rollout_uploads').select('data').limit(1).single()
      .then(({ data }) => {
        const items = data?.data || []
        const item  = items.find(i => (i.smpId || '').toUpperCase() === smpId.toUpperCase())
        setRolloutItem(item || null)
      })
      .catch(() => setRolloutItem(null))
      .finally(() => setLoading(false))
  }, [smpId])

  // Derived data
  const sabanaRow    = useMemo(() => sabana.find(r => r.smp === smpId || r.main_smp === smpId), [sabana, smpId])
  const forecast     = useMemo(() => forecasts[smpId] || {}, [forecasts, smpId])
  const sitePo       = useMemo(() => pos.find(p => p.smp_id === smpId || p.site_name === sabanaRow?.site_name), [pos, smpId, sabanaRow])
  const siteInvoices = useMemo(() => sitePo ? invoices.filter(inv => inv.spo_number === sitePo.spo_number) : [], [invoices, sitePo])

  const milestones = useMemo(() => buildMilestones(rolloutItem, forecast, sabanaRow), [rolloutItem, forecast, sabanaRow])
  const statuses   = useMemo(() => milestones.map((ms, i) => getMsStatus(ms, i, milestones)), [milestones])

  const onAirBlocked = statuses[5] === 'blocked'
  const siteName     = sabanaRow?.site_name || sitePo?.site_name || smpId
  const siteCode     = sitePo?.site_id || '—'
  const region       = sabanaRow?.region || '—'
  const doneCount    = statuses.filter(s => s === 'done').length
  const implPct      = Math.round((doneCount / milestones.length) * 100)

  // Facturación calcs — fact_invoices usa pct, no monto directo
  const totalPo     = sitePo?.valor || 0
  const totalBilled = siteInvoices.reduce((acc, inv) => acc + ((inv.pct || 0) * totalPo / 100), 0)
  const factPct     = siteInvoices.reduce((acc, inv) => acc + (inv.pct || 0), 0)
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
              fontSize: 21, fontWeight: 800, color: '#f1f5f9', letterSpacing: .3,
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
              fontSize: 30, fontWeight: 800, lineHeight: 1,
              color: implPct >= 100 ? '#4ade80' : '#f1f5f9',
            }}>{implPct}%</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontWeight: 700, letterSpacing: .9, textTransform: 'uppercase' }}>
              Impl. NDPD
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.6)',
            fontSize: 20, cursor: 'pointer', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 10,
          }}>×</button>
        </div>

        {/* ── Blocking banner ── */}
        {onAirBlocked && (
          <div style={{
            background: '#fff1f2', borderBottom: '1px solid #fecaca',
            padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            {ICONS.warn('#dc2626')}
            <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>
              On Air pendiente — bloquea liberación y cierre del sitio.
            </span>
            <span style={{ fontSize: 11, color: '#b91c1c', marginLeft: 4 }}>
              Las facturas pendientes quedan retenidas hasta que Nokia confirme la señal.
            </span>
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '22px 24px 28px' }}>
          <div style={{ minWidth: 880 }}>

            {/* ── RIEL 1: Implementación NDPD ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {ICONS.tower('#1a7a4a')}
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: '#1a7a4a' }}>
                Implementación NDPD
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', width: '100%', position: 'relative', zIndex: 2 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginTop: 14, marginBottom: 8 }}>
              {milestones.map((ms, idx) => {
                const st        = statuses[idx]
                const col       = C[st]
                const displayDate = ms.date ? fmt(ms.date) : ms.fcDate ? `FC: ${fmt(ms.fcDate)}` : '—'
                const badgeLabel  = st === 'done' ? '✓ OK' : st === 'blocked' ? '⚠ Bloqueado' : st === 'active' ? 'En curso' : ms.fcDate ? 'Forecast' : 'Pendiente'
                const gapLabel    = ms.gapRaw ? fmtGap(ms.gapRaw) : null
                const isHovered   = hoveredMs === ms.id
                return (
                  <div
                    key={ms.id}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', padding: '0 4px' }}
                    onMouseEnter={() => setHoveredMs(ms.id)}
                    onMouseLeave={() => setHoveredMs(null)}
                  >
                    {/* ACK tooltip — aparece SOBRE el texto, no corta el header */}
                    {gapLabel && isHovered && (
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
                            ACK Nokia
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>{gapLabel}</div>
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
                    <span style={{
                      display: 'inline-block', marginTop: 5,
                      fontSize: 8, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase',
                      padding: '2px 7px', borderRadius: 20,
                      background: col.badge, color: col.badgeText,
                    }}>{badgeLabel}</span>
                    {/* GAP hint — solo cuando no está done */}
                    {gapLabel && st !== 'done' && (
                      <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 4, fontStyle: 'italic', textAlign: 'center' }}>
                        {gapLabel}
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

            {sitePo ? (
              <div style={{
                background: '#fff', borderRadius: 14, padding: '16px 20px',
                border: '1.5px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
              }}>
                {/* PO header + progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, letterSpacing: .5, textTransform: 'uppercase' }}>Orden de Compra</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 2 }}>
                      SPO <span style={{ color: '#2563eb' }}>{sitePo.spo_number}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, letterSpacing: .5, textTransform: 'uppercase' }}>Valor total PO</div>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 17, fontWeight: 800, color: '#111827', marginTop: 2,
                    }}>{fmtCOP(totalPo)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 22, fontWeight: 800, lineHeight: 1,
                        color: factPct >= 100 ? '#16a34a' : '#2563eb',
                      }}>{factPct}%</div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>
                          {fmtCOP(totalBilled)} facturado
                        </div>
                        <div style={{ fontSize: 8, color: '#9ca3af', fontWeight: 600, letterSpacing: .5, textTransform: 'uppercase' }}>
                          de {fmtCOP(totalPo)}
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 10, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 10, transition: 'width .6s',
                        width: `${Math.min(factPct, 100)}%`,
                        background: factPct >= 100
                          ? 'linear-gradient(90deg,#16a34a,#4ade80)'
                          : 'linear-gradient(90deg,#2563eb,#60a5fa)',
                      }}/>
                    </div>
                  </div>
                </div>

                {/* Invoice cards */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {siteInvoices.map((inv, i) => <InvCard key={i} inv={inv} poValor={totalPo} />)}
                  {remaining > 0 && (
                    <InvCard pending blocked={onAirBlocked} remaining={remaining} />
                  )}
                  {siteInvoices.length === 0 && remaining <= 0 && (
                    <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>
                      Sin facturas registradas
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
            {sitePo && (
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
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: "'Barlow', sans-serif",
            }}>
              {ICONS.warn('#dc2626')} Escalar bloqueo On Air
            </button>
          )}
          <button onClick={onClose} style={{
            background: '#1a7a4a', color: '#fff', border: 'none',
            borderRadius: 8, padding: '7px 16px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Barlow', sans-serif",
          }}>
            Cerrar
          </button>
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
