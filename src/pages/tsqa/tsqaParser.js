import * as XLSX from 'xlsx'

function parseCoords(raw) {
  if (!raw || typeof raw !== 'string') return null
  const m = raw.match(/[Nn]\s*([\d.]+)[,\s]+[Ww]\s*(-?[\d.]+)/)
  if (!m) return null
  const lat    = parseFloat(m[1])
  const lonRaw = parseFloat(m[2])
  const lon    = lonRaw > 0 ? -lonRaw : lonRaw
  return isNaN(lat) || isNaN(lon) ? null : { lat, lon }
}

function groupByModel(modelMap) {
  const counts = {}
  for (const model of Object.values(modelMap)) {
    if (!model) continue
    const k = String(model).trim().toUpperCase()
    counts[k] = (counts[k] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({ model, count }))
}

function parseCargaTorre(torre) {
  if (!torre?.length) return null

  // Find section-header rows by scanning all cells in each row
  let antRow = -1, rfRow = -1
  for (let r = 0; r < torre.length; r++) {
    const txt = (torre[r] || []).slice(0, 30)
      .map(c => String(c || '').toUpperCase()).join(' ')
    if (antRow < 0 && txt.includes('ANTENAS A INSTALAR')) antRow = r
    if (rfRow  < 0 && txt.includes('EQUIPOS A INSTALAR')) rfRow  = r
    if (antRow >= 0 && rfRow >= 0) break
  }
  if (antRow < 0 && rfRow < 0) return null

  // Col P = index 15. Scan [start, end) collecting quantities and models.
  const extractSection = (start, end) => {
    const items = []
    for (let r = start; r < Math.min(end, torre.length); r++) {
      const row  = torre[r] || []
      const pVal = row[15]
      if (pVal == null || pVal === '') continue
      if (typeof pVal === 'number' && pVal > 0) {
        // qty in col P — look for model description in surrounding cols
        const model = [...row.slice(10, 15), ...row.slice(16, 22)]
          .map(v => String(v || '').trim())
          .find(v => v.length > 3 && !/^\d+$/.test(v)) || null
        items.push({ count: Math.round(pVal), model })
      } else if (typeof pVal === 'string' && pVal.trim().length > 1) {
        items.push({ count: 1, model: pVal.trim() })
      }
    }
    return items
  }

  const antEnd = rfRow > antRow && rfRow >= 0 ? rfRow : antRow + 30
  const rfEnd  = rfRow >= 0 ? rfRow + 30 : 0

  const antennas = antRow >= 0 ? extractSection(antRow, antEnd) : []
  const rf       = rfRow  >= 0 ? extractSection(rfRow,  rfEnd)  : []

  return {
    antennas,
    rf,
    antTotal: antennas.reduce((s, i) => s + i.count, 0),
    rfTotal:  rf.reduce((s, i) => s + i.count, 0),
  }
}

function extractFpfh(rows) {
  const seen = new Set()
  const re = /FPFH[\w_-]*/gi
  for (let r = 90; r < Math.min(135, rows.length); r++) {
    for (const cell of (rows[r] || [])) {
      if (!cell || typeof cell !== 'string') continue
      const ms = cell.match(re)
      if (ms) ms.forEach(m => seen.add(m.toUpperCase()))
    }
  }
  return [...seen]
}

function parsePower(pow) {
  const items = []
  let comentarios = null

  // ── ESTADO ACTUAL POWER SITIO ──────────────────────────────────────
  // Row pairs: main row = name + Consumo[Medido](idx5) + Operativos(idx8/9) + Consumo Futuro(idx13)
  //            next row = En falla(idx8) + count(idx9)
  for (let r = 0; r < pow.length - 2; r++) {
    const lbl = String(pow[r]?.[3] || '').toUpperCase()
    if (!lbl.includes('ESTADO ACTUAL POWER SITIO')) continue

    // Find header row (EQUIPO POWER)
    let hdr = -1
    for (let k = r + 1; k < Math.min(r + 5, pow.length); k++) {
      if (String(pow[k]?.[3] || '').toUpperCase().includes('EQUIPO POWER')) { hdr = k; break }
    }
    if (hdr < 0) break

    for (let d = hdr + 1; d < Math.min(hdr + 24, pow.length); d++) {
      const row  = pow[d] || []
      const name = row[3]
      // Stop at totals row
      if (name && typeof name === 'string' && /^(ACTUAL|FUTURO)$/i.test(String(name).trim())) break
      // Skip empty slots (no name or name is 0)
      if (!name || name === 0 || typeof name !== 'string') continue

      const isOper  = String(row[8]  || '').toUpperCase().includes('OPERATIV')
      const operativos    = isOper ? (row[9]  ?? null) : null
      const operativosPr  = isOper ? (row[15] ?? null) : null   // idx 15 = PROYECCION operativos

      const nextRow = pow[d + 1] || []
      const isFalla = String(nextRow[8] || '').toUpperCase().includes('EN FALLA')
      const enFalla   = isFalla ? (nextRow[9]  ?? null) : null
      const enFallaPr = isFalla ? (nextRow[15] ?? null) : null  // idx 15 = PROYECCION en falla

      const consumoActual = typeof row[5] === 'number' ? Math.round(row[5]) : null
      const rawFuturo     = row[13]
      const consumoFuturo = rawFuturo != null && rawFuturo !== 0
        ? Math.round(parseFloat(String(rawFuturo).replace(',', '.'))) || null
        : null

      items.push({ nombre: String(name).trim(), operativos, operativosPr, enFalla, enFallaPr, consumoActual, consumoFuturo })
      if (enFalla !== null) d++ // skip the "En falla" sub-row
    }
    break
  }

  // ── FPFH PROYECCION (instalar / reubicar) ─────────────────────────
  // Names row: idx 24, 32, 40, 48 — state row (next): same cols = NUEVO/REUSADO
  const fpfhInstalar = []
  const fpfhReubicar = []
  const FPFH_COLS    = [24, 32, 40, 48]

  for (let r = 0; r < pow.length - 1; r++) {
    const lbl = String(pow[r]?.[23] || '').toUpperCase().trim()
    if (!lbl.includes('FPFH') || !lbl.includes('PROYECCION')) continue
    for (let k = r + 1; k < Math.min(r + 10, pow.length); k++) {
      const row  = pow[k] || []
      if (!FPFH_COLS.some(c => row[c] && /FPFH/i.test(String(row[c])))) continue
      const stateRow = pow[k + 1] || []
      for (const c of FPFH_COLS) {
        const name  = row[c]
        if (!name || !/FPFH/i.test(String(name))) continue
        const state = String(stateRow[c] || '').toUpperCase().trim()
        ;(state === 'REUSADO' ? fpfhReubicar : fpfhInstalar).push(String(name).trim())
      }
      break
    }
    break
  }

  // ── COMENTARIOS ESTADO DEL POWER Y BREAKERS ───────────────────────
  for (let r = 0; r < pow.length - 1; r++) {
    const lbl = String(pow[r]?.[3] || '').toUpperCase()
    if (!lbl.includes('COMENTARIOS ESTADO DEL POWER')) continue
    for (let k = r + 1; k < Math.min(r + 6, pow.length); k++) {
      const txt = pow[k]?.[3]
      if (txt && typeof txt === 'string' && txt.trim().length > 10) {
        comentarios = txt.replace(/\n/g, ' ').trim()
        break
      }
    }
    break
  }

  return { items, fpfhInstalar, fpfhReubicar, comentarios }
}

export function parseTssFile(buffer, filename) {
  let wb
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    return null
  }

  const rfSheet    = wb.Sheets['DATOS RF']
  const cwSheet    = wb.Sheets['SOLICITUD CW SOLUCION']
  const powSheet   = wb.Sheets['DATOS POWER']
  const torreSheet = wb.Sheets['CARGA EN TORRE']
  if (!rfSheet) return null

  const rf    = XLSX.utils.sheet_to_json(rfSheet,    { header: 1, defval: null })
  const cw    = cwSheet    ? XLSX.utils.sheet_to_json(cwSheet,    { header: 1, defval: null }) : []
  const pow   = powSheet   ? XLSX.utils.sheet_to_json(powSheet,   { header: 1, defval: null }) : []
  const torre = torreSheet ? XLSX.utils.sheet_to_json(torreSheet, { header: 1, defval: null }) : []

  // SMP-WO from filename
  const smpMatch = filename.match(/SMP-WO-\d+/)
  const smpWo    = smpMatch ? smpMatch[0] : null

  // ── Header (DATOS RF) ──────────────────────────────────────────────
  const siteName      = rf[5]?.[1]
  const coordsRaw     = rf[6]?.[1]
  const address       = rf[7]?.[1]
  const siteType      = rf[8]?.[1]
  const dateCel       = rf[15]?.[79]
  const towerType     = rf[16]?.[79]
  const towerHeight   = rf[17]?.[79]
  const subcontractor = rf[18]?.[79]

  const coords = parseCoords(String(coordsRaw || ''))

  // ── Special access equipment (rows 12-22 → idx 11-21) ─────────────
  const specialAccess = []
  for (let r = 11; r <= 21; r++) {
    const equip = rf[r]?.[13]
    const val   = rf[r]?.[15]
    if (equip && String(val || '').toUpperCase().trim() === 'SI')
      specialAccess.push(String(equip).trim())
  }
  const accessObs = rf[13]?.[20] ? String(rf[13][20]).trim() : null

  // ── RF / Antenna extraction (data rows 53+ → idx 52+) ─────────────
  const eaRfModels  = {}
  const eaAntModels = {}
  const prRfInst    = {}
  const prRfReloc   = {}
  const prAntInst   = {}
  const prAntReloc  = {}

  for (let r = 52; r < rf.length; r++) {
    const row = rf[r]
    if (!row) continue

    if (row[1] && row[3] && row[12]) {
      const id = row[3]
      if (!eaRfModels[id]) eaRfModels[id] = String(row[12]).trim().toUpperCase()
    }
    if (row[1] && row[2] && row[5]) {
      const id = row[2]
      if (!eaAntModels[id]) eaAntModels[id] = String(row[5]).trim()
    }
    if (row[20] && row[22] && row[32]) {
      const id   = row[22]
      const mod  = String(row[32]).trim().toUpperCase()
      const orig = String(row[33] || '').trim().toUpperCase()
      if (orig === 'NUEVO')        { if (!prRfInst[id]  && !prRfReloc[id]) prRfInst[id]  = mod }
      else if (orig === 'REUSADO') { if (!prRfReloc[id]) prRfReloc[id] = mod }
      else if (!prRfInst[id] && !prRfReloc[id]) prRfInst[id] = mod
    }
    if (row[20] && row[21] && row[24]) {
      const id   = row[21]
      const mod  = String(row[24]).trim()
      const orig = String(row[25] || '').trim().toUpperCase()
      if (orig === 'NUEVO')        { if (!prAntInst[id]  && !prAntReloc[id]) prAntInst[id]  = mod }
      else if (orig === 'REUSADO') { if (!prAntReloc[id]) prAntReloc[id] = mod }
      else if (!prAntInst[id] && !prAntReloc[id]) prAntInst[id] = mod
    }
  }

  const fpfhModels  = extractFpfh(rf)
  const cargaTorre  = parseCargaTorre(torre)

  // ── CW header (SOLICITUD CW SOLUCION) ─────────────────────────────
  // F6:G8 merged → value at F6; AF6:AG8 merged → value at AF6
  // Use direct cell access (most reliable with merged cells in SheetJS)
  const cwCell = addr => cwSheet?.[addr]?.v ?? null
  let cwRequerida  = cwCell('F6')  != null ? String(cwCell('F6') ).toUpperCase().trim() || null : null
  let cwEnConjunto = cwCell('AF6') != null ? String(cwCell('AF6')).toUpperCase().trim() || null : null

  // Fallback: scan rows 5-7 searching by label if direct access missed
  if (!cwRequerida || !cwEnConjunto) {
    for (let r = 5; r <= 7 && (!cwRequerida || !cwEnConjunto); r++) {
      const row = cw[r] || []
      for (let c = 0; c < row.length - 1; c++) {
        if (row[c] == null) continue
        const lbl = String(row[c]).toUpperCase()
        if (!cwRequerida && lbl.includes('REQUIERE CW')) {
          for (let k = c + 1; k < row.length; k++) {
            if (row[k] != null) { cwRequerida = String(row[k]).toUpperCase().trim() || null; break }
          }
        }
        if (!cwEnConjunto && lbl.includes('CONJUNTO')) {
          for (let k = c + 1; k < row.length; k++) {
            if (row[k] != null) { cwEnConjunto = String(row[k]).toUpperCase().trim() || null; break }
          }
        }
      }
    }
  }

  // ── CW trabajos (SOPORTES ANTENA section) ─────────────────────────
  const cwTrabajo = []
  let inSoportes  = false
  let currentTipo = null
  for (let r = 0; r < cw.length; r++) {
    const row = cw[r] || []
    const b   = String(row[1] || '').toUpperCase().trim()
    if (!inSoportes) {
      if (b.includes('SOPORTES ANTENA')) inSoportes = true
      continue
    }
    if (b === 'N/A' || b.includes('POLE SM') || b.includes('MODIFICACIONES ADICIONALES') || b.includes('ESCALERILLA')) break
    const col5  = row[5]
    const col14 = String(row[14] || '').toUpperCase().trim()
    if (!col5) continue
    const s = String(col5).trim()
    if (col14 === 'ESTADO') {
      currentTipo = s
    } else if (s.length > 30 && currentTipo) {
      cwTrabajo.push({ tipo: currentTipo, descripcion: s })
      currentTipo = null
    }
  }

  // ── Energía / Power (DATOS POWER) ─────────────────────────────────
  const energia = parsePower(pow)

  // ── Date ──────────────────────────────────────────────────────────
  let date = null
  if (dateCel instanceof Date) date = dateCel
  else if (dateCel) { const d = new Date(dateCel); if (!isNaN(d)) date = d }

  return {
    id:            smpWo || filename,
    filename,
    smpWo,
    siteName:      siteName     ? String(siteName).trim()                           : filename.split('_')[0],
    coords,
    address:       address      ? String(address).trim()                            : null,
    siteType:      siteType     ? String(siteType).replace(/SITIO\s*/i, '').trim() : null,
    date,
    towerType:     towerType    ? String(towerType).trim()                          : null,
    towerHeight,
    subcontractor: subcontractor ? String(subcontractor).trim()                     : null,
    specialAccess,
    accessObs,
    fpfhModels,
    cargaTorre,
    cw:  { requerida: cwRequerida, enConjunto: cwEnConjunto, trabajos: cwTrabajo },
    energia,
    rf: {
      desmontar:      groupByModel(eaRfModels),
      instalar:       groupByModel(prRfInst),
      reubicar:       groupByModel(prRfReloc),
      totalDesmontar: Object.keys(eaRfModels).length,
      totalInstalar:  Object.keys(prRfInst).length,
      totalReubicar:  Object.keys(prRfReloc).length,
    },
    ant: {
      desmontar:      groupByModel(eaAntModels),
      instalar:       groupByModel(prAntInst),
      reubicar:       groupByModel(prAntReloc),
      totalDesmontar: Object.keys(eaAntModels).length,
      totalInstalar:  Object.keys(prAntInst).length,
      totalReubicar:  Object.keys(prAntReloc).length,
    },
  }
}
