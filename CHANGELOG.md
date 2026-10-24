# Changelog

Formato mínimo (basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)). Las versiones son etiquetas de Git
`vMAJOR.MINOR.PATCH` que crea el orquestador tras fusionar y que `scripts/deploy/deploy.sh` despliega. Cada despliegue
añade aquí una entrada **antes** de etiquetar; los cambios que alteren el esquema de la base de datos deben indicarlo
(ver «Migraciones compatibles hacia atrás» en `docs/DESPLIEGUE.md`).

## [Sin publicar]

Primera versión desplegable (Fases 0 a 6):

- Catálogo público, ficha de vehículo, reservas con WhatsApp, cuentas de cliente y panel del concesionario (vehículos, fotos, reservas, ventas, usuarios y configuración).
- Seguridad: CSP y cabeceras, limitadores de intentos, autorización por rol con comprobación en la BD, auditoría estática de rutas (`docs/RUTAS.md`).
- Operación: validación de entorno, primer administrador (`pnpm admin:crear`), respaldos y restauración, `/api/health`, registro JSON.
- Despliegue: imagen de producción `arm64`, Docker Compose, proxy HTTPS (Caddy) y scripts de despliegue con vuelta atrás.
- Pendientes del propietario antes del lanzamiento: `ISSUES/PENDIENTES-PROPIETARIO.md`.

### Plantilla para cada versión

```
## [vX.Y.Z] - AAAA-MM-DD
### Añadido / Cambiado / Corregido
- ...
### Base de datos
- Migraciones: ninguna | <nombre> (compatible hacia atrás: sí/no)
```
