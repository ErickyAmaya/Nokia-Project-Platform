import { useMemo, useState, useEffect, useRef } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const C = {
  green:  '#1a9c1a',
  dark:   '#144E4A',
  purple: '#7c3aed',
  blue:   '#1d4ed8',
  amber:  '#d68910',
  red:    '#c0392b',
  teal:   '#0d9488',
}
const PIE_COLORS  = [C.dark, C.purple, C.blue, C.amber, C.red, C.green]
const STATUS_COLORS = [C.green, C.amber, C.red]

function KpiCard({ label, value, color = C.dark }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, borderLeft:`4px solid ${color}`, padding:'12px 14px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize:8, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#555f55', marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:22, color, lineHeight:1 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:1.2, textTransform:'uppercase', color:'#555f55', marginBottom:6, marginTop:4 }}>
      {children}
    </div>
  )
}

export default function MatDashboard() {
  const catalogo    = useMatStore(s => s.catalogo)
  const stock       = useMatStore(s => s.stock)
  const movimientos = useMatStore(s => s.movimientos)
  const despachos   = useMatStore(s => s.despachos)
  const bodegas     = useMatStore(s => s.bodegas)
  const getStock    = useMatStore(s => s.getStock)

  const location   = useLocation()
  const navigate   = useNavigate()
  const alertasRef = useRef(null)
  const [flashId, setFlashId] = useState(null)

  const [filCat,   setFilCat]   = useState('')  // '' | 'TI' | 'CW'
  const [filSitio, setFilSitio] = useState('')  // nombre del sitio destino

  // Highlight desde alerta de stock
  useEffect(() => {
    const hid = location.state?.highlightCatalogId
    if (!hid) return
    // limpiar state para que no re-flashee en hot-reload / back-nav
    navigate(location.pathname, { replace: true, state: {} })
    setFlashId(hid)
    // scroll a la tabla de alertas
    setTimeout(() => {
      const el = document.getElementById(`alert-row-${hid}`) || alertasRef.current
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    // quitar flash tras 2.8 s (4 pulsos × 0.7 s)
    const t = setTimeout(() => setFlashId(null), 2800)
    return () => clearTimeout(t)
  }, [location.state])

  // Sitios destino únicos derivados de movimientos
  const sitiosUnicos = useMemo(() => {
    const set = new Set(movimientos.map(m => m.destino).filter(Boolean))
    return [...set].sort()
  }, [movimientos])

  // Catálogo filtrado (sin proveedores)
  const catFiltrado = useMemo(() =>
    catalogo.filter(c => c.categoria !== 'PROVEEDORES' && (!filCat || c.categoria === filCat))
  , [catalogo, filCat])

  // KPIs
  const kpis = useMemo(() => {
    let valor = 0, enStock = 0, bajoMin = 0, agotados = 0, valTI = 0, valCW = 0

    catFiltrado.forEach(c => {
      const s   = getStock(c.id)
      const imp = s * (c.costo_unitario || 0)
      valor += imp
      if (c.categoria === 'TI') valTI += imp
      if (c.categoria === 'CW') valCW += imp
      if (s === 0)               agotados++
      else if (s < c.stock_minimo) bajoMin++
      else                         enStock++
    })

    const movFil  = movimientos.filter(m => !filCat || catFiltrado.some(c => c.id === m.catalogo_id))
    const movSit  = filSitio ? movFil.filter(m => m.destino === filSitio) : movFil
    const entradas = movSit.filter(m => m.tipo === 'Entrada').reduce((a, m) => a + (m.valor_total || 0), 0)
    const salidas  = movSit.filter(m => m.tipo === 'Salida').reduce((a, m) => a + (m.valor_total || 0), 0)

    return { valor, enStock, bajoMin, agotados, valTI, valCW, entradas, salidas }
  }, [catFiltrado, movimientos, filCat, filSitio, getStock])

  // Pie 1: valor por categoría
  const pieValor = useMemo(() => {
    const map = {}
    catFiltrado.forEach(c => {
      const imp = getStock(c.id) * (c.costo_unitario || 0)
      if (imp > 0) map[c.categoria] = (map[c.categoria] || 0) + imp
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [catFiltrado, stock, getStock])

  // Pie 2: estado del inventario (# materiales)
  const pieEstado = useMemo(() => {
    let enStock = 0, bajoMin = 0, agotados = 0
    catFiltrado.forEach(c => {
      const s = getStock(c.id)
      if (s === 0)               agotados++
      else if (s < c.stock_minimo) bajoMin++
      else                         enStock++
    })
    return [
      { name: 'En Stock',     value: enStock  },
      { name: 'Bajo Mínimo',  value: bajoMin  },
      { name: 'Agotado',      value: agotados },
    ].filter(d => d.value > 0)
  }, [catFiltrado, stock, getStock])

  // Top 10 materiales por importe (stock * precio)
  const top10Importe = useMemo(() =>
    catFiltrado
      .map(c => ({ nombre: c.nombre.length > 28 ? c.nombre.slice(0,28)+'…' : c.nombre, importe: getStock(c.id) * (c.costo_unitario || 0) }))
      .filter(x => x.importe > 0)
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 10)
  , [catFiltrado, stock, getStock])

  // Top 10 materiales más consumidos (salidas acumuladas)
  const top10Consumo = useMemo(() => {
    const map = {}
    movimientos.filter(m => m.tipo === 'Salida').forEach(m => {
      const c = catFiltrado.find(x => x.id === m.catalogo_id)
      if (!c) return
      const key = c.nombre.length > 28 ? c.nombre.slice(0,28)+'…' : c.nombre
      map[key] = (map[key] || 0) + (m.cantidad || 0)
    })
    return Object.entries(map).map(([nombre, cant]) => ({ nombre, cant }))
      .sort((a, b) => b.cant - a.cant).slice(0, 10)
  }, [catFiltrado, movimientos])

  // Entradas vs Salidas por mes
  const monthlyChart = useMemo(() => {
    const map = {}
    movimientos
      .filter(m => !filCat || catFiltrado.some(c => c.id === m.catalogo_id))
      .forEach(m => {
        if (!m.fecha) return
        const mes = m.fecha.slice(0, 7)
        if (!map[mes]) map[mes] = { mes, Entradas: 0, Salidas: 0 }
        if (m.tipo === 'Entrada') map[mes].Entradas += m.valor_total || 0
        else                      map[mes].Salidas  += m.valor_total || 0
      })
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-8)
  }, [movimientos, catFiltrado, filCat])

  // Valor despachado por sitio
  const siteChart = useMemo(() => {
    const map = {}
    movimientos.filter(m => m.tipo === 'Salida' && m.destino).forEach(m => {
      if (filSitio && m.destino !== filSitio) return
      const key = m.destino.length > 22 ? m.destino.slice(0,22)+'…' : m.destino
      map[key] = (map[key] || 0) + (m.valor_total || 0)
    })
    return Object.entries(map).map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8)
  }, [movimientos, filSitio])

  // Top 10 más costosos por precio unitario
  const top10Precio = useMemo(() =>
    catFiltrado
      .filter(c => c.costo_unitario > 0)
      .map(c => ({ nombre: c.nombre.length > 28 ? c.nombre.slice(0,28)+'…' : c.nombre, precio: c.costo_unitario }))
      .sort((a, b) => b.precio - a.precio)
      .slice(0, 10)
  , [catFiltrado])

  // Alertas
  const alertas = useMemo(() =>
    catFiltrado
      .map(c => ({ ...c, stockActual: getStock(c.id) }))
      .filter(c => c.stockActual < c.stock_minimo)
      .sort((a, b) => (a.stockActual / (a.stock_minimo || 1)) - (b.stockActual / (b.stock_minimo || 1)))
  , [catFiltrado, stock, getStock])

  // Últimos movimientos (enriquecidos)
  const ultimos = useMemo(() =>
    movimientos.slice(0, 10).map(m => ({
      ...m,
      catNombre: catalogo.find(c => c.id === m.catalogo_id)?.nombre || '—',
      bodNombre: bodegas.find(b => b.id === m.bodega_id)?.nombre || '—',
    }))
  , [movimientos, catalogo, bodegas])

  // ── Analytics de Proveedores ──────────────────────────────────────

  // Resumen por proveedor: gasto total, materiales distintos, # compras, última compra
  const provResumen = useMemo(() => {
    const proveedores = catalogo.filter(c => c.categoria === 'PROVEEDORES')
    const entradas    = movimientos.filter(m => m.tipo === 'Entrada' && (m.proveedor_id || m.origen))
    return proveedores.map(p => {
      const movs = entradas.filter(m => m.proveedor_id === p.id || (!m.proveedor_id && m.origen === p.nombre))
      if (movs.length === 0) return null
      return {
        nombre:      p.nombre,
        badge:       p.badge,
        compras:     movs.length,
        materiales:  new Set(movs.map(m => m.catalogo_id)).size,
        gastoTotal:  movs.reduce((a, m) => a + (m.valor_total || 0), 0),
        ultimaCompra: movs.map(m => m.fecha).filter(Boolean).sort().reverse()[0] || '—',
      }
    }).filter(Boolean).sort((a, b) => b.gastoTotal - a.gastoTotal)
  }, [catalogo, movimientos])

  // ¿A quién comprarle? — por proveedor, materiales donde tiene el mejor precio promedio
  const aQuienComprar = useMemo(() => {
    const entradas = movimientos.filter(m => m.tipo === 'Entrada' && (m.proveedor_id || m.origen) && m.valor_unitario > 0)
    // Acumular precio promedio por material+proveedor
    const matMap = {}
    entradas.forEach(m => {
      const mat  = catalogo.find(c => c.id === m.catalogo_id)
      if (!mat || mat.categoria === 'PROVEEDORES') return
      const prov     = catalogo.find(c => c.id === m.proveedor_id)
      const provNombre = prov?.nombre || m.origen || '—'
      const pk = m.proveedor_id || m.origen
      if (!matMap[mat.id]) matMap[mat.id] = { matNombre: mat.nombre, provs: {} }
      if (!matMap[mat.id].provs[pk]) matMap[mat.id].provs[pk] = { nombre: provNombre, precios: [] }
      matMap[mat.id].provs[pk].precios.push(m.valor_unitario)
    })
    // Por cada material, encontrar el proveedor con menor precio promedio
    const ganadores = {} // provNombre → [matNombre, ...]
    Object.values(matMap).forEach(({ matNombre, provs }) => {
      const lista = Object.values(provs).map(p => ({
        nombre: p.nombre,
        avg:    p.precios.reduce((a, b) => a + b, 0) / p.precios.length,
      })).sort((a, b) => a.avg - b.avg)
      // Solo asignar "mejor" si hay al menos 2 proveedores para ese material
      if (lista.length < 2) return
      const mejor = lista[0].nombre
      if (!ganadores[mejor]) ganadores[mejor] = []
      ganadores[mejor].push({ mat: matNombre, precio: lista[0].avg, vsSegundo: lista[1].avg })
    })
    return Object.entries(ganadores)
      .map(([proveedor, materiales]) => ({ proveedor, materiales: materiales.sort((a, b) => a.mat.localeCompare(b.mat)) }))
      .sort((a, b) => b.materiales.length - a.materiales.length)
  }, [catalogo, movimientos])

  const tooltipStyle = { fontSize: 11, fontFamily:"'Barlow',sans-serif" }

  return (
    <div>
      {/* ── Barra de filtros ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e4e0', borderRadius:8, padding:'8px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#9ca89c' }}>Filtrar por</span>
        <select className="fc" value={filSitio} onChange={e => setFilSitio(e.target.value)} style={{ maxWidth:200, fontSize:11 }}>
          <option value="">Todos los sitios</option>
          {sitiosUnicos.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="fc" value={filCat} onChange={e => setFilCat(e.target.value)} style={{ maxWidth:180, fontSize:11 }}>
          <option value="">Todos los materiales</option>
          <option value="TI">TI</option>
          <option value="CW">CW</option>
        </select>
        {(filSitio || filCat) && (
          <button onClick={() => { setFilSitio(''); setFilCat('') }}
            style={{ fontSize:10, fontWeight:700, color:'#c0392b', background:'none', border:'none', cursor:'pointer', padding:'2px 6px' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* ── KPIs fila 1 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:10 }}>
        <KpiCard label="Valor Inventario Total" value={matCop(kpis.valor)}    color={C.blue}   />
        <KpiCard label="En Stock"               value={kpis.enStock}           color={C.green}  />
        <KpiCard label="Bajo Mínimo"            value={kpis.bajoMin}           color={C.amber}  />
        <KpiCard label="Agotados"               value={kpis.agotados}          color={C.red}    />
      </div>

      {/* ── KPIs fila 2 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        <KpiCard label="Valor Inventario TI"  value={matCop(kpis.valTI)}    color={C.dark}   />
        <KpiCard label="Valor Inventario CW"  value={matCop(kpis.valCW)}    color={C.purple} />
        <KpiCard label="Total Entradas"       value={matCop(kpis.entradas)} color={C.green}  />
        <KpiCard label="Total Salidas"        value={matCop(kpis.salidas)}  color={C.red}    />
      </div>

      {/* ── Analytics de Proveedores ── */}
      <SectionTitle>Analytics de Proveedores</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>

        {/* Resumen por proveedor */}
        <div className="card">
          <div className="card-h" style={{ borderBottom:'2px solid #fed7aa' }}>
            <h2 style={{ color:'#9a3412' }}>Resumen por Proveedor</h2>
          </div>
          <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
            {provResumen.length === 0 ? (
              <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:11 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📦</div>
                Registra entradas con proveedor para ver analytics
              </div>
            ) : (
              <table className="tbl">
                <thead><tr>
                  <th>Proveedor</th>
                  <th className="num">Compras</th>
                  <th className="num">Materiales</th>
                  <th className="num">Gasto Total</th>
                  <th>Última Compra</th>
                </tr></thead>
                <tbody>
                  {provResumen.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:700, fontSize:11 }}>
                        {p.nombre}
                        {i === 0 && provResumen.length > 1 && (
                          <span style={{ marginLeft:5, fontSize:8, fontWeight:700, background:'#dcfce7', color:'#166534', border:'1px solid #bbf7d0', borderRadius:10, padding:'1px 6px', verticalAlign:'middle' }}>
                            PRINCIPAL
                          </span>
                        )}
                      </td>
                      <td className="num" style={{ fontSize:11 }}>{p.compras}</td>
                      <td className="num" style={{ fontSize:11 }}>{p.materiales}</td>
                      <td className="num" style={{ fontWeight:700, color:C.dark, fontSize:11 }}>{matCop(p.gastoTotal)}</td>
                      <td style={{ fontSize:10, color:'#555f55' }}>{p.ultimaCompra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ¿A quién comprarle? */}
        <div className="card">
          <div className="card-h" style={{ borderBottom:'2px solid #bbf7d0' }}>
            <h2 style={{ color:'#166534' }}>¿A quién comprarle?</h2>
          </div>
          <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
            {aQuienComprar.length === 0 ? (
              <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:11 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>🏷️</div>
                Registra el mismo material con al menos 2 proveedores distintos para ver sugerencias
              </div>
            ) : (
              <table className="tbl">
                <thead><tr>
                  <th>Proveedor</th>
                  <th>Mejores precios en…</th>
                  <th className="num">Materiales</th>
                </tr></thead>
                <tbody>
                  {aQuienComprar.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight:700, fontSize:11, whiteSpace:'nowrap' }}>
                        {i === 0 && (
                          <span style={{ display:'block', fontSize:8, fontWeight:700, color:C.green, letterSpacing:.8, textTransform:'uppercase', marginBottom:2 }}>
                            ★ Recomendado
                          </span>
                        )}
                        {row.proveedor}
                      </td>
                      <td style={{ fontSize:10 }}>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {row.materiales.map((m, j) => (
                            <span key={j} style={{
                              background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0',
                              borderRadius:10, padding:'2px 8px', fontSize:9, fontWeight:600,
                              whiteSpace:'nowrap',
                            }}>
                              {m.mat}
                              <span style={{ color:'#9ca89c', marginLeft:4 }}>{matCop(m.precio)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="num" style={{ fontWeight:700, fontSize:13, color:C.dark }}>
                        {row.materiales.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Pie charts ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div className="card">
          <div className="card-h"><h2>Valor Inventariado por Categoría</h2></div>
          <div className="card-b">
            {pieValor.length === 0
              ? <div style={{ textAlign:'center', padding:40, color:'#9ca89c', fontSize:12 }}>Sin datos</div>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieValor} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                      labelLine={false}>
                      {pieValor.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => matCop(v)} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h2>Estado del Inventario (# Materiales)</h2></div>
          <div className="card-b">
            {pieEstado.length === 0
              ? <div style={{ textAlign:'center', padding:40, color:'#9ca89c', fontSize:12 }}>Sin datos</div>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}>
                      {pieEstado.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize:10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>
      </div>

      {/* ── Top 10 por importe ── */}
      <SectionTitle>Top 10 Materiales por Importe</SectionTitle>
      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-b">
          {top10Importe.length === 0
            ? <div style={{ textAlign:'center', padding:24, color:'#9ca89c', fontSize:12 }}>Sin datos</div>
            : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={top10Importe} layout="vertical" margin={{ left:8, right:24, top:4, bottom:4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nombre" width={200} tick={{ fontSize:9 }} />
                  <Tooltip formatter={v => matCop(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="importe" fill={C.dark} radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* ── Entradas vs Salidas por mes ── */}
      <SectionTitle>Entradas vs Salidas por Mes</SectionTitle>
      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-b">
          {monthlyChart.length === 0
            ? <div style={{ textAlign:'center', padding:24, color:'#9ca89c', fontSize:12 }}>Sin movimientos registrados</div>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyChart} margin={{ left:8, right:16, top:4, bottom:4 }}>
                  <XAxis dataKey="mes" tick={{ fontSize:9 }} />
                  <YAxis hide />
                  <Tooltip formatter={v => matCop(v)} contentStyle={tooltipStyle} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize:10 }} />
                  <Bar dataKey="Entradas" fill={C.green}  radius={[3,3,0,0]} />
                  <Bar dataKey="Salidas"  fill={C.red}    radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* ── Valor Despachado por Sitio + Top 10 consumo ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div className="card">
          <div className="card-h"><h2>Valor Despachado por Sitio</h2></div>
          <div className="card-b">
            {siteChart.length === 0
              ? <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:12 }}>Sin despachos</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={siteChart} layout="vertical" margin={{ left:8, right:24 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize:9 }} />
                    <Tooltip formatter={v => matCop(v)} contentStyle={tooltipStyle} />
                    <Bar dataKey="valor" fill={C.teal} radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h2>Top 10 más Consumidos (Salidas Acumuladas)</h2></div>
          <div className="card-b">
            {top10Consumo.length === 0
              ? <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:12 }}>Sin salidas</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={top10Consumo} layout="vertical" margin={{ left:8, right:24 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nombre" width={150} tick={{ fontSize:9 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="cant" name="Unidades" fill={C.purple} radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>
      </div>

      {/* ── Top 10 más costosos por precio unitario ── */}
      <SectionTitle>Top 10 Materiales más Costosos (Precio Unitario del Catálogo)</SectionTitle>
      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-b">
          {top10Precio.length === 0
            ? <div style={{ textAlign:'center', padding:24, color:'#9ca89c', fontSize:12 }}>Sin datos</div>
            : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={top10Precio} layout="vertical" margin={{ left:8, right:24, top:4, bottom:4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nombre" width={200} tick={{ fontSize:9 }} />
                  <Tooltip formatter={v => matCop(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="precio" name="Precio Unitario" fill={C.amber} radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* ── Alertas ── */}
      {alertas.length > 0 && (
        <div ref={alertasRef} className="card" style={{ marginBottom:12 }}>
          <div className="card-h" style={{ background:'#c0392b', borderRadius:'8px 8px 0 0' }}>
            <h2 style={{ color:'#fff' }}>Alertas — Bajo Mínimo &amp; Agotados ({alertas.length})</h2>
          </div>
          <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Material</th><th>Stock (Bodega)</th><th>CAT.</th>
                <th className="num">Stock Actual</th><th className="num">Mínimo</th><th>Status</th>
              </tr></thead>
              <tbody>
                {alertas.map(c => {
                  const isFlash = flashId === c.id
                  // Mostrar por bodega
                  const stockRows = bodegas.map(b => ({ bod: b, s: getStock(c.id, b.id) })).filter(x => x.s < c.stock_minimo)
                  return stockRows.length > 0 ? stockRows.map(({ bod, s }, ri) => (
                    <tr key={`${c.id}-${bod.id}`}
                      id={ri === 0 ? `alert-row-${c.id}` : undefined}
                      className={isFlash ? 'row-flash' : ''}>
                      <td style={{ fontWeight:600, fontSize:11 }}>{c.nombre}</td>
                      <td style={{ fontSize:11, color:'#9ca89c' }}>{bod.nombre}</td>
                      <td><span className="badge" style={{ background:c.categoria==='TI'?'#f0fdf4':'#faf5ff', color:c.categoria==='TI'?'#166534':'#5b21b6' }}>{c.categoria}</span></td>
                      <td className="num" style={{ fontWeight:700, color:s===0?C.red:C.amber }}>{s}</td>
                      <td className="num" style={{ color:'#9ca89c' }}>{c.stock_minimo}</td>
                      <td>
                        <span className="badge" style={{ background:s===0?'#fde8e7':'#fef3cd', color:s===0?C.red:C.amber }}>
                          {s===0?'Agotado':'Bajo Mínimo'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr key={c.id}
                      id={`alert-row-${c.id}`}
                      className={isFlash ? 'row-flash' : ''}>
                      <td style={{ fontWeight:600, fontSize:11 }}>{c.nombre}</td>
                      <td style={{ fontSize:11, color:'#9ca89c' }}>—</td>
                      <td><span className="badge" style={{ background:c.categoria==='TI'?'#f0fdf4':'#faf5ff', color:c.categoria==='TI'?'#166534':'#5b21b6' }}>{c.categoria}</span></td>
                      <td className="num" style={{ fontWeight:700, color:C.red }}>{c.stockActual}</td>
                      <td className="num">{c.stock_minimo}</td>
                      <td><span className="badge" style={{ background:'#fde8e7', color:C.red }}>Agotado</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Últimos Movimientos ── */}
      <div className="card">
        <div className="card-h"><h2>Últimos Movimientos</h2></div>
        <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr>
              <th>Fecha</th><th>Doc</th><th>Material</th>
              <th>Tipo</th><th className="num">Cant.</th><th className="num">Valor</th>
              <th>Origen + Destino</th><th>Bodega</th>
            </tr></thead>
            <tbody>
              {ultimos.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'#9ca89c' }}>Sin movimientos</td></tr>
              )}
              {ultimos.map(m => {
                const orDest = [m.origen, m.destino].filter(Boolean).join(' = ')
                return (
                  <tr key={m.id}>
                    <td style={{ color:'#9ca89c', fontSize:10, whiteSpace:'nowrap' }}>{m.fecha}</td>
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11 }}>{m.numero_doc}</td>
                    <td style={{ fontWeight:600, fontSize:11 }}>{m.catNombre}</td>
                    <td>
                      <span style={{ color:m.tipo==='Entrada'?C.green:C.red, fontWeight:700, fontSize:10 }}>{m.tipo}</span>
                    </td>
                    <td className="num" style={{ fontWeight:700 }}>{m.cantidad}</td>
                    <td className="num" style={{ color:C.dark, fontWeight:700, fontSize:11 }}>{matCop(m.valor_total)}</td>
                    <td style={{ fontSize:10, color:'#9ca89c' }}>{orDest || '—'}</td>
                    <td style={{ fontSize:10, color:'#555f55' }}>{m.bodNombre}</td>
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
