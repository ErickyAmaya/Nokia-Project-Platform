import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

function statusInfo(stock, minimo) {
  if (stock === 0)          return { label: 'Agotado',    bg: '#fde8e7', color: '#c0392b' }
  if (stock < minimo)       return { label: 'Bajo Mínimo', bg: '#fef3cd', color: '#856404' }
  return                           { label: 'En Stock',   bg: '#d4edda', color: '#1a6130' }
}

export default function MatInventario() {
  const catalogo  = useMatStore(s => s.catalogo)
  const bodegas   = useMatStore(s => s.bodegas)
  const getStock  = useMatStore(s => s.getStock)
  const saveCatItem    = useMatStore(s => s.saveCatItem)
  const deleteCatItem  = useMatStore(s => s.deleteCatItem)
  const user      = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,     setSearch]     = useState('')
  const [filCat,     setFilCat]     = useState('')
  const [filBodega,  setFilBodega]  = useState('')
  const [filStatus,  setFilStatus]  = useState('')
  const [modal,      setModal]      = useState(null)  // item o null
  const [form,       setForm]       = useState({})

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return catalogo
      .filter(c => {
        if (filCat && c.categoria !== filCat) return false
        if (filStatus) {
          const s = getStock(c.id, filBodega ? Number(filBodega) : undefined)
          if (filStatus === 'agotado' && s !== 0) return false
          if (filStatus === 'bajo'    && (s === 0 || s >= c.stock_minimo)) return false
          if (filStatus === 'stock'   && s < c.stock_minimo) return false
        }
        if (q && !`${c.nombre} ${c.codigo}`.toLowerCase().includes(q)) return false
        return true
      })
      .map(c => {
        const bodId = filBodega ? Number(filBodega) : undefined
        const s = getStock(c.id, bodId)
        return { ...c, stockActual: s, importe: s * (c.costo_unitario || 0) }
      })
  }, [catalogo, search, filCat, filBodega, filStatus, getStock])

  const totalImporte = rows.reduce((a, r) => a + r.importe, 0)

  function openModal(item = null) {
    setForm(item ? { ...item } : { nombre:'', codigo:'', unidad:'Und.', categoria:'TI', costo_unitario:0, stock_minimo:0, activo:true })
    setModal(item || 'new')
  }

  async function handleSave() {
    try {
      await saveCatItem(form)
      showToast(form.id ? 'Material actualizado' : 'Material creado')
      setModal(null)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(item) {
    const ok = await confirm('Eliminar Material', `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`)
    if (!ok) return
    try { await deleteCatItem(item.id); showToast('Material eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      {ConfirmModalUI}
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Inventario de Materiales ({rows.length})</h2>
          {canEdit && (
            <button className="btn bp btn-sm" onClick={() => openModal()}>+ Material</button>
          )}
        </div>
        <div className="card-b">
          {/* Filtros */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar material o código…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
            {['','TI','CW'].map(v => (
              <button key={v} onClick={() => setFilCat(v)}
                style={{ padding:'4px 12px', fontSize:10, fontWeight:700, borderRadius:20,
                  border: filCat===v ? 'none' : '1.5px solid #e0e4e0',
                  background: filCat===v ? '#144E4A' : '#fff',
                  color: filCat===v ? '#fff' : '#555f55', cursor:'pointer' }}>
                {v || 'Todos'}
              </button>
            ))}
            <select className="fc" value={filBodega} onChange={e => setFilBodega(e.target.value)} style={{ maxWidth:150 }}>
              <option value="">Todas las bodegas</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
            <select className="fc" value={filStatus} onChange={e => setFilStatus(e.target.value)} style={{ maxWidth:140 }}>
              <option value="">Todos los status</option>
              <option value="stock">En Stock</option>
              <option value="bajo">Bajo Mínimo</option>
              <option value="agotado">Agotado</option>
            </select>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Material</th><th>Código</th><th>Und.</th><th>Cat.</th>
                {!filBodega && bodegas.map(b => <th key={b.id} className="num">{b.nombre}</th>)}
                {filBodega && <th className="num">Stock</th>}
                <th className="num">Mínimo</th><th>Status</th>
                <th className="num">Costo Unit.</th><th className="num">Importe</th>
                {canEdit && <th></th>}
              </tr></thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={12} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin resultados</td></tr>
                )}
                {rows.map(c => {
                  const st = statusInfo(c.stockActual, c.stock_minimo)
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight:600 }}>{c.nombre}</td>
                      <td style={{ fontSize:10, color:'#9ca89c' }}>{c.codigo}</td>
                      <td>{c.unidad}</td>
                      <td><span className="badge" style={{ background:c.categoria==='TI'?'#f0fdf4':'#faf5ff', color:c.categoria==='TI'?'#166534':'#5b21b6' }}>{c.categoria}</span></td>
                      {!filBodega && bodegas.map(b => (
                        <td key={b.id} className="num" style={{ fontWeight:600 }}>{getStock(c.id, b.id)}</td>
                      ))}
                      {filBodega && <td className="num" style={{ fontWeight:700 }}>{c.stockActual}</td>}
                      <td className="num" style={{ color:'#9ca89c' }}>{c.stock_minimo}</td>
                      <td><span className="badge" style={{ background:st.bg, color:st.color }}>{st.label}</span></td>
                      <td className="num">{matCop(c.costo_unitario)}</td>
                      <td className="num" style={{ fontWeight:700, color:'#144E4A' }}>{matCop(c.importe)}</td>
                      {canEdit && (
                        <td style={{ whiteSpace:'nowrap' }}>
                          <button className="btn-edit" onClick={() => openModal(c)}>✏</button>
                          {' '}
                          <button className="btn-del" onClick={() => handleDelete(c)}>✕</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background:'#f0f7f0', fontWeight:700 }}>
                    <td colSpan={filBodega ? 7 : 4 + bodegas.length} style={{ fontSize:10, color:'#144E4A', padding:'6px 8px' }}>
                      Total ({rows.length} materiales)
                    </td>
                    <td></td><td></td>
                    <td className="num" style={{ color:'#144E4A' }}>{matCop(totalImporte)}</td>
                    {canEdit && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Modal editar/crear */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {form.id ? 'Editar Material' : 'Nuevo Material'}
              </span>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nombre', key:'nombre', type:'text' },
                { label:'Código', key:'codigo', type:'text' },
                { label:'Unidad', key:'unidad', type:'text' },
                { label:'Costo Unitario', key:'costo_unitario', type:'number' },
                { label:'Stock Mínimo',   key:'stock_minimo',   type:'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:'#555f55', marginBottom:3 }}>{f.label}</label>
                  <input type={f.type} className="fc" value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: f.type==='number' ? Number(e.target.value) : e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:'#555f55', marginBottom:3 }}>Categoría</label>
                <select className="fc" value={form.categoria || 'TI'} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="TI">TI</option>
                  <option value="CW">CW</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn bou" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn bp" onClick={handleSave}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
