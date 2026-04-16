 -- ══════════════════════════════════════════════════════════════════
  --  Nokia Project Platform — Schema completo
  --  Ejecutar en: Supabase Dashboard → SQL Editor → New query
  -- ══════════════════════════════════════════════════════════════════

  -- ── 1. Roles de usuario ──────────────────────────────────────────
  create table if not exists user_roles (
    user_id  uuid primary key references auth.users(id) on delete cascade,
    role     text not null default 'viewer',   -- admin | coordinador | TI | TSS | CW | viewer
    nombre   text
  );
  alter table user_roles enable row level security;
  create policy "user can read own role"
    on user_roles for select
    using (auth.uid() = user_id);
  create policy "admin full access"
    on user_roles for all
    using (
      exists (
        select 1 from user_roles r
        where r.user_id = auth.uid() and r.role = 'admin'
      )
    );

  -- ── 2. Config de empresa ─────────────────────────────────────────
  create table if not exists config (
    key    text primary key,
    value  text
  );
  alter table config enable row level security;
  create policy "authenticated read config"
    on config for select
    using (auth.role() = 'authenticated');
  create policy "admin write config"
    on config for all
    using (
      exists (
        select 1 from user_roles r
        where r.user_id = auth.uid() and r.role = 'admin'
      )
    );

  -- ── 3. Sitios ────────────────────────────────────────────────────
  create table if not exists sitios (
    id                text primary key,
    nombre            text,
    tipo              text default 'TI',        -- TI | TSS
    fecha             date,
    ciudad            text,
    lc                text,
    cat               text default 'A',          -- A | AA | AAA
    cat_efectiva      text,
    tiene_cw          boolean default false,
    cw_nokia          numeric default 0,
    cw_costo          numeric default 0,
    cw_conjunto       boolean default false,
    estado            text default 'pre',        -- pre | final
    costos            jsonb default '{}',
    actividades       jsonb default '[]',
    cr_subc_excluded  jsonb default '[]',
    lc_visita         text,
    lc_reporte        text,
    lc_redesign       text,
    cat_over_visita   text,
    cat_over_reporte  text,
    cat_over_redesign text,
    created_at        timestamptz default now()
  );
  alter table sitios enable row level security;
  create policy "authenticated full access sitios"
    on sitios for all
    using (auth.role() = 'authenticated');

  -- ── 4. Gastos ────────────────────────────────────────────────────
  create table if not exists gastos (
    id          bigserial primary key,
    sitio_id    text references sitios(id) on delete cascade,
    tipo        text,
    descripcion text,
    valor       numeric default 0,
    sub_sitio   text,
    created_at  timestamptz default now()
  );
  alter table gastos enable row level security;
  create policy "authenticated full access gastos"
    on gastos for all
    using (auth.role() = 'authenticated');

  -- ── 5. Subcontratistas ───────────────────────────────────────────
  create table if not exists subcontratistas (
    lc             text primary key,
    empresa        text,
    cat            text default 'A',
    tel            text,
    email          text,
    tipo_cuadrilla text,
    created_at     timestamptz default now()
  );
  alter table subcontratistas enable row level security;
  create policy "authenticated full access subcs"
    on subcontratistas for all
    using (auth.role() = 'authenticated');

  -- ── 6. Catálogo TI ───────────────────────────────────────────────
  create table if not exists catalogo_ti (
    id       text primary key,
    nombre   text,
    unidad   text,
    seccion  text,
    nokia_0  numeric default 0,
    nokia_1  numeric default 0,
    nokia_2  numeric default 0,
    nokia_3  numeric default 0,
    a_0      numeric default 0,
    a_1      numeric default 0,
    a_2      numeric default 0,
    a_3      numeric default 0,
    aa_0     numeric default 0,
    aa_1     numeric default 0,
    aa_2     numeric default 0,
    aa_3     numeric default 0,
    aaa_0    numeric default 0,
    aaa_1    numeric default 0,
    aaa_2    numeric default 0,
    aaa_3    numeric default 0
  );
  alter table catalogo_ti enable row level security;
  create policy "authenticated full access catalogo_ti"
    on catalogo_ti for all
    using (auth.role() = 'authenticated');

  -- ── 7. Catálogo CW ───────────────────────────────────────────────
  create table if not exists catalogo_cw (
    actividad_id       text primary key,
    nombre             text,
    unidad             text,
    precio_nokia_urbano  numeric default 0,
    precio_nokia_rural   numeric default 0,
    precio_subc_urbano   numeric default 0,
    precio_subc_rural    numeric default 0
  );
  alter table catalogo_cw enable row level security;
  create policy "authenticated full access catalogo_cw"
    on catalogo_cw for all
    using (auth.role() = 'authenticated');

  -- ── 8. Liquidaciones CW ──────────────────────────────────────────
  create table if not exists liquidaciones_cw (
    id         text primary key,
    sitio_id   text references sitios(id) on delete cascade,
    smp        text,
    region     text,
    tipo_zona  text default 'urbano',
    lc         text,
    estado     text default 'pre',
    items      jsonb default '[]',
    created_at timestamptz default now()
  );
  alter table liquidaciones_cw enable row level security;
  create policy "authenticated full access liq_cw"
    on liquidaciones_cw for all
    using (auth.role() = 'authenticated');

  -- ── 9. Realtime ──────────────────────────────────────────────────
  -- Habilitar realtime en las tablas principales
  alter publication supabase_realtime add table sitios;
  alter publication supabase_realtime add table gastos;
  alter publication supabase_realtime add table liquidaciones_cw;
  alter publication supabase_realtime add table subcontratistas;

  ---