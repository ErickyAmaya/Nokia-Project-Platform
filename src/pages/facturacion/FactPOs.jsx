import { useRef, useState, useEffect, useMemo } from 'react'
import { useFactStore, computeChanges, EVENTOS } from '../../store/useFactStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { parsePOPdf } from '../../lib/pdfParser'
import { useConfirm } from '../../components/ConfirmModal'

function RechazadosModal({ items, onClose, onDelete }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>PDFs Rechazados</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#4b5563' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 16 }}>
          SPOs que no coincidieron con el PPA cargado. Revísalos y elimina los que ya no apliquen.
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#617561', fontSize: 13 }}>Sin registros rechazados.</div>
        ) : (
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                  {['Archivo', 'SPO extraído', 'Fecha', ''].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#92400e', fontSize: 11, position: 'sticky', top: 0, background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '7px 10px', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.filename}>{r.filename}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#ef4444' }}>{r.spo_number || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#4b5563', fontSize: 10 }}>{r.rejected_at ? new Date(r.rejected_at).toLocaleDateString('es-CO') : '—'}</td>
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

const fmtVal = (v, mon = 'COP') => v != null
  ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: mon, maximumFractionDigits: 0 }).format(v)
  : '—'

const PRESERVED_ON_CANCEL = ['valor', 'moneda', 'smp_id']

const PO_FIELDS = [
  { key: 'valor',           label: 'Valor',             fmt: (v, mon) => fmtVal(v, mon) },
  { key: 'moneda',          label: 'Moneda',            fmt: v => v || '—' },
  { key: 'smp_id',          label: 'SMP ID',            fmt: v => v || '—' },
  { key: 'supplier_name',   label: 'Proveedor',         fmt: v => v || '—' },
  { key: 'payment_terms',   label: 'Condición de pago', fmt: v => v || '—' },
  { key: 'pci_description', label: 'Descripción PCI',   fmt: v => v || '—' },
  { key: 'doc_date',        label: 'Fecha PO',          fmt: v => v || '—' },
]

