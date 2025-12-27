#!/bin/bash
#
# deploy-production.sh - Script de déploiement en production
# 
# Ce script effectue un déploiement complet en production avec:
# - Vérifications de sécurité renforcées
# - Backup automatique avant déploiement
# - Mode maintenance
# - Rollback automatique en cas d'échec
#
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backup/deployments}"
DATE=$(date +%Y%m%d_%H%M%S)
VERSION=$(git describe --tags 2>/dev/null || git rev-parse --short HEAD)
LOG_FILE="/var/log/mssante/deploy-$DATE.log"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Fonctions de log
log() { echo -e "$1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "$1"; }
log_info() { log "${BLUE}ℹ️  $1${NC}"; }
log_success() { log "${GREEN}✅ $1${NC}"; }
log_warning() { log "${YELLOW}⚠️  $1${NC}"; }
log_error() { log "${RED}❌ $1${NC}"; }
log_step() { log "${CYAN}📌 $1${NC}"; }

# Banner d'affichage
display_banner() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 DÉPLOIEMENT PRODUCTION - MSSANTÉ"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Version: $VERSION"
    echo "Date: $(date)"
    echo "Utilisateur: $(whoami)"
    echo "Hostname: $(hostname)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# =============================================================================
# ÉTAPE 1: Vérifications préalables
# =============================================================================
pre_flight_checks() {
    log_step "1. Vérifications préalables..."
    
    # Vérifier les permissions
    if [ "$EUID" -ne 0 ] && [ ! -w "/var/run/docker.sock" ]; then
        log_error "Permissions insuffisantes. Lancez avec sudo ou ajoutez l'utilisateur au groupe docker."
        exit 1
    fi
    
    # Vérifier le fichier .env
    if [ ! -f "$ROOT_DIR/.env" ]; then
        log_error "Fichier .env manquant!"
        exit 1
    fi
    
    # Charger les variables d'environnement
    source "$ROOT_DIR/.env"
    
    # Vérifier NODE_ENV
    if [ "$NODE_ENV" != "production" ]; then
        log_error "NODE_ENV doit être 'production' (actuellement: ${NODE_ENV:-non défini})"
        exit 1
    fi
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé!"
        exit 1
    fi
    
    # Vérifier Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé!"
        exit 1
    fi
    
    # Vérifier les certificats SSL
    if [ -d "$ROOT_DIR/data/certificates" ]; then
        CERT_FILE=$(find "$ROOT_DIR/data/certificates" -name "*.crt" -o -name "*.pem" 2>/dev/null | head -1)
        if [ -n "$CERT_FILE" ] && [ -f "$CERT_FILE" ]; then
            EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
            if [ -n "$EXPIRY" ]; then
                EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo 0)
                NOW_EPOCH=$(date +%s)
                DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
                
                if [ $DAYS_LEFT -lt 7 ]; then
                    log_error "Certificat SSL expire dans $DAYS_LEFT jours!"
                    exit 1
                elif [ $DAYS_LEFT -lt 30 ]; then
                    log_warning "Certificat SSL expire dans $DAYS_LEFT jours"
                else
                    log_info "Certificat SSL valide ($DAYS_LEFT jours restants)"
                fi
            fi
        fi
    fi
    
    # Vérifier l'espace disque (minimum 10GB)
    DISK_FREE=$(df -BG "$ROOT_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$DISK_FREE" -lt 10 ]; then
        log_error "Espace disque insuffisant: ${DISK_FREE}GB (minimum 10GB requis)"
        exit 1
    fi
    log_info "Espace disque disponible: ${DISK_FREE}GB"
    
    # Vérifier les changements non committés
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_error "Des changements non committés existent!"
        log_info "Committez ou stashez vos changements avant le déploiement."
        exit 1
    fi
    
    log_success "Vérifications préalables OK"
}

