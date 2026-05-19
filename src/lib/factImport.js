// Generación de plantilla y lectura de Excel para importación masiva de facturas

export async function descargarPlantillaFacturas(rows) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nokia Platform'
  const ws = wb.addWorksheet('Facturas pendientes')

  ws.columns = [
    { header: 'Sitio',         key: 'sitio',    width: 28 },
    { header: 'SPO',           key: 'spo',      width: 14 },
    { header: 'SMP ID',        key: 'smp_id',   width: 22 },
    { header: 'SMP Name',      key: 'smp_name', width: 30 },
    { header: 'MS Name',       key: 'ms_name',  width: 30 },
    { header: 'Evento',        key: 'ev_label', width: 20 },
    { header: 'Evento Key',    key: 'ev_key',   width: 14 },
    { header: '%',             key: 'pct',      width: 6  },
    { header: 'Núm. Factura',  key: 'num_fac',  width: 22 },
    { header: 'Fecha Factura', key: 'fecha',    width: 16 },
    { header: 'Observaciones', key: 'obs',      width: 32 },
  ]

  // Header row
  const hdr = ws.getRow(1)
  hdr.height = 22
  hdr.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF144E4A' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
  })

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  ws.getCell('J1').note = 'Formato: YYYY-MM-DD (ej. 2025-04-30)'

  // Data rows
  for (const { row, eventos } of rows) {
    for (const ev of eventos) {
      const spoNum = Number(row.spo_number)
      const dr = ws.addRow({
        sitio:    row.customer_site_name || row.site_reference_id || '',
        spo:      isNaN(spoNum) ? row.spo_number : spoNum,
        smp_id:   row.smp_id || '',
        smp_name: row.smp_name || '',
        ms_name:  row.ms_name || '',
        ev_label: ev.label,
        ev_key:   ev.key,
        pct:      ev.pct,
        num_fac:  '',
        fecha:    '',
        obs:      '',
      })
      dr.height = 18

      // Columnas de referencia A-H: fondo gris claro, no editar
      for (let c = 1; c <= 8; c++) {
        const cell = dr.getCell(c)
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
        cell.font      = { size: 10, color: { argb: 'FF374151' } }
        cell.alignment = { vertical: 'middle' }
        if (c === 2) cell.numFmt = '0'  // SPO como número
      }

      // Columnas de entrada I-K: fondo blanco con borde verde
      for (let c = 9; c <= 11; c++) {
        const cell = dr.getCell(c)
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
        cell.font      = { size: 10 }
        cell.alignment = { vertical: 'middle' }
        cell.border    = {
          top:    { style: 'thin', color: { argb: 'FF144E4A' } },
          bottom: { style: 'thin', color: { argb: 'FF144E4A' } },
          left:   { style: 'thin', color: { argb: 'FF144E4A' } },
          right:  { style: 'thin', color: { argb: 'FF144E4A' } },
        }
        if (c === 10) cell.numFmt = 'yyyy-mm-dd'  // columna fecha con formato real de fecha
      }
    }
  }

  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `plantilla_facturas_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// Convierte un valor de celda de ExcelJS a string "YYYY-MM-DD" o null
function parseFechaCell(raw) {
  if (!raw) return null

  let d

  if (raw instanceof Date) {
    d = raw
  } else if (typeof raw === 'number') {
    // Serial de Excel (días desde 1900-01-01; 25569 = días hasta Unix epoch 1970-01-01)
    d = new Date(Math.round((raw - 25569) * 86400 * 1000))
  } else if (typeof raw === 'string') {
    const s = raw.trim()
    // ISO YYYY-MM-DD directo — sin pasar por Date para evitar el problema de UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    d = new Date(s)
  } else {
    return null
  }

  if (!d || isNaN(d.getTime())) return null

  // ExcelJS produce fechas como medianoche UTC (Date.UTC) en todos los casos.
  // Usar getUTC* evita que la zona horaria local (UTC-5 Colombia) corra el día hacia atrás.
  const y   = d.getUTCFullYear()
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function parsearExcelFacturas(file) {
  const ExcelJS = (await import('exceljs')).default
  const wb  = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('No se encontró la hoja de cálculo')

  const items  = []
  const errors = []

  ws.eachRow((row, idx) => {
    if (idx === 1) return

    const spo     = String(row.getCell(2).value ?? '').trim()
    const ev_key  = String(row.getCell(6).value ?? '').trim()
    const pct     = Number(row.getCell(7).value)  || 0
    const num_fac = String(row.getCell(8).value ?? '').trim()
    const obs      = String(row.getCell(10).value ?? '').trim()

    if (!num_fac) return  // fila vacía → ignorar

    if (!spo || !ev_key) {
      errors.push(`Fila ${idx}: SPO o Evento Key vacío — ignorada`)
      return
    }

    const fecha = parseFechaCell(row.getCell(9).value)

    items.push({
      spo_number:     spo,
      evento:         ev_key,
      pct,
      numero_factura: num_fac,
      fecha_factura:  fecha,
      observaciones:  obs || null,
    })
  })

  return { items, errors }
}
