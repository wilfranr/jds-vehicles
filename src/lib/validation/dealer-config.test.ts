import { describe, it, expect } from 'vitest';
import { siteContent } from '@/lib/site-content';
import {
  CONFIG_KEYS,
  createConfigValueSchema,
  isConfigKey,
  normalizeInstagramUrl,
} from './dealer-config';

const messages = {
  whatsapp: siteContent.adminConfig.errors.whatsapp,
  instagram: siteContent.adminConfig.errors.instagram,
  confirm: siteContent.adminConfig.errors.confirm,
};
const whatsapp = createConfigValueSchema('whatsapp_numero', messages);
const instagram = createConfigValueSchema('instagram_url', messages);

describe('lista blanca de claves', () => {
  it('solo las claves conocidas son editables', () => {
    expect([...CONFIG_KEYS]).toEqual(['whatsapp_numero', 'instagram_url']);
    for (const key of CONFIG_KEYS) expect(isConfigKey(key)).toBe(true);
    for (const bad of [
      'whatsapp_mensaje_plantilla',
      'admin',
      '',
      '__proto__',
      'constructor',
      null,
      7,
    ]) {
      expect(isConfigKey(bad)).toBe(false);
    }
  });
});

describe('WhatsApp', () => {
  it.each([
    ['+57 310 555 1234', '573105551234'],
    ['310 555 1234', '573105551234'],
    ['573105551234', '573105551234'],
    ['(57) 320-235-3168', '573202353168'],
  ])('normaliza %j → %s', (input, expected) => {
    expect(whatsapp.parse(input)).toBe(expected);
  });

  it.each(['', '2105551234', '31055512', '3105551234567', 'abc', '+1 415 555 2671', '<script>'])(
    'rechaza %j',
    (input) => {
      const result = whatsapp.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe(messages.whatsapp);
    }
  );

  it('rechaza valores que no son texto', () => {
    expect(whatsapp.safeParse(undefined).success).toBe(false);
    expect(whatsapp.safeParse(null).success).toBe(false);
    expect(whatsapp.safeParse(3105551234).success).toBe(false);
  });
});

describe('Instagram', () => {
  it.each([
    'https://www.instagram.com/jds_77vehiculos',
    'https://instagram.com/jds_77vehiculos/',
    'https://www.instagram.com/jds_77vehiculos?xtok=MW16OThrNW1iY3Nxbg%3D%3D&utm_source=qr',
    '  https://www.instagram.com/jds  ',
  ])('acepta %j', (input) => {
    expect(instagram.safeParse(input).success).toBe(true);
    expect(normalizeInstagramUrl(input)).toMatch(/^https:\/\/(www\.)?instagram\.com\//);
  });

  it.each([
    'http://www.instagram.com/jds',
    'https://facebook.com/jds',
    'https://instagram.com.evil.com/jds',
    'https://evilinstagram.com/jds',
    'https://www.instagram.com@evil.com/jds',
    'https://user:pass@instagram.com/jds',
    'https://instagram.com:8443/jds',
    'https://sub.instagram.com/jds',
    'javascript:alert(1)',
    'data:text/html,hola',
    '//instagram.com/jds',
    'instagram.com/jds',
    'ftp://instagram.com/jds',
    'https://instagram.com/jds\nhttps://evil.com',
    `https://instagram.com/${'a'.repeat(400)}`,
    '',
  ])('rechaza %j', (input) => {
    expect(normalizeInstagramUrl(input)).toBeNull();
    expect(instagram.safeParse(input).success).toBe(false);
  });
});
