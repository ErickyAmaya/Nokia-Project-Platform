import { useState, useMemo, useRef } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { showToast }  from '../../components/Toast'

function parseRow(line) {
  const cols = []; let field = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (inQ && line[i + 1] === '"') { field += '"'; i++ } else inQ = !inQ }
    else if (ch === ',' && !inQ) { cols.push(field); field = '' }
    else field += ch
  }
  cols.push(field)
  return cols
}

function normStr(v) {
  const s = String(v ?? '').trim()
  if (!s || s.toLowerCase() === 'null' || s === '—' || s === '-' || s === '0' || s === '0.0') return null
  return s
}

function fmt(n) { return (n ?? 0).toLocaleString('es-CO') }

function Th({ children, style, center }) {
  return (
    <th style={{ padding: '6px 10px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: center ? 'center' : 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, fontSize: 11, ...style }}>
      {children}
    </th>
  )
}
function Td({ children, style, center }) {
  return (
    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign: 'middle', textAlign: center ? 'center' : 'left', fontSize: 11, ...style }}>
      {children}
    </td>
  )
}

// ── Tab: Bodega ───────────────────────────────────────────────────
function TabBodega({ items }) {
  const [q, setQ] = useState('')
  const [matFilter, setMatFilter] = useState('')

  const mats = useMemo(() => {
    const set = new Set(items.map(r => r.descripcion_material).filter(Boolean))
    return [...set].sort()
  }, [items])

  const filtered = useMemo(() => {
    let r = items
    if (matFilter) r = r.filter(i => i.descripcion_material === matFilter)
    if (q) {
      const lq = q.toLowerCase()
      r = r.filter(i =>
        (i.serial           || '').toLowerCase().includes(lq) ||
        (i.so               || '').toLowerCase().includes(lq) ||
        (i.so_local         || '').toLowerCase().includes(lq) ||
        (i.cod_material     || '').toLowerCase().includes(lq) ||
        (i.descripcion_material || '').toLowerCase().includes(lq)
      )
    }
    return r
  }, [items, q, matFilter])

  return (
    <div>
      {/* Controles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="fc"
          placeholder="🔍 Serial, SO, material…"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ fontSize: 12, flex: '1 1 220px', minWidth: 0 }}
        />
        <select className="fc" value={matFilter} onChange={e => setMatFilter(e.target.value)} style={{ fontSize: 12, flex: '1 1 200px', minWidth: 0 }}>
          <option value="">Todos los materiales</option>
          {mats.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(filtered.length)} registros</span>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 290px)', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <Th>Serial</Th>
              <Th>Material</Th>
              <Th>SO Nokia</Th>
              <Th>SO Local</Th>
              <Th style={{ width: 80 }} center>Fecha</Th>
              <Th style={{ width: 70 }} center>Fuente</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id || i} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                <Td><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.serial || '—'}</span></Td>
                <Td>{r.descripcion_material || '—'}</Td>
                <Td><span style={{ fontSize: 10, color: '#6b7280' }}>{r.so || '—'}</span></Td>
                <Td><span style={{ fontSize: 10, color: '#6b7280' }}>{r.so_local || '—'}</span></Td>
                <Td center><span style={{ fontSize: 10 }}>{r.fecha_movimiento || '—'}</span></Td>
                <Td center>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                    background: r.tipo_fuente === 'ABASTECIMIENTO' ? '#dbeafe' : '#f0fdf4',
                    color:      r.tipo_fuente === 'ABASTECIMIENTO' ? '#1e40af' : '#15803d',
                  }}>
                    {r.tipo_fuente === 'ABASTECIMIENTO' ? 'ABT' : 'LOG'}
                  </span>
                </Td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><Td colSpan={6} center style={{ color: '#9ca3af', padding: 24 }}>Sin registros</Td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ALERTA = {
  ok:        { label: '✅ OK',             bg: '#f0fdf4', color: '#15803d', order: 3 },
  discrepancia: { label: '🔴 Discrepancia', bg: '#fef2f2', color: '#dc2626', order: 0 },
  faltante:  { label: '🟡 Faltante app',   bg: '#fffbeb', color: '#92400e', order: 1 },
  exceso:    { label: '🟠 Exceso app',     bg: '#fff7ed', color: '#c2410c', order: 2 },
}

// ── Tab: Conciliación ─────────────────────────────────────────────
function TabConciliacion({ kardex, hwEquipos, hwMovimientos, hwCatalogo }) {
  const [q,          setQ]          = useState('')
  const [alertFilter, setAlertFilter] = useState('todos')
  const [seccion,    setSeccion]    = useState('serial') // 'serial' | 'sinserial'

  // ── Sección 1: Serializados ──────────────────────────────────────
  const serialRows = useMemo(() => {
    const equipoBySerial = new Map(hwEquipos.filter(e => e.serial).map(e => [e.serial, e]))
    return kardex
      .filter(r => r.serial)
      .map(r => {
        const eq = equipoBySerial.get(r.serial)
        let alerta
        if (!eq)                          alerta = 'faltante'
        else if (eq.estado === 'en_sitio') alerta = 'discrepancia'
        else                               alerta = 'ok'
        return {
          serial:  r.serial,
          desc:    r.descripcion_material || '—',
          cod:     r.cod_material || '—',
          so:      r.so || r.so_local || '—',
          eqEstado:    eq?.estado || null,
          eqUbicacion: eq?.ubicacion_actual || null,
          alerta,
        }
      })
      .sort((a, b) => ALERTA[a.alerta].order - ALERTA[b.alerta].order)
  }, [kardex, hwEquipos])

  // ── Sección 2: Sin serial — por cod_material ─────────────────────
  const sinSerialRows = useMemo(() => {
    // Nokia bodega qty por cod_material (solo rows sin serial)
    const nokiaByCod = new Map()
    for (const r of kardex.filter(r => !r.serial)) {
      const key = r.cod_material || 'SIN_COD'
      const cur = nokiaByCod.get(key) || { cod: key, desc: r.descripcion_material, nokia: 0 }
      cur.nokia += (r.cantidad ?? 1)
      nokiaByCod.set(key, cur)
    }
    // App bodega stock por catalogo_id: ENTRADA − SALIDA de movimientos sin serial
    const appByCat = new Map()
    for (const m of hwMovimientos.filter(m => !m.serial)) {
      const id = m.catalogo_id; if (!id) continue
      const delta = m.tipo === 'ENTRADA' ? (m.cantidad || 0) : -(m.cantidad || 0)
      appByCat.set(id, (appByCat.get(id) || 0) + delta)
    }
    // Construir filas cruzando cod_material → catalogo_id
    return [...nokiaByCod.values()].map(n => {
      const cat = hwCatalogo.find(c => String(c.cod_material) === String(n.cod))
      const appStock = cat ? Math.max(0, appByCat.get(cat.id) || 0) : 0
      const diff = n.nokia - appStock
      let alerta = 'ok'
      if (diff > 0)  alerta = 'faltante'
      if (diff < 0)  alerta = 'exceso'
      return { cod: n.cod, desc: n.desc || cat?.descripcion || n.cod, nokia: n.nokia, app: appStock, diff, alerta }
    }).sort((a, b) => ALERTA[a.alerta].order - ALERTA[b.alerta].order)
  }, [kardex, hwMovimientos, hwCatalogo])

  // Filtros
  const serialFiltered = useMemo(() => {
    let r = serialRows
    if (alertFilter !== 'todos') r = r.filter(x => x.alerta === alertFilter)
    if (q) { const lq = q.toLowerCase(); r = r.filter(x => x.serial.toLowerCase().includes(lq) || x.desc.toLowerCase().includes(lq) || x.cod.toLowerCase().includes(lq)) }
    return r
  }, [serialRows, alertFilter, q])

  const sinSerialFiltered = useMemo(() => {
    let r = sinSerialRows
    if (alertFilter !== 'todos') r = r.filter(x => x.alerta === alertFilter)
    if (q) { const lq = q.toLowerCase(); r = r.filter(x => x.desc.toLowerCase().includes(lq) || x.cod.toLowerCase().includes(lq)) }
    return r
  }, [sinSerialRows, alertFilter, q])

  // Conteos por alerta
  const counts = useMemo(() => {
    const src = seccion === 'serial' ? serialRows : sinSerialRows
    return Object.fromEntries(Object.keys(ALERTA).map(k => [k, src.filter(r => r.alerta === k).length]))
  }, [serialRows, sinSerialRows, seccion])

  const tabStyle = active => ({
    padding: '6px 14px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
    borderBottom: active ? '2px solid #1d4ed8' : '2px solid transparent',
    background: 'none', color: active ? '#1d4ed8' : '#6b7280',
  })

  return (
    <div>
      {/* Sub-tabs serializados / sin serial */}
      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: 12, display: 'flex', gap: 0 }}>
        <button style={tabStyle(seccion === 'serial')}    onClick={() => { setSeccion('serial');    setAlertFilter('todos') }}>
          🔢 Serializados <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>({serialRows.length})</span>
        </button>
        <button style={tabStyle(seccion === 'sinserial')} onClick={() => { setSeccion('sinserial'); setAlertFilter('todos') }}>
          📦 Sin serial <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>({sinSerialRows.length} tipos)</span>
        </button>
      </div>

      {/* Filtros de alerta */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['todos', 'Todos', '#374151', '#f3f4f6'], ...Object.entries(ALERTA).map(([k, v]) => [k, v.label, v.color, v.bg])].map(([k, label, color, bg]) => (
          <button key={k} onClick={() => setAlertFilter(k)} style={{
            padding: '3px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, border: `1.5px solid ${alertFilter === k ? color : '#e5e7eb'}`,
            background: alertFilter === k ? bg : '#fff', color: alertFilter === k ? color : '#6b7280', cursor: 'pointer',
          }}>
            {label} {k !== 'todos' && counts[k] != null ? `(${counts[k]})` : ''}
          </button>
        ))}
        <input className="fc" placeholder="🔍 Buscar…" value={q} onChange={e => setQ(e.target.value)} style={{ fontSize: 11, marginLeft: 'auto', width: 180 }} />
      </div>

      {/* Tabla serializados */}
      {seccion === 'serial' && (
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <Th style={{ width: 90 }} center>Estado</Th>
                <Th>Serial</Th>
                <Th>Material</Th>
                <Th style={{ width: 80 }} center>Cód.</Th>
                <Th>SO Nokia</Th>
                <Th>App — Estado / Ubicación</Th>
              </tr>
            </thead>
            <tbody>
              {serialFiltered.map((r, i) => {
                const a = ALERTA[r.alerta]
                return (
                  <tr key={r.serial} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                    <Td center>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: a.bg, color: a.color, whiteSpace: 'nowrap' }}>
                        {a.label}
                      </span>
                    </Td>
                    <Td><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.serial}</span></Td>
                    <Td style={{ maxWidth: 200 }}><span style={{ fontSize: 10 }}>{r.desc}</span></Td>
                    <Td center><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{r.cod}</span></Td>
                    <Td><span style={{ fontSize: 10, color: '#6b7280' }}>{r.so}</span></Td>
                    <Td>
                      {r.eqEstado
                        ? <span style={{ fontSize: 10 }}>{r.eqEstado === 'en_sitio' ? `📍 ${r.eqUbicacion || 'Sitio'}` : r.eqEstado}</span>
                        : <span style={{ fontSize: 10, color: '#9ca3af' }}>Sin registro</span>
                      }
                    </Td>
                  </tr>
                )
              })}
              {!serialFiltered.length && (
                <tr><Td colSpan={6} center style={{ color: '#9ca3af', padding: 24 }}>Sin registros</Td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla sin serial */}
      {seccion === 'sinserial' && (
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <Th style={{ width: 90 }} center>Estado</Th>
                <Th>Material</Th>
                <Th style={{ width: 80 }} center>Cód.</Th>
                <Th style={{ width: 80 }} center>Nokia</Th>
                <Th style={{ width: 80 }} center>App</Th>
                <Th style={{ width: 80 }} center>Diferencia</Th>
              </tr>
            </thead>
            <tbody>
              {sinSerialFiltered.map((r, i) => {
                const a = ALERTA[r.alerta]
                return (
                  <tr key={r.cod} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                    <Td center>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: a.bg, color: a.color, whiteSpace: 'nowrap' }}>
                        {a.label}
                      </span>
                    </Td>
                    <Td style={{ maxWidth: 220 }}>{r.desc}</Td>
                    <Td center><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{r.cod}</span></Td>
                    <Td center><span style={{ fontWeight: 600, color: '#1e40af' }}>{fmt(r.nokia)}</span></Td>
                    <Td center><span style={{ fontWeight: 600, color: '#374151' }}>{fmt(r.app)}</span></Td>
                    <Td center>
                      <span style={{ fontWeight: 700, color: r.diff === 0 ? '#15803d' : r.diff > 0 ? '#92400e' : '#c2410c' }}>
                        {r.diff > 0 ? `+${fmt(r.diff)}` : fmt(r.diff)}
                      </span>
                    </Td>
                  </tr>
                )
              })}
              {!sinSerialFiltered.length && (
                <tr><Td colSpan={6} center style={{ color: '#9ca3af', padding: 24 }}>Sin registros</Td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function HwBodegaNokia() {
  const hwKardexDisponible     = useHwStore(s => s.hwKardexDisponible)
  const hwEquipos              = useHwStore(s => s.hwEquipos)
  const hwMovimientos          = useHwStore(s => s.hwMovimientos)
  const hwCatalogo             = useHwStore(s => s.hwCatalogo)
  const upsertKardexDisponible = useHwStore(s => s.upsertKardexDisponible)

  const [tab,      setTab]      = useState('bodega')
  const [file,     setFile]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const fileRef                 = useRef()
  const dragRef                 = useRef(false)

  async function handleFile(f) {
    setFile(f); setResult(null)
  }

  async function handleCargar() {
    if (!file) { showToast('Selecciona un archivo CSV', 'err'); return }
    setLoading(true)
    try {
      const lines = (await file.text()).split(/\r?\n/)
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim(); if (!line) continue
        const c = parseRow(line)
        const nokiaId = normStr(c[0]); if (!nokiaId) continue
        rows.push({
          nokia_id:             nokiaId,
          so:                   normStr(c[5]),
          so_local:             normStr(c[6]),
          cod_material:         normStr(c[7]),
          id_parte:             Number(normStr(c[8])) || null,
          descripcion_material: normStr(c[9]),
          cantidad:             Number(normStr(c[10])) || 1,
          tipo_material:        normStr(c[11]),
          proposito:            normStr(c[12]),
          tipo_fuente:          normStr(c[13]),
          tipo_movimiento:      normStr(c[14]),
          fecha_movimiento:     (c[15]?.trim() || '').slice(0, 10) || null,
          serial:               normStr(c[18]),
          proyecto:             normStr(c[3]),
          sub_proyecto:         normStr(c[4]),
          updated_at:           new Date().toISOString(),
        })
      }
      await upsertKardexDisponible(rows)
      setResult({ count: rows.length })
      setFile(null)
      showToast(`${rows.length} registros cargados en bodega Nokia`)
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = active => ({
    padding: '8px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
    borderBottom: active ? '2px solid #1d4ed8' : '2px solid transparent',
    background: 'none', color: active ? '#1d4ed8' : '#6b7280',
  })

  return (
    <div>
      <div className="dash-hdr mb14" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            Bodega Nokia
          </h1>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            Kardex Disponible · {hwKardexDisponible.length.toLocaleString('es-CO')} registros cargados
          </div>
        </div>

        {/* Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{ border: '1.5px dashed #d1d5db', borderRadius: 8, padding: '6px 12px', background: file ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); dragRef.current = true }}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = '' }} />
            {file ? `📄 ${file.name}` : '📂 Kardex Disponible CSV'}
          </div>
          {file && (
            <button
              className="btn bp"
              style={{ fontSize: 11, padding: '5px 14px' }}
              onClick={handleCargar}
              disabled={loading}
            >
              {loading ? '⏳ Cargando…' : '↑ Cargar'}
            </button>
          )}
          {result && (
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
              ✓ {result.count} registros
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: 14, display: 'flex', gap: 0 }}>
        <button style={tabStyle(tab === 'bodega')}        onClick={() => setTab('bodega')}>📦 Bodega</button>
        <button style={tabStyle(tab === 'conciliacion')}  onClick={() => setTab('conciliacion')}>⚖️ Conciliación</button>
      </div>

      {tab === 'bodega'       && <TabBodega items={hwKardexDisponible} />}
      {tab === 'conciliacion' && <TabConciliacion kardex={hwKardexDisponible} hwEquipos={hwEquipos} hwMovimientos={hwMovimientos} hwCatalogo={hwCatalogo} />}
    </div>
  )
}
