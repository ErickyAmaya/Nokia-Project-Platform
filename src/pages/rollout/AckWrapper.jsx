import { useEffect } from 'react'
import { Outlet }    from 'react-router-dom'
import { useAckStore } from '../../store/useAckStore'

export default function AckWrapper() {
  const loadAll = useAckStore(s => s.loadAll)
  useEffect(() => { loadAll() }, [loadAll])
  return <Outlet />
}
