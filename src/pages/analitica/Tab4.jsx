import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Treemap, ResponsiveContainer,
} from 'recharts'
import { cop, pct } from '../../lib/catalog'
import { ChartCard, TreeTip, mCol, PIE_COLS, CN } from './helpers'

function CustomTreeContent(props) {
  const { x, y, width, height, name, value, margen } = props
  if (width < 30 || height < 20) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height}
        style={{ fill: mCol(margen || 0), fillOpacity: 0.82, stroke: '#fff', strokeWidth: 1 }} />
      {width > 55 && height > 28 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
          style={{ fill: '#fff', fontSize: Math.min(11, width / 7), fontWeight: 700, pointerEvents: 'none' }}>
          {name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + '…' : name}
        </text>
      )}
      {width > 55 && height > 42 && (
        <text x={x + width / 2} y={y + height / 2 + 13} textAnchor="middle" dominantBaseline="middle"
          style={{ fill: '#fff', fontSize: 9, pointerEvents: 'none', opacity: 0.85 }}>
          {cop(value)}
        </text>
      )}
    </g>
  )
}

export default function Tab4({ filteredCalcs, porLC }) {
  const ventaTotal = filteredCalcs.reduce((s, { c }) => s + c.totalVenta, 0)

  const donaLC = useMemo(() => {
    const sorted = [...porLC].sort((a, b) => b.venta - a.venta)
    const top    = sorted.slice(0, 7)
    const otros  = sorted.slice(7).reduce((s, r) => s + r.venta, 0)
    const data   = top.map(r => ({ name: r.name, value: r.venta, pct: ventaTotal > 0 ? r.venta / ventaTotal : 0 }))
    if (otros > 0) data.push({ name: 'Otros', value: otros, pct: ventaTotal > 0 ? otros / ventaTotal : 0 })
    return data
  }, [porLC, ventaTotal])

  const treemapData = useMemo(() =>
    filteredCalcs
      .filter(({ c }) => c.totalVenta > 0)
      .map(({ s, c }) => ({ name: s.nombre, size: c.totalVenta, margen: c.margen }))
      .sort((a, b) => b.size - a.size)
  , [filteredCalcs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div className="card">
        <div className="card-h">
          <h2>Participación de LC en Venta Total</h2>
          <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 400 }}>distribución porcentual</span>
        </div>
        <div className="card-b" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <ResponsiveContainer width="50%" height={240}>
            <PieChart>
              <Pie data={donaLC} cx="50%" cy="50%"
                innerRadius={65} outerRadius={100}
                dataKey="value" paddingAngle={2}
              >
                {donaLC.map((_, i) => <Cell key={i} fill={PIE_COLS[i % PIE_COLS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [cop(v), n]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, minWidth: 140 }}>
            {donaLC.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: PIE_COLS[i % PIE_COLS.length] }} />
                <div style={{ flex: 1, fontSize: 10 }}>
                  <span style={{ fontWeight: 700 }}>{d.name}</span>
                  <span style={{ color: '#9ca89c', marginLeft: 6 }}>{pct(d.pct)}</span>
                </div>
                <span style={{ fontSize: 10, color: CN, fontWeight: 600 }}>{cop(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Sitios por Volumen de Venta</h2>
          <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 400 }}>verde ≥ 30% · amarillo ≥ 20% · rojo &lt; 20%</span>
        </div>
        <div className="card-b" style={{ paddingTop: 8 }}>
          <ResponsiveContainer width="100%" height={320}>
            <Treemap data={treemapData} dataKey="size" aspectRatio={4 / 3} content={<CustomTreeContent />}>
              <Tooltip content={<TreeTip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
