-- 1. Add SO column to hw_equipos
ALTER TABLE hw_equipos ADD COLUMN IF NOT EXISTS so text;

-- 2. Backfill SO from the most recent ENTRADA movimiento por serial
UPDATE hw_equipos eq
SET so = subq.so_val
FROM (
  SELECT DISTINCT ON (serial)
    serial,
    COALESCE(NULLIF(so,''), NULLIF(sales_order,'')) AS so_val
  FROM hw_movimientos
  WHERE tipo = 'ENTRADA'
    AND COALESCE(NULLIF(so,''), NULLIF(sales_order,'')) IS NOT NULL
  ORDER BY serial, created_at DESC
) subq
WHERE eq.serial = subq.serial
  AND subq.so_val IS NOT NULL;
