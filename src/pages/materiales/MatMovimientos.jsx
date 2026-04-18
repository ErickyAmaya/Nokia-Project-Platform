import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAppStore }  from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'
import SearchableSelect from '../../components/materiales/SearchableSelect'

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

const FORM_RESET = {
  fecha: new Date().toISOString().slice(0,10),
  numero_doc: '', catalogo_id: '', bodega_id: '',
  cantidad: 0, valor_unitario: 0, origen: '', destino: '', sitio_id: '', comentarios: '',
}

export default function MatMovimientos() {
  const catalogo         = useMatStore(s => s.catalogo)
  const bodegas          = useMatStore(s => s.bodegas)
  const movimientos      = useMatStore(s => s.movimientos)
  const addMovimiento    = useMatStore(s => s.addMovimiento)
  const deleteMovimiento = useMatStore(s => s.deleteMovimiento)
  const liquidadorSitios = useAppStore(s => s.sitios)
  const user             = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modal,   setModal]   = useState(false)
  const [tipo,    setTipo]    = useState('Entrada')
  const [filTipo, setFilTipo] = useState('')
  const [filBod,  setFilBod]  = useState('')
  const [search,  setSearch]  = useState('')
  const [form, setForm] = useState(FORM_RESET)

  const canEdit   = ['admin','coordinador','logistica'].includes(user?.role)
  const canDelete = ['admin','coordinador'].includes(user?.role)

  // Opciones para SearchableSelect de material
  const materialOptions = useMemo(() =>
    catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES')
      .map(c => ({ value: c.id, label: c.nombre, sub: c.codigo }))
  , [catalogo])

  // Proveedores para ORIGEN en Entrada
  const proveedores = useMemo(() =>
    catalogo.filter(c => c.categoria === 'PROVEEDORES' && c.activo)
  , [catalogo])

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return movimientos.filter(m => {
      if (filTipo && m.tipo !== filTipo) return false
      if (filBod  && m.bodega_id !== Number(filBod)) return false
      if (q) {
        const cat = catalogo.find(c => c.id === m.catalogo_id)
        if (!`${m.numero_doc} ${cat?.nombre || ''} ${cat?.codigo || ''}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [movimientos, filTipo, filBod, search, catalogo])

  function openModal(t) {
    setTipo(t)
    setForm(FORM_RESET)
    setModal(true)
  }

  // Auto-completar valor_unitario desde catálogo
  function handleCatChange(val) {
    const cat = catalogo.find(c => c.id === Number(val))
    setForm(p => ({ ...p, catalogo_id: val, valor_unitario: cat?.costo_unitario || 0 }))
  }

  async function handleSave() {
    if (!form.catalogo_id || !form.bodega_id || !form.numero_doc || form.cantidad <= 0) {
      showToast('Completa todos los campos requeridos', 'err'); return
    }
    try {
      await addMovimiento({
        ...form,
        tipo,
        catalogo_id:    Number(form.catalogo_id),
        bodega_id:      Number(form.bodega_id),
        sitio_id:       form.sitio_id ? Number(form.sitio_id) : null,
        cantidad:       Number(form.cantidad),
        valor_unitario: Number(form.valor_unitario),
        created_by:     user?.nombre || user?.email,
      })
      showToast(`${tipo} registrada`)
      setModal(false)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleDelete(m) {
    const cat = catalogo.find(c => c.id === m.catalogo_id)
    const ok = await confirm('Eliminar Movimiento', `¿Eliminar ${m.tipo} "${cat?.nombre}" (${m.numero_doc})?`)
    if (!ok) return
    try { await deleteMovimiento(m.id); showToast('Movimiento eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  // ── Campos del modal según tipo ──────────────────────────────────────
  function ModalEntrada() {
    return (
      <>
        <div>
          <label className="fl">Material *</label>
          <SearchableSelect
            options={materialOptions}
            value={String(form.catalogo_id || '')}
            onChange={handleCatChange}
            placeholder="Buscar material…"
          />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label className="fl">ORIGEN</label>
            <select className="fc" value={form.origen}
              onChange={e => setForm(p => ({ ...p, origen: e.target.value }))}>
              <option value="">— Proveedor —</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="fl">BODEGA *</label>
            <select className="fc" value={form.bodega_id}
              onChange={e => setForm(p => ({ ...p, bodega_id: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="fl">DESTINO</label>
          <select className="fc" value={form.sitio_id}
            onChange={e => {
              const sitio = liquidadorSitios.find(s => String(s.id) === e.target.value)
              setForm(p => ({ ...p, sitio_id: e.target.value, destino: sitio?.nombre || '' }))
            }}>
            <option value="">— Sitio Nokia —</option>
            {(liquidadorSitios || []).map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </>
    )
  }

  function ModalSalida() {
    return (
      <>
        <div>
          <label className="fl">Material *</label>
          <SearchableSelect
            options={materialOptions}
            value={String(form.catalogo_id || '')}
            onChange={handleCatChange}
            placeholder="Buscar material…"
          />
        </div>
        <div>
          <label className="fl">BODEGA *</label>
          <select className="fc" value={form.bodega_id}
            onChange={e => setForm(p => ({ ...p, bodega_id: e.target.value }))}>
            <option value="">— Seleccionar —</option>
            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </div>
      </>
    )
  }

  return (
    <div>
      {ConfirmModalUI}
      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Movimientos ({rows.length})</h2>
          {canEdit && (
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn bp btn-sm"   onClick={() => openModal('Entrada')}>+ Entrada</button>
              <button className="btn btn-sm" style={{ background:'#c0392b', color:'#fff' }} onClick={() => openModal('Salida')}>+ Salida</button>
            </div>
          )}
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar doc, material…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:160 }} />
            <select className="fc" value={filTipo} onChange={e => setFilTipo(e.target.value)} style={{ maxWidth:130 }}>
              <option value="">Todos los tipos</option>
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
                <th>Fecha</th><th>Doc</th><th>Material</th><th>Bodega</th>
                <th>Tipo</th><th className="num">Cantidad</th>
                <th className="num">V. Unit.</th><th className="num">Total</th>
                <th>Origen/Destino</th>{canDelete && <th></th>}
              </tr></thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin movimientos</td></tr>
                )}
                {rows.map(m => {
                  const cat = catalogo.find(c => c.id === m.catalogo_id)
                  const bod = bodegas.find(b => b.id === m.bodega_id)
                  return (
                    <tr key={m.id}>
                      <td style={{ color:'#9ca89c', whiteSpace:'nowrap' }}>{m.fecha}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>{m.numero_doc}</td>
                      <td style={{ fontWeight:600 }}>{cat?.nombre || '—'}</td>
                      <td style={{ color:'#9ca89c' }}>{bod?.nombre || '—'}</td>
                      <td><span style={{ color:m.tipo==='Entrada'?'#1a7a1a':'#c0392b', fontWeight:700 }}>{m.tipo}</span></td>
                      <td className="num">{m.cantidad}</td>
                      <td className="num" style={{ color:'#9ca89c' }}>{matCop(m.valor_unitario)}</td>
                      <td className="num" style={{ fontWeight:700 }}>{matCop(m.valor_total)}</td>
                      <td style={{ fontSize:10, color:'#9ca89c' }}>{m.origen || m.destino || '—'}</td>
                      {canDelete && (
                        <td><button className="btn-del" onClick={() => handleDelete(m)}>✕</button></td>
                      )}
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
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ background: tipo==='Entrada'?'#144E4A':'#c0392b', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`3px solid ${tipo==='Entrada'?'#1a9c1a':'#922b21'}` }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, letterSpacing:1 }}>
                Registrar {tipo}
              </span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {/* Campos comunes */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha:e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Nº Documento *</label>
                  <input type="text" className="fc" placeholder="FC-000-001" value={form.numero_doc} onChange={e => setForm(p => ({ ...p, numero_doc:e.target.value }))} />
                </div>
              </div>

              {/* Campos por tipo */}
              {tipo === 'Entrada' ? <ModalEntrada /> : <ModalSalida />}

              {/* Cantidad + Valor Unitario */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Cantidad *</label>
                  <input type="number" min="0" className="fc" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad:e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Valor Unitario</label>
                  <input type="number" min="0" className="fc" value={form.valor_unitario}
                    readOnly={tipo === 'Salida'}
                    style={{ background: tipo === 'Salida' ? '#f5f5f5' : undefined }}
                    onChange={tipo === 'Entrada' ? e => setForm(p => ({ ...p, valor_unitario:e.target.value })) : undefined}
                  />
                </div>
              </div>

              <div>
                <label className="fl">Comentarios</label>
                <input type="text" className="fc" value={form.comentarios} onChange={e => setForm(p => ({ ...p, comentarios:e.target.value }))} />
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
