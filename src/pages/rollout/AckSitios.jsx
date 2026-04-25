import { useMemo, useState } from 'react'
import { useAckStore, PROCESOS } from '../../store/useAckStore'

function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

// Badge compacto de estado por proceso
function ProcBadge({ val }) {
  if (!val) return <span style={{ fontSize: 9, color: '#ddd' }}>—</span>
  const fin = isFinal(val)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%',
      background: fin ? '#dcfce7' : '#fee2e2',
      color:      fin ? '#166534' : '#991b1b',
      fontSize: 10, fontWeight: 800,
    }} title={val}>
      {fin ? '✓' : '●'}
    </span>
  )
}

// Barra de progreso compacta
function MiniBar({ pct }) {
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
  const bg = todoFin ? '#f0fdf4' : '#fafafa'
  return (
    <tr style={{ background: bg, opacity: todoFin ? 0.75 : 1 }}>
      {/* toggle vacío */}
      <td />
      {/* SMP → columna Sitio */}
      <td style={{ paddingLeft: 28, fontFamily: 'monospace', fontSize: 8, color: '#555', whiteSpace: 'nowrap' }}>{r.smp}</td>
      {/* sub_proyecto → columna Main SMP */}
      <td style={{ fontSize: 9, color: '#888' }}>{r.sub_proyecto || '—'}</td>
      {/* semanas → columna Región */}
      <td style={{ fontSize: 9, color: todoFin ? '#9ca89c' : '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {r.semanas_integracion || '—'} sem
      </td>
      {/* SMPs y %Global vacíos */}
      <td /><td />
      {/* 5 procesos */}
      {PROCESOS.map(p => (
        <td key={p.key} style={{ textAlign: 'center' }}>
          <ProcBadge val={r[p.key]} />
        </td>
      ))}
    </tr>
  )
}

// Fila colapsable de un sitio
function SitioRow({ mainSmp, smps }) {
  const [open, setOpen] = useState(false)

  const stats = useMemo(() => {
    const total = smps.length
    if (!total) return { pct: 0, todos: false, porProceso: [] }
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
        <td style={{ width: 28, textAlign: 'center', fontSize: 10, color: '#9ca89c', userSelect: 'none' }}>
          {open ? '▼' : '▶'}
        </td>
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
        <td style={{ fontFamily: 'monospace', fontSize: 8, color: '#888', whiteSpace: 'nowrap' }}>{mainSmp}</td>
        <td style={{ fontSize: 9, color: '#666' }}>{region}</td>
        <td style={{ fontSize: 9, textAlign: 'center', color: '#9ca89c' }}>{smps.length}</td>
        <td style={{ minWidth: 110 }}>
          <MiniBar pct={stats.pct} />
        </td>
        {stats.porProceso?.map(p => (
          <td key={p.key} style={{ textAlign: 'center', minWidth: 60 }}>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: p.pct === 100 ? '#166534' : p.pct >= 80 ? '#854d0e' : '#991b1b',
            }}>
              {p.pct}%
            </span>
          </td>
        ))}
      </tr>
      {open && smps.map(r => <SmpRow key={r.smp} r={r} />)}
    </>
  )
}

const FILTRO_OPTS = [
  { value: 'todos',       label: 'Ver Todos' },
  { value: 'pendientes',  label: 'Solo Pendientes' },
  { value: 'cerrados',    label: 'Solo Cerrados' },
]

const FILTRO_BADGE = {
  pendientes: { bg: '#fee2e2', color: '#991b1b', text: '● Pendientes' },
  cerrados:   { bg: '#dcfce7', color: '#166534', text: '✓ Cerrados' },
}

// ── Página principal ──────────────────────────────────────────────
export default function AckSitios() {
  const sabana = useAckStore(s => s.sabana)

  const [region, setRegion] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [search, setSearch] = useState('')

  const regiones = useMemo(() =>
    [...new Set(sabana.map(r => r.region).filter(Boolean))].sort()
  , [sabana])

  // Lista de nombres de sitio para el datalist
  const siteNames = useMemo(() =>
    [...new Set(sabana.map(r => r.site_name).filter(Boolean))].sort()
  , [sabana])

  // Agrupa por main_smp y aplica filtros de región y búsqueda (sin filtro de estado)
  const allGroups = useMemo(() => {
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
      .filter(({ mainSmp, smps }) => {
        if (region && smps[0]?.region !== region) return false
        if (search && !smps[0]?.site_name?.toLowerCase().includes(search.toLowerCase()) &&
            !mainSmp.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
  }, [sabana, region, search])

  // Aplica filtro de estado y ordena
  const sitios = useMemo(() => {
    return allGroups
      .filter(({ todoFin }) => {
        if (filtro === 'pendientes') return !todoFin
        if (filtro === 'cerrados')   return todoFin
        return true
      })
      .sort((a, b) => {
        if (a.todoFin !== b.todoFin) return a.todoFin ? 1 : -1
        return (a.smps[0]?.site_name || '').localeCompare(b.smps[0]?.site_name || '')
      })
  }, [allGroups, filtro])

  const totalAll      = allGroups.length
  const totalCerrados = allGroups.filter(s => s.todoFin).length
  const totalPend     = totalAll - totalCerrados

  const badge = FILTRO_BADGE[filtro]

  return (
    <div>
      {/* Header */}
      <div className="dash-hdr mb14">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
              ACK — Vista por Sitio
            </h1>
            {badge && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20,
                background: badge.bg, color: badge.color, whiteSpace: 'nowrap',
              }}>
                {badge.text}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{totalPend} pendientes</span>
            {' · '}
            <span style={{ color: '#22c55e', fontWeight: 700 }}>{totalCerrados} cerrados</span>
            {' · '}
            <span style={{ fontWeight: 600 }}>{totalAll} total</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Búsqueda con datalist */}
          <div style={{ position: 'relative' }}>
            <input
              className="fc"
              type="text"
              list="sitios-datalist"
              placeholder="🔍 Buscar sitio…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 200, fontSize: 11 }}
            />
            <datalist id="sitios-datalist">
              {siteNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <select className="fc" value={region} onChange={e => setRegion(e.target.value)} style={{ fontSize: 11 }}>
            <option value="">Todas las Regiones</option>
            {regiones.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select
            className="fc"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={{ fontSize: 11, fontWeight: 700 }}
          >
            {FILTRO_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
