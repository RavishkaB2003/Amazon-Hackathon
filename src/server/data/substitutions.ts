/**
 * Deterministic Ingredient Substitutions
 * Maps items to allergen-free alternatives and budget-friendly substitutions.
 */

import { getCatalogItemBySku } from './catalog';
import type { CatalogItem } from '../../shared/types/tools';

export interface SubstitutionRule {
  targetSku: string;
  reason: 'allergen' | 'budget';
  allergen?: string;
  substituteSkus: string[];
  rationale: string;
}

export const SUBSTITUTION_RULES: SubstitutionRule[] = [
  // Allergen: Fish
  {
    targetSku: 'FRESH-SEAFOOD-01',
    reason: 'allergen',
    allergen: 'fish',
    substituteSkus: ['FRESH-POULTRY-01', 'FRESH-PLANT-01'],
    rationale: 'Substitute fish with organic chicken breast or organic firm tofu',
  },
  {
    targetSku: 'FRESH-SEAFOOD-02',
    reason: 'allergen',
    allergen: 'fish',
    substituteSkus: ['FRESH-POULTRY-01', 'FRESH-PLANT-01'],
    rationale: 'Substitute wild salmon with organic chicken breast or organic firm tofu',
  },

  // Allergen: Dairy
  {
    targetSku: 'FRESH-DAIRY-01',
    reason: 'allergen',
    allergen: 'dairy',
    substituteSkus: ['FRESH-DAIRY-02'],
    rationale: 'Substitute dairy Greek yogurt with dairy-free coconut milk yogurt',
  },
  {
    targetSku: 'FRESH-DAIRY-05',
    reason: 'allergen',
    allergen: 'dairy',
    substituteSkus: ['FRESH-PLANT-01'],
    rationale: 'Substitute dairy cheese with savory plant-based tofu alternative',
  },

  // Allergen: Gluten
  {
    targetSku: 'FRESH-GRAIN-03',
    reason: 'allergen',
    allergen: 'gluten',
    substituteSkus: ['FRESH-GRAIN-04', 'FRESH-GRAIN-02'],
    rationale: 'Substitute wheat noodles with gluten-free brown rice noodles or jasmine rice',
  },
  {
    targetSku: 'FRESH-PANTRY-03',
    reason: 'allergen',
    allergen: 'gluten',
    substituteSkus: ['FRESH-PANTRY-04'],
    rationale: 'Substitute regular soy sauce with gluten-free coconut aminos',
  },
  {
    targetSku: 'FRESH-BAKERY-01',
    reason: 'allergen',
    allergen: 'gluten',
    substituteSkus: ['FRESH-BAKERY-02'],
    rationale: 'Substitute sourdough bread with gluten-free 7-grain bread',
  },

  // Allergen: Soy
  {
    targetSku: 'FRESH-PANTRY-03',
    reason: 'allergen',
    allergen: 'soy',
    substituteSkus: ['FRESH-PANTRY-04'],
    rationale: 'Substitute soy sauce with soy-free organic coconut aminos',
  },
  {
    targetSku: 'FRESH-PLANT-01',
    reason: 'allergen',
    allergen: 'soy',
    substituteSkus: ['FRESH-PANTRY-05', 'FRESH-POULTRY-01'],
    rationale: 'Substitute soy tofu with organic chickpeas or chicken breast',
  },

  // Allergen: Nuts
  {
    targetSku: 'FRESH-DAIRY-03',
    reason: 'allergen',
    allergen: 'nuts',
    substituteSkus: ['FRESH-DAIRY-04'],
    rationale: 'Substitute almond milk with nut-free barista oat milk',
  },

  // Allergen: Eggs
  {
    targetSku: 'FRESH-DAIRY-06',
    reason: 'allergen',
    allergen: 'eggs',
    substituteSkus: ['FRESH-PLANT-01'],
    rationale: 'Substitute eggs with organic firm tofu for scramble',
  },

  // Budget substitutions (Ordered by priority/savings)
  {
    targetSku: 'FRESH-SEAFOOD-02', // $16.99
    reason: 'budget',
    substituteSkus: ['FRESH-SEAFOOD-01', 'FRESH-POULTRY-01'], // $11.99 or $7.99
    rationale: 'Substitute premium wild salmon with fresh Atlantic salmon or organic chicken',
  },
  {
    targetSku: 'FRESH-SEAFOOD-01', // $11.99
    reason: 'budget',
    substituteSkus: ['FRESH-POULTRY-01', 'FRESH-PLANT-01'], // $7.99 or $2.49
    rationale: 'Substitute Atlantic salmon with organic chicken breast or plant-based tofu',
  },
  {
    targetSku: 'FRESH-POULTRY-01', // $7.99
    reason: 'budget',
    substituteSkus: ['FRESH-POULTRY-02', 'FRESH-PLANT-01'], // $4.99 or $2.49
    rationale: 'Substitute organic chicken breast with chicken thighs or organic firm tofu',
  },
  {
    targetSku: 'FRESH-MEAT-01', // $8.49
    reason: 'budget',
    substituteSkus: ['FRESH-MEAT-02', 'FRESH-PLANT-01'], // $5.99 or $2.49
    rationale: 'Substitute grass-fed beef with lean ground turkey or organic firm tofu',
  },
  {
    targetSku: 'FRESH-PRODUCE-03', // $4.49
    reason: 'budget',
    substituteSkus: ['FRESH-PRODUCE-02'], // $1.99
    rationale: 'Substitute organic heirloom tomatoes with standard Roma tomatoes',
  },
  {
    targetSku: 'FRESH-GRAIN-01', // $3.99
    reason: 'budget',
    substituteSkus: ['FRESH-GRAIN-02'], // $2.49
    rationale: 'Substitute tricolor quinoa with jasmine rice',
  },
];

