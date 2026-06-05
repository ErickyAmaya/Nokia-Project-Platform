import { useState, useMemo, useRef, useEffect } from 'react'
import { useHwStore }  from '../../store/useHwStore'
import { useMatStore } from '../../store/useMatStore'
import { useAppStore } from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../Toast'
import SearchableSelect from './SearchableSelect'

function SitioCombobox({ value, onChange, opciones, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sugs = opciones.filter(n => n.toLowerCase().includes((value || '').toLowerCase())).slice(0, 25)
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input className="fc" placeholder={placeholder || 'Escribir nombre del sitio…'}
        value={value} onFocus={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
      />
      {open && sugs.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:700,
          background:'#fff', border:'1.5px solid #e0e4e0', borderRadius:6,
          maxHeight:220, overflowY:'auto', boxShadow:'0 6px 20px rgba(0,0,0,.12)' }}>
          {sugs.map(n => (
            <div key={n} onMouseDown={() => { onChange(n); setOpen(false) }}
              style={{ padding:'8px 12px', cursor:'pointer', fontSize:11,
                background: n === value ? '#f0fdf4' : '#fff',
                borderBottom:'1px solid #f0f2f0', fontWeight: n === value ? 700 : 400 }}>
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const STEPS = ['Datos del Despacho', 'Agregar Equipos', 'Confirmar y Guardar']

const eqBod = (a, b) => !a || !b || a.trim().toLowerCase() === b.trim().toLowerCase()

// Retorna todos los equipos disponibles (con y sin serial) — SO es la llave universal
function getSosDisponibles(hwEquipos, catalogoId, bodega = null, excludeSos = []) {
  return hwEquipos
    .filter(e =>
      Number(e.catalogo_id) === Number(catalogoId) &&
      e.estado === 'en_bodega' &&
      e.so &&
      (!bodega || !e.ubicacion_actual || eqBod(e.ubicacion_actual, bodega)) &&
      !excludeSos.includes(e.so)
    )
    .map(e => ({ so: e.so, serial: e.serial || null, equipo_id: e.id, bodega: e.ubicacion_actual || '', created_at: e.created_at || '' }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function getSOFromSerial(serial, hwEquipos) {
  return hwEquipos.find(e => e.serial === serial)?.so || serial || ''
}

// Asigna SOs FIFO para ítems sin serial — toma las ENTRADAs más antiguas
// y descuenta las SALIDAs ya registradas, devuelve [{so, cantidad}]
function getSinSerialFifo(hwMovimientos, catalogoId, bodega, cantidad) {
  const id = Number(catalogoId)

  const entradas = hwMovimientos
    .filter(m =>
      Number(m.catalogo_id) === id && !m.serial &&
      m.tipo === 'ENTRADA' && eqBod(m.destino, bodega) &&
      (!m.destino_tipo || m.destino_tipo === 'bodega')
    )
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))

  const totalSalidas = hwMovimientos
    .filter(m =>
      Number(m.catalogo_id) === id && !m.serial &&
      m.tipo === 'SALIDA' && eqBod(m.origen, bodega) &&
      (!m.origen_tipo || m.origen_tipo === 'bodega')
    )
    .reduce((s, m) => s + (m.cantidad || 0), 0)

  // Pool de unidades en orden FIFO
  const pool = []
  for (const e of entradas) {
    for (let i = 0; i < (e.cantidad || 1); i++) pool.push(e.so || null)
  }

  // Saltar consumidas, tomar las siguientes N
  const taken = pool.slice(totalSalidas, totalSalidas + cantidad)

  // Agrupar por SO
  const grouped = {}
  for (const so of taken) {
    const key = so || ''
    grouped[key] = (grouped[key] || 0) + 1
  }
  return Object.entries(grouped).map(([so, cnt]) => ({ so: so || null, cantidad: cnt }))
}

function nextHwDsDoc(movimientos) {
  const year = new Date().getFullYear()
  const re   = new RegExp(`^HW-DS-${year}-(\\d+)$`)
  const nums = movimientos.map(m => { const x = m.so?.match(re); return x ? parseInt(x[1]) : 0 }).filter(Boolean)
  return `HW-DS-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0')}`
}

export default function HwDespachoModal({ onClose }) {
  const hwCatalogo         = useHwStore(s => s.hwCatalogo)
  const hwEquipos          = useHwStore(s => s.hwEquipos)
  const hwMovimientos      = useHwStore(s => s.hwMovimientos)
  const hwServiceSuppliers = useHwStore(s => s.hwServiceSuppliers)
  const addHwMovimiento        = useHwStore(s => s.addHwMovimiento)
  const updateHwEquipo         = useHwStore(s => s.updateHwEquipo)
  const crearDespachoPendiente = useHwStore(s => s.crearDespachoPendiente)
  const bodegas          = useMatStore(s => s.bodegas)
  const liquidadorSitios = useAppStore(s => s.sitios ?? [])
  const user            = useAuthStore(s => s.user)

  const [step,     setStep]     = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [altModal, setAltModal] = useState(null)

  // ── Step 1 ────────────────────────────────────────────────────────
  const [meta, setMeta] = useState({
    numero_doc:       nextHwDsDoc(hwMovimientos),
    fecha:            new Date().toISOString().slice(0, 10),
    smp_id:           '',
    bodega:           bodegas[0]?.nombre || '',
    destino_tipo:     'sitio',
    destino:          '',
    id_transferencia: '',
    notas:            '',
  })

  // ── Step 2 items ──────────────────────────────────────────────────
  // { catalogo_id, descripcion, cod_material, tipo_material, bodega,
  //   sos: [{so, serial}] }  ← un slot por unidad, SO es la llave
  const [items,   setItems]   = useState([])
  const [selCat,  setSelCat]  = useState('')
  const [selCant, setSelCant] = useState(1)

  const sitiosNombres = useMemo(() =>
    liquidadorSitios.filter(s => s.nombre).map(s => s.nombre).sort()
  , [liquidadorSitios])

  const catOptions = useMemo(() =>
    hwCatalogo.filter(c => c.activo !== false)
      .map(c => ({ value: String(c.id), label: c.descripcion, sub: c.cod_material || '' }))
  , [hwCatalogo])

  // Disponibles (serial o sin serial) — SO es la llave, sorted FIFO
  function getDisp(catId, bodega) {
    return getSosDisponibles(hwEquipos, catId, bodega)
  }

  function getTotalDisp(catId) {
    return hwEquipos.filter(e =>
      Number(e.catalogo_id) === Number(catId) && e.estado === 'en_bodega' && e.so
    ).length
  }

  function getAlts(catId, excludeBodega) {
    return bodegas
      .map(b => b.nombre)
      .filter(n => n !== excludeBodega)
      .map(n => ({ bodega: n, stock: getDisp(catId, n).length }))
      .filter(a => a.stock > 0)
  }

  // Auto-llena slots vacíos con los SOs más antiguos disponibles
  function autoFill(sos, disponibles) {
    const taken = new Set(sos.map(s => s.so).filter(Boolean))
    const pool  = disponibles.filter(d => !taken.has(d.so))
    let pi = 0
    return sos.map(s => s.so ? s : (pi < pool.length ? { so: pool[pi].so, serial: pool[pi++].serial } : { so: '', serial: null }))
  }

  function pushItem(cat, qty, bodega) {
    const disp = getDisp(cat.id, bodega)
    const newSos = autoFill(Array(qty).fill({ so: '', serial: null }), disp)
    setItems(prev => {
      const idx = prev.findIndex(i => i.catalogo_id === Number(cat.id) && i.bodega === bodega)
      if (idx >= 0) {
        return prev.map((it, i) => i !== idx ? it : {
          ...it, sos: autoFill([...it.sos, ...Array(qty).fill({ so: '', serial: null })], disp),
        })
      }
      return [...prev, {
        catalogo_id:   Number(cat.id),
        descripcion:   cat.descripcion,
        cod_material:  cat.cod_material || '—',
        tipo_material: cat.tipo_material,
        bodega,
        sos: newSos,
      }]
    })
    setSelCat('')
    setSelCant(1)
    setAltModal(null)
  }

  function handleAddItem() {
    const cat = hwCatalogo.find(c => String(c.id) === String(selCat))
    if (!cat) { showToast('Selecciona un tipo de equipo', 'err'); return }
    const qty = Number(selCant)
    if (qty < 1) { showToast('Cantidad inválida', 'err'); return }

    const mainBodega  = meta.bodega
    const mainStock   = getDisp(cat.id, mainBodega).length
    const totalStock  = getTotalDisp(cat.id)

    if (qty > mainStock) {
      const alts = getAlts(cat.id, mainBodega)
      if (mainStock > 0 || alts.length > 0) {
        setAltModal({ catId: cat.id, requestedQty: qty, mainBodega, mainStock, alternatives: alts })
        return
      }
      if (totalStock === 0) { showToast(`Sin stock disponible para "${cat.descripcion}"`, 'err'); return }
    }
    pushItem(cat, qty, mainBodega)
  }

  // Cambia una SO en un slot concreto
  function setSoAt(itemIdx, slotIdx, nuevoSO) {
    const disp = getDisp(items[itemIdx].catalogo_id, items[itemIdx].bodega)
    const match = disp.find(d => d.so === nuevoSO)
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIdx) return it
      const arr = [...it.sos]
      arr[slotIdx] = match ? { so: match.so, serial: match.serial } : { so: nuevoSO, serial: null }
      return { ...it, sos: arr }
    }))
  }

  function handleAltAdd(altBodega) {
    const cat = hwCatalogo.find(c => Number(c.id) === altModal.catId)
    if (!cat) return
    const fromAlt = Math.min(altModal.requestedQty - altModal.mainStock, getDisp(altModal.catId, altBodega).length)
    if (altModal.mainStock > 0) pushItem(cat, altModal.mainStock, altModal.mainBodega)
    if (fromAlt > 0) pushItem(cat, fromAlt, altBodega)
    else setAltModal(null)
  }

  function handleAltKeep() {
    if (altModal.mainStock <= 0) { setAltModal(null); return }
    const cat = hwCatalogo.find(c => Number(c.id) === altModal.catId)
    if (cat) pushItem(cat, altModal.mainStock, altModal.mainBodega)
  }

  // ── Validación step 2 → 3 ─────────────────────────────────────────
  function handleNextToStep3() {
    for (const item of items) {
      const missing = item.sos.filter(s => !s.so?.trim()).length
      if (missing > 0) {
        showToast(`"${item.descripcion}": faltan ${missing} SO(s) por seleccionar`, 'err')
        return
      }
      const unique = new Set(item.sos.map(s => s.so))
      if (unique.size < item.sos.length) {
        showToast(`"${item.descripcion}": hay SOs duplicadas`, 'err')
        return
      }
    }
    setStep(3)
  }

  // ── Guardar → crea despacho PENDIENTE ────────────────────────────
  async function handleSave() {
    if (items.length === 0) { showToast('Agrega al menos un equipo', 'err'); return }
    if (!meta.destino.trim()) { showToast(meta.destino_tipo === 'ss' ? 'Indica el Service Supplier' : 'Indica el sitio destino', 'err'); return }
    setSaving(true)
    try {
      const itemsFlat = []
      for (const item of items) {
        for (const { so, serial } of item.sos) {
          itemsFlat.push({
            catalogo_id:   item.catalogo_id,
            descripcion:   item.descripcion,
            cod_material:  item.cod_material,
            tipo_material: item.tipo_material,
            aplica_serial: !!serial,
            serial:        serial || null,
            so,
            cantidad:      1,
            bodega:        item.bodega,
          })
        }
      }
      await crearDespachoPendiente({
        numero_doc:       meta.numero_doc,
        fecha:            meta.fecha,
        smp_id:           meta.smp_id || null,
        bodega:           meta.bodega,
        destino:          meta.destino.trim(),
        destino_tipo:     meta.destino_tipo,
        id_transferencia: meta.destino_tipo === 'ss' ? (meta.id_transferencia || null) : null,
        notas:            meta.notas || null,
        items:            itemsFlat,
        created_by:       user?.nombre || user?.email || null,
      })
      showToast('Despacho registrado — pendiente de envío a sitio')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  // SOs disponibles para un slot (excluye las ya seleccionadas en el mismo ítem)
  function sosDisp(itemIdx, slotIdx) {
    const item    = items[itemIdx]
    const elegidos = item.sos.filter((s, i) => i !== slotIdx && s.so).map(s => s.so)
    return getDisp(item.catalogo_id, item.bodega)
      .filter(d => !elegidos.includes(d.so))
  }

  const selectedCat   = hwCatalogo.find(c => String(c.id) === String(selCat))
  const stockInfoMain = selCat ? getTotalDisp(Number(selCat)) : null

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
                  <label className="fl">Tipo de Destino *</label>
                  <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                    {[{value:'sitio',label:'Sitio Nokia'},{value:'ss',label:'Transferencia SS'}].map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setMeta(p => ({ ...p, destino_tipo: t.value, destino: '', id_transferencia: '' }))}
                        style={{
                          padding:'4px 14px', fontSize:11, fontWeight:700, borderRadius:20, cursor:'pointer',
                          border: meta.destino_tipo === t.value ? 'none' : '1.5px solid #e0e4e0',
                          background: meta.destino_tipo === t.value ? '#1d4ed8' : '#fff',
                          color: meta.destino_tipo === t.value ? '#fff' : '#555f55',
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {meta.destino_tipo === 'sitio' ? (
                    <>
                      <label className="fl">Sitio Destino *</label>
                      <SitioCombobox
                        value={meta.destino}
                        onChange={val => setMeta(p => ({ ...p, destino: val }))}
                        opciones={sitiosNombres}
                        placeholder="Escribir o buscar sitio Nokia…"
                      />
                    </>
                  ) : (
                    <>
                      <label className="fl">Service Supplier *</label>
                      <select className="fc" value={meta.destino}
                        onChange={e => setMeta(p => ({ ...p, destino: e.target.value }))}>
                        <option value="">— Seleccionar SS —</option>
                        {hwServiceSuppliers.filter(s => s.activo !== false).map(s => (
                          <option key={s.id} value={s.nombre}>{s.nombre}</option>
                        ))}
                      </select>
                      <label className="fl" style={{ marginTop:8 }}>ID Transferencia</label>
                      <input type="number" className="fc" placeholder="Ej: 248"
                        value={meta.id_transferencia}
                        onChange={e => setMeta(p => ({ ...p, id_transferencia: e.target.value }))} />
                    </>
                  )}
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
                    if (!meta.destino) { showToast(meta.destino_tipo === 'ss' ? 'Selecciona un Service Supplier' : 'Selecciona un sitio destino', 'err'); return }
                    setStep(2)
                  }}>Siguiente →</button>
                </div>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ background:'#f5f5f5', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#555f55' }}>
                  Despacho <strong>{meta.numero_doc}</strong> · Bodega: <strong>{meta.bodega}</strong> → {meta.destino_tipo === 'ss' ? <span style={{ color:'#1d4ed8', fontWeight:700 }}>SS: </span> : ''}<strong>{meta.destino}</strong>
                  {meta.destino_tipo === 'ss' && meta.id_transferencia && (
                    <span style={{ marginLeft:8, color:'#1d4ed8', fontSize:10 }}>(ID Trans: {meta.id_transferencia})</span>
                  )}
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
                        Stock disponible:{' '}
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

                {/* Lista de ítems con selección por SO */}
                {items.map((item, itemIdx) => {
                  const tipoBg = item.tipo_material==='Grupos'?'#eff6ff':'#f0fdf4'
                  const tipoCl = item.tipo_material==='Grupos'?'#1e40af':'#166534'
                  const selCount = item.sos.filter(s => s.so).length
                  return (
                    <div key={itemIdx} style={{ border:'1.5px solid #e8f5e8', borderRadius:8, overflow:'hidden' }}>
                      <div style={{ background:'#f0fdf4', padding:'7px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <span style={{ fontWeight:700, fontSize:12 }}>{item.descripcion}</span>
                          <span className="badge" style={{ background:tipoBg, color:tipoCl, fontSize:9 }}>{item.tipo_material}</span>
                          <span style={{ fontSize:10, color:'#555f55' }}>· {item.bodega} · {item.sos.length} ud.</span>
                        </div>
                        <button onClick={() => setItems(prev => prev.filter((_, i) => i !== itemIdx))}
                          style={{ border:'none', background:'#fde8e7', color:'#c0392b',
                            borderRadius:4, padding:'2px 8px', cursor:'pointer', fontWeight:700, fontSize:11 }}>✕</button>
                      </div>
                      <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:5 }}>
                        {item.sos.map((slot, slotIdx) => {
                          const opts = sosDisp(itemIdx, slotIdx)
                          return (
                            <div key={slotIdx} style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:10, color:'#9ca89c', fontWeight:700, minWidth:56,
                                fontFamily:"'Barlow Condensed',sans-serif" }}>
                                SO {slotIdx + 1}
                              </span>
                              <select className="fc"
                                value={slot.so || ''}
                                onChange={e => setSoAt(itemIdx, slotIdx, e.target.value)}
                                style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:600,
                                  flex:1, borderColor: slot.so ? '#1a9c1a' : '#f59e0b' }}>
                                <option value="">— Seleccionar SO —</option>
                                {opts.map(x => (
                                  <option key={x.so} value={x.so}>{x.so}{x.bodega ? ` (${x.bodega})` : ''}</option>
                                ))}
                              </select>
                              {slot.serial && (
                                <span style={{ fontSize:11, fontFamily:'monospace', color:'#144E4A',
                                  background:'#f0fdf4', padding:'2px 8px', borderRadius:4,
                                  border:'1px solid #c8e6c8', whiteSpace:'nowrap' }}>
                                  {slot.serial}
                                </span>
                              )}
                            </div>
                          )
                        })}
                        <div style={{ fontSize:10, color: selCount === item.sos.length ? '#1a6130' : '#92400e', fontWeight:600, marginTop:2 }}>
                          {selCount} de {item.sos.length} SO seleccionada(s)
                        </div>
                      </div>
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
                      <span style={{ color:'#555f55' }}>{item.bodega} · {item.sos.length} ud.</span>
                    </div>
                    <div style={{ padding:'6px 12px', display:'flex', flexWrap:'wrap', gap:6 }}>
                      {item.sos.map((slot, i) => (
                        <span key={i} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11,
                          background:'#f0fdf4', color:'#144E4A', padding:'2px 8px', borderRadius:4,
                          border:'1px solid #c8e6c8' }}>
                          {slot.so}{slot.serial ? ` / ${slot.serial}` : ''}
                        </span>
                      ))}
                    </div>
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
