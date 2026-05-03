import { useState } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { showToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmModal'

const TABLAS = [
  { key: 'frEmpresas',   tabla: 'hw_fr_empresas',   label: 'Empresas Remitentes' },
  { key: 'frTecnicos',   tabla: 'hw_fr_tecnicos',   label: 'Técnicos / Diligenciado por' },
  { key: 'frEquipos',    tabla: 'hw_fr_equipos',    label: 'Equipos Nokia' },
  { key: 'frWbs',        tabla: 'hw_fr_wbs',        label: 'Orígenes de Reemplazo (WBS)' },
  { key: 'frRegionales', tabla: 'hw_fr_regionales', label: 'Regionales' },
]

// ── Sección genérica ─────────────────────────────────────────────
function SeccionSimple({ label, tabla, items }) {
  const saveFrItem   = useHwStore(s => s.saveFrItem)
  const deleteFrItem = useHwStore(s => s.deleteFrItem)
  const confirm      = useConfirm()
  const [nuevo, setNuevo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!nuevo.trim()) return
    setSaving(true)
    try { await saveFrItem(tabla, { nombre: nuevo.trim(), activo: true }); setNuevo('') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleDelete(item) {
    const ok = await confirm({ title: `Eliminar`, message: `¿Eliminar "${item.nombre}"?`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    try { await deleteFrItem(tabla, item.id); showToast('Eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#144E4A', letterSpacing: .6,
        textTransform: 'uppercase', marginBottom: 12 }}>{label}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 32 }}>
        {items.filter(i => i.activo !== false).map(item => (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#f0f4f0', border: '1px solid #d1d9d1', borderRadius: 6,
            fontSize: 11, padding: '3px 8px', color: '#374151' }}>
            {item.nombre}
            <button onClick={() => handleDelete(item)}
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
                fontSize: 14, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}>×</button>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>Sin registros</span>}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input className="fc" value={nuevo} onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Nuevo…" style={{ fontSize: 11, flex: 1 }} />
        <button onClick={handleAdd} disabled={saving || !nuevo.trim()}
          style={{ fontSize: 11, background: '#144E4A', color: '#fff', border: 'none',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
          + Agregar
        </button>
      </div>
    </div>
  )
}

// ── Sección Ciudades (vinculada a Regional) ───────────────────────
function SeccionCiudades() {
  const frRegionales = useHwStore(s => s.frRegionales)
  const frCiudades   = useHwStore(s => s.frCiudades)
  const saveFrItem   = useHwStore(s => s.saveFrItem)
  const deleteFrItem = useHwStore(s => s.deleteFrItem)
  const confirm      = useConfirm()

  const [regionalId, setRegionalId] = useState('')
  const [nuevo,      setNuevo]      = useState('')
  const [saving,     setSaving]     = useState(false)

  const ciudadesFiltradas = frCiudades.filter(c => String(c.regional_id) === String(regionalId))

  async function handleAdd() {
    if (!nuevo.trim() || !regionalId) return
    setSaving(true)
    try { await saveFrItem('hw_fr_ciudades', { nombre: nuevo.trim(), regional_id: Number(regionalId), activo: true }); setNuevo('') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleDelete(item) {
    const ok = await confirm({ title: 'Eliminar', message: `¿Eliminar "${item.nombre}"?`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    try { await deleteFrItem('hw_fr_ciudades', item.id); showToast('Eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#144E4A', letterSpacing: .6,
        textTransform: 'uppercase', marginBottom: 12 }}>Ciudades</div>

      <div style={{ marginBottom: 10 }}>
        <select className="fc" value={regionalId} onChange={e => setRegionalId(e.target.value)} style={{ fontSize: 11, width: 220 }}>
          <option value="">— Seleccionar Regional —</option>
          {frRegionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </div>

      {regionalId && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 32 }}>
            {ciudadesFiltradas.map(item => (
              <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#f0f4f0', border: '1px solid #d1d9d1', borderRadius: 6,
                fontSize: 11, padding: '3px 8px', color: '#374151' }}>
                {item.nombre}
                <button onClick={() => handleDelete(item)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
                    fontSize: 14, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}>×</button>
              </span>
            ))}
            {ciudadesFiltradas.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>Sin ciudades para esta regional</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="fc" value={nuevo} onChange={e => setNuevo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nueva ciudad…" style={{ fontSize: 11, flex: 1 }} />
            <button onClick={handleAdd} disabled={saving || !nuevo.trim()}
              style={{ fontSize: 11, background: '#144E4A', color: '#fff', border: 'none',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
              + Agregar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sección Sitios (vinculada a Ciudad) ───────────────────────────
function SeccionSitios() {
  const frRegionales = useHwStore(s => s.frRegionales)
  const frCiudades   = useHwStore(s => s.frCiudades)
  const frSitios     = useHwStore(s => s.frSitios)
  const saveFrItem   = useHwStore(s => s.saveFrItem)
  const deleteFrItem = useHwStore(s => s.deleteFrItem)
  const confirm      = useConfirm()

  const [regionalId, setRegionalId] = useState('')
  const [ciudadId,   setCiudadId]   = useState('')
  const [nuevo,      setNuevo]      = useState('')
  const [saving,     setSaving]     = useState(false)

  const ciudadesFiltradas = frCiudades.filter(c => String(c.regional_id) === String(regionalId))
  const sitiosFiltrados   = frSitios.filter(s => String(s.ciudad_id) === String(ciudadId))

  function handleRegionalChange(e) {
    setRegionalId(e.target.value)
    setCiudadId('')
  }

  async function handleAdd() {
    if (!nuevo.trim() || !ciudadId) return
    setSaving(true)
    try { await saveFrItem('hw_fr_sitios', { nombre: nuevo.trim(), ciudad_id: Number(ciudadId), activo: true }); setNuevo('') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  async function handleDelete(item) {
    const ok = await confirm({ title: 'Eliminar', message: `¿Eliminar "${item.nombre}"?`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    try { await deleteFrItem('hw_fr_sitios', item.id); showToast('Eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#144E4A', letterSpacing: .6,
        textTransform: 'uppercase', marginBottom: 12 }}>Sitios</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <select className="fc" value={regionalId} onChange={handleRegionalChange} style={{ fontSize: 11, width: 180 }}>
          <option value="">— Regional —</option>
          {frRegionales.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        <select className="fc" value={ciudadId} onChange={e => setCiudadId(e.target.value)}
          style={{ fontSize: 11, width: 180 }} disabled={!regionalId}>
          <option value="">— Ciudad —</option>
          {ciudadesFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {ciudadId && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 32 }}>
            {sitiosFiltrados.map(item => (
              <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#f0f4f0', border: '1px solid #d1d9d1', borderRadius: 6,
                fontSize: 11, padding: '3px 8px', color: '#374151' }}>
                {item.nombre}
                <button onClick={() => handleDelete(item)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
                    fontSize: 14, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}>×</button>
              </span>
            ))}
            {sitiosFiltrados.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>Sin sitios para esta ciudad</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="fc" value={nuevo} onChange={e => setNuevo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Nuevo sitio…" style={{ fontSize: 11, flex: 1 }} />
            <button onClick={handleAdd} disabled={saving || !nuevo.trim()}
              style={{ fontSize: 11, background: '#144E4A', color: '#fff', border: 'none',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
              + Agregar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────
export default function HwFrConfig() {
  const store = useHwStore()

  return (
    <>
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            Config — Tablas de Referencia FR
          </h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            Listas desplegables del Failure Report Nokia · Solo visible para Admin
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {TABLAS.map(t => (
          <SeccionSimple key={t.key} label={t.label} tabla={t.tabla} items={store[t.key]} />
        ))}
      </div>

      <SeccionCiudades />
      <SeccionSitios />
    </>
  )
}
