import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

async function extractText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
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

  // SPO: varios patrones posibles según versión del PDF Nokia
  const spo = grab(text, /Purchase Doc(?:ument)? Number[:\s]+(\d+)/)
           || grab(text, /PO Number[:\s]+(\d+)/)
           || grab(text, /Order Number[:\s]+(\d+)/)
           || grab(text, /\bPO\s+(\d{7,})\b/)
           || grab(file.name, /PO[\s_]?(\d{5,})/)   // fallback desde el nombre del archivo

  const docDate       = grab(text, /Doc(?:ument)? Date[:\s]+(\S+)/)
                     || grab(text, /Date[:\s]+(\d{2}[./]\d{2}[./]\d{4})/)
  const supplierName  = grab(text, /Supplier Name[:\s]+(.+?)(?:\s{2,}|Supplier Number:|$)/m)
  const paymentTerms  = grab(text, /Payment Terms[:\s]+(.+?)(?:\s{2,}|Supplier|NSN|$)/m)
  const pciDesc       = grab(text, /PCI Description[:\s]+(.+?)(?:\s*$|\n)/m)

  // Total Value: "4.180.241,00 COP" o "COP 4.180.241,00"
  const valueMatch = text.match(/Total Value[:\s]+([\d.,]+)\s+([A-Z]{3})\b/)
                  || text.match(/\b([A-Z]{3})\s+([\d.,]+)/)
  let rawValue, moneda = 'COP', valor = null
  if (valueMatch) {
    const isLeading = /^[A-Z]{3}$/.test(valueMatch[1])
    rawValue = isLeading ? valueMatch[2] : valueMatch[1]
    moneda   = isLeading ? valueMatch[1] : valueMatch[2]
    valor    = parseFloat(rawValue.replace(/\./g, '').replace(',', '.')) || null
  }

  // Free Text: "CAL0248_CAL.San Carlos_SMP-WO-0266410"
  const ftMatch  = text.match(/Free Text[:\s]+([\w._\- ]+?)(?:\s{2,}|Pls Add|Customer reference|Sales Order|\n)/i)
  const freeText = ftMatch?.[1]?.trim() || ''
  const parts    = freeText.split('_')
  const smpIdx   = parts.findIndex(p => /SMP-WO-/i.test(p))
  const siteId   = parts[0] || ''
  const siteName = smpIdx > 1 ? parts.slice(1, smpIdx).join('_') : (parts[1] || '')
  const smpId    = smpIdx >= 0 ? parts[smpIdx] : (grab(text, /(SMP-WO-\d+)/i))

  return { spo_number: normSPO(spo), smp_id: smpId, site_id: siteId, site_name: siteName,
           doc_date: docDate, supplier_name: supplierName, valor, moneda,
           payment_terms: paymentTerms, pci_description: pciDesc }
}

function normSPO(v) {
  if (!v) return ''
  return String(v).replace(/^0+/, '') || String(v)
}
