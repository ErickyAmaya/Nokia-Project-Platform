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
  crearDespachoPendiente: async ({ numero_doc, fecha, smp_id, bodega, destino, destino_tipo = 'sitio', id_transferencia = null, notas, items, created_by }) => {
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
          id_transferencia: id_transferencia || null,
          created_by: created_by || null,
          notas: `Despacho pendiente ${numero_doc}`,
        })
      }
    }
    // 3. Crear registro
    const { data, error } = await db().from('hw_despachos_pendientes').insert({
      numero_doc, fecha, smp_id: smp_id || null, bodega, destino,
      destino_tipo, id_transferencia: id_transferencia || null,
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

  // Marca el despacho como realizado → equipos pasan a en_sitio / en_transito
  realizarDespacho: async (despachoId, matSitios, saveSitio) => {
    const despacho = get().hwDespachosPendientes.find(d => d.id === despachoId)
    if (!despacho) throw new Error('Despacho no encontrado')
    const isTransfer  = despacho.destino_tipo === 'ss'
    const nuevoEstado = isTransfer ? 'en_transito' : 'en_sitio'
    const destTipoMov = isTransfer ? 'ss'           : 'sitio'
    // Crear sitio en Materiales solo si es despacho a sitio (no transferencia)
    if (!isTransfer) {
      const existe = matSitios?.some(s => s.nombre?.toLowerCase() === despacho.destino.toLowerCase())
      if (!existe && despacho.destino && saveSitio) {
        await saveSitio({ nombre: despacho.destino, regional: '', activo: true }).catch(() => {})
      }
    }
    // Procesar items
    for (const item of despacho.items) {
      if (item.aplica_serial !== false && item.serial) {
        const eq = get().hwEquipos.find(e => e.serial === item.serial)
        if (eq) await get().updateHwEquipo(eq.id, { estado: nuevoEstado, ubicacion_actual: despacho.destino })
        await get().addHwMovimiento({
          equipo_id: eq?.id || null, serial: item.serial,
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
      // Sin serial → movimiento PENDIENTE ya existe; actualizar destino_tipo si es transferencia
      if (item.aplica_serial === false && isTransfer) {
        const movPend = get().hwMovimientos.find(m =>
          m.tipo === 'SALIDA' && m.tipo_fuente === 'PENDIENTE' &&
          Number(m.catalogo_id) === Number(item.catalogo_id) &&
          m.destino === despacho.destino
        )
        if (movPend) {
          await db().from('hw_movimientos').update({ destino_tipo: 'ss' }).eq('id', movPend.id)
          set(s => ({ hwMovimientos: s.hwMovimientos.map(m => m.id === movPend.id ? { ...m, destino_tipo: 'ss' } : m) }))
        }
      }
    }
    // Eliminar registro pendiente
    const { error } = await db().from('hw_despachos_pendientes').delete().eq('id', despachoId)
    if (error) throw error
    set(s => ({
      hwDespachosPendientes: s.hwDespachosPendientes.filter(d => d.id !== despachoId),
    }))
    get()._broadcastChange()
  },

  // ── Carga masiva Nokia ───────────────────────────────────────────

  // Parsea Reporte Semanal Nokia.xlsx → upsert hw_equipos (serializados)
  // y agrega movimientos ENTRADA (sin serial, agrupados por cod_material+ubicacion)
  uploadReporteSemanal: async (file, { onProgress } = {}) => {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const rows = allRows.slice(1).filter(r => r.some(c => String(c).trim()))

    const catalogo = get().hwCatalogo
    const catalogoMap = new Map(catalogo.map(c => [String(c.cod_material), c.id]))

    // Col [1] = "Ubicacion / Bodega" (SITIO / POPAYAN / Transferencia)
    // Col [8] = "Estado" (Asignado / Disponible)
    // Col [9] = "Asignado A" = nombre real del sitio cuando ubicacion=SITIO
    const mapEstado = ubicacion => {
      const up = String(ubicacion || '').toUpperCase()
      if (up.includes('SITIO')) return 'en_sitio'
      if (up.includes('TRANSFER')) return 'en_transito'
      return 'en_bodega'
    }

    const now = new Date().toISOString()
    const fechaHoy = now.slice(0, 10)

    // Cols: [0]ss_e2e [1]ubicacion/bodega [2]tipo_fuente [3]so [4]cod_material
    //       [5]descripcion [6]cantidad [7]serial [8]estado_nokia [9]asignado_a [10]comentario [11]nokia_id
    const serialRows = rows.filter(r => String(r[7] || '').trim())
    const bulkRows   = rows.filter(r => !String(r[7] || '').trim())

    // Deduplicar por serial (el archivo puede tener filas repetidas)
    const seenSerials = new Map()
    for (const r of serialRows) {
      const serial     = String(r[7]).trim()
      const ubicacion  = String(r[1] || '').trim()
      const asignadoA  = String(r[9] || '').trim()
      const enSitio    = ubicacion.toUpperCase().includes('SITIO')
      const enTransfer = ubicacion.toUpperCase().includes('TRANSFER')
      // SITIO → ubicacion_actual = nombre del sitio (col[9])
      // TRANSFER → ubicacion_actual = nombre del SS (col[9])
      // Bodega → ubicacion_actual = nombre de la bodega (col[1])
      const ubicacionReal = (enSitio || enTransfer) ? (asignadoA || ubicacion) : (ubicacion || null)
      seenSerials.set(serial, {
        serial,
        catalogo_id:      catalogoMap.get(String(r[4] || '').trim()) || null,
        estado:           mapEstado(ubicacion),
        ubicacion_actual: ubicacionReal,
        so:               String(r[3] || '').trim() || null,
        nokia_estado:     String(r[8] || '').trim() || null,
        nokia_id:         String(r[11] || '').trim() || null,
        asignado_a:       asignadoA || null,
        tipo_fuente:      String(r[2] || '').trim() || null,
        nokia_sync_at:    now,
        condicion:        'bueno',
        notas:            String(r[10] || '').trim() || null,
      })
    }
    const equiposPayloads = [...seenSerials.values()]

    const BATCH = 100
    let equiposInserted = 0
    const totalOps = equiposPayloads.length + 1
    for (let i = 0; i < equiposPayloads.length; i += BATCH) {
      const batch = equiposPayloads.slice(i, i + BATCH)
      const { error } = await db().from('hw_equipos')
        .upsert(batch, { onConflict: 'serial' })
      if (error) throw error
      equiposInserted += batch.length
      onProgress?.({ done: equiposInserted, total: totalOps })
    }

    // Crear sitios en mat_sitios para equipos en_sitio (solo nuevos)
    const sitiosUnicos = [...new Set(
      equiposPayloads.filter(e => e.estado === 'en_sitio' && e.ubicacion_actual).map(e => e.ubicacion_actual)
    )]
    let sitiosCreados = 0
    if (sitiosUnicos.length > 0) {
      const { data: existentes } = await db().from('mat_sitios').select('nombre')
      const nombresExistentes = new Set((existentes || []).map(s => s.nombre?.toLowerCase()))
      const nuevos = sitiosUnicos.filter(n => !nombresExistentes.has(n.toLowerCase()))
      if (nuevos.length > 0) {
        const { error } = await db().from('mat_sitios')
          .insert(nuevos.map(nombre => ({ nombre, regional: '', activo: true })))
        if (error) throw error
        sitiosCreados = nuevos.length
      }
    }

    // Limpiar movimientos NOKIA_REPORTE previos antes de re-insertar (evita duplicados en re-subida)
    await db().from('hw_movimientos').delete().eq('fuente', 'NOKIA_REPORTE')

    // Agregar no-serial: agrupar por cod_material + ubicacion
    const aggMap = new Map()
    for (const r of bulkRows) {
      const codMat    = String(r[4] || '').trim()
      const ubicacion = String(r[1] || '').trim()
      const key = `${codMat}|${ubicacion}`
      if (!aggMap.has(key)) aggMap.set(key, { codMat, ubicacion, cantidad: 0, so: String(r[3] || '').trim() })
      aggMap.get(key).cantidad += Number(r[6]) || 1
    }
    const movPayloads = [...aggMap.values()].map(agg => ({
      catalogo_id:  catalogoMap.get(agg.codMat) || null,
      tipo:         'ENTRADA',
      fuente:       'NOKIA_REPORTE',
      fecha:        fechaHoy,
      cantidad:     agg.cantidad,
      destino:      agg.ubicacion || null,
      destino_tipo: 'bodega',
      so:           agg.so || null,
      notas:        'Carga inicial Reporte Semanal Nokia',
    }))
    if (movPayloads.length > 0) {
      const { error } = await db().from('hw_movimientos').insert(movPayloads)
      if (error) throw error
    }
    onProgress?.({ done: totalOps, total: totalOps })

    await get().loadAll()
    const sinCatalogo = equiposPayloads.filter(e => !e.catalogo_id).length
    return { equipos: equiposInserted, movimientos: movPayloads.length, sinCatalogo, sitios: sitiosCreados }
  },

  // Parsea Kardex Nokia CSV → inserta en hw_movimientos deduplicando por nokia_md5
  uploadKardex: async (file, { onProgress } = {}) => {
    const text = await file.text()
    const lines = text.split(/\r?\n/)

    function parseRow(line) {
      const result = []; let field = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') { if (inQ && line[i+1] === '"') { field += '"'; i++ } else inQ = !inQ }
        else if (c === ',' && !inQ) { result.push(field); field = '' }
        else field += c
      }
      result.push(field); return result
    }

    const catalogo = get().hwCatalogo
    const catalogoMap = new Map(catalogo.map(c => [String(c.cod_material), c.id]))

    // Col[0] = id_abastecimiento_hw_kardex — ID único por movimiento en el sistema Nokia.
    // Se guarda en nokia_md5 para dedup en re-subidas.
    // Cols CSV: [0]nokia_id [5]so [6]so_local [7]cod_material [10]cantidad [11]tipo_material
    //           [13]tipo_fuente [14]tipo_movimiento [15]fecha [18]serial
    const { data: existingIds } = await db()
      .from('hw_movimientos').select('nokia_md5').not('nokia_md5', 'is', null)
    const existingSet = new Set((existingIds || []).map(r => r.nokia_md5))

    const movPayloads = []
    let skipped = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const c = parseRow(line)
      const nokiaId = c[0]?.trim()
      if (!nokiaId || existingSet.has(nokiaId)) { skipped++; continue }
      const fechaRaw = c[15]?.trim()
      movPayloads.push({
        catalogo_id:   catalogoMap.get(c[7]?.trim()) || null,
        tipo:          c[14]?.trim() || 'ENTRADA',
        fuente:        'NOKIA_KARDEX',
        tipo_fuente:   c[13]?.trim() || null,
        tipo_material: c[11]?.trim() || null,
        fecha:         fechaRaw ? fechaRaw.slice(0, 10) : null,
        cantidad:      Number(c[10]?.trim()) || 1,
        so:            c[5]?.trim() || c[6]?.trim() || null,
        serial:        c[18]?.trim() || null,
        nokia_md5:     nokiaId,
        destino:       null,
        destino_tipo:  null,
        origen:        null,
        origen_tipo:   null,
        notas:         null,
      })
    }

    const BATCH = 200
    let inserted = 0
    for (let i = 0; i < movPayloads.length; i += BATCH) {
      const batch = movPayloads.slice(i, i + BATCH)
      const { error } = await db().from('hw_movimientos').insert(batch)
      if (error) throw error
      inserted += batch.length
      onProgress?.({ done: inserted, total: movPayloads.length })
    }

    await get().loadAll()
    return { inserted, skipped }
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
