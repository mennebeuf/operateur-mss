# =============================================================================
# Dockerfile - Postfix SMTP MSSanté
# =============================================================================
FROM ubuntu:22.04

LABEL maintainer="MSSanté Operator"
LABEL description="Serveur SMTP Postfix pour MSSanté"

ENV DEBIAN_FRONTEND=noninteractive

# Installation des paquets
RUN apt-get update && apt-get install -y \
    postfix \
    postfix-pgsql \
    postfix-pcre \
    libsasl2-modules \
    sasl2-bin \
    opendkim \
    opendkim-tools \
    ca-certificates \
    rsyslog \
    supervisor \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Créer les répertoires nécessaires
RUN mkdir -p /var/spool/postfix/pid \
    && mkdir -p /var/mail/vhosts \
    && mkdir -p /var/log/postfix \
    && mkdir -p /etc/postfix/sql \
    && mkdir -p /etc/ssl/certs/mssante \
    && mkdir -p /etc/ssl/igc-sante

# Copier les configurations
COPY config/main.cf /etc/postfix/main.cf
COPY config/master.cf /etc/postfix/master.cf
COPY config/pgsql-virtual-domains.cf /etc/postfix/sql/
COPY config/pgsql-virtual-mailboxes.cf /etc/postfix/sql/
COPY config/pgsql-virtual-aliases.cf /etc/postfix/sql/

# Copier les scripts
COPY scripts/entrypoint.sh /entrypoint.sh
COPY scripts/healthcheck.sh /healthcheck.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh

# Configuration supervisord
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Permissions
RUN chown -R postfix:postfix /var/spool/postfix \
    && chown -R root:root /etc/postfix \
    && chmod 640 /etc/postfix/sql/*.cf

# Exposer les ports SMTP
EXPOSE 25 587

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD /healthcheck.sh || exit 1

# Point d'entrée
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]