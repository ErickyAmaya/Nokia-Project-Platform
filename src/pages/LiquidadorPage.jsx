import { useMemo, useState, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { calcSitio } from '../lib/calcSitio'
import { cop, pct, mcls, CAT } from '../lib/catalog'
import { useConfirm } from '../components/ConfirmModal'
import { showToast } from '../components/Toast'
import GastoModal from '../modals/GastoModal'
import AgregarActividadModal from '../modals/AgregarActividadModal'
import CWLiquidadorView from '../components/CWLiquidadorView'
import TSSLiquidadorView from '../components/TSSLiquidadorView'

const SECC_ORDER = ['MODERNIZACION', '5G', 'MIMO', 'SITIO_NUEVO', 'ADJ', 'CR']
const CAT_ORDER  = ['A', 'AA', 'AAA']

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

const btnEdit    = { background: '#e8f4fd', color: '#1a56db', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 12, lineHeight: 1 }
const btnConfirm = { background: '#e8f4fd', color: '#1a56db', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 13, fontWeight: 700, lineHeight: 1 }
const btnDel     = { background: '#fff0f0', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 12, lineHeight: 1 }

function estadoBadge(estado) {
  if (estado === 'final') {
    return <span className="badge" style={{ background: '#1a7a1a', color: '#fff', fontSize: 9, padding: '2px 10px' }}>FINAL</span>
  }
  return <span className="badge" style={{ background: '#d68910', color: '#fff', fontSize: 9, padding: '2px 10px' }}>PRE</span>
}

// variant: 'nokia' (green) | 'subc' (yellow)
function SectionDivider({ label, colSpan, variant = 'nokia' }) {
  const isSubc = variant === 'subc'
  return (
    <tr>
      <td colSpan={colSpan} style={{
        background:   isSubc ? '#fffbeb'        : '#f0f7f0',
        fontWeight:   700,
        fontSize:     9,
        color:        isSubc ? '#92400e'        : '#144E4A',
        padding:      '4px 8px',
        letterSpacing: 1,
        textTransform: 'uppercase',
        borderTop:    isSubc ? '2px solid #fde68a' : '2px solid #d4e4d4',
      }}>
        {label}
      </td>
    </tr>
  )
}

// ── Nokia activity row ────────────────────────────────────────────
function NokiaRow({ act, actIdx, onCantChange, onDelete, isViewer, isFinal }) {
  const [editing, setEditing] = useState(false)
  const [tempCant, setTempCant] = useState(act.cant)

  function startEdit() { setTempCant(act.cant); setEditing(true) }
  function confirmEdit() { onCantChange(actIdx, Math.max(0, parseInt(tempCant) || 0)); setEditing(false) }
  function cancelEdit() { setEditing(false) }

  return (
    <tr>
      <td style={{ fontSize: 10, fontWeight: 600 }}>{act.nombre || act.id}</td>
      <td style={{ fontSize: 9, color: '#777' }}>{act.def?.unidad || '—'}</td>
      <td className="num">
        {editing ? (
          <input
            autoFocus
            type="number" min="0"
            style={{ width: 50, textAlign: 'right', border: '1px solid #93c5fd', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: '#fff' }}
            value={tempCant}
            onChange={e => setTempCant(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
          />
        ) : (
          <span>{act.cant}</span>
        )}
      </td>
      <td className="num" style={{ color: '#144E4A' }}>{cop(act.preNokia)}</td>
      <td className="num fw7" style={{ color: '#144E4A' }}>{cop(act.totalNokia)}</td>
      {!isViewer && !isFinal && (
        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
          {editing ? (
            <>
              <button style={btnConfirm} onClick={confirmEdit} title="Confirmar">✓</button>
              {' '}
              <button style={btnDel} onClick={cancelEdit} title="Cancelar">✕</button>
            </>
          ) : (
            <>
              <button style={btnEdit} onClick={startEdit} title="Editar cantidad"><IconEdit /></button>
              {' '}
              <button style={btnDel} onClick={() => onDelete(actIdx)} title="Eliminar actividad">✕</button>
            </>
          )}
        </td>
      )}
    </tr>
  )
}

// ── SubC activity row ─────────────────────────────────────────────
function SubcRow({ act, actIdx, onExclCR, isViewer, isFinal }) {
  return (
    <tr>
      <td style={{ fontSize: 10, fontWeight: 600 }}>{act.nombre || act.id}</td>
      <td style={{ fontSize: 9, color: '#777' }}>{act.def?.unidad || '—'}</td>
      <td className="num fw6">{act.cant}</td>
      <td className="num" style={{ color: '#b45309' }}>{cop(act.preSubc)}</td>
      <td className="num fw7" style={{ color: '#b45309' }}>{cop(act.totalSubc)}</td>
      {!isViewer && !isFinal && (
        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
          {act.tipo === 'CR' && (
            <button
              style={btnDel}
              onClick={() => onExclCR(actIdx)}
              title="Excluir solo del costo SubC (permanece en Nokia)"
            >
              × SubC
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function LiquidadorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [modalAct,    setModalAct]    = useState(false)
  const [modalGasto,  setModalGasto]  = useState(false)
  const [gastoEdit,   setGastoEdit]   = useState(null)
  const [siteSearch,  setSiteSearch]  = useState('')
  const [showSearch,  setShowSearch]  = useState(false)

  const sitios           = useAppStore(s => s.sitios)
  const gastos           = useAppStore(s => s.gastos)
  const subcs            = useAppStore(s => s.subcs)
  const catalogTI        = useAppStore(s => s.catalogTI)
  const liquidaciones_cw = useAppStore(s => s.liquidaciones_cw)
  const user             = useAuthStore(s => s.user)
  const updateSitioAct   = useAppStore(s => s.updateSitioAct)
  const addActividad     = useAppStore(s => s.addActividad)
  const deleteActividad  = useAppStore(s => s.deleteActividad)
  const exclCRSubc       = useAppStore(s => s.exclCRSubc)
  const updateSitioField = useAppStore(s => s.updateSitioField)
  const updateBackoffice = useAppStore(s => s.updateBackoffice)
  const activarCW        = useAppStore(s => s.activarCW)
  const marcarFinal        = useAppStore(s => s.marcarFinal)
  const reabrirSitio       = useAppStore(s => s.reabrirSitio)
  const eliminarGasto      = useAppStore(s => s.eliminarGasto)
  const marcarFinalLiqCW   = useAppStore(s => s.marcarFinalLiqCW)

  const { confirm, ConfirmModalUI } = useConfirm()

  const userRole  = user?.role ?? ''
  const isViewer  = userRole === 'viewer'
  const isAdmin   = userRole === 'admin'
  const isCoord   = userRole === 'coord'
  const isTIUser  = userRole === 'TI'
  const isTSSUser = userRole === 'TSS'
  const isCWUser  = userRole === 'CW'

  const sitio = sitios.find(s => s.id === id)
  const calc  = useMemo(() => sitio ? calcSitio(sitio, gastos, subcs, catalogTI, liquidaciones_cw) : null, [sitio, gastos, subcs, catalogTI, liquidaciones_cw])
  const gastosS = useMemo(() => gastos.filter(g => g.sitio === id), [gastos, id])

  // Site search list filtered by role
  const tiSitios = useMemo(() => {
    if (userRole === 'TSS') return sitios.filter(s => s.tipo === 'TSS' && s.id !== id)
    if (userRole === 'CW')  return sitios.filter(s => s.tipo === 'TI' && s.tiene_cw && s.id !== id)
    if (userRole === 'TI')  return sitios.filter(s => s.tipo === 'TI' && s.id !== id)
    return sitios.filter(s => s.id !== id)
  }, [sitios, id, userRole])
  const filteredSites = useMemo(() => {
    if (!siteSearch.trim()) return tiSitios.slice(0, 12)
    const q = siteSearch.toLowerCase()
    return tiSitios.filter(s =>
      s.nombre?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q)
    ).slice(0, 12)
  }, [tiSitios, siteSearch])

  if (!sitio || !calc) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#9ca89c' }}>
        {sitios.length === 0 ? 'Cargando…' : 'Sitio no encontrado'}
      </div>
    )
  }

  const isFinal  = sitio.estado === 'final'
  const isTSS    = sitio.tipo === 'TSS'
  const liqCW    = liquidaciones_cw.find(l => l.sitio_id === id)
  const view     = searchParams.get('view') || (isCWUser ? 'cw' : 'ti')

  // CW values — always from the CW liquidador
  const liqCWItems = liqCW?.items || []
  const cwVenta = liqCWItems.reduce((acc, i) => acc + (i.cant||0)*(i.precio_nokia||0), 0)
  const cwCosto = liqCWItems.reduce((acc, i) => acc + (i.cant||0)*(i.precio_subc||0), 0)
  const lc      = sitio.lc || ''
  const sub     = lc ? subcs.find(s => s.lc === lc) : null

  // Category logic
  const lcCat       = sub?.cat || sitio.cat || 'A'
  const catEfectiva = sitio.catEfectiva || ''
  const cat         = catEfectiva || lcCat
  const isUpgraded  = catEfectiva && CAT_ORDER.indexOf(catEfectiva) > CAT_ORDER.indexOf(lcCat)

  const allCatalog = useMemo(() => [...CAT.BASE, ...CAT.ADJ, ...CAT.CR], [])

  const { actsRich, grouped } = useMemo(() => {
    const rich = calc.acts.map(act => ({
      ...act,
      def:    allCatalog.find(c => c.id === act.id) || null,
      nombre: allCatalog.find(c => c.id === act.id)?.nombre || act.id,
    }))
    const groups = {}
    rich.forEach((act, i) => {
      const sec = act.sec || (act.tipo === 'ADJ' ? 'ADJ' : act.tipo === 'CR' ? 'CR' : 'MODERNIZACION')
      if (!groups[sec]) groups[sec] = []
      groups[sec].push({ act, i })
    })
    return { actsRich: rich, grouped: groups }
  }, [calc.acts, allCatalog])

  const seccOrder = isTSS ? ['TSS'] : SECC_ORDER

  const totalNokiaActs = actsRich.reduce((s, a) => s + a.totalNokia, 0)
  const totalSubcActs  = actsRich.reduce((s, a) => s + (a.subcExcluded ? 0 : a.totalSubc), 0)
  const marginColor    = calc.margen >= .3 ? '#1a7a1a' : calc.margen >= .2 ? '#FFC000' : '#c0392b'

  function handleCantChange(actIdx, val) { updateSitioAct(sitio.id, actIdx, val) }
  function handleDelete(actIdx)          { deleteActividad(sitio.id, actIdx) }
  function handleExclCR(actIdx)          { exclCRSubc(sitio.id, actIdx) }
  function handleAddAct(act)             { addActividad(sitio.id, act); showToast(`${act.id} agregado`) }

  async function handleEliminarGasto(g) {
    const ok = await confirm('Eliminar Gasto', `¿Eliminar "${g.desc}" (${cop(g.valor)})?`)
    if (!ok) return
    try { await eliminarGasto(g.id); showToast('Gasto eliminado') }
    catch (e) { showToast('Error: ' + (e.message || ''), 'err') }
  }

  async function handleMarcarFinal() {
    const ok = await confirm('Marcar como FINAL', 'Los precios quedarán congelados. ¿Continuar?')
    if (!ok) return
    marcarFinal(sitio.id)
    showToast('Sitio marcado como FINAL')
  }

  async function handleReabrir() {
    const ok = await confirm('Reabrir Sitio', '¿Regresar el sitio a estado PRE?')
    if (!ok) return
    reabrirSitio(sitio.id)
    showToast('Sitio reabierto')
  }

  async function handleMarcarFinalCW() {
    const ok = await confirm('Marcar CW como FINAL', 'Los precios CW quedarán congelados. ¿Continuar?')
    if (!ok) return
    await marcarFinalLiqCW(liqCW.id, 'final')
    showToast('Liquidación CW marcada como FINAL')
  }

  async function handleReabrirCW() {
    const ok = await confirm('Reabrir Liquidación CW', '¿Regresar la liquidación CW a estado PRE?')
    if (!ok) return
    await marcarFinalLiqCW(liqCW.id, 'pre')
    showToast('Liquidación CW reabierta')
  }

  return (
    <>
      {/* ── Header ───────────────────────────────────────── */}
      <div className="mb14">
        {/* Top nav row: left = Volver + Buscar | right = action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn bou btn-sm" onClick={() => navigate(-1)}>
              ← Volver
            </button>
            {/* ── Site search ── */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn bou btn-sm"
                onClick={() => { setShowSearch(v => !v); setSiteSearch('') }}
                title="Buscar sitio"
              >
                🔍 Buscar sitio
              </button>
              {showSearch && (
                <div style={{
                  position: 'absolute', top: '110%', left: 0, zIndex: 200,
                  background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
                  boxShadow: '0 4px 20px rgba(0,0,0,.15)', width: 280, padding: 8,
                }}>
                  <input
                    autoFocus
                    placeholder="Nombre o ID del sitio…"
                    value={siteSearch}
                    onChange={e => setSiteSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '6px 10px', fontSize: 12,
                      border: '1px solid #d1d5db', borderRadius: 6,
                      boxSizing: 'border-box', marginBottom: 6,
                    }}
                  />
                  {filteredSites.length === 0 && (
                    <div style={{ fontSize: 11, color: '#9ca89c', padding: '4px 6px' }}>Sin resultados</div>
                  )}
                  {filteredSites.map(s => (
                    <div
                      key={s.id}
                      onClick={() => { navigate(`/liquidador/${s.id}${isCWUser ? '?view=cw' : ''}`); setShowSearch(false) }}
                      style={{
                        padding: '6px 10px', fontSize: 11, cursor: 'pointer',
                        borderRadius: 5, display: 'flex', justifyContent: 'space-between',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f7f0'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 600 }}>{s.nombre || s.id}</span>
                      <span style={{ fontSize: 10, color: '#9ca89c' }}>{s.cat || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Site name + badges row */}
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
          {sitio.nombre}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {estadoBadge(sitio.estado)}
            <span className="badge bg-k" style={{ fontSize: 9 }}>{sitio.tipo}</span>
            <span className="badge bg-gl" style={{ fontSize: 9 }}>{cat}</span>
            {isUpgraded && (
              <span className="badge" style={{ background: '#7c3aed', color: '#fff', fontSize: 9 }}>E</span>
            )}
            {lc && <span className="badge" style={{ background: '#f0f7f0', color: '#555f55', fontSize: 9 }}>{lc}</span>}
            {sitio.region && (
              <span className="badge" style={{ background: '#f0f7f0', color: '#555f55', fontSize: 9 }}>
                {sitio.region}
              </span>
            )}
            {sitio.fecha && <span style={{ fontSize: 10, color: '#9ca89c' }}>{sitio.fecha}</span>}
          </div>
          {/* Marcar Final — TI or CW depending on active view */}
          {!isViewer && (
            <div style={{ display: 'flex', gap: 6 }}>
              {view === 'cw' && liqCW && (
                liqCW.estado === 'final'
                  ? (isAdmin || isCoord) && (
                    <button className="btn bou btn-sm" style={{ borderColor: '#c0392b', color: '#c0392b' }} onClick={handleReabrirCW}>
                      ↩ Reabrir CW
                    </button>
                  )
                  : <button className="btn bd btn-sm" onClick={handleMarcarFinalCW}>✓ Marcar Liquidación Final</button>
              )}
              {view !== 'cw' && (
                isFinal
                  ? isAdmin && <button className="btn bou btn-sm" onClick={handleReabrir}>↩ Reabrir</button>
                  : <button className="btn bd btn-sm" onClick={handleMarcarFinal}>✓ Marcar Liquidación Final</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Config bar (solo TI/TSS, no CW) ─────────────── */}
      {!isViewer && view !== 'cw' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-b" style={{ paddingTop: 10, paddingBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Tipo Ciudad</label>
                <select
                  className="fc"
                  value={sitio.ciudad || 'Ciudad_Principal'}
                  onChange={e => updateSitioField(sitio.id, 'ciudad', e.target.value)}
                  disabled={isFinal}
                >
                  {['Ciudad_Principal','Ciudad_Secundaria','Ciudad_Intermedia','Dificil Acceso'].map(z => (
                    <option key={z} value={z}>{z.replace('Ciudad_', '')}</option>
                  ))}
                </select>
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Región</label>
                <select
                  className="fc"
                  value={sitio.region || ''}
                  onChange={e => updateSitioField(sitio.id, 'region', e.target.value)}
                  disabled={isFinal}
                >
                  <option value="">— Seleccionar —</option>
                  {['R1 – Costa','R2 – Noroccidente','R3 – Suroccidente','R4 – Centro','R5 – Oriente'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">LC / Subcontratista</label>
                <select
                  className="fc"
                  style={{ borderColor: '#1a5276' }}
                  value={lc}
                  onChange={e => updateSitioField(sitio.id, 'lc', e.target.value)}
                  disabled={isFinal}
                >
                  <option value="">— Sin LC —</option>
                  {subcs.map(s => (
                    <option key={s.lc} value={s.lc}>{s.lc}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const upgradeOpts = CAT_ORDER.filter(c => CAT_ORDER.indexOf(c) > CAT_ORDER.indexOf(lcCat))
                return (
                  <div className="fg" style={{ marginBottom: 0 }}>
                    <label className="fl">
                      {catEfectiva
                        ? `Subido a Categoría ${catEfectiva} ⭐`
                        : 'Subir Categoría'}
                    </label>
                    <select
                      className="fc"
                      style={isUpgraded ? { borderColor: '#7c3aed', fontWeight: 700 } : {}}
                      value={catEfectiva}
                      onChange={e => updateSitioField(sitio.id, 'catEfectiva', e.target.value || undefined)}
                      disabled={isFinal || upgradeOpts.length === 0}
                    >
                      <option value="">Usar cat. del LC ({lcCat})</option>
                      {upgradeOpts.map(c => (
                        <option key={c} value={c}>Subir a {c} ⭐</option>
                      ))}
                    </select>
                  </div>
                )
              })()}
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="fl">Fecha</label>
                <input
                  type="date" className="fc"
                  value={sitio.fecha || ''}
                  onChange={e => updateSitioField(sitio.id, 'fecha', e.target.value)}
                  disabled={isFinal}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab bar (only for admin/coord on TI sites with CW) ─────────── */}
      {!isTSS && sitio.tiene_cw && !isCWUser && !isTIUser && !isTSSUser && (
        <div style={{
          display: 'flex', gap: 2, marginBottom: 14,
          background: '#fff', borderRadius: 8, padding: 4,
          border: '1px solid #e0e4e0', width: 'fit-content',
        }}>
          {[
            { key: 'ti', label: '📡 TI' },
            { key: 'cw', label: '🏗 CW — Obra Civil' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSearchParams(tab.key === 'ti' ? {} : { view: tab.key })}
              style={{
                padding: '5px 16px', fontSize: 11, fontWeight: 700,
                fontFamily: "'Barlow', sans-serif", letterSpacing: .5, textTransform: 'uppercase',
                border: 'none', borderRadius: 5, cursor: 'pointer',
                background: view === tab.key ? '#144E4A' : 'transparent',
                color: view === tab.key ? '#CDFBF2' : '#555f55',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── CW Liquidador view ────────────────────────── */}
      {view === 'cw' && !isTSS && sitio.tiene_cw && (
        <CWLiquidadorView sitio={sitio} />
      )}

      {/* ── TSS Liquidador view ───────────────────────── */}
      {isTSS && !isTIUser && <TSSLiquidadorView sitio={sitio} calc={calc} />}

      {/* ── Dual column: Nokia (left) | SubC (right) ─────── */}
      {!isTSS && view !== 'cw' && !isCWUser && !isTSSUser && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>

        {/* ══════════════ LEFT — NOKIA ══════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* NOKIA — LIQUIDACIÓN VENTA */}
          <div className="card">
            <div className="card-h" style={{
              background: '#144E4A', borderLeftColor: '#CDFBF2',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ color: '#CDFBF2' }}>Nokia — Liquidación Venta</h2>
              {!isViewer && !isFinal && (
                <button
                  className="btn btn-sm"
                  style={{ background: '#CDFBF2', color: '#000', fontWeight: 700 }}
                  onClick={() => setModalAct(true)}
                >
                  ＋ Actividad
                </button>
              )}
            </div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 380 }}>
                <thead>
                  <tr>
                    <th>Actividad</th>
                    <th>Unidad</th>
                    <th className="num">Cant</th>
                    <th className="num" style={{ color: '#144E4A' }}>P. Nokia</th>
                    <th className="num" style={{ color: '#144E4A' }}>Total Nokia</th>
                    {!isViewer && !isFinal && <th style={{ width: 60 }} />}
                  </tr>
                </thead>
                <tbody>
                  {actsRich.length === 0 && (
                    <tr>
                      <td colSpan={!isViewer && !isFinal ? 6 : 5} style={{ padding: 24, textAlign: 'center', color: '#9ca89c' }}>
                        Sin actividades — usa <strong>＋ Actividad</strong>
                      </td>
                    </tr>
                  )}
                  {seccOrder.map(sec => {
                    const entries = grouped[sec]
                    if (!entries?.length) return null
                    return (
                      <Fragment key={sec}>
                        <SectionDivider label={sec} colSpan={!isViewer && !isFinal ? 6 : 5} variant="nokia" />
                        {entries.map(({ act, i }) => (
                          <NokiaRow
                            key={i} act={act} actIdx={i}
                            onCantChange={handleCantChange}
                            onDelete={handleDelete}
                            isViewer={isViewer} isFinal={isFinal}
                          />
                        ))}
                      </Fragment>
                    )
                  })}
                  {!isTSS && sitio.tiene_cw && (cwVenta > 0 || (sitio.cw_nokia || 0) > 0) && (
                    <Fragment key="cw-nokia">
                      <SectionDivider label="CW" colSpan={!isViewer && !isFinal ? 6 : 5} variant="nokia" />
                      <tr>
                        <td style={{ fontSize: 10, fontWeight: 600 }}>CW Obra Civil</td>
                        <td style={{ fontSize: 9, color: '#777' }}>Sitio</td>
                        <td className="num" style={{ fontSize: 10 }}>1</td>
                        <td className="num" style={{ color: '#144E4A' }}>{cop(cwVenta || sitio.cw_nokia || 0)}</td>
                        <td className="num fw7" style={{ color: '#144E4A' }}>{cop(cwVenta || sitio.cw_nokia || 0)}</td>
                        {!isViewer && !isFinal && <td />}
                      </tr>
                    </Fragment>
                  )}
                </tbody>
                <tfoot>
                  <tr className="tr-tot">
                    <td colSpan={3}><strong>{!isTSS && sitio.tiene_cw ? 'TOTAL TI+CW' : 'TOTAL ACTIVIDADES'}</strong></td>
                    <td />
                    <td className="num" style={{ color: '#144E4A', fontWeight: 800, fontSize: 13 }}>
                      {cop(totalNokiaActs + (!isTSS && sitio.tiene_cw ? cwVenta : 0))}
                    </td>
                    {!isViewer && !isFinal && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* CW — OBRA CIVIL */}
          {!isTSS && (
            <div className="card">
              <div className="card-h" style={{
                background: '#0f4c75', borderLeftColor: '#48cae4',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h2 style={{ color: '#fff' }}>CW — Obra Civil</h2>
                {!isViewer && !isFinal && (
                  <select
                    style={{
                      fontSize: 10, padding: '3px 8px',
                      background: '#1a6b9c', color: '#fff',
                      border: '1px solid rgba(72,202,228,.4)', borderRadius: 4,
                      cursor: 'pointer', fontWeight: 700,
                    }}
                    value={sitio.cw_conjunto ? 'conjunto' : sitio.tiene_cw ? 'si' : 'no'}
                    onChange={e => activarCW(sitio.id, e.target.value)}
                  >
                    <option value="no">Sin CW</option>
                    <option value="si">CW Individual</option>
                    <option value="conjunto">CW Conjunto</option>
                  </select>
                )}
              </div>
              <div className="card-b">
                {sitio.tiene_cw ? (
                  <div>
                    {/* CW values summary — read-only, from liquidador */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div style={{ background: '#f0f7f0', borderRadius: 6, padding: '8px 12px', border: '1px solid #d4e4d4' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#144E4A', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Venta Nokia CW</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#144E4A' }}>{cop(cwVenta)}</div>
                      </div>
                      <div style={{ background: '#fffbeb', borderRadius: 6, padding: '8px 12px', border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Costo SubC CW</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#b45309' }}>{cop(cwCosto)}</div>
                      </div>
                    </div>

                    {/* Liquidador CW button + meta info */}
                    {!sitio.cw_conjunto && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#0f4c75', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setSearchParams({ view: 'cw' })}
                        >
                          🏗 Liquidador CW
                        </button>
                        {liqCW && (
                          <span style={{ fontSize: 10, color: '#555f55' }}>
                            {liqCW.items?.length || 0} ítems · {liqCW.tipo_zona || 'URBANO'} · {liqCW.estado === 'final' ? 'FINAL' : 'PRE'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: '#9ca89c', margin: 0 }}>Sin Obra Civil en este sitio.</p>
                )}
              </div>
            </div>
          )}

          {/* RESUMEN VENTA NOKIA */}
          <div className="card">
            <div className="card-h" style={{ background: '#144E4A' }}>
              <h2 style={{ color: '#CDFBF2' }}>Resumen Venta Nokia</h2>
            </div>
            <div className="card-b" style={{ padding: '10px 14px' }}>
              {[
                { label: 'TI (BASE)',  value: calc.nokiaTI },
                { label: 'ADJ',       value: calc.nokiaADJ },
                { label: 'CR',        value: calc.nokiaCR,  hide: calc.nokiaCR === 0 },
                { label: 'CW — Obra Civil', value: calc.nokiaCW, hide: !sitio.tiene_cw },
              ].filter(r => !r.hide).map(r => (
                <div key={r.label} className="fb" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#555f55' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#144E4A' }}>{cop(r.value)}</span>
                </div>
              ))}
              <div className="fb" style={{ borderTop: '2px solid #144E4A', paddingTop: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>TOTAL VENTA</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#144E4A' }}>{cop(calc.totalVenta)}</span>
              </div>
            </div>
          </div>

          {/* UTILIDAD & MARGEN */}
          <div className="card">
            <div className="card-h"><h2>Utilidad &amp; Margen</h2></div>
            <div className="card-b">
              <div className="fb" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#144E4A', fontWeight: 700 }}>Total Venta Nokia</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#144E4A' }}>{cop(calc.totalVenta)}</span>
              </div>
              <div className="fb" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#b45309' }}>Total Costo</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>{cop(calc.totalCosto)}</span>
              </div>
              <div className="fb" style={{ borderTop: '1px solid #e0e4e0', paddingTop: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>UTILIDAD</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: calc.utilidad >= 0 ? '#1a7a1a' : '#c0392b' }}>
                  {cop(calc.utilidad)}
                </span>
              </div>
              <div className="fb" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>% MARGEN</span>
                <span className={`badge ${mcls(calc.margen)}`} style={{ fontSize: 13, padding: '2px 10px' }}>
                  {pct(calc.margen)}
                </span>
              </div>
              <div className="mbar">
                <div className="mfill" style={{ width: `${Math.min(calc.margen * 100, 100)}%`, background: marginColor }} />
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ RIGHT — SUBC ══════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* SUBC — LIQUIDACIÓN PAGO */}
          <div className="card">
            <div className="card-h" style={{
              background: '#FFF0CE', borderLeftColor: '#FFC000',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ color: '#92400e' }}>SubC — Liquidación Pago</h2>
              {lc && (
                <span style={{ textAlign: 'right', lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, fontSize: 11, color: '#92400e' }}>{lc}</span>
                  <br />
                  <span className="badge" style={{ background: '#fde68a', color: '#92400e', fontSize: 9 }}>Cat {cat}</span>
                  {isUpgraded && (
                    <span className="badge" style={{ background: '#7c3aed', color: '#fff', fontSize: 9, marginLeft: 3 }}>E</span>
                  )}
                  {sub?.tipoCuadrilla && (
                    <span style={{ fontSize: 9, color: '#92400e', marginLeft: 4 }}>{sub.tipoCuadrilla}</span>
                  )}
                </span>
              )}
            </div>
            {/* SubC contact info */}
            {sub && (
              <div style={{
                padding: '6px 14px', borderBottom: '1px solid #fde68a',
                display: 'flex', gap: 16, flexWrap: 'wrap', background: '#fffbeb',
              }}>
                <span style={{ fontSize: 10, color: '#92400e' }}><strong>{sub.empresa}</strong></span>
                {sub.tel   && <span style={{ fontSize: 10, color: '#92400e' }}>📞 {sub.tel}</span>}
                {sub.email && <span style={{ fontSize: 10, color: '#92400e' }}>✉ {sub.email}</span>}
              </div>
            )}
            {!lc && (
              <div style={{ padding: '8px 14px', background: '#fffbeb', fontSize: 10, color: '#f59e0b' }}>
                ⚠ Sin LC asignado — selecciona en la barra de configuración
              </div>
            )}
            <div style={{ padding: 0, overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 380 }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Actividad',   cls: '',    extra: {} },
                      { label: 'Unidad',      cls: '',    extra: {} },
                      { label: 'Cant',        cls: 'num', extra: {} },
                      { label: 'P. SubC',     cls: 'num', extra: {} },
                      { label: 'Total SubC',  cls: 'num', extra: {} },
                    ].map(col => (
                      <th key={col.label} className={col.cls} style={{ background: '#FFF0CE', color: '#92400e', borderBottom: '2px solid #FFC000', ...col.extra }}>
                        {col.label}
                      </th>
                    ))}
                    {!isViewer && !isFinal && (
                      <th style={{ width: 50, background: '#FFF0CE', borderBottom: '2px solid #FFC000' }} />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {actsRich.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca89c' }}>
                        Sin actividades
                      </td>
                    </tr>
                  )}
                  {seccOrder.map(sec => {
                    const entries = grouped[sec]
                    if (!entries?.length) return null
                    const crExcluded = sitio.crSubcExcluded || []
                    const visible = entries.filter(({ act, i }) =>
                      act.preSubc > 0 && !(act.tipo === 'CR' && crExcluded.includes(i))
                    )
                    if (!visible.length) return null
                    return (
                      <Fragment key={sec}>
                        <SectionDivider label={sec} colSpan={6} variant="subc" />
                        {visible.map(({ act, i }) => (
                          <SubcRow
                            key={i} act={act} actIdx={i}
                            onExclCR={handleExclCR}
                            isViewer={isViewer} isFinal={isFinal}
                          />
                        ))}
                      </Fragment>
                    )
                  })}
                  {!isTSS && sitio.tiene_cw && (cwCosto > 0 || (sitio.cw_costo || 0) > 0) && (
                    <Fragment key="cw-subc">
                      <SectionDivider label="CW" colSpan={!isViewer && !isFinal ? 6 : 5} variant="subc" />
                      <tr>
                        <td style={{ fontSize: 10, fontWeight: 600 }}>CW Obra Civil</td>
                        <td style={{ fontSize: 9, color: '#777' }}>Sitio</td>
                        <td className="num" style={{ fontSize: 10 }}>1</td>
                        <td className="num" style={{ color: '#b45309' }}>{cop(cwCosto || sitio.cw_costo || 0)}</td>
                        <td className="num fw7" style={{ color: '#b45309' }}>{cop(cwCosto || sitio.cw_costo || 0)}</td>
                        {!isViewer && !isFinal && <td />}
                      </tr>
                    </Fragment>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#fffbeb', fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: '6px 10px', color: '#92400e' }}>
                      <strong>{!isTSS && sitio.tiene_cw ? 'TOTAL TI+CW' : 'TOTAL ACTIVIDADES'}</strong>
                    </td>
                    <td />
                    <td className="num" style={{ color: '#b45309', fontWeight: 800, fontSize: 13 }}>
                      {cop(totalSubcActs + (!isTSS && sitio.tiene_cw ? (cwCosto || sitio.cw_costo || 0) : 0))}
                    </td>
                    {!isViewer && !isFinal && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* BACKOFFICE (admin only) */}
          {isAdmin && !isTSS && (
            <div className="card">
              <div className="card-h"><h2>Costo Backoffice</h2></div>
              <div className="card-b">
                <div className="fg" style={{ marginBottom: 0, maxWidth: 220 }}>
                  <label className="fl">Valor Backoffice (COP)</label>
                  <input
                    type="number" className="fc" min="0"
                    value={sitio.costos?.backoffice || 0}
                    onChange={e => updateBackoffice(sitio.id, parseInt(e.target.value) || 0)}
                    disabled={isFinal}
                  />
                </div>
              </div>
            </div>
          )}

          {/* COSTOS OPERATIVOS */}
          <div className="card">
            <div className="card-h" style={{ background: '#FFF0CE', borderLeftColor: '#FFC000' }}>
              <h2 style={{ color: '#92400e' }}>Costos Operativos</h2>
            </div>
            <div className="card-b" style={{ padding: '10px 14px' }}>
              {[
                { label: 'SubC TI+ADJ',   value: calc.subcTI + calc.subcADJ },
                { label: 'SubC CR',        value: calc.subcCR,    hide: calc.subcCR === 0 },
                { label: 'SubC CW',        value: calc.subcCW,    hide: !sitio.tiene_cw },
                { label: 'Materiales TI',  value: calc.matTI,     hide: calc.matTI === 0 },
                { label: 'Materiales CW',  value: calc.matCW,     hide: calc.matCW === 0 },
                { label: 'Logística',      value: calc.logist,    hide: calc.logist === 0 },
                { label: 'Adicionales',    value: calc.adicion,   hide: calc.adicion === 0 },
                { label: 'Backoffice',     value: calc.backoffice, hide: !isAdmin || calc.backoffice === 0 },
              ].filter(r => !r.hide).map(r => (
                <div key={r.label} className="fb" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#555f55' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309' }}>{cop(r.value)}</span>
                </div>
              ))}
              <div className="fb" style={{ borderTop: '2px solid #FFC000', paddingTop: 6, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>TOTAL COSTO</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#b45309' }}>{cop(calc.totalCosto)}</span>
              </div>
            </div>
          </div>

          {/* GASTOS REGISTRADOS */}
          <div className="card">
            <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Gastos Registrados</h2>
              {!isViewer && (
                <button className="btn bd btn-sm" onClick={() => setModalGasto(true)}>＋ Agregar Gasto</button>
              )}
            </div>
            {gastosS.length === 0 ? (
              <div className="card-b" style={{ color: '#9ca89c', fontSize: 11 }}>Sin gastos registrados.</div>
            ) : (
              <div style={{ padding: 0, overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      {isTSS && <th>Sub-Sitio</th>}
                      <th className="num">Valor</th>
                      {!isViewer && <th style={{ width: 60 }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {gastosS.map(g => (
                      <tr key={g.id}>
                        <td>
                          <span className="badge" style={{ fontSize: 9, background: '#f0f7f0', color: '#555f55' }}>{g.tipo}</span>
                        </td>
                        <td style={{ fontSize: 11 }}>{g.desc}</td>
                        {isTSS && <td style={{ fontSize: 10, color: '#777' }}>{g.sub_sitio || '—'}</td>}
                        <td className="num fw7">{cop(g.valor)}</td>
                        {!isViewer && (
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <button style={{ ...btnEdit, marginRight: 3 }} onClick={() => { setGastoEdit(g); setModalGasto(true) }} title="Editar gasto"><IconEdit /></button>
                            <button className="btn-del" onClick={() => handleEliminarGasto(g)}>✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="tr-tot">
                      <td colSpan={isTSS ? 3 : 2}><strong>Total Gastos</strong></td>
                      <td className="num fw8">{cop(gastosS.reduce((s, g) => s + g.valor, 0))}</td>
                      {!isViewer && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>}

      {/* ── Modales ──────────────────────────────────────── */}
      <AgregarActividadModal
        open={modalAct}
        onClose={() => setModalAct(false)}
        onAdd={handleAddAct}
        sitio={sitio}
        subcs={subcs}
      />
      <GastoModal
        open={modalGasto}
        onClose={() => { setModalGasto(false); setGastoEdit(null) }}
        defaultSitio={sitio.id}
        gasto={gastoEdit}
      />
      <ConfirmModalUI />
    </>
  )
}
