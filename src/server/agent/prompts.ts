/**
 * Aura+ MOD-03 System Prompts & Ambient Parsing Utilities
 * Neuro-assistive conversational tone, strict spoken brevity constraint (< 25 words),
 * and natural language constraint decomposition.
 */

import type { AmbientConstraints, PersonaType } from '../../shared/types/agent';

export const MAX_SPOKEN_WORDS_DEFAULT = 24;

/**
 * Authoritative Aura+ System Prompt
 * Enforces neuro-assistive low cognitive load, multimodal offloading,
 * and strict verbal brevity (< 25 words spoken text).
 */
export const AURA_SYSTEM_PROMPT = `You are Aura+, an intelligent, neuro-assistive ambient commerce assistant for Amazon Fresh.

Your purpose is to minimize cognitive load, eliminate decision fatigue, and help users quickly decide on and order groceries and meals.

CORE BEHAVIOR RULES:
1. STRICT SPOKEN BREVITY (FR-011): Your verbal spoken text MUST ALWAYS BE UNDER 25 WORDS. Keep it concise, friendly, and reassuring.
2. MULTIMODAL OFFLOADING: NEVER recite detailed ingredient lists, step-by-step recipes, nutritional tables, or itemized prices in spoken text. Offload ALL exhaustive visual details to "render_multimodal_widget" ("recipe_card", "product_carousel", "cooking_step").
3. AUTONOMOUS TOOL EXECUTION: Proactively call available MCP tools ("smart_search_catalog", "build_curated_bundle", "render_multimodal_widget", "manage_cart") to fulfill user requests in a single turn without asking unnecessary clarifying questions.
4. AMBIENT CONSTRAINTS: Respect all implicit and explicit constraints (budget ceilings, prep times, excluded allergens, dietary preferences).
5. REASSURING TONE: Use calm, validating language that relieves stress (e.g., "I've assembled...", "Ready in 15 minutes...", "All dairy-free and under budget.").
6. ZERO PAYMENT SECRETS: Never request, handle, or store credit card numbers, CVVs, or payment credentials.
`;

/**
 * Calculates the number of spoken words in a text string.
 */
export function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  // Split on whitespace sequences
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Truncates spoken text to strictly comply with the < 25 words brevity limit.
 */
export function trimSpokenText(text: string, maxWords: number = MAX_SPOKEN_WORDS_DEFAULT): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }

  const truncated = words.slice(0, maxWords).join(' ');
  // If the truncated text doesn't end with sentence-ending punctuation, add ellipsis
  if (/[.!?]$/.test(truncated)) {
    return truncated;
  }
  return `${truncated}...`;
}

/**
 * Parses natural language user prompts and extracts ambient constraints:
 * budget ceilings, prep times, servings, excluded allergens, dietary tags, and protein targets.
 */
