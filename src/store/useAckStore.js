import { create } from 'zustand'
import * as XLSX   from 'xlsx'
import { getSupabaseClient } from '../lib/supabase'

const db = () => getSupabaseClient()

// ── Alias de columnas Nokia (exactos, case-insensitive) ───────────
// Cada campo lista los posibles textos de encabezado que Nokia usa.
// findCol los busca por coincidencia exacta; si no encuentra, usa el índice fijo de respaldo.
const COL_NAMES = {
  smp:                     ['smp'],
  main_smp:                ['main_smp'],
  relacion:                ['Relacion', 'relacion'],
  site_name:               ['siteName', 'site_name'],
  region:                  ['region'],
  proyecto_alcance:        ['proyecto_alcance'],
  sub_proyecto:            ['sub_proyecto'],
  mos:                     ['mos'],
  instalacion:             ['instalacion'],
  integracion:             ['integracion'],
  dias_integracion:        ['Dias_Integracion',        'dias_integracion'],
  semanas_integracion:     ['Semanas_Integracion',     'semanas_integracion'],
  pct_valoracion:          ['%Valoracion',             'pct_valoracion'],
  rango_valorizacion:      ['Rango_Valorizacion',      'rango_valorizacion'],
  procesos_cierre_ph2:     ['Procesos_Cierre_PH2',     'procesos_cierre_ph2'],
  procesos_cierre_ph2_tot: ['Procesos_Cierre_PH2_Tot', 'procesos_cierre_ph2_tot'],
  gap_log_inv:             ['GAP_LOG_INV',             'gap_log_inv'],
  gap_doc:                 ['GAP_DOC',                 'gap_doc'],
  gap_hw_cierre:           ['GAP_HW_Cierre',           'gap_hw_cierre'],
  gap_site_owner:          ['GAP_SiteOwner',           'gap_site_owner'],
  gap_on_air:              ['GAP_OnAir',               'gap_on_air'],
  val_gap_doc:             ['ValGAP_DOC',              'val_gap_doc'],
  val_gap_hw_cierre:       ['ValGAP_HW_Cierre',        'val_gap_hw_cierre'],
  val_gap_log_inv:         ['ValGAP_LOG_INV',          'val_gap_log_inv'],
  val_gap_site_owner:      ['ValGAP_SiteOwner',        'val_gap_site_owner'],
  val_gap_on_air:          ['ValGAP_OnAir',            'val_gap_on_air'],
  tickets_total:           ['Tickets_Total',           'tickets_total'],
  tickets_areas:           ['Tickets_Areas',           'tickets_areas'],
  tickets_id:              ['Tickets_ID',              'tickets_id'],
  ticket_doc_owner:        ['Ticket_DOC_Owner',        'ticket_doc_owner'],
  ticket_log_inv_owner:    ['Ticket_LOG_INV_Owner',    'ticket_log_inv_owner'],
  ticket_hw_cierre_owner:  ['Ticket_HW_Cierre_Owner',  'ticket_hw_cierre_owner'],
  ticket_so_owner:         ['Ticket_SO_Owner',         'ticket_so_owner'],
  ticket_on_air_owner:     ['Ticket_ON_AIR_Owner',     'ticket_on_air_owner'],
  fc_avance_doc:           ['FC_Avance_DOC',           'fc_avance_doc',        'FC Avance DOC',       'Fc_Avance_DOC'],
  fc_cierre_doc:           ['FC_Cierre_DOC',           'fc_cierre_doc',        'FC Cierre DOC',       'Fc_Cierre_DOC'],
  fc_avance_hw_cierre:     ['FC_Avance_HW_Cierre',     'fc_avance_hw_cierre',  'FC Avance HW Cierre', 'Fc_Avance_HW_Cierre'],
  fc_cierre_hw_cierre:     ['FC_Cierre_HW_Cierre',     'fc_cierre_hw_cierre',  'FC Cierre HW Cierre', 'FC_re_HW_Cierre'],
  fc_avance_site_owner:    ['FC_Avance_SiteOwner',     'fc_avance_site_owner', 'FC Avance SiteOwner', 'FC_Avance_Site_Owner'],
  fc_cierre_site_owner:    ['FC_Cierre_SiteOwner',     'fc_cierre_site_owner', 'FC Cierre SiteOwner', 'FC_Cierre_Site_Owner'],
  fc_avance_on_air:        ['FC_Avance_OnAir',         'fc_avance_on_air',     'FC Avance OnAir',     'FC_Avance_On_Air'],
  fc_cierre_on_air:        ['FC_Cierre_OnAir',         'fc_cierre_on_air',     'FC Cierre OnAir',     'FC_Cierre_On_Air'],
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

// Busca el índice de una columna por coincidencia exacta (case-insensitive) en el encabezado.
// Si ningún alias coincide, retorna fallbackIdx.
function makeColFinder(headerRow) {
  return function findCol(fallbackIdx, field) {
    const aliases = COL_NAMES[field] || []
    for (const alias of aliases) {
      const a = alias.toLowerCase().trim()
      const idx = headerRow.findIndex(h => (h == null ? '' : String(h)).toLowerCase().trim() === a)
      if (idx >= 0) return idx
    }
    return fallbackIdx
  }
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
  // Leer como array de arrays para detectar columnas por encabezado independientemente de posición
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  if (allRows.length < 2) return { sabana: [], forecasts: [] }

  const headerRow = allRows[0]
  const findCol   = makeColFinder(headerRow)

  // Si Nokia agrega columnas extra al inicio (ej. SS_E2E), los índices de respaldo se desplazan
  const colOffset = headerRow.findIndex(
    h => (h == null ? '' : String(h)).toLowerCase().trim() === 'smp'
  )
  const o = colOffset > 0 ? colOffset : 0

  // Índices de columna — detectados por alias exacto, respaldo en índice fijo + offset
  const iSmp      = findCol(0  + o, 'smp')
  const iMainSmp  = findCol(1  + o, 'main_smp')
  const iRelacion = findCol(2  + o, 'relacion')
  const iSiteName = findCol(3  + o, 'site_name')
  const iRegion   = findCol(4  + o, 'region')
  const iProyAlc  = findCol(5  + o, 'proyecto_alcance')
  const iSubProy  = findCol(6  + o, 'sub_proyecto')
  const iMos      = findCol(7  + o, 'mos')
  const iInstal   = findCol(8  + o, 'instalacion')
  const iInteg    = findCol(9  + o, 'integracion')
  const iDiasI    = findCol(10 + o, 'dias_integracion')
  const iSemI     = findCol(11 + o, 'semanas_integracion')
  const iPctVal   = findCol(12 + o, 'pct_valoracion')
  const iRangoV   = findCol(13 + o, 'rango_valorizacion')
  const iProcPh2  = findCol(14 + o, 'procesos_cierre_ph2')
  const iProcPh2T = findCol(15 + o, 'procesos_cierre_ph2_tot')
  const iGapLog   = findCol(16 + o, 'gap_log_inv')
  const iGapDoc   = findCol(17 + o, 'gap_doc')
  const iGapHw    = findCol(18 + o, 'gap_hw_cierre')
  const iGapSO    = findCol(19 + o, 'gap_site_owner')
  const iGapOA    = findCol(20 + o, 'gap_on_air')
  const iValDoc   = findCol(21 + o, 'val_gap_doc')
  const iValHw    = findCol(22 + o, 'val_gap_hw_cierre')
  const iValLog   = findCol(23 + o, 'val_gap_log_inv')
  const iValSO    = findCol(24 + o, 'val_gap_site_owner')
  const iValOA    = findCol(25 + o, 'val_gap_on_air')
  const iTktTot   = findCol(26 + o, 'tickets_total')
  const iTktAreas = findCol(27 + o, 'tickets_areas')
  const iTktId    = findCol(28 + o, 'tickets_id')
  const iTktDoc   = findCol(29 + o, 'ticket_doc_owner')
  const iTktLog   = findCol(30 + o, 'ticket_log_inv_owner')
  const iTktHw    = findCol(31 + o, 'ticket_hw_cierre_owner')
  const iTktSO    = findCol(32 + o, 'ticket_so_owner')
  const iTktOA    = findCol(33 + o, 'ticket_on_air_owner')
  const iFcAvDoc  = findCol(34 + o, 'fc_avance_doc')
  const iFcCDoc   = findCol(35 + o, 'fc_cierre_doc')
  const iFcAvHw   = findCol(36 + o, 'fc_avance_hw_cierre')
  const iFcCHw    = findCol(37 + o, 'fc_cierre_hw_cierre')
  const iFcAvSO   = findCol(38 + o, 'fc_avance_site_owner')
  const iFcCSO    = findCol(39 + o, 'fc_cierre_site_owner')
  const iFcAvOA   = findCol(40 + o, 'fc_avance_on_air')
  const iFcCOA    = findCol(41 + o, 'fc_cierre_on_air')

  function g(row, idx) {
    const v = row[idx]
    return (v === null || v === undefined || v === '') ? null : v
  }

  const sabana = []
  const forecasts = []

  for (let i = 1; i < allRows.length; i++) {
    const r = allRows[i]
    const smp = g(r, iSmp)
    if (!smp) continue

    sabana.push({
      smp,
      main_smp:                g(r, iMainSmp) || smp,
      relacion:                g(r, iRelacion),
      site_name:               g(r, iSiteName),
      region:                  g(r, iRegion),
      proyecto_alcance:        g(r, iProyAlc),
      sub_proyecto:            g(r, iSubProy),
      mos:                     toDate(g(r, iMos)),
      instalacion:             toDate(g(r, iInstal)),
      integracion:             toDate(g(r, iInteg)),
      dias_integracion:        toInt(g(r, iDiasI)),
      semanas_integracion:     toInt(g(r, iSemI)),
      pct_valoracion:          toNum(g(r, iPctVal)),
      rango_valorizacion:      g(r, iRangoV),
      procesos_cierre_ph2:     g(r, iProcPh2),
      procesos_cierre_ph2_tot: toInt(g(r, iProcPh2T)),
      gap_log_inv:             g(r, iGapLog),
      gap_doc:                 g(r, iGapDoc),
      gap_hw_cierre:           g(r, iGapHw),
      gap_site_owner:          g(r, iGapSO),
      gap_on_air:              g(r, iGapOA),
      val_gap_doc:             toNum(g(r, iValDoc)),
      val_gap_hw_cierre:       toNum(g(r, iValHw)),
      val_gap_log_inv:         toNum(g(r, iValLog)),
      val_gap_site_owner:      toNum(g(r, iValSO)),
      val_gap_on_air:          toNum(g(r, iValOA)),
      tickets_total:           toNum(g(r, iTktTot)),
      tickets_areas:           g(r, iTktAreas),
      tickets_id:              String(g(r, iTktId) ?? '').trim() || null,
      ticket_doc_owner:        g(r, iTktDoc),
      ticket_log_inv_owner:    g(r, iTktLog),
      ticket_hw_cierre_owner:  g(r, iTktHw),
      ticket_so_owner:         g(r, iTktSO),
      ticket_on_air_owner:     g(r, iTktOA),
      uploaded_at:             new Date().toISOString(),
    })

    // FC columns — solo si tienen valor
    const fc = {
      smp,
      fc_avance_doc:        toDate(g(r, iFcAvDoc)),
      fc_cierre_doc:        g(r, iFcCDoc),
      fc_avance_hw_cierre:  toDate(g(r, iFcAvHw)),
      fc_cierre_hw_cierre:  g(r, iFcCHw),
      fc_avance_site_owner: toDate(g(r, iFcAvSO)),
      fc_cierre_site_owner: g(r, iFcCSO),
      fc_avance_on_air:     toDate(g(r, iFcAvOA)),
      fc_cierre_on_air:     g(r, iFcCOA),
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

// ── Extraer fecha ISO del nombre de archivo Nokia ────────────────────
// Intenta YYYYMMDD primero, luego DDMMYYYY. Retorna ISO string o null.
function dateFromFilename(filename) {
  if (!filename) return null
  function valid(y, mo, d) {
    if (+y < 2020 || +y > 2035 || +mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null
    return new Date(Date.UTC(+y, +mo - 1, +d)).toISOString()
  }
  let m = filename.match(/(\d{4})(\d{2})(\d{2})/)
  if (m) { const r = valid(m[1], m[2], m[3]); if (r) return r }
  m = filename.match(/(\d{2})(\d{2})(\d{4})/)
  if (m) { const r = valid(m[3], m[2], m[1]); if (r) return r }
  return null
}

// Semana Nokia de un upload: usa fecha del filename, cae a loaded_at si no parsea.
function getUploadWeek(u) {
  return getNokiaWeek(dateFromFilename(u.file_name) || u.loaded_at)
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

  // De-duplicar por semana Nokia (desde filename): queda el upload más reciente de cada semana
  const weekMap = new Map()
  for (const u of uploads) { // uploads ya viene DESC por loaded_at
    const { week, year } = getUploadWeek(u)
    const key = `${year}-${week}`
    if (!weekMap.has(key)) weekMap.set(key, u)
  }
  const weeks = [...weekMap.values()]
    .sort((a, b) => {
      const wa = getUploadWeek(a), wb = getUploadWeek(b)
      if (wb.year !== wa.year) return wb.year - wa.year
      if (wb.week !== wa.week) return wb.week - wa.week
      return new Date(b.loaded_at) - new Date(a.loaded_at) // desempate: más reciente primero
    })

  // Diferencia en semanas Nokia reales usando fecha del archivo
  function weeksDiff(a, b) {
    const wa = getUploadWeek(a)
    const wb = getUploadWeek(b)
    if (wa.year === wb.year) return wa.week - wb.week
    // Cruce de año: contar semanas del año anterior
    const lastWeekOfPrevYear = getNokiaWeek(
      new Date(Date.UTC(wb.year, 11, 28)).toISOString()
    ).week
    return lastWeekOfPrevYear - wb.week + wa.week
  }

  // currUpload es SIEMPRE el upload más reciente (weeks[0]).
  // Buscamos el mejor prevUpload para comparar contra él.

  // Paso 1: buscar prevUpload con diferencia EXACTA de 2 semanas Nokia
  for (let j = 1; j < weeks.length; j++) {
    if (weeksDiff(weeks[0], weeks[j]) === 2) {
      return { currUpload: weeks[0], prevUpload: weeks[j] }
    }
  }

  // Paso 2: aceptar cualquier prevUpload con diferencia ≥ 2 semanas
  for (let j = 1; j < weeks.length; j++) {
    if (weeksDiff(weeks[0], weeks[j]) >= 2) {
      return { currUpload: weeks[0], prevUpload: weeks[j] }
    }
  }

  // Sin par válido: solo curr, sin comparación
  return { currUpload: weeks[0], prevUpload: null }
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
  estadosOcultos:     {},
  manualPrevSabana:   [],
  manualPrevFileName: null,
  _prefsChannel:      null,

  // Suscripciones Realtime del módulo ACK — lo llama AckWrapper al montar
  initRealtimeSync: () => {
    // ack_uploads: cuando otro usuario sube un nuevo Excel, todos recargan
    const uploadsChannel = db()
      .channel('ack-uploads-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ack_uploads' }, (payload) => {
        if (payload.new?.id !== get().currUpload?.id) get().loadAll()
      })
      .subscribe()

    // ack_forecast: sincronización en tiempo real entre dispositivos
    const forecastChannel = db()
      .channel('ack-forecast-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ack_forecast' }, () => get().loadForecasts())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ack_forecast' }, () => get().loadForecasts())
      .subscribe()

    return () => {
      db().removeChannel(uploadsChannel)
      db().removeChannel(forecastChannel)
    }
  },

  // Recarga solo los forecasts — liviano, usado en polling
  loadForecasts: async () => {
    try {
      const { data } = await db().from('ack_forecast').select('*')
      if (!data) return
      const fcMap = {}
      for (const f of data) fcMap[f.smp] = f
      set({ forecasts: fcMap })
    } catch {}
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
        .maybeSingle()
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
      // Leer IDs cacheados para lanzar todo en paralelo sin esperar la lista de uploads
      let cachedCurrId = null, cachedPrevId = null
      try {
        const c = JSON.parse(localStorage.getItem('ack_upload_ids') || 'null')
        if (c) { cachedCurrId = c.curr; cachedPrevId = c.prev }
      } catch {}

      // Lanzar todo en paralelo: prefs + uploads + sabanas (usando IDs cacheados)
      const [, { data: uploads }, sabCacheRes, fcRes, prevCacheRes] = await Promise.all([
        get().loadUserPrefs(),
        db().from('ack_uploads').select('*').order('loaded_at', { ascending: false }).limit(30),
        cachedCurrId
          ? db().from('ack_sabana').select('*').eq('upload_id', cachedCurrId).limit(20000)
          : Promise.resolve({ data: null }),
        db().from('ack_forecast').select('*'),
        cachedPrevId
          ? db().from('ack_sabana').select('*').eq('upload_id', cachedPrevId).limit(20000)
          : Promise.resolve({ data: null }),
      ])

      if (!uploads?.length) {
        set({ sabana: [], prevSabana: [], prevUpload: null, currUpload: null, uploads: [], loading: false })
        localStorage.removeItem('ack_upload_ids')
        return
      }

      const { currUpload, prevUpload } = findComparePair(uploads)

      const fcMap = {}
      for (const f of (fcRes.data || [])) fcMap[f.smp] = f

      // Si los IDs cacheados coinciden → usar datos ya descargados (1 RTT total)
      // Si no coinciden (nuevo upload) → refetch con los IDs correctos
      const cacheHit = cachedCurrId === currUpload.id
      let sabana, prevSabana

      if (cacheHit) {
        sabana     = sabCacheRes.data || []
        prevSabana = (prevUpload && cachedPrevId === prevUpload.id)
          ? (prevCacheRes.data || [])
          : (prevUpload ? (await db().from('ack_sabana').select('*').eq('upload_id', prevUpload.id).limit(20000)).data || [] : [])
      } else {
        // IDs cambiaron → recargar sabanas con los correctos
        const [sabRes, prevRes] = await Promise.all([
          db().from('ack_sabana').select('*').eq('upload_id', currUpload.id).limit(20000),
          prevUpload
            ? db().from('ack_sabana').select('*').eq('upload_id', prevUpload.id).limit(20000)
            : Promise.resolve({ data: [] }),
        ])
        sabana     = sabRes.data  || []
        prevSabana = prevRes.data || []
      }

      // Guardar IDs en caché para la próxima sesión
      try { localStorage.setItem('ack_upload_ids', JSON.stringify({ curr: currUpload.id, prev: prevUpload?.id || null })) } catch {}

      set({ sabana, prevSabana, prevUpload, currUpload, forecasts: fcMap, uploads })
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

  // Carga ACK anterior solo en memoria — sin guardar en Supabase
  loadManualPrev: async (file) => {
    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array', cellDates: false })
      const sheetName = wb.SheetNames.find(n =>
        n.toLowerCase().includes('sabana') || n.toLowerCase().includes('sábana')
      )
      if (!sheetName) return { ok: false, error: 'No se encontró la hoja ACK_Report_Sabana' }
      const { sabana } = parseSheet(wb.Sheets[sheetName])
      if (!sabana.length) return { ok: false, error: 'El archivo no contiene filas válidas' }
      set({ manualPrevSabana: sabana, manualPrevFileName: file.name })
      return { ok: true, rows: sabana.length }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  clearManualPrev: () => set({ manualPrevSabana: [], manualPrevFileName: null }),

  // Estados ocultos del reporte Nokia (compartido, guardado en config)
  loadEstadosOcultos: async () => {
    const { data } = await db().from('config').select('value').eq('key', 'ack_estados_ocultos').single()
    if (data?.value) {
      try { set({ estadosOcultos: JSON.parse(data.value) }) } catch {}
    }
  },

  saveEstadosOcultos: async (ocultos) => {
    await db().from('config')
      .upsert({ key: 'ack_estados_ocultos', value: JSON.stringify(ocultos) }, { onConflict: 'key' })
    set({ estadosOcultos: ocultos })
  },

  // Guardar/editar un FC desde la tabla
  saveForecast: async (smp, fields) => {
    const row = { smp, ...fields, updated_at: new Date().toISOString() }
    const { error } = await db().from('ack_forecast')
      .upsert(row, { onConflict: 'smp' })
    if (error) throw error
    set(s => ({ forecasts: { ...s.forecasts, [smp]: { ...(s.forecasts[smp] || {}), ...row } } }))
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
