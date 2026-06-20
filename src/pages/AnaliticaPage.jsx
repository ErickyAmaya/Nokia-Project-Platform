import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Treemap,
  FunnelChart, Funnel, LabelList, ComposedChart,
} from 'recharts'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { useFactStore } from '../store/useFactStore'
import { loadRolloutData, loadRolloutFromSupabase } from '../lib/rolloutImport'
import { calcSitio } from '../lib/calcSitio'
import { cop, pct, MESES } from '../lib/catalog'
import { buildTCOptions, matchTipoCuadrilla } from '../lib/cuadrilla'

// ── Utilidades KPI tiempo de liberación ──────────────────────────
function _parsePpaDate(v) {
  if (!v) return null
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const n = parseFloat(s)
  if (!isNaN(n) && n > 10000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  return null
}
const _normMs   = s => (s||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
const _diffDays = (a,b) => { if(!a||!b) return null; const d=Math.round((new Date(b)-new Date(a))/86400000); return d>=0?d:null }
const _avgArr   = arr => arr.length ? Math.round(arr.reduce((a,v)=>a+v,0)/arr.length) : 0
const KPI_MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const _getPeriodKey = (monthKey, groupBy) => {
  const [y,m] = monthKey.split('-').map(Number)
  if (groupBy==='trimestre') return `${y}-Q${Math.ceil(m/3)}`
  if (groupBy==='semestre')  return `${y}-H${m<=6?1:2}`
  return monthKey
}
const _getPeriodLabel = (key, groupBy) => {
  if (groupBy==='mes') { const [y,m]=key.split('-').map(Number); return `${KPI_MESES_LBL[m-1]} '${String(y).slice(2)}` }
  const [y,p]=key.split('-'); return `${p} ${y}`
}

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
  const cuadrillaOpts = useMemo(() => {
    const tipos = [...new Set(subcs.map(s => s.tipoCuadrilla).filter(Boolean))].sort()
    return buildTCOptions(tipos).filter(o => o.value !== 'todos')
  }, [subcs])
  const lcs = useMemo(() => {
    const allLcs = [...new Set(sitios.map(s => s.lc).filter(Boolean))].sort()
    if (!filters.cuadrilla) return allLcs
    const lcsDeCuadrilla = new Set(
      subcs.filter(s => {
        const tc = s.tipoCuadrilla || ''
        if (tc === filters.cuadrilla) return true
        const parts = tc.split(' ')
        const prefix = parts[0]
        const suffix = parts.slice(1).join(' ')
        return (suffix && suffix === filters.cuadrilla) || (prefix && prefix === filters.cuadrilla)
      }).map(s => s.lc).filter(Boolean)
    )
    return allLcs.filter(lc => lcsDeCuadrilla.has(lc))
  }, [sitios, subcs, filters.cuadrilla])

  useEffect(() => {
    if (filters.lc && !lcs.includes(filters.lc)) setFilter('lc', '')
  }, [filters.cuadrilla]) // eslint-disable-line react-hooks/exhaustive-deps

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
            <select className="fc" style={{ fontSize: 10, padding: '3px 6px', minWidth: 150 }}
              value={filters.cuadrilla} onChange={e => setFilter('cuadrilla', e.target.value)}>
              <option value="">— Todas —</option>
              {cuadrillaOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {sep}

          {/* Fechas */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lbl('FECHA (Desde)')}
              <input type="date" className="fc" style={{ fontSize: 10, padding: '3px 6px', width: 130 }}
                value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lbl('FECHA (Hasta)')}
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
      <ChartCard title="Venta vs Costo por LC" sub="Nokia · Costo · Utilidad" height={280}>
        <BarChart
          data={porLC}
          margin={{ top: 4, right: 20, left: 10, bottom: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, angle: -35, textAnchor: 'end' }} interval={0} />
          <YAxis tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} tick={{ fontSize: 9 }} />
          <Tooltip content={<CopTip />} cursor={{ fill: 'transparent' }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="venta" name="Venta Nokia" fill={CN} radius={[2, 2, 0, 0]} />
          <Bar dataKey="costo" name="Costo"        fill={CS} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartCard>

      {/* Barras: Margen % ordenado + línea meta */}
      <ChartCard title="Margen % por LC" sub={`ordenado de mayor a menor · meta ${META_MARGEN}%`} height={280}>
        <BarChart
          data={sorted}
          barSize={22}
          margin={{ top: 4, right: 30, left: 10, bottom: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, angle: -35, textAnchor: 'end' }} interval={0} />
          <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 9 }} domain={[0, 'auto']} />
          <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Margen']} labelStyle={{ fontWeight: 700, fontSize: 11 }} cursor={{ fill: 'transparent' }} />
          <ReferenceLine y={META_MARGEN} stroke={CU} strokeDasharray="5 3"
            label={{ value: `Meta ${META_MARGEN}%`, position: 'insideTopRight', fontSize: 9, fill: CU }} />
          <Bar dataKey="margen" name="Margen %" radius={[2, 2, 0, 0]}>
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

  const top10Venta = useMemo(() =>
    [...filteredCalcs]
      .sort((a, b) => b.c.totalVenta - a.c.totalVenta)
      .slice(0, 10)
      .map(({ s, c }) => ({
        name:  s.nombre.length > 18 ? s.nombre.slice(0, 18) + '…' : s.nombre,
        venta: c.totalVenta,
      })), [filteredCalcs])

  const top10MenorMargen = useMemo(() =>
    [...filteredCalcs]
      .filter(({ c }) => c.totalCosto > 0)
      .sort((a, b) => a.c.margen - b.c.margen)
      .slice(0, 10)
      .map(({ s, c }) => {
        const margen = parseFloat((c.margen * 100).toFixed(1))
        return {
          name:   s.nombre.length > 18 ? s.nombre.slice(0, 18) + '…' : s.nombre,
          margen,
          delta:  parseFloat((margen - META_MARGEN).toFixed(1)),
        }
      }), [filteredCalcs])

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

      {/* Funnel — Top 10 por venta */}
      <div className="card">
        <div className="card-h">
          <h2>Top 10 Sitios — Mayor Venta</h2>
          <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 400 }}>ingresos Nokia facturados</span>
        </div>
        <div className="card-b" style={{ paddingTop: 4 }}>
          <ResponsiveContainer width="100%" height={300}>
            <FunnelChart margin={{ top: 4, right: 120, bottom: 4, left: 120 }}>
              <Tooltip
                formatter={v => [cop(v), 'Venta Nokia']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e0e4e0' }}
              />
              <Funnel
                dataKey="venta"
                data={top10Venta.map((d, i) => ({
                  ...d,
                  fill: `hsl(${173 - i * 4}, ${65 - i * 2}%, ${38 + i * 2}%)`,
                }))}
                isAnimationActive
              >
                <LabelList
                  dataKey="venta"
                  content={(props) => {
                    const item = top10Venta[props.index]
                    if (!item || !item.venta) return null
                    const { x, y, width, height } = props
                    const cx = x + width / 2
                    const cy = y + height / 2
                    const fmtV = `$${(item.venta / 1e6).toFixed(1)}M`
                    return (
                      <text x={cx} y={cy + 4} textAnchor="middle"
                        fill="#fff" fontSize={9} fontWeight={700}>
                        {item.name} ({fmtV})
                      </text>
                    )
                  }}
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Barras divergentes — Menor Margen % vs Meta */}
      {top10MenorMargen.length > 0 ? (
        <ChartCard
          title="Top 10 Sitios — Desviación vs Meta de Margen"
          sub={`solo sitios con costos · verde = supera meta ${META_MARGEN}% · rojo = por debajo`}
          height={Math.max(200, top10MenorMargen.length * 36 + 20)}
        >
          <BarChart data={top10MenorMargen} layout="vertical" barSize={14}
            margin={{ top: 4, right: 50, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              tick={{ fontSize: 9 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              formatter={(v, n, { payload }) => [
                `${payload.margen.toFixed(1)}% (${v > 0 ? '+' : ''}${v.toFixed(1)}% vs meta)`,
                'Margen'
              ]}
              labelStyle={{ fontWeight: 700, fontSize: 11 }}
            />
            <ReferenceLine x={0} stroke="#374151" strokeWidth={1.5}
              label={{ value: `Meta ${META_MARGEN}%`, position: 'insideTopRight', fontSize: 9, fill: '#374151' }} />
            <Bar dataKey="delta" name="Desviación" radius={[0, 3, 3, 0]}>
              {top10MenorMargen.map((entry, i) => (
                <Cell key={i} fill={entry.delta >= 0 ? CU : CR} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      ) : (
        <div className="card" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
          Sin sitios con costos cargados en el período seleccionado
        </div>
      )}

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
            <Tooltip content={<CopTip />} cursor={{ fill: 'transparent' }} />
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
            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Margen']} labelStyle={{ fontWeight: 700, fontSize: 11 }} cursor={{ fill: 'transparent' }} />
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

// ── Tab 6: TILT ───────────────────────────────────────────────────
function parseFecha(str) {
  if (!str) return null
  const s = str.trim()
  // dd/mm/yyyy o dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  return null
}
function diffDias(a, b) {
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}
function tiltColor(d) {
  if (d === null) return '#9ca3af'
  if (d <= 7)  return '#166534'
  if (d <= 14) return '#92400e'
  return '#c0392b'
}
function tiltBg(d) {
  if (d === null) return '#f3f4f6'
  if (d <= 7)  return '#dcfce7'
  if (d <= 14) return '#fef3c7'
  return '#fde8e7'
}

function parseCsvLine(line) {
  const cols = []; let field = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (inQ && line[i+1] === '"') { field += '"'; i++ } else inQ = !inQ }
    else if ((ch === ',' || ch === ';') && !inQ) { cols.push(field.trim()); field = '' }
    else field += ch
  }
  cols.push(field.trim())
  return cols
}

function parseRolloutCSV(text) {
  const lines = text.split(/\r?\n/)
  const headerIdx = lines.findIndex(l => l.includes('Site Name') || l.includes('TI Star'))
  if (headerIdx < 0) return []
  const headers = parseCsvLine(lines[headerIdx])
  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]; if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (!cols[0]) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

// ── Timeline month picker ─────────────────────────────────────────
const MESES_SHORT = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']


const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSFmwCZWD4jMIPVe-tO1z8_kFkRRE8ZuQPlAvdno8XzTA0KBJHgUsoKLtzDp8U7lEPX5v6pJ_nqZWph/pub?gid=0&single=true&output=csv'
const LS_DATA = 'tilt_csv_data'
const LS_TS   = 'tilt_csv_ts'
const CACHE_MS = 60 * 60 * 1000 // 1 hora

function Tab6() {
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [fetchErr,  setFetchErr]  = useState(null)
  const [filCuad,     setFilCuad]     = useState('')
  const [filEstado,   setFilEstado]   = useState('TODOS')
  const [fil5G,       setFil5G]       = useState('TODOS')
  const [slaGroupBy,  setSlaGroupBy]  = useState('mes')
  const [slaSelRange, setSlaSelRange] = useState(null)
  const [showCW,      setShowCW]      = useState(false)
  const [show5G,      setShow5G]      = useState(false)
  const [cuadSearch,  setCuadSearch]  = useState('')
  const [cuadOpen,    setCuadOpen]    = useState(false)
  const fileRef     = React.useRef()
  const cuadRef     = React.useRef()
  const slaDragStart = React.useRef(null)

  async function fetchFromSheets(force = false) {
    setLoading(true); setFetchErr(null)
    try {
      const cachedTs   = localStorage.getItem(LS_TS)
      const cachedData = localStorage.getItem(LS_DATA)
      const age = cachedTs ? Date.now() - Number(cachedTs) : Infinity
      let text
      if (!force && age < CACHE_MS && cachedData) {
        text = cachedData
      } else {
        const res = await fetch(SHEETS_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        text = await res.text()
        localStorage.setItem(LS_DATA, text)
        localStorage.setItem(LS_TS,   String(Date.now()))
      }
      setRows(parseRolloutCSV(text))
      setFetchedAt(Number(localStorage.getItem(LS_TS)))
    } catch (e) {
      setFetchErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchFromSheets() }, [])

  async function handleFile(f) {
    if (!f) return
    setLoading(true)
    try {
      const text = await f.text()
      setRows(parseRolloutCSV(text))
      setFetchedAt(Date.now())
      setFetchErr(null)
    } finally {
      setLoading(false)
    }
  }

  const sitios = useMemo(() => {
    return rows.map(r => {
      const tiStar   = parseFecha(r['TI Star 1'] || r['TI Star'])
      const tiFinish = parseFecha(r['TI Finish 1'] || r['TI Finish'])
      const tilt     = diffDias(tiStar, tiFinish)
      const esCwConj = (r['CW'] || '').toLowerCase().includes('conjunta')
      const es5G            = (r['Implementación 5G'] || r['Implementacion 5G'] || '').toLowerCase().includes('si')
      const integracionReal = parseFecha(r['Integracion Real'] || r['Integración Real'] || r['Integracion real'])
      return {
        sitio:     r['Site Name'] || r['Sitio'] || '',
        cuadrilla: r['Cuadrilla'] || '',
        estado:    r['Estado del Sitio'] || r['Estado'] || '',
        wInt:      r['W int'] || r['W Int'] || '',
        tiStar, tiFinish, tilt,
        esCwConj, es5G, integracionReal,
      }
    }).filter(s => s.sitio)
  }, [rows])

  const cuadrillas = useMemo(() => [...new Set(sitios.map(s => s.cuadrilla).filter(Boolean))].sort(), [sitios])
  const estados    = useMemo(() => ['TODOS', ...new Set(sitios.map(s => s.estado).filter(Boolean))], [sitios])

  // Años disponibles con datos reales
  const mesesDisponibles = useMemo(() => {
    return [...new Set(sitios.map(s => {
      if (!s.tiFinish) return null
      const y = s.tiFinish.getFullYear()
      const m = String(s.tiFinish.getMonth() + 1).padStart(2, '0')
      return `${y}-${m}`
    }).filter(Boolean))].sort()
  }, [sitios])

  const slaAvailablePeriods = useMemo(() => {
    const seen = new Set()
    for (const mk of mesesDisponibles) seen.add(_getPeriodKey(mk, slaGroupBy))
    return [...seen].sort()
  }, [mesesDisponibles, slaGroupBy])

  React.useEffect(() => {
    const onUp = () => { slaDragStart.current = null }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [])

  const filtered = useMemo(() => sitios.filter(s => {
    if (filCuad && s.cuadrilla !== filCuad) return false
    if (filEstado !== 'TODOS' && s.estado !== filEstado) return false
    if (fil5G === 'CON' && !s.es5G) return false
    if (fil5G === 'SIN' && s.es5G) return false
    if (slaSelRange && s.tiFinish) {
      const mk = `${s.tiFinish.getFullYear()}-${String(s.tiFinish.getMonth()+1).padStart(2,'0')}`
      const idx = slaAvailablePeriods.indexOf(_getPeriodKey(mk, slaGroupBy))
      if (idx < slaSelRange[0] || idx > slaSelRange[1]) return false
    }
    return true
  }), [sitios, filCuad, filEstado, slaSelRange, slaGroupBy, slaAvailablePeriods, fil5G])

  // Solo sitios con ambas fechas para cálculos y gráficas
  const filteredConTilt = useMemo(() => filtered.filter(s => s.tilt !== null), [filtered])

  const prom = arr => arr.length ? Math.round(arr.reduce((a, s) => a + s.tilt, 0) / arr.length) : null
  const promTilt     = prom(filteredConTilt)
  const promCwConj   = prom(filteredConTilt.filter(s => s.esCwConj))
  const promSinExtra = prom(filteredConTilt.filter(s => !s.esCwConj && !s.es5G))
  const prom5G       = prom(filteredConTilt.filter(s => s.es5G))

  // Gráfica 1 — TILT por cuadrilla
  const porCuadrilla = useMemo(() => {
    const map = {}
    filteredConTilt.forEach(s => {
      const k = s.cuadrilla || 'Sin cuadrilla'
      if (!map[k]) map[k] = { cuadrilla: k.split(' ').slice(-2).join(' '), total: 0, count: 0 }
      map[k].total += s.tilt; map[k].count++
    })
    return Object.values(map)
      .map(r => ({ ...r, prom: Math.round(r.total / r.count) }))
      .sort((a, b) => a.prom - b.prom)
  }, [filtered])

  // Gráfica 2 — TILT promedio por mes
  const porMes = useMemo(() => {
    const map = {}
    filteredConTilt.forEach(s => {
      if (!s.tiFinish) return
      const y = s.tiFinish.getFullYear()
      const m = s.tiFinish.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { label: `${MESES_SHORT[m]} ${String(y).slice(2)}`, total: 0, count: 0, sitios: 0 }
      map[key].total += s.tilt; map[key].count++; map[key].sitios++
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, prom: Math.round(v.total / v.count) }))
  }, [filteredConTilt])

  // Curva de tendencia — aplica cuadrilla/estado/5G pero NO el rango de fechas
  const filteredSinRango = useMemo(() => sitios.filter(s => {
    if (filCuad && s.cuadrilla !== filCuad) return false
    if (filEstado !== 'TODOS' && s.estado !== filEstado) return false
    if (fil5G === 'CON' && !s.es5G) return false
    if (fil5G === 'SIN' && s.es5G) return false
    return true
  }), [sitios, filCuad, filEstado, fil5G])

  const integPorMes = useMemo(() => {
    const map = {}
    filteredSinRango.filter(s => {
      if (!s.integracionReal) return false
      const y = s.integracionReal.getFullYear()
      if (y < 2020) return false
      if (slaSelRange) {
        const mk = `${y}-${String(s.integracionReal.getMonth()+1).padStart(2,'0')}`
        const idx = slaAvailablePeriods.indexOf(_getPeriodKey(mk, slaGroupBy))
        if (idx < slaSelRange[0] || idx > slaSelRange[1]) return false
      }
      return true
    }).forEach(s => {
      const y = s.integracionReal.getFullYear()
      const m = s.integracionReal.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { label: `${MESES_SHORT[m]} ${String(y).slice(2)}`, count: 0 }
      map[key].count++
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [filteredSinRango, slaSelRange, slaGroupBy, slaAvailablePeriods])

  const isSingleMonth = slaSelRange && slaSelRange[0] === slaSelRange[1] && slaGroupBy === 'mes'

  const integPorDia = useMemo(() => {
    if (!isSingleMonth) return []
    const selectedPeriod = slaAvailablePeriods[slaSelRange[0]]
    const map = {}
    filteredSinRango.filter(s => {
      if (!s.integracionReal) return false
      const y = s.integracionReal.getFullYear()
      if (y < 2020) return false
      const mk = `${y}-${String(s.integracionReal.getMonth()+1).padStart(2,'0')}`
      return mk === selectedPeriod
    }).forEach(s => {
      const d = s.integracionReal.getDate()
      const mesAbr = MESES_SHORT[s.integracionReal.getMonth()]
      if (!map[d]) map[d] = { dia: d, label: `${d}.${mesAbr[0]}${mesAbr.slice(1).toLowerCase()}`, count: 0 }
      map[d].count++
    })
    return Object.values(map).sort((a, b) => a.dia - b.dia)
  }, [filteredSinRango, isSingleMonth, slaAvailablePeriods, slaSelRange])

  // Por cuadrilla — usa filtro de rango sobre integracionReal
  const filteredInteg = useMemo(() => filtered.filter(s => {
    if (!s.integracionReal) return false
    if (slaSelRange) {
      const mk = `${s.integracionReal.getFullYear()}-${String(s.integracionReal.getMonth()+1).padStart(2,'0')}`
      const idx = slaAvailablePeriods.indexOf(_getPeriodKey(mk, slaGroupBy))
      if (idx < slaSelRange[0] || idx > slaSelRange[1]) return false
    }
    return true
  }), [filtered, slaSelRange, slaGroupBy, slaAvailablePeriods])

  const integPorCuadrilla = useMemo(() => {
    const map = {}
    filteredInteg.forEach(s => {
      const k = s.cuadrilla || 'Sin cuadrilla'
      const apellidos = k.split(' ').slice(-2).join(' ')
      if (!map[k]) map[k] = { cuadrilla: apellidos, count: 0, sitios: [] }
      map[k].count++
      map[k].sitios.push(s.sitio)
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [filteredInteg])

  // Gráfica 3 — Comparativo por complejidad
  const porComplejidad = useMemo(() => [
    { tipo: 'Sin extras',    prom: promSinExtra, fill: '#144E4A' },
    { tipo: 'CW Conjunto',  prom: promCwConj,   fill: '#7c3aed' },
    { tipo: 'Con 5G',       prom: prom5G,       fill: '#0369a1' },
  ].filter(r => r.prom !== null), [promSinExtra, promCwConj, prom5G])

  if (rows.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      {loading ? (
        <div style={{ fontSize: 13, color: '#6b7280' }}>Cargando datos…</div>
      ) : fetchErr ? (
        <div>
          <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
            Error al obtener datos: {fetchErr}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn bp" style={{ fontSize: 12 }} onClick={() => fetchFromSheets(true)}>
              ↺ Reintentar
            </button>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>
              📂 Cargar CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Sitios con TILT',    val: filteredConTilt.length,            color: CN },
          { label: 'TILT Promedio',      val: promTilt    != null ? `${promTilt} días`    : '—', color: tiltColor(promTilt) },
          { label: 'TILT sin extras',    val: promSinExtra != null ? `${promSinExtra} días` : '—', color: tiltColor(promSinExtra) },
          { label: 'TILT con CW Conj.', val: promCwConj  != null ? `${promCwConj} días`  : '—', color: tiltColor(promCwConj) },
          { label: 'Con CW Conjunto',    val: filteredConTilt.filter(s => s.esCwConj).length, color: '#7c3aed' },
          { label: 'Con 5G',             val: filteredConTilt.filter(s => s.es5G).length,     color: '#0369a1' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e5e7eb', borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.2, marginTop: 2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Timeline slicer */}
      {mesesDisponibles.length > 0 && (() => {
        const CELL_W = slaGroupBy==='semestre' ? 88 : slaGroupBy==='trimestre' ? 68 : 52
        const yearGroups = []
        for (const k of slaAvailablePeriods) {
          const yr = k.split('-')[0]
          if (yearGroups.length && yearGroups[yearGroups.length-1].year===yr) yearGroups[yearGroups.length-1].count++
          else yearGroups.push({ year:yr, count:1 })
        }
        const selLabel = slaSelRange
          ? slaSelRange[0]===slaSelRange[1]
            ? _getPeriodLabel(slaAvailablePeriods[slaSelRange[0]], slaGroupBy)
            : `${_getPeriodLabel(slaAvailablePeriods[slaSelRange[0]], slaGroupBy)} – ${_getPeriodLabel(slaAvailablePeriods[slaSelRange[1]], slaGroupBy)}`
          : 'Todos los períodos'
        return (
          <div style={{ marginBottom:14, background:'#f8faf8', borderRadius:8, padding:'8px 10px', border:'1px solid #e8eae8' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#0369a1', minWidth:120 }}>{selLabel}</span>
              <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                {slaSelRange && (
                  <button onClick={() => setSlaSelRange(null)} style={{ padding:'1px 7px', borderRadius:4, border:'1px solid #e5e7eb', background:'#fff', color:'#ef4444', fontSize:10, cursor:'pointer', marginRight:6 }}>✕</button>
                )}
                {['mes','trimestre','semestre'].map(g => (
                  <button key={g} onClick={() => { setSlaGroupBy(g); setSlaSelRange(null) }} style={{
                    padding:'2px 8px', borderRadius:4, border:'1px solid',
                    borderColor: slaGroupBy===g ? '#144E4A' : '#d1d5db',
                    background:  slaGroupBy===g ? '#144E4A' : '#fff',
                    color:       slaGroupBy===g ? '#fff'    : '#617561',
                    fontSize:9, fontWeight:600, cursor:'pointer', textTransform:'uppercase', letterSpacing:.4,
                  }}>{g}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX:'auto', userSelect:'none' }}>
              <div style={{ display:'flex', paddingBottom:2 }}>
                {yearGroups.map(({ year, count }) => (
                  <div key={year} style={{ flex:`0 0 ${count*CELL_W}px`, fontSize:10, fontWeight:700, color:'#374151', paddingLeft:4, borderLeft:'2px solid #d1d5db' }}>{year}</div>
                ))}
              </div>
              <div
                style={{ display:'flex' }}
                onTouchMove={e => {
                  if (slaDragStart.current===null) return
                  const touch = e.touches[0]
                  const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-slapidx]')
                  if (!cell) return
                  const j=Number(cell.dataset.slapidx), s=slaDragStart.current
                  setSlaSelRange([Math.min(s,j), Math.max(s,j)])
                }}
                onTouchEnd={() => { slaDragStart.current=null }}
              >
                {slaAvailablePeriods.map((k,i) => {
                  const sel=slaSelRange&&i>=slaSelRange[0]&&i<=slaSelRange[1]
                  const isStart=slaSelRange&&i===slaSelRange[0], isEnd=slaSelRange&&i===slaSelRange[1]
                  return (
                    <div key={k} data-slapidx={i} style={{
                      flex:`0 0 ${CELL_W}px`, height:30,
                      background: sel?'#0369a1':'#e8eae8', color: sel?'#fff':'#617561',
                      fontSize:9, fontWeight: sel?700:400,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      borderLeft: isStart?'2px solid #0284c7':'1px solid #fff',
                      borderRight: isEnd?'2px solid #0284c7':'none',
                      borderRadius: isStart&&isEnd?4:isStart?'4px 0 0 4px':isEnd?'0 4px 4px 0':0,
                      cursor:'pointer', transition:'background .08s',
                    }}
                      onMouseDown={e => { e.preventDefault(); slaDragStart.current=i; setSlaSelRange([i,i]) }}
                      onMouseEnter={() => { if(slaDragStart.current===null) return; const s=slaDragStart.current; setSlaSelRange([Math.min(s,i),Math.max(s,i)]) }}
                      onTouchStart={() => { slaDragStart.current=i; setSlaSelRange([i,i]) }}
                    >{_getPeriodLabel(k, slaGroupBy)}</div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Filtros + recargar en una sola línea */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <div ref={cuadRef} style={{ position: 'relative', width: 200 }}>
          <div style={{ position: 'relative' }}>
            <input className="fc" style={{ fontSize: 11, width: '100%', paddingRight: 22 }}
              placeholder="Todas las cuadrillas"
              value={cuadOpen ? cuadSearch : (filCuad || '')}
              onFocus={() => { setCuadOpen(true); setCuadSearch(filCuad || '') }}
              onChange={e => { setCuadSearch(e.target.value); setCuadOpen(true) }}
              onBlur={() => setTimeout(() => setCuadOpen(false), 150)}
            />
            {filCuad && (
              <button onClick={() => { setFilCuad(''); setCuadSearch(''); setCuadOpen(false) }}
                style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#9ca3af', padding: 0, lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>
          {cuadOpen && (() => {
            const opts = cuadrillas.filter(c => !cuadSearch || c.toLowerCase().includes(cuadSearch.toLowerCase()))
            return opts.length > 0 ? (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 2,
                boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto' }}>
                {opts.map(c => (
                  <div key={c} onMouseDown={() => { setFilCuad(c); setCuadSearch(''); setCuadOpen(false) }}
                    style={{ padding: '7px 12px', fontSize: 11, cursor: 'pointer',
                      background: c === filCuad ? '#ede9fe' : '#fff', color: c === filCuad ? '#6d28d9' : '#374151' }}
                    onMouseEnter={e => e.currentTarget.style.background = c === filCuad ? '#ede9fe' : '#f3f4f6'}
                    onMouseLeave={e => e.currentTarget.style.background = c === filCuad ? '#ede9fe' : '#fff'}>
                    {c}
                  </div>
                ))}
              </div>
            ) : null
          })()}
        </div>
        <select className="fc" style={{ fontSize: 11, width: 160 }} value={filEstado} onChange={e => setFilEstado(e.target.value)}>
          {estados.map(c => <option key={c} value={c}>{c === 'TODOS' ? 'Todos los estados' : c}</option>)}
        </select>
        <select className="fc" style={{ fontSize: 11, width: 120 }} value={fil5G} onChange={e => setFil5G(e.target.value)}>
          <option value="TODOS">MOD + MOD+5G</option>
          <option value="SIN">MOD</option>
          <option value="CON">MOD+5G</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {fetchedAt && (
            <span style={{ fontSize: 10, color: '#9ca3af' }}>
              {new Date(fetchedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn" style={{ fontSize: 11 }} disabled={loading} onClick={() => fetchFromSheets(true)}>
            {loading ? 'Actualizando…' : '↺ Actualizar'}
          </button>
          <button className="btn" style={{ fontSize: 11, color: '#6b7280' }} onClick={() => fileRef.current?.click()} title="Cargar CSV manual">
            📂
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
        </div>
      </div>

      {/* Gráficas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 14, marginBottom: 20 }}>

        {/* G1 — TILT por cuadrilla */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>TILT Promedio por Cuadrilla (días)</div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={porCuadrilla} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="cuadrilla" tick={{ fontSize: 9 }} width={90} />
              <Tooltip formatter={v => [`${v} días`, 'Prom. TILT']} contentStyle={{ fontSize: 11 }} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="prom" radius={[0,4,4,0]}>
                {(() => {
                  const p = porCuadrilla.length ? Math.round(porCuadrilla.reduce((s, r) => s + r.prom, 0) / porCuadrilla.length) : 1
                  return porCuadrilla.map((r, i) => {
                    const fill = r.prom <= p       ? '#22c55e'
                      : r.prom <= p * 1.25         ? '#86efac'
                      : r.prom <= p * 1.60         ? '#f59e0b'
                      : '#ef4444'
                    return <Cell key={i} fill={fill} />
                  })
                })()}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* G2 — TILT por sitio */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", flex: 1 }}>
              TILT por Sitio (días) — ordenado de menor a mayor
            </div>
            <button onClick={() => setShowCW(v => !v)} style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', border: 'none',
              background: showCW ? '#7c3aed' : '#e5e7eb', color: showCW ? '#fff' : '#6b7280',
            }}>🔧 CW Conjunto</button>
            <button onClick={() => setShow5G(v => !v)} style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', border: 'none',
              background: show5G ? '#0369a1' : '#e5e7eb', color: show5G ? '#fff' : '#6b7280',
            }}>⚡ 5G</button>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              data={[...filteredConTilt].sort((a, b) => a.tilt - b.tilt).map(s => ({
                sitio:     s.sitio.length > 12 ? s.sitio.slice(0, 11) + '…' : s.sitio,
                sitioFull: s.sitio,
                cuadrilla: s.cuadrilla || '—',
                tilt:      s.tilt,
                esCwConj:  s.esCwConj,
                es5G:      s.es5G,
              }))}
              margin={{ left: 0, right: 8, top: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sitio" tick={{ fontSize: 8 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} unit=" d" />
              <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                    padding: '8px 12px', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                    <div style={{ fontWeight: 700, color: '#111', marginBottom: 2 }}>{d.sitioFull}</div>
                    <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 4 }}>LC: {d.cuadrilla}</div>
                    <div style={{ fontWeight: 700, color: '#6d28d9' }}>{d.tilt} días</div>
                  </div>
                )
              }} />
              {promTilt && <ReferenceLine y={promTilt} stroke="#9ca3af" strokeDasharray="4 4"
                label={{ value: `Prom. ${promTilt}d`, position: 'right', fontSize: 9, fill: '#6b7280' }} />}
              <Bar dataKey="tilt" radius={[4,4,0,0]}
                label={({ x, y, width, index }) => {
                  const sorted = [...filteredConTilt].sort((a, b) => a.tilt - b.tilt)
                  const s = sorted[index]
                  if (!s) return null
                  const hasCW = showCW && s.esCwConj
                  const has5G = show5G && s.es5G
                  if (!hasCW && !has5G) return null
                  const cx = x + width / 2
                  if (hasCW && has5G) return (
                    <text x={cx} y={y - 4} textAnchor="start" fontSize={9} fontWeight="800"
                      transform={`rotate(-45, ${cx}, ${y - 4})`}>
                      <tspan fill="#7c3aed">CW</tspan>
                      <tspan fill="#0369a1">+5G</tspan>
                    </text>
                  )
                  return (
                    <text x={cx} y={y - 4} textAnchor="start" fontSize={9} fontWeight="800"
                      fill={hasCW ? '#7c3aed' : '#0369a1'}
                      transform={`rotate(-45, ${cx}, ${y - 4})`}>
                      {hasCW ? 'CW' : '5G'}
                    </text>
                  )
                }}
              >
                {[...filteredConTilt].sort((a, b) => a.tilt - b.tilt).map((s, i) => {
                  const p = promTilt || 1
                  const fill = s.tilt <= p       ? '#22c55e'
                    : s.tilt <= p * 1.25         ? '#86efac'
                    : s.tilt <= p * 1.60         ? '#f59e0b'
                    : '#ef4444'
                  return <Cell key={i} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* G3 — Comparativo por complejidad */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>TILT Promedio por Complejidad (días)</div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={porComplejidad} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => [`${v} días`, 'Prom. TILT']} contentStyle={{ fontSize: 11 }} cursor={{ fill: 'transparent' }} />
              <ReferenceLine y={promTilt} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: `Prom. ${promTilt}d`, position: 'right', fontSize: 9, fill: '#6b7280' }} />
              <Bar dataKey="prom" radius={[4,4,0,0]}>
                {porComplejidad.map((r, i) => <Cell key={i} fill={r.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficas de Integración */}
      {filteredInteg.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

          {/* Integraciones por mes / por día (drill-down cuando hay 1 mes seleccionado) */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>
              {isSingleMonth
                ? <>Integraciones por Día — {_getPeriodLabel(slaAvailablePeriods[slaSelRange[0]], 'mes')} <span style={{ color: '#144E4A' }}>({integPorDia.reduce((a, v) => a + v.count, 0)})</span></>
                : 'Integraciones por Mes'}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={isSingleMonth ? integPorDia : integPorMes} margin={{ left: 0, right: 16, top: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={v => [v, 'Integraciones']} contentStyle={{ fontSize: 11 }} cursor={{ fill: 'transparent' }} />
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#7c3aed' }} activeDot={{ r: 6 }}
                  label={{ position: 'top', fontSize: 10, fill: CN, fontWeight: 700 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Integraciones por cuadrilla — barras */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>
              Integraciones por Cuadrilla
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={integPorCuadrilla} margin={{ left: 0, right: 8, top: 16, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="cuadrilla" tick={{ fontSize: 8 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 11, maxWidth: 220 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.cuadrilla} — {d.count} sitios</div>
                        {d.sitios.map((s, i) => <div key={i} style={{ fontSize: 10, color: '#6b7280' }}>• {s}</div>)}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" fill={CN} radius={[4,4,0,0]}
                  label={{ position: 'top', fontSize: 10, fill: CN, fontWeight: 700 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f5f3ff', position: 'sticky', top: 0, zIndex: 2 }}>
              {['Sitio', 'Cuadrilla', 'Estado', 'W Int', 'TI Start', 'TI Finish', 'TILT', 'Extras'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: "#6d28d9", borderBottom: "2px solid #c4b5fd", whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '6px 10px', fontWeight: 600 }}>{s.sitio}</td>
                <td style={{ padding: '6px 10px', fontSize: 11, color: '#374151' }}>{s.cuadrilla || '—'}</td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                    background: s.estado === 'Finalizado' ? '#dcfce7' : '#fef3c7',
                    color: s.estado === 'Finalizado' ? '#166534' : '#92400e' }}>
                    {s.estado || '—'}
                  </span>
                </td>
                <td style={{ padding: '6px 10px', fontSize: 11, color: '#6b7280' }}>{s.wInt || '—'}</td>
                <td style={{ padding: '6px 10px', fontSize: 11, color: '#6b7280' }}>
                  {s.tiStar ? s.tiStar.toLocaleDateString('es-CO') : '—'}
                </td>
                <td style={{ padding: '6px 10px', fontSize: 11, color: '#6b7280' }}>
                  {s.tiFinish ? s.tiFinish.toLocaleDateString('es-CO') : '—'}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{ fontWeight: 800, fontSize: 13, padding: '3px 10px', borderRadius: 8,
                    background: tiltBg(s.tilt), color: tiltColor(s.tilt) }}>
                    {s.tilt} d
                  </span>
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {s.esCwConj && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: '#f5f3ff', color: '#7c3aed' }}>CW Conjunto</span>}
                    {s.es5G    && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: '#eff6ff', color: '#1e40af' }}>5G</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
          height={280}
        >
          <BarChart
            data={chartData}
            barSize={22}
            margin={{ top: 4, right: 10, left: 10, bottom: 50 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0e8" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, angle: -35, textAnchor: 'end' }} interval={0} />
            <YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 9 }} />
            <Tooltip content={<LCProdTip />} cursor={{ fill: 'transparent' }} />
            <ReferenceLine
              y={avgVenta}
              stroke={CS}
              strokeDasharray="5 3"
              label={{ value: 'Promedio', position: 'insideTopRight', fontSize: 9, fill: CS }}
            />
            <Bar dataKey="venta" name="Producción" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    i === 0                       ? CU :
                    i === chartData.length - 1    ? CR :
                    CN
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

      {/* ── KPI: Tiempo de Liberación por Hito ── */}
      <KpiTiempoLiberacion />

    </div>
  )
}

// ── KPI Tiempo de Liberación por Hito (compartido con FactDashboard) ──
function KpiTiempoLiberacion() {
  const ppa          = useFactStore(s => s.ppa)
  const [rolloutItems, setRolloutItems] = useState(() => loadRolloutData()?.items || null)
  const [kpiGroupBy,   setKpiGroupBy]   = useState('mes')
  const [kpiSelRange,  setKpiSelRange]  = useState(null)
  const kpiDragStart = useRef(null)

  useEffect(() => {
    if (rolloutItems) return
    loadRolloutFromSupabase().then(d => { if (d?.items) setRolloutItems(d.items) })
  }, [])

  useEffect(() => {
    const onUp = () => { kpiDragStart.current = null }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [])

  const ppaLibMap = useMemo(() => {
    if (!ppa.length) return new Map()
    const m = new Map()
    for (const row of ppa) {
      const key = `${(row.smp_id||'').toUpperCase()}|${_normMs(row.ms_name)}`
      if (m.has(key)) continue
      const grDate  = _parsePpaDate(row.gr_date)
      const pctDate = _parsePpaDate(row.servicio_ejecutado_ppa_date)
      let libDate = null
      if (grDate && pctDate)                               libDate = pctDate > grDate ? pctDate : grDate
      else if (grDate && (row.servicio_ejecutado_pct||0)>0) libDate = grDate
      m.set(key, libDate)
    }
    return m
  }, [ppa])

  const siteTimings = useMemo(() => {
    if (!rolloutItems || !ppaLibMap.size) return []
    const out = []
    for (const r of rolloutItems) {
      const id     = (r.smpId||'').toUpperCase()
      const anchor = r.mosDate?.slice(0,7) || r.intgDate?.slice(0,7) || r.acepDate?.slice(0,7)
      if (!anchor) continue
      const getLib = ms => ppaLibMap.get(`${id}|${_normMs(ms)}`) || null
      const mosLib  = r.mosDate  ? getLib('SS MOS ok')              : null
      const intgLib = r.intgDate ? getLib('SS Integracion ok')      : null
      const acepLib = r.acepDate ? getLib('SS Aceptacion final ok') : null
      const mosDays  = _diffDays(r.mosDate,  mosLib)
      const intgDays = _diffDays(r.intgDate, intgLib)
      const acepDays = _diffDays(r.acepDate, acepLib)
      const totalDays = (r.mosDate && acepLib) ? _diffDays(r.mosDate, acepLib) : null
      if (mosDays===null && intgDays===null && acepDays===null) continue
      out.push({ month: anchor, mosDays, intgDays, acepDays, totalDays })
    }
    return out
  }, [rolloutItems, ppaLibMap])

  const availablePeriods = useMemo(() => {
    const seen = new Set()
    for (const s of siteTimings) seen.add(_getPeriodKey(s.month, kpiGroupBy))
    return [...seen].sort()
  }, [siteTimings, kpiGroupBy])

  const kpiTrendData = useMemo(() => {
    const buckets = new Map()
    for (const s of siteTimings) {
      const k = s.month
      if (!buckets.has(k)) buckets.set(k, { mos:[], intg:[], acep:[], total:[] })
      const b = buckets.get(k)
      if (s.mosDays   !== null) b.mos.push(s.mosDays)
      if (s.intgDays  !== null) b.intg.push(s.intgDays)
      if (s.acepDays  !== null) b.acep.push(s.acepDays)
      if (s.totalDays !== null) b.total.push(s.totalDays)
    }
    return [...buckets.keys()].sort().map(k => ({
      period: k, label: _getPeriodLabel(k, 'mes'),
      mos:   _avgArr(buckets.get(k)?.mos   || []) || null,
      intg:  _avgArr(buckets.get(k)?.intg  || []) || null,
      acep:  _avgArr(buckets.get(k)?.acep  || []) || null,
      total: _avgArr(buckets.get(k)?.total || []) || null,
    }))
  }, [siteTimings])

  const kpiSummaryBars = useMemo(() => {
    const active = kpiSelRange
      ? siteTimings.filter(s => { const idx=availablePeriods.indexOf(_getPeriodKey(s.month,kpiGroupBy)); return idx>=kpiSelRange[0]&&idx<=kpiSelRange[1] })
      : siteTimings
    const a = { mos:[], intg:[], acep:[], total:[] }
    for (const s of active) {
      if (s.mosDays   !== null) a.mos.push(s.mosDays)
      if (s.intgDays  !== null) a.intg.push(s.intgDays)
      if (s.acepDays  !== null) a.acep.push(s.acepDays)
      if (s.totalDays !== null) a.total.push(s.totalDays)
    }
    return [
      { label:'MOS',          color:'#144E4A', avg:_avgArr(a.mos),   n:a.mos.length   },
      { label:'Integración',  color:'#0369a1', avg:_avgArr(a.intg),  n:a.intg.length  },
      { label:'Acept. Final', color:'#7c3aed', avg:_avgArr(a.acep),  n:a.acep.length  },
      { label:'Ciclo Total',  color:'#059669', avg:_avgArr(a.total), n:a.total.length },
    ]
  }, [siteTimings, kpiSelRange, kpiGroupBy, availablePeriods])

  if (!rolloutItems) return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h"><h2>Tiempo de Liberación por Hito</h2></div>
      <div className="card-b" style={{ textAlign:'center', padding:'28px 0', color:'#9ca89c', fontSize:12 }}>
        Carga el Rollout en "Por Facturar" para ver este análisis.
      </div>
    </div>
  )

  if (!siteTimings.length) return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h"><h2>Tiempo de Liberación por Hito</h2></div>
      <div className="card-b" style={{ textAlign:'center', padding:'28px 0', color:'#9ca89c', fontSize:12, lineHeight:1.6 }}>
        Sin datos de tiempos de campo.<br/>
        <span style={{ fontSize:11 }}>Vuelve a cargar el Rollout en "Por Facturar" para actualizar este análisis.</span>
      </div>
    </div>
  )

  const CELL_W = kpiGroupBy==='semestre' ? 88 : kpiGroupBy==='trimestre' ? 68 : 52
  const yearGroups = []
  for (const k of availablePeriods) {
    const yr = k.split('-')[0]
    if (yearGroups.length && yearGroups[yearGroups.length-1].year===yr) yearGroups[yearGroups.length-1].count++
    else yearGroups.push({ year:yr, count:1 })
  }
  const selLabel = kpiSelRange
    ? kpiSelRange[0]===kpiSelRange[1]
      ? _getPeriodLabel(availablePeriods[kpiSelRange[0]], kpiGroupBy)
      : `${_getPeriodLabel(availablePeriods[kpiSelRange[0]], kpiGroupBy)} – ${_getPeriodLabel(availablePeriods[kpiSelRange[1]], kpiGroupBy)}`
    : 'Todos los períodos'

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        <h2>Tiempo de Liberación por Hito</h2>
        <span style={{ fontSize:10, color:'#617561', fontWeight:400 }}>días promedio · actividad en campo → GR+% en PPA</span>
      </div>
      <div className="card-b">
        {/* Timeline slicer */}
        <div style={{ marginBottom:12, background:'#f8faf8', borderRadius:8, padding:'8px 10px', border:'1px solid #e8eae8' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#0369a1', minWidth:120 }}>{selLabel}</span>
            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
              {kpiSelRange && (
                <button onClick={() => setKpiSelRange(null)} style={{ padding:'1px 7px', borderRadius:4, border:'1px solid #e5e7eb', background:'#fff', color:'#ef4444', fontSize:10, cursor:'pointer', marginRight:6 }}>✕</button>
              )}
              {['mes','trimestre','semestre'].map(g => (
                <button key={g} onClick={() => { setKpiGroupBy(g); setKpiSelRange(null) }} style={{
                  padding:'2px 8px', borderRadius:4, border:'1px solid',
                  borderColor: kpiGroupBy===g ? '#144E4A' : '#d1d5db',
                  background:  kpiGroupBy===g ? '#144E4A' : '#fff',
                  color:       kpiGroupBy===g ? '#fff'    : '#617561',
                  fontSize:9, fontWeight:600, cursor:'pointer', textTransform:'uppercase', letterSpacing:.4,
                }}>{g}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX:'auto', userSelect:'none' }}>
            <div style={{ display:'flex', paddingBottom:2 }}>
              {yearGroups.map(({ year, count }) => (
                <div key={year} style={{ flex:`0 0 ${count*CELL_W}px`, fontSize:10, fontWeight:700, color:'#374151', paddingLeft:4, borderLeft:'2px solid #d1d5db' }}>{year}</div>
              ))}
            </div>
            <div
              style={{ display:'flex' }}
              onTouchMove={e => {
                if (kpiDragStart.current===null) return
                const touch = e.touches[0]
                const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-pidx]')
                if (!cell) return
                const j=Number(cell.dataset.pidx), s=kpiDragStart.current
                setKpiSelRange([Math.min(s,j), Math.max(s,j)])
              }}
              onTouchEnd={() => { kpiDragStart.current=null }}
            >
              {availablePeriods.map((k,i) => {
                const sel=kpiSelRange&&i>=kpiSelRange[0]&&i<=kpiSelRange[1]
                const isStart=kpiSelRange&&i===kpiSelRange[0], isEnd=kpiSelRange&&i===kpiSelRange[1]
                return (
                  <div key={k} data-pidx={i} style={{
                    flex:`0 0 ${CELL_W}px`, height:30,
                    background: sel?'#0369a1':'#e8eae8', color: sel?'#fff':'#617561',
                    fontSize:9, fontWeight: sel?700:400,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    borderLeft: isStart?'2px solid #0284c7':'1px solid #fff',
                    borderRight: isEnd?'2px solid #0284c7':'none',
                    borderRadius: isStart&&isEnd?4:isStart?'4px 0 0 4px':isEnd?'0 4px 4px 0':0,
                    cursor:'pointer', transition:'background .08s',
                  }}
                    onMouseDown={e => { e.preventDefault(); kpiDragStart.current=i; setKpiSelRange([i,i]) }}
                    onMouseEnter={() => { if(kpiDragStart.current===null) return; const s=kpiDragStart.current; setKpiSelRange([Math.min(s,i),Math.max(s,i)]) }}
                    onTouchStart={() => { kpiDragStart.current=i; setKpiSelRange([i,i]) }}
                  >{_getPeriodLabel(k, kpiGroupBy)}</div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Gráficas */}
        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          {/* Tendencia mensual */}
          <div style={{ flex:'1 1 0', minWidth:0 }}>
            <div style={{ fontSize:10, color:'#9ca89c', marginBottom:4 }}>Tendencia mensual</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={(() => {
                if (!kpiSelRange) return kpiTrendData
                const selKeys = new Set(availablePeriods.slice(kpiSelRange[0], kpiSelRange[1]+1))
                return kpiTrendData.filter(d => selKeys.has(_getPeriodKey(d.period, kpiGroupBy)))
              })()} margin={{ top:16, right:8, bottom:0, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize:9, fill:'#9ca89c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:'#9ca89c' }} axisLine={false} tickLine={false} width={32} tickFormatter={v=>`${v}d`} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active||!payload?.length) return null
                  return (
                    <div style={{ background:'#fff', border:'1px solid #e0e4e0', borderRadius:8, padding:'8px 12px', fontSize:10, boxShadow:'0 4px 12px rgba(0,0,0,.08)' }}>
                      <div style={{ fontWeight:700, marginBottom:4, color:'#374151' }}>{label}</div>
                      {payload.map(p => p.value!=null && (
                        <div key={p.dataKey} style={{ color:p.color, display:'flex', justifyContent:'space-between', gap:12 }}>
                          <span>{p.name}</span><strong>{p.value}d</strong>
                        </div>
                      ))}
                    </div>
                  )
                }} />
                <Line type="monotone" dataKey="total" name="Ciclo Total"  stroke="#059669" strokeWidth={2.5} dot={{ r:3, fill:'#059669' }} connectNulls />
                <Line type="monotone" dataKey="acep"  name="Acept. Final" stroke="#7c3aed" strokeWidth={1.5} dot={{ r:2 }} strokeDasharray="4 2" connectNulls />
                <Line type="monotone" dataKey="intg"  name="Integración"  stroke="#0369a1" strokeWidth={1.5} dot={{ r:2 }} strokeDasharray="4 2" connectNulls />
                <Line type="monotone" dataKey="mos"   name="MOS"          stroke="#144E4A" strokeWidth={1.5} dot={{ r:2 }} strokeDasharray="4 2" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:6, paddingLeft:4 }}>
              {[['#059669','Ciclo Total'],['#7c3aed','Acept. Final'],['#0369a1','Integración'],['#144E4A','MOS']].map(([c,l]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:14, height:2.5, background:c, borderRadius:2 }} />
                  <span style={{ fontSize:9, color:'#617561' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Barras de resumen */}
          <div style={{ flex:'0 0 200px', minWidth:160 }}>
            <div style={{ fontSize:10, color:'#9ca89c', marginBottom:4 }}>
              {kpiSelRange ? `${kpiSelRange[1]-kpiSelRange[0]+1} período(s) seleccionado(s)` : 'Todos los períodos'}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kpiSummaryBars} margin={{ top:24, right:8, bottom:0, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize:9, fontWeight:600, fill:'#374151' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:'#9ca89c' }} axisLine={false} tickLine={false} width={32} tickFormatter={v=>`${v}d`} />
                <Tooltip cursor={{ fill:'#f8faf8' }} content={({ active, payload }) => {
                  if (!active||!payload?.length) return null
                  const d=payload[0].payload; if (!d.n) return null
                  return (
                    <div style={{ background:'#fff', border:'1px solid #e0e4e0', borderRadius:8, padding:'8px 12px', fontSize:10, boxShadow:'0 4px 12px rgba(0,0,0,.08)' }}>
                      <div style={{ fontWeight:700, color:d.color, marginBottom:3 }}>{d.label}</div>
                      <div>Promedio: <strong>{d.avg} días</strong></div>
                      <div style={{ color:'#617561' }}>n = {d.n} SMPs</div>
                    </div>
                  )
                }} />
                <Bar dataKey="avg" radius={[5,5,0,0]} label={{ position:'top', fontSize:11, fontWeight:700, fill:'#09090b', formatter:v=>v>0?`${v}d`:'' }}>
                  {kpiSummaryBars.map((e,i) => <Cell key={i} fill={e.n>0?e.color:'#e5e7eb'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', justifyContent:'space-around', marginTop:2 }}>
              {kpiSummaryBars.map(h => (
                <div key={h.label} style={{ textAlign:'center', fontSize:9, color:'#9ca89c' }}>{h.n>0?`n=${h.n}`:'—'}</div>
              ))}
            </div>
          </div>
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
  const loadData         = useAppStore(s => s.loadData)
  const user             = useAuthStore(s => s.user)

  // Refresca datos al montar — garantiza que pct_m1 y otros cambios
  // hechos en Liquidador (mismo o diferente dispositivo) sean visibles
  // sin necesidad de F5.
  useEffect(() => { loadData() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

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

  // Al entrar a la pestaña Producción recarga para asegurar datos frescos
  function handleTab(id) {
    setTab(id)
    if (id === 5) loadData()
  }

  function setFilter(field, value) {
    if (field === '__reset__') { setFilters({ ...INIT_FILTERS, tipo: roleFilter }); return }
    if (field === 'tipo' && roleFilter !== 'TODOS') return
    setFilters(f => {
      const next = { ...f, [field]: value }
      if (field === 'fechaDesde' && value) {
        next.fechaHasta = new Date().toISOString().split('T')[0]
      }
      return next
    })
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
      if (filters.cuadrilla && !matchTipoCuadrilla(s, subcs, filters.cuadrilla)) return false
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
    { id: 6, label: 'SLA & KPI'          },
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
              onClick={() => handleTab(t.id)}
              style={{
                padding: '7px 16px', fontSize: 11, fontWeight: 700,
                border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === t.id ? '#6d28d9' : 'transparent',
                color:      tab === t.id ? '#f5f3ff'  : '#555f55',
                borderBottom: tab === t.id ? '2px solid #6d28d9' : 'none',
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
      {tab === 6 && <Tab6 />}

    </div>
  )
}
