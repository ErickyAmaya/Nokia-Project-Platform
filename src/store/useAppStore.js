import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { TABLES } from '../lib/tables'

// ── Debounced Supabase sync ──────────────────────────────────────
const _clientId    = Math.random().toString(36).slice(2)  // unique per tab
const _syncTimers   = {}
const _pendingIds      = new Set()   // sitio IDs with un-synced local changes
const _lastWriteTime   = {}          // sitio id → ms timestamp of last upsert dispatch
const _pendingLiqIds   = new Set()   // liquidacion_cw IDs with un-synced local changes
const _pendingLiqWrite = {}          // liquidacion_cw id → ms timestamp of last upsert dispatch

function _buildSitioPayload(sitio) {
  return {
    id:               sitio.id,
    nombre:           sitio.nombre,
    tipo:             sitio.tipo,
    fecha:            sitio.fecha,
    ciudad:           sitio.ciudad,
    lc:               sitio.lc,
    cat:              sitio.cat,
    cat_efectiva:     sitio.catEfectiva || null,
    tiene_cw:         sitio.tiene_cw,
    cw_nokia:         sitio.cw_nokia,
    cw_costo:         sitio.cw_costo,
    cw_conjunto:      sitio.cw_conjunto,
    estado:           sitio.estado,
    costos:           sitio.costos,
    actividades:      sitio.actividades,
    cr_subc_excluded: sitio.crSubcExcluded || [],
    lc_visita:        sitio.lcVisita   || sitio.lc,
    lc_reporte:       sitio.lcReporte  || '',
    lc_redesign:      sitio.lcRedesign || '',
    cat_over_visita:   sitio.catOverVisita   || '',
    cat_over_reporte:  sitio.catOverReporte  || '',
    cat_over_redesign: sitio.catOverRedesign || '',
    region:            sitio.region || '',
    pct_m1:            sitio.pct_m1 ?? 100,
    main_smp:          sitio.main_smp || null,
  }
}

async function _debouncedSync(id, get, delay = 1500) {
  clearTimeout(_syncTimers[id])
  _pendingIds.add(id)
  _lastWriteTime[id] = Date.now()
  _syncTimers[id] = setTimeout(async () => {
    const sitio = get().sitios.find(s => s.id === id)
    if (!sitio) { _pendingIds.delete(id); return }
    try {
      await supabase.from(TABLES.SITIOS).upsert(_buildSitioPayload(sitio), { onConflict: 'id' })
    } finally {
      _pendingIds.delete(id)
      get()._broadcastChange()
    }
  }, delay)
}

