/**
 * Curated Recipe Database for Aura+
 * Comprehensive recipe data with ingredient SKUs, nutritional macros,
 * cooking steps, and dietary/allergen metadata.
 */

import type { Recipe } from '../../shared/types/tools';

export const CURATED_RECIPES: Recipe[] = [
  {
    id: 'rec-mediterranean-salmon',
    title: 'Mediterranean Salmon Bowl',
    description: 'Pan-seared salmon over fluffy tricolor quinoa with crisp cucumber and tomatoes.',
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    imageUrl: '/assets/recipes/salmon-bowl.jpg',
    dietaryTags: ['high-protein', 'gluten-free', 'keto'],
    allergenFlags: ['fish'],
    nutritionPerServing: {
      calories: 520,
      proteinG: 42,
      carbsG: 38,
      fatG: 22,
    },
    ingredients: [
      {
        sku: 'FRESH-SALMON-02',
        name: 'Wild Sockeye Salmon Fillet',
        quantity: 1,
        unit: '1 lb',
        substituteSkus: ['FRESH-SALMON-01', 'FRESH-POULTRY-01', 'FRESH-PLANT-01'],
      },
      {
        sku: 'FRESH-QUINOA-01',
        name: 'Organic Tricolor Quinoa',
        quantity: 1,
        unit: '16 oz',
        substituteSkus: ['FRESH-GRAIN-02'],
      },
      {
        sku: 'FRESH-CUCUMBER-01',
        name: 'English Cucumber',
        quantity: 1,
        unit: '1 each',
      },
      {
        sku: 'FRESH-TOMATO-01',
        name: 'Roma Tomatoes (1 lb)',
        quantity: 1,
        unit: '1 lb',
      },
      {
        sku: 'FRESH-OLIVEOIL-01',
        name: 'Extra Virgin Olive Oil (500ml)',
        quantity: 1,
        unit: '500 ml',
      },
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Rinse tricolor quinoa and combine with 2 cups of water in a saucepan. Bring to a boil, then simmer covered for 15 minutes.',
        timerSeconds: 900,
        tip: 'Fluff with a fork and let rest covered for 5 minutes after cooking for lighter texture.',
      },
      {
        stepNumber: 2,
        instruction: 'Dice the cucumber and Roma tomatoes into bite-sized cubes. Toss with 1 tbsp olive oil, salt, and freshly cracked black pepper.',
        timerSeconds: 180,
      },
      {
        stepNumber: 3,
        instruction: 'Heat remaining olive oil in a non-stick skillet over medium-high heat. Season salmon fillet with sea salt and black pepper.',
        timerSeconds: 120,
      },
      {
        stepNumber: 4,
        instruction: 'Sear salmon skin-side down for 4-5 minutes, flip, and sear for another 3-4 minutes until cooked through and opaque.',
        timerSeconds: 480,
        tip: 'Press gently on the fillet with a spatula during the first 30 seconds to ensure crispy skin.',
      },
      {
        stepNumber: 5,
        instruction: 'Assemble bowls: spoon cooked quinoa into base, top with sliced seared salmon, cucumber-tomato salad, and drizzle with olive oil.',
        timerSeconds: 120,
      },
    ],
  },
  {
    id: 'rec-sesame-chicken',
    title: '15-Minute Sesame Chicken Noodles',
    description: 'Savory stir-fried chicken breast with crisp broccoli, red peppers, and savory noodles in sesame sauce.',
    servings: 2,
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    imageUrl: '/assets/recipes/sesame-chicken.jpg',
    dietaryTags: ['high-protein'],
    allergenFlags: ['gluten', 'soy'],
    nutritionPerServing: {
      calories: 480,
      proteinG: 38,
      carbsG: 52,
      fatG: 14,
    },
    ingredients: [
      {
        sku: 'FRESH-POULTRY-01',
        name: 'Organic Boneless Skinless Chicken Breast',
        quantity: 1,
        unit: '1 lb',
        substituteSkus: ['FRESH-POULTRY-02', 'FRESH-PLANT-01'],
      },
      {
        sku: 'FRESH-GRAIN-03',
        name: 'Asian Lo Mein Noodles',
        quantity: 1,
        unit: '16 oz',
        substituteSkus: ['FRESH-GRAIN-04', 'FRESH-GRAIN-02'],
      },
      {
        sku: 'FRESH-PRODUCE-11',
        name: 'Fresh Broccoli Crowns',
        quantity: 1,
        unit: '1 lb',
      },
      {
        sku: 'FRESH-PRODUCE-06',
        name: 'Red Bell Pepper',
        quantity: 1,
        unit: '1 each',
      },
      {
        sku: 'FRESH-PANTRY-02',
        name: 'Toasted Sesame Oil',
        quantity: 1,
        unit: '8 oz',
      },
      {
        sku: 'FRESH-PANTRY-03',
        name: 'Low-Sodium Soy Sauce',
        quantity: 1,
        unit: '15 oz',
        substituteSkus: ['FRESH-PANTRY-04'],
      },
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Bring a pot of water to a boil. Add noodles and cook for 4 minutes until al dente. Drain and rinse with cool water.',
        timerSeconds: 240,
      },
      {
        stepNumber: 2,
        instruction: 'Thinly slice chicken breast into bite-sized strips. Cut broccoli into small florets and slice bell pepper into thin strips.',
        timerSeconds: 180,
      },
      {
        stepNumber: 3,
        instruction: 'Heat 1 tbsp sesame oil in a large wok or skillet over high heat. Add sliced chicken and stir-fry for 4 minutes until golden.',
        timerSeconds: 240,
      },
      {
        stepNumber: 4,
        instruction: 'Add broccoli florets and bell pepper strips. Stir-fry for 3 minutes until tender-crisp.',
        timerSeconds: 180,
      },
      {
        stepNumber: 5,
        instruction: 'Toss noodles into the wok with soy sauce and remaining sesame oil. Toss vigorously over heat for 1 minute to coat thoroughly.',
        timerSeconds: 60,
      },
    ],
  },
  {
    id: 'rec-vegetarian-grain',
    title: 'High-Protein Vegetarian Grain Bowl',
    description: 'Nutrient-packed warm bowl with organic tricolor quinoa, chickpeas, baby spinach, avocado, and Greek yogurt.',
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    imageUrl: '/assets/recipes/vegetarian-grain-bowl.jpg',
    dietaryTags: ['vegetarian', 'high-protein', 'gluten-free'],
    allergenFlags: ['dairy'],
    nutritionPerServing: {
      calories: 490,
      proteinG: 22,
      carbsG: 64,
      fatG: 18,
    },
    ingredients: [
      {
        sku: 'FRESH-QUINOA-01',
        name: 'Organic Tricolor Quinoa',
        quantity: 1,
        unit: '16 oz',
        substituteSkus: ['FRESH-GRAIN-02'],
      },
      {
        sku: 'FRESH-PANTRY-05',
        name: 'Organic Canned Chickpeas',
        quantity: 1,
        unit: '15 oz can',
      },
      {
        sku: 'FRESH-PRODUCE-04',
        name: 'Organic Baby Spinach',
        quantity: 1,
        unit: '5 oz container',
      },
      {
        sku: 'FRESH-PRODUCE-05',
        name: 'Hass Avocados (4-pack)',
        quantity: 1,
        unit: '4 pack',
      },
      {
        sku: 'FRESH-DAIRY-01',
        name: 'Organic Whole Milk Greek Yogurt',
        quantity: 1,
        unit: '32 oz',
        substituteSkus: ['FRESH-DAIRY-02'],
      },
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Simmer quinoa in 2 cups water for 15 minutes until tender. Fluff with fork.',
        timerSeconds: 900,
      },
      {
        stepNumber: 2,
        instruction: 'Rinse and drain chickpeas. Toss with sea salt, pepper, and olive oil, then lightly warm in a skillet.',
        timerSeconds: 300,
      },
      {
        stepNumber: 3,
        instruction: 'Layer warm quinoa and fresh baby spinach in deep serving bowls so spinach slightly wilts.',
        timerSeconds: 60,
      },
      {
        stepNumber: 4,
        instruction: 'Top with seasoned chickpeas, sliced Hass avocado, and a dollop of creamy Greek yogurt.',
        timerSeconds: 120,
      },
    ],
  },
  {
    id: 'rec-keto-scramble',
    title: 'Low-GI Keto Breakfast Scramble',
    description: 'Fluffy farm eggs scrambled with fresh baby spinach, melted cheddar, and creamy avocado.',
    servings: 2,
    prepTimeMinutes: 5,
    cookTimeMinutes: 5,
    imageUrl: '/assets/recipes/keto-scramble.jpg',
    dietaryTags: ['vegetarian', 'keto', 'gluten-free', 'high-protein'],
    allergenFlags: ['eggs', 'dairy'],
    nutritionPerServing: {
      calories: 380,
      proteinG: 21,
      carbsG: 6,
      fatG: 31,
    },
    ingredients: [
      {
        sku: 'FRESH-DAIRY-06',
        name: 'Large Grade A Brown Eggs (Dozen)',
        quantity: 1,
        unit: '12 count',
        substituteSkus: ['FRESH-PLANT-01'],
      },
      {
        sku: 'FRESH-DAIRY-05',
        name: 'Sharp Cheddar Cheese Block',
        quantity: 1,
        unit: '8 oz',
        substituteSkus: ['FRESH-PLANT-01'],
      },
      {
        sku: 'FRESH-PRODUCE-04',
        name: 'Organic Baby Spinach',
        quantity: 1,
        unit: '5 oz container',
      },
      {
        sku: 'FRESH-PRODUCE-05',
        name: 'Hass Avocados (4-pack)',
        quantity: 1,
        unit: '4 pack',
      },
    ],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Whisk 4 eggs in a bowl with a pinch of sea salt and pepper.',
        timerSeconds: 60,
      },
      {
        stepNumber: 2,
        instruction: 'Melt a dab of olive oil or butter in a skillet over medium-low heat. Add spinach and cook 1 minute until wilted.',
        timerSeconds: 60,
      },
      {
        stepNumber: 3,
        instruction: 'Pour in eggs. Stir gently with a silicone spatula to form soft, creamy curds. Fold in shredded cheddar.',
        timerSeconds: 120,
      },
      {
        stepNumber: 4,
        instruction: 'Plate immediately alongside freshly sliced avocado.',
        timerSeconds: 60,
      },
    ],
  },
];

const recipeMap = new Map<string, Recipe>(
  CURATED_RECIPES.map((recipe) => [recipe.id, recipe])
);

/**
 * Returns all curated recipes.
 */
export function getRecipes(): Recipe[] {
  return [...CURATED_RECIPES];
}

/**
 * Retrieves a curated recipe by ID.
 */
export function getRecipeById(id: string): Recipe | undefined {
  return recipeMap.get(id);
}
