-- ============================================================
-- MIGRACIÓN: Tabla mat_sitios · Módulo Gestión de Materiales
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Crear tabla mat_sitios
CREATE TABLE IF NOT EXISTS public.mat_sitios (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT    NOT NULL UNIQUE,
  tipo_cw     TEXT,
  regional    TEXT    NOT NULL DEFAULT 'Sur-Occidente',
  comentarios TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.mat_sitios ENABLE ROW LEVEL SECURITY;

-- 3. Políticas (eliminar si ya existían para recrear)
DROP POLICY IF EXISTS "mat_sitios_select" ON public.mat_sitios;
DROP POLICY IF EXISTS "mat_sitios_insert" ON public.mat_sitios;
DROP POLICY IF EXISTS "mat_sitios_update" ON public.mat_sitios;
DROP POLICY IF EXISTS "mat_sitios_delete" ON public.mat_sitios;

CREATE POLICY "mat_sitios_select" ON public.mat_sitios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mat_sitios_insert" ON public.mat_sitios
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "mat_sitios_update" ON public.mat_sitios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "mat_sitios_delete" ON public.mat_sitios
  FOR DELETE TO authenticated USING (true);

-- 4. Verificar
SELECT COUNT(*) AS total_sitios FROM public.mat_sitios;
