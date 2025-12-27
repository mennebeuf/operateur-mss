#!/bin/bash
#===============================================================================
# Script: check-health.sh
# Description: Vérification de la santé de tous les services MSSanté
# Usage: ./scripts/maintenance/check-health.sh [OPTIONS]
# Planification recommandée: cron toutes les 5 minutes
#===============================================================================

set -uo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATUS_FILE="${STATUS_FILE:-/var/log/mssante/health-status.json}"
HISTORY_FILE="${HISTORY_FILE:-/var/log/mssante/health-history.log}"
ALERT_THRESHOLD=${ALERT_THRESHOLD:-3}
TIMEOUT=${TIMEOUT:-5}

# URLs des services (configurables via variables d'environnement)
API_URL="${API_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:80}"
SMTP_HOST="${SMTP_HOST:-localhost}"
SMTP_PORT="${SMTP_PORT:-587}"
IMAP_HOST="${IMAP_HOST:-localhost}"
IMAP_PORT="${IMAP_PORT:-143}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://alertmanager:9093}"

# Seuils
DISK_THRESHOLD=${DISK_THRESHOLD:-85}
MEMORY_THRESHOLD=${MEMORY_THRESHOLD:-90}
CPU_THRESHOLD=${CPU_THRESHOLD:-90}
CERT_EXPIRY_DAYS=${CERT_EXPIRY_DAYS:-30}

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Options
VERBOSE=false
JSON_OUTPUT=false
SEND_ALERTS=true
CHECK_CERTS=true

# Compteurs
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Résultats
declare -A RESULTS
ERRORS=()

#-------------------------------------------------------------------------------
# Fonctions utilitaires
#-------------------------------------------------------------------------------

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Vérification de la santé de tous les services MSSanté.

Options:
  --verbose         Mode verbeux
  --json            Sortie JSON uniquement
  --no-alerts       Ne pas envoyer d'alertes
  --no-certs        Ne pas vérifier les certificats
  -h, --help        Affiche cette aide

Variables d'environnement:
  API_URL           URL de l'API (défaut: http://localhost:3000)
  FRONTEND_URL      URL du frontend (défaut: http://localhost:80)
  SMTP_HOST         Hôte SMTP (défaut: localhost)
  SMTP_PORT         Port SMTP (défaut: 587)
  IMAP_HOST         Hôte IMAP (défaut: localhost)
  IMAP_PORT         Port IMAP (défaut: 143)
  ALERT_THRESHOLD   Seuil d'erreurs pour alerter (défaut: 3)
  TIMEOUT           Timeout des vérifications en secondes (défaut: 5)

Codes de sortie:
  0   Tous les services sont opérationnels
  1   Un ou plusieurs services sont en erreur
  2   Erreur de configuration

Exemples:
  $(basename "$0")              # Vérification standard
  $(basename "$0") --verbose    # Mode verbeux
  $(basename "$0") --json       # Sortie JSON
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose)
                VERBOSE=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
                shift
                ;;
            --no-alerts)
                SEND_ALERTS=false
                shift
                ;;
            --no-certs)
                CHECK_CERTS=false
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Option inconnue: $1"
                show_help
                exit 2
                ;;
        esac
    done
}

log_check() {
    local status=$1
    local service=$2
    local message=$3
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$JSON_OUTPUT" = false ]; then
        case $status in
            "OK")
                echo -e "  ${GREEN}✓${NC} $service: $message"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
                ;;
            "WARN")
                echo -e "  ${YELLOW}⚠${NC} $service: $message"
                WARNING_CHECKS=$((WARNING_CHECKS + 1))
                ;;
            "FAIL")
                echo -e "  ${RED}✗${NC} $service: $message"
                FAILED_CHECKS=$((FAILED_CHECKS + 1))
                ERRORS+=("$service: $message")
                ;;
        esac
    fi
    
    RESULTS["$service"]="$status"
}

log_verbose() {
    if [ "$VERBOSE" = true ] && [ "$JSON_OUTPUT" = false ]; then
        echo -e "    ${CYAN}→${NC} $1"
    fi
}

#-------------------------------------------------------------------------------
# Vérifications des services
#-------------------------------------------------------------------------------