export const useAppStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────────────
  session:    null,
  user:       null,   // { id, email, nombre, role }
  loading:    true,   // true while checking session on mount

  // ── Data ────────────────────────────────────────────────────────
  sitios:          [],
  gastos:          [],
  liquidaciones_cw: [],
  subcs:           [],
  _syncChannel:    null,

  // ── Auth shims — delegan al authStore canónico ───────────────────
  setSession: session => set({ session }),
  setLoading: loading => set({ loading }),

  login: async (email, password) => {
    const nombre = await useAuthStore.getState().login(email, password)
    return nombre
  },

  logout: async () => {
    await useAuthStore.getState().logout()
    set({ session: null, user: null, sitios: [], gastos: [], liquidaciones_cw: [], subcs: [] })
  },

  initSession: async () => {
    return useAuthStore.getState().initSession()
  },

  // ── Data actions ─────────────────────────────────────────────────
  loadData: async () => {
    const [sitiosRes, gastosRes, liqCWRes, subcRes] = await Promise.all([
      supabase.from(TABLES.SITIOS).select('*').order('created_at', { ascending: true }),
      supabase.from(TABLES.GASTOS).select('*').limit(5000),
      supabase.from(TABLES.LIQUIDACIONES_CW).select('*').limit(5000),
      supabase.from(TABLES.SUBCONTRATISTAS).select('*').order('lc'),
    ])

    const sitiosData = sitiosRes.data
    const error      = sitiosRes.error
    const gastosData = gastosRes.data
    const liqCWData  = liqCWRes.data
    const subcData   = subcRes.data

    if (error || !sitiosData) return false

    const currentSitios = get().sitios
    // Sites are CW-active if sitios.tiene_cw OR a liquidaciones_cw row exists for them.
    // This prevents CW disappearing when cw-role users can't write to the sitios table.
    const liqCWSitioIds = new Set((liqCWData || []).map(l => l.sitio_id))
    const sitios = sitiosData.map(r => {
      // If this sitio has un-synced local edits, keep the in-memory copy
      // so an external loadData() doesn't clobber the user's pending input.
      // Guard: keep in-memory copy if a write is pending OR was dispatched in last 3s
      // The 3s window covers the race where the upsert finished but loadData() resolved
      // with a stale SELECT response that was already in-flight before the write.
      const recentlyWritten = (Date.now() - (_lastWriteTime[r.id] || 0)) < 3000
      if (_pendingIds.has(r.id) || recentlyWritten) {
        const mem = currentSitios.find(s => s.id === r.id)
        if (mem) return mem
      }
      return {
        id: r.id, nombre: r.nombre, tipo: r.tipo,
        fecha: r.fecha, ciudad: r.ciudad, lc: r.lc || '',
        cat: r.cat || 'A', catEfectiva: r.cat_efectiva || undefined,
        tiene_cw: r.tiene_cw || liqCWSitioIds.has(r.id) || false, cw_nokia: r.cw_nokia || 0,
        cw_costo: r.cw_costo || 0, cw_conjunto: r.cw_conjunto || false,
        estado: r.estado || 'pre',
        lcVisita:    r.lc_visita    || r.lc || '',
        lcReporte:   r.lc_reporte   || '',
        lcRedesign:  r.lc_redesign  || '',
        catOverVisita:   r.cat_over_visita   || '',
        catOverReporte:  r.cat_over_reporte  || '',
        catOverRedesign: r.cat_over_redesign || '',
        costos: r.costos || {}, actividades: r.actividades || [],
        crSubcExcluded: r.cr_subc_excluded || [],
        region: r.region || '',
        pct_m1: r.pct_m1 ?? 100,
        main_smp: r.main_smp || null,
      }
    })

    const gastos = (gastosData || []).map(r => ({
      id: r.id,
      sitio: r.sitio_id, tipo: r.tipo || '',
      desc: r.descripcion || '', valor: r.valor || 0,
      sub_sitio: r.sub_sitio || '',
    }))

    const currentLiqs = get().liquidaciones_cw
    const liquidaciones_cw = (liqCWData || []).map(r => {
      const recentlyWritten = (Date.now() - (_pendingLiqWrite[r.id] || 0)) < 3000
      if (_pendingLiqIds.has(r.id) || recentlyWritten) {
        const mem = currentLiqs.find(l => l.id === r.id)
        if (mem) return mem
      }
      return {
        id: r.id, sitio_id: r.sitio_id, smp: r.smp || '',
        region: r.region || '', tipo_zona: r.tipo_zona || 'URBANO',
        lc: r.lc || '', estado: r.estado || 'pre', items: r.items || [],
        fecha: r.fecha || '',
      }
    })

    const subcs = (subcData || []).map(r => ({
      lc: r.lc, empresa: r.empresa || r.lc, cat: r.cat || 'A',
      tel: r.tel || '', email: r.email || '',
      tipoCuadrilla: r.tipo_cuadrilla || 'TI Ingetel',
      esInterna: r.es_interna || false,
    }))

    set({ sitios, gastos, liquidaciones_cw, subcs })
    return true
  },

  // ── Realtime sync ────────────────────────────────────────────────
  initRealtimeSync: () => {
    const reload = (msg) => {
      // Skip broadcasts originated by this same tab — store already has
      // the optimistic value; reloading would race against the pending write.
      if (msg?.payload?.from === _clientId) return
      get().loadData()
    }
    const syncChannel = supabase
      .channel('app-sync')
      .on('broadcast', { event: 'changed' }, reload)
      .subscribe()
    set({ _syncChannel: syncChannel })
    return () => {
      supabase.removeChannel(syncChannel)
      set({ _syncChannel: null })
    }
  },

  _broadcastChange: () => {
    const ch = get()._syncChannel
    if (ch) ch.send({ type: 'broadcast', event: 'changed', payload: { from: _clientId } }).catch(() => {})
  },

  hasPendingSync: () => _pendingIds.size > 0,

  setSitios: sitios => set({ sitios }),
  setGastos: gastos => set({ gastos }),

  // ── Sitio field / activity mutations ────────────────────────────
  // All helpers update local state immediately then debounce Supabase write.

  _updateAndSync: (id, updater) => {
    set(s => ({ sitios: s.sitios.map(x => x.id === id ? updater(x) : x) }))
    _debouncedSync(id, get)
  },

  updateSitioField: (id, field, value) => {
    get()._updateAndSync(id, s => ({ ...s, [field]: value }))
  },

  // Guarda main_smp sin debounce.
  // Cancela cualquier _syncTimers[id] pendiente para que el debounce
  // no lea un valor stale del store y sobreescriba Supabase con null.
  updateMainSmpNow: async (id, value) => {
    clearTimeout(_syncTimers[id])
    delete _syncTimers[id]
    set(s => ({ sitios: s.sitios.map(x => x.id === id ? { ...x, main_smp: value } : x) }))
    _pendingIds.add(id)
    _lastWriteTime[id] = Date.now()
    const sitio = get().sitios.find(s => s.id === id)
    if (!sitio) { _pendingIds.delete(id); return }
    try {
      const payload = _buildSitioPayload(sitio)
      const { error } = await supabase.from(TABLES.SITIOS).upsert(payload, { onConflict: 'id' })
      if (error) console.error('[updateMainSmpNow]', error.message)
    } finally {
      _pendingIds.delete(id)
      get()._broadcastChange()
    }
  },

  updateBackoffice: (id, value) => {
    get()._updateAndSync(id, s => ({ ...s, costos: { ...s.costos, backoffice: value } }))
  },

  updateCostoCuadrilla: (id, field, value) => {
    get()._updateAndSync(id, s => ({ ...s, costos: { ...s.costos, [field]: value } }))
  },

  // pct_m1: upsert directo sin setTimeout — _pendingIds.add ocurre síncronamente
  // antes de cualquier await, así loadData() nunca puede pisar el valor local.
  updatePctM1: (id, value) => {
    clearTimeout(_syncTimers[id])
    set(s => ({ sitios: s.sitios.map(x => x.id === id ? { ...x, pct_m1: value } : x) }))
    _pendingIds.add(id)
    _lastWriteTime[id] = Date.now()
    const sitio = get().sitios.find(s => s.id === id)
    if (!sitio) { _pendingIds.delete(id); return }
    supabase.from(TABLES.SITIOS).upsert(_buildSitioPayload(sitio), { onConflict: 'id' })
      .then(() => { _pendingIds.delete(id); get()._broadcastChange() })
      .catch(() => { _pendingIds.delete(id) })
  },

  updateSitioAct: (id, actIdx, cant) => {
    get()._updateAndSync(id, s => {
      const actividades = s.actividades.map((a, i) => i === actIdx ? { ...a, cant } : a)
      return { ...s, actividades }
    })
  },

  addActividad: (id, act) => {
    get()._updateAndSync(id, s => ({ ...s, actividades: [...s.actividades, act] }))
  },

  editActividad: (id, actIdx, changes) => {
    get()._updateAndSync(id, s => ({
      ...s,
      actividades: s.actividades.map((a, i) => i === actIdx ? { ...a, ...changes } : a),
    }))
  },

  deleteActividad: (id, actIdx) => {
    get()._updateAndSync(id, s => ({
      ...s,
      actividades: s.actividades.filter((_, i) => i !== actIdx),
      crSubcExcluded: (s.crSubcExcluded || []).filter(ei => ei !== actIdx).map(ei => ei > actIdx ? ei - 1 : ei),
    }))
  },

  exclCRSubc: (id, actIdx) => {
    get()._updateAndSync(id, s => {
      const excl = s.crSubcExcluded || []
      if (excl.includes(actIdx)) return s
      return { ...s, crSubcExcluded: [...excl, actIdx] }
    })
  },

  activarCW: (id, modo) => {
    get()._updateAndSync(id, s => ({
      ...s,
      tiene_cw:    modo !== 'no',
      cw_conjunto: modo === 'conjunto',
    }))
  },

  marcarFinal: (id) => {
    get()._updateAndSync(id, s => ({ ...s, estado: 'final' }))
  },

  reabrirSitio: (id) => {
    get()._updateAndSync(id, s => ({ ...s, estado: 'pre' }))
  },

  // ── Gasto mutations ──────────────────────────────────────────────
  agregarGasto: async (data) => {
    const row = {
      sitio_id: data.sitio, tipo: data.tipo,
      descripcion: data.desc, valor: data.valor || 0,
      sub_sitio: data.sub_sitio || null,
    }
    const { data: inserted, error } = await supabase.from(TABLES.GASTOS).insert(row).select().single()
    if (error) throw error
    set(s => ({ gastos: [...s.gastos, { id: inserted.id, sitio: inserted.sitio_id, tipo: inserted.tipo, desc: inserted.descripcion, valor: inserted.valor, sub_sitio: inserted.sub_sitio || '' }] }))
    get()._broadcastChange()
  },

  eliminarGasto: async (gastoId) => {
    const { error } = await supabase.from(TABLES.GASTOS).delete().eq('id', gastoId)
    if (error) throw error
    set(s => ({ gastos: s.gastos.filter(g => g.id !== gastoId) }))
    get()._broadcastChange()
  },

  editarGasto: async (gastoId, changes) => {
    const row = { tipo: changes.tipo, descripcion: changes.desc, valor: changes.valor }
    const { error } = await supabase.from(TABLES.GASTOS).update(row).eq('id', gastoId)
    if (error) throw error
    set(s => ({ gastos: s.gastos.map(g => g.id === gastoId ? { ...g, ...changes } : g) }))
    get()._broadcastChange()
  },

  // ── Sitio mutations ──────────────────────────────────────────────
  crearSitio: async (sitioData) => {
    const row = {
      id:         sitioData.id,
      nombre:     sitioData.nombre,
      tipo:       'TI',
      fecha:      sitioData.fecha || new Date().toISOString().split('T')[0],
      ciudad:     sitioData.ciudad,
      lc:         sitioData.lc,
      cat:        sitioData.cat || 'A',
      tiene_cw:   sitioData.tiene_cw || false,
      cw_nokia:   sitioData.cw_nokia || 0,
      cw_costo:   0,
      cw_conjunto: sitioData.cw_conjunto || false,
      estado:     'pre',
      costos:     { matTI: 0, matCW: 0, backoffice: 0 },
      actividades: [{ sec: 'MODERNIZACION', tipo: 'BASE', id: 'PM', cant: 1 }],
      region:     sitioData.region || '',
      main_smp:   sitioData.main_smp || null,
    }
    const { error } = await supabase.from(TABLES.SITIOS).insert(row)
    if (error) throw error
    const local = {
      ...row,
      catEfectiva: undefined,
      subcCW: 0, subcTI: 0,
      crSubcExcluded: [],
      lcVisita: sitioData.lc, lcReporte: '', lcRedesign: '',
      catOverVisita: '', catOverReporte: '', catOverRedesign: '',
    }
    set(s => ({ sitios: [...s.sitios, local] }))
    get()._broadcastChange()
    return local
  },

  crearTSS: async (sitioData) => {
    const row = {
      id:       sitioData.id,
      nombre:   sitioData.nombre,
      tipo:     'TSS',
      fecha:    sitioData.fecha || new Date().toISOString().split('T')[0],
      ciudad:   sitioData.ciudad || 'varios',
      lc:       sitioData.lc,
      cat:      sitioData.cat || 'A',
      tiene_cw: false,
      cw_nokia: 0, cw_costo: 0, cw_conjunto: false,
      estado:   'pre',
      costos:   { matTI: 0, matCW: 0 },
      actividades:     sitioData.actividades,
      lc_visita:       sitioData.lc,
      lc_reporte:      sitioData.lc,
      lc_redesign:     '',
      cat_over_visita: '',
      cat_over_reporte: '',
      cat_over_redesign: '',
      region: sitioData.region || '',
    }
    const { error } = await supabase.from(TABLES.SITIOS).insert(row)
    if (error) throw error
    const local = {
      id: row.id, nombre: row.nombre, tipo: 'TSS',
      fecha: row.fecha, ciudad: row.ciudad || 'varios', lc: row.lc,
      cat: row.cat, catEfectiva: undefined,
      tiene_cw: false, cw_nokia: 0, cw_costo: 0, cw_conjunto: false,
      estado: 'pre', costos: row.costos,
      actividades: row.actividades, crSubcExcluded: [],
      lcVisita: row.lc, lcReporte: row.lc, lcRedesign: '',
      catOverVisita: '', catOverReporte: '', catOverRedesign: '',
    }
    set(s => ({ sitios: [...s.sitios, local] }))
    get()._broadcastChange()
    return local
  },

  eliminarSitio: async (id) => {
    // Solo admin y coordinador pueden eliminar sitios
    if (!useAuthStore.getState().canDelete()) {
      throw Object.assign(new Error('Sin permisos para eliminar sitios'), { code: 'FORBIDDEN' })
    }
    const { sitios, gastos, liquidaciones_cw } = get()
    const tieneCW = liquidaciones_cw.some(l => l.sitio_id === id)

    if (tieneCW) {
      await supabase.from(TABLES.LIQUIDACIONES_CW).delete().eq('sitio_id', id)
    }
    const { error } = await supabase.from(TABLES.SITIOS).delete().eq('id', id)
    if (error) throw error

    set({
      sitios:           sitios.filter(s => s.id !== id),
      gastos:           gastos.filter(g => g.sitio !== id),
      liquidaciones_cw: liquidaciones_cw.filter(l => l.sitio_id !== id),
    })
    get()._broadcastChange()
  },

  // ── Realtime patch ───────────────────────────────────────────
  // Called by useRealtime hook with raw DB records (snake_case)
  applyRT: (table, event, rec) => {
    if (table === TABLES.SITIOS) {
      const local = {
        id: rec.id, nombre: rec.nombre, tipo: rec.tipo,
        fecha: rec.fecha, ciudad: rec.ciudad, lc: rec.lc,
        cat: rec.cat, catEfectiva: rec.cat_efectiva || undefined,
        tiene_cw: rec.tiene_cw || false, cw_nokia: rec.cw_nokia || 0,
        cw_costo: rec.cw_costo || 0, cw_conjunto: rec.cw_conjunto || false,
        estado: rec.estado || 'pre', costos: rec.costos || {},
        actividades: rec.actividades || [],
        crSubcExcluded: rec.cr_subc_excluded || [],
        lcVisita:   rec.lc_visita   || rec.lc || '',
        lcReporte:  rec.lc_reporte  || '',
        lcRedesign: rec.lc_redesign || '',
        catOverVisita:   rec.cat_over_visita   || '',
        catOverReporte:  rec.cat_over_reporte  || '',
        catOverRedesign: rec.cat_over_redesign || '',
        region:          rec.region            || '',
        pct_m1:          rec.pct_m1            ?? 100,
      }
      set(s => {
        if (event === 'INSERT') {
          if (s.sitios.find(x => x.id === rec.id)) return {}
          return { sitios: [...s.sitios, local] }
        }
        if (event === 'UPDATE') {
          return { sitios: s.sitios.map(x => x.id === rec.id ? local : x) }
        }
        if (event === 'DELETE') {
          return { sitios: s.sitios.filter(x => x.id !== rec.id) }
        }
        return {}
      })
    }

    if (table === TABLES.GASTOS) {
      const g = { id: rec.id, sitio: rec.sitio_id, tipo: rec.tipo || '', desc: rec.descripcion || '', valor: rec.valor || 0, sub_sitio: rec.sub_sitio || '' }
      set(s => {
        if (event === 'INSERT') {
          if (s.gastos.find(x => x.id === rec.id)) return {}
          return { gastos: [...s.gastos, g] }
        }
        if (event === 'UPDATE') return { gastos: s.gastos.map(x => x.id === rec.id ? g : x) }
        if (event === 'DELETE') return { gastos: s.gastos.filter(x => x.id !== rec.id) }
        return {}
      })
    }

    if (table === TABLES.SUBCONTRATISTAS) {
      const sc = { lc: rec.lc, empresa: rec.empresa || rec.lc, cat: rec.cat || 'A', tel: rec.tel || '', email: rec.email || '', tipoCuadrilla: rec.tipo_cuadrilla || 'TI Ingetel', esInterna: rec.es_interna || false }
      set(s => {
        if (event === 'INSERT') {
          if (s.subcs.find(x => x.lc === rec.lc)) return {}
          return { subcs: [...s.subcs, sc].sort((a, b) => a.lc.localeCompare(b.lc)) }
        }
        if (event === 'UPDATE') return { subcs: s.subcs.map(x => x.lc === rec.lc ? sc : x) }
        if (event === 'DELETE') return { subcs: s.subcs.filter(x => x.lc !== rec.lc) }
        return {}
      })
    }

    if (table === TABLES.LIQUIDACIONES_CW) {
      const liq = {
        id: rec.id, sitio_id: rec.sitio_id, smp: rec.smp || '',
        region: rec.region || '', tipo_zona: rec.tipo_zona || 'URBANO',
        lc: rec.lc || '', estado: rec.estado || 'pre', items: rec.items || [],
        fecha: rec.fecha || '',
      }
      set(s => {
        if (event === 'INSERT') {
          if (s.liquidaciones_cw.find(x => x.id === rec.id)) return {}
          return {
            liquidaciones_cw: [...s.liquidaciones_cw, liq],
            sitios: s.sitios.map(x => x.id === rec.sitio_id ? { ...x, tiene_cw: true } : x),
          }
        }
        if (event === 'UPDATE') {
          const recentlyWritten = (Date.now() - (_pendingLiqWrite[rec.id] || 0)) < 3000
          if (_pendingLiqIds.has(rec.id) || recentlyWritten) return {}
          return { liquidaciones_cw: s.liquidaciones_cw.map(x => x.id === rec.id ? liq : x) }
        }
        if (event === 'DELETE') {
          const remaining = s.liquidaciones_cw.filter(x => x.id !== rec.id)
          const stillHasCW = remaining.some(x => x.sitio_id === rec.sitio_id)
          return {
            liquidaciones_cw: remaining,
            sitios: stillHasCW ? s.sitios : s.sitios.map(x => x.id === rec.sitio_id ? { ...x, tiene_cw: false } : x),
          }
        }
        return {}
      })
    }
  },

  // ── Subcontratistas CRUD ─────────────────────────────────────
  crearSubc: async (data) => {
    const row = {
      lc:             data.lc.trim(),
      empresa:        data.empresa.trim(),
      cat:            data.cat || 'A',
      tel:            data.tel  || '',
      email:          data.email || '',
      tipo_cuadrilla: data.tipoCuadrilla || 'TI Ingetel',
      es_interna:     data.esInterna || false,
    }
    const { error } = await supabase.from(TABLES.SUBCONTRATISTAS).insert(row)
    if (error) throw error
    const local = { lc: row.lc, empresa: row.empresa, cat: row.cat, tel: row.tel, email: row.email, tipoCuadrilla: row.tipo_cuadrilla, esInterna: row.es_interna }
    set(s => ({ subcs: [...s.subcs, local].sort((a, b) => a.lc.localeCompare(b.lc)) }))
    get()._broadcastChange()
    return local
  },

  actualizarSubc: async (originalLc, data) => {
    const newLc = data.lc?.trim() || originalLc
    const row = {
      lc:             newLc,
      empresa:        data.empresa.trim(),
      cat:            data.cat || 'A',
      tel:            data.tel  || '',
      email:          data.email || '',
      tipo_cuadrilla: data.tipoCuadrilla || 'TI Ingetel',
      es_interna:     data.esInterna || false,
    }
    const { error } = await supabase.from(TABLES.SUBCONTRATISTAS).update(row).eq('lc', originalLc)
    if (error) throw error
    const lcChanged = newLc !== originalLc
    set(s => ({
      subcs: s.subcs.map(x => x.lc === originalLc
        ? { lc: newLc, empresa: row.empresa, cat: row.cat, tel: row.tel, email: row.email, tipoCuadrilla: row.tipo_cuadrilla, esInterna: row.es_interna }
        : x
      ),
      ...(lcChanged ? { sitios: s.sitios.map(x => x.lc === originalLc ? { ...x, lc: newLc } : x) } : {}),
    }))
    get()._broadcastChange()
  },

  eliminarSubc: async (lc) => {
    const { error } = await supabase.from(TABLES.SUBCONTRATISTAS).delete().eq('lc', lc)
    if (error) throw error
    set(s => ({ subcs: s.subcs.filter(x => x.lc !== lc) }))
    get()._broadcastChange()
  },

  // ── Liquidaciones CW ─────────────────────────────────────────
  saveLiqCW: async (liq) => {
    // Upsert local state immediately
    set(s => {
      const idx = s.liquidaciones_cw.findIndex(l => l.id === liq.id)
      const updated = idx >= 0
        ? s.liquidaciones_cw.map(l => l.id === liq.id ? liq : l)
        : [...s.liquidaciones_cw, liq]
      // Sync cw_nokia / cw_costo to the site if individual mode
      const sitio = s.sitios.find(x => x.id === liq.sitio_id)
      let sitios = s.sitios
      if (sitio && sitio.tiene_cw && !sitio.cw_conjunto) {
        const totNokia = (liq.items || []).reduce((t, i) => t + (i.cant || 0) * (i.precio_nokia || 0), 0)
        const totSubc  = (liq.items || []).reduce((t, i) => t + (i.cant || 0) * (i.precio_subc  || 0), 0)
        sitios = s.sitios.map(x => x.id === liq.sitio_id
          ? { ...x, cw_nokia: Math.round(totNokia), cw_costo: Math.round(totSubc) }
          : x)
        _debouncedSync(liq.sitio_id, get)
      }
      return { liquidaciones_cw: updated, sitios }
    })
    // Debounced Supabase upsert — guard against loadData() clobbering pending edits
    clearTimeout(_syncTimers['liq_cw_' + liq.id])
    _pendingLiqIds.add(liq.id)
    _pendingLiqWrite[liq.id] = Date.now()
    _syncTimers['liq_cw_' + liq.id] = setTimeout(async () => {
      try {
        const { error } = await supabase.from(TABLES.LIQUIDACIONES_CW).upsert({
          id: liq.id, sitio_id: liq.sitio_id, smp: liq.smp,
          region: liq.region, tipo_zona: liq.tipo_zona,
          lc: liq.lc, estado: liq.estado, items: liq.items,
        }, { onConflict: 'id' })
        if (error) console.error('[saveLiqCW] upsert failed:', error.message)
      } finally {
        _pendingLiqIds.delete(liq.id)
        get()._broadcastChange()
      }
    }, 2000)
  },

  deleteLiqCW: async (liqId) => {
    const { error } = await supabase.from(TABLES.LIQUIDACIONES_CW).delete().eq('id', liqId)
    if (error) throw error
    set(s => ({ liquidaciones_cw: s.liquidaciones_cw.filter(l => l.id !== liqId) }))
    get()._broadcastChange()
  },

  quitarCW: async (sitioId) => {
    const { liquidaciones_cw } = get()
    const liq = liquidaciones_cw.find(l => l.sitio_id === sitioId)
    if (liq) {
      await supabase.from(TABLES.LIQUIDACIONES_CW).delete().eq('id', liq.id)
    }
    const { error } = await supabase.from(TABLES.SITIOS).update({
      tiene_cw: false, cw_conjunto: false, cw_nokia: 0, cw_costo: 0,
    }).eq('id', sitioId)
    if (error) throw error
    set(s => ({
      liquidaciones_cw: s.liquidaciones_cw.filter(l => l.sitio_id !== sitioId),
      sitios: s.sitios.map(x => x.id === sitioId
        ? { ...x, tiene_cw: false, cw_conjunto: false, cw_nokia: 0, cw_costo: 0 }
        : x
      ),
    }))
    get()._broadcastChange()
  },

  marcarFinalLiqCW: async (id, estado) => {
    const liq = get().liquidaciones_cw.find(l => l.id === id)
    if (!liq) return
    const updated = { ...liq, estado }
    await get().saveLiqCW(updated)
  },

}))

// ── Sync authStore → useAppStore ─────────────────────────────────
// Mirrors user/session/loading/empresa so legacy consumers of
// useAppStore (e.g. Layout, ProtectedRoute) continue working.
useAuthStore.subscribe(auth => {
  useAppStore.setState({
    user:    auth.user,
    session: auth.session,
    loading: auth.loading,
    empresa: auth.empresa,
  })
})
