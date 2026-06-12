import { useState, useMemo, useEffect, useRef } from 'react'
import { ClipboardList, Boxes, RadioTower, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppStore }  from '../store/useAppStore'
import { useMatStore }  from '../store/useMatStore'
import { useAckStore }  from '../store/useAckStore'
import { useFactStore, buildInvoicesMap, getEventosRow } from '../store/useFactStore'

const MODULE_ACCESS = {
  billing:     ['admin', 'coordinador', 'viewer', 'TI', 'TSS', 'CW'],
  materiales:  ['admin', 'coordinador', 'logistica', 'viewer'],
  rollout:     ['admin', 'coordinador', 'viewer'],
  facturacion: ['admin', 'coordinador', 'facturacion', 'viewer'],
}

const MODULOS = [
  {
    id:          'billing',
    nombre:      'Liquidador de Actividades',
    corto:       'Liquidador',
    descripcion: 'Gestión y liquidación de sitios Nokia — TI, TSS y Obra Civil.',
    Icon:        ClipboardList,
    color:       '#144E4A',
    ruta:        '/dashboard',
  },
  {
    id:          'materiales',
    nombre:      'Logística · WMS',
    corto:       'Logística',
    descripcion: 'Control de stock, movimientos y trazabilidad de materiales y HW Nokia.',
    Icon:        Boxes,
    color:       '#1d4ed8',
    ruta:        '/materiales',
  },
  {
    id:          'rollout',
    nombre:      'Seguimiento Rollout',
    corto:       'Rollout',
    descripcion: 'Monitoreo de avance, ACK y gestión de campo del rollout Nokia.',
    Icon:        RadioTower,
    color:       '#7c3aed',
    ruta:        '/rollout',
  },
  {
    id:          'facturacion',
    nombre:      'Facturación',
    corto:       'Facturación',
    descripcion: 'Seguimiento de hitos de facturación, POs y estados por evento y SMP.',
    Icon:        Receipt,
    color:       '#b45309',
    ruta:        '/facturacion',
  },
]

