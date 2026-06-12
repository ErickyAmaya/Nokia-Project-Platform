import { useState, useMemo } from 'react'
import { showToast } from '../../../components/Toast'
import { EventoBadge } from './helpers'

const EMPTY_FORM = { numero_factura: '', fecha_factura: '', observaciones: '' }

export default function FacturarModal({ row, ev, siblingEv, pos, invoices, onClose, onSave }) {
  const [form, setForm]   = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const poData = pos.find(p => p.spo_number === row.spo_number)

  const conflicto = useMemo(() => {
    const num = form.numero_factura.trim()
    if (!num) return null
    const matches = invoices.filter(inv => inv.numero_factura === num)
    const otraPO  = matches.find(inv => inv.spo_number !== row.spo_number)
    if (otraPO)  return { tipo: 'otra_po',  spo: otraPO.spo_number }
    return null
  }, [form.numero_factura, invoices, row.spo_number])

  async function handleSave() {
    if (!form.numero_factura.trim()) { showToast('Ingresa el número de factura', 'err'); return }
    if (conflicto?.tipo === 'otra_po') return
    setSaving(true)
    try {
      const payload = { numero_factura: form.numero_factura.trim(), fecha_factura: form.fecha_factura || null, observaciones: form.observaciones || null }
      await onSave({ spo_number: row.spo_number, evento: ev.key, pct: ev.invoiceable_pct ?? ev.pct, ...payload })
      if (siblingEv) {
        await onSave({ spo_number: row.spo_number, evento: siblingEv.key, pct: siblingEv.invoiceable_pct ?? siblingEv.pct, ...payload })
      }
      showToast(siblingEv ? 'Factura registrada en ambos porcentajes' : 'Factura registrada')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Registrar Factura</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 18 }}>{row.customer_site_name} · SPO {row.spo_number}</div>
        <div style={{ background: '#f8faf8', borderRadius: 8, padding: '10px 14px', marginBottom: siblingEv ? 8 : 16, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>Evento</span><EventoBadge ev={ev} />
          </div>
          {siblingEv && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: '#555' }}>También se registrará</span><EventoBadge ev={siblingEv} />
            </div>
          )}
          {poData?.valor && (() => {
            const fmt = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: poData.moneda || 'COP', maximumFractionDigits: 0 }).format(v)
            const totalPct = (ev.invoiceable_pct ?? ev.pct) + (siblingEv ? (siblingEv.invoiceable_pct ?? siblingEv.pct) : 0)
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: '#555' }}>Valor a facturar</span>
                  <span style={{ color: '#6b7280' }}>{fmt(poData.valor)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
                  <span style={{ color: '#555' }}>{`Valor a Facturar (${totalPct}%)`}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(poData.valor * totalPct / 100)}</span>
                </div>
              </>
            )
          })()}
        </div>
        {siblingEv && (
          <div style={{ fontSize: 10, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px', marginBottom: 16 }}>
            Ambos porcentajes están disponibles — se registrarán con la misma factura.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fg">
            <label className="fl">Número de Factura *</label>
            <input className="fc" value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="FE-001-2025" />
            {conflicto?.tipo === 'otra_po' && (
              <div style={{ marginTop: 5, fontSize: 10, color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 9px' }}>
                ✕ Este número ya existe en la PO {conflicto.spo}. No es posible usar la misma factura en dos POs distintas.
              </div>
            )}
          </div>
          <div className="fg"><label className="fl">Fecha de Factura</label><input type="date" className="fc" value={form.fecha_factura} onChange={e => setForm(f => ({ ...f, fecha_factura: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Observaciones</label><input className="fc" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || conflicto?.tipo === 'otra_po'} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: conflicto?.tipo === 'otra_po' ? '#d1d5db' : '#144E4A', color: '#fff', cursor: conflicto?.tipo === 'otra_po' ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
            {saving ? 'Guardando…' : '✓ Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
