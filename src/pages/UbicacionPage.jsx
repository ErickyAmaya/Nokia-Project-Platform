import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { getSupabaseClient } from '../lib/supabase'
import { TABLES }            from '../lib/tables'

const WRITE_INTERVAL_MS = 30_000

const ua = navigator.userAgent || ''
const isWebView  = /wv/.test(ua) || /FB_IAB|FBAN|Instagram|GSA/.test(ua)
const isAndroid  = /Android/i.test(ua)
const isInsecure = location.protocol === 'http:' && location.hostname !== 'localhost'

export default function UbicacionPage() {
  const user       = useAuthStore(s => s.user)
  const lcName     = user?.nombre || ''

  const [active,       setActive]       = useState(false)
  const [position,     setPosition]     = useState(null)
  const [lastUpdate,   setLastUpdate]   = useState(null)
  const [error,        setError]        = useState('')
  const [permState,    setPermState]    = useState('')
  const [waitingPerm,  setWaitingPerm]  = useState(false)
  const [gpsStatus,    setGpsStatus]    = useState('') // 'gps' | 'network' | ''

  const watchRef     = useRef(null)
  const lastWriteRef = useRef(0)

  // Verificar estado del permiso al cargar
  useEffect(() => {
    if (!navigator.permissions) return
    navigator.permissions.query({ name: 'geolocation' }).then(r => {
      setPermState(r.state)
      r.onchange = () => setPermState(r.state)
    })
  }, [])

  // Limpiar watcher al desmontar
  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
  }, [])

  function writeLocation(lat, lng) {
    const now = Date.now()
    if (now - lastWriteRef.current < WRITE_INTERVAL_MS) return
    lastWriteRef.current = now
    const db = getSupabaseClient()
    if (db) db.from(TABLES.LC_LOCATIONS)
      .upsert({ lc: lcName, lat, lng, updated_at: new Date().toISOString() }, { onConflict: 'lc' })
      .then(({ error }) => { if (error) console.error('[lc_locations]', error) })
  }

  function startWatch(highAccuracy) {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    setGpsStatus(highAccuracy ? 'gps' : 'network')
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setWaitingPerm(false)
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setPosition({ lat, lng, accuracy: Math.round(accuracy) })
        setLastUpdate(new Date())
        writeLocation(lat, lng)
      },
      err => {
        // Timeout en modo GPS → reintentar con red (más rápido, menos preciso)
        if (err.code === 3 && highAccuracy) {
          setGpsStatus('network')
          startWatch(false)
          return
        }
        setWaitingPerm(false)
        setGpsStatus('')
        const msgs = {
          1: isAndroid
            ? 'Permiso denegado. En Android ve a Configuración → Aplicaciones → Chrome → Permisos → Ubicación → Permitir.'
            : 'Permiso denegado. Permite el acceso a la ubicación en la configuración del navegador.',
          2: 'No se pudo obtener la ubicación. Verifica que el GPS o los Servicios de Ubicación estén activados.',
          3: 'Tiempo de espera agotado. Intenta de nuevo en un lugar con mejor señal.',
        }
        setError(msgs[err.code] || err.message)
        setActive(false)
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: highAccuracy ? 10_000 : 60_000,
        timeout:    highAccuracy ? 30_000 : 20_000,
      }
    )
  }

  function activate() {
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return }
    if (isInsecure) {
      setError('Esta página usa HTTP. En Android, la ubicación solo funciona con HTTPS. Contacta al administrador.')
      return
    }
    setError('')
    setWaitingPerm(true)
    setActive(true)

    // En Android, getCurrentPosition dispara el diálogo de permiso más confiablemente que watchPosition.
    // Una vez concedido, iniciamos el watcher continuo.
    navigator.geolocation.getCurrentPosition(
      () => startWatch(true),
      err => {
        if (err.code === 3) {
          // Timeout pero el permiso fue concedido — igual iniciamos el watcher
          startWatch(true)
        } else {
          setWaitingPerm(false)
          setActive(false)
          const msgs = {
            1: isAndroid
              ? 'Permiso denegado. Ve a Configuración del sitio en Chrome (ícono 🔒 en la barra de dirección) → Ubicación → Permitir.'
              : 'Permiso denegado. Permite el acceso a la ubicación en la configuración del navegador.',
            2: 'No se pudo obtener la ubicación. Verifica que el GPS o los Servicios de Ubicación estén activados.',
          }
          setError(msgs[err.code] || err.message)
        }
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 }
    )
  }

  function deactivate() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    setActive(false)
    setPosition(null)
    setLastUpdate(null)
    const db = getSupabaseClient()
    if (!db) { setError('Sin conexión a base de datos'); return }
    if (!lcName) { setError('Usuario sin nombre — no se puede eliminar ubicación'); return }
    db.from(TABLES.LC_LOCATIONS).delete().eq('lc', lcName)
      .then(({ error }) => {
        if (error) setError(`Error al eliminar: ${error.message}`)
        else console.log('[lc_locations] eliminó:', lcName)
      })
  }

  function toggle() { active ? deactivate() : activate() }

  function timeAgo(date) {
    if (!date) return ''
    const sec = Math.round((Date.now() - date) / 1000)
    if (sec < 60)  return `hace ${sec}s`
    if (sec < 3600) return `hace ${Math.floor(sec / 60)}min`
    return `hace ${Math.floor(sec / 3600)}h`
  }

  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', padding: '24px 16px',
      display: 'flex', flexDirection: 'column', gap: 24,
    }}>

      {/* Aviso conexión insegura (HTTP) */}
      {isInsecure && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
          padding: '14px 16px', fontSize: 13, color: '#991b1b', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🔒 Conexión no segura (HTTP)</div>
          Android bloquea el acceso a la ubicación en páginas HTTP. Abre la plataforma usando <strong>https://</strong> en la barra de dirección.
        </div>
      )}

      {/* Aviso WebView Android */}
      {isWebView && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 12,
          padding: '14px 16px', fontSize: 13, color: '#92400e', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Abre esto en Chrome</div>
          Esta página se abrió dentro del correo. Para compartir tu ubicación debes abrirla en Chrome:
          toca los <strong>3 puntos (⋮)</strong> arriba → <strong>"Abrir en el navegador"</strong>.
        </div>
      )}

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, margin: 0 }}>
          Compartir Ubicación
        </h1>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Tu posición se compartirá en el mapa con el equipo
        </div>
      </div>

      {/* Estado + botón */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: 24,
        border: '1px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,.07)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        {/* Indicador */}
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          {active && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid #16a34a',
              animation: 'ub-pulse 1.5s ease-in-out infinite',
            }} />
          )}
          <div style={{
            position: 'absolute', inset: 10, borderRadius: '50%',
            background: active ? '#16a34a' : '#e5e7eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, transition: 'background .3s',
          }}>
            {active ? '📍' : '📵'}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: active ? '#16a34a' : '#6b7280' }}>
            {active ? 'ACTIVO' : 'INACTIVO'}
          </div>
          {active && lastUpdate && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Actualizado {timeAgo(lastUpdate)}
            </div>
          )}
          {active && position && (
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · ±{position.accuracy}m
            </div>
          )}
          {active && !position && gpsStatus === 'gps' && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Buscando señal GPS…</div>
          )}
          {active && gpsStatus === 'network' && (
            <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
              GPS sin señal — usando ubicación por red (menor precisión)
            </div>
          )}
        </div>

        {/* Botón toggle */}
        <button
          onClick={toggle}
          style={{
            width: '100%', padding: '14px 0',
            borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: 15, fontWeight: 700, transition: 'all .2s',
            background: active ? '#fef2f2' : '#16a34a',
            color:      active ? '#dc2626' : '#fff',
          }}
        >
          {active ? '⏹ Desactivar ubicación' : '▶ Activar ubicación'}
        </button>

        {/* Esperando diálogo de permiso */}
        {waitingPerm && !error && permState !== 'denied' && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
            padding: '12px 14px', fontSize: 12, color: '#1e40af', textAlign: 'center', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {isAndroid ? '👆 Debe aparecer un diálogo de permiso' : '👆 Revisa la barra de dirección'}
            </div>
            {isAndroid
              ? <>Si no ves el diálogo, toca el ícono 🔒 en la barra de dirección → <strong>Permisos del sitio</strong> → <strong>Ubicación → Permitir</strong>.</>
              : <>Toca "Permitir" en el diálogo que aparece en la parte superior del navegador.</>
            }
          </div>
        )}

        {/* Permiso bloqueado — mensaje único sin duplicados */}
        {(permState === 'denied' || (!waitingPerm && error)) && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
            padding: '13px 15px', fontSize: 12, color: '#991b1b', lineHeight: 1.7,
          }}>
            {isAndroid ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>🔒 Ubicación bloqueada en Chrome</div>
                <div>Sigue estos pasos para desbloquearla:</div>
                <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  <li>Abre Chrome → toca los <strong>3 puntos ⋮</strong> (arriba a la derecha)</li>
                  <li>Ve a <strong>Configuración → Configuración del sitio → Ubicación</strong></li>
                  <li>Busca <strong>vercel.app</strong> en la lista de bloqueados → tócalo</li>
                  <li>Cambia a <strong>Permitir</strong></li>
                  <li>Vuelve aquí y toca <strong>"Activar ubicación"</strong></li>
                </ol>
              </>
            ) : (
              'Permiso denegado. Permite el acceso a la ubicación en la configuración de tu navegador y vuelve a intentarlo.'
            )}
          </div>
        )}
      </div>

      {/* Guía paso a paso */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 16, letterSpacing: '.04em' }}>
          CÓMO FUNCIONA
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { n: 1, icon: '✅', text: 'Inicia sesión en la plataforma', done: true },
            { n: 2, icon: '▶',  text: 'Toca el botón "Activar ubicación"', done: active },
            { n: 3, icon: '🔓', text: 'Cuando el navegador pregunte, toca "Permitir"', done: permState === 'granted' },
            { n: 4, icon: '📲', text: 'Mantén esta pestaña abierta mientras estés en el sitio', done: false },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: s.done ? '#16a34a' : '#f3f4f6',
                color: s.done ? '#fff' : '#6b7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.done ? 13 : 12, fontWeight: 700,
              }}>
                {s.done ? '✓' : s.n}
              </div>
              <div style={{ fontSize: 13, color: '#374151', paddingTop: 5, lineHeight: 1.4 }}>
                {s.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div style={{ background: '#fffbeb', borderRadius: 12, padding: 16, border: '1px solid #fde68a' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>💡 TIPS</div>
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#78350f', lineHeight: 1.8 }}>
          <li>Tu ubicación se actualiza automáticamente cada 30 segundos.</li>
          <li>Si bloqueas la pantalla y la vuelves a abrir, se reactiva solo.</li>
          <li>Al salir del sitio toca "Desactivar" para que no siga apareciendo en el mapa.</li>
          <li>Solo el equipo interno puede ver tu posición en el mapa.</li>
          {isAndroid && <li><strong>Android:</strong> si no obtiene ubicación, ve a Configuración → Ubicación y activa "Alta precisión".</li>}
        </ul>
      </div>

      <style>{`
        @keyframes ub-pulse {
          0%, 100% { transform: scale(1);   opacity: .9; }
          50%       { transform: scale(1.5); opacity: .3; }
        }
      `}</style>
    </div>
  )
}
