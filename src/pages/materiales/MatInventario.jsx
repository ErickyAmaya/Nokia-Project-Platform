import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import SearchableSelect from '../../components/materiales/SearchableSelect'

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

function statusInfo(stock, minimo) {
  if (stock === 0)    return { label:'Agotado',     bg:'#fde8e7', color:'#c0392b' }
  if (stock < minimo) return { label:'Bajo Mínimo', bg:'#fef3cd', color:'#856404' }
  return                     { label:'En Stock',    bg:'#d4edda', color:'#1a6130' }
}

function nextMovNum(tipo, movimientos) {
  const year   = new Date().getFullYear()
  const prefix = tipo === 'Entrada' ? 'IN' : 'OUT'
  const re     = new RegExp(`^${prefix}-${year}-(\\d+)$`)
  const nums   = movimientos
    .filter(m => m.tipo === tipo)
    .map(m => { const match = m.numero_doc?.match(re); return match ? parseInt(match[1]) : 0 })
    .filter(Boolean)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}-${year}-${String(next).padStart(3,'0')}`
}

const ENT_RESET = {
  fecha: new Date().toISOString().slice(0,10),
  numero_doc: '', catalogo_id: '', bodega_id: '',
  cantidad: 1, valor_unitario: 0, origen: '', proveedor_id: '', editPrice: false,
}
const SAL_RESET = {
  fecha: new Date().toISOString().slice(0,10),
  numero_doc: '', catalogo_id: '', bodega_id: '',
  cantidad: 1, valor_unitario: 0, destino: '',
}

export default function MatInventario() {
  const catalogo        = useMatStore(s => s.catalogo)
  const bodegas         = useMatStore(s => s.bodegas)
  const movimientos     = useMatStore(s => s.movimientos)
  const stock           = useMatStore(s => s.stock)
  const getStock        = useMatStore(s => s.getStock)
  const addMovimiento   = useMatStore(s => s.addMovimiento)
  const correccionStock = useMatStore(s => s.correccionStock)
  const user            = useAuthStore(s => s.user)

  const [search,    setSearch]    = useState('')
  const [filCat,    setFilCat]    = useState('')
  const [filBodega, setFilBodega] = useState('')
  const [filStatus, setFilStatus] = useState('')

  // ── Entry modal ──
  const [entModal, setEntModal] = useState(false)
  const [entForm,  setEntForm]  = useState(ENT_RESET)

  // ── Salida modal ──
  const [salModal, setSalModal] = useState(false)
  const [salForm,  setSalForm]  = useState(SAL_RESET)

  const [saving, setSaving] = useState(false)

  // ── Correction modal ──
  const [corrModal, setCorrModal] = useState(null)
  const [corrQty,   setCorrQty]   = useState('')

  const canEdit    = ['admin','coordinador','logistica'].includes(user?.role)
  const canCorrect = ['admin','coordinador'].includes(user?.role)

  const proveedores = useMemo(() => catalogo.filter(c => c.categoria === 'PROVEEDORES' && c.activo), [catalogo])

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    const bodegasToShow = filBodega ? bodegas.filter(b => String(b.id) === filBodega) : bodegas
    return catalogo
      .filter(c => {
        if (c.categoria === 'PROVEEDORES') return false
        if (filCat && c.categoria !== filCat) return false
        if (q && !`${c.nombre} ${c.codigo}`.toLowerCase().includes(q)) return false
        return true
      })
      .flatMap(c => bodegasToShow.map(b => {
        const stock = getStock(c.id, b.id)
        const st = statusInfo(stock, c.stock_minimo)
        if (filStatus === 'agotado' && stock !== 0)               return null
        if (filStatus === 'bajo'    && (stock === 0 || stock >= c.stock_minimo)) return null
        if (filStatus === 'stock'   && stock < c.stock_minimo)    return null
        return { ...c, bodega: b, stockActual: stock, st, importe: stock * (c.costo_unitario || 0) }
      }))
      .filter(Boolean)
  }, [catalogo, bodegas, stock, search, filCat, filBodega, filStatus, getStock])

  const totalImporte = rows.reduce((a, r) => a + r.importe, 0)

  function openEntry(item, bodega) {
    setEntForm({
      ...ENT_RESET,
      numero_doc:     nextMovNum('Entrada', movimientos),
      catalogo_id:    item?.id || '',
      bodega_id:      bodega?.id || '',
      valor_unitario: item?.costo_unitario || 0,
    })
    setEntModal(true)
  }

  function openSal(item, bodega) {
    const stk = item?.id ? getStock(item.id, bodega?.id) : 0
    setSalForm({
      ...SAL_RESET,
      numero_doc:     nextMovNum('Salida', movimientos),
      catalogo_id:    item?.id || '',
      bodega_id:      bodega?.id || '',
      valor_unitario: item?.costo_unitario || 0,
      _stockDisp:     stk,
    })
    setSalModal(true)
  }

  async function handleEntSave() {
    if (!entForm.catalogo_id) { showToast('Selecciona un material', 'err'); return }
    if (!entForm.bodega_id)   { showToast('Selecciona una bodega', 'err'); return }
    if (entForm.cantidad <= 0){ showToast('Cantidad inválida', 'err'); return }
    setSaving(true)
    try {
      await addMovimiento({
        numero_doc:     entForm.numero_doc,
        fecha:          entForm.fecha,
        catalogo_id:    Number(entForm.catalogo_id),
        bodega_id:      Number(entForm.bodega_id),
        tipo:           'Entrada',
        cantidad:       Number(entForm.cantidad),
        valor_unitario: Number(entForm.valor_unitario),
        origen:         entForm.origen,
        proveedor_id:   entForm.proveedor_id ? Number(entForm.proveedor_id) : null,
        destino:        '',
        sitio_id:       null,
        created_by:     user?.nombre || user?.email,
      })
      showToast('Entrada registrada')
      setEntModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleSalSave() {
    if (!salForm.catalogo_id) { showToast('Selecciona un material', 'err'); return }
    if (!salForm.bodega_id)   { showToast('Selecciona una bodega', 'err'); return }
    if (salForm.cantidad <= 0){ showToast('Cantidad inválida', 'err'); return }
    const stk = getStock(Number(salForm.catalogo_id), Number(salForm.bodega_id))
    if (Number(salForm.cantidad) > stk) {
      showToast(`Stock insuficiente (disponible: ${stk})`, 'err'); return
    }
    setSaving(true)
    try {
      await addMovimiento({
        numero_doc:     salForm.numero_doc,
        fecha:          salForm.fecha,
        catalogo_id:    Number(salForm.catalogo_id),
        bodega_id:      Number(salForm.bodega_id),
        tipo:           'Salida',
        cantidad:       Number(salForm.cantidad),
        valor_unitario: Number(salForm.valor_unitario),
        origen:         '',
        destino:        salForm.destino,
        sitio_id:       null,
        created_by:     user?.nombre || user?.email,
      })
      showToast('Salida registrada')
      setSalModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleCorrSave() {
    if (corrQty === '' || isNaN(Number(corrQty)) || Number(corrQty) < 0) {
      showToast('Cantidad inválida', 'err'); return
    }
    try {
      await correccionStock(corrModal.item.id, corrModal.bodega.id, Number(corrQty))
      showToast('Stock corregido')
      setCorrModal(null)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  const showActions = canCorrect

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, margin:0, letterSpacing:.5, textTransform:'uppercase' }}>
          Inventario de Materiales
        </h1>
        {canEdit && (
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn bp btn-sm" onClick={() => openEntry()}>+ Entrada</button>
            <button className="btn btn-sm" style={{ background:'#c0392b', color:'#fff' }} onClick={() => openSal()}>- Salida</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-b">
          {/* Filtros */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar material o código…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
            {['','TI','CW'].map(v => (
              <button key={v} className={`btn btn-sm${filCat===v?' bk':' bou'}`}
                onClick={() => setFilCat(v)}>
                {v || 'Todos'}
              </button>
            ))}
            <select className="fc" value={filBodega} onChange={e => setFilBodega(e.target.value)} style={{ maxWidth:160 }}>
              <option value="">Todas las bodegas</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <select className="fc" value={filStatus} onChange={e => setFilStatus(e.target.value)} style={{ maxWidth:150 }}>
              <option value="">Todos los status</option>
              <option value="stock">En Stock</option>
              <option value="bajo">Bajo Mínimo</option>
              <option value="agotado">Agotado</option>
            </select>
          </div>

          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>MATERIAL</th>
                  <th>CÓDIGO</th>
                  <th>UND.</th>
                  <th>CAT.</th>
                  <th>BODEGA</th>
                  <th className="num">STOCK</th>
                  <th className="num">PRECIO</th>
                  <th className="num">IMPORTE</th>
                  <th>STATUS</th>
                  {showActions && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin resultados</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={`${r.id}-${r.bodega.id}`}>
                    <td style={{ fontWeight:600, maxWidth:200 }}>{r.nombre}</td>
                    <td style={{ fontSize:10, color:'#9ca89c', fontFamily:"'Barlow Condensed',sans-serif" }}>{r.codigo}</td>
                    <td style={{ color:'#9ca89c' }}>{r.unidad}</td>
                    <td>
                      <span className="badge" style={{ background:r.categoria==='TI'?'#f0fdf4':'#faf5ff', color:r.categoria==='TI'?'#166534':'#5b21b6' }}>
                        {r.categoria}
                      </span>
                    </td>
                    <td style={{ fontSize:11, color:'#555f55', fontWeight:600 }}>{r.bodega.nombre}</td>
                    <td className="num" style={{ fontWeight:700, fontSize:14 }}>{r.stockActual}</td>
                    <td className="num" style={{ color:'#9ca89c' }}>{matCop(r.costo_unitario)}</td>
                    <td className="num" style={{ fontWeight:700, color:'#144E4A' }}>{matCop(r.importe)}</td>
                    <td>
                      <span className="badge" style={{ background:r.st.bg, color:r.st.color }}>{r.st.label}</span>
                    </td>
                    {showActions && (
                      <td>
                        <button
                          title="Corregir stock"
                          onClick={() => { setCorrModal({ item:r, bodega:r.bodega, stockActual:r.stockActual }); setCorrQty(String(r.stockActual)) }}
                          style={{ background:'none', border:'1.5px solid #e0e4e0', borderRadius:20, padding:'2px 8px', fontSize:12, cursor:'pointer', color:'#555f55' }}>
                          <IconEdit size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background:'#f0f7f0', fontWeight:700 }}>
                    <td colSpan={7} style={{ fontSize:10, color:'#144E4A', padding:'6px 8px' }}>
                      Total ({rows.length} registros)
                    </td>
                    <td className="num" style={{ color:'#144E4A', fontWeight:700 }}>{matCop(totalImporte)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ── Modal: Nueva Entrada ── */}
      {entModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:440 }}>
            <div style={{ background:'#144E4A', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a', borderRadius:'16px 16px 0 0' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Registrar Entrada
              </span>
              <button onClick={() => setEntModal(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Nº Documento</label>
                  <input type="text" className="fc" value={entForm.numero_doc} readOnly
                    style={{ background:'#f5f5f5', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }} />
                </div>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={entForm.fecha}
                    onChange={e => setEntForm(p => ({ ...p, fecha:e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="fl">Material *</label>
                <SearchableSelect
                  options={catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES').map(c => ({ value: c.id, label: c.nombre, sub: c.codigo }))}
                  value={String(entForm.catalogo_id || '')}
                  onChange={val => {
                    const cat = catalogo.find(c => c.id === Number(val))
                    setEntForm(p => ({ ...p, catalogo_id: val, valor_unitario: cat?.costo_unitario || 0 }))
                  }}
                  placeholder="Buscar material…"
                />
              </div>

              <div>
                <label className="fl">Bodega *</label>
                <select className="fc" value={entForm.bodega_id}
                  onChange={e => setEntForm(p => ({ ...p, bodega_id: e.target.value }))}>
                  <option value="">— Seleccionar bodega —</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Cantidad *</label>
                  <input type="number" min="1" className="fc" value={entForm.cantidad}
                    onChange={e => setEntForm(p => ({ ...p, cantidad:e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Precio Unitario</label>
                  <input type="number" className="fc" value={entForm.valor_unitario}
                    readOnly={!entForm.editPrice}
                    style={{ background: entForm.editPrice ? '#fff' : '#f5f5f5' }}
                    onChange={e => setEntForm(p => ({ ...p, valor_unitario:e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="fl">Origen (Proveedor)</label>
                <select className="fc" value={entForm.proveedor_id}
                  onChange={e => {
                    const prov = proveedores.find(p => String(p.id) === e.target.value)
                    setEntForm(p => ({ ...p, proveedor_id: e.target.value, origen: prov?.nombre || '' }))
                  }}>
                  <option value="">— Proveedor / Compra —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setEntModal(false)}>Cancelar</button>
                <button className="btn bp" onClick={handleEntSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Registrar Entrada'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar Salida ── */}
      {salModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:440 }}>
            <div style={{ background:'#c0392b', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #922b21', borderRadius:'16px 16px 0 0' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Registrar Salida
              </span>
              <button onClick={() => setSalModal(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'#fff5f5', border:'1px solid #f5c6cb', borderRadius:8, padding:'7px 10px', fontSize:11, color:'#c0392b' }}>
                Para salidas a <strong>sitios Nokia</strong>, usa la función <strong>Despacho</strong> en la página Movimientos.
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Nº Documento</label>
                  <input type="text" className="fc" value={salForm.numero_doc} readOnly
                    style={{ background:'#f5f5f5', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }} />
                </div>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={salForm.fecha}
                    onChange={e => setSalForm(p => ({ ...p, fecha:e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="fl">Material *</label>
                <SearchableSelect
                  options={catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES').map(c => ({ value: c.id, label: c.nombre, sub: c.codigo }))}
                  value={String(salForm.catalogo_id || '')}
                  onChange={val => {
                    const cat = catalogo.find(c => c.id === Number(val))
                    const stk = salForm.bodega_id ? getStock(Number(val), Number(salForm.bodega_id)) : 0
                    setSalForm(p => ({ ...p, catalogo_id: val, valor_unitario: cat?.costo_unitario || 0, _stockDisp: stk }))
                  }}
                  placeholder="Buscar material…"
                />
              </div>

              <div>
                <label className="fl">Bodega *</label>
                <select className="fc" value={salForm.bodega_id}
                  onChange={e => {
                    const stk = salForm.catalogo_id ? getStock(Number(salForm.catalogo_id), Number(e.target.value)) : 0
                    setSalForm(p => ({ ...p, bodega_id: e.target.value, _stockDisp: stk }))
                  }}>
                  <option value="">— Seleccionar bodega —</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
                {salForm.catalogo_id && salForm.bodega_id && (
                  <div style={{ fontSize:10, color:'#555f55', marginTop:4 }}>
                    Stock disponible: <strong style={{ color: (salForm._stockDisp||0) === 0 ? '#c0392b' : '#144E4A' }}>{salForm._stockDisp || 0}</strong>
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Cantidad *</label>
                  <input type="number" min="1" className="fc" value={salForm.cantidad}
                    onChange={e => setSalForm(p => ({ ...p, cantidad:e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Precio Unitario</label>
                  <input type="number" className="fc" value={salForm.valor_unitario} readOnly
                    style={{ background:'#f5f5f5' }} />
                </div>
              </div>

              <div>
                <label className="fl">Destino</label>
                <input type="text" className="fc" value={salForm.destino} placeholder="Ej. Bodega Cali, Devolución…"
                  onChange={e => setSalForm(p => ({ ...p, destino:e.target.value }))} />
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setSalModal(false)}>Cancelar</button>
                <button className="btn" style={{ background:'#c0392b', color:'#fff', borderRadius:20, fontWeight:700, fontSize:12, padding:'6px 18px', cursor:'pointer' }}
                  onClick={handleSalSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Registrar Salida'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Corrección de Stock ── */}
      {corrModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:380 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #d68910', borderRadius:'16px 16px 0 0' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Corrección de Stock
              </span>
              <button onClick={() => setCorrModal(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:8, padding:'9px 12px', fontSize:11, color:'#856404' }}>
                Ajusta el stock directamente sin generar movimiento. Solo para corregir errores de conteo.
              </div>
              <div style={{ background:'#f8f8f8', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#0a0a0a' }}>{corrModal.item.nombre}</div>
                <div style={{ fontSize:10, color:'#9ca89c', marginTop:3 }}>
                  Bodega: <strong style={{ color:'#555f55' }}>{corrModal.bodega.nombre}</strong>
                </div>
                <div style={{ fontSize:12, marginTop:6 }}>
                  Stock actual: <strong style={{ fontSize:16, color: corrModal.stockActual === 0 ? '#c0392b' : '#144E4A' }}>{corrModal.stockActual}</strong>
                </div>
              </div>
              <div>
                <label className="fl">Nuevo Stock *</label>
                <input type="number" min="0" className="fc" value={corrQty}
                  onChange={e => setCorrQty(e.target.value)}
                  style={{ fontSize:18, fontWeight:700, textAlign:'center' }} autoFocus />
              </div>
              {corrQty !== '' && !isNaN(Number(corrQty)) && (
                <div style={{ fontSize:11, color: Number(corrQty) === corrModal.stockActual ? '#9ca89c' : '#144E4A', fontWeight:600, textAlign:'center' }}>
                  {Number(corrQty) === corrModal.stockActual ? 'Sin cambios'
                    : `Cambio: ${Number(corrQty) > corrModal.stockActual ? '+' : ''}${Number(corrQty) - corrModal.stockActual} unidades`}
                </div>
              )}
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setCorrModal(null)}>Cancelar</button>
                <button className="btn" style={{ background:'#d68910', color:'#fff', borderRadius:20, fontWeight:700, fontSize:12, cursor:'pointer', padding:'6px 18px' }}
                  onClick={handleCorrSave}>
                  Guardar Corrección
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
