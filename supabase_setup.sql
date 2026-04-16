-- ============================================================
--  Nokia Billing Tracker 2026 — Supabase Setup Script
--  Pega esto en Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── 1. EXTENSIONES ──────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ── 2. TABLAS ────────────────────────────────────────────────

-- subcontratistas (sin FK hacia sitios para poder insertar en cualquier orden)
create table if not exists public.subcontratistas (
  lc              text        primary key,
  empresa         text        not null default '',
  cat             text        not null default 'A'   check (cat in ('A','AA','AAA')),
  tel             text        not null default '',
  email           text        not null default '',
  tipo_cuadrilla  text        not null default 'TI Ingetel',
  created_at      timestamptz not null default now()
);

-- sitios
create table if not exists public.sitios (
  id                  text        primary key,
  nombre              text        not null,
  tipo                text        not null default 'TI' check (tipo in ('TI','TSS')),
  fecha               date,
  ciudad              text        not null default 'Ciudad_Principal',
  lc                  text        references public.subcontratistas(lc) on update cascade on delete set null,
  cat                 text        not null default 'A'   check (cat in ('A','AA','AAA')),
  cat_efectiva        text                               check (cat_efectiva in ('A','AA','AAA')),
  tiene_cw            boolean     not null default false,
  cw_nokia            numeric     not null default 0,
  cw_costo            numeric     not null default 0,
  cw_conjunto         boolean     not null default false,
  estado              text        not null default 'pre' check (estado in ('pre','final')),
  costos              jsonb       not null default '{}',
  actividades         jsonb       not null default '[]',
  cr_subc_excluded    jsonb       not null default '[]',
  lc_visita           text        not null default '',
  lc_reporte          text        not null default '',
  lc_redesign         text        not null default '',
  cat_over_visita     text        not null default '',
  cat_over_reporte    text        not null default '',
  cat_over_redesign   text        not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- gastos
create table if not exists public.gastos (
  id          uuid        primary key default uuid_generate_v4(),
  sitio_id    text        not null references public.sitios(id) on delete cascade,
  tipo        text        not null default 'Logistica'
                          check (tipo in ('Logistica','Adicionales','Materiales TI','Materiales CW')),
  descripcion text        not null default '',
  valor       numeric     not null default 0,
  sub_sitio   text,
  created_at  timestamptz not null default now()
);

-- liquidaciones_cw
create table if not exists public.liquidaciones_cw (
  id          uuid        primary key default uuid_generate_v4(),
  sitio_id    text        not null references public.sitios(id) on delete cascade,
  smp         text        not null default '',
  region      text        not null default '',
  tipo_zona   text        not null default 'URBANO',
  lc          text,
  estado      text        not null default 'pre',
  items       jsonb       not null default '[]',
  created_at  timestamptz not null default now()
);

-- roles de usuario (ligado a auth.users de Supabase)
create table if not exists public.user_roles (
  user_id  uuid  primary key references auth.users(id) on delete cascade,
  role     text  not null default 'operador'
                 check (role in ('admin','coord','operador','viewer')),
  nombre   text  not null default ''
);

-- catálogo CW (Nokia 2026 — precios urbano/rural)
create table if not exists public.catalogo_cw (
  actividad_id         text    primary key,
  nombre               text    not null default '',
  unidad               text    not null default 'UN',
  precio_nokia_urbano  numeric not null default 0,
  precio_nokia_rural   numeric not null default 0,
  precio_subc_urbano   numeric not null default 0,
  precio_subc_rural    numeric not null default 0
);

-- configuración general de la app
create table if not exists public.config (
  key    text primary key,
  value  text not null default ''
);

-- Valor inicial de empresa_config
insert into public.config (key, value)
values ('empresa_config', '{"nombre":"Ingetel","nombre_corto":"Nokia","logo_url":"","color_primario":"#144E4A","tipos_cuadrilla":["TI Ingetel","TSS Ingetel","TI Scytel","TSS Scytel"]}')
on conflict (key) do nothing;


-- ── 3. TRIGGER: updated_at en sitios ────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sitios_updated_at on public.sitios;
create trigger trg_sitios_updated_at
  before update on public.sitios
  for each row execute function public.set_updated_at();


-- ── 4. ROW LEVEL SECURITY ────────────────────────────────────
-- Habilitar RLS en todas las tablas
alter table public.sitios           enable row level security;
alter table public.gastos           enable row level security;
alter table public.liquidaciones_cw enable row level security;
alter table public.subcontratistas  enable row level security;
alter table public.user_roles       enable row level security;
alter table public.config           enable row level security;

-- Helper: obtener el rol del usuario actual
create or replace function public.get_my_role()
returns text language sql stable security definer as $$
  select role from public.user_roles where user_id = auth.uid()
$$;


-- ── sitios ───────────────────────────────────────────────────
-- Todos los usuarios autenticados pueden leer
create policy "sitios_select" on public.sitios
  for select to authenticated using (true);

-- Solo admin, coord y operador pueden insertar / actualizar / eliminar
create policy "sitios_insert" on public.sitios
  for insert to authenticated
  with check (public.get_my_role() in ('admin','coord','operador'));

create policy "sitios_update" on public.sitios
  for update to authenticated
  using (public.get_my_role() in ('admin','coord','operador'));

create policy "sitios_delete" on public.sitios
  for delete to authenticated
  using (public.get_my_role() in ('admin','coord','operador'));


-- ── gastos ───────────────────────────────────────────────────
create policy "gastos_select" on public.gastos
  for select to authenticated using (true);

create policy "gastos_insert" on public.gastos
  for insert to authenticated
  with check (public.get_my_role() in ('admin','coord','operador'));

create policy "gastos_update" on public.gastos
  for update to authenticated
  using (public.get_my_role() in ('admin','coord','operador'));

create policy "gastos_delete" on public.gastos
  for delete to authenticated
  using (public.get_my_role() in ('admin','coord','operador'));


-- ── liquidaciones_cw ─────────────────────────────────────────
create policy "liq_cw_select" on public.liquidaciones_cw
  for select to authenticated using (true);

create policy "liq_cw_write" on public.liquidaciones_cw
  for all to authenticated
  using (public.get_my_role() in ('admin','coord','operador'))
  with check (public.get_my_role() in ('admin','coord','operador'));


-- ── subcontratistas ──────────────────────────────────────────
create policy "subcs_select" on public.subcontratistas
  for select to authenticated using (true);

create policy "subcs_write" on public.subcontratistas
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');


-- ── user_roles ───────────────────────────────────────────────
-- Cada usuario solo puede leer su propio rol
create policy "roles_select_own" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- Solo admin puede gestionar roles
create policy "roles_admin_all" on public.user_roles
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');


-- ── config ───────────────────────────────────────────────────
create policy "config_select" on public.config
  for select to authenticated using (true);

create policy "config_write" on public.config
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');


-- ── catalogo_cw ──────────────────────────────────────────────
alter table public.catalogo_cw enable row level security;

create policy "cat_cw_select" on public.catalogo_cw
  for select to authenticated using (true);

create policy "cat_cw_write" on public.catalogo_cw
  for all to authenticated
  using (public.get_my_role() in ('admin','coord'))
  with check (public.get_my_role() in ('admin','coord'));


-- ── 5. REALTIME ──────────────────────────────────────────────
-- Habilitar publicación en tiempo real para las tablas que usa el hook
alter publication supabase_realtime add table public.sitios;
alter publication supabase_realtime add table public.gastos;
alter publication supabase_realtime add table public.subcontratistas;


-- ── 6. ÍNDICES ───────────────────────────────────────────────
create index if not exists idx_sitios_lc         on public.sitios(lc);
create index if not exists idx_sitios_fecha       on public.sitios(fecha);
create index if not exists idx_sitios_tipo        on public.sitios(tipo);
create index if not exists idx_gastos_sitio_id    on public.gastos(sitio_id);
create index if not exists idx_liq_cw_sitio_id    on public.liquidaciones_cw(sitio_id);


-- ── 7. SEED: Catálogo CW 2026 ────────────────────────────────
-- Nota: el campo 'nombre' usa el actividad_id como placeholder.
-- Actualiza el nombre descriptivo de cada ítem en Supabase Table Editor.
insert into public.catalogo_cw (actividad_id, nombre, unidad, precio_nokia_urbano, precio_nokia_rural, precio_subc_urbano, precio_subc_rural) values
  ('2.05','2.05','UN',16610,17159,9482,9796),
  ('2.06','2.06','UN',18050,18646,10304,10645),
  ('2.07','2.07','UN',22590,23336,12896,13322),
  ('2.08','2.08','UN',24804,25624,14160,14628),
  ('2.09','2.09','UN',39532,40839,22568,23314),
  ('2.1','2.1','UN',54149,55939,30913,31935),
  ('2.11','2.11','UN',67769,70009,38688,39967),
  ('2.12','2.12','UN',79064,81677,45136,46628),
  ('2.13','2.13','UN',136645,141162,78009,80587),
  ('2.14','2.14','UN',112948,116682,64480,66612),
  ('2.15','2.15','UN',127343,131553,72698,75102),
  ('2.16','2.16','UN',139635,144251,79715,82351),
  ('2.28','2.28','UN',90358,93345,51584,53290),
  ('2.2925','2.2925','UN',885867,915152,505728,522446),
  ('2.2926','2.2926','UN',863720,892273,493085,509385),
  ('2.2927','2.2927','UN',775134,800758,442512,457141),
  ('2.2936','2.2936','UN',640371,661540,365578,377663),
  ('2.2937','2.2937','UN',756752,781769,432018,446300),
  ('2.2940','2.2940','UN',745457,770100,129080,143395),
  ('2.2941','2.2941','UN',807579,834275,141988,157734),
  ('2.2942','2.2942','UN',824521,851778,156187,173508),
  ('2.2943','2.2943','UN',931821,962625,163996,190859),
  ('2.2944','2.2944','UN',948764,980128,178996,196896),
  ('2.2949','2.2949','UN',1047981,1082625,213996,235396),
  ('2.2961','2.2961','UN',664400,686364,234802,242564),
  ('2.2962','2.2962','UN',553667,571970,316080,326529),
  ('3.01','3.01','UN',4429,4576,2529,2612),
  ('3.08','3.08','UN',146832,151686,83824,86595),
  ('6.12','6.12','UN',4651,4805,1739,1830),
  ('7.07','7.07','UN',13509,13956,7712,7967),
  ('7.08','7.08','UN',16942,17502,9672,9992),
  ('7.09','7.09','UN',22590,23336,12896,13322),
  ('7.10','7.10','UN',50827,52507,29016,29975),
  ('7.11','7.11','UN',56474,58341,32240,33306),
  ('7.31','7.31','UN',7862,8122,2244,2318),
  ('8.02','8.02','UN',282370,291705,161201,166530),
  ('8.03','8.03','UN',158127,163355,90272,93257),
  ('8.04','8.04','UN',141185,145852,80600,83265),
  ('8.05','8.05','UN',90358,93345,51584,53290),
  ('8.09','8.09','UN',56474,58341,32240,33306),
  ('9.01','9.01','UN',13952,14414,7965,8229),
  ('9.11','9.11','UN',29344,30314,16752,17306),
  ('9.12','9.12','UN',36099,37292,20608,21290),
  ('9.13','9.13','UN',169422,175023,96721,99918),
  ('10.05','10.05','UN',180717,186691,103169,106579),
  ('10.06','10.06','UN',112948,116682,64480,66612),
  ('10.07','10.07','UN',73416,75843,41912,43298),
  ('10.09','10.09','UN',28237,29170,16120,16653),
  ('10.11','10.11','UN',8969,9266,5120,5290),
  ('11.02','11.02','UN',302000,311984,172407,178107),
  ('11.03','11.03','UN',398091,411251,227264,234777),
  ('11.04','11.04','UN',398091,411251,227264,234777),
  ('11.05','11.05','UN',146424,151265,83591,86355),
  ('11.06','11.06','UN',146424,151265,83591,86355),
  ('11.07','11.07','UN',146424,151265,83591,86355),
  ('11.08','11.08','UN',146424,151265,83591,86355),
  ('11.09','11.09','UN',82364,85086,47020,48575),
  ('12.01','12.01','UN',79174,81792,45199,46694),
  ('12.02','12.02','UN',39864,41182,22758,23510),
  ('12.03','12.03','UN',54259,56053,30976,32000),
  ('12.04','12.04','UN',33220,34318,18965,19592),
  ('12.05','12.05','UN',88587,91515,50573,52245),
  ('12.06','12.06','UN',39864,41182,22758,23510),
  ('12.07','12.07','UN',73638,76072,42039,43428),
  ('12.08','12.08','UN',39864,41182,22758,23510),
  ('12.09','12.09','UN',42079,43470,24022,24816),
  ('12.1','12.1','UN',33220,34318,18965,19592),
  ('12.1_1','12.1_1','UN',33220,34318,18965,19592),
  ('12.101','12.101','UN',41414,42783,23643,24424),
  ('12.102','12.102','UN',33220,34318,18965,19592),
  ('12.103','12.103','UN',87059,89937,49700,51343),
  ('12.108','12.108','UN',106847,110379,60997,63014),
  ('12.11','12.11','UN',54259,56053,30976,32000),
  ('12.12','12.12','UN',33220,34318,18965,19592),
  ('12.13','12.13','UN',63672,65777,36349,37551),
  ('12.14','12.14','UN',27683,28598,15804,16326),
  ('12.24','12.24','UN',13243,13680,7560,7810),
  ('12.25','12.25','UN',2768,2860,1580,1633),
  ('12.26','12.26','UN',4429,4576,2529,2612),
  ('12.27','12.27','UN',3322,3432,1896,1959),
  ('12.28','12.28','UN',7198,7436,4109,4245),
  ('12.29','12.29','UN',7198,7436,4109,4245),
  ('12.77','12.77','UN',1661,1716,948,980),
  ('12.78','12.78','UN',9966,10295,5689,5878),
  ('12.79','12.79','UN',7198,7436,4109,4245),
  ('12.8','12.8','UN',4983,5148,2845,2939),
  ('12.81','12.81','UN',6644,6864,3793,3918),
  ('12.85','12.85','UN',16056,16587,9166,9469),
  ('12.86','12.86','UN',11627,12011,6638,6857),
  ('12.87','12.87','UN',18271,18875,10431,10775),
  ('12.9','12.9','UN',22590,23336,12896,13322),
  ('12.91','12.91','UN',40473,41811,23105,23869),
  ('12.92','12.92','UN',7696,7950,4394,4539),
  ('12.93','12.93','UN',6589,6806,3761,3886),
  ('12.94','12.94','UN',6589,6806,3761,3886),
  ('12.95','12.95','UN',8604,8888,4912,5074),
  ('12.96','12.96','UN',22928,23686,13090,13522),
  ('12.97','12.97','UN',7530,7779,4299,4441),
  ('12.98','12.98','UN',13756,14211,7853,8113),
  ('14.1','14.1','UN',442934,442934,0,0),
  ('14.2','14.2','UN',885867,915152,0,0),
  ('14.3','14.3','UN',1107334,1143940,0,0),
  ('15.1','15.1','UN',0,0,0,0),
  ('15.2','15.2','UN',131764,131764,0,0),
  ('15.3','15.3','UN',197215,197215,0,0),
  ('15.4','15.4','UN',230085,230085,0,0)
on conflict (actividad_id) do nothing;


-- ============================================================
--  LISTO. Próximo paso:
--  1. Crear un usuario en Supabase Auth → Authentication → Users → Add user
--  2. Insertar su rol con:
--
--     insert into public.user_roles (user_id, role, nombre)
--     values ('<UUID del usuario>', 'admin', 'Tu Nombre');
--
--  3. Repetir para cada usuario con su rol (admin/coord/operador/viewer)
-- ============================================================
