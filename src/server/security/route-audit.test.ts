// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildActionRows,
  buildRouteRows,
  findRawBodyUse,
  findUnguarded,
  readSourceFiles,
  renderRouteMap,
  staleAllowEntries,
  type AllowEntry,
  type SourceFile,
} from './route-audit';

const root = path.resolve(__dirname, '../../..');
const files = readSourceFiles(root);
const file = (p: string, content: string): SourceFile => ({ path: p, content });

/**
 * Acciones y rutas que NO exigen sesión a propósito. Cada entrada lleva su justificación; una entrada que deja de
 * hacer falta (el archivo ya cumple o desapareció) hace fallar la prueba para que se retire.
 */
const PUBLIC_BY_DESIGN: AllowEntry[] = [
  {
    path: 'src/app/(auth)/login/actions.ts',
    reason: 'Inicia sesión: se ejecuta sin sesión; limitada por correo+IP y por IP.',
  },
  {
    path: 'src/app/(auth)/registro/actions.ts',
    reason: 'Crea la cuenta: se ejecuta sin sesión; limitada por IP.',
  },
  {
    path: 'src/server/auth/logout-action.ts',
    reason: 'Cierra la sesión actual (signOut); sin sesión no hace nada.',
  },
];

describe('cobertura de autorización por archivo', () => {
  it('toda página, ruta y Server Action llama a su guardia (o está justificada)', () => {
    expect(findUnguarded(files, PUBLIC_BY_DESIGN)).toEqual([]);
  });

  it('la lista blanca no tiene entradas obsoletas', () => {
    expect(staleAllowEntries(files, PUBLIC_BY_DESIGN)).toEqual([]);
  });

  it('el análisis ve las páginas, rutas y acciones esperadas (no está vacío)', () => {
    expect(buildRouteRows(files).filter((r) => r.url.startsWith('/admin')).length).toBeGreaterThan(
      8
    );
    expect(buildActionRows(files).length).toBeGreaterThan(20);
  });
});

describe('findUnguarded (fixtures)', () => {
  const guardedPage = file(
    'src/app/(admin)/admin/x/page.tsx',
    'const u = await requireStaff("/admin/x");'
  );

  it('acepta páginas del panel con guardia', () => {
    expect(findUnguarded([guardedPage])).toEqual([]);
  });

  it('falla si una página del panel pierde requireStaff', () => {
    const page = file(
      'src/app/(admin)/admin/x/page.tsx',
      'export default function P() { return null; }'
    );
    expect(findUnguarded([page])).toEqual([expect.stringContaining('página sin guardia')]);
  });

  it('en el panel getFreshUser no basta (se exige requireStaff/requireAdmin)', () => {
    const page = file('src/app/(admin)/admin/x/page.tsx', 'await getFreshUser();');
    expect(findUnguarded([page])).toHaveLength(1);
  });

  it('en la cuenta basta requireUser; sin él falla', () => {
    expect(
      findUnguarded([file('src/app/(account)/mi-cuenta/p/page.tsx', 'await requireUser()')])
    ).toEqual([]);
    expect(
      findUnguarded([file('src/app/(account)/mi-cuenta/p/page.tsx', 'return null')])
    ).toHaveLength(1);
  });

  it('falla si una ruta del panel no tiene guardia', () => {
    const route = file(
      'src/app/(admin)/admin/x/route.ts',
      'export async function POST() { return new Response() }'
    );
    expect(findUnguarded([route])).toEqual([expect.stringContaining('ruta sin guardia')]);
  });

  const action = (body: string, extra = '') =>
    file(
      'src/app/(admin)/admin/x/actions.ts',
      `'use server';\n${extra}\nexport async function okAction() {\n  await requireStaff('/admin');\n}\n\nexport async function newAction(a, b) {\n${body}\n}\n`
    );

  it('falla si se añade una acción sin guardia aunque otra del archivo la tenga', () => {
    expect(findUnguarded([action('  return {};')])).toEqual([
      expect.stringContaining('la acción newAction no llama a su guardia'),
    ]);
  });

  it('acepta una acción con guardia', () => {
    expect(findUnguarded([action("  await requireStaff('/admin');")])).toEqual([]);
  });

  it('acepta una guardia en un helper local que la acción llama, no en uno que no llama', () => {
    const helper = "async function authorize() {\n  await requireStaff('/admin');\n}\n";
    expect(findUnguarded([action('  await authorize();', helper)])).toEqual([]);
    expect(findUnguarded([action('  return {};', helper)])).toHaveLength(1);
  });

  it('una acción de fuera del panel también necesita guardia o una entrada justificada', () => {
    const f = file(
      'src/app/(public)/y/actions.ts',
      "'use server';\nexport async function openAction() { return 1 }\n"
    );
    expect(findUnguarded([f])).toHaveLength(1);
    expect(findUnguarded([f], [{ path: f.path, reason: 'pública por diseño' }])).toEqual([]);
  });

  it('detecta entradas obsoletas de la lista blanca', () => {
    const ok = file(
      'src/app/(public)/y/actions.ts',
      "'use server';\nexport async function a() { await requireUser() }\n"
    );
    expect(staleAllowEntries([ok], [{ path: ok.path, reason: 'x' }])).toEqual([ok.path]);
    expect(staleAllowEntries([], [{ path: 'src/no/existe.ts', reason: 'x' }])).toEqual([
      'src/no/existe.ts',
    ]);
  });
});

