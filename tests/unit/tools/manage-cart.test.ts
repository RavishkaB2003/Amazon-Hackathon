import { describe, it, expect, beforeEach } from 'vitest';
import {
  manageCartHandler,
  getCart,
  addItemToCart,
  addBundleToCart,
  removeItemFromCart,
  clearCart,
  resetAllCarts,
  containsPaymentData,
} from '../../../src/server/mcp/tools/manage-cart';
import type { CartState } from '../../../src/shared/types/tools';

describe('Tool: manage_cart (Unit)', () => {
  beforeEach(() => {
    resetAllCarts();
  });

  it('initializes an empty session cart with version 1 and zero totals', () => {
    const cart = getCart('session-user-1');
    expect(cart.sessionId).toBe('session-user-1');
    expect(cart.version).toBe(1);
    expect(cart.items).toEqual([]);
    expect(cart.itemCount).toBe(0);
    expect(cart.subtotal).toBe(0);
    expect(cart.estimatedTax).toBe(0);
    expect(cart.total).toBe(0);
    expect(cart.currency).toBe('USD');
  });

  it('guarantees tenant isolation between sessions (CTRL-04)', () => {
    addItemToCart('session-user-1', { sku: 'FRESH-SALMON-01', quantity: 1 });
    const cart1 = getCart('session-user-1');
    const cart2 = getCart('session-user-2');

    expect(cart1.itemCount).toBe(1);
    expect(cart2.itemCount).toBe(0);
    expect(cart2.items).toEqual([]);
  });

  it('adds individual item and accurately computes subtotal, 8.25% tax, and total (FR-008)', async () => {
    const res = await manageCartHandler({
      action: 'add_item',
      sessionId: 'session-user-1',
      items: [{ sku: 'FRESH-SALMON-01', quantity: 2, price: 11.99, title: 'Atlantic Salmon' }],
    });

    expect(res.isError).toBeFalsy();
    const cart: CartState = JSON.parse(res.content[0].text || '{}');

    expect(cart.version).toBe(2);
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotal).toBe(23.98);
    // 23.98 * 0.0825 = 1.97835 -> 1.98
    expect(cart.estimatedTax).toBe(1.98);
    expect(cart.total).toBe(25.96);
  });

  it('adds curated bundle matching MOD-02 specification math exactly', async () => {
    const res = await manageCartHandler({
      action: 'add_bundle',
      sessionId: 'session-test-elena',
      bundleId: 'bnd-mediterranean-salmon-1728480000',
      items: [
        { sku: 'FRESH-SALMON-01', quantity: 1, title: 'Fresh Atlantic Salmon Fillet', price: 11.99 },
        { sku: 'FRESH-QUINOA-01', quantity: 1, title: 'Organic Tricolor Quinoa', price: 3.99 },
        { sku: 'FRESH-CUCUMBER-01', quantity: 1, title: 'English Cucumber', price: 1.49 },
      ],
      version: 1,
    });

    expect(res.isError).toBeFalsy();
    const cart: CartState = JSON.parse(res.content[0].text || '{}');

    // Matches specification line 318
    expect(cart.sessionId).toBe('session-test-elena');
    expect(cart.version).toBe(2);
    expect(cart.itemCount).toBe(3);
    expect(cart.subtotal).toBe(17.47);
    expect(cart.estimatedTax).toBe(1.44); // 17.47 * 0.0825 = 1.441275 -> 1.44
    expect(cart.total).toBe(18.91);
    expect(cart.currency).toBe('USD');
  });

  it('removes item from cart and recalculates totals and version', async () => {
    addItemToCart('session-user-1', { sku: 'FRESH-SALMON-01', quantity: 2, price: 11.99 });
    addItemToCart('session-user-1', { sku: 'FRESH-QUINOA-01', quantity: 1, price: 3.99 });

    const res = await manageCartHandler({
      action: 'remove_item',
      sessionId: 'session-user-1',
      sku: 'FRESH-SALMON-01',
      quantity: 1,
    });

    expect(res.isError).toBeFalsy();
    const cart: CartState = JSON.parse(res.content[0].text || '{}');

    expect(cart.items.find((i) => i.sku === 'FRESH-SALMON-01')?.quantity).toBe(1);
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotal).toBe(15.98); // 11.99 + 3.99
  });

  it('clears cart completely (PRIV-002 instant purge)', async () => {
    addItemToCart('session-user-1', { sku: 'FRESH-SALMON-01', quantity: 2 });
    const res = await manageCartHandler({
      action: 'clear',
      sessionId: 'session-user-1',
    });

    expect(res.isError).toBeFalsy();
    const cart: CartState = JSON.parse(res.content[0].text || '{}');
    expect(cart.items).toEqual([]);
    expect(cart.itemCount).toBe(0);
    expect(cart.total).toBe(0);
  });

  it('enforces Optimistic Concurrency Control (OCC) detecting stale version (CTRL-12)', async () => {
    // Initial cart version is 1
    const cartInitial = getCart('session-occ');
    expect(cartInitial.version).toBe(1);

    // Voice mutation increments version to 2
    addItemToCart('session-occ', { sku: 'FRESH-SALMON-01', quantity: 1 });
    expect(getCart('session-occ').version).toBe(2);

    // Stale touch interaction attempts mutation with expected version 1
    const conflictRes = await manageCartHandler({
      action: 'add_item',
      sessionId: 'session-occ',
      sku: 'FRESH-QUINOA-01',
      quantity: 1,
      version: 1, // Stale version!
    });

    expect(conflictRes.isError).toBe(true);
    expect(conflictRes.content[0].text).toContain('Cart concurrency conflict');

    // Cart state was NOT corrupted and version remains 2
    expect(getCart('session-occ').version).toBe(2);
    expect(getCart('session-occ').itemCount).toBe(1);
  });

  describe('Payment Isolation Guard (SEC-001)', () => {
    it('detects and rejects PAN / card numbers in payload', () => {
      expect(containsPaymentData({ cardNumber: '4111222233334444' })).toBe(true);
      expect(containsPaymentData({ pan: '4111222233334444' })).toBe(true);
      expect(containsPaymentData({ cvv: '123' })).toBe(true);
      expect(containsPaymentData({ cvc: '123' })).toBe(true);
      expect(containsPaymentData({ expiry: '12/28' })).toBe(true);
      expect(containsPaymentData({ billingAddress: '123 Main St' })).toBe(true);
      expect(containsPaymentData({ creditCard: { num: '4111' } })).toBe(true);
      expect(containsPaymentData({ items: [{ sku: 'FRESH-SALMON-01', cardNumber: '1234' }] })).toBe(true);
      expect(containsPaymentData({ note: 'Payment card: 4111-2222-3333-4444' })).toBe(true);

      // Safe payload
      expect(containsPaymentData({ sessionId: 'sess-1', sku: 'FRESH-SALMON-01', quantity: 1 })).toBe(false);
    });

    it('rejects tool call containing payment data with security violation (SEC-001)', async () => {
      const maliciousRes = await manageCartHandler({
        action: 'add_item',
        sessionId: 'session-attack',
        sku: 'FRESH-SALMON-01',
        cardNumber: '4111222233334444',
        cvv: '999',
      } as unknown as Record<string, unknown>);

      expect(maliciousRes.isError).toBe(true);
      expect(maliciousRes.content[0].text).toContain(
        'Security violation: Payment card information (PAN/CVV) is strictly prohibited (SEC-001)'
      );

      // Ensure no state was written
      expect(getCart('session-attack').items).toEqual([]);
    });
  });
});
