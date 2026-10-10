import { describe, it, expect } from 'vitest';
import {
  containsPaymentData,
  isValidLuhn,
} from '../../../src/server/mcp/tools/manage-cart';

describe('SEC-001 Payment Guard with Luhn (Mod-10) Validation', () => {
  describe('isValidLuhn', () => {
    it('correctly validates valid credit card PANs', () => {
      expect(isValidLuhn('4111111111111111')).toBe(true); // Visa test
      expect(isValidLuhn('4242424242424242')).toBe(true); // Stripe test
      expect(isValidLuhn('378282246310005')).toBe(true);  // Amex test
    });

    it('returns false for invalid checksums and non-numeric characters', () => {
      expect(isValidLuhn('1234567890123456')).toBe(false);
      expect(isValidLuhn('12345678901234')).toBe(false);
      expect(isValidLuhn('abc12345678901')).toBe(false);
    });
  });

  describe('containsPaymentData', () => {
    it('allows legitimate 14-digit and 16-digit barcodes and tracking numbers without false positives', () => {
      // 14-digit GTIN / barcode
      expect(containsPaymentData({ barcode: '12345678901234' })).toBe(false);
      // 16-digit tracking number in customer note
      expect(
        containsPaymentData({ note: 'Please use delivery tracking 1234567890123456' })
      ).toBe(false);
      // Large numeric item quantity or SKU code
      expect(
        containsPaymentData({ items: [{ sku: 'SKU-999', note: 'Batch 98765432109876' }] })
      ).toBe(false);
    });

    it('blocks real and test PANs passing Luhn or in known test lists', () => {
      expect(containsPaymentData({ note: 'Card: 4111111111111111' })).toBe(true);
      expect(containsPaymentData({ note: 'Card: 4242424242424242' })).toBe(true);
      expect(containsPaymentData({ note: 'Card: 4111-2222-3333-4444' })).toBe(true);
    });

    it('blocks explicit payment keys regardless of value', () => {
      expect(containsPaymentData({ cvv: '123' })).toBe(true);
      expect(containsPaymentData({ pan: '999999999999' })).toBe(true);
      expect(containsPaymentData({ cardNumber: '1234' })).toBe(true);
      expect(containsPaymentData({ expirationDate: '12/28' })).toBe(true);
    });
  });
});
