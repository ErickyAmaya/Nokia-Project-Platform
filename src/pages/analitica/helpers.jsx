import { ResponsiveContainer } from 'recharts'
import { cop, pct } from '../../lib/catalog'

// ── Paleta ───────────────────────────────────────────────────────
export const CN = '#144E4A'
export const CS = '#d97706'
export const CU = '#1a7a1a'
export const CR = '#c0392b'
export const CY = '#FFC000'
export const PIE_COLS = ['#144E4A','#0ea5e9','#7c3aed','#059669','#ea580c','#e11d48','#d97706','#84cc16']
export const META_MARGEN = 30

export function mCol(m) {
  if (m >= 0.3) return CU
  if (m >= 0.2) return CY
  return CR
}
export function mColPct(p) {
  if (p >= 30) return CU
  if (p >= 20) return CY
  return CR
}

// ── Tooltip base ─────────────────────────────────────────────────
export function TipBox({ label, rows }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e0e4e0', borderRadius: 6,
      padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.1)', fontSize: 11, maxWidth: 200,
    }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 4, color: '#333', fontSize: 11 }}>{label}</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ color: r.color || '#333', marginBottom: 1 }}>
          {r.name}: <strong>{r.val}</strong>
        </div>
      ))}
    </div>
  )
}

export function CopTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <TipBox label={label} rows={payload.map(p => ({ name: p.name, val: cop(p.value), color: p.color }))} />
  )
}

export function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <TipBox
      label={d.name}
      rows={[
        { name: 'Venta Nokia', val: cop(d.venta) },
        { name: 'Costo SubC',  val: cop(d.costo) },
        { name: 'Margen',      val: pct(d.margen), color: mCol(d.margen) },
        { name: 'Tipo',        val: d.tipo },
      ]}
    />
  )
}

export function TreeTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <TipBox
      label={d.name}
      rows={[
        { name: 'Venta',  val: cop(d.size) },
        { name: 'Margen', val: pct(d.margen), color: mCol(d.margen) },
      ]}
    />
  )
}

// ── Chart wrapper ─────────────────────────────────────────────────
export function ChartCard({ title, sub, children, height = 260, style }) {
  return (
    <div className="card" style={style}>
      <div className="card-h">
        <h2>{title}</h2>
        {sub && <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 400 }}>{sub}</span>}
      </div>
      <div className="card-b" style={{ paddingTop: 8 }}>
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color = CN }) {
  return (
    <div className="stat" style={{ borderLeftColor: color }}>
      <div className="sl">{label}</div>
      <div className="sv" style={{ fontSize: 14, color, lineHeight: 1.2, wordBreak: 'break-word' }}>{value}</div>
      {sub && <div className="ss">{sub}</div>}
    </div>
  )
}
