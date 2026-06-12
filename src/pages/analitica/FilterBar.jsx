import { useState, useMemo, useEffect } from 'react'
import { buildTCOptions } from '../../lib/cuadrilla'
import { CN } from './helpers'

const REGIONES = ['R1 – Costa','R2 – Noroccidente','R3 – Suroccidente','R4 – Centro','R5 – Oriente']

export default function FilterBar({ filters, setFilter, sitios, subcs }) {
  const [open, setOpen] = useState(false)

  const cuadrillaOpts = useMemo(() => {
    const tipos = [...new Set(subcs.map(s => s.tipoCuadrilla).filter(Boolean))].sort()
    return buildTCOptions(tipos).filter(o => o.value !== 'todos')
  }, [subcs])

  const lcs = useMemo(() => {
    const allLcs = [...new Set(sitios.map(s => s.lc).filter(Boolean))].sort()
    if (!filters.cuadrilla) return allLcs
    const lcsDeCuadrilla = new Set(
      subcs.filter(s => {
        const tc = s.tipoCuadrilla || ''
        if (tc === filters.cuadrilla) return true
        const parts = tc.split(' ')
        const prefix = parts[0]
        const suffix = parts.slice(1).join(' ')
        return (suffix && suffix === filters.cuadrilla) || (prefix && prefix === filters.cuadrilla)
      }).map(s => s.lc).filter(Boolean)
    )
    return allLcs.filter(lc => lcsDeCuadrilla.has(lc))
  }, [sitios, subcs, filters.cuadrilla])

  useEffect(() => {
    if (filters.lc && !lcs.includes(filters.lc)) setFilter('lc', '')
  }, [filters.cuadrilla]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== '' && v !== 'TODOS').length

  const pill = (field, val, label) => (
    <button
      key={val}
      onClick={() => setFilter(field, val)}
      style={{
        padding: '3px 10px', borderRadius: 16, fontSize: 10, fontWeight: 700,
        cursor: 'pointer', border: '1.5px solid', whiteSpace: 'nowrap',
        background:  filters[field] === val ? CN : '#fff',
        color:       filters[field] === val ? '#fff' : CN,
        borderColor: filters[field] === val ? CN : '#cdd4cc',
      }}
    >{label || val}</button>
  )

  const lbl = (text) => (
    <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca89c', letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )

  const sep = <div style={{ width: 1, background: '#e0e4e0', alignSelf: 'stretch', margin: '0 4px' }} />

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{
        padding: '8px 14px', display: 'flex', alignItems: 'center',
        gap: 10, flexWrap: 'wrap', cursor: 'pointer',
      }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 11, fontWeight: 700, color: CN }}>▼ Filtros</span>
        {activeFilters > 0 && (
          <span className="badge" style={{ background: '#fde68a', color: '#92400e', fontSize: 9 }}>
            {activeFilters} activo{activeFilters > 1 ? 's' : ''}
          </span>
        )}
        {filters.tipo    !== 'TODOS' && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Tipo: {filters.tipo}</span>}
        {filters.region  !== 'TODOS' && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Región: {filters.region}</span>}
        {filters.lc      !== ''      && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>LC: {filters.lc}</span>}
        {filters.cuadrilla !== ''    && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Cuadrilla: {filters.cuadrilla}</span>}
        {filters.fechaDesde !== ''   && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Desde: {filters.fechaDesde}</span>}
        {filters.fechaHasta !== ''   && <span className="badge" style={{ background: '#e0f0fe', color: CN, fontSize: 9 }}>Hasta: {filters.fechaHasta}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeFilters > 0 && (
            <button className="btn bou btn-sm" style={{ fontSize: 9, padding: '2px 8px' }}
              onClick={e => { e.stopPropagation(); setFilter('__reset__', null) }}>
              ↺ Limpiar
            </button>
          )}
          <span style={{ fontSize: 12, color: '#9ca89c' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{
          borderTop: '1px solid #e0e4e0',
          padding: '12px 14px',
          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('TIPO')}
            <div style={{ display: 'flex', gap: 4 }}>
              {['TODOS','TI','TSS','CW'].map(v => pill('tipo', v))}
            </div>
          </div>
          {sep}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('REGIÓN')}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {pill('region', 'TODOS', 'Todas')}
              {REGIONES.map(v => pill('region', v, v.split('–')[0].trim()))}
            </div>
          </div>
          {sep}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('LC / SUBCONTRATISTA')}
            <select className="fc" style={{ fontSize: 10, padding: '3px 6px', minWidth: 140 }}
              value={filters.lc} onChange={e => setFilter('lc', e.target.value)}>
              <option value="">— Todos —</option>
              {lcs.map(lc => <option key={lc} value={lc}>{lc}</option>)}
            </select>
          </div>
          {sep}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lbl('CUADRILLA')}
            <select className="fc" style={{ fontSize: 10, padding: '3px 6px', minWidth: 150 }}
              value={filters.cuadrilla} onChange={e => setFilter('cuadrilla', e.target.value)}>
              <option value="">— Todas —</option>
              {cuadrillaOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {sep}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lbl('FECHA (Desde)')}
              <input type="date" className="fc" style={{ fontSize: 10, padding: '3px 6px', width: 130 }}
                value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lbl('FECHA (Hasta)')}
              <input type="date" className="fc" style={{ fontSize: 10, padding: '3px 6px', width: 130 }}
                value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
