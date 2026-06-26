import { useState, useEffect } from 'react'
import Modal from '../components/Modal'
import { useAppStore } from '../store/useAppStore'
import { showToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { buildTiposCuadrilla } from '../lib/cuadrilla'

const CATS = ['A', 'AA', 'AAA']
const REGIONES = ['R1 – Costa', 'R2 – Noroccidente', 'R3 – Suroccidente', 'R4 – Centro', 'R5 – Oriente']

const EMPTY = { lc: '', empresa: '', cat: 'A', tel: '', email: '', tipoCuadrilla: '', esInterna: false, activo: true, region: '' }

export default function SubcModal({ open, onClose, subc = null, hasSitios = false }) {
  const [form,   setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const [migrateOpen,  setMigrateOpen]  = useState(false)
  const [migrateLc,    setMigrateLc]    = useState('')
  const [migrating,    setMigrating]    = useState(false)
  const [correctOpen,  setCorrectOpen]  = useState(false)
  const [correcting,   setCorrecting]   = useState(false)

  const sitios           = useAppStore(s => s.sitios)
  const subcs           = useAppStore(s => s.subcs)
  const crearSubc       = useAppStore(s => s.crearSubc)
  const actualizarSubc  = useAppStore(s => s.actualizarSubc)
  const migrarSubc      = useAppStore(s => s.migrarSubc)
  const toggleSubcActivo = useAppStore(s => s.toggleSubcActivo)
  const empresaConfig   = useAppStore(s => s.empresaConfig)
  const { confirm, ConfirmModalUI } = useConfirm()

  const TIPOS = buildTiposCuadrilla(empresaConfig?.nombre_corto, empresaConfig?.tipos_cuadrilla || [])

  const isEdit    = !!subc
  const isScytel  = form.tipoCuadrilla.toUpperCase().includes('SCYTEL')
  const isInactivo = isEdit && subc?.activo === false
  const nSitiosLc = isEdit ? sitios.filter(x => x.lc === subc.lc).length : 0

  useEffect(() => {
    if (open) {
      setForm(subc
        ? { lc: subc.lc, empresa: subc.empresa || '', cat: subc.cat || 'A', tel: subc.tel || '', email: subc.email || '', tipoCuadrilla: subc.tipoCuadrilla || TIPOS[0], esInterna: subc.esInterna || false, activo: subc.activo !== false, region: subc.region || '' }
        : { ...EMPTY, tipoCuadrilla: TIPOS[0] }
      )
      setError('')
      setMigrateOpen(false)
      setMigrateLc('')
      setCorrectOpen(false)
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
        await actualizarSubc(subc.lc, form)
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

  function startMigrate() {
    const destino = !form.esInterna
    setMigrateLc(`${form.lc} (${destino ? 'Interna' : 'Externa'})`)
    setMigrateOpen(true)
    setCorrectOpen(false)
    setError('')
  }

  async function confirmMigrate() {
    const lcNuevo = migrateLc.trim()
    if (!lcNuevo) { setError('El nuevo LC es requerido'); return }
    setMigrating(true)
    try {
      const nuevo = await migrarSubc(subc.lc, { newLc: lcNuevo, esInterna: !form.esInterna })
      showToast(`${subc.lc} migrado a ${nuevo.lc}`)
      handleClose()
    } catch (e) {
      setError('Error: ' + (e.message || 'revisa la conexión'))
    } finally {
      setMigrating(false)
    }
  }

  function startCorrect() {
    setCorrectOpen(true)
    setMigrateOpen(false)
    setError('')
  }

  async function confirmCorrect() {
    setCorrecting(true)
    try {
      await actualizarSubc(subc.lc, { ...form, esInterna: !form.esInterna })
      showToast(`${subc.lc} corregido a ${!form.esInterna ? 'Interna' : 'Externa'}`)
      handleClose()
    } catch (e) {
      setError('Error: ' + (e.message || 'revisa la conexión'))
    } finally {
      setCorrecting(false)
    }
  }

  async function handleInactivar() {
    const ok = await confirm(
      'Inactivar Subcontratista',
      `¿Marcar "${subc.lc} — ${subc.empresa}" como inactiva? Dejará de aparecer en los selectores para asignar sitios nuevos, pero conserva su histórico.`
    )
    if (!ok) return
    setSaving(true)
    try {
      await toggleSubcActivo(subc.lc)
      showToast(`${subc.lc} inactivado`)
      handleClose()
    } catch (e) {
      setError('Error: ' + (e.message || 'revisa la conexión'))
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivar() {
    setSaving(true)
    try {
      await toggleSubcActivo(subc.lc)
      showToast(`${subc.lc} reactivado`)
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
          {isInactivo ? (
            <button className="btn bp" onClick={handleReactivar} disabled={saving}>
              {saving ? 'Reactivando…' : '↺ Reactivar'}
            </button>
          ) : (
            <>
              {isEdit && (
                <button className="btn" style={{ color: '#dc2626' }} onClick={handleInactivar} disabled={saving}>
                  {saving ? 'Inactivando…' : '⏸ Inactivar'}
                </button>
              )}
              <button className="btn bp" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Guardando…' : isEdit ? '✓ Actualizar' : '✓ Crear'}
              </button>
            </>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isInactivo && (
          <div style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#4b5563' }}>
            <strong>Inactiva</strong> — esta cuadrilla fue migrada a otra modalidad. Se conserva para que los sitios ya ejecutados mantengan su costeo histórico.
          </div>
        )}
        <div className="g2">
          <div className="fg">
            <label className="fl">LC / Código *</label>
            <input
              type="text" className="fc"
              placeholder="Ej: LC001"
              value={form.lc}
              onChange={e => upd('lc', e.target.value)}
              disabled={isEdit && hasSitios}
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
          <label className="fl">Empresa *</label>
          <input
            type="text" className="fc"
            placeholder="Ej: Constructora Ejemplo S.A.S"
            value={form.empresa}
            onChange={e => upd('empresa', e.target.value)}
            autoFocus={isEdit}
          />
        </div>

        <div className="g2">
          <div className="fg">
            <label className="fl">Tipo de Cuadrilla</label>
            <select className="fc" value={form.tipoCuadrilla} onChange={e => {
              const val = e.target.value
              setForm(f => ({ ...f, tipoCuadrilla: val, esInterna: val.toUpperCase().includes('SCYTEL') ? false : f.esInterna }))
              setError('')
            }}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Región (Homebase)</label>
            <select className="fc" value={form.region} onChange={e => upd('region', e.target.value)}>
              <option value="">— Sin región —</option>
              {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
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

        {!isScytel && !isInactivo && (
          isEdit && hasSitios ? (
            <div style={{ background: '#f8faff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 13 }}>
                Modalidad actual: <strong>{form.esInterna ? 'Interna' : 'Externa'}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>
                Esta cuadrilla ya ejecutó sitios — cambiar la modalidad aquí afectaría retroactivamente
                el costeo de lo ya ejecutado.
              </div>

              {!migrateOpen && !correctOpen && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn bou btn-sm" onClick={startMigrate}>
                    ⇄ Migrar a {form.esInterna ? 'Externa' : 'Interna'}
                  </button>
                  <button type="button" className="btn bou btn-sm" onClick={startCorrect}>
                    ✏️ Corregir modalidad (mismo LC)
                  </button>
                </div>
              )}

              {migrateOpen && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Usa esto cuando la cuadrilla realmente <strong>cambia</strong> de modalidad hacia adelante.
                    Se crea un LC nuevo; el actual queda inactivo conservando su histórico.
                  </div>
                  <label className="fl">Nuevo LC para la modalidad {form.esInterna ? 'Externa' : 'Interna'}</label>
                  <input className="fc" value={migrateLc} onChange={e => setMigrateLc(e.target.value)} autoFocus />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn bou btn-sm" onClick={() => setMigrateOpen(false)} disabled={migrating}>
                      Cancelar
                    </button>
                    <button type="button" className="btn bp btn-sm" onClick={confirmMigrate} disabled={migrating}>
                      {migrating ? 'Migrando…' : 'Confirmar migración'}
                    </button>
                  </div>
                </div>
              )}

              {correctOpen && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#991b1b', lineHeight: 1.4 }}>
                    ⚠️ Esto recalculará retroactivamente el costeo de <strong>{nSitiosLc} sitio{nSitiosLc !== 1 ? 's' : ''}</strong> ya
                    ejecutado{nSitiosLc !== 1 ? 's' : ''} por <strong>{subc.lc}</strong>, pasando de{' '}
                    <strong>{form.esInterna ? 'Interna' : 'Externa'}</strong> a <strong>{!form.esInterna ? 'Interna' : 'Externa'}</strong>.
                    Úsalo solo si la cuadrilla <strong>siempre fue</strong> {!form.esInterna ? 'interna' : 'externa'} y el dato se
                    cargó mal — no para un cambio real de modalidad (para eso usa "Migrar").
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn bou btn-sm" onClick={() => setCorrectOpen(false)} disabled={correcting}>
                      Cancelar
                    </button>
                    <button type="button" className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={confirmCorrect} disabled={correcting}>
                      {correcting ? 'Corrigiendo…' : `Sí, corregir — afecta ${nSitiosLc} sitio${nSitiosLc !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.esInterna}
                onChange={e => upd('esInterna', e.target.checked)}
              />
              Cuadrilla interna (nómina Ingetel) — liquidación SUBC = $0
            </label>
          )
        )}

        {error && <div className="alert al-e">{error}</div>}
      </div>
      <ConfirmModalUI />
    </Modal>
  )
}
