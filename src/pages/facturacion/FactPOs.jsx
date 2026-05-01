import { useRef, useState } from 'react'
import { useFactStore } from '../../store/useFactStore'
import { showToast } from '../../components/Toast'

function EditModal({ po, onClose, onSave }) {
  const [form, setForm] = useState({ valor: po.valor || '', moneda: po.moneda || 'COP', smp_id: po.smp_id || '', supplier_name: po.supplier_name || '', payment_terms: po.payment_terms || '', pci_description: po.pci_description || '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(po.id, { ...form, valor: form.valor ? Number(String(form.valor).replace(/\./g, '').replace(',', '.')) : null })
      showToast('PO actualizada')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Editar PO</div>
        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 18 }}>SPO {po.spo_number} · {po.site_name || po.site_id}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="fg" style={{ flex: 2 }}><label className="fl">Valor</label><input className="fc" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="4180241" /></div>
            <div className="fg" style={{ flex: 1 }}><label className="fl">Moneda</label><select className="fc" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}><option>COP</option><option>USD</option><option>EUR</option></select></div>
          </div>
          <div className="fg">
            <label className="fl">SMP ID {!po.smp_id && <span style={{ color: '#ef4444', fontSize: 9, fontWeight: 700, marginLeft: 4 }}>Sin dato del PDF</span>}</label>
            <input className="fc" value={form.smp_id} onChange={e => setForm(f => ({ ...f, smp_id: e.target.value }))} placeholder="SMP-WO-0000000" />
          </div>
          <div className="fg"><label className="fl">Proveedor</label><input className="fc" value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Condición de pago</label><input className="fc" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Descripción (PCI)</label><input className="fc" value={form.pci_description} onChange={e => setForm(f => ({ ...f, pci_description: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{saving ? 'Guardando…' : '✓ Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function RechazadosModal({ items, onClose, onDelete }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>PDFs Rechazados</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#71717a' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 16 }}>
          SPOs que no coincidieron con el PPA cargado. Revísalos y elimina los que ya no apliquen.
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca89c', fontSize: 13 }}>Sin registros rechazados.</div>
        ) : (
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f8faf8' }}>
                  {['Archivo', 'SPO extraído', 'Fecha', ''].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, position: 'sticky', top: 0, background: '#f8faf8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '7px 10px', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.filename}>{r.filename}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#ef4444' }}>{r.spo_number || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#71717a', fontSize: 10 }}>{r.rejected_at ? new Date(r.rejected_at).toLocaleDateString('es-CO') : '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <button onClick={() => onDelete(r.id)} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 20px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export default function FactPOs() {
  const fileRef          = useRef(null)
  const uploadPOPdf      = useFactStore(s => s.uploadPOPdf)
  const actualizarPO     = useFactStore(s => s.actualizarPO)
  const deleteRejectedPo = useFactStore(s => s.deleteRejectedPo)
  const uploading        = useFactStore(s => s.uploading)
  const pos              = useFactStore(s => s.pos)
  const ppa              = useFactStore(s => s.ppa)
  const rejectedPos      = useFactStore(s => s.rejectedPos)

  const [search,         setSearch]         = useState('')
  const [editPO,         setEditPO]         = useState(null)
  const [showRechazados, setShowRechazados] = useState(false)

  async function handleFiles(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    let ok = 0, lastErr = ''
    for (const file of files) {
      const result = await uploadPOPdf(file)
      result.ok ? ok++ : (lastErr = result.error || 'error desconocido')
    }
    if (ok)      showToast(`${ok} PO${ok > 1 ? 's' : ''} cargada${ok > 1 ? 's' : ''}`)
    if (lastErr) showToast(`Error al leer PDF: ${lastErr}`, 'err')
    e.target.value = ''
  }

  const fmtCOP = (v, mon) => v
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: mon || 'COP', maximumFractionDigits: 0 }).format(v)
    : '—'

  const enriched = pos
    .map(po => {
      const ppaRow = ppa.find(r => r.spo_number === po.spo_number)
      return { ...po, ms_name: ppaRow?.ms_name || '', customer_site_name: ppaRow?.customer_site_name || po.site_name || '' }
    })
    .filter(po => !search || `${po.spo_number} ${po.customer_site_name} ${po.site_id} ${po.smp_id}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.spo_number.localeCompare(b.spo_number))

  const sinPO = [...new Set(ppa.map(r => r.spo_number))].filter(spo => !pos.find(p => p.spo_number === spo))

  return (
    <>
      {editPO && <EditModal po={editPO} onClose={() => setEditPO(null)} onSave={actualizarPO} />}
      {showRechazados && <RechazadosModal items={rejectedPos} onClose={() => setShowRechazados(false)} onDelete={deleteRejectedPo} />}

      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            POs
            {rejectedPos.length > 0 && (
              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 9px', cursor: 'pointer' }} onClick={() => setShowRechazados(true)}>
                {rejectedPos.length} rechazado{rejectedPos.length !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
            {pos.length} PO{pos.length !== 1 ? 's' : ''} cargada{pos.length !== 1 ? 's' : ''}
            {sinPO.length > 0 && <span style={{ marginLeft: 10, color: '#f59e0b', fontWeight: 600 }}>{sinPO.length} SPO{sinPO.length > 1 ? 's' : ''} sin PO</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fc" placeholder="Buscar SPO, sitio…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 200 }} />
          {rejectedPos.length > 0 && (
            <button onClick={() => setShowRechazados(true)} style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600 }}>
              Ver rechazados ({rejectedPos.length})
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: '#144E4A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5 }}>
            {uploading ? '⏳ Leyendo…' : '↑ Subir PDF(s) de PO'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleFiles} />
        </div>
      </div>

      {sinPO.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: '#92400e' }}>
          <strong>SPOs sin PO cargada:</strong> {sinPO.slice(0, 8).join(', ')}{sinPO.length > 8 ? ` y ${sinPO.length - 8} más…` : ''}
        </div>
      )}

      {enriched.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca89c', fontSize: 13 }}>
          {pos.length === 0 ? 'Sube los PDFs de PO para registrar los valores.' : 'Sin resultados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8faf8', borderBottom: '2px solid #e8eae8' }}>
                {['SPO', 'Sitio', 'SMP ID', 'MS Name', 'Fecha PO', 'Valor', 'Proveedor', 'PDF', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.map(po => (
                <tr key={po.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700 }}>{po.spo_number}</td>
                  <td style={{ padding: '7px 10px' }}>{po.customer_site_name}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{po.smp_id}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }}>{po.ms_name}</td>
                  <td style={{ padding: '7px 10px', color: '#555' }}>{po.doc_date || '—'}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 700, color: '#144E4A' }}>{fmtCOP(po.valor, po.moneda)}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: '#555', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{po.supplier_name || '—'}</td>
                  <td style={{ padding: '7px 10px' }}>
                    {po.pdf_url ? <a href={po.pdf_url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontSize: 10, fontWeight: 600 }}>Ver PDF</a> : <span style={{ color: '#d4d4d8', fontSize: 10 }}>—</span>}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <button onClick={() => setEditPO(po)} style={{ fontSize: 10, color: '#555', background: 'none', border: '1px solid #e0e4e0', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
