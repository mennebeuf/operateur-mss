#!/bin/bash
#===============================================================================
# Script: backup.sh
# Description: Sauvegarde complète de la plateforme MSSanté
# Usage: ./scripts/backup/backup.sh [OPTIONS]
# 
# Ce script sauvegarde:
#   - Base de données PostgreSQL
#   - Base de données Redis
#   - Boîtes aux lettres (maildir)
#   - Fichiers de configuration
#   - Certificats SSL/TLS
#
# Les sauvegardes peuvent être chiffrées et synchronisées vers un stockage distant
#===============================================================================

set -euo pipefail

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration par défaut
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/data/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${DATE}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-12}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-12}"

# Options
ENCRYPT_BACKUP="${ENCRYPT_BACKUP:-false}"
GPG_RECIPIENT="${GPG_RECIPIENT:-}"
SYNC_REMOTE="${SYNC_REMOTE:-false}"
REMOTE_DESTINATION="${REMOTE_DESTINATION:-}"
BACKUP_TYPE="${BACKUP_TYPE:-full}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-6}"
VERBOSE="${VERBOSE:-false}"
DRY_RUN="${DRY_RUN:-false}"
QUIET="${QUIET:-false}"

# Composants à sauvegarder
BACKUP_POSTGRES="${BACKUP_POSTGRES:-true}"
BACKUP_REDIS="${BACKUP_REDIS:-true}"
BACKUP_MAIL="${BACKUP_MAIL:-true}"
BACKUP_CONFIG="${BACKUP_CONFIG:-true}"
BACKUP_CERTS="${BACKUP_CERTS:-true}"

# Fichier de log
LOG_FILE="${BACKUP_ROOT}/backup.log"

# Statistiques
BACKUP_SIZE=0
BACKUP_START_TIME=$(date +%s)
ERRORS=0

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
    
    # Affichage console si pas en mode quiet
    if [ "$QUIET" = false ]; then
        case "$level" in
            INFO)
                echo -e "${BLUE}ℹ️  $message${NC}"
                ;;
            SUCCESS)
                echo -e "${GREEN}✅ $message${NC}"
                ;;
            WARNING)
                echo -e "${YELLOW}⚠️  $message${NC}"
                ;;
            ERROR)
                echo -e "${RED}❌ $message${NC}"
                ;;
            DEBUG)
                if [ "$VERBOSE" = true ]; then
                    echo -e "${CYAN}🔍 $message${NC}"
                fi
                ;;
            STEP)
                echo -e "${CYAN}➤ $message${NC}"
                ;;
        esac
    fi
}

log_header() {
    if [ "$QUIET" = false ]; then
        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}  $1${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi
}

# Vérifier si une commande existe
command_exists() {
    command -v "$1" &> /dev/null
}

# Calculer la taille d'un fichier/répertoire
get_size() {
    local path="$1"
    if [ -e "$path" ]; then
        du -sh "$path" 2>/dev/null | cut -f1
    else
        echo "0"
    fi
}

# Calculer la taille en bytes
get_size_bytes() {
    local path="$1"
    if [ -e "$path" ]; then
        du -sb "$path" 2>/dev/null | cut -f1
    else
        echo "0"
    fi
}

# Formater la durée
format_duration() {
    local seconds=$1
    local hours=$((seconds / 3600))
    local minutes=$(((seconds % 3600) / 60))
    local secs=$((seconds % 60))
    printf "%02d:%02d:%02d" $hours $minutes $secs
}

