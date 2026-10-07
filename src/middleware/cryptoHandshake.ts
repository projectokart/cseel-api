import { Request, Response, NextFunction } from 'express';
import { verifyClientToken } from '../utils/crypto';
import { sendError } from '../utils/response';
import { config } from '../config/env';
import { getClientIp, jailIp } from './rateLimiter';

export function cryptoHandshake(req: Request, res: Response, next: NextFunction) {
  // Public health check is always open
  if (req.path === '/health' || req.path === '/v1/health') {
    return next();
  }

  // Token header sent by genuine frontend client
  const token = (req.headers['x-cseel-signature'] || req.headers['x-cseel-token']) as string;

  if (!token) {
    if (config.isProd) {
      const ip = getClientIp(req);
      jailIp(ip, 'Missing dynamic cryptographic handshake token');
      return sendError(res, 'Verification failed: Missing cryptographic client handshake signature.', 403);
    } else {
      // In development mode, log warning but allow request for easier testing
      console.log('[DEV NOTE] Request passed without X-CSEEL-SIGNATURE (development mode)');
      return next();
    }
  }

  const result = verifyClientToken(token);
  if (!result.valid) {
    const ip = getClientIp(req);
    jailIp(ip, `Invalid client signature: ${result.reason}`);
    return sendError(res, `Verification failed: ${result.reason}`, 403);
  }

  next();
}
