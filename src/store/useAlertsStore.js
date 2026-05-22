import { create } from 'zustand'

const LS_DISMISSED = 'nokia_alerts_dismissed_v1'

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]')) }
  catch { return new Set() }
}

function saveDismissed(ids) {
  localStorage.setItem(LS_DISMISSED, JSON.stringify([...ids]))
}

function daysBetween(dateStr, now) {
  if (!dateStr) return 0
  return Math.floor((now - new Date(dateStr)) / 86400000)
}

function daysUntil(dateStr, now) {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (isNaN(d)) return Infinity
  return Math.floor((d - now) / 86400000)
}

const THRESHOLDS = { spo: 30, despacho: 7, sitioSinHw: 15, forecast: 7 }

const FC_DATE_FIELDS = [
  { key: 'fc_avance_doc',        label: 'Avance DOC' },
  { key: 'fc_avance_hw_cierre',  label: 'Avance HW Cierre' },
  { key: 'fc_avance_site_owner', label: 'Avance Site Owner' },
  { key: 'fc_avance_on_air',     label: 'Avance On Air' },
]

export function computeAlerts({ pos, invoices, catalogo, stock, hwDespachosPendientes, hwEquipos, forecasts, sabana }) {
  const alerts = []
  const now = new Date()

  // Índice sabana por smp para lookup rápido
  const sabanaMap = {}
  for (const row of (sabana || [])) {
    if (row.smp) sabanaMap[row.smp] = row
  }

  // ── 1. SPO sin facturar (ninguna factura en > 30 días desde integración del sitio) ──
  const invoicedSpos = new Set(invoices.map(inv => inv.spo_number))
  for (const po of pos) {
    if (invoicedSpos.has(po.spo_number)) continue
    const sabanaRow = po.smp_id ? sabanaMap[po.smp_id] : null
    const refDate = sabanaRow?.integracion || po.doc_date
    const days = daysBetween(refDate, now)
    if (days < THRESHOLDS.spo) continue
    alerts.push({
      id:          `spo_sin_facturar_${po.spo_number}`,
      type:        'spo_sin_facturar',
      module:      'facturacion',
      severity:    days > 60 ? 'high' : 'medium',
      title:       `SPO ${po.spo_number} sin facturar`,
      description: `${days} días desde integración del sitio${po.site_name ? ` · ${po.site_name}` : ''}`,
      link:        '/facturacion/por-facturar',
      roles:       ['facturacion', 'admin', 'coordinador'],
    })
  }

  // ── 2. Material bajo mínimo ──────────────────────────────────────
  for (const cat of catalogo) {
    if (!cat.stock_minimo || cat.activo === false) continue
    const total = stock
      .filter(s => s.catalogo_id === cat.id)
      .reduce((acc, s) => acc + (s.stock_actual || 0), 0)
    if (total >= cat.stock_minimo) continue
    alerts.push({
      id:          `mat_bajo_minimo_${cat.id}`,
      type:        'material_bajo_minimo',
      module:      'materiales',
      severity:    total === 0 ? 'high' : 'medium',
      title:       `${cat.nombre} bajo mínimo`,
      description: `Stock actual: ${total} · Mínimo: ${cat.stock_minimo}`,
      link:        '/materiales/inventario',
      roles:       ['logistica', 'admin', 'coordinador'],
    })
  }

  // ── 3. Despacho HW pendiente sin ejecutar > 7 días (solo 2026) ──
  for (const d of hwDespachosPendientes) {
    if ((d.created_at || '') < '2026-01-01') continue
    const days = daysBetween(d.created_at, now)
    if (days < THRESHOLDS.despacho) continue
    alerts.push({
      id:          `hw_despacho_pendiente_${d.id}`,
      type:        'despacho_sin_confirmar',
      module:      'hardware',
      severity:    'medium',
      title:       `Despacho #${d.numero_doc || d.id.slice(0, 8)} sin ejecutar`,
      description: `${days} días pendiente${d.destino ? ` · Destino: ${d.destino}` : ''}`,
      link:        '/materiales/hw/despachos-pendientes',
      roles:       ['logistica', 'admin', 'coordinador'],
    })
  }

  // ── 4. Sitio con PO activa sin equipos HW (> 15 días) ────────────
  const sitesConHw = new Set(
    hwEquipos
      .filter(e => e.estado !== 'en_bodega' && e.estado !== 'pendiente_despacho')
      .map(e => e.ubicacion_actual)
      .filter(Boolean)
  )
  const alertedSites = new Set()
  for (const po of pos) {
    if (!po.site_name) continue
    if (alertedSites.has(po.site_name)) continue
    if ((po.doc_date || '') < '2026-01-01') continue
    const days = daysBetween(po.doc_date, now)
    if (days < THRESHOLDS.sitioSinHw) continue
    if (sitesConHw.has(po.site_name)) continue
    alertedSites.add(po.site_name)
    alerts.push({
      id:          `sitio_sin_hw_${po.spo_number}`,
      type:        'sitio_sin_equipos',
      module:      'hardware',
      severity:    'low',
      title:       `${po.site_name} sin equipos HW`,
      description: `PO ${po.spo_number} activa hace ${days} días sin HW asignado`,
      link:        '/materiales/hw/inventario',
      roles:       ['logistica', 'admin', 'coordinador'],
    })
  }

  // ── 5. ACK Forecast próximo a vencer (≤ 7 días) ─────────────────
  for (const [smp, fc] of Object.entries(forecasts)) {
    for (const { key, label } of FC_DATE_FIELDS) {
      const date = fc[key]
      if (!date) continue
      const dias = daysUntil(date, now)
      if (dias < 0 || dias > THRESHOLDS.forecast) continue
      alerts.push({
        id:          `forecast_${smp}_${key}`,
        type:        'forecast_vencer',
        module:      'rollout',
        severity:    dias <= 2 ? 'high' : 'medium',
        title:       `Forecast ${label} próximo a vencer`,
        description: `${smp} · ${dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`}`,
        link:        '/rollout/ack/forecast',
        roles:       ['admin', 'coordinador', 'TI', 'TSS', 'CW'],
      })
    }
  }

  return alerts
}

export const useAlertsStore = create((set, get) => ({
  alerts:       [],
  dismissedIds: loadDismissed(),

  // Llamar desde Layout pasando datos de todos los stores (incluyendo sabana del ACK)
  compute: (data) => {
    const alerts     = computeAlerts(data)
    const activeIds  = new Set(alerts.map(a => a.id))
    // Poda automática: si el problema se resolvió, el ID ya no está en alerts → se limpia
    const dismissedIds = new Set([...get().dismissedIds].filter(id => activeIds.has(id)))
    saveDismissed(dismissedIds)
    set({ alerts, dismissedIds })
  },

  dismissAlert: (id) => {
    const dismissedIds = new Set(get().dismissedIds)
    dismissedIds.add(id)
    saveDismissed(dismissedIds)
    set({ dismissedIds })
  },

  dismissAll: (ids) => {
    const dismissedIds = new Set(get().dismissedIds)
    ids.forEach(id => dismissedIds.add(id))
    saveDismissed(dismissedIds)
    set({ dismissedIds })
  },
}))
