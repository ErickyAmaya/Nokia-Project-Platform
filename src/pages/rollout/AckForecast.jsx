import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import { useAckStore, PROCESOS } from '../../store/useAckStore'
import { showToast } from '../../components/Toast'

// ── Helpers ───────────────────────────────────────────────────────
function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function pick(row, aliases) {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== null && row[a] !== '') return row[a]
  }
  return null
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function rangeLabel(prev, curr) {
  if (prev && curr && prev !== curr) return `${prev}-${curr}`
  return curr || prev || ''
}

// Columnas para parsear el Excel de semana anterior
const PREV_COL = {
  smp:            ['smp', 'SMP'],
  site_name:      ['siteName', 'site_name'],
  gap_on_air:     ['GAP_OnAir', 'gap_on_air'],
  gap_log_inv:    ['GAP_LOG_INV', 'gap_log_inv'],
  gap_site_owner: ['GAP_SiteOwner', 'gap_site_owner'],
  gap_doc:        ['GAP_DOC', 'gap_doc'],
  gap_hw_cierre:  ['GAP_HW_Cierre', 'gap_hw_cierre'],
}

async function parseExcelFile(file) {
  const buf = await file.arrayBuffer()
  const wb  = XLSX.read(buf, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames.find(n =>
    n.toLowerCase().includes('sabana') || n.toLowerCase().includes('sábana')
  )
  if (!sheetName) throw new Error('No se encontró la hoja Sabana en el archivo')
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true })
  return rows
    .map(r => ({
      smp:            pick(r, PREV_COL.smp),
      site_name:      pick(r, PREV_COL.site_name),
      gap_on_air:     pick(r, PREV_COL.gap_on_air),
      gap_log_inv:    pick(r, PREV_COL.gap_log_inv),
      gap_site_owner: pick(r, PREV_COL.gap_site_owner),
      gap_doc:        pick(r, PREV_COL.gap_doc),
      gap_hw_cierre:  pick(r, PREV_COL.gap_hw_cierre),
    }))
    .filter(r => r.smp)
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

// GAP → ticket_owner → count (solo filas con ticket registrado)
function buildTicketTree(rows, procesoKey, ticketKey) {
  const map = new Map()
  for (const r of rows) {
    const ticket = r[ticketKey]
    if (!ticket) continue
    const gap = r[procesoKey] || '(Sin estado)'
    if (!map.has(gap)) map.set(gap, new Map())
    map.get(gap).set(ticket, (map.get(gap).get(ticket) || 0) + 1)
  }
  return map
}

// FC: gap → {dates: Map<date,count>, sites: Map<site, Map<date,count>>}
function buildFcData(rows, procesoKey, forecasts, faKey) {
  const gapMap  = new Map()
  const dateSet = new Set()
  const pending = rows.filter(r => !isFinal(r[procesoKey]))

  for (const r of pending) {
    const gap  = r[procesoKey] || '(Sin estado)'
    const site = r.site_name   || '(Sin sitio)'
    const fc   = forecasts[r.smp]
    if (!fc?.[faKey]) continue
    const d = fmtDate(fc[faKey])
    if (!d) continue
    dateSet.add(d)
    if (!gapMap.has(gap)) gapMap.set(gap, { dates: new Map(), sites: new Map() })
    const g = gapMap.get(gap)
    g.dates.set(d, (g.dates.get(d) || 0) + 1)
    if (!g.sites.has(site)) g.sites.set(site, new Map())
    g.sites.get(site).set(d, (g.sites.get(site).get(d) || 0) + 1)
  }

  const gapEntries = [...gapMap.entries()]
    .filter(([, g]) => g.dates.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))
  return { gapEntries, dates: [...dateSet].sort() }
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
          ? <tr><td colSpan={2} style={{ padding: 12, textAlign: 'center', color: '#9ca89c' }}>Sin datos</td></tr>
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

