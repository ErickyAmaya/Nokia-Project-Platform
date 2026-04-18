import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAppStore }  from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'
import SearchableSelect from '../../components/materiales/SearchableSelect'

// Genera número de documento correlativo
function nextDocNum(despachos) {
  const year = new Date().getFullYear()
  const nums = despachos
    .map(d => { const m = d.numero_doc?.match(/DS-\d{4}-(\d+)/); return m ? parseInt(m[1]) : 0 })
    .filter(Boolean)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `DS-${year}-${String(next).padStart(3,'0')}`
}

function DespachoWizard({ onClose }) {
  const catalogo          = useMatStore(s => s.catalogo)
  const bodegas           = useMatStore(s => s.bodegas)
  const despachos         = useMatStore(s => s.despachos)
  const getStock          = useMatStore(s => s.getStock)
  const saveDespacho      = useMatStore(s => s.saveDespacho)
  const addMovimiento     = useMatStore(s => s.addMovimiento)
  const finalizarDespacho = useMatStore(s => s.finalizarDespacho)
  const liquidadorSitios  = useAppStore(s => s.sitios)
  const user              = useAuthStore(s => s.user)

  const [step, setStep]   = useState(1)
  const [meta, setMeta]   = useState({
    numero_doc: nextDocNum(despachos),
    bodega_id: bodegas[0]?.id || '',
    sitio_id: '',   // solo para el select UI
    destino: '',    // nombre del sitio Nokia (guardado en DB)
    fecha: new Date().toISOString().slice(0,10),
    comentarios: '',
  })
  const [items, setItems]         = useState([])
  const [saving, setSaving]       = useState(false)
  const [catSel, setCatSel]       = useState('')
  const [stockWarn, setStockWarn] = useState(false)

  // Solo materiales activos (no proveedores)
  const catActiva = useMemo(() =>
    catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES')
  , [catalogo])

  // Opciones para SearchableSelect
  const materialOptions = useMemo(() =>
    catActiva.map(c => {
      const stk = getStock(c.id, Number(meta.bodega_id))
      return { value: c.id, label: c.nombre, sub: `${c.codigo} — Stock: ${stk}` }
    })
  , [catActiva, meta.bodega_id, getStock])

  function handleCatSel(val) {
    setCatSel(val)
    if (val) {
      const stk = getStock(Number(val), Number(meta.bodega_id))
      setStockWarn(stk === 0)
    } else {
      setStockWarn(false)
    }
  }

  function addItem() {
    if (!catSel) return
    const cat = catalogo.find(c => c.id === Number(catSel))
    if (!cat) return
    const stk = getStock(cat.id, Number(meta.bodega_id))
    if (stk === 0) { showToast('Sin existencias en esta bodega', 'err'); return }
    if (items.find(i => i.catalogo_id === cat.id)) { showToast('Material ya agregado', 'err'); return }
    setItems(p => [...p, { catalogo_id: cat.id, cant_solicitada: 0, cant_despachada: 0, valor_unitario: cat.costo_unitario || 0 }])
    setCatSel(''); setStockWarn(false)
  }

  function removeItem(id) { setItems(p => p.filter(i => i.catalogo_id !== id)) }

  function updateItem(id, key, val) {
    setItems(p => p.map(i => i.catalogo_id === id ? { ...i, [key]: Number(val) } : i))
  }

  function handleNextToStep3() {
    // Validar que ningún cant_despachada supere el stock
    const overStock = items.filter(i => {
      const stk = getStock(i.catalogo_id, Number(meta.bodega_id))
      return Number(i.cant_despachada) > stk
    })
    if (overStock.length > 0) {
      const names = overStock.map(i => catalogo.find(c => c.id === i.catalogo_id)?.nombre).join(', ')
      showToast(`Cantidad supera el stock: ${names}`, 'err')
      return
    }
    setStep(3)
  }

  const totalVal = items.reduce((a, i) => a + (i.cant_despachada * i.valor_unitario), 0)

  async function handleFinalizar() {
    if (!meta.bodega_id) { showToast('Selecciona una bodega', 'err'); return }
    if (items.length === 0) { showToast('Agrega al menos un material', 'err'); return }
    setSaving(true)
    try {
      const desp = await saveDespacho({ ...meta, created_by: user?.nombre || user?.email })
      for (const item of items) {
        if ((item.cant_despachada || 0) <= 0) continue
        await addMovimiento({
          numero_doc:     desp.numero_doc,
          fecha:          meta.fecha,
          catalogo_id:    item.catalogo_id,
          bodega_id:      Number(meta.bodega_id),
          sitio_id:       meta.sitio_id ? Number(meta.sitio_id) : null,
          tipo:           'Salida',
          cantidad:       item.cant_despachada,
          valor_unitario: item.valor_unitario,
          cant_solicitada:  item.cant_solicitada,
          cant_despachada:  item.cant_despachada,
          destino:        meta.destino,
          created_by:     user?.nombre || user?.email,
        })
      }
      await finalizarDespacho(desp.id)
      showToast(`Despacho ${desp.numero_doc} finalizado`)
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  const sitioNombre = meta.destino

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:680, maxHeight:'92vh', overflowY:'auto' }}>
        {/* Header */}
        <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
            Nuevo Despacho — {meta.numero_doc}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
        </div>

        {/* Steps indicator */}
        <div style={{ display:'flex', borderBottom:'2px solid #e0e4e0' }}>
          {['Datos del despacho','Materiales','Confirmar'].map((s,i) => (
            <div key={i} style={{ flex:1, textAlign:'center', padding:'8px 4px', fontSize:10, fontWeight:700,
              letterSpacing:.5, textTransform:'uppercase', cursor: i+1 < step ? 'pointer' : 'default',
              color: step===i+1 ? '#0a0a0a' : step>i+1 ? '#1a9c1a' : '#9ca89c',
              borderBottom: step===i+1 ? '3px solid #1a9c1a' : 'none', marginBottom: step===i+1?-2:0,
            }} onClick={() => { if (i+1 < step) setStep(i+1) }}>
              <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:18, height:18, borderRadius:'50%', fontSize:10, fontWeight:700, marginRight:5,
                background: step>i+1 ? '#1a9c1a' : step===i+1 ? '#0a0a0a' : '#e0e4e0',
                color: step>=i+1 ? '#fff' : '#9ca89c' }}>{i+1}</span>
              {s}
            </div>
          ))}
        </div>

        <div style={{ padding:20 }}>
          {/* ── Step 1: Datos ── */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Nº Documento</label>
                  <input type="text" className="fc" value={meta.numero_doc}
                    onChange={e => setMeta(p => ({ ...p, numero_doc:e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={meta.fecha}
                    onChange={e => setMeta(p => ({ ...p, fecha:e.target.value }))} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Bodega *</label>
                  <select className="fc" value={meta.bodega_id}
                    onChange={e => setMeta(p => ({ ...p, bodega_id:e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fl">Sitio Destino</label>
                  <select className="fc" value={meta.sitio_id}
                    onChange={e => {
                      const sitio = (liquidadorSitios || []).find(s => String(s.id) === e.target.value)
                      setMeta(p => ({ ...p, sitio_id: e.target.value, destino: sitio?.nombre || '' }))
                    }}>
                    <option value="">— Opcional —</option>
                    {(liquidadorSitios || []).map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="fl">Comentarios</label>
                <input type="text" className="fc" value={meta.comentarios}
                  onChange={e => setMeta(p => ({ ...p, comentarios:e.target.value }))} />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn bp" onClick={() => setStep(2)}>Siguiente →</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Materiales ── */}
          {step === 2 && (
            <div>
              {/* Selector */}
              <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                <div style={{ flex:1 }}>
                  <SearchableSelect
                    options={materialOptions}
                    value={String(catSel || '')}
                    onChange={handleCatSel}
                    placeholder="Buscar material…"
                  />
                </div>
                <button className="btn bp btn-sm"
                  onClick={addItem}
                  disabled={!catSel || stockWarn}
                  style={{ opacity: (!catSel || stockWarn) ? .45 : 1 }}>
                  + Agregar
                </button>
              </div>

              {/* Aviso sin stock */}
              {stockWarn && (
                <div style={{ background:'#fde8e7', border:'1px solid #f5c6c6', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#c0392b', marginBottom:8, fontWeight:600 }}>
                  Sin existencias en esta bodega — no se puede agregar
                </div>
              )}

              <div style={{ marginBottom:12 }} />

              {items.length === 0 && (
                <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:12 }}>
                  Agrega materiales al despacho
                </div>
              )}

              {items.map(item => {
                const cat = catalogo.find(c => c.id === item.catalogo_id)
                const stk = getStock(item.catalogo_id, Number(meta.bodega_id))
                const overStock = Number(item.cant_despachada) > stk
                return (
                  <div key={item.catalogo_id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px 100px 32px', gap:8, alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f0f2f0' }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700 }}>{cat?.nombre}</div>
                      <div style={{ fontSize:9, color:'#9ca89c' }}>Stock disponible: {stk}</div>
                    </div>
                    <div>
                      <label style={{ fontSize:9, color:'#9ca89c', display:'block', marginBottom:2 }}>Solicitado</label>
                      <input type="number" min="0" style={{ width:'100%', border:'1.5px solid #e0e4e0', borderRadius:4, padding:'4px 6px', fontSize:11, textAlign:'right' }}
                        value={item.cant_solicitada} onChange={e => updateItem(item.catalogo_id,'cant_solicitada',e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize:9, color: overStock ? '#c0392b' : '#9ca89c', display:'block', marginBottom:2 }}>
                        Despachado {overStock ? '⚠ supera stock' : ''}
                      </label>
                      <input type="number" min="0" style={{ width:'100%', border:`1.5px solid ${overStock ? '#c0392b' : '#e0e4e0'}`, borderRadius:4, padding:'4px 6px', fontSize:11, textAlign:'right', background: overStock ? '#fff5f5' : undefined }}
                        value={item.cant_despachada} onChange={e => updateItem(item.catalogo_id,'cant_despachada',e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize:9, color:'#9ca89c', display:'block', marginBottom:2 }}>V. Unit.</label>
                      <input type="number" min="0" style={{ width:'100%', border:'1.5px solid #e0e4e0', borderRadius:4, padding:'4px 6px', fontSize:11, textAlign:'right' }}
                        value={item.valor_unitario} onChange={e => updateItem(item.catalogo_id,'valor_unitario',e.target.value)} />
                    </div>
                    <button onClick={() => removeItem(item.catalogo_id)} style={{ background:'#fde8e7', color:'#c0392b', border:'none', borderRadius:4, cursor:'pointer', padding:'4px 6px', fontWeight:700 }}>✕</button>
                  </div>
                )
              })}

              {items.length > 0 && (
                <div style={{ background:'#0a0a0a', color:'#fff', borderRadius:6, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
                  <span style={{ fontSize:11, fontWeight:700 }}>{items.length} material(es)</span>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color:'#27c727' }}>{matCop(totalVal)}</span>
                </div>
              )}

              <div style={{ display:'flex', gap:8, justifyContent:'space-between', marginTop:16 }}>
                <button className="btn bou" onClick={() => setStep(1)}>← Volver</button>
                <button className="btn bp" onClick={handleNextToStep3} disabled={items.length === 0}>Siguiente →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirmar ── */}
          {step === 3 && (
            <div>
              <div className="card" style={{ marginBottom:12 }}>
                <div className="card-h"><h2>Resumen del Despacho</h2></div>
                <div className="card-b">
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                    <div><span style={{ color:'#9ca89c' }}>Documento:</span> <strong>{meta.numero_doc}</strong></div>
                    <div><span style={{ color:'#9ca89c' }}>Fecha:</span> <strong>{meta.fecha}</strong></div>
                    <div><span style={{ color:'#9ca89c' }}>Bodega:</span> <strong>{bodegas.find(b => String(b.id)===String(meta.bodega_id))?.nombre}</strong></div>
                    <div><span style={{ color:'#9ca89c' }}>Sitio:</span> <strong>{sitioNombre || '—'}</strong></div>
                  </div>
                </div>
              </div>

              <table className="tbl" style={{ marginBottom:12 }}>
                <thead><tr>
                  <th>Material</th><th className="num">Solicitado</th><th className="num">Despachado</th><th className="num">Total</th>
                </tr></thead>
                <tbody>
                  {items.filter(i => i.cant_despachada > 0).map(item => {
                    const cat = catalogo.find(c => c.id === item.catalogo_id)
                    return (
                      <tr key={item.catalogo_id}>
                        <td style={{ fontWeight:600 }}>{cat?.nombre}</td>
                        <td className="num">{item.cant_solicitada}</td>
                        <td className="num" style={{ fontWeight:700 }}>{item.cant_despachada}</td>
                        <td className="num" style={{ color:'#144E4A', fontWeight:700 }}>{matCop(item.cant_despachada*item.valor_unitario)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ background:'#144E4A', color:'#CDFBF2', borderRadius:8, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontWeight:700 }}>Total Despacho</span>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24, fontWeight:800 }}>{matCop(totalVal)}</span>
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'space-between' }}>
                <button className="btn bou" onClick={() => setStep(2)}>← Volver</button>
                <button className="btn bp" onClick={handleFinalizar} disabled={saving}>
                  {saving ? 'Guardando…' : '✓ Finalizar Despacho'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MatDespachos() {
  const despachos      = useMatStore(s => s.despachos)
  const bodegas        = useMatStore(s => s.bodegas)
  const movimientos    = useMatStore(s => s.movimientos)
  const deleteDespacho = useMatStore(s => s.deleteDespacho)
  const liquidadorSitios = useAppStore(s => s.sitios)
  const user           = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [wizard,  setWizard]  = useState(false)
  const [search,  setSearch]  = useState('')
  const [filStat, setFilStat] = useState('')

  const canEdit   = ['admin','coordinador','logistica'].includes(user?.role)
  const canDelete = ['admin','coordinador'].includes(user?.role)

  const filtered = despachos.filter(d => {
    if (filStat && d.status !== filStat) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${d.numero_doc} ${d.destino || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  async function handleDelete(d) {
    const ok = await confirm('Eliminar Despacho', `¿Eliminar despacho "${d.numero_doc}"? Se eliminarán también sus movimientos.`)
    if (!ok) return
    try { await deleteDespacho(d.id); showToast('Despacho eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      <ConfirmModalUI />
      {wizard && <DespachoWizard onClose={() => setWizard(false)} />}

      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Despachos ({filtered.length})</h2>
          {canEdit && <button className="btn bp btn-sm" onClick={() => setWizard(true)}>+ Nuevo Despacho</button>}
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar doc, sitio…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
            <select className="fc" value={filStat} onChange={e => setFilStat(e.target.value)} style={{ maxWidth:150 }}>
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Documento</th><th>Fecha</th><th>Bodega</th><th>Sitio</th>
                <th className="num">Items</th><th className="num">Total</th><th>Estado</th>
                {canDelete && <th></th>}
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin despachos</td></tr>
                )}
                {filtered.map(d => {
                  const movs  = movimientos.filter(m => m.numero_doc === d.numero_doc)
                  const total = movs.reduce((a, m) => a + (m.valor_total || 0), 0)
                  const bod   = bodegas.find(b => b.id === d.bodega_id)
                  return (
                    <tr key={d.id}>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>{d.numero_doc}</td>
                      <td style={{ color:'#9ca89c', whiteSpace:'nowrap' }}>{d.fecha}</td>
                      <td style={{ color:'#9ca89c' }}>{bod?.nombre || '—'}</td>
                      <td style={{ fontWeight:600 }}>{d.destino || '—'}</td>
                      <td className="num">{movs.length}</td>
                      <td className="num" style={{ fontWeight:700, color:'#144E4A' }}>{matCop(total)}</td>
                      <td>
                        <span className="badge" style={{ background:d.status==='finalizado'?'#d4edda':'#fef3cd', color:d.status==='finalizado'?'#1a6130':'#856404' }}>
                          {d.status==='finalizado'?'Finalizado':'Borrador'}
                        </span>
                      </td>
                      {canDelete && (
                        <td>
                          {d.status !== 'finalizado' && (
                            <button className="btn-del" onClick={() => handleDelete(d)}>✕</button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
