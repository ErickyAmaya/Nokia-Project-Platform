import { useState } from 'react'
import { useMatStore } from '../../store/useMatStore'
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

export default function MatConfig() {
  const bodegas      = useMatStore(s => s.bodegas)
  const saveBodega   = useMatStore(s => s.saveBodega)
  const deleteBodega = useMatStore(s => s.deleteBodega)
  const user         = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modal, setModal] = useState(false)
  const [form,  setForm]  = useState({ nombre:'', regional:'Sur-Occidente', ciudad:'', direccion:'' })

  const canEdit = ['admin','logistica'].includes(user?.role)

  function openModal(b = null) {
    setForm(b ? { ...b } : { nombre:'', regional:'Sur-Occidente', ciudad:'', direccion:'' })
    setModal(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { showToast('El nombre es requerido', 'err'); return }
    try {
      await saveBodega(form)
      showToast(form.id ? 'Bodega actualizada' : 'Bodega creada')
      setModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(b) {
    const ok = await confirm('Eliminar Bodega', `¿Eliminar "${b.nombre}"? Se eliminará todo su stock asociado.`)
    if (!ok) return
    try { await deleteBodega(b.id); showToast('Bodega eliminada') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      {ConfirmModalUI}
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Bodegas</h2>
          {canEdit && <button className="btn bp btn-sm" onClick={() => openModal()}>+ Bodega</button>}
        </div>
        <div className="card-b">
          <table className="tbl">
            <thead><tr>
              <th>Nombre</th><th>Regional</th><th>Ciudad</th><th>Dirección</th>
              {canEdit && <th></th>}
            </tr></thead>
            <tbody>
              {bodegas.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin bodegas</td></tr>
              )}
              {bodegas.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight:700 }}>
                    📍 {b.nombre}
                  </td>
                  <td style={{ color:'#9ca89c' }}>{b.regional}</td>
                  <td style={{ color:'#9ca89c' }}>{b.ciudad || '—'}</td>
                  <td style={{ fontSize:10, color:'#9ca89c' }}>{b.direccion || '—'}</td>
                  {canEdit && (
                    <td style={{ whiteSpace:'nowrap' }}>
                      <button className="btn-edit" onClick={() => openModal(b)}><IconEdit /></button>
                      {' '}
                      <button className="btn-del" onClick={() => handleDelete(b)}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:420 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {form.id ? 'Editar Bodega' : 'Nueva Bodega'}
              </span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nombre *',   key:'nombre',    type:'text' },
                { label:'Regional',   key:'regional',  type:'text' },
                { label:'Ciudad',     key:'ciudad',    type:'text' },
                { label:'Dirección',  key:'direccion', type:'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="fl">{f.label}</label>
                  <input type={f.type} className="fc" value={form[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))} />
                </div>
              ))}
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
