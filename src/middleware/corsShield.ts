import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { sendError } from '../utils/response';

export function corsShield(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || req.headers.referer;

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSEEL-SIGNATURE, X-CSEEL-CLIENT-ID, X-Requested-With'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // In development, allow localhost and testing tools
  if (!config.isProd) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSEEL-SIGNATURE, X-CSEEL-CLIENT-ID, X-Requested-With'
    );
    return next();
  }

  // In production, enforce origin whitelisting
  if (origin) {
    const isAllowed = config.allowedOrigins.some((allowed) => origin.startsWith(allowed));
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-CSEEL-SIGNATURE, X-CSEEL-CLIENT-ID, X-Requested-With'
      );
      return next();
    } else {
      console.warn(`[CORS REJECTED] Unauthorized origin attempt: ${origin}`);
      return sendError(res, 'Access denied: Unauthorized domain or cross-origin request blocked.', 403);
    }
  }

  // If no origin/referer on browser data-fetching routes, pass to botDetection for deep inspection
  next();
}
