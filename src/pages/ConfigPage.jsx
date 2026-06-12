import { useState, useEffect, useRef } from 'react'
import { useAppStore }     from '../store/useAppStore'
import { useEmpresaStore } from '../store/useEmpresaStore'
import { useFactStore }  from '../store/useFactStore'
import { useMatStore }   from '../store/useMatStore'
import { showToast }     from '../components/Toast'
import { supabase }      from '../lib/supabase'

const APP_VERSION = '2.0.0'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Calendario de Facturación ─────────────────────────────────────
function CalendarioConfig() {
  const calendar            = useFactStore(s => s.calendar)
  const loadAll             = useFactStore(s => s.loadAll)
  const saveCalendarPeriod  = useFactStore(s => s.saveCalendarPeriod)
  const deleteCalendarPeriod = useFactStore(s => s.deleteCalendarPeriod)

  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState({ year: new Date().getFullYear(), month: 1, month_name: 'Enero', start_day: 1, cutoff_day: 25 })
  const [saving, setSaving]   = useState(false)

  useEffect(() => { if (!calendar.length) loadAll() }, [])

  function startNew() {
    setForm({ year: new Date().getFullYear(), month: 1, month_name: 'Enero', start_day: 1, cutoff_day: 25 })
    setEditing('new')
  }

  function startEdit(p) {
    setForm({ year: p.year, month: p.month, month_name: p.month_name, start_day: p.start_day, cutoff_day: p.cutoff_day })
    setEditing(p.id)
  }

  function updForm(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.year || !form.month || !form.start_day || !form.cutoff_day) { showToast('Completa todos los campos', 'err'); return }
    setSaving(true)
    try {
      const payload = { ...form, year: Number(form.year), month: Number(form.month), start_day: Number(form.start_day), cutoff_day: Number(form.cutoff_day), month_name: MONTH_NAMES[Number(form.month) - 1] }
      if (editing !== 'new') payload.id = editing
      await saveCalendarPeriod(payload)
      showToast('Periodo guardado')
      setEditing(null)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  const byYear = calendar.reduce((acc, c) => { (acc[c.year] = acc[c.year] || []).push(c); return acc }, {})

  return (
    <div className="card">
      <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Calendario de Facturación Nokia</h2>
        <button className="btn bp btn-sm" onClick={startNew}>+ Agregar periodo</button>
      </div>
      <div className="card-b">
        {editing && (
          <div style={{ background: '#f8faf8', borderRadius: 8, padding: 14, marginBottom: 16, border: '1px solid #e0e4e0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 10 }}>{editing === 'new' ? 'Nuevo periodo' : 'Editar periodo'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div className="fg">
                <label className="fl">Año</label>
                <input type="number" className="fc" value={form.year} onChange={e => updForm('year', e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Mes</label>
                <select className="fc" value={form.month} onChange={e => updForm('month', Number(e.target.value))}>
                  {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Día apertura</label>
                <input type="number" className="fc" min={1} max={31} value={form.start_day} onChange={e => updForm('start_day', e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Día cierre</label>
                <input type="number" className="fc" min={1} max={31} value={form.cutoff_day} onChange={e => updForm('cutoff_day', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn bp btn-sm">{saving ? 'Guardando…' : '✓ Guardar'}</button>
            </div>
          </div>
        )}

        {Object.keys(byYear).sort((a, b) => b - a).map(year => (
          <div key={year} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca89c', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>{year}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8faf8' }}>
                  {['Período', 'Apertura', 'Cierre', ''].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byYear[year].map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{p.month_name}</td>
                    <td style={{ padding: '6px 10px', color: '#555' }}>Día {p.start_day}</td>
                    <td style={{ padding: '6px 10px', color: '#555' }}>Día {p.cutoff_day}</td>
                    <td style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(p)} style={{ fontSize: 10, color: '#555', background: 'none', border: '1px solid #e0e4e0', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => { if (window.confirm('¿Eliminar?')) deleteCalendarPeriod(p.id) }} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Quitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {!calendar.length && !editing && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca89c', fontSize: 12 }}>Sin periodos configurados.</div>
        )}
      </div>
    </div>
  )
}

const BUCKET = 'logos'

// ── Helper: extrae path relativo dentro del bucket desde la URL pública
function pathFromUrl(url) {
  if (!url) return null
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx !== -1 ? decodeURIComponent(url.slice(idx + marker.length)) : null
}

// ── Componente reutilizable de subida de logo ─────────────────────
function LogoUploader({ label, hint, currentUrl, filename, onUrl, disabled }) {
  const fileRef   = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Solo se permiten imágenes', 'err'); return }
    if (file.size > 2 * 1024 * 1024)     { showToast('Máximo 2 MB', 'err'); return }
    setBusy(true)
    try {
      const path    = file.name
      const oldPath = pathFromUrl(currentUrl)
      if (oldPath && oldPath !== path) {
        await supabase.storage.from(BUCKET).remove([oldPath])
      }
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      onUrl(data.publicUrl)
      showToast('Logo subido correctamente')
    } catch (err) {
      showToast('Error al subir: ' + err.message, 'err')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  async function handleRemove() {
    const path = pathFromUrl(currentUrl)
    if (path) await supabase.storage.from(BUCKET).remove([path])
    onUrl('')
  }

  return (
    <div className="fg">
      <label className="fl">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Preview */}
        {currentUrl ? (
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 8, padding: '6px 10px',
            border: '1px solid #e0e4e0', borderRadius: 8,
            background: '#fafafa', flex: 1,
          }}>
            <img
              src={currentUrl} alt={label}
              style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
            />
            <div style={{ flex: 1 }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy || disabled}
              style={{
                fontSize: 10, fontWeight: 700, color: '#555f55',
                background: 'none', border: '1px solid #e0e4e0',
                borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
              }}
            >
              {busy ? 'Subiendo…' : 'Reemplazar'}
            </button>
            <button
              onClick={handleRemove}
              disabled={busy || disabled}
              style={{
                fontSize: 10, fontWeight: 700, color: '#ef4444',
                background: 'none', border: '1px solid #fecaca',
                borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
              }}
            >
              Quitar
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || disabled}
            style={{
              fontSize: 11, fontWeight: 600, color: '#144E4A',
              background: '#f0fdf4', border: '1px dashed #86efac',
              borderRadius: 8, padding: '8px 18px',
              cursor: busy || disabled ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {busy ? '⏳ Subiendo…' : '↑ Subir logo'}
          </button>
        )}
        <input
          ref={fileRef} type="file" accept="image/*"
          style={{ display: 'none' }} onChange={handleFile}
        />
      </div>
      {hint && <div style={{ fontSize: 9, color: '#9ca89c', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

// ── Divisor de sección ────────────────────────────────────────────
function SeccionDivisor({ label, first = false }) {
  return (
    <div style={{ margin: first ? '0 0 16px' : '20px 0 16px', borderTop: first ? 'none' : '2px solid #e0e4e0', paddingTop: first ? 0 : 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: '#144E4A', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 2, background: '#d1fae5' }} />
    </div>
  )
}

// ── Empresas config section ───────────────────────────────────────
function EmpresaConfig() {
  const empresaConfig     = useEmpresaStore(s => s.empresaConfig)
  const saveEmpresaConfig = useEmpresaStore(s => s.saveEmpresaConfig)

  const [form,   setForm]   = useState({ ...empresaConfig, tipos_cuadrilla_str: (empresaConfig.tipos_cuadrilla || []).join(', ') })
  const [saving, setSaving] = useState(false)
  const [dirty,  setDirty]  = useState(false)

  useEffect(() => {
    setForm({ ...empresaConfig, tipos_cuadrilla_str: (empresaConfig.tipos_cuadrilla || []).join(', ') })
    setDirty(false)
  }, [empresaConfig])

  function upd(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const tipos = form.tipos_cuadrilla_str
        .split(',').map(t => t.trim()).filter(Boolean)
      await saveEmpresaConfig({
        nombre:                form.nombre,
        nombre_corto:          form.nombre_corto,
        logo_url:              form.logo_url              || '',
        logo_icon_url:         form.logo_icon_url         || '',
        color_primario:        form.color_primario,
        tipos_cuadrilla:       tipos,
        cliente_nombre:        form.cliente_nombre        || '',
        cliente_logo_url:      form.cliente_logo_url      || '',
        cliente_logo_icon_url: form.cliente_logo_icon_url || '',
        dev_nombre:            form.dev_nombre            || '',
        dev_logo_url:          form.dev_logo_url          || '',
        dev_logo_icon_url:     form.dev_logo_icon_url     || '',
      })
      showToast('Configuración guardada')
      setDirty(false)
    } catch (e) {
      showToast('Error: ' + (e.message || ''), 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Empresas</h2>
        <button className="btn bp btn-sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Guardando…' : '✓ Guardar'}
        </button>
      </div>
      <div className="card-b">

        {/* ── Empresa ──────────────────────────────────────────── */}
        <SeccionDivisor label="Service Supplier" first />
        <div className="g2" style={{ marginBottom: 12 }}>
          <div className="fg">
            <label className="fl">Nombre completo</label>
            <input type="text" className="fc" value={form.nombre || ''} onChange={e => upd('nombre', e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Nombre corto</label>
            <input type="text" className="fc" value={form.nombre_corto || ''} onChange={e => upd('nombre_corto', e.target.value)} />
          </div>
        </div>

        <div className="g2" style={{ marginBottom: 12 }}>
          <LogoUploader
            label="Logo completo (isotipo + nombre)"
            hint="PNG, JPG o SVG · máx. 2 MB"
            currentUrl={form.logo_url}
            onUrl={url => upd('logo_url', url)}
          />
          <LogoUploader
            label="Solo isotipo"
            hint="PNG, JPG o SVG · máx. 2 MB"
            currentUrl={form.logo_icon_url}
            onUrl={url => upd('logo_icon_url', url)}
          />
        </div>

        <div className="g2" style={{ marginBottom: 12 }}>
          <div className="fg">
            <label className="fl">Color primario</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.color_primario || '#144E4A'} onChange={e => upd('color_primario', e.target.value)} style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              <input type="text" className="fc" value={form.color_primario || '#144E4A'} onChange={e => upd('color_primario', e.target.value)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} />
            </div>
          </div>
          <div className="fg">
            <label className="fl">Tipos de Cuadrilla (separados por coma)</label>
            <input type="text" className="fc" placeholder="TI Ingetel, TSS Ingetel, TI Scytel…" value={form.tipos_cuadrilla_str || ''} onChange={e => upd('tipos_cuadrilla_str', e.target.value)} />
            <div style={{ fontSize: 9, color: '#9ca89c', marginTop: 3 }}>Aparecen como filtros en el Dashboard y al crear subcontratistas.</div>
          </div>
        </div>

        {/* ── Cliente ──────────────────────────────────────────── */}
        <SeccionDivisor label="Cliente" />

        <div className="g2" style={{ marginBottom: 12 }}>
          <div className="fg">
            <label className="fl">Nombre del cliente</label>
            <input type="text" className="fc" placeholder="Nokia, Ericsson, Huawei…" value={form.cliente_nombre || ''} onChange={e => upd('cliente_nombre', e.target.value)} />
            <div style={{ fontSize: 9, color: '#9ca89c', marginTop: 3 }}>Se muestra en el home y como chip en el header.</div>
          </div>
        </div>

        <div className="g2" style={{ marginBottom: 12 }}>
          <LogoUploader
            label="Logo completo (isotipo + nombre)"
            hint="PNG, JPG o SVG · máx. 2 MB"
            currentUrl={form.cliente_logo_url}
            onUrl={url => upd('cliente_logo_url', url)}
          />
          <LogoUploader
            label="Solo isotipo"
            hint="PNG, JPG o SVG · máx. 2 MB"
            currentUrl={form.cliente_logo_icon_url}
            onUrl={url => upd('cliente_logo_icon_url', url)}
          />
        </div>

        {/* ── Desarrollador ────────────────────────────────────── */}
        <SeccionDivisor label="Desarrollador" />

        <div className="g2" style={{ marginBottom: 12 }}>
          <div className="fg">
            <label className="fl">Nombre del desarrollador</label>
            <input type="text" className="fc" placeholder="Scytel Networks…" value={form.dev_nombre || ''} onChange={e => upd('dev_nombre', e.target.value)} />
          </div>
        </div>

        <div className="g2" style={{ marginBottom: 12 }}>
          <LogoUploader
            label="Logo completo (isotipo + nombre)"
            hint="PNG, JPG o SVG · máx. 2 MB"
            currentUrl={form.dev_logo_url}
            onUrl={url => upd('dev_logo_url', url)}
          />
          <LogoUploader
            label="Solo isotipo"
            hint="PNG, JPG o SVG · máx. 2 MB"
            currentUrl={form.dev_logo_icon_url}
            onUrl={url => upd('dev_logo_icon_url', url)}
          />
        </div>

        {/* ── Preview ──────────────────────────────────────────── */}
        <div style={{ padding: '12px 14px', background: '#f8faf8', borderRadius: 8, border: '1px solid #e0e4e0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#555f55', letterSpacing: 1, marginBottom: 10 }}>
            PREVIEW — así se verá en el header
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {form.logo_url
                ? <img src={form.logo_url} alt="logo" style={{ height: 28, objectFit: 'contain' }} />
                : <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 16, color: form.color_primario || '#144E4A' }}>{form.nombre_corto || 'EMPRESA'}</span>
              }
            </div>
            {(form.cliente_nombre || form.cliente_logo_url) && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, border: '1px solid #e0e4e0', background: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#71717a' }}>
                para
                {form.cliente_logo_url
                  ? <img src={form.cliente_logo_url} alt="cliente" style={{ height: 16, maxWidth: 60, objectFit: 'contain' }} />
                  : <span style={{ color: '#18181b' }}>{form.cliente_nombre}</span>
                }
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function ConfigPage() {
  const user = useAppStore(s => s.user)

  if (user?.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#c0392b' }}>
        Acceso restringido — solo administradores.
      </div>
    )
  }

  return (
    <>
      <div className="fb mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Configuración
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <EmpresaConfig />
        <div className="card">
          <div className="card-h"><h2>Subcontratistas</h2></div>
          <div className="card-b" style={{ fontSize: 12, color: '#555f55' }}>
            La gestión de Subcontratistas se encuentra en{' '}
            <a href="/catalogo" style={{ color: '#1d4ed8', fontWeight: 600 }}>
              Catálogo → pestaña Subcontratistas
            </a>.
          </div>
        </div>
        <CalendarioConfig />
        <BackupCard />
        <AppInfoCard />
      </div>
    </>
  )
}

function BackupCard() {
  const [busy,    setBusy]    = useState(false)
  const [lastRun, setLastRun] = useState(null)

  const ACTIONS_URL = 'https://github.com/ErickyAmaya/Nokia-Project-Platform/actions/workflows/backup.yml'

  async function handleBackup() {
    if (!confirm('¿Generar un backup de la base de datos ahora?')) return
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('trigger-backup', {
        body: { reason: 'Backup manual desde Panel Admin' }
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      const now = new Date().toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      setLastRun(now)
      showToast('Backup iniciado — estará listo en GitHub Actions en ~1 minuto.')
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Backup de base de datos</h2>
          <div style={{ fontSize: 11, color: '#617561', marginTop: 3 }}>
            Backup automático mensual (1° de cada mes) · Retención 90 días
          </div>
        </div>
        <button
          onClick={handleBackup}
          disabled={busy}
          style={{
            background: busy ? '#9ca3af' : '#144E4A', color: '#fff',
            border: 'none', borderRadius: 8, padding: '7px 16px',
            fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5, flexShrink: 0,
          }}
        >
          {busy ? '⏳ Iniciando…' : '↓ Generar backup ahora'}
        </button>
      </div>
      <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lastRun && (
          <div style={{ fontSize: 11, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', color: '#166534' }}>
            ✓ Backup iniciado el {lastRun} — espera ~1 minuto y descárgalo desde GitHub Actions.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#617561' }}>
          <span>Los backups se guardan como artifacts en GitHub Actions (90 días).</span>
          <a
            href={ACTIONS_URL}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#144E4A', fontWeight: 700, fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 12 }}
          >
            Ver backups en GitHub →
          </a>
        </div>
      </div>
    </div>
  )
}

function AppInfoCard() {
  const catalogo    = useMatStore(s => s.catalogo)
  const movimientos = useMatStore(s => s.movimientos)
  const despachos   = useMatStore(s => s.despachos)
  const bodegas     = useMatStore(s => s.bodegas)
  const sitios      = useMatStore(s => s.sitios)
  const syncTime    = new Date().toLocaleString('es-CO')

  const rows = [
    { label: 'Versión',             value: APP_VERSION },
    { label: 'Materiales',          value: catalogo.filter(c => c.categoria !== 'PROVEEDORES').length },
    { label: 'Proveedores',         value: catalogo.filter(c => c.categoria === 'PROVEEDORES').length },
    { label: 'Movimientos',         value: movimientos.length },
    { label: 'Despachos',           value: despachos.length },
    { label: 'Bodegas',             value: bodegas.length },
    { label: 'Sitios',              value: sitios.length },
    { label: 'Últ. sincronización', value: syncTime },
  ]

  return (
    <div className="card">
      <div className="card-h"><h2>Información de la App</h2></div>
      <div className="card-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, padding: 0 }}>
        {rows.map((row, i) => (
          <div key={row.label} style={{
            padding: '10px 16px',
            borderRight:  i % 4 !== 3 ? '1px solid #f0f2f0' : 'none',
            borderBottom: i < 4       ? '1px solid #f0f2f0' : 'none',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#9ca89c', marginBottom: 3 }}>{row.label}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0a0a0a' }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
