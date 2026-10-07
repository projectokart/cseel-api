import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { corsShield } from './middleware/corsShield';
import { rateLimiter } from './middleware/rateLimiter';
import { botDetection } from './middleware/botDetection';
import { cryptoHandshake } from './middleware/cryptoHandshake';
import { honeypotTrap } from './middleware/honeypot';
import v1Router from './routes/v1';
import healthRouter from './routes/health';
import { sendError } from './utils/response';

export const app = express();

// Trust proxy for Vercel / Cloudflare IP extraction
app.set('trust proxy', 1);

// 1. Strict Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // API returns pure JSON
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Body Parser (limit payload size to prevent DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 3. CORS & Origin Shield
app.use(corsShield);

// 4. Global Scraper Traps (common bot targets)
app.all(['/wp-admin*', '/.env*', '/config.json*', '/backup*'], honeypotTrap);

// 5. Sliding-Window Rate Limiter & Auto-Jail
app.use(rateLimiter);

// 6. Bot & Scraper Heuristic Detection
app.use(botDetection);

// 7. Dynamic Cryptographic Handshake (Human Verification)
app.use(cryptoHandshake);

// 8. Public Health Endpoint (unrestricted)
app.use('/health', healthRouter);

// 9. API v1 Router
app.use('/v1', v1Router);

// 10. Root Welcome Route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'CSEEL Cloud API',
    status: 'online',
    version: '1.0.0',
    documentation: 'Protected API. Authorized client verification required.',
    endpoints: {
      health: '/v1/health',
      experiments: '/v1/experiments',
    },
  });
});

// 11. 404 Not Found Handler
app.use((req: Request, res: Response) => {
  return sendError(res, `Route '${req.method} ${req.originalUrl}' not found.`, 404);
});

// 12. Centralized Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[UNHANDLED ERROR]', err);
  return sendError(res, 'Internal server error occurred.', 500);
});
