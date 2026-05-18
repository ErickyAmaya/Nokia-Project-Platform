import { useMemo } from 'react'
import { useHwStore } from '../../store/useHwStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const C = {
  green:  '#1a9c1a',
  dark:   '#144E4A',
  blue:   '#1d4ed8',
  amber:  '#d68910',
  red:    '#c0392b',
  gray:   '#6b7280',
  purple: '#7c3aed',
  teal:   '#0d9488',
}

const ESTADO_LABEL = {
  en_bodega:      'En Bodega',
  en_sitio:       'En Sitio',
  despachado:     'Despachado',
  en_reparacion:  'En Reparación',
  retornado_nokia:'Retornado Nokia',
  retornado_ss:   'Retornado SS',
  en_transito:    'En Tránsito',
}

const ESTADO_COLOR = {
  en_bodega:      C.green,
  en_sitio:       C.blue,
  despachado:     C.teal,
  en_reparacion:  C.amber,
  retornado_nokia:C.gray,
  retornado_ss:   C.purple,
  en_transito:    C.dark,
}

function KpiCard({ label, value, color = C.dark, sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, borderLeft: `4px solid ${color}`,
      padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: '#555f55', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9, color: '#9ca89c', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
      fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
      color: '#555f55', marginBottom: 6, marginTop: 4,
    }}>
      {children}
    </div>
  )
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function HwDashboard() {
  const hwEquipos     = useHwStore(s => s.hwEquipos)
  const hwMovimientos = useHwStore(s => s.hwMovimientos)
  const hwFallas      = useHwStore(s => s.hwFallas)
  const hwCatalogo    = useHwStore(s => s.hwCatalogo)

  // KPIs
  const totalEquipos   = hwEquipos.length
  const enBodega       = hwEquipos.filter(e => e.estado === 'en_bodega').length
  const enSitio        = hwEquipos.filter(e => e.estado === 'en_sitio' || e.estado === 'despachado').length
  const enReparacion   = hwEquipos.filter(e => e.estado === 'en_reparacion').length
  const totalFallas    = hwFallas.length

  const ahora = new Date()
  const movMes = useMemo(() => hwMovimientos.filter(m => {
    const d = new Date(m.created_at)
    return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth()
  }).length, [hwMovimientos])

  // Distribución por estado (pie)
  const pieData = useMemo(() => {
    const counts = {}
    hwEquipos.forEach(e => {
      const k = e.estado || 'sin_estado'
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: ESTADO_LABEL[k] || k, value: v, color: ESTADO_COLOR[k] || C.gray }))
      .sort((a, b) => b.value - a.value)
  }, [hwEquipos])

  // Movimientos por mes (últimos 6 meses)
  const barData = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const entradas = hwMovimientos.filter(mv => {
        const dd = new Date(mv.created_at)
        return dd.getFullYear() === y && dd.getMonth() === m && mv.tipo === 'ENTRADA'
      }).length
      const salidas = hwMovimientos.filter(mv => {
        const dd = new Date(mv.created_at)
        return dd.getFullYear() === y && dd.getMonth() === m && mv.tipo === 'SALIDA'
      }).length
      result.push({ mes: MESES[m], entradas, salidas })
    }
    return result
  }, [hwMovimientos])

  // Alertas inteligentes de stock
  const alertas = useMemo(() => {
    const SEMANAS = 8
    const desde = new Date()
    desde.setDate(desde.getDate() - SEMANAS * 7)

    return hwCatalogo.map(cat => {
      // Solo tipos con historial de salidas (base para calcular velocidad y alertar)
      const tieneActividad = hwMovimientos.some(m => m.catalogo_id === cat.id && m.tipo === 'SALIDA')
      if (!tieneActividad) return null

      const equipos = hwEquipos.filter(e => e.catalogo_id === cat.id)
      const stock   = equipos.filter(e => e.estado === 'en_bodega').length

      // Velocidad de salida: promedio semanal en las últimas SEMANAS semanas
      const salidaReciente = hwMovimientos
        .filter(m => m.catalogo_id === cat.id && m.tipo === 'SALIDA' &&
          new Date(m.fecha || m.created_at) >= desde)
        .reduce((s, m) => s + (m.cantidad || 1), 0)
      const velSemanal = salidaReciente / SEMANAS   // ud/semana

      // Días de stock restantes según velocidad actual
      const diasStock = velSemanal > 0 ? (stock / velSemanal) * 7 : null

      let nivel = null
      if (stock === 0) {
        nivel = 'agotado'
      } else if (diasStock !== null && diasStock < 7) {
        nivel = 'critico'
      } else if (diasStock !== null && diasStock < 21) {
        nivel = 'bajo'
      }

      if (!nivel) return null
      return { cat, stock, nivel, velSemanal, diasStock }
    })
    .filter(Boolean)
    .sort((a, b) => ({ agotado:0, critico:1, bajo:2 }[a.nivel] ?? 9) - ({ agotado:0, critico:1, bajo:2 }[b.nivel] ?? 9))
  }, [hwCatalogo, hwEquipos, hwMovimientos])

  // Últimos 10 movimientos
  const ultMovimientos = useMemo(() =>
    [...hwMovimientos]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
  , [hwMovimientos])

  function getCatNombre(catalogo_id) {
    return hwCatalogo.find(c => c.id === catalogo_id)?.descripcion || '—'
  }

  return (
    <div>
      {/* KPIs (sticky) */}
      <div style={{ position:'sticky', top:'calc(124px + env(safe-area-inset-top))', zIndex:15,
        background:'#f0f2f0', paddingTop:8, paddingBottom:8, marginBottom:8, boxShadow:'0 2px 8px rgba(0,0,0,.07)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:10 }}>
          <KpiCard label="Total Equipos"    value={totalEquipos}   color={C.dark}   />
          <KpiCard label="En Bodega"        value={enBodega}       color={C.green}  />
          <KpiCard label="En Sitio"         value={enSitio}        color={C.blue}   />
          <KpiCard label="En Reparación"    value={enReparacion}   color={C.amber}  />
          <KpiCard label="Fallas Registradas" value={totalFallas}  color={C.red}    />
          <KpiCard label="Movimientos (Mes)" value={movMes}        color={C.teal}   />
          {alertas.length > 0 && (
            <KpiCard label="Alertas Stock"  value={alertas.length} color={C.red}    />
          )}
        </div>
      </div>

      {/* Gráficas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Bar chart */}
        <div style={{ background: '#fff', borderRadius: 8, padding: '14px 10px 8px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#555f55', marginBottom: 10, paddingLeft: 4 }}>
            Movimientos — últimos 6 meses
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} barSize={10}>
              <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="entradas" name="Entradas" fill={C.green}  radius={[2,2,0,0]} />
              <Bar dataKey="salidas"  name="Salidas"  fill={C.amber}  radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div style={{ background: '#fff', borderRadius: 8, padding: '14px 10px 8px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#555f55', marginBottom: 10, paddingLeft: 4 }}>
            Distribución por Estado
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="40%" cy="50%" outerRadius={60} label={false}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span style={{ fontSize: 9, color: '#555f55' }}>{value}</span>}
                  iconSize={8}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4c0', fontSize: 12 }}>
              Sin equipos registrados
            </div>
          )}
        </div>
      </div>

      {/* ── Alertas de Stock ── */}
      {alertas.length > 0 && (<>
        <SectionTitle>Alertas de Stock ({alertas.length})</SectionTitle>
        <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 4px rgba(0,0,0,.06)', overflow:'hidden', marginBottom:20 }}>
          <div style={{ background:'#c0392b', padding:'8px 14px' }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:12,
              color:'#fff', letterSpacing:1, textTransform:'uppercase' }}>
              Alertas — Bajo Stock &amp; Agotados ({alertas.length})
            </span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr style={{ background:'#fdf2f2', borderBottom:'1.5px solid #fca5a5' }}>
                  {['Tipo de Equipo','Stock Bodega','Vel. Salida (prom. 8 sem)','Proyección','Nivel'].map(h => (
                    <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontWeight:700, fontSize:9,
                      letterSpacing:.8, textTransform:'uppercase', color:'#c0392b', whiteSpace:'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertas.map((a, i) => {
                  const nivelCfg = a.nivel === 'agotado'
                    ? { bg:'#fde8e7', color:'#c0392b', label:'Agotado'    }
                    : a.nivel === 'critico'
                    ? { bg:'#fff1f2', color:'#be123c', label:'Crítico'    }
                    : { bg:'#fef3cd', color:'#856404', label:'Bajo Stock' }
                  return (
                    <tr key={a.cat.id} style={{ borderBottom:'1px solid #fef2f2', background: i%2===0?'#fff':'#fff8f8' }}>
                      <td style={{ padding:'8px 12px', fontWeight:600 }}>{a.cat.descripcion}</td>
                      <td style={{ padding:'8px 12px', fontFamily:"'Barlow Condensed',sans-serif",
                        fontWeight:800, fontSize:15,
                        color: a.stock === 0 ? C.red : C.blue }}>
                        {a.stock}
                      </td>
                      <td style={{ padding:'8px 12px', color:'#6b7280' }}>
                        {a.velSemanal > 0
                          ? <><strong style={{ color:'#374151' }}>{a.velSemanal.toFixed(1)}</strong> ud/sem</>
                          : <span style={{ color:'#d1d5db' }}>sin datos recientes</span>
                        }
                      </td>
                      <td style={{ padding:'8px 12px',
                        color: a.diasStock === null ? '#d1d5db' : a.diasStock < 7 ? C.red : C.amber,
                        fontWeight: a.diasStock !== null ? 700 : 400 }}>
                        {a.diasStock !== null ? `~${Math.round(a.diasStock)} días` : '—'}
                      </td>
                      <td style={{ padding:'8px 12px' }}>
                        <span style={{ padding:'2px 9px', borderRadius:10, fontSize:9, fontWeight:700,
                          background:nivelCfg.bg, color:nivelCfg.color }}>
                          {nivelCfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding:'6px 12px', fontSize:9, color:'#9ca89c', borderTop:'1px solid #fef2f2', background:'#fffcfc' }}>
            Velocidad = salidas de las últimas 8 semanas ÷ 8 · Proyección = stock ÷ vel/sem × 7 días
            · Crítico: &lt;7d · Bajo: &lt;21d
          </div>
        </div>
      </>)}

      {/* Últimos movimientos */}
      <SectionTitle>Últimos Movimientos</SectionTitle>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        {ultMovimientos.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca89c', fontSize: 12 }}>
            Sin movimientos registrados
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f8faf8', borderBottom: '1.5px solid #e0e4e0' }}>
                  {['Documento','Tipo','Equipo','Origen','Destino','Fecha'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 9, letterSpacing: .8, textTransform: 'uppercase', color: '#555f55', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultMovimientos.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f0f2f0', background: i % 2 === 0 ? '#fff' : '#fafbfa' }}>
                    <td style={{ padding: '6px 10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: '#144E4A', whiteSpace: 'nowrap' }}>
                      {m.so || '—'}
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                        background: m.tipo === 'ENTRADA' ? '#dcfce7' : '#fef9c3',
                        color:      m.tipo === 'ENTRADA' ? C.green   : '#92400e',
                      }}>
                        {m.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', color: '#3f3f46' }}>
                      {getCatNombre(m.catalogo_id)}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {m.origen || '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {m.destino || '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {m.fecha || m.created_at?.slice(0,10) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
