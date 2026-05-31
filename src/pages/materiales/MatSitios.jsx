import React, { useState, useMemo, useEffect } from 'react'
import { useMatStore, matCop } from '../../store/useMatStore'
import { useHwStore } from '../../store/useHwStore'
import { useAuthStore } from '../../store/authStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { useConfirm } from '../../components/ConfirmModal'
import { showToast } from '../../components/Toast'

const HW_ESTADO_CFG = {
  en_bodega:       { label:'En Bodega',      bg:'#d4edda', color:'#1a6130' },
  en_sitio:        { label:'En Sitio',        bg:'#dbeafe', color:'#1e40af' },
  en_transito:     { label:'En Tránsito',     bg:'#fef3cd', color:'#856404' },
  retornado_nokia: { label:'Retornado Nokia', bg:'#f0f0f0', color:'#555f55' },
  retornado_ss:    { label:'Retornado SS',    bg:'#f5f0ff', color:'#6b21a8' },
}

const REGIONALES = ['Sur-Occidente','Norte','Centro','Oriente','Antioquia','Caribe']
const MTS_CATS   = new Set(['1009196', '1043056'])

export default function MatSitios() {
  const sitios       = useMatStore(s => s.sitios)
  const movimientos  = useMatStore(s => s.movimientos)
  const despachos    = useMatStore(s => s.despachos)
  const catalogo     = useMatStore(s => s.catalogo)
  const pendientes   = useMatStore(s => s.pendientes)
  const deleteSitio  = useMatStore(s => s.deleteSitio)
  const saveSitio    = useMatStore(s => s.saveSitio)
  const hwEquipos     = useHwStore(s => s.hwEquipos)
  const hwCatalogo    = useHwStore(s => s.hwCatalogo)
  const hwMovimientos = useHwStore(s => s.hwMovimientos)
  const hwLogInversa  = useHwStore(s => s.hwLogInversa)
  const user         = useAuthStore(s => s.user)
  const navigate    = useNavigate()
  const location    = useLocation()
  const { confirm, ConfirmModalUI } = useConfirm()

  const [search,        setSearch]        = useState(location.state?.search || '')
  const [filReg,        setFilReg]        = useState('')
  const [expanded,      setExpanded]      = useState(null)
  const [togglingId,    setTogglingId]    = useState(null)

  // Auto-expandir el sitio si viene desde un link directo
  useEffect(() => {
    const s = location.state?.search
    if (!s) return
    const match = sitios.find(x => x.nombre?.toLowerCase() === s.toLowerCase())
    if (match) setExpanded(match.id ?? match.nombre)
  }, [location.state?.search, sitios])

  const canEdit = ['admin','coordinador','logistica'].includes(user?.role)

  // Sitios que tienen registros en hw_log_inversa
  const sitiosConLI = useMemo(() =>
    new Set(hwLogInversa.map(r => r.sitio?.toLowerCase()).filter(Boolean))
  , [hwLogInversa])

  async function toggleLogInversa(s, e) {
    e.stopPropagation()
    if (!canEdit || togglingId) return
    setTogglingId(s.id ?? s.nombre)
    try { await saveSitio({ ...s, aplica_log_inversa: !s.aplica_log_inversa }) }
    catch (err) { showToast('Error: ' + err.message, 'error') }
    finally { setTogglingId(null) }
  }

  const sitioData = useMemo(() => {
    const data = {}
    for (const s of sitios) {
      const key = s.id ?? s.nombre
      const salidas = movimientos.filter(m =>
        m.tipo === 'Salida' && (
          (m.destino && m.destino.toLowerCase() === s.nombre.toLowerCase()) ||
          m.sitio_id === s.id
        )
      )
      const todasMovs = movimientos.filter(m =>
        (m.destino && m.destino.toLowerCase() === s.nombre.toLowerCase()) ||
        m.sitio_id === s.id
      )
      const despCount = despachos.filter(d =>
        d.destino && d.destino.toLowerCase() === s.nombre.toLowerCase()
      ).length
      const valorTotal = salidas.reduce((a, m) =>
        a + (m.valor_total || m.cantidad * (m.valor_unitario || 0) || 0), 0)

      const byMaterial = {}
      for (const m of salidas) {
        const mk = m.catalogo_id
        if (!byMaterial[mk]) {
          const cat = catalogo.find(c => c.id === mk)
          byMaterial[mk] = {
            catalogo_id:    mk,
            nombre:         cat?.nombre    || '—',
            codigo:         cat?.codigo    || '—',
            unidad:         cat?.unidad    || '—',
            categoria:      cat?.categoria || '—',
            precioUnitario: cat?.costo_unitario || m.valor_unitario || 0,
            cantidad:       0,
            total:          0,
            fechaUltimo:    null,
            fechaEnvio:     m.fecha || m.created_at,
          }
        }
        byMaterial[mk].cantidad += m.cantidad
        byMaterial[mk].total    += m.cantidad * (byMaterial[mk].precioUnitario)
        const mf = m.created_at || m.fecha
        if (!byMaterial[mk].fechaUltimo || mf > byMaterial[mk].fechaUltimo) byMaterial[mk].fechaUltimo = mf
        if (!byMaterial[mk].fechaEnvio  || mf < byMaterial[mk].fechaEnvio)  byMaterial[mk].fechaEnvio  = mf
      }

      data[key] = {
        movCount:   todasMovs.length,
        despCount,
        valorTotal,
        materiales: Object.values(byMaterial).sort((a, b) => b.total - a.total),
      }
    }
    return data
  }, [sitios, movimientos, despachos, catalogo])

  const filtered = useMemo(() => sitios.filter(s => {
    const q = search.toLowerCase()
    if (filReg && s.regional !== filReg) return false
    if (!q) return true
    if (`${s.nombre} ${s.regional}`.toLowerCase().includes(q)) return true
    const sNombre = s.nombre.toLowerCase()
    if (hwEquipos.some(e => e.ubicacion_actual?.toLowerCase() === sNombre && e.so?.toLowerCase().includes(q))) return true
    if (hwMovimientos.some(m => m.tipo === 'SALIDA' && !m.serial && m.destino?.toLowerCase() === sNombre && m.so?.toLowerCase().includes(q))) return true
    return false
  }), [sitios, search, filReg, hwEquipos, hwMovimientos])

  async function handleDelete(s) {
    const ok = await confirm('Eliminar Sitio', `¿Eliminar "${s.nombre}"?`)
    if (!ok) return
    try { await deleteSitio(s.id, s.nombre); showToast('Sitio eliminado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  function fmtFecha(f) {
    if (!f) return '—'
    return String(f).slice(0, 10)
  }

  return (
    <div>
      <ConfirmModalUI />

      <div className="card">
        <div className="card-h" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2>Sitios de Instalación</h2>
        </div>

        <div className="card-b">
          {/* ── KPIs ── */}
          {(() => {
            const activos      = sitios.filter(s => (sitioData[s.id ?? s.nombre]?.movCount || 0) > 0).length
            const conDespachos = sitios.filter(s => (sitioData[s.id ?? s.nombre]?.despCount || 0) > 0).length
            const conPendientes = new Set(pendientes.map(p => p.sitio?.toLowerCase()).filter(Boolean)).size
            const conLI        = new Set(hwLogInversa.map(r => r.sitio?.toLowerCase()).filter(Boolean)).size
            return (
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                {[
                  { label:'Sitios Activos',       value:activos,       bg:'#d1fae5', color:'#065f46' },
                  { label:'Con Despachos',         value:conDespachos,  bg:'#dbeafe', color:'#1e40af' },
                  { label:'Con Pendientes',        value:conPendientes, bg:'#fef3c7', color:'#92400e' },
                  { label:'Con Log. Inversa',      value:conLI,         bg:'#f3e8ff', color:'#6b21a8' },
                ].map(({ label, value, bg, color }) => (
                  <div key={label} style={{ background:bg, borderRadius:10, padding:'10px 18px', flex:1, minWidth:110 }}>
                    <div style={{ fontSize:9, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:28, fontWeight:700, color, fontFamily:"'Barlow Condensed',sans-serif" }}>{value}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <input className="fc" placeholder="Buscar sitio…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:180 }} />
            <select className="fc" value={filReg} onChange={e => setFilReg(e.target.value)} style={{ maxWidth:200 }}>
              <option value="">Todas las regionales</option>
              {REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="tbl-scroll">
            <table className="tbl tbl-mat" style={{ borderCollapse:'collapse', width:'100%' }}>
              <thead>
                <tr>
                  <th style={{ width:36 }}>#</th>
                  <th>SITIO</th>
                  <th>TIPO DE CIUDAD</th>
                  <th>REGIONAL</th>
                  <th style={{ textAlign:'right' }}>MOVIMIENTOS</th>
                  <th style={{ textAlign:'right' }}>IMPORTE</th>
                  <th>STATUS</th>
                  <th>LOG. INVERSA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign:'center', padding:32, color:'#9ca89c' }}>
                      Sin sitios registrados. Los sitios se crean automáticamente al realizar un despacho.
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => {
                  const rowKey = s.id ?? s.nombre ?? i
                  const sd     = sitioData[rowKey] || sitioData[s.nombre] || { movCount:0, despCount:0, valorTotal:0, materiales:[] }
                  const isOpen = search ? true : expanded === rowKey
                  const hasMovs = sd.movCount > 0

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        style={{ background: isOpen ? '#f0fdf4' : undefined, borderBottom: isOpen ? 'none' : undefined, cursor:'pointer' }}
                        onClick={() => setExpanded(isOpen ? null : rowKey)}
                      >
                        <td style={{ color:'#9ca89c', fontSize:11 }}>{i + 1}</td>
                        <td style={{ fontWeight:700 }}>
                          <span style={{ marginRight:6, fontSize:10, color:'#6b7280' }}>{isOpen ? '▼' : '▶'}</span>
                          {s.nombre}
                          {(() => {
                            const pend = pendientes.filter(p => p.sitio?.toLowerCase() === s.nombre?.toLowerCase())
                            if (!pend.length) return null
                            return (
                              <span title={`${pend.length} ítem(s) pendiente(s) por stock insuficiente`}
                                style={{ marginLeft:6, display:'inline-block', padding:'1px 7px', borderRadius:10,
                                  fontSize:9, fontWeight:800, background:'#fef3cd', color:'#92400e',
                                  border:'1px solid #fbbf24', verticalAlign:'middle', cursor:'default' }}>
                                ⏳ {pend.length} pendiente{pend.length > 1 ? 's' : ''}
                              </span>
                            )
                          })()}
                        </td>
                        <td>
                          {s.tipo_cw
                            ? <span className="badge" style={{ background:'#eff6ff', color:'#1e40af' }}>{s.tipo_cw}</span>
                            : '—'}
                        </td>
                        <td style={{ color:'#9ca89c', fontSize:11 }}>{s.regional}</td>
                        <td style={{ textAlign:'right', fontWeight:700 }}>{sd.movCount}</td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'#264D4A' }}>{matCop(sd.valorTotal)}</td>
                        <td>
                          {hasMovs
                            ? <span className="badge" style={{ background:'#d4edda', color:'#1a6130' }}>Activo</span>
                            : <span className="badge" style={{ background:'#fde8e7', color:'#c0392b' }}>Sin Materiales</span>
                          }
                        </td>
                        <td style={{ whiteSpace:'nowrap' }} onClick={e => e.stopPropagation()}>
                          {(() => {
                            const nombre = s.nombre?.toLowerCase()
                            const tieneData = sitiosConLI.has(nombre)
                            const aplica    = s.aplica_log_inversa
                            const toggling  = togglingId === (s.id ?? s.nombre)
                            return (
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                {/* Badge estado */}
                                {tieneData
                                  ? <span onClick={e => { e.stopPropagation(); navigate(`/materiales/hw/log-inversa?sitio=${encodeURIComponent(s.nombre)}`) }}
                                      style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'#f3e8ff', color:'#6b21a8', whiteSpace:'nowrap', cursor:'pointer', textDecoration:'underline dotted' }}>🟢 Con datos</span>
                                  : aplica
                                    ? <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'#fef3c7', color:'#92400e', whiteSpace:'nowrap' }}>🟡 Pendiente</span>
                                    : aplica === false
                                      ? <span style={{ fontSize:9, color:'#9ca3af' }}>N/A</span>
                                      : <span style={{ fontSize:9, color:'#d1d5db' }}>—</span>
                                }
                                {/* Toggle aplica */}
                                {canEdit && (
                                  <button
                                    onClick={e => toggleLogInversa(s, e)}
                                    disabled={toggling}
                                    title={aplica ? 'Desmarcar: no aplica Log. Inversa' : 'Marcar: aplica Log. Inversa'}
                                    style={{ padding:'2px 8px', fontSize:9, fontWeight:700, borderRadius:10, border:`1px solid ${aplica ? '#6b21a8' : '#d1d5db'}`, background: aplica ? '#f3e8ff' : '#f9fafb', color: aplica ? '#6b21a8' : '#9ca3af', cursor:toggling ? 'wait' : 'pointer', transition:'all .15s' }}
                                  >
                                    {aplica ? 'ON' : 'OFF'}
                                  </button>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                        <td style={{ whiteSpace:'nowrap' }} onClick={e => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(s)}
                              style={{ padding:'3px 8px', fontSize:10, fontWeight:600, borderRadius:20, border:'none', background:'#922b21', color:'#fff', cursor:'pointer' }}>
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={9} style={{ padding:0, borderTop:'2px solid #1a9c1a' }}>
                            <div style={{ background:'#f8fdf8' }}>
                              <div style={{ background:'#264D4A', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:'#D6F9F2', letterSpacing:1, textTransform:'uppercase' }}>
                                  Materiales: {s.nombre}
                                </span>
                                <span style={{ fontSize:10, color:'#D6F9F2', opacity:.7 }}>
                                  Materiales enviados a este sitio según historial de salidas
                                </span>
                              </div>

                              {/* ── Pendientes por stock insuficiente ── */}
                              {(() => {
                                const sitePend = pendientes.filter(p => p.sitio?.toLowerCase() === s.nombre?.toLowerCase())
                                if (!sitePend.length) return null
                                return (
                                  <div style={{ borderBottom:'2px solid #fbbf24', background:'#fffbeb', padding:'10px 16px' }}>
                                    <div style={{ fontSize:11, fontWeight:800, color:'#92400e', marginBottom:8, letterSpacing:.5 }}>
                                      ⏳ MATERIALES PENDIENTES POR STOCK INSUFICIENTE
                                    </div>
                                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                      <thead>
                                        <tr style={{ background:'#fef3cd' }}>
                                          {['MATERIAL','CÓDIGO','CANT. PENDIENTE','REF. DESPACHO','FECHA'].map(h => (
                                            <th key={h} style={{ padding:'5px 10px', color:'#92400e', fontWeight:700, fontSize:9, textAlign:'left' }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sitePend.map(p => {
                                          const cat = catalogo.find(c => c.id === p.catalogo_id)
                                          return (
                                            <tr key={p.id} style={{ borderBottom:'1px solid #fde68a' }}>
                                              <td style={{ padding:'5px 10px', fontWeight:600, color:'#78350f' }}>{cat?.nombre || '—'}</td>
                                              <td style={{ padding:'5px 10px', color:'#92400e', fontFamily:"'Barlow Condensed',sans-serif" }}>{cat?.codigo || '—'}</td>
                                              <td style={{ padding:'5px 10px', fontWeight:800, color:'#c0392b' }}>{p.cantidad} {cat?.unidad || 'und.'}</td>
                                              <td style={{ padding:'5px 10px', color:'#92400e', fontSize:10 }}>{p.despacho_ref || '—'}</td>
                                              <td style={{ padding:'5px 10px', color:'#92400e', fontSize:10 }}>{String(p.fecha || '').slice(0,10)}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              })()}

                              {sd.materiales.length === 0 ? (
                                <div style={{ textAlign:'center', padding:'20px 16px', color:'#9ca89c', fontSize:12 }}>
                                  No hay salidas registradas hacia este sitio
                                </div>
                              ) : (() => {
                                const matTI  = sd.materiales.filter(m => m.categoria === 'TI')
                                const matCW  = sd.materiales.filter(m => m.categoria === 'CW')
                                const matOth = sd.materiales.filter(m => m.categoria !== 'TI' && m.categoria !== 'CW')
                                const COLS   = ['NOMBRE','CÓDIGO','UM','CANTIDAD','PRECIO UNITARIO','TOTAL','FECHA ÚLTIMO MOV.','FECHA ENVÍO']
                                const NUM    = ['CANTIDAD','PRECIO UNITARIO','TOTAL']

                                function MatRow({ m, idx }) {
                                  return (
                                    <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f0fdf4', borderBottom:'1px solid #e8f5e8' }}>
                                      <td style={{ padding:'6px 10px', fontWeight:600 }}>{m.nombre}</td>
                                      <td style={{ padding:'6px 10px', color:'#9ca89c', fontFamily:"'Barlow Condensed',sans-serif" }}>{m.codigo}</td>
                                      <td style={{ padding:'6px 10px', color:'#9ca89c' }}>{m.unidad}</td>
                                      <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700 }}>{m.cantidad}</td>
                                      <td style={{ padding:'6px 10px', textAlign:'right', color:'#555f55' }}>{matCop(m.precioUnitario)}</td>
                                      <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#264D4A' }}>{matCop(m.total)}</td>
                                      <td style={{ padding:'6px 10px', color:'#9ca89c', whiteSpace:'nowrap' }}>{fmtFecha(m.fechaUltimo)}</td>
                                      <td style={{ padding:'6px 10px', color:'#9ca89c', whiteSpace:'nowrap' }}>{fmtFecha(m.fechaEnvio)}</td>
                                    </tr>
                                  )
                                }

                                function SectionBlock({ label, items, accentBg, accentColor }) {
                                  if (items.length === 0) return null
                                  const secTotal = items.reduce((a, m) => a + m.total, 0)
                                  const secUnits = items.reduce((a, m) => a + m.cantidad, 0)
                                  return (
                                    <>
                                      {/* Sección header */}
                                      <tr>
                                        <td colSpan={8} style={{ padding:'5px 10px', background: accentBg, color: accentColor,
                                          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11,
                                          letterSpacing:1, textTransform:'uppercase', borderTop:'2px solid ' + accentColor }}>
                                          {label}
                                        </td>
                                      </tr>
                                      {items.map((m, idx) => <MatRow key={m.catalogo_id} m={m} idx={idx} />)}
                                      {/* Subtotal */}
                                      <tr style={{ background: accentBg }}>
                                        <td colSpan={3} style={{ padding:'5px 10px', fontSize:10, fontWeight:700, color: accentColor }}>
                                          Total {label} · {secUnits} uds.
                                        </td>
                                        <td />
                                        <td />
                                        <td style={{ padding:'5px 10px', textAlign:'right', fontWeight:800, fontSize:12, color: accentColor }}>
                                          {matCop(secTotal)}
                                        </td>
                                        <td colSpan={2} />
                                      </tr>
                                    </>
                                  )
                                }

                                return (
                                  <div style={{ overflowX:'auto' }}>
                                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                      <thead>
                                        <tr style={{ background:'#f0f7f0' }}>
                                          {COLS.map(h => (
                                            <th key={h} style={{ padding:'6px 10px', color:'#264D4A', fontWeight:700, fontSize:10,
                                              textAlign: NUM.includes(h) ? 'right' : 'left', whiteSpace:'nowrap',
                                              borderBottom:'2px solid #c8e6c8' }}>
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <SectionBlock label="TI" items={matTI}  accentBg="#f0fdf4" accentColor="#166534" />
                                        <SectionBlock label="CW" items={matCW}  accentBg="#eff6ff" accentColor="#1e40af" />
                                        <SectionBlock label="Otros" items={matOth} accentBg="#fafafa" accentColor="#555f55" />
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              })()}

                              {(() => {
                                const hwTotal = hwEquipos.filter(e =>
                                  e.ubicacion_actual && e.ubicacion_actual.toLowerCase() === s.nombre.toLowerCase()
                                ).length + hwMovimientos.filter(m =>
                                  m.tipo === 'SALIDA' && !m.serial &&
                                  m.destino && m.destino.toLowerCase() === s.nombre.toLowerCase()
                                ).reduce((a, m) => a + (m.cantidad || 0), 0)
                                return (
                              <div style={{ padding:'8px 16px', background:'#e8f5e8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div style={{ fontSize:10, color:'#264D4A', fontWeight:700 }}>
                                  DESPACHOS RECIBIDOS: {sd.despCount}
                                  {hwTotal > 0 && (
                                    <span style={{ marginLeft:16 }}>
                                      HW Nokia (TI): {hwTotal} uds.
                                    </span>
                                  )}
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:'#166534' }}>
                                    Total TI: {matCop(sd.materiales.filter(m => m.categoria === 'TI').reduce((a, m) => a + m.total, 0))}
                                  </span>
                                  <span style={{ fontSize:11, fontWeight:700, color:'#1e40af' }}>
                                    Total CW: {matCop(sd.materiales.filter(m => m.categoria === 'CW').reduce((a, m) => a + m.total, 0))}
                                  </span>
                                  <span style={{ fontSize:11, fontWeight:800, color:'#264D4A' }}>
                                    Total: {matCop(sd.materiales.reduce((a, m) => a + m.total, 0))}
                                  </span>
                                  <button
                                    onClick={() => navigate('/materiales/inventario')}
                                    style={{ padding:'4px 12px', fontSize:10, fontWeight:700, borderRadius:20, border:'1.5px solid #1a9c1a', background:'#fff', color:'#1a9c1a', cursor:'pointer' }}>
                                    Ir a Inventario
                                  </button>
                                </div>
                              </div>
                                )
                              })()}

                              {/* ── HW Nokia en este sitio ── */}
                              {(() => {
                                // Seriales con tracking individual
                                const hwEnSitio = hwEquipos.filter(e =>
                                  e.ubicacion_actual && e.ubicacion_actual.toLowerCase() === s.nombre.toLowerCase()
                                )
                                // Sin serial: agrupar salidas HW a este sitio por tipo de equipo
                                const movsSinSerial = hwMovimientos.filter(m =>
                                  m.tipo === 'SALIDA' && !m.serial &&
                                  m.destino && m.destino.toLowerCase() === s.nombre.toLowerCase()
                                )
                                const ssByCat = {}
                                movsSinSerial.forEach(m => {
                                  if (!ssByCat[m.catalogo_id]) {
                                    ssByCat[m.catalogo_id] = { cat: hwCatalogo.find(c => c.id === m.catalogo_id), cantidad: 0, sos: [] }
                                  }
                                  ssByCat[m.catalogo_id].cantidad += (m.cantidad || 0)
                                  if (m.so && !ssByCat[m.catalogo_id].sos.includes(m.so)) ssByCat[m.catalogo_id].sos.push(m.so)
                                })
                                const ssItems = Object.values(ssByCat)
                                const totalHW = hwEnSitio.length + ssItems.reduce((a, x) => a + x.cantidad, 0)

                                return (
                                  <div>
                                    <div style={{ background:'#234B72', padding:'6px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'2px solid #1d4ed8' }}>
                                      <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:400, fontSize:12, color:'#EFF5FE', letterSpacing:1, textTransform:'uppercase' }}>
                                        HW Nokia en sitio ({totalHW} unid.)
                                      </span>
                                      <button
                                        onClick={() => navigate('/materiales/hw/inventario')}
                                        style={{ padding:'3px 10px', fontSize:10, fontWeight:700, borderRadius:20, border:'none', background:'#F0F7FE', color:'#1E37A6', cursor:'pointer' }}>
                                        Ver Inventario HW
                                      </button>
                                    </div>

                                    {totalHW === 0 ? (
                                      <div style={{ textAlign:'center', padding:'14px 16px', color:'#9ca89c', fontSize:11, background:'#f8f8ff' }}>
                                        No hay equipos HW registrados en este sitio
                                      </div>
                                    ) : (
                                      <div style={{ background:'#f8f8ff', overflowX:'auto' }}>
                                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                          <thead>
                                            <tr style={{ background:'#eff6ff' }}>
                                              {['SERIAL','SO','CÓD. EQUIPO','DESCRIPCIÓN','CANTIDAD','ESTADO','CONDICIÓN'].map(h => (
                                                <th key={h} style={{ padding:'5px 10px', color:'#1e40af', fontWeight:700, fontSize:10, textAlign:'left', borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap' }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {/* Seriales individuales */}
                                            {hwEnSitio.map((e, idx) => {
                                              const cat = hwCatalogo.find(c => c.id === e.catalogo_id)
                                              const est = HW_ESTADO_CFG[e.estado] || HW_ESTADO_CFG.en_bodega
                                              return (
                                                <tr key={e.id} style={{ background: (idx) % 2 === 0 ? '#fff' : '#f0f4ff', borderBottom:'1px solid #dbeafe' }}>
                                                  <td style={{ padding:'5px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:'#1e40af' }}>{e.serial}</td>
                                                  <td style={{ padding:'5px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:600, color:'#144E4A' }}>
                                                    {e.so || <span style={{ color:'#9ca89c' }}>—</span>}
                                                  </td>
                                                  <td style={{ padding:'5px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:'#264D4A' }}>{cat?.cod_material || '—'}</td>
                                                  <td style={{ padding:'5px 10px', fontWeight:600 }}>{cat?.descripcion || '—'}</td>
                                                  <td style={{ padding:'5px 10px', fontWeight:700, textAlign:'center' }}>1</td>
                                                  <td style={{ padding:'5px 10px' }}>
                                                    <span className="badge" style={{ background:est.bg, color:est.color, fontSize:9 }}>{est.label}</span>
                                                  </td>
                                                  <td style={{ padding:'5px 10px', color:'#9ca89c', textTransform:'capitalize' }}>{e.condicion}</td>
                                                </tr>
                                              )
                                            })}
                                            {/* Sin serial — mismas columnas, SERIAL = "No Aplica" */}
                                            {ssItems.map((x, idx) => (
                                              <tr key={x.cat?.id ?? idx} style={{ background: (hwEnSitio.length + idx) % 2 === 0 ? '#fff' : '#f0f4ff', borderBottom:'1px solid #dbeafe' }}>
                                                <td style={{ padding:'5px 10px', fontSize:9, fontStyle:'italic', color:'#9ca89c' }}>No Aplica</td>
                                                <td style={{ padding:'5px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:'#144E4A' }}>
                                                  {x.sos.length > 0
                                                    ? (x.sos.length > 2 ? `${x.sos.slice(0,2).join(', ')}…` : x.sos.join(', '))
                                                    : <span style={{ color:'#9ca89c' }}>—</span>}
                                                </td>
                                                <td style={{ padding:'5px 10px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:'#264D4A' }}>{x.cat?.cod_material || '—'}</td>
                                                <td style={{ padding:'5px 10px', fontWeight:600 }}>{x.cat?.descripcion || '—'}</td>
                                                <td style={{ padding:'5px 10px', fontWeight:800, fontSize:13, color:'#264D4A', textAlign:'center' }}>
                                                  {x.cantidad}{MTS_CATS.has(String(x.cat?.cod_material)) && <span style={{ fontWeight:400, fontSize:10, color:'#9ca89c', marginLeft:2 }}>mts</span>}
                                                </td>
                                                <td style={{ padding:'5px 10px' }}>
                                                  <span className="badge" style={{ background:'#dbeafe', color:'#1e40af', fontSize:9 }}>En Sitio</span>
                                                </td>
                                                <td style={{ padding:'5px 10px', color:'#9ca89c' }}>—</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
