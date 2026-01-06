# ===========================================
# Frontend MSSanté - Dockerfile Multi-stage
# ===========================================

# -----------------------------
# Stage 1: Build
# -----------------------------
FROM node:20-alpine AS builder

# Arguments de build
ARG REACT_APP_API_URL
ARG REACT_APP_PSC_CLIENT_ID
ARG REACT_APP_ENV=production

# Variables d'environnement pour le build
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_PSC_CLIENT_ID=$REACT_APP_PSC_CLIENT_ID
ENV REACT_APP_ENV=$REACT_APP_ENV

# Répertoire de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm ci --only=production=false

# Copie du code source
COPY . .

# Build de l'application
RUN npm run build

# -----------------------------
# Stage 2: Production
# -----------------------------
FROM nginx:1.25-alpine AS production

# Labels
LABEL maintainer="MSSanté Operator <admin@mssante.fr>"
LABEL description="Frontend React pour la plateforme MSSanté"
LABEL version="1.0.0"

# Installation de curl pour le healthcheck
RUN apk add --no-cache curl

# Suppression de la configuration par défaut
RUN rm -rf /usr/share/nginx/html/*
RUN rm /etc/nginx/conf.d/default.conf

# Copie des fichiers buildés
COPY --from=builder /app/build /usr/share/nginx/html

# Copie de la configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Script d'injection des variables d'environnement au runtime
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Création des répertoires nécessaires et permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid && \
    chmod -R 755 /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Port exposé
EXPOSE 80

# Utilisateur non-root
USER nginx

# Entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Commande de démarrage
CMD ["nginx", "-g", "daemon off;"]