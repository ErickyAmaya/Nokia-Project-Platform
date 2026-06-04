import { useState, useRef } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { showToast } from '../../components/Toast'
import { getSupabaseClient } from '../../lib/supabase'

const db = () => {
  const c = getSupabaseClient()
  if (!c) throw new Error('Supabase no inicializado')
  return c
}

function fmt(n) { return (n ?? 0).toLocaleString('es-CO') }

function parseKardexRow(line) {
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

function mapEstado(ubicacion) {
  const u = String(ubicacion || '').toUpperCase()
  if (u.includes('SITIO')) return 'en_sitio'
  if (u.includes('TRANSFER')) return 'en_transito'
  return 'en_bodega'
}

// ── DropZone ──────────────────────────────────────────────────────
function DropZone({ accept, file, onFile, disabled }) {
  const ref = useRef()
  const [drag, setDrag] = useState(false)
  return (
    <div
      style={{ border: `2px dashed ${drag ? '#144E4A' : '#d1d5db'}`, borderRadius: 10, background: drag ? '#f0fdf4' : '#fafafa', padding: '18px 14px', textAlign: 'center', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .15s', opacity: disabled ? .5 : 1 }}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) { const f = e.dataTransfer.files[0]; if (f) onFile(f) } }}
      onClick={() => !disabled && ref.current?.click()}
    >
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) onFile(f); e.target.value = '' }} />
      {file
        ? <><div style={{ fontSize: 20, marginBottom: 4 }}>📄</div><div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{file.name}</div><div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{(file.size / 1024).toFixed(0)} KB</div></>
        : <><div style={{ fontSize: 26, marginBottom: 6, opacity: .5 }}>📂</div><div style={{ fontSize: 12, color: '#6b7280' }}>Arrastra o haz clic para seleccionar</div></>
      }
    </div>
  )
}

// ── SectionPill ───────────────────────────────────────────────────
function SectionPill({ label, count, color, bg, open, onClick }) {
  if (!count) return null
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: `2px solid ${open ? color : 'transparent'}`, background: open ? bg : '#f3f4f6', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: open ? color : '#6b7280', transition: 'all .15s', whiteSpace: 'nowrap' }}>
      <span style={{ background: open ? color : '#9ca3af', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, minWidth: 22, textAlign: 'center' }}>{count}</span>
      {label}
    </button>
  )
}

// ── Table primitives ──────────────────────────────────────────────
function Th({ children, style, center }) {
  return (
    <th style={{ padding: '6px 10px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: center ? 'center' : 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, ...style }}>
      {children}
    </th>
  )
}
function Td({ children, style, center }) {
  return (
    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign: 'middle', textAlign: center ? 'center' : 'left', ...style }}>
      {children}
    </td>
  )
}

const ESTADO_CFG = {
  en_bodega:          { label: 'En Bodega',     bg: '#d4edda', color: '#1a6130' },
  en_sitio:           { label: 'En Sitio',       bg: '#dbeafe', color: '#1e40af' },
  en_transito:        { label: 'En Tránsito',    bg: '#fef3cd', color: '#856404' },
  retornado_nokia:    { label: 'Ret. Nokia',      bg: '#f0f0f0', color: '#555f55' },
  retornado_ss:       { label: 'Ret. SS',         bg: '#f5f0ff', color: '#6b21a8' },
  pendiente_despacho: { label: 'Pend. Despacho', bg: '#fce7f3', color: '#9d174d' },
}
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || { label: estado || '—', bg: '#f3f4f6', color: '#374151' }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}

