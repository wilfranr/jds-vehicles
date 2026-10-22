import { describe, it, expect } from 'vitest';
import { assertAuthEnv } from './env';

describe('assertAuthEnv', () => {
  it('lanza en producción sin AUTH_SECRET', () => {
    expect(() => assertAuthEnv({ NODE_ENV: 'production' })).toThrow(/AUTH_SECRET/);
    expect(() => assertAuthEnv({ NODE_ENV: 'production', AUTH_SECRET: '  ' })).toThrow(
      /AUTH_SECRET/
    );
  });
  it('no lanza con AUTH_SECRET, en desarrollo ni durante el build', () => {
    expect(() => assertAuthEnv({ NODE_ENV: 'production', AUTH_SECRET: 'x' })).not.toThrow();
    expect(() => assertAuthEnv({ NODE_ENV: 'development' })).not.toThrow();
    expect(() =>
      assertAuthEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })
    ).not.toThrow();
  });
});
