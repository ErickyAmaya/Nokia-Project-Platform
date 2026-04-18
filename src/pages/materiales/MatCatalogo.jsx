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

const BADGES = [
  { value: 'mejores_precios', label: 'Mejores Precios',    bg:'#dcfce7', color:'#166534', border:'#bbf7d0' },
  { value: 'mayor_plazo',     label: 'Mayor Plazo de Pago', bg:'#dbeafe', color:'#1e40af', border:'#bfdbfe' },
  { value: 'mas_rapido',      label: 'Más Rápido',          bg:'#ffedd5', color:'#9a3412', border:'#fed7aa' },
]

function BadgePill({ value }) {
  const b = BADGES.find(x => x.value === value)
  if (!b) return null
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:9,
      fontWeight:700, letterSpacing:.5, textTransform:'uppercase',
      background:b.bg, color:b.color, border:`1px solid ${b.border}`,
    }}>
      {b.label}
    </span>
  )
}

const MAT_FORM_DEFAULT  = { nombre:'', codigo:'', unidad:'Und.', categoria:'TI', costo_unitario:0, stock_minimo:0, activo:true, descripcion:'', imagen_url:'' }
const PROV_FORM_DEFAULT = { nombre:'', codigo:'', categoria:'PROVEEDORES', direccion:'', contacto:'', email:'', telefono:'', badge:'', activo:true, costo_unitario:0, stock_minimo:0, unidad:'' }

