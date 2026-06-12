import { useEffect, useRef, lazy, Suspense, Component } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAppStore }     from './store/useAppStore'
import { useCatalogStore }  from './store/useCatalogStore'
import { useEmpresaStore }  from './store/useEmpresaStore'
import { useMatStore }  from './store/useMatStore'
import { useHwStore }   from './store/useHwStore'
import { useAckStore }  from './store/useAckStore'
import { useFactStore } from './store/useFactStore'
import { useRealtime }  from './hooks/useRealtime'
import ProtectedRoute   from './components/ProtectedRoute'
import Layout           from './components/Layout'
import Toast            from './components/Toast'
import LoginPage        from './pages/LoginPage'
import { ACCESS, isFieldRole } from './config/permissions'

import SetPasswordPage  from './pages/SetPasswordPage'
import Dashboard        from './pages/Dashboard'
import ConsolidadoTI    from './pages/ConsolidadoTI'
import ConsolidadoTSS   from './pages/ConsolidadoTSS'
import ConsolidadoCW    from './pages/ConsolidadoCW'
import GastosPage       from './pages/GastosPage'
import LiquidadorPage   from './pages/LiquidadorPage'
import LiquidadorIndexPage from './pages/LiquidadorIndexPage'
import ModuloHomePage      from './pages/ModuloHomePage'
import AdminWrapper       from './pages/admin/AdminWrapper'
import AdminUsuarios      from './pages/admin/AdminUsuarios'
import AdminEstadisticas  from './pages/admin/AdminEstadisticas'
import AdminAckGlosario   from './pages/admin/AdminAckGlosario'
import MatWrapper         from './pages/materiales/MatWrapper'
import MatDashboard       from './pages/materiales/MatDashboard'
import MatInventario      from './pages/materiales/MatInventario'
import MatMovimientos     from './pages/materiales/MatMovimientos'
import MatSitios          from './pages/materiales/MatSitios'
import MatCatalogo        from './pages/materiales/MatCatalogo'
import MatConfig          from './pages/materiales/MatConfig'
import HwInventario            from './pages/materiales/HwInventario'
import HwMovimientos           from './pages/materiales/HwMovimientos'
import HwCatalogo              from './pages/materiales/HwCatalogo'
import HwDashboard             from './pages/materiales/HwDashboard'
import HwFallas                from './pages/materiales/HwFallas'
import HwFrConfig              from './pages/materiales/HwFrConfig'
import HwDespachosPendientes   from './pages/materiales/HwDespachosPendientes'
import HwLogInversa            from './pages/materiales/HwLogInversa'
import HwBodegaNokia           from './pages/materiales/HwBodegaNokia'
import MatReportes        from './pages/materiales/MatReportes'
import AckWrapper         from './pages/rollout/AckWrapper'
import AckDashboard       from './pages/rollout/AckDashboard'
import AckTablas          from './pages/rollout/AckTablas'
import AckSitios          from './pages/rollout/AckSitios'
import AckForecast        from './pages/rollout/AckForecast'
import MapaSitios         from './pages/rollout/MapaSitios'
import FactWrapper from './pages/facturacion/FactWrapper'

// Fact pages: lazy-load so they don't bloat the initial bundle
const FactDashboard   = lazy(() => import('./pages/facturacion/FactDashboard'))
const FactPorFacturar = lazy(() => import('./pages/facturacion/FactPorFacturar'))
const FactFacturado   = lazy(() => import('./pages/facturacion/FactFacturado'))
const FactPOs         = lazy(() => import('./pages/facturacion/FactPOs'))
const FactSMPs        = lazy(() => import('./pages/facturacion/FactSMPs'))
const FactPagosSubc   = lazy(() => import('./pages/facturacion/FactPagosSubc'))

