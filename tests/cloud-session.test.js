import { describe, expect, it } from 'vitest';

import {
  CLOUD_SESSION_COOKIE,
  issueCloudSession,
  verifyCloudSession,
} from '../api/_lib/cloud-session';

const ownerId = '018f0f4a-1d2b-7c3d-8e4f-0123456789ab';
const sessionSecret = 's'.repeat(32);
const now = Date.UTC(2026, 6, 11, 12, 0, 0);

describe('anonymous cloud session cookie', () => {
  it('issues an HMAC-signed HttpOnly strict cookie for one year', () => {
    const cookie = issueCloudSession({
      ownerId,
      sessionSecret,
      now,
      requestOrigin: 'https://chat.example.com',
    });

    expect(cookie).toContain(`${CLOUD_SESSION_COOKIE}=${ownerId}.${Math.floor(now / 1000)}.`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).toContain('Secure');
  });

  it('omits Secure only for localhost development origins', () => {
    const cookie = issueCloudSession({
      ownerId,
      sessionSecret,
      now,
      requestOrigin: 'http://localhost:8080',
    });

    expect(cookie).not.toContain('Secure');
  });

  it('verifies a valid cookie among unrelated cookies', () => {
    const setCookie = issueCloudSession({
      ownerId,
      sessionSecret,
      now,
      requestOrigin: 'https://chat.example.com',
    });
    const value = setCookie.split(';')[0];

    expect(verifyCloudSession(`theme=dark; ${value}`, { sessionSecret, now: now + 1000 })).toEqual({
      ownerId,
      issuedAt: Math.floor(now / 1000),
    });
  });

  it.each(['owner', 'issued', 'signature'])('rejects %s tampering', (part) => {
    const setCookie = issueCloudSession({
      ownerId,
      sessionSecret,
      now,
      requestOrigin: 'https://chat.example.com',
    });
    const original = setCookie.split(';')[0].split('=')[1].split('.');
    const index = { owner: 0, issued: 1, signature: 2 }[part];
    original[index] = `${original[index]}x`;

    expect(
      verifyCloudSession(`${CLOUD_SESSION_COOKIE}=${original.join('.')}`, { sessionSecret, now })
    ).toBeNull();
  });

  it('rejects expired and excessively future-dated cookies', () => {
    const oldCookie = issueCloudSession({
      ownerId,
      sessionSecret,
      now: now - 31536000 * 1000 - 1000,
      requestOrigin: 'https://chat.example.com',
    }).split(';')[0];
    const futureCookie = issueCloudSession({
      ownerId,
      sessionSecret,
      now: now + 301000,
      requestOrigin: 'https://chat.example.com',
    }).split(';')[0];

    expect(verifyCloudSession(oldCookie, { sessionSecret, now })).toBeNull();
    expect(verifyCloudSession(futureCookie, { sessionSecret, now })).toBeNull();
  });

  it('rejects malformed values without throwing', () => {
    expect(verifyCloudSession(`${CLOUD_SESSION_COOKIE}=broken`, { sessionSecret, now })).toBeNull();
    expect(verifyCloudSession('', { sessionSecret, now })).toBeNull();
  });
});
