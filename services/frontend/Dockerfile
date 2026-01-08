# =============================================================================
# Dockerfile - Frontend MSSanté (React)
# =============================================================================
# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci && npm cache clean --force

# =============================================================================
# Stage 2: Development
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Commande de développement
CMD ["npm", "start"]

# =============================================================================
# Stage 3: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Arguments de build pour les variables d'environnement
ARG REACT_APP_API_URL
ARG REACT_APP_PSC_CLIENT_ID

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_PSC_CLIENT_ID=$REACT_APP_PSC_CLIENT_ID

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build de production
RUN npm run build

# =============================================================================
# Stage 4: Production (Nginx)
FROM nginx:1.25-alpine AS production

# Installer curl pour health check
RUN apk add --no-cache curl

# Supprimer la config par défaut
RUN rm /etc/nginx/conf.d/default.conf

# Copier la configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=builder /app/build /usr/share/nginx/html

# Créer un utilisateur non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Script d'injection des variables d'environnement au runtime
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Utiliser l'utilisateur non-root
USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]