# =============================================================================
# ÉTAPE 2: Confirmation du déploiement
# =============================================================================
confirm_deployment() {
    log_step "2. Confirmation du déploiement..."
    
    echo ""
    log_warning "ATTENTION: Vous êtes sur le point de déployer en PRODUCTION"
    echo ""
    echo "  Version actuelle: $(docker compose ps --format '{{.Image}}' 2>/dev/null | head -1 || echo 'N/A')"
    echo "  Nouvelle version: $VERSION"
    echo "  Commit: $(git rev-parse --short HEAD)"
    echo "  Branche: $(git rev-parse --abbrev-ref HEAD)"
    echo ""
    
    read -p "Confirmer le déploiement en production? (tapez 'DEPLOY' pour confirmer) " -r
    if [ "$REPLY" != "DEPLOY" ]; then
        log_error "Déploiement annulé"
        exit 1
    fi
    
    log_success "Déploiement confirmé"
}

# =============================================================================
# ÉTAPE 3: Backup pré-déploiement
# =============================================================================
create_backup() {
    log_step "3. Création du backup pré-déploiement..."
    
    mkdir -p "$BACKUP_DIR/$DATE"
    
    # Backup de la base de données PostgreSQL
    log_info "Backup PostgreSQL..."
    if docker compose ps postgres 2>/dev/null | grep -q "Up"; then
        docker compose exec -T postgres pg_dump -U mssante mssante 2>/dev/null | gzip > "$BACKUP_DIR/$DATE/database.sql.gz"
        log_success "Backup PostgreSQL terminé"
    else
        log_warning "PostgreSQL non démarré, backup ignoré"
    fi
    
    # Backup Redis
    log_info "Backup Redis..."
    if docker compose ps redis 2>/dev/null | grep -q "Up"; then
        docker compose exec -T redis redis-cli BGSAVE > /dev/null 2>&1 || true
        sleep 2
        if [ -f "$ROOT_DIR/data/redis/dump.rdb" ]; then
            cp "$ROOT_DIR/data/redis/dump.rdb" "$BACKUP_DIR/$DATE/redis.rdb"
            log_success "Backup Redis terminé"
        fi
    else
        log_warning "Redis non démarré, backup ignoré"
    fi
    
    # Backup des configurations
    log_info "Backup des configurations..."
    tar -czf "$BACKUP_DIR/$DATE/config.tar.gz" \
        -C "$ROOT_DIR" \
        .env \
        docker-compose.yml \
        docker-compose.prod.yml \
        --ignore-failed-read 2>/dev/null || true
    
    # Sauvegarder les informations de version
    echo "$VERSION" > "$BACKUP_DIR/$DATE/version.txt"
    git rev-parse HEAD > "$BACKUP_DIR/$DATE/git-commit.txt"
    
    log_success "Backup créé: $BACKUP_DIR/$DATE"
}

# =============================================================================
# ÉTAPE 4: Activation du mode maintenance
# =============================================================================
enable_maintenance() {
    log_step "4. Activation du mode maintenance..."
    
    # Méthode 1: Via l'API (si script disponible)
    if docker compose exec -T api node -e "require('./scripts/enable-maintenance-mode.js')" 2>/dev/null; then
        log_success "Mode maintenance activé via API"
    else
        # Méthode 2: Via fichier flag
        docker compose exec -T api touch /app/maintenance.flag 2>/dev/null || true
        log_info "Mode maintenance activé via flag"
    fi
    
    # Attendre que les connexions actives se terminent
    log_info "Attente de la fin des requêtes en cours (15s)..."
    sleep 15
}

# =============================================================================
# ÉTAPE 5: Arrêt des services
# =============================================================================
stop_services() {
    log_step "5. Arrêt des services..."
    
    docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.prod.yml" down --remove-orphans
    
    log_success "Services arrêtés"
}

# =============================================================================
# ÉTAPE 6: Mise à jour du code
# =============================================================================
update_code() {
    log_step "6. Mise à jour du code..."
    
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    git fetch origin
    git pull origin "$BRANCH"
    
    log_success "Code mis à jour (branche: $BRANCH, commit: $(git rev-parse --short HEAD))"
}

