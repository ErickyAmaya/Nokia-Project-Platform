import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useHwStore } from '../../store/useHwStore'
import { useAuthStore } from '../../store/authStore'
import { useMatStore } from '../../store/useMatStore'
import { useAppStore } from '../../store/useAppStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'
import HwDespachoModal from '../../components/materiales/HwDespachoModal'

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
  const bodegaPrincipal = tipo === 'SALIDA' ? (localStorage.getItem('hw_bodega_principal') || '') : ''
  return {
    so:                nextHwDoc(movimientos, tipo),
    smp_id:            '',
    fecha:             new Date().toISOString().slice(0,10),
    catalogo_id:       '',
    cantidad:          1,
    seriales:          [''],
    serialBodegas:     [bodegaPrincipal],   // bodega por cada slot de serial
    sinSerial:         false,              // modo sin-serial: cantidad libre, sin hw_equipos
    origen:            bodegaPrincipal,
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
  const deleteHwEquipo     = useHwStore(s => s.deleteHwEquipo)
  const deleteHwMovimiento = useHwStore(s => s.deleteHwMovimiento)
  const loadAll            = useHwStore(s => s.loadAll)
  const bodegas            = useMatStore(s => s.bodegas)
  const matSitios          = useMatStore(s => s.sitios)
  const saveSitio          = useMatStore(s => s.saveSitio)
  const liquidadorSitios   = useAppStore(s => s.sitios ?? [])
  const user               = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const [modalTipo,    setModalTipo]    = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [search,       setSearch]       = useState('')
  const [filTipo,      setFilTipo]      = useState('')
  const [filDate,      setFilDate]      = useState('')
  const [form,         setForm]         = useState(null)
  const [altModal,     setAltModal]     = useState(null)
  const [despachoOpen, setDespachoOpen] = useState(false) // { requestedQty, currentBodega, currentStock, alternatives }
  const prevOrigenRef = useRef(null)

  const navigate     = useNavigate()
  const location     = useLocation()
  const returnToRef  = useRef(null)
  const canEdit   = ['admin','logistica'].includes(user?.role)
  const canDelete = ['admin'].includes(user?.role)

  useEffect(() => { loadAll() }, [])

  // Auto-abrir modal si viene desde Inventario HW
  useEffect(() => {
    const tipo = location.state?.openModal
    if (tipo === 'ENTRADA' || tipo === 'SALIDA') {
      returnToRef.current = location.state?.returnTo || null
      setForm(emptyForm(tipo, hwMovimientos))
      setModalTipo(tipo)
      window.history.replaceState({}, '')
    }
  }, [location.state?.openModal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar bodega origen: resetear seriales/serialBodegas y ajustar cantidad al nuevo stock
  useEffect(() => {
    if (modalTipo !== 'SALIDA' || !form) return
    const curr = form.origen
    if (prevOrigenRef.current !== null && prevOrigenRef.current !== curr) {
      setForm(p => {
        if (!p) return p
        const newStock = hwEquipos.filter(e =>
          e.catalogo_id === Number(p.catalogo_id) &&
          e.estado === 'en_bodega' &&
          (p.origen_tipo !== 'bodega' || !curr || e.ubicacion_actual === curr)
        ).length
        const newQty = newStock > 0 ? Math.min(p.cantidad, newStock) : p.cantidad
        return {
          ...p,
          cantidad: newQty,
          seriales: Array(newQty).fill(''),
          serialBodegas: Array(newQty).fill(curr || ''),
        }
      })
    }
    prevOrigenRef.current = curr
  }, [form?.origen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar tipo de equipo: auto-detectar si aplica serial
  useEffect(() => {
    if (!form || !form.catalogo_id) return
    const cat = hwCatalogo.find(c => String(c.id) === String(form.catalogo_id))
    if (!cat) return
    const sinSer = cat.aplica_serial === false
    if (form.sinSerial !== sinSer) {
      setForm(p => p ? ({
        ...p,
        sinSerial:     sinSer,
        seriales:      sinSer ? [] : [''],
        serialBodegas: sinSer ? [] : [p.origen || ''],
        cantidad:      sinSer ? (p.cantidad || 1) : 1,
      }) : p)
    }
  }, [form?.catalogo_id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // Stock total en todas las bodegas (techo absoluto)
      const stockTodo = modalTipo === 'SALIDA' && p.catalogo_id
        ? hwEquipos.filter(e => e.catalogo_id === Number(p.catalogo_id) && e.estado === 'en_bodega').length
        : 50

      // Cap absoluto: no superar el total disponible
      if (modalTipo === 'SALIDA' && p.catalogo_id && raw > stockTodo) {
        showToast(`Máximo ${stockTodo} unidad(es) disponibles en total`, 'err')
        const qty = Math.max(1, stockTodo || 1)
        const bods = [...(p.serialBodegas || [])]
        const arr  = [...(p.seriales || [])]
        while (arr.length < qty)  { arr.push('');  bods.push(p.origen || '') }
        return { ...p, cantidad: qty, seriales: arr.slice(0, qty), serialBodegas: bods.slice(0, qty) }
      }

      // Stock solo en la bodega seleccionada como origen
      const stockActual = modalTipo === 'SALIDA' && p.catalogo_id && p.origen_tipo === 'bodega'
        ? getSerialDisp(p.catalogo_id, p.origen_tipo, p.origen).length
        : stockTodo

      // Si supera el stock de la bodega actual → buscar alternativas
      if (modalTipo === 'SALIDA' && p.catalogo_id && p.origen_tipo === 'bodega' && p.origen && raw > stockActual) {
        const alts = bodegas
          .map(b => b.nombre)
          .filter(bn => bn !== p.origen)
          .map(bn => ({
            bodega: bn,
            stock: hwEquipos.filter(e =>
              e.catalogo_id === Number(p.catalogo_id) &&
              e.estado === 'en_bodega' &&
              e.ubicacion_actual === bn
            ).length,
          }))
          .filter(a => a.stock > 0)

        if (alts.length > 0) {
          setAltModal({ requestedQty: raw, currentBodega: p.origen, currentStock: stockActual, alternatives: alts })
          return p   // no modificar el form todavía
        }

        // Sin alternativas: cap en stock actual
        showToast(`Máximo ${stockActual} unidad(es) en ${p.origen}`, 'err')
        const qty = Math.max(1, stockActual || 1)
        const bods = [...(p.serialBodegas || [])]
        const arr  = [...(p.seriales || [])]
        while (arr.length < qty)  { arr.push('');  bods.push(p.origen || '') }
        return { ...p, cantidad: qty, seriales: arr.slice(0, qty), serialBodegas: bods.slice(0, qty) }
      }

      // Ajuste normal de cantidad
      const qty = Math.max(1, Math.min(stockTodo || 50, raw))
      const bods = [...(p.serialBodegas || [])]
      const arr  = [...(p.seriales || [])]
      while (arr.length < qty)  { arr.push('');  bods.push(p.origen || '') }
      return { ...p, cantidad: qty, seriales: arr.slice(0, qty), serialBodegas: bods.slice(0, qty) }
    })
  }

  // Confirmar alt-bodega: mantener slots de la bodega actual + agregar slots de la alternativa
  function handleAltAdd(altBodega, altStock) {
    const fromCurrent = altModal.currentStock
    const fromAlt     = Math.min(altModal.requestedQty - fromCurrent, altStock)
    setForm(p => ({
      ...p,
      cantidad:      fromCurrent + fromAlt,
      seriales:      [...Array(fromCurrent).fill(''), ...Array(fromAlt).fill('')],
      serialBodegas: [...Array(fromCurrent).fill(altModal.currentBodega), ...Array(fromAlt).fill(altBodega)],
    }))
    setAltModal(null)
  }

  function handleAltKeepCurrent() {
    const qty = Math.max(1, altModal.currentStock)
    setForm(p => ({
      ...p,
      cantidad:      qty,
      seriales:      Array(qty).fill(''),
      serialBodegas: Array(qty).fill(altModal.currentBodega || p.origen || ''),
    }))
    setAltModal(null)
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

    // ── Modo sin serial: un solo movimiento con cantidad ──────────────
    if (form.sinSerial) {
      if (!form.cantidad || form.cantidad < 1) { showToast('Indica la cantidad', 'err'); return }
      setSaving(true)
      try {
        await addHwMovimiento({
          equipo_id:           null,
          serial:              null,
          catalogo_id:         Number(form.catalogo_id),
          tipo:                modalTipo,
          tipo_fuente:         'MANUAL',
          so:                  form.so || null,
          smp_id:              form.smp_id || null,
          fecha:               form.fecha,
          cantidad:            Number(form.cantidad),
          origen:              form.origen,
          origen_tipo:         form.origen_tipo,
          destino:             form.destino,
          destino_tipo:        form.destino_tipo,
          log_inv_tipo_unidad: form.log_inv_tipo_unidad || null,
          created_by:          user?.nombre || user?.email,
          notas:               form.notas || null,
        })
        // Auto-crear sitio en mat_sitios si destino es sitio nuevo
        if (modalTipo === 'SALIDA' && form.destino_tipo === 'sitio' && form.destino) {
          const existe = matSitios.some(s => s.nombre?.toLowerCase() === form.destino.toLowerCase())
          if (!existe) await saveSitio({ nombre: form.destino, regional: '', activo: true }).catch(() => {})
        }
        showToast(`${form.cantidad} unidad(es) registrada(s) sin serial`)
        setModalTipo(null)
        if (returnToRef.current) { navigate(returnToRef.current); returnToRef.current = null }
      } catch (e) { showToast('Error: ' + e.message, 'err') }
      finally { setSaving(false) }
      return
    }

    const seriales = form.seriales.map(s => s.trim()).filter(Boolean)
    if (seriales.length === 0) { showToast('Ingresa al menos un serial', 'err'); return }

    // Validación de stock para SALIDA — por bodega (soporta multi-bodega)
    if (modalTipo === 'SALIDA') {
      const byBodega = {}
      seriales.forEach((s, i) => {
        const bod = form.serialBodegas?.[i] || form.origen
        if (!byBodega[bod]) byBodega[bod] = []
        byBodega[bod].push(s)
      })
      for (const [bod, sers] of Object.entries(byBodega)) {
        const enBodega = hwEquipos.filter(e =>
          e.catalogo_id === Number(form.catalogo_id) &&
          e.estado === 'en_bodega' &&
          e.ubicacion_actual === bod
        )
        if (sers.length > enBodega.length) {
          showToast(`Stock insuficiente en ${bod}: ${enBodega.length} disponible(s)`, 'err'); return
        }
        const noDisp = sers.filter(s => !enBodega.some(e => e.serial === s))
        if (noDisp.length > 0) {
          showToast(`Serial(es) no disponible(s) en ${bod}: ${noDisp.join(', ')}`, 'err'); return
        }
      }
    }

    setSaving(true)
    try {
      for (let idx = 0; idx < seriales.length; idx++) {
        const serial       = seriales[idx]
        const origenSerial = form.serialBodegas?.[idx] || form.origen   // bodega por slot

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
          cantidad:            1,
          origen:              origenSerial,
          origen_tipo:         form.origen_tipo,
          destino:             form.destino,
          destino_tipo:        form.destino_tipo,
          log_inv_tipo_unidad: form.log_inv_tipo_unidad || null,
          created_by:          user?.nombre || user?.email,
          notas:               form.notas || null,
        })
      }
      // Auto-crear sitio en mat_sitios si destino es sitio nuevo
      if (modalTipo === 'SALIDA' && form.destino_tipo === 'sitio' && form.destino) {
        const existe = matSitios.some(s => s.nombre?.toLowerCase() === form.destino.toLowerCase())
        if (!existe) await saveSitio({ nombre: form.destino, regional: '', activo: true }).catch(() => {})
      }
      showToast(`${seriales.length} equipo(s) registrado(s)`)
      setModalTipo(null)
      if (returnToRef.current) { navigate(returnToRef.current); returnToRef.current = null }
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleDelete(m) {
    const label = m.serial ? `serial "${m.serial}"` : `${m.cantidad || 1} ud. sin serial`
    const ok = await confirm('Eliminar movimiento', `¿Eliminar movimiento de ${label}?`)
    if (!ok) return
    try {
      if (m.tipo === 'SALIDA' && m.serial) {
        // Retornar equipo a la bodega origen
        const equipo = hwEquipos.find(e => e.serial === m.serial)
        if (equipo) await updateHwEquipo(equipo.id, { estado: 'en_bodega', ubicacion_actual: m.origen })
      }
      if (m.tipo === 'ENTRADA' && m.serial) {
        // Eliminar el registro del equipo (si no tiene otros movimientos)
        const equipo = hwEquipos.find(e => e.serial === m.serial)
        if (equipo) {
          const otrosMov = hwMovimientos.filter(mv => mv.serial === m.serial && mv.id !== m.id)
          if (otrosMov.length === 0) {
            await deleteHwEquipo(equipo.id)
          } else {
            showToast('El equipo tiene movimientos posteriores; solo se eliminó la entrada.', 'warn')
          }
        }
      }
      await deleteHwMovimiento(m.id)
      showToast('Movimiento eliminado')
    }
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
      {despachoOpen && <HwDespachoModal onClose={() => setDespachoOpen(false)} />}

      <div className="card" style={{ marginBottom:14 }}>
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Movimientos HW Nokia ({rows.length})</h2>
          {canEdit && (
            <button className="btn bp btn-sm" onClick={() => setDespachoOpen(true)}>
              + Nuevo Despacho
            </button>
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
              <th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Serial</th><th>Equipo</th>
              <th>Origen</th><th>Destino</th><th>SO / Doc</th>
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
                    <td style={{ textAlign:'center', fontWeight:700, fontSize:12 }}>{m.cantidad ?? 1}</td>
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12, color:'#144E4A' }}>
                      {m.serial || <span style={{ color:'#9ca89c', fontSize:9 }}>sin serial</span>}
                    </td>
                    <td style={{ fontSize:10, maxWidth:160 }}>{cat?.descripcion || '—'}</td>
                    <td style={{ fontSize:10 }}>
                      <span style={{ color:'#9ca89c', fontSize:9, textTransform:'uppercase', marginRight:3 }}>{m.origen_tipo}</span>
                      {m.origen}
                    </td>
                    <td style={{ fontSize:10, fontWeight:600 }}>
                      <span style={{ color:'#9ca89c', fontSize:9, textTransform:'uppercase', marginRight:3 }}>{m.destino_tipo}</span>
                      {m.destino_tipo === 'sitio' && m.destino ? (
                        <button
                          onClick={() => navigate('/materiales/sitios', { state: { search: m.destino } })}
                          style={{ background:'none', border:'none', padding:0, color:'#1e40af', fontWeight:700, fontSize:10, cursor:'pointer', textDecoration:'underline' }}>
                          {m.destino}
                        </button>
                      ) : m.destino}
                    </td>
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700 }}>{m.so || '—'}</td>
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

      {/* ── Mini-modal: bodega alternativa ── */}
      {altModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:10, width:'100%', maxWidth:380, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ background:'#0a0a0a', color:'#fff', padding:'10px 16px', borderRadius:'10px 10px 0 0', borderBottom:'3px solid #ea580c', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, letterSpacing:.5 }}>
                Stock insuficiente · {altModal.currentBodega || 'Bodega actual'}
              </span>
              <button onClick={() => setAltModal(null)} style={{ background:'none', border:'none', color:'#9ca89c', fontSize:18, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:16 }}>
              <p style={{ fontSize:12, color:'#555f55', marginBottom:12, lineHeight:1.6 }}>
                En <b>{altModal.currentBodega}</b> solo hay{' '}
                <b style={{ color:'#c0392b' }}>{altModal.currentStock}</b> unidad(es) disponible(s){' '}
                de las <b>{altModal.requestedQty}</b> solicitadas.
              </p>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:.5, textTransform:'uppercase', color:'#9ca89c', marginBottom:8 }}>
                Disponible en otras bodegas
              </div>
              {altModal.alternatives.map(alt => (
                <div key={alt.bodega} style={{ border:'1.5px solid #dbeafe', borderRadius:8, padding:'10px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#1e40af' }}>📦 {alt.bodega}</div>
                    <div style={{ fontSize:10, color:'#9ca89c' }}>{alt.stock} unidad(es) disponible(s)</div>
                  </div>
                  <button onClick={() => handleAltAdd(alt.bodega, alt.stock)}
                    style={{ background:'#1e40af', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    Sacar {Math.min(altModal.requestedQty - altModal.currentStock, alt.stock)} de aquí
                  </button>
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end', flexWrap:'wrap' }}>
                {altModal.currentStock > 0 && (
                  <button onClick={handleAltKeepCurrent}
                    style={{ padding:'6px 12px', fontSize:11, fontWeight:700, borderRadius:6, border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>
                    Sacar solo {altModal.currentStock} de {altModal.currentBodega}
                  </button>
                )}
                <button onClick={() => setAltModal(null)}
                  style={{ padding:'6px 12px', fontSize:11, fontWeight:700, borderRadius:6, border:'none', background:'#f0f2f0', color:'#555f55', cursor:'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                // Total de seriales disponibles en TODAS las bodegas (techo para la cantidad)
                const todosDisp = modalTipo === 'SALIDA' && form.catalogo_id
                  ? hwEquipos.filter(e => e.catalogo_id === Number(form.catalogo_id) && e.estado === 'en_bodega')
                  : []
                const stockTotal = todosDisp.length

                // Desglose por bodega para los badges informativos
                const gruposBodega = {}
                todosDisp.forEach(e => {
                  const bod = e.ubicacion_actual || '(sin bodega)'
                  gruposBodega[bod] = (gruposBodega[bod] || 0) + 1
                })

                // Sin serial: solo mostrar campo cantidad sin restricciones de stock
                if (form.sinSerial) {
                  return (
                    <div style={{ border:'1px solid #e0e4e0', borderRadius:6, padding:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <label className="fl" style={{ marginBottom:0 }}>Cantidad *</label>
                        <input
                          type="number" min={1} className="fc"
                          value={form.cantidad}
                          onChange={e => setForm(p => ({ ...p, cantidad: Math.max(1, Number(e.target.value) || 1) }))}
                          style={{ width:100, textAlign:'center', fontWeight:700 }}
                        />
                        <span style={{ fontSize:10, color:'#9ca89c' }}>unidad(es) sin serial</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div style={{ border:`1px solid ${modalTipo==='SALIDA' && form.catalogo_id && stockTotal===0 ? '#fca5a5' : '#e0e4e0'}`, borderRadius:6, padding:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                      <label className="fl" style={{ marginBottom:0 }}>Cantidad de equipos *</label>
                      <input
                        type="number" min={1} max={modalTipo==='SALIDA' ? stockTotal || 1 : 50} className="fc"
                        value={form.cantidad}
                        onChange={e => setCantidad(e.target.value)}
                        style={{ width:80, textAlign:'center', fontWeight:700 }}
                      />
                      {modalTipo === 'SALIDA' && form.catalogo_id && (
                        <span style={{ fontSize:10, fontWeight:700, color: stockTotal===0?'#c0392b':'#1a6130' }}>
                          {stockTotal === 0 ? 'Sin stock disponible' : `${stockTotal} disponible(s) en total`}
                        </span>
                      )}
                    </div>
                    {/* Desglose por bodega */}
                    {modalTipo === 'SALIDA' && form.catalogo_id && Object.keys(gruposBodega).length > 0 && (
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                        {Object.entries(gruposBodega).map(([bod, cnt]) => (
                          <span key={bod} style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:12,
                            background:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe' }}>
                            {bod}: {cnt} ud.
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {form.seriales.map((s, i) => {
                        const slotBodega = form.serialBodegas?.[i] || form.origen
                        // Seriales disponibles en la bodega de este slot
                        const elegidosEnSlot = form.seriales.filter((x, j) =>
                          j !== i && x && (form.serialBodegas?.[j] || form.origen) === slotBodega
                        )
                        const opcionesSlot = todosDisp
                          .filter(e => e.ubicacion_actual === slotBodega && !elegidosEnSlot.includes(e.serial))
                          .map(e => e.serial)

                        return (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:10, color:'#9ca89c', fontWeight:700, minWidth:60, fontFamily:"'Barlow Condensed',sans-serif" }}>
                              Serial {i + 1}
                            </span>
                            {modalTipo === 'SALIDA' && form.catalogo_id ? (
                              <select className="fc" value={s}
                                onChange={e => setSerial(i, e.target.value)}
                                style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:600, flex:1 }}>
                                <option value="">— Seleccionar serial —</option>
                                {opcionesSlot.map(ser => (
                                  <option key={ser} value={ser}>{ser}</option>
                                ))}
                              </select>
                            ) : (
                              <input className="fc" placeholder={`Serial ${i + 1}`} value={s}
                                onChange={e => setSerial(i, e.target.value)}
                                style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:600, flex:1 }} />
                            )}
                            {/* Badge de bodega — solo en SALIDA cuando hay multi-bodega */}
                            {modalTipo === 'SALIDA' && slotBodega && (
                              <span style={{ fontSize:9, fontWeight:700, whiteSpace:'nowrap', padding:'2px 7px',
                                borderRadius:10, background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0' }}>
                                {slotBodega}
                              </span>
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
                <button className="btn" onClick={handleSave} disabled={saving}
                  style={{ background: accentColor, color:'#fff', border:'none', opacity: saving ? .7 : 1 }}>
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
