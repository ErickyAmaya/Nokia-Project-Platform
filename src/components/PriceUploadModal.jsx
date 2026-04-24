/**
 * PriceUploadModal — Modal genérico de carga masiva de precios
 *
 * Props:
 *   title        — string: título del modal
 *   items        — array de objetos planos con los datos actuales
 *   idKey        — string: campo que identifica cada fila (ej. "id", "actividad_id")
 *   displayCols  — [{ key, label }]: columnas de contexto (no editables)
 *   priceCols    — [{ key, label }]: columnas de precio (editables en la plantilla)
 *   onSave       — async fn(updates: [{idKey:val, priceKey:newVal, ...}])
 *   onClose      — fn()
 */
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { showToast } from './Toast'

function cop(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(v)
}

function autoWidth(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const widths = []
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 8
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell?.v != null) { const len = String(cell.v).length; if (len > max) max = len }
    }
    widths.push({ wch: Math.min(max + 2, 40) })
  }
  sheet['!cols'] = widths
}

export default function PriceUploadModal({ title, items, idKey, displayCols, priceCols, onSave, onClose }) {
  const [step,    setStep]    = useState(0)   // 0=inicio, 1=preview, 2=guardando
  const [changes, setChanges] = useState([])  // [{item, updates: {key: {old,new}}}]
  const [dragOver,setDragOver]= useState(false)
  const fileRef = useRef(null)

  // ── 1. Descargar plantilla ────────────────────────────────────
  function downloadTemplate() {
    const allCols = [...displayCols, ...priceCols]
    const header  = allCols.map(c => c.label)
    const rows    = items.map(item => allCols.map(c => item[c.key] ?? ''))

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    autoWidth(ws)

    // Marcar visualmente las columnas de precio (nota en la celda de encabezado)
    priceCols.forEach((c, i) => {
      const colIdx = displayCols.length + i
      const cell   = XLSX.utils.encode_cell({ r: 0, c: colIdx })
      if (ws[cell]) ws[cell].c = [{ a: 'Sistema', t: 'Edita esta columna con los nuevos precios' }]
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Precios')
    XLSX.writeFile(wb, `Plantilla_Precios_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Plantilla descargada')
  }

  // ── 2. Parsear archivo subido ─────────────────────────────────
  function parseFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        // Mapear encabezados del Excel a keys internos
        const colMap = {}
        ;[...displayCols, ...priceCols].forEach(c => { colMap[c.label] = c.key })

        // Normalizar filas: usar labels → keys
        const normalized = rows.map(row => {
          const obj = {}
          Object.entries(row).forEach(([label, val]) => {
            const key = colMap[label] || label
            obj[key] = val
          })
          return obj
        })

        // Indexar items actuales por idKey
        const current = {}
        items.forEach(it => { current[String(it[idKey])] = it })

        // Detectar cambios solo en priceCols
        const diffs = []
        normalized.forEach(row => {
          const id = String(row[idKey] ?? '')
          if (!id || !current[id]) return
          const orig    = current[id]
          const updates = {}
          priceCols.forEach(c => {
            const oldVal = Number(orig[c.key]  || 0)
            const newVal = Number(row[c.key]   || 0)
            if (Math.abs(newVal - oldVal) > 0.001) updates[c.key] = { old: oldVal, new: newVal }
          })
          if (Object.keys(updates).length > 0) diffs.push({ item: orig, updates })
        })

        if (diffs.length === 0) {
          showToast('No se detectaron cambios de precio en el archivo', 'warn')
          return
        }
        setChanges(diffs)
        setStep(1)
      } catch (err) {
        showToast('Error al leer el archivo: ' + err.message, 'err')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleFileInput(e) { parseFile(e.target.files?.[0]) }
  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    parseFile(e.dataTransfer.files?.[0])
  }

  // ── 3. Confirmar y guardar ────────────────────────────────────
  async function handleConfirm() {
    setStep(2)
    try {
      const updates = changes.map(({ item, updates }) => {
        const row = { [idKey]: item[idKey] }
        Object.entries(updates).forEach(([k, v]) => { row[k] = v.new })
        return row
      })
      await onSave(updates)
      showToast(`${changes.length} precio(s) actualizado(s)`)
      onClose()
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'err')
      setStep(1)
    }
  }

  const totalChanged = changes.reduce((a, c) => a + Object.keys(c.updates).length, 0)
  const pct = (oldV, newV) => {
    if (!oldV) return ''
    const p = ((newV - oldV) / oldV * 100).toFixed(1)
    return (p > 0 ? '+' : '') + p + '%'
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:800,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%',
        maxWidth: step === 1 ? 900 : 520, maxHeight:'92vh', overflowY:'auto',
        boxShadow:'0 24px 64px rgba(0,0,0,.25)' }}>

        {/* Header */}
        <div style={{ background:'#0a0a0a', color:'#fff', padding:'12px 18px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'3px solid #264D4A', borderRadius:'12px 12px 0 0',
          position:'sticky', top:0, zIndex:10 }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
            fontSize:15, letterSpacing:1 }}>
            ↑ {title}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'#9ca89c', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:24 }}>

          {/* ── PASO 0: Descargar + Subir ── */}
          {step === 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* Instrucciones */}
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8,
                padding:'12px 16px', fontSize:12, color:'#166534', lineHeight:1.7 }}>
                <div style={{ fontWeight:700, marginBottom:4 }}>Instrucciones</div>
                <ol style={{ margin:0, paddingLeft:18 }}>
                  <li>Descarga la plantilla con los precios actuales.</li>
                  <li>Edita los precios en las columnas de precio (resaltadas).</li>
                  <li>Guarda el archivo y súbelo aquí.</li>
                  <li>Revisa el resumen de cambios antes de confirmar.</li>
                </ol>
                <div style={{ marginTop:8, fontSize:11, color:'#166534', opacity:.8 }}>
                  ⚠ Los movimientos y despachos históricos conservan sus precios originales.
                </div>
              </div>

              {/* Paso 1 — Descargar */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#555f55', letterSpacing:.5,
                  textTransform:'uppercase', marginBottom:8 }}>Paso 1 — Descargar plantilla</div>
                <button className="btn" onClick={downloadTemplate}
                  style={{ background:'#264D4A', color:'#D6F9F2', border:'none',
                    fontWeight:700, fontSize:12 }}>
                  ↓ Descargar Plantilla Excel
                </button>
              </div>

              {/* Paso 2 — Subir */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#555f55', letterSpacing:.5,
                  textTransform:'uppercase', marginBottom:8 }}>Paso 2 — Subir archivo modificado</div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? '#264D4A' : '#c8d8c8'}`,
                    borderRadius:8, padding:'32px 20px', textAlign:'center',
                    cursor:'pointer', background: dragOver ? '#f0fdf4' : '#fafafa',
                    transition:'all .2s',
                  }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#264D4A', marginBottom:4 }}>
                    Arrastra el archivo aquí o haz clic para seleccionar
                  </div>
                  <div style={{ fontSize:11, color:'#9ca89c' }}>
                    Formato: .xlsx — misma estructura que la plantilla descargada
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                    onChange={handleFileInput} style={{ display:'none' }} />
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 1: Preview de cambios ── */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Resumen */}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8,
                  padding:'10px 16px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                    color:'#9ca89c', letterSpacing:1 }}>Filas modificadas</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                    fontSize:28, color:'#166534' }}>{changes.length}</div>
                </div>
                <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8,
                  padding:'10px 16px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                    color:'#9ca89c', letterSpacing:1 }}>Precios modificados</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                    fontSize:28, color:'#c2410c' }}>{totalChanged}</div>
                </div>
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8,
                  padding:'10px 16px', flex:1, minWidth:120 }}>
                  <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                    color:'#9ca89c', letterSpacing:1 }}>Sin cambios</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                    fontSize:28, color:'#1e40af' }}>{items.length - changes.length}</div>
                </div>
              </div>

              {/* Tabla de cambios */}
              <div style={{ overflowX:'auto', border:'1px solid #e0e4e0', borderRadius:8 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'#f0f7f0' }}>
                      {displayCols.map(c => (
                        <th key={c.key} style={{ padding:'7px 10px', textAlign:'left', fontWeight:700,
                          color:'#264D4A', fontSize:10, whiteSpace:'nowrap',
                          borderBottom:'2px solid #c8e6c8' }}>{c.label}</th>
                      ))}
                      {priceCols.map(c => (
                        <th key={c.key} style={{ padding:'7px 10px', textAlign:'right', fontWeight:700,
                          color:'#264D4A', fontSize:10, whiteSpace:'nowrap',
                          borderBottom:'2px solid #c8e6c8' }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map(({ item, updates }, idx) => (
                      <tr key={idx} style={{ borderBottom:'1px solid #e8f5e8',
                        background: idx % 2 === 0 ? '#fff' : '#fafffe' }}>
                        {displayCols.map(c => (
                          <td key={c.key} style={{ padding:'6px 10px', color:'#374437',
                            fontWeight: c.key === idKey ? 700 : 400,
                            fontFamily: c.key === idKey ? "'Barlow Condensed',sans-serif" : 'inherit' }}>
                            {item[c.key] ?? '—'}
                          </td>
                        ))}
                        {priceCols.map(c => {
                          const u = updates[c.key]
                          if (!u) return (
                            <td key={c.key} style={{ padding:'6px 10px', textAlign:'right',
                              color:'#9ca89c', fontSize:10 }}>
                              {cop(item[c.key])}
                            </td>
                          )
                          const up = u.new > u.old
                          return (
                            <td key={c.key} style={{ padding:'6px 10px', textAlign:'right',
                              background: up ? '#f0fdf4' : '#fef2f2' }}>
                              <div style={{ fontSize:10, color:'#9ca89c', textDecoration:'line-through' }}>
                                {cop(u.old)}
                              </div>
                              <div style={{ fontWeight:700, color: up ? '#166534' : '#c0392b' }}>
                                {cop(u.new)}
                              </div>
                              <div style={{ fontSize:9, color: up ? '#166534' : '#c0392b', opacity:.8 }}>
                                {pct(u.old, u.new)}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Acciones */}
              <div style={{ display:'flex', gap:8, justifyContent:'space-between',
                alignItems:'center', paddingTop:4 }}>
                <button className="btn bou" onClick={() => setStep(0)}
                  style={{ fontSize:11 }}>
                  ← Subir otro archivo
                </button>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn bou" onClick={onClose} style={{ fontSize:11 }}>
                    Cancelar
                  </button>
                  <button className="btn" onClick={handleConfirm}
                    style={{ background:'#264D4A', color:'#D6F9F2', border:'none',
                      fontWeight:700, fontSize:12 }}>
                    ✓ Confirmar {changes.length} cambio(s)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2: Guardando ── */}
          {step === 2 && (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #e0e4e0',
                borderTopColor:'#264D4A', animation:'spin .8s linear infinite', margin:'0 auto 16px' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontSize:13, color:'#264D4A', fontWeight:600 }}>
                Actualizando precios…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
