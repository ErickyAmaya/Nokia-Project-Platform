import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAckStore, PROCESOS, nokiaWeekLabel } from '../../store/useAckStore'
import { useAppStore } from '../../store/useAppStore'
import { exportAckToExcel } from '../../lib/ackExcelExport'

// ── Helpers ───────────────────────────────────────────────────────
function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function rangeLabel(prev, curr) {
  if (prev && curr && prev !== curr) return `${prev}-${curr}`
  return curr || prev || ''
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

const FILTRO_OPTS  = [
  { value: 'todos',      label: 'Ver Todos' },
  { value: 'pendientes', label: 'Solo Pendientes' },
  { value: 'cerrados',   label: 'Solo Cerrados' },
]
const FILTRO_BADGE = {
  pendientes: { bg: '#fee2e2', color: '#991b1b', text: '● Pendientes' },
  cerrados:   { bg: '#dcfce7', color: '#166534', text: '✓ Cerrados' },
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
          <td style={{ padding: forPrint ? '4px 7px' : '5px 10px', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>
            Total general
          </td>
          <td style={{ padding: forPrint ? '4px 5px' : '5px 8px', textAlign: 'center', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>
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
  const totBg = { background: '#003366', color: '#fff', border: '1px solid #003366', fontWeight: 800 }

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
          <th style={{ ...thCenterStyle('#003366', forPrint, { width: 'auto' }), background: '#003366', border: '1px solid #003366' }}>
            No de Actividades
          </th>
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
              <td style={{ ...totBg, padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center' }}>{gapTotal}</td>
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
  const cellTot = { fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }

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
function applyFiltroRows(rows, procesoKey, filtro) {
  if (filtro === 'pendientes') return rows.filter(r => !isFinal(r[procesoKey]))
  if (filtro === 'cerrados')   return rows.filter(r =>  isFinal(r[procesoKey]))
  return rows
}

// ── Sección de proceso (pantalla) ─────────────────────────────────
function ScreenProcess({ proceso, currRows, prevRows, currLabel, prevLabel, forecasts, filtro, empresaNombre, expanded, onToggle }) {
  const cfg     = PROC_CFG[proceso.key]
  const hasPrev = prevRows.length > 0

  const curr = applyFiltroRows(currRows, proceso.key, filtro)
  const prev = applyFiltroRows(prevRows, proceso.key, filtro)

  const total  = currRows.length
  const pend   = currRows.filter(r => !isFinal(r[proceso.key])).length
  const pct    = total ? Math.round(((total - pend) / total) * 100) : 0
  const barClr = pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'

  const prevGapLabel = `${cfg.nokia} - ${prevLabel || 'Semana Anterior'}`
  const currGapLabel = `${cfg.nokia} - ${currLabel || 'Semana Actual'}`
  const soloLabel    = `${cfg.nokia} - ${currLabel || 'Semana Actual'}`

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
              <div style={{ textAlign: 'center', color: cfg.color, fontWeight: 600, fontSize: 11, marginBottom: 10 }}>
                {prevLabel} &nbsp;——▶&nbsp; {currLabel}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>
                    Semana Anterior <span style={{ fontWeight: 400, color: '#4b5563' }}>({prevLabel})</span>
                  </div>
                  <NokiaTable rows={prev} procesoKey={proceso.key} label={prevGapLabel} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>
                    Semana Actual <span style={{ fontWeight: 400, color: '#4b5563' }}>({currLabel})</span>
                  </div>
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
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>
                    Semana Anterior <span style={{ fontWeight: 400, color: '#4b5563' }}>({prevLabel})</span>
                  </div>
                  <NokiaFcTable rows={prevRows} procesoKey={proceso.key} forecasts={forecasts} ticketKey={cfg.ticket} label={`${cfg.nokia} - FORECAST ${prevLabel}`} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>
                    Semana Actual <span style={{ fontWeight: 400, color: '#4b5563' }}>({currLabel})</span>
                  </div>
                  <NokiaFcTable rows={currRows} procesoKey={proceso.key} forecasts={forecasts} ticketKey={cfg.ticket} label={`${cfg.nokia} - FORECAST ${currLabel}`} color={cfg.color} />
                </div>
              </div>
            ) : (
              <NokiaFcTable rows={currRows} procesoKey={proceso.key} forecasts={forecasts} ticketKey={cfg.ticket} label={`${cfg.nokia} - FORECAST ${currLabel || 'Actual'}`} color={cfg.color} />
            )}
          </div>

          {/* Tablas Tickets */}
          <div style={{ marginTop: 16 }}>
            {hasPrev ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>
                    Semana Anterior <span style={{ fontWeight: 400, color: '#4b5563' }}>({prevLabel})</span>
                  </div>
                  <NokiaTicketTable rows={prevRows} procesoKey={proceso.key} ticketKey={cfg.ticket} label={`${cfg.nokia} - TICKET ${prevLabel}`} color={cfg.color} empresaNombre={empresaNombre} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>
                    Semana Actual <span style={{ fontWeight: 400, color: '#4b5563' }}>({currLabel})</span>
                  </div>
                  <NokiaTicketTable rows={currRows} procesoKey={proceso.key} ticketKey={cfg.ticket} label={`${cfg.nokia} - TICKET ${currLabel}`} color={cfg.color} empresaNombre={empresaNombre} />
                </div>
              </div>
            ) : (
              <NokiaTicketTable rows={currRows} procesoKey={proceso.key} ticketKey={cfg.ticket} label={`${cfg.nokia} - TICKET ${currLabel || 'Actual'}`} color={cfg.color} empresaNombre={empresaNombre} />
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

  const prevGapLabel = `${cfg.nokia} - ${prevLabel || 'Semana Anterior'}`
  const currGapLabel = `${cfg.nokia} - ${currLabel || 'Semana Actual'}`
  const soloLabel    = `${cfg.nokia} - ${currLabel || 'Semana Actual'}`
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

// ── Página principal ──────────────────────────────────────────────
export default function AckForecast() {
  const sabanaRaw     = useAckStore(s => s.sabana)
  const prevSabanaRaw = useAckStore(s => s.prevSabana)
  const forecasts     = useAckStore(s => s.forecasts)
  const uploads       = useAckStore(s => s.uploads)
  const prevUpload    = useAckStore(s => s.prevUpload)
  const currUpload    = useAckStore(s => s.currUpload || s.uploads[0])
  const proyectoSel   = useAckStore(s => s.proyectoSel)

  const sabana     = useMemo(() =>
    proyectoSel.length ? sabanaRaw.filter(r => proyectoSel.includes(r.proyecto_alcance)) : sabanaRaw
  , [sabanaRaw, proyectoSel])

  const prevSabana = useMemo(() =>
    proyectoSel.length ? prevSabanaRaw.filter(r => proyectoSel.includes(r.proyecto_alcance)) : prevSabanaRaw
  , [prevSabanaRaw, proyectoSel])
  const empresaNombre = useAppStore(s => s.empresaConfig?.nombre_corto || s.empresaConfig?.nombre || '')

  const [filtro, setFiltro] = useState('pendientes')

  // Etiquetas Nokia calculadas desde el par (curr, prev) seleccionado por el store
  const currLabel = currUpload ? nokiaWeekLabel(currUpload.loaded_at) : 'Actual'
  const prevLabel = prevUpload ? nokiaWeekLabel(prevUpload.loaded_at) : ''

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

  const filtroBadge = FILTRO_BADGE[filtro]
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
        filtro,
        currLabel,
        prevLabel,
        hasPrev,
        empresaNombre,
      })
    } finally {
      setExporting(false)
    }
  }

  if (!sabana.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4b5563' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14 }}>Sin datos. Carga el reporte ACK desde el Dashboard.</div>
    </div>
  )

  return (
    <>
      {/* ── Controles ── */}
      <div className="dash-hdr mb14">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
              ACK — Reportes
            </h1>
            {filtroBadge && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: filtroBadge.bg, color: filtroBadge.color }}>
                {filtroBadge.text}
              </span>
            )}
            {proyectoSel.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af', whiteSpace: 'nowrap' }}>
                🔖 {proyectoSel.length === 1 ? proyectoSel[0] : `${proyectoSel.length} proyectos`}
              </span>
            )}
          </div>
          {hasPrev
            ? (
              <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginTop: 4 }}>
                Comparando: <b style={{ fontWeight: 700 }}>{prevLabel}</b> ——▶ <b style={{ fontWeight: 700 }}>{currLabel}</b>
                <span style={{ marginLeft: 8, fontSize: 10, color: '#4b5563' }}>
                  (auto · {new Date(prevUpload.loaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })})
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4 }}>
                Sin periodo anterior. Carga un segundo reporte con ≥10 días de diferencia para activar la comparación.
              </div>
            )
          }
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: 11, fontWeight: 600 }}>
            {FILTRO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={handleExcelExport}
            disabled={exporting}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 8, cursor: exporting ? 'default' : 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, background: exporting ? '#4b5563' : '#1a6b3c', color: '#fff', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {exporting ? '⏳ Generando…' : '⬇ Exportar Excel'}
          </button>
        </div>
      </div>

      {/* ── KPI resumen ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {REPORT_PROCESOS.map(p => {
          const cfg  = PROC_CFG[p.key]
          const pend = sabana.filter(r => !isFinal(r[p.key])).length
          const tot  = sabana.length
          const pct  = tot ? Math.round(((tot - pend) / tot) * 100) : 0
          return (
            <div key={p.key} className="stat" style={{ borderLeftColor: cfg.color, padding: '10px 14px', cursor: 'pointer' }} onClick={() => toggleExpanded(p.key)}>
              <div style={{ fontSize: 8, fontWeight: 600, color: cfg.color, letterSpacing: .5, marginBottom: 4 }}>{cfg.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444' }}>{pct}%</div>
              <div style={{ fontSize: 9, color: '#4b5563' }}>{pend} pend. · {tot - pend} cerr.</div>
            </div>
          )
        })}
      </div>

      {/* ── Secciones por proceso (en orden definido) ── */}
      {REPORT_PROCESOS.map(p => (
        <ScreenProcess
          key={p.key}
          proceso={p}
          currRows={sabana}
          prevRows={prevSabana}
          currLabel={currLabel}
          prevLabel={prevLabel}
          forecasts={forecasts}
          filtro={filtro}
          empresaNombre={empresaNombre}
          expanded={expanded.has(p.key)}
          onToggle={() => toggleExpanded(p.key)}
        />
      ))}

      {/* ── Contenido de impresión vía portal (sibling de #root) ── */}
      {createPortal(
        <div id="nokia-print-root">
          {REPORT_PROCESOS.map(p => (
            <PrintSlide
              key={p.key}
              proceso={p}
              currRows={sabana}
              prevRows={prevSabana}
              currLabel={currLabel}
              prevLabel={prevLabel}
              forecasts={forecasts}
              uploads={uploads}
              empresaNombre={empresaNombre}
            />
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
