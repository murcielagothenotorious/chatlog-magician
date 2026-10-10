import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

export const CLOUD_SESSION_COOKIE = 'cm_cloud_session';
const MAX_AGE_SECONDS = 31536000;
const MAX_FUTURE_SECONDS = 300;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signSession(ownerId: string, issuedAt: number, sessionSecret: string): string {
  return crypto
    .createHmac('sha256', sessionSecret)
    .update(`${ownerId}.${issuedAt}`)
    .digest('base64url');
}

function isLocalhostOrigin(origin: unknown): boolean {
  if (typeof origin !== 'string') return false;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export interface IssueCloudSessionInput {
  ownerId: string;
  sessionSecret: string;
  now?: number;
  requestOrigin?: string;
}

export function issueCloudSession({
  ownerId,
  sessionSecret,
  now = Date.now(),
  requestOrigin,
}: IssueCloudSessionInput): string {
  if (
    !UUID_PATTERN.test(ownerId) ||
    typeof sessionSecret !== 'string' ||
    sessionSecret.length < 32
  ) {
    throw new TypeError('Invalid cloud session input');
  }

  const issuedAt = Math.floor(now / 1000);
  const signature = signSession(ownerId, issuedAt, sessionSecret);
  const attributes = [
    `${CLOUD_SESSION_COOKIE}=${ownerId}.${issuedAt}.${signature}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (!isLocalhostOrigin(requestOrigin)) attributes.push('Secure');
  return attributes.join('; ');
}

function readCookie(cookieHeader: unknown): string | null {
  if (typeof cookieHeader !== 'string') return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === CLOUD_SESSION_COOKIE) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function signaturesMatch(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received || '', 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (receivedBytes.length !== expectedBytes.length) {
    crypto.timingSafeEqual(expectedBytes, Buffer.alloc(expectedBytes.length));
    return false;
  }
  return crypto.timingSafeEqual(receivedBytes, expectedBytes);
}

export interface VerifyCloudSessionInput {
  sessionSecret: string;
  now?: number;
}

export interface VerifiedCloudSession {
  ownerId: string;
  issuedAt: number;
}

export function verifyCloudSession(
  cookieHeader: unknown,
  { sessionSecret, now = Date.now() }: VerifyCloudSessionInput
): VerifiedCloudSession | null {
  try {
    if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) return null;
    const value = readCookie(cookieHeader);
    if (!value) return null;

    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const [ownerId, issuedAtRaw, signature] = parts;
    if (!UUID_PATTERN.test(ownerId) || !/^\d+$/.test(issuedAtRaw)) return null;

    const issuedAt = Number(issuedAtRaw);
    const nowSeconds = Math.floor(now / 1000);
    if (!Number.isSafeInteger(issuedAt)) return null;
    if (issuedAt < nowSeconds - MAX_AGE_SECONDS || issuedAt > nowSeconds + MAX_FUTURE_SECONDS) {
      return null;
    }

    const expected = signSession(ownerId, issuedAt, sessionSecret);
    if (!signaturesMatch(signature, expected)) return null;
    return { ownerId, issuedAt };
  } catch {
    return null;
  }
}

export function expireCloudSession(requestOrigin?: string): string {
  const attributes = [
    `${CLOUD_SESSION_COOKIE}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
  ];
  if (!isLocalhostOrigin(requestOrigin)) attributes.push('Secure');
  return attributes.join('; ');
}
