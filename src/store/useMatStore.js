import { create } from 'zustand'
import { getSupabaseClient } from '../lib/supabase'

const db = () => getSupabaseClient()

function cop(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

export { cop as matCop }

export const useMatStore = create((set, get) => ({

  // ── Estado ──────────────────────────────────────────────────────
  catalogo:     [],
  stock:        [],   // { catalogo_id, bodega_id, stock_actual }
  bodegas:      [],
  sitios:       [],
  sitiosError:  null,
  movimientos:          [],
  despachos:            [],
  pendientes:           [],   // mat_pendientes
  matDespachosPendientes: [], // mat_despachos_pendientes
  proveedores:  [],
  precios:      [],
  loading:      false,
  error:        null,
  _syncChannel: null,

  // ── Carga inicial ────────────────────────────────────────────────
  loadAll: async () => {
    // Spinner solo en carga inicial — recargas de fondo son silenciosas
    const firstLoad = get().catalogo.length === 0
    if (firstLoad) set({ loading: true, error: null })
    try {
      const [cat, stk, bod, sit, mov, dep, pend, prov, prec, mdp] = await Promise.all([
        db().from('mat_catalogo').select('*').order('categoria').order('nombre'),
        db().from('mat_stock').select('*'),
        db().from('bodegas').select('*').order('nombre'),
        db().from('mat_sitios').select('*').order('nombre'),
        db().from('mat_movimientos').select('*').order('created_at', { ascending: false }).limit(10000),
        db().from('despachos').select('*').order('created_at', { ascending: false }).limit(5000),
        db().from('mat_pendientes').select('*').order('created_at', { ascending: false }).limit(2000),
        db().from('mat_proveedores').select('*').order('nombre'),
        db().from('mat_precios_proveedor').select('*'),
        db().from('mat_despachos_pendientes').select('*').order('created_at', { ascending: false }),
      ])
      if (cat.error)  console.error('[mat] catalogo:',              cat.error.message)
      if (stk.error)  console.error('[mat] stock:',                 stk.error.message)
      if (bod.error)  console.error('[mat] bodegas:',               bod.error.message)
      if (sit.error)  console.error('[mat] sitios:',                sit.error.message)
      if (mov.error)  console.error('[mat] movimientos:',           mov.error.message)
      if (dep.error)  console.error('[mat] despachos:',             dep.error.message)
      if (pend.error) console.error('[mat] pendientes:',            pend.error.message)
      if (prov.error) console.error('[mat] proveedores:',           prov.error.message)
      if (prec.error) console.error('[mat] precios:',               prec.error.message)
      if (mdp.error)  console.error('[mat] despachos_pendientes:',  mdp.error.message)
      set({
        catalogo:               cat.data  || [],
        stock:                  stk.data  || [],
        bodegas:                bod.data  || [],
        sitios:                 sit.data  || [],
        movimientos:            mov.data  || [],
        despachos:              dep.data  || [],
        pendientes:             pend.data || [],
        proveedores:            prov.data || [],
        precios:                prec.data || [],
        matDespachosPendientes: mdp.data  || [],
        sitiosError: sit.error?.message || null,
        loading: false,
      })
    } catch (e) {
      if (firstLoad) set({ loading: false, error: e.message })
    }
  },

  // ── Helpers de stock ─────────────────────────────────────────────
  getStock: (catalogo_id, bodega_id) => {
    const rows = get().stock.filter(s => s.catalogo_id === catalogo_id)
    if (bodega_id) return rows.find(s => s.bodega_id === bodega_id)?.stock_actual ?? 0
    return rows.reduce((acc, s) => acc + (s.stock_actual || 0), 0)
  },

  // ── CATÁLOGO ────────────────────────────────────────────────────
  saveCatItem: async (item) => {
    const isNew = !item.id
    const payload = {
      nombre: item.nombre, codigo: item.codigo, unidad: item.unidad,
      categoria: item.categoria, costo_unitario: item.costo_unitario,
      stock_minimo: item.stock_minimo, activo: item.activo ?? true,
      descripcion: item.descripcion || null,
      imagen_url:  item.imagen_url  || null,
      direccion:   item.direccion   || null,
      contacto:    item.contacto    || null,
      email:       item.email       || null,
      telefono:    item.telefono    || null,
      badge:       item.badge       || null,
    }
    const { data, error } = isNew
      ? await db().from('mat_catalogo').insert(payload).select().single()
      : await db().from('mat_catalogo').update(payload).eq('id', item.id).select().single()
    if (error) throw error
    set(s => ({
      catalogo: isNew
        ? [...s.catalogo, data]
        : s.catalogo.map(c => c.id === data.id ? data : c),
    }))
    // Si es nuevo, crear fila de stock en cada bodega (en paralelo)
    if (isNew) {
      const bodegas = get().bodegas
      await Promise.all(bodegas.map(b =>
        db().from('mat_stock').upsert({ catalogo_id: data.id, bodega_id: b.id, stock_actual: 0 })
      ))
      const { data: stk } = await db().from('mat_stock').select('*')
      if (stk) set({ stock: stk })
    }
    return data
  },

  deleteCatItem: async (id) => {
    const { error } = await db().from('mat_catalogo').delete().eq('id', id)
    if (error) throw error
    set(s => ({ catalogo: s.catalogo.filter(c => c.id !== id) }))
  },

  // Carga masiva de precios — updates: [{ id, costo_unitario }]
  bulkUpdateMatPrices: async (updates) => {
    for (const u of updates) {
      const { error } = await db()
        .from('mat_catalogo')
        .update({ costo_unitario: u.costo_unitario })
        .eq('id', u.id)
      if (error) throw error
    }
    set(s => ({
      catalogo: s.catalogo.map(c => {
        const u = updates.find(x => x.id === c.id)
        return u ? { ...c, costo_unitario: u.costo_unitario } : c
      }),
    }))
  },

  // ── BODEGAS ──────────────────────────────────────────────────────
  saveBodega: async (bodega) => {
    const isNew = !bodega.id
    const payload = { nombre: bodega.nombre, regional: bodega.regional, ciudad: bodega.ciudad, direccion: bodega.direccion }
    const { data, error } = isNew
      ? await db().from('bodegas').insert(payload).select().single()
      : await db().from('bodegas').update(payload).eq('id', bodega.id).select().single()
    if (error) throw error
    set(s => ({
      bodegas: isNew ? [...s.bodegas, data] : s.bodegas.map(b => b.id === data.id ? data : b),
    }))
    // Si es nueva bodega, crear filas de stock para todos los materiales (en paralelo)
    if (isNew) {
      const cat = get().catalogo
      await Promise.all(cat.map(c =>
        db().from('mat_stock').upsert({ catalogo_id: c.id, bodega_id: data.id, stock_actual: 0 })
      ))
      const { data: stk } = await db().from('mat_stock').select('*')
      if (stk) set({ stock: stk })
    }
    return data
  },

  deleteBodega: async (id) => {
    await db().from('mat_stock').delete().eq('bodega_id', id)
    const { error } = await db().from('bodegas').delete().eq('id', id)
    if (error) throw error
    set(s => ({
      bodegas: s.bodegas.filter(b => b.id !== id),
      stock:   s.stock.filter(s => s.bodega_id !== id),
    }))
  },

  // ── SITIOS ───────────────────────────────────────────────────────
  saveSitio: async (sitio) => {
    const isNew = !sitio.id && !sitio._editing
    const payload = { nombre: sitio.nombre, tipo_cw: sitio.tipo_cw || null, regional: sitio.regional, comentarios: sitio.comentarios || null, activo: sitio.activo ?? true, aplica_log_inversa: sitio.aplica_log_inversa ?? false }

    if (isNew) {
      const { error } = await db().from('mat_sitios').insert(payload)
      if (error) throw error
      const { data: newRow } = await db().from('mat_sitios').select('*').eq('nombre', payload.nombre).single()
      const saved = newRow || payload
      set(s => ({ sitios: [...s.sitios, saved] }))
      return saved
    } else if (sitio.id) {
      const { error } = await db().from('mat_sitios').update(payload).eq('id', sitio.id)
      if (error) throw error
      const { data: newRow } = await db().from('mat_sitios').select('*').eq('id', sitio.id).single()
      const saved = newRow || { ...sitio, ...payload }
      set(s => ({ sitios: s.sitios.map(x => x.id === sitio.id ? saved : x) }))
      return saved
    } else {
      const originalNombre = sitio._originalNombre || sitio.nombre
      const { error } = await db().from('mat_sitios').update(payload).eq('nombre', originalNombre)
      if (error) throw error
      const { data: newRow } = await db().from('mat_sitios').select('*').eq('nombre', payload.nombre).single()
      const saved = newRow || { ...sitio, ...payload }
      set(s => ({ sitios: s.sitios.map(x => x.nombre === originalNombre ? saved : x) }))
      return saved
    }
  },

  deleteSitio: async (id, nombre) => {
    // Resolver nombre para limpiar movimientos/despachos relacionados
    const resolvedNombre = nombre || get().sitios.find(s => s.id === id)?.nombre || ''

    if (resolvedNombre) {
      // ── Materiales ─────────────────────────────────────────────────
      await db().from('mat_movimientos').delete().eq('destino', resolvedNombre)
      await db().from('despachos').delete().eq('destino', resolvedNombre)

      // ── HW Nokia ───────────────────────────────────────────────────
      // Eliminar todos los movimientos HW con destino u origen igual al sitio
      await db().from('hw_movimientos').delete().eq('destino', resolvedNombre)
      await db().from('hw_movimientos').delete().eq('origen', resolvedNombre)
      // Equipos que quedaron marcados como en_sitio aquí → volver a bodega
      await db().from('hw_equipos')
        .update({ estado: 'en_bodega', ubicacion_actual: null, updated_at: new Date().toISOString() })
        .eq('ubicacion_actual', resolvedNombre)
      // ── Logística Inversa ──────────────────────────────────────────
      await db().from('hw_log_inversa').delete().eq('sitio', resolvedNombre)
    }

    const q = id
      ? db().from('mat_sitios').delete().eq('id', id)
      : db().from('mat_sitios').delete().eq('nombre', resolvedNombre)
    const { error } = await q
    if (error) throw error

    // Recargar estado Materiales
    const [{ data: stk }, { data: movData }, { data: depData }] = await Promise.all([
      db().from('mat_stock').select('*'),
      db().from('mat_movimientos').select('*').order('created_at', { ascending: false }).limit(10000),
      db().from('despachos').select('*').order('created_at', { ascending: false }).limit(5000),
    ])
    set(s => ({
      sitios:      s.sitios.filter(x => id ? x.id !== id : x.nombre !== resolvedNombre),
      movimientos: movData || [],
      despachos:   depData || [],
      stock:       stk    || [],
    }))

    // Recargar estado HW Nokia (importación lazy para evitar dependencia circular)
    try {
      const { useHwStore } = await import('./useHwStore')
      useHwStore.getState().loadAll()
    } catch (_) {}
  },

  // ── MOVIMIENTOS (Entrada / Salida directa) ───────────────────────
  addMovimiento: async (mov) => {
    const { data, error } = await db().from('mat_movimientos').insert(mov).select().single()
    if (error) throw error
    // Recargar stock desde DB (trigger lo actualizó)
    const { data: stk } = await db().from('mat_stock').select('*')
    if (stk) set({ stock: stk })
    set(s => ({ movimientos: [data, ...s.movimientos] }))
    get()._broadcastChange()
    return data
  },

  deleteMovimiento: async (id) => {
    const { error } = await db().from('mat_movimientos').delete().eq('id', id)
    if (error) throw error
    const { data: stk } = await db().from('mat_stock').select('*')
    if (stk) set({ stock: stk })
    set(s => ({ movimientos: s.movimientos.filter(m => m.id !== id) }))
    get()._broadcastChange()
  },

  // ── DESPACHOS ────────────────────────────────────────────────────
  saveDespacho: async (despacho) => {
    const isNew = !despacho.id
    const payload = {
      numero_doc:  despacho.numero_doc,
      sitio_id:    null,                     // col integer — no usar con sitios Liquidador
      destino:     despacho.destino || null, // nombre del sitio Nokia como texto
      bodega_id:   despacho.bodega_id,
      fecha:       despacho.fecha,
      status:      despacho.status || 'borrador',
      comentarios: despacho.comentarios,
      created_by:  despacho.created_by,
    }
    const { data, error } = isNew
      ? await db().from('despachos').insert(payload).select().single()
      : await db().from('despachos').update(payload).eq('id', despacho.id).select().single()
    if (error) throw error
    set(s => ({
      despachos: isNew ? [data, ...s.despachos] : s.despachos.map(d => d.id === data.id ? data : d),
    }))
    get()._broadcastChange()
    return data
  },

  finalizarDespacho: async (id) => {
    const { data, error } = await db().from('despachos')
      .update({ status: 'finalizado', finalizado_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    set(s => ({ despachos: s.despachos.map(d => d.id === id ? data : d) }))
    get()._broadcastChange()
  },

  deleteDespacho: async (id) => {
    const movs = get().movimientos.filter(m => m.numero_doc === get().despachos.find(d => d.id === id)?.numero_doc)
    for (const m of movs) {
      await db().from('mat_movimientos').delete().eq('id', m.id)
    }
    await db().from('despachos').delete().eq('id', id)
    const { data: stk } = await db().from('mat_stock').select('*')
    const { data: movData } = await db().from('mat_movimientos').select('*').order('created_at', { ascending: false }).limit(10000)
    set(s => ({
      despachos: s.despachos.filter(d => d.id !== id),
      movimientos: movData || [],
      stock: stk || [],
    }))
    get()._broadcastChange()
  },

  // ── PENDIENTES ───────────────────────────────────────────────────
  insertPendientes: async (items) => {
    if (!items.length) return
    const CHUNK = 200
    for (let i = 0; i < items.length; i += CHUNK) {
      const { error } = await db().from('mat_pendientes').insert(items.slice(i, i + CHUNK))
      if (error) throw error
    }
    const { data } = await db().from('mat_pendientes').select('*').order('created_at', { ascending: false })
    if (data) set({ pendientes: data })
  },

  resolverPendientes: async (sitio, catalogoIds) => {
    if (!sitio || !catalogoIds?.length) return
    const CHUNK = 200
    for (let i = 0; i < catalogoIds.length; i += CHUNK) {
      await db().from('mat_pendientes').delete().eq('sitio', sitio).in('catalogo_id', catalogoIds.slice(i, i + CHUNK))
    }
    set(s => ({
      pendientes: s.pendientes.filter(p => !(p.sitio === sitio && catalogoIds.includes(p.catalogo_id)))
    }))
  },

  // ── DESPACHOS PENDIENTES (mat_despachos_pendientes) ─────────────
  crearMatDespachoPendiente: async (payload) => {
    // payload: { numero_doc, fecha, sitio_nombre, notas, items, created_by }
    // items: [{ catalogo_id, nombre, cantidad, bodega_id, bodega_nombre, costo_unitario }]
    const { data, error } = await db()
      .from('mat_despachos_pendientes')
      .insert({ ...payload, estado: 'pendiente' })
      .select().single()
    if (error) throw error
    // Marcar sitio como pendiente_despacho
    await db().from('mat_sitios')
      .update({ estado: 'pendiente_despacho' })
      .eq('nombre', payload.sitio_nombre)
    set(s => ({
      matDespachosPendientes: [data, ...s.matDespachosPendientes],
      sitios: s.sitios.map(x => x.nombre === payload.sitio_nombre ? { ...x, estado: 'pendiente_despacho' } : x),
    }))
    get()._broadcastChange()
    return data
  },

  confirmarDespachoMatPendiente: async (despachoId, bodega_id) => {
    const despacho = get().matDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho pendiente no encontrado')

    // 1. Crear despacho en tabla despachos
    const { data: dep, error: depErr } = await db().from('despachos').insert({
      numero_doc:  despacho.numero_doc,
      destino:     despacho.sitio_nombre,
      bodega_id:   bodega_id || despacho.items[0]?.bodega_id || null,
      fecha:       despacho.fecha,
      status:      'finalizado',
      comentarios: despacho.notas || null,
      created_by:  despacho.created_by || null,
      finalizado_at: new Date().toISOString(),
    }).select().single()
    if (depErr) throw depErr

    // 2. Crear movimientos de salida por cada ítem
    const now = new Date().toISOString()
    const movs = despacho.items.map(item => ({
      tipo:          'salida',
      catalogo_id:   item.catalogo_id,
      bodega_id:     item.bodega_id,
      cantidad:      item.cantidad,
      destino:       despacho.sitio_nombre,
      numero_doc:    despacho.numero_doc,
      fecha:         despacho.fecha,
      costo_unitario: item.costo_unitario || null,
      created_at:    now,
    }))
    const { error: movErr } = await db().from('mat_movimientos').insert(movs)
    if (movErr) throw movErr

    // 3. Restaurar estado del sitio
    await db().from('mat_sitios')
      .update({ estado: 'activo' })
      .eq('nombre', despacho.sitio_nombre)

    // 4. Eliminar pendiente
    await db().from('mat_despachos_pendientes').delete().eq('id', despachoId)

    // 5. Recargar stock y movimientos
    const [{ data: stk }, { data: movData }] = await Promise.all([
      db().from('mat_stock').select('*'),
      db().from('mat_movimientos').select('*').order('created_at', { ascending: false }).limit(10000),
    ])
    set(s => ({
      matDespachosPendientes: s.matDespachosPendientes.filter(d => d.id !== despachoId),
      despachos:   [dep, ...s.despachos],
      movimientos: movData || s.movimientos,
      stock:       stk    || s.stock,
      sitios:      s.sitios.map(x => x.nombre === despacho.sitio_nombre ? { ...x, estado: 'activo' } : x),
    }))
    get()._broadcastChange()
    return dep
  },

  cancelarMatDespachoPendiente: async (despachoId) => {
    const despacho = get().matDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho pendiente no encontrado')

    await db().from('mat_despachos_pendientes').delete().eq('id', despachoId)
    await db().from('mat_sitios')
      .update({ estado: 'activo' })
      .eq('nombre', despacho.sitio_nombre)

    set(s => ({
      matDespachosPendientes: s.matDespachosPendientes.filter(d => d.id !== despachoId),
      sitios: s.sitios.map(x => x.nombre === despacho.sitio_nombre ? { ...x, estado: 'activo' } : x),
    }))
    get()._broadcastChange()
  },

  // ── Realtime sync — lo llama MatWrapper al montar ────────────────
  initRealtimeSync: () => {
    const reload = () => get().loadAll()

    const syncChannel = db()
      .channel('mat-sync')
      .on('broadcast', { event: 'changed' }, reload)
      .subscribe()

    // Canal separado para postgres_changes (respaldo)
    const pgChannel = db()
      .channel('mat-pg-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mat_movimientos' }, reload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mat_movimientos' }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'despachos'       }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'despachos'       }, reload)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'despachos'       }, reload)
      .subscribe()

    set({ _syncChannel: syncChannel })
    return () => {
      db().removeChannel(syncChannel)
      db().removeChannel(pgChannel)
      set({ _syncChannel: null })
    }
  },

  // Notifica a otros dispositivos que hubo un cambio
  _broadcastChange: () => {
    const ch = get()._syncChannel
    if (ch) ch.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => {})
  },

  // ── Corrección directa de stock (sin movimiento) ─────────────────
  correccionStock: async (catalogo_id, bodega_id, stockNuevo) => {
    const { error } = await db().from('mat_stock')
      .update({ stock_actual: stockNuevo })
      .eq('catalogo_id', catalogo_id)
      .eq('bodega_id', bodega_id)
    if (error) throw error
    const { data: stk } = await db().from('mat_stock').select('*')
    if (stk) set({ stock: stk })
    get()._broadcastChange()
  },

  // ── Ajuste manual de stock (RPC) ─────────────────────────────────
  ajustarStock: async (catalogo_id, bodega_id, delta) => {
    const { error } = await db().rpc('ajustar_stock', { p_cat: catalogo_id, p_bod: bodega_id, p_delta: delta })
    if (error) throw error
    const { data: stk } = await db().from('mat_stock').select('*')
    if (stk) set({ stock: stk })
    get()._broadcastChange()
  },

  // ── PROVEEDORES (mat_proveedores) ────────────────────────────────
  saveProveedor: async (prov) => {
    const isNew = !prov.id
    const payload = {
      nombre:    prov.nombre,
      contacto:  prov.contacto  || null,
      email:     prov.email     || null,
      telefono:  prov.telefono  || null,
      direccion: prov.direccion || null,
      activo:    prov.activo    ?? true,
    }
    const { data, error } = isNew
      ? await db().from('mat_proveedores').insert(payload).select().single()
      : await db().from('mat_proveedores').update(payload).eq('id', prov.id).select().single()
    if (error) throw error
    set(s => ({
      proveedores: isNew ? [...s.proveedores, data] : s.proveedores.map(p => p.id === data.id ? data : p),
    }))
    return data
  },

  deleteProveedor: async (id) => {
    const { error } = await db().from('mat_proveedores').delete().eq('id', id)
    if (error) throw error
    set(s => ({
      proveedores: s.proveedores.filter(p => p.id !== id),
      precios:     s.precios.filter(p => p.proveedor_id !== id),
    }))
  },

  // ── PRECIOS POR PROVEEDOR (mat_precios_proveedor) ────────────────
  getPrecioProveedor: (catalogo_id, proveedor_id) => {
    const p = get().precios.find(p => p.catalogo_id === catalogo_id && p.proveedor_id === proveedor_id)
    return p?.precio ?? null
  },

  upsertPrecio: async (catalogo_id, proveedor_id, precio) => {
    const { data, error } = await db().from('mat_precios_proveedor')
      .upsert({ catalogo_id, proveedor_id, precio, updated_at: new Date().toISOString() },
               { onConflict: 'catalogo_id,proveedor_id' })
      .select().single()
    if (error) throw error
    set(s => {
      const exists = s.precios.find(p => p.catalogo_id === catalogo_id && p.proveedor_id === proveedor_id)
      return {
        precios: exists
          ? s.precios.map(p => (p.catalogo_id === catalogo_id && p.proveedor_id === proveedor_id) ? data : p)
          : [...s.precios, data],
      }
    })
    return data
  },

  deletePrecio: async (id) => {
    const { error } = await db().from('mat_precios_proveedor').delete().eq('id', id)
    if (error) throw error
    set(s => ({ precios: s.precios.filter(p => p.id !== id) }))
  },
}))
