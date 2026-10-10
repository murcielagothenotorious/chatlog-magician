import { describe, expect, it, vi } from 'vitest';

import {
  createDiscordFeedbackDelivery,
  createFeedbackHandler,
  readDiscordWebhookUrl,
  validateFeedback,
} from '../api/_lib/feedback-handler';

const ownerId = '11111111-1111-4111-8111-111111111111';
const validPayload = {
  category: 'suggestion',
  summary: 'Add a compact preset view',
  description: 'A compact view would make comparing presets easier.',
  priority: 'medium',
  contact: '',
  diagnosticConsent: false,
};

function response() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function request(body = validPayload) {
  return {
    method: 'POST',
    headers: {
      origin: 'https://example.test',
      'content-type': 'application/json',
      cookie: 'session',
    },
    body,
  };
}

function setup(overrides = {}) {
  const deliver = vi.fn().mockResolvedValue(undefined);
  const consumeRate = vi.fn().mockResolvedValue({ allowed: true, remaining: 4 });
  const handler = createFeedbackHandler({
    config: {
      available: true,
      allowedOrigins: ['https://example.test'],
      sessionSecret: 's'.repeat(32),
      nodeEnv: 'test',
    },
    verifySession: vi.fn(() => ({ ownerId })),
    isOwnerRevoked: vi.fn().mockResolvedValue(false),
    consumeRate,
    deliver,
    requestId: () => 'request-1',
    logger: { error: vi.fn(), info: vi.fn() },
    ...overrides,
  });
  return { consumeRate, deliver, handler };
}

describe('feedback validation', () => {
  it('accepts only the bounded schema and fixed diagnostic fields', () => {
    expect(validateFeedback(validPayload)).toEqual(validPayload);
    expect(() => validateFeedback({ ...validPayload, fullReport: 'leak' })).toThrow(
      /invalid feedback/i
    );
    expect(() =>
      validateFeedback({ ...validPayload, diagnosticConsent: false, diagnostics: {} })
    ).toThrow(/invalid feedback/i);
    expect(() =>
      validateFeedback({
        ...validPayload,
        diagnosticConsent: true,
        diagnostics: {
          appVersion: '2.0.0',
          locale: 'tr',
          browserFamily: 'Safari',
          platformFamily: 'macOS',
          errorCodes: ['canvas_export_failed'],
          userAgent: 'leak',
        },
      })
    ).toThrow(/invalid feedback/i);
  });
});

describe('feedback handler', () => {
  it('authenticates, rate limits, and delivers a validated record', async () => {
    const { consumeRate, deliver, handler } = setup();
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(202);
    expect(res.payload).toEqual({ ok: true, data: { accepted: true } });
    expect(consumeRate).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId, scope: 'feedback', limit: 5 })
    );
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'request-1', ownerId, feedback: validPayload })
    );
  });

  it('reads the session cookie without depending on header casing', async () => {
    const verifySession = vi.fn(() => ({ ownerId }));
    const { handler } = setup({ verifySession });
    const req = request();
    req.headers.Cookie = req.headers.cookie;
    delete req.headers.cookie;
    const res = response();

    await handler(req, res);

    expect(res.statusCode).toBe(202);
    expect(verifySession).toHaveBeenCalledWith('session', expect.any(Object));
  });

  it('rejects forbidden origins and revoked sessions before delivery', async () => {
    const { deliver, handler } = setup();
    const req = request();
    req.headers.origin = 'https://evil.test';
    const res = response();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(deliver).not.toHaveBeenCalled();

    const revoked = setup({ isOwnerRevoked: vi.fn().mockResolvedValue(true) });
    const revokedRes = response();
    await revoked.handler(request(), revokedRes);
    expect(revokedRes.statusCode).toBe(401);
  });

  it('returns retry metadata when the durable limiter rejects the request', async () => {
    const { deliver, handler } = setup({
      consumeRate: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 90 }),
    });
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('90');
    expect(deliver).not.toHaveBeenCalled();
  });

  it('fails closed when no delivery adapter is configured', async () => {
    const { handler } = setup({ deliver: null });
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(503);
  });

  it('allows anonymous submissions without session cookie', async () => {
    const { deliver, handler, consumeRate } = setup();
    const req = request();
    delete req.headers.cookie;
    const res = response();

    await handler(req, res);

    expect(res.statusCode).toBe(202);
    expect(consumeRate).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: expect.stringMatching(/anon/), scope: 'feedback' })
    );
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'anonymous', feedback: validPayload })
    );
  });

  it('handles OPTIONS preflight with 200 and CORS headers', async () => {
    const { handler } = setup();
    const req = { method: 'OPTIONS', headers: {} };
    const res = response();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

describe('Discord feedback delivery', () => {
  it('recognizes DISCORD_TELEMETRY_WEBHOOK environment variable', () => {
    const url = readDiscordWebhookUrl({
      DISCORD_TELEMETRY_WEBHOOK: 'https://discord.com/api/webhooks/999/telemetry-token',
    });
    expect(url).toBe('https://discord.com/api/webhooks/999/telemetry-token');
  });

  it('rejects non-Discord and non-HTTPS webhook destinations', async () => {
    const fetch = vi.fn();
    const deliver = createDiscordFeedbackDelivery({
      env: { FEEDBACK_DISCORD_WEBHOOK_URL: 'http://internal.test/hook' },
      fetch,
    });

    await expect(deliver({ feedback: validPayload, requestId: 'request-1' })).rejects.toMatchObject(
      { code: 'feedback_unavailable', status: 503 }
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('strips surrounding quotes and whitespace from webhook urls', () => {
    expect(
      readDiscordWebhookUrl({
        FEEDBACK_DISCORD_WEBHOOK_URL: ' "https://discord.com/api/webhooks/999/token" \n',
      })
    ).toBe('https://discord.com/api/webhooks/999/token');

    expect(
      readDiscordWebhookUrl({
        DISCORD_WEBHOOK_URL: "'https://discord.com/api/webhooks/999/token'",
      })
    ).toBe('https://discord.com/api/webhooks/999/token');
  });

  it('prioritizes FEEDBACK_DISCORD_WEBHOOK_URL over DISCORD_TELEMETRY_WEBHOOK', () => {
    const url = readDiscordWebhookUrl({
      FEEDBACK_DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/111/feedback',
      DISCORD_TELEMETRY_WEBHOOK: 'https://discord.com/api/webhooks/222/telemetry',
    });
    expect(url).toBe('https://discord.com/api/webhooks/111/feedback');
  });

  it('recognizes discord subdomains such as canary and ptb', () => {
    expect(
      readDiscordWebhookUrl({
        DISCORD_WEBHOOK: 'https://canary.discord.com/api/webhooks/123/canary-token',
      })
    ).toBe('https://canary.discord.com/api/webhooks/123/canary-token');

    expect(
      readDiscordWebhookUrl({
        DISCORD_WEBHOOK: 'https://ptb.discord.com/api/webhooks/123/ptb-token',
      })
    ).toBe('https://ptb.discord.com/api/webhooks/123/ptb-token');
  });

  it('bounds the outbound Discord message to the platform limit', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const deliver = createDiscordFeedbackDelivery({
      env: {
        DISCORD_TELEMETRY_WEBHOOK: 'https://discord.com/api/webhooks/123/token',
      },
      fetch,
    });

    await deliver({
      feedback: {
        ...validPayload,
        description: 'a'.repeat(2000),
        contact: 'b'.repeat(100),
      },
      requestId: 'request-1',
    });

    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.content.length).toBeLessThanOrEqual(2000);
  });
});
