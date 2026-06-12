import { create } from 'zustand'
import * as XLSX   from 'xlsx'
import { supabase } from '../lib/supabase'
import { parsePOPdf } from '../lib/pdfParser'
import { TABLES, BUCKETS } from '../lib/tables'

// ── Categorías SMP (por SMP Name) ────────────────────────────────
export const SMP_CATS = [
  { key: 'impl', label: 'Implementación', color: '#0ea5e9', test: n => /Process_Implementation/i.test(n) },
  { key: 'adj',  label: 'ADJ',            color: '#f59e0b', test: n => /IMP_ADJ H2/i.test(n) },
  { key: 'cw',   label: 'CW',             color: '#8b5cf6', test: n => /Process_CW/i.test(n) },
  { key: 'cr',   label: 'CR',             color: '#ec4899', test: n => /No Back to Back Process|Extra works/i.test(n) },
  { key: 'tss',  label: 'TSS',            color: '#10b981', test: n => /TSS Process/i.test(n) },
]
export function getSmpCat(smpName) {
  return SMP_CATS.find(c => c.test(smpName || '')) || { key: 'other', label: 'Otro', color: '#9ca89c' }
}

// ── Eventos de cobro ──────────────────────────────────────────────
export const EVENTOS = [
  { key: 'acuerdo',  label: 'Acuerdo',   pctCol: 'acuerdo_liberacion',         color: '#f59e0b' },
  { key: 'tss_1',    label: 'TSS 1er %', pctCol: 'ss_tssr_enviado_pct',        color: '#0ea5e9' },
  { key: 'tss_2',    label: 'TSS 2do %', pctCol: 'ss_tssr_aprobado_cliente_pct', color: '#3b82f6' },
  { key: 'cw_1',     label: 'CW 1er %',  pctCol: 'execute_cw_pct',             color: '#8b5cf6' },
  { key: 'cw_2',     label: 'CW 2do %',  pctCol: 'doc_final_ok_pct',           color: '#ec4899' },
  { key: 'servicio', label: 'Servicio',  pctCol: 'servicio_ejecutado_pct',      color: '#10b981' },
]

// Normalizar SPO: quitar ceros iniciales
function normSPO(v) {
  if (!v) return ''
  return String(v).replace(/^0+/, '') || String(v)
}

// Columnas Nokia → campos DB
const COL_MAP = {
  'Project Name':                      'project_name',
  'Site Reference ID':                 'site_reference_id',
  'Customer Site Name':                'customer_site_name',
  'SMP ID':                            'smp_id',
  'SMP Name':                          'smp_name',
  'Desempeño':                    'desempeno',
  'Desempeno':                         'desempeno',
  'Vendor SAP Name':                   'vendor_sap_name',
  'MS Name':                           'ms_name',
  'SPO Number':                        'spo_number',
  'SPO Date':                          'spo_date',
  'IA Date':                           'ia_date',
  'Services Good receipt number (sGR)':'sgr',
  'GR Date':                           'gr_date',
  'Acuerdo No':                        'acuerdo_no',
  'Acuerdo_SS_Date':                   'acuerdo_ss_date',
  'Acuerdo Liberacion':                'acuerdo_liberacion',
  'TSSR Enviado al Cliente':           'tssr_enviado_cliente',
  'SS TSSR Enviado PPA Date':          'ss_tssr_enviado_ppa_date',
  'SS TSSR Enviado ok %':              'ss_tssr_enviado_pct',
  'TSSR Aprobado Cliente':             'tssr_aprobado_cliente',
  'SS TSSR Aprob Cliente PPA Date':    'ss_tssr_aprob_cliente_ppa_date',
  'SS TSSR Aprobado Cliente %':        'ss_tssr_aprobado_cliente_pct',
  'Execute CW+Reg Fotografico Date':   'execute_cw_date',
  'Execute CW+Reg Fotografico PPA Date':'execute_cw_ppa_date',
  'Execute CW+Reg Fotografico %':      'execute_cw_pct',
  'Doc Final Ok Date':                 'doc_final_ok_date',
  'Doc Final ok PPA Date':             'doc_final_ok_ppa_date',
  'Doc Final ok Partner %':            'doc_final_ok_pct',
  'Servicio Ejecutado':                'servicio_ejecutado',
  'Servicio Ejecutado PPA Date':       'servicio_ejecutado_ppa_date',
  'Servicio Ejecutado %':              'servicio_ejecutado_pct',
  'Total TSS':                         'total_tss',
  'Total CW':                          'total_cw',
}

const PCT_COLS = new Set([
  'acuerdo_liberacion','ss_tssr_enviado_pct','ss_tssr_aprobado_cliente_pct',
  'execute_cw_pct','doc_final_ok_pct','servicio_ejecutado_pct','total_tss','total_cw',
])

