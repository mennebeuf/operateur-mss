#!/bin/bash
#===============================================================================
# Script: restore.sh
# Description: Restauration des sauvegardes de la plateforme MSSanté
# Usage: ./scripts/backup/restore.sh [OPTIONS] <backup_source>
#
# Ce script restaure:
#   - Base de données PostgreSQL
#   - Base de données Redis
#   - Boîtes aux lettres (maildir)
#   - Fichiers de configuration
#   - Certificats SSL/TLS
#
# ATTENTION: La restauration écrasera les données existantes!
#===============================================================================

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
BACKUP_SOURCE=""
TEMP_DIR="/tmp/mssante_restore_$$"
LOG_FILE="${ROOT_DIR}/data/backups/restore.log"

# Options
RESTORE_POSTGRES="${RESTORE_POSTGRES:-true}"
RESTORE_REDIS="${RESTORE_REDIS:-true}"
RESTORE_MAIL="${RESTORE_MAIL:-true}"
RESTORE_CONFIG="${RESTORE_CONFIG:-true}"
RESTORE_CERTS="${RESTORE_CERTS:-true}"

DECRYPT_BACKUP="${DECRYPT_BACKUP:-false}"
GPG_PASSPHRASE="${GPG_PASSPHRASE:-}"
FORCE="${FORCE:-false}"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
SKIP_CONFIRMATION="${SKIP_CONFIRMATION:-false}"
STOP_SERVICES="${STOP_SERVICES:-true}"
START_SERVICES="${START_SERVICES:-true}"

# Statistiques
RESTORE_START_TIME=$(date +%s)
ERRORS=0
WARNINGS=0

#===============================================================================
# FONCTIONS UTILITAIRES
#===============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log vers fichier
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case "$level" in
        INFO)
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        SUCCESS)
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        WARNING)
            echo -e "${YELLOW}⚠️  $message${NC}"
            ((WARNINGS++))
            ;;
        ERROR)
            echo -e "${RED}❌ $message${NC}"
            ((ERRORS++))
            ;;
        DEBUG)
            if [ "$VERBOSE" = true ]; then
                echo -e "${CYAN}🔍 $message${NC}"
            fi
            ;;
        STEP)
            echo -e "${MAGENTA}➤ $message${NC}"
            ;;
    esac
}

log_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Nettoyage à la sortie
cleanup() {
    log DEBUG "Nettoyage des fichiers temporaires..."
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Vérifier si une commande existe
command_exists() {
    command -v "$1" &> /dev/null
}

# Formater la durée
format_duration() {
    local seconds=$1
    local hours=$((seconds / 3600))
    local minutes=$(((seconds % 3600) / 60))
    local secs=$((seconds % 60))
    printf "%02d:%02d:%02d" $hours $minutes $secs
}

# Demande de confirmation
confirm() {
    if [ "$SKIP_CONFIRMATION" = true ] || [ "$FORCE" = true ]; then
        return 0
    fi
    
    local message="${1:-Continuer?}"
    echo ""
    echo -e "${YELLOW}$message${NC}"
    read -p "Tapez 'yes' pour confirmer: " -r
    echo
    [[ $REPLY == "yes" ]]
}

# Créer un backup de sécurité avant restauration
create_safety_backup() {
    local component="$1"
    local safety_dir="${ROOT_DIR}/data/backups/pre_restore_$(date +%Y%m%d_%H%M%S)"
    
    mkdir -p "$safety_dir"
    
    case "$component" in
        postgres)
            log DEBUG "Backup de sécurité PostgreSQL..."
            docker compose exec -T postgres pg_dump \
                -U "${POSTGRES_USER:-mssante}" \
                -d "${POSTGRES_DB:-mssante}" \
                -Fc 2>/dev/null | gzip > "$safety_dir/postgres_safety.dump.gz" || true
            ;;
        redis)
            log DEBUG "Backup de sécurité Redis..."
            if [ -f "$ROOT_DIR/data/redis/dump.rdb" ]; then
                cp "$ROOT_DIR/data/redis/dump.rdb" "$safety_dir/redis_safety.rdb" || true
            fi
            ;;
        mail)
            log DEBUG "Backup de sécurité des mails..."
            if [ -d "$ROOT_DIR/data/mail" ]; then
                tar -czf "$safety_dir/mail_safety.tar.gz" -C "$ROOT_DIR/data" mail/ 2>/dev/null || true
            fi
            ;;
        config)
            log DEBUG "Backup de sécurité de la configuration..."
            if [ -f "$ROOT_DIR/.env" ]; then
                cp "$ROOT_DIR/.env" "$safety_dir/.env.safety" || true
            fi
            ;;
    esac
    
    echo "$safety_dir"
}

