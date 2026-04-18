import React, { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { useNavigate }  from 'react-router-dom'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'
import DespachoModal from '../../components/materiales/DespachoModal'

const TIPOS = ['Principal','Macro','Micro','DAS','IBS','Rooftop','Torre','Canastilla','Monopole']
const REGIONALES = ['Sur-Occidente','Norte','Centro','Oriente','Antioquia','Caribe']

export default function MatSitios() {
  const sitios      = useMatStore(s => s.sitios)
  const sitiosError = useMatStore(s => s.sitiosError)
  const movimientos = useMatStore(s => s.movimientos)
  const despachos   = useMatStore(s => s.despachos)
  const catalogo    = useMatStore(s => s.catalogo)
  const saveSitio   = useMatStore(s => s.saveSitio)
  const deleteSitio = useMatStore(s => s.deleteSitio)
  const user        = useAuthStore(s => s.user)
  const navigate    = useNavigate()
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modal,           setModal]          = useState(false)
  const [search,          setSearch]         = useState('')
  const [filReg,          setFilReg]         = useState('')
  const [expanded,        setExpanded]       = useState(null)
  const [despachoDestino, setDespachoDestino]= useState(null)
  const [form, setForm] = useState({ nombre:'', tipo_cw:'Principal', regional:'Sur-Occidente', comentarios:'', activo:true })

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  const sitioData = useMemo(() => {
    const data = {}
    for (const s of sitios) {
      const salidas = movimientos.filter(m =>
        m.tipo === 'Salida' && (
          (m.destino && m.destino.toLowerCase() === s.nombre.toLowerCase()) ||
          m.sitio_id === s.id
        )
      )
      const todasMovs = movimientos.filter(m =>
        (m.destino && m.destino.toLowerCase() === s.nombre.toLowerCase()) ||
        m.sitio_id === s.id
      )
      const despCount = despachos.filter(d =>
        d.destino && d.destino.toLowerCase() === s.nombre.toLowerCase()
      ).length
      const valorTotal = salidas.reduce((a, m) =>
        a + (m.valor_total || m.cantidad * (m.valor_unitario || 0) || 0), 0)

      const byMaterial = {}
      for (const m of salidas) {
        const key = m.catalogo_id
        if (!byMaterial[key]) {
          const cat = catalogo.find(c => c.id === key)
          byMaterial[key] = {
            catalogo_id:    key,
            nombre:         cat?.nombre   || '—',
            codigo:         cat?.codigo   || '—',
            unidad:         cat?.unidad   || '—',
            precioUnitario: cat?.costo_unitario || m.valor_unitario || 0,
            cantidad:       0,
            total:          0,
            fechaUltimo:    null,
            fechaEnvio:     m.fecha || m.created_at,
          }
        }
        byMaterial[key].cantidad += m.cantidad
        byMaterial[key].total    += m.cantidad * (byMaterial[key].precioUnitario)
        const mf = m.created_at || m.fecha
        if (!byMaterial[key].fechaUltimo || mf > byMaterial[key].fechaUltimo) byMaterial[key].fechaUltimo = mf
        if (!byMaterial[key].fechaEnvio  || mf < byMaterial[key].fechaEnvio)  byMaterial[key].fechaEnvio  = mf
      }

      data[s.id] = {
        movCount:   todasMovs.length,
        despCount,
        valorTotal,
        materiales: Object.values(byMaterial).sort((a, b) => b.total - a.total),
      }
    }
    return data
  }, [sitios, movimientos, despachos, catalogo])

  const filtered = useMemo(() => sitios.filter(s => {
    const q = search.toLowerCase()
    if (filReg && s.regional !== filReg) return false
    if (q && !`${s.nombre} ${s.regional}`.toLowerCase().includes(q)) return false
    return true
  }), [sitios, search, filReg])

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

  function fmtFecha(f) {
    if (!f) return '—'
    return new Date(f).toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
  }

  return (
    <div>
      <ConfirmModalUI />

      {despachoDestino !== null && (
        <DespachoModal defaultDestino={despachoDestino} onClose={() => setDespachoDestino(null)} />
      )}

      <div className="card">
        {/* Header */}
        <div className="card-h" style={{ background:'#0a0a0a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ color:'#1a9c1a', margin:0, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18, letterSpacing:1, textTransform:'uppercase' }}>
            Sitios de Instalación
          </h2>
          {canEdit && (
            <button className="btn bp btn-sm" onClick={() => openModal()}>+ Nuevo Sitio</button>
          )}
        </div>

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

          {sitiosError && (
            <div style={{ background:'#fde8e7', border:'1px solid #f5c6cb', borderRadius:6, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#c0392b' }}>
              <strong>Error al cargar sitios:</strong> {sitiosError}
              <br /><span style={{ fontSize:10, color:'#555f55' }}>Revisa las políticas RLS en Supabase → tabla <code>mat_sitios</code></span>
            </div>
          )}

          <div style={{ overflowX:'auto' }}>
            <table className="tbl" style={{ borderCollapse:'collapse', width:'100%' }}>
              <thead>
                <tr style={{ background:'#0a0a0a' }}>
                  <th style={{ color:'#fff', width:36 }}>#</th>
                  <th style={{ color:'#fff' }}>SITIO</th>
                  <th style={{ color:'#fff' }}>TIPO DE CIUDAD</th>
                  <th style={{ color:'#fff' }}>REGIONAL</th>
                  <th style={{ color:'#fff', textAlign:'right' }}>MOVIMIENTOS</th>
                  <th style={{ color:'#fff', textAlign:'right' }}>IMPORTE</th>
                  <th style={{ color:'#fff' }}>STATUS</th>
                  <th style={{ color:'#fff' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>
                      Sin sitios registrados
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => {
                  const sd     = sitioData[s.id] || { movCount:0, despCount:0, valorTotal:0, materiales:[] }
                  const isOpen = expanded === s.id
                  const hasMovs = sd.movCount > 0

                  return (
                    <React.Fragment key={s.id}>
                      {/* ── Fila del sitio ── */}
                      <tr style={{ background: isOpen ? '#f0fdf4' : undefined, borderBottom: isOpen ? 'none' : undefined }}>
                        <td style={{ color:'#9ca89c', fontSize:11 }}>{i + 1}</td>
                        <td style={{ fontWeight:700 }}>{s.nombre}</td>
                        <td>
                          {s.tipo_cw
                            ? <span className="badge" style={{ background:'#eff6ff', color:'#1e40af' }}>{s.tipo_cw}</span>
                            : '—'}
                        </td>
                        <td style={{ color:'#9ca89c', fontSize:11 }}>{s.regional}</td>
                        <td style={{ textAlign:'right', fontWeight:700 }}>{sd.movCount}</td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'#144E4A' }}>{matCop(sd.valorTotal)}</td>
                        <td>
                          {hasMovs
                            ? <span className="badge" style={{ background:'#d4edda', color:'#1a6130' }}>Activo</span>
                            : <span className="badge" style={{ background:'#fde8e7', color:'#c0392b' }}>Sin movimientos</span>
                          }
                        </td>
                        <td style={{ whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', gap:4 }}>
                            <button
                              onClick={() => setExpanded(isOpen ? null : s.id)}
                              style={{ padding:'3px 9px', fontSize:10, fontWeight:700, borderRadius:4, border:'none',
                                background: isOpen ? '#144E4A' : '#1a9c1a', color:'#fff', cursor:'pointer' }}>
                              {isOpen ? '▲ Cerrar' : 'Ver Materiales'}
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => setDespachoDestino(s.nombre)}
                                style={{ padding:'3px 8px', fontSize:10, fontWeight:700, borderRadius:4, border:'none', background:'#c0392b', color:'#fff', cursor:'pointer' }}>
                                + Despacho
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => openModal(s)}
                                style={{ padding:'3px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#555f55', color:'#fff', cursor:'pointer' }}>
                                Editar
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDelete(s)}
                                style={{ padding:'3px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#922b21', color:'#fff', cursor:'pointer' }}>
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Fila expandida: materiales ── */}
                      {isOpen && (
                        <tr key={`exp-${s.id}`}>
                          <td colSpan={8} style={{ padding:0, borderTop:'2px solid #1a9c1a' }}>
                            <div style={{ background:'#f8fdf8' }}>
                              {/* Sub-header */}
                              <div style={{ background:'#0a0a0a', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:'#1a9c1a', letterSpacing:1, textTransform:'uppercase' }}>
                                  Materiales: {s.nombre}
                                </span>
                                <span style={{ fontSize:10, color:'#9ca89c' }}>
                                  Materiales enviados a este sitio según historial de salidas
                                </span>
                              </div>

                              {sd.materiales.length === 0 ? (
                                <div style={{ textAlign:'center', padding:'20px 16px', color:'#9ca89c', fontSize:12 }}>
                                  No hay salidas registradas hacia este sitio
                                </div>
                              ) : (
                                <div style={{ overflowX:'auto' }}>
                                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                    <thead>
                                      <tr style={{ background:'#1a9c1a' }}>
                                        {['Nombre','CÓDIGO','UM','CANTIDAD','PRECIO UNITARIO','TOTAL','FECHA ÚLTIMO MOV.','FECHA ENVÍO'].map(h => (
                                          <th key={h} style={{ padding:'6px 10px', color:'#fff', fontWeight:700, fontSize:10,
                                            textAlign: ['CANTIDAD','PRECIO UNITARIO','TOTAL'].includes(h) ? 'right' : 'left', whiteSpace:'nowrap' }}>
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sd.materiales.map((m, mi) => (
                                        <tr key={m.catalogo_id} style={{ background: mi % 2 === 0 ? '#fff' : '#f0fdf4', borderBottom:'1px solid #e8f5e8' }}>
                                          <td style={{ padding:'6px 10px', fontWeight:600 }}>{m.nombre}</td>
                                          <td style={{ padding:'6px 10px', color:'#9ca89c', fontFamily:"'Barlow Condensed',sans-serif" }}>{m.codigo}</td>
                                          <td style={{ padding:'6px 10px', color:'#9ca89c' }}>{m.unidad}</td>
                                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700 }}>{m.cantidad}</td>
                                          <td style={{ padding:'6px 10px', textAlign:'right', color:'#555f55' }}>{matCop(m.precioUnitario)}</td>
                                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#144E4A' }}>{matCop(m.total)}</td>
                                          <td style={{ padding:'6px 10px', color:'#9ca89c', whiteSpace:'nowrap' }}>{fmtFecha(m.fechaUltimo)}</td>
                                          <td style={{ padding:'6px 10px', color:'#9ca89c', whiteSpace:'nowrap' }}>{fmtFecha(m.fechaEnvio)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Footer */}
                              <div style={{ padding:'8px 16px', background:'#e8f5e8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div style={{ fontSize:10, color:'#144E4A', fontWeight:700 }}>
                                  DESPACHOS RECIBIDOS: {sd.despCount}
                                  <span style={{ marginLeft:16 }}>
                                    TOTAL UNIDADES: {sd.materiales.reduce((a, m) => a + m.cantidad, 0)}
                                  </span>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:'#144E4A' }}>
                                    Total: {matCop(sd.materiales.reduce((a, m) => a + m.total, 0))}
                                  </span>
                                  <button
                                    onClick={() => navigate('/materiales/inventario')}
                                    style={{ padding:'4px 12px', fontSize:10, fontWeight:700, borderRadius:4, border:'1.5px solid #1a9c1a', background:'#fff', color:'#1a9c1a', cursor:'pointer' }}>
                                    Ir a Inventario
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nuevo/Editar Sitio */}
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
