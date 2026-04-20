import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'
import DespachoModal from '../../components/materiales/DespachoModal'

export default function MatMovimientos() {
  const catalogo         = useMatStore(s => s.catalogo)
  const bodegas          = useMatStore(s => s.bodegas)
  const movimientos      = useMatStore(s => s.movimientos)
  const despachos        = useMatStore(s => s.despachos)
  const deleteMovimiento = useMatStore(s => s.deleteMovimiento)
  const saveDespacho     = useMatStore(s => s.saveDespacho)
  const user             = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [despachoOpen, setDespachoOpen]   = useState(false)
  const [filTipo,      setFilTipo]        = useState('')
  const [filBod,       setFilBod]         = useState('')
  const [search,       setSearch]         = useState('')
  const [filDate,      setFilDate]        = useState('')

  // ── Edit despacho ──
  const [editDesp,     setEditDesp]       = useState(null)
  const [editDespForm, setEditDespForm]   = useState({})
  const [savingDesp,   setSavingDesp]     = useState(false)

  const canEdit   = ['admin','coordinador','logistica'].includes(user?.role)
  const canAdmin  = ['admin','coordinador'].includes(user?.role)
  const canDelete = ['admin','coordinador'].includes(user?.role)

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return movimientos.filter(m => {
      if (filTipo && m.tipo !== filTipo) return false
      if (filBod  && m.bodega_id !== Number(filBod)) return false
      if (filDate && !m.fecha?.startsWith(filDate)) return false
      if (q) {
        const cat = catalogo.find(c => c.id === m.catalogo_id)
        if (!`${m.numero_doc} ${cat?.nombre || ''} ${cat?.codigo || ''}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [movimientos, filTipo, filBod, search, filDate, catalogo])

  const totalEntradas = movimientos.filter(m => m.tipo === 'Entrada').reduce((a, m) => a + (m.valor_total || 0), 0)
  const totalSalidas  = movimientos.filter(m => m.tipo === 'Salida').reduce((a, m) => a + (m.valor_total || 0), 0)

  async function handleDelete(m) {
    const cat = catalogo.find(c => c.id === m.catalogo_id)
    const ok = await confirm('Eliminar Movimiento', `¿Eliminar ${m.tipo} "${cat?.nombre}" (${m.numero_doc})?`)
    if (!ok) return
    try { await deleteMovimiento(m.id); showToast('Movimiento eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  function openEditDesp(d) {
    setEditDesp(d)
    setEditDespForm({ fecha: d.fecha || '', destino: d.destino || '', comentarios: d.comentarios || '', status: d.status || 'borrador' })
  }

  async function handleSaveDesp() {
    setSavingDesp(true)
    try {
      await saveDespacho({ ...editDesp, ...editDespForm })
      showToast('Despacho actualizado')
      setEditDesp(null)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSavingDesp(false) }
  }

  return (
    <div>
      <ConfirmModalUI />
      {despachoOpen && <DespachoModal onClose={() => setDespachoOpen(false)} />}

      {/* ── DESPACHOS ── */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Despachos</h2>
          {canEdit && (
            <button className="btn bd btn-sm" onClick={() => setDespachoOpen(true)}>
              + Nuevo Despacho
            </button>
          )}
        </div>
        <div className="card-b" style={{ padding:'8px 0' }}>
          {despachos.length === 0 ? (
            <div style={{ textAlign:'center', padding:24, color:'#9ca89c', fontSize:12 }}>Sin despachos</div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>DOC</th><th>SITIO</th><th>BODEGA</th><th>FECHA</th>
                <th className="num">ÍTEMS</th><th className="num">TOTAL</th>
                <th>ESTADO</th>{canAdmin && <th></th>}
              </tr></thead>
              <tbody>
                {despachos.slice(0, 15).map(d => {
                  const movs  = movimientos.filter(m => m.numero_doc === d.numero_doc)
                  const total = movs.reduce((a, m) => a + (m.valor_total || m.cantidad * (m.valor_unitario || 0) || 0), 0)
                  const bod   = bodegas.find(b => b.id === d.bodega_id)
                  return (
                    <tr key={d.id}>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11 }}>{d.numero_doc}</td>
                      <td style={{ fontSize:11 }}>{d.destino || '—'}</td>
                      <td style={{ fontSize:10, color:'#9ca89c' }}>{bod?.nombre || '—'}</td>
                      <td style={{ fontSize:10, color:'#9ca89c' }}>{d.fecha}</td>
                      <td className="num" style={{ fontSize:11 }}>{movs.length}</td>
                      <td className="num" style={{ fontWeight:700, fontSize:11 }}>{matCop(total)}</td>
                      <td>
                        <span className="badge" style={{
                          background: d.status==='finalizado' ? '#d4edda' : '#fef3cd',
                          color:      d.status==='finalizado' ? '#1a6130' : '#856404', fontSize:9 }}>
                          {d.status==='finalizado' ? 'Finalizado' : 'Borrador'}
                        </span>
                      </td>
                      {canAdmin && (
                        <td>
                          <button
                            title="Editar despacho"
                            onClick={() => openEditDesp(d)}
                            style={{ background:'none', border:'1.5px solid #e0e4e0', borderRadius:20, padding:'2px 8px', fontSize:12, cursor:'pointer', color:'#555f55' }}>
                            ✏
                          </button>
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

      {/* ── HISTORIAL DE MOVIMIENTOS ── */}
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Historial de Movimientos ({rows.length})</h2>
          <div style={{ display:'flex', gap:8, fontSize:11 }}>
            <span style={{ color:'#1a7a1a', fontWeight:700 }}>Entradas: {matCop(totalEntradas)}</span>
            <span style={{ color:'#c0392b', fontWeight:700 }}>Salidas: {matCop(totalSalidas)}</span>
          </div>
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar doc, material…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:140 }} />
            <input type="date" className="fc" value={filDate}
              onChange={e => setFilDate(e.target.value)} style={{ maxWidth:150 }} />
            <select className="fc" value={filTipo} onChange={e => setFilTipo(e.target.value)} style={{ maxWidth:120 }}>
              <option value="">Todos</option>
              <option value="Entrada">Entradas</option>
              <option value="Salida">Salidas</option>
            </select>
            <select className="fc" value={filBod} onChange={e => setFilBod(e.target.value)} style={{ maxWidth:150 }}>
              <option value="">Todas las bodegas</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th>Fecha</th><th>Doc</th><th>Material</th><th>Tipo</th>
                <th className="num">Cant.</th><th className="num">Valor</th>
                <th>Origen / Destino</th>{canDelete && <th></th>}
              </tr></thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'#9ca89c' }}>Sin movimientos</td></tr>
                )}
                {rows.map(m => {
                  const cat   = catalogo.find(c => c.id === m.catalogo_id)
                  const bod   = bodegas.find(b => b.id === m.bodega_id)
                  const orDest = [m.origen, m.destino].filter(Boolean).join(' → ')
                  return (
                    <tr key={m.id}>
                      <td style={{ color:'#9ca89c', whiteSpace:'nowrap', fontSize:11 }}>{m.fecha}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11 }}>{m.numero_doc}</td>
                      <td style={{ fontWeight:600, fontSize:11 }}>{cat?.nombre || '—'}</td>
                      <td>
                        <span style={{ color: m.tipo==='Entrada'?'#1a7a1a':'#c0392b', fontWeight:700, fontSize:10 }}>{m.tipo}</span>
                      </td>
                      <td className="num" style={{ fontWeight:700 }}>{m.cantidad}</td>
                      <td className="num" style={{ color:'#144E4A', fontWeight:700, fontSize:11 }}>{matCop(m.valor_total)}</td>
                      <td style={{ fontSize:10, color:'#9ca89c' }}>{orDest || (bod?.nombre || '—')}</td>
                      {canDelete && (
                        <td>
                          <button className="btn-del" onClick={() => handleDelete(m)}>✕</button>
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

      {/* ── Modal: Editar Despacho ── */}
      {editDesp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:420 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #c0392b', borderRadius:'16px 16px 0 0' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Editar Despacho · {editDesp.numero_doc}
              </span>
              <button onClick={() => setEditDesp(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>

              <div style={{ background:'#f5f5f5', borderRadius:6, padding:'7px 10px', fontSize:11, color:'#555f55' }}>
                Bodega: <strong>{bodegas.find(b => b.id === editDesp.bodega_id)?.nombre || '—'}</strong>
                <span style={{ marginLeft:12 }}>Doc: <strong>{editDesp.numero_doc}</strong></span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={editDespForm.fecha}
                    onChange={e => setEditDespForm(p => ({ ...p, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Estado</label>
                  <select className="fc" value={editDespForm.status}
                    onChange={e => setEditDespForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="borrador">Borrador</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="fl">Sitio Destino</label>
                <input type="text" className="fc" value={editDespForm.destino}
                  onChange={e => setEditDespForm(p => ({ ...p, destino: e.target.value }))} />
              </div>

              <div>
                <label className="fl">Comentarios</label>
                <input type="text" className="fc" value={editDespForm.comentarios} placeholder="Opcional"
                  onChange={e => setEditDespForm(p => ({ ...p, comentarios: e.target.value }))} />
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setEditDesp(null)}>Cancelar</button>
                <button className="btn bp" onClick={handleSaveDesp} disabled={savingDesp}>
                  {savingDesp ? 'Guardando…' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