#===============================================================================
# VÉRIFICATIONS PRÉALABLES
#===============================================================================

check_prerequisites() {
    log_header "Vérifications préalables"
    
    local missing=()
    
    # Docker
    if ! command_exists docker; then
        missing+=("docker")
    fi
    
    # Décompression
    if ! command_exists gzip; then
        missing+=("gzip")
    fi
    
    if ! command_exists tar; then
        missing+=("tar")
    fi
    
    # GPG (si déchiffrement nécessaire)
    if [ "$DECRYPT_BACKUP" = true ] && ! command_exists gpg; then
        missing+=("gpg")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log ERROR "Outils manquants: ${missing[*]}"
        exit 1
    fi
    
    # Vérifier que Docker est en cours d'exécution
    if ! docker info &> /dev/null; then
        log ERROR "Docker n'est pas en cours d'exécution"
        exit 1
    fi
    
    log SUCCESS "Vérifications préalables OK"
}

#===============================================================================
# ANALYSE DU BACKUP
#===============================================================================

analyze_backup() {
    log_header "Analyse de la sauvegarde"
    
    # Créer le répertoire temporaire
    mkdir -p "$TEMP_DIR"
    
    # Déterminer le type de source
    if [ -d "$BACKUP_SOURCE" ]; then
        # C'est un répertoire de backup
        log INFO "Source: Répertoire de backup"
        BACKUP_DIR="$BACKUP_SOURCE"
        
    elif [ -f "$BACKUP_SOURCE" ]; then
        # C'est une archive
        log INFO "Source: Archive"
        
        # Extraire l'archive
        case "$BACKUP_SOURCE" in
            *.tar.gz|*.tgz)
                log STEP "Extraction de l'archive..."
                tar -xzf "$BACKUP_SOURCE" -C "$TEMP_DIR"
                ;;
            *.tar)
                log STEP "Extraction de l'archive..."
                tar -xf "$BACKUP_SOURCE" -C "$TEMP_DIR"
                ;;
            *.zip)
                log STEP "Extraction de l'archive..."
                unzip -q "$BACKUP_SOURCE" -d "$TEMP_DIR"
                ;;
            *)
                log ERROR "Format d'archive non supporté: $BACKUP_SOURCE"
                exit 1
                ;;
        esac
        
        # Trouver le répertoire extrait
        BACKUP_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d ! -name "$(basename "$TEMP_DIR")" | head -1)
        [ -z "$BACKUP_DIR" ] && BACKUP_DIR="$TEMP_DIR"
        
    else
        log ERROR "Source de backup non trouvée: $BACKUP_SOURCE"
        exit 1
    fi
    
    log INFO "Répertoire de backup: $BACKUP_DIR"
    
    # Lire le manifest si présent
    if [ -f "$BACKUP_DIR/manifest.json" ]; then
        log INFO "Manifest trouvé"
        
        if command_exists jq; then
            local backup_date=$(jq -r '.backup.date // "unknown"' "$BACKUP_DIR/manifest.json")
            local backup_type=$(jq -r '.backup.type // "unknown"' "$BACKUP_DIR/manifest.json")
            local backup_hostname=$(jq -r '.system.hostname // "unknown"' "$BACKUP_DIR/manifest.json")
            local backup_version=$(jq -r '.application.version // "unknown"' "$BACKUP_DIR/manifest.json")
            
            echo ""
            echo "┌─────────────────────────────────────────────────────────────┐"
            echo "│              INFORMATIONS DU BACKUP                        │"
            echo "├─────────────────────────────────────────────────────────────┤"
            printf "│  %-20s : %-36s │\n" "Date" "$backup_date"
            printf "│  %-20s : %-36s │\n" "Type" "$backup_type"
            printf "│  %-20s : %-36s │\n" "Hostname origine" "$backup_hostname"
            printf "│  %-20s : %-36s │\n" "Version" "$backup_version"
            echo "└─────────────────────────────────────────────────────────────┘"
            echo ""
        else
            cat "$BACKUP_DIR/manifest.json"
        fi
    else
        log WARNING "Pas de manifest trouvé - backup ancien format"
    fi
    
    # Lister les composants disponibles
    echo ""
    log INFO "Composants disponibles:"
    
    # PostgreSQL
    local pg_files=$(find "$BACKUP_DIR" -name "postgresql*.dump*" -o -name "postgresql*.sql*" -o -name "*.dump.gz" 2>/dev/null | head -1)
    if [ -n "$pg_files" ]; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL: $(basename "$pg_files")"
        PG_BACKUP_FILE="$pg_files"
    else
        echo -e "  ${RED}✗${NC} PostgreSQL: Non trouvé"
        RESTORE_POSTGRES=false
    fi
    
    # Redis
    local redis_files=$(find "$BACKUP_DIR" -name "redis*.rdb*" 2>/dev/null | head -1)
    if [ -n "$redis_files" ]; then
        echo -e "  ${GREEN}✓${NC} Redis: $(basename "$redis_files")"
        REDIS_BACKUP_FILE="$redis_files"
    else
        echo -e "  ${RED}✗${NC} Redis: Non trouvé"
        RESTORE_REDIS=false
    fi
    
    # Mail
    local mail_files=$(find "$BACKUP_DIR" -name "mail*.tar.gz" 2>/dev/null | head -1)
    if [ -n "$mail_files" ]; then
        echo -e "  ${GREEN}✓${NC} Mails: $(basename "$mail_files")"
        MAIL_BACKUP_FILE="$mail_files"
    else
        echo -e "  ${RED}✗${NC} Mails: Non trouvé"
        RESTORE_MAIL=false
    fi
    
    # Config
    local config_files=$(find "$BACKUP_DIR" -name "config*.tar.gz" 2>/dev/null | head -1)
    if [ -n "$config_files" ]; then
        echo -e "  ${GREEN}✓${NC} Configuration: $(basename "$config_files")"
        CONFIG_BACKUP_FILE="$config_files"
    else
        echo -e "  ${RED}✗${NC} Configuration: Non trouvé"
        RESTORE_CONFIG=false
    fi
    
    # Certificats
    local certs_files=$(find "$BACKUP_DIR" -name "certificates*.tar.gz" 2>/dev/null | head -1)
    if [ -n "$certs_files" ]; then
        echo -e "  ${GREEN}✓${NC} Certificats: $(basename "$certs_files")"
        CERTS_BACKUP_FILE="$certs_files"
    else
        echo -e "  ${RED}✗${NC} Certificats: Non trouvé"
        RESTORE_CERTS=false
    fi
    
    echo ""
}