function parseExcelRow(headers, row) {
  const obj = {}
  headers.forEach((h, i) => {
    const field = COL_MAP[h?.trim()]
    if (!field) return
    let val = row[i]
    if (val === null || val === undefined || val === '') {
      obj[field] = PCT_COLS.has(field) ? null : null
      return
    }
    if (PCT_COLS.has(field)) {
      obj[field] = val === '' || val === null ? null : Number(val) || null
    } else {
      obj[field] = String(val).trim() || null
    }
  })
  if (obj.spo_number) obj.spo_number = normSPO(obj.spo_number)
  return obj
}

export const useFactStore = create((set, get) => ({
  ppa:         [],
  uploads:     [],
  invoices:    [],
  pos:         [],
  historial:   [],
  calendar:    [],
  rejectedPos: [],
  loading:     false,
  uploading:   false,
  currUploadId: null,

  // ── Cargar todo ─────────────────────────────────────────────────
  loadAll: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      // Limpiar POs rechazadas con más de 3 días (respaldo client-side al pg_cron)
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from(TABLES.FACT_REJECTED_POS).delete().lt('rejected_at', cutoff)

      const [{ data: uploads }, { data: invoices }, { data: pos }, { data: cal }, { data: rejected }, { data: ppaData }] = await Promise.all([
        supabase.from(TABLES.FACT_UPLOADS).select('*').order('uploaded_at', { ascending: false }),
        supabase.from(TABLES.FACT_INVOICES).select('*').limit(15000),
        supabase.from(TABLES.FACT_POS).select('*').limit(5000),
        supabase.from(TABLES.FACT_CALENDAR).select('*').order('year').order('month'),
        supabase.from(TABLES.FACT_REJECTED_POS).select('*').order('rejected_at', { ascending: false }),
        supabase.from(TABLES.FACT_PPA).select('*'),
      ])
      set({
        ppa:          ppaData   || [],
        uploads:      uploads   || [],
        invoices:     invoices  || [],
        pos:          pos       || [],
        calendar:     cal       || [],
        rejectedPos:  rejected  || [],
        currUploadId: uploads?.[0]?.id || null,
        loading: false,
      })
    } catch { set({ loading: false }) }
  },

  // ── Subir PPA Nokia ─────────────────────────────────────────────
  uploadPPA: async (file) => {
    set({ uploading: true })
    try {
      const buf   = await file.arrayBuffer()
      const wb    = XLSX.read(buf, { type: 'array', raw: true })
      const ws    = wb.Sheets[wb.SheetNames[0]]
      const raw   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      if (raw.length < 2) throw new Error('Archivo vacío o sin datos')

      const headers = raw[0]
      const rows    = raw.slice(1).filter(r => r.some(c => c !== null && c !== ''))
      const parsed  = rows.map(r => parseExcelRow(headers, r)).filter(r => r.spo_number)

      // Audit record
      const { data: upload, error: upErr } = await supabase
        .from(TABLES.FACT_UPLOADS)
        .insert({ filename: file.name, row_count: parsed.length })
        .select().single()
      if (upErr) throw upErr

      // Delete existing rows in chunks (large IN clauses exceed URL limits)
      const spoNumbers = parsed.map(r => r.spo_number)
      const CHUNK = 200
      for (let i = 0; i < spoNumbers.length; i += CHUNK) {
        const { error: delErr } = await supabase
          .from(TABLES.FACT_PPA).delete().in('spo_number', spoNumbers.slice(i, i + CHUNK))
        if (delErr) throw delErr
      }

      // Insert all rows in chunks
      const toInsert = parsed.map(r => ({ ...r, upload_id: upload.id }))
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const { error: pErr } = await supabase.from(TABLES.FACT_PPA).insert(toInsert.slice(i, i + CHUNK))
        if (pErr) throw pErr
      }

      // Reload all fact_ppa (current + any legacy SPOs not in this upload)
      const { data: allPpa } = await supabase.from(TABLES.FACT_PPA).select('*').limit(5000)

      set(s => ({
        ppa:          allPpa || [],
        uploads:      [upload, ...s.uploads],
        currUploadId: upload.id,
        uploading:    false,
      }))
      return { ok: true, count: parsed.length }
    } catch (e) {
      set({ uploading: false })
      return { ok: false, error: e.message }
    }
  },

  // ── Subir PDF de PO ─────────────────────────────────────────────
  uploadPOPdf: async (file) => {
    set({ uploading: true })
    try {
      const extracted = await parsePOPdf(file)
      if (!extracted.spo_number) throw new Error('No se pudo extraer el SPO del PDF')

      // Validar que el SPO exista en el PPA cargado
      const { ppa } = get()
      if (ppa.length > 0 && !ppa.some(r => r.spo_number === extracted.spo_number)) {
        await supabase.from(TABLES.FACT_REJECTED_POS).insert({ filename: file.name, spo_number: extracted.spo_number })
        const { data: rej } = await supabase.from(TABLES.FACT_REJECTED_POS).select('*').order('rejected_at', { ascending: false })
        set({ rejectedPos: rej || [] })
        throw new Error(`SPO ${extracted.spo_number} no está en el PPA — guardado en registro de rechazados`)
      }

      // Subir archivo a Storage
      const path = `pos/${extracted.spo_number}_${Date.now()}.pdf`
      const { error: stErr } = await supabase.storage.from(BUCKETS.FACTURACION).upload(path, file, { upsert: true })
      if (stErr) throw stErr
      const { data: urlData } = supabase.storage.from(BUCKETS.FACTURACION).getPublicUrl(path)

      const record = { ...extracted, pdf_url: urlData.publicUrl, updated_at: new Date().toISOString() }

      const { data, error } = await supabase
        .from(TABLES.FACT_POS)
        .upsert(record, { onConflict: 'spo_number' })
        .select().single()
      if (error) throw error

      set(s => ({
        pos: s.pos.find(p => p.spo_number === data.spo_number)
          ? s.pos.map(p => p.spo_number === data.spo_number ? data : p)
          : [data, ...s.pos],
        uploading: false,
      }))
      return { ok: true, data }
    } catch (e) {
      set({ uploading: false })
      return { ok: false, error: e.message }
    }
  },

  // ── Cargar historial de POs (lazy, solo desde FactPOs) ──────────────────
  loadHistorial: async () => {
    const { data } = await supabase
      .from(TABLES.FACT_POS_HIST).select('*').order('changed_at', { ascending: false }).limit(3000)
    set({ historial: data || [] })
  },

  // ── Confirmar actualización de PO (reemplaza PDF + registra historial) ──
  confirmarActualizacionPO: async ({ file, extracted, existing, changedBy }) => {
    set({ uploading: true })
    try {
      // 1. Subir nuevo PDF
      const path = `pos/${extracted.spo_number}_${Date.now()}.pdf`
      const { error: stErr } = await supabase.storage.from(BUCKETS.FACTURACION).upload(path, file, { upsert: false })
      if (stErr) throw stErr
      const { data: urlData } = supabase.storage.from(BUCKETS.FACTURACION).getPublicUrl(path)

      // 2. Eliminar PDF anterior
      if (existing.pdf_url) {
        const oldPath = existing.pdf_url.match(/\/facturacion\/(.+?)(?:\?|$)/)?.[1]
        if (oldPath) await supabase.storage.from(BUCKETS.FACTURACION).remove([oldPath])
      }

      // 3. Actualizar fact_pos
      const record = { ...extracted, pdf_url: urlData.publicUrl, updated_at: new Date().toISOString() }
      const { data, error } = await supabase
        .from(TABLES.FACT_POS).update(record).eq('spo_number', extracted.spo_number).select().single()
      if (error) throw error

      // 4. Registrar historial
      const { data: hRow } = await supabase.from(TABLES.FACT_POS_HIST)
        .insert({ spo_number: extracted.spo_number, changed_by: changedBy, changes: computeChanges(existing, extracted), old_pdf_url: existing.pdf_url })
        .select().single()

      set(s => ({
        pos:      s.pos.map(p => p.spo_number === data.spo_number ? data : p),
        historial: hRow ? [hRow, ...s.historial] : s.historial,
        uploading: false,
      }))
      return { ok: true, data }
    } catch (e) {
      set({ uploading: false })
      return { ok: false, error: e.message }
    }
  },

  // ── Actualizar PO manualmente ────────────────────────────────────
  actualizarPO: async (id, updates) => {
    const { data, error } = await supabase
      .from(TABLES.FACT_POS).update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    set(s => ({ pos: s.pos.map(p => p.id === id ? data : p) }))
  },

  // ── Registrar factura ────────────────────────────────────────────
  registrarFactura: async ({ spo_number, evento, pct, numero_factura, fecha_factura, observaciones, absorbed = false }) => {
    const { data, error } = await supabase
      .from(TABLES.FACT_INVOICES)
      .upsert({ spo_number, evento, pct, numero_factura: numero_factura || null, fecha_factura: fecha_factura || null, observaciones, absorbed },
               { onConflict: 'spo_number,evento' })
      .select().single()
    if (error) throw error
    set(s => ({
      invoices: s.invoices.find(i => i.spo_number === spo_number && i.evento === evento)
        ? s.invoices.map(i => i.spo_number === spo_number && i.evento === evento ? data : i)
        : [data, ...s.invoices],
    }))
  },

  // ── Importar facturas en bloque ──────────────────────────────────
  importarFacturas: async (items) => {
    const { data, error } = await supabase
      .from(TABLES.FACT_INVOICES)
      .upsert(items, { onConflict: 'spo_number,evento' })
      .select()
    if (error) throw error
    const { data: all } = await supabase.from(TABLES.FACT_INVOICES).select('*').limit(15000)
    set({ invoices: all || [] })
    return (data || []).length
  },

  // ── Eliminar factura ─────────────────────────────────────────────
  eliminarFactura: async (id) => {
    await supabase.from(TABLES.FACT_INVOICES).delete().eq('id', id)
    set(s => ({ invoices: s.invoices.filter(i => i.id !== id) }))
  },

  // ── Calendario ──────────────────────────────────────────────────
  saveCalendarPeriod: async (period) => {
    const { id, ...data } = period
    if (id) {
      const { data: upd, error } = await supabase.from(TABLES.FACT_CALENDAR).update(data).eq('id', id).select().single()
      if (error) throw error
      set(s => ({ calendar: s.calendar.map(c => c.id === id ? upd : c) }))
    } else {
      const { data: ins, error } = await supabase.from(TABLES.FACT_CALENDAR).insert(data).select().single()
      if (error) throw error
      set(s => ({ calendar: [...s.calendar, ins].sort((a, b) => a.year - b.year || a.month - b.month) }))
    }
  },

  deleteCalendarPeriod: async (id) => {
    await supabase.from(TABLES.FACT_CALENDAR).delete().eq('id', id)
    set(s => ({ calendar: s.calendar.filter(c => c.id !== id) }))
  },

  // ── Rechazados ───────────────────────────────────────────────────
  deleteRejectedPo: async (id) => {
    await supabase.from(TABLES.FACT_REJECTED_POS).delete().eq('id', id)
    set(s => ({ rejectedPos: s.rejectedPos.filter(r => r.id !== id) }))
  },

  // ── Eliminar upload ──────────────────────────────────────────────
  deleteUpload: async (id) => {
    await supabase.from(TABLES.FACT_UPLOADS).delete().eq('id', id)
    const uploads = get().uploads.filter(u => u.id !== id)
    // fact_ppa rows are not tied to a single upload — leave them untouched
    set({ uploads, currUploadId: uploads[0]?.id || null })
  },
}))

