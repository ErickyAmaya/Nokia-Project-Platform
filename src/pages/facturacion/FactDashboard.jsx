import { useRef, useMemo } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS } from '../../store/useFactStore'
import { showToast } from '../../components/Toast'

function PeriodoActual({ calendar }) {
  const now      = new Date()
  const year     = now.getFullYear()
  const month    = now.getMonth() + 1
  const day      = now.getDate()
  const period   = calendar.find(c => c.year === year && c.month === month)
  if (!period) return null

  const isOpen   = day >= period.start_day && day <= period.cutoff_day
  const daysLeft = period.cutoff_day - day

  return (
    <div style={{
      background: isOpen ? '#f0fdf4' : '#fef3c7',
      border: `1px solid ${isOpen ? '#86efac' : '#fcd34d'}`,
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#71717a' }}>
          Periodo de facturación
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>
          {period.month_name} {period.year}
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
          Apertura: día {period.start_day} · Cierre: día {period.cutoff_day}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          display: 'inline-block', padding: '4px 12px', borderRadius: 20,
          background: isOpen ? '#22c55e' : '#f59e0b', color: '#fff',
          fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 4,
        }}>
          {isOpen ? '● ABIERTO' : '● CERRADO'}
        </div>
        {isOpen && daysLeft >= 0 && (
          <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>
            {daysLeft === 0 ? 'Cierra hoy' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} para el cierre`}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FactDashboard() {
  const fileRef   = useRef(null)
  const uploadPPA = useFactStore(s => s.uploadPPA)
  const uploading = useFactStore(s => s.uploading)
  const uploads   = useFactStore(s => s.uploads)
  const ppa       = useFactStore(s => s.ppa)
  const invoices  = useFactStore(s => s.invoices)
  const pos       = useFactStore(s => s.pos)
  const calendar  = useFactStore(s => s.calendar)
  const deleteUpload = useFactStore(s => s.deleteUpload)

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const stats = useMemo(() => {
    let totalSPOs = ppa.length, porFacturar = 0, facturado = 0, sinGR = 0, valorFacturar = 0, valorFacturado = 0
    for (const row of ppa) {
      const eventos = getEventosRow(row, invMap)
      if (!row.sgr) { sinGR++; continue }
      const poData = pos.find(p => p.spo_number === row.spo_number)
      const valor  = poData?.valor || 0
      for (const ev of eventos) {
        if (ev.status === 'facturar')  { porFacturar++;  valorFacturar  += valor * (ev.pct / 100) }
        if (ev.status === 'facturado') { facturado++;    valorFacturado += valor * (ev.pct / 100) }
      }
    }
    return { totalSPOs, porFacturar, facturado, sinGR, valorFacturar, valorFacturado }
  }, [ppa, invMap, pos])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await uploadPPA(file)
    if (result.ok) showToast(`PPA cargado — ${result.count} SPOs`)
    else showToast('Error: ' + result.error, 'err')
    e.target.value = ''
  }

  const lastUpload = uploads[0]
  const fmtCOP = v => v > 0
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Periodo */}
      <PeriodoActual calendar={calendar} />

      {/* Upload + último archivo */}
      <div className="card">
        <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Archivo PPA Nokia</h2>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              background: '#144E4A', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5,
            }}
          >
            {uploading ? '⏳ Cargando…' : '↑ Cargar PPA Nokia'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <div className="card-b">
          {lastUpload ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#09090b' }}>{lastUpload.file_name}</div>
                <div style={{ color: '#71717a', marginTop: 2 }}>
                  {lastUpload.row_count} SPOs · cargado {new Date(lastUpload.loaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button
                onClick={() => { if (window.confirm('¿Eliminar este upload?')) deleteUpload(lastUpload.id) }}
                style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
              >
                Eliminar
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca89c', fontSize: 13 }}>
              Sin archivos cargados. Sube el PPA Nokia para comenzar.
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      {ppa.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { label: 'Total SPOs',    val: stats.totalSPOs,   color: '#144E4A' },
              { label: 'Por Facturar',  val: stats.porFacturar, color: '#ef4444' },
              { label: 'Facturado',     val: stats.facturado,   color: '#22c55e' },
              { label: 'Sin sGR',       val: stats.sinGR,       color: '#f59e0b' },
            ].map(k => (
              <div key={k.label} className="stat" style={{ borderLeftColor: k.color, padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: k.color, letterSpacing: .5, textTransform: 'uppercase' }}>{k.label}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: '#09090b', lineHeight: 1.1 }}>{k.val}</div>
              </div>
            ))}
          </div>

          {(stats.valorFacturar > 0 || stats.valorFacturado > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="stat" style={{ borderLeftColor: '#ef4444', padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: .5, textTransform: 'uppercase' }}>Valor Por Facturar</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{fmtCOP(stats.valorFacturar)}</div>
                <div style={{ fontSize: 9, color: '#9ca89c' }}>Según valor de POs cargadas</div>
              </div>
              <div className="stat" style={{ borderLeftColor: '#22c55e', padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', letterSpacing: .5, textTransform: 'uppercase' }}>Valor Facturado</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{fmtCOP(stats.valorFacturado)}</div>
                <div style={{ fontSize: 9, color: '#9ca89c' }}>Según valor de POs cargadas</div>
              </div>
            </div>
          )}

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
                  {EVENTOS.map(ev => {
                    let pf = 0, fc = 0, na = 0
                    for (const row of ppa) {
                      if (!row[ev.pctCol] || row[ev.pctCol] <= 0) { na++; continue }
                      const key = `${row.spo_number}|${ev.key}`
                      if (!row.sgr) { na++; continue }
                      invMap[key] ? fc++ : pf++
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
                        <td style={{ textAlign: 'center', color: '#9ca89c' }}>{na || '—'}</td>
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
