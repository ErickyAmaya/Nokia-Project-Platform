import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'

const URL = 'https://tvlskyihhxfnxfgifilk.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!KEY) {
  console.error('Falta SUPABASE_SERVICE_KEY en el entorno. Ej: SUPABASE_SERVICE_KEY=xxx node scripts/backfill_descripcion_libre.mjs')
  process.exit(1)
}

const db = createClient(URL, KEY)

// pdfjs-dist (build legacy, compatible con Node sin worker de browser)
const require = createRequire(import.meta.url)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js')

async function extractText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(it => it.str).join(' ') + '\n'
  }
  return text
}

// Misma lógica que src/lib/pdfParser.js (descripcion_libre) — duplicada
// porque ese archivo usa imports `?url` específicos de Vite, no válidos en Node plano.
function extractDescripcionLibre(text) {
  const ftMatch  = text.match(/Free Text[:\s]+([^\n]+?)(?:\s{2,}|Pls Add|Customer reference|Sales Order|\n)/i)
  const freeText = ftMatch?.[1]?.trim() || ''
  let descripcionLibre = ''
  const smpMatchInFt = freeText.match(/SMP-WO-\d+/i)
  if (smpMatchInFt) {
    let rest = freeText.slice(smpMatchInFt.index + smpMatchInFt[0].length)
    // PO de "Extra Works"/CR: el texto tras el SMP no es una frase descriptiva
    // sino más campos pegados (ACC Indicator, CR ID, etc.) — no hay nada útil que extraer.
    if (!/ACC Indicator/i.test(rest)) {
      rest = rest.replace(/INGETELPROJECT.*$/i, '')
      descripcionLibre = rest.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  return descripcionLibre
}

async function main() {
  console.log('Consultando POs sin descripción...')
  const { data: pos, error } = await db
    .from('fact_pos')
    .select('id, spo_number, pdf_url, pci_description, descripcion_libre')
    .or('pci_description.is.null,pci_description.eq.')
    .or('descripcion_libre.is.null,descripcion_libre.eq.')
    .not('pdf_url', 'is', null)

  if (error) { console.error('Error consultando fact_pos:', error.message); process.exit(1) }

  const targets = (pos || []).filter(p => !p.pci_description && !p.descripcion_libre)
  console.log(`Encontradas ${targets.length} POs a procesar.\n`)

  let ok = 0, sinTexto = 0, fallidas = 0
  const fallos = []

  for (const [i, po] of targets.entries()) {
    process.stdout.write(`[${i + 1}/${targets.length}] SPO ${po.spo_number}... `)
    try {
      const res = await fetch(po.pdf_url)
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar PDF`)
      const buf  = await res.arrayBuffer()
      const text = await extractText(buf)
      const desc = extractDescripcionLibre(text)

      if (!desc) {
        console.log('sin coincidencia (texto libre vacío o sin SMP)')
        sinTexto++
        continue
      }

      const { error: upErr } = await db
        .from('fact_pos')
        .update({ descripcion_libre: desc })
        .eq('id', po.id)
      if (upErr) throw upErr

      console.log(`OK → "${desc}"`)
      ok++
    } catch (e) {
      console.log('FALLÓ: ' + e.message)
      fallidas++
      fallos.push({ spo: po.spo_number, error: e.message })
    }
  }

  console.log('\n── RESUMEN ───────────────────────────────────────────')
  console.log(`Actualizadas:        ${ok}`)
  console.log(`Sin coincidencia:    ${sinTexto}`)
  console.log(`Fallidas:            ${fallidas}`)
  if (fallos.length > 0) {
    console.log('\nDetalle de fallidas:')
    fallos.forEach(f => console.log(`  SPO ${f.spo}: ${f.error}`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
