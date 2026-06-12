import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { TABLES } from '../lib/tables'

const DEFAULT_EMPRESA = {
  nombre:                'Empresa',
  nombre_corto:          'Nokia',
  logo_url:              '',
  logo_icon_url:         '',
  color_primario:        '#144E4A',
  tipos_cuadrilla:       [],
  cliente_nombre:        '',
  cliente_logo_url:      '',
  cliente_logo_icon_url: '',
  dev_nombre:            '',
  dev_logo_url:          '',
  dev_logo_icon_url:     '',
}

export const useEmpresaStore = create((set) => ({
  empresaConfig: DEFAULT_EMPRESA,

  loadEmpresaConfig: async () => {
    const { data } = await supabase
      .from(TABLES.CONFIG)
      .select('value')
      .eq('key', 'empresa_config')
      .single()
    if (data?.value) {
      try {
        set({ empresaConfig: { ...DEFAULT_EMPRESA, ...JSON.parse(data.value) } })
      } catch { /* ignore */ }
    }
  },

  saveEmpresaConfig: async (config) => {
    const value = JSON.stringify(config)
    const { error } = await supabase
      .from(TABLES.CONFIG)
      .upsert({ key: 'empresa_config', value }, { onConflict: 'key' })
    if (error) throw error
    set({ empresaConfig: { ...DEFAULT_EMPRESA, ...config } })
  },
}))
