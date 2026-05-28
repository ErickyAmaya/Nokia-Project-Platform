import { useState, useRef } from 'react'
import { useHwStore }    from '../../store/useHwStore'
import { getSupabaseClient } from '../../lib/supabase'
import { showToast }     from '../Toast'

const ESTADO_CFG = {
  en_sitio:  { label: 'En Sitio',          color: '#1e40af' },
  en_bodega: { label: 'En Bodega Ingetel', color: '#065f46' },
  entregado: { label: 'Entregado',         color: '#374151' },
}

function DropZone({ file, onFile }) {
  const ref  = useRef()
  const [drag, setDrag] = useState(false)
  return (
    <div
      style={{ border: `2px dashed ${drag ? '#144E4A' : '#d1d5db'}`, borderRadius: 10, background: drag ? '#f0fdf4' : '#fafafa', padding: '18px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s' }}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) onFile(f); e.target.value = '' }} />
      {file
        ? <><div style={{ fontSize: 20, marginBottom: 4 }}>📄</div><div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{file.name}</div><div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{(file.size / 1024).toFixed(0)} KB</div></>
        : <><div style={{ fontSize: 26, marginBottom: 6, opacity: .5 }}>📂</div><div style={{ fontSize: 12, color: '#6b7280' }}>Arrastra o haz clic · .xlsx</div></>
      }
    </div>
  )
}

// Mapea una fila del Excel (objeto con nombres de columna) a payload de DB
function mapRow(raw, sitio, createdBy) {
  const str = (k) => String(raw[k] ?? '').trim() || null

  // Recoger todas las columnas fuera de las que persisten en columnas propias
  const KNOWN = new Set([
    'Id','SMP','Site Name','Ni Name','Cantidad','Serial Final',
    'Concepto Tipo Hw SS E2E','Bodega Destino','Codigo Capex',
  ])
  const extra = {}
  for (const k of Object.keys(raw)) {
    if (!KNOWN.has(k)) extra[k] = raw[k]
  }

  return {
    sitio,
    skytool_id:   str('Id'),
    codigo_capex: str('Codigo Capex'),
    smp:          str('SMP'),
    ni_name:      str('Ni Name'),
    serial_final: str('Serial Final'),
    cantidad:     Number(raw['Cantidad']) || 1,
    concepto:     str('Concepto Tipo Hw SS E2E'),
    bodega_destino: str('Bodega Destino'),
    estado:       'en_sitio',
    created_by:   createdBy || null,
    updated_by:   createdBy || null,
    extra:        Object.keys(extra).length ? extra : null,
  }
}

