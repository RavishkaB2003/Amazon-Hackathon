/**
 * Integration Test Suite: Fastify Diagnostics API Routes (MOD-05)
 * Tests /api/diagnostics/wire, /api/diagnostics/friction-log, /api/diagnostics/summary
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMcpServer, stopMcpServer } from '../../../src/server';
import { wireRingBuffer } from '../../../src/server/diagnostics/ring-buffer';
import { frictionLogger } from '../../../src/server/diagnostics/friction-logger';

describe('CHK-MOD-05-DIAGNOSTICS & CHK-MOD-05-FRICTION: Fastify Diagnostics Routes', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createMcpServer();
    await server.ready();
  });

  afterAll(async () => {
    await stopMcpServer(server);
  });

  beforeEach(() => {
    wireRingBuffer.clear();
    frictionLogger.resetToDefaults();
  });

  it('GET /api/diagnostics/wire returns filtered and paginated wire logs', async () => {
    // Seed test wire entries
    wireRingBuffer.push({
      direction: 'INCOMING',
      type: 'JSON_RPC',
      method: 'tools/list',
      payload: { id: 1 },
    });
    wireRingBuffer.push({
      direction: 'OUTGOING',
      type: 'JSON_RPC',
      method: 'tools/list',
      payload: { result: [] },
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/diagnostics/wire?direction=INCOMING',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.total).toBe(2);
    expect(body.filtered).toBe(1);
    expect(body.entries[0].direction).toBe('INCOMING');
    expect(body.entries[0].method).toBe('tools/list');
  });

  it('DELETE /api/diagnostics/wire clears in-memory ring buffer idempotently', async () => {
    wireRingBuffer.push({
      direction: 'INCOMING',
      type: 'JSON_RPC',
      payload: { test: true },
    });
    expect(wireRingBuffer.size()).toBe(1);

    const deleteResp = await server.inject({
      method: 'DELETE',
      url: '/api/diagnostics/wire',
    });

    expect(deleteResp.statusCode).toBe(200);
    const deleteBody = JSON.parse(deleteResp.payload);
    expect(deleteBody.cleared).toBe(true);
    expect(deleteBody.previousCount).toBe(1);
    expect(wireRingBuffer.size()).toBe(0);

    // Verify subsequent GET returns empty list
    const getResp = await server.inject({
      method: 'GET',
      url: '/api/diagnostics/wire',
    });
    const getBody = JSON.parse(getResp.payload);
    expect(getBody.total).toBe(0);
    expect(getBody.entries).toEqual([]);
  });

  it('GET /api/diagnostics/friction-log returns formatted markdown by default', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/diagnostics/friction-log',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/markdown');
    expect(response.payload).toContain('# Aura+ Developer Experience Friction Log');
    expect(response.payload).toContain('## Category Breakdown');
  });

  it('GET /api/diagnostics/friction-log?format=json returns structured JSON export', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/diagnostics/friction-log?format=json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const body = JSON.parse(response.payload);
    expect(body.project).toBe('Aura+ Multimodal Commerce Assistant');
    expect(body.totalEntries).toBeGreaterThanOrEqual(7);
    expect(body.entriesByCategory.BEDROCK_CONVERSE).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it('POST /api/diagnostics/friction-log/record appends runtime observation (201)', async () => {
    const payload = {
      category: 'FASTIFY_SSE',
      severity: 'MEDIUM',
      title: 'Heartbeat interval contention during testing',
      description: 'Test suites needed customized heartbeat interval to prevent teardown delay.',
      workaroundOrFix: 'Added configurable heartbeatIntervalMs in ServerOptions.',
      sdkVersion: '4.28.1',
      impactMinutes: 30,
      reproducible: true,
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/diagnostics/friction-log/record',
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.recorded).toBe(true);
    expect(body.id).toBeDefined();
    expect(body.totalEntries).toBeGreaterThanOrEqual(8);
  });

  it('POST /api/diagnostics/friction-log/record returns 400 on malformed input', async () => {
    const invalidPayload = {
      category: 'INVALID_CATEGORY',
      severity: 'SUPER_HIGH',
      title: 'Invalid',
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/diagnostics/friction-log/record',
      payload: invalidPayload,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toContain('Invalid friction log entry payload');
  });

  it('GET /api/diagnostics/summary returns system health, wire stats, memory RSS, and uptime', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/diagnostics/summary',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.wire).toBeDefined();
    expect(body.wire.capacity).toBe(100);
    expect(body.memory).toBeDefined();
    expect(body.memory.rssMb).toBeGreaterThan(0);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.mockMode).toBeDefined();
  });
});