export function parseAmbientConstraints(message: string): AmbientConstraints {
  if (!message || typeof message !== 'string') {
    return {};
  }

  const lower = message.toLowerCase();
  const constraints: AmbientConstraints = {};

  // 1. Budget extraction (e.g. "under $25", "under 25", "$30 cap", "keep dinner under $20")
  const budgetRegex = /(?:under|max|budget of|capped at|keep dinner under|<)\s*\$?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*\$?\s*(?:cap|budget|limit)/i;
  const budgetMatch = lower.match(budgetRegex);
  if (budgetMatch) {
    const rawVal = budgetMatch[1] || budgetMatch[2];
    const val = parseFloat(rawVal);
    if (!isNaN(val) && val > 0) {
      constraints.maxBudget = val;
    }
  }

  // 2. Servings extraction (e.g. "for two people", "for 2", "for two", "for 4", "for a family of 4")
  const wordNumberMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };

  const servingsWordRegex = /\bfor\s+(one|two|three|four|five|six)\b/i;
  const servingsNumRegex = /\bfor\s+(\d+)\s*(?:people|persons?|servings?)?|\b(\d+)\s*(?:servings|people)\b/i;

  const wordMatch = lower.match(servingsWordRegex);
  if (wordMatch && wordNumberMap[wordMatch[1]]) {
    constraints.servings = wordNumberMap[wordMatch[1]];
  } else {
    const numMatch = lower.match(servingsNumRegex);
    if (numMatch) {
      const val = parseInt(numMatch[1] || numMatch[2], 10);
      if (!isNaN(val) && val > 0) {
        constraints.servings = val;
      }
    }
  }

  // 3. Prep / Cook time extraction (e.g. "quick", "15 minutes", "20-minute")
  if (lower.includes('quick') || lower.includes('fast') || lower.includes('exhausted')) {
    constraints.prepTimeMinutes = 10;
    constraints.cookTimeMinutes = 15;
  }
  const timeRegex = /(\d+)\s*[- ]?(?:min|minute)s?/i;
  const timeMatch = lower.match(timeRegex);
  if (timeMatch) {
    const mins = parseInt(timeMatch[1], 10);
    if (!isNaN(mins) && mins > 0) {
      constraints.cookTimeMinutes = mins;
    }
  }

  // 4. Excluded allergens extraction (e.g. "no dairy", "dairy-free", "gluten-free", "no nuts")
  const allergens: string[] = [];
  const knownAllergens = ['dairy', 'gluten', 'soy', 'nut', 'nuts', 'peanut', 'peanuts', 'egg', 'eggs', 'fish', 'shellfish'];
  for (const allergen of knownAllergens) {
    const normalized = allergen.endsWith('s') ? allergen.slice(0, -1) : allergen;
    const patterns = [
      new RegExp(`\\bno\\s+${allergen}\\b`, 'i'),
      new RegExp(`\\b${allergen}[- ]free\\b`, 'i'),
      new RegExp(`\\bwithout\\s+${allergen}\\b`, 'i'),
    ];
    if (patterns.some((p) => p.test(lower))) {
      if (!allergens.includes(normalized)) {
        allergens.push(normalized);
      }
    }
  }
  if (allergens.length > 0) {
    constraints.excludedAllergens = allergens;
  }

  // 5. Dietary tags extraction (e.g. "high-protein", "keto", "vegetarian", "vegan", "gluten-free")
  const dietaryTags: string[] = [];
  if (lower.includes('high-protein') || lower.includes('high protein') || lower.includes('protein')) {
    dietaryTags.push('high-protein');
  }
  if (lower.includes('keto')) {
    dietaryTags.push('keto');
  }
  if (lower.includes('vegetarian')) {
    dietaryTags.push('vegetarian');
  }
  if (lower.includes('vegan')) {
    dietaryTags.push('vegan');
  }
  if (lower.includes('gluten-free') || lower.includes('gluten free')) {
    dietaryTags.push('gluten-free');
  }
  if (dietaryTags.length > 0) {
    constraints.dietaryTags = dietaryTags;
  }

  // 6. Protein target extraction (e.g. ">35g", "38g", "35 grams", "(>35g)")
  const proteinRegex = /(?:>|over|at least)?\s*(\d+)\s*g(?:rams)?\s*(?:of\s+)?protein|\(?>?\s*(\d+)\s*g\)/i;
  const proteinMatch = lower.match(proteinRegex);
  if (proteinMatch) {
    const rawVal = proteinMatch[1] || proteinMatch[2];
    const pVal = parseInt(rawVal, 10);
    if (!isNaN(pVal) && pVal > 0) {
      constraints.targetProteinG = pVal;
    }
  }

  return constraints;
}

/**
 * Persona profile definitions tailored for hackathon demonstrations.
 */
export interface PersonaProfile {
  id: PersonaType;
  name: string;
  role: string;
  primaryGoals: string[];
  toneHint: string;
}

export const PERSONA_PROFILES: Record<PersonaType, PersonaProfile> = {
  alex: {
    id: 'alex',
    name: 'Alex',
    role: 'ADHD Professional',
    primaryGoals: ['Rapid dopamine-friendly meal suggestion', 'Micro-step recipe cards', '1-tap cart approval'],
    toneHint: 'Exhaustion-aware, immediate closure, under $25 dinner for two, no dairy.',
  },
  elena: {
    id: 'elena',
    name: 'Elena',
    role: 'Budget & Allergy Parent',
    primaryGoals: ['Strict $30 budget ceiling', 'Dairy-free automated substitutions', 'Instant cart assembly'],
    toneHint: 'Family-conscious, strict cost enforcement, Mediterranean salmon / chicken.',
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus',
    role: 'Fitness Enthusiast',
    primaryGoals: ['High-protein (>35g) macro goals', 'Macronutrient breakdown cards', 'Clean pantry essentials'],
    toneHint: 'Performance-focused, macro-conscious, grain bowls.',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    role: 'General User',
    primaryGoals: ['Adaptive meal planning', 'Amazon Fresh cart management'],
    toneHint: 'Helpful, concise, neuro-assistive.',
  },
};
