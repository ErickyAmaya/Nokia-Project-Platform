import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const MODULOS = [
  {
    id:          'billing',
    nombre:      'Liquidador de Actividades',
    corto:       'Liquidador',
    descripcion: 'Gestión y liquidación de sitios Nokia — TI, TSS y Obra Civil',
    icon:        '💰',
    color:       '#144E4A',
    border:      '#1a9c1a',
    ruta:        '/dashboard',
  },
  {
    id:          'materiales',
    nombre:      'Gestión de Inventarios & Materiales',
    corto:       'Materiales',
    descripcion: 'Control de stock, movimientos y trazabilidad de materiales por sitio',
    icon:        '📦',
    color:       '#1d4ed8',
    border:      '#3b82f6',
    ruta:        '/materiales',
  },
  {
    id:          'rollout',
    nombre:      'Seguimiento de Proyecto',
    corto:       'Rollout',
    descripcion: 'Monitoreo de avance, hitos y gestión de campo del rollout Nokia',
    icon:        '📋',
    color:       '#7c3aed',
    border:      '#a78bfa',
    ruta:        null,   // próximamente
  },
]

export default function ModuloHomePage() {
  const navigate  = useNavigate()
  const user      = useAuthStore(s => s.user)
  const empresaConfig = useAuthStore(s => s.empresa)

  const color = empresaConfig?.color || '#144E4A'

  return (
    <div className="modulos-wrap" style={{
      minHeight: '80vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 18px', gap: 32,
    }}>
      {/* Saludo */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 28, fontWeight: 700, margin: '0 0 6px',
          color,
        }}>
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Usuario'}
        </h1>
        <p style={{ fontSize: 13, color: '#9ca89c', margin: 0 }}>
          Selecciona el módulo al que deseas acceder
        </p>
      </div>

      {/* Tarjetas */}
      <div className="modulos-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 20, width: '100%', maxWidth: 900,
      }}>
        {MODULOS.map(m => {
          const available = !!m.ruta
          return (
            <div
              key={m.id}
              onClick={() => available && navigate(m.ruta)}
              style={{
                background: '#fff',
                border: `2px solid ${available ? m.border : '#e0e4e0'}`,
                borderRadius: 12,
                padding: '28px 24px',
                cursor: available ? 'pointer' : 'default',
                opacity: available ? 1 : 0.55,
                transition: 'transform .15s, box-shadow .15s',
                boxShadow: '0 2px 8px rgba(0,0,0,.06)',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!available) return
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'
              }}
            >
              {/* Badge próximamente */}
              {!available && (
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  textTransform: 'uppercase', color: '#9ca89c',
                  border: '1px solid #e0e4e0', borderRadius: 4,
                  padding: '2px 6px', background: '#f8f8f8',
                }}>
                  Próximamente
                </span>
              )}

              <div className="modulo-icon" style={{ fontSize: 36, marginBottom: 14 }}>{m.icon}</div>

              <h2 style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 18, fontWeight: 700, margin: '0 0 8px',
                color: available ? m.color : '#9ca89c',
              }}>
                {m.nombre}
              </h2>

              <p style={{
                fontSize: 12, color: '#777', margin: '0 0 16px', lineHeight: 1.5,
              }}>
                {m.descripcion}
              </p>

              {available && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: m.color,
                  letterSpacing: .5,
                }}>
                  Abrir {m.corto} →
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