describe('listas explícitas de campos', () => {
  it('el código no pasa cuerpos crudos a Prisma ni usa Object.fromEntries sobre formularios', () => {
    expect(findRawBodyUse(files)).toEqual([]);
  });

  it('detecta Object.fromEntries(formData)', () => {
    const f = file(
      'src/app/(admin)/admin/x/actions.ts',
      "'use server';\nexport async function a(_p, formData) {\n  const data = Object.fromEntries(formData);\n}\n"
    );
    expect(findRawBodyUse([f])).toEqual([expect.stringContaining('Object.fromEntries')]);
  });

  it('detecta data: formData / body / payload y spreads del cuerpo', () => {
    for (const code of [
      'await prisma.user.update({ where: { id }, data: formData });',
      'await prisma.user.update({ where: { id }, data: body });',
      'await prisma.user.create({\n data: await request.json(),\n});',
      'await prisma.user.create({ data: { ...body, rolId: 1 } });',
      'await prisma.user.create({ data: { ...payload } });',
    ]) {
      expect(findRawBodyUse([file('src/server/x.ts', code)]), code).toHaveLength(1);
    }
  });

  it('acepta campos explícitos y Object.fromEntries ajeno a formularios', () => {
    expect(
      findRawBodyUse([
        file(
          'src/server/x.ts',
          'await prisma.user.update({ where: { id }, data: { nombre: v.nombre } });'
        ),
        file('src/server/log.ts', 'return Object.fromEntries(Object.entries(fields));'),
      ])
    ).toEqual([]);
  });
});

describe('mapa de rutas docs/RUTAS.md', () => {
  it('coincide con el código (ejecuta `pnpm rutas` si añadiste o cambiaste una ruta o acción)', () => {
    const committed = readFileSync(path.join(root, 'docs/RUTAS.md'), 'utf8').replace(/\r\n/g, '\n');
    expect(committed).toBe(renderRouteMap(files));
  });

  it('ninguna ruta del panel o la cuenta figura «SIN GUARDIA»', () => {
    expect(renderRouteMap(files)).not.toContain('SIN GUARDIA');
  });

  it('cambia si se añade una ruta (así divergir obliga a actualizar el mapa)', () => {
    const extra = file('src/app/(admin)/admin/nueva/page.tsx', 'await requireAdmin()');
    expect(renderRouteMap([...files, extra])).not.toBe(renderRouteMap(files));
    expect(buildRouteRows([extra])).toEqual([
      { url: '/admin/nueva', kind: 'Página', access: 'ADMIN' },
    ]);
  });
});
