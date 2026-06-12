import { useState, useMemo, useEffect } from 'react'
import { useAppStore }     from '../store/useAppStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { useAuthStore }    from '../store/authStore'
import { calcSitio }       from '../lib/calcSitio'
import { cop, pct }        from '../lib/catalog'
import { matchTipoCuadrilla } from '../lib/cuadrilla'
import { KpiCard, mCol, CN, CU, CR }  from './analitica/helpers'
import FilterBar from './analitica/FilterBar'
import Tab1 from './analitica/Tab1'
import Tab2 from './analitica/Tab2'
import Tab3 from './analitica/Tab3'
import Tab4 from './analitica/Tab4'
import Tab5 from './analitica/Tab5'
import Tab6 from './analitica/Tab6'

const INIT_FILTERS = { tipo: 'TODOS', lc: '', cuadrilla: '', fechaDesde: '', fechaHasta: '', region: 'TODOS', estado: 'TODOS' }

const TABS = [
  { id: 1, label: 'Rendimiento LC'     },
  { id: 2, label: 'Por Sitio'          },
  { id: 3, label: 'Tendencia Temporal' },
  { id: 4, label: 'Composición'        },
  { id: 5, label: 'Producción'         },
  { id: 6, label: 'SLA & KPI'          },
]

export default function AnaliticaPage() {
  const sitios           = useAppStore(s => s.sitios)
  const gastos           = useAppStore(s => s.gastos)
  const subcs            = useAppStore(s => s.subcs)
  const catalogTI        = useCatalogStore(s => s.catalogTI)
  const liquidaciones_cw = useAppStore(s => s.liquidaciones_cw)
  const loadData         = useAppStore(s => s.loadData)
  const user             = useAuthStore(s => s.user)

  useEffect(() => { loadData() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const roleFilter = useMemo(() => {
    if (user?.role === 'TI')  return 'TI'
    if (user?.role === 'TSS') return 'TSS'
    if (user?.role === 'CW')  return 'CW'
    return 'TODOS'
  }, [user?.role])

  const [filters, setFilters] = useState(() => ({ ...INIT_FILTERS, tipo: roleFilter }))
  const [tab, setTab]         = useState(1)

  useEffect(() => {
    if (roleFilter !== 'TODOS') setFilters(f => ({ ...f, tipo: roleFilter }))
  }, [roleFilter])

  function handleTab(id) {
    setTab(id)
    if (id === 5) loadData()
  }

  function setFilter(field, value) {
    if (field === '__reset__') { setFilters({ ...INIT_FILTERS, tipo: roleFilter }); return }
    if (field === 'tipo' && roleFilter !== 'TODOS') return
    setFilters(f => {
      const next = { ...f, [field]: value }
      if (field === 'fechaDesde' && value) next.fechaHasta = new Date().toISOString().split('T')[0]
      return next
    })
  }

  const filteredSitios = useMemo(() => {
    return sitios.filter(s => {
      if (filters.tipo !== 'TODOS') {
        if (filters.tipo === 'TSS' && s.tipo !== 'TSS') return false
        if (filters.tipo === 'TI'  && s.tipo === 'TSS') return false
        if (filters.tipo === 'CW'  && !s.tiene_cw) return false
      }
      if (filters.lc && s.lc !== filters.lc) return false
      if (filters.cuadrilla && !matchTipoCuadrilla(s, subcs, filters.cuadrilla)) return false
      if (filters.region !== 'TODOS' && (s.region || '') !== filters.region) return false
      if (filters.estado !== 'TODOS' && s.estado !== filters.estado) return false
      if (filters.fechaDesde && s.fecha && s.fecha < filters.fechaDesde) return false
      if (filters.fechaHasta && s.fecha && s.fecha > filters.fechaHasta) return false
      return true
    })
  }, [sitios, subcs, filters])

  const filteredCalcs = useMemo(
    () => filteredSitios.map(s => ({ s, c: calcSitio(s, gastos, subcs, catalogTI, liquidaciones_cw) })),
    [filteredSitios, gastos, subcs, catalogTI, liquidaciones_cw]
  )

  const totals = useMemo(() => {
    const tV = filteredCalcs.reduce((s, { c }) => s + c.totalVenta, 0)
    const tC = filteredCalcs.reduce((s, { c }) => s + c.totalCosto, 0)
    const m  = tV > 0 ? (tV - tC) / tV : 0
    return { tV, tC, tU: tV - tC, m }
  }, [filteredCalcs])

  const kpis = useMemo(() => {
    if (!filteredCalcs.length) return {}
    const sorted   = [...filteredCalcs].sort((a, b) => b.c.margen - a.c.margen)
    const best     = sorted[0]
    const worst    = sorted[sorted.length - 1]
    const byVenta  = [...filteredCalcs].sort((a, b) => b.c.totalVenta - a.c.totalVenta)[0]
    const byLC     = {}
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
      name, venta: v.venta, costo: v.costo, sitios: v.count,
      margen: v.venta > 0 ? parseFloat(((v.venta - v.costo) / v.venta * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.venta - a.venta)
  }, [filteredCalcs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div className="fb">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Analítica del Proyecto
        </h1>
        <span style={{ fontSize: 11, color: CN, fontWeight: 600 }}>
          {filteredSitios.length} / {sitios.length} sitios
        </span>
      </div>

      <FilterBar filters={filters} setFilter={setFilter} sitios={sitios} subcs={subcs} />

      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: '#f0f2f0', paddingBottom: 4,
        boxShadow: '0 3px 10px rgba(0,0,0,.07)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
          <div className="g3">
            <KpiCard label="Sitio — Mejor Margen"  value={kpis.best?.s.nombre  || '—'} sub={kpis.best  ? pct(kpis.best.c.margen)  : ''} color={CU} />
            <KpiCard label="Sitio — Menor Margen"  value={kpis.worst?.s.nombre || '—'} sub={kpis.worst ? pct(kpis.worst.c.margen) : ''} color={CR} />
            <KpiCard label="Sitio — Mayor Venta"   value={kpis.byVenta?.s.nombre || '—'} sub={kpis.byVenta ? cop(kpis.byVenta.c.totalVenta) : ''} color={CN} />
          </div>
          <div className="g3">
            <KpiCard label="LC — Más Rentable"          value={kpis.bestLC?.lc || '—'} sub={kpis.bestLC ? pct(kpis.bestLC.margen) : ''} color={CU} />
            <KpiCard label="Total Venta (filtrado)"      value={cop(totals.tV)} color={CN} />
            <KpiCard label="Margen Promedio (filtrado)"  value={pct(totals.m)}  color={mCol(totals.m)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e0e4e0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => handleTab(t.id)} style={{
              padding: '7px 16px', fontSize: 11, fontWeight: 700,
              border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
              background: tab === t.id ? '#6d28d9' : 'transparent',
              color:      tab === t.id ? '#f5f3ff'  : '#555f55',
              borderBottom: tab === t.id ? '2px solid #6d28d9' : 'none',
              marginBottom: -2,
            }}>
              {t.id}. {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 1 && <Tab1 porLC={porLC} />}
      {tab === 2 && <Tab2 filteredCalcs={filteredCalcs} />}
      {tab === 3 && <Tab3 filteredCalcs={filteredCalcs} />}
      {tab === 4 && <Tab4 filteredCalcs={filteredCalcs} porLC={porLC} />}
      {tab === 5 && <Tab5 filteredCalcs={filteredCalcs} subcs={subcs} />}
      {tab === 6 && <Tab6 />}

    </div>
  )
}
