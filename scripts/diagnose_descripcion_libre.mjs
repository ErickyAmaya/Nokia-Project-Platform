import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'

const URL = 'https://tvlskyihhxfnxfgifilk.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!KEY) {
  console.error('Falta SUPABASE_SERVICE_KEY en el entorno. Ej: SUPABASE_SERVICE_KEY=xxx node scripts/diagnose_descripcion_libre.mjs')
  process.exit(1)
}

const db = createClient(URL, KEY)

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

// Solo lectura — no actualiza nada. Muestra qué encuentra el parser para
// las POs que quedaron "sin coincidencia" en el backfill.
// Uso:
//   node scripts/diagnose_descripcion_libre.mjs 20            → revisa 20 pendientes
//   node scripts/diagnose_descripcion_libre.mjs --spo 51647133 → dump completo de 1 SPO
//   node scripts/diagnose_descripcion_libre.mjs --stats        → tally de TODAS las pendientes
const spoArgIdx = process.argv.indexOf('--spo')
const SPO_FILTER = spoArgIdx >= 0 ? process.argv[spoArgIdx + 1] : null
const STATS = process.argv.includes('--stats')
const bucketArgIdx = process.argv.indexOf('--bucket')
const BUCKET = bucketArgIdx >= 0 ? process.argv[bucketArgIdx + 1] : null // 'sinsmp' | 'otro'
const LIMIT = parseInt(process.argv[2] || '20', 10)

async function main() {
  console.log('Consultando POs...')
  const query = db.from('fact_pos').select('id, spo_number, pdf_url, pci_description, descripcion_libre')
  const { data: pos, error } = SPO_FILTER
    ? await query.eq('spo_number', SPO_FILTER)
    : await query.or('pci_description.is.null,pci_description.eq.')
        .or('descripcion_libre.is.null,descripcion_libre.eq.')
        .not('pdf_url', 'is', null)

  if (error) { console.error('Error consultando fact_pos:', error.message); process.exit(1) }

  const pendientes = (pos || []).filter(p => !p.pci_description && !p.descripcion_libre)
  const targets = SPO_FILTER ? (pos || []) : pendientes.slice(0, STATS ? pendientes.length : LIMIT)
  console.log(`Diagnosticando ${targets.length} PO(s).\n`)

  if (SPO_FILTER) {
    for (const po of targets) {
      console.log(`── SPO ${po.spo_number} — TEXTO COMPLETO ──────────────`)
      const res  = await fetch(po.pdf_url)
      const buf  = await res.arrayBuffer()
      const text = await extractText(buf)
      console.log(text)
    }
    return
  }

  if (STATS) {
    const tally = { sinFreeTextLabel: 0, sinSmpWo: 0, extraWorksCr: 0, otroSinExtraer: 0, errores: 0 }
    for (const [i, po] of targets.entries()) {
      if ((i + 1) % 25 === 0) process.stderr.write(`  ...${i + 1}/${targets.length}\n`)
      try {
        const res = await fetch(po.pdf_url)
        if (!res.ok) { tally.errores++; continue }
        const buf  = await res.arrayBuffer()
        const text = await extractText(buf)
        const ftMatch = text.match(/Free Text[:\s]+([^\n]+?)(?:\s{2,}|Pls Add|Customer reference|Sales Order|\n)/i)
        if (!ftMatch) { tally.sinFreeTextLabel++; continue }
        const freeText = ftMatch[1].trim()
        const smpMatchInFt = freeText.match(/SMP-WO-\d+/i)
        if (!smpMatchInFt) { tally.sinSmpWo++; continue }
        const rest = freeText.slice(smpMatchInFt.index + smpMatchInFt[0].length)
        if (/ACC Indicator/i.test(rest)) { tally.extraWorksCr++; continue }
        tally.otroSinExtraer++
      } catch (e) {
        tally.errores++
      }
    }
    console.log('\n── TALLY ─────────────────────────────────────────────')
    console.log(`Sin etiqueta "Free Text:" en el PDF:   ${tally.sinFreeTextLabel}`)
    console.log(`Free Text sin SMP-WO dentro:            ${tally.sinSmpWo}`)
    console.log(`Tipo Extra Works/CR (omitido a propósito): ${tally.extraWorksCr}`)
    console.log(`Otro caso sin extraer (revisar):        ${tally.otroSinExtraer}`)
    console.log(`Errores de descarga/parseo:              ${tally.errores}`)
    return
  }

  if (BUCKET) {
    let shown = 0
    for (const po of pendientes) {
      if (shown >= LIMIT) break
      try {
        const res = await fetch(po.pdf_url)
        if (!res.ok) continue
        const buf  = await res.arrayBuffer()
        const text = await extractText(buf)
        const ftMatch = text.match(/Free Text[:\s]+([^\n]+?)(?:\s{2,}|Pls Add|Customer reference|Sales Order|\n)/i)
        if (!ftMatch) continue
        const freeText = ftMatch[1].trim()
        const smpMatchInFt = freeText.match(/SMP-WO-\d+/i)

        if (BUCKET === 'sinsmp' && smpMatchInFt) continue
        if (BUCKET === 'sinsmp') {
          console.log(`── SPO ${po.spo_number} ──`)
          console.log(`  Free Text: "${freeText}"`)
          shown++
          continue
        }

        if (!smpMatchInFt) continue
        const rest = freeText.slice(smpMatchInFt.index + smpMatchInFt[0].length)
        if (/ACC Indicator/i.test(rest)) continue
        if (BUCKET === 'otro') {
          console.log(`── SPO ${po.spo_number} ──`)
          console.log(`  Free Text: "${freeText}"`)
          console.log(`  Rest tras SMP: "${rest}"`)
          shown++
        }
      } catch { /* ignore */ }
    }
    console.log(`\n(${shown} mostradas)`)
    return
  }

  for (const po of targets) {
    console.log(`── SPO ${po.spo_number} ──────────────────────────────`)
    try {
      const res = await fetch(po.pdf_url)
      if (!res.ok) { console.log(`  HTTP ${res.status} al descargar PDF`); continue }
      const buf  = await res.arrayBuffer()
      const text = await extractText(buf)

      const ftMatch = text.match(/Free Text[:\s]+([^\n]+?)(?:\s{2,}|Pls Add|Customer reference|Sales Order|\n)/i)
      if (!ftMatch) {
        const hasFreeTextWord = /Free Text/i.test(text)
        console.log(`  "Free Text:" ${hasFreeTextWord ? 'aparece en el texto pero el regex no capturó nada' : 'NO aparece en el texto del PDF'}`)
        if (hasFreeTextWord) {
          const idx = text.search(/Free Text/i)
          console.log(`  Contexto crudo: ...${text.slice(idx, idx + 150).replace(/\s+/g, ' ')}...`)
        }
        continue
      }
      const freeText = ftMatch[1].trim()
      console.log(`  Free Text capturado: "${freeText}"`)
      const hasSmp = /SMP-WO-\d+/i.test(freeText)
      console.log(`  ¿Contiene SMP-WO-...? ${hasSmp ? 'sí' : 'NO — por eso no se generó descripción'}`)
    } catch (e) {
      console.log('  ERROR: ' + e.message)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
