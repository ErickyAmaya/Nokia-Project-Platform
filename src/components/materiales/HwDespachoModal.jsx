import { useState, useMemo } from 'react'
import { useHwStore }  from '../../store/useHwStore'
import { useMatStore } from '../../store/useMatStore'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../Toast'
import SearchableSelect from './SearchableSelect'

const STEPS = ['Datos del Despacho', 'Agregar Equipos', 'Confirmar y Guardar']

function nextHwDsDoc(movimientos) {
  const year = new Date().getFullYear()
  const re   = new RegExp(`^HW-DS-${year}-(\\d+)$`)
  const nums = movimientos.map(m => { const x = m.so?.match(re); return x ? parseInt(x[1]) : 0 }).filter(Boolean)
  return `HW-DS-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0')}`
}

export default function HwDespachoModal({ onClose }) {
  const hwCatalogo      = useHwStore(s => s.hwCatalogo)
  const hwEquipos       = useHwStore(s => s.hwEquipos)
  const hwMovimientos   = useHwStore(s => s.hwMovimientos)
  const addHwMovimiento = useHwStore(s => s.addHwMovimiento)
  const updateHwEquipo  = useHwStore(s => s.updateHwEquipo)
  const bodegas         = useMatStore(s => s.bodegas)
  const matSitios       = useMatStore(s => s.sitios)
  const saveSitio       = useMatStore(s => s.saveSitio)
  const liquidadorSitios = useAppStore(s => s.sitios ?? [])
  const user            = useAuthStore(s => s.user)

  const [step,     setStep]     = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [altModal, setAltModal] = useState(null)

  // ── Step 1 ────────────────────────────────────────────────────────
  const [meta, setMeta] = useState({
    numero_doc: nextHwDsDoc(hwMovimientos),
    fecha:      new Date().toISOString().slice(0, 10),
    smp_id:     '',
    bodega:     bodegas[0]?.nombre || '',
    destino:    '',
    notas:      '',
  })

  // ── Step 2 items ──────────────────────────────────────────────────
  // { catalogo_id:number, descripcion, cod_material, tipo_material,
  //   aplica_serial, cantidad, seriales:string[], bodega }
  const [items,   setItems]   = useState([])
  const [selCat,  setSelCat]  = useState('')
  const [selCant, setSelCant] = useState(1)

  const sitiosOptions = useMemo(() =>
    liquidadorSitios.filter(s => s.nombre)
      .map(s => ({ value: s.nombre, label: s.nombre }))
      .sort((a, b) => a.label.localeCompare(b.label))
  , [liquidadorSitios])

  const catOptions = useMemo(() =>
    hwCatalogo.filter(c => c.activo !== false)
      .map(c => ({ value: String(c.id), label: c.descripcion, sub: c.cod_material || '' }))
  , [hwCatalogo])

  // ── Stock helpers (coercion segura con Number) ────────────────────
  function getSerialDisp(catId, bodega) {
    const id = Number(catId)
    return hwEquipos.filter(e =>
      Number(e.catalogo_id) === id &&
      e.estado === 'en_bodega' &&
      (!e.ubicacion_actual || e.ubicacion_actual === bodega)
    )
  }

  function getSinSerialStock(catId, bodega) {
    const id   = Number(catId)
    const movs = hwMovimientos.filter(m => Number(m.catalogo_id) === id && !m.serial)
    const ent  = movs.filter(m => m.tipo === 'ENTRADA' && m.destino_tipo === 'bodega' && m.destino === bodega)
      .reduce((s, m) => s + (m.cantidad || 0), 0)
    const sal  = movs.filter(m => m.tipo === 'SALIDA' && m.origen_tipo === 'bodega' && m.origen === bodega)
      .reduce((s, m) => s + (m.cantidad || 0), 0)
    return Math.max(0, ent - sal)
  }

  function getStock(catId, apSerial, bodega) {
    return apSerial === false
      ? getSinSerialStock(catId, bodega)
      : getSerialDisp(catId, bodega).length
  }

  function getAlts(catId, apSerial, excludeBodega) {
    return bodegas
      .map(b => b.nombre)
      .filter(n => n !== excludeBodega)
      .map(n => ({ bodega: n, stock: getStock(catId, apSerial, n) }))
      .filter(a => a.stock > 0)
  }

  // ── Helpers internos de items ─────────────────────────────────────
  function mergeItem(prev, cat, qty, bodega) {
    const seriales = cat.aplica_serial !== false ? Array(qty).fill('') : []
    const idx = prev.findIndex(i => i.catalogo_id === Number(cat.id) && i.bodega === bodega)
    if (idx >= 0) {
      return prev.map((it, i) => i !== idx ? it : {
        ...it,
        cantidad: it.cantidad + qty,
        seriales: cat.aplica_serial !== false ? [...it.seriales, ...seriales] : [],
      })
    }
    return [...prev, {
      catalogo_id:   Number(cat.id),
      descripcion:   cat.descripcion,
      cod_material:  cat.cod_material || '—',
      tipo_material: cat.tipo_material,
      aplica_serial: cat.aplica_serial,
      cantidad:      qty,
      seriales,
      bodega,
    }]
  }

  function pushItem(cat, qty, bodega) {
    setItems(prev => mergeItem(prev, cat, qty, bodega))
    setSelCat('')
    setSelCant(1)
    setAltModal(null)
  }

  function handleAddItem() {
    const cat = hwCatalogo.find(c => String(c.id) === String(selCat))
    if (!cat)       { showToast('Selecciona un tipo de equipo', 'err'); return }
    const qty = Number(selCant)
    if (qty < 1)    { showToast('Cantidad inválida', 'err'); return }

    const mainBodega = meta.bodega
    const mainStock  = getStock(cat.id, cat.aplica_serial, mainBodega)

    if (qty > mainStock) {
      const alts = getAlts(cat.id, cat.aplica_serial, mainBodega)
      if (mainStock > 0 || alts.length > 0) {
        setAltModal({ catId: cat.id, aplica_serial: cat.aplica_serial, requestedQty: qty, mainBodega, mainStock, alternatives: alts })
        return
      }
      showToast(`Sin stock disponible para "${cat.descripcion}"`, 'err')
      return
    }
    pushItem(cat, qty, mainBodega)
  }

  // Cambiar serial en un slot concreto de un ítem
  function setSerial(itemIdx, slotIdx, val) {
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIdx) return it
      const arr = [...it.seriales]
      arr[slotIdx] = val
      return { ...it, seriales: arr }
    }))
  }

  // Combinar: mainStock de bodega principal + resto de bodega alternativa
  function handleAltAdd(altBodega) {
    const cat = hwCatalogo.find(c => Number(c.id) === altModal.catId)
    if (!cat) return
    const fromMain = altModal.mainStock
    const fromAlt  = Math.min(altModal.requestedQty - fromMain, getStock(altModal.catId, altModal.aplica_serial, altBodega))
    setItems(prev => {
      let next = prev
      if (fromMain > 0) next = mergeItem(next, cat, fromMain, altModal.mainBodega)
      if (fromAlt  > 0) next = mergeItem(next, cat, fromAlt,  altBodega)
      return next
    })
    setSelCat('')
    setSelCant(1)
    setAltModal(null)
  }

  // Solo tomar lo disponible en la bodega principal
  function handleAltKeep() {
    if (altModal.mainStock <= 0) { setAltModal(null); return }
    const cat = hwCatalogo.find(c => Number(c.id) === altModal.catId)
    if (cat) pushItem(cat, altModal.mainStock, altModal.mainBodega)
  }

  // ── Validación step 2 → 3 ─────────────────────────────────────────
  function handleNextToStep3() {
    for (const item of items) {
      if (item.aplica_serial !== false) {
        const missing = item.seriales.filter(s => !s.trim()).length
        if (missing > 0) {
          showToast(`"${item.descripcion}": faltan ${missing} serial(es) por seleccionar`, 'err')
          return
        }
        const unique = new Set(item.seriales)
        if (unique.size < item.seriales.length) {
          showToast(`"${item.descripcion}": hay seriales duplicados`, 'err')
          return
        }
      }
    }
    setStep(3)
  }

  // ── Guardar ───────────────────────────────────────────────────────
  async function handleSave() {
    if (items.length === 0) { showToast('Agrega al menos un equipo', 'err'); return }
    setSaving(true)
    try {
      const existe = matSitios.some(s => s.nombre?.toLowerCase() === meta.destino.toLowerCase())
      if (!existe && meta.destino) {
        await saveSitio({ nombre: meta.destino, regional: '', activo: true }).catch(() => {})
      }
      for (const item of items) {
        if (item.aplica_serial === false) {
          await addHwMovimiento({
            equipo_id: null, serial: null,
            catalogo_id: item.catalogo_id,
            tipo: 'SALIDA', tipo_fuente: 'MANUAL',
            so: meta.numero_doc, smp_id: meta.smp_id || null,
            fecha: meta.fecha, cantidad: item.cantidad,
            origen: item.bodega, origen_tipo: 'bodega',
            destino: meta.destino, destino_tipo: 'sitio',
            created_by: user?.nombre || user?.email,
            notas: meta.notas || null,
          })
        } else {
          for (const serial of item.seriales) {
            const equipo = hwEquipos.find(e => e.serial === serial)
            if (equipo) await updateHwEquipo(equipo.id, { estado: 'en_sitio', ubicacion_actual: meta.destino })
            await addHwMovimiento({
              equipo_id: equipo?.id || null, serial,
              catalogo_id: item.catalogo_id,
              tipo: 'SALIDA', tipo_fuente: 'MANUAL',
              so: meta.numero_doc, smp_id: meta.smp_id || null,
              fecha: meta.fecha, cantidad: 1,
              origen: item.bodega, origen_tipo: 'bodega',
              destino: meta.destino, destino_tipo: 'sitio',
              created_by: user?.nombre || user?.email,
              notas: meta.notas || null,
            })
          }
        }
      }
      showToast('Despacho HW registrado correctamente')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  // Seriales disponibles excluyendo los ya seleccionados en el mismo ítem
  function serialesDisp(itemIdx, slotIdx) {
    const item      = items[itemIdx]
    const elegidos  = item.seriales.filter((s, i) => i !== slotIdx && s)
    return getSerialDisp(item.catalogo_id, item.bodega)
      .map(e => e.serial)
      .filter(s => !elegidos.includes(s))
  }

  const selectedCat    = hwCatalogo.find(c => String(c.id) === String(selCat))
  const stockInfoMain  = selCat && meta.bodega
    ? getStock(Number(selCat), selectedCat?.aplica_serial, meta.bodega) : null

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:600,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:600,
          maxHeight:'92vh', overflowY:'auto' }}>

          {/* Header */}
          <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 18px',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            borderBottom:'3px solid #1d4ed8', borderRadius:'12px 12px 0 0',
            position:'sticky', top:0, zIndex:10 }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, letterSpacing:1 }}>
              NUEVO DESPACHO HW NOKIA
            </span>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:22, cursor:'pointer' }}>×</button>
          </div>

          {/* Steps */}
          <div style={{ display:'flex', borderBottom:'1px solid #e0e4e0' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ flex:1, padding:'8px 4px', textAlign:'center', fontSize:10, fontWeight:700,
                color:        step === i+1 ? '#1d4ed8' : step > i+1 ? '#1a9c1a' : '#9ca89c',
                borderBottom: step === i+1 ? '2px solid #1d4ed8' : '2px solid transparent',
                letterSpacing:.4 }}>
                {step > i+1 ? '✓ ' : `${i+1}. `}{s.toUpperCase()}
              </div>
            ))}
          </div>

          <div style={{ padding:20 }}>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label className="fl">Nº Documento</label>
                    <input className="fc" value={meta.numero_doc} readOnly
                      style={{ background:'#f5f5f5', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }} />
                  </div>
                  <div>
                    <label className="fl">Fecha</label>
                    <input type="date" className="fc" value={meta.fecha}
                      onChange={e => setMeta(p => ({ ...p, fecha: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="fl">SMP ID / Work Order</label>
                  <input className="fc" placeholder="SMP-WO-… (opcional)" value={meta.smp_id}
                    onChange={e => setMeta(p => ({ ...p, smp_id: e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Bodega Origen *</label>
                  <select className="fc" value={meta.bodega}
                    onChange={e => setMeta(p => ({ ...p, bodega: e.target.value }))}>
                    <option value="">— Seleccionar bodega —</option>
                    {bodegas.map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fl">Sitio Destino *</label>
                  <SearchableSelect
                    options={sitiosOptions}
                    value={meta.destino}
                    onChange={val => setMeta(p => ({ ...p, destino: val }))}
                    placeholder="Buscar sitio Nokia…"
                  />
                </div>
                <div>
                  <label className="fl">Notas</label>
                  <input className="fc" placeholder="Opcional" value={meta.notas}
                    onChange={e => setMeta(p => ({ ...p, notas: e.target.value }))} />
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
                  <button className="btn bou" onClick={onClose}>Cancelar</button>
                  <button className="btn bp" onClick={() => {
                    if (!meta.bodega)  { showToast('Selecciona una bodega', 'err'); return }
                    if (!meta.destino) { showToast('Selecciona un sitio destino', 'err'); return }
                    setStep(2)
                  }}>Siguiente →</button>
                </div>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:'#f5f5f5', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#555f55' }}>
                  Despacho <strong>{meta.numero_doc}</strong> · Bodega: <strong>{meta.bodega}</strong> → <strong>{meta.destino}</strong>
                </div>

                {/* Agregar equipo */}
                <div style={{ border:'1.5px solid #e0e4e0', borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#555f55', letterSpacing:.5 }}>AGREGAR EQUIPO</div>
                  <SearchableSelect
                    options={catOptions}
                    value={String(selCat)}
                    onChange={v => { setSelCat(v); setSelCant(1) }}
                    placeholder="Buscar equipo HW…"
                  />
                  {selectedCat?.imagen_url && (
                    <div style={{ display:'flex', alignItems:'center', gap:10,
                      background:'#f0f7ff', border:'1.5px solid #bfdbfe', borderRadius:8, padding:'8px 12px' }}>
                      <img src={selectedCat.imagen_url} alt={selectedCat.descripcion}
                        style={{ width:56, height:56, objectFit:'contain', borderRadius:6,
                          border:'1px solid #dbeafe', background:'#fff', flexShrink:0 }}
                        onError={e => { e.target.style.display='none' }}
                      />
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#1e40af' }}>{selectedCat.descripcion}</div>
                        {selectedCat.cod_material && (
                          <div style={{ fontSize:10, color:'#9ca89c', fontFamily:"'Barlow Condensed',sans-serif", marginTop:2 }}>
                            {selectedCat.cod_material}
                          </div>
                        )}
                        <div style={{ fontSize:9, color:'#3b82f6', marginTop:3, fontWeight:600, letterSpacing:.3 }}>
                          VERIFICAR EQUIPO
                        </div>
                      </div>
                    </div>
                  )}
                  {selCat && (
                    <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:10 }}>
                      <span style={{ color:'#555f55' }}>
                        Stock en <strong>{meta.bodega}</strong>:{' '}
                        <strong style={{ color: stockInfoMain === 0 ? '#c0392b' : '#1a6130', fontSize:12 }}>
                          {stockInfoMain ?? '—'}
                        </strong>
                        {' '}{selectedCat?.aplica_serial !== false ? 'serial(es)' : 'unidad(es)'}
                      </span>
                      {selectedCat?.aplica_serial === false && (
                        <span style={{ background:'#fef3cd', color:'#92400e', padding:'1px 6px', borderRadius:4, fontSize:9, fontWeight:700 }}>
                          SIN SERIAL
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                    <div style={{ flex:1 }}>
                      <label className="fl">Cantidad</label>
                      <input type="number" min={1} className="fc" value={selCant}
                        onChange={e => setSelCant(Math.max(1, Number(e.target.value) || 1))} />
                    </div>
                    <button className="btn bp" onClick={handleAddItem}>+ Agregar</button>
                  </div>
                </div>

                {/* Lista de ítems con selección de seriales */}
                {items.map((item, itemIdx) => {
                  const tipoBg = item.tipo_material==='Grupos'?'#eff6ff':'#f0fdf4'
                  const tipoCl = item.tipo_material==='Grupos'?'#1e40af':'#166534'
                  return (
                    <div key={itemIdx} style={{ border:'1.5px solid #e8f5e8', borderRadius:8, overflow:'hidden' }}>
                      {/* Cabecera del ítem */}
                      <div style={{ background:'#f0fdf4', padding:'7px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <span style={{ fontWeight:700, fontSize:12 }}>{item.descripcion}</span>
                          <span className="badge" style={{ background:tipoBg, color:tipoCl, fontSize:9 }}>{item.tipo_material}</span>
                          <span style={{ fontSize:10, color:'#555f55' }}>· {item.bodega} · {item.cantidad} ud.</span>
                        </div>
                        <button onClick={() => setItems(prev => prev.filter((_, i) => i !== itemIdx))}
                          style={{ border:'none', background:'#fde8e7', color:'#c0392b',
                            borderRadius:4, padding:'2px 8px', cursor:'pointer', fontWeight:700, fontSize:11 }}>✕</button>
                      </div>

                      {/* Slots de serial */}
                      {item.aplica_serial !== false ? (
                        <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:5 }}>
                          {item.seriales.map((s, slotIdx) => {
                            const opciones = serialesDisp(itemIdx, slotIdx)
                            return (
                              <div key={slotIdx} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:10, color:'#9ca89c', fontWeight:700, minWidth:56,
                                  fontFamily:"'Barlow Condensed',sans-serif" }}>
                                  Serial {slotIdx + 1}
                                </span>
                                <select className="fc"
                                  value={s}
                                  onChange={e => setSerial(itemIdx, slotIdx, e.target.value)}
                                  style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:600,
                                    flex:1, borderColor: s ? '#1a9c1a' : '#f59e0b' }}>
                                  <option value="">— Seleccionar serial —</option>
                                  {opciones.map(ser => (
                                    <option key={ser} value={ser}>{ser}</option>
                                  ))}
                                </select>
                                {s && (
                                  <span style={{ fontSize:9, color:'#1a6130', fontWeight:700 }}>✓</span>
                                )}
                              </div>
                            )
                          })}
                          <div style={{ fontSize:10, color: item.seriales.filter(s=>s).length === item.cantidad ? '#1a6130' : '#92400e', fontWeight:600, marginTop:2 }}>
                            {item.seriales.filter(s=>s).length} de {item.cantidad} serial(es) seleccionado(s)
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding:'6px 12px', fontSize:10, color:'#92400e', fontStyle:'italic' }}>
                          Sin serial — {item.cantidad} unidad(es)
                        </div>
                      )}
                    </div>
                  )
                })}

                {items.length === 0 && (
                  <div style={{ textAlign:'center', padding:20, color:'#9ca89c', fontSize:12, border:'1.5px dashed #e0e4e0', borderRadius:8 }}>
                    Agrega equipos usando el formulario de arriba
                  </div>
                )}

                <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:4 }}>
                  <button className="btn bou" onClick={() => setStep(1)}>← Atrás</button>
                  <button className="btn bp" onClick={handleNextToStep3} disabled={items.length === 0}>
                    Revisar →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:12,
                  display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                  {[
                    { label:'Documento',  value: meta.numero_doc },
                    { label:'Fecha',      value: meta.fecha },
                    { label:'Bodega',     value: meta.bodega },
                    { label:'Destino',    value: meta.destino },
                    { label:'Tipos',      value: `${items.length} tipo(s)` },
                    { label:'Total uds.', value: items.reduce((s, i) => s + i.cantidad, 0) },
                  ].map(r => (
                    <div key={r.label}>
                      <div style={{ fontSize:9, color:'#9ca89c', fontWeight:700, letterSpacing:.5 }}>{r.label.toUpperCase()}</div>
                      <div style={{ fontWeight:700, color:'#0a0a0a' }}>{r.value}</div>
                    </div>
                  ))}
                </div>

                {items.map((item, idx) => (
                  <div key={idx} style={{ border:'1.5px solid #dbeafe', borderRadius:8, overflow:'hidden' }}>
                    <div style={{ background:'#eff6ff', padding:'6px 12px', display:'flex', justifyContent:'space-between', fontSize:11 }}>
                      <strong>{item.descripcion}</strong>
                      <span style={{ color:'#555f55' }}>{item.bodega} · {item.cantidad} ud.</span>
                    </div>
                    {item.aplica_serial !== false ? (
                      <div style={{ padding:'6px 12px', display:'flex', flexWrap:'wrap', gap:6 }}>
                        {item.seriales.map((s, i) => (
                          <span key={i} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11,
                            background:'#f0fdf4', color:'#144E4A', padding:'2px 8px', borderRadius:4,
                            border:'1px solid #c8e6c8' }}>{s}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding:'6px 12px', fontSize:10, color:'#92400e', fontStyle:'italic' }}>
                        Sin serial · {item.cantidad} unidad(es)
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:8 }}>
                  <button className="btn bou" onClick={() => setStep(2)}>← Atrás</button>
                  <button
                    style={{ background:'#1d4ed8', color:'#fff', padding:'6px 20px', borderRadius:6,
                      fontWeight:700, fontSize:12, border:'none', cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? .7 : 1 }}
                    onClick={handleSave} disabled={saving}>
                    {saving ? 'Guardando…' : 'Confirmar Despacho'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Mini-modal: bodega alternativa ── */}
      {altModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:700,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:10, width:'100%', maxWidth:380,
            boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'10px 16px',
              borderRadius:'10px 10px 0 0', borderBottom:'3px solid #ea580c',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13 }}>
                Stock insuficiente · {altModal.mainBodega || 'Bodega actual'}
              </span>
              <button onClick={() => setAltModal(null)}
                style={{ background:'none', border:'none', color:'#9ca89c', fontSize:18, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:16 }}>
              <p style={{ fontSize:12, color:'#555f55', marginBottom:12, lineHeight:1.6 }}>
                En <b>{altModal.mainBodega}</b> solo hay{' '}
                <b style={{ color:'#c0392b' }}>{altModal.mainStock}</b> unidad(es) de las{' '}
                <b>{altModal.requestedQty}</b> solicitadas.
              </p>
              {altModal.alternatives.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:.5, textTransform:'uppercase', color:'#9ca89c', marginBottom:8 }}>
                    Disponible en otras bodegas
                  </div>
                  {altModal.alternatives.map(alt => {
                    const fromAlt = Math.min(altModal.requestedQty - altModal.mainStock, alt.stock)
                    return (
                      <div key={alt.bodega} style={{ border:'1.5px solid #dbeafe', borderRadius:8,
                        padding:'10px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:'#1e40af' }}>📦 {alt.bodega}</div>
                          <div style={{ fontSize:10, color:'#9ca89c' }}>{alt.stock} unidad(es) disponible(s)</div>
                        </div>
                        <button onClick={() => handleAltAdd(alt.bodega)}
                          style={{ background:'#1e40af', color:'#fff', border:'none', borderRadius:6,
                            padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                          Sacar {fromAlt} de aquí
                        </button>
                      </div>
                    )
                  })}
                </>
              )}
              <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end', flexWrap:'wrap' }}>
                {altModal.mainStock > 0 && (
                  <button onClick={handleAltKeep}
                    style={{ padding:'6px 12px', fontSize:11, fontWeight:700, borderRadius:6,
                      border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>
                    Sacar solo {altModal.mainStock} de {altModal.mainBodega}
                  </button>
                )}
                <button onClick={() => setAltModal(null)}
                  style={{ padding:'6px 12px', fontSize:11, fontWeight:700, borderRadius:6,
                    border:'none', background:'#f0f2f0', color:'#555f55', cursor:'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