check_api() {
    log_verbose "Vérification de l'API: $API_URL/health"
    
    local response
    local http_code
    
    response=$(curl -sf --max-time "$TIMEOUT" -w "\n%{http_code}" "$API_URL/health" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        log_check "OK" "API" "Opérationnelle (HTTP $http_code)"
        return 0
    else
        log_check "FAIL" "API" "Non accessible (HTTP $http_code)"
        return 1
    fi
}

check_frontend() {
    log_verbose "Vérification du frontend: $FRONTEND_URL"
    
    local http_code
    http_code=$(curl -sf --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
        log_check "OK" "Frontend" "Opérationnel (HTTP $http_code)"
        return 0
    else
        log_check "FAIL" "Frontend" "Non accessible (HTTP $http_code)"
        return 1
    fi
}

check_smtp() {
    log_verbose "Vérification SMTP: $SMTP_HOST:$SMTP_PORT"
    
    if timeout "$TIMEOUT" bash -c "echo QUIT | nc -w $TIMEOUT $SMTP_HOST $SMTP_PORT" &>/dev/null; then
        log_check "OK" "SMTP" "Port $SMTP_PORT accessible"
        return 0
    else
        log_check "FAIL" "SMTP" "Port $SMTP_PORT non accessible"
        return 1
    fi
}

check_imap() {
    log_verbose "Vérification IMAP: $IMAP_HOST:$IMAP_PORT"
    
    if timeout "$TIMEOUT" bash -c "echo LOGOUT | nc -w $TIMEOUT $IMAP_HOST $IMAP_PORT" &>/dev/null; then
        log_check "OK" "IMAP" "Port $IMAP_PORT accessible"
        return 0
    else
        log_check "FAIL" "IMAP" "Port $IMAP_PORT non accessible"
        return 1
    fi
}

check_postgres() {
    log_verbose "Vérification PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT"
    
    if timeout "$TIMEOUT" bash -c "</dev/tcp/$POSTGRES_HOST/$POSTGRES_PORT" 2>/dev/null; then
        # Test de connexion via docker si disponible
        if command -v docker &>/dev/null; then
            if docker compose exec -T postgres pg_isready -U mssante &>/dev/null; then
                log_check "OK" "PostgreSQL" "Opérationnel et prêt"
                return 0
            fi
        fi
        log_check "OK" "PostgreSQL" "Port $POSTGRES_PORT accessible"
        return 0
    else
        log_check "FAIL" "PostgreSQL" "Non accessible"
        return 1
    fi
}

check_redis() {
    log_verbose "Vérification Redis: $REDIS_HOST:$REDIS_PORT"
    
    local response
    response=$(echo "PING" | timeout "$TIMEOUT" nc -w "$TIMEOUT" "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null)
    
    if [[ "$response" == *"PONG"* ]]; then
        log_check "OK" "Redis" "Opérationnel (PONG reçu)"
        return 0
    elif timeout "$TIMEOUT" bash -c "</dev/tcp/$REDIS_HOST/$REDIS_PORT" 2>/dev/null; then
        log_check "OK" "Redis" "Port $REDIS_PORT accessible"
        return 0
    else
        log_check "FAIL" "Redis" "Non accessible"
        return 1
    fi
}

check_docker_services() {
    log_verbose "Vérification des conteneurs Docker"
    
    if ! command -v docker &>/dev/null; then
        log_check "WARN" "Docker" "Commande docker non disponible"
        return 0
    fi
    
    local services=("postgres" "redis" "api" "frontend" "postfix" "dovecot")
    local all_ok=true
    
    for service in "${services[@]}"; do
        local status
        status=$(docker compose ps "$service" --format "{{.Status}}" 2>/dev/null | head -1)
        
        if [[ "$status" == *"Up"* ]] || [[ "$status" == *"running"* ]]; then
            log_verbose "$service: $status"
        else
            log_check "FAIL" "Docker:$service" "Conteneur non actif: $status"
            all_ok=false
        fi
    done
    
    if [ "$all_ok" = true ]; then
        log_check "OK" "Docker" "Tous les conteneurs sont actifs"
    fi
}

#-------------------------------------------------------------------------------
# Vérifications système
#-------------------------------------------------------------------------------

check_disk_usage() {
    log_verbose "Vérification de l'espace disque"
    
    local usage
    usage=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    
    if [ "$usage" -ge "$DISK_THRESHOLD" ]; then
        log_check "WARN" "Disque" "Utilisation élevée: ${usage}%"
        return 1
    else
        log_check "OK" "Disque" "Utilisation: ${usage}%"
        return 0
    fi
}

check_memory_usage() {
    log_verbose "Vérification de la mémoire"
    
    local usage
    usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
    
    if [ "$usage" -ge "$MEMORY_THRESHOLD" ]; then
        log_check "WARN" "Mémoire" "Utilisation élevée: ${usage}%"
        return 1
    else
        log_check "OK" "Mémoire" "Utilisation: ${usage}%"
        return 0
    fi
}

check_cpu_load() {
    log_verbose "Vérification de la charge CPU"
    
    local load
    local cores
    load=$(cat /proc/loadavg | awk '{print $1}')
    cores=$(nproc 2>/dev/null || echo 1)
    
    local load_percent
    load_percent=$(echo "$load $cores" | awk '{printf "%.0f", ($1/$2) * 100}')
    
    if [ "$load_percent" -ge "$CPU_THRESHOLD" ]; then
        log_check "WARN" "CPU" "Charge élevée: $load (${load_percent}%)"
        return 1
    else
        log_check "OK" "CPU" "Charge: $load (${load_percent}%)"
        return 0
    fi
}

#-------------------------------------------------------------------------------
# Vérification des certificats
#-------------------------------------------------------------------------------

check_certificates() {
    if [ "$CHECK_CERTS" = false ]; then
        return 0
    fi
    
    log_verbose "Vérification des certificats SSL"
    
    local cert_dirs=("$ROOT_DIR/config/certificates" "/etc/ssl/certs/mssante")
    local found_certs=false
    
    for cert_dir in "${cert_dirs[@]}"; do
        if [ -d "$cert_dir" ]; then
            while IFS= read -r -d '' cert; do
                found_certs=true
                local expiry
                local days_left
                
                expiry=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)
                if [ -n "$expiry" ]; then
                    local expiry_epoch
                    local now_epoch
                    expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null)
                    now_epoch=$(date +%s)
                    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
                    
                    local cert_name
                    cert_name=$(basename "$cert")
                    
                    if [ "$days_left" -le 0 ]; then
                        log_check "FAIL" "Cert:$cert_name" "EXPIRÉ!"
                    elif [ "$days_left" -le "$CERT_EXPIRY_DAYS" ]; then
                        log_check "WARN" "Cert:$cert_name" "Expire dans $days_left jours"
                    else
                        log_verbose "$cert_name: valide ($days_left jours restants)"
                    fi
                fi
            done < <(find "$cert_dir" -name "*.crt" -o -name "*.pem" -print0 2>/dev/null)
        fi
    done
    
    if [ "$found_certs" = true ]; then
        if [ "$FAILED_CHECKS" -eq 0 ] && [ "$WARNING_CHECKS" -eq 0 ]; then
            log_check "OK" "Certificats" "Tous les certificats sont valides"
        fi
    else
        log_verbose "Aucun certificat trouvé dans les répertoires configurés"
    fi
}

#-------------------------------------------------------------------------------
# Gestion des alertes
#-------------------------------------------------------------------------------

send_alert() {
    if [ "$SEND_ALERTS" = false ]; then
        return 0
    fi
    
    local severity=$1
    local message=$2
    
    log_verbose "Envoi d'alerte ($severity): $message"
    
    # Alerte via AlertManager si disponible
    if curl -sf --max-time 2 "$ALERTMANAGER_URL/api/v1/status" &>/dev/null; then
        curl -sf --max-time 5 -X POST "$ALERTMANAGER_URL/api/v1/alerts" \
            -H "Content-Type: application/json" \
            -d "[{\"labels\":{\"alertname\":\"HealthCheck\",\"severity\":\"$severity\"},\"annotations\":{\"summary\":\"$message\"}}]" \
            &>/dev/null || true
    fi
}

#-------------------------------------------------------------------------------
# Génération des rapports
#-------------------------------------------------------------------------------

generate_status_file() {
    mkdir -p "$(dirname "$STATUS_FILE")"
    
    local status="healthy"
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        status="unhealthy"
    elif [ "$WARNING_CHECKS" -gt 0 ]; then
        status="degraded"
    fi
    
    cat > "$STATUS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "$status",
  "checks": {
    "total": $TOTAL_CHECKS,
    "passed": $PASSED_CHECKS,
    "failed": $FAILED_CHECKS,
    "warnings": $WARNING_CHECKS
  },
  "errors": [$(printf '"%s",' "${ERRORS[@]}" | sed 's/,$//')]
}
EOF
}

