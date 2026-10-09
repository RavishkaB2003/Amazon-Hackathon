import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import http from 'node:http';
import {
  startMcpServer,
  stopMcpServer,
  registerCoreTools,
  clearTools,
  resetAllCarts,
} from '../../../src/server';
import type { CuratedBundle, CartState, CatalogItem } from '../../../src/shared/types/tools';

describe('MOD-02 MCP Core Tools Matrix (Integration via Real Socket)', () => {
  let server: FastifyInstance;
  let serverUrl: string;
  const testPort = 3108;

  beforeAll(async () => {
    // Start real MCP server listening on loopback
    const started = await startMcpServer({
      port: testPort,
      host: '127.0.0.1',
      rateLimitMax: 100,
      rateLimitWindowMs: 60000,
      heartbeatIntervalMs: 500,
    });
    server = started.server;
    serverUrl = `http://127.0.0.1:${testPort}`;

    // Ensure all 4 core tools are registered
    clearTools();
    registerCoreTools();
    resetAllCarts();
  });

  afterAll(async () => {
    if (server) {
      await stopMcpServer(server);
    }
  });

  // 1. Tool Discovery & Schema Compliance (CHK-MOD-02-SCHEMA)
  it('discovers all 4 core tools via tools/list with draft-07 inputSchemas', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'disc-1',
        method: 'tools/list',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe('disc-1');

    const tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> =
      body.result.tools;
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('smart_search_catalog');
    expect(toolNames).toContain('build_curated_bundle');
    expect(toolNames).toContain('render_multimodal_widget');
    expect(toolNames).toContain('manage_cart');

    // Verify all inputSchemas conform to draft-07 object type
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  // 2. smart_search_catalog execution via JSON-RPC
  it('executes smart_search_catalog tool call via POST /mcp', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call-search-1',
        method: 'tools/call',
        params: {
          name: 'smart_search_catalog',
          arguments: {
            query: 'salmon',
            maxPrice: 15.0,
            excludedAllergens: ['dairy'],
            dietaryTags: ['high-protein'],
            limit: 5,
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.result.content[0].type).toBe('text');

    const items: CatalogItem[] = JSON.parse(body.result.content[0].text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].title).toContain('Salmon');
    expect(items[0].price).toBeLessThanOrEqual(15.0);
    expect(items[0].allergenFlags).not.toContain('dairy');
    expect(items[0].dietaryTags).toContain('high-protein');
  });

  // 3. build_curated_bundle execution via JSON-RPC
  it('executes build_curated_bundle tool call via POST /mcp with budget capping', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call-bundle-1',
        method: 'tools/call',
        params: {
          name: 'build_curated_bundle',
          arguments: {
            recipeId: 'rec-mediterranean-salmon',
            servings: 2,
            maxBudget: 25.0,
            excludedAllergens: ['dairy'],
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const bundle: CuratedBundle = JSON.parse(body.result.content[0].text);

    expect(bundle.recipeId).toBe('rec-mediterranean-salmon');
    expect(bundle.servings).toBe(2);
    expect(bundle.budgetCompliant).toBe(true);
    expect(bundle.totalPrice).toBeLessThanOrEqual(25.0);
    expect(bundle.savingsAmount).toBeGreaterThanOrEqual(4.0);
  });

  // 4. render_multimodal_widget execution + Real SSE reception (CHK-MOD-02-WIDGET)
  it('executes render_multimodal_widget and emits real SSE frame to streaming subscriber', async () => {
    const testSessionId = 'session-integration-widget-test';

    await new Promise<void>((resolve, reject) => {
      let sseReceived = false;
      const chunks: string[] = [];

      // Open SSE connection targeting testSessionId
      const sseReq = http.get(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path: `/mcp/events?sessionId=${testSessionId}`,
        },
        (sseRes) => {
          expect(sseRes.statusCode).toBe(200);
          expect(sseRes.headers['content-type']).toBe('text/event-stream');

          sseRes.setEncoding('utf8');
          sseRes.on('data', (chunk: string) => {
            chunks.push(chunk);
            const streamContent = chunks.join('');

            if (streamContent.includes('event: widget') && !sseReceived) {
              sseReceived = true;
              expect(streamContent).toContain('Mediterranean Salmon Bowl');
              expect(streamContent).toContain('recipe_card');
              sseReq.destroy();
              resolve();
            }
          });
        }
      );

      sseReq.on('error', (err) => {
        if ((err as { code?: string }).code !== 'ECONNRESET' && !sseReceived) {
          reject(err);
        }
      });

      // Wait 100ms for SSE stream to establish, then call render_multimodal_widget tool
      setTimeout(async () => {
        try {
          const res = await fetch(`${serverUrl}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'call-widget-1',
              method: 'tools/call',
              params: {
                name: 'render_multimodal_widget',
                arguments: {
                  widgetType: 'recipe_card',
                  title: 'Mediterranean Salmon Bowl',
                  sessionId: testSessionId,
                  payload: {
                    recipeId: 'rec-mediterranean-salmon',
                    title: 'Mediterranean Salmon Bowl',
                    description: 'Pan-seared salmon over fluffy tricolor quinoa.',
                    imageUrl: '/assets/recipes/salmon-bowl.jpg',
                    prepTimeMinutes: 10,
                    cookTimeMinutes: 15,
                    servings: 2,
                    macros: { calories: 520, proteinG: 42, carbsG: 38, fatG: 22 },
                    ingredients: [
                      { name: 'Atlantic Salmon Fillet', quantity: '1 lb' },
                      { name: 'Tricolor Quinoa', quantity: '1 cup' },
                    ],
                  },
                },
              },
            }),
          });

          expect(res.status).toBe(200);
          const body = await res.json();
          expect(body.result.content[0].text).toContain(
            'Rendered recipe_card widget: "Mediterranean Salmon Bowl" successfully.'
          );
        } catch (err) {
          reject(err);
        }
      }, 100);
    });
  });

  // 5. manage_cart execution via JSON-RPC
  it('executes manage_cart add_bundle and get_cart operations via POST /mcp', async () => {
    const sessionId = 'session-int-cart-elena';

    // Call add_bundle
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call-cart-1',
        method: 'tools/call',
        params: {
          name: 'manage_cart',
          arguments: {
            action: 'add_bundle',
            sessionId,
            bundleId: 'bnd-mediterranean-salmon-1728480000',
            items: [
              { sku: 'FRESH-SALMON-01', quantity: 1, title: 'Fresh Atlantic Salmon Fillet', price: 11.99 },
              { sku: 'FRESH-QUINOA-01', quantity: 1, title: 'Organic Tricolor Quinoa', price: 3.99 },
              { sku: 'FRESH-CUCUMBER-01', quantity: 1, title: 'English Cucumber', price: 1.49 },
            ],
            version: 1,
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const cart: CartState = JSON.parse(body.result.content[0].text);

    expect(cart.sessionId).toBe(sessionId);
    expect(cart.version).toBe(2);
    expect(cart.itemCount).toBe(3);
    expect(cart.subtotal).toBe(17.47);
    expect(cart.estimatedTax).toBe(1.44);
    expect(cart.total).toBe(18.91);
  });

  // 6. Concurrency conflict handling in manage_cart (OCC)
  it('handles OCC version conflict gracefully returning error result (CTRL-12)', async () => {
    const sessionId = 'session-int-cart-elena'; // current version is 2

    const conflictRes = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call-conflict-1',
        method: 'tools/call',
        params: {
          name: 'manage_cart',
          arguments: {
            action: 'clear',
            sessionId,
            version: 1, // Stale expected version! Current is 2
          },
        },
      }),
    });

    expect(conflictRes.status).toBe(200);
    const body = await conflictRes.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain('Cart concurrency conflict');
  });

  // 7. Payment data isolation guard (SEC-001)
  it('blocks payment data insertion with security rejection (SEC-001)', async () => {
    const maliciousRes = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call-sec-1',
        method: 'tools/call',
        params: {
          name: 'manage_cart',
          arguments: {
            action: 'add_item',
            sessionId: 'session-sec-attack',
            sku: 'FRESH-SALMON-01',
            cardNumber: '4111222233334444',
            cvv: '123',
          },
        },
      }),
    });

    expect(maliciousRes.status).toBe(200);
    const body = await maliciousRes.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain(
      'Security violation: Payment card information (PAN/CVV) is strictly prohibited (SEC-001)'
    );
  });

  // 8. Schema gating rejecting invalid parameter types with -32602 (CHK-MOD-02-SCHEMA)
  it('rejects invalid tool arguments returning -32602 without crashing (CHK-MOD-02-SCHEMA)', async () => {
    const res = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call-invalid-1',
        method: 'tools/call',
        params: {
          name: 'build_curated_bundle',
          arguments: {
            // Missing required recipeId
            servings: 'three', // should be integer
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(-32602);
    expect(body.error.message).toContain('Invalid params');
  });
});
