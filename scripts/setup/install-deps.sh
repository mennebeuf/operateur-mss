#!/bin/bash
#===============================================================================
# Script: install-deps.sh
# Description: Installation des dépendances système et applicatives MSSanté
# Usage: ./scripts/setup/install-deps.sh [OPTIONS]
# Systèmes supportés: Ubuntu 22.04+, Debian 12+, Rocky Linux 9+, CentOS Stream 9+
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

# Variables de configuration
INSTALL_DOCKER=true
INSTALL_NODE=true
INSTALL_TOOLS=true
INSTALL_NPM_DEPS=true
SKIP_SYSTEM_UPDATE=false
NON_INTERACTIVE=false
NODE_VERSION="20"
DOCKER_COMPOSE_VERSION="2.24.0"

# Détection du système
OS_TYPE=""
OS_VERSION=""
PKG_MANAGER=""
PKG_INSTALL=""
PKG_UPDATE=""

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

log_step() {
    echo -e "${MAGENTA}➤ $1${NC}"
}

log_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Demande de confirmation
confirm() {
    if [ "$NON_INTERACTIVE" = true ]; then
        return 0
    fi
    local message="${1:-Continuer?}"
    read -p "$message (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Exécution avec sudo si nécessaire
run_sudo() {
    if [ "$EUID" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

# Vérifier si une commande existe
command_exists() {
    command -v "$1" &> /dev/null
}

# Obtenir la version d'un package
get_version() {
    local cmd="$1"
    if command_exists "$cmd"; then
        case "$cmd" in
            docker)
                docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1
                ;;
            node)
                node --version 2>/dev/null | tr -d 'v'
                ;;
            npm)
                npm --version 2>/dev/null
                ;;
            git)
                git --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1
                ;;
            *)
                echo "unknown"
                ;;
        esac
    else
        echo "non installé"
    fi
}

#===============================================================================
# DÉTECTION DU SYSTÈME
#===============================================================================

detect_os() {
    log_header "Détection du système d'exploitation"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_TYPE="$ID"
        OS_VERSION="$VERSION_ID"
    elif [ -f /etc/redhat-release ]; then
        OS_TYPE="rhel"
        OS_VERSION=$(cat /etc/redhat-release | grep -oP '\d+' | head -1)
    else
        log_error "Système d'exploitation non supporté"
        exit 1
    fi
    
    # Configuration du gestionnaire de paquets
    case "$OS_TYPE" in
        ubuntu|debian)
            PKG_MANAGER="apt"
            PKG_INSTALL="apt install -y"
            PKG_UPDATE="apt update"
            ;;
        rocky|centos|rhel|fedora)
            PKG_MANAGER="dnf"
            PKG_INSTALL="dnf install -y"
            PKG_UPDATE="dnf check-update || true"
            ;;
        *)
            log_error "Distribution non supportée: $OS_TYPE"
            log_info "Distributions supportées: Ubuntu, Debian, Rocky Linux, CentOS"
            exit 1
            ;;
    esac
    
    log_success "Système détecté: $OS_TYPE $OS_VERSION"
    log_info "Gestionnaire de paquets: $PKG_MANAGER"
    
    # Vérification de la version minimale
    case "$OS_TYPE" in
        ubuntu)
            if [[ "${OS_VERSION%%.*}" -lt 22 ]]; then
                log_warning "Ubuntu 22.04+ recommandé (actuel: $OS_VERSION)"
            fi
            ;;
        debian)
            if [[ "${OS_VERSION%%.*}" -lt 12 ]]; then
                log_warning "Debian 12+ recommandé (actuel: $OS_VERSION)"
            fi
            ;;
        rocky|centos)
            if [[ "${OS_VERSION%%.*}" -lt 9 ]]; then
                log_warning "Rocky/CentOS 9+ recommandé (actuel: $OS_VERSION)"
            fi
            ;;
    esac
}

#===============================================================================
# MISE À JOUR SYSTÈME
#===============================================================================

