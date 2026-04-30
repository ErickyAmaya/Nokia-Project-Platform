import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useHwStore } from '../../store/useHwStore'
import { showToast } from '../../components/Toast'

// ── Helpers ──────────────────────────────────────────────────────
function autoWidth(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const widths = []
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 8
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell?.v != null) { const len = String(cell.v).length; if (len > max) max = len }
    }
    widths.push({ wch: Math.min(max + 2, 45) })
  }
  sheet['!cols'] = widths
}

function ws(rows) {
  const s = XLSX.utils.aoa_to_sheet(rows)
  autoWidth(s)
  return s
}

function fmtDate(d) {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

function inRange(dateStr, from, to) {
  if (!dateStr) return true
  const d = dateStr.slice(0, 10)
  if (from && d < from) return false
  if (to   && d > to)   return false
  return true
}

// ── KPI card ─────────────────────────────────────────────────────
function KPI({ label, value, color = '#264D4A', sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, borderLeft:`4px solid ${color}`,
      padding:'10px 14px', boxShadow:'0 1px 4px rgba(0,0,0,.06)', minWidth:110 }}>
      <div style={{ fontSize:8, fontWeight:600, letterSpacing:1.2, textTransform:'uppercase',
        color:'#555f55', marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:22,
        color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:9, color:'#9ca89c', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

// ── Sección header ────────────────────────────────────────────────
function SecHeader({ title, color = '#264D4A', textColor = '#D6F9F2' }) {
  return (
    <div style={{ background:color, borderRadius:'8px 8px 0 0', padding:'10px 16px', marginTop:24 }}>
      <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:15,
        letterSpacing:1.2, textTransform:'uppercase', color:textColor }}>{title}</span>
    </div>
  )
}

// ── Reporte card ─────────────────────────────────────────────────
function ReportCard({ title, desc, kpis, filters, onExport, accent = '#264D4A' }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, boxShadow:'0 1px 6px rgba(0,0,0,.07)',
      border:'1px solid #e0e4e0', overflow:'hidden' }}>
      <div style={{ borderLeft:`4px solid ${accent}`, padding:'12px 16px', borderBottom:'1px solid #f0f2f0' }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:14,
          letterSpacing:.8, textTransform:'uppercase', color:accent }}>{title}</div>
        <div style={{ fontSize:11, color:'#9ca89c', marginTop:2 }}>{desc}</div>
      </div>
      {filters && (
        <div style={{ padding:'10px 16px', borderBottom:'1px solid #f0f2f0', background:'#fafafa' }}>
          {filters}
        </div>
      )}
      <div style={{ padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {kpis}
        </div>
        <button className="btn" onClick={onExport}
          style={{ background:accent, color:'#fff', border:'none', fontSize:11, fontWeight:700 }}>
          ↓ Exportar Excel
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
export default function MatReportes() {
  const catalogo    = useMatStore(s => s.catalogo)
  const stock       = useMatStore(s => s.stock)
  const bodegas     = useMatStore(s => s.bodegas)
  const sitios      = useMatStore(s => s.sitios)
  const movimientos = useMatStore(s => s.movimientos)
  const despachos   = useMatStore(s => s.despachos)
  const getStock    = useMatStore(s => s.getStock)

  const hwCatalogo     = useHwStore(s => s.hwCatalogo)
  const hwEquipos      = useHwStore(s => s.hwEquipos)
  const hwMovimientos  = useHwStore(s => s.hwMovimientos)

  const [tab, setTab] = useState('mat')

  // Filtros Materiales — Movimientos
  const [matMovFrom, setMatMovFrom] = useState('')
  const [matMovTo,   setMatMovTo]   = useState('')
  const [matMovTipo, setMatMovTipo] = useState('')

  // Filtros HW — Movimientos
  const [hwMovFrom, setHwMovFrom] = useState('')
  const [hwMovTo,   setHwMovTo]   = useState('')
  const [hwMovTipo, setHwMovTipo] = useState('')

  // ── KPIs precalculados ──────────────────────────────────────
  const matKpis = useMemo(() => {
    const totalItems  = catalogo.length
    const bajominimo  = catalogo.filter(c => {
      const s = bodegas.reduce((a, b) => a + (getStock(c.id, b.id) || 0), 0)
      return c.stock_minimo > 0 && s < c.stock_minimo
    }).length
    const valorTotal  = catalogo.reduce((acc, c) => {
      const s = bodegas.reduce((a, b) => a + (getStock(c.id, b.id) || 0), 0)
      return acc + s * (c.costo_unitario || 0)
    }, 0)
    const movFiltrados = movimientos.filter(m =>
      inRange(m.created_at, matMovFrom, matMovTo) &&
      (!matMovTipo || m.tipo === matMovTipo)
    )
    const entradas = movFiltrados.filter(m => m.tipo === 'Entrada').reduce((a, m) => a + (m.cantidad || 0), 0)
    const salidas  = movFiltrados.filter(m => m.tipo === 'Salida').reduce((a, m) => a + (m.cantidad || 0), 0)
    return { totalItems, bajominimo, valorTotal, entradas, salidas, movFiltrados }
  }, [catalogo, bodegas, stock, movimientos, matMovFrom, matMovTo, matMovTipo, getStock])

  const hwKpis = useMemo(() => {
    const enBodega = hwEquipos.filter(e => e.estado === 'en_bodega').length
    const enSitio  = hwEquipos.filter(e => e.estado === 'en_sitio').length
    const total    = hwEquipos.length
    const movFiltrados = hwMovimientos.filter(m =>
      inRange(m.fecha || m.created_at, hwMovFrom, hwMovTo) &&
      (!hwMovTipo || m.tipo === hwMovTipo)
    )
    const entradas = movFiltrados.filter(m => m.tipo === 'ENTRADA').length
    const salidas  = movFiltrados.filter(m => m.tipo === 'SALIDA').length
    return { enBodega, enSitio, total, movFiltrados, entradas, salidas }
  }, [hwEquipos, hwMovimientos, hwMovFrom, hwMovTo, hwMovTipo])

  // ═══════════════════════════════════════════════════════════
  // EXPORTADORES — MATERIALES
  // ═══════════════════════════════════════════════════════════

  function exportStockActual() {
    // Sheet 1: Resumen por material
    const resumen = [['Categoría','Material','Código','Unidad','Stock Mínimo',
      ...bodegas.map(b => b.nombre), 'TOTAL', 'Valor Total', 'Estado']]
    catalogo.filter(c => c.activo !== false).forEach(c => {
      const stocks = bodegas.map(b => getStock(c.id, b.id) || 0)
      const total  = stocks.reduce((a, v) => a + v, 0)
      const valor  = total * (c.costo_unitario || 0)
      const estado = c.stock_minimo > 0 && total < c.stock_minimo ? 'BAJO MÍNIMO' : 'OK'
      resumen.push([c.categoria || '—', c.nombre, c.codigo || '—', c.unidad || '—',
        c.stock_minimo || 0, ...stocks, total, valor, estado])
    })

    // Sheet 2: Por bodega
    const porBodega = [['Bodega','Regional','Material','Código','Categoría','Unidad','Stock']]
    bodegas.forEach(b => {
      catalogo.filter(c => c.activo !== false).forEach(c => {
        const s = getStock(c.id, b.id) || 0
        if (s > 0) porBodega.push([b.nombre, b.regional || '—', c.nombre, c.codigo || '—',
          c.categoria || '—', c.unidad || '—', s])
      })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws(resumen),   'Stock por Material')
    XLSX.utils.book_append_sheet(wb, ws(porBodega), 'Stock por Bodega')
    XLSX.writeFile(wb, `Stock_Materiales_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Reporte Stock generado')
  }

  function exportMovimientos() {
    const rows = [['Fecha','Tipo','Material','Código','Categoría','Unidad',
      'Bodega Origen','Destino','Cantidad','Valor Unitario','Valor Total']]
    matKpis.movFiltrados.forEach(m => {
      const cat = catalogo.find(c => c.id === m.catalogo_id)
      const bod = bodegas.find(b => b.id === m.bodega_id)
      rows.push([
        fmtDate(m.created_at),
        m.tipo || '—',
        cat?.nombre    || '—',
        cat?.codigo    || '—',
        cat?.categoria || '—',
        cat?.unidad    || '—',
        bod?.nombre    || m.origen || '—',
        m.destino      || '—',
        m.cantidad     || 0,
        m.valor_unitario || cat?.costo_unitario || 0,
        m.valor_total  || (m.cantidad * (m.valor_unitario || cat?.costo_unitario || 0)),
      ])
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws(rows), 'Movimientos')
    XLSX.writeFile(wb, `Movimientos_Materiales_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Reporte Movimientos generado')
  }

  function exportDespachos() {
    // Sheet 1: Resumen de despachos
    const resumen = [['N° Documento','Fecha','Bodega','Sitio Destino','Estado','Creado Por']]
    despachos.forEach(d => {
      const bod = bodegas.find(b => b.id === d.bodega_id)
      resumen.push([d.numero_doc || '—', fmtDate(d.fecha || d.created_at),
        bod?.nombre || '—', d.destino || '—', d.status || '—', d.created_by || '—'])
    })

    // Sheet 2: Materiales por sitio
    const porSitio = [['Sitio','Material','Código','Categoría','Unidad','Cantidad','Valor Total','Fecha']]
    sitios.forEach(s => {
      const salidas = movimientos.filter(m =>
        m.tipo === 'Salida' && m.destino?.toLowerCase() === s.nombre?.toLowerCase()
      )
      salidas.forEach(m => {
        const cat = catalogo.find(c => c.id === m.catalogo_id)
        const val = m.valor_total || m.cantidad * (m.valor_unitario || cat?.costo_unitario || 0)
        porSitio.push([s.nombre, cat?.nombre || '—', cat?.codigo || '—',
          cat?.categoria || '—', cat?.unidad || '—', m.cantidad || 0,
          val, fmtDate(m.created_at)])
      })
    })

    // Sheet 3: Resumen financiero por sitio
    const finSitio = [['Sitio','Regional','Total Despachos','Unidades Enviadas','Valor Total TI','Valor Total CW','Valor Total']]
    sitios.forEach(s => {
      const salidas = movimientos.filter(m =>
        m.tipo === 'Salida' && m.destino?.toLowerCase() === s.nombre?.toLowerCase()
      )
      if (salidas.length === 0) return
      const deps = despachos.filter(d => d.destino?.toLowerCase() === s.nombre?.toLowerCase()).length
      const uds  = salidas.reduce((a, m) => a + (m.cantidad || 0), 0)
      const valTI = salidas.filter(m => catalogo.find(c => c.id===m.catalogo_id)?.categoria==='TI')
        .reduce((a, m) => { const cat=catalogo.find(c=>c.id===m.catalogo_id); return a+(m.valor_total||m.cantidad*(m.valor_unitario||cat?.costo_unitario||0)) }, 0)
      const valCW = salidas.filter(m => catalogo.find(c => c.id===m.catalogo_id)?.categoria==='CW')
        .reduce((a, m) => { const cat=catalogo.find(c=>c.id===m.catalogo_id); return a+(m.valor_total||m.cantidad*(m.valor_unitario||cat?.costo_unitario||0)) }, 0)
      const val  = salidas.reduce((a, m) => { const cat=catalogo.find(c=>c.id===m.catalogo_id); return a+(m.valor_total||m.cantidad*(m.valor_unitario||cat?.costo_unitario||0)) }, 0)
      finSitio.push([s.nombre, s.regional || '—', deps, uds, valTI, valCW, val])
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws(resumen),  'Despachos')
    XLSX.utils.book_append_sheet(wb, ws(porSitio), 'Materiales por Sitio')
    XLSX.utils.book_append_sheet(wb, ws(finSitio), 'Resumen Financiero')
    XLSX.writeFile(wb, `Despachos_Materiales_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Reporte Despachos generado')
  }

  function exportCatalogo() {
    const rows = [['Categoría','Nombre','Código','Unidad','Costo Unitario','Stock Mínimo','Activo','Descripción']]
    catalogo.forEach(c => {
      rows.push([c.categoria || '—', c.nombre, c.codigo || '—', c.unidad || '—',
        c.costo_unitario || 0, c.stock_minimo || 0,
        c.activo !== false ? 'Sí' : 'No', c.descripcion || ''])
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws(rows), 'Catálogo')
    XLSX.writeFile(wb, `Catalogo_Materiales_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Catálogo exportado')
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORTADORES — HW NOKIA
  // ═══════════════════════════════════════════════════════════

  function exportInventarioHw() {
    // Sheet 1: Resumen por tipo de equipo
    const ESTADOS = ['en_bodega','en_sitio','en_transito','retornado_nokia','retornado_ss']
    const resumen = [['Tipo Material','Código','Descripción','Aplica Serial',
      'En Bodega','En Sitio','En Tránsito','Retornado Nokia','Retornado SS','TOTAL']]
    hwCatalogo.forEach(cat => {
      const equipos = hwEquipos.filter(e => e.catalogo_id === cat.id)
      const movsSS  = hwMovimientos.filter(m => m.catalogo_id === cat.id && !m.serial)
      let ssStock = 0
      if (cat.aplica_serial === false) {
        const ent = movsSS.filter(m => m.tipo==='ENTRADA').reduce((a,m) => a+(m.cantidad||0), 0)
        const sal = movsSS.filter(m => m.tipo==='SALIDA').reduce((a,m) => a+(m.cantidad||0), 0)
        ssStock = Math.max(0, ent - sal)
      }
      const counts = ESTADOS.map(est => equipos.filter(e => e.estado === est).length)
      counts[0] += ssStock   // sumar sin-serial al en_bodega
      const total = counts.reduce((a, v) => a + v, 0)
      resumen.push([cat.tipo_material, cat.cod_material||'—', cat.descripcion,
        cat.aplica_serial===false?'No':'Sí', ...counts, total])
    })

    // Sheet 2: Equipos con serial (detalle)
    const seriales = [['Descripción','Código','ID Parte','Tipo','Serial','Estado',
      'Ubicación Actual','Condición','Tipo Unidad','Notas','Fecha Creación']]
    hwEquipos.forEach(e => {
      const cat = hwCatalogo.find(c => c.id === e.catalogo_id)
      seriales.push([cat?.descripcion||'—', cat?.cod_material||'—', cat?.id_parte||'—',
        cat?.tipo_material||'—', e.serial||'—', e.estado||'—',
        e.ubicacion_actual||'—', e.condicion||'—', e.log_inv_tipo_unidad||'—',
        e.notas||'', fmtDate(e.created_at)])
    })

    // Sheet 3: Equipos por ubicación
    const porUbicacion = [['Ubicación','Descripción','Código','Serial','Estado','Condición']]
    const ubicaciones = [...new Set(hwEquipos.map(e => e.ubicacion_actual || '(Sin asignar)'))]
    ubicaciones.sort().forEach(ub => {
      hwEquipos.filter(e => (e.ubicacion_actual||'(Sin asignar)') === ub).forEach(e => {
        const cat = hwCatalogo.find(c => c.id === e.catalogo_id)
        porUbicacion.push([ub, cat?.descripcion||'—', cat?.cod_material||'—',
          e.serial||'—', e.estado||'—', e.condicion||'—'])
      })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws(resumen),      'Resumen por Tipo')
    XLSX.utils.book_append_sheet(wb, ws(seriales),     'Equipos con Serial')
    XLSX.utils.book_append_sheet(wb, ws(porUbicacion), 'Por Ubicación')
    XLSX.writeFile(wb, `Inventario_HW_Nokia_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Inventario HW exportado')
  }

  function exportMovimientosHw() {
    const rows = [['Fecha','Tipo','N° Documento','SMP ID','Serial','Descripción Equipo',
      'Cod. Equipo','Origen Tipo','Origen','Destino Tipo','Destino','Cantidad',
      'Tipo Unidad','Creado Por','Notas']]
    hwKpis.movFiltrados.forEach(m => {
      const cat = hwCatalogo.find(c => c.id === m.catalogo_id)
      rows.push([
        fmtDate(m.fecha || m.created_at),
        m.tipo || '—',
        m.so   || '—',
        m.smp_id || '—',
        m.serial || 'Sin serial',
        cat?.descripcion  || '—',
        cat?.cod_material || '—',
        m.origen_tipo || '—',
        m.origen      || '—',
        m.destino_tipo || '—',
        m.destino      || '—',
        m.cantidad     || 1,
        m.log_inv_tipo_unidad || '—',
        m.created_by   || '—',
        m.notas        || '',
      ])
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws(rows), 'Movimientos HW')
    XLSX.writeFile(wb, `Movimientos_HW_Nokia_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('Movimientos HW exportados')
  }

  function exportEquiposPorSitio() {
    const rows = [['Sitio','Descripción Equipo','Código','Tipo','Serial',
      'Estado','Condición','Tipo Unidad']]
    const sitiosHw = [...new Set(
      hwEquipos.filter(e => e.estado === 'en_sitio' && e.ubicacion_actual)
        .map(e => e.ubicacion_actual)
    )].sort()
    sitiosHw.forEach(sitio => {
      hwEquipos.filter(e => e.estado === 'en_sitio' && e.ubicacion_actual === sitio).forEach(e => {
        const cat = hwCatalogo.find(c => c.id === e.catalogo_id)
        rows.push([sitio, cat?.descripcion||'—', cat?.cod_material||'—',
          cat?.tipo_material||'—', e.serial||'—', e.estado, e.condicion||'—',
          e.log_inv_tipo_unidad||'—'])
      })
      // Sin serial en sitio
      hwMovimientos.filter(m =>
        !m.serial && m.tipo==='SALIDA' && m.destino_tipo==='sitio' &&
        m.destino?.toLowerCase() === sitio.toLowerCase()
      ).forEach(m => {
        const cat = hwCatalogo.find(c => c.id === m.catalogo_id)
        rows.push([sitio, cat?.descripcion||'—', cat?.cod_material||'—',
          cat?.tipo_material||'—', 'Sin serial', 'en_sitio', '—', m.log_inv_tipo_unidad||'—'])
      })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws(rows), 'HW por Sitio')
    XLSX.writeFile(wb, `HW_Nokia_por_Sitio_${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast('HW por Sitio exportado')
  }

  // ── Estilos de filtro ────────────────────────────────────────
  const FL = { display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }
  const FC = { fontSize:11 }

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:0, borderBottom:'2px solid #e0e4e0' }}>
        {[['mat','Materiales','#264D4A'],['hw','HW Nokia','#1e3a5f']].map(([k,label,color]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding:'8px 20px', fontSize:12, fontWeight:700, cursor:'pointer',
              fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:.8, textTransform:'uppercase',
              background:'none', border:'none',
              borderBottom: tab===k ? `3px solid ${color}` : '3px solid transparent',
              color: tab===k ? color : '#9ca89c',
              marginBottom:'-2px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ MATERIALES ══════════ */}
      {tab === 'mat' && (
        <div>
          <SecHeader title="Inventario y Stock" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, padding:'14px 0' }}>

            <ReportCard
              title="Stock Actual"
              desc="Stock por material y bodega, alertas de stock mínimo y valor total del inventario."
              accent="#264D4A"
              kpis={<>
                <KPI label="Materiales" value={matKpis.totalItems} color="#264D4A" />
                <KPI label="Bajo Mínimo" value={matKpis.bajominimo} color="#c0392b" />
                <KPI label="Valor Inventario" value={matCop(matKpis.valorTotal)} color="#1a6130" sub="estimado" />
              </>}
              onExport={exportStockActual}
            />

            <ReportCard
              title="Catálogo Completo"
              desc="Listado de todos los materiales con precios, unidades, categorías y stock mínimo."
              accent="#264D4A"
              kpis={<>
                <KPI label="Total Ítems" value={catalogo.length} color="#264D4A" />
                <KPI label="Categoría TI" value={catalogo.filter(c=>c.categoria==='TI').length} color="#1e40af" />
                <KPI label="Categoría CW" value={catalogo.filter(c=>c.categoria==='CW').length} color="#1a6130" />
              </>}
              onExport={exportCatalogo}
            />
          </div>

          <SecHeader title="Movimientos y Despachos" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, padding:'14px 0' }}>

            <ReportCard
              title="Historial de Movimientos"
              desc="Entradas y salidas de materiales filtradas por período y tipo."
              accent="#1a6130"
              filters={
                <div style={FL}>
                  <label style={FC}>Desde</label>
                  <input type="date" className="fc" value={matMovFrom}
                    onChange={e => setMatMovFrom(e.target.value)}
                    style={{ ...FC, maxWidth:140 }} />
                  <label style={FC}>Hasta</label>
                  <input type="date" className="fc" value={matMovTo}
                    onChange={e => setMatMovTo(e.target.value)}
                    style={{ ...FC, maxWidth:140 }} />
                  <select className="fc" value={matMovTipo}
                    onChange={e => setMatMovTipo(e.target.value)}
                    style={{ ...FC, maxWidth:120 }}>
                    <option value="">Todos</option>
                    <option value="Entrada">Entradas</option>
                    <option value="Salida">Salidas</option>
                  </select>
                </div>
              }
              kpis={<>
                <KPI label="Registros" value={matKpis.movFiltrados.length} color="#264D4A" />
                <KPI label="Entradas (uds)" value={matKpis.entradas} color="#1a6130" />
                <KPI label="Salidas (uds)" value={matKpis.salidas} color="#c0392b" />
              </>}
              onExport={exportMovimientos}
            />

            <ReportCard
              title="Despachos por Sitio"
              desc="Despachos realizados con detalle de materiales enviados por sitio de instalación y resumen financiero."
              accent="#1a6130"
              kpis={<>
                <KPI label="Despachos" value={despachos.length} color="#264D4A" />
                <KPI label="Sitios con Materiales"
                  value={sitios.filter(s => movimientos.some(m =>
                    m.tipo==='Salida' && m.destino?.toLowerCase()===s.nombre?.toLowerCase()
                  )).length}
                  color="#1a6130" />
                <KPI label="Total Sitios" value={sitios.length} color="#9ca89c" />
              </>}
              onExport={exportDespachos}
            />
          </div>
        </div>
      )}

      {/* ══════════ HW NOKIA ══════════ */}
      {tab === 'hw' && (
        <div>
          <SecHeader title="Inventario HW Nokia" color="#1e3a5f" textColor="#EFF5FE" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, padding:'14px 0' }}>

            <ReportCard
              title="Inventario por Tipo de Equipo"
              desc="Resumen de todos los tipos de equipo con conteo por estado: bodega, sitio, tránsito, retornado. Incluye detalle por serial y por ubicación."
              accent="#1e3a5f"
              kpis={<>
                <KPI label="Tipos Equipo" value={hwCatalogo.length} color="#1e3a5f" />
                <KPI label="Total Unidades" value={hwEquipos.length} color="#264D4A" />
                <KPI label="En Bodega" value={hwKpis.enBodega} color="#1a6130" />
                <KPI label="En Sitio" value={hwKpis.enSitio} color="#1e40af" />
              </>}
              onExport={exportInventarioHw}
            />

            <ReportCard
              title="HW Nokia por Sitio"
              desc="Equipos actualmente instalados en cada sitio de instalación, incluyendo serial, tipo y condición."
              accent="#1e3a5f"
              kpis={<>
                <KPI label="En Sitio" value={hwKpis.enSitio} color="#1e40af" />
                <KPI label="Sitios con HW"
                  value={[...new Set(hwEquipos.filter(e=>e.estado==='en_sitio'&&e.ubicacion_actual).map(e=>e.ubicacion_actual))].length}
                  color="#1e3a5f" />
                <KPI label="Tipos en campo"
                  value={[...new Set(hwEquipos.filter(e=>e.estado==='en_sitio').map(e=>e.catalogo_id))].length}
                  color="#264D4A" />
              </>}
              onExport={exportEquiposPorSitio}
            />
          </div>

          <SecHeader title="Movimientos HW Nokia" color="#1e3a5f" textColor="#EFF5FE" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, padding:'14px 0' }}>

            <ReportCard
              title="Historial de Movimientos HW"
              desc="Entradas y salidas de equipos HW Nokia filtradas por período, con número de documento, serial, origen y destino."
              accent="#234B72"
              filters={
                <div style={FL}>
                  <label style={FC}>Desde</label>
                  <input type="date" className="fc" value={hwMovFrom}
                    onChange={e => setHwMovFrom(e.target.value)}
                    style={{ ...FC, maxWidth:140 }} />
                  <label style={FC}>Hasta</label>
                  <input type="date" className="fc" value={hwMovTo}
                    onChange={e => setHwMovTo(e.target.value)}
                    style={{ ...FC, maxWidth:140 }} />
                  <select className="fc" value={hwMovTipo}
                    onChange={e => setHwMovTipo(e.target.value)}
                    style={{ ...FC, maxWidth:120 }}>
                    <option value="">Todos</option>
                    <option value="ENTRADA">Entradas</option>
                    <option value="SALIDA">Salidas</option>
                  </select>
                </div>
              }
              kpis={<>
                <KPI label="Registros" value={hwKpis.movFiltrados.length} color="#1e3a5f" />
                <KPI label="Entradas" value={hwKpis.entradas} color="#1a6130" />
                <KPI label="Salidas" value={hwKpis.salidas} color="#c0392b" />
              </>}
              onExport={exportMovimientosHw}
            />

            <div style={{ background:'#f8fafb', borderRadius:8, border:'1px dashed #c0cfe0',
              display:'flex', alignItems:'center', justifyContent:'center',
              minHeight:160, color:'#9ca89c', fontSize:12, padding:20, textAlign:'center' }}>
              <div>
                <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
                <div style={{ fontWeight:600, marginBottom:4 }}>Próximamente</div>
                <div>Reporte de auditoría y trazabilidad por serial</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
