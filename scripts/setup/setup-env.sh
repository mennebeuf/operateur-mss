#!/bin/bash
#===============================================================================
# Script: setup-env.sh
# Description: Configuration initiale de l'environnement MSSanté Opérateur
# Usage: ./scripts/setup/setup-env.sh [--env development|staging|production]
#===============================================================================

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Variables par défaut
ENV_TYPE="${1:-development}"
FORCE_OVERWRITE=false
INTERACTIVE=true

#===============================================================================
# FONCTIONS UTILITAIRES
#===============================================================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Génération de mot de passe sécurisé
generate_password() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -dc 'a-zA-Z0-9!@#$%^&*()_+-=' | head -c "$length"
}

# Génération de clé secrète (base64)
generate_secret() {
    local length="${1:-64}"
    openssl rand -base64 "$length" | tr -d '\n'
}

# Vérification des prérequis
check_prerequisites() {
    log_header "Vérification des prérequis"
    
    local missing=()
    
    # Docker
    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    else
        log_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
    fi
    
    # Docker Compose
    if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
        if ! command -v docker-compose &> /dev/null; then
            missing+=("docker-compose")
        else
            log_success "Docker Compose $(docker-compose --version | cut -d' ' -f4 | tr -d ',')"
        fi
    else
        log_success "Docker Compose $(docker compose version --short)"
    fi
    
    # OpenSSL
    if ! command -v openssl &> /dev/null; then
        missing+=("openssl")
    else
        log_success "OpenSSL $(openssl version | cut -d' ' -f2)"
    fi
    
    # Git
    if ! command -v git &> /dev/null; then
        missing+=("git")
    else
        log_success "Git $(git --version | cut -d' ' -f3)"
    fi
    
    # curl
    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    else
        log_success "curl $(curl --version | head -n1 | cut -d' ' -f2)"
    fi
    
    # jq (optionnel mais recommandé)
    if ! command -v jq &> /dev/null; then
        log_warning "jq non installé (optionnel mais recommandé)"
    else
        log_success "jq $(jq --version)"
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Prérequis manquants: ${missing[*]}"
        echo ""
        echo "Installation sur Ubuntu/Debian:"
        echo "  sudo apt update && sudo apt install -y ${missing[*]}"
        echo ""
        echo "Installation sur Rocky/CentOS:"
        echo "  sudo dnf install -y ${missing[*]}"
        exit 1
    fi
    
    log_success "Tous les prérequis sont satisfaits"
}

#===============================================================================
# CRÉATION DES RÉPERTOIRES
#===============================================================================

create_directories() {
    log_header "Création de la structure des répertoires"
    
    cd "$ROOT_DIR"
    
    # Répertoires de données
    local data_dirs=(
        "data/postgres"
        "data/redis"
        "data/mail"
        "data/mail/queue"
        "data/mail/storage"
        "data/logs"
        "data/logs/api"
        "data/logs/postfix"
        "data/logs/dovecot"
        "data/logs/traefik"
        "data/backups"
        "data/backups/postgres"
        "data/backups/mail"
        "data/prometheus"
        "data/grafana"
    )
    
    for dir in "${data_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "Créé: $dir"
        fi
    done
    
    # Répertoires de configuration
    local config_dirs=(
        "config/certificates/igc-sante"
        "config/certificates/server"
        "config/certificates/domains"
        "config/traefik"
        "config/postfix"
        "config/dovecot"
        "config/postgres"
    )
    
    for dir in "${config_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "Créé: $dir"
        fi
    done
    
    # Permissions
    chmod -R 755 data/
    chmod -R 700 config/certificates/
    chmod 700 data/postgres
    chmod 700 data/redis
    
    log_success "Structure des répertoires créée"
}

#===============================================================================
# CONFIGURATION DU FICHIER .env
#===============================================================================

