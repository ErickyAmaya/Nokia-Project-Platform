import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useAppStore } from '../store/useAppStore'
import { calcSitio } from '../lib/calcSitio'
import { getPrecio, cop, pct, CAT, ZONAS } from '../lib/catalog'
import { showToast } from '../components/Toast'

// ── Helpers ──────────────────────────────────────────────────────

function num(v) { return Math.round(v || 0) }

function autoWidth(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const widths = []
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 8
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell?.v != null) {
        const len = String(cell.v).length
        if (len > max) max = len
      }
    }
    widths.push({ wch: Math.min(max + 2, 40) })
  }
  sheet['!cols'] = widths
}

// ── Sheet builders ───────────────────────────────────────────────

function buildSheetConsolidadoTI(sitios, gastos, subcs, catalogTI, liquidaciones_cw) {
  const rows = []

  // Header
  rows.push([
    'Sitio', 'Ciudad', 'Fecha', 'LC', 'Cat', 'Estado',
    'Nokia TI', 'Nokia ADJ', 'Nokia CW', 'Nokia CR', 'Venta Total',
    'SubC TI', 'SubC CW', 'SubC CR', 'Mat TI', 'Mat CW', 'Logística', 'Adicionales', 'Costo Total',
    'Utilidad', 'Margen %',
  ])

  sitios.filter(s => s.tipo !== 'TSS').forEach(s => {
    const c = calcSitio(s, gastos, subcs, catalogTI, liquidaciones_cw)
    rows.push([
      s.nombre,
      (s.ciudad || '').replace('Ciudad_', ''),
      s.fecha || '',
      s.lc,
      s.catEfectiva || s.cat,
      s.estado,
      num(c.nokiaTI), num(c.nokiaADJ), num(c.nokiaCW), num(c.nokiaCR), num(c.totalVenta),
      num(c.subcTI),  num(c.subcCW),  num(c.subcCR),
      num(c.matTI),   num(c.matCW),   num(c.logist),   num(c.adicion),  num(c.totalCosto),
      num(c.utilidad), parseFloat((c.margen * 100).toFixed(1)),
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  autoWidth(ws)
  return ws
}

function buildSheetConsolidadoTSS(sitios, subcs) {
  const rows = []
  rows.push([
    'Sitio', 'Fecha', 'LC Visita', 'LC Reporte', 'Cat', 'Cant Sitios',
    'Nokia Visitas', 'Nokia Reportes', 'Nokia Rediseños', 'Nokia V+R',
    'SubC Visitas',  'SubC Reportes',  'SubC Rediseños',  'SubC V+R',
  ])

  sitios.filter(s => s.tipo === 'TSS').forEach(s => {
    const lcV  = s.lcVisita  || s.lc || ''
    const lcR  = s.lcReporte || s.lc || ''
    const lcRd = s.lcRedesign || s.lc || ''
    const catOf = lc => subcs.find(x => x.lc === lc)?.cat || s.cat || 'A'
    let nV=0,nR=0,nRD=0,nVR=0,sV=0,sR=0,sRD=0,sVR=0

    ;(s.actividades || []).forEach(act => {
      const cant    = act.cant || 0
      const isNokia = act.cardType !== 'subc'
      const isSubc  = act.cardType !== 'nokia'
      if (isNokia) {
        const pN = getPrecio('BASE', act.id, null, s.cat || 'A', act.ciudad)
        const n  = pN.nokia * cant
        if      (act.id === 'TSS_V')  nV  += n
        else if (act.id === 'TSS_R')  nR  += n
        else if (act.id === 'TSS_RD') nRD += n
        else if (act.id === 'TSS_VR') nVR += n
      }
      if (isSubc) {
        const cb = act.id === 'TSS_V' ? catOf(lcV) : act.id === 'TSS_R' ? catOf(lcR) : catOf(lcRd)
        const pS = getPrecio('BASE', act.id, null, act.catOver || cb, act.ciudad)
        const sc = pS.subc * cant
        if      (act.id === 'TSS_V')  sV  += sc
        else if (act.id === 'TSS_R')  sR  += sc
        else if (act.id === 'TSS_RD') sRD += sc
        else if (act.id === 'TSS_VR') sVR += sc
      }
    })

    const cantSitios = new Set((s.actividades || []).map(a => a.sitioid).filter(Boolean)).size

    rows.push([
      s.nombre, s.fecha || '', lcV, lcR, s.cat || 'A', cantSitios,
      num(nV), num(nR), num(nRD), num(nVR),
      num(sV), num(sR), num(sRD), num(sVR),
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  autoWidth(ws)
  return ws
}

function buildSheetGastos(sitios, gastos) {
  const rows = []
  rows.push(['Sitio', 'Tipo', 'Descripción', 'Sub-Sitio', 'Valor'])

  gastos.forEach(g => {
    const nombre = sitios.find(s => s.id === g.sitio)?.nombre || g.sitio || ''
    rows.push([nombre, g.tipo, g.desc, g.sub_sitio || '', num(g.valor)])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  autoWidth(ws)
  return ws
}

function buildSheetActividades(sitios, gastos, subcs) {
  const rows = []
  rows.push([
    'Sitio', 'Tipo Sitio', 'LC', 'Cat', 'Sección', 'Actividad', 'Unidad',
    'Cantidad', 'P. Nokia', 'Total Nokia', 'P. SubC', 'Total SubC',
  ])

  sitios.forEach(s => {
    const cat = s.catEfectiva || s.cat || 'A'
    ;(s.actividades || []).forEach(act => {
      const allItems = [...CAT.BASE, ...CAT.ADJ, ...CAT.CR]
      const def    = allItems.find(c => c.id === act.id)
      const p      = getPrecio(act.tipo || 'BASE', act.id, s.ciudad, cat, act.ciudad || null)
      rows.push([
        s.nombre, s.tipo, s.lc, cat,
        act.sec || act.tipo || '—',
        def?.nombre || act.id, def?.unidad || '—',
        act.cant || 0,
        num(p.nokia), num(p.nokia * (act.cant || 0)),
        num(p.subc),  num(p.subc  * (act.cant || 0)),
      ])
    })
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  autoWidth(ws)
  return ws
}

function buildSheetResumenLC(sitios, gastos, subcs, catalogTI, liquidaciones_cw) {
  const rows = []
  rows.push(['LC', 'Empresa', 'Tipo Cuadrilla', 'Sitios', 'Venta Nokia', 'Costo', 'Utilidad', 'Margen %'])

  const byLC = {}
  sitios.forEach(s => {
    const lc = s.lc || 'Sin LC'
    if (!byLC[lc]) { byLC[lc] = { venta: 0, costo: 0, count: 0 } }
    const c = calcSitio(s, gastos, subcs, catalogTI, liquidaciones_cw)
    byLC[lc].venta += c.totalVenta
    byLC[lc].costo += c.totalCosto
    byLC[lc].count++
  })

  Object.entries(byLC).sort(([,a],[,b]) => b.venta - a.venta).forEach(([lc, v]) => {
    const sub = subcs.find(x => x.lc === lc)
    const util = v.venta - v.costo
    rows.push([
      lc, sub?.empresa || '—', sub?.tipoCuadrilla || '—',
      v.count, num(v.venta), num(v.costo), num(util),
      parseFloat((v.venta > 0 ? util / v.venta * 100 : 0).toFixed(1)),
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  autoWidth(ws)
  return ws
}

// ── Sheet: Liquidación por sitio (una hoja por sitio) ────────────
function buildSheetsLiquidacionPorSitio(sitios, gastos, subcs, catalogTI, liquidaciones_cw) {
  const result   = []
  const usedNames = new Set()

  function safeName(nombre) {
    const clean = (nombre || 'Sitio').replace(/[:\\/?\*[\]]/g, '').slice(0, 28)
    if (!usedNames.has(clean)) { usedNames.add(clean); return clean }
    let i = 2
    while (usedNames.has(`${clean} ${i}`)) i++
    const n = `${clean} ${i}`; usedNames.add(n); return n
  }

  sitios.forEach(sitio => {
    const rows    = []
    const c       = calcSitio(sitio, gastos, subcs, catalogTI, liquidaciones_cw)
    const gastosS = gastos.filter(g => g.sitio === sitio.id)
    const liqCW   = liquidaciones_cw.find(l => l.sitio_id === sitio.id)

    // ── Encabezado del sitio ─────────────────────────────────────
    rows.push([sitio.nombre])
    if (sitio.tipo === 'TSS') {
      rows.push(['Tipo', 'TSS', 'Fecha', sitio.fecha || '', 'Estado', sitio.estado || ''])
    } else {
      rows.push([
        'Tipo', sitio.tipo || 'TI',
        'Ciudad', (sitio.ciudad || '').replace('Ciudad_', ''),
        'LC', sitio.lc || '—', 'Cat', c.cat,
        'Fecha', sitio.fecha || '', 'Estado', sitio.estado || '',
      ])
    }
    rows.push([])

    if (sitio.tipo === 'TSS') {
      // ── TSS ──────────────────────────────────────────────────
      const lcV   = sitio.lcVisita   || sitio.lc || ''
      const lcR   = sitio.lcReporte  || sitio.lc || ''
      const lcRd  = sitio.lcRedesign || sitio.lc || ''
      const catOf = lc => subcs.find(x => x.lc === lc)?.cat || sitio.cat || 'A'

      const nokiaActs    = c.acts.filter(a => a.cardType !== 'subc')
      const visitaActs   = c.acts.filter(a => a.cardType !== 'nokia' && a.id === 'TSS_V')
      const reporteActs  = c.acts.filter(a => a.cardType !== 'nokia' && a.id === 'TSS_R')
      const redisenoActs = c.acts.filter(a => a.cardType !== 'nokia' && a.id === 'TSS_RD')

      // Nokia
      rows.push(['NOKIA — LIQUIDACIÓN TSS'])
      rows.push(['Tipo', 'Sub-Sitio', 'Ciudad', 'Cant', 'P. Nokia', 'Total Nokia', 'Costo SubC'])
      nokiaActs.forEach(act => rows.push([
        act.id, act.sitioid || '', (act.ciudad || '').replace('Ciudad_', ''),
        act.cant || 0, num(act.preNokia), num(act.totalNokia),
        num(act.preSubc * (act.cant || 0)),
      ]))
      const totNokia = nokiaActs.reduce((s, a) => s + (a.totalNokia || 0), 0)
      const totNokiaSC = nokiaActs.reduce((s, a) => s + (a.preSubc || 0) * (a.cant || 0), 0)
      rows.push(['', '', '', '', 'TOTAL NOKIA', num(totNokia), num(totNokiaSC)])
      rows.push([])

      const addSubcSection = (title, lc, acts) => {
        if (!acts.length) return
        rows.push([title + (lc ? ` | ${lc}` : '')])
        rows.push(['Tipo', 'Sub-Sitio', 'Ciudad', 'Cat', 'Cant', 'P. SubC', 'Total SubC'])
        acts.forEach(act => {
          const cat = act.catOver || catOf(
            act.id === 'TSS_V' ? lcV : act.id === 'TSS_R' ? lcR : lcRd
          )
          rows.push([
            act.id, act.sitioid || '', (act.ciudad || '').replace('Ciudad_', ''),
            cat, act.cant || 0, num(act.preSubc), num(act.totalSubc),
          ])
        })
        const tot = acts.reduce((s, a) => s + (a.totalSubc || 0), 0)
        rows.push(['', '', '', '', '', 'TOTAL', num(tot)])
        rows.push([])
      }

      addSubcSection('SUBC — VISITA',   lcV,  visitaActs)
      addSubcSection('SUBC — REPORTE',  lcR,  reporteActs)
      addSubcSection('SUBC — REDISEÑO', lcRd, redisenoActs)

    } else {
      // ── TI / TSS-TI ─────────────────────────────────────────
      const BASE = c.acts.filter(a => !a.tipo || a.tipo === 'BASE')
      const ADJ  = c.acts.filter(a => a.tipo === 'ADJ')
      const CR   = c.acts.filter(a => a.tipo === 'CR')

      const addActSection = (title, acts, tipoKey) => {
        if (!acts.length) return
        rows.push([title])
        rows.push(['Actividad', 'Unidad', 'Cant', 'P. Nokia', 'Total Nokia', 'P. SubC', 'Total SubC'])
        acts.forEach(act => {
          const allItems = [...CAT.BASE, ...CAT.ADJ, ...CAT.CR]
          const def = allItems.find(d => d.id === act.id)
          rows.push([
            def?.nombre || act.id, def?.unidad || '—',
            act.cant || 0,
            num(act.preNokia), num(act.totalNokia),
            num(act.subcExcluded ? 0 : act.preSubc),
            num(act.totalSubc),
          ])
        })
        const tN = acts.reduce((s, a) => s + (a.totalNokia || 0), 0)
        const tS = acts.reduce((s, a) => s + (a.totalSubc  || 0), 0)
        rows.push(['', '', '', '', num(tN), '', num(tS)])
        rows.push([])
      }

      addActSection('NOKIA TI — BASE', BASE, 'BASE')
      addActSection('ADICIONALES (ADJ)', ADJ, 'ADJ')
      addActSection('CONCEPTOS RECURRENTES (CR)', CR, 'CR')

      // CW si existe
      const liqCWItems = liqCW?.items || []
      if (liqCWItems.length > 0) {
        rows.push(['OBRA CIVIL (CW)'])
        rows.push(['Actividad', 'Unidad', 'Cant', 'P. Nokia', 'Total Nokia', 'P. SubC', 'Total SubC'])
        liqCWItems.forEach(item => {
          rows.push([
            item.nombre || item.actividad_id || '—', item.unidad || '—',
            item.cant || 0,
            num(item.precio_nokia || 0), num((item.cant || 0) * (item.precio_nokia || 0)),
            num(item.precio_subc  || 0), num((item.cant || 0) * (item.precio_subc  || 0)),
          ])
        })
        rows.push(['', '', '', '', num(c.nokiaCW), '', num(c.subcCW)])
        rows.push([])
      } else if (sitio.cw_nokia > 0) {
        rows.push(['OBRA CIVIL (CW)', '', '', '', num(c.nokiaCW), '', num(c.subcCW)])
        rows.push([])
      }
    }

    // ── Gastos ───────────────────────────────────────────────────
    if (gastosS.length > 0) {
      rows.push(['GASTOS'])
      rows.push(['Tipo', 'Descripción', 'Sub-Sitio', 'Valor'])
      gastosS.forEach(g => rows.push([g.tipo || '', g.desc, g.sub_sitio || '', num(g.valor)]))
      const tG = gastosS.reduce((s, g) => s + (g.valor || 0), 0)
      rows.push(['', 'TOTAL GASTOS', '', num(tG)])
      rows.push([])
    }

    // ── Resumen ──────────────────────────────────────────────────
    rows.push(['RESUMEN'])
    if (sitio.tipo === 'TSS') {
      const nokiaActs   = c.acts.filter(a => a.cardType !== 'subc')
      const tNokia      = nokiaActs.reduce((s, a) => s + (a.totalNokia || 0), 0)
      const subcActs    = c.acts.filter(a => a.cardType !== 'nokia')
      const tSubc       = subcActs.reduce((s, a) => s + (a.totalSubc  || 0), 0)
      const tGastos     = gastosS.reduce((s, g) => s + (g.valor || 0), 0)
      const util        = tNokia - tSubc - tGastos
      const mrg         = tNokia > 0 ? util / tNokia : 0
      rows.push(['Nokia TSS',   num(tNokia)])
      rows.push(['Costo SubC',  num(tSubc)])
      rows.push(['Gastos',      num(tGastos)])
      rows.push(['Costo Total', num(tSubc + tGastos)])
      rows.push(['Utilidad',    num(util)])
      rows.push(['Margen %',    parseFloat((mrg * 100).toFixed(1))])
    } else {
      if (c.nokiaTI  > 0) rows.push(['Nokia TI',       num(c.nokiaTI)])
      if (c.nokiaADJ > 0) rows.push(['Nokia ADJ',      num(c.nokiaADJ)])
      if (c.nokiaCW  > 0) rows.push(['Nokia CW',       num(c.nokiaCW)])
      if (c.nokiaCR  > 0) rows.push(['Nokia CR',       num(c.nokiaCR)])
      rows.push(['Venta Total',  num(c.totalVenta)])
      if (c.subcTI  > 0) rows.push(['SubC TI',         num(c.subcTI)])
      if (c.subcADJ > 0) rows.push(['SubC ADJ',        num(c.subcADJ)])
      if (c.subcCW  > 0) rows.push(['SubC CW',         num(c.subcCW)])
      if (c.subcCR  > 0) rows.push(['SubC CR',         num(c.subcCR)])
      if (c.matTI   > 0) rows.push(['Materiales TI',   num(c.matTI)])
      if (c.matCW   > 0) rows.push(['Materiales CW',   num(c.matCW)])
      if (c.logist  > 0) rows.push(['Logística',       num(c.logist)])
      if (c.adicion > 0) rows.push(['Adicionales',     num(c.adicion)])
      rows.push(['Costo Total',  num(c.totalCosto)])
      rows.push(['Utilidad',     num(c.utilidad)])
      rows.push(['Margen %',     parseFloat((c.margen * 100).toFixed(1))])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    autoWidth(ws)
    result.push({ name: safeName(sitio.nombre), ws })
  })

  return result
}

// ── Export function ───────────────────────────────────────────────
function exportWorkbook(sitios, gastos, subcs, sheets, catalogTI, liquidaciones_cw) {
  const wb = XLSX.utils.book_new()

  if (sheets.ti)    XLSX.utils.book_append_sheet(wb, buildSheetConsolidadoTI(sitios, gastos, subcs, catalogTI, liquidaciones_cw),  'Consolidado TI')
  if (sheets.tss)   XLSX.utils.book_append_sheet(wb, buildSheetConsolidadoTSS(sitios, subcs),                                      'Consolidado TSS')
  if (sheets.gastos)XLSX.utils.book_append_sheet(wb, buildSheetGastos(sitios, gastos),                                             'Gastos')
  if (sheets.acts)  XLSX.utils.book_append_sheet(wb, buildSheetActividades(sitios, gastos, subcs),                                 'Actividades')
  if (sheets.lc)    XLSX.utils.book_append_sheet(wb, buildSheetResumenLC(sitios, gastos, subcs, catalogTI, liquidaciones_cw),      'Resumen por LC')
  if (sheets.liqSitio) {
    buildSheetsLiquidacionPorSitio(sitios, gastos, subcs, catalogTI, liquidaciones_cw)
      .forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name))
  }

  const now    = new Date()
  const stamp  = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
  XLSX.writeFile(wb, `Nokia_Billing_${stamp}.xlsx`)
}

// ── Main page ─────────────────────────────────────────────────────
export default function ReportesPage() {
  const sitios           = useAppStore(s => s.sitios)
  const gastos           = useAppStore(s => s.gastos)
  const subcs            = useAppStore(s => s.subcs)
  const catalogTI        = useAppStore(s => s.catalogTI)
  const liquidaciones_cw = useAppStore(s => s.liquidaciones_cw)

  const [sheets, setSheets] = useState({
    ti: true, tss: true, gastos: true, acts: false, lc: true, liqSitio: false,
  })
  const [exporting, setExporting] = useState(false)

  function toggleSheet(key) {
    setSheets(s => ({ ...s, [key]: !s[key] }))
  }

  async function handleExport() {
    if (!Object.values(sheets).some(Boolean)) {
      showToast('Selecciona al menos una hoja', 'err')
      return
    }
    setExporting(true)
    try {
      exportWorkbook(sitios, gastos, subcs, sheets, catalogTI, liquidaciones_cw)
      showToast('Archivo exportado correctamente')
    } catch (e) {
      showToast('Error al exportar: ' + (e.message || ''), 'err')
    } finally {
      setExporting(false)
    }
  }

  // Preview stats
  const tiCount  = sitios.filter(s => s.tipo !== 'TSS').length
  const tssCount = sitios.filter(s => s.tipo === 'TSS').length

  const SHEET_OPTIONS = [
    { key: 'ti',       label: 'Consolidado TI',         sub: `${tiCount} sitios TI`,                       icon: '📊' },
    { key: 'tss',      label: 'Consolidado TSS',         sub: `${tssCount} sitios TSS`,                     icon: '📋' },
    { key: 'gastos',   label: 'Gastos',                  sub: `${gastos.length} registros`,                 icon: '💰' },
    { key: 'acts',     label: 'Actividades',             sub: 'detalle por actividad',                      icon: '🔧' },
    { key: 'lc',       label: 'Resumen por LC',          sub: 'totales por subcontratista',                 icon: '🏢' },
    { key: 'liqSitio', label: 'Liquidación por Sitio',   sub: `${sitios.length} hojas (una por sitio)`,    icon: '📄' },
  ]

  return (
    <>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="fb mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Reportes y Exportación
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>

        {/* ── Sheet selector ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card">
            <div className="card-h"><h2>Hojas del Reporte</h2></div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SHEET_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${sheets[opt.key] ? '#1a9c1a' : '#e0e4e0'}`,
                    background: sheets[opt.key] ? '#f0fdf4' : '#fff',
                    transition: 'all .15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sheets[opt.key]}
                    onChange={() => toggleSheet(opt.key)}
                    style={{ accentColor: '#1a9c1a', width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 18 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: '#9ca89c' }}>{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── Preview table (Consolidado TI) ─────────── */}
          <div className="card">
            <div className="card-h"><h2>Vista previa — Consolidado TI</h2></div>
            <div style={{ padding: 0, overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
              <table className="tbl" style={{ fontSize: 10 }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr>
                    <th>Sitio</th>
                    <th>LC</th>
                    <th>Cat</th>
                    <th className="num th-nokia">Venta</th>
                    <th className="num th-subc">Costo</th>
                    <th className="num">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {sitios.filter(s => s.tipo !== 'TSS').slice(0, 20).map(s => {
                    const c = calcSitio(s, gastos, subcs, catalogTI, liquidaciones_cw)
                    return (
                      <tr key={s.id}>
                        <td style={{ fontSize: 10, fontWeight: 600 }}>{s.nombre}</td>
                        <td style={{ fontSize: 9 }}>{s.lc}</td>
                        <td><span className="badge bg-gl" style={{ fontSize: 8 }}>{s.catEfectiva || s.cat}</span></td>
                        <td className="num" style={{ color: '#144E4A' }}>{cop(c.totalVenta)}</td>
                        <td className="num" style={{ color: '#b45309' }}>{cop(c.totalCosto)}</td>
                        <td className="num">
                          <span className={`badge ${c.margen >= .3 ? 'bg-g' : c.margen >= .2 ? 'bg-o' : 'bg-r'}`} style={{ fontSize: 8 }}>
                            {pct(c.margen)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {sitios.filter(s => s.tipo !== 'TSS').length > 20 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#9ca89c', fontSize: 10, padding: 8 }}>
                        … y {sitios.filter(s => s.tipo !== 'TSS').length - 20} sitios más en el archivo exportado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Export panel ────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-h" style={{ background: '#144E4A' }}>
              <h2 style={{ color: '#CDFBF2' }}>Exportar a Excel</h2>
            </div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: '#f8faf8', borderRadius: 8, padding: 14,
                border: '1px solid #d4e4d4',
              }}>
                <div style={{ fontSize: 11, color: '#555f55', marginBottom: 8, fontWeight: 600 }}>
                  RESUMEN DEL ARCHIVO
                </div>
                {SHEET_OPTIONS.filter(o => sheets[o.key]).map(o => (
                  <div key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ color: '#1a9c1a', fontSize: 11 }}>✓</span>
                    <span style={{ fontSize: 11 }}>{o.label}</span>
                  </div>
                ))}
                {!Object.values(sheets).some(Boolean) && (
                  <div style={{ fontSize: 11, color: '#c0392b' }}>Selecciona al menos una hoja</div>
                )}
              </div>

              <div style={{ fontSize: 10, color: '#9ca89c', lineHeight: 1.6 }}>
                El archivo se descargará con el nombre
                <strong> Nokia_Billing_YYYYMMDD.xlsx</strong>.
                Compatible con Excel 2016+ y Google Sheets.
              </div>

              <button
                className="btn bp"
                style={{ width: '100%', padding: '12px 0', fontSize: 14 }}
                onClick={handleExport}
                disabled={exporting || !Object.values(sheets).some(Boolean)}
              >
                {exporting ? 'Generando…' : '⬇ Descargar Excel'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="card">
            <div className="card-h"><h2>Datos del Proyecto</h2></div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Sitios TI',    value: tiCount },
                { label: 'Sitios TSS',   value: tssCount },
                { label: 'Total gastos', value: gastos.length },
                { label: 'Subcontratistas', value: subcs.length },
              ].map(r => (
                <div key={r.label} className="fb" style={{ fontSize: 11, borderBottom: '1px solid #f0f4f0', paddingBottom: 6 }}>
                  <span style={{ color: '#555f55' }}>{r.label}</span>
                  <span style={{ fontWeight: 700 }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
