-- ============================================================
-- FIX: Trigger DELETE para mat_movimientos
-- Al borrar un movimiento, revierte el efecto en mat_stock.
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Función para revertir stock al eliminar un movimiento
CREATE OR REPLACE FUNCTION update_stock_on_movimiento_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.tipo = 'Entrada' THEN
    -- Revertir entrada: restar
    UPDATE mat_stock
    SET stock_actual = GREATEST(0, stock_actual - OLD.cantidad),
        updated_at   = NOW()
    WHERE catalogo_id = OLD.catalogo_id AND bodega_id = OLD.bodega_id;
  ELSE
    -- Revertir salida: sumar de vuelta
    UPDATE mat_stock
    SET stock_actual = stock_actual + OLD.cantidad,
        updated_at   = NOW()
    WHERE catalogo_id = OLD.catalogo_id AND bodega_id = OLD.bodega_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_stock_delete ON mat_movimientos;
CREATE TRIGGER trg_update_stock_delete
  AFTER DELETE ON mat_movimientos
  FOR EACH ROW EXECUTE FUNCTION update_stock_on_movimiento_delete();

-- ============================================================
-- FIX: Crear tabla mat_pendientes si no existe
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mat_pendientes (
  id           SERIAL PRIMARY KEY,
  sitio        TEXT        NOT NULL,
  catalogo_id  INTEGER     NOT NULL REFERENCES mat_catalogo(id) ON DELETE CASCADE,
  cantidad     NUMERIC(12,2) NOT NULL DEFAULT 0,
  despacho_ref TEXT,
  fecha        DATE,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mat_pendientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mat_pendientes_select" ON public.mat_pendientes;
DROP POLICY IF EXISTS "mat_pendientes_insert" ON public.mat_pendientes;
DROP POLICY IF EXISTS "mat_pendientes_delete" ON public.mat_pendientes;

CREATE POLICY "mat_pendientes_select" ON public.mat_pendientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mat_pendientes_insert" ON public.mat_pendientes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "mat_pendientes_delete" ON public.mat_pendientes
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- VERIFICAR
-- ============================================================
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'mat_movimientos'::regclass
ORDER BY tgname;
