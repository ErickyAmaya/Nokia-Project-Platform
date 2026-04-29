import { create } from 'zustand'
import * as XLSX   from 'xlsx'
import { getSupabaseClient } from '../lib/supabase'

const db = () => getSupabaseClient()

// ── Mapeo de columnas Excel → BD ──────────────────────────────────
const COL = {
  smp:                    ['smp'],
  main_smp:               ['main_smp'],
  relacion:               ['Relacion', 'relacion'],
  site_name:              ['siteName', 'site_name'],
  region:                 ['region'],
  proyecto_alcance:       ['proyecto_alcance'],
  sub_proyecto:           ['sub_proyecto'],
  mos:                    ['mos'],
  instalacion:            ['instalacion'],
  integracion:            ['integracion'],
  dias_integracion:       ['Dias_Integracion', 'dias_integracion'],
  semanas_integracion:    ['Semanas_Integracion', 'semanas_integracion'],
  pct_valoracion:         ['%Valoracion', 'pct_valoracion'],
  rango_valorizacion:     ['Rango_Valorizacion', 'rango_valorizacion'],
  procesos_cierre_ph2:    ['Procesos_Cierre_PH2', 'procesos_cierre_ph2'],
  procesos_cierre_ph2_tot:['Procesos_Cierre_PH2_Tot', 'procesos_cierre_ph2_tot'],
  gap_log_inv:            ['GAP_LOG_INV', 'gap_log_inv'],
  gap_doc:                ['GAP_DOC', 'gap_doc'],
  gap_hw_cierre:          ['GAP_HW_Cierre', 'gap_hw_cierre'],
  gap_site_owner:         ['GAP_SiteOwner', 'gap_site_owner'],
  gap_on_air:             ['GAP_OnAir', 'gap_on_air'],
  val_gap_doc:            ['ValGAP_DOC', 'val_gap_doc'],
  val_gap_hw_cierre:      ['ValGAP_HW_Cierre', 'val_gap_hw_cierre'],
  val_gap_log_inv:        ['ValGAP_LOG_INV', 'val_gap_log_inv'],
  val_gap_site_owner:     ['ValGAP_SiteOwner', 'val_gap_site_owner'],
  val_gap_on_air:         ['ValGAP_OnAir', 'val_gap_on_air'],
  tickets_total:          ['Tickets_Total', 'tickets_total'],
  tickets_areas:          ['Tickets_Areas', 'tickets_areas'],
  tickets_id:             ['Tickets_ID', 'tickets_id'],
  ticket_doc_owner:       ['Ticket_DOC_Owner', 'ticket_doc_owner'],
  ticket_log_inv_owner:   ['Ticket_LOG_INV_Owner', 'ticket_log_inv_owner'],
  ticket_hw_cierre_owner: ['Ticket_HW_Cierre_Owner', 'ticket_hw_cierre_owner'],
  ticket_so_owner:        ['Ticket_SO_Owner', 'ticket_so_owner'],
  ticket_on_air_owner:    ['Ticket_ON_AIR_Owner', 'ticket_on_air_owner'],
}

const FC_COL = {
  fc_avance_doc:        ['FC_Avance_DOC',        'fc_avance_doc',        'FC Avance DOC',        'Fc_Avance_DOC'],
  fc_cierre_doc:        ['FC_Cierre_DOC',         'fc_cierre_doc',        'FC Cierre DOC',        'Fc_Cierre_DOC'],
  fc_avance_hw_cierre:  ['FC_Avance_HW_Cierre',   'fc_avance_hw_cierre',  'FC Avance HW Cierre',  'Fc_Avance_HW_Cierre'],
  fc_cierre_hw_cierre:  ['FC_Cierre_HW_Cierre',   'FC_re_HW_Cierre',     'fc_cierre_hw_cierre',  'FC Cierre HW Cierre'],
  fc_avance_site_owner: ['FC_Avance_SiteOwner',   'fc_avance_site_owner', 'FC Avance SiteOwner',  'FC_Avance_Site_Owner'],
  fc_cierre_site_owner: ['FC_Cierre_SiteOwner',   'fc_cierre_site_owner', 'FC Cierre SiteOwner',  'FC_Cierre_Site_Owner'],
  fc_avance_on_air:     ['FC_Avance_OnAir',       'fc_avance_on_air',     'FC Avance OnAir',      'FC_Avance_On_Air'],
  fc_cierre_on_air:     ['FC_Cierre_OnAir',       'fc_cierre_on_air',     'FC Cierre OnAir',      'FC_Cierre_On_Air'],
}

