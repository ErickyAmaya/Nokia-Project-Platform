import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { AudioLines, SatelliteDish, RadioTower, Wrench, HardHat, Zap, FolderDown, ChevronDown, UserRoundCheck } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseTssFile } from './tsqaParser'
import { useTsqaStore }  from '../../store/useTsqaStore'
import { useAuthStore }  from '../../store/authStore'
import { useHwStore }    from '../../store/useHwStore'

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
  fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
  color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0',
  padding: '3px 10px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5,
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

// ── HW Nokia comparison helpers ────────────────────────────────────
function norm(str) {
  return String(str || '').toUpperCase().replace(/[\s\-_.]/g, '')
}

// Nokia HW catalog description patterns:
//   RF direct   "AHPCA AirScale Dual RRH …"          → 1st word = model code (exact)
//   RF MODULO   "MODULO 475964A AHFIHA …"             → 3rd word = model code
//   Antenna     "ANTENA RR3VV-6520D-R5 …"             → 2nd word = model code
//   Antenna*    "ANTENA DUALBEAM AMB4519R6V06 HUAW"   → 2nd word is descriptor; 3rd word = model code
//   FPFH unit   "MODULO CS7136001 FPFH …"             → handled by pooled/isFpfhUnit
function hwWords(hwDesc) {
  return hwDesc.toUpperCase()
    .split(/\s+/)
    .map(w => w.replace(/[^A-Z0-9]/g, ''))
    .filter(w => w.length > 0)
}
function hwContains(hwDesc, tsqaModel) {
  const t = norm(tsqaModel)
  if (t.length <= 3) return false
  const words = hwWords(hwDesc)
  if (!words.length) return false
  const first = norm(words[0])

  // ANTENA: normally 2nd word is the model code.
  // Exception: "ANTENA DUALBEAM AMB4519R6V06 …" — 2nd word is a descriptor, 3rd is the code.
  // So we check both 2nd and 3rd words.
  if (first === 'ANTENA') {
    const w2 = norm(words[1] || '')
    const w3 = norm(words[2] || '')
    return w2 === t || w2.startsWith(t) || t.startsWith(w2)
        || w3 === t || w3.startsWith(t) || t.startsWith(w3)
  }

  // MODULO: 3rd word is the model code (2nd word is material number)
  if (first === 'MODULO') {
    return words.slice(2).map(norm).includes(t)
  }

  // Direct code first (AHPCA, AHPC, AQQA…): 1st word must match exactly
  // — prevents "AHPC" from matching "AHPCA" or vice-versa
  return first === t
}

