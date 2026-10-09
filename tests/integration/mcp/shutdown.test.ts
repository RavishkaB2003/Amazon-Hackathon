import { describe, it, expect } from 'vitest';
import http from 'node:http';
import {
  startMcpServer,
  stopMcpServer,
  getActiveSseSubscriberCount,
} from '../../../src/server';

describe('Server Graceful Shutdown & Memory Footprint (Integration)', () => {
  it('terminates open connections and shuts down cleanly in under 3 seconds', async () => {
    const testPort = 3104;
    const { server } = await startMcpServer({
      port: testPort,
      host: '127.0.0.1',
      heartbeatIntervalMs: 500,
    });

    // Establish an active SSE connection
    let clientDisconnected = false;
    const req = http.get({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/mcp/events',
    }, (res) => {
      res.on('close', () => {
        clientDisconnected = true;
      });
    });

    req.on('error', () => {
      // Ignored when server closes
    });

    // Wait briefly for connection registration
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(getActiveSseSubscriberCount()).toBeGreaterThanOrEqual(1);

    // Measure shutdown duration
    const startTime = Date.now();
    await stopMcpServer(server);
    const shutdownDurationMs = Date.now() - startTime;

    // Shutdown must complete in under 3000ms (NFR-004 & MOD-01 requirement)
    expect(shutdownDurationMs).toBeLessThan(3000);

    // SSE subscribers must be cleared
    expect(getActiveSseSubscriberCount()).toBe(0);

    // Verify process memory footprint is bounded under 150MB RSS (NFR-004)
    const memUsage = process.memoryUsage();
    const rssMb = memUsage.rss / (1024 * 1024);
    expect(rssMb).toBeLessThan(150);
  });
});
