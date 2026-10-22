export const UNKNOWN_IP = 'unknown';

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

interface ClientIpEnv extends Record<string, string | undefined> {
  TRUST_PROXY?: string;
  TRUST_PROXY_HOPS?: string;
}

/**
 * IP del cliente detrás de proxy inverso.
 *
 * `X-Forwarded-For` solo se usa si `TRUST_PROXY=true`, porque cualquier cliente puede enviar esa cabecera.
 * Cada proxy de confianza añade al FINAL la IP de quien le conectó, así que con N proxies confiables
 * (`TRUST_PROXY_HOPS`, por defecto 1) la IP real es la N-ésima empezando por la derecha; los valores
 * anteriores los controla el cliente y se ignoran. Sin `TRUST_PROXY` (o sin cabecera válida) se devuelve
 * un valor fijo: todos comparten cupo, lo que es seguro pero restrictivo; en producción detrás del proxy
 * debe activarse `TRUST_PROXY`.
 */
export function getClientIp(
  headers: { get(name: string): string | null },
  env: ClientIpEnv = process.env
): string {
  if (env.TRUST_PROXY !== 'true') return UNKNOWN_IP;

  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return UNKNOWN_IP;

  const parsedHops = Number.parseInt(env.TRUST_PROXY_HOPS ?? '1', 10);
  const hops = Number.isInteger(parsedHops) && parsedHops >= 1 ? parsedHops : 1;

  const entries = forwarded
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return UNKNOWN_IP;

  const candidate = entries[Math.max(0, entries.length - hops)];
  return candidate !== undefined && IP_PATTERN.test(candidate)
    ? candidate.toLowerCase()
    : UNKNOWN_IP;
}