append_history() {
    mkdir -p "$(dirname "$HISTORY_FILE")"
    
    local status="OK"
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        status="FAIL"
    elif [ "$WARNING_CHECKS" -gt 0 ]; then
        status="WARN"
    fi
    
    echo "$(date -Iseconds) | $status | passed=$PASSED_CHECKS failed=$FAILED_CHECKS warn=$WARNING_CHECKS" >> "$HISTORY_FILE"
    
    # Garder seulement les 1000 dernières lignes
    tail -n 1000 "$HISTORY_FILE" > "${HISTORY_FILE}.tmp" && mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"
}

output_json() {
    local status="healthy"
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        status="unhealthy"
    elif [ "$WARNING_CHECKS" -gt 0 ]; then
        status="degraded"
    fi
    
    cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "$status",
  "checks": {
    "total": $TOTAL_CHECKS,
    "passed": $PASSED_CHECKS,
    "failed": $FAILED_CHECKS,
    "warnings": $WARNING_CHECKS
  },
  "services": {
$(for key in "${!RESULTS[@]}"; do echo "    \"$key\": \"${RESULTS[$key]}\","; done | sed '$ s/,$//')
  },
  "errors": [$(printf '"%s",' "${ERRORS[@]}" | sed 's/,$//')]
}
EOF
}

