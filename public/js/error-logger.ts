/**
 * Comprehensive Error Logger for GTAW Chatlog Magician
 * Captures all errors, warnings, and important events for debugging
 */

interface Window {
  ChatlogFeedback?: any;
  showConfirmDialog?: any;
  showToast?: any;
}

(function () {
  'use strict';

  const errorLog = {
    sessionId: generateSessionId(),
    startTime: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    errors: [] as any[],
    warnings: [] as any[],
    info: [] as any[],
    networkIssues: [] as any[],
    resourceIssues: [] as any[],
    userActivity: [] as any[],
    performance: {} as any,
  };

  const CONFIG = {
    MAX_ENTRIES: 100,
    SHOW_CONSOLE: false, // Suppress console noise in production
    AUTO_SAVE: false, // Diagnostics stay in memory unless the user explicitly exports them.
    STORAGE_KEY: 'chatlog_error_log',
  };

  function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  function timestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 23);
  }

  let isLoggingError = false;
  function addLogEntry(type, message, details: any = {}) {
    if (isLoggingError) {
      console.warn('[ErrorLogger] Recursive error detected, skipping log');
      return null;
    }

    try {
      isLoggingError = true;

      const entry = {
        timestamp: timestamp(),
        type: type,
        message: String(message || 'Unknown error'),
        details: details || {},
        url: window.location.href,
        stack: (details && details.stack) || new Error().stack,
      };

      if (!errorLog[type]) {
        errorLog[type] = [];
      }
      errorLog[type].push(entry);

      if (errorLog[type].length > CONFIG.MAX_ENTRIES) {
        errorLog[type].shift();
      }

      if (CONFIG.AUTO_SAVE) {
        try {
          saveToStorage();
        } catch (storageError) {
          // Don't let storage errors create infinite loop
          console.error('[ErrorLogger] Failed to save:', storageError);
        }
      }

      return entry;
    } catch (e) {
      // Error logger'da hata olursa sadece console'a yaz
      console.error('[ErrorLogger] Failed to log error:', e);
      return null;
    } finally {
      isLoggingError = false;
    }
  }

  /**
   * @returns {Object} - {available: number, total: number, used: number, percentage: number}
   */
  function checkLocalStorageQuota(): any {
    try {
      let total = 0;
      let used = 0;

      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          used += localStorage[key].length + key.length;
        }
      }

      // Try to estimate total (typical limit is 5-10MB, we'll use 5MB as conservative estimate)
      const ESTIMATED_LIMIT = 5 * 1024 * 1024;
      total = ESTIMATED_LIMIT;

      const percentage = (used / total) * 100;

      return {
        available: total - used,
        total: total,
        used: used,
        percentage: percentage.toFixed(2),
        usedMB: (used / (1024 * 1024)).toFixed(2),
        totalMB: (total / (1024 * 1024)).toFixed(2),
      };
    } catch (e) {
      console.warn('Could not check localStorage quota:', e);
      return null;
    }
  }

  function saveToStorage() {
    try {
      const quota = checkLocalStorageQuota();
      if (quota && quota.percentage > 90) {
        console.warn(
          `[ErrorLogger] localStorage usage high (${quota.percentage}%). Some logs may be lost.`
        );
        addLogEntry(
          'warnings',
          `localStorage quota critical: ${quota.percentage}% used (${quota.usedMB}MB / ${quota.totalMB}MB)`,
          {
            quota: quota,
            context: 'localStorage quota check',
          }
        );

        if (quota.percentage > 95) {
          console.warn('[ErrorLogger] localStorage nearly full, attempting to trim old data');
          errorLog.errors = errorLog.errors.slice(-20);
          errorLog.warnings = errorLog.warnings.slice(-20);
          errorLog.info = errorLog.info.slice(-20);
          errorLog.userActivity = errorLog.userActivity.slice(-20);
        }
      }

      const logData = {
        ...errorLog,
        lastUpdated: timestamp(),
      };

      const serialized = JSON.stringify(logData);
      const sizeKB = (serialized.length / 1024).toFixed(2);

      if (quota && serialized.length > quota.available) {
        console.error(
          `[ErrorLogger] Cannot save to localStorage - data size (${sizeKB}KB) exceeds available space (${(quota.available / 1024).toFixed(2)}KB)`
        );
        addLogEntry(
          'errors',
          `localStorage save failed: data too large (${sizeKB}KB > ${(quota.available / 1024).toFixed(2)}KB available)`,
          {
            dataSize: serialized.length,
            available: quota.available,
            context: 'localStorage save',
          }
        );
        return;
      }

      localStorage.setItem(CONFIG.STORAGE_KEY, serialized);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('[ErrorLogger] localStorage quota exceeded:', e);
        addLogEntry('errors', 'localStorage quota exceeded during save', {
          error: e.message,
          errorName: e.name,
          context: 'localStorage save',
          quota: checkLocalStorageQuota(),
        });
      } else {
        console.warn('[ErrorLogger] Could not save error log to localStorage:', e);
        addLogEntry('warnings', 'Failed to save error log to localStorage', {
          error: e.message,
          errorName: e.name,
          context: 'localStorage save',
        });
      }
    }
  }

  /**
   * Check if error should be ignored (browser extensions, ad blockers, third-party scripts)
   */
  function shouldIgnoreError(message, filename, source) {
    const extensionPatterns = [
      'chrome-extension://',
      'moz-extension://',
      'safari-extension://',
      'edge-extension://',
      'content-scripts.js',
      'injection-tss-mv3.js',
      'TSS:',
      'Content Script Bridge',
      'listener indicated an asynchronous response',
      'message channel closed',
    ];

    const adBlockerPatterns = [
      'ERR_BLOCKED_BY_CLIENT',
      'net::ERR_BLOCKED_BY_CLIENT',
      'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT',
    ];

    const thirdPartyPatterns = [
      'ko-fi.com',
      'paypal.com',
      'googletagmanager.com',
      'google-analytics.com',
      'visualstudio.com',
      'dc.services.visualstudio.com',
      'cloudflareinsights.com',
      'turnstile',
      'preload',
      '[DOM] Found',
      'non-unique id',
    ];

    const checkString = (message || '') + ' ' + (filename || '') + ' ' + (source || '');

    if (extensionPatterns.some((pattern) => checkString.includes(pattern))) {
      return true;
    }

    if (adBlockerPatterns.some((pattern) => checkString.includes(pattern))) {
      return true;
    }

    if (thirdPartyPatterns.some((pattern) => checkString.includes(pattern))) {
      return true;
    }

    if (filename && !filename.includes(window.location.hostname) && filename.startsWith('http')) {
      return true;
    }

    return false;
  }

  window.addEventListener('error', function (event) {
    if (isLoggingError) return;

    if (shouldIgnoreError(event.message, event.filename, event.error?.stack)) {
      return;
    }

    try {
      const entry = addLogEntry('errors', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        errorType: event.error?.name,
      });

      if (CONFIG.SHOW_CONSOLE && entry) {
        console.error('🔴 [Logged Error]', entry);
      }
    } catch (e) {
      console.error('[ErrorLogger] Failed to handle error event:', e);
    }
  });

  window.addEventListener('unhandledrejection', function (event) {
    const entry = addLogEntry('errors', 'Unhandled Promise Rejection: ' + event.reason, {
      reason: event.reason,
      stack: event.reason?.stack,
      promise: String(event.promise),
    });

    if (CONFIG.SHOW_CONSOLE) {
      console.error('🔴 [Logged Promise Rejection]', entry);
    }
  });

  const originalConsole = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    log: console.log,
  };

  console.error = function (...args) {
    const message = args.join(' ');
    if (!shouldIgnoreError(message, '', '')) {
      addLogEntry('errors', message, { args: args });
    }
    return originalConsole.error.apply(console, args);
  };

  console.warn = function (...args) {
    const message = args.join(' ');
    if (!shouldIgnoreError(message, '', '')) {
      addLogEntry('warnings', message, { args: args });
    }
    return originalConsole.warn.apply(console, args);
  };

  console.info = function (...args) {
    addLogEntry('info', args.join(' '), { args: args });
    return originalConsole.info.apply(console, args);
  };

  // Keep console.log separate for cleaner output
  console.log = function (...args) {
    const message = args.join(' ');
    if (message.includes('Error') || message.includes('Failed') || message.includes('Warning')) {
      addLogEntry('info', message, { args: args });
    }
    return originalConsole.log.apply(console, args);
  };

  /**
   * Captures network errors (failed fetch/XHR) with timeout support
   */
  const FETCH_TIMEOUT_MS = 30000;

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as any)?.url;
    const options = args[1] || {};

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const fetchOptions = {
      ...options,
      signal: controller.signal,
    };

    return originalFetch
      .apply(this, [args[0], fetchOptions])
      .then((response) => {
        clearTimeout(timeoutId);
        if (!response.ok) {
          if (!shouldIgnoreError('', url, '')) {
            addLogEntry('networkIssues', `Failed fetch: ${url}`, {
              status: response.status,
              statusText: response.statusText,
              url: url,
              method: options.method || 'GET',
            });
          }
        }
        return response;
      })
      .catch((error) => {
        clearTimeout(timeoutId);

        const isTimeout = error.name === 'AbortError';
        const errorMessage = isTimeout ? `Network timeout: ${url}` : `Network error: ${url}`;

        if (!shouldIgnoreError(errorMessage, url, error.stack)) {
          addLogEntry('networkIssues', errorMessage, {
            error: error.message,
            errorType: error.name,
            url: url,
            stack: error.stack,
            timeout: isTimeout,
            timeoutMs: FETCH_TIMEOUT_MS,
          });
        }
        throw error;
      });
  };

  window.addEventListener(
    'error',
    function (event) {
      if (event.target !== window && (event.target as any).tagName) {
        const src = (event.target as any).src || (event.target as any).href || '';
        if (!shouldIgnoreError('', src, '')) {
          addLogEntry('resourceIssues', `Failed to load ${(event.target as any).tagName}`, {
            tagName: (event.target as any).tagName,
            src: src,
            currentSrc: (event.target as any).currentSrc,
          });
        }
      }
    },
    true
  ); // Use capture phase

  function trackUserAction(action, details = {}) {
    addLogEntry('userActivity', action, {
      ...details,
      timestamp: timestamp(),
    });
  }

  document.addEventListener('click', function (event) {
    const target = (event.target as HTMLElement).closest('button, a, [role="button"]');
    if (target) {
      const label =
        target.textContent?.trim().substring(0, 50) ||
        target.getAttribute('aria-label') ||
        target.id ||
        'Unknown button';
      trackUserAction(`Clicked: ${label}`, {
        element: target.tagName,
        id: target.id,
        className: target.className,
      });
    }
  });

  // Track input changes (sanitized)
  document.addEventListener('change', function (event) {
    if (
      (event.target as HTMLInputElement).tagName === 'INPUT' ||
      (event.target as HTMLInputElement).tagName === 'SELECT'
    ) {
      const label =
        (event.target as HTMLInputElement).id ||
        (event.target as HTMLInputElement).name ||
        'Unknown input';
      trackUserAction(`Changed: ${label}`, {
        element: (event.target as HTMLInputElement).tagName,
        type: (event.target as HTMLInputElement).type,
        id: (event.target as HTMLInputElement).id,
      });
    }
  });

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    try {
      originalSetItem.call(this, key, value);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        const quota = checkLocalStorageQuota();
        const valueSizeKB = (value.length / 1024).toFixed(2);

        addLogEntry('errors', `LocalStorage quota exceeded for key "${key}"`, {
          key: key,
          valueSize: value.length,
          valueSizeKB: valueSizeKB,
          error: e.message,
          quota: quota,
          suggestion: 'Clear old data or reduce storage usage',
        });

        console.error(
          `[ErrorLogger] localStorage quota exceeded when setting key "${key}" (${valueSizeKB}KB). Current usage: ${quota?.percentage}%`
        );
      } else {
        console.error('[ErrorLogger] localStorage setItem failed:', e);
        addLogEntry('errors', `LocalStorage setItem failed for key "${key}"`, {
          key: key,
          valueSize: value.length,
          error: e.message,
          errorName: e.name,
        });
      }
      throw e;
    }
  };

  function capturePerformance() {
    if (window.performance) {
      errorLog.performance = {
        timing: {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domReady:
            performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 'N/A',
        },
        memory: (performance as any).memory
          ? {
              usedJSHeapSize:
                Math.round((performance as any).memory.usedJSHeapSize / 1048576) + ' MB',
              totalJSHeapSize:
                Math.round((performance as any).memory.totalJSHeapSize / 1048576) + ' MB',
              limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1048576) + ' MB',
            }
          : 'N/A',
      };
    }
  }

  function generateReport() {
    capturePerformance();

    const appState = {
      mode: document.getElementById('toggleMode')?.dataset?.mode || 'unknown',
      fontSize: (document.getElementById('font-label') as HTMLInputElement | null)?.value || 'N/A',
      lineLength:
        (document.getElementById('lineLengthInput') as HTMLInputElement | null)?.value || 'N/A',
      chatlogInput:
        (document.getElementById('chatlogInput') as HTMLInputElement | null)?.value || '',
      outputHTML: document.getElementById('output')?.innerHTML || '',
      backgroundEnabled: localStorage.getItem('backgroundEnabled') || 'N/A',
      characterColoring: localStorage.getItem('characterNameColoring') || 'N/A',
      exportWidth:
        (document.getElementById('exportWidth') as HTMLInputElement | null)?.value || 'N/A',
      exportHeight:
        (document.getElementById('exportHeight') as HTMLInputElement | null)?.value || 'N/A',
      exportPPI: (document.getElementById('exportPPI') as HTMLInputElement | null)?.value || 'N/A',
      paddingH:
        (document.getElementById('textPaddingHorizontal') as HTMLInputElement | null)?.value ||
        'N/A',
      paddingV:
        (document.getElementById('textPaddingVertical') as HTMLInputElement | null)?.value || 'N/A',
    };

    const report: string[] = [];

    report.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    report.push('🐛 ERROR REPORT - GTAW Chatlog Magician');
    report.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    report.push('');

    report.push('📋 SESSION');
    report.push('  Session ID:    ' + errorLog.sessionId);
    report.push('  Timestamp:     ' + timestamp());
    report.push('  User Agent:    ' + errorLog.userAgent);
    report.push('  Platform:      ' + errorLog.platform);
    report.push('  Screen:        ' + errorLog.screenResolution);
    report.push('  Viewport:      ' + errorLog.viewport);
    report.push('  Timezone:      ' + errorLog.timezone);
    report.push('');

    report.push('⚠️  ERROR SUMMARY');
    report.push('  Errors:        ' + errorLog.errors.length);
    report.push('  Warnings:      ' + errorLog.warnings.length);
    report.push('  Network:       ' + (errorLog.networkIssues?.length || 0));
    report.push('  Resources:     ' + (errorLog.resourceIssues?.length || 0));
    report.push('');

    if (errorLog.errors.length > 0) {
      report.push('❌ ERRORS (' + errorLog.errors.length + ')');
      errorLog.errors.forEach((err, i) => {
        report.push('  ' + (i + 1) + '. ' + err.message);
        report.push('     Time:    ' + err.timestamp);
        if (err.details.filename) {
          report.push(
            '     File:    ' +
              err.details.filename +
              ':' +
              err.details.lineno +
              ':' +
              err.details.colno
          );
        }
        if (err.details.errorType) {
          report.push('     Type:    ' + err.details.errorType);
        }
        if (err.stack) {
          const stackLines = err.stack.split('\n').slice(0, 5);
          report.push('     Stack:   ' + stackLines[0]);
          stackLines.slice(1).forEach((line) => {
            report.push('              ' + line.trim());
          });
        }
        report.push('');
      });
    } else {
      report.push('✓ No errors logged');
      report.push('');
    }

    if (errorLog.warnings.length > 0) {
      report.push('⚠️  WARNINGS (' + errorLog.warnings.length + ')');
      errorLog.warnings.slice(-10).forEach((warn, i) => {
        report.push('  ' + (i + 1) + '. [' + warn.timestamp + '] ' + warn.message);
      });
      report.push('');
    }

    if (errorLog.networkIssues && errorLog.networkIssues.length > 0) {
      report.push('🌐 NETWORK ISSUES (' + errorLog.networkIssues.length + ')');
      errorLog.networkIssues.slice(-10).forEach((err, i) => {
        report.push('  ' + (i + 1) + '. ' + err.message);
        if (err.details) {
          report.push(
            '     Status: ' +
              (err.details.status || 'N/A') +
              ' | URL: ' +
              (err.details.url || 'N/A')
          );
          if (err.details.timeout) {
            report.push('     Timeout: ' + err.details.timeoutMs + 'ms');
          }
        }
      });
      report.push('');
    }

    if (errorLog.resourceIssues && errorLog.resourceIssues.length > 0) {
      report.push('📦 RESOURCE LOADING FAILURES (' + errorLog.resourceIssues.length + ')');
      errorLog.resourceIssues.slice(-10).forEach((err, i) => {
        report.push('  ' + (i + 1) + '. ' + err.message);
        if (err.details && err.details.src) {
          report.push('     Source: ' + err.details.src);
        }
      });
      report.push('');
    }

    if (errorLog.userActivity && errorLog.userActivity.length > 0) {
      report.push('👤 USER ACTIVITY (Last 10 actions)');
      errorLog.userActivity.slice(-10).forEach((action, i) => {
        report.push('  ' + (i + 1) + '. [' + action.timestamp + '] ' + action.message);
      });
      report.push('');
    }

    report.push('⚙️  APP STATE');
    report.push('  Mode:          ' + appState.mode);
    report.push('  Font Size:     ' + appState.fontSize);
    report.push('  Line Length:   ' + appState.lineLength);
    report.push(
      '  Export:        ' +
        appState.exportWidth +
        '×' +
        appState.exportHeight +
        'px @ ' +
        appState.exportPPI +
        ' PPI'
    );
    report.push('  Padding:       H:' + appState.paddingH + ' V:' + appState.paddingV);
    report.push('  Background:    ' + (appState.backgroundEnabled === 'true' ? 'ON' : 'OFF'));
    report.push('  Char Coloring: ' + (appState.characterColoring === 'false' ? 'OFF' : 'ON'));
    report.push('');

    // Always show full content
    report.push('📝 CHATLOG INPUT (' + appState.chatlogInput.length + ' chars)');
    if (appState.chatlogInput) {
      report.push('  ' + appState.chatlogInput.replace(/\n/g, '\n  '));
    } else {
      report.push('  (empty)');
    }
    report.push('');

    // Always show full content
    report.push('🖼️  CHATLOG OUTPUT (' + appState.outputHTML.length + ' chars HTML)');
    if (appState.outputHTML) {
      report.push('  ' + appState.outputHTML.replace(/\n/g, '\n  '));
    } else {
      report.push('  (empty)');
    }
    report.push('');

    report.push('⚡ PERFORMANCE');
    if (errorLog.performance.timing) {
      report.push('  Page Load:     ' + errorLog.performance.timing.loadTime + 'ms');
      report.push('  DOM Ready:     ' + errorLog.performance.timing.domReady + 'ms');
      report.push('  First Paint:   ' + errorLog.performance.timing.firstPaint + 'ms');
      if (errorLog.performance.memory !== 'N/A') {
        report.push(
          '  Memory:        ' +
            errorLog.performance.memory.usedJSHeapSize +
            ' / ' +
            errorLog.performance.memory.totalJSHeapSize +
            ' (limit: ' +
            errorLog.performance.memory.limit +
            ')'
        );
      }
    } else {
      report.push('  Not available');
    }
    report.push('');

    report.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    report.push('Auto-generated at ' + new Date().toLocaleString());
    report.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return report.join('\n');
  }

  /** Opens the privacy-preserving feedback form without attaching the local log. */
  function autoSendReport() {
    if (window.ChatlogFeedback?.open) {
      window.ChatlogFeedback.open();
      return;
    }
    document.getElementById('openFeedbackBtn')?.click();
  }

  /**
   * Copies report to clipboard (fallback method)
   */
  function copyReportToClipboard() {
    const report = generateReport();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(report)
        .then(() => {
          // Don't show another toast if already showing warning toast
          // Just log to console
          console.log('Error report copied to clipboard');
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
          showReportInModal(report);
        });
    } else {
      showReportInModal(report);
    }
  }

  function showReportInModal(report) {
    if (typeof HTMLDialogElement !== 'undefined') {
      let dlg = document.getElementById('reportDialog') as HTMLDialogElement | null;
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'reportDialog';
        dlg.setAttribute('aria-label', 'Error Report');
        dlg.innerHTML = `
          <form method="dialog" style="margin:0;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px;">Error Report</h2>
            <p style="margin:0 0 8px 0;">Copy this report and send it to the developer:</p>
            <textarea readonly style="width: 80vw; max-width: 800px; height: 50vh; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">${report}</textarea>
            <div style="margin-top: 10px; text-align: right;">
              <button value="close" style="padding: 10px 16px;">Close</button>
            </div>
          </form>`;
        document.body.appendChild(dlg);
      } else {
        const ta = dlg.querySelector('textarea') as HTMLTextAreaElement | null;
        if (ta) ta.value = report;
      }
      dlg.showModal();
      const main = document.getElementById('main');
      if (main) {
        main.setAttribute('inert', '');
        main.setAttribute('aria-hidden', 'true');
      }
      dlg.addEventListener(
        'close',
        () => {
          if (main) {
            main.removeAttribute('inert');
            main.removeAttribute('aria-hidden');
          }
        },
        { once: true }
      );
      (dlg.querySelector('textarea') as HTMLTextAreaElement | null)?.select();
      return;
    }
    // Fallback for browsers without <dialog>
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,.8); z-index: 99999; display:flex; align-items:center; justify-content:center; padding:20px;`;
    const content = document.createElement('div');
    content.style.cssText = `background: white; padding: 20px; border-radius: 8px; max-width: 800px; max-height: 80vh; overflow: auto; box-shadow: 0 4px 20px rgba(0,0,0,.3);`;
    content.innerHTML = `
      <h2 style="margin-top:0;">Error Report</h2>
      <p>Copy this report and send it to the developer:</p>
      <textarea readonly style="width:100%; height:400px; font-family: monospace; font-size:12px; padding:10px; border:1px solid #ccc; border-radius:4px;">${report}</textarea>
      <div style="margin-top:10px; text-align:right;"><button id="closeReportModal" style="padding:10px 20px;">Close</button></div>`;
    modal.appendChild(content);
    document.body.appendChild(modal);
    (content.querySelector('textarea') as HTMLTextAreaElement).select();
    (content.querySelector('#closeReportModal') as HTMLElement).onclick = () =>
      document.body.removeChild(modal);
    modal.onclick = (e) => {
      if (e.target === modal) document.body.removeChild(modal);
    };
  }

  async function clearLog() {
    const confirmed =
      typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog({
            title: 'Hata Günlüğünü Temizle',
            message: 'Kayıtlı tüm hata günlüğünü silmek istediğinizden emin misiniz?',
            confirmText: 'Temizle',
            cancelText: 'Vazgeç',
            danger: true,
          })
        : confirm('Are you sure you want to clear the error log?');

    if (confirmed) {
      errorLog.errors = [];
      errorLog.warnings = [];
      errorLog.info = [];
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      console.info('✓ Error log cleared');
      if (typeof window.showToast === 'function') {
        window.showToast('Hata günlüğü temizlendi', 'fa-trash-alt');
      }
    }
  }

  function downloadReport() {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatlog-error-report-${errorLog.sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Remove diagnostics persisted by legacy releases. New diagnostics remain memory-only.
  localStorage.removeItem(CONFIG.STORAGE_KEY);

  if (document.readyState === 'complete') {
    capturePerformance();
  } else {
    window.addEventListener('load', capturePerformance);
  }

  // Expose API globally
  (window as any).ErrorLogger = {
    getLog: () => errorLog,
    generateReport: generateReport,
    sendReport: autoSendReport,
    copyReport: copyReportToClipboard, // Fallback: Manual copy
    downloadReport: downloadReport,
    clearLog: clearLog,
    logError: (msg, details) => addLogEntry('errors', msg, details),
    logWarning: (msg, details) => addLogEntry('warnings', msg, details),
    logInfo: (msg, details) => addLogEntry('info', msg, details),
    checkQuota: checkLocalStorageQuota,
  };

  if (CONFIG.SHOW_CONSOLE) {
    console.info('Error Logger initialized. ErrorLogger.sendReport() opens the feedback form.');
    console.info('  Available commands:');
    console.info('  - ErrorLogger.sendReport() - Open the feedback form');
    console.info('  - ErrorLogger.copyReport() - Copy report to clipboard');
    console.info('  - ErrorLogger.downloadReport() - Download as .txt file');
    console.info('  - ErrorLogger.getLog() - View full log');
    console.info('  - ErrorLogger.clearLog() - Clear all logs');
  }
})();
