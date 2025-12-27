#!/bin/bash
# =============================================================================
# scripts/certificates/renew-certs.sh
# Vérification et renouvellement des certificats IGC Santé MSSanté
# =============================================================================

set -euo pipefail

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
CERT_BASE_DIR="${CERT_BASE_DIR:-./config/certificates}"
ALERT_DAYS="${ALERT_DAYS:-30}"
WARNING_DAYS="${WARNING_DAYS:-60}"
LOG_FILE="/var/log/mssante/cert-renew.log"
REPORT_FILE="/tmp/cert-report-$(date +%Y%m%d).txt"

# Variables pour les alertes
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
SMTP_HOST="${SMTP_HOST:-localhost}"

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_FILE" 2>/dev/null || true; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1" >> "$LOG_FILE" 2>/dev/null || true; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE" 2>/dev/null || true; }
log_error() { echo -e "${RED}❌ $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE" 2>/dev/null || true; }

usage() {
    cat << EOF
Usage: $0 [OPTIONS] [domain]

Vérification et renouvellement des certificats IGC Santé.

Arguments:
    domain          (Optionnel) Domaine spécifique à vérifier/renouveler

Options:
    -c, --check         Vérifier uniquement (pas de renouvellement)
    -r, --renew         Renouveler les certificats expirés/proches de l'expiration
    -a, --alert-days N  Jours avant expiration pour alerte (défaut: 30)
    -w, --warning-days N Jours avant expiration pour avertissement (défaut: 60)
    -s, --send-alerts   Envoyer des alertes (email/Slack)
    -q, --quiet         Mode silencieux (seulement les erreurs)
    --report            Générer un rapport détaillé
    -h, --help          Afficher cette aide

Exemples:
    $0 --check                      # Vérifier tous les certificats
    $0 --check hopital.mssante.fr   # Vérifier un domaine spécifique
    $0 --renew --send-alerts        # Renouveler et alerter
    $0 --report                     # Générer un rapport

Variables d'environnement:
    CERT_BASE_DIR       Répertoire des certificats (défaut: ./config/certificates)
    ALERT_DAYS          Seuil d'alerte en jours (défaut: 30)
    SLACK_WEBHOOK_URL   URL du webhook Slack pour les alertes
    ALERT_EMAIL         Email pour les alertes

EOF
    exit 0
}

# Envoi d'alerte Slack
send_slack_alert() {
    local message="$1"
    local severity="${2:-warning}"
    
    [[ -z "$SLACK_WEBHOOK_URL" ]] && return
    
    local color="#ff9800"
    [[ "$severity" == "critical" ]] && color="#f44336"
    [[ "$severity" == "success" ]] && color="#4caf50"
    
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"attachments\": [{
                \"color\": \"$color\",
                \"title\": \"🔐 Alerte Certificat MSSanté\",
                \"text\": \"$message\",
                \"footer\": \"$(hostname) | $(date '+%Y-%m-%d %H:%M:%S')\"
            }]
        }" 2>/dev/null || true
}

# Envoi d'alerte Email
send_email_alert() {
    local subject="$1"
    local body="$2"
    
    [[ -z "$ALERT_EMAIL" ]] && return
    
    if command -v mail &> /dev/null; then
        echo "$body" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null || true
    elif command -v sendmail &> /dev/null; then
        {
            echo "To: $ALERT_EMAIL"
            echo "Subject: $subject"
            echo "Content-Type: text/plain; charset=UTF-8"
            echo ""
            echo "$body"
        } | sendmail -t 2>/dev/null || true
    fi
}

# Vérifier un certificat
check_certificate() {
    local cert_file="$1"
    local domain="$2"
    
    if [[ ! -f "$cert_file" ]]; then
        echo "MISSING"
        return 1
    fi
    
    # Vérifier si le certificat est valide
    if ! openssl x509 -in "$cert_file" -noout 2>/dev/null; then
        echo "INVALID"
        return 1
    fi
    
    # Récupérer les informations
    local expiry_date
    expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
    local now_epoch
    now_epoch=$(date +%s)
    local days_remaining=$(( (expiry_epoch - now_epoch) / 86400 ))
    
    # Récupérer le serial
    local serial
    serial=$(openssl x509 -in "$cert_file" -noout -serial 2>/dev/null | cut -d= -f2)
    
    # Récupérer l'issuer
    local issuer
    issuer=$(openssl x509 -in "$cert_file" -noout -issuer 2>/dev/null | sed 's/issuer=//')
    
    echo "$days_remaining|$expiry_date|$serial|$issuer"
    return 0
}

