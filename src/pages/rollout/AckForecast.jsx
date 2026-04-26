import { useMemo, useState, useEffect } from 'react'
import { useAckStore, PROCESOS } from '../../store/useAckStore'

// ── Helpers ───────────────────────────────────────────────────────
function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function fmtWeek(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  return mon.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function fmtDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
}

// Config exacta por proceso (labels y keys que usa Nokia)
const PROC_CFG = {
  gap_on_air:     { label: 'ON AIR',           nokia: 'GAP OnAir',          col: 'Numero Actividades', color: '#0ea5e9', fa: 'fc_avance_on_air',     ticket: 'ticket_on_air_owner'    },
  gap_log_inv:    { label: 'LOGÍSTICA INVERSA', nokia: 'GAP LI',             col: 'No de Actividades',  color: '#f59e0b', fa: 'fc_avance_on_air',     ticket: 'ticket_log_inv_owner'   },
  gap_site_owner: { label: 'SITE OWNER',        nokia: 'GAP SITE OWNER',     col: 'No de Actividades',  color: '#8b5cf6', fa: 'fc_avance_site_owner', ticket: 'ticket_so_owner'        },
  gap_doc:        { label: 'DOCUMENTACIÓN',     nokia: 'GAP DOC',            col: 'No de Actividades',  color: '#10b981', fa: 'fc_avance_doc',        ticket: 'ticket_doc_owner'       },
  gap_hw_cierre:  { label: 'CIERRE HW',         nokia: 'GAP CIERRE DE HW',   col: 'No de Actividades',  color: '#ef4444', fa: 'fc_avance_hw_cierre',  ticket: 'ticket_hw_cierre_owner' },
}

const FILTRO_OPTS = [
  { value: 'todos',      label: 'Ver Todos' },
  { value: 'pendientes', label: 'Solo Pendientes' },
  { value: 'cerrados',   label: 'Solo Cerrados' },
]
const FILTRO_BADGE = {
  pendientes: { bg: '#fee2e2', color: '#991b1b', text: '● Pendientes' },
  cerrados:   { bg: '#dcfce7', color: '#166534', text: '✓ Cerrados' },
}

// ── Construir datos de reporte Nokia ─────────────────────────────
function buildNokiaData(sabana, forecasts, procesoKey) {
  const cfg = PROC_CFG[procesoKey]
  const pending = sabana.filter(r => !isFinal(r[procesoKey]))

  // Tabla 1: GAP status → sites → count
  const gapMap = new Map()
  for (const r of pending) {
    const gap = r[procesoKey] || '(Sin estado)'
    if (!gapMap.has(gap)) gapMap.set(gap, new Map())
    const site = r.site_name || r.smp || '(Sin sitio)'
    gapMap.get(gap).set(site, (gapMap.get(gap).get(site) || 0) + 1)
  }
  const gapEntries = [...gapMap.entries()].sort(([a], [b]) => a.localeCompare(b))

  // Tabla 2: GAP × Semana FC
  const weekMap = new Map()
  const weekSet = new Set()
  for (const r of pending) {
    const gap = r[procesoKey] || '(Sin estado)'
    const fc  = forecasts[r.smp]
    if (fc?.[cfg.fa]) {
      const wk = fmtWeek(fc[cfg.fa])
      weekSet.add(wk)
      if (!weekMap.has(gap)) weekMap.set(gap, new Map())
      weekMap.get(gap).set(wk, (weekMap.get(gap).get(wk) || 0) + 1)
    }
  }
  const weeks = [...weekSet].sort()

  // Tabla 3: GAP × Owner
  const ownerMap = new Map()
  const ownerSet = new Set()
  for (const r of pending) {
    const gap   = r[procesoKey] || '(Sin estado)'
    const owner = r[cfg.ticket] || '(Sin owner)'
    ownerSet.add(owner)
    if (!ownerMap.has(gap)) ownerMap.set(gap, new Map())
    ownerMap.get(gap).set(owner, (ownerMap.get(gap).get(owner) || 0) + 1)
  }
  const owners = [...ownerSet].sort()

  return { gapEntries, weekMap, weeks, ownerMap, owners, total: pending.length }
}