/**
 * Finds an allergen-safe replacement for a given item SKU.
 */
export function findAllergenSubstitution(
  sku: string,
  excludedAllergens: string[]
): CatalogItem | undefined {
  const excludedLower = excludedAllergens.map((a) => a.toLowerCase());
  const currentItem = getCatalogItemBySku(sku);

  // If current item already doesn't have any excluded allergens, keep it
  if (
    currentItem &&
    !currentItem.allergenFlags.some((a) => excludedLower.includes(a.toLowerCase()))
  ) {
    return currentItem;
  }

  // Look up explicit substitution rules
  const matchingRules = SUBSTITUTION_RULES.filter(
    (r) => r.targetSku === sku && r.reason === 'allergen'
  );

  for (const rule of matchingRules) {
    for (const subSku of rule.substituteSkus) {
      const candidate = getCatalogItemBySku(subSku);
      if (
        candidate &&
        candidate.inStock &&
        !candidate.allergenFlags.some((a) => excludedLower.includes(a.toLowerCase()))
      ) {
        return candidate;
      }
    }
  }

  // Fallback: check item substitutions property
  if (currentItem?.substitutions) {
    for (const subSku of currentItem.substitutions) {
      const candidate = getCatalogItemBySku(subSku);
      if (
        candidate &&
        candidate.inStock &&
        !candidate.allergenFlags.some((a) => excludedLower.includes(a.toLowerCase()))
      ) {
        return candidate;
      }
    }
  }

  return undefined;
}

/**
 * Finds a cheaper substitution for a given item SKU that does not violate excluded allergens.
 */
export function findBudgetSubstitution(
  sku: string,
  excludedAllergens: string[] = []
): CatalogItem | undefined {
  const excludedLower = excludedAllergens.map((a) => a.toLowerCase());
  const currentItem = getCatalogItemBySku(sku);
  if (!currentItem) return undefined;

  // Check explicit budget rules
  const matchingRules = SUBSTITUTION_RULES.filter(
    (r) => r.targetSku === sku && r.reason === 'budget'
  );

  for (const rule of matchingRules) {
    for (const subSku of rule.substituteSkus) {
      const candidate = getCatalogItemBySku(subSku);
      if (
        candidate &&
        candidate.inStock &&
        candidate.price < currentItem.price &&
        !candidate.allergenFlags.some((a) => excludedLower.includes(a.toLowerCase()))
      ) {
        return candidate;
      }
    }
  }

  // Fallback: check item substitutions property
  if (currentItem.substitutions) {
    for (const subSku of currentItem.substitutions) {
      const candidate = getCatalogItemBySku(subSku);
      if (
        candidate &&
        candidate.inStock &&
        candidate.price < currentItem.price &&
        !candidate.allergenFlags.some((a) => excludedLower.includes(a.toLowerCase()))
      ) {
        return candidate;
      }
    }
  }

  return undefined;
}
