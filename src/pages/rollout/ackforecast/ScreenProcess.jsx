import { PROC_CFG, isFinal, applyFiltroRows } from './helpers'
import NokiaTable from './NokiaTable'
import NokiaFcTable from './NokiaFcTable'
import NokiaTicketTable from './NokiaTicketTable'

export default function ScreenProcess({ proceso, currRows, prevRows, currLabel, prevLabel, forecasts, filtro, estadosOcultos, empresaNombre, expanded, onToggle }) {
  const cfg     = PROC_CFG[proceso.key]
  const hasPrev = prevRows.length > 0

  const curr = applyFiltroRows(currRows, proceso.key, filtro, estadosOcultos)
  const prev = applyFiltroRows(prevRows, proceso.key, filtro, estadosOcultos)

  const total  = currRows.length
  const pend   = currRows.filter(r => !isFinal(r[proceso.key])).length
  const pct    = total ? Math.round(((total - pend) / total) * 100) : 0
  const barClr = pct >= 97 ? '#22c55e' : pct >= 80 ? '#f59e0b' : '#ef4444'

  const prevGapLabel = `${cfg.nokia} - ${prevLabel || 'Semana Anterior'}`
  const currGapLabel = `${cfg.nokia} - ${currLabel || 'Semana Actual'}`
  const soloLabel    = `${cfg.nokia} - ${currLabel || 'Semana Actual'}`

  return (
    <div style={{ marginBottom: 14, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.07)' }}>
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

      {expanded && (
        <div style={{ padding: 16, background: '#fff' }}>
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
