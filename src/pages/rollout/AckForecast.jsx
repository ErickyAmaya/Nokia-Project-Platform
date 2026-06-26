import { useMemo, useState, useEffect } from 'react'
import { SquaresExclude } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAckStore, PROCESOS, nokiaWeekLabel, getNokiaWeek } from '../../store/useAckStore'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { exportAckToExcel } from '../../lib/ackExcelExport'
import AckTablas from './AckTablas'
import AdminAckGlosario from '../admin/AdminAckGlosario'

// ── Helpers ───────────────────────────────────────────────────────
function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  return dateStr.slice(0, 10)
}

function rangeLabel(prev, curr) {
  if (prev && curr && prev !== curr) return `${prev}-${curr}`
  return curr || prev || ''
}

const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function parseLabelFromFilename(filename) {
  if (!filename) return null

  function tryDate(y, mo, d, h, mi) {
    if (+y < 2020 || +y > 2035) return null
    if (+mo < 1   || +mo > 12)  return null
    if (+d  < 1   || +d  > 31)  return null
    const iso     = new Date(Date.UTC(+y, +mo - 1, +d)).toISOString()
    const { week } = getNokiaWeek(iso)
    const timeStr = h && mi ? ` ${h}:${mi}` : ''
    return `W${String(week).padStart(2,'0')} · ${+d} ${MESES_SHORT[+mo - 1]}${timeStr}`
  }

  // 1. YYYYMMDD_HHMM o YYYYMMDD
  let m = filename.match(/(\d{4})(\d{2})(\d{2})[_\-]?(\d{2})(\d{2})/) || filename.match(/(\d{4})(\d{2})(\d{2})/)
  if (m) {
    const r = tryDate(m[1], m[2], m[3], m[4], m[5])
    if (r) return r
  }

  // 2. DDMMYYYY_HHMM o DDMMYYYY
  m = filename.match(/(\d{2})(\d{2})(\d{4})[_\-]?(\d{2})(\d{2})/) || filename.match(/(\d{2})(\d{2})(\d{4})/)
  if (m) {
    const r = tryDate(m[3], m[2], m[1], m[4], m[5])
    if (r) return r
  }

  return null
}

// ── Builders de árbol ─────────────────────────────────────────────

// GAP → sitios → count
function buildGapTree(rows, procesoKey) {
  const map = new Map()
  for (const r of rows) {
    const gap  = r[procesoKey] || '(Sin estado)'
    const site = r.site_name   || '(Sin sitio)'
    if (!map.has(gap)) map.set(gap, new Map())
    map.get(gap).set(site, (map.get(gap).get(site) || 0) + 1)
  }
  return map
}

