import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { cop, pct, mcls, ZONAS } from '../lib/catalog'
import { useConfirm } from './ConfirmModal'
import { showToast } from './Toast'
import Modal from './Modal'

const CATS = ['A', 'AA', 'AAA']

const TIPO_COLOR_GASTO = {
  Logistica:       { bg: '#eff6ff', color: '#1d4ed8' },
  Adicionales:     { bg: '#fef3c7', color: '#b45309' },
  'Materiales TI': { bg: '#f0fdf4', color: '#166534' },
  'Materiales CW': { bg: '#faf5ff', color: '#7e22ce' },
}

// ── Pencil SVG icon ───────────────────────────────────────────────
function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

// ── Inline edit button styles ─────────────────────────────────────
const btnEdit = {
  background: '#e8f4fd', color: '#1a56db',
  border: '1px solid #93c5fd', borderRadius: 4,
  cursor: 'pointer', padding: '2px 5px', fontSize: 12, lineHeight: 1,
}
const btnConfirm = {
  background: '#e8f4fd', color: '#1a56db',
  border: '1px solid #93c5fd', borderRadius: 4,
  cursor: 'pointer', padding: '2px 5px', fontSize: 13, fontWeight: 700, lineHeight: 1,
}
const btnCancel = {
  background: '#fff0f0', color: '#c0392b',
  border: '1px solid #fca5a5', borderRadius: 4,
  cursor: 'pointer', padding: '2px 5px', fontSize: 12, lineHeight: 1,
}
const inpEdit = {
  border: '1px solid #9ca3af', borderRadius: 4,
  padding: '2px 5px', fontSize: 11, width: '100%', boxSizing: 'border-box',
}
const selEdit = {
  border: '1px solid #9ca3af', borderRadius: 4,
  padding: '2px 4px', fontSize: 10,
}
const selCat = {
  border: '2px solid #7c3aed', borderRadius: 4,
  padding: '2px 4px', fontSize: 10, color: '#7c3aed', fontWeight: 700,
}

