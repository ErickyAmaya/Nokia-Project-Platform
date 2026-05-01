import { useState, useMemo, useRef, useEffect } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, getSmpCat, SMP_CATS } from '../../store/useFactStore'

const CAT_ORDER = ['impl', 'adj', 'cw', 'cr', 'tss', 'other']
const CAT_MAP   = Object.fromEntries([...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }].map(c => [c.key, c]))

function SearchableSelect({ options, value, onChange, placeholder }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(
    () => options.filter(o => !query || o.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  )

  function select(opt) { setQuery(opt); onChange(opt); setOpen(false) }
  function clear()     { setQuery('');  onChange('');  setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <input
          className="fc"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{ minWidth: 220, fontSize: 11, paddingRight: query ? 22 : 8 }}
        />
        {query && (
          <span
            onMouseDown={e => { e.preventDefault(); clear() }}
            style={{ position: 'absolute', right: 7, cursor: 'pointer', color: '#4b5563', fontSize: 14, lineHeight: 1, userSelect: 'none' }}
          >×</span>
        )}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, minWidth: 240, zIndex: 200, background: '#fff', border: '1px solid #e0e4e0', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)', maxHeight: 300, overflowY: 'auto' }}>
          {!query && (
            <div onMouseDown={() => select('')} style={{ padding: '7px 14px', fontSize: 11, cursor: 'pointer', color: '#4b5563', borderBottom: '1px solid #f0f0f0' }}>
              — Todos los sitios
            </div>
          )}
          {filtered.length === 0
            ? <div style={{ padding: '10px 14px', fontSize: 11, color: '#617561' }}>Sin resultados</div>
            : filtered.map(o => (
              <div
                key={o}
                onMouseDown={() => select(o)}
                style={{ padding: '7px 14px', fontSize: 11, cursor: 'pointer', background: o === value ? '#f0fdf4' : undefined, color: o === value ? '#144E4A' : '#374151', fontWeight: o === value ? 700 : 400, borderBottom: '1px solid #f8f9f8' }}
                onMouseEnter={e => { if (o !== value) e.currentTarget.style.background = '#f8faf8' }}
                onMouseLeave={e => { e.currentTarget.style.background = o === value ? '#f0fdf4' : '' }}
              >
                {o}
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function MiniBar({ pct }) {
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 56, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
        <div style={{ height: 4, borderRadius: 2, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color, minWidth: 26 }}>{pct}%</span>
    </div>
  )
}

export default function FactSitios() {
  const ppa      = useFactStore(s => s.ppa)
  const invoices = useFactStore(s => s.invoices)

  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState({})

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

  const siteOptions = useMemo(() => {
    const names = [...new Set(ppa.map(r => r.customer_site_name || r.site_reference_id || 'Sin nombre'))]
    return names.sort((a, b) => a.localeCompare(b))
  }, [ppa])

  const sites = useMemo(() => {
    const map = {}
    for (const row of ppa) {
      const name = row.customer_site_name || row.site_reference_id || 'Sin nombre'
      if (!map[name]) map[name] = []
      map[name].push(row)
    }
    return Object.entries(map)
      .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [ppa, search])

  function toggle(name) { setExpanded(e => ({ ...e, [name]: !e[name] })) }

  function expandAll() {
    const all = {}
    sites.forEach(([name]) => { all[name] = true })
    setExpanded(all)
  }

  function collapseAll() { setExpanded({}) }

  if (!ppa.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#617561', fontSize: 13 }}>
      Sin datos. Carga el PPA Nokia desde el Dashboard.
    </div>
  )

  return (
    <>
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Sitios</h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{sites.length} sitio{sites.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchableSelect options={siteOptions} value={search} onChange={setSearch} placeholder="Buscar sitio…" />
          <button onClick={expandAll}   style={{ fontSize: 10, color: '#555', background: 'none', border: '1px solid #e0e4e0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>Expandir todo</button>
          <button onClick={collapseAll} style={{ fontSize: 10, color: '#555', background: 'none', border: '1px solid #e0e4e0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>Colapsar todo</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {sites.map(([siteName, smps], idx) => {
          const isOpen = !!expanded[siteName]

          let facturadoCnt = 0, pendientePF = 0, pendienteLib = 0
          for (const row of smps) {
            const evs   = getEventosRow(row, invMap)
            const hasPF = evs.some(e => e.status === 'facturar')
            const hasFC = evs.some(e => e.status === 'facturado')
            if (hasPF)       pendientePF++
            else if (!hasFC) pendienteLib++
            if (hasFC)       facturadoCnt++
          }
          const pctFc = smps.length > 0 ? Math.round((facturadoCnt / smps.length) * 100) : 0

          const byCat = {}
          for (const row of smps) {
            const cat = getSmpCat(row.smp_name)
            const k   = CAT_ORDER.includes(cat.key) ? cat.key : 'other'
            if (!byCat[k]) byCat[k] = []
            byCat[k].push(row)
          }
          const catGroups = CAT_ORDER.filter(k => byCat[k]).map(k => ({ cat: CAT_MAP[k], rows: byCat[k] }))

          return (
            <div key={siteName} style={{ borderTop: idx > 0 ? '1px solid #e8eae8' : 'none' }}>
              {/* Header del sitio */}
              <div
                onClick={() => toggle(siteName)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer', background: isOpen ? '#f8faf8' : '#fff', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: '#144E4A', flexShrink: 0, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#09090b' }}>{siteName}</span>
                      <span style={{ fontSize: 10, color: '#4b5563' }}>{smps.length} SMP{smps.length !== 1 ? 's' : ''}</span>
                      <MiniBar pct={pctFc} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                  {pendientePF > 0  && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>{pendientePF} pend.</span>}
                  {pendienteLib > 0 && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>{pendienteLib} lib.</span>}
                  {facturadoCnt > 0 && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>{facturadoCnt} fc.</span>}
                </div>
              </div>

              {/* Contenido expandido */}
              {isOpen && (
                <div style={{ borderTop: '1px solid #e8eae8' }}>
                  {catGroups.map(({ cat, rows }, gi) => (
                    <div key={cat.key}>
                      {gi > 0 && <div style={{ height: 1, background: '#f0f0f0', margin: '0 16px' }} />}
                      <div style={{ padding: '4px 16px 3px', fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: cat.color, background: `${cat.color}08`, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                        {cat.label}
                      </div>
                      {rows.map(row => {
                        const evs   = getEventosRow(row, invMap)
                        const hasPF = evs.some(e => e.status === 'facturar')
                        const hasFC = evs.some(e => e.status === 'facturado')
                        // Prioridad: rojo > verde > amarillo
                        const badge = hasPF
                          ? { bg: '#fee2e2', color: '#991b1b', label: 'Pendiente por facturar' }
                          : hasFC
                            ? { bg: '#dcfce7', color: '#166534', label: 'Facturado' }
                            : { bg: '#fef3c7', color: '#92400e', label: 'Pendiente Liberación' }
                        return (
                          <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 6px 30px', borderTop: '1px solid #f8f8f8', fontSize: 11 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#144E4A', fontWeight: 700, flexShrink: 0 }}>{row.smp_id}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#4b5563', flexShrink: 0 }}>SPO {row.spo_number}</span>
                              <span style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.ms_name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ background: badge.bg, color: badge.color, borderRadius: 4, fontSize: 8, fontWeight: 700, padding: '2px 7px', whiteSpace: 'nowrap' }}>{badge.label}</span>
                              {row.sgr && <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#b0b8b0' }}>{row.sgr}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
