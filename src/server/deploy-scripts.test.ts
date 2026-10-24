// @vitest-environment node
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Scripts de despliegue (F6-04): seguridad básica sin necesidad de Docker ni del servidor.
const root = path.resolve(__dirname, '../..');
const scriptsDir = path.join(root, 'scripts/deploy');
const scripts = readdirSync(scriptsDir).filter((f) => f.endsWith('.sh'));

/** Sin comentarios ni cadenas de ayuda: solo las órdenes. */
const commands = (file: string) =>
  readFileSync(path.join(scriptsDir, file), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');

describe('scripts/deploy: contenido', () => {
  it('hay deploy, rollback, status, logs y lib', () => {
    expect(scripts.sort()).toEqual(['deploy.sh', 'lib.sh', 'logs.sh', 'rollback.sh', 'status.sh']);
  });

  it.each(scripts)('%s: sintaxis válida (bash -n) y modo estricto', (file) => {
    const result = spawnSync('bash', ['-n', path.join(scriptsDir, file)], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    if (file !== 'lib.sh')
      expect(readFileSync(path.join(scriptsDir, file), 'utf8')).toContain('set -euo pipefail');
  });

  it.each(scripts)(
    '%s: ninguna orden destructiva (down, rm -rf, prune, borrado de volúmenes o contenedores)',
    (file) => {
      const text = commands(file);
      expect(text).not.toMatch(/compose[^\n]*\sdown\b/);
      expect(text).not.toMatch(/\brm\s+-[a-z]*r[a-z]*f?\b|\brm\s+-[a-z]*f[a-z]*r/);
      expect(text).not.toMatch(/\bprune\b/);
      expect(text).not.toMatch(
        /volume\s+(rm|prune)|\bdocker\s+(rm|rmi|kill|system)\b|\bdown\s+-v\b|--volumes/
      );
      expect(text).not.toMatch(/\bdrop\s+(database|table)\b/i);
    }
  );

  it('no ejecuta restore.sh ni toca datos por su cuenta', () => {
    for (const file of scripts) expect(commands(file)).not.toMatch(/restore\.sh/);
  });

  it('no imprime el archivo de entorno ni variables secretas', () => {
    for (const file of scripts) {
      const text = commands(file);
      expect(text).not.toMatch(/cat\s+"?\$\{?JDS_ENV_FILE/);
      expect(text).not.toMatch(/\becho\s+"?\$\{?(AUTH_SECRET|MYSQL_[A-Z_]*PASSWORD|DATABASE_URL)/);
    }
  });
});

describe('scripts/deploy: redact', () => {
  const redact = (input: string) =>
    spawnSync('bash', ['-c', `source "${scriptsDir}/lib.sh"; redact`], { input, encoding: 'utf8' })
      .stdout;

  it('enmascara URLs de BD, contraseñas, secretos, tokens y cookies', () => {
    const out = redact(
      [
        'conectando a mysql://jds:Sup3rClave@db:3306/jds_vehiculos',
        '{"type":"x","password":"hunter2","detail":"ok"}',
        'AUTH_SECRET=abcdef1234567890',
        'cookie: session-token=zzz',
        'Authorization: Bearer abc.def',
        'línea normal sin secretos',
      ].join('\n')
    );
    for (const secret of ['Sup3rClave', 'hunter2', 'abcdef1234567890', 'zzz', 'abc.def']) {
      expect(out, secret).not.toContain(secret);
    }
    expect(out).toContain('línea normal sin secretos');
    expect(out).toContain('"detail":"ok"');
  });
});

describe('scripts/deploy: --dry-run no modifica nada', () => {
  let work: string;
  let binDir: string;
  let stub: string;

  const git = (...args: string[]) =>
    spawnSync('git', args, {
      cwd: work,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@x',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@x',
      },
    });

  beforeAll(() => {
    work = mkdtempSync(path.join(os.tmpdir(), 'jds-deploy-test-'));
    mkdirSync(path.join(work, 'scripts'));
    cpSync(scriptsDir, path.join(work, 'scripts/deploy'), { recursive: true });
    git('init', '-q');
    writeFileSync(path.join(work, 'archivo.txt'), 'v1');
    git('add', '-A');
    git('commit', '-q', '-m', 'v1');
    git('tag', 'v1.0.0');
    writeFileSync(path.join(work, 'archivo.txt'), 'v2');
    git('commit', '-qam', 'v2');
    git('tag', 'v1.1.0');
    // `docker` falso: si algún script lo invoca, deja una marca y falla.
    binDir = path.join(work, 'bin');
    mkdirSync(binDir);
    stub = path.join(work, 'docker-invocado');
    writeFileSync(path.join(binDir, 'docker'), `#!/bin/sh\necho "$@" >> "${stub}"\nexit 99\n`);
    chmodSync(path.join(binDir, 'docker'), 0o755);
  });
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  const run = (script: string, args: string[]) =>
    spawnSync('bash', [path.join(work, 'scripts/deploy', script), ...args], {
      cwd: work,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        JDS_ENV_FILE: '/no/existe/.env.prod',
        JDS_STATE_DIR: path.join(work, 'estado'),
      },
    });

  it('deploy.sh --dry-run imprime el plan, no cambia de etiqueta, no crea estado y no invoca docker', () => {
    const head = git('rev-parse', 'HEAD').stdout;
    const result = run('deploy.sh', ['v1.0.0', '--dry-run']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('SIMULACIÓN');
    for (const step of [
      'git checkout',
      'build app migrate',
      'scripts/backup.sh',
      'run --rm -T migrate',
      'up -d --no-build app proxy',
    ]) {
      expect(result.stdout, step).toContain(step);
    }
    expect(git('rev-parse', 'HEAD').stdout).toBe(head);
    expect(existsSync(path.join(work, 'estado'))).toBe(false);
    expect(existsSync(stub)).toBe(false);
  });

  it('rollback.sh y logs.sh --dry-run tampoco modifican ni invocan docker', () => {
    writeFileSync(path.join(work, 'estado-previa'), '');
    mkdirSync(path.join(work, 'estado'), { recursive: true });
    writeFileSync(path.join(work, 'estado/previous'), 'v1.0.0\n');
    writeFileSync(path.join(work, 'estado/current'), 'v1.1.0\n');
    const rollback = run('rollback.sh', ['--dry-run']);
    expect(rollback.status, rollback.stderr).toBe(0);
    expect(rollback.stdout).toContain('Volviendo de v1.1.0 a v1.0.0');
    expect(readFileSync(path.join(work, 'estado/current'), 'utf8')).toBe('v1.1.0\n');
    const logs = run('logs.sh', ['app', '--tail', '5', '--dry-run']);
    expect(logs.status, logs.stderr).toBe(0);
    expect(existsSync(stub)).toBe(false);
    rmSync(path.join(work, 'estado'), { recursive: true, force: true });
  });

  it('rechaza etiquetas mal formadas, inexistentes y el árbol con cambios', () => {
    expect(run('deploy.sh', ['1.0.0']).status).not.toBe(0);
    expect(run('deploy.sh', ['latest']).status).not.toBe(0);
    expect(run('deploy.sh', []).status).not.toBe(0);
    const missing = run('deploy.sh', ['v9.9.9', '--dry-run']);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('no existe');
    expect(existsSync(stub)).toBe(false);
  });

  it('sin JDS_ENV_FILE se niega', () => {
    const result = spawnSync('bash', [path.join(work, 'scripts/deploy/deploy.sh'), 'v1.0.0'], {
      cwd: work,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, JDS_ENV_FILE: '' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('JDS_ENV_FILE');
  });
});
