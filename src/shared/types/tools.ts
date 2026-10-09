/**
 * Aura+ MOD-02 Tool Registry & Catalog Type Definitions and Schemas
 * Type contracts for grocery catalog, curated recipes, multimodal widgets, and session carts.
 */

import { z } from 'zod';

// ==========================================
// 1. Catalog Types & Schemas
// ==========================================

export type CatalogCategory =
  | 'produce'
  | 'meat_seafood'
  | 'dairy_alt'
  | 'grains_pantry'
  | 'bakery'
  | 'beverages';

export interface NutritionInfo {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const NutritionInfoSchema = z.object({
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
});

export interface CatalogItem {
  sku: string;
  title: string;
  brand: string;
  category: CatalogCategory;
  price: number;
  unit: string;
  inStock: boolean;
  allergenFlags: string[];
  dietaryTags: string[];
  nutrition: NutritionInfo;
  description?: string;
  substitutions?: string[];
}

export const CatalogItemSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1).max(100),
  brand: z.string().min(1),
  category: z.enum(['produce', 'meat_seafood', 'dairy_alt', 'grains_pantry', 'bakery', 'beverages']),
  price: z.number().positive(),
  unit: z.string().min(1),
  inStock: z.boolean(),
  allergenFlags: z.array(z.string()),
  dietaryTags: z.array(z.string()),
  nutrition: NutritionInfoSchema,
  description: z.string().optional(),
  substitutions: z.array(z.string()).optional(),
});

// ==========================================
// 2. Recipe Types & Schemas
// ==========================================

export interface RecipeIngredient {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
  substituteSkus?: string[];
}

export const RecipeIngredientSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  optional: z.boolean().optional(),
  substituteSkus: z.array(z.string()).optional(),
});

export interface CookingStep {
  stepNumber: number;
  instruction: string;
  timerSeconds?: number;
  tip?: string;
}

export const CookingStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string().min(1),
  timerSeconds: z.number().int().nonnegative().optional(),
  tip: z.string().optional(),
});

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  imageUrl?: string;
  ingredients: RecipeIngredient[];
  steps: CookingStep[];
  nutritionPerServing: NutritionInfo;
  dietaryTags?: string[];
  allergenFlags?: string[];
}

export const RecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  servings: z.number().int().positive(),
  prepTimeMinutes: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().nonnegative(),
  imageUrl: z.string().optional(),
  ingredients: z.array(RecipeIngredientSchema),
  steps: z.array(CookingStepSchema),
  nutritionPerServing: NutritionInfoSchema,
  dietaryTags: z.array(z.string()).optional(),
  allergenFlags: z.array(z.string()).optional(),
});

// ==========================================
// 3. Curated Bundle Types & Schemas
// ==========================================

export interface BundleItem {
  sku: string;
  title: string;
  price: number;
  quantity: number;
  unit?: string;
  isSubstituted?: boolean;
  originalSku?: string;
}

export const BundleItemSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  unit: z.string().optional(),
  isSubstituted: z.boolean().optional(),
  originalSku: z.string().optional(),
});

export interface CuratedBundle {
  bundleId: string;
  recipeId: string;
  recipeTitle: string;
  servings: number;
  items: BundleItem[];
  totalPrice: number;
  originalPrice: number;
  savingsAmount: number;
  budgetCompliant: boolean;
  maxBudget?: number;
}

export const CuratedBundleSchema = z.object({
  bundleId: z.string().min(1),
  recipeId: z.string().min(1),
  recipeTitle: z.string().min(1),
  servings: z.number().int().positive(),
  items: z.array(BundleItemSchema),
  totalPrice: z.number().nonnegative(),
  originalPrice: z.number().nonnegative(),
  savingsAmount: z.number().nonnegative(),
  budgetCompliant: z.boolean(),
  maxBudget: z.number().positive().optional(),
});

// ==========================================
// 4. Multimodal Widget Types & Schemas
// ==========================================

export type WidgetType = 'recipe_card' | 'product_carousel' | 'cooking_step';

export interface RecipeCardPayload {
  recipeId: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  macros: NutritionInfo;
  ingredients: Array<{ name: string; quantity: string }>;
  action?: { label: string; actionId: string };
}

export const RecipeCardPayloadSchema = z.object({
  recipeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().min(1),
  prepTimeMinutes: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().nonnegative(),
  servings: z.number().int().positive(),
  macros: NutritionInfoSchema,
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.string().min(1),
    })
  ),
  action: z
    .object({
      label: z.string().min(1),
      actionId: z.string().min(1),
    })
    .optional(),
});

