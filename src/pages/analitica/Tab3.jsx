import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { MESES } from '../../lib/catalog'
import { ChartCard, CopTip, META_MARGEN, CN, CS, CU } from './helpers'

export default function Tab3({ filteredCalcs }) {
  const mensual = useMemo(() => {
    const byM = {}
    filteredCalcs.forEach(({ s, c }) => {
      if (!s.fecha) return
      const d   = new Date(s.fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
      if (!byM[key]) byM[key] = { venta: 0, costo: 0, count: 0, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` }
      byM[key].venta += c.totalVenta
      byM[key].costo += c.totalCosto
      byM[key].count++
    })
    return Object.entries(byM)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        name:   v.label,
        Venta:  v.venta,
        Costo:  v.costo,
        Margen: v.venta > 0 ? parseFloat(((v.venta - v.costo) / v.venta * 100).toFixed(1)) : 0,
      }))
  }, [filteredCalcs])

  const acumulado = useMemo(() => {
    let acum = 0
    return mensual.map(m => { acum += m.Venta; return { ...m, VentaAcum: acum } })
  }, [mensual])

  const noData = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca89c', fontSize: 12 }}>
      Sin datos con fechas registradas
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <ChartCard title="Venta Acumulada por Mes" sub="evolución acumulada del proyecto" height={260}>
        {acumulado.length > 0 ? (
          <LineChart data={acumulado} margin={{ top: 4, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" />
            <YAxis tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} tick={{ fontSize: 9 }} width={52} />
            <Tooltip content={<CopTip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="VentaAcum" name="Venta Acumulada" stroke={CN} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Venta"     name="Venta Mensual"   stroke={CN} strokeWidth={1} strokeDasharray="4 2" dot={{ r: 2 }} />
          </LineChart>
        ) : noData}
      </ChartCard>

      <ChartCard title="Margen Promedio Mensual" sub="% de margen por período" height={240}>
        {mensual.length > 0 ? (
          <LineChart data={mensual} margin={{ top: 4, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" />
            <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 9 }} width={38} />
            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Margen']} labelStyle={{ fontWeight: 700, fontSize: 11 }} />
            <ReferenceLine y={META_MARGEN} stroke={CU} strokeDasharray="5 3"
              label={{ value: `Meta ${META_MARGEN}%`, position: 'left', fontSize: 9, fill: CU }} />
            <Line type="monotone" dataKey="Margen" name="Margen %" stroke={CS} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        ) : noData}
      </ChartCard>

    </div>
  )
}
