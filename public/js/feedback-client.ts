const CATEGORIES = new Set(['suggestion', 'bug', 'translation']);
const PRIORITIES = new Set(['low', 'medium', 'high']);
const FORM_KEYS = new Set([
  'category',
  'summary',
  'description',
  'priority',
  'contact',
  'diagnosticConsent',
]);
const DIAGNOSTIC_KEYS = ['appVersion', 'locale', 'browserFamily', 'platformFamily', 'errorCodes'];

export class FeedbackClientError extends Error {
  code: any;
  retryable: any;
  constructor(code, { retryable = false } = {}) {
    const i18n = typeof window !== 'undefined' ? window.i18n : null;
    let message;
    if (code === 'rate_limited') {
      message =
        i18n?.t('feedback.rateLimited') ??
        'Çok fazla geri bildirim gönderildi. Lütfen daha sonra tekrar deneyin.';
    } else if (code === 'invalid_form') {
      message =
        i18n?.t('feedback.invalidForm') ??
        'Lütfen formu eksiksiz doldurun (Başlık min 4, açıklama min 10 karakter).';
    } else if (code === 'feedback_unavailable') {
      message =
        i18n?.t('feedback.unavailable') ??
        'Geri bildirim servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
    } else {
      message = i18n?.t('feedback.failed') ?? 'Geri bildirim gönderilemedi.';
    }
    super(message);
    this.name = 'FeedbackClientError';
    this.code = code;
    this.retryable = retryable;
  }
}

function boundedText(value, minimum, maximum) {
  return (
    typeof value === 'string' && value.trim().length >= minimum && value.trim().length <= maximum
  );
}

function validateForm(form) {
  if (!form || typeof form !== 'object' || Array.isArray(form))
    throw new FeedbackClientError('invalid_form');
  const keys = Object.keys(form);
  if (keys.some((key) => !FORM_KEYS.has(key))) throw new FeedbackClientError('invalid_form');
  if (
    !CATEGORIES.has(form.category) ||
    !PRIORITIES.has(form.priority) ||
    !boundedText(form.summary, 4, 120) ||
    !boundedText(form.description, 10, 2000) ||
    (form.contact !== undefined && !boundedText(form.contact, 0, 100)) ||
    typeof form.diagnosticConsent !== 'boolean'
  ) {
    throw new FeedbackClientError('invalid_form');
  }
  return {
    category: form.category,
    summary: form.summary.trim(),
    description: form.description.trim(),
    priority: form.priority,
    contact: String(form.contact ?? '').trim(),
    diagnosticConsent: form.diagnosticConsent,
  };
}

function sanitizeDiagnostics(value) {
  const source = value && typeof value === 'object' ? value : {};
  const diagnostics: any = {};
  for (const key of DIAGNOSTIC_KEYS.slice(0, -1)) {
    const text = source[key];
    diagnostics[key] = typeof text === 'string' ? text.slice(0, 64) : '';
  }
  diagnostics.errorCodes = Array.isArray(source.errorCodes)
    ? source.errorCodes
        .filter((code) => typeof code === 'string' && /^[a-z0-9_-]{1,64}$/i.test(code))
        .slice(0, 10)
    : [];
  return diagnostics;
}

