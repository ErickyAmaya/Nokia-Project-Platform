import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { parseTssFile } from './tsqaParser'
import { useTsqaStore }  from '../../store/useTsqaStore'
import { useAuthStore }  from '../../store/authStore'

const BRAND = '#0369a1'

// ── Helpers ────────────────────────────────────────────────────────
const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function ModelList({ items }) {
  if (!items || items.length === 0) return <span style={{ color: '#6b7280' }}>—</span>
  return (
    <span style={{ fontSize: 10, lineHeight: 1.6 }}>
      {items.map(({ model, count }) => (
        <span key={model} style={{ display: 'inline-block', marginRight: 6, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#374151', fontWeight: 600 }}>{model}</span>
          <span style={{ color: '#6b7280' }}>×{count}</span>
        </span>
      ))}
    </span>
  )
}

function CountBadge({ n, color }) {
  if (n === undefined || n === null) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 24, height: 20, borderRadius: 5, padding: '0 5px',
      fontSize: 11, fontWeight: 700,
      background: n > 0 ? `${color}18` : '#f3f4f6',
      color: n > 0 ? color : '#9ca3af',
      border: `1px solid ${n > 0 ? color + '44' : '#e5e7eb'}`,
    }}>{n}</span>
  )
}

function RfCounts({ data }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center' }}>
      <CountBadge n={data.totalInstalar}  color="#16a34a" />
      <CountBadge n={data.totalReubicar}  color="#d97706" />
      <CountBadge n={data.totalDesmontar} color="#dc2626" />
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────
const SEC_LABEL = {
  fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
  color: '#fff', padding: '3px 10px', borderRadius: 4, display: 'inline-block',
}
const SEC_WRAP = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
  overflow: 'hidden', marginBottom: 8,
}
const SEC_HEAD = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '7px 14px', borderBottom: '1px solid #e5e7eb',
}
const SEC_BODY = { padding: '14px 16px' }
const COL_LABEL = {
  fontSize: 9, fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5,
}