export default function MatCatalogo() {
  const catalogo       = useMatStore(s => s.catalogo)
  const saveCatItem    = useMatStore(s => s.saveCatItem)
  const deleteCatItem  = useMatStore(s => s.deleteCatItem)
  const user           = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,  setSearch]  = useState('')
  const [filCat,  setFilCat]  = useState('')
  const [modal,   setModal]   = useState(false)   // modal materiales
  const [provMod, setProvMod] = useState(false)   // modal proveedores
  const [form,    setForm]    = useState({})

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)
  const isProveedoresTab = filCat === 'PROVEEDORES'

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return catalogo.filter(c => {
      if (filCat && c.categoria !== filCat) return false
      if (q && !`${c.nombre} ${c.codigo} ${c.unidad || ''} ${c.contacto || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [catalogo, search, filCat])

  function openMatModal(item = null) {
    setForm(item ? { ...item } : { ...MAT_FORM_DEFAULT })
    setModal(true)
  }

  function openProvModal(item = null) {
    setForm(item ? { ...item } : { ...PROV_FORM_DEFAULT })
    setProvMod(true)
  }

  function openEdit(item) {
    if (item.categoria === 'PROVEEDORES') openProvModal(item)
    else openMatModal(item)
  }

  async function handleSave() {
    if (!form.nombre || !form.codigo) { showToast('Nombre y código son requeridos', 'err'); return }
    try {
      await saveCatItem(form)
      showToast(form.id ? 'Material actualizado' : 'Material creado')
      setModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleProvSave() {
    if (!form.nombre) { showToast('El nombre es requerido', 'err'); return }
    try {
      await saveCatItem({ ...form, categoria: 'PROVEEDORES', codigo: form.codigo || form.nombre.slice(0,8).toUpperCase().replace(/ /g,'_') })
      showToast(form.id ? 'Proveedor actualizado' : 'Proveedor creado')
      setProvMod(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(item) {
    const label = item.categoria === 'PROVEEDORES' ? 'proveedor' : 'material'
    const ok = await confirm(`Eliminar ${label}`, `¿Eliminar "${item.nombre}"?`)
    if (!ok) return
    try { await deleteCatItem(item.id); showToast('Eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      <ConfirmModalUI />
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Catálogo de Materiales ({filtered.length})</h2>
          {canEdit && (
            isProveedoresTab
              ? <button className="btn bp btn-sm" onClick={() => openProvModal()}>+ Proveedor</button>
              : <button className="btn bp btn-sm" onClick={() => openMatModal()}>+ Material</button>
          )}
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
            {/* ── Vista Proveedores ── */}
            {isProveedoresTab ? (
              <table className="tbl">
                <thead><tr>
                  <th>Nombre</th><th>Dirección</th><th>Contacto</th>
                  <th>Email</th><th>Teléfono</th><th>Categoría</th>
                  {canEdit && <th></th>}
                </tr></thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin proveedores</td></tr>
                  )}
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight:600 }}>
                        <div>{c.nombre}</div>
                        {c.badge && <div style={{ marginTop:3 }}><BadgePill value={c.badge} /></div>}
                      </td>
                      <td style={{ fontSize:11, color:'#9ca89c' }}>{c.direccion || '—'}</td>
                      <td style={{ fontSize:11 }}>{c.contacto || '—'}</td>
                      <td style={{ fontSize:11, color:'#1d4ed8' }}>{c.email || '—'}</td>
                      <td style={{ fontSize:11 }}>{c.telefono || '—'}</td>
                      <td>
                        <span className="badge" style={{ background:CAT_COLORS.PROVEEDORES.bg, color:CAT_COLORS.PROVEEDORES.color }}>
                          PROVEEDOR
                        </span>
                      </td>
                      {canEdit && (
                        <td style={{ whiteSpace:'nowrap' }}>
                          <button className="btn-edit" onClick={() => openEdit(c)}><IconEdit /></button>
                          {' '}
                          <button className="btn-del" onClick={() => handleDelete(c)}>✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
            /* ── Vista Materiales ── */
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
                            <button className="btn-edit" onClick={() => openEdit(c)}><IconEdit /></button>
                            {' '}
                            <button className="btn-del" onClick={() => handleDelete(c)}>✕</button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Material ── */}
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
                { label:'Nombre *',       key:'nombre',         type:'text'   },
                { label:'Código *',       key:'codigo',         type:'text'   },
                { label:'Unidad',         key:'unidad',         type:'text'   },
                { label:'Costo Unitario', key:'costo_unitario', type:'number' },
                { label:'Stock Mínimo',   key:'stock_minimo',   type:'number' },
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

      {/* ── Modal Proveedor ── */}
      {provMod && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ background:'#9a3412', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #fb923c' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {form.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </span>
              <button onClick={() => setProvMod(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nombre *',           key:'nombre',   type:'text' },
                { label:'Dirección',          key:'direccion', type:'text' },
                { label:'Persona de Contacto', key:'contacto', type:'text' },
                { label:'Correo Electrónico', key:'email',    type:'text' },
                { label:'Teléfono',           key:'telefono', type:'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="fl">{f.label}</label>
                  <input type={f.type} className="fc" value={form[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}

              {/* Badge selector */}
              <div>
                <label className="fl">Categoría</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                  {BADGES.map(b => (
                    <div key={b.value}
                      onClick={() => setForm(p => ({ ...p, badge: p.badge === b.value ? '' : b.value }))}
                      style={{
                        padding:'6px 14px', borderRadius:20, fontSize:10, fontWeight:700,
                        letterSpacing:.5, textTransform:'uppercase', cursor:'pointer',
                        background: form.badge === b.value ? b.bg : '#f5f5f5',
                        color: form.badge === b.value ? b.color : '#9ca89c',
                        border: `1.5px solid ${form.badge === b.value ? b.border : '#e0e4e0'}`,
                        transition:'all .15s',
                      }}
                    >
                      {b.label}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                <input type="checkbox" id="prov-activo" checked={form.activo !== false} onChange={e => setForm(p => ({ ...p, activo:e.target.checked }))} />
                <label htmlFor="prov-activo" style={{ fontSize:12, fontWeight:600 }}>Activo</label>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn bou" onClick={() => setProvMod(false)}>Cancelar</button>
                <button className="btn bp" onClick={handleProvSave}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
