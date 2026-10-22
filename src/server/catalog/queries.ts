import 'server-only';

import { prisma } from '@/lib/db';
import { Condicion, Disponibilidad, Prisma } from '@prisma/client';
import {
  type VehicleCardData,
  type VehicleDetailData,
  type CatalogPaginationResult,
  type CatalogFilterOptions,
} from '@/types/catalog';
import { type NormalizedCatalogFilters } from './filters';
import { cacheTag } from 'next/cache';

const PAGE_SIZE = 12;

/**
 * Enmascara la placa dejando visibles solo los últimos 3 caracteres ("***123").
 * Aplica únicamente a vehículos usados.
 */
function maskPlate(placa: string | null, condicion: Condicion): string | null {
  if (!placa || condicion !== Condicion.USADO) return null;
  const clean = placa.trim();
  if (clean.length <= 3) return '***';
  return `***${clean.slice(-3)}`;
}

/**
 * Lista vehículos para el catálogo público con filtros y paginación.
 * Reglas clave:
 * - Siempre `visibleCatalogo: true`
 * - Nunca incluye vehículos con estado `VENDIDO`
 * - Por defecto incluye únicamente `DISPONIBLE` y `RESERVADO`.
 *   El estado `PROXIMAMENTE` solo se incluye si se solicita explícitamente en filters.disponibilidad (ej. /proximamente).
 * - Evita N+1 incluyendo las fotos necesarias en una sola consulta.
 *
 * Estrategia de caché:
 * Como el catálogo permite combinaciones arbitrarias de filtros por query string (incluyendo texto libre 'q'),
 * no se aplica caché de función indiscriminada a listVehicles para evitar polución de claves y datos obsoletos
 * ante reservas o ventas. Las llamadas específicas (como los destacados de la portada) pueden implementar
 * funciones auxiliares cacheadas con tiempos cortos (ej. getFeaturedVehicles).
 */
export async function listVehicles(
  filters: NormalizedCatalogFilters
): Promise<CatalogPaginationResult<VehicleCardData>> {
  const page = Math.max(1, filters.pagina);
  const skip = (page - 1) * PAGE_SIZE;

  // Condiciones base de seguridad de negocio:
  // 1. Siempre visible_catalogo = true
  // 2. Por defecto incluye SOLO DISPONIBLE y RESERVADO (PROXIMAMENTE solo si se pide explícitamente)
  // 3. VENDIDO nunca aparece (incluso si se intenta forzar por parámetro)
  let disponibilidadFilter: Prisma.EnumDisponibilidadFilter | Disponibilidad = {
    in: [Disponibilidad.DISPONIBLE, Disponibilidad.RESERVADO],
  };

  if (filters.disponibilidad && filters.disponibilidad !== Disponibilidad.VENDIDO) {
    disponibilidadFilter = filters.disponibilidad;
  }

  const where: Prisma.VehiculoWhereInput = {
    visibleCatalogo: true,
    disponibilidad: disponibilidadFilter,
  };

  // Búsqueda textual 'q' (marca, modelo, color - la placa NO se busca por privacidad)
  if (filters.q) {
    where.OR = [
      { modelo: { marca: { nombre: { contains: filters.q } } } },
      { modelo: { nombre: { contains: filters.q } } },
      { color: { contains: filters.q } },
    ];
  }

  if (filters.marca) {
    where.modelo = {
      marcaId: filters.marca,
    };
  }

  if (filters.modelo) {
    where.modeloId = filters.modelo;
  }

  if (filters.condicion) {
    where.condicion = filters.condicion;
  }

  if (filters.transmision) {
    where.transmision = filters.transmision;
  }

  if (filters.combustible) {
    where.combustible = filters.combustible;
  }

  if (filters.color) {
    where.color = { contains: filters.color };
  }

  if (filters.precioMin !== undefined || filters.precioMax !== undefined) {
    where.precio = {};
    if (filters.precioMin !== undefined) {
      where.precio.gte = new Prisma.Decimal(filters.precioMin);
    }
    if (filters.precioMax !== undefined) {
      where.precio.lte = new Prisma.Decimal(filters.precioMax);
    }
  }

  if (filters.anioMin !== undefined || filters.anioMax !== undefined) {
    where.anio = {};
    if (filters.anioMin !== undefined) {
      where.anio.gte = filters.anioMin;
    }
    if (filters.anioMax !== undefined) {
      where.anio.lte = filters.anioMax;
    }
  }

  // Ordenamiento
  let orderBy: Prisma.VehiculoOrderByWithRelationInput = { id: 'desc' };
  switch (filters.orden) {
    case 'precio_asc':
      orderBy = { precio: 'asc' };
      break;
    case 'precio_desc':
      orderBy = { precio: 'desc' };
      break;
    case 'anio_desc':
      orderBy = { anio: 'desc' };
      break;
    case 'recientes':
    default:
      orderBy = { id: 'desc' };
      break;
  }

  const [total, records] = await Promise.all([
    prisma.vehiculo.count({ where }),
    prisma.vehiculo.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy,
      include: {
        modelo: {
          include: {
            marca: true,
          },
        },
        fotos: {
          orderBy: [{ esPrincipal: 'desc' }, { ordenPresentacion: 'asc' }],
          select: {
            urlFoto: true,
            esPrincipal: true,
          },
        },
      },
    }),
  ]);

  const items: VehicleCardData[] = records.map((v) => {
    const mainPhoto = v.fotos.find((f) => f.esPrincipal) || v.fotos[0];
    return {
      id: v.id,
      marcaId: v.modelo.marcaId,
      marcaNombre: v.modelo.marca.nombre,
      modeloId: v.modeloId,
      modeloNombre: v.modelo.nombre,
      anio: v.anio,
      condicion: v.condicion,
      precio: Number(v.precio),
      kilometraje: v.kilometraje,
      transmision: v.transmision,
      combustible: v.combustible,
      cilindraje: v.cilindraje,
      color: v.color,
      disponibilidad: v.disponibilidad,
      fotoPrincipalUrl: mainPhoto ? mainPhoto.urlFoto : null,
      totalFotos: v.fotos.length,
    };
  });

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil(total / PAGE_SIZE) || 1,
  };
}

