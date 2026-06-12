import { useState } from 'react'
import { showToast } from '../../../components/Toast'

export default function AcuerdoEspecialModal({ row, onClose, onSave }) {
  const [form, setForm]   = useState({ numero_factura: '', fecha_factura: '', observaciones: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.numero_factura.trim()) { showToast('Ingresa el número de factura', 'err'); return }
    setSaving(true)
    try {
      await onSave({
        spo_number:     row.spo_number,
        evento:         'servicio',
        pct:            100,
        numero_factura: form.numero_factura.trim(),
        fecha_factura:  form.fecha_factura || null,
        observaciones:  form.observaciones || null,
        absorbed:       true,
      })
      showToast('Acuerdo especial registrado')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Acuerdo Especial</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 6 }}>{row.customer_site_name} · SPO {row.spo_number}</div>
        <div style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', borderRadius: 6, padding: '6px 10px', marginBottom: 16 }}>
          {row.ms_name} · Facturado por acuerdo especial sin registro en PPA
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fg">
            <label className="fl">Número de Factura *</label>
            <input className="fc" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FE-001-2025" />
          </div>
          <div className="fg">
            <label className="fl">Fecha de Factura</label>
            <input type="date" className="fc" value={form.fecha_factura} onChange={e => setForm(f => ({ ...f, fecha_factura: e.target.value }))} />
          </div>
          <div className="fg">
            <label className="fl">Observaciones</label>
            <input className="fc" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, opacity: saving ? .6 : 1 }}>
            {saving ? 'Guardando…' : '✓ Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
