import { useMemo, useState, useEffect, useRef } from 'react'
import { EmptyState }                            from '../../components/EmptyState'
import { showToast }                             from '../../components/Toast'
import { useAppStore }                           from '../../store/useAppStore'
import { useFactStore, getSmpCat, buildInvoicesMap } from '../../store/useFactStore'
import { useScytelStore }                        from '../../store/useScytelStore'
import { useAuthStore }                          from '../../store/authStore'
import { calcSitio }                             from '../../lib/calcSitio'

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
        const allRows     = Object.values(sites).flatMap(cats=>Object.values(cats).flat())
        const pendMes     = allRows.filter(r=>r.ingetelBilled&&!r.scytelBilled).length
        const pendienteMes = allRows.filter(r=>r.ingetelBilled&&!r.scytelBilled).reduce((s,r)=>s+r.netValue*pct/100,0)
        const factMes     = allRows.filter(r=>r.scytelBilled).reduce((s,r)=>s+r.netValue*(r.pctFacturado||pct)/100,0)

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
              <span style={{ fontSize:10, color: pendMes>0?'#b45309':'#9ca3af', fontWeight:700 }}>{pendMes} pend.</span>
              {pendienteMes > 0 && (
                <span style={{ fontSize:10, color:'#b45309', fontWeight:700 }}>Por facturar: {fmtCOP(pendienteMes)}</span>
              )}
              {factMes > 0 && (
                <span style={{ fontSize:10, color:'#6d28d9', fontWeight:700 }}>Facturado: {fmtCOP(factMes)}</span>
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
