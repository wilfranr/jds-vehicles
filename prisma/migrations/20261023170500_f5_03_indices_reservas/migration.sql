-- F5-03: índices de `reservas` justificados con EXPLAIN sobre volumen sintético (200 000 filas).
--   (estado, fecha_reserva):    ordenar por fecha dentro de un estado sin `filesort` (panel de reservas).
--   (estado, fecha_expiracion): vencimientos y «por vencer en 24 h» por rango en lugar de recorrer todo el estado.
-- Ambos tienen `estado` como prefijo, así que el índice simple `idx_reservas_estado` queda redundante y se elimina.

-- CreateIndex
CREATE INDEX `idx_reservas_estado_fecha` ON `reservas`(`estado`, `fecha_reserva`);

-- CreateIndex
CREATE INDEX `idx_reservas_estado_expiracion` ON `reservas`(`estado`, `fecha_expiracion`);

-- DropIndex
DROP INDEX `idx_reservas_estado` ON `reservas`;