# Renouveler un certificat (processus guidé)
renew_certificate() {
    local domain="$1"
    local cert_dir="$CERT_BASE_DIR/domains/$domain"
    
    echo ""
    echo "=========================================="
    echo "  Renouvellement du certificat: $domain"
    echo "=========================================="
    echo ""
    
    log_info "Processus de renouvellement pour $domain"
    
    # Étape 1: Vérifier l'ancien certificat
    if [[ -f "$cert_dir/cert.pem" ]]; then
        local old_serial
        old_serial=$(openssl x509 -in "$cert_dir/cert.pem" -noout -serial 2>/dev/null | cut -d= -f2)
        log_info "Ancien certificat - Serial: $old_serial"
        
        # Sauvegarder l'ancien
        local backup_date
        backup_date=$(date +%Y%m%d_%H%M%S)
        mkdir -p "$cert_dir/backup_$backup_date"
        cp "$cert_dir/cert.pem" "$cert_dir/backup_$backup_date/"
        [[ -f "$cert_dir/key.pem" ]] && cp "$cert_dir/key.pem" "$cert_dir/backup_$backup_date/"
        [[ -f "$cert_dir/chain.pem" ]] && cp "$cert_dir/chain.pem" "$cert_dir/backup_$backup_date/"
        log_success "Sauvegarde créée: backup_$backup_date"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  PROCÉDURE DE RENOUVELLEMENT IGC SANTÉ"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1️⃣  Connectez-vous au portail IGC Santé:"
    echo "    https://pki.esante.gouv.fr"
    echo ""
    echo "2️⃣  Identification avec votre carte CPS"
    echo ""
    echo "3️⃣  Sélectionnez 'Renouveler un certificat'"
    echo "    - Type: SERV SSL (pour serveur)"
    echo "    - Domaine: $domain"
    echo ""
    echo "4️⃣  Générez une nouvelle CSR (si nécessaire):"
    echo ""
    echo "    openssl req -new -newkey rsa:4096 -nodes \\"
    echo "      -keyout $cert_dir/new_key.pem \\"
    echo "      -out $cert_dir/new_csr.pem \\"
    echo "      -subj \"/CN=$domain/O=VotreOrganisation/C=FR\""
    echo ""
    echo "5️⃣  Téléchargez le certificat renouvelé"
    echo ""
    echo "6️⃣  Installez avec:"
    echo "    ./scripts/certificates/install-cert.sh $domain \\"
    echo "      /path/to/new_cert.pem /path/to/new_key.pem"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Génération automatique de la CSR si demandé
    read -p "Générer une nouvelle CSR maintenant ? (o/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[OoYy]$ ]]; then
        log_info "Génération de la CSR..."
        
        read -p "Organisation (ex: CHU de Paris): " org_name
        read -p "Unité organisationnelle (optionnel): " org_unit
        
        local subj="/CN=$domain/O=$org_name/C=FR"
        [[ -n "$org_unit" ]] && subj="/CN=$domain/O=$org_name/OU=$org_unit/C=FR"
        
        openssl req -new -newkey rsa:4096 -nodes \
            -keyout "$cert_dir/new_key.pem" \
            -out "$cert_dir/new_csr.pem" \
            -subj "$subj"
        
        chmod 600 "$cert_dir/new_key.pem"
        
        log_success "CSR générée: $cert_dir/new_csr.pem"
        log_success "Clé privée générée: $cert_dir/new_key.pem"
        
        echo ""
        echo "Contenu de la CSR à soumettre:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        cat "$cert_dir/new_csr.pem"
        echo ""
    fi
    
    # Attendre le nouveau certificat
    read -p "Le nouveau certificat est-il prêt à être installé ? (o/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[OoYy]$ ]]; then
        read -p "Chemin du nouveau certificat: " new_cert_path
        read -p "Chemin de la clé privée (ou Entrée pour utiliser new_key.pem): " new_key_path
        [[ -z "$new_key_path" ]] && new_key_path="$cert_dir/new_key.pem"
        
        read -p "Chemin de la chaîne (optionnel): " chain_path
        
        # Appeler le script d'installation
        if [[ -n "$chain_path" ]]; then
            ./scripts/certificates/install-cert.sh "$domain" "$new_cert_path" "$new_key_path" "$chain_path"
        else
            ./scripts/certificates/install-cert.sh "$domain" "$new_cert_path" "$new_key_path"
        fi
    fi
}

