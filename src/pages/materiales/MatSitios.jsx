import { useState } from 'react'
import { useMatStore } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

const TIPOS = ['Macro','Micro','DAS','IBS','Rooftop','Torre','Canastilla','Monopole']

export default function MatSitios() {
  const sitios      = useMatStore(s => s.sitios)
  const saveSitio   = useMatStore(s => s.saveSitio)
  const deleteSitio = useMatStore(s => s.deleteSitio)
  const user        = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modal, setModal]   = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm]     = useState({ nombre:'', tipo_cw:'', regional:'Sur-Occidente', comentarios:'', activo:true })

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  const filtered = sitios.filter(s => {
    const q = search.toLowerCase()
    return !q || `${s.nombre} ${s.regional}`.toLowerCase().includes(q)
  })

  function openModal(s = null) {
    setForm(s ? { ...s } : { nombre:'', tipo_cw:'', regional:'Sur-Occidente', comentarios:'', activo:true })
    setModal(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { showToast('El nombre es requerido', 'err'); return }
    try {
      await saveSitio(form)
      showToast(form.id ? 'Sitio actualizado' : 'Sitio creado')
      setModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(s) {
    const ok = await confirm('Eliminar Sitio', `¿Eliminar "${s.nombre}"?`)
    if (!ok) return
    try { await deleteSitio(s.id); showToast('Sitio eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      {ConfirmModalUI}
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Sitios de Obra ({filtered.length})</h2>
          {canEdit && <button className="btn bp btn-sm" onClick={() => openModal()}>+ Sitio</button>}
        </div>
        <div className="card-b">
          <input className="fc" placeholder="Buscar sitio…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ marginBottom:12, maxWidth:320 }} />
          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Nombre</th><th>Tipo</th><th>Regional</th><th>Comentarios</th><th>Activo</th>
                {canEdit && <th></th>}
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin sitios registrados</td></tr>
                )}
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight:600 }}>{s.nombre}</td>
                    <td style={{ color:'#9ca89c' }}>{s.tipo_cw || '—'}</td>
                    <td style={{ color:'#9ca89c' }}>{s.regional}</td>
                    <td style={{ fontSize:10, color:'#9ca89c' }}>{s.comentarios || '—'}</td>
                    <td><span className="badge" style={{ background:s.activo?'#d4edda':'#f0f0f0', color:s.activo?'#1a6130':'#888' }}>{s.activo?'Activo':'Inactivo'}</span></td>
                    {canEdit && (
                      <td style={{ whiteSpace:'nowrap' }}>
                        <button className="btn-edit" onClick={() => openModal(s)}>✏</button>
                        {' '}
                        <button className="btn-del" onClick={() => handleDelete(s)}>✕</button>
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
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {form.id ? 'Editar Sitio' : 'Nuevo Sitio'}
              </span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label className="fl">Nombre *</label>
                <input type="text" className="fc" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))} />
              </div>
              <div>
                <label className="fl">Tipo</label>
                <select className="fc" value={form.tipo_cw || ''} onChange={e => setForm(p => ({ ...p, tipo_cw:e.target.value }))}>
                  <option value="">— Opcional —</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Regional</label>
                <input type="text" className="fc" value={form.regional} onChange={e => setForm(p => ({ ...p, regional:e.target.value }))} />
              </div>
              <div>
                <label className="fl">Comentarios</label>
                <input type="text" className="fc" value={form.comentarios || ''} onChange={e => setForm(p => ({ ...p, comentarios:e.target.value }))} />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo:e.target.checked }))} />
                <label htmlFor="activo" style={{ fontSize:12, fontWeight:600 }}>Activo</label>
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
