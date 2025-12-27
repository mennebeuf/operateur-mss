#!/bin/bash
#===============================================================================
# Script: cleanup-logs.sh
# Description: Nettoyage et rotation des logs de la plateforme MSSanté
# Usage: ./scripts/maintenance/cleanup-logs.sh [--dry-run] [--force]
# Planification recommandée: cron quotidien à 03h00
#===============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="${LOG_DIR:-/var/log/mssante}"
DATA_LOG_DIR="${DATA_LOG_DIR:-$ROOT_DIR/data/logs}"
ARCHIVE_DIR="${ARCHIVE_DIR:-$ROOT_DIR/data/logs/archives}"
DATE=$(date +%Y%m%d_%H%M%S)

# Paramètres de rétention (en jours)
RETENTION_LOGS=30          # Logs applicatifs
RETENTION_ACCESS=90        # Logs d'accès (audit)
RETENTION_MAIL=60          # Logs mail (Postfix/Dovecot)
RETENTION_ARCHIVES=180     # Archives compressées
RETENTION_DOCKER=7         # Logs Docker

# Seuils d'alerte
DISK_WARNING_THRESHOLD=80  # Pourcentage d'utilisation disque

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Options
DRY_RUN=false
FORCE=false
VERBOSE=false

#-------------------------------------------------------------------------------
# Fonctions utilitaires
#-------------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Nettoyage et rotation des logs de la plateforme MSSanté.

Options:
  --dry-run     Affiche les actions sans les exécuter
  --force       Force le nettoyage sans confirmation
  --verbose     Mode verbeux
  -h, --help    Affiche cette aide

Variables d'environnement:
  LOG_DIR           Répertoire des logs système (défaut: /var/log/mssante)
  DATA_LOG_DIR      Répertoire des logs applicatifs (défaut: ./data/logs)
  ARCHIVE_DIR       Répertoire des archives (défaut: ./data/logs/archives)

Rétention configurée:
  - Logs applicatifs: ${RETENTION_LOGS} jours
  - Logs d'accès: ${RETENTION_ACCESS} jours
  - Logs mail: ${RETENTION_MAIL} jours
  - Archives: ${RETENTION_ARCHIVES} jours
  - Logs Docker: ${RETENTION_DOCKER} jours

Exemples:
  $(basename "$0")              # Exécution normale
  $(basename "$0") --dry-run    # Simulation
  $(basename "$0") --force      # Sans confirmation
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

execute() {
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] $*"
    else
        if [ "$VERBOSE" = true ]; then
            log_info "Exécution: $*"
        fi
        eval "$@"
    fi
}

bytes_to_human() {
    local bytes=$1
    if [ "$bytes" -ge 1073741824 ]; then
        echo "$(echo "scale=2; $bytes/1073741824" | bc) GB"
    elif [ "$bytes" -ge 1048576 ]; then
        echo "$(echo "scale=2; $bytes/1048576" | bc) MB"
    elif [ "$bytes" -ge 1024 ]; then
        echo "$(echo "scale=2; $bytes/1024" | bc) KB"
    else
        echo "$bytes B"
    fi
}

#-------------------------------------------------------------------------------
# Fonctions de nettoyage
#-------------------------------------------------------------------------------

check_disk_usage() {
    log_info "Vérification de l'utilisation disque..."
    
    local usage
    usage=$(df "$DATA_LOG_DIR" 2>/dev/null | awk 'NR==2 {print $5}' | tr -d '%')
    
    if [ -n "$usage" ]; then
        if [ "$usage" -ge "$DISK_WARNING_THRESHOLD" ]; then
            log_warning "Utilisation disque élevée: ${usage}%"
        else
            log_success "Utilisation disque: ${usage}%"
        fi
    fi
}

get_size_before() {
    local dir=$1
    if [ -d "$dir" ]; then
        du -sb "$dir" 2>/dev/null | cut -f1
    else
        echo 0
    fi
}

cleanup_application_logs() {
    log_info "🧹 Nettoyage des logs applicatifs (>${RETENTION_LOGS} jours)..."
    
    local dirs=("$DATA_LOG_DIR" "$LOG_DIR")
    local patterns=("*.log" "*.log.*" "app-*.log")
    local total_deleted=0
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            for pattern in "${patterns[@]}"; do
                local count
                count=$(find "$dir" -maxdepth 2 -name "$pattern" -type f -mtime +${RETENTION_LOGS} 2>/dev/null | wc -l)
                if [ "$count" -gt 0 ]; then
                    execute "find '$dir' -maxdepth 2 -name '$pattern' -type f -mtime +${RETENTION_LOGS} -delete"
                    total_deleted=$((total_deleted + count))
                fi
            done
        fi
    done
    
    log_success "Logs applicatifs: $total_deleted fichiers supprimés"
}

cleanup_access_logs() {
    log_info "🔐 Nettoyage des logs d'accès (>${RETENTION_ACCESS} jours)..."
    
    local dirs=("$DATA_LOG_DIR/access" "$LOG_DIR/access" "$DATA_LOG_DIR/audit")
    local total_deleted=0
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            local count
            count=$(find "$dir" -type f -mtime +${RETENTION_ACCESS} 2>/dev/null | wc -l)
            if [ "$count" -gt 0 ]; then
                execute "find '$dir' -type f -mtime +${RETENTION_ACCESS} -delete"
                total_deleted=$((total_deleted + count))
            fi
        fi
    done
    
    log_success "Logs d'accès: $total_deleted fichiers supprimés"
}