export default function ModuloHomePage() {
  const navigate      = useNavigate()
  const user          = useAuthStore(s => s.user)
  const [hovered, setHovered] = useState(null)

  // ── Datos de stores ──────────────────────────────────────────────
  const sitios         = useAppStore(s => s.sitios)
  const matCatalogo    = useMatStore(s => s.catalogo)
  const matStock       = useMatStore(s => s.stock)
  const matDespachos   = useMatStore(s => s.despachos)
  const ackSabana      = useAckStore(s => s.sabana)
  const ackForecasts   = useAckStore(s => s.forecasts)
  const ackUploads     = useAckStore(s => s.uploads)
  const ackProyectoSel = useAckStore(s => s.proyectoSel)
  const factPPA        = useFactStore(s => s.ppa)
  const factInvoices   = useFactStore(s => s.invoices)

  const matLoaded  = matCatalogo.length > 0
  const ackLoaded  = ackSabana.length > 0 || ackUploads.length > 0
  const factLoaded = factPPA.length > 0
  const liqLoaded  = sitios.length > 0

  const ackFiltered = ackProyectoSel.length > 0
    ? ackSabana.filter(r => ackProyectoSel.includes(r.proyecto_alcance))
    : ackSabana

  const factInvMap = useMemo(() => buildInvoicesMap(factInvoices), [factInvoices])

  // ── Métricas calculadas (actuales) ───────────────────────────────
  const liveMetrics = useMemo(() => {
    const matAlertas = matCatalogo.filter(c => {
      if (!c.stock_minimo || c.stock_minimo <= 0) return false
      const total = matStock
        .filter(s => s.catalogo_id === c.id)
        .reduce((acc, s) => acc + (s.stock_actual || 0), 0)
      return total < c.stock_minimo
    }).length

    const factPorFact = factPPA.filter(row => {
      if (!row.sgr) return false
      return getEventosRow(row, factInvMap).some(e => e.status === 'facturar')
    }).length
    const factFacturado = factPPA.filter(row => {
      if (!row.sgr) return false
      return getEventosRow(row, factInvMap).some(e => e.status === 'facturado')
    }).length

    return {
      liqTotal:     sitios.length,
      liqProceso:   sitios.filter(s => s.estado !== 'final').length,
      liqFinal:     sitios.filter(s => s.estado === 'final').length,
      matTotal:     matCatalogo.length,
      matAlertas,
      matDespachos: matDespachos.length,
      ackTotal:     ackFiltered.length,
      ackConFC:     ackFiltered.filter(r => ackForecasts[r.smp]).length,
      ackPend:      ackFiltered.filter(r => r.procesos_cierre_ph2).length,
      factTotal:    factPPA.length,
      factPorFact,
      factFacturado,
    }
  }, [sitios, matCatalogo, matStock, matDespachos, ackFiltered, ackForecasts, factPPA, factInvMap])

  // ── Cache stale-while-revalidate en localStorage ─────────────────
  const CACHE_KEY = 'home_metrics_v1'
  const [cachedMetrics, setCachedMetrics] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
  })
  const savedRef = useRef(false)

  useEffect(() => {
    const allLoaded = liqLoaded && matLoaded && ackLoaded && factLoaded
    if (!allLoaded || savedRef.current) return
    savedRef.current = true
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(liveMetrics)) } catch {}
    setCachedMetrics(liveMetrics)
  }, [liqLoaded, matLoaded, ackLoaded, factLoaded, liveMetrics])

  // Usar live si disponible, cache si no
  const m = (loaded, liveVal, cacheKey) => {
    if (loaded) return liveVal
    return cachedMetrics?.[cacheKey] ?? '—'
  }

  function getMetrics(id) {
    if (id === 'billing') return [
      { val: m(liqLoaded, liveMetrics.liqTotal,     'liqTotal'),    label: 'Sitios'      },
      { val: m(liqLoaded, liveMetrics.liqProceso,   'liqProceso'),  label: 'En proceso'  },
      { val: m(liqLoaded, liveMetrics.liqFinal,     'liqFinal'),    label: 'Finalizados' },
    ]
    if (id === 'materiales') return [
      { val: m(matLoaded, liveMetrics.matTotal,    'matTotal'),    label: 'Materiales'   },
      { val: m(matLoaded, liveMetrics.matAlertas,  'matAlertas'),  label: 'Alertas stock' },
      { val: m(matLoaded, liveMetrics.matDespachos,'matDespachos'),label: 'Despachos'    },
    ]
    if (id === 'rollout') return [
      { val: m(ackLoaded, liveMetrics.ackTotal,  'ackTotal'),  label: 'SMPs'       },
      { val: m(ackLoaded, liveMetrics.ackConFC,  'ackConFC'),  label: 'Con FC'     },
      { val: m(ackLoaded, liveMetrics.ackPend,   'ackPend'),   label: 'Pendientes' },
    ]
    if (id === 'facturacion') return [
      { val: m(factLoaded, liveMetrics.factTotal,      'factTotal'),      label: 'SMPs'        },
      { val: m(factLoaded, liveMetrics.factPorFact,    'factPorFact'),    label: 'Por facturar' },
      { val: m(factLoaded, liveMetrics.factFacturado,  'factFacturado'),  label: 'Facturado'   },
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
    }} className="mod-page">
      <style>{`
        @keyframes mod-pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @media(max-width:640px){
          .mod-page{padding:28px 12px!important;gap:24px!important;}
          .mod-h1{font-size:30px!important;margin-bottom:4px!important;}
          .mod-subtitle{font-size:12px!important;}
          .mod-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px!important;max-width:100%!important;}
          .mod-card-body{padding:14px 13px 10px!important;}
          .mod-icon{width:34px!important;height:34px!important;font-size:17px!important;border-radius:9px!important;margin-bottom:8px!important;}
          .mod-card-title{font-size:14px!important;margin-bottom:3px!important;}
          .mod-card-desc{font-size:10px!important;line-height:1.4!important;}
          .mod-metrics{margin:0 13px!important;padding:8px 0 6px!important;gap:6px!important;}
          .mod-metric-val{font-size:19px!important;}
          .mod-metric-label{font-size:7.5px!important;}
          .mod-card-footer{padding:6px 13px 13px!important;}
          .mod-cta{font-size:10px!important;}
        }
      `}</style>

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
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: empresaConfig?.color_primario || '#144E4A' }}>
            {empresaConfig?.nombre_corto || 'Ingetel'}
          </span>
          <span style={{ color: '#6b7280', fontSize: 16, lineHeight: 1 }}>—</span>
          {clienteLogoUrl
            ? <img src={clienteLogoUrl} alt={clienteNombre} style={{ height: 14, maxWidth: 56, objectFit: 'contain', verticalAlign: 'middle' }} />
            : clienteNombre || 'Nokia'
          }
        </div>

        <h1 className="mod-h1" style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 52, fontWeight: 800, lineHeight: 1,
          color: '#09090b', margin: '0 0 10px',
        }}>
          Bienvenido, {primerNombre}
        </h1>
        <p className="mod-subtitle" style={{ fontSize: 15, color: '#71717a', margin: 0, fontWeight: 400 }}>
          Selecciona el módulo al que deseas acceder
        </p>
      </div>

      {/* ── Tarjetas ────────────────────────────────────────────────── */}
      <div className="mod-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 20, width: '100%', maxWidth: 980,
      }}>
        {MODULOS.map(m => {
          const canAccess = MODULE_ACCESS[m.id]?.includes(user?.role) ?? false
          const isH       = canAccess && hovered === m.id
          const metrics   = getMetrics(m.id)

          return (
            <div
              key={m.id}
              onClick={() => canAccess && navigate(m.ruta)}
              onMouseEnter={() => canAccess && setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'relative', overflow: 'hidden',
                background: '#fff',
                border: `1.5px solid ${isH ? m.color : '#e8eae8'}`,
                borderRadius: 20,
                cursor: canAccess ? 'pointer' : 'not-allowed',
                display: 'flex', flexDirection: 'column',
                opacity: canAccess ? 1 : 0.42,
                filter: canAccess ? 'none' : 'grayscale(60%)',
                boxShadow: isH
                  ? `0 0 0 4px ${m.color}1a, 0 16px 40px rgba(0,0,0,.1)`
                  : '0 2px 12px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.04)',
                transform: isH ? 'translateY(-6px)' : 'none',
                transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), border-color .2s, box-shadow .2s, opacity .2s',
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

              {/* Candado para módulos sin acceso */}
              {!canAccess && (
                <div style={{
                  position: 'absolute', top: 14, right: 16,
                  fontSize: 13, color: '#a1a1aa',
                  userSelect: 'none', pointerEvents: 'none',
                }}>🔒</div>
              )}

              {/* Body: ícono + título + descripción */}
              <div className="mod-card-body" style={{ padding: '32px 28px 20px', flex: 1 }}>
                <div className="mod-icon" style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: `${m.color}18`,
                  border: `1.5px solid ${m.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                  transform: isH ? 'scale(1.08) rotate(-4deg)' : 'none',
                  boxShadow: isH ? `0 4px 16px ${m.color}40` : 'none',
                  transition: 'transform .2s, box-shadow .2s',
                }}>
                  <m.Icon size={28} color={m.color} strokeWidth={1.6} />
                </div>

                <h2 className="mod-card-title" style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 22, fontWeight: 700, color: '#09090b',
                  margin: '0 0 8px', lineHeight: 1.1,
                }}>
                  {m.nombre}
                </h2>
                <p className="mod-card-desc" style={{ fontSize: 12.5, color: '#71717a', lineHeight: 1.65, margin: 0 }}>
                  {m.descripcion}
                </p>
              </div>

              {/* Métricas */}
              <div className="mod-metrics" style={{
                margin: '0 28px',
                borderTop: '1px solid #f0f0f0',
                padding: '16px 0 12px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {canAccess ? (
                  <>
                    {m.id === 'rollout' && ackProyectoSel.length > 0 && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 10, fontWeight: 600, letterSpacing: .5,
                        color: m.color, textTransform: 'uppercase',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                        {ackProyectoSel.length === 1 ? ackProyectoSel[0] : `${ackProyectoSel.length} proyectos`}
                      </div>
                    )}
                    <div style={{ display: 'flex' }}>
                      {metrics.map((met, i) => (
                        <div key={i} style={{
                          flex: 1, textAlign: 'center', padding: '0 8px',
                          borderLeft: i > 0 ? '1px solid #e8eae8' : 'none',
                        }}>
                          <div className="mod-metric-val" style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: 26, fontWeight: 400,
                            color: m.color, lineHeight: 1, marginBottom: 3,
                          }}>{met.val}</div>
                          <div className="mod-metric-label" style={{
                            fontSize: 9.5, fontWeight: 600, letterSpacing: 1,
                            textTransform: 'uppercase', color: '#a1a1aa',
                          }}>{met.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: '#a1a1aa', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
                    Sin acceso
                  </div>
                )}
              </div>

              {/* Footer CTA */}
              <div className="mod-card-footer" style={{
                padding: '14px 28px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span className="mod-cta" style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: .4,
                  color: canAccess ? m.color : '#a1a1aa', textTransform: 'uppercase',
                }}>
                  {canAccess ? `Abrir ${m.corto} →` : 'Sin acceso'}
                </span>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: canAccess ? m.color : '#d4d4d8', opacity: .35,
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Panel Admin (solo admin) ──────────────────────────────── */}
      {user?.role === 'admin' && (
        <div
          onClick={() => navigate('/admin')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: '#fff', border: '1.5px solid #e8eae8',
            borderRadius: 12, padding: '10px 20px', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,.05)',
            transition: 'border-color .2s, box-shadow .2s',
            fontSize: 12, fontWeight: 700, color: '#374151', letterSpacing: .3,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8eae8'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.05)' }}
        >
          <span style={{ fontSize: 15 }}>⚙</span>
          Panel Admin
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>→</span>
        </div>
      )}
    </div>
  )
}
