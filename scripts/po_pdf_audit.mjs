import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { fileURLToPath } from 'url'
import path from 'path'

const URL = 'https://tvlskyihhxfnxfgifilk.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY || ''

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

  // ── 1. Mapa de SPO → datos PPA (una fila representativa por SPO) ──
  const ppaMap = new Map()
  for (const row of ppa) {
    if (!row.spo_number || ppaMap.has(row.spo_number)) continue
    ppaMap.set(row.spo_number, {
      sitio: row.customer_site_name || row.site_reference_id || '',
      smp:   row.smp_name === 'Process_Implementation' ? row.ms_name : (row.smp_name || ''),
    })
  }

  // ── 2. Analizar fact_pos: agrupar por pdf_url ──────────────────────
  const posConPdf    = pos.filter(p => p.pdf_url)
  const posSinPdf    = pos.filter(p => !p.pdf_url)

  // pdf_url → lista de spo_numbers que lo usan
  const pdfToSpos = new Map()
  for (const p of posConPdf) {
    if (!pdfToSpos.has(p.pdf_url)) pdfToSpos.set(p.pdf_url, [])
    pdfToSpos.get(p.pdf_url).push(p.spo_number)
  }

  const pdfsUnicos      = pdfToSpos.size
  const pdfsCompartidos = [...pdfToSpos.values()].filter(spos => spos.length > 1)
  const sposCompartidos = new Set(pdfsCompartidos.flat())

  // ── 3. SPOs del PPA sin PDF real ───────────────────────────────────
  const posMap = new Map(pos.map(p => [p.spo_number, p]))
  const sinPdfReal = []
  for (const [spo, info] of ppaMap) {
    const po = posMap.get(spo)
    const sinPO      = !po
    const sinPdfUrl  = po && !po.pdf_url
    const compartido = po?.pdf_url && sposCompartidos.has(spo)
    if (sinPO || sinPdfUrl || compartido) {
      sinPdfReal.push({
        spo,
        sitio:  info.sitio,
        smp:    info.smp,
        estado: sinPO ? 'Sin PO cargada' : sinPdfUrl ? 'Sin PDF' : 'PDF compartido',
      })
    }
  }
  sinPdfReal.sort((a, b) => a.estado.localeCompare(b.estado) || a.sitio.localeCompare(b.sitio))

  // ── 4. Consola ─────────────────────────────────────────────────────
  console.log('\n── RESUMEN ───────────────────────────────────────────')
  console.log(`SPOs únicas en PPA:           ${ppaMap.size}`)
  console.log(`Entradas en fact_pos:          ${pos.length}`)
  console.log(`  Con pdf_url:                 ${posConPdf.length}`)
  console.log(`  Sin pdf_url:                 ${posSinPdf.length}`)
  console.log(`Archivos PDF únicos:           ${pdfsUnicos}`)
  console.log(`PDFs compartidos (≥2 SPOs):    ${pdfsCompartidos.length}`)
  console.log(`SPOs afectadas por compartido: ${sposCompartidos.size}`)
  console.log(`\nSPOs sin PDF real:             ${sinPdfReal.length}`)
  console.log(`  Sin PO cargada:              ${sinPdfReal.filter(r => r.estado === 'Sin PO cargada').length}`)
  console.log(`  Sin PDF:                     ${sinPdfReal.filter(r => r.estado === 'Sin PDF').length}`)
  console.log(`  PDF compartido:              ${sinPdfReal.filter(r => r.estado === 'PDF compartido').length}`)

  if (pdfsCompartidos.length > 0) {
    console.log('\n── PDFs COMPARTIDOS (muestra, máx 10) ────────────────')
    for (const spos of pdfsCompartidos.slice(0, 10)) {
      console.log(`  ${spos.length} SPOs comparten 1 PDF: ${spos.join(', ')}`)
    }
  }

  // ── 5. Excel ───────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nokia Platform'

  // Hoja 1: SPOs sin PDF real
  const ws1 = wb.addWorksheet('SPOs sin PDF real')
  ws1.columns = [
    { header: 'Estado',        key: 'estado', width: 20 },
    { header: 'SPO Number',    key: 'spo',    width: 22 },
    { header: 'Sitio',         key: 'sitio',  width: 36 },
    { header: 'SMP / MS Name', key: 'smp',    width: 32 },
  ]
  const hdr1 = ws1.getRow(1)
  hdr1.height = 22
  hdr1.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  ws1.views = [{ state: 'frozen', ySplit: 1 }]
  for (const row of sinPdfReal) {
    const r = ws1.addRow(row)
    const color = row.estado === 'Sin PO cargada' ? 'FF991B1B'
                : row.estado === 'PDF compartido'  ? 'FF7C3AED'
                :                                    'FFB45309'
    r.getCell('estado').font = { bold: true, color: { argb: color } }
  }

  // Hoja 2: PDFs compartidos (detalle)
  if (pdfsCompartidos.length > 0) {
    const ws2 = wb.addWorksheet('PDFs compartidos')
    ws2.columns = [
      { header: 'SPO Number', key: 'spo',   width: 22 },
      { header: 'Sitio',      key: 'sitio', width: 36 },
      { header: 'PDF URL',    key: 'pdf',   width: 60 },
    ]
    const hdr2 = ws2.getRow(1)
    hdr2.height = 22
    hdr2.eachCell(cell => {
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    ws2.views = [{ state: 'frozen', ySplit: 1 }]
    for (const [pdfUrl, spos] of pdfToSpos) {
      if (spos.length < 2) continue
      for (const spo of spos) {
        const info = ppaMap.get(spo) || {}
        ws2.addRow({ spo, sitio: info.sitio || '', pdf: pdfUrl })
      }
      ws2.addRow({}) // separador visual
    }
  }

  const __dir  = path.dirname(fileURLToPath(import.meta.url))
  const outPath = path.join(__dir, `po_pdf_audit_${new Date().toISOString().slice(0,10)}.xlsx`)
  await wb.xlsx.writeFile(outPath)
  console.log(`\n✓ Excel generado: ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
