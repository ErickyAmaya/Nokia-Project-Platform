import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useHwStore } from '../../store/useHwStore'
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

const VERSION = '2.0.0'

export default function MatConfig() {
  const bodegas            = useMatStore(s => s.bodegas)
  const catalogo           = useMatStore(s => s.catalogo)
  const movimientos        = useMatStore(s => s.movimientos)
  const despachos          = useMatStore(s => s.despachos)
  const sitios             = useMatStore(s => s.sitios)
  const saveBodega         = useMatStore(s => s.saveBodega)
  const deleteBodega       = useMatStore(s => s.deleteBodega)
  const hwBodegasNokia     = useHwStore(s => s.hwBodegasNokia)
  const hwServiceSuppliers = useHwStore(s => s.hwServiceSuppliers)
  const hwTipoUnidades     = useHwStore(s => s.hwTipoUnidades)
  const saveHwBodegaNokia  = useHwStore(s => s.saveHwBodegaNokia)
  const deleteHwBodegaNokia= useHwStore(s => s.deleteHwBodegaNokia)
  const saveHwSS           = useHwStore(s => s.saveHwSS)
  const deleteHwSS         = useHwStore(s => s.deleteHwSS)
  const saveHwTipoUnidad   = useHwStore(s => s.saveHwTipoUnidad)
  const deleteHwTipoUnidad = useHwStore(s => s.deleteHwTipoUnidad)
  const loadAll            = useHwStore(s => s.loadAll)
  const user               = useAuthStore(s => s.user)
  const navigate           = useNavigate()
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState({ nombre:'', regional:'Sur-Occidente', ciudad:'', direccion:'' })
  const [nokModal, setNokModal] = useState(false)
  const [nokForm,  setNokForm]  = useState({ nombre:'', ciudad:'', notas:'' })
  const [ssModal,  setSsModal]  = useState(false)
  const [ssForm,   setSsForm]   = useState({ nombre:'', ciudad:'', notas:'' })
  const [tuModal,  setTuModal]  = useState(false)
  const [tuForm,   setTuForm]   = useState({ nombre:'' })
  const [syncTime]             = useState(new Date().toLocaleString('es-CO'))

  // Cargar datos HW al montar
  useState(() => { loadAll() })

  const canEdit = ['admin','logistica'].includes(user?.role)

  // Historial derivado de movimientos + despachos
  const historial = useMemo(() => {
    const movEntries = movimientos.slice(0, 30).map(m => ({
      fecha:   m.created_at || m.fecha,
      usuario: m.created_by || '—',
      accion:  m.tipo === 'Entrada' ? 'Nueva Entrada' : 'Nueva Salida',
      ref:     m.numero_doc,
      detalle: `${catalogo.find(c => c.id === m.catalogo_id)?.nombre || '—'} · ${m.cantidad} und`,
    }))
    const despEntries = despachos.slice(0, 20).map(d => ({
      fecha:   d.created_at || d.fecha,
      usuario: d.created_by || '—',
      accion:  d.status === 'finalizado' ? 'Finalizar Despacho' : 'Nuevo Despacho',
      ref:     d.numero_doc,
      detalle: `${d.destino || '—'} · ${d.status}`,
    }))
    return [...movEntries, ...despEntries]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 25)
  }, [movimientos, despachos, catalogo])

  const ACCION_COLORS = {
    'Nueva Entrada':    { bg:'#f0fdf4', color:'#166534' },
    'Nueva Salida':     { bg:'#fde8e7', color:'#c0392b' },
    'Nuevo Despacho':   { bg:'#fff7ed', color:'#9a3412' },
    'Finalizar Despacho': { bg:'#eff6ff', color:'#1e40af' },
  }

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

  async function handleSaveNok() {
    if (!nokForm.nombre.trim()) { showToast('El nombre es requerido', 'err'); return }
    try { await saveHwBodegaNokia(nokForm); showToast(nokForm.id ? 'Actualizada' : 'Bodega Nokia creada'); setNokModal(false) }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDeleteNok(b) {
    const ok = await confirm('Eliminar Bodega Nokia', `¿Eliminar "${b.nombre}"?`)
    if (!ok) return
    try { await deleteHwBodegaNokia(b.id); showToast('Eliminada') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleSaveSS() {
    if (!ssForm.nombre.trim()) { showToast('El nombre es requerido', 'err'); return }
    try { await saveHwSS(ssForm); showToast(ssForm.id ? 'Actualizado' : 'Service Supplier creado'); setSsModal(false) }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDeleteSS(s) {
    const ok = await confirm('Eliminar Service Supplier', `¿Eliminar "${s.nombre}"?`)
    if (!ok) return
    try { await deleteHwSS(s.id); showToast('Eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleSaveTU() {
    if (!tuForm.nombre.trim()) { showToast('El nombre es requerido', 'err'); return }
    try { await saveHwTipoUnidad(tuForm); showToast(tuForm.id ? 'Actualizado' : 'Tipo creado'); setTuModal(false) }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDeleteTU(t) {
    const ok = await confirm('Eliminar Tipo de Unidad', `¿Eliminar "${t.nombre}"?`)
    if (!ok) return
    try { await deleteHwTipoUnidad(t.id); showToast('Eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div>
      <ConfirmModalUI />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, letterSpacing:.5 }}>
            ⚙ Configuración
          </div>
          <button
            onClick={() => navigate('/materiales')}
            style={{ background:'none', border:'none', color:'#1a9c1a', fontSize:11, fontWeight:700, cursor:'pointer', padding:0 }}>
            → Dashboard
          </button>
        </div>
      </div>

      {/* ── Fila 1: Bodegas Ingetel + Bodegas Nokia ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start', marginBottom:16 }}>

        <div className="card">
          <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2>Bodegas Ingetel</h2>
            {canEdit && <button className="btn bp btn-sm" onClick={() => openModal()}>+ Agregar</button>}
          </div>
          <div className="card-b" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {bodegas.length === 0 && (
              <div style={{ textAlign:'center', padding:24, color:'#9ca89c', fontSize:12 }}>Sin bodegas</div>
            )}
            {bodegas.map(b => (
              <div key={b.id} style={{ border:'1.5px solid #e0e4e0', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>
                      📍 {b.nombre}
                      {b.regional && <span style={{ fontSize:10, color:'#9ca89c', marginLeft:6 }}>| {b.regional}</span>}
                      {b.ciudad   && <span style={{ fontSize:10, color:'#9ca89c', marginLeft:6 }}>| {b.ciudad}</span>}
                    </div>
                    {b.direccion && <div style={{ fontSize:10, color:'#9ca89c', marginTop:2 }}>{b.direccion}</div>}
                  </div>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => openModal(b)}
                        style={{ padding:'3px 10px', fontSize:10, fontWeight:600, borderRadius:4, border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>Editar</button>
                      <button onClick={() => handleDelete(b)}
                        style={{ padding:'3px 10px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#fde8e7', color:'#c0392b', cursor:'pointer' }}>Eliminar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2>Bodegas Nokia</h2>
            {canEdit && <button className="btn bp btn-sm" onClick={() => { setNokForm({ nombre:'', ciudad:'', notas:'' }); setNokModal(true) }}>+ Agregar</button>}
          </div>
          <div className="card-b" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {hwBodegasNokia.length === 0 && (
              <div style={{ textAlign:'center', padding:16, color:'#9ca89c', fontSize:12 }}>Sin bodegas Nokia</div>
            )}
            {hwBodegasNokia.map(b => (
              <div key={b.id} style={{ border:'1.5px solid #dbeafe', borderRadius:8, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:12, color:'#1e40af' }}>📦 {b.nombre}</div>
                  {b.ciudad && <div style={{ fontSize:10, color:'#9ca89c' }}>{b.ciudad}</div>}
                </div>
                {canEdit && (
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setNokForm({ ...b }); setNokModal(true) }}
                      style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>Editar</button>
                    <button onClick={() => handleDeleteNok(b)}
                      style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#fde8e7', color:'#c0392b', cursor:'pointer' }}>Eliminar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fila 2: Service Suppliers + Tipos de Unidad ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start', marginBottom:16 }}>

        <div className="card">
          <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2>Service Suppliers (SS)</h2>
            {canEdit && <button className="btn bp btn-sm" onClick={() => { setSsForm({ nombre:'', ciudad:'', notas:'' }); setSsModal(true) }}>+ Agregar</button>}
          </div>
          <div className="card-b" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {hwServiceSuppliers.length === 0 && (
              <div style={{ textAlign:'center', padding:16, color:'#9ca89c', fontSize:12 }}>Sin service suppliers</div>
            )}
            {hwServiceSuppliers.map(s => (
              <div key={s.id} style={{ border:'1.5px solid #e9d5ff', borderRadius:8, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:12, color:'#6b21a8' }}>🏢 {s.nombre}</div>
                  {s.ciudad && <div style={{ fontSize:10, color:'#9ca89c' }}>{s.ciudad}</div>}
                </div>
                {canEdit && (
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setSsForm({ ...s }); setSsModal(true) }}
                      style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>Editar</button>
                    <button onClick={() => handleDeleteSS(s)}
                      style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#fde8e7', color:'#c0392b', cursor:'pointer' }}>Eliminar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2>Tipos de Unidad (LOG_INV)</h2>
            {canEdit && <button className="btn bp btn-sm" onClick={() => { setTuForm({ nombre:'' }); setTuModal(true) }}>+ Agregar</button>}
          </div>
          <div className="card-b" style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {hwTipoUnidades.length === 0 && (
              <div style={{ textAlign:'center', padding:16, color:'#9ca89c', fontSize:12 }}>Sin tipos de unidad</div>
            )}
            {hwTipoUnidades.map(t => (
              <div key={t.id} style={{ border:'1.5px solid #fde8d8', borderRadius:8, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, fontSize:12, color:'#9a3412', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:.5 }}>
                  {t.nombre}
                  {t.activo === false && <span style={{ marginLeft:6, fontSize:9, color:'#9ca89c' }}>inactivo</span>}
                </div>
                {canEdit && (
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setTuForm({ ...t }); setTuModal(true) }}
                      style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>Editar</button>
                    <button onClick={() => handleDeleteTU(t)}
                      style={{ padding:'2px 8px', fontSize:10, fontWeight:600, borderRadius:4, border:'none', background:'#fde8e7', color:'#c0392b', cursor:'pointer' }}>Eliminar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fila 3: Info de la App (stats horizontales) ── */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-h"><h2>Información de la App</h2></div>
        <div className="card-b" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
          {[
            { label:'Versión',            value: VERSION },
            { label:'Materiales',         value: catalogo.filter(c => c.categoria !== 'PROVEEDORES').length },
            { label:'Proveedores',        value: catalogo.filter(c => c.categoria === 'PROVEEDORES').length },
            { label:'Movimientos',        value: movimientos.length },
            { label:'Despachos',          value: despachos.length },
            { label:'Bodegas',            value: bodegas.length },
            { label:'Sitios',             value: sitios.length },
            { label:'Últ. sincronización',value: syncTime },
          ].map((row, i) => (
            <div key={row.label} style={{
              padding:'10px 16px',
              borderRight: i % 4 !== 3 ? '1px solid #f0f2f0' : 'none',
              borderBottom: i < 4 ? '1px solid #f0f2f0' : 'none',
            }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#9ca89c', marginBottom:3 }}>{row.label}</div>
              <div style={{ fontWeight:700, fontSize:13, color:'#0a0a0a' }}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fila 4: Historial de Cambios (ancho completo) ── */}
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Historial de Cambios</h2>
            <span style={{ fontSize:10, color:'#9ca89c' }}>{historial.length} registros</span>
          </div>
          <div className="card-b" style={{ padding:0 }}>
            {historial.length === 0 ? (
              <div style={{ textAlign:'center', padding:32, color:'#9ca89c', fontSize:12 }}>Sin registros</div>
            ) : (
              <table className="tbl">
                <thead><tr>
                  <th>Fecha</th><th>Usuario</th><th>Acción</th><th>Referencia</th><th>Detalle</th>
                </tr></thead>
                <tbody>
                  {historial.map((h, i) => {
                    const ac = ACCION_COLORS[h.accion] || { bg:'#f8f8f8', color:'#555f55' }
                    const fechaStr = h.fecha
                      ? new Date(h.fecha).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
                      : '—'
                    return (
                      <tr key={i}>
                        <td style={{ fontSize:10, color:'#9ca89c', whiteSpace:'nowrap' }}>{fechaStr}</td>
                        <td style={{ fontSize:10, color:'#9ca89c' }}>{h.usuario}</td>
                        <td>
                          <span className="badge" style={{ background:ac.bg, color:ac.color, fontSize:9 }}>{h.accion}</span>
                        </td>
                        <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11 }}>{h.ref}</td>
                        <td style={{ fontSize:10, color:'#9ca89c', maxWidth:160 }}>{h.detalle}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Bodega Ingetel */}
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
                { label:'Nombre *',  key:'nombre',    type:'text' },
                { label:'Regional',  key:'regional',  type:'text' },
                { label:'Ciudad',    key:'ciudad',    type:'text' },
                { label:'Dirección', key:'direccion', type:'text' },
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

      {/* Modal Bodega Nokia */}
      {nokModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:400 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1d4ed8' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {nokForm.id ? 'Editar Bodega Nokia' : 'Nueva Bodega Nokia'}
              </span>
              <button onClick={() => setNokModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nombre *', key:'nombre', placeholder:'Ej: DSV Bogotá' },
                { label:'Ciudad',   key:'ciudad', placeholder:'Ej: Bogotá' },
              ].map(f => (
                <div key={f.key}>
                  <label className="fl">{f.label}</label>
                  <input type="text" className="fc" placeholder={f.placeholder} value={nokForm[f.key] || ''}
                    onChange={e => setNokForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="fl">Notas</label>
                <textarea className="fc" rows={2} value={nokForm.notas || ''}
                  onChange={e => setNokForm(p => ({ ...p, notas: e.target.value }))}
                  style={{ resize:'vertical', fontSize:12 }} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn bou" onClick={() => setNokModal(false)}>Cancelar</button>
                <button className="btn bp" onClick={handleSaveNok}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tipo de Unidad */}
      {tuModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:360 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #ea580c' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {tuForm.id ? 'Editar Tipo de Unidad' : 'Nuevo Tipo de Unidad'}
              </span>
              <button onClick={() => setTuModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label className="fl">Nombre * <span style={{ color:'#9ca89c', fontWeight:400 }}>(ej: HFD, HFNI, SW)</span></label>
                <input type="text" className="fc" placeholder="Ej: HFD" value={tuForm.nombre || ''}
                  onChange={e => setTuForm(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              {tuForm.id && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="checkbox" id="tu-activo" checked={tuForm.activo !== false}
                    onChange={e => setTuForm(p => ({ ...p, activo: e.target.checked }))} />
                  <label htmlFor="tu-activo" style={{ fontSize:12, fontWeight:600 }}>Activo</label>
                </div>
              )}
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setTuModal(false)}>Cancelar</button>
                <button className="btn bp" onClick={handleSaveTU}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Service Supplier */}
      {ssModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:400 }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #7c3aed' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                {ssForm.id ? 'Editar Service Supplier' : 'Nuevo Service Supplier'}
              </span>
              <button onClick={() => setSsModal(false)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nombre *', key:'nombre', placeholder:'Ej: Mikrolink' },
                { label:'Ciudad',   key:'ciudad', placeholder:'Ej: Cali' },
              ].map(f => (
                <div key={f.key}>
                  <label className="fl">{f.label}</label>
                  <input type="text" className="fc" placeholder={f.placeholder} value={ssForm[f.key] || ''}
                    onChange={e => setSsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="fl">Notas</label>
                <textarea className="fc" rows={2} value={ssForm.notas || ''}
                  onChange={e => setSsForm(p => ({ ...p, notas: e.target.value }))}
                  style={{ resize:'vertical', fontSize:12 }} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn bou" onClick={() => setSsModal(false)}>Cancelar</button>
                <button className="btn bp" onClick={handleSaveSS}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
