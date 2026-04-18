import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

const CAT_COLORS = {
  TI:          { bg:'#f0fdf4', color:'#166534' },
  CW:          { bg:'#faf5ff', color:'#5b21b6' },
  PROVEEDORES: { bg:'#fff7ed', color:'#9a3412' },
}

export default function MatCatalogo() {
  const catalogo       = useMatStore(s => s.catalogo)
  const saveCatItem    = useMatStore(s => s.saveCatItem)
  const deleteCatItem  = useMatStore(s => s.deleteCatItem)
  const user           = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,  setSearch]  = useState('')
  const [filCat,  setFilCat]  = useState('')
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState({})

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return catalogo.filter(c => {
      if (filCat && c.categoria !== filCat) return false
      if (q && !`${c.nombre} ${c.codigo} ${c.unidad}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [catalogo, search, filCat])

  function openModal(item = null) {
    setForm(item
      ? { ...item }
      : { nombre:'', codigo:'', unidad:'Und.', categoria:'TI', costo_unitario:0, stock_minimo:0, activo:true, descripcion:'', imagen_url:'' }
    )
    setModal(true)
  }

  async function handleSave() {
    if (!form.nombre || !form.codigo) { showToast('Nombre y código son requeridos', 'err'); return }
    try {
      await saveCatItem(form)
      showToast(form.id ? 'Material actualizado' : 'Material creado')
      setModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(item) {
    const ok = await confirm('Eliminar del Catálogo', `¿Eliminar "${item.nombre}"? Se eliminará también su stock.`)
    if (!ok) return
    try { await deleteCatItem(item.id); showToast('Material eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      {ConfirmModalUI}
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Catálogo de Materiales ({filtered.length})</h2>
          {canEdit && <button className="btn bp btn-sm" onClick={() => openModal()}>+ Material</button>}
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar nombre, código…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
            {['','TI','CW','PROVEEDORES'].map(v => (
              <button key={v} onClick={() => setFilCat(v)}
                style={{ padding:'4px 12px', fontSize:10, fontWeight:700, borderRadius:20,
                  border: filCat===v?'none':'1.5px solid #e0e4e0',
                  background: filCat===v?'#144E4A':'#fff',
                  color: filCat===v?'#fff':'#555f55', cursor:'pointer' }}>
                {v || 'Todos'}
              </button>
            ))}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Nombre</th><th>Código</th><th>Unidad</th><th>Categoría</th>
                <th className="num">Costo Unitario</th><th className="num">Stock Mínimo</th><th>Activo</th>
                {canEdit && <th></th>}
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin resultados</td></tr>
                )}
                {filtered.map(c => {
                  const cc = CAT_COLORS[c.categoria] || CAT_COLORS.TI
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight:600 }}>{c.nombre}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11 }}>{c.codigo}</td>
                      <td style={{ color:'#9ca89c' }}>{c.unidad}</td>
                      <td>
                        <span className="badge" style={{ background:cc.bg, color:cc.color }}>
                          {c.categoria}
                        </span>
                      </td>
                      <td className="num" style={{ color:'#144E4A', fontWeight:600 }}>{matCop(c.costo_unitario)}</td>
                      <td className="num">{c.stock_minimo}</td>
                      <td>
                        <span className="badge" style={{ background:c.activo?'#d4edda':'#f0f0f0', color:c.activo?'#1a6130':'#888' }}>
                          {c.activo?'Activo':'Inactivo'}
                        </span>
                      </td>
                      {canEdit && (
                        <td style={{ whiteSpace:'nowrap' }}>
                          <button className="btn-edit" onClick={() => openModal(c)}><IconEdit /></button>
                          {' '}
                          <button className="btn-del" onClick={() => handleDelete(c)}>✕</button>
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

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {form.id ? 'Editar Material' : 'Nuevo Material'}
              </span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nombre *',          key:'nombre',         type:'text'   },
                { label:'Código *',          key:'codigo',         type:'text'   },
                { label:'Unidad',            key:'unidad',         type:'text'   },
                { label:'Costo Unitario',    key:'costo_unitario', type:'number' },
                { label:'Stock Mínimo',      key:'stock_minimo',   type:'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="fl">{f.label}</label>
                  <input type={f.type} className="fc" value={form[f.key] ?? ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.type==='number' ? Number(e.target.value) : e.target.value }))} />
                </div>
              ))}

              <div>
                <label className="fl">Categoría</label>
                <select className="fc" value={form.categoria || 'TI'} onChange={e => setForm(p => ({ ...p, categoria:e.target.value }))}>
                  <option value="TI">TI</option>
                  <option value="CW">CW</option>
                  <option value="PROVEEDORES">PROVEEDORES</option>
                </select>
              </div>

              <div>
                <label className="fl">Descripción</label>
                <textarea className="fc" rows={2} value={form.descripcion || ''}
                  onChange={e => setForm(p => ({ ...p, descripcion:e.target.value }))}
                  style={{ resize:'vertical', fontFamily:"'Barlow', sans-serif", fontSize:12 }} />
              </div>

              <div>
                <label className="fl">URL de Imagen</label>
                <input type="text" className="fc" placeholder="https://…" value={form.imagen_url || ''}
                  onChange={e => setForm(p => ({ ...p, imagen_url:e.target.value }))} />
                {form.imagen_url && (
                  <img src={form.imagen_url} alt="preview"
                    style={{ marginTop:6, maxHeight:80, borderRadius:4, border:'1px solid #e0e4e0', objectFit:'contain' }}
                    onError={e => { e.target.style.display='none' }}
                  />
                )}
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="checkbox" id="cat-activo" checked={form.activo !== false} onChange={e => setForm(p => ({ ...p, activo:e.target.checked }))} />
                <label htmlFor="cat-activo" style={{ fontSize:12, fontWeight:600 }}>Activo</label>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn bou" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn bp" onClick={handleSave}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
