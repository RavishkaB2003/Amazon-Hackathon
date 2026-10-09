/**
 * In-memory Idempotency Store for JSON-RPC Operations
 * Caches responses by Idempotency-Key for 300 seconds TTL.
 */

import type { JsonRpcResponse } from '../../shared/types/mcp';

export interface IdempotencyRecord {
  key: string;
  response: JsonRpcResponse;
  expiresAt: number;
}

export class IdempotencyManager {
  private cache = new Map<string, IdempotencyRecord>();
  private inFlight = new Map<string, Promise<JsonRpcResponse>>();
  private readonly defaultTtlMs = 300000; // 300 seconds

  constructor(private readonly ttlMs: number = 300000) {}

  get(key: string): JsonRpcResponse | undefined {
    this.evictExpired();
    const record = this.cache.get(key);
    if (!record) {
      return undefined;
    }
    if (Date.now() > record.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return record.response;
  }

  set(key: string, response: JsonRpcResponse): void {
    this.cache.set(key, {
      key,
      response,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  async executeOrGetCached(
    key: string,
    executor: () => Promise<JsonRpcResponse>
  ): Promise<JsonRpcResponse> {
    // 1. Check existing cached response
    const cached = this.get(key);
    if (cached) {
      return cached;
    }

    // 2. Check if identical request is already in-flight
    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // 3. Execute and store in-flight promise
    const executionPromise = (async () => {
      try {
        const response = await executor();
        this.set(key, response);
        return response;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, executionPromise);
    return executionPromise;
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const idempotencyManager = new IdempotencyManager();
