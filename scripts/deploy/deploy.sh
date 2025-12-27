#!/bin/bash
#
# deploy.sh - Script de déploiement générique
# Usage: ./deploy.sh [dev|staging|production]
#
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV="${1:-dev}"
DATE=$(date +%Y%m%d_%H%M%S)

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Banner
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DÉPLOIEMENT MSSANTÉ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environnement: $ENV"
echo "Date: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Validation de l'environnement
validate_environment() {
    log_info "Validation de l'environnement..."
    
    case "$ENV" in
        dev|staging|production)
            log_success "Environnement '$ENV' valide"
            ;;
        *)
            log_error "Environnement invalide: $ENV"
            echo "Usage: $0 [dev|staging|production]"
            exit 1
            ;;
    esac
    
    # Vérifier le fichier .env
    if [ ! -f "$ROOT_DIR/.env" ]; then
        log_error "Fichier .env manquant!"
        exit 1
    fi
    
    # Charger les variables d'environnement
    source "$ROOT_DIR/.env"
}

# Vérifications préalables
pre_flight_checks() {
    log_info "Vérifications préalables..."
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé!"
        exit 1
    fi
    
    # Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé!"
        exit 1
    fi
    
    # Git
    if ! command -v git &> /dev/null; then
        log_error "Git n'est pas installé!"
        exit 1
    fi
    
    # Vérifier qu'on est dans un repo git
    if [ ! -d "$ROOT_DIR/.git" ]; then
        log_error "Pas un repository Git!"
        exit 1
    fi
    
    # Vérifier les changements non committés (sauf en dev)
    if [ "$ENV" != "dev" ]; then
        if ! git diff-index --quiet HEAD --; then
            log_warning "Des changements non committés existent!"
            read -p "Continuer quand même? (y/N) " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_error "Déploiement annulé"
                exit 1
            fi
        fi
    fi
    
    log_success "Vérifications préalables OK"
}

# Pull des dernières modifications
pull_latest() {
    log_info "Récupération des dernières modifications..."
    
    if [ "$ENV" != "dev" ]; then
        git fetch origin
        BRANCH=$(git rev-parse --abbrev-ref HEAD)
        git pull origin "$BRANCH"
        log_success "Code mis à jour (branche: $BRANCH)"
    else
        log_info "Mode dev: pas de git pull automatique"
    fi
}

# Sélectionner le fichier docker-compose approprié
get_compose_files() {
    COMPOSE_FILES="-f $ROOT_DIR/docker-compose.yml"
    
    case "$ENV" in
        dev)
            COMPOSE_FILES="$COMPOSE_FILES -f $ROOT_DIR/docker-compose.dev.yml"
            ;;
        staging)
            if [ -f "$ROOT_DIR/docker-compose.staging.yml" ]; then
                COMPOSE_FILES="$COMPOSE_FILES -f $ROOT_DIR/docker-compose.staging.yml"
            fi
            ;;
        production)
            COMPOSE_FILES="$COMPOSE_FILES -f $ROOT_DIR/docker-compose.prod.yml"
            ;;
    esac
    
    echo "$COMPOSE_FILES"
}

# Build des images
build_images() {
    log_info "Build des images Docker..."
    
    COMPOSE_FILES=$(get_compose_files)
    
    if [ "$ENV" == "dev" ]; then
        docker compose $COMPOSE_FILES build
    else
        docker compose $COMPOSE_FILES build --no-cache
    fi
    
    log_success "Build terminé"
}

# Arrêt des services actuels
stop_services() {
    log_info "Arrêt des services actuels..."
    
    COMPOSE_FILES=$(get_compose_files)
    docker compose $COMPOSE_FILES down --remove-orphans || true
    
    log_success "Services arrêtés"
}

# Démarrage des services
start_services() {
    log_info "Démarrage des services..."
    
    COMPOSE_FILES=$(get_compose_files)
    docker compose $COMPOSE_FILES up -d
    
    log_success "Services démarrés"
}

# Exécution des migrations
run_migrations() {
    log_info "Exécution des migrations..."
    
    COMPOSE_FILES=$(get_compose_files)
    
    # Attendre que PostgreSQL soit prêt
    log_info "Attente de PostgreSQL..."
    for i in {1..30}; do
        if docker compose $COMPOSE_FILES exec -T postgres pg_isready -U mssante > /dev/null 2>&1; then
            break
        fi
        sleep 2
    done
    
    # Exécuter les migrations
    docker compose $COMPOSE_FILES exec -T api npm run migrate || true
    
    log_success "Migrations exécutées"
}

# Health checks
health_checks() {
    log_info "Vérification de la santé des services..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log_success "API opérationnelle"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_info "Tentative $attempt/$max_attempts..."
        sleep 2
    done
    
    log_error "Les services ne répondent pas après $max_attempts tentatives"
    return 1
}

# Tests de fumée
smoke_tests() {
    log_info "Tests de fumée..."
    
    local errors=0
    
    # Test API health
    if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        log_error "API health check échoué"
        errors=$((errors + 1))
    fi
    
    # Test frontend (si applicable)
    if curl -sf http://localhost:8080 > /dev/null 2>&1; then
        log_success "Frontend accessible"
    fi
    
    # Test SMTP (si en production/staging)
    if [ "$ENV" != "dev" ]; then
        if timeout 5 bash -c "</dev/tcp/localhost/587" 2>/dev/null; then
            log_success "SMTP accessible"
        else
            log_warning "SMTP non accessible (peut être normal selon la config)"
        fi
    fi
    
    if [ $errors -gt 0 ]; then
        log_error "$errors test(s) échoué(s)"
        return 1
    fi
    
    log_success "Tous les tests de fumée passent"
}

# Nettoyage
cleanup() {
    log_info "Nettoyage..."
    
    # Supprimer les images orphelines
    docker image prune -f > /dev/null 2>&1 || true
    
    log_success "Nettoyage terminé"
}

# Affichage du résumé
show_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ DÉPLOIEMENT RÉUSSI"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Environnement: $ENV"
    echo "Version: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
    echo "Date: $(date)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Services:"
    COMPOSE_FILES=$(get_compose_files)
    docker compose $COMPOSE_FILES ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
}

# Gestion des erreurs
handle_error() {
    log_error "Une erreur est survenue lors du déploiement!"
    log_info "Consultez les logs avec: docker compose logs"
    exit 1
}

trap handle_error ERR

# Exécution principale
main() {
    validate_environment
    pre_flight_checks
    pull_latest
    build_images
    stop_services
    start_services
    run_migrations
    health_checks
    smoke_tests
    cleanup
    show_summary
}

main "$@"