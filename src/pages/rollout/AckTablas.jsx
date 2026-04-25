import { useMemo, useState } from 'react'
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

function FcCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  function save() {
    onSave(val || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="text"
        value={val}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={{ width: 110, fontSize: 9, padding: '2px 4px', border: '1px solid #3b82f6', borderRadius: 3 }}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Clic para editar"
      style={{
        fontSize: 9, cursor: 'pointer', display: 'inline-block', minWidth: 60,
        color: value ? '#1e40af' : '#d1d5db',
        borderBottom: '1px dashed #bfdbfe', padding: '1px 0',
      }}
    >
      {value || '+ FC'}
    </span>
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

// Configuración por proceso
const PROC_CONFIG = {
  gap_on_air: {
    label: 'ON AIR', color: '#0ea5e9',
    fc_avance: 'fc_avance_on_air', fc_cierre: 'fc_cierre_on_air',
    ticket_owner: 'ticket_on_air_owner',
  },
  gap_log_inv: {
    label: 'LOGÍSTICA INVERSA', color: '#f59e0b',
    fc_avance: 'fc_avance_on_air', fc_cierre: 'fc_cierre_on_air', // reutilizar estructura
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

// Corrección del fc_avance para LOG INV
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

function ProcesoTabla({ procesoKey, sabana, forecasts, saveForecast, search, soloPend }) {
  const cfg = PROC_CONFIG[procesoKey]

  const rows = useMemo(() => {
    return sabana
      .filter(r => soloPend ? !isFinal(r[procesoKey]) : true)
      .filter(r => !search || r.site_name === search)
      .sort((a, b) => {
        const aFin = isFinal(a[procesoKey])
        const bFin = isFinal(b[procesoKey])
        // Pendientes primero; dentro de cada grupo, más antiguos primero
        if (aFin !== bFin) return aFin ? 1 : -1
        return (b.semanas_integracion || 0) - (a.semanas_integracion || 0)
      })
  }, [sabana, procesoKey, search, soloPend])

  async function handleFcChange(smp, field, value) {
    try {
      await saveForecast(smp, { [field]: value })
    } catch {
      showToast('Error al guardar forecast', 'err')
    }
  }

  if (!rows.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#9ca89c', fontSize: 13 }}>
        ✓ Sin pendientes en {cfg.label}
      </div>
    )
  }

  const faKey = FC_AVANCE_MAP[procesoKey]
  const fcKey = FC_CIERRE_MAP[procesoKey]

  const pendCount = rows.filter(r => !isFinal(r[procesoKey])).length
  const finCount  = rows.length - pendCount

  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca89c', marginBottom: 8 }}>
        {soloPend
          ? `${rows.length} SMPs pendientes — ordenados por antigüedad ↓`
          : <><span style={{ color: '#ef4444', fontWeight: 700 }}>{pendCount} pendientes</span> · <span style={{ color: '#22c55e', fontWeight: 700 }}>{finCount} cerrados</span> · {rows.length} total</>
        }
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
        <table className="tbl" style={{ fontSize: 10, width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0,   zIndex: 4, background: '#f8f9f8', minWidth: 130 }}>Main SMP</th>
              <th style={{ position: 'sticky', top: 0, left: 130, zIndex: 4, background: '#f8f9f8', minWidth: 160 }}>SMP</th>
              <th style={{ position: 'sticky', top: 0, left: 290, zIndex: 4, background: '#f8f9f8', minWidth: 120, boxShadow: '2px 0 4px rgba(0,0,0,.06)' }}>Sitio</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8f9f8' }}>Región</th>
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
                  <td style={{ position: 'sticky', left: 0,   zIndex: 2, background: fin ? '#f0fdf4' : '#fff', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 9 }}>{r.main_smp}</td>
                  <td style={{ position: 'sticky', left: 130, zIndex: 2, background: fin ? '#f0fdf4' : '#fff', fontFamily: 'monospace', fontSize: 8, color: '#555' }}>{r.smp}</td>
                  <td style={{ position: 'sticky', left: 290, zIndex: 2, background: fin ? '#f0fdf4' : '#fff', whiteSpace: 'nowrap', boxShadow: '2px 0 4px rgba(0,0,0,.06)' }}>{r.site_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.region}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: (r.semanas_integracion || 0) > 104 ? '#ef4444' : '#555' }}>
                    {r.semanas_integracion || '—'}
                  </td>
                  <td>{badge(r[procesoKey])}</td>
                  <td>
                    <FcDateCell
                      value={fc[faKey]}
                      onSave={v => handleFcChange(r.smp, faKey, v)}
                    />
                  </td>
                  <td>
                    <FcCell
                      value={fc[fcKey]}
                      onSave={v => handleFcChange(r.smp, fcKey, v)}
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

export default function AckTablas() {
  const sabana      = useAckStore(s => s.sabana)
  const forecasts   = useAckStore(s => s.forecasts)
  const saveForecast = useAckStore(s => s.saveForecast)

  const [tab,      setTab]      = useState('gap_on_air')
  const [sitio,    setSitio]    = useState('')
  const [soloPend, setSoloPend] = useState(true)

  const sitios = useMemo(() =>
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

  return (
    <div>
      <div className="dash-hdr mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
          ACK — Tablas de Procesos
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="fc"
            value={sitio}
            onChange={e => setSitio(e.target.value)}
            style={{ minWidth: 180, maxWidth: 260, fontSize: 11 }}
          >
            <option value="">Todos los sitios</option>
            {sitios.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setSoloPend(p => !p)}
            style={{
              padding: '5px 14px', border: 'none', borderRadius: 20, cursor: 'pointer',
              fontFamily: "'Barlow', sans-serif", fontSize: 10, fontWeight: 700,
              letterSpacing: .5, whiteSpace: 'nowrap',
              background: soloPend ? '#fee2e2' : '#dcfce7',
              color:      soloPend ? '#991b1b' : '#166534',
              transition: 'all .15s',
            }}
          >
            {soloPend ? '◎ Ver Todos' : '● Solo Pendientes'}
          </button>
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
          soloPend={soloPend}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 9, color: '#9ca89c' }}>
        💡 Haz clic en <b>FC Avance</b> o <b>FC Comentario</b> para editar. Los cambios se guardan automáticamente en Supabase y persisten al cargar nuevos reportes.
      </div>
    </div>
  )
}
