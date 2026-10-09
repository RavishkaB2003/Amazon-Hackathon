# Aura+

Aura+ is an ambient, multimodal context-aware assistant engine designed for smart displays and ambient computing devices. Built with a high-performance Fastify architecture, Model Context Protocol (MCP) transport, and real-time Server-Sent Events (SSE) streaming.

## Features

- **MCP Protocol Server**: High-throughput JSON-RPC 2.0 protocol endpoint (`POST /mcp`) supporting standard MCP methods (`initialize`, `ping`, `tools/list`, `tools/call`).
- **Real-Time SSE Transport**: Server-Sent Events connection streaming (`GET /mcp/events`) with automatic client keep-alive and event dispatch.
- **Security Guardrails**:
  - Strict loopback binding (`127.0.0.1`).
  - Strict CORS origin allowlisting (`http://localhost:5173`).
  - 1MB payload ceiling protection (`HTTP 413`).
  - Sliding-window rate limiting (60 req/min, `HTTP 429`).
- **Idempotency & Deduplication**: Safe mutation replay caching using `Idempotency-Key` headers.
- **Low-Latency Wire Protocol**: Sub-millisecond server processing overhead (`X-Response-Time` < 1ms).

## Getting Started

### Prerequisites

- Node.js v20+ or v22+
- npm v10+

### Installation

```bash
npm install
```

### Running the Server

Start the local MCP server on `http://127.0.0.1:3000`:

```bash
npm start
```

### Running Tests

Execute the automated test suite powered by Vitest:

```bash
# Run all unit and integration tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Typecheck TypeScript
npm run typecheck
```

## Project Structure

```text
├── src/
│   ├── server/
│   │   ├── index.ts               # Fastify server entry point & configuration
│   │   ├── mcp/
│   │   │   ├── registry.ts        # In-memory tool registration catalog
│   │   │   └── router.ts          # JSON-RPC 2.0 request router & validator
│   │   └── transport/
│   │       ├── idempotency.ts     # Idempotency-Key caching & deduplication
│   │       ├── rate-limiter.ts    # Sliding-window rate limiting
│   │       └── sse.ts             # Server-Sent Events stream manager
│   └── shared/
│       └── types/
│           └── mcp.ts             # TypeScript protocol definitions & schemas
├── tests/
│   ├── unit/                      # Unit test suites (protocol, validation, rate limiting)
│   └── integration/               # Integration test suites (HTTP, SSE, API matrix, shutdown)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## License

MIT
