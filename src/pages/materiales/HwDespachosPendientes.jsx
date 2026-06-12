import { useState, useMemo, useEffect, useRef } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useMatStore } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { can } from '../../config/permissions'
import { useAppStore } from '../../store/useAppStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

const ACENTO = '#1e3a5f'

// Retorna [{so, serial, equipo_id, created_at}] ordenados por antigüedad (más antiguo primero)
function getSosDisponibles(hwEquipos, _hwMovimientos, catalogoId, bodega = null, excludeSerials = []) {
  return hwEquipos
    .filter(e =>
      Number(e.catalogo_id) === Number(catalogoId) &&
      e.estado === 'en_bodega' &&
      (!bodega || !e.ubicacion_actual || e.ubicacion_actual === bodega) &&
      !excludeSerials.includes(e.serial)
    )
    .map(e => ({ so: e.so || e.serial, serial: e.serial, equipo_id: e.id, bodega: e.ubicacion_actual || '', created_at: e.created_at || '' }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

// ── Badge de estado ──────────────────────────────────────────────
function Badge({ label, bg, color }) {
  return (
    <span style={{ background: bg, color, borderRadius: 4, padding: '2px 7px',
      fontSize: 10, fontWeight: 700, letterSpacing: .4 }}>
      {label}
    </span>
  )
}

const eqBod = (a, b) => !a || !b || a.trim().toLowerCase() === b.trim().toLowerCase()

function getSinSerialFifo(hwMovimientos, catalogoId, bodega, cantidad) {
  const id = Number(catalogoId)

  const entradas = hwMovimientos
    .filter(m =>
      Number(m.catalogo_id) === id && !m.serial &&
      m.tipo === 'ENTRADA' && eqBod(m.destino, bodega) &&
      (!m.destino_tipo || m.destino_tipo === 'bodega')
    )
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))

  const totalSalidas = hwMovimientos
    .filter(m =>
      Number(m.catalogo_id) === id && !m.serial &&
      m.tipo === 'SALIDA' && eqBod(m.origen, bodega) &&
      (!m.origen_tipo || m.origen_tipo === 'bodega')
    )
    .reduce((s, m) => s + (m.cantidad || 0), 0)

  const pool = []
  for (const e of entradas) {
    for (let i = 0; i < (e.cantidad || 1); i++) pool.push(e.so || null)
  }

  const taken = pool.slice(totalSalidas, totalSalidas + cantidad)
  const grouped = {}
  for (const so of taken) {
    const key = so || ''
    grouped[key] = (grouped[key] || 0) + 1
  }
  return Object.entries(grouped).map(([so, cnt]) => ({ so: so || null, cantidad: cnt }))
}

// ── Modal de agregar ítem ────────────────────────────────────────
function AgregarItemModal({ despachoId, bodega, onClose }) {
  const hwCatalogo  = useHwStore(s => s.hwCatalogo)
  const hwEquipos   = useHwStore(s => s.hwEquipos)
  const agregarItem = useHwStore(s => s.agregarItemDespacho)

  const [selCat,   setSelCat]   = useState('')
  const [soSels,   setSoSels]   = useState([{ so: '', serial: null }])
  const [saving,   setSaving]   = useState(false)
  const [query,    setQuery]    = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [dropPos,  setDropPos]  = useState(null)
  const dropAnchorRef = useRef(null)

  const catFiltradas = useMemo(() => {
    const q = query.toLowerCase()
    return hwCatalogo.filter(c => c.activo !== false &&
      (c.descripcion.toLowerCase().includes(q) || (c.cod_material || '').toLowerCase().includes(q))
    )
  }, [hwCatalogo, query])

  const catSel = hwCatalogo.find(c => String(c.id) === String(selCat))

  const disponibles = useMemo(() => {
    if (!catSel) return []
    return getSosDisponibles(hwEquipos, catSel.id, bodega || null)
  }, [catSel, hwEquipos, bodega])

  function autoFill(current, avail) {
    const taken = new Set(current.map(s => s.so).filter(Boolean))
    const pool  = avail.filter(d => !taken.has(d.so))
    let pi = 0
    return current.map(s => s.so ? s : (pi < pool.length ? { so: pool[pi].so, serial: pool[pi++].serial } : { so: '', serial: null }))
  }

  function handleCant(val) {
    const n = Math.max(1, Math.min(val, disponibles.length || 99))
    setSoSels(prev => {
      const arr = [...prev]
      while (arr.length < n) arr.push({ so: '', serial: null })
      return autoFill(arr.slice(0, n), disponibles)
    })
  }

  function selectCat(c) {
    setSelCat(String(c.id))
    setQuery(c.descripcion)
    setDropOpen(false)
    const avail = getSosDisponibles(hwEquipos, c.id, bodega || null)
    setSoSels(avail.length > 0 ? [{ so: avail[0].so, serial: avail[0].serial }] : [{ so: '', serial: null }])
  }

  function setSoAt(idx, nuevoSO) {
    const match = disponibles.find(d => d.so === nuevoSO)
    setSoSels(prev => prev.map((s, i) => i === idx
      ? (match ? { so: match.so, serial: match.serial } : { so: nuevoSO, serial: null })
      : s
    ))
  }

  async function handleAgregar() {
    if (!catSel) { showToast('Selecciona un tipo de equipo', 'err'); return }
    const missing = soSels.filter(s => !s.so).length
    if (missing > 0) { showToast(`Selecciona la SO para cada unidad (faltan ${missing})`, 'err'); return }
    const unique = new Set(soSels.map(s => s.so))
    if (unique.size < soSels.length) { showToast('Hay SOs duplicadas', 'err'); return }
    setSaving(true)
    try {
      for (const { so, serial } of soSels) {
        await agregarItem(despachoId, {
          catalogo_id:   Number(catSel.id),
          descripcion:   catSel.descripcion,
          cod_material:  catSel.cod_material || '—',
          tipo_material: catSel.tipo_material || '—',
          aplica_serial: !!serial,
          serial:        serial || null,
          so,
          cantidad:      1,
          bodega,
        })
      }
      showToast('Equipo(s) agregado(s)')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }


  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ background: ACENTO, color: '#fff', padding: '10px 16px',
          borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', position: 'sticky', top: 0, zIndex: 2 }}>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
            fontSize: 14, letterSpacing: .8 }}>AGREGAR EQUIPO AL DESPACHO</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: '#9ca89c', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Buscar tipo */}
          <div ref={dropAnchorRef} style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4 }}>Tipo de Equipo *</div>
            <input className="fc" placeholder="Buscar por descripción o código…"
              value={query}
              onFocus={() => {
                setDropOpen(true)
                if (dropAnchorRef.current) {
                  const r = dropAnchorRef.current.getBoundingClientRect()
                  setDropPos({ top: r.bottom + 2, left: r.left, width: r.width })
                }
              }}
              onChange={e => {
                setQuery(e.target.value); setSelCat(''); setSoSels([{ so: '', serial: null }]); setDropOpen(true)
                if (dropAnchorRef.current) {
                  const r = dropAnchorRef.current.getBoundingClientRect()
                  setDropPos({ top: r.bottom + 2, left: r.left, width: r.width })
                }
              }}
              onBlur={() => setTimeout(() => setDropOpen(false), 150)}
            />
            {dropOpen && catFiltradas.length > 0 && dropPos && (
              <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width,
                border: '1.5px solid #bfdbfe', borderRadius: 6, maxHeight: 260,
                overflowY: 'auto', background: '#fff', zIndex: 1000,
                boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>
                {catFiltradas.slice(0, 30).map(c => (
                  <div key={c.id} onMouseDown={() => selectCat(c)}
                    style={{ padding: '7px 12px', fontSize: 11, cursor: 'pointer',
                      borderBottom: '1px solid #f0f2f0', fontWeight: 500,
                      background: String(c.id) === selCat ? '#eff6ff' : '#fff' }}>
                    <strong style={{ color: ACENTO }}>{c.cod_material}</strong> — {c.descripcion}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cantidad */}
          {catSel && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4 }}>
                Cantidad ({disponibles.length} SO disponibles)
              </div>
              <input type="number" className="fc" min={1} max={disponibles.length || 99}
                value={soSels.length}
                onChange={e => handleCant(Number(e.target.value) || 1)}
              />
            </div>
          )}

          {/* SO por unidad */}
          {catSel && soSels.map((slot, idx) => {
            const taken = soSels.filter((s, i) => i !== idx && s.so).map(s => s.so)
            const opts  = disponibles.filter(d => !taken.includes(d.so))
            return (
              <div key={idx} style={{ background: '#f8faff', border: '1px solid #bfdbfe',
                borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACENTO, marginBottom: 6 }}>
                  Unidad {idx + 1}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select className="fc" style={{ flex: 1 }} value={slot.so || ''}
                    onChange={e => setSoAt(idx, e.target.value)}>
                    <option value="">— SO —</option>
                    {opts.map(x => (
                      <option key={x.so} value={x.so}>{x.so}{x.bodega ? ` (${x.bodega})` : ''}</option>
                    ))}
                  </select>
                  {slot.serial && (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                      color: '#144E4A', background: '#f0fdf4', padding: '4px 10px',
                      borderRadius: 4, whiteSpace: 'nowrap' }}>
                      {slot.serial}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn bou" onClick={onClose}>Cancelar</button>
            <button className="btn" style={{ background: ACENTO, color: '#fff', fontSize: 11 }}
              onClick={handleAgregar} disabled={saving || !catSel}>
              {saving ? 'Agregando…' : `+ Agregar (${soSels.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal agregar material ───────────────────────────────────────
function AgregarMatItemModal({ despachoId, onClose }) {
  const matCatalogo = useMatStore(s => s.catalogo)
  const matBodegas  = useMatStore(s => s.bodegas)
  const matGetStock = useMatStore(s => s.getStock)
  const agregarMat  = useHwStore(s => s.agregarMatItem)

  const [query,    setQuery]    = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [selCat,   setSelCat]   = useState(null)
  const [bodega,   setBodega]   = useState(String(matBodegas[0]?.id || ''))
  const [cant,     setCant]     = useState(1)
  const [saving,   setSaving]   = useState(false)
  const dropRef = useRef(null)

  const catFiltradas = useMemo(() => {
    const q = query.toLowerCase()
    return matCatalogo.filter(c => c.activo && c.categoria !== 'PROVEEDORES' &&
      (c.nombre.toLowerCase().includes(q) || (c.codigo || '').toLowerCase().includes(q))
    )
  }, [matCatalogo, query])

  const stock = selCat && bodega ? matGetStock(selCat.id, Number(bodega)) : null

  async function handleAgregar() {
    if (!selCat || !bodega) return
    const bod = matBodegas.find(b => String(b.id) === bodega)
    setSaving(true)
    try {
      await agregarMat(despachoId, {
        catalogo_id:    selCat.id,
        nombre:         selCat.nombre,
        cantidad:       Number(cant),
        bodega_id:      Number(bodega),
        bodega_nombre:  bod?.nombre || '',
        costo_unitario: selCat.costo_unitario || null,
      })
      showToast('Material agregado')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 440,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ background: '#0a0a0a', color: '#fff', padding: '10px 16px',
          borderRadius: '10px 10px 0 0', borderBottom: '3px solid #c0392b',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 2 }}>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
            fontSize: 14, letterSpacing: .8 }}>AGREGAR MATERIAL AL DESPACHO</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: '#9ca89c', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div ref={dropRef} style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4 }}>Material *</div>
            <input className="fc" placeholder="Buscar por nombre o código…"
              value={query} onFocus={() => setDropOpen(true)}
              onChange={e => { setQuery(e.target.value); setSelCat(null); setDropOpen(true) }}
              onBlur={() => setTimeout(() => setDropOpen(false), 150)}
            />
            {dropOpen && catFiltradas.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                border: '1.5px solid #fca5a5', borderRadius: 6, maxHeight: 220, overflowY: 'auto',
                background: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>
                {catFiltradas.slice(0, 30).map(c => (
                  <div key={c.id} onMouseDown={() => { setSelCat(c); setQuery(c.nombre); setDropOpen(false); setCant(1) }}
                    style={{ padding: '7px 12px', fontSize: 11, cursor: 'pointer',
                      borderBottom: '1px solid #f0f2f0', background: selCat?.id === c.id ? '#fff5f5' : '#fff' }}>
                    <strong style={{ color: '#c0392b' }}>{c.codigo}</strong> — {c.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selCat?.imagen_url && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff5f5', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '8px 12px' }}>
              <img src={selCat.imagen_url} alt={selCat.nombre}
                style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 5, border: '1px solid #e0e4e0', background: '#fff', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none' }} />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#c0392b', letterSpacing: .6, textTransform: 'uppercase', marginBottom: 2 }}>Verificar material</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{selCat.nombre}</div>
                <div style={{ fontSize: 10, color: '#9ca89c', fontFamily: "'Barlow Condensed',sans-serif" }}>{selCat.codigo}</div>
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4 }}>Bodega *</div>
            <select className="fc" value={bodega} onChange={e => setBodega(e.target.value)}>
              {matBodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>

          {selCat && stock !== null && (
            <div style={{ fontSize: 10, color: stock === 0 ? '#c0392b' : '#166534', fontWeight: 600 }}>
              Stock disponible: <strong>{stock}</strong> {selCat.unidad || 'und'}
              {stock === 0 && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>— sin stock en esta bodega</span>}
            </div>
          )}

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4 }}>Cantidad *</div>
            <input type="number" min={1} className="fc" value={cant}
              onChange={e => setCant(Math.max(1, Number(e.target.value) || 1))} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn bou" onClick={onClose}>Cancelar</button>
            <button
              style={{ background: selCat ? '#c0392b' : '#e5e7eb', color: selCat ? '#fff' : '#9ca89c',
                border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 11, fontWeight: 700,
                cursor: selCat ? 'pointer' : 'not-allowed' }}
              onClick={handleAgregar} disabled={saving || !selCat || !bodega}>
              {saving ? 'Agregando…' : '+ Agregar material'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-tarjeta de un despacho individual (dentro de SitioCard) ──
function DespachoCard({ despacho, onRealizar, onCancelar, canEdit, grouped = false }) {
  const [open,       setOpen]       = useState(!grouped)
  const [editando,   setEditando]   = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [saving,     setSaving]     = useState(false)

  const hwEquipos       = useHwStore(s => s.hwEquipos)
  const hwMovimientos   = useHwStore(s => s.hwMovimientos)
  const actualizarMat   = useHwStore(s => s.actualizarMatItem)
  const quitarMat       = useHwStore(s => s.quitarMatItem)
  const agregarMat      = useHwStore(s => s.agregarMatItem)
  const matSitios       = useMatStore(s => s.sitios)
  const [addingMatModal, setAddingMatModal] = useState(false)

  const yaEnPillSitios = despacho.destino_tipo !== 'ss' &&
    matSitios.some(s => s.nombre?.toLowerCase() === despacho.destino?.toLowerCase())
  const [meta, setMeta] = useState({
    numero_doc: despacho.numero_doc,
    fecha:      despacho.fecha,
    smp_id:     despacho.smp_id || '',
    notas:      despacho.notas  || '',
  })

  const actualizarMeta    = useHwStore(s => s.actualizarMetaDespacho)
  const quitarItem        = useHwStore(s => s.quitarItemDespacho)
  const cambiarSO         = useHwStore(s => s.cambiarSOItem)
  const actualizarCantHW  = useHwStore(s => s.actualizarCantidadHwItem)
  const { confirm, ConfirmModalUI } = useConfirm()

  // Sync meta when despacho changes from store
  useEffect(() => {
    setMeta({
      numero_doc: despacho.numero_doc,
      fecha:      despacho.fecha,
      smp_id:     despacho.smp_id || '',
      notas:      despacho.notas  || '',
    })
  }, [despacho])

  async function handleGuardarMeta() {
    setSaving(true)
    try {
      await actualizarMeta(despacho.id, {
        numero_doc: meta.numero_doc,
        fecha:      meta.fecha,
        smp_id:     meta.smp_id || null,
        notas:      meta.notas  || null,
      })
      setEditando(false)
      showToast('Datos actualizados')
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleQuitarItem(idx) {
    const item = despacho.items[idx]
    const ok = await confirm('Quitar equipo',
      `¿Quitar "${item.descripcion}" (${item.serial || `x${item.cantidad}`}) del despacho? El HW regresará al inventario.`)
    if (!ok) return
    try {
      await quitarItem(despacho.id, idx)
      showToast('Equipo devuelto al inventario')
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleCambiarSO(idx, nuevoSO, nuevoSerial) {
    try {
      await cambiarSO(despacho.id, idx, nuevoSO, nuevoSerial)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  const nItems    = despacho.items?.length || 0
  const nMat      = despacho.mat_despachos?.length || 0
  const esPuraMat = nItems === 0 && nMat > 0

  const tipoBadge = esPuraMat
    ? <Badge label="📦 Materiales" bg="#fff5f5" color="#c0392b" />
    : nMat > 0
      ? <Badge label="📡 HW + Materiales" bg="#eff6ff" color="#1e40af" />
      : <Badge label="📡 HW Nokia" bg="#eff6ff" color="#1e40af" />

  return (
    <div style={grouped
      ? { borderTop: '1px solid #e8eef8' }
      : { border: '1.5px solid #e0e8f0', borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }
    }>
      <ConfirmModalUI />

      {/* Header */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: grouped ? '10px 16px' : '12px 16px',
          cursor: 'pointer', background: open ? (grouped ? '#f8faff' : '#f0f6ff') : (grouped ? '#fafbff' : '#fff'),
          borderBottom: open ? '1px solid #dde8f8' : 'none',
          borderRadius: grouped ? 0 : (open ? '8px 8px 0 0' : 8) }}>
        <span style={{ fontSize: 13, color: '#9ca89c' }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1 }}>
          {grouped ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {tipoBadge}
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{despacho.numero_doc}</span>
              <span style={{ fontSize: 10, color: '#9ca89c' }}>{despacho.fecha}</span>
              {nItems > 0 && <span style={{ fontSize: 10, color: '#555' }}>{nItems} equipo{nItems !== 1 ? 's' : ''}</span>}
              {nMat  > 0 && <span style={{ fontSize: 10, color: '#c0392b' }}>{nMat} material{nMat !== 1 ? 'es' : ''}</span>}
              {despacho.smp_id && <span style={{ fontSize: 10, color: '#9ca89c' }}>SMP: {despacho.smp_id}</span>}
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                fontSize: 15, color: ACENTO, letterSpacing: .5 }}>
                {despacho.destino}
              </div>
              <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 1 }}>
                {despacho.numero_doc} · {despacho.fecha} · {despacho.bodega}
                {nItems > 0 ? ` · ${nItems} equipo${nItems !== 1 ? 's' : ''}` : ''}
                {nMat  > 0 ? ` · ${nMat} material${nMat !== 1 ? 'es' : ''}` : ''}
                {despacho.smp_id ? ` · SMP: ${despacho.smp_id}` : ''}
              </div>
            </>
          )}
        </div>
        {!grouped && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {despacho.destino_tipo !== 'ss' && (
              yaEnPillSitios
                ? <Badge label="Ya en Pill Sitios" bg="#dcfce7" color="#166534" />
                : <Badge label="Sitio nuevo" bg="#fef3c7" color="#92400e" />
            )}
            <Badge label="Pendiente" bg="#fef3cd" color="#856404" />
          </div>
        )}
        {grouped && canEdit && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); onRealizar() }}
              disabled={!esPuraMat && nItems === 0}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6,
                padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              ✓ Confirmar
            </button>
            <button
              onClick={e => { e.stopPropagation(); onCancelar() }}
              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
                padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {open && (
        <div style={{ padding: '14px 16px' }}>

          {/* Meta editable */}
          {editando ? (
            <div style={{ background: '#f8faff', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: 12, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>N° Documento</div>
                  <input className="fc" value={meta.numero_doc}
                    onChange={e => setMeta(m => ({ ...m, numero_doc: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Fecha</div>
                  <input type="date" className="fc" value={meta.fecha}
                    onChange={e => setMeta(m => ({ ...m, fecha: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>SMP ID</div>
                  <input className="fc" value={meta.smp_id}
                    onChange={e => setMeta(m => ({ ...m, smp_id: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Notas</div>
                <input className="fc" value={meta.notas}
                  onChange={e => setMeta(m => ({ ...m, notas: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ background: ACENTO, color: '#fff', fontSize: 11 }}
                  onClick={handleGuardarMeta} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button className="btn" style={{ fontSize: 11 }} onClick={() => setEditando(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            canEdit && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button className="btn" style={{ fontSize: 10 }} onClick={() => setEditando(true)}>
                  ✏ Editar datos
                </button>
              </div>
            )
          )}

          {/* Tabla de equipos HW Nokia */}
          {!esPuraMat && (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '45vh', marginBottom: 12 }}>
              <table className="tbl" style={{ minWidth: 680 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ fontSize: 10, background: '#f0f7f0' }}>Descripción</th>
                    <th style={{ fontSize: 10, background: '#f0f7f0', textAlign: 'left' }}>Código</th>
                    <th style={{ fontSize: 10, background: '#f0f7f0', textAlign: 'left' }}>SO</th>
                    <th style={{ fontSize: 10, background: '#f0f7f0', textAlign: 'left' }}>Serial</th>
                    <th style={{ fontSize: 10, background: '#f0f7f0', textAlign: 'right' }}>Cant.</th>
                    <th style={{ fontSize: 10, background: '#f0f7f0' }}>Bodega</th>
                    <th style={{ width: 36, background: '#f0f7f0' }} />
                  </tr>
                </thead>
                <tbody>
                  {(despacho.items || []).length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca89c', padding: 20, fontSize: 11 }}>
                      Sin equipos — agrega al menos uno antes de realizar el despacho
                    </td></tr>
                  )}
                  {(despacho.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: 11 }}>{item.descripcion}</td>
                      <td style={{ fontSize: 10, color: '#555' }}>{item.cod_material}</td>
                      <td>
                        {item.aplica_serial !== false ? (() => {
                          const sosOpts = getSosDisponibles(hwEquipos, hwMovimientos, item.catalogo_id, despacho.bodega, [])
                          const allOpts = item.so && !sosOpts.some(x => x.so === item.so)
                            ? [{ so: item.so, serial: item.serial }, ...sosOpts]
                            : sosOpts
                          return (
                            <select className="fc" style={{ fontSize: 10, padding: '3px 6px', width: 140 }}
                              value={item.so || ''}
                              onChange={e => {
                                const match = allOpts.find(x => x.so === e.target.value)
                                if (match) handleCambiarSO(idx, match.so, match.serial)
                              }}>
                              <option value="">— SO —</option>
                              {allOpts.map(x => (
                                <option key={x.serial} value={x.so}>{x.so}{x.bodega ? ` (${x.bodega})` : ''}</option>
                              ))}
                            </select>
                          )
                        })() : (
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#555' }}>
                            {item.so || despacho.numero_doc}
                          </span>
                        )}
                      </td>
                      {/* Serial */}
                      <td style={{ fontSize: 11 }}>
                        {item.aplica_serial !== false
                          ? <span style={{ fontFamily: 'monospace' }}>{item.serial}</span>
                          : <span style={{ color: '#d4d4d8' }}>—</span>}
                      </td>
                      {/* Cant. — editable solo para no-seriales */}
                      <td style={{ textAlign: 'right' }}>
                        {item.aplica_serial === false && canEdit ? (
                          <input type="number" min={1}
                            defaultValue={item.cantidad}
                            onBlur={e => {
                              const v = Math.max(1, Number(e.target.value) || 1)
                              if (v !== item.cantidad) actualizarCantHW(despacho.id, idx, v)
                            }}
                            style={{ width: 52, textAlign: 'right', border: '1px solid #e0e4e0',
                              borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: 700 }}
                          />
                        ) : (
                          <span style={{ fontSize: 11, color: '#555' }}>{item.cantidad}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 10, color: '#555' }}>{item.bodega}</td>
                      <td>
                        {canEdit && <button className="btn-del" title="Quitar del despacho"
                          onClick={() => handleQuitarItem(idx)}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Agregar ítem HW Nokia */}
          {!esPuraMat && canEdit && (
            <button className="btn" style={{ fontSize: 10, marginBottom: 14, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}
              onClick={() => setAddingItem(true)}>
              + Agregar equipo HW Nokia
            </button>
          )}

          {/* Sección de materiales — editable (solo si hay materiales o es despacho puro mat) */}
          {(nMat > 0 || esPuraMat) && (
            <div style={{ marginBottom: 14 }}>
              {nMat > 0 && (
                <div style={{ overflowY: 'auto', maxHeight: '45vh', marginBottom: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#fff5f5', borderBottom: '1px solid #fca5a5' }}>
                      {['Material', 'Cant.', 'Bodega', ''].map(h => (
                        <th key={h} style={{ padding: '5px 8px',
                          textAlign: h === 'Cant.' ? 'right' : 'left',
                          fontSize: 9, fontWeight: 700, color: '#c0392b',
                          textTransform: 'uppercase', letterSpacing: .4, width: h === '' ? 28 : 'auto' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {despacho.mat_despachos.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '5px 8px', fontWeight: 600 }}>{item.nombre}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                          {canEdit ? (
                            <input type="number" min={1} defaultValue={item.cantidad}
                              onBlur={e => {
                                const v = Math.max(1, Number(e.target.value) || 1)
                                if (v !== item.cantidad) actualizarMat(despacho.id, idx, { cantidad: v })
                              }}
                              style={{ width: 52, textAlign: 'right', border: '1px solid #e0e4e0',
                                borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: 700 }}
                            />
                          ) : item.cantidad}
                        </td>
                        <td style={{ padding: '5px 8px', color: '#9ca89c', fontSize: 10 }}>
                          {item.bodega_nombre || '—'}
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          {canEdit && (
                            <button onClick={() => quitarMat(despacho.id, idx)}
                              style={{ border: 'none', background: '#fde8e7', color: '#c0392b',
                                borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}>
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}

              {canEdit && (
                <button className="btn" style={{ fontSize: 10, background: '#fff5f5', color: '#c0392b', border: '1px solid #fca5a5' }}
                  onClick={() => setAddingMatModal(true)}>
                  + Agregar Materiales
                </button>
              )}

              {addingMatModal && (
                <AgregarMatItemModal
                  despachoId={despacho.id}
                  onClose={() => setAddingMatModal(false)}
                />
              )}
            </div>
          )}
          {addingItem && (
            <AgregarItemModal
              despachoId={despacho.id}
              bodega={despacho.bodega}
              onClose={() => setAddingItem(false)}
            />
          )}

          {/* Acciones (solo en modo standalone) */}
          {canEdit && !grouped && (
            <div style={{ display: 'flex', gap: 10, paddingTop: 10,
              borderTop: '1.5px solid #f0f2f0' }}>
              <button
                className="btn"
                style={{ background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12, flex: 1 }}
                onClick={onRealizar}
                disabled={!esPuraMat && (despacho.items || []).length === 0}
              >
                ✓ Despacho Realizado
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 12 }}
                onClick={onCancelar}
              >
                ✕ Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta agrupada por sitio ───────────────────────────────────
function SitioCard({ sitio, despachos, onRealizar, onCancelar, canEdit }) {
  const [open, setOpen] = useState(true)
  const matSitios = useMatStore(s => s.sitios)

  const yaEnPillSitios = matSitios.some(
    s => s.nombre?.toLowerCase() === sitio?.toLowerCase()
  )
  const totalEquipos   = despachos.reduce((s, d) => s + (d.items?.length || 0), 0)
  const totalMateriales = despachos.reduce((s, d) => s + (d.mat_despachos?.length || 0), 0)
  const esTransfer     = despachos[0]?.destino_tipo === 'ss'

  return (
    <div style={{ border: '1.5px solid #e0e8f0', borderRadius: 10,
      marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,.05)', overflow: 'hidden' }}>

      {/* Header del sitio */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
          cursor: 'pointer', background: open ? '#f0f6ff' : '#fff',
          borderBottom: open ? '1.5px solid #bfdbfe' : 'none' }}>
        <span style={{ fontSize: 15 }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
            fontSize: 15, color: ACENTO, letterSpacing: .5 }}>
            {sitio}
          </div>
          <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 1 }}>
            {despachos.length} despacho{despachos.length !== 1 ? 's' : ''}
            {totalEquipos   > 0 ? ` · ${totalEquipos} equipo${totalEquipos !== 1 ? 's' : ''}` : ''}
            {totalMateriales > 0 ? ` · ${totalMateriales} material${totalMateriales !== 1 ? 'es' : ''}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {!esTransfer && (
            yaEnPillSitios
              ? <Badge label="Ya en Pill Sitios" bg="#dcfce7" color="#166534" />
              : <Badge label="Sitio nuevo"       bg="#fef3c7" color="#92400e" />
          )}
          <Badge label={`${despachos.length} pendiente${despachos.length !== 1 ? 's' : ''}`}
            bg="#fef3cd" color="#856404" />
        </div>
      </div>

      {/* Despachos individuales */}
      {open && (
        <>
          {despachos.length > 1 && (
            <div style={{ padding: '6px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a',
              fontSize: 10, color: '#92400e' }}>
              Este sitio tiene {despachos.length} despachos pendientes — confirma cada uno por separado.
            </div>
          )}
          {despachos.map(d => (
            <DespachoCard
              key={d.id}
              despacho={d}
              grouped
              canEdit={canEdit}
              onRealizar={() => onRealizar(d)}
              onCancelar={() => onCancelar(d)}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
export default function HwDespachosPendientes() {
  const hwDespachosPendientes = useHwStore(s => s.hwDespachosPendientes)
  const realizarDespacho      = useHwStore(s => s.realizarDespacho)
  const cancelarDespacho      = useHwStore(s => s.cancelarDespacho)
  const loading               = useHwStore(s => s.loading)
  const loadAll               = useHwStore(s => s.loadAll)

  const user     = useAuthStore(s => s.user)
  const canEdit  = can(user?.role, 'hw.despachos.edit')

  const [search, setSearch] = useState('')
  const { confirm, ConfirmModalUI } = useConfirm()

  useEffect(() => {
    if (hwDespachosPendientes.length === 0) loadAll()
  }, [])

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return hwDespachosPendientes
    return hwDespachosPendientes.filter(d =>
      d.destino?.toLowerCase().includes(q) ||
      d.numero_doc?.toLowerCase().includes(q) ||
      d.smp_id?.toLowerCase().includes(q) ||
      d.bodega?.toLowerCase().includes(q)
    )
  }, [hwDespachosPendientes, search])

  // Agrupar por sitio (destino)
  const bySite = useMemo(() => {
    const map = new Map()
    for (const d of filtrados) {
      const key = d.destino || '(Sin sitio)'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(d)
    }
    return [...map.entries()].map(([sitio, despachos]) => ({ sitio, despachos }))
  }, [filtrados])

  async function handleRealizar(despacho) {
    const matSitios     = useMatStore.getState().sitios
    const yaEnPillSitios = despacho.destino_tipo !== 'ss' &&
      matSitios.some(s => s.nombre?.toLowerCase() === despacho.destino?.toLowerCase())

    const ok = await confirm(
      'Confirmar Despacho',
      `¿Confirmar envío a "${despacho.destino}"? Los equipos pasarán a En Sitio.${
        despacho.destino_tipo !== 'ss'
          ? yaEnPillSitios
            ? ' El sitio ya existe en Pill Sitios — no se duplicará.'
            : ' El sitio se creará automáticamente en Pill Sitios.'
          : ''
      }`
    )
    if (!ok) return
    try {
      await realizarDespacho(despacho.id)
      // Crear mat_sitios si no existe (regla universal — solo para despachos a sitio)
      if (despacho.destino_tipo !== 'ss' && despacho.destino && !yaEnPillSitios) {
        const liqSitio = useAppStore.getState().sitios?.find(
          s => s.nombre?.toLowerCase() === despacho.destino.toLowerCase()
        )
        await useMatStore.getState().saveSitio({
          nombre:      despacho.destino,
          tipo_cw:     liqSitio?.tipo     || '',
          regional:    liqSitio?.regional || 'Sur-Occidente',
          comentarios: '',
          activo:      true,
        })
      }
      showToast(`Despacho a "${despacho.destino}" realizado`)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleCancelar(despacho) {
    const ok = await confirm(
      'Cancelar Sitio',
      `¿Cancelar el despacho pendiente para "${despacho.destino}"? Todo el HW asignado regresará al inventario disponible.`,
      'destructive'
    )
    if (!ok) return
    try {
      await cancelarDespacho(despacho.id)
      showToast(`Despacho de "${despacho.destino}" cancelado — HW devuelto al inventario`)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <>
      <ConfirmModalUI />

      {/* Header */}
      <div className="fb mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21,
            fontWeight: 800, color: ACENTO, letterSpacing: .5 }}>
            Sitios Pendientes de Despacho
            {filtrados.length > 0 && (
              <span style={{ marginLeft: 10, background: '#fef3cd', color: '#856404',
                borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 700 }}>
                {filtrados.length}
              </span>
            )}
          </h1>
          <div style={{ fontSize: 11, color: '#9ca89c', marginTop: 2 }}>
            HW asignado a sitio pero aún en bodega — pendiente de envío físico
          </div>
        </div>
        <input
          type="text" className="fc"
          placeholder="🔍 Buscar sitio, doc, SMP…"
          style={{ width: 220 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { label: 'Sitios pendientes', value: bySite.length, color: ACENTO },
          { label: 'Equipos asignados',
            value: hwDespachosPendientes.reduce((a, d) => a + (d.items?.length || 0), 0),
            color: '#1e40af' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 8, padding: '10px 16px',
            borderLeft: `4px solid ${k.color}`, boxShadow: '0 1px 4px rgba(0,0,0,.05)', minWidth: 120 }}>
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase',
              color: '#555', marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
              fontSize: 26, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Lista agrupada por sitio */}
      {loading && hwDespachosPendientes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca89c' }}>Cargando…</div>
      ) : bySite.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca89c', fontSize: 13 }}>
          {hwDespachosPendientes.length === 0
            ? 'Sin despachos pendientes — los despachos creados desde Movimientos o Materiales aparecerán aquí'
            : 'Sin resultados para la búsqueda'}
        </div>
      ) : (
        bySite.map(({ sitio, despachos }) => (
          <SitioCard
            key={sitio}
            sitio={sitio}
            despachos={despachos}
            onRealizar={handleRealizar}
            onCancelar={handleCancelar}
            canEdit={canEdit}
          />
        ))
      )}
    </>
  )
}
