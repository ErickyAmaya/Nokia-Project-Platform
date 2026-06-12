import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell,
} from 'recharts'
import { cop, MESES } from '../../lib/catalog'
import { ChartCard, TipBox, CN, CS, CU, CR } from './helpers'

function LCProdTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TipBox
      label={label}
      rows={[
        { name: 'Producción',    val: cop(d.value), color: d.fill },
        { name: 'Participación', val: payload[0]?.payload?.pct != null ? `${(payload[0].payload.pct * 100).toFixed(1)}%` : '' },
      ]}
    />
  )
}

export default function Tab5({ filteredCalcs, subcs }) {
  const [expandedLC, setExpandedLC] = useState(new Set())

  function mesKey(fecha, offset = 0) {
    if (!fecha) return null
    const [y, m] = fecha.split('-').map(Number)
    const d = new Date(y, m - 1 + offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  function mesLabel(k) {
    const [y, m] = k.split('-').map(Number)
    return `${MESES[m - 1].toUpperCase()} ${String(y).slice(2)}`
  }

  const { meses, cuadMatrix, cuadrillas, lcRows } = useMemo(() => {
    const mesSet   = new Set()
    const cuadAcc  = {}
    const lcAcc    = {}

    filteredCalcs.forEach(({ s, c }) => {
      if (!s.fecha) return
      const pct1  = s.pct_m1 ?? 100
      const pct2  = 100 - pct1
      const cuad  = subcs.find(x => x.lc === s.lc)?.tipoCuadrilla || s.lc || 'Sin cuadrilla'
      const lc    = s.lc || 'Sin LC'
      const k1    = mesKey(s.fecha, 0)
      const k2    = pct2 > 0 ? mesKey(s.fecha, 1) : null
      const v1    = c.totalVenta * pct1 / 100
      const v2    = c.totalVenta * pct2 / 100

      mesSet.add(k1)
      if (k2) mesSet.add(k2)

      if (!cuadAcc[cuad]) cuadAcc[cuad] = {}
      cuadAcc[cuad][k1] = cuadAcc[cuad][k1] || { venta: 0, sitios: 0 }
      cuadAcc[cuad][k1].venta  += v1
      cuadAcc[cuad][k1].sitios += 1
      if (k2) {
        cuadAcc[cuad][k2] = cuadAcc[cuad][k2] || { venta: 0, sitios: 0 }
        cuadAcc[cuad][k2].venta += v2
      }

      if (!lcAcc[lc]) lcAcc[lc] = { cuad, meses: {}, sitios: [] }
      lcAcc[lc].meses[k1] = (lcAcc[lc].meses[k1] || 0) + v1
      if (k2) lcAcc[lc].meses[k2] = (lcAcc[lc].meses[k2] || 0) + v2
      lcAcc[lc].sitios.push({ s, c, pct1, pct2, k1, k2, v1, v2 })
    })

    const meses      = [...mesSet].sort()
    const cuadrillas = [...new Set(Object.keys(cuadAcc))].sort()
    const lcRows     = Object.entries(lcAcc).sort((a, b) => {
      const tA = Object.values(a[1].meses).reduce((s, v) => s + v, 0)
      const tB = Object.values(b[1].meses).reduce((s, v) => s + v, 0)
      return tB - tA
    })

    return { meses, cuadMatrix: cuadAcc, cuadrillas, lcRows }
  }, [filteredCalcs, subcs])

  const totalesMes = useMemo(() =>
    Object.fromEntries(meses.map(mes => [
      mes,
      cuadrillas.reduce((s, c) => s + (cuadMatrix[c]?.[mes]?.venta || 0), 0),
    ]))
  , [meses, cuadrillas, cuadMatrix])

  const { chartData, totalGeneral, avgVenta } = useMemo(() => {
    const rows = lcRows.map(([lc, data]) => ({
      name:     lc.length > 22 ? lc.slice(0, 20) + '…' : lc,
      fullName: lc,
      venta:    Object.values(data.meses).reduce((s, v) => s + v, 0),
    }))
    const total = rows.reduce((s, r) => s + r.venta, 0)
    const avg   = rows.length ? total / rows.length : 0
    const withPct = rows.map(r => ({ ...r, pct: total > 0 ? r.venta / total : 0 }))
    return { chartData: withPct, totalGeneral: total, avgVenta: avg }
  }, [lcRows])

  if (!meses.length) return (
    <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:12 }}>
      Sin sitios con fecha en el período seleccionado.
    </div>
  )

  const thStyle = { minWidth: 110, whiteSpace: 'nowrap' }

  function CeldaVal({ venta, sub }) {
    if (!venta) return <span style={{ color:'#e0e4e0' }}>—</span>
    return (
      <div>
        <div style={{ fontWeight:700, fontSize:11, color: CN }}>{cop(venta)}</div>
        {sub && <div style={{ fontSize:9, color:'#9ca89c' }}>{sub}</div>}
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {chartData.length > 0 && (
        <ChartCard
          title="Producción por LC — Período completo"
          sub={`Total ${cop(totalGeneral)} · Promedio ${cop(avgVenta)}`}
          height={Math.max(200, chartData.length * 30)}
        >
          <BarChart data={chartData} layout="vertical" barSize={14} margin={{ top: 4, right: 70, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 9 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip content={<LCProdTip />} />
            <ReferenceLine x={avgVenta} stroke={CS} strokeDasharray="5 3"
              label={{ value: 'Promedio', position: 'top', fontSize: 9, fill: CS }} />
            <Bar dataKey="venta" name="Producción" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: v => cop(v), fontSize: 9, fill: '#555f55' }}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={i === 0 ? CU : i === chartData.length - 1 ? CR : CN} fillOpacity={0.88} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      )}

      <div className="card">
        <div className="card-h" style={{ justifyContent:'space-between' }}>
          <h2>Detalle por LC</h2>
          <span style={{ fontSize:10, opacity:.7 }}>Clic en el LC para ver sus sitios</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl tbl-rollout">
            <thead>
              <tr>
                <th style={{ minWidth:200 }}>LC / SUBCONTRATISTA</th>
                <th style={{ minWidth:90 }}>CUADRILLA</th>
                {meses.map(mes => <th key={mes} className="num" style={thStyle}>{mesLabel(mes)}</th>)}
                <th className="num">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {lcRows.map(([lc, data]) => {
                const isOpen   = expandedLC.has(lc)
                const totalLC  = Object.values(data.meses).reduce((s, v) => s + v, 0)
                const toggle   = () => setExpandedLC(prev => {
                  const next = new Set(prev)
                  next.has(lc) ? next.delete(lc) : next.add(lc)
                  return next
                })

                return [
                  <tr key={`lc-${lc}`} onClick={toggle} style={{ cursor:'pointer', background: isOpen ? '#f0fdf4' : '#fff' }}>
                    <td style={{ fontWeight:700, fontSize:11, color: isOpen ? CN : '#0a0a0a' }}>
                      <span style={{
                        display:'inline-block', width:14, marginRight:5, fontSize:9, color:'#9ca89c',
                        transform: isOpen ? 'rotate(90deg)' : 'none', transition:'transform .15s', transformOrigin:'center',
                      }}>▶</span>
                      {lc}
                      {!isOpen && data.sitios.some(s => s.pct1 < 100) && (() => {
                        const sample = data.sitios.find(s => s.pct1 < 100)
                        const d1 = new Date(sample.s.fecha || Date.now())
                        const d2 = new Date(sample.s.fecha || Date.now())
                        d2.setMonth(d2.getMonth() + 1)
                        return (
                          <span style={{ marginLeft:6, fontSize:8, fontWeight:700, padding:'1px 6px', borderRadius:6, background:'#fde68a', color:'#92400e' }}>
                            {d1.toLocaleString('es',{month:'short'})} {sample.pct1}% · {d2.toLocaleString('es',{month:'short'})} {sample.pct2}%
                          </span>
                        )
                      })()}
                    </td>
                    <td>
                      {data.cuad && (
                        <span style={{ fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:10, background:'#f0fdf4', color:'#166534' }}>{data.cuad}</span>
                      )}
                    </td>
                    {meses.map(mes => (
                      <td key={mes} className="num"><CeldaVal venta={data.meses[mes]} /></td>
                    ))}
                    <td className="num" style={{ fontWeight:800, fontSize:11, color: CN }}>{cop(totalLC)}</td>
                  </tr>,

                  isOpen && data.sitios.map(({ s, c, pct1, pct2, k1, k2, v1, v2 }) => (
                    <tr key={`site-${s.id}`} style={{ background:'#fafffe' }}>
                      <td style={{ paddingLeft:28, fontSize:11 }}>
                        <span style={{ fontWeight:600 }}>{s.nombre}</span>
                        <span style={{
                          marginLeft:6, fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10,
                          background: s.tipo === 'TSS' ? '#eff6ff' : '#f0fdf4',
                          color:      s.tipo === 'TSS' ? '#1e40af' : '#166534',
                        }}>{s.tipo}</span>
                        {pct2 > 0 && (() => {
                          const d1 = new Date(s.fecha || Date.now())
                          const d2 = new Date(s.fecha || Date.now())
                          d2.setMonth(d2.getMonth() + 1)
                          return (
                            <span style={{ marginLeft:4, fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:6, background:'#fef3cd', color:'#92400e' }}>
                              {d1.toLocaleString('es',{month:'short'})} {pct1}% · {d2.toLocaleString('es',{month:'short'})} {pct2}%
                            </span>
                          )
                        })()}
                      </td>
                      <td style={{ fontSize:10, color:'#9ca89c' }}>
                        {s.fecha ? mesLabel(mesKey(s.fecha)) : '—'}
                      </td>
                      {meses.map(mes => {
                        const isM1 = mes === k1 && v1 > 0
                        const isM2 = mes === k2 && v2 > 0
                        return (
                          <td key={mes} className="num" style={{ fontSize:10 }}>
                            {isM1 ? (
                              <div>
                                <div style={{ fontWeight:700, color: CN }}>{cop(v1)}</div>
                                <div style={{ fontSize:9, color:'#9ca89c' }}>{pct1}% M1</div>
                              </div>
                            ) : isM2 ? (
                              <div>
                                <div style={{ fontWeight:700, color:'#92400e' }}>{cop(v2)}</div>
                                <div style={{ fontSize:9, color:'#92400e' }}>{pct2}% M2</div>
                              </div>
                            ) : <span style={{ color:'#e0e4e0' }}>—</span>}
                          </td>
                        )
                      })}
                      <td className="num" style={{ fontWeight:700, fontSize:11, color: CN }}>{cop(c.totalVenta)}</td>
                    </tr>
                  )),

                  isOpen && data.sitios.length > 1 && (
                    <tr key={`sub-${lc}`} style={{ background:'#f0fdf4' }}>
                      <td colSpan={2} style={{ paddingLeft:28, fontSize:10, fontWeight:700, color:'#166534' }}>
                        Subtotal {lc} · {data.sitios.length} sitios
                      </td>
                      {meses.map(mes => (
                        <td key={mes} className="num" style={{ fontWeight:700, fontSize:10, color:'#166534' }}>
                          {data.meses[mes] > 0 ? cop(data.meses[mes]) : <span style={{ color:'#e0e4e0' }}>—</span>}
                        </td>
                      ))}
                      <td className="num" style={{ fontWeight:800, color: CN }}>{cop(totalLC)}</td>
                    </tr>
                  ),
                ]
              })}

              <tr style={{ background:'#e8f5e8', borderTop:'2px solid #144E4A' }}>
                <td colSpan={2} style={{ fontWeight:800, fontSize:11, color: CN }}>TOTAL PERÍODO</td>
                {meses.map(mes => (
                  <td key={mes} className="num" style={{ fontWeight:800, fontSize:11, color: CN }}>{cop(totalesMes[mes])}</td>
                ))}
                <td className="num" style={{ fontWeight:800, fontSize:12, color: CN }}>
                  {cop(meses.reduce((s, mes) => s + totalesMes[mes], 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding:'6px 14px 10px', fontSize:10, color:'#9ca89c' }}>
          Los valores M2 (naranja) son la porción de la venta asignada al mes siguiente según el % de ejecución configurado en el Liquidador
        </div>
      </div>

    </div>
  )
}
