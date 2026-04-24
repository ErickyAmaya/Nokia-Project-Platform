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
  movimientos:  [],
  despachos:    [],
  loading:      false,
  error:        null,

  // ── Carga inicial ────────────────────────────────────────────────
  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [cat, stk, bod, sit, mov, dep] = await Promise.all([
        db().from('mat_catalogo').select('*').order('categoria').order('nombre'),
        db().from('mat_stock').select('*'),
        db().from('bodegas').select('*').order('nombre'),
        db().from('mat_sitios').select('*').order('nombre'),
        db().from('mat_movimientos').select('*').order('created_at', { ascending: false }),
        db().from('despachos').select('*').order('created_at', { ascending: false }),
      ])
      // Log any per-query errors so they're visible in the console
      if (cat.error) console.error('[mat] catalogo:', cat.error.message)
      if (stk.error) console.error('[mat] stock:',    stk.error.message)
      if (bod.error) console.error('[mat] bodegas:',  bod.error.message)
      if (sit.error) console.error('[mat] sitios:',   sit.error.message)
      if (mov.error) console.error('[mat] movimientos:', mov.error.message)
      if (dep.error) console.error('[mat] despachos:', dep.error.message)
      set({
        catalogo:    cat.data  || [],
        stock:       stk.data  || [],
        bodegas:     bod.data  || [],
        sitios:      sit.data  || [],
        movimientos: mov.data  || [],
        despachos:   dep.data  || [],
        sitiosError: sit.error?.message || null,
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: e.message })
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
    const payload = { nombre: sitio.nombre, tipo_cw: sitio.tipo_cw || null, regional: sitio.regional, comentarios: sitio.comentarios || null, activo: sitio.activo ?? true }

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
    }

    const q = id
      ? db().from('mat_sitios').delete().eq('id', id)
      : db().from('mat_sitios').delete().eq('nombre', resolvedNombre)
    const { error } = await q
    if (error) throw error

    // Recargar estado Materiales
    const [{ data: stk }, { data: movData }, { data: depData }] = await Promise.all([
      db().from('mat_stock').select('*'),
      db().from('mat_movimientos').select('*').order('created_at', { ascending: false }),
      db().from('despachos').select('*').order('created_at', { ascending: false }),
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
    return data
  },

  deleteMovimiento: async (id) => {
    const { error } = await db().from('mat_movimientos').delete().eq('id', id)
    if (error) throw error
    // Recargar stock
    const { data: stk } = await db().from('mat_stock').select('*')
    if (stk) set({ stock: stk })
    set(s => ({ movimientos: s.movimientos.filter(m => m.id !== id) }))
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
    return data
  },

  finalizarDespacho: async (id) => {
    const { data, error } = await db().from('despachos')
      .update({ status: 'finalizado', finalizado_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    set(s => ({ despachos: s.despachos.map(d => d.id === id ? data : d) }))
  },

  deleteDespacho: async (id) => {
    // Eliminar movimientos asociados y recargar stock
    const movs = get().movimientos.filter(m => m.numero_doc === get().despachos.find(d => d.id === id)?.numero_doc)
    for (const m of movs) {
      await db().from('mat_movimientos').delete().eq('id', m.id)
    }
    await db().from('despachos').delete().eq('id', id)
    const { data: stk } = await db().from('mat_stock').select('*')
    const { data: movData } = await db().from('mat_movimientos').select('*').order('created_at', { ascending: false })
    set(s => ({
      despachos: s.despachos.filter(d => d.id !== id),
      movimientos: movData || [],
      stock: stk || [],
    }))
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
  },

  // ── Ajuste manual de stock (RPC) ─────────────────────────────────
  ajustarStock: async (catalogo_id, bodega_id, delta) => {
    const { error } = await db().rpc('ajustar_stock', { p_cat: catalogo_id, p_bod: bodega_id, p_delta: delta })
    if (error) throw error
    const { data: stk } = await db().from('mat_stock').select('*')
    if (stk) set({ stock: stk })
  },
}))
