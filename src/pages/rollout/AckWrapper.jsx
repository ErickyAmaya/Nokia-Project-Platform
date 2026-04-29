import { useEffect } from 'react'
import { Outlet }    from 'react-router-dom'
import { useAckStore } from '../../store/useAckStore'

export default function AckWrapper() {
  const loadAll        = useAckStore(s => s.loadAll)
  const loadUserPrefs  = useAckStore(s => s.loadUserPrefs)

  useEffect(() => { loadAll() }, [loadAll])

  // Recarga prefs cuando el usuario vuelve a la app (cambio de dispositivo o tab)
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') loadUserPrefs() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadUserPrefs])

  return <Outlet />
}
