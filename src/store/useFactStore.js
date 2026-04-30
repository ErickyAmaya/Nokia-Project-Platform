import { create } from 'zustand'
import * as XLSX   from 'xlsx'
import { supabase } from '../lib/supabase'
import { parsePOPdf } from '../lib/pdfParser'

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
  ppa:      [],
  uploads:  [],
  invoices: [],
  pos:      [],
  calendar: [],
  loading:  false,
  uploading: false,
  currUploadId: null,

  // ── Cargar todo ─────────────────────────────────────────────────
  loadAll: async () => {
    set({ loading: true })
    try {
      const [{ data: uploads }, { data: invoices }, { data: pos }, { data: cal }] = await Promise.all([
        supabase.from('fact_uploads').select('*').order('uploaded_at', { ascending: false }),
        supabase.from('fact_invoices').select('*'),
        supabase.from('fact_pos').select('*'),
        supabase.from('fact_calendar').select('*').order('year').order('month'),
      ])

      const latest = uploads?.[0]
      let ppa = []
      if (latest) {
        const { data } = await supabase.from('fact_ppa').select('*').eq('upload_id', latest.id)
        ppa = data || []
      }
      set({
        ppa,
        uploads:      uploads  || [],
        invoices:     invoices || [],
        pos:          pos      || [],
        calendar:     cal      || [],
        currUploadId: latest?.id || null,
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

      const { data: upload, error: upErr } = await supabase
        .from('fact_uploads')
        .insert({ file_name: file.name, row_count: parsed.length })
        .select().single()
      if (upErr) throw upErr

      const toInsert = parsed.map(r => ({ ...r, upload_id: upload.id }))
      const { error: pErr } = await supabase.from('fact_ppa').insert(toInsert)
      if (pErr) throw pErr

      set(s => ({
        ppa:      toInsert,
        uploads:  [upload, ...s.uploads],
        currUploadId: upload.id,
        uploading: false,
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

      // Subir archivo a Storage
      const path = `pos/${extracted.spo_number}_${Date.now()}.pdf`
      const { error: stErr } = await supabase.storage.from('facturacion').upload(path, file, { upsert: true })
      if (stErr) throw stErr
      const { data: urlData } = supabase.storage.from('facturacion').getPublicUrl(path)

      const record = { ...extracted, pdf_url: urlData.publicUrl, updated_at: new Date().toISOString() }

      const { data, error } = await supabase
        .from('fact_pos')
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

  // ── Actualizar PO manualmente ────────────────────────────────────
  actualizarPO: async (id, updates) => {
    const { data, error } = await supabase
      .from('fact_pos').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    set(s => ({ pos: s.pos.map(p => p.id === id ? data : p) }))
  },

  // ── Registrar factura ────────────────────────────────────────────
  registrarFactura: async ({ spo_number, evento, pct, numero_factura, fecha_factura, observaciones }) => {
    const { data, error } = await supabase
      .from('fact_invoices')
      .upsert({ spo_number, evento, pct, numero_factura, fecha_factura: fecha_factura || null, observaciones },
               { onConflict: 'spo_number,evento' })
      .select().single()
    if (error) throw error
    set(s => ({
      invoices: s.invoices.find(i => i.spo_number === spo_number && i.evento === evento)
        ? s.invoices.map(i => i.spo_number === spo_number && i.evento === evento ? data : i)
        : [data, ...s.invoices],
    }))
  },

  // ── Eliminar factura ─────────────────────────────────────────────
  eliminarFactura: async (id) => {
    await supabase.from('fact_invoices').delete().eq('id', id)
    set(s => ({ invoices: s.invoices.filter(i => i.id !== id) }))
  },

  // ── Calendario ──────────────────────────────────────────────────
  saveCalendarPeriod: async (period) => {
    const { id, ...data } = period
    if (id) {
      const { data: upd, error } = await supabase.from('fact_calendar').update(data).eq('id', id).select().single()
      if (error) throw error
      set(s => ({ calendar: s.calendar.map(c => c.id === id ? upd : c) }))
    } else {
      const { data: ins, error } = await supabase.from('fact_calendar').insert(data).select().single()
      if (error) throw error
      set(s => ({ calendar: [...s.calendar, ins].sort((a, b) => a.year - b.year || a.month - b.month) }))
    }
  },

  deleteCalendarPeriod: async (id) => {
    await supabase.from('fact_calendar').delete().eq('id', id)
    set(s => ({ calendar: s.calendar.filter(c => c.id !== id) }))
  },

  // ── Eliminar upload ──────────────────────────────────────────────
  deleteUpload: async (id) => {
    await supabase.from('fact_uploads').delete().eq('id', id)
    const uploads = get().uploads.filter(u => u.id !== id)
    const latest  = uploads[0]
    let ppa = []
    if (latest) {
      const { data } = await supabase.from('fact_ppa').select('*').eq('upload_id', latest.id)
      ppa = data || []
    }
    set({ uploads, ppa, currUploadId: latest?.id || null })
  },
}))

// ── Helpers exportables ──────────────────────────────────────────
export function buildInvoicesMap(invoices) {
  const map = {}
  for (const inv of invoices) map[`${inv.spo_number}|${inv.evento}`] = inv
  return map
}

export function getEventosRow(row, invMap) {
  if (!row.sgr) return []
  return EVENTOS
    .filter(e => row[e.pctCol] > 0)
    .map(e => {
      const inv = invMap[`${row.spo_number}|${e.key}`]
      return { ...e, pct: row[e.pctCol], invoice: inv || null,
               status: inv ? 'facturado' : 'facturar' }
    })
}