// ── TSS Gasto Modal ───────────────────────────────────────────────
function TSSGastoModal({ open, onClose, sitioId, sitioids, agregarGasto, editarGasto, gasto }) {
  const TIPOS = ['Logistica', 'Adicionales', 'Materiales TI']
  const isEdit = !!gasto
  const [form,   setForm]   = useState({ tipo: 'Logistica', desc: '', valor: '', sub_sitio: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Populate form when editing an existing gasto
  useEffect(() => {
    if (open && gasto) {
      setForm({ tipo: gasto.tipo || 'Logistica', desc: gasto.desc || '', valor: String(gasto.valor || ''), sub_sitio: gasto.sub_sitio || '' })
    } else if (open && !gasto) {
      setForm({ tipo: 'Logistica', desc: '', valor: '', sub_sitio: '' })
    }
  }, [open, gasto])

  function upd(f, v) { setForm(p => ({ ...p, [f]: v })); setError('') }

  function handleClose() {
    setForm({ tipo: 'Logistica', desc: '', valor: '', sub_sitio: '' })
    setError(''); onClose()
  }

  async function handleSubmit() {
    if (!form.desc.trim()) { setError('La descripción es requerida'); return }
    const valor = parseFloat(form.valor) || 0
    if (valor <= 0) { setError('El valor debe ser mayor a 0'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await editarGasto(gasto.id, { tipo: form.tipo, desc: form.desc.trim(), valor, sub_sitio: form.sub_sitio || null })
        showToast('Gasto actualizado')
      } else {
        await agregarGasto({ sitio: sitioId, tipo: form.tipo, desc: form.desc.trim(), valor, sub_sitio: form.sub_sitio || null })
        showToast('Gasto agregado')
      }
      handleClose()
    } catch (e) { setError('Error: ' + (e.message || '')) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? '✏ Editar Gasto' : '＋ Agregar Gasto'} maxWidth={400}
      footer={
        <>
          <button className="btn bou" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="btn bp"  onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : isEdit ? '✓ Actualizar' : '✓ Agregar'}</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="fg">
          <label className="fl">Tipo</label>
          <select className="fc" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="fl">Descripción *</label>
          <input type="text" className="fc" autoFocus placeholder="Ej: Transporte a sitio"
            value={form.desc} onChange={e => upd('desc', e.target.value)} />
        </div>
        <div className="fg">
          <label className="fl">Valor (COP) *</label>
          <input type="number" className="fc" placeholder="0" min="0"
            value={form.valor} onChange={e => upd('valor', e.target.value)} />
        </div>
        <div className="fg">
          <label className="fl">Sub-Sitio TSS</label>
          <select className="fc" value={form.sub_sitio} onChange={e => upd('sub_sitio', e.target.value)}>
            <option value="">— Sin sub-sitio —</option>
            {sitioids.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {error && <div className="alert al-e">{error}</div>}
      </div>
    </Modal>
  )
}

// ── Add Nokia Activity Modal ──────────────────────────────────────
const TIPOS_TSS = [
  { value: 'TSS_VR', label: 'TSS_VR (Visita + Reporte)' },
  { value: 'TSS_V',  label: 'TSS_V  (Solo Visita)' },
  { value: 'TSS_R',  label: 'TSS_R  (Solo Reporte)' },
  { value: 'TSS_RD', label: 'TSS_RD (Rediseño)' },
]
const CAT_ORDER = ['A', 'AA', 'AAA']

function newActRow() {
  return { tipo: 'TSS_VR', sitioid: '', ciudad: 'Ciudad_Principal', cant: 1 }
}

function AddNokiaActModal({ open, onClose, sitio, sitioids, addActividad }) {
  const [rows,   setRows]   = useState([newActRow()])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function handleClose() { setRows([newActRow()]); setError(''); onClose() }

  function updRow(i, field, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
    setError('')
  }
  function addRow()     { setRows(prev => [...prev, newActRow()]) }
  function removeRow(i) { setRows(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit() {
    for (const r of rows) {
      const s = r.tipo === 'TSS_RD' ? r.sitioid : r.sitioid.trim()
      if (!s) { setError('Todos los sitios son requeridos'); return }
    }
    setSaving(true)
    try {
      for (const r of rows) {
        const s = r.tipo === 'TSS_RD' ? r.sitioid : r.sitioid.trim()
        const base = { sec: 'TSS', tipo: 'BASE', id: r.tipo, ciudad: r.ciudad, sitioid: s, cant: r.cant, catOver: '' }
        addActividad(sitio.id, { ...base, cardType: 'nokia' })
        if (r.tipo === 'TSS_VR') {
          addActividad(sitio.id, { ...base, id: 'TSS_V', cardType: 'subc' })
          addActividad(sitio.id, { ...base, id: 'TSS_R', cardType: 'subc' })
        } else {
          addActividad(sitio.id, { ...base, cardType: 'subc' })
        }
      }
      showToast(`${rows.length} actividad(es) agregada(s)`)
      handleClose()
    } catch (e) { setError('Error: ' + (e.message || '')) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={handleClose} title="＋ Agregar Actividad Nokia TSS" maxWidth={560}
      footer={
        <>
          <button className="btn bou" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="btn bp"  onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : '✓ Agregar'}</button>
        </>
      }
    >
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, marginBottom: 8, color: '#0d6e0d' }}>
        ACTIVIDADES A REGISTRAR
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ background: 'var(--g1)', borderRadius: 5, padding: 10, marginBottom: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 64px auto', gap: 6, alignItems: 'end' }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Tipo (Nokia)</label>
              <select className="fc" style={{ fontSize: 11 }} value={r.tipo}
                onChange={e => updRow(i, 'tipo', e.target.value)}>
                {TIPOS_TSS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Nombre Sitio</label>
              {r.tipo === 'TSS_RD' ? (
                <select className="fc" style={{ fontSize: 11 }} value={r.sitioid}
                  onChange={e => updRow(i, 'sitioid', e.target.value)}>
                  <option value="">— Sin sitio —</option>
                  {sitioids.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input type="text" className="fc" style={{ fontSize: 11 }} placeholder="Ej: TOL.Espinal"
                  value={r.sitioid} onChange={e => updRow(i, 'sitioid', e.target.value)} />
              )}
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Ciudad</label>
              <select className="fc" style={{ fontSize: 11 }} value={r.ciudad}
                onChange={e => updRow(i, 'ciudad', e.target.value)}>
                {ZONAS.map(z => <option key={z} value={z}>{z.replace('Ciudad_', '')}</option>)}
              </select>
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Cant</label>
              <input type="number"
                style={{ width: 60, border: '1.5px solid var(--g2)', borderRadius: 4, padding: '3px 5px', fontFamily: 'inherit', fontSize: 11, textAlign: 'center', outline: 'none' }}
                value={r.cant} min="1"
                onChange={e => updRow(i, 'cant', parseInt(e.target.value) || 1)} />
            </div>
            <button className="btn-del" style={{ alignSelf: 'flex-end', marginBottom: 1 }}
              onClick={() => removeRow(i)} disabled={rows.length === 1}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn bou btn-sm" onClick={addRow}>＋ Agregar Actividad</button>
      {error && <div className="alert al-e" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  )
}

// ── Cat dropdown button (per-activity category) ───────────────────
function CatDropdown({ actIdx, catOver, subCat, onSave, disabled }) {
  const [pos,  setPos]  = useState(null)   // { top|bottom, left } in fixed coords
  const btnRef = useRef(null)

  const lcCat       = subCat || 'A'
  const effective   = catOver || lcCat
  const isUpgraded  = !!catOver
  const lcIdx       = CAT_ORDER.indexOf(lcCat)
  const upgradeOpts = CAT_ORDER.filter((_, i) => i > lcIdx)
  const menuH       = (1 + upgradeOpts.length) * 36 + 12

  function handleOpen() {
    if (disabled) return
    if (pos) { setPos(null); return }
    const rect = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow >= menuH) {
      setPos({ top: rect.bottom + 4, left: rect.left })
    } else {
      setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
    }
  }

  const menuStyle = pos ? {
    position: 'fixed',
    ...(pos.top    != null ? { top:    pos.top    } : {}),
    ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
    left: pos.left,
    background: '#fff', border: '1px solid #e0e4e0', borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 9999,
    minWidth: 170, padding: '4px 0', fontSize: 11,
  } : null

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 28, padding: '2px 7px', borderRadius: 20,
          fontSize: 9, fontWeight: 700, lineHeight: 1.4, cursor: disabled ? 'default' : 'pointer',
          background: isUpgraded ? '#f3e8ff' : '#dcfce7',
          color:      isUpgraded ? '#7c3aed' : '#166534',
          border:     isUpgraded ? '1.5px solid #c4b5fd' : '1.5px solid #86efac',
        }}
        onClick={handleOpen}
        title={isUpgraded ? `Cat ${effective} (override)` : `Cat del LC (${lcCat})`}
      >
        {effective}
      </button>
      {pos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setPos(null)} />
          <div style={menuStyle}>
            <div
              style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                background: !catOver ? '#f0fdf4' : 'transparent', borderRadius: 4 }}
              onClick={() => { onSave(actIdx, { catOver: '' }); setPos(null) }}
            >
              <span style={{ width: 12, color: '#0d6e0d', fontWeight: 800 }}>{!catOver ? '✓' : ''}</span>
              Usar cat. del LC ({lcCat})
            </div>
            {upgradeOpts.map(c => (
              <div key={c}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: catOver === c ? '#faf5ff' : 'transparent', borderRadius: 4 }}
                onClick={() => { onSave(actIdx, { catOver: c }); setPos(null) }}
              >
                <span style={{ width: 12, color: '#7c3aed', fontWeight: 800 }}>{catOver === c ? '✓' : ''}</span>
                Subir a {c} ⭐
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Add TSS_RD Modal ──────────────────────────────────────────────
function AddRDModal({ open, onClose, sitio, sitioids, addActividad }) {
  const [sitioid,  setSitioid]  = useState('')
  const [nuevoSit, setNuevoSit] = useState('')
  const [ciudad,   setCiudad]   = useState('Ciudad_Principal')
  const [cant,     setCant]     = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const useNuevo = sitioid === '__nuevo__'
  const efectivo = useNuevo ? nuevoSit.trim() : sitioid

  function handleClose() {
    setSitioid(''); setNuevoSit(''); setCiudad('Ciudad_Principal'); setCant(1); setError(''); onClose()
  }

  async function handleSubmit() {
    if (!efectivo) { setError('Selecciona o escribe el sub-sitio'); return }
    setSaving(true)
    try {
      const base = { sec: 'TSS', tipo: 'BASE', id: 'TSS_RD', ciudad, sitioid: efectivo, cant, catOver: '' }
      addActividad(sitio.id, { ...base, cardType: 'nokia' })
      addActividad(sitio.id, { ...base, cardType: 'subc'  })
      showToast(`TSS_RD agregado: ${efectivo}`); handleClose()
    } catch (e) { setError('Error: ' + (e.message || '')) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={handleClose} title="＋ Agregar Rediseño (TSS_RD)" maxWidth={400}
      footer={
        <>
          <button className="btn bou" onClick={handleClose} disabled={saving}>Cancelar</button>
          <button className="btn bp"  onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : '✓ Agregar'}</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="fg">
          <label className="fl">Sub-Sitio TSS</label>
          <select className="fc" value={sitioid} onChange={e => { setSitioid(e.target.value); setError('') }} autoFocus>
            <option value="">— Seleccionar sub-sitio —</option>
            {sitioids.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__nuevo__">＋ Nuevo sub-sitio…</option>
          </select>
        </div>
        {useNuevo && (
          <div className="fg">
            <label className="fl">Nombre del nuevo sub-sitio *</label>
            <input type="text" className="fc" autoFocus placeholder="Ej: TOL.Espinal"
              value={nuevoSit} onChange={e => { setNuevoSit(e.target.value); setError('') }} />
          </div>
        )}
        <div className="g2">
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl">Ciudad</label>
            <select className="fc" value={ciudad} onChange={e => setCiudad(e.target.value)}>
              {ZONAS.map(z => <option key={z} value={z}>{z.replace('Ciudad_', '')}</option>)}
            </select>
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl">Cantidad</label>
            <input type="number" className="fc" min="1" value={cant}
              onChange={e => setCant(parseInt(e.target.value) || 1)} />
          </div>
        </div>
        {error && <div className="alert al-e">{error}</div>}
      </div>
    </Modal>
  )
}

// ── SubC card — inline editing (Visita / Reporte / Rediseño) ──────
function SubcCard({
  title, lcField, lc, sub, acts, total,
  subcs, isViewer, isFinal,
  onDelete, onSave, onLcChange,
  showAdicional, gastosBySitio, totalAdicional,
  headerExtra,
  hideDelete,
}) {
  const [editIdx,  setEditIdx]  = useState(null)   // _idx being edited
  const [editForm, setEditForm] = useState({})

  const thS = { background: '#FFF0CE', color: '#92400e', borderBottom: '2px solid #FFC000' }
  const hasButtons = !isViewer && !isFinal
  const extraCols  = (showAdicional ? 1 : 0) + (hasButtons ? 1 : 0)
  const totalCols  = 7 + extraCols  // tipo+sitio+ciudad+cat+cant+p.subc+total + extras

  function startEdit(act) {
    setEditIdx(act._idx)
    setEditForm({ sitioid: act.sitioid || '', ciudad: act.ciudad || 'Ciudad_Principal', cant: act.cant || 1 })
  }

  function cancelEdit() { setEditIdx(null) }

  function confirmEdit() {
    onSave(editIdx, editForm)
    setEditIdx(null)
  }

  function upd(field, val) { setEditForm(f => ({ ...f, [field]: val })) }

  return (
    <div className="card">
      <div className="card-h" style={{
        background: '#FFF0CE', borderLeftColor: '#FFC000',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6,
      }}>
        <h2 style={{ color: '#92400e' }}>{title}</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {headerExtra}
          {hasButtons ? (
            <select
              className="fc"
              style={{ fontSize: 10, padding: '3px 6px', borderColor: '#FFC000', minWidth: 130, maxWidth: 210 }}
              value={lc}
              onChange={e => onLcChange(lcField, e.target.value)}
            >
              <option value="">— Sin LC —</option>
              {subcs.map(s => <option key={s.lc} value={s.lc}>{s.lc} — {s.empresa}</option>)}
            </select>
          ) : lc && (
            <span style={{ textAlign: 'right', lineHeight: 1.3 }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: '#92400e' }}>{lc}</span>
              {sub && <><br /><span className="badge" style={{ background: '#fde68a', color: '#92400e', fontSize: 9 }}>Cat {sub.cat}</span></>}
            </span>
          )}
        </div>
      </div>

      {sub && (
        <div style={{ padding: '5px 14px', borderBottom: '1px solid #fde68a', display: 'flex', gap: 16, flexWrap: 'wrap', background: '#fffbeb' }}>
          <span style={{ fontSize: 10, color: '#92400e' }}><strong>{sub.empresa}</strong></span>
          {sub.tel && <span style={{ fontSize: 10, color: '#92400e' }}>📞 {sub.tel}</span>}
        </div>
      )}

      <div style={{ padding: 0, overflowX: 'auto' }}>
        <table className="tbl" style={{ minWidth: 360 }}>
          <thead>
            <tr>
              <th style={thS}>Tipo</th>
              <th style={thS}>Sitio</th>
              <th style={thS}>Ciudad</th>
              <th style={thS}>Cat</th>
              <th className="num" style={thS}>Cant</th>
              <th className="num" style={{ ...thS, color: '#b45309' }}>P. SubC</th>
              {showAdicional && <th className="num" style={{ ...thS, color: '#b45309' }}>Adicional</th>}
              <th className="num" style={thS}>Total SubC</th>
              {hasButtons && <th style={{ ...thS, width: 60 }} />}
            </tr>
          </thead>
          <tbody>
            {acts.length === 0 && (
              <tr>
                <td colSpan={totalCols} style={{ padding: 20, textAlign: 'center', color: '#9ca89c', fontSize: 11 }}>
                  Sin actividades
                </td>
              </tr>
            )}
            {acts.map((act, i) => {
              const isEditing = editIdx === act._idx
              const adicional = showAdicional ? (gastosBySitio?.[act.sitioid] || 0) : 0

              if (isEditing) {
                return (
                  <tr key={i} style={{ background: '#fafff8' }}>
                    <td>
                      <span className="badge" style={{ background: '#f0f7f0', color: '#144E4A', fontSize: 8 }}>{act.id}</span>
                    </td>
                    <td style={{ minWidth: 90 }}>
                      <input style={inpEdit} value={editForm.sitioid}
                        onChange={e => upd('sitioid', e.target.value)} />
                    </td>
                    <td>
                      <select style={selEdit} value={editForm.ciudad} onChange={e => upd('ciudad', e.target.value)}>
                        {ZONAS.map(z => <option key={z} value={z}>{z.replace('Ciudad_', '')}</option>)}
                      </select>
                    </td>
                    <td>
                      <CatDropdown actIdx={act._idx} catOver={act.catOver} subCat={sub?.cat} onSave={onSave} disabled={false} />
                    </td>
                    <td className="num">
                      <input type="number" min="1"
                        style={{ ...inpEdit, width: 50, textAlign: 'right' }}
                        value={editForm.cant}
                        onChange={e => upd('cant', parseInt(e.target.value) || 1)} />
                    </td>
                    <td className="num fw6" style={{ color: '#b45309' }}>{cop(act.preSubc)}</td>
                    {showAdicional && (
                      <td className="num" style={{ color: '#b45309' }}>{adicional > 0 ? cop(adicional) : '—'}</td>
                    )}
                    <td className="num fw7" style={{ color: '#000' }}>{cop(act.totalSubc)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button style={{ ...btnConfirm, marginRight: 3 }} onClick={confirmEdit} title="Guardar">✓</button>
                      <button style={btnCancel} onClick={cancelEdit} title="Cancelar">✕</button>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={i}>
                  <td>
                    <span className="badge" style={{ background: '#f0f7f0', color: '#144E4A', fontSize: 8 }}>{act.id}</span>
                  </td>
                  <td style={{ fontSize: 10, fontWeight: 600, color: '#000' }}>{act.sitioid || '—'}</td>
                  <td style={{ fontSize: 9, color: '#555' }}>{(act.ciudad || '').replace('Ciudad_', '') || '—'}</td>
                  <td>
                    <CatDropdown actIdx={act._idx} catOver={act.catOver} subCat={sub?.cat} onSave={onSave} disabled={isViewer || isFinal} />
                  </td>
                  <td className="num" style={{ color: '#000' }}>{act.cant || 0}</td>
                  <td className="num fw6" style={{ color: '#b45309' }}>{cop(act.preSubc)}</td>
                  {showAdicional && (
                    <td className="num" style={{ color: '#b45309' }}>{adicional > 0 ? cop(adicional) : '—'}</td>
                  )}
                  <td className="num fw7" style={{ color: '#000' }}>{cop(act.totalSubc)}</td>
                  {hasButtons && (
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {!hideDelete && (
                        <>
                          <button style={{ ...btnEdit, marginRight: 3 }} onClick={() => startEdit(act)} title="Editar"><IconEdit /></button>
                          <button style={btnCancel} onClick={() => onDelete(act)} title="Eliminar">✕</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#fffbeb', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '6px 10px', color: '#92400e' }}><strong>TOTAL</strong></td>
              <td />
              <td />
              {showAdicional && (
                <td className="num" style={{ color: '#b45309' }}>{cop(totalAdicional)}</td>
              )}
              <td className="num fw8" style={{ color: '#000' }}>{cop(total + (showAdicional ? (totalAdicional || 0) : 0))}</td>
              {hasButtons && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function TSSLiquidadorView({ sitio, calc }) {
  const [modalGasto,    setModalGasto]    = useState(false)
  const [gastoEdit,     setGastoEdit]     = useState(null)
  const [modalRD,       setModalRD]       = useState(false)
  const [modalNokiaAct, setModalNokiaAct] = useState(false)

  // Inline edit state for Nokia table
  const [nokiaEditIdx,  setNokiaEditIdx]  = useState(null)
  const [nokiaEditForm, setNokiaEditForm] = useState({})

  const subcs           = useAppStore(s => s.subcs)
  const gastos          = useAppStore(s => s.gastos)
  const eliminarGasto   = useAppStore(s => s.eliminarGasto)
  const agregarGasto    = useAppStore(s => s.agregarGasto)
  const editarGasto     = useAppStore(s => s.editarGasto)
  const addActividad    = useAppStore(s => s.addActividad)
  const deleteActividad = useAppStore(s => s.deleteActividad)
  const updateSitioField = useAppStore(s => s.updateSitioField)
  const user             = useAuthStore(s => s.user)
  const { confirm, ConfirmModalUI } = useConfirm()

  const isViewer = user?.role === 'viewer'
  const isFinal  = sitio.estado === 'final'
  const hasButtons = !isViewer && !isFinal

  // Effective LCs
  const lcVisita   = sitio.lcVisita   || sitio.lc || ''
  const lcReporte  = sitio.lcReporte  || sitio.lc || ''
  const lcRediseno = sitio.lcRedesign || sitio.lc || ''

  const subVisita   = lcVisita   ? subcs.find(s => s.lc === lcVisita)   : null
  const subReporte  = lcReporte  ? subcs.find(s => s.lc === lcReporte)  : null
  const subRediseno = lcRediseno ? subcs.find(s => s.lc === lcRediseno) : null

  // Activities with original indices
  const actsWithIdx = useMemo(
    () => calc.acts.map((a, i) => ({ ...a, _idx: i })),
    [calc.acts]
  )

  const nokiaActs    = useMemo(() => actsWithIdx.filter(a => a.cardType !== 'subc'),                        [actsWithIdx])
  const visitaActs   = useMemo(() => actsWithIdx.filter(a => a.cardType !== 'nokia' && a.id === 'TSS_V'),  [actsWithIdx])
  const reporteActs  = useMemo(() => actsWithIdx.filter(a => a.cardType !== 'nokia' && a.id === 'TSS_R'),  [actsWithIdx])
  const redisenoActs = useMemo(() => actsWithIdx.filter(a => a.cardType !== 'nokia' && a.id === 'TSS_RD'), [actsWithIdx])

  const sitioids = useMemo(() => {
    const all = calc.acts.map(a => a.sitioid).filter(Boolean)
    return [...new Set(all)].sort()
  }, [calc.acts])

  // Gastos
  const gastosS = useMemo(() => gastos.filter(g => g.sitio === sitio.id), [gastos, sitio.id])
  const gastosBySitio = useMemo(() => {
    const map = {}
    gastosS.forEach(g => { if (g.sub_sitio) map[g.sub_sitio] = (map[g.sub_sitio] || 0) + (g.valor || 0) })
    return map
  }, [gastosS])
  const totalGastos    = gastosS.reduce((s, g) => s + (g.valor || 0), 0)
  const totalAdicional = Object.values(gastosBySitio).reduce((s, v) => s + v, 0)

  // Totals
  const totalNokia       = nokiaActs.reduce((s, a)    => s + (a.totalNokia || 0), 0)
  const totalNokiaCosubc = nokiaActs.reduce((s, a)    => s + (a.preSubc || 0) * (a.cant || 0), 0)
  const totalVisita      = visitaActs.reduce((s, a)   => s + (a.totalSubc  || 0), 0)
  const totalReporte     = reporteActs.reduce((s, a)  => s + (a.totalSubc  || 0), 0)
  const totalRediseno    = redisenoActs.reduce((s, a) => s + (a.totalSubc  || 0), 0)
  const totalSubcAll     = totalVisita + totalReporte + totalRediseno

  // Nokia breakdown by type (for VENTA NOKIA section)
  const nokiaVisitaVal  = nokiaActs.filter(a => a.id === 'TSS_V' ).reduce((s, a) => s + (a.totalNokia || 0), 0)
  const nokiaReporteVal = nokiaActs.filter(a => a.id === 'TSS_R' ).reduce((s, a) => s + (a.totalNokia || 0), 0)
  const nokiaVRVal      = nokiaActs.filter(a => a.id === 'TSS_VR').reduce((s, a) => s + (a.totalNokia || 0), 0)
  const nokiaRDVal      = nokiaActs.filter(a => a.id === 'TSS_RD').reduce((s, a) => s + (a.totalNokia || 0), 0)

  const utilidad    = totalNokia - totalSubcAll - totalGastos
  const margen      = totalNokia > 0 ? utilidad / totalNokia : 0
  const marginColor = margen >= .3 ? '#1a7a1a' : margen >= .2 ? '#FFC000' : '#c0392b'

  // ── Shared save handler ─────────────────────────────────────────
  function handleSave(actIdx, fields) {
    const actividades = sitio.actividades.map((a, i) =>
      i === actIdx ? { ...a, ...fields } : a
    )
    updateSitioField(sitio.id, 'actividades', actividades)
    showToast('Actividad actualizada')
  }

  async function handleDeleteAct(act) {
    const ok = await confirm('Eliminar Actividad', `¿Eliminar ${act.id} — ${act.sitioid || 'sin sitio'}?`)
    if (!ok) return

    // Collect indices to remove: the act itself + any linked subc counterparts
    const idxsToDelete = new Set([act._idx])

    if (act.cardType !== 'subc') {
      const { sitioid, id } = act
      sitio.actividades.forEach((a, i) => {
        if (a.cardType !== 'subc') return
        if (a.sitioid !== sitioid) return
        if (id === 'TSS_VR' && (a.id === 'TSS_V' || a.id === 'TSS_R')) idxsToDelete.add(i)
        if (id === 'TSS_V'  && a.id === 'TSS_V')  idxsToDelete.add(i)
        if (id === 'TSS_R'  && a.id === 'TSS_R')  idxsToDelete.add(i)
      })
    }

    const actividades = sitio.actividades.filter((_, i) => !idxsToDelete.has(i))
    updateSitioField(sitio.id, 'actividades', actividades)
    showToast('Actividad eliminada')
  }

  function handleLcChange(field, value) {
    updateSitioField(sitio.id, field, value || null)
  }

  async function handleEliminarGasto(g) {
    const ok = await confirm('Eliminar Gasto', `¿Eliminar "${g.desc}" (${cop(g.valor)})?`)
    if (!ok) return
    try { await eliminarGasto(g.id); showToast('Gasto eliminado') }
    catch (e) { showToast('Error: ' + (e.message || ''), 'err') }
  }

  // Nokia inline edit helpers
  function nokiaStartEdit(act) {
    setNokiaEditIdx(act._idx)
    setNokiaEditForm({ id: act.id || 'TSS_VR', sitioid: act.sitioid || '', ciudad: act.ciudad || 'Ciudad_Principal', cant: act.cant || 1 })
  }
  function nokiaCancelEdit() { setNokiaEditIdx(null) }
  function nokiaConfirmEdit() { handleSave(nokiaEditIdx, nokiaEditForm); setNokiaEditIdx(null) }
  function nokiaUpd(f, v)    { setNokiaEditForm(p => ({ ...p, [f]: v })) }

  const cardProps = {
    subcs, isViewer, isFinal,
    onDelete: handleDeleteAct, onSave: handleSave, onLcChange: handleLcChange,
  }

  // ── Render ───────────────────────────────────────────────────────
  const nokiaBtnCols = hasButtons ? 1 : 0

  return (
    <>
      {/* ── Top row: Nokia table + Resumen TSS ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start', marginBottom: 14 }}>

      {/* ── NOKIA — LIQUIDACIÓN TSS ───────────────────────────── */}
      <div className="card">
        <div className="card-h" style={{ background: '#144E4A', borderLeftColor: '#CDFBF2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#CDFBF2' }}>Nokia — Liquidación TSS</h2>
          {hasButtons && (
            <button
              className="btn btn-sm"
              style={{ background: '#CDFBF2', color: '#144E4A', border: 'none', fontWeight: 700, borderRadius: 5 }}
              onClick={() => setModalNokiaAct(true)}
            >
              ＋ Actividad
            </button>
          )}
        </div>
        <div style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Sub-sitio</th>
                <th>Ciudad</th>
                <th className="num">Cant</th>
                <th className="num">P. Nokia</th>
                <th className="num">Total Nokia</th>
                <th className="num" style={{ color: '#b45309' }}>Costo SubC</th>
                {hasButtons && <th style={{ width: 60 }} />}
              </tr>
            </thead>
            <tbody>
              {nokiaActs.length === 0 && (
                <tr>
                  <td colSpan={7 + nokiaBtnCols} style={{ padding: 28, textAlign: 'center', color: '#9ca89c' }}>
                    Sin actividades — crea el TSS con actividades desde el Dashboard
                  </td>
                </tr>
              )}
              {nokiaActs.map((act, i) => {
                const isEditing = nokiaEditIdx === act._idx
                if (isEditing) {
                  return (
                    <tr key={i} style={{ background: '#f0f7f0' }}>
                      <td>
                        <select style={selEdit} value={nokiaEditForm.id} onChange={e => nokiaUpd('id', e.target.value)}>
                          {TIPOS_TSS.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                        </select>
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <input style={inpEdit} value={nokiaEditForm.sitioid}
                          onChange={e => nokiaUpd('sitioid', e.target.value)} />
                      </td>
                      <td>
                        <select style={selEdit} value={nokiaEditForm.ciudad} onChange={e => nokiaUpd('ciudad', e.target.value)}>
                          {ZONAS.map(z => <option key={z} value={z}>{z.replace('Ciudad_', '')}</option>)}
                        </select>
                      </td>
                      <td className="num">
                        <input type="number" min="1"
                          style={{ ...inpEdit, width: 50, textAlign: 'right' }}
                          value={nokiaEditForm.cant}
                          onChange={e => nokiaUpd('cant', parseInt(e.target.value) || 1)} />
                      </td>
                      <td className="num" style={{ color: '#000' }}>{cop(act.preNokia)}</td>
                      <td className="num fw7" style={{ color: '#000' }}>{cop(act.totalNokia)}</td>
                      <td className="num fw6" style={{ color: '#b45309' }}>{cop(act.preSubc)}</td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button style={{ ...btnConfirm, marginRight: 3 }} onClick={nokiaConfirmEdit} title="Guardar">✓</button>
                        <button style={btnCancel} onClick={nokiaCancelEdit} title="Cancelar">✕</button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={i}>
                    <td>
                      <span className="badge" style={{ background: '#f0f7f0', color: '#144E4A', fontSize: 8 }}>{act.id}</span>
                    </td>
                    <td style={{ fontSize: 10, fontWeight: 600, color: '#000' }}>{act.sitioid || '—'}</td>
                    <td style={{ fontSize: 9, color: '#555' }}>{(act.ciudad || '').replace('Ciudad_', '') || '—'}</td>
                    <td className="num" style={{ color: '#000' }}>{act.cant || 0}</td>
                    <td className="num" style={{ color: '#000' }}>{cop(act.preNokia)}</td>
                    <td className="num fw7" style={{ color: '#000' }}>{cop(act.totalNokia)}</td>
                    <td className="num fw6" style={{ color: '#b45309' }}>{cop(act.preSubc)}</td>
                    {hasButtons && (
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <button style={{ ...btnEdit, marginRight: 3 }} onClick={() => nokiaStartEdit(act)} title="Editar"><IconEdit /></button>
                        <button style={btnCancel} onClick={() => handleDeleteAct(act)} title="Eliminar">✕</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="tr-tot">
                <td colSpan={5}><strong>TOTAL NOKIA TSS</strong></td>
                <td className="num fw8" style={{ color: '#000' }}>{cop(totalNokia)}</td>
                <td className="num fw6" style={{ color: '#b45309' }}>{cop(totalNokiaCosubc)}</td>
                {hasButtons && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>{/* end Nokia card */}

      {/* ── RESUMEN TSS (beside Nokia table) ─────────────────── */}
      <div className="card">
        <div className="card-h"><h2>Resumen TSS</h2></div>
        <div className="card-b">

          {/* VENTA NOKIA */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca89c', letterSpacing: 1, marginBottom: 4 }}>VENTA NOKIA</div>
            {[
              { label: 'Nokia Visita',   value: nokiaVisitaVal  },
              { label: 'Nokia Reporte',  value: nokiaReporteVal },
              { label: 'Nokia V+R',      value: nokiaVRVal      },
              { label: 'Nokia Rediseño', value: nokiaRDVal      },
            ].filter(r => r.value > 0).map(r => (
              <div key={r.label} className="fb" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: '#555f55' }}>{r.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#144E4A' }}>{cop(r.value)}</span>
              </div>
            ))}
            <div className="fb" style={{ borderTop: '2px solid #144E4A', paddingTop: 5, marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#144E4A' }}>TOTAL VENTA</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#144E4A' }}>{cop(totalNokia)}</span>
            </div>
          </div>

          {/* COSTO SUBC */}
          <div style={{ borderTop: '1px solid #e0e4e0', marginTop: 4, paddingTop: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca89c', letterSpacing: 1, marginBottom: 4 }}>COSTO SUBC</div>
            {[
              { label: `Visita${lcVisita   ? ` — ${lcVisita}`   : ''}`, value: totalVisita + totalGastos, show: true },
              { label: `Reporte${lcReporte  ? ` — ${lcReporte}`  : ''}`, value: totalReporte,  show: true },
              { label: `Rediseño${lcRediseno ? ` — ${lcRediseno}` : ''}`, value: totalRediseno, show: totalRediseno > 0 },
            ].filter(r => r.show).map(r => (
              <div key={r.label} className="fb" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: '#555f55' }}>{r.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>{cop(r.value)}</span>
              </div>
            ))}
            <div className="fb" style={{ borderTop: '2px solid #FFC000', paddingTop: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>TOTAL COSTO</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#b45309' }}>{cop(totalSubcAll + totalGastos)}</span>
            </div>
          </div>

          <div className="fb" style={{ borderTop: '2px solid #144E4A', paddingTop: 8, marginTop: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>UTILIDAD</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: utilidad >= 0 ? '#1a7a1a' : '#c0392b' }}>
              {cop(utilidad)}
            </span>
          </div>
          <div className="fb" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>% MARGEN</span>
            <span className={`badge ${mcls(margen)}`} style={{ fontSize: 13, padding: '2px 10px' }}>
              {pct(margen)}
            </span>
          </div>
          <div className="mbar">
            <div className="mfill" style={{ width: `${Math.min(margen * 100, 100)}%`, background: marginColor }} />
          </div>
        </div>
      </div>

      </div>{/* end top grid */}

      {/* ── 2-col: Left (Visita + Rediseño) | Right (Reporte + Gastos) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>

        {/* ═══ LEFT ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <SubcCard
            title="SubC — Visita"
            lcField="lcVisita" lc={lcVisita} sub={subVisita}
            acts={visitaActs} total={totalVisita}
            showAdicional gastosBySitio={gastosBySitio} totalAdicional={totalAdicional}
            hideDelete
            {...cardProps}
          />

          <SubcCard
            title="SubC — Rediseño"
            lcField="lcRedesign" lc={lcRediseno} sub={subRediseno}
            acts={redisenoActs} total={totalRediseno}
            headerExtra={
              hasButtons ? (
                <button
                  className="btn btn-sm"
                  style={{ background: '#FFC000', color: '#7c3c00', border: 'none', fontWeight: 700, borderRadius: 5 }}
                  onClick={() => setModalRD(true)}
                >
                  ＋ TSS_RD
                </button>
              ) : null
            }
            {...cardProps}
          />
        </div>

        {/* ═══ RIGHT ═════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <SubcCard
            title="SubC — Reporte"
            lcField="lcReporte" lc={lcReporte} sub={subReporte}
            acts={reporteActs} total={totalReporte}
            hideDelete
            {...cardProps}
          />

          {/* Gastos Registrados */}
          <div className="card">
            <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Gastos Registrados</h2>
              {!isViewer && (
                <button className="btn bd btn-sm" onClick={() => setModalGasto(true)}>＋ Agregar Gasto</button>
              )}
            </div>
            {gastosS.length === 0 ? (
              <div className="card-b" style={{ color: '#9ca89c', fontSize: 11 }}>Sin gastos registrados.</div>
            ) : (
              <div style={{ padding: 0, overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Sub-Sitio TSS</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th className="num">Valor</th>
                      {!isViewer && <th style={{ width: 60 }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {gastosS.map(g => {
                      const tc = TIPO_COLOR_GASTO[g.tipo] || { bg: '#f3f4f6', color: '#374151' }
                      return (
                      <tr key={g.id}>
                        <td style={{ fontSize: 10, color: '#555' }}>{g.sub_sitio || '—'}</td>
                        <td><span className="badge" style={{ background: tc.bg, color: tc.color, fontSize: 9 }}>{g.tipo}</span></td>
                        <td style={{ fontSize: 11, color: '#000' }}>{g.desc}</td>
                        <td className="num fw7" style={{ color: '#000' }}>{cop(g.valor)}</td>
                        {!isViewer && (
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <button style={{ ...btnEdit, marginRight: 3 }} onClick={() => { setGastoEdit(g); setModalGasto(true) }} title="Editar"><IconEdit /></button>
                            <button style={btnCancel} onClick={() => handleEliminarGasto(g)} title="Eliminar">✕</button>
                          </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                  <tfoot>
                    <tr className="tr-tot">
                      <td colSpan={3}><strong>Total Gastos</strong></td>
                      <td className="num fw8" style={{ color: '#000' }}>{cop(totalGastos)}</td>
                      {!isViewer && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────── */}
      <TSSGastoModal
        open={modalGasto}
        onClose={() => { setModalGasto(false); setGastoEdit(null) }}
        sitioId={sitio.id}
        sitioids={sitioids}
        agregarGasto={agregarGasto}
        editarGasto={editarGasto}
        gasto={gastoEdit}
      />
      <AddRDModal
        open={modalRD}
        onClose={() => setModalRD(false)}
        sitio={sitio}
        sitioids={sitioids}
        addActividad={addActividad}
      />
      <AddNokiaActModal
        open={modalNokiaAct}
        onClose={() => setModalNokiaAct(false)}
        sitio={sitio}
        sitioids={sitioids}
        addActividad={addActividad}
      />
      <ConfirmModalUI />
    </>
  )
}
