import { useMemo, useState } from 'react'
import { CAT, ZONAS, cop } from '../lib/catalog'
import { useAppStore } from '../store/useAppStore'
import CatalogItemModal from '../modals/CatalogItemModal'
import SubcModal from '../modals/SubcModal'
import { useConfirm } from '../components/ConfirmModal'
import { showToast } from '../components/Toast'

function IconEdit({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

const SECCIONES   = ['BASE', 'TSS', 'ADJ', 'CR', 'CW', 'SubC']
const ZONA_LABELS = ['Principal', 'Secundaria', 'Intermedia', 'Difícil Acceso']

const SECC_COLOR = {
  BASE: { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  TSS:  { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  ADJ:  { bg: '#faf5ff', color: '#7e22ce', border: '#c4b5fd' },
  CR:   { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
  CW:   { bg: '#f0fdf4', color: '#065f46', border: '#6ee7b7' },
  SubC: { bg: '#fff0ce', color: '#92400e', border: '#FFC000' },
}

const SECC_LABEL = {
  BASE: 'BASE (Modernización / 5G / MIMO)',
  TSS:  'TSS (Site Survey)',
  ADJ:  'ADJ (Adjuntas)',
  CR:   'CR (Change Request)',
  CW:   'CW (Civil Works)',
  SubC: 'Subcontratistas',
}

// ── Subcontratistas section (moved from ConfigPage) ──────────────
function SubcSection() {
  const [modalSubc, setModalSubc] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [search,    setSearch]    = useState('')

  const subcs        = useAppStore(s => s.subcs)
  const sitios       = useAppStore(s => s.sitios)
  const eliminarSubc = useAppStore(s => s.eliminarSubc)
  const { confirm, ConfirmModalUI } = useConfirm()

  const filtered = subcs.filter(s => {
    const q = search.toLowerCase()
    return !q || `${s.lc} ${s.empresa} ${s.tipoCuadrilla}`.toLowerCase().includes(q)
  })

  async function handleEliminar(subc) {
    const tieneAsignados = sitios.filter(s => s.lc === subc.lc).length
    const ok = await confirm(
      'Eliminar Subcontratista',
      `¿Eliminar "${subc.lc} — ${subc.empresa}"?${tieneAsignados > 0 ? `\n\n⚠️ Tiene ${tieneAsignados} sitio(s) asignado(s).` : ''}`
    )
    if (!ok) return
    try {
      await eliminarSubc(subc.lc)
      showToast(`${subc.lc} eliminado`)
    } catch (e) {
      showToast('Error: ' + (e.message || ''), 'err')
    }
  }

  const catColor = { A: '#1a7a1a', AA: '#1d4ed8', AAA: '#7c3aed' }

  return (
    <div className="card">
      <div className="card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Subcontratistas / LC</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text" className="fc"
            placeholder="Buscar LC, empresa…"
            style={{ width: 180 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn bp btn-sm" onClick={() => setModalSubc(true)}>＋ Nuevo</button>
        </div>
      </div>
      <div style={{ padding: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
        <table className="tbl">
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th>LC</th>
              <th>Empresa</th>
              <th>Cat</th>
              <th>Tipo Cuadrilla</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Sitios</th>
              <th style={{ width: 70 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>
                  {subcs.length === 0 ? 'Sin subcontratistas — agrega el primero' : 'Sin resultados'}
                </td>
              </tr>
            )}
            {filtered.map(s => {
              const nSitios = sitios.filter(x => x.lc === s.lc).length
              return (
                <tr key={s.lc}>
                  <td style={{ fontWeight: 700, fontSize: 11 }}>{s.lc}</td>
                  <td style={{ fontSize: 11 }}>{s.empresa || '—'}</td>
                  <td>
                    <span className="badge" style={{ fontSize: 9, background: (catColor[s.cat] || '#555') + '18', color: catColor[s.cat] || '#555f55', fontWeight: 700 }}>
                      {s.cat}
                    </span>
                  </td>
                  <td style={{ fontSize: 10 }}>{s.tipoCuadrilla || '—'}</td>
                  <td style={{ fontSize: 10 }}>{s.tel || '—'}</td>
                  <td style={{ fontSize: 10 }}>{s.email || '—'}</td>
                  <td className="num" style={{ fontSize: 10 }}>
                    {nSitios > 0
                      ? <span className="badge bg-g" style={{ fontSize: 8 }}>{nSitios}</span>
                      : <span style={{ color: '#ccc' }}>0</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn-del"
                      style={{ marginRight: 4, background: '#f0f7ff', color: '#1d4ed8', border: '1px solid #93c5fd' }}
                      onClick={() => setEditing(s)}
                      title="Editar"
                    >✎</button>
                    <button className="btn-del" onClick={() => handleEliminar(s)} title="Eliminar">✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="tr-tot">
              <td colSpan={8}><strong>{filtered.length}</strong> subcontratistas{search && ` (de ${subcs.length} total)`}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <SubcModal open={modalSubc} onClose={() => setModalSubc(false)} />
      <SubcModal open={!!editing} subc={editing} onClose={() => setEditing(null)} />
      <ConfirmModalUI />
    </div>
  )
}

// ── Fallback TI items from hardcoded catalog ─────────────────
const TI_FALLBACK = [
  ...CAT.BASE.map(i => ({ ...i, seccion: i.id.startsWith('TSS_') ? 'TSS' : 'BASE' })),
  ...CAT.ADJ.map(i => ({ ...i, seccion: 'ADJ' })),
  ...CAT.CR.map(i => ({ ...i, seccion: 'CR' })),
]

function PriceCell({ value, highlight }) {
  if (value === null || value === undefined || value === 0) {
    return <span style={{ color: '#ccc', fontSize: 9 }}>—</span>
  }
  return (
    <span style={{ color: highlight ? '#144E4A' : '#555f55', fontWeight: highlight ? 700 : 400 }}>
      {cop(value)}
    </span>
  )
}

// ── Confirm delete ────────────────────────────────────────────
function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: 24, maxWidth: 320, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,.18)',
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600 }}>
          ¿Eliminar este ítem del catálogo?
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 11, color: '#888' }}>
          Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn bou" onClick={onCancel}>Cancelar</button>
          <button className="btn" style={{ background: '#dc2626', color: '#fff', border: 'none' }} onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function CatalogoPage() {
  const isCoord = user?.role === 'coordinador' || user?.role === 'coord'
  const [seccion,   setSeccion]   = useState(isCoord ? 'SubC' : 'BASE')
  const [zonaIdx,   setZonaIdx]   = useState(0)
  const [search,    setSearch]    = useState('')
  const [viewMode,  setViewMode]  = useState('zona')
  const [modal,     setModal]     = useState(null)   // {type, item, isNew}
  const [deleting,  setDeleting]  = useState(null)   // item to delete

  const user                = useAppStore(s => s.user)
  const catalogTI           = useAppStore(s => s.catalogTI)
  const catalogCW           = useAppStore(s => s.catalogCW)
  const saveCatalogTIItem   = useAppStore(s => s.saveCatalogTIItem)
  const deleteCatalogTIItem = useAppStore(s => s.deleteCatalogTIItem)
  const saveCatalogCWItem   = useAppStore(s => s.saveCatalogCWItem)
  const deleteCatalogCWItem = useAppStore(s => s.deleteCatalogCWItem)

  const canEdit = user?.role === 'admin' || user?.role === 'coordinador' || user?.role === 'coord'

  if (!canEdit) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#c0392b' }}>
        Acceso restringido — admin o coord.
      </div>
    )
  }

  // ── Source data: Supabase if loaded, else JS fallback ────────
  const isTILoaded = catalogTI.length > 0
  const tiItems    = isTILoaded ? catalogTI : TI_FALLBACK

  // ── Filtered items ───────────────────────────────────────────
  const items = useMemo(() => {
    const q = search.toLowerCase()
    if (seccion === 'CW') {
      return catalogCW.filter(i => {
        if (!q) return true
        return `${i.actividad_id} ${i.nombre} ${i.unidad}`.toLowerCase().includes(q)
      })
    }
    return tiItems.filter(i => {
      if (i.seccion !== seccion) return false
      if (q && !`${i.id} ${i.nombre} ${i.unidad}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [seccion, search, tiItems, catalogCW])

  const sc = SECC_COLOR[seccion] || SECC_COLOR.BASE

  // ── New item templates ────────────────────────────────────────
  const newTIItem = () => ({
    id: '', nombre: '', unidad: 'Unidad', seccion,
    nokia: [0,0,0,0], A: [0,0,0,0], AA: [0,0,0,0], AAA: [0,0,0,0],
  })
  const newCWItem = () => ({
    actividad_id: '', nombre: '', unidad: 'UN',
    precio_nokia_urbano: 0, precio_nokia_rural: 0,
    precio_subc_urbano: 0, precio_subc_rural: 0,
  })

  // ── Delete handlers ───────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleting) return
    if (seccion === 'CW') {
      await deleteCatalogCWItem(deleting.actividad_id)
    } else {
      await deleteCatalogTIItem(deleting.id)
    }
    setDeleting(null)
  }

  return (
    <>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="fb mb14">
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21, fontWeight: 700 }}>
          Catálogo de Precios
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {seccion !== 'SubC' && (
            <input
              type="text" className="fc"
              placeholder="Buscar actividad…"
              style={{ width: 200 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          )}
          {seccion !== 'SubC' && (
            <button
              className="btn bp"
              style={{ fontSize: 12, padding: '5px 14px' }}
              onClick={() => setModal({
                type: seccion === 'CW' ? 'CW' : 'TI',
                item: seccion === 'CW' ? newCWItem() : newTIItem(),
                isNew: true,
              })}
            >
              + Agregar ítem
            </button>
          )}
        </div>
      </div>

      {!isTILoaded && seccion !== 'CW' && seccion !== 'SubC' && (
        <div style={{
          marginBottom: 10, padding: '8px 14px', borderRadius: 6,
          background: '#fef9c3', border: '1px solid #fde68a', fontSize: 11, color: '#92400e',
        }}>
          Catálogo TI cargado desde datos base (sin Supabase).
          Ejecuta <code>supabase_migration_ti.sql</code> para habilitar edición persistente.
        </div>
      )}

      {/* ── Section tabs ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(isCoord ? ['SubC'] : SECCIONES).map(s => {
          const c = SECC_COLOR[s]
          const active = seccion === s
          return (
            <button
              key={s}
              onClick={() => { setSeccion(s); setSearch('') }}
              style={{
                padding: '5px 16px', borderRadius: 20, border: `1px solid ${active ? c.border : '#e0e4e0'}`,
                background: active ? c.bg : '#fff', color: active ? c.color : '#555f55',
                fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {SECC_LABEL[s]}
            </button>
          )
        })}
      </div>

      {/* ── SubC tab ────────────────────────────────────────── */}
      {seccion === 'SubC' && <SubcSection />}

      {/* ── Controls (TI only) ──────────────────────────── */}
      {seccion !== 'CW' && seccion !== 'SubC' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`btn btn-sm ${viewMode === 'zona' ? 'bp' : 'bou'}`} onClick={() => setViewMode('zona')}>
              Por Zona
            </button>
            <button className={`btn btn-sm ${viewMode === 'todas' ? 'bp' : 'bou'}`} onClick={() => setViewMode('todas')}>
              Todas las Zonas
            </button>
          </div>
          {viewMode === 'zona' && (
            <select className="fc" style={{ width: 180 }} value={zonaIdx} onChange={e => setZonaIdx(Number(e.target.value))}>
              {ZONA_LABELS.map((z, i) => <option key={i} value={i}>{z}</option>)}
            </select>
          )}
          <span style={{ fontSize: 10, color: '#9ca89c' }}>{items.length} actividades</span>
        </div>
      )}

      {seccion === 'CW' && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: '#9ca89c' }}>{items.length} actividades CW</span>
        </div>
      )}

      {/* ── Table (not shown on SubC tab) ───────────────── */}
      {seccion !== 'SubC' && <div className="card">
        <div style={{ padding: 0, overflowX: 'auto' }}>

          {/* ── CW Table ──────────────────────────────────── */}
          {seccion === 'CW' ? (
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th colSpan={3} style={{ background: '#f0f7f0', border: 'none', padding: '2px 0' }} />
                  <th colSpan={2} style={{
                    background: '#144E4A', color: '#CDFBF2', fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7, padding: '4px 10px',
                    textAlign: 'center', textTransform: 'uppercase',
                  }}>NOKIA</th>
                  <th colSpan={2} style={{
                    background: '#FFF0CE', color: '#000', fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7, padding: '4px 10px',
                    textAlign: 'center', textTransform: 'uppercase',
                  }}>SUBC</th>
                  <th style={{ background: '#f0f7f0', border: 'none' }} />
                </tr>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Unidad</th>
                  <th className="num" style={{ background: '#144E4A', color: '#CDFBF2', fontSize: 9 }}>Urbano</th>
                  <th className="num" style={{ background: '#144E4A', color: '#CDFBF2', fontSize: 9 }}>Rural</th>
                  <th className="num" style={{ background: '#FFF0CE', fontSize: 9 }}>Urbano</th>
                  <th className="num" style={{ background: '#FFF0CE', fontSize: 9 }}>Rural</th>
                  <th style={{ width: 60, textAlign: 'center', fontSize: 9 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>Sin resultados</td></tr>
                )}
                {items.map(item => (
                  <tr key={item.actividad_id}>
                    <td>
                      <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 8, fontFamily: 'monospace' }}>
                        {item.actividad_id}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, fontWeight: 600 }}>{item.nombre || item.actividad_id}</td>
                    <td style={{ fontSize: 10, color: '#777' }}>{item.unidad}</td>
                    <td className="num" style={{ background: '#eff6ff' }}><PriceCell value={item.precio_nokia_urbano} highlight /></td>
                    <td className="num" style={{ background: '#eff6ff' }}><PriceCell value={item.precio_nokia_rural} highlight /></td>
                    <td className="num" style={{ background: '#fffbeb' }}><PriceCell value={item.precio_subc_urbano} /></td>
                    <td className="num" style={{ background: '#fffbeb' }}><PriceCell value={item.precio_subc_rural} /></td>
                    <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          className="btn bou"
                          style={{ padding: '2px 8px', fontSize: 10 }}
                          onClick={() => setModal({ type: 'CW', item: { ...item }, isNew: false })}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '2px 8px', fontSize: 10, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                          onClick={() => setDeleting(item)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : viewMode === 'zona' ? (
            // ── TI Single zone view ─────────────────────────
            <table className="tbl" style={{ minWidth: 600 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th colSpan={3} style={{ background: '#f0f7f0', border: 'none', padding: '2px 0' }} />
                  <th colSpan={1} style={{
                    background: '#144E4A', color: '#CDFBF2', fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7, padding: '4px 10px',
                    textAlign: 'center', borderRadius: '6px 6px 0 0', textTransform: 'uppercase',
                  }}>NOKIA</th>
                  <th colSpan={3} style={{
                    background: '#FFF0CE', color: '#000', fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 8, fontWeight: 700, letterSpacing: .7, padding: '4px 10px',
                    textAlign: 'center', borderRadius: '6px 6px 0 0', textTransform: 'uppercase',
                  }}>SUBC — {ZONA_LABELS[zonaIdx]}</th>
                  <th style={{ background: '#f0f7f0', border: 'none' }} />
                </tr>
                <tr>
                  <th>Actividad</th>
                  <th>ID</th>
                  <th>Unidad</th>
                  <th className="num" style={{ background: '#144E4A', color: '#CDFBF2', fontSize: 9 }}>Nokia</th>
                  <th className="num" style={{ background: '#FFF0CE', fontSize: 9 }}>Cat A</th>
                  <th className="num" style={{ background: '#FFF0CE', fontSize: 9 }}>Cat AA</th>
                  <th className="num" style={{ background: '#FFF0CE', fontSize: 9 }}>Cat AAA</th>
                  <th style={{ width: 60, textAlign: 'center', fontSize: 9 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>Sin resultados</td></tr>
                )}
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontSize: 11, fontWeight: 600 }}>{item.nombre}</td>
                    <td>
                      <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 8, fontFamily: 'monospace' }}>
                        {item.id}
                      </span>
                    </td>
                    <td style={{ fontSize: 10, color: '#777' }}>{item.unidad}</td>
                    <td className="num" style={{ background: '#eff6ff' }}><PriceCell value={item.nokia?.[zonaIdx]} highlight /></td>
                    <td className="num" style={{ background: '#fffbeb' }}><PriceCell value={item.A?.[zonaIdx]} /></td>
                    <td className="num" style={{ background: '#fffbeb' }}><PriceCell value={item.AA?.[zonaIdx]} /></td>
                    <td className="num" style={{ background: '#fffbeb' }}><PriceCell value={item.AAA?.[zonaIdx]} /></td>
                    <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                      {isTILoaded ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            className="btn bou"
                            style={{ padding: '2px 8px', fontSize: 10 }}
                            onClick={() => setModal({ type: 'TI', item: { ...item }, isNew: false })}
                          >
                            <IconEdit />
                          </button>
                          <button
                            className="btn"
                            style={{ padding: '2px 8px', fontSize: 10, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                            onClick={() => setDeleting(item)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 9, color: '#ccc' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // ── TI All zones view ──────────────────────────
            <table className="tbl" style={{ minWidth: 960 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th colSpan={3} style={{ background: '#f0f7f0', border: 'none', padding: '2px 0' }} />
                  {ZONA_LABELS.map((z, i) => (
                    <th key={i} colSpan={4} style={{
                      background: i % 2 === 0 ? '#144E4A' : '#0f3b38', color: '#CDFBF2',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 8, fontWeight: 700, letterSpacing: .7,
                      padding: '4px 10px', textAlign: 'center', textTransform: 'uppercase',
                      borderRight: i < 3 ? '1px solid rgba(255,255,255,.2)' : 'none',
                    }}>{z}</th>
                  ))}
                  <th style={{ background: '#f0f7f0', border: 'none' }} />
                </tr>
                <tr>
                  <th>Actividad</th>
                  <th>ID</th>
                  <th>Unidad</th>
                  {ZONA_LABELS.flatMap((_, zi) => [
                    <th key={`n${zi}`} className="num" style={{ background: '#144E4A', color: '#CDFBF2', fontSize: 8 }}>Nokia</th>,
                    <th key={`a${zi}`} className="num" style={{ background: '#FFF0CE', fontSize: 8 }}>A</th>,
                    <th key={`aa${zi}`} className="num" style={{ background: '#FFF0CE', fontSize: 8 }}>AA</th>,
                    <th key={`aaa${zi}`} className="num" style={{ background: '#FFF0CE', fontSize: 8, borderRight: zi < 3 ? '2px solid #e0e4e0' : 'none' }}>AAA</th>,
                  ])}
                  <th style={{ width: 60, textAlign: 'center', fontSize: 9 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={3 + 16 + 1} style={{ textAlign: 'center', padding: 32, color: '#9ca89c' }}>Sin resultados</td></tr>
                )}
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{item.nombre}</td>
                    <td>
                      <span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 8, fontFamily: 'monospace' }}>
                        {item.id}
                      </span>
                    </td>
                    <td style={{ fontSize: 10, color: '#777' }}>{item.unidad}</td>
                    {[0,1,2,3].flatMap(zi => [
                      <td key={`n${zi}`} className="num" style={{ background: '#eff6ff', fontSize: 10 }}><PriceCell value={item.nokia?.[zi]} highlight /></td>,
                      <td key={`a${zi}`} className="num" style={{ background: '#fffbeb', fontSize: 10 }}><PriceCell value={item.A?.[zi]} /></td>,
                      <td key={`aa${zi}`} className="num" style={{ background: '#fffbeb', fontSize: 10 }}><PriceCell value={item.AA?.[zi]} /></td>,
                      <td key={`aaa${zi}`} className="num" style={{ background: '#fffbeb', fontSize: 10, borderRight: zi < 3 ? '2px solid #e0e4e0' : 'none' }}><PriceCell value={item.AAA?.[zi]} /></td>,
                    ])}
                    <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                      {isTILoaded ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            className="btn bou"
                            style={{ padding: '2px 8px', fontSize: 10 }}
                            onClick={() => setModal({ type: 'TI', item: { ...item }, isNew: false })}
                          >
                            <IconEdit />
                          </button>
                          <button
                            className="btn"
                            style={{ padding: '2px 8px', fontSize: 10, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                            onClick={() => setDeleting(item)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 9, color: '#ccc' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>}

      {/* ── Footer ──────────────────────────────────────── */}
      <div style={{ fontSize: 10, color: '#9ca89c', marginTop: 10, textAlign: 'right' }}>
        Precios en COP sin IVA · Catálogo Nokia 2026
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      {modal && (
        <CatalogItemModal
          type={modal.type}
          item={modal.item}
          isNew={modal.isNew}
          onSave={modal.type === 'CW' ? saveCatalogCWItem : saveCatalogTIItem}
          onClose={() => setModal(null)}
        />
      )}

      {deleting && (
        <ConfirmDelete
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}
