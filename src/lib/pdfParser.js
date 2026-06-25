// pdfjs-dist se carga dinámicamente la primera vez que se parsea un PDF,
// para no añadir ~2MB al bundle inicial de la app.
let _pdfjs = null
async function getPdfjs() {
  if (_pdfjs) return _pdfjs
  const lib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default
  lib.GlobalWorkerOptions.workerSrc = workerUrl
  _pdfjs = lib
  return lib
}

async function extractText(file) {
  const pdfjsLib    = await getPdfjs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(it => it.str).join(' ') + '\n'
  }
  return text
}

function grab(text, pattern) {
  return text.match(pattern)?.[1]?.trim() || ''
}

export async function parsePOPdf(file) {
  console.log('[pdfParser] iniciando:', file.name, file.type, file.size)
  let text = ''
  try {
    text = await extractText(file)
  } catch (e) {
    console.error('[pdfParser] extractText falló:', e)
    throw new Error('No se pudo leer el PDF: ' + e.message)
  }
  console.log('[pdfParser] texto extraído (primeros 1500 chars):\n', text.slice(0, 1500))

  const spo = grab(text, /Purchase Doc(?:ument)? Number[:\s]+(\d+)/)
           || grab(text, /PO Number[:\s]+(\d+)/)
           || grab(text, /Order Number[:\s]+(\d+)/)
           || grab(text, /\bPO\s+(\d{7,})\b/)
           || grab(file.name, /PO[\s_]?(\d{5,})/)

  const docDate      = grab(text, /Doc(?:ument)? Date[:\s]+(\S+)/)
                    || grab(text, /Date[:\s]+(\d{2}[./]\d{2}[./]\d{4})/)
  const supplierName = grab(text, /Supplier Name[:\s]+(.+?)(?:\s{2,}|Supplier Number:|$)/m)
  const paymentTerms = grab(text, /Payment Terms[:\s]+(.+?)(?:\s{2,}|Supplier|NSN|$)/m)
  const pciDesc      = grab(text, /PCI Description[:\s]+(.+?)(?:\s*$|\n)/m)

  const valueMatch = text.match(/Total Value[:\s]+([\d.,]+)\s+([A-Z]{3})\b/)
                  || text.match(/\b([A-Z]{3})\s+([\d.,]+)/)
  let rawValue, moneda = 'COP', valor = null
  if (valueMatch) {
    const isLeading = /^[A-Z]{3}$/.test(valueMatch[1])
    rawValue = isLeading ? valueMatch[2] : valueMatch[1]
    moneda   = isLeading ? valueMatch[1] : valueMatch[2]
    valor    = parseFloat(rawValue.replace(/\./g, '').replace(',', '.')) || null
  }

  const ftMatch  = text.match(/Free Text[:\s]+([^\n]+?)(?:\s{2,}|Pls Add|Customer reference|Sales Order|\n)/i)
  const freeText = ftMatch?.[1]?.trim() || ''
  const parts    = freeText.split('_')
  const start    = parts[0].toUpperCase() === 'PO' ? 1 : 0
  const smpIdx   = parts.findIndex(p => /SMP-WO-/i.test(p))
  const siteId   = parts[start] || ''
  const siteName = smpIdx > start + 1 ? parts.slice(start + 1, smpIdx).join('_') : (parts[start + 1] || '')
  // En PO de ADJ/CR el segmento con el SMP suele traer texto extra pegado
  // (sin "_" que lo separe) — se aísla solo el código vía regex.
  const smpId    = smpIdx >= 0
    ? (parts[smpIdx].match(/SMP-WO-\d+/i)?.[0] || parts[smpIdx])
    : (grab(text, /(SMP-WO-\d+)/i))

  // Descripción libre — texto entre el SMP y el sufijo "INGETELPROJECT" (si existe).
  // Ej: "...SMP-WO-0364928 Bono administrativo para 30 sitios MOD P04-2026 INGETELPROJECT 1"
  //     → "Bono administrativo para 30 sitios MOD P04-2026"
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

  const isCancelled = /SPO Cancelled By/i.test(text)

  return { spo_number: normSPO(spo), smp_id: smpId, site_id: siteId, site_name: siteName,
           doc_date: docDate, supplier_name: supplierName, valor, moneda,
           payment_terms: paymentTerms, pci_description: pciDesc, isCancelled,
           descripcion_libre: descripcionLibre }
}

function normSPO(v) {
  if (!v) return ''
  return String(v).replace(/^0+/, '') || String(v)
}
