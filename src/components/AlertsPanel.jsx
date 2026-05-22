import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlertsStore } from '../store/useAlertsStore'
import { useAuthStore } from '../store/authStore'

const MODULE_META = {
  facturacion: { label: 'Facturación', color: '#3b82f6' },
  materiales:  { label: 'Materiales',  color: '#10b981' },
  hardware:    { label: 'Hardware',    color: '#8b5cf6' },
  rollout:     { label: 'Rollout ACK', color: '#f59e0b' },
}

const SEV_COLOR = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#9ca3af',
}

export default function AlertsPanel({ open, onClose }) {
  const navigate     = useNavigate()
  const role         = useAuthStore(s => s.user?.role || 'viewer')
  const alerts       = useAlertsStore(s => s.alerts)
  const dismissedIds = useAlertsStore(s => s.dismissedIds)
  const dismissAlert = useAlertsStore(s => s.dismissAlert)
  const dismissAll   = useAlertsStore(s => s.dismissAll)

  const visible = useMemo(
    () => alerts.filter(a => a.roles.includes(role) && !dismissedIds.has(a.id)),
    [alerts, role, dismissedIds]
  )

  function handleAlertClick(alert) {
    if (alert.link) { navigate(alert.link); onClose() }
  }

  function handleDismissAll() {
    dismissAll(visible.map(a => a.id))
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 500 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '95vw',
        background: '#fff', zIndex: 501,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-6px 0 24px rgba(0,0,0,.14)',
      }}>
        {/* Header */}
        <div style={{
          padding: 'calc(env(safe-area-inset-top) + 16px) 18px 14px',
          borderBottom: '1px solid #e5e7eb', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Alertas</span>
            {visible.length > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff', borderRadius: 10,
                padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>
                {visible.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {visible.length > 0 && (
              <button onClick={handleDismissAll} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: '#6b7280', fontWeight: 600,
              }}>
                Eliminar todas
              </button>
            )}
            <button onClick={onClose} style={{
              background: '#f3f4f6', border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#6b7280', lineHeight: 1,
              width: 28, height: 28, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              ×
            </button>
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 24px', color: '#9ca3af' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Sin alertas activas</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Todo en orden</div>
            </div>
          ) : (
            visible.map(alert => {
              const mod = MODULE_META[alert.module] || MODULE_META.facturacion
              return (
                <div
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  style={{
                    display: 'flex', alignItems: 'flex-start',
                    borderBottom: '1px solid #f3f4f6',
                    background: '#fff', cursor: 'pointer',
                    transition: 'background .12s',
                  }}
                >
                  {/* Barra de severidad */}
                  <div style={{
                    width: 4, alignSelf: 'stretch', flexShrink: 0,
                    background: SEV_COLOR[alert.severity],
                  }} />

                  <div style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase',
                        color: mod.color, background: `${mod.color}1A`,
                        padding: '2px 6px', borderRadius: 4,
                      }}>
                        {mod.label}
                      </span>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: SEV_COLOR[alert.severity], flexShrink: 0,
                      }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2, lineHeight: 1.35 }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                      {alert.description}
                    </div>
                  </div>

                  {/* Botón eliminar */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id) }}
                    title="Eliminar alerta"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#d1d5db', fontSize: 18, padding: '10px 12px 10px 4px',
                      alignSelf: 'flex-start', flexShrink: 0,
                      transition: 'color .12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                  >
                    ×
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          borderTop: '1px solid #f3f4f6',
          fontSize: 11, color: '#9ca3af', textAlign: 'center',
        }}>
          Las alertas desaparecen solas cuando el problema se resuelve
        </div>
      </div>
    </>
  )
}

// Componente del botón de campana para usar en el Header
export function BellButton({ onClick, unreadCount }) {
  return (
    <button
      onClick={onClick}
      title="Alertas"
      style={{
        position: 'relative', background: 'none', border: '1px solid #e0e4e0',
        borderRadius: 6, cursor: 'pointer', padding: '3px 8px',
        color: unreadCount > 0 ? '#ef4444' : '#6b7280',
        display: 'flex', alignItems: 'center', gap: 4,
        transition: 'all .15s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute', top: -5, right: -5,
          background: '#ef4444', color: '#fff',
          borderRadius: '50%', width: 16, height: 16,
          fontSize: 9, fontWeight: 800, lineHeight: '16px', textAlign: 'center',
          border: '1.5px solid #fff',
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
