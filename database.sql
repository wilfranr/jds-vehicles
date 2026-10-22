-- =============================================================================
-- PROYECTO: Concesionario Digital (JDS Vehículos)
-- MOTOR: MySQL 8.0+
-- DESCRIPCIÓN: Script DDL para creación de tablas, relaciones, índices y datos iniciales.
-- =============================================================================

-- Creación y selección de la base de datos para MySQL Workbench / DBeaver
CREATE DATABASE IF NOT EXISTS jds_vehiculos
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE jds_vehiculos;

-- Asegurar codificación utf8mb4
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. TABLA: roles
-- Roles de usuario del sistema (ej. CLIENTE, ASESOR, ADMIN)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE COMMENT 'Ej: CLIENTE, ADMIN, ASESOR',
    descripcion VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABLA: usuarios (Compradores y personal administrativo)
-- Manejo de autenticación y datos básicos de contacto
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rol_id INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'FK a roles',
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    tipo_documento ENUM('CC', 'CE', 'NIT', 'PASAPORTE') NOT NULL DEFAULT 'CC',
    documento_identidad VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(25) NOT NULL COMMENT 'Número con prefijo internacional para WhatsApp si aplica',
    direccion VARCHAR(255) NULL,
    ciudad VARCHAR(100) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_roles FOREIGN KEY (rol_id) REFERENCES roles (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_usuarios_documento ON usuarios (documento_identidad);
CREATE INDEX idx_usuarios_email ON usuarios (email);

-- -----------------------------------------------------------------------------
-- 3. TABLA: marcas
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS marcas;
CREATE TABLE marcas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: modelos
-- Relación Marca -> Modelo
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS modelos;
CREATE TABLE modelos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    marca_id INT UNSIGNED NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_modelos_marcas FOREIGN KEY (marca_id) REFERENCES marcas (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_marca_modelo (marca_id, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABLA: vehiculos
-- Entidad central del catálogo
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS vehiculos;
CREATE TABLE vehiculos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    modelo_id INT UNSIGNED NOT NULL,
    anio YEAR NOT NULL,
    color VARCHAR(50) NOT NULL,
    condicion ENUM('NUEVO', 'USADO') NOT NULL COMMENT 'Condición del auto',
    placa VARCHAR(15) NULL COMMENT 'Obligatorio o registrado en usados; nulo en nuevos sin matricular',
    precio DECIMAL(12, 2) NOT NULL COMMENT 'Precio de venta al público',
    kilometraje INT UNSIGNED NOT NULL DEFAULT 0,
    transmision ENUM('MANUAL', 'AUTOMATICA', 'SECUENCIAL') NOT NULL DEFAULT 'MANUAL',
    combustible ENUM('GASOLINA', 'DIESEL', 'HIBRIDO', 'ELECTRICO', 'GAS') NOT NULL DEFAULT 'GASOLINA',
    cilindraje INT UNSIGNED NULL COMMENT 'Cilindraje en cc (ej: 1600, 2000)',
    descripcion TEXT NULL,
    
    -- Estado de inventario/disponibilidad para el catálogo
    disponibilidad ENUM('DISPONIBLE', 'PROXIMAMENTE', 'RESERVADO', 'VENDIDO') NOT NULL DEFAULT 'DISPONIBLE',
    visible_catalogo BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Indica si se lista en el catálogo público',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_vehiculos_modelos FOREIGN KEY (modelo_id) REFERENCES modelos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_placa_usado CHECK (
        (condicion = 'USADO' AND placa IS NOT NULL AND placa <> '') 
        OR (condicion = 'NUEVO')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vehiculos_disponibilidad ON vehiculos (disponibilidad);
CREATE INDEX idx_vehiculos_condicion ON vehiculos (condicion);
CREATE INDEX idx_vehiculos_precio ON vehiculos (precio);
CREATE INDEX idx_vehiculos_anio ON vehiculos (anio);
CREATE INDEX idx_vehiculos_placa ON vehiculos (placa);

-- -----------------------------------------------------------------------------
-- 6. TABLA: vehiculo_fotos
-- Soporte multi-foto para cada vehículo
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS vehiculo_fotos;
CREATE TABLE vehiculo_fotos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vehiculo_id INT UNSIGNED NOT NULL,
    url_foto VARCHAR(500) NOT NULL,
    es_principal BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Foto de portada o miniatura',
    orden_presentacion INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fotos_vehiculos FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_fotos_vehiculo ON vehiculo_fotos (vehiculo_id);

-- -----------------------------------------------------------------------------
-- 7. TABLA: reservas
-- Registra la reserva hecha por un comprador autenticado
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS reservas;
CREATE TABLE reservas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo_reserva VARCHAR(32) NOT NULL UNIQUE COMMENT 'Identificador único o alfanumérico amigable',
    vehiculo_id INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    
    -- Estados del ciclo de vida de la reserva
    estado ENUM('PENDIENTE_CONTACTO', 'EN_NEGOCIACION', 'COMPLETADA', 'CANCELADA', 'EXPIRADA') NOT NULL DEFAULT 'PENDIENTE_CONTACTO',
    
    fecha_reserva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion DATETIME NULL COMMENT 'Opcional: límite de tiempo para apartar el auto',
    
    -- Enlace de WhatsApp generado al reservar
    whatsapp_link VARCHAR(500) NULL,
    
    observaciones TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_reservas_vehiculos FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reservas_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_reservas_estado ON reservas (estado);
CREATE INDEX idx_reservas_usuario ON reservas (usuario_id);
CREATE INDEX idx_reservas_vehiculo ON reservas (vehiculo_id);

-- -----------------------------------------------------------------------------
-- 8. TABLA: ventas
-- Cierre de negocio y facturación/venta fuera de la app
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS ventas;
CREATE TABLE ventas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero_recibo_contrato VARCHAR(50) NOT NULL UNIQUE,
    vehiculo_id INT UNSIGNED NOT NULL UNIQUE COMMENT 'Un vehículo solo puede tener una venta registrada',
    reserva_id INT UNSIGNED NULL UNIQUE COMMENT 'Reserva asociada si provino de una',
    comprador_id INT UNSIGNED NOT NULL COMMENT 'FK al usuario comprador',
    vendedor_usuario_id INT UNSIGNED NULL COMMENT 'Asesor/admin del concesionario que cerró la venta',
    
    precio_final DECIMAL(12, 2) NOT NULL,
    metodo_pago ENUM('TRANSFERENCIA', 'EFECTIVO', 'CREDITO', 'MIXTO') NOT NULL DEFAULT 'TRANSFERENCIA',
    fecha_venta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_ventas_vehiculos FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ventas_reservas FOREIGN KEY (reserva_id) REFERENCES reservas (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ventas_comprador FOREIGN KEY (comprador_id) REFERENCES usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ventas_vendedor FOREIGN KEY (vendedor_usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_ventas_fecha ON ventas (fecha_venta);

-- -----------------------------------------------------------------------------
-- 9. TABLA: configuracion_concesionario
-- Datos del negocio (teléfono oficial de WhatsApp, mensajes por defecto)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS configuracion_concesionario;
CREATE TABLE configuracion_concesionario (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(50) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    descripcion VARCHAR(255) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- DATOS SEMILLA (SEEDS DE EJEMPLO)
-- =============================================================================

-- Roles
INSERT INTO roles (id, nombre, descripcion) VALUES
(1, 'CLIENTE', 'Usuario comprador registrado en el portal'),
(2, 'ADMIN', 'Administrador total de concesionario'),
(3, 'ASESOR', 'Asesor comercial para atención de clientes');

-- Configuración inicial de contacto
INSERT INTO configuracion_concesionario (clave, valor, descripcion) VALUES
('whatsapp_numero', '573202353168', 'Número oficial con código de país sin signo + ni espacios'),
('whatsapp_mensaje_plantilla', 'Hola JDS Vehículos, acabo de reservar el auto {marca} {modelo} {anio} (ID: {vehiculo_id}, Código Reserva: {codigo_reserva}). Mi nombre es {nombre_comprador}. Quisiera coordinar el cierre del negocio.', 'Plantilla de mensaje para WhatsApp'),
('instagram_url', 'https://www.instagram.com/jds_77vehiculos?xtok=MW16OThrNW1iY3Nxbg%3D%3D&utm_source=qr', 'Perfil oficial de Instagram');

-- Marcas y Modelos de prueba
INSERT INTO marcas (id, nombre) VALUES
(1, 'Toyota'),
(2, 'Mazda'),
(3, 'Chevrolet');

INSERT INTO modelos (id, marca_id, nombre) VALUES
(1, 1, 'Corolla'),
(2, 1, 'Hilux'),
(3, 2, 'CX-30'),
(4, 2, 'Mazda 3'),
(5, 3, 'Onix');

-- Usuarios de prueba (contraseñas simuladas / hash de ejemplo)
INSERT INTO usuarios (id, rol_id, nombre, apellido, tipo_documento, documento_identidad, email, password_hash, telefono, ciudad) VALUES
(1, 2, 'Admin', 'JDS', 'CC', '1000000001', 'admin@jdsvehiculos.com', '$2y$10$e8K7bF7UqT6jD4xR5oZ6ue...', '573000000001', 'Bogotá'),
(2, 1, 'Carlos', 'Gómez', 'CC', '1012345678', 'carlos.gomez@example.com', '$2y$10$w9K7bF7UqT6jD4xR5oZ6ue...', '573105551234', 'Medellín');

-- Vehículos de prueba
INSERT INTO vehiculos (id, modelo_id, anio, color, condicion, placa, precio, kilometraje, transmision, combustible, cilindraje, descripcion, disponibilidad, visible_catalogo) VALUES
(1, 1, 2024, 'Blanco Perlado', 'NUEVO', NULL, 115000000.00, 0, 'AUTOMATICA', 'HIBRIDO', 1800, 'Toyota Corolla Híbrido 2024 0km listo para entrega inmediata.', 'DISPONIBLE', TRUE),
(2, 3, 2022, 'Rojo Diamante', 'USADO', 'ABC123', 92000000.00, 24500, 'AUTOMATICA', 'GASOLINA', 2000, 'Mazda CX-30 Grand Touring, único dueño, mantenimientos en concesionario.', 'DISPONIBLE', TRUE),
(3, 2, 2025, 'Gris Metalizado', 'NUEVO', NULL, 230000000.00, 0, 'AUTOMATICA', 'DIESEL', 2800, 'Toyota Hilux 4x4 Diésel 2025. Próxima llegada al concesionario.', 'PROXIMAMENTE', TRUE);

-- Fotos de prueba
INSERT INTO vehiculo_fotos (vehiculo_id, url_foto, es_principal, orden_presentacion) VALUES
(1, 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb', TRUE, 1),
(2, 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341', TRUE, 1),
(3, 'https://images.unsplash.com/photo-1559416523-140ddc3d238c', TRUE, 1);
