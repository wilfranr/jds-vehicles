// Auditoría estática de rutas y acciones (F5-05). Sin alias `@/` ni dependencias del servidor: la usan los tests y
// `scripts/generar-rutas.ts` (tsx). Es una búsqueda de texto deliberadamente simple: su objetivo es que añadir una
// ruta o acción sin guardia, o pasar el cuerpo crudo a Prisma, rompa un test y obligue a decidirlo a conciencia.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export interface SourceFile {
  /** Ruta relativa a la raíz del repositorio, con `/`. */
  path: string;
  content: string;
}

export interface AllowEntry {
  path: string;
  reason: string;
}

const ADMIN_GUARD = /\brequire(Staff|Admin)\s*\(/;
// En la cuenta del cliente se admite `getFreshUser` (confirma rol y estado en la BD) además de `requireUser`.
const USER_GUARD = /\b(requireUser|requireStaff|requireAdmin|getFreshUser)\b/;

const ADMIN_DIR = 'src/app/(admin)/';
const ACCOUNT_DIR = 'src/app/(account)/';

export function isTestFile(file: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(file);
}

function guardFor(file: string): RegExp {
  return file.startsWith(ADMIN_DIR) ? ADMIN_GUARD : USER_GUARD;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Trozos de un archivo: cada `function` de nivel superior (exportada o no) con su cuerpo hasta la siguiente. */
function topLevelFunctions(content: string): { name: string; exported: boolean; body: string }[] {
  const re = /^(export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm;
  const heads = [...content.matchAll(re)];
  const exports = [...content.matchAll(/^export\s/gm)].map((m) => m.index!);
  return heads.map((m, i) => {
    const nextHead = heads[i + 1]?.index ?? content.length;
    const nextExport = exports.find((e) => e > m.index!) ?? content.length;
    return {
      name: m[2]!,
      exported: m[1] !== undefined,
      body: content.slice(m.index!, Math.min(nextHead, nextExport)),
    };
  });
}

/** Funciones `async` exportadas de un archivo `'use server'` con su cuerpo. */
export function exportedActions(
  content: string
): { name: string; body: string; content: string }[] {
  return topLevelFunctions(content)
    .filter((f) => f.exported && /^export\s+async/.test(f.body))
    .map((f) => ({ name: f.name, body: f.body, content }));
}

/**
 * Cuerpo efectivo de una acción: el suyo más el de las funciones locales (no exportadas) que llama, para admitir
 * un `authorize()` común al archivo. Una guardia escondida en un helper que la acción no llama no cuenta.
 */
function effectiveBody(action: { name: string; body: string; content: string }): string {
  const helpers = topLevelFunctions(action.content).filter((f) => !f.exported);
  const called = helpers.filter((h) => new RegExp(`\\b${h.name}\\s*\\(`).test(action.body));
  return [action.body, ...called.map((h) => h.body)].join('\n');
}

const isUseServer = (content: string) => /^\s*(['"])use server\1/m.test(content.slice(0, 400));

/**
 * Páginas y rutas de `(admin)` y `(account)` y TODAS las Server Actions de `src` deben llamar a su guardia.
 * Las acciones se revisan función a función. Devuelve un mensaje por cada incumplimiento.
 */
export function findUnguarded(files: SourceFile[], allow: AllowEntry[] = []): string[] {
  const allowed = new Set(allow.map((a) => a.path));
  const problems: string[] = [];
  for (const file of files) {
    if (isTestFile(file.path) || allowed.has(file.path)) continue;
    const guard = guardFor(file.path);
    const scoped = file.path.startsWith(ADMIN_DIR) || file.path.startsWith(ACCOUNT_DIR);
    const isPage = /\/page\.tsx$/.test(file.path);
    const isRoute = /\/route\.ts$/.test(file.path);
    if (scoped && (isPage || isRoute) && !guard.test(file.content)) {
      problems.push(
        `${file.path}: ${isPage ? 'página' : 'ruta'} sin guardia (requireStaff/requireAdmin/requireUser)`
      );
    }
    if (isUseServer(file.content)) {
      for (const action of exportedActions(file.content)) {
        if (!guard.test(effectiveBody(action))) {
          problems.push(`${file.path}: la acción ${action.name} no llama a su guardia`);
        }
      }
    }
  }
  return problems;
}

/** Entradas de la lista blanca que ya no hacen falta (el archivo no existe o ya cumple): hay que retirarlas. */
export function staleAllowEntries(files: SourceFile[], allow: AllowEntry[]): string[] {
  return allow
    .filter((a) => {
      const file = files.find((f) => f.path === a.path);
      return !file || findUnguarded([file]).length === 0;
    })
    .map((a) => a.path);
}

/** Cuerpos crudos hacia Prisma: `Object.fromEntries(formData)`, `data: formData|body|payload`, `...body`. */
export function findRawBodyUse(files: SourceFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    // Este mismo archivo contiene los patrones como texto.
    if (isTestFile(file.path) || file.path.endsWith('security/route-audit.ts')) continue;
    if (!/^src\/(app|server)\//.test(file.path)) continue;
    const handlesBody = /\b(formData|FormData)\b|request\.(json|formData)\(/.test(file.content);
    if (handlesBody && /Object\.fromEntries\(/.test(file.content)) {
      problems.push(
        `${file.path}: Object.fromEntries sobre datos del formulario (usa una lista explícita de campos)`
      );
    }
    if (
      /\bdata:\s*(?:await\s+request\.json\(\)|formData|body|payload|raw\w*)\s*[,}\n]/.test(
        file.content
      ) ||
      /\.\.\.\s*(?:formData|body|payload)\b/.test(file.content)
    ) {
      problems.push(
        `${file.path}: cuerpo crudo pasado a Prisma (usa una lista explícita de campos)`
      );
    }
  }
  return problems;
}

export interface RouteRow {
  url: string;
  kind: string;
  access: string;
}

export interface ActionRow {
  file: string;
  name: string;
  access: string;
}

function urlOf(file: string): string {
  const segments = file
    .replace(/^src\/app\//, '')
    .replace(/\/(page\.tsx|route\.ts)$/, '')
    .split('/')
    .filter((s) => s !== '' && !/^\(.+\)$/.test(s))
    .map((s) => s.replace(/%5F/gi, '_'));
  return '/' + segments.join('/');
}

function accessOf(file: string, content: string): string {
  if (file.startsWith(ADMIN_DIR)) {
    if (/\brequireAdmin\s*\(/.test(content)) return 'ADMIN';
    if (/\brequireStaff\s*\(/.test(content)) return 'ADMIN, ASESOR';
    return 'SIN GUARDIA';
  }
  if (file.startsWith(ACCOUNT_DIR))
    return USER_GUARD.test(content) ? 'Cualquier sesión' : 'SIN GUARDIA';
  if (file.startsWith('src/app/(auth)/')) return 'Anónimo (con sesión redirige)';
  if (file.startsWith('src/app/api/auth/')) return 'Auth.js';
  return 'Público';
}

/** Páginas y rutas HTTP de `src/app`, ordenadas por URL. */
export function buildRouteRows(files: SourceFile[]): RouteRow[] {
  return files
    .filter((f) => !isTestFile(f.path) && /^src\/app\/.*\/(page\.tsx|route\.ts)$/.test(f.path))
    .map((f) => {
      const isPage = f.path.endsWith('page.tsx');
      const methods = HTTP_METHODS.filter((m) =>
        new RegExp(
          `export\\s+(async\\s+)?function\\s+${m}\\b|export\\s+const\\s+(${m}\\b|\\{[^}]*\\b${m}\\b[^}]*\\})`
        ).test(f.content)
      );
      return {
        url: urlOf(f.path),
        kind: isPage ? 'Página' : `Ruta ${methods.join('/') || '?'}`,
        access: accessOf(f.path, f.content),
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url) || a.kind.localeCompare(b.kind));
}

/** Server Actions (`'use server'`) con la guardia que aplican. */
export function buildActionRows(files: SourceFile[]): ActionRow[] {
  return files
    .filter((f) => !isTestFile(f.path) && /^src\//.test(f.path) && isUseServer(f.content))
    .flatMap((f) =>
      exportedActions(f.content).map((a) => ({
        file: f.path.replace(/^src\//, ''),
        name: a.name,
        access: /\brequireAdmin\s*\(/.test(effectiveBody(a))
          ? 'ADMIN'
          : /\brequireStaff\s*\(/.test(effectiveBody(a))
            ? 'ADMIN, ASESOR'
            : /\b(requireUser|getFreshUser)\b/.test(effectiveBody(a))
              ? 'Cualquier sesión'
              : 'Público',
      }))
    )
    .sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
}

export function renderRouteMap(files: SourceFile[]): string {
  const routes = buildRouteRows(files);
  const actions = buildActionRows(files);
  const table = (head: string[], rows: string[][]) =>
    [
      `| ${head.join(' | ')} |`,
      `| ${head.map(() => '---').join(' | ')} |`,
      ...rows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n');
  return [
    '# Mapa de rutas y acciones',
    '',
    '<!-- Generado por `pnpm rutas` (scripts/generar-rutas.ts). NO editar a mano: un test compara este archivo con el código. -->',
    '',
    'Toda ruta o acción nueva obliga a regenerar este archivo (`pnpm rutas`) y a revisar la columna de acceso. Además del',
    'proxy (`src/proxy.ts`, que decide con el JWT), cada página y cada acción comprueba el rol en la base de datos.',
    '',
    '## Páginas y rutas HTTP',
    '',
    table(
      ['URL', 'Tipo', 'Acceso'],
      routes.map((r) => [`\`${r.url}\``, r.kind, r.access])
    ),
    '',
    '## Server Actions',
    '',
    table(
      ['Archivo', 'Acción', 'Acceso'],
      actions.map((a) => [`\`${a.file}\``, `\`${a.name}\``, a.access])
    ),
    '',
  ].join('\n');
}

const SKIP = new Set(['node_modules', '.next']);

/** Lee todos los `.ts`/`.tsx` de `src` (rutas relativas a `root`, con `/`). */
export function readSourceFiles(root: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(path.join(root, dir)).sort()) {
      if (SKIP.has(name)) continue;
      const rel = `${dir}/${name}`;
      if (statSync(path.join(root, rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(name))
        out.push({ path: rel, content: readFileSync(path.join(root, rel), 'utf8') });
    }
  };
  walk('src');
  return out;
}
