import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { getClientIp, jailIp } from './rateLimiter';
import { config } from '../config/env';

// Known bot and scraper user-agent patterns
const BOT_UA_PATTERNS = [
  /python-requests/i,
  /aiohttp/i,
  /urllib/i,
  /scrapy/i,
  /curl\//i,
  /wget\//i,
  /postman/i,
  /headlesschrome/i,
  /phantomjs/i,
  /playwright/i,
  /selenium/i,
  /puppeteer/i,
  /go-http-client/i,
  /java\//i,
  /httpclient/i,
  /node-fetch/i,
  /axios/i, // external scripts using axios directly without browser context
  /libwww-perl/i,
];

export function botDetection(req: Request, res: Response, next: NextFunction) {
  // Allow health endpoint unconditionally
  if (req.path === '/health' || req.path === '/v1/health') {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';
  const ip = getClientIp(req);

  // 1. Missing or empty User-Agent
  if (!userAgent || userAgent.trim().length < 5) {
    jailIp(ip, 'Missing User-Agent (Bot heuristic)');
    return sendError(res, 'Access denied: Invalid client environment.', 403);
  }

  // 2. Check against known bot / scraper signatures
  // In development, relax axios/node-fetch if needed for local tests, but block in production
  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      if (config.isProd) {
        jailIp(ip, `Scraper signature matched: ${pattern}`);
        console.warn(`[BOT BLOCKED] IP ${ip} blocked with UA: "${userAgent}"`);
        return sendError(res, 'Automated scraping and programmatic dumping is strictly forbidden.', 403);
      }
    }
  }

  // 3. Inspect Browser Metadata Headers (Sec-Fetch) in production
  // Real modern browsers always include Sec-Fetch-Dest, Sec-Fetch-Mode, or Sec-Fetch-Site when fetching data
  if (config.isProd) {
    const secFetchSite = req.headers['sec-fetch-site'];
    const secFetchMode = req.headers['sec-fetch-mode'];

    // If both origin and sec-fetch headers are completely absent, it's a CLI tool or headless bot
    const origin = req.headers.origin || req.headers.referer;
    if (!origin && !secFetchSite && !secFetchMode) {
      jailIp(ip, 'Missing browser security headers (Headless bot)');
      return sendError(res, 'Access denied: Browser context verification failed.', 403);
    }
  }

  next();
}
