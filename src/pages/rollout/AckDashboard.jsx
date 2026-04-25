import { useRef, useMemo, useState } from 'react'
import { useAckStore, PROCESOS, FINAL } from '../../store/useAckStore'
import { showToast } from '../../components/Toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'

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

  return (
    <div className="stat" style={{ borderLeftColor: proceso.color, padding: '14px 16px' }}>
      <div className="sl" style={{ color: proceso.color, fontWeight: 800, letterSpacing: 1 }}>
        {proceso.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 4px' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {porcentaje}%
        </span>
        <span style={{ fontSize: 10, color: '#9ca89c' }}>completado</span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 10, color: '#9ca89c' }}>
          ✓ {fmt(finalizados)}
        </span>
        <span style={{ fontSize: 10, color: pendientes > 0 ? '#ef4444' : '#9ca89c', fontWeight: 700 }}>
          ● {fmt(pendientes)} pend.
        </span>
      </div>
      <div style={{ marginTop: 8, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
        <div style={{ height: 4, borderRadius: 2, background: color, width: `${porcentaje}%`, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

const COLORS_PIE = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

function VejezChart({ data }) {
  const bins = useMemo(() => {
    const map = {}
    for (const r of data) {
      const s = r.semanas_integracion
      if (!s) continue
      const bin = s <= 26 ? '≤26 sem' : s <= 52 ? '27-52 sem' : s <= 104 ? '1-2 años' : s <= 156 ? '2-3 años' : '>3 años'
      map[bin] = (map[bin] || 0) + 1
    }
    const order = ['≤26 sem', '27-52 sem', '1-2 años', '2-3 años', '>3 años']
    return order.filter(k => map[k]).map(k => ({ nombre: k, smps: map[k] }))
  }, [data])

  if (!bins.length) return null

  return (
    <div className="card-b" style={{ padding: 16 }}>
      <div className="card-h" style={{ padding: '0 0 10px', borderBottom: '1px solid #f0f2f0', marginBottom: 12 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>⏱ Vejez — Antigüedad de pendientes</h2>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={bins} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <XAxis dataKey="nombre" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip formatter={v => [v, 'SMPs']} />
          <Bar dataKey="smps" radius={[3, 3, 0, 0]}>
            {bins.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function RegionChart({ data }) {
  const byRegion = useMemo(() => {
    const map = {}
    for (const r of data) {
      const reg = r.region || 'Sin región'
      map[reg] = (map[reg] || 0) + 1
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [data])

  if (!byRegion.length) return null

  return (
    <div className="card-b" style={{ padding: 16 }}>
      <div className="card-h" style={{ padding: '0 0 10px', borderBottom: '1px solid #f0f2f0', marginBottom: 12 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>🗺 Pendientes por Región</h2>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={byRegion}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={65}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            fontSize={9}
          >
            {byRegion.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
          </Pie>
          <Tooltip formatter={v => [v, 'SMPs']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────
export default function AckDashboard() {
  const sabana    = useAckStore(s => s.sabana)
  const uploads   = useAckStore(s => s.uploads)
  const uploading = useAckStore(s => s.uploading)
  const uploadExcel = useAckStore(s => s.uploadExcel)

  const [region,   setRegion]   = useState('todos')
  const [proyecto, setProyecto] = useState('todos')
  const [relacion, setRelacion] = useState('todos')
  const [soloPend, setSoloPend] = useState(false)

  async function handleFile(file) {
    const res = await uploadExcel(file)
    if (res.ok) showToast(`✓ ${res.rows.toLocaleString('es-CO')} SMPs cargados desde ${file.name}`, 'ok')
    else        showToast(`Error: ${res.error}`, 'err')
  }

  const regiones  = useMemo(() => [...new Set(sabana.map(r => r.region).filter(Boolean))].sort(), [sabana])
  const proyectos = useMemo(() => [...new Set(sabana.map(r => r.proyecto_alcance).filter(Boolean))].sort(), [sabana])

  const filtered = useMemo(() => {
    return sabana.filter(r => {
      if (region   !== 'todos' && r.region           !== region)   return false
      if (proyecto !== 'todos' && r.proyecto_alcance  !== proyecto) return false
      if (relacion !== 'todos' && r.relacion          !== relacion) return false
      if (soloPend && !r.procesos_cierre_ph2) return false
      return true
    })
  }, [sabana, region, proyecto, relacion, soloPend])

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
        <p style={{ fontSize: 13, color: '#9ca89c', marginBottom: 24 }}>
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
            <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 2 }}>
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
        <select className="fc btn-sm" value={proyecto} onChange={e => setProyecto(e.target.value)} style={{ fontSize: 11 }}>
          <option value="todos">Todos los Proyectos</option>
          {proyectos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="fc btn-sm" value={relacion} onChange={e => setRelacion(e.target.value)} style={{ fontSize: 11 }}>
          <option value="todos">P + Hijos</option>
          <option value="P">Solo Padre (Sitios)</option>
          <option value="H">Solo Hijos (Actividades)</option>
        </select>
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
        {PROCESOS.map(p => (
          <ProcesoCard key={p.key} proceso={p} data={filtered} total={filtered.length} />
        ))}
      </div>

      {/* ── Gráficas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--two-col)', gap: 14 }}>
        <VejezChart data={pendientes} />
        <RegionChart data={pendientes} />
      </div>
    </div>
  )
}
