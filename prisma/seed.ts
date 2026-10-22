import { PrismaClient, TipoDocumento, Condicion, Transmision, Combustible, Disponibilidad } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando ejecución de seed...");

  // Determinar si debemos sembrar datos de demo
  const isProduction = process.env.NODE_ENV === "production";
  const hasDemoFlag = process.argv.includes("--demo");
  const shouldSeedDemo = !isProduction || hasDemoFlag;

  // ---------------------------------------------------------------------------
  // 1. DATOS DE REFERENCIA (Siempre se cargan, incluso en producción)
  // ---------------------------------------------------------------------------
  console.log("📦 Sembrando datos de referencia (roles y configuraciones base)...");

  // 1.1 Roles
  const roles = [
    { id: 1, nombre: "CLIENTE", descripcion: "Usuario comprador registrado en el portal" },
    { id: 2, nombre: "ADMIN", descripcion: "Administrador total de concesionario" },
    { id: 3, nombre: "ASESOR", descripcion: "Asesor comercial para atención de clientes" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { nombre: role.nombre },
      update: { descripcion: role.descripcion },
      create: {
        id: role.id,
        nombre: role.nombre,
        descripcion: role.descripcion,
      },
    });
  }

  // 1.2 Configuración del Concesionario
  const configuraciones = [
    {
      clave: "whatsapp_numero",
      valor: "573202353168",
      descripcion: "Número oficial con código de país sin signo + ni espacios",
    },
    {
      clave: "whatsapp_mensaje_plantilla",
      valor: "Hola JDS Vehículos, acabo de reservar el auto {marca} {modelo} {anio} (ID: {vehiculo_id}, Código Reserva: {codigo_reserva}). Mi nombre es {nombre_comprador}. Quisiera coordinar el cierre del negocio.",
      descripcion: "Plantilla de mensaje para WhatsApp",
    },
    {
      clave: "instagram_url",
      valor: "https://www.instagram.com/jds_77vehiculos?xtok=MW16OThrNW1iY3Nxbg%3D%3D&utm_source=qr",
      descripcion: "Perfil oficial de Instagram",
    },
  ];

  for (const config of configuraciones) {
    await prisma.configuracionConcesionario.upsert({
      where: { clave: config.clave },
      update: {
        valor: config.valor,
        descripcion: config.descripcion,
      },
      create: {
        clave: config.clave,
        valor: config.valor,
        descripcion: config.descripcion,
      },
    });
  }

  if (!shouldSeedDemo) {
    console.log("ℹ️  Entorno de producción detectado sin flag --demo. Omitiendo datos de demostración.");
    return;
  }

  // ---------------------------------------------------------------------------
  // 2. DATOS DE DEMOSTRACIÓN (Solo desarrollo o con flag --demo)
  // ---------------------------------------------------------------------------
  console.log("🚗 Sembrando datos de demostración...");

  // 2.1 Usuarios (con contraseñas hasheadas de verdad)
  const defaultAdminPass = "Admin123*";
  const defaultClientPass = "Cliente123*";

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn("⚠️  SEED_ADMIN_PASSWORD no está definida. Se usará la contraseña por defecto de desarrollo.");
  }
  if (!process.env.SEED_CLIENT_PASSWORD) {
    console.warn("⚠️  SEED_CLIENT_PASSWORD no está definida. Se usará la contraseña por defecto de desarrollo.");
  }

  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD || defaultAdminPass;
  const rawClientPassword = process.env.SEED_CLIENT_PASSWORD || defaultClientPass;

  const adminHash = await bcrypt.hash(rawAdminPassword, 10);
  const clientHash = await bcrypt.hash(rawClientPassword, 10);

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@jdsvehiculos.com" },
    update: {
      passwordHash: adminHash,
      nombre: "Admin",
      apellido: "JDS",
      telefono: "573000000001",
      ciudad: "Bogotá",
      rolId: 2,
    },
    create: {
      id: 1,
      rolId: 2,
      nombre: "Admin",
      apellido: "JDS",
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: "1000000001",
      email: "admin@jdsvehiculos.com",
      passwordHash: adminHash,
      telefono: "573000000001",
      ciudad: "Bogotá",
      activo: true,
    },
  });

  // Cliente
  await prisma.user.upsert({
    where: { email: "carlos.gomez@example.com" },
    update: {
      passwordHash: clientHash,
      nombre: "Carlos",
      apellido: "Gómez",
      telefono: "573105551234",
      ciudad: "Medellín",
      rolId: 1,
    },
    create: {
      id: 2,
      rolId: 1,
      nombre: "Carlos",
      apellido: "Gómez",
      tipoDocumento: TipoDocumento.CC,
      documentoIdentidad: "1012345678",
      email: "carlos.gomez@example.com",
      passwordHash: clientHash,
      telefono: "573105551234",
      ciudad: "Medellín",
      activo: true,
    },
  });

  // 2.2 Marcas y Modelos
  const marcasConModelos = [
    {
      id: 1,
      nombre: "Toyota",
      modelos: [
        { id: 1, nombre: "Corolla" },
        { id: 2, nombre: "Hilux" },
      ],
    },
    {
      id: 2,
      nombre: "Mazda",
      modelos: [
        { id: 3, nombre: "CX-30" },
        { id: 4, nombre: "Mazda 3" },
      ],
    },
    {
      id: 3,
      nombre: "Chevrolet",
      modelos: [{ id: 5, nombre: "Onix" }],
    },
  ];

  for (const item of marcasConModelos) {
    const marca = await prisma.marca.upsert({
      where: { nombre: item.nombre },
      update: { activo: true },
      create: { id: item.id, nombre: item.nombre, activo: true },
    });

    for (const mod of item.modelos) {
      await prisma.modelo.upsert({
        where: {
          marcaId_nombre: {
            marcaId: marca.id,
            nombre: mod.nombre,
          },
        },
        update: { activo: true },
        create: {
          id: mod.id,
          marcaId: marca.id,
          nombre: mod.nombre,
          activo: true,
        },
      });
    }
  }

  // 2.3 Vehículos y Fotos
  const vehiculosDemo = [
    {
      id: 1,
      modeloId: 1, // Corolla
      anio: 2024,
      color: "Blanco Perlado",
      condicion: Condicion.NUEVO,
      placa: null,
      precio: 115000000.0,
      kilometraje: 0,
      transmision: Transmision.AUTOMATICA,
      combustible: Combustible.HIBRIDO,
      cilindraje: 1800,
      descripcion: "Toyota Corolla Híbrido 2024 0km listo para entrega inmediata.",
      disponibilidad: Disponibilidad.DISPONIBLE,
      visibleCatalogo: true,
      fotoPrincipal: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb",
    },
    {
      id: 2,
      modeloId: 3, // CX-30
      anio: 2022,
      color: "Rojo Diamante",
      condicion: Condicion.USADO,
      placa: "ABC123",
      precio: 92000000.0,
      kilometraje: 24500,
      transmision: Transmision.AUTOMATICA,
      combustible: Combustible.GASOLINA,
      cilindraje: 2000,
      descripcion: "Mazda CX-30 Grand Touring, único dueño, mantenimientos en concesionario.",
      disponibilidad: Disponibilidad.DISPONIBLE,
      visibleCatalogo: true,
      fotoPrincipal: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
    },
    {
      id: 3,
      modeloId: 2, // Hilux
      anio: 2025,
      color: "Gris Metalizado",
      condicion: Condicion.NUEVO,
      placa: null,
      precio: 230000000.0,
      kilometraje: 0,
      transmision: Transmision.AUTOMATICA,
      combustible: Combustible.DIESEL,
      cilindraje: 2800,
      descripcion: "Toyota Hilux 4x4 Diésel 2025. Próxima llegada al concesionario.",
      disponibilidad: Disponibilidad.PROXIMAMENTE,
      visibleCatalogo: true,
      fotoPrincipal: "https://images.unsplash.com/photo-1559416523-140ddc3d238c",
    },
  ];

  for (const v of vehiculosDemo) {
    const { fotoPrincipal, ...vehiculoData } = v;

    const vehiculo = await prisma.vehiculo.upsert({
      where: { id: v.id },
      update: {
        ...vehiculoData,
      },
      create: {
        ...vehiculoData,
      },
    });

    // Foto principal
    const existingPhoto = await prisma.vehiculoFoto.findFirst({
      where: { vehiculoId: vehiculo.id, esPrincipal: true },
    });

    if (existingPhoto) {
      await prisma.vehiculoFoto.update({
        where: { id: existingPhoto.id },
        data: { urlFoto: fotoPrincipal, ordenPresentacion: 1 },
      });
    } else {
      await prisma.vehiculoFoto.create({
        data: {
          vehiculoId: vehiculo.id,
          urlFoto: fotoPrincipal,
          esPrincipal: true,
          ordenPresentacion: 1,
        },
      });
    }
  }

  console.log("✅ Seed completado con éxito.");
}

main()
  .catch((e) => {
    console.error("❌ Error durante la ejecución del seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
