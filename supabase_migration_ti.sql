-- ============================================================
--  Migración: agregar tabla catalogo_ti (Catálogo TI 2026)
--  Ejecuta en Supabase → SQL Editor si ya corriste el setup original
-- ============================================================

-- ── 1. Tabla catalogo_ti ─────────────────────────────────────
create table if not exists public.catalogo_ti (
  id       text primary key,
  nombre   text    not null default '',
  unidad   text    not null default 'UN',
  seccion  text    not null default 'BASE',  -- BASE | TSS | ADJ | CR
  nokia_0  numeric,
  nokia_1  numeric,
  nokia_2  numeric,
  nokia_3  numeric,
  a_0      numeric,
  a_1      numeric,
  a_2      numeric,
  a_3      numeric,
  aa_0     numeric,
  aa_1     numeric,
  aa_2     numeric,
  aa_3     numeric,
  aaa_0    numeric,
  aaa_1    numeric,
  aaa_2    numeric,
  aaa_3    numeric
);

-- ── 2. RLS ───────────────────────────────────────────────────
alter table public.catalogo_ti enable row level security;

drop policy if exists "cat_ti_select" on public.catalogo_ti;
create policy "cat_ti_select" on public.catalogo_ti
  for select to authenticated using (true);

drop policy if exists "cat_ti_write" on public.catalogo_ti;
create policy "cat_ti_write" on public.catalogo_ti
  for all to authenticated
  using  (public.get_my_role() in ('admin','coord'))
  with check (public.get_my_role() in ('admin','coord'));

-- ── 3. Seed (56 ítems TI 2026) ──────────────────────────────
insert into public.catalogo_ti
  (id, nombre, unidad, seccion,
   nokia_0,nokia_1,nokia_2,nokia_3,
   a_0,a_1,a_2,a_3,
   aa_0,aa_1,aa_2,aa_3,
   aaa_0,aaa_1,aaa_2,aaa_3)
