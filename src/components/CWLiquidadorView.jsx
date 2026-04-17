/**
 * CWLiquidadorView — Full CW liquidation UI embedded inside LiquidadorPage.
 * Takes the TI `sitio` object and renders the CW liquidation for that site.
 */
import { useMemo, useState, useRef, useEffect } from 'react'

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '../store/useAppStore'
import { cop, pct, mfcls } from '../lib/catalog'
import { useConfirm } from './ConfirmModal'
import { showToast } from './Toast'

const REGIONES = ['R1 – Costa','R2 – Noroccidente','R3 – Suroccidente','R4 – Centro','R5 – Oriente']

function calcLiq(liq) {
  let totNokia = 0, totSubc = 0
  ;(liq?.items || []).forEach(item => {
    totNokia += (item.cant || 0) * (item.precio_nokia || 0)
    totSubc  += (item.cant || 0) * (item.precio_subc  || 0)
  })
  const utilidad = totNokia - totSubc
  const margen   = totNokia > 0 ? utilidad / totNokia : 0
  return { totNokia, totSubc, utilidad, margen }
}

// ── Add/Edit item modal ───────────────────────────────────────────
function AddItemModal({ open, onClose, onAdd, liq, catalogCW, editItem }) {
  const [search,   setSearch]   = useState('')
  const [selAct,   setSelAct]   = useState(editItem?.actividad_id || '')
  const [cant,     setCant]     = useState(String(editItem?.cant ?? 1))
  const [dropOpen, setDropOpen] = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    if (open) {
      if (editItem) {
        setSelAct(editItem.actividad_id)
        setCant(String(editItem.cant))
        const cat = catalogCW.find(c => c.actividad_id === editItem.actividad_id)
        setSearch(cat ? `${cat.actividad_id} — ${cat.nombre}` : editItem.actividad_id)
      } else {
        setSelAct(''); setCant('1'); setSearch('')
      }
      setDropOpen(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, editItem])

  const usados = new Set((liq?.items || []).map(i => i.actividad_id))
  const opts = useMemo(() => {
    const q = search.toLowerCase()
    return catalogCW.filter(c => {
      if (editItem ? c.actividad_id !== editItem.actividad_id && usados.has(c.actividad_id) : usados.has(c.actividad_id)) return false
      if (!q || q === `${c.actividad_id} — ${c.nombre}`.toLowerCase()) return true
      return (c.actividad_id + ' ' + c.nombre).toLowerCase().includes(q)
    })
  }, [search, catalogCW, liq, editItem])

  function selectAct(c) {
    setSelAct(c.actividad_id)
    setSearch(`${c.actividad_id} — ${c.nombre}`)
    setDropOpen(false)
  }

  function handleSubmit() {
    const cat = catalogCW.find(c => c.actividad_id === selAct)
    if (!cat) { showToast('Selecciona una actividad', 'err'); return }
    const cantN = parseFloat(cant) || 0
    const esRural = liq?.tipo_zona === 'RURAL'
    onAdd({
      actividad_id: cat.actividad_id,
      nombre:       cat.nombre,
      unidad:       cat.unidad,
      cant:         cantN,
      precio_nokia: esRural ? cat.precio_nokia_rural : cat.precio_nokia_urbano,
      precio_subc:  esRural ? cat.precio_subc_rural  : cat.precio_subc_urbano,
    })
    if (editItem) {
      onClose()
    } else {
      setSelAct(''); setSearch(''); setCant('1')
    }
  }

  // Selected item detail
  const selCat = selAct ? catalogCW.find(c => c.actividad_id === selAct) : null
  const esRural = liq?.tipo_zona === 'RURAL'
  const pN = selCat ? (esRural ? selCat.precio_nokia_rural : selCat.precio_nokia_urbano) : 0
  const pS = selCat ? (esRural ? selCat.precio_subc_rural  : selCat.precio_subc_urbano)  : 0

  if (!open) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ background: '#fff', borderRadius: 10, width: '92%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ background: '#0f4c75', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #48cae4', borderRadius: '10px 10px 0 0', flexShrink: 0 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, margin: 0 }}>
            {editItem ? <><IconEdit /> Editar ítem CW</> : '＋ Agregar Ítem CW'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="fg">
            <label className="fl" style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Ítem / Actividad CW</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                type="text" className="fc"
                placeholder="Buscar por ID o nombre…"
                value={search}
                onChange={e => { setSearch(e.target.value); setSelAct(''); setDropOpen(true) }}
                onFocus={() => setDropOpen(true)}
              />
              {dropOpen && opts.length > 0 && (
                <div style={{ position: 'absolute', zIndex: 999, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto' }}>
                  {opts.slice(0, 50).map(c => (
                    <div
                      key={c.actividad_id}
                      style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12, background: selAct === c.actividad_id ? '#f0f7f0' : 'transparent', borderBottom: '1px solid #f0f0f0' }}
                      onMouseDown={() => selectAct(c)}
                    >
                      <span style={{ fontWeight: 700, color: '#0f4c75', marginRight: 6 }}>{c.actividad_id}</span>
                      <span style={{ color: '#333' }}>{c.nombre}</span>
                      <span style={{ float: 'right', fontSize: 10, color: '#999' }}>{c.unidad}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Full description + prices */}
          {selCat && (
            <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', marginBottom: 6, lineHeight: 1.4 }}>
                {selCat.nombre}
              </div>
              <div style={{ fontSize: 11, color: '#555' }}>
                Unidad: <strong>{selCat.unidad}</strong>
                {' | '}Nokia: <strong style={{ color: '#144E4A' }}>{cop(pN)}</strong>
                {' | '}SubC: <strong style={{ color: '#b45309' }}>{cop(pS)}</strong>
                {' | '}<span style={{ color: '#777' }}>Zona: {liq?.tipo_zona || 'URBANO'}</span>
              </div>
            </div>
          )}

          <div className="fg" style={{ maxWidth: 160 }}>
            <label className="fl" style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Cantidad</label>
            <input type="number" className="fc" min="0" step="any" value={cant} onChange={e => setCant(e.target.value)} />
          </div>

          {!editItem && (
            <div style={{ fontSize: 10, color: '#9ca89c', textAlign: 'center' }}>
              El modal permanece abierto para agregar más ítems.
            </div>
          )}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn bou" onClick={onClose}>Cerrar</button>
          <button className="btn bp" onClick={handleSubmit} disabled={!selAct}>
            {editItem ? '✓ Actualizar' : '＋ Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const MANUAL_ID = '__MANUAL__'

// ── Manual Valor Modal ────────────────────────────────────────────
function ManualValorModal({ open, onClose, onSave, existing }) {
  const [venta, setVenta] = useState('')
  const [costo, setCosto] = useState('')

  useEffect(() => {
    if (open) {
      setVenta(existing ? String(existing.precio_nokia) : '')
      setCosto(existing ? String(existing.precio_subc)  : '')
    }
  }, [open, existing])

  function handleSave() {
    const v = parseFloat(venta) || 0
    const c = parseFloat(costo) || 0
    if (v <= 0 && c <= 0) { showToast('Ingresa al menos un valor mayor a 0', 'err'); return }
    onSave(v, c)
    onClose()
  }

  if (!open) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ background: '#fff', borderRadius: 10, width: '92%', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div style={{ background: '#0f4c75', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #48cae4', borderRadius: '10px 10px 0 0' }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, margin: 0 }}>
            {existing ? '✏ Editar Valor Manual' : '＋ Valor Manual CW'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#1d4ed8' }}>
            Actividad: <strong>CW liquidada sin Preciario</strong> · Unidad: <strong>Sitio</strong> · Cant: <strong>1</strong>
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl" style={{ color: '#144E4A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>Venta Nokia CW (COP)</label>
            <input
              autoFocus
              type="number" className="fc" min="0"
              style={{ borderColor: '#144E4A', fontWeight: 700, fontSize: 14, color: '#144E4A' }}
              value={venta}
              onChange={e => setVenta(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl" style={{ color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>Costo SubC CW (COP)</label>
            <input
              type="number" className="fc" min="0"
              style={{ borderColor: '#FFC000', fontWeight: 700, fontSize: 14, color: '#b45309' }}
              value={costo}
              onChange={e => setCosto(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn bou" onClick={onClose}>Cancelar</button>
          <button className="btn bp" onClick={handleSave}>✓ {existing ? 'Actualizar' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main CW Liquidador View ───────────────────────────────────────
export default function CWLiquidadorView({ sitio }) {
  const catalogCW        = useAppStore(s => s.catalogCW)
  const liquidaciones_cw = useAppStore(s => s.liquidaciones_cw)
  const saveLiqCW        = useAppStore(s => s.saveLiqCW)
  const marcarFinalLiqCW = useAppStore(s => s.marcarFinalLiqCW)
  const subcs            = useAppStore(s => s.subcs)
  const user             = useAppStore(s => s.user)

  const [modalAdd,    setModalAdd]    = useState(false)
  const [editItem,    setEditItem]    = useState(null)
  const [modalManual, setModalManual] = useState(false)
  const { confirm, ConfirmModalUI } = useConfirm()

  const isViewer = user?.role === 'viewer'
  const isAdmin  = user?.role === 'admin'
  const isCoord  = user?.role === 'coord'
  const canWrite = !isViewer

  // Find or create liq on mount
  const liq = liquidaciones_cw.find(l => l.sitio_id === sitio.id) || null

  const manualItem = liq ? (liq.items || []).find(i => i.actividad_id === MANUAL_ID) : null

  function handleSaveManual(nokia, subc) {
    if (!liq) return
    const newItem = { actividad_id: MANUAL_ID, nombre: 'CW liquidada sin Preciario', unidad: 'Sitio', cant: 1, precio_nokia: nokia, precio_subc: subc }
    const items = (liq.items || []).filter(i => i.actividad_id !== MANUAL_ID)
    saveLiqCW({ ...liq, items: [...items, newItem] })
    showToast('Valor manual guardado')
  }

  useEffect(() => {
    if (!liq) {
      const newLiq = {
        id: uuidv4(), sitio_id: sitio.id, smp: '', region: '',
        tipo_zona: 'URBANO', lc: sitio.lc || '', estado: 'pre', items: [], fecha: '',
      }
      saveLiqCW(newLiq)
    }
  }, [sitio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const calc     = liq ? calcLiq(liq) : { totNokia: 0, totSubc: 0, utilidad: 0, margen: 0 }
  const locked   = liq?.estado === 'final'
  const subcItems = (liq?.items || []).filter(i => i.precio_subc > 0)
  const mc = calc.margen >= .3 ? '#1a7a1a' : calc.margen >= .2 ? '#FFC000' : '#c0392b'

  function updLiqField(field, val) {
    if (!liq) return
    saveLiqCW({ ...liq, [field]: val })
  }

  function updLiqTipoZona(tipo) {
    if (!liq) return
    const esRural = tipo === 'RURAL'
    const items = liq.items.map(item => {
      const cat = catalogCW.find(c => c.actividad_id === item.actividad_id)
      if (!cat) return item
      return {
        ...item,
        precio_nokia: esRural ? cat.precio_nokia_rural  : cat.precio_nokia_urbano,
        precio_subc:  esRural ? cat.precio_subc_rural   : cat.precio_subc_urbano,
      }
    })
    saveLiqCW({ ...liq, tipo_zona: tipo, items })
  }

  function updCant(actId, val) {
    if (!liq) return
    const items = liq.items.map(i => i.actividad_id === actId ? { ...i, cant: parseFloat(val) || 0 } : i)
    saveLiqCW({ ...liq, items })
  }

  function handleAddItem(item) {
    if (!liq) return
    const items = liq.items.filter(i => i.actividad_id !== item.actividad_id)
    saveLiqCW({ ...liq, items: [...items, item] })
    showToast(`${item.actividad_id} agregado`)
  }

  function handleEditItem(item) {
    if (!liq) return
    const items = liq.items.map(i => i.actividad_id === item.actividad_id ? item : i)
    saveLiqCW({ ...liq, items })
    showToast(`${item.actividad_id} actualizado`)
  }

  async function handleDelItem(actId) {
    if (!liq) return
    const ok = await confirm('Eliminar ítem', `¿Eliminar "${actId}" de la liquidación?`)
    if (!ok) return
    saveLiqCW({ ...liq, items: liq.items.filter(i => i.actividad_id !== actId) })
  }

  async function handleMarcarFinal() {
    if (!liq) return
    const ok = await confirm('Marcar como FINAL', 'Los precios quedarán congelados. ¿Continuar?')
    if (!ok) return
    await marcarFinalLiqCW(liq.id, 'final')
    showToast('✓ Liquidación CW marcada como FINAL')
  }

  async function handleReabrir() {
    if (!liq) return
    const ok = await confirm('Reabrir', '¿Regresar a estado PRE?')
    if (!ok) return
    await marcarFinalLiqCW(liq.id, 'pre')
    showToast('↩ Liquidación CW reabierta')
  }


  if (!liq) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#9ca89c' }}>Inicializando liquidación CW…</div>
  }

  return (
    <>
      {catalogCW.length === 0 && (
        <div style={{ marginBottom: 10, padding: '8px 14px', borderRadius: 6, background: '#fef9c3', border: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
          ⚠ Catálogo CW no cargado. Verifica la tabla <code>catalogo_cw</code> en Supabase y recarga.
        </div>
      )}

      {/* ── Metadata card ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-h" style={{ background: '#0f4c75', borderLeftColor: '#48cae4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff' }}>
            Liquidador CW: <span style={{ color: '#4ade80' }}>{sitio.nombre}</span>
          </h2>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {liq.estado === 'final'
              ? <span className="badge" style={{ background: '#1a7a1a', color: '#fff', fontSize: 9 }}>✓ FINAL</span>
              : <span className="badge" style={{ background: '#d68910', color: '#fff', fontSize: 9 }}>⏳ PRE</span>
            }
            {canWrite && (
              <button
                className="btn btn-sm"
                style={{ background: '#fff0f0', color: '#c0392b', border: '1px solid #fca5a5', fontSize: 9 }}
                onClick={handleEliminarLiq}
              >🗑</button>
            )}
          </div>
        </div>
        <div className="card-b">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">SMP / Código Nokia</label>
              <input
                type="text" className="fc" value={liq.smp || ''} disabled={locked}
                placeholder="Ej: CO_CAL_12345"
                onChange={e => saveLiqCW({ ...liq, smp: e.target.value })}
                onBlur={e => updLiqField('smp', e.target.value)}
              />
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Región</label>
              <select className="fc" value={liq.region || ''} disabled={locked} onChange={e => updLiqField('region', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Tipo Zona</label>
              <select className="fc" value={liq.tipo_zona || 'URBANO'} disabled={locked} onChange={e => updLiqTipoZona(e.target.value)}>
                <option value="URBANO">URBANO</option>
                <option value="RURAL">RURAL</option>
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">LC / Subcontratista CW</label>
              <select className="fc" value={liq.lc || ''} disabled={locked} onChange={e => updLiqField('lc', e.target.value)}>
                <option value="">— Seleccionar LC —</option>
                {subcs.map(s => <option key={s.lc} value={s.lc}>{s.lc}</option>)}
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Fecha</label>
              <input
                type="date" className="fc"
                value={liq.fecha || ''}
                disabled={locked}
                onChange={e => updLiqField('fecha', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Dual tables ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Nokia CW */}
        <div className="card">
          <div className="card-h" style={{ background: '#0f4c75', borderLeftColor: '#48cae4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#fff' }}>Nokia — Venta CW</h2>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="badge" style={{ background: '#48cae4', color: '#fff', fontSize: 10 }}>{liq.items.length} ítems</span>
              {canWrite && !locked && (
                <>
                  <button className="btn btn-sm" style={{ background: '#48cae4', color: '#fff', fontWeight: 700 }} onClick={() => { setEditItem(null); setModalAdd(true) }}>
                    ＋ Ítem CW
                  </button>
                  <button className="btn btn-sm" style={{ background: '#fff', color: '#0f4c75', border: '1px solid #48cae4', fontWeight: 700 }} onClick={() => setModalManual(true)}>
                    ＋ Valor Manual
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{ padding: 0, overflowX: 'auto', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
            <table className="tbl" style={{ minWidth: 420 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ minWidth: 180 }}>Actividad CW</th>
                  <th>Unidad</th>
                  <th className="num">Cant</th>
                  <th className="num" style={{ color: '#144E4A' }}>P. Nokia</th>
                  <th className="num" style={{ color: '#144E4A' }}>Total Nokia</th>
                  {canWrite && !locked && <th style={{ width: 60 }} />}
                </tr>
              </thead>
              <tbody>
                {liq.items.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca89c' }}>Sin ítems — usa <strong>＋ Ítem CW</strong></td></tr>
                )}
                {liq.items.map(item => {
                  const isManual = item.actividad_id === MANUAL_ID
                  return (
                    <tr key={item.actividad_id} style={isManual ? { background: '#eff6ff' } : {}}>
                      <td style={{ fontSize: 10 }}>
                        {isManual
                          ? <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{item.nombre}</span>
                          : <><span style={{ fontWeight: 700, color: '#0f4c75', marginRight: 5 }}>{item.actividad_id}</span>{item.nombre}</>
                        }
                      </td>
                      <td><span className="badge" style={{ background: '#f0f7f0', color: '#555f55', fontSize: 8 }}>{item.unidad}</span></td>
                      <td className="num">
                        {!isManual && canWrite && !locked
                          ? <input type="number" min="0" step="any" style={{ width: 52, textAlign: 'right', border: '1px solid #ddd', borderRadius: 4, padding: '2px 4px', fontSize: 11 }} value={item.cant} onChange={e => updCant(item.actividad_id, e.target.value)} />
                          : <span>{item.cant}</span>}
                      </td>
                      <td className="num" style={{ color: '#144E4A' }}>{cop(item.precio_nokia)}</td>
                      <td className="num fw7" style={{ color: '#144E4A' }}>{cop((item.cant || 0) * item.precio_nokia)}</td>
                      {canWrite && !locked && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {isManual
                            ? <button className="btn-del" style={{ marginRight: 3, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd' }} onClick={() => setModalManual(true)} title="Editar valor manual">✎</button>
                            : <button className="btn-del" style={{ marginRight: 3, background: '#f0f7ff', color: '#1d4ed8', border: '1px solid #93c5fd' }} onClick={() => { setEditItem(item); setModalAdd(true) }} title="Editar">✎</button>
                          }
                          <button className="btn-del" onClick={() => handleDelItem(item.actividad_id)} title="Eliminar">✕</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#91A8A7', borderTop: '2px solid #144E4A' }}>
                  <td colSpan={3} style={{ fontWeight: 800, padding: 8 }}>TOTAL NOKIA CW</td>
                  <td />
                  <td className="num fw8" style={{ fontSize: 13, padding: 8 }}>{cop(calc.totNokia)}</td>
                  {canWrite && !locked && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* SubC CW */}
        <div className="card">
          <div className="card-h" style={{ background: '#FFF0CE', borderLeftColor: '#FFC000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#92400e' }}>SubC — Costo CW</h2>
            <span className="badge" style={{ background: '#FFC000', color: '#000', fontSize: 10 }}>{liq.lc || 'SubC CW'}</span>
          </div>
          <div style={{ padding: 0, overflowX: 'auto', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
            <table className="tbl" style={{ minWidth: 420 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  {[
                    { label: 'Actividad CW', cls: '', extra: { minWidth: 180 } },
                    { label: 'Unidad',       cls: '' },
                    { label: 'Cant',         cls: 'num' },
                    { label: 'P. SubC',      cls: 'num' },
                    { label: 'Total SubC',   cls: 'num' },
                  ].map(col => (
                    <th key={col.label} className={col.cls} style={{ background: '#FFF0CE', color: '#92400e', borderBottom: '2px solid #FFC000', ...(col.extra || {}) }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subcItems.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca89c' }}>Sin ítems con precio SubC</td></tr>
                )}
                {subcItems.map(item => (
                  <tr key={item.actividad_id} style={item.actividad_id === MANUAL_ID ? { background: '#fffbeb' } : {}}>
                    <td style={{ fontSize: 10 }}>
                      {item.actividad_id === MANUAL_ID
                        ? <span style={{ fontWeight: 700, color: '#b45309' }}>{item.nombre}</span>
                        : <><span style={{ fontWeight: 700, color: '#b45309', marginRight: 5 }}>{item.actividad_id}</span>{item.nombre}</>
                      }
                    </td>
                    <td><span className="badge" style={{ background: '#fff7ed', color: '#b45309', fontSize: 8 }}>{item.unidad}</span></td>
                    <td className="num fw6">{item.cant}</td>
                    <td className="num" style={{ color: '#b45309' }}>{cop(item.precio_subc)}</td>
                    <td className="num fw7" style={{ color: '#b45309' }}>{cop((item.cant || 0) * item.precio_subc)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#FFF0CE', borderTop: '2px solid #FFC000' }}>
                  <td colSpan={3} style={{ fontWeight: 800, padding: 8, color: '#92400e' }}>TOTAL SUBC CW</td>
                  <td />
                  <td className="num fw8" style={{ color: '#92400e', fontSize: 13, padding: 8 }}>{cop(calc.totSubc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ── Utilidad & Margen ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14 }}>
        <div className="card">
          <div className="card-h"><h2>Utilidad &amp; Margen CW</h2></div>
          <div className="card-b">
            <div className="fb" style={{ marginBottom: 4 }}>
              <span style={{ color: '#144E4A', fontWeight: 700 }}>Venta Nokia CW</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#144E4A' }}>{cop(calc.totNokia)}</span>
            </div>
            <div className="fb" style={{ marginBottom: 8 }}>
              <span style={{ color: '#b45309' }}>Costo SubC CW</span>
              <span style={{ fontWeight: 700, color: '#b45309' }}>{cop(calc.totSubc)}</span>
            </div>
            <div className="fb" style={{ borderTop: '1px solid #e0e4e0', paddingTop: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>UTILIDAD CW</span>
              <span style={{ fontWeight: 800, fontSize: 22, color: mc }}>{cop(calc.utilidad)}</span>
            </div>
            <div className="fb" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>% MARGEN CW</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: mc }}>{pct(calc.margen)}</span>
            </div>
            <div className="mbar">
              <div className={`mfill ${mfcls(calc.margen)}`} style={{ width: `${Math.min(calc.margen * 100, 100)}%` }} />
            </div>
          </div>
        </div>

      </div>

      <AddItemModal
        open={modalAdd}
        onClose={() => { setModalAdd(false); setEditItem(null) }}
        onAdd={editItem ? handleEditItem : handleAddItem}
        liq={liq}
        catalogCW={catalogCW}
        editItem={editItem}
      />
      <ManualValorModal
        open={modalManual}
        onClose={() => setModalManual(false)}
        onSave={handleSaveManual}
        existing={manualItem}
      />
      <ConfirmModalUI />
    </>
  )
}