// Other heavy pages: lazy-load so xlsx + recharts don't block initial bundle
const CWPage        = lazy(() => import('./pages/CWPage'))
const AnaliticaPage = lazy(() => import('./pages/AnaliticaPage'))
const ReportesPage  = lazy(() => import('./pages/ReportesPage'))
const ConfigPage    = lazy(() => import('./pages/ConfigPage'))
const CatalogoPage  = lazy(() => import('./pages/CatalogoPage'))

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9ca89c', fontSize: 13 }}>
      Cargando…
    </div>
  )
}

class PageErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 13, color: '#c0392b', marginBottom: 16 }}>
            Error al cargar la página. Intenta recargar.
          </div>
          <button
            className="btn bp"
            onClick={() => { this.setState({ err: null }); window.location.reload() }}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Grupos de acceso — definidos en src/config/permissions.js
const { MAT, MAT_RO, MAT_ED, TI: R_TI, TSS: R_TSS, CW: R_CW, ADMIN: R_ADMIN,
        CATALOG: R_CATALOG, MGMT: R_MGMT, ROLLOUT: R_ROLLOUT,
        ANALITICA: R_ANALITICA, MAPA: R_MAPA, MODULOS: R_MODULOS,
        FACTURACION: R_FACTURACION } = ACCESS

function W(page) {
  return <Layout><Suspense fallback={<PageLoader />}>{page}</Suspense></Layout>
}

function RoleHome() {
  const user = useAuthStore(s => s.user)
  if (isFieldRole(user?.role)) return <Navigate to="/rollout/mapa" replace />
  return <Navigate to="/modulos" replace />
}

// After session restoration on refresh, redirect once so each role lands on the right page.
// For field roles (TI/TSS): guard runs on EVERY navigation — they can only be on /rollout/mapa.
function SessionRedirect() {
  const user    = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  const navigate = useNavigate()
  const location = useLocation()
  const done = useRef(false)

  useEffect(() => {
    if (loading || !user) return
    const isLC = isFieldRole(user.role)
    const lcAllowed  = ['/', '/login', '/set-password', '/rollout/mapa']
    const allSkip    = [...lcAllowed, '/modulos']
    if (isLC) {
      // Guard permanente: cualquier ruta fuera de lcAllowed vuelve al mapa
      if (!lcAllowed.includes(location.pathname)) navigate('/rollout/mapa', { replace: true })
    } else if (!done.current) {
      done.current = true
      if (!allSkip.includes(location.pathname)) navigate('/modulos', { replace: true })
    }
  }, [loading, user, location.pathname, navigate])

  return null
}

