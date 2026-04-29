import { useEffect } from 'react'
import { Outlet }    from 'react-router-dom'
import { useAckStore } from '../../store/useAckStore'
import { useAuthStore } from '../../store/authStore'
import { getSupabaseClient } from '../../lib/supabase'

export default function AckWrapper() {
  const loadAll       = useAckStore(s => s.loadAll)
  const loadUserPrefs = useAckStore(s => s.loadUserPrefs)
  const userId        = useAuthStore(s => s.user?.id)

  useEffect(() => { loadAll() }, [loadAll])

  // Recarga prefs cuando el usuario vuelve a la app (cambio de dispositivo o tab)
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') loadUserPrefs() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadUserPrefs])

  // Sincronización en tiempo real: recarga prefs cuando cambian en otro dispositivo
  useEffect(() => {
    if (!userId) return
    const db = getSupabaseClient()
    if (!db) return

    const channel = db
      .channel(`user-prefs-${userId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'user_prefs',
        filter: `user_id=eq.${userId}`,
      }, () => loadUserPrefs())
      .subscribe()

    return () => { db.removeChannel(channel) }
  }, [userId, loadUserPrefs])

  return <Outlet />
}
