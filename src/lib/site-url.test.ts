import { afterEach, describe, expect, it } from 'vitest';
import { getSiteUrl } from './site-url';

const original = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe('getSiteUrl', () => {
  it('usa la variable sin barras finales', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://jds.example///';
    expect(getSiteUrl()).toBe('https://jds.example');
  });
  it('sin variable (o vacía) usa localhost', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe('http://localhost:3000');
    process.env.NEXT_PUBLIC_SITE_URL = '';
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});
