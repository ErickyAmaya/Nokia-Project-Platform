import { create } from 'zustand'
import { getSupabaseClient } from '../lib/supabase'

const db = () => {
  const c = getSupabaseClient()
  if (!c) throw new Error('Supabase no inicializado')
  return c
}

export const useHwStore = create((set, get) => ({

  // ── Estado ──────────────────────────────────────────────────────
  hwCatalogo:             [],
  hwEquipos:              [],
  hwMovimientos:          [],
  hwBodegasNokia:         [],
  hwServiceSuppliers:     [],
  hwTipoUnidades:         [],
  hwFallas:               [],
  hwDespachosPendientes:  [],
  hwLogInversa:           [],
  hwLiBodegasDestino:     [],
  hwLiConceptos:          [],
  hwKardexDisponible:     [],
  hwKardexMovimientos:    [],
  loading:                false,
  _syncChannel:           null,

  // ── Carga inicial ────────────────────────────────────────────────
  loadAll: async () => {
    if (get().loading) return
    const firstLoad = get().hwCatalogo.length === 0
    if (firstLoad) set({ loading: true })
    try {
      const [cat, equ, mov, bod, ss, tu, fal, dp, li, libd, lic, kdisp, kmov] = await Promise.all([
        db().from('hw_catalogo').select('*').order('descripcion'),
        db().from('hw_equipos').select('*').order('created_at', { ascending: false }),
        db().from('hw_movimientos').select('*').order('created_at', { ascending: false }).limit(20000),
        db().from('hw_bodegas_nokia').select('*').order('nombre'),
        db().from('hw_service_suppliers').select('*').order('nombre'),
        db().from('hw_tipo_unidades').select('*').order('nombre'),
        db().from('hw_fallas').select('*').order('created_at', { ascending: false }).limit(2000),
        db().from('hw_despachos_pendientes').select('*').order('created_at', { ascending: false }).limit(2000),
        db().from('hw_log_inversa').select('*').order('created_at', { ascending: false }).limit(10000),
        db().from('hw_li_bodegas_destino').select('*').order('nombre'),
        db().from('hw_li_conceptos').select('*').order('nombre'),
        db().from('hw_kardex_disponible').select('*').order('fecha_movimiento', { ascending: false }).limit(15000),
        db().from('hw_kardex_movimientos').select('*').order('fecha_movimiento', { ascending: false }).limit(15000),
      ])
      set({
        hwCatalogo:             cat.data   || [],
        hwEquipos:              equ.data   || [],
        hwMovimientos:          mov.data   || [],
        hwBodegasNokia:         bod.data   || [],
        hwServiceSuppliers:     ss.data    || [],
        hwTipoUnidades:         tu.data    || [],
        hwFallas:               fal.data   || [],
        hwDespachosPendientes:  dp.data    || [],
        hwLogInversa:           li.data    || [],
        hwLiBodegasDestino:     libd.data  || [],
        hwLiConceptos:          lic.data   || [],
        hwKardexDisponible:     kdisp.data || [],
        hwKardexMovimientos:    kmov.data  || [],
      })
    } finally {
      if (firstLoad) set({ loading: false })
    }
  },

  // ── Realtime sync ────────────────────────────────────────────────
  initRealtimeSync: () => {
    let _debounceTimer = null
    const reload = () => {
      clearTimeout(_debounceTimer)
      _debounceTimer = setTimeout(() => get().loadAll(), 2000)
    }

    const syncChannel = db()
      .channel('hw-sync')
      .on('broadcast', { event: 'changed' }, reload)
      .subscribe()

    const pgChannel = db()
      .channel('hw-pg-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hw_movimientos' }, reload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hw_movimientos' }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hw_equipos'     }, reload)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'hw_log_inversa'  }, reload)
      .subscribe()

    set({ _syncChannel: syncChannel })
    return () => {
      db().removeChannel(syncChannel)
      db().removeChannel(pgChannel)
      set({ _syncChannel: null })
    }
  },

  _broadcastChange: () => {
    const ch = get()._syncChannel
    if (ch) ch.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => {})
  },

  // ── Kardex Nokia ─────────────────────────────────────────────────
  upsertKardexMovimientos: async (rows) => {
    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db()
        .from('hw_kardex_movimientos')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'nokia_id' })
      if (error) throw error
    }
    const { data } = await db()
      .from('hw_kardex_movimientos')
      .select('*')
      .order('fecha_movimiento', { ascending: false })
      .limit(15000)
    set({ hwKardexMovimientos: data || [] })
  },

  upsertKardexDisponible: async (rows) => {
    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db()
        .from('hw_kardex_disponible')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'nokia_id' })
      if (error) throw error
    }
    const { data } = await db()
      .from('hw_kardex_disponible')
      .select('*')
      .order('fecha_movimiento', { ascending: false })
      .limit(15000)
    set({ hwKardexDisponible: data || [] })
  },

  // ── Catálogo HW ─────────────────────────────────────────────────
  saveHwCatItem: async (item) => {
    const payload = {
      cod_material:  item.cod_material  || null,
      descripcion:   item.descripcion,
      aplica_serial: item.aplica_serial ?? true,
      notas:         item.notas         || null,
      activo:        item.activo ?? true,
      imagen_url:    item.imagen_url    || null,
    }
    const { data, error } = item.id
      ? await db().from('hw_catalogo').update(payload).eq('id', item.id).select().single()
      : await db().from('hw_catalogo').insert(payload).select().single()
    if (error) throw error
    set(s => ({
      hwCatalogo: item.id
        ? s.hwCatalogo.map(c => c.id === data.id ? data : c)
        : [...s.hwCatalogo, data],
    }))
    return data
  },

  deleteHwCatItem: async (id) => {
    const { error } = await db().from('hw_catalogo').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwCatalogo: s.hwCatalogo.filter(c => c.id !== id) }))
  },

  // ── Equipos ─────────────────────────────────────────────────────
  addHwEquipo: async (equipo) => {
    const payload = {
      catalogo_id:         equipo.catalogo_id || null,
      serial:              equipo.serial.trim(),
      estado:              equipo.estado || 'en_bodega',
      ubicacion_actual:    equipo.ubicacion_actual || null,
      condicion:           equipo.condicion || 'nuevo',
      bulk:                equipo.bulk || null,
      log_inv_tipo_unidad: equipo.log_inv_tipo_unidad || null,
      notas:               equipo.notas || null,
      so:                  equipo.so || null,
    }
    const { data, error } = await db().from('hw_equipos').insert(payload).select().single()
    if (error) throw error
    set(s => ({ hwEquipos: [data, ...s.hwEquipos] }))
    get()._broadcastChange()
    return data
  },

  updateHwEquipo: async (id, changes) => {
    const { data, error } = await db().from('hw_equipos')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    set(s => ({ hwEquipos: s.hwEquipos.map(e => e.id === id ? data : e) }))
    get()._broadcastChange()
    return data
  },

  deleteHwEquipo: async (id) => {
    const { error } = await db().from('hw_equipos').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwEquipos: s.hwEquipos.filter(e => e.id !== id) }))
    get()._broadcastChange()
  },

  // ── Movimientos HW ───────────────────────────────────────────────
  addHwMovimiento: async (mov) => {
    const { data, error } = await db().from('hw_movimientos').insert(mov).select().single()
    if (error) throw error
    set(s => ({ hwMovimientos: [data, ...s.hwMovimientos] }))
    get()._broadcastChange()
    return data
  },

  deleteHwMovimiento: async (id) => {
    const { error } = await db().from('hw_movimientos').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwMovimientos: s.hwMovimientos.filter(m => m.id !== id) }))
    get()._broadcastChange()
  },

  // ── Bodegas Nokia ────────────────────────────────────────────────
  saveHwBodegaNokia: async (item) => {
    const payload = {
      nombre: item.nombre,
      ciudad: item.ciudad || null,
      notas:  item.notas  || null,
      activo: item.activo ?? true,
    }
    const { data, error } = item.id
      ? await db().from('hw_bodegas_nokia').update(payload).eq('id', item.id).select().single()
      : await db().from('hw_bodegas_nokia').insert(payload).select().single()
    if (error) throw error
    set(s => ({
      hwBodegasNokia: item.id
        ? s.hwBodegasNokia.map(b => b.id === data.id ? data : b)
        : [...s.hwBodegasNokia, data],
    }))
    return data
  },

  deleteHwBodegaNokia: async (id) => {
    const { error } = await db().from('hw_bodegas_nokia').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwBodegasNokia: s.hwBodegasNokia.filter(b => b.id !== id) }))
  },

  // ── Service Suppliers ────────────────────────────────────────────
  saveHwSS: async (item) => {
    const payload = {
      nombre: item.nombre,
      ciudad: item.ciudad || null,
      notas:  item.notas  || null,
      activo: item.activo ?? true,
    }
    const { data, error } = item.id
      ? await db().from('hw_service_suppliers').update(payload).eq('id', item.id).select().single()
      : await db().from('hw_service_suppliers').insert(payload).select().single()
    if (error) throw error
    set(s => ({
      hwServiceSuppliers: item.id
        ? s.hwServiceSuppliers.map(x => x.id === data.id ? data : x)
        : [...s.hwServiceSuppliers, data],
    }))
    return data
  },

  deleteHwSS: async (id) => {
    const { error } = await db().from('hw_service_suppliers').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwServiceSuppliers: s.hwServiceSuppliers.filter(x => x.id !== id) }))
  },

  // ── Tipos de Unidad (LOG_INV) ────────────────────────────────────
  saveHwTipoUnidad: async (item) => {
    const payload = { nombre: item.nombre, activo: item.activo ?? true }
    const { data, error } = item.id
      ? await db().from('hw_tipo_unidades').update(payload).eq('id', item.id).select().single()
      : await db().from('hw_tipo_unidades').insert(payload).select().single()
    if (error) throw error
    set(s => ({
      hwTipoUnidades: item.id
        ? s.hwTipoUnidades.map(x => x.id === data.id ? data : x)
        : [...s.hwTipoUnidades, data],
    }))
    return data
  },

  deleteHwTipoUnidad: async (id) => {
    const { error } = await db().from('hw_tipo_unidades').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwTipoUnidades: s.hwTipoUnidades.filter(x => x.id !== id) }))
  },

  // ── Log Inversa — Bodegas Destino ───────────────────────────────
  saveHwLiBodegaDestino: async (item) => {
    const payload = { nombre: item.nombre, activo: item.activo ?? true }
    const { data, error } = item.id
      ? await db().from('hw_li_bodegas_destino').update(payload).eq('id', item.id).select().single()
      : await db().from('hw_li_bodegas_destino').insert(payload).select().single()
    if (error) throw error
    set(s => ({
      hwLiBodegasDestino: item.id
        ? s.hwLiBodegasDestino.map(x => x.id === data.id ? data : x)
        : [...s.hwLiBodegasDestino, data],
    }))
    return data
  },

  deleteHwLiBodegaDestino: async (id) => {
    const { error } = await db().from('hw_li_bodegas_destino').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwLiBodegasDestino: s.hwLiBodegasDestino.filter(x => x.id !== id) }))
  },

  // ── Log Inversa — Conceptos ──────────────────────────────────────
  saveHwLiConcepto: async (item) => {
    const payload = { nombre: item.nombre, activo: item.activo ?? true }
    const { data, error } = item.id
      ? await db().from('hw_li_conceptos').update(payload).eq('id', item.id).select().single()
      : await db().from('hw_li_conceptos').insert(payload).select().single()
    if (error) throw error
    set(s => ({
      hwLiConceptos: item.id
        ? s.hwLiConceptos.map(x => x.id === data.id ? data : x)
        : [...s.hwLiConceptos, data],
    }))
    return data
  },

  deleteHwLiConcepto: async (id) => {
    const { error } = await db().from('hw_li_conceptos').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwLiConceptos: s.hwLiConceptos.filter(x => x.id !== id) }))
  },

  // ── Tablas de referencia FR ──────────────────────────────────────
  saveFrItem: async (tabla, item) => {
    const stateKey = { hw_fr_empresas:'frEmpresas', hw_fr_regionales:'frRegionales', hw_fr_ciudades:'frCiudades', hw_fr_sitios:'frSitios', hw_fr_tecnicos:'frTecnicos', hw_fr_equipos:'frEquipos', hw_fr_wbs:'frWbs' }[tabla]
    const { id, created_at, ...payload } = item
    const { data, error } = id
      ? await db().from(tabla).update(payload).eq('id', id).select().single()
      : await db().from(tabla).insert(payload).select().single()
    if (error) throw error
    set(s => ({ [stateKey]: id ? s[stateKey].map(x => x.id === id ? data : x) : [...s[stateKey], data] }))
    return data
  },

  deleteFrItem: async (tabla, id) => {
    const stateKey = { hw_fr_empresas:'frEmpresas', hw_fr_regionales:'frRegionales', hw_fr_ciudades:'frCiudades', hw_fr_sitios:'frSitios', hw_fr_tecnicos:'frTecnicos', hw_fr_equipos:'frEquipos', hw_fr_wbs:'frWbs' }[tabla]
    const { error } = await db().from(tabla).delete().eq('id', id)
    if (error) throw error
    set(s => ({ [stateKey]: s[stateKey].filter(x => x.id !== id) }))
  },

  // ── Fallas HW ────────────────────────────────────────────────────
  saveFalla: async (falla) => {
    const { id, created_at, regional_id, ciudad_id, ...payload } = falla
    const NUM = ['efecto_falla','gravedad','pct_efecto','duracion_dias','duracion_horas','duracion_minutos','equipo_id']
    NUM.forEach(k => { payload[k] = payload[k] !== '' && payload[k] != null ? Number(payload[k]) || null : null })
    payload.updated_at = new Date().toISOString()
    const { data, error } = id
      ? await db().from('hw_fallas').update(payload).eq('id', id).select().single()
      : await db().from('hw_fallas').insert(payload).select().single()
    if (error) throw error
    set(s => ({
      hwFallas: id
        ? s.hwFallas.map(f => f.id === id ? data : f)
        : [data, ...s.hwFallas],
    }))
    return data
  },

  deleteFalla: async (id) => {
    const { error } = await db().from('hw_fallas').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwFallas: s.hwFallas.filter(f => f.id !== id) }))
  },

  // ── Despachos Pendientes ─────────────────────────────────────────

  // Crea un despacho pendiente. El HW sale del inventario disponible
  // pero su ubicación sigue siendo la bodega hasta que se realice.
  crearDespachoPendiente: async ({ numero_doc, fecha, smp_id, bodega, destino, destino_tipo = 'sitio', id_transferencia = null, notas, items, mat_despachos = null, created_by }) => {
    // Todos los ítems se buscan por SO (con o sin serial) → pendiente_despacho
    const ids = items
      .map(i => {
        if (i.serial) return get().hwEquipos.find(e => e.serial === i.serial)?.id
        if (i.so)     return get().hwEquipos.find(e => e.so === i.so)?.id
        return null
      })
      .filter(Boolean)
    if (ids.length > 0) {
      const { error } = await db().from('hw_equipos')
        .update({ estado: 'pendiente_despacho', updated_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
      set(s => ({ hwEquipos: s.hwEquipos.map(e => ids.includes(e.id) ? { ...e, estado: 'pendiente_despacho' } : e) }))
    }
    const { data, error } = await db().from('hw_despachos_pendientes').insert({
      numero_doc, fecha, smp_id: smp_id || null, bodega, destino,
      destino_tipo, id_transferencia: id_transferencia || null,
      notas: notas || null, items, created_by: created_by || null,
      mat_despachos: mat_despachos?.length ? mat_despachos : null,
    }).select().single()
    if (error) throw error
    set(s => ({ hwDespachosPendientes: [data, ...s.hwDespachosPendientes] }))
    return data
  },

  // Actualiza meta del despacho (fecha, smp_id, notas, destino, numero_doc)
  actualizarMetaDespacho: async (id, changes) => {
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update(changes).eq('id', id).select().single()
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === id ? data : d),
    }))
    return data
  },

  // Agrega un ítem al despacho pendiente
  agregarItemDespacho: async (despachoId, item) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const eq = item.serial
      ? get().hwEquipos.find(e => e.serial === item.serial)
      : get().hwEquipos.find(e => e.so === item.so)
    if (eq) await get().updateHwEquipo(eq.id, { estado: 'pendiente_despacho' })
    const nuevosItems = [...(despacho.items || []), item]
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ items: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d),
    }))
    return data
  },

  quitarItemDespacho: async (despachoId, itemIdx) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const item = despacho.items[itemIdx]
    if (!item) throw new Error('Ítem no encontrado')
    const eq = item.serial
      ? get().hwEquipos.find(e => e.serial === item.serial)
      : get().hwEquipos.find(e => e.so === item.so)
    if (eq) await get().updateHwEquipo(eq.id, { estado: 'en_bodega' })
    const nuevosItems = despacho.items.filter((_, i) => i !== itemIdx)
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ items: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d),
    }))
    return data
  },

  cambiarSOItem: async (despachoId, itemIdx, nuevoSO, nuevoSerial) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const item = despacho.items[itemIdx]
    if (!item) throw new Error('Ítem no encontrado')
    if (nuevoSO !== item.so) {
      const oldEq = item.serial
        ? get().hwEquipos.find(e => e.serial === item.serial)
        : get().hwEquipos.find(e => e.so === item.so)
      if (oldEq) await get().updateHwEquipo(oldEq.id, { estado: 'en_bodega' })
      const newEq = nuevoSerial
        ? get().hwEquipos.find(e => e.serial === nuevoSerial)
        : get().hwEquipos.find(e => e.so === nuevoSO)
      if (newEq) await get().updateHwEquipo(newEq.id, { estado: 'pendiente_despacho' })
    }
    const nuevosItems = despacho.items.map((it, i) =>
      i === itemIdx ? { ...it, so: nuevoSO, serial: nuevoSerial ?? it.serial } : it
    )
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ items: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({ hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d) }))
    return data
  },

  // ── Edición inline de mat_despachos ─────────────────────────────
  actualizarCantidadHwItem: async (despachoId, itemIdx, cantidad) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const nuevosItems = (despacho.items || []).map((item, i) => i === itemIdx ? { ...item, cantidad } : item)
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ items: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({ hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d) }))
    return data
  },

  actualizarMatItem: async (despachoId, itemIdx, changes) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const nuevosItems = (despacho.mat_despachos || []).map((item, i) => i === itemIdx ? { ...item, ...changes } : item)
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ mat_despachos: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({ hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d) }))
    return data
  },

  quitarMatItem: async (despachoId, itemIdx) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const nuevosItems = (despacho.mat_despachos || []).filter((_, i) => i !== itemIdx)
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ mat_despachos: nuevosItems.length ? nuevosItems : null }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({ hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d) }))
    return data
  },

  agregarMatItem: async (despachoId, item) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const nuevosItems = [...(despacho.mat_despachos || []), item]
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ mat_despachos: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({ hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d) }))
    return data
  },

  // Marca el despacho como realizado → equipos pasan a en_sitio / en_transito
  // Regla universal: si el despacho tiene mat_despachos, también crea los movimientos de materiales
  realizarDespacho: async (despachoId) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const isTransfer  = despacho.destino_tipo === 'ss'
    const nuevoEstado = isTransfer ? 'en_transito' : 'en_sitio'
    const destTipoMov = isTransfer ? 'ss'           : 'sitio'

    // 1. Procesar todos los ítems HW uniformemente por SO
    for (const item of despacho.items) {
      const eq = item.serial
        ? get().hwEquipos.find(e => e.serial === item.serial)
        : get().hwEquipos.find(e => e.so === item.so)
      if (eq) await get().updateHwEquipo(eq.id, { estado: nuevoEstado, ubicacion_actual: despacho.destino })
      await get().addHwMovimiento({
        equipo_id: eq?.id || null,
        serial:    item.serial || null,
        catalogo_id: item.catalogo_id,
        tipo: 'SALIDA', tipo_fuente: 'MANUAL',
        so: item.so || despacho.numero_doc,
        smp_id: despacho.smp_id || null,
        fecha: despacho.fecha, cantidad: 1,
        origen: item.bodega, origen_tipo: 'bodega',
        destino: despacho.destino, destino_tipo: destTipoMov,
        id_transferencia: despacho.id_transferencia || null,
        created_by: null,
        notas: despacho.notas || null,
      })
    }

    // 2. Regla universal: procesar materiales asociados si los hay
    if (despacho.mat_despachos?.length > 0) {
      const CHUNK = 200
      const movsMat = despacho.mat_despachos.map(item => ({
        tipo:            'Salida',
        catalogo_id:     item.catalogo_id,
        bodega_id:       item.bodega_id,
        cantidad:        item.cantidad,
        cant_despachada: item.cantidad,
        valor_unitario:  item.costo_unitario || null,
        destino:         despacho.destino,
        numero_doc:      despacho.numero_doc,
        fecha:           despacho.fecha,
      }))
      for (let i = 0; i < movsMat.length; i += CHUNK) {
        const { error: matErr } = await db().from('mat_movimientos').insert(movsMat.slice(i, i + CHUNK))
        if (matErr) throw new Error('Error materiales: ' + matErr.message)
      }
      const { useMatStore } = await import('./useMatStore')
      useMatStore.getState().loadAll()
    }

    // 3. Eliminar registro pendiente
    const { error } = await db().from('hw_despachos_pendientes').delete().eq('id', despachoId)
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.filter(d => d.id !== despachoId),
    }))
    get()._broadcastChange()
  },

  // ── Logística Inversa ────────────────────────────────────────────

  addHwLogInversaBatch: async (items) => {
    const now = new Date().toISOString()
    const batch = items.map(i => ({ ...i, estado: i.estado || 'en_sitio', created_at: now, updated_at: now }))
    const CHUNK = 150
    const inserted = []
    for (let i = 0; i < batch.length; i += CHUNK) {
      const { data, error } = await db().from('hw_log_inversa').insert(batch.slice(i, i + CHUNK)).select()
      if (error) throw error
      if (data) inserted.push(...data)
    }
    set(s => ({ hwLogInversa: [...inserted, ...s.hwLogInversa] }))
    get()._broadcastChange()
    return inserted
  },

  updateHwLogInversa: async (id, changes) => {
    const { data, error } = await db().from('hw_log_inversa')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    set(s => ({ hwLogInversa: s.hwLogInversa.map(r => r.id === id ? data : r) }))
    get()._broadcastChange()
    return data
  },

  deleteHwLogInversa: async (id) => {
    const { error } = await db().from('hw_log_inversa').delete().eq('id', id)
    if (error) throw error
    set(s => ({ hwLogInversa: s.hwLogInversa.filter(r => r.id !== id) }))
    get()._broadcastChange()
  },

  deleteHwLogInversaBySitio: async (sitio) => {
    const { error } = await db().from('hw_log_inversa').delete().eq('sitio', sitio)
    if (error) throw error
    set(s => ({ hwLogInversa: s.hwLogInversa.filter(r => r.sitio !== sitio) }))
    get()._broadcastChange()
  },

  bulkUpdateHwLogInversaEstado: async (ids, estado, meta = {}) => {
    const { data, error } = await db().from('hw_log_inversa')
      .update({ estado, ...meta, updated_at: new Date().toISOString() })
      .in('id', ids).select()
    if (error) throw error
    const updated = new Map((data || []).map(r => [r.id, r]))
    set(s => ({ hwLogInversa: s.hwLogInversa.map(r => updated.has(r.id) ? updated.get(r.id) : r) }))
    get()._broadcastChange()
  },

  // Cancela un despacho pendiente → todo el HW regresa al inventario
  // Regla universal: si hay mat_despachos, reversa los movimientos de materiales también
  cancelarDespacho: async (despachoId) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')

    // 1. Reversar todos los ítems HW uniformemente por SO
    for (const item of despacho.items) {
      const eq = item.serial
        ? get().hwEquipos.find(e => e.serial === item.serial)
        : get().hwEquipos.find(e => e.so === item.so)
      if (eq) await get().updateHwEquipo(eq.id, { estado: 'en_bodega' })
    }

    // 2. Regla universal: reversar materiales asociados si los hay
    if (despacho.mat_despachos?.length > 0) {
      try {
        const now = new Date().toISOString().slice(0, 10)
        const reversals = despacho.mat_despachos.map(item => ({
          tipo:            'Entrada',
          catalogo_id:     item.catalogo_id,
          bodega_id:       item.bodega_id,
          cantidad:        item.cantidad,
          cant_despachada: item.cantidad,
          valor_unitario:  item.costo_unitario || null,
          destino:         item.bodega_nombre || null,
          numero_doc:      despacho.numero_doc,
          fecha:           now,
        }))
        const { error: matErr } = await db().from('mat_movimientos').insert(reversals)
        if (matErr) console.error('[hw] Error reversando movimientos mat:', matErr.message)
        const { useMatStore } = await import('./useMatStore')
        useMatStore.getState().loadAll()
      } catch (e) {
        console.error('[hw] Error reversando materiales en cancelación:', e)
      }
    }

    const { error } = await db().from('hw_despachos_pendientes').delete().eq('id', despachoId)
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.filter(d => d.id !== despachoId),
    }))
    get()._broadcastChange()
  },
}))
