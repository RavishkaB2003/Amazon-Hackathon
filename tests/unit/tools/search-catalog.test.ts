import { describe, it, expect } from 'vitest';
import { smartSearchCatalogHandler } from '../../../src/server/mcp/tools/search-catalog';
import { getCatalogItems, getCatalogItemBySku } from '../../../src/server/data/catalog';
import type { CatalogItem } from '../../../src/shared/types/tools';

describe('Tool: smart_search_catalog (Unit)', () => {
  it('loads catalog dataset with at least 30 grocery items', () => {
    const items = getCatalogItems();
    expect(items.length).toBeGreaterThanOrEqual(30);

    // Verify entity constraints for catalog items
    for (const item of items) {
      expect(item.sku).toMatch(/^FRESH-[A-Z0-9]+-[0-9]{2}$/);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.title.length).toBeLessThanOrEqual(100);
      expect(item.price).toBeGreaterThan(0);
      expect(item.unit.length).toBeGreaterThan(0);
      expect(typeof item.inStock).toBe('boolean');
      expect(Array.isArray(item.allergenFlags)).toBe(true);
      expect(Array.isArray(item.dietaryTags)).toBe(true);
      expect(item.nutrition.calories).toBeGreaterThanOrEqual(0);
      expect(item.nutrition.proteinG).toBeGreaterThanOrEqual(0);
      expect(item.nutrition.carbsG).toBeGreaterThanOrEqual(0);
      expect(item.nutrition.fatG).toBeGreaterThanOrEqual(0);
    }
  });

  it('retrieves specific item by SKU and alias', () => {
    const salmon = getCatalogItemBySku('FRESH-SEAFOOD-01');
    expect(salmon).toBeDefined();
    expect(salmon?.title).toContain('Atlantic Salmon');

    // Test alias resolution
    const salmonAlias = getCatalogItemBySku('FRESH-SALMON-01');
    expect(salmonAlias).toBeDefined();
    expect(salmonAlias?.title).toContain('Atlantic Salmon');

    const nonExistent = getCatalogItemBySku('FRESH-FAKE-999');
    expect(nonExistent).toBeUndefined();
  });

  it('searches by keyword across title, brand, and description', async () => {
    const res = await smartSearchCatalogHandler({ query: 'salmon' });
    expect(res.isError).toBeFalsy();
    const items: CatalogItem[] = JSON.parse(res.content[0].text || '[]');
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      const match =
        item.title.toLowerCase().includes('salmon') ||
        (item.description && item.description.toLowerCase().includes('salmon'));
      expect(match).toBe(true);
    }
  });

  it('filters by category accurately', async () => {
    const res = await smartSearchCatalogHandler({ category: 'produce' });
    expect(res.isError).toBeFalsy();
    const items: CatalogItem[] = JSON.parse(res.content[0].text || '[]');
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const item of items) {
      expect(item.category).toBe('produce');
    }
  });

  it('enforces maxPrice ceiling filter', async () => {
    const maxPrice = 3.0;
    const res = await smartSearchCatalogHandler({ maxPrice });
    expect(res.isError).toBeFalsy();
    const items: CatalogItem[] = JSON.parse(res.content[0].text || '[]');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.price).toBeLessThanOrEqual(maxPrice);
    }
  });

  it('strictly excludes items containing specified allergens', async () => {
    const res = await smartSearchCatalogHandler({
      excludedAllergens: ['dairy', 'gluten'],
    });
    expect(res.isError).toBeFalsy();
    const items: CatalogItem[] = JSON.parse(res.content[0].text || '[]');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.allergenFlags).not.toContain('dairy');
      expect(item.allergenFlags).not.toContain('gluten');
    }
  });

  it('requires all specified dietary tags (AND semantics)', async () => {
    const res = await smartSearchCatalogHandler({
      dietaryTags: ['high-protein', 'gluten-free'],
    });
    expect(res.isError).toBeFalsy();
    const items: CatalogItem[] = JSON.parse(res.content[0].text || '[]');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.dietaryTags).toContain('high-protein');
      expect(item.dietaryTags).toContain('gluten-free');
    }
  });

  it('honors custom limit parameter', async () => {
    const limit = 4;
    const res = await smartSearchCatalogHandler({ limit });
    expect(res.isError).toBeFalsy();
    const items: CatalogItem[] = JSON.parse(res.content[0].text || '[]');
    expect(items.length).toBe(limit);
  });

  it('returns empty list when zero items match constraints', async () => {
    const res = await smartSearchCatalogHandler({
      query: 'nonexistent-extraterrestrial-fruit-999',
    });
    expect(res.isError).toBeFalsy();
    const items: CatalogItem[] = JSON.parse(res.content[0].text || '[]');
    expect(items).toEqual([]);
  });

  it('handles invalid parameters gracefully returning isError true', async () => {
    const res = await smartSearchCatalogHandler({
      maxPrice: -10, // negative price invalid
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Invalid parameters');
  });
});