#===============================================================================
# DÉCHIFFREMENT
#===============================================================================

decrypt_files() {
    if [ "$DECRYPT_BACKUP" = false ]; then
        return 0
    fi
    
    log_header "Déchiffrement des fichiers"
    
    local gpg_files=$(find "$BACKUP_DIR" -name "*.gpg" 2>/dev/null)
    
    if [ -z "$gpg_files" ]; then
        log INFO "Aucun fichier chiffré trouvé"
        return 0
    fi
    
    log STEP "Déchiffrement des fichiers GPG..."
    
    for gpg_file in $gpg_files; do
        local output_file="${gpg_file%.gpg}"
        log DEBUG "Déchiffrement: $(basename "$gpg_file")"
        
        if [ -n "$GPG_PASSPHRASE" ]; then
            echo "$GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 \
                --decrypt --output "$output_file" "$gpg_file" 2>> "$LOG_FILE"
        else
            gpg --decrypt --output "$output_file" "$gpg_file" 2>> "$LOG_FILE"
        fi
        
        # Mettre à jour les références
        case "$gpg_file" in
            *postgresql*)
                PG_BACKUP_FILE="$output_file"
                ;;
            *redis*)
                REDIS_BACKUP_FILE="$output_file"
                ;;
            *mail*)
                MAIL_BACKUP_FILE="$output_file"
                ;;
            *config*)
                CONFIG_BACKUP_FILE="$output_file"
                ;;
            *certificates*)
                CERTS_BACKUP_FILE="$output_file"
                ;;
        esac
    done
    
    log SUCCESS "Déchiffrement terminé"
}

#===============================================================================
# ARRÊT DES SERVICES
#===============================================================================

stop_services() {
    if [ "$STOP_SERVICES" = false ]; then
        log INFO "Arrêt des services ignoré"
        return 0
    fi
    
    log_header "Arrêt des services"
    
    cd "$ROOT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait arrêté les services"
        return 0
    fi
    
    log STEP "Arrêt des conteneurs..."
    
    # Arrêter l'API et le frontend d'abord
    docker compose stop api frontend 2>/dev/null || true
    
    # Attendre un peu pour les connexions en cours
    sleep 2
    
    # Arrêter les services mail
    docker compose stop postfix dovecot 2>/dev/null || true
    
    log SUCCESS "Services arrêtés"
}

