import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'

/**
 * Subscribes to Supabase Realtime changes on sitios, gastos, subcontratistas.
 * Returns connection status: 'connecting' | 'connected' | 'error'
 *
 * Only active while a user is logged in.
 */
export function useRealtime() {
  const [status, setStatus]   = useState('connecting')
  const channelRef            = useRef(null)
  const applyRT               = useAppStore(s => s.applyRT)
  const user                  = useAppStore(s => s.user)

  useEffect(() => {
    if (!user) {
      setStatus('connecting')
      return
    }

    const channel = supabase
      .channel('nokia-billing-rt', { config: { broadcast: { self: false } } })

      // sitios
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sitios' },
        p => applyRT('sitios', 'INSERT', p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sitios' },
        p => applyRT('sitios', 'UPDATE', p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sitios' },
        p => applyRT('sitios', 'DELETE', p.old))

      // gastos
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gastos' },
        p => applyRT('gastos', 'INSERT', p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gastos' },
        p => applyRT('gastos', 'UPDATE', p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gastos' },
        p => applyRT('gastos', 'DELETE', p.old))

      // subcontratistas
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subcontratistas' },
        p => applyRT('subcontratistas', 'INSERT', p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'subcontratistas' },
        p => applyRT('subcontratistas', 'UPDATE', p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'subcontratistas' },
        p => applyRT('subcontratistas', 'DELETE', p.old))

      // liquidaciones_cw
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'liquidaciones_cw' },
        p => applyRT('liquidaciones_cw', 'INSERT', p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'liquidaciones_cw' },
        p => applyRT('liquidaciones_cw', 'UPDATE', p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'liquidaciones_cw' },
        p => applyRT('liquidaciones_cw', 'DELETE', p.old))

      .subscribe(st => {
        if      (st === 'SUBSCRIBED')   setStatus('connected')
        else if (st === 'CHANNEL_ERROR') setStatus('error')
        else if (st === 'TIMED_OUT')     setStatus('error')
        else                             setStatus('connecting')
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [user, applyRT])

  return status
}
