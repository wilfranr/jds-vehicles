import { describe, it, expect } from 'vitest';
import { createNotesSchema, createReasonSchema } from './reservation-admin';

const messages = { notes: 'notas', reason: 'motivo' };

describe('observaciones y motivo de cancelación', () => {
  const notes = createNotesSchema(messages);
  const reason = createReasonSchema(messages);

  it('recortan y aceptan vacío', () => {
    expect(notes.parse('  hola  ')).toBe('hola');
    expect(notes.parse('')).toBe('');
    expect(reason.parse('   ')).toBe('');
  });

  it('acotan la longitud (1000 y 300)', () => {
    expect(notes.safeParse('x'.repeat(1000)).success).toBe(true);
    expect(notes.safeParse('x'.repeat(1001)).success).toBe(false);
    expect(reason.safeParse('x'.repeat(300)).success).toBe(true);
    expect(reason.safeParse('x'.repeat(301)).success).toBe(false);
  });

  it('rechazan caracteres de control pero admiten saltos de línea y HTML como texto', () => {
    expect(notes.safeParse('a\u0000b').success).toBe(false);
    expect(notes.safeParse('línea 1\nlínea 2').success).toBe(true);
    expect(notes.parse('<b>x</b>')).toBe('<b>x</b>');
  });

  it('rechazan valores que no son texto', () => {
    expect(notes.safeParse(null).success).toBe(false);
    expect(notes.safeParse(undefined).success).toBe(false);
  });
});
