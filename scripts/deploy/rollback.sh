#!/bin/bash
#
# rollback.sh - Script de rollback pour revenir à une version précédente
#
# Usage: 
#   ./rollback.sh                    # Rollback vers la dernière version stable
#   ./rollback.sh v1.2.3             # Rollback vers une version spécifique
#   ./rollback.sh --list             # Lister les backups disponibles
#
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backup/deployments}"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/mssante/rollback-$DATE.log"

# Variable pour rollback automatique (utilisé par deploy-production.sh)
ROLLBACK_AUTO="${ROLLBACK_AUTO:-false}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "$1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "$1"; }
log_info() { log "${BLUE}ℹ️  $1${NC}"; }
log_success() { log "${GREEN}✅ $1${NC}"; }
log_warning() { log "${YELLOW}⚠️  $1${NC}"; }
log_error() { log "${RED}❌ $1${NC}"; }
log_step() { log "${CYAN}📌 $1${NC}"; }

# Afficher l'aide
show_help() {
    echo "Usage: $0 [OPTIONS] [VERSION]"
    echo ""
    echo "Script de rollback pour revenir à une version précédente."
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help     Afficher cette aide"
    echo "  -l, --list     Lister les backups disponibles"
    echo "  -f, --force    Ne pas demander de confirmation"
    echo "  --service      Rollback d'un service spécifique (ex: --service api v1.2.3)"
    echo ""
    echo "EXEMPLES:"
    echo "  $0                     Rollback vers la dernière version stable"
    echo "  $0 v1.2.3              Rollback vers la version v1.2.3"
    echo "  $0 --list              Lister les backups disponibles"
    echo "  $0 --service api       Rollback uniquement le service API"
    echo ""
}

