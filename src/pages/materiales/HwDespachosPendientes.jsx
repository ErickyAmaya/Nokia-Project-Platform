import { useState, useMemo, useEffect, useRef } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useMatStore } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/useAppStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

const ACENTO = '#1e3a5f'

// Retorna [{so, serial, equipo_id}] para equipos en_bodega del tipo dado
function getSosDisponibles(hwEquipos, _hwMovimientos, catalogoId, bodega = null, excludeSerials = []) {
  return hwEquipos
    .filter(e =>
      Number(e.catalogo_id) === Number(catalogoId) &&
      e.estado === 'en_bodega' &&
      (!bodega || !e.ubicacion_actual || e.ubicacion_actual === bodega) &&
      !excludeSerials.includes(e.serial)
    )
    .map(e => ({ so: e.so || e.serial, serial: e.serial, equipo_id: e.id, bodega: e.ubicacion_actual || '' }))
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

// ── Modal de agregar ítem ────────────────────────────────────────
function AgregarItemModal({ despachoId, bodega, onClose }) {
  const hwCatalogo    = useHwStore(s => s.hwCatalogo)
  const hwEquipos     = useHwStore(s => s.hwEquipos)
  const hwMovimientos = useHwStore(s => s.hwMovimientos)
  const agregarItem   = useHwStore(s => s.agregarItemDespacho)

  const [selCat,   setSelCat]   = useState('')
  const [soSels,   setSoSels]   = useState([''])   // one entry per unit (serial items)
  const [cant,     setCant]     = useState(1)
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

  const sosDisp = useMemo(() => {
    if (!catSel || catSel.aplica_serial === false) return []
    // null = sin filtrar por bodega, para no bloquear despachos por lote
    return getSosDisponibles(hwEquipos, hwMovimientos, catSel.id, null)
  }, [catSel, hwEquipos, hwMovimientos])

  // When quantity changes resize the soSels array
  function handleCant(val) {
    const n = Math.max(1, Math.min(val, sosDisp.length || 999))
    setCant(n)
    setSoSels(prev => {
      const arr = [...prev]
      while (arr.length < n) arr.push('')
      return arr.slice(0, n)
    })
  }

  function selectCat(c) {
    setSelCat(String(c.id))
    setQuery(c.descripcion)
    setDropOpen(false)
    setSoSels([''])
    setCant(1)
  }

  function setSoAt(idx, val) {
    setSoSels(prev => prev.map((v, i) => i === idx ? val : v))
  }

  // SOs already chosen in other slots
  function takenSerials(exceptIdx) {
    return soSels
      .filter((_, i) => i !== exceptIdx)
      .map(so => sosDisp.find(x => x.so === so)?.serial)
      .filter(Boolean)
  }

  function stockSinSerial() {
    if (!catSel || catSel.aplica_serial !== false) return 0
    const movs = hwMovimientos.filter(m => Number(m.catalogo_id) === Number(catSel.id) && !m.serial)
    const ent = movs.filter(m => m.tipo === 'ENTRADA').reduce((s, m) => s + (m.cantidad || 0), 0)
    const sal = movs.filter(m => m.tipo === 'SALIDA').reduce((s, m) => s + (m.cantidad || 0), 0)
    return Math.max(0, ent - sal)
  }

  async function handleAgregar() {
    if (!catSel) { showToast('Selecciona un tipo de equipo', 'err'); return }
    if (catSel.aplica_serial !== false) {
      const missing = soSels.filter(s => !s).length
      if (missing > 0) { showToast(`Selecciona la SO para cada unidad (faltan ${missing})`, 'err'); return }
      const unique = new Set(soSels)
      if (unique.size < soSels.length) { showToast('Hay SOs duplicadas', 'err'); return }
    } else {
      if (cant < 1) { showToast('Cantidad inválida', 'err'); return }
    }
    setSaving(true)
    try {
      if (catSel.aplica_serial !== false) {
        for (const so of soSels) {
          const obj = sosDisp.find(x => x.so === so)
          if (!obj) continue
          await agregarItem(despachoId, {
            catalogo_id:   Number(catSel.id),
            descripcion:   catSel.descripcion,
            cod_material:  catSel.cod_material || '—',
            tipo_material: catSel.tipo_material || '—',
            aplica_serial: true,
            serial:        obj.serial,
            so:            obj.so,
            cantidad:      1,
            bodega,
          })
        }
      } else {
        await agregarItem(despachoId, {
          catalogo_id:   Number(catSel.id),
          descripcion:   catSel.descripcion,
          cod_material:  catSel.cod_material || '—',
          tipo_material: catSel.tipo_material || '—',
          aplica_serial: false,
          serial:        null,
          so:            '',
          cantidad:      Number(cant),
          bodega,
        })
      }
      showToast('Equipo(s) agregado(s)')
      onClose()
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  const dispStock = stockSinSerial()

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
                setQuery(e.target.value); setSelCat(''); setSoSels(['']); setCant(1); setDropOpen(true)
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

          {/* Cantidad (serial o bulk) */}
          {catSel && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4 }}>
                {catSel.aplica_serial !== false
                  ? `Cantidad (${sosDisp.length} SO disponibles)`
                  : `Cantidad (stock disponible: ${dispStock})`}
              </div>
              <input type="number" className="fc" min={1}
                max={catSel.aplica_serial !== false ? (sosDisp.length || 999) : (dispStock || 999)}
                value={cant}
                onChange={e => catSel.aplica_serial !== false
                  ? handleCant(Number(e.target.value) || 1)
                  : setCant(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
          )}

          {/* SO por unidad (serial items) */}
          {catSel && catSel.aplica_serial !== false && soSels.map((soVal, idx) => {
            const taken   = takenSerials(idx)
            const opts    = sosDisp.filter(x => !taken.includes(x.serial))
            const selObj  = sosDisp.find(x => x.so === soVal)
            return (
              <div key={idx} style={{ background: '#f8faff', border: '1px solid #bfdbfe',
                borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACENTO, marginBottom: 6 }}>
                  Unidad {idx + 1}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select className="fc" style={{ flex: 1 }} value={soVal}
                    onChange={e => setSoAt(idx, e.target.value)}>
                    <option value="">— SO —</option>
                    {opts.map(x => (
                      <option key={x.serial} value={x.so}>{x.so}{x.bodega ? ` (${x.bodega})` : ''}</option>
                    ))}
                  </select>
                  {selObj && (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                      color: '#144E4A', background: '#f0fdf4', padding: '4px 10px',
                      borderRadius: 4, whiteSpace: 'nowrap' }}>
                      {selObj.serial}
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
              {saving ? 'Agregando…' : `+ Agregar${soSels.filter(Boolean).length > 1 ? ` (${soSels.filter(Boolean).length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de despacho ──────────────────────────────────────────
function DespachoCard({ despacho, onRealizar, onCancelar }) {
  const [open,       setOpen]       = useState(false)
  const [editando,   setEditando]   = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [saving,     setSaving]     = useState(false)

  const hwEquipos     = useHwStore(s => s.hwEquipos)
  const hwMovimientos = useHwStore(s => s.hwMovimientos)
  const [meta, setMeta] = useState({
    numero_doc: despacho.numero_doc,
    fecha:      despacho.fecha,
    smp_id:     despacho.smp_id || '',
    notas:      despacho.notas  || '',
  })

  const actualizarMeta = useHwStore(s => s.actualizarMetaDespacho)
  const quitarItem     = useHwStore(s => s.quitarItemDespacho)
  const cambiarSO      = useHwStore(s => s.cambiarSOItem)
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

  const nItems = despacho.items?.length || 0

  return (
    <div style={{ border: '1.5px solid #e0e8f0', borderRadius: 10,
      marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <ConfirmModalUI />

      {/* Header colapsable */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          cursor: 'pointer', background: open ? '#f0f6ff' : '#fff',
          borderBottom: open ? '1.5px solid #bfdbfe' : 'none',
          position: 'sticky', top: 0, zIndex: 10,
          borderRadius: open ? '8px 8px 0 0' : 8 }}>
        <span style={{ fontSize: 16 }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
            fontSize: 15, color: ACENTO, letterSpacing: .5 }}>
            {despacho.destino}
          </div>
          <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 1 }}>
            {despacho.numero_doc} · {despacho.fecha} · {despacho.bodega} · {nItems} equipo{nItems !== 1 ? 's' : ''}
            {despacho.smp_id ? ` · SMP: ${despacho.smp_id}` : ''}
          </div>
        </div>
        <Badge label="Pendiente" bg="#fef3cd" color="#856404" />
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
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button className="btn" style={{ fontSize: 10 }} onClick={() => setEditando(true)}>
                ✏ Editar datos
              </button>
            </div>
          )}

          {/* Tabla de equipos */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '45vh', marginBottom: 12 }}>
            <table className="tbl" style={{ minWidth: 650 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ fontSize: 10, background: '#f0f7f0' }}>Descripción</th>
                  <th style={{ fontSize: 10, background: '#f0f7f0' }}>Código</th>
                  <th style={{ fontSize: 10, background: '#f0f7f0' }}>SO</th>
                  <th style={{ fontSize: 10, background: '#f0f7f0' }}>Serial / Cant.</th>
                  <th style={{ fontSize: 10, background: '#f0f7f0' }}>Bodega</th>
                  <th style={{ width: 36, background: '#f0f7f0' }} />
                </tr>
              </thead>
              <tbody>
                {(despacho.items || []).length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca89c', padding: 20, fontSize: 11 }}>
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
                        // Include current SO as option even though its equipo is pendiente_despacho
                        const allOpts = item.so && !sosOpts.some(x => x.so === item.so)
                          ? [{ so: item.so, serial: item.serial }, ...sosOpts]
                          : sosOpts
                        return (
                          <select
                            className="fc"
                            style={{ fontSize: 10, padding: '3px 6px', width: 140 }}
                            value={item.so || ''}
                            onChange={e => {
                              const match = allOpts.find(x => x.so === e.target.value)
                              if (match) handleCambiarSO(idx, match.so, match.serial)
                            }}
                          >
                            <option value="">— SO —</option>
                            {allOpts.map(x => (
                              <option key={x.serial} value={x.so}>{x.so}{x.bodega ? ` (${x.bodega})` : ''}</option>
                            ))}
                          </select>
                        )
                      })() : (
                        <span style={{ fontSize: 10, color: '#9ca89c' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {item.aplica_serial !== false
                        ? <span style={{ fontFamily: 'monospace' }}>{item.serial}</span>
                        : <span style={{ color: '#555' }}>×{item.cantidad}</span>}
                    </td>
                    <td style={{ fontSize: 10, color: '#555' }}>{item.bodega}</td>
                    <td>
                      <button className="btn-del" title="Quitar del despacho"
                        onClick={() => handleQuitarItem(idx)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Agregar ítem */}
          <button className="btn" style={{ fontSize: 10, marginBottom: 14 }}
            onClick={() => setAddingItem(true)}>
            + Agregar equipo
          </button>
          {addingItem && (
            <AgregarItemModal
              despachoId={despacho.id}
              bodega={despacho.bodega}
              onClose={() => setAddingItem(false)}
            />
          )}

          {/* Acciones principales */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 10,
            borderTop: '1.5px solid #f0f2f0' }}>
            <button
              className="btn"
              style={{ background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12, flex: 1 }}
              onClick={onRealizar}
              disabled={(despacho.items || []).length === 0}
            >
              ✓ Despacho Realizado
            </button>
            <button
              className="btn"
              style={{ background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 12 }}
              onClick={onCancelar}
            >
              ✕ Cancelar Sitio
            </button>
          </div>
        </div>
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

  const matSitios = useMatStore(s => s.sitios)
  const saveSitio = useMatStore(s => s.saveSitio)

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

  async function handleRealizar(despacho) {
    const ok = await confirm(
      'Despacho Realizado',
      `¿Confirmar envío a sitio de "${despacho.destino}"? Los equipos pasarán a estado En Sitio y el sitio se registrará en Materiales.`
    )
    if (!ok) return
    try {
      await realizarDespacho(despacho.id, matSitios, saveSitio)
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
          { label: 'Sitios pendientes', value: hwDespachosPendientes.length, color: ACENTO },
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

      {/* Lista */}
      {loading && hwDespachosPendientes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca89c' }}>Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca89c', fontSize: 13 }}>
          {hwDespachosPendientes.length === 0
            ? 'Sin despachos pendientes — los despachos creados desde Movimientos HW aparecerán aquí'
            : 'Sin resultados para la búsqueda'}
        </div>
      ) : (
        filtrados.map(d => (
          <DespachoCard
            key={d.id}
            despacho={d}
            onRealizar={() => handleRealizar(d)}
            onCancelar={() => handleCancelar(d)}
          />
        ))
      )}
    </>
  )
}
