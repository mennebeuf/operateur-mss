# Certificats de domaine MSSanté

Ce répertoire contient les certificats SSL/TLS IGC Santé pour chaque domaine hébergé par l'opérateur.

## Structure

```
domains/
├── README.md                              # Ce fichier
├── .gitkeep                               # Fichier de tracking Git
├── hopital-paris.mssante.fr/
│   ├── cert.pem                           # Certificat serveur
│   ├── key.pem                            # Clé privée (600)
│   └── chain.pem                          # Chaîne de certification complète
├── clinique-lyon.mssante.fr/
│   ├── cert.pem
│   ├── key.pem
│   └── chain.pem
└── laboratoire-lille.mssante.fr/
    ├── cert.pem
    ├── key.pem
    └── chain.pem
```

## Fichiers par domaine

| Fichier | Description | Permissions |
|---------|-------------|-------------|
| `cert.pem` | Certificat serveur IGC Santé | `644` |
| `key.pem` | Clé privée associée | `600` (lecture root uniquement) |
| `chain.pem` | Chaîne complète (cert + intermédiaires) | `644` |

## Installation d'un certificat

### Via le script automatisé (recommandé)

```bash
./scripts/certificates/install-domain-cert.sh \
  votre-domaine.mssante.fr \
  /chemin/vers/cert.pem \
  /chemin/vers/key.pem
```

Le script effectue automatiquement :
1. Création du répertoire du domaine
2. Copie et renommage des fichiers
3. Application des permissions correctes
4. Vérification du certificat
5. Mise à jour de la base de données
6. Rechargement de Postfix et Dovecot

### Installation manuelle

```bash
# 1. Créer le répertoire du domaine
DOMAIN="votre-domaine.mssante.fr"
mkdir -p config/certificates/domains/$DOMAIN

# 2. Copier les certificats
cp /path/to/certificat.pem config/certificates/domains/$DOMAIN/cert.pem
cp /path/to/cle-privee.pem config/certificates/domains/$DOMAIN/key.pem

# 3. Créer la chaîne complète (optionnel mais recommandé)
cat config/certificates/domains/$DOMAIN/cert.pem \
    config/certificates/igc-sante/ca-bundle.pem \
    > config/certificates/domains/$DOMAIN/chain.pem

# 4. Appliquer les permissions
chmod 644 config/certificates/domains/$DOMAIN/cert.pem
chmod 600 config/certificates/domains/$DOMAIN/key.pem
chmod 644 config/certificates/domains/$DOMAIN/chain.pem

# 5. Vérifier le certificat
openssl x509 -in config/certificates/domains/$DOMAIN/cert.pem -noout -subject -dates

# 6. Recharger les services
docker compose exec postfix postfix reload
docker compose exec dovecot doveadm reload
```

## Vérification des certificats

### Afficher les informations

```bash
# Informations générales
openssl x509 -in cert.pem -noout -text

# Sujet et dates uniquement
openssl x509 -in cert.pem -noout -subject -dates

# Numéro de série
openssl x509 -in cert.pem -noout -serial

# Empreinte SHA256
openssl x509 -in cert.pem -noout -fingerprint -sha256
```

### Vérifier la correspondance clé/certificat

```bash
# Les deux commandes doivent retourner le même hash
openssl x509 -in cert.pem -noout -modulus | openssl md5
openssl rsa -in key.pem -noout -modulus | openssl md5
```

### Vérifier la chaîne de certification

```bash
openssl verify -CAfile ../igc-sante/ca-bundle.pem cert.pem
```

## Renouvellement

### Surveillance de l'expiration

```bash
# Vérifier tous les certificats
./scripts/certificates/check-expiry.sh

# Vérifier un domaine spécifique
openssl x509 -in config/certificates/domains/$DOMAIN/cert.pem \
  -noout -checkend 2592000  # 30 jours
```

### Procédure de renouvellement

1. Commander le nouveau certificat auprès de l'IGC Santé
2. Sauvegarder l'ancien certificat
3. Installer le nouveau avec le script
4. Vérifier le bon fonctionnement
5. Supprimer l'ancienne sauvegarde après validation

```bash
# Sauvegarde préventive
cp config/certificates/domains/$DOMAIN/cert.pem \
   config/certificates/domains/$DOMAIN/cert.pem.bak.$(date +%Y%m%d)

# Installation du nouveau certificat
./scripts/certificates/install-domain-cert.sh $DOMAIN /path/to/new/cert.pem /path/to/new/key.pem

# Test de connexion
openssl s_client -connect mail.$DOMAIN:587 -starttls smtp
```

## Sécurité

### Bonnes pratiques

- **Ne jamais commiter les clés privées** dans Git
- Les fichiers `.pem` et `.key` sont exclus via `.gitignore`
- Permissions `600` obligatoires sur les clés privées
- Sauvegardes chiffrées des clés privées
- Rotation régulière (annuelle minimum)

### Vérification des permissions

```bash
# Vérifier les permissions de tous les domaines
find config/certificates/domains -name "key.pem" -exec ls -la {} \;

# Corriger les permissions si nécessaire
find config/certificates/domains -name "key.pem" -exec chmod 600 {} \;
find config/certificates/domains -name "cert.pem" -exec chmod 644 {} \;
find config/certificates/domains -name "chain.pem" -exec chmod 644 {} \;
```

## Utilisation par les services

### Postfix (SMTP)

Les certificats sont chargés dynamiquement via SNI (Server Name Indication) :

```conf
# services/postfix/pgsql-sni-maps.cf
query = SELECT CONCAT('/etc/ssl/domains/', domain_name, '/cert.pem') as cert_file
        FROM domains WHERE domain_name = '%s' AND status = 'active'
```

### Dovecot (IMAP)

Configuration avec template de chemin :

```conf
# services/dovecot/dovecot.conf
ssl_cert = </etc/ssl/domains/%d/cert.pem
ssl_key = </etc/ssl/domains/%d/key.pem
```

### Traefik (HTTPS)

Les certificats sont référencés dans la configuration dynamique pour chaque domaine.

## Dépannage

### Erreur "certificate verify failed"

```bash
# Vérifier la chaîne complète
openssl verify -verbose -CAfile ../igc-sante/ca-bundle.pem chain.pem
```

### Erreur "key does not match certificate"

```bash
# Comparer les modulus
diff <(openssl x509 -in cert.pem -noout -modulus) \
     <(openssl rsa -in key.pem -noout -modulus)
```

### Certificat expiré

```bash
# Vérifier la date d'expiration
openssl x509 -in cert.pem -noout -enddate

# Procéder au renouvellement immédiat
```

## Contact

Pour toute question sur les certificats IGC Santé :
- Support ANS : support@esante.gouv.fr
- Documentation : https://esante.gouv.fr/securite/igc-sante
