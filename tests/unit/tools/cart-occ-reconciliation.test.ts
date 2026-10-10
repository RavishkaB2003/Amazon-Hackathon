import { describe, it, expect, beforeEach } from 'vitest';
import {
  manageCartHandler,
  resetAllCarts,
  addItemToCart,
} from '../../../src/server/mcp/tools/manage-cart';

describe('Cart OCC Reconciliation & Error Enrichment', () => {
  beforeEach(() => {
    resetAllCarts();
  });

  it('returns structured JSON with currentVersion and currentCart on version mismatch', async () => {
    const sessionId = 'occ-recon-session';

    // Step 1: Add initial item (cart version moves from 1 -> 2)
    addItemToCart(sessionId, { sku: 'FRESH-SALMON-01', quantity: 1 }, 1);

    // Step 2: Attempt mutation with stale expected version 1 (server is now version 2)
    const res = await manageCartHandler({
      action: 'add_item',
      sessionId,
      sku: 'FRESH-AVOCADO-02',
      quantity: 1,
      version: 1, // Stale version!
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].type).toBe('text');

    const text = res.content[0]?.text ?? '{}';
    const errorPayload = JSON.parse(text);
    expect(errorPayload.error).toBe('CONCURRENCY_CONFLICT');
    expect(errorPayload.expectedVersion).toBe(1);
    expect(errorPayload.currentVersion).toBe(2);
    expect(errorPayload.currentCart).toBeDefined();
    expect(errorPayload.currentCart.version).toBe(2);
    expect(errorPayload.currentCart.items.length).toBe(1);
    expect(errorPayload.currentCart.items[0].sku).toBe('FRESH-SALMON-01');
  });
});
