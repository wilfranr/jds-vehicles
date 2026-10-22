/**
 * Limitador de intentos con ventana deslizante, en memoria.
 *
 * Solo es válido con UN único proceso de Node (el servidor previsto en Oracle): cada proceso tiene su
 * propio mapa, así que con varias instancias el límite efectivo se multiplicaría y un reinicio lo borra.
 * Para escalar, implementar `RateLimiter` sobre la base de datos (tabla `intentos(clave, momento)` con
 * limpieza periódica) o un almacén compartido, y cambiar solo la construcción en `limiters.ts`.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos hasta que se libera un cupo (0 si está permitido). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Consulta si la clave puede intentar de nuevo, sin registrar nada. */
  check(key: string): RateLimitResult;
  /** Registra un intento (p. ej. un fallo de login). */
  hit(key: string): void;
  /** Olvida los intentos de la clave. */
  reset(key: string): void;
  /** Número de claves almacenadas (para pruebas y métricas). */
  size(): number;
}

export interface RateLimiterOptions {
  /** Intentos permitidos dentro de la ventana. */
  limit: number;
  windowMs: number;
  /** Tope de claves en memoria; al superarlo se expulsan las más antiguas. */
  maxEntries?: number;
  now?: () => number;
}

const DEFAULT_MAX_ENTRIES = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = options.now ?? Date.now;

  // Map conserva el orden de inserción; las claves se reinsertan al actualizarse (la más antigua primero).
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  function recent(key: string, at: number): number[] {
    const timestamps = hits.get(key);
    if (!timestamps) return [];
    const fresh = timestamps.filter((t) => t > at - windowMs);
    if (fresh.length === 0) hits.delete(key);
    else if (fresh.length !== timestamps.length) hits.set(key, fresh);
    return fresh;
  }

  function sweep(at: number) {
    // Limpieza periódica de claves vencidas (como mucho una vez por ventana).
    if (at - lastSweep >= windowMs) {
      lastSweep = at;
      for (const key of [...hits.keys()]) recent(key, at);
    }
    // Tope duro: si aún hay demasiadas, se descartan las más antiguas.
    while (hits.size > maxEntries) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
  }

  return {
    check(key) {
      const at = now();
      const fresh = recent(key, at);
      if (fresh.length < limit) return { allowed: true, retryAfterSeconds: 0 };
      // El cupo se libera cuando vence el intento que deja la cuenta por debajo del límite.
      const releasesAt = (fresh[fresh.length - limit] ?? at) + windowMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((releasesAt - at) / 1000)),
      };
    },
    hit(key) {
      const at = now();
      const fresh = recent(key, at);
      fresh.push(at);
      // Solo hacen falta los últimos `limit` intentos.
      const kept = fresh.length > limit ? fresh.slice(-limit) : fresh;
      hits.delete(key);
      hits.set(key, kept);
      sweep(at);
    },
    reset(key) {
      hits.delete(key);
    },
    size() {
      return hits.size;
    },
  };
}
