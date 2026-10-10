/**
 * Unit Test Suite for MOD-03 System Prompts & Ambient Parsing
 * CHK-MOD-03-BREVITY: Spoken brevity constraint (< 25 words),
 * ambient constraint parsing, and prompt templates.
 */

import { describe, it, expect } from 'vitest';
import {
  AURA_SYSTEM_PROMPT,
  countWords,
  trimSpokenText,
  parseAmbientConstraints,
  PERSONA_PROFILES,
  MAX_SPOKEN_WORDS_DEFAULT,
} from '../../../src/server/agent/prompts';

describe('Aura+ System Prompt & Tone Policy', () => {
  it('contains neuro-assistive tone and strict verbal brevity instructions', () => {
    expect(AURA_SYSTEM_PROMPT).toContain('STRICT SPOKEN BREVITY (FR-011)');
    expect(AURA_SYSTEM_PROMPT).toContain('UNDER 25 WORDS');
    expect(AURA_SYSTEM_PROMPT).toContain('MULTIMODAL OFFLOADING');
    expect(AURA_SYSTEM_PROMPT).toContain('render_multimodal_widget');
    expect(AURA_SYSTEM_PROMPT).toContain('ZERO PAYMENT SECRETS');
  });

  it('exposes well-defined persona profiles for hackathon scenarios', () => {
    expect(PERSONA_PROFILES.alex.name).toBe('Alex');
    expect(PERSONA_PROFILES.alex.role).toBe('ADHD Professional');
    expect(PERSONA_PROFILES.elena.name).toBe('Elena');
    expect(PERSONA_PROFILES.elena.role).toBe('Budget & Allergy Parent');
    expect(PERSONA_PROFILES.marcus.name).toBe('Marcus');
    expect(PERSONA_PROFILES.marcus.role).toBe('Fitness Enthusiast');
  });
});

describe('countWords Utility', () => {
  it('accurately counts words for empty or whitespace strings', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('\t\n  \n')).toBe(0);
  });

  it('accurately counts words for regular sentences', () => {
    expect(countWords('I have prepared a quick dinner.')).toBe(6);
    expect(countWords('Quick high-protein dinner under $25 for two people.')).toBe(8);
  });

  it('handles multiple consecutive spaces and formatting gracefully', () => {
    expect(countWords('  Hello   world!  This   is    Aura.  ')).toBe(5);
  });
});

describe('trimSpokenText Brevity Enforcement (FR-011)', () => {
  it('preserves text when within word count limit', () => {
    const text = "I've assembled a quick 15-minute Sesame Chicken dinner for under $25.";
    expect(countWords(text)).toBe(11);
    expect(trimSpokenText(text, 24)).toBe(text);
  });

  it('trims text that exceeds 24 words and appends ellipsis if needed', () => {
    const longText =
      'This is a very long conversational response that goes on and on and explains all the recipe steps and ingredient prices and prep instructions which clearly exceeds twenty-four words in verbal speech.';
    expect(countWords(longText)).toBeGreaterThan(24);

    const trimmed = trimSpokenText(longText, MAX_SPOKEN_WORDS_DEFAULT);
    expect(countWords(trimmed)).toBeLessThanOrEqual(MAX_SPOKEN_WORDS_DEFAULT);
    expect(trimmed.endsWith('...')).toBe(true);
  });
});

describe('parseAmbientConstraints Utility (FR-009)', () => {
  it('extracts budget ceilings from natural language', () => {
    expect(parseAmbientConstraints('quick dinner under $25').maxBudget).toBe(25);
    expect(parseAmbientConstraints('keep dinner under $20').maxBudget).toBe(20);
    expect(parseAmbientConstraints('Mediterranean salmon under $30').maxBudget).toBe(30);
    expect(parseAmbientConstraints('budget of $45 for groceries').maxBudget).toBe(45);
    expect(parseAmbientConstraints('dinner capped at $35').maxBudget).toBe(35);
  });

  it('extracts serving counts from words and numbers', () => {
    expect(parseAmbientConstraints('dinner for two people').servings).toBe(2);
    expect(parseAmbientConstraints('dinner for 2').servings).toBe(2);
    expect(parseAmbientConstraints('dinner for two').servings).toBe(2);
    expect(parseAmbientConstraints('cooking for four').servings).toBe(4);
    expect(parseAmbientConstraints('meal for 3 people').servings).toBe(3);
  });

  it('extracts prep and cooking times', () => {
    const quickConstraints = parseAmbientConstraints("I'm exhausted and need a quick meal");
    expect(quickConstraints.prepTimeMinutes).toBe(10);
    expect(quickConstraints.cookTimeMinutes).toBe(15);

    const timedConstraints = parseAmbientConstraints('ready in 20 minutes');
    expect(timedConstraints.cookTimeMinutes).toBe(20);
  });

  it('extracts excluded allergens', () => {
    const noDairy = parseAmbientConstraints('dinner for two, no dairy');
    expect(noDairy.excludedAllergens).toContain('dairy');

    const multiple = parseAmbientConstraints('dairy-free and gluten-free dinner');
    expect(multiple.excludedAllergens).toContain('dairy');
    expect(multiple.excludedAllergens).toContain('gluten');

    const peanutFree = parseAmbientConstraints('peanut-free snack');
    expect(peanutFree.excludedAllergens).toContain('peanut');
  });

  it('extracts dietary tags', () => {
    const tags = parseAmbientConstraints('high-protein keto meal for gym day');
    expect(tags.dietaryTags).toContain('high-protein');
    expect(tags.dietaryTags).toContain('keto');
  });

  it('extracts target protein goals', () => {
    expect(parseAmbientConstraints('high-protein (>35g) grain bowl').targetProteinG).toBe(35);
    expect(parseAmbientConstraints('need 42g of protein').targetProteinG).toBe(42);
  });

  it('handles multi-constraint complex requests (Alex persona prompt)', () => {
    const prompt = "I'm exhausted and need a quick high-protein dinner under $25 for two people. No dairy.";
    const constraints = parseAmbientConstraints(prompt);

    expect(constraints.maxBudget).toBe(25);
    expect(constraints.servings).toBe(2);
    expect(constraints.prepTimeMinutes).toBe(10);
    expect(constraints.cookTimeMinutes).toBe(15);
    expect(constraints.excludedAllergens).toContain('dairy');
    expect(constraints.dietaryTags).toContain('high-protein');
  });
});
