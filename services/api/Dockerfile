# =============================================================================
# Dockerfile - API Backend MSSanté (Node.js)
# =============================================================================

# Stage 1: Dependencies (production only)
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# Stage 2: Development
FROM node:20-alpine AS development

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "run", "dev"]

# =============================================================================
# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Installer curl pour health check et tini pour init
RUN apk add --no-cache curl tini

# Copier les dépendances de production
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY package*.json ./
COPY src ./src

# Créer les répertoires nécessaires
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Utiliser l'utilisateur non-root
USER nodejs

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "src/server.js"]