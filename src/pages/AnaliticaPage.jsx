import { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Treemap,
} from 'recharts'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { calcSitio } from '../lib/calcSitio'
import { cop, pct, MESES } from '../lib/catalog'

// ── Paleta ───────────────────────────────────────────────────────
const CN = '#144E4A'
const CS = '#d97706'
const CU = '#1a7a1a'
const CR = '#c0392b'
const CY = '#FFC000'
const PIE_COLS = ['#144E4A','#0ea5e9','#7c3aed','#059669','#ea580c','#e11d48','#d97706','#84cc16']
const META_MARGEN = 30  // % línea de meta

function mCol(m) {
  if (m >= 0.3) return CU
  if (m >= 0.2) return CY
  return CR
}
function mColPct(p) {
  if (p >= 30) return CU
  if (p >= 20) return CY
  return CR
}

// ── Tooltip helpers ───────────────────────────────────────────────
function TipBox({ label, rows }) {
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

function CopTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <TipBox label={label} rows={payload.map(p => ({ name: p.name, val: cop(p.value), color: p.color }))} />
  )
}

function ScatterTip({ active, payload }) {
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

function TreeTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <TipBox
      label={d.name}
      rows={[
        { name: 'Venta', val: cop(d.size) },
        { name: 'Margen', val: pct(d.margen), color: mCol(d.margen) },
      ]}
    />
  )
}

// ── Chart wrapper ────────────────────────────────────────────────
function ChartCard({ title, sub, children, height = 260, style }) {
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

// ── KPI card ─────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = CN }) {
  return (
    <div className="stat" style={{ borderLeftColor: color }}>
      <div className="sl">{label}</div>
      <div className="sv" style={{ fontSize: 14, color, lineHeight: 1.2, wordBreak: 'break-word' }}>{value}</div>
      {sub && <div className="ss">{sub}</div>}
    </div>
  )
}

