/**
 * Aura+ PII & Credential Scrubber
 * Strict sanitization utility enforcing SEC-001, PRIV-001, and PRIV-003
 */

import type { PiiScrubberOptions } from '../../shared/types/diagnostics';

const DEFAULT_OPTIONS: Required<PiiScrubberOptions> = {
  maskCard: true,
  maskUuid: true,
  maskKeywords: true,
  maskSecrets: true,
};

/**
 * Validates candidate string of digits against Luhn checksum (MOD-05, SEC-001)
 */
export function isLuhnValid(candidate: string): boolean {
  const digitsOnly = candidate.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digitsOnly)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let digit = parseInt(digitsOnly.charAt(i), 10);
    if (isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Scrubs credit card numbers (13-19 digits) validating via Luhn algorithm (SEC-001)
 */
export function scrubCreditCards(text: string): string {
  // Pattern matches 13 to 19 digits with optional spaces or dashes between digit groups
  const cardCandidateRegex = /\b(?:\d[ -]*?){13,19}\b/g;

  return text.replace(cardCandidateRegex, (match) => {
    if (isLuhnValid(match)) {
      return '[REDACTED_CARD]';
    }
    return match;
  });
}

/**
 * Scrubs session UUIDs to deterministic synthetic tokens user-anon-xxxx (PRIV-001)
 */
export function scrubUuids(text: string): string {
  const uuidRegex = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

  return text.replace(uuidRegex, (uuid) => {
    const suffix = uuid.slice(-4).toLowerCase();
    return `user-anon-${suffix}`;
  });
}

/**
 * Scrubs AWS credentials, secret keys, and Bearer tokens (PRIV-003, SEC-001)
 */
export function scrubCredentials(text: string): string {
  let result = text;

  // 1. AWS Access Key IDs (AKIA, ASIA, ABIA, ACCA followed by 16 alphanumeric characters)
  const awsKeyRegex = /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g;
  result = result.replace(awsKeyRegex, '***REDACTED***');

  // 2. Bearer tokens
  const bearerRegex = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
  result = result.replace(bearerRegex, 'Bearer ***REDACTED***');

  // 3. AWS secret access key patterns in query strings or config
  const secretKeyRegex = /(?:aws_secret_access_key|aws_secret|secret_key|api_key|apiKey)\s*[:=]\s*["']?([A-Za-z0-9/+=]{20,40})["']?/gi;
  result = result.replace(secretKeyRegex, (match, keyVal) => {
    return match.replace(keyVal, '***REDACTED***');
  });

  return result;
}

/**
 * Scrubs sensitive medical and dietary health conditions in exported text (PRIV-001, PRIV-003)
 */
export function scrubHealthKeywords(text: string): string {
  const healthConditionsRegex = /\b(?:peanut allergy|dairy allergy|shellfish allergy|gluten allergy|nut allergy|tree nut allergy|celiac disease|celiac|anaphylaxis|diabetic|hypertension|cardiac condition|epipen|severe allergy|allergic to [a-zA-Z]+)\b/gi;

  return text.replace(healthConditionsRegex, '[REDACTED_HEALTH]');
}

/**
 * Sanitizes a single string using all active PII and credential scrubbers
 */
export function scrubText(text: string, options?: PiiScrubberOptions): string {
  if (typeof text !== 'string') return text;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  let sanitized = text;

  if (opts.maskSecrets) {
    sanitized = scrubCredentials(sanitized);
  }

  if (opts.maskCard) {
    sanitized = scrubCreditCards(sanitized);
  }

  if (opts.maskUuid) {
    sanitized = scrubUuids(sanitized);
  }

  if (opts.maskKeywords) {
    sanitized = scrubHealthKeywords(sanitized);
  }

  return sanitized;
}

/**
 * Recursively scrubs objects, arrays, and primitives of PII and credentials
 */
export function scrubObject<T>(obj: T, options?: PiiScrubberOptions): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return scrubText(obj, options) as unknown as T;
  }

  if (typeof obj === 'bigint') {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObject(item, options)) as unknown as T;
  }

  const sensitiveKeyRegex = /^(?:password|secret|authorization|token|cookie|credit_card|card_number|pan|cvv)$/i;

  const scrubbedRecord: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveKeyRegex.test(key) && typeof value === 'string') {
      scrubbedRecord[key] = '***REDACTED***';
    } else {
      scrubbedRecord[key] = scrubObject(value, options);
    }
  }

  return scrubbedRecord as T;
}

export const piiScrubber = {
  scrubText,
  scrubObject,
  isLuhnValid,
  scrubCreditCards,
  scrubUuids,
  scrubCredentials,
  scrubHealthKeywords,
};
