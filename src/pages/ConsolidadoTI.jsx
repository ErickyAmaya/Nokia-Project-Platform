import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { calcSitio, hasSN } from '../lib/calcSitio'
import { getPrecio, cop } from '../lib/catalog'
import { useConfirm } from '../components/ConfirmModal'
import { showToast } from '../components/Toast'
import NuevoSitioModal from '../modals/NuevoSitioModal'

// ── Sub-components ──────────────────────────────────────────────

function TipoBadge({ sitio }) {
  if (hasSN(sitio)) return <span className="badge" style={{ background: '#1a1a1a', color: '#fff', fontSize: 8 }}>TI (SN)</span>
  if (sitio.tipo === 'TSS') return <span className="badge bg-b" style={{ fontSize: 8 }}>TSS</span>
  return <span className="badge bg-k" style={{ fontSize: 8 }}>TI</span>
}

function ThNokia({ children, style }) {
  return (
    <th className="num" style={{
      background: '#144E4A', color: '#CDFBF2',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 9, fontWeight: 700, padding: '9px 10px',
      letterSpacing: .7, textTransform: 'uppercase', whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  )
}

function ThSubc({ children, style }) {
  return (
    <th className="num" style={{
      background: '#FFF0CE', color: '#000',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 9, fontWeight: 700, padding: '9px 10px',
      letterSpacing: .7, textTransform: 'uppercase', whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  )
}

// ── Main page ───────────────────────────────────────────────────

export default function ConsolidadoTI() {
  const [search,      setSearch]      = useState('')
  const [filLC,       setFilLC]       = useState('')
  const [modalNuevo,  setModalNuevo]  = useState(false)

  const navigate       = useNavigate()
  const { confirm, ConfirmModalUI } = useConfirm()

  const sitios           = useAppStore(s => s.sitios)
  const gastos           = useAppStore(s => s.gastos)
  const subcs            = useAppStore(s => s.subcs)
  const catalogTI        = useAppStore(s => s.catalogTI)
  const liquidaciones_cw = useAppStore(s => s.liquidaciones_cw)
  const user             = useAuthStore(s => s.user)
  const eliminarSitio    = useAppStore(s => s.eliminarSitio)

  const isViewer = user?.role === 'viewer'

  // LCs únicos (solo sitios TI)
  const lcsUniq = useMemo(() =>
    [...new Set(sitios.filter(s => s.tipo !== 'TSS').map(s => s.lc).filter(Boolean))].sort(),
    [sitios]
  )

  // Filtrar
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return sitios.filter(s => {
      if (s.tipo === 'TSS') return false
      if (filLC && s.lc !== filLC) return false
      if (q && !`${s.nombre} ${s.lc} ${s.ciudad} ${s.cat}`.toLowerCase().includes(q)) return false
      return true
    }).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
  }, [sitios, search, filLC])

  // Calcular cada fila
  const rows = useMemo(() => filtered.map(s => {
    const c = calcSitio(s, gastos, subcs, catalogTI, liquidaciones_cw)

    // MIMO total (actividades con sec='MIMO')
    const mimoTotal = (s.actividades || [])
      .filter(a => a.sec === 'MIMO')
      .reduce((sum, a) => {
        const p = getPrecio(a.tipo || 'BASE', a.id, s.ciudad, s.catEfectiva || s.cat, null)
        return sum + p.nokia * (a.cant || 0)
      }, 0)

    // ADJ Nokia total
    const adjTotal = (s.actividades || [])
      .filter(a => a.sec === 'ADJ' || a.tipo === 'ADJ')
      .reduce((sum, a) => {
        const p = getPrecio('ADJ', a.id, s.ciudad, s.catEfectiva || s.cat, null)
        return sum + p.nokia * (a.cant || 0)
      }, 0)

    return { s, c, mimoTotal, adjTotal }
  }), [filtered, gastos, subcs])

  // Totales footer
  const totals = useMemo(() => rows.reduce((acc, { c, mimoTotal, adjTotal }) => ({
    tV:    acc.tV    + c.totalVenta,
    tC:    acc.tC    + c.totalCosto,
    tTI:   acc.tTI   + c.nokiaTI,
    tADJ:  acc.tADJ  + adjTotal,
    tCW:   acc.tCW   + c.nokiaCW,
    tCR:   acc.tCR   + c.nokiaCR,
    tMIMO: acc.tMIMO + mimoTotal,
    tSTC:  acc.tSTC  + c.subcTI,
    tSCW:  acc.tSCW  + c.subcCW,
    tMTI:  acc.tMTI  + c.matTI,
    tMCW:  acc.tMCW  + c.matCW,
    tLog:  acc.tLog  + c.logist,
    tAd:   acc.tAd   + c.adicion,
  }), { tV:0, tC:0, tTI:0, tADJ:0, tCW:0, tCR:0, tMIMO:0, tSTC:0, tSCW:0, tMTI:0, tMCW:0, tLog:0, tAd:0 }),
  [rows])

  async function handleEliminar(s) {
    const ok = await confirm(
      'Eliminar Sitio',
      `¿Eliminar el sitio "${s.nombre}"? Esta acción no se puede deshacer.`
    )
    if (!ok) return
    try {
      await eliminarSitio(s.id)
      showToast(`${s.nombre} eliminado`)
    } catch (e) {
      showToast('Error al eliminar: ' + (e.message || ''), 'err')
    }
  }

  function cityShort(ciudad) {
    if (!ciudad) return '—'
    if (ciudad === 'varios') return 'Var'
    return ciudad.replace('Ciudad_', '').substring(0, 4)
  }

  return (
    <>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="fb mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Consolidado — Sitios TI ({filtered.length})
        </h1>
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          <input
            type="text" className="fc"
            placeholder="🔍 Buscar sitio, LC, ciudad…"
            style={{ width: 220 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="fc" style={{ width: 180 }} value={filLC} onChange={e => setFilLC(e.target.value)}>
            <option value="">Todos los LC</option>
            {lcsUniq.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {!isViewer && (
            <button className="btn bp no-print" onClick={() => setModalNuevo(true)}>
              ＋ Nuevo
            </button>
          )}
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
          <table className="tbl" style={{ minWidth: 1100 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              {/* Row 1 — group headers */}
              <tr>
                <th colSpan={5} style={{ background: '#f0f7f0', border: 'none', padding: '2px 0' }} />
                <th
                  colSpan={5}
                  style={{
                    background: '#144E4A', color: '#CDFBF2',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7,
                    padding: '4px 10px', textAlign: 'right',
                    borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                  }}
                >
                  VENTA NOKIA
                </th>
                <th
                  colSpan={6}
                  style={{
                    background: '#FFF0CE', color: '#000',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7,
                    padding: '4px 10px', textAlign: 'right',
                    borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                  }}
                >
                  COSTO SITIO
                </th>
                <th style={{ background: '#f0f7f0', border: 'none', padding: 0 }} />
              </tr>

              {/* Row 2 — column headers */}
              <tr>
                <th>Sitio</th>
                <th>Región</th>
                <th>Fecha</th>
                <th>LC</th>
                <th>Cat</th>
                <ThNokia>TI</ThNokia>
                <ThNokia>ADJ</ThNokia>
                <ThNokia>CW</ThNokia>
                <ThNokia>CR</ThNokia>
                <ThNokia style={{ borderRight: '2px solid #60a5fa' }}>MIMO</ThNokia>
                <ThSubc>SubC TI</ThSubc>
                <ThSubc>SubC CW</ThSubc>
                <ThSubc>Mat TI</ThSubc>
                <ThSubc>Mat CW</ThSubc>
                <ThSubc>Logística</ThSubc>
                <ThSubc style={{ borderRight: '2px solid #fbbf24' }}>Adicionales</ThSubc>
                <th style={{ width: 30 }} />
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={17} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>
                    {sitios.filter(s => s.tipo !== 'TSS').length === 0
                      ? 'Sin sitios TI — crea el primero con ＋ Nuevo'
                      : 'Sin resultados para los filtros aplicados'}
                  </td>
                </tr>
              )}
              {rows.map(({ s, c, mimoTotal, adjTotal }) => (
                <tr key={s.id} style={{ background: '#eff6ff' }}>
                  <td style={{ whiteSpace: 'nowrap', background: '#fff' }}>
                    <span
                      className="stat-link"
                      style={{ fontWeight: 700 }}
                      onClick={() => navigate(`/liquidador/${s.id}`)}
                      title="Abrir liquidador"
                    >
                      {s.nombre}
                    </span>
                    {' '}<TipoBadge sitio={s} />
                    {s.catEfectiva && (
                      <span style={{
                        background: '#7c3aed', color: '#fff', borderRadius: '50%',
                        width: 14, height: 14, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 800, marginLeft: 3,
                      }}>E</span>
                    )}
                  </td>
                  <td style={{ background: '#fff' }}>
                    <span className="badge bg-b" style={{ fontSize: 8 }}>{s.region || '—'}</span>
                  </td>
                  <td style={{ fontSize: 10, background: '#fff' }}>{s.fecha || '—'}</td>
                  <td style={{ fontSize: 10, background: '#fff' }}>{s.lc}</td>
                  <td style={{ background: '#fff' }}>
                    <span className="badge bg-gl" style={{ fontSize: 8 }}>{s.catEfectiva || s.cat}</span>
                  </td>
                  <td className="num">{cop(c.nokiaTI)}</td>
                  <td className="num">{cop(adjTotal)}</td>
                  <td className="num">{c.nokiaCW > 0 ? cop(c.nokiaCW) : <span className="tm">N/A</span>}</td>
                  <td className="num">{cop(c.nokiaCR)}</td>
                  <td className="num fw7" style={{ borderRight: '2px solid #93c5fd' }}>
                    {mimoTotal > 0 ? cop(mimoTotal) : <span className="tm">$0</span>}
                  </td>
                  <td className="num" style={{ background: '#fffbeb' }}>{cop(c.subcTI)}</td>
                  <td className="num" style={{ background: '#fffbeb' }}>
                    {c.subcCW > 0 ? cop(c.subcCW) : <span className="tm">N/A</span>}
                  </td>
                  <td className="num" style={{ background: '#fffbeb' }}>{cop(c.matTI)}</td>
                  <td className="num" style={{ background: '#fffbeb' }}>{cop(c.matCW)}</td>
                  <td className="num" style={{ background: '#fffbeb' }}>{cop(c.logist)}</td>
                  <td className="num" style={{ background: '#fffbeb', borderRight: '2px solid #fbbf24' }}>
                    {cop(c.adicion)}
                  </td>
                  <td style={{ background: '#fff' }}>
                    {!isViewer && s.estado !== 'final' && (
                      <button className="btn-del" onClick={() => handleEliminar(s)}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* ── Footer totales ───────────────────────────────── */}
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
              <tr className="tr-tot">
                <td colSpan={5}><strong>TOTAL PROYECTO</strong></td>
                <td className="num">{cop(totals.tTI)}</td>
                <td className="num">{cop(totals.tADJ)}</td>
                <td className="num">{cop(totals.tCW)}</td>
                <td className="num">{cop(totals.tCR)}</td>
                <td className="num fw8">{cop(totals.tMIMO)}</td>
                <td className="num">{cop(totals.tSTC)}</td>
                <td className="num">{cop(totals.tSCW)}</td>
                <td className="num">{cop(totals.tMTI)}</td>
                <td className="num">{cop(totals.tMCW)}</td>
                <td className="num">{cop(totals.tLog)}</td>
                <td className="num">{cop(totals.tAd)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────── */}
      <NuevoSitioModal
        open={modalNuevo}
        onClose={() => setModalNuevo(false)}
        onCreated={sitio => navigate(`/liquidador/${sitio.id}`)}
      />
      <ConfirmModalUI />
    </>
  )
}
