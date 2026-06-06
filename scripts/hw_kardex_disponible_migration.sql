-- Tabla: hw_kardex_disponible
-- Almacena el Kardex Disponible de Nokia: equipos entregados a INGETEL que están en bodega (sin asignar a sitio).
-- Junto con hw_equipos (en sitio), representa el total entregado por Nokia a INGETEL.

create table if not exists hw_kardex_disponible (
  id               bigserial primary key,
  nokia_id         text unique not null,         -- id_abastecimiento_hw_kardex (clave Nokia)
  so               text,                          -- SO Nokia
  so_local         text,                          -- SO local / LI
  cod_material     text,
  id_parte         bigint,
  descripcion_material text,
  cantidad         int default 1,
  tipo_material    text,
  proposito        text,
  tipo_fuente      text,
  tipo_movimiento  text,
  fecha_movimiento date,
  serial           text,
  proyecto         text,
  sub_proyecto     text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists hw_kardex_disp_cod_idx    on hw_kardex_disponible(cod_material);
create index if not exists hw_kardex_disp_serial_idx on hw_kardex_disponible(serial);
create index if not exists hw_kardex_disp_so_idx     on hw_kardex_disponible(so);

-- RLS
alter table hw_kardex_disponible enable row level security;
create policy "Autenticados pueden leer" on hw_kardex_disponible for select using (auth.role() = 'authenticated');
create policy "Autenticados pueden insertar" on hw_kardex_disponible for insert with check (auth.role() = 'authenticated');
create policy "Autenticados pueden actualizar" on hw_kardex_disponible for update using (auth.role() = 'authenticated');
create policy "Autenticados pueden borrar" on hw_kardex_disponible for delete using (auth.role() = 'authenticated');
