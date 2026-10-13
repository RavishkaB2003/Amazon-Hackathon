/**
 * Aura+ Bounded In-Memory Wire Diagnostics Ring Buffer
 * Circular FIFO buffer capturing JSON-RPC 2.0 & SSE protocol traces (FR-019, OPS-002)
 */

import type {
  WireLogEntry,
  WireLogFilter,
  WireLogResponse,
  WireDirection,
  WireMessageType,
} from '../../shared/types/diagnostics';
import { piiScrubber, scrubUuids } from './pii-scrubber';

export const DEFAULT_BUFFER_CAPACITY = 100;
export const MAX_PAYLOAD_BYTES = 16 * 1024; // 16 KB per frame ceiling

export interface PushWireEntryInput {
  id?: string;
  timestamp?: string;
  timestampNs?: bigint | string | number;
  direction: WireDirection;
  type: WireMessageType;
  method?: string;
  sessionId?: string;
  statusCode?: number;
  durationMs?: number;
  payloadBytes?: number;
  payload: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  latencyMs?: number;
}

export class RingBuffer {
  private readonly capacity: number;
  private readonly buffer: WireLogEntry[];
  private sequence = 0;

  constructor(capacity = DEFAULT_BUFFER_CAPACITY) {
    this.capacity = Math.max(1, capacity);
    this.buffer = [];
  }

  /**
   * Pushes a new wire entry into the circular buffer.
   * Enforces 16KB truncation, high-res timestamps, PII scrubbing, and FIFO eviction.
   */
  public push(input: PushWireEntryInput): WireLogEntry {
    this.sequence++;
    const nowIso = input.timestamp || new Date().toISOString();
    const nowNs =
      input.timestampNs !== undefined
        ? input.timestampNs
        : process.hrtime.bigint();

    const id = input.id || `wire-${Date.now()}-${this.sequence}`;

    // 1. Scrub session identifier if present
    const scrubbedSessionId = input.sessionId
      ? scrubUuids(input.sessionId)
      : undefined;

    // 2. Measure & truncate payload safely
    let rawPayloadBytes = input.payloadBytes;
    let payloadToStore = input.payload;

    try {
      const serialized = JSON.stringify(input.payload);
      const measuredBytes = Buffer.byteLength(serialized, 'utf8');
      if (rawPayloadBytes === undefined || rawPayloadBytes <= 0) {
        rawPayloadBytes = measuredBytes;
      }

      if (measuredBytes > MAX_PAYLOAD_BYTES) {
        // Truncate payload to keep within 16KB limit
        const previewStr = serialized.slice(0, 1024);
        payloadToStore = {
          _truncated: true,
          originalBytes: measuredBytes,
          preview: previewStr + '... [TRUNCATED: payload exceeds 16KB ceiling]',
        };
      }
    } catch {
      rawPayloadBytes = rawPayloadBytes || 0;
    }

    // 3. Scrub payload for PII, PAN, credentials
    const scrubbedPayload = piiScrubber.scrubObject(payloadToStore);

    const entry: WireLogEntry = {
      id,
      timestamp: nowIso,
      timestampNs: nowNs,
      direction: input.direction,
      type: input.type,
      method: input.method,
      sessionId: scrubbedSessionId,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      payloadBytes: rawPayloadBytes || 0,
      payload: scrubbedPayload,
      error: input.error,
      latencyMs: input.latencyMs ?? input.durationMs,
    };

    // 4. FIFO Eviction: if at capacity, drop oldest entry (index 0)
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }

    this.buffer.push(entry);
    return entry;
  }

  /**
   * Queries and filters active wire entries with pagination support
   */
  public query(filter: WireLogFilter = {}): WireLogResponse {
    const total = this.buffer.length;

    const directionFilter = filter.direction || 'ALL';
    const typeFilter = filter.type || 'ALL';
    const statusFilter = filter.status || 'ALL';
    const limit = Math.min(100, Math.max(1, filter.limit ?? 50));
    const offset = Math.max(0, filter.offset ?? 0);

    const filtered = this.buffer.filter((entry) => {
      // 1. Direction Filter
      if (directionFilter !== 'ALL' && entry.direction !== directionFilter) {
        return false;
      }

      // 2. Type Filter
      if (typeFilter !== 'ALL' && entry.type !== typeFilter) {
        return false;
      }

      // 3. Session Filter (supports partial matching or synthetic token matching)
      if (filter.sessionId) {
        const targetSession = scrubUuids(filter.sessionId);
        if (!entry.sessionId || !entry.sessionId.includes(targetSession)) {
          return false;
        }
      }

      // 4. Method Filter
      if (filter.method) {
        if (!entry.method || !entry.method.toLowerCase().includes(filter.method.toLowerCase())) {
          return false;
        }
      }

      // 5. Status Filter
      if (statusFilter === 'SUCCESS') {
        const isError =
          Boolean(entry.error) ||
          (entry.statusCode !== undefined && entry.statusCode >= 400);
        if (isError) return false;
      } else if (statusFilter === 'ERROR') {
        const isError =
          Boolean(entry.error) ||
          (entry.statusCode !== undefined && entry.statusCode >= 400);
        if (!isError) return false;
      }

      return true;
    });

    const paginated = filtered.slice(offset, offset + limit);

    const serializedEntries = paginated.map((entry) => ({
      ...entry,
      timestampNs:
        typeof entry.timestampNs === 'bigint'
          ? entry.timestampNs.toString()
          : entry.timestampNs,
    }));

    return {
      total,
      filtered: filtered.length,
      limit,
      offset,
      entries: serializedEntries,
    };
  }

  /**
   * Clears all entries from the buffer idempotently
   */
  public clear(): { cleared: boolean; previousCount: number; timestamp: string } {
    const previousCount = this.buffer.length;
    this.buffer.length = 0;
    return {
      cleared: true,
      previousCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Current number of entries stored
   */
  public size(): number {
    return this.buffer.length;
  }

  /**
   * Capacity ceiling of the buffer
   */
  public getCapacity(): number {
    return this.capacity;
  }

  /**
   * Returns shallow clone of all entries (oldest to newest)
   */
  public getAll(): WireLogEntry[] {
    return [...this.buffer];
  }
}

// Global Singleton Instance (CTRL-19)
export const wireRingBuffer = new RingBuffer(DEFAULT_BUFFER_CAPACITY);
