import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { getDomainFromEmail } from '../../config/empresas'

const ROLES = [
  { value: 'admin',       label: 'Admin'       },
  { value: 'coordinador', label: 'Coordinador' },
  { value: 'TI',          label: 'TI'          },
  { value: 'TSS',         label: 'TSS'         },
  { value: 'CW',          label: 'CW'          },
  { value: 'logistica',   label: 'Logística'   },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'rollout',     label: 'Rollout'     },
  { value: 'viewer',      label: 'Viewer'      },
]

const MODULOS_LIST = [
  { value: 'billing',     label: 'Liquidador'  },
  { value: 'materiales',  label: 'Materiales'  },
  { value: 'rollout',     label: 'ACK'         },
  { value: 'facturacion', label: 'Facturación' },
]

const ROLE_COLOR = {
  admin:       '#dc2626',
  coordinador: '#2563eb',
  TI:          '#0891b2',
  TSS:         '#0891b2',
  CW:          '#7c3aed',
  logistica:   '#059669',
  facturacion: '#b45309',
  rollout:     '#7c3aed',
  viewer:      '#6b7280',
}

async function callAdminFn(action, body = {}) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...body },
  })
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

function InviteModal({ onClose, onSuccess, empresaDomain }) {
  const [form, setForm]     = useState({ email: '', nombre: '', role: 'viewer' })
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email.trim() || !form.nombre.trim()) return
    setSaving(true)
    try {
      const redirectTo = `${window.location.origin}/set-password`
      await callAdminFn('invite', {
        email:      form.email.trim().toLowerCase(),
        nombre:     form.nombre.trim(),
        role:       form.role,
        modulo:     form.modulo,
        redirectTo,
      })
      showToast(`Invitación enviada a ${form.email}`)
      onSuccess()
    } catch (err) {
      showToast('Error: ' + err.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>Invitar usuario</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#4b5563', lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Email *</label>
            <input
              className="fc"
              type="email"
              required
              placeholder="usuario@empresa.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Nombre completo *</label>
            <input
              className="fc"
              type="text"
              required
              placeholder="Juan Pérez"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Rol *</label>
            <select
              className="fc"
              value={form.role}
              onChange={e => set('role', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 10, color: '#6b7280', background: '#f9fafb', borderRadius: 8, padding: '8px 12px', lineHeight: 1.6 }}>
            Se enviará un correo de invitación. El usuario deberá hacer clic en el link para establecer su contraseña.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: saving ? '#9ca3af' : '#144E4A', color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12,
                fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5,
              }}
            >
              {saving ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminUsuarios() {
  const currentUser = useAuthStore(s => s.user)

  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [savingId,   setSavingId]   = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const empresaDomain = getDomainFromEmail(currentUser?.email) || 'ingetel.com'

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await callAdminFn('list')
      setUsers(data.users || [])
    } catch (err) {
      showToast('Error cargando usuarios: ' + err.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleFieldChange(userId, field, value) {
    setSavingId(userId)
    try {
      await callAdminFn('update-role', { userId, [field]: value })
      setUsers(us => us.map(u => u.user_id === userId ? { ...u, [field]: value } : u))
    } catch (err) {
      showToast('Error: ' + err.message, 'err')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(userId, nombre) {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(userId)
    try {
      await callAdminFn('delete', { userId })
      setUsers(us => us.filter(u => u.user_id !== userId))
      showToast('Usuario eliminado')
    } catch (err) {
      showToast('Error: ' + err.message, 'err')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); loadUsers() }}
          empresaDomain={empresaDomain}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>Usuarios</h2>
              {!loading && (
                <div style={{ fontSize: 11, color: '#617561', marginTop: 2 }}>
                  {users.length} usuario{users.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowInvite(true)}
              style={{
                background: '#144E4A', color: '#fff', border: 'none', borderRadius: 8,
                padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5,
              }}
            >
              + Invitar usuario
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c', fontSize: 13 }}>
              Cargando usuarios…
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c', fontSize: 13 }}>
              Sin usuarios registrados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8faf8' }}>
                    {['Usuario', 'Email', 'Rol', 'Último acceso', 'Estado', ''].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, borderBottom: '1px solid #e8eae8', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isMe      = u.user_id === currentUser?.id
                    const isSaving  = savingId === u.user_id
                    const isDeleting = deletingId === u.user_id
                    const roleColor = ROLE_COLOR[u.role] || '#6b7280'
                    const initial   = (u.nombre || u.email || '?')[0].toUpperCase()
                    const lastSign  = u.last_sign_in
                      ? new Date(u.last_sign_in).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'

                    return (
                      <tr key={u.user_id} style={{ borderTop: '1px solid #f0f0f0', background: isMe ? '#f0fdf4' : undefined, opacity: isDeleting ? .5 : 1, transition: 'opacity .2s' }}>

                        {/* Usuario */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              background: `${roleColor}18`, border: `1.5px solid ${roleColor}35`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700, color: roleColor,
                            }}>
                              {initial}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#09090b', fontSize: 12, whiteSpace: 'nowrap' }}>{u.nombre || '—'}</div>
                              {isMe && <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 700 }}>● Tú</div>}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: 11, whiteSpace: 'nowrap' }}>{u.email || '—'}</td>

                        {/* Rol */}
                        <td style={{ padding: '10px 14px' }}>
                          <select
                            className="fc"
                            value={u.role}
                            disabled={isMe || isSaving}
                            onChange={e => handleFieldChange(u.user_id, 'role', e.target.value)}
                            style={{
                              fontSize: 11, padding: '3px 6px', fontWeight: 700,
                              color: roleColor, borderColor: `${roleColor}35`,
                              background: `${roleColor}08`,
                              cursor: isMe ? 'not-allowed' : 'pointer',
                              opacity: isSaving ? .6 : 1,
                            }}
                          >
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </td>

                        {/* Último acceso */}
                        <td style={{ padding: '10px 14px', color: '#617561', fontSize: 11, whiteSpace: 'nowrap' }}>{lastSign}</td>

                        {/* Estado */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {u.confirmed
                            ? <span style={{ fontSize: 9, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 6, padding: '2px 8px' }}>✓ Activo</span>
                            : <span style={{ fontSize: 9, fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 6, padding: '2px 8px' }}>⏳ Pendiente</span>
                          }
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDelete(u.user_id, u.nombre || u.email)}
                            disabled={isMe || isDeleting}
                            title={isMe ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                            style={{
                              background: 'none', border: '1px solid #fecaca', borderRadius: 6,
                              color: '#ef4444', fontSize: 11, padding: '3px 10px',
                              cursor: isMe ? 'not-allowed' : 'pointer',
                              opacity: isMe ? .35 : 1,
                            }}
                          >
                            {isDeleting ? '…' : 'Eliminar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Card Roles y Permisos ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-h">
            <h2 style={{ margin: 0 }}>Roles y Permisos</h2>
            <div style={{ fontSize: 11, color: '#617561', marginTop: 2 }}>Referencia de accesos por rol</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f8faf8' }}>
                  {['Módulo / Acción', 'Admin', 'Coordinador', 'Facturación', 'Logística', 'TI', 'TSS', 'CW', 'Viewer'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Módulo / Acción' ? 'left' : 'center', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, borderBottom: '1px solid #e8eae8', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { modulo: 'Dashboard General',       admin:true,  coord:true,  fact:false, log:false, ti:false,  tss:false, cw:false,  viewer:true  },
                  { modulo: 'Analítica',               admin:true,  coord:true,  fact:false, log:false, ti:true,   tss:true,  cw:true,   viewer:true  },
                  { modulo: 'Facturación',             admin:true,  coord:true,  fact:true,  log:false, ti:false,  tss:false, cw:false,  viewer:true  },
                  { modulo: 'Materiales — ver',        admin:true,  coord:true,  fact:false, log:true,  ti:false,  tss:false, cw:false,  viewer:true  },
                  { modulo: 'Materiales — editar',     admin:true,  coord:true,  fact:false, log:true,  ti:false,  tss:false, cw:false,  viewer:false },
                  { modulo: 'HW Nokia — Carga',        admin:true,  coord:true,  fact:false, log:true,  ti:false,  tss:false, cw:false,  viewer:false },
                  { modulo: 'HW FR Config',            admin:true,  coord:false, fact:false, log:false, ti:false,  tss:false, cw:false,  viewer:false },
                  { modulo: 'Consolidado TI',          admin:true,  coord:true,  fact:false, log:false, ti:true,   tss:false, cw:false,  viewer:true  },
                  { modulo: 'Consolidado TSS',         admin:true,  coord:true,  fact:false, log:false, ti:false,  tss:true,  cw:false,  viewer:true  },
                  { modulo: 'Consolidado CW',          admin:true,  coord:true,  fact:false, log:false, ti:false,  tss:false, cw:true,   viewer:true  },
                  { modulo: 'Catálogo',                admin:true,  coord:true,  fact:false, log:false, ti:false,  tss:false, cw:false,  viewer:false },
                  { modulo: 'Admin — Usuarios',        admin:true,  coord:false, fact:false, log:false, ti:false,  tss:false, cw:false,  viewer:false },
                ].map((row, i) => (
                  <tr key={row.modulo} style={{ background: i % 2 === 0 ? '#fff' : '#f8faf8', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#264D4A', whiteSpace: 'nowrap' }}>{row.modulo}</td>
                    {[row.admin, row.coord, row.fact, row.log, row.ti, row.tss, row.cw, row.viewer].map((tiene, j) => (
                      <td key={j} style={{ textAlign: 'center', padding: '8px 12px' }}>
                        {tiene
                          ? <span style={{ color: '#166534', fontSize: 14 }}>✓</span>
                          : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
