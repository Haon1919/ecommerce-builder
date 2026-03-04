import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { connectDB, disconnectDB } from './db';
import { logger, morganStream } from './utils/logger';
import { requestLogger, responseTime, scrubPIIForSuperAdmin } from './middleware/security';
import { verifyToken } from './middleware/auth';
import { runAnomalyChecks, recordMetric } from './services/anomaly';
import { cleanupOldData } from './services/cleanup';

import authRouter from './routes/auth';
import storesRouter from './routes/stores';
import pagesRouter from './routes/pages';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import messagesRouter from './routes/messages';
import ticketsRouter from './routes/tickets';
import chatRouter from './routes/chat';
import analyticsRouter from './routes/analytics';
import logsRouter, { setSocketIO } from './routes/logs';
import experimentsRouter from './routes/experiments';
import companiesRouter from './routes/companies';
import pricelistsRouter from './routes/pricelists';

const app = express();
const httpServer = http.createServer(app);

// ==================== SOCKET.IO (Live Logs) ====================
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.allowedOrigins,
    credentials: true,
  },
});

// Authenticate socket connections — token is re-verified on each 'subscribe' event
io.use((socket, next) => {
  const token = socket.handshake.auth.token as string;
  if (!token) return next(new Error('Authentication required'));
  try {
    const user = verifyToken(token);
    if (user.type !== 'SUPER_ADMIN') return next(new Error('Super admin access required'));
    (socket as typeof socket & { user: typeof user }).user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as typeof socket & { user: { type: string; sub: string } }).user;

  socket.join('super-admin-logs');
  logger.info('Super admin connected to live logs', { socketId: socket.id, adminId: user.sub });

  // Re-verify the token periodically — if it has expired, disconnect the socket
  const reAuthInterval = setInterval(() => {
    const token = socket.handshake.auth.token as string;
    try {
      verifyToken(token);
    } catch {
      logger.warn('Socket token expired, disconnecting', { socketId: socket.id });
      socket.emit('auth_error', 'Session expired, please log in again');
      socket.disconnect(true);
    }
  }, 60 * 1000); // check every minute

  socket.on('disconnect', () => {
    clearInterval(reAuthInterval);
    logger.debug('Socket disconnected', { socketId: socket.id });
  });
});

setSocketIO(io);

// ==================== MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://www.googletagmanager.com'],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan('combined', { stream: morganStream }));
app.use(responseTime);
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});
app.use('/api', limiter);

// Stricter rate limit for auth — per IP, 10 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts toward the limit
  message: { error: 'Too many authentication attempts, please try again later' },
});
app.use('/api/auth', authLimiter);

// PII scrubbing for super admin endpoints
app.use('/api', scrubPIIForSuperAdmin);

// ==================== ROUTES ====================
app.use('/api/auth', authRouter);
app.use('/api/stores', storesRouter);
app.use('/api/stores', pagesRouter);
app.use('/api/stores', productsRouter);
app.use('/api/stores', ordersRouter);
app.use('/api/stores', messagesRouter);
app.use('/api/stores', ticketsRouter);
app.use('/api/stores', chatRouter);
app.use('/api/stores', analyticsRouter);
app.use('/api/stores', experimentsRouter);
app.use('/api/stores', companiesRouter);
app.use('/api/stores', pricelistsRouter);
app.use('/api/tickets', ticketsRouter);      // Super admin ticket access
app.use('/api/analytics', analyticsRouter);  // Super admin analytics
app.use('/api/logs', logsRouter);

// Health check
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
  });
});

// 404 handler
app.use((_, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== STARTUP ====================
async function start() {
  await connectDB();

  // Log validated CORS origins so misconfiguration is immediately visible
  logger.info('CORS allowed origins', { origins: config.cors.allowedOrigins });
  if (config.cors.allowedOrigins.length === 0) {
    logger.warn('No CORS origins configured — all cross-origin requests will be blocked');
  }

  // Run initial cleanup
  cleanupOldData().catch(err => logger.error('Initial cleanup error', { error: err }));
  // Schedule cleanup every 24 hours
  setInterval(cleanupOldData, 24 * 60 * 60 * 1000);

  // Start anomaly detection scheduler
  setInterval(async () => {
    try {
      await runAnomalyChecks();
      await recordMetric('api_requests', Math.random() * 100); // Would use real count in prod
    } catch (err) {
      logger.error('Scheduler error', { error: err });
    }
  }, config.anomaly.snapshotIntervalMs);

  httpServer.listen(config.port, () => {
    logger.info(`API server running on port ${config.port}`, {
      env: config.env,
      port: config.port,
    });
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});

export default app;
