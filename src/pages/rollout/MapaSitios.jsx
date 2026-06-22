import { useEffect, useState, useMemo, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as XLSX from 'xlsx'
import { getSupabaseClient } from '../../lib/supabase'
import { useAckStore }  from '../../store/useAckStore'
import { useAppStore }  from '../../store/useAppStore'
import { useAuthStore } from '../../store/authStore'
import UbicacionPage   from '../UbicacionPage'

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Un TSS no tiene coordenadas propias: representa un grupo cuyos sub-sitios
// físicos (definidos en sus actividades al crearlo, o agregados luego desde
// el Liquidador como gasto) son los que realmente necesitan coordenadas.
function getTssSubSitios(sitio, gastos) {
  const fromActs   = (sitio.actividades || []).map(a => a.sitioid).filter(Boolean)
  const fromGastos = (gastos || []).filter(g => g.sitio === sitio.id).map(g => g.sub_sitio).filter(Boolean)
  return [...new Set([...fromActs, ...fromGastos])].sort()
}

function pinColor(stats) {
  if (!stats) return { fill: '#94a3b8', stroke: '#64748b', label: 'Sin datos ACK' }
  if (stats.todos)       return { fill: '#16a34a', stroke: '#15803d', label: 'Cerrado' }
  if (stats.pct >= 80)   return { fill: '#f59e0b', stroke: '#d97706', label: `${stats.pct}% completado` }
  if (stats.pct >= 40)   return { fill: '#f97316', stroke: '#ea580c', label: `${stats.pct}% completado` }
  return                        { fill: '#ef4444', stroke: '#dc2626', label: `${stats.pct}% completado` }
}

function isFinal(val) {
  if (!val) return false
  return val.startsWith('9999') || val.startsWith('70.')
}

const PROCESOS = ['gap_hw_cierre','gap_on_air','gap_doc','gap_site_owner','gap_log_inv']

const PROCESO_LABELS = {
  gap_hw_cierre:  'HW Cierre',
  gap_on_air:     'On Air',
  gap_doc:        'Documentación',
  gap_site_owner: 'Site Owner',
  gap_log_inv:    'Log. Inventario',
}

function routeStopIcon(color, order) {
  return divIcon({
    className: '',
    iconSize:     [30, 30],
    iconAnchor:   [15, 15],
    tooltipAnchor:[0, -18],
    html: `<div style="
      width:30px;height:30px;background:${color.fill};border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:12px;font-weight:700;
      border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
    ">${order}</div>`,
  })
}

function towerIcon(color, isSelected) {
  const size = isSelected ? 40 : 28
  const fs   = isSelected ? 17 : 12
  const bw   = isSelected ? 2.5 : 1.5
  return divIcon({
    className: '',
    iconSize:     [size, size],
    iconAnchor:   [size / 2, size / 2],
    tooltipAnchor:[0, -(size / 2 + 4)],
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;position:relative;">
      <div class="${isSelected ? 'twring-anim' : ''}" style="
        position:absolute;inset:0;border-radius:50%;
        border:${bw}px solid ${color.fill};
        opacity:${isSelected ? 0.95 : 0.7};
      "></div>
      ${isSelected ? `<div class="twring-anim2" style="
        position:absolute;inset:0;border-radius:50%;
        border:2px solid ${color.fill};
        opacity:0.95;
      "></div>` : ''}
      <span style="font-size:${fs}px;line-height:1;position:relative;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));">🗼</span>
    </div>`,
  })
}

function lcLiveIcon(lcName) {
  const initials = (lcName || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return divIcon({
    className: '',
    iconSize:     [36, 36],
    iconAnchor:   [18, 18],
    tooltipAnchor:[0, -22],
    html: `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;position:relative;">
      <div class="lc-live-ring" style="position:absolute;inset:0;border-radius:50%;border:2.5px solid #16a34a;opacity:0.9;"></div>
      <div style="width:26px;height:26px;background:#16a34a;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:10px;font-weight:700;border:2px solid #fff;
        position:relative;z-index:1;">${initials}</div>
    </div>`,
  })
}

function lcStaticIcon(lcName, gpsActive, ackColor) {
  const initials = (lcName || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const h = gpsActive ? 44 : 30
  const anchorY = gpsActive ? 29 : 15
  return divIcon({
    className: '',
    iconSize:     [30, h],
    iconAnchor:   [15, anchorY],
    tooltipAnchor:[0, -anchorY],
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      ${gpsActive ? `<span style="font-size:11px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));">🛰️</span>` : ''}
      <div style="width:30px;height:30px;background:#fff;border-radius:50%;
        border:2.5px solid ${ackColor};
        display:flex;align-items:center;justify-content:center;
        color:#1e293b;font-size:9px;font-weight:700;
        box-shadow:0 1px 4px rgba(0,0,0,.2);">
        ${initials}
      </div>
    </div>`,
  })
}

function lcCurrentIconGreen(color) {
  const size = 48
  return divIcon({
    className: '',
    iconSize:     [size, size],
    iconAnchor:   [size / 2, size / 2],
    tooltipAnchor:[0, -(size / 2 + 4)],
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;position:relative;">
      <div class="lc-live-ring" style="position:absolute;inset:2px;border-radius:50%;border:2.5px solid #16a34a;opacity:0.95;"></div>
      <div class="lc-live-ring" style="position:absolute;inset:2px;border-radius:50%;border:2px solid #16a34a;opacity:0.9;animation-delay:0.35s"></div>
      <div style="position:absolute;inset:10px;border-radius:50%;border:1.5px solid ${color.fill};opacity:0.75;"></div>
      <span style="font-size:15px;line-height:1;position:relative;z-index:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));">🗼</span>
      <div style="position:absolute;top:1px;right:1px;width:18px;height:18px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;font-size:11px;z-index:2;">👷</div>
    </div>`,
  })
}

function lcCurrentIcon(color) {
  const size = 48
  return divIcon({
    className: '',
    iconSize:     [size, size],
    iconAnchor:   [size / 2, size / 2],
    tooltipAnchor:[0, -(size / 2 + 4)],
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;position:relative;">
      <div class="lc-ring1" style="position:absolute;inset:2px;border-radius:50%;border:2.5px solid #2563eb;opacity:0.95;"></div>
      <div class="lc-ring2" style="position:absolute;inset:2px;border-radius:50%;border:2px solid #2563eb;opacity:0.9;"></div>
      <div style="position:absolute;inset:10px;border-radius:50%;border:1.5px solid ${color.fill};opacity:0.75;"></div>
      <span style="font-size:15px;line-height:1;position:relative;z-index:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));">🗼</span>
      <div style="position:absolute;top:1px;right:1px;width:18px;height:18px;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;font-size:11px;z-index:2;">👷</div>
    </div>`,
  })
}

function FlyTo({ pin, allPins }) {
  const map     = useMap()
  const prevPin = useRef(null)
  useEffect(() => {
    if (pin) {
      map.flyTo([pin.lat, pin.lng], 16, { duration: 1.2 })
    } else if (prevPin.current && allPins?.length) {
      if (allPins.length === 1) {
        map.flyTo([allPins[0].lat, allPins[0].lng], 13, { duration: 1.2 })
      } else {
        map.flyToBounds(allPins.map(p => [p.lat, p.lng]), { padding: [60, 60], duration: 1.2, maxZoom: 13 })
      }
    }
    prevPin.current = pin
  }, [pin, map])
  return null
}

function FitBounds({ lcFilter, pins }) {
  const map     = useMap()
  const prevRef = useRef(null)
  useEffect(() => {
    if (!lcFilter || !pins.length) return
    if (prevRef.current === lcFilter) return
    prevRef.current = lcFilter
    if (pins.length === 1) {
      map.flyTo([pins[0].lat, pins[0].lng], 14, { duration: 1.4 })
      return
    }
    map.flyToBounds(pins.map(p => [p.lat, p.lng]), { padding: [50, 50], duration: 1.4, maxZoom: 13 })
  }, [lcFilter, pins, map])
  return null
}

function SiteSearch({ options, onSelect }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const ref               = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() =>
    query.length < 1 ? options : options.filter(o => norm(o.site_name).includes(norm(query)))
  , [options, query])

  function select(o) { setQuery(o.site_name); setOpen(false); onSelect(o) }
  function clear()   { setQuery('');           setOpen(false); onSelect(null) }

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 260 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          className="fc"
          type="text"
          placeholder="🔍 Buscar sitio…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{ fontSize: 11, width: '100%', paddingRight: query ? 24 : 8 }}
        />
        {query && (
          <span
            onMouseDown={e => { e.preventDefault(); clear() }}
            style={{ position: 'absolute', right: 8, cursor: 'pointer', color: '#6b7280', fontSize: 14 }}
          >×</span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0,
          zIndex: 1000, background: '#fff', border: '1px solid #e0e4e0',
          borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {filtered.slice(0, 80).map(o => (
            <div
              key={o.site_name}
              onMouseDown={() => select(o)}
              style={{
                padding: '6px 12px', fontSize: 11, cursor: 'pointer',
                borderBottom: '1px solid #f8f9f8', color: '#374151',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: o.color.fill, flexShrink: 0 }} />
              <span>{o.site_name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af' }}>{o.color.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LcSearch({ options, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const ref               = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() =>
    query.length < 1 ? options : options.filter(o => norm(o).includes(norm(query)))
  , [options, query])

  function select(lc) { setQuery(lc); setOpen(false); onChange(lc) }
  function clear()    { setQuery('');  setOpen(false); onChange('') }

  // Sync display when value cleared externally
  useEffect(() => { if (!value) setQuery('') }, [value])

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 230 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          className="fc"
          type="text"
          placeholder="👷 Todos los LC"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange('') }}
          onFocus={() => setOpen(true)}
          style={{ fontSize: 11, width: '100%', paddingRight: query ? 24 : 8 }}
        />
        {query && (
          <span
            onMouseDown={e => { e.preventDefault(); clear() }}
            style={{ position: 'absolute', right: 8, cursor: 'pointer', color: '#6b7280', fontSize: 14 }}
          >×</span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0,
          zIndex: 1000, background: '#fff', border: '1px solid #e0e4e0',
          borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.13)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          <div
            onMouseDown={() => { clear() }}
            style={{ padding: '6px 12px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f0f0f0', color: '#9ca3af', fontStyle: 'italic' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            Todos los LC
          </div>
          {filtered.map(lc => (
            <div
              key={lc}
              onMouseDown={() => select(lc)}
              style={{
                padding: '6px 12px', fontSize: 11, cursor: 'pointer',
                borderBottom: '1px solid #f8f9f8', color: '#374151',
                background: value === lc ? '#eff6ff' : '',
                fontWeight: value === lc ? 700 : 400,
              }}
              onMouseEnter={e => { if (value !== lc) e.currentTarget.style.background = '#f8faff' }}
              onMouseLeave={e => { if (value !== lc) e.currentTarget.style.background = '' }}
            >
              {lc}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SitiosUploadModal({ onClose, onDone, currentCoords, sitios, gastos, userRole }) {
  const [tab,       setTab]       = useState('masiva') // 'masiva' | 'sitio'
  const [rows,      setRows]      = useState([])
  const [newRows,   setNewRows]   = useState([])
  const [fileName,  setFileName]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [result,    setResult]    = useState(null)
  const [importMode,setImportMode]= useState('all') // 'all' | 'new'
  const fileRef = useRef(null)

  // ── Tab "Por sitio" ──────────────────────────────────────────────
  const existingNames = useMemo(() => new Set(currentCoords.map(c => c.site_name.trim().toLowerCase())), [currentCoords])

  const sitiosTI = useMemo(() =>
    (sitios || []).filter(s => s.nombre && s.tipo !== 'TSS').sort((a, b) => a.nombre.localeCompare(b.nombre))
  , [sitios])
  const sitiosTISinCoords = useMemo(() =>
    sitiosTI.filter(s => !existingNames.has(s.nombre.trim().toLowerCase()))
  , [sitiosTI, existingNames])

  // Grupos TSS expandidos a sus sub-sitios físicos (los que de verdad necesitan coordenadas)
  const tssGroups = useMemo(() => {
    return (sitios || [])
      .filter(s => s.tipo === 'TSS' && s.nombre)
      .map(s => {
        const subSitios  = getTssSubSitios(s, gastos)
        const pendientes = subSitios.filter(n => !existingNames.has(n.trim().toLowerCase()))
        return { sitio: s, subSitios, pendientes }
      })
      .filter(g => g.subSitios.length > 0)
      .sort((a, b) => a.sitio.nombre.localeCompare(b.sitio.nombre))
  }, [sitios, gastos, existingNames])
  const tssGroupsConPendientes = useMemo(() => tssGroups.filter(g => g.pendientes.length > 0), [tssGroups])

  const [singleSitio,      setSingleSitio]      = useState('')
  const [singleLat,        setSingleLat]        = useState('')
  const [singleLng,        setSingleLng]        = useState('')
  const [singlePaste,      setSinglePaste]      = useState('')
  const [singleSaving,     setSingleSaving]     = useState(false)
  const [singleResult,     setSingleResult]     = useState(null)
  const [showAllSitios,    setShowAllSitios]    = useState(false)
  const [selectedTssGroup, setSelectedTssGroup] = useState(null)

  function handlePaste(val) {
    setSinglePaste(val)
    // Formato N3.452043, W-76.54131 (prefijos direccionales)
    const mDir = val.match(/([NSns])\s*(-?\d+\.?\d*)[,\s]+([EWew])\s*(-?\d+\.?\d*)/)
    if (mDir) {
      const lat = Math.abs(parseFloat(mDir[2])) * (mDir[1].toUpperCase() === 'S' ? -1 : 1)
      const lng = Math.abs(parseFloat(mDir[4])) * (mDir[3].toUpperCase() === 'W' ? -1 : 1)
      setSingleLat(String(lat))
      setSingleLng(String(lng))
      return
    }
    // Fallback: "lat, lng" plano
    const m = val.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/)
    if (m) { setSingleLat(m[1]); setSingleLng(m[2]) }
  }

  async function saveSingle() {
    const lat = parseFloat(singleLat)
    const lng = parseFloat(singleLng)
    if (!singleSitio) { setSingleResult({ error: 'Selecciona un sitio.' }); return }
    if (isNaN(lat) || isNaN(lng)) { setSingleResult({ error: 'Lat y Lng deben ser números válidos.' }); return }
    setSingleSaving(true)
    setSingleResult(null)
    const db = getSupabaseClient()
    const { error } = await db.from('sitios_coordenadas').upsert({ site_name: singleSitio, lat, lng }, { onConflict: 'site_name' })
    setSingleSaving(false)
    if (error) { setSingleResult({ error: error.message }); return }
    setSingleResult({ ok: true })
    onDone()
    setSingleSitio(''); setSingleLat(''); setSingleLng(''); setSinglePaste('')
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()

    const filasTI = sitiosTISinCoords.length > 0
      ? sitiosTISinCoords.map(s => [s.nombre, '', ''])
      : [['EJM.Sitio_Ejemplo', 4.7110, -74.0721]]
    const wsTI = XLSX.utils.aoa_to_sheet([['site_name', 'lat', 'lng'], ...filasTI])
    wsTI['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsTI, 'Implementacion')

    const filasTSS = tssGroupsConPendientes.flatMap(g => g.pendientes.map(sub => [g.sitio.nombre, sub, '', '']))
    const wsTSS = XLSX.utils.aoa_to_sheet([
      ['tss_padre', 'site_name', 'lat', 'lng'],
      ...(filasTSS.length > 0 ? filasTSS : [['EJM.TSS_Grupo', 'EJM.SubSitio', 4.7110, -74.0721]]),
    ])
    wsTSS['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsTSS, 'TSS')

    XLSX.writeFile(wb, 'template_coordenadas_sitios.xlsx')
  }

  function exportCurrent() {
    const data = [['site_name', 'lat', 'lng'], ...currentCoords.map(c => [c.site_name, c.lat, c.lng])]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Coordenadas')
    XLSX.writeFile(wb, 'Coordenadas Sitios Actuales.xlsx')
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const wb    = XLSX.read(ev.target.result, { type: 'array' })
      const valid = wb.SheetNames.flatMap(name =>
        XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
          .map(r => ({
            site_name: (r.site_name || r['Site Name'] || r['SITE NAME'] || '').toString().trim(),
            lat: parseFloat(r.lat || r['Lat'] || r['LAT'] || r['Latitud'] || ''),
            lng: parseFloat(r.lng || r['Lng'] || r['LNG'] || r['Longitud'] || ''),
          }))
      ).filter(r => r.site_name && !isNaN(r.lat) && !isNaN(r.lng))
      const existing = new Set(currentCoords.map(c => c.site_name.trim().toLowerCase()))
      const nuevo    = valid.filter(r => !existing.has(r.site_name.toLowerCase()))
      setRows(valid)
      setNewRows(nuevo)
      setImportMode(nuevo.length > 0 ? 'new' : 'all')
      setResult(null)
    }
    reader.readAsArrayBuffer(file)
  }

  async function upload() {
    const toUpload = importMode === 'new' ? newRows : rows
    if (!toUpload.length) return
    setUploading(true)
    const db = getSupabaseClient()
    const { error } = await db
      .from('sitios_coordenadas')
      .upsert(toUpload, { onConflict: 'site_name' })
    setUploading(false)
    if (error) { setResult({ error: error.message }); return }
    setResult({ count: toUpload.length })
    onDone()
  }

  return (
    <>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 420,
        boxShadow: '0 16px 48px rgba(0,0,0,.25)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Actualizar Sitios en el Mapa</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
          {[{ id: 'masiva', label: '📂 Carga masiva' }, { id: 'sitio', label: '📍 Por sitio' }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setSingleResult(null); setSelectedTssGroup(null) }}
              style={{ padding: '7px 18px', fontSize: 12, fontWeight: 700, border: 'none', borderBottom: tab === t.id ? '2px solid #1d4ed8' : '2px solid transparent', background: 'none', color: tab === t.id ? '#1d4ed8' : '#6b7280', cursor: 'pointer', marginBottom: -2 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Por sitio */}
        {tab === 'sitio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>SITIO</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>
                  <input type="checkbox" checked={showAllSitios} onChange={e => { setShowAllSitios(e.target.checked); setSingleSitio(''); setSelectedTssGroup(null) }} />
                  Mostrar todos (incluye con coordenadas)
                </label>
              </div>
              <select value={singleSitio} onChange={e => {
                const val = e.target.value
                setSingleSitio(val)
                setSingleResult(null)
                setSinglePaste('')

                if (val.startsWith('TSS::')) {
                  const nombre = val.slice(5)
                  const group  = (showAllSitios ? tssGroups : tssGroupsConPendientes).find(g => g.sitio.nombre === nombre)
                  setSelectedTssGroup(group || null)
                  setSingleLat(''); setSingleLng('')
                  return
                }
                setSelectedTssGroup(null)
                const existing = currentCoords.find(c => c.site_name.trim().toLowerCase() === val.trim().toLowerCase())
                if (existing) { setSingleLat(String(existing.lat)); setSingleLng(String(existing.lng)) }
                else { setSingleLat(''); setSingleLng('') }
              }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}>
                <option value="">{showAllSitios ? '— Seleccionar sitio —' : '— Sitios sin coordenadas —'}</option>
                {(showAllSitios ? sitiosTI : sitiosTISinCoords).length > 0 && (
                  <optgroup label="Implementación">
                    {(showAllSitios ? sitiosTI : sitiosTISinCoords).map(s => {
                      const tienCoords = existingNames.has(s.nombre.trim().toLowerCase())
                      return <option key={s.id ?? s.nombre} value={s.nombre}>{s.nombre}{showAllSitios && tienCoords ? ' ✓' : ''}</option>
                    })}
                  </optgroup>
                )}
                {(showAllSitios ? tssGroups : tssGroupsConPendientes).length > 0 && (
                  <optgroup label="TSS">
                    {(showAllSitios ? tssGroups : tssGroupsConPendientes).map(g => (
                      <option key={g.sitio.id ?? g.sitio.nombre} value={`TSS::${g.sitio.nombre}`}>
                        {g.sitio.nombre} — {g.pendientes.length}/{g.subSitios.length} pendientes
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {!showAllSitios && sitiosTISinCoords.length === 0 && tssGroupsConPendientes.length === 0 && (
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>Todos los sitios ya tienen coordenadas.</div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                PEGAR COORDENADAS <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional — copia desde Google Maps)</span>
              </label>
              <input value={singlePaste} onChange={e => handlePaste(e.target.value)}
                placeholder="Ej: 4.7110, -74.0721 o N3.452043, W-76.54131"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>LATITUD</label>
                <input type="number" step="any" value={singleLat} onChange={e => setSingleLat(e.target.value)}
                  placeholder="Ej: 4.7110"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>LONGITUD</label>
                <input type="number" step="any" value={singleLng} onChange={e => setSingleLng(e.target.value)}
                  placeholder="Ej: -74.0721"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>

            {singleResult?.ok && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#15803d' }}>
                ✓ Coordenadas guardadas correctamente.
              </div>
            )}
            {singleResult?.error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#dc2626' }}>
                {singleResult.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose} className="btn" style={{ fontSize: 11, padding: '7px 16px', cursor: 'pointer' }}>Cancelar</button>
              {!['viewer','rollout'].includes(userRole) && (
                <button onClick={saveSingle} disabled={singleSaving} className="btn bp"
                  style={{ fontSize: 11, padding: '7px 16px', cursor: singleSaving ? 'not-allowed' : 'pointer', opacity: singleSaving ? .6 : 1 }}>
                  {singleSaving ? 'Guardando…' : 'Guardar coordenadas'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab: Carga masiva */}
        {tab === 'masiva' && <>

        {/* Paso 1 — Template */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, letterSpacing: '.04em' }}>
            PASO 1 — DESCARGA EL TEMPLATE
          </div>
          <p style={{ fontSize: 12, color: '#4b5563', margin: '0 0 10px' }}>
            El archivo tiene las columnas requeridas: <code>site_name</code>, <code>lat</code>, <code>lng</code>.
            Completa los datos de los sitios nuevos o modificados.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={downloadTemplate} className="btn" style={{ fontSize: 11, padding: '7px 14px', cursor: 'pointer' }}>
              📥 Template
            </button>
            {currentCoords.length > 0 && (
              <button onClick={exportCurrent} className="btn" style={{ fontSize: 11, padding: '7px 14px', cursor: 'pointer' }}>
                📤 Exportar {currentCoords.length} sitios actuales
              </button>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #f0f0f0', marginBottom: 18 }} />

        {/* Paso 2 — Cargar archivo */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, letterSpacing: '.04em' }}>
            PASO 2 — CARGA EL ARCHIVO COMPLETADO
          </div>
          <p style={{ fontSize: 12, color: '#4b5563', margin: '0 0 10px' }}>
            Se aceptan archivos <strong>.xlsx</strong> o <strong>.csv</strong>.
            Los sitios existentes se actualizan; los nuevos se agregan.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <button onClick={() => fileRef.current.click()} className="btn" style={{ fontSize: 11, padding: '7px 14px', cursor: 'pointer' }}>
            📂 Seleccionar archivo
          </button>
          {fileName && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#374151', marginBottom: 8 }}>
                <strong>{fileName}</strong>
              </div>
              {rows.length === 0 ? (
                <div style={{ fontSize: 12, color: '#dc2626' }}>Sin filas válidas — revisa que las columnas sean site_name, lat, lng.</div>
              ) : (
                <div style={{ background: '#f8faff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: newRows.length > 0 ? 12 : 0 }}>
                    <span><strong style={{ color: '#16a34a' }}>{newRows.length}</strong> sitios nuevos</span>
                    <span><strong style={{ color: '#6b7280' }}>{rows.length - newRows.length}</strong> ya existentes</span>
                    <span><strong>{rows.length}</strong> total</span>
                  </div>
                  {newRows.length === 0 && (
                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
                      No hay sitios nuevos. Todos ya están cargados en el mapa.
                    </div>
                  )}
                  {newRows.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                        <input type="radio" name="importMode" checked={importMode === 'new'} onChange={() => setImportMode('new')} />
                        Importar solo los <strong>{newRows.length} nuevos</strong>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                        <input type="radio" name="importMode" checked={importMode === 'all'} onChange={() => setImportMode('all')} />
                        Importar todos ({rows.length}) — actualiza coordenadas existentes también
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {result && !result.error && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#15803d', marginBottom: 14 }}>
            ✓ {result.count} sitios cargados correctamente. Recarga la página para ver los cambios.
          </div>
        )}
        {result?.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#dc2626', marginBottom: 14 }}>
            Error: {result.error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn" style={{ fontSize: 11, padding: '7px 16px', cursor: 'pointer' }}>
            Cancelar
          </button>
          {(() => {
            const toUpload = importMode === 'new' ? newRows : rows
            const disabled = !toUpload.length || uploading
            return (
              <button
                onClick={upload}
                disabled={disabled}
                className="btn bp"
                style={{ fontSize: 11, padding: '7px 16px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
              >
                {uploading ? 'Cargando…' : toUpload.length ? `Cargar ${toUpload.length} sitios` : 'Cargar'}
              </button>
            )
          })()}
        </div>
        </>}
      </div>
    </div>
    {selectedTssGroup && (
      <TssSubsitiosModal
        tss={selectedTssGroup.sitio}
        subSitios={showAllSitios ? selectedTssGroup.subSitios : selectedTssGroup.pendientes}
        currentCoords={currentCoords}
        userRole={userRole}
        onClose={() => { setSelectedTssGroup(null); setSingleSitio('') }}
        onSaved={onDone}
      />
    )}
    </>
  )
}

function TssSubsitiosModal({ tss, subSitios, currentCoords, userRole, onClose, onSaved }) {
  const canEdit = !['viewer', 'rollout'].includes(userRole)

  const [rows, setRows] = useState(() => subSitios.map(name => {
    const existing = currentCoords.find(c => c.site_name.trim().toLowerCase() === name.trim().toLowerCase())
    return {
      name,
      lat: existing ? String(existing.lat) : '',
      lng: existing ? String(existing.lng) : '',
      saving: false, saved: false, error: '',
    }
  }))
  const [savingAll, setSavingAll] = useState(false)

  function updRow(i, field, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value, saved: false, error: '' } : r))
  }

  async function saveRow(i) {
    const row = rows[i]
    const lat = parseFloat(row.lat)
    const lng = parseFloat(row.lng)
    if (isNaN(lat) || isNaN(lng)) {
      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, error: 'Lat/Lng inválidos' } : r))
      return
    }
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, saving: true, error: '' } : r))
    const db = getSupabaseClient()
    const { error } = await db.from('sitios_coordenadas').upsert({ site_name: row.name, lat, lng }, { onConflict: 'site_name' })
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, saving: false, saved: !error, error: error?.message || '' } : r))
    if (!error) onSaved()
  }

  async function saveAll() {
    const valid = rows
      .map((r, idx) => ({ ...r, idx, lat: parseFloat(r.lat), lng: parseFloat(r.lng) }))
      .filter(r => !isNaN(r.lat) && !isNaN(r.lng))
    if (!valid.length) return
    setSavingAll(true)
    const db = getSupabaseClient()
    const { error } = await db.from('sitios_coordenadas')
      .upsert(valid.map(r => ({ site_name: r.name, lat: r.lat, lng: r.lng })), { onConflict: 'site_name' })
    setSavingAll(false)
    if (error) return
    const savedIdx = new Set(valid.map(r => r.idx))
    setRows(prev => prev.map((r, idx) => savedIdx.has(idx) ? { ...r, saved: true, error: '' } : r))
    onSaved()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24, width: 520, maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,.3)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>📍 Sub-sitios de {tss.nombre}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
          {rows.length} sub-sitio{rows.length !== 1 ? 's' : ''} — carga las coordenadas uno por uno o todas a la vez.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {rows.map((row, i) => (
            <div key={row.name} style={{
              display: 'flex', gap: 6, alignItems: 'center',
              background: row.saved ? '#f0fdf4' : '#f8faff',
              border: '1px solid #e5e7eb', borderRadius: 8, padding: 8,
            }}>
              <div style={{ flex: '1 1 140px', fontSize: 11, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.name}
              </div>
              <input type="number" step="any" placeholder="Lat" value={row.lat} onChange={e => updRow(i, 'lat', e.target.value)}
                disabled={!canEdit}
                style={{ width: 80, padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11 }} />
              <input type="number" step="any" placeholder="Lng" value={row.lng} onChange={e => updRow(i, 'lng', e.target.value)}
                disabled={!canEdit}
                style={{ width: 80, padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11 }} />
              {canEdit && (
                <button onClick={() => saveRow(i)} disabled={row.saving} className="btn"
                  style={{ fontSize: 10, padding: '5px 8px', cursor: row.saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {row.saving ? '…' : row.saved ? '✓' : 'Guardar'}
                </button>
              )}
              {row.error && <div style={{ fontSize: 10, color: '#dc2626' }}>{row.error}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn" style={{ fontSize: 11, padding: '7px 16px', cursor: 'pointer' }}>Cerrar</button>
          {canEdit && (
            <button onClick={saveAll} disabled={savingAll} className="btn bp"
              style={{ fontSize: 11, padding: '7px 16px', cursor: savingAll ? 'not-allowed' : 'pointer', opacity: savingAll ? .6 : 1 }}>
              {savingAll ? 'Guardando…' : 'Guardar todas las completas'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const LC_ROLES = ['TI', 'TSS']

export default function MapaSitios() {
  const userRole = useAuthStore(s => s.user?.role)
  const [pageTab,     setPageTab]     = useState(() => LC_ROLES.includes(useAuthStore.getState().user?.role) ? 'ubicacion' : 'mapa')
  const [coords,      setCoords]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState('todos')
  const [selectedPin, setSelectedPin] = useState(null)
  const [mapLayer,    setMapLayer]    = useState('street')
  const [ctxMenu,     setCtxMenu]     = useState(null)
  const [routeMode,    setRouteMode]   = useState(false)
  const [routePins,    setRoutePins]   = useState([])
  const [lcFilter,       setLcFilter]      = useState('')
  const [uploadModal,    setUploadModal]    = useState(false)
  const [lcLive,         setLcLive]        = useState([]) // { lc, lat, lng, updated_at }
  const [rolloutItems,   setRolloutItems]  = useState([])

  const sabana   = useAckStore(s => s.sabana)
  const sitios   = useAppStore(s => s.sitios)
  const gastos   = useAppStore(s => s.gastos)
  const navigate = useNavigate()

  useEffect(() => {
    const db = getSupabaseClient()
    if (!db) return
    db.from('rollout_uploads').select('items').order('uploaded_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data?.items) setRolloutItems(data.items) })
  }, [])

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [ctxMenu])

  function openCtxMenu(pin, e) {
    e.originalEvent?.preventDefault()
    const { clientX: x, clientY: y } = e.originalEvent || e
    setCtxMenu({ pin, x, y })
  }

  function shareLocation(pin, app) {
    const { lat, lng, site_name } = pin
    const gmaps = `https://www.google.com/maps?q=${lat},${lng}`
    const waze  = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    const msg   = encodeURIComponent(`📍 *${site_name}*\n${gmaps}`)
    if (app === 'gmaps')    { window.open(gmaps, '_blank'); return }
    if (app === 'waze')     { window.open(waze,  '_blank'); return }
    if (app === 'whatsapp') { window.open(`https://wa.me/?text=${msg}`, '_blank'); return }
    if (app === 'copy')     { navigator.clipboard.writeText(`📍 ${site_name}\n${lat}, ${lng}\n${gmaps}`); return }
    if (app === 'share' && navigator.share) {
      navigator.share({ title: site_name, text: `📍 ${site_name}`, url: gmaps })
    }
  }

  useEffect(() => {
    const db = getSupabaseClient()
    if (!db) { setLoading(false); return }
    db.from('sitios_coordenadas').select('site_name,lat,lng')
      .then(({ data }) => { setCoords(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Carga inicial + Realtime de posiciones LC en vivo
  useEffect(() => {
    const db = getSupabaseClient()
    if (!db) return
    db.from('lc_locations').select('lc,lat,lng,updated_at')
      .then(({ data }) => setLcLive(data || []))
    const refetch = () =>
      db.from('lc_locations').select('lc,lat,lng,updated_at')
        .then(({ data }) => setLcLive(data || []))

    const channel = db.channel('lc_locations_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lc_locations' }, refetch)
      .subscribe()
    return () => { db.removeChannel(channel) }
  }, [])

  const ackIndex = useMemo(() => {
    const map = {}
    for (const r of sabana) {
      if (!r.main_smp || !r.site_name) continue
      const key = norm(r.site_name)
      if (!map[key]) map[key] = { smps: [], site_name: r.site_name }
      map[key].smps.push(r)
    }
    const result = {}
    for (const [key, { smps, site_name }] of Object.entries(map)) {
      const total      = smps.length
      const porProceso = PROCESOS.map(p => smps.filter(r => isFinal(r[p])).length)
      const pct        = Math.round(porProceso.reduce((s, f) => s + Math.round((f / total) * 100), 0) / PROCESOS.length)
      const todos      = porProceso.every(f => f === total)
      result[key] = { pct, todos, site_name }
    }
    return result
  }, [sabana])

  const lcByName = useMemo(() => {
    const map = {}
    for (const s of sitios) {
      if (!s.nombre) continue
      const key = norm(s.nombre)
      // Solo sobreescribir si esta fila tiene lc; no borrar un lc ya encontrado
      if (s.lc || !map[key]) map[key] = s.lc || ''
    }
    return map
  }, [sitios])

  const pins = useMemo(() =>
    coords.map(c => {
      const stats = ackIndex[norm(c.site_name)] || null
      const color = pinColor(stats)
      const lc    = lcByName[norm(c.site_name)] || ''
      return { ...c, stats, color, lc }
    })
  , [coords, ackIndex, lcByName])

  const lcOptions = useMemo(() => {
    const set = new Set(sitios.map(s => s.lc).filter(Boolean))
    return [...set].sort()
  }, [sitios])

  const lcAllPins = useMemo(() => {
    return lcOptions.map(lc => {
      const lastSitio = sitios
        .filter(s => s.lc === lc && s.fecha && s.tipo === 'TI')
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
      if (!lastSitio) return null
      const pin = pins.find(p => norm(p.site_name) === norm(lastSitio.nombre))
      if (!pin || pin.stats?.todos) return null
      return { lc, ...pin }
    }).filter(Boolean)
  }, [lcOptions, sitios, pins])

  const filtered = useMemo(() => {
    let base = pins
    if (filter === 'cerrados')        base = base.filter(p => p.stats?.todos)
    else if (filter === 'pendientes') base = base.filter(p => p.stats && !p.stats.todos)
    else if (filter === 'sinack')     base = base.filter(p => !p.stats)
    else if (filter === 'lc_activo') {
      const lcSites = new Set(lcAllPins.map(fp => fp.site_name))
      base = base.filter(p => lcSites.has(p.site_name))
    }
    if (lcFilter) base = base.filter(p => p.lc === lcFilter)
    return base
  }, [pins, filter, lcFilter, lcAllPins])

  const total    = pins.length
  const cerrados = pins.filter(p => p.stats?.todos).length
  const enCurso  = pins.filter(p => p.stats && !p.stats.todos).length
  const sinAck   = pins.filter(p => !p.stats).length

  function handlePinClick(pin) {
    if (routeMode) {
      setRoutePins(prev => {
        const idx = prev.findIndex(p => p.site_name === pin.site_name)
        return idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, pin]
      })
      return
    }
    setSelectedPin(pin)
  }

  function toggleRouteMode() {
    setRouteMode(v => !v)
    setRoutePins([])
    setSelectedPin(null)
  }

  function openRoute() {
    if (!routePins.length) return
    const stops = routePins.map(p => `${p.lat},${p.lng}`).join('/')
    window.open(`https://www.google.com/maps/dir/${stops}`, '_blank')
  }

  function moveStop(idx, dir) {
    setRoutePins(prev => {
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  const selectedSmps = useMemo(() => {
    if (!selectedPin) return []
    return sabana.filter(r => norm(r.site_name) === norm(selectedPin.site_name))
  }, [selectedPin, sabana])

  const selectedAllMainSmps = useMemo(() =>
    selectedSmps.filter(r => r.main_smp === r.smp).map(r => ({ smp: r.main_smp, proyecto: r.proyecto_alcance || '' }))
  , [selectedSmps])

  const selectedMainSmp = selectedAllMainSmps[0]?.smp || null

  // SMP del Rollout para sitios que aún no tienen entrada en ACK
  const selectedRolloutSmp = useMemo(() => {
    if (selectedMainSmp || !selectedPin || !rolloutItems.length) return null
    const match = rolloutItems.find(i => norm(i.siteName) === norm(selectedPin.site_name))
    return match?.smpId || null
  }, [selectedMainSmp, selectedPin, rolloutItems])

  const lcLiveActive = useMemo(() => {
    const cutoff = Date.now() - 60 * 60_000
    return new Set(lcLive.filter(l => new Date(l.updated_at) > cutoff).map(l => l.lc))
  }, [lcLive])

  const currentLcPin = useMemo(() => {
    if (!lcFilter) return null
    const lastSitio = sitios
      .filter(s => s.lc === lcFilter && s.fecha && s.tipo === 'TI')
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    if (!lastSitio) return null
    return pins.find(p => norm(p.site_name) === norm(lastSitio.nombre)) || null
  }, [lcFilter, sitios, pins])

  const siteProcesoStats = useMemo(() => {
    if (!selectedSmps.length) return []
    const total = selectedSmps.length
    return PROCESOS.map(p => ({
      key:   p,
      label: PROCESO_LABELS[p],
      done:  selectedSmps.filter(r => isFinal(r[p])).length,
      total,
    }))
  }, [selectedSmps])

  // ── Tab: Mi Ubicación ────────────────────────────────────────────
  if (pageTab === 'ubicacion') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 4 }}>
          {!LC_ROLES.includes(userRole) && (
            <button onClick={() => setPageTab('mapa')} style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none',
              borderBottom: '2px solid transparent', background: 'none',
              color: '#6b7280', cursor: 'pointer', marginBottom: -2,
            }}>🗺 Mapa</button>
          )}
          <button onClick={() => setPageTab('ubicacion')} style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none',
            borderBottom: '2px solid #1d4ed8', background: 'none',
            color: '#1d4ed8', cursor: 'pointer', marginBottom: -2,
          }}>📍 Mi Ubicación</button>
        </div>
        <UbicacionPage />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 10 }}>

      {/* Tab switcher (solo roles no-LC) */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: -6 }}>
        <button onClick={() => setPageTab('mapa')} style={{
          padding: '6px 20px', fontSize: 13, fontWeight: 700, border: 'none',
          borderBottom: '2px solid #1d4ed8', background: 'none',
          color: '#1d4ed8', cursor: 'pointer', marginBottom: -2,
        }}>🗺 Mapa</button>
        <button onClick={() => setPageTab('ubicacion')} style={{
          padding: '6px 20px', fontSize: 13, fontWeight: 700, border: 'none',
          borderBottom: '2px solid transparent', background: 'none',
          color: '#6b7280', cursor: 'pointer', marginBottom: -2,
        }}>📍 Mi Ubicación</button>
      </div>

      <style>{`
        @keyframes twring-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.95; }
          50%       { transform: scale(1.75); opacity: 0.2;  }
        }
        @keyframes twring-pulse2 {
          0%, 100% { transform: scale(1);    opacity: 0.7;  }
          50%       { transform: scale(2.4);  opacity: 0.0;  }
        }
        .twring-anim  { animation: twring-pulse  1.1s ease-in-out infinite; }
        .twring-anim2 { animation: twring-pulse2 1.1s ease-in-out infinite 0.35s; }
        @keyframes lc-pulse1 { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.75);opacity:.2} }
        @keyframes lc-pulse2 { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(2.4);opacity:0} }
        .lc-ring1 { animation: lc-pulse1 1.1s ease-in-out infinite; }
        .lc-ring2 { animation: lc-pulse2 1.1s ease-in-out infinite 0.35s; }
        @keyframes lc-live-pulse { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.7);opacity:.2} }
        .lc-live-ring { animation: lc-live-pulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="dash-hdr mb14" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            Mapa de Sitios
          </h1>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>{cerrados} cerrados</span>
            {' · '}
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{enCurso} en curso</span>
            {' · '}
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>{sinAck} sin ACK</span>
            {' · '}
            <span style={{ fontWeight: 600 }}>{total} total</span>
          </div>
        </div>

        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1.5px solid #e5e7eb' }}>
          {[
            { value: 'street',    label: '🗺 Mapa'     },
            { value: 'satellite', label: '🛰 Satélite' },
          ].map(o => (
            <button
              key={o.value}
              onClick={() => setMapLayer(o.value)}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none',
                cursor: 'pointer', transition: 'all .15s',
                background: mapLayer === o.value ? '#0f172a' : '#fff',
                color:      mapLayer === o.value ? '#fff'    : '#374151',
              }}
            >{o.label}</button>
          ))}
        </div>

        <SiteSearch options={pins} onSelect={p => { if (!routeMode) setSelectedPin(p) }} />

        {lcOptions.length > 0 && (
          <LcSearch options={lcOptions} value={lcFilter} onChange={setLcFilter} />
        )}

        <button
          onClick={toggleRouteMode}
          style={{
            padding: '5px 13px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: `1.5px solid ${routeMode ? '#2563eb' : '#e5e7eb'}`,
            background: routeMode ? '#2563eb' : '#fff',
            color:      routeMode ? '#fff'    : '#374151',
            cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
          }}
        >
          🛣 {routeMode ? 'Salir de Ruta' : 'Modo Ruta'}
        </button>

        {['admin','coordinador'].includes(userRole) && (
          <button
            onClick={() => setUploadModal(true)}
            className="btn"
            style={{ fontSize: 11, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📥 Actualizar Sitios
          </button>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { value: 'todos',      label: 'Todos',        color: '#374151' },
            { value: 'cerrados',   label: '✓ Cerrados',   color: '#16a34a' },
            { value: 'pendientes', label: '● En curso',   color: '#f59e0b' },
            { value: 'sinack',     label: '— Sin ACK',    color: '#94a3b8' },
            { value: 'lc_activo',  label: '👷 LCs en sitio', color: '#2563eb' },
          ].map(o => (
            <button
              key={o.value}
              onClick={() => setFilter(o.value)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                border: `1.5px solid ${filter === o.value ? o.color : '#e5e7eb'}`,
                background: filter === o.value ? o.color : '#fff',
                color:      filter === o.value ? '#fff'  : o.color,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {o.label} {filter === o.value && (
                o.value === 'lc_activo'
                  ? `(${lcAllPins.filter(fp => lcLiveActive.has(fp.lc)).length} / ${lcAllPins.length})`
                  : `(${filtered.length})`
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#6b7280', flexWrap: 'wrap' }}>
        {[
          { color: '#16a34a', label: 'Cerrado' },
          { color: '#f59e0b', label: '≥ 80%' },
          { color: '#f97316', label: '40–79%' },
          { color: '#ef4444', label: '< 40%' },
          { color: '#94a3b8', label: 'Sin datos ACK' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Mapa */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          Cargando coordenadas…
        </div>
      ) : (
        <div style={{ flex: 1, borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' }}>
          <MapContainer
            center={[4.5, -74.0]}
            zoom={6}
            maxZoom={19}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <FlyTo pin={selectedPin} allPins={filtered} />
            <FitBounds lcFilter={lcFilter} pins={filtered} />
            {mapLayer === 'street' ? (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
              />
            ) : (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; <a href="https://www.esri.com">Esri</a> — World Imagery'
                maxZoom={19}
              />
            )}

            {filtered.map(pin => {
              const isSel       = !routeMode && selectedPin?.site_name === pin.site_name
              const routeIdx    = routePins.findIndex(p => p.site_name === pin.site_name)
              const inRoute     = routeIdx >= 0
              const isCurrentLc = currentLcPin?.site_name === pin.site_name
              const icon = isCurrentLc
                ? (lcLiveActive.has(lcFilter) ? lcCurrentIconGreen(pin.color) : lcCurrentIcon(pin.color))
                : inRoute
                ? routeStopIcon(pin.color, routeIdx + 1)
                : towerIcon(pin.color, isSel)
              return (
                <Marker
                  key={pin.site_name}
                  position={[pin.lat, pin.lng]}
                  icon={icon}
                  zIndexOffset={isCurrentLc ? 2000 : inRoute ? 900 : isSel ? 1000 : 0}
                  eventHandlers={{
                    click:       () => handlePinClick(pin),
                    contextmenu: e  => openCtxMenu(pin, e),
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, isCurrentLc ? -24 : inRoute ? -18 : -(isSel ? 24 : 17)]}
                    opacity={0.97}
                    permanent={isSel || isCurrentLc}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{pin.site_name}</div>
                    <div style={{ fontSize: 11, color: pin.color.fill }}>
                      {inRoute ? `Parada ${routeIdx + 1}` : pin.color.label}
                    </div>
                    {pin.lc && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>👷 {pin.lc}</div>}
                  </Tooltip>
                </Marker>
              )
            })}

            {/* Marcadores LC en vivo */}
            {lcLive
              .filter(l => (Date.now() - new Date(l.updated_at)) / 60000 < 60)
              .map(l => (
                <Marker
                  key={`live-${l.lc}`}
                  position={[l.lat, l.lng]}
                  icon={lcLiveIcon(l.lc)}
                  zIndexOffset={3000}
                >
                  <Tooltip direction="top" offset={[0, -22]} opacity={0.97}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{l.lc}</div>
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>🟢 En vivo</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                      {(() => {
                        const sec = Math.round((Date.now() - new Date(l.updated_at)) / 1000)
                        return sec < 60 ? `hace ${sec}s` : `hace ${Math.floor(sec/60)}min`
                      })()}
                    </div>
                  </Tooltip>
                </Marker>
              ))
            }

            {/* LCs en sitio: anillos verdes (GPS activo) o azules (último sitio Liquidador) */}
            {filter === 'lc_activo' && lcAllPins
              .filter(fp => fp.lc !== lcFilter)
              .map(fp => (
                <Marker
                  key={`lc-all-${fp.lc}`}
                  position={[fp.lat, fp.lng]}
                  icon={lcStaticIcon(fp.lc, lcLiveActive.has(fp.lc), fp.color.fill)}
                  zIndexOffset={2500}
                >
                  <Tooltip direction="top" offset={[0, -22]} opacity={0.97}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{fp.site_name}</div>
                    <div style={{ fontSize: 11, color: fp.color.fill }}>{fp.color.label}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>👷 {fp.lc}</div>
                  </Tooltip>
                </Marker>
              ))
            }
          </MapContainer>

          {/* Panel de ruta */}
          {routeMode && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 800,
              background: '#fff', borderRadius: 12,
              boxShadow: '0 -4px 24px rgba(0,0,0,.18)',
              border: '1px solid #e5e7eb',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: routePins.length ? 10 : 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', flex: 1 }}>
                  🛣 Ruta
                  {routePins.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#6b7280', fontWeight: 400 }}>
                      {routePins.length} parada{routePins.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {routePins.length === 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                      Toca los pines para agregar paradas
                    </span>
                  )}
                </div>
                {routePins.length > 0 && (
                  <>
                    <button
                      onClick={openRoute}
                      className="btn bp"
                      style={{ fontSize: 11, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      🗺 Abrir en Google Maps
                    </button>
                    <button
                      onClick={() => setRoutePins([])}
                      className="btn"
                      style={{ fontSize: 11, padding: '6px 10px', cursor: 'pointer', color: '#dc2626' }}
                    >
                      Limpiar
                    </button>
                  </>
                )}
              </div>
              {routePins.length > 0 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  {routePins.map((pin, idx) => (
                    <div key={pin.site_name} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: '#f8faff', border: '1px solid #e5e7eb',
                      borderRadius: 8, padding: '4px 8px', flexShrink: 0,
                    }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: pin.color.fill, color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{idx + 1}</span>
                      <span style={{ fontSize: 10, color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pin.site_name}
                      </span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => moveStop(idx, -1)} disabled={idx === 0}
                          style={{ background: 'none', border: 'none', cursor: idx > 0 ? 'pointer' : 'default', color: idx > 0 ? '#2563eb' : '#d1d5db', fontSize: 15, fontWeight: 700, padding: '0 3px', lineHeight: 1 }}>‹</button>
                        <button onClick={() => moveStop(idx, 1)} disabled={idx === routePins.length - 1}
                          style={{ background: 'none', border: 'none', cursor: idx < routePins.length - 1 ? 'pointer' : 'default', color: idx < routePins.length - 1 ? '#2563eb' : '#d1d5db', fontSize: 15, fontWeight: 700, padding: '0 3px', lineHeight: 1 }}>›</button>
                      </div>
                      <button onClick={() => setRoutePins(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Panel lateral */}
          {selectedPin && (
            <div style={{
              position: 'absolute', top: 12, right: 12, bottom: 12,
              width: 268, zIndex: 800,
              background: '#fff', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.22)',
              border: '1px solid #e5e7eb',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Cabecera */}
              <div style={{
                padding: '13px 15px',
                borderBottom: '1px solid #f0f0f0',
                background: selectedPin.color.fill + '18',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.35, flex: 1 }}>
                    {selectedPin.site_name}
                  </div>
                  <button
                    onClick={() => setSelectedPin(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, padding: 0, marginLeft: 8, lineHeight: 1 }}
                  >×</button>
                </div>
                <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: selectedPin.color.fill, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedPin.color.fill, display: 'inline-block', flexShrink: 0 }} />
                  {selectedPin.color.label}
                </div>
                {selectedPin.lc && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>👷 {selectedPin.lc}</div>
                )}
              </div>

              {/* Progreso ACK */}
              <div style={{ padding: '14px 15px', flex: 1, overflowY: 'auto' }}>
                {selectedPin.stats ? (
                  <>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, letterSpacing: '.05em', marginBottom: 8 }}>
                      PROGRESO ACK
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
                      <div style={{ fontSize: 34, fontWeight: 700, color: selectedPin.color.fill, lineHeight: 1 }}>
                        {selectedPin.stats.pct}%
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {selectedSmps.length} SMP{selectedSmps.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ height: 7, background: '#f0f2f0', borderRadius: 4, marginBottom: 16 }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${selectedPin.stats.pct}%`,
                        background: selectedPin.color.fill,
                        transition: 'width .6s ease',
                      }} />
                    </div>

                    {/* Por proceso */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {siteProcesoStats.map(p => (
                        <div key={p.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: '#6b7280' }}>{p.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: p.done === p.total ? '#16a34a' : '#374151' }}>
                              {p.done}/{p.total}
                            </span>
                          </div>
                          <div style={{ height: 4, background: '#f0f2f0', borderRadius: 2 }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${Math.round((p.done / p.total) * 100)}%`,
                              background: p.done === p.total ? '#16a34a' : selectedPin.color.fill,
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingTop: 24 }}>
                    Sin datos ACK para este sitio
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div style={{ padding: '11px 15px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedAllMainSmps.length > 0 ? selectedAllMainSmps.map(({ smp, proyecto }) => (
                  <Fragment key={smp}>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('open-site-timeline', { detail: { smp } }))}
                      className="btn bp"
                      style={{ fontSize: 11, padding: '7px 0', width: '100%', cursor: 'pointer' }}
                    >
                      📊 Ver BaseLine{selectedAllMainSmps.length > 1 && proyecto ? ` (${proyecto})` : ''}
                    </button>
                    <button
                      onClick={() => navigate(`/rollout/ack/sitios?smp=${encodeURIComponent(smp)}`)}
                      className="btn"
                      style={{ fontSize: 11, padding: '7px 0', width: '100%', cursor: 'pointer' }}
                    >
                      📋 Ver en ACK{selectedAllMainSmps.length > 1 && proyecto ? ` (${proyecto})` : ''}
                    </button>
                  </Fragment>
                )) : selectedRolloutSmp && (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('open-site-timeline', { detail: { smp: selectedRolloutSmp } }))}
                    className="btn bp"
                    style={{ fontSize: 11, padding: '7px 0', width: '100%', cursor: 'pointer' }}
                  >
                    📊 Ver BaseLine (solo Rollout)
                  </button>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => shareLocation(selectedPin, 'gmaps')}
                    className="btn" style={{ fontSize: 11, padding: '6px 0', flex: 1, cursor: 'pointer' }}>
                    🗺 Maps
                  </button>
                  <button onClick={() => shareLocation(selectedPin, 'waze')}
                    className="btn" style={{ fontSize: 11, padding: '6px 0', flex: 1, cursor: 'pointer' }}>
                    🚗 Waze
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => shareLocation(selectedPin, 'whatsapp')}
                    className="btn" style={{ fontSize: 11, padding: '6px 0', flex: 1, cursor: 'pointer', color: '#15803d' }}>
                    💬 WhatsApp
                  </button>
                  <button onClick={() => shareLocation(selectedPin, 'copy')}
                    className="btn" style={{ fontSize: 11, padding: '6px 0', flex: 1, cursor: 'pointer' }}>
                    📋 Copiar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadModal && (
        <SitiosUploadModal
          currentCoords={coords}
          sitios={sitios}
          gastos={gastos}
          userRole={userRole}
          onClose={() => setUploadModal(false)}
          onDone={() => {
            const db = getSupabaseClient()
            if (db) db.from('sitios_coordenadas').select('site_name,lat,lng')
              .then(({ data }) => setCoords(data || []))
          }}
        />
      )}

      {/* Menú contextual */}
      {ctxMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            background: '#fff', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
            border: '1px solid #e5e7eb', minWidth: 210, overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 11, fontWeight: 700, color: '#374151' }}>
            📍 {ctxMenu.pin.site_name}
          </div>
          {[
            { icon: '🗺', label: 'Abrir en Google Maps', app: 'gmaps'    },
            { icon: '🚗', label: 'Abrir en Waze',        app: 'waze'     },
            { icon: '💬', label: 'Enviar por WhatsApp',  app: 'whatsapp' },
            { icon: '📋', label: 'Copiar coordenadas',   app: 'copy'     },
            ...(navigator.share ? [{ icon: '📤', label: 'Compartir ubicación', app: 'share' }] : []),
          ].map(o => (
            <div
              key={o.app}
              onClick={() => { shareLocation(ctxMenu.pin, o.app); setCtxMenu(null) }}
              style={{
                padding: '9px 14px', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 9, color: '#374151',
                borderBottom: '1px solid #f8f9f8',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span>{o.icon}</span>{o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