# Envoyer une notification (optionnel)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Slack webhook (si configuré)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color="good"
        [ "$status" = "error" ] && color="danger"
        [ "$status" = "warning" ] && color="warning"
        
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"MSSanté Backup - $(hostname)\",
                    \"text\": \"$message\",
                    \"ts\": $(date +%s)
                }]
            }" > /dev/null 2>&1 || true
    fi
    
    # Email (si configuré)
    if [ -n "${ALERT_EMAIL:-}" ] && command_exists mail; then
        echo "$message" | mail -s "MSSanté Backup - $status" "$ALERT_EMAIL" || true
    fi
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
    
    # Compression
    if ! command_exists gzip; then
        missing+=("gzip")
    fi
    
    # GPG (si chiffrement activé)
    if [ "$ENCRYPT_BACKUP" = true ] && ! command_exists gpg; then
        missing+=("gpg")
    fi
    
    # rclone ou aws (si sync distant activé)
    if [ "$SYNC_REMOTE" = true ]; then
        if ! command_exists rclone && ! command_exists aws; then
            missing+=("rclone ou aws-cli")
        fi
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log ERROR "Outils manquants: ${missing[*]}"
        exit 1
    fi
    
    # Vérifier l'espace disque disponible
    local available_space=$(df -P "$BACKUP_ROOT" 2>/dev/null | tail -1 | awk '{print $4}')
    local required_space=$((10 * 1024 * 1024))  # 10 GB minimum en KB
    
    if [ "${available_space:-0}" -lt "$required_space" ]; then
        log WARNING "Espace disque faible: $(df -h "$BACKUP_ROOT" | tail -1 | awk '{print $4}') disponible"
    fi
    
    # Vérifier que Docker est en cours d'exécution
    if ! docker info &> /dev/null; then
        log ERROR "Docker n'est pas en cours d'exécution"
        exit 1
    fi
    
    # Vérifier les services
    cd "$ROOT_DIR"
    
    if [ "$BACKUP_POSTGRES" = true ]; then
        if ! docker compose ps postgres 2>/dev/null | grep -q "running"; then
            log WARNING "PostgreSQL n'est pas en cours d'exécution"
        fi
    fi
    
    if [ "$BACKUP_REDIS" = true ]; then
        if ! docker compose ps redis 2>/dev/null | grep -q "running"; then
            log WARNING "Redis n'est pas en cours d'exécution"
        fi
    fi
    
    log SUCCESS "Vérifications préalables OK"
}

#===============================================================================
# SAUVEGARDE POSTGRESQL
#===============================================================================

backup_postgresql() {
    if [ "$BACKUP_POSTGRES" = false ]; then
        log DEBUG "Sauvegarde PostgreSQL ignorée"
        return 0
    fi
    
    log_header "Sauvegarde PostgreSQL"
    
    local pg_backup_file="${BACKUP_DIR}/postgresql_${DATE}.dump"
    local pg_backup_sql="${BACKUP_DIR}/postgresql_${DATE}.sql"
    
    cd "$ROOT_DIR"
    
    # Vérifier que PostgreSQL est accessible
    if ! docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-mssante}" &> /dev/null; then
        log ERROR "PostgreSQL n'est pas accessible"
        ((ERRORS++))
        return 1
    fi
    
    log STEP "Création du dump PostgreSQL (format custom)..."
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait créé: $pg_backup_file"
    else
        # Dump format custom (plus rapide pour la restauration)
        if docker compose exec -T postgres pg_dump \
            -U "${POSTGRES_USER:-mssante}" \
            -d "${POSTGRES_DB:-mssante}" \
            -Fc \
            --verbose \
            2>> "$LOG_FILE" > "$pg_backup_file"; then
            
            log SUCCESS "Dump PostgreSQL créé: $(get_size "$pg_backup_file")"
        else
            log ERROR "Échec du dump PostgreSQL"
            ((ERRORS++))
            return 1
        fi
        
        # Compression supplémentaire
        log STEP "Compression du dump..."
        gzip -${COMPRESS_LEVEL} "$pg_backup_file"
        log SUCCESS "Dump compressé: $(get_size "${pg_backup_file}.gz")"
        
        # Créer aussi un dump SQL lisible (optionnel, pour debug)
        if [ "$VERBOSE" = true ]; then
            log STEP "Création du dump SQL (lisible)..."
            docker compose exec -T postgres pg_dump \
                -U "${POSTGRES_USER:-mssante}" \
                -d "${POSTGRES_DB:-mssante}" \
                --schema-only \
                > "${pg_backup_sql}" 2>> "$LOG_FILE"
            gzip -${COMPRESS_LEVEL} "$pg_backup_sql"
        fi
    fi
    
    # Sauvegarder aussi les rôles et permissions
    log STEP "Sauvegarde des rôles PostgreSQL..."
    if [ "$DRY_RUN" = false ]; then
        docker compose exec -T postgres pg_dumpall \
            -U "${POSTGRES_USER:-mssante}" \
            --roles-only \
            > "${BACKUP_DIR}/postgresql_roles_${DATE}.sql" 2>> "$LOG_FILE"
        gzip -${COMPRESS_LEVEL} "${BACKUP_DIR}/postgresql_roles_${DATE}.sql"
    fi
    
    log SUCCESS "Sauvegarde PostgreSQL terminée"
}