// ── Estilos de tabla (Nokia print) ───────────────────────────────
const PS = { // print styles
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 9 },
  thTitle:   { background: '#1a3a5c', color: '#fff', padding: '5px 8px', textAlign: 'left', fontWeight: 700, fontSize: 9, border: '1px solid #ccc', whiteSpace: 'nowrap' },
  thNum:     { background: '#1a3a5c', color: '#fff', padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: 9, border: '1px solid #ccc', width: 60 },
  tdStatus:  { padding: '4px 8px', fontWeight: 700, fontSize: 9, background: '#dce6f1', border: '1px solid #ccc', whiteSpace: 'nowrap' },
  tdSite:    { padding: '3px 8px 3px 22px', fontWeight: 400, fontSize: 8.5, background: '#fff', border: '1px solid #e8e8e8', color: '#333' },
  tdCount:   { padding: '4px 6px', textAlign: 'center', fontWeight: 700, fontSize: 9, background: '#dce6f1', border: '1px solid #ccc' },
  tdSiteNum: { padding: '3px 6px', textAlign: 'center', fontSize: 8.5, background: '#fff', border: '1px solid #e8e8e8' },
  tdTotal:   { padding: '5px 8px', fontWeight: 800, fontSize: 9, background: '#c5d9f1', border: '1px solid #aaa' },
  tdTotNum:  { padding: '5px 6px', textAlign: 'center', fontWeight: 800, fontSize: 9, background: '#c5d9f1', border: '1px solid #aaa' },
}

