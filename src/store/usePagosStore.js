import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { TABLES } from '../lib/tables'

export const usePagosStore = create((set) => ({
  pagos:   [],
  loading: false,

  loadPagos: async () => {
    set({ loading: true })
    try {
      const { data } = await supabase.from(TABLES.PAGOS_SUBC).select('*').order('created_at')
      set({ pagos: data || [], loading: false })
    } catch { set({ loading: false }) }
  },

  registrarPago: async ({ sitio_nombre, hito, valor, valor_sugerido, fecha, notas, registrado_por }) => {
    const { data, error } = await supabase
      .from(TABLES.PAGOS_SUBC)
      .insert({ sitio_nombre, hito, valor, valor_sugerido, fecha, notas: notas || null, registrado_por })
      .select().single()
    if (error) throw error
    set(s => ({ pagos: [...s.pagos, data] }))
    return data
  },

  anularPago: async (id) => {
    const { error } = await supabase.from(TABLES.PAGOS_SUBC).delete().eq('id', id)
    if (error) throw error
    set(s => ({ pagos: s.pagos.filter(p => p.id !== id) }))
  },
}))