setup_env_file() {
    log_header "Configuration du fichier .env"
    
    cd "$ROOT_DIR"
    
    # Vérifier si .env existe
    if [ -f ".env" ]; then
        if [ "$FORCE_OVERWRITE" = true ]; then
            log_warning "Écrasement du fichier .env existant"
            cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
        elif [ "$INTERACTIVE" = true ]; then
            echo ""
            read -p "Le fichier .env existe déjà. Écraser? (y/N): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Conservation du fichier .env existant"
                return 0
            fi
            cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
            log_info "Backup créé: .env.backup.$(date +%Y%m%d_%H%M%S)"
        else
            log_warning "Fichier .env existant conservé"
            return 0
        fi
    fi
    
    # Copier le template
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_info "Copié .env.example vers .env"
    else
        log_info "Création du fichier .env depuis zéro"
    fi
    
    # Générer les secrets
    local POSTGRES_PASSWORD=$(generate_password 32)
    local REDIS_PASSWORD=$(generate_password 32)
    local JWT_SECRET=$(generate_secret 64)
    local GRAFANA_PASSWORD=$(generate_password 24)
    local SESSION_SECRET=$(generate_secret 48)
    
    # Écrire le fichier .env
    cat > .env << EOF
#===============================================================================
# MSSANTÉ OPÉRATEUR - Configuration Environnement
# Généré le: $(date '+%Y-%m-%d %H:%M:%S')
# Type: ${ENV_TYPE}
#===============================================================================

# ===========================================
# ENVIRONNEMENT GÉNÉRAL
# ===========================================
NODE_ENV=${ENV_TYPE}
LOG_LEVEL=$([ "$ENV_TYPE" = "production" ] && echo "info" || echo "debug")
TZ=Europe/Paris

# ===========================================
# DOMAINE PRINCIPAL
# ===========================================
# ⚠️  IMPORTANT: Remplacez par votre domaine réel
DOMAIN=votre-operateur.mssante.fr

# ===========================================
# BASE DE DONNÉES POSTGRESQL
# ===========================================
POSTGRES_DB=mssante
POSTGRES_USER=mssante
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# ===========================================
# REDIS (Cache & Sessions)
# ===========================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# ===========================================
# JWT & AUTHENTIFICATION
# ===========================================
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_EXPIRES_IN=604800
SESSION_SECRET=${SESSION_SECRET}

# ===========================================
# PRO SANTÉ CONNECT (PSC)
# ===========================================
# ⚠️  Remplacez par vos identifiants PSC
PSC_CLIENT_ID=votre_client_id_psc
PSC_CLIENT_SECRET=votre_client_secret_psc
PSC_REDIRECT_URI=https://\${DOMAIN}/auth/psc/callback

# URLs PSC (Production)
PSC_AUTH_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/auth
PSC_TOKEN_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token
PSC_USERINFO_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/userinfo
PSC_LOGOUT_URL=https://auth.esw.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/logout

# URLs PSC (Test - décommentez pour environnement de test)
#PSC_AUTH_URL=https://auth.bas.esw.esante.gouv.fr/auth/realms/esante-wallet-test/protocol/openid-connect/auth
#PSC_TOKEN_URL=https://auth.bas.esw.esante.gouv.fr/auth/realms/esante-wallet-test/protocol/openid-connect/token
#PSC_USERINFO_URL=https://auth.bas.esw.esante.gouv.fr/auth/realms/esante-wallet-test/protocol/openid-connect/userinfo

# ===========================================
# ANS - OPÉRATEUR
# ===========================================
# ⚠️  Remplacez par vos identifiants ANS
OPERATOR_ID=VOTRE_ID_OPERATEUR_ANS
OPERATOR_NAME=Nom de votre structure

# Annuaire National Santé
ANNUAIRE_API_URL=https://annuaire.sante.fr/api/v1
ANNUAIRE_API_KEY=votre_cle_api_annuaire

# FINESS
FINESS_JURIDIQUE=750000001
FINESS_GEOGRAPHIQUE=750000002

# ===========================================
# SMTP/IMAP CONFIGURATION
# ===========================================
SMTP_HOST=postfix
SMTP_PORT=587
SMTP_SECURE=true

IMAP_HOST=dovecot
IMAP_PORT=143
IMAP_SECURE=true

# ===========================================
# EMAIL SETTINGS
# ===========================================
DEFAULT_FROM_EMAIL=noreply@\${DOMAIN}
ADMIN_EMAIL=admin@\${DOMAIN}
SUPPORT_EMAIL=support@\${DOMAIN}

# Limites
MAX_EMAIL_SIZE_MB=25
MAX_ATTACHMENTS=10

# ===========================================
# CERTIFICATS SSL/TLS
# ===========================================
SSL_CERT_PATH=/etc/ssl/certs/server.pem
SSL_KEY_PATH=/etc/ssl/private/server.key
IGC_SANTE_CA_PATH=/etc/ssl/igc-sante/ca-bundle.pem

# Configuration TLS
TLS_MIN_VERSION=1.2
TLS_CIPHERS=ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256

# ===========================================
# MONITORING & OBSERVABILITÉ
# ===========================================
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
PROMETHEUS_RETENTION=15d

# Alerting (optionnel)
#SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
#ALERT_EMAIL=alerts@votre-operateur.mssante.fr

# ===========================================
# API CONFIGURATION
# ===========================================
API_PORT=3000
API_HOST=0.0.0.0
API_RATE_LIMIT=100
API_RATE_LIMIT_WINDOW_MS=60000

# CORS
CORS_ORIGINS=https://\${DOMAIN},https://api.\${DOMAIN}

# ===========================================
# SÉCURITÉ
# ===========================================
# Nombre de tentatives de connexion avant blocage
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15

# Politique de mot de passe
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBER=true
PASSWORD_REQUIRE_SPECIAL=true

# ===========================================
# BACKUPS
# ===========================================
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 2 * * *"
BACKUP_PATH=/data/backups

# ===========================================
# FEATURE FLAGS
# ===========================================
ENABLE_DEBUG_LOGS=$([ "$ENV_TYPE" = "development" ] && echo "true" || echo "false")
ENABLE_SWAGGER=$([ "$ENV_TYPE" = "production" ] && echo "false" || echo "true")
ENABLE_METRICS=true
ENABLE_PROFILING=$([ "$ENV_TYPE" = "development" ] && echo "true" || echo "false")
EOF

    # Sécuriser le fichier
    chmod 600 .env
    
    log_success "Fichier .env créé avec des secrets générés automatiquement"
    
    echo ""
    log_warning "IMPORTANT: Éditez le fichier .env pour configurer:"
    echo "  - DOMAIN (votre domaine MSSanté)"
    echo "  - PSC_CLIENT_ID / PSC_CLIENT_SECRET"
    echo "  - OPERATOR_ID"
    echo "  - ANNUAIRE_API_KEY"
    echo "  - FINESS_JURIDIQUE / FINESS_GEOGRAPHIQUE"
}

