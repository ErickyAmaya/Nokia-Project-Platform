import { useState, useRef, useEffect } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useAuthStore } from '../../store/authStore'
import { useMatStore } from '../../store/useMatStore'
import { showToast } from '../Toast'
import { supabase } from '../../lib/supabase'

const CHUNK = 500

// ── CSV parser ────────────────────────────────────────────────────
function parseCSVRow(line) {
  const result = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim()); current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVRow(lines[0])
  return lines.slice(1).map(line => {
    const vals = parseCSVRow(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim() })
    return obj
  }).filter(r => Object.values(r).some(v => v))
}

// ── Enrich Kardex SALIDAs with siteName + smp from Inventory ─────
// Fan-out: 1 kardex row with N inventory matches → N enriched rows
// (each carrying the inventory row's siteName, smp and cantidad)
function enrichKardex(kardexRows, invRows) {
  const invMultiMap = new Map()
  for (const r of invRows) {
    const kid = r.id_abastecimiento_hw_kardex?.trim()
    if (!kid) continue
    if (!invMultiMap.has(kid)) invMultiMap.set(kid, [])
    invMultiMap.get(kid).push({
      siteName: r.siteName?.trim() || null,
      smp:      r.smp?.trim()      || null,
      cantidad: r.cantidad?.trim() || null,
    })
  }
  const result = []
  for (const r of kardexRows) {
    if (r.tipo_movimiento !== 'SALIDA') { result.push(r); continue }
    const kid     = r.id_abastecimiento_hw_kardex?.trim()
    const matches = kid ? invMultiMap.get(kid) : null
    if (!matches || matches.length === 0) {
      // TRANSFERENCIA u otras salidas sin entrada en el inventario
      result.push({ ...r, siteName: null, smp: null })
    } else {
      for (const m of matches) {
        result.push({ ...r, siteName: m.siteName, smp: m.smp,
          cantidad: m.cantidad || r.cantidad })
      }
    }
  }
  return result
}

const TIPO_BADGE = {
  ABASTECIMIENTO: { bg:'#dbeafe', color:'#1e40af' },
  LOG_INV:        { bg:'#fef3cd', color:'#856404' },
  TRANSFERENCIA:  { bg:'#f3e8ff', color:'#6b21a8' },
}

const AUDIT_BADGE = {
  FALTANTE_APP:    { bg:'#fde8e8', color:'#c0392b', label:'Faltante en app' },
  EXTRA_APP:       { bg:'#fef3cd', color:'#856404', label:'Extra en app' },
  SITIO_DIFERENTE: { bg:'#fff3cd', color:'#d97706', label:'Sitio diferente' },
  SO_DIFERENTE:    { bg:'#dbeafe', color:'#1e40af', label:'SO diferente' },
  CANT_DIFERENTE:  { bg:'#f3e8ff', color:'#6b21a8', label:'Cantidad diferente' },
}

function readFileText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.onerror = rej
    r.readAsText(file, 'utf-8')
  })
}

