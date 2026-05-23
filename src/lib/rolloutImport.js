import { supabase } from './supabase'

const LS_KEY = 'rollout_nokia_data'

// Column numbers are 1-based (ExcelJS convention)
// Col 3 = Site Name, Col 9 = SMP Name, Col 10 = SMP ID
// Col 32 = SS MOS ok, Col 56 = QCP4 OK (SS Integración ok), Col 66 = SS Aceptación final ok
// Progress: MOS cols 20-31 (12 steps), Integración cols 33-55 (23 steps), Aceptación cols 57-65 (9 steps)
// Integración: if QCP4 OK (col 56) has date → force pct = 100% (cols 53-54 are optional Nokia steps)

function extractDateValue(cell) {
  if (!cell) return null
  const v = cell.value
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  return s || null
}

function countFilledRange(row, from, to) {
  let count = 0
  for (let col = from; col <= to; col++) {
    const v = row.getCell(col)?.value
    if (v !== null && v !== undefined && String(v).trim() !== '') count++
  }
  return count
}

export async function parsearRollout(file) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('No se encontró hoja en el archivo')

  // Lee encabezados de la fila 1
  const headers = {}
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value || '').trim()
  })

  // Devuelve el encabezado de la última columna con valor en el rango [from, to]
  function lastFilledHeader(row, from, to) {
    let lastCol = null
    for (let col = from; col <= to; col++) {
      const v = row.getCell(col)?.value
      if (v !== null && v !== undefined && String(v).trim() !== '') lastCol = col
    }
    return lastCol ? (headers[lastCol] || null) : null
  }

  const items = []
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return
    const rawId = row.getCell(10).value
    if (!rawId) return

    const smpId    = String(rawId).trim()
    const siteName = String(row.getCell(3).value  || '').trim()
    const smpName  = String(row.getCell(9).value  || '').trim()

    const mosSS  = extractDateValue(row.getCell(32))
    const intgSS = extractDateValue(row.getCell(56))
    const acepSS = extractDateValue(row.getCell(66))

    const mosFilled  = countFilledRange(row, 20, 31)
    const intgFilled = countFilledRange(row, 33, 55)
    const acepFilled = countFilledRange(row, 57, 65)

    items.push({
      smpId,
      siteName,
      smpName,
      mosSS,
      intgSS,
      acepSS,
      mosPct:  Math.round((mosFilled  / 12) * 100),
      intgPct: intgSS ? 100 : Math.round((intgFilled / 23) * 100),
      acepPct: Math.round((acepFilled /  9) * 100),
      mosLastCol:  lastFilledHeader(row, 20, 31),
      intgLastCol: lastFilledHeader(row, 33, 55),
      acepLastCol: lastFilledHeader(row, 57, 65),
    })
  })

  if (!items.length) throw new Error('No se encontraron SMPs en el archivo')
  return items
}

export function saveRolloutData(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), items })) } catch {}
}

export function loadRolloutData() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearRolloutData() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

// ── Supabase persistence ──────────────────────────────────────────

export async function saveRolloutToSupabase(items, uploadedBy) {
  // Borrar el upload anterior y guardar el nuevo
  await supabase.from('rollout_uploads').delete().gte('uploaded_at', '2000-01-01T00:00:00Z')
  const { error } = await supabase.from('rollout_uploads').insert({
    uploaded_by:  uploadedBy || null,
    items_count:  items.length,
    items,
  })
  if (error) throw new Error(error.message)
}

export async function loadRolloutFromSupabase() {
  const { data, error } = await supabase
    .from('rollout_uploads')
    .select('uploaded_at, uploaded_by, items_count, items')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return {
    items:      data.items,
    ts:         new Date(data.uploaded_at).getTime(),
    uploadedBy: data.uploaded_by,
  }
}

export async function clearRolloutFromSupabase() {
  await supabase.from('rollout_uploads').delete().gte('uploaded_at', '2000-01-01T00:00:00Z')
}

export async function exportarSolicitudLib(smps) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nokia Platform'
  const ws = wb.addWorksheet('Solicitud Liberación')

  ws.columns = [
    { header: 'Sitio',                  key: 'site',     width: 30 },
    { header: 'SMP ID',                 key: 'smpId',    width: 24 },
    { header: 'SMP Name',               key: 'smpName',  width: 30 },
    { header: 'SPO',                    key: 'spo',      width: 14 },
    { header: 'SS MOS ok',              key: 'mosSS',    width: 16 },
    { header: 'SS Integración ok',      key: 'intgSS',   width: 18 },
    { header: 'SS Aceptación Final ok', key: 'acepSS',   width: 22 },
    { header: 'Falta en PPA',           key: 'missing',  width: 16 },
  ]

  const hdr = ws.getRow(1)
  hdr.height = 22
  hdr.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF144E4A' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  for (const { row, missing, hitoMOS, hitoIntg, hitoAcep } of smps) {
    ws.addRow({
      site:    row.customer_site_name || row.site_reference_id,
      smpId:   row.smp_id,
      smpName: row.smp_name === 'Process_Implementation' ? row.ms_name : row.smp_name,
      spo:     row.spo_number,
      mosSS:   hitoMOS.ssDate  && hitoMOS.status  === 'pendiente' ? hitoMOS.ssDate  : '—',
      intgSS:  hitoIntg.ssDate && hitoIntg.status === 'pendiente' ? hitoIntg.ssDate : '—',
      acepSS:  hitoAcep.ssDate && hitoAcep.status === 'pendiente' ? hitoAcep.ssDate : '—',
      missing,
    })
  }

  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `solicitud_liberacion_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
