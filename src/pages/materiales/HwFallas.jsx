import { useState, useMemo, useRef } from 'react'
import { useHwStore } from '../../store/useHwStore'
import { useConfirm } from '../../components/ConfirmModal'
import { showToast } from '../../components/Toast'
import { getSupabaseClient } from '../../lib/supabase'

// ── Constantes ───────────────────────────────────────────────────
const ESTADO_CFG = {
  abierto: { label: 'Abierto', bg: '#fef3cd', color: '#856404' },
  enviado: { label: 'Enviado', bg: '#dbeafe', color: '#1e40af' },
  cerrado: { label: 'Cerrado', bg: '#d4edda', color: '#1a6130' },
}

const MOTIVOS = [
  { value: 'falla_funcional', label: '1. Falla Funcional' },
  { value: 'falla_mecanica',  label: '2. Falla Mecánica' },
  { value: 'mod_sw',          label: '3. Modificación de SW' },
  { value: 'mod_hw',          label: '4. Modificación de HW' },
]

const SITUACIONES = [
  { value: 'comisionamiento', label: '1. Durante comisionamiento' },
  { value: 'upgrade',         label: '2. Durante upgrades o modificaciones' },
  { value: 'tormenta',        label: '3. Durante tormenta o inmediatamente después' },
  { value: 'uso_normal',      label: '4. Durante uso normal' },
]

const PRECISIONES = [
  { value: 'sobrecarga',      label: '1. Sobrecarga' },
  { value: 'error_humano',    label: '2. Error humano (mal uso, quebrado)' },
  { value: 'no_especificado', label: '3. No se puede especificar' },
]

const OCURRENCIAS = [
  { value: 'permanente',   label: 'Permanente' },
  { value: 'reproducible', label: 'Reproducible' },
  { value: 'aleatorio',    label: 'Aleatorio' },
]

const EFECTOS = [
  { value: 1, label: '1. Capacidad de Tráfico disminuida' },
  { value: 2, label: '2. PCM Circuitos o Radio Carriers indisponibles' },
  { value: 3, label: '3. Suscriptores desconectados' },
  { value: 4, label: '4. Facilidades del usuario indisponibles' },
  { value: 5, label: '5. Facilidades usadas por funcionarios indisponibles' },
  { value: 6, label: '6. No puede ser accesado' },
]

const GRAVEDADES = [
  { value: 1, label: '1. Significativamente disminuido' },
  { value: 2, label: '2. Claramente disminuido' },
  { value: 3, label: '3. Disminuido' },
  { value: 4, label: '4. Levemente disminuido' },
  { value: 5, label: '5. Propuesta de modificación o mejora (no falla)' },
]

const FALLA_BASADA = [
  { value: 'error_printout',  label: '1. Error printout' },
  { value: 'senal_hw',        label: '2. Señal HW' },
  { value: 'suscriptor',      label: '3. Notificación del Suscriptor' },
  { value: 'otros',           label: '4. Otros' },
]

const EMPTY = {
  // Header
  file_id: '', rma: '', fecha_envio: '', diligenciado_por: '',
  // Remitente
  empresa_nombre: '', empresa_direccion: '', empresa_telefono: '',
  // Retornar para
  retornar_nombre: '', retornar_direccion: '', retornar_email: '',
  // Info general
  regional: '', ciudad: '', sitio: '', fecha_deteccion: '',
  ocurrencia: 'permanente',
  duracion_dias: '', duracion_horas: '', duracion_minutos: '',
  falla_detectada_en: 'senal_hw',
  efecto_falla: '', pct_efecto: '', gravedad: '',
  // HW
  cod_equipo_1: '', cod_equipo_2: '', nombre_equipo: '',
  version_equipo: '', serial_falla: '',
  motivo_mantenimiento: 'falla_funcional',
  situacion_deteccion: 'uso_normal',
  precision_diagnostico: 'no_especificado',
  posicion_unidad: '',
  // Reemplazo
  reemplazo_origen: '', reemplazo_nombre: '', reemplazo_version: '', reemplazo_serial: '',
  // Descripción
  titulo: '', descripcion: '', imagen_url: '',
  // Estado
  estado: 'abierto', equipo_id: '',
}

