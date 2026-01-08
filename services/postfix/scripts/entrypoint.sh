#!/bin/bash
# =============================================================================
# Script d'entrée Postfix MSSanté
# =============================================================================

set -e

echo "=== Démarrage Postfix MSSanté ==="

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

# Configurer le hostname
echo "Configuration du hostname: mail.${DOMAIN}"
postconf -e "myhostname=mail.${DOMAIN}"
postconf -e "mydomain=${DOMAIN}"

# Remplacer les variables dans les fichiers de configuration SQL
echo "Configuration des connexions PostgreSQL..."
for file in /etc/postfix/sql/*.cf; do
    if [ -f "$file" ]; then
        sed -i "s/{{POSTGRES_HOST}}/${POSTGRES_HOST}/g" "$file"
        sed -i "s/{{POSTGRES_DB}}/${POSTGRES_DB}/g" "$file"
        sed -i "s/{{POSTGRES_USER}}/${POSTGRES_USER}/g" "$file"
        sed -i "s/{{POSTGRES_PASSWORD}}/${POSTGRES_PASSWORD}/g" "$file"
        echo "  - Configuré: $file"
    fi
done

# Vérifier les certificats TLS
if [ -f "/etc/ssl/certs/mssante/server.crt" ] && [ -f "/etc/ssl/certs/mssante/server.key" ]; then
    echo "Certificats TLS trouvés, activation..."
    postconf -e "smtpd_tls_cert_file=/etc/ssl/certs/mssante/server.crt"
    postconf -e "smtpd_tls_key_file=/etc/ssl/certs/mssante/server.key"
    postconf -e "smtpd_tls_security_level=may"
    postconf -e "smtp_tls_security_level=may"
else
    echo "ATTENTION: Certificats TLS non trouvés, TLS désactivé"
    postconf -e "smtpd_tls_security_level=none"
fi

# Vérifier le CA bundle IGC Santé
if [ -f "/etc/ssl/igc-sante/ca-bundle.pem" ]; then
    echo "CA Bundle IGC Santé trouvé..."
    postconf -e "smtpd_tls_CAfile=/etc/ssl/igc-sante/ca-bundle.pem"
fi

# Créer les répertoires de mail
mkdir -p /var/mail/vhosts
chown -R postfix:postfix /var/mail/vhosts

# Générer les tables
echo "Génération des tables Postfix..."
postmap /etc/postfix/sql/pgsql-virtual-domains.cf 2>/dev/null || true
postmap /etc/postfix/sql/pgsql-virtual-mailboxes.cf 2>/dev/null || true
postmap /etc/postfix/sql/pgsql-virtual-aliases.cf 2>/dev/null || true

# Vérifier la configuration
echo "Vérification de la configuration Postfix..."
postfix check || {
    echo "ERREUR: Configuration Postfix invalide"
    postconf -n
    exit 1
}

echo "=== Configuration Postfix terminée ==="
postconf -n | grep -E "^(myhostname|mydomain|virtual_)"

# Démarrer via supervisord
exec "$@"