import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, meta: Record<string, any> = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    timestamp: new Date().toISOString(),
    ...meta,
    data,
  });
}

export function sendError(res: Response, message: string, statusCode = 400, details?: any) {
  return res.status(statusCode).json({
    success: false,
    timestamp: new Date().toISOString(),
    error: {
      message,
      ...(details ? { details } : {}),
    },
  });
}