cleanup_mail_logs() {
    log_info "📧 Nettoyage des logs mail (>${RETENTION_MAIL} jours)..."
    
    local dirs=("$DATA_LOG_DIR/mail" "$LOG_DIR/mail" "/var/log/mail")
    local patterns=("mail.log*" "postfix-*.log*" "dovecot-*.log*")
    local total_deleted=0
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            for pattern in "${patterns[@]}"; do
                local count
                count=$(find "$dir" -name "$pattern" -type f -mtime +${RETENTION_MAIL} 2>/dev/null | wc -l)
                if [ "$count" -gt 0 ]; then
                    execute "find '$dir' -name '$pattern' -type f -mtime +${RETENTION_MAIL} -delete"
                    total_deleted=$((total_deleted + count))
                fi
            done
        fi
    done
    
    log_success "Logs mail: $total_deleted fichiers supprimés"
}

cleanup_docker_logs() {
    log_info "🐳 Nettoyage des logs Docker (>${RETENTION_DOCKER} jours)..."
    
    # Nettoyage via Docker
    if command -v docker &> /dev/null; then
        # Truncate les logs des conteneurs en cours d'exécution
        local containers
        containers=$(docker ps -q 2>/dev/null)
        
        if [ -n "$containers" ]; then
            for container in $containers; do
                local log_path
                log_path=$(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null)
                if [ -f "$log_path" ]; then
                    local size
                    size=$(stat -c%s "$log_path" 2>/dev/null || echo 0)
                    # Truncate si > 100MB
                    if [ "$size" -gt 104857600 ]; then
                        log_info "Truncate du log du conteneur $(docker inspect --format='{{.Name}}' "$container")"
                        execute "truncate -s 0 '$log_path'"
                    fi
                fi
            done
        fi
        
        # Nettoyage des logs de conteneurs arrêtés
        execute "docker container prune -f --filter 'until=${RETENTION_DOCKER}d'" 2>/dev/null || true
    fi
    
    log_success "Logs Docker nettoyés"
}

cleanup_archives() {
    log_info "📦 Nettoyage des archives (>${RETENTION_ARCHIVES} jours)..."
    
    if [ -d "$ARCHIVE_DIR" ]; then
        local count
        count=$(find "$ARCHIVE_DIR" -name "*.gz" -o -name "*.tar.gz" -o -name "*.zip" -type f -mtime +${RETENTION_ARCHIVES} 2>/dev/null | wc -l)
        
        if [ "$count" -gt 0 ]; then
            execute "find '$ARCHIVE_DIR' \( -name '*.gz' -o -name '*.tar.gz' -o -name '*.zip' \) -type f -mtime +${RETENTION_ARCHIVES} -delete"
        fi
        
        log_success "Archives: $count fichiers supprimés"
    fi
}

compress_old_logs() {
    log_info "🗜️ Compression des logs anciens (>1 jour)..."
    
    mkdir -p "$ARCHIVE_DIR"
    
    local dirs=("$DATA_LOG_DIR" "$LOG_DIR")
    local total_compressed=0
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            # Compresser les fichiers .log de plus d'1 jour non compressés
            while IFS= read -r -d '' file; do
                if [ -f "$file" ] && [[ ! "$file" =~ \.gz$ ]]; then
                    execute "gzip -9 '$file'"
                    total_compressed=$((total_compressed + 1))
                fi
            done < <(find "$dir" -maxdepth 2 -name "*.log.*" -type f -mtime +1 ! -name "*.gz" -print0 2>/dev/null)
        fi
    done
    
    log_success "Fichiers compressés: $total_compressed"
}

cleanup_empty_dirs() {
    log_info "📁 Suppression des répertoires vides..."
    
    local dirs=("$DATA_LOG_DIR" "$ARCHIVE_DIR")
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            execute "find '$dir' -type d -empty -delete" 2>/dev/null || true
        fi
    done
    
    log_success "Répertoires vides supprimés"
}

run_logrotate() {
    log_info "🔄 Exécution de logrotate..."
    
    if [ -f "/etc/logrotate.d/mssante" ]; then
        execute "logrotate -f /etc/logrotate.d/mssante"
        log_success "Logrotate exécuté"
    else
        log_warning "Configuration logrotate non trouvée: /etc/logrotate.d/mssante"
    fi
}

generate_report() {
    local size_before=$1
    local size_after=$2
    local freed=$((size_before - size_after))
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "📊 RAPPORT DE NETTOYAGE - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  Taille avant:     $(bytes_to_human "$size_before")"
    echo "  Taille après:     $(bytes_to_human "$size_after")"
    echo "  Espace libéré:    $(bytes_to_human "$freed")"
    echo ""
    
    check_disk_usage
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    
    if [ "$DRY_RUN" = true ]; then
        echo ""
        log_warning "Mode DRY-RUN: aucune action n'a été effectuée"
    fi
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------

main() {
    parse_args "$@"
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          🧹 NETTOYAGE DES LOGS MSSANTÉ                       ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "Mode DRY-RUN activé - aucune modification ne sera effectuée"
        echo ""
    fi
    
    # Confirmation si pas en mode force
    if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
        read -p "Voulez-vous procéder au nettoyage des logs? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Opération annulée"
            exit 0
        fi
    fi
    
    # Créer les répertoires si nécessaire
    mkdir -p "$DATA_LOG_DIR" "$ARCHIVE_DIR"
    
    # Mesure de la taille avant
    local size_before
    size_before=$(get_size_before "$DATA_LOG_DIR")
    
    # Exécution des nettoyages
    cleanup_application_logs
    cleanup_access_logs
    cleanup_mail_logs
    cleanup_docker_logs
    cleanup_archives
    compress_old_logs
    cleanup_empty_dirs
    run_logrotate
    
    # Mesure de la taille après
    local size_after
    size_after=$(get_size_before "$DATA_LOG_DIR")
    
    # Rapport final
    generate_report "$size_before" "$size_after"
    
    log_success "✅ Nettoyage terminé"
}

main "$@"