#===============================================================================
# RESTAURATION POSTGRESQL
#===============================================================================

restore_postgresql() {
    if [ "$RESTORE_POSTGRES" = false ] || [ -z "${PG_BACKUP_FILE:-}" ]; then
        log DEBUG "Restauration PostgreSQL ignorée"
        return 0
    fi
    
    log_header "Restauration PostgreSQL"
    
    cd "$ROOT_DIR"
    
    # Vérifier que PostgreSQL est accessible
    if ! docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-mssante}" &> /dev/null; then
        log STEP "Démarrage de PostgreSQL..."
        docker compose up -d postgres
        sleep 5
        
        # Attendre que PostgreSQL soit prêt
        local max_wait=30
        local waited=0
        while [ $waited -lt $max_wait ]; do
            if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-mssante}" &> /dev/null; then
                break
            fi
            sleep 1
            ((waited++))
        done
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait restauré: $PG_BACKUP_FILE"
        return 0
    fi
    
    # Créer un backup de sécurité
    log STEP "Création d'un backup de sécurité..."
    local safety_dir=$(create_safety_backup "postgres")
    log DEBUG "Backup de sécurité: $safety_dir"
    
    # Préparer le fichier de restauration
    local restore_file="$PG_BACKUP_FILE"
    
    # Décompresser si nécessaire
    if [[ "$restore_file" == *.gz ]]; then
        log STEP "Décompression du dump..."
        gunzip -c "$restore_file" > "$TEMP_DIR/restore.dump"
        restore_file="$TEMP_DIR/restore.dump"
    fi
    
    # Déterminer le type de dump
    local dump_type="custom"
    if file "$restore_file" | grep -q "ASCII\|UTF-8\|SQL"; then
        dump_type="sql"
    fi
    
    log STEP "Restauration de la base de données ($dump_type)..."
    
    if [ "$dump_type" = "sql" ]; then
        # Dump SQL plain
        docker compose exec -T postgres psql \
            -U "${POSTGRES_USER:-mssante}" \
            -d "${POSTGRES_DB:-mssante}" \
            < "$restore_file" 2>> "$LOG_FILE"
    else
        # Dump format custom
        # D'abord, terminer les connexions existantes
        docker compose exec -T postgres psql \
            -U "${POSTGRES_USER:-mssante}" \
            -d postgres \
            -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB:-mssante}' AND pid <> pg_backend_pid();" \
            2>/dev/null || true
        
        # Restaurer
        cat "$restore_file" | docker compose exec -T postgres pg_restore \
            -U "${POSTGRES_USER:-mssante}" \
            -d "${POSTGRES_DB:-mssante}" \
            --clean \
            --if-exists \
            --no-owner \
            --no-privileges \
            2>> "$LOG_FILE" || {
                log WARNING "Certaines erreurs lors de la restauration (peut être normal)"
            }
    fi
    
    # Vérifier la restauration
    log STEP "Vérification de la restauration..."
    local table_count=$(docker compose exec -T postgres psql \
        -U "${POSTGRES_USER:-mssante}" \
        -d "${POSTGRES_DB:-mssante}" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
        2>/dev/null | tr -d ' ')
    
    log INFO "Tables restaurées: $table_count"
    
    # Analyser les tables pour optimiser les requêtes
    log STEP "Optimisation des tables..."
    docker compose exec -T postgres vacuumdb \
        -U "${POSTGRES_USER:-mssante}" \
        -d "${POSTGRES_DB:-mssante}" \
        --analyze \
        2>> "$LOG_FILE" || true
    
    log SUCCESS "Restauration PostgreSQL terminée"
}

#===============================================================================
# RESTAURATION REDIS
#===============================================================================

