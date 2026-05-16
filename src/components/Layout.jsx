import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppStore }  from '../store/useAppStore'

// ── Nav Liquidador (Billing) ──────────────────────────────────────
const ALL_NAV = [
  { to: '/dashboard',      label: 'Dashboard',  icon: '📊', id: 'dashboard',      roles: ['admin','coordinador','viewer'] },
  { to: '/ti',             label: 'TI',         icon: '📡', id: 'ti',             roles: ['admin','coordinador','TI','viewer'] },
  { to: '/tss',            label: 'TSS',        icon: '📡', id: 'tss',            roles: ['admin','coordinador','TSS','viewer'] },
  { to: '/cw-consolidado', label: 'CW',         icon: '🔧', id: 'cw-consolidado', roles: ['admin','coordinador','CW','viewer'] },
  { to: '/liquidador',     label: 'Liquidador', icon: '💰', id: 'liquidador',     roles: null },
  { to: '/gastos',         label: 'Gastos',     icon: '💳', id: 'gastos',         roles: ['admin','coordinador','viewer'] },
  { to: '/reportes',       label: 'Reportes',   icon: '📄', id: 'reportes',       roles: ['admin','coordinador','viewer'] },
  { to: '/analitica',      label: 'Analítica',  icon: '📈', id: 'analitica',      roles: ['admin','coordinador','viewer','TI','TSS','CW'] },
]
const ADMIN_NAV = [
  { to: '/catalogo', label: 'Catálogo', icon: '📋', id: 'catalogo', roles: ['admin','coordinador'] },
]

const ADMIN_PANEL_NAV = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: '👥', id: 'admin-usuarios', roles: ['admin'] },
  { to: '/admin/config',   label: 'Config',   icon: '⚙',  id: 'admin-config',   roles: ['admin'] },
]

// ── Nav Materiales ────────────────────────────────────────────────
const MAT_NAV = [
  { to: '/materiales',              label: 'Dashboard',   icon: '📊', id: 'mat-dashboard',   roles: null },
  { to: '/materiales/inventario',   label: 'Inventario',  icon: '📦', id: 'mat-inventario',  roles: null },
  { to: '/materiales/movimientos',  label: 'Movimientos', icon: '🔄', id: 'mat-movimientos', roles: ['admin','coordinador','logistica'] },
  { to: '/materiales/sitios',       label: 'Sitios',      icon: '📍', id: 'mat-sitios',      roles: ['admin','coordinador','logistica'] },
  { to: '/materiales/catalogo',     label: 'Catálogo',    icon: '📋', id: 'mat-catalogo',    roles: ['admin','coordinador','logistica'] },
  { to: '/materiales/reportes',     label: 'Reportes',    icon: '📊', id: 'mat-reportes',    roles: ['admin','coordinador','logistica'] },
  { to: '/materiales/config',       label: 'Config',      icon: '⚙',  id: 'mat-config',      roles: ['admin','coordinador','logistica'] },
]

const HW_NAV = [
  { to: '/materiales/hw/dashboard',   label: 'Dashboard HW',   icon: '📊', id: 'hw-dashboard',   roles: null },
  { to: '/materiales/hw/inventario',  label: 'Inventario HW',  icon: '📡', id: 'hw-inventario',  roles: null },
  { to: '/materiales/hw/movimientos',           label: 'Movimientos HW',  icon: '🔁', id: 'hw-movimientos',  roles: null },
  { to: '/materiales/hw/despachos-pendientes', label: 'Pend. Despacho',  icon: '📦', id: 'hw-despachos-p',  roles: null },
  { to: '/materiales/hw/catalogo',             label: 'Catálogo HW',     icon: '🗂', id: 'hw-catalogo',     roles: null },
  { to: '/materiales/hw/fallas',               label: 'HW en Falla',     icon: '⚠',  id: 'hw-fallas',       roles: null },
]

const ROLLOUT_NAV = [
  { to: '/rollout/ack',          label: 'Dashboard',  icon: '📊', id: 'ack-dashboard' },
  { to: '/rollout/ack/tablas',   label: 'Tablas',     icon: '📋', id: 'ack-tablas'    },
  { to: '/rollout/ack/sitios',   label: 'Por Sitio',  icon: '📍', id: 'ack-sitios'    },
  { to: '/rollout/ack/forecast', label: 'Reportes',   icon: '🖨', id: 'ack-forecast'  },
]

