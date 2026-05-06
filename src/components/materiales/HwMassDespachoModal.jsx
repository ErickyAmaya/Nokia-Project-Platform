import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useHwStore } from '../../store/useHwStore'
import { useMatStore } from '../../store/useMatStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { showToast } from '../Toast'

const CHUNK = 500

function nextHwDespachoDoc(movimientos) {
  const year = new Date().getFullYear()
  const prefix = 'HW-DS'
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`)
  const nums = movimientos.map(m => { const x = m.so?.match(re); return x ? parseInt(x[1]) : 0 }).filter(Boolean)
  return `${prefix}-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`
}

function Badge({ children, color = '#6b7280', bg = '#f3f4f6' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: 9, fontWeight: 700, background: bg, color,
    }}>
      {children}
    </span>
  )
}

export default function HwMassDespachoModal({ onClose }) {
  const hwCatalogo    = useHwStore(s => s.hwCatalogo)
  const hwEquipos     = useHwStore(s => s.hwEquipos)
  const hwMovimientos = useHwStore(s => s.hwMovimientos)
  const matSitios     = useMatStore(s => s.sitios)
  const saveSitio     = useMatStore(s => s.saveSitio)
  const user          = useAuthStore(s => s.user)

  const [step,     setStep]     = useState('pick')
  const [rows,     setRows]     = useState([])
  const [batchDoc, setBatchDoc] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' })

  function parseFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets['Listado']
        if (!ws) { showToast('Hoja "Listado" no encontrada en el Excel', 'err'); return }

        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const dataRows = raw.slice(1).filter(r => r[1]) // skip header, skip empty

        // ── Stock actual (BD) por catalogo_id para ítems sin serial ──
        const stockBD = {}
        hwMovimientos.forEach(m => {
          if (!m.catalogo_id) return
          if (!stockBD[m.catalogo_id]) stockBD[m.catalogo_id] = 0
          if (m.tipo === 'ENTRADA') stockBD[m.catalogo_id] += (m.cantidad || 0)
          if (m.tipo === 'SALIDA')  stockBD[m.catalogo_id] -= (m.cantidad || 0)
        })

        // Stock restante a medida que procesamos filas sin serial del Excel
        const remaining = { ...stockBD }

        const parsed = dataRows.map(r => {
          const codigoCapex  = r[6]
          const niName       = r[7]
          const siteName     = String(r[1] || '').trim()
          const bodegaOrigen = r[5] ? String(r[5]).trim() : null
          const smpId        = r[2] ? String(r[2]).trim() : null
          const cantidad     = Number(r[8]) || 1
          const soRaw        = r[10]
          const so           = soRaw != null ? String(soRaw).trim() : null
          const bulk         = r[11] ? String(r[11]).trim() : null
          const serialRaw    = r[12]
          const fechaRaw     = r[13]

          const serial = (serialRaw && String(serialRaw).trim().toUpperCase() !== 'N/A')
            ? String(serialRaw).trim()
            : null

          let fecha = null
          if (fechaRaw instanceof Date) {
            fecha = fechaRaw.toISOString().slice(0, 10)
          } else if (typeof fechaRaw === 'number') {
            // Excel serial date
            const d = XLSX.SSF.parse_date_code(fechaRaw)
            fecha = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
          } else if (fechaRaw) {
            fecha = String(fechaRaw).slice(0, 10)
          }

          // ── Validaciones ──
          let status = 'ok'
          let statusMsg = ''
          let equipo = null

          const cat = hwCatalogo.find(c => String(c.cod_material) === String(codigoCapex))

          if (!cat) {
            status = 'blocked'
            statusMsg = 'Equipo no encontrado'
          } else if (serial) {
            equipo = hwEquipos.find(e => e.serial === serial)
            if (!equipo) {
              status = 'blocked'
              statusMsg = 'Serial no registrado'
            }
          } else {
            const hasEntrada = hwMovimientos.some(m => m.catalogo_id === cat.id && m.tipo === 'ENTRADA')
            if (!hasEntrada) {
              status = 'blocked'
              statusMsg = 'Sin entrada registrada'
            } else {
              if (remaining[cat.id] == null) remaining[cat.id] = 0
              const avail = remaining[cat.id]
              if (cantidad > avail) {
                status = 'blocked'
                statusMsg = `Stock insuficiente (disp: ${Math.max(0, avail)})`
              } else {
                remaining[cat.id] -= cantidad
              }
            }
          }

          return {
            codigoCapex, niName, siteName, bodegaOrigen, smpId,
            cantidad, so, bulk, serial, fecha, cat, equipo,
            status, statusMsg,
          }
        })

        setBatchDoc(nextHwDespachoDoc(hwMovimientos))
        setRows(parsed)
        setStep('preview')
      } catch (err) {
        showToast('Error al leer el archivo: ' + err.message, 'err')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const validRows   = rows.filter(r => r.status === 'ok')
  const blockedRows = rows.filter(r => r.status === 'blocked')

  async function handleConfirm() {
    if (validRows.length === 0) { showToast('No hay ítems válidos', 'err'); return }
    setSaving(true)

    const serialRows   = validRows.filter(r => r.serial && r.equipo)
    const totalOps     = (serialRows.length > 0 ? 1 : 0) + Math.ceil(validRows.length / CHUNK)
    let   doneOps      = 0
    const tick = (phase) => { doneOps++; setProgress({ current: doneOps, total: totalOps, phase }) }

    setProgress({ current: 0, total: totalOps, phase: 'Preparando…' })

    try {
      // ── 1. Batch UPDATE hw_equipos agrupado por sitio ───────────
      if (serialRows.length > 0) {
        const bySite = {}
        serialRows.forEach(r => {
          if (!bySite[r.siteName]) bySite[r.siteName] = []
          bySite[r.siteName].push(r.equipo.id)
        })
        for (const [siteName, ids] of Object.entries(bySite)) {
          const { error } = await supabase
            .from('hw_equipos')
            .update({ estado: 'en_sitio', ubicacion_actual: siteName, updated_at: new Date().toISOString() })
            .in('id', ids)
          if (error) throw error
        }
        tick('Actualizando equipos…')
      }

      // ── 2. Batch INSERT hw_movimientos ──────────────────────────
      const today = new Date().toISOString().slice(0, 10)
      const movsPayload = validRows.map(r => ({
        equipo_id:    r.equipo?.id || null,
        serial:       r.serial || null,
        catalogo_id:  r.cat.id,
        tipo:         'SALIDA',
        tipo_fuente:  'BULK_UPLOAD',
        so:           r.so || batchDoc || null,
        sales_order:  r.so || batchDoc || null,
        smp_id:       r.smpId || null,
        bulk:         r.bulk || null,
        fecha:        r.fecha || today,
        cantidad:     r.cantidad,
        origen:       r.bodegaOrigen || null,
        origen_tipo:  'nokia',
        destino:      r.siteName,
        destino_tipo: 'sitio',
        created_by:   user?.nombre || user?.email,
      }))

      for (let i = 0; i < movsPayload.length; i += CHUNK) {
        const { error } = await supabase.from('hw_movimientos').insert(movsPayload.slice(i, i + CHUNK))
        if (error) throw new Error(`${error.message} — ${error.details || error.hint || ''}`)
        tick(`Movimientos: ${Math.min(i + CHUNK, movsPayload.length)} / ${movsPayload.length}`)
      }

      // ── 3. Auto-crear sitios nuevos ─────────────────────────────
      const sitiosCreados = new Set()
      for (const r of validRows) {
        if (!r.siteName || sitiosCreados.has(r.siteName.toLowerCase())) continue
        sitiosCreados.add(r.siteName.toLowerCase())
        const existe = matSitios.some(s => s.nombre?.toLowerCase() === r.siteName.toLowerCase())
        if (!existe) await saveSitio({ nombre: r.siteName, regional: '', activo: true }).catch(() => {})
      }

      // ── 4. Refresh store ────────────────────────────────────────
      setProgress(p => ({ ...p, phase: 'Actualizando inventario…' }))
      await useHwStore.getState().loadAll()

      showToast(`${validRows.length} despacho(s) registrado(s)`)
      onClose()
    } catch (err) {
      showToast('Error: ' + err.message, 'err')
    } finally {
      setSaving(false)
      setProgress({ current: 0, total: 0, phase: '' })
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%',
        maxWidth: step === 'preview' ? 980 : 480,
        maxHeight: '94vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,.3)',
      }}>
        {/* Header */}
        <div style={{
          background: '#0a0a0a', color: '#fff', padding: '12px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '3px solid #c0392b', borderRadius: '12px 12px 0 0',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>
            ⬇ CARGA MASIVA DESPACHO HW NOKIA
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca89c', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* ── PASO 1: Seleccionar archivo ── */}
        {step === 'pick' && (
          <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 13, color: '#555f55', textAlign: 'center', lineHeight: 1.7 }}>
              Selecciona el Excel de despacho Nokia.<br />
              <span style={{ fontSize: 11, color: '#9ca89c' }}>Se leerá la hoja <b>Listado</b>. Columna de match: <b>Codigo Capex</b> → <code>cod_material</code>.</span>
            </div>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              border: '2px dashed #cbd5e1', borderRadius: 10, padding: '28px 40px',
              cursor: 'pointer', background: '#f8fafc', width: '100%', maxWidth: 340,
            }}>
              <span style={{ fontSize: 32 }}>📂</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>Seleccionar archivo .xlsx</span>
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => parseFile(e.target.files?.[0])} />
            </label>
            <button onClick={onClose}
              style={{ padding: '7px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        )}

        {/* ── PASO 2: Preview ── */}
        {step === 'preview' && (
          <div style={{ padding: 20 }}>

            {/* Número de despacho batch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: '#555f55', fontWeight: 600 }}>Nº de despacho:</span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 16, color: '#c0392b', letterSpacing: 1 }}>{batchDoc}</span>
              <span style={{ fontSize: 10, color: '#9ca89c' }}>(se asignará a filas sin SO Nokia)</span>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { label: 'Total filas',    val: rows.length,                    bg: '#f1f5f9', color: '#334155' },
                { label: 'A despachar',    val: validRows.length,               bg: '#dcfce7', color: '#166534' },
                { label: 'Con serial',     val: validRows.filter(r=>r.serial).length,  bg: '#eff6ff', color: '#1e40af' },
                { label: 'Sin serial',     val: validRows.filter(r=>!r.serial).length, bg: '#fefce8', color: '#854d0e' },
                { label: 'Bloqueados',     val: blockedRows.length,             bg: '#fee2e2', color: '#991b1b' },
              ].map(s => (
                <div key={s.label} style={{
                  background: s.bg, color: s.color, borderRadius: 8,
                  padding: '8px 14px', textAlign: 'center', minWidth: 90,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.val}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tabla */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#e2e8f0' }}>
                    {['SERIAL','CÓD. EQUIPO','DESCRIPCIÓN','SITIO DESTINO','ORIGEN','SO','BULK','FECHA','CANT','ESTADO'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 9, letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const blocked = row.status === 'blocked'
                    const bg = blocked
                      ? (i % 2 === 0 ? '#fff5f5' : '#fee2e2')
                      : (i % 2 === 0 ? '#fff' : '#f0fdf4')
                    return (
                      <tr key={i} style={{ background: bg, borderBottom: '1px solid #e2e8f0', opacity: blocked ? .8 : 1 }}>
                        <td style={{ padding: '5px 10px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, color: blocked ? '#9ca89c' : '#144E4A' }}>
                          {row.serial || <span style={{ color: '#9ca89c', fontStyle: 'italic', fontWeight: 400 }}>No Aplica</span>}
                        </td>
                        <td style={{ padding: '5px 10px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: '#475569' }}>
                          {row.codigoCapex || '—'}
                        </td>
                        <td style={{ padding: '5px 10px', fontWeight: 600, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.cat?.descripcion || row.niName || '—'}
                        </td>
                        <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1e40af' }}>{row.siteName}</td>
                        <td style={{ padding: '5px 10px', color: '#475569' }}>{row.bodegaOrigen || '—'}</td>
                        <td style={{ padding: '5px 10px', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: row.so ? '#144E4A' : '#c0392b' }}>
                          {row.so || batchDoc || '—'}
                          {!row.so && batchDoc && <span style={{ fontSize: 8, fontWeight: 400, color: '#9ca89c', marginLeft: 3 }}>auto</span>}
                        </td>
                        <td style={{ padding: '5px 10px', color: '#475569' }}>{row.bulk || '—'}</td>
                        <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', color: '#475569' }}>{row.fecha || '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 700 }}>{row.cantidad}</td>
                        <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                          {blocked
                            ? <Badge bg="#fee2e2" color="#991b1b">{row.statusMsg}</Badge>
                            : <Badge bg="#dcfce7" color="#166534">OK</Badge>
                          }
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
                  <span style={{ fontSize: 11, color: '#c0392b', fontWeight: 700 }}>
                    {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                  </span>
                </div>
                <div style={{ background: '#fee2e2', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    background: '#c0392b', height: '100%', borderRadius: 20, transition: 'width .3s ease',
                    width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%`,
                  }} />
                </div>
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              {!saving && <button onClick={() => setStep('pick')}
                style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer' }}>
                ← Cambiar archivo
              </button>}
              <button onClick={onClose} disabled={saving}
                style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1.5px solid #e0e4e0', background: '#fff', color: '#555f55', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleConfirm} disabled={saving || validRows.length === 0}
                style={{
                  padding: '8px 20px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                  border: 'none', background: validRows.length === 0 ? '#e0e4e0' : '#c0392b',
                  color: validRows.length === 0 ? '#9ca89c' : '#fff',
                  cursor: validRows.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: saving ? .7 : 1, minWidth: 160,
                }}>
                {saving ? 'Despachando…' : `Confirmar ${validRows.length} despacho(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