# Lister les backups disponibles
list_backups() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 BACKUPS DISPONIBLES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_warning "Aucun backup trouvé dans $BACKUP_DIR"
        exit 0
    fi
    
    echo ""
    printf "%-20s %-15s %-20s %-10s\n" "DATE" "VERSION" "TAILLE" "STATUT"
    echo "────────────────────────────────────────────────────────────────"
    
    for backup in $(ls -d "$BACKUP_DIR"/*/ 2>/dev/null | sort -r | head -20); do
        BACKUP_DATE=$(basename "$backup")
        
        # Récupérer la version
        if [ -f "$backup/version.txt" ]; then
            VERSION=$(cat "$backup/version.txt")
        elif [ -f "$backup/deployment-info.json" ]; then
            VERSION=$(grep -o '"version": *"[^"]*"' "$backup/deployment-info.json" | cut -d'"' -f4)
        else
            VERSION="N/A"
        fi
        
        # Calculer la taille
        SIZE=$(du -sh "$backup" 2>/dev/null | cut -f1)
        
        # Vérifier si complet
        if [ -f "$backup/database.sql.gz" ]; then
            STATUS="✅ Complet"
        else
            STATUS="⚠️ Partiel"
        fi
        
        printf "%-20s %-15s %-20s %-10s\n" "$BACKUP_DATE" "$VERSION" "$SIZE" "$STATUS"
    done
    
    echo ""
    echo "Dernières versions Git:"
    git tag --sort=-creatordate | head -5 | while read tag; do
        echo "  • $tag"
    done
    echo ""
}

# Trouver la dernière version stable
find_last_stable_version() {
    # Chercher dans les tags git
    LAST_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
    
    if [ -n "$LAST_TAG" ]; then
        echo "$LAST_TAG"
        return
    fi
    
    # Sinon, utiliser le dernier commit
    git rev-parse --short HEAD^
}

# Trouver le backup correspondant à une version
find_backup_for_version() {
    local target_version="$1"
    
    for backup in $(ls -d "$BACKUP_DIR"/*/ 2>/dev/null | sort -r); do
        if [ -f "$backup/version.txt" ]; then
            backup_version=$(cat "$backup/version.txt")
            if [ "$backup_version" == "$target_version" ]; then
                echo "$backup"
                return
            fi
        fi
    done
    
    # Retourner le backup le plus récent si pas de match exact
    ls -d "$BACKUP_DIR"/*/ 2>/dev/null | sort -r | head -1
}

# Rollback d'un service spécifique
rollback_service() {
    local service="$1"
    local version="$2"
    
    log_step "Rollback du service: $service vers $version"
    
    # Arrêter le service
    docker compose stop "$service"
    
    # Checkout de la version spécifique du service
    if [ -d "services/$service" ]; then
        git checkout "$version" -- "services/$service"
    fi
    
    # Rebuild
    docker compose build "$service"
    
    # Restart
    docker compose up -d "$service"
    
    log_success "Service $service restauré"
}

# Rollback complet
rollback_full() {
    local target_version="$1"
    local backup_path
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  ROLLBACK EN COURS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Version cible: $target_version"
    echo "Date: $(date)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 1. Confirmation (sauf si automatique ou forcé)
    if [ "$ROLLBACK_AUTO" != "true" ] && [ "$FORCE" != "true" ]; then
        echo ""
        log_warning "ATTENTION: Cette opération va restaurer la version $target_version"
        echo ""
        read -p "Confirmer le rollback vers $target_version? (yes/NO) " -r
        if [ "$REPLY" != "yes" ]; then
            log_error "Rollback annulé"
            exit 1
        fi
    fi
    
    # 2. Trouver le backup correspondant
    log_step "1. Recherche du backup..."
    backup_path=$(find_backup_for_version "$target_version")
    
    if [ -z "$backup_path" ] || [ ! -d "$backup_path" ]; then
        log_warning "Aucun backup trouvé, rollback uniquement via Git"
    else
        log_success "Backup trouvé: $backup_path"
    fi
    
    # 3. Activer le mode maintenance
    log_step "2. Activation du mode maintenance..."
    docker compose exec -T api touch /app/maintenance.flag 2>/dev/null || true
    sleep 5
    
    # 4. Arrêter les services
    log_step "3. Arrêt des services..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans || true
    
    # 5. Restaurer le code
    log_step "4. Restauration du code vers $target_version..."
    git fetch origin --tags
    git checkout "$target_version"
    
    # 6. Restaurer la base de données (si backup disponible)
    if [ -n "$backup_path" ] && [ -f "$backup_path/database.sql.gz" ]; then
        log_step "5. Restauration de la base de données..."
        
        # Démarrer uniquement PostgreSQL
        docker compose up -d postgres
        
        # Attendre que PostgreSQL soit prêt
        for i in {1..30}; do
            if docker compose exec -T postgres pg_isready -U mssante > /dev/null 2>&1; then
                break
            fi
            sleep 2
        done
        
        # Restaurer
        gunzip -c "$backup_path/database.sql.gz" | docker compose exec -T postgres psql -U mssante mssante
        
        log_success "Base de données restaurée"
    else
        log_warning "Pas de backup de base de données, seul le code sera restauré"
    fi
    
    # 7. Restaurer Redis (si backup disponible)
    if [ -n "$backup_path" ] && [ -f "$backup_path/redis.rdb" ]; then
        log_step "6. Restauration de Redis..."
        cp "$backup_path/redis.rdb" "$ROOT_DIR/data/redis/dump.rdb" 2>/dev/null || true
    fi
    
    # 8. Rebuild et restart
    log_step "7. Rebuild des images..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml build
    
    log_step "8. Redémarrage des services..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    # 9. Attendre le démarrage
    log_step "9. Attente du démarrage..."
    for i in {1..60}; do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log_success "API opérationnelle"
            break
        fi
        sleep 2
    done
    
    # 10. Désactiver le mode maintenance
    log_step "10. Désactivation du mode maintenance..."
    docker compose exec -T api rm -f /app/maintenance.flag 2>/dev/null || true
    
    # 11. Tests de validation
    log_step "11. Tests de validation..."
    
    local errors=0
    
    if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        log_error "API health check échoué"
        errors=$((errors + 1))
    fi
    
    if ! docker compose exec -T postgres pg_isready -U mssante > /dev/null 2>&1; then
        log_error "PostgreSQL non accessible"
        errors=$((errors + 1))
    fi
    
    if [ $errors -gt 0 ]; then
        log_error "Validation échouée. Vérifiez les logs: docker compose logs"
        exit 1
    fi
    
    # 12. Résumé
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ ROLLBACK TERMINÉ"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Version restaurée: $target_version"
    echo "Date: $(date)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 État des services:"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📋 Actions recommandées:"
    echo "   • Vérifier les logs: docker compose logs -f"
    echo "   • Tester les fonctionnalités critiques"
    echo "   • Analyser la cause du problème initial"
    echo ""
}

# Gestion des erreurs
handle_error() {
    log_error "Une erreur est survenue pendant le rollback!"
    log_info "Intervention manuelle requise."
    log_info "Vérifiez les logs: docker compose logs"
    exit 1
}

trap handle_error ERR

# Parsing des arguments
FORCE=false
SERVICE=""
TARGET_VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -l|--list)
            list_backups
            exit 0
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        --service)
            SERVICE="$2"
            shift 2
            ;;
        *)
            TARGET_VERSION="$1"
            shift
            ;;
    esac
done

# Créer le répertoire de logs
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Exécution principale
if [ -n "$SERVICE" ]; then
    # Rollback d'un service spécifique
    if [ -z "$TARGET_VERSION" ]; then
        TARGET_VERSION=$(find_last_stable_version)
    fi
    rollback_service "$SERVICE" "$TARGET_VERSION"
else
    # Rollback complet
    if [ -z "$TARGET_VERSION" ]; then
        TARGET_VERSION=$(find_last_stable_version)
        log_info "Aucune version spécifiée, utilisation de: $TARGET_VERSION"
    fi
    rollback_full "$TARGET_VERSION"
fi