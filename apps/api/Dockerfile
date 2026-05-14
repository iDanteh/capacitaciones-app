# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos del workspace (para aprovechar cache de capas)
COPY package.json package-lock.json turbo.json ./

# Copiar packages compartidos
COPY packages/ ./packages/

# Copiar solo el package.json del api (antes del source — mejor cache)
COPY apps/api/package.json ./apps/api/

# Instalar todas las dependencias (incluyendo devDeps para el build)
RUN npm ci

# Copiar el source code
COPY apps/api/ ./apps/api/

# Compilar TypeScript → JavaScript
RUN npm run build -w api

# ── Stage 2: Runner (imagen de producción minimal) ────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Usuario sin privilegios para mayor seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar solo lo necesario para producción
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/package-lock.json* ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev && npm cache clean --force

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/main"]
