import { useState, useMemo } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

const FORM_DEFAULT = { cod_material:'', id_parte:'', descripcion:'', tipo_material:'Partes', aplica_serial:true, notas:'', activo:true }

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

export default function HwCatalogo() {
  const hwCatalogo      = useHwStore(s => s.hwCatalogo)
  const saveHwCatItem   = useHwStore(s => s.saveHwCatItem)
  const deleteHwCatItem = useHwStore(s => s.deleteHwCatItem)
  const user            = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,  setSearch]  = useState('')
  const [filTipo, setFilTipo] = useState('')
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState(FORM_DEFAULT)

  const canEdit = ['admin','coordinador'].includes(user?.role)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return hwCatalogo.filter(c => {
      if (filTipo && c.tipo_material !== filTipo) return false
      if (q && !`${c.descripcion} ${c.cod_material} ${c.id_parte}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [hwCatalogo, search, filTipo])

  function openModal(item = null) {
    setForm(item ? { ...item } : { ...FORM_DEFAULT })
    setModal(true)
  }

  async function handleSave() {
    if (!form.descripcion.trim()) { showToast('La descripción es requerida', 'err'); return }
    try {
      await saveHwCatItem(form)
      showToast(form.id ? 'Equipo actualizado' : 'Equipo creado')
      setModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(item) {
    const ok = await confirm('Eliminar equipo', `¿Eliminar "${item.descripcion}"?`)
    if (!ok) return
    try { await deleteHwCatItem(item.id); showToast('Eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      <ConfirmModalUI />
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Catálogo HW Nokia ({filtered.length})</h2>
          {canEdit && <button className="btn bp btn-sm" onClick={() => openModal()}>+ Tipo de Equipo</button>}
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar descripción, código…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:180 }} />
            <select className="fc" value={filTipo} onChange={e => setFilTipo(e.target.value)} style={{ maxWidth:140 }}>
              <option value="">Todos</option>
              <option value="Partes">Partes</option>
              <option value="Grupos">Grupos</option>
              <option value="HWS">HWS</option>
            </select>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Descripción</th><th>Cód. Equipo</th><th>ID Parte</th>
                <th>Tipo</th><th>Serial</th><th>Activo</th>{canEdit && <th></th>}
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin resultados</td></tr>
                )}
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight:600, fontSize:12 }}>{c.descripcion}</td>
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:'#144E4A' }}>{c.cod_material || '—'}</td>
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11 }}>{c.id_parte || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: c.tipo_material==='Grupos'?'#eff6ff':'#f0fdf4', color: c.tipo_material==='Grupos'?'#1e40af':'#166534' }}>
                        {c.tipo_material}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: c.aplica_serial===false?'#fef3cd':'#e0f2fe', color: c.aplica_serial===false?'#92400e':'#0369a1', fontSize:9 }}>
                        {c.aplica_serial === false ? 'No Aplica' : 'Aplica'}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background:c.activo?'#d4edda':'#f0f0f0', color:c.activo?'#1a6130':'#888' }}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canEdit && (
                      <td style={{ whiteSpace:'nowrap' }}>
                        <button className="btn-edit" onClick={() => openModal(c)}><IconEdit /></button>
                        <button className="btn-del" onClick={() => handleDelete(c)} style={{ marginLeft:4 }}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:460 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1d4ed8' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {form.id ? 'Editar Tipo de Equipo' : 'Nuevo Tipo de Equipo'}
              </span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Descripción *',   key:'descripcion',   type:'text' },
                { label:'Cód. Equipo',   key:'cod_material',  type:'text' },
                { label:'ID Parte',        key:'id_parte',      type:'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="fl">{f.label}</label>
                  <input type="text" className="fc" value={form[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="fl">Tipo Material</label>
                <select className="fc" value={form.tipo_material} onChange={e => setForm(p => ({ ...p, tipo_material: e.target.value }))}>
                  <option value="Partes">Partes</option>
                  <option value="Grupos">Grupos</option>
                  <option value="HWS">HWS</option>
                </select>
              </div>
              <div>
                <label className="fl">Notas</label>
                <textarea className="fc" rows={2} value={form.notas || ''}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  style={{ resize:'vertical', fontSize:12 }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'10px 12px', background:'#f8f8f8', borderRadius:6, border:'1px solid #e0e4e0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="checkbox" id="hw-cat-serial" checked={form.aplica_serial !== false}
                    onChange={e => setForm(p => ({ ...p, aplica_serial: e.target.checked }))} />
                  <label htmlFor="hw-cat-serial" style={{ fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    Aplica Serial
                  </label>
                </div>
                <div style={{ fontSize:10, color:'#9ca89c', lineHeight:1.5 }}>
                  {form.aplica_serial !== false
                    ? 'Cada unidad se identifica con un número de serie individual.'
                    : 'Este ítem no lleva serial — los movimientos se registrarán solo por cantidad.'}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="checkbox" id="hw-cat-activo" checked={form.activo !== false}
                  onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} />
                <label htmlFor="hw-cat-activo" style={{ fontSize:12, fontWeight:600 }}>Activo</label>
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
