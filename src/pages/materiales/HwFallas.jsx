import { useState, useMemo } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useConfirm } from '../../components/ConfirmModal'
import { showToast } from '../../components/Toast'

// ── Constantes ───────────────────────────────────────────────────
const ESTADO_CFG = {
  abierto: { label: 'Abierto',  bg: '#fef3cd', color: '#856404' },
  enviado: { label: 'Enviado',  bg: '#dbeafe', color: '#1e40af' },
  cerrado: { label: 'Cerrado',  bg: '#d4edda', color: '#1a6130' },
}

const MOTIVOS = [
  { value: 'falla_funcional',  label: '1. Falla Funcional' },
  { value: 'falla_mecanica',   label: '2. Falla Mecánica' },
  { value: 'mod_sw',           label: '3. Modificación de SW' },
  { value: 'mod_hw',           label: '4. Modificación de HW' },
]

const SITUACIONES = [
  { value: 'comisionamiento', label: '1. Durante comisionamiento' },
  { value: 'upgrade',         label: '2. Durante upgrades o modificaciones' },
  { value: 'tormenta',        label: '3. Durante tormenta o inmediatamente después' },
  { value: 'uso_normal',      label: '4. Durante uso normal' },
]

const PRECISIONES = [
  { value: 'sobrecarga',     label: '1. Sobrecarga' },
  { value: 'error_humano',   label: '2. Error humano (mal uso, quebrado)' },
  { value: 'no_especificado',label: '3. No se puede especificar' },
]

const OCURRENCIAS = [
  { value: 'permanente',   label: 'Permanente' },
  { value: 'reproducible', label: 'Reproducible' },
  { value: 'aleatorio',    label: 'Aleatorio' },
]

const EMPTY = {
  file_id: '', rma: '', fecha_envio: '', diligenciado_por: '',
  regional: '', ciudad: '', sitio: '', fecha_deteccion: '',
  ocurrencia: 'permanente', duracion_dias: '', duracion_horas: '', duracion_minutos: '',
  efecto_falla: '', pct_efecto: '', gravedad: '',
  falla_detectada_en: 'senal_hw',
  cod_equipo_1: '', cod_equipo_2: '', nombre_equipo: '',
  version_equipo: '', serial_falla: '',
  motivo_mantenimiento: 'falla_funcional',
  situacion_deteccion: 'uso_normal',
  precision_diagnostico: 'no_especificado',
  posicion_unidad: '',
  reemplazo_origen: '', reemplazo_nombre: '', reemplazo_version: '', reemplazo_serial: '',
  titulo: '', descripcion: '',
  estado: 'abierto', equipo_id: '',
}

// ── Badge estado ─────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.abierto
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6,
      fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

// ── Sección del modal ────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#144E4A', letterSpacing: .8,
        textTransform: 'uppercase', borderBottom: '1px solid #e8eae8', paddingBottom: 4, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ children, cols = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="fg">
      <label className="fl">{label}</label>
      {children}
    </div>
  )
}

