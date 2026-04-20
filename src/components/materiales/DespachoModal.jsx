import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAppStore }  from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../Toast'
import SearchableSelect from './SearchableSelect'

function nextDocNum(despachos) {
  const year = new Date().getFullYear()
  const re   = new RegExp(`^DS-${year}-(\\d+)$`)
  const nums = despachos.map(d => { const m = d.numero_doc?.match(re); return m ? parseInt(m[1]) : 0 }).filter(Boolean)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `DS-${year}-${String(next).padStart(3,'0')}`
}

const STEPS = ['Datos del Despacho', 'Agregar Materiales', 'Confirmar y Guardar']

export default function DespachoModal({ onClose, defaultDestino = '' }) {
  const catalogo         = useMatStore(s => s.catalogo)
  const bodegas          = useMatStore(s => s.bodegas)
  const despachos        = useMatStore(s => s.despachos)
  const movimientos      = useMatStore(s => s.movimientos)
  const matSitios        = useMatStore(s => s.sitios)
  const saveSitio        = useMatStore(s => s.saveSitio)
  const getStock         = useMatStore(s => s.getStock)
  const saveDespacho     = useMatStore(s => s.saveDespacho)
  const addMovimiento    = useMatStore(s => s.addMovimiento)
  const liquidadorSitios = useAppStore(s => s.sitios ?? [])
  const user             = useAuthStore(s => s.user)

  // Lista fusionada: mat_sitios primero, luego sitios del Liquidador que no estén ya
  const sitiosOptions = useMemo(() => {
    const matNombres = new Set(matSitios.map(s => s.nombre?.toLowerCase()))
    const liqExtra   = liquidadorSitios
      .filter(s => s.nombre && !matNombres.has(s.nombre.toLowerCase()))
      .map(s => ({ nombre: s.nombre, fuente: 'liquidador' }))
    return [
      ...matSitios.filter(s => s.activo !== false).map(s => ({ nombre: s.nombre, fuente: 'mat' })),
      ...liqExtra,
    ]
  }, [matSitios, liquidadorSitios])

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 meta
  const [meta, setMeta] = useState({
    numero_doc:  nextDocNum(despachos),
    fecha:       new Date().toISOString().slice(0, 10),
    bodega_id:   bodegas[0]?.id || '',
    destino:     defaultDestino,
    comentarios: '',
  })

  // Step 2 items
  const [items, setItems] = useState([])
  const [selCat,  setSelCat]  = useState('')
  const [selCant, setSelCant] = useState(1)
  const [stockWarn, setStockWarn] = useState('')

  const matOptions = useMemo(() =>
    catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES')
      .map(c => ({ value: c.id, label: c.nombre, sub: c.codigo }))
  , [catalogo])

  function handleCatSel(val) {
    setSelCat(val)
    setStockWarn('')
    if (!val || !meta.bodega_id) return
    const stock = getStock(Number(val), Number(meta.bodega_id))
    if (stock === 0) setStockWarn('Este material no tiene stock disponible en la bodega seleccionada.')
  }

  function handleAddItem() {
    if (!selCat) { showToast('Selecciona un material', 'err'); return }
    const cat = catalogo.find(c => c.id === Number(selCat))
    if (!cat) return
    const stock = getStock(Number(selCat), Number(meta.bodega_id))
    if (stock === 0) { showToast('Sin stock disponible para este material', 'err'); return }
    const qty = Number(selCant)
    if (qty <= 0) { showToast('Cantidad inválida', 'err'); return }
    // Si ya existe, actualizar cantidad
    const existing = items.find(i => i.catalogo_id === cat.id)
    if (existing) {
      setItems(prev => prev.map(i => i.catalogo_id === cat.id
        ? { ...i, cant_despachada: i.cant_despachada + qty }
        : i
      ))
    } else {
      setItems(prev => [...prev, {
        catalogo_id:    cat.id,
        nombre:         cat.nombre,
        codigo:         cat.codigo,
        unidad:         cat.unidad,
        valor_unitario: cat.costo_unitario || 0,
        cant_despachada: qty,
        stock,
      }])
    }
    setSelCat('')
    setSelCant(1)
    setStockWarn('')
  }

  function handleNextToStep3() {
    const overStock = items.filter(i => i.cant_despachada > i.stock)
    if (overStock.length > 0) {
      showToast('Hay materiales con cantidad mayor al stock disponible', 'err'); return
    }
    setStep(3)
  }

  async function handleSave() {
    if (items.length === 0) { showToast('Agrega al menos un material', 'err'); return }
    setSaving(true)
    try {
      // Si el destino viene del Liquidador y no existe en mat_sitios, crearlo automáticamente
      const yaEnMat = matSitios.some(s => s.nombre?.toLowerCase() === meta.destino?.toLowerCase())
      if (!yaEnMat && meta.destino) {
        const liqSitio = liquidadorSitios.find(s => s.nombre?.toLowerCase() === meta.destino?.toLowerCase())
        await saveSitio({
          nombre:      meta.destino,
          tipo_cw:     liqSitio?.tipo || '',
          regional:    liqSitio?.regional || 'Sur-Occidente',
          comentarios: '',
          activo:      true,
        })
      }
      await saveDespacho({
        numero_doc:  meta.numero_doc,
        fecha:       meta.fecha,
        bodega_id:   Number(meta.bodega_id),
        destino:     meta.destino,
        sitio_id:    null,
        comentarios: meta.comentarios,
        status:      'borrador',
        created_by:  user?.nombre || user?.email,
      })
      for (const item of items) {
        await addMovimiento({
          numero_doc:      meta.numero_doc,
          fecha:           meta.fecha,
          tipo:            'Salida',
          catalogo_id:     item.catalogo_id,
          bodega_id:       Number(meta.bodega_id),
          cantidad:        item.cant_despachada,
          cant_despachada: item.cant_despachada,
          valor_unitario:  item.valor_unitario,
          destino:         meta.destino,
          sitio_id:        null,
          created_by:      user?.nombre || user?.email,
        })
      }
      showToast('Despacho creado correctamente')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  const totalDespacho = items.reduce((a, i) => a + i.cant_despachada * i.valor_unitario, 0)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:580, maxHeight:'92vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #c0392b', borderRadius:'12px 12px 0 0' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, letterSpacing:1 }}>
            NUEVO DESPACHO
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Steps */}
        <div style={{ display:'flex', borderBottom:'1px solid #e0e4e0' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex:1, padding:'8px 4px', textAlign:'center', fontSize:10, fontWeight:700,
              color: step === i+1 ? '#c0392b' : step > i+1 ? '#1a9c1a' : '#9ca89c',
              borderBottom: step === i+1 ? '2px solid #c0392b' : '2px solid transparent',
              letterSpacing:.4 }}>
              {step > i+1 ? '✓ ' : `${i+1}. `}{s.toUpperCase()}
            </div>
          ))}
        </div>

        <div style={{ padding:20 }}>

          {/* ── STEP 1: Datos ── */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Nº Documento</label>
                  <input type="text" className="fc" value={meta.numero_doc} readOnly
                    style={{ background:'#f5f5f5', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }} />
                </div>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={meta.fecha}
                    onChange={e => setMeta(p => ({ ...p, fecha: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="fl">Bodega Origen *</label>
                <select className="fc" value={meta.bodega_id}
                  onChange={e => setMeta(p => ({ ...p, bodega_id: e.target.value }))}>
                  <option value="">— Seleccionar bodega —</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Sitio Destino *</label>
                {defaultDestino ? (
                  <div style={{ background:'#f0fdf4', border:'1.5px solid #a3e6a3', borderRadius:6, padding:'8px 12px', fontSize:13, color:'#144E4A', fontWeight:700 }}>
                    {meta.destino}
                  </div>
                ) : (
                  <select className="fc" value={meta.destino}
                    onChange={e => setMeta(p => ({ ...p, destino: e.target.value }))}>
                    <option value="">— Seleccionar sitio —</option>
                    {sitiosOptions.length > 0 && (
                      <optgroup label="Sitios registrados">
                        {sitiosOptions.filter(s => s.fuente === 'mat').map(s => (
                          <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
                        ))}
                      </optgroup>
                    )}
                    {sitiosOptions.some(s => s.fuente === 'liquidador') && (
                      <optgroup label="Sitios Nokia (Liquidador)">
                        {sitiosOptions.filter(s => s.fuente === 'liquidador').map(s => (
                          <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>
              <div>
                <label className="fl">Comentarios</label>
                <input type="text" className="fc" value={meta.comentarios} placeholder="Opcional"
                  onChange={e => setMeta(p => ({ ...p, comentarios: e.target.value }))} />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
                <button className="btn bou" onClick={onClose}>Cancelar</button>
                <button className="btn bp" onClick={() => {
                  if (!meta.bodega_id) { showToast('Selecciona una bodega', 'err'); return }
                  if (!meta.destino)   { showToast('Selecciona un sitio destino', 'err'); return }
                  setStep(2)
                }}>Siguiente →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Materiales ── */}
          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'#f5f5f5', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#555f55' }}>
                Despacho <strong>{meta.numero_doc}</strong> → <strong>{meta.destino}</strong>
              </div>

              {/* Agregar material */}
              <div style={{ border:'1.5px solid #e0e4e0', borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#555f55', letterSpacing:.5 }}>AGREGAR MATERIAL</div>
                <SearchableSelect
                  options={matOptions}
                  value={String(selCat)}
                  onChange={handleCatSel}
                  placeholder="Buscar material…"
                />
                {stockWarn && (
                  <div style={{ background:'#fde8e7', border:'1px solid #f5c6cb', borderRadius:5, padding:'5px 10px', fontSize:11, color:'#c0392b' }}>
                    ⚠ {stockWarn}
                  </div>
                )}
                {selCat && meta.bodega_id && (
                  <div style={{ fontSize:10, color:'#555f55' }}>
                    Stock disponible: <strong>{getStock(Number(selCat), Number(meta.bodega_id))}</strong> und
                  </div>
                )}
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div style={{ flex:1 }}>
                    <label className="fl">Cantidad</label>
                    <input type="number" min="1" className="fc" value={selCant}
                      onChange={e => setSelCant(e.target.value)} />
                  </div>
                  <button className="btn bp" onClick={handleAddItem} style={{ marginBottom:0 }}>+ Agregar</button>
                </div>
              </div>

              {/* Lista de items */}
              {items.length > 0 && (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'#0a0a0a' }}>
                      {['Material','Código','Cant.','Stock','Total',''].map(h => (
                        <th key={h} style={{ padding:'5px 8px', color:'#fff', fontWeight:700, fontSize:10, textAlign: h === 'Cant.' || h === 'Total' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const overStock = item.cant_despachada > item.stock
                      return (
                        <tr key={idx} style={{ borderBottom:'1px solid #e0e4e0', background: overStock ? '#fff5f5' : undefined, border: overStock ? '1px solid #f5c6cb' : undefined }}>
                          <td style={{ padding:'5px 8px', fontWeight:600 }}>
                            {item.nombre}
                            {overStock && <div style={{ color:'#c0392b', fontSize:9, fontWeight:700 }}>⚠ supera stock</div>}
                          </td>
                          <td style={{ padding:'5px 8px', color:'#9ca89c', fontFamily:"'Barlow Condensed',sans-serif" }}>{item.codigo}</td>
                          <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700 }}>
                            <input type="number" min="1" value={item.cant_despachada}
                              onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, cant_despachada: Number(e.target.value) } : it))}
                              style={{ width:52, textAlign:'right', border:'1px solid #e0e4e0', borderRadius:4, padding:'2px 4px', fontSize:11 }} />
                          </td>
                          <td style={{ padding:'5px 8px', color: overStock ? '#c0392b' : '#9ca89c', fontSize:10, textAlign:'right' }}>{item.stock}</td>
                          <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, color:'#144E4A' }}>{matCop(item.cant_despachada * item.valor_unitario)}</td>
                          <td style={{ padding:'5px 8px' }}>
                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                              style={{ border:'none', background:'#fde8e7', color:'#c0392b', borderRadius:4, padding:'2px 7px', cursor:'pointer', fontWeight:700, fontSize:11 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f0f7f0' }}>
                      <td colSpan={4} style={{ padding:'5px 8px', fontSize:10, color:'#144E4A', fontWeight:700 }}>Total despacho ({items.length} materiales)</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, color:'#144E4A' }}>{matCop(totalDespacho)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}

              <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:8 }}>
                <button className="btn bou" onClick={() => setStep(1)}>← Atrás</button>
                <button className="btn bp" onClick={handleNextToStep3} disabled={items.length === 0}>
                  Revisar →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirmar ── */}
          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'#f0fdf4', border:'1px solid #a3e6a3', borderRadius:8, padding:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                {[
                  { label:'Documento',   value: meta.numero_doc },
                  { label:'Fecha',       value: meta.fecha },
                  { label:'Bodega',      value: bodegas.find(b => String(b.id) === String(meta.bodega_id))?.nombre || '—' },
                  { label:'Destino',     value: meta.destino },
                  { label:'Materiales',  value: `${items.length} ítems` },
                  { label:'Total',       value: matCop(totalDespacho) },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize:9, color:'#9ca89c', fontWeight:700, letterSpacing:.5 }}>{r.label.toUpperCase()}</div>
                    <div style={{ fontWeight:700, color:'#0a0a0a' }}>{r.value}</div>
                  </div>
                ))}
              </div>

              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr style={{ background:'#0a0a0a' }}>
                    {['Material','Cant.','V. Unitario','Total'].map(h => (
                      <th key={h} style={{ padding:'5px 8px', color:'#fff', fontWeight:700, fontSize:10, textAlign: h !== 'Material' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom:'1px solid #e0e4e0' }}>
                      <td style={{ padding:'5px 8px', fontWeight:600 }}>{item.nombre}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right' }}>{item.cant_despachada}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'#9ca89c' }}>{matCop(item.valor_unitario)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, color:'#144E4A' }}>{matCop(item.cant_despachada * item.valor_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#f0f7f0', fontWeight:700 }}>
                    <td colSpan={3} style={{ padding:'5px 8px', color:'#144E4A' }}>TOTAL DESPACHO</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color:'#144E4A' }}>{matCop(totalDespacho)}</td>
                  </tr>
                </tfoot>
              </table>

              <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:8 }}>
                <button className="btn bou" onClick={() => setStep(2)}>← Atrás</button>
                <button
                  className="btn"
                  style={{ background:'#c0392b', color:'#fff', padding:'6px 20px', borderRadius:6, fontWeight:700, fontSize:12, cursor:'pointer' }}
                  onClick={handleSave}
                  disabled={saving}>
                  {saving ? 'Guardando…' : 'Confirmar Despacho'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
