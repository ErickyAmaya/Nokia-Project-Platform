import { useState, useMemo } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../Toast'
import SearchableSelect from './SearchableSelect'

function nextEntradaNum(movimientos) {
  const year = new Date().getFullYear()
  const re   = new RegExp(`^ENT-${year}-(\\d+)$`)
  const nums = movimientos.map(m => { const x = m.numero_doc?.match(re); return x ? parseInt(x[1]) : 0 }).filter(Boolean)
  return `ENT-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`
}

export default function MatEntradaModal({ onClose }) {
  const catalogo          = useMatStore(s => s.catalogo)
  const bodegas           = useMatStore(s => s.bodegas)
  const movimientos       = useMatStore(s => s.movimientos)
  const proveedores       = useMatStore(s => s.proveedores)
  const getPrecioProveedor = useMatStore(s => s.getPrecioProveedor)
  const upsertPrecio      = useMatStore(s => s.upsertPrecio)
  const addMovimiento     = useMatStore(s => s.addMovimiento)
  const user              = useAuthStore(s => s.user)

  const [saving, setSaving] = useState(false)
  const [updateCatalogPrice, setUpdateCatalogPrice] = useState(false)

  const [form, setForm] = useState({
    numero_doc:   nextEntradaNum(movimientos),
    fecha:        new Date().toISOString().slice(0, 10),
    bodega_id:    bodegas[0]?.id || '',
    catalogo_id:  '',
    proveedor_id: '',
    cantidad:     1,
    valor_unitario: '',
    comentarios:  '',
  })

  const matOptions = useMemo(() =>
    catalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES')
      .map(c => ({ value: String(c.id), label: c.nombre, sub: c.codigo }))
  , [catalogo])

  function handleMaterialChange(val) {
    setForm(p => {
      const precio = p.proveedor_id
        ? getPrecioProveedor(Number(val), Number(p.proveedor_id))
        : null
      return { ...p, catalogo_id: val, valor_unitario: precio != null ? String(precio) : '' }
    })
  }

  function handleProveedorChange(e) {
    const prov_id = e.target.value
    setForm(p => {
      const precio = p.catalogo_id
        ? getPrecioProveedor(Number(p.catalogo_id), Number(prov_id))
        : null
      return { ...p, proveedor_id: prov_id, valor_unitario: precio != null ? String(precio) : '' }
    })
  }

  const cat          = catalogo.find(c => c.id === Number(form.catalogo_id))
  const prov         = proveedores.find(p => p.id === Number(form.proveedor_id))
  const valorUnit    = parseFloat(form.valor_unitario) || 0
  const total        = valorUnit * Number(form.cantidad)
  const precioActual = form.catalogo_id && form.proveedor_id
    ? getPrecioProveedor(Number(form.catalogo_id), Number(form.proveedor_id))
    : null
  const precioCambio = precioActual != null && valorUnit !== precioActual

  async function handleSave() {
    if (!form.catalogo_id)    { showToast('Selecciona un material', 'err'); return }
    if (!form.bodega_id)      { showToast('Selecciona una bodega', 'err'); return }
    if (Number(form.cantidad) <= 0) { showToast('Cantidad inválida', 'err'); return }
    setSaving(true)
    try {
      await addMovimiento({
        numero_doc:    form.numero_doc,
        fecha:         form.fecha,
        tipo:          'Entrada',
        catalogo_id:   Number(form.catalogo_id),
        bodega_id:     Number(form.bodega_id),
        cantidad:      Number(form.cantidad),
        valor_unitario: valorUnit,
        valor_total:   total,
        origen:        prov?.nombre || null,
        created_by:    user?.nombre || user?.email,
      })
      if (updateCatalogPrice && form.proveedor_id && valorUnit > 0) {
        await upsertPrecio(Number(form.catalogo_id), Number(form.proveedor_id), valorUnit)
      }
      showToast('Entrada registrada')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'3px solid #1a9c1a', borderRadius:'12px 12px 0 0' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, letterSpacing:1 }}>
            NUEVA ENTRADA DE MATERIALES
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>

          {/* Doc + Fecha */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="fl">Nº Documento</label>
              <input className="fc" value={form.numero_doc} readOnly
                style={{ background:'#f5f5f5', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }} />
            </div>
            <div>
              <label className="fl">Fecha</label>
              <input type="date" className="fc" value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
          </div>

          {/* Bodega */}
          <div>
            <label className="fl">Bodega Destino *</label>
            <select className="fc" value={form.bodega_id}
              onChange={e => setForm(p => ({ ...p, bodega_id: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>

          {/* Material */}
          <div>
            <label className="fl">Material *</label>
            <SearchableSelect
              options={matOptions}
              value={String(form.catalogo_id)}
              onChange={handleMaterialChange}
              placeholder="Buscar material…"
            />
          </div>

          {/* Proveedor */}
          <div>
            <label className="fl">Proveedor</label>
            <select className="fc" value={form.proveedor_id} onChange={handleProveedorChange}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          {/* Cantidad + Precio */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="fl">Cantidad *</label>
              <input type="number" min="1" className="fc" value={form.cantidad}
                onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} />
            </div>
            <div>
              <label className="fl">
                Valor Unitario
                {precioActual != null && (
                  <span style={{ fontSize:9, color:'#9ca89c', marginLeft:4, fontWeight:400 }}>
                    (catálogo: {matCop(precioActual)})
                  </span>
                )}
              </label>
              <input type="number" min="0" className="fc" value={form.valor_unitario}
                placeholder="0"
                onChange={e => setForm(p => ({ ...p, valor_unitario: e.target.value }))} />
            </div>
          </div>

          {/* Aviso precio cambió */}
          {precioCambio && (
            <div style={{ background:'#fef3cd', border:'1px solid #ffc107', borderRadius:6, padding:'8px 12px', fontSize:11 }}>
              <strong>El precio difiere del catálogo</strong> ({matCop(precioActual)} → {matCop(valorUnit)}).
              <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
                <input type="checkbox" id="upd-price" checked={updateCatalogPrice}
                  onChange={e => setUpdateCatalogPrice(e.target.checked)} />
                <label htmlFor="upd-price" style={{ fontSize:11 }}>Actualizar precio en catálogo</label>
              </div>
            </div>
          )}

          {/* Total */}
          {valorUnit > 0 && (
            <div style={{ background:'#f0fdf4', border:'1px solid #a3e6a3', borderRadius:6, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#555f55' }}>Total entrada</span>
              <span style={{ fontWeight:800, color:'#144E4A', fontFamily:"'Barlow Condensed',sans-serif", fontSize:16 }}>{matCop(total)}</span>
            </div>
          )}

          {/* Comentarios */}
          <div>
            <label className="fl">Comentarios</label>
            <input className="fc" placeholder="Opcional" value={form.comentarios}
              onChange={e => setForm(p => ({ ...p, comentarios: e.target.value }))} />
          </div>

          {/* Acciones */}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
            <button className="btn bou" onClick={onClose} disabled={saving}>Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding:'8px 20px', fontSize:12, fontWeight:700, borderRadius:6, border:'none',
                background:'#1a9c1a', color:'#fff', cursor:'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando…' : 'Registrar Entrada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
