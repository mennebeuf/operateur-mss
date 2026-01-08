# =============================================================================
# Dockerfile - Dovecot IMAP MSSanté
# =============================================================================
FROM ubuntu:22.04

LABEL maintainer="MSSanté Operator"
LABEL description="Serveur IMAP Dovecot pour MSSanté"

ENV DEBIAN_FRONTEND=noninteractive

# Installation des paquets
RUN apt-get update && apt-get install -y \
    dovecot-core \
    dovecot-imapd \
    dovecot-lmtpd \
    dovecot-pgsql \
    dovecot-sieve \
    dovecot-managesieved \
    ca-certificates \
    rsyslog \
    supervisor \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Créer les répertoires nécessaires
RUN mkdir -p /var/mail/vhosts \
    && mkdir -p /var/log/dovecot \
    && mkdir -p /etc/dovecot/conf.d \
    && mkdir -p /etc/ssl/certs/mssante \
    && mkdir -p /etc/ssl/igc-sante \
    && mkdir -p /var/run/dovecot

# Créer l'utilisateur vmail
RUN groupadd -g 5000 vmail \
    && useradd -g vmail -u 5000 vmail -d /var/mail \
    && chown -R vmail:vmail /var/mail

# Copier les configurations
COPY config/dovecot.conf /etc/dovecot/dovecot.conf
COPY config/dovecot-sql.conf.ext /etc/dovecot/dovecot-sql.conf.ext
COPY config/conf.d/ /etc/dovecot/conf.d/

# Copier les scripts
COPY scripts/entrypoint.sh /entrypoint.sh
COPY scripts/healthcheck.sh /healthcheck.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh

# Configuration supervisord
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Permissions
RUN chown -R root:root /etc/dovecot \
    && chmod 640 /etc/dovecot/dovecot-sql.conf.ext \
    && chown -R vmail:dovecot /var/run/dovecot

# Exposer les ports IMAP
EXPOSE 143 993 24 12345

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD /healthcheck.sh || exit 1

# Point d'entrée
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]