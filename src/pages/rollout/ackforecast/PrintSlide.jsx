import { PROC_CFG, rangeLabel } from './helpers'
import NokiaTable from './NokiaTable'
import NokiaFcTable from './NokiaFcTable'
import NokiaTicketTable from './NokiaTicketTable'

export default function PrintSlide({ proceso, currRows, prevRows, currLabel, prevLabel, forecasts, uploads, empresaNombre }) {
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

      <div style={{ textAlign: 'center', color: cfg.color, fontWeight: 800, fontSize: 12, marginBottom: 8 }}>
        {hasPrev ? `${prevLabel}  ——▶  ${currLabel}` : currLabel}
      </div>

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
