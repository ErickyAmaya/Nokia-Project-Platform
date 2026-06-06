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

const ALERTA = {
  ok:           { label: '✅ OK (Legalizado)',      bg: '#f0fdf4', color: '#15803d', order: 3 },
  discrepancia: { label: '🔴 Pendiente Legalizar',  bg: '#fef2f2', color: '#dc2626', order: 0 },
  faltante:     { label: '🟡 Faltante app',         bg: '#fffbeb', color: '#92400e', order: 1 },
  exceso:       { label: '🟠 Exceso app',           bg: '#fff7ed', color: '#c2410c', order: 2 },
  nuevo:        { label: '🆕 Nueva entrada',        bg: '#eff6ff', color: '#1d4ed8', order: 0 },
}

// ── Tab: Bodega (Kardex Disponible Nokia) ─────────────────────────
function TabBodega({ items, kardexMov, hwEquipos, hwMovimientos, hwCatalogo }) {
  const [q,         setQ]         = useState('')
  const [matFilter, setMatFilter] = useState('')
  const [seccion,   setSeccion]   = useState('kardex') // 'kardex' | 'nuevas'

  const mats = useMemo(() => [...new Set(items.map(r => r.descripcion_material).filter(Boolean))].sort(), [items])

  // Nuevas entradas serializadas: ENTRADA en Kardex Movimientos que no están en hw_equipos
  const nuevasSerial = useMemo(() => {
    const serialesApp = new Set(hwEquipos.map(e => e.serial).filter(Boolean))
    const entradas = kardexMov.filter(r => r.tipo_movimiento === 'ENTRADA' && r.serial)
    // deduplicar por serial, quedarse con la más reciente
    const bySerial = new Map()
    for (const r of entradas) {
      if (!bySerial.has(r.serial) || r.fecha_movimiento > bySerial.get(r.serial).fecha_movimiento)
        bySerial.set(r.serial, r)
    }
    return [...bySerial.values()].filter(r => !serialesApp.has(r.serial))
  }, [kardexMov, hwEquipos])

  // Nuevas entradas sin serial: net ENTRADA-SALIDA Nokia vs stock app
  const nuevasSinSerial = useMemo(() => {
    const nokiaByCod = new Map()
    for (const r of kardexMov.filter(r => !r.serial)) {
      const key = r.cod_material || 'SIN_COD'
      const cur = nokiaByCod.get(key) || { cod: key, desc: r.descripcion_material, nokia: 0 }
      const delta = r.tipo_movimiento === 'ENTRADA' ? (r.cantidad ?? 1) : -(r.cantidad ?? 1)
      cur.nokia += delta
      nokiaByCod.set(key, cur)
    }
    const appByCat = new Map()
    for (const m of hwMovimientos.filter(m => !m.serial)) {
      const id = m.catalogo_id; if (!id) continue
      const delta = m.tipo === 'ENTRADA' ? (m.cantidad || 0) : -(m.cantidad || 0)
      appByCat.set(id, (appByCat.get(id) || 0) + delta)
    }
    return [...nokiaByCod.values()]
      .filter(n => n.nokia > 0)
      .map(n => {
        const cat = hwCatalogo.find(c => String(c.cod_material) === String(n.cod))
        const appStock = cat ? Math.max(0, appByCat.get(cat.id) || 0) : 0
        const diff = n.nokia - appStock
        return { ...n, app: appStock, diff }
      }).filter(r => r.diff > 0)
  }, [kardexMov, hwMovimientos, hwCatalogo])

  const filtered = useMemo(() => {
    let r = items
    if (matFilter) r = r.filter(i => i.descripcion_material === matFilter)
    if (q) {
      const lq = q.toLowerCase()
      r = r.filter(i =>
        (i.serial || '').toLowerCase().includes(lq) ||
        (i.so || '').toLowerCase().includes(lq) ||
        (i.so_local || '').toLowerCase().includes(lq) ||
        (i.descripcion_material || '').toLowerCase().includes(lq)
      )
    }
    return r
  }, [items, q, matFilter])

  const subTab = (id, label, count) => (
    <button onClick={() => setSeccion(id)} style={{
      padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 6,
      background: seccion === id ? '#1d4ed8' : '#f3f4f6',
      color:      seccion === id ? '#fff'    : '#6b7280',
      marginRight: 6,
    }}>
      {label} <span style={{ fontWeight: 400 }}>({count})</span>
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
        {subTab('kardex', '📦 Kardex Disponible', items.length)}
        {subTab('nuevas', '🆕 Nuevas Entradas', kardexMov.length ? nuevasSerial.length + nuevasSinSerial.length : '—')}
      </div>

      {seccion === 'kardex' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="fc" placeholder="🔍 Serial, SO, material…" value={q}
              onChange={e => setQ(e.target.value)} style={{ fontSize: 12, flex: '1 1 220px', minWidth: 0 }} />
            <select className="fc" value={matFilter} onChange={e => setMatFilter(e.target.value)} style={{ fontSize: 12, flex: '1 1 200px', minWidth: 0 }}>
              <option value="">Todos los materiales</option>
              {mats.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(filtered.length)} registros</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 330px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr>
                <Th>Serial</Th><Th>Material</Th><Th>SO Nokia</Th><Th>SO Local</Th>
                <Th style={{ width: 80 }} center>Fecha</Th><Th style={{ width: 70 }} center>Fuente</Th>
              </tr></thead>
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
                        color:      r.tipo_fuente === 'ABASTECIMIENTO' ? '#1e40af' : '#15803d' }}>
                        {r.tipo_fuente === 'ABASTECIMIENTO' ? 'ABT' : 'LOG'}
                      </span>
                    </Td>
                  </tr>
                ))}
                {!filtered.length && <tr><Td colSpan={6} center style={{ color: '#9ca3af', padding: 24 }}>Sin registros</Td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {seccion === 'nuevas' && (
        <div>
          {nuevasSerial.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 8 }}>Serializados sin registro en app ({nuevasSerial.length})</div>
              <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr>
                    <Th>Serial</Th><Th>Material</Th><Th>SO Nokia</Th><Th style={{ width: 80 }} center>Fecha</Th>
                  </tr></thead>
                  <tbody>
                    {nuevasSerial.map((r, i) => (
                      <tr key={r.id || i} style={{ background: i % 2 ? '#eff6ff' : '#fff' }}>
                        <Td><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#1d4ed8', fontWeight: 700 }}>{r.serial}</span></Td>
                        <Td>{r.descripcion_material || '—'}</Td>
                        <Td><span style={{ fontSize: 10, color: '#6b7280' }}>{r.so || '—'}</span></Td>
                        <Td center><span style={{ fontSize: 10 }}>{r.fecha_movimiento || '—'}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {nuevasSinSerial.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 8 }}>Sin serial — exceso Nokia vs app ({nuevasSinSerial.length} tipos)</div>
              <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr>
                    <Th>Material</Th><Th style={{ width: 80 }} center>Cód.</Th>
                    <Th style={{ width: 80 }} center>Nokia</Th><Th style={{ width: 80 }} center>App</Th>
                    <Th style={{ width: 80 }} center>Diferencia</Th>
                  </tr></thead>
                  <tbody>
                    {nuevasSinSerial.map((r, i) => (
                      <tr key={r.cod} style={{ background: i % 2 ? '#eff6ff' : '#fff' }}>
                        <Td>{r.desc || r.cod}</Td>
                        <Td center><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{r.cod}</span></Td>
                        <Td center style={{ fontWeight: 700 }}>{r.nokia}</Td>
                        <Td center>{r.app}</Td>
                        <Td center><span style={{ fontWeight: 700, color: '#1d4ed8' }}>+{r.diff}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!kardexMov.length && (
            <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>
              Carga el Kardex Nokia para detectar nuevas entradas
            </div>
          )}
          {kardexMov.length > 0 && nuevasSerial.length === 0 && nuevasSinSerial.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>
              ✅ Todo lo que Nokia registra ya está en la app
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: En Sitio (hw_equipos en_sitio) ──────────────────────────
function TabEnSitio({ hwEquipos, hwCatalogo }) {
  const [q,       setQ]       = useState('')
  const [filSite, setFilSite] = useState('')

  const enSitio = useMemo(() => hwEquipos.filter(e => e.estado === 'en_sitio'), [hwEquipos])

  const sites = useMemo(() => [...new Set(enSitio.map(e => e.ubicacion_actual).filter(Boolean))].sort(), [enSitio])

  const filtered = useMemo(() => {
    let r = enSitio
    if (filSite) r = r.filter(e => e.ubicacion_actual === filSite)
    if (q) {
      const lq = q.toLowerCase()
      r = r.filter(e =>
        (e.serial || '').toLowerCase().includes(lq) ||
        (e.ubicacion_actual || '').toLowerCase().includes(lq) ||
        (e.so || '').toLowerCase().includes(lq)
      )
    }
    return r
  }, [enSitio, filSite, q])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input className="fc" placeholder="🔍 Serial, sitio, SO…" value={q}
          onChange={e => setQ(e.target.value)} style={{ fontSize: 12, flex: '1 1 220px', minWidth: 0 }} />
        <select className="fc" value={filSite} onChange={e => setFilSite(e.target.value)} style={{ fontSize: 12, flex: '1 1 200px', minWidth: 0 }}>
          <option value="">Todos los sitios</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(filtered.length)} equipos</span>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 310px)', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr>
            <Th>Serial</Th><Th>Material</Th><Th style={{ width: 80 }} center>Capex</Th>
            <Th>SO</Th><Th>Sitio</Th><Th style={{ width: 80 }} center>Condición</Th>
          </tr></thead>
          <tbody>
            {filtered.map((e, i) => {
              const cat = hwCatalogo.find(c => c.id === e.catalogo_id)
              return (
                <tr key={e.id} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                  <Td><span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#1e40af' }}>{e.serial || '—'}</span></Td>
                  <Td style={{ maxWidth: 220 }}><span style={{ fontSize: 10 }}>{cat?.descripcion || '—'}</span></Td>
                  <Td center><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{cat?.cod_material || e.codigo_capex || '—'}</span></Td>
                  <Td><span style={{ fontSize: 10, color: '#6b7280' }}>{e.so || '—'}</span></Td>
                  <Td><span style={{ fontSize: 10 }}>📍 {e.ubicacion_actual || '—'}</span></Td>
                  <Td center><span style={{ fontSize: 10, textTransform: 'capitalize', color: '#6b7280' }}>{e.condicion || '—'}</span></Td>
                </tr>
              )
            })}
            {!filtered.length && <tr><Td colSpan={6} center style={{ color: '#9ca3af', padding: 24 }}>Sin equipos</Td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Conciliación (Bodega + Sitios) ───────────────────────────
function TabConciliacion({ kardex, hwEquipos, hwMovimientos, hwCatalogo }) {
  const [seccion,     setSeccion]     = useState('bodega')
  const [alertFilter, setAlertFilter] = useState('todos')
  const [q,           setQ]           = useState('')

  // ── Sección Bodega: Kardex Disponible vs app en_bodega ───────────
  const serialRows = useMemo(() => {
    const equipoBySerial = new Map(hwEquipos.filter(e => e.serial).map(e => [e.serial, e]))
    return kardex.filter(r => r.serial).map(r => {
      const eq = equipoBySerial.get(r.serial)
      let alerta
      if (!eq)                           alerta = 'faltante'
      else if (eq.estado === 'en_sitio') alerta = 'discrepancia'
      else                               alerta = 'ok'
      const motivo = alerta === 'discrepancia' ? 'Nokia: bodega · App: en sitio'
                   : alerta === 'faltante'     ? 'Sin registro en app' : ''
      return {
        serial: r.serial, desc: r.descripcion_material || '—',
        cod: r.cod_material || '—', so: r.so || r.so_local || '—',
        eqEstado: eq?.estado || null, eqUbicacion: eq?.ubicacion_actual || null,
        alerta, motivo,
      }
    }).sort((a, b) => ALERTA[a.alerta].order - ALERTA[b.alerta].order)
  }, [kardex, hwEquipos])

  const sinSerialRows = useMemo(() => {
    const nokiaByCod = new Map()
    for (const r of kardex.filter(r => !r.serial)) {
      const key = r.cod_material || 'SIN_COD'
      const cur = nokiaByCod.get(key) || { cod: key, desc: r.descripcion_material, nokia: 0 }
      cur.nokia += (r.cantidad ?? 1)
      nokiaByCod.set(key, cur)
    }
    const appByCat = new Map()
    for (const m of hwMovimientos.filter(m => !m.serial)) {
      const id = m.catalogo_id; if (!id) continue
      const delta = m.tipo === 'ENTRADA' ? (m.cantidad || 0) : -(m.cantidad || 0)
      appByCat.set(id, (appByCat.get(id) || 0) + delta)
    }
    return [...nokiaByCod.values()].map(n => {
      const cat = hwCatalogo.find(c => String(c.cod_material) === String(n.cod))
      const appStock = cat ? Math.max(0, appByCat.get(cat.id) || 0) : 0
      const diff = n.nokia - appStock
      let alerta = 'ok'
      if (diff > 0) alerta = 'faltante'
      if (diff < 0) alerta = 'exceso'
      return { cod: n.cod, desc: n.desc || cat?.descripcion || n.cod, nokia: n.nokia, app: appStock, diff, alerta }
    }).sort((a, b) => ALERTA[a.alerta].order - ALERTA[b.alerta].order)
  }, [kardex, hwMovimientos, hwCatalogo])

  // ── Sección Sitios: hw_equipos en_sitio vs Kardex Disponible ─────
  const kardexSerials = useMemo(() => new Set(kardex.map(r => r.serial).filter(Boolean)), [kardex])

  const sitiosRows = useMemo(() => {
    return hwEquipos
      .filter(e => e.estado === 'en_sitio' && e.serial)
      .map(e => {
        const cat = hwCatalogo.find(c => c.id === e.catalogo_id)
        const enKardex = kardexSerials.has(e.serial)
        const alerta = enKardex ? 'discrepancia' : 'ok'
        const motivo  = enKardex ? 'Nokia: bodega · App: en sitio' : ''
        return {
          serial: e.serial, desc: cat?.descripcion || '—',
          capex: cat?.cod_material || e.codigo_capex || '—',
          so: e.so || '—', sitio: e.ubicacion_actual || '—',
          alerta, motivo,
        }
      })
      .sort((a, b) => ALERTA[a.alerta].order - ALERTA[b.alerta].order)
  }, [hwEquipos, kardexSerials, hwCatalogo])

  const countsBodega = useMemo(() => Object.fromEntries(Object.keys(ALERTA).map(k => [k, serialRows.filter(r => r.alerta === k).length])), [serialRows])
  const countsSitios = useMemo(() => Object.fromEntries(Object.keys(ALERTA).map(k => [k, sitiosRows.filter(r => r.alerta === k).length])), [sitiosRows])

  const alertKeys = ['discrepancia', 'faltante', 'exceso', 'ok']

  const serialFiltered = useMemo(() => {
    let r = alertFilter === 'todos' ? serialRows : serialRows.filter(x => x.alerta === alertFilter)
    if (q) { const lq = q.toLowerCase(); r = r.filter(x => x.serial.toLowerCase().includes(lq) || x.so.toLowerCase().includes(lq)) }
    return r
  }, [serialRows, alertFilter, q])

  const sinSerialFiltered = useMemo(() => alertFilter === 'todos' ? sinSerialRows : sinSerialRows.filter(x => x.alerta === alertFilter), [sinSerialRows, alertFilter])

  const sitiosFiltered = useMemo(() => {
    let r = alertFilter === 'todos' ? sitiosRows : sitiosRows.filter(x => x.alerta === alertFilter)
    if (q) { const lq = q.toLowerCase(); r = r.filter(x => x.serial.toLowerCase().includes(lq) || x.sitio.toLowerCase().includes(lq)) }
    return r
  }, [sitiosRows, alertFilter, q])

  const counts = seccion === 'sitios' ? countsSitios : countsBodega
  const alertsToShow = seccion === 'sinserial' ? ['faltante', 'exceso', 'ok'] : alertKeys.filter(k => k !== 'exceso' || seccion === 'sinserial')

  const isDisponible = seccion === 'bodega' || seccion === 'sinserial'

  // Tabs principales: azul sólido
  const subTabStyle = (id) => {
    const active = id === 'bodega' ? isDisponible : seccion === id
    return {
      padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 6, marginRight: 6,
      background: active ? '#1d4ed8' : '#f3f4f6',
      color:      active ? '#fff'    : '#6b7280',
    }
  }

  // Sub-tabs internos: azul claro
  const innerTabStyle = (id) => ({
    padding: '4px 11px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 6, marginRight: 6,
    background: seccion === id ? '#bfdbfe' : '#f3f4f6',
    color:      seccion === id ? '#1d4ed8' : '#6b7280',
  })

  return (
    <div>
      {/* Sub-tabs principales */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14 }}>
        <button style={subTabStyle('bodega')} onClick={() => { setSeccion('bodega'); setAlertFilter('todos'); setQ('') }}>
          📦 Disponible <span style={{ fontWeight: 400 }}>({serialRows.length + sinSerialRows.length})</span>
        </button>
        <button style={subTabStyle('sitios')} onClick={() => { setSeccion('sitios'); setAlertFilter('todos'); setQ('') }}>
          📍 Instalado <span style={{ fontWeight: 400 }}>({sitiosRows.length})</span>
        </button>
      </div>

      {/* Sección Bodega */}
      {(seccion === 'bodega' || seccion === 'sinserial') && (
        <>
          <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
            <button style={innerTabStyle('bodega')}    onClick={() => setSeccion('bodega')}>
              🔢 Serializados ({serialRows.length})
            </button>
            <button style={innerTabStyle('sinserial')} onClick={() => setSeccion('sinserial')}>
              📦 Sin serial ({sinSerialRows.length} tipos)
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {[['todos', 'Todos'], ...alertsToShow.map(k => [k, ALERTA[k].label])].map(([k, label]) => {
              const a = k === 'todos' ? null : ALERTA[k]
              const cnt = k === 'todos' ? (seccion === 'bodega' ? serialRows.length : sinSerialRows.length) : counts[k]
              return (
                <button key={k} onClick={() => setAlertFilter(k)} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, border: '1.5px solid',
                  borderColor: alertFilter === k ? (a?.color || '#374151') : '#e5e7eb',
                  background:  alertFilter === k ? (a?.bg    || '#f3f4f6') : '#fff',
                  color:       alertFilter === k ? (a?.color || '#374151') : '#6b7280',
                  cursor: 'pointer',
                }}>{label} ({cnt})</button>
              )
            })}
            {seccion === 'bodega' && (
              <input className="fc" placeholder="🔍 Serial, SO…" value={q} onChange={e => setQ(e.target.value)}
                style={{ fontSize: 12, marginLeft: 'auto', width: 200 }} />
            )}
          </div>

          {seccion === 'bodega' && (
            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr>
                  <Th style={{ width: 110 }} center>Estado</Th>
                  <Th>Serial</Th><Th>Material</Th>
                  <Th style={{ width: 80 }} center>Cód.</Th>
                  <Th>SO Nokia</Th><Th>App — Ubicación</Th><Th>Discrepancia</Th>
                </tr></thead>
                <tbody>
                  {serialFiltered.map((r, i) => {
                    const a = ALERTA[r.alerta]
                    return (
                      <tr key={r.serial} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                        <Td center>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: a.bg, color: a.color, whiteSpace: 'nowrap' }}>{a.label}</span>
                        </Td>
                        <Td><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.serial}</span></Td>
                        <Td style={{ maxWidth: 200 }}><span style={{ fontSize: 10 }}>{r.desc}</span></Td>
                        <Td center><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{r.cod}</span></Td>
                        <Td><span style={{ fontSize: 10, color: '#6b7280' }}>{r.so}</span></Td>
                        <Td>
                          {r.eqEstado
                            ? <span style={{ fontSize: 10 }}>{r.eqEstado === 'en_sitio' ? `📍 ${r.eqUbicacion || 'Sitio'}` : r.eqEstado}</span>
                            : <span style={{ fontSize: 10, color: '#9ca3af' }}>—</span>}
                        </Td>
                        <Td>
                          {r.motivo && <span style={{ fontSize: 10, color: a.color, fontWeight: 600 }}>{r.motivo}</span>}
                        </Td>
                      </tr>
                    )
                  })}
                  {!serialFiltered.length && <tr><Td colSpan={7} center style={{ color: '#9ca3af', padding: 24 }}>Sin registros</Td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {seccion === 'sinserial' && (
            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr>
                  <Th style={{ width: 90 }} center>Estado</Th><Th>Material</Th>
                  <Th style={{ width: 80 }} center>Cód.</Th><Th style={{ width: 80 }} center>Nokia</Th>
                  <Th style={{ width: 80 }} center>App</Th><Th style={{ width: 80 }} center>Diferencia</Th>
                </tr></thead>
                <tbody>
                  {sinSerialFiltered.map((r, i) => {
                    const a = ALERTA[r.alerta]
                    return (
                      <tr key={r.cod} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                        <Td center>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: a.bg, color: a.color, whiteSpace: 'nowrap' }}>{a.label}</span>
                        </Td>
                        <Td>{r.desc}</Td>
                        <Td center><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{r.cod}</span></Td>
                        <Td center style={{ fontWeight: 700 }}>{r.nokia}</Td>
                        <Td center>{r.app}</Td>
                        <Td center>
                          <span style={{ fontWeight: 700, color: r.diff > 0 ? '#92400e' : '#c2410c' }}>
                            {r.diff > 0 ? `+${r.diff}` : r.diff}
                          </span>
                        </Td>
                      </tr>
                    )
                  })}
                  {!sinSerialFiltered.length && <tr><Td colSpan={6} center style={{ color: '#9ca3af', padding: 24 }}>Sin registros</Td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Sección Sitios */}
      {seccion === 'sitios' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {[['todos', 'Todos'], ['discrepancia', ALERTA.discrepancia.label], ['ok', ALERTA.ok.label]].map(([k, label]) => {
              const a = k === 'todos' ? null : ALERTA[k]
              const cnt = k === 'todos' ? sitiosRows.length : countsSitios[k]
              return (
                <button key={k} onClick={() => setAlertFilter(k)} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, border: '1.5px solid',
                  borderColor: alertFilter === k ? (a?.color || '#374151') : '#e5e7eb',
                  background:  alertFilter === k ? (a?.bg    || '#f3f4f6') : '#fff',
                  color:       alertFilter === k ? (a?.color || '#374151') : '#6b7280',
                  cursor: 'pointer',
                }}>{label} ({cnt})</button>
              )
            })}
            <input className="fc" placeholder="🔍 Serial, sitio…" value={q} onChange={e => setQ(e.target.value)}
              style={{ fontSize: 12, marginLeft: 'auto', width: 200 }} />
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr>
                <Th style={{ width: 110 }} center>Estado</Th>
                <Th>Serial</Th><Th>Material</Th>
                <Th style={{ width: 80 }} center>Capex</Th>
                <Th>SO</Th><Th>Sitio App</Th><Th>Discrepancia</Th>
              </tr></thead>
              <tbody>
                {sitiosFiltered.map((r, i) => {
                  const a = ALERTA[r.alerta]
                  return (
                    <tr key={r.serial} style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                      <Td center>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: a.bg, color: a.color, whiteSpace: 'nowrap' }}>{a.label}</span>
                      </Td>
                      <Td><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.serial}</span></Td>
                      <Td style={{ maxWidth: 200 }}><span style={{ fontSize: 10 }}>{r.desc}</span></Td>
                      <Td center><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{r.capex}</span></Td>
                      <Td><span style={{ fontSize: 10, color: '#6b7280' }}>{r.so}</span></Td>
                      <Td><span style={{ fontSize: 10 }}>📍 {r.sitio}</span></Td>
                      <Td>
                        {r.motivo && <span style={{ fontSize: 10, color: a.color, fontWeight: 600 }}>{r.motivo}</span>}
                      </Td>
                    </tr>
                  )
                })}
                {!sitiosFiltered.length && <tr><Td colSpan={7} center style={{ color: '#9ca3af', padding: 24 }}>Sin registros</Td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function HwBodegaNokia() {
  const hwKardexDisponible     = useHwStore(s => s.hwKardexDisponible)
  const hwKardexMovimientos    = useHwStore(s => s.hwKardexMovimientos)
  const hwEquipos              = useHwStore(s => s.hwEquipos)
  const hwMovimientos          = useHwStore(s => s.hwMovimientos)
  const hwCatalogo             = useHwStore(s => s.hwCatalogo)
  const upsertKardexDisponible = useHwStore(s => s.upsertKardexDisponible)
  const upsertKardexMovimientos= useHwStore(s => s.upsertKardexMovimientos)

  const [tab,        setTab]        = useState('bodega')
  const [file,       setFile]       = useState(null)
  const [fileMov,    setFileMov]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [loadingMov, setLoadingMov] = useState(false)
  const [result,     setResult]     = useState(null)
  const [resultMov,  setResultMov]  = useState(null)
  const fileRef                     = useRef()
  const fileRefMov                  = useRef()
  const dragRef                     = useRef(false)

  function handleFile(f) { setFile(f); setResult(null) }

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
      showToast(`${rows.length} registros cargados`)
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  async function handleCargarMov() {
    if (!fileMov) { showToast('Selecciona un archivo CSV', 'err'); return }
    setLoadingMov(true)
    try {
      const lines = (await fileMov.text()).split(/\r?\n/)
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
      await upsertKardexMovimientos(rows)
      setResultMov({ count: rows.length })
      setFileMov(null)
      showToast(`${rows.length} movimientos cargados`)
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setLoadingMov(false)
    }
  }

  const enSitioCount = useMemo(() => hwEquipos.filter(e => e.estado === 'en_sitio').length, [hwEquipos])

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
            Gestión HW
          </h1>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            Disponible · {hwKardexDisponible.length.toLocaleString('es-CO')} reg.&nbsp;&nbsp;·&nbsp;&nbsp;
            Movimientos · {hwKardexMovimientos.length.toLocaleString('es-CO')} reg.&nbsp;&nbsp;·&nbsp;&nbsp;
            En sitio · {enSitioCount.toLocaleString('es-CO')} equipos
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Kardex Disponible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ border: '1.5px dashed #d1d5db', borderRadius: 8, padding: '6px 12px', background: file ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); dragRef.current = true }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = '' }} />
              {file ? `📄 ${file.name}` : '📂 Kardex Disponible'}
            </div>
            {file && <button className="btn bp" style={{ fontSize: 11, padding: '5px 12px' }} onClick={handleCargar} disabled={loading}>{loading ? '⏳…' : '↑ Cargar'}</button>}
            {result && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ {result.count}</span>}
          </div>

          <div style={{ width: 1, height: 26, background: '#e5e7eb' }} />

          {/* Kardex Movimientos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ border: '1.5px dashed #d1d5db', borderRadius: 8, padding: '6px 12px', background: fileMov ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => fileRefMov.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFileMov(f) }}>
              <input ref={fileRefMov} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) setFileMov(f); e.target.value = '' }} />
              {fileMov ? `📄 ${fileMov.name}` : '📋 Kardex Movimientos'}
            </div>
            {fileMov && <button className="btn bp" style={{ fontSize: 11, padding: '5px 12px' }} onClick={handleCargarMov} disabled={loadingMov}>{loadingMov ? '⏳…' : '↑ Cargar'}</button>}
            {resultMov && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ {resultMov.count}</span>}
          </div>
        </div>
      </div>

      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: 14, display: 'flex', gap: 0 }}>
        <button style={tabStyle(tab === 'bodega')}        onClick={() => setTab('bodega')}>📦 Bodega</button>
        <button style={tabStyle(tab === 'ensitio')}       onClick={() => setTab('ensitio')}>🗼 En Sitio</button>
        <button style={tabStyle(tab === 'conciliacion')}  onClick={() => setTab('conciliacion')}>⚖️ Conciliación</button>
      </div>

      {tab === 'bodega'       && <TabBodega items={hwKardexDisponible} kardexMov={hwKardexMovimientos} hwEquipos={hwEquipos} hwMovimientos={hwMovimientos} hwCatalogo={hwCatalogo} />}
      {tab === 'ensitio'      && <TabEnSitio hwEquipos={hwEquipos} hwCatalogo={hwCatalogo} />}
      {tab === 'conciliacion' && <TabConciliacion kardex={hwKardexDisponible} hwEquipos={hwEquipos} hwMovimientos={hwMovimientos} hwCatalogo={hwCatalogo} />}
    </div>
  )
}
