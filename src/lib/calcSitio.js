import { getPrecio, ZI } from './catalog'

/**
 * Calculate totals for a single site.
 * @param {object} sitio  — site record from ST.sitios
 * @param {Array}  gastos — all gastos from ST.gastos
 * @param {Array}  subcs  — all subcontratistas
 */
export function calcSitio(sitio, gastos = [], subcs = [], catalogTI = [], liquidaciones_cw = []) {
  const cat       = sitio.catEfectiva || sitio.cat || 'A'
  const isFinal   = sitio.estado === 'final'
  const crExclSet = new Set(sitio.crSubcExcluded || [])

  let nokiaTI = 0, nokiaADJ = 0, nokiaCR = 0
  let subcTI  = 0, subcADJ  = 0, subcCR  = 0

  const acts = (sitio.actividades || []).map((act, actIdx) => {
    if (sitio.tipo === 'TSS') {
      const pN = getPrecio('BASE', act.id, null, sitio.cat || 'A', act.ciudad, catalogTI)
      const lcV  = sitio.lcVisita   || sitio.lc || ''
      const lcR  = sitio.lcReporte  || sitio.lc || ''
      const lcRd = sitio.lcRedesign || sitio.lc || ''
      const catOf = c => subcs.find(x => x.lc === c)?.cat || sitio.cat || 'A'
      const cb = act.id === 'TSS_V' ? catOf(lcV) : act.id === 'TSS_R' ? catOf(lcR) : catOf(lcRd)
      const pS = getPrecio('BASE', act.id, null, act.catOver || cb, act.ciudad, catalogTI)
      const isNokia = act.cardType !== 'subc'
      const isSubc  = act.cardType !== 'nokia'
      const tN = isNokia ? pN.nokia * (act.cant || 0) : 0
      const tS = isSubc  ? pS.subc  * (act.cant || 0) : 0
      if (isNokia) nokiaTI += tN
      if (isSubc)  subcTI  += tS
      return { ...act, preNokia: pN.nokia, preSubc: pS.subc, totalNokia: tN, totalSubc: tS, subcExcluded: false }
    }

    const p = isFinal && act.snapNokia != null
      ? { nokia: act.snapNokia, subc: act.snapSubc }
      : getPrecio(act.tipo, act.id, sitio.ciudad, cat, act.ciudad || null, catalogTI)

    const tN = p.nokia * (act.cant || 0)
    const tS = p.subc  * (act.cant || 0)
    const at = act.tipo || 'BASE'
    const subcExcluded = at === 'CR' && crExclSet.has(actIdx)

    if      (at === 'CR')  { nokiaCR += tN; if (!subcExcluded) subcCR += tS }
    else if (at === 'ADJ') { nokiaADJ += tN; subcADJ += tS }
    else                   { nokiaTI  += tN; subcTI  += tS }

    return { ...act, preNokia: p.nokia, preSubc: p.subc,
             totalNokia: tN, totalSubc: subcExcluded ? 0 : tS, subcExcluded }
  })

  const liqCW      = liquidaciones_cw.find(l => l.sitio_id === sitio.id)
  const liqCWItems = liqCW?.items || []
  const nokiaCW    = liqCWItems.length > 0
    ? liqCWItems.reduce((s, i) => s + (i.cant || 0) * (i.precio_nokia || 0), 0)
    : (sitio.cw_nokia || 0)
  const subcCW     = liqCWItems.length > 0
    ? liqCWItems.reduce((s, i) => s + (i.cant || 0) * (i.precio_subc  || 0), 0)
    : (sitio.cw_costo || 0)
  const totalVenta = nokiaTI + nokiaADJ + nokiaCW + nokiaCR

  const gastosS  = gastos.filter(g => g.sitio === sitio.id)
  const logist   = gastosS.filter(g => g.tipo === 'Logistica')      .reduce((s, g) => s + (g.valor || 0), 0)
  const adicion  = gastosS.filter(g => g.tipo === 'Adicionales')    .reduce((s, g) => s + (g.valor || 0), 0)
  const matTI    = gastosS.filter(g => g.tipo === 'Materiales TI')  .reduce((s, g) => s + (g.valor || 0), 0)
  const matCW    = gastosS.filter(g => g.tipo === 'Materiales CW')  .reduce((s, g) => s + (g.valor || 0), 0)
  const backoffice = sitio.costos?.backoffice || 0

  const totalCosto = subcTI + subcADJ + subcCR + subcCW + matTI + matCW + logist + adicion + backoffice
  const utilidad   = totalVenta - totalCosto
  const margen     = totalVenta > 0 ? utilidad / totalVenta : 0

  return { acts, nokiaTI, nokiaADJ, nokiaCW, nokiaCR, totalVenta,
           subcTI, subcADJ, subcCR, subcCW, matTI, matCW,
           logist, adicion, backoffice, totalCosto, utilidad, margen, cat }
}

/** Helper: does the site have a SITIO NUEVO activity? */
export function hasSN(s) {
  return !!(s?.actividades?.some(a => a.sec === 'SITIO NUEVO' || a.sec === 'SITIO_NUEVO'))
}
