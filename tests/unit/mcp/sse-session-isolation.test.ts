import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SseManager } from '../../../src/server/transport/sse';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('SSE Session Isolation & Strict Unicast (Option A)', () => {
  let sseManager: SseManager;

  beforeEach(() => {
    sseManager = new SseManager(60000); // 60s heartbeat to avoid noise
  });

  afterEach(() => {
    sseManager.closeAll();
  });

  function createMockSubscriber(sessionId?: string) {
    const writtenFrames: string[] = [];
    const mockReply = {
      raw: {
        destroyed: false,
        writableEnded: false,
        writeHead: () => {},
        write: (chunk: string) => {
          writtenFrames.push(chunk);
          return true;
        },
        end: () => {},
      },
    } as unknown as FastifyReply;

    const mockRequest = {
      query: sessionId ? { sessionId } : {},
      headers: {},
      raw: {
        on: () => {},
      },
    } as unknown as FastifyRequest;

    sseManager.handleConnection(mockRequest, mockReply);
    return { writtenFrames, mockReply };
  }

  it('delivers targeted events ONLY to the matching subscriber (Option A)', () => {
    const subA = createMockSubscriber('user-session-a');
    const subB = createMockSubscriber('user-session-b');
    const subAmbient = createMockSubscriber(undefined); // No sessionId

    // Discard initial connected frame
    subA.writtenFrames.length = 0;
    subB.writtenFrames.length = 0;
    subAmbient.writtenFrames.length = 0;

    // Broadcast targeted at user-session-a
    sseManager.broadcast(
      {
        event: 'widget',
        data: { widgetType: 'recipe_card', title: 'Targeted Salmon Bowl' },
      },
      'user-session-a'
    );

    // Assert: Only subA receives the widget frame
    expect(subA.writtenFrames.length).toBe(1);
    expect(subA.writtenFrames[0]).toContain('Targeted Salmon Bowl');

    // Assert: Neither sibling session nor ambient display receives it
    expect(subB.writtenFrames.length).toBe(0);
    expect(subAmbient.writtenFrames.length).toBe(0);
  });

  it('delivers untargeted global events to all subscribers including ambient displays', () => {
    const subA = createMockSubscriber('user-session-a');
    const subB = createMockSubscriber('user-session-b');
    const subAmbient = createMockSubscriber(undefined);

    subA.writtenFrames.length = 0;
    subB.writtenFrames.length = 0;
    subAmbient.writtenFrames.length = 0;

    // Untargeted global broadcast (e.g. system emergency alert or timer)
    sseManager.broadcast({
      event: 'system_alert',
      data: { message: 'Household dinner ready' },
    });

    expect(subA.writtenFrames.length).toBe(1);
    expect(subB.writtenFrames.length).toBe(1);
    expect(subAmbient.writtenFrames.length).toBe(1);
    expect(subAmbient.writtenFrames[0]).toContain('Household dinner ready');
  });
});
