import { useMemo, useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAckStore, PROCESOS } from '../../store/useAckStore'
import { showToast } from '../../components/Toast'

function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function badge(val) {
  if (!val) return <span style={{ color: '#ccc', fontSize: 9 }}>—</span>
  const fin = isFinal(val)
  const code = val.split('.').shift()
  const label = val.split('.').slice(1).join('.').trim() || val
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: fin ? '#dcfce7' : code <= '0300' ? '#fef9c3' : '#fee2e2',
      color:      fin ? '#166534' : code <= '0300' ? '#854d0e' : '#991b1b',
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {fin ? '✓' : '●'} {label.length > 28 ? label.slice(0, 28) + '…' : label}
    </span>
  )
}

// Modal de comentario con textarea
function FcCell({ value, onSave, siteLabel }) {
  const [open, setOpen] = useState(false)
  const [val,  setVal]  = useState(value || '')

  function save() {
    onSave(val || null)
    setOpen(false)
  }

  function cancel() {
    setVal(value || '')
    setOpen(false)
  }

  // Sincronizar si el valor externo cambia
  useEffect(() => { setVal(value || '') }, [value])

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        title="Clic para editar comentario"
        style={{
          fontSize: 9, cursor: 'pointer', display: 'inline-block', minWidth: 60, maxWidth: 140,
          color: value ? '#1e40af' : '#d1d5db',
          borderBottom: '1px dashed #bfdbfe', padding: '1px 0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value || '+ Comentario'}
      </span>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget) cancel() }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, width: 'min(520px, 92vw)',
            boxShadow: '0 12px 40px rgba(0,0,0,.2)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              background: '#3b82f6', color: '#fff',
              padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>FC Comentario</div>
                {siteLabel && <div style={{ fontSize: 10, opacity: .8, marginTop: 2 }}>{siteLabel}</div>}
              </div>
              <button onClick={cancel} style={{
                background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
                borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
            {/* Body */}
            <div style={{ padding: 18 }}>
              <textarea
                autoFocus
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') cancel() }}
                placeholder="Escribe el comentario o forecast de cierre…"
                style={{
                  width: '100%', minHeight: 120, resize: 'vertical',
                  fontSize: 13, padding: '10px 12px', borderRadius: 8,
                  border: '1.5px solid #bfdbfe', outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit', lineHeight: 1.5, color: '#1e3a5f',
                }}
              />
            </div>
            {/* Footer */}
            <div style={{
              padding: '10px 18px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button onClick={cancel} style={{
                padding: '7px 18px', borderRadius: 8, border: '1px solid #e0e4e0',
                background: '#f8f9fa', color: '#555', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={save} style={{
                padding: '7px 22px', borderRadius: 8, border: 'none',
                background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FcDateCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  function save() {
    onSave(val || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="date"
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        style={{ fontSize: 9, padding: '2px 4px', border: '1px solid #3b82f6', borderRadius: 3 }}
      />
    )
  }

  const display = value ? new Date(value + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : null

  return (
    <span
      onClick={() => setEditing(true)}
      title="Clic para editar fecha"
      style={{
        fontSize: 9, cursor: 'pointer', display: 'inline-block', minWidth: 55,
        color: value ? '#1e40af' : '#d1d5db',
        borderBottom: '1px dashed #bfdbfe', padding: '1px 0',
      }}
    >
      {display || '+ Fecha'}
    </span>
  )
}

// ── Dropdown de búsqueda personalizado ────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef(null)

  // Sincronizar query si el valor externo cambia (ej: limpiar desde afuera)
  useEffect(() => { setQuery(value) }, [value])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() =>
    options.filter(o => !query || o.toLowerCase().includes(query.toLowerCase()))
  , [options, query])

  function select(opt) {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
  }

  function clear() {
    setQuery('')
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <input
          className="fc"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{ minWidth: 200, maxWidth: 260, fontSize: 11, paddingRight: query ? 22 : 8 }}
        />
        {query && (
          <span
            onMouseDown={e => { e.preventDefault(); clear() }}
            style={{
              position: 'absolute', right: 7, cursor: 'pointer',
              color: '#9ca89c', fontSize: 14, lineHeight: 1, userSelect: 'none',
            }}
          >
            ×
          </span>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, minWidth: 240,
          zIndex: 200, background: '#fff', border: '1px solid #e0e4e0', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 320, overflowY: 'auto',
        }}>
          {!query && (
            <div
              onMouseDown={() => select('')}
              style={{
                padding: '7px 14px', fontSize: 11, cursor: 'pointer',
                color: '#9ca89c', borderBottom: '1px solid #f0f0f0',
              }}
            >
              — Todos los sitios
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 11, color: '#9ca89c' }}>Sin resultados</div>
          ) : filtered.map(o => (
            <div
              key={o}
              onMouseDown={() => select(o)}
              style={{
                padding: '7px 14px', fontSize: 11, cursor: 'pointer',
                background: o === value ? '#f0f9ff' : undefined,
                color: o === value ? '#0ea5e9' : '#374151',
                fontWeight: o === value ? 700 : 400,
                borderBottom: '1px solid #f8f9f8',
              }}
              onMouseEnter={e => { if (o !== value) e.currentTarget.style.background = '#f8faff' }}
              onMouseLeave={e => { e.currentTarget.style.background = o === value ? '#f0f9ff' : '' }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Configuración por proceso ─────────────────────────────────────
const PROC_CONFIG = {
  gap_on_air: {
    label: 'ON AIR', color: '#0ea5e9',
    fc_avance: 'fc_avance_on_air', fc_cierre: 'fc_cierre_on_air',
    ticket_owner: 'ticket_on_air_owner',
  },
  gap_log_inv: {
    label: 'LOGÍSTICA INVERSA', color: '#f59e0b',
    fc_avance: 'fc_avance_on_air', fc_cierre: 'fc_cierre_on_air',
    ticket_owner: 'ticket_log_inv_owner',
  },
  gap_site_owner: {
    label: 'SITE OWNER', color: '#8b5cf6',
    fc_avance: 'fc_avance_site_owner', fc_cierre: 'fc_cierre_site_owner',
    ticket_owner: 'ticket_so_owner',
  },
  gap_doc: {
    label: 'DOCUMENTACIÓN', color: '#10b981',
    fc_avance: 'fc_avance_doc', fc_cierre: 'fc_cierre_doc',
    ticket_owner: 'ticket_doc_owner',
  },
  gap_hw_cierre: {
    label: 'CIERRE HW', color: '#ef4444',
    fc_avance: 'fc_avance_hw_cierre', fc_cierre: 'fc_cierre_hw_cierre',
    ticket_owner: 'ticket_hw_cierre_owner',
  },
}

PROC_CONFIG.gap_log_inv.fc_avance = 'fc_avance_on_air'

const FC_AVANCE_MAP = {
  gap_on_air:     'fc_avance_on_air',
  gap_log_inv:    'fc_avance_on_air',
  gap_site_owner: 'fc_avance_site_owner',
  gap_doc:        'fc_avance_doc',
  gap_hw_cierre:  'fc_avance_hw_cierre',
}
const FC_CIERRE_MAP = {
  gap_on_air:     'fc_cierre_on_air',
  gap_log_inv:    'fc_cierre_on_air',
  gap_site_owner: 'fc_cierre_site_owner',
  gap_doc:        'fc_cierre_doc',
  gap_hw_cierre:  'fc_cierre_hw_cierre',
}

const FILTRO_OPTS = [
  { value: 'todos',      label: 'Ver Todos' },
  { value: 'pendientes', label: 'Solo Pendientes' },
  { value: 'cerrados',   label: 'Solo Cerrados' },
]

const FILTRO_BADGE = {
  pendientes: { bg: '#fee2e2', color: '#991b1b', text: '● Pendientes' },
  cerrados:   { bg: '#dcfce7', color: '#166534', text: '✓ Cerrados' },
}

// ── Tabla de un proceso ───────────────────────────────────────────
function ProcesoTabla({ procesoKey, sabana, forecasts, saveForecast, search, filtro }) {
  const cfg = PROC_CONFIG[procesoKey]

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return sabana
      .filter(r => {
        if (filtro === 'pendientes') return !isFinal(r[procesoKey])
        if (filtro === 'cerrados')   return  isFinal(r[procesoKey])
        return true
      })
      .filter(r => !q ||
        r.site_name?.toLowerCase().includes(q) ||
        r.smp?.toLowerCase().includes(q) ||
        r.main_smp?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aFin = isFinal(a[procesoKey])
        const bFin = isFinal(b[procesoKey])
        if (aFin !== bFin) return aFin ? 1 : -1
        return (b.semanas_integracion || 0) - (a.semanas_integracion || 0)
      })
  }, [sabana, procesoKey, search, filtro])

  async function handleFcChange(smp, field, value) {
    try {
      await saveForecast(smp, { [field]: value })
    } catch {
      showToast('Error al guardar forecast', 'err')
    }
  }

  if (!rows.length) {
    const emptyMsg = filtro === 'cerrados'
      ? `Sin cerrados en ${cfg.label}`
      : filtro === 'pendientes'
        ? `✓ Sin pendientes en ${cfg.label}`
        : `Sin resultados en ${cfg.label}`
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#9ca89c', fontSize: 13 }}>
        {emptyMsg}
      </div>
    )
  }

  const faKey = FC_AVANCE_MAP[procesoKey]
  const fcKey = FC_CIERRE_MAP[procesoKey]

  const pendCount = rows.filter(r => !isFinal(r[procesoKey])).length
  const finCount  = rows.length - pendCount

  const statsLabel = filtro === 'pendientes'
    ? `${rows.length} SMPs pendientes — ordenados por antigüedad ↓`
    : filtro === 'cerrados'
      ? `${rows.length} SMPs cerrados`
      : <><span style={{ color: '#ef4444', fontWeight: 700 }}>{pendCount} pendientes</span>{' · '}<span style={{ color: '#22c55e', fontWeight: 700 }}>{finCount} cerrados</span>{' · '}{rows.length} total</>

  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca89c', marginBottom: 8 }}>
        {statsLabel}
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
        <table className="tbl" style={{ fontSize: 10, width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0,   zIndex: 4, background: '#f8f9f8', minWidth: 120 }}>Sitio</th>
              <th style={{ position: 'sticky', top: 0, left: 120, zIndex: 4, background: '#f8f9f8', minWidth: 130 }}>Main SMP</th>
              <th style={{ position: 'sticky', top: 0, left: 250, zIndex: 4, background: '#f8f9f8', minWidth: 160, boxShadow: '2px 0 4px rgba(0,0,0,.06)' }}>SMP</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8' }}>Sub Proyecto</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8', whiteSpace: 'nowrap' }}>Sem. Integ.</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8' }}>Estado</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8', color: '#3b82f6' }}>FC Avance</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8', color: '#3b82f6' }}>FC Comentario</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8' }}>Owner Ticket</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const fc  = forecasts[r.smp] || {}
              const fin = isFinal(r[procesoKey])
              return (
                <tr key={r.smp} style={{ opacity: fin ? 0.65 : 1, background: fin ? '#f0fdf4' : undefined }}>
                  <td style={{ position: 'sticky', left: 0,   zIndex: 2, background: fin ? '#f0fdf4' : '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.site_name}</td>
                  <td style={{ position: 'sticky', left: 120, zIndex: 2, background: fin ? '#f0fdf4' : '#fff', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 9 }}>{r.main_smp}</td>
                  <td style={{ position: 'sticky', left: 250, zIndex: 2, background: fin ? '#f0fdf4' : '#fff', fontFamily: 'monospace', fontSize: 8, color: '#555', boxShadow: '2px 0 4px rgba(0,0,0,.06)' }}>{r.smp}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 9, color: '#666' }}>{r.sub_proyecto || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: (r.semanas_integracion || 0) > 104 ? '#ef4444' : '#555' }}>
                    {r.semanas_integracion || '—'}
                  </td>
                  <td>{badge(r[procesoKey])}</td>
                  <td>
                    <FcDateCell value={fc[faKey]} onSave={v => handleFcChange(r.smp, faKey, v)} />
                  </td>
                  <td>
                    <FcCell
                      value={fc[fcKey]}
                      onSave={v => handleFcChange(r.smp, fcKey, v)}
                      siteLabel={`${r.site_name} · ${r.smp}`}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r[cfg.ticket_owner]
                      ? <span style={{ fontSize: 8, fontWeight: 700, color: r[cfg.ticket_owner] === 'Nokia' ? '#3b82f6' : '#f59e0b' }}>
                          {r[cfg.ticket_owner]}
                        </span>
                      : <span style={{ color: '#ccc', fontSize: 8 }}>—</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function AckTablas() {
  const sabana       = useAckStore(s => s.sabana)
  const forecasts    = useAckStore(s => s.forecasts)
  const saveForecast = useAckStore(s => s.saveForecast)
  const [searchParams] = useSearchParams()

  const [tab,    setTab]    = useState('gap_on_air')
  const [sitio,  setSitio]  = useState('')
  const [filtro, setFiltro] = useState('pendientes')

  // Pre-filtrar si llegamos desde Reportes con ?sitio=
  useEffect(() => {
    const sitioParam = searchParams.get('sitio')
    if (sitioParam) {
      setSitio(sitioParam)
      setFiltro('todos')
    }
  }, [])

  const siteNames = useMemo(() =>
    [...new Set(sabana.map(r => r.site_name).filter(Boolean))].sort()
  , [sabana])

  const tabStyle = (key) => ({
    padding: '7px 14px', border: 'none', cursor: 'pointer',
    fontFamily: "'Barlow', sans-serif", fontSize: 11, fontWeight: 700,
    letterSpacing: .4, textTransform: 'uppercase',
    background: tab === key ? '#fff' : 'transparent',
    borderBottom: tab === key ? `3px solid ${PROC_CONFIG[key].color}` : '3px solid transparent',
    color: tab === key ? PROC_CONFIG[key].color : '#9ca89c',
    transition: 'all .15s',
  })

  const pendCounts = useMemo(() => {
    const map = {}
    for (const p of PROCESOS) {
      map[p.key] = sabana.filter(r => !isFinal(r[p.key]) && r[p.key]).length
    }
    return map
  }, [sabana])

  const filtroBadge = FILTRO_BADGE[filtro]

  return (
    <div>
      <div className="dash-hdr mb14">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
              ACK — Tablas de Procesos
            </h1>
            {filtroBadge && (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20,
                background: filtroBadge.bg, color: filtroBadge.color, whiteSpace: 'nowrap',
              }}>
                {filtroBadge.text}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchableSelect
            options={siteNames}
            value={sitio}
            onChange={setSitio}
            placeholder="🔍 Buscar sitio o SMP…"
          />
          <select
            className="fc"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={{ fontSize: 11, fontWeight: 700 }}
          >
            {FILTRO_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1.5px solid #e0e4e0', marginBottom: 16, overflowX: 'auto' }}>
        {PROCESOS.map(p => (
          <button key={p.key} style={tabStyle(p.key)} onClick={() => setTab(p.key)}>
            {p.label}
            {pendCounts[p.key] > 0 && (
              <span style={{
                marginLeft: 6, background: PROC_CONFIG[p.key].color, color: '#fff',
                borderRadius: 10, padding: '1px 6px', fontSize: 8, fontWeight: 800,
              }}>
                {pendCounts[p.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card-b" style={{ padding: 16 }}>
        <ProcesoTabla
          key={tab}
          procesoKey={tab}
          sabana={sabana}
          forecasts={forecasts}
          saveForecast={saveForecast}
          search={sitio}
          filtro={filtro}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 9, color: '#9ca89c' }}>
        💡 Haz clic en <b>FC Avance</b> o <b>FC Comentario</b> para editar. Los cambios se guardan automáticamente en Supabase.
      </div>
    </div>
  )
}
