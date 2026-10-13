/**
 * Client API Service
 * Handles POST /agent/chat streaming, DELETE /agent/session/:id purge, and POST /mcp JSON-RPC tool calls
 */

import type { WireMessage } from '../types/ui';

export interface ChatStreamHandlers {
  onToken?: (text: string) => void;
  onToolCall?: (data: { toolName: string; toolUseId: string; input: Record<string, unknown> }) => void;
  onToolResult?: (data: { toolUseId: string; result: unknown }) => void;
  onWidget?: (data: { widgetType: string; title: string; payload: Record<string, unknown> }) => void;
  onDone?: (data: { spokenText: string; wordCount: number; fallbackTriggered: boolean }) => void;
  onError?: (err: Error) => void;
  onWireMessage?: (msg: WireMessage) => void;
}

export interface McpToolCallOptions {
  idempotencyKey?: string;
  ifMatchVersion?: number;
  sessionId?: string;
}

export interface McpToolCallResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

let messageCounter = 0;
function nextWireId(): string {
  messageCounter++;
  return `wire-${Date.now()}-${messageCounter}`;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Dispatches a streaming chat request to POST /agent/chat
   */
  public async sendChatStream(
    sessionId: string,
    message: string,
    persona?: 'alex' | 'elena' | 'marcus' | 'custom',
    handlers?: ChatStreamHandlers
  ): Promise<void> {
    const startTime = Date.now();
    const requestPayload = {
      sessionId,
      message,
      stream: true,
      persona,
    };

    // Log outgoing wire message
    handlers?.onWireMessage?.({
      id: nextWireId(),
      timestamp: new Date().toISOString(),
      direction: 'OUTGOING',
      type: 'SSE',
      method: 'POST /agent/chat',
      payload: requestPayload,
    });

    try {
      const response = await fetch(`${this.baseUrl}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`HTTP ${response.status}: ${errorText}`);
        handlers?.onError?.(err);
        handlers?.onWireMessage?.({
          id: nextWireId(),
          timestamp: new Date().toISOString(),
          direction: 'INCOMING',
          type: 'SYSTEM',
          method: 'HTTP Error',
          payload: { status: response.status, error: errorText },
          latencyMs: Date.now() - startTime,
        });
        return;
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.replace('event:', '').trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.replace('data:', '').trim();
            try {
              const data = JSON.parse(dataStr);

              handlers?.onWireMessage?.({
                id: nextWireId(),
                timestamp: new Date().toISOString(),
                direction: 'SSE_EVENT',
                type: 'SSE',
                method: currentEvent,
                payload: data,
                latencyMs: Date.now() - startTime,
              });

              if (currentEvent === 'token') {
                handlers?.onToken?.(data.text);
              } else if (currentEvent === 'tool_call') {
                handlers?.onToolCall?.(data);
              } else if (currentEvent === 'tool_result') {
                handlers?.onToolResult?.(data);
              } else if (currentEvent === 'widget') {
                handlers?.onWidget?.(data);
              } else if (currentEvent === 'done') {
                handlers?.onDone?.(data);
              } else if (currentEvent === 'error') {
                handlers?.onError?.(new Error(data.message));
              }
            } catch {
              // ignore parse errors on heartbeat comments
            }
          }
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      handlers?.onError?.(error);
      handlers?.onWireMessage?.({
        id: nextWireId(),
        timestamp: new Date().toISOString(),
        direction: 'INCOMING',
        type: 'SYSTEM',
        method: 'Network Error',
        payload: { error: error.message },
        latencyMs: Date.now() - startTime,
      });
    }
  }

  /**
   * Calls DELETE /agent/session/:sessionId to purge ephemeral session memory (PRIV-002)
   */
  public async clearSession(sessionId: string): Promise<{ cleared: boolean }> {
    const startTime = Date.now();
    const response = await fetch(`${this.baseUrl}/agent/session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear session: HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Calls GET /agent/session/:sessionId to fetch current ephemeral turn history
   */
  public async getSession(sessionId: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/agent/session/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get session: HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Calls POST /mcp for JSON-RPC 2.0 tool execution (e.g. manage_cart)
   */
  public async callMcpTool<T = unknown>(
    toolName: string,
    args: Record<string, unknown>,
    options?: McpToolCallOptions
  ): Promise<McpToolCallResponse<T>> {
    const startTime = Date.now();
    const rpcId = ++messageCounter;
    const rpcPayload = {
      jsonrpc: '2.0',
      id: rpcId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    if (options?.ifMatchVersion !== undefined) {
      headers['If-Match'] = String(options.ifMatchVersion);
    }
    if (options?.sessionId) {
      headers['X-Session-Id'] = options.sessionId;
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rpcPayload),
    });

    if (response.status === 409) {
      const errorJson = await response.json();
      return errorJson;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
