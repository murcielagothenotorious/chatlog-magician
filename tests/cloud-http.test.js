import { describe, expect, it } from 'vitest';

import {
  CloudHttpError,
  assertAllowedOrigin,
  assertMethod,
  readJsonBody,
  sendError,
  sendOk,
} from '../api/_lib/cloud-http';

function response() {
  return {
    statusCode: 200,
    headers: new Map(),
    payload: undefined,
    setHeader(name, value) {
      this.headers.set(name, value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

describe('cloud HTTP security primitives', () => {
  const config = {
    allowedOrigins: ['https://chat.example.com'],
    nodeEnv: 'production',
  };

  it.each([undefined, '', 'https://evil.example'])(
    'rejects missing or foreign origins',
    (origin) => {
      expect(() => assertAllowedOrigin({ headers: { origin } }, config)).toThrowError(
        expect.objectContaining({ code: 'origin_forbidden', status: 403 })
      );
    }
  );

  it('accepts only an exact configured origin', () => {
    expect(assertAllowedOrigin({ headers: { origin: 'https://chat.example.com' } }, config)).toBe(
      'https://chat.example.com'
    );
  });

  it('accepts localhost HTTP only in development', () => {
    const request = { headers: { origin: 'http://localhost:8080' } };

    expect(assertAllowedOrigin(request, { allowedOrigins: [], nodeEnv: 'development' })).toBe(
      'http://localhost:8080'
    );
    expect(() =>
      assertAllowedOrigin(request, { allowedOrigins: [], nodeEnv: 'production' })
    ).toThrow(CloudHttpError);
  });

  it('sets Allow and rejects unsupported methods', () => {
    const res = response();

    expect(() => assertMethod({ method: 'PUT' }, res, ['GET', 'POST'])).toThrowError(
      expect.objectContaining({ code: 'method_not_allowed', status: 405 })
    );
    expect(res.headers.get('Allow')).toBe('GET, POST');
  });

  it('reads JSON only with the exact JSON media type', async () => {
    await expect(
      readJsonBody({ headers: { 'content-type': 'text/plain' }, body: '{"ok":true}' }, 100)
    ).rejects.toMatchObject({ code: 'unsupported_media_type', status: 415 });

    await expect(
      readJsonBody(
        { headers: { 'content-type': 'application/json; charset=utf-8' }, body: '{"ok":true}' },
        100
      )
    ).resolves.toEqual({ ok: true });
  });

  it('rejects invalid and oversized JSON before handler logic', async () => {
    await expect(
      readJsonBody({ headers: { 'content-type': 'application/json' }, body: '{' }, 100)
    ).rejects.toMatchObject({ code: 'invalid_json', status: 400 });

    await expect(
      readJsonBody(
        { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: '€€' }) },
        12
      )
    ).rejects.toMatchObject({ code: 'payload_too_large', status: 413 });
  });

  it('uses typed no-store responses without leaking internal errors', () => {
    const ok = response();
    sendOk(ok, { available: false });
    expect(ok.payload).toEqual({ ok: true, data: { available: false } });
    expect(ok.headers.get('Cache-Control')).toBe('no-store');

    const failed = response();
    sendError(failed, new Error('EXAMPLE_SERVICE_KEY=private'));
    expect(failed.statusCode).toBe(500);
    expect(JSON.stringify(failed.payload)).not.toContain('private');
    expect(failed.payload).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Cloud request failed' },
    });
  });

  it('sets Retry-After only for typed throttling errors', () => {
    const res = response();
    sendError(res, new CloudHttpError('rate_limited', 429, 'Try later', { retryAfterSeconds: 9 }));

    expect(res.headers.get('Retry-After')).toBe('9');
    expect(res.payload.error).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 9 });
  });
});
