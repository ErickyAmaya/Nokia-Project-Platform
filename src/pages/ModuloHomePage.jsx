import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppStore }  from '../store/useAppStore'
import { useMatStore }  from '../store/useMatStore'
import { useAckStore }  from '../store/useAckStore'

const MODULOS = [
  {
    id:          'billing',
    nombre:      'Liquidador de Actividades',
    corto:       'Liquidador',
    descripcion: 'Gestión y liquidación de sitios Nokia — TI, TSS y Obra Civil.',
    icon:        '💰',
    color:       '#144E4A',
    ruta:        '/dashboard',
  },
  {
    id:          'materiales',
    nombre:      'Inventarios & Materiales',
    corto:       'Materiales',
    descripcion: 'Control de stock, movimientos y trazabilidad de materiales y HW Nokia.',
    icon:        '📦',
    color:       '#1d4ed8',
    ruta:        '/materiales',
  },
  {
    id:          'rollout',
    nombre:      'Seguimiento de Proyecto',
    corto:       'Rollout',
    descripcion: 'Monitoreo de avance, ACK y gestión de campo del rollout Nokia.',
    icon:        '📋',
    color:       '#7c3aed',
    ruta:        '/rollout',
  },
]

export default function ModuloHomePage() {
  const navigate      = useNavigate()
  const user          = useAuthStore(s => s.user)
  const [hovered, setHovered] = useState(null)

  // ── Métricas Liquidador (siempre disponible tras login) ──────────
  const sitios         = useAppStore(s => s.sitios)
  const liqTotal       = sitios.length
  const liqProceso     = sitios.filter(s => s.estado !== 'final').length
  const liqFinal       = sitios.filter(s => s.estado === 'final').length

  // ── Métricas Materiales ──────────────────────────────────────────
  const matCatalogo    = useMatStore(s => s.catalogo)
  const matStock       = useMatStore(s => s.stock)
  const matDespachos   = useMatStore(s => s.despachos)
  const loadMat        = useMatStore(s => s.loadAll)
  const matLoaded      = matCatalogo.length > 0
  const matAlertas     = matCatalogo.filter(c => {
    if (!c.stock_minimo || c.stock_minimo <= 0) return false
    const total = matStock
      .filter(s => s.catalogo_id === c.id)
      .reduce((acc, s) => acc + (s.stock_actual || 0), 0)
    return total < c.stock_minimo
  }).length

  // ── Métricas Rollout ACK (respeta filtro proyectoSel) ───────────
  const ackSabana      = useAckStore(s => s.sabana)
  const ackForecasts   = useAckStore(s => s.forecasts)
  const ackUploads     = useAckStore(s => s.uploads)
  const ackProyectoSel = useAckStore(s => s.proyectoSel)
  const ackLoaded      = ackSabana.length > 0 || ackUploads.length > 0

  // Aplicar el mismo filtro de proyecto que usa AckDashboard
  const ackFiltered = ackProyectoSel.length > 0
    ? ackSabana.filter(r => ackProyectoSel.includes(r.proyecto_alcance))
    : ackSabana

  // Pre-carga silenciosa de Materiales para tener métricas listas
  useEffect(() => { loadMat() }, [loadMat])

  // ── Helper: "—" si el store todavía no tiene datos ──────────────
  const n = (loaded, val) => loaded ? val : '—'

  function getMetrics(id) {
    if (id === 'billing') return [
      { val: liqTotal,    label: 'Sitios'      },
      { val: liqProceso,  label: 'En proceso'  },
      { val: liqFinal,    label: 'Finalizados' },
    ]
    if (id === 'materiales') return [
      { val: n(matLoaded, matCatalogo.length), label: 'Materiales'   },
      { val: n(matLoaded, matAlertas),         label: 'Alertas stock' },
      { val: n(matLoaded, matDespachos.length),label: 'Despachos'    },
    ]
    if (id === 'rollout') return [
      { val: n(ackLoaded, ackFiltered.length),                                        label: 'SMPs'        },
      { val: n(ackLoaded, ackFiltered.filter(r => ackForecasts[r.smp]).length),       label: 'Con FC'      },
      { val: n(ackLoaded, ackFiltered.filter(r => r.procesos_cierre_ph2).length),     label: 'Pendientes'  },
    ]
    return []
  }

  const empresaConfig   = useAppStore(s => s.empresaConfig)
  const clienteNombre   = empresaConfig?.cliente_nombre   || ''
  const clienteLogoUrl  = empresaConfig?.cliente_logo_url || ''
  const primerNombre    = user?.nombre?.split(' ')[0] || 'Usuario'

  return (
    <div style={{
      minHeight: '80vh',
      background: `
        radial-gradient(ellipse at 15% 55%, rgba(26,156,26,.09) 0%, transparent 55%),
        radial-gradient(ellipse at 85% 15%, rgba(124,58,237,.07) 0%, transparent 50%),
        radial-gradient(ellipse at 65% 85%, rgba(29,78,216,.06) 0%, transparent 50%),
        #f7f8f7
      `,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', gap: 48,
    }}>
      <style>{`@keyframes mod-pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: '#fff', border: '1px solid #e4e4e7',
          borderRadius: 100, padding: '5px 16px',
          fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
          textTransform: 'uppercase', color: '#71717a',
          marginBottom: 18,
          boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e', display: 'inline-block',
            animation: 'mod-pulse 2s infinite',
          }} />
          {clienteLogoUrl
            ? <img src={clienteLogoUrl} alt={clienteNombre} style={{ height: 14, maxWidth: 56, objectFit: 'contain', verticalAlign: 'middle' }} />
            : clienteNombre || 'Ingetel'
          }
          <span style={{ color: '#d4d4d8' }}>·</span>
          Ingetel 2026
        </div>

        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 52, fontWeight: 800, lineHeight: 1,
          color: '#09090b', margin: '0 0 10px',
        }}>
          Bienvenido, {primerNombre}
        </h1>
        <p style={{ fontSize: 15, color: '#71717a', margin: 0, fontWeight: 400 }}>
          Selecciona el módulo al que deseas acceder
        </p>
      </div>

      {/* ── Tarjetas ────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20, width: '100%', maxWidth: 980,
      }}>
        {MODULOS.map(m => {
          const isH     = hovered === m.id
          const metrics = getMetrics(m.id)

          return (
            <div
              key={m.id}
              onClick={() => navigate(m.ruta)}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'relative', overflow: 'hidden',
                background: '#fff',
                border: `1.5px solid ${isH ? m.color : '#e8eae8'}`,
                borderRadius: 20, cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                boxShadow: isH
                  ? `0 0 0 4px ${m.color}1a, 0 16px 40px rgba(0,0,0,.1)`
                  : '0 2px 12px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.04)',
                transform: isH ? 'translateY(-6px)' : 'none',
                transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), border-color .2s, box-shadow .2s',
              }}
            >
              {/* Línea de color en el top al hover */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
                background: `linear-gradient(90deg, transparent, ${m.color}, transparent)`,
                borderRadius: '20px 20px 0 0',
                opacity: isH ? 1 : 0,
                transition: 'opacity .25s',
                pointerEvents: 'none',
              }} />

              {/* Blob de color en esquina superior derecha */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 160, height: 160, borderRadius: '50%',
                background: `radial-gradient(circle, ${m.color} 0%, transparent 70%)`,
                opacity: isH ? 0.14 : 0.07,
                transform: isH ? 'scale(1.15)' : 'scale(1)',
                transition: 'opacity .3s, transform .3s',
                pointerEvents: 'none',
              }} />

              {/* Body: ícono + título + descripción */}
              <div style={{ padding: '32px 28px 20px', flex: 1 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: `${m.color}18`,
                  border: `1.5px solid ${m.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, marginBottom: 20,
                  transform: isH ? 'scale(1.08) rotate(-4deg)' : 'none',
                  boxShadow: isH ? `0 4px 16px ${m.color}40` : 'none',
                  transition: 'transform .2s, box-shadow .2s',
                }}>
                  {m.icon}
                </div>

                <h2 style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 22, fontWeight: 700, color: '#09090b',
                  margin: '0 0 8px', lineHeight: 1.1,
                }}>
                  {m.nombre}
                </h2>
                <p style={{ fontSize: 12.5, color: '#71717a', lineHeight: 1.65, margin: 0 }}>
                  {m.descripcion}
                </p>
              </div>

              {/* Métricas */}
              <div style={{
                margin: '0 28px',
                borderTop: '1px solid #f0f0f0',
                padding: '16px 0 12px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {/* Indicador de filtro activo (solo ACK) */}
                {m.id === 'rollout' && ackProyectoSel.length > 0 && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 10, fontWeight: 600, letterSpacing: .5,
                    color: m.color, textTransform: 'uppercase',
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: m.color, display: 'inline-block',
                    }} />
                    {ackProyectoSel.length === 1
                      ? ackProyectoSel[0]
                      : `${ackProyectoSel.length} proyectos`}
                  </div>
                )}
                <div style={{ display: 'flex' }}>
                {metrics.map((met, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '0 8px',
                    borderLeft: i > 0 ? '1px solid #e8eae8' : 'none',
                  }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 26, fontWeight: 400,
                      color: m.color, lineHeight: 1, marginBottom: 3,
                    }}>
                      {met.val}
                    </div>
                    <div style={{
                      fontSize: 9.5, fontWeight: 600, letterSpacing: 1,
                      textTransform: 'uppercase', color: '#a1a1aa',
                    }}>
                      {met.label}
                    </div>
                  </div>
                ))}
                </div>
              </div>

              {/* Footer CTA */}
              <div style={{
                padding: '14px 28px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: .4,
                  color: m.color, textTransform: 'uppercase',
                }}>
                  Abrir {m.corto} →
                </span>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: m.color, opacity: .35,
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