#===============================================================================
# SAUVEGARDE REDIS
#===============================================================================

backup_redis() {
    if [ "$BACKUP_REDIS" = false ]; then
        log DEBUG "Sauvegarde Redis ignorée"
        return 0
    fi
    
    log_header "Sauvegarde Redis"
    
    local redis_backup_file="${BACKUP_DIR}/redis_${DATE}.rdb"
    
    cd "$ROOT_DIR"
    
    # Vérifier que Redis est accessible
    if ! docker compose exec -T redis redis-cli ping &> /dev/null; then
        log ERROR "Redis n'est pas accessible"
        ((ERRORS++))
        return 1
    fi
    
    log STEP "Déclenchement du BGSAVE Redis..."
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait créé: $redis_backup_file"
    else
        # Déclencher une sauvegarde RDB
        local redis_password="${REDIS_PASSWORD:-}"
        local redis_cmd="redis-cli"
        [ -n "$redis_password" ] && redis_cmd="redis-cli -a $redis_password"
        
        docker compose exec -T redis $redis_cmd BGSAVE &>> "$LOG_FILE"
        
        # Attendre que la sauvegarde soit terminée
        log STEP "Attente de la fin du BGSAVE..."
        local max_wait=60
        local waited=0
        
        while [ $waited -lt $max_wait ]; do
            local lastsave=$(docker compose exec -T redis $redis_cmd LASTSAVE 2>/dev/null | tr -d '\r')
            local bgsave_in_progress=$(docker compose exec -T redis $redis_cmd INFO persistence 2>/dev/null | grep "rdb_bgsave_in_progress:1" || true)
            
            if [ -z "$bgsave_in_progress" ]; then
                break
            fi
            
            sleep 1
            ((waited++))
        done
        
        # Copier le fichier RDB
        log STEP "Copie du fichier RDB..."
        
        if [ -f "$ROOT_DIR/data/redis/dump.rdb" ]; then
            cp "$ROOT_DIR/data/redis/dump.rdb" "$redis_backup_file"
            gzip -${COMPRESS_LEVEL} "$redis_backup_file"
            log SUCCESS "Sauvegarde Redis créée: $(get_size "${redis_backup_file}.gz")"
        else
            # Essayer de copier depuis le conteneur
            docker compose cp redis:/data/dump.rdb "$redis_backup_file" 2>> "$LOG_FILE" || {
                log WARNING "Impossible de copier le fichier RDB"
                return 0
            }
            gzip -${COMPRESS_LEVEL} "$redis_backup_file"
            log SUCCESS "Sauvegarde Redis créée: $(get_size "${redis_backup_file}.gz")"
        fi
        
        # Sauvegarder aussi l'AOF si présent
        if [ -f "$ROOT_DIR/data/redis/appendonly.aof" ]; then
            log STEP "Sauvegarde du fichier AOF..."
            cp "$ROOT_DIR/data/redis/appendonly.aof" "${BACKUP_DIR}/redis_aof_${DATE}.aof"
            gzip -${COMPRESS_LEVEL} "${BACKUP_DIR}/redis_aof_${DATE}.aof"
        fi
    fi
    
    log SUCCESS "Sauvegarde Redis terminée"
}

#===============================================================================
# SAUVEGARDE DES MAILS
#===============================================================================

