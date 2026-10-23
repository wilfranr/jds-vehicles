-- Tiempos reales (EXPLAIN ANALYZE) de las consultas que más pueden mejorar con índices (F5-03).
SELECT '--- A2 catálogo: total del listado' AS consulta;
EXPLAIN ANALYZE SELECT COUNT(*) FROM vehiculos WHERE visible_catalogo = 1 AND disponibilidad IN ('DISPONIBLE','RESERVADO');
SELECT '--- A4 panel: reservas activas (página 1)' AS consulta;
EXPLAIN ANALYZE SELECT id FROM reservas WHERE estado IN ('PENDIENTE_CONTACTO','EN_NEGOCIACION') ORDER BY fecha_reserva DESC, id DESC LIMIT 20;
SELECT '--- A4b panel: total de reservas activas' AS consulta;
EXPLAIN ANALYZE SELECT COUNT(*) FROM reservas WHERE estado IN ('PENDIENTE_CONTACTO','EN_NEGOCIACION');
SELECT '--- A5 panel: reservas canceladas (página 1)' AS consulta;
EXPLAIN ANALYZE SELECT id FROM reservas WHERE estado = 'CANCELADA' ORDER BY fecha_reserva DESC, id DESC LIMIT 20;
SELECT '--- A6 expiración: pendientes vencidas' AS consulta;
EXPLAIN ANALYZE SELECT id, vehiculo_id FROM reservas WHERE estado = 'PENDIENTE_CONTACTO' AND fecha_expiracion IS NOT NULL AND fecha_expiracion <= NOW();
SELECT '--- A7 resumen: por vencer en 24 h' AS consulta;
EXPLAIN ANALYZE SELECT COUNT(*) FROM reservas WHERE estado = 'PENDIENTE_CONTACTO' AND fecha_expiracion >= NOW() AND fecha_expiracion <= NOW() + INTERVAL 24 HOUR;
SELECT '--- A14 resumen: usuarios activos' AS consulta;
EXPLAIN ANALYZE SELECT COUNT(*) FROM usuarios WHERE activo = 1;
