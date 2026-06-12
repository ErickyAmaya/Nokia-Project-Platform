import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Cell, ResponsiveContainer,
} from 'recharts'
import { ChartCard, ScatterTip, mCol, mColPct, META_MARGEN, CU } from './helpers'

export default function Tab2({ filteredCalcs }) {
  const scatterData = useMemo(() =>
    filteredCalcs.map(({ s, c }) => ({
      name:   s.nombre,
      venta:  c.totalVenta,
      costo:  c.totalCosto,
      margen: c.margen,
      tipo:   s.tipo || 'TI',
    })), [filteredCalcs])

  const top10 = useMemo(() =>
    [...filteredCalcs]
      .sort((a, b) => b.c.margen - a.c.margen)
      .slice(0, 10)
      .map(({ s, c }) => ({
        name:   s.nombre.length > 16 ? s.nombre.slice(0, 16) + '…' : s.nombre,
        margen: parseFloat((c.margen * 100).toFixed(1)),
        venta:  c.totalVenta,
      })), [filteredCalcs])

  const maxVenta = useMemo(() =>
    Math.ceil(Math.max(...scatterData.map(d => Math.max(d.venta, d.costo))) / 1e6) * 1e6 + 1e6
  , [scatterData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div className="card">
        <div className="card-h">
          <h2>Dispersión — Venta vs Costo por Sitio</h2>
          <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 400 }}>
            verde ≥ 30% · amarillo ≥ 20% · rojo &lt; 20%
          </span>
        </div>
        <div className="card-b" style={{ paddingTop: 8 }}>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" />
              <XAxis
                type="number" dataKey="venta" name="Venta Nokia"
                tickFormatter={v => `$${(v/1e6).toFixed(0)}M`}
                tick={{ fontSize: 9 }} domain={[0, maxVenta]}
                label={{ value: 'Venta Nokia', position: 'insideBottom', offset: -4, fontSize: 10, fill: '#555' }}
              />
              <YAxis
                type="number" dataKey="costo" name="Costo SubC"
                tickFormatter={v => `$${(v/1e6).toFixed(0)}M`}
                tick={{ fontSize: 9 }} domain={[0, maxVenta]}
                label={{ value: 'Costo SubC', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#555' }}
              />
              <ZAxis range={[36, 36]} />
              <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: maxVenta, y: maxVenta }]}
                stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1}
                label={{ value: 'Margen 0%', position: 'insideTopLeft', fontSize: 9, fill: '#9ca3af' }}
              />
              <Scatter data={scatterData} isAnimationActive={false}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={mCol(entry.margen)} fillOpacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ChartCard title="Top 10 Sitios — Mayor Margen %" sub="porcentaje de margen" height={Math.max(200, top10.length * 36)}>
        <BarChart data={top10} layout="vertical" barSize={14} margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
          <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 9 }} domain={[0, 'auto']} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
          <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Margen']} labelStyle={{ fontWeight: 700, fontSize: 11 }} />
          <ReferenceLine x={META_MARGEN} stroke={CU} strokeDasharray="5 3"
            label={{ value: `${META_MARGEN}%`, position: 'top', fontSize: 9, fill: CU }} />
          <Bar dataKey="margen" name="Margen %" radius={[0, 2, 2, 0]}>
            {top10.map((entry, i) => <Cell key={i} fill={mColPct(entry.margen)} />)}
          </Bar>
        </BarChart>
      </ChartCard>

    </div>
  )
}