// Estados finales por proceso
export const FINAL = {
  gap_log_inv:   '9999.Finalizada',
  gap_doc:       '9999.Aprobado',
  gap_hw_cierre: '9999.Finalizado_SS_E2E',
  gap_site_owner:'9999.Aprobado',
  gap_on_air:    ['9999. Producción', '70. Producción', '9999.Producción'],
}

export const PROCESOS = [
  { key: 'gap_on_air',     label: 'ON AIR',             color: '#0ea5e9', val: 'val_gap_on_air' },
  { key: 'gap_log_inv',    label: 'LOG. INVERSA',        color: '#f59e0b', val: 'val_gap_log_inv' },
  { key: 'gap_site_owner', label: 'SITE OWNER',          color: '#8b5cf6', val: 'val_gap_site_owner' },
  { key: 'gap_doc',        label: 'DOCUMENTACIÓN',       color: '#10b981', val: 'val_gap_doc' },
  { key: 'gap_hw_cierre',  label: 'CIERRE HW',           color: '#ef4444', val: 'val_gap_hw_cierre' },
]

function isFinal(proceso, val) {
  const f = FINAL[proceso]
  if (!val) return false
  if (Array.isArray(f)) return f.some(x => val.startsWith(x.split('.')[0]))
  return val === f || val.startsWith('9999')
}

// Busca valor de columna en una fila usando múltiples alias
function pick(row, aliases) {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== null && row[a] !== '') return row[a]
  }
  return null
}

// Convierte serial de Excel o string a date ISO string
function toDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  return null
}

function toNum(val) {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function toInt(val) {
  const n = parseInt(val)
  return isNaN(n) ? null : n
}

// ── Parsear hoja ACK_Report_Sabana ───────────────────────────────
function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true })
  const sabana = []
  const forecasts = []

  for (const r of rows) {
    const smp = pick(r, COL.smp)
    if (!smp) continue

    sabana.push({
      smp,
      main_smp:               pick(r, COL.main_smp) || smp,
      relacion:               pick(r, COL.relacion),
      site_name:              pick(r, COL.site_name),
      region:                 pick(r, COL.region),
      proyecto_alcance:       pick(r, COL.proyecto_alcance),
      sub_proyecto:           pick(r, COL.sub_proyecto),
      mos:                    toDate(pick(r, COL.mos)),
      instalacion:            toDate(pick(r, COL.instalacion)),
      integracion:            toDate(pick(r, COL.integracion)),
      dias_integracion:       toInt(pick(r, COL.dias_integracion)),
      semanas_integracion:    toInt(pick(r, COL.semanas_integracion)),
      pct_valoracion:         toNum(pick(r, COL.pct_valoracion)),
      rango_valorizacion:     pick(r, COL.rango_valorizacion),
      procesos_cierre_ph2:    pick(r, COL.procesos_cierre_ph2),
      procesos_cierre_ph2_tot:toInt(pick(r, COL.procesos_cierre_ph2_tot)),
      gap_log_inv:            pick(r, COL.gap_log_inv),
      gap_doc:                pick(r, COL.gap_doc),
      gap_hw_cierre:          pick(r, COL.gap_hw_cierre),
      gap_site_owner:         pick(r, COL.gap_site_owner),
      gap_on_air:             pick(r, COL.gap_on_air),
      val_gap_doc:            toNum(pick(r, COL.val_gap_doc)),
      val_gap_hw_cierre:      toNum(pick(r, COL.val_gap_hw_cierre)),
      val_gap_log_inv:        toNum(pick(r, COL.val_gap_log_inv)),
      val_gap_site_owner:     toNum(pick(r, COL.val_gap_site_owner)),
      val_gap_on_air:         toNum(pick(r, COL.val_gap_on_air)),
      tickets_total:          toNum(pick(r, COL.tickets_total)),
      tickets_areas:          pick(r, COL.tickets_areas),
      tickets_id:             String(pick(r, COL.tickets_id) ?? '').trim() || null,
      ticket_doc_owner:       pick(r, COL.ticket_doc_owner),
      ticket_log_inv_owner:   pick(r, COL.ticket_log_inv_owner),
      ticket_hw_cierre_owner: pick(r, COL.ticket_hw_cierre_owner),
      ticket_so_owner:        pick(r, COL.ticket_so_owner),
      ticket_on_air_owner:    pick(r, COL.ticket_on_air_owner),
      uploaded_at:            new Date().toISOString(),
    })

    // FC columns — solo si tienen valor
    const fc = {
      smp,
      fc_avance_doc:        toDate(pick(r, FC_COL.fc_avance_doc)),
      fc_cierre_doc:        pick(r, FC_COL.fc_cierre_doc),
      fc_avance_hw_cierre:  toDate(pick(r, FC_COL.fc_avance_hw_cierre)),
      fc_cierre_hw_cierre:  pick(r, FC_COL.fc_cierre_hw_cierre),
      fc_avance_site_owner: toDate(pick(r, FC_COL.fc_avance_site_owner)),
      fc_cierre_site_owner: pick(r, FC_COL.fc_cierre_site_owner),
      fc_avance_on_air:     toDate(pick(r, FC_COL.fc_avance_on_air)),
      fc_cierre_on_air:     pick(r, FC_COL.fc_cierre_on_air),
      updated_at:           new Date().toISOString(),
    }
    const hasFc = Object.values(fc).some((v, i) => i > 0 && i < 9 && v)
    if (hasFc) forecasts.push(fc)
  }

  return { sabana, forecasts }
}