#===============================================================================
# CONFIGURATION DES SERVICES
#===============================================================================

setup_service_configs() {
    log_header "Configuration des services"
    
    cd "$ROOT_DIR"
    
    # API Backend
    if [ -f "services/api/.env.example" ]; then
        if [ ! -f "services/api/.env.${ENV_TYPE}" ]; then
            cp "services/api/.env.example" "services/api/.env.${ENV_TYPE}"
            log_info "Créé: services/api/.env.${ENV_TYPE}"
        fi
    fi
    
    # Frontend
    if [ -f "services/frontend/.env.example" ]; then
        if [ ! -f "services/frontend/.env.${ENV_TYPE}" ]; then
            cp "services/frontend/.env.example" "services/frontend/.env.${ENV_TYPE}"
            log_info "Créé: services/frontend/.env.${ENV_TYPE}"
        fi
    fi
    
    # Traefik - configuration de base
    if [ ! -f "config/traefik/traefik.yml" ]; then
        cat > "config/traefik/traefik.yml" << 'EOF'
# Traefik Configuration
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: mssante-network

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com
      storage: /certificates/acme.json
      httpChallenge:
        entryPoint: web

log:
  level: INFO
  filePath: /logs/traefik.log

accessLog:
  filePath: /logs/access.log
EOF
        log_info "Créé: config/traefik/traefik.yml"
    fi
    
    log_success "Configuration des services terminée"
}

#===============================================================================
# GÉNÉRATION DE CERTIFICATS AUTO-SIGNÉS (DÉVELOPPEMENT)
#===============================================================================

generate_dev_certificates() {
    if [ "$ENV_TYPE" != "development" ]; then
        return 0
    fi
    
    log_header "Génération des certificats de développement"
    
    local cert_dir="$ROOT_DIR/config/certificates/server"
    
    if [ -f "$cert_dir/server.pem" ] && [ -f "$cert_dir/server.key" ]; then
        log_info "Certificats existants conservés"
        return 0
    fi
    
    # Générer une clé privée
    openssl genrsa -out "$cert_dir/server.key" 4096 2>/dev/null
    
    # Générer un certificat auto-signé
    openssl req -new -x509 \
        -key "$cert_dir/server.key" \
        -out "$cert_dir/server.pem" \
        -days 365 \
        -subj "/C=FR/ST=Ile-de-France/L=Paris/O=MSSante Dev/CN=localhost" \
        2>/dev/null
    
    # Permissions
    chmod 644 "$cert_dir/server.pem"
    chmod 600 "$cert_dir/server.key"
    
    log_success "Certificats auto-signés générés pour le développement"
    log_warning "Ces certificats ne doivent PAS être utilisés en production!"
}

