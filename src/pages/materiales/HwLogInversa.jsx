import { useState, useMemo, useEffect, useRef } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { useSearchParams } from 'react-router-dom'
import { useHwStore }   from '../../store/useHwStore'
import { useMatStore }  from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { showToast }    from '../../components/Toast'
import HwLogInversaCargaModal from '../../components/materiales/HwLogInversaCargaModal'
import HwLogInversaEditModal  from '../../components/materiales/HwLogInversaEditModal'

const CAN_EDIT = ['admin', 'coordinador', 'logistica']
const CAN_UNDO = ['admin', 'coordinador', 'logistica']

const ESTADO_CFG = {
  en_sitio:  { label: 'En Sitio',          bg: '#dbeafe', color: '#1e40af' },
  en_bodega: { label: 'En Bodega Ingetel', bg: '#d1fae5', color: '#065f46' },
  entregado: { label: 'Entregado',         bg: '#f3f4f6', color: '#374151' },
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || { label: estado, bg: '#f3f4f6', color: '#374151' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}

function KpiPill({ label, value, bg, color }) {
  return (
    <span style={{ background: bg, color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16 }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, opacity: .8 }}>{label}</span>
    </span>
  )
}

function ActionBtn({ label, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#e5e7eb' : color, color: disabled ? '#9ca3af' : '#fff', whiteSpace: 'nowrap', transition: 'all .12s' }}>
      {label}
    </button>
  )
}