update_system() {
    if [ "$SKIP_SYSTEM_UPDATE" = true ]; then
        log_info "Mise à jour système ignorée (--skip-update)"
        return 0
    fi
    
    log_header "Mise à jour du système"
    
    log_step "Mise à jour des dépôts..."
    run_sudo $PKG_UPDATE
    
    if [ "$NON_INTERACTIVE" = true ]; then
        log_step "Mise à jour des paquets..."
        case "$PKG_MANAGER" in
            apt)
                run_sudo apt upgrade -y
                ;;
            dnf)
                run_sudo dnf upgrade -y
                ;;
        esac
    else
        if confirm "Mettre à jour les paquets système?"; then
            log_step "Mise à jour des paquets..."
            case "$PKG_MANAGER" in
                apt)
                    run_sudo apt upgrade -y
                    ;;
                dnf)
                    run_sudo dnf upgrade -y
                    ;;
            esac
        fi
    fi
    
    log_success "Système mis à jour"
}

#===============================================================================
# INSTALLATION DES OUTILS SYSTÈME
#===============================================================================

install_system_tools() {
    if [ "$INSTALL_TOOLS" = false ]; then
        log_info "Installation des outils système ignorée"
        return 0
    fi
    
    log_header "Installation des outils système"
    
    # Liste des paquets communs
    local common_packages=(
        "curl"
        "wget"
        "git"
        "jq"
        "vim"
        "htop"
        "tree"
        "unzip"
        "ca-certificates"
        "gnupg"
        "lsb-release"
    )
    
    # Paquets spécifiques par distribution
    local debian_packages=(
        "apt-transport-https"
        "software-properties-common"
        "build-essential"
        "postgresql-client"
        "redis-tools"
        "net-tools"
        "dnsutils"
        "telnet"
        "openssl"
        "fail2ban"
        "ufw"
    )
    
    local rhel_packages=(
        "postgresql"
        "redis"
        "net-tools"
        "bind-utils"
        "telnet"
        "openssl"
        "fail2ban"
        "firewalld"
        "gcc"
        "gcc-c++"
        "make"
    )
    
    log_step "Installation des paquets de base..."
    
    case "$PKG_MANAGER" in
        apt)
            run_sudo $PKG_INSTALL "${common_packages[@]}" "${debian_packages[@]}"
            ;;
        dnf)
            # Activer EPEL pour certains paquets
            run_sudo dnf install -y epel-release || true
            run_sudo $PKG_INSTALL "${common_packages[@]}" "${rhel_packages[@]}"
            ;;
    esac
    
    log_success "Outils système installés"
    
    # Afficher les versions
    echo ""
    log_info "Versions installées:"
    echo "  - Git: $(get_version git)"
    echo "  - curl: $(curl --version 2>/dev/null | head -1 | cut -d' ' -f2)"
    echo "  - OpenSSL: $(openssl version 2>/dev/null | cut -d' ' -f2)"
}

#===============================================================================
# INSTALLATION DE DOCKER
#===============================================================================

install_docker() {
    if [ "$INSTALL_DOCKER" = false ]; then
        log_info "Installation de Docker ignorée"
        return 0
    fi
    
    log_header "Installation de Docker"
    
    # Vérifier si Docker est déjà installé
    if command_exists docker; then
        local current_version=$(get_version docker)
        log_info "Docker déjà installé (version: $current_version)"
        
        if ! confirm "Réinstaller/mettre à jour Docker?"; then
            # Vérifier Docker Compose
            if ! docker compose version &> /dev/null; then
                log_step "Installation de Docker Compose plugin..."
                install_docker_compose
            fi
            return 0
        fi
    fi
    
    log_step "Suppression des anciennes versions..."
    case "$PKG_MANAGER" in
        apt)
            run_sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            ;;
        dnf)
            run_sudo dnf remove -y docker docker-client docker-client-latest \
                docker-common docker-latest docker-latest-logrotate \
                docker-logrotate docker-engine podman runc 2>/dev/null || true
            ;;
    esac
    
    log_step "Installation de Docker via script officiel..."
    
    # Méthode recommandée: script officiel
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    run_sudo sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
    
    # Configuration post-installation
    log_step "Configuration post-installation..."
    
    # Ajouter l'utilisateur au groupe docker
    if [ "$EUID" -ne 0 ]; then
        run_sudo usermod -aG docker "$USER"
        log_info "Utilisateur $USER ajouté au groupe docker"
    fi
    
    # Démarrer et activer Docker
    run_sudo systemctl enable docker
    run_sudo systemctl start docker
    
    # Installer Docker Compose plugin si pas déjà présent
    install_docker_compose
    
    # Vérification
    log_step "Vérification de l'installation Docker..."
    
    if docker --version &> /dev/null; then
        log_success "Docker installé: $(get_version docker)"
    else
        log_error "Échec de l'installation de Docker"
        exit 1
    fi
    
    if docker compose version &> /dev/null; then
        log_success "Docker Compose installé: $(docker compose version --short)"
    else
        log_error "Échec de l'installation de Docker Compose"
        exit 1
    fi
    
    # Note importante
    echo ""
    log_warning "IMPORTANT: Déconnectez-vous et reconnectez-vous pour"
    log_warning "           que les changements de groupe prennent effet,"
    log_warning "           ou exécutez: newgrp docker"
}