restore_redis() {
    if [ "$RESTORE_REDIS" = false ] || [ -z "${REDIS_BACKUP_FILE:-}" ]; then
        log DEBUG "Restauration Redis ignorée"
        return 0
    fi
    
    log_header "Restauration Redis"
    
    cd "$ROOT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait restauré: $REDIS_BACKUP_FILE"
        return 0
    fi
    
    # Créer un backup de sécurité
    log STEP "Création d'un backup de sécurité..."
    create_safety_backup "redis"
    
    # Arrêter Redis
    log STEP "Arrêt de Redis..."
    docker compose stop redis 2>/dev/null || true
    
    # Préparer le fichier RDB
    local rdb_file="$REDIS_BACKUP_FILE"
    
    # Décompresser si nécessaire
    if [[ "$rdb_file" == *.gz ]]; then
        log STEP "Décompression du fichier RDB..."
        gunzip -c "$rdb_file" > "$TEMP_DIR/dump.rdb"
        rdb_file="$TEMP_DIR/dump.rdb"
    fi
    
    # Copier le fichier RDB
    log STEP "Copie du fichier RDB..."
    mkdir -p "$ROOT_DIR/data/redis"
    cp "$rdb_file" "$ROOT_DIR/data/redis/dump.rdb"
    chmod 644 "$ROOT_DIR/data/redis/dump.rdb"
    
    # Redémarrer Redis
    log STEP "Redémarrage de Redis..."
    docker compose up -d redis
    
    # Attendre que Redis soit prêt
    sleep 3
    
    # Vérifier
    local redis_password="${REDIS_PASSWORD:-}"
    local redis_cmd="redis-cli"
    [ -n "$redis_password" ] && redis_cmd="redis-cli -a $redis_password"
    
    if docker compose exec -T redis $redis_cmd ping 2>/dev/null | grep -q "PONG"; then
        local keys_count=$(docker compose exec -T redis $redis_cmd DBSIZE 2>/dev/null | grep -oP '\d+' || echo "0")
        log INFO "Clés Redis restaurées: $keys_count"
        log SUCCESS "Restauration Redis terminée"
    else
        log ERROR "Redis ne répond pas après restauration"
    fi
}

#===============================================================================
# RESTAURATION DES MAILS
#===============================================================================

restore_mail() {
    if [ "$RESTORE_MAIL" = false ] || [ -z "${MAIL_BACKUP_FILE:-}" ]; then
        log DEBUG "Restauration des mails ignorée"
        return 0
    fi
    
    log_header "Restauration des boîtes aux lettres"
    
    cd "$ROOT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait restauré: $MAIL_BACKUP_FILE"
        return 0
    fi
    
    # Créer un backup de sécurité
    log STEP "Création d'un backup de sécurité..."
    create_safety_backup "mail"
    
    # Arrêter les services mail
    log STEP "Arrêt des services mail..."
    docker compose stop postfix dovecot 2>/dev/null || true
    
    # Préparer l'extraction
    log STEP "Extraction des mails..."
    
    # Sauvegarder les mails existants
    if [ -d "$ROOT_DIR/data/mail" ] && [ "$(ls -A "$ROOT_DIR/data/mail" 2>/dev/null)" ]; then
        log DEBUG "Sauvegarde des mails existants..."
        mv "$ROOT_DIR/data/mail" "$ROOT_DIR/data/mail.old.$$"
    fi
    
    # Créer le répertoire
    mkdir -p "$ROOT_DIR/data/mail"
    
    # Extraire
    tar -xzf "$MAIL_BACKUP_FILE" -C "$ROOT_DIR/data/" 2>> "$LOG_FILE"
    
    # Corriger les permissions
    log STEP "Correction des permissions..."
    chmod -R 755 "$ROOT_DIR/data/mail"
    
    # Compter les boîtes restaurées
    local mailbox_count=$(find "$ROOT_DIR/data/mail" -type d -name "cur" 2>/dev/null | wc -l)
    log INFO "Boîtes aux lettres restaurées: $mailbox_count"
    
    # Nettoyer l'ancien répertoire
    rm -rf "$ROOT_DIR/data/mail.old.$$" 2>/dev/null || true
    
    log SUCCESS "Restauration des mails terminée"
}

#===============================================================================
# RESTAURATION DE LA CONFIGURATION
#===============================================================================

