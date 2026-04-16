import { useState } from 'react'
import Modal from '../components/Modal'
import { useAppStore } from '../store/useAppStore'
import { showToast } from '../components/Toast'

const CIUDADES = [
  { value: 'Ciudad_Principal',   label: 'Ciudad Principal' },
  { value: 'Ciudad_Secundaria',  label: 'Ciudad Secundaria' },
  { value: 'Ciudad_Intermedia',  label: 'Ciudad Intermedia' },
  { value: 'Dificil Acceso',     label: 'Difícil Acceso' },
]

const EMPTY = {
  nombre: '', fecha: '', ciudad: 'Ciudad_Principal',
  lc: '', cw: 'no', cw_nokia: '',
}

export default function NuevoSitioModal({ open, onClose, onCreated }) {
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const subcs      = useAppStore(s => s.subcs)
  const sitios     = useAppStore(s => s.sitios)
  const crearSitio = useAppStore(s => s.crearSitio)

  function set(field, value) {
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
    if (!nom)      { setError('El nombre del sitio es requerido'); return }
    if (!form.lc)  { setError('El LC es requerido'); return }
    if (sitios.find(s => s.id === nom)) { setError(`Ya existe un sitio con el nombre "${nom}"`); return }

    setSaving(true)
    try {
      const sub       = subcs.find(s => s.lc === form.lc)
      const tiene_cw  = form.cw !== 'no'
      const cw_conjunto = form.cw === 'conjunto'
      const sitio = await crearSitio({
        id:      nom,
        nombre:  nom,
        fecha:   form.fecha,
        ciudad:  form.ciudad,
        lc:      form.lc,
        cat:     sub?.cat || 'A',
        tiene_cw,
        cw_conjunto,
        cw_nokia: tiene_cw ? (parseInt(form.cw_nokia) || 0) : 0,
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
            onChange={e => set('nombre', e.target.value)}
            autoFocus
          />
        </div>
        <div className="fg">
          <label className="fl">Fecha</label>
          <input
            type="date" className="fc"
            value={form.fecha}
            onChange={e => set('fecha', e.target.value)}
          />
        </div>
      </div>

      <div className="g2">
        <div className="fg">
          <label className="fl">Tipo Ciudad *</label>
          <select className="fc" value={form.ciudad} onChange={e => set('ciudad', e.target.value)}>
            {CIUDADES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">LC / Subcontratista *</label>
          <select className="fc" value={form.lc} onChange={e => set('lc', e.target.value)}>
            <option value="">— Seleccionar LC —</option>
            {subcs.map(s => (
              <option key={s.lc} value={s.lc}>{s.lc} — {s.empresa}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="g2">
        <div className="fg">
          <label className="fl">¿Incluye CW (Obra Civil)?</label>
          <select className="fc" value={form.cw} onChange={e => set('cw', e.target.value)}>
            <option value="no">No aplica</option>
            <option value="si">Sí incluye CW</option>
            <option value="conjunto">CW en Conjunto</option>
          </select>
        </div>
        {form.cw !== 'no' && (
          <div className="fg">
            <label className="fl">Valor CW Nokia</label>
            <input
              type="number" className="fc"
              placeholder="0" min="0"
              value={form.cw_nokia}
              onChange={e => set('cw_nokia', e.target.value)}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="alert al-e" style={{ marginTop: 8 }}>{error}</div>
      )}
    </Modal>
  )
}