install_docker_compose() {
    log_step "Vérification de Docker Compose..."
    
    # Docker Compose V2 est généralement installé avec Docker
    if docker compose version &> /dev/null; then
        log_success "Docker Compose V2 déjà disponible"
        return 0
    fi
    
    # Installation manuelle si nécessaire
    log_step "Installation de Docker Compose plugin..."
    
    local compose_url="https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)"
    
    run_sudo mkdir -p /usr/local/lib/docker/cli-plugins
    run_sudo curl -SL "$compose_url" -o /usr/local/lib/docker/cli-plugins/docker-compose
    run_sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    
    # Alternative: lien symbolique pour la commande docker-compose
    if [ ! -f /usr/local/bin/docker-compose ]; then
        run_sudo ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
    fi
    
    log_success "Docker Compose installé"
}

#===============================================================================
# INSTALLATION DE NODE.JS
#===============================================================================

install_nodejs() {
    if [ "$INSTALL_NODE" = false ]; then
        log_info "Installation de Node.js ignorée"
        return 0
    fi
    
    log_header "Installation de Node.js ${NODE_VERSION}"
    
    # Vérifier si Node.js est déjà installé
    if command_exists node; then
        local current_version=$(get_version node)
        local major_version="${current_version%%.*}"
        
        log_info "Node.js déjà installé (version: $current_version)"
        
        if [[ "$major_version" -ge "$NODE_VERSION" ]]; then
            log_success "Version suffisante (>= ${NODE_VERSION}.x)"
            
            if ! confirm "Réinstaller Node.js?"; then
                return 0
            fi
        else
            log_warning "Version trop ancienne, mise à jour nécessaire"
        fi
    fi
    
    log_step "Installation de Node.js ${NODE_VERSION}.x via NodeSource..."
    
    case "$PKG_MANAGER" in
        apt)
            # Installation via NodeSource (Debian/Ubuntu)
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | run_sudo bash -
            run_sudo apt install -y nodejs
            ;;
        dnf)
            # Installation via NodeSource (RHEL/CentOS/Rocky)
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | run_sudo bash -
            run_sudo dnf install -y nodejs
            ;;
    esac
    
    # Vérification
    if command_exists node && command_exists npm; then
        log_success "Node.js installé: $(get_version node)"
        log_success "npm installé: $(get_version npm)"
    else
        log_error "Échec de l'installation de Node.js"
        exit 1
    fi
    
    # Mise à jour de npm
    log_step "Mise à jour de npm..."
    run_sudo npm install -g npm@latest
    
    # Installation des outils globaux utiles
    log_step "Installation des outils npm globaux..."
    run_sudo npm install -g \
        pm2 \
        nodemon \
        typescript \
        ts-node \
        eslint \
        prettier
    
    log_success "Outils npm globaux installés"
}

#===============================================================================
# INSTALLATION DES DÉPENDANCES NPM DU PROJET
#===============================================================================

install_npm_dependencies() {
    if [ "$INSTALL_NPM_DEPS" = false ]; then
        log_info "Installation des dépendances npm ignorée"
        return 0
    fi
    
    log_header "Installation des dépendances npm du projet"
    
    cd "$ROOT_DIR"
    
    # Vérifier si Node.js est disponible
    if ! command_exists npm; then
        log_error "npm non disponible. Installez d'abord Node.js"
        return 1
    fi
    
    # Installation des dépendances racine
    if [ -f "package.json" ]; then
        log_step "Installation des dépendances racine..."
        npm install
        log_success "Dépendances racine installées"
    fi
    
    # Installation des dépendances de l'API
    if [ -d "services/api" ] && [ -f "services/api/package.json" ]; then
        log_step "Installation des dépendances API..."
        cd services/api
        npm install
        cd "$ROOT_DIR"
        log_success "Dépendances API installées"
    fi
    
    # Installation des dépendances du Frontend
    if [ -d "services/frontend" ] && [ -f "services/frontend/package.json" ]; then
        log_step "Installation des dépendances Frontend..."
        cd services/frontend
        npm install
        cd "$ROOT_DIR"
        log_success "Dépendances Frontend installées"
    fi
    
    log_success "Toutes les dépendances npm installées"
}

