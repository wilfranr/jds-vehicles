-- Volumen sintético para evaluar planes de consulta (F5-03). Solo para una BD TEMPORAL: lo carga scripts/explain-volumen.sh.
SET SESSION cte_max_recursion_depth = 300000;

INSERT INTO usuarios (rol_id, nombre, apellido, tipo_documento, documento_identidad, email, password_hash, telefono, activo)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 50000)
SELECT 1, CONCAT('Nombre', i), CONCAT('Apellido', i), 'CC', CONCAT('D', i), CONCAT('u', i, '@sintetico.test'), 'x', '573000000000', 1 FROM n;

INSERT INTO vehiculos (modelo_id, anio, color, condicion, placa, precio, kilometraje, transmision, combustible, disponibilidad, visible_catalogo, created_at)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 50000)
SELECT 1 + (i % 3), 2000 + (i % 25), ELT(1 + (i % 6), 'Blanco', 'Negro', 'Rojo', 'Gris', 'Azul', 'Plata'),
       IF(i % 2 = 0, 'USADO', 'NUEVO'), IF(i % 2 = 0, CONCAT('P', i), NULL),
       20000000 + (i * 997) % 180000000, IF(i % 2 = 0, (i * 31) % 200000, 0),
       ELT(1 + (i % 3), 'MANUAL', 'AUTOMATICA', 'SECUENCIAL'), ELT(1 + (i % 5), 'GASOLINA', 'DIESEL', 'HIBRIDO', 'ELECTRICO', 'GAS'),
       ELT(1 + (i % 4), 'DISPONIBLE', 'RESERVADO', 'PROXIMAMENTE', 'VENDIDO'), IF(i % 10 = 0, 0, 1),
       NOW() - INTERVAL i MINUTE
FROM n;

INSERT INTO reservas (codigo_reserva, vehiculo_id, usuario_id, estado, fecha_reserva, fecha_expiracion)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 200000)
SELECT CONCAT('RES-2026-', LPAD(i, 6, '0')),
       (SELECT MIN(id) FROM vehiculos) + (i % 50000), (SELECT MIN(id) FROM usuarios) + (i % 50000),
       ELT(1 + (i % 5), 'PENDIENTE_CONTACTO', 'EN_NEGOCIACION', 'COMPLETADA', 'CANCELADA', 'EXPIRADA'),
       NOW() - INTERVAL (i % 400) DAY - INTERVAL (i % 86400) SECOND,
       IF(i % 5 = 0, NOW() + INTERVAL ((i % 96) - 2) HOUR, NULL)
FROM n;

INSERT INTO ventas (numero_recibo_contrato, vehiculo_id, comprador_id, precio_final, metodo_pago, fecha_venta)
SELECT CONCAT('VTA-2026-', LPAD(ROW_NUMBER() OVER (ORDER BY id), 6, '0')), id,
       (SELECT MIN(id) FROM usuarios) + (id % 50000), precio, ELT(1 + (id % 4), 'TRANSFERENCIA', 'EFECTIVO', 'CREDITO', 'MIXTO'),
       NOW() - INTERVAL (id % 720) DAY
FROM vehiculos WHERE disponibilidad = 'VENDIDO' LIMIT 12000;

ANALYZE TABLE usuarios, vehiculos, reservas, ventas;
