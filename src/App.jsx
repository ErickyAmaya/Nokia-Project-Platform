import { useEffect, useRef, lazy, Suspense, Component } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAppStore }  from './store/useAppStore'
import { useRealtime }  from './hooks/useRealtime'
import ProtectedRoute   from './components/ProtectedRoute'
import Layout           from './components/Layout'
import Toast            from './components/Toast'
import LoginPage        from './pages/LoginPage'
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
import MatReportes        from './pages/materiales/MatReportes'
import AckWrapper         from './pages/rollout/AckWrapper'
import AckDashboard       from './pages/rollout/AckDashboard'
import AckTablas          from './pages/rollout/AckTablas'
import AckSitios          from './pages/rollout/AckSitios'
import AckForecast        from './pages/rollout/AckForecast'
import FactWrapper from './pages/facturacion/FactWrapper'

// Fact pages: lazy-load so they don't bloat the initial bundle
const FactDashboard   = lazy(() => import('./pages/facturacion/FactDashboard'))
const FactPorFacturar = lazy(() => import('./pages/facturacion/FactPorFacturar'))
const FactFacturado   = lazy(() => import('./pages/facturacion/FactFacturado'))
const FactPOs         = lazy(() => import('./pages/facturacion/FactPOs'))
const FactSMPs        = lazy(() => import('./pages/facturacion/FactSMPs'))
const FactSitios      = lazy(() => import('./pages/facturacion/FactSitios'))
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

// Roles por módulo
const R_MAT     = ['admin', 'coordinador', 'logistica', 'viewer']
const R_MAT_ED  = ['admin', 'coordinador', 'logistica']
const R_TI      = ['admin', 'coordinador', 'TI',  'viewer']
const R_TSS     = ['admin', 'coordinador', 'TSS', 'viewer']
const R_CW      = ['admin', 'coordinador', 'CW',  'viewer']
const R_ADMIN    = ['admin']
const R_CATALOG  = ['admin', 'coordinador']
const R_MGMT     = ['admin', 'coordinador', 'viewer']
const R_ANALITICA = ['admin', 'coordinador', 'viewer', 'TI', 'TSS', 'CW']

function W(page) {
  return <Layout><Suspense fallback={<PageLoader />}>{page}</Suspense></Layout>
}

function RoleHome() {
  return <Navigate to="/modulos" replace />
}

// After session restoration on refresh, redirect to /modulos once so all roles
// land on the module home instead of staying on whatever URL was cached.
function SessionRedirect() {
  const user    = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  const navigate = useNavigate()
  const location = useLocation()
  const done = useRef(false)

  useEffect(() => {
    if (!loading && user && !done.current) {
      done.current = true
      const skip = ['/', '/login', '/modulos']
      if (!skip.includes(location.pathname)) {
        navigate('/modulos', { replace: true })
      }
    }
  }, [loading, user, navigate, location.pathname])

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
        <ProtectedRoute>
          <Layout><ModuloHomePage /></Layout>
        </ProtectedRoute>
      } />

      {/* ── Módulo Materiales ───────────────────────────────── */}
      <Route path="/materiales" element={
        <ProtectedRoute allowedRoles={R_MAT}>
          <Layout><MatWrapper /></Layout>
        </ProtectedRoute>
      }>
        <Route index              element={<MatDashboard />} />
        <Route path="inventario"  element={<MatInventario />} />
        <Route path="movimientos" element={<ProtectedRoute allowedRoles={R_MAT}><MatMovimientos /></ProtectedRoute>} />
        <Route path="sitios"      element={<ProtectedRoute allowedRoles={R_MAT}><MatSitios /></ProtectedRoute>} />
        <Route path="catalogo"    element={<ProtectedRoute allowedRoles={R_MAT}><MatCatalogo /></ProtectedRoute>} />
        <Route path="config"      element={<ProtectedRoute allowedRoles={['admin','coordinador','logistica']}><MatConfig /></ProtectedRoute>} />
        <Route path="reportes"    element={<ProtectedRoute allowedRoles={R_MAT}><MatReportes /></ProtectedRoute>} />
        <Route path="hw/dashboard"   element={<ProtectedRoute allowedRoles={R_MAT}><HwDashboard /></ProtectedRoute>} />
        <Route path="hw/inventario"  element={<ProtectedRoute allowedRoles={R_MAT}><HwInventario /></ProtectedRoute>} />
        <Route path="hw/movimientos" element={<ProtectedRoute allowedRoles={R_MAT}><HwMovimientos /></ProtectedRoute>} />
        <Route path="hw/catalogo"    element={<ProtectedRoute allowedRoles={R_MAT}><HwCatalogo /></ProtectedRoute>} />
        <Route path="hw/fallas"               element={<ProtectedRoute allowedRoles={R_MAT}><HwFallas /></ProtectedRoute>} />
        <Route path="hw/fr-config"           element={<ProtectedRoute allowedRoles={['admin']}><HwFrConfig /></ProtectedRoute>} />
        <Route path="hw/despachos-pendientes" element={<ProtectedRoute allowedRoles={R_MAT}><HwDespachosPendientes /></ProtectedRoute>} />
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

      <Route path="/analitica" element={
        <ProtectedRoute allowedRoles={R_ANALITICA}>{W(<AnaliticaPage />)}</ProtectedRoute>
      } />

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
        <Route path="config"       element={<Suspense fallback={<PageLoader />}><ConfigPage /></Suspense>} />
      </Route>

      <Route path="/config" element={<Navigate to="/admin/config" replace />} />

      {/* ── Módulo Facturación ─────────────────────────────── */}
      <Route path="/facturacion" element={
        <ProtectedRoute allowedRoles={['admin','coordinador','facturacion','viewer']}>
          <Layout><FactWrapper /></Layout>
        </ProtectedRoute>
      }>
        <Route index                    element={<FactDashboard />} />
        <Route path="por-facturar"      element={<FactPorFacturar />} />
        <Route path="facturado"         element={<FactFacturado />} />
        <Route path="sitios"            element={<FactSitios />} />
        <Route path="pos"               element={<FactPOs />} />
        <Route path="smps"              element={<FactSMPs />} />
        <Route path="pagos-subc"        element={<FactPagosSubc />} />
      </Route>

      {/* ── Módulo Rollout ──────────────────────────────────── */}
      <Route path="/rollout" element={
        <ProtectedRoute allowedRoles={R_MGMT}>
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
  const loadEmpresaConfig = useAppStore(s => s.loadEmpresaConfig)
  const initAppSync       = useAppStore(s => s.initRealtimeSync)
  const user              = useAuthStore(s => s.user)

  // Realtime subscriptions (active when logged in)
  const rtStatus = useRealtime()

  // Restore session on mount
  useEffect(() => {
    initSession()
  }, [initSession])

  // Load data once authenticated
  useEffect(() => {
    if (user) {
      loadData()
      loadEmpresaConfig()
    }
  }, [user, loadData, loadEmpresaConfig])

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
