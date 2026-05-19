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
export default function HwNokiaCarga() {
  const hwEquipos             = useHwStore(s => s.hwEquipos)
  const hwCatalogo            = useHwStore(s => s.hwCatalogo)
  const hwMovimientos         = useHwStore(s => s.hwMovimientos)
  const hwDespachosPendientes = useHwStore(s => s.hwDespachosPendientes)
  const loadAll               = useHwStore(s => s.loadAll)

  const [phase,      setPhase]      = useState('upload')
  const [filRep,     setFilRep]     = useState(null)
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
    setPhase('upload'); setAnalysis(null); setFilRep(null); setFilKar(null)
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
    if (!filRep && !filKar) return
    setAnalyzing(true)
    try {
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
      // Accumulate Nokia sin-serial items grouped by cod_material + ubicacion
      const nokiaSinSerialMap = {}

      if (filRep) {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(new Uint8Array(await filRep.arrayBuffer()), { type: 'array' })
        const allRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
        const rows = allRows.slice(1).filter(r => r.some(c => String(c).trim()))

        for (const r of rows) {
          const rawSerial  = String(r[7] || '').trim()
          const isSinSerial = !rawSerial || rawSerial.toLowerCase() === 'null' || rawSerial === '0' || rawSerial === '0.0'

          const codMat        = String(r[4] || '').trim()
          const ubicacion     = String(r[1] || '').trim()
          const asignadoA     = String(r[9] || '').trim()
          const nokiaEstado   = mapEstado(ubicacion)
          const relocated     = nokiaEstado === 'en_sitio' || nokiaEstado === 'en_transito'
          const nokiaUbic     = relocated ? (asignadoA || ubicacion) : (ubicacion || null)
          const nokiaSo       = String(r[3] || '').trim() || null
          const nokiaEstLabel = String(r[8] || '').trim() || null
          const cat           = hwCatalogo.find(c => String(c.cod_material) === codMat) || null

          if (isSinSerial) {
            // Accumulate sin-serial items
            if (!cat) { res.sinCatalogo.push({ serial: '(sin serial)', codMat, nokiaEstado, nokiaUbic }); continue }
            const cantidad = Number(String(r[6] || '').trim()) || 1
            const key = `${codMat}||${nokiaUbic || ''}`
            if (!nokiaSinSerialMap[key]) {
              nokiaSinSerialMap[key] = { key, codMat, cat, nokiaEstado, nokiaEstLabel, nokiaUbic, sos: [], nokiaCantidad: 0, rows: [] }
            }
            nokiaSinSerialMap[key].nokiaCantidad += cantidad
            nokiaSinSerialMap[key].rows.push({ nokiaSo, cantidad })
            if (nokiaSo && !nokiaSinSerialMap[key].sos.includes(nokiaSo)) nokiaSinSerialMap[key].sos.push(nokiaSo)
            continue
          }

          // ── Serialized item ──
          nokiaSerials.add(rawSerial)
          if (!cat) { res.sinCatalogo.push({ serial: rawSerial, codMat, nokiaEstado, nokiaUbic }); continue }
          const nRow = { serial: rawSerial, cat, nokiaEstado, nokiaUbic, nokiaSo, nokiaEstLabel }

          if (pendingSerials.has(rawSerial)) {
            res.despachosPendientes.push({ ...nRow, equipo: appBySerial.get(rawSerial) || null }); continue
          }

          const eq = appBySerial.get(rawSerial)
          if (!eq) { res.soloEnNokia.push(nRow); continue }

          const diffs = []
          if (eq.estado !== nokiaEstado) diffs.push('estado')
          if ((eq.ubicacion_actual || '').toLowerCase().trim() !== (nokiaUbic || '').toLowerCase().trim()) diffs.push('ubicacion')

          if (diffs.length > 0) res.estadoDiferente.push({ ...nRow, equipo: eq, diffs })
          else res.sincronizados.push({ ...nRow, equipo: eq })
        }

        for (const [serial, eq] of appBySerial) {
          if (pendingSerials.has(serial)) continue
          if (!nokiaSerials.has(serial))
            res.soloEnApp.push({ serial, cat: hwCatalogo.find(c => c.id === eq.catalogo_id) || null, equipo: eq })
        }

        // ── Compare sin-serial Nokia groups with App movements ──
        for (const item of Object.values(nokiaSinSerialMap)) {
          const loc  = (item.nokiaUbic || '').toLowerCase()
          const catMovs = hwMovimientos.filter(m => m.catalogo_id === item.cat.id && !m.serial)
          let appNet = 0
          if (item.nokiaEstado === 'en_sitio' || item.nokiaEstado === 'en_transito') {
            appNet = catMovs.reduce((s, m) => {
              if (m.tipo === 'SALIDA'  && (m.destino || '').toLowerCase() === loc) return s + (m.cantidad || 0)
              if (m.tipo === 'ENTRADA' && (m.origen  || '').toLowerCase() === loc) return s - (m.cantidad || 0)
              return s
            }, 0)
          } else {
            appNet = catMovs.reduce((s, m) => {
              if (m.tipo === 'ENTRADA' && (m.destino || '').toLowerCase() === loc) return s + (m.cantidad || 0)
              if (m.tipo === 'SALIDA'  && (m.origen  || '').toLowerCase() === loc) return s - (m.cantidad || 0)
              return s
            }, 0)
          }
          item.appNet     = Math.max(0, appNet)
          item.diferencia = item.nokiaCantidad - item.appNet
          if (item.diferencia === 0) res.sinSerialSincronizado.push(item)
          else                       res.sinSerialDiferente.push(item)
        }
      }

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
          const cat      = hwCatalogo.find(ct => String(ct.cod_material) === codMat) || null
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
                <Th>SO Nokia</Th><Th>Acción</Th>
              </tr></thead>
              <tbody>{items.map(it => {
                const action = rowActions.estadoDiferente[it.serial]
                return (
                  <tr key={it.serial} style={{ background: action === 'update' ? '#f0fdf4' : action === 'keep' ? '#f9fafb' : 'transparent' }}>
                    <Td><code style={{ fontSize: 11 }}>{it.serial}</code></Td>
                    <Td>{it.cat?.descripcion || '—'}</Td>
                    <Td><EstadoBadge estado={it.equipo?.estado} /></Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.equipo?.ubicacion_actual || '—'}</Td>
                    <Td><EstadoBadge estado={it.nokiaEstado} /></Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaUbic || '—'}</Td>
                    <Td style={{ fontSize: 11, color: '#6b7280' }}>{it.nokiaSo || '—'}</Td>
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

  const actionCount = (
    Object.values(rowActions.estadoDiferente).filter(a => a === 'update').length +
    Object.values(rowActions.soloEnNokia).filter(a => a === 'register').length +
    Object.values(rowActions.kardexNuevos).filter(a => a === 'import').length +
    Object.values(rowActions.sinSerialDiferente).filter(a => a === 'registrar').length
  )

  const phaseIdx = phase === 'upload' ? 0 : phase === 'analyze' ? 1 : 2
  const PHASE_LABELS = ['Cargar archivos', 'Revisar análisis', 'Listo']

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Carga Nokia</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Analiza y sincroniza el inventario desde los archivos Nokia. No se realizan cambios hasta confirmar.
        </div>
      </div>

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
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Reporte Semanal Nokia <span style={{ color: '#9ca3af', fontWeight: 400 }}>(.xlsx)</span></div>
              <DropZone accept=".xlsx,.xls" file={filRep} onFile={setFilRep} disabled={analyzing} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Kardex Nokia <span style={{ color: '#9ca3af', fontWeight: 400 }}>(.csv)</span></div>
              <DropZone accept=".csv" file={filKar} onFile={setFilKar} disabled={analyzing} />
            </div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
            <strong>Sin escrituras durante el análisis.</strong> Puedes cargar uno o ambos archivos. El análisis compara con la app y muestra un resumen antes de ejecutar cualquier acción.
          </div>
          <button className="btn bp" style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, opacity: (!filRep && !filKar) || analyzing ? .5 : 1 }} disabled={(!filRep && !filKar) || analyzing} onClick={handleAnalyze}>
            {analyzing ? 'Analizando…' : 'Analizar'}
          </button>
        </div>
      )}

      {/* ── Analyze ── */}
      {phase === 'analyze' && analysis && (
        <>
          {/* Pills + Export */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <SectionPill label="Sincronizados"    count={analysis.sincronizados.length}       color="#166534" bg="#dcfce7" open={openSec === 'sincronizados'}       onClick={() => setOpenSec(openSec === 'sincronizados'       ? null : 'sincronizados')} />
            <SectionPill label="Pend. Despacho"   count={analysis.despachosPendientes.length} color="#856404" bg="#fef9c3" open={openSec === 'despachosPendientes'} onClick={() => setOpenSec(openSec === 'despachosPendientes' ? null : 'despachosPendientes')} />
            <SectionPill label="Estado Diferente"  count={analysis.estadoDiferente.length}     color="#9a3412" bg="#ffedd5" open={openSec === 'estadoDiferente'}     onClick={() => setOpenSec(openSec === 'estadoDiferente'     ? null : 'estadoDiferente')} />
            <SectionPill label="Solo en Nokia"    count={analysis.soloEnNokia.length}         color="#1e40af" bg="#dbeafe" open={openSec === 'soloEnNokia'}         onClick={() => setOpenSec(openSec === 'soloEnNokia'         ? null : 'soloEnNokia')} />
            <SectionPill label="Solo en App"      count={analysis.soloEnApp.length}           color="#374151" bg="#f3f4f6" open={openSec === 'soloEnApp'}           onClick={() => setOpenSec(openSec === 'soloEnApp'           ? null : 'soloEnApp')} />
            <SectionPill label="Kardex Nuevos"    count={analysis.kardexNuevos.length}        color="#0f766e" bg="#ccfbf1" open={openSec === 'kardexNuevos'}        onClick={() => setOpenSec(openSec === 'kardexNuevos'        ? null : 'kardexNuevos')} />
            <SectionPill label="Sin Serial — Dif." count={analysis.sinSerialDiferente.length}   color="#7c3aed" bg="#f5f3ff" open={openSec === 'sinSerialDiferente'} onClick={() => setOpenSec(openSec === 'sinSerialDiferente' ? null : 'sinSerialDiferente')} />
            <SectionPill label="Sin Serial — OK"  count={analysis.sinSerialSincronizado.length} color="#0f766e" bg="#f0fdfa" open={openSec === 'sinSerialSincronizado'} onClick={() => setOpenSec(openSec === 'sinSerialSincronizado' ? null : 'sinSerialSincronizado')} />
            <SectionPill label="Sin Catálogo"     count={analysis.sinCatalogo.length}           color="#92400e" bg="#fef3c7" open={openSec === 'sinCatalogo'}           onClick={() => setOpenSec(openSec === 'sinCatalogo'         ? null : 'sinCatalogo')} />
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn" onClick={handleExport} style={{ fontSize: 12, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
                Exportar Excel
              </button>
            </div>
          </div>

          {/* Detail section */}
          {openSec && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px', marginBottom: 14 }}>
              {renderSection()}
            </div>
          )}

          {/* Kardex duplicados info */}
          {analysis.kardexDuplicados > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              {fmt(analysis.kardexDuplicados)} movimiento(s) del Kardex ya existen en la app (omitidos automáticamente).
            </div>
          )}

          {/* Action bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
            {analysis.estadoDiferente.length === 0 && analysis.soloEnNokia.length === 0 && analysis.kardexNuevos.length === 0 && analysis.sinSerialDiferente.length === 0
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
  )
}
