import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'

export default function LiquidadorIndexPage() {
  const sitios   = useAppStore(s => s.sitios)
  const user     = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [selected, setSelected] = useState('')

  const userRole = user?.role ?? ''

  const filtered = useMemo(() => {
    if (userRole === 'TSS') return sitios.filter(s => s.tipo === 'TSS')
    if (userRole === 'CW')  return sitios.filter(s => s.tipo === 'TI' && s.tiene_cw)
    if (userRole === 'TI')  return sitios.filter(s => s.tipo === 'TI')
    return sitios
  }, [sitios, userRole])

  const sorted = [...filtered].sort((a, b) => (a.nombre || a.id).localeCompare(b.nombre || b.id))

  function handleChange(e) {
    const id = e.target.value
    setSelected(id)
    if (id) navigate(`/liquidador/${id}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 20 }}>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, margin: 0, color: '#144E4A' }}>
        Liquidador: <span style={{ color: '#22c55e' }}>Selecciona un sitio</span>
      </h1>
      <select
        autoFocus
        value={selected}
        onChange={handleChange}
        style={{
          width: '100%', maxWidth: 400,
          padding: '10px 14px', fontSize: 13,
          border: '2px solid #144E4A', borderRadius: 8,
          fontFamily: "'Barlow', sans-serif", color: '#144E4A',
          background: '#fff', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        }}
      >
        <option value="">— Seleccionar sitio —</option>
        {sorted.map(s => (
          <option key={s.id} value={s.id}>
            {s.nombre || s.id} ({s.tipo})
          </option>
        ))}
      </select>
    </div>
  )
}
