import { useState } from 'react'

const ZONA_LABELS = ['Principal', 'Secundaria', 'Intermedia', 'Difícil Acceso']
const SECCIONES   = ['BASE', 'TSS', 'ADJ', 'CR']

// ── Controlled number input (allows empty string while typing) ─
function NumInput({ value, onChange, style }) {
  const [raw, setRaw] = useState(String(value ?? ''))

  const handleChange = e => {
    setRaw(e.target.value)
    const n = Number(e.target.value.replace(/[^0-9.-]/g, ''))
    if (!isNaN(n)) onChange(n)
  }

  return (
    <input
      type="number"
      value={raw}
      min={0}
      onChange={handleChange}
      onBlur={() => setRaw(String(value ?? ''))}
      style={{
        width: '100%', padding: '3px 5px', fontSize: 11,
        border: '1px solid #d1d5db', borderRadius: 4,
        textAlign: 'right', boxSizing: 'border-box',
        ...style,
      }}
    />
  )
}

// ── TI Item Modal ─────────────────────────────────────────────
function TIForm({ item, isNew, onChange }) {
  const setField = (k, v) => onChange({ ...item, [k]: v })
  const setPrice = (cat, zi, v) => {
    const arr = [...(item[cat] || [null, null, null, null])]
    arr[zi] = v === '' || v == null ? null : Number(v)
    onChange({ ...item, [cat]: arr })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Meta fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
          ID / Actividad
          <input
            className="fc"
            value={item.id || ''}
            onChange={e => setField('id', e.target.value)}
            readOnly={!isNew}
            style={{ opacity: isNew ? 1 : 0.6, cursor: isNew ? 'text' : 'default' }}
            placeholder="Ej: IMP_RF"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
          Unidad
          <input
            className="fc"
            value={item.unidad || ''}
            onChange={e => setField('unidad', e.target.value)}
            placeholder="Sitio / Unidad / Diario…"
          />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
        Nombre descriptivo
        <input
          className="fc"
          value={item.nombre || ''}
          onChange={e => setField('nombre', e.target.value)}
          placeholder="Nombre visible en la app"
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
        Sección
        <select className="fc" value={item.seccion || 'BASE'} onChange={e => setField('seccion', e.target.value)}>
          {SECCIONES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      {/* Price grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 6px', textAlign: 'left', background: '#f0f7f0', fontWeight: 700 }}>Zona</th>
              <th style={{ padding: '4px 6px', background: '#144E4A', color: '#CDFBF2', textAlign: 'right', fontWeight: 700 }}>Nokia</th>
              <th style={{ padding: '4px 6px', background: '#fef9c3', textAlign: 'right' }}>Cat A</th>
              <th style={{ padding: '4px 6px', background: '#fef9c3', textAlign: 'right' }}>Cat AA</th>
              <th style={{ padding: '4px 6px', background: '#fef9c3', textAlign: 'right' }}>Cat AAA</th>
            </tr>
          </thead>
          <tbody>
            {ZONA_LABELS.map((z, zi) => (
              <tr key={zi} style={{ background: zi % 2 === 0 ? '#fff' : '#f9faf9' }}>
                <td style={{ padding: '3px 6px', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 10 }}>{z}</td>
                <td style={{ padding: '3px 4px', background: '#eff6ff' }}>
                  <NumInput value={item.nokia?.[zi] ?? ''} onChange={v => setPrice('nokia', zi, v)} />
                </td>
                <td style={{ padding: '3px 4px', background: '#fffbeb' }}>
                  <NumInput value={item.A?.[zi] ?? ''} onChange={v => setPrice('A', zi, v)} />
                </td>
                <td style={{ padding: '3px 4px', background: '#fffbeb' }}>
                  <NumInput value={item.AA?.[zi] ?? ''} onChange={v => setPrice('AA', zi, v)} />
                </td>
                <td style={{ padding: '3px 4px', background: '#fffbeb' }}>
                  <NumInput value={item.AAA?.[zi] ?? ''} onChange={v => setPrice('AAA', zi, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── CW Item Modal ─────────────────────────────────────────────
function CWForm({ item, isNew, onChange }) {
  const setField = (k, v) => onChange({ ...item, [k]: v })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
          Actividad ID
          <input
            className="fc"
            value={item.actividad_id || ''}
            onChange={e => setField('actividad_id', e.target.value)}
            readOnly={!isNew}
            style={{ opacity: isNew ? 1 : 0.6, cursor: isNew ? 'text' : 'default' }}
            placeholder="Ej: 2.05"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
          Unidad
          <input
            className="fc"
            value={item.unidad || ''}
            onChange={e => setField('unidad', e.target.value)}
            placeholder="UN / Global…"
          />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
        Nombre descriptivo
        <input
          className="fc"
          value={item.nombre || ''}
          onChange={e => setField('nombre', e.target.value)}
          placeholder="Nombre visible en la app"
        />
      </label>

      {/* Price grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 6px', textAlign: 'left', background: '#f0f7f0' }} />
              <th style={{ padding: '4px 6px', background: '#144E4A', color: '#CDFBF2', textAlign: 'right', fontWeight: 700 }}>Nokia</th>
              <th style={{ padding: '4px 6px', background: '#fef9c3', textAlign: 'right' }}>SubC</th>
            </tr>
          </thead>
          <tbody>
            {[['Urbano', 'precio_nokia_urbano', 'precio_subc_urbano'], ['Rural', 'precio_nokia_rural', 'precio_subc_rural']].map(([label, kN, kS]) => (
              <tr key={label} style={{ background: label === 'Urbano' ? '#fff' : '#f9faf9' }}>
                <td style={{ padding: '3px 6px', fontWeight: 600, fontSize: 10 }}>{label}</td>
                <td style={{ padding: '3px 4px', background: '#eff6ff' }}>
                  <NumInput value={item[kN] ?? 0} onChange={v => setField(kN, v)} />
                </td>
                <td style={{ padding: '3px 4px', background: '#fffbeb' }}>
                  <NumInput value={item[kS] ?? 0} onChange={v => setField(kS, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────
export default function CatalogItemModal({ type, item: initItem, isNew, onSave, onClose }) {
  const [item, setItem] = useState(initItem)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!item) return
    const key = type === 'CW' ? item.actividad_id : item.id
    if (!key?.trim()) return alert('El campo ID es requerido.')
    setSaving(true)
    try {
      await onSave(item)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,.2)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e0e4e0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            {isNew ? 'Agregar ítem' : 'Editar ítem'} — {type}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {type === 'TI'
            ? <TIForm item={item} isNew={isNew} onChange={setItem} />
            : <CWForm item={item} isNew={isNew} onChange={setItem} />
          }
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid #e0e4e0',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button className="btn bou" onClick={onClose}>Cancelar</button>
          <button className="btn bp" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