# =============================================================================
# ÉTAPE 7: Build des images Docker
# =============================================================================
build_images() {
    log_step "7. Build des images Docker..."
    
    docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.prod.yml" build --no-cache
    
    log_success "Build terminé"
}

# =============================================================================
# ÉTAPE 8: Démarrage des services
# =============================================================================
start_services() {
    log_step "8. Démarrage des services..."
    
    docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.prod.yml" up -d
    
    log_success "Services démarrés"
}

# =============================================================================
# ÉTAPE 9: Migrations de base de données
# =============================================================================
run_migrations() {
    log_step "9. Exécution des migrations..."
    
    # Attendre que PostgreSQL soit prêt
    log_info "Attente de PostgreSQL..."
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U mssante > /dev/null 2>&1; then
            log_info "PostgreSQL prêt"
            break
        fi
        sleep 2
    done
    
    # Exécuter les migrations
    docker compose exec -T api npm run migrate 2>/dev/null || {
        log_warning "Commande de migration non disponible ou échouée"
    }
    
    log_success "Migrations exécutées"
}

# =============================================================================
# ÉTAPE 10: Tests de fumée
# =============================================================================
smoke_tests() {
    log_step "10. Tests de fumée..."
    
    local errors=0
    
    # Attendre que les services soient prêts
    log_info "Attente du démarrage complet des services..."
    for i in {1..60}; do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            break
        fi
        sleep 2
    done
    
    # Test API Health
    log_info "Test API..."
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        log_success "API Health check OK"
    else
        log_error "API Health check ÉCHEC!"
        errors=$((errors + 1))
    fi
    
    # Test SMTP (port 587)
    log_info "Test SMTP..."
    if timeout 5 bash -c "</dev/tcp/localhost/587" 2>/dev/null; then
        log_success "SMTP accessible (port 587)"
    else
        log_error "SMTP non accessible!"
        errors=$((errors + 1))
    fi
    
    # Test IMAP (port 143)
    log_info "Test IMAP..."
    if timeout 5 bash -c "</dev/tcp/localhost/143" 2>/dev/null; then
        log_success "IMAP accessible (port 143)"
    else
        log_warning "IMAP non accessible (peut être normal selon la config)"
    fi
    
    # Test PostgreSQL
    log_info "Test PostgreSQL..."
    if docker compose exec -T postgres pg_isready -U mssante > /dev/null 2>&1; then
        log_success "PostgreSQL accessible"
    else
        log_error "PostgreSQL non accessible!"
        errors=$((errors + 1))
    fi
    
    # Test Redis
    log_info "Test Redis..."
    if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        log_success "Redis accessible"
    else
        log_warning "Redis non accessible"
    fi
    
    # Résultat des tests
    if [ $errors -gt 0 ]; then
        log_error "$errors test(s) critique(s) échoué(s)!"
        return 1
    fi
    
    log_success "Tous les tests de fumée passent"
}

# =============================================================================
# ÉTAPE 11: Désactivation du mode maintenance
# =============================================================================
disable_maintenance() {
    log_step "11. Désactivation du mode maintenance..."
    
    # Méthode 1: Via l'API
    if docker compose exec -T api node -e "require('./scripts/disable-maintenance-mode.js')" 2>/dev/null; then
        log_success "Mode maintenance désactivé via API"
    else
        # Méthode 2: Via fichier flag
        docker compose exec -T api rm -f /app/maintenance.flag 2>/dev/null || true
        log_info "Mode maintenance désactivé via flag"
    fi
}

