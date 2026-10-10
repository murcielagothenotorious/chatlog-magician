import crypto from 'node:crypto';
import { clearTimeout, setTimeout } from 'node:timers';
import { URL } from 'node:url';

import {
  CloudHttpError,
  assertAllowedOrigin,
  assertMethod,
  getHeader,
  readJsonBody,
  sendError,
  sendOk,
} from './cloud-http';
import type { CloudRequest, CloudResponse } from './cloud-http';
import { verifyCloudSession } from './cloud-session';
import type { VerifyCloudSessionInput } from './cloud-session';

type Env = Record<string, unknown>;

interface FeedbackLogger {
  error?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
}

const CATEGORIES = new Set(['suggestion', 'bug', 'translation']);
const PRIORITIES = new Set(['low', 'medium', 'high']);
const ROOT_KEYS = new Set([
  'category',
  'summary',
  'description',
  'priority',
  'contact',
  'diagnosticConsent',
  'diagnostics',
]);
const DIAGNOSTIC_KEYS = new Set([
  'appVersion',
  'locale',
  'browserFamily',
  'platformFamily',
  'errorCodes',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(): never {
  throw new TypeError('Invalid feedback payload');
}

function text(value: unknown, minimum: number, maximum: number): string {
  if (
    typeof value !== 'string' ||
    [...value].some((character) => {
      const code = character.codePointAt(0) as number;
      return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
    })
  ) {
    invalid();
  }
  const normalized = (value as string).trim();
  if (normalized.length < minimum || normalized.length > maximum) invalid();
  return normalized;
}

export interface ValidatedDiagnostics {
  appVersion: string;
  locale: string;
  browserFamily: string;
  platformFamily: string;
  errorCodes: string[];
}

function diagnostics(value: unknown): ValidatedDiagnostics {
  if (!isRecord(value)) invalid();
  if (Object.keys(value).some((key) => !DIAGNOSTIC_KEYS.has(key))) invalid();
  const result = {
    appVersion: text(value.appVersion, 1, 32),
    locale: text(value.locale, 2, 16),
    browserFamily: text(value.browserFamily, 1, 64),
    platformFamily: text(value.platformFamily, 1, 64),
    errorCodes: value.errorCodes,
  };
  if (
    !Array.isArray(result.errorCodes) ||
    result.errorCodes.length > 10 ||
    result.errorCodes.some((code) => typeof code !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(code))
  ) {
    invalid();
  }
  return result as ValidatedDiagnostics;
}

export type FeedbackCategory = 'suggestion' | 'bug' | 'translation';
export type FeedbackPriority = 'low' | 'medium' | 'high';

export interface ValidatedFeedback {
  category: FeedbackCategory;
  summary: string;
  description: string;
  priority: FeedbackPriority;
  contact: string;
  diagnosticConsent: boolean;
  diagnostics?: ValidatedDiagnostics;
}

export function validateFeedback(value: unknown): ValidatedFeedback {
  if (!isRecord(value)) invalid();
  if (Object.keys(value).some((key) => !ROOT_KEYS.has(key))) invalid();
  if (!CATEGORIES.has(value.category as string) || !PRIORITIES.has(value.priority as string))
    invalid();
  if (typeof value.diagnosticConsent !== 'boolean') invalid();
  if (value.diagnosticConsent !== Object.prototype.hasOwnProperty.call(value, 'diagnostics')) {
    invalid();
  }
  return {
    category: value.category as FeedbackCategory,
    summary: text(value.summary, 4, 120),
    description: text(value.description, 10, 2000),
    priority: value.priority as FeedbackPriority,
    contact: text(value.contact ?? '', 0, 100),
    diagnosticConsent: value.diagnosticConsent,
    ...(value.diagnosticConsent ? { diagnostics: diagnostics(value.diagnostics) } : {}),
  };
}

export function readDiscordWebhookUrl(env: Env = process.env): string | null {
  const rawUrl =
    env?.FEEDBACK_DISCORD_WEBHOOK_URL ||
    env?.DISCORD_FEEDBACK_WEBHOOK_URL ||
    env?.DISCORD_WEBHOOK_URL ||
    env?.DISCORD_WEBHOOK ||
    env?.DISCORD_TELEMETRY_WEBHOOK ||
    env?.WEBHOOK_URL;
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleanUrl = rawUrl
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!cleanUrl) return null;
  try {
    const url = new URL(cleanUrl);
    const host = url.hostname.toLowerCase();
    const allowedHost =
      host === 'discord.com' ||
      host === 'discordapp.com' ||
      host.endsWith('.discord.com') ||
      host.endsWith('.discordapp.com');
    if (url.protocol !== 'https:' || !allowedHost || !url.pathname.startsWith('/api/webhooks/')) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export interface DiscordDeliveryOptions {
  env?: Env;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  logger?: FeedbackLogger;
}

export interface DiscordDeliveryInput {
  feedback: ValidatedFeedback;
  requestId: string;
}

export function createDiscordFeedbackDelivery({
  env = process.env,
  fetch: fetchImpl = fetch,
  timeoutMs = 10000,
  logger = console,
}: DiscordDeliveryOptions = {}) {
  return async function deliverToDiscord({ feedback, requestId }: DiscordDeliveryInput) {
    const url = readDiscordWebhookUrl(env);
    if (!url) throw new CloudHttpError('feedback_unavailable', 503, 'Feedback is unavailable');
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const categoryTr =
      {
        suggestion: '💡 Öneri',
        bug: '🐛 Hata Bildirimi',
        translation: '🌐 Çeviri',
      }[feedback.category] || feedback.category;

    const priorityTr =
      {
        low: 'Düşük',
        medium: 'Orta',
        high: 'Yüksek',
      }[feedback.priority] || feedback.priority;

    const content = `**${feedback.category} · ${feedback.priority}**\n${feedback.summary}\n\n${feedback.description}${feedback.contact ? `\n\nContact: ${feedback.contact}` : ''}\n\nRequest: ${requestId}`;

    const embed = {
      title: `${categoryTr}: ${feedback.summary}`.slice(0, 256),
      description: feedback.description.slice(0, 2048),
      color:
        feedback.category === 'bug'
          ? 0xe74c3c
          : feedback.category === 'suggestion'
            ? 0x2ecc71
            : 0x3498db,
      fields: [
        { name: 'Kategori', value: categoryTr, inline: true },
        { name: 'Öncelik', value: priorityTr, inline: true },
      ] as Array<{ name: string; value: string; inline: boolean }>,
      footer: { text: `Talep No: ${requestId}` },
      timestamp: new Date().toISOString(),
    };

    if (feedback.contact) {
      embed.fields.push({
        name: 'İletişim (Discord)',
        value: feedback.contact.slice(0, 100),
        inline: false,
      });
    }

    if (feedback.diagnostics) {
      const diag = feedback.diagnostics;
      const diagInfo = [
        diag.appVersion ? `Sürüm: ${diag.appVersion}` : '',
        diag.browserFamily ? `Tarayıcı: ${diag.browserFamily}` : '',
        diag.platformFamily ? `Platform: ${diag.platformFamily}` : '',
        diag.locale ? `Dil: ${diag.locale}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      if (diagInfo) {
        embed.fields.push({ name: 'Teşhis', value: diagInfo.slice(0, 256), inline: false });
      }
    }

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
        body: JSON.stringify({
          username: 'Chatlog Magician Feedback',
          content: content.slice(0, 2000),
          embeds: [embed],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error?.('Discord webhook delivery failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText.slice(0, 500),
        });
        throw new CloudHttpError('feedback_unavailable', 503, 'Feedback is unavailable');
      }
    } catch (error) {
      if (
        error instanceof CloudHttpError ||
        (error as { name?: unknown })?.name === 'CloudHttpError'
      )
        throw error;
      logger.error?.('Discord webhook error:', (error as { message?: unknown })?.message || error);
      throw new CloudHttpError('feedback_unavailable', 503, 'Feedback is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  };
}

export interface FeedbackHandlerConfig {
  available?: boolean;
  allowedOrigins?: string[];
  sessionSecret?: string;
  nodeEnv?: string;
}

export interface FeedbackRateInput {
  ownerId: string;
  scope: string;
  limit: number;
  windowSeconds: number;
}

export interface FeedbackRateResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
}

export interface FeedbackRequest extends CloudRequest {
  socket?: { remoteAddress?: string } | null;
}

export interface FeedbackResponse extends CloudResponse {
  statusCode?: number;
  end?: (data?: unknown) => unknown;
}

export interface FeedbackHandlerOptions {
  config?: FeedbackHandlerConfig;
  verifySession?: (cookie: unknown, options: VerifyCloudSessionInput) => unknown;
  isOwnerRevoked?: (ownerId: string) => Promise<boolean>;
  consumeRate?: (input: FeedbackRateInput) => Promise<FeedbackRateResult> | FeedbackRateResult;
  deliver?: (input: { requestId: string; ownerId: string; feedback: ValidatedFeedback }) => unknown;
  requestId?: () => string;
  logger?: FeedbackLogger;
}

export function createFeedbackHandler({
  config,
  verifySession = (cookie, options) => verifyCloudSession(cookie, options),
  isOwnerRevoked,
  consumeRate,
  deliver,
  requestId = () => crypto.randomUUID(),
  logger = console,
}: FeedbackHandlerOptions = {}) {
  return async function feedbackHandler(req: FeedbackRequest, res: FeedbackResponse) {
    try {
      res.setHeader?.('Access-Control-Allow-Origin', '*');
      res.setHeader?.('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Cookie');

      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end?.();
        return;
      }

      if (config && config.available === false) {
        throw new CloudHttpError('feedback_unavailable', 503, 'Feedback is unavailable');
      }
      if (config?.allowedOrigins?.length) {
        assertAllowedOrigin(req, config);
      }
      assertMethod(req, res, ['POST']);

      const cookieHeader = getHeader(req, 'cookie');
      let ownerId = 'anonymous';

      if (cookieHeader && config?.sessionSecret) {
        const session = verifySession(cookieHeader, {
          sessionSecret: config.sessionSecret,
        }) as { ownerId?: string } | null;
        if (session?.ownerId) {
          if (await isOwnerRevoked?.(session.ownerId)) {
            throw new CloudHttpError('session_revoked', 401, 'Cloud session was revoked');
          }
          ownerId = session.ownerId;
        }
      }

      const feedback = validateFeedback(await readJsonBody(req, 16 * 1024));

      if (consumeRate) {
        const rawIp = getHeader(req, 'x-forwarded-for') || req.socket?.remoteAddress || 'ip';
        const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'ip';
        const rateSubject = ownerId !== 'anonymous' ? ownerId : `anon:${clientIp}`;
        const rate = await consumeRate({
          ownerId: rateSubject,
          scope: 'feedback',
          limit: 5,
          windowSeconds: 60,
        });
        if (rate && !rate.allowed) {
          throw new CloudHttpError('rate_limited', 429, 'Feedback rate limit exceeded', {
            retryAfterSeconds: Math.max(1, Number(rate.retryAfterSeconds) || 1),
          });
        }
      }

      if (typeof deliver !== 'function') {
        throw new CloudHttpError('feedback_unavailable', 503, 'Feedback is unavailable');
      }

      const id = requestId();
      await deliver({ requestId: id, ownerId, feedback });
      logger.info?.({ requestId: id, category: feedback.category, status: 'accepted' });
      return sendOk(res, { accepted: true }, 202);
    } catch (error) {
      if (error instanceof TypeError || (error as { name?: unknown })?.name === 'TypeError') {
        return sendError(res, new CloudHttpError('invalid_feedback', 400, 'Feedback is invalid'));
      }
      logger.error?.({
        code: (error as { code?: unknown })?.code || 'feedback_failed',
        message: (error as { message?: unknown })?.message,
      });
      return sendError(res, error);
    }
  };
}

const defaultRateLog = new Map<string, number[]>();

function memoryRateLimiter({
  ownerId,
  limit = 10,
  windowSeconds = 60,
}: {
  ownerId: string;
  limit?: number;
  windowSeconds?: number;
}): FeedbackRateResult {
  const now = Date.now();
  const windowMs = (Number(windowSeconds) || 60) * 1000;
  const windowStart = now - windowMs;
  const timestamps = (defaultRateLog.get(ownerId) || []).filter((t) => t > windowStart);
  if (timestamps.length >= limit) {
    const earliest = timestamps[0];
    const retryAfterSeconds = Math.ceil((earliest + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  timestamps.push(now);
  defaultRateLog.set(ownerId, timestamps);
  return { allowed: true, remaining: limit - timestamps.length };
}

export function defaultHandler() {
  const env = process.env;
  const webhookUrl = readDiscordWebhookUrl(env);

  if (!webhookUrl) {
    return createFeedbackHandler({
      config: { available: false },
    });
  }

  return createFeedbackHandler({
    config: { available: true },
    consumeRate: memoryRateLimiter,
    deliver: createDiscordFeedbackDelivery({ env }),
  });
}
