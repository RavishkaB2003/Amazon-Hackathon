import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createMcpServer,
  startMcpServer,
  stopMcpServer,
  registerTool,
  clearTools,
} from '../../../src/server';
import { idempotencyManager } from '../../../src/server/transport/idempotency';

describe('HTTP Transport & Security Integration (Real Socket)', () => {
  let server: FastifyInstance;
  let serverUrl: string;
  const testPort = 3101;

  beforeAll(async () => {
    const started = await startMcpServer({
      port: testPort,
      host: '127.0.0.1',
      rateLimitMax: 10,
      rateLimitWindowMs: 5000,
    });
    server = started.server;
    serverUrl = `http://127.0.0.1:${testPort}`;
  });

  afterAll(async () => {
    if (server) {
      await stopMcpServer(server);
    }
  });

  beforeEach(() => {
    clearTools();
    idempotencyManager.clear();
  });

  it('binds strictly to 127.0.0.1 and rejects non-loopback host configuration', async () => {
    // Verify security guard rejects non-loopback host
    await expect(
      createMcpServer({ host: '0.0.0.0' })
    ).rejects.toThrow(/Security violation: MCP server must bind strictly to loopback/);

    await expect(
      createMcpServer({ host: '192.168.1.50' })
    ).rejects.toThrow(/Security violation: MCP server must bind strictly to loopback/);
  });

  it('responds with 200 and measures processing duration via X-Response-Time header', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }),
    });

    expect(res.status).toBe(200);
    const responseTime = res.headers.get('x-response-time');
    expect(responseTime).toBeTruthy();
    expect(responseTime).toMatch(/^\d+(\.\d+)?ms$/);

    const body = await res.json();
    expect(body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
  });

  it('enforces CORS allowlist for localhost:5173 with credentials support', async () => {
    const allowedOrigin = 'http://localhost:5173';
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: allowedOrigin,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('handles CORS preflight OPTIONS request correctly', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Idempotency-Key',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('rejects oversized payload exceeding 1MB with HTTP 413 and -32600 error', async () => {
    // Generate payload slightly larger than 1MB (1048576 bytes)
    const largeString = 'x'.repeat(1024 * 1024 + 100);
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'ping',
        params: { data: largeString },
      }),
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        message: expect.stringContaining('1MB ceiling'),
      },
    });
  });

  it('handles malformed JSON syntax returning HTTP 200 with -32700 Parse Error', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"jsonrpc": "2.0", "invalid_json_syntax',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: expect.stringContaining('Parse error'),
      },
    });
  });

  it('deduplicates mutating tool calls carrying identical Idempotency-Key headers', async () => {
    let executionCount = 0;
    registerTool({
      name: 'charge_item',
      description: 'Mutating transaction',
      inputSchema: { type: 'object' },
      handler: async () => {
        executionCount++;
        return {
          content: [{ type: 'text', text: `Transaction #${executionCount}` }],
        };
      },
    });

    const idempotencyKey = 'idem-unique-key-999';

    // First request
    const res1 = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'mut-1',
        method: 'tools/call',
        params: { name: 'charge_item', arguments: {} },
      }),
    });

    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1).toEqual({
      jsonrpc: '2.0',
      id: 'mut-1',
      result: {
        content: [{ type: 'text', text: 'Transaction #1' }],
      },
    });
    expect(executionCount).toBe(1);

    // Second request with same Idempotency-Key
    const res2 = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'mut-1',
        method: 'tools/call',
        params: { name: 'charge_item', arguments: {} },
      }),
    });

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    // Identical cached response returned
    expect(body2).toEqual(body1);
    // Handler was NOT executed again!
    expect(executionCount).toBe(1);
  });
});