# Générer un rapport
generate_report() {
    local expired_count=0
    local critical_count=0
    local warning_count=0
    local ok_count=0
    
    {
        echo "=============================================="
        echo "  RAPPORT DES CERTIFICATS MSSanté"
        echo "  Généré le: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "  Serveur: $(hostname)"
        echo "=============================================="
        echo ""
        
        # Parcourir tous les domaines
        for domain_dir in "$CERT_BASE_DIR/domains"/*; do
            [[ ! -d "$domain_dir" ]] && continue
            
            local domain
            domain=$(basename "$domain_dir")
            local cert_file="$domain_dir/cert.pem"
            
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Domaine: $domain"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            if [[ ! -f "$cert_file" ]]; then
                echo "  Status: ❌ CERTIFICAT MANQUANT"
                ((expired_count++))
                continue
            fi
            
            local result
            result=$(check_certificate "$cert_file" "$domain")
            
            if [[ "$result" == "INVALID" ]] || [[ "$result" == "MISSING" ]]; then
                echo "  Status: ❌ INVALIDE"
                ((expired_count++))
                continue
            fi
            
            local days_remaining expiry_date serial issuer
            IFS='|' read -r days_remaining expiry_date serial issuer <<< "$result"
            
            echo "  Serial: $serial"
            echo "  Expiration: $expiry_date"
            echo "  Jours restants: $days_remaining"
            echo "  Issuer: $issuer"
            
            if [[ $days_remaining -lt 0 ]]; then
                echo "  Status: ❌ EXPIRÉ"
                ((expired_count++))
            elif [[ $days_remaining -lt $ALERT_DAYS ]]; then
                echo "  Status: 🔴 CRITIQUE (< $ALERT_DAYS jours)"
                ((critical_count++))
            elif [[ $days_remaining -lt $WARNING_DAYS ]]; then
                echo "  Status: 🟡 ATTENTION (< $WARNING_DAYS jours)"
                ((warning_count++))
            else
                echo "  Status: ✅ OK"
                ((ok_count++))
            fi
            echo ""
        done
        
        echo ""
        echo "=============================================="
        echo "  RÉSUMÉ"
        echo "=============================================="
        echo "  ✅ OK:        $ok_count"
        echo "  🟡 Attention: $warning_count"
        echo "  🔴 Critique:  $critical_count"
        echo "  ❌ Expirés:   $expired_count"
        echo "=============================================="
        
    } | tee "$REPORT_FILE"
    
    log_success "Rapport généré: $REPORT_FILE"
}

# Parse des options
MODE="check"
SEND_ALERTS=false
QUIET=false
GENERATE_REPORT=false
SPECIFIC_DOMAIN=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) usage ;;
        -c|--check) MODE="check"; shift ;;
        -r|--renew) MODE="renew"; shift ;;
        -a|--alert-days) ALERT_DAYS="$2"; shift 2 ;;
        -w|--warning-days) WARNING_DAYS="$2"; shift 2 ;;
        -s|--send-alerts) SEND_ALERTS=true; shift ;;
        -q|--quiet) QUIET=true; shift ;;
        --report) GENERATE_REPORT=true; shift ;;
        -*) log_error "Option inconnue: $1"; usage ;;
        *) SPECIFIC_DOMAIN="$1"; shift ;;
    esac
done

# Créer le répertoire de logs si nécessaire
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  Vérification des Certificats MSSanté"
echo "=========================================="
echo "  Mode: $MODE"
echo "  Seuil alerte: $ALERT_DAYS jours"
echo "  Seuil warning: $WARNING_DAYS jours"
echo "=========================================="
echo ""

# Générer le rapport si demandé
if [[ "$GENERATE_REPORT" == true ]]; then
    generate_report
    exit 0
fi

# Tableaux pour les résultats
declare -a EXPIRED_CERTS=()
declare -a CRITICAL_CERTS=()
declare -a WARNING_CERTS=()
declare -a OK_CERTS=()

# Parcourir les domaines
if [[ -n "$SPECIFIC_DOMAIN" ]]; then
    DOMAINS=("$SPECIFIC_DOMAIN")
else
    DOMAINS=()
    for domain_dir in "$CERT_BASE_DIR/domains"/*; do
        [[ -d "$domain_dir" ]] && DOMAINS+=("$(basename "$domain_dir")")
    done
fi

for domain in "${DOMAINS[@]}"; do
    cert_file="$CERT_BASE_DIR/domains/$domain/cert.pem"
    
    [[ "$QUIET" != true ]] && echo -n "Vérification de $domain... "
    
    if [[ ! -f "$cert_file" ]]; then
        [[ "$QUIET" != true ]] && echo -e "${RED}MANQUANT${NC}"
        EXPIRED_CERTS+=("$domain:MISSING:N/A")
        continue
    fi
    
    result=$(check_certificate "$cert_file" "$domain")
    
    if [[ "$result" == "INVALID" ]] || [[ "$result" == "MISSING" ]]; then
        [[ "$QUIET" != true ]] && echo -e "${RED}INVALIDE${NC}"
        EXPIRED_CERTS+=("$domain:INVALID:N/A")
        continue
    fi
    
    IFS='|' read -r days_remaining expiry_date serial issuer <<< "$result"
    
    if [[ $days_remaining -lt 0 ]]; then
        [[ "$QUIET" != true ]] && echo -e "${RED}EXPIRÉ${NC} (depuis $((-days_remaining)) jours)"
        EXPIRED_CERTS+=("$domain:$days_remaining:$expiry_date")
    elif [[ $days_remaining -lt $ALERT_DAYS ]]; then
        [[ "$QUIET" != true ]] && echo -e "${RED}CRITIQUE${NC} ($days_remaining jours restants)"
        CRITICAL_CERTS+=("$domain:$days_remaining:$expiry_date")
    elif [[ $days_remaining -lt $WARNING_DAYS ]]; then
        [[ "$QUIET" != true ]] && echo -e "${YELLOW}ATTENTION${NC} ($days_remaining jours restants)"
        WARNING_CERTS+=("$domain:$days_remaining:$expiry_date")
    else
        [[ "$QUIET" != true ]] && echo -e "${GREEN}OK${NC} ($days_remaining jours restants)"
        OK_CERTS+=("$domain:$days_remaining:$expiry_date")
    fi
done

echo ""

# Résumé
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RÉSUMÉ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✅ OK:${NC}        ${#OK_CERTS[@]}"
echo -e "  ${YELLOW}⚠️  Attention:${NC} ${#WARNING_CERTS[@]}"
echo -e "  ${RED}🔴 Critique:${NC}  ${#CRITICAL_CERTS[@]}"
echo -e "  ${RED}❌ Expirés:${NC}   ${#EXPIRED_CERTS[@]}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Envoyer des alertes si nécessaire
if [[ "$SEND_ALERTS" == true ]]; then
    if [[ ${#EXPIRED_CERTS[@]} -gt 0 ]] || [[ ${#CRITICAL_CERTS[@]} -gt 0 ]]; then
        alert_message="🚨 ALERTE CERTIFICATS MSSanté\n\n"
        
        if [[ ${#EXPIRED_CERTS[@]} -gt 0 ]]; then
            alert_message+="❌ Certificats expirés:\n"
            for cert in "${EXPIRED_CERTS[@]}"; do
                IFS=':' read -r domain days date <<< "$cert"
                alert_message+="  - $domain (expiré: $date)\n"
            done
            alert_message+="\n"
        fi
        
        if [[ ${#CRITICAL_CERTS[@]} -gt 0 ]]; then
            alert_message+="🔴 Certificats critiques (< $ALERT_DAYS jours):\n"
            for cert in "${CRITICAL_CERTS[@]}"; do
                IFS=':' read -r domain days date <<< "$cert"
                alert_message+="  - $domain ($days jours - expire: $date)\n"
            done
        fi
        
        send_slack_alert "$alert_message" "critical"
        send_email_alert "[CRITIQUE] Certificats MSSanté à renouveler" "$alert_message"
        log_info "Alertes envoyées"
    fi
fi

# Mode renouvellement
if [[ "$MODE" == "renew" ]]; then
    certs_to_renew=("${EXPIRED_CERTS[@]}" "${CRITICAL_CERTS[@]}")
    
    if [[ ${#certs_to_renew[@]} -eq 0 ]]; then
        log_success "Aucun certificat nécessitant un renouvellement immédiat"
    else
        echo ""
        log_warning "${#certs_to_renew[@]} certificat(s) nécessitent un renouvellement"
        echo ""
        
        for cert in "${certs_to_renew[@]}"; do
            IFS=':' read -r domain days date <<< "$cert"
            
            read -p "Renouveler le certificat pour $domain ? (o/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[OoYy]$ ]]; then
                renew_certificate "$domain"
            fi
        done
    fi
fi

# Code de sortie
if [[ ${#EXPIRED_CERTS[@]} -gt 0 ]]; then
    exit 2
elif [[ ${#CRITICAL_CERTS[@]} -gt 0 ]]; then
    exit 1
else
    exit 0
fi