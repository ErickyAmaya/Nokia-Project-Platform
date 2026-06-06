-- Kardex Nokia completo: todos los movimientos (ENTRADA, SALIDA, TRANSFERENCIA)
create table if not exists hw_kardex_movimientos (
  id            bigserial primary key,
  nokia_id      text unique not null,
  so            text,
  so_local      text,
  cod_material  text,
  id_parte      bigint,
  descripcion_material text,
  cantidad      int default 1,
  tipo_material text,
  proposito     text,
  tipo_fuente   text,
  tipo_movimiento text,
  fecha_movimiento date,
  serial        text,
  proyecto      text,
  sub_proyecto  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists hw_kardex_mov_serial_idx on hw_kardex_movimientos (serial);
create index if not exists hw_kardex_mov_tipo_idx   on hw_kardex_movimientos (tipo_movimiento);
create index if not exists hw_kardex_mov_cod_idx    on hw_kardex_movimientos (cod_material);

alter table hw_kardex_movimientos enable row level security;

create policy "authenticated read hw_kardex_movimientos"
  on hw_kardex_movimientos for select to authenticated using (true);
create policy "authenticated write hw_kardex_movimientos"
  on hw_kardex_movimientos for all to authenticated using (true) with check (true);
