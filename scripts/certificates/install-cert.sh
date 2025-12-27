#!/bin/bash
# =============================================================================
# scripts/certificates/install-cert.sh
# Installation d'un certificat IGC Santé pour un domaine MSSanté
# =============================================================================

set -euo pipefail

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CERT_BASE_DIR="${CERT_BASE_DIR:-./config/certificates}"
LOG_FILE="/var/log/mssante/cert-install.log"

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_FILE" 2>/dev/null || true; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1" >> "$LOG_FILE" 2>/dev/null || true; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE" 2>/dev/null || true; }
log_error() { echo -e "${RED}❌ $1${NC}"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE" 2>/dev/null || true; }

usage() {
    cat << EOF
Usage: $0 <domain> <cert_file> <key_file> [chain_file]

Installation d'un certificat IGC Santé pour un domaine MSSanté.

Arguments:
    domain      Nom du domaine (ex: hopital-exemple.mssante.fr)
    cert_file   Chemin vers le fichier certificat (.pem ou .crt)
    key_file    Chemin vers le fichier clé privée (.pem ou .key)
    chain_file  (Optionnel) Chemin vers la chaîne de certification

Options:
    -h, --help      Afficher cette aide
    -f, --force     Forcer l'installation sans confirmation
    -n, --no-reload Ne pas recharger les services après installation

Exemples:
    $0 hopital.mssante.fr /tmp/cert.pem /tmp/key.pem
    $0 clinique.mssante.fr cert.pem key.pem chain.pem --force

EOF
    exit 0
}

# Parse des options
FORCE=false
RELOAD=true
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) usage ;;
        -f|--force) FORCE=true; shift ;;
        -n|--no-reload) RELOAD=false; shift ;;
        -*) log_error "Option inconnue: $1"; usage ;;
        *) break ;;
    esac
done

# Vérification des arguments
DOMAIN="${1:-}"
CERT_FILE="${2:-}"
KEY_FILE="${3:-}"
CHAIN_FILE="${4:-}"

if [[ -z "$DOMAIN" ]] || [[ -z "$CERT_FILE" ]] || [[ -z "$KEY_FILE" ]]; then
    log_error "Arguments manquants"
    usage
fi

# Vérification des fichiers source
if [[ ! -f "$CERT_FILE" ]]; then
    log_error "Fichier certificat introuvable: $CERT_FILE"
    exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
    log_error "Fichier clé privée introuvable: $KEY_FILE"
    exit 1
fi

if [[ -n "$CHAIN_FILE" ]] && [[ ! -f "$CHAIN_FILE" ]]; then
    log_error "Fichier chaîne introuvable: $CHAIN_FILE"
    exit 1
fi

# Répertoire de destination
CERT_DIR="$CERT_BASE_DIR/domains/$DOMAIN"

echo ""
echo "=========================================="
echo "  Installation Certificat IGC Santé"
echo "=========================================="
echo ""
log_info "Domaine: $DOMAIN"
log_info "Certificat: $CERT_FILE"
log_info "Clé privée: $KEY_FILE"
[[ -n "$CHAIN_FILE" ]] && log_info "Chaîne: $CHAIN_FILE"
echo ""

# Vérification du certificat
log_info "Vérification du certificat..."

# Extraire les informations du certificat
CERT_SUBJECT=$(openssl x509 -in "$CERT_FILE" -noout -subject 2>/dev/null || echo "ERREUR")
CERT_ISSUER=$(openssl x509 -in "$CERT_FILE" -noout -issuer 2>/dev/null || echo "ERREUR")
CERT_DATES=$(openssl x509 -in "$CERT_FILE" -noout -dates 2>/dev/null || echo "ERREUR")
CERT_SERIAL=$(openssl x509 -in "$CERT_FILE" -noout -serial 2>/dev/null | cut -d= -f2)
CERT_FINGERPRINT=$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2)