values
  -- ── BASE ────────────────────────────────────────────────────
  ('PM','PM','Sitio','BASE',
   1899091,2046799,2215607,2321112,
   NULL,NULL,NULL,NULL,
   NULL,NULL,NULL,NULL,
   NULL,NULL,NULL,NULL),

  ('IMP_RF','IMP_RF','Unidad','BASE',
   1229107,1324704,1433958,1502242,
   456091,491564,529948,562433,
   501700,540721,582942,618676,
   584732,630211,682187,714672),

  ('IMP_BB','IMP_BB','Unidad','BASE',
   1368107,1474515,1596125,1672131,
   507670,547156,589880,626038,
   558437,601871,648868,688642,
   650859,701482,759336,795495),

  ('DESMONTE_RF','DESMONTE_RF','Unidad','BASE',
   853223,919585,995427,1042829,
   316610,341235,367880,390430,
   348271,375358,404668,429473,
   405910,437481,473562,496112),

  ('DESMONTE_BB','DESMONTE_BB','Unidad','BASE',
   1055799,1137916,1231765,1290421,
   391780,422252,455223,483128,
   430958,464477,500745,531441,
   502283,541349,585997,613901),

  -- ── TSS ─────────────────────────────────────────────────────
  ('TSS_VR','TSS_VR (Visita+Reporte)','Sitio','TSS',
   1134797,1223060,1323930,1386975,
   530000,530000,730000,830000,
   583000,583000,803000,913000,
   639865,681855,729843,899836),

  ('TSS_V','TSS_V (Solo Visita)','Sitio','TSS',
   624138,672683,728162,762836,
   400000,400000,600000,700000,
   440000,440000,660000,770000,
   496926,498020,596413,762909),

  ('TSS_R','TSS_R (Solo Reporte)','Sitio','TSS',
   510659,550377,595768,624138,
   130000,130000,130000,130000,
   143000,143000,143000,143000,
   242939,261834,283429,296926),

  ('TSS_RD','TSS_RD (Rediseño)','Sitio','TSS',
   0,0,0,0,
   0,0,0,0,
   0,0,0,0,
   0,0,0,0),

  -- ── ADJ ─────────────────────────────────────────────────────
  ('Pruebas_Probo','Pruebas_Probo','Sitio','ADJ',
   917513,988876,1070432,1121405,
   458756,494438,535216,560702,
   504632,543881,588738,616773,
   536495,570445,610244,643494),

  ('IMP_Power','IMP_Power','Sitio','ADJ',
   725546,781978,846471,886779,
   362773,390989,423235,443389,
   399050,430088,465559,487728,
   435129,461016,504198,543874),

  ('IMP_Rectificador','IMP_Rectificador','Sitio','ADJ',
   241848,260659,282157,295593,
   120924,130329,141078,147796,
   133016,143362,155186,162576,
   232056,238005,295232,268624),

  ('Desmonte_Feeder','Desmonte_Feeder','Sitio','ADJ',
   835965,835965,835965,835965,
   417982,417982,417982,417982,
   417982,417982,417982,417982,
   417982,417982,417982,417982),

  ('Logistica_Inversa_Antenas','Logística Inversa Antenas','Unidad','ADJ',
   473992,510858,552991,579324,
   70000,70000,70000,70000,
   70000,70000,70000,70000,
   70000,70000,70000,70000),

  ('FPMA','FPMA','Unidad','ADJ',
   224283,224283,224283,224283,
   112141,112141,112141,112141,
   112141,112141,112141,112141,
   112141,112141,112141,112141),

  ('REUB_RF_Airscale_AHPCx','REUB_RF Airscale AHPCx','Unidad','ADJ',
   449056,462527,499530,549483,
   224528,231263,249765,274741,
   246980,254390,274741,302215,
   324632,362041,379645,385409),

  ('Log_Func_HW_Airscale','Logística Funcional desmontao de HW Airscale por sitio','Sitio','ADJ',
   426611,459792,497713,521414,
   213305,229896,248856,260707,
   213305,229896,248856,260707,
   213305,229896,248856,260707),

  ('Log_Inv_Flexi','Logística Inversa de Módulos Flexi','Sitio','ADJ',
   426611,459792,497713,521414,
   213305,229896,248856,260707,
   213305,229896,248856,260707,
   213305,229896,248856,260707),

  ('Log_Inv_Ultra','Logística Inversa de Módulos Ultra','Sitio','ADJ',
   511934,551751,597256,625697,
   255967,275875,298628,312848,
   255967,275875,298628,312848,
   255967,275875,298628,312848),

  ('FO_ABIA','FO + ABIA','Sitio','ADJ',
   522165,562777,597588,638201,
   261082,281388,298794,319100,
   287190,309527,328673,351010,
   383413,385734,398295,451616),

  ('ODH','Adicional Traslado a Sitios (ODH)','Sitio','ADJ',
   3678500,3678500,3678500,3678500,
   2574950,2574950,2942800,2942800,
   2574950,2574950,2942800,2942800,
   2574950,2574950,2942800,2942800),

  -- ── CR ──────────────────────────────────────────────────────
  ('Carro_Canasta','Carro Canasta','Diario','CR',
   1630968,1630968,1630968,1630968,
   775912,775912,775912,775912,
   775912,775912,775912,775912,
   775912,775912,775912,775912),

  ('Andamios','Andamios','Diario','CR',
   364001,364001,364001,364001,
   173169,173169,173169,173169,
   173169,173169,173169,173169,
   173169,173169,173169,173169),

  ('Trasiego_Cuadrilla_Categoria_5','Trasiego Cuadrilla Categoria 5','Global','CR',
   314564,314564,314564,314564,
   149650,149650,149650,149650,
   149650,149650,149650,149650,
   149650,149650,149650,149650),

  ('Trasiego_Cuadrilla_Categoria_6','Trasiego Cuadrilla Categoria 6','Global','CR',
   672219,672219,672219,672219,
   319800,319800,319800,319800,
   319800,319800,319800,319800,
   319800,319800,319800,319800),

  ('Trasiegos_HW_Principal_Secundaria','Trasiegos HW Principal Secundaria','Global','CR',
   0,0,0,0,
   0,0,0,0,
   0,0,0,0,
   0,0,0,0),

  ('Trasiegos_HW_Intermedia_Dificil','Trasiegos HW Intermedia Dificil','Global','CR',
   0,0,2206259,4213955,
   0,0,0,0,
   0,0,0,0,
   0,0,0,0),

  ('Trasiegos_Power','Trasiegos Power','Global','CR',
   0,0,2206259,4213955,
   0,0,0,0,
   0,0,0,0,
   0,0,0,0),

  ('Movimiento_Cuadrillas_Regionales','Movimiento Cuadrillas Regionales','Global','CR',
   0,0,0,0,
   0,0,0,0,
   0,0,0,0,
   0,0,0,0),

  ('Riesgo_Biologico_Poda','Riesgo Biologico Poda','Global','CR',
   474001,474001,474001,474001,
   225500,225500,225500,225500,
   225500,225500,225500,225500,
   225500,225500,225500,225500),

  ('Riesgo_Biologico_Fumigacion','Riesgo Biologico Fumigacion','Global','CR',
   736856,736856,736856,736856,
   280440,280440,280440,280440,
   280440,280440,280440,280440,
   280440,280440,280440,280440),

  ('Recoleccion_HW_Bodega_Antenas','Recoleccion HW Bodega Antenas','Global','CR',
   458761,458761,458761,458761,
   152775,152775,152775,152775,
   152775,152775,152775,152775,
   152775,152775,152775,152775),

  ('Recoleccion_HW_Bodega_Modulos','Recoleccion HW Bodega Modulos','Global','CR',
   326230,326230,326230,326230,
   108640,108640,108640,108640,
   108640,108640,108640,108640,
   108640,108640,108640,108640),

  ('Logistica_Inversa_HW_Falla_Antenas','Logistica Inversa HW Falla Antenas','Global','CR',
   458761,504637,550513,715667,
   40000,40000,40000,40000,
   40000,40000,40000,40000,
   40000,40000,40000,40000),

  ('Logistica_Inversa_HW_Falla_Modulos','Logistica Inversa HW Falla Modulos','Global','CR',
   458761,504637,550513,715667,
   40000,40000,40000,40000,
   40000,40000,40000,40000,
   40000,40000,40000,40000),

  ('Revisitas','Revisitas','Global','CR',
   1237556,1237556,1732578,2119341,
   380000,380000,855000,855000,
   418000,418000,940500,940500,
   688751,688751,924252,1108250),

  ('Stand_BY','Stand BY','Global','CR',
   0,0,0,728237,
   0,0,0,485030,
   0,0,0,533533,
   0,0,0,596450),

  ('SISO_dia_no_base','SISO dia no base','Global','CR',
   613299,613299,613299,613299,
   291769,291769,291769,291769,
   291769,291769,291769,291769,
   291769,291769,291769,291769),

  ('SISO_semana_no_base','SISO semana no base','Global','CR',
   3430133,3430133,3430133,3430133,
   1631843,1631843,1631843,1631843,
   1631843,1631843,1631843,1631843,
   1631843,1631843,1631843,1631843),

  ('SISO_dia_base','SISO dia base','Global','CR',
   439621,439621,439621,439621,
   209144,209144,209144,209144,
   209144,209144,209144,209144,
   209144,209144,209144,209144),

  ('SISO_semana_base','SISO semana base','Global','CR',
   2417919,2417919,2417919,2417919,
   1150294,1150294,1150294,1150294,
   1150294,1150294,1150294,1150294,
   1150294,1150294,1150294,1150294),

  ('Trasiego_HW_Falla_Modulos','Trasiego HW Falla Modulos','Global','CR',
   290625,290625,290625,290625,
   145312,145312,145312,145312,
   145312,145312,145312,145312,
   145312,145312,145312,145312),

  ('Transporte_Escalera','Transporte Escalera','Global','CR',
   252240,252240,252240,302688,
   126120,126120,126120,151344,
   126120,126120,126120,151344,
   126120,126120,126120,151344),

  ('HW_Baja_6kg','HW Baja 6kg','Global','CR',
   109485,109485,109485,109485,
   54742,54742,54742,54742,
   54742,54742,54742,54742,
   54742,54742,54742,54742),

  ('HW_Baja_15kg','HW Baja 15kg','Global','CR',
   266873,266873,266873,266873,
   133436,133436,133436,133436,
   133436,133436,133436,133436,
   133436,133436,133436,133436),

  ('HW_Baja_20kg','HW Baja 20kg','Global','CR',
   337582,337582,337582,337582,
   168791,168791,168791,168791,
   168791,168791,168791,168791,
   168791,168791,168791,168791),

  ('HW_Baja_25kg','HW Baja 25kg','Global','CR',
   417416,417416,417416,417416,
   208708,208708,208708,208708,
   208708,208708,208708,208708,
   208708,208708,208708,208708),

  ('HW_Baja_50kg','HW Baja 50kg','Global','CR',
   626124,626124,626124,626124,
   313062,313062,313062,313062,
   313062,313062,313062,313062,
   313062,313062,313062,313062),

  ('Trasiegos_paquetes_25kg','Trasiegos paquetes 25kg','Global','CR',
   290625,290625,290625,290625,
   145312,145312,145312,145312,
   145312,145312,145312,145312,
   145312,145312,145312,145312),

  ('Trasiegos_paquetes_mas_25kg','Trasiegos paquetes mas 25kg','Global','CR',
   581251,581251,581251,581251,
   290625,290625,290625,290625,
   290625,290625,290625,290625,
   290625,290625,290625,290625),

  ('Transporte_Terrazas','Transporte Terrazas','Global','CR',
   315300,315300,315300,315300,
   157650,157650,157650,157650,
   157650,157650,157650,157650,
   157650,157650,157650,157650),

  ('Trasiego_Log_Inv_Semovientes','Trasiego Log Inv Semovientes','Global','CR',
   1681,1681,1681,1681,
   840,840,840,840,
   840,840,840,840,
   840,840,840,840),

  ('Trasiego_Log_Inv_Fluviales','Trasiego Log Inv Fluviales','Global','CR',
   2627,2627,2627,2627,
   1313,1313,1313,1313,
   1313,1313,1313,1313,
   1313,1313,1313,1313),

  ('Tapas_ASIx','Tapas ASIx','Global','CR',
   52550,52550,52550,52550,
   26275,26275,26275,26275,
   26275,26275,26275,26275,
   26275,26275,26275,26275),

  ('Bodegaje_HW','Bodegaje HW','Global','CR',
   0,0,0,0,
   0,0,0,0,
   0,0,0,0,
   0,0,0,0),

  ('REUB_RF_AHFIHA','REUB RF AHFIHA','Global','CR',
   449056,462527,499530,549483,
   213632,220041,237645,261409,
   213632,220041,237645,261409,
   324632,362041,379645,385409)

on conflict (id) do nothing;

-- ============================================================
--  LISTO. 56 ítems TI cargados en catalogo_ti.
-- ============================================================
