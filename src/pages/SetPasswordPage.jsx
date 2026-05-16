import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { initSupabaseClient, getSupabaseClient } from '../lib/supabase'
import { getEmpresaByDomain } from '../config/empresas'

const LS_DOMAIN_KEY = 'npp_empresa_domain'

export default function SetPasswordPage() {
  const navigate = useNavigate()

  const [ready,    setReady]    = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    // Get empresa domain from query param (set by the invite redirectTo URL)
    const params = new URLSearchParams(window.location.search)
    const domain = params.get('empresa') || 'ingetel.com'
    const empresa = getEmpresaByDomain(domain)

    if (!empresa) {
      setError('Enlace de invitación inválido. Contacta al administrador.')
      return
    }

    // Initialize Supabase — this processes the hash token from the invite link
    const client = initSupabaseClient(empresa.supabaseUrl, empresa.supabaseKey)

    // Listen for the sign-in triggered by the invite hash
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        localStorage.setItem(LS_DOMAIN_KEY, domain)
        setReady(true)
      }
    })

    // Also check if session already exists (SDK may have processed hash synchronously)
    client.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem(LS_DOMAIN_KEY, domain)
        setReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSaving(true)
    try {
      const client = getSupabaseClient()
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setTimeout(() => navigate('/modulos', { replace: true }), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100svh', background: '#f0f2f0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 36,
        width: '100%', maxWidth: 400,
        boxShadow: '0 4px 24px rgba(0,0,0,.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔐</div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#09090b' }}>
            Establece tu contraseña
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
            Crea una contraseña segura para acceder a la plataforma.
          </p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: 15, marginBottom: 6 }}>¡Contraseña establecida!</div>
            <div style={{ fontSize: 12, color: '#617561' }}>Redirigiendo a la plataforma…</div>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca89c', fontSize: 13 }}>
            {error
              ? <span style={{ color: '#ef4444' }}>{error}</span>
              : 'Verificando enlace de invitación…'
            }
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Nueva contraseña
              </label>
              <input
                className="fc"
                type="password"
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
                autoFocus
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Confirmar contraseña
              </label>
              <input
                className="fc"
                type="password"
                required
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 4, padding: '11px', borderRadius: 10, border: 'none',
                background: saving ? '#9ca3af' : '#144E4A', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5,
              }}
            >
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
