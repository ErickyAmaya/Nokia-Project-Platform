import { REPORT_PROCESOS, PROC_CFG } from './helpers'
import NokiaTable from './NokiaTable'

export default function SeguimientoView({ sabana, prevSabana, estadosOcultos, currLabel, prevLabel }) {
  const procesosConOcultos = REPORT_PROCESOS.filter(p => (estadosOcultos[p.key] || []).length > 0)

  if (procesosConOcultos.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Sin estados ocultos configurados</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
        Usa "Configurar Reporte" para ocultar estados que no se revisan con Nokia
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
        const cfg      = PROC_CFG[p.key]
        const ocultos  = estadosOcultos[p.key] || []
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