function AppRoutes() {
  return (
    <>
      <SessionRedirect />
      <Routes>
      <Route path="/login"        element={<LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      <Route path="/" element={
        <ProtectedRoute><Layout><RoleHome /></Layout></ProtectedRoute>
      } />

      <Route path="/modulos" element={
        <ProtectedRoute allowedRoles={R_MODULOS}>
          <Layout><ModuloHomePage /></Layout>
        </ProtectedRoute>
      } />

      {/* ── Módulo Materiales ───────────────────────────────── */}
      <Route path="/materiales" element={
        <ProtectedRoute allowedRoles={MAT_RO}>
          <Layout><MatWrapper /></Layout>
        </ProtectedRoute>
      }>
        <Route index              element={<ProtectedRoute allowedRoles={MAT}><MatDashboard /></ProtectedRoute>} />
        <Route path="inventario"  element={<ProtectedRoute allowedRoles={MAT}><MatInventario /></ProtectedRoute>} />
        <Route path="movimientos" element={<ProtectedRoute allowedRoles={MAT}><MatMovimientos /></ProtectedRoute>} />
        <Route path="sitios"      element={<ProtectedRoute allowedRoles={MAT_RO}><MatSitios /></ProtectedRoute>} />
        <Route path="catalogo"    element={<ProtectedRoute allowedRoles={MAT}><MatCatalogo /></ProtectedRoute>} />
        <Route path="config"      element={<ProtectedRoute allowedRoles={MAT_ED}><MatConfig /></ProtectedRoute>} />
        <Route path="reportes"    element={<ProtectedRoute allowedRoles={MAT}><MatReportes /></ProtectedRoute>} />
        <Route path="hw/dashboard"            element={<ProtectedRoute allowedRoles={MAT}><HwDashboard /></ProtectedRoute>} />
        <Route path="hw/inventario"           element={<ProtectedRoute allowedRoles={MAT}><HwInventario /></ProtectedRoute>} />
        <Route path="hw/movimientos"          element={<ProtectedRoute allowedRoles={MAT}><HwMovimientos /></ProtectedRoute>} />
        <Route path="hw/catalogo"             element={<ProtectedRoute allowedRoles={MAT}><HwCatalogo /></ProtectedRoute>} />
        <Route path="hw/fallas"               element={<ProtectedRoute allowedRoles={MAT}><HwFallas /></ProtectedRoute>} />
        <Route path="hw/fr-config"            element={<ProtectedRoute allowedRoles={R_ADMIN}><HwFrConfig /></ProtectedRoute>} />
        <Route path="hw/despachos-pendientes" element={<ProtectedRoute allowedRoles={MAT_RO}><HwDespachosPendientes /></ProtectedRoute>} />
        <Route path="hw/bodega-nokia"         element={<ProtectedRoute allowedRoles={MAT}><HwBodegaNokia /></ProtectedRoute>} />
        <Route path="hw/log-inversa"          element={<ProtectedRoute allowedRoles={MAT}><HwLogInversa /></ProtectedRoute>} />
      </Route>

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={R_MGMT}><Layout><Dashboard /></Layout></ProtectedRoute>
      } />

      <Route path="/ti" element={
        <ProtectedRoute allowedRoles={R_TI}><Layout><ConsolidadoTI /></Layout></ProtectedRoute>
      } />

      <Route path="/tss" element={
        <ProtectedRoute allowedRoles={R_TSS}><Layout><ConsolidadoTSS /></Layout></ProtectedRoute>
      } />

      <Route path="/cw" element={
        <ProtectedRoute allowedRoles={R_CW}>{W(<CWPage />)}</ProtectedRoute>
      } />

      <Route path="/cw-consolidado" element={
        <ProtectedRoute allowedRoles={R_CW}><Layout><ConsolidadoCW /></Layout></ProtectedRoute>
      } />

      <Route path="/ubicacion" element={<Navigate to="/rollout/mapa" replace />} />

      <Route path="/liquidador" element={
        <ProtectedRoute><Layout><LiquidadorIndexPage /></Layout></ProtectedRoute>
      } />

      <Route path="/liquidador/:id" element={
        <ProtectedRoute><Layout><PageErrorBoundary><LiquidadorPage /></PageErrorBoundary></Layout></ProtectedRoute>
      } />

      <Route path="/gastos" element={
        <ProtectedRoute allowedRoles={R_MGMT}><Layout><GastosPage /></Layout></ProtectedRoute>
      } />

      <Route path="/reportes" element={
        <ProtectedRoute allowedRoles={R_MGMT}>{W(<ReportesPage />)}</ProtectedRoute>
      } />

      <Route path="/analitica" element={<Navigate to="/rollout/analitica" replace />} />

      <Route path="/catalogo" element={
        <ProtectedRoute allowedRoles={R_CATALOG}>{W(<CatalogoPage />)}</ProtectedRoute>
      } />

      {/* ── Panel Admin ────────────────────────────────────── */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={R_ADMIN}>
          <Layout><AdminWrapper /></Layout>
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/admin/usuarios" replace />} />
        <Route path="usuarios"     element={<AdminUsuarios />} />
        <Route path="estadisticas" element={<AdminEstadisticas />} />
        <Route path="ack-glosario" element={<AdminAckGlosario />} />
        <Route path="config"       element={<Suspense fallback={<PageLoader />}><ConfigPage /></Suspense>} />
      </Route>

      <Route path="/config" element={<Navigate to="/admin/config" replace />} />

      {/* ── Módulo Facturación ─────────────────────────────── */}
      <Route path="/facturacion" element={
        <ProtectedRoute allowedRoles={R_FACTURACION}>
          <Layout><FactWrapper /></Layout>
        </ProtectedRoute>
      }>
        <Route index                    element={<FactDashboard />} />
        <Route path="por-facturar"      element={<FactPorFacturar />} />
        <Route path="facturado"         element={<FactFacturado />} />
        <Route path="pos"               element={<FactPOs />} />
        <Route path="smps"              element={<FactSMPs />} />
        <Route path="pagos-subc"        element={<FactPagosSubc />} />
      </Route>

      {/* ── /rollout/analitica ─────────────────────────────── */}
      <Route path="/rollout/analitica" element={
        <ProtectedRoute allowedRoles={R_ANALITICA}>{W(<AnaliticaPage />)}</ProtectedRoute>
      } />

      {/* ── /rollout/mapa — accesible también para TI / TSS / rollout ─── */}
      <Route path="/rollout/mapa" element={
        <ProtectedRoute allowedRoles={R_MAPA}>
          <Layout><MapaSitios /></Layout>
        </ProtectedRoute>
      } />

      {/* ── Módulo Rollout ──────────────────────────────────── */}
      <Route path="/rollout" element={
        <ProtectedRoute allowedRoles={R_ROLLOUT}>
          <Layout><AckWrapper /></Layout>
        </ProtectedRoute>
      }>
        <Route index                  element={<AckDashboard />} />
        <Route path="ack"             element={<AckDashboard />} />
        <Route path="ack/tablas"      element={<AckTablas />} />
        <Route path="ack/sitios"      element={<AckSitios />} />
        <Route path="ack/forecast"    element={<AckForecast />} />
      </Route>

      <Route path="*" element={<RoleHome />} />
    </Routes>
    </>
  )
}

export default function App() {
  const initSession       = useAuthStore(s => s.initSession)
  const loadData          = useAppStore(s => s.loadData)
  const hasPendingSync    = useAppStore(s => s.hasPendingSync)
  const initAppSync       = useAppStore(s => s.initRealtimeSync)
  const loadCatalog       = useCatalogStore(s => s.loadCatalog)
  const loadEmpresaConfig = useEmpresaStore(s => s.loadEmpresaConfig)
  const user              = useAuthStore(s => s.user)
  const loadMat           = useMatStore(s => s.loadAll)
  const loadHw            = useHwStore(s => s.loadAll)
  const loadAck           = useAckStore(s => s.loadAll)
  const loadFact          = useFactStore(s => s.loadAll)

  // Realtime subscriptions (active when logged in)
  const rtStatus = useRealtime()

  // Restore session on mount
  useEffect(() => {
    initSession()
  }, [initSession])

  // Load all stores in parallel once authenticated — starts before any page mounts
  useEffect(() => {
    if (user) {
      loadData()
      loadCatalog()
      loadEmpresaConfig()
      loadMat()
      loadHw()
      loadAck()
      loadFact()
    }
  }, [user, loadData, loadCatalog, loadEmpresaConfig, loadMat, loadHw, loadAck, loadFact])

  // Broadcast channel — notifica a otros dispositivos cuando este hace cambios
  useEffect(() => {
    if (!user) return
    return initAppSync()
  }, [user, initAppSync])

  // Polling de respaldo: recarga cada 60s y al volver a la pestaña
  useEffect(() => {
    if (!user) return
    function onVisible() {
      // Skip reload if there are un-synced local writes in flight — the in-memory
      // state is more current than whatever the DB would return right now.
      // This prevents iOS native-select visibilitychange from clobbering edits.
      if (document.visibilityState === 'visible' && !hasPendingSync()) loadData()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(loadData, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [user, loadData, hasPendingSync])

  // Expose RT status globally so Layout can read it without prop drilling
  useEffect(() => {
    window.__rtStatus = rtStatus
    window.dispatchEvent(new CustomEvent('rt-status', { detail: rtStatus }))
  }, [rtStatus])

  return (
    <>
      <AppRoutes />
      <Toast />
    </>
  )
}
