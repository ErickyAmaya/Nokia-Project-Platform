import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'

const AREAS_ORDER = ['HW_Cierre', 'ONAIR', 'OnAir', 'DOC', 'LI', 'LOG_INV', 'SO', 'SO_DEC']
const AREA_COLOR  = {
  HW_Cierre: '#ef4444', ONAIR: '#0ea5e9', OnAir: '#0ea5e9',
  DOC: '#10b981', LI: '#f59e0b', LOG_INV: '#f59e0b',
  SO: '#8b5cf6', SO_DEC: '#8b5cf6',
}

const EMPTY_FORM = { gap: '', area: 'HW_Cierre', secuencia: '', descripcion: '', gestion: '', se_puede_liberar: null }

function LibBadge({ value, onClick }) {
  if (value === true)  return <button onClick={onClick} style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>SI</button>
  if (value === false) return <button onClick={onClick} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>NO</button>
  return <button onClick={onClick} style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer' }}>—</button>
}

export default function AdminAckGlosario() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(null)  // id being saved
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [adding,  setAdding]  = useState(false)
  const [filtroArea, setFiltroArea] = useState('todos')

  useEffect(() => {
    supabase.from('ack_glosario')
      .select('*')
      .order('area').order('secuencia')
      .then(({ data, error }) => {
        if (error) showToast('Error al cargar glosario: ' + error.message, 'err')
        else setRows(data || [])
        setLoading(false)
      })
  }, [])

  const byArea = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const key = r.area
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    // Orden definido; áreas no listadas van al final
    const sorted = new Map()
    for (const a of AREAS_ORDER) if (map.has(a)) sorted.set(a, map.get(a))
    for (const [a, v] of map)    if (!sorted.has(a)) sorted.set(a, v)
    return sorted
  }, [rows])

  const areas = [...byArea.keys()]

  const filteredByArea = useMemo(() => {
    if (filtroArea === 'todos') return byArea
    const m = new Map()
    if (byArea.has(filtroArea)) m.set(filtroArea, byArea.get(filtroArea))
    return m
  }, [byArea, filtroArea])

  async function cycleValue(row) {
    // Cicla: null → true → false → null
    const next = row.se_puede_liberar === null ? true
               : row.se_puede_liberar === true  ? false
               :                                  null
    setSaving(row.id)
    const { error } = await supabase.from('ack_glosario')
      .update({ se_puede_liberar: next })
      .eq('id', row.id)
    if (error) {
      showToast('Error al guardar: ' + error.message, 'err')
    } else {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, se_puede_liberar: next } : r))
    }
    setSaving(null)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.gap.trim() || !form.area.trim()) { showToast('Gap y Área son obligatorios', 'err'); return }
    setAdding(true)
    const { data, error } = await supabase.from('ack_glosario').insert({
      gap:              form.gap.trim(),
      area:             form.area.trim(),
      secuencia:        form.secuencia ? Number(form.secuencia) : null,
      descripcion:      form.descripcion.trim() || null,
      gestion:          form.gestion.trim() || null,
      se_puede_liberar: form.se_puede_liberar,
    }).select().single()
    if (error) {
      showToast('Error al agregar: ' + error.message, 'err')
    } else {
      setRows(prev => [...prev, data].sort((a, b) => a.area.localeCompare(b.area) || (a.secuencia || 0) - (b.secuencia || 0)))
      setForm(EMPTY_FORM)
      showToast('Estado agregado')
    }
    setAdding(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>Cargando glosario…</div>

  return (
    <>
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            Glosario ACK
            <span style={{ marginLeft: 10, background: '#f3f4f6', color: '#6b7280', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '2px 10px' }}>{rows.length} estados</span>
          </h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            Configura qué estados permiten la liberación en "Por Facturar". Clic en el badge para cambiar.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="fc"
            value={filtroArea}
            onChange={e => setFiltroArea(e.target.value)}
            style={{ fontSize: 11 }}
          >
            <option value="todos">Todas las áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* ── Leyenda ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Se puede liberar:</span>
        <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 5, fontSize: 10, fontWeight: 700, padding: '2px 9px' }}>SI</span>
        <span style={{ fontSize: 10, color: '#6b7280' }}>Permite liberación</span>
        <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 5, fontSize: 10, fontWeight: 700, padding: '2px 9px' }}>NO</span>
        <span style={{ fontSize: 10, color: '#6b7280' }}>Bloquea liberación</span>
        <span style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 10, fontWeight: 700, padding: '2px 9px' }}>—</span>
        <span style={{ fontSize: 10, color: '#6b7280' }}>No aplica / Sin definir</span>
      </div>

      {/* ── Tabla por área ── */}
      {[...filteredByArea.entries()].map(([area, areaRows]) => {
        const color = AREA_COLOR[area] || '#6b7280'
        return (
          <div key={area} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '3px 10px' }}>{area}</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{areaRows.length} estados</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                {areaRows.filter(r => r.se_puede_liberar === false).length} bloqueantes
              </span>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f8faf8', borderBottom: '1px solid #e8eae8' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, whiteSpace: 'nowrap' }}>Seq</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10 }}>Estado (gap)</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10 }}>Descripción</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, whiteSpace: 'nowrap' }}>Gestión</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#555', fontSize: 10, whiteSpace: 'nowrap' }}>Se puede liberar</th>
                  </tr>
                </thead>
                <tbody>
                  {areaRows.map(row => (
                    <tr key={row.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 10px', color: '#9ca3af', fontSize: 10, textAlign: 'center' }}>{row.secuencia ?? '—'}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 10, fontWeight: 600 }}>{row.gap}</td>
                      <td style={{ padding: '6px 10px', color: '#4b5563', fontSize: 10, maxWidth: 360 }}>{row.descripcion || <span style={{ color: '#d4d4d8' }}>—</span>}</td>
                      <td style={{ padding: '6px 10px', color: '#6b7280', fontSize: 10, whiteSpace: 'nowrap' }}>{row.gestion || <span style={{ color: '#d4d4d8' }}>—</span>}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {saving === row.id
                          ? <span style={{ fontSize: 10, color: '#9ca3af' }}>…</span>
                          : <LibBadge value={row.se_puede_liberar} onClick={() => cycleValue(row)} />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* ── Agregar nuevo estado ── */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Agregar Estado</div>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="fg" style={{ flex: '2 1 180px' }}>
              <label className="fl">Gap (nombre del estado) *</label>
              <input className="fc" value={form.gap} onChange={e => setForm(f => ({ ...f, gap: e.target.value }))} placeholder="Ej: 0100.Nuevo_Estado" style={{ fontSize: 11 }} />
            </div>
            <div className="fg" style={{ flex: '1 1 120px' }}>
              <label className="fl">Área *</label>
              <select className="fc" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} style={{ fontSize: 11 }}>
                {[...new Set([...AREAS_ORDER, ...areas])].map(a => <option key={a} value={a}>{a}</option>)}
                <option value="__nueva__">+ Nueva área…</option>
              </select>
            </div>
            {form.area === '__nueva__' && (
              <div className="fg" style={{ flex: '1 1 120px' }}>
                <label className="fl">Nombre nueva área</label>
                <input className="fc" placeholder="Ej: NUEVA_AREA" onChange={e => setForm(f => ({ ...f, area: e.target.value || '__nueva__' }))} style={{ fontSize: 11 }} />
              </div>
            )}
            <div className="fg" style={{ flex: '0 1 60px' }}>
              <label className="fl">Seq</label>
              <input className="fc" type="number" value={form.secuencia} onChange={e => setForm(f => ({ ...f, secuencia: e.target.value }))} style={{ fontSize: 11 }} />
            </div>
            <div className="fg" style={{ flex: '3 1 220px' }}>
              <label className="fl">Descripción</label>
              <input className="fc" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Opcional" style={{ fontSize: 11 }} />
            </div>
            <div className="fg" style={{ flex: '1 1 100px' }}>
              <label className="fl">Gestión</label>
              <input className="fc" value={form.gestion} onChange={e => setForm(f => ({ ...f, gestion: e.target.value }))} placeholder="SS_E2E" style={{ fontSize: 11 }} />
            </div>
            <div className="fg" style={{ flex: '0 1 140px' }}>
              <label className="fl">Se puede liberar</label>
              <select className="fc" value={form.se_puede_liberar === null ? 'null' : String(form.se_puede_liberar)} onChange={e => setForm(f => ({ ...f, se_puede_liberar: e.target.value === 'null' ? null : e.target.value === 'true' }))} style={{ fontSize: 11 }}>
                <option value="null">— No definido</option>
                <option value="true">SI</option>
                <option value="false">NO</option>
              </select>
            </div>
            <button type="submit" disabled={adding} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: adding ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'flex-end', marginBottom: 1, opacity: adding ? .6 : 1 }}>
              {adding ? 'Agregando…' : '+ Agregar'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