function UpdateConfirmModal({ preview, spoInvoices, uploading, queueTotal, queueIndex, onClose, onConfirm }) {
  const { extracted, existing } = preview
  const isCancelled = preview.isCancelled || false

  const [notaCreditoNum,   setNotaCreditoNum]   = useState('')
  const [notaCreditoFecha, setNotaCreditoFecha] = useState('')

  // For cancelled POs the store preserves key fields — show effective values in preview
  const effectiveExtracted = isCancelled ? {
    ...extracted,
    valor:     existing.valor,
    moneda:    existing.moneda,
    smp_id:    existing.smp_id,
    site_name: existing.site_name,
    site_id:   existing.site_id,
  } : extracted

  const changes         = computeChanges(existing, effectiveExtracted)
  const hasChanges      = Object.keys(changes).length > 0
  const valorChanged    = 'valor' in changes
  const showNotaCredito = !isCancelled && valorChanged && spoInvoices.length > 0
  const onlySmpIdChanged = hasChanges && Object.keys(changes).length === 1 && 'smp_id' in changes

  function handleConfirmClick() {
    onConfirm({
      notaCredito:     showNotaCredito ? { numero: notaCreditoNum || null, fecha: notaCreditoFecha || null } : null,
      invoicesToReset: showNotaCredito ? spoInvoices : [],
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 540, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>Actualización de PO</div>
          {queueTotal > 1 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px' }}>
              {queueTotal - queueIndex} de {queueTotal}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 16 }}>SPO {extracted.spo_number} · ya existe un registro en la plataforma</div>

        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginBottom: 14 }}>
          <thead>
            <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
              {['Campo', 'Actual', 'Nuevo PDF'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#92400e', borderBottom: '1px solid #fcd34d' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PO_FIELDS.map(({ key, label, fmt }) => {
              const changed = key in changes
              return (
                <tr key={key} style={{ borderTop: '1px solid #f0f0f0', background: changed ? '#fefce8' : undefined }}>
                  <td style={{ padding: '6px 10px', color: '#555', fontWeight: changed ? 700 : 400 }}>{label}</td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: changed ? '#b45309' : '#374151', textDecoration: changed ? 'line-through' : undefined }}>
                    {fmt(existing[key], existing.moneda)}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: changed ? '#166534' : '#374151', fontWeight: changed ? 700 : 400 }}>
                    {fmt(effectiveExtracted[key], effectiveExtracted.moneda)}
                    {isCancelled && PRESERVED_ON_CANCEL.includes(key) && String(extracted[key] ?? '') !== String(existing[key] ?? '') && (
                      <span style={{ color: '#dc2626', marginLeft: 5, fontWeight: 400 }}>
                        ({fmt(extracted[key], extracted.moneda)})
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {isCancelled && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#991b1b', marginBottom: 10, fontWeight: 700 }}>
            🚫 Nokia canceló esta PO — se marcará como excluida al confirmar
          </div>
        )}

        {onlySmpIdChanged ? (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#1e40af', marginBottom: 10 }}>
            ℹ Se detectó una mejora en la extracción del SMP ID — el PDF no cambió.
          </div>
        ) : hasChanges ? (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400e', marginBottom: 10 }}>
            ⚠ {Object.keys(changes).length} campo{Object.keys(changes).length !== 1 ? 's' : ''} con cambios detectados. El PDF anterior será eliminado.
          </div>
        ) : (
          <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
            ℹ Sin cambios detectados. El PDF será reemplazado de todas formas.
          </div>
        )}

        {showNotaCredito && (
          <div style={{ border: '1px solid #fbbf24', borderRadius: 8, background: '#fffbeb', padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#92400e', marginBottom: 6 }}>
              Ajuste de precio — facturas a revertir
            </div>
            <div style={{ fontSize: 11, color: '#78350f', marginBottom: 8 }}>
              El cambio de valor requiere nota de crédito. Las siguientes facturas serán eliminadas del sistema al confirmar:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {spoInvoices.map(inv => (
                <div key={inv.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, padding: '2px 0' }}>
                  <span style={{ fontWeight: 700, color: '#b45309', minWidth: 90 }}>
                    {EVENTOS.find(e => e.key === inv.evento)?.label || inv.evento}
                  </span>
                  {inv.numero_factura && <span style={{ color: '#6b7280' }}>Fact. {inv.numero_factura}</span>}
                  {inv.pct != null && <span style={{ color: '#9ca3af' }}>{inv.pct}%</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="fg" style={{ flex: 1 }}>
                <label className="fl">N° Nota de Crédito <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
                <input className="fc" placeholder="NC-2024-001" value={notaCreditoNum} onChange={e => setNotaCreditoNum(e.target.value)} />
              </div>
              <div className="fg" style={{ flex: 1 }}>
                <label className="fl">Fecha <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
                <input className="fc" type="date" value={notaCreditoFecha} onChange={e => setNotaCreditoFecha(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {!showNotaCredito && valorChanged && spoInvoices.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#991b1b', marginBottom: 10 }}>
            ⚠ Esta PO tiene facturas registradas. El valor en Facturado se recalculará con el nuevo valor.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
            {queueTotal > 1 ? 'Omitir' : 'Cancelar'}
          </button>
          <button onClick={handleConfirmClick} disabled={uploading} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#144E4A', color: '#fff', cursor: uploading ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, opacity: uploading ? .6 : 1 }}>
            {uploading ? '⏳ Actualizando…' : '✓ Confirmar actualización'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistorialModal({ po, historial, onClose, onReactivar, isViewer }) {
  const spo_number = po.spo_number
  const items = historial.filter(h => h.spo_number === spo_number)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>Historial de actualizaciones</div>
            <div style={{ fontSize: 11, color: '#4b5563' }}>SPO {spo_number}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#4b5563' }}>✕</button>
        </div>
        {po.cancelled && !isViewer && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#991b1b' }}>Esta PO está marcada como <strong>cancelada</strong> — excluida de los cálculos.</span>
            <button
              onClick={() => onReactivar(po)}
              style={{ fontSize: 10, fontWeight: 700, color: '#166534', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ↺ Reactivar
            </button>
          </div>
        )}
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 11, fontStyle: 'italic' }}>
            Sin historial registrado para esta PO.
          </div>
        )}
        {items.map((h, i) => {
          const changesArr = Object.entries(h.changes || {})
          return (
            <div key={h.id} style={{ borderTop: i > 0 ? '1px solid #f0f0f0' : undefined, paddingTop: i > 0 ? 14 : 0, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 5, padding: '1px 7px' }}>
                  {new Date(h.changed_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                {h.changed_by && <span style={{ fontSize: 10, color: '#6b7280' }}>{h.changed_by}</span>}
              </div>
              {changesArr.length === 0 ? (
                <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Sin cambios detectados — PDF reemplazado</div>
              ) : (
                changesArr.map(([key, { old: oldVal, new: newVal }]) => {
                  const field = PO_FIELDS.find(f => f.key === key)
                  const label = key === 'cancelled' ? 'Cancelada' : (field?.label || key)
                  const fmtBool = v => key === 'cancelled' ? (v ? 'Sí' : 'No') : (v ?? '—')
                  return (
                    <div key={key} style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{label}:</span>{' '}
                      <span style={{ textDecoration: 'line-through', color: '#b45309' }}>{fmtBool(oldVal)}</span>
                      {' → '}
                      <span style={{ color: '#166534', fontWeight: 700 }}>{fmtBool(newVal)}</span>
                    </div>
                  )
                })
              )}
              {h.nota_credito && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: '#92400e' }}>Nota de Crédito</span>
                  {h.nota_credito.numero && <span style={{ color: '#374151', marginLeft: 6 }}>N° {h.nota_credito.numero}</span>}
                  {h.nota_credito.fecha  && <span style={{ color: '#6b7280',  marginLeft: 8 }}>{new Date(h.nota_credito.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FactPOs() {
  const fileRef                  = useRef(null)
  const uploadPOPdf              = useFactStore(s => s.uploadPOPdf)
  const confirmarActualizacionPO = useFactStore(s => s.confirmarActualizacionPO)
  const loadHistorial            = useFactStore(s => s.loadHistorial)
  const toggleCancelarPO         = useFactStore(s => s.toggleCancelarPO)
  const deleteRejectedPo         = useFactStore(s => s.deleteRejectedPo)
  const uploading                = useFactStore(s => s.uploading)
  const pos                      = useFactStore(s => s.pos)
  const ppa                      = useFactStore(s => s.ppa)
  const invoices                 = useFactStore(s => s.invoices)
  const historial                = useFactStore(s => s.historial)
  const rejectedPos              = useFactStore(s => s.rejectedPos)

  const user     = useAuthStore(s => s.user)
  const isViewer = user?.role === 'viewer'
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,          setSearch]          = useState('')
  const [filtro,          setFiltro]          = useState('todas')
  const [updatePreview,   setUpdatePreview]   = useState(null)   // { file, extracted, existing, changes }
  const [pendingUpdates,  setPendingUpdates]  = useState([])    // cola de POs existentes por confirmar
  const [historialModal,  setHistorialModal]  = useState(null)  // po completo
  const [showRechazados,  setShowRechazados]  = useState(false)

  // Carga historial solo al entrar a esta página (no en el loadAll global)
  useEffect(() => { loadHistorial() }, [loadHistorial])

  const [compact, setCompact] = useState(
    typeof window !== 'undefined' && window.innerHeight < 600
  )
  useEffect(() => {
    function onResize() { setCompact(window.innerHeight < 600) }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  async function handleFiles(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    e.target.value = ''

    const parsed = []
    for (const file of files) {
      try {
        const extracted = await parsePOPdf(file)
        if (!extracted.spo_number) { showToast(`${file.name}: no se pudo extraer el SPO`, 'err'); continue }
        parsed.push({ file, extracted })
      } catch (err) {
        showToast(`Error al leer ${file.name}: ${err.message}`, 'err')
      }
    }

    const newPOs      = parsed.filter(({ extracted }) => !pos.find(p => p.spo_number === extracted.spo_number))
    const existingPOs = parsed.filter(({ extracted }) =>  pos.find(p => p.spo_number === extracted.spo_number))

    // Nuevas POs: subir directamente
    let ok = 0, lastErr = ''
    for (const { file } of newPOs) {
      const result = await uploadPOPdf(file)
      result.ok ? ok++ : (lastErr = result.error || 'error desconocido')
    }
    if (ok)      showToast(`${ok} PO${ok > 1 ? 's' : ''} cargada${ok > 1 ? 's' : ''}`)
    if (lastErr) showToast(`Error al leer PDF: ${lastErr}`, 'err')

    // POs existentes: encolar y mostrar modal para la primera
    if (existingPOs.length > 0) {
      const queue = existingPOs.map(({ file, extracted }) => {
        const existing = pos.find(p => p.spo_number === extracted.spo_number)
        return { file, extracted, existing, changes: computeChanges(existing, extracted), isCancelled: !!extracted.isCancelled }
      })
      if (queue.length > 1) showToast(`${queue.length} POs ya existen — confírmalas una a una`, 'err')
      const [first, ...rest] = queue
      setUpdatePreview(first)
      setPendingUpdates(rest)
    }
  }

  function advanceUpdateQueue() {
    if (pendingUpdates.length > 0) {
      const [next, ...rest] = pendingUpdates
      setUpdatePreview(next)
      setPendingUpdates(rest)
    } else {
      setUpdatePreview(null)
    }
  }

  async function handleConfirmarActualizacion({ notaCredito, invoicesToReset } = {}) {
    if (!updatePreview) return
    const result = await confirmarActualizacionPO({ ...updatePreview, changedBy: user?.email, notaCredito, invoicesToReset: invoicesToReset || [] })
    if (result.ok) {
      const remaining = pendingUpdates.length
      const resetMsg  = invoicesToReset?.length > 0 ? ` — ${invoicesToReset.length} factura${invoicesToReset.length !== 1 ? 's' : ''} revertida${invoicesToReset.length !== 1 ? 's' : ''}` : ''
      showToast(`PO actualizada${resetMsg}${remaining > 0 ? ` — ${remaining} pendiente${remaining !== 1 ? 's' : ''}` : ''}`)
    } else {
      showToast('Error al actualizar: ' + result.error, 'err')
    }
    advanceUpdateQueue()
  }

  // Respaldo manual — lo normal es que la cancelación/reactivación venga del PDF de Nokia.
  async function handleReactivar(po) {
    const ok = await confirm(
      'Reactivar PO',
      `¿Reactivar la PO ${po.spo_number}? Volverá a incluirse en los cálculos de facturación.`
    )
    if (!ok) return
    try {
      await toggleCancelarPO(po.id, false, user?.email)
      showToast('PO reactivada')
      setHistorialModal(null)
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    }
  }

  async function handleExportExcel() {
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('POs')

      ws.columns = [
        { header: 'SPO Number',        key: 'spo',     width: 20 },
        { header: 'Fecha PO',          key: 'fecha',   width: 14 },
        { header: 'Sitio',             key: 'sitio',   width: 30 },
        { header: 'SMP ID',            key: 'smp_id',  width: 22 },
        { header: 'MS / SMP Name',     key: 'ms',      width: 30 },
        { header: 'Valor',             key: 'valor',   width: 18 },
        { header: 'Moneda',            key: 'moneda',  width: 9  },
        { header: 'Proveedor',         key: 'prov',    width: 26 },
        { header: 'Condición de Pago', key: 'terms',   width: 22 },
        { header: 'Descripción PCI',   key: 'pci',     width: 34 },
        { header: 'Descripción',       key: 'desc',    width: 34 },
        { header: 'PDF',               key: 'pdf',     width: 6  },
      ]

      const sorted = [...pos].sort((a, b) => {
        const pa = ppaMap.get(a.spo_number), pb = ppaMap.get(b.spo_number)
        const ad = a.doc_date || pa?.spo_date || '', bd = b.doc_date || pb?.spo_date || ''
        return bd.localeCompare(ad)
      })

      function parseAnyDate(str) {
        if (!str) return null
        // ISO: YYYY-MM-DD
        let d = new Date(str)
        if (!isNaN(d.getTime())) return d
        // DD/MM/YYYY · DD-MM-YYYY · DD.MM.YYYY
        const m1 = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
        if (m1) {
          d = new Date(+m1[3], +m1[2] - 1, +m1[1], 12)
          if (!isNaN(d.getTime())) return d
        }
        // YYYY/MM/DD
        const m2 = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
        if (m2) {
          d = new Date(+m2[1], +m2[2] - 1, +m2[3], 12)
          if (!isNaN(d.getTime())) return d
        }
        // DD-Mon-YYYY  e.g. 15-Jan-2024
        const m3 = str.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})/)
        if (m3) {
          d = new Date(`${m3[2]} ${m3[1]} ${m3[3]} 12:00:00`)
          if (!isNaN(d.getTime())) return d
        }
        // DDMmmYYYY  e.g. 31Oct2025
        const m4 = str.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})/)
        if (m4) {
          d = new Date(`${m4[2]} ${m4[1]} ${m4[3]} 12:00:00`)
          if (!isNaN(d.getTime())) return d
        }
        return null
      }

      sorted.forEach(po => {
        const ppaRow   = ppaMap.get(po.spo_number)
        const fechaStr = po.doc_date || ppaRow?.spo_date || ''
        const fechaVal = parseAnyDate(fechaStr) || (fechaStr || null)
        const spoNum   = po.spo_number && !isNaN(Number(po.spo_number)) ? Number(po.spo_number) : po.spo_number

        ws.addRow({
          spo:    spoNum,
          fecha:  fechaVal,
          sitio:  ppaRow?.customer_site_name || po.site_name || '',
          smp_id: ppaRow?.smp_id || po.smp_id || '',
          ms:     ppaRow?.smp_name === 'Process_Implementation' ? (ppaRow?.ms_name || '') : (ppaRow?.smp_name || ''),
          valor:  po.valor != null ? Number(po.valor) : null,
          moneda: po.moneda || 'COP',
          prov:   po.supplier_name || '',
          terms:  po.payment_terms || '',
          pci:    po.pci_description || '',
          desc:   po.pci_description || po.descripcion_libre || '',
          pdf:    po.pdf_url ? 'Sí' : 'No',
        })
      })

      ws.getColumn('fecha').numFmt = 'dd/mm/yyyy'
      ws.getColumn('valor').numFmt = '#,##0'

      // Header style
      ws.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FF92400E' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      })

      const buffer = await wb.xlsx.writeBuffer()
      const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url    = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href       = url
      a.download   = `POs_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`${sorted.length} POs exportadas`)
    } catch (e) { showToast('Error al exportar: ' + e.message, 'err') }
  }

  const spoInvoices = useMemo(
    () => updatePreview ? invoices.filter(i => i.spo_number === updatePreview.existing?.spo_number) : [],
    [invoices, updatePreview]
  )

  const historialMap = useMemo(() => {
    const map = {}
    for (const h of historial) {
      if (!map[h.spo_number]) map[h.spo_number] = h  // ya ordenado desc por changed_at
    }
    return map
  }, [historial])

  const fmtCOP = (v, mon) => fmtVal(v, mon)

  const ppaMap = useMemo(() => new Map(ppa.map(r => [r.spo_number, r])), [ppa])

  // Universo completo de SPOs: unión de PPA (lo que Nokia reconoce) + PDFs cargados.
  // Las que no tienen PDF se muestran igual, como filas "sin PDF" (sin valor/proveedor).
  const allRows = useMemo(() => {
    const posMap  = new Map(pos.map(p => [p.spo_number, p]))
    const allSpos = new Set([...ppaMap.keys(), ...posMap.keys()])
    return [...allSpos].map(spo => {
      const po     = posMap.get(spo)
      const ppaRow = ppaMap.get(spo)
      if (po) {
        return {
          ...po,
          smp_id: ppaRow?.smp_id || po.smp_id,
          ms_name: ppaRow?.ms_name || '', smp_name: ppaRow?.smp_name || '',
          customer_site_name: ppaRow?.customer_site_name || po.site_name || '',
          spo_date: ppaRow?.spo_date || '', _hasPdf: !!po.pdf_url,
        }
      }
      // Sin PDF — fila sintética a partir del PPA
      return {
        id: `ppa-${spo}`, spo_number: spo, cancelled: false, valor: null, moneda: 'COP',
        smp_id: ppaRow?.smp_id || '',
        supplier_name: '', payment_terms: '', pci_description: '', doc_date: '', pdf_url: null,
        ms_name: ppaRow?.ms_name || '', smp_name: ppaRow?.smp_name || '',
        customer_site_name: ppaRow?.customer_site_name || ppaRow?.site_reference_id || '',
        spo_date: ppaRow?.spo_date || '', _hasPdf: false, _synthetic: true,
      }
    })
  }, [pos, ppaMap])

  const sinPdfCount    = useMemo(() => allRows.filter(r => !r._hasPdf).length, [allRows])
  const cancelledCount = useMemo(() => allRows.filter(r =>  r.cancelled).length, [allRows])

  const enriched = useMemo(() => allRows
    .filter(po => {
      if (filtro === 'activas')    return !po.cancelled
      if (filtro === 'canceladas') return  po.cancelled
      if (filtro === 'sin_pdf')    return !po._hasPdf
      return true
    })
    .filter(po => !search || `${po.spo_number} ${po.customer_site_name} ${po.ms_name} ${po.smp_name} ${po.smp_id} ${po.pci_description || ''} ${po.descripcion_libre || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ad = a.spo_date || a.doc_date || '', bd = b.spo_date || b.doc_date || ''
      if (!ad && !bd) return 0
      if (!ad) return 1
      if (!bd) return -1
      return bd.localeCompare(ad)
    }), [allRows, search, filtro])

  return (
    <>
      <ConfirmModalUI />
      {updatePreview && <UpdateConfirmModal preview={updatePreview} spoInvoices={spoInvoices} uploading={uploading} queueTotal={pendingUpdates.length + 1} queueIndex={pendingUpdates.length} onClose={advanceUpdateQueue} onConfirm={handleConfirmarActualizacion} />}
      {historialModal && <HistorialModal po={historialModal} historial={historial} onClose={() => setHistorialModal(null)} onReactivar={handleReactivar} isViewer={isViewer} />}
      {showRechazados && <RechazadosModal items={rejectedPos} onClose={() => setShowRechazados(false)} onDelete={deleteRejectedPo} />}

      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            POs
            {rejectedPos.length > 0 && (
              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '3px 11px', cursor: 'pointer' }} onClick={() => setShowRechazados(true)}>
                {rejectedPos.length} rechazado{rejectedPos.length !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            {pos.length} PO{pos.length !== 1 ? 's' : ''} cargada{pos.length !== 1 ? 's' : ''}
            {sinPdfCount > 0 && <span style={{ marginLeft: 10, color: '#b45309', fontWeight: 600 }}>⚠ {sinPdfCount} sin PDF</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fc" placeholder="Buscar SPO, sitio…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 200 }} />
          <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: 11, width: 'auto' }}>
            <option value="activas">Activas ({allRows.filter(p => !p.cancelled).length})</option>
            <option value="canceladas">Canceladas ({cancelledCount})</option>
            <option value="sin_pdf">Sin PDF ({sinPdfCount})</option>
            <option value="todas">Todas ({allRows.length})</option>
          </select>
          {pos.length > 0 && (
            <button onClick={handleExportExcel} style={{ fontSize: 11, color: '#166534', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
              Exportar POs
            </button>
          )}
          {rejectedPos.length > 0 && (
            <button onClick={() => setShowRechazados(true)} style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600 }}>
              Ver rechazados ({rejectedPos.length})
            </button>
          )}
          {!isViewer && <>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: '#144E4A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5 }}>
              {uploading ? '⏳ Leyendo…' : '↑ Subir PDF(s) de PO'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleFiles} />
          </>}
        </div>
      </div>

      {enriched.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#617561', fontSize: 13 }}>
          {pos.length === 0 ? 'Sube los PDFs de PO para registrar los valores.' : 'Sin resultados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: compact ? 'calc(100vh - 210px)' : '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                {[
                  { h: 'SPO',          w: 90  },
                  { h: 'Fecha PO',     w: undefined },
                  { h: 'Sitio',        w: undefined },
                  { h: 'SMP ID',       w: undefined },
                  { h: 'MS/SMP Name',  w: undefined },
                  { h: 'Descripción',  w: undefined },
                  { h: 'Valor',        w: undefined },
                  { h: 'PDF',          w: 70  },
                ].map(({ h, w }) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#92400e', fontSize: 11, letterSpacing: .5, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#fffbeb', borderBottom: '1px solid #fcd34d', zIndex: 1, width: w }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.map(po => (
                <tr key={po.id} style={{ borderTop: '1px solid #f0f0f0', opacity: po.cancelled ? 0.55 : 1, background: po._synthetic ? '#fffdf5' : undefined }}>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700 }}>
                    {po.spo_number}
                    {po.cancelled && (
                      <span
                        onClick={() => !po._synthetic && setHistorialModal(po)}
                        title={!po._synthetic ? 'Ver detalle / reactivar' : ''}
                        style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle', cursor: po._synthetic ? 'default' : 'pointer' }}
                      >
                        Cancelada
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '7px 10px', color: '#555' }}>{po.doc_date || '—'}</td>
                  <td style={{ padding: '7px 10px' }}>{po.customer_site_name}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{po.smp_id}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: '#555' }}>{po.smp_name === 'Process_Implementation' ? po.ms_name : po.smp_name}</td>
                  <td style={{ padding: '7px 10px', fontSize: 10, color: '#555', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={po.pci_description || po.descripcion_libre || ''}>{po.pci_description || po.descripcion_libre || '—'}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 700, color: '#144E4A' }}>{fmtCOP(po.valor, po.moneda)}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {po.pdf_url
                        ? <a href={po.pdf_url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontSize: 10, fontWeight: 600 }}>Ver PDF</a>
                        : po._synthetic
                          ? <span style={{ color: '#b45309', fontSize: 9, fontWeight: 700, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>Sin PDF</span>
                          : <span style={{ color: '#d4d4d8', fontSize: 10 }}>—</span>}
                      {historialMap[po.spo_number] && (
                        <span
                          onClick={() => setHistorialModal(po)}
                          style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Actualizado · {new Date(historialMap[po.spo_number].changed_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
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
