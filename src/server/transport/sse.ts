/**
 * Server-Sent Events (SSE) Transport Manager
 * Manages active streaming subscribers, periodic heartbeat pings, and disconnect cleanup.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { McpSseEvent } from '../../shared/types/mcp';

export interface SseSubscriber {
  id: string;
  sessionId?: string;
  reply: FastifyReply;
  connectedAt: number;
}

const activeManagers = new Set<SseManager>();

export class SseManager {
  private subscribers = new Map<string, SseSubscriber>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly defaultHeartbeatIntervalMs = 30000;

  constructor(heartbeatIntervalMs?: number) {
    activeManagers.add(this);
    this.startHeartbeat(heartbeatIntervalMs || this.defaultHeartbeatIntervalMs);
  }

  startHeartbeat(intervalMs: number): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
    // Don't keep event loop active if only heartbeat is waiting
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  sendHeartbeat(): void {
    const pingComment = ': ping\n\n';
    for (const [id, subscriber] of this.subscribers.entries()) {
      try {
        if (!subscriber.reply.raw.destroyed && !subscriber.reply.raw.writableEnded) {
          subscriber.reply.raw.write(pingComment);
        } else {
          this.removeSubscriber(id);
        }
      } catch {
        this.removeSubscriber(id);
      }
    }
  }

  handleConnection(request: FastifyRequest, reply: FastifyReply): void {
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const query = request.query as Record<string, string> | undefined;
    const sessionId =
      query?.sessionId ||
      (request.headers['x-session-id'] as string | undefined);

    // Set standard SSE response headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial comment/connect frame
    reply.raw.write(': connected\n\n');

    const subscriber: SseSubscriber = {
      id: clientId,
      sessionId,
      reply,
      connectedAt: Date.now(),
    };

    this.subscribers.set(clientId, subscriber);

    // Register cleanup listener on client socket close
    request.raw.on('close', () => {
      this.removeSubscriber(clientId);
    });
  }

  removeSubscriber(id: string): void {
    const sub = this.subscribers.get(id);
    if (sub) {
      this.subscribers.delete(id);
      try {
        if (!sub.reply.raw.writableEnded && !sub.reply.raw.destroyed) {
          sub.reply.raw.end();
        }
      } catch {
        // Ignored on close
      }
    }
  }

  broadcast(event: McpSseEvent, targetSessionId?: string): void {
    const lines: string[] = [];
    if (event.id) {
      lines.push(`id: ${event.id}`);
    }
    if (event.event) {
      lines.push(`event: ${event.event}`);
    }
    lines.push(`data: ${JSON.stringify(event.data)}`);
    const message = lines.join('\n') + '\n\n';
    for (const [id, subscriber] of this.subscribers.entries()) {
      // Strict unicast: when targetSessionId is specified, deliver only to subscribers with matching sessionId
      if (targetSessionId && subscriber.sessionId !== targetSessionId) {
        continue;
      }
      try {
        if (!subscriber.reply.raw.destroyed && !subscriber.reply.raw.writableEnded) {
          subscriber.reply.raw.write(message);
        } else {
          this.removeSubscriber(id);
        }
      } catch {
        this.removeSubscriber(id);
      }
    }
  }

  getActiveSubscriberCount(): number {
    return this.subscribers.size;
  }

  closeAll(): void {
    this.stopHeartbeat();
    activeManagers.delete(this);
    for (const [id, subscriber] of this.subscribers.entries()) {
      try {
        if (!subscriber.reply.raw.writableEnded && !subscriber.reply.raw.destroyed) {
          subscriber.reply.raw.end();
        }
      } catch {
        // Ignored during shutdown
      }
      this.subscribers.delete(id);
    }
  }
}

export const sseManager = new SseManager();

export function broadcastSseEvent(event: McpSseEvent, sessionId?: string): void {
  for (const manager of activeManagers) {
    manager.broadcast(event, sessionId);
  }
}

export function getActiveSseSubscriberCount(): number {
  let count = 0;
  for (const manager of activeManagers) {
    count += manager.getActiveSubscriberCount();
  }
  return count;
}
