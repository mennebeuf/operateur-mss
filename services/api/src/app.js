/**
 * MSSanté API - Application Express
 * Configuration de l'application Express et des middlewares
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

// Création de l'application Express
const app = express();

// Trust proxy (pour Traefik/Docker)
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARES DE SÉCURITÉ
// ============================================

// Helmet - Headers de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim());
    
    // Autoriser les requêtes sans origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Vérifier si l'origin est autorisé
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Domain'],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400, // 24 heures
};
app.use(cors(corsOptions));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 1000,
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'],
});
app.use(globalLimiter);

// Rate limiting strict pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 tentatives max
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true,
});

// ============================================
// MIDDLEWARES DE PARSING
// ============================================

// Compression des réponses
app.use(compression());

// Parsing JSON avec limite de taille
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Parsing URL-encoded
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// ============================================
// MIDDLEWARES PERSONNALISÉS
// ============================================

// Ajout d'un ID unique à chaque requête
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Logger des requêtes
app.use(requestLogger);

// ============================================
// ROUTES DE SANTÉ (sans auth)
// ============================================

// Health check simple
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'mssante-api',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Health check détaillé (pour monitoring)
app.get('/health/ready', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { redisClient } = require('./config/redis');
    
    // Test PostgreSQL
    const dbResult = await pool.query('SELECT 1');
    const dbOk = dbResult.rows.length > 0;
    
    // Test Redis
    const redisOk = redisClient.isReady;
    
    if (dbOk && redisOk) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          redis: 'ok'
        }
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbOk ? 'ok' : 'failed',
          redis: redisOk ? 'ok' : 'failed'
        }
      });
    }
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Health check de vivacité
app.get('/health/live', (req, res) => {
  res.json({ 
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ROUTES API v1
// ============================================

const API_PREFIX = '/api/v1';

// Routes d'authentification (avec rate limiting strict)
app.use(`${API_PREFIX}/auth`, authLimiter, require('./routes/auth'));

// Routes principales
app.use(`${API_PREFIX}/users`, require('./routes/users'));
app.use(`${API_PREFIX}/mailboxes`, require('./routes/mailboxes'));
app.use(`${API_PREFIX}/domains`, require('./routes/domains'));
app.use(`${API_PREFIX}/certificates`, require('./routes/certificates'));
app.use(`${API_PREFIX}/email`, require('./routes/email'));

// Routes d'administration
app.use(`${API_PREFIX}/admin`, require('./routes/admin'));

// Routes Annuaire ANS
app.use(`${API_PREFIX}/annuaire`, require('./routes/annuaire'));

// Routes Audit
app.use(`${API_PREFIX}/audit`, require('./routes/audit'));

// Documentation Swagger (dev uniquement)
if (process.env.NODE_ENV === 'development') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./config/swagger');
  app.use(`${API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// ============================================
// GESTION DES ERREURS
// ============================================

// Route 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    requestId: req.requestId
  });
});

// Gestionnaire d'erreurs global
app.use(errorHandler);

module.exports = app;