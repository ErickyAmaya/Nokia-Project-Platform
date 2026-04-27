/**
 * Nokia ACK — Exportación Excel con formato completo (Nokia style)
 * Usa ExcelJS con carga dinámica para no impactar el bundle inicial.
 */

// ── Helpers internos ──────────────────────────────────────────────

function toARGB(hex) {
  return 'FF' + hex.replace('#', '').toUpperCase()
}

function isFin(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function fmtDateStr(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function applyFiltro(rows, key, filtro) {
  if (filtro === 'pendientes') return rows.filter(r => !isFin(r[key]))
  if (filtro === 'cerrados')   return rows.filter(r =>  isFin(r[key]))
  return rows
}

function resolveOwnerStr(owner, empresaNombre) {
  if (!owner) return owner
  return owner.trim().toUpperCase() === 'SS' ? (empresaNombre || owner) : owner
}

// ── Builders de datos (paralelo a los de AckForecast) ────────────

function buildGapTree(rows, procesoKey) {
  const map = new Map()
  for (const r of rows) {
    const gap  = r[procesoKey] || '(Sin estado)'
    const site = r.site_name   || '(Sin sitio)'
    if (!map.has(gap)) map.set(gap, new Map())
    map.get(gap).set(site, (map.get(gap).get(site) || 0) + 1)
  }
  return map
}

function buildFcData(rows, procesoKey, forecasts, faKey, ticketKey) {
  const gapMap  = new Map()
  const dateSet = new Set()
  const pending = rows.filter(r => !isFin(r[procesoKey]))

  for (const r of pending) {
    const gap  = r[procesoKey] || '(Sin estado)'
    const site = r.site_name   || '(Sin sitio)'
    const fc   = forecasts[r.smp]
    if (!fc?.[faKey]) continue
    const d = fmtDateStr(fc[faKey])
    if (!d) continue
    dateSet.add(d)

    if (!gapMap.has(gap)) gapMap.set(gap, { dates: new Map(), sites: new Map() })
    const g = gapMap.get(gap)
    g.dates.set(d, (g.dates.get(d) || 0) + 1)

    if (!g.sites.has(site)) g.sites.set(site, { dates: new Map(), ticketCount: 0 })
    const s = g.sites.get(site)
    s.dates.set(d, (s.dates.get(d) || 0) + 1)
    if (ticketKey && r[ticketKey]) s.ticketCount++
  }

  const gapEntries = [...gapMap.entries()]
    .filter(([, g]) => g.dates.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))
  return { gapEntries, dates: [...dateSet].sort() }
}

function buildTicketTree(rows, procesoKey, ticketKey) {
  const map = new Map()
  for (const r of rows) {
    const owner = r[ticketKey]
    if (!owner) continue
    const gap  = r[procesoKey] || '(Sin estado)'
    const site = r.site_name || r.smp
    const id   = r.tickets_id ? String(r.tickets_id).trim() : null
    if (!map.has(gap)) map.set(gap, new Map())
    const gMap = map.get(gap)
    if (!gMap.has(site)) gMap.set(site, { owner, count: 0, ids: new Set() })
    const entry = gMap.get(site)
    entry.count++
    if (id) entry.ids.add(id)
  }
  return map
}

// ── Constructores de filas con estilo Nokia ───────────────────────

// Devuelve un objeto celda {value, bg, fg, bold, align, indent, size}
function C(value, opts = {}) {
  return { value, ...opts }
}

const GAP_BG   = '#DCE6F1'
const TOTAL_BG = '#003366'

function gapRows(gapTree, label, color) {
  const rows = []
  rows.push([
    C(label,                { bg: color,    fg: '#FFFFFF', bold: true }),
    C('No de Actividades',  { bg: color,    fg: '#FFFFFF', bold: true, align: 'center' }),
  ])
  let total = 0
  for (const [gap, sites] of [...gapTree.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const fin      = isFin(gap)
    const gapTotal = [...sites.values()].reduce((s, v) => s + v, 0)
    const fgGap    = fin ? '#166534' : '#C00000'
    rows.push([
      C(gap,      { bg: GAP_BG, fg: fgGap, bold: true }),
      C(gapTotal, { bg: GAP_BG, fg: fgGap, bold: true, align: 'center' }),
    ])
    for (const [site, cnt] of [...sites.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rows.push([
        C(site, { indent: 1 }),
        C(cnt,  { align: 'center' }),
      ])
    }
    total += gapTotal
  }
  rows.push([
    C('Total general', { bg: TOTAL_BG, fg: '#FFFFFF', bold: true }),
    C(total,           { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
  ])
  return rows
}

function fcRows(gapEntries, dates, label, color) {
  if (!dates.length) {
    return [
      [C(label, { bg: color, fg: '#FFFFFF', bold: true }), C('Sin fechas FC registradas', { fg: '#9ca89c' })],
    ]
  }
  const rows = []
  // Encabezado
  rows.push([
    C(label,                { bg: color,    fg: '#FFFFFF', bold: true }),
    ...dates.map(d => C(d,  { bg: color,    fg: '#FFFFFF', bold: true, align: 'center' })),
    C('TICKETS',            { bg: color,    fg: '#FFFFFF', bold: true, align: 'center' }),
    C('No de Actividades',  { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
  ])
  for (const [gap, g] of gapEntries) {
    const fin        = isFin(gap)
    const fgGap      = fin ? '#166534' : '#C00000'
    const gapTotal   = [...g.dates.values()].reduce((s, v) => s + v, 0)
    const gapTickets = [...g.sites.values()].reduce((s, v) => s + v.ticketCount, 0)
    rows.push([
      C(gap,                      { bg: GAP_BG, fg: fgGap, bold: true }),
      ...dates.map(d => C(g.dates.get(d) || null, { bg: GAP_BG, fg: fgGap, bold: true, align: 'center' })),
      C(gapTickets || null,       { bg: GAP_BG, fg: fgGap, bold: true, align: 'center' }),
      C(gapTotal,                 { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
    ])
    for (const [site, s] of [...g.sites.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const st = [...s.dates.values()].reduce((a, b) => a + b, 0)
      if (!st) continue
      rows.push([
        C(site, { indent: 1 }),
        ...dates.map(d => C(s.dates.get(d) || null, { align: 'center' })),
        C(s.ticketCount || null, { align: 'center' }),
        C(st,                    { align: 'center' }),
      ])
    }
  }
  // Total
  rows.push([
    C('Total general', { bg: TOTAL_BG, fg: '#FFFFFF', bold: true }),
    ...dates.map(d => C(
      gapEntries.reduce((s, [, g]) => s + (g.dates.get(d) || 0), 0) || null,
      { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' },
    )),
    C(gapEntries.reduce((s, [, g]) => s + [...g.sites.values()].reduce((a, v) => a + v.ticketCount, 0), 0) || null,
      { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
    C(gapEntries.reduce((s, [, g]) => s + [...g.dates.values()].reduce((a, b) => a + b, 0), 0),
      { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
  ])
  return rows
}

function ticketRows(gapTree, label, color, empresaNombre) {
  const rows = []
  rows.push([
    C(label,               { bg: color,    fg: '#FFFFFF', bold: true }),
    C('Owner',             { bg: color,    fg: '#FFFFFF', bold: true, align: 'center' }),
    C('No. Ticket',        { bg: color,    fg: '#FFFFFF', bold: true, align: 'center' }),
    C('No de Actividades', { bg: color,    fg: '#FFFFFF', bold: true, align: 'center' }),
  ])
  let total = 0
  for (const [gap, sites] of [...gapTree.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const fin      = isFin(gap)
    const fgGap    = fin ? '#166534' : '#C00000'
    const gapTotal = [...sites.values()].reduce((s, e) => s + e.count, 0)
    rows.push([
      C(gap,      { bg: GAP_BG, fg: fgGap, bold: true }),
      C('—',      { bg: GAP_BG, fg: fgGap, bold: true, align: 'center' }),
      C('—',      { bg: GAP_BG, fg: fgGap, bold: true, align: 'center' }),
      C(gapTotal, { bg: GAP_BG, fg: fgGap, bold: true, align: 'center' }),
    ])
    for (const [site, { owner, count, ids }] of [...sites.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rows.push([
        C(site,                             { indent: 1 }),
        C(resolveOwnerStr(owner, empresaNombre), { align: 'center' }),
        C([...ids].sort().join(', ') || '—',     { align: 'center' }),
        C(count,                            { align: 'center' }),
      ])
    }
    total += gapTotal
  }
  rows.push([
    C('Total general', { bg: TOTAL_BG, fg: '#FFFFFF', bold: true }),
    C('—',             { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
    C('—',             { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
    C(total,           { bg: TOTAL_BG, fg: '#FFFFFF', bold: true, align: 'center' }),
  ])
  return rows
}

// ── Escribir tabla en hoja ExcelJS ────────────────────────────────

function writeTable(sheet, tableRows, startRow, startCol) {
  tableRows.forEach((row, ri) => {
    row.forEach((cd, ci) => {
      if (cd === null || cd === undefined) return
      const cell = sheet.getCell(startRow + ri, startCol + ci)
      cell.value = cd.value ?? null

      if (cd.bg) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toARGB(cd.bg) } }
      }
      cell.font = {
        name: 'Arial',
        size: cd.size || 9,
        bold: cd.bold || false,
        color: { argb: toARGB(cd.fg || '#000000') },
      }
      if (cd.align || cd.indent) {
        cell.alignment = {
          horizontal: cd.align || 'left',
          vertical:   'middle',
          indent:     cd.indent || 0,
          wrapText:   false,
        }
      }
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFC0C0C0' } },
        left:   { style: 'thin', color: { argb: 'FFC0C0C0' } },
        bottom: { style: 'thin', color: { argb: 'FFC0C0C0' } },
        right:  { style: 'thin', color: { argb: 'FFC0C0C0' } },
      }
    })
  })
}

// Escribe dos tablas lado a lado con columna separadora vacía
function writeSideBySide(sheet, leftRows, rightRows, startRow, startCol = 1) {
  const leftW = Math.max(...leftRows.map(r => r.length), 0)
  const sep   = 1  // columna vacía entre tablas
  writeTable(sheet, leftRows,  startRow, startCol)
  writeTable(sheet, rightRows, startRow, startCol + leftW + sep)
  return Math.max(leftRows.length, rightRows.length)
}

// Escribe etiquetas de semana sobre las tablas
function writeSideHeaders(sheet, prevLabel, currLabel, row, leftW, startCol = 1) {
  const lCell = sheet.getCell(row, startCol)
  lCell.value = `Semana Anterior (${prevLabel})`
  lCell.font  = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF555555' } }

  const rCell = sheet.getCell(row, startCol + leftW + 1)
  rCell.value = `Semana Actual (${currLabel})`
  rCell.font  = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF555555' } }
}

// ── Función principal exportada ───────────────────────────────────

export async function exportAckToExcel({
  reportProcesos,
  procCfg,
  sabana,
  prevSabana,
  forecasts,
  filtro,
  currLabel,
  prevLabel,
  hasPrev,
  empresaNombre,
}) {
  const ExcelJS = (await import('exceljs')).default

  const wb     = new ExcelJS.Workbook()
  wb.creator   = 'Nokia Project Platform'
  wb.created   = new Date()

  for (const p of reportProcesos) {
    const cfg  = procCfg[p.key]
    const curr = applyFiltro(sabana,     p.key, filtro)
    const prev = applyFiltro(prevSabana, p.key, filtro)

    const sheet = wb.addWorksheet(cfg.label.substring(0, 31), {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 2, paperSize: 9 },
    })

    // Congelar primera fila
    sheet.views = [{ state: 'normal' }]

    let row = 1

    // ── Fila título del proceso ──
    const titleCell = sheet.getCell(row, 1)
    titleCell.value = `${cfg.label}${currLabel ? ` — ${currLabel}` : ''}`
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: toARGB(cfg.color) } }
    titleCell.font  = { name: 'Arial Narrow', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
    sheet.getRow(row).height = 22
    row += 2  // título + fila vacía

    // ─────────────── SECCIÓN GAP ───────────────
    if (hasPrev) {
      const pGap = gapRows(buildGapTree(prev, p.key), `${cfg.nokia} - ${prevLabel}`, cfg.color)
      const cGap = gapRows(buildGapTree(curr, p.key), `${cfg.nokia} - ${currLabel}`, cfg.color)
      writeSideHeaders(sheet, prevLabel, currLabel, row, pGap[0].length, 1)
      row++
      row += writeSideBySide(sheet, pGap, cGap, row)
    } else {
      const cGap = gapRows(buildGapTree(curr, p.key), `${cfg.nokia} - ${currLabel || 'Actual'}`, cfg.color)
      writeTable(sheet, cGap, row, 1)
      row += cGap.length
    }
    row += 2  // separador

    // ─────────────── SECCIÓN FC ───────────────
    const { gapEntries: cFcEntries, dates: cDates } = buildFcData(curr, p.key, forecasts, cfg.fa, cfg.ticket)

    if (hasPrev) {
      const { gapEntries: pFcEntries, dates: pDates } = buildFcData(prev, p.key, forecasts, cfg.fa, cfg.ticket)
      const pFc = fcRows(pFcEntries, pDates, `${cfg.nokia} - FORECAST ${prevLabel}`, cfg.color)
      const cFc = fcRows(cFcEntries, cDates, `${cfg.nokia} - FORECAST ${currLabel}`, cfg.color)
      writeSideHeaders(sheet, prevLabel, currLabel, row, pFc[0].length, 1)
      row++
      row += writeSideBySide(sheet, pFc, cFc, row)
    } else {
      const cFc = fcRows(cFcEntries, cDates, `${cfg.nokia} - FORECAST ${currLabel || 'Actual'}`, cfg.color)
      writeTable(sheet, cFc, row, 1)
      row += cFc.length
    }
    row += 2  // separador

    // ─────────────── SECCIÓN TICKETS ───────────────
    if (hasPrev) {
      const pTk = ticketRows(buildTicketTree(prev, p.key, cfg.ticket), `${cfg.nokia} - TICKET ${prevLabel}`, cfg.color, empresaNombre)
      const cTk = ticketRows(buildTicketTree(curr, p.key, cfg.ticket), `${cfg.nokia} - TICKET ${currLabel}`, cfg.color, empresaNombre)
      writeSideHeaders(sheet, prevLabel, currLabel, row, pTk[0].length, 1)
      row++
      row += writeSideBySide(sheet, pTk, cTk, row)
    } else {
      const cTk = ticketRows(buildTicketTree(curr, p.key, cfg.ticket), `${cfg.nokia} - TICKET ${currLabel || 'Actual'}`, cfg.color, empresaNombre)
      writeTable(sheet, cTk, row, 1)
      row += cTk.length
    }

    // ── Ajustar anchos de columna automáticamente ──
    sheet.columns.forEach((col, i) => {
      let maxLen = 10
      col.eachCell?.({ includeEmpty: false }, cell => {
        const len = String(cell.value ?? '').length
        if (len > maxLen) maxLen = len
      })
      col.width = Math.min(maxLen + 4, 50)
    })
  }

  // ── Descargar ──
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `ACK_Reportes_${currLabel || 'export'}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
