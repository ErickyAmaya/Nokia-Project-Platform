import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ReferenceLine, Cell, ResponsiveContainer,
} from 'recharts'
import { CN } from './helpers'

// ── TILT helpers ─────────────────────────────────────────────────
function parseFecha(str) {
  if (!str) return null
  const s = str.trim()
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

// ── CSV parsing ───────────────────────────────────────────────────
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

function TimelineFilter({ mesesDisponibles, seleccion, onChange, añoActivo, onAñoChange }) {
  const dragging  = React.useRef(false)
  const dragStart = React.useRef(null)

  const años = useMemo(() => [...new Set(mesesDisponibles.map(m => m.split('-')[0]))].sort(), [mesesDisponibles])

  React.useEffect(() => {
    if (años.length && !añoActivo) onAñoChange(años[años.length - 1])
  }, [años.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  const mesesAño = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => `${añoActivo}-${String(i + 1).padStart(2, '0')}`)
  , [añoActivo])

  function rangoLabel() {
    if (seleccion.size === 0) return 'Todos los meses'
    const sorted = [...seleccion].sort()
    const [y0, m0] = sorted[0].split('-').map(Number)
    const [y1, m1] = sorted[sorted.length - 1].split('-').map(Number)
    if (sorted.length === 1) return `${MESES_SHORT[m0-1]} ${y0}`
    if (y0 === y1) return `${MESES_SHORT[m0-1]} – ${MESES_SHORT[m1-1]} ${y0}`
    return `${MESES_SHORT[m0-1]} ${y0} – ${MESES_SHORT[m1-1]} ${y1}`
  }

  function applyRange(start, end) {
    const i0 = Math.min(mesesAño.indexOf(start), mesesAño.indexOf(end))
    const i1 = Math.max(mesesAño.indexOf(start), mesesAño.indexOf(end))
    onChange(new Set(mesesAño.slice(i0, i1 + 1)))
  }

  const hoyKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const esFuturo = m => m > hoyKey

  function handleMouseDown(m, e) {
    if (esFuturo(m)) return
    e.preventDefault()
    dragging.current = true; dragStart.current = m
    if (seleccion.size === 1 && seleccion.has(m)) onChange(new Set())
    else onChange(new Set([m]))
  }
  function handleMouseEnter(m) {
    if (dragging.current && !esFuturo(m)) applyRange(dragStart.current, m)
  }
  function handleMouseUp() { dragging.current = false }

  return (
    <div onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      style={{ userSelect: 'none', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>
          {rangoLabel()}
          {seleccion.size > 0 && (
            <button onMouseDown={e => { e.stopPropagation(); onChange(new Set()) }}
              style={{ marginLeft: 8, fontSize: 9, border: 'none', background: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}>
              ✕ limpiar
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {años.map(y => (
            <button key={y} onMouseDown={e => {
              e.preventDefault()
              onAñoChange(y)
              if (seleccion.size > 0) onChange(new Set([...seleccion].map(m => `${y}-${m.split('-')[1]}`)))
            }}
              style={{
                fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 12, cursor: 'pointer', border: 'none',
                background: añoActivo === y ? '#1e40af' : '#e5e7eb',
                color:      añoActivo === y ? '#fff'    : '#6b7280',
              }}>
              {y}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {mesesAño.map(m => {
          const [, mes] = m.split('-').map(Number)
          const activo  = seleccion.size > 0 && seleccion.has(m)
          return (
            <div key={m}
              onMouseDown={e => handleMouseDown(m, e)}
              onMouseEnter={() => handleMouseEnter(m)}
              style={{
                flex: 1, textAlign: 'center',
                cursor:   esFuturo(m) ? 'not-allowed' : 'pointer',
                padding: '4px 2px', borderRadius: 3,
                background: activo ? '#1e40af' : '#e5e7eb',
                color:      activo ? '#fff'    : '#6b7280',
                opacity:    esFuturo(m) ? 0.3 : 1,
                fontSize: 9, fontWeight: 700,
              }}>
              {MESES_SHORT[mes - 1]}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────
const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSFmwCZWD4jMIPVe-tO1z8_kFkRRE8ZuQPlAvdno8XzTA0KBJHgUsoKLtzDp8U7lEPX5v6pJ_nqZWph/pub?gid=0&single=true&output=csv'
const LS_DATA  = 'tilt_csv_data'
const LS_TS    = 'tilt_csv_ts'
const CACHE_MS = 60 * 60 * 1000

export default function Tab6() {
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [fetchErr,  setFetchErr]  = useState(null)
  const [filCuad,   setFilCuad]   = useState('')
  const [filEstado, setFilEstado] = useState('TODOS')
  const [filMeses,  setFilMeses]  = useState(new Set())
  const [fil5G,     setFil5G]     = useState('TODOS')
  const [filAño,    setFilAño]    = useState(null)
  const [showCW,    setShowCW]    = useState(false)
  const [show5G,    setShow5G]    = useState(false)
  const fileRef = React.useRef()

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

  React.useEffect(() => { fetchFromSheets() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        tiStar, tiFinish, tilt, esCwConj, es5G, integracionReal,
      }
    }).filter(s => s.sitio)
  }, [rows])

  const cuadrillas = useMemo(() => [...new Set(sitios.map(s => s.cuadrilla).filter(Boolean))].sort(), [sitios])
  const estados    = useMemo(() => ['TODOS', ...new Set(sitios.map(s => s.estado).filter(Boolean))], [sitios])

  const mesesDisponibles = useMemo(() => {
    return [...new Set(sitios.map(s => {
      if (!s.tiFinish) return null
      const y = s.tiFinish.getFullYear()
      const m = String(s.tiFinish.getMonth() + 1).padStart(2, '0')
      return `${y}-${m}`
    }).filter(Boolean))].sort()
  }, [sitios])

  const filtered = useMemo(() => sitios.filter(s => {
    if (filCuad && s.cuadrilla !== filCuad) return false
    if (filEstado !== 'TODOS' && s.estado !== filEstado) return false
    if (fil5G === 'CON' && !s.es5G) return false
    if (fil5G === 'SIN' && s.es5G) return false
    if (filMeses.size > 0 && s.tiFinish) {
      const y = s.tiFinish.getFullYear()
      const m = String(s.tiFinish.getMonth() + 1).padStart(2, '0')
      if (!filMeses.has(`${y}-${m}`)) return false
    }
    return true
  }), [sitios, filCuad, filEstado, filMeses, fil5G])

  const filteredConTilt = useMemo(() => filtered.filter(s => s.tilt !== null), [filtered])

  const prom = arr => arr.length ? Math.round(arr.reduce((a, s) => a + s.tilt, 0) / arr.length) : null
  const promTilt     = prom(filteredConTilt)
  const promCwConj   = prom(filteredConTilt.filter(s => s.esCwConj))
  const promSinExtra = prom(filteredConTilt.filter(s => !s.esCwConj && !s.es5G))
  const prom5G       = prom(filteredConTilt.filter(s => s.es5G))

  const porCuadrilla = useMemo(() => {
    const map = {}
    filteredConTilt.forEach(s => {
      const k = s.cuadrilla || 'Sin cuadrilla'
      if (!map[k]) map[k] = { cuadrilla: k.split(' ').slice(-2).join(' '), total: 0, count: 0 }
      map[k].total += s.tilt; map[k].count++
    })
    return Object.values(map).map(r => ({ ...r, prom: Math.round(r.total / r.count) })).sort((a, b) => a.prom - b.prom)
  }, [filtered])  // eslint-disable-line react-hooks/exhaustive-deps

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

  const filteredSinMes = useMemo(() => sitios.filter(s => {
    if (filCuad && s.cuadrilla !== filCuad) return false
    if (filEstado !== 'TODOS' && s.estado !== filEstado) return false
    if (fil5G === 'CON' && !s.es5G) return false
    if (fil5G === 'SIN' && s.es5G) return false
    return true
  }), [sitios, filCuad, filEstado, fil5G])

  const integPorMes = useMemo(() => {
    const map = {}
    filteredSinMes.filter(s => s.integracionReal).forEach(s => {
      const y = s.integracionReal.getFullYear()
      if (filAño && String(y) !== String(filAño)) return
      const m = s.integracionReal.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { label: `${MESES_SHORT[m]} ${String(y).slice(2)}`, count: 0 }
      map[key].count++
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [filteredSinMes, filAño])

  const filteredInteg = useMemo(() => filtered.filter(s => {
    if (!s.integracionReal) return false
    if (filMeses.size > 0) {
      const y = s.integracionReal.getFullYear()
      const m = String(s.integracionReal.getMonth() + 1).padStart(2, '0')
      if (!filMeses.has(`${y}-${m}`)) return false
    }
    return true
  }), [filtered, filMeses])

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

  const porComplejidad = useMemo(() => [
    { tipo: 'Sin extras',   prom: promSinExtra, fill: '#144E4A' },
    { tipo: 'CW Conjunto',  prom: promCwConj,   fill: '#7c3aed' },
    { tipo: 'Con 5G',       prom: prom5G,       fill: '#0369a1' },
  ].filter(r => r.prom !== null), [promSinExtra, promCwConj, prom5G])

  if (rows.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      {loading ? (
        <div style={{ fontSize: 13, color: '#6b7280' }}>Cargando datos…</div>
      ) : fetchErr ? (
        <div>
          <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>Error al obtener datos: {fetchErr}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn bp" style={{ fontSize: 12 }} onClick={() => fetchFromSheets(true)}>↺ Reintentar</button>
            <button className="btn" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>📂 Cargar CSV</button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Sitios con TILT',    val: filteredConTilt.length,                                                     color: CN },
          { label: 'TILT Promedio',      val: promTilt    != null ? `${promTilt} días`    : '—', color: tiltColor(promTilt) },
          { label: 'TILT sin extras',    val: promSinExtra != null ? `${promSinExtra} días` : '—', color: tiltColor(promSinExtra) },
          { label: 'TILT con CW Conj.', val: promCwConj  != null ? `${promCwConj} días`  : '—', color: tiltColor(promCwConj) },
          { label: 'Con CW Conjunto',    val: filteredConTilt.filter(s => s.esCwConj).length,                              color: '#7c3aed' },
          { label: 'Con 5G',             val: filteredConTilt.filter(s => s.es5G).length,                                  color: '#0369a1' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e5e7eb', borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.2, marginTop: 2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {mesesDisponibles.length > 0 && (
        <TimelineFilter
          mesesDisponibles={mesesDisponibles} seleccion={filMeses}
          onChange={setFilMeses} añoActivo={filAño} onAñoChange={setFilAño}
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <select className="fc" style={{ fontSize: 11, width: 200 }} value={filCuad} onChange={e => setFilCuad(e.target.value)}>
          <option value="">Todas las cuadrillas</option>
          {cuadrillas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
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
          <button className="btn" style={{ fontSize: 11, color: '#6b7280' }} onClick={() => fileRef.current?.click()} title="Cargar CSV manual">📂</button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 14, marginBottom: 20 }}>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>TILT Promedio por Cuadrilla (días)</div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={porCuadrilla} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="cuadrilla" tick={{ fontSize: 9 }} width={90} />
              <Tooltip formatter={v => [`${v} días`, 'Prom. TILT']} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="prom" radius={[0,4,4,0]}>
                {(() => {
                  const p = porCuadrilla.length ? Math.round(porCuadrilla.reduce((s, r) => s + r.prom, 0) / porCuadrilla.length) : 1
                  return porCuadrilla.map((r, i) => {
                    const fill = r.prom <= p ? '#22c55e' : r.prom <= p * 1.25 ? '#86efac' : r.prom <= p * 1.60 ? '#f59e0b' : '#ef4444'
                    return <Cell key={i} fill={fill} />
                  })
                })()}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

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
                sitio: s.sitio.length > 12 ? s.sitio.slice(0, 11) + '…' : s.sitio,
                sitioFull: s.sitio, tilt: s.tilt, esCwConj: s.esCwConj, es5G: s.es5G,
              }))}
              margin={{ left: 0, right: 8, top: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sitio" tick={{ fontSize: 8 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} unit=" d" />
              <Tooltip formatter={v => [`${v} días`, 'TILT']} contentStyle={{ fontSize: 11 }} />
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
                      <tspan fill="#7c3aed">CW</tspan><tspan fill="#0369a1">+5G</tspan>
                    </text>
                  )
                  return (
                    <text x={cx} y={y - 4} textAnchor="start" fontSize={9} fontWeight="800"
                      fill={hasCW ? '#7c3aed' : '#0369a1'} transform={`rotate(-45, ${cx}, ${y - 4})`}>
                      {hasCW ? 'CW' : '5G'}
                    </text>
                  )
                }}
              >
                {[...filteredConTilt].sort((a, b) => a.tilt - b.tilt).map((s, i) => {
                  const p = promTilt || 1
                  const fill = s.tilt <= p ? '#22c55e' : s.tilt <= p * 1.25 ? '#86efac' : s.tilt <= p * 1.60 ? '#f59e0b' : '#ef4444'
                  return <Cell key={i} fill={fill} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>TILT Promedio por Complejidad (días)</div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={porComplejidad} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => [`${v} días`, 'Prom. TILT']} contentStyle={{ fontSize: 11 }} />
              <ReferenceLine y={promTilt} stroke="#9ca3af" strokeDasharray="4 4"
                label={{ value: `Prom. ${promTilt}d`, position: 'right', fontSize: 9, fill: '#6b7280' }} />
              <Bar dataKey="prom" radius={[4,4,0,0]}>
                {porComplejidad.map((r, i) => <Cell key={i} fill={r.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {filteredInteg.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>Integraciones por Mes</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={integPorMes} margin={{ left: 0, right: 16, top: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={v => [v, 'Integraciones']} contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#7c3aed' }} activeDot={{ r: 6 }}
                  label={{ position: 'top', fontSize: 10, fill: CN, fontWeight: 700 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 10 }}>Integraciones por Cuadrilla</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={integPorCuadrilla} margin={{ left: 0, right: 8, top: 16, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="cuadrilla" tick={{ fontSize: 8 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
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
