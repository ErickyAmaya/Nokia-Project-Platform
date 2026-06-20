import { useRef, useMemo, useState, useEffect } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS, getSmpCat, SMP_CATS } from '../../store/useFactStore'
import { loadRolloutData, loadRolloutFromSupabase } from '../../lib/rolloutImport'
import { showToast } from '../../components/Toast'
import { ComposedChart, Bar, Line, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar, Legend, Cell } from 'recharts'
import ReactApexChart from 'react-apexcharts'

// ── Utilidades KPI tiempo de liberación ───────────────────────────
function parsePpaDate(v) {
  if (!v) return null
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const n = parseFloat(s)
  if (!isNaN(n) && n > 10000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  return null
}
const normMs = s => (s||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
const diffDays = (a, b) => {
  if (!a || !b) return null
  const d = Math.round((new Date(b) - new Date(a)) / 86400000)
  return d >= 0 ? d : null
}
const avgArr = arr => arr.length ? Math.round(arr.reduce((a,v)=>a+v,0)/arr.length) : 0
const KPI_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const getPeriodKey = (monthKey, groupBy) => {
  const [y, m] = monthKey.split('-').map(Number)
  if (groupBy === 'trimestre') return `${y}-Q${Math.ceil(m/3)}`
  if (groupBy === 'semestre')  return `${y}-H${m<=6?1:2}`
  return monthKey
}
const getPeriodLabel = (key, groupBy) => {
  if (groupBy === 'mes') {
    const [y, m] = key.split('-').map(Number)
    return `${KPI_MESES[m-1]} '${String(y).slice(2)}`
  }
  const [y, p] = key.split('-')
  return `${p} ${y}`
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function fmtMes(yyyymm) {
  const [y, m] = yyyymm.split('-')
  return `${MESES[parseInt(m) - 1]} '${y.slice(2)}`
}
function fmtK(v) {
  if (!v) return '$0'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v}`
}

function RechazadosModal({ items, onClose, onDelete }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 580, boxShadow: '0 20px 60px rgba(0,0,0,.2)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>PDFs de PO rechazados</div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>SPOs que no coincidieron con el PPA cargado. Revisa y elimina los que ya no apliquen.</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#4b5563', lineHeight: 1, padding: '0 0 0 12px' }}>✕</button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#617561', fontSize: 13 }}>Sin registros rechazados.</div>
        ) : (
          <div style={{ overflow: 'auto', flex: 1, marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f8faf8' }}>
                  {['Archivo PDF', 'SPO extraído', 'Fecha', ''].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#555', fontSize: 10, position: 'sticky', top: 0, background: '#f8faf8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 10px', fontSize: 10, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.filename}>{r.filename}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#ef4444' }}>{r.spo_number || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#4b5563', fontSize: 10 }}>{r.rejected_at ? new Date(r.rejected_at).toLocaleDateString('es-CO') : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <button
                        onClick={() => onDelete(r.id)}
                        style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 20px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function PeriodoActual({ calendar }) {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const day   = now.getDate()

  const period = calendar.find(c => c.year === year && c.month === month)
  if (!period) return null

  const notStarted = day < period.start_day
  const isOpen     = !notStarted && day <= period.cutoff_day
  const daysLeft   = period.cutoff_day - day

  // Periodo abierto: solo muestra el periodo actual
  if (isOpen) return (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#166534' }}>Periodo de facturación</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{period.month_name} {period.year}</div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Apertura: día {period.start_day} · Cierre: día {period.cutoff_day}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 4 }}>● ABIERTO</div>
        {daysLeft >= 0 && (
          <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>{daysLeft === 0 ? 'Cierra hoy' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} para el cierre`}</div>
        )}
      </div>
    </div>
  )

  // Periodo aún no iniciado: muestra mes anterior como finalizado + mes actual por iniciar
  if (notStarted) {
    const prevMonth  = month === 1 ? 12 : month - 1
    const prevYear   = month === 1 ? year - 1 : year
    const prevPeriod = calendar.find(c => c.year === prevYear && c.month === prevMonth)
    const daysToStart = period.start_day - day

    return (
      <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 10, overflow: 'hidden', border: '1px solid #fca5a5' }}>
        {prevPeriod && (
          <div style={{ background: '#fef2f2', padding: '12px 16px', flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#991b1b' }}>Periodo Anterior Finalizado</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{prevPeriod.month_name} {prevPeriod.year}</div>
            <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 2 }}>Cerrado: día {prevPeriod.cutoff_day}</div>
          </div>
        )}
        {prevPeriod && <div style={{ background: '#fee2e2', display: 'flex', alignItems: 'center', padding: '0 10px', color: '#dc2626', fontSize: 20, fontWeight: 700 }}>→</div>}
        <div style={{ background: '#fffbeb', padding: '12px 16px', flex: 1, borderLeft: prevPeriod ? '1px solid #fcd34d' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#92400e' }}>Próximo Periodo</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{period.month_name} {period.year}</div>
            <div style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>
              Inicia: día {period.start_day}
            </div>
          </div>
          {daysToStart > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: '#b45309', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 4 }}>Inicia en:</span>
              <div className="period-countdown" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #f59e0b', background: '#fef3c7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, lineHeight: 1, color: '#92400e' }}>{daysToStart}</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: '#b45309', letterSpacing: .5, textTransform: 'uppercase' }}>días</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Periodo cerrado (day > cutoff_day): muestra mes actual finalizado + próximo mes
  const nextMonth  = month === 12 ? 1 : month + 1
  const nextYear   = month === 12 ? year + 1 : year
  const nextPeriod = calendar.find(c => c.year === nextYear && c.month === nextMonth)
  const daysToNext = nextPeriod ? (() => {
    const start = new Date(nextYear, nextMonth - 1, nextPeriod.start_day)
    return Math.ceil((start - now) / 86400000)
  })() : null

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 10, overflow: 'hidden', border: '1px solid #fca5a5' }}>
      <div style={{ background: '#fef2f2', padding: '12px 16px', flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#991b1b' }}>Periodo Actual Finalizado</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{period.month_name} {period.year}</div>
        <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 2 }}>Cerrado: día {period.cutoff_day}</div>
      </div>
      {nextPeriod && (
        <>
          <div style={{ background: '#fee2e2', display: 'flex', alignItems: 'center', padding: '0 10px', color: '#dc2626', fontSize: 20, fontWeight: 700 }}>→</div>
          <div style={{ background: '#fffbeb', padding: '12px 16px', flex: 1, borderLeft: '1px solid #fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#92400e' }}>Próximo Periodo</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{nextPeriod.month_name} {nextPeriod.year}</div>
              <div style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>
                Inicia: día {nextPeriod.start_day}
              </div>
            </div>
            {daysToNext > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#b45309', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 4 }}>Inicia en:</span>
                <div className="period-countdown" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #f59e0b', background: '#fef3c7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, lineHeight: 1, color: '#92400e' }}>{daysToNext}</span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: '#b45309', letterSpacing: .5, textTransform: 'uppercase' }}>días</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CatProgressBar({ cat, pf, fc, sinGR, total }) {
  const pct_fc = total > 0 ? (fc / total) * 100 : 0
  const pct_pf = total > 0 ? (pf / total) * 100 : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ fontWeight: 700, color: cat.color }}>{cat.label}</span>
        <span style={{ color: '#4b5563', fontSize: 11 }}>
          {fc > 0 && <span style={{ color: '#22c55e', marginRight: 8 }}>✓ {fc} facturado{fc !== 1 ? 's' : ''}</span>}
          {pf > 0 && <span style={{ color: '#ef4444', marginRight: 8 }}>⚠ {pf} pendiente{pf !== 1 ? 's' : ''}</span>}
          {sinGR > 0 && <span style={{ color: '#f59e0b' }}>○ {sinGR} sin sGR</span>}
        </span>
      </div>
      <div style={{ height: 16, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${pct_fc}%`, background: '#22c55e', transition: 'width .4s' }} />
        <div style={{ width: `${pct_pf}%`, background: '#ef4444', transition: 'width .4s' }} />
      </div>
    </div>
  )
}

function PpaRemovedModal({ items, onClose, onCancel, onDelete }) {
  const [done, setDone] = useState({})  // { spo_number: 'cancelled' | 'deleted' }
  const [loading, setLoading] = useState({})

  async function handleCancel(spo) {
    setLoading(l => ({ ...l, [spo]: true }))
    await onCancel(spo)
    setDone(d => ({ ...d, [spo]: 'cancelled' }))
    setLoading(l => ({ ...l, [spo]: false }))
  }

  async function handleDelete(spo) {
    setLoading(l => ({ ...l, [spo]: true }))
    await onDelete(spo)
    setDone(d => ({ ...d, [spo]: 'deleted' }))
    setLoading(l => ({ ...l, [spo]: false }))
  }

  const allDone = items.every(i => done[i.spo_number])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 580, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>SPOs removidos del PPA</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 16 }}>
          {items.length} SPO{items.length !== 1 ? 's' : ''} que estaban en el sistema ya no aparecen en el nuevo PPA — es probable que Nokia los haya eliminado o cancelado.
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          {items.map((item, i) => {
            const status = done[item.spo_number]
            const busy   = loading[item.spo_number]
            return (
              <div key={item.spo_number} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i > 0 ? '1px solid #f0f0f0' : undefined, background: status ? '#f9fafb' : '#fff', opacity: status ? 0.7 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#374151' }}>{item.spo_number}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{item.site_name} · {item.smp_name}</div>
                  {item.has_pdf && <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>📄 Tiene PDF cargado</div>}
                </div>
                {status === 'cancelled' && <span style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>Marcada cancelada</span>}
                {status === 'deleted'   && <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>Eliminada</span>}
                {!status && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleCancel(item.spo_number)} disabled={busy}
                      style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {busy ? '…' : 'Marcar cancelada'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.spo_number)} disabled={busy}
                      style={{ fontSize: 10, fontWeight: 700, color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {busy ? '…' : 'Eliminar del sistema'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 20px', borderRadius: 8, border: '1px solid #e0e4e0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {allDone ? 'Cerrar' : 'Cerrar sin acción'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FactDashboard() {
  const fileRef          = useRef(null)
  const uploadPPA        = useFactStore(s => s.uploadPPA)
  const cancelPOBySpo    = useFactStore(s => s.cancelPOBySpo)
  const removePOFromSystem = useFactStore(s => s.removePOFromSystem)
  const uploading        = useFactStore(s => s.uploading)
  const uploads          = useFactStore(s => s.uploads)
  const ppa              = useFactStore(s => s.ppa)
  const invoices         = useFactStore(s => s.invoices)
  const _rawPos          = useFactStore(s => s.pos)
  const pos              = useMemo(() => _rawPos.filter(p => !p.cancelled), [_rawPos])
  const cancelledSpos    = useMemo(() => new Set(_rawPos.filter(p => p.cancelled).map(p => p.spo_number)), [_rawPos])
  const calendar         = useFactStore(s => s.calendar)
  const rejectedPos      = useFactStore(s => s.rejectedPos)
  const deleteRejectedPo = useFactStore(s => s.deleteRejectedPo)

  const [showRejected,   setShowRejected]   = useState(false)
  const [selectedMonth,  setSelectedMonth]  = useState('')
  const [removedModal,   setRemovedModal]   = useState(null)  // array of removed SPO items
  const [rolloutItems,    setRolloutItems]    = useState(() => loadRolloutData()?.items || null)
  const [kpiGroupBy,      setKpiGroupBy]      = useState('mes')
  const [kpiSelRange,     setKpiSelRange]     = useState(null) // [startIdx, endIdx] | null
  const kpiDragStart = useRef(null)

  useEffect(() => {
    if (rolloutItems) return
    loadRolloutFromSupabase().then(d => { if (d?.items) setRolloutItems(d.items) })
  }, [])

  useEffect(() => { setKpiSelRange(null) }, [kpiGroupBy])

  useEffect(() => {
    const onUp = () => { kpiDragStart.current = null }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [])


  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  // PPA lookup: smpId|normMs → { libDate }
  const ppaLibMap = useMemo(() => {
    if (!ppa.length) return new Map()
    const m = new Map()
    for (const row of ppa) {
      const key = `${(row.smp_id||'').toUpperCase()}|${normMs(row.ms_name)}`
      if (m.has(key)) continue
      const grDate  = parsePpaDate(row.gr_date)
      const pctDate = parsePpaDate(row.servicio_ejecutado_ppa_date)
      let libDate = null
      if (grDate && pctDate)                              libDate = pctDate > grDate ? pctDate : grDate
      else if (grDate && (row.servicio_ejecutado_pct||0)>0) libDate = grDate
      m.set(key, libDate)
    }
    return m
  }, [ppa])

  // Per-site timings with month of mosDate as period anchor
  const siteTimings = useMemo(() => {
    if (!rolloutItems || !ppaLibMap.size) return []
    const out = []
    for (const r of rolloutItems) {
      const id = (r.smpId||'').toUpperCase()
      const anchor = r.mosDate?.slice(0,7) || r.intgDate?.slice(0,7) || r.acepDate?.slice(0,7)
      if (!anchor) continue

      const getLib = msName => ppaLibMap.get(`${id}|${normMs(msName)}`) || null

      const mosLib  = r.mosDate  ? getLib('SS MOS ok')            : null
      const intgLib = r.intgDate ? getLib('SS Integracion ok')    : null
      const acepLib = r.acepDate ? getLib('SS Aceptacion final ok') : null

      const mosDays  = diffDays(r.mosDate,  mosLib)
      const intgDays = diffDays(r.intgDate, intgLib)
      const acepDays = diffDays(r.acepDate, acepLib)
      const totalDays = (r.mosDate && acepLib) ? diffDays(r.mosDate, acepLib) : null

      if (mosDays===null && intgDays===null && acepDays===null) continue
      out.push({ month: anchor, mosDays, intgDays, acepDays, totalDays })
    }
    return out
  }, [rolloutItems, ppaLibMap])

  // Sorted list of unique period keys
  const availablePeriods = useMemo(() => {
    const seen = new Set()
    for (const s of siteTimings) {
      const k = getPeriodKey(s.month, kpiGroupBy)
      seen.add(k)
    }
    return [...seen].sort()
  }, [siteTimings, kpiGroupBy])

  // Trend line data: always monthly so selecting a quarter/semester shows its individual months
  const kpiTrendData = useMemo(() => {
    const buckets = new Map()
    for (const s of siteTimings) {
      const k = s.month // always YYYY-MM
      if (!buckets.has(k)) buckets.set(k, { mos:[], intg:[], acep:[], total:[] })
      const b = buckets.get(k)
      if (s.mosDays   !== null) b.mos.push(s.mosDays)
      if (s.intgDays  !== null) b.intg.push(s.intgDays)
      if (s.acepDays  !== null) b.acep.push(s.acepDays)
      if (s.totalDays !== null) b.total.push(s.totalDays)
    }
    return [...buckets.keys()].sort().map(k => ({
      period: k,
      label:  getPeriodLabel(k, 'mes'),
      mos:    avgArr(buckets.get(k)?.mos   || []) || null,
      intg:   avgArr(buckets.get(k)?.intg  || []) || null,
      acep:   avgArr(buckets.get(k)?.acep  || []) || null,
      total:  avgArr(buckets.get(k)?.total || []) || null,
    }))
  }, [siteTimings])

  // Summary bars for selected periods (or all if none selected)
  const kpiSummaryBars = useMemo(() => {
    const active = kpiSelRange
      ? siteTimings.filter(s => {
          const idx = availablePeriods.indexOf(getPeriodKey(s.month, kpiGroupBy))
          return idx >= kpiSelRange[0] && idx <= kpiSelRange[1]
        })
      : siteTimings
    const a = { mos:[], intg:[], acep:[], total:[] }
    for (const s of active) {
      if (s.mosDays   !== null) a.mos.push(s.mosDays)
      if (s.intgDays  !== null) a.intg.push(s.intgDays)
      if (s.acepDays  !== null) a.acep.push(s.acepDays)
      if (s.totalDays !== null) a.total.push(s.totalDays)
    }
    return [
      { label: 'MOS',          color: '#144E4A', avg: avgArr(a.mos),   n: a.mos.length   },
      { label: 'Integración',  color: '#0369a1', avg: avgArr(a.intg),  n: a.intg.length  },
      { label: 'Acept. Final', color: '#7c3aed', avg: avgArr(a.acep),  n: a.acep.length  },
      { label: 'Ciclo Total',  color: '#059669', avg: avgArr(a.total), n: a.total.length },
    ]
  }, [siteTimings, kpiSelRange, kpiGroupBy, availablePeriods])

  const stats = useMemo(() => {
    const activePpa = ppa.filter(r => !cancelledSpos.has(r.spo_number))
    let totalSPOs = activePpa.length, porFacturar = 0, facturado = 0, sinGR = 0
    let valorFacturar = 0, valorFacturado = 0, valorPendienteLib = 0
    for (const row of activePpa) {
      const eventos   = getEventosRow(row, invMap)
      const hasPF     = eventos.some(e => e.status === 'facturar')
      const hasFC     = eventos.some(e => e.status === 'facturado')
      const hasGR     = !!row.sgr
      const hasAnyPct = EVENTOS.some(ev => (row[ev.pctCol] || 0) > 0)
      const poData    = pos.find(p => p.spo_number === row.spo_number)
      const valor     = poData?.valor || 0

      if (!hasGR) sinGR++

      for (const ev of eventos) {
        if (ev.status === 'facturar')  { porFacturar++;  valorFacturar  += valor * (ev.pct / 100) }
        if (ev.status === 'facturado') { facturado++;    valorFacturado += valor * (ev.pct / 100) }
      }

      if (!hasPF && !hasFC && (!hasGR || !hasAnyPct)) {
        valorPendienteLib += valor
      }
    }
    return { totalSPOs, porFacturar, facturado, sinGR, valorFacturar, valorFacturado, valorPendienteLib }
  }, [ppa, invMap, pos, cancelledSpos])

  // Stats por categoría SMP
  const catStats = useMemo(() => {
    const map = {}
    for (const cat of [...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }]) {
      map[cat.key] = { cat, total: 0, pf: 0, fc: 0, sinGR: 0 }
    }
    for (const row of ppa) {
      if (cancelledSpos.has(row.spo_number)) continue
      const cat = getSmpCat(row.smp_name)
      const k   = cat.key in map ? cat.key : 'other'
      map[k].total++
      if (!row.sgr) { map[k].sinGR++; continue }
      const evs = getEventosRow(row, invMap)
      if (evs.some(e => e.status === 'facturar'))  map[k].pf++
      if (evs.some(e => e.status === 'facturado')) map[k].fc++
    }
    return Object.values(map).filter(c => c.total > 0)
  }, [ppa, invMap])

  const monthlyData = useMemo(() => {
    const map = {}
    for (const inv of invoices) {
      if (!inv.fecha_factura) continue
      const ppaRow = ppa.find(r => r.spo_number === inv.spo_number)
      if (!ppaRow) continue
      const ev = EVENTOS.find(e => e.key === inv.evento)
      if (!ev) continue
      const pct = ppaRow[ev.pctCol] || 0
      if (!pct) continue
      const poData = pos.find(p => p.spo_number === inv.spo_number)
      if (!poData?.valor) continue
      const key = inv.fecha_factura.slice(0, 7)
      if (!map[key]) map[key] = 0
      map[key] += poData.valor * pct / 100
    }
    const sorted = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, valor]) => ({ month, label: fmtMes(month), valor: Math.round(valor) }))
    return sorted.map((item, i) => {
      const slice = sorted.slice(Math.max(0, i - 2), i + 1)
      const avg = slice.reduce((s, x) => s + x.valor, 0) / slice.length
      return { ...item, tendencia: Math.round(avg) }
    })
  }, [invoices, ppa, pos])

  const ohlcData = useMemo(() => {
    const monthDays = {}
    for (const inv of invoices) {
      if (!inv.fecha_factura) continue
      const ppaRow = ppa.find(r => r.spo_number === inv.spo_number)
      if (!ppaRow) continue
      const ev = EVENTOS.find(e => e.key === inv.evento)
      if (!ev) continue
      const pct = ppaRow[ev.pctCol] || 0
      if (!pct) continue
      const poData = pos.find(p => p.spo_number === inv.spo_number)
      if (!poData?.valor) continue
      const month = inv.fecha_factura.slice(0, 7)
      const day   = inv.fecha_factura
      if (!monthDays[month]) monthDays[month] = {}
      if (!monthDays[month][day]) monthDays[month][day] = 0
      monthDays[month][day] += poData.valor * pct / 100
    }
    return Object.entries(monthDays)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, days]) => {
        const vals   = Object.values(days)
        const sorted = Object.entries(days).sort(([a], [b]) => a.localeCompare(b))
        const open   = Math.round(sorted[0][1])
        const close  = Math.round(sorted[sorted.length - 1][1])
        const high   = Math.round(Math.max(...vals))
        const low    = Math.round(Math.min(...vals))
        const [y, m] = month.split('-')
        return { x: `${MESES[parseInt(m) - 1]} '${y.slice(2)}`, y: [open, high, low, close] }
      })
  }, [invoices, ppa, pos])

  const activeMonth = selectedMonth || (monthlyData.length ? monthlyData[monthlyData.length - 1].month : '')

  const dailyData = useMemo(() => {
    if (!activeMonth) return []
    const map = {}
    for (const inv of invoices) {
      if (!inv.fecha_factura) continue
      if (inv.fecha_factura.slice(0, 7) !== activeMonth) continue
      const ppaRow = ppa.find(r => r.spo_number === inv.spo_number)
      if (!ppaRow) continue
      const ev = EVENTOS.find(e => e.key === inv.evento)
      if (!ev) continue
      const pct = ppaRow[ev.pctCol] || 0
      if (!pct) continue
      const poData = pos.find(p => p.spo_number === inv.spo_number)
      if (!poData?.valor) continue
      const day = inv.fecha_factura.slice(8, 10)
      if (!map[day]) map[day] = 0
      map[day] += poData.valor * pct / 100
    }
    const sorted = Object.entries(map)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([day, valor]) => ({ day: parseInt(day), label: `${parseInt(day)}`, valor: Math.round(valor) }))
    return sorted.map((item, i) => {
      const slice = sorted.slice(Math.max(0, i - 2), i + 1)
      const avg = slice.reduce((s, x) => s + x.valor, 0) / slice.length
      return { ...item, tendencia: Math.round(avg) }
    })
  }, [invoices, ppa, pos, activeMonth])

  const catValueStats = useMemo(() => {
    const CAT_KEYS = ['impl', 'adj', 'cw', 'cr', 'tss', 'other']
    const allCats = [...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }]
    const map = Object.fromEntries(allCats.map(c => [c.key, { cat: c, fc: 0, pf: 0, lib: 0 }]))
    for (const row of ppa) {
      const cat = getSmpCat(row.smp_name)
      const k   = cat.key in map ? cat.key : 'other'
      const poData = pos.find(p => p.spo_number === row.spo_number)
      const valor  = poData?.valor || 0
      if (!valor) continue
      const evs    = getEventosRow(row, invMap)
      const hasPF  = evs.some(e => e.status === 'facturar')
      const hasFC  = evs.some(e => e.status === 'facturado')
      const hasGR  = !!row.sgr
      const hasPct = EVENTOS.some(ev => (row[ev.pctCol] || 0) > 0)
      for (const ev of evs) {
        if (ev.status === 'facturar')  map[k].pf += valor * (ev.pct / 100)
        if (ev.status === 'facturado') map[k].fc += valor * (ev.pct / 100)
      }
      if (!hasPF && !hasFC && (!hasGR || !hasPct)) map[k].lib += valor
    }
    return CAT_KEYS
      .filter(k => map[k] && (map[k].fc + map[k].pf + map[k].lib > 0))
      .map(k => ({
        label: map[k].cat.label,
        color: map[k].cat.color,
        fc:    Math.round(map[k].fc),
        pf:    Math.round(map[k].pf),
        lib:   Math.round(map[k].lib),
      }))
  }, [ppa, pos, invMap])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await uploadPPA(file)
    if (result.ok) {
      showToast(`PPA cargado — ${result.count} SPOs`)
      if (result.removed?.length > 0) setRemovedModal(result.removed)
    } else {
      showToast('Error: ' + result.error, 'err')
    }
    e.target.value = ''
  }

  const lastUpload = uploads[0]
  const fmtCOP = v => v > 0
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
    : '—'

  // Breakdown por evento: los 5 primeros normales + servicio abierto por cat SMP
  const NON_SERV = EVENTOS.filter(e => e.key !== 'servicio')
  const SERV_EV  = EVENTOS.find(e => e.key === 'servicio')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showRejected && (
        <RechazadosModal
          items={rejectedPos}
          onClose={() => setShowRejected(false)}
          onDelete={async id => { try { await deleteRejectedPo(id) } catch (e) { showToast('Error: ' + e.message, 'err') } }}
        />
      )}
      {removedModal && (
        <PpaRemovedModal
          items={removedModal}
          onClose={() => setRemovedModal(null)}
          onCancel={async spo => {
            const r = await cancelPOBySpo(spo)
            if (!r.ok) showToast('Error al cancelar: ' + r.error, 'err')
          }}
          onDelete={async spo => {
            const r = await removePOFromSystem(spo)
            if (!r.ok) showToast('Error al eliminar: ' + r.error, 'err')
          }}
        />
      )}

      <PeriodoActual calendar={calendar} />

      {/* Upload */}
      <div className="card">
        <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Archivo PPA Nokia</h2>
            {lastUpload && (
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>
                <span style={{ fontWeight: 700, color: '#09090b' }}>{lastUpload.filename}</span>
                {' '}
                <span>({lastUpload.row_count} SPOs · cargado {new Date(lastUpload.uploaded_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })})</span>
              </div>
            )}
            {!lastUpload && (
              <div style={{ fontSize: 11, color: '#617561', marginTop: 3 }}>Sin archivo cargado</div>
            )}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: '#144E4A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5, flexShrink: 0 }}>
            {uploading ? '⏳ Cargando…' : '↑ Cargar PPA Nokia'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      </div>

      {/* POs rechazadas */}
      {rejectedPos.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 2 }}>PDFs de PO rechazados</div>
            <div style={{ fontSize: 12, color: '#78350f' }}>
              {rejectedPos.length} archivo{rejectedPos.length !== 1 ? 's' : ''} no coincidieron con el PPA — revísalos y elimina los que no apliquen.
            </div>
          </div>
          <button
            onClick={() => setShowRejected(true)}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5 }}
          >
            Ver {rejectedPos.length} rechazado{rejectedPos.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {ppa.length > 0 && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { label: 'Total SPOs',   val: stats.totalSPOs,   color: '#144E4A' },
              { label: 'Por Facturar', val: stats.porFacturar, color: '#ef4444' },
              { label: 'Facturado',    val: stats.facturado,   color: '#22c55e' },
              { label: 'Sin sGR',      val: stats.sinGR,       color: '#f59e0b' },
            ].map(k => (
              <div key={k.label} className="stat" style={{ borderLeftColor: k.color, padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: k.color, letterSpacing: .5, textTransform: 'uppercase' }}>{k.label}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: '#09090b', lineHeight: 1.1 }}>{k.val}</div>
              </div>
            ))}
          </div>

          {(stats.valorFacturar > 0 || stats.valorFacturado > 0 || stats.valorPendienteLib > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div className="stat" style={{ borderLeftColor: '#ef4444', padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: .5, textTransform: 'uppercase' }}>Valor Por Facturar</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{fmtCOP(stats.valorFacturar)}</div>
                <div style={{ fontSize: 9, color: '#617561' }}>Según valor de POs cargadas</div>
              </div>
              <div className="stat" style={{ borderLeftColor: '#f59e0b', padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', letterSpacing: .5, textTransform: 'uppercase' }}>Valor Pendiente de Liberación</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{fmtCOP(stats.valorPendienteLib)}</div>
                <div style={{ fontSize: 9, color: '#617561' }}>SPOs sin GR y/o sin %</div>
              </div>
              <div className="stat" style={{ borderLeftColor: '#22c55e', padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', letterSpacing: .5, textTransform: 'uppercase' }}>Valor Facturado</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{fmtCOP(stats.valorFacturado)}</div>
                <div style={{ fontSize: 9, color: '#617561' }}>Según valor de POs cargadas</div>
              </div>
            </div>
          )}

          {/* Fila 1: Facturación mensual (barras) + Evolución del período (diaria) */}
          {monthlyData.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {/* Facturación mensual — barras + tendencia */}
              <div className="card">
                <div className="card-h"><h2>Facturación mensual</h2></div>
                <div className="card-b">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={monthlyData} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#617561' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#617561' }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip
                        formatter={(val, name) => [fmtCOP(val), name === 'valor' ? 'Facturado' : 'Tendencia 3M']}
                        labelStyle={{ fontSize: 11, fontWeight: 700 }}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e0e4e0' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="valor" fill="#144E4A" radius={[3, 3, 0, 0]} name="valor" />
                      <Line dataKey="tendencia" stroke="#f59e0b" strokeWidth={2} dot={false} name="tendencia" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 9, color: '#4b5563' }}>
                    <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#144E4A', borderRadius: 2, marginRight: 4 }} />Facturado (mes)</span>
                    <span><span style={{ display: 'inline-block', width: 24, height: 2, background: '#f59e0b', borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }} />Tendencia 3 meses</span>
                  </div>
                </div>
              </div>

              {/* Evolución diaria del período */}
              <div className="card">
                <div className="card-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0 }}>Evolución del período</h2>
                    {dailyData.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '2px 10px' }}>
                        {fmtCOP(dailyData.reduce((s, d) => s + d.valor, 0))}
                      </span>
                    )}
                  </div>
                  <select value={activeMonth} onChange={e => setSelectedMonth(e.target.value)}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #d1d5db', color: '#374151', background: '#fff', cursor: 'pointer' }}>
                    {monthlyData.map(m => <option key={m.month} value={m.month}>{m.label}</option>)}
                  </select>
                </div>
                <div className="card-b">
                  {dailyData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={dailyData} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#617561' }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#617561' }} axisLine={false} tickLine={false} width={52} />
                          <Tooltip
                            formatter={(val, name) => [fmtCOP(val), name === 'valor' ? 'Facturado' : 'Tendencia 3D']}
                            labelFormatter={label => `Día ${label}`}
                            labelStyle={{ fontSize: 11, fontWeight: 700 }}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e0e4e0' }}
                            cursor={{ fill: 'transparent' }}
                          />
                          <Bar dataKey="valor" fill="#1d4ed8" radius={[3, 3, 0, 0]} name="valor" />
                          <Line dataKey="tendencia" stroke="#f59e0b" strokeWidth={2} dot={false} name="tendencia" />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 9, color: '#4b5563' }}>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#1d4ed8', borderRadius: 2, marginRight: 4 }} />Facturado por día</span>
                        <span><span style={{ display: 'inline-block', width: 24, height: 2, background: '#f59e0b', borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }} />Tendencia 3 días</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca89c', fontSize: 12 }}>Sin facturas registradas para este período</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Fila 2: RadialBar (valor por categoría) + Candlestick (distribución mensual) */}
          {(catValueStats.length > 0 || ohlcData.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {/* RadialBarChart — valor total por categoría */}
              {catValueStats.length > 0 && (
                <div className="card">
                  <div className="card-h"><h2>Valor COP por categoría</h2></div>
                  <div className="card-b" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadialBarChart
                        innerRadius="20%" outerRadius="90%"
                        data={catValueStats.map(c => ({ name: c.label, valor: c.fc + c.pf + c.lib, fill: c.color })).sort((a, b) => b.valor - a.valor)}
                        startAngle={180} endAngle={-180}
                      >
                        <RadialBar dataKey="valor" cornerRadius={4} background={{ fill: '#f4f4f5' }} />
                        <Tooltip formatter={val => [fmtCOP(val), 'Valor total']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e0e4e0' }} />
                        <Legend iconSize={8} iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 10, color: '#4b5563' }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Candlestick — distribución diaria por mes */}
              {ohlcData.length > 0 && (
                <div className="card">
                  <div className="card-h"><h2>Distribución diaria por mes</h2></div>
                  <div className="card-b">
                    <ReactApexChart
                      type="candlestick"
                      height={250}
                      series={[{ data: ohlcData }]}
                      options={{
                        chart: { toolbar: { show: false }, background: 'transparent' },
                        xaxis: { type: 'category', labels: { style: { fontSize: '10px', colors: '#617561' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                        yaxis: { labels: { formatter: fmtK, style: { fontSize: '10px', colors: '#617561' } } },
                        grid: { borderColor: '#f0f0f0', strokeDashArray: 3, xaxis: { lines: { show: false } } },
                        plotOptions: {
                          candlestick: {
                            colors: { upward: '#86efac', downward: '#ef4444' },
                            wick: { useFillColor: true },
                          },
                        },
                        tooltip: {
                          custom({ seriesIndex, dataPointIndex, w }) {
                            const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex]
                            const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex]
                            const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex]
                            const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex]
                            const fmt = v => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
                            return `<div style="padding:10px;font-size:11px;line-height:1.8">
                              <b>${w.globals.labels[dataPointIndex]}</b><br/>
                              🟢 Primer día: ${fmt(o)}<br/>
                              ↑ Máximo día: ${fmt(h)}<br/>
                              ↓ Mínimo día: ${fmt(l)}<br/>
                              🔵 Último día: ${fmt(c)}
                            </div>`
                          }
                        },
                      }}
                    />
                    <div style={{ display: 'flex', gap: 16, fontSize: 9, color: '#4b5563' }}>
                      <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#86efac', borderRadius: 2, marginRight: 4 }} />Último día &gt; primer día</span>
                      <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />Primer día &gt; último día</span>
                      <span style={{ color: '#9ca3af' }}>Mechas = día máx/mín</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tiempo de Liberación por Hito ───────────────────────── */}
          <div className="card">
            <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2>Tiempo de Liberación por Hito</h2>
              <span style={{ fontSize: 10, color: '#617561', fontWeight: 400 }}>días promedio · actividad en campo → GR+% en PPA</span>
            </div>
            <div className="card-b">
              {!rolloutItems ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca89c', fontSize: 12 }}>
                  Carga el Rollout en "Por Facturar" para ver este análisis.
                </div>
              ) : !siteTimings.length ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca89c', fontSize: 12, lineHeight: 1.6 }}>
                  Sin datos de tiempos de campo.<br />
                  <span style={{ fontSize: 11 }}>Vuelve a cargar el Rollout en "Por Facturar" para actualizar este análisis.</span>
                </div>
              ) : (
                <>
                  {/* ── Timeline slicer ── */}
                  {(() => {
                    const CELL_W = kpiGroupBy === 'semestre' ? 88 : kpiGroupBy === 'trimestre' ? 68 : 52
                    // Year header groups
                    const yearGroups = []
                    for (const k of availablePeriods) {
                      const yr = k.split('-')[0]
                      if (yearGroups.length && yearGroups[yearGroups.length-1].year === yr)
                        yearGroups[yearGroups.length-1].count++
                      else yearGroups.push({ year: yr, count: 1 })
                    }
                    const selLabel = kpiSelRange
                      ? kpiSelRange[0] === kpiSelRange[1]
                        ? getPeriodLabel(availablePeriods[kpiSelRange[0]], kpiGroupBy)
                        : `${getPeriodLabel(availablePeriods[kpiSelRange[0]], kpiGroupBy)} – ${getPeriodLabel(availablePeriods[kpiSelRange[1]], kpiGroupBy)}`
                      : 'Todos los períodos'
                    return (
                      <div style={{ marginBottom: 12, background: '#f8faf8', borderRadius: 8, padding: '8px 10px', border: '1px solid #e8eae8' }}>
                        {/* Top row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', minWidth: 120 }}>{selLabel}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            {kpiSelRange && (
                              <button onClick={() => setKpiSelRange(null)} style={{ padding: '1px 7px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', color: '#ef4444', fontSize: 10, cursor: 'pointer', marginRight: 6 }}>✕</button>
                            )}
                            {['mes', 'trimestre', 'semestre'].map(g => (
                              <button key={g} onClick={() => setKpiGroupBy(g)} style={{
                                padding: '2px 8px', borderRadius: 4, border: '1px solid',
                                borderColor: kpiGroupBy === g ? '#144E4A' : '#d1d5db',
                                background: kpiGroupBy === g ? '#144E4A' : '#fff',
                                color: kpiGroupBy === g ? '#fff' : '#617561',
                                fontSize: 9, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: .4,
                              }}>{g}</button>
                            ))}
                          </div>
                        </div>
                        {/* Timeline bar */}
                        <div style={{ overflowX: 'auto', userSelect: 'none' }}>
                          {/* Year labels row */}
                          <div style={{ display: 'flex', paddingBottom: 2 }}>
                            {yearGroups.map(({ year, count }) => (
                              <div key={year} style={{ flex: `0 0 ${count * CELL_W}px`, fontSize: 10, fontWeight: 700, color: '#374151', paddingLeft: 4, borderLeft: '2px solid #d1d5db' }}>
                                {year}
                              </div>
                            ))}
                          </div>
                          {/* Period cells */}
                          <div
                            style={{ display: 'flex' }}
                            onTouchMove={e => {
                              if (kpiDragStart.current === null) return
                              const touch = e.touches[0]
                              const target = document.elementFromPoint(touch.clientX, touch.clientY)
                              const cell = target?.closest('[data-pidx]')
                              if (!cell) return
                              const j = Number(cell.dataset.pidx)
                              const s = kpiDragStart.current
                              setKpiSelRange([Math.min(s, j), Math.max(s, j)])
                            }}
                            onTouchEnd={() => { kpiDragStart.current = null }}
                          >
                            {availablePeriods.map((k, i) => {
                              const sel = kpiSelRange && i >= kpiSelRange[0] && i <= kpiSelRange[1]
                              const isStart = kpiSelRange && i === kpiSelRange[0]
                              const isEnd   = kpiSelRange && i === kpiSelRange[1]
                              return (
                                <div
                                  key={k}
                                  data-pidx={i}
                                  style={{
                                    flex: `0 0 ${CELL_W}px`,
                                    height: 30,
                                    background: sel ? '#0369a1' : '#e8eae8',
                                    color: sel ? '#fff' : '#617561',
                                    fontSize: 9, fontWeight: sel ? 700 : 400,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderLeft: isStart ? '2px solid #0284c7' : '1px solid #fff',
                                    borderRight: isEnd  ? '2px solid #0284c7' : 'none',
                                    borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
                                    cursor: 'pointer',
                                    transition: 'background .08s',
                                  }}
                                  onMouseDown={e => {
                                    e.preventDefault()
                                    kpiDragStart.current = i
                                    setKpiSelRange([i, i])
                                  }}
                                  onMouseEnter={() => {
                                    if (kpiDragStart.current === null) return
                                    const s = kpiDragStart.current
                                    setKpiSelRange([Math.min(s, i), Math.max(s, i)])
                                  }}
                                  onTouchStart={e => {
                                    kpiDragStart.current = i
                                    setKpiSelRange([i, i])
                                  }}
                                >
                                  {getPeriodLabel(k, kpiGroupBy)}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── Dos gráficas lado a lado ── */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

                    {/* Izquierda — tendencia mensual */}
                    <div style={{ flex: '1 1 0', minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: '#9ca89c', marginBottom: 4 }}>Tendencia mensual</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={(() => {
                              if (!kpiSelRange) return kpiTrendData
                              const selKeys = new Set(availablePeriods.slice(kpiSelRange[0], kpiSelRange[1] + 1))
                              return kpiTrendData.filter(d => selKeys.has(getPeriodKey(d.period, kpiGroupBy)))
                            })()} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca89c' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: '#9ca89c' }} axisLine={false} tickLine={false} width={32} tickFormatter={v => `${v}d`} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              return (
                                <div style={{ background: '#fff', border: '1px solid #e0e4e0', borderRadius: 8, padding: '8px 12px', fontSize: 10, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
                                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#374151' }}>{label}</div>
                                  {payload.map(p => p.value != null && (
                                    <div key={p.dataKey} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                      <span>{p.name}</span><strong>{p.value}d</strong>
                                    </div>
                                  ))}
                                </div>
                              )
                            }}
                          />
                          <Line type="monotone" dataKey="total" name="Ciclo Total"  stroke="#059669" strokeWidth={2.5} dot={{ r: 3, fill: '#059669' }} connectNulls />
                          <Line type="monotone" dataKey="acep"  name="Acept. Final" stroke="#7c3aed" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" connectNulls />
                          <Line type="monotone" dataKey="intg"  name="Integración"  stroke="#0369a1" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" connectNulls />
                          <Line type="monotone" dataKey="mos"   name="MOS"          stroke="#144E4A" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, paddingLeft: 4 }}>
                        {[['#059669','Ciclo Total'],['#7c3aed','Acept. Final'],['#0369a1','Integración'],['#144E4A','MOS']].map(([c,l]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 14, height: 2.5, background: c, borderRadius: 2 }} />
                            <span style={{ fontSize: 9, color: '#617561' }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Derecha — barras de resumen */}
                    <div style={{ flex: '0 0 200px', minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: '#9ca89c', marginBottom: 4 }}>
                        {kpiSelRange ? `${kpiSelRange[1] - kpiSelRange[0] + 1} período(s) seleccionado(s)` : 'Todos los períodos'}
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={kpiSummaryBars} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 600, fill: '#374151' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: '#9ca89c' }} axisLine={false} tickLine={false} width={32} tickFormatter={v => `${v}d`} />
                          <Tooltip
                            cursor={{ fill: '#f8faf8' }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload
                              if (!d.n) return null
                              return (
                                <div style={{ background: '#fff', border: '1px solid #e0e4e0', borderRadius: 8, padding: '8px 12px', fontSize: 10, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
                                  <div style={{ fontWeight: 700, color: d.color, marginBottom: 3 }}>{d.label}</div>
                                  <div>Promedio: <strong>{d.avg} días</strong></div>
                                  <div style={{ color: '#617561' }}>n = {d.n} SMPs</div>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="avg" radius={[5, 5, 0, 0]}
                            label={{ position: 'top', fontSize: 11, fontWeight: 700, fill: '#09090b', formatter: v => v > 0 ? `${v}d` : '' }}>
                            {kpiSummaryBars.map((e, i) => (
                              <Cell key={i} fill={e.n > 0 ? e.color : '#e5e7eb'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 2 }}>
                        {kpiSummaryBars.map(h => (
                          <div key={h.label} style={{ textAlign: 'center', fontSize: 9, color: '#9ca89c' }}>
                            {h.n > 0 ? `n=${h.n}` : '—'}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>
          </div>

          {/* Breakdown por evento */}
          <div className="card">
            <div className="card-h"><h2>Estado por tipo de evento</h2></div>
            <div className="card-b">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8faf8' }}>
                    {['Evento', 'Por Facturar', 'Facturado', 'Sin sGR / No aplica'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Evento' ? 'left' : 'center', fontWeight: 700, color: '#555', fontSize: 10, letterSpacing: .5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NON_SERV.map(ev => {
                    let pf = 0, fc = 0, na = 0
                    for (const row of ppa) {
                      if (!row[ev.pctCol] || row[ev.pctCol] <= 0) { na++; continue }
                      if (!row.sgr) { na++; continue }
                      invMap[`${row.spo_number}|${ev.key}`] ? fc++ : pf++
                    }
                    return (
                      <tr key={ev.key} style={{ borderTop: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, display: 'inline-block' }} />
                            <span style={{ fontWeight: 600 }}>{ev.label}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: pf > 0 ? '#ef4444' : '#ccc', fontWeight: pf > 0 ? 700 : 400 }}>{pf || '—'}</td>
                        <td style={{ textAlign: 'center', color: fc > 0 ? '#22c55e' : '#ccc', fontWeight: fc > 0 ? 700 : 400 }}>{fc || '—'}</td>
                        <td style={{ textAlign: 'center', color: '#617561' }}>{na || '—'}</td>
                      </tr>
                    )
                  })}

                  {/* Servicio desglosado por categoría SMP */}
                  {SERV_EV && catStats.map(({ cat }, idx) => {
                    let pf = 0, fc = 0, na = 0
                    for (const row of ppa) {
                      if (!row[SERV_EV.pctCol] || row[SERV_EV.pctCol] <= 0) continue
                      if (getSmpCat(row.smp_name).key !== cat.key) continue
                      if (!row.sgr) { na++; continue }
                      invMap[`${row.spo_number}|${SERV_EV.key}`] ? fc++ : pf++
                    }
                    if (pf + fc + na === 0) return null
                    return (
                      <tr key={`serv-${cat.key}`} style={{ borderTop: idx === 0 ? '2px solid #e8eae8' : '1px solid #f0f0f0' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                            <span style={{ fontWeight: 600, color: '#555' }}>Servicio</span>
                            <span style={{ fontSize: 9, color: cat.color, fontWeight: 700, background: `${cat.color}15`, borderRadius: 4, padding: '1px 5px' }}>{cat.label}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: pf > 0 ? '#ef4444' : '#ccc', fontWeight: pf > 0 ? 700 : 400 }}>{pf || '—'}</td>
                        <td style={{ textAlign: 'center', color: fc > 0 ? '#22c55e' : '#ccc', fontWeight: fc > 0 ? 700 : 400 }}>{fc || '—'}</td>
                        <td style={{ textAlign: 'center', color: '#617561' }}>{na || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