// ── Sección Nokia por proceso (vista impresión) ───────────────────
function NokiaSection({ proceso, data, uploads }) {
  const cfg = PROC_CFG[proceso.key]
  const { gapEntries, weekMap, weeks, ownerMap, owners, total } = data
  const lastUpload = uploads[0]

  return (
    <div className="nokia-section">
      {/* ── Header de página ── */}
      <table style={{ width: '100%', marginBottom: 8, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 900, fontSize: 13, color: '#1a3a5c', fontFamily: 'Arial, sans-serif', width: '33%' }}>
              INGETEL S.A.S.
            </td>
            <td style={{
              textAlign: 'center', fontSize: 14, fontWeight: 900, color: '#fff',
              background: cfg.color, padding: '6px 12px', borderRadius: 4,
              letterSpacing: 1, fontFamily: 'Arial, sans-serif',
            }}>
              {cfg.nokia}
            </td>
            <td style={{ textAlign: 'right', fontSize: 9, color: '#555', width: '33%', fontFamily: 'Arial, sans-serif' }}>
              {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
              {lastUpload && (
                <><br /><span style={{ fontSize: 8, color: '#888' }}>Reporte: {lastUpload.file_name}</span></>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ height: 3, background: cfg.color, marginBottom: 12, borderRadius: 1 }} />

      {/* ── Layout dos columnas: Tabla1 | Tabla2 ── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>

        {/* ── Tabla 1: GAP status → Sites (formato Nokia exacto) ── */}
        <div style={{ flex: gapEntries.length > 0 ? '0 0 45%' : '1' }}>
          <table style={PS.table}>
            <thead>
              <tr>
                <th style={PS.thTitle}>{cfg.nokia}</th>
                <th style={PS.thNum}>{cfg.col}</th>
              </tr>
            </thead>
            <tbody>
              {gapEntries.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: 12, textAlign: 'center', color: '#22c55e', fontWeight: 700, fontSize: 11 }}>
                    ✓ Sin pendientes
                  </td>
                </tr>
              ) : gapEntries.map(([gap, sites]) => {
                const gapTotal = [...sites.values()].reduce((s, v) => s + v, 0)
                return [
                  <tr key={`gap-${gap}`}>
                    <td style={PS.tdStatus}>{gap}</td>
                    <td style={PS.tdCount}>{gapTotal}</td>
                  </tr>,
                  ...[...sites.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([site, cnt]) => (
                    <tr key={`site-${gap}-${site}`}>
                      <td style={PS.tdSite}>{site}</td>
                      <td style={PS.tdSiteNum}>{cnt}</td>
                    </tr>
                  )),
                ]
              })}
              {gapEntries.length > 0 && (
                <tr>
                  <td style={PS.tdTotal}>Total general</td>
                  <td style={PS.tdTotNum}>{total}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Tabla 2: GAP × Semana FC (si hay datos FC) ── */}
        {weeks.length > 0 && (
          <div style={{ flex: 1 }}>
            <table style={PS.table}>
              <thead>
                <tr>
                  <th style={PS.thTitle}>{cfg.nokia}</th>
                  {weeks.map(w => <th key={w} style={PS.thNum}>{w}</th>)}
                  <th style={PS.thNum}>Total</th>
                </tr>
              </thead>
              <tbody>
                {gapEntries.map(([gap]) => {
                  const wm = weekMap.get(gap) || new Map()
                  const rowTotal = [...wm.values()].reduce((s, v) => s + v, 0)
                  if (rowTotal === 0) return null
                  return (
                    <tr key={`wk-${gap}`}>
                      <td style={PS.tdStatus}>{gap}</td>
                      {weeks.map(w => (
                        <td key={w} style={PS.tdCount}>{wm.get(w) || ''}</td>
                      ))}
                      <td style={PS.tdCount}>{rowTotal}</td>
                    </tr>
                  )
                })}
                {/* Fila de totales */}
                <tr>
                  <td style={PS.tdTotal}>Total general</td>
                  {weeks.map(w => {
                    const col = gapEntries.reduce((s, [gap]) => s + (weekMap.get(gap)?.get(w) || 0), 0)
                    return <td key={w} style={PS.tdTotNum}>{col || ''}</td>
                  })}
                  <td style={PS.tdTotNum}>{total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabla 3: GAP × Owner ── */}
      {owners.length > 0 && (
        <table style={PS.table}>
          <thead>
            <tr>
              <th style={PS.thTitle}>{cfg.nokia}</th>
              {owners.map(o => <th key={o} style={PS.thNum}>{o}</th>)}
              <th style={PS.thNum}>Total</th>
            </tr>
          </thead>
          <tbody>
            {gapEntries.map(([gap]) => {
              const om = ownerMap.get(gap) || new Map()
              const rowTotal = [...om.values()].reduce((s, v) => s + v, 0)
              if (rowTotal === 0) return null
              return (
                <tr key={`ow-${gap}`}>
                  <td style={PS.tdStatus}>{gap}</td>
                  {owners.map(o => <td key={o} style={PS.tdCount}>{om.get(o) || ''}</td>)}
                  <td style={PS.tdCount}>{rowTotal}</td>
                </tr>
              )
            })}
            <tr>
              <td style={PS.tdTotal}>Total general</td>
              {owners.map(o => {
                const col = gapEntries.reduce((s, [gap]) => s + (ownerMap.get(gap)?.get(o) || 0), 0)
                return <td key={o} style={PS.tdTotNum}>{col || ''}</td>
              })}
              <td style={PS.tdTotNum}>{total}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Vista pantalla por proceso ────────────────────────────────────
function ScreenSection({ proceso, sabana, forecasts, filtro }) {
  const cfg = PROC_CFG[proceso.key]

  const rows = useMemo(() => {
    return sabana
      .filter(r => {
        if (filtro === 'pendientes') return !isFinal(r[proceso.key])
        if (filtro === 'cerrados')   return  isFinal(r[proceso.key])
        return true
      })
      .sort((a, b) => {
        const aFin = isFinal(a[proceso.key]), bFin = isFinal(b[proceso.key])
        if (aFin !== bFin) return aFin ? 1 : -1
        return (b.semanas_integracion || 0) - (a.semanas_integracion || 0)
      })
  }, [sabana, proceso.key, filtro])

  const total  = sabana.length
  const pend   = sabana.filter(r => !isFinal(r[proceso.key])).length
  const closed = total - pend
  const pct    = total ? Math.round(((total - pend) / total) * 100) : 0
  const barClr = pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Header */}
      <div style={{ background: cfg.color, borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px' }}>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
              {cfg.nokia}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
              {cfg.label}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 46, fontWeight: 900, color: '#fff', lineHeight: 1, fontFamily: "'Barlow Condensed', sans-serif" }}>{pct}%</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)' }}>completado</div>
          </div>
        </div>
        <div style={{ height: 4, background: 'rgba(0,0,0,.2)' }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,.6)', width: `${pct}%` }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        background: '#f8f9f8', padding: '8px 22px',
        borderLeft: `4px solid ${cfg.color}`, borderRight: '1px solid #e5e7eb',
        display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11 }}><b style={{ fontSize: 14, color: '#ef4444' }}>{pend}</b><span style={{ color: '#9ca89c', marginLeft: 4 }}>pendientes</span></span>
        <span style={{ fontSize: 11 }}><b style={{ fontSize: 14, color: '#22c55e' }}>{closed}</b><span style={{ color: '#9ca89c', marginLeft: 4 }}>cerrados</span></span>
        <span style={{ fontSize: 11 }}><b style={{ fontSize: 14, color: '#374151' }}>{total}</b><span style={{ color: '#9ca89c', marginLeft: 4 }}>total SMPs</span></span>
        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, minWidth: 60 }}>
          <div style={{ height: 6, borderRadius: 3, background: barClr, width: `${pct}%` }} />
        </div>
      </div>

      {/* Tabla */}
      <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#9ca89c', fontSize: 12 }}>
            Sin resultados para el filtro seleccionado
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f8f9f8' }}>
                  {['Sitio','Main SMP','SMP','Sub Proyecto','Sem.','Estado GAP','FC Avance','FC Comentario','Owner'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const fc  = forecasts[r.smp] || {}
                  const fin = isFinal(r[proceso.key])
                  const sem = r.semanas_integracion || 0
                  return (
                    <tr key={r.smp} style={{ background: fin ? '#f0fdf4' : i % 2 === 0 ? '#fff' : '#fafafa', opacity: fin ? 0.75 : 1 }}>
                      <td style={{ padding: '5px 10px', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }}>{r.site_name || '—'}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 8, color: '#888', whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }}>{r.main_smp}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 8, color: '#555', whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }}>{r.smp}</td>
                      <td style={{ padding: '5px 10px', fontSize: 9, color: '#666', borderBottom: '1px solid #f0f0f0' }}>{r.sub_proyecto || '—'}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700, color: sem > 104 ? '#ef4444' : '#374151', borderBottom: '1px solid #f0f0f0' }}>{sem || '—'}</td>
                      <td style={{ padding: '5px 10px', borderBottom: '1px solid #f0f0f0' }}>
                        {r[proceso.key] ? (
                          <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: fin ? '#dcfce7' : '#fee2e2', color: fin ? '#166534' : '#991b1b', whiteSpace: 'nowrap' }}>
                            {fin ? '✓' : '●'} {r[proceso.key].split('.').slice(1).join('.').trim() || r[proceso.key]}
                          </span>
                        ) : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ padding: '5px 10px', color: '#1e40af', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }}>
                        {fmtDate(fc[cfg.fa]) || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '5px 10px', fontSize: 9, color: '#374151', maxWidth: 180, borderBottom: '1px solid #f0f0f0' }}>
                        {fc['fc_cierre_' + (cfg.fa.replace('fc_avance_', ''))] || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                        {r[cfg.ticket] ? (
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: r[cfg.ticket] === 'Nokia' ? '#eff6ff' : '#fffbeb', color: r[cfg.ticket] === 'Nokia' ? '#1e40af' : '#92400e' }}>
                            {r[cfg.ticket]}
                          </span>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function AckForecast() {
  const sabana    = useAckStore(s => s.sabana)
  const forecasts = useAckStore(s => s.forecasts)
  const uploads   = useAckStore(s => s.uploads)

  const [filtro, setFiltro] = useState('pendientes')

  // Pre-calcular datos Nokia para todos los procesos
  const nokiaData = useMemo(() =>
    Object.fromEntries(PROCESOS.map(p => [p.key, buildNokiaData(sabana, forecasts, p.key)]))
  , [sabana, forecasts])

  // Inyectar CSS de impresión
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'ack-forecast-css'
    style.textContent = `
      @page { size: A4 landscape; margin: 8mm 10mm; }
      @media screen {
        #nokia-print-root { position: absolute; left: -9999px; top: 0; width: 1px; height: 1px; overflow: hidden; }
      }
      @media print {
        body * { display: none !important; }
        #nokia-print-root,
        #nokia-print-root * { display: revert !important; }
        #nokia-print-root {
          position: fixed !important; top: 0 !important; left: 0 !important;
          width: 100% !important; font-family: Arial, sans-serif; background: #fff;
        }
        .nokia-section { page-break-before: always; }
        .nokia-section:first-child { page-break-before: auto; }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('ack-forecast-css')?.remove()
  }, [])

  const filtroBadge = FILTRO_BADGE[filtro]

  if (!sabana.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 14, marginBottom: 6 }}>Sin datos cargados.</div>
        <div style={{ fontSize: 12 }}>Carga el reporte ACK desde el Dashboard.</div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Controles (pantalla únicamente) ── */}
      <div className="screen-section dash-hdr mb14">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
              ACK — Reportes
            </h1>
            {filtroBadge && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: filtroBadge.bg, color: filtroBadge.color, whiteSpace: 'nowrap' }}>
                {filtroBadge.text}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9ca89c', marginTop: 3 }}>
            {uploads[0] ? <>Reporte: <b>{uploads[0].file_name}</b></> : 'Vista de reportes y presentación Nokia'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: 11, fontWeight: 700 }}>
            {FILTRO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            style={{
              padding: '9px 22px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800,
              background: '#1a3a5c', color: '#fff', letterSpacing: .8,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,.2)',
            }}
          >
            🖨 Preparar Presentación
          </button>
        </div>
      </div>

      {/* ── KPI resumen pantalla ── */}
      <div className="screen-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
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

      {/* ── Vista pantalla: secciones interactivas ── */}
      <div className="screen-section">
        {PROCESOS.map(p => (
          <ScreenSection key={p.key} proceso={p} sabana={sabana} forecasts={forecasts} filtro={filtro} />
        ))}
      </div>

      {/* ── Vista impresión: tablas formato Nokia (ocultas en pantalla) ── */}
      <div id="nokia-print-root">
        {PROCESOS.map(p => (
          <NokiaSection key={p.key} proceso={p} data={nokiaData[p.key]} uploads={uploads} />
        ))}
      </div>
    </div>
  )
}
