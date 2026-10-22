import { safeNextPath } from '@/lib/safe-redirect';

export function buildLoginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(safeNextPath(next))}`;
}