function SiteDetail({ site }) {
  const [expandedWorks, setExpandedWorks] = useState({})
  const toggleWork = i => setExpandedWorks(p => ({ ...p, [i]: !p[i] }))
  const [auditOpen, setAuditOpen] = useState(false)

  const hwEquipos    = useHwStore(s => s.hwEquipos)
  const hwMovimientos = useHwStore(s => s.hwMovimientos)
  const hwCatalogo   = useHwStore(s => s.hwCatalogo)
  const loadHw       = useHwStore(s => s.loadAll)
  const hwLoaded     = useHwStore(s => s.hwCatalogo.length > 0)

  // Build HW inventory for this site: { descripcion → cantidad }
  const hwSitio = useMemo(() => {
    if (!hwLoaded) return null
    const sNombre = site.siteName.toLowerCase()
    const byCat = {}

    // With serial
    hwEquipos
      .filter(e => e.ubicacion_actual?.toLowerCase() === sNombre)
      .forEach(e => {
        const cat = hwCatalogo.find(c => c.id === e.catalogo_id)
        if (!cat) return
        byCat[cat.descripcion] = (byCat[cat.descripcion] || 0) + 1
      })

    // Without serial (SALIDA movements, excludes pending)
    hwMovimientos
      .filter(m => m.tipo === 'SALIDA' && !m.serial && m.tipo_fuente !== 'PENDIENTE' && m.destino?.toLowerCase() === sNombre)
      .forEach(m => {
        const cat = hwCatalogo.find(c => c.id === m.catalogo_id)
        if (!cat) return
        byCat[cat.descripcion] = (byCat[cat.descripcion] || 0) + (m.cantidad || 1)
      })

    return byCat // { "PFAE 476348A IPA++": 2, ... }
  }, [hwLoaded, hwEquipos, hwMovimientos, hwCatalogo, site.siteName])

  // Match a TSQA model against HW inventory — return total qty found
  function hwQty(tsqaModel) {
    if (!hwSitio) return null
    return Object.entries(hwSitio)
      .filter(([desc]) => hwContains(desc, tsqaModel))
      .reduce((sum, [, qty]) => sum + qty, 0)
  }

  // Build comparison rows for a TSQA list
  function buildRows(tsqaItems) {
    return tsqaItems.map(({ model, count }) => {
      const hw = hwQty(model)
      const match = hw === null ? null : hw === count
      return { model, tsqa: count, hw, match }
    })
  }

  // Merge CET items (primary) with DATOS RF items (fallback for missing models)
  function mergeCetDatos(cetItems, datosItems) {
    return cetItems.map(({ count, model }) => {
      if (model) return { model, count }
      const fallback = datosItems.find(d => d.count === count)
      return { model: fallback?.model || '—', count }
    })
  }

  function RfGroup({ label, items, total, color }) {
    return (
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: total ? 4 : 0 }}>
          {label}
          <span style={{ marginLeft: 6, background: `${color}18`, color, borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>{total}</span>
        </div>
        {!!total && items.map(({ model, count }) => (
          <div key={model} style={{ fontSize: 11, color: '#4b5563', paddingLeft: 8, lineHeight: 1.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#111827', fontWeight: 600 }}>{model}</span>
            <span style={{ color: '#6b7280' }}> ×{count}</span>
          </div>
        ))}
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
              <span style={{ ...SEC_LABEL, color: '#1e40af' }}><Wrench size={13} />TI</span>
              <span style={{ fontSize: 10, color: '#6b7280' }}>Información técnica del sitio</span>
            </div>
            <div style={{ ...SEC_BODY, display: 'grid', gridTemplateColumns: '1fr 0.6fr 1.5fr 1.5fr', gap: 12, alignItems: 'start' }}>

              {/* Info del sitio */}
              <div style={{ minWidth: 0 }}>
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
                    <div style={{ marginTop: 8 }}>
                      <div style={{ ...COL_LABEL, marginBottom: 3 }}>Acceso especial</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: site.accessObs ? 3 : 0 }}>
                        {site.specialAccess.map(e => (
                          <span key={e} style={{ fontSize: 10, fontWeight: 600, background: '#faf5ff', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: 4, padding: '1px 6px' }}>{e}</span>
                        ))}
                      </div>
                      {site.accessObs && <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5, wordBreak: 'break-word' }}>{site.accessObs}</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* Torre — card */}
              <div style={{ minWidth: 0, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={COL_LABEL}>Estructura</div>
                  <RadioTower size={15} color="#92400e" />
                </div>
                {site.towerType   && <div style={{ fontSize: 12, color: '#111827', fontWeight: 600 }}>{site.towerType}</div>}
                {site.towerHeight && <div style={{ fontSize: 11, color: '#92400e', marginTop: 3 }}>Altura: <strong>{site.towerHeight} m</strong></div>}
              </div>

              {/* RF — card */}
              <div style={{ minWidth: 0, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={COL_LABEL}>RF (RFS)</div>
                  <AudioLines size={15} color="#1d4ed8" />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                  <RfGroup
                    label="Instalar"
                    items={site.cargaTorre?.rf?.length > 0 ? site.cargaTorre.rf : site.rf.instalar}
                    total={site.cargaTorre?.rf?.length > 0 ? site.cargaTorre.rfTotal : site.rf.totalInstalar}
                    color="#16a34a"
                  />
                  <RfGroup
                    label="Reubicar"
                    items={site.cargaTorre ? site.cargaTorre.rfReubicar  ?? [] : site.rf.reubicar}
                    total={site.cargaTorre ? site.cargaTorre.rfReubTotal ?? 0  : site.rf.totalReubicar}
                    color="#d97706"
                  />
                  <RfGroup
                    label="Desmontar"
                    items={site.cargaTorre?.rfDismount?.length > 0 ? site.cargaTorre.rfDismount : site.rf.desmontar}
                    total={site.cargaTorre?.rfDismount?.length > 0 ? site.cargaTorre.rfDsmTotal : site.rf.totalDesmontar}
                    color="#dc2626"
                  />
                </div>
              </div>

              {/* Antenas — card */}
              <div style={{ minWidth: 0, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={COL_LABEL}>Antenas</div>
                  <SatelliteDish size={15} color="#166534" />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                  <RfGroup
                    label="Instalar"
                    items={site.cargaTorre?.antennas?.length > 0 ? site.cargaTorre.antennas : site.ant.instalar}
                    total={site.cargaTorre?.antennas?.length > 0 ? site.cargaTorre.antTotal : site.ant.totalInstalar}
                    color="#16a34a"
                  />
                  <RfGroup
                    label="Reubicar"
                    items={site.cargaTorre ? site.cargaTorre.antReubicar  ?? [] : site.ant.reubicar}
                    total={site.cargaTorre ? site.cargaTorre.antReubTotal ?? 0  : site.ant.totalReubicar}
                    color="#d97706"
                  />
                  <RfGroup
                    label="Desmontar"
                    items={site.cargaTorre?.antDismount?.length > 0 ? site.cargaTorre.antDismount : site.ant.desmontar}
                    total={site.cargaTorre?.antDismount?.length > 0 ? site.cargaTorre.antDsmTotal : site.ant.totalDesmontar}
                    color="#dc2626"
                  />
                </div>
              </div>

              {/* Configuración tecnológica — span full grid width */}
              {site.comentariosGenerales?.length > 0 && (
                <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                  <div style={COL_LABEL}>Configuración tecnológica</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {site.comentariosGenerales.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', gap: 3, flexShrink: 0, flexWrap: 'nowrap' }}>
                          {entry.techs.map(t => (
                            <span key={t.label} style={{
                              fontSize: 9, fontWeight: 700, color: '#fff',
                              background: t.color, borderRadius: 3, padding: '2px 5px',
                              whiteSpace: 'nowrap', letterSpacing: 0.3,
                            }}>{t.label}</span>
                          ))}
                        </div>
                        <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.config}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ══ SECCIÓN CW ══════════════════════════════════════════════ */}
          {(site.cw.requerida || site.cw.trabajos?.length > 0) && (
            <div style={SEC_WRAP}>
              <div style={SEC_HEAD}>
                <span style={{ ...SEC_LABEL, color: '#166534' }}><HardHat size={13} />CW</span>
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
              <span style={{ ...SEC_LABEL, color: '#92400e' }}><Zap size={13} />Energía</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {(site.cargaTorre?.fpfh?.length > 0 || site.energia?.fpfhInstalar?.length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>FPFH a Instalar:</span>
                    {(site.cargaTorre?.fpfh?.length > 0
                      ? site.cargaTorre.fpfh.map(i => ({ label: i.count > 1 ? `${i.model} ×${i.count}` : i.model, key: i.model }))
                      : site.energia.fpfhInstalar.map(m => ({ label: m, key: m }))
                    ).map(({ label, key }) => (
                      <span key={key} style={{
                        fontSize: 10, fontWeight: 700,
                        background: '#dcfce7', color: '#166534', border: '1px solid #86efac',
                        borderRadius: 4, padding: '1px 8px',
                      }}>{label}</span>
                    ))}
                  </div>
                )}
                {(site.cargaTorre?.fpfhReubicar?.length > 0 || site.energia?.fpfhReubicar?.length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>FPFH a Reubicar:</span>
                    {(site.cargaTorre?.fpfhReubicar?.length > 0
                      ? site.cargaTorre.fpfhReubicar.map(i => ({ label: i.count > 1 ? `${i.model} ×${i.count}` : i.model, key: i.model }))
                      : site.energia.fpfhReubicar.map(m => ({ label: m, key: m }))
                    ).map(({ label, key }) => (
                      <span key={key} style={{
                        fontSize: 10, fontWeight: 700,
                        background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047',
                        borderRadius: 4, padding: '1px 8px',
                      }}>{label}</span>
                    ))}
                  </div>
                )}
                {!site.cargaTorre?.fpfh?.length && !site.energia?.fpfhInstalar?.length &&
                 !site.cargaTorre?.fpfhReubicar?.length && !site.energia?.fpfhReubicar?.length && site.fpfhModels.length > 0 && (
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

        {/* ══ AUDIT - HW NOKIA ══════════════════════════════════════ */}
        <div style={{ ...SEC_WRAP, marginBottom: 0 }}>
          <div
            style={{ ...SEC_HEAD, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setAuditOpen(prev => !prev)}
          >
            <span style={{ ...SEC_LABEL, color: '#7c3aed' }}><UserRoundCheck size={13} />AUDIT - HW NOKIA</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Verificación vs inventario Logística</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {!hwLoaded && (
                <button
                  onClick={e => { e.stopPropagation(); loadHw() }}
                  style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                >Cargar HW</button>
              )}
              <ChevronDown
                size={16}
                color="#9ca3af"
                style={{ transform: auditOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}
              />
            </div>
          </div>

          {auditOpen && (!hwLoaded ? (
            <div style={{ ...SEC_BODY, fontSize: 11, color: '#9ca3af' }}>
              Haz clic en "Cargar HW" para cruzar con el inventario de Logística.
            </div>
          ) : (
            <div style={{ ...SEC_BODY, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Antenas */}
              {(site.cargaTorre?.antennas?.length > 0 || site.ant.instalar.length > 0) && (
                <div>
                  <div style={COL_LABEL}>Antenas a instalar</div>
                  <HwCompareTable
                    rows={buildRows(
                      site.cargaTorre?.antennas?.length > 0
                        ? mergeCetDatos(site.cargaTorre.antennas, site.ant.instalar)
                        : site.ant.instalar
                    )}
                    hwSitio={hwSitio}
                    sectionLabel="antena"
                  />
                </div>
              )}

              {/* RF */}
              {(site.cargaTorre?.rf?.length > 0 || site.rf.instalar.length > 0) && (
                <div>
                  <div style={COL_LABEL}>RF modules a instalar</div>
                  <HwCompareTable
                    rows={buildRows(
                      site.cargaTorre?.rf?.length > 0
                        ? mergeCetDatos(site.cargaTorre.rf, site.rf.instalar)
                        : site.rf.instalar
                    )}
                    hwSitio={hwSitio}
                    sectionLabel="RF module"
                  />
                </div>
              )}

              {/* FPFH — CET como fuente primaria, DATOS POWER como respaldo */}
              {(site.cargaTorre?.fpfh?.length > 0 || site.energia?.fpfhInstalar?.length > 0) && (
                <div>
                  <div style={COL_LABEL}>FPFH a instalar</div>
                  <HwCompareTable
                    rows={buildRows(
                      site.cargaTorre?.fpfh?.length > 0
                        ? mergeCetDatos(site.cargaTorre.fpfh, (site.energia?.fpfhInstalar || []).map(m => ({ model: m, count: 1 })))
                        : (site.energia?.fpfhInstalar || []).map(m => ({ model: m, count: 1 }))
                    )}
                    hwSitio={hwSitio}
                    sectionLabel="FPFH"
                    pooled
                  />
                </div>
              )}

              {/* FPFH a reubicar */}
              {site.cargaTorre?.fpfhReubicar?.length > 0 && (
                <div>
                  <div style={COL_LABEL}>FPFH a reubicar</div>
                  <HwCompareTable
                    rows={buildRows(site.cargaTorre.fpfhReubicar)}
                    hwSitio={hwSitio}
                    sectionLabel="FPFH"
                    pooled
                  />
                </div>
              )}

              {/* Antenas a desmontar */}
              {(site.cargaTorre?.antDismount?.length > 0 || site.ant.desmontar.length > 0) && (
                <div>
                  <div style={COL_LABEL}>Antenas a desmontar</div>
                  <HwCompareTable
                    rows={buildRows(
                      site.cargaTorre?.antDismount?.length > 0
                        ? mergeCetDatos(site.cargaTorre.antDismount, site.ant.desmontar)
                        : site.ant.desmontar
                    )}
                    hwSitio={hwSitio}
                    sectionLabel="antena"
                  />
                </div>
              )}

              {/* RF a desmontar */}
              {(site.cargaTorre?.rfDismount?.length > 0 || site.rf.desmontar.length > 0) && (
                <div>
                  <div style={COL_LABEL}>RF a desmontar</div>
                  <HwCompareTable
                    rows={buildRows(
                      site.cargaTorre?.rfDismount?.length > 0
                        ? mergeCetDatos(site.cargaTorre.rfDismount, site.rf.desmontar)
                        : site.rf.desmontar
                    )}
                    hwSitio={hwSitio}
                    sectionLabel="RF module"
                  />
                </div>
              )}

              {/* Sin HW registrado */}
              {hwSitio && Object.keys(hwSitio).length === 0 && (
                <div style={{ fontSize: 11, color: '#9ca3af' }}>No se encontró HW asignado a este sitio en Logística.</div>
              )}
            </div>
          ))}
        </div>

        </div>
      </td>
    </tr>
  )
}

// Extract significant tokens from a model name (len > 3, no common words)
function modelTokens(model) {
  return String(model).toUpperCase().split(/[\s\-_.+]+/)
    .map(t => t.replace(/[^A-Z0-9]/g, ''))
    .filter(t => t.length > 3)
}

// Accessories/cables: never count as RF/antenna/FPFH units
const ACCESSORY_WORDS = ['CABLE', 'CONVERSOR', 'JUMPER', 'CONECTOR', 'ADAPTADOR', 'PIGTAIL', 'HDMI', 'BRACKET', 'GNSS', 'GPS']
const isAccessory = desc => ACCESSORY_WORDS.some(w => norm(desc).includes(w))

// Exact RF module catalog — only these 6 model codes qualify as RF modules
const RF_MODEL_CODES = ['AHCA', 'AHFIHA', 'AHPCB', 'AQQA', 'AHPC', 'AHPCA']
const isRfModuleHw = desc => RF_MODEL_CODES.some(code => hwContains(desc, code))

// Exact antenna catalog — 2nd word of each "ANTENA <code> ..." HW description
const ANTENNA_MODEL_CODES = [
  '2VV-33B-R4-V6', '476348A', '4P-4L-C2', '84510992',
  'ADU4516R6V06', 'APXVBB20B_43-C-I20', 'APXVLLLL15B_43-C-I20',
  'ASI4517R3V06', 'ASI4517R3V18', 'AMB4519R6V06',
  'JAHH-33C-R3B', 'RR3VV-6520D-R5', 'RRV4-65D-R6',
  'RRVV-33B-R2', 'RRVV-65A-R4VB', 'RRVV-65B-R2VB',
]
const isAntennaHw = desc => ANTENNA_MODEL_CODES.some(code => hwContains(desc, code))

function HwCompareTable({ rows, hwSitio = {}, sectionLabel = 'equipo', pooled = false }) {
  const sectionTokens = [...new Set(rows.flatMap(r => modelTokens(r.model)))]

  const isFpfhUnit = desc => { const d = norm(desc); return d.includes('FPFH') && d.includes('MODULO') }

  // Type-specific fallback: antenas → must start with ANTENA
  //                         RF module → must match one of the 6 catalog model codes exactly
  const sectionHwTypeMatch = desc => {
    if (sectionLabel === 'antena') return isAntennaHw(desc)
    if (sectionLabel === 'RF module') return isRfModuleHw(desc)
    return false
  }

  // Same-type HW at site (accessories always excluded)
  const sectionHwAll = Object.entries(hwSitio).filter(([desc]) => {
    if (isAccessory(desc)) return false
    if (pooled) return isFpfhUnit(desc)
    const d = norm(desc)
    return rows.some(r => hwContains(desc, r.model))
      || sectionTokens.some(t => d.includes(t))
      || sectionHwTypeMatch(desc)
  })

  // ── Pooled mode (FPFH): one aggregated row, qty only, model irrelevant ──
  if (pooled) {
    const tsqaTotal = rows.reduce((s, r) => s + r.tsqa, 0)
    const hwTotal   = sectionHwAll.reduce((s, [, q]) => s + q, 0)
    const ok        = tsqaTotal === hwTotal
    const rowBg     = hwTotal === 0 ? '#fff1f2' : ok ? '#f0fdf4' : '#fffbeb'
    const TH_P = { padding: '5px 8px', background: '#f3f4f6', fontWeight: 700, fontSize: 10,
      color: '#6b7280', letterSpacing: .4, textTransform: 'uppercase', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }
    return (
      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ ...TH_P, textAlign: 'center', width: 64 }}>Cant. TSS</th>
              <th style={{ ...TH_P, textAlign: 'center', width: 64 }}>Cant. HW</th>
              <th style={{ ...TH_P, textAlign: 'left' }}>Modelos en TSS</th>
              <th style={{ ...TH_P, textAlign: 'left' }}>Modelo HW Asignado</th>
              <th style={{ ...TH_P, textAlign: 'center', width: 100 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: rowBg }}>
              <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', textAlign: 'center', fontWeight: 700, color: '#0369a1' }}>{tsqaTotal}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', textAlign: 'center', fontWeight: 700, color: hwTotal > 0 ? '#16a34a' : '#9ca3af' }}>{hwTotal || '—'}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', color: '#374151' }}>{rows.map(r => r.model).join(', ')}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', color: hwTotal > 0 ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>
                {sectionHwAll.length > 0 ? sectionHwAll.map(([d, q]) => `${q}× ${d}`).join(' / ') : '—'}
              </td>
              <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {hwTotal === 0
                  ? <span style={{ color: '#dc2626', fontWeight: 700 }}>✗ Sin HW</span>
                  : ok
                    ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ OK</span>
                    : <span style={{ color: '#d97706', fontWeight: 700 }}>⚠ Dif. cant.</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // ── Normal mode (Antenas / RF) ──────────────────────────────────────

  const matchedDescs = new Set(
    rows.flatMap(r => r.hw > 0
      ? Object.keys(hwSitio).filter(desc => hwContains(desc, r.model))
      : []
    )
  )
  const altHw = sectionHwAll.filter(([desc]) => !matchedDescs.has(desc))

  const enriched = rows.map(r => {
    if (r.match !== false || r.hw > 0) return { ...r, altDescs: [] }
    return { ...r, altDescs: altHw }
  })

  // ── Section totals (primary comparison) ──────────────────────────
  const tsqaSectionTotal = rows.reduce((s, r) => s + r.tsqa, 0)
  const hwSectionTotal   = sectionHwAll.reduce((s, [, q]) => s + q, 0)
  const totalsMatch      = hwSectionTotal === tsqaSectionTotal
  const hasModelDiff     = enriched.some(r => r.altDescs.length > 0 && r.hw === 0)
  // Per-model: all rows have exact model match
  const allModelsMatch   = enriched.every(r => r.match === true)

  // Overall section status
  const sectionStatus = hwSectionTotal === 0
    ? { label: '✗ Sin HW asignado', bg: '#fff1f2', border: '#fecaca', color: '#dc2626' }
    : !totalsMatch
      ? { label: `⚠ Cant. total difiere (TSS: ${tsqaSectionTotal} / HW: ${hwSectionTotal})`, bg: '#fff1f2', border: '#fecaca', color: '#dc2626' }
      : allModelsMatch
        ? { label: `✓ Cantidad y modelos correctos (${tsqaSectionTotal} uds.)`, bg: '#f0fdf4', border: '#86efac', color: '#16a34a' }
        : { label: `✓ Cantidad correcta (${tsqaSectionTotal} uds.) · ⚠ Verificar modelos`, bg: '#fffbeb', border: '#fcd34d', color: '#b45309' }

  const TH_S = { padding: '5px 8px', background: '#f3f4f6', fontWeight: 700, fontSize: 10,
    color: '#6b7280', letterSpacing: .4, textTransform: 'uppercase', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }

  return (
    <div>
      {/* Primary: totals summary */}
      <div style={{ padding: '6px 12px', marginBottom: 6, background: sectionStatus.bg, border: `1px solid ${sectionStatus.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: sectionStatus.color }}>
        {sectionStatus.label}
      </div>

      {/* Secondary: per-model detail */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ ...TH_S, textAlign: 'center', width: 64 }}>Cant. TSS</th>
            <th style={{ ...TH_S, textAlign: 'center', width: 64 }}>Cant. HW</th>
            <th style={{ ...TH_S, textAlign: 'left' }}>Modelo en TSS</th>
            <th style={{ ...TH_S, textAlign: 'left' }}>Modelo HW Asignado</th>
            <th style={{ ...TH_S, textAlign: 'center', width: 100, whiteSpace: 'nowrap' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {enriched.map(({ model, tsqa, hw, match, altDescs }) => {
            const altTotal = altDescs.reduce((s, [, q]) => s + q, 0)
            const hwQtyShow = hw > 0 ? hw : altTotal > 0 ? altTotal : null

            const hwModelCell = hw > 0
              ? <span style={{ color: '#16a34a', fontWeight: 600 }}>{model}</span>
              : altDescs.length > 0
                ? <span style={{ color: '#92400e', fontWeight: 600 }}>{altDescs.map(([d]) => d).join(' / ')}</span>
                : <span style={{ color: '#9ca3af' }}>—</span>

            const statusCell = match === null
              ? <span style={{ color: '#9ca3af' }}>—</span>
              : match
                ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ OK</span>
                : altDescs.length > 0
                  ? <span style={{ color: '#d97706', fontWeight: 700 }}>⚠ Dif. modelo</span>
                  : hw > 0
                    ? <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠ Dif. cant.</span>
                    : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗ Sin HW</span>

            const rowBg = match === true ? '#f0fdf4'
              : altDescs.length > 0 ? '#fffbeb'
              : match === false ? '#fff1f2'
              : '#fff'

            return (
              <tr key={model} style={{ background: rowBg }}>
                <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', textAlign: 'center', fontWeight: 700, color: '#0369a1' }}>{tsqa}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', textAlign: 'center', fontWeight: 700, color: hwQtyShow > 0 ? '#16a34a' : '#9ca3af' }}>
                  {hwQtyShow ?? '—'}
                </td>
                <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', fontWeight: 600, color: '#111827' }}>{model}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>{hwModelCell}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0', textAlign: 'center', whiteSpace: 'nowrap' }}>{statusCell}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {hasModelDiff && (
        <div style={{ marginTop: 6, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 10, color: '#b45309', fontStyle: 'italic' }}>
          ⚠ Por favor validar si el modelo de {sectionLabel} asignado fue autorizado, de lo contrario verificar y corregir antes de despachar a sitio.
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function TsqaPage() {
  const { audits, loading: storeLoading, loaded, loadAudits, saveAudit, deleteAudit } = useTsqaStore()
  const userId = useAuthStore(s => s.user?.id)

  const [expanded,   setExpanded]  = useState(null)
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
    for (const file of fileList) {
      if (!file.name.match(/\.xlsx?$/i)) {
        newErrors.push(`${file.name}: solo se admiten archivos .xlsx`)
        continue
      }
      try {
        const buf = await file.arrayBuffer()
        const result = parseTssFile(new Uint8Array(buf), file.name)
        if (result) {
          await saveAudit(result, userId)
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
    e.preventDefault()
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

    // CET-aware data
    const rfInstalar  = s.cargaTorre?.rf?.length > 0        ? s.cargaTorre.rf          : s.rf.instalar
    const rfTotalInst = s.cargaTorre?.rf?.length > 0        ? s.cargaTorre.rfTotal     : s.rf.totalInstalar
    const rfReub      = s.cargaTorre                        ? (s.cargaTorre.rfReubicar  ?? []) : s.rf.reubicar
    const rfTotalReub = s.cargaTorre                        ? (s.cargaTorre.rfReubTotal ?? 0)  : s.rf.totalReubicar
    const rfDsm       = s.cargaTorre?.rfDismount?.length > 0 ? s.cargaTorre.rfDismount : s.rf.desmontar
    const rfTotalDsm  = s.cargaTorre?.rfDismount?.length > 0 ? s.cargaTorre.rfDsmTotal : s.rf.totalDesmontar

    const antInstalar  = s.cargaTorre?.antennas?.length > 0   ? s.cargaTorre.antennas   : s.ant.instalar
    const antTotalInst = s.cargaTorre?.antennas?.length > 0   ? s.cargaTorre.antTotal   : s.ant.totalInstalar
    const antReub      = s.cargaTorre                         ? (s.cargaTorre.antReubicar  ?? []) : s.ant.reubicar
    const antTotalReub = s.cargaTorre                         ? (s.cargaTorre.antReubTotal ?? 0)  : s.ant.totalReubicar
    const antDsm       = s.cargaTorre?.antDismount?.length > 0 ? s.cargaTorre.antDismount : s.ant.desmontar
    const antTotalDsm  = s.cargaTorre?.antDismount?.length > 0 ? s.cargaTorre.antDsmTotal : s.ant.totalDesmontar

    const fpfhInstItems = s.cargaTorre?.fpfh?.length > 0
      ? s.cargaTorre.fpfh
      : (s.energia?.fpfhInstalar || []).map(m => ({ model: m, count: 1 }))
    const fpfhReubItems = s.cargaTorre?.fpfhReubicar?.length > 0
      ? s.cargaTorre.fpfhReubicar
      : (s.energia?.fpfhReubicar || []).map(m => ({ model: m, count: 1 }))

    const rfGroup = (label, items, total, color) => {
      const badge = `<span style="background:${color}20;color:${color};border-radius:3px;padding:1px 5px;font-size:9px;font-weight:700;margin-left:4px">${total}</span>`
      const header = `<div style="font-size:10px;font-weight:700;color:${color};margin-bottom:${total ? 3 : 0}px">${label}${badge}</div>`
      if (!total) return `<div style="flex:1;min-width:0">${header}</div>`
      const rows = items.map(({model, count}) =>
        `<div style="font-size:10px;color:#4b5563;padding-left:5px;line-height:1.8;white-space:nowrap"><b style="color:#111827">${model}</b><span style="color:#6b7280"> ×${count}</span></div>`
      ).join('')
      return `<div style="flex:1;min-width:0">${header}${rows}</div>`
    }

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>TSQA · ${s.siteName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #fff; padding: 24px; font-size: 12px; }
  h1 { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .badge { display:inline-block; font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; background:#eff6ff; color:#0369a1; border:1px solid #bfdbfe; border-radius:6px; padding:3px 8px; }
  .sec { border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:10px; }
  .grid-ti { display:grid; grid-template-columns:1fr 0.6fr 1.5fr 1.5fr; gap:12px; padding:14px 16px; align-items:start; }
  .card { border-radius:8px; padding:10px 12px; }
  .card-amber { background:#fffbeb; border:1px solid #fde68a; }
  .card-blue  { background:#eff6ff; border:1px solid #bfdbfe; }
  .card-green { background:#f0fdf4; border:1px solid #bbf7d0; }
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
      ${s.subcontractor ? `<span class="badge" style="background:#f5f3ff;color:#6d28d9;border-color:#c4b5fd">SUBC. TSS: ${s.subcontractor}</span>` : ''}
    </div>
  </div>
  <div style="text-align:right;font-size:10px;color:#9ca3af">Nokia TSS · TSQA</div>
</div>

<!-- TI -->
<div class="sec">
  ${secHead('TI', '#16a34a')}
  <div class="grid-ti">
    <!-- Sitio -->
    <div style="min-width:0">
      <div class="col-label">Sitio</div>
      ${s.address  ? `<div class="info-row">${s.address}</div>` : ''}
      ${s.siteType ? `<div class="info-row" style="color:#0369a1;font-weight:600">◆ ${s.siteType}</div>` : ''}
      ${s.coords   ? `<div class="info-row" style="color:#6b7280;font-size:10px">${s.coords.lat.toFixed(6)}, ${s.coords.lon.toFixed(6)}</div>` : ''}
      ${s.specialAccess?.length ? `<div style="margin-top:6px"><div class="col-label" style="margin-bottom:3px">Acceso especial</div><div style="font-size:10px;color:#7c3aed;font-weight:600">${s.specialAccess.join(' · ')}</div></div>` : ''}
      ${s.accessObs ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.5;word-break:break-word">${s.accessObs}</div>` : ''}
    </div>
    <!-- Estructura -->
    <div class="card card-amber" style="min-width:0">
      <div class="col-label">Estructura</div>
      ${s.towerType ? `<div style="font-size:12px;color:#111827;font-weight:700">${s.towerType}</div>` : '<div style="color:#9ca3af">—</div>'}
      ${s.towerHeight ? `<div style="font-size:11px;color:#92400e;margin-top:3px">Altura: <b>${s.towerHeight} m</b></div>` : ''}
    </div>
    <!-- RF -->
    <div class="card card-blue" style="min-width:0">
      <div class="col-label" style="margin-bottom:8px">RF (RFS)</div>
      <div style="display:flex;gap:6px">
        ${rfGroup('Instalar', rfInstalar, rfTotalInst, '#16a34a')}
        ${rfGroup('Reubicar', rfReub, rfTotalReub, '#d97706')}
        ${rfGroup('Desmontar', rfDsm, rfTotalDsm, '#dc2626')}
      </div>
    </div>
    <!-- Antenas -->
    <div class="card card-green" style="min-width:0">
      <div class="col-label" style="margin-bottom:8px">Antenas</div>
      <div style="display:flex;gap:6px">
        ${rfGroup('Instalar', antInstalar, antTotalInst, '#16a34a')}
        ${rfGroup('Reubicar', antReub, antTotalReub, '#d97706')}
        ${rfGroup('Desmontar', antDsm, antTotalDsm, '#dc2626')}
      </div>
    </div>
    ${s.comentariosGenerales?.length ? `
    <!-- Configuración tecnológica -->
    <div style="grid-column:1/-1;min-width:0;margin-top:4px;padding-top:10px;border-top:1px solid #f0f0f0">
      <div class="col-label" style="margin-bottom:6px">Configuración tecnológica</div>
      ${s.comentariosGenerales.map(entry => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;overflow:hidden">
          <div style="display:flex;gap:3px;flex-shrink:0">
            ${entry.techs.map(t => `<span style="font-size:8px;font-weight:700;color:#fff;background:${t.color};border-radius:3px;padding:2px 5px;white-space:nowrap">${t.label}</span>`).join('')}
          </div>
          <span style="font-size:10px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entry.config}</span>
        </div>`).join('')}
    </div>` : ''}
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
    fpfhInstItems.length ? `<span style="font-size:10px;color:#6b7280;font-weight:600">FPFH a Instalar:</span> ${fpfhInstItems.map(i => pill(i.count > 1 ? `${i.model} ×${i.count}` : i.model, '#dcfce7', '#166534', '#86efac')).join(' ')}` : ''
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
    <div style={{ padding: '24px 20px', minHeight: '80vh' }}>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple
        style={{ display: 'none' }} onChange={e => { processFiles([...e.target.files]); e.target.value = '' }} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
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
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, cursor: 'pointer',
              background: '#fff', border: '1.5px dashed #d1d5db', color: '#374151',
              borderRadius: 10, padding: '6px 32px', fontSize: 12, fontWeight: 600,
              transition: 'background .15s, border-color .15s, color .15s',
              userSelect: 'none', alignSelf: 'stretch',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.color = BRAND }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#374151' }}
          >
            <FolderDown size={16} strokeWidth={1.8} />
            <span>+ Agregar TSS</span>
            <span style={{ fontSize: 10, color: 'inherit', opacity: .6, fontWeight: 400 }}>Arrastra aquí (Archivos xlsx.)</span>
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
                  <th style={TH} title="Subcontratista TSS">SUBC. TSS</th>
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
                              {site.cw.enConjunto && site.cw.enConjunto !== 'NO' && (
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
                            const inst = site.cargaTorre ? (site.cargaTorre.fpfhTotal ?? 0) : (site.energia?.fpfhInstalar?.length ?? 0)
                            if (!inst) return <span style={{ color: '#6b7280' }}>—</span>
                            return <span style={{ fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 4, padding: '1px 7px' }}>+{inst} nuevo{inst > 1 ? 's' : ''}</span>
                          })()}
                        </td>

                        {/* RF */}
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <RfCounts data={{
                            totalInstalar:  site.cargaTorre?.rf?.length > 0          ? site.cargaTorre.rfTotal      : site.rf.totalInstalar,
                            totalReubicar:  site.cargaTorre                          ? (site.cargaTorre.rfReubTotal  ?? 0) : site.rf.totalReubicar,
                            totalDesmontar: site.cargaTorre?.rfDismount?.length > 0  ? site.cargaTorre.rfDsmTotal   : site.rf.totalDesmontar,
                          }} />
                          <div style={{ marginTop: 4 }}>
                            <ModelList items={[
                              ...(site.cargaTorre?.rf?.length > 0         ? site.cargaTorre.rf         : site.rf.instalar),
                              ...(site.cargaTorre?.rfDismount?.length > 0 ? site.cargaTorre.rfDismount : site.rf.desmontar),
                            ]} />
                          </div>
                        </td>

                        {/* Antenas */}
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <RfCounts data={{
                            totalInstalar:  site.cargaTorre?.antennas?.length > 0    ? site.cargaTorre.antTotal     : site.ant.totalInstalar,
                            totalReubicar:  site.cargaTorre                          ? (site.cargaTorre.antReubTotal ?? 0) : site.ant.totalReubicar,
                            totalDesmontar: site.cargaTorre?.antDismount?.length > 0 ? site.cargaTorre.antDsmTotal  : site.ant.totalDesmontar,
                          }} />
                          <div style={{ marginTop: 4 }}>
                            <ModelList items={site.cargaTorre?.antennas?.length > 0 ? site.cargaTorre.antennas : site.ant.instalar} />
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
