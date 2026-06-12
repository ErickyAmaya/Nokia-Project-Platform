import { useState } from 'react'
import { SMP_CATS, getSmpCat } from '../../../store/useFactStore'

export const SIBLING_KEY = { cw_1: 'cw_2', cw_2: 'cw_1', tss_1: 'tss_2', tss_2: 'tss_1' }

export const EV_DATE_COL = {
  acuerdo:  'acuerdo_ss_date',
  tss_1:    'ss_tssr_enviado_ppa_date',
  tss_2:    'ss_tssr_aprob_cliente_ppa_date',
  cw_1:     'execute_cw_ppa_date',
  cw_2:     'doc_final_ok_ppa_date',
  servicio: 'servicio_ejecutado_ppa_date',
}

export const SMP_FILTERS = [{ key: 'todos', label: 'Todas las categorías' }, ...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }]
export const EV_FILTERS = [
  { key: 'todos',         label: 'Todos los servicios' },
  { key: 'acuerdo',       label: 'Acuerdo' },
  { key: 'servicio|impl', label: 'Servicio · Implementación' },
  { key: 'servicio|adj',  label: 'Servicio · ADJ' },
  { key: 'servicio|cr',   label: 'Servicio · CR' },
  { key: 'servicio|cw',   label: 'Servicio · CW' },
  { key: 'servicio|tss',  label: 'Servicio · TSS' },
]

export function applyEvFilter(eventos, row, filtroEv) {
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

export const TH = ({ children, style }) => (
  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#92400e', fontSize: 11, letterSpacing: .5, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#fffbeb', borderBottom: '1px solid #fcd34d', zIndex: 1, ...style }}>
    {children}
  </th>
)

export function SpoCell({ spo, pos }) {
  const pdf = pos.find(p => p.spo_number === spo)?.pdf_url
  if (pdf) return (
    <a href={pdf} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontSize: 10, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }} title="Ver PDF de PO">
      {spo} ↗
    </a>
  )
  return <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{spo}</span>
}

export function EventoBadge({ ev }) {
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
export function DesempenoBadge({ val }) {
  if (!val) return <span style={{ color: '#d4d4d8', fontSize: 10 }}>—</span>
  const s = DESEMP_STYLE[val] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>
      {val}
    </span>
  )
}

export function MissingBadge({ missing, onClick }) {
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

export function HitoBadge({ ssDate, status }) {
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

export function HitoBar({ label, pct, color, status, onClick }) {
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
