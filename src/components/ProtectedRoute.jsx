import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

/**
 * ProtectedRoute
 *
 * Props:
 *   children     — elemento a renderizar si pasa el guard
 *   allowedRoles — array de roles permitidos, ej. ['admin','coordinador','TI']
 *                  Si se omite, cualquier usuario autenticado puede acceder.
 *
 * Flujo:
 *   1. loading → spinner de pantalla completa
 *   2. sin sesión → /login
 *   3. rol no permitido → /dashboard
 *   4. ok → renderiza children
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const user    = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#f0f2f0', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #e0e4e0', borderTopColor: '#1a9c1a',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 12, color: '#9ca89c', fontWeight: 600, letterSpacing: .6 }}>
          CARGANDO…
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const roleHome = { TI: '/ti', TSS: '/tss', CW: '/cw-consolidado' }
    return <Navigate to={roleHome[user.role] || '/dashboard'} replace />
  }

  return children
}
