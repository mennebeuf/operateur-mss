// services/api/src/services/dnsService.js
const dns = require('dns').promises;
const { exec } = require('child_process');
const util = require('util');
const logger = require('../utils/logger');

const execPromise = util.promisify(exec);

/**
 * Service de vérification et gestion DNS
 * Vérifie les enregistrements MX, SPF, DKIM, DMARC pour les domaines MSSanté
 */
class DnsService {
  constructor() {
    this.dnsTimeout = parseInt(process.env.DNS_TIMEOUT || '5000');
    this.dnsServers = (process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(',');
    dns.setServers(this.dnsServers);
  }

  /**
   * Vérifie tous les enregistrements DNS d'un domaine
   */
  async verifyDomain(domain) {
    const results = {
      domain,
      timestamp: new Date().toISOString(),
      checks: {},
      isValid: true,
      errors: [],
      warnings: []
    };

    results.checks.mx = await this.checkMX(domain);
    if (!results.checks.mx.valid) {
      results.isValid = false;
      results.errors.push('Enregistrements MX manquants ou invalides');
    }

    results.checks.spf = await this.checkSPF(domain);
    if (!results.checks.spf.valid) {
      results.warnings.push('Enregistrement SPF manquant ou invalide');
    }

    results.checks.dkim = await this.checkDKIM(domain);
    if (!results.checks.dkim.valid) {
      results.warnings.push('Enregistrement DKIM non trouvé');
    }

    results.checks.dmarc = await this.checkDMARC(domain);
    if (!results.checks.dmarc.valid) {
      results.warnings.push('Enregistrement DMARC manquant');
    }

    results.checks.a = await this.checkA(domain);

    logger.info(`Vérification DNS ${domain}`, { isValid: results.isValid, errors: results.errors });
    return results;
  }

  /**
   * Vérifie les enregistrements MX
   */
  async checkMX(domain) {
    try {
      const records = await dns.resolveMx(domain);
      
      if (!records || records.length === 0) {
        return { valid: false, error: 'Aucun enregistrement MX trouvé', records: [] };
      }

      const sortedRecords = records.sort((a, b) => a.priority - b.priority);
      
      return {
        valid: true,
        records: sortedRecords.map(r => ({
          priority: r.priority,
          exchange: r.exchange
        }))
      };
    } catch (error) {
      return { valid: false, error: error.message, records: [] };
    }
  }

  /**
   * Vérifie l'enregistrement SPF
   */
  async checkSPF(domain) {
    try {
      const records = await dns.resolveTxt(domain);
      const spfRecord = records.flat().find(r => r.startsWith('v=spf1'));

      if (!spfRecord) {
        return { valid: false, error: 'Enregistrement SPF non trouvé' };
      }

      const analysis = this.analyzeSPF(spfRecord);
      
      return {
        valid: true,
        record: spfRecord,
        analysis
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Analyse un enregistrement SPF
   */
  analyzeSPF(spf) {
    const analysis = {
      mechanisms: [],
      includes: [],
      all: null,
      warnings: []
    };

    const parts = spf.split(' ');
    for (const part of parts) {
      if (part.startsWith('include:')) {
        analysis.includes.push(part.substring(8));
      } else if (part.startsWith('ip4:') || part.startsWith('ip6:')) {
        analysis.mechanisms.push(part);
      } else if (part.startsWith('a') || part.startsWith('mx')) {
        analysis.mechanisms.push(part);
      } else if (part.endsWith('all')) {
        analysis.all = part;
        if (part === '+all') {
          analysis.warnings.push('SPF avec +all est dangereux');
        }
      }
    }

    return analysis;
  }

  /**
   * Vérifie l'enregistrement DKIM
   */
  async checkDKIM(domain, selector = 'default') {
    const selectors = [selector, 'mail', 'dkim', 'selector1', 'selector2'];
    
    for (const sel of selectors) {
      try {
        const dkimDomain = `${sel}._domainkey.${domain}`;
        const records = await dns.resolveTxt(dkimDomain);
        const dkimRecord = records.flat().find(r => r.includes('v=DKIM1'));

        if (dkimRecord) {
          return {
            valid: true,
            selector: sel,
            record: dkimRecord,
            keyType: dkimRecord.includes('k=rsa') ? 'RSA' : 'Unknown'
          };
        }
      } catch (e) {
        continue;
      }
    }

    return { valid: false, error: 'Aucun enregistrement DKIM trouvé' };
  }

  /**
   * Vérifie l'enregistrement DMARC
   */
  async checkDMARC(domain) {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const records = await dns.resolveTxt(dmarcDomain);
      const dmarcRecord = records.flat().find(r => r.startsWith('v=DMARC1'));

      if (!dmarcRecord) {
        return { valid: false, error: 'Enregistrement DMARC non trouvé' };
      }

      const analysis = this.analyzeDMARC(dmarcRecord);
      
      return {
        valid: true,
        record: dmarcRecord,
        analysis
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Analyse un enregistrement DMARC
   */
  analyzeDMARC(dmarc) {
    const analysis = { policy: null, subdomainPolicy: null, rua: null, ruf: null, pct: 100 };
    const parts = dmarc.split(';').map(p => p.trim());

    for (const part of parts) {
      const [key, value] = part.split('=');
      switch (key) {
        case 'p': analysis.policy = value; break;
        case 'sp': analysis.subdomainPolicy = value; break;
        case 'rua': analysis.rua = value; break;
        case 'ruf': analysis.ruf = value; break;
        case 'pct': analysis.pct = parseInt(value); break;
      }
    }

    return analysis;
  }

  /**
   * Vérifie les enregistrements A/AAAA
   */
  async checkA(domain) {
    const result = { valid: false, ipv4: [], ipv6: [] };

    try {
      result.ipv4 = await dns.resolve4(domain);
      result.valid = true;
    } catch (e) {}

    try {
      result.ipv6 = await dns.resolve6(domain);
      result.valid = true;
    } catch (e) {}

    return result;
  }

  /**
   * Génère les enregistrements DNS recommandés
   */
  generateRecommendedRecords(domain, config = {}) {
    const mailServer = config.mailServer || `mail.${domain}`;
    const serverIP = config.serverIP || 'VOTRE_IP';
    const dkimKey = config.dkimPublicKey || 'VOTRE_CLE_DKIM';

    return {
      mx: [
        { priority: 10, value: mailServer },
        { priority: 20, value: `backup.${mailServer}` }
      ],
      a: [
        { name: 'mail', value: serverIP }
      ],
      txt: [
        {
          name: '@',
          value: `v=spf1 mx ip4:${serverIP} -all`,
          description: 'SPF - Autorise le serveur mail à envoyer'
        },
        {
          name: 'default._domainkey',
          value: `v=DKIM1; k=rsa; p=${dkimKey}`,
          description: 'DKIM - Signature des emails'
        },
        {
          name: '_dmarc',
          value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; pct=100`,
          description: 'DMARC - Politique de traitement'
        }
      ]
    };
  }

  /**
   * Test de connectivité SMTP vers un domaine
   */
  async testSMTPConnectivity(domain, port = 25) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords.length) {
        return { success: false, error: 'Pas de MX' };
      }

      const mxHost = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
      
      const { stdout } = await execPromise(
        `timeout 10 bash -c "echo 'QUIT' | nc -w 5 ${mxHost} ${port}" 2>&1 || echo "FAILED"`
      );

      const success = stdout.includes('220') || stdout.includes('SMTP');
      
      return {
        success,
        mxHost,
        port,
        response: stdout.substring(0, 200)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifie le reverse DNS d'une IP
   */
  async checkReverseDNS(ip) {
    try {
      const hostnames = await dns.reverse(ip);
      return {
        valid: hostnames.length > 0,
        ip,
        hostnames
      };
    } catch (error) {
      return { valid: false, ip, error: error.message };
    }
  }

  /**
   * Vérifie si un domaine est dans une blacklist
   */
  async checkBlacklists(ip, domain) {
    const blacklists = [
      'zen.spamhaus.org',
      'bl.spamcop.net',
      'b.barracudacentral.org'
    ];

    const results = [];
    const reversedIP = ip.split('.').reverse().join('.');

    for (const bl of blacklists) {
      try {
        await dns.resolve4(`${reversedIP}.${bl}`);
        results.push({ blacklist: bl, listed: true });
      } catch (e) {
        results.push({ blacklist: bl, listed: false });
      }
    }

    return {
      ip,
      domain,
      results,
      isBlacklisted: results.some(r => r.listed)
    };
  }
}

module.exports = new DnsService();