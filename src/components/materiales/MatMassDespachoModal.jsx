import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAppStore }  from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { getSupabaseClient } from '../../lib/supabase'
import { showToast } from '../Toast'

function nextDocNums(despachos, count) {
  const year = new Date().getFullYear()
  const nums = despachos
    .map(d => { const m = d.numero_doc?.match(/DS-\d{4}-(\d+)/); return m ? parseInt(m[1]) : 0 })
    .filter(Boolean)
  const start = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return Array.from({ length: count }, (_, i) => `DS-${year}-${String(start + i).padStart(3, '0')}`)
}

function Badge({ children, bg = '#f3f4f6', color = '#6b7280' }) {
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:9, fontWeight:700, background:bg, color }}>
      {children}
    </span>
  )
}

export default function MatMassDespachoModal({ onClose }) {
  const catalogo           = useMatStore(s => s.catalogo)
  const bodegas            = useMatStore(s => s.bodegas)
  const despachos          = useMatStore(s => s.despachos)
  const getStock           = useMatStore(s => s.getStock)
  const saveDespacho       = useMatStore(s => s.saveDespacho)
  const finalizarDespacho  = useMatStore(s => s.finalizarDespacho)
  const insertPendientes   = useMatStore(s => s.insertPendientes)
  const resolverPendientes = useMatStore(s => s.resolverPendientes)
  const matSitios          = useMatStore(s => s.sitios)
  const saveSitio          = useMatStore(s => s.saveSitio)
  const liquidadorSitios   = useAppStore(s => s.sitios ?? [])
  const user               = useAuthStore(s => s.user)

  const [step,     setStep]     = useState('setup')
  const [bodega,   setBodega]   = useState(String(bodegas[0]?.id || ''))
  const [fecha,    setFecha]    = useState(new Date().toISOString().slice(0, 10))
  const [rawData,  setRawData]  = useState([])
  const [rows,     setRows]     = useState([])
  const [doneInfo, setDoneInfo] = useState(null)  // { docNumsBySite }
  const [saving,   setSaving]   = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' })

  const matItems = catalogo.filter(c => c.categoria !== 'PROVEEDORES' && c.activo)

  // ── Template download ────────────────────────────────────────
  async function downloadTemplate() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Despacho')

    ws.columns = [
      { key: 'item',      width: 6  },
      { key: 'sitename',  width: 24 },
      { key: 'tipo',      width: 8  },
      { key: 'codigo',    width: 14 },
      { key: 'parte',     width: 44 },
      { key: 'unidad',    width: 8  },
      { key: 'cantidad',  width: 10 },
      { key: 'actividad', width: 18 },
      { key: 'vrunit',    width: 14 },
      { key: 'total',     width: 14 },
    ]

    // ── Filas 1–10: mismo formato que el Excel actual de Ingetel ──
    const metaRows = [
      [null, 'Nombre sitio:',       null, 'Comentario'],
      [null, 'Altura Torre:',       null],
      [null, 'Amphenol nuevo',      null],
      [null, 'Fibras',              null],
      [null, 'Proyecto',            null],
      [null, 'Cantidad FPFH',       null, null],
      [null, 'Recorrido DC FPFH 1', null, null],
      [null, 'Recorrido DC FPFH 2', null, null],
      [null, 'Recorrido DC FPFH 3', null, null],
      [null, 'Recorrido FCOB',      null],
    ]
    metaRows.forEach(data => {
      const row = ws.addRow(data)
      row.eachCell({ includeEmpty: false }, cell => { cell.font = { size: 10 } })
    })

    // Fila 11: separador vacío
    ws.addRow([])

    // ── Fila 12: encabezados de tabla ──
    const hRow = ws.addRow(['Item', 'Site Name', 'Tipo', 'Código', 'Parte', 'Unidad', 'Cantidad', 'Actividad', 'Vr.Unit', 'Total'])
    hRow.height = 20
    hRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } }
      cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    // Columnas que el usuario debe llenar → rojo para destacarlas
    ;['B', 'G', 'H'].forEach(col => {
      hRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } }
    })
    // Vr.Unit editable → amarillo oscuro en header
    hRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8860B' } }

    // ── Filas 13+: ítems del catálogo ──
    matItems.forEach((c, idx) => {
      const rowNum = 13 + idx
      const row = ws.addRow([
        idx + 1,
        null,
        c.categoria,
        c.codigo,
        c.nombre,
        c.unidad || 'UND',
        null,
        null,
        c.costo_unitario || 0,
        { formula: `G${rowNum}*I${rowNum}` },
      ])

      // Informativas (A, C, D, E, F) → gris
      ;['A', 'C', 'D', 'E', 'F'].forEach(col => {
        row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
        row.getCell(col).font = { color: { argb: 'FF888888' }, size: 10 }
      })

      // Vr.Unit → amarillo claro (editable)
      row.getCell('I').fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
      row.getCell('I').numFmt = '#,##0'

      // Total → gris claro (fórmula)
      row.getCell('J').fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
      row.getCell('J').font   = { color: { argb: 'FF888888' }, size: 10 }
      row.getCell('J').numFmt = '#,##0'

      // Badge Tipo: TI verde, CW morado
      if (c.categoria === 'TI') {
        row.getCell('C').font = { color: { argb: 'FF166534' }, size: 10, bold: true }
      } else if (c.categoria === 'CW') {
        row.getCell('C').font = { color: { argb: 'FF5B21B6' }, size: 10, bold: true }
      }
    })

    // Congelar las 12 filas superiores
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 12 }]

    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `template_despacho_${fecha}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Chequeo de stock (separado del parseo para poder recalcular al cambiar bodega) ──
  function applyStockCheck(items, currentBodega) {
    const bodegaNum = Number(currentBodega)
    return items.map(item => {
      if (!item.siteName)     return { ...item, stockDisp: 0, status: 'blocked', statusMsg: 'Sin Site Name',        blockReason: 'data' }
      if (!item.cat)          return { ...item, stockDisp: 0, status: 'blocked', statusMsg: 'Código no encontrado', blockReason: 'data' }
      if (item.cantidad <= 0) return { ...item, stockDisp: 0, status: 'blocked', statusMsg: 'Cantidad inválida',    blockReason: 'data' }

      const stockDisp = getStock(item.cat.id, bodegaNum)

      let status = 'ok', statusMsg = '', blockReason = null
      if (stockDisp === 0) {
        status = 'blocked'; blockReason = 'stock'
        const hint = bodegas
          .filter(b => b.id !== bodegaNum)
          .map(b => ({ nombre: b.nombre, stk: getStock(item.cat.id, b.id) }))
          .filter(b => b.stk > 0).map(b => `${b.nombre}: ${b.stk}`).join(' · ')
        statusMsg = hint ? `Sin stock · Hay en: ${hint}` : 'Sin stock en ninguna bodega'
      } else if (item.cantidad > stockDisp) {
        // Despacha lo disponible, deja pendiente la diferencia
        status = 'partial'; blockReason = 'stock'
        statusMsg = `Despacha ${stockDisp} · Pendiente: ${item.cantidad - stockDisp}`
      }

      return { ...item, stockDisp, status, statusMsg, blockReason }
    })
  }

  // ── Cambio de bodega en preview (recalcula sin recargar archivo) ──
  function handleBodegaChange(newBodega) {
    setBodega(newBodega)
    if (rawData.length > 0) setRows(applyStockCheck(rawData, newBodega))
  }

  // ── Parseo del archivo (solo extrae datos, luego aplica chequeo) ──
  function parseFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets['Despacho']
        if (!ws) { showToast('Hoja "Despacho" no encontrada', 'err'); return }

        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const dataRows = raw.slice(12).filter(r => r[6] != null && Number(r[6]) > 0 && r[1] != null)

        if (dataRows.length === 0) {
          showToast('No se encontraron filas con Site Name y Cantidad > 0', 'err')
          return
        }

        const base = dataRows.map(r => {
          const siteName  = r[1] != null ? String(r[1]).trim() : null
          const codigo    = r[3] != null ? String(r[3]).trim() : null
          const cantidad  = Number(r[6]) || 0
          const actividad = r[7] != null ? String(r[7]).trim() : null
          const valorUnit = r[8] != null && r[8] !== '' ? Number(r[8]) : null
          const cat       = catalogo.find(c => c.codigo === codigo)
          const precioFinal = valorUnit != null ? valorUnit : (cat?.costo_unitario || 0)
          return { siteName, codigo, nombre: cat?.nombre || codigo, cat, cantidad, actividad, precioFinal, total: cantidad * precioFinal }
        })

        setRawData(base)
        setRows(applyStockCheck(base, bodega))
        setStep('preview')
      } catch (err) {
        showToast('Error al leer el archivo: ' + err.message, 'err')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const validRows   = rows.filter(r => r.status === 'ok' || r.status === 'partial')
  const partialRows = rows.filter(r => r.status === 'partial')
  const blockedRows = rows.filter(r => r.status === 'blocked')
  const sites       = [...new Set(validRows.map(r => r.siteName))]
  const totalValor  = validRows.reduce((s, r) => s + (r.status === 'partial' ? r.stockDisp * r.precioFinal : r.total), 0)

  const allSitesInFile = [...new Set(rows.filter(r => r.siteName).map(r => r.siteName))]
  const sitiosDesconocidos = allSitesInFile.filter(site =>
    !liquidadorSitios.some(s => s.nombre?.toLowerCase() === site.toLowerCase()) &&
    !matSitios.some(s => s.nombre?.toLowerCase() === site.toLowerCase())
  )

  // ── Descarga Excel resultado (una hoja por sitio) ───────────
  async function downloadResultExcel() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const bodegaNombre = bodegas.find(b => String(b.id) === bodega)?.nombre || bodega
    const allSites = [...new Set(rows.filter(r => r.siteName).map(r => r.siteName))]

    const metaLabels = ['Nombre sitio:', 'Altura Torre:', 'Amphenol nuevo', 'Fibras',
      'Proyecto', 'Cantidad FPFH', 'Recorrido DC FPFH 1', 'Recorrido DC FPFH 2',
      'Recorrido DC FPFH 3', 'Recorrido FCOB']

    allSites.forEach(site => {
      const ws   = wb.addWorksheet(site.slice(0, 31))
      const docN = doneInfo?.docNumsBySite?.[site] || ''
      const siteRows = rows.filter(r => r.siteName === site)
      const dispatched = siteRows.filter(r => r.status === 'ok' || r.status === 'partial')
      const pending    = siteRows.filter(r => r.status === 'blocked' && r.blockReason === 'stock')

      ws.columns = [
        { width: 6 }, { width: 24 }, { width: 8 }, { width: 14 },
        { width: 44 }, { width: 8 }, { width: 12 }, { width: 18 },
        { width: 14 }, { width: 14 }, { width: 18 },
      ]

      // Filas 1–10: header info
      metaLabels.forEach((label, i) => {
        const r = ws.addRow([null, label, i === 0 ? site : null, i === 0 ? `Bodega: ${bodegaNombre}  Doc: ${docN}` : null])
        r.eachCell({ includeEmpty: false }, c => { c.font = { size: 10 } })
      })
      ws.addRow([]) // fila 11

      // Fila 12: encabezados
      const hRow = ws.addRow(['Item', 'Site Name', 'Tipo', 'Código', 'Parte', 'Unidad',
        'Cant. Despacho', 'Actividad', 'Vr.Unit', 'Total', 'Pendiente'])
      hRow.height = 20
      hRow.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } }
        c.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
        c.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      hRow.getCell('K').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } }

      // Ítems despachados (verde claro; parciales muestran qty real + pendiente en col K)
      dispatched.forEach((row, idx) => {
        const cantDesp = row.status === 'partial' ? row.stockDisp : row.cantidad
        const pendCol  = row.status === 'partial' ? (row.cantidad - row.stockDisp) : ''
        const r = ws.addRow([
          idx + 1, site, row.cat?.categoria, row.codigo, row.nombre,
          row.cat?.unidad || 'UND', cantDesp, row.actividad || '',
          row.precioFinal, cantDesp * row.precioFinal, pendCol,
        ])
        ;[1,2,3,4,5,6].forEach(col => {
          r.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
          r.getCell(col).font = { color: { argb: 'FF166534' }, size: 10 }
        })
        r.getCell(9).numFmt  = '#,##0'
        r.getCell(10).numFmt = '#,##0'
        if (row.status === 'partial') {
          r.getCell(11).font = { color: { argb: 'FFC0392B' }, bold: true, size: 10 }
          r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
        }
      })

      // Ítems pendientes (naranja)
      pending.forEach((row, idx) => {
        const r = ws.addRow([
          dispatched.length + idx + 1, site, row.cat?.categoria, row.codigo, row.nombre,
          row.cat?.unidad || 'UND', 0, row.actividad || '',
          row.precioFinal, 0, row.cantidad,
        ])
        r.eachCell({ includeEmpty: false }, c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
          c.font = { color: { argb: 'FF92400E' }, size: 10, bold: false }
        })
        r.getCell(9).numFmt  = '#,##0'
        r.getCell(11).font   = { color: { argb: 'FFC0392B' }, bold: true, size: 10 }
      })

      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 12 }]
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `despacho_resultado_${fecha}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Recalcular stock desde DB sin recargar el archivo ────────
  async function recalcularStock() {
    await useMatStore.getState().loadAll()
    setRows(applyStockCheck(rawData, bodega))
  }

  // ── Confirmar ────────────────────────────────────────────────
  async function handleConfirm() {
    if (!bodega) { showToast('Selecciona una bodega', 'err'); return }
    setSaving(true)
    setProgress({ current: 0, total: 0, phase: 'Verificando stock…' })

    try {
      // ── 0. Recargar stock fresco antes de proceder ────────────
      await useMatStore.getState().loadAll()
      const freshRows    = applyStockCheck(rawData, bodega)
      setRows(freshRows)

      const freshValid   = freshRows.filter(r => r.status === 'ok' || r.status === 'partial')
      const freshSites   = [...new Set(freshValid.map(r => r.siteName))]

      if (freshValid.length === 0) {
        showToast('Sin stock disponible para ningún ítem', 'err')
        setSaving(false)
        setProgress({ current: 0, total: 0, phase: '' })
        return
      }

      const db      = getSupabaseClient()
      // Usar despachos frescos del store para generar doc numbers sin conflicto
      const freshDespachos = useMatStore.getState().despachos
      const docNums = nextDocNums(freshDespachos, freshSites.length)
      setProgress({ current: 0, total: freshSites.length, phase: 'Iniciando…' })

      // ── 1. Crear despachos y movimientos ─────────────────────
      for (let si = 0; si < freshSites.length; si++) {
        const site     = freshSites[si]
        const docNum   = docNums[si]
        const siteRows = freshValid.filter(r => r.siteName === site)

        setProgress({ current: si, total: freshSites.length, phase: `Creando ${docNum} → ${site}…` })

        const desp = await saveDespacho({
          numero_doc:  docNum,
          bodega_id:   Number(bodega),
          destino:     site,
          fecha,
          status:      'borrador',
          comentarios: null,
          created_by:  user?.nombre || user?.email,
        })

        const payload = siteRows.map(row => {
          const cantDesp = row.status === 'partial' ? row.stockDisp : row.cantidad
          return {
            numero_doc:      docNum,
            fecha,
            tipo:            'Salida',
            catalogo_id:     row.cat.id,
            bodega_id:       Number(bodega),
            cantidad:        cantDesp,
            valor_unitario:  row.precioFinal,
            cant_solicitada: row.cantidad,
            cant_despachada: cantDesp,
            destino:         site,
            origen:          row.actividad || null,
            created_by:      user?.nombre || user?.email,
          }
        })

        const { error: movErr } = await db.from('mat_movimientos').insert(payload)
        if (movErr) throw new Error(movErr.message)

        const dispatchedCatIds = siteRows.map(r => r.cat.id)
        await resolverPendientes(site, dispatchedCatIds)

        await finalizarDespacho(desp.id)
        setProgress({ current: si + 1, total: freshSites.length, phase: `${docNum} finalizado` })
      }

      // ── 2. Crear en mat_sitios todos los sites despachados que aún no existan ──
      for (const site of freshSites) {
        const yaEnMat = matSitios.some(s => s.nombre?.toLowerCase() === site.toLowerCase())
        if (!yaEnMat) {
          const liqSitio = liquidadorSitios.find(s => s.nombre?.toLowerCase() === site.toLowerCase())
          await saveSitio({ nombre: site, tipo_cw: liqSitio?.tipo || '', regional: liqSitio?.regional || 'Sur-Occidente', comentarios: '', activo: true }).catch(() => {})
        }
      }

      // ── 3. Ir a pantalla done (el despacho ya está en DB) ────
      const docNumsBySite = Object.fromEntries(freshSites.map((s, i) => [s, docNums[i]]))
      setDoneInfo({ docNumsBySite })
      setStep('done')

      // ── 4. Pendientes (no crítico — no bloquea done) ─────────
      const nuevosPendientes = freshRows
        .filter(r => (r.status === 'blocked' || r.status === 'partial') && r.blockReason === 'stock' && r.cat && r.siteName)
        .map(r => ({
          sitio:        r.siteName,
          catalogo_id:  r.cat.id,
          cantidad:     r.status === 'partial' ? (r.cantidad - r.stockDisp) : r.cantidad,
          despacho_ref: docNumsBySite[r.siteName] || null,
          fecha,
          created_by:   user?.nombre || user?.email,
        }))
      if (nuevosPendientes.length) {
        try { await insertPendientes(nuevosPendientes) }
        catch (pErr) { console.error('[mat] Error pendientes:', pErr.message) }
      }

      // ── 5. Sincronizar store al final ────────────────────────
      await useMatStore.getState().loadAll()

    } catch (err) {
      showToast('Error: ' + err.message, 'err')
    } finally {
      setSaving(false)
      setProgress({ current: 0, total: 0, phase: '' })
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%',
        maxWidth: step === 'preview' ? 1060 : 500,
        maxHeight: '94vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,.3)',
      }}>

        {/* Header */}
        <div style={{
          background: '#0a0a0a', color: '#fff', padding: '12px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '3px solid #c0392b', borderRadius: '12px 12px 0 0',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>
            ↓↓ DESPACHO A SITIO POR LOTE — EXCEL
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca89c', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* ── PASO 1: Setup ─────────────────────────────────── */}
        {step === 'setup' && (
          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="fl">Bodega Origen *</label>
                <select className="fc" value={bodega} onChange={e => setBodega(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Fecha</label>
                <input type="date" className="fc" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
            </div>

            <div style={{ border: '1px solid #f5c6cb', borderRadius: 8, padding: 16, background: '#fff5f5' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7f1d1d', marginBottom: 8 }}>INSTRUCCIONES</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#7f1d1d', lineHeight: 1.9 }}>
                <li>Descarga el template — contiene todos los materiales activos del catálogo (TI y CW).</li>
                <li>Las columnas en <b style={{ color:'#c0392b' }}>rojo</b> son las que debes llenar: <b>Site Name</b>, <b>Cantidad</b> y <b>Actividad</b>.</li>
                <li><b>Vr.Unit</b> viene pre-llenado del catálogo (fondo amarillo) — puedes editarlo por fila.</li>
                <li><b>Total</b> se calcula automáticamente (Cantidad × Vr.Unit).</li>
                <li>Puedes usar el mismo template para varios sitios — el sistema crea un despacho por sitio.</li>
                <li>Filas con Cantidad vacía o 0 se ignoran. Las primeras 10 filas (info del sitio) también.</li>
              </ol>
            </div>

            <button onClick={downloadTemplate} style={{
              padding: '10px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8,
              border: '1.5px solid #c0392b', background: '#fff5f5', color: '#7f1d1d',
              cursor: 'pointer', textAlign: 'left',
            }}>
              ⬇ Descargar Template &nbsp;
              <span style={{ fontSize: 10, fontWeight: 400, color: '#9ca89c' }}>({matItems.length} ítems · hoja "Despacho")</span>
            </button>

            <div>
              <label className="fl">Cargar archivo completado</label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                border: '2px dashed #f5c6cb', borderRadius: 10, padding: '24px 40px',
                cursor: 'pointer', background: '#fff8f8',
              }}>
                <span style={{ fontSize: 28 }}>📂</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c0392b' }}>Seleccionar archivo .xlsx</span>
                <input
                  type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => {
                    if (!bodega) { showToast('Selecciona una bodega primero', 'err'); return }
                    parseFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: Preview ───────────────────────────────── */}
        {step === 'preview' && (
          <div style={{ padding: 20 }}>

            {/* Bodega + Fecha + Recalcular */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 14, alignItems: 'end' }}>
              <div>
                <label className="fl">Bodega Origen</label>
                <select className="fc" value={bodega} onChange={e => handleBodegaChange(e.target.value)} disabled={saving}>
                  <option value="">— Seleccionar —</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Fecha</label>
                <input type="date" className="fc" value={fecha} onChange={e => setFecha(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="fl">&nbsp;</label>
                <button onClick={recalcularStock} disabled={saving} style={{
                  padding: '7px 14px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                  border: '1.5px solid #1a9c1a', background: '#f0fdf4', color: '#166534',
                  cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                }}>
                  ↻ Recalcular stock
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { label: 'Sitios',      val: sites.length,       bg: '#f1f5f9', color: '#334155' },
                { label: 'A despachar', val: validRows.length,   bg: '#dcfce7', color: '#166534' },
                { label: 'Parciales',   val: partialRows.length, bg: '#fef3cd', color: '#92400e' },
                { label: 'Bloqueados',  val: blockedRows.length, bg: '#fee2e2', color: '#991b1b' },
                { label: 'Valor total', val: matCop(totalValor), bg: '#fff5f5', color: '#7f1d1d' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 17, fontWeight: 500, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.val}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, opacity: .75 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Advertencia sitios no registrados en la APP */}
            {sitiosDesconocidos.length > 0 && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1.5px solid #f59e0b' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                  ⚠ {sitiosDesconocidos.length} sitio(s) del archivo no existen en la APP
                </div>
                <div style={{ fontSize: 10, color: '#78350f', marginBottom: 6 }}>
                  {sitiosDesconocidos.join(' · ')}
                </div>
                <div style={{ fontSize: 10, color: '#92400e', lineHeight: 1.5 }}>
                  El despacho se registrará de todas formas. Si estos sitios deben aparecer en el Pill Sitios, créalos manualmente desde <strong>Logística → Sitios</strong>.
                </div>
              </div>
            )}

            {/* Info despachos a crear */}
            {sites.length > 0 && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #f5c6cb' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7f1d1d' }}>SE CREARÁN {sites.length} DESPACHO(S): </span>
                <span style={{ fontSize: 10, color: '#555f55' }}>{sites.join(' · ')}</span>
              </div>
            )}

            {/* Tabla preview */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(94vh - 340px)', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: '#1e293b', color: '#e2e8f0' }}>
                    {['SITE NAME', 'TIPO', 'CÓDIGO', 'MATERIAL', 'CANT', 'STOCK DISP.', 'VR.UNIT', 'TOTAL', 'ACTIVIDAD', 'ESTADO'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 9, letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const blocked = row.status === 'blocked'
                    const partial = row.status === 'partial'
                    const bg = blocked ? (i % 2 === 0 ? '#fff5f5' : '#fee2e2')
                             : partial ? (i % 2 === 0 ? '#fffbeb' : '#fef3cd')
                             :           (i % 2 === 0 ? '#fff'    : '#f0fdf4')
                    return (
                      <tr key={i} style={{ background: bg, borderBottom: '1px solid #e2e8f0', opacity: blocked ? .75 : 1 }}>
                        <td style={{ padding: '5px 10px', fontWeight: 600, fontSize: 10, color: '#c0392b', whiteSpace: 'nowrap' }}>
                          {row.siteName || <span style={{ color: '#d0d5d0' }}>—</span>}
                        </td>
                        <td style={{ padding: '5px 10px' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                            background: row.cat?.categoria === 'CW' ? '#faf5ff' : '#f0fdf4',
                            color:      row.cat?.categoria === 'CW' ? '#5b21b6' : '#166534',
                          }}>
                            {row.cat?.categoria || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '5px 10px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: '#475569' }}>
                          {row.codigo || '—'}
                        </td>
                        <td style={{ padding: '5px 10px', fontWeight: 600, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.nombre || '—'}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700 }}>{row.cantidad}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700,
                          color: row.stockDisp === 0 ? '#991b1b' : row.stockDisp < row.cantidad ? '#92400e' : '#166534' }}>
                          {row.stockDisp}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#7f1d1d', fontWeight: 600 }}>
                          {matCop(row.precioFinal)}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#7f1d1d' }}>
                          {matCop(row.total)}
                        </td>
                        <td style={{ padding: '5px 10px', fontSize: 10, color: '#475569' }}>
                          {row.actividad || <span style={{ color: '#d0d5d0' }}>—</span>}
                        </td>
                        <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                          {blocked
                            ? <Badge bg="#fee2e2" color="#991b1b">{row.statusMsg}</Badge>
                            : partial
                              ? <Badge bg="#fef3cd" color="#92400e">{row.statusMsg}</Badge>
                              : <Badge bg="#dcfce7" color="#166534">OK</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {(blockedRows.length > 0 || partialRows.length > 0) && (
              <p style={{ fontSize: 11, color: '#92400e', marginTop: 10, fontWeight: 600 }}>
                {partialRows.length > 0 && `${partialRows.length} fila(s) con stock parcial — se despachará lo disponible y el resto queda pendiente. `}
                {blockedRows.length > 0 && `${blockedRows.length} fila(s) sin stock — no se incluirán.`}
              </p>
            )}

            {/* Barra de progreso */}
            {saving && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#555f55', fontWeight: 600 }}>{progress.phase}</span>
                  <span style={{ fontSize: 11, color: '#c0392b', fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ background: '#fee2e2', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    background: '#c0392b', height: '100%', borderRadius: 20, transition: 'width .3s ease',
                    width: `${saving && progress.total === 0 ? 20 : pct}%`,
                  }} />
                </div>
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              {!saving && (
                <button onClick={() => setStep('setup')} style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                  border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer',
                }}>
                  ← Cambiar archivo
                </button>
              )}
              <button onClick={onClose} disabled={saving} style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer',
              }}>
                Cancelar
              </button>
              <button onClick={handleConfirm} disabled={saving || validRows.length === 0} style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                border: 'none',
                background: validRows.length === 0 ? '#e0e4e0' : '#c0392b',
                color: validRows.length === 0 ? '#9ca89c' : '#fff',
                cursor: validRows.length === 0 ? 'not-allowed' : 'pointer',
                opacity: saving ? .7 : 1, minWidth: 200,
              }}>
                {saving
                  ? 'Registrando…'
                  : `Confirmar ${sites.length} despacho(s) · ${validRows.length} ítem(s)${partialRows.length ? ` (${partialRows.length} parcial)` : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Done ──────────────────────────────────── */}
        {step === 'done' && doneInfo && (() => {
          const pendingRows = rows.filter(r => (r.status === 'blocked' || r.status === 'partial') && r.blockReason === 'stock')
          const allSites    = [...new Set(rows.filter(r => r.siteName).map(r => r.siteName))]
          return (
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Resumen */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Despachos creados', val: sites.length,       bg: '#dcfce7', color: '#166534' },
                  { label: 'Ítems despachados', val: validRows.length,   bg: '#dcfce7', color: '#166534' },
                  { label: 'Ítems pendientes',  val: pendingRows.length, bg: pendingRows.length > 0 ? '#fef3cd' : '#f1f5f9', color: pendingRows.length > 0 ? '#92400e' : '#334155' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '10px 16px', textAlign: 'center', minWidth: 110 }}>
                    <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.val}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, opacity: .75 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Docs creados */}
              <div style={{ fontSize: 11, color: '#555f55' }}>
                {allSites.map(s => (
                  <div key={s} style={{ marginBottom: 2 }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, color: '#c0392b', fontSize: 13 }}>{doneInfo.docNumsBySite[s] || '—'}</span>
                    {' '}<span style={{ color: '#9ca89c' }}>→</span>{' '}{s}
                  </div>
                ))}
              </div>

              {/* Pendientes */}
              {pendingRows.length > 0 && (
                <div style={{ border: '1px solid #fbbf24', borderRadius: 8, padding: 12, background: '#fffbeb' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                    ÍTEMS PENDIENTES POR STOCK INSUFICIENTE
                  </div>
                  {pendingRows.map((r, i) => {
                    const pendQty = r.status === 'partial' ? (r.cantidad - r.stockDisp) : r.cantidad
                    return (
                      <div key={i} style={{ fontSize: 11, color: '#78350f', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700 }}>{r.siteName}</span>
                        {' · '}{r.nombre}
                        {r.status === 'partial' && <span style={{ color: '#92400e', fontSize: 10 }}> (despachó {r.stockDisp})</span>}
                        {' — '}<span style={{ fontWeight: 700, color: '#c0392b' }}>{pendQty} und. pendientes</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Botones */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={downloadResultExcel} style={{
                  padding: '10px 20px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                  border: '1.5px solid #c0392b', background: '#fff5f5', color: '#7f1d1d',
                  cursor: 'pointer',
                }}>
                  ⬇ Descargar Excel resultado
                  {pendingRows.length > 0 && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6 }}>(incluye {pendingRows.length} pendiente(s))</span>}
                </button>
                <button onClick={onClose} style={{
                  padding: '10px 20px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                  border: 'none', background: '#0a0a0a', color: '#fff', cursor: 'pointer',
                }}>
                  Cerrar
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