#===============================================================================
# CONFIGURATION DU FIREWALL
#===============================================================================

configure_firewall() {
    log_header "Configuration du firewall"
    
    case "$PKG_MANAGER" in
        apt)
            if command_exists ufw; then
                log_step "Configuration de UFW..."
                
                # Règles par défaut
                run_sudo ufw default deny incoming
                run_sudo ufw default allow outgoing
                
                # Ports à ouvrir
                run_sudo ufw allow 22/tcp comment 'SSH'
                run_sudo ufw allow 80/tcp comment 'HTTP'
                run_sudo ufw allow 443/tcp comment 'HTTPS'
                run_sudo ufw allow 25/tcp comment 'SMTP'
                run_sudo ufw allow 587/tcp comment 'SMTP Submission'
                run_sudo ufw allow 143/tcp comment 'IMAP'
                
                # Activer UFW
                if [ "$NON_INTERACTIVE" = true ]; then
                    echo "y" | run_sudo ufw enable
                else
                    run_sudo ufw enable
                fi
                
                run_sudo ufw status verbose
                log_success "UFW configuré"
            fi
            ;;
        dnf)
            if command_exists firewall-cmd; then
                log_step "Configuration de firewalld..."
                
                run_sudo systemctl enable firewalld
                run_sudo systemctl start firewalld
                
                # Ports à ouvrir
                run_sudo firewall-cmd --permanent --add-service=ssh
                run_sudo firewall-cmd --permanent --add-service=http
                run_sudo firewall-cmd --permanent --add-service=https
                run_sudo firewall-cmd --permanent --add-port=25/tcp
                run_sudo firewall-cmd --permanent --add-port=587/tcp
                run_sudo firewall-cmd --permanent --add-port=143/tcp
                
                run_sudo firewall-cmd --reload
                run_sudo firewall-cmd --list-all
                log_success "firewalld configuré"
            fi
            ;;
    esac
}

#===============================================================================
# CONFIGURATION DE FAIL2BAN
#===============================================================================

configure_fail2ban() {
    log_header "Configuration de Fail2ban"
    
    if ! command_exists fail2ban-client; then
        log_warning "Fail2ban non installé"
        return 0
    fi
    
    log_step "Configuration de Fail2ban..."
    
    # Créer la configuration locale
    run_sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = auto

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[postfix]
enabled = true
port = smtp,465,submission
filter = postfix
logpath = /var/log/mail.log

[dovecot]
enabled = true
port = imap,imaps
filter = dovecot
logpath = /var/log/mail.log
EOF
    
    # Démarrer et activer
    run_sudo systemctl enable fail2ban
    run_sudo systemctl restart fail2ban
    
    log_success "Fail2ban configuré"
}

#===============================================================================
# VÉRIFICATION FINALE
#===============================================================================

verify_installation() {
    log_header "Vérification de l'installation"
    
    local errors=0
    
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│                   RÉCAPITULATIF                            │"
    echo "├─────────────────────────────────────────────────────────────┤"
    
    # Docker
    if command_exists docker; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "Docker" "$(get_version docker)" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "Docker" "non installé" "❌"
        ((errors++))
    fi
    
    # Docker Compose
    if docker compose version &> /dev/null 2>&1; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "Docker Compose" "$(docker compose version --short 2>/dev/null)" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "Docker Compose" "non installé" "❌"
        ((errors++))
    fi
    
    # Node.js
    if command_exists node; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "Node.js" "$(get_version node)" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "Node.js" "non installé" "❌"
        ((errors++))
    fi
    
    # npm
    if command_exists npm; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "npm" "$(get_version npm)" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "npm" "non installé" "❌"
        ((errors++))
    fi
    
    # Git
    if command_exists git; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "Git" "$(get_version git)" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "Git" "non installé" "❌"
        ((errors++))
    fi
    
    # OpenSSL
    if command_exists openssl; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "OpenSSL" "$(openssl version | cut -d' ' -f2)" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "OpenSSL" "non installé" "❌"
        ((errors++))
    fi
    
    # curl
    if command_exists curl; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "curl" "$(curl --version | head -1 | cut -d' ' -f2)" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "curl" "non installé" "❌"
        ((errors++))
    fi
    
    # jq
    if command_exists jq; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "jq" "$(jq --version | tr -d 'jq-')" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "jq" "non installé" "⚠️"
    fi
    
    # make
    if command_exists make; then
        printf "│  %-20s │  %-15s │  %-10s │\n" "make" "$(make --version | head -1 | grep -oP '\d+\.\d+')" "✅"
    else
        printf "│  %-20s │  %-15s │  %-10s │\n" "make" "non installé" "⚠️"
    fi
    
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    
    if [ $errors -eq 0 ]; then
        log_success "Toutes les dépendances critiques sont installées!"
        return 0
    else
        log_error "$errors dépendance(s) critique(s) manquante(s)"
        return 1
    fi
}

