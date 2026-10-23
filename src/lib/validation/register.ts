import { z } from 'zod';

export const TIPOS_DOCUMENTO = ['CC', 'CE', 'NIT', 'PASAPORTE'] as const;

/** Mensajes de validación; viven en `site-content.ts` y se inyectan para mantener el esquema libre de texto editorial. */
export interface RegisterMessages {
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  documento: string;
  email: string;
  telefono: string;
  passwordLength: string;
  passwordComposition: string;
  passwordCommon: string;
  passwordMismatch: string;
  ciudad: string;
  direccion: string;
  consentimiento: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Contraseñas triviales que cumplirían el resto de reglas (se compara en minúsculas). */
const COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  'password12345',
  '12345678',
  '123456789',
  '1234567890',
  '12345678910',
  'qwerty12345',
  'qwertyuiop1',
  '1q2w3e4r5t',
  'abcdefghi1',
  'abc1234567',
  'contrasena1',
  'contrasena123',
  'admin12345',
  'iloveyou123',
]);

/** Quita espacios, guiones, paréntesis y signo + del teléfono. */
function stripPhoneFormatting(value: string): string {
  return value.replace(/[\s\-().+]/g, '');
}

/**
 * Celular colombiano: 10 dígitos que empiezan por 3 (con o sin prefijo 57).
 * Devuelve el número normalizado con prefijo país (`573105551234`) o `null`.
 */
export function normalizeColombianMobile(value: string): string | null {
  let digits = stripPhoneFormatting(value);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return /^3\d{9}$/.test(digits) ? `57${digits}` : null;
}

/** Documento: se descartan espacios, puntos y guiones; solo alfanumérico de 5 a 30 caracteres. */
export function normalizeDocument(value: string): string {
  return value.replace(/[\s.\-]/g, '').toUpperCase();
}

function text(min: number, max: number, message: string) {
  return z
    .string(message)
    .max(max + 200, message) // tope duro antes de procesar entradas gigantes
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(min, message)
        .max(max, message)
        .refine((v) => !CONTROL_CHARS.test(v), message)
    );
}

function optionalText(max: number, message: string) {
  return z
    .string()
    .max(max + 200, message)
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .max(max, message)
        .refine((v) => !CONTROL_CHARS.test(v), message)
    )
    .optional()
    .transform((v) => (v ? v : undefined));
}

/** Regla de contraseña nueva (registro y cambio de contraseña): una sola definición. */
export function createPasswordRule(m: RegisterMessages) {
  return z
    .string(m.passwordLength)
    .min(10, m.passwordLength)
    .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, m.passwordLength)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), m.passwordComposition)
    .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), m.passwordCommon);
}

/** Campos editables del perfil; el registro y la edición de perfil comparten estas reglas y normalizaciones. */
function createProfileShape(m: RegisterMessages) {
  return {
    nombre: text(2, 100, m.nombre),
    apellido: text(2, 100, m.apellido),
    telefono: z
      .string(m.telefono)
      .max(60, m.telefono)
      .transform((v, ctx) => {
        const normalized = normalizeColombianMobile(v);
        if (!normalized) {
          ctx.addIssue({ code: 'custom', message: m.telefono });
          return z.NEVER;
        }
        return normalized;
      }),
    ciudad: optionalText(100, m.ciudad),
    direccion: optionalText(255, m.direccion),
  };
}

export function createProfileSchema(m: RegisterMessages) {
  return z.object(createProfileShape(m));
}

export type ProfileInput = z.output<ReturnType<typeof createProfileSchema>>;
export type ProfileField = keyof ProfileInput;

export function createRegisterSchema(m: RegisterMessages) {
  return z
    .object({
      ...createProfileShape(m),
      tipoDocumento: z.enum(TIPOS_DOCUMENTO, m.tipoDocumento),
      documento: z
        .string(m.documento)
        .max(100, m.documento)
        .transform(normalizeDocument)
        .pipe(
          z
            .string()
            .min(5, m.documento)
            .max(30, m.documento)
            .regex(/^[A-Z0-9]+$/, m.documento)
        ),
      email: z
        .string(m.email)
        .max(400, m.email)
        .transform((v) => v.trim().toLowerCase())
        .pipe(z.email(m.email).max(150, m.email)),
      password: createPasswordRule(m),
      confirmPassword: z.string(m.passwordMismatch).max(1000, m.passwordMismatch),
      consentimiento: z.literal('on', m.consentimiento),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: m.passwordMismatch,
    });
}

export type RegisterInput = z.output<ReturnType<typeof createRegisterSchema>>;
export type RegisterField = keyof RegisterInput;

export const REGISTER_FIELDS = [
  'nombre',
  'apellido',
  'tipoDocumento',
  'documento',
  'email',
  'telefono',
  'password',
  'confirmPassword',
  'ciudad',
  'direccion',
  'consentimiento',
] as const satisfies readonly RegisterField[];

/** Convierte `FormData` (o un objeto) en la entrada cruda del esquema; los campos ausentes quedan `undefined`. */
export function rawRegisterInput(
  source: FormData | Record<string, unknown>
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const field of REGISTER_FIELDS) {
    const value = source instanceof FormData ? source.get(field) : source[field];
    raw[field] = typeof value === 'string' ? value : undefined;
  }
  return raw;
}

/** Errores por campo (primer mensaje de cada uno) a partir de un resultado fallido de `safeParse`. */
export function fieldErrors(error: z.ZodError): Partial<Record<RegisterField, string>> {
  const errors: Partial<Record<RegisterField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as RegisterField | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
