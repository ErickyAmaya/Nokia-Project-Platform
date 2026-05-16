-- Soporte para Transferencias a otros SS
ALTER TABLE hw_movimientos ADD COLUMN IF NOT EXISTS id_transferencia text;
ALTER TABLE hw_despachos_pendientes ADD COLUMN IF NOT EXISTS destino_tipo text NOT NULL DEFAULT 'sitio';
ALTER TABLE hw_despachos_pendientes ADD COLUMN IF NOT EXISTS id_transferencia text;
