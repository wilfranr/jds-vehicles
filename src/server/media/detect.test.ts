// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { detectImageKind } from './detect';

const pad = (bytes: number[]) => Uint8Array.from([...bytes, ...new Array(32).fill(0)]);

describe('detectImageKind (firma de bytes)', () => {
  it('reconoce JPEG, PNG y WebP por su firma', () => {
    expect(detectImageKind(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(detectImageKind(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(
      detectImageKind(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0])
      )
    ).toBe('webp');
  });

  it.each([
    ['GIF', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    ['BMP', [0x42, 0x4d, 0x36, 0, 0, 0]],
    ['PDF', [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]],
    ['HTML', Array.from(Buffer.from('<html><script>alert(1)</script>'))],
    ['SVG', Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))],
    ['ejecutable ELF', [0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]],
    ['RIFF que no es WebP (WAV)', [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]],
    ['vacío', []],
    ['demasiado corto', [0xff, 0xd8, 0xff]],
  ])('rechaza %s', (_name, bytes) => {
    expect(detectImageKind(Uint8Array.from(bytes))).toBeNull();
  });

  it('no se deja engañar por una firma más allá del inicio', () => {
    const buffer = Uint8Array.from([0, 0, 0, 0, 0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageKind(buffer)).toBeNull();
  });
});
