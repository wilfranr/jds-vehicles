import { describe, it, expect } from 'vitest';
import { isLocalMedia, thumbOf } from './media-url';

const ID = '3f2b8c1e-9d4a-4b7e-8a61-0c5d2e7f9a10';

describe('URLs de fotos', () => {
  it('reconoce solo las rutas de medios con nombre generado', () => {
    expect(isLocalMedia(`/media/${ID}.webp`)).toBe(true);
    expect(isLocalMedia(`/media/${ID}_t.webp`)).toBe(true);
    for (const bad of [
      'https://images.unsplash.com/photo-1',
      `/media/${ID}.jpg`,
      `/media/../${ID}.webp`,
      `/media/${ID}.webp?x=1`,
      `//evil.com/media/${ID}.webp`,
      '/media/foto.webp',
      `/media/${ID}.webp/extra`,
    ]) {
      expect(isLocalMedia(bad), bad).toBe(false);
    }
  });

  it('la miniatura de una foto subida lleva el sufijo _t; las externas no cambian', () => {
    expect(thumbOf(`/media/${ID}.webp`)).toBe(`/media/${ID}_t.webp`);
    expect(thumbOf(`/media/${ID}_t.webp`)).toBe(`/media/${ID}_t.webp`);
    expect(thumbOf('https://images.unsplash.com/photo-1')).toBe(
      'https://images.unsplash.com/photo-1'
    );
  });
});
