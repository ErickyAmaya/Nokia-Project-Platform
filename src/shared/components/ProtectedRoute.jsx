import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/**
 * ProtectedRoute
 *
 * Props:
 *   children     — elemento a renderizar si pasa el guard
 *   allowedRoles — array de roles permitidos (ej. ['admin','coordinador','TI'])
 *                  Si se omite, cualquier usuario autenticado puede acceder.
 *
 * Flujo:
 *   1. loading → nada (esperar)
 *   2. sin sesión → redirige a /login
 *   3. rol no permitido → redirige a /dashboard
 *   4. ok → renderiza children
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuthStore()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
