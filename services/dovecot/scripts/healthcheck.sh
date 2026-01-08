#!/bin/bash
# =============================================================================
# Health check Dovecot
# =============================================================================

# Vérifier que Dovecot est en cours d'exécution
if ! pgrep -x "dovecot" > /dev/null; then
    echo "ERREUR: Dovecot non trouvé"
    exit 1
fi

# Vérifier le port IMAP (143)
if ! nc -z localhost 143; then
    echo "ERREUR: Port IMAP 143 non accessible"
    exit 1
fi

# Vérifier le port IMAPS (993) si SSL activé
if [ -f "/etc/ssl/certs/mssante/server.crt" ]; then
    if ! nc -z localhost 993; then
        echo "ATTENTION: Port IMAPS 993 non accessible"
    fi
fi

# Vérifier le port LMTP (24)
if ! nc -z localhost 24; then
    echo "ATTENTION: Port LMTP 24 non accessible"
fi

# Test IMAP basique
RESPONSE=$(echo -e "A001 CAPABILITY\nA002 LOGOUT" | nc -w 5 localhost 143 2>/dev/null | head -1)
if [[ ! "$RESPONSE" =~ ^\* ]]; then
    echo "ERREUR: Réponse IMAP invalide: $RESPONSE"
    exit 1
fi

# Vérifier via doveadm
if command -v doveadm &> /dev/null; then
    doveadm service status > /dev/null 2>&1 || {
        echo "ATTENTION: doveadm service status a échoué"
    }
fi

echo "OK: Dovecot opérationnel"
exit 0