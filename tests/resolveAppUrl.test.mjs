import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Core logic identical to helper implemented in supabase/functions/invite-user/index.ts
export function isAllowedOrigin(hostname) {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === 'goodplusfast.com' ||
    lower.endsWith('.goodplusfast.com')
  );
}

export function resolveAppUrl({ siteUrl, originHeader, refererHeader, envAppSiteUrl, defaultFallback = 'http://localhost:5173' }) {
  const candidates = [siteUrl, originHeader, refererHeader, envAppSiteUrl];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string' || candidate === 'null') continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue;
      }
      if (!isAllowedOrigin(parsed.hostname)) {
        continue;
      }
      return parsed.origin;
    } catch (_) {
      // ignore invalid URL format and continue cascade
    }
  }

  return defaultFallback;
}

describe('Dynamic Domain Resolution (resolveAppUrl)', () => {
  test('uses explicit siteUrl from client when provided and valid', () => {
    const result = resolveAppUrl({
      siteUrl: 'https://tlc.goodplusfast.com',
      originHeader: 'http://localhost:5173',
      envAppSiteUrl: 'http://localhost:5173'
    });
    assert.equal(result, 'https://tlc.goodplusfast.com');
  });

  test('adapts dynamically when domain changes to something_else.goodplusfast.com', () => {
    const result = resolveAppUrl({
      siteUrl: 'https://something_else.goodplusfast.com',
      envAppSiteUrl: 'https://tlc.goodplusfast.com'
    });
    assert.equal(result, 'https://something_else.goodplusfast.com');
  });

  test('extracts clean origin and strips paths, hashes, and query parameters', () => {
    const result = resolveAppUrl({
      siteUrl: 'https://tlc.goodplusfast.com/#/troop/SC-0110/roster/leaders?tab=active'
    });
    assert.equal(result, 'https://tlc.goodplusfast.com');
  });

  test('accepts localhost in local development environment', () => {
    const result = resolveAppUrl({
      siteUrl: 'http://localhost:5173'
    });
    assert.equal(result, 'http://localhost:5173');
  });

  test('falls back to Origin header when siteUrl is not provided', () => {
    const result = resolveAppUrl({
      originHeader: 'https://tlc.goodplusfast.com'
    });
    assert.equal(result, 'https://tlc.goodplusfast.com');
  });

  test('falls back to Referer header when siteUrl and Origin are absent', () => {
    const result = resolveAppUrl({
      refererHeader: 'https://tlc.goodplusfast.com/#/troop/SC-0110/roster'
    });
    assert.equal(result, 'https://tlc.goodplusfast.com');
  });

  test('falls back to APP_SITE_URL environment variable if client headers are missing', () => {
    const result = resolveAppUrl({
      envAppSiteUrl: 'https://tlc.goodplusfast.com'
    });
    assert.equal(result, 'https://tlc.goodplusfast.com');
  });

  test('falls back to http://localhost:5173 when no inputs are provided', () => {
    const result = resolveAppUrl({});
    assert.equal(result, 'http://localhost:5173');
  });

  test('rejects disallowed domains per least-privilege allowlist and cascades to fallback', () => {
    const result = resolveAppUrl({
      siteUrl: 'https://malicious-phishing-site.com',
      originHeader: 'https://evil.org',
      envAppSiteUrl: 'https://tlc.goodplusfast.com'
    });
    assert.equal(result, 'https://tlc.goodplusfast.com');
  });

  test('rejects non-http(s) protocols such as javascript: or file:', () => {
    const result = resolveAppUrl({
      siteUrl: 'javascript:alert(1)',
      defaultFallback: 'http://localhost:5173'
    });
    assert.equal(result, 'http://localhost:5173');
  });

  test('handles null, undefined, empty string and non-string inputs gracefully', () => {
    assert.equal(resolveAppUrl({ siteUrl: null }), 'http://localhost:5173');
    assert.equal(resolveAppUrl({ siteUrl: 'null' }), 'http://localhost:5173');
    assert.equal(resolveAppUrl({ siteUrl: '' }), 'http://localhost:5173');
    assert.equal(resolveAppUrl({ siteUrl: 12345 }), 'http://localhost:5173');
  });
});
