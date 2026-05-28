import { useState } from 'react'
import { useHwStore }  from '../../store/useHwStore'
import { showToast }   from '../Toast'

export default function HwLogInversaEditModal({ row, user, onClose }) {
  const updateRow          = useHwStore(s => s.updateHwLogInversa)
  const hwLiBodegasDestino = useHwStore(s => s.hwLiBodegasDestino)
  const hwLiConceptos      = useHwStore(s => s.hwLiConceptos)
  const [form, setForm] = useState({
    ni_name:       row.ni_name       || '',
    codigo_capex:  row.codigo_capex  || '',
    serial_final:  row.serial_final  || '',
    smp:           row.smp           || '',
    cantidad:      row.cantidad      ?? 1,
    concepto:      row.concepto      || '',
    bodega_destino: row.bodega_destino || '',
    notas:         row.notas         || '',
  })
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    try {
      await updateRow(row.id, { ...form, cantidad: Number(form.cantidad) || 1, updated_by: user?.nombre || '' })
      showToast('Cambios guardados')
      onClose()
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>Editar registro</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { k: 'ni_name',      label: 'NI Name' },
            { k: 'codigo_capex', label: 'Codigo Capex' },
            { k: 'serial_final', label: 'Serial Final' },
            { k: 'smp',          label: 'SMP' },
          ].map(({ k, label }) => (
            <div key={k}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>{label.toUpperCase()}</label>
              <input value={form[k]} onChange={e => set(k, e.target.value)} style={inputS} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>CONCEPTO</label>
            <select value={form.concepto} onChange={e => set('concepto', e.target.value)} style={inputS}>
              <option value="">— Seleccionar —</option>
              {hwLiConceptos.filter(c => c.activo !== false).map(c => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
              {form.concepto && !hwLiConceptos.some(c => c.nombre === form.concepto) && (
                <option value={form.concepto}>{form.concepto} (valor actual)</option>
              )}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>BODEGA DESTINO</label>
            <select value={form.bodega_destino} onChange={e => set('bodega_destino', e.target.value)} style={inputS}>
              <option value="">— Seleccionar —</option>
              {hwLiBodegasDestino.filter(b => b.activo !== false).map(b => (
                <option key={b.id} value={b.nombre}>{b.nombre}</option>
              ))}
              {form.bodega_destino && !hwLiBodegasDestino.some(b => b.nombre === form.bodega_destino) && (
                <option value={form.bodega_destino}>{form.bodega_destino} (valor actual)</option>
              )}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>NOTAS</label>
            <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} style={inputS} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>CANTIDAD</label>
            <input type="number" min={1} value={form.cantidad} onChange={e => set('cantidad', e.target.value)} style={{ ...inputS, width: 80 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving ? '#e5e7eb' : '#144E4A', color: saving ? '#9ca3af' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputS = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit' }
