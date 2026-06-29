import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useTsqaStore = create((set, get) => ({
  audits:  [],
  loading: false,
  loaded:  false,

  loadAudits: async () => {
    if (get().loading) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('tsqa_audits')
      .select('id, audit_data, created_at, created_by')
      .order('created_at', { ascending: false })
    if (!error && data) {
      set({ audits: data.map(r => ({ ...r.audit_data, _savedAt: r.created_at })), loaded: true })
    }
    set({ loading: false })
  },

  saveAudit: async (site, userId) => {
    const row = {
      id:         site.id,
      smp_wo:     site.smpWo     || null,
      site_name:  site.siteName  || null,
      filename:   site.filename  || null,
      audit_data: site,
      created_by: userId         || null,
    }
    const { error } = await supabase
      .from('tsqa_audits')
      .upsert(row, { onConflict: 'id' })
    if (!error) {
      set(s => {
        const rest = s.audits.filter(a => a.id !== site.id)
        return { audits: [{ ...site, _savedAt: new Date().toISOString() }, ...rest] }
      })
    }
    return !error
  },

  deleteAudit: async (id) => {
    const { error } = await supabase
      .from('tsqa_audits')
      .delete()
      .eq('id', id)
    if (!error) {
      set(s => ({ audits: s.audits.filter(a => a.id !== id) }))
    }
    return !error
  },
}))
