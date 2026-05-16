-- Tabla: hw_despachos_pendientes
-- Staging area para despachos HW antes de envío físico al sitio.
-- El HW sale del inventario disponible al crearse el despacho,
-- pero su ubicación sigue siendo la bodega hasta que se marque como realizado.

CREATE TABLE IF NOT EXISTS hw_despachos_pendientes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_doc  text NOT NULL,
  fecha       date NOT NULL,
  smp_id      text,
  bodega      text NOT NULL,
  destino     text NOT NULL,    -- nombre del sitio destino
  notas       text,
  items       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- items: array de objetos con campos:
  --   catalogo_id (int), descripcion (text), cod_material (text),
  --   tipo_material (text), aplica_serial (bool),
  --   serial (text|null), so (text), cantidad (int), bodega (text)
  created_by  text,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE hw_despachos_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hw_dp_select" ON hw_despachos_pendientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hw_dp_insert" ON hw_despachos_pendientes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "hw_dp_update" ON hw_despachos_pendientes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "hw_dp_delete" ON hw_despachos_pendientes
  FOR DELETE TO authenticated USING (true);