// ── Grupo colapsable por sitio ────────────────────────────────────
function SitioGroup({ sitio, rows, canEdit, canUndo, selected, onToggleOne, onToggleAll, onPasarBodega, onEntregar, onDeshacer, onDelete, onDeleteSitio, onEdit, saving, open, onToggleOpen }) {
  const counts = {
    en_sitio:  rows.filter(r => r.estado === 'en_sitio').length,
    en_bodega: rows.filter(r => r.estado === 'en_bodega').length,
    entregado: rows.filter(r => r.estado === 'entregado').length,
  }
  const selInGroup   = rows.filter(r => selected.has(r.id))
  const allSelected  = selInGroup.length === rows.length && rows.length > 0
  const selAllSitio  = selInGroup.length > 0 && selInGroup.every(r => r.estado === 'en_sitio')
  const selAllBodega = selInGroup.length > 0 && selInGroup.every(r => r.estado === 'en_bodega')

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {/* Header del grupo */}
      <div
        onClick={onToggleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: open ? '#f0fdf4' : '#f9fafb', borderBottom: open ? '1px solid #e5e7eb' : 'none', userSelect: 'none', transition: 'background .15s' }}
      >
        <span style={{ fontSize: 14, transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: '#6b7280' }}>▶</span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, flex: 1 }}>{sitio}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {counts.en_sitio  > 0 && <KpiPill label="En Sitio"  value={counts.en_sitio}  bg="#dbeafe" color="#1e40af" />}
          {counts.en_bodega > 0 && <KpiPill label="En Bodega" value={counts.en_bodega} bg="#d1fae5" color="#065f46" />}
          {counts.entregado > 0 && <KpiPill label="Entregado" value={counts.entregado} bg="#f3f4f6" color="#374151" />}
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{rows.length} ítem{rows.length !== 1 ? 's' : ''}</span>
        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onDeleteSitio(sitio, rows.length) }}
            title="Eliminar todos los registros de este sitio"
            style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Eliminar sitio
          </button>
        )}
      </div>

      {/* Contenido expandido */}
      {open && (
        <>
          {/* Barra de selección del grupo */}
          {canEdit && selInGroup.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af' }}>{selInGroup.length} seleccionado{selInGroup.length !== 1 ? 's' : ''}</span>
              <button disabled={!selAllSitio || saving} onClick={() => onPasarBodega(selInGroup.map(r => r.id))}
                title={!selAllSitio ? 'Todos deben estar en "En Sitio"' : ''}
                style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: 'none', cursor: selAllSitio && !saving ? 'pointer' : 'not-allowed', background: selAllSitio ? '#065f46' : '#e5e7eb', color: selAllSitio ? '#fff' : '#9ca3af' }}>
                → Pasar a Bodega Ingetel
              </button>
              <button disabled={!selAllBodega || saving} onClick={() => onEntregar(selInGroup.map(r => r.id))}
                title={!selAllBodega ? 'Todos deben estar en "En Bodega Ingetel"' : ''}
                style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: 'none', cursor: selAllBodega && !saving ? 'pointer' : 'not-allowed', background: selAllBodega ? '#374151' : '#e5e7eb', color: selAllBodega ? '#fff' : '#9ca3af' }}>
                → Marcar Entregado
              </button>
            </div>
          )}

          {/* Tabla del grupo */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {canEdit && (
                    <th style={thS}>
                      <input type="checkbox" checked={allSelected} onChange={() => onToggleAll(rows.map(r => r.id), !allSelected)} />
                    </th>
                  )}
                  <th style={thS}>NI Name</th>
                  <th style={thS}>Codigo Capex</th>
                  <th style={thS}>Serial Final</th>
                  <th style={thS}>SMP</th>
                  <th style={thS}>Concepto</th>
                  <th style={thS}>Cant.</th>
                  <th style={thS}>Bodega Destino</th>
                  <th style={thS}>Estado</th>
                  <th style={thS}>Fecha</th>
                  {canEdit && <th style={thS}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderTop: '1px solid #f3f4f6', background: selected.has(row.id) ? '#eff6ff' : 'transparent' }}>
                    {canEdit && (
                      <td style={tdS}><input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggleOne(row.id)} /></td>
                    )}
                    <td style={{ ...tdS, fontWeight: 600 }}>{row.ni_name || '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{row.codigo_capex || '—'}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 11 }}>{row.serial_final || '—'}</td>
                    <td style={tdS}>{row.smp || '—'}</td>
                    <td style={{ ...tdS, maxWidth: 200 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.concepto}>{row.concepto || '—'}</span>
                    </td>
                    <td style={{ ...tdS, textAlign: 'center' }}>{row.cantidad ?? 1}</td>
                    <td style={tdS}>{row.bodega_destino || '—'}</td>
                    <td style={tdS}><EstadoBadge estado={row.estado} /></td>
                    <td style={{ ...tdS, fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {row.estado === 'entregado' && row.fecha_entrega ? row.fecha_entrega : ''}
                      {row.estado === 'en_bodega' && row.fecha_bodega  ? row.fecha_bodega  : ''}
                      {row.estado === 'en_sitio'  ? '—' : ''}
                    </td>
                    {canEdit && (
                      <td style={{ ...tdS, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {row.estado === 'en_sitio'  && <ActionBtn label="→ Bodega"   color="#065f46" onClick={() => onPasarBodega([row.id])} disabled={saving} />}
                          {row.estado === 'en_bodega' && <ActionBtn label="→ Entregar" color="#374151" onClick={() => onEntregar([row.id])}    disabled={saving} />}
                          {row.estado !== 'en_sitio'  && canUndo && <ActionBtn label="↩" color="#9ca3af" onClick={() => onDeshacer(row)} disabled={saving} />}
                          <ActionBtn label="Editar" color="#144E4A" onClick={() => onEdit(row)}   disabled={saving} />
                          <ActionBtn label="✕"     color="#dc2626" onClick={() => onDelete(row)} disabled={saving} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function HwLogInversa() {
  const hwLogInversa = useHwStore(s => s.hwLogInversa)
  const bulkUpdate      = useHwStore(s => s.bulkUpdateHwLogInversaEstado)
  const updateRow       = useHwStore(s => s.updateHwLogInversa)
  const deleteRow       = useHwStore(s => s.deleteHwLogInversa)
  const deleteBySitio   = useHwStore(s => s.deleteHwLogInversaBySitio)
  const sitios       = useMatStore(s => s.sitios)
  const user         = useAuthStore(s => s.user)
  const rol          = user?.role || ''
  const canEdit      = CAN_EDIT.includes(rol)
  const canUndo      = CAN_UNDO.includes(rol)

  const [searchParams]   = useSearchParams()
  const sitioRefs        = useRef({})

  const [showCarga,      setShowCarga]      = useState(false)
  const [editRow,        setEditRow]        = useState(null)
  const [selected,       setSelected]       = useState(new Set())
  const [filterEstado,   setFilterEstado]   = useState('')
  const [filterConcepto, setFilterConcepto] = useState('')
  const [filterBodega,   setFilterBodega]   = useState('')
  const [search,         setSearch]         = useState('')
  const [saving,       setSaving]       = useState(false)
  const [expanded,     setExpanded]     = useState(new Set())  // sitios abiertos

  // ── Auto-expandir sitio desde URL param ─────────────────────────
  useEffect(() => {
    const sitioParam = searchParams.get('sitio')
    if (!sitioParam || hwLogInversa.length === 0) return
    setExpanded(prev => {
      const next = new Set(prev)
      next.add(sitioParam)
      return next
    })
    const scrollTo = () => {
      const el = sitioRefs.current[sitioParam]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setTimeout(scrollTo, 150)
  }, [searchParams, hwLogInversa.length])

  // ── Opciones únicas de concepto y bodega_destino ────────────────
  const conceptoOpts = useMemo(() => [...new Set(hwLogInversa.map(r => r.concepto).filter(Boolean))].sort(), [hwLogInversa])
  const bodegaOpts   = useMemo(() => [...new Set(hwLogInversa.map(r => r.bodega_destino).filter(Boolean))].sort(), [hwLogInversa])

  // ── Datos filtrados ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return hwLogInversa.filter(r => {
      if (filterEstado   && r.estado          !== filterEstado)   return false
      if (filterConcepto && r.concepto        !== filterConcepto) return false
      if (filterBodega   && r.bodega_destino  !== filterBodega)   return false
      if (q && !`${r.serial_final}${r.smp}${r.ni_name}${r.codigo_capex}${r.concepto}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [hwLogInversa, filterEstado, filterConcepto, filterBodega, search])

  // ── Agrupar por sitio ────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach(r => {
      const key = r.sitio || '(sin sitio)'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // ── KPIs globales ────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    en_sitio:  filtered.filter(r => r.estado === 'en_sitio').length,
    en_bodega: filtered.filter(r => r.estado === 'en_bodega').length,
    entregado: filtered.filter(r => r.estado === 'entregado').length,
  }), [filtered])

  // ── Expand / collapse ────────────────────────────────────────────
  const allExpanded = groups.every(([s]) => expanded.has(s))

  function toggleSitio(sitio) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(sitio) ? next.delete(sitio) : next.add(sitio)
      return next
    })
  }

  function toggleAll() {
    if (allExpanded) setExpanded(new Set())
    else setExpanded(new Set(groups.map(([s]) => s)))
  }

  // ── Selección ────────────────────────────────────────────────────
  function toggleOne(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleGroup(ids, select) {
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => select ? next.add(id) : next.delete(id))
      return next
    })
  }

  // ── Acciones ─────────────────────────────────────────────────────
  async function pasarBodega(ids) {
    if (!ids.length) return
    setSaving(true)
    try {
      await bulkUpdate(ids, 'en_bodega', { fecha_bodega: new Date().toISOString().slice(0, 10), updated_by: user?.nombre || '' })
      setSelected(new Set())
      showToast(`${ids.length} equipo${ids.length !== 1 ? 's' : ''} pasado${ids.length !== 1 ? 's' : ''} a Bodega Ingetel`)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  async function marcarEntregado(ids, entregado_a) {
    if (!ids.length) return
    setSaving(true)
    try {
      await bulkUpdate(ids, 'entregado', { fecha_entrega: new Date().toISOString().slice(0, 10), entregado_a: entregado_a || null, updated_by: user?.nombre || '' })
      setSelected(new Set())
      showToast(`${ids.length} equipo${ids.length !== 1 ? 's' : ''} marcado${ids.length !== 1 ? 's' : ''} como Entregado`)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleEntregar(ids) {
    const dest = window.prompt('¿A quién se entrega? (ej. Abastecimiento, Bodega Nokia BGA)', 'Abastecimiento')
    if (dest === null) return
    await marcarEntregado(ids, dest.trim())
  }

  async function deshacerEstado(row) {
    const prev  = row.estado === 'entregado' ? 'en_bodega' : 'en_sitio'
    const clear = row.estado === 'entregado' ? { fecha_entrega: null, entregado_a: null } : { fecha_bodega: null }
    setSaving(true)
    try {
      await updateRow(row.id, { estado: prev, ...clear, updated_by: user?.nombre || '' })
      showToast('Estado revertido')
    } catch (e) { showToast('Error: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(row) {
    if (!window.confirm(`¿Eliminar "${row.ni_name || row.serial_final || row.id}"?`)) return
    try { await deleteRow(row.id); showToast('Fila eliminada') }
    catch (e) { showToast('Error: ' + e.message, 'error') }
  }

  async function handleDeleteSitio(sitio, count) {
    if (!window.confirm(`¿Eliminar TODOS los ${count} registros del sitio "${sitio}"?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await deleteBySitio(sitio)
      setSelected(new Set())
      showToast(`Sitio "${sitio}" eliminado de Logística Inversa`)
    } catch (e) { showToast('Error: ' + e.message, 'error') }
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, margin: 0 }}>Logística Inversa</h1>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Equipos desinstalados en sitio · {groups.length} sitio{groups.length !== 1 ? 's' : ''} · {filtered.length} registros</div>
        </div>
        {canEdit && (
          <button onClick={() => setShowCarga(true)}
            style={{ padding: '9px 18px', background: '#144E4A', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Cargar archivo
          </button>
        )}
      </div>

      {/* KPIs globales */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'En Sitio',          value: kpi.en_sitio,  bg: '#dbeafe', color: '#1e40af' },
          { label: 'En Bodega Ingetel', value: kpi.en_bodega, bg: '#d1fae5', color: '#065f46' },
          { label: 'Entregado',         value: kpi.entregado, bg: '#f3f4f6', color: '#374151' },
        ].map(({ label, value, bg, color }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 20px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color, fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filtros + controles de expansión */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12 }}>
          <option value="">Todos los estados</option>
          <option value="en_sitio">En Sitio</option>
          <option value="en_bodega">En Bodega Ingetel</option>
          <option value="entregado">Entregado</option>
        </select>
        <select value={filterConcepto} onChange={e => setFilterConcepto(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12 }}>
          <option value="">Todos los conceptos</option>
          {conceptoOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterBodega} onChange={e => setFilterBodega(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12 }}>
          <option value="">Todas las bodegas destino</option>
          {bodegaOpts.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input placeholder="Buscar serial, SMP, Capex, NI Name…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, minWidth: 220, flex: 1 }} />
        {(filterEstado || filterConcepto || filterBodega || search) && (
          <button onClick={() => { setFilterEstado(''); setFilterConcepto(''); setFilterBodega(''); setSearch('') }}
            style={{ padding: '7px 12px', background: '#f3f4f6', border: 'none', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#6b7280' }}>
            Limpiar
          </button>
        )}
        <button onClick={toggleAll}
          style={{ padding: '7px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}>
          {allExpanded ? '▲ Colapsar todo' : '▼ Expandir todo'}
        </button>
      </div>

      {/* Grupos por sitio */}
      {groups.length === 0 ? (
        <EmptyState
          icon="↩"
          title={hwLogInversa.length === 0 ? 'Sin registros de logística inversa' : 'Sin resultados'}
          subtitle={hwLogInversa.length === 0 ? 'Carga un archivo Excel para comenzar.' : 'Prueba ajustando los filtros.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(([sitio, rows]) => (
            <div key={sitio} ref={el => sitioRefs.current[sitio] = el}>
            <SitioGroup
              key={sitio}
              sitio={sitio}
              rows={rows}
              canEdit={canEdit}
              canUndo={canUndo}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAll={toggleGroup}
              onPasarBodega={pasarBodega}
              onEntregar={handleEntregar}
              onDeshacer={deshacerEstado}
              onDelete={handleDelete}
              onDeleteSitio={handleDeleteSitio}
              onEdit={setEditRow}
              saving={saving}
              open={expanded.has(sitio)}
              onToggleOpen={() => toggleSitio(sitio)}
            />
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      {showCarga && <HwLogInversaCargaModal sitios={sitios} user={user} onClose={() => setShowCarga(false)} />}
      {editRow   && <HwLogInversaEditModal  row={editRow}   user={user} onClose={() => setEditRow(null)}    />}
    </div>
  )
}

const thS = { padding: '7px 10px', fontWeight: 700, color: '#374151', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid #e5e7eb', fontSize: 11, position: 'sticky', top: 0, background: '#f9fafb', zIndex: 2 }
const tdS = { padding: '6px 10px', color: '#374151', verticalAlign: 'middle' }
