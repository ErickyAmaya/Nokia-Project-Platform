import { useEffect } from 'react'
import { Outlet }    from 'react-router-dom'
import { useAckStore } from '../../store/useAckStore'

export default function AckWrapper() {
  const loadAll       = useAckStore(s => s.loadAll)
  const loadUserPrefs = useAckStore(s => s.loadUserPrefs)

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    // Recarga prefs al volver a la app/tab
    function onVisible() { if (document.visibilityState === 'visible') loadUserPrefs() }
    document.addEventListener('visibilitychange', onVisible)

    // Polling cada 30s para sincronizar entre dispositivos con la app abierta
    const interval = setInterval(loadUserPrefs, 30_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [loadUserPrefs])

  return <Outlet />
}
