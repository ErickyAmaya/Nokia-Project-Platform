import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useScytelStore = create((set, get) => ({
  margenes: [],
  billing:  [],
  reports:  [],
  loading:  false,

  loadAll: async () => {
    set({ loading: true })
    try {
      const [{ data: m }, { data: b }, { data: r }] = await Promise.all([
        supabase.from('scytel_margenes_mes').select('*').order('year').order('month'),
        supabase.from('scytel_billing').select('*').order('created_at', { ascending: false }),
        supabase.from('scytel_reports').select('id, meses, created_at').order('created_at', { ascending: false }).limit(50),
      ])
      set({ margenes: m || [], billing: b || [], reports: r || [], loading: false })
    } catch { set({ loading: false }) }
  },

  // Registra la factura SCYTEL para un SPO individual y bloquea el margen del mes
  // pct_real   = bracket calculado del mes  → scytel_margenes_mes.pct_scytel
  // pct_facturado = % acordado a facturar  → scytel_billing.pct_scytel
  registrarSpo: async ({ spo_number, site_name, periodo_margen, pct_real, pct_facturado,
                          margen_pct, valor_scytel, numero_factura, fecha_factura, locked_by }) => {
    const [y, m] = periodo_margen.split('-').map(Number)
    const { error: mErr } = await supabase
      .from('scytel_margenes_mes')
      .upsert({ year: y, month: m, margen_pct, pct_scytel: pct_real, locked_by }, { onConflict: 'year,month' })
    if (mErr) throw mErr

    const { error: bErr } = await supabase
      .from('scytel_billing')
      .upsert({
        spo_number, site_name, periodo_margen,
        pct_scytel: pct_facturado, valor_scytel, numero_factura, fecha_factura,
        created_by: locked_by,
      }, { onConflict: 'spo_number' })
    if (bErr) throw bErr

    await get().loadAll()
  },

  // Guarda solo el % acordado para el mes (sin tocar scytel_billing)
  actualizarPctMes: async ({ periodo_margen, pct_real, pct_acordado, margen_pct, locked_by }) => {
    const [y, m] = periodo_margen.split('-').map(Number)
    const { error } = await supabase
      .from('scytel_margenes_mes')
      .upsert({ year: y, month: m, margen_pct, pct_scytel: pct_acordado, locked_by }, { onConflict: 'year,month' })
    if (error) throw error
    await get().loadAll()
  },

  deleteBilling: async (id) => {
    const { error } = await supabase.from('scytel_billing').delete().eq('id', id)
    if (error) throw error
    set(s => ({ billing: s.billing.filter(b => b.id !== id) }))
  },

  marcarPagada: async (numeroFactura, fechaPago) => {
    const { error } = await supabase
      .from('scytel_billing')
      .update({ pagada: true, fecha_pago: fechaPago || null })
      .eq('numero_factura', numeroFactura)
    if (error) throw error
    await get().loadAll()
  },

  deleteReport: async (id) => {
    const { error } = await supabase.from('scytel_reports').delete().eq('id', id)
    if (error) throw error
    set(s => ({ reports: s.reports.filter(r => r.id !== id) }))
  },
}))
