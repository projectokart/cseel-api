import { Request, Response } from 'express';
import { getClientIp, jailIp } from './rateLimiter';
import { sendError } from '../utils/response';

/**
 * Honeypot handler: If a crawler touches this, immediately ban for 24 hours.
 */
export function honeypotTrap(req: Request, res: Response) {
  const ip = getClientIp(req);
  const path = req.originalUrl || req.path;
  const userAgent = req.headers['user-agent'] || 'unknown';

  // 24 hour jail
  jailIp(ip, `Triggered scraper honeypot trap: ${path} (UA: ${userAgent})`, 24 * 60 * 60 * 1000);

  // Return deceptive 404 or 403
  return sendError(res, 'Access denied: Security violation recorded.', 403);
}
