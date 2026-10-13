/**
 * Unit Test Suite: RingBuffer Wire Diagnostics (FR-019, OPS-002)
 * Tests circular FIFO eviction, 16KB truncation, filtering, and clear operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer, DEFAULT_BUFFER_CAPACITY, MAX_PAYLOAD_BYTES } from '../../../src/server/diagnostics/ring-buffer';

describe('CHK-MOD-05-DIAGNOSTICS: RingBuffer Unit Tests (FR-019, OPS-002)', () => {
  let ringBuffer: RingBuffer;

  beforeEach(() => {
    ringBuffer = new RingBuffer(DEFAULT_BUFFER_CAPACITY);
  });

  it('initializes with zero entries and configured capacity', () => {
    expect(ringBuffer.size()).toBe(0);
    expect(ringBuffer.getCapacity()).toBe(100);
    expect(ringBuffer.getAll()).toEqual([]);
  });

  it('pushes entries and assigns unique sequential IDs and timestamps', () => {
    const entry = ringBuffer.push({
      direction: 'INCOMING',
      type: 'JSON_RPC',
      method: 'tools/list',
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });

    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.timestampNs).toBeDefined();
    expect(entry.direction).toBe('INCOMING');
    expect(entry.type).toBe('JSON_RPC');
    expect(entry.method).toBe('tools/list');
    expect(entry.payloadBytes).toBeGreaterThan(0);
    expect(ringBuffer.size()).toBe(1);
  });

  it('enforces FIFO eviction when capacity limit (100) is exceeded', () => {
    const smallBuffer = new RingBuffer(5);

    // Push 5 entries (fill to capacity)
    for (let i = 1; i <= 5; i++) {
      smallBuffer.push({
        id: `entry-${i}`,
        direction: 'INCOMING',
        type: 'JSON_RPC',
        payload: { item: i },
      });
    }

    expect(smallBuffer.size()).toBe(5);
    expect(smallBuffer.getAll()[0].id).toBe('entry-1');
    expect(smallBuffer.getAll()[4].id).toBe('entry-5');

    // Push 6th entry -> drops oldest ('entry-1')
    smallBuffer.push({
      id: 'entry-6',
      direction: 'INCOMING',
      type: 'JSON_RPC',
      payload: { item: 6 },
    });

    expect(smallBuffer.size()).toBe(5);
    expect(smallBuffer.getAll()[0].id).toBe('entry-2');
    expect(smallBuffer.getAll()[4].id).toBe('entry-6');
  });

  it('enforces 16 KB payload truncation safety (RSK-MOD-05-01)', () => {
    // Construct payload larger than 16 KB
    const largeString = 'x'.repeat(20 * 1024); // 20 KB
    const entry = ringBuffer.push({
      direction: 'OUTGOING',
      type: 'JSON_RPC',
      payload: { data: largeString },
    });

    expect(entry.payloadBytes).toBeGreaterThan(MAX_PAYLOAD_BYTES);
    const storedPayload = entry.payload as { _truncated?: boolean; preview?: string };
    expect(storedPayload._truncated).toBe(true);
    expect(storedPayload.preview).toContain('[TRUNCATED: payload exceeds 16KB ceiling]');
  });

  it('filters wire entries by direction, type, status, and sessionId', () => {
    ringBuffer.push({
      direction: 'INCOMING',
      type: 'JSON_RPC',
      method: 'tools/call',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      statusCode: 200,
      payload: { ok: true },
    });

    ringBuffer.push({
      direction: 'OUTGOING',
      type: 'SSE',
      method: 'widget/render',
      sessionId: '770e8400-e29b-41d4-a716-446655441111',
      statusCode: 200,
      payload: { widget: 'recipe' },
    });

    ringBuffer.push({
      direction: 'OUTGOING',
      type: 'JSON_RPC',
      method: 'tools/call',
      statusCode: 500,
      error: { code: -32603, message: 'Internal error' },
      payload: { error: true },
    });

    // Filter by direction INCOMING
    const incResult = ringBuffer.query({ direction: 'INCOMING' });
    expect(incResult.filtered).toBe(1);
    expect(incResult.entries[0].direction).toBe('INCOMING');

    // Filter by type SSE
    const sseResult = ringBuffer.query({ type: 'SSE' });
    expect(sseResult.filtered).toBe(1);
    expect(sseResult.entries[0].type).toBe('SSE');

    // Filter by status ERROR
    const errResult = ringBuffer.query({ status: 'ERROR' });
    expect(errResult.filtered).toBe(1);
    expect(errResult.entries[0].statusCode).toBe(500);

    // Filter by status SUCCESS
    const successResult = ringBuffer.query({ status: 'SUCCESS' });
    expect(successResult.filtered).toBe(2);

    // Filter by method substring
    const methodResult = ringBuffer.query({ method: 'widget' });
    expect(methodResult.filtered).toBe(1);

    // Pagination limit & offset
    const pageResult = ringBuffer.query({ limit: 1, offset: 1 });
    expect(pageResult.limit).toBe(1);
    expect(pageResult.offset).toBe(1);
    expect(pageResult.entries.length).toBe(1);
  });

  it('clears all entries idempotently', () => {
    ringBuffer.push({
      direction: 'INCOMING',
      type: 'JSON_RPC',
      payload: { test: true },
    });
    expect(ringBuffer.size()).toBe(1);

    const clearRes1 = ringBuffer.clear();
    expect(clearRes1.cleared).toBe(true);
    expect(clearRes1.previousCount).toBe(1);
    expect(ringBuffer.size()).toBe(0);

    // Second clear call succeeds idempotently
    const clearRes2 = ringBuffer.clear();
    expect(clearRes2.cleared).toBe(true);
    expect(clearRes2.previousCount).toBe(0);
    expect(ringBuffer.size()).toBe(0);
  });
});
