import { create } from 'zustand'
import { getSupabaseClient } from '../lib/supabase'

const db = () => {
  const c = getSupabaseClient()
  if (!c) throw new Error('Supabase no inicializado')
  return c
}

export const useHwStore = create((set, get) => ({

  // ── Estado ──────────────────────────────────────────────────────
  hwCatalogo:        [],
  hwEquipos:         [],
  hwMovimientos:     [],
  hwBodegasNokia:    [],
  hwServiceSuppliers:[],
  hwTipoUnidades:    [],
  loading:           false,
  _syncChannel:      null,

  // ── Carga inicial ────────────────────────────────────────────────
  loadAll: async () => {
    if (get().loading) return
    const firstLoad = get().hwCatalogo.length === 0
    if (firstLoad) set({ loading: true })
    try {
      const [cat, equ, mov, bod, ss, tu] = await Promise.all([
        db().from('hw_catalogo').select('*').order('descripcion'),
        db().from('hw_equipos').select('*').order('created_at', { ascending: false }),
        db().from('hw_movimientos').select('*').order('created_at', { ascending: false }),
        db().from('hw_bodegas_nokia').select('*').order('nombre'),
        db().from('hw_service_suppliers').select('*').order('nombre'),
        db().from('hw_tipo_unidades').select('*').order('nombre'),
      ])
      set({
        hwCatalogo:         cat.data  || [],
        hwEquipos:          equ.data  || [],
        hwMovimientos:      mov.data  || [],
        hwBodegasNokia:     bod.data  || [],
        hwServiceSuppliers: ss.data   || [],
        hwTipoUnidades:     tu.data   || [],
      })
    } finally {
      if (firstLoad) set({ loading: false })
    }
  },

  // ── Realtime sync ────────────────────────────────────────────────
  initRealtimeSync: () => {
    const reload = () => get().loadAll()

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
      id_parte:      item.id_parte      || null,
      descripcion:   item.descripcion,
      tipo_material: item.tipo_material || 'Partes',
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
      log_inv_tipo_unidad: equipo.log_inv_tipo_unidad || null,
      notas:               equipo.notas || null,
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
}))
