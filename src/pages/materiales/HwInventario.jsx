import { useState, useMemo, useEffect } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

const ESTADO_CFG = {
  en_bodega:       { label:'En Bodega',      bg:'#d4edda', color:'#1a6130' },
  en_sitio:        { label:'En Sitio',        bg:'#dbeafe', color:'#1e40af' },
  en_transito:     { label:'En Tránsito',     bg:'#fef3cd', color:'#856404' },
  retornado_nokia: { label:'Retornado Nokia', bg:'#f0f0f0', color:'#555f55' },
  retornado_ss:    { label:'Retornado SS',    bg:'#f5f0ff', color:'#6b21a8' },
}

const ESTADO_OPTS = [
  { value:'en_bodega',       label:'En Bodega' },
  { value:'en_sitio',        label:'En Sitio' },
  { value:'en_transito',     label:'En Tránsito' },
  { value:'retornado_nokia', label:'Retornado Nokia' },
  { value:'retornado_ss',    label:'Retornado SS' },
]

function statusInfo(stock) {
  if (stock === 0) return { label:'Agotado',  bg:'#fde8e7', color:'#c0392b' }
  return                  { label:'En Stock', bg:'#d4edda', color:'#1a6130' }
}

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

export default function HwInventario() {
  const hwEquipos      = useHwStore(s => s.hwEquipos)
  const hwCatalogo     = useHwStore(s => s.hwCatalogo)
  const hwMovimientos  = useHwStore(s => s.hwMovimientos)
  const hwTipoUnidades = useHwStore(s => s.hwTipoUnidades)
  const updateHwEquipo = useHwStore(s => s.updateHwEquipo)
  const deleteHwEquipo = useHwStore(s => s.deleteHwEquipo)
  const loadAll        = useHwStore(s => s.loadAll)
  const loading        = useHwStore(s => s.loading)
  const user           = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,    setSearch]    = useState('')
  const [filTipo,   setFilTipo]   = useState('')
  const [filStatus, setFilStatus] = useState('')
  const [expanded,  setExpanded]  = useState(null)   // catalogo_id expandido
  const [editModal, setEditModal] = useState(null)
  const [editForm,  setEditForm]  = useState({})
  const [editSaving,setEditSaving]= useState(false)

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  useEffect(() => { loadAll() }, [])

  // ── Agrupado por tipo de equipo (catalogo) ───────────────────────
  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return hwCatalogo
      .map(cat => {
        const equipos = hwEquipos.filter(e => e.catalogo_id === cat.id)

        // Movimientos sin serial para este tipo
        const movsSinSerial   = hwMovimientos.filter(m => m.catalogo_id === cat.id && !m.serial)
        const ssEntrada       = movsSinSerial.filter(m => m.tipo === 'ENTRADA').reduce((s, m) => s + (m.cantidad || 0), 0)
        const ssSalida        = movsSinSerial.filter(m => m.tipo === 'SALIDA').reduce((s, m) => s + (m.cantidad || 0), 0)
        const ssStock         = Math.max(0, ssEntrada - ssSalida)
        const ssEnSitio       = movsSinSerial
          .filter(m => m.tipo === 'SALIDA' && m.destino_tipo === 'sitio')
          .reduce((s, m) => s + (m.cantidad || 0), 0)

        if (equipos.length === 0 && movsSinSerial.length === 0) return null

        const enBodega = equipos.filter(e => e.estado === 'en_bodega')
        const enSitio  = equipos.filter(e => e.estado === 'en_sitio')
        const stock    = enBodega.length + ssStock
        const total    = equipos.length + ssEntrada
        const bodegas  = [...new Set(enBodega.map(e => e.ubicacion_actual).filter(Boolean))]
        const st       = statusInfo(stock)

        return { cat, equipos, stock, enSitio: enSitio.length + ssEnSitio, total, bodegas, st, movsSinSerial, ssStock, ssEnSitio, ssEntrada }
      })
      .filter(r => {
        if (!r) return false
        if (filTipo   && r.cat.tipo_material !== filTipo)   return false
        if (filStatus === 'agotado' && r.stock !== 0)       return false
        if (filStatus === 'stock'   && r.stock === 0)       return false
        if (q && !`${r.cat.descripcion} ${r.cat.cod_material || ''}`.toLowerCase().includes(q)) return false
        return true
      })
  }, [hwCatalogo, hwEquipos, hwMovimientos, search, filTipo, filStatus])

  // ── KPIs ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const ssStockTotal = rows.reduce((s, r) => s + (r.ssStock || 0), 0)
    const ssUdsTotal   = rows.reduce((s, r) => s + (r.movsSinSerial?.filter(m => m.tipo==='ENTRADA').reduce((a, m) => a + (m.cantidad||0), 0) || 0), 0)
    return {
      tipos:    rows.length,
      totalUds: hwEquipos.length + ssUdsTotal,
      enBodega: hwEquipos.filter(e => e.estado === 'en_bodega').length + ssStockTotal,
      enSitio:  hwEquipos.filter(e => e.estado === 'en_sitio').length,
      agotados: rows.filter(r => r.stock === 0).length,
    }
  }, [rows, hwEquipos])

  // ── Historial de un equipo ───────────────────────────────────────
  function historialDe(serial) {
    return hwMovimientos.filter(m => m.serial === serial)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }

  // ── Edición ─────────────────────────────────────────────────────
  function openEdit(e) {
    setEditForm({
      estado:              e.estado,
      ubicacion_actual:    e.ubicacion_actual || '',
      condicion:           e.condicion || 'nuevo',
      log_inv_tipo_unidad: e.log_inv_tipo_unidad || '',
      notas:               e.notas || '',
    })
    setEditModal(e)
  }

  async function handleEditSave() {
    setEditSaving(true)
    try {
      await updateHwEquipo(editModal.id, {
        estado:              editForm.estado,
        ubicacion_actual:    editForm.ubicacion_actual || null,
        condicion:           editForm.condicion,
        log_inv_tipo_unidad: editForm.log_inv_tipo_unidad || null,
        notas:               editForm.notas || null,
      })
      showToast('Equipo actualizado')
      setEditModal(null)
    } catch (err) { showToast('Error: ' + err.message, 'err') }
    finally { setEditSaving(false) }
  }

  async function handleDelete(e) {
    const ok = await confirm('Eliminar equipo', `¿Eliminar serial "${e.serial}"? Se eliminará todo su historial.`)
    if (!ok) return
    try { await deleteHwEquipo(e.id); showToast('Equipo eliminado') }
    catch (err) { showToast('Error: ' + err.message, 'err') }
  }

  return (
    <div>
      <ConfirmModalUI />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'Tipos de Equipo', value: kpis.tipos,    color:'#144E4A' },
          { label:'Total Unidades',  value: kpis.totalUds, color:'#144E4A' },
          { label:'En Bodega',       value: kpis.enBodega, color:'#1a6130' },
          { label:'En Sitio',        value: kpis.enSitio,  color:'#1e40af' },
          { label:'Tipos Agotados',  value: kpis.agotados, color:'#c0392b' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:8, borderLeft:`4px solid ${k.color}`, padding:'10px 14px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize:8, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#555f55', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:24, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Inventario HW Nokia ({rows.length} tipos)</h2>
          {loading && <span style={{ fontSize:10, color:'#9ca89c' }}>Cargando…</span>}
        </div>
        <div className="card-b">
          {/* Filtros */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar descripción o cód. equipo…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:200 }} />
            <select className="fc" value={filTipo} onChange={e => setFilTipo(e.target.value)} style={{ maxWidth:130 }}>
              <option value="">Todos los tipos</option>
              <option value="Partes">Partes</option>
              <option value="Grupos">Grupos</option>
              <option value="HWS">HWS</option>
            </select>
            <select className="fc" value={filStatus} onChange={e => setFilStatus(e.target.value)} style={{ maxWidth:130 }}>
              <option value="">Todos los status</option>
              <option value="stock">En Stock</option>
              <option value="agotado">Agotado</option>
            </select>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="tbl" style={{ borderCollapse:'collapse', width:'100%' }}>
              <thead>
                <tr>
                  <th style={{ width:32 }}></th>
                  <th>CÓD. EQUIPO</th>
                  <th>DESCRIPCIÓN</th>
                  <th>TIPO</th>
                  <th>BODEGA</th>
                  <th style={{ textAlign:'center' }}>STOCK</th>
                  <th style={{ textAlign:'center' }}>EN SITIO</th>
                  <th style={{ textAlign:'center' }}>TOTAL</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>
                    {hwEquipos.length === 0 && hwMovimientos.filter(m => !m.serial).length === 0 ? 'Sin equipos registrados. Registra movimientos para poblar el inventario.' : 'Sin resultados'}
                  </td></tr>
                )}
                {rows.map(({ cat, equipos, stock, enSitio, total, bodegas, st, movsSinSerial, ssStock, ssEnSitio, ssEntrada }) => {
                  const isOpen = expanded === cat.id
                  const tipoBg = cat.tipo_material==='Grupos'?'#eff6ff': cat.tipo_material==='HWS'?'#fef3cd':'#f0fdf4'
                  const tipoCl = cat.tipo_material==='Grupos'?'#1e40af': cat.tipo_material==='HWS'?'#92400e':'#166534'

                  return [
                    // ── Fila principal ──
                    <tr key={cat.id}
                      style={{ background: isOpen ? '#f0fdf4' : undefined, cursor:'pointer', borderBottom: isOpen ? 'none' : undefined }}
                      onClick={() => setExpanded(isOpen ? null : cat.id)}>
                      <td style={{ textAlign:'center', fontSize:13, color:'#9ca89c' }}>{isOpen ? '▲' : '▼'}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12, color:'#144E4A' }}>
                        {cat.cod_material || '—'}
                      </td>
                      <td style={{ fontWeight:600, fontSize:12 }}>{cat.descripcion}</td>
                      <td>
                        <span className="badge" style={{ background:tipoBg, color:tipoCl, fontSize:9 }}>{cat.tipo_material}</span>
                      </td>
                      <td style={{ fontSize:11, color:'#555f55' }}>
                        {bodegas.length === 0 ? <span style={{ color:'#9ca89c' }}>—</span> : bodegas.join(', ')}
                      </td>
                      <td style={{ textAlign:'center', fontWeight:800, fontSize:14, color: stock === 0 ? '#c0392b' : '#1a6130' }}>
                        {stock}
                      </td>
                      <td style={{ textAlign:'center', fontWeight:700, fontSize:12, color:'#1e40af' }}>{enSitio}</td>
                      <td style={{ textAlign:'center', fontWeight:700, fontSize:12, color:'#555f55' }}>{total}</td>
                      <td>
                        <span className="badge" style={{ background:st.bg, color:st.color, fontSize:9 }}>{st.label}</span>
                      </td>
                    </tr>,

                    // ── Fila expandida: seriales + sin-serial ──
                    isOpen && (
                      <tr key={`${cat.id}-exp`}>
                        <td colSpan={9} style={{ padding:0, borderTop:`2px solid #1a9c1a` }}>
                          <div style={{ background:'#f8fdf8' }}>

                            {/* ── Seriales ── */}
                            {equipos.length > 0 && (<>
                              <div style={{ background:'#0a0a0a', padding:'6px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:12, color:'#1a9c1a', letterSpacing:1, textTransform:'uppercase' }}>
                                  {cat.descripcion}
                                </span>
                                <span style={{ fontSize:10, color:'#9ca89c' }}>{equipos.length} unidad(es)</span>
                              </div>
                              <div style={{ overflowX:'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                  <thead>
                                    <tr style={{ background:'#f0f7f0' }}>
                                      {['CANT.','SERIAL','ESTADO','UBICACIÓN ACTUAL','CONDICIÓN','TIPO UNIDAD',canEdit && 'ACCIONES'].filter(Boolean).map(h => (
                                        <th key={h} style={{ padding:'5px 10px', color:'#144E4A', fontWeight:700, fontSize:10, textAlign:'left', borderBottom:'2px solid #c8e6c8', whiteSpace:'nowrap' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {equipos.map((e, idx) => {
                                      const est = ESTADO_CFG[e.estado] || ESTADO_CFG.en_bodega
                                      return (
                                        <tr key={e.id} style={{ background: idx%2===0?'#fff':'#f0fdf4', borderBottom:'1px solid #e8f5e8' }}>
                                          <td style={{ padding:'6px 10px', fontWeight:700, textAlign:'center', color:'#555f55' }}>1</td>
                                          <td style={{ padding:'6px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:'#144E4A' }}>{e.serial}</td>
                                          <td style={{ padding:'6px 10px' }}>
                                            <span className="badge" style={{ background:est.bg, color:est.color, fontSize:9 }}>{est.label}</span>
                                          </td>
                                          <td style={{ padding:'6px 10px', color:'#555f55' }}>{e.ubicacion_actual || '—'}</td>
                                          <td style={{ padding:'6px 10px', color:'#9ca89c', textTransform:'capitalize' }}>{e.condicion}</td>
                                          <td style={{ padding:'6px 10px', color:'#9ca89c', fontSize:10 }}>{e.log_inv_tipo_unidad || '—'}</td>
                                          {canEdit && (
                                            <td style={{ padding:'6px 10px', whiteSpace:'nowrap' }}
                                              onClick={ev => ev.stopPropagation()}>
                                              <button className="btn-edit" onClick={() => openEdit(e)}
                                                style={{ marginRight:4 }}><IconEdit /></button>
                                              <button className="btn-del" onClick={() => handleDelete(e)}>✕</button>
                                            </td>
                                          )}
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </>)}

                            {/* ── Sin serial: columnas igual a la tabla principal ── */}
                            {movsSinSerial.length > 0 && (() => {
                              if (ssStock === 0 && ssEnSitio === 0) return null
                              const tipoBg = cat.tipo_material==='Grupos'?'#eff6ff': cat.tipo_material==='HWS'?'#fef3cd':'#f0fdf4'
                              const tipoCl = cat.tipo_material==='Grupos'?'#1e40af': cat.tipo_material==='HWS'?'#92400e':'#166534'
                              const st     = statusInfo(ssStock)
                              return (
                                <div style={{ borderTop: equipos.length > 0 ? '1px solid #d4edda' : 'none', overflowX:'auto' }}>
                                  <div style={{ background:'#0a0a0a', padding:'6px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:12, color:'#1a9c1a', letterSpacing:1, textTransform:'uppercase' }}>
                                      {cat.descripcion}
                                    </span>
                                    <span style={{ fontSize:10, color:'#9ca89c' }}>{ssEntrada} unidad(es)</span>
                                  </div>
                                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                    <thead>
                                      <tr style={{ background:'#f0f7f0' }}>
                                        {['CÓD. EQUIPO','DESCRIPCIÓN','TIPO','BODEGA','STOCK','EN SITIO','TOTAL','STATUS'].map(h => (
                                          <th key={h} style={{ padding:'5px 10px', color:'#144E4A', fontWeight:700, fontSize:10, textAlign: ['STOCK','EN SITIO','TOTAL'].includes(h) ? 'center' : 'left', borderBottom:'2px solid #c8e6c8', whiteSpace:'nowrap' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr style={{ background:'#fff', borderBottom:'1px solid #e8f5e8' }}>
                                        <td style={{ padding:'6px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12, color:'#144E4A' }}>{cat.cod_material || '—'}</td>
                                        <td style={{ padding:'6px 10px', fontWeight:600, fontSize:12 }}>{cat.descripcion}</td>
                                        <td style={{ padding:'6px 10px' }}>
                                          <span className="badge" style={{ background:tipoBg, color:tipoCl, fontSize:9 }}>{cat.tipo_material}</span>
                                        </td>
                                        <td style={{ padding:'6px 10px', fontSize:11, color:'#555f55' }}>{bodegas.length ? bodegas.join(', ') : '—'}</td>
                                        <td style={{ padding:'6px 10px', fontWeight:800, fontSize:14, color: ssStock===0?'#c0392b':'#1a6130', textAlign:'center' }}>{ssStock}</td>
                                        <td style={{ padding:'6px 10px', fontWeight:700, fontSize:12, color:'#1e40af', textAlign:'center' }}>{ssEnSitio}</td>
                                        <td style={{ padding:'6px 10px', fontWeight:700, fontSize:12, color:'#555f55', textAlign:'center' }}>{ssEntrada}</td>
                                        <td style={{ padding:'6px 10px' }}>
                                          <span className="badge" style={{ background:st.bg, color:st.color, fontSize:9 }}>{st.label}</span>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              )
                            })()}

                          </div>
                        </td>
                      </tr>
                    )
                  ]
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Editar Equipo */}
      {editModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:420 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1d4ed8', borderRadius:'12px 12px 0 0' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Editar Serial: {editModal.serial}
              </span>
              <button onClick={() => setEditModal(null)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label className="fl">Estado</label>
                <select className="fc" value={editForm.estado} onChange={e => setEditForm(p => ({ ...p, estado: e.target.value }))}>
                  {ESTADO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Ubicación Actual</label>
                <input className="fc" value={editForm.ubicacion_actual}
                  onChange={e => setEditForm(p => ({ ...p, ubicacion_actual: e.target.value }))} />
              </div>
              <div>
                <label className="fl">Condición</label>
                <select className="fc" value={editForm.condicion} onChange={e => setEditForm(p => ({ ...p, condicion: e.target.value }))}>
                  <option value="nuevo">Nuevo</option>
                  <option value="usado">Usado</option>
                  <option value="dañado">Dañado</option>
                </select>
              </div>
              <div>
                <label className="fl">Tipo Unidad (LOG_INV)</label>
                <select className="fc" value={editForm.log_inv_tipo_unidad}
                  onChange={e => setEditForm(p => ({ ...p, log_inv_tipo_unidad: e.target.value }))}>
                  <option value="">— Ninguno —</option>
                  {hwTipoUnidades.filter(t => t.activo !== false).map(t => (
                    <option key={t.id} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fl">Notas</label>
                <textarea className="fc" rows={2} value={editForm.notas}
                  onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))}
                  style={{ resize:'vertical', fontSize:12 }} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setEditModal(null)}>Cancelar</button>
                <button className="btn bp" onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
