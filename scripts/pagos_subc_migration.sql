-- Módulo Pagos Subcontratistas — tabla de hitos de pago
-- Ejecutar en Supabase SQL Editor

create table if not exists pagos_subc (
  id               uuid primary key default gen_random_uuid(),
  sitio_nombre     text not null,
  hito             text not null check (hito in ('desplazamiento','mos','integracion','aceptacion')),
  valor            numeric not null,
  valor_sugerido   numeric,
  fecha            date not null,
  notas            text,
  registrado_por   text,
  created_at       timestamptz default now()
);

alter table pagos_subc enable row level security;

create policy "authenticated_all" on pagos_subc
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
