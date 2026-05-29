import { supabase } from './supabase'

const LS_KEY = 'rollout_nokia_data'

// Col 3 = Site Name, Col 9 = SMP Name, Col 10 = SMP ID (1-based)
// Col 32 = SS MOS ok, Col 56 = QCP4 OK (SS Integración ok), Col 66 = SS Aceptación final ok
// Progress: MOS cols 20-31 (12 steps), Integración cols 33-55 (23 steps), Aceptación cols 57-65 (9 steps)
// Integración: if QCP4 OK (col 56) has date → force pct = 100%

function serialToIso(n) {
  // Excel serial (integer or decimal with time fraction) → YYYY-MM-DD
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function extractDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') return serialToIso(val)
  const s = String(val).trim()
  // String that looks like an Excel serial (e.g. "46167.5367") — not a YYYY-MM-DD
  if (!/^\d{4}-/.test(s)) {
    const n = parseFloat(s)
    if (!isNaN(n) && n > 10000) return serialToIso(n)
  }
  return s.length >= 10 ? s.slice(0, 10) : (s || null)
}

function normalizeItem(item) {
  return {
    ...item,
    mosSS:  extractDate(item.mosSS),
    intgSS: extractDate(item.intgSS),
    acepSS: extractDate(item.acepSS),
  }
}

function countFilled(row, fromCol, toCol) {
  let count = 0
  for (let c = fromCol - 1; c < toCol; c++) {
    const v = row[c]
    if (v !== null && v !== undefined && String(v).trim() !== '') count++
  }
  return count
}

export async function parsearRollout(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'xlsx') throw new Error(`Formato no soportado (.${ext}). El archivo debe ser .xlsx — guárdalo desde Excel como "Libro de Excel (.xlsx)".`)

  const xlsxMod = await import('xlsx')
  const XLSX = xlsxMod.default || xlsxMod
  let wb
  try {
    const buf = await file.arrayBuffer()
    wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })
  } catch {
    throw new Error('No se pudo leer el archivo. Verifica que sea un .xlsx válido y no esté protegido con contraseña.')
  }

  if (!wb.SheetNames.length) throw new Error('No se encontró hoja en el archivo')
  const ws = wb.Sheets[wb.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  if (allRows.length < 2) throw new Error('No se encontraron SMPs en el archivo')

  const headerRow = allRows[0]

  function lastFilledHeader(row, fromCol, toCol) {
    let lastIdx = null
    for (let c = fromCol - 1; c < toCol; c++) {
      const v = row[c]
      if (v !== null && v !== undefined && String(v).trim() !== '') lastIdx = c
    }
    return lastIdx !== null ? (headerRow[lastIdx] || null) : null
  }

  const items = []
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i]
    const rawId = row[9]   // col 10
    if (!rawId) continue

    const smpId    = String(rawId).trim()
    const siteName = String(row[2] || '').trim()   // col 3
    const smpName  = String(row[8] || '').trim()   // col 9

    const mosSS  = extractDate(row[31])  // col 32
    const intgSS = extractDate(row[55])  // col 56
    const acepSS = extractDate(row[65])  // col 66

    const mosFilled  = countFilled(row, 20, 31)
    const intgFilled = countFilled(row, 33, 55)
    const acepFilled = countFilled(row, 57, 65)

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
  }

  if (!items.length) throw new Error('No se encontraron SMPs en el archivo')
  return items
}

export function saveRolloutData(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), items })) } catch {}
}

export function loadRolloutData() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.items) parsed.items = parsed.items.map(normalizeItem)
    return parsed
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
    items:      (data.items || []).map(normalizeItem),
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
