import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { TABLES } from '../lib/tables'

export const useCatalogStore = create((set, get) => ({
  catalogTI: [],
  catalogCW: [],

  loadCatalog: async () => {
    const [catCWRes, catTIRes] = await Promise.all([
      supabase.from(TABLES.CATALOGO_CW).select('*').order('actividad_id'),
      supabase.from(TABLES.CATALOGO_TI).select('*').order('seccion').order('id'),
    ])

    const _n = v => (v === null || v === undefined) ? null : Number(v)

    const catalogCW = (catCWRes.data || []).map(r => ({
      actividad_id:         r.actividad_id,
      nombre:               r.nombre || r.actividad_id,
      unidad:               (r.unidad || 'UN').trim(),
      precio_nokia_urbano:  r.precio_nokia_urbano  || 0,
      precio_nokia_rural:   r.precio_nokia_rural   || 0,
      precio_subc_urbano:   r.precio_subc_urbano   || 0,
      precio_subc_rural:    r.precio_subc_rural    || 0,
    }))

    const catalogTI = (catTIRes.data || []).map(r => ({
      id:      r.id,
      nombre:  r.nombre || r.id,
      unidad:  (r.unidad || 'UN').trim(),
      seccion: r.seccion || 'BASE',
      nokia: [_n(r.nokia_0), _n(r.nokia_1), _n(r.nokia_2), _n(r.nokia_3)],
      A:     [_n(r.a_0),     _n(r.a_1),     _n(r.a_2),     _n(r.a_3)],
      AA:    [_n(r.aa_0),    _n(r.aa_1),    _n(r.aa_2),    _n(r.aa_3)],
      AAA:   [_n(r.aaa_0),   _n(r.aaa_1),   _n(r.aaa_2),   _n(r.aaa_3)],
    }))

    set({ catalogTI, catalogCW })
  },

  // ── Catálogo TI CRUD ─────────────────────────────────────────
  saveCatalogTIItem: async (item) => {
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
    await supabase.from(TABLES.CATALOGO_TI).upsert(row, { onConflict: 'id' })
  },

  deleteCatalogTIItem: async (id) => {
    set(s => ({ catalogTI: s.catalogTI.filter(x => x.id !== id) }))
    await supabase.from(TABLES.CATALOGO_TI).delete().eq('id', id)
  },

  // ── Catálogo CW CRUD ─────────────────────────────────────────
  saveCatalogCWItem: async (item) => {
    set(s => ({
      catalogCW: s.catalogCW.some(x => x.actividad_id === item.actividad_id)
        ? s.catalogCW.map(x => x.actividad_id === item.actividad_id ? item : x)
        : [...s.catalogCW, item].sort((a, b) => a.actividad_id.localeCompare(b.actividad_id)),
    }))
    await supabase.from(TABLES.CATALOGO_CW).upsert(item, { onConflict: 'actividad_id' })
  },

  deleteCatalogCWItem: async (actividad_id) => {
    set(s => ({ catalogCW: s.catalogCW.filter(x => x.actividad_id !== actividad_id) }))
    await supabase.from(TABLES.CATALOGO_CW).delete().eq('actividad_id', actividad_id)
  },

  // Carga masiva precios TI
  bulkUpdateTIPrices: async (updates) => {
    for (const u of updates) {
      const payload = {}
      ;['nokia','a','aa','aaa'].forEach(tier => {
        ;[0,1,2,3].forEach(z => {
          const k = `${tier}_${z}`
          if (k in u) payload[k] = u[k]
        })
      })
      if (Object.keys(payload).length === 0) continue
      await supabase.from(TABLES.CATALOGO_TI).update(payload).eq('id', u.id)
    }
    set(s => ({
      catalogTI: s.catalogTI.map(item => {
        const u = updates.find(x => x.id === item.id)
        if (!u) return item
        return {
          ...item,
          nokia: [u.nokia_0 ?? item.nokia[0], u.nokia_1 ?? item.nokia[1], u.nokia_2 ?? item.nokia[2], u.nokia_3 ?? item.nokia[3]],
          A:     [u.a_0     ?? item.A[0],     u.a_1     ?? item.A[1],     u.a_2     ?? item.A[2],     u.a_3     ?? item.A[3]],
          AA:    [u.aa_0    ?? item.AA[0],    u.aa_1    ?? item.AA[1],    u.aa_2    ?? item.AA[2],    u.aa_3    ?? item.AA[3]],
          AAA:   [u.aaa_0   ?? item.AAA[0],   u.aaa_1   ?? item.AAA[1],  u.aaa_2   ?? item.AAA[2],   u.aaa_3   ?? item.AAA[3]],
        }
      }),
    }))
  },

  // Carga masiva precios CW
  bulkUpdateCWPrices: async (updates) => {
    const CW_PRICE_KEYS = ['precio_nokia_urbano','precio_nokia_rural','precio_subc_urbano','precio_subc_rural']
    for (const u of updates) {
      const payload = {}
      CW_PRICE_KEYS.forEach(k => { if (k in u) payload[k] = u[k] })
      if (Object.keys(payload).length === 0) continue
      await supabase.from(TABLES.CATALOGO_CW).update(payload).eq('actividad_id', u.actividad_id)
    }
    set(s => ({
      catalogCW: s.catalogCW.map(item => {
        const u = updates.find(x => x.actividad_id === item.actividad_id)
        if (!u) return item
        return {
          ...item,
          ...Object.fromEntries(CW_PRICE_KEYS.filter(k => k in u).map(k => [k, u[k]])),
        }
      }),
    }))
  },
}))
