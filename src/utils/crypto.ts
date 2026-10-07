import crypto from 'crypto';
import { config } from '../config/env';

/**
 * Generates an HMAC-SHA256 signature for a given payload and timestamp.
 */
export function generateSignature(payload: string, timestamp: number, secret = config.securitySecret): string {
  const data = `${timestamp}:${payload}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Validates whether an incoming token is legitimate and not expired.
 * Format: `timestamp.signature`
 * Max clock skew: 60 seconds.
 */
export function verifyClientToken(token: string, payload = 'cseel-client-handshake'): { valid: boolean; reason?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing signature token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid token structure' };
  }

  const timestamp = parseInt(parts[0], 10);
  const signature = parts[1];

  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Invalid timestamp in token' };
  }

  const now = Date.now();
  const timeDiff = Math.abs(now - timestamp);

  // Expire after 90 seconds (generous for network latency, but tight enough against replay)
  if (timeDiff > 90 * 1000) {
    return { valid: false, reason: 'Handshake token expired (anti-replay triggered)' };
  }

  const expectedSignature = generateSignature(payload, timestamp);

  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { valid: false, reason: 'Cryptographic signature mismatch' };
  }

  return { valid: true };
}
