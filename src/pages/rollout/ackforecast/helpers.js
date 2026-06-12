import { PROCESOS, nokiaWeekLabel } from '../../../store/useAckStore'

export function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

export function fmtDate(dateStr) {
  if (!dateStr) return null
  return dateStr.slice(0, 10)
}

export function rangeLabel(prev, curr) {
  if (prev && curr && prev !== curr) return `${prev}-${curr}`
  return curr || prev || ''
}

export function resolveOwner(owner, empresaNombre) {
  if (!owner) return owner
  return owner.trim().toUpperCase() === 'SS' ? (empresaNombre || owner) : owner
}

export function buildGapTree(rows, procesoKey) {
  const map = new Map()
  for (const r of rows) {
    const gap  = r[procesoKey] || '(Sin estado)'
    const site = r.site_name   || '(Sin sitio)'
    if (!map.has(gap)) map.set(gap, new Map())
    map.get(gap).set(site, (map.get(gap).get(site) || 0) + 1)
  }
  return map
}

export function buildTicketTree(rows, procesoKey, ticketKey) {
  const map = new Map()
  for (const r of rows) {
    const owner = r[ticketKey]
    if (!owner) continue
    const gap  = r[procesoKey] || '(Sin estado)'
    const site = r.site_name || r.smp
    const id   = r.tickets_id ? String(r.tickets_id).trim() : null
    if (!map.has(gap)) map.set(gap, new Map())
    const gMap = map.get(gap)
    if (!gMap.has(site)) gMap.set(site, { owner, count: 0, ids: new Set() })
    const entry = gMap.get(site)
    entry.count++
    if (id) entry.ids.add(id)
  }
  return map
}

export function buildFcData(rows, procesoKey, forecasts, faKey, ticketKey) {
  const gapMap        = new Map()
  const weekSet       = new Set()
  const weekFirstDate = new Map()
  const pending       = rows.filter(r => !isFinal(r[procesoKey]))

  for (const r of pending) {
    const gap     = r[procesoKey] || '(Sin estado)'
    const site    = r.site_name   || '(Sin sitio)'
    const fc      = forecasts[r.smp]
    if (!fc?.[faKey]) continue
    const rawDate = fc[faKey]
    const week    = nokiaWeekLabel(rawDate)
    const fmted   = fmtDate(rawDate)
    if (!week) continue

    weekSet.add(week)
    if (!weekFirstDate.has(week) || rawDate < weekFirstDate.get(week))
      weekFirstDate.set(week, rawDate)

    if (!gapMap.has(gap)) gapMap.set(gap, { weeks: new Map(), sites: new Map() })
    const g = gapMap.get(gap)
    g.weeks.set(week, (g.weeks.get(week) || 0) + 1)

    if (!g.sites.has(site)) g.sites.set(site, { weeks: new Map(), ticketCount: 0 })
    const s = g.sites.get(site)
    if (!s.weeks.has(week)) s.weeks.set(week, { count: 0, exactDates: new Set() })
    const sw = s.weeks.get(week)
    sw.count++
    if (fmted) sw.exactDates.add(fmted)
    if (ticketKey && r[ticketKey]) s.ticketCount++
  }

  const gapEntries = [...gapMap.entries()]
    .filter(([, g]) => g.weeks.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))
  const weeks = [...weekSet].sort((a, b) =>
    (weekFirstDate.get(a) || '').localeCompare(weekFirstDate.get(b) || '')
  )
  return { gapEntries, weeks }
}

export const PROC_CFG = {
  gap_on_air:     { label: 'ON AIR',           nokia: 'GAP OnAir',        color: '#0ea5e9', fa: 'fc_avance_on_air',     ticket: 'ticket_on_air_owner'    },
  gap_log_inv:    { label: 'LOGÍSTICA INVERSA', nokia: 'GAP LI',           color: '#f59e0b', fa: 'fc_avance_on_air',     ticket: 'ticket_log_inv_owner'   },
  gap_site_owner: { label: 'SITE OWNER',        nokia: 'GAP SITE OWNER',   color: '#8b5cf6', fa: 'fc_avance_site_owner', ticket: 'ticket_so_owner'        },
  gap_doc:        { label: 'DOCUMENTACIÓN',     nokia: 'GAP DOC',          color: '#10b981', fa: 'fc_avance_doc',        ticket: 'ticket_doc_owner'       },
  gap_hw_cierre:  { label: 'CIERRE HW',         nokia: 'GAP CIERRE DE HW', color: '#ef4444', fa: 'fc_avance_hw_cierre',  ticket: 'ticket_hw_cierre_owner' },
}

export const FILTRO_OPTS = [
  { value: 'todos',      label: 'Ver Todos' },
  { value: 'pendientes', label: 'Solo Pendientes' },
  { value: 'cerrados',   label: 'Solo Cerrados' },
]

export const FILTRO_BADGE = {
  pendientes: { bg: '#fee2e2', color: '#991b1b', text: '● Pendientes' },
  cerrados:   { bg: '#dcfce7', color: '#166534', text: '✓ Cerrados' },
}

export const REPORT_KEYS     = ['gap_doc', 'gap_hw_cierre', 'gap_log_inv', 'gap_site_owner', 'gap_on_air']
export const REPORT_PROCESOS = REPORT_KEYS.map(k => PROCESOS.find(p => p.key === k)).filter(Boolean)

export function applyFiltroRows(rows, procesoKey, filtro, estadosOcultos = {}) {
  const ocultos = estadosOcultos[procesoKey] || []
  let filtered = ocultos.length ? rows.filter(r => !ocultos.includes(r[procesoKey])) : rows
  if (filtro === 'pendientes') return filtered.filter(r => !isFinal(r[procesoKey]))
  if (filtro === 'cerrados')   return filtered.filter(r =>  isFinal(r[procesoKey]))
  return filtered
}

export function thStyle(color, forPrint, extra = {}) {
  return {
    background: color,
    color: '#fff',
    padding: forPrint ? '4px 7px' : '6px 10px',
    textAlign: 'left',
    fontWeight: 700,
    border: `1px solid ${color}`,
    ...extra,
  }
}

export function thCenterStyle(color, forPrint, extra = {}) {
  return { ...thStyle(color, forPrint, extra), textAlign: 'center', width: forPrint ? 50 : 65, whiteSpace: 'nowrap' }
}
