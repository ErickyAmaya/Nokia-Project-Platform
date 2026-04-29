import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useMatStore } from '../../store/useMatStore'
import StockAlerts from '../../components/materiales/StockAlerts'

export default function MatWrapper() {
  const loadAll          = useMatStore(s => s.loadAll)
  const initRealtimeSync = useMatStore(s => s.initRealtimeSync)
  const loading          = useMatStore(s => s.loading)
  const catalogo         = useMatStore(s => s.catalogo)

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => { return initRealtimeSync() }, [initRealtimeSync])

  // Polling de respaldo: recarga completa cada 60s y al volver a la pestaña
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') loadAll() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(loadAll, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [loadAll])

  // Spinner solo en la carga inicial — las recargas de fondo no interrumpen la UI
  if (loading && catalogo.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, flexDirection:'column', gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid #e0e4e0', borderTopColor:'#1a9c1a', animation:'spin .8s linear infinite' }} />
        <span style={{ fontSize:11, color:'#9ca89c', fontWeight:600, letterSpacing:.6 }}>CARGANDO MATERIALES…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <>
      <StockAlerts />
      <Outlet />
    </>
  )
}
