import { useRef, useMemo } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, EVENTOS, getSmpCat, SMP_CATS } from '../../store/useFactStore'
import { showToast } from '../../components/Toast'

function PeriodoActual({ calendar }) {
  const now    = new Date()
  const year   = now.getFullYear()
  const month  = now.getMonth() + 1
  const day    = now.getDate()
  const period = calendar.find(c => c.year === year && c.month === month)
  if (!period) return null
  const isOpen   = day >= period.start_day && day <= period.cutoff_day
  const daysLeft = period.cutoff_day - day
  return (
    <div style={{ background: isOpen ? '#f0fdf4' : '#fef3c7', border: `1px solid ${isOpen ? '#86efac' : '#fcd34d'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#71717a' }}>Periodo de facturación</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#09090b' }}>{period.month_name} {period.year}</div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Apertura: día {period.start_day} · Cierre: día {period.cutoff_day}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, background: isOpen ? '#22c55e' : '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: .5, marginBottom: 4 }}>
          {isOpen ? '● ABIERTO' : '● CERRADO'}
        </div>
        {isOpen && daysLeft >= 0 && (
          <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>{daysLeft === 0 ? 'Cierra hoy' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} para el cierre`}</div>
        )}
      </div>
    </div>
  )
}

function CatProgressBar({ cat, pf, fc, sinGR, total }) {
  const pct_fc = total > 0 ? (fc / total) * 100 : 0
  const pct_pf = total > 0 ? (pf / total) * 100 : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: cat.color }}>{cat.label}</span>
        <span style={{ color: '#71717a', fontSize: 9 }}>
          {fc > 0 && <span style={{ color: '#22c55e', marginRight: 8 }}>✓ {fc} facturado{fc !== 1 ? 's' : ''}</span>}
          {pf > 0 && <span style={{ color: '#ef4444', marginRight: 8 }}>⚠ {pf} pendiente{pf !== 1 ? 's' : ''}</span>}
          {sinGR > 0 && <span style={{ color: '#f59e0b' }}>○ {sinGR} sin sGR</span>}
        </span>
      </div>
      <div style={{ height: 7, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${pct_fc}%`, background: '#22c55e', transition: 'width .4s' }} />
        <div style={{ width: `${pct_pf}%`, background: '#ef4444', transition: 'width .4s' }} />
      </div>
    </div>
  )
}

export default function FactDashboard() {
  const fileRef      = useRef(null)
  const uploadPPA    = useFactStore(s => s.uploadPPA)
  const uploading    = useFactStore(s => s.uploading)
  const uploads      = useFactStore(s => s.uploads)
  const ppa          = useFactStore(s => s.ppa)
  const invoices     = useFactStore(s => s.invoices)
  const pos          = useFactStore(s => s.pos)
  const calendar     = useFactStore(s => s.calendar)
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

  // Stats por categoría SMP
  const catStats = useMemo(() => {
    const map = {}
    for (const cat of [...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }]) {
      map[cat.key] = { cat, total: 0, pf: 0, fc: 0, sinGR: 0 }
    }
    for (const row of ppa) {
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

  // Breakdown por evento: los 5 primeros normales + servicio abierto por cat SMP
  const NON_SERV = EVENTOS.filter(e => e.key !== 'servicio')
  const SERV_EV  = EVENTOS.find(e => e.key === 'servicio')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PeriodoActual calendar={calendar} />

      {/* Upload */}
      <div className="card">
        <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Archivo PPA Nokia</h2>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: '#144E4A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5 }}>
            {uploading ? '⏳ Cargando…' : '↑ Cargar PPA Nokia'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <div className="card-b">
          {lastUpload ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#09090b' }}>{lastUpload.filename}</div>
                <div style={{ color: '#71717a', marginTop: 2 }}>
                  {lastUpload.row_count} SPOs · cargado {new Date(lastUpload.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button onClick={() => { if (window.confirm('¿Eliminar este upload?')) deleteUpload(lastUpload.id) }} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca89c', fontSize: 13 }}>Sin archivos cargados. Sube el PPA Nokia para comenzar.</div>
          )}
        </div>
      </div>

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

          {/* Gráfica por categoría */}
          <div className="card">
            <div className="card-h"><h2>Progreso por categoría de trabajo</h2></div>
            <div className="card-b">
              {catStats.map(({ cat, pf, fc, sinGR, total }) => (
                <CatProgressBar key={cat.key} cat={cat} pf={pf} fc={fc} sinGR={sinGR} total={total} />
              ))}
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 9, color: '#71717a' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#22c55e', borderRadius: 2, marginRight: 4 }} />Facturado</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />Por facturar</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#f0f0f0', borderRadius: 2, marginRight: 4 }} />Sin sGR / no aplica</span>
              </div>
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
                        <td style={{ textAlign: 'center', color: '#9ca89c' }}>{na || '—'}</td>
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
