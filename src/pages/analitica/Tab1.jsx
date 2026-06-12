import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, ReferenceLine,
} from 'recharts'
import { cop, pct } from '../../lib/catalog'
import { ChartCard, CopTip, mColPct, CN, CS, CU, META_MARGEN } from './helpers'

export default function Tab1({ porLC }) {
  const sorted = useMemo(() => [...porLC].sort((a, b) => b.margen - a.margen), [porLC])
  const chartH = Math.max(220, sorted.length * 38)

  const bestMargen = sorted[0]
  const mossSitios = [...porLC].sort((a, b) => b.sitios - a.sitios)[0]
  const masCostoso = [...porLC].sort((a, b) => b.costo - a.costo)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div className="g3">
        <div className="stat" style={{ borderLeftColor: CU }}>
          <div className="sl">LC — Mejor Margen</div>
          <div className="sv" style={{ fontSize: 14, color: CU }}>{bestMargen?.name || '—'}</div>
          <div className="ss">{bestMargen ? pct(bestMargen.margen / 100) : ''}</div>
        </div>
        <div className="stat" style={{ borderLeftColor: CN }}>
          <div className="sl">LC — Más Sitios</div>
          <div className="sv" style={{ fontSize: 14, color: CN }}>{mossSitios?.name || '—'}</div>
          <div className="ss">{mossSitios ? `${mossSitios.sitios} sitios` : ''}</div>
        </div>
        <div className="stat" style={{ borderLeftColor: CS }}>
          <div className="sl">LC — Más Costoso</div>
          <div className="sv" style={{ fontSize: 14, color: CS }}>{masCostoso?.name || '—'}</div>
          <div className="ss">{masCostoso ? cop(masCostoso.costo) : ''}</div>
        </div>
      </div>

      <ChartCard title="Venta vs Costo por LC" sub="Nokia · Costo · Utilidad" height={chartH}>
        <BarChart data={porLC} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
          <XAxis type="number" tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} tick={{ fontSize: 9 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={85} />
          <Tooltip content={<CopTip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="venta" name="Venta Nokia" fill={CN} radius={[0, 2, 2, 0]} />
          <Bar dataKey="costo" name="Costo"        fill={CS} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Margen % por LC" sub={`ordenado de mayor a menor · meta ${META_MARGEN}%`} height={chartH}>
        <BarChart data={sorted} layout="vertical" barSize={14} margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
          <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 9 }} domain={[0, 'auto']} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={85} />
          <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Margen']} labelStyle={{ fontWeight: 700, fontSize: 11 }} />
          <ReferenceLine x={META_MARGEN} stroke={CU} strokeDasharray="5 3"
            label={{ value: `Meta ${META_MARGEN}%`, position: 'top', fontSize: 9, fill: CU }} />
          <Bar dataKey="margen" name="Margen %" radius={[0, 2, 2, 0]}>
            {sorted.map((entry, i) => <Cell key={i} fill={mColPct(entry.margen)} />)}
          </Bar>
        </BarChart>
      </ChartCard>

    </div>
  )
}
