import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

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
  const text = await extractText(file)

  const spo           = grab(text, /Purchase Doc Number:\s*(\d+)/)
  const docDate       = grab(text, /Doc Date:\s*(\S+)/)
  const supplierName  = grab(text, /Supplier Name:\s*(.+?)(?:\s{2,}|Supplier Number:)/)
  const paymentTerms  = grab(text, /Payment Terms:\s*(.+?)(?:\s{2,}|Supplier|NSN|$)/)
  const pciDesc       = grab(text, /PCI Description:\s*(.+?)(?:\s*$|\n)/)

  // Total Value: "4.180.241,00 COP"
  const valueMatch = text.match(/Total Value:\s*([\d.,]+)\s+([A-Z]+)/)
  const rawValue   = valueMatch?.[1]?.replace(/\./g, '').replace(',', '.') || null
  const moneda     = valueMatch?.[2] || 'COP'
  const valor      = rawValue ? parseFloat(rawValue) : null

  // Free Text first line: "CAL0248_CAL.San Carlos_SMP-WO-0266410"
  const ftMatch  = text.match(/Free Text:\s*([\w._\- ]+?)(?:\s{2,}|Pls Add|Customer reference|Sales Order|\n)/)
  const freeText = ftMatch?.[1]?.trim() || ''
  const parts    = freeText.split('_')
  const smpIdx   = parts.findIndex(p => p.startsWith('SMP-WO-'))
  const siteId   = parts[0] || ''
  const siteName = smpIdx > 1 ? parts.slice(1, smpIdx).join('_') : (parts[1] || '')
  const smpId    = smpIdx >= 0 ? parts[smpIdx] : (grab(text, /(SMP-WO-\d+)/))

  return { spo_number: spo, smp_id: smpId, site_id: siteId, site_name: siteName,
           doc_date: docDate, supplier_name: supplierName, valor, moneda,
           payment_terms: paymentTerms, pci_description: pciDesc }
}