# Vérifier que le CN correspond au domaine
CERT_CN=$(echo "$CERT_SUBJECT" | grep -oP 'CN\s*=\s*\K[^,/]+' || echo "")
if [[ "$CERT_CN" != "$DOMAIN" ]] && [[ "$CERT_CN" != "*.$DOMAIN" ]]; then
    log_warning "Le CN ($CERT_CN) ne correspond pas exactement au domaine ($DOMAIN)"
    if [[ "$FORCE" != true ]]; then
        read -p "Continuer quand même ? (o/N) " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[OoYy]$ ]] && exit 1
    fi
fi

# Vérifier que le certificat provient de l'IGC Santé
if ! echo "$CERT_ISSUER" | grep -qi "IGC-Sante\|esante\|asip\|ans"; then
    log_warning "Ce certificat ne semble pas provenir de l'IGC Santé"
    log_warning "Issuer: $CERT_ISSUER"
    if [[ "$FORCE" != true ]]; then
        read -p "Continuer quand même ? (o/N) " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[OoYy]$ ]] && exit 1
    fi
fi

# Vérifier la correspondance clé/certificat
log_info "Vérification de la correspondance clé/certificat..."
CERT_MODULUS=$(openssl x509 -in "$CERT_FILE" -noout -modulus 2>/dev/null | md5sum | cut -d' ' -f1)
KEY_MODULUS=$(openssl rsa -in "$KEY_FILE" -noout -modulus 2>/dev/null | md5sum | cut -d' ' -f1)

if [[ "$CERT_MODULUS" != "$KEY_MODULUS" ]]; then
    log_error "La clé privée ne correspond pas au certificat!"
    exit 1
fi
log_success "Clé et certificat correspondent"

# Vérifier la date d'expiration
EXPIRY_DATE=$(openssl x509 -in "$CERT_FILE" -noout -enddate 2>/dev/null | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || echo "0")
NOW_EPOCH=$(date +%s)
DAYS_REMAINING=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

if [[ $DAYS_REMAINING -lt 0 ]]; then
    log_error "Le certificat est EXPIRÉ!"
    exit 1
elif [[ $DAYS_REMAINING -lt 30 ]]; then
    log_warning "Le certificat expire dans $DAYS_REMAINING jours!"
elif [[ $DAYS_REMAINING -lt 90 ]]; then
    log_warning "Le certificat expire dans $DAYS_REMAINING jours"
else
    log_success "Certificat valide pour $DAYS_REMAINING jours"
fi

echo ""
echo "Informations du certificat:"
echo "  Subject: $CERT_SUBJECT"
echo "  Issuer:  $CERT_ISSUER"
echo "  Serial:  $CERT_SERIAL"
echo "  $CERT_DATES"
echo ""

# Confirmation
if [[ "$FORCE" != true ]]; then
    read -p "Installer ce certificat pour $DOMAIN ? (o/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[OoYy]$ ]] && exit 0
fi

# Création du répertoire
log_info "Création du répertoire $CERT_DIR..."
mkdir -p "$CERT_DIR"

# Sauvegarde de l'ancien certificat si existant
if [[ -f "$CERT_DIR/cert.pem" ]]; then
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="$CERT_DIR/backup_$BACKUP_DATE"
    log_info "Sauvegarde de l'ancien certificat dans $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
    cp "$CERT_DIR/cert.pem" "$BACKUP_DIR/"
    [[ -f "$CERT_DIR/key.pem" ]] && cp "$CERT_DIR/key.pem" "$BACKUP_DIR/"
    [[ -f "$CERT_DIR/chain.pem" ]] && cp "$CERT_DIR/chain.pem" "$BACKUP_DIR/"
    [[ -f "$CERT_DIR/fullchain.pem" ]] && cp "$CERT_DIR/fullchain.pem" "$BACKUP_DIR/"
    log_success "Sauvegarde effectuée"
fi

# Installation des fichiers
log_info "Installation du certificat..."
cp "$CERT_FILE" "$CERT_DIR/cert.pem"
chmod 644 "$CERT_DIR/cert.pem"