// ── Action buttons per row ────────────────────────────────────────
function ActionBtn({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '3px 9px', fontSize: 10, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer', transition: 'all .12s', background: active ? color : '#e5e7eb', color: active ? '#fff' : '#6b7280', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}

// ── Section header with bulk actions ─────────────────────────────
function SectionHeader({ left, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{left}</div>
      <div style={{ display: 'flex', gap: 6 }}>{right}</div>
    </div>
  )
}

function BulkBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' }}>
      {label}
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
// Normaliza strings del CSV: NULL / null / — / - / 0 / 0.0 / vacío → null
function normStr(v) {
  const s = String(v ?? '').trim()
  if (!s || s.toLowerCase() === 'null' || s === '—' || s === '-' || s === '0' || s === '0.0') return null
  return s
}

export default function HwNokiaCarga() {
  const hwEquipos             = useHwStore(s => s.hwEquipos)
  const hwCatalogo            = useHwStore(s => s.hwCatalogo)
  const hwMovimientos         = useHwStore(s => s.hwMovimientos)
  const hwDespachosPendientes = useHwStore(s => s.hwDespachosPendientes)
  const loadAll               = useHwStore(s => s.loadAll)

  // ── Modo ──────────────────────────────────────────────────────────
  const [modo, setModo] = useState('inicial') // 'inicial' | 'sync'

  // ── Estado Carga Inicial ─────────────────────────────────────────
  const [inicialPhase,     setInicialPhase]     = useState('upload')
  const [inicialFilKar,    setInicialFilKar]    = useState(null)
  const [inicialFilInv,    setInicialFilInv]    = useState(null)
  const [inicialData,      setInicialData]      = useState(null)
  const [inicialAnalyzing,       setInicialAnalyzing]       = useState(false)
  const [inicialExecuting,       setInicialExecuting]       = useState(false)
  const [inicialResult,          setInicialResult]          = useState(null)
  const [inicialAddingCatalogo,  setInicialAddingCatalogo]  = useState(false)

  function resetInicial() {
    setInicialPhase('upload'); setInicialFilKar(null); setInicialFilInv(null)
    setInicialData(null); setInicialResult(null)
  }

  async function handleAgregarCatalogo() {
    if (!inicialData?.sinCatalogo?.length) return
    setInicialAddingCatalogo(true)
    try {
      // Códigos únicos sin catálogo
      const uniqueCodes = [...new Map(
        inicialData.sinCatalogo.map(it => [it.codMat, it])
      ).values()]
      for (const it of uniqueCodes) {
        const { error } = await db().from('hw_catalogo').insert({
          cod_material:  it.codMat,
          descripcion:   it.desc || `Equipo ${it.codMat}`,
          aplica_serial: true,
          activo:        true,
        })
        if (error && !error.message?.includes('duplicate')) throw error
      }
      await loadAll()
      showToast(`${uniqueCodes.length} código(s) agregado(s) al catálogo — re-analizando…`)
      // Re-analizar con los archivos ya cargados
      await handleAnalizarInicial()
    } catch (e) {
      showToast('Error al agregar al catálogo: ' + e.message, 'err')
    } finally {
      setInicialAddingCatalogo(false)
    }
  }

  async function handleAnalizarInicial() {
    if (!inicialFilKar) { showToast('Carga el archivo Kardex', 'err'); return }
    setInicialAnalyzing(true)
    try {
      // ── Parsear Kardex ──
      // Cada fila = 1 movimiento con su tipo real (ENTRADA/SALIDA desde col 14)
      const liveCatalogo = useHwStore.getState().hwCatalogo
      const kardexLines  = (await inicialFilKar.text()).split(/\r?\n/)
      const kardexItems  = []   // todos los movimientos
      const kardexBySO   = new Map() // SO → primer item (para join con Inventario)
      for (let i = 1; i < kardexLines.length; i++) {
        const line = kardexLines[i].trim(); if (!line) continue
        const c          = parseKardexRow(line)
        const nokiaId    = normStr(c[0]); if (!nokiaId) continue
        const so         = normStr(c[5]) || normStr(c[6]); if (!so) continue
        const codMat     = normStr(c[7])
        const serial     = normStr(c[18])
        const fecha      = (c[15]?.trim() || '').slice(0, 10) || null
        const tipoFuente = normStr(c[13])
        const tipo       = normStr(c[14]) || 'ENTRADA'   // tipo_movimiento real
        const cantidad   = Number(normStr(c[10])) || 1
        const cat        = liveCatalogo.find(ct => String(ct.cod_material) === codMat) || null
        const desc       = c[9]?.trim() || ''
        const item       = { nokiaId, so, codMat, serial, fecha, tipoFuente, tipo, cantidad, cat, desc }
        kardexItems.push(item)
        if (!kardexBySO.has(so)) kardexBySO.set(so, item)
      }

      // ── Parsear Inventario — solo para ubicación/estado actual ──
      // El Inventario NO genera salidas; indica dónde está cada equipo hoy
      const invBySO        = new Map()  // SO → { siteName, smp, fecha }
      const invSitios      = new Set()
      const invEnSitioXCatId = new Map() // catalogo_id → cantidad en sitio (desde Inventario Nokia)
      if (inicialFilInv) {
        const invLines = (await inicialFilInv.text()).split(/\r?\n/)
        for (let i = 1; i < invLines.length; i++) {
          const line = invLines[i].trim(); if (!line) continue
          const c        = parseKardexRow(line)
          const siteName  = normStr(c[2]); if (!siteName) continue
          const so        = normStr(c[11])
          const smp       = normStr(c[3])
          const fecha     = (c[17]?.trim() || '').slice(0, 10) || null
          const cantidad  = Number(normStr(c[9])) || 1  // columna 10 (1-based) = c[9]
          const codMatInv = normStr(c[6])  // codigo_capex columna 7 (1-based)
          const catInv    = codMatInv ? liveCatalogo.find(ct => String(ct.cod_material) === codMatInv) : null
          // Solo agregar a invBySO si tiene SO (necesario para el join con equipos)
          if (so && !invBySO.has(so)) invBySO.set(so, { siteName, smp, fecha })
          invSitios.add(siteName)
          // Contar en-sitio siempre (incluso filas sin SO)
          if (catInv?.id) {
            invEnSitioXCatId.set(catInv.id, (invEnSitioXCatId.get(catInv.id) || 0) + cantidad)
          }
        }
      }

      // ── Derivar colecciones para el preview ──
      // Equipos serializados: última aparición por serial (serial es la identidad)
      const serialMap = new Map()
      for (const k of kardexItems) {
        if (k.serial) serialMap.set(k.serial, k)
      }
      const equiposSerial  = [...serialMap.values()]
      const sinSerialMovs  = kardexItems.filter(k => !k.serial)
      const enSitio        = equiposSerial.filter(k => invBySO.has(k.so))
      const enBodega       = equiposSerial.filter(k => !invBySO.has(k.so))
      const uniqueSites    = [...invSitios]
      const sinCatalogo    = kardexItems.filter(k => !k.cat)
        .reduce((acc, k) => { if (!acc.find(x => x.codMat === k.codMat)) acc.push({ ...k }); return acc }, [])

      setInicialData({ kardexItems, equiposSerial, sinSerialMovs, enSitio, enBodega, invBySO, invEnSitioXCatId, uniqueSites, sinCatalogo })
      setInicialPhase('preview')
    } catch (e) {
      showToast('Error al analizar: ' + e.message, 'err')
    } finally {
      setInicialAnalyzing(false)
    }
  }

  async function handleEjecutarInicial() {
    if (!inicialData) return
    setInicialExecuting(true)
    try {
      const { kardexItems, equiposSerial, invBySO, invEnSitioXCatId, uniqueSites } = inicialData
      const now   = new Date().toISOString()
      const BATCH = 200
      const result = { equipos: 0, movimientos: 0, sitios: 0 }

      // 1. hw_equipos — solo serializados, 1 fila por serial único
      //    SO es atributo informativo, ya NO es llave única
      const equipoPayloads = equiposSerial.map(k => {
        const inv = invBySO.get(k.so)
        return {
          serial:           k.serial,
          catalogo_id:      k.cat?.id || null,
          so:               k.so,
          estado:           inv ? 'en_sitio' : 'en_bodega',
          ubicacion_actual: inv ? inv.siteName : null,
          condicion:        'nuevo',
          nokia_sync_at:    now,
        }
      })
      for (let i = 0; i < equipoPayloads.length; i += BATCH) {
        const { error } = await db().from('hw_equipos').upsert(
          equipoPayloads.slice(i, i + BATCH), { onConflict: 'serial' }
        )
        if (error) throw error
        result.equipos += Math.min(BATCH, equipoPayloads.length - i)
      }

      // 2. hw_movimientos — 1 por fila Kardex, respetando tipo_movimiento real
      //    Aplica a serializados Y sin-serial
      const movPayloads = kardexItems.map(k => {
        const isSalida = k.tipo === 'SALIDA'
        const site     = invBySO.get(k.so)?.siteName || null
        return {
          serial:       k.serial || null,
          catalogo_id:  k.cat?.id || null,
          tipo:         k.tipo,
          tipo_fuente:  k.tipoFuente || 'NOKIA_KARDEX',
          fuente:       'NOKIA_KARDEX',
          so:           k.so,
          cantidad:     k.cantidad,
          fecha:        k.fecha,
          origen:       isSalida ? null    : 'Nokia',
          origen_tipo:  isSalida ? null    : 'nokia',
          destino:      isSalida ? site    : null,
          destino_tipo: isSalida ? (site ? 'sitio' : 'bodega') : 'bodega',
          nokia_md5:    k.nokiaId,
        }
      })
      for (let i = 0; i < movPayloads.length; i += BATCH) {
        const { error } = await db().from('hw_movimientos').upsert(
          movPayloads.slice(i, i + BATCH), { onConflict: 'nokia_md5', ignoreDuplicates: true }
        )
        if (error) throw error
        result.movimientos += Math.min(BATCH, movPayloads.length - i)
      }

      // 3. nokia_inv_en_sitio en hw_catalogo — snapshot del Inventario Nokia por cod_material
      showToast(`Debug: ${invEnSitioXCatId.size} tipo(s) a actualizar en catálogo`)
      for (const [catId, cantidad] of invEnSitioXCatId.entries()) {
        const { error } = await db().from('hw_catalogo')
          .update({ nokia_inv_en_sitio: cantidad })
          .eq('id', catId)
        if (error) showToast(`Error catálogo ${catId}: ${error.message}`, 'err')
      }

      // 4. mat_sitios para cada siteName único del Inventario
      const { useMatStore } = await import('../../store/useMatStore')
      const matState = useMatStore.getState()
      const existingSites = new Set(matState.sitios.map(s => s.nombre?.toLowerCase()))
      for (const siteName of uniqueSites) {
        if (existingSites.has(siteName.toLowerCase())) continue
        try {
          await matState.saveSitio({ nombre: siteName, tipo_cw: '', regional: 'Sur-Occidente', comentarios: '', activo: true })
          result.sitios++
        } catch (_) {}
      }

      await loadAll()
      setInicialResult(result)
      setInicialPhase('done')
      showToast('Carga inicial completada')
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setInicialExecuting(false)
    }
  }

  // ── Estado Sync ──────────────────────────────────────────────────
  const [phase,      setPhase]      = useState('upload')
  const [filInv,     setFilInv]     = useState(null)
  const [filKar,     setFilKar]     = useState(null)
  const [analyzing,  setAnalyzing]  = useState(false)
  const [analysis,   setAnalysis]   = useState(null)
  const [openSec,    setOpenSec]    = useState(null)
  // rowActions: plain objects — avoid Set reference issues with React
  // estadoDiferente: { [serial]: 'update' | 'keep' }
  // soloEnNokia:     { [serial]: 'register' | 'ignore' }
  // kardexNuevos:    { [nokiaId]: 'import' | 'ignore' }
  const [rowActions, setRowActions] = useState({ estadoDiferente: {}, soloEnNokia: {}, kardexNuevos: {}, sinSerialDiferente: {} })
  const [executing,  setExecuting]  = useState(false)
  const [execResult, setExecResult] = useState(null)

  function resetAll() {
    setPhase('upload'); setAnalysis(null); setFilInv(null); setFilKar(null)
    setOpenSec(null); setExecResult(null)
    setRowActions({ estadoDiferente: {}, soloEnNokia: {}, kardexNuevos: {}, sinSerialDiferente: {} })
  }

  function setRowAction(cat, key, action) {
    setRowActions(prev => ({ ...prev, [cat]: { ...prev[cat], [key]: action } }))
  }

  function setAllActions(cat, keys, action) {
    setRowActions(prev => {
      const next = { ...prev[cat] }
      keys.forEach(k => { next[k] = action })
      return { ...prev, [cat]: next }
    })
  }

  // ── Analyze ──────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!filInv && !filKar) return
    setAnalyzing(true)
    try {
      const liveCat = useHwStore.getState().hwCatalogo
      const res = {
        sincronizados: [], despachosPendientes: [], estadoDiferente: [],
        soloEnNokia: [], soloEnApp: [], kardexNuevos: [],
        kardexDuplicados: 0, sinCatalogo: [],
        sinSerialSincronizado: [], sinSerialDiferente: [],
      }

      const pendingSerials = new Set()
      hwDespachosPendientes.forEach(d => (d.items || []).forEach(i => { if (i.serial) pendingSerials.add(i.serial) }))
      hwEquipos.forEach(e => { if (e.estado === 'pendiente_despacho' && e.serial) pendingSerials.add(e.serial) })

      const appBySerial = new Map(hwEquipos.filter(e => e.serial).map(e => [e.serial, e]))
      const nokiaSerials = new Set()

      // ── Parsear Inventario Nokia (CSV) ──────────────────────────────
      if (filInv) {
        // Mapas: serial → { siteName, so }, SO → siteName, y codMat → cantidad en sitio
        const invBySerial  = new Map()
        const invBySO      = new Map()
        const invSinSerial = {} // codMat → { cat, siteName, cantidad, sos[] }

        const invLines = (await filInv.text()).split(/\r?\n/)
        for (let i = 1; i < invLines.length; i++) {
          const line = invLines[i].trim(); if (!line) continue
          const c        = parseKardexRow(line)
          const siteName = normStr(c[2]); if (!siteName) continue
          const so       = normStr(c[11])
          const codMat   = normStr(c[6])
          const serial   = normStr(c[14])  // serial en Inventario (columna 15)
          const cantidad = Number(normStr(c[9])) || 1
          const cat      = codMat ? liveCat.find(ct => String(ct.cod_material) === codMat) || null : null

          if (so && !invBySO.has(so)) invBySO.set(so, { siteName })
          if (serial) {
            nokiaSerials.add(serial)
            if (!invBySerial.has(serial)) invBySerial.set(serial, { siteName, so, cat, codMat })
          } else {
            // sin serial — agrupar por codMat + siteName
            const key = `${codMat}||${siteName}`
            if (!invSinSerial[key]) invSinSerial[key] = { key, codMat, cat, siteName, nokiaCantidad: 0, sos: [], rows: [] }
            invSinSerial[key].nokiaCantidad += cantidad
            if (so && !invSinSerial[key].sos.includes(so)) invSinSerial[key].sos.push(so)
            invSinSerial[key].rows.push({ so, cantidad })
          }
          if (!cat && codMat) res.sinCatalogo.push({ serial: serial || '(sin serial)', codMat, nokiaEstado: 'en_sitio', nokiaUbic: siteName })
        }

        // ── Comparar serializados con app ──
        for (const [serial, inv] of invBySerial) {
          if (!inv.cat) continue
          const nRow = { serial, cat: inv.cat, nokiaEstado: 'en_sitio', nokiaUbic: inv.siteName, nokiaSo: inv.so }
          if (pendingSerials.has(serial)) {
            res.despachosPendientes.push({ ...nRow, equipo: appBySerial.get(serial) || null }); continue
          }
          const eq = appBySerial.get(serial)
          if (!eq) { res.soloEnNokia.push(nRow); continue }
          const diffs = []
          if (eq.estado !== 'en_sitio') diffs.push('estado')
          if ((eq.ubicacion_actual || '').toLowerCase().trim() !== inv.siteName.toLowerCase().trim()) diffs.push('ubicacion')
          if (diffs.length > 0) res.estadoDiferente.push({ ...nRow, equipo: eq, diffs })
          else res.sincronizados.push({ ...nRow, equipo: eq })
        }

        // Equipos en app que Nokia no reporta en el Inventario
        // Solo en App: equipos en_sitio cuyo serial Y cuyo SO no están en el Inventario
        for (const [serial, eq] of appBySerial) {
          if (pendingSerials.has(serial)) continue
          if (nokiaSerials.has(serial)) continue
          if (eq.so && invBySO.has(eq.so)) continue  // fallback: SO encontrado en Inventario
          if (eq.estado === 'en_sitio')
            res.soloEnApp.push({ serial, cat: liveCat.find(c => c.id === eq.catalogo_id) || null, equipo: eq })
        }

        // ── Comparar sin-serial con movimientos en app ──
        for (const item of Object.values(invSinSerial)) {
          if (!item.cat) continue
          const catMovs = hwMovimientos.filter(m => m.catalogo_id === item.cat.id && !m.serial)
          const appNet  = Math.max(0, catMovs.reduce((s, m) => {
            return m.tipo === 'ENTRADA' ? s + (m.cantidad || 0) : s - (m.cantidad || 0)
          }, 0))
          item.appNet     = appNet
          item.diferencia = item.nokiaCantidad - appNet
          if (item.diferencia === 0) res.sinSerialSincronizado.push(item)
          else                       res.sinSerialDiferente.push(item)
        }
      }

      // ── Kardex: detectar movimientos nuevos ─────────────────────────
      if (filKar) {
        const { data: existingIds } = await db().from('hw_movimientos').select('nokia_md5').not('nokia_md5', 'is', null)
        const existingSet = new Set((existingIds || []).map(r => r.nokia_md5))
        const lines = (await filKar.text()).split(/\r?\n/)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim(); if (!line) continue
          const c = parseKardexRow(line)
          const nokiaId = c[0]?.trim(); if (!nokiaId) continue
          if (existingSet.has(nokiaId)) { res.kardexDuplicados++; continue }
          const codMat   = c[7]?.trim()
          const cat      = liveCat.find(ct => String(ct.cod_material) === codMat) || null
          const fechaRaw = c[15]?.trim()
          res.kardexNuevos.push({
            nokiaId, cat, codMat,
            tipo: c[14]?.trim() || 'ENTRADA', tipoFuente: c[13]?.trim() || null,
            fecha: fechaRaw ? fechaRaw.slice(0, 10) : null,
            cantidad: Number(c[10]?.trim()) || 1,
            so: c[5]?.trim() || c[6]?.trim() || null,
            serial: c[18]?.trim() || null,
          })
        }
      }

      setAnalysis(res)
      setRowActions({
        estadoDiferente:    Object.fromEntries(res.estadoDiferente.map(it => [it.serial, 'update'])),
        soloEnNokia:        Object.fromEntries(res.soloEnNokia.map(it => [it.serial, 'ignore'])),
        kardexNuevos:       Object.fromEntries(res.kardexNuevos.map(it => [it.nokiaId, 'import'])),
        sinSerialDiferente: Object.fromEntries(res.sinSerialDiferente.map(it => [it.key, 'ignorar'])),
      })
      setPhase('analyze')
      const first = res.estadoDiferente.length   > 0 ? 'estadoDiferente'
        : res.sinSerialDiferente.length > 0 ? 'sinSerialDiferente'
        : res.soloEnNokia.length        > 0 ? 'soloEnNokia'
        : res.kardexNuevos.length       > 0 ? 'kardexNuevos'
        : res.sincronizados.length      > 0 ? 'sincronizados' : null
      setOpenSec(first)
    } catch (e) {
      showToast('Error al analizar: ' + e.message, 'err')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Export ────────────────────────────────────────────────────────
  async function handleExport() {
    if (!analysis) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      function addSheet(name, headers, rows) {
        if (!rows.length) return
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        ws['!cols'] = headers.map((h, i) => ({ wch: Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)) + 2 }))
        XLSX.utils.book_append_sheet(wb, ws, name)
      }
      addSheet('Sincronizados',
        ['Serial', 'Tipo de Equipo', 'Estado Nokia', 'Ubic. Nokia', 'SO'],
        analysis.sincronizados.map(it => [it.serial, it.cat?.descripcion || '', it.nokiaEstado, it.nokiaUbic || '', it.nokiaSo || ''])
      )
      addSheet('Pend Despacho',
        ['Serial', 'Tipo de Equipo', 'Estado App', 'Estado Nokia'],
        analysis.despachosPendientes.map(it => [it.serial, it.cat?.descripcion || '', it.equipo?.estado || '', it.nokiaEstado])
      )
      addSheet('Estado Diferente',
        ['Serial', 'Tipo de Equipo', 'Estado App', 'Ubic. App', 'Estado Nokia', 'Ubic. Nokia', 'SO Nokia', 'Diferencias', 'Accion'],
        analysis.estadoDiferente.map(it => [
          it.serial, it.cat?.descripcion || '',
          it.equipo?.estado || '', it.equipo?.ubicacion_actual || '',
          it.nokiaEstado, it.nokiaUbic || '', it.nokiaSo || '', it.diffs.join(', '),
          rowActions.estadoDiferente[it.serial] === 'update' ? 'Actualizar' : 'Mantener',
        ])
      )
      addSheet('Solo en Nokia',
        ['Serial', 'Tipo de Equipo', 'Estado Nokia', 'Ubic. Nokia', 'SO', 'Accion'],
        analysis.soloEnNokia.map(it => [it.serial, it.cat?.descripcion || '', it.nokiaEstado, it.nokiaUbic || '', it.nokiaSo || '',
          rowActions.soloEnNokia[it.serial] === 'register' ? 'Registrar' : 'Ignorar'])
      )
      addSheet('Solo en App',
        ['Serial', 'Tipo de Equipo', 'Estado App', 'Ubic. App'],
        analysis.soloEnApp.map(it => [it.serial, it.cat?.descripcion || '', it.equipo?.estado || '', it.equipo?.ubicacion_actual || ''])
      )
      addSheet('Kardex Nuevos',
        ['ID Nokia', 'Tipo de Equipo', 'Tipo Mov.', 'Fecha', 'Cantidad', 'SO', 'Serial', 'Accion'],
        analysis.kardexNuevos.map(it => [it.nokiaId, it.cat?.descripcion || it.codMat || '', it.tipo, it.fecha || '', it.cantidad, it.so || '', it.serial || '',
          rowActions.kardexNuevos[it.nokiaId] === 'import' ? 'Importar' : 'Ignorar'])
      )
      addSheet('Sin Serial — Diferente',
        ['Tipo de Equipo', 'Cód.', 'Ubic. Nokia', 'Estado Nokia', 'SO(s) Nokia', 'Cant. Nokia', 'Cant. App', 'Diferencia', 'Acción'],
        analysis.sinSerialDiferente.map(it => [
          it.cat?.descripcion || '', it.codMat, it.nokiaUbic || '', it.nokiaEstado,
          it.sos.join(', '), it.nokiaCantidad, it.appNet, it.diferencia,
          rowActions.sinSerialDiferente[it.key] === 'registrar' ? 'Registrar faltantes' : 'Ignorar',
        ])
      )
      addSheet('Sin Serial — OK',
        ['Tipo de Equipo', 'Cód.', 'Ubic. Nokia', 'Estado Nokia', 'SO(s) Nokia', 'Cant.'],
        analysis.sinSerialSincronizado.map(it => [
          it.cat?.descripcion || '', it.codMat, it.nokiaUbic || '', it.nokiaEstado,
          it.sos.join(', '), it.nokiaCantidad,
        ])
      )
      addSheet('Sin Catalogo',
        ['Serial', 'Cód. Material', 'Estado Nokia', 'Ubic. Nokia'],
        analysis.sinCatalogo.map(it => [it.serial, it.codMat, it.nokiaEstado, it.nokiaUbic || ''])
      )
      XLSX.writeFile(wb, `analisis_nokia_${new Date().toISOString().slice(0, 10)}.xlsx`)
      showToast('Excel exportado')
    } catch (e) {
      showToast('Error al exportar: ' + e.message, 'err')
    }
  }

  // ── Execute ──────────────────────────────────────────────────────
  async function handleExecute() {
    if (!analysis) return
    setExecuting(true)
    try {
      const summary = { estadoActualizado: 0, equiposRegistrados: 0, kardexImportados: 0, sinSerialRegistrados: 0 }
      const now = new Date().toISOString()

      const toUpdate = analysis.estadoDiferente.filter(it => rowActions.estadoDiferente[it.serial] === 'update')
      for (const item of toUpdate) {
        const { error } = await db().from('hw_equipos').update({
          estado: item.nokiaEstado, ubicacion_actual: item.nokiaUbic,
          nokia_estado: item.nokiaEstLabel, so: item.nokiaSo, nokia_sync_at: now,
        }).eq('id', item.equipo.id)
        if (!error) summary.estadoActualizado++
      }

      const toRegister = analysis.soloEnNokia.filter(it => rowActions.soloEnNokia[it.serial] === 'register')
      if (toRegister.length > 0) {
        const payloads = toRegister.map(item => ({
          serial: item.serial, catalogo_id: item.cat?.id || null,
          estado: item.nokiaEstado, ubicacion_actual: item.nokiaUbic,
          nokia_estado: item.nokiaEstLabel, so: item.nokiaSo,
          condicion: 'bueno', nokia_sync_at: now,
        }))
        const BATCH = 100
        for (let i = 0; i < payloads.length; i += BATCH) {
          const { error } = await db().from('hw_equipos').upsert(payloads.slice(i, i + BATCH), { onConflict: 'serial' })
          if (!error) summary.equiposRegistrados += Math.min(BATCH, payloads.length - i)
        }
      }

      const toImport = analysis.kardexNuevos.filter(it => rowActions.kardexNuevos[it.nokiaId] === 'import')
      if (toImport.length > 0) {
        const payloads = toImport.map(item => ({
          catalogo_id: item.cat?.id || null, tipo: item.tipo, fuente: 'NOKIA_KARDEX',
          tipo_fuente: item.tipoFuente, fecha: item.fecha, cantidad: item.cantidad,
          so: item.so, serial: item.serial, nokia_md5: item.nokiaId,
          destino: null, destino_tipo: null, origen: null, origen_tipo: null, notas: null,
        }))
        const BATCH = 200
        for (let i = 0; i < payloads.length; i += BATCH) {
          const { error } = await db().from('hw_movimientos').insert(payloads.slice(i, i + BATCH))
          if (!error) summary.kardexImportados += Math.min(BATCH, payloads.length - i)
        }
      }

      // ── Sin serial: registrar movimientos faltantes (1 movimiento por SO) ──
      const toRegSS = (analysis.sinSerialDiferente || []).filter(it =>
        rowActions.sinSerialDiferente[it.key] === 'registrar' && it.diferencia > 0
      )
      for (const item of toRegSS) {
        const tipo = item.nokiaEstado === 'en_bodega' ? 'ENTRADA' : 'SALIDA'
        const rowsToCreate = item.rows.slice(-item.diferencia)
        for (const row of rowsToCreate) {
          const payload = {
            equipo_id: null, serial: null,
            catalogo_id: item.cat.id,
            tipo, tipo_fuente: 'NOKIA_REPORTE',
            so: row.nokiaSo || null,
            cantidad: row.cantidad || 1,
            destino:      item.nokiaUbic || null,
            destino_tipo: tipo === 'SALIDA' ? (item.nokiaEstado === 'en_sitio' ? 'sitio' : 'nokia') : 'bodega',
            origen:       tipo === 'ENTRADA' ? 'Nokia' : null,
            origen_tipo:  tipo === 'ENTRADA' ? 'nokia' : null,
            fecha: new Date().toISOString().slice(0, 10),
            notas: `Nokia sync: ${item.nokiaCantidad} Nokia / ${item.appNet} App`,
          }
          const { error } = await db().from('hw_movimientos').insert(payload)
          if (!error) summary.sinSerialRegistrados++
        }
      }

      await loadAll()
      setExecResult(summary)
      setPhase('done')
      showToast('Sincronización completada')
    } catch (e) {
      showToast('Error al ejecutar: ' + e.message, 'err')
    } finally {
      setExecuting(false)
    }
  }

  // ── Section tables ────────────────────────────────────────────────
  function renderSection() {
    if (!analysis || !openSec) return null

    // Tabla con scroll doble y header sticky relativo al contenedor
    const ST = ({ children }) => (
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '62vh', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table>
      </div>
    )

    if (openSec === 'sincronizados') return (
      <ST>
        <thead><tr><Th>Serial</Th><Th>Tipo de Equipo</Th><Th>Estado Nokia</Th><Th>Ubic. Nokia</Th><Th>SO</Th></tr></thead>
        <tbody>{analysis.sincronizados.map(it => (
          <tr key={it.serial}>
            <Td><code style={{ fontSize: 11 }}>{it.serial}</code></Td>
            <Td>{it.cat?.descripcion || '—'}</Td>
            <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
            <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaUbic || '—'}</Td>
            <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaSo || '—'}</Td>
          </tr>
        ))}</tbody>
      </ST>
    )

    if (openSec === 'despachosPendientes') return (
      <ST>
        <thead><tr><Th>Serial</Th><Th>Tipo de Equipo</Th><Th>Estado App</Th><Th>Estado Nokia</Th><Th>Nota</Th></tr></thead>
        <tbody>{analysis.despachosPendientes.map(it => (
          <tr key={it.serial}>
            <Td><code style={{ fontSize: 11 }}>{it.serial}</code></Td>
            <Td>{it.cat?.descripcion || '—'}</Td>
            <Td><EstadoBadge estado={it.equipo?.estado || 'pendiente_despacho'} /></Td>
            <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
            <Td style={{ fontSize: 11, color: '#6b7280' }}>Alistado para despacho — discrepancia normal</Td>
          </tr>
        ))}</tbody>
      </ST>
    )

    if (openSec === 'estadoDiferente') {
      const items = analysis.estadoDiferente
      const keys  = items.map(it => it.serial)
      const updateCount  = keys.filter(k => rowActions.estadoDiferente[k] === 'update').length
      const keepCount    = keys.filter(k => rowActions.estadoDiferente[k] === 'keep').length
      return (
        <>
          <SectionHeader
            left={<><strong>{updateCount}</strong> para actualizar · <strong>{keepCount}</strong> para mantener</>}
            right={<>
              <BulkBtn label="Actualizar todos" onClick={() => setAllActions('estadoDiferente', keys, 'update')} />
              <BulkBtn label="Mantener todos"   onClick={() => setAllActions('estadoDiferente', keys, 'keep')} />
            </>}
          />
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '62vh', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <Th>Serial</Th><Th>Tipo de Equipo</Th>
                <Th>Estado App</Th><Th>Ubic. App</Th>
                <Th>Estado Nokia</Th><Th>Ubic. Nokia</Th>
                <Th>Diagnóstico</Th><Th>Acción</Th>
              </tr></thead>
              <tbody>{items.map(it => {
                const action = rowActions.estadoDiferente[it.serial]
                const appEst = it.equipo?.estado
                const diffs  = it.diffs || []
                // Derivar diagnóstico según el tipo de diferencia
                let diagnostico = null
                if (diffs.includes('estado') && !diffs.includes('ubicacion')) {
                  if (appEst === 'en_bodega' && it.nokiaEstado === 'en_sitio')
                    diagnostico = { label: '⚠ Pend. Legalizar', hint: 'Realizar despacho en la app', bg: '#fef3c7', color: '#92400e' }
                  else if (appEst === 'en_sitio' && it.nokiaEstado === 'en_bodega')
                    diagnostico = { label: '⚠ Retorno Nokia', hint: 'Nokia lo marca como disponible', bg: '#fef3c7', color: '#92400e' }
                  else
                    diagnostico = { label: '⚠ Estado diferente', hint: `App: ${appEst} / Nokia: ${it.nokiaEstado}`, bg: '#fef3c7', color: '#92400e' }
                } else if (diffs.includes('ubicacion') && !diffs.includes('estado')) {
                  diagnostico = { label: '📍 Mismatch ubicación', hint: 'Verificar sitio en Nokia o en la app', bg: '#eff6ff', color: '#1e40af' }
                } else if (diffs.length > 1) {
                  diagnostico = { label: '⚠ Estado + Ubicación', hint: 'Diferencia múltiple — verificar manualmente', bg: '#fde8e7', color: '#c0392b' }
                }
                return (
                  <tr key={it.serial} style={{ background: action === 'update' ? '#f0fdf4' : action === 'keep' ? '#f9fafb' : 'transparent' }}>
                    <Td><code style={{ fontSize: 11 }}>{it.serial}</code></Td>
                    <Td>{it.cat?.descripcion || '—'}</Td>
                    <Td><EstadoBadge estado={appEst} /></Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.equipo?.ubicacion_actual || '—'}</Td>
                    <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaUbic || '—'}</Td>
                    <Td>
                      {diagnostico && (
                        <div style={{ background: diagnostico.bg, borderRadius: 5, padding: '3px 7px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: diagnostico.color }}>{diagnostico.label}</div>
                          <div style={{ fontSize: 9, color: diagnostico.color, opacity: .85, marginTop: 1 }}>{diagnostico.hint}</div>
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionBtn label="Actualizar" active={action === 'update'} color="#144E4A" onClick={() => setRowAction('estadoDiferente', it.serial, 'update')} />
                        <ActionBtn label="Mantener"   active={action === 'keep'}   color="#374151" onClick={() => setRowAction('estadoDiferente', it.serial, 'keep')} />
                      </div>
                    </Td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        </>
      )
    }

    if (openSec === 'soloEnNokia') {
      const items = analysis.soloEnNokia
      const keys  = items.map(it => it.serial)
      const regCount = keys.filter(k => rowActions.soloEnNokia[k] === 'register').length
      const ignCount = keys.filter(k => rowActions.soloEnNokia[k] === 'ignore').length
      return (
        <>
          <SectionHeader
            left={<><strong>{regCount}</strong> para registrar · <strong>{ignCount}</strong> para ignorar</>}
            right={<>
              <BulkBtn label="Registrar todos" onClick={() => setAllActions('soloEnNokia', keys, 'register')} />
              <BulkBtn label="Ignorar todos"   onClick={() => setAllActions('soloEnNokia', keys, 'ignore')} />
            </>}
          />
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '62vh', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <Th>Serial</Th><Th>Tipo de Equipo</Th><Th>Estado Nokia</Th><Th>Ubic. Nokia</Th><Th>SO Nokia</Th><Th>Acción</Th>
              </tr></thead>
              <tbody>{items.map(it => {
                const action = rowActions.soloEnNokia[it.serial]
                return (
                  <tr key={it.serial} style={{ background: action === 'register' ? '#eff6ff' : '#f9fafb' }}>
                    <Td><code style={{ fontSize: 11 }}>{it.serial}</code></Td>
                    <Td>{it.cat?.descripcion || '—'}</Td>
                    <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaUbic || '—'}</Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaSo || '—'}</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionBtn label="Registrar" active={action === 'register'} color="#1e40af" onClick={() => setRowAction('soloEnNokia', it.serial, 'register')} />
                        <ActionBtn label="Ignorar"   active={action === 'ignore'}   color="#374151" onClick={() => setRowAction('soloEnNokia', it.serial, 'ignore')} />
                      </div>
                    </Td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        </>
      )
    }

    if (openSec === 'soloEnApp') return (
      <ST>
        <thead><tr><Th>Serial</Th><Th>Tipo de Equipo</Th><Th>Estado App</Th><Th>Ubic. App</Th></tr></thead>
        <tbody>{analysis.soloEnApp.map(it => (
          <tr key={it.serial}>
            <Td><code style={{ fontSize: 11 }}>{it.serial}</code></Td>
            <Td>{it.cat?.descripcion || '—'}</Td>
            <Td><EstadoBadge estado={it.equipo?.estado} /></Td>
            <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.equipo?.ubicacion_actual || '—'}</Td>
          </tr>
        ))}</tbody>
      </ST>
    )

    if (openSec === 'kardexNuevos') {
      const items     = analysis.kardexNuevos
      const keys      = items.map(it => it.nokiaId)
      const impCount  = keys.filter(k => rowActions.kardexNuevos[k] === 'import').length
      const ignCount  = keys.filter(k => rowActions.kardexNuevos[k] === 'ignore').length
      const VISIBLE   = 200
      return (
        <>
          <SectionHeader
            left={<><strong>{impCount}</strong> para importar · <strong>{ignCount}</strong> para ignorar{items.length > VISIBLE && ` · mostrando ${VISIBLE} de ${fmt(items.length)}`}</>}
            right={<>
              <BulkBtn label="Importar todos" onClick={() => setAllActions('kardexNuevos', keys, 'import')} />
              <BulkBtn label="Ignorar todos"  onClick={() => setAllActions('kardexNuevos', keys, 'ignore')} />
            </>}
          />
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '62vh', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <Th>ID Nokia</Th><Th>Tipo de Equipo</Th><Th>Mov.</Th><Th>Fecha</Th><Th style={{ textAlign: 'right' }}>Cant.</Th><Th>SO</Th><Th>Serial</Th><Th>Acción</Th>
              </tr></thead>
              <tbody>
                {items.slice(0, VISIBLE).map((it, i) => {
                  const action = rowActions.kardexNuevos[it.nokiaId]
                  return (
                    <tr key={it.nokiaId || i} style={{ background: action === 'import' ? '#f0fdfa' : '#f9fafb' }}>
                      <Td><code style={{ fontSize: 10 }}>{it.nokiaId?.slice(0, 14)}{it.nokiaId?.length > 14 ? '…' : ''}</code></Td>
                      <Td style={{ fontSize: 11 }}>{it.cat?.descripcion || it.codMat || '—'}</Td>
                      <Td><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: it.tipo === 'SALIDA' ? '#fde8e7' : '#d4edda', color: it.tipo === 'SALIDA' ? '#c0392b' : '#1a6130' }}>{it.tipo}</span></Td>
                      <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.fecha || '—'}</Td>
                      <Td style={{ textAlign: 'right' }}>{fmt(it.cantidad)}</Td>
                      <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.so || '—'}</Td>
                      <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.serial || '—'}</Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <ActionBtn label="Importar" active={action === 'import'} color="#0f766e" onClick={() => setRowAction('kardexNuevos', it.nokiaId, 'import')} />
                          <ActionBtn label="Ignorar"  active={action === 'ignore'} color="#374151" onClick={() => setRowAction('kardexNuevos', it.nokiaId, 'ignore')} />
                        </div>
                      </Td>
                    </tr>
                  )
                })}
                {items.length > VISIBLE && (
                  <tr><td colSpan={8} style={{ padding: '8px 10px', textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
                    Mostrando {VISIBLE} de {fmt(items.length)} filas — usa "Importar todos / Ignorar todos" para aplicar a la lista completa. El Excel incluye todas las filas.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )
    }

    if (openSec === 'sinSerialDiferente') {
      const items = analysis.sinSerialDiferente
      const keys  = items.map(it => it.key)
      const regCount = keys.filter(k => rowActions.sinSerialDiferente[k] === 'registrar').length
      const ignCount = keys.filter(k => rowActions.sinSerialDiferente[k] === 'ignorar').length
      return (
        <>
          <SectionHeader
            left={<><strong>{regCount}</strong> para registrar · <strong>{ignCount}</strong> para ignorar · <span style={{ color:'#6b7280' }}>Items sin serial con diferencia Nokia vs App</span></>}
            right={<>
              <BulkBtn label="Registrar todos" onClick={() => setAllActions('sinSerialDiferente', keys.filter(k => { const it = items.find(x => x.key === k); return it && it.diferencia > 0 }), 'registrar')} />
              <BulkBtn label="Ignorar todos"   onClick={() => setAllActions('sinSerialDiferente', keys, 'ignorar')} />
            </>}
          />
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '62vh', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <Th>Tipo de Equipo</Th><Th>Cód.</Th>
                <Th center>Nokia</Th><Th center>App</Th><Th center>Diferencia</Th>
                <Th>Estado Nokia</Th><Th>Ubicación Nokia</Th><Th>SO(s)</Th><Th>Acción</Th>
              </tr></thead>
              <tbody>{items.map(it => {
                const action = rowActions.sinSerialDiferente[it.key]
                const diff = it.diferencia
                return (
                  <tr key={it.key} style={{ background: action === 'registrar' ? '#eff6ff' : '#f9fafb' }}>
                    <Td style={{ fontWeight: 600 }}>{it.cat?.descripcion || '—'}</Td>
                    <Td style={{ fontSize: 11, fontFamily: 'monospace', color: '#92400e' }}>{it.codMat}</Td>
                    <Td center style={{ fontWeight: 700, color: '#1e40af' }}>{it.nokiaCantidad}</Td>
                    <Td center style={{ fontWeight: 700, color: it.appNet === 0 ? '#c0392b' : '#374151' }}>{it.appNet}</Td>
                    <Td center style={{ fontWeight: 800, color: diff > 0 ? '#c0392b' : '#166534' }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </Td>
                    <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaUbic || '—'}</Td>
                    <Td style={{ fontSize: 10, color: '#6b7280', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {it.sos.join(', ') || '—'}
                    </Td>
                    <Td>
                      {diff > 0 ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <ActionBtn label={`Registrar +${diff}`} active={action === 'registrar'} color="#1e40af" onClick={() => setRowAction('sinSerialDiferente', it.key, 'registrar')} />
                          <ActionBtn label="Ignorar" active={action === 'ignorar'} color="#374151" onClick={() => setRowAction('sinSerialDiferente', it.key, 'ignorar')} />
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: '#6b7280' }}>App tiene más — sin acción</span>
                      )}
                    </Td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        </>
      )
    }

    if (openSec === 'sinSerialSincronizado') return (
      <ST>
        <thead><tr><Th>Tipo de Equipo</Th><Th>Cód.</Th><Th center>Cantidad</Th><Th>Estado Nokia</Th><Th>Ubicación Nokia</Th><Th>SO(s)</Th></tr></thead>
        <tbody>{analysis.sinSerialSincronizado.map(it => (
          <tr key={it.key}>
            <Td style={{ fontWeight: 600 }}>{it.cat?.descripcion || '—'}</Td>
            <Td style={{ fontSize: 11, fontFamily: 'monospace', color: '#92400e' }}>{it.codMat}</Td>
            <Td center style={{ fontWeight: 700 }}>{it.nokiaCantidad}</Td>
            <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
            <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaUbic || '—'}</Td>
            <Td style={{ fontSize: 10, color: '#6b7280' }}>{it.sos.join(', ') || '—'}</Td>
          </tr>
        ))}</tbody>
      </ST>
    )

    if (openSec === 'sinCatalogo') return (
      <ST>
        <thead><tr><Th>Serial</Th><Th>Cód. Material</Th><Th>Estado Nokia</Th><Th>Ubic. Nokia</Th></tr></thead>
        <tbody>{analysis.sinCatalogo.map(it => (
          <tr key={it.serial}>
            <Td><code style={{ fontSize: 11 }}>{it.serial}</code></Td>
            <Td style={{ fontFamily: 'monospace', color: '#92400e' }}>{it.codMat}</Td>
            <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
            <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaUbic || '—'}</Td>
          </tr>
        ))}</tbody>
      </ST>
    )

    return null
  }

  // Solo Estado Diferente y Solo en Nokia son accionables
  const actionCount = (
    Object.values(rowActions.estadoDiferente).filter(a => a === 'update').length +
    Object.values(rowActions.soloEnNokia).filter(a => a === 'register').length
  )

  const phaseIdx = phase === 'upload' ? 0 : phase === 'analyze' ? 1 : 2
  const PHASE_LABELS = ['Cargar archivos', 'Revisar análisis', 'Listo']

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header + toggle de modo */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Carga Nokia</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {[
            { key: 'inicial', label: '🚀 Carga Inicial', desc: 'Kardex + Inventario → construye desde cero' },
            { key: 'sync',    label: '🔄 Auditar / Sincronizar', desc: 'Compara con datos existentes' },
          ].map(m => (
            <button key={m.key} onClick={() => setModo(m.key)} style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
              background: modo === m.key ? '#144E4A' : '#f3f4f6',
              color:      modo === m.key ? '#fff'    : '#374151',
              border:     modo === m.key ? 'none' : '1px solid #e5e7eb',
              fontWeight: modo === m.key ? 700 : 400,
            }}>
              {m.label}
              <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: .75, marginTop: 1 }}>{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ MODO CARGA INICIAL ══════════════════════════════════════ */}
      {modo === 'inicial' && (
        <div>
          {inicialPhase === 'upload' && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Carga Inicial — Kardex + Inventario Nokia
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                <strong>Prerrequisito:</strong> ejecuta primero el SQL de limpieza
                <code style={{ display: 'block', marginTop: 4, fontSize: 11, background: '#fef3c7', padding: '4px 8px', borderRadius: 4 }}>
                  scripts/hw_so_unique_limpieza.sql
                </code>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Kardex Nokia <span style={{ color: '#9ca3af', fontWeight: 400 }}>(.csv)</span>
                  </div>
                  <DropZone accept=".csv" file={inicialFilKar} onFile={setInicialFilKar} disabled={inicialAnalyzing} />
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Inventario Nokia <span style={{ color: '#9ca3af', fontWeight: 400 }}>(.csv — opcional)</span>
                  </div>
                  <DropZone accept=".csv" file={inicialFilInv} onFile={setInicialFilInv} disabled={inicialAnalyzing} />
                </div>
              </div>
              <button className="btn bp" style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600,
                opacity: (!inicialFilKar || inicialAnalyzing) ? .5 : 1 }}
                disabled={!inicialFilKar || inicialAnalyzing} onClick={handleAnalizarInicial}>
                {inicialAnalyzing ? 'Analizando…' : 'Analizar archivos'}
              </button>
            </div>
          )}

          {inicialPhase === 'preview' && inicialData && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
                Vista previa — sin cambios aún
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Total movimientos',      value: inicialData.kardexItems.length,       color: '#144E4A' },
                  { label: 'Equipos serializados',   value: inicialData.equiposSerial.length,     color: '#1a6130' },
                  { label: 'En Bodega',              value: inicialData.enBodega.length,          color: '#0f766e' },
                  { label: 'En Sitio',               value: inicialData.enSitio.length,           color: '#1e40af' },
                  { label: 'Sin serial (movs.)',     value: inicialData.sinSerialMovs.length,     color: '#b45309' },
                  { label: 'Sitios a crear',         value: inicialData.uniqueSites.length,       color: '#7c3aed' },
                  { label: 'Sin catálogo',           value: inicialData.sinCatalogo.length,       color: '#c0392b' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px',
                    borderLeft: `4px solid ${k.color}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                      letterSpacing: .8, marginBottom: 2 }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>
                      {fmt(k.value)}
                    </div>
                  </div>
                ))}
              </div>
              {inicialData.sinCatalogo.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                  padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
                    ⚠ {inicialData.sinCatalogo.length} ítem(s) sin catálogo — se cargarán sin vínculo a tipo de equipo
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#fee2e2' }}>
                        {['Cód. Material', 'SO', 'Serial', 'Descripción Kardex'].map(h => (
                          <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 700,
                            color: '#991b1b', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inicialData.sinCatalogo.map((it, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #fecaca', background: '#fff' }}>
                          <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#c0392b' }}>{it.codMat}</td>
                          <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 10 }}>{it.so || '—'}</td>
                          <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 10 }}>{it.serial || '—'}</td>
                          <td style={{ padding: '4px 8px', color: '#6b7280', fontSize: 10 }}>{it.desc || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={handleAgregarCatalogo}
                      disabled={inicialAddingCatalogo}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none',
                        background: inicialAddingCatalogo ? '#fca5a5' : '#dc2626', color: '#fff',
                        cursor: inicialAddingCatalogo ? 'not-allowed' : 'pointer', opacity: inicialAddingCatalogo ? .7 : 1,
                      }}
                    >
                      {inicialAddingCatalogo ? 'Agregando…' : `Agregar ${[...new Set(inicialData.sinCatalogo.map(i => i.codMat))].length} código(s) al catálogo y re-analizar`}
                    </button>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Se crearán entradas mínimas con descripción del Kardex</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn bp" style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600,
                  opacity: inicialExecuting ? .5 : 1 }}
                  disabled={inicialExecuting} onClick={handleEjecutarInicial}>
                  {inicialExecuting ? 'Cargando…' : `Ejecutar carga (${fmt(inicialData.equiposSerial.length)} equipos · ${fmt(inicialData.kardexItems.length)} movimientos)`}
                </button>
                <button className="btn" style={{ padding: '9px 16px', fontSize: 13 }}
                  disabled={inicialExecuting} onClick={resetInicial}>
                  ← Volver
                </button>
              </div>
            </div>
          )}

          {inicialPhase === 'done' && inicialResult && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginBottom: 16 }}>
                ✓ Carga inicial completada
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {[
                  { label: 'Equipos serializados en hw_equipos',  val: inicialResult.equipos     },
                  { label: 'Movimientos del Kardex registrados',   val: inicialResult.movimientos },
                  { label: 'Sitios creados',                       val: inicialResult.sitios      },
                ].filter(r => r.val > 0).map(r => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#144E4A', minWidth: 60 }}>{fmt(r.val)}</span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{r.label}</span>
                  </div>
                ))}
              </div>
              <button className="btn bp" style={{ padding: '9px 24px', fontSize: 13 }} onClick={resetInicial}>
                Nueva carga
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ MODO SYNC (existente) ════════════════════════════════════ */}
      {modo === 'sync' && (
      <div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        {PHASE_LABELS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'unset' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: i <= phaseIdx ? '#144E4A' : '#e5e7eb', color: i <= phaseIdx ? '#fff' : '#6b7280' }}>
                {i < phaseIdx ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 11, color: i === phaseIdx ? '#144E4A' : '#6b7280', fontWeight: i === phaseIdx ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</div>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: i < phaseIdx ? '#144E4A' : '#e5e7eb', margin: '0 8px', marginBottom: 20 }} />}
          </div>
        ))}
      </div>

      {/* ── Upload ── */}
      {phase === 'upload' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#374151' }}>Selecciona los archivos a analizar</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Inventario Nokia <span style={{ color: '#9ca3af', fontWeight: 400 }}>(.csv — opcional)</span></div>
              <DropZone accept=".csv" file={filInv} onFile={setFilInv} disabled={analyzing} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Kardex Nokia <span style={{ color: '#9ca3af', fontWeight: 400 }}>(.csv — opcional)</span></div>
              <DropZone accept=".csv" file={filKar} onFile={setFilKar} disabled={analyzing} />
            </div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
            <strong>Sin escrituras durante el análisis.</strong> Puedes cargar uno o ambos archivos. El Inventario compara estados/ubicaciones; el Kardex detecta movimientos nuevos.
          </div>
          <button className="btn bp" style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, opacity: (!filInv && !filKar) || analyzing ? .5 : 1 }} disabled={(!filInv && !filKar) || analyzing} onClick={handleAnalyze}>
            {analyzing ? 'Analizando…' : 'Analizar'}
          </button>
        </div>
      )}

      {/* ── Analyze ── */}
      {phase === 'analyze' && analysis && (
        <>
          {/* Pills accionables */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <SectionPill label="Sincronizados"   count={analysis.sincronizados.length}       color="#166534" bg="#dcfce7" open={openSec === 'sincronizados'}       onClick={() => setOpenSec(openSec === 'sincronizados'       ? null : 'sincronizados')} />
            <SectionPill label="Pend. Despacho"  count={analysis.despachosPendientes.length} color="#856404" bg="#fef9c3" open={openSec === 'despachosPendientes'} onClick={() => setOpenSec(openSec === 'despachosPendientes' ? null : 'despachosPendientes')} />
            <SectionPill label="Estado Diferente" count={analysis.estadoDiferente.length}    color="#9a3412" bg="#ffedd5" open={openSec === 'estadoDiferente'}     onClick={() => setOpenSec(openSec === 'estadoDiferente'     ? null : 'estadoDiferente')} />
            <SectionPill label="Solo en Nokia"   count={analysis.soloEnNokia.length}         color="#1e40af" bg="#dbeafe" open={openSec === 'soloEnNokia'}         onClick={() => setOpenSec(openSec === 'soloEnNokia'         ? null : 'soloEnNokia')} />
            <SectionPill label="Solo en App"     count={analysis.soloEnApp.length}           color="#374151" bg="#f3f4f6" open={openSec === 'soloEnApp'}           onClick={() => setOpenSec(openSec === 'soloEnApp'           ? null : 'soloEnApp')} />
            <SectionPill label="Sin Catálogo"    count={analysis.sinCatalogo.length}         color="#92400e" bg="#fef3c7" open={openSec === 'sinCatalogo'}         onClick={() => setOpenSec(openSec === 'sinCatalogo'         ? null : 'sinCatalogo')} />
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn" onClick={handleExport} style={{ fontSize: 12, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
                Exportar Excel
              </button>
            </div>
          </div>

          {/* Banners informativos — sin acción ejecutable */}
          {analysis.kardexNuevos.length > 0 && (
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#0f766e' }}>
                <strong>ℹ {fmt(analysis.kardexNuevos.length)} movimiento(s) del Kardex sin SO</strong> — no se cargaron en la carga inicial por carecer de Sales Order. Revisa el Excel exportado para analizarlos manualmente.
              </div>
              <button className="btn" style={{ fontSize: 11, padding: '4px 12px', whiteSpace: 'nowrap' }}
                onClick={() => setOpenSec(openSec === 'kardexNuevos' ? null : 'kardexNuevos')}>
                {openSec === 'kardexNuevos' ? 'Ocultar' : 'Ver detalle'}
              </button>
            </div>
          )}
          {analysis.sinSerialDiferente.length > 0 && (
            <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#7c3aed' }}>
                <strong>ℹ {fmt(analysis.sinSerialDiferente.length)} ítem(s) sin serial con diferencia Nokia vs App</strong> — discrepancia entre Inventario y Kardex Nokia. No requiere acción en la app; revisa el Excel exportado.
              </div>
              <button className="btn" style={{ fontSize: 11, padding: '4px 12px', whiteSpace: 'nowrap' }}
                onClick={() => setOpenSec(openSec === 'sinSerialDiferente' ? null : 'sinSerialDiferente')}>
                {openSec === 'sinSerialDiferente' ? 'Ocultar' : 'Ver detalle'}
              </button>
            </div>
          )}
          {analysis.sinSerialSincronizado.length > 0 && (
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#0f766e' }}>
                <strong>✓ {fmt(analysis.sinSerialSincronizado.length)} ítem(s) sin serial sincronizados</strong> — cantidades Nokia coinciden con la app.
              </div>
              <button className="btn" style={{ fontSize: 11, padding: '4px 12px', whiteSpace: 'nowrap' }}
                onClick={() => setOpenSec(openSec === 'sinSerialSincronizado' ? null : 'sinSerialSincronizado')}>
                {openSec === 'sinSerialSincronizado' ? 'Ocultar' : 'Ver detalle'}
              </button>
            </div>
          )}
          {analysis.kardexDuplicados > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
              {fmt(analysis.kardexDuplicados)} movimiento(s) del Kardex ya existen en la app (omitidos automáticamente).
            </div>
          )}

          {/* Detail section */}
          {openSec && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px', marginBottom: 14 }}>
              {renderSection()}
            </div>
          )}

          {/* Action bar — solo Estado Diferente y Solo en Nokia */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
            {analysis.estadoDiferente.length === 0 && analysis.soloEnNokia.length === 0
              ? <div style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>✓ Inventario sincronizado — no hay acciones disponibles.</div>
              : actionCount > 0
                ? <button className="btn bp" style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, opacity: executing ? .5 : 1 }} disabled={executing} onClick={handleExecute}>
                    {executing ? 'Ejecutando…' : `Ejecutar ${fmt(actionCount)} elemento(s) seleccionado(s)`}
                  </button>
                : <div style={{ fontSize: 13, color: '#6b7280' }}>Selecciona acciones en las secciones accionables.</div>
            }
            <button className="btn" style={{ padding: '9px 16px', fontSize: 13, opacity: executing ? .5 : 1 }} disabled={executing} onClick={resetAll}>
              ← Volver
            </button>
          </div>
        </>
      )}

      {/* ── Done ── */}
      {phase === 'done' && execResult && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginBottom: 16 }}>✓ Sincronización completada</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {execResult.estadoActualizado > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#9a3412' }}>{fmt(execResult.estadoActualizado)}</span>
                <span style={{ fontSize: 13, color: '#374151' }}>equipo(s) con estado actualizado</span>
              </div>
            )}
            {execResult.equiposRegistrados > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{fmt(execResult.equiposRegistrados)}</span>
                <span style={{ fontSize: 13, color: '#374151' }}>equipo(s) registrados desde Nokia</span>
              </div>
            )}
            {execResult.kardexImportados > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#0f766e' }}>{fmt(execResult.kardexImportados)}</span>
                <span style={{ fontSize: 13, color: '#374151' }}>movimientos Kardex importados</span>
              </div>
            )}
            {execResult.sinSerialRegistrados > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed' }}>{fmt(execResult.sinSerialRegistrados)}</span>
                <span style={{ fontSize: 13, color: '#374151' }}>movimiento(s) sin serial registrados desde Nokia</span>
              </div>
            )}
            {execResult.estadoActualizado === 0 && execResult.equiposRegistrados === 0 && execResult.kardexImportados === 0 && execResult.sinSerialRegistrados === 0 && (
              <div style={{ fontSize: 13, color: '#6b7280' }}>No se realizaron cambios.</div>
            )}
          </div>
          <button className="btn bp" style={{ padding: '9px 24px', fontSize: 13 }} onClick={resetAll}>Nueva carga</button>
        </div>
      )}

      </div>
      )}

    </div>
  )
}
