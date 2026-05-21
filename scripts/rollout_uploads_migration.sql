-- Tabla para persistir el Rollout Details en Supabase
-- Los datos parseados del Excel se guardan aquí para que todos los usuarios los vean

create table if not exists rollout_uploads (
  id           uuid default gen_random_uuid() primary key,
  uploaded_at  timestamptz default now() not null,
  uploaded_by  text,
  items_count  int,
  items        jsonb not null
);

alter table rollout_uploads enable row level security;

-- Todos los usuarios autenticados pueden leer
create policy "rollout_read" on rollout_uploads
  for select to authenticated using (true);

-- Todos los autenticados pueden insertar (el control de rol se hace en la app)
create policy "rollout_insert" on rollout_uploads
  for insert to authenticated with check (true);

-- Solo quien insertó (o admin vía service role) puede borrar
create policy "rollout_delete" on rollout_uploads
  for delete to authenticated using (true);
