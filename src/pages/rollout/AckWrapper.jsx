import { useEffect } from 'react'
import { Outlet }    from 'react-router-dom'
import { useAckStore }  from '../../store/useAckStore'
import { useAuthStore } from '../../store/authStore'

export default function AckWrapper() {
  const loadAll          = useAckStore(s => s.loadAll)
  const loadUserPrefs    = useAckStore(s => s.loadUserPrefs)
  const initPrefsChannel = useAckStore(s => s.initPrefsChannel)
  const userId           = useAuthStore(s => s.user?.id)

  useEffect(() => { loadAll() }, [loadAll])

  // Canal Broadcast por usuario — sincronización instantánea entre dispositivos
  useEffect(() => {
    if (!userId) return
    return initPrefsChannel(userId)
  }, [userId, initPrefsChannel])

  // Polling 30s como fallback + recarga al volver a la app
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') loadUserPrefs() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(loadUserPrefs, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [loadUserPrefs])

  return <Outlet />
}