#===============================================================================
# VÉRIFICATION FINALE
#===============================================================================

verify_setup() {
    log_header "Vérification de l'installation"
    
    cd "$ROOT_DIR"
    
    local errors=0
    
    # Vérifier .env
    if [ -f ".env" ]; then
        log_success "Fichier .env présent"
    else
        log_error "Fichier .env manquant"
        ((errors++))
    fi
    
    # Vérifier les répertoires critiques
    local required_dirs=(
        "data/postgres"
        "data/redis"
        "data/mail"
        "data/logs"
        "config/certificates"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_success "Répertoire $dir présent"
        else
            log_error "Répertoire $dir manquant"
            ((errors++))
        fi
    done
    
    # Vérifier les permissions
    if [ "$(stat -c %a data/postgres 2>/dev/null || stat -f %OLp data/postgres 2>/dev/null)" = "700" ]; then
        log_success "Permissions PostgreSQL correctes"
    else
        log_warning "Permissions PostgreSQL à vérifier (attendu: 700)"
    fi
    
    # Vérifier docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        log_success "docker-compose.yml présent"
    else
        log_warning "docker-compose.yml manquant"
    fi
    
    echo ""
    
    if [ $errors -eq 0 ]; then
        log_success "Configuration initiale terminée avec succès!"
    else
        log_error "Configuration terminée avec $errors erreur(s)"
        return 1
    fi
}

#===============================================================================
# AFFICHAGE DES PROCHAINES ÉTAPES
#===============================================================================

show_next_steps() {
    log_header "Prochaines étapes"
    
    echo ""
    echo -e "${CYAN}1. Éditez le fichier .env avec vos paramètres:${NC}"
    echo "   nano .env"
    echo ""
    echo -e "${CYAN}2. Installez vos certificats IGC Santé:${NC}"
    echo "   cp /chemin/vers/cert.pem config/certificates/server/"
    echo "   cp /chemin/vers/key.pem config/certificates/server/"
    echo "   cp /chemin/vers/ca-bundle.pem config/certificates/igc-sante/"
    echo ""
    echo -e "${CYAN}3. Démarrez les services:${NC}"
    echo "   docker compose up -d"
    echo ""
    echo -e "${CYAN}4. Initialisez la base de données:${NC}"
    echo "   docker compose exec api npm run migrate"
    echo ""
    echo -e "${CYAN}5. Créez le super administrateur:${NC}"
    echo "   docker compose exec api npm run create-admin"
    echo ""
    echo -e "${CYAN}6. Vérifiez le bon fonctionnement:${NC}"
    echo "   docker compose ps"
    echo "   curl http://localhost:3000/health"
    echo ""
    
    if [ "$ENV_TYPE" = "development" ]; then
        echo -e "${YELLOW}Mode développement activé:${NC}"
        echo "  - Logs en mode debug"
        echo "  - Swagger UI activé"
        echo "  - Certificats auto-signés"
        echo ""
    fi
    
    echo -e "${GREEN}Documentation complète: docs/guides/installation.md${NC}"
}

#===============================================================================
# AIDE
#===============================================================================

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] [ENVIRONMENT]

Configuration initiale de l'environnement MSSanté Opérateur.

ENVIRONMENT:
  development   Environnement de développement (défaut)
  staging       Environnement de pré-production
  production    Environnement de production

OPTIONS:
  -f, --force       Écraser les fichiers existants sans confirmation
  -n, --non-interactive  Mode non-interactif
  -h, --help        Afficher cette aide

EXEMPLES:
  $(basename "$0")                    # Configuration développement
  $(basename "$0") staging            # Configuration staging
  $(basename "$0") -f production      # Configuration production (force)
  $(basename "$0") -n development     # Mode non-interactif

EOF
}

#===============================================================================
# MAIN
#===============================================================================

main() {
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE_OVERWRITE=true
                shift
                ;;
            -n|--non-interactive)
                INTERACTIVE=false
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            development|staging|production)
                ENV_TYPE="$1"
                shift
                ;;
            *)
                log_error "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Affichage du header
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}║   🏥 MSSANTÉ OPÉRATEUR - Configuration Environnement      ║${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Environnement: ${GREEN}${ENV_TYPE}${NC}"
    echo -e "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Exécution des étapes
    check_prerequisites
    create_directories
    setup_env_file
    setup_service_configs
    generate_dev_certificates
    verify_setup
    show_next_steps
    
    echo ""
    log_success "Configuration terminée!"
    echo ""
}

# Exécution
main "$@"