import { getLogLevel, LOG_LEVELS, type LogLevel } from './log-level';

/**
 * Registro de eventos UNIFICADO (F5-03): una línea JSON por evento en la salida estándar, con `ts`, `level` y
 * `channel`. Reemplaza los `console.*` sueltos de seguridad, reservas, panel y errores. El nivel mínimo sale de
 * `LOG_LEVEL` (por defecto `info`).
 *
 * **Nunca datos personales ni secretos:** los llamadores pasan solo ids, tipos y motivos; como defensa en
 * profundidad, cualquier campo cuyo nombre sugiera un secreto (contraseña, hash, token, cookie…) se sustituye por
 * `[redacted]` y los textos largos se recortan.
 */
export type LogChannel = 'security' | 'admin' | 'reservations' | 'app' | 'ops';

export interface LogEvent {
  channel: LogChannel;
  level?: LogLevel;
  [field: string]: unknown;
}

const SECRET_KEY =
  /pass(word|wd)?|secret|token|hash|cookie|authorization|credential|api[-_]?key|bearer/i;
const MAX_STRING = 300;
const MAX_DEPTH = 3;

function scrub(value: unknown, depth = 0): unknown {
  if (typeof value === 'string')
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[omitted]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrub(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? '[redacted]' : scrub(item, depth + 1),
    ])
  );
}

/** `true` si un evento de ese nivel debe escribirse con el nivel mínimo configurado. */
export function isLevelEnabled(level: LogLevel, minimum: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minimum);
}

/** Construye la línea JSON (sin escribirla); `null` si el nivel está desactivado. */
export function formatLogLine(
  event: LogEvent,
  env: Record<string, string | undefined> = process.env,
  now: () => Date = () => new Date()
): string | null {
  const { channel, level = 'info', ...fields } = event;
  if (!isLevelEnabled(level, getLogLevel(env))) return null;
  return JSON.stringify({
    ts: now().toISOString(),
    level,
    channel,
    ...(scrub(fields) as Record<string, unknown>),
  });
}

/** Escribe el evento en stdout como una línea JSON. */
export function logEvent(event: LogEvent): void {
  const line = formatLogLine(event);
  if (line !== null) console.info(line);
}
