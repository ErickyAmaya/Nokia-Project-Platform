import { useState, useMemo, useEffect } from 'react'
import { useFactStore } from '../../store/useFactStore'
import { useAppStore }  from '../../store/useAppStore'
import { usePagosStore } from '../../store/usePagosStore'
import { calcSitio }    from '../../lib/calcSitio'
import { showToast }    from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'

const HITOS = [
  { key: 'desplazamiento', label: 'Desplazamiento', pct: 10 },
  { key: 'mos',            label: 'MOS',            pct: 20 },
  { key: 'integracion',    label: 'Integración',    pct: 50 },
  { key: 'aceptacion',     label: 'Aceptación',     pct: 20 },
]

function fmtCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0)
}

function MiniBar({ pct }) {
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#3b82f6' : '#d1d5db'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 64, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: 5, borderRadius: 3, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color, minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

function RegPanel({ site, hitoKey, formData, onFormChange, onRegistrar, onClose, allPagos }) {
  const hito = site.hitosData.find(h => h.key === hitoKey)
  if (!hito) return null

  const pagadoAnterior = allPagos
    .filter(p => p.sitio_nombre === site.nombre)
    .reduce((s, p) => s + (p.valor || 0), 0)

  const valor      = Number(formData.valor) || 0
  const isAjustado = valor > 0 && Math.round(valor) !== Math.round(hito.valorSugerido)
  const saldoTras  = site.totalSubc - pagadoAnterior - valor
  const superaTope = saldoTras < -(site.totalSubc * 0.001)
  const canSubmit  = valor > 0 && !!formData.fecha && (!isAjustado || !!formData.notas?.trim()) && !superaTope

  const panelBg     = superaTope ? '#fffbeb' : '#f0f7f0'
  const panelBorder = superaTope ? '#fde68a' : '#d4e4d4'
  const titleColor  = superaTope ? '#92400e' : '#144E4A'

  return (
    <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 10, padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: titleColor, marginBottom: 12 }}>
        Registrar pago — {hito.label} ({hito.pct}%)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#617561', marginBottom: 3 }}>
            Valor sugerido ({hito.pct}% de SubC)
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#144E4A', padding: '5px 0' }}>{fmtCOP(hito.valorSugerido)}</div>
        </div>
        <div>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#617561', display: 'block', marginBottom: 3 }}>Fecha de pago</label>
          <input
            type="date" className="fc"
            value={formData.fecha || ''}
            onChange={e => onFormChange('fecha', e.target.value)}
            style={{ width: '100%', fontSize: 11 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#617561', display: 'block', marginBottom: 3 }}>
          Valor a registrar (COP)
          <span style={{ fontWeight: 400, fontSize: 8, textTransform: 'none', letterSpacing: 0, color: '#9ca89c', marginLeft: 6 }}>editable si hay ajuste</span>
        </label>
        <input
          type="number" className="fc"
          value={formData.valor || ''}
          onChange={e => onFormChange('valor', e.target.value)}
          style={{ width: '100%', fontWeight: 700, fontSize: 12, borderColor: isAjustado ? '#f59e0b' : undefined }}
        />
      </div>

      {isAjustado && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 9, background: '#fef3c7', color: '#b45309', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
              ⚠ Valor ajustado: {valor > hito.valorSugerido ? '+' : ''}{fmtCOP(valor - hito.valorSugerido)} vs sugerido
            </span>
            <span style={{ fontSize: 9, color: '#b45309' }}>Se requiere comentario obligatorio</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#617561', display: 'block', marginBottom: 3 }}>
              Motivo del ajuste <span style={{ color: '#c0392b' }}>*</span>
            </label>
            <textarea
              className="fc" rows={2}
              value={formData.notas || ''}
              onChange={e => onFormChange('notas', e.target.value)}
              placeholder="Ej: Acuerdo con LC por trabajo adicional no contemplado en el Liquidador…"
              style={{ width: '100%', resize: 'none', fontSize: 11 }}
            />
          </div>
        </>
      )}

      {superaTope && (
        <div style={{ display: 'flex', gap: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: '#991b1b' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⛔</span>
          <div>
            <strong>El total de pagos superaría el valor del Liquidador.</strong><br />
            Pagado anterior + este pago = {fmtCOP(pagadoAnterior + valor)}, superando el Liquidador ({fmtCOP(site.totalSubc)}) en {fmtCOP(Math.abs(saldoTras))}.<br />
            <span style={{ display: 'block', marginTop: 4 }}>
              Considera agregar un Adicional en el Liquidador para cubrir esta diferencia.
            </span>
          </div>
        </div>
      )}

      {/* Saldo en tiempo real */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 12px', background: '#f8faf8', borderRadius: 7, border: '1px solid #e0e4e0', marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { lbl: 'Total Liquidador', val: fmtCOP(site.totalSubc),  color: '#166534' },
          { lbl: 'Pagado anterior',  val: fmtCOP(pagadoAnterior),  color: '#b45309' },
          { lbl: 'Este pago',        val: fmtCOP(valor),           color: '#b45309' },
          { lbl: 'Saldo tras pago',  val: fmtCOP(saldoTras) + (saldoTras < 0 ? ' ⚠' : ' ✓'), color: saldoTras >= 0 ? '#166534' : '#991b1b' },
        ].map((item, i) => (
          <div key={i}>
            <div style={{ fontSize: 9, color: '#9ca89c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>{item.lbl}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: item.color, marginTop: 1 }}>{item.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onClose} style={{ fontSize: 11, fontWeight: 700, background: '#f3f4f6', color: '#374151', border: '1px solid #e0e4e0', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button
          onClick={onRegistrar} disabled={!canSubmit}
          style={{ fontSize: 11, fontWeight: 700, background: canSubmit ? '#144E4A' : '#e5e7eb', color: canSubmit ? '#CDFBF2' : '#9ca89c', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : .6 }}
        >Registrar Pago</button>
        {!canSubmit && (
          <span style={{ fontSize: 10, color: '#c0392b' }}>
            {superaTope ? 'El monto supera el Liquidador' : isAjustado && !formData.notas?.trim() ? 'Agrega el motivo del ajuste' : 'Completa los campos requeridos'}
          </span>
        )}
      </div>
    </div>
  )
}

export default function FactPagosSubc() {
  const ppa          = useFactStore(s => s.ppa)
  const sitios       = useAppStore(s => s.sitios)
  const gastos       = useAppStore(s => s.gastos)
  const subcs        = useAppStore(s => s.subcs)
  const catalogTI    = useAppStore(s => s.catalogTI)
  const liqCW        = useAppStore(s => s.liquidaciones_cw)
  const pagos        = usePagosStore(s => s.pagos)
  const loadPagos    = usePagosStore(s => s.loadPagos)
  const registrarPago = usePagosStore(s => s.registrarPago)
  const anularPago   = usePagosStore(s => s.anularPago)
  const user         = useAuthStore(s => s.user)

  const [expanded,    setExpanded]    = useState({})
  const [activeHito,  setActiveHito]  = useState({})
  const [forms,       setForms]       = useState({})
  const [filtroLc,    setFiltroLc]    = useState('')
  const [filtroEst,   setFiltroEst]   = useState('todos')
  const [showInternas, setShowInternas] = useState(true)

  useEffect(() => { loadPagos() }, [loadPagos])

  const sitioMap = useMemo(() => {
    const m = {}
    for (const s of sitios) m[s.nombre] = s
    return m
  }, [sitios])

  // LC → esInterna lookup
  const lcInternaSet = useMemo(() => {
    const s = new Set()
    for (const sub of subcs) { if (sub.esInterna) s.add(sub.lc) }
    return s
  }, [subcs])

  const ppaNames = useMemo(() => (
    [...new Set(ppa.map(r => r.customer_site_name).filter(Boolean))].sort()
  ), [ppa])

  const sites = useMemo(() => {
    return ppaNames.map(nombre => {
      const sitio = sitioMap[nombre]
      if (!sitio) return null  // sin match en Liquidador

      const c          = calcSitio(sitio, gastos, subcs, catalogTI, liqCW)
      const esInterna  = lcInternaSet.has(sitio.lc)
      const totalSubc  = c.subcTI + c.subcADJ + c.subcCR + c.subcCW
      const cuadrillaCosto = c.cuadrillaCosto || 0
      const lc         = sitio.lc  || null
      const cat        = c.cat     || null

      const sitePagos  = pagos.filter(p => p.sitio_nombre === nombre)
      const pagado     = sitePagos.reduce((s, p) => s + (p.valor || 0), 0)
      const pct        = totalSubc > 0 ? Math.round((pagado / totalSubc) * 100) : 0
      const hitosData  = HITOS.map(h => ({
        ...h,
        valorSugerido: Math.round(totalSubc * h.pct / 100),
        pago: sitePagos.find(p => p.hito === h.key) || null,
      }))
      const pendingCount = esInterna ? 0 : hitosData.filter(h => !h.pago).length

      return {
        nombre, sitio, lc, cat, esInterna,
        totalSubc, cuadrillaCosto,
        pagado, pct, hitosData, pendingCount, sitePagos,
        completed: !esInterna && pendingCount === 0 && totalSubc > 0,
      }
    }).filter(Boolean)
  }, [ppaNames, sitioMap, pagos, gastos, subcs, catalogTI, liqCW, lcInternaSet])

  const lcOptions = useMemo(() => [...new Set(sites.map(s => s.lc).filter(Boolean))].sort(), [sites])

  const filtered = useMemo(() => sites.filter(s => {
    if (!showInternas && s.esInterna)             return false
    if (filtroLc && s.lc !== filtroLc)            return false
    // Estado solo aplica a sitios SubC
    if (!s.esInterna) {
      if (filtroEst === 'pendiente'  && s.completed)  return false
      if (filtroEst === 'completado' && !s.completed) return false
    }
    return true
  }), [sites, filtroLc, filtroEst, showInternas])

  // KPIs solo sobre sitios SubC (no cuadrillas internas)
  const subcSites = useMemo(() => sites.filter(s => !s.esInterna && s.totalSubc > 0), [sites])
  const kpis = useMemo(() => {
    const totalSubcG = subcSites.reduce((s, x) => s + x.totalSubc, 0)
    const pagadoG    = subcSites.reduce((s, x) => s + x.pagado,   0)
    const pctG       = totalSubcG > 0 ? Math.round((pagadoG / totalSubcG) * 100) : 0
    return { totalSubcG, pagadoG, pendienteG: totalSubcG - pagadoG, pctG, count: subcSites.length }
  }, [subcSites])

  const internaCount = useMemo(() => sites.filter(s => s.esInterna).length, [sites])

  function toggle(nombre) { setExpanded(e => ({ ...e, [nombre]: !e[nombre] })) }

  function openReg(site, hitoKey) {
    const hito = site.hitosData.find(h => h.key === hitoKey)
    setActiveHito(a => ({ ...a, [site.nombre]: hitoKey }))
    setForms(f => ({ ...f, [site.nombre]: { valor: hito?.valorSugerido ?? 0, fecha: new Date().toISOString().split('T')[0], notas: '' } }))
  }

  function closeReg(nombre) { setActiveHito(a => ({ ...a, [nombre]: null })) }

  function onFormChange(nombre, field, val) {
    setForms(f => ({ ...f, [nombre]: { ...f[nombre], [field]: val } }))
  }

  async function handleRegistrar(site, hitoKey) {
    const f    = forms[site.nombre] || {}
    const hito = site.hitosData.find(h => h.key === hitoKey)
    if (!f.valor || !f.fecha) { showToast('Valor y fecha son obligatorios', 'err'); return }
    const isAjustado = Math.round(Number(f.valor)) !== Math.round(hito.valorSugerido)
    if (isAjustado && !f.notas?.trim()) { showToast('El motivo del ajuste es obligatorio', 'err'); return }
    try {
      await registrarPago({
        sitio_nombre:   site.nombre,
        hito:           hitoKey,
        valor:          Number(f.valor),
        valor_sugerido: hito.valorSugerido,
        fecha:          f.fecha,
        notas:          f.notas || null,
        registrado_por: user?.nombre || user?.email || '—',
      })
      showToast('Pago registrado')
      closeReg(site.nombre)
    } catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  async function handleAnular(pago) {
    if (!confirm('¿Anular este pago? Esta acción no se puede deshacer.')) return
    try { await anularPago(pago.id); showToast('Pago anulado') }
    catch (e) { showToast('Error: ' + e.message, 'err') }
  }

  if (!ppa.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>
      Sin datos. Carga el PPA Nokia desde el Dashboard.
    </div>
  )

  return (
    <>
      <div style={{ position: 'sticky', top: 'calc(96px + env(safe-area-inset-top))', zIndex: 10, background: '#f0f2f0', paddingBottom: 14, boxShadow: '0 4px 8px -4px rgba(0,0,0,.07)' }}>
      {/* Header */}
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Pagos Subcontratistas</h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>Registro y control de pagos por hitos de obra</div>
        </div>
      </div>

      {/* KPI cards — solo SubC */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: '#9ca89c', marginBottom: 4 }}>Total SubC (Liquidador)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#144E4A', lineHeight: 1.1 }}>{fmtCOP(kpis.totalSubcG)}</div>
          <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 3 }}>{kpis.count} sitios SubC · {internaCount} cuadrilla{internaCount !== 1 ? 's' : ''} interna{internaCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: '#166534', marginBottom: 4 }}>Total Pagado</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', lineHeight: 1.1 }}>{fmtCOP(kpis.pagadoG)}</div>
          <div style={{ fontSize: 10, color: '#166534', marginTop: 3 }}>{kpis.pctG}% del total</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: '#9ca89c', marginBottom: 4 }}>Pendiente por Pagar</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309', lineHeight: 1.1 }}>{fmtCOP(kpis.pendienteG)}</div>
          <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 3 }}>{100 - kpis.pctG}% restante</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: '#9ca89c', marginBottom: 6 }}>Progreso Global</div>
          <div style={{ height: 8, background: '#e0e7ff', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: 8, width: `${kpis.pctG}%`, background: '#6366f1', borderRadius: 4, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#4338ca', marginTop: 5 }}>{kpis.pctG}%</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="fc" value={filtroLc} onChange={e => setFiltroLc(e.target.value)} style={{ fontSize: 11 }}>
          <option value="">Todos los LC</option>
          {lcOptions.map(lc => <option key={lc} value={lc}>{lc}</option>)}
        </select>
        <select className="fc" value={filtroEst} onChange={e => setFiltroEst(e.target.value)} style={{ fontSize: 11 }}>
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Con pagos pendientes</option>
          <option value="completado">Completados</option>
        </select>
        <button
          onClick={() => setShowInternas(v => !v)}
          style={{
            fontSize: 10, fontWeight: 700, cursor: 'pointer', borderRadius: 6, padding: '5px 10px',
            background: showInternas ? '#eff6ff' : '#f3f4f6',
            color:      showInternas ? '#1e40af' : '#6b7280',
            border: `1px solid ${showInternas ? '#bfdbfe' : '#e0e4e0'}`,
          }}
        >
          {showInternas ? '👁 Cuadrilla Interna visible' : 'Cuadrilla Interna oculta'}
        </button>
        <span style={{ fontSize: 10, color: '#9ca89c' }}>{filtered.length} sitio{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      </div>

      {/* Acordeón de sitios */}
      {filtered.map(site => {
        const isOpen        = !!expanded[site.nombre]
        const firstPending  = site.hitosData.find(h => !h.pago)
        const activeHitoKey = activeHito[site.nombre]
        const formData      = forms[site.nombre] || {}

        return (
          <div key={site.nombre} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
            {/* Header del sitio */}
            <div
              onClick={() => toggle(site.nombre)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
                background: isOpen ? (site.esInterna ? '#f0f4ff' : '#f0f7f0') : '#fff',
                borderBottom: isOpen ? `1px solid ${site.esInterna ? '#c7d7fd' : '#d4e4d4'}` : 'none',
                transition: 'background .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: site.esInterna ? '#3b82f6' : '#144E4A', flexShrink: 0, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{site.nombre}</span>
                    {site.lc && (
                      <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>
                        {site.lc}
                      </span>
                    )}
                    {site.esInterna
                      ? <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>Cuadrilla Interna</span>
                      : site.totalSubc === 0
                        ? <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>Sin SubC</span>
                        : site.completed
                          ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>Completado</span>
                          : <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>{site.pendingCount} pendiente{site.pendingCount !== 1 ? 's' : ''}</span>
                    }
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {[
                      site.lc && `LC: ${site.lc}`,
                      site.cat && `Cat ${site.cat}`,
                      site.esInterna
                        ? site.cuadrillaCosto > 0 ? `Costo cuadrilla: ${fmtCOP(site.cuadrillaCosto)}` : 'Cuadrilla interna sin costo calculado'
                        : site.totalSubc > 0 ? `SubC: ${fmtCOP(site.totalSubc)}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              {site.esInterna
                ? <span style={{ fontSize: 9, color: '#9ca89c', fontStyle: 'italic', flexShrink: 0 }}>Pagos SubC no aplican</span>
                : site.totalSubc > 0 ? <MiniBar pct={site.pct} /> : null
              }
            </div>

            {/* Contenido expandido — Cuadrilla Interna */}
            {isOpen && site.esInterna && (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', fontSize: 11, color: '#1e3a8a' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ</span>
                  <div>
                    <strong>Este sitio es ejecutado por cuadrilla interna.</strong><br />
                    Los pagos a subcontratistas no aplican — el costo de obra corresponde a nómina, viáticos y transporte de la cuadrilla propia.
                    {site.cuadrillaCosto > 0 && (
                      <div style={{ marginTop: 6, fontWeight: 700 }}>
                        Costo cuadrilla (Liquidador): {fmtCOP(site.cuadrillaCosto)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contenido expandido — SubC normal */}
            {isOpen && !site.esInterna && site.totalSubc > 0 && (
              <div style={{ padding: 16 }}>
                {/* Barra de totales */}
                <div style={{ background: '#f0f7f0', border: '1px solid #d4e4d4', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[
                    { lbl: 'Total SubC Liquidador', val: fmtCOP(site.totalSubc),              color: '#144E4A' },
                    { lbl: 'Pagado',                val: fmtCOP(site.pagado),                 color: '#166534' },
                    { lbl: 'Saldo pendiente',       val: fmtCOP(site.totalSubc - site.pagado), color: '#b45309' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      {i > 0 && <div style={{ width: 1, height: 30, background: '#d4e4d4' }} />}
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#617561', textTransform: 'uppercase', letterSpacing: .5 }}>{item.lbl}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.val}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ height: 6, width: 120, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: 6, width: `${Math.min(site.pct, 100)}%`, background: '#22c55e', borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, marginTop: 2 }}>{site.pct}% pagado</div>
                  </div>
                </div>

                {/* Tabla de hitos */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f8faf8', borderBottom: '2px solid #e0e4e0' }}>
                      {['Hito', '%', 'Valor Sugerido', 'Valor Registrado', 'Fecha', 'Estado', ''].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: '#617561' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {site.hitosData.map(hito => {
                      const isPaid   = !!hito.pago
                      const isActive = !isPaid && firstPending?.key === hito.key
                      const isAjust  = hito.pago && Math.round(hito.pago.valor) !== Math.round(hito.pago.valor_sugerido || 0)

                      return (
                        <tr key={hito.key} style={{ borderBottom: '1px solid #f0f0f0', background: isPaid ? '#fafff9' : isActive ? '#fffbeb' : '#fff' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{hito.label}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>{hito.pct}%</span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#144E4A', fontWeight: 600 }}>{fmtCOP(hito.valorSugerido)}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {hito.pago ? (
                              <>
                                <span style={{ color: isAjust ? '#b45309' : '#144E4A', fontWeight: 700 }}>{fmtCOP(hito.pago.valor)}</span>
                                {isAjust && (
                                  <span style={{ fontSize: 8, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700 }}>
                                    {hito.pago.valor > (hito.pago.valor_sugerido || 0) ? '+' : ''}{fmtCOP(hito.pago.valor - (hito.pago.valor_sugerido || 0))}
                                  </span>
                                )}
                              </>
                            ) : <span style={{ color: '#9ca89c', fontStyle: 'italic' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#6b7280', fontSize: 10 }}>
                            {hito.pago?.fecha || <span style={{ color: '#d4d4d8' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {isPaid
                              ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>✓ Pagado</span>
                              : isActive
                                ? <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>○ Pendiente</span>
                                : <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>○ Pendiente</span>
                            }
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {isPaid ? (
                              <button
                                onClick={() => handleAnular(hito.pago)}
                                style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                              >Anular</button>
                            ) : isActive ? (
                              <button
                                onClick={() => activeHitoKey === hito.key ? closeReg(site.nombre) : openReg(site, hito.key)}
                                style={{ fontSize: 10, fontWeight: 700, background: '#FFC000', color: '#92400e', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                              >
                                {activeHitoKey === hito.key ? 'Cancelar' : 'Registrar pago'}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Panel de registro inline */}
                {activeHitoKey && (
                  <RegPanel
                    site={site}
                    hitoKey={activeHitoKey}
                    formData={formData}
                    onFormChange={(field, val) => onFormChange(site.nombre, field, val)}
                    onRegistrar={() => handleRegistrar(site, activeHitoKey)}
                    onClose={() => closeReg(site.nombre)}
                    allPagos={pagos}
                  />
                )}

                {/* Historial */}
                {site.sitePagos.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: '1px dashed #e0e4e0', paddingTop: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: '#9ca89c', marginBottom: 6 }}>Historial</div>
                    {site.sitePagos.map(p => {
                      const hitoInfo = HITOS.find(h => h.key === p.hito)
                      const isAdj    = Math.round(p.valor) !== Math.round(p.valor_sugerido || 0)
                      return (
                        <div key={p.id} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 10 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: isAdj ? '#f59e0b' : '#22c55e', flexShrink: 0, marginTop: 4 }} />
                          <div>
                            <strong>{hitoInfo?.label || p.hito} pagado</strong> · {fmtCOP(p.valor)} · {p.fecha}
                            {isAdj && p.notas && <div style={{ color: '#6b7280', fontStyle: 'italic', marginTop: 1 }}>"{p.notas}"</div>}
                            <div style={{ color: '#9ca89c', fontSize: 9, marginTop: 1 }}>Por {p.registrado_por || '—'}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Contenido expandido — SubC = 0, no es interna */}
            {isOpen && !site.esInterna && site.totalSubc === 0 && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: '#9ca89c', fontStyle: 'italic' }}>
                  Este sitio no tiene costo SubC calculado en el Liquidador.
                </div>
              </div>
            )}
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#617561', fontSize: 13 }}>
          Sin sitios para los filtros actuales.
        </div>
      )}
    </>
  )
}
