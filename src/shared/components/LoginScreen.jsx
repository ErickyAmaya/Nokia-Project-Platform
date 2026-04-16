import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getEmpresaByDomain, getDomainFromEmail } from '../../config/empresas'

// ── LoginScreen ───────────────────────────────────────────────────
// Detecta la empresa por dominio del email mientras el usuario escribe.
// Muestra branding de la empresa cuando el dominio es reconocido.
export default function LoginScreen() {
  const login    = useAuthStore(s => s.login)
  const loading  = useAuthStore(s => s.loading)
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [empresa,  setEmpresa]  = useState(null)   // empresa detectada en vivo
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  // Detección de empresa en tiempo real
  useEffect(() => {
    const domain = getDomainFromEmail(email)
    setEmpresa(domain ? getEmpresaByDomain(domain) : null)
  }, [email])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  const CN = empresa?.color || '#144E4A'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4f0 0%, #e8f0e8 100%)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: '#fff',
        borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}>

        {/* Header con branding dinámico */}
        <div style={{
          background: CN,
          padding: '28px 32px 24px',
          transition: 'background 0.3s ease',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, marginBottom: 6 }}>
            NOKIA PROJECT PLATFORM
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>
            {empresa ? empresa.nombre : 'INGETEL'}
          </div>
          {empresa && (
            <div style={{
              marginTop: 8, display: 'inline-block',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '2px 10px',
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.9)',
              letterSpacing: 1,
            }}>
              {empresa.nombre_corto} detectado
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              autoFocus
              required
              style={inputStyle(CN)}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle(CN)}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, fontSize: 12, color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          {!empresa && email.includes('@') && email.split('@')[1]?.length > 2 && (
            <div style={{
              marginBottom: 16, padding: '10px 14px',
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 8, fontSize: 12, color: '#92400e',
            }}>
              El dominio <strong>@{getDomainFromEmail(email)}</strong> no está registrado en la plataforma
            </div>
          )}

          <button
            type="submit"
            disabled={busy || loading || !empresa}
            style={{
              width: '100%', padding: '12px 0',
              background: empresa ? CN : '#9ca3af',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: empresa ? 'pointer' : 'not-allowed',
              transition: 'background 0.3s ease, opacity 0.2s',
              opacity: (busy || loading) ? 0.7 : 1,
            }}
          >
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5,
}

function inputStyle(accentColor) {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: 13, color: '#111827',
    outline: 'none', transition: 'border-color 0.2s',
    fontFamily: 'inherit',
    // focus handled via CSS; accentColor passed for potential use
  }
}
