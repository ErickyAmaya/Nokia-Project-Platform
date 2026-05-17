import { useState, useEffect, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'

const ROLE_COLOR = {
  admin:       '#dc2626',
  coordinador: '#2563eb',
  TI:          '#0891b2',
  TSS:         '#0891b2',
  CW:          '#7c3aed',
  logistica:   '#059669',
  facturacion: '#b45309',
  viewer:      '#6b7280',
}

const ROLE_LABEL = {
  admin:       'Admin',
  coordinador: 'Coordinador',
  TI:          'TI',
  TSS:         'TSS',
  CW:          'CW',
  logistica:   'Logística',
  facturacion: 'Facturación',
  viewer:      'Viewer',
}

async function loadUsers() {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'list' },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.users || []
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function KpiCard({ label, value, color, sub }) {
  return (
    <div className="stat" style={{ borderLeftColor: color, padding: '12px 16px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: .5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: '#09090b', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#617561', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function AdminEstadisticas() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await loadUsers())
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const stats = useMemo(() => {
    const total       = users.length
    const active7d    = users.filter(u => daysSince(u.last_sign_in) !== null && daysSince(u.last_sign_in) <= 7).length
    const active30d   = users.filter(u => daysSince(u.last_sign_in) !== null && daysSince(u.last_sign_in) <= 30).length
    const pending     = users.filter(u => !u.confirmed).length
    const neverSigned = users.filter(u => u.confirmed && !u.last_sign_in).length

    // By role
    const byRole = {}
    for (const u of users) {
      byRole[u.role] = (byRole[u.role] || 0) + 1
    }

    // Recent activity (sorted by last sign in)
    const recent = [...users]
      .filter(u => u.last_sign_in)
      .sort((a, b) => new Date(b.last_sign_in) - new Date(a.last_sign_in))
      .slice(0, 10)

    // Activity donut buckets
    const activityDonut = [
      { name: 'Hoy',          color: '#22c55e', value: users.filter(u => { const d = daysSince(u.last_sign_in); return d !== null && d < 1 }).length },
      { name: 'Esta semana',  color: '#0891b2', value: users.filter(u => { const d = daysSince(u.last_sign_in); return d !== null && d >= 1 && d <= 7 }).length },
      { name: 'Este mes',     color: '#f59e0b', value: users.filter(u => { const d = daysSince(u.last_sign_in); return d !== null && d > 7 && d <= 30 }).length },
      { name: 'Inactivos',    color: '#e5e7eb', value: users.filter(u => { const d = daysSince(u.last_sign_in); return d === null || d > 30 }).length },
    ].filter(s => s.value > 0)

    return { total, active7d, active30d, pending, neverSigned, byRole, recent, activityDonut }
  }, [users])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c', fontSize: 13 }}>
      Cargando estadísticas…
    </div>
  )

  const maxRole = Math.max(...Object.values(stats.byRole), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <KpiCard label="Total usuarios"    value={stats.total}       color="#144E4A" />
        <KpiCard label="Activos 7 días"    value={stats.active7d}    color="#22c55e" sub="últimos 7 días" />
        <KpiCard label="Activos 30 días"   value={stats.active30d}   color="#0891b2" sub="últimos 30 días" />
        <KpiCard label="Invites pendientes" value={stats.pending}    color="#f59e0b" sub="sin confirmar" />
        <KpiCard label="Sin acceso"        value={stats.neverSigned} color="#9ca3af" sub="nunca ingresaron" />
      </div>

      {/* Distribución por rol + Donut actividad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        {/* Roles */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-h"><h2>Distribución por rol</h2></div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(stats.byRole)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => {
                const color = ROLE_COLOR[role] || '#6b7280'
                const pct   = Math.round((count / maxRole) * 100)
                return (
                  <div key={role}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color }}>{ROLE_LABEL[role] || role}</span>
                      <span style={{ color: '#4b5563' }}>{count} usuario{count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>

        {/* Donut actividad */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-h"><h2>Estado de actividad</h2></div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {stats.activityDonut.length === 0 ? (
              <div style={{ color: '#9ca89c', fontSize: 12, padding: '24px 0' }}>Sin datos de acceso aún.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stats.activityDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {stats.activityDonut.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} usuario${val !== 1 ? 's' : ''}`, name]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e0e4e0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Leyenda */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', justifyContent: 'center' }}>
                  {stats.activityDonut.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: '#374151', fontWeight: 600 }}>{s.name}</span>
                      <span style={{ color: '#9ca3af' }}>({s.value})</span>
                    </div>
                  ))}
                </div>

                {/* Total en el centro — label superpuesto */}
                <div style={{ fontSize: 10, color: '#617561', textAlign: 'center' }}>
                  {stats.total} usuarios en total
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="card">
        <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Actividad reciente</h2>
          <span style={{ fontSize: 10, color: '#9ca89c' }}>Últimos 10 accesos</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {stats.recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: '#9ca89c', fontSize: 12 }}>
              Sin registros de acceso aún.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8faf8' }}>
                  {['Usuario', 'Email', 'Rol', 'Último acceso', 'Hace'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, borderBottom: '1px solid #e8eae8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((u, i) => {
                  const dias      = daysSince(u.last_sign_in)
                  const roleColor = ROLE_COLOR[u.role] || '#6b7280'
                  const fechaStr  = new Date(u.last_sign_in).toLocaleString('es-CO', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                  const hace = dias === 0 ? 'Hoy'
                    : dias === 1 ? 'Ayer'
                    : `Hace ${dias} días`

                  return (
                    <tr key={u.user_id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#09090b' }}>{u.nombre || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: 11 }}>{u.email || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          color: roleColor, background: `${roleColor}15`,
                        }}>
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#617561', fontSize: 11, whiteSpace: 'nowrap' }}>{fechaStr}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          color: dias === 0 ? '#166534' : dias <= 7 ? '#1d4ed8' : '#6b7280',
                          background: dias === 0 ? '#dcfce7' : dias <= 7 ? '#dbeafe' : '#f3f4f6',
                        }}>
                          {hace}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Usuarios inactivos / sin acceso */}
      {users.filter(u => u.confirmed && !u.last_sign_in).length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Usuarios confirmados sin acceso</h2></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8faf8' }}>
                  {['Usuario', 'Email', 'Rol'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, borderBottom: '1px solid #e8eae8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.confirmed && !u.last_sign_in).map((u, i) => (
                  <tr key={u.user_id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#09090b' }}>{u.nombre || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#4b5563', fontSize: 11 }}>{u.email || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        color: ROLE_COLOR[u.role] || '#6b7280',
                        background: `${ROLE_COLOR[u.role] || '#6b7280'}15`,
                      }}>
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
