/**
 * Resilient Server-Sent Events (SSE) Client
 * Connects to /mcp/events with exponential backoff reconnection (1s, 2s, 4s per NFR-005)
 */

export type SseConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface SseClientOptions {
  url?: string;
  sessionId: string;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffFactor?: number;
  maxRetries?: number;
  eventSourceFactory?: (url: string) => EventSource;
  onConnectionChange?: (status: SseConnectionStatus) => void;
  onWidget?: (data: { widgetType: string; title: string; payload: Record<string, unknown> }) => void;
  onNotification?: (data: unknown) => void;
  onError?: (error: unknown) => void;
  onRawMessage?: (event: MessageEvent) => void;
}

export class SseClient {
  private url: string;
  private sessionId: string;
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private isExplicitlyClosed = false;

  public readonly initialBackoffMs: number;
  public readonly maxBackoffMs: number;
  public readonly backoffFactor: number;
  public readonly maxRetries: number;
  private eventSourceFactory: (url: string) => EventSource;

  private onConnectionChange?: (status: SseConnectionStatus) => void;
  private onWidget?: (data: { widgetType: string; title: string; payload: Record<string, unknown> }) => void;
  private onNotification?: (data: unknown) => void;
  private onError?: (error: unknown) => void;
  private onRawMessage?: (event: MessageEvent) => void;

  constructor(options: SseClientOptions) {
    this.url = options.url || '/mcp/events';
    this.sessionId = options.sessionId;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 4000;
    this.backoffFactor = options.backoffFactor ?? 2;
    this.maxRetries = options.maxRetries ?? 10;
    this.eventSourceFactory = options.eventSourceFactory || ((url: string) => new EventSource(url));

    this.onConnectionChange = options.onConnectionChange;
    this.onWidget = options.onWidget;
    this.onNotification = options.onNotification;
    this.onError = options.onError;
    this.onRawMessage = options.onRawMessage;
  }

  public getRetryCount(): number {
    return this.retryCount;
  }

  public getNextBackoffDelay(): number {
    // 1s, 2s, 4s capped at maxBackoffMs
    const delay = this.initialBackoffMs * Math.pow(this.backoffFactor, this.retryCount);
    return Math.min(delay, this.maxBackoffMs);
  }

  public connect(): void {
    if (this.isExplicitlyClosed) {
      this.isExplicitlyClosed = false;
    }

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // ignore
      }
      this.eventSource = null;
    }

    const fullUrl = this.url.includes('?')
      ? `${this.url}&sessionId=${encodeURIComponent(this.sessionId)}`
      : `${this.url}?sessionId=${encodeURIComponent(this.sessionId)}`;

    try {
      this.eventSource = this.eventSourceFactory(fullUrl);

      this.eventSource.onopen = () => {
        this.retryCount = 0;
        this.onConnectionChange?.('connected');
      };

      this.eventSource.onerror = (err) => {
        this.onError?.(err);
        if (this.isExplicitlyClosed) return;

        this.onConnectionChange?.('reconnecting');
        this.scheduleReconnect();
      };

      // Listen for custom widget events
      this.eventSource.addEventListener('widget', (event: MessageEvent) => {
        this.onRawMessage?.(event);
        try {
          const parsed = JSON.parse(event.data);
          this.onWidget?.(parsed);
        } catch {
          // ignore
        }
      });

      // Listen for notification events
      this.eventSource.addEventListener('notification', (event: MessageEvent) => {
        this.onRawMessage?.(event);
        try {
          const parsed = JSON.parse(event.data);
          this.onNotification?.(parsed);
        } catch {
          // ignore
        }
      });

      // Generic message listener
      this.eventSource.onmessage = (event: MessageEvent) => {
        this.onRawMessage?.(event);
      };
    } catch (err) {
      this.onError?.(err);
      this.scheduleReconnect();
    }
  }

  public scheduleReconnect(): void {
    if (this.isExplicitlyClosed) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const delay = this.getNextBackoffDelay();
    this.retryCount++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // ignore
      }
      this.eventSource = null;
    }
    this.onConnectionChange?.('offline');
  }

  public resetRetry(): void {
    this.retryCount = 0;
  }
}
