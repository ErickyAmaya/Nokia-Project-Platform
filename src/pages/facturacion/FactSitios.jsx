import { useState, useMemo } from 'react'
import { useFactStore, buildInvoicesMap, getEventosRow, getSmpCat, SMP_CATS } from '../../store/useFactStore'

const CAT_ORDER = ['impl', 'adj', 'cw', 'cr', 'tss', 'other']
const CAT_MAP   = Object.fromEntries([...SMP_CATS, { key: 'other', label: 'Otro', color: '#9ca89c' }].map(c => [c.key, c]))

export default function FactSitios() {
  const ppa      = useFactStore(s => s.ppa)
  const invoices = useFactStore(s => s.invoices)

  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState({})

  const invMap = useMemo(() => buildInvoicesMap(invoices), [invoices])

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

  function toggle(name) {
    setExpanded(e => ({ ...e, [name]: !e[name] }))
  }

  function expandAll() {
    const all = {}
    sites.forEach(([name]) => { all[name] = true })
    setExpanded(all)
  }

  function collapseAll() { setExpanded({}) }

  if (!ppa.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca89c', fontSize: 13 }}>
      Sin datos. Carga el PPA Nokia desde el Dashboard.
    </div>
  )

  return (
    <>
      <div className="dash-hdr mb14">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Sitios</h1>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{sites.length} sitio{sites.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="fc" placeholder="Buscar sitio…" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11, width: 240 }} />
          <button onClick={expandAll}   style={{ fontSize: 10, color: '#555', background: 'none', border: '1px solid #e0e4e0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>Expandir todo</button>
          <button onClick={collapseAll} style={{ fontSize: 10, color: '#555', background: 'none', border: '1px solid #e0e4e0', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>Colapsar todo</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sites.map(([siteName, smps]) => {
          const isOpen = !!expanded[siteName]

          // Totales del sitio
          let sitePF = 0, siteFC = 0, sinSGR = 0
          for (const row of smps) {
            if (!row.sgr) { sinSGR++; continue }
            const evs = getEventosRow(row, invMap)
            if (evs.some(e => e.status === 'facturar'))  sitePF++
            if (evs.some(e => e.status === 'facturado')) siteFC++
          }

          // Agrupar SMPs por categoría en el orden definido
          const byCat = {}
          for (const row of smps) {
            const cat = getSmpCat(row.smp_name)
            const k   = CAT_ORDER.includes(cat.key) ? cat.key : 'other'
            if (!byCat[k]) byCat[k] = []
            byCat[k].push(row)
          }
          const catGroups = CAT_ORDER.filter(k => byCat[k]).map(k => ({ cat: CAT_MAP[k], rows: byCat[k] }))

          return (
            <div key={siteName} className="card" style={{ overflow: 'hidden', padding: 0 }}>
              {/* Fila del sitio */}
              <div
                onClick={() => toggle(siteName)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', cursor: 'pointer', background: isOpen ? '#f8faf8' : '#fff', borderBottom: isOpen ? '1px solid #e8eae8' : 'none', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: '#144E4A', display: 'inline-block', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#09090b' }}>{siteName}</div>
                    <div style={{ fontSize: 10, color: '#71717a', marginTop: 1 }}>{smps.length} SMP{smps.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {sitePF > 0  && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>{sitePF} por facturar</span>}
                  {siteFC > 0  && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>{siteFC} facturado{siteFC !== 1 ? 's' : ''}</span>}
                  {sinSGR > 0  && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 8px' }}>{sinSGR} sin sGR</span>}
                </div>
              </div>

              {/* Contenido expandido */}
              {isOpen && (
                <div>
                  {catGroups.map(({ cat, rows }, gi) => (
                    <div key={cat.key}>
                      {/* Separador sutil entre categorías */}
                      {gi > 0 && <div style={{ height: 1, background: '#e8eae8', margin: '0 16px' }} />}

                      {/* Etiqueta de categoría */}
                      <div style={{ padding: '5px 16px 3px', fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: cat.color, background: `${cat.color}08`, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                        {cat.label}
                      </div>

                      {/* SMPs de esta categoría */}
                      {rows.map(row => {
                        const evs  = getEventosRow(row, invMap)
                        const hasPF = evs.some(e => e.status === 'facturar')
                        const hasFC = evs.some(e => e.status === 'facturado')
                        return (
                          <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 16px 7px 30px', borderTop: '1px solid #f8f8f8', fontSize: 11 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#144E4A', fontWeight: 700, flexShrink: 0 }}>{row.smp_id}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#71717a', flexShrink: 0 }}>SPO {row.spo_number}</span>
                              <span style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.ms_name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                              {!row.sgr && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 8, fontWeight: 700, padding: '1px 6px' }}>Sin sGR</span>}
                              {hasPF   && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 8, fontWeight: 700, padding: '1px 6px' }}>Por facturar</span>}
                              {!hasPF && hasFC && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 4, fontSize: 8, fontWeight: 700, padding: '1px 6px' }}>Facturado</span>}
                              {row.sgr && <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#9ca89c' }}>{row.sgr}</span>}
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
