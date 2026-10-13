/**
 * Unit Test Suite: PII & Credential Scrubber (SEC-001, PRIV-001, PRIV-003)
 * Tests Luhn algorithm card masking, UUID anonymization, credential redaction,
 * and health keyword scrubbing
 */

import { describe, it, expect } from 'vitest';
import {
  isLuhnValid,
  scrubCreditCards,
  scrubUuids,
  scrubCredentials,
  scrubHealthKeywords,
  scrubText,
  scrubObject,
} from '../../../src/server/diagnostics/pii-scrubber';

describe('CHK-MOD-05-PRIVACY: PII Scrubber Unit Tests (PRIV-003, SEC-001, PRIV-001)', () => {
  it('accurately validates credit card numbers using Luhn checksum', () => {
    // Valid Visa
    expect(isLuhnValid('4532015112830366')).toBe(true);
    // Valid Mastercard
    expect(isLuhnValid('5424180123456789')).toBe(true);
    // Valid Amex (15 digits)
    expect(isLuhnValid('378282246310005')).toBe(true);

    // Invalid numbers
    expect(isLuhnValid('4532015112830367')).toBe(false);
    expect(isLuhnValid('1234567890123456')).toBe(false);
    expect(isLuhnValid('12345')).toBe(false); // Too short
  });

  it('scrubs Luhn-valid credit card numbers with [REDACTED_CARD] (SEC-001)', () => {
    const textWithCard = 'Please charge my card 4532-0151-1283-0366 for the order.';
    const scrubbed = scrubCreditCards(textWithCard);
    expect(scrubbed).toBe('Please charge my card [REDACTED_CARD] for the order.');
    expect(scrubbed).not.toContain('4532');

    // Phone numbers (non-Luhn) are preserved
    const textWithPhone = 'Call me at 800-555-0199 or order id 9876543210123.';
    const preserved = scrubCreditCards(textWithPhone);
    expect(preserved).toBe(textWithPhone);
  });

  it('replaces session UUIDs with deterministic synthetic tokens user-anon-xxxx (PRIV-001)', () => {
    const rawUuid = 'c5307718-9708-439f-aa8d-226447adacdd';
    const textWithUuid = `Session ID: ${rawUuid} initiated checkout.`;
    const scrubbed = scrubUuids(textWithUuid);

    expect(scrubbed).toBe('Session ID: user-anon-acdd initiated checkout.');
    expect(scrubbed).not.toContain(rawUuid);
  });

  it('redacts AWS access keys, secret keys, and Bearer tokens (PRIV-003)', () => {
    const textWithAwsKey = 'Using AWS key AKIAIOSFODNN7EXAMPLE for client authentication.';
    expect(scrubCredentials(textWithAwsKey)).toBe(
      'Using AWS key ***REDACTED*** for client authentication.'
    );

    const textWithBearer = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
    expect(scrubCredentials(textWithBearer)).toBe(
      'Authorization: Bearer ***REDACTED***'
    );

    const textWithSecret = 'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"';
    expect(scrubCredentials(textWithSecret)).toContain('***REDACTED***');
    expect(scrubCredentials(textWithSecret)).not.toContain('wJalrXUtnFEMI');
  });

  it('scrubs sensitive medical and dietary allergy keywords (PRIV-001, PRIV-003)', () => {
    const text = 'Customer has severe peanut allergy and celiac disease.';
    const scrubbed = scrubHealthKeywords(text);

    expect(scrubbed).toContain('[REDACTED_HEALTH]');
    expect(scrubbed).not.toContain('peanut allergy');
    expect(scrubbed).not.toContain('celiac disease');
  });

  it('recursively scrubs complex nested objects and arrays without mutating structure', () => {
    const sensitivePayload = {
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      userNote: 'Customer has dairy allergy, card is 4532015112830366',
      metadata: {
        awsKey: 'AKIA1111222233334444',
        password: 'super-secret-password-123',
        tags: ['peanut allergy', 'quick-prep'],
      },
      itemCount: 2,
    };

    const scrubbed = scrubObject(sensitivePayload);

    expect(scrubbed.sessionId).toBe('user-anon-0000');
    expect(scrubbed.userNote).toContain('[REDACTED_HEALTH]');
    expect(scrubbed.userNote).toContain('[REDACTED_CARD]');
    expect(scrubbed.userNote).not.toContain('4532015112830366');
    expect(scrubbed.metadata.awsKey).toBe('***REDACTED***');
    expect(scrubbed.metadata.password).toBe('***REDACTED***');
    expect(scrubbed.metadata.tags[0]).toBe('[REDACTED_HEALTH]');
    expect(scrubbed.metadata.tags[1]).toBe('quick-prep');
    expect(scrubbed.itemCount).toBe(2);
  });
});
