import { useState, useEffect } from 'react'
import Modal from '../components/Modal'
import { useAppStore } from '../store/useAppStore'
import { showToast } from '../components/Toast'

const TIPOS = ['Logistica', 'Adicionales', 'Materiales TI', 'Materiales CW']

const EMPTY = { sitio: '', tipo: 'Logistica', desc: '', valor: '', sub_sitio: '' }

export default function GastoModal({ open, onClose, gasto = null, defaultSitio = '', blockedTipos = [] }) {
  const [form,   setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const sitios       = useAppStore(s => s.sitios)
  const agregarGasto = useAppStore(s => s.agregarGasto)
  const editarGasto  = useAppStore(s => s.editarGasto)

  const isEdit = !!gasto

  useEffect(() => {
    if (open) {
      if (gasto) {
        setForm({
          sitio:     gasto.sitio    || '',
          tipo:      gasto.tipo     || 'Logistica',
          desc:      gasto.desc     || '',
          valor:     String(gasto.valor || ''),
          sub_sitio: gasto.sub_sitio || '',
        })
      } else {
        setForm({ ...EMPTY, sitio: defaultSitio })
      }
      setError('')
    }
  }, [open, gasto, defaultSitio])

  function upd(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  function handleClose() {
    setError('')
    onClose()
  }

  async function handleSubmit() {
    if (!form.sitio)  { setError('Selecciona un sitio'); return }
    if (blockedTipos.includes(form.tipo)) {
      setError(`"${form.tipo}" se gestiona automáticamente desde Gestión de Materiales. Registra un despacho allí.`)
      return
    }
    if (!form.desc.trim()) { setError('La descripción es requerida'); return }
    const valor = parseFloat(form.valor) || 0
    if (valor <= 0) { setError('El valor debe ser mayor a 0'); return }

    setSaving(true)
    try {
      if (isEdit) {
        await editarGasto(gasto.id, { tipo: form.tipo, desc: form.desc.trim(), valor })
        showToast('Gasto actualizado')
      } else {
        await agregarGasto({
          sitio:     form.sitio,
          tipo:      form.tipo,
          desc:      form.desc.trim(),
          valor,
          sub_sitio: form.sub_sitio.trim() || null,
        })
        showToast('Gasto agregado')
      }
      handleClose()
    } catch (e) {
      setError('Error: ' + (e.message || 'revisa la conexión'))
    } finally {
      setSaving(false)
    }
  }

  // Is the selected sitio a TSS?
  const selectedSitio = sitios.find(s => s.id === form.sitio)
  const isTSS = selectedSitio?.tipo === 'TSS'

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? '✏️ Editar Gasto' : '＋ Agregar Gasto'}
      maxWidth={480}
      footer={
        <>
          <button className="btn bou" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="btn bp"  onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? '✓ Actualizar' : '✓ Agregar'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Sitio — only shown when not editing and no default */}
        {!isEdit && (
          <div className="fg">
            <label className="fl">Sitio *</label>
            <select className="fc" value={form.sitio} onChange={e => upd('sitio', e.target.value)}>
              <option value="">— Seleccionar sitio —</option>
              {sitios.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="fg">
          <label className="fl">Tipo</label>
          <select className="fc" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
            {TIPOS.map(t => (
              <option key={t} value={t} disabled={blockedTipos.includes(t)}>
                {t}{blockedTipos.includes(t) ? ' — automático (Gestión Mat.)' : ''}
              </option>
            ))}
          </select>
          {blockedTipos.includes(form.tipo) && (
            <div style={{ fontSize: 10, color: '#0369a1', marginTop: 4, background: '#e0f2fe', borderRadius: 4, padding: '4px 8px' }}>
              ↗ Este tipo se toma automáticamente de Gestión de Materiales
            </div>
          )}
        </div>

        <div className="fg">
          <label className="fl">Descripción *</label>
          <input
            type="text" className="fc"
            placeholder="Ej: Transporte a sitio"
            value={form.desc}
            onChange={e => upd('desc', e.target.value)}
            autoFocus
          />
        </div>

        <div className="fg">
          <label className="fl">Valor (COP) *</label>
          <input
            type="number" className="fc"
            placeholder="0" min="0"
            value={form.valor}
            onChange={e => upd('valor', e.target.value)}
          />
        </div>

        {isTSS && !isEdit && (
          <div className="fg">
            <label className="fl">Sub-Sitio (opcional)</label>
            <input
              type="text" className="fc"
              placeholder="Ej: Nombre del sitio dentro del TSS"
              value={form.sub_sitio}
              onChange={e => upd('sub_sitio', e.target.value)}
            />
          </div>
        )}

        {error && <div className="alert al-e">{error}</div>}
      </div>
    </Modal>
  )
}
