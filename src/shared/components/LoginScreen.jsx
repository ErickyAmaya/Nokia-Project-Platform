import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getEmpresaByDomain, getDomainFromEmail } from '../../config/empresas'
import { initSupabaseClient } from '../../lib/supabase'

// ── LoginScreen ───────────────────────────────────────────────────
// Detecta la empresa por dominio del email mientras el usuario escribe.
// Muestra branding de la empresa cuando el dominio es reconocido.
export default function LoginScreen() {
  const login    = useAuthStore(s => s.login)
  const loading  = useAuthStore(s => s.loading)
  const navigate = useNavigate()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [empresa,    setEmpresa]    = useState(null)
  const [error,      setError]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [view,       setView]       = useState('login') // 'login' | 'forgot' | 'sent'
  const [resetBusy,  setResetBusy]  = useState(false)
  const [resetError, setResetError] = useState('')

  // Detección de empresa en tiempo real — dominios desconocidos caen a Ingetel
  useEffect(() => {
    const domain = getDomainFromEmail(email)
    setEmpresa(domain ? (getEmpresaByDomain(domain) ?? getEmpresaByDomain('ingetel.com')) : null)
  }, [email])

  async function handleReset(e) {
    e.preventDefault()
    if (!empresa) return
    setResetBusy(true)
    setResetError('')
    try {
      const domain = getDomainFromEmail(email)
      const client = initSupabaseClient(empresa.supabaseUrl, empresa.supabaseKey)
      const redirectTo = `${window.location.origin}/set-password?empresa=${domain}`
      const { error: err } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      if (err) throw err
      setView('sent')
    } catch (err) {
      setResetError(err.message)
    } finally {
      setResetBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
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
      fontFamily: "'Barlow', 'Segoe UI', sans-serif",
    }}>
      <div className="login-card" style={{
        width: '100%', maxWidth: 400, background: '#fff',
        borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}>

        {/* ── Header con branding dinámico ── */}
        <div style={{
          background: CN,
          padding: '24px 28px 20px',
          transition: 'background 0.3s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, marginBottom: 5 }}>
              NOKIA PROJECT PLATFORM
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: 0.5,
              lineHeight: 1, marginBottom: empresa ? 8 : 0,
            }}>
              {empresa ? empresa.nombre : 'Iniciar Sesión'}
            </div>
            {empresa && (
              <div style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 20, padding: '2px 10px',
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                {empresa.nombre_corto} detectado
              </div>
            )}
          </div>

          {/* Logo empresa */}
          {empresa?.logoUrl && (
            <div style={{
              flexShrink: 0,
              background: '#fff',
              borderRadius: 10,
              padding: '6px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              maxWidth: 120,
            }}>
              <img
                src={empresa.logoUrl}
                alt={empresa.nombre}
                style={{ height: 44, width: 'auto', display: 'block', objectFit: 'contain' }}
              />
            </div>
          )}
        </div>

        {/* ── Form ── */}
        <div style={{ padding: '24px 28px 20px' }}>

          {/* Vista: enviado */}
          {view === 'sent' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#09090b', marginBottom: 6 }}>Correo enviado</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 20 }}>
                Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue el link para restablecer tu contraseña.
              </div>
              <button
                onClick={() => setView('login')}
                style={{ fontSize: 12, color: CN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                ← Volver al login
              </button>
            </div>

          /* Vista: olvidé contraseña */
          ) : view === 'forgot' ? (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#09090b', marginBottom: 4 }}>Restablecer contraseña</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
                  Ingresa tu email y te enviaremos un link para crear una nueva contraseña.
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  autoFocus
                  required
                  style={inputStyle}
                />
              </div>
              {resetError && (
                <div style={{ marginBottom: 14, padding: '9px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
                  {resetError}
                </div>
              )}
              {!empresa && email.includes('@') && email.split('@')[1]?.length > 2 && (
                <div style={{ marginBottom: 14, padding: '9px 13px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                  El dominio <strong>@{getDomainFromEmail(email)}</strong> no está registrado
                </div>
              )}
              <button
                type="submit"
                disabled={resetBusy || !empresa}
                style={{
                  width: '100%', padding: '12px 0',
                  background: empresa ? CN : '#9ca3af',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, cursor: empresa ? 'pointer' : 'not-allowed',
                  opacity: resetBusy ? 0.7 : 1,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, marginBottom: 14,
                }}
              >
                {resetBusy ? 'Enviando…' : 'Enviar link'}
              </button>
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setView('login'); setResetError('') }}
                  style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ← Volver al login
                </button>
              </div>
            </form>

          /* Vista: login normal */
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  autoFocus
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError('') }}
                  style={{ fontSize: 11, color: CN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              {error && (
                <div style={{ marginBottom: 14, padding: '9px 13px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy || loading}
                style={{
                  width: '100%', padding: '12px 0',
                  background: CN,
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.3s ease, opacity 0.2s',
                  opacity: (busy || loading) ? 0.7 : 1,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1,
                }}
              >
                {busy ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
          )}
        </div>

        {/* ── Footer "Diseñado por Scytel" ── */}
        <div style={{
          borderTop: '1px solid #f0f0f0',
          padding: '10px 28px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
        }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', letterSpacing: .5, textTransform: 'uppercase' }}>
            Diseñado por
          </span>
          <img
            src="https://tvlskyihhxfnxfgifilk.supabase.co/storage/v1/object/public/logos/SCYTEL%20solologo.png"
            alt="Scytel"
            style={{ height: 16, width: 'auto', display: 'block', objectFit: 'contain' }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#1a4f7a', letterSpacing: 1, fontFamily: "'Barlow Condensed', sans-serif" }}>
            SCYTEL
          </span>
        </div>

      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', marginBottom: 5,
  fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: .5, textTransform: 'uppercase',
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', border: '1.5px solid #e5e7eb',
  borderRadius: 8, fontSize: 13, color: '#111827',
  outline: 'none', fontFamily: 'inherit',
}
