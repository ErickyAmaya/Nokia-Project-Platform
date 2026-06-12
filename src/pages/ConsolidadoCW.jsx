import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { cop, pct, mcls } from '../lib/catalog'
import Modal from '../components/Modal'
import { showToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'

function calcLiq(liq) {
  let totNokia = 0, totSubc = 0
  ;(liq?.items || []).forEach(item => {
    totNokia += (item.cant || 0) * (item.precio_nokia || 0)
    totSubc  += (item.cant || 0) * (item.precio_subc  || 0)
  })
  const utilidad = totNokia - totSubc
  const margen   = totNokia > 0 ? utilidad / totNokia : 0
  return { totNokia, totSubc, utilidad, margen }
}

const thNokia = {
  background: '#144E4A', color: '#CDFBF2',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 9, fontWeight: 700, padding: '9px 10px',
  letterSpacing: .7, textTransform: 'uppercase', whiteSpace: 'nowrap',
}
const thSubc = {
  background: '#FFF0CE', color: '#92400e',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 9, fontWeight: 700, padding: '9px 10px',
  letterSpacing: .7, textTransform: 'uppercase', whiteSpace: 'nowrap',
}

export default function ConsolidadoCW() {
  const [filLC,      setFilLC]      = useState('')
  const [modalCW,    setModalCW]    = useState(false)
  const [cwSitioId,  setCwSitioId]  = useState('')
  const [cwTipo,     setCwTipo]     = useState('individual')
  const [cwSaving,   setCwSaving]   = useState(false)
  const [cwSearch,   setCwSearch]   = useState('')
  const [cwDropOpen, setCwDropOpen] = useState(false)

  const navigate            = useNavigate()
  const sitios              = useAppStore(s => s.sitios)
  const liquidaciones_cw    = useAppStore(s => s.liquidaciones_cw)
  const user             = useAuthStore(s => s.user)
  const updateSitioField    = useAppStore(s => s.updateSitioField)
  const saveLiqCW           = useAppStore(s => s.saveLiqCW)
  const quitarCW            = useAppStore(s => s.quitarCW)
  const { confirm, ConfirmModalUI } = useConfirm()

  const isViewer = user?.role === 'viewer'

  const [compact, setCompact] = useState(
    typeof window !== 'undefined' && window.innerHeight < 600
  )
  useEffect(() => {
    function onResize() { setCompact(window.innerHeight < 600) }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  // TI sites WITHOUT CW (candidates for Agregar CW)
  const tiSinCW = useMemo(() =>
    sitios.filter(s => s.tipo === 'TI' && !s.tiene_cw)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [sitios]
  )

  async function handleQuitarCW(s) {
    const ok = await confirm(
      'Quitar CW',
      `¿Quitar la liquidación CW de "${s.nombre}"? Se eliminará toda la liquidación CW y el sitio quedará sin CW.`
    )
    if (!ok) return
    try {
      await quitarCW(s.id)
      showToast(`CW eliminada de ${s.nombre}`)
    } catch (e) {
      showToast('Error: ' + (e.message || ''), 'err')
    }
  }

  async function handleAgregarCW() {
    if (!cwSitioId) return
    setCwSaving(true)
    try {
      updateSitioField(cwSitioId, 'tiene_cw',    true)
      updateSitioField(cwSitioId, 'cw_conjunto', cwTipo === 'conjunto')
      // Create a minimal liquidaciones_cw row immediately so the site stays visible
      // in ConsolidadoCW even if the sitios write is blocked by RLS for this user role.
      const existing = liquidaciones_cw.find(l => l.sitio_id === cwSitioId)
      if (!existing) {
        const sitio = sitios.find(s => s.id === cwSitioId)
        await saveLiqCW({
          id: crypto.randomUUID(), sitio_id: cwSitioId,
          smp: '', region: '', tipo_zona: 'URBANO',
          lc: sitio?.lc || '', estado: 'pre', items: [],
        })
      }
      setModalCW(false)
      const id = cwSitioId
      setCwSitioId('')
      setCwTipo('individual')
      setCwSearch('')
      navigate(`/liquidador/${id}?view=cw`)
    } finally {
      setCwSaving(false)
    }
  }

  // TI sites that have CW
  const tiSitiosCW = useMemo(() =>
    sitios.filter(s => s.tipo === 'TI' && s.tiene_cw), [sitios])

  // Unique LCs from CW liquidaciones
  const lcsUniq = useMemo(() => {
    const lcs = liquidaciones_cw
      .filter(l => tiSitiosCW.some(s => s.id === l.sitio_id))
      .map(l => l.lc).filter(Boolean)
    return [...new Set(lcs)].sort()
  }, [liquidaciones_cw, tiSitiosCW])

  // Build rows
  const rows = useMemo(() => {
    return tiSitiosCW
      .map(s => {
        const liq  = liquidaciones_cw.find(l => l.sitio_id === s.id) || null
        const calc = liq ? calcLiq(liq) : { totNokia: 0, totSubc: 0, utilidad: 0, margen: 0 }
        if (filLC && (liq?.lc || s.lc) !== filLC) return null
        return { s, liq, calc }
      })
      .filter(Boolean)
      .sort((a, b) => (b.calc.totNokia) - (a.calc.totNokia))
  }, [tiSitiosCW, liquidaciones_cw, filLC])

  // Aggregate stats
  const stats = useMemo(() => {
    const count   = rows.length
    const finales = rows.filter(r => r.liq?.estado === 'final').length
    const tN = rows.reduce((s, r) => s + r.calc.totNokia, 0)
    const tS = rows.reduce((s, r) => s + r.calc.totSubc,  0)
    const tU = tN - tS
    return { count, finales, tN, tS, tU }
  }, [rows])

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700, margin: 0 }}>
          Consolidado — CW ({stats.count})
          </h1>
          <button className="btn bou btn-sm" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="fc" style={{ width: 160 }} value={filLC} onChange={e => setFilLC(e.target.value)}>
            <option value="">Todos los LC</option>
            {lcsUniq.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {!['viewer','TI','TSS'].includes(user?.role) && (
            <button className="btn bp btn-sm" onClick={() => setModalCW(true)}>
              ＋ Agregar CW
            </button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: compact ? 'calc(100vh - 200px)' : 'calc(100vh - 340px)' }}>
          <table className="tbl" style={{ minWidth: compact ? 600 : 900 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ minWidth: 160 }}>Sitio TI</th>
                <th style={{ minWidth: 120 }}>Región</th>
                <th>Tipo</th>
                <th>LC</th>
                <th>Estado</th>
                <th className="num" style={{ ...thNokia, minWidth: 120 }}>Venta Nokia CW</th>
                <th className="num" style={{ ...thSubc,  minWidth: 120 }}>Costo SubC CW</th>
                <th className="num" style={{ minWidth: 110 }}>Utilidad</th>
                <th className="num" style={{ minWidth: 80 }}>% Margen</th>
                <th style={{ width: 30 }} />
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>
                    {tiSitiosCW.length === 0
                      ? 'Sin sitios TI con CW activado'
                      : 'Sin resultados para los filtros aplicados'}
                  </td>
                </tr>
              )}
              {rows.map(({ s, liq, calc }) => {
                const lc     = liq?.lc || s.lc || '—'
                const zona   = liq?.tipo_zona || '—'
                const region = liq?.region || '—'
                const smp    = liq?.smp || '—'
                const estado = liq?.estado || 'pre'
                const noData = calc.totNokia === 0 && calc.totSubc === 0
                return (
                  <tr key={s.id} style={{ background: '#eff6ff' }}>
                    <td style={{ whiteSpace: 'nowrap', background: '#fff' }}>
                      <span
                        className="stat-link"
                        style={{ fontWeight: 700, color: '#0d6e0d' }}
                        onClick={() => navigate(`/liquidador/${s.id}?view=cw`)}
                        title="Abrir Liquidador CW"
                      >
                        {s.nombre}
                      </span>
                      {estado === 'final' && (
                        <span className="badge" style={{ background: '#1a7a1a', color: '#fff', fontSize: 8, marginLeft: 4 }}>FINAL</span>
                      )}
                    </td>
                    <td style={{ fontSize: 10, color: '#555f55' }}>{region}</td>
                    <td>
                      {zona !== '—'
                        ? <span className="badge" style={{
                            background: zona === 'RURAL' ? '#fef3c7' : '#eff6ff',
                            color:      zona === 'RURAL' ? '#b45309' : '#1d4ed8',
                            fontSize: 8,
                          }}>{zona}</span>
                        : <span style={{ color: '#ccc', fontSize: 10 }}>—</span>
                      }
                    </td>
                    <td style={{ fontSize: 10 }}>{lc}</td>
                    <td>
                      <span className="badge" style={{
                        background: estado === 'final' ? '#1a7a1a' : '#d68910',
                        color: '#fff', fontSize: 8,
                      }}>
                        {estado === 'final' ? 'FINAL' : 'PRE'}
                      </span>
                    </td>
                    <td className="num fw7" style={{ color: noData ? '#ccc' : '#144E4A' }}>
                      {cop(calc.totNokia)}
                    </td>
                    <td className="num fw7" style={{ background: '#fffbeb', color: noData ? '#ccc' : '#b45309' }}>
                      {cop(calc.totSubc)}
                    </td>
                    <td className="num fw7" style={{ color: noData ? '#ccc' : (calc.utilidad >= 0 ? '#1a7a1a' : '#c0392b') }}>
                      {cop(calc.utilidad)}
                    </td>
                    <td className="num">
                      {calc.totNokia > 0
                        ? <span className={`badge ${mcls(calc.margen)}`} style={{ fontSize: 9 }}>{pct(calc.margen)}</span>
                        : <span style={{ color: '#ccc', fontSize: 10 }}>0.0%</span>
                      }
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {!isViewer && liq?.estado !== 'final' && (
                        <button
                          className="btn-del"
                          onClick={() => handleQuitarCW(s)}
                          title="Quitar CW"
                        >✕</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
              <tr className="tr-tot">
                <td colSpan={5}><strong>TOTAL CW — {rows.length} sitios</strong></td>
                <td className="num fw8" style={{ color: '#144E4A' }}>{cop(stats.tN)}</td>
                <td className="num fw8" style={{ color: '#b45309' }}>{cop(stats.tS)}</td>
                <td className="num fw8" style={{ color: stats.tU >= 0 ? '#1a7a1a' : '#c0392b' }}>{cop(stats.tU)}</td>
                <td className="num fw8">
                  {stats.tN > 0
                    ? <span className={`badge ${mcls(stats.tU / stats.tN)}`} style={{ fontSize: 9 }}>{pct(stats.tU / stats.tN)}</span>
                    : '—'}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Modal Agregar CW ──────────────────────────────────── */}
      <ConfirmModalUI />
      <Modal
        open={modalCW}
        onClose={() => { setModalCW(false); setCwSitioId(''); setCwTipo('individual'); setCwSearch('') }}
        title="🔧 Asociar CW a Sitio TI"
        footer={
          <>
            <button className="btn bou" onClick={() => setModalCW(false)} disabled={cwSaving}>Cancelar</button>
            <button className="btn bp" onClick={handleAgregarCW} disabled={cwSaving || !cwSitioId}>
              {cwSaving ? 'Guardando…' : '✓ Agregar CW'}
            </button>
          </>
        }
      >
        <div className="fg" style={{ marginBottom: 14 }}>
          <label className="fl">Sitio TI *</label>
          {tiSinCW.length === 0 ? (
            <div style={{ fontSize: 11, color: '#9ca89c', marginTop: 4 }}>
              Todos los sitios TI ya tienen CW asociada.
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                className="fc"
                type="text"
                placeholder="Buscar o seleccionar sitio…"
                value={cwSearch}
                autoComplete="off"
                onChange={e => {
                  setCwSearch(e.target.value)
                  setCwSitioId('')
                  setCwDropOpen(true)
                }}
                onFocus={() => setCwDropOpen(true)}
                onBlur={() => setTimeout(() => setCwDropOpen(false), 150)}
              />
              {cwSitioId && (
                <span style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 10, color: '#144E4A', fontWeight: 700, pointerEvents: 'none',
                }}>✓</span>
              )}
              {cwDropOpen && (() => {
                const q = cwSearch.toLowerCase()
                const hits = tiSinCW.filter(s => !q || s.nombre.toLowerCase().includes(q))
                return hits.length > 0 ? (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,.13)', maxHeight: 200, overflowY: 'auto',
                  }}>
                    {hits.map(s => (
                      <div
                        key={s.id}
                        onMouseDown={() => {
                          setCwSitioId(s.id)
                          setCwSearch(s.nombre)
                          setCwDropOpen(false)
                        }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          background: cwSitioId === s.id ? '#f0f7f0' : 'transparent',
                          color: cwSitioId === s.id ? '#144E4A' : '#374151',
                          fontWeight: cwSitioId === s.id ? 700 : 400,
                        }}
                        onMouseEnter={e => { if (cwSitioId !== s.id) e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={e => { e.currentTarget.style.background = cwSitioId === s.id ? '#f0f7f0' : 'transparent' }}
                      >
                        {s.nombre}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
                    padding: '10px 12px', fontSize: 11, color: '#9ca89c',
                  }}>
                    Sin resultados
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        <div className="fg">
          <label className="fl">Tipo de CW *</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[
              { value: 'individual', label: 'CW Individual', desc: 'Liquidación CW Requerida' },
              { value: 'conjunto',   label: 'CW en Conjunto', desc: 'CW en conjunto' },
            ].map(opt => (
              <div
                key={opt.value}
                onClick={() => setCwTipo(opt.value)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${cwTipo === opt.value ? '#144E4A' : '#e0e4e0'}`,
                  background: cwTipo === opt.value ? '#f0f7f0' : '#fff',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: cwTipo === opt.value ? '#144E4A' : '#374151' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}
