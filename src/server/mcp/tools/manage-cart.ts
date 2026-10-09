/**
 * Tool: manage_cart
 * FR-008 & SEC-001: Session-isolated in-memory shopping cart management
 * with subtotal, 8.25% estimated tax, OCC versioning, and strict payment
 * data isolation (zero PAN/PCI).
 */

import type { McpToolRegistration, McpToolResult, RequestContext } from '../../../shared/types/mcp';
import { getCatalogItemBySku } from '../../data/catalog';
import {
  ManageCartInputSchema,
  type CartItem,
  type CartState,
  type ManageCartInput,
} from '../../../shared/types/tools';

export const MANAGE_CART_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['get_cart', 'add_item', 'add_bundle', 'remove_item', 'clear'],
      description: 'Cart operation to perform',
    },
    sessionId: {
      type: 'string',
      minLength: 1,
      description: 'Unique user session identifier',
    },
    items: {
      type: 'array',
      description: 'Items to add to the cart (for add_item or add_bundle)',
    },
    bundleId: {
      type: 'string',
      description: 'Associated bundle identifier when adding recipe bundle',
    },
    sku: {
      type: 'string',
      description: 'SKU of individual item for single add or remove operations',
    },
    quantity: {
      type: 'integer',
      minimum: 1,
      description: 'Quantity of item for add or remove operations',
    },
    version: {
      type: 'integer',
      minimum: 1,
      description: 'Expected cart version for Optimistic Concurrency Control',
    },
  },
  required: ['action', 'sessionId'],
};

// Forbidden payment and PAN identifiers (SEC-001)
const FORBIDDEN_PAYMENT_KEYS = new Set([
  'cardnumber',
  'pan',
  'cvv',
  'cvc',
  'expiry',
  'expirationdate',
  'billingaddress',
  'creditcard',
  'card_number',
  'exp_month',
  'exp_year',
]);

/**
 * Recursively scans payload for prohibited payment card identifiers (SEC-001).
 */
export function containsPaymentData(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    if (typeof payload === 'string') {
      // Check for standalone or embedded 13-19 digit card numbers (with optional spaces or hyphens)
      const matches = payload.match(/(?:\d[ -]*?){13,19}/g);
      if (matches) {
        for (const match of matches) {
          const digitsOnly = match.replace(/\D/g, '');
          if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
            return true;
          }
        }
      }
    }
    return false;
  }

  if (Array.isArray(payload)) {
    return payload.some((item) => containsPaymentData(item));
  }

  const obj = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
    if (FORBIDDEN_PAYMENT_KEYS.has(normalizedKey)) {
      return true;
    }
    if (containsPaymentData(value)) {
      return true;
    }
  }

  return false;
}

// In-memory cart store partitioned strictly by sessionId
const sessionCarts = new Map<string, CartState>();

function calculateTotals(items: CartItem[]): {
  subtotal: number;
  estimatedTax: number;
  total: number;
  itemCount: number;
} {
  const subtotal = Math.round(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
  ) / 100;
  const estimatedTax = Math.round(subtotal * 0.0825 * 100) / 100;
  const total = Math.round((subtotal + estimatedTax) * 100) / 100;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { subtotal, estimatedTax, total, itemCount };
}

/**
 * Retrieves the current cart state for a session, creating an empty one if not present.
 */
export function getCart(sessionId: string): CartState {
  let cart = sessionCarts.get(sessionId);
  if (!cart) {
    cart = {
      sessionId,
      version: 1,
      items: [],
      itemCount: 0,
      subtotal: 0,
      estimatedTax: 0,
      total: 0,
      currency: 'USD',
      updatedAt: Date.now(),
    };
    sessionCarts.set(sessionId, cart);
  }
  return { ...cart, items: [...cart.items] };
}

/**
 * Verifies version matches expected version for Optimistic Concurrency Control.
 */
function assertVersionMatch(cart: CartState, expectedVersion?: number): void {
  if (expectedVersion !== undefined && expectedVersion !== cart.version) {
    throw new Error(
      `Cart concurrency conflict: state has been modified by another action (expected version ${expectedVersion}, current version ${cart.version})`
    );
  }
}

/**
 * Adds an individual item to a session cart.
 */
export function addItemToCart(
  sessionId: string,
  itemInput: { sku: string; quantity: number; title?: string; price?: number; unit?: string },
  expectedVersion?: number
): CartState {
  const current = getCart(sessionId);
  assertVersionMatch(current, expectedVersion);

  const catalogItem = getCatalogItemBySku(itemInput.sku);
  const title = itemInput.title || catalogItem?.title || `Item ${itemInput.sku}`;
  const price = itemInput.price ?? catalogItem?.price ?? 0;
  const unit = itemInput.unit || catalogItem?.unit || 'each';

  const items = [...current.items];
  const existingIdx = items.findIndex((i) => i.sku === itemInput.sku && !i.bundleId);

  if (existingIdx >= 0) {
    items[existingIdx] = {
      ...items[existingIdx],
      quantity: items[existingIdx].quantity + itemInput.quantity,
    };
  } else {
    items.push({
      sku: itemInput.sku,
      title,
      price,
      quantity: itemInput.quantity,
      unit,
    });
  }

  const totals = calculateTotals(items);
  const updatedCart: CartState = {
    sessionId,
    version: current.version + 1,
    items,
    ...totals,
    currency: 'USD',
    updatedAt: Date.now(),
  };

  sessionCarts.set(sessionId, updatedCart);
  return updatedCart;
}

/**
 * Adds an entire recipe bundle to a session cart.
 */
