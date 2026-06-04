-- ============================================================
-- Migración: Limpieza HW Nokia — modelo serial como identidad
-- Ejecutar en Supabase SQL Editor (en orden)
-- ============================================================

-- 1. Quitar constraint SO único (SO es atributo, no identidad)
ALTER TABLE hw_equipos DROP CONSTRAINT IF EXISTS hw_equipos_so_key;

-- 2. Limpiar datos existentes (respeta hw_catalogo y mat_sitios)
TRUNCATE TABLE hw_despachos_pendientes CASCADE;
TRUNCATE TABLE hw_log_inversa          CASCADE;
TRUNCATE TABLE hw_movimientos          CASCADE;
TRUNCATE TABLE hw_equipos              CASCADE;
