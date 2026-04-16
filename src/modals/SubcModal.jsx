import { useState, useEffect } from 'react'
import Modal from '../components/Modal'
import { useAppStore } from '../store/useAppStore'
import { showToast } from '../components/Toast'
import { buildTiposCuadrilla } from '../lib/cuadrilla'

const CATS = ['A', 'AA', 'AAA']

const EMPTY = { lc: '', empresa: '', cat: 'A', tel: '', email: '', tipoCuadrilla: '' }

export default function SubcModal({ open, onClose, subc = null }) {
  const [form,   setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const subcs          = useAppStore(s => s.subcs)
  const crearSubc      = useAppStore(s => s.crearSubc)
  const actualizarSubc = useAppStore(s => s.actualizarSubc)
  const empresaConfig  = useAppStore(s => s.empresaConfig)

  const TIPOS = buildTiposCuadrilla(empresaConfig?.nombre_corto, empresaConfig?.tipos_cuadrilla || [])

  const isEdit = !!subc

  useEffect(() => {
    if (open) {
      setForm(subc
        ? { lc: subc.lc, empresa: subc.empresa || '', cat: subc.cat || 'A', tel: subc.tel || '', email: subc.email || '', tipoCuadrilla: subc.tipoCuadrilla || TIPOS[0] }
        : { ...EMPTY, tipoCuadrilla: TIPOS[0] }
      )
      setError('')
    }
  }, [open, subc])

  function upd(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  function handleClose() { setError(''); onClose() }

  async function handleSubmit() {
    const lc = form.lc.trim()
    if (!lc)            { setError('El LC es requerido'); return }
    if (!form.empresa.trim()) { setError('El nombre de empresa es requerido'); return }
    if (!isEdit && subcs.find(s => s.lc === lc)) {
      setError(`Ya existe un subcontratista con LC "${lc}"`)
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        await actualizarSubc(lc, form)
        showToast(`${lc} actualizado`)
      } else {
        await crearSubc(form)
        showToast(`${lc} creado`)
      }
      handleClose()
    } catch (e) {
      setError('Error: ' + (e.message || 'revisa la conexión'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `✏️ Editar — ${subc?.lc}` : '＋ Nuevo Subcontratista'}
      maxWidth={480}
      footer={
        <>
          <button className="btn bou" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="btn bp"  onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? '✓ Actualizar' : '✓ Crear'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="g2">
          <div className="fg">
            <label className="fl">LC / Código *</label>
            <input
              type="text" className="fc"
              placeholder="Ej: LC001"
              value={form.lc}
              onChange={e => upd('lc', e.target.value)}
              disabled={isEdit}
              autoFocus={!isEdit}
            />
          </div>
          <div className="fg">
            <label className="fl">Categoría</label>
            <select className="fc" value={form.cat} onChange={e => upd('cat', e.target.value)}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="fg">
          <label className="fl">Empresa / Nombre *</label>
          <input
            type="text" className="fc"
            placeholder="Ej: Constructora Ejemplo S.A.S"
            value={form.empresa}
            onChange={e => upd('empresa', e.target.value)}
            autoFocus={isEdit}
          />
        </div>

        <div className="fg">
          <label className="fl">Tipo de Cuadrilla</label>
          <select className="fc" value={form.tipoCuadrilla} onChange={e => upd('tipoCuadrilla', e.target.value)}>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="g2">
          <div className="fg">
            <label className="fl">Teléfono</label>
            <input
              type="tel" className="fc"
              placeholder="Ej: 300 000 0000"
              value={form.tel}
              onChange={e => upd('tel', e.target.value)}
            />
          </div>
          <div className="fg">
            <label className="fl">Email</label>
            <input
              type="email" className="fc"
              placeholder="contacto@empresa.com"
              value={form.email}
              onChange={e => upd('email', e.target.value)}
            />
          </div>
        </div>

        {error && <div className="alert al-e">{error}</div>}
      </div>
    </Modal>
  )
}
