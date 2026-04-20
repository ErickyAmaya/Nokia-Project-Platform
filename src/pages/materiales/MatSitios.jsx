import React, { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { useNavigate }  from 'react-router-dom'
import { useConfirm } from '../../components/ConfirmModal'
import { showToast } from '../../components/Toast'
import DespachoModal from '../../components/materiales/DespachoModal'

const REGIONALES = ['Sur-Occidente','Norte','Centro','Oriente','Antioquia','Caribe']

export default function MatSitios() {
  const sitios      = useMatStore(s => s.sitios)
  const movimientos = useMatStore(s => s.movimientos)
  const despachos   = useMatStore(s => s.despachos)
  const catalogo    = useMatStore(s => s.catalogo)
  const deleteSitio = useMatStore(s => s.deleteSitio)
  const user        = useAuthStore(s => s.user)
  const navigate    = useNavigate()
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,          setSearch]         = useState('')
  const [filReg,          setFilReg]         = useState('')
  const [expanded,        setExpanded]       = useState(null)
  const [despachoDestino, setDespachoDestino]= useState(null)

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  const sitioData = useMemo(() => {
    const data = {}
    for (const s of sitios) {
      const key = s.id ?? s.nombre
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
        const mk = m.catalogo_id
        if (!byMaterial[mk]) {
          const cat = catalogo.find(c => c.id === mk)
          byMaterial[mk] = {
            catalogo_id:    mk,
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
        byMaterial[mk].cantidad += m.cantidad
        byMaterial[mk].total    += m.cantidad * (byMaterial[mk].precioUnitario)
        const mf = m.created_at || m.fecha
        if (!byMaterial[mk].fechaUltimo || mf > byMaterial[mk].fechaUltimo) byMaterial[mk].fechaUltimo = mf
        if (!byMaterial[mk].fechaEnvio  || mf < byMaterial[mk].fechaEnvio)  byMaterial[mk].fechaEnvio  = mf
      }

      data[key] = {
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

  async function handleDelete(s) {
    const ok = await confirm('Eliminar Sitio', `¿Eliminar "${s.nombre}"?`)
    if (!ok) return
    try { await deleteSitio(s.id, s.nombre); showToast('Sitio eliminado') }
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
        <div className="card-h" style={{ background:'#0a0a0a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ color:'#1a9c1a', margin:0, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18, letterSpacing:1, textTransform:'uppercase' }}>
            Sitios de Instalación
          </h2>
        </div>

        <div className="card-b">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar sitio…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:180 }} />
            <select className="fc" value={filReg} onChange={e => setFilReg(e.target.value)} style={{ maxWidth:200 }}>
              <option value="">Todas las regionales</option>
              {REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="tbl" style={{ borderCollapse:'collapse', width:'100%' }}>
              <thead>
                <tr>
                  <th style={{ width:36 }}>#</th>
                  <th>SITIO</th>
                  <th>TIPO DE CIUDAD</th>
                  <th>REGIONAL</th>
                  <th style={{ textAlign:'right' }}>MOVIMIENTOS</th>
                  <th style={{ textAlign:'right' }}>IMPORTE</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>
                      Sin sitios registrados. Los sitios se crean automáticamente al realizar un despacho.
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => {
                  const rowKey = s.id ?? s.nombre ?? i
                  const sd     = sitioData[rowKey] || sitioData[s.nombre] || { movCount:0, despCount:0, valorTotal:0, materiales:[] }
                  const isOpen = expanded === rowKey
                  const hasMovs = sd.movCount > 0

                  return (
                    <React.Fragment key={rowKey}>
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
                              onClick={() => setExpanded(isOpen ? null : rowKey)}
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
                                onClick={() => handleDelete(s)}
                                style={{ padding:'3px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#922b21', color:'#fff', cursor:'pointer' }}>
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ padding:0, borderTop:'2px solid #1a9c1a' }}>
                            <div style={{ background:'#f8fdf8' }}>
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
                                      <tr style={{ background:'#144E4A' }}>
                                        {['Nombre','CÓDIGO','UM','CANTIDAD','PRECIO UNITARIO','TOTAL','FECHA ÚLTIMO MOV.','FECHA ENVÍO'].map(h => (
                                          <th key={h} style={{ padding:'6px 10px', color:'#CDFBF2', fontWeight:700, fontSize:10,
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
    </div>
  )
}
