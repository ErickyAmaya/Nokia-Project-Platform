import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useAckStore }  from '../store/useAckStore'
import { useFactStore } from '../store/useFactStore'

export default function SiteSearchModal({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  const sabana = useAckStore(s => s.sabana)
  const pos    = useFactStore(s => s.pos)

  useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 80) }
  }, [open])

  // Build unified site index — one entry per site_name
  const siteIndex = useMemo(() => {
    const map = {}
    for (const row of sabana) {
      const key = row.site_name
      if (!key) continue
      if (!map[key]) {
        map[key] = {
          smp: row.main_smp || row.smp,
          siteName: key,
          region: row.region || '—',
          smps: 0,
        }
      }
      // Prefer main_smp as the primary identifier
      if (row.main_smp) map[key].smp = row.main_smp
      map[key].smps++
    }
    for (const po of pos) {
      const key = po.site_name
      if (!key) continue
      if (!map[key]) map[key] = { smp: po.smp_id || key, siteName: key, region: '—', smps: 0 }
      map[key].hasPo  = true
      map[key].spo    = po.spo_number
      map[key].siteId = po.site_id
      if (po.smp_id && !map[key].smp) map[key].smp = po.smp_id
    }
    return Object.values(map)
  }, [sabana, pos])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return siteIndex.slice(0, 8)
    return siteIndex.filter(s =>
      s.siteName?.toLowerCase().includes(q) ||
      s.smp?.toLowerCase().includes(q) ||
      s.siteId?.toLowerCase().includes(q) ||
      s.spo?.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [query, siteIndex])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        zIndex: 700, backdropFilter: 'blur(3px)',
      }}/>
      <div style={{
        position: 'fixed', top: '12vh', left: '50%', transform: 'translateX(-50%)',
        width: 560, maxWidth: '95vw', zIndex: 701,
      }}>
        {/* Search input */}
        <div style={{
          background: '#1e293b', borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          border: '1px solid rgba(255,255,255,.1)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.3" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && results[0]) { onSelect(results[0].smp); onClose(); } }}
            placeholder="Nombre del sitio, SMP-WO, Site Code…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#f1f5f9', fontSize: 15, fontFamily: "'Barlow', sans-serif",
            }}
          />
          <kbd style={{
            fontSize: 10, color: 'rgba(255,255,255,.25)', background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.08)', borderRadius: 4, padding: '2px 6px',
            fontFamily: 'monospace',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{
            background: '#1e293b', borderRadius: 12, marginTop: 6,
            border: '1px solid rgba(255,255,255,.08)',
            boxShadow: '0 12px 40px rgba(0,0,0,.4)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 16px 6px', fontSize: 9, fontWeight: 800,
              letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,.25)',
              borderBottom: '1px solid rgba(255,255,255,.05)',
            }}>
              {query ? `${results.length} resultado${results.length !== 1 ? 's' : ''}` : 'Sitios recientes'}
            </div>
            {results.map(site => (
              <div
                key={site.smp}
                onClick={() => { onSelect(site.smp); onClose() }}
                style={{
                  padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.04)',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: 'rgba(26,122,74,.25)', border: '1px solid rgba(74,222,128,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="3" x2="12" y2="20"/>
                    <line x1="8" y1="8" x2="16" y2="8"/>
                    <line x1="6" y1="13" x2="18" y2="13"/>
                    <line x1="8" y1="8" x2="12" y2="20"/>
                    <line x1="16" y1="8" x2="12" y2="20"/>
                  </svg>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>
                    {site.siteName}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                    {site.smp}{site.siteId ? ` · ${site.siteId}` : ''}{site.region !== '—' ? ` · ${site.region}` : ''}
                  </div>
                </div>
                {/* Badges */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {site.hasPo && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(37,99,235,.25)', color: '#93c5fd' }}>
                      PO
                    </span>
                  )}
                  {site.smps > 1 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)' }}>
                      {site.smps} SMPs
                    </span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            ))}
            <div style={{ padding: '8px 16px', fontSize: 9, color: 'rgba(255,255,255,.2)', fontWeight: 600 }}>
              ↵ Enter para abrir el primero · ↑↓ navegar
            </div>
          </div>
        )}
        {query && results.length === 0 && (
          <div style={{
            background: '#1e293b', borderRadius: 12, marginTop: 6, padding: '20px 16px',
            textAlign: 'center', color: 'rgba(255,255,255,.35)', fontSize: 13,
            border: '1px solid rgba(255,255,255,.08)',
          }}>
            Sin resultados para «{query}»
          </div>
        )}
      </div>
    </>
  )
}