// ── Semana Nokia (domingo–sábado, W1 = semana con primer jueves del año) ──
// Nokia week = ISO week de (fecha + 1 día), porque Nokia empieza el domingo
// y el estándar ISO empieza el lunes.
export function getNokiaWeek(dateInput) {
  const d = new Date(dateInput)
  // Desplazar +1 día para convertir domingo-inicio → lunes-inicio (ISO)
  const shifted = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
  const dow = shifted.getUTCDay() || 7          // lun=1 … dom=7
  shifted.setUTCDate(shifted.getUTCDate() + 4 - dow) // al jueves de esa semana
  const yearStart = new Date(Date.UTC(shifted.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((shifted - yearStart) / 86400000) + 1) / 7)
  return { week, year: shifted.getUTCFullYear() }
}

export function nokiaWeekLabel(dateInput) {
  if (!dateInput) return ''
  const { week } = getNokiaWeek(dateInput)
  return `W${String(week).padStart(2, '0')}`
}

// ── Seleccionar el mejor par (curr, prev) para la comparación ────
//
// Reglas:
// 1. Dentro de la misma semana Nokia usar siempre el upload más reciente
//    (múltiples cargas diarias durante la semana de reunión → siempre el último).
// 2. Buscar el par donde la diferencia es EXACTAMENTE 2 semanas Nokia.
//    Si no existe par de 2 semanas con el upload más reciente, buscar en
//    uploads anteriores (ej. W17+W18 → usar W17 como curr y W15 como prev).
// 3. Si tampoco hay par de 2 semanas en uploads anteriores, aceptar ≥ 2 semanas.
function findComparePair(uploads) {
  if (!uploads?.length) return { currUpload: null, prevUpload: null }

  // De-duplicar por semana Nokia: queda el upload más reciente de cada semana
  const weekMap = new Map()
  for (const u of uploads) { // uploads ya viene DESC por loaded_at
    const wl = nokiaWeekLabel(u.loaded_at)
    if (!weekMap.has(wl)) weekMap.set(wl, u)
  }
  const weeks = [...weekMap.values()]
    .sort((a, b) => new Date(b.loaded_at) - new Date(a.loaded_at))

  // Diferencia en semanas Nokia reales (no días/7 redondeado)
  function weeksDiff(a, b) {
    const wa = getNokiaWeek(a.loaded_at)
    const wb = getNokiaWeek(b.loaded_at)
    if (wa.year === wb.year) return wa.week - wb.week
    // Cruce de año: contar semanas del año anterior
    const lastWeekOfPrevYear = getNokiaWeek(
      new Date(Date.UTC(wb.year, 11, 28)).toISOString() // 28 dic siempre está en la última semana
    ).week
    return lastWeekOfPrevYear - wb.week + wa.week
  }

  // Paso 1: buscar par con diferencia EXACTA de 2 semanas Nokia
  for (let i = 0; i < weeks.length - 1; i++) {
    for (let j = i + 1; j < weeks.length; j++) {
      if (weeksDiff(weeks[i], weeks[j]) === 2) {
        return { currUpload: weeks[i], prevUpload: weeks[j] }
      }
    }
  }

  // Paso 2: aceptar cualquier diferencia ≥ 2 semanas
  for (let i = 0; i < weeks.length - 1; i++) {
    for (let j = i + 1; j < weeks.length; j++) {
      if (weeksDiff(weeks[i], weeks[j]) >= 2) {
        return { currUpload: weeks[i], prevUpload: weeks[j] }
      }
    }
  }

  // Sin par válido: solo curr, sin comparación
  return { currUpload: uploads[0], prevUpload: null }
}