restore_config() {
    if [ "$RESTORE_CONFIG" = false ] || [ -z "${CONFIG_BACKUP_FILE:-}" ]; then
        log DEBUG "Restauration de la configuration ignorée"
        return 0
    fi
    
    log_header "Restauration de la configuration"
    
    cd "$ROOT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait restauré: $CONFIG_BACKUP_FILE"
        return 0
    fi
    
    # Créer un backup de sécurité
    log STEP "Création d'un backup de sécurité..."
    create_safety_backup "config"
    
    # Extraire dans un répertoire temporaire d'abord
    log STEP "Extraction de la configuration..."
    mkdir -p "$TEMP_DIR/config_extract"
    tar -xzf "$CONFIG_BACKUP_FILE" -C "$TEMP_DIR/config_extract" 2>> "$LOG_FILE"
    
    # Restaurer le répertoire config
    if [ -d "$TEMP_DIR/config_extract/config" ]; then
        log STEP "Restauration du répertoire config/..."
        
        # Sauvegarder la config actuelle
        if [ -d "$ROOT_DIR/config" ]; then
            mv "$ROOT_DIR/config" "$ROOT_DIR/config.old.$$"
        fi
        
        cp -r "$TEMP_DIR/config_extract/config" "$ROOT_DIR/"
        rm -rf "$ROOT_DIR/config.old.$$" 2>/dev/null || true
    fi
    
    # Restaurer .env (avec précaution)
    if [ -f "$TEMP_DIR/config_extract/.env" ]; then
        log WARNING "Fichier .env trouvé dans le backup"
        
        if [ "$FORCE" = true ]; then
            log STEP "Restauration du fichier .env..."
            cp "$ROOT_DIR/.env" "$ROOT_DIR/.env.pre_restore" 2>/dev/null || true
            cp "$TEMP_DIR/config_extract/.env" "$ROOT_DIR/.env"
        else
            log INFO "Le fichier .env n'a pas été restauré (utilisez --force pour forcer)"
            log INFO "Fichier disponible dans: $TEMP_DIR/config_extract/.env"
        fi
    fi
    
    # Restaurer docker-compose.yml
    if [ -f "$TEMP_DIR/config_extract/docker-compose.yml" ]; then
        log STEP "Restauration de docker-compose.yml..."
        cp "$TEMP_DIR/config_extract/docker-compose.yml" "$ROOT_DIR/"
    fi
    
    log SUCCESS "Restauration de la configuration terminée"
}

#===============================================================================
# RESTAURATION DES CERTIFICATS
#===============================================================================

