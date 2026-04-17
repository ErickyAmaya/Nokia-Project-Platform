import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

// ── Debounced Supabase sync ──────────────────────────────────────
const _syncTimers = {}
async function _debouncedSync(id, get) {
  clearTimeout(_syncTimers[id])
  _syncTimers[id] = setTimeout(async () => {
    const sitio = get().sitios.find(s => s.id === id)
    if (!sitio) return
    await supabase.from('sitios').upsert({
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
    }, { onConflict: 'id' })
  }, 1500)
}

const DEFAULT_EMPRESA = {
  nombre:         'Empresa',
  nombre_corto:   'Nokia',
  logo_url:       '',
  color_primario: '#144E4A',
  tipos_cuadrilla: [],
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
  catalogCW:       [],   // {actividad_id, nombre, unidad, precio_nokia_urbano, precio_nokia_rural, precio_subc_urbano, precio_subc_rural}
  catalogTI:       [],   // {id, nombre, unidad, seccion, nokia:[4], A:[4], AA:[4], AAA:[4]}
  subcs:           [],
  empresaConfig:   DEFAULT_EMPRESA,

  // ── Derived role helpers (delegan a authStore) ──────────────────
  isAdmin:  () => useAuthStore.getState().user?.role === 'admin',
  isCoord:  () => useAuthStore.getState().user?.role === 'coordinador',
  isViewer: () => useAuthStore.getState().user?.role === 'viewer',

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
    const { data: sitiosData, error } = await supabase
      .from('sitios')
      .select('*')
      .order('created_at', { ascending: true })

    if (error || !sitiosData) return false

    const [{ data: gastosData }, { data: liqCWData }, { data: subcData }, { data: catCWData }, { data: catTIData }] = await Promise.all([
      supabase.from('gastos').select('*'),
      supabase.from('liquidaciones_cw').select('*'),
      supabase.from('subcontratistas').select('*').order('lc'),
      supabase.from('catalogo_cw').select('*').order('actividad_id'),
      supabase.from('catalogo_ti').select('*').order('seccion').order('id'),
    ])

    const sitios = sitiosData.map(r => ({
      id: r.id, nombre: r.nombre, tipo: r.tipo,
      fecha: r.fecha, ciudad: r.ciudad, lc: r.lc || '',
      cat: r.cat || 'A', catEfectiva: r.cat_efectiva || undefined,
      tiene_cw: r.tiene_cw || false, cw_nokia: r.cw_nokia || 0,
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
    }))

    const gastos = (gastosData || []).map(r => ({
      id: r.id,
      sitio: r.sitio_id, tipo: r.tipo || '',
      desc: r.descripcion || '', valor: r.valor || 0,
      sub_sitio: r.sub_sitio || '',
    }))

    const liquidaciones_cw = (liqCWData || []).map(r => ({
      id: r.id, sitio_id: r.sitio_id, smp: r.smp || '',
      region: r.region || '', tipo_zona: r.tipo_zona || 'URBANO',
      lc: r.lc || '', estado: r.estado || 'pre', items: r.items || [],
      fecha: r.fecha || '',
    }))

    const subcs = (subcData || []).map(r => ({
      lc: r.lc, empresa: r.empresa || r.lc, cat: r.cat || 'A',
      tel: r.tel || '', email: r.email || '',
      tipoCuadrilla: r.tipo_cuadrilla || 'TI Ingetel',
    }))

    const catalogCW = (catCWData || []).map(r => ({
      actividad_id:         r.actividad_id,
      nombre:               r.nombre || r.actividad_id,
      unidad:               (r.unidad || 'UN').trim(),
      precio_nokia_urbano:  r.precio_nokia_urbano  || 0,
      precio_nokia_rural:   r.precio_nokia_rural   || 0,
      precio_subc_urbano:   r.precio_subc_urbano   || 0,
      precio_subc_rural:    r.precio_subc_rural    || 0,
    }))

    const _n = v => (v === null || v === undefined) ? null : Number(v)
    const catalogTI = (catTIData || []).map(r => ({
      id:      r.id,
      nombre:  r.nombre || r.id,
      unidad:  (r.unidad || 'UN').trim(),
      seccion: r.seccion || 'BASE',
      nokia: [_n(r.nokia_0), _n(r.nokia_1), _n(r.nokia_2), _n(r.nokia_3)],
      A:     [_n(r.a_0),     _n(r.a_1),     _n(r.a_2),     _n(r.a_3)],
      AA:    [_n(r.aa_0),    _n(r.aa_1),    _n(r.aa_2),    _n(r.aa_3)],
      AAA:   [_n(r.aaa_0),   _n(r.aaa_1),   _n(r.aaa_2),   _n(r.aaa_3)],
    }))

    set({ sitios, gastos, liquidaciones_cw, subcs, catalogCW, catalogTI })
    return true
  },

  loadEmpresaConfig: async () => {
    const { data } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'empresa_config')
      .single()
    if (data?.value) {
      try {
        set({ empresaConfig: { ...DEFAULT_EMPRESA, ...JSON.parse(data.value) } })
      } catch { /* ignore */ }
    }
  },

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

  updateBackoffice: (id, value) => {
    get()._updateAndSync(id, s => ({ ...s, costos: { ...s.costos, backoffice: value } }))
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
    const { data: inserted, error } = await supabase.from('gastos').insert(row).select().single()
    if (error) throw error
    set(s => ({ gastos: [...s.gastos, { id: inserted.id, sitio: inserted.sitio_id, tipo: inserted.tipo, desc: inserted.descripcion, valor: inserted.valor, sub_sitio: inserted.sub_sitio || '' }] }))
  },

  eliminarGasto: async (gastoId) => {
    const { error } = await supabase.from('gastos').delete().eq('id', gastoId)
    if (error) throw error
    set(s => ({ gastos: s.gastos.filter(g => g.id !== gastoId) }))
  },

  editarGasto: async (gastoId, changes) => {
    const row = { tipo: changes.tipo, descripcion: changes.desc, valor: changes.valor }
    const { error } = await supabase.from('gastos').update(row).eq('id', gastoId)
    if (error) throw error
    set(s => ({ gastos: s.gastos.map(g => g.id === gastoId ? { ...g, ...changes } : g) }))
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
    }
    const { error } = await supabase.from('sitios').insert(row)
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
    const { error } = await supabase.from('sitios').insert(row)
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
      await supabase.from('liquidaciones_cw').delete().eq('sitio_id', id)
    }
    const { error } = await supabase.from('sitios').delete().eq('id', id)
    if (error) throw error

    set({
      sitios:           sitios.filter(s => s.id !== id),
      gastos:           gastos.filter(g => g.sitio !== id),
      liquidaciones_cw: liquidaciones_cw.filter(l => l.sitio_id !== id),
    })
  },

  // ── Realtime patch ───────────────────────────────────────────
  // Called by useRealtime hook with raw DB records (snake_case)
  applyRT: (table, event, rec) => {
    if (table === 'sitios') {
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

    if (table === 'gastos') {
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

    if (table === 'subcontratistas') {
      const sc = { lc: rec.lc, empresa: rec.empresa || rec.lc, cat: rec.cat || 'A', tel: rec.tel || '', email: rec.email || '', tipoCuadrilla: rec.tipo_cuadrilla || 'TI Ingetel' }
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
  },

  // ── Empresa config ───────────────────────────────────────────
  saveEmpresaConfig: async (config) => {
    const value = JSON.stringify(config)
    const { error } = await supabase
      .from('config')
      .upsert({ key: 'empresa_config', value }, { onConflict: 'key' })
    if (error) throw error
    set({ empresaConfig: { ...DEFAULT_EMPRESA, ...config } })
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
    }
    const { error } = await supabase.from('subcontratistas').insert(row)
    if (error) throw error
    const local = { lc: row.lc, empresa: row.empresa, cat: row.cat, tel: row.tel, email: row.email, tipoCuadrilla: row.tipo_cuadrilla }
    set(s => ({ subcs: [...s.subcs, local].sort((a, b) => a.lc.localeCompare(b.lc)) }))
    return local
  },

  actualizarSubc: async (lc, data) => {
    const row = {
      empresa:        data.empresa.trim(),
      cat:            data.cat || 'A',
      tel:            data.tel  || '',
      email:          data.email || '',
      tipo_cuadrilla: data.tipoCuadrilla || 'TI Ingetel',
    }
    const { error } = await supabase.from('subcontratistas').update(row).eq('lc', lc)
    if (error) throw error
    set(s => ({
      subcs: s.subcs.map(x => x.lc === lc
        ? { ...x, empresa: row.empresa, cat: row.cat, tel: row.tel, email: row.email, tipoCuadrilla: row.tipo_cuadrilla }
        : x
      ),
    }))
  },

  eliminarSubc: async (lc) => {
    const { error } = await supabase.from('subcontratistas').delete().eq('lc', lc)
    if (error) throw error
    set(s => ({ subcs: s.subcs.filter(x => x.lc !== lc) }))
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
    // Debounced Supabase upsert
    clearTimeout(_syncTimers['liq_cw_' + liq.id])
    _syncTimers['liq_cw_' + liq.id] = setTimeout(async () => {
      await supabase.from('liquidaciones_cw').upsert({
        id: liq.id, sitio_id: liq.sitio_id, smp: liq.smp,
        region: liq.region, tipo_zona: liq.tipo_zona,
        lc: liq.lc, estado: liq.estado, items: liq.items,
        fecha: liq.fecha || null,
      }, { onConflict: 'id' })
    }, 2000)
  },

  deleteLiqCW: async (liqId) => {
    const { error } = await supabase.from('liquidaciones_cw').delete().eq('id', liqId)
    if (error) throw error
    set(s => ({ liquidaciones_cw: s.liquidaciones_cw.filter(l => l.id !== liqId) }))
  },

  quitarCW: async (sitioId) => {
    const { liquidaciones_cw } = get()
    const liq = liquidaciones_cw.find(l => l.sitio_id === sitioId)
    if (liq) {
      await supabase.from('liquidaciones_cw').delete().eq('id', liq.id)
    }
    const { error } = await supabase.from('sitios').update({
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
  },

  marcarFinalLiqCW: async (id, estado) => {
    const liq = get().liquidaciones_cw.find(l => l.id === id)
    if (!liq) return
    const updated = { ...liq, estado }
    await get().saveLiqCW(updated)
  },

  // ── Catálogo TI CRUD ─────────────────────────────────────────
  saveCatalogTIItem: async (item) => {
    // item: { id, nombre, unidad, seccion, nokia:[4], A:[4], AA:[4], AAA:[4] }
    const row = {
      id: item.id, nombre: item.nombre, unidad: item.unidad, seccion: item.seccion,
      nokia_0: item.nokia[0], nokia_1: item.nokia[1], nokia_2: item.nokia[2], nokia_3: item.nokia[3],
      a_0: item.A[0],   a_1: item.A[1],   a_2: item.A[2],   a_3: item.A[3],
      aa_0: item.AA[0], aa_1: item.AA[1], aa_2: item.AA[2], aa_3: item.AA[3],
      aaa_0: item.AAA[0], aaa_1: item.AAA[1], aaa_2: item.AAA[2], aaa_3: item.AAA[3],
    }
    set(s => ({
      catalogTI: s.catalogTI.some(x => x.id === item.id)
        ? s.catalogTI.map(x => x.id === item.id ? item : x)
        : [...s.catalogTI, item],
    }))
    await supabase.from('catalogo_ti').upsert(row, { onConflict: 'id' })
  },

  deleteCatalogTIItem: async (id) => {
    set(s => ({ catalogTI: s.catalogTI.filter(x => x.id !== id) }))
    await supabase.from('catalogo_ti').delete().eq('id', id)
  },

  // ── Catálogo CW CRUD ─────────────────────────────────────────
  saveCatalogCWItem: async (item) => {
    // item: { actividad_id, nombre, unidad, precio_nokia_urbano, precio_nokia_rural, precio_subc_urbano, precio_subc_rural }
    set(s => ({
      catalogCW: s.catalogCW.some(x => x.actividad_id === item.actividad_id)
        ? s.catalogCW.map(x => x.actividad_id === item.actividad_id ? item : x)
        : [...s.catalogCW, item].sort((a, b) => a.actividad_id.localeCompare(b.actividad_id)),
    }))
    await supabase.from('catalogo_cw').upsert(item, { onConflict: 'actividad_id' })
  },

  deleteCatalogCWItem: async (actividad_id) => {
    set(s => ({ catalogCW: s.catalogCW.filter(x => x.actividad_id !== actividad_id) }))
    await supabase.from('catalogo_cw').delete().eq('actividad_id', actividad_id)
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
