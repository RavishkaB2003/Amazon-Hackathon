import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { FastifyInstance } from 'fastify';
import {
  startMcpServer,
  stopMcpServer,
  broadcastSseEvent,
  getActiveSseSubscriberCount,
} from '../../../src/server';
import { sseManager } from '../../../src/server/transport/sse';

describe('Server-Sent Events (SSE) Transport Integration (Real Socket)', () => {
  let server: FastifyInstance;
  const testPort = 3102;

  beforeAll(async () => {
    // Start server with 200ms heartbeat interval for testing
    const started = await startMcpServer({
      port: testPort,
      host: '127.0.0.1',
      heartbeatIntervalMs: 200,
    });
    server = started.server;
  });

  afterAll(async () => {
    if (server) {
      await stopMcpServer(server);
    }
  });

  it('establishes SSE stream with correct headers, receives initial frame and heartbeats', async () => {
    return new Promise<void>((resolve, reject) => {
      const chunks: string[] = [];
      let req: http.ClientRequest | null = null;

      req = http.get(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path: '/mcp/events?sessionId=sess-test-1',
          headers: {
            Accept: 'text/event-stream',
          },
        },
        (res) => {
          try {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toBe('text/event-stream');
            expect(res.headers['cache-control']).toBe('no-cache, no-transform');
            expect(res.headers['connection']).toBe('keep-alive');
            expect(res.headers['x-accel-buffering']).toBe('no');

            // Active subscribers should be registered
            expect(getActiveSseSubscriberCount()).toBeGreaterThanOrEqual(1);

            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              chunks.push(chunk);

              const allData = chunks.join('');
              // Verify initial connected frame
              if (allData.includes(': connected\n\n') && !allData.includes('test_event')) {
                // Broadcast an event once connected
                broadcastSseEvent({
                  event: 'message',
                  data: {
                    jsonrpc: '2.0',
                    method: 'notifications/message',
                    params: { level: 'info', data: 'test_event' },
                  },
                });
              }

              // Check if we received both broadcast event and a heartbeat ping
              if (allData.includes('test_event') && allData.includes(': ping\n\n')) {
                req?.destroy();
              }
            });

            res.on('close', () => {
              // Wait briefly for disconnect event propagation
              setTimeout(() => {
                try {
                  const finalData = chunks.join('');
                  expect(finalData).toContain(': connected\n\n');
                  expect(finalData).toContain('notifications/message');
                  expect(finalData).toContain('test_event');
                  expect(finalData).toContain(': ping\n\n');
                  resolve();
                } catch (err) {
                  reject(err);
                }
              }, 50);
            });
          } catch (err) {
            req?.destroy();
            reject(err);
          }
        }
      );

      req.on('error', (err) => {
        // Destroy error is expected upon socket close
        if ((err as { code?: string }).code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
  });

  it('unregisters client and decrements subscriber count upon client socket disconnect', async () => {
    const initialCount = getActiveSseSubscriberCount();

    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path: '/mcp/events?sessionId=sess-disconnect-test',
        },
        (res) => {
          expect(res.statusCode).toBe(200);

          // Connected, now abruptly destroy client socket
          setTimeout(() => {
            req.destroy();
          }, 50);

          res.on('close', () => {
            setTimeout(() => {
              try {
                expect(getActiveSseSubscriberCount()).toBe(initialCount);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, 50);
          });
        }
      );

      req.on('error', () => {
        // Expected on destroy
      });
    });
  });
});
