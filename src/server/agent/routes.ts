/**
 * Fastify Routes for MOD-03 Bedrock Agent
 * Endpoints:
 * - POST /agent/chat: JSON and SSE streaming chat turn with tool loops & fallback
 * - GET /agent/session/:sessionId: Ephemeral session message history
 * - DELETE /agent/session/:sessionId: Instant session purge & cart wipe (PRIV-002)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AgentChatRequestSchema, type AgentChatRequest } from '../../shared/types/agent';
import { AgentService, agentService as defaultAgentService } from './agent';

export function registerAgentRoutes(
  fastify: FastifyInstance,
  customAgentService?: AgentService
): void {
  const service = customAgentService || defaultAgentService;

  // 1. POST /agent/chat
  fastify.post('/agent/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = (request.body as Record<string, unknown>) || {};

    // Allow sessionId to be passed in header if not in body
    const headerSessionId = request.headers['x-session-id'] as string | undefined;
    if (!rawBody.sessionId && headerSessionId) {
      rawBody.sessionId = headerSessionId;
    }

    // Accept header text/event-stream can also trigger streaming
    const acceptHeader = request.headers['accept'] || '';
    if (rawBody.stream === undefined && typeof acceptHeader === 'string' && acceptHeader.includes('text/event-stream')) {
      rawBody.stream = true;
    }

    const parseResult = AgentChatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid agent chat request parameters',
        issues: parseResult.error.issues,
      });
    }

    const chatRequest: AgentChatRequest = parseResult.data;

    // A. Streaming SSE Mode
    if (chatRequest.stream) {
      const isFallback = service.isMockMode();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Bedrock-Fallback': isFallback ? 'true' : 'false',
      });

      try {
        const stream = service.chatStream(chatRequest);
        for await (const chunk of stream) {
          if (reply.raw.destroyed) {
            break;
          }

          if (chunk.type === 'token') {
            reply.raw.write(`event: token\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
          } else if (chunk.type === 'tool_call') {
            reply.raw.write(
              `event: tool_call\ndata: ${JSON.stringify({
                toolName: chunk.toolName,
                toolUseId: chunk.toolUseId,
                input: chunk.input,
              })}\n\n`
            );
          } else if (chunk.type === 'tool_result') {
            reply.raw.write(
              `event: tool_result\ndata: ${JSON.stringify({
                toolUseId: chunk.toolUseId,
                result: chunk.result,
              })}\n\n`
            );
          } else if (chunk.type === 'widget') {
            reply.raw.write(
              `event: widget\ndata: ${JSON.stringify({
                widgetType: chunk.widgetType,
                title: chunk.title,
                payload: chunk.payload,
              })}\n\n`
            );
          } else if (chunk.type === 'done') {
            reply.raw.write(
              `event: done\ndata: ${JSON.stringify({
                spokenText: chunk.spokenText,
                wordCount: chunk.wordCount,
                fallbackTriggered: chunk.fallbackTriggered,
              })}\n\n`
            );
          } else if (chunk.type === 'error') {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({
                message: chunk.message,
                code: chunk.code,
              })}\n\n`
            );
          }
        }
      } catch (streamErr) {
        if (!reply.raw.destroyed) {
          reply.raw.write(
            `event: error\ndata: ${JSON.stringify({
              message: (streamErr as Error)?.message || 'Stream processing error',
            })}\n\n`
          );
        }
      } finally {
        if (!reply.raw.destroyed) {
          reply.raw.end();
        }
      }

      return;
    }

    // B. Non-Streaming JSON Mode
    const response = await service.chat(chatRequest);
    reply.header('X-Bedrock-Fallback', response.fallbackTriggered ? 'true' : 'false');
    return reply.status(200).send(response);
  });

  // 2. GET /agent/session/:sessionId
  fastify.get('/agent/session/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = request.params as { sessionId: string };
    if (!sessionId) {
      return reply.status(400).send({ error: 'sessionId parameter is required' });
    }

    const messages = service.getSessionHistory(sessionId);
    return reply.status(200).send({
      sessionId,
      messageCount: messages.length,
      messages,
    });
  });

  // 3. DELETE /agent/session/:sessionId
  fastify.delete('/agent/session/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = request.params as { sessionId: string };
    if (!sessionId) {
      return reply.status(400).send({ error: 'sessionId parameter is required' });
    }

    service.clearSession(sessionId);
    return reply.status(200).send({
      sessionId,
      cleared: true,
      message: 'Session history and cart cleared',
    });
  });
}
