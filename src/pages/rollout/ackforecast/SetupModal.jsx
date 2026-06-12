import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { REPORT_KEYS, PROC_CFG, isFinal } from './helpers'

export default function SetupModal({ sabana, estadosOcultos, onSave, onClose }) {
  const [draft, setDraft]           = useState(() => {
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
        <div style={{ background: '#1a3a5c', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5 }}>Configurar Reporte Nokia</div>
            <div style={{ fontSize: 10, opacity: .8, marginTop: 2 }}>
              Desmarca los estados que no se revisan en reunión — quedan en Seguimiento
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

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
