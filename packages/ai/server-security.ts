/**
 * HTTP security helpers for the casuya-ai microservice.
 */

import * as crypto from 'crypto';
import type { IncomingMessage } from 'http';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function readApiKey(): string | undefined {
  const key = process.env.CASUYA_AI_API_KEY || process.env.API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function isAuthorized(expectedKey: string | undefined, headerValue: string | undefined): boolean {
  if (!expectedKey) return true;
  if (!headerValue) return false;
  const provided = headerValue.trim();
  if (provided.length !== expectedKey.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedKey));
}

export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function requireAuthorized(req: IncomingMessage, expectedKey: string | undefined): void {
  const header = req.headers['x-api-key'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!isAuthorized(expectedKey, value)) {
    throw new HttpError(401, 'Invalid or missing API key');
  }
}
