# ──────────────────────────────────────────────
# Stage 1 : builder
# Installe toutes les dépendances et génère le
# client Prisma pour la plateforme Alpine (musl).
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/prisma        ./prisma

# npm ci installe dev + prod → prisma CLI disponible pour generate
RUN npm ci

# Génère le client Prisma pour la plateforme cible (Alpine / musl libc)
RUN npx prisma generate

# ──────────────────────────────────────────────
# Stage 2 : runner
# Image minimale : pas de réinstallation réseau.
# ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Backend : modules (avec Prisma CLI pour les migrations au démarrage) + sources
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY backend/src                              ./backend/src
COPY backend/prisma                           ./backend/prisma

# Frontend statique servi directement par Express
COPY frontend                                 ./frontend

# Script d'initialisation : migrations puis démarrage
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
