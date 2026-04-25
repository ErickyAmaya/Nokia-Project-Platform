import { useMemo, useState } from 'react'
import { useAckStore, PROCESOS } from '../../store/useAckStore'

function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

// Badge compacto de estado por proceso
function ProcBadge({ val, color }) {
  if (!val) return <span style={{ fontSize: 9, color: '#ddd' }}>—</span>
  const fin = isFinal(val)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%',
      background: fin ? '#dcfce7' : '#fee2e2',
      color:      fin ? '#166534' : '#991b1b',
      fontSize: 10, fontWeight: 800,
      title: val,
    }} title={val}>
      {fin ? '✓' : '●'}
    </span>
  )
}

// Barra de progreso compacta
function MiniBar({ pct, color }) {
  const c = pct >= 100 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#e5e7eb', borderRadius: 3, minWidth: 60 }}>
        <div style={{ height: 5, borderRadius: 3, background: c, width: `${Math.min(pct, 100)}%`, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: c, minWidth: 30 }}>{pct}%</span>
    </div>
  )
}

// Fila de un SMP hijo
function SmpRow({ r }) {
  const todoFin = PROCESOS.every(p => isFinal(r[p.key]))
  return (
    <tr style={{ background: todoFin ? '#f0fdf4' : '#fafafa', opacity: todoFin ? 0.75 : 1 }}>
      <td style={{ paddingLeft: 36, fontFamily: 'monospace', fontSize: 8, color: '#666' }}>{r.smp}</td>
      <td style={{ fontSize: 9, color: '#888' }}>{r.sub_proyecto || '—'}</td>
      <td style={{ fontSize: 9, color: todoFin ? '#9ca89c' : '#ef4444', fontWeight: 700 }}>
        {r.semanas_integracion || '—'} sem
      </td>
      {PROCESOS.map(p => (
        <td key={p.key} style={{ textAlign: 'center' }}>
          <ProcBadge val={r[p.key]} color={p.color} />
        </td>
      ))}
    </tr>
  )
}