restore_certificates() {
    if [ "$RESTORE_CERTS" = false ] || [ -z "${CERTS_BACKUP_FILE:-}" ]; then
        log DEBUG "Restauration des certificats ignorée"
        return 0
    fi
    
    log_header "Restauration des certificats"
    
    cd "$ROOT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait restauré: $CERTS_BACKUP_FILE"
        return 0
    fi
    
    # Extraire dans un répertoire temporaire
    log STEP "Extraction des certificats..."
    mkdir -p "$TEMP_DIR/certs_extract"
    tar -xzf "$CERTS_BACKUP_FILE" -C "$TEMP_DIR/certs_extract" 2>> "$LOG_FILE"
    
    # Sauvegarder les certificats actuels
    if [ -d "$ROOT_DIR/config/certificates" ]; then
        log STEP "Sauvegarde des certificats actuels..."
        cp -r "$ROOT_DIR/config/certificates" "$ROOT_DIR/config/certificates.old.$$"
    fi
    
    # Restaurer
    log STEP "Restauration des certificats..."
    
    if [ -d "$TEMP_DIR/certs_extract/certificates" ]; then
        mkdir -p "$ROOT_DIR/config"
        cp -r "$TEMP_DIR/certs_extract/certificates" "$ROOT_DIR/config/"
    fi
    
    # Permissions restrictives
    chmod -R 700 "$ROOT_DIR/config/certificates"
    find "$ROOT_DIR/config/certificates" -name "*.key" -exec chmod 600 {} \;
    find "$ROOT_DIR/config/certificates" -name "*.pem" -exec chmod 644 {} \;
    
    # Vérifier les certificats restaurés
    log STEP "Vérification des certificats..."
    
    for cert in "$ROOT_DIR/config/certificates"/server/*.pem "$ROOT_DIR/config/certificates"/server/*.crt; do
        if [ -f "$cert" ]; then
            local expiry=$(openssl x509 -in "$cert" -noout -enddate 2>/dev/null | cut -d= -f2)
            if [ -n "$expiry" ]; then
                local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo 0)
                local now_epoch=$(date +%s)
                local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
                
                if [ $days_left -lt 0 ]; then
                    log ERROR "Certificat $(basename "$cert") EXPIRÉ!"
                elif [ $days_left -lt 30 ]; then
                    log WARNING "Certificat $(basename "$cert") expire dans $days_left jours"
                else
                    log DEBUG "Certificat $(basename "$cert"): valide ($days_left jours)"
                fi
            fi
        fi
    done
    
    # Nettoyer
    rm -rf "$ROOT_DIR/config/certificates.old.$$" 2>/dev/null || true
    
    log SUCCESS "Restauration des certificats terminée"
}

#===============================================================================
# REDÉMARRAGE DES SERVICES
#===============================================================================

start_services() {
    if [ "$START_SERVICES" = false ]; then
        log INFO "Redémarrage des services ignoré"
        return 0
    fi
    
    log_header "Redémarrage des services"
    
    cd "$ROOT_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait redémarré les services"
        return 0
    fi
    
    log STEP "Démarrage des services..."
    docker compose up -d
    
    # Attendre le démarrage
    log STEP "Attente du démarrage des services..."
    sleep 10
    
    # Vérifier les services
    log STEP "Vérification des services..."
    
    local services_ok=true
    
    # API
    for i in {1..30}; do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log SUCCESS "API: OK"
            break
        fi
        if [ $i -eq 30 ]; then
            log WARNING "API: Timeout"
            services_ok=false
        fi
        sleep 1
    done
    
    # PostgreSQL
    if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-mssante}" &> /dev/null; then
        log SUCCESS "PostgreSQL: OK"
    else
        log WARNING "PostgreSQL: Non accessible"
        services_ok=false
    fi
    
    # Redis
    local redis_password="${REDIS_PASSWORD:-}"
    local redis_cmd="redis-cli"
    [ -n "$redis_password" ] && redis_cmd="redis-cli -a $redis_password"
    
    if docker compose exec -T redis $redis_cmd ping 2>/dev/null | grep -q "PONG"; then
        log SUCCESS "Redis: OK"
    else
        log WARNING "Redis: Non accessible"
        services_ok=false
    fi
    
    if [ "$services_ok" = true ]; then
        log SUCCESS "Tous les services sont opérationnels"
    else
        log WARNING "Certains services nécessitent une vérification manuelle"
    fi
}

#===============================================================================
# RAPPORT FINAL
#===============================================================================

print_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - RESTORE_START_TIME))
    
    log_header "Résumé de la restauration"
    
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│                  RAPPORT DE RESTAURATION                   │"
    echo "├─────────────────────────────────────────────────────────────┤"
    printf "│  %-20s : %-36s │\n" "Date" "$(date '+%Y-%m-%d %H:%M:%S')"
    printf "│  %-20s : %-36s │\n" "Source" "$(basename "$BACKUP_SOURCE")"
    printf "│  %-20s : %-36s │\n" "Durée" "$(format_duration $duration)"
    echo "├─────────────────────────────────────────────────────────────┤"
    printf "│  %-20s : %-36s │\n" "PostgreSQL" "$RESTORE_POSTGRES"
    printf "│  %-20s : %-36s │\n" "Redis" "$RESTORE_REDIS"
    printf "│  %-20s : %-36s │\n" "Mails" "$RESTORE_MAIL"
    printf "│  %-20s : %-36s │\n" "Configuration" "$RESTORE_CONFIG"
    printf "│  %-20s : %-36s │\n" "Certificats" "$RESTORE_CERTS"
    echo "├─────────────────────────────────────────────────────────────┤"
    printf "│  %-20s : %-36s │\n" "Erreurs" "$ERRORS"
    printf "│  %-20s : %-36s │\n" "Avertissements" "$WARNINGS"
    echo "├─────────────────────────────────────────────────────────────┤"
    
    if [ $ERRORS -eq 0 ]; then
        printf "│  %-20s : ${GREEN}%-36s${NC} │\n" "Statut" "✅ SUCCÈS"
    else
        printf "│  %-20s : ${RED}%-36s${NC} │\n" "Statut" "❌ ÉCHEC ($ERRORS erreurs)"
    fi
    
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    
    if [ $ERRORS -gt 0 ]; then
        echo -e "${YELLOW}Consultez le fichier de log pour plus de détails:${NC}"
        echo "  $LOG_FILE"
        echo ""
    fi
}

#===============================================================================
# AIDE
#===============================================================================

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] <backup_source>

Restauration des sauvegardes de la plateforme MSSanté.

ARGUMENTS:
  backup_source         Répertoire de backup ou archive (.tar.gz)

OPTIONS:
  --decrypt             Déchiffrer les fichiers GPG
  --gpg-passphrase PWD  Passphrase GPG (sinon demandé interactivement)
  
  --no-postgres         Ne pas restaurer PostgreSQL
  --no-redis            Ne pas restaurer Redis
  --no-mail             Ne pas restaurer les mails
  --no-config           Ne pas restaurer la configuration
  --no-certs            Ne pas restaurer les certificats
  
  --no-stop             Ne pas arrêter les services avant restauration
  --no-start            Ne pas redémarrer les services après restauration
  
  --force, -f           Forcer la restauration (pas de confirmation)
  --dry-run             Simuler sans effectuer de restauration
  --verbose, -v         Mode verbeux
  -y, --yes             Ignorer les confirmations
  -h, --help            Afficher cette aide

EXEMPLES:
  # Restauration complète depuis un répertoire
  $(basename "$0") /backup/20240315_020000
  
  # Restauration depuis une archive
  $(basename "$0") /backup/mssante_backup_20240315.tar.gz
  
  # Restauration PostgreSQL uniquement
  $(basename "$0") --no-redis --no-mail --no-config --no-certs /backup/20240315_020000
  
  # Restauration avec déchiffrement
  $(basename "$0") --decrypt /backup/20240315_020000
  
  # Simulation
  $(basename "$0") --dry-run --verbose /backup/20240315_020000
  
  # Restauration forcée sans confirmation
  $(basename "$0") -f -y /backup/20240315_020000

ATTENTION:
  La restauration écrasera les données existantes!
  Un backup de sécurité est créé automatiquement avant chaque restauration.

EOF
}

#===============================================================================
# MAIN
#===============================================================================

main() {
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --decrypt)
                DECRYPT_BACKUP=true
                shift
                ;;
            --gpg-passphrase)
                GPG_PASSPHRASE="$2"
                shift 2
                ;;
            --no-postgres)
                RESTORE_POSTGRES=false
                shift
                ;;
            --no-redis)
                RESTORE_REDIS=false
                shift
                ;;
            --no-mail)
                RESTORE_MAIL=false
                shift
                ;;
            --no-config)
                RESTORE_CONFIG=false
                shift
                ;;
            --no-certs)
                RESTORE_CERTS=false
                shift
                ;;
            --no-stop)
                STOP_SERVICES=false
                shift
                ;;
            --no-start)
                START_SERVICES=false
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -y|--yes)
                SKIP_CONFIRMATION=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                echo "Option inconnue: $1"
                show_help
                exit 1
                ;;
            *)
                BACKUP_SOURCE="$1"
                shift
                ;;
        esac
    done
    
    # Vérifier les arguments requis
    if [ -z "$BACKUP_SOURCE" ]; then
        echo -e "${RED}Erreur: Source de backup requise${NC}"
        echo ""
        show_help
        exit 1
    fi
    
    # Charger les variables d'environnement
    if [ -f "$ROOT_DIR/.env" ]; then
        set -a
        source "$ROOT_DIR/.env"
        set +a
    fi
    
    # Créer le répertoire de log
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Header
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}║   🔄 MSSANTÉ OPÉRATEUR - Restauration                      ║${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "  Source: $BACKUP_SOURCE"
    [ "$DRY_RUN" = true ] && echo -e "  ${YELLOW}Mode: DRY-RUN (simulation)${NC}"
    echo ""
    
    # Avertissement
    if [ "$DRY_RUN" = false ]; then
        echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ⚠️  ATTENTION: Cette opération va écraser les données     ║${NC}"
        echo -e "${RED}║     existantes. Un backup de sécurité sera créé.          ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        
        if ! confirm "Êtes-vous sûr de vouloir continuer?"; then
            echo "Restauration annulée."
            exit 0
        fi
    fi
    
    # Log de démarrage
    log INFO "=== Démarrage de la restauration ==="
    log INFO "Source: $BACKUP_SOURCE"
    
    # Exécution
    check_prerequisites
    analyze_backup
    decrypt_files
    
    # Confirmation finale
    if [ "$DRY_RUN" = false ] && [ "$FORCE" = false ]; then
        echo ""
        if ! confirm "Procéder à la restauration des composants listés ci-dessus?"; then
            echo "Restauration annulée."
            exit 0
        fi
    fi
    
    stop_services
    restore_postgresql
    restore_redis
    restore_mail
    restore_config
    restore_certificates
    start_services
    print_summary
    
    # Code de retour
    if [ $ERRORS -gt 0 ]; then
        log ERROR "Restauration terminée avec $ERRORS erreur(s)"
        exit 1
    fi
    
    log SUCCESS "Restauration terminée avec succès"
    exit 0
}

# Exécution
main "$@"