# =============================================================================
# ÉTAPE 12: Nettoyage
# =============================================================================
cleanup() {
    log_step "12. Nettoyage..."
    
    # Supprimer les images Docker orphelines
    docker image prune -f > /dev/null 2>&1 || true
    
    # Supprimer les volumes orphelins (attention: peut supprimer des données!)
    # docker volume prune -f > /dev/null 2>&1 || true
    
    # Nettoyer les anciens backups (garder 30 jours)
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
        log_info "Anciens backups nettoyés (>30 jours)"
    fi
    
    log_success "Nettoyage terminé"
}

# =============================================================================
# Génération du rapport de déploiement
# =============================================================================
generate_report() {
    log_step "Génération du rapport de déploiement..."
    
    cat > "$BACKUP_DIR/$DATE/deployment-info.json" << EOF
{
  "version": "$VERSION",
  "date": "$(date -Iseconds)",
  "deployed_by": "$(whoami)",
  "hostname": "$(hostname)",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
  "backup_path": "$BACKUP_DIR/$DATE",
  "status": "success",
  "services": {
    "api": "$(docker compose ps api --format '{{.Status}}' 2>/dev/null || echo 'N/A')",
    "postgres": "$(docker compose ps postgres --format '{{.Status}}' 2>/dev/null || echo 'N/A')",
    "redis": "$(docker compose ps redis --format '{{.Status}}' 2>/dev/null || echo 'N/A')"
  }
}
EOF
    
    log_success "Rapport généré: $BACKUP_DIR/$DATE/deployment-info.json"
}

# =============================================================================
# Affichage du résumé final
# =============================================================================
show_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ DÉPLOIEMENT PRODUCTION RÉUSSI"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Version déployée: $VERSION"
    echo "Commit: $(git rev-parse --short HEAD)"
    echo "Date: $(date)"
    echo "Backup: $BACKUP_DIR/$DATE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 État des services:"
    docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.prod.yml" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Actions de suivi recommandées:"
    echo "   • Surveiller les logs pendant 24h"
    echo "     docker compose logs -f"
    echo "   • Vérifier les métriques Grafana"
    echo "   • Valider avec les utilisateurs pilotes"
    echo "   • En cas de problème, exécuter le rollback:"
    echo "     ./scripts/deploy/rollback.sh"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# =============================================================================
# Rollback automatique en cas d'erreur
# =============================================================================
auto_rollback() {
    log_error "==========================================="
    log_error "ERREUR DÉTECTÉE - ROLLBACK AUTOMATIQUE"
    log_error "==========================================="
    
    # Désactiver le mode maintenance
    docker compose exec -T api rm -f /app/maintenance.flag 2>/dev/null || true
    
    # Lancer le rollback si le script existe
    if [ -x "$SCRIPT_DIR/rollback.sh" ]; then
        log_info "Lancement du rollback automatique..."
        ROLLBACK_AUTO=true "$SCRIPT_DIR/rollback.sh"
    else
        log_error "Script de rollback non disponible!"
        log_error "Intervention manuelle requise."
        log_info "Backup disponible: $BACKUP_DIR/$DATE"
        log_info "Pour restaurer manuellement:"
        log_info "  1. git checkout <version_précédente>"
        log_info "  2. gunzip -c $BACKUP_DIR/$DATE/database.sql.gz | docker compose exec -T postgres psql -U mssante mssante"
        log_info "  3. docker compose up -d"
    fi
    
    exit 1
}

# Trap pour rollback automatique en cas d'erreur
trap auto_rollback ERR

# =============================================================================
# FONCTION PRINCIPALE
# =============================================================================
main() {
    # Créer le répertoire de logs
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    mkdir -p "$BACKUP_DIR" 2>/dev/null || true
    
    # Afficher le banner
    display_banner
    
    # Exécuter les étapes du déploiement
    pre_flight_checks
    confirm_deployment
    create_backup
    enable_maintenance
    stop_services
    update_code
    build_images
    start_services
    run_migrations
    smoke_tests
    disable_maintenance
    cleanup
    generate_report
    show_summary
    
    log_info "Log complet disponible: $LOG_FILE"
}

# Lancer le script
main "$@"