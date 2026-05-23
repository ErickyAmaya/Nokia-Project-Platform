import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getSupabaseClient } from '../../lib/supabase'
import { useAckStore } from '../../store/useAckStore'

// Normaliza nombre para cruce: minúsculas, sin tildes, sin espacios extra
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Color del pin según progreso ACK
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

// Vuela el mapa al pin seleccionado
function FlyTo({ pin }) {
  const map = useMap()
  useEffect(() => {
    if (pin) map.flyTo([pin.lat, pin.lng], 14, { duration: 1.2 })
  }, [pin, map])
  return null
}

// Buscador con dropdown
function SiteSearch({ options, onSelect }) {
  const [query, setQuery]   = useState('')
  const [open,  setOpen]    = useState(false)
  const ref                 = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() =>
    query.length < 1 ? options : options.filter(o => norm(o.site_name).includes(norm(query)))
  , [options, query])

  function select(o) {
    setQuery(o.site_name)
    setOpen(false)
    onSelect(o)
  }

  function clear() { setQuery(''); setOpen(false); onSelect(null) }

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

export default function MapaSitios() {
  const [coords,      setCoords]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState('todos')
  const [selectedPin, setSelectedPin] = useState(null)
  const [mapLayer,    setMapLayer]    = useState('street')
  const [pulseSize,   setPulseSize]   = useState(10)
  const [ctxMenu,     setCtxMenu]     = useState(null) // { pin, x, y }

  const sabana = useAckStore(s => s.sabana)

  // Cerrar menú contextual al hacer clic fuera
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
    const msg = encodeURIComponent(`📍 *${site_name}*\n${gmaps}`)
    if (app === 'gmaps')    { window.open(gmaps, '_blank'); return }
    if (app === 'waze')     { window.open(waze,  '_blank'); return }
    if (app === 'whatsapp') { window.open(`https://wa.me/?text=${msg}`, '_blank'); return }
    if (app === 'copy')     { navigator.clipboard.writeText(`📍 ${site_name}\n${lat}, ${lng}\n${gmaps}`); return }
    if (app === 'share' && navigator.share) {
      navigator.share({ title: site_name, text: `📍 ${site_name}`, url: gmaps })
    }
  }

  // Pulso animado para el pin seleccionado
  useEffect(() => {
    if (!selectedPin) return
    setPulseSize(10)
    let grow = true
    const t = setInterval(() => {
      setPulseSize(s => {
        if (s >= 26) grow = false
        if (s <= 10) grow = true
        return grow ? s + 1 : s - 1
      })
    }, 40)
    return () => clearInterval(t)
  }, [selectedPin])

  // Cargar coordenadas desde Supabase
  useEffect(() => {
    const db = getSupabaseClient()
    if (!db) { setLoading(false); return }
    db.from('sitios_coordenadas').select('site_name,lat,lng')
      .then(({ data }) => { setCoords(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Índice ACK: site_name normalizado → stats
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
      const total = smps.length
      const porProceso = PROCESOS.map(p => smps.filter(r => isFinal(r[p])).length)
      const pct = Math.round(porProceso.reduce((s, f) => s + Math.round((f / total) * 100), 0) / PROCESOS.length)
      const todos = porProceso.every(f => f === total)
      result[key] = { pct, todos, site_name }
    }
    return result
  }, [sabana])

  // Pines finales cruzando coords con ACK
  const pins = useMemo(() => {
    return coords.map(c => {
      const stats = ackIndex[norm(c.site_name)] || null
      const color = pinColor(stats)
      return { ...c, stats, color }
    })
  }, [coords, ackIndex])

  const filtered = useMemo(() => {
    if (filter === 'cerrados')   return pins.filter(p => p.stats?.todos)
    if (filter === 'pendientes') return pins.filter(p => p.stats && !p.stats.todos)
    if (filter === 'sinack')     return pins.filter(p => !p.stats)
    return pins
  }, [pins, filter])

  // KPIs
  const total     = pins.length
  const cerrados  = pins.filter(p => p.stats?.todos).length
  const enCurso   = pins.filter(p => p.stats && !p.stats.todos).length
  const sinAck    = pins.filter(p => !p.stats).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 10 }}>

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

        {/* Toggle capa */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1.5px solid #e5e7eb' }}>
          {[
            { value: 'street',    label: '🗺 Mapa'      },
            { value: 'satellite', label: '🛰 Satélite'  },
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

        {/* Buscador */}
        <SiteSearch options={pins} onSelect={p => setSelectedPin(p)} />

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { value: 'todos',       label: 'Todos',       color: '#374151' },
            { value: 'cerrados',    label: '✓ Cerrados',  color: '#16a34a' },
            { value: 'pendientes',  label: '● En curso',  color: '#f59e0b' },
            { value: 'sinack',      label: '— Sin ACK',   color: '#94a3b8' },
          ].map(o => (
            <button
              key={o.value}
              onClick={() => setFilter(o.value)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                border: `1.5px solid ${filter === o.value ? o.color : '#e5e7eb'}`,
                background: filter === o.value ? o.color : '#fff',
                color: filter === o.value ? '#fff' : o.color,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {o.label} {filter === o.value && `(${filtered.length})`}
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
        <div style={{ flex: 1, borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <MapContainer
            center={[4.5, -74.0]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <FlyTo pin={selectedPin} />
            {mapLayer === 'street' ? (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
            ) : (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; <a href="https://www.esri.com">Esri</a> — World Imagery'
              />
            )}
            {/* Anillo pulsante del pin seleccionado */}
            {selectedPin && (
              <>
                <CircleMarker
                  center={[selectedPin.lat, selectedPin.lng]}
                  radius={pulseSize}
                  interactive={false}
                  pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.18, color: '#2563eb', weight: 2, interactive: false }}
                />
                <CircleMarker
                  center={[selectedPin.lat, selectedPin.lng]}
                  radius={9}
                  pathOptions={{ fillColor: selectedPin.color.fill, fillOpacity: 1, color: '#fff', weight: 2.5 }}
                  eventHandlers={{
                    click: () => {
                      const smp = useAckStore.getState().sabana
                        .find(r => norm(r.site_name) === norm(selectedPin.site_name) && r.main_smp === r.smp)
                        ?.main_smp
                      if (smp) window.dispatchEvent(new CustomEvent('open-site-timeline', { detail: { smp } }))
                    },
                    contextmenu: e => openCtxMenu(selectedPin, e),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.97} permanent>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{selectedPin.site_name}</div>
                    <div style={{ fontSize: 11, color: selectedPin.color.fill }}>{selectedPin.color.label}</div>
                  </Tooltip>
                </CircleMarker>
              </>
            )}

            {filtered.map(pin => (
              <CircleMarker
                key={pin.site_name}
                center={[pin.lat, pin.lng]}
                radius={6}
                pathOptions={{
                  fillColor:   pin.color.fill,
                  fillOpacity: 0.9,
                  color:       pin.color.stroke,
                  weight:      1.5,
                }}
                eventHandlers={{
                  click: () => {
                    const smp = useAckStore.getState().sabana
                      .find(r => norm(r.site_name) === norm(pin.site_name) && r.main_smp === r.smp)
                      ?.main_smp
                    if (smp) window.dispatchEvent(new CustomEvent('open-site-timeline', { detail: { smp } }))
                  },
                  contextmenu: e => openCtxMenu(pin, e),
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{pin.site_name}</div>
                  <div style={{ fontSize: 11, color: pin.color.fill }}>{pin.color.label}</div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
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
