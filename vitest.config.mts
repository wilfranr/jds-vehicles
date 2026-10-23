/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Dos proyectos:
// - `unit`: pruebas sin base de datos (jsdom); corren en paralelo.
// - `db`: pruebas `*.db.test.ts` que insertan, cuentan y borran filas en la BD sembrada. Comparten UNA base de
//   datos, y varias cuentan filas globales (vehículos, reservas, usuarios), así que sus archivos se ejecutan
//   UNO TRAS OTRO (`fileParallelism: false`): si corrieran a la vez, las filas temporales de un archivo
//   alterarían los conteos de otro. Una prueba que use la BD real debe llamarse `*.db.test.ts`.
const alias = { '@': path.resolve(import.meta.dirname, './src') };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/node_modules/**', 'src/**/*.db.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: ['src/**/*.db.test.{ts,tsx}'],
          fileParallelism: false,
        },
      },
    ],
  },
});
