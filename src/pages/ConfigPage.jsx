import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { showToast } from '../components/Toast'

// ── Empresa config section ────────────────────────────────────────
function EmpresaConfig() {
  const empresaConfig    = useAppStore(s => s.empresaConfig)
  const saveEmpresaConfig = useAppStore(s => s.saveEmpresaConfig)

  const [form,    setForm]    = useState({ ...empresaConfig, tipos_cuadrilla_str: (empresaConfig.tipos_cuadrilla || []).join(', ') })
  const [saving,  setSaving]  = useState(false)
  const [dirty,   setDirty]   = useState(false)

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
        nombre:           form.nombre,
        nombre_corto:     form.nombre_corto,
        logo_url:         form.logo_url,
        color_primario:   form.color_primario,
        tipos_cuadrilla:  tipos,
        cliente_nombre:   form.cliente_nombre   || '',
        cliente_logo_url: form.cliente_logo_url || '',
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
        <h2>Empresa</h2>
        <button
          className="btn bp btn-sm"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? 'Guardando…' : '✓ Guardar'}
        </button>
      </div>
      <div className="card-b">
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
          <div className="fg">
            <label className="fl">URL del Logo</label>
            <input type="text" className="fc" placeholder="https://…" value={form.logo_url || ''} onChange={e => upd('logo_url', e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Color primario</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={form.color_primario || '#144E4A'}
                onChange={e => upd('color_primario', e.target.value)}
                style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }}
              />
              <input
                type="text" className="fc"
                value={form.color_primario || '#144E4A'}
                onChange={e => upd('color_primario', e.target.value)}
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          </div>
        </div>

        <div className="fg">
          <label className="fl">Tipos de Cuadrilla (separados por coma)</label>
          <input
            type="text" className="fc"
            placeholder="TI Ingetel, TSS Ingetel, TI Scytel, TSS Scytel"
            value={form.tipos_cuadrilla_str || ''}
            onChange={e => upd('tipos_cuadrilla_str', e.target.value)}
          />
          <div style={{ fontSize: 9, color: '#9ca89c', marginTop: 3 }}>
            Aparecen como filtros en el Dashboard y en el selector al crear subcontratistas.
          </div>
        </div>

        {/* ── Sección Cliente ──────────────────────────────────── */}
        <div style={{
          margin: '20px 0 16px',
          borderTop: '1px solid #e0e4e0',
          paddingTop: 16,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#9ca89c', textTransform: 'uppercase' }}>
            Cliente
          </span>
          <div style={{ flex: 1, height: 1, background: '#e0e4e0' }} />
        </div>

        <div className="g2" style={{ marginBottom: 12 }}>
          <div className="fg">
            <label className="fl">Nombre del cliente</label>
            <input
              type="text" className="fc"
              placeholder="Nokia, Ericsson, Huawei…"
              value={form.cliente_nombre || ''}
              onChange={e => upd('cliente_nombre', e.target.value)}
            />
          </div>
          <div className="fg">
            <label className="fl">URL del logo del cliente</label>
            <input
              type="text" className="fc"
              placeholder="https://…"
              value={form.cliente_logo_url || ''}
              onChange={e => upd('cliente_logo_url', e.target.value)}
            />
          </div>
        </div>

        {/* Preview combinado */}
        <div style={{ padding: '12px 14px', background: '#f8faf8', borderRadius: 8, border: '1px solid #e0e4e0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#555f55', letterSpacing: 1, marginBottom: 10 }}>PREVIEW</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Operador (izquierda) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {form.logo_url
                ? <img src={form.logo_url} alt="logo" style={{ height: 28, objectFit: 'contain' }} />
                : <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 16, color: form.color_primario || '#144E4A' }}>
                    {form.nombre_corto || 'INGETEL'}
                  </span>
              }
            </div>
            {/* Cliente (derecha) — simula el chip del header */}
            {(form.cliente_nombre || form.cliente_logo_url) && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 6,
                border: '1px solid #e0e4e0', background: '#fff',
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                textTransform: 'uppercase', color: '#71717a',
              }}>
                para
                {form.cliente_logo_url
                  ? <img src={form.cliente_logo_url} alt="cliente" style={{ height: 16, objectFit: 'contain' }} />
                  : <span style={{ color: '#18181b' }}>{form.cliente_nombre}</span>
                }
              </div>
            )}
          </div>
          <div style={{ fontSize: 9, color: '#9ca89c', marginTop: 8 }}>
            Así se verá en el header de la aplicación
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
      </div>
    </>
  )
}
