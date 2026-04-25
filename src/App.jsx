import { useEffect, lazy, Suspense, Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAppStore }  from './store/useAppStore'
import { useRealtime }  from './hooks/useRealtime'
import ProtectedRoute   from './components/ProtectedRoute'
import Layout           from './components/Layout'
import Toast            from './components/Toast'
import LoginPage        from './pages/LoginPage'
import Dashboard        from './pages/Dashboard'
import ConsolidadoTI    from './pages/ConsolidadoTI'
import ConsolidadoTSS   from './pages/ConsolidadoTSS'
import ConsolidadoCW    from './pages/ConsolidadoCW'
import GastosPage       from './pages/GastosPage'
import LiquidadorPage   from './pages/LiquidadorPage'
import LiquidadorIndexPage from './pages/LiquidadorIndexPage'
import ModuloHomePage      from './pages/ModuloHomePage'
import MatWrapper         from './pages/materiales/MatWrapper'
import MatDashboard       from './pages/materiales/MatDashboard'
import MatInventario      from './pages/materiales/MatInventario'
import MatMovimientos     from './pages/materiales/MatMovimientos'
import MatSitios          from './pages/materiales/MatSitios'
import MatCatalogo        from './pages/materiales/MatCatalogo'
import MatConfig          from './pages/materiales/MatConfig'
import HwInventario       from './pages/materiales/HwInventario'
import HwMovimientos      from './pages/materiales/HwMovimientos'
import HwCatalogo         from './pages/materiales/HwCatalogo'
import MatReportes        from './pages/materiales/MatReportes'
import AckWrapper         from './pages/rollout/AckWrapper'
import AckDashboard       from './pages/rollout/AckDashboard'
import AckTablas          from './pages/rollout/AckTablas'

// Heavy pages: lazy-load so xlsx + recharts don't block initial bundle
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
  const user   = useAuthStore(s => s.user)
  const role   = user?.role
  const modulo = user?.modulo

  // Multi-módulo → selector de módulos
  if (modulo === 'all')        return <Navigate to="/modulos"    replace />
  // Módulo materiales directo
  if (modulo === 'materiales') return <Navigate to="/materiales" replace />

  // Billing: redirigir según rol
  if (role === 'TI')        return <Navigate to="/ti"             replace />
  if (role === 'TSS')       return <Navigate to="/tss"            replace />
  if (role === 'CW')        return <Navigate to="/cw-consolidado" replace />
  if (role === 'logistica') return <Navigate to="/materiales"     replace />
  return <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={
        <ProtectedRoute><Layout><RoleHome /></Layout></ProtectedRoute>
      } />

      <Route path="/modulos" element={
        <ProtectedRoute allowedRoles={['admin','coordinador']}>
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
        <Route path="movimientos" element={<ProtectedRoute allowedRoles={R_MAT_ED}><MatMovimientos /></ProtectedRoute>} />
        <Route path="sitios"      element={<ProtectedRoute allowedRoles={R_MAT_ED}><MatSitios /></ProtectedRoute>} />
        <Route path="catalogo"    element={<ProtectedRoute allowedRoles={R_MAT_ED}><MatCatalogo /></ProtectedRoute>} />
        <Route path="config"      element={<ProtectedRoute allowedRoles={['admin','coordinador','logistica']}><MatConfig /></ProtectedRoute>} />
        <Route path="reportes"    element={<ProtectedRoute allowedRoles={R_MAT_ED}><MatReportes /></ProtectedRoute>} />
        <Route path="hw/inventario"  element={<ProtectedRoute allowedRoles={R_MAT_ED}><HwInventario /></ProtectedRoute>} />
        <Route path="hw/movimientos" element={<ProtectedRoute allowedRoles={R_MAT_ED}><HwMovimientos /></ProtectedRoute>} />
        <Route path="hw/catalogo"    element={<ProtectedRoute allowedRoles={R_MAT_ED}><HwCatalogo /></ProtectedRoute>} />
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

      <Route path="/config" element={
        <ProtectedRoute allowedRoles={R_ADMIN}>{W(<ConfigPage />)}</ProtectedRoute>
      } />

      {/* ── Módulo Rollout ──────────────────────────────────── */}
      <Route path="/rollout" element={
        <ProtectedRoute allowedRoles={R_MGMT}>
          <Layout><AckWrapper /></Layout>
        </ProtectedRoute>
      }>
        <Route index              element={<AckDashboard />} />
        <Route path="ack"         element={<AckDashboard />} />
        <Route path="ack/tablas"  element={<AckTablas />} />
      </Route>

      <Route path="*" element={<RoleHome />} />
    </Routes>
  )
}

export default function App() {
  const initSession       = useAuthStore(s => s.initSession)
  const loadData          = useAppStore(s => s.loadData)
  const loadEmpresaConfig = useAppStore(s => s.loadEmpresaConfig)
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
