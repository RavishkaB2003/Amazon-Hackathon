/**
 * Aura+ MCP Core & Transport Server
 * Fastify HTTP Server, JSON-RPC 2.0 Router, and SSE Transport
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import type {
  ServerOptions,
  RequestContext,
  McpToolRegistration,
  McpSseEvent,
} from '../shared/types/mcp';
import { dispatchJsonRpc } from './mcp/router';
import {
  registerTool,
  unregisterTool,
  listRegisteredTools,
  getTool,
  clearTools,
} from './mcp/registry';
import {
  SseManager,
  sseManager,
  broadcastSseEvent,
  getActiveSseSubscriberCount,
} from './transport/sse';
import { SlidingWindowRateLimiter } from './transport/rate-limiter';
import { IdempotencyManager, idempotencyManager } from './transport/idempotency';
import {
  registerCoreTools,
  getCatalogItems,
  getCatalogItemBySku,
  getRecipes,
  getRecipeById,
  getCart,
  addItemToCart,
  addBundleToCart,
  removeItemFromCart,
  clearCart,
  resetAllCarts,
} from './mcp/tools';

// Re-exports for public interface
export {
  registerTool,
  unregisterTool,
  listRegisteredTools,
  getTool,
  clearTools,
  broadcastSseEvent,
  getActiveSseSubscriberCount,
  registerCoreTools,
  getCatalogItems,
  getCatalogItemBySku,
  getRecipes,
  getRecipeById,
  getCart,
  addItemToCart,
  addBundleToCart,
  removeItemFromCart,
  clearCart,
  resetAllCarts,
};
export type { ServerOptions, McpToolRegistration, McpSseEvent, RequestContext };

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const BODY_LIMIT = 1048576; // 1 MB

export async function createMcpServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const host = options.host || DEFAULT_HOST;

  // Strict loopback binding security enforcement (SEC-003)
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `Security violation: MCP server must bind strictly to loopback (127.0.0.1), got "${host}"`
    );
  }

  // Register core MCP tools by default (MOD-02)
  registerCoreTools();

  const server = Fastify({
    bodyLimit: BODY_LIMIT,
    logger: false,
    trustProxy: false,
  });

  // Server-scoped SSE manager with custom heartbeat interval if specified
  const currentSseManager = new SseManager(options.heartbeatIntervalMs);

  const rateLimiter = new SlidingWindowRateLimiter(
    options.rateLimitMax ?? 60,
    options.rateLimitWindowMs ?? 60000
  );

  // Measure response duration and emit X-Response-Time header
  server.addHook('onRequest', async (request: FastifyRequest) => {
    (request.raw as unknown as { __startTime: bigint }).__startTime = process.hrtime.bigint();
  });

  server.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawReq = request.raw as unknown as { __startTime?: bigint };
    if (rawReq.__startTime) {
      const elapsedNs = process.hrtime.bigint() - rawReq.__startTime;
      const elapsedMs = Number(elapsedNs) / 1_000_000;
      reply.header('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
    }
  });

  // Strict CORS configuration
  await server.register(cors, {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Session-Id', 'X-Request-Id'],
  });

  // Custom Error Handler for JSON-RPC compliance
  server.setErrorHandler((error, request, reply) => {
    // Payload exceeds 1MB limit (Fastify 413)
    if (error.statusCode === 413 || error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.status(413).send({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid Request: Payload exceeds 1MB ceiling',
        },
      });
    }

    // JSON syntax error (Parse error -32700)
    if (error.statusCode === 400 || error instanceof SyntaxError || error.name === 'SyntaxError') {
      return reply.status(200).send({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: Invalid JSON syntax',
        },
      });
    }

    // Fallback internal error
    return reply.status(200).send({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`,
      },
    });
  });

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', server: 'aura-mcp-server', version: '1.0.0' };
  });

  // JSON-RPC 2.0 POST Endpoint
  server.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientIp = request.ip || '127.0.0.1';

    // 1. Sliding-window rate limit check
    const rateCheck = rateLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      return reply.status(429).send({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Too Many Requests: Rate limit exceeded (60 req/min)',
        },
      });
    }

    // 2. Request context extraction
    const sessionId =
      (request.headers['x-session-id'] as string) ||
      ((request.query as Record<string, string>)?.sessionId ?? undefined);
    const requestId =
      (request.headers['x-request-id'] as string) ||
      `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    const context: RequestContext = {
      sessionId,
      requestId,
      idempotencyKey,
      clientIp,
    };

    // 3. Mutating call idempotency handling
    const rawBody = request.body as Record<string, unknown> | undefined;
    const isMutating = rawBody?.method === 'tools/call';

    if (idempotencyKey && isMutating) {
      const response = await idempotencyManager.executeOrGetCached(idempotencyKey, async () => {
        return dispatchJsonRpc(request.body, context);
      });
      return reply.status(200).send(response);
    }

    // 4. Standard dispatch
    const response = await dispatchJsonRpc(request.body, context);
    return reply.status(200).send(response);
  });

  // SSE Stream GET Endpoint
  server.get('/mcp/events', async (request: FastifyRequest, reply: FastifyReply) => {
    currentSseManager.handleConnection(request, reply);
  });

  server.decorate('sseManager', currentSseManager);
  server.decorate('rateLimiter', rateLimiter);

  return server;
}

export async function startMcpServer(
  options: ServerOptions = {}
): Promise<{ server: FastifyInstance; address: string }> {
  const server = await createMcpServer(options);
  const port = options.port ?? (Number(process.env.PORT) || DEFAULT_PORT);
  const host = options.host || DEFAULT_HOST;

  const address = await server.listen({ port, host });
  return { server, address };
}

export async function stopMcpServer(server: FastifyInstance): Promise<void> {
  // 1. Close active SSE streaming subscribers for this server
  const sse = (server as unknown as { sseManager?: SseManager }).sseManager;
  if (sse) {
    sse.closeAll();
  } else {
    sseManager.closeAll();
  }

  // 2. Close Fastify HTTP server cleanly
  await server.close();
}

// Direct execution entry point
if (process.env.NODE_ENV !== 'test' && (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.ts'))) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  startMcpServer({ port })
    .then(({ address }) => {
      console.log(`[Aura+ MCP Server] Running at ${address}`);

      const shutdown = async () => {
        console.log('[Aura+ MCP Server] Graceful shutdown initiated...');
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((err) => {
      console.error('[Aura+ MCP Server] Failed to start:', err);
      process.exit(1);
    });
}
