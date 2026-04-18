import { useState, useRef, useEffect } from 'react'

/**
 * SearchableSelect — combo buscable reutilizable
 * Props:
 *   options   : [{ value, label, sub }]  — lista de opciones
 *   value     : string                   — valor seleccionado
 *   onChange  : (value) => void
 *   placeholder: string
 *   disabled  : bool
 */
export default function SearchableSelect({ options = [], value, onChange, placeholder = 'Buscar…', disabled = false }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState(-1)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find(o => String(o.value) === String(value))

  const filtered = query.trim()
    ? options.filter(o => `${o.label} ${o.sub || ''}`.toLowerCase().includes(query.toLowerCase()))
    : options

  // Cerrar al click fuera
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    if (disabled) return
    setOpen(true); setQuery(''); setFocus(-1)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleSelect(opt) {
    onChange(opt.value)
    setOpen(false); setQuery('')
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(f => Math.min(f+1, filtered.length-1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocus(f => Math.max(f-1, 0)) }
    if (e.key === 'Enter' && focus >= 0) { handleSelect(filtered[focus]) }
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        style={{
          width: '100%', border: `1.5px solid ${open ? '#1a9c1a' : '#d1d5db'}`, borderRadius: 5,
          padding: '7px 9px', fontSize: 12, background: disabled ? '#f5f5f5' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          color: selected ? '#0a0a0a' : '#9ca89c',
          transition: 'border-color .15s',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ fontSize: 9, color: '#9ca89c', marginLeft: 6 }}>▾</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 600,
          background: '#fff', border: '1.5px solid #1a9c1a', borderTop: 'none',
          borderRadius: '0 0 6px 6px', maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,.15)',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #e0e4e0', position: 'sticky', top: 0, background: '#fff' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setFocus(-1) }}
              onKeyDown={handleKey}
              placeholder="Buscar…"
              style={{
                width: '100%', border: '1.5px solid #e0e4e0', borderRadius: 4,
                padding: '5px 8px', fontSize: 11, outline: 'none',
                fontFamily: "'Barlow', sans-serif",
              }}
            />
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 11, color: '#9ca89c', textAlign: 'center' }}>
              Sin resultados
            </div>
          )}
          {filtered.map((opt, i) => (
            <div
              key={opt.value}
              onMouseDown={() => handleSelect(opt)}
              onMouseEnter={() => setFocus(i)}
              style={{
                padding: '7px 10px', cursor: 'pointer', fontSize: 11,
                background: i === focus ? '#f0fdf4' : 'transparent',
                borderBottom: '1px solid #f4f5f4',
              }}
            >
              <div style={{ fontWeight: 600, color: '#0a0a0a' }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 9, color: '#9ca89c' }}>{opt.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
