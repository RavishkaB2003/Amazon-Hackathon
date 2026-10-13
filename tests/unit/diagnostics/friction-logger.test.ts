/**
 * Unit Test Suite: Developer Experience Friction Logger (FR-020, PRIV-003)
 * Tests observation recording, category distribution, markdown/json export, and PII hygiene
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrictionLogger } from '../../../src/server/diagnostics/friction-logger';

describe('CHK-MOD-05-FRICTION: FrictionLogger Unit Tests (FR-020, PRIV-003)', () => {
  let frictionLogger: FrictionLogger;

  beforeEach(() => {
    frictionLogger = new FrictionLogger();
  });

  it('initializes with default curated observations across all 5 key technology stacks', () => {
    const entries = frictionLogger.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(7);

    const categories = new Set(entries.map((e) => e.category));
    expect(categories.has('MCP_SDK')).toBe(true);
    expect(categories.has('BEDROCK_CONVERSE')).toBe(true);
    expect(categories.has('FASTIFY_SSE')).toBe(true);
    expect(categories.has('REACT_19')).toBe(true);
    expect(categories.has('POWERSHELL_WINDOWS')).toBe(true);
  });

  it('records a new runtime friction observation with automatic PII scrubbing', () => {
    const recorded = frictionLogger.record({
      category: 'BEDROCK_CONVERSE',
      severity: 'HIGH',
      title: 'Token rate limit on account AKIAIOSFODNN7EXAMPLE',
      description: 'Customer with peanut allergy experienced 429 backoff.',
      workaroundOrFix: 'Added exponential jitter backoff.',
      sdkVersion: '3.693.0',
      impactMinutes: 45,
      reproducible: true,
    });

    expect(recorded.id).toBeDefined();
    expect(recorded.timestamp).toBeDefined();
    expect(recorded.title).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(recorded.title).toContain('***REDACTED***');
    expect(recorded.description).not.toContain('peanut allergy');
    expect(recorded.description).toContain('[REDACTED_HEALTH]');
  });

  it('exports structured JSON summary with exact category breakdowns', () => {
    const jsonExport = frictionLogger.exportJson();

    expect(jsonExport.project).toBe('Aura+ Multimodal Commerce Assistant');
    expect(jsonExport.totalEntries).toBeGreaterThanOrEqual(7);
    expect(jsonExport.entriesByCategory.BEDROCK_CONVERSE).toBeGreaterThanOrEqual(2);
    expect(jsonExport.entriesByCategory.MCP_SDK).toBeGreaterThanOrEqual(2);
    expect(jsonExport.entriesByCategory.FASTIFY_SSE).toBeGreaterThanOrEqual(1);
    expect(jsonExport.entriesByCategory.REACT_19).toBeGreaterThanOrEqual(1);
    expect(jsonExport.entriesByCategory.POWERSHELL_WINDOWS).toBeGreaterThanOrEqual(1);
    expect(jsonExport.entries.length).toBe(jsonExport.totalEntries);
  });

  it('exports comprehensive markdown document adhering to hackathon bonus rubric', () => {
    const markdown = frictionLogger.exportMarkdown();

    expect(markdown).toContain('# Aura+ Developer Experience Friction Log');
    expect(markdown).toContain('## Executive Summary');
    expect(markdown).toContain('## Category Breakdown');
    expect(markdown).toContain('## Detailed Engineering Observations');
    expect(markdown).toContain('## Constructive SDK & Framework Recommendations');
    expect(markdown).toContain('`MCP_SDK`');
    expect(markdown).toContain('`BEDROCK_CONVERSE`');
    expect(markdown).toContain('`FASTIFY_SSE`');
    expect(markdown).toContain('`REACT_19`');
    expect(markdown).toContain('`POWERSHELL_WINDOWS`');

    // Asserts zero PII or credentials in exported document
    expect(markdown).not.toMatch(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/);
    expect(markdown).not.toMatch(/\b(?:\d[ -]*?){13,19}\b/);
  });

  it('supports clear and reset to default methods', () => {
    frictionLogger.clear();
    expect(frictionLogger.getEntries().length).toBe(0);

    frictionLogger.resetToDefaults();
    expect(frictionLogger.getEntries().length).toBeGreaterThanOrEqual(7);
  });
});