// ── Modal crear / editar ─────────────────────────────────────────
function FallaModal({ falla, onClose, onSave }) {
  const [form, setForm] = useState(falla ? { ...falla } : { ...EMPTY })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = (k) => ({ className: 'fc', value: form[k] ?? '', onChange: e => set(k, e.target.value) })
  const sel = (k) => ({ className: 'fc', value: form[k] ?? '', onChange: e => set(k, e.target.value) })

  async function handleSave() {
    if (!form.serial_falla.trim()) { showToast('El número de serie es obligatorio', 'err'); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (e) {
      showToast('Error: ' + e.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 600,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720,
        boxShadow: '0 8px 32px rgba(0,0,0,.18)', padding: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700 }}>
            {falla ? 'Editar Failure Report' : 'Nuevo Failure Report'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>

        {/* 1. Header FR */}
        <Section title="Header">
          <Row cols={3}>
            <Field label="File ID"><input {...inp('file_id')} placeholder="DH211160552" /></Field>
            <Field label="RMA"><input {...inp('rma')} /></Field>
            <Field label="Fecha de Envío"><input type="date" {...inp('fecha_envio')} /></Field>
          </Row>
          <Row cols={1}>
            <Field label="Diligenciado por"><input {...inp('diligenciado_por')} placeholder="Nombre del responsable" /></Field>
          </Row>
        </Section>

        {/* 2. Info General */}
        <Section title="2. Información General">
          <Row cols={3}>
            <Field label="Regional"><input {...inp('regional')} placeholder="SUROCCIDENTE" /></Field>
            <Field label="Ciudad"><input {...inp('ciudad')} placeholder="CALI" /></Field>
            <Field label="Sitio"><input {...inp('sitio')} placeholder="CAL.Gaitan" /></Field>
          </Row>
          <Row cols={3}>
            <Field label="Fecha de Detección"><input type="date" {...inp('fecha_deteccion')} /></Field>
            <Field label="Ocurrencia">
              <select {...sel('ocurrencia')}>
                {OCURRENCIAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select {...sel('estado')}>
                <option value="abierto">Abierto</option>
                <option value="enviado">Enviado</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </Field>
          </Row>
          <Row cols={3}>
            <Field label="Duración (días)"><input type="number" {...inp('duracion_dias')} min={0} /></Field>
            <Field label="Duración (horas)"><input type="number" {...inp('duracion_horas')} min={0} /></Field>
            <Field label="Duración (min)"><input type="number" {...inp('duracion_minutos')} min={0} /></Field>
          </Row>
        </Section>

        {/* 3a. HW */}
        <Section title="3a. Información de Hardware">
          <Row cols={4}>
            <Field label="Código Equipo 1"><input {...inp('cod_equipo_1')} placeholder="473764A" /></Field>
            <Field label="Código Equipo 2"><input {...inp('cod_equipo_2')} placeholder="473095A" /></Field>
            <Field label="Nombre Equipo"><input {...inp('nombre_equipo')} placeholder="ASIA" /></Field>
            <Field label="Versión"><input {...inp('version_equipo')} placeholder="204" /></Field>
          </Row>
          <Row cols={1}>
            <Field label="Número de Serie (en falla) *">
              <input {...inp('serial_falla')} placeholder="DH211160552" style={{ fontWeight: 700 }} />
            </Field>
          </Row>
          <Row cols={3}>
            <Field label="Motivo de Mantenimiento">
              <select {...sel('motivo_mantenimiento')}>
                {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Situación de Detección">
              <select {...sel('situacion_deteccion')}>
                {SITUACIONES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Precisión del Diagnóstico">
              <select {...sel('precision_diagnostico')}>
                {PRECISIONES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          </Row>
          <Row cols={1}>
            <Field label="Posición de la Unidad en el Sistema">
              <input {...inp('posicion_unidad')} />
            </Field>
          </Row>
        </Section>

        {/* Unidad de Reemplazo */}
        <Section title="Unidad de Reemplazo">
          <Row cols={1}>
            <Field label="Origen"><input {...inp('reemplazo_origen')} placeholder="Comcel Instalaciones Cali - WBS: W-0403-RE-30" /></Field>
          </Row>
          <Row cols={3}>
            <Field label="Nombre"><input {...inp('reemplazo_nombre')} /></Field>
            <Field label="Versión"><input {...inp('reemplazo_version')} /></Field>
            <Field label="Número de Serie"><input {...inp('reemplazo_serial')} /></Field>
          </Row>
        </Section>

        {/* 4. Descripción */}
        <Section title="4. Descripción">
          <Row cols={1}>
            <Field label="Título"><input {...inp('titulo')} placeholder="Hw no reconocido por Sistema" /></Field>
          </Row>
          <div className="fg">
            <label className="fl">Descripción detallada</label>
            <textarea className="fc" rows={3} value={form.descripcion ?? ''}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Describe el comportamiento observado…" />
          </div>
        </Section>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} className="btn-sec" style={{ fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            style={{ fontSize: 12, background: '#144E4A', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 20px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Generar PDF Nokia FR ─────────────────────────────────────────
async function generarPDF(falla) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  const W = 215.9
  const green = '#144E4A'

  // Header
  doc.setFillColor(20, 78, 74)
  doc.rect(0, 0, W, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FAILURE REPORT', W / 2, 14, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  if (falla.file_id) doc.text(`File ID: ${falla.file_id}`, W - 10, 8, { align: 'right' })
  if (falla.rma)     doc.text(`RMA: ${falla.rma}`,         W - 10, 14, { align: 'right' })

  let y = 30

  function label(text, x, yy) {
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
    doc.text(text.toUpperCase(), x, yy)
  }
  function value(text, x, yy, opts = {}) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20)
    doc.text(String(text || '—'), x, yy, opts)
  }
  function sectionTitle(text, yy) {
    doc.setFillColor(240, 242, 240)
    doc.rect(10, yy - 5, W - 20, 7, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 78, 74)
    doc.text(text, 13, yy)
    return yy + 6
  }

  // Sección 1 - Remitente
  y = sectionTitle('1. REMITENTE', y)
  label('Empresa', 12, y); value('Nokia Solutions and Networks Commissioning', 40, y)
  label('Diligenciado por', 130, y); value(falla.diligenciado_por, 165, y)
  y += 7
  label('Fecha de envío', 12, y); value(falla.fecha_envio || '—', 50, y)
  y += 10

  // Sección 2 - Info General
  y = sectionTitle('2. INFORMACIÓN GENERAL', y)
  label('Regional', 12, y);      value(falla.regional, 40, y)
  label('Ciudad', 80, y);        value(falla.ciudad, 100, y)
  label('Sitio', 140, y);        value(falla.sitio, 158, y)
  y += 7
  label('Fecha detección', 12, y); value(falla.fecha_deteccion || '—', 50, y)
  label('Ocurrencia', 80, y);      value(falla.ocurrencia || '—', 110, y)
  y += 7
  const dur = [
    falla.duracion_dias    ? `${falla.duracion_dias}d`    : '',
    falla.duracion_horas   ? `${falla.duracion_horas}h`   : '',
    falla.duracion_minutos ? `${falla.duracion_minutos}m` : '',
  ].filter(Boolean).join(' ')
  label('Duración del efecto', 12, y); value(dur || '—', 55, y)
  y += 10

  // Sección 3a - HW
  y = sectionTitle('3a. INFORMACIÓN DE HARDWARE', y)
  label('Cód. Equipo 1', 12, y);   value(falla.cod_equipo_1, 40, y)
  label('Cód. Equipo 2', 65, y);   value(falla.cod_equipo_2, 93, y)
  label('Nombre Equipo', 120, y);  value(falla.nombre_equipo, 150, y)
  label('Versión', 175, y);        value(falla.version_equipo, 190, y)
  y += 7
  label('Número de Serie (en falla)', 12, y)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 78, 74)
  doc.text(falla.serial_falla || '—', 75, y)
  y += 8

  label('Motivo de Mantenimiento', 12, y)
  value(MOTIVOS.find(m => m.value === falla.motivo_mantenimiento)?.label || falla.motivo_mantenimiento || '—', 65, y)
  y += 6
  label('Situación de Detección', 12, y)
  value(SITUACIONES.find(s => s.value === falla.situacion_deteccion)?.label || falla.situacion_deteccion || '—', 65, y)
  y += 6
  label('Precisión del Diagnóstico', 12, y)
  value(PRECISIONES.find(p => p.value === falla.precision_diagnostico)?.label || falla.precision_diagnostico || '—', 65, y)
  y += 8

  if (falla.reemplazo_origen || falla.reemplazo_serial) {
    y = sectionTitle('UNIDAD DE REEMPLAZO', y)
    label('Origen', 12, y); value(falla.reemplazo_origen, 30, y)
    y += 6
    label('Nombre', 12, y);  value(falla.reemplazo_nombre,  30, y)
    label('Versión', 80, y); value(falla.reemplazo_version, 100, y)
    label('Serie',  130, y); value(falla.reemplazo_serial,  148, y)
    y += 10
  }

  // Sección 4 - Descripción
  y = sectionTitle('4. DESCRIPCIÓN', y)
  label('Título', 12, y); value(falla.titulo, 28, y)
  y += 8
  if (falla.descripcion) {
    label('Descripción detallada', 12, y)
    y += 5
    const lines = doc.splitTextToSize(falla.descripcion, W - 24)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20)
    doc.text(lines, 12, y)
    y += lines.length * 5
  }

  // Footer
  doc.setFontSize(7); doc.setTextColor(160, 160, 160)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')} · Copyright © 2026 Scytel Networks`, W / 2, 272, { align: 'center' })

  doc.save(`FR_${falla.serial_falla || 'sin-serial'}_${falla.sitio || ''}.pdf`)
}

// ── Página principal ─────────────────────────────────────────────
export default function HwFallas() {
  const hwFallas    = useHwStore(s => s.hwFallas)
  const saveFalla   = useHwStore(s => s.saveFalla)
  const deleteFalla = useHwStore(s => s.deleteFalla)
  const confirm     = useConfirm()

  const [modal,   setModal]   = useState(null) // null | 'new' | falla object
  const [search,  setSearch]  = useState('')
  const [filtro,  setFiltro]  = useState('todos')

  const rows = useMemo(() => {
    let list = hwFallas
    if (filtro !== 'todos') list = list.filter(f => f.estado === filtro)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        (f.serial_falla || '').toLowerCase().includes(q) ||
        (f.sitio        || '').toLowerCase().includes(q) ||
        (f.nombre_equipo|| '').toLowerCase().includes(q) ||
        (f.titulo       || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [hwFallas, filtro, search])

  const stats = useMemo(() => ({
    total:   hwFallas.length,
    abierto: hwFallas.filter(f => f.estado === 'abierto').length,
    enviado: hwFallas.filter(f => f.estado === 'enviado').length,
    cerrado: hwFallas.filter(f => f.estado === 'cerrado').length,
  }), [hwFallas])

  async function handleDelete(f) {
    const ok = await confirm({ title: 'Eliminar Failure Report', message: `¿Eliminar FR del serial ${f.serial_falla}?`, confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    try { await deleteFalla(f.id); showToast('FR eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  return (
    <>
      {/* Header */}
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            HW en Falla
          </h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            {stats.total} registro{stats.total !== 1 ? 's' : ''} ·&nbsp;
            <span style={{ color: '#856404', fontWeight: 600 }}>{stats.abierto} abierto{stats.abierto !== 1 ? 's' : ''}</span>
            {stats.enviado > 0 && <> · <span style={{ color: '#1e40af', fontWeight: 600 }}>{stats.enviado} enviado{stats.enviado !== 1 ? 's' : ''}</span></>}
            {stats.cerrado > 0 && <> · <span style={{ color: '#1a6130', fontWeight: 600 }}>{stats.cerrado} cerrado{stats.cerrado !== 1 ? 's' : ''}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="fc" placeholder="Buscar serial, sitio, equipo…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 220 }} />
          <select className="fc" value={filtro} onChange={e => setFiltro(e.target.value)} style={{ fontSize: 11 }}>
            <option value="todos">Todos los estados</option>
            <option value="abierto">Abiertos</option>
            <option value="enviado">Enviados</option>
            <option value="cerrado">Cerrados</option>
          </select>
          <button
            onClick={() => setModal('new')}
            style={{ fontSize: 11, background: '#144E4A', color: '#fff', border: 'none',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
            + Nuevo FR
          </button>
        </div>
      </div>

      {/* Tabla */}
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>
          {hwFallas.length === 0 ? 'Sin registros. Crea el primer Failure Report.' : 'Sin resultados con los filtros actuales.'}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8faf8', borderBottom: '2px solid #e8eae8' }}>
                {['Serial', 'Equipo', 'Sitio', 'Fecha Det.', 'Motivo', 'Título', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                    color: '#555', fontSize: 10, letterSpacing: .5, whiteSpace: 'nowrap',
                    position: 'sticky', top: 0, background: '#f8faf8', zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(f => (
                <tr key={f.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#144E4A', fontSize: 10 }}>
                    {f.serial_falla}
                  </td>
                  <td style={{ padding: '7px 10px', color: '#374151' }}>
                    {f.nombre_equipo || '—'}
                    {f.version_equipo && <span style={{ color: '#9ca3af', marginLeft: 4 }}>v{f.version_equipo}</span>}
                  </td>
                  <td style={{ padding: '7px 10px', color: '#374151' }}>{f.sitio || '—'}</td>
                  <td style={{ padding: '7px 10px', color: '#555', whiteSpace: 'nowrap' }}>{f.fecha_deteccion || '—'}</td>
                  <td style={{ padding: '7px 10px', color: '#555', fontSize: 10 }}>
                    {MOTIVOS.find(m => m.value === f.motivo_mantenimiento)?.label.replace(/^\d\.\s/, '') || '—'}
                  </td>
                  <td style={{ padding: '7px 10px', color: '#374151', maxWidth: 200,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.titulo || '—'}
                  </td>
                  <td style={{ padding: '7px 10px' }}><EstadoBadge estado={f.estado} /></td>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setModal(f)}
                        style={{ fontSize: 10, color: '#144E4A', background: 'none',
                          border: '1px solid #a7c4a7', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => generarPDF(f)}
                        style={{ fontSize: 10, color: '#1e40af', background: 'none',
                          border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                        PDF
                      </button>
                      <button onClick={() => handleDelete(f)}
                        style={{ fontSize: 10, color: '#ef4444', background: 'none',
                          border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                        Quitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <FallaModal
          falla={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={saveFalla}
        />
      )}
    </>
  )
}
