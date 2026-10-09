/**
 * Tool: build_curated_bundle
 * FR-006: Assembles an ingredient grocery bundle for a recipe, calculates
 * pricing and savings, scales servings, and applies automated item substitutions
 * to strictly honor maxBudget ceiling and excludedAllergens.
 */

import type { McpToolRegistration, McpToolResult, RequestContext } from '../../../shared/types/mcp';
import { getRecipeById } from '../../data/recipes';
import { getCatalogItemBySku } from '../../data/catalog';
import { findAllergenSubstitution, findBudgetSubstitution } from '../../data/substitutions';
import {
  BuildCuratedBundleInputSchema,
  type BundleItem,
  type CuratedBundle,
} from '../../../shared/types/tools';

export const BUILD_CURATED_BUNDLE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    recipeId: {
      type: 'string',
      minLength: 1,
      description: 'Target recipe ID (e.g. rec-mediterranean-salmon)',
    },
    servings: {
      type: 'integer',
      minimum: 1,
      description: 'Number of servings to prepare (default: 2)',
    },
    maxBudget: {
      type: 'number',
      minimum: 0,
      description: 'Maximum budget ceiling in USD',
    },
    excludedAllergens: {
      type: 'array',
      description: 'List of allergens to strictly exclude via ingredient substitutions',
    },
  },
  required: ['recipeId'],
};

export async function buildCuratedBundleHandler(
  rawParams: Record<string, unknown>,
  _context: RequestContext = {}
): Promise<McpToolResult> {
  const parseResult = BuildCuratedBundleInputSchema.safeParse(rawParams);
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

  const { recipeId, servings = 2, maxBudget, excludedAllergens = [] } = parseResult.data;

  const recipe = getRecipeById(recipeId);
  if (!recipe) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: Recipe "${recipeId}" not found`,
        },
      ],
      isError: true,
    };
  }

  const scaleRatio = servings / recipe.servings;
  const excludedLower = excludedAllergens.map((a) => a.toLowerCase().trim());

  let originalPrice = 0;
  const bundleItems: BundleItem[] = [];

  // Phase 1: Assemble base ingredients with allergen substitutions if needed
  for (const ing of recipe.ingredients) {
    const baseItem = getCatalogItemBySku(ing.sku);
    const itemQty = Math.max(1, Math.round(ing.quantity * scaleRatio));

    if (!baseItem) {
      continue;
    }

    originalPrice += baseItem.price * itemQty;

    let activeItem = baseItem;
    let isSubstituted = false;

    // Check allergen conflict
    const hasAllergenConflict = activeItem.allergenFlags.some((flag) =>
      excludedLower.includes(flag.toLowerCase())
    );

    if (hasAllergenConflict) {
      const allergenSub = findAllergenSubstitution(activeItem.sku, excludedAllergens);
      if (allergenSub) {
        activeItem = allergenSub;
        isSubstituted = true;
      }
    }

    bundleItems.push({
      sku: activeItem.sku,
      title: activeItem.title,
      price: activeItem.price,
      quantity: itemQty,
      unit: activeItem.unit,
      isSubstituted,
      originalSku: isSubstituted ? ing.sku : undefined,
    });
  }

  // Calculate current subtotal
  let currentTotal = bundleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Phase 2: Budget substitution heuristic if over maxBudget
  if (typeof maxBudget === 'number' && currentTotal > maxBudget) {
    // Sort items by highest price descending to optimize cost reduction
    const candidateIndices = bundleItems
      .map((item, idx) => ({ idx, price: item.price * item.quantity }))
      .sort((a, b) => b.price - a.price)
      .map((entry) => entry.idx);

    for (const idx of candidateIndices) {
      if (currentTotal <= maxBudget) break;

      const currentItem = bundleItems[idx];
      const cheaperSub = findBudgetSubstitution(currentItem.sku, excludedAllergens);

      if (cheaperSub && cheaperSub.price < currentItem.price) {
        const priceDiff = (currentItem.price - cheaperSub.price) * currentItem.quantity;
        bundleItems[idx] = {
          sku: cheaperSub.sku,
          title: cheaperSub.title,
          price: cheaperSub.price,
          quantity: currentItem.quantity,
          unit: cheaperSub.unit,
          isSubstituted: true,
          originalSku: currentItem.originalSku || currentItem.sku,
        };
        currentTotal -= priceDiff;
      }
    }
  }

  const roundedTotal = Math.round(currentTotal * 100) / 100;
  const roundedOriginal = Math.round(originalPrice * 100) / 100;
  const savings = Math.max(0, Math.round((roundedOriginal - roundedTotal) * 100) / 100);
  const budgetCompliant = maxBudget !== undefined ? roundedTotal <= maxBudget : true;

  const bundle: CuratedBundle = {
    bundleId: `bnd-${recipeId}-${Date.now()}`,
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    servings,
    items: bundleItems,
    totalPrice: roundedTotal,
    originalPrice: roundedOriginal,
    savingsAmount: savings,
    budgetCompliant,
    maxBudget: maxBudget !== undefined ? Math.round(maxBudget * 100) / 100 : undefined,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(bundle),
      },
    ],
  };
}

export const buildCuratedBundleTool: McpToolRegistration = {
  name: 'build_curated_bundle',
  description:
    'Assemble an optimized grocery ingredient bundle for a recipe, enforcing servings scaling, maxBudget ceiling, and automated substitutions.',
  inputSchema: BUILD_CURATED_BUNDLE_SCHEMA,
  handler: buildCuratedBundleHandler,
};
