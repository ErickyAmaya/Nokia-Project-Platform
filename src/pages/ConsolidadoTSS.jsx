import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { getPrecio, cop } from '../lib/catalog'
import { useConfirm } from '../components/ConfirmModal'
import { showToast } from '../components/Toast'
import NuevoTSSModal from '../modals/NuevoTSSModal'

// ── Header cell helpers ──────────────────────────────────────────

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
      background: '#FFF0CE', color: '#92400e',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 9, fontWeight: 700, padding: '9px 10px',
      letterSpacing: .7, textTransform: 'uppercase', whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  )
}

// ── Calculate Nokia + SubC per TSS activity type ─────────────────

function calcTSSRow(s, subcs) {
  const lcVisita   = s.lcVisita   || s.lc || ''
  const lcReporte  = s.lcReporte  || s.lc || ''
  const lcRedesign = s.lcRedesign || s.lc || ''

  const catOf = lc => subcs.find(x => x.lc === lc)?.cat || s.cat || 'A'
  const catV  = catOf(lcVisita)
  const catR  = catOf(lcReporte)
  const catRd = catOf(lcRedesign)

  let nokiaV = 0, nokiaR = 0, nokiaRD = 0, nokiaVR = 0
  let subcV  = 0, subcR  = 0, subcRD  = 0, subcVR  = 0

  ;(s.actividades || []).forEach(act => {
    const isNokia = act.cardType !== 'subc'
    const isSubc  = act.cardType !== 'nokia'
    const cant    = act.cant || 0

    if (isNokia) {
      const pN = getPrecio('BASE', act.id, null, s.cat || 'A', act.ciudad)
      const n  = pN.nokia * cant
      if      (act.id === 'TSS_V')  nokiaV  += n
      else if (act.id === 'TSS_R')  nokiaR  += n
      else if (act.id === 'TSS_RD') nokiaRD += n
      else if (act.id === 'TSS_VR') nokiaVR += n
    }

    if (isSubc) {
      const cb =
        act.id === 'TSS_V'  ? catV  :
        act.id === 'TSS_R'  ? catR  :
        act.id === 'TSS_RD' ? catRd : catV
      const pS = getPrecio('BASE', act.id, null, act.catOver || cb, act.ciudad)
      const sc = pS.subc * cant
      if      (act.id === 'TSS_V')  subcV  += sc
      else if (act.id === 'TSS_R')  subcR  += sc
      else if (act.id === 'TSS_RD') subcRD += sc
      else if (act.id === 'TSS_VR') subcVR += sc
    }
  })

  // Count unique site names (sitioid)
  const cantSitios = new Set(
    (s.actividades || []).map(a => a.sitioid).filter(Boolean)
  ).size

  return { lcVisita, lcReporte, lcRedesign, cantSitios,
           nokiaV, nokiaR, nokiaRD, nokiaVR,
           subcV,  subcR,  subcRD,  subcVR }
}

// ── Main page ────────────────────────────────────────────────────

