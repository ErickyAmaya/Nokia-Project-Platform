import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useHwStore } from '../../store/useHwStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../Toast'

// ── FIFO SO assignment algorithm ──────────────────────────────────────────
function assignSOs(skytoolRows, hwCatalogo, hwEquipos, hwMovimientos) {
  const allocatedEquipos = new Set()

  // Build bulk stock pool: key = `${catalogo_id}::${proyecto}::${sub_proyecto}::${so}`
  const soStockMap = new Map()
  for (const m of hwMovimientos) {
    if (m.serial) continue
    if (m.tipo !== 'ENTRADA' && m.tipo !== 'SALIDA') continue
    const soKey = m.so || m.sales_order || ''
    const key   = `${m.catalogo_id}::${m.proyecto || ''}::${m.sub_proyecto || ''}::${soKey}`
    if (!soStockMap.has(key)) {
      soStockMap.set(key, { available: 0, oldestDate: m.created_at, so: soKey, catalogo_id: m.catalogo_id })
    }
    const entry = soStockMap.get(key)
    if (m.tipo === 'ENTRADA') {
      entry.available += (m.cantidad || 0)
      if (m.created_at < entry.oldestDate) entry.oldestDate = m.created_at
    } else {
      entry.available -= (m.cantidad || 0)
    }
  }

  return skytoolRows.map(row => {
    // Match catalog by codigo_capex (primary) then ni_name (fallback)
    const cat = hwCatalogo.find(c =>
      (row.codigo_capex && String(c.cod_material || '').trim() === String(row.codigo_capex).trim()) ||
      (row.ni_name && (c.descripcion || '').trim().toLowerCase() === row.ni_name.trim().toLowerCase())
    )
    if (!cat) return { ...row, status: 'blocked', statusMsg: 'Equipo no encontrado en catálogo' }

    const aplica_serial = cat.aplica_serial !== false

    const inList = (field, val) => {
      if (!val) return true
      if (!field) return true
      return field.split(',').map(s => s.trim()).includes(val.trim())
    }

    if (aplica_serial) {
      const candidates = hwEquipos
        .filter(e =>
          e.catalogo_id === cat.id &&
          e.estado === 'en_bodega' &&
          !allocatedEquipos.has(e.id) &&
          inList(e.proyecto,     row.proyecto) &&
          inList(e.sub_proyecto, row.sub_proyecto)
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      if (candidates.length === 0)
        return { ...row, cat, status: 'blocked', statusMsg: 'Sin stock disponible' }

      const equipo = candidates[0]
      allocatedEquipos.add(equipo.id)

      const movEntrada = hwMovimientos
        .filter(m => m.serial === equipo.serial && m.tipo === 'ENTRADA')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]

      return {
        ...row, cat, equipo,
        so: equipo.so || null,
        bodegaOrigen: equipo.ubicacion_actual || null,
        status: 'ok',
      }

    } else {
      // Bulk item — find oldest SO with available_qty >= required (no partial splits)
      const req = Number(row.cantidad) || 1

      const candidates = [...soStockMap.entries()]
        .filter(([key, v]) => {
          const [cid, proy, subp] = key.split('::')
          if (parseInt(cid) !== cat.id) return false
          if (!inList(proy || null, row.proyecto))     return false
          if (!inList(subp || null, row.sub_proyecto)) return false
          return v.available >= req
        })
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => new Date(a.oldestDate) - new Date(b.oldestDate))

      if (candidates.length === 0)
        return { ...row, cat, status: 'blocked', statusMsg: `Sin SO con stock suficiente (req: ${req})` }

      const winner = candidates[0]
      soStockMap.get(winner.key).available -= req

      const sampleEquipo = hwEquipos.find(e => e.catalogo_id === cat.id && e.estado === 'en_bodega')
      const winnerSO     = winner.so || null
      const entradaMov   = winnerSO
        ? hwMovimientos
            .filter(m => !m.serial && Number(m.catalogo_id) === cat.id && m.tipo === 'ENTRADA' &&
              (m.so === winnerSO || m.sales_order === winnerSO))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null
      const bodegaOrigen = entradaMov?.destino || sampleEquipo?.ubicacion_actual || null

      return {
        ...row, cat,
        so: winnerSO,
        bodegaOrigen,
        status: 'ok',
      }
    }
  })
}