const FACT_NAV = [
  { to: '/facturacion',              label: 'Dashboard',      icon: '📊', id: 'fact-dashboard', exact: true },
  { to: '/facturacion/por-facturar', label: 'Por Facturar',   icon: '📄', id: 'fact-pf'        },
  { to: '/facturacion/facturado',    label: 'Facturado',      icon: '✓',  id: 'fact-fc'        },
  { to: '/facturacion/sitios',       label: 'Fact. Sitios',   icon: '📍', id: 'fact-sitios'    },
  { to: '/facturacion/pos',          label: 'POs',            icon: '📁', id: 'fact-pos'       },
  { to: '/facturacion/smps',         label: 'Todos los SMPs', icon: '🗂', id: 'fact-smps'      },
  { to: '/facturacion/pagos-subc',   label: 'Pagos SubC',     icon: '💳', id: 'fact-pagos'     },
]

const BADGE = {
  admin:       { label: '⚙ Admin',      cls: 'ub-admin' },
  coordinador: { label: '🏢 Coord',     cls: 'ub-coord' },
  TI:          { label: '📡 TI',        cls: 'ub-op'    },
  TSS:         { label: '📡 TSS',       cls: 'ub-op'    },
  CW:          { label: '🔧 CW',        cls: 'ub-op'    },
  viewer:      { label: '👁 Viewer',    cls: 'ub-viewer' },
  logistica:   { label: '📦 Logística', cls: 'ub-op'    },
  facturacion: { label: '🧾 Fact.',    cls: 'ub-op'    },
}

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rtStatus,   setRtStatus]   = useState(window.__rtStatus || 'connecting')

  const user          = useAuthStore(s => s.user)
  const empresaBase   = useAuthStore(s => s.empresa)
  const empresaConfig = useAppStore(s => s.empresaConfig)
  const logoutApp     = useAppStore(s => s.logout)
  const navigate      = useNavigate()
  const location      = useLocation()

  const inMateriales  = location.pathname.startsWith('/materiales')
  const inHw          = location.pathname.startsWith('/materiales/hw')
  const inRollout     = location.pathname.startsWith('/rollout')
  const inFacturacion = location.pathname.startsWith('/facturacion')
  const inAdmin       = location.pathname.startsWith('/admin')

  const empresa = {
    ...empresaBase,
    nombre:         empresaConfig?.nombre          || empresaBase?.nombre,
    nombre_corto:   empresaConfig?.nombre_corto    || empresaBase?.nombre_corto,
    logoUrl:        empresaConfig?.logo_url        || empresaBase?.logoUrl,
    color:          empresaConfig?.color_primario  || empresaBase?.color,
    clienteNombre:  empresaConfig?.cliente_nombre   || '',
    clienteLogoUrl: empresaConfig?.cliente_logo_url || '',
  }

  useEffect(() => {
    function handler(e) { setRtStatus(e.detail) }
    window.addEventListener('rt-status', handler)
    return () => window.removeEventListener('rt-status', handler)
  }, [])

  useEffect(() => {
    if (empresa?.color) {
      document.documentElement.style.setProperty('--g', empresa.color)
      document.documentElement.style.setProperty('--brand', empresa.color)
    }
  }, [empresa?.color])

  const role = user?.role || 'viewer'

  function canSee(item) {
    if (!item.roles) return true
    return item.roles.includes(role)
  }

  const allVisible = inAdmin
    ? ADMIN_PANEL_NAV.filter(canSee)
    : inMateriales
      ? (inHw ? HW_NAV.filter(canSee) : MAT_NAV.filter(canSee))
      : inRollout
        ? ROLLOUT_NAV
        : inFacturacion
          ? FACT_NAV
          : [...ALL_NAV.filter(canSee), ...ADMIN_NAV.filter(canSee)]

  const canSwitchModule = !!user
  const badge = BADGE[role] || BADGE.viewer

  const brand = empresa?.color || '#1a9c1a'

  async function handleLogout() {
    if (!confirm('¿Cerrar sesión?')) return
    await logoutApp()
    navigate('/login')
  }

  const pillBase = {
    padding: '3px 13px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 10, fontWeight: 700, letterSpacing: .5, transition: 'all .15s',
    fontFamily: "'Barlow', sans-serif",
  }

  const headerTitle = inAdmin
    ? 'Panel Admin'
    : inHw
      ? 'HW Nokia'
      : inMateriales
        ? 'Gestión de Inventarios'
        : inRollout
          ? 'ACK'
          : inFacturacion
            ? 'Facturación'
            : location.pathname === '/modulos' || location.pathname === '/'
              ? 'Project Modules'
              : 'Liquidador de Actividades'

  return (
    <div style={{ minHeight: '100svh', background: '#f0f2f0' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        background: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top) + 20px) 18px 8px',
        minHeight: 'calc(58px + env(safe-area-inset-top))',
        position: 'sticky', top: 0, zIndex: 200,
        borderBottom: `3px solid ${brand}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.08)',
      }}>
        {/* Mobile hamburger */}
        <button
          className="mob-menu-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Menú"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {empresa?.logoUrl ? (
            <img
              src={empresa.logoUrl}
              alt={empresa.nombre_corto || 'Logo'}
              style={{ height: 34, maxWidth: 160, objectFit: 'contain' }}
            />
          ) : (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 16, letterSpacing: 1,
              color: empresa?.color || '#144E4A',
            }}>
              {empresa?.nombre_corto || 'INGETEL'}
            </span>
          )}
        </div>

        <span className="hdr-title" style={{
          color: '#555f55', fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 600, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', opacity: .7,
        }}>
          {headerTitle}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {canSwitchModule && (
            <button
              className="desk-only"
              onClick={() => navigate('/modulos')}
              style={{
                background: 'none', border: '1px solid #e0e4e0', borderRadius: 6,
                fontSize: 10, fontWeight: 700, color: '#555f55', cursor: 'pointer',
                padding: '3px 8px', letterSpacing: .4,
              }}
              title="Cambiar módulo"
            >
              ⊞ Módulos
            </button>
          )}

          {(empresa.clienteLogoUrl || empresa.clienteNombre) && (
            <div
              className="desk-only"
              title={`Cliente: ${empresa.clienteNombre}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 6,
                border: '1px solid #e0e4e0', background: '#fafafa',
                fontSize: 9, fontWeight: 700, letterSpacing: .8,
                textTransform: 'uppercase', color: '#9ca89c',
                userSelect: 'none',
              }}
            >
              para
              {empresa.clienteLogoUrl
                ? <img
                    src={empresa.clienteLogoUrl}
                    alt={empresa.clienteNombre || 'cliente'}
                    style={{ height: 16, maxWidth: 60, objectFit: 'contain' }}
                  />
                : <span style={{ color: '#3f3f46', fontWeight: 800 }}>{empresa.clienteNombre}</span>
              }
            </div>
          )}

          <span
            title={rtStatus === 'connected' ? 'Tiempo real: conectado' : rtStatus === 'error' ? 'Error de conexión' : 'Conectando…'}
            style={{
              width: 9, height: 9, borderRadius: '50%',
              background: rtStatus === 'connected' ? '#22c55e' : rtStatus === 'error' ? '#ef4444' : '#f59e0b',
              display: 'inline-block', flexShrink: 0,
              boxShadow: rtStatus === 'connected' ? '0 0 0 2px rgba(34,197,94,.25)' : 'none',
              transition: 'background .4s',
            }}
          />
          <span className={`user-badge ${badge.cls}`} onClick={handleLogout} style={{ cursor: 'pointer' }}>
            {badge.label} ▸ Salir
          </span>
        </div>
      </header>

      {/* ── Desktop Nav ────────────────────────────────────────── */}
      <nav className="desk-nav" style={{
        background: '#fff',
        borderBottom: '1.5px solid #e0e4e0',
        position: 'sticky', top: 'calc(58px + env(safe-area-inset-top))', zIndex: 199,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        {/* Toggle Materiales / HW Nokia */}
        {inMateriales && (
          <div style={{
            display: 'flex', gap: 4, padding: '5px 18px 4px',
            borderBottom: '1px solid #f0f2f0',
          }}>
            <button
              onClick={() => navigate('/materiales')}
              style={{
                ...pillBase,
                background: !inHw ? brand : 'transparent',
                color: !inHw ? '#fff' : '#6b7280',
              }}
            >
              📦 Materiales
            </button>
            <button
              onClick={() => navigate('/materiales/hw/dashboard')}
              style={{
                ...pillBase,
                background: inHw ? brand : 'transparent',
                color: inHw ? '#fff' : '#6b7280',
              }}
            >
              📡 HW Nokia
            </button>
          </div>
        )}

        {/* Sub-nav items */}
        <div style={{
          display: 'flex', gap: 1, padding: '0 18px',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {allVisible.map(item => (
            <NavLink
              end
              key={item.id || item.to}
              to={item.to}
              style={({ isActive }) => ({
                background: 'none', border: 'none',
                color: isActive ? brand : '#555f55',
                fontFamily: "'Barlow', sans-serif",
                fontSize: 11, fontWeight: 600, letterSpacing: .6,
                textTransform: 'uppercase',
                padding: '8px 12px', cursor: 'pointer',
                borderBottom: isActive ? `2px solid ${brand}` : '2px solid transparent',
                transition: 'all .15s', whiteSpace: 'nowrap',
                textDecoration: 'none', display: 'inline-block',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Mobile Nav Drawer ──────────────────────────────────── */}
      {drawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 280 }}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>

        {/* Drawer header */}
        <div style={{
          padding: 'max(env(safe-area-inset-top), 16px) 16px 14px',
          borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0,
          background: 'rgba(0,0,0,.25)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4, lineHeight: 1.2 }}>
                {user?.nombre || user?.email || 'Usuario'}
              </div>
              <span className={`user-badge ${badge.cls}`} style={{ fontSize: 9, padding: '2px 8px' }}>
                {badge.label}
              </span>
            </div>
            <button
              style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.6)',
                fontSize: 18, cursor: 'pointer', borderRadius: 6, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onClick={() => setDrawerOpen(false)}
            >×</button>
          </div>

          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', letterSpacing: 1.2,
            textTransform: 'uppercase', marginTop: 10, fontWeight: 700 }}>
            {inAdmin ? '⚙ Panel Admin' : inHw ? '📡 HW Nokia' : inMateriales ? '📦 Gestión de Materiales' : inRollout ? '📋 Rollout Nokia' : inFacturacion ? '🧾 Facturación' : '💰 Liquidador Nokia'}
          </div>

          {canSwitchModule && (
            <button
              onClick={() => { navigate('/modulos'); setDrawerOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
                color: 'rgba(255,255,255,.7)', borderRadius: 6, padding: '7px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%',
                letterSpacing: .4 }}
            >
              ⊞ Cambiar Módulo
            </button>
          )}

          {/* Toggle pills en drawer (solo en Materiales) */}
          {inMateriales && (
            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
              <button
                onClick={() => { navigate('/materiales'); setDrawerOpen(false) }}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700,
                  background: !inHw ? brand : 'rgba(255,255,255,.12)',
                  color: !inHw ? '#fff' : 'rgba(255,255,255,.6)',
                }}
              >
                📦 Materiales
              </button>
              <button
                onClick={() => { navigate('/materiales/hw/dashboard'); setDrawerOpen(false) }}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 700,
                  background: inHw ? brand : 'rgba(255,255,255,.12)',
                  color: inHw ? '#fff' : 'rgba(255,255,255,.6)',
                }}
              >
                📡 HW Nokia
              </button>
            </div>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 6 }}>
          {allVisible.map(item => (
            <NavLink
              end
              key={item.id || item.to}
              to={item.to}
              className={({ isActive }) => `nav-drawer-item${isActive ? ' active' : ''}`}
              onClick={() => setDrawerOpen(false)}
              style={{ textDecoration: 'none' }}
            >
              <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Drawer footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.07)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => { setDrawerOpen(false); handleLogout() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'rgba(192,57,43,.18)', border: '1px solid rgba(192,57,43,.35)',
              color: '#e57373', borderRadius: 8, padding: '10px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: .3 }}
          >
            <span>↪</span> Cerrar Sesión
          </button>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,.2)', marginTop: 8,
            letterSpacing: .8, textTransform: 'uppercase', textAlign: 'center' }}>
            {empresa?.nombre || 'INGETEL'} · Diseñado por SCYTEL
          </div>
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────────── */}
      <main className="page-main" style={{
        padding: '18px 18px calc(max(18px, env(safe-area-inset-bottom)) + 30px)',
        maxWidth: 1400, margin: '0 auto',
      }}>
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f7f8f7', borderTop: '1px solid #e8eae8',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <span style={{ fontSize: 9, color: '#c4c4c4', letterSpacing: .6, userSelect: 'none' }}>
          Copyright © 2026 Scytel Networks. All rights reserved.
        </span>
      </div>
    </div>
  )
}
