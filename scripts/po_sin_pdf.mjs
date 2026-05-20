import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { fileURLToPath } from 'url'
import path from 'path'

const URL  = 'https://tvlskyihhxfnxfgifilk.supabase.co'
const KEY  = process.env.SUPABASE_SERVICE_KEY || ''

const db = createClient(URL, KEY)

async function main() {
  console.log('Consultando Supabase...')

  const [ppaRes, posRes] = await Promise.all([
    db.from('fact_ppa').select('spo_number, customer_site_name, site_reference_id, smp_id, smp_name, ms_name'),
    db.from('fact_pos').select('spo_number, pdf_url, valor'),
  ])

  if (ppaRes.error) { console.error('Error PPA:', ppaRes.error.message); process.exit(1) }
  if (posRes.error) { console.error('Error POS:', posRes.error.message); process.exit(1) }

  const ppa = ppaRes.data || []
  const pos = posRes.data || []

  // Mapa de SPO → datos de PO
  const posMap = new Map(pos.map(p => [p.spo_number, p]))

  // Deduplicar SPOs del PPA (una SPO puede tener varias filas)
  const spoSeen = new Map()
  for (const row of ppa) {
    if (!row.spo_number) continue
    if (!spoSeen.has(row.spo_number)) {
      spoSeen.set(row.spo_number, {
        spo:   row.spo_number,
        sitio: row.customer_site_name || row.site_reference_id || '',
        smpId: row.smp_id  || '',
        smp:   row.smp_name === 'Process_Implementation' ? row.ms_name : (row.smp_name || ''),
      })
    }
  }

  // Filtrar: SPOs sin pdf_url en fact_pos
  const sinPdf = []
  for (const [spo, info] of spoSeen) {
    const poData = posMap.get(spo)
    if (!poData) {
      sinPdf.push({ ...info, estado: 'Sin PO cargada' })
    } else if (!poData.pdf_url) {
      sinPdf.push({ ...info, estado: 'Sin PDF' })
    }
  }

  sinPdf.sort((a, b) => a.sitio.localeCompare(b.sitio) || a.spo.localeCompare(b.spo))

  console.log(`\nTotal SPOs en PPA:       ${spoSeen.size}`)
  console.log(`SPOs con PDF cargado:    ${spoSeen.size - sinPdf.length}`)
  console.log(`SPOs sin PDF:            ${sinPdf.length}\n`)

  if (!sinPdf.length) {
    console.log('✓ Todas las POs del PPA tienen PDF cargado.')
    return
  }

  // Generar Excel
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nokia Platform'
  const ws = wb.addWorksheet('POs sin PDF')

  ws.columns = [
    { header: 'Sitio',       key: 'sitio', width: 36 },
    { header: 'SMP ID',      key: 'smpId', width: 22 },
    { header: 'SMP / MS Name', key: 'smp', width: 32 },
    { header: 'SPO Number',  key: 'spo',   width: 20 },
    { header: 'Estado',      key: 'estado',width: 18 },
  ]

  // Encabezado
  const hdr = ws.getRow(1)
  hdr.height = 22
  hdr.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FFFCD34D' } } }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  for (const row of sinPdf) {
    const r = ws.addRow(row)
    // Color por estado
    const estadoCell = r.getCell('estado')
    if (row.estado === 'Sin PO cargada') {
      estadoCell.font = { bold: true, color: { argb: 'FF991B1B' } }
    } else {
      estadoCell.font = { bold: true, color: { argb: 'FFB45309' } }
    }
  }

  // Fila de total
  ws.addRow({})
  const totRow = ws.addRow({ sitio: `TOTAL: ${sinPdf.length} SPOs sin PDF` })
  totRow.getCell('sitio').font = { bold: true, size: 11 }

  const __dir = path.dirname(fileURLToPath(import.meta.url))
  const outPath = path.join(__dir, `po_sin_pdf_${new Date().toISOString().slice(0,10)}.xlsx`)
  await wb.xlsx.writeFile(outPath)
  console.log(`✓ Archivo generado: ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
