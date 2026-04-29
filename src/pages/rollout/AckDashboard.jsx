import { useRef, useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAckStore, PROCESOS, FINAL } from '../../store/useAckStore'
import { showToast } from '../../components/Toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// Orden homogéneo con Tablas y Reportes
const DASH_ORDER = ['gap_doc', 'gap_hw_cierre', 'gap_log_inv', 'gap_site_owner', 'gap_on_air']

// Slugs para pasar el filtro de vejez a Tablas via URL
const BIN_SLUG = {
  '≤26 sem':  'lte26',
  '27-52 sem': '27-52',
  '1-2 años': '1-2y',
  '2-3 años': '2-3y',
  '>3 años':  'gt3y',
}

// ── Helpers ───────────────────────────────────────────────────────
function isFinal(proceso, val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

function pct(num, tot) {
  if (!tot) return 0
  return Math.round((num / tot) * 100)
}

function fmt(n) {
  return n?.toLocaleString('es-CO') ?? '—'
}

// ── Componentes ───────────────────────────────────────────────────
function UploadZone({ onFile, uploading }) {
  const ref = useRef()
  function handle(e) {
    const f = e.target.files?.[0]
    if (f) onFile(f)
    e.target.value = ''
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input ref={ref} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handle} />
      <button
        className="btn bp"
        onClick={() => ref.current.click()}
        disabled={uploading}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {uploading ? '⏳ Cargando…' : '📂 Cargar Reporte ACK'}
      </button>
    </div>
  )
}

