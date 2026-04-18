import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAppStore }  from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'
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

const QM_RESET = { fecha: new Date().toISOString().slice(0,10), cantidad: 1, origen: '', sitio_id: '', destino: '', editPrice: false }

export default function MatInventario() {
  const catalogo       = useMatStore(s => s.catalogo)
  const bodegas        = useMatStore(s => s.bodegas)
  const movimientos    = useMatStore(s => s.movimientos)
  const getStock       = useMatStore(s => s.getStock)
  const addMovimiento  = useMatStore(s => s.addMovimiento)
  const saveCatItem    = useMatStore(s => s.saveCatItem)
  const deleteCatItem  = useMatStore(s => s.deleteCatItem)
  const liquidadorSitios = useAppStore(s => s.sitios)
  const user           = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,    setSearch]    = useState('')
  const [filCat,    setFilCat]    = useState('')
  const [filBodega, setFilBodega] = useState('')
  const [filStatus, setFilStatus] = useState('')
  const [editModal, setEditModal] = useState(null)
  const [editForm,  setEditForm]  = useState({})
  // Quick entry/exit
  const [qm,     setQm]     = useState(null)  // { tipo, item, bodega, valorUnit }
  const [qmForm, setQmForm] = useState(QM_RESET)

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  const proveedores = useMemo(() => catalogo.filter(c => c.categoria === 'PROVEEDORES' && c.activo), [catalogo])

  // Filas: una por (material, bodega) — estructura plana como en el diseño de referencia
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
  }, [catalogo, bodegas, search, filCat, filBodega, filStatus, getStock])

  const totalImporte = rows.reduce((a, r) => a + r.importe, 0)

  // ── Quick Movement modal ─────────────────────────────────────────
  function openQm(tipo, item, bodega) {
    setQm({ tipo, item, bodega, valorUnit: item.costo_unitario || 0 })
    setQmForm({ ...QM_RESET, numero_doc: nextMovNum(tipo, movimientos) })
  }

  async function handleQmSave() {
    if (!qmForm.cantidad || qmForm.cantidad <= 0) { showToast('Cantidad inválida', 'err'); return }
    const stk = getStock(qm.item.id, qm.bodega.id)
    if (qm.tipo === 'Salida' && Number(qmForm.cantidad) > stk) {
      showToast(`Stock insuficiente (disponible: ${stk})`, 'err'); return
    }
    try {
      await addMovimiento({
        numero_doc:     qmForm.numero_doc,
        fecha:          qmForm.fecha,
        catalogo_id:    qm.item.id,
        bodega_id:      qm.bodega.id,
        tipo:           qm.tipo,
        cantidad:       Number(qmForm.cantidad),
        valor_unitario: qm.valorUnit,
        origen:         qm.tipo === 'Entrada' ? qmForm.origen : '',
        destino:        qm.tipo === 'Salida'  ? qmForm.destino : '',
        sitio_id:       qmForm.sitio_id ? Number(qmForm.sitio_id) : null,
        created_by:     user?.nombre || user?.email,
      })
      showToast(`${qm.tipo} registrada`)
      setQm(null)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  // ── Edit catalog modal ───────────────────────────────────────────
  function openEdit(item) {
    setEditForm({ ...item })
    setEditModal(true)
  }

  async function handleEditSave() {
    try {
      await saveCatItem(editForm)
      showToast('Material actualizado')
      setEditModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(item) {
    const ok = await confirm('Eliminar Material', `¿Eliminar "${item.nombre}"?`)
    if (!ok) return
    try { await deleteCatItem(item.id); showToast('Material eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      <ConfirmModalUI />

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, margin:0, letterSpacing:.5, textTransform:'uppercase' }}>
          Inventario de Materiales
        </h1>
        <div style={{ display:'flex', gap:6 }}>
          {canEdit && <button className="btn bp btn-sm" onClick={() => openQm('Entrada', { id:'', nombre:'', costo_unitario:0, stock_minimo:0 }, bodegas[0] || {})}>+ Entrada</button>}
          {canEdit && <button className="btn btn-sm" style={{ background:'#c0392b', color:'#fff' }} onClick={() => openQm('Salida', { id:'', nombre:'', costo_unitario:0, stock_minimo:0 }, bodegas[0] || {})}>→ Despacho</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-b">
          {/* Filtros */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar material o código…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
            {['','TI','CW'].map(v => (
              <button key={v} onClick={() => setFilCat(v)}
                style={{ padding:'4px 12px', fontSize:10, fontWeight:700, borderRadius:20,
                  border: filCat===v ? 'none' : '1.5px solid #e0e4e0',
                  background: filCat===v ? '#0a0a0a' : '#fff',
                  color: filCat===v ? '#fff' : '#555f55', cursor:'pointer' }}>
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

          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead>
                <tr style={{ background:'#0a0a0a' }}>
                  <th style={{ color:'#fff' }}>MATERIAL</th>
                  <th style={{ color:'#fff' }}>CÓDIGO</th>
                  <th style={{ color:'#fff' }}>UND.</th>
                  <th style={{ color:'#fff' }}>CAT.</th>
                  <th style={{ color:'#fff' }}>BODEGA</th>
                  <th style={{ color:'#fff' }} className="num">STOCK</th>
                  <th style={{ color:'#fff' }} className="num">PRECIO</th>
                  <th style={{ color:'#fff' }} className="num">IMPORTE</th>
                  <th style={{ color:'#fff' }}>STATUS</th>
                  {canEdit && <th style={{ color:'#fff' }}></th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin resultados</td></tr>
                )}
                {rows.map((r, i) => (
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
                    {canEdit && (
                      <td style={{ whiteSpace:'nowrap', display:'flex', gap:4, alignItems:'center' }}>
                        <button
                          onClick={() => openQm('Entrada', r, r.bodega)}
                          style={{ padding:'3px 8px', fontSize:10, fontWeight:700, borderRadius:4, border:'none', background:'#1a9c1a', color:'#fff', cursor:'pointer' }}>
                          + Ent
                        </button>
                        <button
                          onClick={() => openQm('Salida', r, r.bodega)}
                          style={{ padding:'3px 8px', fontSize:10, fontWeight:700, borderRadius:4, border:'none', background:'#c0392b', color:'#fff', cursor:'pointer' }}>
                          - Sal
                        </button>
                        <button className="btn-edit" onClick={() => openEdit(r)} title="Editar material"><IconEdit /></button>
                        <button className="btn-del" onClick={() => handleDelete(r)} title="Eliminar material">✕</button>
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

      {/* ── Quick Movement Modal ── */}
      {qm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:420 }}>
            <div style={{ background: qm.tipo==='Entrada'?'#144E4A':'#c0392b', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`3px solid ${qm.tipo==='Entrada'?'#1a9c1a':'#922b21'}` }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Registrar {qm.tipo}
              </span>
              <button onClick={() => setQm(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {/* Info del material */}
              <div style={{ background:'#f8f8f8', borderRadius:6, padding:'8px 12px', fontSize:12 }}>
                <div style={{ fontWeight:700, color:'#0a0a0a' }}>{qm.item.nombre || '— selecciona arriba —'}</div>
                <div style={{ fontSize:10, color:'#9ca89c', marginTop:2 }}>Bodega: <strong>{qm.bodega.nombre}</strong> · Stock actual: <strong>{getStock(qm.item.id, qm.bodega.id)}</strong></div>
              </div>

              {/* Material si no viene pre-llenado */}
              {!qm.item.id && (
                <div>
                  <label className="fl">Material *</label>
                  <SearchableSelect
                    options={catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES').map(c => ({ value: c.id, label: c.nombre, sub: c.codigo }))}
                    value={String(qm.item.id || '')}
                    onChange={val => {
                      const cat = catalogo.find(c => c.id === Number(val))
                      if (cat) setQm(p => ({ ...p, item: cat, valorUnit: cat.costo_unitario || 0 }))
                    }}
                    placeholder="Buscar material…"
                  />
                </div>
              )}

              {/* Bodega si no viene pre-llenada */}
              {!qm.bodega.id && (
                <div>
                  <label className="fl">Bodega *</label>
                  <select className="fc" onChange={e => {
                    const b = bodegas.find(x => x.id === Number(e.target.value))
                    if (b) setQm(p => ({ ...p, bodega: b }))
                  }}>
                    <option value="">— Seleccionar —</option>
                    {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Nº Documento</label>
                  <input type="text" className="fc" value={qmForm.numero_doc} readOnly
                    style={{ background:'#f5f5f5', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }} />
                </div>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={qmForm.fecha}
                    onChange={e => setQmForm(p => ({ ...p, fecha:e.target.value }))} />
                </div>
              </div>

              {qm.tipo === 'Entrada' && (
                <div>
                  <label className="fl">Origen (Proveedor)</label>
                  <select className="fc" value={qmForm.origen} onChange={e => setQmForm(p => ({ ...p, origen:e.target.value }))}>
                    <option value="">— Proveedor —</option>
                    {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                  </select>
                </div>
              )}

              {qm.tipo === 'Salida' && (
                <div>
                  <label className="fl">Destino (Sitio Nokia)</label>
                  <select className="fc" value={qmForm.sitio_id} onChange={e => {
                    const s = (liquidadorSitios || []).find(x => String(x.id) === e.target.value)
                    setQmForm(p => ({ ...p, sitio_id:e.target.value, destino: s?.nombre || '' }))
                  }}>
                    <option value="">— Opcional —</option>
                    {(liquidadorSitios || []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Cantidad *</label>
                  <input type="number" min="1" className="fc" value={qmForm.cantidad}
                    onChange={e => setQmForm(p => ({ ...p, cantidad:e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Valor Unitario</label>
                  <input type="number" className="fc" value={qm.valorUnit} readOnly
                    style={{ background:'#f5f5f5' }} />
                </div>
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setQm(null)}>Cancelar</button>
                <button
                  className="btn"
                  style={{ background: qm.tipo==='Entrada'?'#1a9c1a':'#c0392b', color:'#fff', padding:'6px 18px', borderRadius:6, fontWeight:700, fontSize:12, cursor:'pointer' }}
                  onClick={handleQmSave}>
                  Guardar {qm.tipo}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit catalog modal ── */}
      {editModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Editar Material
              </span>
              <button onClick={() => setEditModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nombre',         key:'nombre',         type:'text'   },
                { label:'Código',         key:'codigo',         type:'text'   },
                { label:'Unidad',         key:'unidad',         type:'text'   },
                { label:'Costo Unitario', key:'costo_unitario', type:'number' },
                { label:'Stock Mínimo',   key:'stock_minimo',   type:'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="fl">{f.label}</label>
                  <input type={f.type} className="fc" value={editForm[f.key] ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, [f.key]: f.type==='number' ? Number(e.target.value) : e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="fl">Categoría</label>
                <select className="fc" value={editForm.categoria || 'TI'} onChange={e => setEditForm(p => ({ ...p, categoria:e.target.value }))}>
                  <option value="TI">TI</option>
                  <option value="CW">CW</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn bou" onClick={() => setEditModal(false)}>Cancelar</button>
                <button className="btn bp" onClick={handleEditSave}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
