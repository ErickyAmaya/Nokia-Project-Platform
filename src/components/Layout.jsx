import React, { useState, useEffect, useRef } from 'react'
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
  { to: '/config',   label: 'Config',   icon: '⚙',  id: 'config',   roles: ['admin'] },
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
  { to: '/materiales/hw/inventario',  label: 'Inventario HW',  icon: '📡' },
  { to: '/materiales/hw/movimientos', label: 'Movimientos HW', icon: '🔁' },
  { to: '/materiales/hw/catalogo',    label: 'Catálogo HW',    icon: '🗂' },
]

// Badge de rol
const BADGE = {
  admin:       { label: '⚙ Admin',   cls: 'ub-admin' },
  coordinador: { label: '🏢 Coord',  cls: 'ub-coord' },
  TI:          { label: '📡 TI',     cls: 'ub-op'    },
  TSS:         { label: '📡 TSS',    cls: 'ub-op'    },
  CW:          { label: '🔧 CW',     cls: 'ub-op'    },
  viewer:      { label: '👁 Viewer',    cls: 'ub-viewer' },
  logistica:   { label: '📦 Logística', cls: 'ub-op'     },
}

export default function Layout({ children }) {
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [hwDropdown,  setHwDropdown]  = useState(false)
  const [hwDropPos,   setHwDropPos]   = useState({ top: 0, left: 0 })
  const [rtStatus,    setRtStatus]    = useState(window.__rtStatus || 'connecting')
  const hwDropRef = useRef(null)
  const hwBtnRef  = useRef(null)

  const user          = useAuthStore(s => s.user)
  const empresaBase   = useAuthStore(s => s.empresa)
  const empresaConfig = useAppStore(s => s.empresaConfig)
  const sitios        = useAppStore(s => s.sitios)
  const logout        = useAuthStore(s => s.logout)
  const logoutApp     = useAppStore(s => s.logout)
  const navigate      = useNavigate()
  const location      = useLocation()

  const inMateriales = location.pathname.startsWith('/materiales')

  // Fusión: los valores dinámicos (ConfigPage) tienen prioridad sobre los estáticos
  const empresa = {
    ...empresaBase,
    nombre:       empresaConfig?.nombre       || empresaBase?.nombre,
    nombre_corto: empresaConfig?.nombre_corto || empresaBase?.nombre_corto,
    logoUrl:      empresaConfig?.logo_url     || empresaBase?.logoUrl,
    color:        empresaConfig?.color_primario || empresaBase?.color,
  }

  useEffect(() => {
    function handler(e) { setRtStatus(e.detail) }
    window.addEventListener('rt-status', handler)
    return () => window.removeEventListener('rt-status', handler)
  }, [])

  // Cerrar dropdown HW al hacer clic fuera
  useEffect(() => {
    function handleClick(e) {
      const inBtn   = hwBtnRef.current  && hwBtnRef.current.contains(e.target)
      const inPanel = hwDropRef.current && hwDropRef.current.contains(e.target)
      if (!inBtn && !inPanel) setHwDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Aplica color primario de la empresa al CSS custom property
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

  // Nav según módulo activo
  const allVisible = inMateriales
    ? MAT_NAV.filter(canSee)
    : [...ALL_NAV.filter(canSee), ...ADMIN_NAV.filter(canSee)]

  // Botón cambiar módulo (solo admin/coord y solo cuando hay varios módulos)
  const canSwitchModule = user?.modulo === 'all'

  const badge = BADGE[role] || BADGE.viewer

  async function handleLogout() {
    if (!confirm('¿Cerrar sesión?')) return
    await logoutApp()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100svh', background: '#f0f2f0' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        background: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top) + 6px) 18px 6px',
        minHeight: 'calc(50px + env(safe-area-inset-top))',
        position: 'sticky', top: 0, zIndex: 200,
        borderBottom: `3px solid ${empresa?.color || '#1a9c1a'}`,
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
          {inMateriales ? 'Gestión de Inventarios' : 'Liquidador de Actividades'}
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
        background: '#fff', display: 'flex', gap: 1, padding: '0 18px',
        borderBottom: '1.5px solid #e0e4e0',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        position: 'sticky', top: 'calc(50px + env(safe-area-inset-top))', zIndex: 199,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        {allVisible.map((item, idx) => {
          // Insertar el dropdown HW Nokia entre Catálogo y Config
          const isConfig   = item.id === 'mat-config'
          const hwTrigger  = inMateriales && isConfig
          const hwActive   = location.pathname.startsWith('/materiales/hw')
          return (
            <React.Fragment key={item.id}>
              {hwTrigger && (
                <div ref={hwDropRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch' }}>
                  <button
                    ref={hwBtnRef}
                    onClick={() => {
                      const rect = hwBtnRef.current?.getBoundingClientRect()
                      if (rect) setHwDropPos({ top: rect.bottom, left: rect.left })
                      setHwDropdown(p => !p)
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: "'Barlow', sans-serif", fontSize: 11, fontWeight: 600,
                      letterSpacing: .6, textTransform: 'uppercase', padding: '8px 12px',
                      color: hwActive ? (empresa?.color || '#0d6e0d') : '#555f55',
                      borderBottom: hwActive ? `2px solid ${empresa?.color || '#1a9c1a'}` : '2px solid transparent',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    HW Nokia {hwDropdown ? '▴' : '▾'}
                  </button>
                </div>
              )}
              <NavLink
                end
                to={item.to}
                style={({ isActive }) => ({
                  background: 'none', border: 'none',
                  color: isActive ? (empresa?.color || '#0d6e0d') : '#555f55',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 11, fontWeight: 600, letterSpacing: .6,
                  textTransform: 'uppercase',
                  padding: '8px 12px', cursor: 'pointer',
                  borderBottom: isActive ? `2px solid ${empresa?.color || '#1a9c1a'}` : '2px solid transparent',
                  transition: 'all .15s', whiteSpace: 'nowrap',
                  textDecoration: 'none', display: 'inline-block',
                })}
              >
                {item.label}
              </NavLink>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Dropdown panel HW Nokia — fuera del nav para escapar overflow */}
      {hwDropdown && (
        <div
          ref={hwDropRef}
          style={{
            position: 'fixed', top: hwDropPos.top, left: hwDropPos.left, zIndex: 400,
            background: '#fff', borderRadius: 8, minWidth: 190,
            boxShadow: '0 6px 24px rgba(0,0,0,.14)',
            border: '1.5px solid #e0e4e0', overflow: 'hidden',
          }}
        >
          {HW_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setHwDropdown(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', textDecoration: 'none',
                fontFamily: "'Barlow', sans-serif", fontSize: 11, fontWeight: 600,
                letterSpacing: .4, color: isActive ? (empresa?.color || '#0d6e0d') : '#555f55',
                background: isActive ? '#f0fdf4' : '#fff',
                borderLeft: isActive ? `3px solid ${empresa?.color || '#1a9c1a'}` : '3px solid transparent',
              })}
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </div>
      )}


      {/* ── Mobile Nav Drawer ──────────────────────────────────── */}
      {drawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 280 }}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>

        {/* ── Drawer header: usuario + cerrar ── */}
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

          {/* Módulo actual */}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', letterSpacing: 1.2,
            textTransform: 'uppercase', marginTop: 10, fontWeight: 700 }}>
            {inMateriales ? '📦 Gestión de Materiales' : '💰 Liquidador Nokia'}
          </div>

          {/* Cambiar módulo */}
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
        </div>

        {/* ── Nav items ── */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 6 }}>
          {allVisible.map(item => (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive }) => `nav-drawer-item${isActive ? ' active' : ''}`}
              onClick={() => setDrawerOpen(false)}
              style={{ textDecoration: 'none' }}
            >
              <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {inMateriales && (
            <>
              <div style={{ padding: '10px 16px 4px', fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
                color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', borderTop: '1px solid rgba(255,255,255,.05)', marginTop: 4 }}>
                HW Nokia
              </div>
              {HW_NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-drawer-item${isActive ? ' active' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                  style={{ textDecoration: 'none', paddingLeft: 28 }}
                >
                  <span style={{ fontSize: 14, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </div>

        {/* ── Drawer footer: logout ── */}
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
        padding: '18px 18px max(18px, env(safe-area-inset-bottom))',
        maxWidth: 1400, margin: '0 auto',
      }}>
        {children}
      </main>
    </div>
  )
}
