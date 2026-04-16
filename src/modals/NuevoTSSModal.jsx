import { useState } from 'react'
import Modal from '../components/Modal'
import { useAppStore } from '../store/useAppStore'
import { showToast } from '../components/Toast'
import { ZONAS } from '../lib/catalog'

const TIPOS_TSS = [
  { value: 'TSS_VR', label: 'TSS_VR (Visita + Reporte)' },
  { value: 'TSS_V',  label: 'TSS_V (Solo Visita)' },
  { value: 'TSS_R',  label: 'TSS_R (Solo Reporte)' },
  { value: 'TSS_RD', label: 'TSS_RD (Rediseño)' },
]

function newActividad() {
  return { tipo: 'TSS_VR', sitio: '', ciudad: 'Ciudad_Principal', cant: 1 }
}

const REGIONES = [
  'R1 – Costa',
  'R2 – Noroccidente',
  'R3 – Suroccidente',
  'R4 – Centro',
  'R5 – Oriente',
]

export default function NuevoTSSModal({ open, onClose, onCreated }) {
  const [nombre,  setNombre]  = useState('')
  const [fecha,   setFecha]   = useState('')
  const [region,  setRegion]  = useState('R4 – Centro')
  const [lc,      setLc]      = useState('')
  const [acts,    setActs]    = useState([newActividad()])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const subcs    = useAppStore(s => s.subcs)
  const sitios   = useAppStore(s => s.sitios)
  const crearTSS = useAppStore(s => s.crearTSS)

  function handleClose() {
    setNombre(''); setFecha(''); setLc(''); setRegion('R4 – Centro')
    setActs([newActividad()]); setError('')
    onClose()
  }

  function updAct(i, field, value) {
    setActs(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  function addAct()      { setActs(prev => [...prev, newActividad()]) }
  function removeAct(i)  { setActs(prev => prev.filter((_, idx) => idx !== i)) }

  /** Build actividades array matching legacy format */
  function buildActividades(actList) {
    const nokiaActs = actList.map(v => ({
      sec: 'TSS', tipo: 'BASE', id: v.tipo,
      ciudad: v.ciudad, sitioid: v.sitio, cant: v.cant,
      catOver: '', cardType: 'nokia',
    }))
    const subcActs = []
    actList.forEach(v => {
      if (v.tipo === 'TSS_V' || v.tipo === 'TSS_VR')
        subcActs.push({ sec: 'TSS', tipo: 'BASE', id: 'TSS_V', ciudad: v.ciudad, sitioid: v.sitio, cant: v.cant, catOver: '', cardType: 'subc' })
      if (v.tipo === 'TSS_R' || v.tipo === 'TSS_VR')
        subcActs.push({ sec: 'TSS', tipo: 'BASE', id: 'TSS_R', ciudad: v.ciudad, sitioid: v.sitio, cant: v.cant, catOver: '', cardType: 'subc' })
      if (v.tipo === 'TSS_RD')
        subcActs.push({ sec: 'TSS', tipo: 'BASE', id: 'TSS_RD', ciudad: v.ciudad, sitioid: v.sitio, cant: v.cant, catOver: '', cardType: 'subc' })
    })
    return [...nokiaActs, ...subcActs]
  }

  async function handleSubmit() {
    const nom = nombre.trim()
    if (!nom) { setError('El nombre es requerido'); return }
    if (!lc)  { setError('El LC es requerido'); return }
    if (!acts.length) { setError('Agrega al menos una actividad'); return }
    if (sitios.find(s => s.id === nom)) { setError(`Ya existe "${nom}"`); return }

    setSaving(true)
    try {
      const sub = subcs.find(s => s.lc === lc)
      const sitio = await crearTSS({
        id:          nom,
        nombre:      nom,
        fecha,
        lc,
        region,
        cat:         sub?.cat || 'A',
        actividades: buildActividades(acts),
      })
      showToast(`TSS ${nom} creado`)
      handleClose()
      onCreated?.(sitio)
    } catch (e) {
      setError('Error al guardar: ' + (e.message || 'revisa la conexión'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="🔍 Nuevo Sitio TSS"
      footer={
        <>
          <button className="btn bou" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="btn bp"  onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : '✓ Crear TSS'}
          </button>
        </>
      }
    >
      <div className="g2">
        <div className="fg">
          <label className="fl">Nombre del Sitio TSS *</label>
          <input
            type="text" className="fc"
            placeholder="Ej: TSS_Enero_2026"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setError('') }}
            autoFocus
          />
        </div>
        <div className="fg">
          <label className="fl">Fecha</label>
          <input type="date" className="fc" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
      </div>

      <div className="g2">
        <div className="fg">
          <label className="fl">Región *</label>
          <select className="fc" value={region} onChange={e => setRegion(e.target.value)}>
            {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">LC / Subcontratista Visita *</label>
          <select className="fc" value={lc} onChange={e => { setLc(e.target.value); setError('') }}>
            <option value="">— Seleccionar LC —</option>
            {subcs.map(s => (
              <option key={s.lc} value={s.lc}>{s.lc} — {s.empresa}</option>
            ))}
          </select>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--g2)', margin: '12px 0' }} />

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, marginBottom: 8, color: '#0d6e0d' }}>
        ACTIVIDADES A REGISTRAR
      </div>

      {acts.map((act, i) => (
        <div
          key={i}
          style={{ background: 'var(--g1)', borderRadius: 5, padding: 10, marginBottom: 7 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 70px auto', gap: 6, alignItems: 'end' }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Tipo (Nokia)</label>
              <select className="fc" style={{ fontSize: 11 }} value={act.tipo} onChange={e => updAct(i, 'tipo', e.target.value)}>
                {TIPOS_TSS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Nombre sitio</label>
              <input
                type="text" className="fc" style={{ fontSize: 11 }}
                placeholder="Ej: TOL.Espinal"
                value={act.sitio}
                onChange={e => updAct(i, 'sitio', e.target.value)}
              />
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Ciudad</label>
              <select className="fc" style={{ fontSize: 11 }} value={act.ciudad} onChange={e => updAct(i, 'ciudad', e.target.value)}>
                {ZONAS.map(z => (
                  <option key={z} value={z}>{z.replace('Ciudad_', '')}</option>
                ))}
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Cant</label>
              <input
                type="number"
                style={{ width: 60, border: '1.5px solid var(--g2)', borderRadius: 4, padding: '3px 5px', fontFamily: 'inherit', fontSize: 11, textAlign: 'center', outline: 'none' }}
                value={act.cant} min="1"
                onChange={e => updAct(i, 'cant', parseInt(e.target.value) || 1)}
              />
            </div>
            <button
              className="btn-del"
              style={{ alignSelf: 'flex-end', marginBottom: 1 }}
              onClick={() => removeAct(i)}
              disabled={acts.length === 1}
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <button className="btn bou btn-sm" onClick={addAct}>＋ Agregar Actividad</button>

      {error && (
        <div className="alert al-e" style={{ marginTop: 10 }}>{error}</div>
      )}
    </Modal>
  )
}
