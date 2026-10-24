# syntax=docker/dockerfile:1
# Imagen de producción de JDS Vehículos (F6-02). Se construye EN el servidor (linux/arm64) para que `sharp` y el
# motor de Prisma sean los de esa arquitectura. Dos destinos finales:
#   runner : la aplicación (salida `standalone`, sin dependencias de desarrollo, usuario no root).
#   tools  : migraciones, primer administrador y respaldos (Prisma CLI, tsx y cliente de MariaDB). No es el servicio web.
ARG NODE_VERSION=22

# ---------------------------------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true
# openssl: el motor de consultas de Prisma; ca-certificates: next/image descarga las fotos del seed por HTTPS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------------------------------------------
# Todas las dependencias (con las de desarrollo): las necesita la compilación y el destino `tools`.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `packageManager` de package.json fija la versión exacta de pnpm.
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------------------------------------------
# Compilación contra una BD efímera (ver scripts/docker/build-with-db.sh).
FROM deps AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends mariadb-server \
 && rm -rf /var/lib/apt/lists/*
# Las variables NEXT_PUBLIC_* se incrustan en el código del cliente al compilar: no se pueden cambiar después.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ARG GIT_COMMIT=desconocido
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_WHATSAPP_NUMBER=${NEXT_PUBLIC_WHATSAPP_NUMBER} \
    NEXT_OUTPUT=standalone \
    NODE_ENV=production
COPY . .
RUN pnpm prisma generate \
 && bash scripts/docker/build-with-db.sh \
 && echo "${GIT_COMMIT}" > .next/standalone/.commit

# ---------------------------------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ARG GIT_COMMIT=desconocido
LABEL org.opencontainers.image.title="jds-vehiculos" \
      org.opencontainers.image.revision="${GIT_COMMIT}"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOADS_DIR=/data/uploads
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /app /data/uploads \
 && chown -R node:node /app /data
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# La caché de Next (ISR / `use cache`) se escribe en tiempo de ejecución: el resto del sistema de archivos es de solo lectura.
RUN mkdir -p /app/.next/cache && chown node:node /app/.next/cache
USER node
EXPOSE 3000
# Sin curl en la imagen: se usa el propio Node. /api/health/live no toca la BD ni el disco.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ---------------------------------------------------------------------------------------------------------------
FROM base AS tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends mariadb-client \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /backups /data/uploads \
 && chown -R node:node /app /backups /data
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json pnpm-workspace.yaml tsconfig.json ./
# pnpm queda descargado en la imagen (versión de `packageManager`): en ejecución el sistema de archivos es de solo
# lectura y puede no haber salida a Internet.
ENV COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_AUTO_PIN=0 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack install && chmod -R a+rX /opt/corepack
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src
ENV NODE_ENV=production \
    HOME=/tmp \
    UPLOADS_DIR=/data/uploads \
    BACKUP_DIR=/backups
USER node
# El cliente de Prisma se genera aquí (la copia de `node_modules` viene de la etapa `deps`, sin generar).
RUN pnpm prisma generate
CMD ["pnpm", "prisma", "migrate", "deploy"]
