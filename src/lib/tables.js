// Supabase table (and storage bucket) name constants.
// Use these instead of inline strings so typos are caught by grep and editors.

export const TABLES = {
  // ── Core ───────────────────────────────────────────────────────
  SITIOS:           'sitios',
  SITIOS_COORDS:    'sitios_coordenadas',
  GASTOS:           'gastos',
  LIQUIDACIONES_CW: 'liquidaciones_cw',
  SUBCONTRATISTAS:  'subcontratistas',
  CATALOGO_TI:      'catalogo_ti',
  CATALOGO_CW:      'catalogo_cw',
  CONFIG:           'config',
  USER_ROLES:       'user_roles',
  USER_PREFS:       'user_prefs',
  LC_LOCATIONS:     'lc_locations',
  BODEGAS:          'bodegas',

  // ── ACK / Rollout ───────────────────────────────────────────────
  ACK_SABANA:    'ack_sabana',
  ACK_UPLOADS:   'ack_uploads',
  ACK_FORECAST:  'ack_forecast',
  ACK_GLOSARIO:  'ack_glosario',
  ROLLOUT_UPLOADS: 'rollout_uploads',

  // ── Facturación ─────────────────────────────────────────────────
  FACT_PPA:          'fact_ppa',
  FACT_POS:          'fact_pos',
  FACT_POS_HIST:     'fact_pos_historial',
  FACT_INVOICES:     'fact_invoices',
  FACT_UPLOADS:      'fact_uploads',
  FACT_REJECTED_POS: 'fact_rejected_pos',
  FACT_CALENDAR:     'fact_calendar',
  PAGOS_SUBC:        'pagos_subc',

  // ── Materiales ──────────────────────────────────────────────────
  MAT_CATALOGO:      'mat_catalogo',
  MAT_STOCK:         'mat_stock',
  MAT_SITIOS:        'mat_sitios',
  MAT_MOVIMIENTOS:   'mat_movimientos',
  MAT_PENDIENTES:    'mat_pendientes',
  MAT_PROVEEDORES:   'mat_proveedores',
  MAT_PRECIOS_PROV:  'mat_precios_proveedor',
  MAT_DESPACHOS_PEND: 'mat_despachos_pendientes',
  DESPACHOS:         'despachos',

  // ── HW / Bodega Nokia ───────────────────────────────────────────
  HW_CATALOGO:       'hw_catalogo',
  HW_EQUIPOS:        'hw_equipos',
  HW_MOVIMIENTOS:    'hw_movimientos',
  HW_BODEGAS:        'hw_bodegas_nokia',
  HW_SERVICE_SUPP:   'hw_service_suppliers',
  HW_TIPO_UNIDADES:  'hw_tipo_unidades',
  HW_FALLAS:         'hw_fallas',
  HW_DESPACHOS_PEND: 'hw_despachos_pendientes',
  HW_LOG_INVERSA:    'hw_log_inversa',
  HW_LI_BODEGAS:     'hw_li_bodegas_destino',
  HW_LI_CONCEPTOS:   'hw_li_conceptos',
  HW_KARDEX_DISP:    'hw_kardex_disponible',
  HW_KARDEX_MOVS:    'hw_kardex_movimientos',
}

// Storage bucket names (used with supabase.storage.from())
export const BUCKETS = {
  FACTURACION: 'facturacion',
}

// Estado values for liquidaciones and sitios
export const ESTADO = {
  FINAL: 'final',
  PRE:   'pre',
}

// localStorage key constants
export const LS_KEYS = {
  ACK_UPLOAD_IDS:  'ack_upload_ids',
  ACK_GLOSARIO:    'ack_glosario_v1',
  LIQUIDADOR_LAST: 'liquidador_last_id',
  HW_BODEGA:       'hw_bodega_principal',
}
