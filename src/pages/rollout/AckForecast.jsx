import { useMemo, useState, useEffect } from 'react'
import { useAckStore, PROCESOS } from '../../store/useAckStore'

function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function gapLabel(val) {
  if (!val) return '—'
  const label = val.split('.').slice(1).join('.').trim() || val
  return label.length > 40 ? label.slice(0, 40) + '…' : label
}

function fmtDate(val) {
  if (!val) return null
  return new Date(val + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: '2-digit',
  })
}

const PROC_CFG = {
  gap_on_air:     { label: 'ON AIR',           color: '#0ea5e9', fa: 'fc_avance_on_air',     fc: 'fc_cierre_on_air',     ticket: 'ticket_on_air_owner' },
  gap_log_inv:    { label: 'LOGÍSTICA INVERSA', color: '#f59e0b', fa: 'fc_avance_on_air',     fc: 'fc_cierre_on_air',     ticket: 'ticket_log_inv_owner' },
  gap_site_owner: { label: 'SITE OWNER',        color: '#8b5cf6', fa: 'fc_avance_site_owner', fc: 'fc_cierre_site_owner', ticket: 'ticket_so_owner' },
  gap_doc:        { label: 'DOCUMENTACIÓN',     color: '#10b981', fa: 'fc_avance_doc',        fc: 'fc_cierre_doc',        ticket: 'ticket_doc_owner' },
  gap_hw_cierre:  { label: 'CIERRE HW',         color: '#ef4444', fa: 'fc_avance_hw_cierre',  fc: 'fc_cierre_hw_cierre',  ticket: 'ticket_hw_cierre_owner' },
}

const TH = {
  padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700,
  color: '#374151', textTransform: 'uppercase', letterSpacing: .5,
  borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', background: '#f8f9f8',
}
const TD = {
  padding: '6px 10px', borderBottom: '1px solid #f0f2f0', verticalAlign: 'middle', fontSize: 10,
}

