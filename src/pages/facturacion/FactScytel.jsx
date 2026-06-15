import { useMemo, useState, useEffect, useRef } from 'react'
import { EmptyState }                            from '../../components/EmptyState'
import { showToast }                             from '../../components/Toast'
import { useAppStore }                           from '../../store/useAppStore'
import { useFactStore, getSmpCat, buildInvoicesMap } from '../../store/useFactStore'
import { useScytelStore }                        from '../../store/useScytelStore'
import { useAuthStore }                          from '../../store/authStore'
import { calcSitio }                             from '../../lib/calcSitio'
import { supabase }                             from '../../lib/supabase'

// ── Constantes ────────────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const HITO_META = {
  MOS:   { label:'MOS',         color:'#0369a1', bg:'#e0f2fe' },
  INT:   { label:'Integración', color:'#7c3aed', bg:'#ede9fe' },
  FINAL: { label:'Final',       color:'#065f46', bg:'#d1fae5' },
  ADJ:   { label:'ADJ',         color:'#854d0e', bg:'#fef9c3' },
}

const CAT_META = {
  impl: { label:'IMPLEMENTACIÓN', color:'#0ea5e9' },
  adj:  { label:'ADJ',            color:'#f59e0b' },
}

const EVENTOS_ORDER = ['servicio','tss_1','tss_2','cw_1','cw_2','acuerdo']
const HITO_ORDER    = { MOS:0, INT:1, FINAL:2, ADJ:3 }

// ── Helpers ───────────────────────────────────────────────────────
function norm(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim()
}
function fmtCOP(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v)
}
function mesLabel(key) {
  if (!key||key==='sin-fecha') return 'Sin fecha'
  const [y,m] = key.split('-').map(Number)
  return `${MESES[m-1]} ${y}`
}
function pctBracket(m) { return m < 0.20 ? 8 : m < 0.30 ? 10 : 12 }

function inferHito(ppaRow, inv) {
  const cat = getSmpCat(ppaRow.smp_name).key
  if (cat === 'adj') return 'ADJ'
  const ms = (ppaRow.ms_name || '').toLowerCase()
  if (ms.includes('integ'))                               return 'INT'
  if (ms.includes('final') || ms.includes('aceptacion')) return 'FINAL'
  if (ms.includes('mos')   || ms.includes('instalacion')) return 'MOS'
  if (inv) {
    const ev = inv.evento
    if (ev === 'cw_1' || ev === 'cw_2')                  return 'INT'
    if (ev === 'tss_1'|| ev === 'tss_2'|| ev === 'acuerdo') return 'MOS'
  }
  if (cat === 'tss')  return 'MOS'
  if (cat === 'cw')   return 'INT'
  if (cat === 'impl') return 'FINAL'
  if ((ppaRow.servicio_ejecutado_pct||0)>0) return 'FINAL'
  if ((ppaRow.execute_cw_pct||0)>0)         return 'INT'
  return 'MOS'
}

