import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAppStore }  from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'
import SearchableSelect from '../../components/materiales/SearchableSelect'
import DespachoModal from '../../components/materiales/DespachoModal'

function nextMovNum(tipo, movimientos) {
  const year   = new Date().getFullYear()
  const prefix = tipo === 'Entrada' ? 'IN' : 'OUT'
  const re     = new RegExp(`^${prefix}-${year}-(\\d+)$`)
  const nums   = movimientos
    .filter(m => m.tipo === tipo)
    .map(m => { const match = m.numero_doc?.match(re); return match ? parseInt(match[1]) : 0 })
    .filter(Boolean)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}-${year}-${String(next).padStart(3,'0')}`
}

const FORM_RESET = {
  fecha: new Date().toISOString().slice(0,10),
  numero_doc: '', catalogo_id: '', bodega_id: '',
  cantidad: 1, valor_unitario: 0, origen: '', destino: '', sitio_id: '', comentarios: '', editPrice: false,
}

export default function MatMovimientos() {
  const catalogo         = useMatStore(s => s.catalogo)
  const bodegas          = useMatStore(s => s.bodegas)
  const movimientos      = useMatStore(s => s.movimientos)
  const despachos        = useMatStore(s => s.despachos)
  const addMovimiento    = useMatStore(s => s.addMovimiento)
  const deleteMovimiento = useMatStore(s => s.deleteMovimiento)
  const liquidadorSitios = useAppStore(s => s.sitios)
  const user             = useAuthStore(s => s.user)
const { confirm, ConfirmModalUI } = useConfirm()

  const [form,       setForm]       = useState({ ...FORM_RESET, numero_doc: nextMovNum('Entrada', []) })
  const [saving,     setSaving]     = useState(false)
  const [despachoOpen, setDespachoOpen] = useState(false)
  const [filTipo, setFilTipo] = useState('')
  const [filBod,  setFilBod]  = useState('')
  const [search,  setSearch]  = useState('')
  const [filDate, setFilDate] = useState('')

  const canEdit   = ['admin','coordinador','logistica'].includes(user?.role)
  const canDelete = ['admin','coordinador'].includes(user?.role)

  const materialOptions = useMemo(() =>
    catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES')
      .map(c => ({ value: c.id, label: c.nombre, sub: c.codigo }))
  , [catalogo])

  const proveedores = useMemo(() => catalogo.filter(c => c.categoria === 'PROVEEDORES' && c.activo), [catalogo])

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

  function handleCatChange(val) {
    const cat = catalogo.find(c => c.id === Number(val))
    setForm(p => ({ ...p, catalogo_id: val, valor_unitario: cat?.costo_unitario || 0 }))
  }

  function handleReset() {
    setForm({ ...FORM_RESET, numero_doc: nextMovNum('Entrada', movimientos) })
  }

  async function handleSave() {
    if (!form.catalogo_id || !form.bodega_id || form.cantidad <= 0) {
      showToast('Completa material, bodega y cantidad', 'err'); return
    }
    setSaving(true)
    try {
      await addMovimiento({
        ...form,
        tipo:           'Entrada',
        catalogo_id:    Number(form.catalogo_id),
        bodega_id:      Number(form.bodega_id),
        sitio_id:       null,
        cantidad:       Number(form.cantidad),
        valor_unitario: Number(form.valor_unitario),
        created_by:     user?.nombre || user?.email,
      })
      showToast('Entrada registrada')
      setForm({ ...FORM_RESET, numero_doc: nextMovNum('Entrada', [...movimientos, {}]) })
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleDelete(m) {
    const cat = catalogo.find(c => c.id === m.catalogo_id)
    const ok = await confirm('Eliminar Movimiento', `¿Eliminar ${m.tipo} "${cat?.nombre}" (${m.numero_doc})?`)
    if (!ok) return
    try { await deleteMovimiento(m.id); showToast('Movimiento eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  const lbl = { display:'block', fontSize:9, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:'#555f55', marginBottom:3 }

  return (
    <div>
      <ConfirmModalUI />

      {despachoOpen && <DespachoModal onClose={() => setDespachoOpen(false)} />}

      {/* ── Top: 2 columnas ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16, alignItems:'start' }}>

        {/* ── NUEVA ENTRADA form ── */}
        <div className="card">
          <div className="card-h" style={{ background:'#144E4A', borderRadius:'8px 8px 0 0' }}>
            <h2 style={{ color:'#fff', margin:0 }}>Nueva Entrada</h2>
          </div>
          <div className="card-b" style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Alert banner */}
            <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:6, padding:'7px 10px', fontSize:11, color:'#856404' }}>
              Para <strong>Salidas</strong> usa el botón <strong>Nuevo Despacho</strong>. Este formulario registra <strong>Entradas</strong> de material a bodega.
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={lbl}>Nº Documento</label>
                <input type="text" className="fc" value={form.numero_doc} readOnly
                  style={{ background:'#f5f5f5', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:.5 }} />
              </div>
              <div>
                <label style={lbl}>Fecha</label>
                <input type="date" className="fc" value={form.fecha}
                  onChange={e => setForm(p => ({ ...p, fecha:e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={lbl}>Material *</label>
              <SearchableSelect
                options={materialOptions}
                value={String(form.catalogo_id || '')}
                onChange={handleCatChange}
                placeholder="Escribir nombre o código del material…"
              />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={lbl}>Bodega *</label>
                <select className="fc" value={form.bodega_id}
                  onChange={e => setForm(p => ({ ...p, bodega_id:e.target.value }))}>
                  <option value="">— Bodega —</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cantidad</label>
                <input type="number" min="1" className="fc" value={form.cantidad}
                  onChange={e => setForm(p => ({ ...p, cantidad:e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={lbl}>Precio Unitario (COP) — Del Catálogo</label>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input type="number" className="fc" value={form.valor_unitario}
                  readOnly={!form.editPrice}
                  style={{ background: form.editPrice ? '#fff' : '#f5f5f5', flex:1 }}
                  onChange={e => setForm(p => ({ ...p, valor_unitario:e.target.value }))} />
                <button
                  onClick={() => setForm(p => ({ ...p, editPrice:!p.editPrice }))}
                  style={{ padding:'5px 10px', fontSize:10, fontWeight:700, borderRadius:5, border:'1.5px solid #e0e4e0', background: form.editPrice ? '#1a9c1a' : '#fff', color: form.editPrice ? '#fff' : '#555f55', cursor:'pointer', whiteSpace:'nowrap' }}>
                  {form.editPrice ? '✓ Precio editado' : 'Editar precio'}
                </button>
              </div>
              {!form.editPrice && (
                <div style={{ fontSize:9, color:'#9ca89c', marginTop:3 }}>
                  Precio tomado del catálogo. Solo editar si hay precio especial en este movimiento.
                </div>
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={lbl}>Origen</label>
                <select className="fc" value={form.origen}
                  onChange={e => setForm(p => ({ ...p, origen:e.target.value }))}>
                  <option value="">Proveedor / Compra</option>
                  {proveedores.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Destino</label>
                <input type="text" className="fc" value={form.destino} placeholder="Ej. Bodega Cali"
                  onChange={e => setForm(p => ({ ...p, destino:e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={lbl}>Comentarios</label>
              <input type="text" className="fc" placeholder="Opcional" value={form.comentarios}
                onChange={e => setForm(p => ({ ...p, comentarios:e.target.value }))} />
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
              <button className="btn bou" onClick={handleReset}>Limpiar</button>
              <button className="btn bp" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar Movimiento'}
              </button>
            </div>
          </div>
        </div>

        {/* ── DESPACHOS panel ── */}
        <div className="card">
          <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2>Despachos</h2>
            {canEdit && (
              <button className="btn btn-sm" style={{ background:'#c0392b', color:'#fff', border:'none', padding:'5px 12px', borderRadius:5, fontWeight:700, fontSize:11, cursor:'pointer' }}
                onClick={() => setDespachoOpen(true)}>
                + Nuevo Despacho (Salida)
              </button>
            )}
          </div>
          <div className="card-b" style={{ padding:'8px 0' }}>
            {despachos.length === 0 ? (
              <div style={{ textAlign:'center', padding:24, color:'#9ca89c', fontSize:12 }}>Sin despachos</div>
            ) : (
              <table className="tbl">
                <thead><tr>
                  <th>DOC</th><th>SITIO</th><th>FECHA</th><th className="num">ITEMS</th><th className="num">TOTAL</th><th>ESTADO</th>
                </tr></thead>
                <tbody>
                  {despachos.slice(0, 10).map(d => {
                    const movs  = movimientos.filter(m => m.numero_doc === d.numero_doc)
                    const total = movs.reduce((a, m) => a + (m.valor_total || m.cantidad * (m.valor_unitario || 0) || 0), 0)
                    return (
                      <tr key={d.id}>
                        <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11 }}>{d.numero_doc}</td>
                        <td style={{ fontSize:11 }}>{d.destino || '—'}</td>
                        <td style={{ fontSize:10, color:'#9ca89c' }}>{d.fecha}</td>
                        <td className="num" style={{ fontSize:11 }}>{movs.length}</td>
                        <td className="num" style={{ fontWeight:700, fontSize:11 }}>{matCop(total)}</td>
                        <td>
                          <span className="badge" style={{ background:d.status==='finalizado'?'#d4edda':'#fef3cd', color:d.status==='finalizado'?'#1a6130':'#856404', fontSize:9 }}>
                            {d.status==='finalizado'?'Finalizado':'Borrador'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
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
                <th>Origen + Destino</th>{canDelete && <th></th>}
              </tr></thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'#9ca89c' }}>Sin movimientos</td></tr>
                )}
                {rows.map(m => {
                  const cat = catalogo.find(c => c.id === m.catalogo_id)
                  const bod = bodegas.find(b => b.id === m.bodega_id)
                  const orDest = [m.origen, m.destino].filter(Boolean).join(' = ')
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
    </div>
  )
}