export function createFeedbackClient({
  fetch: fetchImpl = globalThis.fetch,
  collectRedactedDiagnostics = () => ({}),
  timeoutMs = 10000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Feedback fetch is required');

  async function submit(form) {
    const payload: any = validateForm(form);
    if (payload.diagnosticConsent) {
      payload.diagnostics = sanitizeDiagnostics(collectRedactedDiagnostics());
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      let body = null;
      try {
        body = await response.json();
      } catch {
        // Invalid server responses are handled below.
      }
      if (!response.ok || body?.ok !== true) {
        const code =
          body?.error?.code === 'rate_limited'
            ? 'rate_limited'
            : body?.error?.code === 'feedback_unavailable'
              ? 'feedback_unavailable'
              : 'server_error';
        throw new FeedbackClientError(code, {
          retryable: code === 'rate_limited' || response.status >= 500,
        });
      }
      return body.data;
    } catch (error) {
      if (error instanceof FeedbackClientError) throw error;
      throw new FeedbackClientError(error?.name === 'AbortError' ? 'timeout' : 'network_error', {
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return { submit };
}

function browserFamily(navigatorLike) {
  const value = String(navigatorLike?.userAgent || '');
  if (/Firefox\//u.test(value)) return 'Firefox';
  if (/Edg\//u.test(value)) return 'Edge';
  if (/Chrome\//u.test(value)) return 'Chrome';
  if (/Safari\//u.test(value)) return 'Safari';
  return 'Other';
}

export function initializeFeedbackController(
  windowLike: any = window,
  documentLike: any = document
) {
  const element = (id) => documentLike.getElementById(id);
  const modal = element('feedbackModal');
  const submitButton = element('submitFeedbackBtn');
  if (!modal || !submitButton) return null;

  const client = createFeedbackClient({
    fetch: windowLike.fetch.bind(windowLike),
    collectRedactedDiagnostics: () => ({
      appVersion: documentLike.body?.dataset?.appVersion || '2.0.0',
      locale: documentLike.documentElement?.lang || 'tr',
      browserFamily: browserFamily(windowLike.navigator),
      platformFamily: /Mac/u.test(windowLike.navigator?.platform || '')
        ? 'macOS'
        : /Win/u.test(windowLike.navigator?.platform || '')
          ? 'Windows'
          : /Linux/u.test(windowLike.navigator?.platform || '')
            ? 'Linux'
            : 'Other',
      errorCodes: [],
    }),
  });
  const status = element('feedbackStatus');
  const summary = element('feedbackSummary');
  const description = element('feedbackDescription');
  const contact = element('feedbackDiscord');
  const priority = element('feedbackPriority');
  const category = element('feedbackCategory');
  const consent = element('feedbackDiagnosticConsent');
  const cleanups = [];
  let returnFocus = null;

  function listen(target, type, listener) {
    target?.addEventListener(type, listener);
    cleanups.push(() => target?.removeEventListener(type, listener));
  }

  function setStatus(message, kind = '') {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
    status.style.display = message ? 'block' : 'none';
  }

  function open() {
    returnFocus = documentLike.activeElement;
    modal.style.display = 'flex';
    setStatus('');
    summary?.focus();
  }

  function close() {
    modal.style.display = 'none';
    returnFocus?.focus?.();
    returnFocus = null;
  }

  function chooseCategory(button) {
    if (!category) return;
    category.value = button.dataset.cat;
    for (const item of documentLike.querySelectorAll('#feedbackCategoryBtns button')) {
      item.classList.toggle('is-active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    }
    const hint = element('translationHint');
    if (hint) hint.style.display = category.value === 'translation' ? 'block' : 'none';
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && modal.style.display !== 'none') {
      event.preventDefault();
      close();
    }
  }

  async function submit() {
    const i18n = typeof window !== 'undefined' ? window.i18n : null;
    const summaryVal = (summary?.value || '').trim();
    const descriptionVal = (description?.value || '').trim();

    if (summaryVal.length < 4) {
      setStatus(
        i18n?.t('feedback.summaryTooShort') ?? 'Başlık en az 4 karakter olmalıdır.',
        'error'
      );
      summary?.focus();
      return false;
    }

    if (descriptionVal.length < 10) {
      setStatus(
        i18n?.t('feedback.descTooShort') ?? 'Açıklama en az 10 karakter olmalıdır.',
        'error'
      );
      description?.focus();
      return false;
    }

    submitButton.disabled = true;
    setStatus(i18n?.t('feedback.sending') ?? 'Gönderiliyor…', 'loading');
    try {
      await client.submit({
        category: category?.value || 'suggestion',
        summary: summaryVal,
        description: descriptionVal,
        priority: priority?.value || 'medium',
        contact: (contact?.value || '').trim(),
        diagnosticConsent: Boolean(consent?.checked),
      });
      summary.value = '';
      description.value = '';
      contact.value = '';
      if (consent) consent.checked = false;
      setStatus(i18n?.t('feedback.sent') ?? 'Geri bildiriminiz gönderildi.', 'success');
      return true;
    } catch (error) {
      setStatus(
        error.message || (i18n?.t('feedback.failed') ?? 'Geri bildirim gönderilemedi.'),
        'error'
      );
      return false;
    } finally {
      submitButton.disabled = false;
    }
  }

  listen(element('openFeedbackBtn'), 'click', open);
  listen(element('closeFeedbackModal'), 'click', close);
  listen(element('closeFeedbackBtn'), 'click', close);
  listen(element('feedbackBackdrop'), 'click', close);
  listen(documentLike, 'keydown', handleKeydown);
  listen(submitButton, 'click', () => void submit());
  for (const button of documentLike.querySelectorAll('#feedbackCategoryBtns button')) {
    listen(button, 'click', () => chooseCategory(button));
  }

  return {
    open,
    close,
    chooseCategory(categoryName) {
      const button = documentLike.querySelector(
        `#feedbackCategoryBtns button[data-cat="${categoryName}"]`
      );
      if (button) chooseCategory(button);
    },
    submit,
    destroy() {
      for (const cleanup of cleanups.splice(0)) cleanup();
      close();
    },
  };
}
