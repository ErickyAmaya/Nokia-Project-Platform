import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useFactStore } from '../../store/useFactStore'

export default function FactWrapper() {
  const loadAll = useFactStore(s => s.loadAll)
  useEffect(() => { loadAll() }, [loadAll])
  return <Outlet />
}
