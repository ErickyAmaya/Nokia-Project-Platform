import { useEffect } from 'react'
import { Outlet }    from 'react-router-dom'
import { useAckStore }  from '../../store/useAckStore'
import { useAuthStore } from '../../store/authStore'

export default function AckWrapper() {
  const loadAll          = useAckStore(s => s.loadAll)
  const loadUserPrefs    = useAckStore(s => s.loadUserPrefs)
  const loadForecasts    = useAckStore(s => s.loadForecasts)
  const initPrefsChannel = useAckStore(s => s.initPrefsChannel)
  const initRealtimeSync = useAckStore(s => s.initRealtimeSync)
  const userId           = useAuthStore(s => s.user?.id)

  useEffect(() => { loadAll() }, [loadAll])

  // Realtime: nuevo Excel sube → todos recargan sábana
  useEffect(() => { return initRealtimeSync() }, [initRealtimeSync])

  // Broadcast por usuario: filtro de proyectos sincronizado entre dispositivos
  useEffect(() => {
    if (!userId) return
    return initPrefsChannel(userId)
  }, [userId, initPrefsChannel])

  // Polling: prefs cada 30s + forecasts cada 10s
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadUserPrefs()
        loadForecasts()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    const prefsInterval     = setInterval(loadUserPrefs,  30_000)
    const forecastsInterval = setInterval(loadForecasts,  10_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(prefsInterval)
      clearInterval(forecastsInterval)
    }
  }, [loadUserPrefs, loadForecasts])

  return <Outlet />
}
