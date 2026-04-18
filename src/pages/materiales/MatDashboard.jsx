import { useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const COLORS = ['#144E4A','#7c3aed','#1d4ed8','#d68910','#c0392b','#22c55e']

function KpiCard({ label, value, sub, color = '#144E4A' }) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="card-b" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#555f55', marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 28, color, lineHeight: 1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function MatDashboard() {
  const catalogo    = useMatStore(s => s.catalogo)
  const stock       = useMatStore(s => s.stock)
  const movimientos = useMatStore(s => s.movimientos)
  const getStock    = useMatStore(s => s.getStock)

  const kpis = useMemo(() => {
    let valor = 0, enStock = 0, bajoMin = 0, agotados = 0
    let valTI = 0, valCW = 0

    catalogo.forEach(c => {
      const s = getStock(c.id)
      const imp = s * (c.costo_unitario || 0)
      valor += imp
      if (c.categoria === 'TI') valTI += imp
      if (c.categoria === 'CW') valCW += imp
      if (s === 0)              agotados++
      else if (s < c.stock_minimo) bajoMin++
      else                         enStock++
    })

    const entradas = movimientos.filter(m => m.tipo === 'Entrada').reduce((a, m) => a + (m.valor_total || 0), 0)
    const salidas  = movimientos.filter(m => m.tipo === 'Salida').reduce((a, m) => a + (m.valor_total || 0), 0)

    return { valor, enStock, bajoMin, agotados, valTI, valCW, entradas, salidas }
  }, [catalogo, stock, movimientos, getStock])

  // Datos gráfica por categoría
  const pieData = useMemo(() => {
    const map = {}
    catalogo.forEach(c => {
      const imp = getStock(c.id) * (c.costo_unitario || 0)
      map[c.categoria] = (map[c.categoria] || 0) + imp
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)
  }, [catalogo, stock, getStock])

  // Top 10 materiales por importe
  const top10 = useMemo(() => {
    return catalogo
      .map(c => ({ nombre: c.nombre.length > 22 ? c.nombre.slice(0, 22) + '…' : c.nombre, importe: getStock(c.id) * (c.costo_unitario || 0) }))
      .filter(x => x.importe > 0)
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 10)
  }, [catalogo, stock, getStock])

  // Alertas
  const alertas = useMemo(() => {
    return catalogo
      .map(c => ({ ...c, stockActual: getStock(c.id) }))
      .filter(c => c.stockActual < c.stock_minimo)
      .sort((a, b) => (a.stockActual / (a.stock_minimo || 1)) - (b.stockActual / (b.stock_minimo || 1)))
  }, [catalogo, stock, getStock])

  // Últimos 10 movimientos
  const ultimos = movimientos.slice(0, 10)

  return (
    <div>
      <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16, color: '#144E4A' }}>
        Dashboard — Materiales
      </h1>

      {/* KPIs fila 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
        <KpiCard label="Valor Inventario Total" value={matCop(kpis.valor)}  color="#1d4ed8" />
        <KpiCard label="En Stock"    value={kpis.enStock}  sub="materiales ≥ mínimo"  color="#1a7a1a" />
        <KpiCard label="Bajo Mínimo" value={kpis.bajoMin}  sub="stock > 0 pero < mínimo" color="#d68910" />
        <KpiCard label="Agotados"    value={kpis.agotados} sub="stock = 0"             color="#c0392b" />
      </div>

      {/* KPIs fila 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Valor Inventario TI" value={matCop(kpis.valTI)} color="#144E4A" />
        <KpiCard label="Valor Inventario CW" value={matCop(kpis.valCW)} color="#7c3aed" />
        <KpiCard label="Total Entradas" value={matCop(kpis.entradas)} color="#1a7a1a" />
        <KpiCard label="Total Salidas"  value={matCop(kpis.salidas)}  color="#c0392b" />
      </div>

      {/* Gráficas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card">
          <div className="card-h"><h2>Valor por Categoría</h2></div>
          <div className="card-b">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => matCop(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h2>Top 10 por Importe</h2></div>
          <div className="card-b">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nombre" width={160} tick={{ fontSize: 9 }} />
                <Tooltip formatter={v => matCop(v)} />
                <Bar dataKey="importe" fill="#144E4A" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h" style={{ background: '#c0392b' }}>
            <h2>Alertas — Bajo Mínimo &amp; Agotados ({alertas.length})</h2>
          </div>
          <div className="card-b" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Material</th><th>Código</th><th>Cat.</th>
                <th className="num">Stock Actual</th><th className="num">Mínimo</th><th>Status</th>
              </tr></thead>
              <tbody>
                {alertas.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ color: '#9ca89c' }}>{c.codigo}</td>
                    <td><span className="badge" style={{ background: c.categoria==='TI'?'#f0fdf4':'#faf5ff', color: c.categoria==='TI'?'#166534':'#5b21b6' }}>{c.categoria}</span></td>
                    <td className="num" style={{ fontWeight: 700, color: c.stockActual===0?'#c0392b':'#d68910' }}>{c.stockActual}</td>
                    <td className="num">{c.stock_minimo}</td>
                    <td>
                      <span className="badge" style={{ background: c.stockActual===0?'#fde8e7':'#fef3cd', color: c.stockActual===0?'#c0392b':'#856404' }}>
                        {c.stockActual===0?'Agotado':'Bajo Mínimo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Últimos movimientos */}
      <div className="card">
        <div className="card-h"><h2>Últimos Movimientos</h2></div>
        <div className="card-b" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr>
              <th>Fecha</th><th>Doc</th><th>Material</th>
              <th>Tipo</th><th className="num">Cantidad</th><th className="num">Valor</th>
            </tr></thead>
            <tbody>
              {ultimos.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#9ca89c' }}>Sin movimientos</td></tr>
              )}
              {ultimos.map(m => {
                const cat = useMatStore.getState().catalogo.find(c => c.id === m.catalogo_id)
                return (
                  <tr key={m.id}>
                    <td style={{ color: '#9ca89c' }}>{m.fecha}</td>
                    <td style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{m.numero_doc}</td>
                    <td style={{ fontWeight: 600 }}>{cat?.nombre || m.catalogo_id}</td>
                    <td>
                      <span style={{ color: m.tipo==='Entrada'?'#1a7a1a':'#c0392b', fontWeight: 700 }}>{m.tipo}</span>
                    </td>
                    <td className="num">{m.cantidad}</td>
                    <td className="num">{matCop(m.valor_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