function ProcesoCard({ proceso, data, total }) {
  const finalizados = data.filter(r => isFinal(proceso.key, r[proceso.key])).length
  const pendientes  = total - finalizados
  const porcentaje  = pct(finalizados, total)
  const color = porcentaje >= 97 ? '#22c55e' : porcentaje >= 90 ? '#f59e0b' : '#ef4444'

  // Top 3 estados de pendientes para este proceso
  const top3 = useMemo(() => {
    const counts = {}
    for (const r of data) {
      const v = r[proceso.key]
      if (!v || isFinal(proceso.key, v)) continue
      counts[v] = (counts[v] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([estado, count]) => ({
        label: estado.split('.').slice(1).join('.').trim() || estado,
        count,
      }))
  }, [data, proceso.key])

  return (
    <div className="stat" style={{ borderLeftColor: proceso.color, padding: '14px 16px' }}>
      <div className="sl" style={{ color: proceso.color, fontWeight: 800, letterSpacing: 1 }}>
        {proceso.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 4px' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {porcentaje}%
        </span>
        <span style={{ fontSize: 10, color: '#4b5563' }}>completado</span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 10, color: '#4b5563' }}>
          ✓ {fmt(finalizados)}
        </span>
        <span style={{ fontSize: 10, color: pendientes > 0 ? '#ef4444' : '#4b5563', fontWeight: 700 }}>
          ● {fmt(pendientes)} pend.
        </span>
      </div>
      <div style={{ marginTop: 8, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
        <div style={{ height: 4, borderRadius: 2, background: color, width: `${porcentaje}%`, transition: 'width .4s' }} />
      </div>
      {top3.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid #f0f2f0', paddingTop: 8 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#4b5563', letterSpacing: .5, marginBottom: 7, textTransform: 'uppercase' }}>
            Top estados pendientes
          </div>
          {top3.map((t, i) => {
            const barPct = Math.round((t.count / top3[0].count) * 100)
            const opacity = i === 0 ? 1 : i === 1 ? 0.7 : 0.45
            const lbl = t.label.length > 23 ? t.label.slice(0, 23) + '…' : t.label
            return (
              <div key={i} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 8, color: '#555f55', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.label}>
                    {lbl}
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: proceso.color, flexShrink: 0, marginLeft: 4 }}>
                    {t.count}
                  </span>
                </div>
                <div style={{ height: 5, background: '#f0f2f0', borderRadius: 3 }}>
                  <div style={{
                    height: 5, borderRadius: 3,
                    background: proceso.color,
                    opacity,
                    width: `${barPct}%`,
                    transition: 'width .3s',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const COLORS_PIE = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const PROC_GAP_KEYS = ['gap_doc', 'gap_hw_cierre', 'gap_log_inv', 'gap_site_owner', 'gap_on_air']

function vejezTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4e0', borderRadius: 6, padding: '7px 11px', fontSize: 10, boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>{d.nombre}</div>
      <div>{d.smps} SMPs ({d.actividades} actividades)</div>
    </div>
  )
}

function VejezChart({ data, onBarClick }) {
  const bins = useMemo(() => {
    const map = {}
    for (const r of data) {
      const s = r.semanas_integracion
      if (!s) continue
      const bin = s <= 26 ? '≤26 sem' : s <= 52 ? '27-52 sem' : s <= 104 ? '1-2 años' : s <= 156 ? '2-3 años' : '>3 años'
      if (!map[bin]) map[bin] = { smps: 0, actividades: 0 }
      map[bin].smps++
      map[bin].actividades += PROC_GAP_KEYS.filter(k => r[k] && !isFinal(k, r[k])).length
    }
    const order = ['≤26 sem', '27-52 sem', '1-2 años', '2-3 años', '>3 años']
    return order.filter(k => map[k]).map(k => ({ nombre: k, ...map[k] }))
  }, [data])

  if (!bins.length) return null

  return (
    <div className="card-b" style={{ padding: 16 }}>
      <div className="card-h" style={{ padding: '0 0 10px', borderBottom: '1px solid #f0f2f0', marginBottom: 12 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>⏱ Vejez — Antigüedad de pendientes</h2>
        <span style={{ fontSize: 9, color: '#4b5563' }}>Clic en barra para ver SMPs en Tablas</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={bins} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <XAxis dataKey="nombre" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip content={vejezTooltip} cursor={{ fill: 'rgba(0,0,0,.05)' }} />
          <Bar
            dataKey="smps"
            barSize={44}
            shape={(props) => {
              const { x, y, width, height, fill, index } = props
              const MIN_CLICK = 40
              const clickH = Math.max(height, MIN_CLICK)
              const clickY = y + height - clickH
              return (
                <g style={{ cursor: 'pointer' }} onClick={() => onBarClick(bins[index].nombre)}>
                  <rect x={x} y={clickY} width={width} height={clickH} fill="transparent" />
                  <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={fill} rx={3} ry={3} />
                </g>
              )
            }}
          >
            {bins.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function regionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4e0', borderRadius: 6, padding: '7px 11px', fontSize: 10, boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>{d.name}</div>
      <div>{d.pct}% completado · {d.pend} pend. de {d.total}</div>
    </div>
  )
}

function AvancePorRegionChart({ data }) {
  const byRegion = useMemo(() => {
    const map = {}
    for (const r of data) {
      const reg = r.region || 'Sin región'
      if (!map[reg]) map[reg] = { total: 0, closed: 0 }
      map[reg].total++
      if (PROCESOS.every(p => isFinal(p.key, r[p.key]))) map[reg].closed++
    }
    return Object.entries(map)
      .map(([name, { total, closed }]) => ({
        name, total, pend: total - closed,
        pct: Math.round((closed / total) * 100),
      }))
      .sort((a, b) => a.pct - b.pct)
  }, [data])

  if (!byRegion.length) return null

  return (
    <div className="card-b" style={{ padding: 16 }}>
      <div className="card-h" style={{ padding: '0 0 10px', borderBottom: '1px solid #f0f2f0', marginBottom: 12 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>🗺 % Avance por Región</h2>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(160, byRegion.length * 36)}>
        <BarChart data={byRegion} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
          <Tooltip content={regionTooltip} />
          <Bar dataKey="pct" radius={[0, 3, 3, 0]} barSize={18}>
            {byRegion.map((d, i) => (
              <Cell key={i} fill={d.pct >= 97 ? '#22c55e' : d.pct >= 80 ? '#f59e0b' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function matrizTooltip(pct) {
  if (pct <= 10) return { bg: '#dcfce7', color: '#166534' }
  if (pct <= 30) return { bg: '#fef9c3', color: '#854d0e' }
  if (pct <= 60) return { bg: '#ffedd5', color: '#9a3412' }
  return { bg: '#fee2e2', color: '#991b1b' }
}

function MatrizProcesoRegion({ data }) {
  const regiones = useMemo(() =>
    [...new Set(data.map(r => r.region).filter(Boolean))].sort()
  , [data])

  const matrix = useMemo(() => {
    const map = {}
    for (const r of data) {
      const reg = r.region || 'Sin región'
      if (!map[reg]) map[reg] = {}
      for (const p of PROCESOS) {
        if (!map[reg][p.key]) map[reg][p.key] = { total: 0, pend: 0 }
        map[reg][p.key].total++
        if (!isFinal(p.key, r[p.key])) map[reg][p.key].pend++
      }
    }
    return map
  }, [data])

  if (!regiones.length) return null

  return (
    <div className="card-b" style={{ padding: 16 }}>
      <div className="card-h" style={{ padding: '0 0 10px', borderBottom: '1px solid #f0f2f0', marginBottom: 12 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>🔥 Matriz Proceso × Región — % Pendiente</h2>
        <span style={{ fontSize: 9, color: '#4b5563' }}>Verde ≤10% · Amarillo ≤30% · Naranja ≤60% · Rojo &gt;60%</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, fontWeight: 700, color: '#555f55', background: '#f8f9f8', borderBottom: '2px solid #e5e7eb' }}>
                Región
              </th>
              {PROCESOS.map(p => (
                <th key={p.key} style={{ padding: '6px 10px', fontSize: 8, fontWeight: 700, color: p.color, background: '#f8f9f8', borderBottom: `2px solid ${p.color}`, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regiones.map((reg, i) => (
              <tr key={reg} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '6px 10px', fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>{reg}</td>
                {PROCESOS.map(p => {
                  const d = matrix[reg]?.[p.key]
                  if (!d) return <td key={p.key} style={{ textAlign: 'center', color: '#ccc', padding: '5px 8px' }}>—</td>
                  const pctPend = Math.round((d.pend / d.total) * 100)
                  const { bg, color } = matrizTooltip(pctPend)
                  return (
                    <td key={p.key} style={{ textAlign: 'center', padding: '5px 8px' }}>
                      <span style={{ background: bg, color, fontWeight: 700, fontSize: 9, padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                        {pctPend}%
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Multi-select de proyectos ─────────────────────────────────────
function MultiSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const label = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `${value.length} proyectos`

  function toggle(opt) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="fc btn-sm"
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          minWidth: 160, justifyContent: 'space-between', background: value.length ? '#eff6ff' : undefined,
          borderColor: value.length ? '#3b82f6' : undefined,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 9, color: '#4b5563', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, minWidth: 220, zIndex: 300,
          background: '#fff', border: '1px solid #e0e4e0', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 280, overflowY: 'auto',
        }}>
          {value.length > 0 && (
            <div
              onMouseDown={() => onChange([])}
              style={{ padding: '6px 12px', fontSize: 10, color: '#ef4444', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontWeight: 700 }}
            >
              ✕ Limpiar selección
            </div>
          )}
          {options.map(o => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f8f9f8' }}>
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} style={{ margin: 0, accentColor: '#3b82f6' }} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────
export default function AckDashboard() {
  const navigate       = useNavigate()
  const sabana         = useAckStore(s => s.sabana)
  const uploads        = useAckStore(s => s.uploads)
  const uploading      = useAckStore(s => s.uploading)
  const uploadExcel    = useAckStore(s => s.uploadExcel)
  const proyectoSel    = useAckStore(s => s.proyectoSel)
  const setProyectoSel = useAckStore(s => s.setProyectoSel)

  const [region,   setRegion]   = useState('todos')
  const [soloPend, setSoloPend] = useState(false)

  async function handleFile(file) {
    const res = await uploadExcel(file)
    if (res.ok) showToast(`✓ ${res.rows.toLocaleString('es-CO')} SMPs cargados desde ${file.name}`, 'ok')
    else        showToast(`Error: ${res.error}`, 'err')
  }

  function handleVejezClick(bin) {
    const slug = BIN_SLUG[bin] || bin
    navigate(`/rollout/ack/tablas?vejez=${slug}&filtro=todos`)
  }

  function handleProyectoChange(arr) {
    setProyectoSel(arr)
    if (arr.length > 0)
      showToast(`🔖 Filtro de proyectos aplicado a todo el módulo ACK`, 'ok')
    else
      showToast(`Filtro de proyectos eliminado — mostrando todos`, 'ok')
  }

  const regiones      = useMemo(() => [...new Set(sabana.map(r => r.region).filter(Boolean))].sort(), [sabana])
  const proyectoOpts  = useMemo(() => [...new Set(sabana.map(r => r.proyecto_alcance).filter(Boolean))].sort(), [sabana])

  const filteredBase = useMemo(() => {
    return sabana.filter(r => {
      if (region !== 'todos' && r.region !== region) return false
      if (proyectoSel.length > 0 && !proyectoSel.includes(r.proyecto_alcance)) return false
      return true
    })
  }, [sabana, region, proyectoSel])

  const filtered = useMemo(() => {
    if (!soloPend) return filteredBase
    return filteredBase.filter(r => r.procesos_cierre_ph2)
  }, [filteredBase, soloPend])

  const pendientes = useMemo(() => filtered.filter(r => r.procesos_cierre_ph2), [filtered])

  const lastUpload = uploads[0]

  const totalSitios  = useMemo(() => new Set(filtered.map(r => r.main_smp)).size, [filtered])
  const totalSMPs    = filtered.length

  if (!sabana.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, color: '#555f55', marginBottom: 8 }}>
          Módulo ACK
        </h2>
        <p style={{ fontSize: 13, color: '#4b5563', marginBottom: 24 }}>
          No hay datos cargados. Sube el reporte Nokia para comenzar.
        </p>
        <UploadZone onFile={handleFile} uploading={uploading} />
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            ACK — Seguimiento de Procesos
          </h1>
          {lastUpload && (
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
              Último reporte: <b>{lastUpload.file_name}</b> ·{' '}
              {new Date(lastUpload.loaded_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <UploadZone onFile={handleFile} uploading={uploading} />
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select className="fc btn-sm" value={region} onChange={e => setRegion(e.target.value)} style={{ fontSize: 11 }}>
          <option value="todos">Todas las Regiones</option>
          {regiones.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <MultiSelect
          options={proyectoOpts}
          value={proyectoSel}
          onChange={handleProyectoChange}
          placeholder="Todos los Proyectos"
        />
        {proyectoSel.length > 0 && (
          <button
            className="btn-sm"
            onClick={() => handleProyectoChange([])}
            style={{ fontSize: 10, padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ✕ Limpiar proyectos
          </button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
          <input type="checkbox" checked={soloPend} onChange={e => setSoloPend(e.target.checked)} />
          Solo pendientes
        </label>
      </div>

      {/* ── KPIs globales ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        <div className="stat" style={{ borderLeftColor: '#144E4A' }}>
          <div className="sl">TOTAL SMPs</div>
          <div className="sv">{fmt(totalSMPs)}</div>
          <div className="ss">{fmt(totalSitios)} sitios únicos</div>
        </div>
        <div className="stat" style={{ borderLeftColor: '#ef4444' }}>
          <div className="sl">PROCESOS PENDIENTES</div>
          <div className="sv" style={{ color: '#ef4444' }}>{fmt(pendientes.length)}</div>
          <div className="ss">{pct(pendientes.length, totalSMPs)}% del total</div>
        </div>
        <div className="stat" style={{ borderLeftColor: '#22c55e' }}>
          <div className="sl">COMPLETADOS</div>
          <div className="sv" style={{ color: '#22c55e' }}>{fmt(totalSMPs - pendientes.length)}</div>
          <div className="ss">{pct(totalSMPs - pendientes.length, totalSMPs)}% del total</div>
        </div>
      </div>

      {/* ── Tarjetas por proceso ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }} className="ack-proc-grid">
        {DASH_ORDER.map(key => PROCESOS.find(p => p.key === key)).filter(Boolean).map(p => (
          <ProcesoCard key={p.key} proceso={p} data={filtered} total={filtered.length} />
        ))}
      </div>

      {/* ── Gráficas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--two-col)', gap: 14, marginBottom: 14 }}>
        <VejezChart data={pendientes} onBarClick={handleVejezClick} />
        <AvancePorRegionChart data={filteredBase} />
      </div>
      <MatrizProcesoRegion data={filteredBase} />
    </div>
  )
}
