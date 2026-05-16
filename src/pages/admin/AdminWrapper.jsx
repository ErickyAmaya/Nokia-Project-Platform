import { Outlet } from 'react-router-dom'
import { Suspense } from 'react'

function PageLoader() {
  return <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca89c', fontSize: 13 }}>Cargando…</div>
}

export default function AdminWrapper() {
  return <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
}