// ── Sección de proceso (una "diapositiva") ────────────────────────
function ProcesoSection({ proceso, sabana, forecasts, soloPend, idx, total: totalProc }) {
  const cfg = PROC_CFG[proceso.key]

  const allRows = useMemo(() => sabana, [sabana])

  const rows = useMemo(() => {
    return sabana
      .filter(r => soloPend ? !isFinal(r[proceso.key]) : true)
      .sort((a, b) => {
        const aFin = isFinal(a[proceso.key])
        const bFin = isFinal(b[proceso.key])
        if (aFin !== bFin) return aFin ? 1 : -1
        return (b.semanas_integracion || 0) - (a.semanas_integracion || 0)
      })
  }, [sabana, proceso.key, soloPend])

  const total  = allRows.length
  const pend   = allRows.filter(r => !isFinal(r[proceso.key])).length
  const closed = total - pend
  const pct    = total ? Math.round((closed / total) * 100) : 0
  const color  = pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'

  return (
    <div className="forecast-section" style={{ marginBottom: 40, pageBreakAfter: 'always' }}>

      {/* ── Slide Header ── */}
      <div style={{
        background: cfg.color, borderRadius: '10px 10px 0 0',
        padding: '0', overflow: 'hidden',
      }}>
        {/* Print-only company row */}
        <div className="print-only" style={{
          display: 'none',
          padding: '8px 20px 0',
          fontSize: 9, color: 'rgba(255,255,255,.7)', letterSpacing: 1,
          textTransform: 'uppercase', fontWeight: 700,
        }}>
          INGETEL S.A.S · Reporte ACK Nokia · {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
          &nbsp;&nbsp;|&nbsp;&nbsp;Proceso {idx + 1} de {totalProc}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px',
        }}>
          <div>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,.7)', letterSpacing: 2,
              textTransform: 'uppercase', fontWeight: 700, marginBottom: 4,
            }}>
              Proceso de Cierre ACK
            </div>
            <div style={{
              fontSize: 26, fontWeight: 900, color: '#fff',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1.5,
            }}>
              {cfg.label}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
              {pct}%
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>completado</div>
          </div>
        </div>

        {/* Progress bar within header */}
        <div style={{ height: 5, background: 'rgba(0,0,0,.2)' }}>
          <div style={{ height: 5, background: 'rgba(255,255,255,.6)', width: `${pct}%`, transition: 'width .5s' }} />
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        background: '#f8f9f8', padding: '9px 24px',
        borderLeft: `4px solid ${cfg.color}`, borderRight: '1px solid #e5e7eb',
        display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#ef4444' }}>{pend}</span>
          <span style={{ color: '#9ca89c', marginLeft: 5 }}>pendientes</span>
        </span>
        <span style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#22c55e' }}>{closed}</span>
          <span style={{ color: '#9ca89c', marginLeft: 5 }}>cerrados</span>
        </span>
        <span style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#374151' }}>{total}</span>
          <span style={{ color: '#9ca89c', marginLeft: 5 }}>total SMPs</span>
        </span>
        <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, minWidth: 80 }}>
          <div style={{ height: 6, borderRadius: 3, background: color, width: `${pct}%` }} />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20,
          background: color + '22', color,
        }}>
          {pct >= 97 ? '● Muy bien' : pct >= 80 ? '● En progreso' : '● Requiere atención'}
        </span>
      </div>

      {/* ── Tabla ── */}
      <div style={{
        border: '1px solid #e5e7eb', borderTop: 'none',
        borderRadius: '0 0 10px 10px', overflow: 'hidden',
      }}>
        {rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#22c55e', fontSize: 13, fontWeight: 700 }}>
            ✓ Todos los SMPs cerrados en {cfg.label}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={TH}>Sitio</th>
                  <th style={TH}>Main SMP</th>
                  <th style={TH}>SMP</th>
                  <th style={TH}>Sub Proyecto</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Sem.</th>
                  <th style={TH}>Estado GAP</th>
                  <th style={{ ...TH, color: '#3b82f6' }}>FC Avance</th>
                  <th style={{ ...TH, color: '#3b82f6' }}>FC Comentario</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const fc  = forecasts[r.smp] || {}
                  const fin = isFinal(r[proceso.key])
                  const sem = r.semanas_integracion || 0
                  return (
                    <tr key={r.smp} style={{
                      background: fin ? '#f0fdf4' : i % 2 === 0 ? '#fff' : '#fafafa',
                      opacity: fin ? 0.7 : 1,
                    }}>
                      <td style={{ ...TD, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.site_name || '—'}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 8, color: '#888', whiteSpace: 'nowrap' }}>{r.main_smp}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 8, color: '#555', whiteSpace: 'nowrap' }}>{r.smp}</td>
                      <td style={{ ...TD, fontSize: 9, color: '#666' }}>{r.sub_proyecto || '—'}</td>
                      <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: sem > 104 ? '#ef4444' : '#374151' }}>
                        {sem || '—'}
                      </td>
                      <td style={TD}>
                        {r[proceso.key] ? (
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: fin ? '#dcfce7' : '#fee2e2',
                            color: fin ? '#166534' : '#991b1b',
                            whiteSpace: 'nowrap', display: 'inline-block',
                          }}>
                            {fin ? '✓' : '●'} {gapLabel(r[proceso.key])}
                          </span>
                        ) : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ ...TD, color: '#1e40af', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fmtDate(fc[cfg.fa]) || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ ...TD, color: '#374151', maxWidth: 200 }}>
                        {fc[cfg.fc] || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ ...TD, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {r[cfg.ticket] ? (
                          <span style={{
                            fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                            background: r[cfg.ticket] === 'Nokia' ? '#eff6ff' : '#fffbeb',
                            color: r[cfg.ticket] === 'Nokia' ? '#1e40af' : '#92400e',
                          }}>
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

  const [soloPend, setSoloPend] = useState(true)

  // Inyectar CSS de impresión al montar la página
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'ack-forecast-print-css'
    style.textContent = `
      @page { size: A4 landscape; margin: 10mm 12mm; }
      @media print {
        body { visibility: hidden !important; }
        #ack-forecast-print-root,
        #ack-forecast-print-root * { visibility: visible !important; }
        #ack-forecast-print-root {
          position: absolute; top: 0; left: 0; width: 100%;
        }
        .forecast-no-print { display: none !important; }
        .print-only        { display: block !important; }
        .forecast-section  { page-break-after: always; margin-bottom: 0 !important; }
        .forecast-section:last-child { page-break-after: auto; }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('ack-forecast-print-css')?.remove()
  }, [])

  if (!sabana.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 14, marginBottom: 6 }}>Sin datos cargados.</div>
        <div style={{ fontSize: 12 }}>Sube el reporte ACK desde el Dashboard para continuar.</div>
      </div>
    )
  }

  const lastUpload = uploads[0]
  const totalPend  = sabana.filter(r => PROCESOS.some(p => !isFinal(r[p.key]))).length

  return (
    <div>
      {/* ── Controles (ocultos en impresión) ── */}
      <div className="forecast-no-print dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            ACK — Forecast / Presentación
          </h1>
          <div style={{ fontSize: 11, color: '#9ca89c', marginTop: 3 }}>
            {lastUpload
              ? <>Datos: <b>{lastUpload.file_name}</b> · {new Date(lastUpload.loaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</>
              : 'Vista lista para capturar pantalla o exportar PDF'
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setSoloPend(p => !p)}
            style={{
              padding: '6px 16px', border: '1px solid #e0e4e0', borderRadius: 20, cursor: 'pointer',
              fontFamily: "'Barlow', sans-serif", fontSize: 10, fontWeight: 700,
              background: soloPend ? '#fee2e2' : '#dcfce7',
              color: soloPend ? '#991b1b' : '#166534',
            }}
          >
            {soloPend ? '◎ Ver Todos' : '● Solo Pendientes'}
          </button>
          <button
            onClick={() => window.print()}
            style={{
              padding: '9px 22px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800,
              background: '#1e3a5f', color: '#fff', letterSpacing: .8,
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,.18)',
            }}
          >
            🖨 Preparar Presentación
          </button>
        </div>
      </div>

      {/* ── Resumen ejecutivo (oculto en impresión, visible en pantalla) ── */}
      <div className="forecast-no-print" style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20,
      }}>
        {PROCESOS.map(p => {
          const cfg = PROC_CFG[p.key]
          const pend = sabana.filter(r => !isFinal(r[p.key])).length
          const tot  = sabana.length
          const pct  = tot ? Math.round(((tot - pend) / tot) * 100) : 0
          return (
            <div key={p.key} className="stat" style={{ borderLeftColor: cfg.color, padding: '10px 14px' }}>
              <div style={{ fontSize: 8, fontWeight: 800, color: cfg.color, letterSpacing: 1, marginBottom: 4 }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif",
                color: pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444' }}>
                {pct}%
              </div>
              <div style={{ fontSize: 9, color: '#9ca89c' }}>
                {pend} pend. · {tot - pend} cerr.
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Secciones / Diapositivas ── */}
      <div id="ack-forecast-print-root">
        {PROCESOS.map((p, i) => (
          <ProcesoSection
            key={p.key}
            proceso={p}
            sabana={sabana}
            forecasts={forecasts}
            soloPend={soloPend}
            idx={i}
            total={PROCESOS.length}
          />
        ))}
      </div>
    </div>
  )
}