// ── Helpers UI ───────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.abierto
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6,
      fontSize: 9, fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#144E4A', letterSpacing: .8,
        textTransform: 'uppercase', borderBottom: '1px solid #e8eae8', paddingBottom: 4, marginBottom: 10 }}>
        {title}
        {subtitle && <span style={{ fontSize: 9, fontWeight: 400, color: '#9ca3af', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>{subtitle}</span>}
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

function Field({ label, children, span }) {
  return (
    <div className="fg" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label className="fl">{label}</label>
      {children}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────
function FallaModal({ falla, onClose, onSave }) {
  const [form,       setForm]       = useState(falla ? { ...falla } : { ...EMPTY })
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [imgPreview, setImgPreview] = useState(falla?.imagen_url || null)
  const imgRef = useRef(null)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp  = (k)    => ({ className: 'fc', value: form[k] ?? '', onChange: e => setF(k, e.target.value) })
  const sel  = (k)    => ({ className: 'fc', value: form[k] ?? '', onChange: e => setF(k, e.target.value) })

  async function handleImgUpload(file) {
    if (!file) return
    setUploading(true)
    try {
      const db   = getSupabaseClient()
      const path = `fallas/${Date.now()}_${file.name.replace(/\s/g, '_')}`
      const { error } = await db.storage.from('facturacion').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = db.storage.from('facturacion').getPublicUrl(path)
      setF('imagen_url', data.publicUrl)
      setImgPreview(data.publicUrl)
      showToast('Imagen cargada')
    } catch (e) {
      showToast('Error subiendo imagen: ' + e.message, 'err')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!form.serial_falla?.trim()) { showToast('El número de serie es obligatorio', 'err'); return }
    setSaving(true)
    try {
      const NUM_FIELDS  = ['efecto_falla','gravedad','pct_efecto','duracion_dias','duracion_horas','duracion_minutos','equipo_id']
      const DATE_FIELDS = ['fecha_envio','fecha_deteccion']
      const clean = { ...form }
      NUM_FIELDS.forEach(k  => { clean[k] = clean[k] !== '' && clean[k] != null ? (Number(clean[k]) || null) : null })
      DATE_FIELDS.forEach(k => { clean[k] = clean[k] || null })
      await onSave(clean)
      onClose()
    }
    catch (e) { showToast('Error: ' + e.message, 'err') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 600,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 760,
        boxShadow: '0 8px 32px rgba(0,0,0,.18)', padding: 24, marginBottom: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700 }}>
            {falla ? 'Editar Failure Report' : 'Nuevo Failure Report'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>

        {/* ── Header FR ── */}
        <Section title="Header">
          <Row cols={2}>
            <Field label="File ID"><input {...inp('file_id')} placeholder="DH211160552" /></Field>
            <Field label="RMA"><input {...inp('rma')} /></Field>
          </Row>
        </Section>

        {/* ── 1. Remitente ── */}
        <Section title="1. Remitente">
          <Row cols={1}>
            <Field label="Nombre de la Empresa">
              <input {...inp('empresa_nombre')} placeholder="Nokia Solutions and Networks Commissioning" />
            </Field>
          </Row>
          <Row cols={2}>
            <Field label="Dirección">
              <input {...inp('empresa_direccion')} placeholder="MICROLINK KM 2.5 vía Siberia…" />
            </Field>
            <Field label="Teléfono">
              <input {...inp('empresa_telefono')} placeholder="3107245382" />
            </Field>
          </Row>
          <Row cols={2}>
            <Field label="Diligenciado por">
              <input {...inp('diligenciado_por')} placeholder="Nombre del técnico" />
            </Field>
            <Field label="Día del Envío"><input type="date" {...inp('fecha_envio')} /></Field>
          </Row>
        </Section>

        {/* ── Retornar para ── */}
        <Section title="Retornar para" subtitle="(completar solo si difiere del remitente)">
          <Row cols={1}>
            <Field label="Nombre"><input {...inp('retornar_nombre')} /></Field>
          </Row>
          <Row cols={2}>
            <Field label="Dirección"><input {...inp('retornar_direccion')} /></Field>
            <Field label="E-mail"><input type="email" {...inp('retornar_email')} placeholder="nombre@empresa.com" /></Field>
          </Row>
        </Section>

        {/* ── 2. Información General ── */}
        <Section title="2. Información General">
          <Row cols={3}>
            <Field label="Regional"><input {...inp('regional')} placeholder="Ej: Suroccidente" /></Field>
            <Field label="Ciudad"><input {...inp('ciudad')} placeholder="Ej: Cali" /></Field>
            <Field label="Sitio"><input {...inp('sitio')} placeholder="Ej: CAL.Gaitan" /></Field>
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
          <Row cols={2}>
            <Field label="Falla detectada basada en">
              <select {...sel('falla_detectada_en')}>
                {FALLA_BASADA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Efecto o Extensión de Falla">
              <select className="fc" value={form.efecto_falla ?? ''} onChange={e => setF('efecto_falla', e.target.value ? Number(e.target.value) : '')}>
                <option value="">— Seleccionar —</option>
                {EFECTOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </Field>
          </Row>
          <Row cols={2}>
            <Field label="Gravedad de la Falla">
              <select className="fc" value={form.gravedad ?? ''} onChange={e => setF('gravedad', e.target.value ? Number(e.target.value) : '')}>
                <option value="">— Seleccionar —</option>
                {GRAVEDADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="% Efecto">
              <input type="number" {...inp('pct_efecto')} min={0} max={100} placeholder="100" />
            </Field>
          </Row>
        </Section>

        {/* ── 3a. Hardware ── */}
        <Section title="3a. Información de Hardware">
          <Row cols={4}>
            <Field label="Código Equipo 1"><input {...inp('cod_equipo_1')} placeholder="473764A" /></Field>
            <Field label="Código Equipo 2"><input {...inp('cod_equipo_2')} placeholder="473095A" /></Field>
            <Field label="Nombre Equipo">
              <input {...inp('nombre_equipo')} placeholder="Ej: ASIA, AQQA…" />
            </Field>
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

        {/* ── Unidad de Reemplazo ── */}
        <Section title="Unidad de Reemplazo">
          <Row cols={1}>
            <Field label="Origen">
              <input {...inp('reemplazo_origen')} placeholder="Ej: Comcel Instalaciones Cali — WBS: W-0403-RE-30" />
            </Field>
          </Row>
          <Row cols={3}>
            <Field label="Nombre"><input {...inp('reemplazo_nombre')} /></Field>
            <Field label="Versión"><input {...inp('reemplazo_version')} /></Field>
            <Field label="Número de Serie"><input {...inp('reemplazo_serial')} /></Field>
          </Row>
        </Section>

        {/* ── 4. Descripción ── */}
        <Section title="4. Descripción">
          <Row cols={1}>
            <Field label="Título">
              <input {...inp('titulo')} placeholder="Hw no reconocido por Sistema" />
            </Field>
          </Row>
          <div className="fg" style={{ marginBottom: 8 }}>
            <label className="fl">Descripción detallada</label>
            <textarea className="fc" rows={3} value={form.descripcion ?? ''}
              onChange={e => setF('descripcion', e.target.value)}
              placeholder="Describe el comportamiento observado…" />
          </div>

          <div className="fg">
            <label className="fl">Imagen / Evidencia fotográfica</label>
            <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => handleImgUpload(e.target.files[0])} />
            {imgPreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={imgPreview} alt="evidencia"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #e8eae8', display: 'block' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button type="button" onClick={() => imgRef.current?.click()}
                    style={{ fontSize: 10, color: '#144E4A', background: 'none', border: '1px solid #a7c4a7',
                      borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Cambiar</button>
                  <button type="button" onClick={() => { setF('imagen_url', ''); setImgPreview(null) }}
                    style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca',
                      borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Quitar</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading}
                style={{ fontSize: 11, color: '#4b5563', background: '#f9fafb',
                  border: '2px dashed #d1d5db', borderRadius: 8, padding: '14px 24px',
                  cursor: uploading ? 'not-allowed' : 'pointer', width: '100%', textAlign: 'center' }}>
                {uploading ? 'Subiendo…' : '+ Subir imagen de evidencia'}
              </button>
            )}
          </div>
        </Section>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} className="btn-sec" style={{ fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || uploading}
            style={{ fontSize: 12, background: '#144E4A', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 20px', cursor: (saving || uploading) ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Export Excel Nokia FR ────────────────────────────────────────
async function exportarExcelNokia(falla) {
  try {
    showToast('Generando Excel…')
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const response = await fetch(import.meta.env.BASE_URL + 'nokia_fr_template.xlsx')
    if (!response.ok) throw new Error('Template no encontrado')
    const buffer = await response.arrayBuffer()
    await wb.xlsx.load(buffer)
    const ws = wb.getWorksheet('Nokia Failure Report')
    if (!ws) throw new Error('Hoja "Nokia Failure Report" no encontrada en el template')

    const set = (addr, val) => {
      ws.getCell(addr).value = (val !== undefined && val !== '' && val !== null) ? val : null
    }

    const xGroup = (pairs, selected) => {
      pairs.forEach(([addr, val]) => set(addr, selected === val ? 'X' : null))
    }

    // Header
    set('Q7', falla.file_id || null)
    set('Q8', falla.rma || null)

    // 1. Remitente
    set('C11', falla.empresa_nombre || 'Nokia Solutions and Networks Commissioning')
    set('M11', falla.diligenciado_por || null)
    set('C13', falla.empresa_direccion || null)
    set('M13', falla.empresa_telefono || null)
    if (falla.fecha_envio) set('Q15', new Date(falla.fecha_envio + 'T12:00:00'))
    else set('Q15', null)

    // Retornar para
    set('C17', falla.retornar_nombre || null)
    set('M17', falla.retornar_email || null)
    set('C19', falla.retornar_direccion || null)

    // 2. Información General
    set('D21', falla.regional || null)
    set('E21', falla.ciudad   || null)
    set('F21', falla.sitio    || null)
    set('M21', falla.pct_efecto ? Number(falla.pct_efecto) : null)

    // Efecto de falla — X en columna G (opción 6 va en fila 27)
    const efectoRows = { 1: 21, 2: 22, 3: 23, 4: 24, 5: 25, 6: 27 }
    Object.entries(efectoRows).forEach(([n, row]) =>
      set('G' + row, Number(falla.efecto_falla) === Number(n) ? 'X' : null))

    // Falla detectada basada en — X en columna C
    xGroup([
      ['C23', 'error_printout'],
      ['C24', 'senal_hw'],
      ['C25', 'suscriptor'],
      ['C26', 'otros'],
    ], falla.falla_detectada_en)

    // Ocurrencia
    xGroup([
      ['C31', 'permanente'],
      ['E30', 'reproducible'],
      ['E31', 'aleatorio'],
    ], falla.ocurrencia)

    // Fechas y duración
    if (falla.fecha_deteccion) set('G31', new Date(falla.fecha_deteccion + 'T12:00:00'))
    else set('G31', null)
    set('I31', falla.duracion_dias    ? Number(falla.duracion_dias)    : null)
    set('K31', falla.duracion_horas   ? Number(falla.duracion_horas)   : null)
    set('M31', falla.duracion_minutos ? Number(falla.duracion_minutos) : null)

    // Gravedad — X en columna O, filas 22-26
    const gravedadRows = { 1: 22, 2: 23, 3: 24, 4: 25, 5: 26 }
    Object.entries(gravedadRows).forEach(([n, row]) =>
      set('O' + row, Number(falla.gravedad) === Number(n) ? 'X' : null))

    // 3a. Hardware
    set('C36', falla.cod_equipo_1  || null)
    set('D36', falla.cod_equipo_2  || null)
    set('G36', falla.nombre_equipo || null)
    set('L36', falla.version_equipo || null)
    set('O36', falla.serial_falla  || null)

    // Motivo de mantenimiento — X en columna C
    xGroup([
      ['C38', 'falla_funcional'],
      ['C40', 'falla_mecanica'],
      ['C42', 'mod_sw'],
      ['C44', 'mod_hw'],
    ], falla.motivo_mantenimiento)

    // Situación de detección — X en columna G
    xGroup([
      ['G38', 'comisionamiento'],
      ['G40', 'upgrade'],
      ['G42', 'tormenta'],
      ['G44', 'uso_normal'],
    ], falla.situacion_deteccion)

    // Precisión del diagnóstico — X en columna L
    xGroup([
      ['L38', 'sobrecarga'],
      ['L40', 'error_humano'],
      ['L42', 'no_especificado'],
    ], falla.precision_diagnostico)

    // Posición de la unidad
    set('O44', falla.posicion_unidad || null)

    // Unidad de reemplazo
    set('D45', falla.reemplazo_origen  || null)
    set('G46', falla.reemplazo_nombre  || null)
    set('L46', falla.reemplazo_version || null)
    set('O46', falla.reemplazo_serial  || null)

    // 4. Descripción
    set('D53', falla.titulo      || null)
    set('E54', falla.descripcion || null)

    // Imagen de evidencia en C55:I69
    if (falla.imagen_url) {
      try {
        const imgResp  = await fetch(falla.imagen_url)
        const imgBlob  = await imgResp.blob()
        const imgB64   = await new Promise((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res(reader.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(imgBlob)
        })
        const ext = falla.imagen_url.toLowerCase().includes('.png') ? 'png' : 'jpeg'
        const imageId = wb.addImage({ base64: imgB64, extension: ext })
        ws.addImage(imageId, {
          tl: { col: 2, row: 54 },
          br: { col: 9, row: 69 },
          editAs: 'oneCell',
        })
      } catch { /* imagen no disponible, continuar sin ella */ }
    }

    // Descargar
    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `FR_Nokia_${falla.serial_falla || falla.file_id || 'sin-serial'}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Excel descargado')
  } catch (e) {
    showToast('Error generando Excel: ' + e.message, 'err')
  }
}

// ── Generar PDF Nokia FR ─────────────────────────────────────────
async function generarPDF(falla) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9

  doc.setFillColor(20, 78, 74)
  doc.rect(0, 0, W, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text('FAILURE REPORT', W / 2, 14, { align: 'center' })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  if (falla.file_id) doc.text(`File ID: ${falla.file_id}`, W - 10, 8,  { align: 'right' })
  if (falla.rma)     doc.text(`RMA: ${falla.rma}`,         W - 10, 14, { align: 'right' })

  let y = 30

  const lbl = (text, x, yy) => {
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
    doc.text(text.toUpperCase(), x, yy)
  }
  const val = (text, x, yy) => {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20)
    doc.text(String(text || '—'), x, yy)
  }
  const sec = (text, yy) => {
    doc.setFillColor(240, 242, 240)
    doc.rect(10, yy - 5, W - 20, 7, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 78, 74)
    doc.text(text, 13, yy)
    return yy + 7
  }

  // 1. Remitente
  y = sec('1. REMITENTE', y)
  lbl('Empresa', 12, y);           val(falla.empresa_nombre || 'Nokia Solutions and Networks Commissioning', 35, y)
  lbl('Diligenciado por', 130, y); val(falla.diligenciado_por, 165, y)
  y += 6
  lbl('Dirección', 12, y); val(falla.empresa_direccion, 35, y)
  y += 6
  lbl('Teléfono', 12, y);    val(falla.empresa_telefono, 35, y)
  lbl('Día del envío', 80, y); val(falla.fecha_envio || '—', 110, y)
  y += 8

  if (falla.retornar_nombre || falla.retornar_email) {
    y = sec('RETORNAR PARA', y)
    lbl('Nombre', 12, y); val(falla.retornar_nombre, 35, y)
    lbl('E-mail', 100, y); val(falla.retornar_email, 120, y)
    y += 6
    lbl('Dirección', 12, y); val(falla.retornar_direccion, 35, y)
    y += 8
  }

  // 2. Info General
  y = sec('2. INFORMACIÓN GENERAL', y)
  lbl('Regional', 12, y);  val(falla.regional, 35, y)
  lbl('Ciudad',   70, y);  val(falla.ciudad,   90, y)
  lbl('Sitio',   130, y);  val(falla.sitio,   148, y)
  y += 6
  lbl('Fecha detección', 12, y); val(falla.fecha_deteccion || '—', 50, y)
  lbl('Ocurrencia',      80, y); val(falla.ocurrencia || '—',      115, y)
  y += 6
  const dur = [
    falla.duracion_dias    ? `${falla.duracion_dias}d`    : '',
    falla.duracion_horas   ? `${falla.duracion_horas}h`   : '',
    falla.duracion_minutos ? `${falla.duracion_minutos}m` : '',
  ].filter(Boolean).join(' ')
  lbl('Duración del efecto', 12, y); val(dur || '—', 58, y)
  y += 6
  lbl('Falla detectada basada en', 12, y)
  val(FALLA_BASADA.find(f => f.value === falla.falla_detectada_en)?.label || '—', 68, y)
  y += 6
  lbl('Efecto de falla', 12, y)
  val(EFECTOS.find(e => e.value === falla.efecto_falla)?.label || '—', 50, y)
  if (falla.pct_efecto) { lbl('%', 140, y); val(`${falla.pct_efecto}%`, 148, y) }
  y += 6
  lbl('Gravedad', 12, y)
  val(GRAVEDADES.find(g => g.value === falla.gravedad)?.label || '—', 35, y)
  y += 10

  // 3a. HW
  y = sec('3a. INFORMACIÓN DE HARDWARE', y)
  lbl('Cód. Equipo 1', 12, y);  val(falla.cod_equipo_1,   40, y)
  lbl('Cód. Equipo 2', 65, y);  val(falla.cod_equipo_2,   93, y)
  lbl('Nombre',       120, y);  val(falla.nombre_equipo,  138, y)
  lbl('Versión',      170, y);  val(falla.version_equipo, 185, y)
  y += 6
  lbl('Número de Serie (en falla)', 12, y)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 78, 74)
  doc.text(falla.serial_falla || '—', 78, y)
  y += 8
  lbl('Motivo de Mantenimiento', 12, y)
  val(MOTIVOS.find(m => m.value === falla.motivo_mantenimiento)?.label || '—', 68, y)
  y += 6
  lbl('Situación de Detección', 12, y)
  val(SITUACIONES.find(s => s.value === falla.situacion_deteccion)?.label || '—', 66, y)
  y += 6
  lbl('Precisión del Diagnóstico', 12, y)
  val(PRECISIONES.find(p => p.value === falla.precision_diagnostico)?.label || '—', 68, y)
  y += 8

  if (falla.reemplazo_origen || falla.reemplazo_serial) {
    y = sec('UNIDAD DE REEMPLAZO', y)
    lbl('Origen',  12, y); val(falla.reemplazo_origen,  30, y); y += 6
    lbl('Nombre',  12, y); val(falla.reemplazo_nombre,  30, y)
    lbl('Versión', 80, y); val(falla.reemplazo_version, 100, y)
    lbl('Serie',  130, y); val(falla.reemplazo_serial,  148, y)
    y += 10
  }

  // 4. Descripción
  y = sec('4. DESCRIPCIÓN', y)
  lbl('Título', 12, y); val(falla.titulo, 28, y); y += 8
  if (falla.descripcion) {
    lbl('Descripción detallada', 12, y); y += 5
    const lines = doc.splitTextToSize(falla.descripcion, W - 24)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20)
    doc.text(lines, 12, y)
    y += lines.length * 5 + 4
  }

  if (falla.imagen_url && y < 220) {
    try {
      const img = new Image(); img.crossOrigin = 'anonymous'
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = falla.imagen_url })
      const maxW = W - 24, maxH = 60
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
      const iw = img.naturalWidth * ratio, ih = img.naturalHeight * ratio
      doc.addImage(img, 'JPEG', 12, y, iw, ih)
    } catch { /* imagen no disponible */ }
  }

  doc.setFontSize(7); doc.setTextColor(160, 160, 160)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')} · Copyright © 2026 Scytel Networks`, W - 8, 285, { align: 'right' })
  doc.save(`FR_${falla.serial_falla || 'sin-serial'}_${falla.sitio || ''}.pdf`)
}

// ── Página principal ─────────────────────────────────────────────
export default function HwFallas() {
  const hwFallas    = useHwStore(s => s.hwFallas)
  const saveFalla   = useHwStore(s => s.saveFalla)
  const deleteFalla = useHwStore(s => s.deleteFalla)
  const confirm     = useConfirm()

  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const rows = useMemo(() => {
    let list = hwFallas
    if (filtro !== 'todos') list = list.filter(f => f.estado === filtro)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        (f.serial_falla  || '').toLowerCase().includes(q) ||
        (f.sitio         || '').toLowerCase().includes(q) ||
        (f.nombre_equipo || '').toLowerCase().includes(q) ||
        (f.titulo        || '').toLowerCase().includes(q)
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
          <button onClick={() => setModal('new')}
            style={{ fontSize: 11, background: '#144E4A', color: '#fff', border: 'none',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
            + Nuevo FR
          </button>
        </div>
      </div>

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
                      <button onClick={() => exportarExcelNokia(f)}
                        style={{ fontSize: 10, color: '#166534', background: 'none',
                          border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                        Excel
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
