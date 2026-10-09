import { describe, it, expect } from 'vitest';
import { buildCuratedBundleHandler } from '../../../src/server/mcp/tools/curated-bundle';
import { getRecipes, getRecipeById } from '../../../src/server/data/recipes';
import type { CuratedBundle } from '../../../src/shared/types/tools';

describe('Tool: build_curated_bundle (Unit)', () => {
  it('loads curated recipes with valid ingredient specifications and steps', () => {
    const recipes = getRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(3);

    for (const recipe of recipes) {
      expect(recipe.id).toMatch(/^rec-[a-z0-9-]+$/);
      expect(recipe.title.length).toBeGreaterThan(0);
      expect(recipe.servings).toBeGreaterThanOrEqual(1);
      expect(recipe.prepTimeMinutes).toBeGreaterThanOrEqual(0);
      expect(recipe.cookTimeMinutes).toBeGreaterThanOrEqual(0);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(recipe.nutritionPerServing.calories).toBeGreaterThan(0);
    }
  });

  it('assembles base recipe bundle for Mediterranean Salmon Bowl', async () => {
    const res = await buildCuratedBundleHandler({
      recipeId: 'rec-mediterranean-salmon',
      servings: 2,
    });

    expect(res.isError).toBeFalsy();
    const bundle: CuratedBundle = JSON.parse(res.content[0].text || '{}');

    expect(bundle.recipeId).toBe('rec-mediterranean-salmon');
    expect(bundle.servings).toBe(2);
    expect(bundle.items.length).toBe(5);
    expect(bundle.totalPrice).toBeGreaterThan(0);
    expect(bundle.originalPrice).toBe(bundle.totalPrice);
    expect(bundle.savingsAmount).toBe(0);
    expect(bundle.budgetCompliant).toBe(true);
  });

  it('scales ingredient quantities when servings is increased', async () => {
    const resBase = await buildCuratedBundleHandler({
      recipeId: 'rec-mediterranean-salmon',
      servings: 2,
    });
    const bundleBase: CuratedBundle = JSON.parse(resBase.content[0].text || '{}');

    const resScaled = await buildCuratedBundleHandler({
      recipeId: 'rec-mediterranean-salmon',
      servings: 4,
    });
    const bundleScaled: CuratedBundle = JSON.parse(resScaled.content[0].text || '{}');

    expect(bundleScaled.servings).toBe(4);
    // Quantities should double
    for (let i = 0; i < bundleBase.items.length; i++) {
      expect(bundleScaled.items[i].quantity).toBe(bundleBase.items[i].quantity * 2);
    }
    expect(bundleScaled.totalPrice).toBeCloseTo(bundleBase.totalPrice * 2, 2);
  });

  it('applies budget substitutions to strictly honor maxBudget ceiling (FR-006)', async () => {
    // Base Mediterranean Salmon Bowl with Wild Sockeye is $28.45
    // Setting maxBudget = 25.00 forces substitution of Wild Salmon ($16.99) -> Atlantic Salmon ($11.99)
    // yielding $24.45 total and $4.00 savings
    const res = await buildCuratedBundleHandler({
      recipeId: 'rec-mediterranean-salmon',
      servings: 2,
      maxBudget: 25.0,
    });

    expect(res.isError).toBeFalsy();
    const bundle: CuratedBundle = JSON.parse(res.content[0].text || '{}');

    expect(bundle.budgetCompliant).toBe(true);
    expect(bundle.totalPrice).toBeLessThanOrEqual(25.0);
    expect(bundle.totalPrice).toBe(24.45);
    expect(bundle.originalPrice).toBe(28.45);
    expect(bundle.savingsAmount).toBe(4.0);

    // Verify substituted item exists
    const substitutedItem = bundle.items.find((item) => item.isSubstituted);
    expect(substitutedItem).toBeDefined();
    expect(['FRESH-SALMON-01', 'FRESH-SEAFOOD-01']).toContain(substitutedItem?.sku);
    expect(substitutedItem?.price).toBe(11.99);
  });

  it('executes allergen substitutions when excludedAllergens is passed', async () => {
    // Recipe contains salmon (fish allergen). Excluding 'fish' forces substitution.
    const res = await buildCuratedBundleHandler({
      recipeId: 'rec-mediterranean-salmon',
      servings: 2,
      excludedAllergens: ['fish'],
    });

    expect(res.isError).toBeFalsy();
    const bundle: CuratedBundle = JSON.parse(res.content[0].text || '{}');

    const substituted = bundle.items.find((i) => i.isSubstituted);
    expect(substituted).toBeDefined();
    // Replaced with chicken breast or tofu (non-fish)
    expect(['FRESH-POULTRY-01', 'FRESH-PLANT-01', 'FRESH-CHICKEN-01', 'FRESH-TOFU-01']).toContain(
      substituted?.sku
    );
  });

  it('handles vegetarian noodles gluten exclusion substitution', async () => {
    // rec-sesame-chicken contains wheat Lo Mein noodles and regular soy sauce
    const res = await buildCuratedBundleHandler({
      recipeId: 'rec-sesame-chicken',
      servings: 2,
      excludedAllergens: ['gluten'],
    });

    expect(res.isError).toBeFalsy();
    const bundle: CuratedBundle = JSON.parse(res.content[0].text || '{}');

    // Neither wheat noodles nor regular soy sauce should remain
    const wheatNoodles = bundle.items.find((i) => i.sku === 'FRESH-GRAIN-03');
    const soySauce = bundle.items.find((i) => i.sku === 'FRESH-PANTRY-03');
    expect(wheatNoodles).toBeUndefined();
    expect(soySauce).toBeUndefined();
  });

  it('returns error when recipeId is not found', async () => {
    const res = await buildCuratedBundleHandler({
      recipeId: 'rec-non-existent-recipe',
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Recipe "rec-non-existent-recipe" not found');
  });

  it('rejects invalid parameters with schema validation failure', async () => {
    const res = await buildCuratedBundleHandler({
      recipeId: 'rec-mediterranean-salmon',
      servings: 0, // must be positive >= 1
    });

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Invalid parameters');
  });
});
