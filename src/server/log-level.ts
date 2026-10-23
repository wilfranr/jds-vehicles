// Sin dependencias de Node: lo importa el registro (log.ts), que puede acabar en el grafo del cliente.
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export function getLogLevel(source: Record<string, string | undefined> = process.env): LogLevel {
  const level = source.LOG_LEVEL?.trim();
  return (LOG_LEVELS as readonly string[]).includes(level ?? '') ? (level as LogLevel) : 'info';
}