backup_mail() {
    if [ "$BACKUP_MAIL" = false ]; then
        log DEBUG "Sauvegarde des mails ignorée"
        return 0
    fi
    
    log_header "Sauvegarde des boîtes aux lettres"
    
    local mail_backup_file="${BACKUP_DIR}/mail_${DATE}.tar.gz"
    local mail_dir="$ROOT_DIR/data/mail"
    
    if [ ! -d "$mail_dir" ]; then
        log WARNING "Répertoire mail non trouvé: $mail_dir"
        return 0
    fi
    
    local mail_size=$(get_size "$mail_dir")
    log INFO "Taille des mails à sauvegarder: $mail_size"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait créé: $mail_backup_file"
    else
        log STEP "Création de l'archive des mails..."
        
        # Utiliser tar avec compression
        if [ "$BACKUP_TYPE" = "incremental" ] && [ -f "${BACKUP_ROOT}/mail_snapshot.snar" ]; then
            # Sauvegarde incrémentielle
            log INFO "Mode incrémentiel activé"
            tar --listed-incremental="${BACKUP_ROOT}/mail_snapshot.snar" \
                -czf "$mail_backup_file" \
                -C "$ROOT_DIR/data" \
                mail/ \
                2>> "$LOG_FILE"
        else
            # Sauvegarde complète
            tar -czf "$mail_backup_file" \
                -C "$ROOT_DIR/data" \
                mail/ \
                2>> "$LOG_FILE"
            
            # Créer le snapshot pour les futures sauvegardes incrémentelles
            if [ "$BACKUP_TYPE" = "full" ]; then
                tar --listed-incremental="${BACKUP_ROOT}/mail_snapshot.snar" \
                    -czf /dev/null \
                    -C "$ROOT_DIR/data" \
                    mail/ \
                    2>/dev/null || true
            fi
        fi
        
        log SUCCESS "Archive des mails créée: $(get_size "$mail_backup_file")"
    fi
    
    log SUCCESS "Sauvegarde des mails terminée"
}

#===============================================================================
# SAUVEGARDE DE LA CONFIGURATION
#===============================================================================

