// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Cada `TODO(owner)` del código debe estar listado en ISSUES/PENDIENTES-PROPIETARIO.md (F5-04).

const root = path.resolve(__dirname, '../..');
const MARKER = 'TODO(owner)';
const SCAN = ['src', 'prisma', 'scripts', 'e2e', '.github'];
const ROOT_FILES = ['README.md', '.env.example', 'next.config.ts', 'package.json'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'migrations']);
// Usan el marcador como dato, no como pendiente: las pruebas (fixtures) y la lógica que lo detecta.
const EXEMPT = new Set([path.join('src', 'lib', 'legal.ts')]);
const isTest = (f: string) => /\.test\.tsx?$/.test(f);

function walk(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (SKIP_DIRS.has(name)) return [];
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const files = [...SCAN.flatMap(walk), ...ROOT_FILES].filter(
  (f) =>
    !EXEMPT.has(f) &&
    !isTest(f) &&
    /\.(ts|tsx|md|json|ya?ml|sh|sql|mjs|example)$|^\.env\.example$/.test(f)
);

const withMarker = files.filter((f) => readFileSync(path.join(root, f), 'utf8').includes(MARKER));
const list = readFileSync(path.join(root, 'ISSUES/PENDIENTES-PROPIETARIO.md'), 'utf8');
const listedPaths = [...list.matchAll(/`([^`\s]+\.[a-z]+|\.env\.example)`/g)].map((m) => m[1]!);

describe('pendientes del propietario', () => {
  it('la lista es fechada y existe', () => {
    expect(list).toMatch(/Última revisión: \*\*\d{4}-\d{2}-\d{2}\*\*/);
  });

  it('hay marcadores TODO(owner) en el código (la prueba no está vacía)', () => {
    expect(withMarker.length).toBeGreaterThan(3);
  });

  it('todo archivo con TODO(owner) está listado en PENDIENTES-PROPIETARIO.md', () => {
    const missing = withMarker.filter((f) => !listedPaths.includes(f.split(path.sep).join('/')));
    expect(
      missing,
      `Archivos con ${MARKER} no listados en ISSUES/PENDIENTES-PROPIETARIO.md`
    ).toEqual([]);
  });

  it('las rutas citadas en la lista existen', () => {
    const missing = listedPaths.filter((p) => {
      try {
        statSync(path.join(root, p));
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});