print_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "📊 RÉSUMÉ"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  Total des vérifications:  $TOTAL_CHECKS"
    echo -e "  ${GREEN}✓ Réussies:${NC}               $PASSED_CHECKS"
    echo -e "  ${YELLOW}⚠ Avertissements:${NC}         $WARNING_CHECKS"
    echo -e "  ${RED}✗ Échouées:${NC}               $FAILED_CHECKS"
    echo ""
    
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        echo -e "  ${RED}Statut: CRITIQUE${NC}"
    elif [ "$WARNING_CHECKS" -gt 0 ]; then
        echo -e "  ${YELLOW}Statut: DÉGRADÉ${NC}"
    else
        echo -e "  ${GREEN}Statut: OPÉRATIONNEL${NC}"
    fi
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------

main() {
    parse_args "$@"
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "╔═══════════════════════════════════════════════════════════════╗"
        echo "║          🏥 HEALTH CHECK MSSANTÉ                             ║"
        echo "╠═══════════════════════════════════════════════════════════════╣"
        echo "║  $(date '+%Y-%m-%d %H:%M:%S')                                       ║"
        echo "╚═══════════════════════════════════════════════════════════════╝"
        echo ""
        
        echo "📡 Services applicatifs"
        echo "───────────────────────────────────────────────────────────────"
    fi
    
    check_api
    check_frontend
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "📧 Services mail"
        echo "───────────────────────────────────────────────────────────────"
    fi
    
    check_smtp
    check_imap
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "🗄️ Base de données et cache"
        echo "───────────────────────────────────────────────────────────────"
    fi
    
    check_postgres
    check_redis
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "🐳 Conteneurs Docker"
        echo "───────────────────────────────────────────────────────────────"
    fi
    
    check_docker_services
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "💻 Ressources système"
        echo "───────────────────────────────────────────────────────────────"
    fi
    
    check_disk_usage
    check_memory_usage
    check_cpu_load
    
    if [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "🔐 Certificats SSL"
        echo "───────────────────────────────────────────────────────────────"
    fi
    
    check_certificates
    
    # Génération des fichiers de statut
    generate_status_file
    append_history
    
    # Envoi d'alerte si nécessaire
    if [ "$FAILED_CHECKS" -ge "$ALERT_THRESHOLD" ]; then
        send_alert "critical" "$FAILED_CHECKS services en erreur"
    elif [ "$WARNING_CHECKS" -ge "$ALERT_THRESHOLD" ]; then
        send_alert "warning" "$WARNING_CHECKS avertissements"
    fi
    
    # Sortie
    if [ "$JSON_OUTPUT" = true ]; then
        output_json
    else
        print_summary
    fi
    
    # Code de sortie
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"