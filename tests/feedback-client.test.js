import { describe, expect, it, vi } from 'vitest';

import { createFeedbackClient, FeedbackClientError } from '../public/js/feedback-client.ts';

const validForm = {
  category: 'bug',
  summary: 'Canvas export fails',
  description: 'Exporting the current canvas returns an error.',
  priority: 'high',
  contact: 'kaan',
  diagnosticConsent: false,
};

describe('feedback client', () => {
  it('sends only the public feedback schema without diagnostics by default', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { accepted: true } }),
    });
    const collectRedactedDiagnostics = vi.fn();
    const client = createFeedbackClient({ fetch, collectRedactedDiagnostics });

    await expect(client.submit(validForm)).resolves.toEqual({ accepted: true });

    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request).toEqual(validForm);
    expect(collectRedactedDiagnostics).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
  });

  it('collects a fixed diagnostic subset only after explicit consent', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { accepted: true } }),
    });
    const collectRedactedDiagnostics = vi.fn(() => ({
      appVersion: '2.0.0',
      locale: 'tr',
      browserFamily: 'Safari',
      platformFamily: 'macOS',
      errorCodes: ['canvas_export_failed'],
      userAgent: 'must not leak',
    }));
    const client = createFeedbackClient({ fetch, collectRedactedDiagnostics });

    await client.submit({ ...validForm, diagnosticConsent: true });

    expect(JSON.parse(fetch.mock.calls[0][1].body).diagnostics).toEqual({
      appVersion: '2.0.0',
      locale: 'tr',
      browserFamily: 'Safari',
      platformFamily: 'macOS',
      errorCodes: ['canvas_export_failed'],
    });
  });

  it('maps server and network failures without echoing private response details', async () => {
    const server = createFeedbackClient({
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ ok: false, error: { code: 'rate_limited', message: 'private' } }),
      }),
    });
    await expect(server.submit(validForm)).rejects.toMatchObject({
      name: 'FeedbackClientError',
      code: 'rate_limited',
      retryable: true,
    });

    const offline = createFeedbackClient({ fetch: vi.fn().mockRejectedValue(new Error('secret')) });
    await expect(offline.submit(validForm)).rejects.toEqual(
      expect.objectContaining({ name: 'FeedbackClientError', code: 'network_error' })
    );
  });

  it('rejects malformed forms before network work', async () => {
    const fetch = vi.fn();
    const client = createFeedbackClient({ fetch });
    await expect(client.submit({ ...validForm, fullReport: 'leak' })).rejects.toBeInstanceOf(
      FeedbackClientError
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
