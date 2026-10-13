import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SseClient } from '../../../src/client/services/sse-client';

describe('CHK-MOD-04-SSE-RECONNECT: Resilient SSE Client Reconnection (NFR-005)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates exponential backoff delays (1s, 2s, 4s capped at maxBackoffMs)', () => {
    const client = new SseClient({
      sessionId: 'test-session-1',
      initialBackoffMs: 1000,
      maxBackoffMs: 4000,
      backoffFactor: 2,
    });

    // Attempt 0: 1000ms
    expect(client.getNextBackoffDelay()).toBe(1000);

    // Trigger scheduleReconnect (advances retry count)
    client.scheduleReconnect();
    expect(client.getRetryCount()).toBe(1);

    // Attempt 1: 2000ms
    expect(client.getNextBackoffDelay()).toBe(2000);

    client.scheduleReconnect();
    expect(client.getRetryCount()).toBe(2);

    // Attempt 2: 4000ms
    expect(client.getNextBackoffDelay()).toBe(4000);

    client.scheduleReconnect();
    expect(client.getRetryCount()).toBe(3);

    // Attempt 3+: capped at 4000ms
    expect(client.getNextBackoffDelay()).toBe(4000);
  });

  it('reconnects automatically with backoff timer on error', () => {
    const mockEventSource = {
      close: vi.fn(),
      addEventListener: vi.fn(),
      onopen: null as unknown,
      onerror: null as unknown,
      onmessage: null as unknown,
    };

    const mockFactory = vi.fn().mockReturnValue(mockEventSource);
    const onConnectionChange = vi.fn();

    const client = new SseClient({
      sessionId: 'test-session-2',
      eventSourceFactory: mockFactory as unknown as (url: string) => EventSource,
      onConnectionChange,
    });

    client.connect();
    expect(mockFactory).toHaveBeenCalledTimes(1);

    // Simulate error triggering reconnect
    if (typeof mockEventSource.onerror === 'function') {
      (mockEventSource.onerror as Function)(new Error('Connection dropped'));
    }

    expect(onConnectionChange).toHaveBeenCalledWith('reconnecting');
    expect(client.getRetryCount()).toBe(1);

    // Advance 1s -> should trigger reconnect
    vi.advanceTimersByTime(1000);
    expect(mockFactory).toHaveBeenCalledTimes(2);

    // Simulate open on reconnection -> resets retry count
    if (typeof mockEventSource.onopen === 'function') {
      (mockEventSource.onopen as Function)();
    }
    expect(client.getRetryCount()).toBe(0);
    expect(onConnectionChange).toHaveBeenCalledWith('connected');
  });

  it('stops reconnecting and cleans up when disconnect() is called', () => {
    const mockEventSource = {
      close: vi.fn(),
      addEventListener: vi.fn(),
      onopen: null,
      onerror: null,
      onmessage: null,
    };

    const mockFactory = vi.fn().mockReturnValue(mockEventSource);
    const onConnectionChange = vi.fn();

    const client = new SseClient({
      sessionId: 'test-session-3',
      eventSourceFactory: mockFactory as unknown as (url: string) => EventSource,
      onConnectionChange,
    });

    client.connect();
    client.disconnect();

    expect(mockEventSource.close).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).toHaveBeenCalledWith('offline');

    // Triggering scheduleReconnect after disconnect does not reconnect
    client.scheduleReconnect();
    vi.advanceTimersByTime(10000);
    expect(mockFactory).toHaveBeenCalledTimes(1);
  });
});
