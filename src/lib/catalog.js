// ── Zonas / categorías de ciudad ─────────────────────────────────
export const ZONAS = ['Ciudad_Principal','Ciudad_Secundaria','Ciudad_Intermedia','Dificil Acceso']
export const ZI    = { Ciudad_Principal:0, Ciudad_Secundaria:1, Ciudad_Intermedia:2, 'Dificil Acceso':3 }

export const MESES      = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                           'Septiembre','Octubre','Noviembre','Diciembre']

// ── Catálogo de precios Nokia + SubC por categoría ───────────────
export const CAT = {
  BASE: [
    { id:'PM',             nombre:'PM',                           unidad:'Sitio',
      nokia:[1899091,2046799,2215607,2321112], A:[null,null,null,null], AA:[null,null,null,null], AAA:[null,null,null,null] },
    { id:'IMP_RF',         nombre:'IMP_RF',                       unidad:'Unidad',
      nokia:[1229107,1324704,1433958,1502242], A:[456091,491564,529948,562433], AA:[501700,540721,582942,618676], AAA:[584732,630211,682187,714672] },
    { id:'IMP_BB',         nombre:'IMP_BB',                       unidad:'Unidad',
      nokia:[1368107,1474515,1596125,1672131], A:[507670,547156,589880,626038], AA:[558437,601871,648868,688642], AAA:[650859,701482,759336,795495] },
    { id:'DESMONTE_RF',    nombre:'DESMONTE_RF',                  unidad:'Unidad',
      nokia:[853223,919585,995427,1042829],   A:[316610,341235,367880,390430], AA:[348271,375358,404668,429473], AAA:[405910,437481,473562,496112] },
    { id:'DESMONTE_BB',    nombre:'DESMONTE_BB',                  unidad:'Unidad',
      nokia:[1055799,1137916,1231765,1290421],A:[391780,422252,455223,483128], AA:[430958,464477,500745,531441], AAA:[502283,541349,585997,613901] },
    { id:'TSS_VR',         nombre:'TSS_VR (Visita+Reporte)',      unidad:'Sitio',
      nokia:[1134797,1223060,1323930,1386975],A:[530000,530000,730000,830000], AA:[583000,583000,803000,913000], AAA:[639865,681855,729843,899836] },
    { id:'TSS_V',          nombre:'TSS_V (Solo Visita)',           unidad:'Sitio',
      nokia:[624138,672683,728162,762836],    A:[400000,400000,600000,700000], AA:[440000,440000,660000,770000], AAA:[496926,498020,596413,762909] },
    { id:'TSS_R',          nombre:'TSS_R (Solo Reporte)',          unidad:'Sitio',
      nokia:[510659,550377,595768,624138],    A:[130000,130000,130000,130000], AA:[143000,143000,143000,143000], AAA:[242939,261834,283429,296926] },
    { id:'TSS_RD',         nombre:'TSS_RD (Rediseño)',             unidad:'Sitio',
      nokia:[0,0,0,0], A:[0,0,0,0], AA:[0,0,0,0], AAA:[0,0,0,0] },
  ],
  ADJ: [
    { id:'Pruebas_Probo',             nombre:'Pruebas_Probo',                                         unidad:'Sitio',
      nokia:[917513,988876,1070432,1121405], A:[458756,494438,535216,560702], AA:[504632,543881,588738,616773], AAA:[536495,570445,610244,643494] },
    { id:'IMP_Power',                 nombre:'IMP_Power',                                             unidad:'Sitio',
      nokia:[725546,781978,846471,886779],   A:[362773,390989,423235,443389], AA:[399050,430088,465559,487728], AAA:[435129,461016,504198,543874] },
    { id:'IMP_Rectificador',          nombre:'IMP_Rectificador',                                      unidad:'Sitio',
      nokia:[241848,260659,282157,295593],   A:[120924,130329,141078,147796], AA:[133016,143362,155186,162576], AAA:[232056,238005,295232,268624] },
    { id:'Desmonte_Feeder',           nombre:'Desmonte_Feeder',                                       unidad:'Sitio',
      nokia:[835965,835965,835965,835965],   A:[417982,417982,417982,417982], AA:[417982,417982,417982,417982], AAA:[417982,417982,417982,417982] },
    { id:'Logistica_Inversa_Antenas', nombre:'Logística Inversa Antenas',                             unidad:'Unidad',
      nokia:[473992,510858,552991,579324],   A:[70000,70000,70000,70000],     AA:[70000,70000,70000,70000],     AAA:[70000,70000,70000,70000] },
    { id:'FPMA',                      nombre:'FPMA',                                                  unidad:'Unidad',
      nokia:[224283,224283,224283,224283],   A:[112141,112141,112141,112141], AA:[112141,112141,112141,112141], AAA:[112141,112141,112141,112141] },
    { id:'REUB_RF_Airscale_AHPCx',    nombre:'REUB_RF Airscale AHPCx',                               unidad:'Unidad',
      nokia:[449056,462527,499530,549483],   A:[224528,231263,249765,274741], AA:[246980,254390,274741,302215], AAA:[324632,362041,379645,385409] },
    { id:'Log_Func_HW_Airscale',      nombre:'Logística Funcional desmontao de HW Airscale por sitio',unidad:'Sitio',
      nokia:[426611,459792,497713,521414],   A:[213305,229896,248856,260707], AA:[213305,229896,248856,260707], AAA:[213305,229896,248856,260707] },
    { id:'Log_Inv_Flexi',             nombre:'Logística Inversa de Módulos Flexi',                   unidad:'Sitio',
      nokia:[426611,459792,497713,521414],   A:[213305,229896,248856,260707], AA:[213305,229896,248856,260707], AAA:[213305,229896,248856,260707] },
    { id:'Log_Inv_Ultra',             nombre:'Logística Inversa de Módulos Ultra',                   unidad:'Sitio',
      nokia:[511934,551751,597256,625697],   A:[255967,275875,298628,312848], AA:[255967,275875,298628,312848], AAA:[255967,275875,298628,312848] },
    { id:'FO_ABIA',                   nombre:'FO + ABIA',                                            unidad:'Sitio',
      nokia:[522165,562777,597588,638201],   A:[261082,281388,298794,319100], AA:[287190,309527,328673,351010], AAA:[383413,385734,398295,451616] },
    { id:'ODH',                       nombre:'Adicional Traslado a Sitios (ODH)',                     unidad:'Sitio',
      nokia:[3678500,3678500,3678500,3678500],A:[2574950,2574950,2942800,2942800],AA:[2574950,2574950,2942800,2942800],AAA:[2574950,2574950,2942800,2942800] },
  ],
  CR: [
    { id:'Carro_Canasta', nombre:'Carro Canasta', unidad:'Diario',
      nokia:[1630968,1630968,1630968,1630968], A:[775912,775912,775912,775912], AA:[775912,775912,775912,775912], AAA:[775912,775912,775912,775912] },
    { id:'Andamios', nombre:'Andamios', unidad:'Diario',
      nokia:[364001,364001,364001,364001], A:[173169,173169,173169,173169], AA:[173169,173169,173169,173169], AAA:[173169,173169,173169,173169] },
    { id:'Trasiego_Cuadrilla_Categoria_5', nombre:'Trasiego Cuadrilla Categoria 5', unidad:'Global',
      nokia:[314564,314564,314564,314564], A:[149650,149650,149650,149650], AA:[149650,149650,149650,149650], AAA:[149650,149650,149650,149650] },
    { id:'Trasiego_Cuadrilla_Categoria_6', nombre:'Trasiego Cuadrilla Categoria 6', unidad:'Global',
      nokia:[672219,672219,672219,672219], A:[319800,319800,319800,319800], AA:[319800,319800,319800,319800], AAA:[319800,319800,319800,319800] },
    { id:'Trasiegos_HW_Principal_Secundaria', nombre:'Trasiegos HW Principal Secundaria', unidad:'Global',
      nokia:[0,0,0,0], A:[0,0,0,0], AA:[0,0,0,0], AAA:[0,0,0,0] },
    { id:'Trasiegos_HW_Intermedia_Dificil', nombre:'Trasiegos HW Intermedia Dificil', unidad:'Global',
      nokia:[0,0,2206259,4213955], A:[0,0,0,0], AA:[0,0,0,0], AAA:[0,0,0,0] },
    { id:'Trasiegos_Power', nombre:'Trasiegos Power', unidad:'Global',
      nokia:[0,0,2206259,4213955], A:[0,0,0,0], AA:[0,0,0,0], AAA:[0,0,0,0] },
    { id:'Movimiento_Cuadrillas_Regionales', nombre:'Movimiento Cuadrillas Regionales', unidad:'Global',
      nokia:[0,0,0,0], A:[0,0,0,0], AA:[0,0,0,0], AAA:[0,0,0,0] },
    { id:'Riesgo_Biologico_Poda', nombre:'Riesgo Biologico Poda', unidad:'Global',
      nokia:[474001,474001,474001,474001], A:[225500,225500,225500,225500], AA:[225500,225500,225500,225500], AAA:[225500,225500,225500,225500] },
    { id:'Riesgo_Biologico_Fumigacion', nombre:'Riesgo Biologico Fumigacion', unidad:'Global',
      nokia:[736856,736856,736856,736856], A:[280440,280440,280440,280440], AA:[280440,280440,280440,280440], AAA:[280440,280440,280440,280440] },
    { id:'Recoleccion_HW_Bodega_Antenas', nombre:'Recoleccion HW Bodega Antenas', unidad:'Global',
      nokia:[458761,458761,458761,458761], A:[152775,152775,152775,152775], AA:[152775,152775,152775,152775], AAA:[152775,152775,152775,152775] },
    { id:'Recoleccion_HW_Bodega_Modulos', nombre:'Recoleccion HW Bodega Modulos', unidad:'Global',
      nokia:[326230,326230,326230,326230], A:[108640,108640,108640,108640], AA:[108640,108640,108640,108640], AAA:[108640,108640,108640,108640] },
    { id:'Logistica_Inversa_HW_Falla_Antenas', nombre:'Logistica Inversa HW Falla Antenas', unidad:'Global',
      nokia:[458761,504637,550513,715667], A:[40000,40000,40000,40000], AA:[40000,40000,40000,40000], AAA:[40000,40000,40000,40000] },
    { id:'Logistica_Inversa_HW_Falla_Modulos', nombre:'Logistica Inversa HW Falla Modulos', unidad:'Global',
      nokia:[458761,504637,550513,715667], A:[40000,40000,40000,40000], AA:[40000,40000,40000,40000], AAA:[40000,40000,40000,40000] },
    { id:'Revisitas', nombre:'Revisitas', unidad:'Global',
      nokia:[1237556,1237556,1732578,2119341], A:[380000,380000,855000,855000], AA:[418000,418000,940500,940500], AAA:[688751,688751,924252,1108250] },
    { id:'Stand_BY', nombre:'Stand BY', unidad:'Global',
      nokia:[0,0,0,728237], A:[0,0,0,485030], AA:[0,0,0,533533], AAA:[0,0,0,596450] },
    { id:'SISO_dia_no_base', nombre:'SISO dia no base', unidad:'Global',
      nokia:[613299,613299,613299,613299], A:[291769,291769,291769,291769], AA:[291769,291769,291769,291769], AAA:[291769,291769,291769,291769] },
    { id:'SISO_semana_no_base', nombre:'SISO semana no base', unidad:'Global',
      nokia:[3430133,3430133,3430133,3430133], A:[1631843,1631843,1631843,1631843], AA:[1631843,1631843,1631843,1631843], AAA:[1631843,1631843,1631843,1631843] },
    { id:'SISO_dia_base', nombre:'SISO dia base', unidad:'Global',
      nokia:[439621,439621,439621,439621], A:[209144,209144,209144,209144], AA:[209144,209144,209144,209144], AAA:[209144,209144,209144,209144] },
    { id:'SISO_semana_base', nombre:'SISO semana base', unidad:'Global',
      nokia:[2417919,2417919,2417919,2417919], A:[1150294,1150294,1150294,1150294], AA:[1150294,1150294,1150294,1150294], AAA:[1150294,1150294,1150294,1150294] },
    { id:'Trasiego_HW_Falla_Modulos', nombre:'Trasiego HW Falla Modulos', unidad:'Global',
      nokia:[290625,290625,290625,290625], A:[145312,145312,145312,145312], AA:[145312,145312,145312,145312], AAA:[145312,145312,145312,145312] },
    { id:'Transporte_Escalera', nombre:'Transporte Escalera', unidad:'Global',
      nokia:[252240,252240,252240,302688], A:[126120,126120,126120,151344], AA:[126120,126120,126120,151344], AAA:[126120,126120,126120,151344] },
    { id:'HW_Baja_6kg', nombre:'HW Baja 6kg', unidad:'Global',
      nokia:[109485,109485,109485,109485], A:[54742,54742,54742,54742], AA:[54742,54742,54742,54742], AAA:[54742,54742,54742,54742] },
    { id:'HW_Baja_15kg', nombre:'HW Baja 15kg', unidad:'Global',
      nokia:[266873,266873,266873,266873], A:[133436,133436,133436,133436], AA:[133436,133436,133436,133436], AAA:[133436,133436,133436,133436] },
    { id:'HW_Baja_20kg', nombre:'HW Baja 20kg', unidad:'Global',
      nokia:[337582,337582,337582,337582], A:[168791,168791,168791,168791], AA:[168791,168791,168791,168791], AAA:[168791,168791,168791,168791] },
    { id:'HW_Baja_25kg', nombre:'HW Baja 25kg', unidad:'Global',
      nokia:[417416,417416,417416,417416], A:[208708,208708,208708,208708], AA:[208708,208708,208708,208708], AAA:[208708,208708,208708,208708] },
    { id:'HW_Baja_50kg', nombre:'HW Baja 50kg', unidad:'Global',
      nokia:[626124,626124,626124,626124], A:[313062,313062,313062,313062], AA:[313062,313062,313062,313062], AAA:[313062,313062,313062,313062] },
    { id:'Trasiegos_paquetes_25kg', nombre:'Trasiegos paquetes 25kg', unidad:'Global',
      nokia:[290625,290625,290625,290625], A:[145312,145312,145312,145312], AA:[145312,145312,145312,145312], AAA:[145312,145312,145312,145312] },
    { id:'Trasiegos_paquetes_mas_25kg', nombre:'Trasiegos paquetes mas 25kg', unidad:'Global',
      nokia:[581251,581251,581251,581251], A:[290625,290625,290625,290625], AA:[290625,290625,290625,290625], AAA:[290625,290625,290625,290625] },
    { id:'Transporte_Terrazas', nombre:'Transporte Terrazas', unidad:'Global',
      nokia:[315300,315300,315300,315300], A:[157650,157650,157650,157650], AA:[157650,157650,157650,157650], AAA:[157650,157650,157650,157650] },
    { id:'Trasiego_Log_Inv_Semovientes', nombre:'Trasiego Log Inv Semovientes', unidad:'Global',
      nokia:[1681,1681,1681,1681], A:[840,840,840,840], AA:[840,840,840,840], AAA:[840,840,840,840] },
    { id:'Trasiego_Log_Inv_Fluviales', nombre:'Trasiego Log Inv Fluviales', unidad:'Global',
      nokia:[2627,2627,2627,2627], A:[1313,1313,1313,1313], AA:[1313,1313,1313,1313], AAA:[1313,1313,1313,1313] },
    { id:'Tapas_ASIx', nombre:'Tapas ASIx', unidad:'Global',
      nokia:[52550,52550,52550,52550], A:[26275,26275,26275,26275], AA:[26275,26275,26275,26275], AAA:[26275,26275,26275,26275] },
    { id:'Bodegaje_HW', nombre:'Bodegaje HW', unidad:'Global',
      nokia:[0,0,0,0], A:[0,0,0,0], AA:[0,0,0,0], AAA:[0,0,0,0] },
    { id:'REUB_RF_AHFIHA', nombre:'REUB RF AHFIHA', unidad:'Global',
      nokia:[449056,462527,499530,549483], A:[213632,220041,237645,261409], AA:[213632,220041,237645,261409], AAA:[324632,362041,379645,385409] },
  ],
}