// ── Tabla Nokia FC (GAP × Fecha) ──────────────────────────────────
function NokiaFcTable({ rows, procesoKey, forecasts, label, color = '#7030A0', forPrint = false }) {
  const { gapEntries, dates } = useMemo(
    () => buildFcData(rows, procesoKey, forecasts, PROC_CFG[procesoKey].fa),
    [rows, procesoKey, forecasts]
  )

  if (!dates.length) return (
    <div style={{ padding: forPrint ? '4px 8px' : 16, textAlign: 'center', color: '#9ca89c', fontSize: forPrint ? 8 : 11, fontFamily: 'Arial, sans-serif' }}>
      Sin fechas FC registradas.
    </div>
  )

  const FS = forPrint ? 8 : 10

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          {dates.map(d => (
            <th key={d} style={thCenterStyle(color, forPrint, { width: 'auto' })}>{d}</th>
          ))}
          <th style={{ ...thCenterStyle('#003366', forPrint, { width: 'auto' }), background: '#003366', border: '1px solid #003366' }}>
            No de Actividades
          </th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.map(([gap, g]) => {
          const gapTotal = [...g.dates.values()].reduce((s, v) => s + v, 0)
          return [
            <tr key={gap}>
              <td style={{ padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: '#C00000' }}>{gap}</td>
              {dates.map(d => <td key={d} style={{ padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center', background: '#DCE6F1', border: '1px solid #c0c0c0', fontWeight: 700 }}>{g.dates.get(d) || ''}</td>)}
              <td style={{ padding: forPrint ? '3px 5px' : '4px 7px', textAlign: 'center', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>{gapTotal}</td>
            </tr>,
            ...[...g.sites.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([site, siteDates]) => {
              const siteTotal = [...siteDates.values()].reduce((s, v) => s + v, 0)
              if (!siteTotal) return null
              return (
                <tr key={`${gap}|${site}`}>
                  <td style={{ padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>{site}</td>
                  {dates.map(d => <td key={d} style={{ padding: forPrint ? '2px 5px' : '3px 7px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>{siteDates.get(d) || ''}</td>)}
                  <td style={{ padding: forPrint ? '2px 5px' : '3px 7px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>{siteTotal}</td>
                </tr>
              )
            }),
          ]
        })}
        <tr>
          <td style={{ padding: forPrint ? '4px 7px' : '5px 10px', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>Total general</td>
          {dates.map(d => {
            const col = gapEntries.reduce((s, [, g]) => s + (g.dates.get(d) || 0), 0)
            return <td key={d} style={{ padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>{col || ''}</td>
          })}
          <td style={{ padding: forPrint ? '4px 5px' : '5px 7px', textAlign: 'center', fontWeight: 800, background: '#003366', color: '#fff', border: '1px solid #003366' }}>
            {gapEntries.reduce((s, [, g]) => s + [...g.dates.values()].reduce((a, b) => a + b, 0), 0)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ── Tabla Nokia Tickets (GAP → ticket_owner → count) ─────────────
function NokiaTicketTable({ rows, procesoKey, ticketKey, label, color = '#7030A0', forPrint = false }) {
  const gapTree    = useMemo(() => buildTicketTree(rows, procesoKey, ticketKey), [rows, procesoKey, ticketKey])
  const gapEntries = [...gapTree.entries()].sort(([a], [b]) => a.localeCompare(b))
  const total      = gapEntries.reduce((s, [, tickets]) => s + [...tickets.values()].reduce((a, b) => a + b, 0), 0)
  const FS         = forPrint ? 8 : 10

  if (!total) return (
    <div style={{ padding: forPrint ? '4px 8px' : 16, textAlign: 'center', color: '#9ca89c', fontSize: forPrint ? 8 : 11, fontFamily: 'Arial, sans-serif' }}>
      Sin tickets registrados para este proceso.
    </div>
  )

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS, fontFamily: 'Arial, sans-serif' }}>
      <thead>
        <tr>
          <th style={thStyle(color, forPrint)}>{label}</th>
          <th style={thCenterStyle(color, forPrint)}>No de Actividades</th>
        </tr>
      </thead>
      <tbody>
        {gapEntries.map(([gap, tickets]) => {
          const fin      = isFinal(gap)
          const gapTotal = [...tickets.values()].reduce((s, v) => s + v, 0)
          return [
            <tr key={gap}>
              <td style={{ padding: forPrint ? '3px 7px' : '4px 10px', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: fin ? '#166534' : '#C00000' }}>
                {gap}
              </td>
              <td style={{ padding: forPrint ? '3px 5px' : '4px 8px', textAlign: 'center', fontWeight: 700, background: '#DCE6F1', border: '1px solid #c0c0c0', color: fin ? '#166534' : '#C00000' }}>
                {gapTotal}
              </td>
            </tr>,
            ...[...tickets.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([ticket, cnt]) => (
              <tr key={`${gap}|${ticket}`}>
                <td style={{ padding: forPrint ? '2px 7px 2px 18px' : '3px 10px 3px 22px', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                  {ticket}
                </td>
                <td style={{ padding: forPrint ? '2px 5px' : '3px 8px', textAlign: 'center', background: '#fff', border: '1px solid #e8e8e8', fontSize: forPrint ? 7.5 : 9 }}>
                  {cnt}
                </td>
              </tr>
            )),
          ]
        })}
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

// ── Sección de proceso (pantalla) ─────────────────────────────────
function ScreenProcess({ proceso, currRows, prevRows, currLabel, prevLabel, forecasts, filtro }) {
  const cfg     = PROC_CFG[proceso.key]
  const rl      = rangeLabel(prevLabel, currLabel)
  const hasPrev = prevRows.length > 0

  function applyFiltro(rows) {
    if (filtro === 'pendientes') return rows.filter(r => !isFinal(r[proceso.key]))
    if (filtro === 'cerrados')   return rows.filter(r =>  isFinal(r[proceso.key]))
    return rows
  }

  const curr  = applyFiltro(currRows)
  const prev  = applyFiltro(prevRows)

  const total  = currRows.length
  const pend   = currRows.filter(r => !isFinal(r[proceso.key])).length
  const pct    = total ? Math.round(((total - pend) / total) * 100) : 0
  const barClr = pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'

  const [showFc,     setShowFc]     = useState(false)
  const [showTicket, setShowTicket] = useState(false)

  const gapLabel    = `${cfg.nokia} - ${rl}`
  const fcLabel     = `${cfg.nokia} - FORECAST ${rl}`
  const ticketLabel = `${cfg.nokia} - TICKET ${rl}`

  return (
    <div style={{ marginBottom: 28, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.07)' }}>
      {/* Header con color del proceso */}
      <div style={{ background: cfg.color, padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,.75)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>{cfg.nokia}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>{cfg.label}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.8)' }}>completado</div>
        </div>
      </div>
      <div style={{ height: 4, background: 'rgba(0,0,0,.15)' }}>
        <div style={{ height: 4, background: barClr, width: `${pct}%` }} />
      </div>

      {/* Stats bar */}
      <div style={{ background: '#f8f9f8', borderLeft: `4px solid ${cfg.color}`, borderRight: '1px solid #e5e7eb', padding: '7px 18px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11 }}><b style={{ color: '#C00000' }}>{pend}</b><span style={{ color: '#9ca89c', marginLeft: 4 }}>pendientes</span></span>
        <span style={{ fontSize: 11 }}><b style={{ color: '#166534' }}>{total - pend}</b><span style={{ color: '#9ca89c', marginLeft: 4 }}>cerrados</span></span>
        <span style={{ fontSize: 11 }}><b>{total}</b><span style={{ color: '#9ca89c', marginLeft: 4 }}>total</span></span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <span onClick={() => setShowFc(s => !s)}
            style={{ fontSize: 10, fontWeight: 700, cursor: 'pointer', color: cfg.color, userSelect: 'none' }}>
            {showFc ? '▴ Ocultar FC' : '▾ FC Avance'}
          </span>
          <span onClick={() => setShowTicket(s => !s)}
            style={{ fontSize: 10, fontWeight: 700, cursor: 'pointer', color: cfg.color, userSelect: 'none' }}>
            {showTicket ? '▴ Ocultar Tickets' : '▾ Tickets'}
          </span>
        </div>
      </div>

      {/* Tablas de comparación GAP */}
      <div style={{ padding: 16, background: '#fff' }}>
        {hasPrev ? (
          <>
            <div style={{ textAlign: 'center', color: cfg.color, fontWeight: 800, fontSize: 12, marginBottom: 10 }}>
              {prevLabel} &nbsp;——▶&nbsp; {currLabel}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: cfg.color, marginBottom: 4, letterSpacing: 1 }}>{prevLabel}</div>
                <NokiaTable rows={prev} procesoKey={proceso.key} label={gapLabel} color={cfg.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: cfg.color, marginBottom: 4, letterSpacing: 1 }}>{currLabel}</div>
                <NokiaTable rows={curr} procesoKey={proceso.key} label={gapLabel} color={cfg.color} />
              </div>
            </div>
          </>
        ) : (
          <NokiaTable rows={curr} procesoKey={proceso.key} label={gapLabel} color={cfg.color} />
        )}

        {/* Tabla FC */}
        {showFc && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: cfg.color, marginBottom: 6, letterSpacing: 1 }}>{fcLabel}</div>
            <NokiaFcTable rows={currRows} procesoKey={proceso.key} forecasts={forecasts} label={fcLabel} color={cfg.color} />
          </div>
        )}

        {/* Tabla Tickets */}
        {showTicket && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: cfg.color, marginBottom: 6, letterSpacing: 1 }}>{ticketLabel}</div>
            <NokiaTicketTable rows={currRows} procesoKey={proceso.key} ticketKey={cfg.ticket} label={ticketLabel} color={cfg.color} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Diapositiva Nokia (impresión) ─────────────────────────────────
function PrintSlide({ proceso, currRows, prevRows, currLabel, prevLabel, forecasts, uploads }) {
  const cfg      = PROC_CFG[proceso.key]
  const hasPrev  = prevRows.length > 0
  const lastFile = uploads[0]
  const rl       = rangeLabel(prevLabel, currLabel)

  const gapLabel    = `${cfg.nokia} - ${rl}`
  const fcLabel     = `${cfg.nokia} - FORECAST ${rl}`
  const ticketLabel = `${cfg.nokia} - TICKET ${rl}`

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
            <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>{prevLabel}</div>
            <NokiaTable rows={prevRows} procesoKey={proceso.key} label={gapLabel} color={cfg.color} forPrint />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasPrev && <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>{currLabel}</div>}
          <NokiaTable rows={currRows} procesoKey={proceso.key} label={gapLabel} color={cfg.color} forPrint />
        </div>
      </div>

      {/* Fila inferior: FC y Tickets lado a lado */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>{fcLabel}</div>
          <NokiaFcTable rows={currRows} procesoKey={proceso.key} forecasts={forecasts} label={fcLabel} color={cfg.color} forPrint />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, marginBottom: 3 }}>{ticketLabel}</div>
          <NokiaTicketTable rows={currRows} procesoKey={proceso.key} ticketKey={cfg.ticket} label={ticketLabel} color={cfg.color} forPrint />
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function AckForecast() {
  const sabana    = useAckStore(s => s.sabana)
  const forecasts = useAckStore(s => s.forecasts)
  const uploads   = useAckStore(s => s.uploads)

  const [prevSabana,  setPrevSabana]  = useState([])
  const [prevLabel,   setPrevLabel]   = useState('')
  const [currLabel,   setCurrLabel]   = useState('')
  const [filtro,      setFiltro]      = useState('pendientes')
  const [loadingPrev, setLoadingPrev] = useState(false)
  const prevRef = useRef()

  // Etiqueta semana actual desde el último upload
  useEffect(() => {
    if (uploads[0] && !currLabel) {
      const m = uploads[0].file_name.match(/W\d{2,3}/i)
      setCurrLabel(m ? m[0].toUpperCase() : 'Semana Actual')
    }
  }, [uploads])

  async function handlePrevFile(file) {
    setLoadingPrev(true)
    try {
      const rows = await parseExcelFile(file)
      setPrevSabana(rows)
      const m = file.name.match(/W\d{2,3}/i)
      setPrevLabel(m ? m[0].toUpperCase() : 'Semana Anterior')
      showToast(`✓ Semana anterior: ${rows.length} SMPs`, 'ok')
    } catch (e) {
      showToast(`Error: ${e.message}`, 'err')
    } finally {
      setLoadingPrev(false)
      if (prevRef.current) prevRef.current.value = ''
    }
  }

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

  if (!sabana.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c' }}>
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
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: filtroBadge.bg, color: filtroBadge.color }}>
                {filtroBadge.text}
              </span>
            )}
          </div>
          {hasPrev && (
            <div style={{ fontSize: 11, color: '#555', fontWeight: 600, marginTop: 4 }}>
              Comparando: <b>{prevLabel}</b> ——▶ <b>{currLabel}</b>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Labels editables */}
          {hasPrev && (
            <>
              <input className="fc" value={prevLabel} onChange={e => setPrevLabel(e.target.value)}
                placeholder="Ej: W42" style={{ width: 72, fontSize: 11, textAlign: 'center', fontWeight: 700 }} />
              <span style={{ color: '#555', fontWeight: 900 }}>▶</span>
              <input className="fc" value={currLabel} onChange={e => setCurrLabel(e.target.value)}
                placeholder="Ej: W44" style={{ width: 72, fontSize: 11, textAlign: 'center', fontWeight: 700 }} />
            </>
          )}
          {/* Upload semana anterior */}
          <input ref={prevRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePrevFile(f) }} />
          <button
            onClick={() => prevRef.current?.click()}
            disabled={loadingPrev}
            style={{ padding: '7px 14px', border: '1.5px solid #555f55', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: hasPrev ? '#f3f4f3' : '#fff', color: '#555f55' }}
          >
            {loadingPrev ? '⏳' : hasPrev ? `✓ ${prevLabel}` : '📂 Cargar Semana Anterior'}
          </button>
          {hasPrev && (
            <button onClick={() => { setPrevSabana([]); setPrevLabel('') }}
              style={{ padding: '7px 10px', border: '1px solid #e0e4e0', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: '#9ca89c', background: '#fff' }}>
              ✕
            </button>
          )}
          <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: 11, fontWeight: 700 }}>
            {FILTRO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            style={{ padding: '9px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, background: '#1a3a5c', color: '#fff', letterSpacing: .8, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🖨 Preparar Presentación
          </button>
        </div>
      </div>

      {/* ── KPI resumen ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
        {PROCESOS.map(p => {
          const cfg  = PROC_CFG[p.key]
          const pend = sabana.filter(r => !isFinal(r[p.key])).length
          const tot  = sabana.length
          const pct  = tot ? Math.round(((tot - pend) / tot) * 100) : 0
          return (
            <div key={p.key} className="stat" style={{ borderLeftColor: cfg.color, padding: '10px 14px' }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, letterSpacing: 1, marginBottom: 4 }}>{cfg.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444' }}>{pct}%</div>
              <div style={{ fontSize: 9, color: '#9ca89c' }}>{pend} pend. · {tot - pend} cerr.</div>
            </div>
          )
        })}
      </div>

      {/* ── Secciones interactivas por proceso ── */}
      {PROCESOS.map(p => (
        <ScreenProcess
          key={p.key}
          proceso={p}
          currRows={sabana}
          prevRows={prevSabana}
          currLabel={currLabel}
          prevLabel={prevLabel}
          forecasts={forecasts}
          filtro={filtro}
        />
      ))}

      {/* ── Contenido de impresión vía portal (sibling de #root) ── */}
      {createPortal(
        <div id="nokia-print-root">
          {PROCESOS.map(p => (
            <PrintSlide
              key={p.key}
              proceso={p}
              currRows={sabana}
              prevRows={prevSabana}
              currLabel={currLabel}
              prevLabel={prevLabel}
              forecasts={forecasts}
              uploads={uploads}
            />
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
