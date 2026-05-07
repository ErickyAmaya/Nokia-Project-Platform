import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { getSupabaseClient } from '../../lib/supabase'
import { showToast } from '../Toast'

const CHUNK = 200

function nextEntradaNum(movimientos) {
  const year = new Date().getFullYear()
  const re   = new RegExp(`^ENT-${year}-(\\d+)$`)
  const nums = movimientos
    .map(m => { const x = m.numero_doc?.match(re); return x ? parseInt(x[1]) : 0 })
    .filter(Boolean)
  return `ENT-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`
}

function Badge({ children, bg = '#f3f4f6', color = '#6b7280' }) {
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:9, fontWeight:700, background:bg, color }}>
      {children}
    </span>
  )
}

export default function MatMassEntradaModal({ onClose }) {
  const catalogo    = useMatStore(s => s.catalogo)
  const bodegas     = useMatStore(s => s.bodegas)
  const movimientos = useMatStore(s => s.movimientos)
  const proveedores = useMatStore(s => s.proveedores)
  const user        = useAuthStore(s => s.user)

  const [step,     setStep]     = useState('setup')
  const [bodega,   setBodega]   = useState(String(bodegas[0]?.id || ''))
  const [fecha,    setFecha]    = useState(new Date().toISOString().slice(0, 10))
  const [rows,     setRows]     = useState([])
  const [batchDoc, setBatchDoc] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' })

  const matItems = catalogo.filter(c => c.categoria !== 'PROVEEDORES' && c.activo)

  // ── Template download (ExcelJS para soporte de data validation) ──
  async function downloadTemplate() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Entradas')

    // Columnas
    ws.columns = [
      { header: 'Código',        key: 'codigo',      width: 16 },
      { header: 'Nombre',        key: 'nombre',       width: 54 },
      { header: 'Unidad',        key: 'unidad',       width: 10 },
      { header: 'Categoría',     key: 'categoria',    width: 12 },
      { header: 'Cantidad',      key: 'cantidad',     width: 12 },
      { header: 'Valor Unitario',key: 'valor',        width: 16 },
      { header: 'Proveedor',     key: 'proveedor',    width: 34 },
      { header: 'Ciudad',        key: 'ciudad',       width: 16 },
    ]

    // Estilo encabezado
    ws.getRow(1).eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } }
      cell.font   = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    ws.getRow(1).height = 20

    // Filas de datos
    matItems.forEach(c => {
      const row = ws.addRow([c.codigo, c.nombre, c.unidad || 'UND', c.categoria, '', '', '', ''])
      // Columnas informativas en gris claro (solo visual)
      ;[1, 2, 3, 4].forEach(col => {
        row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
        row.getCell(col).font = { color: { argb: 'FF888888' }, size: 10 }
      })
    })

    // Congelar fila de encabezado
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

    // Dropdown de proveedores en columna G
    if (proveedores.length > 0) {
      const provList = proveedores.map(p => p.nombre).join(',')
      const lastRow  = matItems.length + 1
      ws.dataValidations.add(`G2:G${lastRow}`, {
        type:             'list',
        allowBlank:       true,
        formulae:         [`"${provList}"`],
        showErrorMessage: true,
        errorStyle:       'error',
        errorTitle:       'Proveedor inválido',
        error:            'Selecciona un proveedor de la lista.',
      })
    }

    // Generar y descargar
    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `template_entradas_${fecha}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── File parse ─────────────────────────────────────────────────
  function parseFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets['Entradas']
        if (!ws) { showToast('Hoja "Entradas" no encontrada en el Excel', 'err'); return }

        const raw      = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const dataRows = raw.slice(1).filter(r => r[4] != null && Number(r[4]) > 0)

        if (dataRows.length === 0) {
          showToast('No se encontraron filas con cantidad > 0', 'err')
          return
        }

        const parsed = dataRows.map(r => {
          const codigo     = r[0] != null ? String(r[0]).trim() : null
          const nombre     = r[1] != null ? String(r[1]).trim() : null
          const cantidad   = Number(r[4]) || 0
          const valorUnit  = r[5] != null && r[5] !== '' ? Number(r[5]) : null
          const provNombre = r[6] != null ? String(r[6]).trim() : null
          const ciudad     = r[7] != null ? String(r[7]).trim() : null

          const cat = catalogo.find(c => c.codigo === codigo)
                   || catalogo.find(c => c.nombre?.toLowerCase() === nombre?.toLowerCase())

          const prov = provNombre
            ? proveedores.find(p => p.nombre.toLowerCase().includes(provNombre.toLowerCase()))
            : null

          let status    = 'ok'
          let statusMsg = ''
          if (!cat) {
            status    = 'blocked'
            statusMsg = 'Material no encontrado'
          } else if (cantidad <= 0) {
            status    = 'blocked'
            statusMsg = 'Cantidad inválida'
          }

          const precioFinal = valorUnit != null ? valorUnit : (cat?.costo_unitario || 0)

          return {
            codigo, nombre: cat?.nombre || nombre, cat, prov, provNombre, ciudad,
            cantidad, valorUnit, precioFinal,
            total: cantidad * precioFinal,
            bodega_id: bodega,   // default a la bodega del modal, editable por fila
            status, statusMsg,
          }
        })

        setBatchDoc(nextEntradaNum(movimientos))
        setRows(parsed)
        setStep('preview')
      } catch (err) {
        showToast('Error al leer el archivo: ' + err.message, 'err')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function setRowBodega(idx, value) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, bodega_id: value } : r))
  }

  const validRows   = rows.filter(r => r.status === 'ok')
  const blockedRows = rows.filter(r => r.status === 'blocked')
  const totalValor  = validRows.reduce((s, r) => s + r.total, 0)

  // ── Confirm ────────────────────────────────────────────────────
  async function handleConfirm() {
    if (validRows.length === 0) { showToast('No hay ítems válidos', 'err'); return }
    setSaving(true)

    const totalChunks = Math.ceil(validRows.length / CHUNK)
    setProgress({ current: 0, total: totalChunks, phase: 'Registrando entradas…' })

    try {
      const db    = getSupabaseClient()
      const today = new Date().toISOString().slice(0, 10)

      const payload = validRows.map(r => ({
        numero_doc:     batchDoc,
        fecha:          fecha || today,
        tipo:           'Entrada',
        catalogo_id:    r.cat.id,
        bodega_id:      Number(r.bodega_id),
        cantidad:       r.cantidad,
        valor_unitario: r.precioFinal,
        origen:         r.prov?.nombre || r.provNombre || null,
        created_by:     user?.nombre || user?.email,
      }))

      for (let i = 0; i < payload.length; i += CHUNK) {
        const { error } = await db.from('mat_movimientos').insert(payload.slice(i, i + CHUNK))
        if (error) throw new Error(`${error.message} — ${error.details || error.hint || ''}`)
        setProgress({ current: Math.floor(i / CHUNK) + 1, total: totalChunks, phase: `Registrando ${Math.min(i + CHUNK, payload.length)}/${payload.length}…` })
      }

      setProgress(p => ({ ...p, phase: 'Actualizando inventario…' }))
      await useMatStore.getState().loadAll()

      showToast(`${validRows.length} entrada(s) registrada(s)`)
      onClose()
    } catch (err) {
      showToast('Error: ' + err.message, 'err')
    } finally {
      setSaving(false)
      setProgress({ current: 0, total: 0, phase: '' })
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%',
        maxWidth: step === 'preview' ? 1020 : 500,
        maxHeight: '94vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,.3)',
      }}>

        {/* Header */}
        <div style={{
          background: '#0a0a0a', color: '#fff', padding: '12px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '3px solid #1a9c1a', borderRadius: '12px 12px 0 0',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>
            ↑ CARGA MASIVA — ENTRADA DE MATERIALES
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca89c', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* ── PASO 1: Setup ─────────────────────────────────────── */}
        {step === 'setup' && (
          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="fl">Bodega Destino (por defecto) *</label>
                <select className="fc" value={bodega} onChange={e => setBodega(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Fecha</label>
                <input type="date" className="fc" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
            </div>

            <div style={{ border: '1px solid #e0e4e0', borderRadius: 8, padding: 16, background: '#f8faf8' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#555f55', marginBottom: 8 }}>INSTRUCCIONES</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#555f55', lineHeight: 1.9 }}>
                <li>Descarga el template — contiene todos los materiales activos del catálogo.</li>
                <li>Completa la columna <b>Cantidad</b> para los ítems que ingresan.</li>
                <li>Opcionalmente completa <b>Valor Unitario</b>, <b>Proveedor</b> y <b>Ciudad</b> por fila.</li>
                <li>Filas con cantidad vacía o 0 se ignoran automáticamente.</li>
                <li>Sube el archivo, ajusta bodegas por ítem si es necesario, y confirma.</li>
              </ol>
            </div>

            <button onClick={downloadTemplate}
              style={{
                padding: '10px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                border: '1.5px solid #1a9c1a', background: '#f0fdf4', color: '#166534',
                cursor: 'pointer', textAlign: 'left',
              }}>
              ⬇ Descargar Template &nbsp;
              <span style={{ fontSize: 10, fontWeight: 400, color: '#9ca89c' }}>({matItems.length} ítems · hoja "Entradas")</span>
            </button>

            <div>
              <label className="fl">Cargar archivo completado</label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                border: '2px dashed #cbd5e1', borderRadius: 10, padding: '24px 40px',
                cursor: 'pointer', background: '#f8fafc',
              }}>
                <span style={{ fontSize: 28 }}>📂</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>Seleccionar archivo .xlsx</span>
                <input
                  type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => {
                    if (!bodega) { showToast('Selecciona una bodega primero', 'err'); return }
                    parseFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose}
                style={{ padding: '8px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                  border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: Preview ───────────────────────────────────── */}
        {step === 'preview' && (
          <div style={{ padding: 20 }}>

            {/* Batch info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 600 }}>DOCUMENTO </span>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 16, color: '#1a9c1a', letterSpacing: 1 }}>{batchDoc}</span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#9ca89c', fontWeight: 600 }}>FECHA </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{fecha}</span>
              </div>
              <div style={{ fontSize: 10, color: '#9ca89c' }}>
                Bodega por defecto: <b style={{ color: '#0a0a0a' }}>{bodegas.find(b => String(b.id) === String(bodega))?.nombre || '—'}</b>
                &nbsp;· Puedes cambiarla por ítem en la tabla.
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { label: 'Total filas',  val: rows.length,        bg: '#f1f5f9', color: '#334155' },
                { label: 'A registrar', val: validRows.length,   bg: '#dcfce7', color: '#166534' },
                { label: 'Bloqueados',  val: blockedRows.length, bg: '#fee2e2', color: '#991b1b' },
                { label: 'Valor total', val: matCop(totalValor), bg: '#f0fdf4', color: '#144E4A' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.val}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tabla preview */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#e2e8f0' }}>
                    {['CÓDIGO', 'MATERIAL', 'CAT', 'CANT', 'VALOR UNIT.', 'TOTAL', 'PROVEEDOR', 'CIUDAD', 'BODEGA', 'ESTADO'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 9, letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const blocked = row.status === 'blocked'
                    const bg = blocked
                      ? (i % 2 === 0 ? '#fff5f5' : '#fee2e2')
                      : (i % 2 === 0 ? '#fff'    : '#f0fdf4')
                    return (
                      <tr key={i} style={{ background: bg, borderBottom: '1px solid #e2e8f0', opacity: blocked ? .75 : 1 }}>
                        <td style={{ padding: '5px 10px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: '#475569' }}>
                          {row.cat?.codigo || row.codigo || '—'}
                        </td>
                        <td style={{ padding: '5px 10px', fontWeight: 600, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.nombre || '—'}
                        </td>
                        <td style={{ padding: '5px 10px' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                            background: row.cat?.categoria === 'CW' ? '#faf5ff' : '#f0fdf4',
                            color:      row.cat?.categoria === 'CW' ? '#5b21b6' : '#166534',
                          }}>
                            {row.cat?.categoria || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700 }}>{row.cantidad}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#144E4A', fontWeight: 600 }}>
                          {row.valorUnit != null
                            ? matCop(row.valorUnit)
                            : <span style={{ color: '#9ca89c', fontSize: 9 }}>catálogo</span>}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#144E4A' }}>
                          {matCop(row.total)}
                        </td>
                        <td style={{ padding: '5px 10px', fontSize: 10, color: '#475569', maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.prov?.nombre || row.provNombre || <span style={{ color: '#d0d5d0' }}>—</span>}
                        </td>
                        <td style={{ padding: '5px 10px', fontSize: 10, color: '#475569' }}>
                          {row.ciudad || <span style={{ color: '#d0d5d0' }}>—</span>}
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <select
                            value={row.bodega_id}
                            onChange={e => setRowBodega(i, e.target.value)}
                            disabled={blocked || saving}
                            style={{
                              fontSize: 10, padding: '3px 6px', borderRadius: 5,
                              border: '1.5px solid #e0e4e0', background: '#fff',
                              cursor: blocked ? 'default' : 'pointer',
                              minWidth: 100,
                            }}
                          >
                            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                          {blocked
                            ? <Badge bg="#fee2e2" color="#991b1b">{row.statusMsg}</Badge>
                            : <Badge bg="#dcfce7" color="#166534">OK</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {blockedRows.length > 0 && (
              <p style={{ fontSize: 11, color: '#991b1b', marginTop: 10, fontWeight: 600 }}>
                {blockedRows.length} fila(s) bloqueada(s) — no se incluirán al confirmar.
              </p>
            )}

            {/* Barra de progreso */}
            {saving && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#555f55', fontWeight: 600 }}>{progress.phase}</span>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>
                    {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                  </span>
                </div>
                <div style={{ background: '#dcfce7', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    background: '#1a9c1a', height: '100%', borderRadius: 20, transition: 'width .3s ease',
                    width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 30}%`,
                  }} />
                </div>
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              {!saving && (
                <button onClick={() => setStep('setup')}
                  style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                    border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer' }}>
                  ← Cambiar archivo
                </button>
              )}
              <button onClick={onClose} disabled={saving}
                style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                  border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleConfirm} disabled={saving || validRows.length === 0}
                style={{
                  padding: '8px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                  border: 'none', background: validRows.length === 0 ? '#e0e4e0' : '#1a9c1a',
                  color: validRows.length === 0 ? '#9ca89c' : '#fff',
                  cursor: validRows.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: saving ? .7 : 1, minWidth: 160,
                }}>
                {saving ? 'Registrando…' : `Confirmar ${validRows.length} entrada(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