export default function HwMassUploadModal({ onClose }) {
  const hwCatalogo    = useHwStore(s => s.hwCatalogo)
  const hwEquipos     = useHwStore(s => s.hwEquipos)
  const hwMovimientos = useHwStore(s => s.hwMovimientos)
  const bodegas       = useMatStore(s => s.bodegas)
  const matSitios     = useMatStore(s => s.sitios)
  const saveSitio     = useMatStore(s => s.saveSitio)
  const user          = useAuthStore(s => s.user)

  const [mode, setMode] = useState('import') // 'import' | 'audit'
  const [step, setStep] = useState('upload') // 'upload' | 'review' | 'report'
  const [bodega, setBodega] = useState('')

  // File state
  const [kardexName, setKardexName] = useState('')
  const [invName,    setInvName]    = useState('')
  const [kardexRows, setKardexRows] = useState(null)
  const [invRows,    setInvRows]    = useState(null)

  // Import state
  const [entradas,   setEntradas]   = useState([])
  const [salidas,    setSalidas]    = useState([])
  const [soUpdates,  setSoUpdates]  = useState([])
  const [itemFields, setItemFields] = useState([])
  const [omitidos,   setOmitidos]   = useState(0)

  // Audit state
  const [auditRows, setAuditRows] = useState([])

  // UI
  const [saving,      setSaving]      = useState(false)
  const [progress,    setProgress]    = useState({ current: 0, total: 0, phase: '' })
  const [visibleEnt,  setVisibleEnt]  = useState(100)
  const [visSal,      setVisSal]      = useState(100)
  const kardexRef = useRef(null)
  const invRef    = useRef(null)

  useEffect(() => { setVisibleEnt(100) }, [entradas])
  useEffect(() => { setVisSal(100) }, [salidas])

  function handleContentScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 400) {
      if (visibleEnt < entradas.length) setVisibleEnt(c => c + 100)
      if (visSal    < salidas.length)   setVisSal(c => c + 100)
    }
  }

  // Re-process when mode changes (files already loaded)
  useEffect(() => {
    if (kardexRows && (mode === 'entradas' || invRows)) {
      process(kardexRows, invRows, mode)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function handleKardexFile(file) {
    if (!file) return
    setKardexName(file.name)
    const text = await readFileText(file)
    const rows = parseCSV(text)
    setKardexRows(rows)
    if (mode === 'entradas' || invRows) process(rows, invRows, mode)
  }

  async function handleInvFile(file) {
    if (!file) return
    setInvName(file.name)
    const text = await readFileText(file)
    const rows = parseCSV(text)
    setInvRows(rows)
    if (kardexRows) process(kardexRows, rows, mode)
  }

  function process(kRows, iRows, currentMode) {
    const enriched = enrichKardex(kRows, iRows || [])
    if (currentMode === 'audit') buildAuditReport(enriched)
    else if (currentMode === 'entradas') buildImportPreview(enriched, true)
    else buildImportPreview(enriched)
  }

  // ── Build import preview ─────────────────────────────────────────
  function buildImportPreview(enriched, onlyEntradas = false) {
    const serialMap = new Map(hwEquipos.map(eq => [eq.serial, eq]))
    const newEntradas = [], newSalidas = [], soList = []
    let omit = 0

    // ENTRADAs con serial
    for (const row of enriched.filter(r => r.tipo_movimiento === 'ENTRADA' && r.serial?.trim())) {
      const serial = row.serial.trim()
      const cod    = row.cod_material?.trim()
      const cat    = hwCatalogo.find(c => c.cod_material === cod)
      const so     = row.so?.trim() || null
      const fecha  = row.fecha_movimiento?.split(' ')[0] || new Date().toISOString().slice(0, 10)
      const tf     = row.tipo_fuente?.trim() || 'ABASTECIMIENTO'
      if (serialMap.has(serial)) {
        const movs = hwMovimientos.filter(m => m.serial === serial && m.tipo === 'ENTRADA')
        if (movs.length && so && movs[0].sales_order !== so)
          soList.push({ equipo_id: serialMap.get(serial).id, mov_id: movs[0].id, serial,
            descripcion: cat?.descripcion || row.descripcion_material?.trim() || cod,
            so_csv: so, so_db: movs[0].sales_order || '—' })
        omit++
      } else {
        newEntradas.push({ hasSerial:true, serial, cod_material:cod, catalogo_id:cat?.id||null,
          descripcion: cat?.descripcion || row.descripcion_material?.trim() || cod,
          fecha, so, tipo_fuente:tf,
          proyecto: row.proyecto?.trim() || null, sub_proyecto: row.sub_proyecto?.trim() || null })
      }
    }

    // ENTRADAs sin serial — agrupar
    const entGrps = new Map()
    for (const row of enriched.filter(r => r.tipo_movimiento === 'ENTRADA' && !r.serial?.trim())) {
      const cod = row.cod_material?.trim(), so = row.so?.trim() || ''
      const fecha = row.fecha_movimiento?.split(' ')[0] || ''
      const proy = row.proyecto?.trim() || '', subp = row.sub_proyecto?.trim() || ''
      const key = `${cod}||${so}||${fecha}||${proy}||${subp}`
      const cat = hwCatalogo.find(c => c.cod_material === cod)
      if (!entGrps.has(key))
        entGrps.set(key, { hasSerial:false, cod_material:cod, catalogo_id:cat?.id||null,
          descripcion: cat?.descripcion || row.descripcion_material?.trim() || cod,
          fecha, so: so||null, tipo_fuente: row.tipo_fuente?.trim()||'LOG_INV', cantidad:0,
          proyecto: proy||null, sub_proyecto: subp||null })
      entGrps.get(key).cantidad += Number(row.cantidad) || 1
    }
    for (const [, g] of entGrps) {
      const exists = hwMovimientos.some(m =>
        !m.serial && m.catalogo_id === g.catalogo_id && m.tipo === 'ENTRADA' &&
        (m.sales_order||null) === (g.so||null) && m.fecha?.startsWith(g.fecha))
      if (exists) omit += g.cantidad; else newEntradas.push(g)
    }

    if (!onlyEntradas) {
      // SALIDAs con serial
      for (const row of enriched.filter(r => r.tipo_movimiento === 'SALIDA' && r.serial?.trim())) {
        const serial = row.serial.trim()
        const cod    = row.cod_material?.trim()
        const cat    = hwCatalogo.find(c => c.cod_material === cod)
        const so     = row.so?.trim() || null
        const fecha  = row.fecha_movimiento?.split(' ')[0] || new Date().toISOString().slice(0, 10)
        if (hwMovimientos.some(m => m.serial === serial && m.tipo === 'SALIDA')) { omit++; continue }
        newSalidas.push({ hasSerial:true, serial, cod_material:cod, catalogo_id:cat?.id||null,
          descripcion: cat?.descripcion || row.descripcion_material?.trim() || cod,
          fecha, so, tipo_fuente: row.tipo_fuente?.trim()||'LOG_INV',
          siteName: row.siteName||null, smp: row.smp||null, cantidad:1,
          proyecto: row.proyecto?.trim() || null, sub_proyecto: row.sub_proyecto?.trim() || null })
      }

      // SALIDAs sin serial — agrupar
      const salGrps = new Map()
      for (const row of enriched.filter(r => r.tipo_movimiento === 'SALIDA' && !r.serial?.trim())) {
        const cod = row.cod_material?.trim(), so = row.so?.trim() || ''
        const fecha = row.fecha_movimiento?.split(' ')[0] || ''
        const site  = row.siteName || ''
        const proy  = row.proyecto?.trim() || '', subp = row.sub_proyecto?.trim() || ''
        const key   = `${cod}||${so}||${fecha}||${site}||${proy}||${subp}`
        const cat   = hwCatalogo.find(c => c.cod_material === cod)
        if (!salGrps.has(key))
          salGrps.set(key, { hasSerial:false, cod_material:cod, catalogo_id:cat?.id||null,
            descripcion: cat?.descripcion || row.descripcion_material?.trim() || cod,
            fecha, so: so||null, tipo_fuente: row.tipo_fuente?.trim()||'LOG_INV',
            siteName: row.siteName||null, smp: row.smp||null, cantidad:0,
            proyecto: proy||null, sub_proyecto: subp||null })
        salGrps.get(key).cantidad += Number(row.cantidad) || 1
      }
      for (const [, g] of salGrps) {
        const exists = hwMovimientos.some(m =>
          !m.serial && m.catalogo_id === g.catalogo_id && m.tipo === 'SALIDA' &&
          (m.sales_order||null) === (g.so||null) && m.fecha?.startsWith(g.fecha) && m.destino === g.siteName)
        if (exists) omit += g.cantidad; else newSalidas.push(g)
      }
    }

    setEntradas(newEntradas)
    setSalidas(onlyEntradas ? [] : newSalidas)
    setSoUpdates(onlyEntradas ? [] : soList)
    setItemFields([...newEntradas, ...(onlyEntradas ? [] : newSalidas)].map(() => ''))
    setOmitidos(omit)
    setStep('review')
  }

  // ── Build audit report ───────────────────────────────────────────
  function buildAuditReport(enriched) {
    const report = []
    const nokiaSalidas = enriched.filter(r => r.tipo_movimiento === 'SALIDA' && r.siteName)
    const appBySerial  = new Map(hwEquipos.map(e => [e.serial, e]))

    // Serials Nokia vs app
    for (const row of nokiaSalidas.filter(r => r.serial?.trim())) {
      const serial = row.serial.trim()
      const cod    = row.cod_material?.trim()
      const cat    = hwCatalogo.find(c => c.cod_material === cod)
      const desc   = cat?.descripcion || row.descripcion_material?.trim() || cod
      const appEq  = appBySerial.get(serial)
      if (!appEq) {
        report.push({ tipo:'FALTANTE_APP', serial, cod, descripcion:desc,
          nokia_sitio:row.siteName, app_sitio:null, nokia_so:row.so||null, app_so:null })
      } else {
        if (appEq.ubicacion_actual !== row.siteName)
          report.push({ tipo:'SITIO_DIFERENTE', serial, cod, descripcion:desc,
            nokia_sitio:row.siteName, app_sitio:appEq.ubicacion_actual||'—',
            nokia_so:row.so||null, app_so:null })
        const appMov = hwMovimientos.find(m => m.serial === serial && m.tipo === 'ENTRADA')
        const nokiaSO = row.so?.trim() || null
        if (nokiaSO && appMov?.sales_order && nokiaSO !== appMov.sales_order)
          report.push({ tipo:'SO_DIFERENTE', serial, cod, descripcion:desc,
            nokia_sitio:row.siteName, app_sitio:appEq.ubicacion_actual||'—',
            nokia_so:nokiaSO, app_so:appMov.sales_order })
      }
    }

    // App serials en_sitio que Nokia no tiene
    const nokiaSerialSet = new Set(nokiaSalidas.filter(r => r.serial?.trim()).map(r => r.serial.trim()))
    for (const eq of hwEquipos.filter(e => e.estado === 'en_sitio' && e.serial)) {
      if (!nokiaSerialSet.has(eq.serial)) {
        const cat = hwCatalogo.find(c => c.id === eq.catalogo_id)
        report.push({ tipo:'EXTRA_APP', serial:eq.serial,
          cod:cat?.cod_material||'?', descripcion:cat?.descripcion||'?',
          nokia_sitio:null, app_sitio:eq.ubicacion_actual||'—', nokia_so:null, app_so:null })
      }
    }

    // Cantidades sin serial por (cod, sitio)
    const nokiaQty = new Map()
    for (const r of nokiaSalidas.filter(r => !r.serial?.trim())) {
      const k = `${r.cod_material?.trim()}||${r.siteName}`
      nokiaQty.set(k, (nokiaQty.get(k)||0) + (Number(r.cantidad)||1))
    }
    const appQty = new Map()
    for (const m of hwMovimientos.filter(m => !m.serial && m.tipo === 'SALIDA' && m.destino_tipo === 'sitio')) {
      const cod = hwCatalogo.find(c => c.id === m.catalogo_id)?.cod_material || '?'
      const k   = `${cod}||${m.destino}`
      appQty.set(k, (appQty.get(k)||0) + (m.cantidad||0))
    }
    for (const [k, nQty] of nokiaQty) {
      const [cod, siteName] = k.split('||')
      const aQty = appQty.get(k) || 0
      if (nQty !== aQty) {
        const cat = hwCatalogo.find(c => c.cod_material === cod)
        report.push({ tipo:'CANT_DIFERENTE', serial:null, cod, descripcion:cat?.descripcion||cod,
          nokia_sitio:siteName, app_sitio:siteName, nokia_so:null, app_so:null,
          nokia_cant:nQty, app_cant:aQty })
      }
    }

    setAuditRows(report)
    setStep('report')
  }

  // ── Save (import mode) ───────────────────────────────────────────
  async function handleSave() {
    if (!bodega) { showToast('Selecciona la bodega', 'err'); return }
    setSaving(true)

    const seenSerials     = new Set()
    const serialEntradas  = entradas
      .filter(i => { if (!i.hasSerial) return false; if (seenSerials.has(i.serial)) return false; seenSerials.add(i.serial); return true })
      .map((i, idx) => ({ ...i, _idx: idx }))
    const noSerialEntradas = entradas.filter(i => !i.hasSerial)
      .map((i, idx) => ({ ...i, _idx: serialEntradas.length + idx }))
    const serialSalidas    = salidas.filter(i => i.hasSerial)
      .map((i, idx) => ({ ...i, _idx: entradas.length + idx }))
    const noSerialSalidas  = salidas.filter(i => !i.hasSerial)
      .map((i, idx) => ({ ...i, _idx: entradas.length + salidas.filter(x => x.hasSerial).length + idx }))

    const totalOps = serialEntradas.length * 2 + noSerialEntradas.length + serialSalidas.length + noSerialSalidas.length + soUpdates.length
    let doneOps = 0
    const tick = (n, phase) => { doneOps += n; setProgress({ current: doneOps, total: totalOps, phase }) }
    setProgress({ current: 0, total: totalOps, phase: 'Preparando…' })

    try {
      const equipoIdMap = new Map()

      // ── F1: hw_equipos para ENTRADAs con serial ─────────────────
      for (let i = 0; i < serialEntradas.length; i += CHUNK) {
        const chunk = serialEntradas.slice(i, i + CHUNK)
        const { data, error } = await supabase.from('hw_equipos')
          .upsert(chunk.map(item => ({
            catalogo_id:      item.catalogo_id || null,
            serial:           item.serial,
            estado:           'en_bodega',
            ubicacion_actual: bodega,
            condicion:        'nuevo',
            bulk:             item.tipo_fuente === 'ABASTECIMIENTO' ? (itemFields[item._idx]?.trim() || null) : null,
            proyecto:         item.proyecto     || null,
            sub_proyecto:     item.sub_proyecto || null,
          })), { onConflict: 'serial', ignoreDuplicates: true })
          .select('id, serial')
        if (error) throw error
        data.forEach(e => equipoIdMap.set(e.serial, e.id))
        tick(chunk.length, `Equipos entrada ${Math.min(i + CHUNK, serialEntradas.length)}/${serialEntradas.length}`)
      }

      // ── F2: hw_movimientos ENTRADAs con serial ───────────────────
      for (let i = 0; i < serialEntradas.length; i += CHUNK) {
        const chunk = serialEntradas.slice(i, i + CHUNK)
        const { error } = await supabase.from('hw_movimientos').insert(chunk.map(item => {
          const isAb = item.tipo_fuente === 'ABASTECIMIENTO'
          const fv   = itemFields[item._idx]?.trim() || ''
          return {
            equipo_id: equipoIdMap.get(item.serial) || null,
            serial: item.serial, catalogo_id: item.catalogo_id || null,
            tipo: 'ENTRADA', tipo_fuente: 'BULK_UPLOAD',
            so: item.so || null, sales_order: item.so, fecha: item.fecha, cantidad: 1,
            origen: isAb ? 'Nokia' : (fv || 'Nokia'),
            origen_tipo: isAb ? 'nokia' : 'ss',
            destino: bodega, destino_tipo: 'bodega',
            proyecto: item.proyecto     || null,
            sub_proyecto: item.sub_proyecto || null,
            created_by: user?.nombre || user?.email,
          }
        }))
        if (error) throw error
        tick(chunk.length, `Movimientos entrada ${Math.min(i + CHUNK, serialEntradas.length)}/${serialEntradas.length}`)
      }

      // ── F3: hw_movimientos ENTRADAs sin serial ───────────────────
      for (let i = 0; i < noSerialEntradas.length; i += CHUNK) {
        const chunk = noSerialEntradas.slice(i, i + CHUNK)
        const { error } = await supabase.from('hw_movimientos').insert(chunk.map(item => {
          const isAb = item.tipo_fuente === 'ABASTECIMIENTO'
          const fv   = itemFields[item._idx]?.trim() || ''
          return {
            serial: null, catalogo_id: item.catalogo_id || null,
            tipo: 'ENTRADA', tipo_fuente: 'BULK_UPLOAD',
            so: item.so || null, sales_order: item.so, fecha: item.fecha, cantidad: item.cantidad,
            origen: isAb ? 'Nokia' : (fv || 'Nokia'),
            origen_tipo: isAb ? 'nokia' : 'ss',
            destino: bodega, destino_tipo: 'bodega',
            proyecto: item.proyecto     || null,
            sub_proyecto: item.sub_proyecto || null,
            created_by: user?.nombre || user?.email,
          }
        }))
        if (error) throw error
        tick(chunk.length, `Sin serial entrada ${Math.min(i + CHUNK, noSerialEntradas.length)}/${noSerialEntradas.length}`)
      }

      // ── F4: Auto-crear sitios nuevos ─────────────────────────────
      const sitiosNombres = new Set(matSitios.map(s => s.nombre.toLowerCase()))
      const sitiosVistos  = new Set()
      for (const it of [...serialSalidas, ...noSerialSalidas]) {
        if (!it.siteName) continue
        const key = it.siteName.toLowerCase()
        if (sitiosNombres.has(key) || sitiosVistos.has(key)) continue
        sitiosVistos.add(key)
        await saveSitio({ nombre: it.siteName, regional: '', activo: true }).catch(() => {})
      }

      // ── F5: SALIDAs con serial — update equipo + movimiento ──────
      if (serialSalidas.length > 0) {
        // Buscar IDs que no vienen del batch de entradas
        const missing = serialSalidas.filter(i => !equipoIdMap.has(i.serial)).map(i => i.serial)
        if (missing.length > 0) {
          const { data } = await supabase.from('hw_equipos').select('id, serial').in('serial', missing)
          if (data) data.forEach(e => equipoIdMap.set(e.serial, e.id))
        }

        for (let i = 0; i < serialSalidas.length; i += CHUNK) {
          const chunk = serialSalidas.slice(i, i + CHUNK)

          // Update hw_equipos → en_sitio agrupando por sitio para minimizar requests
          const toUpdate = chunk.filter(it => equipoIdMap.has(it.serial) && it.siteName)
          const bySitio = new Map()
          for (const it of toUpdate) {
            const ids = bySitio.get(it.siteName) || []
            ids.push(equipoIdMap.get(it.serial))
            bySitio.set(it.siteName, ids)
          }
          for (const [siteName, ids] of bySitio) {
            const { error } = await supabase.from('hw_equipos')
              .update({ estado: 'en_sitio', ubicacion_actual: siteName, updated_at: new Date().toISOString() })
              .in('id', ids)
            if (error) throw error
          }

          // TRANSFERENCIA: sale del inventario, destino desconocido → en_transito
          const toTransit = chunk.filter(it =>
            equipoIdMap.has(it.serial) && !it.siteName && it.tipo_fuente === 'TRANSFERENCIA')
          if (toTransit.length > 0) {
            const ids = toTransit.map(it => equipoIdMap.get(it.serial)).filter(Boolean)
            const { error } = await supabase.from('hw_equipos')
              .update({ estado: 'en_transito', updated_at: new Date().toISOString() })
              .in('id', ids)
            if (error) throw error
          }

          // hw_movimientos SALIDA
          const { error: me } = await supabase.from('hw_movimientos').insert(chunk.map(it => ({
            equipo_id: equipoIdMap.get(it.serial) || null,
            serial: it.serial, catalogo_id: it.catalogo_id || null,
            tipo: 'SALIDA', tipo_fuente: 'BULK_UPLOAD',
            so: it.so || null, sales_order: it.so, smp_id: it.smp || null,
            fecha: it.fecha, cantidad: 1,
            origen: bodega, origen_tipo: 'bodega',
            destino: it.siteName, destino_tipo: it.siteName ? 'sitio' : null,
            proyecto: it.proyecto     || null,
            sub_proyecto: it.sub_proyecto || null,
            created_by: user?.nombre || user?.email,
          })))
          if (me) throw me
          tick(chunk.length, `Salidas serial ${Math.min(i + CHUNK, serialSalidas.length)}/${serialSalidas.length}`)
        }
      }

      // ── F6: SALIDAs sin serial ────────────────────────────────────
      for (let i = 0; i < noSerialSalidas.length; i += CHUNK) {
        const chunk = noSerialSalidas.slice(i, i + CHUNK)
        const { error } = await supabase.from('hw_movimientos').insert(chunk.map(it => ({
          serial: null, catalogo_id: it.catalogo_id || null,
          tipo: 'SALIDA', tipo_fuente: 'BULK_UPLOAD',
          so: it.so || null, sales_order: it.so, smp_id: it.smp || null,
          fecha: it.fecha, cantidad: it.cantidad,
          origen: bodega, origen_tipo: 'bodega',
          destino: it.siteName, destino_tipo: it.siteName ? 'sitio' : null,
          proyecto: it.proyecto     || null,
          sub_proyecto: it.sub_proyecto || null,
          created_by: user?.nombre || user?.email,
        })))
        if (error) throw error
        tick(chunk.length, `Salidas sin serial ${Math.min(i + CHUNK, noSerialSalidas.length)}/${noSerialSalidas.length}`)
      }

      // ── F7: SO updates ────────────────────────────────────────────
      for (const upd of soUpdates) {
        await supabase.from('hw_movimientos').update({ sales_order: upd.so_csv }).eq('id', upd.mov_id)
        tick(1, 'Actualizando SO…')
      }

      setProgress(p => ({ ...p, phase: 'Actualizando inventario…' }))
      await useHwStore.getState().loadAll()

      const totalNew = entradas.length + salidas.length
      const sinCat   = [...entradas, ...salidas].filter(i => !i.catalogo_id).length
      let msg = `${totalNew} elemento(s) importado(s)`
      if (soUpdates.length) msg += ` · ${soUpdates.length} SO actualizados`
      if (sinCat)           msg += ` · ⚠ ${sinCat} sin catálogo`
      showToast(msg)
      onClose()
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setSaving(false)
      setProgress({ current: 0, total: 0, phase: '' })
    }
  }

  const pct      = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const totalNew = entradas.length + salidas.length

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:700,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:880,
        maxHeight:'94vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* ── Header ── */}
        <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 18px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'3px solid #1d4ed8', borderRadius:'12px 12px 0 0', flexShrink:0 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, letterSpacing:1 }}>
              KARDEX NOKIA
            </span>
            <div style={{ display:'flex', gap:4 }}>
              {[['import','Importar'],['entradas','Entradas'],['audit','Auditar']].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:6,
                    border:'none', cursor:'pointer', letterSpacing:.5, textTransform:'uppercase',
                    background: mode === m ? '#1d4ed8' : 'rgba(255,255,255,.15)',
                    color: mode === m ? '#fff' : '#bbb' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', color:'#9ca89c', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        {/* ── Sub-header review (import) ── */}
        {step === 'review' && (mode === 'import' || mode === 'entradas') && (
          <div style={{ background:'#fff', padding:'12px 20px', borderBottom:'1px solid #e8f0e8', flexShrink:0 }}>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
              {[
                { label:'Entradas nuevas', val:entradas.length,  bg:'#d4edda', color:'#1a6130' },
                { label:'Salidas nuevas',  val:salidas.length,   bg:'#dbeafe', color:'#1e40af' },
                { label:'SO actualizar',   val:soUpdates.length, bg:'#fff3cd', color:'#856404' },
                { label:'Omitidos',        val:omitidos,         bg:'#f0f0f0', color:'#555f55' },
              ].map(s => (
                <div key={s.label} style={{ background:s.bg, color:s.color, borderRadius:8,
                  padding:'6px 14px', fontSize:12, fontWeight:700, textAlign:'center', flex:1, minWidth:110 }}>
                  <div style={{ fontSize:20, fontWeight:800 }}>{s.val}</div>
                  <div style={{ fontSize:9, letterSpacing:.5, textTransform:'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <label style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>Bodega *</label>
              <select className="fc" value={bodega} onChange={e => setBodega(e.target.value)} style={{ maxWidth:260 }}>
                <option value="">— Seleccionar —</option>
                {bodegas.map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── Sub-header audit report ── */}
        {step === 'report' && (
          <div style={{ background:'#fff', padding:'10px 20px', borderBottom:'1px solid #e8f0e8', flexShrink:0 }}>
            {auditRows.length === 0
              ? <span style={{ color:'#1a6130', fontWeight:700, fontSize:13 }}>✓ Sin inconsistencias — Nokia y la app están sincronizados.</span>
              : <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {Object.entries(AUDIT_BADGE).map(([tipo, b]) => {
                    const cnt = auditRows.filter(r => r.tipo === tipo).length
                    return cnt > 0 ? (
                      <span key={tipo} style={{ background:b.bg, color:b.color, borderRadius:6,
                        padding:'3px 10px', fontSize:11, fontWeight:700 }}>{cnt} {b.label}</span>
                    ) : null
                  })}
                </div>
            }
          </div>
        )}

        {/* ── Contenido ── */}
        <div onScroll={handleContentScroll}
          style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Upload */}
          {step === 'upload' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20, alignItems:'center', padding:'24px 0' }}>
              <div style={{ fontSize:13, color:'#555f55', textAlign:'center', maxWidth:480 }}>
                {mode === 'import'
                  ? 'Carga el Kardex Nokia y el Inventario Nokia para registrar entradas y salidas.'
                  : mode === 'entradas'
                  ? 'Carga solo el Kardex Nokia. La app detecta las entradas nuevas y las registra automáticamente.'
                  : 'Carga el Kardex Nokia y el Inventario Nokia para comparar contra el inventario en la app.'}
              </div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:540 }}>
                {[
                  { ref: kardexRef, name: kardexName, handler: handleKardexFile, icon:'📋', label:'Kardex Nokia', sub:'CSV del Kardex' },
                  ...(mode !== 'entradas' ? [{ ref: invRef, name: invName, handler: handleInvFile, icon:'📦', label:'Inventario Nokia', sub:'CSV del Inventario' }] : []),
                ].map(({ ref: fRef, name: fName, handler, icon, label, sub }) => (
                  <div key={label} onClick={() => fRef.current?.click()}
                    style={{ flex:1, minWidth:200, border:`2px dashed ${fName ? '#86efac' : '#e0e4e0'}`,
                      borderRadius:10, padding:'20px 16px', textAlign:'center', cursor:'pointer',
                      background: fName ? '#f0fdf4' : '#fafafa' }}>
                    <input ref={fRef} type="file" accept=".csv" style={{ display:'none' }}
                      onChange={e => handler(e.target.files?.[0])} />
                    <div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#144E4A' }}>{label}</div>
                    <div style={{ fontSize:10, color: fName ? '#1a6130' : '#9ca89c', marginTop:4, wordBreak:'break-all' }}>
                      {fName || sub}
                    </div>
                  </div>
                ))}
              </div>
              {mode !== 'entradas' && (!!kardexName !== !!invName) && (
                <div style={{ fontSize:11, color:'#d97706', fontWeight:600 }}>
                  Falta cargar {!kardexName ? 'el Kardex' : 'el Inventario'} para continuar
                </div>
              )}
            </div>
          )}

          {/* Review — import */}
          {step === 'review' && (mode === 'import' || mode === 'entradas') && (<>
            {/* ENTRADAs */}
            {entradas.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:.5, textTransform:'uppercase',
                  color:'#1a6130', marginBottom:8, borderBottom:'2px solid #d4edda', paddingBottom:4 }}>
                  Entradas nuevas ({entradas.length})
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <thead><tr>
                      <th>Descripción</th><th>Serial / Cant.</th><th>Fecha</th><th>SO</th><th>Fuente</th>
                      <th style={{ minWidth:120 }}>BULK / Origen</th>
                    </tr></thead>
                    <tbody>
                      {entradas.slice(0, visibleEnt).map((item, idx) => {
                        const badge = TIPO_BADGE[item.tipo_fuente] || { bg:'#f0f0f0', color:'#555f55' }
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight:600, maxWidth:220 }}>
                              {item.descripcion}
                              {!item.catalogo_id && <span style={{ marginLeft:4, fontSize:9, color:'#c0392b', fontWeight:700 }}>⚠ sin cat.</span>}
                            </td>
                            <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:'#144E4A' }}>
                              {item.hasSerial ? item.serial : `${item.cantidad} ud.`}
                            </td>
                            <td style={{ color:'#9ca89c', whiteSpace:'nowrap' }}>{item.fecha}</td>
                            <td style={{ fontFamily:"'Barlow Condensed',sans-serif", color:'#555f55' }}>{item.so || '—'}</td>
                            <td><span className="badge" style={{ background:badge.bg, color:badge.color, fontSize:9 }}>{item.tipo_fuente}</span></td>
                            <td>
                              <input className="fc" placeholder={item.tipo_fuente === 'ABASTECIMIENTO' ? 'BULK' : 'Origen'}
                                value={itemFields[idx] || ''}
                                onChange={e => { const a = [...itemFields]; a[idx] = e.target.value; setItemFields(a) }}
                                style={{ fontSize:11, padding:'3px 6px', height:28 }} />
                            </td>
                          </tr>
                        )
                      })}
                      {visibleEnt < entradas.length && (
                        <tr><td colSpan={6}
                          style={{ padding:'8px', textAlign:'center', color:'#9ca89c', fontSize:10 }}>
                          Mostrando {visibleEnt} de {entradas.length} — seguir bajando para ver más
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SALIDAs */}
            {salidas.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:.5, textTransform:'uppercase',
                  color:'#1e40af', marginBottom:8, borderBottom:'2px solid #dbeafe', paddingBottom:4 }}>
                  Salidas a sitio ({salidas.length})
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <thead><tr>
                      <th>Descripción</th><th>Serial / Cant.</th><th>Sitio destino</th><th>SMP</th><th>Fecha</th><th>SO</th>
                    </tr></thead>
                    <tbody>
                      {salidas.slice(0, visSal).map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight:600, maxWidth:200 }}>
                            {item.descripcion}
                            {!item.catalogo_id && <span style={{ marginLeft:4, fontSize:9, color:'#c0392b', fontWeight:700 }}>⚠ sin cat.</span>}
                          </td>
                          <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:'#144E4A' }}>
                            {item.hasSerial ? item.serial : `${item.cantidad} ud.`}
                          </td>
                          <td style={{ fontWeight:600, color: item.siteName ? '#1a6130' : '#c0392b' }}>
                            {item.siteName || '—sin sitio—'}
                          </td>
                          <td style={{ color:'#9ca89c', fontSize:10 }}>{item.smp || '—'}</td>
                          <td style={{ color:'#9ca89c', whiteSpace:'nowrap' }}>{item.fecha}</td>
                          <td style={{ fontFamily:"'Barlow Condensed',sans-serif", color:'#555f55' }}>{item.so || '—'}</td>
                        </tr>
                      ))}
                      {visSal < salidas.length && (
                        <tr><td colSpan={6}
                          style={{ padding:'8px', textAlign:'center', color:'#9ca89c', fontSize:10 }}>
                          Mostrando {visSal} de {salidas.length} — seguir bajando para ver más
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SO updates */}
            {soUpdates.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:.5, textTransform:'uppercase',
                  color:'#856404', marginBottom:8, borderBottom:'2px solid #fef3cd', paddingBottom:4 }}>
                  Actualizaciones SO ({soUpdates.length})
                </div>
                <table className="tbl" style={{ fontSize:11 }}>
                  <thead><tr>
                    <th>Descripción</th><th>Serial</th><th>SO actual</th><th>SO nuevo</th>
                  </tr></thead>
                  <tbody>
                    {soUpdates.map((u, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight:600 }}>{u.descripcion}</td>
                        <td style={{ fontFamily:"'Barlow Condensed',sans-serif", color:'#144E4A', fontWeight:700 }}>{u.serial}</td>
                        <td style={{ color:'#c0392b', textDecoration:'line-through', fontFamily:"'Barlow Condensed',sans-serif" }}>{u.so_db}</td>
                        <td style={{ color:'#1a6130', fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>{u.so_csv}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalNew === 0 && soUpdates.length === 0 && (
              <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:13 }}>
                No hay elementos nuevos ni actualizaciones pendientes.
              </div>
            )}
          </>)}

          {/* Audit report */}
          {step === 'report' && (
            auditRows.length === 0
              ? <div style={{ textAlign:'center', padding:48, color:'#1a6130', fontSize:15, fontWeight:700 }}>
                  ✓ Nokia y la app están sincronizados — sin inconsistencias.
                </div>
              : <div style={{ overflowX:'auto' }}>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <thead><tr>
                      <th>Tipo</th><th>Descripción</th><th>Serial</th>
                      <th>Sitio Nokia</th><th>Sitio App</th>
                      <th>SO Nokia</th><th>SO App</th>
                      <th>Cant. Nokia</th><th>Cant. App</th>
                    </tr></thead>
                    <tbody>
                      {auditRows.map((r, i) => {
                        const b = AUDIT_BADGE[r.tipo]
                        const siteDiff = r.tipo === 'SITIO_DIFERENTE'
                        const cantDiff = r.tipo === 'CANT_DIFERENTE'
                        return (
                          <tr key={i}>
                            <td><span className="badge" style={{ background:b.bg, color:b.color, fontSize:9 }}>{b.label}</span></td>
                            <td style={{ fontWeight:600, maxWidth:200 }}>{r.descripcion}</td>
                            <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10 }}>{r.serial || '—'}</td>
                            <td style={{ fontWeight:600, color: siteDiff ? '#c0392b' : 'inherit' }}>{r.nokia_sitio || '—'}</td>
                            <td style={{ fontWeight:600, color: siteDiff ? '#c0392b' : 'inherit' }}>{r.app_sitio || '—'}</td>
                            <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10 }}>{r.nokia_so || '—'}</td>
                            <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10 }}>{r.app_so || '—'}</td>
                            <td style={{ textAlign:'center' }}>{r.nokia_cant ?? '—'}</td>
                            <td style={{ textAlign:'center', color: cantDiff ? '#c0392b' : 'inherit', fontWeight: cantDiff ? 700 : 400 }}>
                              {r.app_cant ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop:'1px solid #e8f0e8', padding:'12px 20px', background:'#fff',
          flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>

          {saving && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, color:'#555f55', fontWeight:600 }}>{progress.phase}</span>
                <span style={{ fontSize:11, color:'#1a6130', fontWeight:700 }}>{pct}%</span>
              </div>
              <div style={{ background:'#e8f0e8', borderRadius:20, height:8, overflow:'hidden' }}>
                <div style={{ background:'#1a9c1a', height:'100%', width:`${pct}%`, transition:'width .3s ease', borderRadius:20 }} />
              </div>
              <div style={{ fontSize:10, color:'#9ca89c', marginTop:4, textAlign:'right' }}>
                {progress.current} / {progress.total} operaciones
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:8, justifyContent:'space-between', alignItems:'center' }}>
            <div>
              {step !== 'upload' && !saving && (
                <button className="btn bou btn-sm"
                  onClick={() => { setStep('upload'); setEntradas([]); setSalidas([]); setAuditRows([]) }}
                  style={{ fontSize:11 }}>
                  ← Cambiar archivos
                </button>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn bou" onClick={onClose} disabled={saving}>Cancelar</button>
              {step === 'review' && (mode === 'import' || mode === 'entradas') && (totalNew > 0 || soUpdates.length > 0) && (
                <button className="btn bp" onClick={handleSave} disabled={saving}
                  style={{ opacity: saving ? .7 : 1, minWidth:170 }}>
                  {saving
                    ? 'Importando…'
                    : `Importar ${totalNew} elemento(s)${soUpdates.length ? ` + ${soUpdates.length} SO` : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
