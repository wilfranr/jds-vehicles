// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');

/** Valores de ejemplo permitidos en `.env.example` (de desarrollo local, públicos por diseño). */
const EXAMPLE_VALUES: Record<string, string[]> = {
  DATABASE_URL: ['mysql://jds:jds@localhost:3307/jds_vehiculos'],
  SEED_ADMIN_PASSWORD: ['Admin123*'],
  SEED_CLIENT_PASSWORD: ['Cliente123*'],
};

function parseExample(): [string, string][] {
  return readFileSync(path.join(root, '.env.example'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ] as [string, string];
    });
}

describe('secretos en el repositorio', () => {
  it('.env y variantes locales están ignorados por git; .env.example no', () => {
    const ignored = (file: string) => {
      try {
        execFileSync('git', ['check-ignore', '-q', file], { cwd: root });
        return true;
      } catch {
        return false;
      }
    };
    expect(ignored('.env')).toBe(true);
    expect(ignored('.env.local')).toBe(true);
    expect(ignored('.env.production')).toBe(true);
    expect(ignored('.env.example')).toBe(false);
    expect(ignored('.env.prod.example')).toBe(false);
    expect(ignored('.env.prod')).toBe(true);
    expect(ignored('.env.prod.local')).toBe(true);
  });

  it('ningún archivo .env* (salvo el de ejemplo) está versionado', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((f) => /(^|\/)\.env/.test(f) && !/\.env(\.prod)?\.example$/.test(f));
    expect(tracked).toEqual([]);
  });

  it('.env.example solo contiene valores vacíos o de ejemplo conocidos, nunca secretos reales', () => {
    for (const [name, value] of parseExample()) {
      if (/SECRET|TOKEN|KEY|PASSWORD/.test(name) && !name.startsWith('SEED_')) {
        expect(value, `${name} debe ir vacía en .env.example`).toBe('');
      }
      if (value && name in EXAMPLE_VALUES) {
        expect(EXAMPLE_VALUES[name], name).toContain(value);
      }
      // Nada que parezca una clave real larga (base64/hex de 32 o más caracteres).
      expect(value, name).not.toMatch(/^[A-Za-z0-9+/=_-]{32,}$/);
    }
  });
});
