/**
 * Core MCP Tools Registration & Export Bundle
 * Registers all 4 domain tools: smart_search_catalog, build_curated_bundle,
 * render_multimodal_widget, and manage_cart.
 */

import { registerTool } from '../registry';
import { smartSearchCatalogTool } from './search-catalog';
import { buildCuratedBundleTool } from './curated-bundle';
import { renderMultimodalWidgetTool } from './render-widget';
import { manageCartTool } from './manage-cart';

// Re-export individual tools
export {
  smartSearchCatalogTool,
  buildCuratedBundleTool,
  renderMultimodalWidgetTool,
  manageCartTool,
};

// Re-export catalog & recipe queries
export { getCatalogItems, getCatalogItemBySku } from '../../data/catalog';
export { getRecipes, getRecipeById } from '../../data/recipes';
export { findAllergenSubstitution, findBudgetSubstitution } from '../../data/substitutions';

// Re-export cart management functions
export {
  getCart,
  addItemToCart,
  addBundleToCart,
  removeItemFromCart,
  clearCart,
  resetAllCarts,
  containsPaymentData,
} from './manage-cart';

/**
 * Registers all 4 core MCP tools into the central tool registry.
 */
export function registerCoreTools(): void {
  registerTool(smartSearchCatalogTool);
  registerTool(buildCuratedBundleTool);
  registerTool(renderMultimodalWidgetTool);
  registerTool(manageCartTool);
}
