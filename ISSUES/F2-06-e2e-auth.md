# F2-06: Pruebas end-to-end de autenticación y cierre de la Fase 2

- **Estado:** TODO
- **Fase:** 2
- **Depende de:** F2-05, **F1-06 fusionado** (introduce Playwright y el job de e2e en CI)
- **Prioridad:** Media

## Contexto

La autenticación es una zona de riesgo: una regresión aquí abre o cierra el acceso a todo el sistema. Esta issue cubre los recorridos completos con navegador real y revisa que la Fase 2 quede coherente. **Lee `AGENTS.md`.**

## Alcance

1. Pruebas Playwright en `e2e/auth.spec.ts` (reutilizando la configuración, el servidor y el sembrado de datos que dejó F1-06):
   - **Registro → sesión → mi cuenta → cerrar sesión:** un usuario nuevo con correo único (generado por la prueba) queda con sesión, ve su nombre en el header, entra a `/mi-cuenta`, cierra sesión y vuelve a ver "Iniciar sesión". Limpiar el usuario creado al terminar.
   - **Login incorrecto:** mensaje genérico idéntico con correo inexistente y con contraseña errónea.
   - **Ruta protegida:** `/mi-cuenta` sin sesión → `/login?next=%2Fmi-cuenta`; tras iniciar sesión vuelve a `/mi-cuenta`.
   - **`next` hostil:** `/login?next=//evil.com` y `?next=https://evil.com` terminan en el propio sitio.
   - **Rol:** un `CLIENTE` no accede a `/admin` (404/403 según lo decidido en F2-01/F2-04).
   - **Reserva futura:** en `/vehiculos/<id>` de un vehículo disponible, sin sesión aparece "Inicia sesión para reservar" y lleva a `/login?next=/vehiculos/<id>`.
   - **Límite de intentos:** 6 intentos de login fallidos seguidos con el mismo correo muestran el mensaje de "Demasiados intentos"; usar un correo único por prueba para no bloquear al cliente demo, y reiniciar el limitador entre pruebas (exponer un reinicio solo en entorno de test, nunca en producción).
2. Cambio de contraseña en e2e: cambiar, cerrar sesión y entrar con la nueva; limpiar o restaurar el estado.
3. Actualizar el job de CI de e2e para que incluya `auth.spec.ts`; si en F1-06 quedó como opcional (`continue-on-error`), valorar volverlo obligatorio y anotar la decisión.
4. **Revisión de cierre de la Fase 2** (anotar en `Notas de entrega`):
   - Comprobar que ninguna página pública se volvió dinámica por leer la sesión (resumen de `pnpm build` comparado con el de antes de la Fase 2).
   - Buscar en `src` rastros de contraseñas o hashes en logs o respuestas (`grep -rn "passwordHash\|password_hash" src`) y listar los usos legítimos.
   - Confirmar que `README.md` documenta: variables de autenticación, cómo crear usuarios de prueba y cómo correr los e2e.
5. Actualizar `README.md` con la lista de rutas de autenticación y de cuenta.

6. **Variantes de ruta del proxy.** `/admin` aún no existe, así que las pruebas de F2-04 no pueden distinguir si el proxy intercepta `/%61dmin/x`, `/admin%2fx` o `/ADMIN/x` o si simplemente no hay página. Cuando exista `/admin` (Fase 4) hay que repetir esa comprobación; hasta entonces dejar un test marcado `test.fixme` que documente las rutas a verificar, y recordar que cada página de `/admin` debe llamar a `requireRole()` además del proxy.

## Fuera de alcance

Pruebas de carga, pruebas de penetración, pruebas del panel de administración (Fase 4).

## Criterios de aceptación

- [ ] `pnpm e2e` pasa en local con la BD sembrada, incluidos los 7 recorridos anteriores.
- [ ] Las pruebas no dejan datos residuales (comprobar el conteo de `usuarios` antes y después).
- [ ] El job de CI ejecuta `auth.spec.ts`.
- [ ] Las observaciones de la revisión de cierre quedan anotadas.
- [ ] `pnpm check` y `pnpm build` pasan; CI en verde.

## Verificación

```bash
pnpm db:reset && pnpm e2e
docker exec jds_vehiculos_db mysql -ujds -pjds jds_vehiculos -e "SELECT COUNT(*) FROM usuarios;"   # sin cambios
```

## Recordatorio de proceso

Rama `issue/F2-06-e2e-auth` + PR; al terminar, estado `REVIEW`. **No fusionar ni marcar `DONE`.**

## Observación de la revisión de F2-03 (añadida por el orquestador)

Con sesión iniciada, el DOM contiene dos elementos `<header>`: el visible y uno con tamaño 0 (resto oculto del streaming de la carcasa parcial). Sin sesión hay uno solo. No es visible ni accesible, pero el e2e debe usar `getByRole('banner')` (no `locator('header')`, que da "strict mode violation") y, si es posible, averiguar por qué el segundo no se elimina tras la hidratación.