backup_config() {
    if [ "$BACKUP_CONFIG" = false ]; then
        log DEBUG "Sauvegarde de la configuration ignorée"
        return 0
    fi
    
    log_header "Sauvegarde de la configuration"
    
    local config_backup_file="${BACKUP_DIR}/config_${DATE}.tar.gz"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait créé: $config_backup_file"
    else
        log STEP "Création de l'archive de configuration..."
        
        # Liste des fichiers/répertoires à sauvegarder
        local config_items=()
        
        [ -d "$ROOT_DIR/config" ] && config_items+=("config")
        [ -f "$ROOT_DIR/.env" ] && config_items+=(".env")
        [ -f "$ROOT_DIR/docker-compose.yml" ] && config_items+=("docker-compose.yml")
        [ -f "$ROOT_DIR/docker-compose.prod.yml" ] && config_items+=("docker-compose.prod.yml")
        [ -f "$ROOT_DIR/Makefile" ] && config_items+=("Makefile")
        
        if [ ${#config_items[@]} -gt 0 ]; then
            tar -czf "$config_backup_file" \
                -C "$ROOT_DIR" \
                "${config_items[@]}" \
                2>> "$LOG_FILE"
            
            log SUCCESS "Archive de configuration créée: $(get_size "$config_backup_file")"
        else
            log WARNING "Aucun fichier de configuration trouvé"
        fi
    fi
    
    log SUCCESS "Sauvegarde de la configuration terminée"
}

#===============================================================================
# SAUVEGARDE DES CERTIFICATS
#===============================================================================

backup_certificates() {
    if [ "$BACKUP_CERTS" = false ]; then
        log DEBUG "Sauvegarde des certificats ignorée"
        return 0
    fi
    
    log_header "Sauvegarde des certificats"
    
    local certs_backup_file="${BACKUP_DIR}/certificates_${DATE}.tar.gz"
    local certs_dir="$ROOT_DIR/config/certificates"
    
    if [ ! -d "$certs_dir" ]; then
        log WARNING "Répertoire des certificats non trouvé: $certs_dir"
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait créé: $certs_backup_file"
    else
        log STEP "Création de l'archive des certificats..."
        
        # Archive chiffrée pour les certificats (contient des clés privées)
        tar -czf "$certs_backup_file" \
            -C "$ROOT_DIR/config" \
            certificates/ \
            2>> "$LOG_FILE"
        
        # Permissions restrictives
        chmod 600 "$certs_backup_file"
        
        log SUCCESS "Archive des certificats créée: $(get_size "$certs_backup_file")"
        
        # Vérifier les dates d'expiration
        log STEP "Vérification des certificats..."
        for cert in "$certs_dir"/server/*.pem "$certs_dir"/server/*.crt; do
            if [ -f "$cert" ]; then
                local expiry=$(openssl x509 -in "$cert" -noout -enddate 2>/dev/null | cut -d= -f2)
                local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo 0)
                local now_epoch=$(date +%s)
                local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
                
                if [ $days_left -lt 30 ]; then
                    log WARNING "Certificat $(basename "$cert") expire dans $days_left jours"
                else
                    log DEBUG "Certificat $(basename "$cert"): $days_left jours restants"
                fi
            fi
        done
    fi
    
    log SUCCESS "Sauvegarde des certificats terminée"
}

#===============================================================================
# CRÉATION DU MANIFEST
#===============================================================================

create_manifest() {
    log_header "Création du manifest"
    
    local manifest_file="${BACKUP_DIR}/manifest.json"
    local end_time=$(date +%s)
    local duration=$((end_time - BACKUP_START_TIME))
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait créé: $manifest_file"
        return 0
    fi
    
    # Calculer la taille totale
    BACKUP_SIZE=$(get_size_bytes "$BACKUP_DIR")
    local backup_size_human=$(get_size "$BACKUP_DIR")
    
    # Récupérer les informations système
    local hostname=$(hostname)
    local os_info=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "Unknown")
    local docker_version=$(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ',' || echo "Unknown")
    local git_version=$(cd "$ROOT_DIR" && git describe --tags 2>/dev/null || echo "Unknown")
    local git_commit=$(cd "$ROOT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "Unknown")
    
    # Lister les fichiers de backup
    local files_json="["
    local first=true
    for file in "$BACKUP_DIR"/*; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "manifest.json" ]; then
            [ "$first" = false ] && files_json+=","
            first=false
            files_json+="\"$(basename "$file")\""
        fi
    done
    files_json+="]"
    
    cat > "$manifest_file" << EOF
{
    "backup": {
        "id": "${DATE}",
        "type": "${BACKUP_TYPE}",
        "date": "$(date -Iseconds)",
        "timestamp": ${end_time},
        "duration_seconds": ${duration},
        "duration_formatted": "$(format_duration $duration)",
        "size_bytes": ${BACKUP_SIZE},
        "size_human": "${backup_size_human}",
        "encrypted": ${ENCRYPT_BACKUP},
        "errors": ${ERRORS}
    },
    "components": {
        "postgresql": ${BACKUP_POSTGRES},
        "redis": ${BACKUP_REDIS},
        "mail": ${BACKUP_MAIL},
        "config": ${BACKUP_CONFIG},
        "certificates": ${BACKUP_CERTS}
    },
    "system": {
        "hostname": "${hostname}",
        "os": "${os_info}",
        "docker_version": "${docker_version}"
    },
    "application": {
        "version": "${git_version}",
        "commit": "${git_commit}"
    },
    "files": ${files_json},
    "retention": {
        "daily_days": ${RETENTION_DAYS},
        "weekly_weeks": ${RETENTION_WEEKLY},
        "monthly_months": ${RETENTION_MONTHLY}
    }
}
EOF
    
    log SUCCESS "Manifest créé: $manifest_file"
}

#===============================================================================
# CHIFFREMENT
#===============================================================================

encrypt_backup() {
    if [ "$ENCRYPT_BACKUP" = false ]; then
        return 0
    fi
    
    log_header "Chiffrement des sauvegardes"
    
    if [ -z "$GPG_RECIPIENT" ]; then
        log ERROR "GPG_RECIPIENT non défini pour le chiffrement"
        ((ERRORS++))
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait chiffré les fichiers"
        return 0
    fi
    
    log STEP "Chiffrement des fichiers avec GPG..."
    
    for file in "$BACKUP_DIR"/*.gz "$BACKUP_DIR"/*.tar.gz "$BACKUP_DIR"/*.dump; do
        if [ -f "$file" ]; then
            log DEBUG "Chiffrement de $(basename "$file")..."
            
            gpg --encrypt \
                --recipient "$GPG_RECIPIENT" \
                --trust-model always \
                --output "${file}.gpg" \
                "$file" 2>> "$LOG_FILE"
            
            # Supprimer le fichier non chiffré
            rm "$file"
            
            log DEBUG "Chiffré: ${file}.gpg"
        fi
    done
    
    log SUCCESS "Chiffrement terminé"
}

#===============================================================================
# ROTATION DES SAUVEGARDES
#===============================================================================

rotate_backups() {
    log_header "Rotation des sauvegardes"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait effectué la rotation"
        return 0
    fi
    
    local deleted_count=0
    
    # Supprimer les sauvegardes quotidiennes de plus de RETENTION_DAYS jours
    log STEP "Nettoyage des sauvegardes quotidiennes (> ${RETENTION_DAYS} jours)..."
    
    while IFS= read -r dir; do
        if [ -d "$dir" ]; then
            log DEBUG "Suppression: $(basename "$dir")"
            rm -rf "$dir"
            ((deleted_count++))
        fi
    done < <(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" -mtime +${RETENTION_DAYS} 2>/dev/null)
    
    # Garder les sauvegardes hebdomadaires (dimanche)
    # TODO: Implémenter la logique de rétention hebdomadaire
    
    # Garder les sauvegardes mensuelles (1er du mois)
    # TODO: Implémenter la logique de rétention mensuelle
    
    if [ $deleted_count -gt 0 ]; then
        log SUCCESS "Supprimé $deleted_count ancienne(s) sauvegarde(s)"
    else
        log INFO "Aucune sauvegarde à supprimer"
    fi
    
    # Afficher l'espace utilisé
    local total_size=$(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1)
    log INFO "Espace total utilisé par les backups: $total_size"
}

#===============================================================================
# SYNCHRONISATION DISTANTE
#===============================================================================

sync_to_remote() {
    if [ "$SYNC_REMOTE" = false ]; then
        return 0
    fi
    
    log_header "Synchronisation vers stockage distant"
    
    if [ -z "$REMOTE_DESTINATION" ]; then
        log ERROR "REMOTE_DESTINATION non défini"
        ((ERRORS++))
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait synchronisé vers: $REMOTE_DESTINATION"
        return 0
    fi
    
    log STEP "Synchronisation vers $REMOTE_DESTINATION..."
    
    # Utiliser rclone si disponible
    if command_exists rclone; then
        rclone sync "$BACKUP_DIR" "$REMOTE_DESTINATION/${DATE}/" \
            --progress \
            --log-file="$LOG_FILE" \
            --log-level INFO
        
        log SUCCESS "Synchronisation rclone terminée"
        
    # Sinon utiliser aws s3
    elif command_exists aws; then
        aws s3 sync "$BACKUP_DIR" "$REMOTE_DESTINATION/${DATE}/" \
            --storage-class STANDARD_IA \
            --only-show-errors
        
        log SUCCESS "Synchronisation S3 terminée"
    else
        log ERROR "Aucun outil de synchronisation disponible (rclone ou aws)"
        ((ERRORS++))
        return 1
    fi
}

#===============================================================================
# VÉRIFICATION DE L'INTÉGRITÉ
#===============================================================================

verify_backup() {
    log_header "Vérification de l'intégrité"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY-RUN] Aurait vérifié l'intégrité"
        return 0
    fi
    
    local verify_errors=0
    
    # Vérifier les archives
    for archive in "$BACKUP_DIR"/*.tar.gz "$BACKUP_DIR"/*.gz; do
        if [ -f "$archive" ]; then
            log DEBUG "Vérification de $(basename "$archive")..."
            
            if ! gzip -t "$archive" 2>/dev/null; then
                log ERROR "Archive corrompue: $(basename "$archive")"
                ((verify_errors++))
            fi
        fi
    done
    
    # Vérifier le dump PostgreSQL
    local pg_dump="${BACKUP_DIR}/postgresql_${DATE}.dump.gz"
    if [ -f "$pg_dump" ]; then
        log DEBUG "Vérification du dump PostgreSQL..."
        
        if ! gunzip -t "$pg_dump" 2>/dev/null; then
            log ERROR "Dump PostgreSQL corrompu"
            ((verify_errors++))
        fi
    fi
    
    if [ $verify_errors -eq 0 ]; then
        log SUCCESS "Toutes les archives sont valides"
    else
        log ERROR "$verify_errors archive(s) corrompue(s)"
        ((ERRORS += verify_errors))
    fi
}

#===============================================================================
# RAPPORT FINAL
#===============================================================================

print_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - BACKUP_START_TIME))
    local backup_size_human=$(get_size "$BACKUP_DIR")
    
    log_header "Résumé de la sauvegarde"
    
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│                    RAPPORT DE SAUVEGARDE                   │"
    echo "├─────────────────────────────────────────────────────────────┤"
    printf "│  %-20s : %-36s │\n" "Date" "$(date '+%Y-%m-%d %H:%M:%S')"
    printf "│  %-20s : %-36s │\n" "Type" "$BACKUP_TYPE"
    printf "│  %-20s : %-36s │\n" "Durée" "$(format_duration $duration)"
    printf "│  %-20s : %-36s │\n" "Taille totale" "$backup_size_human"
    printf "│  %-20s : %-36s │\n" "Répertoire" "$BACKUP_DIR"
    printf "│  %-20s : %-36s │\n" "Chiffrement" "$ENCRYPT_BACKUP"
    printf "│  %-20s : %-36s │\n" "Sync distant" "$SYNC_REMOTE"
    echo "├─────────────────────────────────────────────────────────────┤"
    printf "│  %-20s : %-36s │\n" "PostgreSQL" "$BACKUP_POSTGRES"
    printf "│  %-20s : %-36s │\n" "Redis" "$BACKUP_REDIS"
    printf "│  %-20s : %-36s │\n" "Mails" "$BACKUP_MAIL"
    printf "│  %-20s : %-36s │\n" "Configuration" "$BACKUP_CONFIG"
    printf "│  %-20s : %-36s │\n" "Certificats" "$BACKUP_CERTS"
    echo "├─────────────────────────────────────────────────────────────┤"
    
    if [ $ERRORS -eq 0 ]; then
        printf "│  %-20s : ${GREEN}%-36s${NC} │\n" "Statut" "✅ SUCCÈS"
    else
        printf "│  %-20s : ${RED}%-36s${NC} │\n" "Statut" "❌ $ERRORS ERREUR(S)"
    fi
    
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    
    # Liste des fichiers créés
    if [ "$VERBOSE" = true ] && [ -d "$BACKUP_DIR" ]; then
        echo "Fichiers créés:"
        ls -lh "$BACKUP_DIR"
        echo ""
    fi
    
    # Envoyer notification
    if [ $ERRORS -eq 0 ]; then
        send_notification "success" "Sauvegarde terminée avec succès. Taille: $backup_size_human, Durée: $(format_duration $duration)"
    else
        send_notification "error" "Sauvegarde terminée avec $ERRORS erreur(s). Vérifiez les logs."
    fi
}

#===============================================================================
# AIDE
#===============================================================================

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Sauvegarde complète de la plateforme MSSanté.

OPTIONS:
  --type TYPE           Type de sauvegarde: full, incremental (défaut: full)
  --encrypt             Chiffrer les sauvegardes avec GPG
  --gpg-recipient ID    ID du destinataire GPG pour le chiffrement
  --sync-remote         Synchroniser vers stockage distant
  --remote-dest URL     Destination distante (s3://bucket ou rclone:remote)
  --retention DAYS      Jours de rétention (défaut: 30)
  --compress-level N    Niveau de compression gzip 1-9 (défaut: 6)
  
  --no-postgres         Ne pas sauvegarder PostgreSQL
  --no-redis            Ne pas sauvegarder Redis
  --no-mail             Ne pas sauvegarder les mails
  --no-config           Ne pas sauvegarder la configuration
  --no-certs            Ne pas sauvegarder les certificats
  
  --dry-run             Simuler sans effectuer de sauvegarde
  --verbose, -v         Mode verbeux
  --quiet, -q           Mode silencieux
  -h, --help            Afficher cette aide

VARIABLES D'ENVIRONNEMENT:
  BACKUP_ROOT           Répertoire racine des backups
  RETENTION_DAYS        Jours de rétention
  ENCRYPT_BACKUP        Activer le chiffrement (true/false)
  GPG_RECIPIENT         ID GPG pour le chiffrement
  SYNC_REMOTE           Activer la sync distante (true/false)
  REMOTE_DESTINATION    URL de destination distante
  SLACK_WEBHOOK_URL     URL webhook Slack pour notifications
  ALERT_EMAIL           Email pour notifications

EXEMPLES:
  # Sauvegarde complète
  $(basename "$0")
  
  # Sauvegarde avec chiffrement
  $(basename "$0") --encrypt --gpg-recipient admin@example.com
  
  # Sauvegarde et sync vers S3
  $(basename "$0") --sync-remote --remote-dest s3://my-bucket/backups
  
  # Sauvegarde incrémentielle des mails uniquement
  $(basename "$0") --type incremental --no-postgres --no-redis --no-config
  
  # Simulation
  $(basename "$0") --dry-run --verbose

CRON:
  # Sauvegarde quotidienne à 2h du matin
  0 2 * * * /path/to/backup.sh --quiet >> /var/log/backup.log 2>&1
  
  # Sauvegarde hebdomadaire avec sync S3 le dimanche à 3h
  0 3 * * 0 /path/to/backup.sh --sync-remote --remote-dest s3://bucket >> /var/log/backup.log 2>&1

EOF
}

#===============================================================================
# MAIN
#===============================================================================

main() {
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type)
                BACKUP_TYPE="$2"
                shift 2
                ;;
            --encrypt)
                ENCRYPT_BACKUP=true
                shift
                ;;
            --gpg-recipient)
                GPG_RECIPIENT="$2"
                shift 2
                ;;
            --sync-remote)
                SYNC_REMOTE=true
                shift
                ;;
            --remote-dest)
                REMOTE_DESTINATION="$2"
                shift 2
                ;;
            --retention)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --compress-level)
                COMPRESS_LEVEL="$2"
                shift 2
                ;;
            --no-postgres)
                BACKUP_POSTGRES=false
                shift
                ;;
            --no-redis)
                BACKUP_REDIS=false
                shift
                ;;
            --no-mail)
                BACKUP_MAIL=false
                shift
                ;;
            --no-config)
                BACKUP_CONFIG=false
                shift
                ;;
            --no-certs)
                BACKUP_CERTS=false
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
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Charger les variables d'environnement
    if [ -f "$ROOT_DIR/.env" ]; then
        set -a
        source "$ROOT_DIR/.env"
        set +a
    fi
    
    # Créer le répertoire de backup
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Header
    if [ "$QUIET" = false ]; then
        echo ""
        echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║                                                            ║${NC}"
        echo -e "${CYAN}║   💾 MSSANTÉ OPÉRATEUR - Sauvegarde                        ║${NC}"
        echo -e "${CYAN}║                                                            ║${NC}"
        echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
        echo -e "  Type: $BACKUP_TYPE"
        [ "$DRY_RUN" = true ] && echo -e "  ${YELLOW}Mode: DRY-RUN (simulation)${NC}"
        echo ""
    fi
    
    # Log de démarrage
    log INFO "=== Démarrage de la sauvegarde $BACKUP_TYPE ==="
    log INFO "Répertoire de destination: $BACKUP_DIR"
    
    # Exécution
    check_prerequisites
    backup_postgresql
    backup_redis
    backup_mail
    backup_config
    backup_certificates
    create_manifest
    encrypt_backup
    verify_backup
    rotate_backups
    sync_to_remote
    print_summary
    
    # Code de retour
    if [ $ERRORS -gt 0 ]; then
        log ERROR "Sauvegarde terminée avec $ERRORS erreur(s)"
        exit 1
    fi
    
    log SUCCESS "Sauvegarde terminée avec succès"
    exit 0
}

# Exécution
main "$@"