log_info "Installation de la clé privée..."
cp "$KEY_FILE" "$CERT_DIR/key.pem"
chmod 600 "$CERT_DIR/key.pem"

if [[ -n "$CHAIN_FILE" ]]; then
    log_info "Installation de la chaîne de certification..."
    cp "$CHAIN_FILE" "$CERT_DIR/chain.pem"
    chmod 644 "$CERT_DIR/chain.pem"
    
    # Création du fullchain
    log_info "Création du fullchain.pem..."
    cat "$CERT_DIR/cert.pem" "$CERT_DIR/chain.pem" > "$CERT_DIR/fullchain.pem"
    chmod 644 "$CERT_DIR/fullchain.pem"
fi

log_success "Fichiers installés"

# Mise à jour de la base de données
log_info "Mise à jour de la base de données..."
if command -v docker &> /dev/null && docker compose ps postgres 2>/dev/null | grep -q "running"; then
    docker compose exec -T postgres psql -U mssante -d mssante <<-SQL || log_warning "Échec mise à jour DB"
        UPDATE domains 
        SET 
            certificate_serial = '$CERT_SERIAL',
            certificate_fingerprint = '${CERT_FINGERPRINT//:/}',
            certificate_expires_at = '$EXPIRY_DATE',
            updated_at = NOW()
        WHERE domain_name = '$DOMAIN';
        
        INSERT INTO audit_logs (action, resource_type, resource_id, details, created_at)
        SELECT 'certificate_installed', 'domain', id, 
               jsonb_build_object(
                   'serial', '$CERT_SERIAL',
                   'expires_at', '$EXPIRY_DATE',
                   'fingerprint', '${CERT_FINGERPRINT//:/}'
               ),
               NOW()
        FROM domains WHERE domain_name = '$DOMAIN';
SQL
    log_success "Base de données mise à jour"
else
    log_warning "PostgreSQL non disponible, mise à jour DB ignorée"
fi

# Rechargement des services
if [[ "$RELOAD" == true ]]; then
    log_info "Rechargement des services..."
    
    if command -v docker &> /dev/null; then
        # Postfix
        if docker compose ps postfix 2>/dev/null | grep -q "running"; then
            docker compose exec -T postfix postfix reload 2>/dev/null && \
                log_success "Postfix rechargé" || \
                log_warning "Échec rechargement Postfix"
        fi
        
        # Dovecot
        if docker compose ps dovecot 2>/dev/null | grep -q "running"; then
            docker compose exec -T dovecot doveadm reload 2>/dev/null && \
                log_success "Dovecot rechargé" || \
                log_warning "Échec rechargement Dovecot"
        fi
        
        # Traefik (redémarrage nécessaire pour TLS)
        if docker compose ps traefik 2>/dev/null | grep -q "running"; then
            docker compose restart traefik 2>/dev/null && \
                log_success "Traefik redémarré" || \
                log_warning "Échec redémarrage Traefik"
        fi
    else
        log_warning "Docker non disponible, rechargement des services ignoré"
    fi
fi

# Vérification finale
log_info "Vérification finale..."
if openssl x509 -in "$CERT_DIR/cert.pem" -noout -checkend 0 2>/dev/null; then
    log_success "Certificat valide et installé"
else
    log_error "Problème avec le certificat installé"
    exit 1
fi

echo ""
echo "=========================================="
log_success "Certificat installé avec succès pour $DOMAIN"
echo "=========================================="
echo ""
echo "Fichiers installés:"
echo "  - $CERT_DIR/cert.pem"
echo "  - $CERT_DIR/key.pem"
[[ -n "$CHAIN_FILE" ]] && echo "  - $CERT_DIR/chain.pem"
[[ -n "$CHAIN_FILE" ]] && echo "  - $CERT_DIR/fullchain.pem"
echo ""
echo "Expiration: $EXPIRY_DATE ($DAYS_REMAINING jours)"
echo ""