/**
 * Obtiene los vehículos destacados para la portada (home):
 * Devuelve hasta `limit` vehículos con disponibilidad DISPONIBLE, ordenados por los más recientes.
 *
 * Estrategia de caché:
 * Utiliza 'use cache' con tiempo de vida corto (cacheLife 'seconds', max 60s) y la etiqueta 'catalog-vehicles'.
 * Se invalidará mediante revalidateTag('catalog-vehicles') desde mutaciones de inventario en Fases 3 y 4.
 */
export async function getFeaturedVehicles(limit = 6): Promise<VehicleCardData[]> {
  'use cache';
  cacheTag('catalog-vehicles');

  const records = await prisma.vehiculo.findMany({
    where: {
      visibleCatalogo: true,
      disponibilidad: Disponibilidad.DISPONIBLE,
    },
    take: limit,
    orderBy: { id: 'desc' },
    include: {
      modelo: {
        include: {
          marca: true,
        },
      },
      fotos: {
        orderBy: [{ esPrincipal: 'desc' }, { ordenPresentacion: 'asc' }],
        select: {
          urlFoto: true,
          esPrincipal: true,
        },
      },
    },
  });

  return records.map((v) => {
    const mainPhoto = v.fotos.find((f) => f.esPrincipal) || v.fotos[0];
    return {
      id: v.id,
      marcaId: v.modelo.marcaId,
      marcaNombre: v.modelo.marca.nombre,
      modeloId: v.modeloId,
      modeloNombre: v.modelo.nombre,
      anio: v.anio,
      condicion: v.condicion,
      precio: Number(v.precio),
      kilometraje: v.kilometraje,
      transmision: v.transmision,
      combustible: v.combustible,
      cilindraje: v.cilindraje,
      color: v.color,
      disponibilidad: v.disponibilidad,
      fotoPrincipalUrl: mainPhoto ? mainPhoto.urlFoto : null,
      totalFotos: v.fotos.length,
    };
  });
}

/**
 * Obtiene el detalle de un vehículo por su ID.
 * Devuelve null si no existe, si está VENDIDO o si visible_catalogo = false.
 * Serializa tipos Decimal y Date a números y cadenas ISO.
 * Enmascara la placa para que nunca viaje completa.
 */
