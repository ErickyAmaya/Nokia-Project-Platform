import { Outlet } from 'react-router-dom'
import { useEffect, Suspense } from 'react'
import { useFactStore } from '../../store/useFactStore'

function PageLoader() {
  return <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca89c', fontSize: 13 }}>Cargando…</div>
}

export default function FactWrapper() {
  const loadAll = useFactStore(s => s.loadAll)
  useEffect(() => { loadAll() }, [loadAll])
  return <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
}
