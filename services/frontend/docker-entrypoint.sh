#!/bin/sh
# =============================================================================
# Script d'entrée pour le Frontend React
# Permet d'injecter les variables d'environnement au runtime
# =============================================================================

set -e

# Répertoire des fichiers statiques
STATIC_DIR="/usr/share/nginx/html"

# Créer le fichier de configuration runtime
cat > ${STATIC_DIR}/config.js << EOF
window._env_ = {
  REACT_APP_API_URL: "${REACT_APP_API_URL:-http://localhost:3000}",
  REACT_APP_PSC_CLIENT_ID: "${REACT_APP_PSC_CLIENT_ID:-}",
  REACT_APP_PSC_REDIRECT_URI: "${REACT_APP_PSC_REDIRECT_URI:-}",
  REACT_APP_DOMAIN: "${DOMAIN:-localhost}"
};
EOF

echo "Configuration runtime générée:"
cat ${STATIC_DIR}/config.js

# Exécuter la commande passée en argument (nginx)
exec "$@"