function SiteDetail({ site }) {
  const [expandedWorks, setExpandedWorks] = useState({})
  const toggleWork = i => setExpandedWorks(p => ({ ...p, [i]: !p[i] }))

  function RfGroup({ label, items, total, color }) {
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 4 }}>
          {label}
          <span style={{ marginLeft: 6, background: `${color}18`, color, borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>{total}</span>
        </div>
        {items.length > 0 ? items.map(({ model, count }) => (
          <div key={model} style={{ fontSize: 11, color: '#4b5563', paddingLeft: 8, lineHeight: 1.9 }}>
            <span style={{ color: '#111827', fontWeight: 600 }}>{model}</span>
            <span style={{ color: '#6b7280' }}> ×{count}</span>
          </div>
        )) : <div style={{ fontSize: 11, color: '#6b7280', paddingLeft: 8 }}>—</div>}
      </div>
    )
  }

  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div style={{ background: '#f3f4f6', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '12px 20px 16px' }}>

          {/* ══ SECCIÓN TI ══════════════════════════════════════════════ */}
          <div style={SEC_WRAP}>
            <div style={SEC_HEAD}>
              <span style={{ ...SEC_LABEL, background: '#16a34a' }}>TI</span>
              <span style={{ fontSize: 10, color: '#6b7280' }}>Información técnica del sitio</span>
            </div>
            <div style={{ ...SEC_BODY, display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 1.1fr 1.1fr', gap: 16 }}>

              {/* Info del sitio */}
              <div>
                <div style={COL_LABEL}>Sitio</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {site.address  && <div style={{ fontSize: 11, color: '#374151' }}>{site.address}</div>}
                  {site.siteType && <div style={{ fontSize: 11, color: BRAND, fontWeight: 600 }}>◆ {site.siteType}</div>}
                  {site.coords   && (
                    <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>
                      {site.coords.lat.toFixed(6)}, {site.coords.lon.toFixed(6)}
                    </div>
                  )}
                  {(site.specialAccess.length > 0 || site.accessObs) && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ ...COL_LABEL, marginBottom: 3 }}>Acceso especial</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: site.accessObs ? 3 : 0 }}>
                        {site.specialAccess.map(e => (
                          <span key={e} style={{ fontSize: 10, fontWeight: 600, background: '#faf5ff', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: 4, padding: '1px 6px' }}>{e}</span>
                        ))}
                      </div>
                      {site.accessObs && <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5 }}>{site.accessObs}</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* Torre */}
              <div>
                <div style={COL_LABEL}>Torre</div>
                {site.towerType   && <div style={{ fontSize: 12, color: '#111827', fontWeight: 600 }}>{site.towerType}</div>}
                {site.towerHeight && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>Altura: <strong>{site.towerHeight} m</strong></div>}
              </div>

              {/* RF */}
              <div>
                <div style={COL_LABEL}>RF (RFS)</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <RfGroup label="Instalar"  items={site.rf.instalar}  total={site.rf.totalInstalar}  color="#16a34a" />
                  <RfGroup label="Reubicar"  items={site.rf.reubicar}  total={site.rf.totalReubicar}  color="#d97706" />
                  <RfGroup label="Desmontar" items={site.rf.desmontar} total={site.rf.totalDesmontar} color="#dc2626" />
                </div>
              </div>

              {/* Antenas */}
              <div>
                <div style={COL_LABEL}>Antenas</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <RfGroup label="Instalar"  items={site.ant.instalar}  total={site.ant.totalInstalar}  color="#16a34a" />
                  <RfGroup label="Reubicar"  items={site.ant.reubicar}  total={site.ant.totalReubicar}  color="#d97706" />
                  <RfGroup label="Desmontar" items={site.ant.desmontar} total={site.ant.totalDesmontar} color="#dc2626" />
                </div>
              </div>

            </div>
          </div>

          {/* ══ SECCIÓN CW ══════════════════════════════════════════════ */}
          {(site.cw.requerida || site.cw.trabajos?.length > 0) && (
            <div style={SEC_WRAP}>
              <div style={SEC_HEAD}>
                <span style={{ ...SEC_LABEL, background: BRAND }}>CW</span>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
                  {site.cw.requerida === 'SI' ? 'Se Requiere CW' : site.cw.requerida === 'NO' ? 'No Requiere CW' : (site.cw.requerida || '—')}
                  {site.cw.enConjunto && (
                    <>
                      <span style={{ color: '#d1d5db', margin: '0 8px' }}>/</span>
                      {'En Conjunto: '}
                      <span style={{
                        fontWeight: 700,
                        color: site.cw.enConjunto === 'SI' ? '#854d0e' : '#6b7280',
                      }}>{site.cw.enConjunto}</span>
                    </>
                  )}
                </span>
              </div>
              {site.cw.trabajos?.length > 0 && (
                <div style={{ ...SEC_BODY, paddingTop: 10, paddingBottom: 10 }}>
                  <div style={{ ...COL_LABEL, marginBottom: 6 }}>Trabajos en soportes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {site.cw.trabajos.map((t, i) => (
                      <div key={i} style={{ borderRadius: 5, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                        <div onClick={() => toggleWork(i)} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                          cursor: 'pointer', background: expandedWorks[i] ? '#fefce8' : '#fafafa', userSelect: 'none',
                        }}>
                          <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{expandedWorks[i] ? '▾' : '▸'}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: '#854d0e',
                            background: '#fef9c3', border: '1px solid #fde047',
                            borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0,
                          }}>{t.tipo}</span>
                          {!expandedWorks[i] && (
                            <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.descripcion.length > 90 ? t.descripcion.slice(0, 90) + '…' : t.descripcion}
                            </span>
                          )}
                        </div>
                        {expandedWorks[i] && (
                          <div style={{ padding: '6px 12px 10px 30px', fontSize: 11, color: '#374151', lineHeight: 1.6, background: '#fefce8', borderTop: '1px solid #fde047' }}>
                            {t.descripcion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ SECCIÓN ENERGÍA ════════════════════════════════════════ */}
          <div style={{ ...SEC_WRAP, marginBottom: 0 }}>
            <div style={SEC_HEAD}>
              <span style={{ ...SEC_LABEL, background: '#d97706' }}>Energía</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {site.energia?.fpfhInstalar?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>FPFH a Instalar:</span>
                    {site.energia.fpfhInstalar.map(m => (
                      <span key={m} style={{
                        fontSize: 10, fontWeight: 700,
                        background: '#dcfce7', color: '#166534', border: '1px solid #86efac',
                        borderRadius: 4, padding: '1px 8px',
                      }}>{m}</span>
                    ))}
                  </div>
                )}
                {site.energia?.fpfhReubicar?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>FPFH a Reubicar:</span>
                    {site.energia.fpfhReubicar.map(m => (
                      <span key={m} style={{
                        fontSize: 10, fontWeight: 700,
                        background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047',
                        borderRadius: 4, padding: '1px 8px',
                      }}>{m}</span>
                    ))}
                  </div>
                )}
                {!site.energia?.fpfhInstalar?.length && !site.energia?.fpfhReubicar?.length && site.fpfhModels.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {site.fpfhModels.map(m => (
                      <span key={m} style={{ fontSize: 10, fontWeight: 600, background: '#eff6ff', color: BRAND, border: `1px solid ${BRAND}44`, borderRadius: 4, padding: '1px 8px' }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={SEC_BODY}>
              {/* Power items */}
              {site.energia?.items?.length > 0 && (
                <div style={{ marginBottom: site.energia.comentarios ? 12 : 0 }}>
                  <div style={{ ...COL_LABEL, marginBottom: 6 }}>Estado actual power en sitio</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {site.energia.items.map((p, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                        padding: '5px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #e5e7eb',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', minWidth: 110 }}>{p.nombre}</span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>
                          {'Rectif.: '}
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>{p.operativos ?? '?'} op.</span>
                          {p.operativosPr != null && (
                            <>
                              <span style={{ color: '#9ca3af' }}> → </span>
                              <span style={{ fontWeight: 700, color: '#16a34a' }}>{p.operativosPr} op.</span>
                              {p.operativosPr !== p.operativos && p.operativos != null && (
                                <span style={{ color: '#d97706', fontWeight: 600, marginLeft: 4 }}>
                                  ({p.operativosPr > p.operativos ? '+' : ''}{p.operativosPr - p.operativos})
                                </span>
                              )}
                            </>
                          )}
                          {p.enFalla != null && p.enFalla > 0 && (
                            <span style={{ fontWeight: 700, color: '#dc2626', marginLeft: 6 }}>{p.enFalla} falla</span>
                          )}
                        </span>
                        {p.consumoActual != null && (
                          <span style={{ fontSize: 11, color: '#6b7280' }}>
                            Consumo: <span style={{ fontWeight: 600, color: '#374151' }}>{(p.consumoActual / 1000).toFixed(2)} kW</span>
                            {p.consumoFuturo != null && (
                              <span style={{ color: '#9ca3af' }}> → <span style={{ fontWeight: 600, color: '#374151' }}>{(p.consumoFuturo / 1000).toFixed(2)} kW</span></span>
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Comentarios power */}
              {site.energia?.comentarios && (
                <div>
                  <div style={{ ...COL_LABEL, marginBottom: 4 }}>Comentarios estado del power y breakers</div>
                  <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, background: '#fefce8', border: '1px solid #fde047', borderRadius: 6, padding: '8px 12px' }}>
                    {site.energia.comentarios}
                  </div>
                </div>
              )}
              {!site.energia?.items?.length && !site.energia?.comentarios && site.fpfhModels.length === 0 && (
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Sin datos de energía</div>
              )}
            </div>
          </div>

        </div>
      </td>
    </tr>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function TsqaPage() {
  const { audits, loading: storeLoading, loaded, loadAudits, saveAudit, deleteAudit } = useTsqaStore()
  const userId = useAuthStore(s => s.user?.id)

  const [expanded, setExpanded] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState([])
  const [saving,   setSaving]   = useState(false)
  const fileInputRef = useRef(null)

  const sites = audits

  useEffect(() => { if (!loaded) loadAudits() }, [loaded])

  const processFiles = useCallback(async (fileList) => {
    setLoading(true)
    setSaving(true)
    const newErrors = []
    const existingIds = new Set(audits.map(s => s.id))
    for (const file of fileList) {
      if (!file.name.match(/\.xlsx?$/i)) {
        newErrors.push(`${file.name}: solo se admiten archivos .xlsx`)
        continue
      }
      try {
        const buf = await file.arrayBuffer()
        const result = parseTssFile(new Uint8Array(buf), file.name)
        if (result) {
          if (!existingIds.has(result.id)) await saveAudit(result, userId)
        } else {
          newErrors.push(`${file.name}: no se encontró la hoja "DATOS RF"`)
        }
      } catch {
        newErrors.push(`${file.name}: error al leer el archivo`)
      }
    }
    setErrors(newErrors)
    setLoading(false)
    setSaving(false)
  }, [audits, userId, saveAudit])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    processFiles([...e.dataTransfer.files])
  }, [processFiles])

  async function removeSite(id) {
    await deleteAudit(id)
    if (expanded === id) setExpanded(null)
  }

  function printAudit(s) {
    const fmtPower = p => {
      const parts = []
      if (p.operativos != null) {
        let r = `Rectif.: ${p.operativos} op.`
        if (p.operativosPr != null) {
          r += ` → ${p.operativosPr} op.`
          if (p.operativosPr !== p.operativos) r += ` (${p.operativosPr > p.operativos ? '+' : ''}${p.operativosPr - p.operativos})`
        }
        if (p.enFalla) r += ` · ${p.enFalla} en falla`
        parts.push(r)
      }
      if (p.consumoActual != null) {
        let c = `Consumo: ${(p.consumoActual/1000).toFixed(2)} kW`
        if (p.consumoFuturo != null) c += ` → ${(p.consumoFuturo/1000).toFixed(2)} kW`
        parts.push(c)
      }
      return parts.join(' &nbsp;·&nbsp; ')
    }

    const pill = (text, bg, color, border) =>
      `<span style="background:${bg};color:${color};border:1px solid ${border};border-radius:4px;padding:1px 8px;font-size:11px;font-weight:700;white-space:nowrap">${text}</span>`

    const modelRows = (items) => items.map(({model,count}) =>
      `<span style="margin-right:6px"><b>${model}</b><span style="color:#6b7280">×${count}</span></span>`).join('')

    const secHead = (label, bg, extra = '') =>
      `<div style="display:flex;align-items:center;gap:10px;padding:7px 14px;border-bottom:1px solid #e5e7eb;background:#fafafa">
        <span style="font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#fff;padding:3px 10px;border-radius:4px;background:${bg}">${label}</span>
        ${extra}
      </div>`

    const fpfhInst  = s.energia?.fpfhInstalar  || []
    const fpfhReloc = s.energia?.fpfhReubicar   || []

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>TSQA · ${s.siteName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #fff; padding: 24px; font-size: 12px; }
  h1 { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .badge { display:inline-block; font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; background:#eff6ff; color:#0369a1; border:1px solid #bfdbfe; border-radius:6px; padding:3px 8px; }
  .sec { border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:10px; }
  .grid4 { display:grid; grid-template-columns:1.3fr 0.8fr 1.1fr 1.1fr; gap:16px; padding:14px 16px; }
  .col-label { font-size:9px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; margin-bottom:5px; }
  .info-row { font-size:11px; color:#374151; margin-bottom:3px; }
  .cw-body { padding:10px 16px; display:flex; flex-direction:column; gap:8px; }
  .trabajo { display:flex; flex-direction:column; gap:3px; padding:6px 0; border-bottom:1px solid #f0f0f0; }
  .trabajo:last-child { border-bottom:none; }
  .energy-body { padding:10px 16px; display:flex; flex-direction:column; gap:6px; }
  .power-row { display:flex; align-items:baseline; gap:8px; }
  .power-name { font-weight:700; font-size:12px; color:#111827; min-width:160px; }
  .comentario { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:8px 10px; font-size:11px; color:#374151; margin-top:4px; }
  .print-bar { position:fixed; top:0; left:0; right:0; background:#0369a1; padding:10px 24px; display:flex; align-items:center; justify-content:space-between; z-index:999; }
  .print-btn { background:#fff; color:#0369a1; border:none; border-radius:8px; padding:8px 22px; font-size:13px; font-weight:700; cursor:pointer; }
  .print-btn:hover { background:#e0f2fe; }
  .print-bar-label { color:#fff; font-size:12px; font-weight:600; opacity:.85; }
  body { padding-top: 56px; }
  @media print { .print-bar { display:none; } body { padding-top: 0; padding: 12px; } }
</style></head><body>
<div class="print-bar">
  <span class="print-bar-label">TSQA-R · Technical Site Quality Audit Report</span>
  <button class="print-btn" onclick="window.print()">⬇ Guardar como PDF / Imprimir</button>
</div>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
  <div>
    <h1>${s.siteName}</h1>
    <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
      ${s.smpWo ? `<span class="badge">${s.smpWo}</span>` : ''}
      ${s.siteType ? `<span class="badge">${s.siteType}</span>` : ''}
      ${s.date ? `<span class="badge">${fmtDate(new Date(s.date))}</span>` : ''}
    </div>
  </div>
  <div style="text-align:right;font-size:10px;color:#9ca3af">Nokia TSS · TSQA</div>
</div>

<!-- TI -->
<div class="sec">
  ${secHead('TI', '#16a34a')}
  <div class="grid4">
    <div>
      <div class="col-label">Sitio</div>
      ${s.address  ? `<div class="info-row">${s.address}</div>` : ''}
      ${s.siteType ? `<div class="info-row" style="color:#0369a1;font-weight:600">◆ ${s.siteType}</div>` : ''}
      ${s.coords   ? `<div class="info-row" style="color:#6b7280;font-size:10px">${s.coords.lat.toFixed(6)}, ${s.coords.lon.toFixed(6)}</div>` : ''}
      ${s.subcontractor ? `<div class="info-row" style="color:#6b7280">${s.subcontractor}</div>` : ''}
      ${s.specialAccess?.length ? `<div class="info-row" style="color:#7c3aed;font-weight:600">⚠ ${s.specialAccess.join(' · ')}</div>` : ''}
    </div>
    <div>
      <div class="col-label">Torre</div>
      ${s.towerType ? `<div class="info-row"><b>${s.towerType}</b>${s.towerHeight ? ` · ${s.towerHeight}m` : ''}</div>` : '<div class="info-row" style="color:#9ca3af">—</div>'}
    </div>
    <div>
      <div class="col-label">RF</div>
      <div class="info-row"><span style="color:#16a34a;font-weight:700">▲ ${s.rf.totalInstalar}</span> <span style="color:#d97706;font-weight:700">↔ ${s.rf.totalReubicar}</span> <span style="color:#dc2626;font-weight:700">▼ ${s.rf.totalDesmontar}</span></div>
      <div style="margin-top:4px;font-size:10px">${modelRows([...s.rf.instalar,...s.rf.desmontar,...s.rf.reubicar])}</div>
    </div>
    <div>
      <div class="col-label">Antenas</div>
      <div class="info-row"><span style="color:#16a34a;font-weight:700">▲ ${s.ant.totalInstalar}</span> <span style="color:#d97706;font-weight:700">↔ ${s.ant.totalReubicar}</span> <span style="color:#dc2626;font-weight:700">▼ ${s.ant.totalDesmontar}</span></div>
      <div style="margin-top:4px;font-size:10px">${modelRows([...s.ant.instalar,...s.ant.desmontar,...s.ant.reubicar])}</div>
    </div>
  </div>
</div>

<!-- CW -->
<div class="sec">
  ${secHead('CW', '#0369a1',
    s.cw.requerida
      ? `<span style="font-size:12px;color:#374151;font-weight:500">${s.cw.requerida === 'SI' ? 'Se Requiere CW' : 'No Requiere CW'}${s.cw.enConjunto ? ` &nbsp;/&nbsp; En Conjunto: <b>${s.cw.enConjunto}</b>` : ''}</span>`
      : ''
  )}
  ${s.cw.trabajos?.length ? `
  <div class="cw-body">
    <div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280">Trabajos en Soportes</div>
    ${s.cw.trabajos.map(t => `
    <div class="trabajo">
      <span style="font-size:10px;font-weight:700;background:#fef9c3;color:#92400e;border:1px solid #fde68a;border-radius:4px;padding:1px 7px;display:inline-block;width:fit-content">${t.tipo}</span>
      <span style="font-size:11px;color:#374151;margin-top:2px">${t.descripcion}</span>
    </div>`).join('')}
  </div>` : ''}
</div>

<!-- Energía -->
<div class="sec">
  ${secHead('Energía', '#d97706',
    fpfhInst.length  ? `<span style="font-size:10px;color:#6b7280;font-weight:600">FPFH a Instalar:</span> ${fpfhInst.map(m=>pill(m,'#dcfce7','#166534','#86efac')).join(' ')}` : ''
  )}
  <div class="energy-body">
    ${(s.energia?.items||[]).map(p => `
    <div class="power-row">
      <span class="power-name">${p.nombre}</span>
      <span style="font-size:11px;color:#374151">${fmtPower(p)}</span>
    </div>`).join('')}
    ${s.energia?.comentarios ? `<div class="comentario">${s.energia.comentarios}</div>` : ''}
  </div>
</div>

</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  function exportExcel() {
    const rows = sites.map(s => ({
      'Sitio':          s.siteName,
      'SMP-WO':         s.smpWo || '',
      'Fecha':          s.date ? fmtDate(s.date) : '',
      'Torre':          s.towerType ? `${s.towerType} ${s.towerHeight || ''}m`.trim() : '',
      'Subcontratista': s.subcontractor || '',
      'Acceso Especial': s.specialAccess.join(', '),
      'CW Requerida':   s.cw.requerida || '',
      'CW Conjunto':    s.cw.enConjunto || '',
      'FPFH':           s.fpfhModels.join(', '),
      'RF Instalar':    s.rf.totalInstalar,
      'RF Reubicar':    s.rf.totalReubicar,
      'RF Desmontar':   s.rf.totalDesmontar,
      'Ant. Instalar':  s.ant.totalInstalar,
      'Ant. Reubicar':  s.ant.totalReubicar,
      'Ant. Desmontar': s.ant.totalDesmontar,
      'Lat':            s.coords?.lat ?? '',
      'Lon':            s.coords?.lon ?? '',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'TSQA')
    XLSX.writeFile(wb, `TSQA_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const TH = {
    padding: '8px 12px', fontSize: 10, fontWeight: 700,
    letterSpacing: .5, textTransform: 'uppercase', color: '#fff',
    background: BRAND, borderBottom: `2px solid ${BRAND}cc`,
    whiteSpace: 'nowrap', textAlign: 'left',
    position: 'sticky', top: 0, zIndex: 10,
  }
  const TD = {
    padding: '10px 12px', fontSize: 12, color: '#374151',
    borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  }

  const hasSites = sites.length > 0

  return (
    <div
      style={{ padding: '24px 20px', minHeight: '80vh' }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDrop={onDrop}
    >

      {/* ── Overlay drag ── */}
      {dragging && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#eff6ff99', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `3px dashed ${BRAND}`,
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div style={{ textAlign: 'center', color: BRAND }}>
            <div style={{ fontSize: 40 }}>📋</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Suelta los archivos TSS aquí</div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple
        style={{ display: 'none' }} onChange={e => { processFiles([...e.target.files]); e.target.value = '' }} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 26, fontWeight: 800, letterSpacing: 1, color: '#111827',
            }}>TSQA</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              color: BRAND, background: '#eff6ff', border: `1px solid ${BRAND}33`,
              borderRadius: 6, padding: '3px 8px',
            }}>Technical Site Quality Audit</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {hasSites
              ? `${sites.length} ${sites.length === 1 ? 'sitio auditado' : 'sitios auditados'} - Nokia TSS`
              : 'Análisis offline de archivos TSS Nokia · Sin subida de datos'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 11, color: '#6b7280' }}>Guardando…</span>}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.dataset.hover = '1'; e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.color = BRAND }}
            onDragLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#374151' }}
            onDrop={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#374151'; onDrop(e) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              background: '#fff', border: '1.5px dashed #d1d5db', color: '#374151',
              borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: 600,
              transition: 'background .15s, border-color .15s, color .15s',
              userSelect: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.color = BRAND }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#374151' }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            <span>Agregar TSS</span>
            <span style={{ fontSize: 10, color: 'inherit', opacity: .6, fontWeight: 400 }}>· arrastra aquí</span>
          </div>
          {hasSites && <>
            <button onClick={exportExcel} style={{
              background: BRAND, border: 'none', color: '#fff',
              borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>↓ Exportar Excel</button>
          </>}
        </div>
      </div>

      {/* ── Errores ── */}
      {errors.length > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#b91c1c',
        }}>
          {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
          <div style={{ marginTop: 6, cursor: 'pointer', fontSize: 11, color: '#dc2626' }}
            onClick={() => setErrors([])}>Cerrar ✕</div>
        </div>
      )}

      {/* ── Cargando desde BD ── */}
      {storeLoading && !hasSites && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280', fontSize: 13 }}>
          Cargando audits…
        </div>
      )}

      {/* ── Drop zone vacío ── */}
      {!hasSites && !storeLoading && (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${BRAND}55`, borderRadius: 16,
            padding: '64px 40px', cursor: 'pointer', textAlign: 'center',
            background: '#f0f9ff',
            transition: 'border-color .2s, background .2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = '#e0f2fe' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = `${BRAND}55`; e.currentTarget.style.background = '#f0f9ff' }}
        >
          <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
            Arrastra aquí los archivos <span style={{ color: BRAND }}>TSS (.xlsx)</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
            Puedes cargar varios a la vez
          </div>
          <button style={{
            background: BRAND, border: 'none', color: '#fff',
            borderRadius: 8, padding: '10px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            {loading ? 'Procesando…' : 'Seleccionar archivos'}
          </button>
        </div>
      )}

      {/* ── Tabla ── */}
      {hasSites && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
              <thead>
                <tr>
                  <th style={TH}>Sitio / SMP-WO</th>
                  <th style={TH}>Fecha</th>
                  <th style={TH}>Torre</th>
                  <th style={TH}>Subcontratista</th>
                  <th style={{ ...TH, textAlign: 'center' }}>CW</th>
                  <th style={{ ...TH, textAlign: 'center' }}>FPFH</th>
                  <th style={{ ...TH, textAlign: 'center' }}>
                    <span style={{ color: '#86efac' }}>▲</span>
                    <span style={{ color: '#fde68a', margin: '0 4px' }}>↔</span>
                    <span style={{ color: '#fca5a5' }}>▼</span>
                    {' '}RF
                  </th>
                  <th style={{ ...TH, textAlign: 'center' }}>
                    <span style={{ color: '#86efac' }}>▲</span>
                    <span style={{ color: '#fde68a', margin: '0 4px' }}>↔</span>
                    <span style={{ color: '#fca5a5' }}>▼</span>
                    {' '}Antenas
                  </th>
                  <th style={TH}></th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site, idx) => {
                  const isExp = expanded === site.id
                  const rowBg = isExp ? '#f0f9ff' : idx % 2 === 0 ? '#fff' : '#fafafa'
                  return (
                    <>
                      <tr
                        key={site.id}
                        onClick={() => setExpanded(isExp ? null : site.id)}
                        style={{ cursor: 'pointer', background: rowBg, transition: 'background .1s' }}
                        onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = '#f0f9ff' }}
                        onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = rowBg }}
                      >
                        {/* Sitio */}
                        <td style={TD}>
                          <div style={{ fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                            <span style={{ color: BRAND, marginRight: 4 }}>{isExp ? '▾' : '▸'}</span>
                            {site.siteName}
                          </div>
                          {site.smpWo && (
                            <span style={{
                              fontSize: 10, color: BRAND, background: '#eff6ff',
                              border: `1px solid ${BRAND}33`, borderRadius: 4,
                              padding: '1px 6px', display: 'inline-block', marginTop: 2,
                            }}>{site.smpWo}</span>
                          )}
                        </td>

                        {/* Fecha */}
                        <td style={{ ...TD, color: '#6b7280', fontSize: 11 }}>{site.date ? fmtDate(site.date) : '—'}</td>

                        {/* Torre */}
                        <td style={TD}>
                          {site.towerType
                            ? <><span style={{ fontWeight: 600 }}>{site.towerType}</span>
                              {site.towerHeight && <span style={{ color: '#6b7280' }}> · {site.towerHeight}m</span>}</>
                            : <span style={{ color: '#6b7280' }}>—</span>}
                        </td>

                        {/* Subcontratista */}
                        <td style={{ ...TD, color: '#6b7280', fontSize: 11 }}>{site.subcontractor || '—'}</td>

                        {/* CW */}
                        <td style={{ ...TD, textAlign: 'center' }}>
                          {site.cw.requerida ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                background: site.cw.requerida === 'SI' ? '#dcfce7' : '#f3f4f6',
                                color: site.cw.requerida === 'SI' ? '#166534' : '#6b7280',
                                display: 'inline-block',
                              }}>CW: {site.cw.requerida}</span>
                              {site.cw.enConjunto && (
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                                  background: '#fef9c3', color: '#854d0e', display: 'inline-block',
                                }}>Conj: {site.cw.enConjunto}</span>
                              )}
                            </div>
                          ) : <span style={{ color: '#6b7280' }}>—</span>}
                        </td>

                        {/* FPFH */}
                        <td style={{ ...TD, textAlign: 'center' }}>
                          {(() => {
                            const inst  = site.energia?.fpfhInstalar?.length  ?? 0
                            const reloc = site.energia?.fpfhReubicar?.length  ?? 0
                            const total = inst + reloc
                            if (total === 0) return <span style={{ color: '#6b7280' }}>—</span>
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                {inst  > 0 && <span style={{ fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 4, padding: '1px 7px' }}>+{inst} nuevo{inst > 1 ? 's' : ''}</span>}
                                {reloc > 0 && <span style={{ fontSize: 11, fontWeight: 600, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: 4, padding: '1px 7px' }}>↔ {reloc} reubic.</span>}
                              </div>
                            )
                          })()}
                        </td>

                        {/* RF */}
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <RfCounts data={site.rf} />
                          <div style={{ marginTop: 4 }}>
                            <ModelList items={[...site.rf.instalar, ...site.rf.desmontar]} />
                          </div>
                        </td>

                        {/* Antenas */}
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <RfCounts data={site.ant} />
                          <div style={{ marginTop: 4 }}>
                            <ModelList items={site.ant.instalar} />
                          </div>
                        </td>

                        {/* Acciones */}
                        <td style={{ ...TD, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                            <button
                              onClick={e => { e.stopPropagation(); printAudit(site) }}
                              title="Exportar PDF"
                              style={{
                                background: '#eff6ff', border: `1px solid ${BRAND}44`,
                                color: BRAND, borderRadius: 6, padding: '3px 9px',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}
                            >PDF</button>
                            <button
                              onClick={e => { e.stopPropagation(); removeSite(site.id) }}
                              style={{
                                background: '#fff', border: '1px solid #e5e7eb',
                                color: '#6b7280', borderRadius: 6, padding: '3px 8px',
                                fontSize: 11, cursor: 'pointer',
                              }}
                            >✕</button>
                          </div>
                        </td>
                      </tr>

                      {isExp && <SiteDetail key={`${site.id}-d`} site={site} />}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer agregar más */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = BRAND }}
            onDragLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6b7280' }}
            onDrop={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6b7280'; onDrop(e) }}
            style={{
              padding: '12px 16px', borderTop: '1px dashed #e5e7eb',
              fontSize: 11, color: '#6b7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = BRAND }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6b7280' }}
          >
            <span style={{ fontSize: 14 }}>+</span>
            Arrastra más archivos TSS o haz clic para agregar
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: BRAND, color: '#fff',
          borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.15)',
        }}>Procesando archivos…</div>
      )}
    </div>
  )
}