export function addBundleToCart(
  sessionId: string,
  bundleId: string,
  bundleItems: Array<{ sku: string; quantity: number; title?: string; price?: number; unit?: string }>,
  expectedVersion?: number
): CartState {
  const current = getCart(sessionId);
  assertVersionMatch(current, expectedVersion);

  const items = [...current.items];

  for (const itemInput of bundleItems) {
    const catalogItem = getCatalogItemBySku(itemInput.sku);
    const title = itemInput.title || catalogItem?.title || `Item ${itemInput.sku}`;
    const price = itemInput.price ?? catalogItem?.price ?? 0;
    const unit = itemInput.unit || catalogItem?.unit || 'each';

    items.push({
      sku: itemInput.sku,
      title,
      price,
      quantity: itemInput.quantity,
      unit,
      bundleId,
    });
  }

  const totals = calculateTotals(items);
  const updatedCart: CartState = {
    sessionId,
    version: current.version + 1,
    items,
    ...totals,
    currency: 'USD',
    updatedAt: Date.now(),
  };

  sessionCarts.set(sessionId, updatedCart);
  return updatedCart;
}

/**
 * Removes an item from a session cart by SKU.
 */
export function removeItemFromCart(
  sessionId: string,
  sku: string,
  quantity?: number,
  expectedVersion?: number
): CartState {
  const current = getCart(sessionId);
  assertVersionMatch(current, expectedVersion);

  let items = [...current.items];
  const itemIdx = items.findIndex((i) => i.sku === sku);

  if (itemIdx >= 0) {
    if (quantity && quantity < items[itemIdx].quantity) {
      items[itemIdx] = {
        ...items[itemIdx],
        quantity: items[itemIdx].quantity - quantity,
      };
    } else {
      items = items.filter((_, idx) => idx !== itemIdx);
    }
  }

  const totals = calculateTotals(items);
  const updatedCart: CartState = {
    sessionId,
    version: current.version + 1,
    items,
    ...totals,
    currency: 'USD',
    updatedAt: Date.now(),
  };

  sessionCarts.set(sessionId, updatedCart);
  return updatedCart;
}

/**
 * Clears all items from a session cart.
 */
export function clearCart(sessionId: string, expectedVersion?: number): CartState {
  const current = getCart(sessionId);
  assertVersionMatch(current, expectedVersion);

  const updatedCart: CartState = {
    sessionId,
    version: current.version + 1,
    items: [],
    itemCount: 0,
    subtotal: 0,
    estimatedTax: 0,
    total: 0,
    currency: 'USD',
    updatedAt: Date.now(),
  };

  sessionCarts.set(sessionId, updatedCart);
  return updatedCart;
}

/**
 * Resets all in-memory carts across all sessions (for testing/purging).
 */
export function resetAllCarts(): void {
  sessionCarts.clear();
}

/**
 * Handler for manage_cart MCP tool.
 */
export async function manageCartHandler(
  rawParams: Record<string, unknown>,
  context: RequestContext = {}
): Promise<McpToolResult> {
  // SEC-001 Payment Isolation Guard
  if (containsPaymentData(rawParams)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Security violation: Payment card information (PAN/CVV) is strictly prohibited (SEC-001)',
        },
      ],
      isError: true,
    };
  }

  const parseResult = ManageCartInputSchema.safeParse(rawParams);
  if (!parseResult.success) {
    return {
      content: [
        {
          type: 'text',
          text: `Invalid parameters: ${parseResult.error.issues.map((i) => i.message).join('; ')}`,
        },
      ],
      isError: true,
    };
  }

  const { action, sessionId: paramSessionId, items, bundleId, sku, quantity, version } = parseResult.data;
  const sessionId = paramSessionId || context.sessionId;

  if (!sessionId) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: sessionId is required',
        },
      ],
      isError: true,
    };
  }

  try {
    let resultCart: CartState;

    switch (action) {
      case 'get_cart': {
        resultCart = getCart(sessionId);
        break;
      }

      case 'add_item': {
        const itemsToAdd = items || (sku ? [{ sku, quantity: quantity || 1 }] : []);
        if (itemsToAdd.length === 0) {
          return {
            content: [{ type: 'text', text: 'Error: No items provided to add_item' }],
            isError: true,
          };
        }
        let tempCart = getCart(sessionId);
        for (const item of itemsToAdd) {
          tempCart = addItemToCart(sessionId, item, version);
        }
        resultCart = tempCart;
        break;
      }

      case 'add_bundle': {
        const itemsToAdd = items || [];
        const targetBundleId = bundleId || `bnd-${Date.now()}`;
        resultCart = addBundleToCart(sessionId, targetBundleId, itemsToAdd, version);
        break;
      }

      case 'remove_item': {
        const targetSku = sku || (items && items[0]?.sku);
        if (!targetSku) {
          return {
            content: [{ type: 'text', text: 'Error: sku is required for remove_item' }],
            isError: true,
          };
        }
        resultCart = removeItemFromCart(sessionId, targetSku, quantity, version);
        break;
      }

      case 'clear': {
        resultCart = clearCart(sessionId, version);
        break;
      }

      default: {
        return {
          content: [{ type: 'text', text: `Unsupported action: "${action}"` }],
          isError: true,
        };
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(resultCart),
        },
      ],
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: 'text',
          text: errorMsg,
        },
      ],
      isError: true,
    };
  }
}

export const manageCartTool: McpToolRegistration = {
  name: 'manage_cart',
  description:
    'In-memory session-isolated shopping cart management supporting get, add, remove, and clear with 8.25% tax and OCC versioning.',
  inputSchema: MANAGE_CART_SCHEMA,
  handler: manageCartHandler,
};
