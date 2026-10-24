#!/usr/bin/env bash
# Se ejecuta SOLO dentro de la etapa `build` del Dockerfile.
#
# `next build` consulta la base de datos al prerenderizar (portada, configuración del concesionario, sitemap) y
# durante `docker build` no hay red hacia el MySQL de producción. Por eso se levanta un MariaDB EFÍMERO dentro de la
# etapa de compilación (nunca llega a la imagen final), se aplican las migraciones y el seed de producción (solo roles) y se
# compila contra él. Consecuencia: el HTML prerenderizado nace con el catálogo vacío y la configuración por defecto;
# la caché se revalida con la primera visita (el script de despliegue precalienta las páginas principales).
set -euo pipefail

DATADIR=/tmp/jds-build-db
SOCKET=/tmp/jds-build-db.sock
PORT=3399

mkdir -p "$DATADIR"
chown -R mysql:mysql "$DATADIR"
mariadb-install-db --user=mysql --datadir="$DATADIR" --auth-root-authentication-method=normal >/dev/null

mariadbd --user=mysql --datadir="$DATADIR" --socket="$SOCKET" --port="$PORT" --bind-address=127.0.0.1 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --skip-log-bin \
  --pid-file=/tmp/jds-build-db/mariadb.pid --innodb-buffer-pool-size=64M >/tmp/jds-build-db.log 2>&1 &
DB_PID=$!
trap 'kill "$DB_PID" 2>/dev/null || true; wait "$DB_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if mariadb --socket="$SOCKET" -uroot -e 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
mariadb --socket="$SOCKET" -uroot -e 'SELECT 1' >/dev/null

mariadb --socket="$SOCKET" -uroot <<'SQL'
CREATE DATABASE jds_build CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'build'@'127.0.0.1' IDENTIFIED BY 'build';
GRANT ALL ON jds_build.* TO 'build'@'127.0.0.1';
SQL

export DATABASE_URL="mysql://build:build@127.0.0.1:${PORT}/jds_build"
pnpm prisma migrate deploy
NODE_ENV=production pnpm prisma db seed
pnpm build