export default function HwLogInversaCargaModal({ sitios, user, onClose }) {
  const addBatch = useHwStore(s => s.addHwLogInversaBatch)

  const [sitio,      setSitio]      = useState('')
  const [file,       setFile]       = useState(null)
  const [parsing,    setParsing]    = useState(false)
  const [rows,       setRows]       = useState(null)      // filas del Excel ya mapeadas
  const [conflicts,  setConflicts]  = useState(null)      // { existing: [], incoming: [] }
  const [resolution, setResolution] = useState({})        // { [skytool_id]: 'conservar'|'reemplazar' }
  const [saving,     setSaving]     = useState(false)

  async function handleParse() {
    if (!sitio || !file) return
    setParsing(true)
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
      const sheet = wb.Sheets['DATA'] || wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      const mapped = rawRows
        .filter(r => Object.values(r).some(v => String(v).trim()))
        .filter(r => !String(r['Concepto Tipo Hw SS E2E'] ?? '').toLowerCase().includes('instalado'))
        .map(r => mapRow(r, sitio, user?.nombre))

      // Buscar duplicados por skytool_id en DB
      const ids = mapped.map(r => r.skytool_id).filter(Boolean)
      let existing = []
      if (ids.length) {
        const db = getSupabaseClient()
        if (db) {
          const { data } = await db.from('hw_log_inversa')
            .select('id,skytool_id,ni_name,estado')
            .eq('sitio', sitio)
            .in('skytool_id', ids)
          existing = data || []
        }
      }

      if (existing.length > 0) {
        const existMap = new Map(existing.map(e => [e.skytool_id, e]))
        const inConflict = mapped.filter(r => r.skytool_id && existMap.has(r.skytool_id))
        const initRes    = {}
        inConflict.forEach(r => { initRes[r.skytool_id] = 'conservar' })
        setConflicts({ existMap, inConflict })
        setResolution(initRes)
      }

      setRows(mapped)
    } catch (e) {
      showToast('Error al leer el archivo: ' + e.message, 'error')
    } finally {
      setParsing(false)
    }
  }

  function setAllResolution(val) {
    const next = {}
    conflicts?.inConflict.forEach(r => { next[r.skytool_id] = val })
    setResolution(next)
  }

  async function handleImport() {
    if (!rows?.length) return
    setSaving(true)
    try {
      const db = getSupabaseClient()
      const conflictIds = new Set(conflicts?.inConflict.map(r => r.skytool_id) || [])

      // Filas a reemplazar: borrar las existentes primero
      const toReplace = (conflicts?.inConflict || []).filter(r => resolution[r.skytool_id] === 'reemplazar')
      if (toReplace.length && db) {
        const existingIds = toReplace.map(r => conflicts.existMap.get(r.skytool_id)?.id).filter(Boolean)
        if (existingIds.length) {
          const { error } = await db.from('hw_log_inversa').delete().in('id', existingIds)
          if (error) throw error
        }
      }

      // Filtrar filas a insertar: nuevas + las que se van a reemplazar
      const toInsert = rows.filter(r => {
        if (!r.skytool_id || !conflictIds.has(r.skytool_id)) return true  // nueva
        return resolution[r.skytool_id] === 'reemplazar'
      })

      if (toInsert.length) await addBatch(toInsert)
      showToast(`${toInsert.length} registro${toInsert.length !== 1 ? 's' : ''} importado${toInsert.length !== 1 ? 's' : ''} para ${sitio}`)
      onClose()
    } catch (e) {
      showToast('Error al importar: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const phase = !rows ? 'upload' : (conflicts?.inConflict.length ? 'conflicts' : 'confirm')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>Cargar Logística Inversa</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px' }}>

          {/* Fase 1 — Seleccionar sitio + archivo */}
          {phase === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>SITIO</label>
                <select
                  value={sitio}
                  onChange={e => setSitio(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                >
                  <option value="">Selecciona un sitio…</option>
                  {[...sitios].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(s => (
                    <option key={s.id || s.nombre} value={s.nombre}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>ARCHIVO EXCEL (Skytool)</label>
                <DropZone file={file} onFile={setFile} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Cancelar</button>
                <button
                  onClick={handleParse}
                  disabled={!sitio || !file || parsing}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: sitio && file && !parsing ? '#144E4A' : '#e5e7eb', color: sitio && file && !parsing ? '#fff' : '#9ca3af', cursor: sitio && file && !parsing ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}
                >
                  {parsing ? 'Analizando…' : 'Analizar archivo'}
                </button>
              </div>
            </div>
          )}

          {/* Fase 2 — Resolver conflictos */}
          {phase === 'conflicts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                <strong>{conflicts.inConflict.length} fila{conflicts.inConflict.length !== 1 ? 's' : ''} ya existen</strong> en el sitio <strong>{sitio}</strong>.
                Elige qué hacer con cada una, o aplica una acción global.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Aplicar a todas:</span>
                <button onClick={() => setAllResolution('conservar')} style={resBtn('#1e40af')}>Conservar todas</button>
                <button onClick={() => setAllResolution('reemplazar')} style={resBtn('#dc2626')}>Reemplazar todas</button>
              </div>

              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={cth}>NI Name</th>
                      <th style={cth}>Skytool ID</th>
                      <th style={cth}>Estado actual</th>
                      <th style={cth}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.inConflict.map(r => {
                      const ex = conflicts.existMap.get(r.skytool_id)
                      const res = resolution[r.skytool_id] || 'conservar'
                      return (
                        <tr key={r.skytool_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={ctd}>{r.ni_name || '—'}</td>
                          <td style={{ ...ctd, fontFamily: 'monospace', fontSize: 10 }}>{r.skytool_id}</td>
                          <td style={ctd}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: ESTADO_CFG[ex?.estado]?.color || '#374151' }}>
                              {ESTADO_CFG[ex?.estado]?.label || ex?.estado || '—'}
                            </span>
                          </td>
                          <td style={ctd}>
                            <select
                              value={res}
                              onChange={e => setResolution(prev => ({ ...prev, [r.skytool_id]: e.target.value }))}
                              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid #d1d5db', color: res === 'reemplazar' ? '#dc2626' : '#374151' }}
                            >
                              <option value="conservar">Conservar</option>
                              <option value="reemplazar">Reemplazar</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => { setRows(null); setConflicts(null); setResolution({}) }} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
                <button onClick={handleImport} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving ? '#e5e7eb' : '#144E4A', color: saving ? '#9ca3af' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {saving ? 'Importando…' : 'Importar'}
                </button>
              </div>
            </div>
          )}

          {/* Fase 3 — Confirmar sin conflictos */}
          {phase === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#166534' }}>
                <strong>{rows.length} registros</strong> listos para importar al sitio <strong>{sitio}</strong>. Sin duplicados detectados.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => { setRows(null); setConflicts(null) }} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
                <button onClick={handleImport} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving ? '#e5e7eb' : '#144E4A', color: saving ? '#9ca3af' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {saving ? 'Importando…' : `Importar ${rows.length} registros`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const resBtn = (color) => ({
  padding: '4px 12px', fontSize: 11, borderRadius: 5, border: `1px solid ${color}`,
  background: '#fff', color, cursor: 'pointer', fontWeight: 600,
})
const cth = { padding: '6px 10px', fontWeight: 700, color: '#374151', fontSize: 10, textAlign: 'left', borderBottom: '2px solid #e5e7eb', background: '#f9fafb', position: 'sticky', top: 0 }
const ctd = { padding: '5px 10px', color: '#374151', verticalAlign: 'middle' }
