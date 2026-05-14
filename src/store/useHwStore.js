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
  loading:                false,
  _syncChannel:           null,

  // ── Carga inicial ────────────────────────────────────────────────
  loadAll: async () => {
    if (get().loading) return
    const firstLoad = get().hwCatalogo.length === 0
    if (firstLoad) set({ loading: true })
    try {
      const [cat, equ, mov, bod, ss, tu, fal, dp] = await Promise.all([
        db().from('hw_catalogo').select('*').order('descripcion'),
        db().from('hw_equipos').select('*').order('created_at', { ascending: false }),
        db().from('hw_movimientos').select('*').order('created_at', { ascending: false }),
        db().from('hw_bodegas_nokia').select('*').order('nombre'),
        db().from('hw_service_suppliers').select('*').order('nombre'),
        db().from('hw_tipo_unidades').select('*').order('nombre'),
        db().from('hw_fallas').select('*').order('created_at', { ascending: false }),
        db().from('hw_despachos_pendientes').select('*').order('created_at', { ascending: false }),
      ])
      set({
        hwCatalogo:             cat.data  || [],
        hwEquipos:              equ.data  || [],
        hwMovimientos:          mov.data  || [],
        hwBodegasNokia:         bod.data  || [],
        hwServiceSuppliers:     ss.data   || [],
        hwTipoUnidades:         tu.data   || [],
        hwFallas:               fal.data  || [],
        hwDespachosPendientes:  dp.data   || [],
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
  crearDespachoPendiente: async ({ numero_doc, fecha, smp_id, bodega, destino, notas, items, created_by }) => {
    // 1. Equipos con serial → batch update a 'pendiente_despacho'
    const serialItems = items.filter(i => i.aplica_serial !== false && i.serial)
    if (serialItems.length > 0) {
      const ids = serialItems
        .map(i => get().hwEquipos.find(e => e.serial === i.serial)?.id)
        .filter(Boolean)
      if (ids.length > 0) {
        const { error } = await db().from('hw_equipos')
          .update({ estado: 'pendiente_despacho', updated_at: new Date().toISOString() })
          .in('id', ids)
        if (error) throw error
        set(s => ({ hwEquipos: s.hwEquipos.map(e => ids.includes(e.id) ? { ...e, estado: 'pendiente_despacho' } : e) }))
      }
    }
    // 2. Items sin serial → movimiento SALIDA tipo_fuente='PENDIENTE' (sale de inventario)
    for (const item of items) {
      if (item.aplica_serial === false) {
        await get().addHwMovimiento({
          equipo_id: null, serial: null,
          catalogo_id: item.catalogo_id,
          tipo: 'SALIDA', tipo_fuente: 'PENDIENTE',
          so: item.so || numero_doc, smp_id: smp_id || null,
          fecha, cantidad: item.cantidad,
          origen: item.bodega, origen_tipo: 'bodega',
          destino, destino_tipo: 'pendiente',
          created_by: created_by || null,
          notas: `Despacho pendiente ${numero_doc}`,
        })
      }
    }
    // 3. Crear registro
    const { data, error } = await db().from('hw_despachos_pendientes').insert({
      numero_doc, fecha, smp_id: smp_id || null, bodega, destino,
      notas: notas || null, items, created_by: created_by || null,
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
    const nuevosItems = [...(despacho.items || []), item]
    // Serial → pendiente_despacho
    if (item.aplica_serial !== false && item.serial) {
      const eq = get().hwEquipos.find(e => e.serial === item.serial)
      if (eq) await get().updateHwEquipo(eq.id, { estado: 'pendiente_despacho' })
    }
    // Sin serial → SALIDA PENDIENTE
    if (item.aplica_serial === false) {
      await get().addHwMovimiento({
        equipo_id: null, serial: null, catalogo_id: item.catalogo_id,
        tipo: 'SALIDA', tipo_fuente: 'PENDIENTE',
        so: item.so || despacho.numero_doc, smp_id: despacho.smp_id || null,
        fecha: despacho.fecha, cantidad: item.cantidad,
        origen: item.bodega, origen_tipo: 'bodega',
        destino: despacho.destino, destino_tipo: 'pendiente',
        created_by: null,
        notas: `Despacho pendiente ${despacho.numero_doc}`,
      })
    }
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ items: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d),
    }))
    return data
  },

  // Quita un ítem del despacho y lo devuelve al inventario
  quitarItemDespacho: async (despachoId, itemIdx) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const item = despacho.items[itemIdx]
    if (!item) throw new Error('Ítem no encontrado')
    // Serial → devolver a en_bodega
    if (item.aplica_serial !== false && item.serial) {
      const eq = get().hwEquipos.find(e => e.serial === item.serial)
      if (eq) await get().updateHwEquipo(eq.id, { estado: 'en_bodega' })
    }
    // Sin serial → ENTRADA reversal
    if (item.aplica_serial === false) {
      await get().addHwMovimiento({
        equipo_id: null, serial: null, catalogo_id: item.catalogo_id,
        tipo: 'ENTRADA', tipo_fuente: 'CANCELACION',
        so: item.so || despacho.numero_doc, smp_id: null,
        fecha: new Date().toISOString().slice(0, 10), cantidad: item.cantidad,
        origen: despacho.destino, origen_tipo: 'pendiente',
        destino: item.bodega, destino_tipo: 'bodega',
        created_by: null,
        notas: `Devolución despacho pendiente ${despacho.numero_doc}`,
      })
    }
    const nuevosItems = despacho.items.filter((_, i) => i !== itemIdx)
    const { data, error } = await db().from('hw_despachos_pendientes')
      .update({ items: nuevosItems }).eq('id', despachoId).select().single()
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.map(d => d.id === despachoId ? data : d),
    }))
    return data
  },

  // Cambia la SO (y el serial correspondiente) de un ítem — devuelve el serial anterior a en_bodega
  cambiarSOItem: async (despachoId, itemIdx, nuevoSO, nuevoSerial) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const item = despacho.items[itemIdx]
    if (!item) throw new Error('Ítem no encontrado')
    // Intercambiar seriales si el serial cambió
    if (item.aplica_serial !== false && nuevoSerial && nuevoSerial !== item.serial) {
      if (item.serial) {
        const oldEq = get().hwEquipos.find(e => e.serial === item.serial)
        if (oldEq) await get().updateHwEquipo(oldEq.id, { estado: 'en_bodega' })
      }
      const newEq = get().hwEquipos.find(e => e.serial === nuevoSerial)
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

  // Marca el despacho como realizado → equipos pasan a en_sitio, entra a Materiales
  realizarDespacho: async (despachoId, matSitios, saveSitio) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    // Crear sitio en Materiales si no existe
    const existe = matSitios?.some(s => s.nombre?.toLowerCase() === despacho.destino.toLowerCase())
    if (!existe && despacho.destino && saveSitio) {
      await saveSitio({ nombre: despacho.destino, regional: '', activo: true }).catch(() => {})
    }
    // Procesar items
    for (const item of despacho.items) {
      if (item.aplica_serial !== false && item.serial) {
        // Serial → en_sitio + movimiento SALIDA
        const eq = get().hwEquipos.find(e => e.serial === item.serial)
        if (eq) await get().updateHwEquipo(eq.id, { estado: 'en_sitio', ubicacion_actual: despacho.destino })
        await get().addHwMovimiento({
          equipo_id: eq?.id || null, serial: item.serial,
          catalogo_id: item.catalogo_id,
          tipo: 'SALIDA', tipo_fuente: 'MANUAL',
          so: item.so || despacho.numero_doc,
          smp_id: despacho.smp_id || null,
          fecha: despacho.fecha, cantidad: 1,
          origen: item.bodega, origen_tipo: 'bodega',
          destino: despacho.destino, destino_tipo: 'sitio',
          created_by: null,
          notas: despacho.notas || null,
        })
      }
      // Sin serial → el movimiento SALIDA ya existe (tipo_fuente='PENDIENTE')
      // Solo hay que actualizar destino_tipo a 'sitio' si cambió
    }
    // Eliminar registro pendiente
    const { error } = await db().from('hw_despachos_pendientes').delete().eq('id', despachoId)
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.filter(d => d.id !== despachoId),
    }))
    get()._broadcastChange()
  },

  // Cancela un despacho pendiente → todo el HW regresa al inventario
  cancelarDespacho: async (despachoId) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    for (const item of despacho.items) {
      if (item.aplica_serial !== false && item.serial) {
        const eq = get().hwEquipos.find(e => e.serial === item.serial)
        if (eq) await get().updateHwEquipo(eq.id, { estado: 'en_bodega' })
      }
      if (item.aplica_serial === false) {
        await get().addHwMovimiento({
          equipo_id: null, serial: null, catalogo_id: item.catalogo_id,
          tipo: 'ENTRADA', tipo_fuente: 'CANCELACION',
          so: item.so || despacho.numero_doc, smp_id: null,
          fecha: new Date().toISOString().slice(0, 10), cantidad: item.cantidad,
          origen: despacho.destino, origen_tipo: 'pendiente',
          destino: item.bodega, destino_tipo: 'bodega',
          created_by: null,
          notas: `Cancelación despacho ${despacho.numero_doc}`,
        })
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