// ── Helpers exportables ──────────────────────────────────────────
export function computeChanges(existing, extracted) {
  const FIELDS = ['valor', 'moneda', 'smp_id', 'supplier_name', 'payment_terms', 'pci_description', 'doc_date']
  const changes = {}
  for (const key of FIELDS) {
    const oldVal = existing[key] ?? null
    const newVal = extracted[key] ?? null
    if (newVal !== null && String(oldVal ?? '') !== String(newVal ?? '')) {
      changes[key] = { old: oldVal, new: newVal }
    }
  }
  return changes
}

export function buildInvoicesMap(invoices) {
  const map = {}
  for (const inv of invoices) map[`${inv.spo_number}|${inv.evento}`] = inv
  return map
}

export function getEventosRow(row, invMap) {
  if (!row.sgr) {
    // Sin GR: mostrar solo facturas de acuerdo especial registradas antes de tener GR
    return EVENTOS
      .map(e => ({ e, inv: invMap[`${row.spo_number}|${e.key}`] }))
      .filter(({ inv }) => inv?.absorbed)
      .map(({ e, inv }) => ({ ...e, pct: inv.pct || 100, invoiceable_pct: inv.pct || 100, invoice: inv, status: 'facturado' }))
  }

  let remaining = 100 - (row.acuerdo_liberacion || 0)

  return EVENTOS
    .filter(e => row[e.pctCol] > 0 || invMap[`${row.spo_number}|${e.key}`]?.absorbed)
    .map(e => {
      const inv    = invMap[`${row.spo_number}|${e.key}`]
      // Si el PPA no tiene % pero hay acuerdo especial, usar el pct de la factura
      const rawPct = row[e.pctCol] || (inv?.absorbed ? (inv.pct || 100) : 0)

      let invoiceablePct = rawPct
      if (e.key !== 'acuerdo') {
        invoiceablePct = Math.min(rawPct, Math.max(0, remaining))
        remaining -= invoiceablePct
      }

      const status = inv
        ? 'facturado'
        : invoiceablePct === 0 ? 'absorbido' : 'facturar'

      return { ...e, pct: rawPct, invoiceable_pct: invoiceablePct, invoice: inv || null, status }
    })
}
