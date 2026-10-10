// Bridges legacy Vercel-style (req, res) handlers in /api to Next.js
// Web Request/Response Route Handlers. Behavior contract:
// - req.method / req.headers (plain object) / req.query (URL + route params)
//   / req.body mirrors Vercel: parsed object for JSON, Buffer otherwise.
// - res.setHeader / res.status().json()/.send()/.end() / res.statusCode + end()
// - First response wins; unhandled throw becomes sendError-shaped 500.
export type VercelQuery = Record<string, string | string[] | undefined>;

export type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: VercelQuery;
  body?: unknown;
  url?: string;
};

export type VercelResponseBody = {
  json: (data: unknown) => Response;
  send: (data?: unknown) => Response;
  end: (data?: unknown) => Response;
};

export type VercelResponse = {
  statusCode: number;
  setHeader: (name: string, value: string | string[]) => void;
  status: (code: number) => VercelResponseBody;
  end: (data?: unknown) => Response;
};

export type VercelHandler = (req: VercelRequest, res: VercelResponse) => unknown;

function toBodyInit(data?: unknown): BodyInit | null {
  if (data === undefined || data === null) return null;
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return Buffer.from(data);
  if (data instanceof Uint8Array) return Buffer.from(data);
  return String(data);
}

export async function runVercelHandler(
  handler: VercelHandler,
  request: Request,
  extraQuery: Record<string, string | string[] | undefined> = {}
): Promise<Response> {
  const url = new URL(request.url);
  const query: VercelQuery = {};
  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing === undefined) query[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else query[key] = [existing, value];
  });
  Object.assign(query, extraQuery);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const raw = Buffer.from(await request.arrayBuffer());
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  let body: unknown = raw;
  if (contentType === 'application/json' && raw.length > 0) {
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      body = raw;
    }
  }

  const req: VercelRequest = { method: request.method, headers, query, body, url: request.url };

  let captured: Response | null = null;
  const resHeaders = new Headers();
  const finish = (status: number, data?: unknown): Response => {
    if (!captured) captured = new Response(toBodyInit(data), { status, headers: resHeaders });
    return captured;
  };

  const res: VercelResponse = {
    statusCode: 200,
    setHeader(name: string, value: string | string[]) {
      const values = Array.isArray(value) ? value : [value];
      if (name.toLowerCase() === 'set-cookie') {
        values.forEach((v) => resHeaders.append('Set-Cookie', v));
      } else {
        resHeaders.set(name, values.join(', '));
      }
    },
    status(code: number) {
      res.statusCode = code;
      return {
        json: (data: unknown) => {
          if (!resHeaders.has('content-type')) {
            resHeaders.set('content-type', 'application/json; charset=utf-8');
          }
          return finish(res.statusCode, JSON.stringify(data));
        },
        send: (data?: unknown) => finish(res.statusCode, data),
        end: (data?: unknown) => finish(res.statusCode, data),
      };
    },
    end: (data?: unknown) => finish(res.statusCode, data),
  };

  try {
    await handler(req, res);
  } catch {
    if (!captured) {
      captured = new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'internal_error', message: 'Cloud request failed' },
        }),
        {
          status: 500,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }
  }

  return (
    captured ??
    new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'internal_error', message: 'Cloud request failed' },
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    )
  );
}
