-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `roles_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `rol_id` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `nombre` VARCHAR(100) NOT NULL,
    `apellido` VARCHAR(100) NOT NULL,
    `tipo_documento` ENUM('CC', 'CE', 'NIT', 'PASAPORTE') NOT NULL DEFAULT 'CC',
    `documento_identidad` VARCHAR(30) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(25) NOT NULL,
    `direccion` VARCHAR(255) NULL,
    `ciudad` VARCHAR(100) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `usuarios_documento_identidad_key`(`documento_identidad`),
    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `idx_usuarios_documento`(`documento_identidad`),
    INDEX `idx_usuarios_email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marcas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `marcas_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modelos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `marca_id` INTEGER UNSIGNED NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_marca_modelo`(`marca_id`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehiculos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `modelo_id` INTEGER UNSIGNED NOT NULL,
    `anio` YEAR NOT NULL,
    `color` VARCHAR(50) NOT NULL,
    `condicion` ENUM('NUEVO', 'USADO') NOT NULL,
    `placa` VARCHAR(15) NULL,
    `precio` DECIMAL(12, 2) NOT NULL,
    `kilometraje` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `transmision` ENUM('MANUAL', 'AUTOMATICA', 'SECUENCIAL') NOT NULL DEFAULT 'MANUAL',
    `combustible` ENUM('GASOLINA', 'DIESEL', 'HIBRIDO', 'ELECTRICO', 'GAS') NOT NULL DEFAULT 'GASOLINA',
    `cilindraje` INTEGER UNSIGNED NULL,
    `descripcion` TEXT NULL,
    `disponibilidad` ENUM('DISPONIBLE', 'PROXIMAMENTE', 'RESERVADO', 'VENDIDO') NOT NULL DEFAULT 'DISPONIBLE',
    `visible_catalogo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_vehiculos_disponibilidad`(`disponibilidad`),
    INDEX `idx_vehiculos_condicion`(`condicion`),
    INDEX `idx_vehiculos_precio`(`precio`),
    INDEX `idx_vehiculos_anio`(`anio`),
    INDEX `idx_vehiculos_placa`(`placa`),
    CONSTRAINT `chk_placa_usado` CHECK (
        (`condicion` = 'USADO' AND `placa` IS NOT NULL AND `placa` <> '') 
        OR (`condicion` = 'NUEVO')
    ),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehiculo_fotos` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `vehiculo_id` INTEGER UNSIGNED NOT NULL,
    `url_foto` VARCHAR(500) NOT NULL,
    `es_principal` BOOLEAN NOT NULL DEFAULT false,
    `orden_presentacion` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_fotos_vehiculo`(`vehiculo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `codigo_reserva` VARCHAR(32) NOT NULL,
    `vehiculo_id` INTEGER UNSIGNED NOT NULL,
    `usuario_id` INTEGER UNSIGNED NOT NULL,
    `estado` ENUM('PENDIENTE_CONTACTO', 'EN_NEGOCIACION', 'COMPLETADA', 'CANCELADA', 'EXPIRADA') NOT NULL DEFAULT 'PENDIENTE_CONTACTO',
    `fecha_reserva` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_expiracion` DATETIME(3) NULL,
    `whatsapp_link` VARCHAR(500) NULL,
    `observaciones` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `reservas_codigo_reserva_key`(`codigo_reserva`),
    INDEX `idx_reservas_estado`(`estado`),
    INDEX `idx_reservas_usuario`(`usuario_id`),
    INDEX `idx_reservas_vehiculo`(`vehiculo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ventas` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `numero_recibo_contrato` VARCHAR(50) NOT NULL,
    `vehiculo_id` INTEGER UNSIGNED NOT NULL,
    `reserva_id` INTEGER UNSIGNED NULL,
    `comprador_id` INTEGER UNSIGNED NOT NULL,
    `vendedor_usuario_id` INTEGER UNSIGNED NULL,
    `precio_final` DECIMAL(12, 2) NOT NULL,
    `metodo_pago` ENUM('TRANSFERENCIA', 'EFECTIVO', 'CREDITO', 'MIXTO') NOT NULL DEFAULT 'TRANSFERENCIA',
    `fecha_venta` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `observaciones` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `ventas_numero_recibo_contrato_key`(`numero_recibo_contrato`),
    UNIQUE INDEX `ventas_vehiculo_id_key`(`vehiculo_id`),
    UNIQUE INDEX `ventas_reserva_id_key`(`reserva_id`),
    INDEX `idx_ventas_fecha`(`fecha_venta`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracion_concesionario` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(50) NOT NULL,
    `valor` TEXT NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `configuracion_concesionario_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `fk_usuarios_roles` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modelos` ADD CONSTRAINT `fk_modelos_marcas` FOREIGN KEY (`marca_id`) REFERENCES `marcas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehiculos` ADD CONSTRAINT `fk_vehiculos_modelos` FOREIGN KEY (`modelo_id`) REFERENCES `modelos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehiculo_fotos` ADD CONSTRAINT `fk_fotos_vehiculos` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservas` ADD CONSTRAINT `fk_reservas_vehiculos` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservas` ADD CONSTRAINT `fk_reservas_usuarios` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ventas` ADD CONSTRAINT `fk_ventas_vehiculos` FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ventas` ADD CONSTRAINT `fk_ventas_reservas` FOREIGN KEY (`reserva_id`) REFERENCES `reservas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ventas` ADD CONSTRAINT `fk_ventas_comprador` FOREIGN KEY (`comprador_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ventas` ADD CONSTRAINT `fk_ventas_vendedor` FOREIGN KEY (`vendedor_usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
