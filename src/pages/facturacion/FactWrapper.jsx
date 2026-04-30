import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow } from '../../store/useFactStore'

const TABS = [
  { path: '/facturacion',              label: 'Dashboard',     exact: true },
  { path: '/facturacion/por-facturar', label: 'Por Facturar'              },
  { path: '/facturacion/facturado',    label: 'Facturado'                 },
  { path: '/facturacion/pos',          label: 'POs'                       },
  { path: '/facturacion/smps',         label: 'Todos los SMPs'            },
]

export default function FactWrapper() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const loadAll      = useFactStore(s => s.loadAll)
  const ppa          = useFactStore(s => s.ppa)
  const invoices     = useFactStore(s => s.invoices)

  useEffect(() => { loadAll() }, [loadAll])

  const pendientes = useMemo(() => {
    const map = buildInvoicesMap(invoices)
    return ppa.filter(r => r.sgr && getEventosRow(r, map).some(e => e.status === 'facturar')).length
  }, [ppa, invoices])

  function isActive(tab) {
    return tab.exact ? pathname === tab.path : pathname.startsWith(tab.path)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid #e8eae8' }}>
        {TABS.map(tab => {
          const active = isActive(tab)
          return (
            <button key={tab.path} onClick={() => navigate(tab.path)} style={{
              padding: '7px 16px', border: 'none', background: 'none',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? '#144E4A' : '#71717a',
              borderBottom: active ? '2px solid #144E4A' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {tab.label}
              {tab.label === 'Por Facturar' && pendientes > 0 && (
                <span style={{
                  background: '#ef4444', color: '#fff', borderRadius: 10,
                  fontSize: 9, fontWeight: 700, padding: '1px 6px',
                }}>
                  {pendientes}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
