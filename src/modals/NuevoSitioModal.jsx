import { useState } from 'react'
import Modal from '../components/Modal'
import { useAppStore } from '../store/useAppStore'
import { showToast } from '../components/Toast'

const CIUDADES = [
  { value: 'Ciudad_Principal',  label: 'Principal' },
  { value: 'Ciudad_Secundaria', label: 'Secundaria' },
  { value: 'Ciudad_Intermedia', label: 'Intermedia' },
  { value: 'Dificil Acceso',    label: 'Difícil Acceso' },
]

const REGIONES = [
  'R1 – Costa',
  'R2 – Noroccidente',
  'R3 – Suroccidente',
  'R4 – Centro',
  'R5 – Oriente',
]

const EMPTY = {
  nombre: '', fecha: '', ciudad: 'Ciudad_Principal',
  region: 'R4 – Centro', lc: '',
}

export default function NuevoSitioModal({ open, onClose, onCreated }) {
  const [form,   setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const subcs      = useAppStore(s => s.subcs)
  const sitios     = useAppStore(s => s.sitios)
  const crearSitio = useAppStore(s => s.crearSitio)

  function upd(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  function handleClose() {
    setForm(EMPTY)
    setError('')
    onClose()
  }

  async function handleSubmit() {
    const nom = form.nombre.trim()
    if (!nom)     { setError('El nombre del sitio es requerido'); return }
    if (!form.lc) { setError('El LC es requerido'); return }
    if (sitios.find(s => s.id === nom)) { setError(`Ya existe un sitio con el nombre "${nom}"`); return }

    setSaving(true)
    try {
      const sub   = subcs.find(s => s.lc === form.lc)
      const sitio = await crearSitio({
        id:       nom,
        nombre:   nom,
        fecha:    form.fecha,
        ciudad:   form.ciudad,
        region:   form.region,
        lc:       form.lc,
        cat:      sub?.cat || 'A',
        tiene_cw: false,
        cw_conjunto: false,
        cw_nokia: 0,
      })
      showToast(`Sitio ${nom} creado`)
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
      title="🏗 Nuevo Sitio TI"
      footer={
        <>
          <button className="btn bou" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="btn bp"  onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : '✓ Crear Sitio'}
          </button>
        </>
      }
    >
      <div className="g2">
        <div className="fg">
          <label className="fl">Nombre del Sitio *</label>
          <input
            type="text" className="fc"
            placeholder="Ej: CAL.Vallegrande-3"
            value={form.nombre}
            onChange={e => upd('nombre', e.target.value)}
            autoFocus
          />
        </div>
        <div className="fg">
          <label className="fl">Fecha</label>
          <input
            type="date" className="fc"
            value={form.fecha}
            onChange={e => upd('fecha', e.target.value)}
          />
        </div>
      </div>

      <div className="g2">
        <div className="fg">
          <label className="fl">Tipo Ciudad *</label>
          <select className="fc" value={form.ciudad} onChange={e => upd('ciudad', e.target.value)}>
            {CIUDADES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">Región *</label>
          <select className="fc" value={form.region} onChange={e => upd('region', e.target.value)}>
            {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="fg">
        <label className="fl">LC / Subcontratista *</label>
        <select className="fc" value={form.lc} onChange={e => upd('lc', e.target.value)}>
          <option value="">— Seleccionar LC —</option>
          {subcs.map(s => (
            <option key={s.lc} value={s.lc}>{s.lc} — {s.empresa}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="alert al-e" style={{ marginTop: 8 }}>{error}</div>
      )}
    </Modal>
  )
}
