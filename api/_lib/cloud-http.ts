import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

export interface CloudRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

export interface CloudResponseSender {
  json: (data: unknown) => unknown;
  send: (data: unknown) => unknown;
  end: (data?: unknown) => unknown;
}

export interface CloudResponse {
  setHeader: (name: string, value: string | string[]) => void;
  status: (code: number) => CloudResponseSender;
}

export interface CloudOriginConfig {
  allowedOrigins?: string[];
  nodeEnv?: string;
}

export class CloudHttpError extends Error {
  code: string;
  status: number;
  retryAfterSeconds?: number;

  constructor(
    code: string,
    status: number,
    message: string,
    options: { retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = 'CloudHttpError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = options.retryAfterSeconds;
    Object.setPrototypeOf(this, CloudHttpError.prototype);
  }
}

export function getHeader(req: CloudRequest | undefined, name: string): string | undefined {
  const headers = req?.headers || {};
  const normalizedName = name.toLowerCase();
  const matchingKey = Object.keys(headers).find((key) => key.toLowerCase() === normalizedName);
  const value = matchingKey ? headers[matchingKey] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function assertAllowedOrigin(
  req: CloudRequest | undefined,
  config?: CloudOriginConfig
): string {
  const origin = getHeader(req, 'origin');
  if (typeof origin !== 'string' || !origin) {
    throw new CloudHttpError('origin_forbidden', 403, 'Request origin is not allowed');
  }

  if (config?.allowedOrigins?.includes(origin)) return origin;

  if (config?.nodeEnv === 'development') {
    try {
      const url = new URL(origin);
      if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        return origin;
      }
    } catch {
      // Invalid origins are rejected below.
    }
  }

  throw new CloudHttpError('origin_forbidden', 403, 'Request origin is not allowed');
}

export function assertMethod(
  req: CloudRequest | undefined,
  res: CloudResponse,
  allowedMethods: string[]
): string {
  if (req?.method && allowedMethods.includes(req.method)) return req.method;
  res.setHeader('Allow', allowedMethods.join(', '));
  throw new CloudHttpError('method_not_allowed', 405, 'Method not allowed');
}

async function readRawBody(req: CloudRequest | undefined, maxBytes: number): Promise<Buffer> {
  if (Buffer.isBuffer(req?.body)) return req.body;
  if (typeof req?.body === 'string') return Buffer.from(req.body, 'utf8');
  if (req?.body !== undefined && req?.body !== null) {
    return Buffer.from(JSON.stringify(req.body), 'utf8');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  const stream = req as unknown as AsyncIterable<Uint8Array> | undefined;
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') return Buffer.alloc(0);

  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) {
      throw new CloudHttpError('payload_too_large', 413, 'Request body is too large');
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export async function readJsonBody(
  req: CloudRequest | undefined,
  maxBytes: number
): Promise<unknown> {
  const contentType = getHeader(req, 'content-type');
  if (
    typeof contentType !== 'string' ||
    contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json'
  ) {
    throw new CloudHttpError(
      'unsupported_media_type',
      415,
      'Content-Type must be application/json'
    );
  }

  const rawBody = await readRawBody(req, maxBytes);
  if (rawBody.length > maxBytes) {
    throw new CloudHttpError('payload_too_large', 413, 'Request body is too large');
  }

  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new CloudHttpError('invalid_json', 400, 'Request body must be valid JSON');
  }
}

function setNoStore(res: CloudResponse): void {
  res.setHeader('Cache-Control', 'no-store');
}

export function sendOk(res: CloudResponse, data: unknown, status = 200): unknown {
  setNoStore(res);
  return res.status(status).json({ ok: true, data });
}

export function sendNoContent(res: CloudResponse): unknown {
  setNoStore(res);
  return res.status(204).end();
}

export function sendError(res: CloudResponse, error: unknown): unknown {
  setNoStore(res);
  const candidate: Record<string, unknown> =
    error !== null && (typeof error === 'object' || typeof error === 'function')
      ? (error as Record<string, unknown>)
      : {};
  const typed =
    error instanceof CloudHttpError ||
    candidate.name === 'CloudHttpError' ||
    (typeof candidate.status === 'number' && typeof candidate.code === 'string');
  const status = typed ? (candidate.status as number) : 500;
  const code = typed ? (candidate.code as string) : 'internal_error';
  const message = typed ? (candidate.message as string | undefined) : 'Cloud request failed';
  const retryAfterSeconds = typed ? candidate.retryAfterSeconds : undefined;

  if (Number.isSafeInteger(retryAfterSeconds) && (retryAfterSeconds as number) > 0) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }

  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
  });
}
