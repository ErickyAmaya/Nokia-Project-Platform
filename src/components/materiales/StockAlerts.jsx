import { useState, useEffect, useRef } from 'react'
import { useMatStore } from '../../store/useMatStore'
import { useNavigate } from 'react-router-dom'

function getLevel(stockActual, minimo) {
  if (stockActual === 0) return 'agotado'
  if (minimo > 0 && stockActual < minimo) return 'bajo'
  return 'ok'
}

function AlertItem({ alert, onDismiss, onNav }) {
  const timerRef = useRef(null)
  const isAgotado = alert.level === 'agotado'
  const bg     = isAgotado ? '#fde8e7' : '#fff8e1'
  const color  = isAgotado ? '#c0392b' : '#856404'
  const border = isAgotado ? '#f5c6cb' : '#ffe082'
  const label  = isAgotado ? '🔴 AGOTADO' : '🟡 BAJO MÍNIMO'

  const start = () => { timerRef.current = setTimeout(onDismiss, 6000) }
  const stop  = () => { clearTimeout(timerRef.current) }

  useEffect(() => { start(); return stop }, [])

  return (
    <div
      style={{
        background: bg, border: `1.5px solid ${border}`, borderRadius: 12,
        padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,.18)',
        cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
        pointerEvents: 'all',
      }}
      onMouseEnter={stop}
      onMouseLeave={start}
      onClick={onNav}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: .8, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {alert.nombre}
        </div>
        <div style={{ fontSize: 10, color: '#555f55', marginTop: 2 }}>
          Stock: <strong>{alert.stock}</strong>
          {!isAgotado && <> · Mínimo: <strong>{alert.minimo}</strong></>}
        </div>
        <div style={{ fontSize: 9, color: '#9ca89c', marginTop: 4, fontStyle: 'italic' }}>
          Clic para ver alertas →
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDismiss() }}
        style={{ background: 'none', border: 'none', color: '#9ca89c', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>
        ×
      </button>
    </div>
  )
}

export default function StockAlerts() {
  const stock    = useMatStore(s => s.stock)
  const catalogo = useMatStore(s => s.catalogo)
  const prevRef  = useRef(null)
  const [alerts, setAlerts] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!stock.length || !catalogo.length) return

    const curr = {}
    for (const s of stock) {
      const cat = catalogo.find(c => c.id === s.catalogo_id)
      if (!cat || cat.categoria === 'PROVEEDORES') continue
      curr[`${s.catalogo_id}-${s.bodega_id}`] = {
        level:  getLevel(s.stock_actual, cat.stock_minimo ?? 0),
        nombre: cat.nombre,
        stock:  s.stock_actual,
        minimo: cat.stock_minimo ?? 0,
      }
    }

    if (prevRef.current !== null) {
      const newAlerts = []
      for (const [key, data] of Object.entries(curr)) {
        const prev = prevRef.current[key]
        if (!prev) continue
        const pL = prev.level, cL = data.level
        const worsened = (pL === 'ok' && (cL === 'bajo' || cL === 'agotado')) ||
                         (pL === 'bajo' && cL === 'agotado')
        if (worsened) {
          newAlerts.push({ id: `${key}-${Date.now()}`, ...data })
        }
      }
      if (newAlerts.length > 0) {
        setAlerts(p => [...p, ...newAlerts])
      }
    }

    prevRef.current = curr
  }, [stock, catalogo])

  if (!alerts.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
      display: 'flex', flexDirection: 'column-reverse', gap: 8,
      maxWidth: 300, pointerEvents: 'none',
    }}>
      {alerts.map(a => (
        <AlertItem
          key={a.id}
          alert={a}
          onDismiss={() => setAlerts(p => p.filter(x => x.id !== a.id))}
          onNav={() => {
            navigate('/materiales')
            setAlerts(p => p.filter(x => x.id !== a.id))
          }}
        />
      ))}
    </div>
  )
}