#===============================================================================
# AFFICHAGE DES PROCHAINES ÉTAPES
#===============================================================================

show_next_steps() {
    log_header "Prochaines étapes"
    
    echo ""
    echo -e "${CYAN}1. Appliquer les changements de groupe Docker:${NC}"
    echo "   newgrp docker"
    echo "   # Ou déconnectez-vous et reconnectez-vous"
    echo ""
    echo -e "${CYAN}2. Configurer l'environnement:${NC}"
    echo "   ./scripts/setup/setup-env.sh"
    echo ""
    echo -e "${CYAN}3. Démarrer les services:${NC}"
    echo "   docker compose up -d"
    echo ""
    echo -e "${CYAN}4. Vérifier l'installation:${NC}"
    echo "   docker compose ps"
    echo "   curl http://localhost:3000/health"
    echo ""
    
    log_info "Documentation: docs/guides/installation.md"
}

#===============================================================================
# AIDE
#===============================================================================

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Installation des dépendances pour la plateforme MSSanté Opérateur.

OPTIONS:
  --no-docker           Ne pas installer Docker
  --no-node             Ne pas installer Node.js
  --no-tools            Ne pas installer les outils système
  --no-npm              Ne pas installer les dépendances npm
  --skip-update         Ne pas mettre à jour le système
  --node-version VER    Version de Node.js (défaut: 20)
  -y, --yes             Mode non-interactif (accepter tout)
  -h, --help            Afficher cette aide

EXEMPLES:
  $(basename "$0")                    # Installation complète
  $(basename "$0") -y                 # Installation non-interactive
  $(basename "$0") --no-docker        # Sans Docker
  $(basename "$0") --skip-update      # Sans mise à jour système
  $(basename "$0") --node-version 18  # Node.js 18

SYSTÈMES SUPPORTÉS:
  - Ubuntu 22.04+
  - Debian 12+
  - Rocky Linux 9+
  - CentOS Stream 9+

EOF
}

#===============================================================================
# MAIN
#===============================================================================

main() {
    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-docker)
                INSTALL_DOCKER=false
                shift
                ;;
            --no-node)
                INSTALL_NODE=false
                shift
                ;;
            --no-tools)
                INSTALL_TOOLS=false
                shift
                ;;
            --no-npm)
                INSTALL_NPM_DEPS=false
                shift
                ;;
            --skip-update)
                SKIP_SYSTEM_UPDATE=true
                shift
                ;;
            --node-version)
                NODE_VERSION="$2"
                shift 2
                ;;
            -y|--yes)
                NON_INTERACTIVE=true
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
    
    # Header
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}║   🏥 MSSANTÉ OPÉRATEUR - Installation des dépendances     ║${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "  Utilisateur: $(whoami)"
    echo ""
    
    # Vérification des droits
    if [ "$EUID" -ne 0 ] && ! command_exists sudo; then
        log_error "Ce script nécessite les droits sudo"
        exit 1
    fi
    
    # Exécution des étapes
    detect_os
    update_system
    install_system_tools
    install_docker
    install_nodejs
    install_npm_dependencies
    configure_firewall
    configure_fail2ban
    verify_installation
    show_next_steps
    
    echo ""
    log_success "Installation des dépendances terminée!"
    echo ""
}

# Exécution
main "$@"