// ── Modal % acordado por mes ──────────────────────────────────────
function PctMesModal({ mesKey, pctReal, pctAcordado, margenPct, onClose, onSave }) {
  const [pct,    setPct]    = useState(pctAcordado)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ pct_acordado: pct })
      showToast(`${mesLabel(mesKey)}: % SCYTEL actualizado a ${pct}%`)
      onClose()
    } catch(e) {
      showToast(e.message||'Error al guardar','err')
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center',
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:'#fff', borderRadius:14, padding:22, width:320, maxWidth:'95vw',
        boxShadow:'0 20px 60px rgba(0,0,0,.2)',
      }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, marginBottom:14 }}>
          % SCYTEL — {mesLabel(mesKey)}
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          <div style={{ flex:1, background:'#f0fdf4', borderRadius:6, padding:'5px 10px', textAlign:'center' }}>
            <div style={{ fontSize:7, color:'#6b7280', marginBottom:1 }}>Margen mes</div>
            <div style={{ fontWeight:800, color:'#166534', fontSize:12 }}>{margenPct.toFixed(1)}%</div>
          </div>
          <div style={{ flex:1, background:'#eff6ff', borderRadius:6, padding:'5px 10px', textAlign:'center' }}>
            <div style={{ fontSize:7, color:'#6b7280', marginBottom:1 }}>Bracket real</div>
            <div style={{ fontWeight:800, color:'#1e40af', fontSize:12 }}>{pctReal}%</div>
          </div>
        </div>
        <div style={{ marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'#617561' }}>% a facturar este mes</span>
            {pct !== pctReal && (
              <span style={{ fontSize:9, color:'#b45309', background:'#fffbeb', padding:'2px 7px', borderRadius:6 }}>
                Bracket {pctReal}% → facturando {pct}%
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:4, background:'#f3f4f6', borderRadius:8, padding:3 }}>
            {[8,10,12].map(p=>{
              const sel = pct === p
              const col = p===12?'#166534':p===10?'#1e40af':'#991b1b'
              const bg  = p===12?'#dcfce7':p===10?'#dbeafe':'#fee2e2'
              return (
                <button key={p} onClick={()=>setPct(p)}
                  style={{ flex:1, border:'none', borderRadius:6, padding:'5px 0', cursor:'pointer',
                    background: sel ? bg : 'transparent',
                    fontWeight:800, fontSize:13, color: sel ? col : '#9ca3af',
                    transition:'all .12s', display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                  {p}%
                  {p === pctReal && (
                    <span style={{ fontSize:6, fontWeight:700, color: sel ? col : '#d1d5db', letterSpacing:.5 }}>BRACKET</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ background:'#f3f4f6', border:'none', borderRadius:8, padding:'7px 16px', fontSize:12, cursor:'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background:'#1e40af', color:'#fff', border:'none', borderRadius:8,
              padding:'7px 16px', fontSize:12, fontWeight:700, cursor:saving?'default':'pointer', opacity:saving?.7:1 }}>
            {saving ? 'Guardando…' : 'Aplicar al mes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Facturar / Editar SCYTEL ────────────────────────────────
function FacturarScytelModal({ row, pctReal, pctAcordado, margenPct, periodoMes, isEdit, onClose, onSave, onDelete }) {
  const [numFact,    setNumFact]    = useState(row.numeroFactura || '')
  const [fechaFact,  setFechaFact]  = useState(row.fechaFactura  || '')
  const [saving,     setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const hMeta       = HITO_META[row.hito] || HITO_META.MOS
  const valorScytel = row.netValue * pctAcordado / 100

  async function handleSave() {
    if (!numFact.trim()) return showToast('Ingresa el # de factura SCYTEL','err')
    if (!fechaFact)       return showToast('Ingresa la fecha','err')
    setSaving(true)
    try {
      await onSave({
        spo_number:     row.spo_number,
        site_name:      row.site_name,
        periodo_margen: periodoMes,
        pct_real:       pctReal,
        pct_facturado:  pctAcordado,
        margen_pct:     margenPct,
        valor_scytel:   valorScytel,
        numero_factura: numFact.trim(),
        fecha_factura:  fechaFact,
      })
      showToast(`Factura ${numFact.trim()} ${isEdit ? 'actualizada' : 'registrada'}`)
      onClose()
    } catch(e) {
      showToast(e.message||'Error al guardar','err')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmDel) return setConfirmDel(true)
    setSaving(true)
    try {
      await onDelete(row.spo_number)
      showToast('Factura eliminada')
      onClose()
    } catch(e) {
      showToast(e.message||'Error al eliminar','err')
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center',
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:'#fff', borderRadius:14, padding:24, width:380, maxWidth:'95vw',
        boxShadow:'0 20px 60px rgba(0,0,0,.25)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <span style={{ background:hMeta.bg, color:hMeta.color, fontWeight:800, fontSize:9, padding:'2px 8px', borderRadius:10 }}>
            {hMeta.label}
          </span>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:17, fontWeight:700 }}>
            {isEdit ? 'Editar Factura SCYTEL' : 'Registrar Factura SCYTEL'}
          </span>
        </div>

        <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:11 }}>
          <div style={{ fontWeight:700, color:'#111' }}>{row.site_name}</div>
          <div style={{ fontFamily:'monospace', fontSize:9, color:'#9ca3af', marginTop:1 }}>
            SPO {row.spo_number} — {row.ms_name || row.smp_name}
          </div>
        </div>

        <div style={{ display:'flex', gap:4, marginBottom:14 }}>
          <div style={{ flex:1, background:'#f0fdf4', borderRadius:6, padding:'5px 10px', textAlign:'center' }}>
            <div style={{ fontSize:7, color:'#6b7280', marginBottom:1 }}>Margen mes</div>
            <div style={{ fontWeight:800, color:'#166534', fontSize:12 }}>{margenPct.toFixed(1)}%</div>
          </div>
          <div style={{ flex:1, background:'#eff6ff', borderRadius:6, padding:'5px 10px', textAlign:'center' }}>
            <div style={{ fontSize:7, color:'#6b7280', marginBottom:1 }}>% acordado</div>
            <div style={{ fontWeight:800, color:'#1e40af', fontSize:12 }}>
              {pctAcordado}%
              {pctAcordado !== pctReal && <span style={{ fontSize:8, color:'#b45309', marginLeft:3 }}>(bracket {pctReal}%)</span>}
            </div>
          </div>
          <div style={{ flex:1, background:'#faf5ff', borderRadius:6, padding:'5px 10px', textAlign:'center' }}>
            <div style={{ fontSize:7, color:'#6b7280', marginBottom:1 }}>Valor SCYTEL</div>
            <div style={{ fontWeight:800, color:'#6d28d9', fontSize:11 }}>{fmtCOP(valorScytel)}</div>
          </div>
        </div>

        <div className="fg" style={{ marginBottom:10 }}>
          <label className="fl"># Factura SCYTEL</label>
          <input className="fc" type="text" placeholder="ej: FESN 5"
            value={numFact} onChange={e=>setNumFact(e.target.value)} autoFocus />
        </div>
        <div className="fg" style={{ marginBottom:18 }}>
          <label className="fl">Fecha de Factura SCYTEL</label>
          <input className="fc" type="date" value={fechaFact} onChange={e=>setFechaFact(e.target.value)} />
        </div>

        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {isEdit && (
            <button onClick={handleDelete} disabled={saving}
              style={{ background: confirmDel ? '#991b1b' : 'none',
                border:`1px solid ${confirmDel ? '#991b1b' : '#fca5a5'}`,
                color: confirmDel ? '#fff' : '#ef4444',
                borderRadius:8, padding:'7px 12px', fontSize:11, fontWeight:700,
                cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}>
              {confirmDel ? '¿Confirmar?' : 'Eliminar'}
            </button>
          )}
          <span style={{ flex:1 }} />
          <button onClick={onClose}
            style={{ background:'#f3f4f6', border:'none', borderRadius:8, padding:'7px 16px', fontSize:12, cursor:'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving||!numFact.trim()||!fechaFact}
            style={{ background: isEdit ? '#1e40af' : '#166534', color:'#fff', border:'none', borderRadius:8,
              padding:'7px 16px', fontSize:12, fontWeight:700,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1 }}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal detalle de factura SCYTEL ──────────────────────────────
function FacturaDetalleModal({ factura, billing, spoRows, onClose }) {
  const rows = useMemo(()=>{
    const items = billing.filter(b=>b.numero_factura===factura.numero)
    return items.map(b=>{
      const spo = spoRows.find(r=>r.spo_number===b.spo_number)
      return { ...b, netValue: spo?.netValue||0, hito: spo?.hito||'—' }
    }).sort((a,b)=>(HITO_ORDER[a.hito]??9)-(HITO_ORDER[b.hito]??9))
  },[billing,factura,spoRows])

  const fechaFmt = factura.fecha
    ? new Date(factura.fecha+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})
    : '—'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:680,
        boxShadow:'0 20px 60px rgba(0,0,0,.18)', overflow:'hidden' }}
        onClick={e=>e.stopPropagation()}>

        {/* Header modal */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb',
          display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'#9ca89c', marginBottom:2 }}>
              Factura SCYTEL
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
              <span style={{ fontFamily:'monospace', fontSize:18, fontWeight:800, color:'#6d28d9' }}>
                {factura.numero}
              </span>
              <span style={{ fontSize:11, color:'#6b7280' }}>{fechaFmt}</span>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'#9ca89c', marginBottom:2 }}>Total facturado</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#374151' }}>{fmtCOP(factura.valor)}</div>
            <div style={{ fontSize:9, color:'#9ca89c' }}>{factura.spos} SPO{factura.spos!==1?'s':''}</div>
          </div>
          <button onClick={onClose}
            style={{ border:'none', background:'#f3f4f6', borderRadius:8, width:28, height:28,
              cursor:'pointer', fontSize:14, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>
        </div>

        {/* Tabla SPOs */}
        <div style={{ overflowY:'auto', maxHeight:'60vh' }}>
          <table style={{ borderCollapse:'collapse', width:'100%', fontSize:11 }}>
            <thead style={{ position:'sticky', top:0 }}>
              <tr style={{ background:'#faf5ff', borderBottom:'1px solid #e5e7eb' }}>
                {['Sitio','Hito','SPO','Valor PO','%','Valor SCYTEL'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:9,
                    fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5,
                    whiteSpace:'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>{
                const hm = HITO_META[r.hito]
                return (
                  <tr key={r.spo_number} style={{ borderTop: i>0?'1px solid #f3f4f6':'none' }}>
                    <td style={{ padding:'8px 12px', fontWeight:600, maxWidth:160,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {r.site_name}
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      {hm
                        ? <span style={{ background:hm.bg, color:hm.color, borderRadius:6,
                            fontSize:9, fontWeight:700, padding:'2px 7px' }}>{hm.label}</span>
                        : <span style={{ color:'#9ca89c' }}>—</span>}
                    </td>
                    <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:10, color:'#555' }}>
                      {r.spo_number}
                    </td>
                    <td style={{ padding:'8px 12px', color:'#374151' }}>{fmtCOP(r.netValue)}</td>
                    <td style={{ padding:'8px 12px', fontWeight:700, color:'#6d28d9', textAlign:'center' }}>
                      {r.pct_scytel}%
                    </td>
                    <td style={{ padding:'8px 12px', fontWeight:700, color:'#6d28d9' }}>
                      {fmtCOP(r.valor_scytel)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid #e5e7eb', background:'#faf5ff' }}>
                <td colSpan={3} style={{ padding:'8px 12px', fontSize:9, fontWeight:700, color:'#6b7280' }}>TOTAL</td>
                <td style={{ padding:'8px 12px', fontWeight:800, color:'#374151' }}>
                  {fmtCOP(rows.reduce((s,r)=>s+r.netValue,0))}
                </td>
                <td />
                <td style={{ padding:'8px 12px', fontWeight:800, color:'#6d28d9' }}>
                  {fmtCOP(rows.reduce((s,r)=>s+(r.valor_scytel||0),0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Generador HTML del reporte (multi-mes) ───────────────────────
async function generateReporteHTML({ selectedRows, mesPctMap }) {
  const fecha = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})

  // Embeber logo como base64 para que el HTML sea 100% self-contained
  let logoSrc = ''
  try {
    const resp = await fetch('https://tvlskyihhxfnxfgifilk.supabase.co/storage/v1/object/public/logos/SCYTEL%20solologo.png')
    const blob = await resp.blob()
    logoSrc = await new Promise(res => { const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob) })
  } catch(_) { /* logo opcional */ }
  const totalPO     = selectedRows.reduce((s,r)=>s+r.netValue,0)
  const totalSCYTEL = selectedRows.reduce((s,r)=>{
    const pct = mesPctMap[r.mes||'sin-fecha']?.pctAcordado ?? 10
    return s + r.netValue*pct/100
  },0)

  // Agrupar por mes, ordenado cronológicamente
  const byMes = new Map()
  for (const r of selectedRows) {
    const mes = r.mes||'sin-fecha'
    if (!byMes.has(mes)) byMes.set(mes,[])
    byMes.get(mes).push(r)
  }
  const meses      = [...byMes.entries()].sort(([a],[b])=>a.localeCompare(b))
  const mesesLabel = meses.map(([m])=>mesLabel(m)).join(', ')

  const mesesHTML = meses.map(([mes, rows])=>{
    const { pctAcordado=10, bracketReal=10, margenPct=0 } = mesPctMap[mes]||{}
    const mesPO     = rows.reduce((s,r)=>s+r.netValue,0)
    const mesScytel = rows.reduce((s,r)=>s+r.netValue*pctAcordado/100,0)
    const rowsHTML  = [...rows]
      .sort((a,b)=>a.site_name.localeCompare(b.site_name)||(HITO_ORDER[a.hito]??9)-(HITO_ORDER[b.hito]??9))
      .map(r=>{
        const hm  = HITO_META[r.hito]||{color:'#555',bg:'#f3f4f6',label:r.hito}
        const val = r.netValue*pctAcordado/100
        return `<tr>
          <td>${r.site_name}</td>
          <td><span style="background:${hm.bg};color:${hm.color};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${hm.label}</span></td>
          <td style="font-family:monospace">${r.spo_number}</td>
          <td style="text-align:right">${fmtCOP(r.netValue)}</td>
          <td style="text-align:center">${bracketReal}%</td>
          <td style="text-align:center;font-weight:700;color:${pctAcordado!==bracketReal?'#b45309':'#374151'}">${pctAcordado}%</td>
          <td style="text-align:right;font-weight:600;color:#1a5fa8">${fmtCOP(val)}</td>
        </tr>`
      }).join('\n')
    return `<div class="mes-section">
      <div class="mes-hdr">
        <span class="mes-lbl">${mesLabel(mes)}</span>
        <span class="mes-info">Margen: ${(+margenPct).toFixed(1)}% &nbsp;·&nbsp; Bracket: ${bracketReal}%${pctAcordado!==bracketReal?` &nbsp;·&nbsp; <span style="color:#b45309">Facturando: ${pctAcordado}%</span>`:''}</span>
        <span class="mes-tot">${rows.length} SPO${rows.length!==1?'s':''} &nbsp;·&nbsp; SCYTEL: ${fmtCOP(mesScytel)}</span>
      </div>
      <table>
        <thead><tr>
          <th>Sitio</th><th>Hito</th><th>SPO</th>
          <th style="text-align:right">Valor PO</th>
          <th style="text-align:center">Bracket</th>
          <th style="text-align:center">% Fact.</th>
          <th style="text-align:right">Valor SCYTEL</th>
        </tr></thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot><tr>
          <td colspan="3" style="color:#6b7280;font-size:10px">Subtotal ${mesLabel(mes)}</td>
          <td style="text-align:right;color:#374151">${fmtCOP(mesPO)}</td>
          <td colspan="2"></td>
          <td style="text-align:right;color:#1a5fa8">${fmtCOP(mesScytel)}</td>
        </tr></tfoot>
      </table>
    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte Facturación SCYTEL</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f6f9;color:#1a202c;padding:32px}
  .wrap{max-width:920px;margin:0 auto;background:#fff;border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,.12);overflow:hidden}
  .hdr{background:linear-gradient(105deg,#0d1f3c 0%,#1a5fa8 100%);color:#fff;padding:28px 36px;display:flex;align-items:center;gap:18px}
  .hdr img{width:46px;height:46px;object-fit:contain;filter:brightness(0) invert(1)}
  .hdr h1{font-size:22px;font-weight:700;letter-spacing:.5px}
  .hdr .sub{font-size:11px;opacity:.7;margin-top:3px;font-weight:400;letter-spacing:.3px}
  .stripe{height:4px;background:linear-gradient(90deg,#4fa3e8,#1a5fa8,#0d3d6e)}
  .cards{display:flex;gap:0;background:#eef4fb;border-bottom:1px solid #c8d4e2}
  .card{flex:1;padding:14px 20px;border-right:1px solid #c8d4e2}
  .card:last-child{border-right:none}
  .card .lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#718096;margin-bottom:4px}
  .card .val{font-size:17px;font-weight:700}
  .card .sub{font-size:10px;color:#a0aec0;margin-top:2px}
  .body{padding:0 36px 36px}
  .mes-section{margin-top:28px}
  .mes-hdr{display:flex;align-items:baseline;gap:12px;padding:10px 0 8px;border-bottom:2px solid #1a5fa8;flex-wrap:wrap}
  .mes-lbl{font-size:15px;font-weight:700;color:#0d3d6e;letter-spacing:.3px}
  .mes-info{font-size:11px;color:#718096;flex:1}
  .mes-tot{font-size:11px;font-weight:600;color:#1a5fa8}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{padding:8px 12px;text-align:left;font-size:9px;font-weight:600;color:#1a5fa8;text-transform:uppercase;letter-spacing:1px;background:#eef4fb;border-bottom:1px solid #c8d4e2;white-space:nowrap}
  td{padding:7px 12px;border-bottom:1px solid #edf2f7;vertical-align:middle}
  td:first-child{font-weight:500}
  tbody tr:hover{background:#f7fafd}
  tfoot tr{background:#eef4fb;border-top:2px solid #c8d4e2}
  tfoot td{font-weight:600;padding:9px 12px}
  .grand{margin-top:24px;padding:16px 24px;background:linear-gradient(105deg,#0d1f3c,#1a5fa8);border-radius:4px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;color:#fff}
  .grand .lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.6);margin-bottom:3px}
  .foot{padding:14px 36px;background:#f4f6f9;border-top:1px solid #c8d4e2;font-size:10px;color:#a0aec0;display:flex;justify-content:space-between;align-items:center}
  .foot-line{width:30px;height:2px;background:#1a5fa8}
  @media(max-width:640px){body{padding:8px}.hdr{padding:20px 16px}.body{padding:0 16px 24px}.cards{flex-wrap:wrap}.card{min-width:50%}.foot{padding:10px 16px;flex-direction:column;gap:6px}}
  @media print{body{background:#fff;padding:0}.wrap{box-shadow:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    ${logoSrc ? `<img src="${logoSrc}" alt="SCYTEL" style="width:46px;height:46px;object-fit:contain;filter:brightness(0) invert(1)">` : ''}
    <div>
      <h1>Reporte de Facturación</h1>
      <div class="sub">Generado el ${fecha} &nbsp;·&nbsp; ${selectedRows.length} SPO${selectedRows.length!==1?'s':''} &nbsp;·&nbsp; ${meses.length} mes${meses.length!==1?'es':''}</div>
    </div>
  </div>
  <div class="stripe"></div>
  <div class="cards">
    <div class="card"><div class="lbl">Período</div><div class="val" style="color:#0d3d6e;font-size:13px;line-height:1.4">${mesesLabel}</div></div>
    <div class="card"><div class="lbl">Total POs</div><div class="val" style="color:#0d3d6e">${fmtCOP(totalPO)}</div><div class="sub">${selectedRows.length} SPOs</div></div>
    <div class="card"><div class="lbl">Total SCYTEL</div><div class="val" style="color:#1a5fa8">${fmtCOP(totalSCYTEL)}</div></div>
  </div>
  <div class="body">
    ${mesesHTML}
    ${meses.length > 1 ? `<div class="grand">
      <div><div class="lbl">Total general</div><div style="font-size:12px;color:rgba(255,255,255,.6);font-weight:300">${selectedRows.length} SPOs &nbsp;·&nbsp; ${meses.length} meses</div></div>
      <div><div class="lbl">Total POs</div><div style="font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700">${fmtCOP(totalPO)}</div></div>
      <div><div class="lbl">Total SCYTEL</div><div style="font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700;color:#4fa3e8">${fmtCOP(totalSCYTEL)}</div></div>
    </div>` : ''}
  </div>
  <div class="foot">
    <div class="foot-line"></div>
    <span>Nokia Project Platform · SCYTEL Networks</span>
    <span>Documento preliminar — sujeto a aprobación</span>
  </div>
</div>
</body>
</html>`
}

async function generateDiferencialHTML({ difRows }) {
  const fecha = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})
  let logoSrc = ''
  try {
    const resp = await fetch('https://tvlskyihhxfnxfgifilk.supabase.co/storage/v1/object/public/logos/SCYTEL%20solologo.png')
    const blob = await resp.blob()
    logoSrc = await new Promise(res => { const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob) })
  } catch(_) {}

  const byMes = new Map()
  for (const r of difRows) {
    const m = r.mes||'sin-fecha'
    if (!byMes.has(m)) byMes.set(m,[])
    byMes.get(m).push(r)
  }
  const totalDelta = difRows.reduce((s,r)=>s+r.delta,0)

  const rowsHTML = [...byMes.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([mes,rows])=>`
    <tr style="background:#f0f4fa">
      <td colspan="6" style="padding:8px 12px;font-weight:700;color:#0d3d6e;font-size:12px">${mesLabel(mes)}</td>
    </tr>
    ${rows.map(r=>{
      const pos = r.delta >= 0
      return `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:6px 12px;font-size:11px;color:#374151">${r.site_name||'—'}</td>
        <td style="padding:6px 12px;font-family:monospace;font-size:10px;color:#6b7280">${r.spo_number}</td>
        <td style="padding:6px 12px;font-size:11px;text-align:right">${fmtCOP(r.netValue)}</td>
        <td style="padding:6px 12px;font-size:11px;text-align:center;color:#b45309;font-weight:700">${r.pctUsado}%</td>
        <td style="padding:6px 12px;font-size:11px;text-align:center;color:#1a5fa8;font-weight:700">${r.bracketReal}%</td>
        <td style="padding:6px 12px;font-size:12px;text-align:right;font-weight:700;color:${pos?'#166534':'#991b1b'}">${pos?'+':''}${fmtCOP(r.delta)}</td>
      </tr>`
    }).join('')}
  `).join('')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diferencial % SCYTEL — ${fecha}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f9;color:#1a2332}
  .wrap{max-width:860px;margin:0 auto;padding:24px}
  .header{background:linear-gradient(105deg,#0d1f3c,#1a5fa8);border-radius:12px;padding:24px 28px;display:flex;align-items:center;gap:20px;margin-bottom:24px}
  .header-text h1{color:#fff;font-size:20px;font-weight:800;margin-bottom:4px}
  .header-text p{color:#a8c4e8;font-size:11px}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)}
  thead tr{background:linear-gradient(105deg,#0d1f3c,#1a5fa8)}
  thead th{padding:10px 12px;font-size:10px;font-weight:700;color:#fff;text-align:left;text-transform:uppercase;letter-spacing:.5px}
  thead th:nth-child(n+3){text-align:right}
  thead th:nth-child(4),thead th:nth-child(5){text-align:center}
  tfoot td{padding:10px 12px;font-weight:800;font-size:13px;border-top:2px solid #c8d4e2;background:#eef4fb}
  .footer{margin-top:20px;text-align:center;font-size:9px;color:#9ca3af}
</style></head><body>
<div class="wrap">
  <div class="header">
    ${logoSrc?`<img src="${logoSrc}" style="height:48px;width:auto;filter:brightness(0)invert(1)" alt="SCYTEL">`:''}
    <div class="header-text">
      <h1>Diferencial de Porcentaje SCYTEL</h1>
      <p>SPOs facturados con % diferente al bracket real del mes · Generado ${fecha}</p>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Sitio</th><th>SPO</th><th style="text-align:right">Valor PO</th>
      <th style="text-align:center">% Facturado</th><th style="text-align:center">% Bracket Real</th>
      <th style="text-align:right">Diferencia SCYTEL</th>
    </tr></thead>
    <tbody>${rowsHTML}</tbody>
    <tfoot><tr>
      <td colspan="5">Total diferencial (${difRows.length} SPOs)</td>
      <td style="text-align:right;color:${totalDelta>=0?'#166534':'#991b1b'}">${totalDelta>=0?'+':''}${fmtCOP(totalDelta)}</td>
    </tr></tfoot>
  </table>
  <div class="footer"><span>Nokia Project Platform · SCYTEL Networks</span></div>
</div>
</body></html>`
}

// ── Modal Generar Reporte (multi-mes, selección acumulada) ────────
function ReporteModal({ pendingRows, billedRows, billedMonths, lockedMargenMap, liveMargenMes, onClose }) {
  const meses = useMemo(()=>{
    const map = new Map()
    for (const r of pendingRows) {
      const mes = r.mes||'sin-fecha'
      if (!map.has(mes)) map.set(mes,[])
      map.get(mes).push(r)
    }
    return [...map.entries()].sort(([a],[b])=>a.localeCompare(b))
  },[pendingRows])

  // selected es global — acumula a través de tabs
  const [selected,        setSelected]        = useState(()=>new Set(pendingRows.map(r=>r.spo_number)))
  const [selectedMes,     setSelectedMes]     = useState(()=>meses[0]?.[0]||null)
  const [pctOverrides,    setPctOverrides]    = useState({})
  const [uploading,    setUploading]    = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [previewHtml,  setPreviewHtml]  = useState(null)
  const [mailHref,     setMailHref]     = useState(null)
  const [tab,          setTab]          = useState('fact')

  const difRows = useMemo(()=>
    billedRows.map(r=>{
      const br  = pctBracket(liveMargenMes[r.mes||'sin-fecha']??0)
      const pct = r.pctFacturado ?? br
      return { ...r, pctUsado: pct, bracketReal: br, delta: r.netValue*(br-pct)/100 }
    }).filter(r=>r.pctUsado !== r.bracketReal)
  ,[billedRows, liveMargenMes])

  // Calcula pct info para un mes
  function getMesPctInfo(mes) {
    const locked   = lockedMargenMap[mes]
    const m        = liveMargenMes[mes]??0
    const br       = pctBracket(m)
    const margen   = locked ? locked.margen_pct : +(m*100).toFixed(1)
    const isLocked = billedMonths.has(mes)
    const pct      = isLocked
      ? (locked?.pct_scytel ?? br)
      : (pctOverrides[mes] ?? locked?.pct_scytel ?? br)
    return { pct, bracketReal: br, margenPct: margen, isLocked }
  }

  // mesPctMap para el generador HTML
  const mesPctMap = useMemo(()=>{
    const map = {}
    for (const [mes] of meses) {
      const { pct, bracketReal, margenPct } = getMesPctInfo(mes)
      map[mes] = { pctAcordado: pct, bracketReal, margenPct }
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[meses, lockedMargenMap, liveMargenMes, billedMonths, pctOverrides])

  const mesRows = useMemo(()=>meses.find(([m])=>m===selectedMes)?.[1]||[]
  ,[meses,selectedMes])

  const selectedRows = useMemo(()=>pendingRows.filter(r=>selected.has(r.spo_number)),[pendingRows,selected])

  const totalSCYTEL = useMemo(()=>
    selectedRows.reduce((s,r)=>{
      const pct = mesPctMap[r.mes||'sin-fecha']?.pctAcordado ?? 10
      return s + r.netValue*pct/100
    },0)
  ,[selectedRows,mesPctMap])

  function toggleGlobalAll() {
    if (selected.size===pendingRows.length) setSelected(new Set())
    else setSelected(new Set(pendingRows.map(r=>r.spo_number)))
  }
  function toggleMesAll() {
    const allMes     = mesRows.map(r=>r.spo_number)
    const allSel     = mesRows.every(r=>selected.has(r.spo_number))
    setSelected(s=>{ const n=new Set(s); allSel?allMes.forEach(id=>n.delete(id)):allMes.forEach(id=>n.add(id)); return n })
  }
  function toggleRow(spo) {
    setSelected(s=>{ const n=new Set(s); n.has(spo)?n.delete(spo):n.add(spo); return n })
  }

  async function handlePreview() {
    const win = window.open('about:blank', '_blank')
    if (!win) return
    win.document.write('<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:13px;color:#9ca3af;background:#f4f6f9">Generando reporte…</body></html>')
    setGenerating(true)
    const html = await generateReporteHTML({ selectedRows, mesPctMap })
    setPreviewHtml(html)
    setGenerating(false)
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  async function handleEnviar() {
    if (!previewHtml || uploading) return
    setUploading(true)
    setMailHref(null)

    const mesesStr = [...new Set(selectedRows.map(r=>mesLabel(r.mes||'sin-fecha')))].join(', ')
    const { data, error } = await supabase
      .from('scytel_reports')
      .insert({ html_content: previewHtml, meses: mesesStr })
      .select('id')
      .single()

    setUploading(false)
    if (error) { showToast(error.message||'Error al guardar','err'); return }

    const url    = `${window.location.origin}/r/${data.id}`
    const byMes  = new Map()
    for (const r of selectedRows) {
      const mes = r.mes||'sin-fecha'
      if (!byMes.has(mes)) byMes.set(mes,[])
      byMes.get(mes).push(r)
    }
    const resumen = [...byMes.entries()]
      .sort(([a],[b])=>a.localeCompare(b))
      .map(([mes,rows])=>{
        const pct = mesPctMap[mes]?.pctAcordado ?? 10
        const sub = rows.reduce((s,r)=>s+r.netValue*pct/100,0)
        return `  • ${mesLabel(mes)}: ${rows.length} SPO${rows.length!==1?'s':''} — SCYTEL: ${fmtCOP(sub)}`
      }).join('\n')
    const totalAcumulado = pendingRows.reduce((s,r)=>{
      const pct = mesPctMap[r.mes||'sin-fecha']?.bracketReal ?? 10
      return s + r.netValue * pct / 100
    }, 0)
    const subject = encodeURIComponent(`Reporte Facturación SCYTEL — ${mesesStr}`)
    const body    = encodeURIComponent(
`Estimados,

Comparto el reporte de facturación SCYTEL para revisión:

${url}

Total acumulado facturable SCYTEL: ${fmtCOP(totalAcumulado)}
Facturación de este período:       ${fmtCOP(totalSCYTEL)}

Resumen del período:
${resumen}

SPOs incluidos: ${selectedRows.length}

Nokia Project Platform · SCYTEL Networks`
    )
    setMailHref(`mailto:?subject=${subject}&body=${body}`)
  }

  async function handlePreviewDiff() {
    const win = window.open('about:blank', '_blank')
    if (!win) return
    win.document.write('<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;font-size:13px;color:#9ca3af;background:#f4f6f9">Generando reporte…</body></html>')
    setGenerating(true)
    const html = await generateDiferencialHTML({ difRows })
    setPreviewHtml(html)
    setGenerating(false)
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  async function handleEnviarDiff() {
    if (!previewHtml || uploading) return
    setUploading(true)
    setMailHref(null)
    const { data, error } = await supabase
      .from('scytel_reports')
      .insert({ html_content: previewHtml, meses: 'diferencial' })
      .select('id').single()
    setUploading(false)
    if (error) { showToast(error.message||'Error al guardar','err'); return }
    const url         = `${window.location.origin}/r/${data.id}`
    const totalDelta  = difRows.reduce((s,r)=>s+r.delta,0)
    const subject     = encodeURIComponent('Diferencial % Facturación SCYTEL')
    const body        = encodeURIComponent(
`Estimados,

Adjunto el detalle de SPOs facturados con un porcentaje distinto al bracket real del mes:

${url}

SPOs con diferencial: ${difRows.length}
Diferencia total SCYTEL: ${totalDelta>=0?'+':''}${fmtCOP(totalDelta)}

Nokia Project Platform · SCYTEL Networks`
    )
    setMailHref(`mailto:?subject=${subject}&body=${body}`)
  }

  const bySite = useMemo(()=>{
    const map = new Map()
    for (const r of mesRows) {
      if (!map.has(r.site_name)) map.set(r.site_name,[])
      map.get(r.site_name).push(r)
    }
    return [...map.entries()].sort(([a],[b])=>a.localeCompare(b))
  },[mesRows])

  const { pct:mesPct, bracketReal:mesBracket, margenPct:mesMargen, isLocked:mesIsLocked } =
    getMesPctInfo(selectedMes||'')
  const mesAllSel = mesRows.length > 0 && mesRows.every(r=>selected.has(r.spo_number))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:680,
        maxHeight:'90vh', display:'flex', flexDirection:'column',
        boxShadow:'0 20px 60px rgba(0,0,0,.2)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb',
          display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'#9ca89c' }}>
              Facturación SCYTEL
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
              {[['fact','Facturación'],['diff','Diferencial %']].map(([key,label])=>(
                <button key={key} onClick={()=>{ setTab(key); setPreviewHtml(null); setMailHref(null) }}
                  style={{ fontSize:12, fontWeight:700, padding:'3px 12px', borderRadius:20,
                    border: tab===key ? '2px solid #1a5fa8' : '2px solid #e5e7eb',
                    background: tab===key ? '#dbeafe' : '#f9fafb',
                    color: tab===key ? '#1a5fa8' : '#6b7280', cursor:'pointer' }}>
                  {label}
                  {key==='diff' && difRows.length>0 && (
                    <span style={{ marginLeft:5, background:'#b45309', color:'#fff',
                      borderRadius:10, fontSize:9, padding:'1px 5px' }}>{difRows.length}</span>
                  )}
                </button>
              ))}
              {tab==='fact' && (
                <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer',
                  fontSize:10, fontWeight:600, color:'#6b7280', marginLeft:6 }}>
                  <input type="checkbox"
                    checked={selected.size===pendingRows.length && pendingRows.length>0}
                    onChange={toggleGlobalAll} />
                  Todos los meses
                </label>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ border:'none', background:'#f3f4f6', borderRadius:8, width:28, height:28,
              cursor:'pointer', fontSize:14, color:'#6b7280',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>
        </div>

        {tab === 'fact' && <>
        {/* Tabs de meses */}
        <div style={{ padding:'8px 20px', background:'#eef4fb', borderBottom:'1px solid #c8d4e2',
          display:'flex', gap:6, flexWrap:'wrap' }}>
          {meses.map(([mes, rows])=>{
            const selCount = rows.filter(r=>selected.has(r.spo_number)).length
            return (
              <button key={mes} onClick={()=>setSelectedMes(mes)}
                style={{ border: selectedMes===mes?'2px solid #1a5fa8':'1px solid #c8d4e2',
                  borderRadius:8, padding:'4px 10px', fontSize:10, fontWeight:700,
                  background: selectedMes===mes?'#deeaf6':'#fff',
                  color: selectedMes===mes?'#0d3d6e':'#9ca3af',
                  cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                {mesLabel(mes)}
                <span style={{ background: selCount>0?(selectedMes===mes?'#1a5fa8':'#4fa3e8'):'#e5e7eb',
                  color: selCount>0?'#fff':'#6b7280',
                  borderRadius:8, padding:'0 5px', fontSize:9 }}>
                  {selCount}/{rows.length}
                </span>
                {billedMonths.has(mes) && <span style={{ fontSize:9 }}>🔒</span>}
              </button>
            )
          })}
        </div>

        {/* Barra bracket del mes visible */}
        <div style={{ padding:'6px 20px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb',
          display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, color:'#6b7280' }}>
            Margen: <strong style={{ color:'#166534' }}>{(+mesMargen).toFixed(1)}%</strong>
          </span>
          <span style={{ fontSize:10, color:'#6b7280' }}>
            Bracket: <strong style={{ color:'#1a5fa8' }}>{mesBracket}%</strong>
          </span>
          {mesIsLocked ? (
            <span style={{ fontSize:10, fontWeight:700, color:'#1a5fa8',
              background:'#deeaf6', padding:'2px 8px', borderRadius:6 }}>
              🔒 Facturando {mesPct}%
            </span>
          ) : (
            <div style={{ display:'flex', gap:3, background:'#f3f4f6', borderRadius:8, padding:2 }}>
              {[8,10,12].map(p=>{
                const sel = mesPct===p
                const col = p===12?'#166534':p===10?'#1a5fa8':'#991b1b'
                const bg  = p===12?'#dcfce7':p===10?'#deeaf6':'#fee2e2'
                return (
                  <button key={p}
                    onClick={()=>setPctOverrides(v=>({...v,[selectedMes]:p}))}
                    style={{ border:'none', borderRadius:6, padding:'3px 10px', cursor:'pointer',
                      background: sel?bg:'transparent',
                      fontWeight:800, fontSize:11, color: sel?col:'#9ca3af',
                      display:'flex', alignItems:'center', gap:2 }}>
                    {p}%
                    {p===mesBracket && <span style={{ fontSize:7, opacity:.7 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          )}
          <span style={{ flex:1 }} />
          <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer',
            fontSize:11, fontWeight:600, color:'#374151' }}>
            <input type="checkbox" checked={mesAllSel} onChange={toggleMesAll} />
            Todos este mes ({mesRows.length})
          </label>
        </div>

        {/* Lista SPOs del mes visible */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {bySite.map(([siteName, rows])=>{
            const siteSelected = rows.filter(r=>selected.has(r.spo_number)).length
            return (
              <div key={siteName} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <div style={{ padding:'7px 20px', background:'#f8faf8',
                  display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#374151', flex:1 }}>{siteName}</span>
                  <span style={{ fontSize:10, color:'#9ca3af' }}>{siteSelected}/{rows.length}</span>
                </div>
                {rows.map(r=>{
                  const hm  = HITO_META[r.hito]||HITO_META.MOS
                  const val = r.netValue*mesPct/100
                  return (
                    <label key={r.spo_number}
                      style={{ display:'flex', alignItems:'center', gap:10,
                        padding:'6px 20px 6px 28px', cursor:'pointer',
                        background: selected.has(r.spo_number)?'#eef4fb':'#fff',
                        borderTop:'1px solid #fafafa', transition:'background .1s' }}>
                      <input type="checkbox"
                        checked={selected.has(r.spo_number)}
                        onChange={()=>toggleRow(r.spo_number)} />
                      <span style={{ background:hm.bg, color:hm.color, fontSize:9, fontWeight:700,
                        padding:'1px 7px', borderRadius:8, whiteSpace:'nowrap' }}>
                        {hm.label}
                      </span>
                      <span style={{ fontFamily:'monospace', fontSize:10, color:'#6b7280', flex:1 }}>
                        {r.spo_number}
                      </span>
                      <span style={{ fontSize:11, color:'#374151', textAlign:'right', minWidth:90 }}>
                        {fmtCOP(r.netValue)}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#1a5fa8', textAlign:'right', minWidth:90 }}>
                        {fmtCOP(val)}
                      </span>
                    </label>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer resumen global + acciones */}
        <div style={{ position:'relative', padding:'10px 20px', borderTop:'2px solid #c8d4e2',
          background:'#eef4fb', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:9, color:'#9ca89c', fontWeight:700 }}>Total seleccionados</div>
            <div style={{ fontSize:14, fontWeight:800, color:'#374151' }}>
              {selectedRows.length} SPO{selectedRows.length!==1?'s':''}
            </div>
          </div>

          <div>
            <div style={{ fontSize:9, color:'#9ca89c', fontWeight:700 }}>Total SCYTEL</div>
            <div style={{ fontSize:14, fontWeight:800, color:'#1a5fa8' }}>{fmtCOP(totalSCYTEL)}</div>
          </div>
          <span style={{ flex:1 }} />
          <button onClick={onClose}
            style={{ background:'#f3f4f6', border:'none', borderRadius:8,
              padding:'7px 14px', fontSize:11, cursor:'pointer', color:'#6b7280' }}>
            Cancelar
          </button>
          <button onClick={handlePreview} disabled={!selectedRows.length || generating}
            style={{ background: selectedRows.length&&!generating?'#0d3d6e':'#f3f4f6',
              color: selectedRows.length&&!generating?'#fff':'#d1d5db',
              border:'none', borderRadius:8, padding:'7px 14px', fontSize:11,
              fontWeight:700, cursor: selectedRows.length&&!generating?'pointer':'default' }}>
            {generating ? 'Generando…' : 'Ver reporte ↗'}
          </button>
          {mailHref ? (
            <a href={mailHref} onClick={()=>{ setMailHref(null); setPreviewHtml(null) }}
              style={{ background:'#166534', color:'#fff', borderRadius:8,
                padding:'7px 14px', fontSize:11, fontWeight:700,
                textDecoration:'none', whiteSpace:'nowrap' }}>
              Enviar Reporte ✉
            </a>
          ) : previewHtml ? (
            <button onClick={handleEnviar} disabled={uploading}
              style={{ background: uploading?'#6b7280':'#1a5fa8', color:'#fff',
                border:'none', borderRadius:8, padding:'7px 14px', fontSize:11,
                fontWeight:700, cursor: uploading?'default':'pointer', whiteSpace:'nowrap' }}>
              {uploading ? 'Guardando…' : 'Aprobar Reporte ✉'}
            </button>
          ) : null}
        </div>
        </>}

        {tab === 'diff' && <>
        {/* Contenido tab Diferencial % */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
          {difRows.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af', fontSize:13 }}>
              No hay SPOs con diferencial de porcentaje
            </div>
          ) : (() => {
            const byMes = new Map()
            for (const r of difRows) {
              const m = r.mes||'sin-fecha'
              if (!byMes.has(m)) byMes.set(m,[])
              byMes.get(m).push(r)
            }
            return [...byMes.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([mes,rows])=>(
              <div key={mes} style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#0d3d6e',
                  background:'#eef4fb', padding:'5px 10px', borderRadius:6, marginBottom:4 }}>
                  {mesLabel(mes)}
                </div>
                {rows.map(r=>{
                  const pos = r.delta >= 0
                  return (
                    <div key={r.spo_number} style={{ display:'flex', alignItems:'center',
                      gap:8, padding:'5px 8px', borderBottom:'1px solid #f3f4f6',
                      background:'#fff', flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, color:'#374151', flex:1, minWidth:100 }}>{r.site_name||'—'}</span>
                      <span style={{ fontFamily:'monospace', fontSize:10, color:'#6b7280', minWidth:110 }}>{r.spo_number}</span>
                      <span style={{ fontSize:10, color:'#374151', minWidth:80, textAlign:'right' }}>{fmtCOP(r.netValue)}</span>
                      <span style={{ fontSize:10, fontWeight:700, color:'#b45309', minWidth:40, textAlign:'center' }}>{r.pctUsado}%</span>
                      <span style={{ fontSize:9, color:'#9ca3af' }}>→</span>
                      <span style={{ fontSize:10, fontWeight:700, color:'#1a5fa8', minWidth:40, textAlign:'center' }}>{r.bracketReal}%</span>
                      <span style={{ fontSize:11, fontWeight:800, color: pos?'#166534':'#991b1b',
                        minWidth:80, textAlign:'right' }}>
                        {pos?'+':''}{fmtCOP(r.delta)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
        {/* Footer diferencial */}
        <div style={{ padding:'10px 20px', borderTop:'2px solid #c8d4e2',
          background:'#eef4fb', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          {(() => {
            const totalDelta = difRows.reduce((s,r)=>s+r.delta,0)
            return (
              <div>
                <div style={{ fontSize:9, color:'#9ca89c', fontWeight:700 }}>Diferencia total</div>
                <div style={{ fontSize:14, fontWeight:800, color: totalDelta>=0?'#166534':'#991b1b' }}>
                  {totalDelta>=0?'+':''}{fmtCOP(totalDelta)}
                </div>
              </div>
            )
          })()}
          <span style={{ flex:1 }} />
          <button onClick={onClose}
            style={{ background:'#f3f4f6', border:'none', borderRadius:8,
              padding:'7px 14px', fontSize:11, cursor:'pointer', color:'#6b7280' }}>
            Cancelar
          </button>
          <button onClick={handlePreviewDiff} disabled={!difRows.length || generating}
            style={{ background: difRows.length&&!generating?'#0d3d6e':'#f3f4f6',
              color: difRows.length&&!generating?'#fff':'#d1d5db',
              border:'none', borderRadius:8, padding:'7px 14px', fontSize:11,
              fontWeight:700, cursor: difRows.length&&!generating?'pointer':'default' }}>
            {generating ? 'Generando…' : 'Ver reporte ↗'}
          </button>
          {mailHref ? (
            <a href={mailHref} onClick={()=>{ setMailHref(null); setPreviewHtml(null) }}
              style={{ background:'#166534', color:'#fff', borderRadius:8,
                padding:'7px 14px', fontSize:11, fontWeight:700,
                textDecoration:'none', whiteSpace:'nowrap' }}>
              Enviar Reporte ✉
            </a>
          ) : previewHtml ? (
            <button onClick={handleEnviarDiff} disabled={uploading}
              style={{ background: uploading?'#6b7280':'#1a5fa8', color:'#fff',
                border:'none', borderRadius:8, padding:'7px 14px', fontSize:11,
                fontWeight:700, cursor: uploading?'default':'pointer', whiteSpace:'nowrap' }}>
              {uploading ? 'Guardando…' : 'Aprobar Reporte ✉'}
            </button>
          ) : null}
        </div>
        </>}
      </div>

    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function FactScytel() {
  const sitiosRaw        = useAppStore(s=>s.sitios)
  const gastos           = useAppStore(s=>s.gastos)
  const subcs            = useAppStore(s=>s.subcs)
  const catalogTI        = useAppStore(s=>s.catalogTI)
  const liquidaciones_cw = useAppStore(s=>s.liquidaciones_cw)
  const ppa              = useFactStore(s=>s.ppa)
  const pos              = useFactStore(s=>s.pos)
  const invoices         = useFactStore(s=>s.invoices)
  const { margenes, billing, loading, loadAll, registrarSpo, deleteBilling, actualizarPctMes } = useScytelStore()
  const user       = useAuthStore(s=>s.user)
  const canBill    = user?.role === 'admin'

  const [modal,          setModal]         = useState(null)
  const [pctModal,       setPctModal]      = useState(null)
  const [facturaModal,   setFacturaModal]  = useState(null)
  const [expandedSites,  setExpandedSites] = useState(new Set())
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [showFacturas,   setShowFacturas]  = useState(false)
  const [reporteModal,   setReporteModal]  = useState(false)
  const sentinelRef = useRef(null)

  useEffect(()=>{ loadAll() },[]) // eslint-disable-line

  function toggleSite(key) {
    setExpandedSites(s=>{ const n=new Set(s); n.has(key)?n.delete(key):n.add(key); return n })
  }

  // ── Margen SCYTEL por mes ─────────────────────────────────────
  const scytelLcs = useMemo(()=>
    new Set(subcs.filter(s=>s.tipoCuadrilla==='TI SCYTEL'||s.tipoCuadrilla==='TSS SCYTEL').map(s=>s.lc))
  ,[subcs])

  const scytelSitios = useMemo(()=>
    sitiosRaw.filter(s=>scytelLcs.has(s.lc)).map(s=>{
      const c = calcSitio(s,gastos,subcs,catalogTI,liquidaciones_cw)
      return { nombre:s.nombre, lc:s.lc, mes:s.fecha?.slice(0,7)||null, totalVenta:c.totalVenta, totalCosto:c.totalCosto }
    })
  ,[sitiosRaw,scytelLcs,gastos,subcs,catalogTI,liquidaciones_cw])

  const liveMargenMes = useMemo(()=>{
    const map={}
    for (const s of scytelSitios) {
      if (!s.mes) continue
      if (!map[s.mes]) map[s.mes]={venta:0,costo:0}
      map[s.mes].venta+=s.totalVenta; map[s.mes].costo+=s.totalCosto
    }
    return Object.fromEntries(
      Object.entries(map).map(([mes,{venta,costo}])=>[mes, venta>0?(venta-costo)/venta:0])
    )
  },[scytelSitios])

  const lockedMargenMap = useMemo(()=>
    Object.fromEntries(margenes.map(m=>[`${m.year}-${String(m.month).padStart(2,'0')}`,m]))
  ,[margenes])

  const siteToMes = useMemo(()=>{
    const map=new Map()
    for (const s of scytelSitios) if (s.mes) map.set(norm(s.nombre),s.mes)
    return map
  },[scytelSitios])

  const siteToLc = useMemo(()=>{
    const map=new Map()
    for (const s of scytelSitios) map.set(norm(s.nombre), s.lc)
    return map
  },[scytelSitios])

  // ── Mapas de datos ────────────────────────────────────────────
  const posMap       = useMemo(()=>new Map(pos.map(p=>[p.spo_number,p])),[pos])
  const invMap       = useMemo(()=>buildInvoicesMap(invoices),[invoices])
  const billingBySpo = useMemo(()=>new Map(billing.map(b=>[b.spo_number,b])),[billing])

  function getInvForSpo(spo) {
    for (const ev of EVENTOS_ORDER) {
      const inv = invMap[`${spo}|${ev}`]
      if (inv?.numero_factura) return inv
    }
    for (const ev of EVENTOS_ORDER) {
      const inv = invMap[`${spo}|${ev}`]
      if (inv) return inv
    }
    return null
  }

  // ── Filas SPO (solo impl y adj) ───────────────────────────────
  const spoRows = useMemo(()=>{
    const scytelNames = new Set(scytelSitios.map(s=>norm(s.nombre)))
    const billedSpos  = new Set(billing.map(b=>b.spo_number))
    return ppa
      .filter(p=>{
        const cat = getSmpCat(p.smp_name).key
        if (cat !== 'impl' && cat !== 'adj') return false
        return scytelNames.has(norm(p.customer_site_name)) || billedSpos.has(p.spo_number)
      })
      .map(ppaRow=>{
        const po  = posMap.get(ppaRow.spo_number)
        const bil = billingBySpo.get(ppaRow.spo_number)
        const mes = siteToMes.get(norm(ppaRow.customer_site_name)) || bil?.periodo_margen || null
        const inv = getInvForSpo(ppaRow.spo_number)
        return {
          spo_number:    ppaRow.spo_number,
          site_name:     ppaRow.customer_site_name,
          ms_name:       ppaRow.ms_name,
          smp_name:      ppaRow.smp_name,
          cat:           getSmpCat(ppaRow.smp_name).key,
          mes,
          hito:          inferHito(ppaRow, inv),
          netValue:      po?.valor||0,
          ingetelBilled: !!inv,
          invIngetel:    inv ? { numero: inv.numero_factura, fecha: inv.fecha_factura } : null,
          scytelBilled:  !!bil,
          numeroFactura: bil?.numero_factura,
          fechaFactura:  bil?.fecha_factura || '',
          pctFacturado:  bil?.pct_scytel    || null,
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ppa,scytelSitios,billing,posMap,invMap,billingBySpo,siteToMes])

  // ── Agrupar: mes → sitio → cat → [rows] ──────────────────────
  const porMes = useMemo(()=>{
    const map={}
    for (const r of spoRows) {
      const mes = r.mes||'sin-fecha'
      if (!map[mes]) map[mes]={}
      if (!map[mes][r.site_name]) map[mes][r.site_name]={}
      const cats = map[mes][r.site_name]
      if (!cats[r.cat]) cats[r.cat]=[]
      cats[r.cat].push(r)
    }
    // Ordenar hitos dentro de cada cat
    for (const mes of Object.values(map))
      for (const cats of Object.values(mes))
        for (const rows of Object.values(cats))
          rows.sort((a,b)=>(HITO_ORDER[a.hito]??9)-(HITO_ORDER[b.hito]??9))

    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[spoRows])

  // ── Totales ───────────────────────────────────────────────────
  const totales = useMemo(()=>{
    let totalPos=0, totalFact=0, totalScytel=0, pendientePo=0, pendientePoScytel=0, pendienteScytelPo=0, pendienteScytelAmt=0
    for (const r of spoRows) {
      const locked = lockedMargenMap[r.mes||'']
      const pctMes = locked?.pct_scytel ?? pctBracket(liveMargenMes[r.mes||'']??0)
      totalPos += r.netValue
      if (r.ingetelBilled) totalFact   += r.netValue
      if (r.scytelBilled)  totalScytel += r.netValue*(r.pctFacturado||pctMes)/100
      if (!r.ingetelBilled) {
        pendientePo      += r.netValue
        pendientePoScytel += r.netValue*pctMes/100
      }
      if (r.ingetelBilled&&!r.scytelBilled) {
        pendienteScytelPo  += r.netValue
        pendienteScytelAmt += r.netValue*pctMes/100
      }
    }
    return { totalPos, totalFact, totalScytel, pendientePo, pendientePoScytel, pendienteScytelPo, pendienteScytelAmt }
  },[spoRows,lockedMargenMap,liveMargenMes])

  // Totales dinámicos según toggle
  const cards = useMemo(()=>{
    if (!soloPendientes) return [
      { label:'Total POs SCYTEL',            value:fmtCOP(totales.totalPos),            color:'#1e40af' },
      { label:'Facturado Ingetel',           value:fmtCOP(totales.totalFact),            color:'#144E4A' },
      { label:'Pendiente por facturar (Ingetel)', value:fmtCOP(totales.pendientePo),       color:'#b45309', sub: fmtCOP(totales.pendientePoScytel) },
      { label:'Facturado SCYTEL',            value:fmtCOP(totales.totalScytel),          color:'#6d28d9' },
      { label:'Pendiente SCYTEL',            value:fmtCOP(totales.pendienteScytelAmt),   color:'#7c3aed', sub: fmtCOP(totales.pendienteScytelPo), subLabel:'SCYTEL(PO)' },
    ]
    // Solo pendientes: recalcular sobre filas filtradas
    let po=0, scytel=0
    const pending = spoRows.filter(r=>r.ingetelBilled&&!r.scytelBilled)
    for (const r of pending) {
      const locked = lockedMargenMap[r.mes||'']
      const pctMes = locked?.pct_scytel ?? pctBracket(liveMargenMes[r.mes||'']??0)
      po     += r.netValue
      scytel += r.netValue*pctMes/100
    }
    return [
      { label:'SPOs pendientes',             value:`${pending.length}`,             color:'#b45309' },
      { label:'Valor PO pendiente',          value:fmtCOP(po),                      color:'#b45309' },
      { label:'A facturar SCYTEL',           value:fmtCOP(scytel),                  color:'#6d28d9' },
    ]
  },[soloPendientes, totales, spoRows, lockedMargenMap, liveMargenMes])

  // Listado de facturas SCYTEL emitidas agrupadas por número
  const facturasList = useMemo(()=>{
    const map = new Map()
    for (const b of billing) {
      if (!b.numero_factura) continue
      if (!map.has(b.numero_factura)) {
        map.set(b.numero_factura, { numero: b.numero_factura, fecha: b.fecha_factura, valor: 0, spos: 0 })
      }
      const f = map.get(b.numero_factura)
      f.valor += b.valor_scytel || 0
      f.spos  += 1
      if (b.fecha_factura && (!f.fecha || b.fecha_factura > f.fecha)) f.fecha = b.fecha_factura
    }
    return [...map.values()].sort((a,b)=>a.numero.localeCompare(b.numero))
  },[billing])

  function getPctForMes(mes) {
    const locked = lockedMargenMap[mes]
    if (locked) return { pct: locked.pct_scytel, margen: locked.margen_pct, locked: true }
    const m = liveMargenMes[mes]??0
    return { pct: pctBracket(m), margen: +(m*100).toFixed(1), locked: false }
  }

  function handleOpenModal(row, isEdit = false) {
    const mes = row.mes||'sin-fecha'
    const { pct, margen } = getPctForMes(mes)
    // pctAcordado: si el SPO ya tiene registro propio usa ese, sino el del mes
    const pctAcordado = (isEdit && row.pctFacturado) ? row.pctFacturado : pct
    setModal({ row, pctReal:pct, pctAcordado, margenPct:margen, periodoMes:mes, isEdit })
  }

  function handleOpenPctMes(mesKey) {
    const { pct, margen } = getPctForMes(mesKey)
    const pctBracket = pctBracket_calc(mesKey)
    setPctModal({ mesKey, pctReal: pctBracket, pctAcordado: pct, margenPct: margen })
  }

  function pctBracket_calc(mesKey) {
    return pctBracket(liveMargenMes[mesKey]??0)
  }

  if (loading) return (
    <div style={{padding:40,textAlign:'center',color:'#9ca89c',fontSize:13}}>Cargando…</div>
  )

  const COLS = 7

  return (
    <div>
      {reporteModal && (
        <ReporteModal
          pendingRows={spoRows.filter(r=>r.ingetelBilled&&!r.scytelBilled)}
          billedRows={spoRows.filter(r=>r.scytelBilled)}
          billedMonths={new Set(spoRows.filter(r=>r.scytelBilled).map(r=>r.mes||'sin-fecha'))}
          lockedMargenMap={lockedMargenMap}
          liveMargenMes={liveMargenMes}
          onClose={()=>setReporteModal(false)}
        />
      )}
      {facturaModal && (
        <FacturaDetalleModal
          factura={facturaModal}
          billing={billing}
          spoRows={spoRows}
          onClose={()=>setFacturaModal(null)}
        />
      )}
      {pctModal && (
        <PctMesModal
          {...pctModal}
          onClose={()=>setPctModal(null)}
          onSave={async ({ pct_acordado })=>{
            const { margenPct } = pctModal
            await actualizarPctMes({
              periodo_margen: pctModal.mesKey,
              pct_real:       pctModal.pctReal,
              pct_acordado,
              margen_pct:     margenPct,
              locked_by:      user?.email,
            })
          }}
        />
      )}
      {modal && (
        <FacturarScytelModal
          {...modal}
          onClose={()=>setModal(null)}
          onSave={async data=>{ await registrarSpo({ ...data, locked_by: user?.email }) }}
          onDelete={async spoNumber=>{ await deleteBilling(billing.find(b=>b.spo_number===spoNumber)?.id) }}
        />
      )}

      {/* Header sticky */}
      <div style={{ position:'sticky', top:'calc(86px + env(safe-area-inset-top))', zIndex:20,
        background:'var(--bg,#fffefb)', paddingTop:10, paddingBottom:6, marginBottom:6,
        boxShadow:'0 4px 8px -4px rgba(0,0,0,.07)' }}>

        {/* Fila 1: título + solo pendientes (izq) + facturas emitidas (der) */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, margin:0 }}>
            Facturación Scytel
          </h1>
          <button onClick={()=>setSoloPendientes(v=>!v)}
            style={{ border: soloPendientes ? '2px solid #b45309' : '2px solid #e5e7eb',
              borderRadius:8, padding:'3px 10px', fontSize:10, fontWeight:700,
              background: soloPendientes ? '#fffbeb' : '#f9fafb',
              color: soloPendientes ? '#b45309' : '#9ca3af',
              cursor:'pointer', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
            <span style={{ width:6, height:6, borderRadius:'50%',
              background: soloPendientes ? '#b45309' : '#d1d5db', display:'inline-block' }} />
            Solo pendientes
            {totales.pendientePo > 0 && (
              <span style={{ background: soloPendientes ? '#b45309' : '#e5e7eb',
                color: soloPendientes ? '#fff' : '#6b7280',
                borderRadius:10, padding:'0 5px', fontSize:9, fontWeight:800 }}>
                {spoRows.filter(r=>r.ingetelBilled&&!r.scytelBilled).length}
              </span>
            )}
          </button>

          <span style={{ flex:1 }} />

          {/* Botón reportes — solo admin */}
          {canBill && (
            <button onClick={()=>setReporteModal(true)}
              style={{ border:'1px solid #c8d4e2', borderRadius:8, cursor:'pointer',
                padding:'4px 10px', display:'flex', alignItems:'center', gap:5,
                background:'#eef4fb', color:'#1a5fa8', fontSize:10, fontWeight:700,
                whiteSpace:'nowrap' }}>
              Reportes ↗
            </button>
          )}

          {/* Dropdown facturas emitidas — alineado a la derecha */}
          {facturasList.length > 0 && (
            <div style={{ position:'relative' }}>
              <button onClick={()=>setShowFacturas(v=>!v)}
                style={{ background: showFacturas ? '#f3f4f6' : 'none',
                  border:'1px solid #e5e7eb', borderRadius:8, cursor:'pointer',
                  padding:'4px 10px', display:'flex', alignItems:'center', gap:6,
                  color: showFacturas ? '#6d28d9' : '#9ca3af', fontSize:10, fontWeight:600,
                  whiteSpace:'nowrap', transition:'all .15s' }}>
                Facturas emitidas
                <span style={{ background: showFacturas ? '#ede9fe' : '#f3f4f6',
                  color: showFacturas ? '#6d28d9' : '#6b7280',
                  borderRadius:8, padding:'0 6px', fontSize:9, fontWeight:700 }}>
                  {facturasList.length}
                </span>
                <span style={{ fontSize:8, opacity:.6 }}>{showFacturas ? '▾' : '▸'}</span>
              </button>
              {showFacturas && (
                <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', zIndex:50,
                  background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                  boxShadow:'0 8px 24px rgba(0,0,0,.1)', overflow:'hidden', minWidth:320 }}>
                  <table style={{ borderCollapse:'collapse', fontSize:10, width:'100%' }}>
                    <thead>
                      <tr style={{ background:'#f8f9fb', borderBottom:'1px solid #e5e7eb' }}>
                        {['# Factura','Fecha','Valor'].map(h=>(
                          <th key={h} style={{ padding:'6px 12px', textAlign:'left', fontSize:9,
                            fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:.5 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {facturasList.map((f,i)=>(
                        <tr key={f.numero}
                          onClick={()=>{ setFacturaModal(f); setShowFacturas(false) }}
                          style={{ borderTop: i>0?'1px solid #f3f4f6':'none', background:'#fff',
                            cursor:'pointer', transition:'background .1s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='#faf5ff'}
                          onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                          <td style={{ padding:'6px 12px', fontWeight:700, color:'#6d28d9', fontFamily:'monospace' }}>{f.numero}</td>
                          <td style={{ padding:'6px 12px', color:'#6b7280' }}>
                            {f.fecha ? new Date(f.fecha+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                          </td>
                          <td style={{ padding:'6px 12px', fontWeight:700, color:'#374151' }}>{fmtCOP(f.valor)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop:'1px solid #e5e7eb', background:'#faf5ff' }}>
                        <td style={{ padding:'5px 12px', fontSize:9, fontWeight:700, color:'#6b7280' }}>TOTAL</td>
                        <td style={{ padding:'5px 12px', color:'#6b7280' }} />
                        <td style={{ padding:'5px 12px', fontWeight:800, color:'#6d28d9' }}>{fmtCOP(facturasList.reduce((s,f)=>s+f.valor,0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fila 2: cards estilo Pagos Subc */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {cards.map(c=>(
            <div key={c.label} className="card" style={{ flex:1, minWidth:120, padding:'8px 12px', margin:0 }}>
              <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'#9ca89c', marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:17, fontWeight:800, color:c.color, lineHeight:1.1 }}>{c.value}</div>
              {c.sub && <div style={{ fontSize:9, color:'#9ca89c', marginTop:2 }}>{c.subLabel ?? 'SCYTEL'}: {c.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {scytelLcs.size === 0 && (
        <div className="card-b" style={{padding:32}}>
          <EmptyState icon="⚙" title="Sin cuadrillas SCYTEL"
            subtitle='Asigna el tipo "TI SCYTEL" o "TSS SCYTEL" en el Catálogo de Subcontratistas.' />
        </div>
      )}
      {scytelLcs.size > 0 && porMes.length === 0 && (
        <div className="card-b" style={{padding:32}}>
          <EmptyState icon="📋" title="Sin datos"
            subtitle={`${scytelSitios.length} sitio(s) SCYTEL en Liquidador, sin coincidencias en el PPA.`} />
        </div>
      )}

      {/* Tabla por mes */}
      {porMes.map(([mesKey, sitesOrig])=>{
        // Cuando soloPendientes, filtrar solo filas con Facturar pendiente
        const sites = soloPendientes
          ? Object.fromEntries(
              Object.entries(sitesOrig)
                .map(([s, cats]) => [s, Object.fromEntries(
                  Object.entries(cats)
                    .map(([c, rows]) => [c, rows.filter(r=>r.ingetelBilled&&!r.scytelBilled)])
                    .filter(([, rows]) => rows.length > 0)
                )])
                .filter(([, cats]) => Object.keys(cats).length > 0)
            )
          : sitesOrig
        if (Object.keys(sites).length === 0) return null

        const { pct, margen, locked } = getPctForMes(mesKey)
        const bracketReal = pctBracket(liveMargenMes[mesKey]??0)
        const mc  = margen>=30?'#166534':margen>=20?'#854d0e':'#991b1b'
        const pc  = pct===12?'#166534':pct===10?'#1e40af':'#991b1b'
        const pb  = pct===12?'#dcfce7':pct===10?'#dbeafe':'#fee2e2'
        const allRows        = Object.values(sites).flatMap(cats=>Object.values(cats).flat())
        const porFacturarMes = allRows.filter(r=>r.ingetelBilled&&!r.scytelBilled).reduce((s,r)=>s+r.netValue*pct/100,0)
        const pendienteMes   = allRows.filter(r=>!r.ingetelBilled).reduce((s,r)=>s+r.netValue*pct/100,0)
        const factMes        = allRows.filter(r=>r.scytelBilled).reduce((s,r)=>s+r.netValue*(r.pctFacturado||pct)/100,0)

        return (
          <div key={mesKey} style={{ marginBottom:20 }}>
            {/* Header mes */}
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
              padding:'6px 12px', marginBottom:4 }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:17, fontWeight:500, color:'#4c1d95' }}>
                {mesLabel(mesKey)}
              </span>
              {locked && <span style={{ fontSize:8, fontWeight:800, color:'#6d28d9', background:'#ede9fe', padding:'1px 7px', borderRadius:8 }}>🔒</span>}
              <span style={{ fontSize:11, fontWeight:700, color:mc }}>
                Margen: {margen.toFixed(1)}%{' '}
                <span style={{ fontWeight: pct===bracketReal ? 600 : 400, color: pct===bracketReal ? '#166534' : '#6b7280' }}>
                  (Bracket {bracketReal}%)
                </span>
              </span>
              <button onClick={()=>handleOpenPctMes(mesKey)}
                style={{ fontSize:10, fontWeight:800, padding:'2px 9px', borderRadius:12,
                  background:pb, color:pc, border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:4 }}>
                {pct}% SCYTEL
                <span style={{ fontSize:8, opacity:.6 }}>✎</span>
              </button>
              <span style={{ flex:1 }} />
              {factMes > 0 && (
                <span style={{ fontSize:10, color:'#475569', fontWeight:700 }}>Facturado: {fmtCOP(factMes)}</span>
              )}
              {porFacturarMes > 0 && (
                <span style={{ fontSize:10, color:'#1e40af', fontWeight:700 }}>Facturar: {fmtCOP(porFacturarMes)}</span>
              )}
              {pendienteMes > 0 && (
                <span style={{ fontSize:10, color:'#b45309', fontWeight:700 }}>Pendiente: {fmtCOP(pendienteMes)}</span>
              )}
            </div>

            <div className="card" style={{ overflow:'auto', marginBottom:4 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:640 }}>
                <thead>
                  <tr style={{ background:'#f8faf8', borderBottom:'1px solid #e0e4e0' }}>
                    {['Sitio / Hito','Descripción','SPO','Valor PO','# Fact Ingetel','Valor SCYTEL','# Fact SCYTEL'].map(h=>(
                      <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontWeight:600,
                        color:'#617561', fontSize:10, whiteSpace:'nowrap',
                        position:'sticky', top:0, background:'#f8faf8',
                        borderBottom:'1px solid #e0e4e0', zIndex:1 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sites).map(([siteName, cats])=>{
                    const siteRows  = Object.values(cats).flat()
                    const pendSite        = siteRows.filter(r=>r.ingetelBilled&&!r.scytelBilled).length
                    const pendSiteAmt     = siteRows.filter(r=>r.ingetelBilled&&!r.scytelBilled).reduce((s,r)=>s+r.netValue*pct/100,0)
                    const waitSite        = siteRows.filter(r=>!r.ingetelBilled).length
                    const waitSiteAmt     = siteRows.filter(r=>!r.ingetelBilled).reduce((s,r)=>s+r.netValue*pct/100,0)
                    const billedSiteAmt   = siteRows.filter(r=>r.scytelBilled).reduce((s,r)=>s+r.netValue*(r.pctFacturado||pct)/100,0)
                    const siteKey   = `${mesKey}|${siteName}`
                    const isOpen    = soloPendientes || expandedSites.has(siteKey)

                    return [
                      // ── Fila sitio (colapsable) ──
                      <tr key={`site-${siteKey}`}
                        onClick={()=>toggleSite(siteKey)}
                        style={{ cursor:'pointer', background:'#f8faf8', borderTop:'2px solid #e0e4e0' }}>
                        <td colSpan={COLS} style={{ padding:'7px 10px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ fontSize:10, color:'#617561', fontWeight:700 }}>{isOpen?'▼':'▶'}</span>
                            <span style={{ fontWeight:700, fontSize:12 }}>{siteName}</span>
                            {siteToLc.get(norm(siteName)) && (
                              <span style={{ fontSize:10, color:'#6b7280' }}>
                                ({siteToLc.get(norm(siteName))})
                              </span>
                            )}
                            <span style={{ fontSize:9, color:'#6b7280', background:'#f3f4f6', borderRadius:4, padding:'1px 6px' }}>
                              {siteRows.length} SPO{siteRows.length!==1?'s':''}
                            </span>
                            {billedSiteAmt > 0 && (
                              <span style={{ fontSize:9, fontWeight:700, color:'#475569', whiteSpace:'nowrap' }}>
                                Facturado {fmtCOP(billedSiteAmt)}
                              </span>
                            )}
                            {pendSite > 0 && (
                              <span style={{ fontSize:9, fontWeight:700, color:'#1e40af', whiteSpace:'nowrap' }}>
                                Facturar {fmtCOP(pendSiteAmt)} ({pendSite}PO)
                              </span>
                            )}
                            {waitSite > 0 && (
                              <span style={{ fontSize:9, fontWeight:700, color:'#b45309', whiteSpace:'nowrap' }}>
                                Pendiente {fmtCOP(waitSiteAmt)} ({waitSite}PO)
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>,

                      // ── Filas expandidas por categoría ──
                      ...(isOpen ? Object.entries(cats).map(([catKey, rows], gi)=>{
                        const catMeta = CAT_META[catKey] || { label: catKey.toUpperCase(), color:'#9ca89c' }
                        return [
                          // Sub-header categoría
                          <tr key={`cat-${siteKey}-${catKey}`}>
                            <td colSpan={COLS} style={{
                              padding:'3px 10px 3px 24px',
                              background:`${catMeta.color}08`,
                              borderTop: gi===0?'1px solid #e8eae8':'1px solid #f0f0f0',
                            }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ width:6, height:6, borderRadius:'50%', background:catMeta.color, display:'inline-block', flexShrink:0 }} />
                                <span style={{ fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:catMeta.color }}>
                                  {catMeta.label}
                                </span>
                              </div>
                            </td>
                          </tr>,
                          // Filas SPO
                          ...rows.map(r=>{
                            const hMeta       = HITO_META[r.hito] || HITO_META.MOS
                            // Para filas ya facturadas, usar el % acordado; para pendientes, usar bracket del mes
                            const pctFila     = r.scytelBilled ? (r.pctFacturado || pct) : pct
                            const valorScytel = r.netValue * pctFila / 100
                            const label       = r.hito==='ADJ' ? r.smp_name : (r.ms_name || r.smp_name || '—')
                            return (
                              <tr key={r.spo_number} style={{ borderTop:'1px solid #f0f0f0', background:'#fff' }}>
                                <td style={{ padding:'5px 10px 5px 28px', borderLeft:`3px solid ${catMeta.color}` }}>
                                  <span style={{ background:hMeta.bg, color:hMeta.color,
                                    fontSize:9, fontWeight:800, padding:'1px 8px', borderRadius:10 }}>
                                    {hMeta.label}
                                  </span>
                                </td>
                                <td style={{ padding:'5px 10px', fontSize:10, color:'#555' }}>{label}</td>
                                <td style={{ padding:'5px 10px', fontFamily:'monospace', fontSize:10, color:'#374151', fontWeight:600 }}>
                                  {r.spo_number}
                                </td>
                                <td style={{ padding:'5px 10px', textAlign:'right', color:'#374151' }}>
                                  {r.netValue ? fmtCOP(r.netValue) : <span style={{ color:'#d4d4d8' }}>Sin PO</span>}
                                </td>
                                <td style={{ padding:'5px 10px', textAlign:'center' }}>
                                  {r.invIngetel?.numero
                                    ? <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700, color:'#166534' }}>
                                        {r.invIngetel.numero}
                                      </span>
                                    : <span style={{ color:'#d1d5db', fontSize:9 }}>Pendiente</span>
                                  }
                                </td>
                                <td style={{ padding:'5px 10px', textAlign:'right', fontWeight:700,
                                  color:(r.ingetelBilled||r.scytelBilled)?'#1e40af':'#d1d5db' }}>
                                  {(r.ingetelBilled||r.scytelBilled) ? fmtCOP(valorScytel) : '—'}
                                </td>
                                <td style={{ padding:'5px 10px', textAlign:'center' }}>
                                  {r.scytelBilled
                                    ? <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                                        <span style={{ fontSize:10, fontWeight:800, color:'#6d28d9',
                                          background:'#ede9fe', padding:'2px 10px', borderRadius:10, whiteSpace:'nowrap' }}>
                                          {r.numeroFactura}
                                        </span>
                                        {r.pctFacturado && r.pctFacturado !== pct && (
                                          <span style={{ fontSize:8, color:'#b45309', fontWeight:700 }}>{r.pctFacturado}%</span>
                                        )}
                                        <button onClick={()=>handleOpenModal(r, true)}
                                          style={{ background:'none', border:'1px solid #c4b5fd', color:'#6d28d9',
                                            borderRadius:6, padding:'2px 8px', fontSize:9,
                                            fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                          Editar
                                        </button>
                                      </div>
                                    : r.ingetelBilled
                                      ? canBill
                                        ? <button onClick={()=>handleOpenModal(r)}
                                            style={{ background:'#166534', color:'#fff', border:'none',
                                              borderRadius:6, padding:'4px 12px', fontSize:10,
                                              fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                            Facturar
                                          </button>
                                        : <span style={{ fontSize:9, fontWeight:700, color:'#b45309',
                                            background:'#fef3c7', border:'1px solid #fde68a',
                                            borderRadius:6, padding:'2px 8px', whiteSpace:'nowrap' }}>
                                            Pend. facturar
                                          </span>
                                      : <span style={{ color:'#e5e7eb', fontSize:9 }}>—</span>
                                  }
                                </td>
                              </tr>
                            )
                          }),
                        ]
                      }) : []),
                    ]
                  })}
                  <tr><td ref={sentinelRef} colSpan={COLS} style={{ padding:0, height:1 }} /></tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
