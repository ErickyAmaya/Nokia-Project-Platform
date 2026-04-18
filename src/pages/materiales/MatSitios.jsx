import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { useNavigate }  from 'react-router-dom'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

const TIPOS = ['Principal','Macro','Micro','DAS','IBS','Rooftop','Torre','Canastilla','Monopole']
const REGIONALES = ['Sur-Occidente','Norte','Centro','Oriente','Antioquia','Caribe']

export default function MatSitios() {
  const sitios      = useMatStore(s => s.sitios)
  const movimientos = useMatStore(s => s.movimientos)
  const despachos   = useMatStore(s => s.despachos)
  const saveSitio   = useMatStore(s => s.saveSitio)
  const deleteSitio = useMatStore(s => s.deleteSitio)
  const user        = useAuthStore(s => s.user)
  const navigate    = useNavigate()
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modal,    setModal]    = useState(false)
  const [search,   setSearch]   = useState('')
  const [filReg,   setFilReg]   = useState('')
  const [form, setForm] = useState({ nombre:'', tipo_cw:'Principal', regional:'Sur-Occidente', comentarios:'', activo:true })

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  // Calcular movimientos y valor por sitio
  const sitioStats = useMemo(() => {
    const stats = {}
    for (const s of sitios) {
      // Contar movimientos donde destino=nombre o sitio_id=s.id
      const movs = movimientos.filter(m =>
        (m.destino && m.destino.toLowerCase() === s.nombre.toLowerCase()) ||
        m.sitio_id === s.id
      )
      const valor = movs.reduce((a, m) => a + (m.valor_total || 0), 0)
      stats[s.id] = { count: movs.length, valor }
    }
    return stats
  }, [sitios, movimientos])

  const filtered = useMemo(() => {
    return sitios.filter(s => {
      const q = search.toLowerCase()
      if (filReg && s.regional !== filReg) return false
      if (q && !`${s.nombre} ${s.regional}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [sitios, search, filReg])

  function openModal(s = null) {
    setForm(s ? { ...s } : { nombre:'', tipo_cw:'Principal', regional:'Sur-Occidente', comentarios:'', activo:true })
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
      <ConfirmModalUI />

      {/* Header */}
      <div style={{ background:'#0a0a0a', borderRadius:'8px 8px 0 0', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:0 }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18, color:'#fff', letterSpacing:1, textTransform:'uppercase' }}>
          Sitios de Instalación
        </span>
        {canEdit && (
          <button className="btn bp btn-sm" onClick={() => openModal()}>+ Nuevo Sitio</button>
        )}
      </div>

      <div className="card" style={{ borderRadius:'0 0 8px 8px' }}>
        <div className="card-b">
          {/* Filtros */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar sitio…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:180 }} />
            <select className="fc" value={filReg} onChange={e => setFilReg(e.target.value)} style={{ maxWidth:200 }}>
              <option value="">Todas las regionales</option>
              {REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead>
                <tr style={{ background:'#0a0a0a' }}>
                  <th style={{ color:'#fff', width:36 }}>#</th>
                  <th style={{ color:'#fff' }}>SITIO</th>
                  <th style={{ color:'#fff' }}>TIPO DE CIUDAD</th>
                  <th style={{ color:'#fff' }}>REGIONAL</th>
                  <th style={{ color:'#fff' }} className="num">MOVIMIENTOS</th>
                  <th style={{ color:'#fff' }} className="num">VALOR MATERIALES</th>
                  <th style={{ color:'#fff' }}>COMENTARIOS</th>
                  <th style={{ color:'#fff' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin sitios registrados</td></tr>
                )}
                {filtered.map((s, i) => {
                  const stats = sitioStats[s.id] || { count:0, valor:0 }
                  return (
                    <tr key={s.id}>
                      <td style={{ color:'#9ca89c', fontSize:11 }}>{i + 1}</td>
                      <td style={{ fontWeight:700 }}>{s.nombre}</td>
                      <td>
                        {s.tipo_cw ? (
                          <span className="badge" style={{ background:'#eff6ff', color:'#1e40af' }}>{s.tipo_cw}</span>
                        ) : '—'}
                      </td>
                      <td style={{ color:'#9ca89c', fontSize:11 }}>{s.regional}</td>
                      <td className="num" style={{ fontWeight:700 }}>{stats.count}</td>
                      <td className="num" style={{ fontWeight:700, color:'#144E4A' }}>{matCop(stats.valor)}</td>
                      <td style={{ fontSize:10, color:'#9ca89c', maxWidth:140 }}>{s.comentarios || '—'}</td>
                      <td style={{ whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          <button
                            onClick={() => navigate('/materiales/inventario')}
                            style={{ padding:'3px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>
                            Ver materiales
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => navigate('/materiales/despachos')}
                              style={{ padding:'3px 8px', fontSize:10, fontWeight:700, borderRadius:4, border:'none', background:'#1a9c1a', color:'#fff', cursor:'pointer' }}>
                              + Despacho
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => openModal(s)}
                              style={{ padding:'3px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#0a0a0a', color:'#fff', cursor:'pointer' }}>
                              Editar
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(s)}
                              style={{ padding:'3px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#c0392b', color:'#fff', cursor:'pointer' }}>
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
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
                <input type="text" className="fc" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))} />
              </div>
              <div>
                <label className="fl">Tipo de Ciudad</label>
                <select className="fc" value={form.tipo_cw || ''} onChange={e => setForm(p => ({ ...p, tipo_cw:e.target.value }))}>
                  <option value="">— Opcional —</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Regional</label>
                <select className="fc" value={form.regional} onChange={e => setForm(p => ({ ...p, regional:e.target.value }))}>
                  {REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Comentarios</label>
                <input type="text" className="fc" value={form.comentarios || ''}
                  onChange={e => setForm(p => ({ ...p, comentarios:e.target.value }))} />
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
