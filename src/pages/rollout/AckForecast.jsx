import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { EmptyState } from '../../components/EmptyState'
import { useAckStore, nokiaWeekLabel } from '../../store/useAckStore'
import { useEmpresaStore } from '../../store/useEmpresaStore'
import { exportAckToExcel } from '../../lib/ackExcelExport'
import {
  PROC_CFG, FILTRO_OPTS, FILTRO_BADGE, REPORT_PROCESOS,
  applyFiltroRows, isFinal,
} from './ackforecast/helpers'
import ScreenProcess   from './ackforecast/ScreenProcess'
import PrintSlide      from './ackforecast/PrintSlide'
import SetupModal      from './ackforecast/SetupModal'
import SeguimientoView from './ackforecast/SeguimientoView'

export default function AckForecast() {
  const sabanaRaw          = useAckStore(s => s.sabana)
  const prevSabanaRaw      = useAckStore(s => s.prevSabana)
  const forecasts          = useAckStore(s => s.forecasts)
  const uploads            = useAckStore(s => s.uploads)
  const prevUpload         = useAckStore(s => s.prevUpload)
  const currUpload         = useAckStore(s => s.currUpload || s.uploads[0])
  const proyectoSel        = useAckStore(s => s.proyectoSel)
  const estadosOcultos     = useAckStore(s => s.estadosOcultos)
  const saveEstadosOcultos = useAckStore(s => s.saveEstadosOcultos)

  const sabana = useMemo(() =>
    proyectoSel.length ? sabanaRaw.filter(r => proyectoSel.includes(r.proyecto_alcance)) : sabanaRaw
  , [sabanaRaw, proyectoSel])

  const prevSabana = useMemo(() =>
    proyectoSel.length ? prevSabanaRaw.filter(r => proyectoSel.includes(r.proyecto_alcance)) : prevSabanaRaw
  , [prevSabanaRaw, proyectoSel])

  const empresaNombre = useEmpresaStore(s => s.empresaConfig?.nombre_corto || s.empresaConfig?.nombre || '')

  const [filtro,     setFiltro]     = useState('pendientes')
  const [activeView, setActiveView] = useState('reporte')
  const [setupOpen,  setSetupOpen]  = useState(false)

  const totalOcultos = useMemo(
    () => Object.values(estadosOcultos).reduce((s, arr) => s + arr.length, 0),
    [estadosOcultos]
  )

  async function handleSaveSetup(draft) {
    await saveEstadosOcultos(draft)
    setSetupOpen(false)
  }

  const currLabel = currUpload ? nokiaWeekLabel(currUpload.loaded_at) : 'Actual'
  const prevLabel = prevUpload ? nokiaWeekLabel(prevUpload.loaded_at) : ''

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

  const [expanded, setExpanded] = useState(() => new Set([REPORT_PROCESOS[0]?.key]))
  function toggleExpanded(key) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
        estadosOcultos,
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
    <EmptyState icon="📡" title="Sin datos ACK" subtitle="Carga el reporte Nokia desde el Dashboard para comenzar." />
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e4e0' }}>
            {[
              { key: 'reporte',     label: 'Reporte Nokia' },
              { key: 'seguimiento', label: `Seguimiento${totalOcultos > 0 ? ` (${totalOcultos})` : ''}` },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveView(t.key)}
                style={{
                  padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: activeView === t.key ? '#1a3a5c' : '#fff',
                  color:      activeView === t.key ? '#fff'    : '#4b5563',
                  transition: 'all .15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeView === 'reporte' && (
            <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: 11, fontWeight: 600, width: 'auto' }}>
              {FILTRO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}

          {activeView === 'seguimiento' && (
            <button onClick={() => setSetupOpen(true)}
              style={{ padding: '7px 12px', border: '1px solid #e0e4e0', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: '#fff', color: '#1a3a5c', display: 'flex', alignItems: 'center', gap: 5 }}
              title="Configurar estados visibles en el reporte Nokia"
            >
              ⚙ Configurar
              {totalOcultos > 0 && (
                <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 8, fontWeight: 800 }}>
                  {totalOcultos}
                </span>
              )}
            </button>
          )}

          {activeView === 'reporte' && (
            <button onClick={handleExcelExport} disabled={exporting}
              style={{ padding: '7px 16px', border: 'none', borderRadius: 8, cursor: exporting ? 'default' : 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, background: exporting ? '#4b5563' : '#1a6b3c', color: '#fff', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {exporting ? '⏳ Generando…' : '⬇ Exportar Excel'}
            </button>
          )}
        </div>
      </div>

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

      {/* ── Secciones por proceso o Seguimiento ── */}
      {activeView === 'reporte' ? (
        REPORT_PROCESOS.map(p => (
          <ScreenProcess
            key={p.key}
            proceso={p}
            currRows={sabana}
            prevRows={prevSabana}
            currLabel={currLabel}
            prevLabel={prevLabel}
            forecasts={forecasts}
            filtro={filtro}
            estadosOcultos={estadosOcultos}
            empresaNombre={empresaNombre}
            expanded={expanded.has(p.key)}
            onToggle={() => toggleExpanded(p.key)}
          />
        ))
      ) : (
        <SeguimientoView
          sabana={sabana}
          prevSabana={prevSabana}
          estadosOcultos={estadosOcultos}
          forecasts={forecasts}
          currLabel={currLabel}
          prevLabel={prevLabel}
          empresaNombre={empresaNombre}
        />
      )}

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
            const ocultos      = estadosOcultos[p.key] || []
            const filteredCurr = ocultos.length ? sabana.filter(r => !ocultos.includes(r[p.key])) : sabana
            const filteredPrev = ocultos.length ? prevSabana.filter(r => !ocultos.includes(r[p.key])) : prevSabana
            return (
              <PrintSlide
                key={p.key}
                proceso={p}
                currRows={filteredCurr}
                prevRows={filteredPrev}
                currLabel={currLabel}
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
