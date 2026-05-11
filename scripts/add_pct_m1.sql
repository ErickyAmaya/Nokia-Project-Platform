-- ============================================================
-- ADD: columna pct_m1 en tabla sitios
-- Porcentaje de ejecución del sitio en el mes de inicio (M1).
-- M2 = 100 - pct_m1, se calcula en frontend.
-- Ejecutar en Supabase → SQL Editor
-- ============================================================
ALTER TABLE sitios
  ADD COLUMN IF NOT EXISTS pct_m1 INTEGER NOT NULL DEFAULT 100
  CHECK (pct_m1 >= 0 AND pct_m1 <= 100);