// Fila colapsable de un sitio
function SitioRow({ mainSmp, smps }) {
  const [open, setOpen] = useState(false)

  // Calcular % global del sitio: promedio de los 5 procesos
  const stats = useMemo(() => {
    const total = smps.length
    if (!total) return { pct: 0, todos: false, algPend: false }
    const porProceso = PROCESOS.map(p => {
      const fin = smps.filter(r => isFinal(r[p.key])).length
      return { key: p.key, pct: Math.round((fin / total) * 100), fin, total }
    })
    const pctGlobal = Math.round(porProceso.reduce((s, p) => s + p.pct, 0) / porProceso.length)
    const todos = porProceso.every(p => p.pct === 100)
    return { pct: pctGlobal, todos, porProceso }
  }, [smps])

  const siteName = smps[0]?.site_name || mainSmp
  const region   = smps[0]?.region   || '—'
  const rowBg    = stats.todos ? '#f0fdf4' : open ? '#f8faff' : '#fff'

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{
          background: rowBg, cursor: 'pointer',
          borderLeft: `3px solid ${stats.todos ? '#22c55e' : stats.pct >= 80 ? '#f59e0b' : '#ef4444'}`,
          transition: 'background .15s',
        }}
      >
        {/* Toggle */}
        <td style={{ width: 28, textAlign: 'center', fontSize: 10, color: '#9ca89c', userSelect: 'none' }}>
          {open ? '▼' : '▶'}
        </td>

        {/* Sitio */}
        <td style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
          {siteName}
          {stats.todos && (
            <span style={{
              marginLeft: 8, fontSize: 8, fontWeight: 800, color: '#166534',
              background: '#dcfce7', borderRadius: 10, padding: '1px 7px',
            }}>
              ✓ CERRADO
            </span>
          )}
        </td>

        {/* Main SMP */}
        <td style={{ fontFamily: 'monospace', fontSize: 8, color: '#888', whiteSpace: 'nowrap' }}>{mainSmp}</td>

        {/* Región */}
        <td style={{ fontSize: 9, color: '#666' }}>{region}</td>

        {/* SMPs */}
        <td style={{ fontSize: 9, textAlign: 'center', color: '#9ca89c' }}>{smps.length}</td>

        {/* % global */}
        <td style={{ minWidth: 110 }}>
          <MiniBar pct={stats.pct} />
        </td>

        {/* Badge por proceso */}
        {stats.porProceso?.map(p => {
          const proc = PROCESOS.find(x => x.key === p.key)
          return (
            <td key={p.key} style={{ textAlign: 'center', minWidth: 60 }}>
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: p.pct === 100 ? '#166534' : p.pct >= 80 ? '#854d0e' : '#991b1b',
              }}>
                {p.pct}%
              </span>
            </td>
          )
        })}
      </tr>

      {/* Hijos expandidos */}
      {open && smps.map(r => <SmpRow key={r.smp} r={r} />)}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function AckSitios() {
  const sabana = useAckStore(s => s.sabana)

  const [region,   setRegion]   = useState('')
  const [soloPend, setSoloPend] = useState(false)
  const [search,   setSearch]   = useState('')

  const regiones = useMemo(() =>
    [...new Set(sabana.map(r => r.region).filter(Boolean))].sort()
  , [sabana])

  // Agrupar por main_smp
  const sitios = useMemo(() => {
    const map = {}
    for (const r of sabana) {
      if (!r.main_smp) continue
      if (!map[r.main_smp]) map[r.main_smp] = []
      map[r.main_smp].push(r)
    }
    return Object.entries(map)
      .map(([mainSmp, smps]) => {
        const todoFin = PROCESOS.every(p => smps.every(r => isFinal(r[p.key])))
        return { mainSmp, smps, todoFin }
      })
      .filter(({ mainSmp, smps, todoFin }) => {
        if (region   && smps[0]?.region    !== region)  return false
        if (soloPend && todoFin)                         return false
        if (search   && !smps[0]?.site_name?.toLowerCase().includes(search.toLowerCase()) &&
            !mainSmp.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        // Pendientes primero, luego por nombre de sitio
        if (a.todoFin !== b.todoFin) return a.todoFin ? 1 : -1
        return (a.smps[0]?.site_name || '').localeCompare(b.smps[0]?.site_name || '')
      })
  }, [sabana, region, soloPend, search])

  const totalSitios  = sitios.length
  const sitiosCerrados = sitios.filter(s => s.todoFin).length

  return (
    <div>
      {/* Header */}
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            ACK — Vista por Sitio
          </h1>
          <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 2 }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{totalSitios - sitiosCerrados} pendientes</span>
            {' · '}
            <span style={{ color: '#22c55e', fontWeight: 700 }}>{sitiosCerrados} cerrados</span>
            {' · '}{totalSitios} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="fc" type="text"
            placeholder="🔍 Buscar sitio…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 180, fontSize: 11 }}
          />
          <select className="fc" value={region} onChange={e => setRegion(e.target.value)} style={{ fontSize: 11 }}>
            <option value="">Todas las Regiones</option>
            {regiones.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={() => setSoloPend(p => !p)}
            style={{
              padding: '5px 14px', border: 'none', borderRadius: 20, cursor: 'pointer',
              fontFamily: "'Barlow', sans-serif", fontSize: 10, fontWeight: 700,
              letterSpacing: .5, whiteSpace: 'nowrap',
              background: soloPend ? '#fee2e2' : '#dcfce7',
              color:      soloPend ? '#991b1b' : '#166534',
            }}
          >
            {soloPend ? '◎ Ver Todos' : '● Solo Pendientes'}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card-b" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table className="tbl" style={{ fontSize: 10, width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8', width: 28 }} />
                <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8' }}>Sitio</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8' }}>Main SMP</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8' }}>Región</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8', textAlign: 'center' }}>SMPs</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8', minWidth: 120 }}>% Global</th>
                {PROCESOS.map(p => (
                  <th key={p.key} style={{
                    position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8',
                    color: p.color, textAlign: 'center', fontSize: 8, whiteSpace: 'nowrap',
                  }}>
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sitios.length === 0 ? (
                <tr>
                  <td colSpan={6 + PROCESOS.length} style={{ textAlign: 'center', padding: 40, color: '#9ca89c' }}>
                    Sin resultados
                  </td>
                </tr>
              ) : sitios.map(({ mainSmp, smps }) => (
                <SitioRow key={mainSmp} mainSmp={mainSmp} smps={smps} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 9, color: '#9ca89c' }}>
        💡 Haz clic en una fila para ver los SMPs del sitio con el estado de cada proceso.
      </div>
    </div>
  )
}
