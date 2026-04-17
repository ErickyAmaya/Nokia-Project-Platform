import { useMemo, useState } from 'react'
import { useAppStore }  from '../store/useAppStore'
import { useAuthStore } from '../store/authStore'
import { cop } from '../lib/catalog'
import { useConfirm } from '../components/ConfirmModal'
import { showToast } from '../components/Toast'
import GastoModal from '../modals/GastoModal'

const TIPOS = ['Logistica', 'Adicionales', 'Materiales TI', 'Materiales CW']

const TIPO_COLOR = {
  Logistica:       { bg: '#eff6ff', color: '#1d4ed8' },
  Adicionales:     { bg: '#fef3c7', color: '#b45309' },
  'Materiales TI': { bg: '#f0fdf4', color: '#166534' },
  'Materiales CW': { bg: '#faf5ff', color: '#7e22ce' },
}

export default function GastosPage() {
  const [filSitio, setFilSitio] = useState('')
  const [filTipo,  setFilTipo]  = useState('')
  const [modalAdd, setModalAdd] = useState(false)
  const [editing,  setEditing]  = useState(null)  // gasto object to edit

  const sitios        = useAppStore(s => s.sitios)
  const gastos        = useAppStore(s => s.gastos)
  const user             = useAuthStore(s => s.user)
  const eliminarGasto = useAppStore(s => s.eliminarGasto)

  const { confirm, ConfirmModalUI } = useConfirm()
  const isViewer = user?.role === 'viewer'

  // Sitios únicos que tienen gastos
  const sitiosConGastos = useMemo(() => {
    const ids = new Set(gastos.map(g => g.sitio))
    return sitios.filter(s => ids.has(s.id)).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [sitios, gastos])

  // Filtrar
  const filtered = useMemo(() => {
    return gastos.filter(g => {
      if (filSitio && g.sitio !== filSitio) return false
      if (filTipo  && g.tipo !== filTipo)   return false
      return true
    })
  }, [gastos, filSitio, filTipo])

  // Totales por tipo
  const totalesTipo = useMemo(() => {
    const t = {}
    TIPOS.forEach(tp => { t[tp] = 0 })
    filtered.forEach(g => { t[g.tipo] = (t[g.tipo] || 0) + (g.valor || 0) })
    return t
  }, [filtered])

  const totalGeneral = filtered.reduce((s, g) => s + (g.valor || 0), 0)

  function nombreSitio(id) {
    return sitios.find(s => s.id === id)?.nombre || id || '—'
  }

  async function handleEliminar(g) {
    const ok = await confirm(
      'Eliminar Gasto',
      `¿Eliminar el gasto "${g.desc}" por ${cop(g.valor)}?`
    )
    if (!ok) return
    try {
      await eliminarGasto(g.id)
      showToast('Gasto eliminado')
    } catch (e) {
      showToast('Error: ' + (e.message || ''), 'err')
    }
  }

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="fb mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Gastos del Proyecto
        </h1>
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          <select className="fc" style={{ width: 200 }} value={filSitio} onChange={e => setFilSitio(e.target.value)}>
            <option value="">Todos los sitios</option>
            {sitiosConGastos.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select className="fc" style={{ width: 160 }} value={filTipo} onChange={e => setFilTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {!isViewer && (
            <button className="btn bp no-print" onClick={() => setModalAdd(true)}>
              ＋ Agregar Gasto
            </button>
          )}
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────── */}
      <div className="g5 mb14">
        {TIPOS.map(tipo => {
          const style = TIPO_COLOR[tipo] || {}
          return (
            <div key={tipo} className="stat" style={{ borderLeftColor: style.color }}>
              <div className="sl">{tipo}</div>
              <div className="sv" style={{ fontSize: 16, color: style.color }}>
                {cop(totalesTipo[tipo] || 0)}
              </div>
            </div>
          )
        })}
        <div className="stat" style={{ borderLeftColor: '#0a0a0a' }}>
          <div className="sl">Total Gastos</div>
          <div className="sv" style={{ fontSize: 16, fontWeight: 700 }}>{cop(totalGeneral)}</div>
          <div className="ss">{filtered.length} registros</div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="card">
        <div style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          <table className="tbl">
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th>Sitio</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Sub-Sitio</th>
                <th className="num">Valor</th>
                {!isViewer && <th style={{ width: 60 }} />}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isViewer ? 5 : 6} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>
                    {gastos.length === 0
                      ? 'Sin gastos registrados — agrega el primero con ＋ Agregar Gasto'
                      : 'Sin resultados para los filtros aplicados'}
                  </td>
                </tr>
              )}
              {filtered.map(g => {
                const tc = TIPO_COLOR[g.tipo] || {}
                return (
                  <tr key={g.id}>
                    <td style={{ fontSize: 11, fontWeight: 600 }}>{nombreSitio(g.sitio)}</td>
                    <td>
                      <span className="badge" style={{ background: tc.bg, color: tc.color, fontSize: 9 }}>
                        {g.tipo}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{g.desc}</td>
                    <td style={{ fontSize: 10, color: '#666' }}>{g.sub_sitio || '—'}</td>
                    <td className="num fw7">{cop(g.valor)}</td>
                    {!isViewer && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-del"
                          style={{ marginRight: 4, background: '#f0f7ff', color: '#1d4ed8', border: '1px solid #93c5fd' }}
                          onClick={() => setEditing(g)}
                          title="Editar"
                        >
                          ✎
                        </button>
                        <button className="btn-del" onClick={() => handleEliminar(g)} title="Eliminar">✕</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
                <tr className="tr-tot">
                  <td colSpan={4}><strong>TOTAL</strong></td>
                  <td className="num fw8">{cop(totalGeneral)}</td>
                  {!isViewer && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Modales ────────────────────────────────────────── */}
      <GastoModal
        open={modalAdd}
        onClose={() => setModalAdd(false)}
      />
      <GastoModal
        open={!!editing}
        gasto={editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmModalUI />
    </>
  )
}