export interface ProductCarouselItem {
  sku: string;
  title: string;
  price: number;
  imageUrl?: string;
  unit?: string;
  badge?: string;
}

export const ProductCarouselItemSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  imageUrl: z.string().optional(),
  unit: z.string().optional(),
  badge: z.string().optional(),
});

export interface ProductCarouselPayload {
  title: string;
  items: ProductCarouselItem[];
  totalPrice?: number;
  primaryAction?: { label: string; actionId: string };
}

export const ProductCarouselPayloadSchema = z.object({
  title: z.string().min(1),
  items: z.array(ProductCarouselItemSchema),
  totalPrice: z.number().nonnegative().optional(),
  primaryAction: z
    .object({
      label: z.string().min(1),
      actionId: z.string().min(1),
    })
    .optional(),
});

export interface CookingStepPayload {
  recipeId: string;
  stepNumber: number;
  totalSteps: number;
  instruction: string;
  timerSeconds?: number;
  tip?: string;
}

export const CookingStepPayloadSchema = z.object({
  recipeId: z.string().min(1),
  stepNumber: z.number().int().positive(),
  totalSteps: z.number().int().positive(),
  instruction: z.string().min(1),
  timerSeconds: z.number().int().nonnegative().optional(),
  tip: z.string().optional(),
});

export type MultimodalWidgetPayload =
  | RecipeCardPayload
  | ProductCarouselPayload
  | CookingStepPayload;

// ==========================================
// 5. Shopping Cart Types & Schemas
// ==========================================

export interface CartItem {
  sku: string;
  title: string;
  price: number;
  quantity: number;
  unit?: string;
  bundleId?: string;
}

export const CartItemSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  unit: z.string().optional(),
  bundleId: z.string().optional(),
});

export interface CartState {
  sessionId: string;
  version: number;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  estimatedTax: number;
  total: number;
  currency: 'USD';
  updatedAt: number;
}

export const CartStateSchema = z.object({
  sessionId: z.string().min(1),
  version: z.number().int().positive(),
  items: z.array(CartItemSchema),
  itemCount: z.number().int().nonnegative(),
  subtotal: z.number().nonnegative(),
  estimatedTax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: z.literal('USD'),
  updatedAt: z.number().nonnegative(),
});

export type ManageCartAction =
  | 'get_cart'
  | 'add_item'
  | 'add_bundle'
  | 'remove_item'
  | 'clear';

// ==========================================
// 6. Tool Input / Output Interfaces & Schemas
// ==========================================

export interface SmartSearchCatalogInput {
  query?: string;
  maxPrice?: number;
  excludedAllergens?: string[];
  dietaryTags?: string[];
  category?: string;
  limit?: number;
}

export const SmartSearchCatalogInputSchema = z.object({
  query: z.string().optional(),
  maxPrice: z.number().nonnegative().optional(),
  excludedAllergens: z.array(z.string()).optional(),
  dietaryTags: z.array(z.string()).optional(),
  category: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export interface BuildCuratedBundleInput {
  recipeId: string;
  servings?: number;
  maxBudget?: number;
  excludedAllergens?: string[];
}

export const BuildCuratedBundleInputSchema = z.object({
  recipeId: z.string().min(1),
  servings: z.number().int().positive().optional(),
  maxBudget: z.number().positive().optional(),
  excludedAllergens: z.array(z.string()).optional(),
});

export interface RenderMultimodalWidgetInput {
  widgetType: 'recipe_card' | 'product_carousel' | 'cooking_step';
  title: string;
  payload: Record<string, unknown>;
  sessionId?: string;
}

export const RenderMultimodalWidgetInputSchema = z.object({
  widgetType: z.enum(['recipe_card', 'product_carousel', 'cooking_step']),
  title: z.string().min(1),
  payload: z.record(z.unknown()),
  sessionId: z.string().optional(),
});

export interface ManageCartInput {
  action: ManageCartAction;
  sessionId: string;
  items?: Array<{
    sku: string;
    quantity: number;
    title?: string;
    price?: number;
    unit?: string;
  }>;
  bundleId?: string;
  sku?: string;
  quantity?: number;
  version?: number;
}

export const ManageCartInputSchema = z.object({
  action: z.enum(['get_cart', 'add_item', 'add_bundle', 'remove_item', 'clear']),
  sessionId: z.string().min(1),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        title: z.string().optional(),
        price: z.number().nonnegative().optional(),
        unit: z.string().optional(),
      })
    )
    .optional(),
  bundleId: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  version: z.number().int().positive().optional(),
});
