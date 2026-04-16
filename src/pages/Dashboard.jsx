import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { calcSitio, hasSN } from '../lib/calcSitio'
import { cop, pct, mcls, mfcls, MESES_FULL } from '../lib/catalog'
import { buildTCOptions, matchTipoCuadrilla, buildTiposCuadrilla, sinExternas } from '../lib/cuadrilla'
import NuevoSitioModal from '../modals/NuevoSitioModal'
import NuevoTSSModal from '../modals/NuevoTSSModal'

const YEARS = ['2026', '2025', '2024']

function StatCard({ label, value, sub, borderColor }) {
  return (
    <div className="stat" style={{ borderLeftColor: borderColor || 'var(--g)' }}>
      <div className="sl">{label}</div>
      <div className="sv">{value}</div>
      {sub && <div className="ss">{sub}</div>}
    </div>
  )
}

function TipoBadge({ sitio }) {
  if (hasSN(sitio)) return <span className="badge" style={{ background: '#1a1a1a', color: '#fff', fontSize: 8 }}>TI (SN)</span>
  if (sitio.tipo === 'TSS') return <span className="badge bg-b" style={{ fontSize: 8 }}>TSS</span>
  return <span className="badge bg-k" style={{ fontSize: 8 }}>TI</span>
}

function DateFilter({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const { year, mes } = value

  function label() {
    if (year === 'todos') return 'Todas las Fechas'
    if (mes === 'todos') return year
    return `${MESES_FULL[parseInt(mes)]} ${year}`
  }

  function pick(y, m) {
    onChange({ year: y, mes: String(m) })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn bou btn-sm"
        onClick={() => setOpen(o => !o)}
        style={{ whiteSpace: 'nowrap' }}
      >
        {label()} ▾
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 400 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            background: '#fff', border: '1px solid #e0e4e0', borderRadius: 8,
            boxShadow: '0 2px 12px rgba(0,0,0,.1)', zIndex: 500,
            minWidth: 200, padding: 8,
          }}>
            <div
              className="fp-all"
              style={{ fontSize: 10, padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #e0e4e0', marginBottom: 4, fontWeight: 600 }}
              onClick={() => { pick('todos', 'todos'); setOpen(false) }}
            >
              ✓ Todas las Fechas
            </div>
            {YEARS.map(y => (
              <div key={y}>
                <div
                  style={{
                    fontWeight: 700, fontSize: 11, padding: '4px 8px', cursor: 'pointer', borderRadius: 4,
                    background: year === y && mes === 'todos' ? '#e8f7e8' : 'transparent',
                    color: year === y && mes === 'todos' ? '#0d6e0d' : 'inherit',
                  }}
                  onClick={() => { pick(y, 'todos'); setOpen(false) }}
                >
                  {year === y ? '▾ ' : '▸ '}{y}
                </div>
                {year === y && MESES_FULL.map((m, mi) => (
                  <div
                    key={mi}
                    style={{
                      fontSize: 10, padding: '3px 8px 3px 24px', cursor: 'pointer', borderRadius: 4,
                      background: mes === String(mi) ? '#e8f7e8' : 'transparent',
                      color: mes === String(mi) ? '#0d6e0d' : 'inherit',
                      fontWeight: mes === String(mi) ? 700 : 400,
                    }}
                    onClick={() => { pick(y, mi); setOpen(false) }}
                  >
                    {m}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [search,      setSearch]      = useState('')
  const [dateFilter,  setDateFilter]  = useState({ year: 'todos', mes: 'todos' })
  const [cuadrilla,   setCuadrilla]   = useState('todos')
  const [modalSitio,  setModalSitio]  = useState(false)
  const [modalTSS,    setModalTSS]    = useState(false)

  const sitios           = useAppStore(s => s.sitios)
  const gastos           = useAppStore(s => s.gastos)
  const subcs            = useAppStore(s => s.subcs)
  const catalogTI        = useAppStore(s => s.catalogTI)
  const liquidaciones_cw = useAppStore(s => s.liquidaciones_cw)
  const empresaConfig    = useAppStore(s => s.empresaConfig)
  const user         = useAppStore(s => s.user)
  const navigate     = useNavigate()

  const isAdmin  = user?.role === 'admin'
  const isViewer = user?.role === 'viewer'

  // Cuadrilla selector options — empresa-named defaults + actual subcs, no "externa"
  const tcOpts = useMemo(() => {
    const nombreCorto = empresaConfig?.nombre_corto || 'Ingetel'
    const base     = buildTiposCuadrilla(nombreCorto)
    const fromSubcs = sinExternas(subcs.map(s => s.tipoCuadrilla).filter(Boolean))
    const tipos = [...new Set([...base, ...fromSubcs])].sort()
    return buildTCOptions(tipos)
  }, [subcs, empresaConfig])

  // Filter + sort sites
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const { year, mes } = dateFilter
    return sitios.filter(s => {
      if (!matchTipoCuadrilla(s, subcs, cuadrilla)) return false
      if (year !== 'todos' || mes !== 'todos') {
        if (!s.fecha) return false
        const d = new Date(s.fecha)
        if (year !== 'todos' && d.getFullYear() !== parseInt(year)) return false
        if (mes  !== 'todos' && d.getMonth() !== parseInt(mes))    return false
      }
      if (q) {
        const hay = `${s.nombre} ${s.lc} ${s.ciudad} ${s.cat}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
  }, [sitios, search, dateFilter, cuadrilla, subcs])

  // Calculations
  const calcs = useMemo(
    () => filtered.map(s => ({ s, c: calcSitio(s, gastos, subcs, catalogTI, liquidaciones_cw) })),
    [filtered, gastos, subcs, catalogTI, liquidaciones_cw]
  )

  const totals = useMemo(() => {
    const tV = calcs.reduce((acc, { c }) => acc + c.totalVenta, 0)
    const tC = calcs.reduce((acc, { c }) => acc + c.totalCosto, 0)
    const tU = tV - tC
    return { tV, tC, tU, avgM: tV > 0 ? tU / tV : 0 }
  }, [calcs])

  const { tV, tC, tU, avgM } = totals
  const marginColor = avgM >= 0.3 ? '#1a7a1a' : avgM >= 0.2 ? '#FFC000' : '#c0392b'

  const REGION_SHORT = {
    'R1 – Costa':        'Cta',
    'R2 – Noroccidente': 'NOC',
    'R3 – Suroccidente': 'SOC',
    'R4 – Centro':       'CTO',
    'R5 – Oriente':      'ORI',
  }
  function regionShort(region) {
    if (!region) return '—'
    return REGION_SHORT[region] || region.split('–')[0].trim()
  }

  return (
    <>
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="fb mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Proyecto Nokia 2026
        </h1>
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          <input
            type="text" className="fc"
            placeholder="🔍 Buscar sitio…"
            style={{ width: 160 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <DateFilter value={dateFilter} onChange={setDateFilter} />
          <select className="fc" style={{ width: 170 }} value={cuadrilla} onChange={e => setCuadrilla(e.target.value)}>
            {tcOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!isViewer && (
            <>
              <button className="btn bp no-print" onClick={() => setModalSitio(true)}>＋ Nuevo Sitio</button>
              <button className="btn bo no-print" onClick={() => setModalTSS(true)}>＋ TSS</button>
            </>
          )}
        </div>
      </div>

      {/* ── Stats cards ──────────────────────────────────────── */}
      <div className="g5 mb14">
        <StatCard
          label="Total Sitios"
          value={<span style={{ fontSize: 24, fontWeight: 500 }}>{filtered.length}</span>}
          sub={`${filtered.filter(s => s.tipo === 'TSS').length} TSS · ${filtered.filter(s => s.tipo === 'TI').length} TI`}
        />
        <StatCard
          label="Venta Nokia"
          value={<span style={{ fontSize: 17, color: 'var(--b)', fontWeight: 500 }}>{cop(tV)}</span>}
          sub="TI+ADJ+CW+CR"
          borderColor="var(--b)"
        />
        <StatCard
          label="Costo SubC"
          value={<span style={{ fontSize: 17, color: '#b45309', fontWeight: 500 }}>{cop(tC)}</span>}
          sub="SubC+Mat+Log+Adic"
          borderColor="#b45309"
        />
        <StatCard
          label="Utilidad"
          value={<span style={{ fontSize: 17, color: '#1a7a1a', fontWeight: 500 }}>{cop(tU)}</span>}
          sub={`Margen: ${pct(avgM)}`}
          borderColor="#1a7a1a"
        />
        <StatCard
          label="Margen Promedio"
          value={<span style={{ fontSize: 20, fontWeight: 500, color: marginColor }}>{pct(avgM)}</span>}
          sub={`Utilidad: ${cop(tU)}`}
          borderColor={marginColor}
        />
      </div>

      {/* ── Main grid: tabla + sidebar ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 }}>
        {/* Sites table */}
        <div className="card">
          <div className="card-h"><h2>Sitios del Proyecto</h2></div>
          <div style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
            <table className="tbl" id="tbl-dash">
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th>Sitio</th>
                  <th>LC</th>
                  <th>Liquidación</th>
                  <th>Región</th>
                  <th className="num th-nokia">Venta Nokia</th>
                  <th className="num th-subc">Costo SubC</th>
                  <th className="num">Utilidad</th>
                  <th className="num">% Margen</th>
                </tr>
              </thead>
              <tbody>
                {calcs.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>
                      {sitios.length === 0 ? 'Sin sitios — cargando datos…' : 'Sin resultados para los filtros aplicados'}
                    </td>
                  </tr>
                )}
                {calcs.map(({ s, c }) => (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span
                        className="stat-link"
                        style={{ fontWeight: 700 }}
                        onClick={() => navigate(`/liquidador/${s.id}`)}
                        title="Abrir liquidador"
                      >
                        {s.nombre}
                      </span>
                      {' '}<TipoBadge sitio={s} />
                      {s.catEfectiva && (
                        <span style={{
                          background: '#7c3aed', color: '#fff', borderRadius: '50%',
                          width: 14, height: 14, display: 'inline-flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 8, fontWeight: 800, marginLeft: 3,
                        }}>E</span>
                      )}
                    </td>
                    <td style={{ fontSize: 10 }}>{s.lc}</td>
                    <td>
                      {s.estado === 'final'
                        ? <span className="badge" style={{ background: '#1a7a1a', color: '#fff', fontSize: 9, padding: '2px 8px' }}>FINAL</span>
                        : <span className="badge" style={{ background: '#d68910', color: '#fff', fontSize: 9, padding: '2px 8px' }}>PRE</span>
                      }
                    </td>
                    <td><span className="badge bg-b" style={{ fontSize: 8 }}>{regionShort(s.region)}</span></td>
                    <td className="num" style={{ color: 'var(--b)', fontWeight: 700 }}>{cop(c.totalVenta)}</td>
                    <td className="num" style={{ color: '#b45309' }}>{cop(c.totalCosto)}</td>
                    <td className={`num fw7 ${c.utilidad >= 0 ? 'tg' : 'tr'}`}>{cop(c.utilidad)}</td>
                    <td className="num">
                      <span className={`badge ${mcls(c.margen)}`}>{pct(c.margen)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Margin bars */}
          <div className="card">
            <div className="card-h"><h2>Márgenes</h2></div>
            <div className="card-b" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
              {calcs.length === 0 && (
                <p style={{ fontSize: 11, color: '#9ca89c', textAlign: 'center' }}>Sin datos</p>
              )}
              {calcs.map(({ s, c }) => (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  <div className="fb" style={{ marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600 }}>{s.nombre}</span>
                    <span style={{ fontSize: 10, color: '#555f55' }}>{pct(c.margen)}</span>
                  </div>
                  <div className="mbar">
                    <div className={`mfill ${mfcls(c.margen)}`} style={{ width: `${Math.min(c.margen * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          {!isViewer && (
            <div className="card">
              <div className="card-h"><h2>Acciones Rápidas</h2></div>
              <div className="card-b" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn bp btn-lg" onClick={() => setModalSitio(true)}>＋ Sitio TI</button>
                <button className="btn bo btn-lg" onClick={() => setModalTSS(true)}>＋ TSS</button>
                <button className="btn bd btn-lg" onClick={() => alert('TODO: Gastos')}>＋ Gastos</button>
                <button className="btn bk btn-lg" onClick={() => alert('TODO: Exportar')}>⬇ Exportar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────── */}
      <NuevoSitioModal
        open={modalSitio}
        onClose={() => setModalSitio(false)}
        onCreated={sitio => navigate(`/liquidador/${sitio.id}`)}
      />
      <NuevoTSSModal
        open={modalTSS}
        onClose={() => setModalTSS(false)}
        onCreated={sitio => navigate(`/liquidador/${sitio.id}`)}
      />
    </>
  )
}
