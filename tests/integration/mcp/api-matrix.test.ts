import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import http from 'node:http';
import {
  startMcpServer,
  stopMcpServer,
  registerTool,
  clearTools,
  getActiveSseSubscriberCount,
} from '../../../src/server';
import { idempotencyManager } from '../../../src/server/transport/idempotency';

describe('MOD-01 API Matrix Conformance (Integration)', () => {
  let server: FastifyInstance;
  let serverUrl: string;
  const testPort = 3103;

  beforeAll(async () => {
    const started = await startMcpServer({
      port: testPort,
      host: '127.0.0.1',
      rateLimitMax: 60,
      rateLimitWindowMs: 60000,
      heartbeatIntervalMs: 150,
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

  // Row 1: POST /mcp (initialize) with valid params -> 200 / Result
  it('Row 1: POST /mcp (initialize) with valid params returns 200 and Result', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'matrix-client', version: '1.0.0' },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 'matrix-1',
      result: {
        protocolVersion: '2025-11-25',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'aura-mcp-server', version: '1.0.0' },
      },
    });
  });

  // Row 2: POST /mcp (initialize) with missing clientInfo -> 200 / Result
  it('Row 2: POST /mcp (initialize) with missing clientInfo returns 200 and Result', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-2',
        method: 'initialize',
        params: { protocolVersion: '2025-11-25' },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 'matrix-2',
      result: {
        protocolVersion: '2025-11-25',
        serverInfo: { name: 'aura-mcp-server' },
      },
    });
  });

  // Row 3: POST /mcp (ping) -> 200 / {}
  it('Row 3: POST /mcp (ping) returns 200 and {}', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-3',
        method: 'ping',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      jsonrpc: '2.0',
      id: 'matrix-3',
      result: {},
    });
  });

  // Row 4: POST /mcp (tools/list) -> 200 / Tool array
  it('Row 4: POST /mcp (tools/list) returns 200 and tool array from registry', async () => {
    registerTool({
      name: 'smart_search_mock',
      description: 'Search catalog mock',
      inputSchema: { type: 'object' },
      handler: async () => ({ content: [] }),
    });

    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-4',
        method: 'tools/list',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.tools).toHaveLength(1);
    expect(body.result.tools[0].name).toBe('smart_search_mock');
  });

  // Row 5: POST /mcp (tools/call) with valid tool name & params -> 200 / Result
  it('Row 5: POST /mcp (tools/call) with valid tool & params executes tool', async () => {
    registerTool({
      name: 'echo_calc',
      description: 'Calculates doubled value',
      inputSchema: {
        type: 'object',
        properties: { val: { type: 'number' } },
        required: ['val'],
      },
      handler: async (args) => ({
        content: [{ type: 'text', text: String(Number(args.val) * 2) }],
      }),
    });

    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-5',
        method: 'tools/call',
        params: {
          name: 'echo_calc',
          arguments: { val: 21 },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      jsonrpc: '2.0',
      id: 'matrix-5',
      result: {
        content: [{ type: 'text', text: '42' }],
      },
    });
  });

  // Row 6: POST /mcp (tools/call) with unknown tool name -> 200 / -32601
  it('Row 6: POST /mcp (tools/call) with unknown tool name returns 200 / -32601', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-6',
        method: 'tools/call',
        params: {
          name: 'missing_tool',
          arguments: {},
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 'matrix-6',
      error: { code: -32601 },
    });
  });

  // Row 7: POST /mcp (tools/call) with schema mismatch params -> 200 / -32602
  it('Row 7: POST /mcp (tools/call) with schema mismatch params returns 200 / -32602', async () => {
    registerTool({
      name: 'strict_tool',
      description: 'Requires string id',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      handler: async () => ({ content: [] }),
    });

    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-7',
        method: 'tools/call',
        params: {
          name: 'strict_tool',
          arguments: { id: 12345 }, // wrong type
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 'matrix-7',
      error: { code: -32602 },
    });
  });

  // Row 8: POST /mcp (*) with invalid JSON syntax -> 200 / -32700
  it('Row 8: POST /mcp (*) with invalid JSON syntax returns 200 / -32700', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"jsonrpc": "2.0", broken syntax}',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700 },
    });
  });

  // Row 9: POST /mcp (*) with missing jsonrpc 2.0 -> 200 / -32600
  it('Row 9: POST /mcp (*) with missing jsonrpc 2.0 returns 200 / -32600', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'matrix-9',
        method: 'ping',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 'matrix-9',
      error: { code: -32600 },
    });
  });

  // Row 10: POST /mcp (*) with payload > 1 MB -> 413 / -32600
  it('Row 10: POST /mcp (*) with payload > 1 MB returns 413 / -32600', async () => {
    const largeStr = 'a'.repeat(1024 * 1024 + 50);
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'matrix-10',
        method: 'ping',
        params: { data: largeStr },
      }),
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600 },
    });
  });

  // Row 11: POST /mcp (*) with rate limit exceeded -> 429 Too Many Req
  it('Row 11: POST /mcp (*) with rate limit exceeded returns 429', async () => {
    // Start separate low-rate-limit server instance for row 11 test
    const rateLimitPort = 3105;
    const rlServer = await startMcpServer({
      port: rateLimitPort,
      host: '127.0.0.1',
      rateLimitMax: 3,
      rateLimitWindowMs: 5000,
    });

    try {
      const url = `http://127.0.0.1:${rateLimitPort}/mcp`;
      for (let i = 0; i < 3; i++) {
        const okRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: i, method: 'ping' }),
        });
        expect(okRes.status).toBe(200);
      }

      // 4th request must be throttled
      const throttledRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'ping' }),
      });

      expect(throttledRes.status).toBe(429);
      const body = await throttledRes.json();
      expect(body).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: expect.stringContaining('Rate limit exceeded') },
      });
    } finally {
      await stopMcpServer(rlServer.server);
    }
  });

  // Row 12: POST /mcp (mutating) with same Idempotency-Key -> 200 / Cached Result
  it('Row 12: POST /mcp (mutating) with same Idempotency-Key returns cached result with zero re-execution', async () => {
    let callCount = 0;
    registerTool({
      name: 'idempotent_increment',
      description: 'Increments counter',
      inputSchema: { type: 'object' },
      handler: async () => {
        callCount++;
        return { content: [{ type: 'text', text: `Run ${callCount}` }] };
      },
    });

    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'matrix-idem-key-42',
    };
    const reqBody = JSON.stringify({
      jsonrpc: '2.0',
      id: 'matrix-12',
      method: 'tools/call',
      params: { name: 'idempotent_increment', arguments: {} },
    });

    const res1 = await fetch(`${serverUrl}/mcp`, { method: 'POST', headers, body: reqBody });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.result.content[0].text).toBe('Run 1');
    expect(callCount).toBe(1);

    const res2 = await fetch(`${serverUrl}/mcp`, { method: 'POST', headers, body: reqBody });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2).toEqual(body1);
    expect(callCount).toBe(1); // Zero re-execution
  });

  // Rows 13, 14, 15: GET /mcp/events SSE lifecycle
  it('Rows 13, 14, 15: GET /mcp/events handles connect, idle heartbeat, and disconnect', async () => {
    await new Promise<void>((resolve, reject) => {
      const chunks: string[] = [];
      let receivedPing = false;

      const req = http.get(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path: '/mcp/events?sessionId=matrix-sse',
        },
        (res) => {
          // Row 13: 200 (SSE stream)
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toBe('text/event-stream');

          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            chunks.push(chunk);
            const allData = chunks.join('');
            // Row 14: idle heartbeat ping received
            if (allData.includes(': ping\n\n') && !receivedPing) {
              receivedPing = true;
              // Row 15: simulate client socket close
              req.destroy();
            }
          });

          res.on('close', () => {
            setTimeout(() => {
              try {
                expect(receivedPing).toBe(true);
                // Row 15: socket unregistered
                expect(getActiveSseSubscriberCount()).toBe(0);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, 50);
          });
        }
      );

      req.on('error', (err) => {
        if ((err as { code?: string }).code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
  });
});
