import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock server-only para permitir probar funciones de servidor en el entorno de pruebas de Vitest
vi.mock('server-only', () => ({}));

// Mock next/cache para entornos de pruebas unitarias
vi.mock('next/cache', () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