// ── Price lookup ──────────────────────────────────────────────────
export function getPrecio(tipo, id, zona, cat, ciudadTSS, dynCatalog = []) {
  const z = ZI[ciudadTSS || zona] ?? 0
  const tipoN = (tipo === 'BASE' || tipo === 'TI') ? 'BASE' : tipo === 'ADJ' ? 'ADJ' : 'CR'
  const primary = tipoN === 'BASE' ? CAT.BASE : tipoN === 'ADJ' ? CAT.ADJ : CAT.CR
  // Find hardcoded entry first
  let def = primary.find(a => a.id === id)
  if (!def) def = CAT.BASE.find(a => a.id === id) || CAT.ADJ.find(a => a.id === id) || CAT.CR.find(a => a.id === id)
  // Dynamic catalog (Supabase) overrides only non-zero values — 0 falls back to hardcoded
  const dynDef = dynCatalog.find(a => a.id === id)
  if (!def && !dynDef) return { nokia: 0, subc: 0, def: null }
  const cats = ['A','AA','AAA']
  const cv = cats.includes(cat) ? cat : 'A'
  const nokia = dynDef?.nokia?.[z] || def?.nokia?.[z] || 0
  const subc  = dynDef?.[cv]?.[z]  || def?.[cv]?.[z]  || 0
  return { nokia, subc, def: dynDef || def }
}

// ── Formatters ────────────────────────────────────────────────────
export const cop = v => v == null || v === '' ? '—' : '$' + Math.round(v).toLocaleString('es-CO')
export const pct = v => v == null ? '—' : (v * 100).toFixed(1) + '%'
export const mcls  = v => v >= .3 ? 'bg-g' : v >= .2 ? 'bg-o' : 'bg-r'
export const mfcls = v => v >= .3 ? '' : v >= .2 ? 'warn' : 'dang'
