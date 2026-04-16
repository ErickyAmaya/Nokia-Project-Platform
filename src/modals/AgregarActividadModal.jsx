import { useState, useMemo } from 'react'
import Modal from '../components/Modal'
import { CAT, getPrecio, cop } from '../lib/catalog'

// Sections that map to tipo
const SECCS = [
  { sec: 'MODERNIZACION', tipo: 'BASE', label: 'Modernización' },
  { sec: '5G',            tipo: 'BASE', label: '5G' },
  { sec: 'MIMO',          tipo: 'BASE', label: 'MIMO' },
  { sec: 'SITIO_NUEVO',   tipo: 'BASE', label: 'Sitio Nuevo' },
  { sec: 'ADJ',           tipo: 'ADJ',  label: 'Adjuntas (ADJ)' },
  { sec: 'CR',            tipo: 'CR',   label: 'Recursos CR' },
]

// TSS sections
const SECCS_TSS = [
  { sec: 'TSS', tipo: 'BASE', label: 'TSS' },
]

// Items by tipo
const ITEMS_BY_TIPO = {
  BASE: CAT.BASE.filter(a => !a.id.startsWith('TSS_')),
  ADJ:  CAT.ADJ,
  CR:   CAT.CR,
  TSS:  CAT.BASE.filter(a => a.id.startsWith('TSS_')),
}

export default function AgregarActividadModal({ open, onClose, onAdd, sitio, subcs = [] }) {
  const [secIdx,  setSecIdx]  = useState(0)
  const [selId,   setSelId]   = useState('')
  const [cant,    setCant]    = useState(1)

  const isTSS = sitio?.tipo === 'TSS'
  const secciones = isTSS ? SECCS_TSS : SECCS
  const seccion   = secciones[secIdx] || secciones[0]
  const cat       = sitio?.catEfectiva || sitio?.cat || 'A'
  const ciudad    = sitio?.ciudad || 'Ciudad_Principal'

  const items = useMemo(() => ITEMS_BY_TIPO[seccion.tipo] || [], [seccion.tipo])

  const selItem = useMemo(() => items.find(i => i.id === selId), [items, selId])

  const precios = useMemo(() => {
    if (!selItem) return { nokia: 0, subc: 0 }
    return getPrecio(seccion.tipo, selItem.id, ciudad, cat, null)
  }, [selItem, seccion, ciudad, cat])

  function handleChangeSeccion(idx) {
    setSecIdx(idx)
    setSelId('')
    setCant(1)
  }

  function handleClose() {
    setSecIdx(0)
    setSelId('')
    setCant(1)
    onClose()
  }

  function handleAdd() {
    if (!selId || cant <= 0) return
    const act = {
      sec:  seccion.sec,
      tipo: seccion.tipo,
      id:   selId,
      cant: Number(cant),
    }
    onAdd(act)
    // reset id + cant but keep section
    setSelId('')
    setCant(1)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="＋ Agregar Actividad"
      maxWidth={520}
      footer={
        <>
          <button className="btn bou" onClick={handleClose}>Cerrar</button>
          <button
            className="btn bp"
            onClick={handleAdd}
            disabled={!selId || cant <= 0}
          >
            ＋ Agregar
          </button>
        </>
      }
    >
      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {secciones.map((s, i) => (
          <button
            key={s.sec}
            className={`btn btn-sm ${i === secIdx ? 'bp' : 'bou'}`}
            style={{ fontSize: 10 }}
            onClick={() => handleChangeSeccion(i)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Activity select */}
      <div className="fg" style={{ marginBottom: 12 }}>
        <label className="fl">Actividad</label>
        <select
          className="fc"
          value={selId}
          onChange={e => setSelId(e.target.value)}
        >
          <option value="">— Seleccionar actividad —</option>
          {items.map(item => (
            <option key={item.id} value={item.id}>
              {item.nombre} ({item.unidad})
            </option>
          ))}
        </select>
      </div>

      {/* Quantity */}
      <div className="fg" style={{ marginBottom: 12 }}>
        <label className="fl">Cantidad</label>
        <input
          type="number" className="fc"
          min="0" step="1"
          value={cant}
          onChange={e => setCant(Math.max(0, parseInt(e.target.value) || 0))}
        />
      </div>

      {/* Price preview */}
      {selItem && (
        <div style={{
          background: '#f8faf8', borderRadius: 6,
          border: '1px solid #d4e4d4', padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555f55', marginBottom: 6 }}>
            PREVIEW DE PRECIOS — {cat} — {ciudad.replace('Ciudad_', '')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#144E4A', fontWeight: 700 }}>Nokia Unitario</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#144E4A' }}>{cop(precios.nokia)}</div>
              <div style={{ fontSize: 9, color: '#555f55' }}>× {cant} = {cop(precios.nokia * cant)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#b45309', fontWeight: 700 }}>SubC Unitario</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>{cop(precios.subc)}</div>
              <div style={{ fontSize: 9, color: '#555f55' }}>× {cant} = {cop(precios.subc * cant)}</div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
