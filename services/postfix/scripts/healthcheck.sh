#!/bin/bash
# =============================================================================
# Health check Postfix
# =============================================================================

# Vérifier que Postfix est en cours d'exécution
if ! pgrep -x "master" > /dev/null; then
    echo "ERREUR: Postfix master non trouvé"
    exit 1
fi

# Vérifier le port SMTP
if ! nc -z localhost 25; then
    echo "ERREUR: Port 25 non accessible"
    exit 1
fi

# Vérifier le port submission (587)
if ! nc -z localhost 587; then
    echo "ATTENTION: Port 587 non accessible"
    # Ne pas échouer pour le port 587
fi

# Test SMTP basique
RESPONSE=$(echo "QUIT" | nc -w 5 localhost 25 2>/dev/null | head -1)
if [[ ! "$RESPONSE" =~ ^220 ]]; then
    echo "ERREUR: Réponse SMTP invalide: $RESPONSE"
    exit 1
fi

echo "OK: Postfix opérationnel"
exit 0