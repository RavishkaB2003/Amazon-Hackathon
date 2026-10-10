/**
 * Unit Test Suite for MOD-03 Ephemeral Conversational Memory & Session Purge
 * CHK-MOD-03-HISTORY: In-memory sliding window (max 20 messages / 10 turns, PRIV-001),
 * session isolation, RAM-only store, and purge with cart cleanup (PRIV-002).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentMemoryStore,
  isPurgeCommand,
  MAX_SESSION_MESSAGES,
} from '../../../src/server/agent/memory';
import { getCart, addItemToCart } from '../../../src/server/mcp/tools';

describe('Ephemeral Conversational Memory Store (PRIV-001, FR-012)', () => {
  let memory: AgentMemoryStore;

  beforeEach(() => {
    memory = new AgentMemoryStore();
  });

  it('initializes empty session history for a new sessionId', () => {
    const session = memory.getSession('session-user-1');
    expect(session.sessionId).toBe('session-user-1');
    expect(session.messages).toEqual([]);
    expect(memory.getSessionHistory('session-user-1')).toEqual([]);
  });

  it('appends user and assistant messages in order', () => {
    memory.addMessage('session-user-1', {
      role: 'user',
      content: [{ text: 'Hello Aura' }],
    });
    memory.addMessage('session-user-1', {
      role: 'assistant',
      content: [{ text: 'Hello! How can I assist with dinner?' }],
    });

    const history = memory.getSessionHistory('session-user-1');
    expect(history.length).toBe(2);
    expect(history[0].role).toBe('user');
    expect((history[0].content[0] as { text: string }).text).toBe('Hello Aura');
    expect(history[1].role).toBe('assistant');
  });

  it('enforces a sliding window of max 20 messages (10 conversational turns)', () => {
    // Add 25 messages
    for (let i = 1; i <= 25; i++) {
      memory.addMessage('session-user-1', {
        role: i % 2 === 1 ? 'user' : 'assistant',
        content: [{ text: `Message ${i}` }],
      });
    }

    const history = memory.getSessionHistory('session-user-1');
    expect(history.length).toBe(MAX_SESSION_MESSAGES);
    expect(history.length).toBe(20);

    // Oldest messages (1-5) must be pruned
    expect((history[0].content[0] as { text: string }).text).toBe('Message 6');
    expect((history[19].content[0] as { text: string }).text).toBe('Message 25');
  });

  it('guarantees strict session isolation across distinct sessionIds', () => {
    memory.addMessage('session-alex', {
      role: 'user',
      content: [{ text: "Alex's dinner prompt" }],
    });
    memory.addMessage('session-elena', {
      role: 'user',
      content: [{ text: "Elena's allergy prompt" }],
    });

    const alexHistory = memory.getSessionHistory('session-alex');
    const elenaHistory = memory.getSessionHistory('session-elena');

    expect(alexHistory.length).toBe(1);
    expect(elenaHistory.length).toBe(1);
    expect((alexHistory[0].content[0] as { text: string }).text).toBe("Alex's dinner prompt");
    expect((elenaHistory[0].content[0] as { text: string }).text).toBe("Elena's allergy prompt");
  });
});

describe('Session Purge Mechanism (PRIV-002, CTRL-05)', () => {
  let memory: AgentMemoryStore;

  beforeEach(() => {
    memory = new AgentMemoryStore();
  });

  it('detects session purge command patterns accurately', () => {
    expect(isPurgeCommand('Clear my session history')).toBe(true);
    expect(isPurgeCommand('clear session history')).toBe(true);
    expect(isPurgeCommand('Reset session')).toBe(true);
    expect(isPurgeCommand('reset my session')).toBe(true);
    expect(isPurgeCommand('Forget everything')).toBe(true);
    expect(isPurgeCommand('Clear history')).toBe(true);
    expect(isPurgeCommand('Wipe my session')).toBe(true);
    expect(isPurgeCommand('Start fresh')).toBe(true);

    // Non-purge queries
    expect(isPurgeCommand('What is in my session?')).toBe(false);
    expect(isPurgeCommand('I want clear soup for dinner')).toBe(false);
    expect(isPurgeCommand('Quick dinner under $25')).toBe(false);
  });

  it('purges session memory from RAM and empties staged shopping cart', () => {
    const sessionId = 'session-purge-test';

    // 1. Add messages
    memory.addMessage(sessionId, {
      role: 'user',
      content: [{ text: 'Add salmon' }],
    });
    memory.addMessage(sessionId, {
      role: 'assistant',
      content: [{ text: 'Added salmon to your cart.' }],
    });

    // 2. Add item to cart for this session
    addItemToCart(sessionId, { sku: 'FRESH-SALMON-01', quantity: 1 });
    const cartBefore = getCart(sessionId);
    expect(cartBefore.items.length).toBeGreaterThan(0);
    expect(memory.getSessionHistory(sessionId).length).toBe(2);

    // 3. Execute purge
    memory.clearSession(sessionId);

    // 4. Verify RAM memory wiped and cart emptied
    expect(memory.getSessionHistory(sessionId)).toEqual([]);
    const cartAfter = getCart(sessionId);
    expect(cartAfter.items).toEqual([]);
    expect(cartAfter.subtotal).toBe(0);
  });

  it('cleans up sessions that have been idle longer than TTL', () => {
    const sessionId = 'session-idle-test';
    const session = memory.getSession(sessionId);

    // Artificially age the session activity timestamp
    session.lastActivityAt = Date.now() - 35 * 60 * 1000; // 35 minutes ago

    const cleaned = memory.cleanupExpiredSessions(30 * 60 * 1000);
    expect(cleaned).toBe(1);
    expect(memory.getSessionHistory(sessionId)).toEqual([]);
  });
});
