import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  jailedUntil?: number;
}

const ipStore = new Map<string, RateLimitEntry>();

// Config
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute
const JAIL_DURATION_MS = 15 * 60 * 1000; // 15 minutes auto-jail

/**
 * Gets real client IP from headers (behind Vercel / Cloudflare reverse proxy)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string') {
    return cfIp.trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Manually jail a malicious IP (e.g., honeypot trigger)
 */
export function jailIp(ip: string, reason = 'Malicious activity detected', durationMs = JAIL_DURATION_MS) {
  const entry = ipStore.get(ip) || { count: 0, resetAt: Date.now() + WINDOW_MS };
  entry.jailedUntil = Date.now() + durationMs;
  ipStore.set(ip, entry);
  console.warn(`[SECURITY JAIL] IP ${ip} jailed for ${durationMs / 60000} minutes. Reason: ${reason}`);
}

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();

  const entry = ipStore.get(ip);

  // Check if IP is currently jailed
  if (entry?.jailedUntil && now < entry.jailedUntil) {
    const remainingSec = Math.ceil((entry.jailedUntil - now) / 1000);
    res.setHeader('Retry-After', remainingSec);
    return sendError(
      res,
      `Your IP has been temporarily restricted due to excessive traffic or suspicious activity. Try again in ${remainingSec} seconds.`,
      429,
      { retryAfter: remainingSec }
    );
  }

  // If window expired or new IP, reset
  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - 1);
    return next();
  }

  // Increment request count
  entry.count += 1;
  const remaining = Math.max(0, MAX_REQUESTS - entry.count);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);

  if (entry.count > MAX_REQUESTS) {
    // Exceeded limit: automatically jail IP
    entry.jailedUntil = now + JAIL_DURATION_MS;
    console.warn(`[RATE LIMIT EXCEEDED] IP ${ip} exceeded limit (${entry.count}/${MAX_REQUESTS}). Jailed.`);
    res.setHeader('Retry-After', Math.ceil(JAIL_DURATION_MS / 1000));
    return sendError(
      res,
      'Rate limit exceeded. Too many requests. Your IP has been temporarily blocked for 15 minutes.',
      429
    );
  }

  next();
}

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipStore.entries()) {
    if (now > entry.resetAt && (!entry.jailedUntil || now > entry.jailedUntil)) {
      ipStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);
