# =============================================================================
# Dockerfile - API Backend MSSanté (Node.js)
# =============================================================================
# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# Stage 2: Development
FROM node:20-alpine AS development

WORKDIR /app

# Installer les outils de développement
RUN apk add --no-cache curl

# Copier les dépendances
COPY package*.json ./
RUN npm install

# Copier le code source
COPY . .

# Exposer le port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Commande de développement avec hot-reload
CMD ["npm", "run", "dev"]

# =============================================================================
# Stage 3: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build si nécessaire (TypeScript, etc.)
RUN npm run build --if-present

# =============================================================================
# Stage 4: Production
FROM node:20-alpine AS production

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Installer curl pour health check
RUN apk add --no-cache curl tini

# Copier les dépendances de production
COPY --from=deps /app/node_modules ./node_modules

# Copier le code buildé
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./

# Créer les répertoires nécessaires
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Utiliser l'utilisateur non-root
USER nodejs

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000

# Exposer le port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Utiliser tini comme init
ENTRYPOINT ["/sbin/tini", "--"]

# Démarrer l'application
CMD ["node", "src/index.js"]