// ── Modal ─────────────────────────────────────────────────────────────────
export default function HwSkytoolDespachoModal({ onClose }) {
  const hwCatalogo             = useHwStore(s => s.hwCatalogo)
  const hwEquipos              = useHwStore(s => s.hwEquipos)
  const hwMovimientos          = useHwStore(s => s.hwMovimientos)
  const crearDespachoPendiente = useHwStore(s => s.crearDespachoPendiente)
  const user                   = useAuthStore(s => s.user)

  const [step,      setStep]      = useState('pick')
  const [rows,      setRows]      = useState([])
  const [rawBuffer, setRawBuffer] = useState(null)
  const [fileName,  setFileName]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [progress,  setProgress]  = useState({ current: 0, total: 0, phase: '' })

  function parseFile(file) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target.result
        setRawBuffer(buffer)
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const ws = wb.Sheets['Pendientes_Conf_SO_HWS']
        if (!ws) { showToast('Hoja "Pendientes_Conf_SO_HWS" no encontrada en el archivo', 'err'); return }

        const raw      = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const dataRows = raw.slice(1)
          .map((r, i) => ({ r, rawIdx: i + 1 }))
          .filter(({ r }) => r[9] || r[8])

        const skytoolRows = dataRows.map(({ r, rawIdx }) => ({
          rawIdx,
          id:           r[0],
          siteName:     r[3] != null ? String(r[3]).trim() : '',
          smp:          r[4] != null ? String(r[4]).trim() : null,
          proyecto:     r[5] != null ? String(r[5]).trim() : '',
          sub_proyecto: r[6] != null ? String(r[6]).trim() : '',
          codigo_capex: r[8] != null ? String(r[8]).trim() : null,
          ni_name:      r[9] != null ? String(r[9]).trim() : null,
          cantidad:     Number(r[10]) || 1,
        })).filter(r => r.siteName)

        const assigned = assignSOs(skytoolRows, hwCatalogo, hwEquipos, hwMovimientos)
        setRows(assigned)
        setStep('preview')
      } catch (err) {
        showToast('Error al leer el archivo: ' + err.message, 'err')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function downloadWithSOs() {
    if (!rawBuffer || rows.length === 0) return
    const wb  = XLSX.read(rawBuffer, { type: 'array', cellDates: true })
    const ws  = wb.Sheets['Pendientes_Conf_SO_HWS']
    if (!ws) return

    const raw    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    const header = raw[0] || []

    let soColIdx = header.findIndex(h => h && String(h).toLowerCase().includes('sales_order_ss'))
    if (soColIdx === -1) soColIdx = header.length

    const soByRawIdx = {}
    rows.forEach(row => { if (row.rawIdx != null && row.so) soByRawIdx[row.rawIdx] = row.so })

    const modified = raw.map((r, idx) => {
      if (idx === 0) { const h = [...r]; h[soColIdx] = 'sales_order_ss'; return h }
      const so = soByRawIdx[idx]
      if (so != null) { const nr = [...r]; nr[soColIdx] = so; return nr }
      return r
    })

    const newWs = XLSX.utils.aoa_to_sheet(modified)
    wb.Sheets['Pendientes_Conf_SO_HWS'] = newWs
    XLSX.writeFile(wb, 'Skytool_SO_Asignadas.xlsx')
  }

  const okRows      = rows.filter(r => r.status === 'ok')
  const blockedRows = rows.filter(r => r.status === 'blocked')
  const today       = new Date().toISOString().slice(0, 10)

  async function handleConfirm() {
    if (okRows.length === 0) { showToast('No hay ítems válidos', 'err'); return }
    setSaving(true)

    // Agrupar por sitio — un despacho pendiente por sitio
    const bySite = {}
    okRows.forEach(r => {
      if (!bySite[r.siteName]) bySite[r.siteName] = []
      bySite[r.siteName].push(r)
    })
    const sites = Object.keys(bySite)

    // Número de despacho base
    const year    = new Date().getFullYear()
    const re      = new RegExp(`^HW-DS-${year}-(\\d+)$`)
    const nums    = hwMovimientos.map(m => { const x = m.so?.match(re); return x ? parseInt(x[1]) : 0 }).filter(Boolean)
    const baseDoc = `HW-DS-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0')}`

    let doneOps = 0
    setProgress({ current: 0, total: sites.length, phase: 'Preparando…' })

    try {
      for (let i = 0; i < sites.length; i++) {
        const siteName = sites[i]
        const siteRows = bySite[siteName]
        setProgress({ current: doneOps, total: sites.length, phase: `Procesando ${siteName}…` })

        const docNum = sites.length === 1
          ? baseDoc
          : `${baseDoc}-${String(i + 1).padStart(2,'0')}`

        const items = siteRows.map(r => ({
          catalogo_id:   r.cat.id,
          descripcion:   r.cat.descripcion,
          cod_material:  r.cat.cod_material || '—',
          tipo_material: r.cat.tipo_material || '—',
          aplica_serial: r.cat.aplica_serial !== false,
          serial:        r.equipo?.serial || null,
          so:            r.so || null,
          cantidad:      r.cantidad,
          bodega:        r.bodegaOrigen || 'POPAYAN',
        }))

        await crearDespachoPendiente({
          numero_doc: docNum,
          fecha:      today,
          smp_id:     siteRows.find(r => r.smp)?.smp || null,
          bodega:     siteRows[0].bodegaOrigen || 'POPAYAN',
          destino:    siteName,
          notas:      null,
          items,
          created_by: user?.nombre || user?.email || null,
        })

        doneOps++
        setProgress({ current: doneOps, total: sites.length, phase: `${siteName} procesado` })
      }

      showToast(`${okRows.length} equipo(s) en ${sites.length} sitio(s) — pendientes de despacho`)
      setStep('done')
    } catch (err) {
      showToast('Error: ' + err.message, 'err')
    } finally {
      setSaving(false)
      setProgress({ current: 0, total: 0, phase: '' })
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:800,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%',
        maxWidth: step === 'preview' ? 1020 : 480,
        maxHeight:'94vh', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 18px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'3px solid #7c3aed', borderRadius:'12px 12px 0 0', flexShrink:0 }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:15, letterSpacing:1 }}>
            DESPACHO SKYTOOL — ASIGNACIÓN AUTOMÁTICA SO (FIFO)
          </span>
          <button onClick={onClose}
            style={{ background:'none', border:'none', color:'#9ca89c', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        {/* ── STEP: pick ── */}
        {step === 'pick' && (
          <div style={{ flex:1, padding:32, display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
            <div style={{ fontSize:13, color:'#555f55', textAlign:'center', lineHeight:1.7, maxWidth:440 }}>
              {fileName
                ? <><b style={{ color:'#7c3aed' }}>📄 {fileName}</b><br/></>
                : <>Carga el archivo <b>Necesidad Sitio Skytool.xlsx</b>.<br/></>
              }
              <span style={{ fontSize:11, color:'#9ca89c' }}>
                Hoja: <b>Pendientes_Conf_SO_HWS</b> — La app asigna la SO más antigua disponible
                (FIFO) por proyecto y sub-proyecto. No se combinan SOs parciales.
              </span>
            </div>
            <label style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:10,
              border:'2px dashed #c4b5fd', borderRadius:10, padding:'28px 40px',
              cursor:'pointer', background:'#faf5ff', width:'100%', maxWidth:340,
            }}>
              <span style={{ fontSize:32 }}>📂</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#7c3aed' }}>
                {fileName ? 'Cambiar archivo' : 'Seleccionar Skytool .xlsx'}
              </span>
              <input type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                onChange={e => parseFile(e.target.files?.[0])} />
            </label>
            <button onClick={onClose}
              style={{ padding:'7px 20px', fontSize:12, fontWeight:700, borderRadius:6,
                border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>
              Cancelar
            </button>
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === 'done' && (
          <div style={{ flex:1, padding:40, display:'flex', flexDirection:'column', alignItems:'center', gap:18, textAlign:'center' }}>
            <div style={{ fontSize:48 }}>✅</div>
            <div style={{ fontSize:15, fontWeight:800, color:'#6b21a8', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:.5 }}>
              {okRows.length} EQUIPO(S) — PENDIENTES DE DESPACHO
            </div>
            {blockedRows.length > 0 && (
              <div style={{ fontSize:12, color:'#991b1b', background:'#fee2e2', borderRadius:8,
                padding:'8px 16px', fontWeight:600 }}>
                {blockedRows.length} ítem(s) quedaron pendientes por falta de stock o SO.
                Descarga el Excel para revisar y gestionar entradas faltantes.
              </div>
            )}
            <button onClick={downloadWithSOs}
              style={{ padding:'10px 24px', fontSize:13, fontWeight:700, borderRadius:8,
                border:'2px solid #7c3aed', background:'#7c3aed', color:'#fff', cursor:'pointer',
                display:'flex', alignItems:'center', gap:8 }}>
              ↓ Descargar Skytool con SO asignadas
            </button>
            <button onClick={onClose}
              style={{ padding:'8px 20px', fontSize:12, fontWeight:700, borderRadius:6,
                border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>
              Cerrar
            </button>
          </div>
        )}

        {/* ── STEP: preview ── */}
        {step === 'preview' && (<>
          {/* Stats */}
          <div style={{ padding:'12px 20px', borderBottom:'1px solid #e8f0e8', flexShrink:0 }}>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {[
                { label:'Total',      val:rows.length,        bg:'#f1f5f9', color:'#334155' },
                { label:'SO asignada', val:okRows.length,     bg:'#f3e8ff', color:'#6b21a8' },
                { label:'Bloqueados', val:blockedRows.length,  bg:'#fee2e2', color:'#991b1b' },
                { label:'Con serial', val:okRows.filter(r=>r.equipo).length, bg:'#eff6ff', color:'#1e40af' },
                { label:'Sin serial', val:okRows.filter(r=>!r.equipo).length, bg:'#fefce8', color:'#854d0e' },
              ].map(s => (
                <div key={s.label} style={{ background:s.bg, color:s.color, borderRadius:8,
                  padding:'6px 14px', textAlign:'center', minWidth:90 }}>
                  <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.val}</div>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>
            <div style={{ overflowX:'auto', border:'1px solid #e2e8f0', borderRadius:8 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr style={{ background:'#1e293b', color:'#e2e8f0' }}>
                    {['SITIO','PROYECTO','SUB_PROYECTO','CÓD. CAPEX','DESCRIPCIÓN','CANT','SO ASIGNADA','BODEGA ORIGEN','ESTADO'].map(h => (
                      <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:700,
                        fontSize:9, letterSpacing:.5, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const blocked = row.status === 'blocked'
                    const bg = blocked
                      ? (i%2===0 ? '#fff5f5' : '#fee2e2')
                      : (i%2===0 ? '#fff'    : '#f5f3ff')
                    return (
                      <tr key={i} style={{ background:bg, borderBottom:'1px solid #e2e8f0', opacity: blocked ? .85 : 1 }}>
                        <td style={{ padding:'5px 10px', fontWeight:600, color:'#1e40af' }}>{row.siteName || '—'}</td>
                        <td style={{ padding:'5px 10px', fontSize:10, color:'#6b21a8', fontWeight:600 }}>{row.proyecto || '—'}</td>
                        <td style={{ padding:'5px 10px', fontSize:10, color:'#6b21a8' }}>{row.sub_proyecto || '—'}</td>
                        <td style={{ padding:'5px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, color:'#475569' }}>
                          {row.codigo_capex || '—'}
                        </td>
                        <td style={{ padding:'5px 10px', fontWeight:600, maxWidth:180,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {row.cat?.descripcion || row.ni_name || '—'}
                        </td>
                        <td style={{ padding:'5px 10px', textAlign:'center', fontWeight:700 }}>{row.cantidad}</td>
                        <td style={{ padding:'5px 10px', fontFamily:"'Barlow Condensed',sans-serif",
                          fontWeight:700, color: blocked ? '#9ca89c' : '#6b21a8', whiteSpace:'nowrap' }}>
                          {row.so || '—'}
                        </td>
                        <td style={{ padding:'5px 10px', fontSize:10, color:'#475569' }}>{row.bodegaOrigen || '—'}</td>
                        <td style={{ padding:'5px 10px', whiteSpace:'nowrap' }}>
                          {blocked
                            ? <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10,
                                fontSize:9, fontWeight:700, background:'#fee2e2', color:'#991b1b' }}>
                                {row.statusMsg}
                              </span>
                            : <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10,
                                fontSize:9, fontWeight:700, background:'#f3e8ff', color:'#6b21a8' }}>
                                OK
                              </span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {blockedRows.length > 0 && (
              <p style={{ fontSize:11, color:'#991b1b', marginTop:10, fontWeight:600 }}>
                {blockedRows.length} fila(s) bloqueada(s) — no se incluirán al confirmar.
              </p>
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop:'1px solid #e8f0e8', padding:'12px 20px', flexShrink:0 }}>
            {saving && (
              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#555f55', fontWeight:600 }}>{progress.phase}</span>
                  <span style={{ fontSize:11, color:'#7c3aed', fontWeight:700 }}>{pct}%</span>
                </div>
                <div style={{ background:'#f3e8ff', borderRadius:20, height:8, overflow:'hidden' }}>
                  <div style={{ background:'#7c3aed', height:'100%', width:`${pct}%`,
                    transition:'width .3s ease', borderRadius:20 }} />
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'space-between', alignItems:'center' }}>
              <div>
                {!saving && (
                  <button onClick={() => { setStep('pick'); setRows([]) }}
                    style={{ padding:'7px 16px', fontSize:12, fontWeight:700, borderRadius:6,
                      border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>
                    ← Cambiar archivo
                  </button>
                )}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={downloadWithSOs} disabled={saving}
                  style={{ padding:'8px 16px', fontSize:12, fontWeight:700, borderRadius:6,
                    border:'1.5px solid #c4b5fd', background:'#faf5ff', color:'#7c3aed', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:5 }}>
                  ↓ Descargar Excel
                </button>
                <button onClick={onClose} disabled={saving}
                  style={{ padding:'8px 16px', fontSize:12, fontWeight:700, borderRadius:6,
                    border:'1.5px solid #e0e4e0', background:'#fff', color:'#555f55', cursor:'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleConfirm} disabled={saving || okRows.length === 0}
                  style={{
                    padding:'8px 20px', fontSize:12, fontWeight:700, borderRadius:6, border:'none',
                    background: okRows.length === 0 ? '#e0e4e0' : '#7c3aed',
                    color: okRows.length === 0 ? '#9ca89c' : '#fff',
                    cursor: okRows.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: saving ? .7 : 1, minWidth:200,
                  }}>
                  {saving ? 'Despachando…' : `Confirmar ${okRows.length} despacho(s) Skytool`}
                </button>
              </div>
            </div>
          </div>
        </>)}
      </div>
    </div>
  )
}
