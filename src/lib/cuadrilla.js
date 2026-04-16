/**
 * Cuadrilla filter helpers — mirrors legacy buildTCOptions / matchTipoCuadrilla
 */

/**
 * Build the canonical cuadrilla types for a given empresa short name.
 * Scytel is always included (it's the app developer).
 * Any type containing "externa" is excluded.
 *
 * Example: buildTiposCuadrilla('OFG')
 *   → ['TI OFG', 'TI Scytel', 'TSS OFG', 'TSS Scytel']
 */
export function buildTiposCuadrilla(nombreCorto = 'Ingetel', extras = []) {
  const empresa = (nombreCorto || 'Ingetel').trim()
  const base = [
    `TI ${empresa}`,
    `TSS ${empresa}`,
    'TI Scytel',
    'TSS Scytel',
  ]
  return [...new Set([...base, ...extras])].filter(t => !t.toLowerCase().includes('externa'))
}

/** Strip "externa" types from any arbitrary list */
export function sinExternas(tipos = []) {
  return tipos.filter(t => !t.toLowerCase().includes('externa'))
}

/**
 * Build the <option> list for cuadrilla selectors.
 * Given ['TI Ingetel','TSS Ingetel','TI Scytel','TSS Scytel'] produces:
 *   Todas las Cuadrillas
 *   TI Ingetel | TSS Ingetel | TI Scytel | TSS Scytel   (individual)
 *   Ingetel (TI+TSS) | Scytel (TI+TSS)                  (suffixes, si >1)
 *   TI (todas) | TSS (todas)                             (prefixes, si >1)
 */
export function buildTCOptions(tipos = []) {
  const prefixes = [...new Set(tipos.map(t => t.split(' ')[0]).filter(Boolean))]
  const suffixes = [...new Set(
    tipos.map(t => t.includes(' ') ? t.split(' ').slice(1).join(' ') : '').filter(Boolean)
  )]

  const opts = [{ value: 'todos', label: 'Todas las Cuadrillas' }]
  tipos.forEach(tc => opts.push({ value: tc, label: tc }))
  if (suffixes.length > 1) suffixes.forEach(s => opts.push({ value: s, label: `${s} (TI+TSS)` }))
  if (prefixes.length > 1) prefixes.forEach(p => opts.push({ value: p, label: `${p} (todas)` }))
  return opts
}

/**
 * Returns true if the site's LC cuadrilla type matches the filter value.
 * Supports: 'todos', exact match, prefix match ('TI'), suffix match ('Ingetel').
 */
export function matchTipoCuadrilla(sitio, subcs, filTC) {
  if (!filTC || filTC === 'todos') return true
  const sub = subcs.find(x => x.lc === sitio.lc)
  const tc  = sub?.tipoCuadrilla || ''
  if (tc === filTC) return true
  const tcPrefix = tc.split(' ')[0]
  const tcSuffix = tc.includes(' ') ? tc.split(' ').slice(1).join(' ') : ''
  if (tcSuffix && tcSuffix === filTC) return true
  if (tcPrefix && tcPrefix === filTC) return true
  return false
}
