import { z } from 'zod';

// Zod compila los esquemas con `Function("")` y, si el navegador lo bloquea, lo registra como violación de la
// CSP (sin `unsafe-eval`) aunque luego siga sin él. Se desactiva para que no haya `eval` ni ruido en la consola.
z.config({ jitless: true });