export async function getVehicleById(id: number): Promise<VehicleDetailData | null> {
  const v = await prisma.vehiculo.findFirst({
    where: {
      id,
      visibleCatalogo: true,
      disponibilidad: {
        not: Disponibilidad.VENDIDO,
      },
    },
    include: {
      modelo: {
        include: {
          marca: true,
        },
      },
      fotos: {
        orderBy: [{ esPrincipal: 'desc' }, { ordenPresentacion: 'asc' }],
        select: {
          id: true,
          urlFoto: true,
          esPrincipal: true,
          ordenPresentacion: true,
        },
      },
    },
  });

  if (!v) return null;

  const mainPhoto = v.fotos.find((f) => f.esPrincipal) || v.fotos[0];

  return {
    id: v.id,
    marcaId: v.modelo.marcaId,
    marcaNombre: v.modelo.marca.nombre,
    modeloId: v.modeloId,
    modeloNombre: v.modelo.nombre,
    anio: v.anio,
    condicion: v.condicion,
    precio: Number(v.precio),
    kilometraje: v.kilometraje,
    transmision: v.transmision,
    combustible: v.combustible,
    cilindraje: v.cilindraje,
    color: v.color,
    disponibilidad: v.disponibilidad,
    fotoPrincipalUrl: mainPhoto ? mainPhoto.urlFoto : null,
    totalFotos: v.fotos.length,
    descripcion: v.descripcion,
    placaEnmascarada: maskPlate(v.placa, v.condicion),
    fotos: v.fotos.map((f) => ({
      id: f.id,
      url: f.urlFoto,
      esPrincipal: f.esPrincipal,
      ordenPresentacion: f.ordenPresentacion,
    })),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

/**
 * Obtiene las opciones disponibles para los filtros del catálogo:
 * Marcas con sus modelos con vehículos visibles, colores distintos,
 * y rango de precios y años presentes en el inventario activo.
 *
 * Se cachea usando 'use cache' con la etiqueta 'catalog-filter-options'.
 */
export async function getFilterOptions(): Promise<CatalogFilterOptions> {
  'use cache';
  cacheTag('catalog-filter-options');

  const visibleWhere: Prisma.VehiculoWhereInput = {
    visibleCatalogo: true,
    disponibilidad: {
      not: Disponibilidad.VENDIDO,
    },
  };

  const [brandsWithModels, colorsRaw, priceStats, yearStats] = await Promise.all([
    prisma.marca.findMany({
      where: {
        activo: true,
        modelos: {
          some: {
            activo: true,
            vehiculos: {
              some: visibleWhere,
            },
          },
        },
      },
      select: {
        id: true,
        nombre: true,
        modelos: {
          where: {
            activo: true,
            vehiculos: {
              some: visibleWhere,
            },
          },
          select: {
            id: true,
            nombre: true,
            marcaId: true,
          },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.vehiculo.findMany({
      where: visibleWhere,
      select: { color: true },
      distinct: ['color'],
      orderBy: { color: 'asc' },
    }),
    prisma.vehiculo.aggregate({
      where: visibleWhere,
      _min: { precio: true },
      _max: { precio: true },
    }),
    prisma.vehiculo.aggregate({
      where: visibleWhere,
      _min: { anio: true },
      _max: { anio: true },
    }),
  ]);

  return {
    marcas: brandsWithModels,
    colores: colorsRaw.map((c: { color: string }) => c.color),
    precioMin: priceStats._min.precio ? Number(priceStats._min.precio) : 0,
    precioMax: priceStats._max.precio ? Number(priceStats._max.precio) : 0,
    anioMin: yearStats._min.anio ?? new Date().getFullYear(),
    anioMax: yearStats._max.anio ?? new Date().getFullYear(),
  };
}

/**
 * Obtiene hasta 3 vehículos similares al actual:
 * Misma marca o rango de precio ±25%, excluyendo el actual.
 * Siempre visibleCatalogo = true y no VENDIDO.
 */
export async function getSimilarVehicles(currentVehicle: {
  id: number;
  marcaId: number;
  precio: number;
}): Promise<VehicleCardData[]> {
  'use cache';
  cacheTag('catalog-vehicles');

  const minPrice = new Prisma.Decimal(Math.max(0, currentVehicle.precio * 0.75));
  const maxPrice = new Prisma.Decimal(currentVehicle.precio * 1.25);

  const records = await prisma.vehiculo.findMany({
    where: {
      id: { not: currentVehicle.id },
      visibleCatalogo: true,
      disponibilidad: {
        not: Disponibilidad.VENDIDO,
      },
      OR: [
        { modelo: { marcaId: currentVehicle.marcaId } },
        { precio: { gte: minPrice, lte: maxPrice } },
      ],
    },
    take: 3,
    orderBy: { id: 'desc' },
    include: {
      modelo: {
        include: {
          marca: true,
        },
      },
      fotos: {
        orderBy: [{ esPrincipal: 'desc' }, { ordenPresentacion: 'asc' }],
        select: {
          urlFoto: true,
          esPrincipal: true,
        },
      },
    },
  });

  return records.map((v) => {
    const mainPhoto = v.fotos.find((f) => f.esPrincipal) || v.fotos[0];
    return {
      id: v.id,
      marcaId: v.modelo.marcaId,
      marcaNombre: v.modelo.marca.nombre,
      modeloId: v.modeloId,
      modeloNombre: v.modelo.nombre,
      anio: v.anio,
      condicion: v.condicion,
      precio: Number(v.precio),
      kilometraje: v.kilometraje,
      transmision: v.transmision,
      combustible: v.combustible,
      cilindraje: v.cilindraje,
      color: v.color,
      disponibilidad: v.disponibilidad,
      fotoPrincipalUrl: mainPhoto ? mainPhoto.urlFoto : null,
      totalFotos: v.fotos.length,
    };
  });
}
