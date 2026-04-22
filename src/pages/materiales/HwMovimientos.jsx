import { useState, useMemo, useEffect, useRef } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useAuthStore } from '../../store/authStore'
import { useMatStore } from '../../store/useMatStore'
import { useAppStore } from '../../store/useAppStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

const TIPO_LUGAR = [
  { value:'nokia',  label:'Nokia' },
  { value:'bodega', label:'Bodega Ingetel' },
  { value:'sitio',  label:'Sitio' },
  { value:'ss',     label:'Service Supplier' },
]

function nextHwDoc(movimientos, tipo) {
  const year   = new Date().getFullYear()
  const prefix = tipo === 'ENTRADA' ? 'HW-IN' : 'HW-OUT'
  const re     = new RegExp(`^${prefix}-${year}-(\\d+)$`)
  const nums   = movimientos.map(m => { const x = m.so?.match(re); return x ? parseInt(x[1]) : 0 }).filter(Boolean)
  return `${prefix}-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0')}`
}

// ── Combobox buscable para Tipo de Equipo ────────────────────────────────
function SearchableEquipo({ value, onChange, options }) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const ref = useRef(null)

  const selected = options.find(o => String(o.id) === String(value))
  const display  = open ? query : (selected ? selected.descripcion : '')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? options.filter(o =>
      o.descripcion.toLowerCase().includes(q) ||
      (o.cod_material || '').toLowerCase().includes(q)
    ) : options
  }, [options, query])

  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input
        className="fc"
        placeholder="Buscar equipo por descripción o código…"
        value={display}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
      />
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:700,
          background:'#fff', border:'1.5px solid #e0e4e0', borderRadius:6,
          maxHeight:220, overflowY:'auto', boxShadow:'0 6px 20px rgba(0,0,0,.12)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding:'10px 12px', fontSize:11, color:'#9ca89c' }}>Sin resultados</div>
          )}
          {filtered.map(o => (
            <div key={o.id}
              onMouseDown={() => { onChange(String(o.id)); setOpen(false); setQuery('') }}
              style={{
                padding:'8px 12px', cursor:'pointer', fontSize:11,
                background: String(o.id) === String(value) ? '#f0fdf4' : '#fff',
                borderBottom:'1px solid #f0f2f0',
              }}>
              <span style={{ fontWeight:600 }}>{o.descripcion}</span>
              {o.cod_material && <span style={{ color:'#9ca89c', marginLeft:6, fontFamily:"'Barlow Condensed',sans-serif" }}>{o.cod_material}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Combobox buscable para listas de strings ────────────────────────────
function SearchableList({ value, onChange, options, placeholder }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const ref = useRef(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options
  }, [options, query])

  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input
        className="fc"
        placeholder={placeholder || 'Buscar…'}
        value={open ? query : value}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
      />
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:700,
          background:'#fff', border:'1.5px solid #e0e4e0', borderRadius:6,
          maxHeight:200, overflowY:'auto', boxShadow:'0 6px 20px rgba(0,0,0,.12)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding:'10px 12px', fontSize:11, color:'#9ca89c' }}>Sin resultados</div>
          )}
          {filtered.map(o => (
            <div key={o}
              onMouseDown={() => { onChange(o); setOpen(false); setQuery('') }}
              style={{
                padding:'8px 12px', cursor:'pointer', fontSize:11, fontWeight: o === value ? 700 : 400,
                background: o === value ? '#f0fdf4' : '#fff',
                borderBottom:'1px solid #f0f2f0',
              }}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Campo Lugar (origen / destino) ───────────────────────────────────────
function LugarField({ label, tipoKey, nombreKey, form, setForm, getOpciones }) {
  const tipo     = form[tipoKey]
  const opciones = getOpciones(tipo)
  return (
    <div style={{ border:'1px solid #e0e4e0', borderRadius:6, padding:10 }}>
      <label className="fl">{label}</label>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
        {TIPO_LUGAR.map(t => (
          <button key={t.value} type="button"
            onClick={() => setForm(p => ({ ...p, [tipoKey]: t.value, [nombreKey]: '' }))}
            style={{
              padding:'3px 10px', fontSize:10, fontWeight:700, borderRadius:20, cursor:'pointer',
              border: tipo === t.value ? 'none' : '1.5px solid #e0e4e0',
              background: tipo === t.value ? '#144E4A' : '#fff',
              color: tipo === t.value ? '#fff' : '#555f55',
            }}>
            {t.label}
          </button>
        ))}
      </div>
      {opciones.length > 0 ? (
        tipo === 'sitio' ? (
          <SearchableList
            value={form[nombreKey]}
            onChange={v => setForm(p => ({ ...p, [nombreKey]: v }))}
            options={opciones}
            placeholder="Buscar sitio Nokia…"
          />
        ) : (
          <select className="fc" value={form[nombreKey]}
            onChange={e => setForm(p => ({ ...p, [nombreKey]: e.target.value }))}>
            <option value="">— Seleccionar —</option>
            {opciones.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )
      ) : (
        <input className="fc" placeholder="Nombre del lugar…" value={form[nombreKey]}
          onChange={e => setForm(p => ({ ...p, [nombreKey]: e.target.value }))} />
      )}
    </div>
  )
}

// ── Formulario vacío ─────────────────────────────────────────────────────
function emptyForm(tipo, movimientos) {
  return {
    so:                nextHwDoc(movimientos, tipo),
    smp_id:            '',
    fecha:             new Date().toISOString().slice(0,10),
    catalogo_id:       '',
    cantidad:          1,
    seriales:          [''],
    origen:            '',
    origen_tipo:       tipo === 'ENTRADA' ? 'nokia'  : 'bodega',
    destino:           '',
    destino_tipo:      tipo === 'ENTRADA' ? 'bodega' : 'sitio',
    condicion:         'nuevo',
    log_inv_tipo_unidad: '',
    notas:             '',
  }
}

export default function HwMovimientos() {
  const hwCatalogo         = useHwStore(s => s.hwCatalogo)
  const hwEquipos          = useHwStore(s => s.hwEquipos)
  const hwMovimientos      = useHwStore(s => s.hwMovimientos)
  const hwBodegasNokia     = useHwStore(s => s.hwBodegasNokia)
  const hwServiceSuppliers = useHwStore(s => s.hwServiceSuppliers)
  const hwTipoUnidades     = useHwStore(s => s.hwTipoUnidades)
  const addHwMovimiento    = useHwStore(s => s.addHwMovimiento)
  const addHwEquipo        = useHwStore(s => s.addHwEquipo)
  const updateHwEquipo     = useHwStore(s => s.updateHwEquipo)
  const deleteHwMovimiento = useHwStore(s => s.deleteHwMovimiento)
  const loadAll            = useHwStore(s => s.loadAll)
  const bodegas            = useMatStore(s => s.bodegas)
  const liquidadorSitios   = useAppStore(s => s.sitios ?? [])
  const user               = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modalTipo, setModalTipo] = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [search,    setSearch]    = useState('')
  const [filTipo,   setFilTipo]   = useState('')
  const [filDate,   setFilDate]   = useState('')
  const [form,      setForm]      = useState(null)
  const prevOrigenRef = useRef(null)

  const canEdit   = ['admin','coordinador','logistica'].includes(user?.role)
  const canDelete = ['admin','coordinador'].includes(user?.role)

  useEffect(() => { loadAll() }, [])

  // Resetear seriales cuando cambia la bodega origen (evita seriales de otra bodega)
  useEffect(() => {
    if (modalTipo !== 'SALIDA' || !form) return
    const curr = form.origen
    if (prevOrigenRef.current !== null && prevOrigenRef.current !== curr) {
      setForm(p => p ? { ...p, seriales: Array(p.cantidad).fill('') } : p)
    }
    prevOrigenRef.current = curr
  }, [form?.origen]) // eslint-disable-line react-hooks/exhaustive-deps

  function openModal(tipo) {
    setForm(emptyForm(tipo, hwMovimientos))
    setModalTipo(tipo)
  }

  // Seriales disponibles filtrados por bodega origen (si aplica)
  function getSerialDisp(catalogo_id, origen_tipo, origen) {
    return hwEquipos.filter(e => {
      if (e.catalogo_id !== Number(catalogo_id) || e.estado !== 'en_bodega') return false
      if (origen_tipo === 'bodega' && origen) return e.ubicacion_actual === origen
      return true
    })
  }

  // Ajustar array de seriales cuando cambia la cantidad
  function setCantidad(n) {
    const raw = Number(n) || 1
    setForm(p => {
      const enBodega = modalTipo === 'SALIDA' && p.catalogo_id
        ? getSerialDisp(p.catalogo_id, p.origen_tipo, p.origen).length
        : 50
      if (modalTipo === 'SALIDA' && raw > enBodega) {
        showToast(`Máximo ${enBodega} unidad(es) disponible(s) en la bodega seleccionada`, 'err')
      }
      const qty = Math.max(1, Math.min(enBodega || 1, raw))
      const arr = [...(p.seriales || [])]
      while (arr.length < qty) arr.push('')
      return { ...p, cantidad: qty, seriales: arr.slice(0, qty) }
    })
  }

  function setSerial(i, val) {
    setForm(p => {
      const arr = [...p.seriales]
      arr[i] = val
      return { ...p, seriales: arr }
    })
  }

  function getOpciones(tipoLugar) {
    if (tipoLugar === 'nokia')  return hwBodegasNokia.filter(b => b.activo !== false).map(b => b.nombre)
    if (tipoLugar === 'bodega') return bodegas.map(b => b.nombre)
    if (tipoLugar === 'sitio')  return liquidadorSitios.filter(s => s.nombre).map(s => s.nombre).sort()
    if (tipoLugar === 'ss')     return hwServiceSuppliers.filter(s => s.activo !== false).map(s => s.nombre)
    return []
  }

  async function handleSave() {
    if (!form.catalogo_id) { showToast('Selecciona el tipo de equipo', 'err'); return }
    if (!form.origen)      { showToast('Indica el origen', 'err'); return }
    if (!form.destino)     { showToast('Indica el destino', 'err'); return }

    const seriales = form.seriales.map(s => s.trim()).filter(Boolean)
    if (seriales.length === 0) { showToast('Ingresa al menos un serial', 'err'); return }

    // Validación de stock para SALIDA (filtrado por bodega origen)
    if (modalTipo === 'SALIDA') {
      const enBodega = getSerialDisp(form.catalogo_id, form.origen_tipo, form.origen)
      if (seriales.length > enBodega.length) {
        const bodegaLabel = form.origen_tipo === 'bodega' && form.origen ? ` en ${form.origen}` : ''
        showToast(`Stock insuficiente${bodegaLabel}. Disponible: ${enBodega.length} unidad(es)`, 'err'); return
      }
      const serialesNoDisp = seriales.filter(s => !enBodega.some(e => e.serial === s))
      if (serialesNoDisp.length > 0) {
        showToast(`Serial(es) no disponible(s): ${serialesNoDisp.join(', ')}`, 'err'); return
      }
    }

    setSaving(true)
    try {
      for (const serial of seriales) {
        const nuevoEstado = modalTipo === 'ENTRADA'
          ? (form.destino_tipo === 'bodega' ? 'en_bodega' : form.destino_tipo === 'sitio' ? 'en_sitio' : 'en_transito')
          : (form.destino_tipo === 'nokia' ? 'retornado_nokia' : form.destino_tipo === 'ss' ? 'retornado_ss' : form.destino_tipo === 'sitio' ? 'en_sitio' : 'en_transito')

        let equipo = hwEquipos.find(e => e.serial === serial)
        if (!equipo) {
          equipo = await addHwEquipo({
            catalogo_id:         Number(form.catalogo_id),
            serial,
            estado:              nuevoEstado,
            ubicacion_actual:    form.destino,
            condicion:           form.condicion,
            log_inv_tipo_unidad: form.log_inv_tipo_unidad || null,
            notas:               form.notas || null,
          })
        } else {
          await updateHwEquipo(equipo.id, { estado: nuevoEstado, ubicacion_actual: form.destino })
        }

        await addHwMovimiento({
          equipo_id:           equipo.id,
          serial,
          catalogo_id:         Number(form.catalogo_id),
          tipo:                modalTipo,
          tipo_fuente:         'MANUAL',
          so:                  form.so || null,
          smp_id:              form.smp_id || null,
          fecha:               form.fecha,
          origen:              form.origen,
          origen_tipo:         form.origen_tipo,
          destino:             form.destino,
          destino_tipo:        form.destino_tipo,
          log_inv_tipo_unidad: form.log_inv_tipo_unidad || null,
          created_by:          user?.nombre || user?.email,
          notas:               form.notas || null,
        })
      }
      showToast(`${seriales.length} equipo(s) registrado(s)`)
      setModalTipo(null)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleDelete(m) {
    const ok = await confirm('Eliminar movimiento', `¿Eliminar movimiento del serial "${m.serial}"?`)
    if (!ok) return
    try { await deleteHwMovimiento(m.id); showToast('Movimiento eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return hwMovimientos.filter(m => {
      if (filTipo && m.tipo !== filTipo) return false
      if (filDate && !m.fecha?.startsWith(filDate)) return false
      if (q && !`${m.serial} ${m.so || ''} ${m.origen || ''} ${m.destino || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [hwMovimientos, search, filTipo, filDate])

  const accentColor = modalTipo === 'ENTRADA' ? '#1a9c1a' : '#c0392b'

  return (
    <div>
      <ConfirmModalUI />

      <div className="card" style={{ marginBottom:14 }}>
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Movimientos HW Nokia ({rows.length})</h2>
          {canEdit && (
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ background:'#1a6130', color:'#fff', fontSize:11, fontWeight:700, padding:'5px 14px', borderRadius:6, cursor:'pointer', border:'none' }}
                onClick={() => openModal('ENTRADA')}>+ Entrada</button>
              <button style={{ background:'#c0392b', color:'#fff', fontSize:11, fontWeight:700, padding:'5px 14px', borderRadius:6, cursor:'pointer', border:'none' }}
                onClick={() => openModal('SALIDA')}>+ Salida</button>
            </div>
          )}
        </div>
        <div className="card-b">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input className="fc" placeholder="Buscar serial, SO, origen, destino…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:200 }} />
            <input type="date" className="fc" value={filDate}
              onChange={e => setFilDate(e.target.value)} style={{ maxWidth:150 }} />
            <select className="fc" value={filTipo} onChange={e => setFilTipo(e.target.value)} style={{ maxWidth:130 }}>
              <option value="">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SALIDA">Salidas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-b" style={{ padding:0, overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr>
              <th>Fecha</th><th>Tipo</th><th>Serial</th><th>Equipo</th>
              <th>Origen</th><th>Destino</th><th>SO / Doc</th><th>SMP ID</th>
              {canDelete && <th></th>}
            </tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>Sin movimientos registrados</td></tr>
              )}
              {rows.map(m => {
                const cat = hwCatalogo.find(c => c.id === m.catalogo_id)
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize:10, whiteSpace:'nowrap', color:'#0a0a0a' }}>{m.fecha}</td>
                    <td>
                      <span style={{ fontWeight:700, fontSize:10, color: m.tipo==='ENTRADA'?'#1a6130':'#c0392b' }}>{m.tipo}</span>
                    </td>
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12, color:'#144E4A' }}>{m.serial}</td>
                    <td style={{ fontSize:10, maxWidth:160 }}>{cat?.descripcion || '—'}</td>
                    <td style={{ fontSize:10 }}>
                      <span style={{ color:'#9ca89c', fontSize:9, textTransform:'uppercase', marginRight:3 }}>{m.origen_tipo}</span>
                      {m.origen}
                    </td>
                    <td style={{ fontSize:10, fontWeight:600 }}>
                      <span style={{ color:'#9ca89c', fontSize:9, textTransform:'uppercase', marginRight:3 }}>{m.destino_tipo}</span>
                      {m.destino}
                    </td>
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700 }}>{m.so || '—'}</td>
                    <td style={{ fontSize:10, color:'#9ca89c' }}>{m.smp_id || '—'}</td>
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

      {/* ── Modal Entrada / Salida ── */}
      {modalTipo && form && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:580, maxHeight:'94vh', overflowY:'auto' }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 18px', display:'flex', justifyContent:'space-between', alignItems:'center',
              borderBottom:`3px solid ${accentColor}`, borderRadius:'12px 12px 0 0', position:'sticky', top:0, zIndex:10 }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, letterSpacing:1 }}>
                {modalTipo === 'ENTRADA' ? 'REGISTRAR ENTRADA HW' : 'REGISTRAR SALIDA HW'}
              </span>
              <button onClick={() => setModalTipo(null)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:22, cursor:'pointer' }}>×</button>
            </div>

            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>

              {/* Documento y fecha */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Nº Documento (SO)</label>
                  <input className="fc" value={form.so} onChange={e => setForm(p => ({ ...p, so: e.target.value }))} />
                </div>
                <div>
                  <label className="fl">Fecha</label>
                  <input type="date" className="fc" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="fl">SMP ID / Work Order</label>
                <input className="fc" placeholder="SMP-WO-0082828 (opcional)" value={form.smp_id}
                  onChange={e => setForm(p => ({ ...p, smp_id: e.target.value }))} />
              </div>

              {/* Tipo de equipo — buscable */}
              <div>
                <label className="fl">Tipo de Equipo *</label>
                <SearchableEquipo
                  value={form.catalogo_id}
                  onChange={v => setForm(p => ({ ...p, catalogo_id: v }))}
                  options={hwCatalogo.filter(c => c.activo !== false)}
                />
              </div>

              {/* Cantidad + Seriales individuales */}
              {(() => {
                // Seriales disponibles para el tipo seleccionado, filtrados por bodega origen
                const serialesDisp = modalTipo === 'SALIDA' && form.catalogo_id
                  ? getSerialDisp(form.catalogo_id, form.origen_tipo, form.origen).map(e => e.serial)
                  : []
                const stockDisp = serialesDisp.length

                return (
                  <div style={{ border:`1px solid ${modalTipo==='SALIDA' && form.catalogo_id && stockDisp===0 ? '#fca5a5' : '#e0e4e0'}`, borderRadius:6, padding:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                      <label className="fl" style={{ marginBottom:0 }}>Cantidad de equipos *</label>
                      <input
                        type="number" min={1} max={modalTipo==='SALIDA' ? stockDisp || 1 : 50} className="fc"
                        value={form.cantidad}
                        onChange={e => setCantidad(e.target.value)}
                        style={{ width:80, textAlign:'center', fontWeight:700 }}
                      />
                      {modalTipo === 'SALIDA' && form.catalogo_id && (
                        <span style={{ fontSize:10, fontWeight:700, color: stockDisp===0?'#c0392b':'#1a6130' }}>
                          {stockDisp === 0 ? 'Sin stock disponible' : `${stockDisp} disponible(s) en bodega`}
                        </span>
                      )}
                    </div>
                    {/* Desglose por bodega */}
                    {modalTipo === 'SALIDA' && form.catalogo_id && (() => {
                      const grupos = {}
                      serialesDisp.forEach(ser => {
                        const eq = hwEquipos.find(e => e.serial === ser && e.estado === 'en_bodega')
                        const bod = eq?.ubicacion_actual || '(sin bodega)'
                        grupos[bod] = (grupos[bod] || 0) + 1
                      })
                      const entradas = Object.entries(grupos)
                      if (entradas.length === 0) return null
                      return (
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                          {entradas.map(([bod, cnt]) => (
                            <span key={bod} style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:12,
                              background:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe' }}>
                              {bod}: {cnt} ud.
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {form.seriales.map((s, i) => {
                        // SALIDA: dropdown con seriales disponibles (excluir los ya elegidos en otros campos)
                        const elegidos = form.seriales.filter((x, j) => j !== i && x)
                        const opciones = serialesDisp.filter(ser => !elegidos.includes(ser))
                        return (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:10, color:'#9ca89c', fontWeight:700, minWidth:60, fontFamily:"'Barlow Condensed',sans-serif" }}>
                              Serial {i + 1}
                            </span>
                            {modalTipo === 'SALIDA' && form.catalogo_id ? (
                              <select className="fc" value={s}
                                onChange={e => setSerial(i, e.target.value)}
                                style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:600 }}>
                                <option value="">— Seleccionar serial —</option>
                                {opciones.map(ser => (
                                  <option key={ser} value={ser}>{ser}</option>
                                ))}
                              </select>
                            ) : (
                              <input className="fc" placeholder={`Serial ${i + 1}`} value={s}
                                onChange={e => setSerial(i, e.target.value)}
                                style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:600 }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ fontSize:10, color: accentColor, fontWeight:600, marginTop:6 }}>
                      {form.seriales.filter(s => s.trim()).length} de {form.cantidad} serial(es) ingresado(s)
                    </div>
                  </div>
                )
              })()}

              {/* Origen */}
              <LugarField label="Origen *" tipoKey="origen_tipo" nombreKey="origen"
                form={form} setForm={setForm} getOpciones={getOpciones} />

              {/* Destino */}
              <LugarField label="Destino *" tipoKey="destino_tipo" nombreKey="destino"
                form={form} setForm={setForm} getOpciones={getOpciones} />

              {/* Condición + Tipo Unidad */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="fl">Condición</label>
                  <select className="fc" value={form.condicion} onChange={e => setForm(p => ({ ...p, condicion: e.target.value }))}>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="dañado">Dañado</option>
                  </select>
                </div>
                <div>
                  <label className="fl">Tipo Unidad (LOG_INV)</label>
                  <select className="fc" value={form.log_inv_tipo_unidad}
                    onChange={e => setForm(p => ({ ...p, log_inv_tipo_unidad: e.target.value }))}>
                    <option value="">— Ninguno —</option>
                    {hwTipoUnidades.filter(t => t.activo !== false).map(t => (
                      <option key={t.id} value={t.nombre}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="fl">Notas</label>
                <input className="fc" placeholder="Opcional" value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button className="btn bou" onClick={() => setModalTipo(null)}>Cancelar</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: accentColor, color:'#fff', padding:'6px 22px', borderRadius:6, fontWeight:700, fontSize:12, cursor:'pointer', border:'none' }}>
                  {saving ? 'Guardando…' : `Registrar ${modalTipo === 'ENTRADA' ? 'Entrada' : 'Salida'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
