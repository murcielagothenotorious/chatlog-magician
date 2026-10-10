import { describe, expect, it } from 'vitest';

import { runVercelHandler } from '../app/api/_lib/vercel-compat.ts';

function makeRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : body,
  });
}

describe('runVercelHandler', () => {
  it('maps method, query, and headers to the legacy shape', async () => {
    let seen;
    const res = await runVercelHandler(
      (req, res) => {
        seen = req;
        return res.status(200).json({ ok: true });
      },
      makeRequest('http://localhost/api/community/presets?q=dark&cursor=a&cursor=b', {
        headers: { 'x-test': 'yes' },
      }),
      { presetId: 'preset-1' }
    );
    expect(res.status).toBe(200);
    expect(seen.method).toBe('GET');
    expect(seen.query).toMatchObject({ q: 'dark', presetId: 'preset-1' });
    expect(seen.query.cursor).toEqual(['a', 'b']);
    expect(seen.headers['x-test']).toBe('yes');
  });

  it('parses JSON bodies like Vercel and passes buffers otherwise', async () => {
    let jsonBody;
    await runVercelHandler(
      (req, res) => {
        jsonBody = req.body;
        return res.status(200).json({});
      },
      makeRequest('http://localhost/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: 'bug' }),
      })
    );
    expect(jsonBody).toEqual({ category: 'bug' });

    let rawBody;
    await runVercelHandler(
      (req, res) => {
        rawBody = req.body;
        return res.status(200).json({});
      },
      makeRequest('http://localhost/api/share/imgbb', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: 'raw-bytes',
      })
    );
    expect(Buffer.isBuffer(rawBody)).toBe(true);
    expect(rawBody.toString('utf8')).toBe('raw-bytes');
  });

  it('supports send/end and Set-Cookie append semantics', async () => {
    const res = await runVercelHandler((req, res) => {
      res.setHeader('Set-Cookie', 'a=1; Path=/');
      res.setHeader('Set-Cookie', 'b=2; Path=/');
      res.statusCode = 201;
      return res.end('svg-bytes');
    }, makeRequest('http://localhost/api/community/presets/x/preview'));
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('svg-bytes');
    expect(res.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  it('returns a sendError-shaped 500 when the handler throws', async () => {
    const res = await runVercelHandler(() => {
      throw new Error('boom');
    }, makeRequest('http://localhost/api/cloud/session'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Cloud request failed' },
    });
  });
});