// GAP → site_name → { owner, count, ids: Set<ticketId> }
function buildTicketTree(rows, procesoKey, ticketKey) {
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

// FC: gap → { weeks: Map<week,count>, sites: Map<site_name, {weeks: Map<week,{count,exactDates}>, ticketCount}> }
function buildFcData(rows, procesoKey, forecasts, faKey, ticketKey) {
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

// ── Config por proceso ────────────────────────────────────────────
const PROC_CFG = {
  gap_on_air:     { label: 'ON AIR',           nokia: 'GAP OnAir',        color: '#0ea5e9', fa: 'fc_avance_on_air',     ticket: 'ticket_on_air_owner'    },
  gap_log_inv:    { label: 'LOGÍSTICA INVERSA', nokia: 'GAP LI',           color: '#f59e0b', fa: 'fc_avance_on_air',     ticket: 'ticket_log_inv_owner'   },
  gap_site_owner: { label: 'SITE OWNER',        nokia: 'GAP SITE OWNER',   color: '#8b5cf6', fa: 'fc_avance_site_owner', ticket: 'ticket_so_owner'        },
  gap_doc:        { label: 'DOCUMENTACIÓN',     nokia: 'GAP DOC',          color: '#10b981', fa: 'fc_avance_doc',        ticket: 'ticket_doc_owner'       },
  gap_hw_cierre:  { label: 'CIERRE HW',         nokia: 'GAP CIERRE DE HW', color: '#ef4444', fa: 'fc_avance_hw_cierre',  ticket: 'ticket_hw_cierre_owner' },
}


// ── Shared table styles ───────────────────────────────────────────
function thStyle(color, forPrint, extra = {}) {
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
function thCenterStyle(color, forPrint, extra = {}) {
  return { ...thStyle(color, forPrint, extra), textAlign: 'center', width: forPrint ? 50 : 65, whiteSpace: 'nowrap' }
}

// ── Tabla Nokia GAP → sitios ──────────────────────────────────────
function NokiaTable({ rows, procesoKey, label, color = '#7030A0', forPrint = false }) {
  const gapTree    = useMemo(() => buildGapTree(rows, procesoKey), [rows, procesoKey])
  const gapEntries = [...gapTree.entries()].sort(([a], [b]) => a.localeCompare(b))
  const total      = rows.length
  const FS         = forPrint ? 8 : 10

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          <th style={thCenterStyle(color, forPrint)}>No de Actividades</th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.length === 0
          ? <tr><td colSpan={2} style={{ padding: 12, textAlign: 'center', color: '#4b5563' }}>Sin datos</td></tr>
          : gapEntries.map(([gap, sites]) => {
              const fin      = isFinal(gap)
              const gapTotal = [...sites.values()].reduce((s, v) => s + v, 0)
              return [
                <tr key={gap}>
                  <td style={{ padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: fin ? '#166534' : '#C00000' }}>
                    {gap}
                  </td>
                  <td style={{ padding: forPrint ? '3px 5px' : '4px 8px', textAlign: 'center', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: fin ? '#166534' : '#C00000' }}>
                    {gapTotal}
                  </td>
                </tr>,
                ...[...sites.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([site, cnt]) => (
                  <tr key={`${gap}|${site}`}>
                    <td style={{ padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                      {site}
                    </td>
                    <td style={{ padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                      {cnt}
                    </td>
                  </tr>
                )),
              ]
            })
        }
        <tr>
          <td style={{ padding: forPrint ? '4px 7px' : '5px 10px', fontWeight: 800, background: color, color: '#fff', border: `1px solid ${color}` }}>
            Total general
          </td>
          <td style={{ padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center', fontWeight: 800, background: color, color: '#fff', border: `1px solid ${color}` }}>
            {total}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ── Tabla Nokia FC (GAP × Sitio × Semana Nokia + Tickets) ────────
function NokiaFcTable({ rows, procesoKey, forecasts, ticketKey, label, color = '#7030A0', forPrint = false }) {
  const navigate = useNavigate()
  const { gapEntries, weeks } = useMemo(
    () => buildFcData(rows, procesoKey, forecasts, PROC_CFG[procesoKey].fa, ticketKey),
    [rows, procesoKey, forecasts, ticketKey]
  )

  if (!weeks.length) return (
    <div style={{ padding: forPrint ? '4px 8px' : 16, textAlign: 'center', color: '#4b5563', fontSize: forPrint ? 8 : 11, fontFamily: 'Arial, sans-serif' }}>
      Sin fechas FC registradas.
    </div>
  )

  const FS    = forPrint ? 8 : 10
  const totBg = { background: color, color: '#fff', border: `1px solid ${color}`, fontWeight: 800 }

  function goToTablas(siteName) {
    if (!forPrint) navigate(`/rollout/ack/tablas?sitio=${encodeURIComponent(siteName)}`)
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          {weeks.map(w => <th key={w} style={thCenterStyle(color, forPrint, { width: 'auto' })}>{w}</th>)}
          <th style={thCenterStyle(color, forPrint, { width: 44 })}>TICKETS</th>
          <th style={thCenterStyle(color, forPrint, { width: 'auto' })}>No de Actividades</th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.map(([gap, g]) => {
          const gapTotal   = [...g.weeks.values()].reduce((s, v) => s + v, 0)
          const gapTickets = [...g.sites.values()].reduce((s, v) => s + v.ticketCount, 0)
          return [
            <tr key={gap}>
              <td style={{ padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: '#C00000' }}>{gap}</td>
              {weeks.map(w => <td key={w} style={{ padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center', background: '#DCE6F1', border: '1px solid #c0c0c0', fontWeight: 700 }}>{g.weeks.get(w) || ''}</td>)}
              <td style={{ padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center', background: '#DCE6F1', border: '1px solid #c0c0c0', fontWeight: 700, color: gapTickets ? '#1a3a5c' : '#ccc' }}>{gapTickets || '—'}</td>
              <td style={{ padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center', background: '#DCE6F1', border: '1px solid #c0c0c0', fontWeight: 700 }}>{gapTotal}</td>
            </tr>,
            ...[...g.sites.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([site, s]) => {
              const siteTotal = [...s.weeks.values()].reduce((a, sw) => a + sw.count, 0)
              if (!siteTotal) return null
              return (
                <tr key={`${gap}|${site}`}>
                  <td style={{ padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                    {forPrint ? site : (
                      <span onClick={() => goToTablas(site)}
                        style={{ cursor: 'pointer', color: '#1a3a5c', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                        title="Ver todos los SMPs en Tablas">
                        {site}
                      </span>
                    )}
                  </td>
                  {weeks.map(w => {
                    const sw    = s.weeks.get(w)
                    const count = sw?.count || 0
                    const title = sw ? [...sw.exactDates].sort().join(' · ') : ''
                    return (
                      <td key={w}
                        title={title || undefined}
                        style={{
                          padding: forPrint ? '2px 5px' : '3px 7px',
                          textAlign: 'center',
                          background: '#fff',
                          border: '1px solid #e8e8e8',
                          fontSize: forPrint ? 7.5 : 9,
                          cursor: (!forPrint && title) ? 'zoom-in' : 'default',
                        }}
                      >
                        {count || ''}
                      </td>
                    )
                  })}
                  <td style={{ padding: forPrint ? '2px 5px' : '3px 7px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9, color: s.ticketCount ? '#1a3a5c' : '#ccc', fontWeight: s.ticketCount ? 700 : 400 }}>
                    {s.ticketCount || '—'}
                  </td>
                  <td style={{ padding: forPrint ? '2px 5px' : '3px 7px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>{siteTotal}</td>
                </tr>
              )
            }),
          ]
        })}
        <tr>
          <td style={{ ...totBg, padding: forPrint ? '4px 7px' : '5px 10px' }}>Total general</td>
          {weeks.map(w => {
            const col = gapEntries.reduce((s, [, g]) => s + (g.weeks.get(w) || 0), 0)
            return <td key={w} style={{ ...totBg, padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center' }}>{col || ''}</td>
          })}
          <td style={{ ...totBg, padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center' }}>
            {gapEntries.reduce((s, [, g]) => s + [...g.sites.values()].reduce((a, v) => a + v.ticketCount, 0), 0) || '—'}
          </td>
          <td style={{ ...totBg, padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center' }}>
            {gapEntries.reduce((s, [, g]) => s + [...g.weeks.values()].reduce((a, b) => a + b, 0), 0)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// SS → nombre de empresa configurado en la app
function resolveOwner(owner, empresaNombre) {
  if (!owner) return owner
  return owner.trim().toUpperCase() === 'SS' ? (empresaNombre || owner) : owner
}

// ── Tabla Nokia Tickets (GAP → owner → SMPs) ─────────────────────
function NokiaTicketTable({ rows, procesoKey, ticketKey, label, color = '#7030A0', empresaNombre = '', forPrint = false }) {
  const navigate   = useNavigate()
  const gapTree    = useMemo(() => buildTicketTree(rows, procesoKey, ticketKey), [rows, procesoKey, ticketKey])
  const gapEntries = [...gapTree.entries()].sort(([a], [b]) => a.localeCompare(b))
  const total      = gapEntries.reduce((s, [, sites]) =>
    s + [...sites.values()].reduce((a, e) => a + e.count, 0), 0)
  const FS = forPrint ? 8 : 10

  if (!total) return (
    <div style={{ padding: forPrint ? '4px 8px' : 16, textAlign: 'center', color: '#4b5563', fontSize: forPrint ? 8 : 11, fontFamily: 'Arial, sans-serif' }}>
      Sin tickets registrados para este proceso.
    </div>
  )

  const cellGap = { padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0' }
  const cellSub = { background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }
  const cellTot = { fontWeight: 800, background: color, color: '#fff', border: `1px solid ${color}` }

  function goToTablas(siteName) {
    if (!forPrint) navigate(`/rollout/ack/tablas?sitio=${encodeURIComponent(siteName)}`)
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          <th style={thCenterStyle(color, forPrint)}>Owner</th>
          <th style={{ ...thCenterStyle(color, forPrint), width: forPrint ? 90 : 130 }}>No. Ticket</th>
          <th style={thCenterStyle(color, forPrint)}>No de Actividades</th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.map(([gap, sites]) => {
          const fin      = isFinal(gap)
          const gapTotal = [...sites.values()].reduce((s, e) => s + e.count, 0)
          const txtColor = fin ? '#166534' : '#C00000'
          return [
            // Fila GAP
            <tr key={gap}>
              <td style={{ ...cellGap, color: txtColor }}>{gap}</td>
              <td style={{ ...cellGap, color: txtColor, textAlign: 'center' }}>—</td>
              <td style={{ ...cellGap, color: txtColor, textAlign: 'center' }}>—</td>
              <td style={{ ...cellGap, color: txtColor, textAlign: 'center' }}>{gapTotal}</td>
            </tr>,
            // Una fila por sitio: Sitio (clickable) | Owner | Tickets | Count
            ...[...sites.entries()]
              .sort(([a], [b]) => String(a).localeCompare(String(b)))
              .map(([site, { owner, count, ids }]) => {
                const ticketNums = [...ids].sort().join(', ') || '—'
                const ownerLabel = resolveOwner(owner, empresaNombre)
                return (
                  <tr key={`${gap}|${site}`}>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px' }}>
                      {forPrint ? site : (
                        <span
                          onClick={() => goToTablas(site)}
                          style={{ cursor: 'pointer', color: '#1a3a5c', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                          title="Ver en Tablas"
                        >
                          {site}
                        </span>
                      )}
                    </td>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center', color: '#555' }}>
                      {ownerLabel}
                    </td>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center', color: '#1a3a5c', fontWeight: 600 }}>
                      {ticketNums}
                    </td>
                    <td style={{ ...cellSub, padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center' }}>
                      {count}
                    </td>
                  </tr>
                )
              }),
          ]
        })}
        <tr>
          <td style={{ ...cellTot, padding: forPrint ? '4px 7px' : '5px 10px' }}>Total general</td>
          <td style={{ ...cellTot, padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center' }}>—</td>
          <td style={{ ...cellTot, padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center' }}>—</td>
          <td style={{ ...cellTot, padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center' }}>{total}</td>
        </tr>
      </tbody>
    </table>
  )
}


// ── Orden de procesos en Reportes ────────────────────────────────
const REPORT_KEYS = ['gap_doc', 'gap_hw_cierre', 'gap_log_inv', 'gap_site_owner', 'gap_on_air']
const REPORT_PROCESOS = REPORT_KEYS.map(k => PROCESOS.find(p => p.key === k)).filter(Boolean)

// ── Helper filtro (también usado por export) ──────────────────────
function applyFiltroRows(rows, procesoKey, filtro, estadosOcultos = {}) {
  const ocultos = estadosOcultos[procesoKey] || []
  let filtered = ocultos.length ? rows.filter(r => !ocultos.includes(r[procesoKey])) : rows
  if (filtro === 'pendientes') return filtered.filter(r => !isFinal(r[procesoKey]))
  if (filtro === 'cerrados')   return filtered.filter(r =>  isFinal(r[procesoKey]))
  return filtered
}

// ── Sección de proceso (pantalla) ─────────────────────────────────
function ScreenProcess({ proceso, currRows, prevRows, currLabel, prevLabel, forecasts, filtro, estadosOcultos, empresaNombre, expanded, onToggle }) {
  const cfg     = PROC_CFG[proceso.key]
  const hasPrev = prevRows.length > 0

  const curr = applyFiltroRows(currRows, proceso.key, filtro, estadosOcultos)
  const prev = applyFiltroRows(prevRows, proceso.key, filtro, estadosOcultos)

  const total  = currRows.length
  const pend   = currRows.filter(r => !isFinal(r[proceso.key])).length
  const pct    = total ? Math.round(((total - pend) / total) * 100) : 0
  const barClr = pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'

  const prevGapLabel = `${cfg.nokia} - Estados`
  const currGapLabel = `${cfg.nokia} - Estados`
  const soloLabel    = `${cfg.nokia} - Estados`

  return (
    <div style={{ marginBottom: 14, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.07)' }}>
      {/* Header clickable — colapsa/expande */}
      <div
        onClick={onToggle}
        style={{ background: cfg.color, padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,.92)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>{cfg.nokia}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5 }}>{cfg.label}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{pct}%</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.95)' }}>{pend} pend · {total - pend} cerr</div>
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,.95)', fontWeight: 400 }}>{expanded ? '▾' : '▸'}</div>
        </div>
      </div>
      <div style={{ height: 3, background: 'rgba(0,0,0,.12)' }}>
        <div style={{ height: 3, background: barClr, width: `${pct}%` }} />
      </div>

      {/* Contenido expandible */}
      {expanded && (
        <div style={{ padding: 16, background: '#fff' }}>
          {/* Tablas GAP */}
          {hasPrev ? (
            <>
              {/* Encabezado con flecha */}
              <div style={{ display:'flex', alignItems:'center', marginBottom:8 }}>
                <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:600, color:cfg.color }}>
                  Semana Anterior <span style={{ fontWeight:400, color:'#4b5563' }}>({prevLabel})</span>
                </div>
                <div style={{ padding:'0 12px', color:cfg.color, fontSize:18, fontWeight:700, flexShrink:0 }}>——▶</div>
                <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:600, color:cfg.color }}>
                  Semana Actual <span style={{ fontWeight:400, color:'#4b5563' }}>({currLabel})</span>
                </div>
              </div>
              {/* Tablas GAP */}
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <NokiaTable rows={prev} procesoKey={proceso.key} label={prevGapLabel} color={cfg.color} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <NokiaTable rows={curr} procesoKey={proceso.key} label={currGapLabel} color={cfg.color} />
                </div>
              </div>
            </>
          ) : (
            <NokiaTable rows={curr} procesoKey={proceso.key} label={soloLabel} color={cfg.color} />
          )}

          {/* Tablas FC */}
          <div style={{ marginTop: 16 }}>
            {hasPrev ? (
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <NokiaFcTable rows={prev} procesoKey={proceso.key} forecasts={forecasts} ticketKey={cfg.ticket} label={`${cfg.nokia} - FORECAST`} color={cfg.color} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <NokiaFcTable rows={curr} procesoKey={proceso.key} forecasts={forecasts} ticketKey={cfg.ticket} label={`${cfg.nokia} - FORECAST`} color={cfg.color} />
                </div>
              </div>
            ) : (
              <NokiaFcTable rows={curr} procesoKey={proceso.key} forecasts={forecasts} ticketKey={cfg.ticket} label={`${cfg.nokia} - FORECAST`} color={cfg.color} />
            )}
          </div>

          {/* Tablas Tickets */}
          <div style={{ marginTop: 16 }}>
            {hasPrev ? (
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <NokiaTicketTable rows={prev} procesoKey={proceso.key} ticketKey={cfg.ticket} label={`${cfg.nokia} - TICKET`} color={cfg.color} empresaNombre={empresaNombre} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <NokiaTicketTable rows={curr} procesoKey={proceso.key} ticketKey={cfg.ticket} label={`${cfg.nokia} - TICKET`} color={cfg.color} empresaNombre={empresaNombre} />
                </div>
              </div>
            ) : (
              <NokiaTicketTable rows={curr} procesoKey={proceso.key} ticketKey={cfg.ticket} label={`${cfg.nokia} - TICKET`} color={cfg.color} empresaNombre={empresaNombre} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Diapositiva Nokia (impresión) ─────────────────────────────────
function PrintSlide({ proceso, currRows, prevRows, currLabel, prevLabel, forecasts, uploads, empresaNombre }) {
  const cfg      = PROC_CFG[proceso.key]
  const hasPrev  = prevRows.length > 0
  const lastFile = uploads[0]
  const rl       = rangeLabel(prevLabel, currLabel)

  const prevGapLabel = `${cfg.nokia} - Estados`
  const currGapLabel = `${cfg.nokia} - Estados`
  const soloLabel    = `${cfg.nokia} - Estados`
  const fcLabel      = `${cfg.nokia} - FORECAST ${rl}`
  const ticketLabel  = `${cfg.nokia} - TICKET ${rl}`

  return (
    <div className="nokia-slide" style={{ fontFamily: 'Arial, sans-serif', padding: '6mm 0' }}>
      {/* Header */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 900, fontSize: 13, color: cfg.color, width: '30%' }}>INGETEL S.A.S.</td>
            <td style={{ textAlign: 'center', fontSize: 15, fontWeight: 900, color: cfg.color }}>{cfg.nokia}</td>
            <td style={{ textAlign: 'right', fontSize: 8, color: '#555', width: '30%' }}>
              {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
              {lastFile && <><br /><span style={{ fontSize: 7, color: '#888' }}>{lastFile.file_name}</span></>}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ height: 2, background: cfg.color, marginBottom: 8 }} />

      {/* Etiqueta de semanas */}
      <div style={{ textAlign: 'center', color: cfg.color, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
        {hasPrev ? `${prevLabel}  ——▶  ${currLabel}` : currLabel}
      </div>

      {/* Fila superior: tablas GAP de comparación */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
        {hasPrev && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>
              Semana Anterior ({prevLabel})
            </div>
            <NokiaTable rows={prevRows} procesoKey={proceso.key} label={prevGapLabel} color={cfg.color} forPrint />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasPrev && (
            <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>
              Semana Actual ({currLabel})
            </div>
          )}
          <NokiaTable rows={currRows} procesoKey={proceso.key} label={hasPrev ? currGapLabel : soloLabel} color={cfg.color} forPrint />
        </div>
      </div>

      {/* Fila inferior: FC y Tickets lado a lado */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>{fcLabel}</div>
          <NokiaFcTable rows={currRows} procesoKey={proceso.key} forecasts={forecasts} ticketKey={cfg.ticket} label={fcLabel} color={cfg.color} forPrint />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>{ticketLabel}</div>
          <NokiaTicketTable rows={currRows} procesoKey={proceso.key} ticketKey={cfg.ticket} label={ticketLabel} color={cfg.color} empresaNombre={empresaNombre} forPrint />
        </div>
      </div>
    </div>
  )
}

// ── Modal de configuración de estados ocultos ─────────────────────
function SetupModal({ sabana, estadosOcultos, onSave, onClose }) {
  const [draft, setDraft]       = useState(() => {
    const base = {}
    REPORT_KEYS.forEach(k => { base[k] = [...(estadosOcultos[k] || [])] })
    return base
  })
  const [activeProc, setActiveProc] = useState(REPORT_KEYS[0])

  const statesByProc = useMemo(() => {
    const map = {}
    for (const key of REPORT_KEYS) {
      map[key] = [...new Set(sabana.map(r => r[key]).filter(Boolean))].sort()
    }
    return map
  }, [sabana])

  function toggle(procKey, estado) {
    const curr = draft[procKey] || []
    setDraft(d => ({
      ...d,
      [procKey]: curr.includes(estado) ? curr.filter(e => e !== estado) : [...curr, estado],
    }))
  }

  const totalOcultos = Object.values(draft).reduce((s, arr) => s + arr.length, 0)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: 'min(680px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#1a3a5c', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5 }}>Configurar Reporte Nokia</div>
            <div style={{ fontSize: 10, opacity: .8, marginTop: 2 }}>
              Desmarca los estados que no se revisan en reunión — quedan en Seguimiento
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Process tabs */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #e0e4e0', background: '#f8faf8', overflowX: 'auto' }}>
          {REPORT_KEYS.map(key => {
            const cfg = PROC_CFG[key]
            const cnt = (draft[key] || []).length
            return (
              <button key={key}
                onClick={() => setActiveProc(key)}
                style={{
                  padding: '9px 14px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: "'Barlow', sans-serif", fontSize: 10, fontWeight: 700,
                  letterSpacing: .4, textTransform: 'uppercase',
                  background: activeProc === key ? '#fff' : 'transparent',
                  borderBottom: activeProc === key ? `3px solid ${cfg.color}` : '3px solid transparent',
                  color: activeProc === key ? cfg.color : '#4b5563',
                  position: 'relative',
                }}
              >
                {cfg.label}
                {cnt > 0 && (
                  <span style={{ marginLeft: 5, background: cfg.color, color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 8, fontWeight: 800 }}>
                    {cnt}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Estado checkboxes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {(statesByProc[activeProc] || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 12 }}>
              Sin estados en este proceso
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(statesByProc[activeProc] || []).map(estado => {
                const oculto  = (draft[activeProc] || []).includes(estado)
                const fin     = isFinal(estado)
                const code    = estado.split('.')[0]
                return (
                  <label key={estado}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                      borderRadius: 7, cursor: 'pointer',
                      background: oculto ? '#fef9c3' : '#f8faf8',
                      border: `1px solid ${oculto ? '#fde68a' : '#e8eae8'}`,
                      transition: 'background .1s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!oculto}
                      onChange={() => toggle(activeProc, estado)}
                      style={{ width: 15, height: 15, accentColor: PROC_CFG[activeProc].color, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 10, flex: 1, color: fin ? '#166534' : parseInt(code) <= 300 ? '#854d0e' : '#991b1b', fontWeight: 600 }}>
                      {estado}
                    </span>
                    {oculto && (
                      <span style={{ fontSize: 8, background: '#fde68a', color: '#78350f', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                        OCULTO
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e8eae8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8faf8' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>
            {totalOcultos === 0
              ? 'Todos los estados visibles'
              : `${totalOcultos} estado${totalOcultos !== 1 ? 's' : ''} oculto${totalOcultos !== 1 ? 's' : ''} en el reporte Nokia`
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setDraft(() => { const b = {}; REPORT_KEYS.forEach(k => { b[k] = [] }); return b })}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', color: '#4b5563', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
              Mostrar todo
            </button>
            <button onClick={onClose}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', color: '#4b5563', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={() => onSave(draft)}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#1a3a5c', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Vista de Seguimiento (estados ocultos del reporte) ────────────
function SeguimientoView({ sabana, prevSabana, estadosOcultos, forecasts, currLabel, prevLabel, empresaNombre }) {
  const procesosConOcultos = REPORT_PROCESOS.filter(p => (estadosOcultos[p.key] || []).length > 0)

  if (procesosConOcultos.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Sin estados ocultos configurados</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
        Usa "Configurar" para ocultar estados que no se revisan con Nokia
      </div>
    </div>
  )

  const hasPrev = prevSabana.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, color: '#6b7280', padding: '8px 14px', background: '#fef9c3', borderRadius: 8, border: '1px solid #fde68a' }}>
        Estos estados están en seguimiento interno pero <b>no aparecen en el Reporte Nokia ni en el Excel</b>.
      </div>
      {procesosConOcultos.map(p => {
        const cfg     = PROC_CFG[p.key]
        const ocultos = estadosOcultos[p.key] || []
        const currRows = sabana.filter(r => ocultos.includes(r[p.key]))
        const prevRows = prevSabana.filter(r => ocultos.includes(r[p.key]))

        return (
          <div key={p.key} style={{ borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.07)' }}>
            <div style={{ background: cfg.color, padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,.85)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Seguimiento · {cfg.nokia}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}>{cfg.label}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", textAlign: 'right' }}>
                {currRows.length}
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,.85)', fontWeight: 400 }}>actividades</div>
              </div>
            </div>
            <div style={{ padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
                Estados excluidos: {ocultos.map(e => (
                  <span key={e} style={{ display: 'inline-block', marginRight: 6, marginBottom: 4, padding: '1px 7px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 4, color: '#78350f', fontSize: 8, fontWeight: 700 }}>{e}</span>
                ))}
              </div>
              {hasPrev ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>Semana Anterior ({prevLabel})</div>
                    <NokiaTable rows={prevRows} procesoKey={p.key} label={`${cfg.nokia} - ${prevLabel}`} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>Semana Actual ({currLabel})</div>
                    <NokiaTable rows={currRows} procesoKey={p.key} label={`${cfg.nokia} - ${currLabel}`} color={cfg.color} />
                  </div>
                </div>
              ) : (
                <NokiaTable rows={currRows} procesoKey={p.key} label={`${cfg.nokia} - ${currLabel || 'Actual'}`} color={cfg.color} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function AckForecast() {
  const sabanaRaw         = useAckStore(s => s.sabana)
  const prevSabanaAuto    = useAckStore(s => s.prevSabana)
  const manualPrevSabana  = useAckStore(s => s.manualPrevSabana)
  const manualPrevFileName = useAckStore(s => s.manualPrevFileName)
  const forecasts         = useAckStore(s => s.forecasts)
  const uploads           = useAckStore(s => s.uploads)
  const prevUpload        = useAckStore(s => s.prevUpload)
  const currUpload        = useAckStore(s => s.currUpload || s.uploads[0])
  const proyectoSel       = useAckStore(s => s.proyectoSel)
  const estadosOcultos    = useAckStore(s => s.estadosOcultos)
  const saveEstadosOcultos = useAckStore(s => s.saveEstadosOcultos)
  const uploadExcel       = useAckStore(s => s.uploadExcel)
  const loadManualPrev    = useAckStore(s => s.loadManualPrev)
  const clearManualPrev   = useAckStore(s => s.clearManualPrev)

  const prevSabanaRaw = manualPrevSabana.length ? manualPrevSabana : prevSabanaAuto

  const [loadingPrev,  setLoadingPrev]  = useState(false)
  const [loadingCurr,  setLoadingCurr]  = useState(false)
  const [currUploaded, setCurrUploaded] = useState(false)
  const [hoverPrev,    setHoverPrev]    = useState(false)
  const [hoverCurr,    setHoverCurr]    = useState(false)
  const [dragPrev,     setDragPrev]     = useState(false)
  const [dragCurr,     setDragCurr]     = useState(false)

  async function handlePrevFile(file) {
    if (!file) return
    setLoadingPrev(true)
    await loadManualPrev(file)
    setLoadingPrev(false)
  }

  async function handleCurrFile(file) {
    if (!file) return
    setLoadingCurr(true)
    await uploadExcel(file)
    setLoadingCurr(false)
    setCurrUploaded(true)
  }

  const sabana     = useMemo(() =>
    proyectoSel.length ? sabanaRaw.filter(r => proyectoSel.includes(r.proyecto_alcance)) : sabanaRaw
  , [sabanaRaw, proyectoSel])

  const prevSabana = useMemo(() =>
    proyectoSel.length ? prevSabanaRaw.filter(r => proyectoSel.includes(r.proyecto_alcance)) : prevSabanaRaw
  , [prevSabanaRaw, proyectoSel])
  const empresaNombre = useAppStore(s => s.empresaConfig?.nombre_corto || s.empresaConfig?.nombre || '')
  const canUpload = useAuthStore(s => !['viewer', 'rollout'].includes(s.user?.role))
  const isAdmin   = useAuthStore(s => s.user?.role === 'admin')

  const location = useLocation()
  const [activeView, setActiveView] = useState(() => location.pathname.endsWith('/tablas') ? 'forecast' : 'reporte')
  const [setupOpen,  setSetupOpen]  = useState(false)

  const totalOcultos = useMemo(
    () => Object.values(estadosOcultos).reduce((s, arr) => s + arr.length, 0),
    [estadosOcultos]
  )

  async function handleSaveSetup(draft) {
    await saveEstadosOcultos(draft)
    setSetupOpen(false)
  }

  const currLabel  = currUpload ? nokiaWeekLabel(currUpload.loaded_at) : 'Actual'
  const prevLabel  = manualPrevSabana.length
    ? (parseLabelFromFilename(manualPrevFileName) || 'Anterior')
    : (prevUpload ? (parseLabelFromFilename(prevUpload.file_name) || nokiaWeekLabel(prevUpload.loaded_at)) : '')
  const currFileLabel = parseLabelFromFilename(currUpload?.file_name) || currLabel

  // CSS de impresión global
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'nokia-print-css'
    style.textContent = `
      @page { size: A4 landscape; margin: 8mm 10mm; }
      @media print {
        #root                { display: none !important; }
        #nokia-print-root    { display: block !important; font-family: Arial, sans-serif; }
        .nokia-slide         { page-break-before: always; }
        .nokia-slide:first-child { page-break-before: auto; }
      }
      @media screen {
        #nokia-print-root { display: none; }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('nokia-print-css')?.remove()
  }, [])

  const hasPrev     = prevSabana.length > 0

  // Estado de expansión por proceso — solo el primero abierto por defecto
  const [expanded, setExpanded] = useState(() => new Set([REPORT_PROCESOS[0]?.key]))
  function toggleExpanded(key) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Exportar a Excel con formato Nokia completo
  const [exporting, setExporting] = useState(false)
  async function handleExcelExport() {
    setExporting(true)
    try {
      await exportAckToExcel({
        reportProcesos: REPORT_PROCESOS,
        procCfg:        PROC_CFG,
        sabana,
        prevSabana,
        forecasts,
        filtro: 'pendientes',
        estadosOcultos,
        currLabel: currFileLabel,
        prevLabel,
        hasPrev,
        empresaNombre,
      })
    } finally {
      setExporting(false)
    }
  }

  if (!sabana.length) return (
    <EmptyState icon="📡" title="Sin datos ACK" subtitle="Carga el reporte Nokia desde el Dashboard para comenzar." />
  )

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
      {/* ── Barra de tabs (fija — vive fuera del contenedor con scroll) ── */}
      <div className="ack-tabbar" style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        borderBottom: '2px solid #e0e4e0', marginBottom: 14,
        flexWrap: 'wrap', rowGap: 8, position: 'relative',
      }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { key: 'forecast', label: '📋 Forecast' },
            { key: 'reporte',  label: '📄 Reporte Nokia' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveView(t.key)}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, marginBottom: -2,
                borderBottom: activeView === t.key ? '2px solid #7c3aed' : '2px solid transparent',
                color: activeView === t.key ? '#7c3aed' : '#6b7280',
                transition: 'all .15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button onClick={() => setActiveView('glosario')}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, marginBottom: -2, marginLeft: 'auto',
              borderBottom: activeView === 'glosario' ? '2px solid #7c3aed' : '2px solid transparent',
              color: activeView === 'glosario' ? '#7c3aed' : '#9ca3af',
              transition: 'all .15s',
            }}
          >
            ⚙ Glosario
          </button>
        )}

        {canUpload && (
          <div className="ack-tabbar-uploads" style={{
            display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8,
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {/* Botón Semana Anterior */}
            <label
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => { setHoverPrev(false); setDragPrev(false) }}
              onDragOver={e => { e.preventDefault(); setDragPrev(true) }}
              onDragEnter={e => { e.preventDefault(); setDragPrev(true) }}
              onDragLeave={() => setDragPrev(false)}
              onDrop={e => { e.preventDefault(); setDragPrev(false); const f = e.dataTransfer.files[0]; if (f && window.confirm(`¿Cargar "${f.name}" como Semana Anterior?`)) handlePrevFile(f) }}
              style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer',
                border: dragPrev ? '1px dashed #3b82f6' : '1px solid #e0e4e0',
                borderRadius:20, padding:'6px 14px', transition:'all .15s',
                background: dragPrev ? '#eff6ff' : manualPrevSabana.length ? (hoverPrev ? '#bfdbfe' : '#dbeafe') : (hoverPrev ? '#dbeafe' : '#f9fafb'),
                color: manualPrevSabana.length || hoverPrev ? '#1e40af' : '#6b7280',
                fontSize:11, fontWeight:700, whiteSpace:'nowrap', userSelect:'none' }}>
              <input type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                onChange={e=>{ handlePrevFile(e.target.files?.[0]); e.target.value='' }} />
              <span>{loadingPrev ? '⏳' : '📂'}</span>
              <span>{loadingPrev ? 'Cargando...' : 'Cargar ACK Anterior'}</span>
              {manualPrevSabana.length > 0 && !loadingPrev && (
                <span onClick={e=>{ e.preventDefault(); clearManualPrev() }}
                  style={{ marginLeft:2, opacity:.6, fontWeight:900, cursor:'pointer' }}>✕</span>
              )}
            </label>

            <span style={{ fontSize:11, color:'#9ca3af' }}>——▶</span>

            {/* Botón Semana Actual */}
            <label
              onMouseEnter={() => setHoverCurr(true)}
              onMouseLeave={() => { setHoverCurr(false); setDragCurr(false) }}
              onDragOver={e => { e.preventDefault(); setDragCurr(true) }}
              onDragEnter={e => { e.preventDefault(); setDragCurr(true) }}
              onDragLeave={() => setDragCurr(false)}
              onDrop={e => { e.preventDefault(); setDragCurr(false); const f = e.dataTransfer.files[0]; if (f && window.confirm(`¿Cargar "${f.name}" como Semana Actual?`)) handleCurrFile(f) }}
              style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer',
                border: dragCurr ? '1px dashed #16a34a' : '1px solid #e0e4e0',
                borderRadius:20, padding:'6px 14px', transition:'all .15s',
                background: dragCurr ? '#dcfce7' : currUploaded ? (hoverCurr ? '#dcfce7' : '#f0fdf4') : (hoverCurr ? '#dcfce7' : '#f9fafb'),
                color: currUploaded || hoverCurr ? '#166534' : '#6b7280',
                fontSize:11, fontWeight:700, whiteSpace:'nowrap', userSelect:'none' }}>
              <input type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                onChange={e=>{ handleCurrFile(e.target.files?.[0]); e.target.value='' }} />
              <span>{loadingCurr ? '⏳' : '📂'}</span>
              <span>{loadingCurr ? 'Cargando...' : 'Cargar ACK Actual'}</span>
            </label>
          </div>
        )}

      </div>

      {/* ── Encabezado del tab activo (fuera del scroll para que el scrollbar no tape los botones) ── */}
      {activeView !== 'glosario' && <div className="dash-hdr mb14">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
              {activeView === 'reporte' ? 'ACK — Reporte Nokia' : activeView === 'forecast' ? 'ACK — Forecast' : activeView === 'glosario' ? 'ACK — Glosario' : 'ACK — Estados Excluidos'}
            </h1>
            {proyectoSel.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af', whiteSpace: 'nowrap' }}>
                🔖 {proyectoSel.length === 1 ? proyectoSel[0] : `${proyectoSel.length} proyectos`}
              </span>
            )}
          </div>
        </div>
        {activeView === 'reporte' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveView(activeView === 'seguimiento' ? 'reporte' : 'seguimiento')}
              style={{
                padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                background: activeView === 'seguimiento' ? '#7c3aed' : '#f3f4f6',
                color:      activeView === 'seguimiento' ? '#fff'    : '#1a3a5c',
              }}
              title="Ver los estados excluidos del reporte y forecast ACK"
            >
              <SquaresExclude size={13} color={activeView === 'seguimiento' ? '#fff' : '#dc2626'} /> Estados Excluidos
              {totalOcultos > 0 && (
                <span style={{
                  background: '#f59e0b',
                  color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 8, fontWeight: 800,
                }}>
                  {totalOcultos}
                </span>
              )}
            </button>

            {canUpload && (
              <button onClick={() => setSetupOpen(true)}
                style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: '#f3f4f6', color: '#1a3a5c', display: 'flex', alignItems: 'center', gap: 6 }}
                title="Configurar estados visibles en el reporte y forecast ACK"
              >
                ⚙ Configurar
              </button>
            )}

            <button onClick={handleExcelExport} disabled={exporting}
              style={{ padding: '5px 12px', border: 'none', borderRadius: 8, cursor: exporting ? 'default' : 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, background: exporting ? '#4b5563' : '#1a6b3c', color: '#fff', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {exporting ? '⏳ Generando…' : '⬇ Exportar Excel'}
            </button>
          </div>
        )}
      </div>}

      {/* ── KPI resumen (solo en reporte) ── */}
      {activeView === 'reporte' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {REPORT_PROCESOS.map(p => {
            const cfg     = PROC_CFG[p.key]
            const visible = applyFiltroRows(sabana, p.key, 'todos', estadosOcultos)
            const pend    = visible.filter(r => !isFinal(r[p.key])).length
            const tot     = visible.length
            const pct     = tot ? Math.round(((tot - pend) / tot) * 100) : 0
            return (
              <div key={p.key} className="stat" style={{ borderLeftColor: cfg.color, padding: '10px 14px', cursor: 'pointer' }} onClick={() => toggleExpanded(p.key)}>
                <div style={{ fontSize: 8, fontWeight: 600, color: cfg.color, letterSpacing: .5, marginBottom: 4 }}>{cfg.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444' }}>{pct}%</div>
                <div style={{ fontSize: 9, color: '#4b5563' }}>{pend} pend. · {tot - pend} cerr.</div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Contenido con scroll interno propio ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 16 }}>
      {/* ── Secciones por proceso o Forecast ── */}
      {activeView === 'reporte' && (
        REPORT_PROCESOS.map(p => (
          <ScreenProcess
            key={p.key}
            proceso={p}
            currRows={sabana}
            prevRows={prevSabana}
            currLabel={currFileLabel}
            prevLabel={prevLabel}
            forecasts={forecasts}
            filtro="pendientes"
            estadosOcultos={estadosOcultos}
            empresaNombre={empresaNombre}
            expanded={expanded.has(p.key)}
            onToggle={() => toggleExpanded(p.key)}
          />
        ))
      )}

      {activeView === 'forecast' && <AckTablas embedded />}

      {activeView === 'seguimiento' && (
        <SeguimientoView
          sabana={sabana}
          prevSabana={prevSabana}
          estadosOcultos={estadosOcultos}
          forecasts={forecasts}
          currLabel={currFileLabel}
          prevLabel={prevLabel}
          empresaNombre={empresaNombre}
        />
      )}

      {activeView === 'glosario' && <AdminAckGlosario />}

      </div>
      </div>{/* ── cierra flex column ── */}

      {/* ── Modal de configuración ── */}
      {setupOpen && (
        <SetupModal
          sabana={sabana}
          estadosOcultos={estadosOcultos}
          onSave={handleSaveSetup}
          onClose={() => setSetupOpen(false)}
        />
      )}

      {/* ── Contenido de impresión vía portal (sibling de #root) ── */}
      {createPortal(
        <div id="nokia-print-root">
          {REPORT_PROCESOS.map(p => {
            const ocultos = estadosOcultos[p.key] || []
            const filteredCurr = ocultos.length ? sabana.filter(r => !ocultos.includes(r[p.key])) : sabana
            const filteredPrev = ocultos.length ? prevSabana.filter(r => !ocultos.includes(r[p.key])) : prevSabana
            return (
              <PrintSlide
                key={p.key}
                proceso={p}
                currRows={filteredCurr}
                prevRows={filteredPrev}
                currLabel={currFileLabel}
                prevLabel={prevLabel}
                forecasts={forecasts}
                uploads={uploads}
                empresaNombre={empresaNombre}
              />
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
