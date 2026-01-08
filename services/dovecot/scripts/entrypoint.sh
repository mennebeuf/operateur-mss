#!/bin/bash
# =============================================================================
# Script d'entrée Dovecot MSSanté
# =============================================================================

set -e

echo "=== Démarrage Dovecot MSSanté ==="

# Variables par défaut
DOMAIN="${DOMAIN:-localhost}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-mssante}"
POSTGRES_USER="${POSTGRES_USER:-mssante}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# Attendre PostgreSQL
echo "Attente de PostgreSQL..."
until nc -z "$POSTGRES_HOST" 5432; do
    echo "PostgreSQL non disponible, attente..."
    sleep 2
done
echo "PostgreSQL disponible!"

# Remplacer les variables dans la configuration SQL
echo "Configuration de la connexion PostgreSQL..."
DOVECOT_SQL_CONF="/etc/dovecot/dovecot-sql.conf.ext"

if [ -f "$DOVECOT_SQL_CONF" ]; then
    sed -i "s/{{POSTGRES_HOST}}/${POSTGRES_HOST}/g" "$DOVECOT_SQL_CONF"
    sed -i "s/{{POSTGRES_DB}}/${POSTGRES_DB}/g" "$DOVECOT_SQL_CONF"
    sed -i "s/{{POSTGRES_USER}}/${POSTGRES_USER}/g" "$DOVECOT_SQL_CONF"
    sed -i "s/{{POSTGRES_PASSWORD}}/${POSTGRES_PASSWORD}/g" "$DOVECOT_SQL_CONF"
    echo "  - Configuration SQL mise à jour"
fi

# Vérifier les certificats TLS
if [ -f "/etc/ssl/certs/mssante/server.crt" ] && [ -f "/etc/ssl/certs/mssante/server.key" ]; then
    echo "Certificats TLS trouvés, activation..."
    
    # Mettre à jour la configuration SSL
    cat > /etc/dovecot/conf.d/10-ssl.conf << EOF
ssl = yes
ssl_cert = </etc/ssl/certs/mssante/server.crt
ssl_key = </etc/ssl/certs/mssante/server.key
ssl_min_protocol = TLSv1.2
ssl_cipher_list = HIGH:!aNULL:!MD5:!3DES
ssl_prefer_server_ciphers = yes
EOF

    # Ajouter le CA bundle si présent
    if [ -f "/etc/ssl/igc-sante/ca-bundle.pem" ]; then
        echo "ssl_ca = </etc/ssl/igc-sante/ca-bundle.pem" >> /etc/dovecot/conf.d/10-ssl.conf
    fi
else
    echo "ATTENTION: Certificats TLS non trouvés, SSL désactivé"
    cat > /etc/dovecot/conf.d/10-ssl.conf << EOF
ssl = no
EOF
fi

# Créer les répertoires de mail
echo "Configuration des répertoires mail..."
mkdir -p /var/mail/vhosts
chown -R vmail:vmail /var/mail/vhosts
chmod 770 /var/mail/vhosts

# Créer le répertoire de run
mkdir -p /var/run/dovecot
chown -R root:dovecot /var/run/dovecot
chmod 755 /var/run/dovecot

# Vérifier la configuration
echo "Vérification de la configuration Dovecot..."
doveconf -n > /dev/null || {
    echo "ERREUR: Configuration Dovecot invalide"
    doveconf -n
    exit 1
}

echo "=== Configuration Dovecot terminée ==="
doveconf -n | grep -E "^(ssl|mail_location|auth_mechanisms)"

# Démarrer via supervisord
exec "$@"