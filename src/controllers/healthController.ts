import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

const startTime = Date.now();

export class HealthController {
  public static check(req: Request, res: Response) {
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    return sendSuccess(res, {
      status: 'operational',
      service: 'cseel-api',
      version: 'v1.0.0',
      uptimeSeconds: uptimeSec,
      security: {
        antiScraping: 'active',
        rateLimiter: 'active',
        botProtection: 'active',
        cryptoHandshake: 'active',
      },
    });
  }
}