export const useAckStore = create((set, get) => ({
  sabana:             [],
  prevSabana:         [],
  prevUpload:         null,
  currUpload:         null,
  forecasts:          {},
  uploads:            [],
  loading:            false,
  uploading:          false,
  proyectoSel:        [],
  _prefsChannel:      null,
  _moduleSyncChannel: null,

  // Suscripciones Realtime del módulo ACK — lo llama AckWrapper al montar
  initRealtimeSync: () => {
    // ack_uploads: cuando otro usuario sube un nuevo Excel, todos recargan
    const uploadsChannel = db()
      .channel('ack-uploads-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ack_uploads' }, (payload) => {
        if (payload.new?.id !== get().currUpload?.id) get().loadAll()
      })
      .subscribe()

    // ack-module-sync: canal Broadcast compartido para forecasts en tiempo real
    const moduleSyncChannel = db()
      .channel('ack-module-sync')
      .on('broadcast', { event: 'forecast_update' }, ({ payload }) => {
        const row = payload.forecast
        if (!row?.smp) return
        set(s => ({ forecasts: { ...s.forecasts, [row.smp]: { ...(s.forecasts[row.smp] || {}), ...row } } }))
      })
      .subscribe()

    set({ _moduleSyncChannel: moduleSyncChannel })

    return () => {
      db().removeChannel(uploadsChannel)
      db().removeChannel(moduleSyncChannel)
      set({ _moduleSyncChannel: null })
    }
  },

  // Crea el canal Broadcast por usuario — lo llama AckWrapper al montar
  initPrefsChannel: (userId) => {
    const prev = get()._prefsChannel
    if (prev) db().removeChannel(prev)

    const channel = db()
      .channel(`ack-prefs:${userId}`)
      .on('broadcast', { event: 'update' }, ({ payload }) => {
        set({ proyectoSel: payload.ack_proyectos ?? [] })
      })
      .subscribe()

    set({ _prefsChannel: channel })
    return () => { db().removeChannel(channel); set({ _prefsChannel: null }) }
  },

  // Carga preferencias del usuario autenticado desde user_prefs
  loadUserPrefs: async () => {
    try {
      const { data: { user } } = await db().auth.getUser()
      if (!user) return
      const { data } = await db()
        .from('user_prefs')
        .select('ack_proyectos')
        .eq('user_id', user.id)
        .single()
      set({ proyectoSel: data?.ack_proyectos ?? [] })
    } catch { /* tabla no existe aún o sin conexión — ignorar */ }
  },

  // Actualiza estado + persiste en Supabase + notifica otros dispositivos
  setProyectoSel: (arr) => {
    set({ proyectoSel: arr })
    const channel = get()._prefsChannel
    if (channel) {
      channel.send({ type: 'broadcast', event: 'update', payload: { ack_proyectos: arr } })
        .catch(() => {})
    }
    db().auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      return db().from('user_prefs').upsert(
        { user_id: user.id, ack_proyectos: arr, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    }).catch(() => {})
  },

  loadAll: async () => {
    if (get().loading) return
    set({ loading: true, proyectoSel: [] })
    try {
      // Cargar prefs de usuario y uploads en paralelo
      const [, { data: uploads }] = await Promise.all([
        get().loadUserPrefs(),
        db().from('ack_uploads').select('*').order('loaded_at', { ascending: false }).limit(30),
      ])

      if (!uploads?.length) {
        set({ sabana: [], prevSabana: [], prevUpload: null, currUpload: null, uploads: [], loading: false })
        return
      }

      const { currUpload, prevUpload } = findComparePair(uploads)

      // 2. Cargar sabana actual + anterior en paralelo con forecasts
      const [sabRes, fcRes, prevRes] = await Promise.all([
        db().from('ack_sabana').select('*').eq('upload_id', currUpload.id),
        db().from('ack_forecast').select('*'),
        prevUpload
          ? db().from('ack_sabana').select('*').eq('upload_id', prevUpload.id)
          : Promise.resolve({ data: [] }),
      ])

      const fcMap = {}
      for (const f of (fcRes.data || [])) fcMap[f.smp] = f

      set({
        sabana:     sabRes.data  || [],
        prevSabana: prevRes.data || [],
        prevUpload,
        currUpload,
        forecasts:  fcMap,
        uploads,
      })
    } finally {
      set({ loading: false })
    }
  },

  // Carga el Excel, crea un snapshot nuevo — NO sobreescribe snapshots anteriores.
  // Los forecasts existentes en la app NO son sobreescritos (Nokia entrega el ACK sin FC).
  uploadExcel: async (file) => {
    set({ uploading: true })
    try {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array', cellDates: false })

      const sheetName = wb.SheetNames.find(n =>
        n.toLowerCase().includes('sabana') || n.toLowerCase().includes('sábana')
      )
      if (!sheetName) throw new Error('No se encontró la hoja ACK_Report_Sabana en el archivo')

      const { sabana, forecasts } = parseSheet(wb.Sheets[sheetName])
      if (!sabana.length) throw new Error('El archivo no contiene filas válidas')

      // 1. Crear registro de upload primero → obtenemos el id
      const { data: uploadRec, error: uplErr } = await db()
        .from('ack_uploads')
        .insert({ file_name: file.name, rows_loaded: sabana.length })
        .select()
        .single()
      if (uplErr) throw uplErr

      // 2. Insertar sabana con upload_id (snapshot inmutable, no upsert)
      const BATCH = 500
      const rows  = sabana.map(r => ({ ...r, upload_id: uploadRec.id }))
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await db().from('ack_sabana').insert(rows.slice(i, i + BATCH))
        if (error) throw error
      }

      // 3. Forecasts:
      //    - Si ack_forecast está vacía (primera carga) → importar desde Excel como punto de partida
      //    - Si ya tiene datos (cargas posteriores) → preservar ediciones de la app, ignorar Excel
      if (forecasts.length) {
        const { count } = await db()
          .from('ack_forecast')
          .select('*', { count: 'exact', head: true })
        const ignoreDuplicates = (count ?? 0) > 0

        for (let i = 0; i < forecasts.length; i += BATCH) {
          await db()
            .from('ack_forecast')
            .upsert(forecasts.slice(i, i + BATCH), { onConflict: 'smp', ignoreDuplicates })
        }
      }

      await get().loadAll()
      return { ok: true, rows: sabana.length }
    } catch (err) {
      return { ok: false, error: err.message }
    } finally {
      set({ uploading: false })
    }
  },

  // Guardar/editar un FC desde la tabla
  saveForecast: async (smp, fields) => {
    const row = { smp, ...fields, updated_at: new Date().toISOString() }
    const { error } = await db().from('ack_forecast')
      .upsert(row, { onConflict: 'smp' })
    if (error) throw error
    const updated = { ...(get().forecasts[smp] || {}), ...row }
    set(s => ({ forecasts: { ...s.forecasts, [smp]: updated } }))
    // Notificar a todos los usuarios del módulo ACK en tiempo real
    get()._moduleSyncChannel?.send({
      type: 'broadcast', event: 'forecast_update', payload: { forecast: updated },
    }).catch(() => {})
  },

  // Computed: SMPs con procesos pendientes (solo filas Padre o todas)
  getPendientes: (soloParent = false) => {
    const { sabana } = get()
    return sabana.filter(r => {
      if (soloParent && r.relacion !== 'P') return false
      return r.procesos_cierre_ph2 !== null && r.procesos_cierre_ph2 !== undefined
    })
  },
}))
