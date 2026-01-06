#!/bin/sh
# ===========================================
# Docker Entrypoint - Frontend MSSanté
# ===========================================
# Ce script permet d'injecter des variables d'environnement
# au runtime dans l'application React buildée

set -e

# Fichier de configuration runtime
CONFIG_FILE="/usr/share/nginx/html/config.js"

# Génération du fichier de configuration runtime
echo "window.__RUNTIME_CONFIG__ = {" > $CONFIG_FILE
echo "  API_URL: \"${REACT_APP_API_URL:-/api/v1}\"," >> $CONFIG_FILE
echo "  PSC_CLIENT_ID: \"${REACT_APP_PSC_CLIENT_ID:-}\"," >> $CONFIG_FILE
echo "  PSC_AUTHORIZATION_URL: \"${REACT_APP_PSC_AUTHORIZATION_URL:-https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth}\"," >> $CONFIG_FILE
echo "  OPERATOR_NAME: \"${REACT_APP_OPERATOR_NAME:-MSSanté Operator}\"," >> $CONFIG_FILE
echo "  OPERATOR_DOMAIN: \"${REACT_APP_OPERATOR_DOMAIN:-}\"," >> $CONFIG_FILE
echo "  ENV: \"${REACT_APP_ENV:-production}\"," >> $CONFIG_FILE
echo "  VERSION: \"${REACT_APP_VERSION:-1.0.0}\"" >> $CONFIG_FILE
echo "};" >> $CONFIG_FILE

echo "✓ Configuration runtime générée: $CONFIG_FILE"

# Démarrer Nginx
exec "$@"