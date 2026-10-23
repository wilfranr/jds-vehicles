// @vitest-environment node
import sharp from 'sharp';
import { describe, it, expect } from 'vitest';
import { processImage } from './process';

async function jpegWithExif(width = 800, height = 600, orientation = 1) {
  return sharp({ create: { width, height, channels: 3, background: '#cc3333' } })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'SECRETO-GPS-123', ImageDescription: 'ubicación privada' } })
    .withMetadata({ orientation })
    .toBuffer();
}

describe('processImage', () => {
  it('recodifica un JPEG con EXIF a WebP sin ningún metadato', async () => {
    const input = await jpegWithExif();
    expect((await sharp(input).metadata()).exif).toBeDefined(); // el original sí lleva EXIF
    expect(input.includes(Buffer.from('SECRETO-GPS-123'))).toBe(true);

    const result = await processImage(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const meta = await sharp(result.main).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(result.main.includes(Buffer.from('SECRETO-GPS-123'))).toBe(false);
    expect(result.thumb.includes(Buffer.from('SECRETO-GPS-123'))).toBe(false);
  });

  it('redimensiona al lado mayor de 1600 px y genera miniatura de 480 px sin ampliar', async () => {
    const big = await processImage(await jpegWithExif(3200, 2000));
    expect(big.ok && { w: big.width, h: big.height }).toEqual({ w: 1600, h: 1000 });
    if (!big.ok) return;
    const thumb = await sharp(big.thumb).metadata();
    expect(thumb.format).toBe('webp');
    expect(Math.max(thumb.width!, thumb.height!)).toBe(480);

    const small = await processImage(await jpegWithExif(300, 200));
    expect(small.ok && { w: small.width, h: small.height }).toEqual({ w: 300, h: 200 });
  });

  it('aplica la orientación EXIF antes de descartarla', async () => {
    const rotated = await processImage(await jpegWithExif(800, 400, 6)); // 6 = girada 90°
    expect(rotated.ok && { w: rotated.width, h: rotated.height }).toEqual({ w: 400, h: 800 });
  });

  it('acepta PNG y WebP', async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 4, background: '#00ff00' },
    })
      .png()
      .toBuffer();
    const webp = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#0000ff' },
    })
      .webp()
      .toBuffer();
    expect((await processImage(png)).ok).toBe(true);
    expect((await processImage(webp)).ok).toBe(true);
  });

  it('rechaza un archivo que no es imagen aunque se llame .jpg (firma de bytes)', async () => {
    expect(await processImage(Buffer.from('esto es texto, no una imagen'))).toEqual({
      ok: false,
      reason: 'not_image',
    });
    expect(await processImage(Buffer.from('<?php system($_GET["c"]); ?>'))).toEqual({
      ok: false,
      reason: 'not_image',
    });
    expect(
      await processImage(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')
      )
    ).toEqual({
      ok: false,
      reason: 'not_image',
    });
  });

  it('rechaza otros formatos de imagen (GIF) aunque sharp los sepa leer', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } })
      .gif()
      .toBuffer();
    expect(await processImage(gif)).toEqual({ ok: false, reason: 'not_image' });
  });

  it('una firma válida con contenido dañado o truncado → corrupt (sin lanzar)', async () => {
    const valid = await jpegWithExif();
    expect(await processImage(valid.subarray(0, 200))).toEqual({ ok: false, reason: 'corrupt' });
    const garbage = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    expect(await processImage(garbage)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('un JPEG con carga ejecutable añadida al final se recodifica y la carga desaparece', async () => {
    const poly = Buffer.concat([await jpegWithExif(), Buffer.from('<?php echo "pwn"; ?>')]);
    const result = await processImage(poly);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.main.includes(Buffer.from('<?php'))).toBe(false);
  });

  it('rechaza imágenes con demasiados píxeles (bomba de descompresión)', async () => {
    const huge = await sharp({
      create: { width: 9000, height: 9000, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(await processImage(huge)).toEqual({ ok: false, reason: 'corrupt' });
  });
});
