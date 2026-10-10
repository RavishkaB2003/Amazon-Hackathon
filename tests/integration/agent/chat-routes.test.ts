/**
 * Integration Test Suite for MOD-03 Fastify Agent Chat Routes
 * Endpoints:
 * - POST /agent/chat (JSON & SSE streaming)
 * - GET /agent/session/:sessionId
 * - DELETE /agent/session/:sessionId
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMcpServer, clearCart, addItemToCart, getCart } from '../../../src/server';

describe('Fastify Agent Chat Routes (Integration)', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    // Start local Fastify loopback server
    process.env.AWS_MOCK_MODE = 'true';
    server = await createMcpServer({ host: '127.0.0.1' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('POST /agent/chat (Non-Streaming JSON Mode) returns 200 and structured response envelope', async () => {
    const sessionId = 'session-int-json-1';
    clearCart(sessionId);

    const response = await server.inject({
      method: 'POST',
      url: '/agent/chat',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        sessionId,
        message: "I'm exhausted and need a quick high-protein dinner under $25 for two people. No dairy.",
        persona: 'alex',
        stream: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-response-time']).toBeDefined();
    expect(response.headers['x-bedrock-fallback']).toBeDefined();

    const body = JSON.parse(response.body);
    expect(body.sessionId).toBe(sessionId);
    expect(body.wordCount).toBeLessThan(25);
    expect(body.spokenText).toBeDefined();
    expect(body.toolCallsExecuted.length).toBeGreaterThanOrEqual(3);
    expect(body.widgetsDispatched.length).toBeGreaterThan(0);
    expect(body.modelUsed).toContain('mock');
  });

  it('POST /agent/chat (Streaming SSE Mode) returns 200 text/event-stream with chunked events', async () => {
    const sessionId = 'session-int-sse-1';
    clearCart(sessionId);

    const response = await server.inject({
      method: 'POST',
      url: '/agent/chat',
      headers: {
        'content-type': 'application/json',
        'accept': 'text/event-stream',
      },
      payload: {
        sessionId,
        message: 'Can we swap the salmon for chicken and keep dinner under $20?',
        persona: 'elena',
        stream: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['x-bedrock-fallback']).toBeDefined();

    const streamBody = response.body;
    expect(streamBody).toContain('event: token');
    expect(streamBody).toContain('event: tool_call');
    expect(streamBody).toContain('event: tool_result');
    expect(streamBody).toContain('event: widget');
    expect(streamBody).toContain('event: done');

    // Parse the done event
    const doneMatch = streamBody.match(/event: done\s+data: ({.*?})/);
    expect(doneMatch).not.toBeNull();
    const donePayload = JSON.parse(doneMatch![1]);
    expect(donePayload.wordCount).toBeLessThan(25);
    expect(donePayload.spokenText).toBeDefined();
  });

  it('GET and DELETE /agent/session/:sessionId manage ephemeral memory and cart', async () => {
    const sessionId = 'session-int-crud-1';
    clearCart(sessionId);

    // 1. Send chat message to populate session
    await server.inject({
      method: 'POST',
      url: '/agent/chat',
      payload: {
        sessionId,
        message: 'High-protein grain bowl dinner',
        persona: 'marcus',
      },
    });

    // 2. GET session history
    const getRes = await server.inject({
      method: 'GET',
      url: `/agent/session/${sessionId}`,
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.sessionId).toBe(sessionId);
    expect(getBody.messageCount).toBeGreaterThan(0);
    expect(getBody.messages.length).toBeGreaterThan(0);

    // 3. DELETE session history
    const delRes = await server.inject({
      method: 'DELETE',
      url: `/agent/session/${sessionId}`,
    });

    expect(delRes.statusCode).toBe(200);
    const delBody = JSON.parse(delRes.body);
    expect(delBody.cleared).toBe(true);

    // 4. Verify session is empty now
    const verifyRes = await server.inject({
      method: 'GET',
      url: `/agent/session/${sessionId}`,
    });
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.messageCount).toBe(0);
  });

  it('Voice/Text purge command clears session history and cart via chat endpoint', async () => {
    const sessionId = 'session-int-purge-endpoint';
    addItemToCart(sessionId, { sku: 'FRESH-SALMON-01', quantity: 2 });
    expect(getCart(sessionId).items.length).toBe(1);

    const response = await server.inject({
      method: 'POST',
      url: '/agent/chat',
      payload: {
        sessionId,
        message: 'Clear my session history',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.wordCount).toBeLessThan(10);
    expect(body.spokenText).toContain('cleared your session history');
    expect(getCart(sessionId).items.length).toBe(0);
  });

  it('Returns 400 Bad Request when request body is invalid', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/agent/chat',
      payload: {
        // Missing sessionId and message
        stream: false,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Bad Request');
  });
});