// ── Barra de filtros horizontal (colapsable) ──────────────────────
function FilterBar({ filters, setFilter, sitios, subcs }) {
  const [open, setOpen] = useState(false)
  const lcs        = useMemo(() => [...new Set(sitios.map(s => s.lc).filter(Boolean))].sort(), [sitios])
  const cuadrillas = useMemo(() => [...new Set(subcs.map(s => s.tipoCuadrilla).filter(Boolean))].sort(), [subcs])

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== '' && v !== 'TODOS').length

  const pill = (field, val, label) => (
    <button
      key={val}
      onClick={() => setFilter(field, val)}
      style={{
        padding: '3px 10px', borderRadius: 16, fontSize: 10, fontWeight: 700,
        cursor: 'pointer', border: '1.5px solid', whiteSpace: 'nowrap',
        background:  filters[field] === val ? CN : '#fff',
        color:       filters[field] === val ? '#fff' : CN,
        borderColor: filters[field] === val ? CN : '#cdd4cc',
      }}
    >{label || val}</button>
  )

  const lbl = (text) => (
    <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca89c', letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )

  const sep = <div style={{ width: 1, background: '#e0e4e0', alignSelf: 'stretch', margin: '0 4px' }} />

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      {/* ── Barra resumen (siempre visible) ── */}
      <div style={{
        padding: '8px 14px', display: 'flex', alignItems: 'center',
        gap: 10, flexWrap: 'wrap', cursor: 'pointer',
      }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 11, fontWeight: 700, color: CN }}>▼ Filtros</span>
        {activeFilters > 0 && (
          <span className="badge" style={{ background: '#fde68a', color: '#92400e', fontSize: 9 }}>
            {activeFilters} activo{activeFilters > 1 ? 's' : ''}
          </span>
        )}
        {/* chips de filtros activos */}
        {filters.tipo    !== 'TODOS' && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Tipo: {filters.tipo}</span>}
        {filters.region  !== 'TODOS' && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Región: {filters.region}</span>}
        {filters.estado  !== 'TODOS' && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Estado: {filters.estado}</span>}
        {filters.lc      !== ''      && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>LC: {filters.lc}</span>}
        {filters.cuadrilla !== ''    && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Cuadrilla: {filters.cuadrilla}</span>}
        {filters.fechaDesde !== ''   && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Desde: {filters.fechaDesde}</span>}
        {filters.fechaHasta !== ''   && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Hasta: {filters.fechaHasta}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeFilters > 0 && (
            <button className="btn bou btn-sm" style={{ fontSize: 9, padding: '2px 8px' }}
              onClick={e => { e.stopPropagation(); setFilter('__reset__', null) }}>
              ↺ Limpiar
            </button>
          )}
          <span style={{ fontSize: 12, color: '#9ca89c' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Panel expandido ── */}
      {open && (
        <div style={{
          borderTop: '1px solid #e0e4e0',
          padding: '12px 14px',
          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start',
        }}>

          {/* Tipo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('TIPO')}
            <div style={{ display: 'flex', gap: 4 }}>
              {['TODOS','TI','TSS','CW'].map(v => pill('tipo', v))}
            </div>
          </div>

          {sep}

          {/* Región */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('REGIÓN')}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {pill('region', 'TODOS', 'Todas')}
              {REGIONES.map(v => pill('region', v, v.split('–')[0].trim()))}
            </div>
          </div>

          {sep}

          {/* Estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('ESTADO')}
            <div style={{ display: 'flex', gap: 4 }}>
              {pill('estado','TODOS','Todos')}
              {pill('estado','pre','Pre-Final')}
              {pill('estado','final','Final')}
            </div>
          </div>

          {sep}

          {/* LC */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('LC / SUBCONTRATISTA')}
            <select className="fc" style={{ fontSize: 10, padding: '3px 6px', minWidth: 140 }}
              value={filters.lc} onChange={e => setFilter('lc', e.target.value)}>
              <option value="">— Todos —</option>
              {lcs.map(lc => <option key={lc} value={lc}>{lc}</option>)}
            </select>
          </div>

          {sep}

          {/* Cuadrilla */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('CUADRILLA')}
            <select className="fc" style={{ fontSize: 10, padding: '3px 6px', minWidth: 120 }}
              value={filters.cuadrilla} onChange={e => setFilter('cuadrilla', e.target.value)}>
              <option value="">— Todas —</option>
              {cuadrillas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {sep}

          {/* Fecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('FECHA')}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" className="fc" style={{ fontSize: 10, padding: '3px 6px', width: 130 }}
                value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} />
              <span style={{ fontSize: 10, color: '#9ca89c' }}>—</span>
              <input type="date" className="fc" style={{ fontSize: 10, padding: '3px 6px', width: 130 }}
                value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)} />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Tab 1: Rendimiento por LC ─────────────────────────────────────
function Tab1({ porLC }) {
  const sorted = useMemo(() => [...porLC].sort((a, b) => b.margen - a.margen), [porLC])
  const chartH = Math.max(220, sorted.length * 38)

  const bestMargen = sorted[0]
  const mossSitios = [...porLC].sort((a, b) => b.sitios - a.sitios)[0]
  const masCostoso = [...porLC].sort((a, b) => b.costo - a.costo)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* KPIs de LC */}
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

      {/* Barras agrupadas: Venta vs Costo por LC */}
      <ChartCard title="Venta vs Costo por LC" sub="Nokia · Costo · Utilidad" height={chartH}>
        <BarChart
          data={porLC}
          layout="vertical"
          margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
          <XAxis type="number" tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} tick={{ fontSize: 9 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={85} />
          <Tooltip content={<CopTip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="venta" name="Venta Nokia" fill={CN} radius={[0, 2, 2, 0]} />
          <Bar dataKey="costo" name="Costo"        fill={CS} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ChartCard>

      {/* Barras: Margen % ordenado + línea meta */}
      <ChartCard title="Margen % por LC" sub={`ordenado de mayor a menor · meta ${META_MARGEN}%`} height={chartH}>
        <BarChart
          data={sorted}
          layout="vertical"
          barSize={14}
          margin={{ top: 4, right: 30, left: 10, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
          <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 9 }} domain={[0, 'auto']} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={85} />
          <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Margen']} labelStyle={{ fontWeight: 700, fontSize: 11 }} />
          <ReferenceLine x={META_MARGEN} stroke={CU} strokeDasharray="5 3"
            label={{ value: `Meta ${META_MARGEN}%`, position: 'top', fontSize: 9, fill: CU }} />
          <Bar dataKey="margen" name="Margen %" radius={[0, 2, 2, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={mColPct(entry.margen)} />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>

    </div>
  )
}

// ── Tab 2: Rendimiento por Sitio ──────────────────────────────────
function Tab2({ filteredCalcs }) {
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

      {/* Scatter */}
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
              {/* Diagonal margen 0% */}
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

      {/* Top 10 sitios por margen */}
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

// ── Tab 3: Tendencia temporal ─────────────────────────────────────
function Tab3({ filteredCalcs }) {
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

  // Venta acumulada
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

// ── Tab 4: Composición ────────────────────────────────────────────
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

function Tab4({ filteredCalcs, porLC }) {
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

      {/* Dona: participación LC */}
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

      {/* Treemap: sitios por volumen */}
      <div className="card">
        <div className="card-h">
          <h2>Sitios por Volumen de Venta</h2>
          <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 400 }}>verde ≥ 30% · amarillo ≥ 20% · rojo &lt; 20%</span>
        </div>
        <div className="card-b" style={{ paddingTop: 8 }}>
          <ResponsiveContainer width="100%" height={320}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              content={<CustomTreeContent />}
            >
              <Tooltip content={<TreeTip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}

// ── Tooltip producción LC ─────────────────────────────────────────
function LCProdTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <TipBox
      label={label}
      rows={[
        { name: 'Producción', val: cop(d.value), color: d.fill },
        { name: 'Participación', val: payload[0]?.payload?.pct != null ? pct(payload[0].payload.pct) : '' },
      ]}
    />
  )
}

// ── Tab 5: Producción ─────────────────────────────────────────────
function Tab5({ filteredCalcs, subcs }) {
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

  // ── Datos derivados (compartidos entre bloques) ───────────────
  const { meses, cuadMatrix, cuadrillas, lcRows } = useMemo(() => {
    const mesSet   = new Set()
    const cuadAcc  = {}   // cuad → mes → { venta, sitios }
    const lcAcc    = {}   // lc  → { cuad, mes → venta, sitios[] }

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

      // cuadMatrix
      if (!cuadAcc[cuad]) cuadAcc[cuad] = {}
      cuadAcc[cuad][k1] = cuadAcc[cuad][k1] || { venta: 0, sitios: 0 }
      cuadAcc[cuad][k1].venta  += v1
      cuadAcc[cuad][k1].sitios += 1
      if (k2) {
        cuadAcc[cuad][k2] = cuadAcc[cuad][k2] || { venta: 0, sitios: 0 }
        cuadAcc[cuad][k2].venta += v2
      }

      // lcAcc
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

  // ── Celda valor mes ───────────────────────────────────────────
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

      {/* ── GRÁFICA: Producción por LC ── */}
      {chartData.length > 0 && (
        <ChartCard
          title="Producción por LC — Período completo"
          sub={`Total ${cop(totalGeneral)} · Promedio ${cop(avgVenta)}`}
          height={Math.max(200, chartData.length * 30)}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            barSize={14}
            margin={{ top: 4, right: 70, left: 10, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`}
              tick={{ fontSize: 9 }}
            />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip content={<LCProdTip />} />
            <ReferenceLine
              x={avgVenta}
              stroke={CS}
              strokeDasharray="5 3"
              label={{ value: 'Promedio', position: 'top', fontSize: 9, fill: CS }}
            />
            <Bar dataKey="venta" name="Producción" radius={[0, 4, 4, 0]} label={{
              position: 'right',
              formatter: v => cop(v),
              fontSize: 9,
              fill: '#555f55',
            }}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    i === 0                       ? CU :   // mejor → verde
                    i === chartData.length - 1    ? CR :   // peor  → rojo
                    CN                                     // resto → teal
                  }
                  fillOpacity={0.88}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      )}

      {/* ── BLOQUE: Detalle por LC (expandible) ── */}
      <div className="card">
        <div className="card-h" style={{ justifyContent:'space-between' }}>
          <h2>Detalle por LC</h2>
          <span style={{ fontSize:10, opacity:.7 }}>Clic en el LC para ver sus sitios</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
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
                  // Fila LC
                  <tr key={`lc-${lc}`}
                    onClick={toggle}
                    style={{ cursor:'pointer', background: isOpen ? '#f0fdf4' : '#fff' }}>
                    <td style={{ fontWeight:700, fontSize:11, color: isOpen ? CN : '#0a0a0a' }}>
                      <span style={{
                        display:'inline-block', width:14, marginRight:5,
                        fontSize:9, color:'#9ca89c',
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition:'transform .15s', transformOrigin:'center',
                      }}>▶</span>
                      {lc}
                      {!isOpen && data.sitios.some(s => s.pct1 < 100) && (() => {
                        const sample = data.sitios.find(s => s.pct1 < 100)
                        const d1 = new Date(sample.s.fecha || Date.now())
                        const d2 = new Date(sample.s.fecha || Date.now())
                        d2.setMonth(d2.getMonth() + 1)
                        return (
                          <span style={{
                            marginLeft:6, fontSize:8, fontWeight:700, padding:'1px 6px',
                            borderRadius:6, background:'#fde68a', color:'#92400e',
                          }}>
                            {d1.toLocaleString('es',{month:'short'})} {sample.pct1}% · {d2.toLocaleString('es',{month:'short'})} {sample.pct2}%
                          </span>
                        )
                      })()}
                    </td>
                    <td>
                      {data.cuad && (
                        <span style={{
                          fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:10,
                          background:'#f0fdf4', color:'#166534',
                        }}>{data.cuad}</span>
                      )}
                    </td>
                    {meses.map(mes => (
                      <td key={mes} className="num">
                        <CeldaVal venta={data.meses[mes]} />
                      </td>
                    ))}
                    <td className="num" style={{ fontWeight:800, fontSize:11, color: CN }}>{cop(totalLC)}</td>
                  </tr>,

                  // Filas de sitios (si expandido)
                  isOpen && data.sitios.map(({ s, c, pct1, pct2, k1, k2, v1, v2 }) => (
                    <tr key={`site-${s.id}`} style={{ background:'#fafffe' }}>
                      <td style={{ paddingLeft:28, fontSize:11 }}>
                        <span style={{ fontWeight:600 }}>{s.nombre}</span>
                        <span style={{
                          marginLeft:6, fontSize:9, fontWeight:700, padding:'1px 6px',
                          borderRadius:10,
                          background: s.tipo === 'TSS' ? '#eff6ff' : '#f0fdf4',
                          color:      s.tipo === 'TSS' ? '#1e40af' : '#166534',
                        }}>{s.tipo}</span>
                        {pct2 > 0 && (() => {
                          const d1 = new Date(s.fecha || Date.now())
                          const d2 = new Date(s.fecha || Date.now())
                          d2.setMonth(d2.getMonth() + 1)
                          return (
                            <span style={{
                              marginLeft:4, fontSize:8, fontWeight:700, padding:'1px 5px',
                              borderRadius:6, background:'#fef3cd', color:'#92400e',
                            }}>
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
                      <td className="num" style={{ fontWeight:700, fontSize:11, color: CN }}>
                        {cop(c.totalVenta)}
                      </td>
                    </tr>
                  )),

                  // Subtotal LC (solo si expandido y hay más de 1 sitio)
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

              {/* Total período */}
              <tr style={{ background:'#e8f5e8', borderTop:'2px solid #144E4A' }}>
                <td colSpan={2} style={{ fontWeight:800, fontSize:11, color: CN }}>TOTAL PERÍODO</td>
                {meses.map(mes => (
                  <td key={mes} className="num" style={{ fontWeight:800, fontSize:11, color: CN }}>
                    {cop(totalesMes[mes])}
                  </td>
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

// ── Página principal ─────────────────────────────────────────────
const INIT_FILTERS = { tipo: 'TODOS', lc: '', cuadrilla: '', fechaDesde: '', fechaHasta: '', region: 'TODOS', estado: 'TODOS' }
const REGIONES = ['R1 – Costa','R2 – Noroccidente','R3 – Suroccidente','R4 – Centro','R5 – Oriente']

export default function AnaliticaPage() {
  const sitios           = useAppStore(s => s.sitios)
  const gastos           = useAppStore(s => s.gastos)
  const subcs            = useAppStore(s => s.subcs)
  const catalogTI        = useAppStore(s => s.catalogTI)
  const liquidaciones_cw = useAppStore(s => s.liquidaciones_cw)
  const user             = useAuthStore(s => s.user)

  // Auto-apply tipo filter for role-based views
  const roleFilter = useMemo(() => {
    if (user?.role === 'TI')  return 'TI'
    if (user?.role === 'TSS') return 'TSS'
    if (user?.role === 'CW')  return 'CW'
    return 'TODOS'
  }, [user?.role])

  const [filters, setFilters] = useState(() => ({ ...INIT_FILTERS, tipo: roleFilter }))
  const [tab, setTab]         = useState(1)

  // Keep filter in sync if role changes (login switch)
  useEffect(() => {
    if (roleFilter !== 'TODOS') setFilters(f => ({ ...f, tipo: roleFilter }))
  }, [roleFilter])

  function setFilter(field, value) {
    if (field === '__reset__') { setFilters({ ...INIT_FILTERS, tipo: roleFilter }); return }
    // Role-restricted users cannot change the tipo filter
    if (field === 'tipo' && roleFilter !== 'TODOS') return
    setFilters(f => ({ ...f, [field]: value }))
  }

  // ── Sitios filtrados ──────────────────────────────────────────
  const filteredSitios = useMemo(() => {
    return sitios.filter(s => {
      if (filters.tipo !== 'TODOS') {
        if (filters.tipo === 'TSS' && s.tipo !== 'TSS') return false
        if (filters.tipo === 'TI'  && s.tipo === 'TSS') return false
        if (filters.tipo === 'CW'  && !s.tiene_cw) return false
      }
      if (filters.lc && s.lc !== filters.lc) return false
      if (filters.cuadrilla) {
        const sub = subcs.find(x => x.lc === s.lc)
        if ((sub?.tipoCuadrilla || '') !== filters.cuadrilla) return false
      }
      if (filters.region !== 'TODOS') {
        if ((s.region || '') !== filters.region) return false
      }
      if (filters.estado !== 'TODOS' && s.estado !== filters.estado) return false
      if (filters.fechaDesde && s.fecha && s.fecha < filters.fechaDesde) return false
      if (filters.fechaHasta && s.fecha && s.fecha > filters.fechaHasta) return false
      return true
    })
  }, [sitios, subcs, filters])

  // ── Cálculos sobre filtrados ──────────────────────────────────
  const filteredCalcs = useMemo(
    () => filteredSitios.map(s => ({ s, c: calcSitio(s, gastos, subcs, catalogTI, liquidaciones_cw) })),
    [filteredSitios, gastos, subcs, catalogTI, liquidaciones_cw]
  )

  // ── Totales filtrados ─────────────────────────────────────────
  const totals = useMemo(() => {
    const tV = filteredCalcs.reduce((s, { c }) => s + c.totalVenta, 0)
    const tC = filteredCalcs.reduce((s, { c }) => s + c.totalCosto, 0)
    const m  = tV > 0 ? (tV - tC) / tV : 0
    return { tV, tC, tU: tV - tC, m }
  }, [filteredCalcs])

  // ── KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!filteredCalcs.length) return {}
    const sorted = [...filteredCalcs].sort((a, b) => b.c.margen - a.c.margen)
    const best   = sorted[0]
    const worst  = sorted[sorted.length - 1]
    const byVenta = [...filteredCalcs].sort((a, b) => b.c.totalVenta - a.c.totalVenta)[0]

    const byLC = {}
    filteredCalcs.forEach(({ s, c }) => {
      const lc = s.lc || 'Sin LC'
      if (!byLC[lc]) byLC[lc] = { venta: 0, costo: 0 }
      byLC[lc].venta += c.totalVenta
      byLC[lc].costo += c.totalCosto
    })
    const bestLC = Object.entries(byLC)
      .map(([lc, v]) => ({ lc, margen: v.venta > 0 ? (v.venta - v.costo) / v.venta : 0 }))
      .sort((a, b) => b.margen - a.margen)[0]

    return { best, worst, byVenta, bestLC }
  }, [filteredCalcs])

  // ── porLC para tabs ───────────────────────────────────────────
  const porLC = useMemo(() => {
    const byLC = {}
    filteredCalcs.forEach(({ s, c }) => {
      const lc = s.lc || 'Sin LC'
      if (!byLC[lc]) byLC[lc] = { venta: 0, costo: 0, count: 0 }
      byLC[lc].venta += c.totalVenta
      byLC[lc].costo += c.totalCosto
      byLC[lc].count++
    })
    return Object.entries(byLC).map(([name, v]) => ({
      name,
      venta: v.venta, costo: v.costo, sitios: v.count,
      margen: v.venta > 0 ? parseFloat(((v.venta - v.costo) / v.venta * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.venta - a.venta)
  }, [filteredCalcs])

  const TABS = [
    { id: 1, label: 'Rendimiento LC'     },
    { id: 2, label: 'Por Sitio'          },
    { id: 3, label: 'Tendencia Temporal' },
    { id: 4, label: 'Composición'        },
    { id: 5, label: 'Producción'          },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="fb">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Analítica del Proyecto
        </h1>
        <span style={{ fontSize: 11, color: CN, fontWeight: 600 }}>
          {filteredSitios.length} / {sitios.length} sitios
        </span>
      </div>

      {/* ── Barra de filtros (top) ─────────────────────── */}
      <FilterBar filters={filters} setFilter={setFilter} sitios={sitios} subcs={subcs} />

      {/* ── Sticky: KPI cards + Tabs ───────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: '#f0f2f0',
        paddingBottom: 4,
        boxShadow: '0 3px 10px rgba(0,0,0,.07)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
          <div className="g3">
            <KpiCard label="Sitio — Mejor Margen"
              value={kpis.best?.s.nombre || '—'}
              sub={kpis.best ? pct(kpis.best.c.margen) : ''}
              color={CU} />
            <KpiCard label="Sitio — Menor Margen"
              value={kpis.worst?.s.nombre || '—'}
              sub={kpis.worst ? pct(kpis.worst.c.margen) : ''}
              color={CR} />
            <KpiCard label="Sitio — Mayor Venta"
              value={kpis.byVenta?.s.nombre || '—'}
              sub={kpis.byVenta ? cop(kpis.byVenta.c.totalVenta) : ''}
              color={CN} />
          </div>
          <div className="g3">
            <KpiCard label="LC — Más Rentable"
              value={kpis.bestLC?.lc || '—'}
              sub={kpis.bestLC ? pct(kpis.bestLC.margen) : ''}
              color={CU} />
            <KpiCard label="Total Venta (filtrado)"
              value={cop(totals.tV)}
              color={CN} />
            <KpiCard label="Margen Promedio (filtrado)"
              value={pct(totals.m)}
              color={mCol(totals.m)} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e0e4e0' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 16px', fontSize: 11, fontWeight: 700,
                border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === t.id ? CN : 'transparent',
                color:      tab === t.id ? '#CDFBF2' : '#555f55',
                borderBottom: tab === t.id ? `2px solid ${CN}` : 'none',
                marginBottom: -2,
              }}
            >
              {t.id}. {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 1 && <Tab1 porLC={porLC} />}
      {tab === 2 && <Tab2 filteredCalcs={filteredCalcs} />}
      {tab === 3 && <Tab3 filteredCalcs={filteredCalcs} />}
      {tab === 4 && <Tab4 filteredCalcs={filteredCalcs} porLC={porLC} />}
      {tab === 5 && <Tab5 filteredCalcs={filteredCalcs} subcs={subcs} />}

    </div>
  )
}