export default function ConsolidadoTSS() {
  const [filLCVis, setFilLCVis] = useState('')
  const [filLCRep, setFilLCRep] = useState('')
  const [modalTSS, setModalTSS] = useState(false)

  const navigate       = useNavigate()
  const { confirm, ConfirmModalUI } = useConfirm()

  const sitios        = useAppStore(s => s.sitios)
  const subcs         = useAppStore(s => s.subcs)
  const user             = useAuthStore(s => s.user)
  const eliminarSitio = useAppStore(s => s.eliminarSitio)

  const isViewer = user?.role === 'viewer'

  // LCs únicos por tipo
  const lcsVisita = useMemo(() =>
    [...new Set(sitios.filter(s => s.tipo === 'TSS').map(s => s.lcVisita || s.lc).filter(Boolean))].sort(),
    [sitios]
  )
  const lcsReporte = useMemo(() =>
    [...new Set(sitios.filter(s => s.tipo === 'TSS').map(s => s.lcReporte).filter(Boolean))].sort(),
    [sitios]
  )

  // Filtrar TSS
  const filtered = useMemo(() =>
    sitios.filter(s => {
      if (s.tipo !== 'TSS') return false
      if (filLCVis && (s.lcVisita || s.lc) !== filLCVis) return false
      if (filLCRep && s.lcReporte !== filLCRep) return false
      return true
    }).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)),
    [sitios, filLCVis, filLCRep]
  )

  // Calcular cada fila
  const rows = useMemo(
    () => filtered.map(s => ({ s, r: calcTSSRow(s, subcs) })),
    [filtered, subcs]
  )

  // Totales footer
  const totals = useMemo(() => rows.reduce((acc, { r }) => ({
    nokiaV:  acc.nokiaV  + r.nokiaV,
    nokiaR:  acc.nokiaR  + r.nokiaR,
    nokiaRD: acc.nokiaRD + r.nokiaRD,
    nokiaVR: acc.nokiaVR + r.nokiaVR,
    subcV:   acc.subcV   + r.subcV,
    subcR:   acc.subcR   + r.subcR,
    subcRD:  acc.subcRD  + r.subcRD,
    subcVR:  acc.subcVR  + r.subcVR,
  }), { nokiaV:0, nokiaR:0, nokiaRD:0, nokiaVR:0, subcV:0, subcR:0, subcRD:0, subcVR:0 }),
  [rows])

  async function handleEliminar(s) {
    const ok = await confirm(
      'Eliminar Sitio TSS',
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

  function dash(v) {
    return v > 0 ? cop(v) : <span className="tm">—</span>
  }

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="fb mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Consolidado TSS ({filtered.length})
        </h1>
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          <select className="fc" style={{ width: 175 }} value={filLCVis} onChange={e => setFilLCVis(e.target.value)}>
            <option value="">Todos los LC (Visita)</option>
            {lcsVisita.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="fc" style={{ width: 175 }} value={filLCRep} onChange={e => setFilLCRep(e.target.value)}>
            <option value="">LC Reporte (todos)</option>
            {lcsReporte.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {!isViewer && (
            <button className="btn bo no-print" onClick={() => setModalTSS(true)}>
              ＋ Nuevo TSS
            </button>
          )}
        </div>
      </div>

      {/* ── Tabla ──────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
          <table className="tbl" style={{ minWidth: 1050 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              {/* Fila 1 — group headers */}
              <tr>
                <th colSpan={6} style={{ background: '#f0f7f0', border: 'none', padding: '2px 0' }} />
                <th
                  colSpan={4}
                  style={{
                    background: '#144E4A', color: '#CDFBF2',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7,
                    padding: '4px 10px', textAlign: 'right',
                    borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                  }}
                >
                  NOKIA TSS
                </th>
                <th
                  colSpan={4}
                  style={{
                    background: '#FFF0CE', color: '#92400e',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7,
                    padding: '4px 10px', textAlign: 'right',
                    borderRadius: '6px 6px 0 0', whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                  }}
                >
                  SUBC TSS
                </th>
                <th style={{ background: '#f0f7f0', border: 'none', padding: 0 }} />
              </tr>

              {/* Fila 2 — column headers */}
              <tr>
                <th>Sitio</th>
                <th>Fecha</th>
                <th>LC Visita</th>
                <th>Región</th>
                <th>Cat</th>
                <th className="num">Cant. Sitios</th>
                <ThNokia>Visitas</ThNokia>
                <ThNokia>Reportes</ThNokia>
                <ThNokia>Rediseños</ThNokia>
                <ThNokia>V+R</ThNokia>
                <ThSubc>SubC Vis.</ThSubc>
                <ThSubc>SubC Rep.</ThSubc>
                <ThSubc>SubC Red.</ThSubc>
                <ThSubc>SubC V+R</ThSubc>
                <th />
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>
                    {sitios.filter(s => s.tipo === 'TSS').length === 0
                      ? 'Sin sitios TSS — crea el primero con ＋ Nuevo TSS'
                      : 'Sin resultados para los filtros aplicados'}
                  </td>
                </tr>
              )}
              {rows.map(({ s, r }) => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span
                      className="stat-link"
                      style={{ fontWeight: 700 }}
                      onClick={() => navigate(`/liquidador/${s.id}`)}
                      title="Abrir liquidador"
                    >
                      {s.nombre}
                    </span>
                    {' '}
                    <span className="badge bg-b" style={{ fontSize: 8 }}>TSS</span>
                  </td>
                  <td style={{ fontSize: 10 }}>{s.fecha || '—'}</td>
                  <td style={{ fontSize: 10 }}>{r.lcVisita || '—'}</td>
                  <td>
                    <span className="badge bg-b" style={{ fontSize: 8 }}>
                      {s.region || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-gl" style={{ fontSize: 8 }}>{s.cat || 'A'}</span>
                  </td>
                  <td className="num">{r.cantSitios || 0}</td>
                  {/* Nokia */}
                  <td className="num" style={{ background: '#eff6ff', color: 'var(--b)' }}>{dash(r.nokiaV)}</td>
                  <td className="num" style={{ background: '#eff6ff', color: 'var(--b)' }}>{dash(r.nokiaR)}</td>
                  <td className="num" style={{ background: '#eff6ff', color: 'var(--b)' }}>{dash(r.nokiaRD)}</td>
                  <td className="num fw7" style={{ background: '#dbeafe', color: 'var(--b)', borderRight: '2px solid #93c5fd' }}>{dash(r.nokiaVR)}</td>
                  {/* SubC */}
                  <td className="num" style={{ background: '#fffbeb', color: '#b45309' }}>{dash(r.subcV)}</td>
                  <td className="num" style={{ background: '#fffbeb', color: '#b45309' }}>{dash(r.subcR)}</td>
                  <td className="num" style={{ background: '#fffbeb', color: '#b45309' }}>{dash(r.subcRD)}</td>
                  <td className="num fw7" style={{ background: '#fef9c3', color: '#b45309', borderRight: '2px solid #fbbf24' }}>{dash(r.subcVR)}</td>
                  <td>
                    {!isViewer && s.estado !== 'final' && (
                      <button className="btn-del" onClick={() => handleEliminar(s)}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* ── Footer totales ─────────────────────────────── */}
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
              <tr className="tr-tot">
                <td colSpan={6}><strong>TOTAL TSS</strong></td>
                <td className="num fw8">{cop(totals.nokiaV)}</td>
                <td className="num fw8">{cop(totals.nokiaR)}</td>
                <td className="num fw8">{cop(totals.nokiaRD)}</td>
                <td className="num fw8">{cop(totals.nokiaVR)}</td>
                <td className="num fw8">{cop(totals.subcV)}</td>
                <td className="num fw8">{cop(totals.subcR)}</td>
                <td className="num fw8">{cop(totals.subcRD)}</td>
                <td className="num fw8">{cop(totals.subcVR)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Modales ────────────────────────────────────────── */}
      <NuevoTSSModal
        open={modalTSS}
        onClose={() => setModalTSS(false)}
        onCreated={sitio => navigate(`/liquidador/${sitio.id}`)}
      />
      <ConfirmModalUI />
    </>
  )
}
