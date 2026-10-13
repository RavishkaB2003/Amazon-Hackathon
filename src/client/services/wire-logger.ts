/**
 * Aura+ Client-side Wire Diagnostics Service
 * Client telemetry logging, wire diagnostics fetching, and friction log exporter (MOD-05)
 */

import type {
  WireLogEntry,
  WireLogFilter,
  WireLogResponse,
  FrictionEntry,
  FrictionLogExport,
} from '../../shared/types/diagnostics';

const API_BASE = ''; // Uses Vite proxy in development or same-origin in production

export class WireLoggerService {
  private localEntries: WireLogEntry[] = [];
  private listeners: ((entries: WireLogEntry[]) => void)[] = [];

  /**
   * Logs a local client-side event into memory and notifies subscribers
   */
  public logClientEvent(
    entry: Partial<WireLogEntry> & {
      direction: 'INCOMING' | 'OUTGOING' | 'SSE_EVENT';
      type: 'JSON_RPC' | 'SSE' | 'SYSTEM' | 'HTTP';
      payload: unknown;
    }
  ): WireLogEntry {
    const fullEntry: WireLogEntry = {
      id: entry.id || `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      direction: entry.direction,
      type: entry.type,
      method: entry.method,
      sessionId: entry.sessionId,
      statusCode: entry.statusCode,
      durationMs: entry.durationMs,
      payloadBytes: entry.payloadBytes || 0,
      payload: entry.payload,
      error: entry.error,
      latencyMs: entry.latencyMs ?? entry.durationMs,
    };

    this.localEntries.push(fullEntry);
    this.notifyListeners();
    return fullEntry;
  }

  /**
   * Fetches wire diagnostics from the backend Fastify server
   */
  public async fetchWireDiagnostics(filter: WireLogFilter = {}): Promise<WireLogResponse> {
    const params = new URLSearchParams();

    if (filter.direction && filter.direction !== 'ALL') {
      params.set('direction', filter.direction);
    }
    if (filter.type && filter.type !== 'ALL') {
      params.set('type', filter.type);
    }
    if (filter.status && filter.status !== 'ALL') {
      params.set('status', filter.status);
    }
    if (filter.sessionId) {
      params.set('sessionId', filter.sessionId);
    }
    if (filter.method) {
      params.set('method', filter.method);
    }
    if (filter.limit !== undefined) {
      params.set('limit', String(filter.limit));
    }
    if (filter.offset !== undefined) {
      params.set('offset', String(filter.offset));
    }

    const url = `${API_BASE}/api/diagnostics/wire${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch wire diagnostics: ${response.statusText}`);
    }

    return (await response.json()) as WireLogResponse;
  }

  /**
   * Clears backend in-memory wire buffer
   */
  public async clearWireDiagnostics(): Promise<{ cleared: boolean; previousCount: number; timestamp: string }> {
    const response = await fetch(`${API_BASE}/api/diagnostics/wire`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to clear wire buffer: ${response.statusText}`);
    }

    this.localEntries = [];
    this.notifyListeners();

    return (await response.json()) as {
      cleared: boolean;
      previousCount: number;
      timestamp: string;
    };
  }

  /**
   * Fetches friction log in markdown or json format
   */
  public async fetchFrictionLog(format: 'markdown' | 'json' = 'markdown'): Promise<string | FrictionLogExport> {
    const response = await fetch(`${API_BASE}/api/diagnostics/friction-log?format=${format}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch friction log: ${response.statusText}`);
    }

    if (format === 'json') {
      return (await response.json()) as FrictionLogExport;
    }

    return await response.text();
  }

  /**
   * Triggers browser download of FRICTION_LOG.md
   */
  public async downloadFrictionLog(): Promise<void> {
    const markdown = (await this.fetchFrictionLog('markdown')) as string;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'FRICTION_LOG.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Records a developer friction entry at runtime
   */
  public async recordFriction(
    entry: Omit<FrictionEntry, 'id' | 'timestamp'>
  ): Promise<{ id: string; recorded: boolean; totalEntries: number }> {
    const response = await fetch(`${API_BASE}/api/diagnostics/friction-log/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      throw new Error(`Failed to record friction: ${response.statusText}`);
    }

    return (await response.json()) as {
      id: string;
      recorded: boolean;
      totalEntries: number;
    };
  }

  /**
   * Fetches system diagnostics summary
   */
  public async fetchSummary(): Promise<Record<string, unknown>> {
    const response = await fetch(`${API_BASE}/api/diagnostics/summary`);
    if (!response.ok) {
      throw new Error(`Failed to fetch summary: ${response.statusText}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  public subscribe(listener: (entries: WireLogEntry[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    const copy = [...this.localEntries];
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch {
        // ignore subscriber error
      }
    });
  }
}

export const wireLogger = new WireLoggerService();
