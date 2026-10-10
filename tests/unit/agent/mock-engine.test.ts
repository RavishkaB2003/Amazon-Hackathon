/**
 * Unit Test Suite for MOD-03 Offline Deterministic Mock Engine
 * CHK-MOD-03-MOCK: Deterministic offline simulation, persona scenarios (Alex, Elena, Marcus),
 * real MCP tool executions, widget dispatches, and streaming deltas (NFR-001).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockEngine } from '../../../src/server/agent/mock-engine';
import { registerCoreTools, getCart, clearCart } from '../../../src/server/mcp/tools';
import { countWords } from '../../../src/server/agent/prompts';

describe('Offline Deterministic Mock Engine (CHK-MOD-03-MOCK, FR-013, FR-014)', () => {
  let engine: MockEngine;

  beforeEach(() => {
    registerCoreTools();
    engine = new MockEngine();
  });

  it('Alex Scenario: ADHD Professional - Quick high-protein dinner under $25, no dairy', async () => {
    const sessionId = 'session-test-alex';
    clearCart(sessionId);

    const response = await engine.chat({
      sessionId,
      message: "I'm exhausted and need a quick high-protein dinner under $25 for two people. No dairy.",
      persona: 'alex',
      stream: false,
    });

    // 1. Spoken text brevity check (< 25 words per FR-011)
    expect(response.wordCount).toBeLessThan(25);
    expect(countWords(response.spokenText)).toBe(response.wordCount);
    expect(response.spokenText).toContain('Sesame Chicken');

    // 2. Real tool execution verification
    expect(response.toolCallsExecuted.length).toBeGreaterThanOrEqual(3);
    const toolNames = response.toolCallsExecuted.map((t) => t.toolName);
    expect(toolNames).toContain('smart_search_catalog');
    expect(toolNames).toContain('build_curated_bundle');
    expect(toolNames).toContain('render_multimodal_widget');
    expect(toolNames).toContain('manage_cart');

    // 3. Multimodal widget dispatched
    expect(response.widgetsDispatched.length).toBeGreaterThan(0);
    expect(response.widgetsDispatched[0].widgetType).toBe('recipe_card');
    expect(response.widgetsDispatched[0].title).toBe('15-Minute Sesame Chicken Noodles');

    // 4. Cart populated for session
    const cart = getCart(sessionId);
    expect(cart.items.length).toBeGreaterThan(0);
    expect(cart.total).toBeLessThanOrEqual(25.0 * 1.1); // Under budget ceiling

    // 5. Metadata
    expect(response.modelUsed).toContain('mock');
    expect(response.fallbackTriggered).toBe(false);
  });

  it('Elena Scenario: Budget & Allergy Parent - Initial Mediterranean Salmon and Follow-up Swap', async () => {
    const sessionId = 'session-test-elena';
    clearCart(sessionId);

    // Turn 1: Initial salmon bowl under $30
    const turn1 = await engine.chat({
      sessionId,
      message: 'I need a Mediterranean salmon dinner under $30 for two, strictly dairy-free.',
      persona: 'elena',
      stream: false,
    });

    expect(turn1.wordCount).toBeLessThan(25);
    expect(turn1.spokenText).toContain('Mediterranean Salmon Bowl');
    expect(turn1.widgetsDispatched[0].title).toBe('Mediterranean Salmon Bowl');

    const cart1 = getCart(sessionId);
    expect(cart1.items.length).toBeGreaterThan(0);

    // Turn 2: Follow-up swap to chicken under $20
    const turn2 = await engine.chat({
      sessionId,
      message: 'Can we swap the salmon for chicken and keep dinner under $20?',
      persona: 'elena',
      stream: false,
    });

    expect(turn2.wordCount).toBeLessThan(25);
    expect(turn2.spokenText).toContain('swapped the salmon for organic chicken breast');
    expect(turn2.spokenText).toContain('$18.50');
    expect(turn2.widgetsDispatched[0].title).toBe('15-Minute Sesame Chicken Noodles');
  });

  it('Marcus Scenario: Fitness Enthusiast - High-protein (>35g) grain bowl', async () => {
    const sessionId = 'session-test-marcus';
    clearCart(sessionId);

    const response = await engine.chat({
      sessionId,
      message: 'Give me a high-protein (>35g) grain bowl recipe for dinner.',
      persona: 'marcus',
      stream: false,
    });

    expect(response.wordCount).toBeLessThan(25);
    expect(response.spokenText).toContain('high-protein quinoa grain bowl');

    const toolNames = response.toolCallsExecuted.map((t) => t.toolName);
    expect(toolNames).toContain('smart_search_catalog');
    expect(toolNames).toContain('build_curated_bundle');
    expect(toolNames).toContain('render_multimodal_widget');
    expect(response.widgetsDispatched[0].widgetType).toBe('recipe_card');
  });

  it('Custom Scenario: Adaptive meal planning with constraint decomposition', async () => {
    const sessionId = 'session-test-custom';
    clearCart(sessionId);

    const response = await engine.chat({
      sessionId,
      message: 'Looking for a quick keto breakfast scramble with avocado under $15.',
      stream: false,
    });

    expect(response.wordCount).toBeLessThan(25);
    expect(response.spokenText).toContain('Keto');
    const toolNames = response.toolCallsExecuted.map((t) => t.toolName);
    expect(toolNames).toContain('build_curated_bundle');
    expect(toolNames).toContain('render_multimodal_widget');
  });

  it('Purge Command Execution: Voice/text purge wipes cart and returns < 10 word reply', async () => {
    const sessionId = 'session-test-purge-voice';
    clearCart(sessionId);

    const response = await engine.chat({
      sessionId,
      message: 'Clear my session history',
      stream: false,
    });

    expect(response.wordCount).toBeLessThan(10);
    expect(response.spokenText).toBe("I've cleared your session history and shopping cart.");
    expect(response.modelUsed).toBe('system-purge');
    const cart = getCart(sessionId);
    expect(cart.items).toEqual([]);
  });

  it('Streaming cadence: Yields token, tool_call, tool_result, widget, and done chunks (TTFT < 1200ms)', async () => {
    const sessionId = 'session-test-stream';
    clearCart(sessionId);

    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    const receivedChunks: string[] = [];

    const stream = engine.chatStream({
      sessionId,
      message: "I'm exhausted and need a quick dinner under $25 for two. No dairy.",
      persona: 'alex',
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'token' && firstTokenTime === null) {
        firstTokenTime = Date.now();
      }
      receivedChunks.push(chunk.type);
    }

    const elapsedTtft = (firstTokenTime || Date.now()) - startTime;
    // TTFT must be strictly under 1200ms in mock mode per NFR-001
    expect(elapsedTtft).toBeLessThan(1200);

    // Verify chunk types received
    expect(receivedChunks).toContain('token');
    expect(receivedChunks).toContain('tool_call');
    expect(receivedChunks).toContain('tool_result');
    expect(receivedChunks).toContain('widget');
    expect(receivedChunks).toContain('done');
  });
});
