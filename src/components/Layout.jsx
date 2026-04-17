import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppStore }  from '../store/useAppStore'

// ── Definición de nav ─────────────────────────────────────────────
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

// Badge de rol
const BADGE = {
  admin:       { label: '⚙ Admin',   cls: 'ub-admin' },
  coordinador: { label: '🏢 Coord',  cls: 'ub-coord' },
  TI:          { label: '📡 TI',     cls: 'ub-op'    },
  TSS:         { label: '📡 TSS',    cls: 'ub-op'    },
  CW:          { label: '🔧 CW',     cls: 'ub-op'    },
  viewer:      { label: '👁 Viewer', cls: 'ub-viewer' },
}

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rtStatus,   setRtStatus]   = useState(window.__rtStatus || 'connecting')

  const user          = useAuthStore(s => s.user)
  const empresaBase   = useAuthStore(s => s.empresa)          // hardcoded en empresas.js
  const empresaConfig = useAppStore(s => s.empresaConfig)     // dinámico desde Supabase config
  const logout        = useAuthStore(s => s.logout)
  const logoutApp     = useAppStore(s => s.logout)
  const navigate      = useNavigate()

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

  // Aplica color primario de la empresa al CSS custom property
  useEffect(() => {
    if (empresa?.color) {
      document.documentElement.style.setProperty('--g', empresa.color)
      document.documentElement.style.setProperty('--brand', empresa.color)
    }
  }, [empresa?.color])

  const role = user?.role || 'viewer'

  // Filtra nav items según el rol actual
  function canSee(item) {
    if (!item.roles) return true          // sin restricción
    return item.roles.includes(role)
  }

  const navItems   = ALL_NAV.filter(canSee)
  const adminItems = ADMIN_NAV.filter(canSee)
  const allVisible = [...navItems, ...adminItems]

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
        justifyContent: 'space-between', padding: '0 18px', height: 50,
        position: 'sticky', top: 0, zIndex: 200,
        borderBottom: `3px solid ${empresa?.color || '#1a9c1a'}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.08)',
      }}>
        {/* Mobile hamburger */}
        <button
          className="btn btn-sm"
          style={{ display: 'none', background: 'none', border: 'none', fontSize: 20, padding: '8px 10px' }}
          id="hdr-menu-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Menú"
        >
          ☰
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

        <span style={{
          color: '#555f55', fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 600, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', opacity: .7,
        }}>
          Liquidador Nokia 2026
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
      <nav style={{
        background: '#fff', display: 'flex', gap: 1, padding: '0 18px',
        borderBottom: '1.5px solid #e0e4e0',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        position: 'sticky', top: 50, zIndex: 199,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}>
        {allVisible.map(item => (
          <NavLink
            key={item.id}
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
        ))}
      </nav>

      {/* ── Mobile Nav Drawer ──────────────────────────────────── */}
      {drawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 280 }}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#27c727',
          }}>
            Navegación
          </span>
          <button
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 22, cursor: 'pointer', padding: '2px 8px' }}
            onClick={() => setDrawerOpen(false)}
          >×</button>
        </div>

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

        <div style={{
          marginTop: 'auto', padding: '14px 16px',
          borderTop: '1px solid rgba(255,255,255,.07)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: .8 }}>
            {empresa?.nombre || 'INGETEL'}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', letterSpacing: .8, textTransform: 'uppercase', marginTop: 2 }}>
            Diseñado por SCYTEL
          </div>
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────────── */}
      <main style={{
        padding: '18px 18px max(18px, env(safe-area-inset-bottom))',
        maxWidth: 1400, margin: '0 auto',
      }}>
        {children}
      </main>
    </div>
  )
}
