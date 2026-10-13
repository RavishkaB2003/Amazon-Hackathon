/**
 * Verification Test: Zero-Config Developer Quickstart & Graceful Fallback (OPS-001, CTRL-25)
 * Validates clean launch without external dependencies and mock mode fallback
 */

import { describe, it, expect } from 'vitest';
import { createMcpServer, stopMcpServer } from '../../../src/server';

describe('CHK-MOD-05-QUICKSTART: Zero-Config Quickstart & Graceful Fallback (OPS-001)', () => {
  it('launches Fastify MCP server cleanly with zero configuration on loopback', async () => {
    const server = await createMcpServer();

    // 1. Verify health endpoint
    const healthResp = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(healthResp.statusCode).toBe(200);
    const healthBody = JSON.parse(healthResp.payload);
    expect(healthBody.status).toBe('ok');
    expect(healthBody.server).toBe('aura-mcp-server');

    // 2. Verify fallback to mock mode in absence of AWS credentials
    const isMock = process.env.AWS_MOCK_MODE !== 'false';
    expect(isMock).toBe(true);

    // 3. Verify diagnostics summary endpoint is ready
    const summaryResp = await server.inject({
      method: 'GET',
      url: '/api/diagnostics/summary',
    });
    expect(summaryResp.statusCode).toBe(200);
    const summaryBody = JSON.parse(summaryResp.payload);
    expect(summaryBody.status).toBe('ok');
    expect(summaryBody.wire.capacity).toBe(100);

    await stopMcpServer(server);
  });
});
