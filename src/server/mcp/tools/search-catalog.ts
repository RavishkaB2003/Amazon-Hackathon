/**
 * Tool: smart_search_catalog
 * FR-005: Contextual Amazon Fresh catalog search with price gating,
 * allergen exclusion, and dietary tag filtering.
 */

import type { McpToolRegistration, McpToolResult, RequestContext } from '../../../shared/types/mcp';
import { getCatalogItems } from '../../data/catalog';
import { SmartSearchCatalogInputSchema, type SmartSearchCatalogInput } from '../../../shared/types/tools';

export const SMART_SEARCH_CATALOG_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Free-text search query matching against title, brand, description, and category',
    },
    maxPrice: {
      type: 'number',
      minimum: 0,
      description: 'Maximum item price in USD ceiling',
    },
    excludedAllergens: {
      type: 'array',
      description: 'Array of allergens to strictly exclude (e.g. dairy, gluten, nuts, soy, fish, shellfish, eggs)',
    },
    dietaryTags: {
      type: 'array',
      description: 'Array of dietary tags required on the items (e.g. vegan, vegetarian, gluten-free, keto, high-protein, organic)',
    },
    category: {
      type: 'string',
      description: 'Filter by grocery category (produce, meat_seafood, dairy_alt, grains_pantry, bakery, beverages)',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      description: 'Maximum number of items to return (default: 10)',
    },
  },
};

export async function smartSearchCatalogHandler(
  rawParams: Record<string, unknown>,
  _context: RequestContext = {}
): Promise<McpToolResult> {
  const parseResult = SmartSearchCatalogInputSchema.safeParse(rawParams);
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

  const { query, maxPrice, excludedAllergens, dietaryTags, category, limit = 10 } = parseResult.data;

  let items = getCatalogItems();

  // 1. Category filter
  if (category && category.trim()) {
    const catLower = category.toLowerCase().trim();
    items = items.filter((item) => item.category.toLowerCase() === catLower);
  }

  // 2. Maximum price filter
  if (typeof maxPrice === 'number') {
    items = items.filter((item) => item.price <= maxPrice);
  }

  // 3. Excluded allergens filter (case-insensitive)
  if (Array.isArray(excludedAllergens) && excludedAllergens.length > 0) {
    const excluded = excludedAllergens.map((a) => a.toLowerCase().trim());
    items = items.filter(
      (item) => !item.allergenFlags.some((flag) => excluded.includes(flag.toLowerCase()))
    );
  }

  // 4. Required dietary tags filter (must match all specified tags)
  if (Array.isArray(dietaryTags) && dietaryTags.length > 0) {
    const required = dietaryTags.map((tag) => tag.toLowerCase().trim());
    items = items.filter((item) => {
      const itemTags = item.dietaryTags.map((t) => t.toLowerCase());
      return required.every((req) => itemTags.includes(req));
    });
  }

  // 5. Query token matching across title, brand, description, and category
  if (query && query.trim()) {
    const tokens = query
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    items = items.filter((item) => {
      const titleLower = item.title.toLowerCase();
      const brandLower = item.brand.toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      const catLower = item.category.toLowerCase();

      // Item must match all query tokens in at least one field
      return tokens.every(
        (token) =>
          titleLower.includes(token) ||
          brandLower.includes(token) ||
          descLower.includes(token) ||
          catLower.includes(token)
      );
    });
  }

  // 6. Limit slice
  const results = items.slice(0, Math.min(Math.max(limit, 1), 50));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(results),
      },
    ],
  };
}

export const smartSearchCatalogTool: McpToolRegistration = {
  name: 'smart_search_catalog',
  description:
    'Search and filter the Amazon Fresh grocery catalog by semantic query, price ceiling, excluded allergens, dietary tags, and category.',
  inputSchema: SMART_SEARCH_CATALOG_SCHEMA,
  handler: smartSearchCatalogHandler,
};
