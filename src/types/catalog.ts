import {
  type Condicion,
  type Transmision,
  type Combustible,
  type Disponibilidad,
} from '@prisma/client';

export type VehicleSortOption = 'recientes' | 'precio_asc' | 'precio_desc' | 'anio_desc';

export interface VehiclePhotoData {
  id: number;
  url: string;
  esPrincipal: boolean;
  ordenPresentacion: number;
}

export interface VehicleCardData {
  id: number;
  marcaId: number;
  marcaNombre: string;
  modeloId: number;
  modeloNombre: string;
  anio: number;
  condicion: Condicion;
  precio: number;
  kilometraje: number;
  transmision: Transmision;
  combustible: Combustible;
  cilindraje: number | null;
  color: string;
  disponibilidad: Disponibilidad;
  fotoPrincipalUrl: string | null;
  totalFotos: number;
}

export interface VehicleDetailData extends VehicleCardData {
  descripcion: string | null;
  placaEnmascarada: string | null; // Solo últimos 3 caracteres ("***123") y solo si es USADO
  fotos: VehiclePhotoData[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface CatalogPaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ModelFilterItem {
  id: number;
  nombre: string;
  marcaId: number;
}

export interface BrandFilterItem {
  id: number;
  nombre: string;
  modelos: ModelFilterItem[];
}

export interface CatalogFilterOptions {
  marcas: BrandFilterItem[];
  colores: string[];
  precioMin: number;
  precioMax: number;
  anioMin: number;
  anioMax: number;
}
